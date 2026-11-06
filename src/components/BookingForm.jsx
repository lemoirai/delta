import React, { useState } from 'react';
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://api.delta-aesthetics.com');
const STANDARD_HOURS = [10, 12, 14, 16];

export default function BookingForm() {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [acceptsShortNotice, setAcceptsShortNotice] = useState(false);
  const [noticeValue, setNoticeValue] = useState(2);
  const [noticeUnit, setNoticeUnit] = useState('hours');

  const handleDateChange = async (e) => {
    const chosenDate = e.target.value;
    setDate(chosenDate);
    setSelectedSlot('');
    if (!chosenDate) return;

    setLoading(true);
    try {
      const startOfDay = new Date(`${chosenDate}T00:00:00`).toISOString();
      const endOfDay = new Date(`${chosenDate}T23:59:59`).toISOString();

      const existingBookings = await pb.collection('bookings').getFullList({
        filter: `booking_date >= '${startOfDay}' && booking_date <= '${endOfDay}' && status != 'cancelled_by_client' && status != 'cancelled_by_admin'`
      });

      const bookedHours = existingBookings.map(b => new Date(b.booking_date).getHours());
      
      const slotData = STANDARD_HOURS.map(hour => {
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return {
          hour,
          label: `${displayHour}:00 ${ampm}`,
          isTaken: bookedHours.includes(hour),
          isoString: new Date(`${chosenDate}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
        };
      });

      setSlots(slotData);
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      alert('Please select an available time slot.');
      return;
    }

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
      alert('Booking request received!');
      setName('');
      setEmail('');
      setDate('');
      setSlots([]);
      setSelectedSlot('');
      setAcceptsShortNotice(false);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Could not submit booking request.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name:</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required 
          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email:</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required 
          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Select Date:</label>
        <input type="date" value={date} onChange={handleDateChange} required 
          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Available Time Slots:</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {!date && <span className="text-slate-400 text-sm col-span-2">Please select a date above first.</span>}
          {loading && <span className="text-slate-400 text-sm col-span-2">Loading slots...</span>}
          {slots.map(slot => (
            <button
              key={slot.hour}
              type="button"
              disabled={slot.isTaken}
              onClick={() => setSelectedSlot(slot.isoString)}
              className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                slot.isTaken ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' :
                selectedSlot === slot.isoString ? 'bg-sky-500 border-sky-400 text-slate-950 font-bold' :
                'bg-slate-900 border-slate-700 hover:border-sky-500 text-slate-200'
              }`}
            >
              {slot.label} {slot.isTaken && '(Booked)'}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="border border-slate-800 p-4 rounded-xl space-y-3">
        <legend className="text-sky-400 font-semibold px-2 text-sm">Short Notice Options</legend>
        <label className="flex items-center space-x-2 text-sm cursor-pointer">
          <input type="checkbox" checked={acceptsShortNotice} onChange={e => setAcceptsShortNotice(e.target.checked)} 
            className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0" />
          <span>Notify me if an earlier appointment slot opens up!</span>
        </label>

        {acceptsShortNotice && (
          <div className="flex gap-2 items-center pt-2">
            <span className="text-sm text-slate-300">Minimum notice:</span>
            <input type="number" min="1" value={noticeValue} onChange={e => setNoticeValue(parseInt(e.target.value) || 1)} 
              className="w-16 p-1 bg-slate-900 border border-slate-700 rounded text-center text-white text-sm" />
            <select value={noticeUnit} onChange={e => setNoticeUnit(e.target.value)} 
              className="p-1 bg-slate-900 border border-slate-700 rounded text-sm text-white">
              <option value="hours">Hour(s)</option>
              <option value="days">Day(s)</option>
            </select>
          </div>
        )}
      </fieldset>

      <button type="submit" 
        className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl transition-colors">
        Submit Request
      </button>
    </form>
  );
}