import { currentPhase, bookingIsOpen } from './events-shared.js';
import { copy, money } from './i18n.mjs';
import { initTestimonials } from './testimonials.js';
import { verifyConfirmation } from './confirmation.js';
const { event: EVENT, platform: PLATFORM, labels: LABELS, language: LANGUAGE } = window.CONFIG;
const ui = copy(LANGUAGE);
const fm0 = c => money(c, LANGUAGE);
/* Prix en cents, avant taxes. 3 écrans et plus : quantité × tarif par écran (mêmes règles que le serveur). */
const P = {
  1:{early:EVENT.pricing.early.one,reg:EVENT.pricing.regular.one},
  2:{early:EVENT.pricing.early.two,reg:EVENT.pricing.regular.two},
};
const PER = {early:EVENT.pricing.early.perScreen, reg:EVENT.pricing.regular.perScreen};
const MAX_SCREENS = EVENT.maxScreensPerOrder;
const { valueCents: SCREEN_VALUE, widthCm: SCREEN_W, widthPx: SCREEN_PX, heightPx: SCREEN_HEIGHT } = PLATFORM.screen;
const priceFor = (n,ph) => n<=2 ? P[n][ph] : n*PER[ph];
const o3 = {n:3};
const phaseNow = () => currentPhase(EVENT)==='regular' ? 'reg' : 'early';
const S = {stock: null, phase: phaseNow(), open: bookingIsOpen(EVENT)};
const payUrl = k => (CONFIG.links[S.phase==='early'?'early':'regular']||{})[k] || '';

/* ---------- Statistiques (avec consentement) ---------- */
const A = CONFIG.analytics, anyA = !!(A.ga4||A.clarity||A.metaPixel);
let consent=null; try{ consent=localStorage.getItem('px_consent'); }catch(e){}
let aReady=false; const aQueue=[];
function loadScript(src){ const x=document.createElement('script'); x.async=true; x.src=src; document.head.appendChild(x); }
function initAnalytics(){
  if(aReady) return;
  if(A.ga4){ window.dataLayer=window.dataLayer||[]; window.gtag=function(){ dataLayer.push(arguments); }; loadScript('https://www.googletagmanager.com/gtag/js?id='+A.ga4); gtag('js',new Date()); gtag('config',A.ga4); }
  if(A.clarity){ (function(c,l,a,r,i,t,y){ c[a]=c[a]||function(){ (c[a].q=c[a].q||[]).push(arguments); }; t=l.createElement(r); t.async=1; t.src='https://www.clarity.ms/tag/'+i; y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y); })(window,document,'clarity','script',A.clarity); }
  if(A.metaPixel){ !function(f,b,e,v,n,t,s){ if(f.fbq)return; n=f.fbq=function(){ n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments); }; if(!f._fbq)f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[]; t=b.createElement(e); t.async=!0; t.src=v; s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s); }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init',A.metaPixel); fbq('track','PageView'); }
  aReady=true; aQueue.splice(0).forEach(q=>sendEvt(q[0],q[1]));
}
function sendEvt(n,p){
  if(A.ga4&&window.gtag) gtag('event',n,p||{});
  if(A.clarity&&window.clarity) clarity('event',n);
  if(A.metaPixel&&window.fbq){ const m={begin_checkout:'InitiateCheckout',purchase:'Purchase'}[n]; if(m) fbq('track',m); else fbq('trackCustom',n,p||{}); }
}
function track(n,p){ if(!anyA||consent!=='yes') return; const detail={event:EVENT.id,...p}; aReady?sendEvt(n,detail):aQueue.push([n,detail]); }
(function(){
  if(!anyA) return;
  const box=document.getElementById('consent');
  if(consent==='yes') initAnalytics();
  else if(consent===null){ box.hidden=false; }
  document.getElementById('cOk').onclick=()=>{ consent='yes'; try{localStorage.setItem('px_consent','yes');}catch(e){} box.hidden=true; initAnalytics(); };
  document.getElementById('cNo').onclick=()=>{ consent='no'; try{localStorage.setItem('px_consent','no');}catch(e){} box.hidden=true; };
})();

