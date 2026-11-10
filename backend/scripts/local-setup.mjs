// Points the dev PocketBase at Mailpit and turns on email-code sign-in.
// Run after `docker compose down -v`, inside the web container:
//   docker compose exec -T -e PB_URL=http://pocketbase:8090 web npm run stack:setup
// Dev stack only: the credentials are the compose defaults and the script refuses
// any production host.

const PB = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const IDENTITY = process.env.PB_SUPERUSER_EMAIL ?? 'admin@example.test';
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD ?? 'local-only-password';

if (PB.includes('delta-aesthetics.com')) {
  throw new Error(`Refusing to configure ${PB}: this script is for the dev stack only.`);
}

async function call(method, path, body, token) {
  const res = await fetch(`${PB}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const { token } = await call('POST', '/api/collections/_superusers/auth-with-password', {
  identity: IDENTITY,
  password: PASSWORD,
});

await call(
  'PATCH',
  '/api/settings',
  {
    meta: {
      appURL: 'http://127.0.0.1:4321',
      senderName: 'Delta Support (local)',
      senderAddress: 'support@example.test',
    },
    smtp: { enabled: true, host: 'mailpit', port: 1025, tls: false },
  },
  token,
);

await call(
  'PATCH',
  '/api/collections/users',
  { otp: { enabled: true, duration: 600, length: 6 } },
  token,
);

console.log('local setup ok');
