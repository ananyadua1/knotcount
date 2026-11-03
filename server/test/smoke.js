// End-to-end smoke test against a real Postgres. Run: DATABASE_URL=... node test/smoke.js
import { migrate, pool } from '../src/db.js';
import { createApp } from '../src/app.js';
import assert from 'node:assert/strict';
import http from 'node:http';

await migrate();
const app = createApp();
const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}`;
const call = async (method, path, body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const email = `t${Date.now()}@example.com`;

let r = await call('POST', '/api/auth/register', { email, password: 'short' });
assert.equal(r.status, 400);
r = await call('POST', '/api/auth/register', { email, password: 'longenough1', name: 'Test' });
assert.equal(r.status, 201); const T = r.json.token;
r = await call('POST', '/api/auth/register', { email, password: 'longenough1' }); assert.equal(r.status, 409);
r = await call('POST', '/api/auth/login', { email, password: 'wrong-pass' }); assert.equal(r.status, 401);
r = await call('POST', '/api/auth/login', { email, password: 'longenough1' }); assert.equal(r.status, 200);
r = await call('GET', '/api/guests'); assert.equal(r.status, 401);

r = await call('PUT', '/api/event', { bride: 'Ananya', groom: 'Rohan', date: 'Sat, 20 Feb 2027', venue: 'Jaipur' }, T);
assert.equal(r.json.event.bride, 'Ananya');
r = await call('POST', '/api/guests', { guests: [{ name: 'Sharma family', seats: 4, phone: '9876543210' }, { name: 'Priya Mehta' }] }, T);
assert.equal(r.status, 201); assert.equal(r.json.guests.length, 2);
const [sharma, priya] = r.json.guests;
assert.match(sharma.link, /\/r\/[\w-]{20,}$/);

// guest opens the public link and replies, no login
r = await call('GET', `/api/public/${sharma.token}`); assert.equal(r.json.guest.name, 'Sharma family');
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 3, veg: 1, arrival: 1125 });
assert.equal(r.json.guest.status, 'confirmed'); assert.equal(r.json.guest.vegCount, 1); // 1 veg + 2 non-veg
r = await call('POST', `/api/public/${priya.token}/rsvp`, { attending: false });
assert.equal(r.json.guest.status, 'declined');
r = await call('POST', `/api/public/${sharma.token}/rsvp`, {}); assert.equal(r.status, 400);
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 99 });
assert.equal(r.json.guest.attending, 4); // capped at the 4 invited seats
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 3, veg: 9, arrival: 1125 });
assert.equal(r.json.guest.vegCount, 3); // veg can't exceed the people coming
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 3, veg: 1, arrival: 1125 });
r = await call('GET', '/api/public/not-a-token'); assert.equal(r.status, 404);

// host sees live results
r = await call('GET', '/api/guests', null, T);
const s = r.json.guests.find((g) => g.name === 'Sharma family');
assert.equal(s.status, 'confirmed'); assert.equal(s.attending, 3); assert.equal(s.vegCount, 1); assert.equal(s.via, 'link'); assert.equal(s.arrival, 1125);

// another host cannot touch these guests
const r2 = await call('POST', '/api/auth/register', { email: `o${email}`, password: 'longenough1' });
r = await call('GET', '/api/guests', null, r2.json.token); assert.equal(r.json.guests.length, 0);
r = await call('PATCH', `/api/guests/${s.id}`, { name: 'hacked' }, r2.json.token); assert.equal(r.status, 404);
r = await call('DELETE', `/api/guests/${s.id}`, null, r2.json.token);
r = await call('GET', '/api/guests', null, T); assert.equal(r.json.guests.length, 2);

// manual override + mark sent
r = await call('PATCH', `/api/guests/${priya.id}`, { status: 'confirmed', attending: 2, invited: true, reminded: true }, T);
assert.equal(r.json.guest.status, 'confirmed'); assert.equal(r.json.guest.invited, true); assert.ok(r.json.guest.reminded);
// host edits: attendance capped at seats, veg split kept in range, shrinking seats trims the reply
r = await call('PATCH', `/api/guests/${sharma.id}`, { status: 'confirmed', attending: 99, vegCount: 2 }, T);
assert.equal(r.json.guest.attending, 4); assert.equal(r.json.guest.vegCount, 2);
r = await call('PATCH', `/api/guests/${sharma.id}`, { seats: 2 }, T);
assert.equal(r.json.guest.attending, 2); assert.equal(r.json.guest.vegCount, 2);
r = await call('PATCH', `/api/guests/${sharma.id}`, { status: 'declined' }, T);
assert.equal(r.json.guest.attending, 0); assert.equal(r.json.guest.vegCount, null);
r = await call('PATCH', `/api/guests/${sharma.id}`, {}, T); assert.equal(r.status, 400);
r = await call('DELETE', `/api/guests/${priya.id}`, null, T);
r = await call('GET', '/api/guests', null, T); assert.equal(r.json.guests.length, 1);
const html = await (await fetch(`${base}/r/${sharma.token}`)).text(); assert.ok(html.includes('will you join us'));


// invite design + extra line are saved and shown on the guest page's data
r = await call('PUT', '/api/event', { template: 'royal', extra: 'Dress code: festive' }, T);
assert.equal(r.json.event.template, 'royal'); assert.equal(r.json.event.extra, 'Dress code: festive');
r = await call('PUT', '/api/event', { template: 'nonsense' }, T); assert.equal(r.json.event.template, 'royal'); // unknown design ignored
r = await call('POST', '/api/guests', { name: 'Gupta family', seats: 2 }, T);
r = await call('GET', `/api/public/${r.json.guests[0].token}`); assert.equal(r.json.event.template, 'royal'); assert.equal(r.json.event.extra, 'Dress code: festive');

// forgot / reset password, with a fake mail relay standing in for the Gmail script
r = await call('POST', '/api/auth/forgot', { email }); assert.equal(r.status, 501); // no mail configured yet
const mails = [];
const relay = http.createServer((req, res) => {
  if (req.method === 'GET') return res.end('ok'); // where the redirect lands
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { mails.push(JSON.parse(b)); res.writeHead(302, { Location: '/done' }).end(); });
}).listen(0);
process.env.MAIL_WEBHOOK_URL = `http://localhost:${relay.address().port}`; process.env.MAIL_WEBHOOK_SECRET = 'shh';
r = await call('POST', '/api/auth/forgot', { email: 'nobody@example.com' }); assert.equal(r.status, 200); assert.equal(mails.length, 0);
r = await call('POST', '/api/auth/forgot', { email }); assert.equal(r.status, 200); assert.equal(mails.length, 1);
assert.equal(mails[0].to, email); assert.equal(mails[0].secret, 'shh');
const code = /\b(\d{6})\b/.exec(mails[0].text)[1];
r = await call('POST', '/api/auth/reset', { email, code: '000000' === code ? '111111' : '000000', password: 'brandnew123' }); assert.equal(r.status, 400);
r = await call('POST', '/api/auth/reset', { email, code, password: 'short' }); assert.equal(r.status, 400);
r = await call('POST', '/api/auth/reset', { email, code, password: 'brandnew123' }); assert.equal(r.status, 200); assert.ok(r.json.token);
r = await call('POST', '/api/auth/login', { email, password: 'longenough1' }); assert.equal(r.status, 401); // old password gone
r = await call('POST', '/api/auth/login', { email, password: 'brandnew123' }); assert.equal(r.status, 200);
r = await call('POST', '/api/auth/reset', { email, code, password: 'another12345' }); assert.equal(r.status, 400); // a code works once

