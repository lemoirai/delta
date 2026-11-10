import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const t = require('../../lib/time.js');

const intlParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function viaIntl(ms) {
  const p = Object.fromEntries(intlParts.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute };
}

test('pacificParts matches Intl every 30 minutes across 2026-2028', () => {
  const start = Date.UTC(2026, 0, 1);
  const end = Date.UTC(2029, 0, 1);
  for (let ms = start; ms < end; ms += 30 * 60000) {
    const { year, month, day, hour, minute } = t.pacificParts(ms);
    assert.deepEqual({ year, month, day, hour, minute }, viaIntl(ms), new Date(ms).toISOString());
  }
});

test('pacificToUtc round-trips business hours on every day of 2026-2028', () => {
  for (let d = '2026-01-01'; d < '2029-01-01'; d = t.addDays(d, 1)) {
    for (const hour of [9, 10, 12, 14, 16, 18]) {
      const p = t.pacificParts(t.pacificToUtc(d, hour));
      assert.equal(p.date, d);
      assert.equal(p.hour, hour);
    }
  }
});

test('winter 4 PM is midnight UTC the next day', () => {
  assert.equal(
    new Date(t.pacificToUtc('2026-12-01', 16)).toISOString(),
    '2026-12-02T00:00:00.000Z',
  );
});

test('DST change days', () => {
  const iso = (ms) => new Date(ms).toISOString();
  assert.equal(iso(t.pacificToUtc('2026-03-08', 1)), '2026-03-08T09:00:00.000Z');
  assert.equal(iso(t.pacificToUtc('2026-03-08', 3)), '2026-03-08T10:00:00.000Z');
  assert.throws(() => t.pacificToUtc('2026-03-08', 2, 30), RangeError);
  // 1:30 happens twice on 2026-11-01; the first (PDT) one is returned
  assert.equal(iso(t.pacificToUtc('2026-11-01', 1, 30)), '2026-11-01T08:30:00.000Z');
  const spring = t.pacificDayRange('2026-03-08');
  const fall = t.pacificDayRange('2026-11-01');
  assert.equal((spring.end - spring.start) / t.HOUR, 23);
  assert.equal((fall.end - fall.start) / t.HOUR, 25);
});

test('weekday and PocketBase date format', () => {
  assert.equal(t.pacificParts(t.pacificToUtc('2026-11-09', 10)).weekday, 1);
  assert.equal(t.toPbDate(Date.UTC(2026, 10, 9, 19)), '2026-11-09 19:00:00.000Z');
  assert.throws(() => t.pacificToUtc('11/09/2026', 10), RangeError);
});
