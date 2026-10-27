import { normalizeLanguage, languageUrl, staticEnglish, money } from './i18n.mjs';
export const language = normalizeLanguage(new URLSearchParams(location.search).get('lang'));
export const homeUrl = languageUrl('/', language);

export function localizeEvent(event) {
  const translated = event.translations?.[language] || {};
  return {
    ...event,
    name: translated.name || event.name,
    city: translated.city || event.city,
    description: translated.description || (language === 'en' ? `Pixanova LED screens for exhibitors at ${translated.name || event.name} ${event.edition}.` : event.description),
  };
}

export function translateStaticDOM() {
  document.documentElement.lang = language === 'en' ? 'en-CA' : 'fr-CA';
  if (language !== 'en') return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style,noscript')) continue;
    const raw = node.textContent, key = raw.trim();
    let translated = staticEnglish[key];
    if (translated === undefined && /^\d[\d ,\u00a0\u202f]* \$$/.test(key)) translated = money(Number(key.replace(/[^\d,]/g, '').replace(',','.')) * 100, language, key.includes(','));
    if (key === '5,0') translated = '5.0';
    if (translated !== undefined) node.textContent = raw.replace(key, translated);
  }
  for (const node of document.querySelectorAll('[aria-label], [alt], [title]')) {
    for (const attr of ['aria-label', 'alt', 'title']) {
      const value = node.getAttribute(attr);
      if (staticEnglish[value]) node.setAttribute(attr, staticEnglish[value]);
    }
  }
}

export function installLanguageSwitcher() {
  const row = document.querySelector('header .row1') || document.querySelector('main');
  if (!row) return;
  const nav = document.createElement('nav');
  nav.className = 'language-switch'; nav.setAttribute('aria-label', language === 'en' ? 'Language' : 'Langue');
  for (const lang of ['fr','en']) {
    const link = document.createElement('a');
    link.textContent = lang.toUpperCase(); link.lang = lang;
    link.setAttribute('aria-label', lang === 'en' ? 'English' : 'Français');
    link.href = languageUrl(location.href, lang);
    if (language === lang) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  row.append(nav);
  // Mettre à jour les liens au changement d’ancre, sans perdre merci/session_id/événement.
  window.addEventListener('hashchange', () => {
    [...nav.children].forEach((link) => {link.href = languageUrl(location.href, link.lang);});
  });
  document.querySelectorAll('a[href="/"]').forEach((link) => { if (!link.closest('.language-switch')) link.href = homeUrl; });
}
