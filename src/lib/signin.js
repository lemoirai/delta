// Pure helpers for the client sign-in flow. No PocketBase import here: this module
// is imported by the unit tests, and pb.js throws when `import.meta.env` is absent
// (plain node). The countdown label is the only thing the test needs to lock down.

/** Seconds the "Resend code" button stays disabled after a code is sent. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** Label for the resend button while the cooldown is running. */
export function resendLabel(secondsLeft) {
  return `Resend code (${secondsLeft} s)`;
}

/**
 * Extract the one-time-code id from a PocketBase requestOTP response.
 *
 * requestOTP returns the whole response object ({ otpId: '...' }), not the id
 * string, so this unwraps it. Throws if there is no otpId to use, which is what
 * turns a missing id into a visible error instead of a silent sign-in failure.
 */
export function otpIdFrom(response) {
  if (!response || typeof response !== 'object' || !response.otpId) {
    throw new Error('No otpId in requestOTP response.');
  }
  return response.otpId;
}
