import Stripe from 'stripe';
import { localConfig } from './lib/local-config.mjs';
import { liveConfig } from './lib/live-config.mjs';
import { createInventoryDb, stripeEnvironment } from '../server/lib/inventory-db.mjs';
import { createInventory } from '../server/lib/inventory.mjs';
import { INVENTORY_POOL } from '../server/lib/config.mjs';
import { notifyTeam } from '../server/lib/notifications.mjs';

const environment = process.argv.includes('--live') ? 'live' : 'test';
const env = environment === 'live' ? liveConfig() : localConfig();
try {
  if (stripeEnvironment(env.STRIPE_SECRET_KEY) !== environment) throw new Error('key_environment_mismatch');
  const db = createInventoryDb({ url: env.SUPABASE_URL, secret: env.SUPABASE_SECRET_KEY });
  if (!(await db.pool(environment, INVENTORY_POOL)).ready) throw new Error('inventory_not_initialized');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
  const inventory = createInventory({ db, environment });
  const rows = await db.rows(environment, INVENTORY_POOL);
  // Rechercher les sessions détachées, y compris au-delà de 24 h. Cette recherche
  // ne crée jamais une nouvelle session et ne libère pas une demande sans preuve.
  const detached = rows.filter(r => !r.stripe_session_id);
  const found = new Map();
  if (detached.length) {
    const ids = new Set(detached.map(r => r.request_id));
    for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
      const id = session.metadata?.inventory_request_id;
      if (!ids.has(id) || session.metadata?.inventory_environment !== environment) continue;
      if (found.has(id)) throw new Error('duplicate_session_for_request');
      found.set(id, session.id);
    }
  }
  for (const key of ['RESEND_API_KEY','NOTIFY_FROM','NOTIFY_TO']) if (env[key]) process.env[key] = env[key];
  let ok = 0, review = 0;
  for (const row of rows) {
    try {
      const sessionId = found.get(row.request_id);
      const session = sessionId ? await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge'] }) : undefined;
      const current = await inventory.reconcile(stripe, row, { session });
      await inventory.notify(current.row, current.session, notifyTeam);
      ok++;
    } catch { review++; console.error('Vérification opérateur requise pour la réservation :', row.id); }
  }
  console.log(`Réconciliation ${environment === 'live' ? 'RÉELLE' : 'TEST'} : ${ok} vérifiées, ${review} à examiner. Aucun remboursement ni expiration forcée.`);
  if (review) process.exitCode = 1;
} catch {
  console.error('Réconciliation arrêtée : vérifier configuration et migration ; aucun secret affiché.');
  process.exitCode = 1;
}
