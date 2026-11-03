import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, loadSession, setToken, setAuthFailHandler } from './api';

const blankWedding = {
  bride: '', groom: '', date: '', time: '7:00 PM', venue: '', invite: '', reminder: '', autoReminders: false,
  template: 'classic', extra: '',
};

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [guests, setGuests] = useState([]);
  const [wedding, setWeddingState] = useState(blankWedding);
  const [mail, setMail] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const editing = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const [g, e] = await Promise.all([api('GET', '/api/guests'), api('GET', '/api/event')]);
      if (!editing.current) { setGuests(g.guests); }
      setWeddingState((w) => (saveTimer.current ? w : { ...blankWedding, ...e.event }));
      setMail(!!e.mail); setError(''); setLoaded(true);
    } catch (e) { setError(e.offline ? 'Offline. Showing last known list.' : e.message); }
  }, []);

  useEffect(() => {
    setAuthFailHandler(() => { setToken(null); setAuthed(false); setGuests([]); });
    (async () => { const has = await loadSession(); setAuthed(has); setBooting(false); })();
  }, []);

  // live updates: poll while signed in and the app is in the foreground
  useEffect(() => {
    if (!authed) return;
    refresh();
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
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const forgotPassword = (email) => api('POST', '/api/auth/forgot', { email });
    const resetPassword = async (email, code, password) => {
      const r = await api('POST', '/api/auth/reset', { email, code, password });
      await setToken(r.token); setLoaded(false); setAuthed(true); return r.user;
    };
    const logout = async () => { await setToken(null); setAuthed(false); setGuests([]); setWeddingState(blankWedding); setLoaded(false); };

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
    return { booting, authed, loaded, error, mail, guests, wedding, stats, refresh, login, register, forgotPassword, resetPassword, logout, deleteAccount,
      addGuests, updateGuest, removeGuest, respond, setWedding };
  }, [booting, authed, loaded, error, mail, guests, wedding, refresh]);

  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>;
}

// The invite and reminder are plain text the host pastes or types. Until they do, the chosen design supplies ready wording built from the wedding details.
const oldDefault = (s) => !s || !s.trim() || s.includes('{couple} are getting married') || s.includes('confirm your attendance at {couple}');

export const DESIGNS = [
  { k: 'classic', t: 'Classic' },
  { k: 'royal', t: 'Royal' },
  { k: 'garden', t: 'Garden' },
  { k: 'custom', t: 'Custom' },
];

const whenWhere = (w) => [[w.date, w.time].filter(Boolean).join(', '), w.venue, w.extra].filter(Boolean).join('\n');
const WORDING = {
  classic: (w) => `Namaste! ${couple(w)} are getting married and would love to have you with them.\n\n${whenWhere(w)}\n\nPlease tell us if you can make it, it takes 20 seconds:`,
  royal: (w) => `Together with their families,\n${couple(w)}\nrequest the pleasure of your company at their wedding.\n\n${whenWhere(w)}\n\nKindly let us know if you can join us:`,
  garden: (w) => `We’re getting married! ${couple(w)} would love for you to celebrate with us.\n\n${whenWhere(w)}\n\nTap here to tell us you’re coming:`,
};
// the wording a design starts with, tidied so blank details leave no gaps
export const designText = (w) => (WORDING[w.template] || WORDING.classic)(w).replace(/\n{3,}/g, '\n\n');

export const inviteText = (w) => {
  const own = !oldDefault(w.invite);
  if (w.template === 'custom') return own ? w.invite : '';
  return own ? w.invite : designText(w);
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
