import { randomUUID } from 'node:crypto';
import { createInventoryDb, stripeEnvironment, fingerprint } from './inventory-db.mjs';
import { peakUsageForPeriod } from './stock.mjs';
import { INVENTORY_POOL, TOTAL_SCREENS } from './config.mjs';

export const validRequestId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const stripeCreationKey = (environment, requestId) => `pixanova-events:${environment}:${requestId}`;
export const requestFingerprint = body => fingerprint({ eventId: body.eventId, screens: body.screens,
  montage: body.montage ?? 'none', language: body.language ?? 'fr', expectedTotalCents: body.expectedTotalCents ?? null });

export function createInventory({ db = createInventoryDb(), environment = stripeEnvironment(), poolId = INVENTORY_POOL } = {}) {
  async function assertReady() {
    const pool = await db.pool(environment, poolId);
    if (!pool.ready || pool.capacity !== TOTAL_SCREENS) throw new Error('inventory_not_initialized');
    return pool;
  }
  return {
    db, environment, poolId, assertReady,
    async stock(event) {
      const pool = await assertReady();
      const rows = await db.rows(environment, poolId);
      const taken = peakUsageForPeriod(event.dates, rows.map(r => ({ screens: r.screens, rentalStartsAt: r.rental_start, rentalEndsAt: r.rental_end })));
      return { eventId: event.id, total: pool.capacity, taken, remaining: Math.max(0, pool.capacity - taken),
        rentalStartsAt: event.dates.rentalStartsAt, rentalEndsAt: event.dates.rentalEndsAt };
    },
    async reserve(body, event, price, params) {
      return db.reserve({ p_environment: environment, p_pool_id: poolId,
        p_request_id: body.requestId, p_request_fingerprint: requestFingerprint(body),
        p_event_id: event.id, p_screens: body.screens,
        p_rental_start: event.dates.rentalStartsAt, p_rental_end: event.dates.rentalEndsAt,
        p_hold_until: new Date(params.expires_at * 1000).toISOString(),
        p_expected_total_cents: price.totalCents, p_currency: 'cad',
        p_order_snapshot: { price, checkout: params },
      });
    },
    find: requestId => db.find(environment, requestId),
    async reconcile(stripe, row, { session, stripeEvent } = {}) {
      if (!session) {
        if (row.stripe_session_id) {
          session = await stripe.checkout.sessions.retrieve(row.stripe_session_id, { expand: ['payment_intent.latest_charge'] });
        } else {
          // Réparer le timeout entre Stripe.create et l'attachement en DB.
          // Ne jamais recréer après expiration de la fenêtre d'idempotence Stripe.
          const params = row.order_snapshot.checkout;
          if (!params || !Number.isFinite(Date.parse(row.created_at)) || Date.now() - Date.parse(row.created_at) > 23 * 3600000) {
            // La recherche Stripe/list opérateur peut retrouver une session créée
            // avant timeout. Sans preuve, conserver le stock, jamais libérer.
            throw new Error('inventory_recovery_required');
          }
          session = await stripe.checkout.sessions.create(params, { idempotencyKey: stripeCreationKey(environment, row.request_id) });
        }
      }
      const metadata = session.metadata || {};
      const legacy = row.order_snapshot.legacy === true;
      const valid = session.livemode === (environment === 'live')
        && session.currency === row.currency && session.amount_total === row.expected_total_cents
        && (metadata.inventory_pool === row.pool_id || (legacy && !metadata.inventory_pool)) && metadata.event === row.event_id
        && Number(metadata.screens) === row.screens
        && (legacy || (metadata.inventory_request_id === row.request_id && metadata.inventory_environment === environment))
        && (legacy || (Date.parse(metadata.rental_start) === Date.parse(row.rental_start) && Date.parse(metadata.rental_end) === Date.parse(row.rental_end)));
      const intent = session.payment_intent;
      let state = 'review', reason = 'verification_failed';
      if (valid) {
        if (intent?.latest_charge?.refunded === true) { state = 'released'; reason = 'full_refund'; }
        else if (session.status === 'complete' && session.payment_status === 'paid') { state = 'paid'; reason = 'payment_paid'; }
        else if (session.status === 'expired') { state = 'released'; reason = 'session_expired'; }
        else if (session.status === 'open') { state = 'held'; reason = 'session_open'; }
        else if (session.status === 'complete') {
          if ((stripeEvent?.type === 'checkout.session.async_payment_failed' && ['requires_payment_method','canceled'].includes(intent?.status)) || intent?.status === 'canceled') {
            state = 'released'; reason = 'payment_failed';
          } else { state = 'pending'; reason = 'payment_pending'; }
        }
      }
      const updated = await db.transition({ p_environment: environment, p_request_id: row.request_id,
        p_session_id: session.id, p_state: state, p_reason: reason, p_total_cents: session.amount_total,
        p_payment_intent_id: typeof intent === 'string' ? intent : intent?.id || null,
        p_stripe_event_id: stripeEvent?.id || null, p_event_type: stripeEvent?.type || null });
      if (!valid || updated.state === 'review') throw new Error('inventory_session_verification_failed');
      return { row: updated, session };
    },
    async notify(row, session, send) {
      if (row.state !== 'paid' || row.notification_state === 'sent') return;
      // Garder l'outbox en attente si Resend n'est pas encore configuré.
      if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_FROM || !process.env.NOTIFY_TO) return;
      const token = randomUUID();
      const claimed = await db.rpc('events_claim_notification', { p_environment: environment, p_request_id: row.request_id, p_token: token });
      if (!claimed) return;
      await send(session);
      const done = await db.rpc('events_finish_notification', { p_environment: environment, p_request_id: row.request_id, p_token: token });
      if (!done) throw new Error('notification_confirmation_failed');
    },
  };
}
