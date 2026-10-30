import { createHash } from 'node:crypto';

export function stripeEnvironment(key = process.env.STRIPE_SECRET_KEY) {
  if (/^(sk|rk)_test_/.test(key || '')) return 'test';
  if (/^(sk|rk)_live_/.test(key || '')) return 'live';
  throw new Error('stripe_environment_unknown');
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function supabaseEnabled() {
  const backend = process.env.INVENTORY_BACKEND || 'stripe';
  if (!['stripe', 'supabase'].includes(backend)) throw new Error('inventory_backend_invalid');
  return backend === 'supabase';
}

// Appels REST serveur uniquement ; aucune dépendance navigateur ni clé publique.
export function createInventoryDb({ url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY, fetcher = fetch, timeout = 15000 } = {}) {
  if (!url || !secret) throw new Error('inventory_not_configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('inventory_url_invalid');
  }
  const headers = { apikey: secret, 'Content-Type': 'application/json' };
  if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
  async function request(path, { method = 'GET', body, prefer } = {}) {
    const response = await fetcher(`${parsed.origin}/rest/v1/${path}`, {
      method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error(`inventory_http_${response.status}`); // Jamais de corps d'erreur contenant des données.
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    request,
    rpc: (name, body) => request(`rpc/${name}`, { method: 'POST', body }),
    reserve: body => request('rpc/events_reserve_inventory', { method: 'POST', body }),
    transition: body => request('rpc/events_apply_inventory_state', { method: 'POST', body }),
    async find(environment, requestId) {
      const rows = await request(`events_reservations?environment=eq.${encodeURIComponent(environment)}&request_id=eq.${encodeURIComponent(requestId)}&select=*`);
      return rows[0] || null;
    },
    async bySession(environment, sessionId) {
      const rows = await request(`events_reservations?environment=eq.${encodeURIComponent(environment)}&stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`);
      return rows[0] || null;
    },
    async pool(environment, poolId) {
      const rows = await request(`events_inventory_pools?environment=eq.${encodeURIComponent(environment)}&pool_id=eq.${encodeURIComponent(poolId)}&select=*`);
      if (rows.length !== 1) throw new Error('inventory_pool_missing');
      return rows[0];
    },
    async rows(environment, poolId) {
      // PostgREST est paginé par défaut : ne jamais considérer seulement les 1000 premières lignes.
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const page = await request(`events_reservations?environment=eq.${encodeURIComponent(environment)}&pool_id=eq.${encodeURIComponent(poolId)}&state=neq.released&order=id&limit=500&offset=${offset}`);
        rows.push(...page);
        if (page.length < 500) return rows;
      }
    },
  };
}
