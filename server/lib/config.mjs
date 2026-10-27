// Le même catalogue public alimente le serveur et le site. Aucun secret ici.
import { catalog, getEvent } from '../../config/catalog.mjs';
export { catalog, getEvent };
export const INVENTORY_POOL = 'pixanova-led';
export const TOTAL_SCREENS = catalog.platform.inventory.totalScreens;
export const HOLD_MINUTES = catalog.platform.inventory.holdMinutes;
