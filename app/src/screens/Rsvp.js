import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, FlatList, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Label, Heading, Btn, IconBtn, Card, Hair, tap } from '../components/ui';
import { Clock } from '../components/art';
import MealSplit from '../components/MealSplit';
import { useStore, splitOf } from '../store';

const fmt = (m) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function Rsvp({ onClose }) {
  const { guests, respond } = useStore();
  const [id, setId] = useState(null);
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [yes, setYes] = useState(true);
  const [veg, setVeg] = useState(1);
  const [nonveg, setNonveg] = useState(0);
  const [mins, setMins] = useState(19 * 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const g = guests.find((x) => x.id === id);
  useEffect(() => {
    if (!g) return;
    const s = splitOf(g);
    setYes(g.status !== 'declined'); setVeg(s.veg); setNonveg(s.nonveg);
    setMins(g.arrival ?? 19 * 60); setDone(false); setError('');
  }, [id]);

  const rows = useMemo(() => guests.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || a.name.localeCompare(b.name)), [guests, q]);

  const n = veg + nonveg;
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await respond(g.id, yes
      ? { status: 'confirmed', attending: n, vegCount: veg, arrival: mins }
      : { status: 'declined', attending: 0 });
    setDone(true); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26 }}><Label>Manual entry</Label>{onClose && <IconBtn name="x" size={36} onPress={onClose} />}</View>
      <Heading style={{ marginTop: 8 }}>Log a phone{'\n'}reply.</Heading>
      <Text style={styles.lede}>Most guests reply from their link. Use this only for someone who called or messaged you instead.</Text>

      <Pressable onPress={() => { tap(); setPick(true); }} style={styles.picker}>
        <View style={{ flex: 1 }}>
          <Label style={{ fontSize: 9.5 }}>Guest</Label>
          <Text style={[styles.pickName, !g && { color: C.muted }]}>{g ? g.name : 'Choose who replied'}</Text>
        </View>
        <Feather name="chevron-down" size={20} color={C.ink} />
      </Pressable>

      {!g ? (
        <Text style={styles.hint}>{guests.length ? 'Pick a guest to begin.' : 'Add some guests first.'}</Text>
      ) : done ? (
        <Card style={{ marginTop: 22, alignItems: 'center', paddingVertical: 34 }}>
          <View style={styles.tick}><Feather name="check" size={22} color={C.card} /></View>
          <Text style={styles.doneT}>Guest details updated</Text>
          <Text style={styles.doneS}>{yes ? `${g.name.split(' ')[0]} · ${n} coming · ${fmt(mins)}` : `${g.name.split(' ')[0]} can’t make it`}</Text>
          <Btn title="Next guest" kind="line" onPress={() => { setId(null); setDone(false); }} style={{ marginTop: 22 }} />
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: 22, padding: 20 }}>
            <Text style={styles.q}>Will you{'\n'}attend?</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={() => { tap(); setYes(true); }} style={[styles.yn, yes && styles.ynOn]}>
                {yes && <Feather name="check-circle" size={18} color={C.card} style={{ marginRight: 8 }} />}
                <Text style={[styles.ynT, yes && { color: C.card }]}>Yes</Text>
              </Pressable>
              <Pressable onPress={() => { tap(); setYes(false); }} style={[styles.yn, !yes && styles.ynOn]}>
                <Text style={[styles.ynT, !yes && { color: C.card }]}>No</Text>
              </Pressable>
            </View>
          </Card>

          {yes && (
            <>
              <Label style={styles.sec}>Number of guests</Label>
              <View style={styles.count}>
                <Text style={styles.big}>{n}</Text>
              </View>
              <Text style={styles.seatHint}>Invited for {g.seats} seat{g.seats > 1 ? 's' : ''}</Text>

              <Heading size={30} style={{ marginTop: 34 }}>Who eats{'\n'}what.</Heading>
              <View style={{ marginTop: 18 }}>
                <MealSplit veg={veg} nonveg={nonveg} max={g.seats} onChange={(v, nv) => { setVeg(v); setNonveg(nv); }} />
              </View>

              <Label style={styles.sec}>Expected arrival</Label>
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Clock hour={Math.floor(mins / 60)} minute={mins % 60} size={210} />
                <Text style={styles.time}>{fmt(mins)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 }}>
                  <IconBtn name="minus" size={38} onPress={() => setMins((m) => (m - 30 + 1440) % 1440)} />
                  <Label>± 30 min</Label>
                  <IconBtn name="plus" size={38} solid onPress={() => setMins((m) => (m + 30) % 1440)} />
                </View>
              </View>
            </>
          )}
          <Text accessibilityRole="alert" style={{ color: C.sindoor, marginTop: 12 }}>{error}</Text>
          <Btn disabled={busy} title={busy ? 'Saving…' : yes ? `Confirm · ${n} guest${n > 1 ? 's' : ''}` : 'Confirm · not attending'} onPress={confirm} style={{ marginTop: 30 }} />
        </>
      )}

      <Modal visible={pick} animationType="slide" onRequestClose={() => setPick(false)}>
        <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: 54 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 14 }}>
            <Text style={styles.modalT}>Who replied?</Text>
            <IconBtn name="x" size={36} onPress={() => setPick(false)} />
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder="Search guests" placeholderTextColor={C.muted} style={styles.search} />
          <FlatList data={rows} keyExtractor={(x) => x.id} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => { setId(item.id); setPick(false); setQ(''); }} style={styles.prow}>
                <Text style={styles.pname}>{item.name}</Text>
                <Label style={{ color: item.status === 'confirmed' ? C.leaf : item.status === 'declined' ? C.sindoor : C.muted }}>
                  {item.status === 'confirmed' ? 'Attending' : item.status === 'declined' ? 'Declined' : 'Pending'}
                </Label>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: F.reg, fontSize: 14.5, color: C.soft, lineHeight: 21, marginTop: 14 },
  picker: { flexDirection: 'row', alignItems: 'center', marginTop: 22, borderRadius: 16, borderWidth: 1.5, borderColor: C.ink, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card },
  pickName: { fontFamily: F.semi, fontSize: 17, color: C.ink, marginTop: 3 },
  hint: { fontFamily: F.reg, color: C.muted, marginTop: 26, textAlign: 'center' },
  q: { fontFamily: F.heavy, fontSize: 32, lineHeight: 33, letterSpacing: -1.2, color: C.ink, textTransform: 'uppercase' },
  yn: { flex: 1, height: 58, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: C.card },
  ynOn: { backgroundColor: C.ink, borderColor: C.ink },
  ynT: { fontFamily: F.heavy, fontSize: 14, letterSpacing: 3, color: C.ink, textTransform: 'uppercase' },
  sec: { marginTop: 32 },
  count: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  big: { fontFamily: F.reg, fontSize: 80, color: C.ink, letterSpacing: -3, lineHeight: 92 },
  seatHint: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: -4 },
  time: { fontFamily: F.heavy, fontSize: 44, letterSpacing: -2, color: C.ink, marginTop: 14 },
  tick: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  doneT: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 2, color: C.ink, marginTop: 16, textTransform: 'uppercase' },
  doneS: { fontFamily: F.reg, fontSize: 14, color: C.soft, marginTop: 6 },
  modalT: { fontFamily: F.heavy, fontSize: 26, letterSpacing: -0.9, color: C.ink },
  search: { height: 46, marginHorizontal: 22, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 18, fontFamily: F.med, fontSize: 14, color: C.ink, marginBottom: 6 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  pname: { fontFamily: F.semi, fontSize: 15.5, color: C.ink },
});
