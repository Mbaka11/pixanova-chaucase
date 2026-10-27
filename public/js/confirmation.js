import { copy, money } from './i18n.mjs';
let invocation = 0;

export async function verifyConfirmation(config) {
  const ticket = ++invocation;
  const ui = copy(config.language);
  const root = document.querySelector('main[data-route="/merci"]');
  const title = root.querySelector('h1');
  const intro = root.querySelector('h1 + p');
  intro.setAttribute('aria-live', 'polite');
  let summary = root.querySelector('#reservationSummary');
  if (!summary) { summary = document.createElement('p'); summary.id = 'reservationSummary'; summary.className = 'reservation-summary'; intro.after(summary); }
  const show = (heading, detail, text = '') => { title.textContent = heading; intro.textContent = detail; summary.textContent = text; };
  document.body.classList.add('confirmation-pending');
  show(ui.verifying, ui.verifyingDetail);
  const sessionId = new URLSearchParams(location.search).get('session_id');
  if (!sessionId) { show(ui.verifyError, ui.verifyErrorDetail); return; }
  try {
    const params = new URLSearchParams({ event: config.event.id, session_id: sessionId });
    const response = await fetch('/api/reservation?' + params, { cache: 'no-store' });
    if (!response.ok) throw new Error('Verification failed');
    const data = await response.json();
    if (ticket !== invocation) return;
    if (data.eventId !== config.event.id || data.currency !== 'cad') throw new Error('Unexpected reservation');
    if (data.status === 'paid') {
      show(ui.paymentConfirmed, ui.paidDetail, ui.paidSummary(data.screens, money(data.subtotalCents, config.language, true), money(data.taxCents, config.language, true), money(data.totalCents, config.language, true)));
      document.body.classList.remove('confirmation-pending');
    } else if (data.status === 'refunded') show(ui.paymentRefunded, ui.refundedDetail);
    else if (data.status === 'expired') show(ui.paymentExpired, ui.expiredDetail);
    else show(ui.paymentWaiting, ui.pendingDetail);
  } catch {
    if (ticket === invocation) show(ui.verifyError, ui.verifyErrorDetail);
  }
}
