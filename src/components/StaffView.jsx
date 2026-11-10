import { useState } from 'react';
import { pb } from '../lib/pb.js';
import { formatPacific } from '../lib/time.js';
import { staffActions, statusLabel } from '../lib/status.js';

export default function StaffView() {
  const [bookings, setBookings] = useState([]);
  const [range, setRange] = useState('upcoming');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const now = Date.now();
  const filter = pb.filter(
    range === 'upcoming' ? `booking_date >= {:now}` : `booking_date < {:now}`,
    {
      now: new Date(now),
    },
  );

  const load = async () => {
    const sort = range === 'upcoming' ? 'booking_date' : '-booking_date';
    const records = await pb.collection('bookings').getFullList({ filter, sort });
    setBookings(records);
  };

  const handleAction = async (b, next) => {
    if (
      next === 'cancelled_by_admin' &&
      !confirm('Cancel this appointment? The client will need to rebook.')
    )
      return;
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

  return (
    <div>
      <div className="flex gap-2 mb-4" role="group" aria-label="Appointment range">
        <button
          type="button"
          aria-pressed={range === 'upcoming'}
          onClick={() => {
            setRange('upcoming');
            load();
          }}
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
          onClick={() => {
            setRange('past');
            load();
          }}
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
          (bookings.length === 0
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
            {bookings.map((b) => {
              const actions = staffActions(b.status);
              return (
                <tr key={b.id}>
                  <td className="py-4">{formatPacific(b.booking_date)}</td>
                  <td className="py-4">{b.customer_name}</td>
                  <td className="py-4">{b.customer_email}</td>
                  <td className="py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] ${
                        statusLabel(b.status) === 'Cancelled' ||
                        statusLabel(b.status) === 'Cancelled by studio'
                          ? 'bg-red-900/30 text-red-400 border border-red-800'
                          : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {actions.map((a) => (
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
                    ))}
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
