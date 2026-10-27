import { EVENT_ID, TOTAL_SCREENS } from './config.mjs';

/**
 * Compte les écrans pris dans Stripe : paiements réussis + sessions encore ouvertes
 * (écrans bloqués pendant le paiement). Les paiements remboursés sont libérés.
 */
export async function countTakenScreens(stripe) {
  let taken = 0;
  const list = stripe.checkout.sessions.list({
    limit: 100,
    expand: ['data.payment_intent.latest_charge'],
  });
  for await (const s of list) {
    if (s.metadata?.event !== EVENT_ID) continue;
    const screens = Number(s.metadata.screens) || 0;
    const paid = s.status === 'complete' && s.payment_status === 'paid';
    const holding = s.status === 'open';
    if (!paid && !holding) continue; // expirée ou impayée
    if (paid && s.payment_intent?.latest_charge?.refunded) continue; // remboursée
    taken += screens;
  }
  return taken;
}

export async function getStock(stripe) {
  const taken = await countTakenScreens(stripe);
  return { total: TOTAL_SCREENS, taken, remaining: Math.max(0, TOTAL_SCREENS - taken) };
}
