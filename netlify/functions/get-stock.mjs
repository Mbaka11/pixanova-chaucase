import { getStripe, json } from './lib/http.mjs';
import { getStock } from './lib/stock.mjs';

export default async () => {
  try {
    const stock = await getStock(getStripe());
    return json(stock, 200, { 'Cache-Control': 'public, max-age=10' });
  } catch (err) {
    console.error('get-stock', err);
    return json({ error: 'stock_unavailable' }, 500);
  }
};

export const config = { path: '/api/stock' };
