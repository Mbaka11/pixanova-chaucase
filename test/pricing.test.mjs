import test from 'node:test';
import assert from 'node:assert/strict';
import { computePrice, currentPhase, isValidScreens } from '../server/lib/pricing.mjs';

const EARLY = Date.parse('2026-11-01T12:00:00-05:00');
const LATE = Date.parse('2026-12-16T00:00:00-05:00');

test('prix early bird', () => {
  const dollars = (n) => computePrice(n, EARLY).totalCents / 100;
  assert.equal(dollars(1), 599);
  assert.equal(dollars(2), 1095);
  assert.equal(dollars(3), 1590);
  assert.equal(dollars(4), 2120);
  assert.equal(dollars(10), 5300);
});

test('prix régulier', () => {
  const dollars = (n) => computePrice(n, LATE).totalCents / 100;
  assert.equal(dollars(1), 795);
  assert.equal(dollars(2), 1395);
  assert.equal(dollars(3), 1950);
  assert.equal(dollars(4), 2600);
  assert.equal(dollars(10), 6500);
});

test('bascule le 15 décembre à 23 h 59, heure de Montréal', () => {
  assert.equal(currentPhase(Date.parse('2026-12-15T23:58:59-05:00')), 'early');
  assert.equal(currentPhase(Date.parse('2026-12-15T23:59:00-05:00')), 'early');
  assert.equal(currentPhase(Date.parse('2026-12-15T23:59:01-05:00')), 'regular');
  assert.equal(currentPhase(Date.parse('2026-12-16T04:59:01Z')), 'regular');
});

test('quantités invalides refusées', () => {
  for (const n of [0, -1, 11, 1.5, NaN, '2', null]) {
    assert.equal(isValidScreens(n), false, String(n));
    assert.throws(() => computePrice(n, EARLY));
  }
});
