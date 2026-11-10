// Payment-method pricing (REFACTOR §9.4). Card payments carry processing fees; cash,
// Zelle and ACH don't, so they cost less. Which side carries the difference depends on
// what Helcim supports, so both modes exist and the studio config picks one:
//   card_surcharge: listed price is the cash price; credit cards pay a surcharge
//   cash_discount:  listed price is the card price; non-card tenders pay less
// The adjustment never becomes credit and never counts as a discount.

const { percentOf } = require('./pricing.js');

const CARD = ['credit_card', 'debit_card', 'prepaid_card'];
const NO_FEE = ['cash', 'zelle', 'ach'];
const TENDERS = [...CARD, ...NO_FEE, 'wallet'];

function checkRule(rule) {
  if (!rule || !['card_surcharge', 'cash_discount'].includes(rule.mode)) {
    throw new RangeError('tender rule mode must be card_surcharge or cash_discount');
  }
  const pct = rule.mode === 'card_surcharge' ? rule.surchargePercent : rule.cashDiscountPercent;
  if (typeof pct !== 'number' || pct < 0 || pct > 10) throw new RangeError('tender percent');
  return pct;
}

/**
 * What the client pays for `baseCents` with `tender`. Debit and prepaid cards are
 * never surcharged (card network rules). Paying from wallet credit has no
 * adjustment: it was applied when the credit was bought.
 */
function tenderPrice({ baseCents, tender, rule }) {
  if (!TENDERS.includes(tender)) throw new RangeError(`unknown tender ${tender}`);
  if (!Number.isInteger(baseCents) || baseCents < 0) throw new RangeError('baseCents');
  const pct = checkRule(rule);
  let adjustmentCents = 0;
  if (rule.mode === 'card_surcharge' && tender === 'credit_card') {
    adjustmentCents = percentOf(baseCents, pct);
  } else if (rule.mode === 'cash_discount' && NO_FEE.includes(tender)) {
    adjustmentCents = -percentOf(baseCents, pct);
  }
  return {
    chargeCents: baseCents + adjustmentCents,
    adjustmentCents,
    kind: adjustmentCents > 0 ? 'surcharge' : adjustmentCents < 0 ? 'cash_discount' : 'none',
  };
}

/** Buying wallet credit: the charge varies by tender, the credit doesn't. */
function topUp({ creditCents, tender, rule }) {
  if (tender === 'wallet') throw new RangeError('wallet credit cannot buy wallet credit');
  if (!Number.isInteger(creditCents) || creditCents <= 0) throw new RangeError('creditCents');
  const price = tenderPrice({ baseCents: creditCents, tender, rule });
  return { ...price, creditCents };
}

module.exports = { TENDERS, CARD, NO_FEE, tenderPrice, topUp };
