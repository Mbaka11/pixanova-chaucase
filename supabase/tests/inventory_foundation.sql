-- Contrôle de la fondation, après la migration, dans le projet Events dédié.
-- Toutes les données d'essai sont annulées par ROLLBACK.
-- Utilise un parc de test isolé, pas le parc des réservations existantes.
begin;
insert into public.events_inventory_pools values
  ('test', 'qa-foundation', 20), ('live', 'qa-foundation', 20);
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  r jsonb;
  from_at timestamptz := '2099-01-01T00:00:00Z';
  to_at timestamptz := '2099-01-03T00:00:00Z';
  until_at timestamptz := now() + interval '30 minutes';
begin
  if has_table_privilege('anon', 'public.events_reservations', 'SELECT')
    or has_table_privilege('authenticated', 'public.events_reservations', 'SELECT')
  then raise exception 'FAIL: table accessible au navigateur'; end if;
  if has_function_privilege('anon',
    'public.events_reserve_inventory(text,text,uuid,text,text,integer,timestamptz,timestamptz,timestamptz,integer,text,jsonb)', 'EXECUTE')
  then raise exception 'FAIL: fonction accessible au navigateur'; end if;

  r := public.events_reserve_inventory('test','qa-foundation',a,repeat('a',64),'qa',10,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'ok' <> 'true' or r->>'reused' <> 'false' then raise exception 'FAIL: allocation'; end if;
  r := public.events_reserve_inventory('test','qa-foundation',a,repeat('a',64),'qa',10,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'reused' <> 'true' then raise exception 'FAIL: idempotence'; end if;
  r := public.events_reserve_inventory('test','qa-foundation',a,repeat('b',64),'qa',10,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'error' <> 'idempotency_conflict' then raise exception 'FAIL: conflit'; end if;

  r := public.events_reserve_inventory('test','qa-foundation',b,repeat('b',64),'qa',10,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'ok' <> 'true' then raise exception 'FAIL: dernier stock'; end if;
  r := public.events_reserve_inventory('test','qa-foundation',c,repeat('c',64),'qa',1,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'error' <> 'not_enough_stock' or (r->>'remaining')::integer <> 0
  then raise exception 'FAIL: dépassement'; end if;

  r := public.events_reserve_inventory('test','qa-foundation',c,repeat('c',64),'qa',20,
    to_at,to_at + interval '1 day',until_at,100,'cad','{}');
  if r->>'ok' <> 'true' then raise exception 'FAIL: frontière adjacente'; end if;
  r := public.events_reserve_inventory('live','qa-foundation',a,repeat('a',64),'qa',20,
    from_at,to_at,until_at,100,'cad','{}');
  if r->>'ok' <> 'true' then raise exception 'FAIL: isolation test/réel'; end if;
  raise notice 'PASS: fondation, droits, idempotence, capacité, frontières et isolation.';
end $$;
rollback;
