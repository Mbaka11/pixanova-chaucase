const fm0 = c => (c/100).toLocaleString('fr-CA',{maximumFractionDigits:0}).replace(/[  ]/g,' ')+' $';
/* Prix en cents, avant taxes. 3 écrans et plus : quantité × tarif par écran (mêmes règles que le serveur). */
const P = {1:{early:59900,reg:79500}, 2:{early:109500,reg:139500}};
const PER = {early:53000, reg:65000};
const MAX_SCREENS = 10, SCREEN_VALUE = 700000, SCREEN_W = 96, SCREEN_PX = 516;
const priceFor = (n,ph) => n<=2 ? P[n][ph] : n*PER[ph];
const o3 = {n:3};
const phaseNow = () => Date.now() > Date.parse(CONFIG.earlyDeadline) ? 'reg' : 'early';
const S = {stock: Math.max(0, CONFIG.total-CONFIG.reserved), phase: phaseNow()};
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
function track(n,p){ if(!anyA||consent!=='yes') return; aReady?sendEvt(n,p):aQueue.push([n,p]); }
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
  document.body.classList.toggle('nohome',target!=='/');
  routes.forEach(r=>r.hidden=r.dataset.route!==target);
  if(h.startsWith('#/')||target!=='/') window.scrollTo(0,0);
  if(target==='/merci' && !window.__purchased){ window.__purchased=1; track('purchase',{}); }
  updateSticky();
}
window.addEventListener('hashchange',route);


/* ---------- Fiches d'offres : 1 écran, 2 écrans, 3 écrans et plus (compteur) ---------- */
const WORDS = {3:'Trois',4:'Quatre',5:'Cinq',6:'Six',7:'Sept',8:'Huit',9:'Neuf',10:'Dix'};
function renderOffers(left, early){
  const card = (n, count) => {
    const now = priceFor(count, S.phase), was = priceFor(count, 'reg'), save = was - priceFor(count, 'early');
    document.querySelector('[data-p="'+n+'"]').textContent = fm0(now);
    const w = document.querySelector('[data-w="'+n+'"]'); w.textContent = fm0(was); w.style.display = early ? '' : 'none';
    const sv = document.querySelector('[data-s="'+n+'"]'); sv.style.display = early ? '' : 'none';
    sv.textContent = 'Économisez '+fm0(save)+' avant le 15 décembre';
    const bt = document.querySelector('[data-b="'+n+'"]');
    bt.dataset.pack = count;
    if(left >= count){ bt.textContent = count===1 ? 'Réserver 1 écran' : 'Réserver '+count+' écrans'; bt.setAttribute('href', payUrl(count)||'#'); }
    else { bt.textContent = left===0 ? "Liste d'attente" : 'Seulement '+left+' restant'+(left>1?'s':'')+" : liste d'attente"; bt.setAttribute('href','#/liste-attente'); }
  };
  card(1, 1); card(2, 2);

  // 3e fiche : compteur de 3 à 10 écrans (limité par le stock restant)
  const maxN = Math.max(3, Math.min(MAX_SCREENS, left));
  o3.n = Math.min(Math.max(o3.n, 3), maxN);
  const n = o3.n, cm = n*SCREEN_W;
  card(3, n);
  document.getElementById('o3N').textContent = n;
  document.getElementById('o3Title').textContent = n+' écrans';
  document.getElementById('o3Minus').disabled = n <= 3;
  document.getElementById('o3Plus').disabled = n >= maxN;
  document.getElementById('o3Step').style.display = left < 3 ? 'none' : '';
  document.getElementById('o3Value').innerHTML = 'Valeur des '+(WORDS[n]||n).toLowerCase()+' écrans : <b>'+fm0(n*SCREEN_VALUE)+'</b>';
  document.getElementById('o3Width').textContent = (WORDS[n]||n)+' écrans côte à côte : '+cm+' cm'+(n===3?', tout le mur du kiosque':'');
  document.getElementById('o3Visual').textContent = 'Un visuel panoramique de '+(n*SCREEN_PX)+' x 1032 px, ou '+(WORDS[n]||n).toLowerCase()+' messages';
  // Intensité : 17 à 20 A pour 3 écrans, proportionnel au-delà (à confirmer avec Anis)
  const lo = Math.ceil(n*17/3), hi = Math.ceil(n*20/3);
  document.getElementById('o3Amp').textContent = '120 V · '+lo+' à '+hi+' A';
  const note = document.getElementById('o3AmpNote');
  note.hidden = n < 4; note.textContent = 'À répartir sur plusieurs prises du kiosque.';
  document.getElementById('o3Badge').textContent = n===3 ? 'Kiosque 10 × 10' : 'Grand kiosque';
}
document.getElementById('o3Minus').addEventListener('click',()=>{ o3.n--; renderAll(); track('screens_change',{screens:o3.n}); });
document.getElementById('o3Plus').addEventListener('click',()=>{ o3.n++; renderAll(); track('screens_change',{screens:o3.n}); });

