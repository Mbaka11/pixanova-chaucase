import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createInventoryDb, fingerprint, stripeEnvironment, supabaseEnabled } from '../server/lib/inventory-db.mjs';
import { createInventory, validRequestId, requestFingerprint, stripeCreationKey } from '../server/lib/inventory.mjs';
import { makeHandler as checkoutHandler } from '../server/create-checkout.mjs';
import { makeHandler as webhookHandler } from '../server/stripe-webhook.mjs';
import { getEvent } from '../server/lib/config.mjs';
import { belongsToPool } from '../server/lib/inventory-scope.mjs';

process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.STRIPE_TAX_RATE_TPS = 'txr_tps';
process.env.STRIPE_TAX_RATE_TVQ = 'txr_tvq';
process.env.SITE_URL = 'https://example.test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
const event = getEvent('chaucase-2027');
const now = () => Date.parse('2026-11-01T12:00:00-05:00');
const post = body => new Request('https://example.test/api/checkout', { method: 'POST', body: JSON.stringify(body) });
const body = () => ({ eventId: event.id, screens: 1, montage: 'none', language: 'fr', expectedTotalCents: 68870, requestId: randomUUID() });
function fixture(overrides = {}) {
  const requestId = randomUUID();
  const row = { id: randomUUID(), request_id: requestId, pool_id: 'pixanova-led', event_id: event.id,
    screens: 1, currency: 'cad', expected_total_cents: 68870, rental_start: event.dates.rentalStartsAt, rental_end: event.dates.rentalEndsAt,
    created_at: new Date().toISOString(), state: 'allocating',
    order_snapshot: { price: { totalCents: 68870 }, checkout: { expires_at: Math.floor(Date.now()/1000)+1800 } }, ...overrides };
  const session = { id: 'cs_test_inventory_example', livemode: false, currency: 'cad', amount_total: 68870,
    status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/test',
    metadata: { inventory_pool: row.pool_id, event: row.event_id, screens: '1', inventory_request_id: requestId,
      inventory_environment: 'test', rental_start: row.rental_start, rental_end: row.rental_end } };
  const transitions = [];
  const db = { transition: async p => { transitions.push(p); return { ...row, state: p.p_state }; } };
  return { row, session, transitions, db, inventory: createInventory({ db, environment: 'test' }) };
}

async function usingDb(fn) {
  process.env.INVENTORY_BACKEND = 'supabase';
  try { await fn(); } finally { delete process.env.INVENTORY_BACKEND; }
}

