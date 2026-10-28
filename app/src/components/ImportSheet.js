import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, FlatList, Pressable, StyleSheet, TextInput, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { C, F } from '../theme';
import { Btn, Label, IconBtn, tap } from './ui';
import { useStore } from '../store';

export default function ImportSheet({ visible, onClose }) {
  const { addGuests, guests } = useStore();
  const [all, setAll] = useState([]);
  const [sel, setSel] = useState({});
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSel({}); setQ(''); setMsg('Loading contacts…');
    (async () => {
      try {
        if (Platform.OS === 'web') { setMsg('Contacts are only available on the phone.'); return; }
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') { setMsg('Allow contacts access in Settings to import guests.'); return; }
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        const have = new Set(guests.map((g) => g.name.toLowerCase()));
        const rows = data.filter((c) => c.name && !have.has(c.name.toLowerCase()))
          .map((c) => ({ id: c.id, name: c.name, phone: c.phoneNumbers && c.phoneNumbers[0] ? c.phoneNumbers[0].number : '' }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAll(rows); setMsg(rows.length ? '' : 'No new contacts found.');
      } catch (e) { setMsg('Could not read contacts.'); }
    })();
  }, [visible]);

  const rows = useMemo(() => all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())), [all, q]);
  const n = Object.keys(sel).length;
  const add = () => {
    addGuests(all.filter((c) => sel[c.id]).map((c) => ({ name: c.name, phone: c.phone })));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.wrap}>
        <View style={st.head}>
          <View><Label>Import</Label><Text style={st.title}>From contacts</Text></View>
          <IconBtn name="x" size={36} onPress={onClose} />
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={C.muted} style={st.search} />
        {msg ? <Text style={st.msg}>{msg}</Text> : null}
        <FlatList
          data={rows} keyExtractor={(c) => c.id} keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = !!sel[item.id];
            return (
              <Pressable onPress={() => { tap(); setSel((s) => { const x = { ...s }; on ? delete x[item.id] : (x[item.id] = 1); return x; }); }} style={st.row}>
                <View style={[st.box, on && { backgroundColor: C.ink }]}>{on && <Feather name="check" size={14} color={C.card} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{item.name}</Text>
                  {!!item.phone && <Text style={st.phone}>{item.phone}</Text>}
                </View>
              </Pressable>
            );
          }}
        />
        <View style={st.foot}><Btn title={n ? `Add ${n} guest${n > 1 ? 's' : ''}` : 'Select contacts'} onPress={add} disabled={!n} /></View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.paper, paddingTop: 54 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 16 },
  title: { fontFamily: F.heavy, fontSize: 24, color: C.ink, letterSpacing: -0.8, marginTop: 2 },
  search: { height: 46, marginHorizontal: 22, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 18, fontFamily: F.med, fontSize: 14, color: C.ink, marginBottom: 6 },
  msg: { fontFamily: F.reg, color: C.muted, textAlign: 'center', marginTop: 30, paddingHorizontal: 30, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.ink, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  phone: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, marginTop: 2 },
  foot: { padding: 22, paddingBottom: 34 },
});
