import test from 'node:test';
import assert from 'node:assert/strict';
import { getEvent } from '../config/catalog.mjs';
import { countTakenScreens, getStock, peakUsageForPeriod } from '../server/lib/stock.mjs';
import { makeHandler } from '../server/create-checkout.mjs';
import stockHandler from '../server/get-stock.mjs';
process.env.STRIPE_TAX_RATE_TPS = 'txr_tps';
process.env.STRIPE_TAX_RATE_TVQ = 'txr_tvq';
process.env.SITE_URL = 'https://exemple.test';
const event = getEvent('chaucase-2027');
const now = () => Date.parse('2026-11-01T12:00:00-05:00');
const sess = (screens, overrides = {}) => ({
  metadata: { event: event.id, screens: String(screens) },
  status: 'complete', payment_status: 'paid', payment_intent: { latest_charge: { refunded: false } }, ...overrides,
});
function fakeStripe(sessions) {
  const created = [], expired = [];
  return { created, expired, checkout: { sessions: {
    list: () => (async function* () { for (const s of sessions) yield s; })(),
    create: async (p) => { created.push(p); sessions.push({ id: 'cs_new', status: 'open', payment_status: 'unpaid', metadata: p.metadata }); return { id: 'cs_new', url: 'https://checkout.test/cs_new' }; },
    expire: async (id) => { expired.push(id); },
  } } };
}
const post = (body) => new Request('https://exemple.test/api/checkout', { method: 'POST', body: JSON.stringify(body) });
const reservation = (from, until, screens) => ({ rentalStartsAt: `2027-02-0${from}T00:00:00-05:00`, rentalEndsAt: `2027-02-0${until}T00:00:00-05:00`, screens });

