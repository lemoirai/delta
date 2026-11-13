import { useState, useEffect, useRef } from 'react';
import { pb } from '../lib/pb.js';
import { formatPacific } from '../lib/time.js';
import { clientCanCancel, isCancelled, statusLabel } from '../lib/status.js';
import { resendLabel, RESEND_COOLDOWN_SECONDS, otpIdFrom } from '../lib/signin.js';
import StaffView from './StaffView.jsx';

export default function ClientPortal({ modalId }) {
  const handleClose = () => {
    document.getElementById(modalId)?.close();
  };
  const [step, setStep] = useState('email'); // email | otp | dashboard
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState(RESEND_COOLDOWN_SECONDS);
  // Inline cancel confirmation: the row being asked about, a failure shown under it,
  // and whether the request is in flight.
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record?.collectionName === 'users') {
      setStep('dashboard');
      fetchBookings();
    }
  }, []);

  // Keyboard and screen-reader users land on the field the new step needs. Skipped on
  // first render so loading the page doesn't move focus.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step === 'otp') document.getElementById('portal-code')?.focus();
    if (step === 'email') document.getElementById('portal-email')?.focus();
  }, [step]);

  const fetchBookings = async () => {
    try {
      const records = await pb.collection('bookings').getFullList({
        filter: pb.filter('customer_email = {:email}', { email: pb.authStore.record?.email ?? '' }),
        sort: '-booking_date',
      });
      setBookings(records);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  };

  // PocketBase answers requestOTP for an unknown email without sending anything, so the
  // account has to exist first. The password is never used (sign-in is by code) but must
  // match its confirmation.
  const requestOtp = async (address) => {
    const normalizedEmail = address.trim().toLowerCase();
    const tempPassword = crypto.randomUUID() + 'A1!';
    try {
      await pb.collection('users').create({
        email: normalizedEmail,
        emailVisibility: true,
        password: tempPassword,
        passwordConfirm: tempPassword,
      });
    } catch {
      // Returning clients already have an account.
    }
    return pb.collection('users').requestOTP(normalizedEmail);
  };

  // Used for the first code and for "Resend code" (resend = true); only a resend says
  // "We sent a new code.", since the first one is announced by the step change.
  const handleRequestOTP = async (e, resend = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setOtpCode('');
    try {
      const response = await requestOtp(email);
      setOtpId(otpIdFrom(response));
      setStep('otp');
      setRemaining(RESEND_COOLDOWN_SECONDS);
      if (resend) setMessage('We sent a new code.');
    } catch (err) {
      console.error('OTP request failed:', err);
      setError("We couldn't send a code. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Back to the email step to fix a mistyped address; the typed email is kept.
  const handleDifferentEmail = () => {
    setStep('email');
    setOtpCode('');
    setOtpId('');
    setError('');
    setMessage('');
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await pb.collection('users').authWithOTP(otpId, otpCode);
      setStep('dashboard');
      fetchBookings();
    } catch (err) {
      console.error('OTP verify failed:', err);
      setError('Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend cooldown, so the button can't be used to flood someone's inbox.
  useEffect(() => {
    if (step !== 'otp' || !otpId || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [step, otpId, remaining]);

  const startCancel = (id) => {
    setConfirmingId(id);
    setCancelError('');
  };

  // Backing out sends nothing, so the row is exactly as it was.
  const keepBooking = () => {
    if (cancelBusy) return;
    setConfirmingId(null);
    setCancelError('');
  };

  const confirmCancel = async (id) => {
    setCancelBusy(true);
    setCancelError('');
    try {
      await pb.collection('bookings').update(id, { status: 'cancelled_by_client' });
      setConfirmingId(null);
      await fetchBookings();
    } catch (err) {
      // The row stays in its confirming state so the message shows under it and the
      // person can retry or keep the booking.
      console.error('Failed to cancel booking:', err);
      setCancelError("We couldn't cancel that appointment. Please try again.");
    } finally {
      setCancelBusy(false);
    }
  };

  // Escape backs out of the row's question. preventDefault stops the same keypress from
  // also closing the portal dialog.
  useEffect(() => {
    if (!confirmingId) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      keepBooking();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  // Display only: the API rules enforce what staff can do, so a tampered role here
  // shows buttons that the server refuses. Check for 'staff', never for "not client".
  const isStaff = step === 'dashboard' && pb.authStore.record?.role === 'staff';

  return (
    <div
      className={`relative w-full ${isStaff ? 'max-w-5xl' : 'max-w-2xl'} bg-[#090D16] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white`}
    >
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 id="portal-title" className="text-xl font-bold">
            Access Portal
          </h2>
          <p className="text-xs text-slate-400">
            {isStaff
              ? 'Review and manage the booking queue.'
              : 'View and manage your upcoming appointments.'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          &times;
        </button>
      </div>

      {step === 'email' && (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <label htmlFor="portal-email" className="block text-xs font-semibold text-slate-300">
            Email Address
          </label>
          <input
            id="portal-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-[#030712] border border-slate-800 rounded-xl text-white focus:border-[#55CDFC] outline-none text-sm"
          />
          {error && (
            <p role="alert" className="text-red-400 text-xs">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#55CDFC] hover:bg-[#F7A8B8] text-black font-semibold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Sending Code...' : 'Send Access Code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <p className="text-xs text-slate-400">
            Verification code sent to <span className="text-[#55CDFC]">{email}</span>.
          </p>
          <label htmlFor="portal-code" className="block text-xs font-semibold text-slate-300">
            Code from your email
          </label>
          <input
            id="portal-code"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            placeholder="123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="w-full p-3 text-center tracking-widest text-lg bg-[#030712] border border-slate-800 rounded-xl text-white focus:border-[#55CDFC] outline-none"
          />
          {error && (
            <p role="alert" className="text-red-400 text-xs">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-[#55CDFC] text-xs">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#55CDFC] hover:bg-[#F7A8B8] text-black font-semibold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDifferentEmail}
              className="py-3 border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl text-sm transition cursor-pointer"
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={(e) => handleRequestOTP(e, true)}
              disabled={loading || remaining > 0}
              className="py-3 border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {remaining > 0 ? resendLabel(remaining) : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Signed in as {pb.authStore.record?.email}</span>
            <button
              type="button"
              onClick={() => {
                pb.authStore.clear();
                setStep('email');
              }}
              className="text-red-400 hover:underline cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {isStaff ? (
            <StaffView />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="pb-3">Date & Time</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-4 text-center text-slate-500">
                        No active bookings found.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="py-4">{formatPacific(b.booking_date)}</td>
                        <td className="py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] ${
                              isCancelled(b.status)
                                ? 'bg-red-900/30 text-red-400 border border-red-800'
                                : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {statusLabel(b.status)}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {confirmingId === b.id ? (
                            <div className="space-y-2">
                              <p className="text-[11px] font-medium text-slate-300">
                                Cancel this appointment?
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={keepBooking}
                                  disabled={cancelBusy}
                                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 rounded transition text-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Keep it
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmCancel(b.id)}
                                  disabled={cancelBusy}
                                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white font-semibold border border-red-500 rounded transition text-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Yes, cancel it
                                </button>
                              </div>
                              {cancelError && (
                                <p role="alert" className="text-red-400 text-xs">
                                  {cancelError}
                                </p>
                              )}
                            </div>
                          ) : (
                            clientCanCancel(b.status) && (
                              <button
                                type="button"
                                onClick={() => startCancel(b.id)}
                                className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded transition text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
