import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pb.js';
import { formatPacific } from '../lib/time.js';
import { isCancelled, staffActions, statusLabel } from '../lib/status.js';

export default function StaffView() {
  const [bookings, setBookings] = useState(null);
  const [range, setRange] = useState('upcoming');
  const [busyId, setBusyId] = useState('');
  const [confirmingId, setConfirmingId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const upcoming = range === 'upcoming';
    const filter = pb.filter(upcoming ? 'booking_date >= {:now}' : 'booking_date < {:now}', {
      now: new Date(),
    });
    const sort = upcoming ? 'booking_date' : '-booking_date';
    try {
      setBookings(await pb.collection('bookings').getFullList({ filter, sort }));
    } catch (err) {
      console.error(err);
      setMessage("Appointments didn't load. Refresh and try again.");
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // Cancelling asks first, inline on the row (one row at a time); backing out sends nothing.
  const finishCancel = async (b) => {
    setBusyId(b.id);
    try {
      await pb.collection('bookings').update(b.id, { status: 'cancelled_by_admin' });
      await load();
    } catch (err) {
      console.error(err);
      setMessage("That didn't save. Refresh and try again.");
    } finally {
      setBusyId('');
      setConfirmingId('');
    }
  };

  const keepIt = useCallback(() => {
    setConfirmingId('');
  }, []);

  const handleAction = async (b, next) => {
    if (next === 'cancelled_by_admin') {
      setConfirmingId(b.id);
      return;
    }
    setBusyId(b.id);
    try {
      await pb.collection('bookings').update(b.id, { status: next });
      await load();
    } catch (err) {
      console.error(err);
      setMessage("That didn't save. Refresh and try again.");
    } finally {
      setBusyId('');
    }
  };

  // Escape backs out of the row's question. preventDefault stops the same keypress from
  // also closing the portal dialog.
  useEffect(() => {
    if (!confirmingId) return;
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (!busyId) keepIt();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmingId, busyId, keepIt]);

  return (
    <div>
      <div className="flex gap-2 mb-4" role="group" aria-label="Appointment range">
        <button
          type="button"
          aria-pressed={range === 'upcoming'}
          onClick={() => setRange('upcoming')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            range === 'upcoming'
              ? 'bg-[#55CDFC] text-black'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          aria-pressed={range === 'past'}
          onClick={() => setRange('past')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            range === 'past'
              ? 'bg-[#55CDFC] text-black'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Past
        </button>
      </div>

      <p role="status" aria-live="polite" className="mb-4 text-xs text-slate-400">
        {message ||
          (bookings === null
            ? 'Loading…'
            : bookings.length === 0
              ? 'No appointments in this range.'
              : `${bookings.length} appointment(s).`)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="pb-3">Date & Time</th>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {(bookings ?? []).map((b) => {
              const actions = staffActions(b.status);
              const isConfirming = confirmingId === b.id;
              return (
                <tr key={b.id} className={isConfirming ? 'bg-red-500/10' : ''}>
                  <td className="py-4">{formatPacific(b.booking_date)}</td>
                  <td className="py-4">{b.customer_name}</td>
                  <td className="py-4">{b.customer_email}</td>
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
                    {isConfirming ? (
                      <div
                        className="flex items-center justify-end gap-3"
                        role="group"
                        aria-label="Confirm cancellation"
                      >
                        <p className="text-slate-300 pr-2">
                          Cancel this appointment? The client will need to rebook.
                        </p>
                        <button
                          type="button"
                          onClick={keepIt}
                          disabled={busyId === b.id}
                          className="px-3 py-1 rounded transition text-[10px] cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700"
                        >
                          Keep it
                        </button>
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => finishCancel(b)}
                          className="px-3 py-1 rounded transition text-[10px] cursor-pointer bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          Yes, cancel it
                        </button>
                      </div>
                    ) : (
                      actions.map((a) => (
                        <button
                          key={a.next}
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => handleAction(b, a.next)}
                          className={`px-3 py-1 rounded transition text-[10px] cursor-pointer ${
                            a.next === 'cancelled_by_admin'
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                        >
                          {a.label}
                        </button>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
