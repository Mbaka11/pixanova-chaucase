import { getEvent, catalog, INVENTORY_POOL, HOLD_MINUTES, TOTAL_SCREENS } from './lib/config.mjs';
import { getStripe, json, siteUrl } from './lib/http.mjs';
import { computePrice, isValidScreens, bookingIsOpen } from './lib/pricing.mjs';
import { countTakenScreens } from './lib/stock.mjs';
import { eventLabels } from '../shared/events.mjs';
import { copy } from '../shared/i18n.mjs';

export const makeHandler = (stripeFactory = getStripe, now = Date.now) => async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  const event = getEvent(body?.eventId);
  if (!event?.active) return json({ error: 'event_not_found' }, 404);
  if (!bookingIsOpen(event, now())) return json({ error: 'booking_closed' }, 409);
  const language = body?.language ?? 'fr';
  if (!catalog.platform.supportedLanguages.includes(language)) return json({ error: 'invalid_language' }, 400);
  const ui = copy(language);
  const screens = body?.screens;
  if (!isValidScreens(event, screens)) return json({ error: 'invalid_screens', max: event.maxScreensPerOrder }, 400);

  // Les lectures Stripe ne constituent PAS un verrou de stock. Blocage des clés réelles
  // jusqu’à l’ajout d’un inventaire transactionnel partagé (aucun bouton de contournement).
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_')) {
    return json({ error: 'production_inventory_not_ready' }, 503);
  }
  const taxRates = [process.env.STRIPE_TAX_RATE_TPS, process.env.STRIPE_TAX_RATE_TVQ];
  if (!taxRates.every((id) => typeof id === 'string' && id.startsWith('txr_')) || taxRates[0] === taxRates[1]) return json({ error: 'tax_rates_not_configured' }, 503);

  let session;
  let stripe;
  try {
    stripe = stripeFactory();
    const takenBefore = await countTakenScreens(stripe, event, now());
    if (takenBefore + screens > TOTAL_SCREENS) return json({ error: 'not_enough_stock', remaining: Math.max(0, TOTAL_SCREENS - takenBefore) }, 409);
    const price = computePrice(event, screens, now());
    const displayEvent = { ...event, name: event.translations?.[language]?.name || event.name };
    const labels = eventLabels(displayEvent, catalog.platform, language);
    const page = `${siteUrl(req)}/evenement.html?event=${encodeURIComponent(event.id)}`;
    const metadata = {
      inventory_pool: INVENTORY_POOL, event: event.id, event_name: labels.fullName,
      screens: String(screens), phase: price.phase, language,
      rental_start: event.dates.rentalStartsAt, rental_end: event.dates.rentalEndsAt,
    };
    session = await stripe.checkout.sessions.create({
      mode: 'payment', locale: ui.stripeLocale, // Moyens de paiement configurés dans Stripe Dashboard.
      line_items: [{
        quantity: screens >= 3 ? screens : 1,
        tax_rates: taxRates,
        price_data: {
          currency: catalog.platform.currency,
          unit_amount: screens >= 3 ? price.unitCents : price.totalCents,
          product_data: {
            name: ui.orderTitle(labels.fullName, screens),
            description: ui.orderDescription(labels.period, price.phase === 'early'),
          },
        },
      }],
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      custom_fields: [
        { key: 'kiosque', label: { type: 'custom', custom: ui.boothField }, type: 'text' },
        { key: 'entreprise', label: { type: 'custom', custom: ui.companyField }, type: 'text' },
      ],
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
      metadata, payment_intent_data: { metadata },
      success_url: `${page}&merci=1&lang=${language}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${page}&lang=${language}#offres`,
    });

    // Contrôle supplémentaire utile en test, mais PAS une garantie anti-survente.
    const takenAfter = await countTakenScreens(stripe, event, now());
    if (takenAfter > TOTAL_SCREENS) {
      await stripe.checkout.sessions.expire(session.id);
      session = null;
      return json({ error: 'not_enough_stock', remaining: 0 }, 409);
    }
    return json({ url: session.url, sessionId: session.id, eventId: event.id, phase: price.phase, totalCents: price.totalCents });
  } catch (err) {
    if (session) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { console.error('Nettoyage session de test échoué'); }
    }
    console.error('create-checkout', err.message);
    return json({ error: 'checkout_failed' }, 503);
  }
};
export default makeHandler();
export const config = { path: '/api/checkout' };
