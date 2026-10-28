import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Btn, Field, Label, Segmented, Chip, IconBtn } from './ui';
import { useStore } from '../store';

const blank = { name: '', phone: '', email: '', side: 'bride', seats: 1, status: 'pending', attending: 0, meal: null };

export default function GuestSheet({ guest, visible, onClose }) {
  const { addGuests, updateGuest, removeGuest } = useStore();
  const [g, setG] = useState(blank);
  const isNew = !guest || !guest.id;

  useEffect(() => { if (visible) setG(guest && guest.id ? { ...guest } : { ...blank, ...(guest || {}) }); }, [visible, guest]);
  const set = (k, v) => setG((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!g.name.trim()) return;
    const clean = { ...g, name: g.name.trim(), seats: Math.max(1, g.seats) };
    if (clean.status === 'confirmed' && !clean.attending) clean.attending = clean.seats;
    if (clean.status !== 'confirmed') clean.attending = 0;
    if (isNew) addGuests([clean]); else updateGuest(g.id, clean);
    onClose();
  };
  const del = () =>
    Alert.alert('Remove guest?', `${g.name} will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { removeGuest(g.id); onClose(); } },
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
                <IconBtn name="minus" size={34} onPress={() => set('seats', Math.max(1, g.seats - 1))} />
                <Text style={st.num}>{g.seats}</Text>
                <IconBtn name="plus" size={34} solid onPress={() => set('seats', g.seats + 1)} />
              </View>
            </View>
            <Label style={{ marginBottom: 8 }}>Response</Label>
            <Segmented
              value={g.status}
              onChange={(v) => setG((x) => ({ ...x, status: v, attending: v === 'confirmed' ? x.attending || x.seats : 0 }))}
              options={[{ label: 'Pending', value: 'pending' }, { label: 'Attending', value: 'confirmed' }, { label: 'Declined', value: 'declined' }]}
            />
            {g.status === 'confirmed' && (
              <View style={{ marginTop: 16 }}>
                <View style={[st.row, { marginTop: 0 }]}>
                  <Label>Coming</Label>
                  <View style={st.stepper}>
                    <IconBtn name="minus" size={34} onPress={() => set('attending', Math.max(1, g.attending - 1))} />
                    <Text style={st.num}>{g.attending}</Text>
                    <IconBtn name="plus" size={34} solid onPress={() => set('attending', Math.min(g.seats + 4, g.attending + 1))} />
                  </View>
                </View>
                <Label style={{ marginBottom: 8 }}>Food</Label>
                <View style={{ flexDirection: 'row' }}>
                  <Chip title="Veg" tone={C.leaf} active={g.meal === 'veg'} onPress={() => set('meal', 'veg')} />
                  <Chip title="Non-veg" tone={C.sindoor} active={g.meal === 'nonveg'} onPress={() => set('meal', 'nonveg')} />
                </View>
              </View>
            )}
            <View style={{ height: 22 }} />
            <Btn title={isNew ? 'Add guest' : 'Save changes'} onPress={save} disabled={!g.name.trim()} />
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
