// Loads a backup made by backup.mjs into an EMPTY KnotCount database.
//   DATABASE_URL=postgres://... node tools/restore.mjs backups/knotcount-backup-....json
// Start the server once against the new database first (it creates the tables), or run this: it does that itself.
// It refuses to touch a database that already has accounts, so it can't overwrite live data by accident.
import { readFileSync } from 'node:fs';
import { migrate, pool } from '../src/db.js';

const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) { console.error('Usage: DATABASE_URL=... node tools/restore.mjs <backup.json>'); process.exit(1); }
const backup = JSON.parse(readFileSync(file, 'utf8'));
if (backup.app !== 'knotcount' || backup.version !== 1) { console.error('That file is not a KnotCount backup.'); process.exit(1); }

await migrate(); // creates the tables if the database is brand new
const client = await pool.connect();
try {
  const existing = (await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  if (existing > 0) { console.error(`This database already has ${existing} account(s). Restore only into an empty database.`); process.exitCode = 1; }
  else {
    await client.query('BEGIN');
    for (const t of ['users', 'events', 'guests']) {
      const rows = backup.data[t] || [];
      // jsonb_populate_recordset matches by column name, so a backup survives columns being added later
      if (rows.length) await client.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_recordset(null::${t}, $1::jsonb)`, [JSON.stringify(rows)]);
      await client.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), greatest((SELECT coalesce(max(id), 0) FROM ${t}), 1))`);
    }
    await client.query('COMMIT');
    console.log(`Restored ${['users', 'events', 'guests'].map((t) => `${backup.data[t].length} ${t}`).join(', ')} from ${file}`);
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Restore failed, nothing was changed:', e.message);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
