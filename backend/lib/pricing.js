// One discount engine for both instances (architecture §9.3). The cloud quotes with its
// sanitized snapshot, the studio prices checkout with full data; same inputs must give
// the same price, so this module stays pure. Money is integer cents.

const { HOUR, pacificParts } = require('./time.js');

const SCOPES = ['account', 'slot', 'site'];
const ELIGIBILITY = ['all', 'signed_in', 'sliding', 'first_visit'];

function percentOf(cents, percent) {
  return Math.round((cents * percent) / 100);
}

function isEligible(discount, client) {
  const signedIn = Boolean(client && client.id);
  if (discount.scope === 'account') {
    if (!signedIn || discount.clientId !== client.id) return false;
  }
  switch (discount.eligibility || 'all') {
    case 'all':
      return true;
    case 'signed_in':
      return signedIn;
    case 'sliding':
      return signedIn && Boolean(client.sliding);
    case 'first_visit':
      return signedIn && Boolean(client.firstVisit);
    default:
      return false;
  }
}

function matchesSlot(discount, slot, nowMs) {
  const local = pacificParts(slot.startMs);
  if (discount.withinHours != null) {
    const lead = slot.startMs - nowMs;
    if (lead <= 0 || lead > discount.withinHours * HOUR) return false;
  }
  if (discount.days && discount.days.length && !discount.days.includes(local.weekday)) return false;
  if (discount.startMinute != null && local.minuteOfDay < discount.startMinute) return false;
  if (discount.endMinute != null && local.minuteOfDay >= discount.endMinute) return false;
  if (
    discount.services &&
    discount.services.length &&
    !discount.services.includes(slot.serviceId)
  ) {
    return false;
  }
  if (discount.minutes && discount.minutes.length && !discount.minutes.includes(slot.minutes)) {
    return false;
  }
  return true;
}

function isActive(discount, nowMs) {
  if (discount.active === false) return false;
  if (discount.starts != null && nowMs < discount.starts) return false;
  if (discount.ends != null && nowMs >= discount.ends) return false;
  if (discount.limitTotal != null && (discount.usedCount || 0) >= discount.limitTotal) return false;
  return SCOPES.includes(discount.scope) && ELIGIBILITY.includes(discount.eligibility || 'all');
}

/**
 * The single best discount that applies. Nothing stacks. Ties go to the higher
 * percent, then the one ending sooner (so the client keeps the longer one for later),
 * then id for a stable result.
 */
function bestDiscount({ discounts, client, slot, nowMs, maxPercent = 100 }) {
  const candidates = (discounts || [])
    .filter((d) => d.percent > 0 && isActive(d, nowMs) && isEligible(d, client))
    .filter((d) => matchesSlot(d, slot, nowMs))
    .map((d) => ({ ...d, percent: Math.min(d.percent, maxPercent) }));
  candidates.sort(
    (a, b) =>
      b.percent - a.percent ||
      (a.ends ?? Infinity) - (b.ends ?? Infinity) ||
      String(a.id).localeCompare(String(b.id)),
  );
  return candidates[0] || null;
}

/**
 * Quote for one slot. `floorCents` keeps a large promotion from pricing a session below
 * cost. The tender adjustment (card surcharge or cash price) is applied after
 * this, in tender.js, and is not a discount.
 */
function quote({ listCents, discounts, client, slot, nowMs, maxPercent = 100, floorCents = 0 }) {
  if (!Number.isInteger(listCents) || listCents < 0) throw new RangeError('listCents');
  const discount = bestDiscount({ discounts, client, slot, nowMs, maxPercent });
  const percent = discount ? discount.percent : 0;
  const finalCents = Math.max(
    listCents - percentOf(listCents, percent),
    Math.min(floorCents, listCents),
  );
  return {
    listCents,
    finalCents,
    discountCents: listCents - finalCents,
    percent,
    discountId: discount ? discount.id : null,
    label: discount ? discount.label || null : null,
  };
}

module.exports = { bestDiscount, quote, percentOf };
