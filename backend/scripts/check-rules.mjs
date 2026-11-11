// Checks the staff-portal access rules against the dev stack and cleans up after
// itself. Exits non-zero if any case fails.
//   docker compose exec -T -e PB_URL=http://pocketbase:8090 web npm run stack:check-rules

import {
  call,
  must,
  superuserToken,
  warnNonSynthetic,
  ensureUser,
  userToken,
  DEV_PASSWORD,
} from './dev-api.mjs';

const su = await superuserToken();
await warnNonSynthetic(su);

const tag = Date.now();
const email = (name) => `rules-${tag}-${name}@example.test`;
const created = { users: [], bookings: [] };
const results = [];

function expect(name, status, allowed) {
  const pass = allowed.includes(status);
  results.push({ name, status, pass });
}

try {
  const signup = await call('POST', '/api/collections/users/records', {
    email: email('evil'),
    password: DEV_PASSWORD,
    passwordConfirm: DEV_PASSWORD,
    role: 'staff',
  });
  if (signup.ok) created.users.push(signup.data.id);
  expect('sign-up cannot set role', signup.status, [400, 403]);

  const direct = await call(
    'POST',
    '/api/collections/users/records',
    { email: email('direct'), role: 'staff', verified: true },
    su,
  );
  if (direct.ok) created.users.push(direct.data.id);
  expect('superuser can create staff with only an email', direct.status, [200]);
  const otp = await call('POST', '/api/collections/users/request-otp', { email: email('direct') });
  expect('a user created that way can request a code', otp.status, [200]);

  const a = await ensureUser(su, email('a'));
  const b = await ensureUser(su, email('b'));
  const s = await ensureUser(su, email('staff'), 'staff');
  created.users.push(a, b, s);
  const ta = await userToken(email('a'));
  const ts = await userToken(email('staff'));

  const self = await call('PATCH', `/api/collections/users/records/${a}`, { role: 'staff' }, ta);
  expect('client cannot give themselves staff', self.status, [400, 403, 404]);

  const day = 900 + (tag % 50);
  const booking = async (client, n) => {
    const r = await must(
      'POST',
      '/api/collections/bookings/records',
      {
        client,
        customer_name: 'Rules Check',
        customer_email: email(client === a ? 'a' : 'b'),
        booking_date: `2099-01-01 ${String(10 + n).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}:00.000Z`,
        status: 'pending',
      },
      su,
    );
    created.bookings.push(r.id);
    return r.id;
  };
  const b1 = await booking(a, 1);
  const b2 = await booking(b, 2);
  const b3 = await booking(a, 3);

  const up = (id, body, token) =>
    call('PATCH', `/api/collections/bookings/records/${id}`, body, token).then((r) => r.status);

  expect(
    'client cannot confirm own booking',
    await up(b1, { status: 'confirmed' }, ta),
    [400, 403, 404],
  );
  expect(
    "client cannot cancel someone else's booking",
    await up(b2, { status: 'cancelled_by_client' }, ta),
    [404],
  );
  expect(
    'client cannot cancel and move the date at once',
    await up(b3, { status: 'cancelled_by_client', booking_date: '2099-02-01 10:00:00.000Z' }, ta),
    [400, 403, 404],
  );
  expect(
    'client can cancel own booking',
    await up(b1, { status: 'cancelled_by_client' }, ta),
    [200],
  );
  expect('staff can confirm any booking', await up(b2, { status: 'confirmed' }, ts), [200]);
  expect(
    'staff can cancel as the studio',
    await up(b3, { status: 'cancelled_by_admin' }, ts),
    [200],
  );
  expect(
    'anonymous cannot update',
    await up(b2, { status: 'cancelled_by_admin' }),
    [400, 403, 404],
  );
} finally {
  for (const id of created.bookings)
    await call('DELETE', `/api/collections/bookings/records/${id}`, null, su);
  for (const id of created.users)
    await call('DELETE', `/api/collections/users/records/${id}`, null, su);
}

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name} (${r.status})`);
const failed = results.filter((r) => !r.pass).length;
console.log(
  failed
    ? `${failed} of ${results.length} rule checks failed`
    : `all ${results.length} rule checks passed`,
);
process.exit(failed ? 1 : 0);
