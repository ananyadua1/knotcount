import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import { migrate, pool, q } from '../src/db.js';
import { createApp, runEmailReminders } from '../src/app.js';

if (!process.env.DATABASE_URL?.includes('test')) throw new Error('Use an isolated DATABASE_URL containing test.');
await migrate();
const mails = [];
const relay = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => { mails.push(JSON.parse(body)); res.end('ok'); });
}).listen(0);
process.env.MAIL_WEBHOOK_URL = `http://localhost:${relay.address().port}`;
process.env.MAIL_DAILY_LIMIT = '10000';
const server = createApp().listen(0);
const base = `http://localhost:${server.address().port}`;
const email = `regression-${Date.now()}@example.com`;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json() };
};
try {
  assert.equal((await call('POST', '/api/auth/register', { email, password: 'original-password' })).status, 201);
  const code = /\b\d{6}\b/.exec(mails.at(-1).text)[0];
  assert.equal((await call('POST', '/api/auth/register', { email, password: 'attacker-password' })).status, 409);
  const verify = await Promise.all([1, 2].map(() => call('POST', '/api/auth/verify', { email, code })));
  assert.deepEqual(verify.map(x => x.status).sort(), [200, 400], 'verification code must be consumed once under concurrency');
  let token = verify.find(x => x.status === 200).body.token;
  assert.equal((await call('POST', '/api/auth/login', { email, password: 'attacker-password' })).status, 401);
  const event = (await call('GET', '/api/event', undefined, token)).body.event;
  let r = await call('POST', '/api/guests', { guests: [
    { name: 'Confirmed', seats: 2, status: 'confirmed', attending: 2, vegCount: 1, note: 'Host private note' },
    { name: 'Declined', status: 'declined' },
    { name: 'Invited pending', email: 'guest@example.com', invited: true },
    { name: 'Not invited', email: 'not-invited@example.com' },
  ] }, token);
  assert.equal(r.status, 201);
  const [guest, declined] = r.body.guests;
  assert.equal(guest.status, 'confirmed'); assert.equal(guest.attending, 2); assert.equal(guest.vegCount, 1);
  assert.equal(declined.status, 'declined');
  await call('POST', `/api/public/${guest.token}/rsvp`, { attending: true, count: 1, veg: 0 });
  r = await call('GET', '/api/guests', undefined, token);
  assert.equal(r.body.guests.find(g => g.id === guest.id).note, 'Host private note');
  const before = r.body.guests.length;
  assert.equal((await call('POST', '/api/guests', { guests: [{ name: 'Valid' }, null] }, token)).status, 400);
  assert.equal((await call('GET', '/api/guests', undefined, token)).body.guests.length, before);
  assert.equal((await call('POST', '/api/guests', { name: 'Bad email', email: 'one@example.com,two@example.com' }, token)).status, 400);
  const count = mails.length;
  const ev = (await q('SELECT * FROM events WHERE id=$1', [event.id])).rows[0];
  const reminders = await Promise.all([runEmailReminders(ev, base), runEmailReminders(ev, base)]);
  assert.equal(reminders.reduce((n, x) => n + x.sent, 0), 1, 'concurrent reminders send once');
  assert.equal(mails.length, count + 1); assert.equal(mails.at(-1).to, 'guest@example.com');
  assert.equal((await runEmailReminders(ev, base)).sent, 0, 'manual cooldown survives another run');
  await call('POST', '/api/auth/forgot', { email });
  const resetCode = /\b\d{6}\b/.exec(mails.at(-1).text)[0];
  const reset = await Promise.all([1, 2].map(() => call('POST', '/api/auth/reset', { email, code: resetCode, password: 'replacement-password' })));
  assert.deepEqual(reset.map(x => x.status).sort(), [200, 400]);
  assert.equal((await call('GET', '/api/guests', undefined, token)).status, 401);
  token = reset.find(x => x.status === 200).body.token;
  assert.equal((await call('POST', '/api/auth/logout', undefined, token)).status, 200);
  assert.equal((await call('GET', '/api/guests', undefined, token)).status, 401);

  // Execute the real guest page and exercise its rendered one-seat meal control.
  const html = fs.readFileSync(new URL('../public/rsvp.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const buttons = [];
  const app = { innerHTML: '', querySelectorAll: selector => {
    if (selector !== '[data-m]') return [];
    buttons.length = 0;
    for (const m of app.innerHTML.matchAll(/<button[^>]*data-m="([^"]+)" data-d="([^"]+)"[^>]*>/g)) buttons.push({ dataset: { m: m[1], d: m[2] }, disabled: m[0].includes('disabled') });
    return buttons;
  } };
  const nodes = {};
  const context = { AbortSignal, setTimeout, clearTimeout, document: { getElementById: id => id === 'app' ? app : (nodes[id] ??= {}) }, location: { pathname: '/r/test' }, fetch: async () => ({ ok: true, json: async () => ({ event: { bride: 'A', groom: 'B', date: '', time: '', venue: '' }, guest: { name: 'One guest', seats: 1, status: 'pending', attending: 0, vegCount: null } }) }) };
  vm.createContext(context); vm.runInContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  const nonveg = buttons.find(b => b.dataset.m === 'nonveg' && b.dataset.d === '1');
  assert.equal(nonveg.disabled, false); nonveg.onclick();
  assert.equal(vm.runInContext('S.veg', context), 0); assert.equal(vm.runInContext('S.nonveg', context), 1);
  // A sleeping server: the first attempts fail, the page keeps trying and then loads (it must not show an error).
  let asleep = 2;
  const waking = { ...context, fetch: async (...a) => { if (asleep-- > 0) throw new Error('server is asleep'); return context.fetch(...a); } };
  app.innerHTML = '';
  vm.createContext(waking); vm.runInContext(script, waking);
  await new Promise(resolve => setTimeout(resolve, 5500));
  assert.ok(app.innerHTML.includes('will you join us'), 'guest page loads after the server wakes');
  assert.ok(!app.innerHTML.includes('could not reach'), 'no error shown while retrying');

  console.log('Launch regression checks passed: security, concurrency, guest creation, notes, reminders, one-seat meals, sleeping-server retry.');
} finally {
  await q('DELETE FROM users WHERE email=$1', [email]);
  server.close(); relay.close(); await pool.end();
}
