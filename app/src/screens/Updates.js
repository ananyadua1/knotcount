import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F, shadow } from '../theme';
import { Label, Heading, Stat, Btn, Card, Field, tap } from '../components/ui';
import { Person } from '../components/art';
import { useStore, fill } from '../store';
import { sendChat } from '../send';
import { api } from '../api';
import Rsvp from './Rsvp';

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
};

export default function Updates() {
  const { guests, stats, wedding, setWedding, updateGuest, respond, mail, refresh } = useStore();
  const [edit, setEdit] = useState(false);
  const [log, setLog] = useState(false);
  const emailAll = async () => {
    try { const r = await api('POST', '/api/reminders/email'); Alert.alert('Reminders sent', `${r.sent} email${r.sent === 1 ? '' : 's'} sent${r.failed ? `, ${r.failed} failed` : ''}.`); refresh(); }
    catch (e) { Alert.alert('Could not send', e.message); }
  };
  const pending = guests.filter((g) => g.status === 'pending');
  const replied = guests.filter((g) => g.respondedAt).sort((a, b) => b.respondedAt - a.respondedAt).slice(0, 8);
  const toggle = (g, status) =>
    respond(g.id, status === 'confirmed'
      ? { status, attending: g.attending || g.seats }
      : { status, attending: 0 });

  const remind = async (g) => {
    await sendChat(g, fill(wedding.reminder, g, wedding));
    updateGuest(g.id, { reminded: Date.now() });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Label style={{ marginTop: 26 }}>Live count</Label>
      <Heading style={{ marginTop: 8 }}>RSVP{'\n'}updates.</Heading>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
        <Stat label="Confirmed" value={stats.confirmed} active />
        <Stat label="Declined" value={stats.declined} />
        <Stat label="Awaiting" value={stats.pending} />
      </View>
      <Text style={styles.meals}>
        For the caterer: <Text style={styles.mb}>{stats.veg} veg</Text>  ·  <Text style={styles.mb}>{stats.nonveg} non-veg</Text>
        {stats.confirmed - stats.veg - stats.nonveg > 0 ? `  ·  ${stats.confirmed - stats.veg - stats.nonveg} not chosen` : ''}
      </Text>

      <Label style={{ marginTop: 34 }}>Automatic reminders</Label>
      <Card style={styles.bell}>
        <View style={styles.bellIcon}><Feather name="bell" size={22} color={C.ink} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.bellT}>Wedding reminder</Text>
          <Label style={{ fontSize: 9.5, marginTop: 4 }}>Please confirm your attendance</Label>
        </View>
        <Pressable onPress={() => { tap(); setEdit((e) => !e); }} hitSlop={10}><Feather name="edit-3" size={18} color={C.ink} /></Pressable>
      </Card>
      {edit && (
        <View style={{ marginTop: 14 }}>
          <Field label="Message  ·  {name} {couple} {date}" value={wedding.reminder} multiline onChangeText={(v) => setWedding((w) => ({ ...w, reminder: v }))} />
        </View>
      )}
      {mail ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.autoRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.autoT}>Remind by email every 3 days</Text>
              <Text style={styles.note}>Sent automatically to pending guests who have an email.</Text>
            </View>
            <Switch value={!!wedding.autoReminders} onValueChange={(v) => setWedding((w) => ({ ...w, autoReminders: v }))} trackColor={{ true: C.ink, false: C.line }} thumbColor={C.card} />
          </View>
          <Btn title="Email all pending now" kind="line" icon="mail" onPress={emailAll} style={{ marginTop: 12 }} />
        </View>
      ) : null}
      <Text style={styles.note}>Each guest replies on their own link, so your totals update by themselves. WhatsApp reminders open ready-typed for you to send.</Text>

      {pending.length === 0 ? (
        <Text style={styles.none}>{guests.length ? 'Nobody is waiting on a reply.' : 'No guests yet.'}</Text>
      ) : (
        pending.map((g) => (
          <View key={g.id} style={styles.row}>
            <View style={styles.av}><Person size={24} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{g.name}</Text>
              <Text style={styles.sub}>{g.reminded ? `Reminded ${ago(g.reminded)}` : g.invited ? 'Invited · no reply' : 'Not invited yet'}</Text>
            </View>
            <View style={styles.pill}><Text style={styles.pillT}>Pending</Text></View>
            <Pressable onPress={() => { tap(); remind(g); }} style={styles.go}><Feather name="send" size={16} color={C.card} /></Pressable>
          </View>
        ))
      )}

      <Label style={{ marginTop: 36 }}>Recent replies</Label>
      {replied.length === 0 && <Text style={styles.none}>Replies you record will show up here.</Text>}
      {replied.map((g) => (
        <Card key={g.id} style={{ marginTop: 12, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.av, { width: 46, height: 46, borderRadius: 23 }]}><Person size={26} /></View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Label style={{ fontSize: 9.5 }}>{g.via === 'link' ? 'Replied via link' : 'Logged by you'} · {ago(g.respondedAt)}</Label>
              <Text style={[styles.name, { fontSize: 16, marginTop: 3 }]}>{g.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {[['confirmed', 'Attending'], ['declined', 'Not attending']].map(([k, t]) => (
              <Pressable key={k} onPress={() => { tap(); toggle(g, k); }} style={[styles.tog, g.status === k && { backgroundColor: C.ink, borderColor: C.ink }]}>
                <Text style={[styles.togT, g.status === k && { color: C.card }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ))}
      <Btn title="Log a phone reply" kind="line" icon="edit-3" onPress={() => setLog(true)} style={{ marginTop: 28 }} />
      <Modal visible={log} animationType="slide" onRequestClose={() => setLog(false)}>
        <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: 36 }}><Rsvp onClose={() => setLog(false)} /></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  autoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoT: { fontFamily: F.semi, fontSize: 14.5, color: C.ink },
  meals: { fontFamily: F.reg, fontSize: 13, color: C.soft, marginTop: 14 },
  mb: { fontFamily: F.semi, color: C.ink },
  bell: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderColor: C.ink, borderWidth: 1.5 },
  bellIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.wash, alignItems: 'center', justifyContent: 'center' },
  bellT: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 1.6, color: C.ink, textTransform: 'uppercase' },
  note: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 12, marginBottom: 8 },
  none: { fontFamily: F.reg, fontSize: 14, color: C.muted, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  av: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  name: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
  pill: { borderWidth: 1, borderColor: C.ink, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, marginRight: 10 },
  pillT: { fontFamily: F.semi, fontSize: 8.5, letterSpacing: 1.4, color: C.ink, textTransform: 'uppercase' },
  go: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  tog: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  togT: { fontFamily: F.semi, fontSize: 11, letterSpacing: 2, color: C.soft, textTransform: 'uppercase' },
});
