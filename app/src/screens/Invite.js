import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F, shadow } from '../theme';
import { Label, Heading, Btn, Field, IconBtn, Card, tap } from '../components/ui';
import { useStore, couple, fill } from '../store';
import { sendChat } from '../send';

export default function Invite() {
  const { wedding, setWedding, guests, updateGuest } = useStore();
  const [edit, setEdit] = useState(false);
  const set = (k) => (v) => setWedding((w) => ({ ...w, [k]: v }));
  const todo = guests.filter((g) => !g.invited);
  const sent = guests.filter((g) => g.invited);

  const send = async (g) => {
    const ok = await sendChat(g, fill(wedding.invite, g, wedding));
    if (ok) updateGuest(g.id, { invited: true });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Label style={{ marginTop: 26 }}>Invitation</Label>
      <Heading style={{ marginTop: 8 }}>One message,{'\n'}every guest.</Heading>

      <View style={[styles.card, shadow]}>
        <View style={styles.inner}>
          <Label style={{ letterSpacing: 4 }}>{(wedding.bride || 'A')[0]} & {(wedding.groom || 'R')[0]}</Label>
          <Text style={styles.invited}>You’re{'\n'}invited</Text>
          <Text style={styles.names}>{couple(wedding)}</Text>
          <View style={styles.rule} />
          <Text style={styles.meta}>{wedding.date} · {wedding.time}</Text>
          <Text style={[styles.meta, { color: C.muted }]}>{wedding.venue}</Text>
        </View>
      </View>

      <Pressable onPress={() => { tap(); setEdit((e) => !e); }} style={styles.editRow}>
        <Label style={{ color: C.ink }}>Edit details</Label>
        <Feather name={edit ? 'chevron-up' : 'chevron-down'} size={18} color={C.ink} />
      </Pressable>
      {edit && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1 }} label="Bride" value={wedding.bride} onChangeText={set('bride')} />
            <Field style={{ flex: 1 }} label="Groom" value={wedding.groom} onChangeText={set('groom')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1.5 }} label="Date" value={wedding.date} onChangeText={set('date')} />
            <Field style={{ flex: 1 }} label="Time" value={wedding.time} onChangeText={set('time')} />
          </View>
          <Field label="Venue" value={wedding.venue} onChangeText={set('venue')} />
          <Field label="Message  ·  {name} {couple} {date} {time} {venue} {link}" value={wedding.invite} onChangeText={set('invite')} multiline />
        </View>
      )}

      <View style={styles.sectionHead}>
        <Label>To send · {todo.length}</Label>
      </View>
      {todo.length === 0 && (
        <Text style={styles.none}>{guests.length ? 'Everyone has been sent an invitation.' : 'Add guests on the first tab, then send from here.'}</Text>
      )}
      {todo.map((g) => (
        <View key={g.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gname}>{g.name}</Text>
            <Text style={styles.gsub}>{g.phone || 'No number · opens share sheet'}</Text>
          </View>
          <Btn title="Send" icon="send" onPress={() => send(g)} style={{ height: 40, paddingHorizontal: 16 }} />
        </View>
      ))}

      {sent.length > 0 && (
        <>
          <View style={styles.sectionHead}><Label>Sent · {sent.length}</Label></View>
          {sent.map((g) => (
            <View key={g.id} style={styles.row}>
              <Feather name="check-circle" size={18} color={C.leaf} style={{ marginRight: 12 }} />
              <Text style={[styles.gname, { flex: 1, color: C.soft }]}>{g.name}</Text>
              <Pressable onPress={() => send(g)}><Label style={{ color: C.ink }}>Resend</Label></Pressable>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 26, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink, padding: 8 },
  inner: { borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: 30, paddingHorizontal: 22, alignItems: 'center' },
  invited: { fontFamily: F.serif, fontSize: 54, lineHeight: 56, color: C.ink, textAlign: 'center', marginTop: 16 },
  names: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 3, color: C.sindoor, marginTop: 18, textTransform: 'uppercase' },
  rule: { width: 28, height: 1.5, backgroundColor: C.ink, marginVertical: 18 },
  meta: { fontFamily: F.med, fontSize: 13, color: C.ink, marginTop: 3, textAlign: 'center' },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  sectionHead: { marginTop: 28, marginBottom: 6 },
  none: { fontFamily: F.reg, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  gname: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  gsub: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
});
