import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,getEvent} from '../config/catalog.mjs';
import {computeOrder,montagePrice,lineTax} from '../shared/order.mjs';
import {makeHandler as checkoutHandler} from '../server/create-checkout.mjs';
import {makeHandler as quoteHandler} from '../server/quote.mjs';
process.env.STRIPE_TAX_RATE_TPS='txr_tps';process.env.STRIPE_TAX_RATE_TVQ='txr_tvq';process.env.SITE_URL='https://example.test';
const event=getEvent('chaucase-2027'),early=()=>Date.parse('2026-11-01T12:00:00-05:00');
const bodyRequest=(body)=>new Request('https://example.test/api/checkout',{method:'POST',body:JSON.stringify(body)});
function fakeStripe(){const sessions=[],created=[];return{created,taxRates:{retrieve:async id=>({active:true,inclusive:false,percentage:id==='txr_tps'?5:9.975})},checkout:{sessions:{list:()=> (async function*(){for(const s of sessions)yield s;})(),create:async data=>{created.push(data);sessions.push({status:'open',metadata:data.metadata});return{id:'cs_test_order',url:'https://checkout.stripe.com/test',amount_total:data.line_items.reduce((sum,line)=>{const cents=line.quantity*line.price_data.unit_amount;return sum+cents+lineTax(cents,5)+lineTax(cents,9.975);},0)};},expire:async()=>{}}}};}

test('montage : gratuit par défaut, supplément de 100 $ une seule fois dès 2 écrans',()=>{
 for(const n of [1,2,3,10]){
  assert.equal(montagePrice(catalog.platform,n,'none'),0);
  assert.equal(montagePrice(catalog.platform,n,'simple'),n===1?15000:25000);
  assert.equal(montagePrice(catalog.platform,n,'animated'),n===1?35000:45000);
 }
});
test('prix de la commande avant taxes et arrondis par ligne compatibles Stripe',()=>{
 const order=computeOrder(event,catalog.platform,2,'simple',early());
 assert.equal(order.rentalCents,109500);assert.equal(order.montageCents,25000);assert.equal(order.subtotalCents,134500);
 assert.equal(order.gstCents,6725);assert.equal(order.qstCents,13417);assert.equal(order.totalCents,154642);
 assert.equal(computeOrder(event,catalog.platform,1,'none',early()).totalCents,68870);
 assert.equal(computeOrder(event,catalog.platform,1,'simple',early()).totalCents,86116);
 assert.notEqual(lineTax(order.subtotalCents,9.975),order.qstCents); // ne pas arrondir le panier globalement
});
test('options invalides et montants incohérents refusés',()=>{
 for(const option of ['anime','SIMPLE','',null,0,true,{}])assert.throws(()=>computeOrder(event,catalog.platform,2,option,early()));
 assert.throws(()=>lineTax(-1,5));
});
test('une seule session avec une ligne écrans et une ligne service, sans consommer plus de stock',async()=>{
 const stripe=fakeStripe();const handler=checkoutHandler(()=>stripe,early);
 const response=await handler(bodyRequest({eventId:event.id,screens:2,montage:'simple',montageCents:1,totalCents:1,language:'en'}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.totalCents,154642);
 assert.equal(stripe.created.length,1);const payload=stripe.created[0];assert.equal(payload.line_items.length,2);
 assert.equal(payload.line_items[0].price_data.unit_amount,109500);assert.equal(payload.line_items[1].price_data.unit_amount,25000);
 assert.equal(payload.line_items[1].quantity,1);assert.equal(payload.line_items[1].price_data.product_data.name,'Basic design');
 assert.equal(payload.metadata.screens,'2');assert.equal(payload.metadata.montage,'simple');assert.equal(payload.metadata.montage_cents,'25000');
 assert.deepEqual(payload.line_items[0].tax_rates,payload.line_items[1].tax_rates);
});
test('un montant Stripe différent du récapitulatif empêche la redirection et expire la session',async()=>{
 const stripe=fakeStripe(),original=stripe.checkout.sessions.create;let expired=false;
 stripe.checkout.sessions.create=async data=>({...await original(data),amount_total:1});stripe.checkout.sessions.expire=async()=>{expired=true;};
 const response=await checkoutHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:2,montage:'simple'}));
 assert.equal(response.status,503);assert.equal(expired,true);
});
test('sans montage : aucune ligne payante supplémentaire',async()=>{
 const stripe=fakeStripe();await checkoutHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:1}));
 assert.equal(stripe.created[0].line_items.length,1);assert.equal(stripe.created[0].metadata.montage,'none');
});
test('quote : aucun blocage de stock ni création de session',async()=>{
 const stripe=fakeStripe();const response=await quoteHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:3,montage:'animated'}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.montageCents,45000);assert.equal(stripe.created.length,0);
});
test('total modifié entre le récapitulatif et le paiement : demander de confirmer à nouveau',async()=>{
 const stripe=fakeStripe();const response=await checkoutHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:2,montage:'simple',expectedTotalCents:1}));
 assert.equal(response.status,409);assert.equal((await response.json()).error,'quote_changed');assert.equal(stripe.created.length,0);
});
test('montage inconnu et total mal formé : aucun appel de création',async()=>{
 const stripe=fakeStripe(),h=checkoutHandler(()=>stripe,early);
 for(const montage of ['oops',null,{},1])assert.equal((await h(bodyRequest({eventId:event.id,screens:1,montage}))).status,400);
 assert.equal((await h(bodyRequest({eventId:event.id,screens:1,expectedTotalCents:'68870'}))).status,400);
 assert.equal(stripe.created.length,0);
});
test('taxes Stripe non exclusives ou mauvais pourcentage : pas de faux total affiché',async()=>{
 const old=[process.env.STRIPE_TAX_RATE_TPS,process.env.STRIPE_TAX_RATE_TVQ];
 process.env.STRIPE_TAX_RATE_TPS='txr_invalid_gst';process.env.STRIPE_TAX_RATE_TVQ='txr_invalid_qst';
 try{
  for(const patch of [{inclusive:true},{active:false},{percentage:7}]){
   const stripe=fakeStripe();stripe.taxRates.retrieve=async id=>({active:true,inclusive:false,percentage:id.endsWith('gst')?5:9.975,...patch});
   const response=await quoteHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:1,montage:'none'}));
   assert.equal(response.status,503);assert.equal((await response.json()).error,'tax_rates_not_configured');
  }
 }finally{[process.env.STRIPE_TAX_RATE_TPS,process.env.STRIPE_TAX_RATE_TVQ]=old;}
});
