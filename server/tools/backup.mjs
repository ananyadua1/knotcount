// Saves every account, wedding and guest to one JSON file.
//   DATABASE_URL=postgres://... node tools/backup.mjs [folder]
// The file holds personal data and password hashes: keep it private (never in git, never in a shared folder).
import pg from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first.'); process.exit(1); }
const useSsl = process.env.PGSSL === 'true' || /sslmode=require|neon\.tech|supabase\.co/.test(url);
const clean = new URL(url);
for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) clean.searchParams.delete(k);
const client = new pg.Client({ connectionString: clean.toString(), ssl: useSsl ? { rejectUnauthorized: true } : undefined });

// parents before children, so a restore can insert in this order
export const TABLES = ['users', 'events', 'guests'];

await client.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); // one consistent snapshot of all three tables
  const data = {};
  for (const t of TABLES) data[t] = (await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) AS rows FROM ${t} t`)).rows[0].rows;
  await client.query('COMMIT');

  const folder = process.argv[2] || 'backups';
  mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(folder, `knotcount-backup-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ app: 'knotcount', version: 1, createdAt: new Date().toISOString(), data }), { mode: 0o600 });
  console.log(`Backed up ${TABLES.map((t) => `${data[t].length} ${t}`).join(', ')} -> ${file}`);
} finally { await client.end(); }
