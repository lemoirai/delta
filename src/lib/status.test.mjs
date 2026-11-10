import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCELLED_STATUSES,
  isCancelled,
  notCancelledFilter,
  statusLabel,
  clientCanCancel,
} from './status.js';

test('cancelled values match the production slot index', () => {
  assert.deepEqual(CANCELLED_STATUSES, ['cancelled', 'cancelled_by_client', 'cancelled_by_admin']);
  assert.equal(
    notCancelledFilter(),
    "status != 'cancelled' && status != 'cancelled_by_client' && status != 'cancelled_by_admin'",
  );
});

test('isCancelled and clientCanCancel', () => {
  for (const s of CANCELLED_STATUSES) {
    assert.equal(isCancelled(s), true);
    assert.equal(clientCanCancel(s), false);
  }
  for (const s of ['pending', 'confirmed', 'reschedule_requested', 'rescheduled']) {
    assert.equal(isCancelled(s), false);
    assert.equal(clientCanCancel(s), true);
  }
  assert.equal(clientCanCancel('completed'), false);
});

test('labels; empty or unknown status reads as pending', () => {
  assert.equal(statusLabel('cancelled_by_admin'), 'Cancelled by studio');
  assert.equal(statusLabel(''), 'Pending');
  assert.equal(statusLabel(undefined), 'Pending');
});
