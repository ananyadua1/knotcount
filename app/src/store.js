import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, loadSession, setToken, setAuthFailHandler } from './api';

const blankWedding = {
  bride: '', groom: '', date: '', time: '7:00 PM', venue: '', invite: '', reminder: '', autoReminders: false,
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
    const logout = async () => { await setToken(null); setAuthed(false); setGuests([]); setWeddingState(blankWedding); setLoaded(false); };

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
    const stats = {
      invited: sum(guests, (x) => x.seats),
      confirmed: sum(guests.filter((x) => x.status === 'confirmed'), (x) => x.attending),
      declined: sum(guests.filter((x) => x.status === 'declined'), (x) => x.seats),
      pending: sum(guests.filter((x) => x.status === 'pending'), (x) => x.seats),
      veg: sum(guests.filter((x) => x.status === 'confirmed' && x.meal === 'veg'), (x) => x.attending),
      nonveg: sum(guests.filter((x) => x.status === 'confirmed' && x.meal === 'nonveg'), (x) => x.attending),
      sent: guests.filter((x) => x.invited).length,
      households: guests.length,
    };
    return { booting, authed, loaded, error, mail, guests, wedding, stats, refresh, login, register, logout,
      addGuests, updateGuest, removeGuest, respond, setWedding };
  }, [booting, authed, loaded, error, mail, guests, wedding, refresh]);

  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>;
}

export const couple = (w) => `${w.bride || 'Bride'} & ${w.groom || 'Groom'}`;
export const fill = (tpl, g, w) =>
  (tpl || '')
    .replaceAll('{name}', (g.name || '').split(' ')[0] || 'there')
    .replaceAll('{couple}', couple(w))
    .replaceAll('{date}', w.date).replaceAll('{time}', w.time)
    .replaceAll('{venue}', w.venue).replaceAll('{link}', g.link || '');
