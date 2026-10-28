import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage, languageUrl, money, copy, staticEnglish } from '../shared/i18n.mjs';
import { eventLabels } from '../shared/events.mjs';
import { catalog, getEvent } from '../config/catalog.mjs';
import { makeHandler } from '../server/create-checkout.mjs';
const event=getEvent('chaucase-2027');
const now=()=>Date.parse('2026-11-01T12:00:00-05:00');
process.env.STRIPE_TAX_RATE_TPS='txr_tps';process.env.STRIPE_TAX_RATE_TVQ='txr_tvq';process.env.SITE_URL='https://example.test';

test('français par défaut et langue inconnue sans détection automatique',()=>{
 for(const value of [null,undefined,'de','EN','fr'])assert.equal(normalizeLanguage(value),'fr');
 assert.equal(normalizeLanguage('en'),'en');
});
test('changement de langue conserve événement, session, merci et ancre',()=>{
 const url=languageUrl('https://example.test/evenement.html?event=chaucase-2027&merci=1&session_id=cs_example#/merci','en');
 const parsed=new URL(url,'https://example.test');
 assert.equal(parsed.searchParams.get('event'),'chaucase-2027');assert.equal(parsed.searchParams.get('session_id'),'cs_example');assert.equal(parsed.searchParams.get('merci'),'1');assert.equal(parsed.hash,'#/merci');assert.equal(parsed.searchParams.get('lang'),'en');
 assert.equal(new URL(languageUrl(url,'fr'),'https://example.test').searchParams.has('lang'),false);
});
test('dates et échéances localisées sans changer les instants',()=>{
 const en=eventLabels(event,catalog.platform,'en'),fr=eventLabels(event,catalog.platform,'fr');
 assert.equal(en.earlyDeadline,'December 15');assert.equal(en.refundDeadlineFull,'January 15, 2027');
 assert.equal(fr.refundDeadlineFull,'15 janvier 2027');assert.equal(en.durationDays,fr.durationDays);
});
test('montants CAD localisés, aucune différence de prix',()=>{
 assert.equal(money(109500,'en'),'$1,095');assert.equal(money(109500,'fr'),'1 095 $');
 assert.equal(money(68870,'en',true),'$688.70');
});
test('dictionnaires dynamiques ont les mêmes clés; traduction de l’animation et du bouton fixe',()=>{
 assert.deepEqual(Object.keys(copy('fr')),Object.keys(copy('en')));
 assert.equal(copy('en').reserve(1),'Reserve 1 screen');assert.equal(copy('en').reserve(4),'Reserve 4 screens');
 assert.equal(staticEnglish['Votre marque'],'Your brand');assert.equal(staticEnglish['Réserver'],'Reserve');
});
test('Stripe : anglais, libellés et retours conservés; montant et dates identiques',async()=>{
 let payload;
 const stripe={taxRates:{retrieve:async id=>({active:true,inclusive:false,percentage:id==='txr_tps'?5:9.975})},checkout:{sessions:{list:()=> (async function*(){})(),create:async p=>{payload=p;return {id:'cs_example',url:'https://checkout.example.test',amount_total:125898};}}}};
 const request=(body)=>new Request('https://example.test/api/checkout',{method:'POST',body:JSON.stringify(body)});
 const handler=makeHandler(()=>stripe,now);
 const response=await handler(request({eventId:event.id,screens:2,language:'en'}));
 assert.equal(response.status,200);assert.equal(payload.locale,'en');assert.equal(payload.metadata.language,'en');
 assert.equal(payload.line_items[0].price_data.unit_amount,109500);assert.ok(payload.line_items[0].price_data.product_data.name.startsWith('LED screen'));
 assert.equal(payload.custom_fields[0].label.custom,'Booth number');assert.equal(payload.custom_fields[1].label.custom,'Company name');
 assert.equal(new URL(payload.success_url).searchParams.get('lang'),'en');assert.equal(new URL(payload.cancel_url).searchParams.get('lang'),'en');
 assert.equal(payload.metadata.rental_start,event.dates.rentalStartsAt);
 assert.equal((await handler(request({eventId:event.id,screens:2,language:'de'}))).status,400);
});
