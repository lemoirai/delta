/// <reference path="../pb_data/types.d.ts" />
// Dev stand-in for production's auto_create_user hook (it lives only on the VM):
// a new booking gets a user for its email and is linked to it through `client`,
// so clients can see and cancel what they booked. Replaced by the /api/bookings
// route (REFACTOR step 5); don't copy this file to production.
onRecordCreate((e) => {
  const email = String(e.record.get('customer_email') || '')
    .trim()
    .toLowerCase();
  if (email && !e.record.get('client')) {
    let user;
    try {
      user = e.app.findAuthRecordByEmail('users', email);
    } catch {
      const users = e.app.findCollectionByNameOrId('users');
      user = new Record(users);
      user.setEmail(email);
      user.setPassword($security.randomString(32));
      e.app.save(user);
    }
    e.record.set('customer_email', email);
    e.record.set('client', user.id);
  }
  e.next();
}, 'bookings');
