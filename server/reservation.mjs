import { getEvent, INVENTORY_POOL, TOTAL_SCREENS } from './lib/config.mjs';
import { getStripe, json } from './lib/http.mjs';
import { isValidMontage } from '../shared/montage.mjs';

// Montants réellement calculés par Stripe : ne jamais reconstituer une ancienne taxe
// à partir des nouveaux tarifs. Sans ventilation disponible, garder la taxe globale.
function taxBreakdown(session, metadata) {
  const unknown = {gstCents:null,qstCents:null};
  const rows = session.total_details?.breakdown?.taxes;
  if (!Array.isArray(rows)) return unknown;
  let gstCents=0,qstCents=0;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.amount) || row.amount < 0) return unknown;
    const id = typeof row.rate === 'string' ? row.rate : row.rate?.id;
    const percentage = Number(row.rate?.percentage);
    if (id && id === metadata.gst_tax_rate) gstCents+=row.amount;
    else if (id && id === metadata.qst_tax_rate) qstCents+=row.amount;
    else if (percentage === 5) gstCents+=row.amount;
    else if (percentage === 9.975) qstCents+=row.amount;
    else if (row.amount !== 0) return unknown;
  }
  return gstCents+qstCents === session.total_details.amount_tax ? {gstCents,qstCents} : unknown;
}

// Retourne uniquement un récapitulatif non personnel, jamais le courriel, l’adresse ou les détails de carte.
export const makeHandler = (stripeFactory = getStripe) => async (req) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const params = new URL(req.url).searchParams;
  const event = getEvent(params.get('event'));
  const sessionId = params.get('session_id');
  if (!event || !sessionId || !/^cs_[A-Za-z0-9_]{8,240}$/.test(sessionId)) return json({ error: 'reservation_not_found' }, 404);
  try {
    const session = await stripeFactory().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge', 'total_details.breakdown'] });
    const metadata = session.metadata || {};
    const screens = Number(metadata.screens);
    if (metadata.event !== event.id || (metadata.inventory_pool && metadata.inventory_pool !== INVENTORY_POOL) || !Number.isInteger(screens) || screens < 1 || screens > TOTAL_SCREENS) return json({ error: 'reservation_not_found' }, 404);
    const montage = metadata.montage ?? 'none';
    const montageCents = Number(metadata.montage_cents ?? 0);
    if (!isValidMontage(montage) || !Number.isSafeInteger(montageCents) || montageCents < 0 || montageCents > session.amount_subtotal || (montage === 'none' ? montageCents !== 0 : montageCents === 0)) return json({ error: 'reservation_not_found' }, 404);
    const refunded = session.payment_intent?.latest_charge?.refunded === true;
    const status = refunded ? 'refunded' : session.status === 'complete' && session.payment_status === 'paid' ? 'paid' : session.status === 'expired' ? 'expired' : 'pending';
    return json({
      eventId: event.id, status, screens, montage, montageCents, currency: session.currency,
      rentalCents: Number.isSafeInteger(session.amount_subtotal) ? session.amount_subtotal - montageCents : null,
      subtotalCents: session.amount_subtotal, taxCents: session.total_details?.amount_tax ?? 0, totalCents: session.amount_total,
      ...taxBreakdown(session, metadata), includedLogistics: metadata.logistics_included !== 'false',
    });
  } catch (error) {
    if (error.code === 'resource_missing') return json({ error: 'reservation_not_found' }, 404);
    console.error('reservation', error.message);
    return json({ error: 'verification_unavailable' }, 503);
  }
};
export default makeHandler();
export const config = { path: '/api/reservation' };
