import test from 'node:test';
import assert from 'node:assert/strict';
process.env.STRIPE_TAX_RATE_TPS = 'txr_tps';
process.env.STRIPE_TAX_RATE_TVQ = 'txr_tvq';
process.env.SITE_URL = 'https://exemple.test';
const { countTakenScreens } = await import('../netlify/functions/lib/stock.mjs');
const { makeHandler } = await import('../netlify/functions/create-checkout.mjs');

const sess = (screens, o = {}) => ({
  metadata: { event: 'chaucase-2027', screens: String(screens) },
  status: 'complete', payment_status: 'paid', payment_intent: { latest_charge: { refunded: false } }, ...o,
});

function fakeStripe(sessions) {
  const created = [], expired = [];
  return {
    created, expired,
    checkout: { sessions: {
      list: () => (async function* () { for (const s of sessions) yield s; })(),
      create: async (p) => { created.push(p); sessions.push({ id: 'cs_new', status: 'open', payment_status: 'unpaid', metadata: p.metadata }); return { id: 'cs_new', url: 'https://checkout.test/cs_new' }; },
      expire: async (id) => { expired.push(id); },
    } },
  };
}

test('stock : paiements et blocages comptés, remboursés/expirés/autres ignorés', async () => {
  const stripe = fakeStripe([
    sess(2),
    sess(3, { status: 'open', payment_status: 'unpaid', payment_intent: null }),
    sess(4, { status: 'expired', payment_status: 'unpaid' }),
    sess(5, { payment_intent: { latest_charge: { refunded: true } } }),
    { ...sess(6), metadata: { event: 'autre', screens: '6' } },
  ]);
  assert.equal(await countTakenScreens(stripe), 5);
});

const post = (body) => new Request('https://exemple.test/api/checkout', { method: 'POST', body: JSON.stringify(body) });

test('checkout : prix calculé côté serveur, taxes et champs requis', async () => {
  const stripe = fakeStripe([]);
  const res = await makeHandler(() => stripe)(post({ screens: 2, price: 1 }));
  assert.equal(res.status, 200);
  const p = stripe.created[0];
  assert.equal(p.line_items[0].tax_rates.length, 2);
  assert.equal(p.line_items[0].quantity * p.line_items[0].price_data.unit_amount % 1, 0);
  assert.ok([109500, 139500].includes(p.line_items[0].price_data.unit_amount)); // ignore le "price" envoyé
  assert.equal(p.custom_fields.length, 2);
  assert.equal(p.metadata.screens, '2');
  assert.ok(p.expires_at > Date.now() / 1000);
});

test('checkout : 4 écrans = quantité × tarif par écran', async () => {
  const stripe = fakeStripe([]);
  await makeHandler(() => stripe)(post({ screens: 4 }));
  const li = stripe.created[0].line_items[0];
  assert.equal(li.quantity, 4);
  assert.ok([53000, 65000].includes(li.price_data.unit_amount));
});

test('checkout : refusé quand il ne reste pas assez d\'écrans (jamais plus de 20)', async () => {
  const stripe = fakeStripe([sess(19)]);
  const res = await makeHandler(() => stripe)(post({ screens: 2 }));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).remaining, 1);
  assert.equal(stripe.created.length, 0);
});

test('checkout : le dernier écran est accepté', async () => {
  const stripe = fakeStripe([sess(19)]);
  assert.equal((await makeHandler(() => stripe)(post({ screens: 1 }))).status, 200);
});

test('checkout : achat simultané détecté, session expirée', async () => {
  const sessions = [sess(18)];
  const stripe = fakeStripe(sessions);
  const orig = stripe.checkout.sessions.create;
  stripe.checkout.sessions.create = async (p) => { // un autre client réserve 2 écrans entre-temps
    sessions.push({ id: 'cs_rival', status: 'open', payment_status: 'unpaid', metadata: { event: 'chaucase-2027', screens: '2' } });
    return orig(p);
  };
  const res = await makeHandler(() => stripe)(post({ screens: 1 }));
  assert.equal(res.status, 409);
  assert.deepEqual(stripe.expired, ['cs_new']);
});

test('checkout : entrées invalides', async () => {
  const stripe = fakeStripe([]);
  const h = makeHandler(() => stripe);
  for (const screens of [0, 11, 2.5, 'abc']) assert.equal((await h(post({ screens }))).status, 400);
  assert.equal((await h(new Request('https://exemple.test/api/checkout'))).status, 405);
  assert.equal(stripe.created.length, 0);
});
