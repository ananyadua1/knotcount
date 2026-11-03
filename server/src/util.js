import crypto from 'node:crypto';

export const newToken = () => crypto.randomBytes(16).toString('base64url');

export const ms = (d) => (d ? new Date(d).getTime() : null);

export function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

export const guestOut = (g, base) => ({
  id: g.id, token: g.token, link: `${base}/r/${g.token}`,
  name: g.name, phone: g.phone, email: g.email, side: g.side, seats: g.seats,
  status: g.status, attending: g.attending, vegCount: g.veg_count, meal: g.meal, arrival: g.arrival, note: g.note,
  invited: g.invited, reminded: ms(g.reminded_at), respondedAt: ms(g.responded_at), via: g.responded_via,
});

export const eventOut = (e) => ({
  bride: e.bride, groom: e.groom, date: e.date_text, time: e.time_text, venue: e.venue,
  invite: e.invite_tpl, reminder: e.reminder_tpl, autoReminders: e.auto_reminders,
});

// The host's own invite and reminder texts are plain text. Blank means "use the standard wording"
// (the app shows the same wording for blank), and the guest's link is added at the end.
export const defaultEvent = { bride: '', groom: '', date_text: '', time_text: '7:00 PM', venue: '', invite_tpl: '', reminder_tpl: '' };

const standardReminder = 'Namaste! A gentle reminder to confirm your attendance at {couple}’s wedding{on_date}. You can reply here:';

export const fillTpl = (tpl, g, e, link) => {
  let text = tpl && tpl.trim() ? tpl : standardReminder.replace('{on_date}', e.date_text ? ` on ${e.date_text}` : '');
  if (!text.includes('{link}')) text = `${text.trimEnd()}

{link}`;
  return text
    .replaceAll('{name}', (g.name || '').split(' ')[0] || 'there')
    .replaceAll('{couple}', `${e.bride} & ${e.groom}`)
    .replaceAll('{date}', e.date_text).replaceAll('{time}', e.time_text)
    .replaceAll('{venue}', e.venue).replaceAll('{link}', link);
};

// How many of `count` people eat vegetarian. Reads vegCount / veg, or the older single `meal` choice.
// With neither, keeps `fallback` (clamped), or null meaning "not chosen".
export const vegOf = (count, b, fallback = null) => {
  const raw = b.vegCount ?? b.veg;
  if (raw !== undefined && raw !== null) return int(raw, 0, count, 0);
  if (b.meal === 'veg') return count;
  if (b.meal === 'nonveg') return 0;
  return fallback === null || fallback === undefined ? null : Math.min(fallback, count);
};
// The legacy `meal` column mirrors the split when it is all one kind.
export const mealOf = (count, veg) => (veg === null ? null : veg === count ? 'veg' : veg === 0 ? 'nonveg' : null);

const s = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const str = s;
export const int = (v, lo, hi, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
