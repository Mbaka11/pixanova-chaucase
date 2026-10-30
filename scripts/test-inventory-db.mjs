import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localConfig } from './lib/local-config.mjs';
import { createInventoryDb } from '../server/lib/inventory-db.mjs';

const env = localConfig();
const db = createInventoryDb({ url: env.SUPABASE_URL, secret: env.SUPABASE_SECRET_KEY });
const pool = `qa-${randomUUID()}`;
let created = false;
const base = {
  p_environment: 'test', p_pool_id: pool, p_request_fingerprint: 'a'.repeat(64), p_event_id: 'qa-isolated',
  p_screens: 1, p_rental_start: '2099-01-01T00:00:00Z', p_rental_end: '2099-01-03T00:00:00Z',
  p_hold_until: new Date(Date.now() + 1800000).toISOString(), p_expected_total_cents: 100, p_currency: 'cad', p_order_snapshot: {},
};
try {
  await db.request('events_inventory_pools', { method: 'POST', body: ['test','live'].map(environment => ({ environment, pool_id: pool, capacity: 20 })) });
  created = true;
  const lifecycle = Object.hasOwn(await db.pool('test', pool), 'ready');
  if (lifecycle) {
    const blocked = await db.reserve({ ...base, p_request_id: randomUUID() });
    assert.equal(blocked.error, 'inventory_not_initialized');
    await db.request(`events_inventory_pools?pool_id=eq.${pool}`, { method: 'PATCH', body: { ready: true } });
  }
  const outcomes = await Promise.all(Array.from({ length: 32 }, () => db.reserve({ ...base, p_request_id: randomUUID() })));
  assert.equal(outcomes.filter(r => r.ok).length, 20);
  assert.equal(outcomes.filter(r => r.error === 'not_enough_stock').length, 12);
  const row = outcomes.find(r => r.ok).reservation;
  assert.equal((await db.reserve({ ...base, p_request_id: row.request_id })).reused, true);
  assert.equal((await db.reserve({ ...base, p_request_id: row.request_id, p_screens: 2 })).error, 'idempotency_conflict');
  assert.equal((await db.reserve({ ...base, p_environment: 'live', p_request_id: row.request_id, p_screens: 20 })).ok, true);
  assert.equal((await db.reserve({ ...base, p_request_id: randomUUID(), p_screens: 20, p_rental_start: base.p_rental_end, p_rental_end: '2099-01-04T00:00:00Z' })).ok, true);
  console.log('PASS : 32 réservations simultanées, 20 acceptées, 12 refusées ; retries, conflit, frontière et isolation test/réel.');
  if (lifecycle) {
    const input = { p_environment: 'test', p_request_id: row.request_id, p_session_id: `cs_qa_${randomUUID().replaceAll('-','')}`,
      p_state: 'held', p_reason: 'session_open', p_total_cents: 100 };
    const held = await db.transition(input); assert.equal(held.state, 'held');
    const paid = await db.transition({ ...input, p_state: 'paid', p_reason: 'payment_paid' }); assert.equal(paid.state, 'paid');
    const stale = await db.transition(input); assert.equal(stale.state, 'paid');
    const expiredAfterPaid = await db.transition({ ...input, p_state: 'released', p_reason: 'session_expired' }); assert.equal(expiredAfterPaid.state, 'paid');
    const token = randomUUID();
    const notification = { p_environment: 'test', p_request_id: row.request_id, p_token: token };
    assert.equal(await db.rpc('events_claim_notification', notification), true);
    assert.equal(await db.rpc('events_claim_notification', { ...notification, p_token: randomUUID() }), false);
    assert.equal(await db.rpc('events_finish_notification', { ...notification, p_token: randomUUID() }), false);
    assert.equal(await db.rpc('events_finish_notification', notification), true);
    assert.equal(await db.rpc('events_claim_notification', notification), false);
    const refunded = await db.transition({ ...input, p_state: 'released', p_reason: 'full_refund' }); assert.equal(refunded.state, 'released');
    const latePaid = await db.transition({ ...input, p_state: 'paid', p_reason: 'payment_paid' }); assert.equal(latePaid.state, 'released');
    const staleExpired = await db.transition({ ...input, p_state: 'released', p_reason: 'session_expired' }); assert.equal(staleExpired.release_reason, 'full_refund');
    const last = await db.reserve({ ...base, p_request_id: randomUUID() }); assert.equal(last.ok, true);
    assert.equal((await db.reserve({ ...base, p_request_id: randomUUID() })).error, 'not_enough_stock');
    console.log('PASS : garde de bascule, transitions désordonnées, remboursement complet, libération atomique et outbox durable.');
  } else console.log('Cycle de vie non testé : seconde migration encore à installer.');
} catch {
  console.error('ÉCHEC du contrôle PostgreSQL ; aucune clé ni donnée de réservation affichée.');
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      await db.request(`events_reservations?pool_id=eq.${pool}`, { method: 'DELETE' });
      await db.request(`events_inventory_pools?pool_id=eq.${pool}`, { method: 'DELETE' });
      console.log('Parc QA et réservations QA supprimés ; parc pixanova-led inchangé.');
    } catch { console.error('Nettoyage QA à reprendre pour le parc :', pool); process.exitCode = 1; }
  }
}