test('inventory : un événement connu ne traverse jamais un autre parc explicite', () => {
  assert.equal(belongsToPool({metadata:{event:event.id}}),true);
  assert.equal(belongsToPool({metadata:{event:event.id,inventory_pool:'another-pool'}}),false);
  assert.equal(belongsToPool({metadata:{event:'qa',inventory_pool:'isolated-qa'}},'isolated-qa'),true);
});
test('inventory : clés test/réel identifiées, aucune valeur inconnue acceptée', () => {
  assert.equal(stripeEnvironment('rk_test_x'), 'test'); assert.equal(stripeEnvironment('sk_live_x'), 'live');
  assert.throws(() => stripeEnvironment('unknown'));
  process.env.INVENTORY_BACKEND='typo'; assert.throws(() => supabaseEnabled()); delete process.env.INVENTORY_BACKEND;
  assert.equal(validRequestId(randomUUID()), true); assert.equal(validRequestId('not-uuid'), false);
});
test('inventory REST : clé secrète moderne uniquement dans apikey, URL stricte, erreurs expurgées', async () => {
  const calls=[];
  const db=createInventoryDb({url:'https://project.supabase.co',secret:'sb_secret_placeholder',fetcher:async(u,p)=>{calls.push({u,p});return new Response('{}');}});
  await db.reserve({example:1});
  assert.equal(calls[0].p.headers.apikey,'sb_secret_placeholder'); assert.equal(calls[0].p.headers.Authorization,undefined);
  for(const url of ['http://project.supabase.co','https://example.com','https://project.supabase.co/rest/v1','https://x:password@project.supabase.co'])assert.throws(()=>createInventoryDb({url,secret:'x'}));
  const bad=createInventoryDb({url:'https://project.supabase.co',secret:'x',fetcher:async()=>new Response('SECRET',{status:500})});
  await assert.rejects(bad.reserve({}),/^Error: inventory_http_500$/);
});
test('inventory REST : pagination au-delà de 1000 réservations', async () => {
  let calls=0;
  const db=createInventoryDb({url:'https://project.supabase.co',secret:'x',fetcher:async()=>new Response(JSON.stringify(Array.from({length:++calls<4?500:2},()=>({}))))});
  assert.equal((await db.rows('test','pixanova-led')).length,1502);assert.equal(calls,4);
});
test('inventory : empreinte stable, changements de choix ou de total refusables', () => {
  const b=body();assert.equal(requestFingerprint(b),requestFingerprint({...b,requestId:randomUUID()}));
  assert.notEqual(requestFingerprint(b),requestFingerprint({...b,montage:'simple'}));
  assert.notEqual(requestFingerprint(b),requestFingerprint({...b,expectedTotalCents:1}));
  assert.equal(fingerprint({a:1}).length,64);
});
test('inventory : timeout Stripe conservé, pas de libération spéculative', async () => {
  const f=fixture();
  const stripe={checkout:{sessions:{create:async()=>{throw new Error('timeout');}}}};
  await assert.rejects(f.inventory.reconcile(stripe,f.row)); assert.equal(f.transitions.length,0);
});
test('inventory : reprise de création avec les paramètres figés et la même clé Stripe', async () => {
  const f=fixture();let received;
  const stripe={checkout:{sessions:{create:async(p,o)=>{received={p,o};return f.session;}}}};
  const result=await f.inventory.reconcile(stripe,f.row);
  assert.deepEqual(received.p,f.row.order_snapshot.checkout);
  assert.equal(received.o.idempotencyKey,stripeCreationKey('test',f.row.request_id));assert.equal(result.row.state,'held');
});
test('inventory : création ambiguë ancienne jamais recréée après 23 heures', async () => {
  const f=fixture({created_at:new Date(Date.now()-24*3600000).toISOString()});
  await assert.rejects(f.inventory.reconcile({},f.row),/inventory_recovery_required/);assert.equal(f.transitions.length,0);
});
test('inventory : montant, environnement ou identité invalides restent en review', async () => {
  for(const change of [{amount_total:1},{livemode:true},{metadata:{}},{currency:'usd'}]){
    const f=fixture();await assert.rejects(f.inventory.reconcile({},f.row,{session:{...f.session,...change}}),/verification_failed/);
    assert.equal(f.transitions[0].p_state,'review');
  }
});
test('inventory : expiry horloge seule ne libère pas, expiration Stripe oui', async () => {
  const f=fixture({hold_until:'2000-01-01T00:00:00Z'});
  await f.inventory.reconcile({},f.row,{session:f.session});assert.equal(f.transitions.at(-1).p_state,'held');
  await f.inventory.reconcile({},f.row,{session:{...f.session,status:'expired'}});assert.equal(f.transitions.at(-1).p_reason,'session_expired');
});
test('inventory : payé et pending, remboursement partiel conserve, complet libère', async () => {
  const f=fixture();const paid={...f.session,status:'complete',payment_status:'paid',payment_intent:{id:'pi_test',latest_charge:{refunded:false}}};
  await f.inventory.reconcile({},f.row,{session:paid});assert.equal(f.transitions.at(-1).p_state,'paid');
  await f.inventory.reconcile({},f.row,{session:{...paid,payment_status:'unpaid'}});assert.equal(f.transitions.at(-1).p_state,'pending');
  await f.inventory.reconcile({},f.row,{session:{...paid,payment_intent:{id:'pi_test',latest_charge:{refunded:true}}}});assert.equal(f.transitions.at(-1).p_reason,'full_refund');
});
test('inventory : échec asynchrone nécessite une preuve actuelle, pas seulement un événement', async () => {
  const f=fixture();const unpaid={...f.session,status:'complete',payment_status:'unpaid',payment_intent:{status:'processing'}};
  await f.inventory.reconcile({},f.row,{session:unpaid,stripeEvent:{type:'checkout.session.async_payment_failed'}});assert.equal(f.transitions.at(-1).p_state,'pending');
  await f.inventory.reconcile({},f.row,{session:{...unpaid,payment_intent:{status:'requires_payment_method'}},stripeEvent:{type:'checkout.session.async_payment_failed'}});assert.equal(f.transitions.at(-1).p_reason,'payment_failed');
});
test('checkout durable : demande UUID obligatoire, aucune session créée sans stock', async () => usingDb(async()=>{
  const b=body();delete b.requestId;
  const handler=checkoutHandler(()=>({}),now,()=>({}));
  assert.equal((await handler(post(b))).status,400);
  const inventory={find:async()=>null,reserve:async()=>({ok:false,error:'not_enough_stock',remaining:0}),environment:'test'};
  const stripe={taxRates:{retrieve:async id=>({active:true,inclusive:false,percentage:id==='txr_tps'?5:9.975})}};
  const r=await checkoutHandler(()=>stripe,now,()=>inventory)(post(body()));assert.equal(r.status,409);assert.equal((await r.json()).remaining,0);
}));
test('checkout durable : retry retrouve le prix et la session originaux sans nouveau devis', async () => usingDb(async()=>{
  const b=body(),f=fixture();f.row.request_fingerprint=requestFingerprint(b);
  const inventory={find:async()=>f.row,reconcile:async()=>({row:{state:'held'},session:f.session})};
  const r=await checkoutHandler(()=>({}),now,()=>inventory)(post(b));assert.equal(r.status,200);assert.equal((await r.json()).sessionId,f.session.id);
  assert.equal((await checkoutHandler(()=>({}),now,()=>inventory)(post({...b,screens:2}))).status,409);
}));
test('checkout durable : réel refusé sans base LIVE prête même si Supabase est sélectionné', async () => usingDb(async()=>{
  process.env.STRIPE_SECRET_KEY='sk_live_placeholder';
  try{assert.equal((await checkoutHandler(()=>{throw Error('not called');},now)(post(body()))).status,503);}
  finally{process.env.STRIPE_SECRET_KEY='sk_test_placeholder';}
}));
test('checkout : mode maintenance avant tout appel Stripe ou inventaire', async () => {
  process.env.CHECKOUT_PAUSED='true';
  try{const r=await checkoutHandler(()=>{throw Error('not called');})(post({}));assert.equal((await r.json()).error,'checkout_paused');}
  finally{delete process.env.CHECKOUT_PAUSED;}
});
test('webhook durable : refuse un événement réel sur le serveur de test', async () => usingDb(async()=>{
  const stripe={webhooks:{constructEvent:()=>({livemode:true,type:'checkout.session.completed'})}};
  const r=await webhookHandler(()=>stripe,()=>{throw Error('not called');})(new Request('https://example.test',{method:'POST',body:'{}'}));assert.equal(r.status,400);
}));
test('webhook durable : récupère le snapshot Stripe actuel plutôt que croire un ancien événement', async () => usingDb(async()=>{
  const f=fixture();let received;
  const old={...f.session,status:'expired'};
  const stripe={webhooks:{constructEvent:()=>({id:'evt_test',livemode:false,type:'checkout.session.expired',data:{object:old}})},checkout:{sessions:{retrieve:async()=>f.session}}};
  const inventory={db:{bySession:async()=>f.row,request:async()=>null},reconcile:async(s,r,options)=>{received=options;return{row:f.row,session:f.session};},notify:async()=>{}};
  assert.equal((await webhookHandler(()=>stripe,()=>inventory)(new Request('https://example.test',{method:'POST',body:'{}'}))).status,200);
  assert.equal(received.session.status,'open');
}));
test('webhook durable : ligne introuvable => 500 pour réessai Stripe', async () => usingDb(async()=>{
  const f=fixture();const stripe={webhooks:{constructEvent:()=>({id:'evt_test',livemode:false,type:'checkout.session.completed',data:{object:f.session}})}};
  const inventory={db:{bySession:async()=>null},find:async()=>null};
  assert.equal((await webhookHandler(()=>stripe,()=>inventory)(new Request('https://example.test',{method:'POST',body:'{}'}))).status,500);
}));
function durableFixture({ failFirstAttach = false, environment = 'test', ready = true } = {}) {
  const rows = new Map(), sessions = new Map(); let attachCalls = 0;
  const db = {
    pool: async () => ({ ready, capacity: 20 }),
    find: async (environment,id) => rows.get(id) || null,
    reserve: async p => {
      let row=rows.get(p.p_request_id);
      if(row)return {ok:true,reused:true,reservation:row};
      row={id:randomUUID(),request_id:p.p_request_id,request_fingerprint:p.p_request_fingerprint,
        pool_id:p.p_pool_id,event_id:p.p_event_id,screens:p.p_screens,rental_start:p.p_rental_start,rental_end:p.p_rental_end,
        expected_total_cents:p.p_expected_total_cents,currency:p.p_currency,order_snapshot:p.p_order_snapshot,created_at:new Date().toISOString(),state:'allocating'};
      rows.set(row.request_id,row);return {ok:true,reused:false,reservation:row};
    },
    transition: async p => {
      if(failFirstAttach&&++attachCalls===1)throw Error('database timeout after Stripe.create');
      const row=rows.get(p.p_request_id);row.state=p.p_state;row.stripe_session_id=p.p_session_id;return {...row};
    },
  };
  const stripe={taxRates:{retrieve:async id=>({active:true,inclusive:false,percentage:id==='txr_tps'?5:9.975})},checkout:{sessions:{
    create:async(params,options)=>{
      if(!sessions.has(options.idempotencyKey))sessions.set(options.idempotencyKey,{
        id:`cs_${environment}_durable`,url:'https://checkout.stripe.com/test',livemode:environment==='live',currency:'cad',amount_total:68870,
        status:'open',payment_status:'unpaid',metadata:params.metadata,
      });
      return sessions.get(options.idempotencyKey);
    },retrieve:async()=>[...sessions.values()][0],
  }}};
  return {rows,sessions,handler:checkoutHandler(()=>stripe,now,()=>createInventory({db,environment}))};
}
test('checkout durable : deux submits concurrents partagent réservation et clé Stripe',async()=>usingDb(async()=>{
  const f=durableFixture(),b=body();
  const responses=await Promise.all([f.handler(post(b)),f.handler(post(b))]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(f.rows.size,1);assert.equal(f.sessions.size,1);
  assert.deepEqual((await responses[0].json()).totalCents,68870);
}));
test('checkout durable : crash après Stripe.create puis retry => une seule session',async()=>usingDb(async()=>{
  const f=durableFixture({failFirstAttach:true}),b=body();
  assert.equal((await f.handler(post(b))).status,503);assert.equal(f.rows.size,1);assert.equal(f.sessions.size,1);
  assert.equal((await f.handler(post(b))).status,200);assert.equal(f.sessions.size,1);
}));
test('checkout réel : parc LIVE prêt autorisé, sans chemin de stock Stripe historique',async()=>usingDb(async()=>{
  process.env.STRIPE_SECRET_KEY='sk_live_placeholder';
  try{
    const f=durableFixture({environment:'live'});const r=await f.handler(post(body()));
    assert.equal(r.status,200);assert.equal(f.sessions.size,1);
    assert.equal([...f.sessions.values()][0].metadata.inventory_environment,'live');
  }finally{process.env.STRIPE_SECRET_KEY='sk_test_placeholder';}
}));
test('checkout réel : parc non prêt ou environnement TEST => refus sans création Stripe',async()=>usingDb(async()=>{
  process.env.STRIPE_SECRET_KEY='sk_live_placeholder';
  try{
    for(const options of [{environment:'live',ready:false},{environment:'test',ready:true}]){
      const f=durableFixture(options);assert.equal((await f.handler(post(body()))).status,503);assert.equal(f.sessions.size,0);
    }
  }finally{process.env.STRIPE_SECRET_KEY='sk_test_placeholder';}
}));
test('outbox : une notification déjà envoyée ne repart pas', async()=>{
  const f=fixture();let calls=0;
  await f.inventory.notify({...f.row,state:'paid',notification_state:'sent'},f.session,async()=>{calls++;});assert.equal(calls,0);
});
