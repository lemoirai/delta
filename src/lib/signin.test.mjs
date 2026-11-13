import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEND_COOLDOWN_SECONDS, resendLabel, otpIdFrom } from './signin.js';

test('RESEND_COOLDOWN_SECONDS is 30', () => {
  assert.equal(RESEND_COOLDOWN_SECONDS, 30);
});

test('resendLabel counts down from the seconds left', () => {
  assert.equal(resendLabel(30), 'Resend code (30 s)');
  assert.equal(resendLabel(25), 'Resend code (25 s)');
  assert.equal(resendLabel(1), 'Resend code (1 s)');
});

test('otpIdFrom returns the otpId string from a PocketBase response', () => {
  assert.equal(otpIdFrom({ otpId: 'abc-123' }), 'abc-123');
  assert.equal(otpIdFrom({ otpId: 'xyz', extra: true }), 'xyz');
});

test('otpIdFrom throws when there is no otpId to use', () => {
  assert.throws(() => otpIdFrom({}), /No otpId/);
  assert.throws(() => otpIdFrom(null), /No otpId/);
  assert.throws(() => otpIdFrom({ otpId: '' }), /No otpId/);
});