/* ---------- Prix, compteur, boutons ---------- */
function renderAll(){
  S.phase=phaseNow();
  const early=S.phase==='early', left=S.stock;
  const b=document.getElementById('banner');
  b.className='banner'+(early?'':' over');
  const dl=Math.max(1,Math.ceil((Date.parse(CONFIG.earlyDeadline)-Date.now())/864e5));
  b.innerHTML = early
   ? 'Early bird : '+(dl>1?'plus que <b>'+dl+' jours</b>':'<b>dernier jour</b>')+' <span class="hm">pour profiter de</span><span class="dm">·</span> <b>599 $</b> <s>795 $</s><span class="hm"> par écran</span>'
   : 'La période early bird est terminée. Prix régulier : <b>795 $ par écran</b>.';
  renderOffers(left, early);
  document.querySelector('[data-big]').innerHTML=fm0(P[1][S.phase])+(early?' <s>'+fm0(P[1].reg)+'</s>':'');
  document.querySelector('[data-punch]').innerHTML='Pour <em>'+fm0(P[1][S.phase]-35000)+' de plus</em>, passez d\'un message figé à un écran de 7 000 $ de valeur, en boucle, pendant 3 jours.';
  document.getElementById('pbNow').textContent=fm0(P[1][S.phase]);
  const pw=document.getElementById('pbWas'), ps=document.getElementById('pbSave');
  pw.style.display=ps.style.display=early?'':'none';
  pw.textContent=fm0(P[1].reg); ps.textContent='Économisez '+fm0(P[1].reg-P[1].early);
  document.getElementById('pbTag').textContent=early?'Prix early bird':'Prix régulier';
  document.getElementById('left').textContent=left;
  const sg=document.getElementById('segs'); if(!sg.children.length){ for(let i=0;i<CONFIG.total;i++) sg.appendChild(document.createElement('i')); }
  [...sg.children].forEach((e,i)=>{ e.className=i<left?'on'+(i===left-1?' last':''):'off'; });
  document.getElementById('counter').classList.toggle('low',left<=5);
  document.getElementById('counterNote').textContent=left===0?'Tous les écrans sont réservés. Inscrivez-vous à la liste d\'attente.':left<=5?'Presque complet. Ne tardez pas.':'';
  document.querySelectorAll('[data-cta]').forEach(a=>{
    if(!a.dataset.t) a.dataset.t=a.textContent;
    if(left===0){ a.textContent='Rejoindre la liste d\'attente'; a.setAttribute('href','#/liste-attente'); }
    else { a.textContent=a.dataset.t; a.setAttribute('href','#offres'); }
  });
  document.querySelector('[data-final]').textContent=(early?'Prix early bird jusqu\'au 15 décembre. ':'')+(left===0?'Tous les écrans sont réservés.':'Il reste '+left+' écran'+(left>1?'s':'')+'.');
  document.getElementById('stkP').innerHTML=fm0(P[1][S.phase])+(early?' <s>'+fm0(P[1].reg)+'</s>':'');
  document.getElementById('stkL').textContent=left===0?'Complet':left+' écran'+(left>1?'s':'')+' restant'+(left>1?'s':'');
  document.querySelectorAll('[data-mlink]').forEach(a=>a.setAttribute('href',(CONFIG.links.montage||{})[a.dataset.mlink]||'#'));
  const wl=document.getElementById('wlMail');
  if(wl) wl.setAttribute('href','mailto:'+CONFIG.waitlistEmail+'?subject='+encodeURIComponent('Liste d\'attente ChauCase 2027')+'&body='+encodeURIComponent('Bonjour,\n\nNuméro de kiosque :\nEntreprise :\nNombre d\'écrans souhaité :\n'));
}
document.querySelectorAll('[data-cta]').forEach(a=>a.dataset.t=a.textContent);

