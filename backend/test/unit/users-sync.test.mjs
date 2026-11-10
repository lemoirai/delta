import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { normalizeEntries, toFileEntry, planImport, isInside } = require('../../lib/users-sync.js');

const target = {
  fields: new Set(['email', 'role', 'verified', 'name']),
  roles: ['client', 'staff'],
};

test('normalizeEntries: lowercases, drops invalid emails, last duplicate wins', () => {
  const { entries, invalid } = normalizeEntries([
    { email: ' A@X.com ', role: 'client' },
    { email: 'not-an-email' },
    {},
    { email: 'a@x.com', role: 'staff', verified: true, name: ' Ann ' },
  ]);
  assert.equal(invalid, 2);
  assert.deepEqual(entries, [{ email: 'a@x.com', role: 'staff', verified: true, name: 'Ann' }]);
});

test('normalizeEntries: rejects a file that is not an array', () => {
  assert.throws(() => normalizeEntries({ email: 'a@x.com' }));
});

test('toFileEntry: only file fields, empty values left out', () => {
  assert.deepEqual(
    toFileEntry({ id: 'x', email: 'A@x.com', role: '', verified: false, name: 'A', tokenKey: 's' }),
    { email: 'a@x.com', name: 'A' },
  );
});

test('planImport: creates missing users with their role', () => {
  const plan = planImport([{ email: 'new@x.com', role: 'staff', verified: true }], [], target);
  assert.deepEqual(plan.create, [{ email: 'new@x.com', role: 'staff', verified: true }]);
  assert.equal(plan.update.length, 0);
});

test('planImport: promotes an existing user, matched by email', () => {
  const plan = planImport(
    [{ email: 'old@x.com', role: 'staff' }],
    [{ id: 'u1', email: 'Old@x.com', role: '', verified: true }],
    target,
  );
  assert.deepEqual(plan.update, [{ id: 'u1', email: 'old@x.com', changes: { role: 'staff' } }]);
  assert.equal(plan.create.length, 0);
});

test('planImport: unchanged users are counted, not updated', () => {
  const plan = planImport(
    [{ email: 'a@x.com', role: 'staff', verified: true }],
    [{ id: 'u1', email: 'a@x.com', role: 'staff', verified: true }],
    target,
  );
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.update.length, 0);
});

test('planImport: never removes a role or un-verifies', () => {
  const plan = planImport(
    [{ email: 'a@x.com' }],
    [{ id: 'u1', email: 'a@x.com', role: 'staff', verified: true }],
    target,
  );
  assert.equal(plan.unchanged, 1);
});

test('planImport: roles and fields the target lacks are skipped', () => {
  const plan = planImport([{ email: 'a@x.com', role: 'owner', name: 'A' }], [], {
    fields: new Set(['email', 'verified']),
    roles: [],
  });
  assert.deepEqual(plan.create, [{ email: 'a@x.com' }]);
  assert.equal(plan.skippedRoles, 0);

  const withRoles = planImport([{ email: 'a@x.com', role: 'owner' }], [], target);
  assert.equal(withRoles.skippedRoles, 1);
  assert.deepEqual(withRoles.create, [{ email: 'a@x.com' }]);
});

test('isInside: detects paths inside a folder', () => {
  const repo = path.resolve('/work/repo');
  assert.equal(isInside(path.join(repo, 'users.json'), repo), true);
  assert.equal(isInside(path.join(repo, 'a', 'b.json'), repo), true);
  assert.equal(isInside(repo, repo), true);
  assert.equal(isInside(path.resolve('/work/repo-data/users.json'), repo), false);
  assert.equal(isInside(path.resolve('/tmp/users.json'), repo), false);
});
