import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { tenderPrice, topUp } = require('../../lib/tender.js');
const ledger = require('../../lib/ledger.js');
const policy = require('../../lib/policy.js');
const { HOUR } = require('../../lib/time.js');

const surcharge = { mode: 'card_surcharge', surchargePercent: 3 };
const cashDiscount = { mode: 'cash_discount', cashDiscountPercent: 3 };
const charge = (tender, rule) => tenderPrice({ baseCents: 15000, tender, rule }).chargeCents;

test('card surcharge mode: only credit cards pay more', () => {
  assert.deepEqual(tenderPrice({ baseCents: 15000, tender: 'credit_card', rule: surcharge }), {
    chargeCents: 15450,
    adjustmentCents: 450,
    kind: 'surcharge',
  });
  for (const tender of ['debit_card', 'prepaid_card', 'cash', 'zelle', 'ach', 'wallet']) {
    assert.equal(charge(tender, surcharge), 15000, tender);
  }
});

test('cash discount mode: cash, Zelle and ACH pay less; cards and wallet pay list', () => {
  for (const tender of ['cash', 'zelle', 'ach']) {
    assert.equal(charge(tender, cashDiscount), 14550, tender);
  }
  for (const tender of ['credit_card', 'debit_card', 'prepaid_card', 'wallet']) {
    assert.equal(charge(tender, cashDiscount), 15000, tender);
  }
});

test('bad tender or rule throws', () => {
  assert.throws(() => charge('bitcoin', surcharge), RangeError);
  assert.throws(() => charge('cash', { mode: 'x' }), RangeError);
  assert.throws(() => charge('cash', { mode: 'card_surcharge', surchargePercent: 25 }), RangeError);
});

test('top-up: the adjustment is never credit', () => {
  const card = topUp({ creditCents: 100000, tender: 'credit_card', rule: surcharge });
  assert.equal(card.chargeCents, 103000);
  assert.equal(card.creditCents, 100000);
  const cash = topUp({ creditCents: 100000, tender: 'cash', rule: cashDiscount });
  assert.equal(cash.chargeCents, 97000);
  assert.equal(cash.creditCents, 100000);
  assert.throws(
    () => topUp({ creditCents: 100000, tender: 'wallet', rule: surcharge }),
    RangeError,
  );
});

test('ledger: balance, signs, and credit never expires', () => {
  const old = [
    { type: 'top_up', amountCents: 100000, at: Date.UTC(2020, 0, 1) },
    { type: 'redemption', amountCents: -24000, at: Date.UTC(2021, 0, 1) },
  ];
  assert.equal(ledger.balanceCents(old), 76000);
  const bad = [
    { type: 'top_up', amountCents: -5 },
    { type: 'redemption', amountCents: 5 },
    { type: 'adjustment', amountCents: 5 },
    { type: 'top_up', amountCents: 1.5 },
    { type: 'expiry', amountCents: -5 },
  ];
  for (const entry of bad) assert.throws(() => ledger.validateEntry(entry), RangeError);
  assert.ok(ledger.validateEntry({ type: 'adjustment', amountCents: -5, reason: 'typo' }));
});

test('ledger: only fees go negative; negative balance blocks booking', () => {
  const entries = [{ type: 'top_up', amountCents: 10000 }];
  assert.equal(ledger.canDebit(entries, { type: 'redemption', amountCents: -10000 }), true);
  assert.equal(ledger.canDebit(entries, { type: 'redemption', amountCents: -10001 }), false);
  assert.equal(ledger.canDebit(entries, { type: 'refund_out', amountCents: -10001 }), false);
  assert.equal(ledger.canDebit(entries, { type: 'fee', amountCents: -20000 }), true);
  assert.equal(ledger.canBook([...entries, { type: 'fee', amountCents: -20000 }]), false);
  assert.equal(ledger.canBook(entries), true);
});

test('cancel policy: 24h boundary, courtesy, fee, no-show, staff', () => {
  const start = Date.UTC(2026, 11, 2, 0);
  const cancel = (nowMs, courtesyUsedInLastYear) =>
    policy.decideClientCancel({ startMs: start, finalCents: 15001, nowMs, courtesyUsedInLastYear });
  assert.deepEqual(cancel(start - 24 * HOUR, true), {
    allowed: true,
    late: false,
    courtesy: false,
    feeCents: 0,
  });
  const late = start - 24 * HOUR + 1;
  assert.equal(cancel(late, false).courtesy, true);
  assert.equal(cancel(late, false).feeCents, 0);
  assert.equal(cancel(late, true).feeCents, 7501);
  assert.equal(cancel(start, false).allowed, false);
  assert.equal(policy.decideNoShow({ finalCents: 15001 }).feeCents, 15001);
  assert.equal(policy.decideStaffCancel().feeCents, 0);
});
