import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, wakeServer, loadSession, setToken, setEventId, getEventId, setAuthFailHandler } from './api';

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
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimer = useRef(null);
  const pendingWedding = useRef(null);
  const weddingRef = useRef(blankWedding);
  const generation = useRef(0);
  const refreshSequence = useRef(0);
  const mutation = useRef(0);
  const saving = useRef(null);
  const switching = useRef(false);

  const clearSession = useCallback(async () => {
    generation.current++; clearTimeout(saveTimer.current);
    pendingWedding.current = null; weddingRef.current = blankWedding;
    await setToken(null); await setEventId(null);
    setAuthed(false); setGuests([]); setEvents([]); setMe(null); setWeddingState(blankWedding); setLoaded(false); setError(''); setSaveStatus('saved');
  }, []);

  const refresh = useCallback(async function refresh() {
    const epoch = generation.current, sequence = ++refreshSequence.current, changed = mutation.current;
    const eventId = getEventId();
    try {
      const [g, e, list] = await Promise.all([api('GET', '/api/guests', null, { eventId }), api('GET', '/api/event', null, { eventId }), api('GET', '/api/events', null, { eventId })]);
      if (epoch !== generation.current || sequence !== refreshSequence.current || changed !== mutation.current) return;
      setGuests(g.guests);
      if (!pendingWedding.current && !saving.current) { weddingRef.current = { ...blankWedding, ...e.event }; setWeddingState(weddingRef.current); }
      setEvents(list.events); setMail(!!e.mail); setError(''); setLoaded(true);
    } catch (e) {
      if (epoch !== generation.current || sequence !== refreshSequence.current) return;
      if (e.status === 404 && eventId && !pendingWedding.current) { generation.current++; await setEventId(null); setGuests([]); setLoaded(false); return refresh(); }
      setError(e.offline ? 'Connection lost. Your list may be out of date. Pull down to retry.' : e.message);
    }
  }, []);

  const flushWedding = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (saving.current) await saving.current;
    if (!pendingWedding.current) return;
    const draft = pendingWedding.current, epoch = generation.current;
    setSaveStatus('saving');
    const request = api('PUT', '/api/event', draft.value, { eventId: draft.id });
    saving.current = request;
    try {
      const result = await request;
      if (epoch !== generation.current) return;
      if (pendingWedding.current === draft) {
        pendingWedding.current = null; weddingRef.current = { ...blankWedding, ...result.event };
        setWeddingState(weddingRef.current); setSaveStatus('saved');
      }
    } catch (e) { if (epoch === generation.current) setSaveStatus('error'); throw e; }
    finally { if (saving.current === request) saving.current = null; }
    if (pendingWedding.current && epoch === generation.current) return flushWedding();
  }, []);

  useEffect(() => {
    setAuthFailHandler(() => { clearSession().catch(() => setError('Could not clear your session. Please restart the app.')); });
    wakeServer();
    (async () => {
      try { setAuthed(await loadSession()); } catch { setError('Could not restore your session. Please sign in again.'); }
      finally { setBooting(false); }
    })();
    return () => { generation.current++; clearTimeout(saveTimer.current); setAuthFailHandler(() => {}); };
  }, [clearSession]);

  useEffect(() => {
    if (!authed) return;
    const epoch = generation.current;
    refresh();
    api('GET', '/api/me').then(r => { if (epoch === generation.current) setMe(r.user); }).catch(() => {});
    const t = setInterval(() => { if (AppState.currentState === 'active' || !AppState.currentState) refresh(); }, 15000);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
      else flushWedding().catch(() => {});
    });
    return () => { clearInterval(t); sub.remove(); };
  }, [authed, refresh, flushWedding]);

  const api2 = useMemo(() => {
    const acceptSession = async r => {
      generation.current++; await setEventId(null); await setToken(r.token);
      setMe(r.user); setLoaded(false); setAuthed(true); return r.user;
    };
    const login = async (email, password) => acceptSession(await api('POST', '/api/auth/login', { email, password }));
    const register = async (name, email, password) => {
      const r = await api('POST', '/api/auth/register', { name, email, password });
      return r.needsVerify ? r : acceptSession(r);
    };
    const verifyEmail = async (email, code) => acceptSession(await api('POST', '/api/auth/verify', { email, code }));
    const resendVerification = email => api('POST', '/api/auth/resend', { email });
    const forgotPassword = email => api('POST', '/api/auth/forgot', { email });
    const resetPassword = async (email, code, password) => acceptSession(await api('POST', '/api/auth/reset', { email, code, password }));
    const logout = async () => {
      await flushWedding();
      await api('POST', '/api/auth/logout');
      await clearSession();
    };
    const switchEvent = async id => {
      if (id === getEventId() || switching.current) return;
      switching.current = true;
      try {
        await flushWedding(); generation.current++; await setEventId(id);
        weddingRef.current = blankWedding; setGuests([]); setWeddingState(blankWedding); setLoaded(false);
        await refresh();
      } finally { switching.current = false; }
    };
    const addEvent = async (bride = '', groom = '') => {
      await flushWedding();
      const r = await api('POST', '/api/events', { bride, groom });
      await switchEvent(r.event.id); return r.event;
    };
    const removeEvent = async id => {
      await flushWedding();
      await api('DELETE', `/api/events/${id}`);
      generation.current++;
      if (id === (getEventId() ?? events[0]?.id)) { await setEventId(null); weddingRef.current = blankWedding; setGuests([]); setWeddingState(blankWedding); setLoaded(false); }
      await refresh();
    };
    const deleteAccount = async () => { await api('DELETE', '/api/account'); await clearSession(); };
    const mutateGuest = async (method, path, body, apply) => {
      const epoch = generation.current, eventId = weddingRef.current.id;
      if (!eventId) throw new Error('Wait for your wedding to finish loading.');
      mutation.current++;
      try {
        const result = await api(method, path, body, { eventId });
        if (epoch === generation.current) { setGuests(g => apply(g, result)); setError(''); }
        return result;
      } finally { mutation.current++; }
    };
    const addGuests = list => mutateGuest('POST', '/api/guests', { guests: list }, (g, r) => [...g, ...r.guests]);
    const updateGuest = (id, patch) => mutateGuest('PATCH', `/api/guests/${id}`, { ...patch, ...(patch.reminded ? { reminded: true } : {}) }, (g, r) => g.map(x => x.id === id ? r.guest : x));
    const removeGuest = id => mutateGuest('DELETE', `/api/guests/${id}`, null, g => g.filter(x => x.id !== id));
    const respond = (id, r) => updateGuest(id, r);
    const setWedding = fn => {
      if (!weddingRef.current.id || switching.current) return;
      const next = typeof fn === 'function' ? fn(weddingRef.current) : fn;
      weddingRef.current = next; setWeddingState(next);
      pendingWedding.current = { id: next.id, value: next }; setSaveStatus('pending');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushWedding().catch(() => {}), 700);
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
    return { saveStatus, retrySave: flushWedding, booting, authed, loaded, error, mail, guests, wedding, stats, refresh, login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, logout, deleteAccount,
      events, me, switchEvent, addEvent, removeEvent,
      addGuests, updateGuest, removeGuest, respond, setWedding };
  }, [saveStatus, booting, authed, loaded, error, mail, guests, wedding, events, me, refresh, flushWedding, clearSession]);

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
