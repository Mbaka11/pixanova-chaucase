import { computePrice, isValidScreens } from './events.mjs';
import { montagePrice, isValidMontage } from './montage.mjs';
export { montagePrice, isValidMontage, montageChoices } from './montage.mjs';

// Stripe arrondit chaque taxe de chaque ligne au cent. Ne pas taxer le grand sous-total
// en une seule fois : cela peut produire une différence d’un cent avec deux lignes.
export function lineTax(cents, percent) {
  const milliPercent = Math.round(percent * 1000);
  const product = cents * milliPercent;
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(product)) throw new RangeError('Montant invalide');
  return Math.floor((product + 50000) / 100000);
}

export function computeOrder(event, platform, screens, montage = 'none', now = Date.now()) {
  if (!isValidScreens(event, screens) || !isValidMontage(montage)) throw new RangeError('Commande invalide');
  const rental = computePrice(event, screens, now);
  const montageCents = montagePrice(platform, screens, montage);
  const lines = [rental.totalCents, ...(montageCents ? [montageCents] : [])];
  const gstCents = lines.reduce((sum, value) => sum + lineTax(value, platform.taxes.gstPercent), 0);
  const qstCents = lines.reduce((sum, value) => sum + lineTax(value, platform.taxes.qstPercent), 0);
  const subtotalCents = rental.totalCents + montageCents;
  return {
    eventId: event.id, screens, phase: rental.phase, montage,
    rentalCents: rental.totalCents, rentalUnitCents: rental.unitCents, montageCents,
    subtotalCents, gstCents, qstCents, taxCents: gstCents + qstCents,
    totalCents: subtotalCents + gstCents + qstCents, currency: platform.currency,
  };
}
