import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, getEvent } from '../config/catalog.mjs';
import { validateCatalog, computePrice, currentPhase, isValidScreens, bookingIsOpen, eventLabels } from '../shared/events.mjs';
const event = getEvent('chaucase-2027');
const early = Date.parse('2026-11-01T12:00:00-05:00');
const late = Date.parse('2026-12-16T00:00:00-05:00');

test('prix early bird de 1 à 10 écrans', () => {
  [599,1095,1590,2120,2650,3180,3710,4240,4770,5300].forEach((price, i) => assert.equal(computePrice(event, i + 1, early).totalCents, price * 100));
});
test('prix réguliers', () => {
  [795,1395,1950,2600,3250,3900,4550,5200,5850,6500].forEach((price, i) => assert.equal(computePrice(event, i + 1, late).totalCents, price * 100));
});
test('early bird couvre toute la minute 23 h 59 à Montréal', () => {
  assert.equal(currentPhase(event, Date.parse('2026-12-15T23:59:59-05:00')), 'early');
  assert.equal(currentPhase(event, Date.parse('2026-12-16T05:00:00Z')), 'regular');
});
test('quantités strictes', () => {
  for (const n of [0, -1, 11, 1.5, NaN, '2', null, true, []]) {
    assert.equal(isValidScreens(event, n), false);
    assert.throws(() => computePrice(event, n));
  }
});
test('aucune dépendance des prix au nom ChauCase', () => {
  const other = structuredClone(event);
  other.pricing.early.one = 40000;
  assert.equal(computePrice(other, 1, early).totalCents, 40000);
  assert.equal(computePrice(event, 1, early).totalCents, 59900);
});
test('dates affichées depuis les paramètres, échéances inclusives', () => {
  const labels = eventLabels(event, catalog.platform);
  assert.equal(labels.earlyDeadline, '15 décembre');
  assert.equal(labels.refundDeadlineFull, '15 janvier 2027');
  assert.equal(labels.artworkDeadlineFull, '29 janvier 2027');
  assert.equal(labels.durationDays, 3);
});
test('date explicite de fermeture ou début de location par défaut', () => {
  assert.equal(bookingIsOpen(event, early), true);
  assert.equal(bookingIsOpen(event, Date.parse(event.dates.rentalStartsAt)), false);
  const other = structuredClone(event); other.dates.bookingClosesAt = '2026-12-01T00:00:00-05:00';
  assert.equal(bookingIsOpen(other, Date.parse('2026-12-02T00:00:00-05:00')), false);
  other.active = false;
  assert.equal(bookingIsOpen(other, early), false);
});
test('validation rejette les configurations incohérentes', () => {
  const checks = [
    (c) => {c.events.push(c.events[0]);},
    (c) => {c.events[0].dates.startsOn = '2027-02-30';},
    (c) => {c.events[0].dates.rentalEndsAt = c.events[0].dates.rentalStartsAt;},
    (c) => {c.events[0].dates.rentalEndsAt = '2027-02-03T00:00:00-05:00';},
    (c) => {c.events[0].dates.earlyBirdEndsAt = 'sans-fuseau';},
    (c) => {c.events[0].pricing.early.one = -1;},
    (c) => {c.events[0].logo = 'javascript:alert(1)';},
  ];
  for (const change of checks) {const copy = structuredClone(catalog);change(copy);assert.throws(() => validateCatalog(copy));}
});
