import { getEvent } from './config.mjs';
import { copy } from '../../shared/i18n.mjs';

/** Avertit l'équipe par courriel (Resend) si configuré, sinon écrit dans les journaux. */
export async function notifyTeam(session) {
  const label = session.metadata.event_name || getEvent(session.metadata.event)?.name || session.metadata.event;
  const fields = Object.fromEntries(
    (session.custom_fields || []).map((c) => [c.key, c.text?.value]),
  );
  const text = [
    `Nouvelle réservation ${label}`,
    `Écrans : ${session.metadata.screens}`,
    `Montage : ${copy('fr').montageLabel(session.metadata.montage || 'none')}`,
    `Total payé : ${(session.amount_total / 100).toFixed(2)} $ CAD (taxes incluses)`,
    `Contact : ${session.collected_information?.individual_name || session.customer_details?.individual_name || session.customer_details?.name || '—'}`,
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
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: NOTIFY_TO.split(','),
      subject: `Réservation ${label} : ${session.metadata.screens} écran(s)`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Notification échouée : ${res.status}`);
}
