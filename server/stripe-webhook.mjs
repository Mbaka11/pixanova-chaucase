import { getEvent, INVENTORY_POOL } from './lib/config.mjs';
import { getStripe, json } from './lib/http.mjs';

/** Avertit l'équipe par courriel (Resend) si configuré, sinon écrit dans les journaux. */
async function notifyTeam(session) {
  const label = session.metadata.event_name || getEvent(session.metadata.event)?.name || session.metadata.event;
  const fields = Object.fromEntries(
    (session.custom_fields || []).map((c) => [c.key, c.text?.value]),
  );
  const text = [
    `Nouvelle réservation ${label}`,
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
    console.log('Réservation test reçue; notifications non configurées', { event: session.metadata.event, screens: session.metadata.screens });
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `reservation-${session.id}`,
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: NOTIFY_TO.split(','),
      subject: `Réservation ${label} : ${session.metadata.screens} écran(s)`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Notification échouée : ${res.status}`);
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
    ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) &&
    event.data.object.payment_status === 'paid' &&
    (event.data.object.metadata?.inventory_pool === INVENTORY_POOL || getEvent(event.data.object.metadata?.event))
  ) {
    try {
      await notifyTeam(event.data.object);
    } catch (err) {
      console.error('notification', err.message);
      return json({ error: 'notification_failed' }, 500);
    }
  }
  return json({ received: true });
};

export const config = { path: '/api/stripe-webhook' };
