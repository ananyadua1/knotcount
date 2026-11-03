import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, loadSession, setToken, setEventId, getEventId, setAuthFailHandler } from './api';

const blankWedding = {
  bride: '', groom: '', date: '', time: '7:00 PM', venue: '', invite: '', reminder: '', autoReminders: false,
  template: 'classic', color: '', msgStyle: '', extra: '',
};

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [guests, setGuests] = useState([]);
  const [wedding, setWeddingState] = useState(blankWedding);
  const [mail, setMail] = useState(false);
  const [events, setEvents] = useState([]);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const pendingWedding = useRef(null);
  const editing = useRef(0);

  const refresh = useCallback(async function refresh() {
    try {
      const [g, e, list] = await Promise.all([api('GET', '/api/guests'), api('GET', '/api/event'), api('GET', '/api/events')]);
      if (!editing.current) { setGuests(g.guests); }
      setWeddingState((w) => (saveTimer.current ? w : { ...blankWedding, ...e.event }));
      setEvents(list.events);
      setMail(!!e.mail); setError(''); setLoaded(true);
    } catch (e) {
      if (e.status === 404) { await setEventId(null); setGuests([]); setLoaded(false); return refresh(); } // that wedding was removed
      setError(e.offline ? 'Offline. Showing last known list.' : e.message);
    }
  }, []);

  useEffect(() => {
    setAuthFailHandler(() => { setToken(null); setAuthed(false); setGuests([]); setEvents([]); setMe(null); });
    (async () => { const has = await loadSession(); setAuthed(has); setBooting(false); })();
  }, []);

  // live updates: poll while signed in and the app is in the foreground
  useEffect(() => {
    if (!authed) return;
    refresh();
    api('GET', '/api/me').then((r) => setMe(r.user)).catch(() => {});
    const t = setInterval(refresh, 8000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => { clearInterval(t); sub.remove(); };
  }, [authed, refresh]);

  const api2 = useMemo(() => {
    const login = async (email, password) => {
      const r = await api('POST', '/api/auth/login', { email, password });
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const register = async (name, email, password) => {
      const r = await api('POST', '/api/auth/register', { name, email, password });
      if (r.needsVerify) return r; // a code was emailed; the account opens once it is entered
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const verifyEmail = async (email, code) => {
      const r = await api('POST', '/api/auth/verify', { email, code });
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const resendVerification = (email) => api('POST', '/api/auth/resend', { email });
    const forgotPassword = (email) => api('POST', '/api/auth/forgot', { email });
    const resetPassword = async (email, code, password) => {
      const r = await api('POST', '/api/auth/reset', { email, code, password });
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const logout = async () => {
      await setToken(null); await setEventId(null);
      setAuthed(false); setGuests([]); setEvents([]); setMe(null); setWeddingState(blankWedding); setLoaded(false);
    };

    // an account can hold several weddings; everything on screen belongs to the one selected
    const switchEvent = async (id) => {
      if (id === getEventId()) return;
      if (saveTimer.current) { // save pending edits to the wedding being left, before the header changes
        clearTimeout(saveTimer.current); saveTimer.current = null;
        try { await api('PUT', '/api/event', pendingWedding.current); } catch (e) { setError(e.message); }
      }
      await setEventId(id);
      setGuests([]); setWeddingState(blankWedding); setLoaded(false);
      await refresh();
    };
    const addEvent = async (bride = '', groom = '') => {
      const r = await api('POST', '/api/events', { bride, groom });
      await switchEvent(r.event.id);
      return r.event;
    };
    const removeEvent = async (id) => {
      await api('DELETE', `/api/events/${id}`);
      const rest = events.filter((e) => e.id !== id);
      setEvents(rest);
      if (id === (getEventId() ?? events[0]?.id)) { await setEventId(null); setGuests([]); setWeddingState(blankWedding); setLoaded(false); }
      await refresh();
    };

    const deleteAccount = async () => { await api('DELETE', '/api/account'); await logout(); };

    const addGuests = async (list) => {
      const r = await api('POST', '/api/guests', { guests: list });
      setGuests((g) => [...g, ...r.guests]);
    };
    const updateGuest = async (id, patch) => {
      editing.current++;
      setGuests((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const body = { ...patch };
        if (body.reminded) body.reminded = true;
        const r = await api('PATCH', `/api/guests/${id}`, body);
        setGuests((g) => g.map((x) => (x.id === id ? r.guest : x)));
      } catch (e) { setError(e.message); refresh(); }
      finally { editing.current--; }
    };
    const removeGuest = async (id) => {
      setGuests((g) => g.filter((x) => x.id !== id));
      try { await api('DELETE', `/api/guests/${id}`); } catch (e) { setError(e.message); refresh(); }
    };
    const respond = (id, r) => updateGuest(id, { ...r, respondedAt: Date.now() });

    const setWedding = (fn) => {
      setWeddingState((prev) => {
        const next = typeof fn === 'function' ? fn(prev) : fn;
        clearTimeout(saveTimer.current);
        pendingWedding.current = next;
        saveTimer.current = setTimeout(async () => {
          try { await api('PUT', '/api/event', next); } catch (e) { setError(e.message); }
          saveTimer.current = null;
        }, 700);
        return next;
      });
    };

    const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
    const yes = guests.filter((x) => x.status === 'confirmed');
    const withMeal = yes.filter((x) => x.vegCount != null);
    // invitations (a family is 1 invite); `people` counts the individual guests inside them
    const stats = {
      invited: guests.length,
      confirmed: yes.length,
      pending: guests.filter((x) => x.status === 'pending').length,
      declined: guests.filter((x) => x.status === 'declined').length,
      people: {
        coming: sum(yes, (x) => x.attending),
        veg: sum(withMeal, (x) => x.vegCount),
        nonveg: sum(withMeal, (x) => x.attending - x.vegCount),
        unchosen: sum(yes.filter((x) => x.vegCount == null), (x) => x.attending),
        declined: sum(guests.filter((x) => x.status === 'declined'), (x) => x.seats),
        awaiting: sum(guests.filter((x) => x.status === 'pending'), (x) => x.seats),
      },
      sent: guests.filter((x) => x.invited).length,
      households: guests.length,
    };
    return { booting, authed, loaded, error, mail, guests, wedding, stats, refresh, login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, logout, deleteAccount,
      events, me, switchEvent, addEvent, removeEvent,
      addGuests, updateGuest, removeGuest, respond, setWedding };
  }, [booting, authed, loaded, error, mail, guests, wedding, events, me, refresh]);

  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>;
}

// The invitation text is plain text, never code. The host picks one of three ready messages (built from the wedding details)
// or writes their own. Each guest's personal reply link is added at the end.
const oldDefault = (s) => !s || !s.trim() || s.includes('{couple} are getting married') || s.includes('confirm your attendance at {couple}');

export const MESSAGES = [
  { k: 'warm', t: 'Warm' },
  { k: 'formal', t: 'Formal' },
  { k: 'short', t: 'Short' },
  { k: 'custom', t: 'My own' },
];

const whenWhere = (w) => [[w.date, w.time].filter(Boolean).join(', '), w.venue, w.extra].filter(Boolean).join('\n');
const WORDING = {
  warm: (w) => `Namaste! ${couple(w)} are getting married and would love to have you with them.\n\n${whenWhere(w)}\n\nPlease tell us if you can make it, it takes 20 seconds:`,
  formal: (w) => `Together with their families,\n${couple(w)}\nrequest the pleasure of your company at their wedding.\n\n${whenWhere(w)}\n\nKindly let us know if you can join us:`,
  short: (w) => `You’re invited to ${couple(w)}’s wedding${w.date ? ` on ${w.date}` : ''}${w.venue ? ` at ${w.venue}` : ''}.\n\nPlease reply here:`,
};
// the ready wording for a style, tidied so blank details leave no gaps
export const wordingOf = (style, w) => (WORDING[style] || WORDING.warm)(w).replace(/\n{3,}/g, '\n\n');

// which message is selected; an older account that wrote its own text counts as "My own"
export const msgStyleOf = (w) => w.msgStyle || (oldDefault(w.invite) ? 'warm' : 'custom');

export const inviteText = (w) => {
  const style = msgStyleOf(w);
  if (style === 'custom') return oldDefault(w.invite) ? '' : w.invite;
  return wordingOf(style, w);
};
export const reminderText = (w) =>
  oldDefault(w.reminder)
    ? `Namaste! A gentle reminder to confirm your attendance at ${couple(w)}’s wedding${w.date ? ` on ${w.date}` : ''}. You can reply here:`
    : w.reminder;
// the guest's personal reply link goes at the end unless the text already places it
export const compose = (text, g, w) => (text.includes('{link}') ? fill(text, g, w) : `${fill(text, g, w).trimEnd()}\n\n${g.link || ''}`);

export const couple = (w) => `${w.bride || 'Bride'} & ${w.groom || 'Groom'}`;
export const fill = (tpl, g, w) =>
  (tpl || '')
    .replaceAll('{name}', (g.name || '').split(' ')[0] || 'there')
    .replaceAll('{couple}', couple(w))
    .replaceAll('{date}', w.date).replaceAll('{time}', w.time)
    .replaceAll('{venue}', w.venue).replaceAll('{link}', g.link || '');

// veg / non-veg head count for one invite, never more people than it has seats
export const splitOf = (g, n = g.attending || g.seats) => {
  const total = Math.max(1, Math.min(n, g.seats));
  const veg = g.vegCount != null ? Math.min(g.vegCount, total) : g.meal === 'nonveg' ? 0 : total;
  return { veg, nonveg: total - veg };
};
// trim a split to `max` people, dropping non-veg first
export const fitSplit = ({ veg, nonveg }, max) => {
  const over = veg + nonveg - max;
  if (over <= 0) return { veg, nonveg };
  const cut = Math.min(nonveg, over);
  return { veg: veg - (over - cut), nonveg: nonveg - cut };
};