/* Stock : lecture optionnelle d'un Google Sheets publié */
async function loadStock(){
  if(!CONFIG.stockSheetUrl) return;
  try{ const r=await fetch(CONFIG.stockSheetUrl,{cache:'no-store'}); const n=parseInt((await r.text()).replace(/[^0-9]/g,''),10); if(!isNaN(n)){ S.stock=Math.max(0,CONFIG.total-n); renderAll(); } }catch(e){}
}

/* Clics : paiement et boutons principaux */
document.addEventListener('click',e=>{
  const a=e.target.closest('a[data-pack],a[data-mlink]');
  if(a){
    const href=a.getAttribute('href');
    if(!href||href==='#'){ e.preventDefault(); alert('Lien de paiement non configuré. Voir CONFIG au début du script de index.html (GUIDE-LANCEMENT.md).'); return; }
    if(/^https?:/.test(href)) track('begin_checkout',{pack:a.dataset.pack||a.dataset.mlink,phase:S.phase});
    return;
  }
  const c=e.target.closest('[data-cta]'); if(c) track('cta_click',{label:(c.dataset.t||c.textContent).trim()});
});

/* Compte à rebours en direct jusqu'à la fin de l'early bird */
function tick(){
  const el=document.getElementById('skCd'); if(!el) return;
  if(phaseNow()!==S.phase) renderAll();
  const ms=Date.parse(CONFIG.earlyDeadline)-Date.now();
  const wrap=el.closest('.sk-cd');
  if(ms<=0){ wrap.style.visibility='hidden'; return; }
  wrap.style.visibility='';
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),sec=Math.floor(ms%6e4/1e3);
  const q=n=>String(n).padStart(2,'0');
  el.textContent=d+' j '+q(h)+' : '+q(m)+' : '+q(sec);
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
const JS=[['s-offre','L\'offre'],['comment','Le principe'],['offres','Les prix'],['pourquoi','Pourquoi'],['montage','Montage'],['preuves','Réalisations'],['faq','Questions'],['final','Réserver']];
let jCurIdx=-1;
function jGo(i){ const el=document.getElementById(JS[i][0]); if(!el) return; closeJ();
  if(i===0) window.scrollTo({top:0,behavior:'smooth'}); else el.scrollIntoView({behavior:'smooth',block:'start'}); }
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
  document.getElementById('jb').innerHTML=`<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="none" stroke="#2b4579" stroke-width="3"/><circle id="jring" cx="14" cy="14" r="11" fill="none" stroke="#6EA8FF" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct)).toFixed(1)}" transform="rotate(-90 14 14)"/></svg><span class="t"><small>${cur+1} sur ${JS.length}</small><b>${JS[cur][1]}</b></span>`;
  document.getElementById('jl').innerHTML=JS.map((x,i)=>`<li class="${i<cur?'done':i===cur?'now':''}"><button onclick="jGo(${i})"><span>${x[1]}</span>${i===cur?'<em>Ici</em>':''}</button></li>`).join('');
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
  const setSrc=()=>{ const want=mq.matches?'assets/videos/vsl-mobile.mp4#t=0.1':'assets/videos/vsl-desktop.mp4#t=0.1'; if(v.dataset.src!==want){ v.dataset.src=want; v.src=want; } };
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

renderAll(); route(); loadStock();
