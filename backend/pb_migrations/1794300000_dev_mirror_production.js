/// <reference path="../pb_data/types.d.ts" />
// Temporary dev mirror of the production `bookings` collection as it is today
// (fields, the 7 status values, the unique slot index), plus the staff role and
// the rules for the staff portal (ops plan pass 2). The two-instance schema
// replaces this migration; don't build new features on these field names.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new SelectField({ name: 'role', values: ['client', 'staff'], maxSelect: 1 }));
    // A role can only be set by a superuser in the dashboard, never by sign-up or
    // a profile update from the site.
    users.createRule = '@request.body.role:isset = false';
    users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false';
    users.otp.enabled = true;
    users.otp.duration = 600;
    users.otp.length = 6;
    app.save(users);

    const bookings = new Collection({
      type: 'base',
      name: 'bookings',
      // List and create stay public until the /api/slots and /api/bookings routes
      // exist (REFACTOR step 5), because the booking form needs them.
      listRule: '',
      viewRule: "client = @request.auth.id || @request.auth.role = 'staff'",
      createRule: '',
      // Staff can change any booking. A client can only cancel their own, and can't
      // change the date, owner or email in the same request.
      updateRule:
        "@request.auth.role = 'staff' || (client = @request.auth.id && " +
        "@request.body.status = 'cancelled_by_client' && " +
        '@request.body.booking_date:isset = false && @request.body.client:isset = false && ' +
        '@request.body.customer_email:isset = false)',
      deleteRule: null,
      fields: [
        { type: 'text', name: 'customer_name' },
        { type: 'email', name: 'customer_email' },
        { type: 'date', name: 'booking_date' },
        {
          type: 'select',
          name: 'status',
          maxSelect: 1,
          values: [
            'pending',
            'confirmed',
            'cancelled_by_client',
            'cancelled_by_admin',
            'reschedule_requested',
            'rescheduled',
            'completed',
          ],
        },
        { type: 'date', name: 'previous_booking_date' },
        { type: 'number', name: 'notice_lead_time' },
        { type: 'bool', name: 'accepts_short_notice' },
        { type: 'relation', name: 'client', collectionId: users.id, maxSelect: 1 },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_unique_active_booking ON bookings (booking_date) ' +
          "WHERE status != 'cancelled' AND status != 'cancelled_by_client' AND status != 'cancelled_by_admin'",
      ],
    });
    app.save(bookings);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('bookings'));
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('role');
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    app.save(users);
  },
);
