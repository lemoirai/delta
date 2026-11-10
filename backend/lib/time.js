// Pacific time without Intl: PocketBase's JS engine has no Intl (verified on 0.40.6),
// so the US DST rule is computed directly. Valid for the rule in force since 2007.
// CommonJS so both PocketBase hooks (require) and Node tests (createRequire) load it.

const HOUR = 3600000;
const DAY = 24 * HOUR;
const PST = -8 * HOUR;
const PDT = -7 * HOUR;

function nthSundayUtc(year, month, n) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

// DST runs from 2:00 PST on the second Sunday of March (10:00 UTC)
// to 2:00 PDT on the first Sunday of November (09:00 UTC).
function dstBoundsUtc(year) {
  return {
    start: Date.UTC(year, 2, nthSundayUtc(year, 2, 2), 10),
    end: Date.UTC(year, 10, nthSundayUtc(year, 10, 1), 9),
  };
}

function isPacificDst(ms) {
  const year = new Date(ms + PST).getUTCFullYear();
  const { start, end } = dstBoundsUtc(year);
  return ms >= start && ms < end;
}

function pacificOffsetMs(ms) {
  return isPacificDst(ms) ? PDT : PST;
}

/** Pacific wall-clock parts of a UTC instant. weekday: 0 = Sunday. */
function pacificParts(ms) {
  const d = new Date(ms + pacificOffsetMs(ms));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
    date: d.toISOString().slice(0, 10),
  };
}

function parseDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new RangeError(`Expected YYYY-MM-DD, got ${dateStr}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * UTC ms for a Pacific wall-clock time. In the November overlap (1:00–1:59 happens
 * twice) this returns the first occurrence. Times inside the March gap don't exist
 * and throw, so a slot can never silently shift by an hour.
 */
function pacificToUtc(dateStr, hour, minute = 0) {
  const [y, mo, d] = parseDate(dateStr);
  const wall = Date.UTC(y, mo - 1, d, hour, minute);
  for (const offset of [PDT, PST]) {
    const ms = wall - offset;
    if (pacificOffsetMs(ms) === offset) return ms;
  }
  throw new RangeError(`${dateStr} ${hour}:${minute} doesn't exist in Pacific time`);
}

function addDays(dateStr, n) {
  const [y, mo, d] = parseDate(dateStr);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** UTC [start, end) of a Pacific calendar day. 23 or 25 hours on DST change days. */
function pacificDayRange(dateStr) {
  return { start: pacificToUtc(dateStr, 0), end: pacificToUtc(addDays(dateStr, 1), 0) };
}

/** PocketBase filter format: 'YYYY-MM-DD HH:MM:SS.sssZ'. */
function toPbDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ');
}

module.exports = {
  HOUR,
  DAY,
  isPacificDst,
  pacificOffsetMs,
  pacificParts,
  pacificToUtc,
  pacificDayRange,
  addDays,
  toPbDate,
};