/* ---------- Routage : accueil, merci, liste d'attente ---------- */
const routes=[...document.querySelectorAll('[data-route]')];
let curRoute='/';
function route(){
  const h=location.hash||'';
  let target='/';
  if(h.startsWith('#/')){ const p=h.slice(1).split('?')[0]; target=(p==='/merci'||p==='/liste-attente')?p:'/'; }
  else if(new URLSearchParams(location.search).has('merci')) target='/merci';
  curRoute=target;
  if (target === '/merci') void verifyConfirmation(CONFIG);
  document.body.classList.toggle('nohome',target!=='/');
  routes.forEach(r=>r.hidden=r.dataset.route!==target);
  if(h.startsWith('#/')||target!=='/') window.scrollTo(0,0);
  // Un simple lien « merci » n'est pas une preuve de paiement. Vérification serveur à ajouter.
  updateSticky();
}
window.addEventListener('hashchange',route);


/* ---------- Fiches d'offres : 1 écran, 2 écrans, 3 écrans et plus (compteur) ---------- */
function renderOffers(left, early){
  const card = (n, count) => {
    const now = priceFor(count, S.phase), was = priceFor(count, 'reg'), save = was - priceFor(count, 'early');
    document.querySelector('[data-p="'+n+'"]').textContent = fm0(now);
    const w = document.querySelector('[data-w="'+n+'"]'); w.textContent = fm0(was); w.style.display = early ? '' : 'none';
    const sv = document.querySelector('[data-s="'+n+'"]'); sv.style.display = early ? '' : 'none';
    sv.textContent = ui.save(fm0(save), LABELS.earlyDeadline);
    const bt = document.querySelector('[data-b="'+n+'"]');
    bt.dataset.pack = count;
    bt.setAttribute('aria-disabled', String(!S.open));
    if(!S.open){ bt.textContent=ui.closed; bt.setAttribute('href','#'); }
    else if(left >= count){ bt.textContent = ui.reserve(count); bt.setAttribute('href', payUrl(count)||'#'); }
    else { bt.textContent = left===0 ? ui.waitlistShort : ui.onlyLeft(left); bt.setAttribute('href','#/liste-attente'); }
  };
  card(1, 1); card(2, 2);

  // 3e fiche : compteur de 3 à 10 écrans (limité par le stock restant)
  const maxN = Math.max(3, Math.min(MAX_SCREENS, left));
  o3.n = Math.min(Math.max(o3.n, 3), maxN);
  const n = o3.n, cm = n*SCREEN_W;
  card(3, n);
  document.getElementById('o3N').textContent = n;
  document.getElementById('o3Title').textContent = ui.screen(n);
  document.getElementById('o3Minus').disabled = n <= 3;
  document.getElementById('o3Plus').disabled = n >= maxN;
  document.getElementById('o3Step').style.display = left < 3 ? 'none' : '';
  document.getElementById('o3Value').innerHTML = ui.value(n, fm0(n*SCREEN_VALUE));
  document.getElementById('o3Width').textContent = ui.width(n, cm);
  document.getElementById('o3Visual').textContent = ui.visual(n, n*SCREEN_PX, SCREEN_HEIGHT);
  // Intensité : 17 à 20 A pour 3 écrans, proportionnel au-delà (à confirmer avec Anis)
  const lo = Math.ceil(n*17/3), hi = Math.ceil(n*20/3);
  document.getElementById('o3Amp').textContent = ui.amps(lo, hi);
  const note = document.getElementById('o3AmpNote');
  note.hidden = n < 4; note.textContent = ui.powerNote;
  document.getElementById('o3Badge').textContent = ui.badge(n);
}
document.getElementById('o3Minus').addEventListener('click',()=>{ o3.n--; renderAll(); track('screens_change',{screens:o3.n}); });
document.getElementById('o3Plus').addEventListener('click',()=>{ o3.n++; renderAll(); track('screens_change',{screens:o3.n}); });

