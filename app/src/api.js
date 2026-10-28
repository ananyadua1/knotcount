import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
let base = DEFAULT_URL;
let token = null;
let onAuthFail = () => {};

export const setAuthFailHandler = (fn) => { onAuthFail = fn; };
export const getBase = () => base;

export async function loadSession() {
  const [b, t] = await Promise.all([AsyncStorage.getItem('kc.server'), AsyncStorage.getItem('kc.token')]);
  if (b) base = b;
  token = t;
  return !!t;
}
export async function setServer(url) {
  base = url.trim().replace(/\/+$/, '') || DEFAULT_URL;
  await AsyncStorage.setItem('kc.server', base);
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
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error('Can’t reach the server. Check your internet and the server address.');
    err.offline = true;
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/api/auth')) onAuthFail();
  if (!res.ok) { const err = new Error(json.error || `Server error (${res.status})`); err.status = res.status; throw err; }
  return json;
}
