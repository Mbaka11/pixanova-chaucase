import { copy, money } from './i18n.mjs';
import { montageChoices, montagePrice, montageHours } from './montage.mjs';

export function createBookingDialog(config, { refreshStock, onCheckout } = {}) {
  const ui = copy(config.language);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = el('dialog', 'booking-dialog'); dialog.id = 'bookingDialog';
  dialog.setAttribute('aria-labelledby', 'bookingTitle');
  const form = el('form');
  const header = el('div', 'booking-header');
  const title = el('h2', '', ui.bookingTitle); title.id = 'bookingTitle';
  const close = el('button', 'booking-close', '×'); close.type = 'button'; close.setAttribute('aria-label', ui.bookingClose);
  header.append(title, close);
  const eventLine = el('p', 'booking-event');
  const fieldset = el('fieldset', 'booking-options');
  fieldset.append(el('legend', '', ui.montageLegend));
  const choices = new Map();
  for (const choice of montageChoices) {
    const label = el('label', 'booking-option');
    const input = el('input'); input.type = 'radio'; input.name = 'montage'; input.value = choice; input.id = `booking-${choice}`;
    const content = el('span', 'booking-option-content');
    const top = el('span', 'booking-option-top');
    const name = el('strong', '', ui.montageLabel(choice));
    const price = el('strong', 'booking-option-price');
    top.append(name, price); content.append(top, el('span', 'booking-option-description', ui.montageDescription(choice, montageHours(config.platform, choice))));
    label.append(input, content); fieldset.append(label); choices.set(choice, { input, price });
    input.addEventListener('change', () => { if (!busy) void loadQuote(); });
  }
  const summary = el('dl', 'booking-summary');
  const values = {};
  for (const [key, label] of [['rentalCents',ui.bookingRental],['montageCents',ui.montageLegend],['subtotalCents',ui.bookingSubtotal],['gstCents',`${ui.gst} (${config.platform.taxes.gstPercent.toLocaleString(ui.locale)} %)`],['qstCents',`${ui.qst} (${config.platform.taxes.qstPercent.toLocaleString(ui.locale)} %)`],['totalCents',ui.bookingTotal]]) {
    if (key === 'subtotalCents') {
      const included = el('div', 'booking-included');
      included.append(el('dt', '', ui.logistics), el('dd', '', ui.offered)); summary.append(included);
    }
    const row = el('div', key === 'totalCents' ? 'booking-total' : ['subtotalCents','gstCents','qstCents'].includes(key) ? 'booking-detail' : '');
    const value = el('dd', '', '—'); value.id = `booking-${key}`;
    const term = el('dt', '', label);
    if (key === 'totalCents') term.append(el('small', '', ui.taxesIncluded));
    row.append(term, value); summary.append(row); values[key] = value;
  }
  const status = el('p', 'booking-status'); status.id = 'bookingStatus'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const retry = el('button', 'booking-retry', ui.quoteRetry); retry.type='button'; retry.hidden=true;
  const actions = el('div', 'booking-actions');
  const back = el('button', 'btn outline', ui.bookingCancel); back.type='button';
  const pay = el('button', 'btn', ui.bookingPay); pay.type='submit'; pay.id='bookingPay';
  actions.append(back, pay);
  form.append(header, eventLine, fieldset, summary, status, retry, actions);
  dialog.append(form); document.body.append(dialog);
  let screens=1, quote=null, busy=false, generation=0, controller, returnFocus;
  const choice = () => form.elements.montage.value;
  function controls() {
    fieldset.disabled=busy; close.disabled=back.disabled=busy; retry.disabled=busy;
    pay.disabled=busy||!quote; pay.textContent=busy?ui.checkoutLoading:ui.bookingPay;
    dialog.setAttribute('aria-busy',String(busy));
  }
  async function loadQuote() {
    const ticket=++generation;
    controller?.abort(); controller=new AbortController();
    quote=null; retry.hidden=true; status.textContent=ui.quoteLoading;
    Object.values(values).forEach(value=>{value.textContent='—';}); controls();
    const montage=choice();
    values.montageCents.parentElement.hidden=montage==='none';
    values.montageCents.previousElementSibling.textContent=ui.montageLabel(montage);
    try {
      const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:config.event.id,screens,montage}),signal:controller.signal});
      const data=await response.json();
      if(ticket!==generation||!dialog.open)return;
      if(!response.ok)throw new Error(data.error==='booking_closed'?ui.checkoutClosed:ui.quoteError);
      if(data.eventId!==config.event.id||data.screens!==screens||data.montage!==montage||data.currency!=='cad'||Object.keys(values).some(key=>!Number.isSafeInteger(data[key])||data[key]<0))throw new Error(ui.quoteError);
      quote=data;
      for(const [key,value]of Object.entries(values))value.textContent=money(data[key],config.language,true);
      status.textContent='';
    } catch(error) {
      if(ticket!==generation||error.name==='AbortError'||!dialog.open)return;
      status.textContent=error.message===ui.checkoutClosed?error.message:ui.quoteError; retry.hidden=false;
    } finally {if(ticket===generation)controls();}
  }
  function finish() {if(!busy)dialog.close();}
  close.addEventListener('click',finish);back.addEventListener('click',finish);
  retry.addEventListener('click',()=>void loadQuote());
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;controller?.abort();quote=null;returnFocus?.focus({preventScroll:true});});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!quote)return;
    busy=true;controls();status.textContent=ui.checkoutLoading;
    let redirecting=false;
    try {
      const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:config.event.id,screens,montage:choice(),language:config.language,expectedTotalCents:quote.totalCents})});
      const data=await response.json();
      if(!response.ok){
        if(data.error==='quote_changed'){busy=false;await loadQuote();throw new Error(ui.quoteChanged);}
        if(data.error==='not_enough_stock'){await refreshStock?.();throw new Error(ui.checkoutStock);}
        if(data.error==='booking_closed')throw new Error(ui.checkoutClosed);
        if(['production_inventory_not_ready','tax_rates_not_configured'].includes(data.error))throw new Error(ui.checkoutSetup);
        throw new Error(ui.checkoutError);
      }
      const url=new URL(data.url);
      if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error(ui.checkoutError);
      onCheckout?.({screens,montage:choice(),phase:data.phase});
      window.location.assign(url.href);redirecting=true;
    } catch(error) {
      const known=[ui.quoteChanged,ui.checkoutStock,ui.checkoutClosed,ui.checkoutSetup,ui.checkoutError];
      status.textContent=known.includes(error.message)?error.message:ui.checkoutError;
    } finally {if(!redirecting){busy=false;controls();}}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted&&dialog.open){busy=false;controls();void loadQuote();void refreshStock?.();}});
  return {open(count,trigger){
    if(dialog.open||busy)return;
    screens=count; returnFocus=trigger;choices.get('none').input.checked=true;
    for(const [option,elements]of choices)elements.price.textContent=money(montagePrice(config.platform,screens,option),config.language);
    eventLine.textContent=`${config.labels.fullName} · ${ui.screen(screens)}`;
    dialog.showModal();void loadQuote();
  }};
}
