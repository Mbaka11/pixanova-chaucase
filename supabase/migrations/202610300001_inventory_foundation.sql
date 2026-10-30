-- Pixanova Events — fondation du stock transactionnel.
-- Projet Supabase DÉDIÉ uniquement. Ne pas exécuter dans le client-brief.
-- Aucun paiement réel n'est activé par cette migration.
begin;

create table public.events_inventory_pools (
  environment text not null check (environment in ('test', 'live')),
  pool_id text not null,
  capacity integer not null check (capacity between 1 and 1000),
  primary key (environment, pool_id)
);

insert into public.events_inventory_pools (environment, pool_id, capacity)
values ('test', 'pixanova-led', 20), ('live', 'pixanova-led', 20);

create table public.events_reservations (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  pool_id text not null,
  request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  event_id text not null,
  screens integer not null check (screens between 1 and 20),
  rental_start timestamptz not null,
  rental_end timestamptz not null,
  state text not null default 'allocating'
    check (state in ('allocating', 'held', 'pending', 'paid', 'released', 'review')),
  -- Ne JAMAIS libérer sur la seule base de cette date : Stripe doit avoir
  -- confirmé l'expiration / l'échec terminal de la session correspondante.
  hold_until timestamptz not null,
  stripe_session_id text,
  stripe_payment_intent_id text,
  expected_total_cents integer not null check (expected_total_cents >= 0),
  currency text not null check (currency = 'cad'),
  -- Prix et choix figés côté serveur, sans coordonnées personnelles.
  order_snapshot jsonb not null check (jsonb_typeof(order_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (environment, pool_id)
    references public.events_inventory_pools (environment, pool_id),
  unique (environment, request_id),
  unique (environment, stripe_session_id),
  check (rental_start < rental_end)
);

create index events_reservations_window_idx
  on public.events_reservations (environment, pool_id, rental_start, rental_end)
  where state <> 'released';

-- Boîte de réception durable : traitement / reprise des webhooks à venir.
-- Pas de payload brut contenant les coordonnées des clients.
create table public.events_webhook_receipts (
  environment text not null check (environment in ('test', 'live')),
  stripe_event_id text not null,
  event_type text not null,
  object_id text not null,
  state text not null default 'received' check (state in ('received', 'processed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (environment, stripe_event_id)
);

alter table public.events_inventory_pools enable row level security;
alter table public.events_reservations enable row level security;
alter table public.events_webhook_receipts enable row level security;
-- Aucune policy navigateur : accès serveur seulement.
revoke all on public.events_inventory_pools, public.events_reservations,
  public.events_webhook_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.events_inventory_pools,
  public.events_reservations, public.events_webhook_receipts to service_role;

create function public.events_reserve_inventory(
  p_environment text,
  p_pool_id text,
  p_request_id uuid,
  p_request_fingerprint text,
  p_event_id text,
  p_screens integer,
  p_rental_start timestamptz,
  p_rental_end timestamptz,
  p_hold_until timestamptz,
  p_expected_total_cents integer,
  p_currency text,
  p_order_snapshot jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_peak integer;
  v_row public.events_reservations;
begin
  if p_environment is null or p_environment not in ('test', 'live')
    or p_request_id is null or p_event_id is null or length(p_event_id) = 0
    or p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_screens is null or p_screens not between 1 and 20
    or p_rental_start is null or p_rental_end is null or p_rental_start >= p_rental_end
    or p_hold_until is null
    or p_expected_total_cents is null or p_expected_total_cents < 0
    or p_currency is distinct from 'cad'
    or p_order_snapshot is null or jsonb_typeof(p_order_snapshot) <> 'object'
  then
    raise exception 'invalid_reservation' using errcode = '22023';
  end if;

  -- Un seul écrivain par environnement/parc pendant la transaction.
  -- Toutes les futures transitions de stock doivent prendre ce même verrou.
  select capacity into v_capacity from public.events_inventory_pools
    where environment = p_environment and pool_id = p_pool_id for update;
  if not found then raise exception 'unknown_inventory_pool'; end if;

  select * into v_row from public.events_reservations
    where environment = p_environment and request_id = p_request_id;
  if found then
    if v_row.pool_id is distinct from p_pool_id
      or v_row.request_fingerprint is distinct from p_request_fingerprint
      or v_row.event_id is distinct from p_event_id
      or v_row.screens is distinct from p_screens
      or v_row.rental_start is distinct from p_rental_start
      or v_row.rental_end is distinct from p_rental_end
      or v_row.expected_total_cents is distinct from p_expected_total_cents
      or v_row.currency is distinct from p_currency
      or v_row.order_snapshot is distinct from p_order_snapshot
    then
      return jsonb_build_object('ok', false, 'error', 'idempotency_conflict');
    end if;
    -- Un retry ne crée pas une nouvelle réservation et ne prolonge pas le hold.
    return jsonb_build_object('ok', true, 'reused', true, 'reservation', to_jsonb(v_row));
  end if;

  if p_hold_until <= now() or p_hold_until > now() + interval '2 hours' then
    raise exception 'invalid_hold_until' using errcode = '22023';
  end if;

  -- Pic de concurrence dans la fenêtre semi-ouverte [début, fin[.
  -- Les événements disjoints partagent le parc sans être additionnés.
  with relevant as (
    select screens, greatest(rental_start, p_rental_start) as starts_at,
      least(rental_end, p_rental_end) as ends_at
    from public.events_reservations
    where environment = p_environment and pool_id = p_pool_id
      and state <> 'released'
      and rental_start < p_rental_end and rental_end > p_rental_start
  ), boundaries as (
    select starts_at as at_time, screens as delta from relevant
    union all
    select ends_at, -screens from relevant
  ), grouped as (
    select at_time, sum(delta) as delta from boundaries group by at_time
  ), running as (
    select sum(delta) over (order by at_time) as usage from grouped
  ) select coalesce(max(usage), 0)::integer into v_peak from running;

  if v_peak + p_screens > v_capacity then
    return jsonb_build_object('ok', false, 'error', 'not_enough_stock',
      'remaining', greatest(0, v_capacity - v_peak));
  end if;

  insert into public.events_reservations (
    environment, pool_id, request_id, request_fingerprint, event_id, screens,
    rental_start, rental_end, hold_until, expected_total_cents, currency, order_snapshot
  ) values (
    p_environment, p_pool_id, p_request_id, p_request_fingerprint, p_event_id, p_screens,
    p_rental_start, p_rental_end, p_hold_until, p_expected_total_cents, p_currency, p_order_snapshot
  ) returning * into v_row;
  return jsonb_build_object('ok', true, 'reused', false, 'reservation', to_jsonb(v_row));
end;
$$;

revoke all on function public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb)
  to service_role;

commit;
