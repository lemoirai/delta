// Synthetic accounts and bookings for the dev stack. Run after stack:setup:
//   docker compose exec -T -e PB_URL=http://pocketbase:8090 web npm run stack:seed
// Add `-- --reset` to delete all bookings first.

import { createRequire } from 'node:module';
import { must, superuserToken, assertSyntheticOnly, ensureUser, DEV_PASSWORD } from './dev-api.mjs';

const require = createRequire(import.meta.url);
const { pacificParts, pacificToUtc, addDays, toPbDate } = require('../lib/time.js');

const token = await superuserToken();
await assertSyntheticOnly(token);

const staff = await ensureUser(token, 'staff-001@example.test', 'staff');
const alice = await ensureUser(token, 'client-001@example.test');
const bob = await ensureUser(token, 'client-002@example.test');

const existing = await must('GET', '/api/collections/bookings/records?perPage=500', null, token);
if (process.argv.includes('--reset')) {
  for (const b of existing.items) {
    await must('DELETE', `/api/collections/bookings/records/${b.id}`, null, token);
  }
} else if (existing.items.length) {
  console.log(`${existing.items.length} bookings already present; use --reset to recreate them.`);
  process.exit(0);
}

const today = pacificParts(Date.now()).date;
const at = (days, hour) => toPbDate(pacificToUtc(addDays(today, days), hour));

const rows = [
  [alice, 'Alex Example', 'client-001@example.test', at(3, 10), 'confirmed'],
  [alice, 'Alex Example', 'client-001@example.test', at(5, 12), 'pending'],
  [alice, 'Alex Example', 'client-001@example.test', at(4, 16), 'cancelled_by_client'],
  [alice, 'Alex Example', 'client-001@example.test', at(-7, 14), 'completed'],
  [bob, 'Sam Sample', 'client-002@example.test', at(3, 14), 'pending'],
  [bob, 'Sam Sample', 'client-002@example.test', at(6, 10), 'reschedule_requested'],
  [bob, 'Sam Sample', 'client-002@example.test', at(8, 16), 'rescheduled'],
  [bob, 'Sam Sample', 'client-002@example.test', at(-2, 12), 'cancelled_by_admin'],
];

for (const [client, name, email, date, status] of rows) {
  await must(
    'POST',
    '/api/collections/bookings/records',
    { client, customer_name: name, customer_email: email, booking_date: date, status },
    token,
  );
}

console.log(`seeded: staff ${staff}, clients ${alice} ${bob}, ${rows.length} bookings`);
console.log(
  `test accounts use email codes on the site (Mailpit) or password ${DEV_PASSWORD} in scripts`,
);
