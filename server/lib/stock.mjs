import { getEvent, INVENTORY_POOL, TOTAL_SCREENS } from './config.mjs';

/**
 * Pic d’utilisation dans [début, fin[. Les locations ne se chevauchant pas
 * réutilisent les mêmes écrans. À une frontière commune, les retours précèdent
 * les départs (dates à configurer avec les marges de transport appropriées).
 */
export function peakUsageForPeriod(period, reservations) {
  const start = Date.parse(period.rentalStartsAt), end = Date.parse(period.rentalEndsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Période cible invalide');
  const changes = new Map();
  for (const reservation of reservations) {
    const from = Date.parse(reservation.rentalStartsAt), until = Date.parse(reservation.rentalEndsAt);
    const n = reservation.screens;
    if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until || !Number.isInteger(n) || n < 1 || n > TOTAL_SCREENS) throw new Error('Réservation de stock invalide');
    if (from >= end || until <= start) continue;
    const left = Math.max(start, from), right = Math.min(end, until);
    changes.set(left, (changes.get(left) || 0) + n);
    changes.set(right, (changes.get(right) || 0) - n);
  }
  let usage = 0, peak = 0;
  for (const [, delta] of [...changes].sort(([a], [b]) => a - b)) {
    usage += delta; peak = Math.max(peak, usage);
  }
  return peak;
}

export async function countTakenScreens(stripe, event, now = Date.now()) {
  const reservations = [];
  const list = stripe.checkout.sessions.list({ limit: 100, expand: ['data.payment_intent.latest_charge'] });
  for await (const session of list) {
    const metadata = session.metadata || {};
    const legacyEvent = getEvent(metadata.event);
    if (metadata.inventory_pool !== INVENTORY_POOL && !legacyEvent) continue;
    const holding = session.status === 'open' && (!session.expires_at || session.expires_at * 1000 > now);
    const complete = session.status === 'complete';
    if (!holding && !complete) continue;
    // Un remboursement partiel conserve toute la quantité, seul le remboursement intégral libère.
    if (complete && session.payment_intent?.latest_charge?.refunded) continue;
    const hasSnapshot = metadata.rental_start !== undefined || metadata.rental_end !== undefined;
    const dates = hasSnapshot
      ? { rentalStartsAt: metadata.rental_start, rentalEndsAt: metadata.rental_end }
      : legacyEvent?.dates;
    if (!dates) throw new Error('Période de réservation inconnue : vérification manuelle requise');
    reservations.push({ screens: Number(metadata.screens), rentalStartsAt: dates.rentalStartsAt, rentalEndsAt: dates.rentalEndsAt });
  }
  return peakUsageForPeriod(event.dates, reservations);
}

export async function getStock(stripe, event, now) {
  const taken = await countTakenScreens(stripe, event, now);
  return {
    eventId: event.id, total: TOTAL_SCREENS, taken, remaining: Math.max(0, TOTAL_SCREENS - taken),
    rentalStartsAt: event.dates.rentalStartsAt, rentalEndsAt: event.dates.rentalEndsAt,
  };
}

// ATTENTION : ces lectures Stripe donnent une disponibilité, pas une réservation atomique.
// Un verrou transactionnel partagé est requis avant d’activer les ventes réelles.
