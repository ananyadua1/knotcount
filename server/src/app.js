import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';
import { newToken, baseUrl, guestOut, eventOut, defaultEvent, fillTpl, str, int } from './util.js';
import { sendMail, mailEnabled } from './mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET is not set. Set it in your host’s environment settings.');
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const rsvpLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

  app.get('/health', wrap(async (_req, res) => { await q('select 1'); res.json({ ok: true }); }));

  /* ---------- auth ---------- */
  const sign = (u) => jwt.sign({ uid: u.id }, SECRET, { expiresIn: '90d' });

  app.post('/api/auth/register', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const name = str(req.body.name, 100);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const hash = await bcrypt.hash(password, 11);
    let user;
    try {
      user = (await q('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email,name', [email, name, hash])).rows[0];
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      throw e;
    }
    await q(
      'INSERT INTO events(user_id,bride,groom,date_text,time_text,venue,invite_tpl,reminder_tpl) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [user.id, '', '', '', defaultEvent.time_text, '', defaultEvent.invite_tpl, defaultEvent.reminder_tpl]
    );
    res.status(201).json({ token: sign(user), user });
  }));

  app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    const ok = u && (await bcrypt.compare(password, u.password_hash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
    res.json({ token: sign(u), user: { id: u.id, email: u.email, name: u.name } });
  }));

  const auth = wrap(async (req, res, next) => {
    const h = req.get('authorization') || '';
    try {
      const { uid } = jwt.verify(h.replace(/^Bearer /, ''), SECRET);
      const ev = (await q('SELECT * FROM events WHERE user_id=$1', [uid])).rows[0];
      if (!ev) return res.status(401).json({ error: 'Account not found.' });
      req.uid = uid; req.event = ev;
      next();
    } catch { res.status(401).json({ error: 'Please sign in again.' }); }
  });

  /* ---------- event ---------- */
  app.get('/api/event', auth, (req, res) => res.json({ event: eventOut(req.event), mail: mailEnabled() }));

  app.put('/api/event', auth, wrap(async (req, res) => {
    const b = req.body || {};
    const e = req.event;
    const r = await q(
      `UPDATE events SET bride=$1, groom=$2, date_text=$3, time_text=$4, venue=$5, invite_tpl=$6, reminder_tpl=$7,
         auto_reminders=$8, updated_at=now() WHERE id=$9 RETURNING *`,
      [
        b.bride !== undefined ? str(b.bride, 80) : e.bride,
        b.groom !== undefined ? str(b.groom, 80) : e.groom,
        b.date !== undefined ? str(b.date, 80) : e.date_text,
        b.time !== undefined ? str(b.time, 40) : e.time_text,
        b.venue !== undefined ? str(b.venue, 200) : e.venue,
        b.invite !== undefined ? str(b.invite, 2000) : e.invite_tpl,
        b.reminder !== undefined ? str(b.reminder, 2000) : e.reminder_tpl,
        b.autoReminders !== undefined ? !!b.autoReminders : e.auto_reminders,
        e.id,
      ]
    );
    res.json({ event: eventOut(r.rows[0]) });
  }));

  /* ---------- guests ---------- */
  const listGuests = async (eventId, base) =>
    (await q('SELECT * FROM guests WHERE event_id=$1 ORDER BY lower(name), id', [eventId])).rows.map((g) => guestOut(g, base));

  app.get('/api/guests', auth, wrap(async (req, res) => res.json({ guests: await listGuests(req.event.id, baseUrl(req)) })));

  const clean = (b) => {
    const out = {};
    if (b.name !== undefined) out.name = str(b.name, 120);
    if (b.phone !== undefined) out.phone = str(b.phone, 30);
    if (b.email !== undefined) out.email = str(b.email, 200);
    if (b.side !== undefined && ['bride', 'groom', 'both'].includes(b.side)) out.side = b.side;
    if (b.seats !== undefined) out.seats = int(b.seats, 1, 50, 1);
    if (b.note !== undefined) out.note = str(b.note, 500);
    if (b.invited !== undefined) out.invited = !!b.invited;
    return out;
  };

  app.post('/api/guests', auth, wrap(async (req, res) => {
    const list = Array.isArray(req.body.guests) ? req.body.guests : [req.body];
    if (list.length > 1000) return res.status(400).json({ error: 'Too many guests at once.' });
    const created = [];
    for (const raw of list) {
      const g = clean(raw);
      if (!g.name) continue;
      const r = await q(
        `INSERT INTO guests(event_id,token,name,phone,email,side,seats,note,invited)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.event.id, newToken(), g.name, g.phone || '', g.email || '', g.side || 'both', g.seats || 1, g.note || '', !!g.invited]
      );
      created.push(guestOut(r.rows[0], baseUrl(req)));
    }
    res.status(201).json({ guests: created });
  }));

  app.patch('/api/guests/:id', auth, wrap(async (req, res) => {
    const b = req.body || {};
    const g = clean(b);
    const sets = [], vals = [];
    const add = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    for (const [k, v] of Object.entries(g)) add(k, v);
    if (g.invited === true) sets.push('invited_at=COALESCE(invited_at, now())');
    if (b.status !== undefined && ['pending', 'confirmed', 'declined'].includes(b.status)) {
      add('status', b.status);
      add('attending', b.status === 'confirmed' ? int(b.attending, 1, 60, 1) : 0);
      add('responded_at', b.status === 'pending' ? null : new Date());
      add('responded_via', b.status === 'pending' ? null : 'host');
      if (b.status !== 'confirmed') { add('meal', null); add('arrival', null); }
    }
    if (b.status === 'confirmed' || (b.status === undefined && (b.meal !== undefined || b.arrival !== undefined))) {
      if (b.meal !== undefined) add('meal', ['veg', 'nonveg'].includes(b.meal) ? b.meal : null);
      if (b.arrival !== undefined) add('arrival', b.arrival === null ? null : int(b.arrival, 0, 1439, null));
    }
    if (b.reminded) sets.push('reminded_at=now()');
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id, req.event.id);
    const r = await q(`UPDATE guests SET ${sets.join(', ')} WHERE id=$${vals.length - 1} AND event_id=$${vals.length} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'Guest not found.' });
    res.json({ guest: guestOut(r.rows[0], baseUrl(req)) });
  }));

  app.delete('/api/guests/:id', auth, wrap(async (req, res) => {
    await q('DELETE FROM guests WHERE id=$1 AND event_id=$2', [req.params.id, req.event.id]);
    res.json({ ok: true });
  }));

  /* ---------- reminders by email (optional SMTP) ---------- */
  app.post('/api/reminders/email', auth, wrap(async (req, res) => {
    if (!mailEnabled()) return res.status(501).json({ error: 'Email is not set up on this server yet.' });
    const r = await runEmailReminders(req.event, baseUrl(req));
    res.json(r);
  }));

  /* ---------- public RSVP (what guests see) ---------- */
  app.get('/api/public/:token', rsvpLimiter, wrap(async (req, res) => {
    const g = (await q('SELECT g.*, e.bride, e.groom, e.date_text, e.time_text, e.venue FROM guests g JOIN events e ON e.id=g.event_id WHERE g.token=$1', [req.params.token])).rows[0];
    if (!g) return res.status(404).json({ error: 'This invitation link is not valid.' });
    res.json({
      event: { bride: g.bride, groom: g.groom, date: g.date_text, time: g.time_text, venue: g.venue },
      guest: { name: g.name, seats: g.seats, status: g.status, attending: g.attending, meal: g.meal, arrival: g.arrival },
    });
  }));

  app.post('/api/public/:token/rsvp', rsvpLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    const g = (await q('SELECT * FROM guests WHERE token=$1', [req.params.token])).rows[0];
    if (!g) return res.status(404).json({ error: 'This invitation link is not valid.' });
    const yes = b.attending === true || b.attending === 'yes';
    const no = b.attending === false || b.attending === 'no';
    if (!yes && !no) return res.status(400).json({ error: 'Please choose Yes or No.' });
    const count = yes ? int(b.count, 1, g.seats + 4, Math.min(g.seats, 1)) : 0;
    const meal = yes && ['veg', 'nonveg'].includes(b.meal) ? b.meal : null;
    const arrival = yes && b.arrival !== undefined && b.arrival !== null ? int(b.arrival, 0, 1439, null) : null;
    const r = await q(
      `UPDATE guests SET status=$1, attending=$2, meal=$3, arrival=$4, note=$5, responded_at=now(), responded_via='link'
       WHERE id=$6 RETURNING *`,
      [yes ? 'confirmed' : 'declined', count, meal, arrival, str(b.note, 500), g.id]
    );
    const x = r.rows[0];
    res.json({ ok: true, guest: { status: x.status, attending: x.attending, meal: x.meal, arrival: x.arrival } });
  }));

  app.use(express.static(path.join(__dirname, '../public'), { index: false }));
  app.get('/r/:token', (_req, res) => res.sendFile(path.join(__dirname, '../public/rsvp.html')));
  app.get('/', (_req, res) => res.type('text').send('KnotCount server is running.'));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  return app;
}

export async function runEmailReminders(ev, base, { onlyStale = false } = {}) {
  const rows = (await q(
    `SELECT * FROM guests WHERE event_id=$1 AND status='pending' AND email<>''
       ${onlyStale ? "AND (reminded_at IS NULL OR reminded_at < now() - interval '3 days')" : ''}`,
    [ev.id]
  )).rows;
  let sent = 0, failed = 0;
  for (const g of rows) {
    try {
      const link = `${base}/r/${g.token}`;
      await sendMail(g.email, `Please confirm: ${ev.bride} & ${ev.groom}’s wedding`, fillTpl(ev.reminder_tpl, g, ev, link));
      await q('UPDATE guests SET reminded_at=now() WHERE id=$1', [g.id]);
      sent++;
    } catch (e) { failed++; console.error('mail failed', g.id, e.message); }
  }
  return { sent, failed, skipped: 0 };
}
