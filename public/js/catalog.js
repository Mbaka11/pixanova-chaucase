import catalog from './catalog-data.js';
import { eventLabels, computePrice, bookingIsOpen } from './events-shared.js';

const { platform, events } = catalog;
const container = document.getElementById('events');
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
container.replaceChildren();
document.title = `${platform.name} — Vos écrans LED pour les salons`;
document.querySelector('.logos img').src = platform.brand.logo;
document.querySelector('footer a').href = `mailto:${platform.contact.email}`;
for (const event of events.filter((item) => item.active)) {
  const labels = eventLabels(event, platform);
  const open = bookingIsOpen(event);
  const article = el('article', 'event-card');
  const imageBox = el('div', 'event-card-logo');
  const image = el('img'); image.src = event.logo; image.alt = event.name; imageBox.append(image);
  const body = el('div', 'event-card-body');
  body.append(el('h3', '', labels.fullName), el('p', 'event-meta', `${event.city} · ${labels.period}`), el('p', '', event.description));
  const price = computePrice(event, 1).totalCents;
  const priceLabel = el('p', 'event-price', `Dès ${(price / 100).toLocaleString('fr-CA')} $`);
  priceLabel.append(el('small', '', `par écran, avant taxes · ${labels.durationDays} jours`));
  body.append(priceLabel);
  const link = el('a', 'btn', open ? 'Découvrir mon offre' : 'Voir cet événement — réservations fermées');
  link.href = `/evenement.html?event=${encodeURIComponent(event.id)}`;
  body.append(link); article.append(imageBox, body); container.append(article);
}
if (!container.childElementCount) container.append(el('p', '', 'Les prochains événements seront annoncés ici.'));
