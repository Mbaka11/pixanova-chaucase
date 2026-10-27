import { EARLY_DEADLINE, MAX_PER_ORDER, PRICES } from './config.mjs';

export function currentPhase(now = Date.now()) {
  return now > Date.parse(EARLY_DEADLINE) ? 'regular' : 'early';
}

export function isValidScreens(n) {
  return Number.isInteger(n) && n >= 1 && n <= MAX_PER_ORDER;
}

/** Prix d'une commande de `screens` écrans, avant taxes. */
export function computePrice(screens, now = Date.now()) {
  if (!isValidScreens(screens)) throw new RangeError('Nombre d\'écrans invalide');
  const phase = currentPhase(now);
  const table = PRICES[phase];
  const totalCents = screens <= 2 ? table[screens] : screens * table.perScreen;
  return { phase, screens, totalCents, unitCents: totalCents / screens };
}
