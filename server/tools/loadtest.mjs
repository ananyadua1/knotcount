// Simulates a wave of guests opening their links and replying.
//   node tools/loadtest.mjs [baseUrl] [seconds] [concurrency]
// Needs a server with email OFF (so it can create a throwaway account), e.g. a local one. It does not run against production.
// Each request pretends to come from a different phone (X-Forwarded-For), like real guests, so the per-IP limit isn't what's measured.
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const seconds = Number(process.argv[3] || 10);
const concurrency = Number(process.argv[4] || 25);
const GUESTS = 300;

const call = async (method, path, body, token, ip) => {
  const t0 = performance.now();
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json, ms: performance.now() - t0 };
};

const email = `load${Date.now()}@example.com`;
let r = await call('POST', '/api/auth/register', { email, password: 'loadtest-pass-1', name: 'Load' });
if (r.status !== 201 || !r.json.token) { console.error('Could not create the test account (is email turned on? this tool needs it off):', r.status, r.json); process.exit(1); }
const T = r.json.token;
await call('PUT', '/api/event', { bride: 'Load', groom: 'Test', date: 'Sat', venue: 'Hall' }, T);
r = await call('POST', '/api/guests', { guests: Array.from({ length: GUESTS }, (_, i) => ({ name: `Guest ${i}`, seats: 4 })) }, T);
const tokens = r.json.guests.map((g) => g.token);
console.log(`Created ${tokens.length} guests. Running ${concurrency} at a time for ${seconds}s against ${base} ...`);

const rnd = (n) => Math.floor(Math.random() * n);
const fakeIp = () => `${10 + rnd(200)}.${rnd(250)}.${rnd(250)}.${1 + rnd(250)}`;
const kinds = {
  open: { ms: [], bad: 0 },    // guest opens the RSVP page's data
  reply: { ms: [], bad: 0 },   // guest sends their reply
  host: { ms: [], bad: 0 },    // host's app refreshing the guest list
  health: { ms: [], bad: 0 },
};
const one = async () => {
  const x = Math.random(), tok = tokens[rnd(tokens.length)], ip = fakeIp();
  let kind, res;
  if (x < 0.45) { kind = 'open'; res = await call('GET', `/api/public/${tok}`, null, null, ip); }
  else if (x < 0.75) { kind = 'reply'; res = await call('POST', `/api/public/${tok}/rsvp`, { attending: true, count: 1 + rnd(4), veg: rnd(2), arrival: 1140 }, null, ip); }
  else if (x < 0.95) { kind = 'host'; res = await call('GET', '/api/guests', null, T, ip); }
  else { kind = 'health'; res = await call('GET', '/health', null, null, ip); }
  kinds[kind].ms.push(res.ms);
  if (res.status >= 400) kinds[kind].bad++;
};

const stopAt = Date.now() + seconds * 1000;
const t0 = Date.now();
await Promise.all(Array.from({ length: concurrency }, async () => { while (Date.now() < stopAt) { try { await one(); } catch { kinds.health.bad++; } } }));
const elapsed = (Date.now() - t0) / 1000;

const pct = (a, p) => (a.length ? a.slice().sort((m, n) => m - n)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
let total = 0, bad = 0;
console.log('\nrequest     count   errors   p50 ms   p95 ms   p99 ms');
for (const [k, v] of Object.entries(kinds)) {
  total += v.ms.length; bad += v.bad;
  console.log(`${k.padEnd(10)} ${String(v.ms.length).padStart(6)} ${String(v.bad).padStart(8)} ${pct(v.ms, 0.5).toFixed(0).padStart(8)} ${pct(v.ms, 0.95).toFixed(0).padStart(8)} ${pct(v.ms, 0.99).toFixed(0).padStart(8)}`);
}
console.log(`\n${total} requests in ${elapsed.toFixed(1)}s = ${(total / elapsed).toFixed(0)} requests/second, ${bad} errors`);
await call('DELETE', '/api/account', null, T);
process.exit(bad ? 1 : 0);
