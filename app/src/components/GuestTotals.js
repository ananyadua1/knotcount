import React, { useMemo } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import { Label, IconBtn } from './ui';
import { useStore } from '../store';

const Cell = ({ children, w, head, bold, color }) => (
  <Text style={[st.cell, { width: w }, head && st.head, bold && { fontFamily: F.heavy }, color && { color }]}>{children}</Text>
);

// Everyone who is coming: the total, the veg / non-veg split, and the same split for each family.
export default function GuestTotals({ visible, onClose }) {
  const { guests, stats } = useStore();
  const p = stats.people;
  const rows = useMemo(
    () => guests.filter((g) => g.status === 'confirmed').sort((a, b) => a.name.localeCompare(b.name)),
    [guests]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.grab} />
          <View style={st.top}>
            <View>
              <Label>Head count</Label>
              <Text style={st.title}>Total guests</Text>
            </View>
            <IconBtn name="x" size={36} onPress={onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={st.summary}>
              <View style={st.big}>
                <Label style={{ fontSize: 9.5 }}>Coming</Label>
                <Text style={st.bigNum}>{p.coming}</Text>
              </View>
              <View style={st.split}>
                <View style={st.splitBox}>
                  <View style={[st.dot, { backgroundColor: C.leaf }]} />
                  <Text style={st.splitNum}>{p.veg}</Text>
                  <Label style={{ fontSize: 9 }}>Vegetarian</Label>
                </View>
                <View style={st.splitBox}>
                  <View style={[st.dot, { backgroundColor: C.sindoor }]} />
                  <Text style={st.splitNum}>{p.nonveg}</Text>
                  <Label style={{ fontSize: 9 }}>Non-veg</Label>
                </View>
              </View>
            </View>
            {p.unchosen > 0 && (
              <Text style={st.note}>{p.unchosen} guest{p.unchosen > 1 ? 's' : ''} haven’t chosen veg or non-veg yet.</Text>
            )}

            <Label style={{ marginTop: 28 }}>By family</Label>
            {rows.length === 0 ? (
              <Text style={st.none}>Nobody has confirmed yet.</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                <View style={st.tr}>
                  <Text style={[st.cell, st.head, { flex: 1, textAlign: 'left' }]}>Family</Text>
                  <Cell w={44} head>Total</Cell>
                  <Cell w={44} head color={C.leaf}>Veg</Cell>
                  <Cell w={56} head color={C.sindoor}>Non-veg</Cell>
                </View>
                {rows.map((g) => {
                  const known = g.vegCount != null;
                  return (
                    <View key={g.id} style={st.tr}>
                      <Text numberOfLines={1} style={[st.name, { flex: 1 }]}>{g.name}</Text>
                      <Cell w={44} bold>{g.attending}</Cell>
                      <Cell w={44}>{known ? g.vegCount : '–'}</Cell>
                      <Cell w={56}>{known ? g.attending - g.vegCount : '–'}</Cell>
                    </View>
                  );
                })}
                <View style={[st.tr, st.foot]}>
                  <Text style={[st.name, { flex: 1, fontFamily: F.heavy }]}>All families · {rows.length}</Text>
                  <Cell w={44} bold>{p.coming}</Cell>
                  <Cell w={44} bold>{p.veg}</Cell>
                  <Cell w={56} bold>{p.nonveg}</Cell>
                </View>
              </View>
            )}

            {stats.pending > 0 && (
              <Text style={st.note}>
                {stats.pending} invitation{stats.pending > 1 ? 's' : ''} still waiting for a reply, up to {p.awaiting} more guest{p.awaiting > 1 ? 's' : ''}.
              </Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,23,20,0.45)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, maxHeight: '92%' },
  grab: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontFamily: F.heavy, fontSize: 24, color: C.ink, letterSpacing: -0.8, marginTop: 2 },
  summary: { flexDirection: 'row', gap: 12 },
  big: { flex: 1, borderRadius: 18, borderWidth: 1.5, borderColor: C.ink, backgroundColor: C.card, padding: 14, justifyContent: 'space-between' },
  bigNum: { fontFamily: F.semi, fontSize: 52, letterSpacing: -2, color: C.ink, marginTop: 6 },
  split: { flex: 1, gap: 12 },
  splitBox: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  splitNum: { fontFamily: F.semi, fontSize: 26, color: C.ink, letterSpacing: -0.8 },
  dot: { position: 'absolute', right: 14, top: 14, width: 8, height: 8, borderRadius: 4 },
  note: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 14 },
  none: { fontFamily: F.reg, fontSize: 14, color: C.muted, marginTop: 14 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  foot: { borderBottomWidth: 0, borderTopWidth: 1.5, borderTopColor: C.ink, marginTop: 2 },
  name: { fontFamily: F.semi, fontSize: 15, color: C.ink, paddingRight: 8 },
  cell: { fontFamily: F.semi, fontSize: 15, color: C.ink, textAlign: 'right' },
  head: { fontFamily: F.med, fontSize: 9.5, letterSpacing: 1.4, color: C.muted, textTransform: 'uppercase' },
});
