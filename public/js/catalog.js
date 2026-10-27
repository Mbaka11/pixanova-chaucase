import catalog from './catalog-data.js';
import { eventLabels, computePrice, bookingIsOpen } from './events-shared.js';
import { copy, money, languageUrl } from './i18n.mjs';
import { language, localizeEvent, translateStaticDOM, installLanguageSwitcher } from './language.js';
const ui = copy(language);
translateStaticDOM();
installLanguageSwitcher();

const { platform, events } = catalog;
const container = document.getElementById('events');
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
container.replaceChildren();
document.title = `${platform.name} — ${ui.catalogTitle}`;
document.querySelector('meta[name="description"]').content = ui.en ? 'Choose your event and discover Pixanova LED screen rental offers for your booth.' : 'Choisissez votre événement et découvrez les offres de location d’écrans LED Pixanova pour votre kiosque.';
document.querySelector('.logos img').src = platform.brand.logo;
document.querySelector('footer a').href = `mailto:${platform.contact.email}`;
for (const source of events.filter((item) => item.active)) {
  const event = localizeEvent(source);
  const labels = eventLabels(event, platform, language);
  const open = bookingIsOpen(event);
  const article = el('article', 'event-card');
  const imageBox = el('div', 'event-card-logo');
  const image = el('img'); image.src = event.logo; image.alt = event.name; imageBox.append(image);
  const body = el('div', 'event-card-body');
  body.append(el('h3', '', labels.fullName), el('p', 'event-meta', `${event.city} · ${labels.period}`), el('p', '', event.description));
  const price = computePrice(event, 1).totalCents;
  const priceLabel = el('p', 'event-price', ui.from(money(price, language)));
  priceLabel.append(el('small', '', ui.catalogUnit(labels.durationDays)));
  body.append(priceLabel);
  const link = el('a', 'btn', open ? ui.discover : ui.closedEvent);
  link.href = languageUrl(`/evenement.html?event=${encodeURIComponent(event.id)}`, language);
  body.append(link); article.append(imageBox, body); container.append(article);
}
if (!container.childElementCount) container.append(el('p', '', ui.empty));
