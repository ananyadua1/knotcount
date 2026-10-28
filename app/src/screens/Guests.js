import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { C, F } from '../theme';
import { Card, Label, Heading, Stat, Chip, Btn, IconBtn, tap } from '../components/ui';
import { Person } from '../components/art';
import GuestSheet from '../components/GuestSheet';
import ImportSheet from '../components/ImportSheet';
import { useStore, couple } from '../store';

const FILTERS = [
  { k: 'all', t: 'All' },
  { k: 'confirmed', t: 'Attending', tone: C.leaf },
  { k: 'pending', t: 'Pending', tone: C.haldi },
  { k: 'declined', t: 'Declined', tone: C.sindoor },
];

export default function Guests({ go }) {
  const { guests, stats, wedding } = useStore();
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState({ open: false, guest: null });
  const [imp, setImp] = useState(false);

  const list = useMemo(
    () => guests.filter((g) => filter === 'all' || g.status === filter).sort((a, b) => a.name.localeCompare(b.name)),
    [guests, filter]
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {wedding.bride && wedding.groom ? (
          <Label style={{ marginTop: 26 }}>Dashboard · {couple(wedding)}</Label>
        ) : (
          <Pressable onPress={() => go('invite')} style={{ marginTop: 26 }}><Label style={{ color: C.sindoor }}>Dashboard · add your names →</Label></Pressable>
        )}
        <Heading style={{ marginTop: 8 }}>Wedding{'\n'}guest manager</Heading>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
          <Stat label="Invited" value={stats.invited} active onPress={() => setFilter('all')} />
          <Stat label="Confirmed" value={stats.confirmed} onPress={() => setFilter('confirmed')} />
          <Stat label="Pending" value={stats.pending} onPress={() => setFilter('pending')} />
        </View>

        <Pressable onPress={() => { tap(); go('invite'); }}>
          <Card soft style={styles.inviteRow}>
            <Feather name="mail" size={34} color={C.ink} strokeWidth={1} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.inviteTitle}>Invitations</Text>
              <Label style={{ marginTop: 3, fontSize: 9.5 }}>
                {stats.households ? `${stats.sent} of ${stats.households} sent over chat` : 'Add guests to start sending'}
              </Label>
            </View>
            <View style={styles.chatBtn}><Feather name="message-square" size={18} color={C.card} /></View>
          </Card>
        </Pressable>

        <View style={styles.guestsHead}>
          <Label>Guests</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconBtn name="user-plus" size={36} onPress={() => setImp(true)} />
            <IconBtn name="plus" size={36} solid onPress={() => setSheet({ open: true, guest: null })} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -22 }} contentContainerStyle={{ paddingHorizontal: 22 }}>
          {FILTERS.map((f) => <Chip key={f.k} title={f.t} tone={f.tone} active={filter === f.k} onPress={() => setFilter(f.k)} />)}
        </ScrollView>

        {guests.length === 0 ? (
          <View style={styles.empty}>
            <View style={{ flexDirection: 'row' }}>{[0, 1, 2].map((i) => (
              <View key={i} style={[styles.ghost, i && { marginLeft: -10 }]}><Person size={26} color={C.muted} /></View>
            ))}</View>
            <Text style={styles.emptyTitle}>No guests yet</Text>
            <Text style={styles.emptyBody}>Add families one by one, or pull them in from your phone contacts. Each name covers however many seats you give it.</Text>
            <Btn title="Import contacts" kind="line" icon="user-plus" onPress={() => setImp(true)} style={{ marginTop: 20 }} />
          </View>
        ) : list.length === 0 ? (
          <Text style={[styles.emptyBody, { marginTop: 36, textAlign: 'center' }]}>Nobody here yet.</Text>
        ) : (
          <View style={styles.grid}>
            {list.map((g) => (
              <Pressable key={g.id} style={styles.cell} onPress={() => { tap(); setSheet({ open: true, guest: g }); }}>
                <View style={[styles.avatar, g.status === 'confirmed' && styles.avOn, g.status === 'declined' && styles.avOff]}>
                  <Person size={30} color={g.status === 'confirmed' ? C.card : g.status === 'declined' ? C.muted : C.ink} />
                  {g.seats > 1 && <View style={styles.badge}><Text style={styles.badgeText}>{g.seats}</Text></View>}
                </View>
                <Text numberOfLines={1} style={[styles.gname, g.status === 'declined' && { color: C.muted, textDecorationLine: 'line-through' }]}>
                  {g.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <GuestSheet visible={sheet.open} guest={sheet.guest} onClose={() => setSheet({ open: false, guest: null })} />
      <ImportSheet visible={imp} onClose={() => setImp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  inviteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 14 },
  inviteTitle: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 1.6, color: C.ink, textTransform: 'uppercase' },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  guestsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, marginHorizontal: -4 },
  cell: { width: '20%', alignItems: 'center', marginBottom: 18 },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  avOn: { backgroundColor: C.ink },
  avOff: { borderColor: C.line, borderStyle: 'dashed', backgroundColor: 'transparent' },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.haldi, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.paper },
  badgeText: { fontFamily: F.heavy, fontSize: 9.5, color: C.ink },
  gname: { fontFamily: F.med, fontSize: 11, color: C.soft, marginTop: 6, maxWidth: 62 },
  empty: { alignItems: 'center', marginTop: 44, paddingHorizontal: 14 },
  ghost: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  emptyTitle: { fontFamily: F.heavy, fontSize: 20, color: C.ink, marginTop: 20, letterSpacing: -0.4 },
  emptyBody: { fontFamily: F.reg, fontSize: 14, color: C.muted, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
