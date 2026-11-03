import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Label } from './ui';

export const GOLD = '#E7C478';
export const MAROON = '#7B1E3A';
export const SAGE = '#E4EBDD';

// The on-screen invitation for each design. `w` is the wedding details.
export default function InviteCard({ w, design }) {
  const bride = w.bride || 'Bride';
  const groom = w.groom || 'Groom';
  const when = [w.date, w.time].filter(Boolean).join(' · ');

  if (design === 'custom') {
    return (
      <View style={[st.card, st.custom]}>
        <Feather name="edit-3" size={26} color={C.ink} />
        <Text style={st.customT}>Your own invitation</Text>
        <Text style={st.customS}>Paste or type your text below. Each guest’s reply link is added to the end.</Text>
      </View>
    );
  }

  if (design === 'royal') {
    return (
      <View style={[st.card, { backgroundColor: MAROON, borderColor: MAROON }]}>
        <View style={[st.inner, { borderColor: 'rgba(231,196,120,0.55)' }]}>
          <Text style={[st.kicker, { color: GOLD }]}>Together with their families</Text>
          <Text style={[st.royalName, { color: '#FBF1D8' }]}>{bride}</Text>
          <Text style={[st.amp, { color: GOLD }]}>&</Text>
          <Text style={[st.royalName, { color: '#FBF1D8' }]}>{groom}</Text>
          <View style={[st.rule, { backgroundColor: GOLD }]} />
          <Text style={[st.small, { color: '#FBF1D8' }]}>request the pleasure of your company</Text>
          {!!when && <Text style={[st.meta, { color: '#FBF1D8', marginTop: 12 }]}>{when}</Text>}
          {!!w.venue && <Text style={[st.meta, { color: GOLD }]}>{w.venue}</Text>}
          {!!w.extra && <Text style={[st.extra, { color: '#FBF1D8' }]}>{w.extra}</Text>}
        </View>
      </View>
    );
  }

  if (design === 'garden') {
    return (
      <View style={[st.card, { backgroundColor: SAGE, borderColor: C.leaf }]}>
        <View style={[st.inner, { borderColor: '#B9C9B0' }]}>
          <Feather name="feather" size={22} color={C.leaf} />
          <Text style={[st.kicker, { color: C.leaf, marginTop: 14 }]}>We’re getting married</Text>
          <Text style={st.gardenName}>{bride}</Text>
          <Text style={[st.gardenAnd, { color: C.leaf }]}>and</Text>
          <Text style={st.gardenName}>{groom}</Text>
          <View style={[st.rule, { backgroundColor: C.leaf }]} />
          {!!when && <Text style={st.meta}>{when}</Text>}
          {!!w.venue && <Text style={[st.meta, { color: C.soft }]}>{w.venue}</Text>}
          {!!w.extra && <Text style={[st.extra, { color: C.soft }]}>{w.extra}</Text>}
        </View>
      </View>
    );
  }

  // classic
  return (
    <View style={st.card}>
      <View style={st.inner}>
        <Label style={{ letterSpacing: 4 }}>{bride[0]} & {groom[0]}</Label>
        <Text style={st.invited}>You’re{'\n'}invited</Text>
        <Text style={st.names}>{bride} & {groom}</Text>
        <View style={[st.rule, { backgroundColor: C.ink }]} />
        {!!when && <Text style={st.meta}>{when}</Text>}
        {!!w.venue && <Text style={[st.meta, { color: C.muted }]}>{w.venue}</Text>}
        {!!w.extra && <Text style={[st.extra, { color: C.soft }]}>{w.extra}</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink, padding: 8 },
  inner: { borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' },
  kicker: { fontFamily: F.med, fontSize: 10.5, letterSpacing: 2.6, textTransform: 'uppercase', textAlign: 'center' },
  invited: { fontFamily: F.serif, fontSize: 54, lineHeight: 56, color: C.ink, textAlign: 'center', marginTop: 16 },
  names: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 3, color: C.sindoor, marginTop: 18, textTransform: 'uppercase', textAlign: 'center' },
  rule: { width: 28, height: 1.5, marginVertical: 18 },
  meta: { fontFamily: F.med, fontSize: 13, color: C.ink, marginTop: 3, textAlign: 'center' },
  extra: { fontFamily: F.reg, fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  small: { fontFamily: F.serif, fontSize: 15, textAlign: 'center' },
  royalName: { fontFamily: F.serif, fontSize: 38, lineHeight: 44, textAlign: 'center', marginTop: 6 },
  amp: { fontFamily: F.serif, fontSize: 22, marginTop: 2 },
  gardenName: { fontFamily: F.heavy, fontSize: 26, letterSpacing: 4, color: C.ink, textTransform: 'uppercase', textAlign: 'center', marginTop: 8 },
  gardenAnd: { fontFamily: F.serif, fontSize: 18, marginTop: 6 },
  custom: { borderStyle: 'dashed', borderColor: C.muted, backgroundColor: C.paper, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 26 },
  customT: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 2.4, color: C.ink, textTransform: 'uppercase', marginTop: 14 },
  customS: { fontFamily: F.reg, fontSize: 13.5, color: C.soft, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
