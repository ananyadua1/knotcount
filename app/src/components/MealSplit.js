import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Label, IconBtn } from './ui';
import { Plate } from './art';

// Two steppers, vegetarian and non-veg. Together they are the people coming, which can't pass `max` (the invited seats).
export default function MealSplit({ veg, nonveg, max, onChange }) {
  const total = veg + nonveg;
  const cards = [['veg', 'Vegetarian', veg], ['nonveg', 'Non-veg', nonveg]];
  const bump = (k, d) => {
    const next = { veg, nonveg, [k]: (k === 'veg' ? veg : nonveg) + d };
    onChange(next.veg, next.nonveg);
  };
  return (
    <View>
      <View style={st.cards}>
        {cards.map(([k, title, n]) => (
          <View key={k} style={st.card}>
            <Plate veg={k === 'veg'} width={96} />
            <Text style={st.title}>{title}</Text>
            <View style={st.step}>
              <IconBtn name="minus" size={34} disabled={n <= 0 || total <= 1} onPress={() => bump(k, -1)} />
              <Text style={st.num}>{n}</Text>
              <IconBtn name="plus" size={34} solid disabled={total >= max} onPress={() => bump(k, 1)} />
            </View>
          </View>
        ))}
      </View>
      <Label style={st.hint}>{total} of {max} seat{max > 1 ? 's' : ''} used</Label>
    </View>
  );
}

const st = StyleSheet.create({
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 18, paddingHorizontal: 8, alignItems: 'center' },
  title: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 1.6, color: C.ink, marginTop: 14, textTransform: 'uppercase' },
  step: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  num: { fontFamily: F.semi, fontSize: 26, minWidth: 40, textAlign: 'center', color: C.ink },
  hint: { textAlign: 'center', marginTop: 12, fontSize: 9.5 },
});
