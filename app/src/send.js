import { Linking, Share, Platform } from 'react-native';

const digits = (p) => {
  let d = (p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.length === 10) return '91' + d; // default to India
  return d.replace(/^0+/, '');
};

export async function sendChat(guest, text) {
  const d = digits(guest.phone);
  if (!d) { await Share.share({ message: text }); return true; }
  const url = `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(url); return true; } catch (e) {
    try { await Share.share({ message: text }); return true; } catch (e2) { return false; }
  }
}