/* ---------- Prix, compteur, boutons ---------- */
function renderAll(){
  S.phase=phaseNow();
  S.open=bookingIsOpen(EVENT);
  const early=S.phase==='early', left=S.stock ?? CONFIG.total;
  const b=document.getElementById('banner');
  b.className='banner'+(early?'':' over');
  const dl=Math.max(1,Math.ceil((Date.parse(CONFIG.earlyDeadline)-Date.now())/864e5));
  b.innerHTML = early
   ? 'Early bird: '+ui.daysLeft(dl)+' · <b>'+fm0(P[1].early)+'</b> <s>'+fm0(P[1].reg)+'</s><span class="hm"> '+ui.perScreen+'</span>'
   : ui.regularBanner(fm0(P[1].reg));
  if(!S.open) b.textContent=ui.closedFor(LABELS.fullName);
  renderOffers(left, early);
  document.querySelector('[data-big]').innerHTML=fm0(P[1][S.phase])+(early?' <s>'+fm0(P[1].reg)+'</s>':'');
  document.querySelector('[data-punch]').innerHTML=ui.punch(fm0(P[1][S.phase]-35000),fm0(SCREEN_VALUE),LABELS.durationDays);
  document.getElementById('pbNow').textContent=fm0(P[1][S.phase]);
  const pw=document.getElementById('pbWas'), ps=document.getElementById('pbSave');
  pw.style.display=ps.style.display=early?'':'none';
  pw.textContent=fm0(P[1].reg); ps.textContent=ui.save(fm0(P[1].reg-P[1].early));
  document.getElementById('pbTag').textContent=ui.priceTag(early);
  document.getElementById('left').textContent=S.stock === null ? '—' : left;
  document.querySelector('#counter .live').lastChild.textContent=S.stock === null ? ui.availability : ui.live;
  const sg=document.getElementById('segs'); if(!sg.children.length){ for(let i=0;i<CONFIG.total;i++) sg.appendChild(document.createElement('i')); }
  sg.hidden=S.stock===null;
  [...sg.children].forEach((e,i)=>{ e.className=i<left?'on'+(i===left-1?' last':''):'off'; });
  document.getElementById('counter').classList.toggle('low',left<=5);
  document.getElementById('counterNote').textContent=S.stock===null?ui.stockNote:left===0?ui.soldOutNote:left<=5?ui.lowStock:'';
  document.querySelectorAll('[data-cta]').forEach(a=>{
    if(!a.dataset.t) a.dataset.t=a.textContent;
    if(!S.open){ a.textContent=ui.closed; a.setAttribute('href','#offres'); }
    else if(left===0){ a.textContent=ui.waitlist; a.setAttribute('href','#/liste-attente'); }
    else { a.textContent=a.dataset.t; a.setAttribute('href','#offres'); }
  });
  document.querySelector('[data-final]').textContent=!S.open?ui.closedFor(LABELS.fullName):(early?ui.deadline(LABELS.earlyDeadline):'')+(S.stock===null?ui.datesAvailability:left===0?ui.allReserved:ui.remaining(left)+'.');
  document.getElementById('stkP').innerHTML=fm0(P[1][S.phase])+(early?' <s>'+fm0(P[1].reg)+'</s>':'');
  document.getElementById('stkL').textContent=!S.open?ui.closed:S.stock===null?ui.stockUnknown:left===0?ui.soldOut:ui.remaining(left);
  document.querySelectorAll('[data-mlink]').forEach(a=>a.setAttribute('href',(CONFIG.links.montage||{})[a.dataset.mlink]||'#'));
  const wl=document.getElementById('wlMail');
  if(wl) wl.setAttribute('href','mailto:'+CONFIG.waitlistEmail+'?subject='+encodeURIComponent(ui.waitSubject(LABELS.fullName))+'&body='+encodeURIComponent(ui.waitBody));
}
document.querySelectorAll('[data-cta]').forEach(a=>a.dataset.t=a.textContent);

/* Un inventaire partagé, interrogé pour les dates de l’événement choisi. */
async function loadStock(){
  try {
    const r=await fetch('/api/stock?event='+encodeURIComponent(EVENT.id),{cache:'no-store'});
    if(!r.ok) return;
    const data=await r.json();
    if(data.eventId===EVENT.id && Number.isInteger(data.remaining) && data.remaining>=0 && data.remaining<=CONFIG.total){ S.stock=data.remaining; renderAll(); }
  } catch { /* Aperçu statique : ne jamais inventer un stock disponible. */ }
}

