import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { quote, bestDiscount } = require('../../lib/pricing.js');
const { pacificToUtc, HOUR } = require('../../lib/time.js');

const now = pacificToUtc('2026-11-09', 9);
// Thursday 2 PM Pacific, about 77 hours after `now`
const slot = { startMs: pacificToUtc('2026-11-12', 14), serviceId: 'svc1', minutes: 120 };
const alice = { id: 'C-ALICE1', sliding: true, firstVisit: false };
const bob = { id: 'C-BOB002' };
const d = (over) => ({ percent: 10, scope: 'site', eligibility: 'all', active: true, ...over });
const best = (discounts, client = null, s = slot) =>
  bestDiscount({ discounts, client, slot: s, nowMs: now });

test('no discounts gives list price', () => {
  assert.deepEqual(quote({ listCents: 24000, discounts: [], client: null, slot, nowMs: now }), {
    listCents: 24000,
    finalCents: 24000,
    discountCents: 0,
    percent: 0,
    discountId: null,
    label: null,
  });
});

test('best single discount wins; nothing stacks', () => {
  const discounts = [
    d({ id: 'a', percent: 10 }),
    d({ id: 'b', percent: 15 }),
    d({ id: 'c', percent: 5 }),
  ];
  const q = quote({ listCents: 24000, discounts, client: alice, slot, nowMs: now });
  assert.equal(q.discountId, 'b');
  assert.equal(q.finalCents, 20400);
});

test('tie: higher percent, then ending sooner, then id', () => {
  const late = d({ id: 'x', percent: 20, ends: now + 30 * 24 * HOUR });
  const soon = d({ id: 'y', percent: 20, ends: now + 2 * 24 * HOUR });
  const open = d({ id: 'z', percent: 20 });
  assert.equal(best([late, open, soon]).id, 'y');
  assert.equal(best([open, d({ id: 'w', percent: 20 })]).id, 'w');
});

test('account discounts only for their own signed-in client', () => {
  const rate = d({
    id: 'rate',
    percent: 25,
    scope: 'account',
    clientId: alice.id,
    label: 'Your rate',
  });
  const q = (client) => quote({ listCents: 10000, discounts: [rate], client, slot, nowMs: now });
  assert.equal(q(null).percent, 0);
  assert.equal(q(bob).percent, 0);
  assert.equal(q(alice).finalCents, 7500);
  assert.equal(q(alice).label, 'Your rate');
});

test('eligibility needs a signed-in client who qualifies', () => {
  const community = d({ id: 'c', percent: 30, scope: 'slot', eligibility: 'sliding' });
  const first = d({ id: 'f', percent: 15, eligibility: 'first_visit' });
  const member = d({ id: 's', percent: 5, eligibility: 'signed_in' });
  assert.equal(best([community]), null);
  assert.equal(best([community], bob), null);
  assert.equal(best([community], alice).id, 'c');
  assert.equal(best([first], alice), null);
  assert.equal(best([first], { id: 'n', firstVisit: true }).id, 'f');
  assert.equal(best([member]), null);
  assert.equal(best([member], bob).id, 's');
});

test('dates, active flag, stock and unknown values', () => {
  const nope = [
    d({ id: 'future', starts: now + HOUR }),
    d({ id: 'ended', ends: now }),
    d({ id: 'off', active: false }),
    d({ id: 'soldout', limitTotal: 5, usedCount: 5 }),
    d({ id: 'badscope', scope: 'galaxy' }),
    d({ id: 'badelig', eligibility: 'vip' }),
    d({ id: 'zero', percent: 0 }),
  ];
  assert.equal(best(nope, alice), null);
  assert.equal(best([d({ id: 'left', limitTotal: 5, usedCount: 4 })]).id, 'left');
});

test('slot rules: within hours, weekdays, minute range, service, length', () => {
  const at = (over) => best([d({ id: 'r', ...over })]);
  assert.equal(at({ withinHours: 48 }), null);
  assert.ok(at({ withinHours: 96 }));
  assert.ok(at({ days: [4] }));
  assert.equal(at({ days: [1, 2] }), null);
  assert.ok(at({ startMinute: 12 * 60, endMinute: 15 * 60 }));
  assert.equal(at({ startMinute: 15 * 60 }), null);
  assert.equal(at({ endMinute: 14 * 60 }), null);
  assert.ok(at({ services: ['svc1'] }));
  assert.equal(at({ services: ['svc2'] }), null);
  assert.equal(at({ minutes: [60, 90] }), null);
  const past = { ...slot, startMs: now - HOUR };
  assert.equal(best([d({ id: 'p', withinHours: 48 })], null, past), null);
});

test('percent cap, floor and rounding', () => {
  const big = d({ id: 'big', percent: 80 });
  const q = (over) =>
    quote({ listCents: 10000, discounts: [big], client: null, slot, nowMs: now, ...over });
  assert.equal(q({ maxPercent: 50 }).finalCents, 5000);
  assert.equal(q({ floorCents: 4000 }).finalCents, 4000);
  assert.equal(q({ floorCents: 20000 }).finalCents, 10000);
  const odd = quote({
    listCents: 9999,
    discounts: [d({ id: 'r', percent: 15 })],
    client: null,
    slot,
    nowMs: now,
  });
  assert.equal(odd.finalCents, 8499);
  assert.throws(() => quote({ listCents: 10.5, discounts: [], slot, nowMs: now }), RangeError);
});
