import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Btn, Field, Label, Segmented, IconBtn } from './ui';
import MealSplit from './MealSplit';
import { useStore, splitOf, fitSplit } from '../store';

const blank = { name: '', phone: '', email: '', side: 'bride', seats: 1, status: 'pending', attending: 0, vegCount: null };

export default function GuestSheet({ guest, visible, onClose, onImport }) {
  const { addGuests, updateGuest, removeGuest } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [g, setG] = useState(blank);
  const isNew = !guest || !guest.id;

  useEffect(() => { if (visible) { setError(''); } if (visible) setG(guest && guest.id ? { ...guest } : { ...blank, ...(guest || {}) }); }, [visible, guest]);
  const set = (k, v) => setG((x) => ({ ...x, [k]: v }));
  // fewer seats can't leave more people coming than the invite covers
  const setSeats = (n) => setG((x) => {
    const seats = Math.min(50, Math.max(1, n));
    if (x.status !== 'confirmed') return { ...x, seats };
    const s = fitSplit(splitOf(x), seats);
    return { ...x, seats, attending: s.veg + s.nonveg, vegCount: s.veg };
  });
  const setStatus = (status) => setG((x) => {
    if (status !== 'confirmed') return { ...x, status, attending: 0, vegCount: null };
    const s = splitOf(x, x.attending || x.seats);
    return { ...x, status, attending: s.veg + s.nonveg, vegCount: s.veg };
  });

  const save = async () => {
    if (busy) return;
    if (!g.name.trim()) return;
    const clean = { ...g, name: g.name.trim(), seats: Math.max(1, g.seats) };
    if (clean.status === 'confirmed') {
      const s = splitOf(clean);
      clean.attending = s.veg + s.nonveg; clean.vegCount = s.veg;
    } else { clean.attending = 0; clean.vegCount = null; }
    setBusy(true); setError('');
    try { if (isNew) await addGuests([clean]); else await updateGuest(g.id, clean); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const del = () =>
    Alert.alert('Remove guest?', `${g.name} will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await removeGuest(g.id); onClose(); } catch (e) { setError(e.message); } } },
    ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.grab} />
          <View style={st.head}>
            <View>
              <Label>{isNew ? 'New guest' : 'Guest'}</Label>
              <Text style={st.title}>{isNew ? 'Add a name' : g.name || 'Guest'}</Text>
            </View>
            <IconBtn name="x" size={36} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {isNew && onImport && (
              <Btn title="Import from contacts" kind="line" icon="user-plus" onPress={() => { onClose(); onImport(); }} style={{ marginBottom: 18 }} />
            )}
            <Field label="Name" value={g.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Sharma family" />
            <Field label="Phone (WhatsApp)" value={g.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" placeholder="+91 98xxx xxxxx" />
            <Field label="Email (optional, for reminders)" value={g.email || ''} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
            <Label style={{ marginBottom: 8 }}>Side</Label>
            <Segmented
              value={g.side} onChange={(v) => set('side', v)}
              options={[{ label: 'Bride', value: 'bride' }, { label: 'Groom', value: 'groom' }, { label: 'Both', value: 'both' }]}
            />
            <View style={st.row}>
              <View>
                <Label>Invited seats</Label>
                <Text style={st.hint}>People this invite covers</Text>
              </View>
              <View style={st.stepper}>
                <IconBtn name="minus" size={34} onPress={() => setSeats(g.seats - 1)} />
                <Text style={st.num}>{g.seats}</Text>
                <IconBtn name="plus" size={34} solid onPress={() => setSeats(g.seats + 1)} />
              </View>
            </View>
            <Label style={{ marginBottom: 8 }}>Response</Label>
            <Segmented
              value={g.status}
              onChange={setStatus}
              options={[{ label: 'Pending', value: 'pending' }, { label: 'Attending', value: 'confirmed' }, { label: 'Declined', value: 'declined' }]}
            />
            {g.status === 'confirmed' && (() => {
              const s = splitOf(g);
              return (
                <View style={{ marginTop: 16 }}>
                  <View style={[st.row, { marginTop: 0, marginBottom: 14 }]}>
                    <Label>Coming</Label>
                    <Text style={st.num}>{s.veg + s.nonveg}</Text>
                  </View>
                  <MealSplit veg={s.veg} nonveg={s.nonveg} max={g.seats}
                    onChange={(veg, nonveg) => setG((x) => ({ ...x, attending: veg + nonveg, vegCount: veg }))} />
                </View>
              );
            })()}
            <View style={{ height: 22 }} />
            {!!error && <Text accessibilityRole="alert" style={{ color: C.sindoor, marginBottom: 12 }}>{error}</Text>}
            <Btn title={busy ? 'Saving…' : isNew ? 'Add guest' : 'Save changes'} onPress={save} disabled={busy || !g.name.trim()} />
            {!isNew && (
              <Pressable onPress={del} style={{ alignSelf: 'center', padding: 16 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 11, letterSpacing: 2, color: C.sindoor }}>REMOVE GUEST</Text>
              </Pressable>
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,23,20,0.45)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, maxHeight: '92%' },
  grab: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontFamily: F.heavy, fontSize: 24, color: C.ink, letterSpacing: -0.8, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 18 },
  hint: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  num: { fontFamily: F.semi, fontSize: 22, minWidth: 44, textAlign: 'center', color: C.ink },
});