/* Clics : paiement et boutons principaux */
document.addEventListener('click',e=>{
  const a=e.target.closest('a[data-pack],a[data-mlink]');
  if(a){
    const href=a.getAttribute('href');
    if(a.getAttribute('aria-disabled')==='true'){e.preventDefault();return;}
    if(a.hasAttribute('data-pack') && href!=='#/liste-attente'){ e.preventDefault(); void startCheckout(Number(a.dataset.pack)); return; }
    if(!href||href==='#'){ e.preventDefault(); alert(ui.paymentPending); return; }
    if(/^https?:/.test(href)) track('begin_checkout',{pack:a.dataset.pack||a.dataset.mlink,phase:S.phase});
    return;
  }
  const c=e.target.closest('[data-cta]'); if(c) track('cta_click',{label:(c.dataset.t||c.textContent).trim()});
});

let checkoutPending = false;
async function startCheckout(screens){
  if(checkoutPending) return;
  checkoutPending = true;
  let redirecting = false;
  let status = document.getElementById('checkoutStatus');
  if(!status){ status=document.createElement('p'); status.id='checkoutStatus'; status.className='checkout-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); document.querySelector('.offers').after(status); }
  status.textContent=ui.checkoutLoading;
  document.querySelectorAll('[data-pack]').forEach(a=>{ a.setAttribute('aria-disabled','true'); a.classList.add('checkout-busy'); });
  try {
    const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:EVENT.id,screens,language:LANGUAGE})});
    const data=await response.json();
    if(!response.ok){
      if(data.error==='not_enough_stock'){await loadStock();throw new Error(ui.checkoutStock);}
      if(data.error==='booking_closed')throw new Error(ui.checkoutClosed);
      if(['production_inventory_not_ready','tax_rates_not_configured'].includes(data.error))throw new Error(ui.checkoutSetup);
      throw new Error(ui.checkoutError);
    }
    const url=new URL(data.url);
    if(url.protocol!=='https:' || url.hostname!=='checkout.stripe.com')throw new Error(ui.checkoutError);
    track('begin_checkout',{screens,phase:data.phase});
    window.location.assign(url.href);
    redirecting=true;
  } catch(error){
    const known=[ui.checkoutStock,ui.checkoutClosed,ui.checkoutSetup,ui.checkoutError];
    status.textContent=known.includes(error.message)?error.message:ui.checkoutError;
  } finally {
    if(!redirecting){
      checkoutPending=false;
      document.querySelectorAll('[data-pack]').forEach(a=>a.classList.remove('checkout-busy'));
      renderAll();
    }
  }
}
window.addEventListener('pageshow',event=>{
  if(event.persisted){checkoutPending=false;document.querySelectorAll('[data-pack]').forEach(a=>a.classList.remove('checkout-busy'));renderAll();void loadStock();}
});

/* Compte à rebours en direct jusqu'à la fin de l'early bird */
function tick(){
  const el=document.getElementById('skCd'); if(!el) return;
  if(phaseNow()!==S.phase || bookingIsOpen(EVENT)!==S.open) renderAll();
  const ms=Date.parse(CONFIG.earlyDeadline)-Date.now();
  const wrap=el.closest('.sk-cd');
  if(ms<=0){ wrap.style.visibility='hidden'; return; }
  wrap.style.visibility='';
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),sec=Math.floor(ms%6e4/1e3);
  const q=n=>String(n).padStart(2,'0');
  el.textContent=d+' '+ui.dayAbbr+' '+q(h)+' : '+q(m)+' : '+q(sec);
}
setInterval(tick,1000); tick();

/* Barre collante et parcours : page de vente seulement */
function updateSticky(){
  const home=curRoute==='/';
  document.getElementById('sticky').classList.toggle('show',home);
  document.getElementById('jny').classList.toggle('show',home);
  if(home) jUpdate(true);
  stkUpdate();
}
function stkUpdate(){
  const k=document.getElementById('sticky'); const on=k.classList.contains('show');
  k.classList.toggle('in',on); document.body.classList.toggle('stk',on);
}
window.addEventListener('scroll',stkUpdate,{passive:true});
setInterval(stkUpdate,300);
const JS=['s-offre','comment','offres','pourquoi','montage','preuves','faq','final'].map((id,i)=>[id,ui.journey[i]]);
let jCurIdx=-1;
function jGo(i){ const el=document.getElementById(JS[i][0]); if(!el) return; closeJ();
  if(i===0) window.scrollTo({top:0,behavior:'smooth'}); else el.scrollIntoView({behavior:'smooth',block:'start'}); }
