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
  status: g.status, attending: g.attending, meal: g.meal, arrival: g.arrival, note: g.note,
  invited: g.invited, reminded: ms(g.reminded_at), respondedAt: ms(g.responded_at), via: g.responded_via,
});

export const eventOut = (e) => ({
  bride: e.bride, groom: e.groom, date: e.date_text, time: e.time_text, venue: e.venue,
  invite: e.invite_tpl, reminder: e.reminder_tpl, autoReminders: e.auto_reminders,
});

export const defaultEvent = {
  bride: '', groom: '', date_text: '', time_text: '7:00 PM', venue: '',
  invite_tpl:
    'Namaste {name}! {couple} are getting married and would love to have you with them.\n\n{date}, {time}\n{venue}\n\nPlease tell us if you can make it, it takes 20 seconds:\n{link}',
  reminder_tpl:
    'Namaste {name}! A gentle reminder to confirm your attendance at {couple}’s wedding on {date}. You can reply here:\n{link}',
};

export const fillTpl = (tpl, g, e, link) =>
  tpl
    .replaceAll('{name}', (g.name || '').split(' ')[0] || 'there')
    .replaceAll('{couple}', `${e.bride} & ${e.groom}`)
    .replaceAll('{date}', e.date_text).replaceAll('{time}', e.time_text)
    .replaceAll('{venue}', e.venue).replaceAll('{link}', link);

const s = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const str = s;
export const int = (v, lo, hi, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
