import { copy, money } from './i18n.mjs';
import { isValidMontage } from './montage.mjs';
let invocation = 0;

export async function verifyConfirmation(config) {
  const ticket = ++invocation;
  const ui = copy(config.language);
  const root = document.querySelector('main[data-route="/merci"]');
  const title = root.querySelector('h1');
  const intro = root.querySelector('#confirmationIntro');
  const summary = root.querySelector('#reservationSummary');
  const amounts = root.querySelector('#receiptAmounts');
  intro.setAttribute('aria-live', 'polite');
  const show = (heading, detail) => {
    title.textContent=heading;intro.textContent=detail;
    summary.hidden=true;amounts.replaceChildren();
  };
  const amount = value => money(value,config.language,true);
  function receipt(data) {
    const row = (label, value, className='') => {
      const wrapper=document.createElement('div');wrapper.className=className;
      const key=document.createElement('dt');key.textContent=label;
      const detail=document.createElement('dd');detail.textContent=value;
      wrapper.append(key,detail);amounts.append(wrapper);
    };
    root.querySelector('#receiptTitle').textContent=ui.paymentSummary;
    row(ui.screen(data.screens),amount(data.rentalCents));
    if(data.montage==='none')row(ui.montageLegend,ui.montageLabel('none'),'receipt-visuals');
    else row(ui.montageLabel(data.montage),amount(data.montageCents));
    if(data.includedLogistics===true){
      row(ui.delivery,ui.offeredSingle,'receipt-included');
      row(ui.installation,ui.offeredSingle,'receipt-included');
    }
    row(ui.bookingSubtotal,amount(data.subtotalCents),'receipt-subtotal');
    // Compatibilité des anciennes sessions : une taxe globale si Stripe ne ventile pas.
    if(Number.isSafeInteger(data.gstCents)&&data.gstCents>=0&&Number.isSafeInteger(data.qstCents)&&data.qstCents>=0&&data.gstCents+data.qstCents===data.taxCents){
      row(ui.gst,amount(data.gstCents));row(ui.qst,amount(data.qstCents));
    }else row(ui.taxesCombined,amount(data.taxCents));
    row(ui.totalPaid,amount(data.totalCents)+' CAD','receipt-total');
    summary.hidden=false;
  }
  document.body.classList.add('confirmation-pending');
  show(ui.verifying,ui.verifyingDetail);
  const sessionId=new URLSearchParams(location.search).get('session_id');
  if(!sessionId){show(ui.verifyError,ui.verifyErrorDetail);return;}
  try{
    const params=new URLSearchParams({event:config.event.id,session_id:sessionId});
    const response=await fetch('/api/reservation?'+params,{cache:'no-store'});
    if(!response.ok)throw new Error('Verification failed');
    const data=await response.json();
    if(ticket!==invocation)return;
    if(data.eventId!==config.event.id||data.currency!=='cad')throw new Error('Unexpected reservation');
    if(data.status==='paid'){
      if(!Number.isInteger(data.screens)||data.screens<1||!isValidMontage(data.montage)||['rentalCents','montageCents','subtotalCents','taxCents','totalCents'].some(key=>!Number.isSafeInteger(data[key])||data[key]<0))throw new Error('Invalid summary');
      show(ui.paymentConfirmed,ui.paidDetail);receipt(data);
      document.body.classList.remove('confirmation-pending');
    }else if(data.status==='refunded')show(ui.paymentRefunded,ui.refundedDetail);
    else if(data.status==='expired')show(ui.paymentExpired,ui.expiredDetail);
    else show(ui.paymentWaiting,ui.pendingDetail);
  }catch{
    if(ticket===invocation)show(ui.verifyError,ui.verifyErrorDetail);
  }
}
