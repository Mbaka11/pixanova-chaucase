import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import handler from '../server/stripe-webhook.mjs';
process.env.STRIPE_SECRET_KEY='sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET='whsec_placeholder';
process.env.RESEND_API_KEY='test_placeholder';
process.env.NOTIFY_FROM='test@example.com';
process.env.NOTIFY_TO='team@example.com';
const event=(type='checkout.session.completed',payment='paid')=>({id:'evt_example',type,data:{object:{id:'cs_example',metadata:{inventory_pool:'pixanova-led',event:'salon-test',event_name:'Salon Test 2028',screens:'2'},payment_status:payment,amount_total:125898,custom_fields:[],customer_details:{}}}});
function request(value){const payload=JSON.stringify(value);return new Request('https://example.com/api/stripe-webhook',{method:'POST',body:payload,headers:{'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET})}});}

test('webhook : signature obligatoire',async()=>{
 const response=await handler(new Request('https://example.com/api/stripe-webhook',{method:'POST',body:'{}'}));
 assert.equal(response.status,400);
});
test('webhook : notification liée au salon et clé de déduplication par session',async()=>{
 const fetchOriginal=globalThis.fetch;const sent=[];
 globalThis.fetch=async(url,options)=>{sent.push(options);return new Response('{}',{status:200});};
 try{
  assert.equal((await handler(request(event()))).status,200);
  const options=sent[0];assert.equal(options.headers['Idempotency-Key'],'reservation-cs_example');
  assert.ok(JSON.parse(options.body).subject.includes('Salon Test 2028'));
 }finally{globalThis.fetch=fetchOriginal;}
});
test('webhook : paiement différé confirmé pris en compte; impayé non confirmé',async()=>{
 const fetchOriginal=globalThis.fetch;let sent=0;
 globalThis.fetch=async()=>{sent++;return new Response('{}',{status:200});};
 try{
  assert.equal((await handler(request(event('checkout.session.completed','unpaid')))).status,200);
  assert.equal(sent,0);
  assert.equal((await handler(request(event('checkout.session.async_payment_succeeded')))).status,200);
  assert.equal(sent,1);
 }finally{globalThis.fetch=fetchOriginal;}
});
test('webhook : échec d’envoi renvoie 500 pour permettre une nouvelle tentative Stripe',async()=>{
 const fetchOriginal=globalThis.fetch;
 globalThis.fetch=async()=>new Response('{}',{status:503});
 try{assert.equal((await handler(request(event()))).status,500);}finally{globalThis.fetch=fetchOriginal;}
});
