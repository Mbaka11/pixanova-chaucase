import { catalog } from './config.mjs';
let cached;

export async function getTaxRateIds(stripe) {
  const ids = [process.env.STRIPE_TAX_RATE_TPS, process.env.STRIPE_TAX_RATE_TVQ];
  if (!ids.every(id => typeof id === 'string' && id.startsWith('txr_')) || ids[0] === ids[1]) throw new Error('tax_rates_not_configured');
  const expected = [catalog.platform.taxes.gstPercent, catalog.platform.taxes.qstPercent];
  const key = JSON.stringify([ids, expected]);
  if (cached?.key === key && cached.expiresAt > Date.now()) return ids;
  const rates = await Promise.all(ids.map(id => stripe.taxRates.retrieve(id)));
  if (rates.some((rate, index) => !rate.active || rate.inclusive || Number(rate.percentage) !== expected[index])) throw new Error('tax_rates_not_configured');
  cached = { key, expiresAt: Date.now() + 60000 };
  return ids;
}
