// Initialisation du modèle commun. Modifier config/events/*.json, pas ce fichier.
import catalog from './catalog-data.js';
import { eventLabels, bookingIsOpen } from './events-shared.js';

const id = new URLSearchParams(location.search).get('event');
const event = catalog.events.find((candidate) => candidate.id === id && candidate.active);

if (!event) {
  document.title = 'Événement introuvable | Pixanova Events';
  document.body.replaceChildren();
  const main = document.createElement('main');
  main.className = 'wrap page narrow';
  const title = document.createElement('h1');
  title.textContent = 'Événement introuvable';
  const link = document.createElement('a');
  link.href = '/'; link.textContent = 'Choisir un événement'; link.className = 'btn';
  main.append(title, link); document.body.append(main);
  document.documentElement.classList.remove('event-loading');
} else {
  const { platform } = catalog;
  const labels = eventLabels(event, platform);
  const money = (cents) => (cents / 100).toLocaleString('fr-CA', { maximumFractionDigits: 0 }) + ' $';
  const text = (selector, value) => document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  const bindings = {
    '[data-event-name]': event.name, '[data-event-full-name]': labels.fullName,
    '[data-event-period]': labels.period, '[data-total-screens]': platform.inventory.totalScreens,
    '[data-refund-date]': labels.refundDeadline, '[data-refund-date-full]': labels.refundDeadlineFull,
    '[data-artwork-date]': labels.artworkDeadline, '[data-artwork-date-full]': labels.artworkDeadlineFull,
    '[data-installation-date]': labels.installation, '[data-start-date]': labels.starts,
    '[data-screen-value]': money(platform.screen.valueCents),
    '[data-contact-phone]': platform.contact.phone,
    '#twoScreenValue': money(platform.screen.valueCents * 2),
    '#eventDates': `${labels.fullName} · ${event.city} · ${labels.period}`,
    '.price .unit': `avant taxes, pour les ${labels.durationDays} jour${labels.durationDays > 1 ? 's' : ''} du salon`,
  };
  for (const [selector, value] of Object.entries(bindings)) text(selector, value);
  document.querySelectorAll('[data-event-logo]').forEach((img) => { img.src = event.logo; img.alt = event.name; });
  document.querySelectorAll('[data-brand-logo]').forEach((img) => { img.src = platform.brand.logo; });
  document.querySelectorAll('[data-brand-website]').forEach((link) => { link.href = platform.brand.website; });
  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    if (link.textContent.includes('@')) link.textContent = platform.contact.email;
    link.href = `mailto:${platform.contact.email}`;
  });
  document.title = `Écrans LED pour ${labels.fullName} | ${platform.name}`;
  document.querySelector('meta[name="description"]').content = `${event.description} Livraison et installation incluses. ${labels.period}, ${event.city}.`;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = document.querySelector('meta[name="description"]').content;

  window.CONFIG = {
    event, platform, labels,
    total: platform.inventory.totalScreens,
    earlyDeadline: event.dates.earlyBirdEndsAt,
    analytics: platform.analytics,
    waitlistEmail: platform.contact.email,
    bookingOpen: bookingIsOpen(event),
    // Le paiement reste désactivé pendant la généralisation de l'inventaire.
    links: { early: {}, regular: {}, montage: {} },
  };
  document.documentElement.classList.remove('event-loading');
  await import('./main.js');
}
