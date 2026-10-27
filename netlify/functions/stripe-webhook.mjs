import { EVENT_ID } from './lib/config.mjs';
import { getStripe, json } from './lib/http.mjs';

/** Avertit l'équipe par courriel (Resend) si configuré, sinon écrit dans les journaux. */
async function notifyTeam(session) {
  const fields = Object.fromEntries(
    (session.custom_fields || []).map((c) => [c.key, c.text?.value]),
  );
  const text = [
    'Nouvelle réservation ChauCase 2027',
    `Écrans : ${session.metadata.screens}`,
    `Total payé : ${(session.amount_total / 100).toFixed(2)} $ CAD (taxes incluses)`,
    `Entreprise : ${fields.entreprise || '—'}`,
    `Kiosque : ${fields.kiosque || '—'} (à vérifier)`,
    `Courriel : ${session.customer_details?.email || '—'}`,
    `Téléphone : ${session.customer_details?.phone || '—'}`,
    `Session Stripe : ${session.id}`,
  ].join('\n');

  const { RESEND_API_KEY, NOTIFY_TO, NOTIFY_FROM } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_TO || !NOTIFY_FROM) {
    console.log(text);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: NOTIFY_TO.split(','),
      subject: `Réservation ChauCase : ${session.metadata.screens} écran(s)`,
      text,
    }),
  });
  if (!res.ok) console.error('notification échouée', res.status, await res.text());
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'webhook_not_configured' }, 500);

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      await req.text(),
      req.headers.get('stripe-signature'),
      secret,
    );
  } catch (err) {
    console.error('signature invalide', err.message);
    return json({ error: 'invalid_signature' }, 400);
  }

  if (
    event.type === 'checkout.session.completed' &&
    event.data.object.metadata?.event === EVENT_ID
  ) {
    try {
      await notifyTeam(event.data.object);
    } catch (err) {
      console.error('notification', err);
    }
  }
  return json({ received: true });
};

export const config = { path: '/api/stripe-webhook' };
