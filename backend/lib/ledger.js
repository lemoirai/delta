// Wallet ledger rules (studio instance). Append-only; the balance is always computed.
// Paid credit never expires (RCW 19.240), so nothing here looks at entry dates.

const SIGN = {
  top_up: 1, // client bought credit; amount is the credit, never the surcharge
  gift_redeem: 1,
  goodwill: 1, // goodwill is dollar credit, not a discount (REFACTOR §9.3)
  redemption: -1, // credit spent on a session
  fee: -1, // late-cancel or no-show fee; may take the balance below zero
  refund_out: -1, // remaining credit paid back to the client
  adjustment: 0, // either sign, staff with a reason
};

function validateEntry(entry) {
  const sign = SIGN[entry.type];
  if (sign === undefined) throw new RangeError(`unknown ledger type ${entry.type}`);
  if (!Number.isInteger(entry.amountCents) || entry.amountCents === 0) {
    throw new RangeError('amountCents must be a non-zero integer');
  }
  if (sign !== 0 && Math.sign(entry.amountCents) !== sign) {
    throw new RangeError(`${entry.type} must be ${sign > 0 ? 'positive' : 'negative'}`);
  }
  if (entry.type === 'adjustment' && !entry.reason)
    throw new RangeError('adjustment needs a reason');
  return entry;
}

function balanceCents(entries) {
  return (entries || []).reduce((sum, e) => sum + validateEntry(e).amountCents, 0);
}

/**
 * Only fees may push a balance negative. Redemptions and refunds can't spend
 * credit the client doesn't have.
 */
function canDebit(entries, entry) {
  validateEntry(entry);
  if (entry.type === 'fee' || entry.amountCents > 0) return true;
  return balanceCents(entries) + entry.amountCents >= 0;
}

/** A client who owes money books again only after staff settle it (HANDOFF §5.3). */
function canBook(entries) {
  return balanceCents(entries) >= 0;
}

module.exports = { SIGN, validateEntry, balanceCents, canDebit, canBook };
