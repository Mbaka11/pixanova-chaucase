import { readFileSync } from 'node:fs';
import { localConfig } from './local-config.mjs';

// Commandes opérateur uniquement. Ne change jamais le mode test du .env local.
export function liveConfig() {
  const source = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*#\s*(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_TAX_RATE_TPS|STRIPE_TAX_RATE_TVQ)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!value || /REMPLACER|COLLER|placeholder/.test(value)) continue;
    if (values[match[1]] && values[match[1]] !== value) throw new Error('live_configuration_ambiguous');
    values[match[1]] = value;
  }
  if (!/^(sk|rk)_live_[A-Za-z0-9_]+$/.test(values.STRIPE_SECRET_KEY || '')
    || !/^whsec_[A-Za-z0-9_]+$/.test(values.STRIPE_WEBHOOK_SECRET || '')
    || !/^txr_[A-Za-z0-9]+$/.test(values.STRIPE_TAX_RATE_TPS || '')
    || !/^txr_[A-Za-z0-9]+$/.test(values.STRIPE_TAX_RATE_TVQ || '')) throw new Error('live_configuration_incomplete');
  const local = localConfig();
  return { ...local, ...values, SITE_URL: 'https://events.pixanova.ca' };
}
