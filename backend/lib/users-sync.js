// Pure planning logic for scripts/users-sync.mjs: which users to create or update
// when a users file is imported into an instance. Users are matched by email,
// because record ids differ between instances.

const path = require('node:path');

const FILE_FIELDS = ['email', 'role', 'verified', 'name'];

function normalizeEmail(value) {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/**
 * Clean a parsed users file. Returns `{ entries, invalid }`. Entries without a
 * valid email are counted as invalid; a repeated email keeps its last entry.
 */
function normalizeEntries(list) {
  if (!Array.isArray(list)) throw new Error('A users file must be a JSON array.');
  const byEmail = new Map();
  let invalid = 0;
  for (const raw of list) {
    const email = normalizeEmail(raw?.email);
    if (!email) {
      invalid++;
      continue;
    }
    const entry = { email };
    if (typeof raw.role === 'string' && raw.role) entry.role = raw.role;
    if (raw.verified === true) entry.verified = true;
    if (typeof raw.name === 'string' && raw.name.trim()) entry.name = raw.name.trim();
    byEmail.set(email, entry);
  }
  return { entries: [...byEmail.values()], invalid };
}

/** The file representation of a user record: only FILE_FIELDS, empty values left out. */
function toFileEntry(record) {
  const out = {};
  for (const f of FILE_FIELDS) {
    const v = record[f];
    if (v === undefined || v === null || v === '' || v === false) continue;
    out[f] = f === 'email' ? String(v).toLowerCase() : v;
  }
  return out;
}

/**
 * Plan an import.
 *  - `existing`: user records on the target (need `id`, `email`, and the fields below).
 *  - `target`: `{ fields: Set<string>, roles: string[] }` describing the target's
 *    users collection; fields it doesn't have are skipped.
 * Never deletes, never removes a role and never un-verifies: the file only adds.
 */
function planImport(entries, existing, target) {
  const byEmail = new Map(existing.map((u) => [String(u.email).toLowerCase(), u]));
  const plan = { create: [], update: [], unchanged: 0, skippedRoles: 0 };

  for (const entry of entries) {
    const wanted = {};
    if (entry.role !== undefined && target.fields.has('role')) {
      if (target.roles.includes(entry.role)) wanted.role = entry.role;
      else plan.skippedRoles++;
    }
    if (entry.name !== undefined && target.fields.has('name')) wanted.name = entry.name;
    if (entry.verified) wanted.verified = true;

    const current = byEmail.get(entry.email);
    if (!current) {
      plan.create.push({ email: entry.email, ...wanted });
      continue;
    }
    const changes = {};
    for (const [k, v] of Object.entries(wanted)) {
      if (current[k] !== v) changes[k] = v;
    }
    if (Object.keys(changes).length)
      plan.update.push({ id: current.id, email: entry.email, changes });
    else plan.unchanged++;
  }
  return plan;
}

/** True if `file` resolves to a path inside `dir` (or is `dir`). */
function isInside(file, dir) {
  const rel = path.relative(path.resolve(dir), path.resolve(file));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

module.exports = {
  FILE_FIELDS,
  normalizeEmail,
  normalizeEntries,
  toFileEntry,
  planImport,
  isInside,
};
