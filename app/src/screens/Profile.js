import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Label, Heading, Btn, Field, Card, tap } from '../components/ui';
import { Person } from '../components/art';
import { useStore } from '../store';
import { PRIVACY_URL } from '../api';

const title = (e) => (e.bride || e.groom ? `${e.bride || 'Bride'} & ${e.groom || 'Groom'}` : 'New wedding');

export default function Profile({ go }) {
  const { me, events, wedding, switchEvent, addEvent, removeEvent, logout, deleteAccount } = useStore();
  const [adding, setAdding] = useState(false);
  const [bride, setBride] = useState('');
  const [groom, setGroom] = useState('');
  const [busy, setBusy] = useState(false);
  const current = wedding.id ?? events[0]?.id;

  const pick = async (id) => {
    if (id === current) return;
    tap();
    try { await switchEvent(id); go('guests'); } catch (e) { Alert.alert('Could not switch', e.message); }
  };
  const create = async () => {
    setBusy(true);
    try {
      await addEvent(bride.trim(), groom.trim());
      setAdding(false); setBride(''); setGroom('');
      go('invite'); // straight to the details of the new wedding
    } catch (e) { Alert.alert('Could not add the wedding', e.message); }
    setBusy(false);
  };
  const remove = (e) =>
    Alert.alert(`Remove ${title(e)}?`, `This permanently deletes this wedding and its ${e.guests} guest${e.guests === 1 ? '' : 's'} and replies. Your other weddings are not touched.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeEvent(e.id).catch((x) => Alert.alert('Could not remove', x.message)) },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account and every wedding, guest list and reply in it. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => deleteAccount().catch((x) => Alert.alert('Could not delete', x.message)) },
    ]);
  const signOut = () =>
    Alert.alert('Sign out?', 'Your weddings and guest lists stay safe on the server.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: logout },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Label style={{ marginTop: 26 }}>Account</Label>
      <Heading size={28} style={{ marginTop: 6 }}>Profile</Heading>

      <Card style={styles.me}>
        <View style={styles.avatar}><Person size={30} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text numberOfLines={1} style={styles.name}>{me?.name || 'Your account'}</Text>
          <Text numberOfLines={1} style={styles.email}>{me?.email || ''}</Text>
        </View>
      </Card>

      <View style={styles.head}>
        <Label>Your weddings · {events.length}</Label>
      </View>
      <Text style={styles.hint}>Each wedding has its own guest list, invitation and replies. Tap one to switch to it.</Text>

      {events.map((e) => {
        const on = e.id === current;
        return (
          <Pressable key={e.id} onPress={() => pick(e.id)} style={[styles.wed, on && styles.wedOn]}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.wedName}>{title(e)}</Text>
              <Text numberOfLines={1} style={styles.wedSub}>
                {[e.date, `${e.guests} ${e.guests === 1 ? 'household' : 'households'}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {on ? (
              <View style={styles.cur}><Feather name="check" size={12} color={C.card} /><Text style={styles.curT}>Current</Text></View>
            ) : events.length > 1 ? (
              <Pressable onPress={() => remove(e)} hitSlop={10} style={{ padding: 6 }}><Feather name="trash-2" size={17} color={C.muted} /></Pressable>
            ) : null}
          </Pressable>
        );
      })}

      {adding ? (
        <Card style={{ marginTop: 14 }}>
          <Label style={{ marginBottom: 10 }}>New wedding</Label>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1 }} label="Bride" value={bride} onChangeText={setBride} autoCapitalize="words" />
            <Field style={{ flex: 1 }} label="Groom" value={groom} onChangeText={setGroom} autoCapitalize="words" />
          </View>
          <Text style={[styles.hint, { marginTop: 0, marginBottom: 14 }]}>You can fill in the date, venue and the rest next.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="Cancel" kind="line" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Btn title={busy ? 'Adding…' : 'Add wedding'} onPress={create} disabled={busy} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Btn title="Add a wedding" icon="plus" kind="line" onPress={() => setAdding(true)} style={{ marginTop: 14 }} />
      )}

      <Label style={{ marginTop: 34 }}>More</Label>
      <Pressable onPress={() => Linking.openURL(PRIVACY_URL())} style={styles.link}>
        <Feather name="shield" size={18} color={C.ink} /><Text style={styles.linkT}>Privacy policy</Text>
      </Pressable>
      <Pressable onPress={signOut} style={styles.link}>
        <Feather name="log-out" size={18} color={C.ink} /><Text style={styles.linkT}>Sign out</Text>
      </Pressable>
      <Pressable onPress={confirmDelete} style={styles.link}>
        <Feather name="trash-2" size={18} color={C.sindoor} /><Text style={[styles.linkT, { color: C.sindoor }]}>Delete account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  name: { fontFamily: F.semi, fontSize: 17, color: C.ink },
  email: { fontFamily: F.reg, fontSize: 13, color: C.muted, marginTop: 2 },
  head: { marginTop: 30 },
  hint: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 6 },
  wed: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  wedOn: { borderColor: C.ink, borderWidth: 1.5 },
  wedName: { fontFamily: F.semi, fontSize: 16, color: C.ink },
  wedSub: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, marginTop: 3 },
  cur: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  curT: { fontFamily: F.semi, fontSize: 9, letterSpacing: 1.4, color: C.card, textTransform: 'uppercase' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  linkT: { fontFamily: F.semi, fontSize: 15, color: C.ink },
});
