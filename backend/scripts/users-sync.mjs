// Copy users between PocketBase instances, or load a known list of staff into a
// fresh one. For deploy and spin-up steps; the live studio/cloud sync is separate.
//
//   node backend/scripts/users-sync.mjs export <file.json> [--staff-only] [--verbose]
//   node backend/scripts/users-sync.mjs import <file.json> [--apply] [--verbose]
//
// The file is a JSON array of { email, role, verified, name }. No passwords, tokens
// or ids: users are matched by email. Import is a dry run until --apply, and it only
// adds: it never deletes a user, removes a role or un-verifies anyone.
//
// Target and login come from the environment, never from the repo:
//   PB_URL                  default http://127.0.0.1:8090 (the dev stack)
//   PB_SUPERUSER_EMAIL      dev default admin@example.test
//   PB_SUPERUSER_PASSWORD   dev default local-only-password
// Exports hold client emails: they're refused inside the repo folder. Keep them in
// a private folder such as C:\Users\moirai\delta-prod-data\.

import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { normalizeEntries, toFileEntry, planImport, isInside } = require('../lib/users-sync.js');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE =
  'usage: users-sync export <file.json> [--staff-only] [--verbose]\n' +
  '       users-sync import <file.json> [--apply] [--verbose]';

const [command, file, ...flags] = process.argv.slice(2);
const has = (flag) => flags.includes(flag);
const unknown = flags.filter((f) => !['--staff-only', '--apply', '--verbose'].includes(f));
if (!['export', 'import'].includes(command) || !file || unknown.length) fail(USAGE);

const PB = (process.env.PB_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const host = new URL(PB).hostname;
const isDev = ['127.0.0.1', 'localhost', 'pocketbase'].includes(host);
const identity = process.env.PB_SUPERUSER_EMAIL ?? (isDev ? 'admin@example.test' : '');
const password = process.env.PB_SUPERUSER_PASSWORD ?? (isDev ? 'local-only-password' : '');
if (!identity || !password) {
  fail(`${host} isn't the dev stack: set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.`);
}

let token = '';
({ token } = await api('POST', '/api/collections/_superusers/auth-with-password', {
  identity,
  password,
}));
const collection = await api('GET', '/api/collections/users');
const roleField = collection.fields.find((f) => f.name === 'role');
const target = {
  fields: new Set(collection.fields.map((f) => f.name)),
  roles: roleField?.values ?? [],
};
const existing = await listUsers();

if (command === 'export') {
  if (isInside(file, REPO_ROOT)) {
    fail(`Refusing to write ${file}: it's inside the repo and would hold client emails.`);
  }
  const users = has('--staff-only') ? existing.filter((u) => u.role === 'staff') : existing;
  const out = users.map(toFileEntry);
  await writeFile(file, JSON.stringify(out, null, 2) + '\n', { flag: 'w' });
  console.log(`exported ${out.length} user(s) from ${host} to ${file}`);
  if (has('--verbose')) for (const u of out) console.log(`  ${u.email} ${u.role ?? ''}`);
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(await readFile(file, 'utf8'));
} catch (err) {
  fail(`Can't read ${file}: ${err.message}`);
}
const { entries, invalid } = normalizeEntries(parsed);
const plan = planImport(entries, existing, target);
const apply = has('--apply');
const verb = apply ? '' : 'would ';

console.log(
  `${host}: ${verb}create ${plan.create.length}, ${verb}update ${plan.update.length}, ` +
    `unchanged ${plan.unchanged}` +
    (invalid
      ? `, ${invalid} entr${invalid === 1 ? 'y' : 'ies'} without a valid email skipped`
      : '') +
    (plan.skippedRoles ? `, ${plan.skippedRoles} unknown role(s) skipped` : ''),
);
if (has('--verbose')) {
  for (const c of plan.create) console.log(`  create ${c.email} ${c.role ?? ''}`);
  for (const u of plan.update) console.log(`  update ${u.email} ${JSON.stringify(u.changes)}`);
}

if (!apply) {
  if (plan.create.length || plan.update.length) console.log('dry run: add --apply to write');
  process.exit(0);
}

for (const c of plan.create) {
  // Sign-in is by emailed code; PocketBase requires a password all the same.
  const pw = randomBytes(24).toString('base64url');
  await api('POST', '/api/collections/users/records', {
    ...c,
    password: pw,
    passwordConfirm: pw,
  });
}
for (const u of plan.update) {
  await api('PATCH', `/api/collections/users/records/${u.id}`, u.changes);
}
console.log('done');

async function listUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const res = await api('GET', `/api/collections/users/records?perPage=500&page=${page}`);
    users.push(...res.items);
    if (page >= res.totalPages) return users;
  }
}

async function api(method, urlPath, body) {
  const res = await fetch(`${PB}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok)
    fail(`${method} ${urlPath.split('?')[0]} -> ${res.status}: ${data?.message ?? text}`);
  return data;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
