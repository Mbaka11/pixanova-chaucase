import { createInventory } from './lib/inventory.mjs';
import { createInventoryDb, supabaseEnabled, stripeEnvironment } from './lib/inventory-db.mjs';
import { getStripe } from './lib/http.mjs';
import { INVENTORY_POOL } from './lib/config.mjs';
import { notifyTeam } from './lib/notifications.mjs';

// Fonction planifiée, non exposée par une route HTTP publique en production.
// Lot borné ; les erreurs conservent le stock et tournent en fin de file.
export default async () => {
  if (!supabaseEnabled()) return;
  const environment = stripeEnvironment();
  const db = createInventoryDb({ timeout: 2000 });
  const inventory = createInventory({ db, environment });
  const pool = await db.pool(environment, INVENTORY_POOL);
  if (!pool.ready) return;
  const [holds, paid] = await Promise.all([
    db.request(`events_reservations?environment=eq.${environment}&pool_id=eq.${INVENTORY_POOL}&state=in.(allocating,held,pending,review)&order=updated_at,id&limit=10`),
    db.request(`events_reservations?environment=eq.${environment}&pool_id=eq.${INVENTORY_POOL}&state=eq.paid&order=updated_at,id&limit=2`),
  ]);
  const rows = [...holds, ...paid];
  const stripe = getStripe({ timeout: 3000, maxNetworkRetries: 0 });
  await Promise.all(rows.map(async row => {
    try {
      const current = await inventory.reconcile(stripe, row);
      await inventory.notify(current.row, current.session, notifyTeam);
    } catch {
      // Jamais de changement d'état automatique sur erreur réseau / état inconnu.
      console.error('inventory_reconciliation_required', { reservationId: row.id });
      await db.request(`events_reservations?id=eq.${row.id}&environment=eq.${environment}`, {
        method: 'PATCH', body: { updated_at: new Date().toISOString() },
      });
    }
  }));
};
export const config = { schedule: '*/5 * * * *' };