window.jGo=jGo;
function closeJ(){ document.getElementById('jny').classList.remove('open'); document.getElementById('jb').setAttribute('aria-expanded','false'); }
function jUpdate(force){
  const hh=document.querySelector('header.top').offsetHeight;
  let cur=0;
  JS.forEach((x,i)=>{ const el=document.getElementById(x[0]); if(el && el.getBoundingClientRect().top <= hh+innerHeight*0.35) cur=i; });
  if(innerHeight+scrollY >= document.documentElement.scrollHeight-6) cur=JS.length-1;
  const max=document.documentElement.scrollHeight-innerHeight, pct=max>0?Math.min(1,Math.max(0,scrollY/max)):0;
  const C=2*Math.PI*11;
  const ring=document.getElementById('jring'); if(ring) ring.setAttribute('stroke-dashoffset',(C*(1-pct)).toFixed(1));
  if(cur===jCurIdx && !force && ring) return;
  jCurIdx=cur;
  document.getElementById('jb').innerHTML=`<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="none" stroke="#2b4579" stroke-width="3"/><circle id="jring" cx="14" cy="14" r="11" fill="none" stroke="#6EA8FF" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct)).toFixed(1)}" transform="rotate(-90 14 14)"/></svg><span class="t"><small>${cur+1} ${ui.of} ${JS.length}</small><b>${JS[cur][1]}</b></span>`;
  document.getElementById('jl').innerHTML=JS.map((x,i)=>`<li class="${i<cur?'done':i===cur?'now':''}"><button onclick="jGo(${i})"><span>${x[1]}</span>${i===cur?'<em>'+ui.here+'</em>':''}</button></li>`).join('');
}
document.getElementById('jb').onclick=()=>{ const j=document.getElementById('jny'); const o=j.classList.toggle('open'); document.getElementById('jb').setAttribute('aria-expanded',o); };
document.addEventListener('click',e=>{ if(!e.target.closest('#jny')) closeJ(); });
window.addEventListener('scroll',()=>jUpdate(false),{passive:true});
window.addEventListener('resize',()=>jUpdate(true));

/* Étapes « Comment ça marche » : animation en boucle quand la section est visible */
(function(){ const f=document.getElementById('flow'); if(!f) return;
  if(!('IntersectionObserver' in window)){ f.classList.add('in','run'); return; }
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ f.classList.add('in','run'); } else { f.classList.remove('run'); } }),{threshold:.35}).observe(f); })();

/* Vidéo : lecture automatique (sans le son) quand la section est visible */
(function(){
  const v=document.getElementById('vsl'), b=document.getElementById('vslSound'); if(!v) return;
  const mq=window.matchMedia('(max-width:600px)');
  const setSrc=()=>{ const want=(mq.matches?EVENT.media.mobileVideo:EVENT.media.desktopVideo)+'#t=0.1'; if(v.dataset.src!==want){ v.dataset.src=want; v.src=want; } };
  setSrc(); (mq.addEventListener?mq.addEventListener('change',setSrc):mq.addListener(setSrc));
  b.onclick=()=>{ v.muted=false; v.volume=1; b.hidden=true; v.play().catch(()=>{}); track('video_unmute'); };
  v.addEventListener('volumechange',()=>{ b.hidden=!v.muted; });
  let playedOnce=false; const marks={25:0,50:0,75:0,100:0};
  v.addEventListener('play',()=>{ if(!playedOnce){ playedOnce=true; track('video_play'); } });
  v.addEventListener('timeupdate',()=>{ if(!v.duration) return; const p=v.currentTime/v.duration*100; for(const k in marks){ if(!marks[k] && p>=+k-0.5){ marks[k]=1; track('video_progress',{percent:+k}); } } });
  if(!('IntersectionObserver' in window)) return;
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ v.play().catch(()=>{}); } else { v.pause(); } }),{threshold:.5}).observe(document.getElementById('vslbox'));
})();

/* Suivi : sections vues */
(function(){
  if(!('IntersectionObserver' in window)) return;
  const seen={};
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting && !seen[e.target.id]){ seen[e.target.id]=1; track('section_view',{section:e.target.id}); } }),{threshold:.4});
  ['s-offre','video','comment','offres','pourquoi','montage','preuves','faq','final'].forEach(id=>{ const el=document.getElementById(id); if(el) io.observe(el); });
})();

renderAll(); route(); loadStock(); initTestimonials();
