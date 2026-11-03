import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q, transaction } from './db.js';
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
  app.use(cors({ origin: process.env.WEB_ORIGIN || false }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'Send a JSON object.' });
    req.body ??= {}; next();
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const rsvpLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

  app.get('/api/support', (_req, res) => res.json({ email: process.env.SUPPORT_EMAIL || 'domaincraftstudios@gmail.com' }));
  app.get('/health', wrap(async (_req, res) => { await q('select 1'); res.json({ ok: true }); }));

  const sign = (u) => jwt.sign({ uid: u.id, sv: u.session_version ?? 0 }, SECRET, { expiresIn: '30d', algorithm: 'HS256' });

  /* ---------- 6-digit email codes: confirming a new email, and resetting a password ---------- */
  // 'email_verifications' and 'password_resets' have the same shape, so one set of helpers serves both.
  const TABLES = { verify: 'email_verifications', reset: 'password_resets' };
  const MAILS = {
    verify: ['Confirm your email for KnotCount', 'Welcome to KnotCount! Use this code to confirm your email.'],
    reset: ['Your KnotCount password reset code', 'Use this code to choose a new KnotCount password.'],
  };
  const validEmail = (s) => /^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(s);

  // Mails a fresh code. Returns 'wait' (and sends nothing) if one went out in the last minute.
  async function issueCode(kind, user) {
    const table = TABLES[kind];
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const hash = await bcrypt.hash(code, 8);
    const issued = await q(
      `INSERT INTO ${table}(user_id, code_hash, expires_at, attempts, created_at)
       VALUES($1, $2, now() + interval '15 minutes', 0, now())
       ON CONFLICT (user_id) DO UPDATE SET code_hash=$2, expires_at=EXCLUDED.expires_at, attempts=0, created_at=now()
       WHERE ${table}.created_at < now() - interval '1 minute' RETURNING user_id`, [user.id, hash]);
    if (!issued.rows.length) return 'wait';
    const [subject, intro] = MAILS[kind];
    try { await sendMail(user.email, subject, `${intro}\n\nYour code is ${code}\n\nIt works for 15 minutes. If this wasn’t you, you can ignore this email.`); } catch (error) {
      await q(`DELETE FROM ${table} WHERE user_id=$1 AND code_hash=$2`, [user.id, hash]);
      throw error;
    }
    return 'sent';
  }
  // Lock the code until both consumption and the account change commit.
  async function useCode(kind, email, code, apply) {
    return transaction(async (db) => {
      const user = (await db('SELECT * FROM users WHERE email=$1 FOR UPDATE', [email])).rows[0];
      if (!user) return { error: 'That code has expired. Ask for a new one.' };
      const table = TABLES[kind];
      const r = (await db(`SELECT * FROM ${table} WHERE user_id=$1 FOR UPDATE`, [user.id])).rows[0];
      if (!r || new Date(r.expires_at) < new Date()) return { error: 'That code has expired. Ask for a new one.' };
      if (r.attempts >= 5) return { error: 'Too many wrong tries. Ask for a new code.' };
      if (!(await bcrypt.compare(code, r.code_hash))) {
        await db(`UPDATE ${table} SET attempts=attempts+1 WHERE user_id=$1`, [user.id]);
        return { error: 'That code is not right.' };
      }
      await db(`DELETE FROM ${table} WHERE user_id=$1`, [user.id]);
      return { user: await apply(db, user) };
    });
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
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Use at least 8 characters and no more than 72 bytes for your password.' });
    const hash = await bcrypt.hash(password, 11);
    const verify = mailEnabled(); // with email set up, a new account must confirm its email first
    let user;
    try {
      user = await transaction(async (db) => {
        const u = (await db('INSERT INTO users(email,name,password_hash,email_verified) VALUES($1,$2,$3,$4) RETURNING *', [email, name, hash, !verify])).rows[0];
        await db('INSERT INTO events(user_id,time_text,invite_tpl,reminder_tpl) VALUES($1,$2,$3,$4)',
          [u.id, defaultEvent.time_text, defaultEvent.invite_tpl, defaultEvent.reminder_tpl]);
        return u;
      });
    } catch (e) {
      if (e.code !== '23505') throw e;
      return res.status(409).json({ error: 'An account with this email already exists. Sign in to confirm your email, or reset your password.' });
    }
    if (!verify) return res.status(201).json({ token: sign(user), user: userOut(user) });
    try { await issueCode('verify', user); } catch (e) { return mailFailed(res, e); }
    res.status(201).json({ needsVerify: true, email: user.email });
  }));

  app.post('/api/auth/verify', authLimiter, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const result = await useCode('verify', email, str(req.body.code, 10), async (db, u) =>
      (await db('UPDATE users SET email_verified=true WHERE id=$1 RETURNING *', [u.id])).rows[0]);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ token: sign(result.user), user: userOut(result.user) });
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
    if (!u.email_verified) {
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
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Use at least 8 characters and no more than 72 bytes for your password.' });
    const hash = await bcrypt.hash(password, 11);
    const result = await useCode('reset', email, str(req.body.code, 10), async (db, u) => {
      await db('DELETE FROM email_verifications WHERE user_id=$1', [u.id]);
      return (await db('UPDATE users SET password_hash=$1, email_verified=true, session_version=session_version+1 WHERE id=$2 RETURNING *', [hash, u.id])).rows[0];
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ token: sign(result.user), user: userOut(result.user) });
  }));

  const auth = wrap(async (req, res, next) => {
    const h = req.get('authorization') || '';
    try {
      const { uid, sv } = jwt.verify(h.replace(/^Bearer /, ''), SECRET, { algorithms: ['HS256'] });
      const user = (await q('SELECT session_version,email_verified FROM users WHERE id=$1', [uid])).rows[0];
      if (!user || !user.email_verified || sv !== user.session_version) return res.status(401).json({ error: 'Please sign in again.' });
      const evs = (await q('SELECT * FROM events WHERE user_id=$1 ORDER BY id', [uid])).rows;
      if (!evs.length) return res.status(401).json({ error: 'Account not found.' });
      // an account can hold several weddings; the app says which one with X-Event-Id (the first one if it doesn't)
      const want = Number.parseInt(req.get('x-event-id'), 10);
      const ev = Number.isFinite(want) ? evs.find((e) => e.id === want) : evs[0];
      if (!ev) return res.status(404).json({ error: 'That wedding no longer exists.' });
      req.uid = uid; req.event = ev;
      next();
    } catch (error) {
      if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return res.status(401).json({ error: 'Please sign in again.' });
      throw error;
    }
  });

  app.post('/api/auth/logout', auth, wrap(async (req, res) => {
    await q('UPDATE users SET session_version=session_version+1 WHERE id=$1', [req.uid]);
    res.json({ ok: true });
  }));

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
    if (!list.length || list.some(raw => !raw || typeof raw !== 'object' || !str(raw.name, 120))) return res.status(400).json({ error: 'Every guest needs a name.' });
    if (list.some(raw => raw.email && !validEmail(str(raw.email, 200)))) return res.status(400).json({ error: 'Enter one valid email address per guest.' });
    const created = await transaction(async (db) => {
      const result = [];
      for (const raw of list) {
        const g = clean(raw);
        const seats = g.seats || 1;
        const status = ['confirmed', 'declined'].includes(raw.status) ? raw.status : 'pending';
        const attending = status === 'confirmed' ? int(raw.attending, 1, seats, seats) : 0;
        const veg = status === 'confirmed' ? vegOf(attending, raw) : null;
        const r = await db(
          `INSERT INTO guests(event_id,token,name,phone,email,side,seats,note,invited,status,attending,veg_count,meal,arrival,responded_at,responded_via,invited_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
          [req.event.id, newToken(), g.name, g.phone || '', g.email || '', g.side || 'both', seats, g.note || '', !!g.invited,
           status, attending, veg, mealOf(attending, veg), status === 'confirmed' ? int(raw.arrival, 0, 1439, null) : null,
           status === 'pending' ? null : new Date(), status === 'pending' ? null : 'host', g.invited ? new Date() : null]);
        result.push(guestOut(r.rows[0], baseUrl(req)));
      }
      return result;
    });
    res.status(201).json({ guests: created });
  }));

  app.patch('/api/guests/:id', auth, wrap(async (req, res) => {
    const b = req.body || {};
    if (!Object.keys(b).length) return res.status(400).json({ error: 'Nothing to update.' });
    const g = clean(b);
    if (g.email && !validEmail(g.email)) return res.status(400).json({ error: 'Enter one valid email address.' });
    if (g.name === '') return res.status(400).json({ error: 'Enter a guest name.' });
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
  const reminderLimiter = rateLimit({ windowMs: 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false });
  app.post('/api/reminders/email', auth, reminderLimiter, wrap(async (req, res) => {
    if (!mailEnabled()) return res.status(501).json({ error: 'Email is not set up on this server yet.' });
    const queued = await q(`UPDATE guests SET reminder_requested_at=now() WHERE event_id=$1
      AND status='pending' AND invited=true AND email<>'' AND reminder_requested_at IS NULL
      AND (reminded_at IS NULL OR reminded_at < now() - interval '1 day')
      AND (email_claimed_at IS NULL OR email_claimed_at < now() - interval '1 day') RETURNING id`, [req.event.id]);
    res.status(202).json({ queued: queued.rows.length });
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
      `UPDATE guests SET status=$1, attending=$2, meal=$3, veg_count=$4, arrival=$5, guest_note=COALESCE($6, guest_note), responded_at=now(), responded_via='link'
       WHERE id=$7 RETURNING *`,
      [yes ? 'confirmed' : 'declined', count, meal, veg, arrival, b.note === undefined ? null : str(b.note, 500), g.id]
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
    const status = [400, 413, 429].includes(err.status) ? err.status : 500;
    res.status(status).json({ error: status === 400 ? 'Invalid request.' : status === 413 ? 'This request is too large.' : 'Something went wrong on the server. Please try again.' });
  });
  return app;
}

export async function runEmailReminders(ev, base, { onlyStale = false } = {}) {
  if (!/^https?:\/\//.test(base)) throw new Error('PUBLIC_URL is required for reminders');
  const days = onlyStale ? 3 : 1;
  const candidates = (await q(`SELECT id FROM guests WHERE event_id=$1 AND status='pending' AND invited=true AND email<>''
    AND ((reminder_requested_at IS NOT NULL AND (reminded_at IS NULL OR reminded_at < now() - interval '1 day'))
      OR ($3 AND (reminded_at IS NULL OR reminded_at < now() - ($2 * interval '1 day')))) ORDER BY id LIMIT 100`, [ev.id, days, !onlyStale || ev.auto_reminders])).rows;
  let sent = 0, failed = 0, skipped = 0;
  const names = [ev.bride, ev.groom].filter(Boolean).join(' & ');
  const subject = `Please confirm: ${names ? `${names}’s` : 'our'} wedding`;
  for (const candidate of candidates) {
    // The persisted claim also covers an ambiguous provider timeout: don't immediately send again.
    const g = (await q(`UPDATE guests SET email_claimed_at=now() WHERE id=$1 AND status='pending' AND invited=true
      AND (reminded_at IS NULL OR reminded_at < now() - interval '1 day')
      AND (email_claimed_at IS NULL OR email_claimed_at < now() - interval '1 day') RETURNING *`, [candidate.id])).rows[0];
    if (!g) { skipped++; continue; }
    try {
      await sendMail(g.email, subject, fillTpl(ev.reminder_tpl, g, ev, `${base}/r/${g.token}`), { reminder: true });
      await q('UPDATE guests SET reminded_at=now(), reminder_requested_at=NULL WHERE id=$1', [g.id]);
      sent++;
    } catch (e) { failed++; console.error('Reminder delivery failed:', g.id, e.message); }
  }
  return { sent, failed, skipped };
}
