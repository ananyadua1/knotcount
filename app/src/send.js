import { Linking, Share, Alert } from 'react-native';

const digits = (p) => {
  let d = (p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.length === 10) return '91' + d; // default to India
  return d.replace(/^0+/, '');
};

export async function sendChat(guest, text) {
  const d = digits(guest.phone);
  if (!d) { const result = await Share.share({ message: text }); return result.action === Share.sharedAction; }
  const url = `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(url); return true; } catch (e) {
    try { const result = await Share.share({ message: text }); return result.action === Share.sharedAction; } catch (e2) { return false; }
  }
}

export const confirmSent = () => new Promise(resolve => Alert.alert('Did you send the message?', 'Mark it as sent only after you send it in WhatsApp or your messaging app.', [
  { text: 'Not yet', style: 'cancel', onPress: () => resolve(false) },
  { text: 'Mark as sent', onPress: () => resolve(true) },
], { cancelable: true, onDismiss: () => resolve(false) }));
