// All business times are Pacific. Store UTC, display Pacific.
export const BUSINESS_TZ = 'America/Los_Angeles';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Wall-clock parts of `date` in Pacific time. */
export function pacificParts(date) {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

// Pacific offset from UTC in ms at `ms` (negative: -7h in summer, -8h in winter).
function offsetAt(ms) {
  const p = pacificParts(new Date(ms));
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return wallAsUtc - Math.floor(ms / 60000) * 60000;
}

/**
 * UTC Date for a Pacific wall-clock time. `dateStr` is 'YYYY-MM-DD'.
 * Second pass corrects the offset when the first guess lands across a DST change.
 */
export function pacificToUtc(dateStr, hour, minute = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute);
  let ms = wallAsUtc - offsetAt(wallAsUtc);
  ms = wallAsUtc - offsetAt(ms);
  return new Date(ms);
}

/** 'YYYY-MM-DD' of the calendar day after `dateStr`. */
export function nextDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** UTC [start, end) covering the Pacific calendar day `dateStr`. */
export function pacificDayRange(dateStr) {
  return { start: pacificToUtc(dateStr, 0), end: pacificToUtc(nextDate(dateStr), 0) };
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

/** Human-readable Pacific date and time, e.g. "Tue, Dec 1, 2026, 4:00 PM PST". */
export function formatPacific(value) {
  return displayFormatter.format(new Date(value));
}
