import { useRef, useState } from 'react';
import { pb } from '../lib/pb.js';
import { pacificDayRange, pacificParts, pacificToUtc } from '../lib/time.js';
import { notCancelledFilter } from '../lib/status.js';

const STANDARD_HOURS = [10, 12, 14, 16];

export default function BookingForm() {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [status, setStatus] = useState({ text: '', kind: 'success' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptsShortNotice, setAcceptsShortNotice] = useState(false);
  const [noticeValue, setNoticeValue] = useState(2);
  const [noticeUnit, setNoticeUnit] = useState('hours');

  const clearStatus = () => {
    setStatus({ text: '', kind: 'success' });
  };

  const fetchSlotsForDate = async (chosenDate) => {
    if (!chosenDate) return;
    setLoading(true);
    try {
      const { start, end } = pacificDayRange(chosenDate);
      const existingBookings = await pb.collection('bookings').getFullList({
        filter: pb.filter(
          `booking_date >= {:start} && booking_date < {:end} && ${notCancelledFilter()}`,
          { start, end },
        ),
      });
      const bookedHours = existingBookings.map((b) => pacificParts(new Date(b.booking_date)).hour);

      const slotData = STANDARD_HOURS.map((hour) => {
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const slotDate = pacificToUtc(chosenDate, hour);

        return {
          hour,
          label: `${displayHour}:00 ${ampm}`,
          isTaken: bookedHours.includes(hour),
          isoString: slotDate.toISOString(),
        };
      });

      setSlots(slotData);
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    clearStatus();
    const chosenDate = e.target.value;
    setDate(chosenDate);
    setSelectedSlot('');
    fetchSlotsForDate(chosenDate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    clearStatus();
    if (!selectedSlot) {
      setStatus({ text: 'Please select an available time slot.', kind: 'error' });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const noticeHours = acceptsShortNotice
      ? noticeUnit === 'days'
        ? noticeValue * 24
        : noticeValue
      : 0;

    const payload = {
      customer_name: name.trim(),
      customer_email: email.trim().toLowerCase(),
      booking_date: selectedSlot,
      status: 'pending',
      accepts_short_notice: acceptsShortNotice,
      notice_lead_time: noticeHours,
    };

    try {
      await pb.collection('bookings').create(payload);
      setStatus({
        text: 'Booking request received! We will confirm your slot shortly.',
        kind: 'success',
      });
      setName('');
      setEmail('');
      setSelectedSlot('');
      setAcceptsShortNotice(false);
      await fetchSlotsForDate(date);
    } catch (err) {
      console.error('Full submission error details:', err);
      if (err.response) {
        console.error('PocketBase validation errors:', JSON.stringify(err.response.data, null, 2));
      }

      if (err.response?.data?.booking_date?.code === 'validation_not_unique') {
        setStatus({
          text: 'This time slot was just taken. Please choose another window.',
          kind: 'error',
        });
        await fetchSlotsForDate(date);
      } else {
        setStatus({
          text:
            'Could not submit booking request: ' +
            (err.message || 'Check console for validation details.'),
          kind: 'error',
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="booking-name"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
          >
            Name you&rsquo;d like us to use
          </label>
          <input
            id="booking-name"
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(e) => {
              clearStatus();
              setName(e.target.value);
            }}
            required
            placeholder="Alex Morgan"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="booking-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
          >
            Email Address
          </label>
          <input
            id="booking-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              clearStatus();
              setEmail(e.target.value);
            }}
            required
            placeholder="alex@example.com"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="booking-date"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
        >
          Select Date
        </label>
        <input
          id="booking-date"
          type="date"
          value={date}
          onChange={handleDateChange}
          required
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all [color-scheme:dark]"
        />
      </div>

      <div>
        <p
          id="slots-label"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
        >
          Available Windows
        </p>
        <div
          role="group"
          aria-labelledby="slots-label"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {!date && (
            <span className="text-slate-500 text-xs italic col-span-full py-2">
              Select a date above to check availability.
            </span>
          )}
          {loading && (
            <span className="text-[#55CDFC] text-xs col-span-full py-2 animate-pulse">
              Checking appointment slots...
            </span>
          )}
          {slots.map((slot) => (
            <button
              key={slot.hour}
              type="button"
              disabled={slot.isTaken}
              aria-pressed={selectedSlot === slot.isoString}
              onClick={() => {
                clearStatus();
                setSelectedSlot(slot.isoString);
              }}
              className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                slot.isTaken
                  ? 'bg-slate-950/40 border-slate-800/40 text-slate-600 cursor-not-allowed line-through'
                  : selectedSlot === slot.isoString
                    ? 'bg-gradient-to-r from-[#55CDFC] via-white to-[#F7A8B8] border-transparent text-slate-950 font-bold shadow-lg shadow-[#55CDFC]/20'
                    : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-[#55CDFC]/60 hover:text-white cursor-pointer'
              }`}
            >
              {slot.label} {slot.isTaken ? '(Booked)' : ''}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="border border-slate-800 bg-slate-950/40 p-4 rounded-2xl space-y-3">
        <legend className="text-[#55CDFC] font-medium px-2 text-xs uppercase tracking-wider">
          Short Notice Preferences
        </legend>
        <label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptsShortNotice}
            onChange={(e) => {
              clearStatus();
              setAcceptsShortNotice(e.target.checked);
            }}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-[#55CDFC] focus:ring-0 focus:ring-offset-0"
          />
          <span>Notify me if an earlier appointment opens up</span>
        </label>

        {acceptsShortNotice && (
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-800">
            <label htmlFor="booking-notice" className="text-xs text-slate-400">
              Minimum notice required:
            </label>
            <input
              id="booking-notice"
              type="number"
              min="1"
              value={noticeValue}
              onChange={(e) => {
                clearStatus();
                setNoticeValue(Math.min(Math.max(parseInt(e.target.value, 10) || 1, 1), 30));
              }}
              className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-100 text-xs focus:border-[#55CDFC]"
            />
            {/* The unit sits right after the number, so its label is for screen readers only. */}
            <label htmlFor="booking-notice-unit" className="sr-only">
              Notice unit
            </label>
            <select
              id="booking-notice-unit"
              value={noticeUnit}
              onChange={(e) => {
                clearStatus();
                setNoticeUnit(e.target.value);
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:border-[#55CDFC]"
            >
              <option value="hours">Hour(s)</option>
              <option value="days">Day(s)</option>
            </select>
          </div>
        )}
      </fieldset>

      {status.text && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-live={status.kind === 'error' ? 'assertive' : 'polite'}
          className={`text-xs text-center px-1 ${
            status.kind === 'error' ? 'text-red-400' : 'text-[#55CDFC]'
          }`}
        >
          {status.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-4 bg-gradient-to-r from-[#55CDFC] via-white to-[#F7A8B8] hover:opacity-95 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-xl shadow-[#55CDFC]/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? 'Submitting...' : 'Submit Booking Request'}
      </button>
    </form>
  );
}
