import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://10.0.2.2:3000' : 'https://knotcount-server.onrender.com');
let base = DEFAULT_URL;
let token = null;
let eventId = null; // which wedding of the account the app is showing
let onAuthFail = () => {};

// Called when the app opens: starts waking the server while the person is still looking at the first screen.
export const wakeServer = () => { fetch(`${base}/health`).catch(() => {}); };
export const setAuthFailHandler = (fn) => { onAuthFail = fn; };
export const getBase = () => base;
export const PRIVACY_URL = () => base + '/privacy';

export async function loadSession() {
  const [b, t, ev] = await Promise.all([AsyncStorage.getItem('kc.server'), AsyncStorage.getItem('kc.token'), AsyncStorage.getItem('kc.event')]);
  if (b && __DEV__) base = b;
  token = Platform.OS === 'web' ? null : await SecureStore.getItemAsync('kc.token');
  // Retire legacy plaintext sessions; signing in again stores a fresh secure token.
  if (t) await AsyncStorage.removeItem('kc.token');
  eventId = ev ? Number(ev) : null;
  return !!token;
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
  if (Platform.OS !== 'web') {
    if (t) await SecureStore.setItemAsync('kc.token', t); else await SecureStore.deleteItemAsync('kc.token');
  }
  await AsyncStorage.removeItem('kc.token');
}

export async function api(method, path, body, options = {}) {
  const requestToken = token;
  const requestEvent = options.eventId === undefined ? eventId : options.eventId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000); // a sleeping free server needs up to a minute to wake
  let res;
  try {
    res = await fetch(base + path, {
      method, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}), ...(requestEvent ? { 'X-Event-Id': String(requestEvent) } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error('Can’t reach the server. Check your internet and the server address.');
    err.offline = true;
    throw err;
  } finally { clearTimeout(timer); }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && requestToken && token === requestToken && !path.startsWith('/api/auth')) onAuthFail();
  if (!res.ok) { const err = new Error(json.error || `Server error (${res.status})`); err.status = res.status; err.data = json; throw err; }
  return json;
}
