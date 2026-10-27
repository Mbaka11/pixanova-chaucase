import { EVENT_ID, HOLD_MINUTES, MAX_PER_ORDER, TOTAL_SCREENS } from './lib/config.mjs';
import { getStripe, json, siteUrl } from './lib/http.mjs';
import { computePrice, isValidScreens } from './lib/pricing.mjs';
import { countTakenScreens } from './lib/stock.mjs';

export const makeHandler = (stripeFactory = getStripe) => async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let screens;
  try { ({ screens } = await req.json()); } catch { return json({ error: 'invalid_body' }, 400); }
  screens = Number(screens);
  if (!isValidScreens(screens)) return json({ error: 'invalid_screens', max: MAX_PER_ORDER }, 400);

  const taxRates = [process.env.STRIPE_TAX_RATE_TPS, process.env.STRIPE_TAX_RATE_TVQ].filter(Boolean);
  if (taxRates.length !== 2) return json({ error: 'tax_rates_not_configured' }, 500);

  try {
    const stripe = stripeFactory();

    // 1. Il doit rester assez d'écrans.
    const takenBefore = await countTakenScreens(stripe);
    if (takenBefore + screens > TOTAL_SCREENS) {
      return json({ error: 'not_enough_stock', remaining: Math.max(0, TOTAL_SCREENS - takenBefore) }, 409);
    }

    // 2. Le prix est calculé ici, jamais par le navigateur.
    const price = computePrice(screens);
    const base = siteUrl(req);
    const label = price.phase === 'early' ? 'prix early bird' : 'prix régulier';
    const lineItem = screens >= 3
      ? { quantity: screens, unit: price.unitCents, name: 'Écran LED ChauCase 2027' }
      : { quantity: 1, unit: price.totalCents, name: `Écran LED ChauCase 2027 (${screens} écran${screens > 1 ? 's' : ''})` };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr-CA',
      line_items: [{
        quantity: lineItem.quantity,
        tax_rates: taxRates,
        price_data: {
          currency: 'cad',
          unit_amount: lineItem.unit,
          product_data: {
            name: lineItem.name,
            description: `Location pour les 3 jours du salon, ${label}. Livraison, installation et désinstallation incluses.`,
          },
        },
      }],
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      custom_fields: [
        { key: 'kiosque', label: { type: 'custom', custom: 'Numéro de kiosque ChauCase' }, type: 'text' },
        { key: 'entreprise', label: { type: 'custom', custom: "Nom de l'entreprise" }, type: 'text' },
      ],
      expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
      metadata: { event: EVENT_ID, screens: String(screens), phase: price.phase },
      payment_intent_data: { metadata: { event: EVENT_ID, screens: String(screens) } },
      success_url: `${base}/?merci=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/#offres`,
    });

    // 3. Deuxième vérification : deux achats simultanés ne doivent pas dépasser le total.
    const takenAfter = await countTakenScreens(stripe);
    if (takenAfter > TOTAL_SCREENS) {
      await stripe.checkout.sessions.expire(session.id);
      return json({ error: 'not_enough_stock', remaining: Math.max(0, TOTAL_SCREENS - (takenAfter - screens)) }, 409);
    }

    return json({ url: session.url, sessionId: session.id, phase: price.phase, totalCents: price.totalCents });
  } catch (err) {
    console.error('create-checkout', err);
    return json({ error: 'checkout_failed' }, 500);
  }
};

export default makeHandler();

export const config = { path: '/api/checkout' };
