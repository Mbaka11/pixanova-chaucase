import { getEvent, catalog } from './lib/config.mjs';
import { getStripe, json } from './lib/http.mjs';
import { bookingIsOpen, isValidScreens } from './lib/pricing.mjs';
import { computeOrder, isValidMontage } from '../shared/order.mjs';
import { getTaxRateIds } from './lib/taxes.mjs';

// Aucun écran bloqué et aucune session créée à l’ouverture du récapitulatif.
export const makeHandler = (stripeFactory = getStripe, now = Date.now) => async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  const event = getEvent(body?.eventId);
  if (!event?.active) return json({ error: 'event_not_found' }, 404);
  if (!bookingIsOpen(event, now())) return json({ error: 'booking_closed' }, 409);
  const montage = body?.montage === undefined ? 'none' : body.montage;
  if (!isValidScreens(event, body?.screens) || !isValidMontage(montage)) return json({ error: 'invalid_order' }, 400);
  try {
    await getTaxRateIds(stripeFactory());
    return json(computeOrder(event, catalog.platform, body.screens, montage, now()));
  } catch (error) {
    console.error('quote', error.message);
    return json({ error: error.message === 'tax_rates_not_configured' ? error.message : 'quote_unavailable' }, 503);
  }
};
export default makeHandler();
export const config = { path: '/api/quote' };
