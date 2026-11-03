import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';
import { newToken, baseUrl, guestOut, eventOut, defaultEvent, fillTpl, str, int, vegOf, mealOf, TEMPLATES, MSG_STYLES, isHex } from './util.js';
import { sendMail, mailEnabled } from './mail.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production.');
}
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const rsvpLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

  app.get('/api/support', (_req, res) => res.json({ email: process.env.SUPPORT_EMAIL || '' }));
  app.get('/health', wrap(async (_req, res) => { await q('select 1'); res.json({ ok: true }); }));

  const sign = (u) => jwt.sign({ uid: u.id }, SECRET, { expiresIn: '90d' });

  /* ---------- 6-digit email codes: confirming a new email, and resetting a password ---------- */
  // 'email_verifications' and 'password_resets' have the same shape, so one set of helpers serves both.
  const TABLES = { verify: 'email_verifications', reset: 'password_resets' };
  const MAILS = {
    verify: ['Confirm your email for KnotCount', 'Welcome to KnotCount! Use this code to confirm your email.'],
    reset: ['Your KnotCount password reset code', 'Use this code to choose a new KnotCount password.'],
  };
  const validEmail = (s) => /^\S+@\S+\.\S+$/.test(s);

  // Mails a fresh code. Returns 'wait' (and sends nothing) if one went out in the last minute.
  async function issueCode(kind, user) {
    const table = TABLES[kind];
    const last = (await q(`SELECT created_at FROM ${table} WHERE user_id=$1`, [user.id])).rows[0];
    if (last && Date.now() - new Date(last.created_at).getTime() < 60 * 1000) return 'wait';
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await q(
      `INSERT INTO ${table}(user_id, code_hash, expires_at, attempts, created_at)
       VALUES($1, $2, now() + interval '15 minutes', 0, now())
       ON CONFLICT (user_id) DO UPDATE SET code_hash=$2, expires_at=EXCLUDED.expires_at, attempts=0, created_at=now()`,
      [user.id, await bcrypt.hash(code, 8)]
    );
    const [subject, intro] = MAILS[kind];
    await sendMail(user.email, subject, `${intro}\n\nYour code is ${code}\n\nIt works for 15 minutes. If this wasn’t you, you can ignore this email.`);
    return 'sent';
  }
  // null when the code is right (and used up), otherwise the message to show
  async function checkCode(kind, user, code) {
    const table = TABLES[kind];
    const r = user && (await q(`SELECT * FROM ${table} WHERE user_id=$1`, [user.id])).rows[0];
    if (!r || new Date(r.expires_at) < new Date()) return 'That code has expired. Ask for a new one.';
    if (r.attempts >= 5) {
      await q(`DELETE FROM ${table} WHERE user_id=$1`, [user.id]);
      return 'Too many wrong tries. Ask for a new code.';
    }
    if (!(await bcrypt.compare(code, r.code_hash))) {
      await q(`UPDATE ${table} SET attempts=attempts+1 WHERE user_id=$1`, [user.id]);
      return 'That code is not right.';
    }
    await q(`DELETE FROM ${table} WHERE user_id=$1`, [user.id]);
    return null;
  }
  const mailFailed = (res, e) => {
    console.error('mail failed:', e.message);
    return res.status(502).json({ error: 'We could not send the email. Please try again in a few minutes.' });
  };
  const userOut = (u) => ({ id: u.id, email: u.email, name: u.name });

  /* ---------- auth ---------- */
  app.post('/api/auth/register', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const name = str(req.body.name, 100);
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const hash = await bcrypt.hash(password, 11);
    const verify = mailEnabled(); // with email set up, a new account must confirm its email first
    let user, fresh = true;
    try {
      user = (await q('INSERT INTO users(email,name,password_hash,email_verified) VALUES($1,$2,$3,$4) RETURNING id,email,name', [email, name, hash, !verify])).rows[0];
    } catch (e) {
      if (e.code !== '23505') throw e;
      // an earlier sign-up that was never confirmed can simply be started again
      const old = (await q('SELECT id FROM users WHERE email=$1 AND email_verified=false', [email])).rows[0];
      if (!old) return res.status(409).json({ error: 'An account with this email already exists.' });
      user = (await q('UPDATE users SET name=$1, password_hash=$2 WHERE id=$3 RETURNING id,email,name', [name, hash, old.id])).rows[0];
      fresh = false;
    }
    if (fresh) {
      await q(
        'INSERT INTO events(user_id,bride,groom,date_text,time_text,venue,invite_tpl,reminder_tpl) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [user.id, '', '', '', defaultEvent.time_text, '', defaultEvent.invite_tpl, defaultEvent.reminder_tpl]
      );
    }
    if (!verify) return res.status(201).json({ token: sign(user), user });
    try { await issueCode('verify', user); } catch (e) { return mailFailed(res, e); }
    res.status(201).json({ needsVerify: true, email: user.email });
  }));

  app.post('/api/auth/verify', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    const problem = await checkCode('verify', u, str(req.body.code, 10));
    if (problem) return res.status(400).json({ error: problem });
    await q('UPDATE users SET email_verified=true WHERE id=$1', [u.id]);
    res.json({ token: sign(u), user: userOut(u) });
  }));

  app.post('/api/auth/resend', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    if (!mailEnabled()) return res.status(501).json({ error: 'Email is not set up on this server yet.' });
    const u = (await q('SELECT * FROM users WHERE email=$1 AND email_verified=false', [email])).rows[0];
    if (u) { try { await issueCode('verify', u); } catch (e) { return mailFailed(res, e); } }
    res.json({ ok: true });
  }));

  app.post('/api/auth/login', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    const ok = u && (await bcrypt.compare(password, u.password_hash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password.' });
    if (!u.email_verified && mailEnabled()) {
      try { await issueCode('verify', u); } catch (e) { return mailFailed(res, e); }
      return res.status(403).json({ error: 'Please confirm your email first. We just sent you a new code.', needsVerify: true, email: u.email });
    }
    res.json({ token: sign(u), user: userOut(u) });
  }));

  /* ---------- forgot / reset password ---------- */
  app.post('/api/auth/forgot', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (!mailEnabled()) return res.status(501).json({ error: 'Password reset by email is not set up on this server yet.' });
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    // same answer whether or not the account exists, so this can't be used to find who has one
    if (u) { try { await issueCode('reset', u); } catch (e) { return mailFailed(res, e); } }
    res.json({ ok: true });
  }));

  app.post('/api/auth/reset', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    const problem = await checkCode('reset', u, str(req.body.code, 10));
    if (problem) return res.status(400).json({ error: problem });
    // a working reset code also proves the email is theirs
    await q('UPDATE users SET password_hash=$1, email_verified=true WHERE id=$2', [await bcrypt.hash(password, 11), u.id]);
    res.json({ token: sign(u), user: userOut(u) });
  }));

  const auth = wrap(async (req, res, next) => {
    const h = req.get('authorization') || '';
    try {
      const { uid } = jwt.verify(h.replace(/^Bearer /, ''), SECRET);
      const evs = (await q('SELECT * FROM events WHERE user_id=$1 ORDER BY id', [uid])).rows;
      if (!evs.length) return res.status(401).json({ error: 'Account not found.' });
      // an account can hold several weddings; the app says which one with X-Event-Id (the first one if it doesn't)
      const want = Number.parseInt(req.get('x-event-id'), 10);
      const ev = Number.isFinite(want) ? evs.find((e) => e.id === want) : evs[0];
      if (!ev) return res.status(404).json({ error: 'That wedding no longer exists.' });
      req.uid = uid; req.event = ev;
      next();
    } catch { res.status(401).json({ error: 'Please sign in again.' }); }
  });

  app.get('/api/me', auth, wrap(async (req, res) => {
    res.json({ user: userOut((await q('SELECT id,email,name FROM users WHERE id=$1', [req.uid])).rows[0]) });
  }));

  /* ---------- weddings (an account can run more than one) ---------- */
  app.get('/api/events', auth, wrap(async (req, res) => {
    const rows = (await q(
      `SELECT e.*, (SELECT count(*) FROM guests g WHERE g.event_id=e.id)::int AS guest_count
         FROM events e WHERE e.user_id=$1 ORDER BY e.id`, [req.uid])).rows;
    res.json({ events: rows.map((e) => ({ ...eventOut(e), guests: e.guest_count })) });
  }));

  app.post('/api/events', auth, wrap(async (req, res) => {
    const n = (await q('SELECT count(*)::int AS n FROM events WHERE user_id=$1', [req.uid])).rows[0].n;
    if (n >= 10) return res.status(400).json({ error: 'You can have up to 10 weddings in one account.' });
    const r = await q(
      'INSERT INTO events(user_id,bride,groom,time_text,invite_tpl,reminder_tpl) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.uid, str(req.body.bride, 80), str(req.body.groom, 80), defaultEvent.time_text, defaultEvent.invite_tpl, defaultEvent.reminder_tpl]
    );
    res.status(201).json({ event: eventOut(r.rows[0]) });
  }));

  app.delete('/api/events/:id', auth, wrap(async (req, res) => {
    const mine = (await q('SELECT id FROM events WHERE user_id=$1', [req.uid])).rows;
    if (!mine.some((e) => String(e.id) === req.params.id)) return res.status(404).json({ error: 'That wedding no longer exists.' });
    if (mine.length < 2) return res.status(400).json({ error: 'Your account needs at least one wedding.' });
    await q('DELETE FROM events WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
    res.json({ ok: true });
  }));

  /* ---------- account deletion (required by Google Play) ---------- */
  // Deletes the user and, via ON DELETE CASCADE, their event and every guest record.
  app.delete('/api/account', authLimiter, auth, wrap(async (req, res) => {
    await q('DELETE FROM users WHERE id=$1', [req.uid]);
    res.json({ ok: true });
  }));

  // Web form for people who no longer have the app (Play Console asks for this URL).
  app.post('/api/account/delete-request', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Wrong email or password.' });
    await q('DELETE FROM users WHERE id=$1', [u.id]);
    res.json({ ok: true });
  }));

  /* ---------- event ---------- */
  app.get('/api/event', auth, (req, res) => res.json({ event: eventOut(req.event), mail: mailEnabled() }));

  app.put('/api/event', auth, wrap(async (req, res) => {
    const b = req.body || {};
    const e = req.event;
    const r = await q(
      `UPDATE events SET bride=$1, groom=$2, date_text=$3, time_text=$4, venue=$5, invite_tpl=$6, reminder_tpl=$7,
         auto_reminders=$8, template=$9, extra_text=$10, color=$11, msg_style=$12, updated_at=now() WHERE id=$13 RETURNING *`,
      [
        b.bride !== undefined ? str(b.bride, 80) : e.bride,
        b.groom !== undefined ? str(b.groom, 80) : e.groom,
        b.date !== undefined ? str(b.date, 80) : e.date_text,
        b.time !== undefined ? str(b.time, 40) : e.time_text,
        b.venue !== undefined ? str(b.venue, 200) : e.venue,
        b.invite !== undefined ? str(b.invite, 2000) : e.invite_tpl,
        b.reminder !== undefined ? str(b.reminder, 2000) : e.reminder_tpl,
        b.autoReminders !== undefined ? !!b.autoReminders : e.auto_reminders,
        TEMPLATES.includes(b.template) ? b.template : e.template,
        b.extra !== undefined ? str(b.extra, 200) : e.extra_text,
        b.color !== undefined ? (isHex(b.color) ? b.color.toLowerCase() : '') : e.color,
        MSG_STYLES.includes(b.msgStyle) ? b.msgStyle : e.msg_style,
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
    if (!Object.keys(b).length) return res.status(400).json({ error: 'Nothing to update.' });
    const g = clean(b);
    const cur = (await q('SELECT * FROM guests WHERE id=$1 AND event_id=$2', [req.params.id, req.event.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Guest not found.' });
    const sets = [], vals = [];
    const add = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    for (const [k, v] of Object.entries(g)) add(k, v);
    if (g.invited === true) sets.push('invited_at=COALESCE(invited_at, now())');
    const seats = g.seats ?? cur.seats;
    const setStatus = ['pending', 'confirmed', 'declined'].includes(b.status);
    const status = setStatus ? b.status : cur.status;
    if (setStatus) {
      add('status', b.status);
      add('responded_at', b.status === 'pending' ? null : new Date());
      add('responded_via', b.status === 'pending' ? null : 'host');
    }
    if (status === 'confirmed') {
      // never more people than the invite covers
      const wasConfirmed = cur.status === 'confirmed';
      const attending = b.attending !== undefined ? int(b.attending, 1, seats, seats)
        : wasConfirmed ? Math.min(cur.attending, seats) : seats;
      const veg = vegOf(attending, b, wasConfirmed ? cur.veg_count : null);
      add('attending', attending); add('veg_count', veg); add('meal', mealOf(attending, veg));
      if (b.arrival !== undefined) add('arrival', b.arrival === null ? null : int(b.arrival, 0, 1439, null));
    } else {
      add('attending', 0); add('veg_count', null); add('meal', null); add('arrival', null);
    }
    if (b.reminded) sets.push('reminded_at=now()');
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
    const g = (await q('SELECT g.*, e.bride, e.groom, e.date_text, e.time_text, e.venue, e.template, e.color, e.extra_text FROM guests g JOIN events e ON e.id=g.event_id WHERE g.token=$1', [req.params.token])).rows[0];
    if (!g) return res.status(404).json({ error: 'This invitation link is not valid.' });
    res.json({
      event: { bride: g.bride, groom: g.groom, date: g.date_text, time: g.time_text, venue: g.venue, template: g.template, color: g.color, extra: g.extra_text },
      guest: { name: g.name, seats: g.seats, status: g.status, attending: g.attending, vegCount: g.veg_count, meal: g.meal, arrival: g.arrival },
    });
  }));

  app.post('/api/public/:token/rsvp', rsvpLimiter, wrap(async (req, res) => {
    const b = req.body || {};
    const g = (await q('SELECT * FROM guests WHERE token=$1', [req.params.token])).rows[0];
    if (!g) return res.status(404).json({ error: 'This invitation link is not valid.' });
    const yes = b.attending === true || b.attending === 'yes';
    const no = b.attending === false || b.attending === 'no';
    if (!yes && !no) return res.status(400).json({ error: 'Please choose Yes or No.' });
    const count = yes ? int(b.count, 1, g.seats, 1) : 0;
    const veg = yes ? vegOf(count, b) : null;
    const meal = mealOf(count, veg);
    const arrival = yes && b.arrival !== undefined && b.arrival !== null ? int(b.arrival, 0, 1439, null) : null;
    const r = await q(
      `UPDATE guests SET status=$1, attending=$2, meal=$3, veg_count=$4, arrival=$5, note=$6, responded_at=now(), responded_via='link'
       WHERE id=$7 RETURNING *`,
      [yes ? 'confirmed' : 'declined', count, meal, veg, arrival, str(b.note, 500), g.id]
    );
    const x = r.rows[0];
    res.json({ ok: true, guest: { status: x.status, attending: x.attending, vegCount: x.veg_count, meal: x.meal, arrival: x.arrival } });
  }));

  app.use(express.static(path.join(__dirname, '../public'), { index: false }));
  app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, '../public/privacy.html')));
  app.get('/delete-account', (_req, res) => res.sendFile(path.join(__dirname, '../public/delete-account.html')));
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
