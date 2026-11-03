import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Label } from './ui';

// Every design is the same card in the same fonts; only the colours change.
export const PALETTES = [
  { k: 'classic', t: 'Classic', bg: '#FBF8F2', ink: '#1A1714', acc: '#B8342B', line: '#DCD4C6' },
  { k: 'royal', t: 'Royal', bg: '#7B1E3A', ink: '#FBF1D8', acc: '#E7C478', line: 'rgba(231,196,120,0.55)' },
  { k: 'garden', t: 'Garden', bg: '#E4EBDD', ink: '#1A1714', acc: '#3E6A4D', line: '#B9C9B0' },
];
// ready-made choices for the custom colour
export const SWATCHES = [
  '#7B1E3A', '#9D174D', '#C2410C', '#B45309', '#065F46', '#2F5D50',
  '#1F3A5F', '#0F172A', '#5B2A86', '#374151', '#F4EFE6', '#FDE68A',
];
export const isHex = (s) => /^#[0-9a-fA-F]{6}$/.test(s || '');

// colours for the chosen design: a ready-made palette, or text colours worked out from the host's own background colour
export function themeOf(w) {
  if (w.template === 'custom' && isHex(w.color)) {
    const n = parseInt(w.color.slice(1), 16);
    const dark = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
    return {
      bg: w.color, ink: dark ? '#FBF8F2' : '#1A1714', acc: dark ? '#F3D58A' : '#7B1E3A',
      line: dark ? 'rgba(255,255,255,0.35)' : 'rgba(26,23,20,0.25)',
    };
  }
  return PALETTES.find((p) => p.k === w.template) || PALETTES[0];
}

export default function InviteCard({ w }) {
  const th = themeOf(w);
  const bride = w.bride || 'Bride';
  const groom = w.groom || 'Groom';
  const when = [w.date, w.time].filter(Boolean).join(' · ');
  return (
    <View style={[st.card, { backgroundColor: th.bg, borderColor: th.ink }]}>
      <View style={[st.inner, { borderColor: th.line }]}>
        <Label style={{ letterSpacing: 4, color: th.ink, opacity: 0.7 }}>{bride[0]} & {groom[0]}</Label>
        <Text style={[st.invited, { color: th.ink }]}>You’re{'\n'}invited</Text>
        <Text style={[st.names, { color: th.acc }]}>{bride} & {groom}</Text>
        <View style={[st.rule, { backgroundColor: th.ink }]} />
        {!!when && <Text style={[st.meta, { color: th.ink }]}>{when}</Text>}
        {!!w.venue && <Text style={[st.meta, { color: th.ink, opacity: 0.75 }]}>{w.venue}</Text>}
        {!!w.extra && <Text style={[st.extra, { color: th.ink }]}>{w.extra}</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 8 },
  inner: { borderRadius: 16, borderWidth: 1, paddingVertical: 30, paddingHorizontal: 22, alignItems: 'center' },
  invited: { fontFamily: F.serif, fontSize: 54, lineHeight: 56, textAlign: 'center', marginTop: 16 },
  names: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 3, marginTop: 18, textTransform: 'uppercase', textAlign: 'center' },
  rule: { width: 28, height: 1.5, marginVertical: 18 },
  meta: { fontFamily: F.med, fontSize: 13, marginTop: 3, textAlign: 'center' },
  extra: { fontFamily: F.reg, fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 18, opacity: 0.85 },
});
