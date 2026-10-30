import Stripe from 'stripe';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function getStripe(options = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
  return new Stripe(key, { timeout: 10000, maxNetworkRetries: 1, ...options });
}

export function siteUrl(req) {
  const url = new URL(process.env.SITE_URL || req.url);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('SITE_URL invalide');
  if (url.username || url.password) throw new Error('SITE_URL invalide');
  return url.origin;
}
