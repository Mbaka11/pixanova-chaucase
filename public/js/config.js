// Initialisation du modèle commun. Modifier config/events/*.json, pas ce fichier.
import catalog from './catalog-data.js';
import { eventLabels, bookingIsOpen } from './events-shared.js';
import { copy, money as formatMoney } from './i18n.mjs';
import { montageHours } from './montage.mjs';
import { language, homeUrl, localizeEvent, translateStaticDOM, installLanguageSwitcher } from './language.js';
const ui = copy(language);
translateStaticDOM();

const id = new URLSearchParams(location.search).get('event');
const source = catalog.events.find((candidate) => candidate.id === id && candidate.active);
const event = source ? localizeEvent(source) : null;

if (!event) {
  document.title = `${ui.missingEvent} | Pixanova Events`;
  document.body.replaceChildren();
  const main = document.createElement('main');
  main.className = 'wrap page narrow';
  const title = document.createElement('h1');
  title.textContent = ui.missingEvent;
  const link = document.createElement('a');
  link.href = homeUrl; link.textContent = ui.chooseEvent; link.className = 'btn';
  main.append(title, link); document.body.append(main);
  installLanguageSwitcher();
  document.documentElement.classList.remove('event-loading');
} else {
  const { platform } = catalog;
  const labels = eventLabels(event, platform, language);
  const money = (cents) => formatMoney(cents, language);
  const text = (selector, value) => document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  const bindings = {
    '[data-event-name]': event.name, '[data-event-full-name]': labels.fullName,
    '[data-event-period]': labels.period, '[data-total-screens]': platform.inventory.totalScreens,
    '[data-refund-date]': labels.refundDeadline, '[data-refund-date-full]': labels.refundDeadlineFull,
    '[data-artwork-date]': labels.artworkDeadline, '[data-artwork-date-full]': labels.artworkDeadlineFull,
    '[data-installation-date]': labels.installation, '[data-start-date]': labels.starts,
    '[data-screen-value]': money(platform.screen.valueCents),
    '[data-montage-simple]': money(platform.montage.simpleCents),
    '[data-montage-animated]': money(platform.montage.animatedCents),
    '[data-montage-simple-title]': ui.montageLabel('simple'),
    '[data-montage-animated-title]': ui.montageLabel('animated'),
    '[data-montage-simple-description]': ui.montageDescription('simple', montageHours(platform, 'simple')),
    '[data-montage-animated-description]': ui.montageDescription('animated', montageHours(platform, 'animated')),
    '[data-montage-simple-example]': ui.montageExample('simple'),
    '[data-montage-animated-example]': ui.montageExample('animated'),
    '[data-montage-scope]': ui.montageScope(montageHours(platform, 'simple'), montageHours(platform, 'animated')),
    '[data-contact-phone]': platform.contact.phone,
    '#twoScreenValue': money(platform.screen.valueCents * 2),
    '#eventDates': `${labels.fullName} · ${event.city} · ${labels.period}`,
    '.price .unit': ui.duration(labels.durationDays),
  };
  for (const [selector, value] of Object.entries(bindings)) text(selector, value);
  document.querySelectorAll('[data-event-logo]').forEach((img) => { img.src = event.logo; img.alt = event.name; });
  document.querySelectorAll('[data-brand-logo]').forEach((img) => { img.src = platform.brand.logo; });
  document.querySelectorAll('[data-brand-website]').forEach((link) => { link.href = platform.brand.website; });
  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    if (link.textContent.includes('@')) link.textContent = platform.contact.email;
    link.href = `mailto:${platform.contact.email}`;
  });
  document.title = `${ui.pageTitle(labels.fullName)} | ${platform.name}`;
  document.querySelector('meta[name="description"]').content = `${event.description} ${ui.included} ${labels.period}, ${event.city}.`;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = document.querySelector('meta[name="description"]').content;

  window.CONFIG = {
    event, platform, labels, language,
    total: platform.inventory.totalScreens,
    earlyDeadline: event.dates.earlyBirdEndsAt,
    analytics: platform.analytics,
    waitlistEmail: platform.contact.email,
    bookingOpen: bookingIsOpen(event),
  };
  installLanguageSwitcher();
  if (language === 'en') {
    const note = document.createElement('p'); note.className='media-language-note';
    note.textContent='Presentation and testimonial videos are in French.';
    document.querySelector('#video .wrap').append(note);
  }
  document.documentElement.classList.remove('event-loading');
  await import('./main.js');
}
