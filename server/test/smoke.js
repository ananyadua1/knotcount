// End-to-end smoke test against a real Postgres. Run: DATABASE_URL=... node test/smoke.js
import { migrate, pool } from '../src/db.js';
import { createApp } from '../src/app.js';
import assert from 'node:assert/strict';

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
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 3, meal: 'veg', arrival: 1125 });
assert.equal(r.json.guest.status, 'confirmed');
r = await call('POST', `/api/public/${priya.token}/rsvp`, { attending: false });
assert.equal(r.json.guest.status, 'declined');
r = await call('POST', `/api/public/${sharma.token}/rsvp`, {}); assert.equal(r.status, 400);
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 99 });
assert.equal(r.json.guest.attending, 8); // capped at seats + 4
r = await call('POST', `/api/public/${sharma.token}/rsvp`, { attending: true, count: 3, meal: 'veg', arrival: 1125 });
r = await call('GET', '/api/public/not-a-token'); assert.equal(r.status, 404);

// host sees live results
r = await call('GET', '/api/guests', null, T);
const s = r.json.guests.find((g) => g.name === 'Sharma family');
assert.equal(s.status, 'confirmed'); assert.equal(s.attending, 3); assert.equal(s.via, 'link'); assert.equal(s.arrival, 1125);

// another host cannot touch these guests
const r2 = await call('POST', '/api/auth/register', { email: `o${email}`, password: 'longenough1' });
r = await call('GET', '/api/guests', null, r2.json.token); assert.equal(r.json.guests.length, 0);
r = await call('PATCH', `/api/guests/${s.id}`, { name: 'hacked' }, r2.json.token); assert.equal(r.status, 404);
r = await call('DELETE', `/api/guests/${s.id}`, null, r2.json.token);
r = await call('GET', '/api/guests', null, T); assert.equal(r.json.guests.length, 2);

// manual override + mark sent
r = await call('PATCH', `/api/guests/${priya.id}`, { status: 'confirmed', attending: 2, invited: true, reminded: true }, T);
assert.equal(r.json.guest.status, 'confirmed'); assert.equal(r.json.guest.invited, true); assert.ok(r.json.guest.reminded);
r = await call('DELETE', `/api/guests/${priya.id}`, null, T);
r = await call('GET', '/api/guests', null, T); assert.equal(r.json.guests.length, 1);
const html = await (await fetch(`${base}/r/${sharma.token}`)).text(); assert.ok(html.includes('will you attend'));

console.log('all server checks passed');
srv.close(); await pool.end();
