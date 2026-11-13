// Shared helpers for the dev-stack scripts. Every script refuses production hosts
// (architecture §9.0).

export const PB = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const IDENTITY = process.env.PB_SUPERUSER_EMAIL ?? 'admin@example.test';
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD ?? 'local-only-password';

// Password sign-in is only used by these scripts to act as test accounts; the site
// signs people in with emailed codes.
export const DEV_PASSWORD = 'dev-only-password-123';

if (PB.includes('delta-aesthetics.com')) {
  throw new Error(`Refusing ${PB}: these scripts are for the dev stack only.`);
}

export async function call(method, path, body, token) {
  const res = await fetch(`${PB}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, ok: res.ok, data };
}

export async function must(method, path, body, token) {
  const res = await call(method, path, body, token);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(res.data)}`);
  return res.data;
}

export async function superuserToken() {
  const { token } = await must('POST', '/api/collections/_superusers/auth-with-password', {
    identity: IDENTITY,
    password: PASSWORD,
  });
  return token;
}

// Real accounts the owner adds locally are allowed (to test against existing users),
// but say so, since production exports must never be loaded here (architecture §9.0).
export async function warnNonSynthetic(token) {
  const { items } = await must('GET', '/api/collections/users/records?perPage=500', null, token);
  const real = items.filter((u) => !String(u.email).endsWith('@example.test'));
  if (real.length) {
    console.warn(`note: ${real.length} user(s) here without an @example.test email`);
  }
}

export async function userToken(email) {
  const { token } = await must('POST', '/api/collections/users/auth-with-password', {
    identity: email,
    password: DEV_PASSWORD,
  });
  return token;
}

export async function ensureUser(token, email, role) {
  const filter = encodeURIComponent(`email = "${email}"`);
  const { items } = await must(
    'GET',
    `/api/collections/users/records?filter=${filter}`,
    null,
    token,
  );
  if (items.length) {
    if (role && items[0].role !== role) {
      await must('PATCH', `/api/collections/users/records/${items[0].id}`, { role }, token);
    }
    return items[0].id;
  }
  const user = await must(
    'POST',
    '/api/collections/users/records',
    {
      email,
      emailVisibility: true,
      verified: true,
      password: DEV_PASSWORD,
      passwordConfirm: DEV_PASSWORD,
      ...(role ? { role } : {}),
    },
    token,
  );
  return user.id;
}
