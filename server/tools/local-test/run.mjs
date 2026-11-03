// Starts a throwaway Postgres in a temp folder, runs every server/test/*.js file against it, then deletes it.
// No Postgres install, password or setup needed:   cd server/tools/local-test && npm install && npm test
import EmbeddedPostgres from 'embedded-postgres';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(path.join(tmpdir(), 'knotcount-pg-'));
const port = 54000 + Math.floor(Math.random() * 900);
// the database name contains "test": the regression suite refuses to run against anything else
const url = `postgres://postgres:pw@localhost:${port}/knotcount_test`;

const pg = new EmbeddedPostgres({ databaseDir: path.join(dir, 'data'), user: 'postgres', password: 'pw', port, persistent: false });
let failed = 0;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('knotcount_test');
  for (const f of readdirSync(path.join(server, 'test')).filter((x) => x.endsWith('.js')).sort()) {
    const r = spawnSync(process.execPath, [path.join('test', f)], { cwd: server, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' } });
    const ok = r.status === 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  test/${f}`);
    if (!ok) { failed++; console.log((r.stdout + r.stderr).split('\n').filter((l) => !/LOG:|^\s*$/.test(l)).slice(-15).join('\n')); }
  }
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} test file(s) failed` : '\nAll server tests passed');
process.exit(failed ? 1 : 0);
