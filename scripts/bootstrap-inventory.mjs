import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { localConfig } from './lib/local-config.mjs';
import { liveConfig } from './lib/live-config.mjs';
import { createInventoryDb, stripeEnvironment, fingerprint } from '../server/lib/inventory-db.mjs';
import { getEvent, INVENTORY_POOL, TOTAL_SCREENS } from '../server/lib/config.mjs';
import { peakUsageForPeriod } from '../server/lib/stock.mjs';
import { belongsToPool } from '../server/lib/inventory-scope.mjs';

// Le réel exige --live et la configuration réelle séparée ; aucun changement
// implicite des clés du développement local. Le site cible doit être en pause.
const real = process.argv.includes('--live');
const env = real ? liveConfig() : localConfig();
const environment = real ? 'live' : 'test';
const site = process.argv[process.argv.indexOf('--site') + 1];
function requestId(sessionId) {
  const chars = createHash('sha256').update(`legacy:${sessionId}`).digest('hex').slice(0,32).split('');
  chars[12] = '4'; chars[16] = '8';
  const s = chars.join(''); return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
try {
  if (!process.argv.includes('--site') || !site?.startsWith('https://') || new URL(site).pathname !== '/') throw new Error('site_required');
  if (stripeEnvironment(env.STRIPE_SECRET_KEY) !== environment) throw new Error('key_environment_mismatch');
  if (real && new URL(site).origin !== env.SITE_URL) throw new Error('live_site_mismatch');
  const response = await fetch(`${new URL(site).origin}/api/checkout`, { method: 'POST', body: '{}', signal: AbortSignal.timeout(10000) });
  if (response.status !== 503 || (await response.json()).error !== 'checkout_paused') throw new Error('checkout_must_be_paused');
  const db = createInventoryDb({ url: env.SUPABASE_URL, secret: env.SUPABASE_SECRET_KEY });
  const pool = await db.pool(environment, INVENTORY_POOL);
  if (pool.ready !== false || pool.capacity !== TOTAL_SCREENS) throw new Error('pool_not_in_bootstrap_state');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 });
  let imported = 0;
  for await (const session of stripe.checkout.sessions.list({ limit: 100, expand: ['data.payment_intent.latest_charge'] })) {
    const m = session.metadata || {}, event = getEvent(m.event);
    if (!belongsToPool(session)) continue;
    if (session.livemode !== real || (m.inventory_pool && m.inventory_pool !== INVENTORY_POOL)) throw new Error('invalid_session_scope');
    const dates = (m.rental_start !== undefined || m.rental_end !== undefined)
      ? { rentalStartsAt: m.rental_start, rentalEndsAt: m.rental_end } : event?.dates;
    if (!dates || !Number.isFinite(Date.parse(dates.rentalStartsAt)) || !Number.isFinite(Date.parse(dates.rentalEndsAt))
      || Date.parse(dates.rentalStartsAt) >= Date.parse(dates.rentalEndsAt)
      || !Number.isInteger(Number(m.screens)) || Number(m.screens) < 1 || Number(m.screens) > 20
      || !Number.isSafeInteger(session.amount_total) || session.amount_total < 0 || session.currency !== 'cad') throw new Error('legacy_session_invalid');
    const refunded = session.payment_intent?.latest_charge?.refunded === true;
    const released = refunded || session.status === 'expired';
    const row = {
      environment, pool_id: INVENTORY_POOL, request_id: requestId(session.id), request_fingerprint: fingerprint({ legacy: session.id }),
      event_id: m.event, screens: Number(m.screens), rental_start: dates.rentalStartsAt, rental_end: dates.rentalEndsAt,
      state: released ? 'released' : session.status === 'open' ? 'held' : session.payment_status === 'paid' ? 'paid' : 'pending',
      hold_until: new Date((session.expires_at || session.created + 1800) * 1000).toISOString(),
      stripe_session_id: session.id, stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
      expected_total_cents: session.amount_total, currency: 'cad', order_snapshot: { legacy: true },
      release_reason: released ? (refunded ? 'full_refund' : 'session_expired') : null,
      // Ne pas renvoyer les anciens courriels pendant un import de l'historique.
      notification_state: 'sent',
    };
    await db.request('events_reservations?on_conflict=environment,stripe_session_id', {
      method: 'POST', body: row, prefer: 'resolution=merge-duplicates',
    });
    imported++;
  }
  const active = await db.rows(environment, INVENTORY_POOL);
  if (active.length) {
    const reservations = active.map(r => ({ screens: r.screens, rentalStartsAt: r.rental_start, rentalEndsAt: r.rental_end }));
    const start = Math.min(...reservations.map(r => Date.parse(r.rentalStartsAt)));
    const end = Math.max(...reservations.map(r => Date.parse(r.rentalEndsAt)));
    if (peakUsageForPeriod({ rentalStartsAt: new Date(start).toISOString(), rentalEndsAt: new Date(end).toISOString() }, reservations) > TOTAL_SCREENS) throw new Error('legacy_inventory_over_capacity');
  }
  await db.request(`events_inventory_pools?environment=eq.${environment}&pool_id=eq.${INVENTORY_POOL}`, { method: 'PATCH', body: { ready: true } });
  console.log(`Import ${real ? 'RÉEL' : 'TEST'} terminé : ${imported} sessions préservées ; parc prêt. Aucune session Stripe créée, expirée ou remboursée.`);
} catch (err) {
  const safe = ['site_required','key_environment_mismatch','live_site_mismatch','checkout_must_be_paused','pool_not_in_bootstrap_state','invalid_session_scope','legacy_session_invalid','legacy_inventory_over_capacity'];
  console.error('Import arrêté :', safe.includes(err.message) ? err.message : 'erreur de connexion ou de schéma ; aucun secret affiché');
  process.exitCode = 1;
}
