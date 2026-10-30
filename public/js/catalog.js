import catalog from './catalog-data.js';
import { eventLabels, bookingIsOpen } from './events-shared.js';
import { copy, languageUrl } from './i18n.mjs';
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
  const article = el('a', 'event-card');
  article.href = languageUrl(`/evenement.html?event=${encodeURIComponent(event.id)}`, language);
  const imageBox = el('div', 'event-card-logo');
  const image = el('img'); image.src = event.logo; image.alt = event.name; imageBox.append(image);
  const body = el('div', 'event-card-body');
  body.append(el('h2', '', labels.fullName), el('p', 'event-meta', labels.period));
  const action = el('span', 'event-card-action', open ? ui.discover : ui.closedEvent);
  article.append(imageBox, body, action); container.append(article);
}
if (!container.childElementCount) container.append(el('p', '', ui.empty));
