// Cancellation policy (HANDOFF §5.3). Pure decisions; routes apply them in a transaction.

const { HOUR } = require('./time.js');
const { percentOf } = require('./pricing.js');

const FREE_CANCEL_HOURS = 24;
const LATE_FEE_PERCENT = 50;
const NO_SHOW_FEE_PERCENT = 100;

/**
 * Client cancels their own booking. Exactly 24 hours ahead is still free.
 * Inside 24 hours, one courtesy per rolling 12 months waives the fee.
 */
function decideClientCancel({ startMs, finalCents, nowMs, courtesyUsedInLastYear }) {
  if (nowMs >= startMs) return { allowed: false, reason: 'started' };
  const late = startMs - nowMs < FREE_CANCEL_HOURS * HOUR;
  if (!late) return { allowed: true, late: false, courtesy: false, feeCents: 0 };
  if (!courtesyUsedInLastYear) return { allowed: true, late: true, courtesy: true, feeCents: 0 };
  return {
    allowed: true,
    late: true,
    courtesy: false,
    feeCents: percentOf(finalCents, LATE_FEE_PERCENT),
  };
}

function decideNoShow({ finalCents }) {
  return { feeCents: percentOf(finalCents, NO_SHOW_FEE_PERCENT) };
}

/** Staff-initiated cancellations never charge the client. */
function decideStaffCancel() {
  return { allowed: true, feeCents: 0 };
}

module.exports = {
  FREE_CANCEL_HOURS,
  LATE_FEE_PERCENT,
  decideClientCancel,
  decideNoShow,
  decideStaffCancel,
};
