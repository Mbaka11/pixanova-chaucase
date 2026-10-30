import { getEvent, catalog, INVENTORY_POOL, HOLD_MINUTES, TOTAL_SCREENS } from './lib/config.mjs';
import { getStripe, json, siteUrl } from './lib/http.mjs';
import { isValidScreens, bookingIsOpen } from './lib/pricing.mjs';
import { computeOrder, isValidMontage } from '../shared/order.mjs';
import { getTaxRateIds } from './lib/taxes.mjs';
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
  const montage = body?.montage === undefined ? 'none' : body.montage;
  if (!isValidMontage(montage)) return json({ error: 'invalid_montage' }, 400);
  if (body.expectedTotalCents !== undefined && (!Number.isSafeInteger(body.expectedTotalCents) || body.expectedTotalCents < 0)) return json({ error: 'invalid_total' }, 400);

  // Les lectures Stripe ne constituent PAS un verrou de stock. Blocage des clés réelles
  // jusqu’à l’ajout d’un inventaire transactionnel partagé (aucun bouton de contournement).
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_')) {
    return json({ error: 'production_inventory_not_ready' }, 503);
  }

  let session;
  let stripe;
  try {
    stripe = stripeFactory();
    const taxRates = await getTaxRateIds(stripe);
    const takenBefore = await countTakenScreens(stripe, event, now());
    if (takenBefore + screens > TOTAL_SCREENS) return json({ error: 'not_enough_stock', remaining: Math.max(0, TOTAL_SCREENS - takenBefore) }, 409);
    const price = computeOrder(event, catalog.platform, screens, montage, now());
    if (body.expectedTotalCents !== undefined && body.expectedTotalCents !== price.totalCents) return json({ error: 'quote_changed', ...price }, 409);
    const displayEvent = { ...event, name: event.translations?.[language]?.name || event.name };
    const labels = eventLabels(displayEvent, catalog.platform, language);
    const origin = siteUrl(req);
    const page = `${origin}/evenement.html?event=${encodeURIComponent(event.id)}`;
    const checkoutLogo = event.checkoutLogo || catalog.platform.brand.checkoutLogo;
    const branding = {
      display_name: `${catalog.platform.brand.checkoutName || catalog.platform.name} × ${labels.fullName}`,
      button_color: '#2563eb', border_style: 'rounded',
      // Stripe doit pouvoir charger le logo : pas d’URL localhost inaccessible.
      ...(checkoutLogo && origin.startsWith('https:') ? {logo:{type:'url',url:new URL(checkoutLogo,origin).href}} : {}),
    };
    const metadata = {
      inventory_pool: INVENTORY_POOL, event: event.id, event_name: labels.fullName,
      screens: String(screens), phase: price.phase, language,
      montage, montage_cents: String(price.montageCents), rental_cents: String(price.rentalCents), montage_hours: String(price.montageHours),
      gst_tax_rate: taxRates[0], qst_tax_rate: taxRates[1], logistics_included: 'true',
      rental_start: event.dates.rentalStartsAt, rental_end: event.dates.rentalEndsAt,
    };
    session = await stripe.checkout.sessions.create({
      mode: 'payment', locale: ui.stripeLocale, // Moyens de paiement configurés dans Stripe Dashboard.
      branding_settings: branding,
      name_collection: { individual: { enabled: true, optional: false } },
      line_items: [{
        quantity: screens >= 3 ? screens : 1,
        tax_rates: taxRates,
        price_data: {
          currency: catalog.platform.currency,
          unit_amount: screens >= 3 ? price.rentalUnitCents : price.rentalCents,
          product_data: {
            name: ui.orderTitle(labels.fullName, screens),
            description: ui.orderDescription(labels.period, price.phase === 'early'),
          },
        },
      }, ...(price.montageCents ? [{
        quantity: 1,
        tax_rates: taxRates,
        price_data: {
          currency: catalog.platform.currency,
          unit_amount: price.montageCents,
          product_data: { name: ui.montageLabel(montage), description: ui.montageDescription(montage, price.montageHours) },
        },
      }] : []), {
        quantity: 1,
        price_data: { currency: catalog.platform.currency, unit_amount: 0,
          product_data: { name: ui.logisticsOrderTitle, description: ui.logisticsOrderDescription(labels.fullName) } },
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

    // Ne jamais rediriger vers un montant Stripe différent du récapitulatif accepté.
    if (session.amount_total !== price.totalCents) throw new Error('checkout_total_mismatch');

    // Contrôle supplémentaire utile en test, mais PAS une garantie anti-survente.
    const takenAfter = await countTakenScreens(stripe, event, now());
    if (takenAfter > TOTAL_SCREENS) {
      await stripe.checkout.sessions.expire(session.id);
      session = null;
      return json({ error: 'not_enough_stock', remaining: 0 }, 409);
    }
    return json({ url: session.url, sessionId: session.id, ...price });
  } catch (err) {
    if (session) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { console.error('Nettoyage session de test échoué'); }
    }
    console.error('create-checkout', err.message);
    return json({ error: err.message === 'tax_rates_not_configured' ? err.message : 'checkout_failed' }, 503);
  }
};
export default makeHandler();
export const config = { path: '/api/checkout' };
