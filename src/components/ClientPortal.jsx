import { useState, useEffect } from 'react';
import { pb } from '../lib/pb.js';
import { formatPacific } from '../lib/time.js';
import { clientCanCancel, isCancelled, statusLabel } from '../lib/status.js';

export default function ClientPortal({ modalId }) {
  const handleClose = () => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  };
  const [step, setStep] = useState('email'); // email | otp | dashboard
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record?.collectionName === 'users') {
      setStep('dashboard');
      fetchBookings();
    }
  }, []);

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

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      // PocketBase answers requestOTP for an unknown email without sending anything,
      // so the account has to exist first. The password is never used (sign-in is by code)
      // but must match its confirmation.
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

      const res = await pb.collection('users').requestOTP(normalizedEmail);
      setOtpId(res.otpId);
      setStep('otp');
    } catch (err) {
      console.error('OTP request failed:', err);
      setError("We couldn't send a code. Check the address and try again.");
    } finally {
      setLoading(false);
    }
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

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await pb.collection('bookings').update(id, { status: 'cancelled_by_client' });
      fetchBookings();
    } catch {
      alert('Failed to cancel booking.');
    }
  };

  return (
    <div className="relative w-full max-w-2xl bg-[#090D16] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 id="portal-title" className="text-xl font-bold">
            Access Portal
          </h2>
          <p className="text-xs text-slate-400">View and manage your upcoming appointments.</p>
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
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#55CDFC] hover:bg-[#F7A8B8] text-black font-semibold rounded-xl text-sm transition cursor-pointer"
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
          <label htmlFor="portal-code" className="sr-only">
            Verification code
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
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#55CDFC] hover:bg-[#F7A8B8] text-black font-semibold rounded-xl text-sm transition cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
        </form>
      )}

      {step === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Signed in as {pb.authStore.record?.email}</span>
            <button
              onClick={() => {
                pb.authStore.clear();
                setStep('email');
              }}
              className="text-red-400 hover:underline cursor-pointer"
            >
              Sign Out
            </button>
          </div>

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
                        {clientCanCancel(b.status) && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded transition text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
