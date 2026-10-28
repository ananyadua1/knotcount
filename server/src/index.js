import cron from 'node-cron';
import { createApp, runEmailReminders } from './app.js';
import { migrate, q } from './db.js';
import { mailEnabled } from './mail.js';

await migrate();
const app = createApp();
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`KnotCount server listening on :${port}`));

// Daily 10:00 IST: email a reminder to pending guests (only for events that switched it on).
if (mailEnabled()) {
  cron.schedule('30 4 * * *', async () => {
    try {
      const evs = (await q('SELECT * FROM events WHERE auto_reminders=true')).rows;
      const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
      for (const ev of evs) await runEmailReminders(ev, base, { onlyStale: true });
    } catch (e) { console.error('reminder job failed', e.message); }
  });
}
