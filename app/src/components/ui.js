import React from 'react';
import { Pressable, Text, View, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, F, shadow } from '../theme';

export const tap = () => { try { Haptics.selectionAsync(); } catch (e) {} };

export const Label = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;

export const Heading = ({ children, size = 34, style }) => (
  <Text style={[s.heading, { fontSize: size, lineHeight: size * 1.04 }, style]}>{children}</Text>
);

export const Card = ({ children, style, active, soft }) => (
  <View style={[s.card, active && s.cardActive, soft && s.cardSoft, !soft && !active && shadow, style]}>{children}</View>
);

export function Btn({ title, onPress, kind = 'solid', icon, style, disabled }) {
  const solid = kind === 'solid';
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress && onPress(); }}
      style={({ pressed }) => [s.btn, solid ? s.btnSolid : s.btnLine, pressed && { opacity: 0.8 }, disabled && { opacity: 0.35 }, style]}
    >
      {icon ? <Feather name={icon} size={16} color={solid ? C.card : C.ink} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.btnText, { color: solid ? C.card : C.ink }]}>{title}</Text>
    </Pressable>
  );
}

export const IconBtn = ({ name, onPress, solid, size = 40, style }) => (
  <Pressable
    onPress={() => { tap(); onPress && onPress(); }}
    hitSlop={8}
    style={({ pressed }) => [
      { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: solid ? C.ink : C.ink, backgroundColor: solid ? C.ink : 'transparent' },
      pressed && { opacity: 0.7 }, style,
    ]}
  >
    <Feather name={name} size={size * 0.45} color={solid ? C.card : C.ink} />
  </Pressable>
);

export function Stat({ label, value, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={[s.stat, active ? s.cardActive : s.statIdle]}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

export function Chip({ title, active, onPress, tone }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress && onPress(); }}
      style={[s.chip, active && { backgroundColor: C.ink, borderColor: C.ink }]}
    >
      {tone ? <View style={[s.dot, { backgroundColor: tone }]} /> : null}
      <Text style={[s.chipText, active && { color: C.card }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...p }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Label style={{ marginBottom: 6 }}>{label}</Label>
      <TextInput placeholderTextColor={C.muted} {...p} style={[s.input, p.multiline && { height: 110, textAlignVertical: 'top', paddingTop: 12 }]} />
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: C.card }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Hair = ({ style }) => <View style={[{ height: StyleSheet.hairlineWidth * 1.5, backgroundColor: C.line }, style]} />;

const s = StyleSheet.create({
  label: { fontFamily: F.med, fontSize: 10.5, letterSpacing: 2.2, color: C.muted, textTransform: 'uppercase' },
  heading: { fontFamily: F.heavy, color: C.ink, letterSpacing: -1.4, textTransform: 'uppercase' },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16 },
  cardActive: { borderColor: C.ink, borderWidth: 1.5, backgroundColor: C.card },
  cardSoft: { backgroundColor: C.wash, borderColor: 'transparent' },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 22 },
  btnSolid: { backgroundColor: C.ink },
  btnLine: { borderWidth: 1.5, borderColor: C.ink, backgroundColor: 'transparent' },
  btnText: { fontFamily: F.semi, fontSize: 12.5, letterSpacing: 2, textTransform: 'uppercase' },
  stat: { borderRadius: 16, borderWidth: 1, padding: 12, paddingBottom: 10, backgroundColor: C.card },
  statIdle: { borderColor: C.line },
  statLabel: { fontFamily: F.med, fontSize: 9, letterSpacing: 1.6, color: C.soft, textTransform: 'uppercase' },
  statValue: { fontFamily: F.semi, fontSize: 30, color: C.ink, marginTop: 8, letterSpacing: -0.8 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, marginRight: 8, backgroundColor: C.card },
  chipText: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1.4, color: C.ink, textTransform: 'uppercase' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: F.med, fontSize: 15, color: C.ink },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 3, backgroundColor: C.card },
  segItem: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.ink },
  segText: { fontFamily: F.semi, fontSize: 10.5, letterSpacing: 1.4, color: C.soft, textTransform: 'uppercase' },
});
