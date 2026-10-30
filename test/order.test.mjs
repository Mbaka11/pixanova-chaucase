import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,getEvent} from '../config/catalog.mjs';
import {computeOrder,montagePrice,montageHours,lineTax} from '../shared/order.mjs';
import {makeHandler as checkoutHandler} from '../server/create-checkout.mjs';
import {makeHandler as quoteHandler} from '../server/quote.mjs';
process.env.STRIPE_TAX_RATE_TPS='txr_tps';process.env.STRIPE_TAX_RATE_TVQ='txr_tvq';process.env.SITE_URL='https://example.test';
const event=getEvent('chaucase-2027'),early=()=>Date.parse('2026-11-01T12:00:00-05:00');
const bodyRequest=(body)=>new Request('https://example.test/api/checkout',{method:'POST',body:JSON.stringify(body)});
function fakeStripe(){const sessions=[],created=[];return{created,taxRates:{retrieve:async id=>({active:true,inclusive:false,percentage:id==='txr_tps'?5:9.975})},checkout:{sessions:{list:()=> (async function*(){for(const s of sessions)yield s;})(),create:async data=>{created.push(data);sessions.push({status:'open',metadata:data.metadata});return{id:'cs_test_order',url:'https://checkout.stripe.com/test',amount_total:data.line_items.reduce((sum,line)=>{const cents=line.quantity*line.price_data.unit_amount;return sum+cents+lineTax(cents,5)+lineTax(cents,9.975);},0)};},expire:async()=>{}}}};}

test('création : forfaits fixes 200 $ / 400 $, sans supplément de 1 à 10 écrans',()=>{
 for(const n of [1,2,3,10]){
  assert.equal(montagePrice(catalog.platform,n,'none'),0);
  assert.equal(montagePrice(catalog.platform,n,'simple'),20000);
  assert.equal(montagePrice(catalog.platform,n,'animated'),40000);
 }
 assert.equal(montageHours(catalog.platform,'none'),0);
 assert.equal(montageHours(catalog.platform,'simple'),4);
 assert.equal(montageHours(catalog.platform,'animated'),10);
});
test('prix actuels et arrondis par ligne compatibles avec les anciens montants aussi',()=>{
 const order=computeOrder(event,catalog.platform,2,'simple',early());
 assert.equal(order.rentalCents,109500);assert.equal(order.montageCents,20000);assert.equal(order.subtotalCents,129500);
 assert.equal(order.gstCents,6475);assert.equal(order.qstCents,12918);assert.equal(order.totalCents,148893);
 assert.equal(computeOrder(event,catalog.platform,1,'none',early()).totalCents,68870);
 assert.equal(computeOrder(event,catalog.platform,1,'simple',early()).totalCents,91865);
 assert.equal(computeOrder(event,catalog.platform,1,'animated',early()).totalCents,114860);
 assert.equal(lineTax(109500,9.975)+lineTax(25000,9.975),13417);
 assert.notEqual(lineTax(134500,9.975),13417); // ancien forfait : ne pas arrondir le panier globalement
});
test('options invalides et montants incohérents refusés',()=>{
 for(const option of ['anime','SIMPLE','',null,0,true,{}])assert.throws(()=>computeOrder(event,catalog.platform,2,option,early()));
 assert.throws(()=>lineTax(-1,5));
});
test('une seule session avec une ligne écrans et une ligne service, sans consommer plus de stock',async()=>{
 const stripe=fakeStripe();const handler=checkoutHandler(()=>stripe,early);
 const response=await handler(bodyRequest({eventId:event.id,screens:2,montage:'simple',montageCents:1,totalCents:1,language:'en'}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.totalCents,148893);
 assert.equal(stripe.created.length,1);const payload=stripe.created[0];assert.equal(payload.line_items.length,3);
 assert.equal(payload.line_items[0].price_data.unit_amount,109500);assert.equal(payload.line_items[1].price_data.unit_amount,20000);
 assert.equal(payload.line_items[1].quantity,1);assert.equal(payload.line_items[1].price_data.product_data.name,'Graphic design');
 assert.equal(payload.line_items[2].price_data.unit_amount,0);assert.match(payload.line_items[2].price_data.product_data.name,/included/);
 assert.equal(payload.metadata.screens,'2');assert.equal(payload.metadata.montage,'simple');assert.equal(payload.metadata.montage_cents,'20000');assert.equal(payload.metadata.montage_hours,'4');
 assert.equal(payload.metadata.logistics_included,'true');assert.deepEqual(payload.line_items[0].tax_rates,payload.line_items[1].tax_rates);
});
test('nom du contact natif, co-branding public et aucun logo localhost envoyé à Stripe',async()=>{
 const stripe=fakeStripe(),handler=checkoutHandler(()=>stripe,early);
 await handler(bodyRequest({eventId:event.id,screens:1}));const payload=stripe.created[0];
 assert.deepEqual(payload.name_collection,{individual:{enabled:true,optional:false}});
 assert.match(payload.branding_settings.display_name,/Pixanova × ChauCase/);
 assert.equal(payload.branding_settings.logo.url,'https://example.test'+event.checkoutLogo);
 const old=process.env.SITE_URL;
 try{process.env.SITE_URL='http://localhost:8888';await handler(bodyRequest({eventId:event.id,screens:1}));assert.equal(stripe.created[1].branding_settings.logo,undefined);}finally{process.env.SITE_URL=old;}
});
test('un montant Stripe différent du récapitulatif empêche la redirection et expire la session',async()=>{
 const stripe=fakeStripe(),original=stripe.checkout.sessions.create;let expired=false;
 stripe.checkout.sessions.create=async data=>({...await original(data),amount_total:1});stripe.checkout.sessions.expire=async()=>{expired=true;};
 const response=await checkoutHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:2,montage:'simple'}));
 assert.equal(response.status,503);assert.equal(expired,true);
});
test('sans montage : aucune ligne payante supplémentaire',async()=>{
 const stripe=fakeStripe();await checkoutHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:1}));
 assert.equal(stripe.created[0].line_items.length,2);assert.equal(stripe.created[0].line_items.filter(line=>line.price_data.unit_amount>0).length,1);assert.equal(stripe.created[0].metadata.montage,'none');
});
test('quote : aucun blocage de stock ni création de session',async()=>{
 const stripe=fakeStripe();const response=await quoteHandler(()=>stripe,early)(bodyRequest({eventId:event.id,screens:3,montage:'animated'}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.montageCents,40000);assert.equal(data.montageHours,10);assert.equal(stripe.created.length,0);
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
