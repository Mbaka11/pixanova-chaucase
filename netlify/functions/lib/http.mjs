import Stripe from 'stripe';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
  return new Stripe(key);
}

export function siteUrl(req) {
  return (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
}
