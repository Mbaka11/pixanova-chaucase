import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../server/reservation.mjs';
const request=(extra='')=>new Request('https://example.test/api/reservation?event=chaucase-2027&session_id=cs_test_example123'+extra);
const session={metadata:{event:'chaucase-2027',inventory_pool:'pixanova-led',screens:'2'},status:'complete',payment_status:'paid',currency:'cad',amount_subtotal:109500,amount_total:125898,total_details:{amount_tax:16398},payment_intent:{latest_charge:{refunded:false}},customer_details:{email:'private@example.com',phone:'5551234567',address:{line1:'private'}}};
const handler=(s)=>makeHandler(()=>({checkout:{sessions:{retrieve:async()=>s}}}));
test('confirmation vérifiée et récapitulatif sans donnée personnelle',async()=>{
 const response=await handler(session)(request());assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.status,'paid');assert.equal(body.totalCents,125898);assert.equal(body.screens,2);
 assert.equal(JSON.stringify(body).includes('private'),false);assert.equal(JSON.stringify(body).includes('5551234567'),false);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('le montage et son prix payé sont conservés sans recalcul au tarif courant',async()=>{
 const response=await handler({...session,metadata:{...session.metadata,montage:'simple',montage_cents:'25000'},amount_subtotal:134500,amount_total:154642})(request());
 const body=await response.json();assert.equal(body.montage,'simple');assert.equal(body.montageCents,25000);assert.equal(body.totalCents,154642);
});
test('métadonnées de montage incohérentes refusées',async()=>{
 for(const extra of [{montage:'oops'},{montage:'none',montage_cents:'1'},{montage:'simple',montage_cents:'-1'},{montage:'simple',montage_cents:'0'}])assert.equal((await handler({...session,metadata:{...session.metadata,...extra}})(request())).status,404);
});
test('mauvais événement, autre parc ou métadonnées corrompues refusés',async()=>{
 for(const metadata of [{...session.metadata,event:'autre'},{...session.metadata,inventory_pool:'autre'},{...session.metadata,screens:'-1'}])assert.equal((await handler({...session,metadata})(request())).status,404);
});
test('impayé, expiré et remboursé ne deviennent pas des paiements confirmés',async()=>{
 assert.equal((await(await handler({...session,status:'open',payment_status:'unpaid'})(request())).json()).status,'pending');
 assert.equal((await(await handler({...session,status:'expired',payment_status:'unpaid'})(request())).json()).status,'expired');
 assert.equal((await(await handler({...session,payment_intent:{latest_charge:{refunded:true}}})(request())).json()).status,'refunded');
});
test('session absente ou invalide refusée avant appel Stripe',async()=>{
 const h=makeHandler(()=>{throw new Error('Ne doit pas être appelé');});
 assert.equal((await h(new Request('https://example.test/api/reservation?event=chaucase-2027'))).status,404);
 assert.equal((await h(new Request('https://example.test/api/reservation?event=inconnu&session_id=cs_test_example123'))).status,404);
 assert.equal((await h(new Request('https://example.test/api/reservation',{method:'POST'}))).status,405);
});
