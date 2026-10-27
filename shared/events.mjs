// Fonctions pures communes : validation, dates, prix et affichage. Aucun secret ni accès Stripe.
import { normalizeLanguage, locales } from './i18n.mjs';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const dateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const timestamp = (v) => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const cents = (n) => Number.isSafeInteger(n) && n > 0;
const publicAsset = (v) => typeof v === 'string' && v.startsWith('/assets/') && !v.includes('..') && !/[<>"\\]/.test(v);

export function validateCatalog(input) {
  const { platform, events } = input;
  assert(platform?.name && platform.currency === 'cad', 'Plateforme/devise invalide');
  assert(platform.defaultLanguage === 'fr' && Array.isArray(platform.supportedLanguages) && platform.supportedLanguages.includes('fr') && platform.supportedLanguages.every((language) => ['fr','en'].includes(language)), 'Langues invalides');
  new Intl.DateTimeFormat('fr-CA', { timeZone: platform.timeZone });
  assert(Number.isSafeInteger(platform.inventory?.totalScreens) && platform.inventory.totalScreens > 0, 'Inventaire invalide');
  assert(Number.isInteger(platform.inventory?.holdMinutes) && platform.inventory.holdMinutes >= 30 && platform.inventory.holdMinutes <= 1440, 'Blocage Stripe : 30 à 1440 minutes');
  assert(publicAsset(platform.brand?.logo), 'Logo Pixanova invalide');
  for (const key of ['valueCents', 'widthCm', 'widthPx', 'heightPx']) assert(cents(platform.screen?.[key]), `Écran : ${key} invalide`);
  assert(Array.isArray(events), 'Liste des événements requise');
  const ids = new Set();
  for (const event of events) {
    assert(typeof event.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id) && !ids.has(event.id), 'Identifiant événement invalide ou en double');
    ids.add(event.id);
    assert(typeof event.active === 'boolean' && event.name && event.edition && event.city, 'Identité événement incomplète');
    assert(publicAsset(event.logo), `Logo invalide : ${event.id}`);
    assert(Number.isInteger(event.maxScreensPerOrder) && event.maxScreensPerOrder >= 3 && event.maxScreensPerOrder <= platform.inventory.totalScreens, 'Maximum de commande invalide');
    const d = event.dates;
    for (const key of ['startsOn', 'endsOn', 'installationOn', 'artworkDueOn']) assert(dateOnly(d?.[key]), `Date ${key} invalide : ${event.id}`);
    for (const key of ['rentalStartsAt', 'rentalEndsAt', 'earlyBirdEndsAt', 'refundEndsAt']) assert(timestamp(d?.[key]), `Date/heure ${key} invalide : ${event.id}`);
    assert(d.bookingClosesAt === null || timestamp(d.bookingClosesAt), 'Fin des réservations invalide');
    assert(d.startsOn <= d.endsOn && d.installationOn <= d.startsOn && d.artworkDueOn <= d.startsOn, 'Ordre des dates invalide');
    assert(Date.parse(d.rentalStartsAt) < Date.parse(d.rentalEndsAt), 'Période de location invalide');
    // Les dates de location doivent couvrir au minimum les dates civiles du salon.
    const localDay = (v) => new Intl.DateTimeFormat('en-CA', { timeZone: platform.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
    assert(localDay(d.rentalStartsAt) <= d.installationOn && localDay(d.rentalEndsAt) > d.endsOn, 'Location ne couvrant pas le salon et son installation');
    assert(Date.parse(d.earlyBirdEndsAt) < Date.parse(d.rentalStartsAt), 'Early bird après le début de location');
    if (d.bookingClosesAt) assert(Date.parse(d.bookingClosesAt) <= Date.parse(d.rentalStartsAt), 'Fin des réservations après la mise à disposition');
    for (const phase of ['early', 'regular']) for (const key of ['one', 'two', 'perScreen']) assert(cents(event.pricing?.[phase]?.[key]), 'Prix invalide');
    for (const key of ['one', 'two', 'perScreen']) assert(event.pricing.early[key] <= event.pricing.regular[key], 'Early bird plus cher que le régulier');
    assert(publicAsset(event.media?.desktopVideo) && publicAsset(event.media?.mobileVideo), 'Vidéos invalides');
  }
  return input;
}

export const currentPhase = (event, now = Date.now()) => now < Date.parse(event.dates.earlyBirdEndsAt) ? 'early' : 'regular';
export const bookingIsOpen = (event, now = Date.now()) => event.active && now < Date.parse(event.dates.bookingClosesAt || event.dates.rentalStartsAt);
export const isValidScreens = (event, n) => Number.isInteger(n) && n >= 1 && n <= event.maxScreensPerOrder;

export function computePrice(event, screens, now = Date.now()) {
  if (!isValidScreens(event, screens)) throw new RangeError('Nombre d’écrans invalide');
  const phase = currentPhase(event, now);
  const prices = event.pricing[phase];
  const totalCents = screens === 1 ? prices.one : screens === 2 ? prices.two : screens * prices.perScreen;
  if (!Number.isSafeInteger(totalCents)) throw new RangeError('Montant invalide');
  return { phase, screens, totalCents, unitCents: totalCents / screens };
}

export function formatDate(value, timeZone, { year = false, inclusiveDeadline = false, language = 'fr' } = {}) {
  const date = new Date(dateOnly(value) ? `${value}T12:00:00Z` : Date.parse(value) - (inclusiveDeadline ? 1 : 0));
  return new Intl.DateTimeFormat(locales[normalizeLanguage(language)], { timeZone, day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) }).format(date);
}

export function eventLabels(event, platform, language = 'fr') {
  language = normalizeLanguage(language);
  const d = event.dates, tz = platform.timeZone;
  const date = (v, year = false) => formatDate(v, tz, { year, language });
  return {
    fullName: `${event.name} ${event.edition}`,
    starts: date(d.startsOn), ends: date(d.endsOn), installation: date(d.installationOn),
    period: language === 'en' ? `from ${date(d.startsOn)} to ${date(d.endsOn, true)}` : `du ${date(d.startsOn)} au ${date(d.endsOn, true)}`,
    earlyDeadline: formatDate(d.earlyBirdEndsAt, tz, { inclusiveDeadline: true, language }),
    refundDeadline: formatDate(d.refundEndsAt, tz, { inclusiveDeadline: true, language }),
    refundDeadlineFull: formatDate(d.refundEndsAt, tz, { inclusiveDeadline: true, year: true, language }),
    artworkDeadline: date(d.artworkDueOn), artworkDeadlineFull: date(d.artworkDueOn, true),
    durationDays: Math.round((Date.parse(d.endsOn) - Date.parse(d.startsOn)) / 86400000) + 1,
  };
}
