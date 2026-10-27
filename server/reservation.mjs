import { getEvent, INVENTORY_POOL, TOTAL_SCREENS } from './lib/config.mjs';
import { getStripe, json } from './lib/http.mjs';

// Retourne uniquement un récapitulatif non personnel, jamais le courriel, l’adresse ou les détails de carte.
export const makeHandler = (stripeFactory = getStripe) => async (req) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const params = new URL(req.url).searchParams;
  const event = getEvent(params.get('event'));
  const sessionId = params.get('session_id');
  if (!event || !sessionId || !/^cs_[A-Za-z0-9_]{8,240}$/.test(sessionId)) return json({ error: 'reservation_not_found' }, 404);
  try {
    const session = await stripeFactory().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge'] });
    const metadata = session.metadata || {};
    const screens = Number(metadata.screens);
    if (metadata.event !== event.id || (metadata.inventory_pool && metadata.inventory_pool !== INVENTORY_POOL) || !Number.isInteger(screens) || screens < 1 || screens > TOTAL_SCREENS) return json({ error: 'reservation_not_found' }, 404);
    const refunded = session.payment_intent?.latest_charge?.refunded === true;
    const status = refunded ? 'refunded' : session.status === 'complete' && session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : 'pending';
    return json({
      eventId: event.id, status, screens, currency: session.currency,
      subtotalCents: session.amount_subtotal, taxCents: session.total_details?.amount_tax ?? 0, totalCents: session.amount_total,
    });
  } catch (error) {
    if (error.code === 'resource_missing') return json({ error: 'reservation_not_found' }, 404);
    console.error('reservation', error.message);
    return json({ error: 'verification_unavailable' }, 503);
  }
};
export default makeHandler();
export const config = { path: '/api/reservation' };
