import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCELLED_STATUSES,
  isCancelled,
  notCancelledFilter,
  statusLabel,
  clientCanCancel,
  staffActions,
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

test('staffActions: pending', () => {
  assert.deepEqual(staffActions('pending'), [
    { label: 'Confirm', next: 'confirmed' },
    { label: 'Cancel', next: 'cancelled_by_admin' },
  ]);
});

test('staffActions: confirmed', () => {
  assert.deepEqual(staffActions('confirmed'), [
    { label: 'Mark completed', next: 'completed' },
    { label: 'Cancel', next: 'cancelled_by_admin' },
  ]);
});

test('staffActions: reschedule_requested', () => {
  assert.deepEqual(staffActions('reschedule_requested'), [
    { label: 'Cancel', next: 'cancelled_by_admin' },
  ]);
});

test('staffActions: rescheduled', () => {
  assert.deepEqual(staffActions('rescheduled'), [
    { label: 'Confirm', next: 'confirmed' },
    { label: 'Cancel', next: 'cancelled_by_admin' },
  ]);
});

test('staffActions: finished and cancelled bookings have no actions', () => {
  assert.deepEqual(staffActions('completed'), []);
  assert.deepEqual(staffActions('cancelled_by_client'), []);
  assert.deepEqual(staffActions('cancelled_by_admin'), []);
});

test('staffActions: unknown or empty status is treated as pending', () => {
  assert.deepEqual(staffActions('no_show'), staffActions('pending'));
  assert.deepEqual(staffActions(''), staffActions('pending'));
  assert.deepEqual(staffActions(undefined), staffActions('pending'));
});
