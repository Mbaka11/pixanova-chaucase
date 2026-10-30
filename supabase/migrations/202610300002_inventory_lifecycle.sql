-- Pixanova Events : cycle de vie et garde de bascule.
-- À exécuter APRÈS 202610300001, une seule fois, dans le projet Events dédié.
begin;
alter table public.events_inventory_pools add column ready boolean not null default false;
alter table public.events_reservations
  add column release_reason text,
  add column notification_state text not null default 'pending' check (notification_state in ('pending','sending','sent')),
  add column notification_token uuid,
  add column notification_lease_until timestamptz;

-- L'ancien moteur devient interne. Le wrapper prend le même verrou et vérifie
-- que l'import des sessions préexistantes a été effectué avant toute réservation.
alter function public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb)
  rename to events_reserve_inventory_internal;
revoke all on function public.events_reserve_inventory_internal(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb)
  from public, anon, authenticated, service_role;

create function public.events_reserve_inventory(
  p_environment text, p_pool_id text, p_request_id uuid, p_request_fingerprint text,
  p_event_id text, p_screens integer, p_rental_start timestamptz, p_rental_end timestamptz,
  p_hold_until timestamptz, p_expected_total_cents integer, p_currency text, p_order_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ready boolean;
begin
  select ready into v_ready from public.events_inventory_pools
    where environment=p_environment and pool_id=p_pool_id for update;
  if not found or not v_ready then
    return jsonb_build_object('ok',false,'error','inventory_not_initialized');
  end if;
  return public.events_reserve_inventory_internal(p_environment,p_pool_id,p_request_id,p_request_fingerprint,
    p_event_id,p_screens,p_rental_start,p_rental_end,p_hold_until,p_expected_total_cents,p_currency,p_order_snapshot);
end;
$$;

create function public.events_apply_inventory_state(
  p_environment text, p_request_id uuid, p_session_id text,
  p_state text, p_reason text, p_total_cents integer,
  p_payment_intent_id text default null,
  p_stripe_event_id text default null, p_event_type text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_pool text; v_row public.events_reservations;
begin
  select pool_id into v_pool from public.events_reservations
    where environment=p_environment and request_id=p_request_id;
  if not found then raise exception 'reservation_missing'; end if;
  perform 1 from public.events_inventory_pools where environment=p_environment and pool_id=v_pool for update;
  select * into v_row from public.events_reservations
    where environment=p_environment and request_id=p_request_id for update;
  if p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$'
    or (v_row.stripe_session_id is not null and v_row.stripe_session_id<>p_session_id)
  then raise exception 'session_conflict'; end if;
  if p_state is null or p_state not in ('held','pending','paid','released','review') then raise exception 'invalid_state'; end if;
  if p_reason is null or not (
    (p_state='held' and p_reason='session_open') or
    (p_state='pending' and p_reason='payment_pending') or
    (p_state='paid' and p_reason='payment_paid') or
    (p_state='review' and p_reason='verification_failed') or
    (p_state='released' and p_reason in ('session_expired','payment_failed','full_refund'))
  ) then raise exception 'invalid_reason'; end if;
  if p_state<>'review' and p_total_cents is distinct from v_row.expected_total_cents
  then raise exception 'amount_conflict'; end if;

  -- Un snapshot ancien ne peut pas annuler un remboursement intégral confirmé.
  -- Un événement ancien 'open/unpaid/expired' ne peut pas annuler un paiement.
  if v_row.state='released' then
    if p_state<>'released' then
      -- Une contradiction conserve la libération prouvée ; l'appelant doit
      -- signaler l'anomalie. Jamais de réallocation silencieuse sans capacité.
      if p_state in ('paid','review') and v_row.release_reason<>'full_refund'
      then raise exception 'terminal_state_conflict'; end if;
    end if;
    return to_jsonb(v_row);
  elsif v_row.state='paid' and p_state in ('held','pending') then
    return to_jsonb(v_row);
  elsif v_row.state='paid' and p_state='released' and p_reason<>'full_refund' then
    return to_jsonb(v_row);
  end if;

  update public.events_reservations set stripe_session_id=p_session_id,
    stripe_payment_intent_id=coalesce(p_payment_intent_id,stripe_payment_intent_id),
    state=p_state, release_reason=case when p_state='released' then p_reason else null end,
    updated_at=clock_timestamp()
    where id=v_row.id returning * into v_row;
  if p_stripe_event_id is not null then
    insert into public.events_webhook_receipts(environment,stripe_event_id,event_type,object_id)
      values(p_environment,p_stripe_event_id,coalesce(p_event_type,'unknown'),p_session_id)
      on conflict (environment,stripe_event_id) do nothing;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- Outbox : bail renouvelable, puis confirmation. L'appel Resend garde sa clé
-- d'idempotence ; la ligne sent empêche les renvois après la fenêtre Resend.
create function public.events_claim_notification(p_environment text,p_request_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null then raise exception 'invalid_token'; end if;
  update public.events_reservations set notification_state='sending',notification_token=p_token,
    notification_lease_until=now()+interval '5 minutes'
    where environment=p_environment and request_id=p_request_id and state='paid'
      and notification_state<>'sent'
      and (notification_lease_until is null or notification_lease_until<now());
  return found;
end;
$$;
create function public.events_finish_notification(p_environment text,p_request_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.events_reservations set notification_state='sent',notification_lease_until=null,
    notification_token=null
    where environment=p_environment and request_id=p_request_id
      and notification_token=p_token and notification_state='sending';
  return found;
end;
$$;

revoke all on function public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.events_apply_inventory_state(text,uuid,text,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.events_claim_notification(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.events_finish_notification(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb) to service_role;
grant execute on function public.events_apply_inventory_state(text,uuid,text,text,text,integer,text,text,text) to service_role;
grant execute on function public.events_claim_notification(text,uuid,uuid) to service_role;
grant execute on function public.events_finish_notification(text,uuid,uuid) to service_role;
commit;
