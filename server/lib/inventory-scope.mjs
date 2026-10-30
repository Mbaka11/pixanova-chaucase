import { getEvent, INVENTORY_POOL } from './config.mjs';

// Le fallback historique ne s'applique qu'en l'absence de parc explicite.
// Un événement connu ne doit pas permettre de traverser un autre parc.
export function belongsToPool(session, poolId = INVENTORY_POOL) {
  const metadata = session.metadata || {};
  return metadata.inventory_pool ? metadata.inventory_pool === poolId : Boolean(getEvent(metadata.event));
}
