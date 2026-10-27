// Règles d'affaires de la réservation. Seul endroit où les prix sont définis côté serveur.
export const EVENT_ID = 'chaucase-2027';
export const TOTAL_SCREENS = Number(process.env.TOTAL_SCREENS) || 20;
export const MAX_PER_ORDER = 10;
export const HOLD_MINUTES = 30; // durée pendant laquelle les écrans sont bloqués pendant le paiement

// Fin du prix early bird : 15 décembre 2026, 23 h 59, heure de Montréal (EST, UTC-5).
export const EARLY_DEADLINE = '2026-12-15T23:59:00-05:00';

// Prix avant taxes, en cents CAD.
export const PRICES = {
  early: { 1: 59900, 2: 109500, perScreen: 53000 }, // 3 écrans et plus : quantité × perScreen
  regular: { 1: 79500, 2: 139500, perScreen: 65000 },
};
