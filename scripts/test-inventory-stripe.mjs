import Stripe from 'stripe';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { localConfig } from './lib/local-config.mjs';
import { createInventoryDb, stripeEnvironment } from '../server/lib/inventory-db.mjs';
import { createInventory } from '../server/lib/inventory.mjs';
import { makeHandler as webhookHandler } from '../server/stripe-webhook.mjs';

// QA technique : Stripe TEST + parc DB isolé, jamais le parc pixanova-led.
// --prepare crée un Checkout fictif à 1,15 CAD ; le paiement se fait au navigateur.
// --verify contrôle le paiement, rembourse partiellement puis intégralement.
// --cleanup ne touche qu'aux sessions portant le marqueur de CE parc QA.
const env = localConfig();
assert.equal(stripeEnvironment(env.STRIPE_SECRET_KEY), 'test');
process.env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
process.env.INVENTORY_BACKEND = 'supabase';
process.env.STRIPE_WEBHOOK_SECRET = `whsec_qa_${randomUUID()}`;
delete process.env.RESEND_API_KEY; // Ne pas envoyer de vrais courriels de QA.
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
const db = createInventoryDb({ url: env.SUPABASE_URL, secret: env.SUPABASE_SECRET_KEY });
const file = new URL('../temp/stripe-qa-inventory-e2e.json', import.meta.url);
const command = process.argv[2];
let state;
async function save() { await mkdir(new URL('../temp/', import.meta.url), { recursive: true }); await writeFile(file, JSON.stringify(state, null, 2)); }
async function send(inventory, type, object, id = `evt_qa_${randomUUID().replaceAll('-','')}`) {
  const payload = JSON.stringify({ id, object:'event', livemode:false, type, data:{object} });
  const req = new Request('https://example.test/api/stripe-webhook', { method:'POST', body:payload,
    headers:{'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET})} });
  const response = await webhookHandler(()=>stripe,()=>inventory)(req);
  assert.equal(response.status,200,`webhook ${type}`);
}
try {
  if (command === '--prepare') {
    try { const prior=JSON.parse(await readFile(file,'utf8')); if (!prior.cleaned) throw Error('QA précédente à nettoyer'); }
    catch(e) { if(e.code!=='ENOENT')throw e; }
    state={pool:`qa-e2e-${randomUUID()}`,started:Math.floor(Date.now()/1000),requests:[]};await save();
    await db.request('events_inventory_pools',{method:'POST',body:{environment:'test',pool_id:state.pool,capacity:20,ready:true}});
    const inventory=createInventory({db,environment:'test',poolId:state.pool});
    async function reserve() {
      const id=randomUUID();state.requests.push(id);await save();
      const metadata={inventory_pool:state.pool,inventory_environment:'test',inventory_request_id:id,event:'qa-e2e',event_name:'QA technique',screens:'1',rental_start:'2099-01-01T00:00:00Z',rental_end:'2099-01-03T00:00:00Z'};
      const params={mode:'payment',locale:'en',customer_email:'qa-pixanova@example.com',name_collection:{individual:{enabled:true,optional:false}},billing_address_collection:'required',
        line_items:[{quantity:1,tax_rates:[env.STRIPE_TAX_RATE_TPS,env.STRIPE_TAX_RATE_TVQ],price_data:{currency:'cad',unit_amount:100,product_data:{name:'Pixanova — essai technique TEST'}}}],
        expires_at:Math.floor(Date.now()/1000)+1860,metadata,payment_intent_data:{metadata},success_url:'https://events.pixanova.ca/?qa_inventory=1',cancel_url:'https://events.pixanova.ca/?qa_inventory=cancel'};
      const result=await inventory.reserve({eventId:'qa-e2e',screens:1,requestId:id,expectedTotalCents:115},
        {id:'qa-e2e',dates:{rentalStartsAt:metadata.rental_start,rentalEndsAt:metadata.rental_end}},{totalCents:115},params);
      assert.equal(result.ok,true);return result.reservation;
    }
    const first=await reserve();let failed=false;
    const failing=createInventory({db:{...db,transition:async()=>{throw Error('QA simulated DB timeout');}},environment:'test',poolId:state.pool});
    try {await failing.reconcile(stripe,first);}catch{failed=true;}
    assert.equal(failed,true);
    const recovered=await inventory.reconcile(stripe,first);
    const again=await inventory.reconcile(stripe,await inventory.find(first.request_id));
    assert.equal(recovered.session.id,again.session.id);
    const own=[];for await(const s of stripe.checkout.sessions.list({limit:100,created:{gte:state.started-60}}))if(s.metadata?.inventory_request_id===first.request_id)own.push(s);
    assert.equal(own.length,1);
    const expired=await stripe.checkout.sessions.expire(recovered.session.id);
    await send(inventory,'checkout.session.expired',expired);
    assert.equal((await inventory.find(first.request_id)).state,'released');
    const second=await reserve();const checkout=await inventory.reconcile(stripe,second);
    state.paymentRequest=second.request_id;state.paymentSession=checkout.session.id;state.url=checkout.session.url;await save();
    console.log('PASS Stripe réel en mode TEST : crash après création, reprise avec une seule session, expiration et libération DB.');
    console.log('Checkout fictif prêt (1,15 CAD test) ; URL et identifiants conservés uniquement dans temp/stripe-qa-inventory-e2e.json.');
  } else {
    state=JSON.parse(await readFile(file,'utf8'));
    assert.match(state.pool,/^qa-e2e-[0-9a-f-]{36}$/);
    const inventory=createInventory({db,environment:'test',poolId:state.pool});
    if(command==='--verify') {
      const session=await stripe.checkout.sessions.retrieve(state.paymentSession,{expand:['payment_intent.latest_charge']});
      assert.equal(session.livemode,false);assert.equal(session.payment_status,'paid');assert.equal(session.amount_total,115);assert.equal(session.metadata.inventory_pool,state.pool);
      const eventId=`evt_qa_${randomUUID().replaceAll('-','')}`;
      await send(inventory,'checkout.session.completed',session,eventId);
      await send(inventory,'checkout.session.completed',session,eventId);
      assert.equal((await inventory.find(state.paymentRequest)).state,'paid');
      await send(inventory,'checkout.session.expired',{...session,status:'expired',payment_status:'unpaid'});
      assert.equal((await inventory.find(state.paymentRequest)).state,'paid');
      const intent=session.payment_intent;
      await stripe.refunds.create({payment_intent:intent.id,amount:1,metadata:{test_run:state.pool}},{idempotencyKey:`${state.pool}:partial`});
      await send(inventory,'charge.refunded',await stripe.charges.retrieve(intent.latest_charge.id));
      assert.equal((await inventory.find(state.paymentRequest)).state,'paid');
      await stripe.refunds.create({payment_intent:intent.id,metadata:{test_run:state.pool}},{idempotencyKey:`${state.pool}:remaining`});
      await send(inventory,'charge.refunded',await stripe.charges.retrieve(intent.latest_charge.id));
      assert.equal((await inventory.find(state.paymentRequest)).state,'released');
      await send(inventory,'checkout.session.completed',session);
      assert.equal((await inventory.find(state.paymentRequest)).state,'released');
      console.log('PASS Stripe TEST + Supabase + webhooks signés : paiement, doublons, snapshot ancien, remboursement partiel conservé, remboursement complet libéré.');
      state.verified=true;await save();
    } else if(command==='--cleanup') {
      for await(const session of stripe.checkout.sessions.list({limit:100,created:{gte:state.started-60}})) {
        if(session.metadata?.inventory_pool!==state.pool)continue;
        assert.equal(session.livemode,false);
        if(session.status==='open')await stripe.checkout.sessions.expire(session.id);
        else if(session.payment_status==='paid'){
          const current=await stripe.checkout.sessions.retrieve(session.id,{expand:['payment_intent.latest_charge']});
          if(!current.payment_intent.latest_charge.refunded)await stripe.refunds.create({payment_intent:current.payment_intent.id,metadata:{test_run:state.pool}},{idempotencyKey:`${state.pool}:cleanup:${session.id}`});
        }
      }
      // Supprimer uniquement la boîte de réception de ces événements QA.
      const rows=await db.request(`events_reservations?pool_id=eq.${state.pool}&select=stripe_session_id`);
      for(const row of rows)if(row.stripe_session_id)await db.request(`events_webhook_receipts?environment=eq.test&object_id=eq.${encodeURIComponent(row.stripe_session_id)}`,{method:'DELETE'});
      await db.request(`events_reservations?pool_id=eq.${state.pool}`,{method:'DELETE'});
      await db.request(`events_inventory_pools?pool_id=eq.${state.pool}`,{method:'DELETE'});
      state.cleaned=true;await save();console.log('QA nettoyée : seules nos sessions test expirées/remboursées et notre parc temporaire supprimé.');
    } else throw Error('Commande attendue : --prepare, --verify ou --cleanup');
  }
} catch {
  console.error('QA interrompue : aucun secret affiché. Reprendre ou exécuter --cleanup ; ne pas modifier les réservations existantes.');
  process.exitCode=1;
}
