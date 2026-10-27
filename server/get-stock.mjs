import { getStripe, json } from './lib/http.mjs';
import { getEvent } from './lib/config.mjs';
import { getStock } from './lib/stock.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const event = getEvent(new URL(req.url).searchParams.get('event'));
  if (!event?.active) return json({ error: 'event_not_found' }, 404);
  try {
    return json(await getStock(getStripe(), event));
  } catch (err) {
    console.error('get-stock', err.message);
    return json({ error: 'stock_unavailable' }, 503);
  }
};
export const config = { path: '/api/stock' };