test('pic de stock : ne pas additionner les périodes disjointes', () => {
  assert.equal(peakUsageForPeriod(event.dates, [reservation(1,2,12), reservation(2,4,9)]), 12);
});
test('pic de stock : additionner les événements simultanés', () => {
  assert.equal(peakUsageForPeriod(event.dates, [reservation(1,3,12), reservation(2,4,7)]), 19);
});
test('stock : périodes hors salon et frontières adjacentes exclues', () => {
  assert.equal(peakUsageForPeriod(event.dates, [reservation(5,6,20)]), 0);
});
test('stock : bloquer sur période ou quantité corrompue', () => {
  assert.throws(() => peakUsageForPeriod(event.dates, [{...reservation(1,4,2), screens: -1}]));
  assert.throws(() => peakUsageForPeriod(event.dates, [{...reservation(1,4,2), rentalStartsAt: 'inconnu'}]));
});
test('stock : paiements et blocages comptés; expirés et remboursés libérés', async () => {
  const stripe = fakeStripe([
    sess(2), sess(3, { status: 'open', payment_status: 'unpaid', payment_intent: null }),
    sess(4, { status: 'expired', payment_status: 'unpaid' }),
    sess(5, { payment_intent: { latest_charge: { refunded: true } } }),
    sess(1, { status: 'open', expires_at: now()/1000 - 1 }),
    { ...sess(6), metadata: { event: 'autre-produit', screens: '6' } },
  ]);
  assert.equal(await countTakenScreens(stripe, event, now()), 5);
});
test('stock global : une réservation d’un autre événement bloque les mêmes dates', async () => {
  const metadata = { inventory_pool:'pixanova-led', event:'autre-salon', screens:'8', rental_start:event.dates.rentalStartsAt, rental_end:event.dates.rentalEndsAt };
  const stripe = fakeStripe([sess(3),sess(8,{metadata})]);
  assert.equal((await getStock(stripe,event,now())).remaining, 9);
});
test('stock global : autre mois disponible et dates figées même si événement retiré', async () => {
  const metadata = { inventory_pool:'pixanova-led', event:'ancien-salon', screens:'20', rental_start:'2027-03-01T00:00:00-05:00', rental_end:'2027-03-05T00:00:00-05:00' };
  assert.equal(await countTakenScreens(fakeStripe([sess(20,{metadata})]),event,now()),0);
});
test('stock : événement inconnu sans période refuse une disponibilité incertaine', async () => {
  await assert.rejects(() => countTakenScreens(fakeStripe([sess(2,{metadata:{inventory_pool:'pixanova-led', event:'retire',screens:'2'}})]),event,now()));
});
test('checkout : prix serveur, événement et dates figés, taxes et retour contextualisé', async () => {
  const stripe = fakeStripe([]);
  const response = await makeHandler(()=>stripe,now)(post({eventId:event.id,screens:2,price:1}));
  assert.equal(response.status,200);
  const p=stripe.created[0];
  assert.equal(p.line_items[0].price_data.unit_amount,109500);
  assert.equal(p.line_items[0].tax_rates.length,2);
  assert.equal(p.metadata.event,event.id);
  assert.equal(p.metadata.rental_start,event.dates.rentalStartsAt);
  assert.equal(p.metadata.rental_end,event.dates.rentalEndsAt);
  assert.equal(p.metadata.inventory_pool,'pixanova-led');
  assert.ok(p.success_url.includes('event=chaucase-2027&merci=1'));
  assert.ok(p.cancel_url.includes('event=chaucase-2027#offres'));
  assert.equal(p.payment_method_types,undefined); // API Stripe actuelle : réglage au Dashboard.
});
test('checkout : prix de 4 écrans et fermeture selon les dates', async () => {
  const stripe=fakeStripe([]);
  assert.equal((await makeHandler(()=>stripe,now)(post({eventId:event.id,screens:4}))).status,200);
  assert.equal(stripe.created[0].line_items[0].quantity,4);
  assert.equal(stripe.created[0].line_items[0].price_data.unit_amount,53000);
  const closed=makeHandler(()=>stripe,()=>Date.parse(event.dates.rentalStartsAt));
  assert.equal((await closed(post({eventId:event.id,screens:1}))).status,409);
});
test('checkout : rejet si stock insuffisant, dernier écran accepté', async () => {
  const stripe=fakeStripe([sess(19)]),handler=makeHandler(()=>stripe,now);
  const response=await handler(post({eventId:event.id,screens:2}));
  assert.equal(response.status,409);assert.equal((await response.json()).remaining,1);
  assert.equal(stripe.created.length,0);
  assert.equal((await handler(post({eventId:event.id,screens:1}))).status,200);
});
test('checkout : dépassement observé après création => expiration (contrôle non atomique)', async () => {
  const sessions=[sess(18)],stripe=fakeStripe(sessions),create=stripe.checkout.sessions.create;
  stripe.checkout.sessions.create=async(p)=>{sessions.push(sess(2));return create(p);};
  assert.equal((await makeHandler(()=>stripe,now)(post({eventId:event.id,screens:1}))).status,409);
  assert.deepEqual(stripe.expired,['cs_new']);
});
test('checkout : nettoyage de session en cas d’échec de seconde lecture', async () => {
  const stripe=fakeStripe([]),list=stripe.checkout.sessions.list;let calls=0;
  stripe.checkout.sessions.list=(...args)=>{if(++calls===2)throw new Error('Test échec lecture');return list(...args);};
  assert.equal((await makeHandler(()=>stripe,now)(post({eventId:event.id,screens:1}))).status,503);
  assert.deepEqual(stripe.expired,['cs_new']);
});
test('checkout : validation stricte et événement obligatoire', async () => {
  const stripe=fakeStripe([]),handler=makeHandler(()=>stripe,now);
  for(const screens of [0,11,1.5,'2',true,[]])assert.equal((await handler(post({eventId:event.id,screens}))).status,400);
  assert.equal((await handler(post({screens:1}))).status,404);
  assert.equal((await handler(post({eventId:'inconnu',screens:1}))).status,404);
  assert.equal((await handler(new Request('https://exemple.test/api/checkout'))).status,405);
  assert.equal(stripe.created.length,0);
});
test('checkout : clé réelle bloquée tant que le stock n’est pas transactionnel', async () => {
  const previous=process.env.STRIPE_SECRET_KEY;process.env.STRIPE_SECRET_KEY='sk_live_test_placeholder';
  try{assert.equal((await makeHandler(()=>fakeStripe([]),now)(post({eventId:event.id,screens:1}))).status,503);}
  finally{if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;}
});
test('stock API : événement obligatoire, inconnu refusé', async () => {
  assert.equal((await stockHandler(new Request('https://exemple.test/api/stock'))).status,404);
  assert.equal((await stockHandler(new Request('https://exemple.test/api/stock?event=inconnu'))).status,404);
});
