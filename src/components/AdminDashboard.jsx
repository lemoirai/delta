import { useState, useEffect } from 'react';
import { pb } from '../lib/pb.js';

export default function AdminDashboard({ modalId }) {
  const handleClose = () => {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  };
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for valid superuser session across PocketBase versions
    if (
      pb.authStore.isValid &&
      (pb.authStore.isAdmin || pb.authStore.model?.collectionName === '_superusers')
    ) {
      setAuthenticated(true);
      loadAdminData();
    }
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Try admins API first (PocketBase v0.22+ standard), fallback to collection API if custom collection
      if (pb.admins) {
        await pb.admins.authWithPassword(email, password);
      } else {
        await pb.collection('_superusers').authWithPassword(email, password);
      }
      setAuthenticated(true);
      loadAdminData();
    } catch (err) {
      // Direct fallback attempt for legacy/custom setups
      try {
        await pb.collection('_superusers').authWithPassword(email, password);
        setAuthenticated(true);
        loadAdminData();
      } catch (fallbackErr) {
        console.error('Admin authentication failed:', fallbackErr);
        setError('Invalid operator credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const records = await pb.collection('bookings').getFullList({ sort: '-booking_date' });
      setBookings(records);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  const updateBookingStatus = async (id, status) => {
    try {
      await pb.collection('bookings').update(id, { status });
      loadAdminData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="relative w-full max-w-4xl bg-[#090D16] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white">
      {/* Modal Close Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold">Practice Staff Dashboard</h2>
          <p className="text-xs text-slate-400">Manage appointment requests and queue status.</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          type="button"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          &times;
        </button>
      </div>

      {!authenticated ? (
        <form onSubmit={handleAdminLogin} className="space-y-4 max-w-md mx-auto py-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Staff Email</label>
            <input
              type="email"
              required
              placeholder="admin@delta-aesthetics.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-[#030712] border border-slate-800 rounded-xl text-white focus:border-[#55CDFC] outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#030712] border border-slate-800 rounded-xl text-white focus:border-[#55CDFC] outline-none text-sm"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#55CDFC] hover:bg-[#F7A8B8] text-black font-semibold rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In as Staff'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Operator: {pb.authStore.model?.email || pb.authStore.admin?.email}</span>
            <button
              onClick={() => {
                pb.authStore.clear();
                setAuthenticated(false);
              }}
              type="button"
              className="text-red-400 hover:underline cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Booking Date</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-slate-500">
                      No bookings in queue.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="py-4 font-medium">{b.customer_name}</td>
                      <td className="py-4 text-slate-400">{b.customer_email}</td>
                      <td className="py-4">{new Date(b.booking_date).toLocaleString()}</td>
                      <td className="py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] ${
                            b.status === 'cancelled'
                              ? 'bg-red-900/30 text-red-400 border border-red-800'
                              : b.status === 'confirmed'
                                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                                : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                          }`}
                        >
                          {b.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-4 text-right space-x-2">
                        {b.status !== 'confirmed' && (
                          <button
                            onClick={() => updateBookingStatus(b.id, 'confirmed')}
                            type="button"
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] cursor-pointer"
                          >
                            Confirm
                          </button>
                        )}
                        {b.status !== 'cancelled' && (
                          <button
                            onClick={() => updateBookingStatus(b.id, 'cancelled')}
                            type="button"
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] cursor-pointer"
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
