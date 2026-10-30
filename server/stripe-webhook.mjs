import { INVENTORY_POOL } from './lib/config.mjs';
import { belongsToPool } from './lib/inventory-scope.mjs';
import { getStripe, json } from './lib/http.mjs';
import { notifyTeam } from './lib/notifications.mjs';
import { createInventory } from './lib/inventory.mjs';
import { supabaseEnabled, stripeEnvironment } from './lib/inventory-db.mjs';

export const inventoryEvents = new Set([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded',
]);

export const makeHandler = (stripeFactory = getStripe, inventoryFactory = createInventory) => async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'webhook_not_configured' }, 500);
  let event, stripe;
  try {
    stripe = stripeFactory();
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), secret);
  } catch {
    console.error('webhook_signature_invalid');
    return json({ error: 'invalid_signature' }, 400);
  }
  try {
    if (supabaseEnabled() && inventoryEvents.has(event.type)) {
      const environment = stripeEnvironment();
      if (event.livemode !== (environment === 'live')) return json({ error: 'webhook_environment_mismatch' }, 400);
      const inventory = inventoryFactory();
      const poolId = inventory.poolId || INVENTORY_POOL;
      let session, row;
      const object = event.data.object;
      if (event.type === 'charge.refunded') {
        const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
        if (!intentId) return json({ received: true }); // Charge hors Checkout.
        // Retrouver la session via Stripe, pas via des métadonnées de charge supposées.
        const sessions = await stripe.checkout.sessions.list({ payment_intent: intentId, limit: 10 });
        if (sessions.has_more) throw new Error('refund_session_ambiguous');
        const candidates = sessions.data.filter(s => belongsToPool(s, poolId));
        if (candidates.length > 1) throw new Error('refund_session_ambiguous');
        if (!candidates.length) return json({ received: true });
        session = candidates[0];
      } else session = object;
      if (!belongsToPool(session, poolId)) return json({ received: true });
      row = await inventory.db.bySession(environment, session.id);
      if (!row && session.metadata?.inventory_request_id) row = await inventory.find(session.metadata.inventory_request_id);
      // Un événement peut arriver avant que Checkout ait attaché l'ID Stripe.
      // En cas de ligne manquante, Stripe doit réessayer, pas perdre l'événement.
      if (!row) throw new Error('inventory_reservation_missing');
      const current = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent.latest_charge'] });
      const result = await inventory.reconcile(stripe, row, { session: current, stripeEvent: event });
      await inventory.notify(result.row, result.session, notifyTeam);
      await inventory.db.request(`events_webhook_receipts?environment=eq.${environment}&stripe_event_id=eq.${encodeURIComponent(event.id)}`, {
        method: 'PATCH', body: { state: 'processed', processed_at: new Date().toISOString() },
      });
    } else if (!supabaseEnabled() && ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object;
      if (session.payment_status === 'paid' && belongsToPool(session)) await notifyTeam(session);
    }
    return json({ received: true });
  } catch {
    // Les erreurs ne doivent pas afficher de payload ni de coordonnées client.
    console.error('webhook_processing_failed');
    return json({ error: 'webhook_processing_failed' }, 500);
  }
};
export default makeHandler();
export const config = { path: '/api/stripe-webhook' };