// with email set up, a new account must confirm its email before it can sign in
const vemail = `v${Date.now()}@example.com`;
const before = mails.length;
r = await call('POST', '/api/auth/register', { email: vemail, password: 'longenough1', name: 'Verify Me' });
assert.equal(r.status, 201); assert.equal(r.json.needsVerify, true); assert.equal(r.json.token, undefined);
assert.equal(mails.length, before + 1); assert.equal(mails[before].to, vemail);
const vcode = /\b(\d{6})\b/.exec(mails[before].text)[1];
r = await call('POST', '/api/auth/login', { email: vemail, password: 'longenough1' });
assert.equal(r.status, 403); assert.equal(r.json.needsVerify, true); assert.equal(mails.length, before + 1); // a code just went out, so no second email yet
r = await call('POST', '/api/auth/register', { email: vemail, password: 'anotherpass1' }); assert.equal(r.status, 201); // unconfirmed sign-up can be redone
r = await call('POST', '/api/auth/verify', { email: vemail, code: vcode === '000000' ? '111111' : '000000' }); assert.equal(r.status, 400);
r = await call('POST', '/api/auth/verify', { email: vemail, code: vcode }); assert.equal(r.status, 200); assert.ok(r.json.token);
r = await call('POST', '/api/auth/login', { email: vemail, password: 'anotherpass1' }); assert.equal(r.status, 200);
r = await call('POST', '/api/auth/verify', { email: vemail, code: vcode }); assert.equal(r.status, 400); // a code works once
const VT = r.status === 400 ? (await call('POST', '/api/auth/login', { email: vemail, password: 'anotherpass1' })).json.token : null;

