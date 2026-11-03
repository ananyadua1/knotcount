import { createApp, runEmailReminders } from './app.js';
import { migrate, q, pool } from './db.js';
import { mailEnabled } from './mail.js';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!/^https:\/\//.test(process.env.PUBLIC_URL || '')) throw new Error('PUBLIC_URL must be HTTPS.');
  if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must have at least 32 characters.');
  if (!mailEnabled()) throw new Error('Configure email before launching: verification and recovery require it.');
  if (process.env.MAIL_WEBHOOK_URL && !(process.env.MAIL_WEBHOOK_SECRET || '').trim()) throw new Error('MAIL_WEBHOOK_SECRET is required.');
}
await migrate();
const server = createApp().listen(process.env.PORT || 3000, () => console.log('KnotCount server ready'));
let running = false;
// Eligibility and send claims live in Postgres, so restarts do not lose due reminders.
async function remind() {
  if (running || !mailEnabled()) return;
  running = true;
  try {
    const events = (await q('SELECT * FROM events e WHERE auto_reminders=true OR EXISTS (SELECT 1 FROM guests g WHERE g.event_id=e.id AND g.reminder_requested_at IS NOT NULL)')).rows;
    for (const event of events) await runEmailReminders(event, (process.env.PUBLIC_URL || '').replace(/\/$/, ''), { onlyStale: true });
  } catch (error) { console.error('Reminder sweep failed:', error.message); }
  finally { running = false; }
}
const timer = setInterval(remind, 60 * 1000);
remind();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  clearInterval(timer);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 25000).unref();
});
