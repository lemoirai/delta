import React, { useState } from 'react';
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://api.delta-aesthetics.com');
const STANDARD_HOURS = [10, 12, 14, 16];

export default function BookingForm() {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptsShortNotice, setAcceptsShortNotice] = useState(false);
  const [noticeValue, setNoticeValue] = useState(2);
  const [noticeUnit, setNoticeUnit] = useState('hours');

  const fetchSlotsForDate = async (chosenDate) => {
    if (!chosenDate) return;
    setLoading(true);
    try {
      // Fetch all bookings for the given date range (covers timezone variations)
      const startOfDay = `${chosenDate}T00:00:00.000Z`;
      const endOfDay = `${chosenDate}T23:59:59.999Z`;

      const existingBookings = await pb.collection('bookings').getFullList({
        filter: `booking_date >= '${startOfDay}' && booking_date <= '${endOfDay}' && status != 'cancelled' && status != 'cancelled_by_client' && status != 'cancelled_by_admin'`
      });

      // Extract local hour numbers from existing bookings
      const bookedHours = existingBookings.map(b => {
        const d = new Date(b.booking_date);
        return d.getHours();
      });

      const slotData = STANDARD_HOURS.map(hour => {
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';

        // Construct standard ISO date for the selected slot
        const slotDate = new Date(`${chosenDate}T${String(hour).padStart(2, '0')}:00:00`);

        return {
          hour,
          label: `${displayHour}:00 ${ampm}`,
          isTaken: bookedHours.includes(hour),
          isoString: slotDate.toISOString()
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
    const chosenDate = e.target.value;
    setDate(chosenDate);
    setSelectedSlot('');
    fetchSlotsForDate(chosenDate);
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (submitting) return; // Immediate hard guard against duplicate triggers
      setSubmitting(true);

      if (!selectedSlot) {
        alert('Please select an available time slot.');
        setSubmitting(false);
        return;
      }

    setSubmitting(true);
    let noticeHours = acceptsShortNotice ? (noticeUnit === 'days' ? noticeValue * 24 : noticeValue) : 0;

    const payload = {
      customer_name: name,
      customer_email: email,
      booking_date: selectedSlot,
      status: 'pending',
      accepts_short_notice: acceptsShortNotice,
      notice_lead_time: noticeHours
    };

    try {
      await pb.collection('bookings').create(payload);
      alert('Booking request received! We will confirm your slot shortly.');
      setName('');
      setEmail('');
      setSelectedSlot('');
      setAcceptsShortNotice(false);
      // Refresh slots for current date
      await fetchSlotsForDate(date);
    } catch (err) {
      console.error('Full submission error details:', err);
      if (err.response) {
        console.error('PocketBase validation errors:', JSON.stringify(err.response.data, null, 2));
      }
      
      // Check if uniqueness constraint blocked the insert
      if (err.response?.data?.booking_date?.code === 'validation_not_unique') {
        alert('This time slot was just taken. Please choose another window.');
        await fetchSlotsForDate(date); // Refresh slots to show newly taken state
      } else {
        alert('Could not submit booking request: ' + (err.message || 'Check console for validation details.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Alex Morgan"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="alex@example.com"
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Select Date</label>
        <input
          type="date"
          value={date}
          onChange={handleDateChange}
          required
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-[#55CDFC] focus:ring-1 focus:ring-[#55CDFC] text-sm transition-all [color-scheme:dark]"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Available Windows</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {!date && <span className="text-slate-500 text-xs italic col-span-full py-2">Select a date above to check availability.</span>}
          {loading && <span className="text-[#55CDFC] text-xs col-span-full py-2 animate-pulse">Checking appointment slots...</span>}
          {slots.map(slot => (
            <button
              key={slot.hour}
              type="button"
              disabled={slot.isTaken}
              onClick={() => setSelectedSlot(slot.isoString)}
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
        <legend className="text-[#55CDFC] font-medium px-2 text-xs uppercase tracking-wider">Short Notice Preferences</legend>
        <label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptsShortNotice}
            onChange={e => setAcceptsShortNotice(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-[#55CDFC] focus:ring-0 focus:ring-offset-0"
          />
          <span>Notify me if an earlier appointment opens up</span>
        </label>

        {acceptsShortNotice && (
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">Minimum notice required:</span>
            <input
              type="number"
              min="1"
              value={noticeValue}
              onChange={e => setNoticeValue(parseInt(e.target.value) || 1)}
              className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-100 text-xs focus:border-[#55CDFC]"
            />
            <select
              value={noticeUnit}
              onChange={e => setNoticeUnit(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:border-[#55CDFC]"
            >
              <option value="hours">Hour(s)</option>
              <option value="days">Day(s)</option>
            </select>
          </div>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-4 bg-gradient-to-r from-[#55CDFC] via-white to-[#F7A8B8] hover:opacity-95 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-xl shadow-[#55CDFC]/10 disabled:opacity-50 cursor-pointer"
      >
        {submitting ? 'Submitting...' : 'Submit Booking Request'}
      </button>
    </form>
  );
}