// one account, several weddings
r = await call('GET', '/api/events', null, VT); assert.equal(r.json.events.length, 1);
const w1 = r.json.events[0].id;
r = await call('POST', '/api/events', { bride: 'Meera', groom: 'Kabir' }, VT); assert.equal(r.status, 201);
const w2 = r.json.event.id; assert.notEqual(w1, w2);
const as = (id) => (m, p, b) => fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VT}`, 'X-Event-Id': String(id) }, body: b ? JSON.stringify(b) : undefined }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})) }));
r = await as(w2)('POST', '/api/guests', { name: 'Only in second' }); assert.equal(r.status, 201);
r = await as(w1)('GET', '/api/guests'); assert.equal(r.json.guests.length, 0); // guests belong to their own wedding
r = await as(w2)('GET', '/api/guests'); assert.equal(r.json.guests.length, 1);
r = await as(w2)('PUT', '/api/event', { template: 'custom', color: '#1F3A5F', msgStyle: 'formal' });
assert.equal(r.json.event.color, '#1f3a5f'); assert.equal(r.json.event.msgStyle, 'formal');
r = await as(w2)('PUT', '/api/event', { color: 'blue', msgStyle: 'rude' }); assert.equal(r.json.event.color, ''); assert.equal(r.json.event.msgStyle, 'formal'); // bad values ignored
r = await as(999999)('GET', '/api/guests'); assert.equal(r.status, 404);
r = await call('GET', '/api/events', null, T); assert.ok(r.json.events.every((e) => e.id !== w2)); // other accounts never see it
r = await call('DELETE', `/api/events/${w2}`, null, T); assert.equal(r.status, 404);
r = await call('DELETE', `/api/events/${w2}`, null, VT); assert.equal(r.status, 200);
r = await call('DELETE', `/api/events/${w1}`, null, VT); assert.equal(r.status, 400); // the last wedding stays
relay.close();

// account deletion removes everything
r = await call('DELETE', '/api/account', null, T); assert.equal(r.status, 200);
r = await call('GET', '/api/guests', null, T); assert.equal(r.status, 401);
r = await call('GET', `/api/public/${sharma.token}`); assert.equal(r.status, 404);
r = await call('POST', '/api/auth/login', { email, password: 'longenough1' }); assert.equal(r.status, 401);
assert.equal((await fetch(`${base}/privacy`)).status, 200);
assert.equal((await fetch(`${base}/delete-account`)).status, 200);

console.log('all server checks passed');
srv.close(); await pool.end();
