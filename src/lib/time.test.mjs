import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pacificToUtc, pacificDayRange, pacificParts, nextDate, formatPacific } from './time.js';

test('winter (PST, UTC-8): 4 PM Pacific is midnight UTC next day', () => {
  assert.equal(pacificToUtc('2026-12-01', 16).toISOString(), '2026-12-02T00:00:00.000Z');
});

test('summer (PDT, UTC-7): 4 PM Pacific is 23:00 UTC same day', () => {
  assert.equal(pacificToUtc('2026-07-01', 16).toISOString(), '2026-07-01T23:00:00.000Z');
});

test('DST start day (2026-03-08): 10 AM is PDT', () => {
  assert.equal(pacificToUtc('2026-03-08', 10).toISOString(), '2026-03-08T17:00:00.000Z');
});

test('DST end day (2026-11-01): 10 AM is PST', () => {
  assert.equal(pacificToUtc('2026-11-01', 10).toISOString(), '2026-11-01T18:00:00.000Z');
});

test('day range spans 23 h on DST start and 25 h on DST end', () => {
  const s = pacificDayRange('2026-03-08');
  assert.equal((s.end - s.start) / 3600000, 23);
  const e = pacificDayRange('2026-11-01');
  assert.equal((e.end - e.start) / 3600000, 25);
});

test('round trip: every business hour of every day in 2026', () => {
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 86400000) {
    const dateStr = new Date(ms).toISOString().slice(0, 10);
    for (const hour of [10, 12, 14, 16]) {
      const p = pacificParts(pacificToUtc(dateStr, hour));
      assert.equal(p.hour, hour, `${dateStr} ${hour}`);
      assert.equal(
        `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`,
        dateStr,
      );
    }
  }
});

test('nextDate crosses month and year ends', () => {
  assert.equal(nextDate('2026-12-31'), '2027-01-01');
  assert.equal(nextDate('2028-02-28'), '2028-02-29');
});

test('formatPacific shows Pacific regardless of host zone', () => {
  assert.match(formatPacific('2026-12-02T00:00:00.000Z'), /Dec 1, 2026.*4:00\s?PM PST/);
});
