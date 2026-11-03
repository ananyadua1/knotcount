import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://10.0.2.2:3000' : 'https://knotcount-server.onrender.com');
let base = DEFAULT_URL;
let token = null;
let eventId = null; // which wedding of the account the app is showing
let onAuthFail = () => {};

export const setAuthFailHandler = (fn) => { onAuthFail = fn; };
export const getBase = () => base;
export const PRIVACY_URL = () => base + '/privacy';

export async function loadSession() {
  const [b, t, ev] = await Promise.all([AsyncStorage.getItem('kc.server'), AsyncStorage.getItem('kc.token'), AsyncStorage.getItem('kc.event')]);
  if (b) base = b;
  token = t;
  eventId = ev ? Number(ev) : null;
  return !!t;
}
export async function setServer(url) {
  base = url.trim().replace(/\/+$/, '') || DEFAULT_URL;
  await AsyncStorage.setItem('kc.server', base);
}
export const getEventId = () => eventId;
export async function setEventId(id) {
  eventId = id || null;
  if (eventId) await AsyncStorage.setItem('kc.event', String(eventId)); else await AsyncStorage.removeItem('kc.event');
}
export async function setToken(t) {
  token = t;
  if (t) await AsyncStorage.setItem('kc.token', t); else await AsyncStorage.removeItem('kc.token');
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(eventId ? { 'X-Event-Id': String(eventId) } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error('Can’t reach the server. Check your internet and the server address.');
    err.offline = true;
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/api/auth')) onAuthFail();
  if (!res.ok) { const err = new Error(json.error || `Server error (${res.status})`); err.status = res.status; err.data = json; throw err; }
  return json;
}
