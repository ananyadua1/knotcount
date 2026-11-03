import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F } from '../theme';
import { Card, Label, Heading, Stat, Chip, Btn, tap } from '../components/ui';
import { Person } from '../components/art';
import GuestSheet from '../components/GuestSheet';
import ImportSheet from '../components/ImportSheet';
import GuestTotals from '../components/GuestTotals';
import { useStore, couple } from '../store';

const FILTERS = [
  { k: 'all', t: 'All' },
  { k: 'confirmed', t: 'Attending', tone: C.leaf },
  { k: 'pending', t: 'Pending', tone: C.haldi },
  { k: 'declined', t: 'Declined', tone: C.sindoor },
];
const STATUS = {
  confirmed: { t: 'Attending', tone: C.leaf },
  pending: { t: 'Pending', tone: C.haldi },
  declined: { t: 'Declined', tone: C.sindoor },
};

const guests_ = (n) => `${n} ${n === 1 ? 'guest' : 'guests'}`;

// "4 guests" for a household; once they reply, who is actually coming and what they eat
function detail(g) {
  if (g.status !== 'confirmed') return guests_(g.seats);
  let s = guests_(g.attending);
  if (g.attending !== g.seats) s += ` of ${g.seats} invited`;
  if (g.vegCount != null) s += ` · ${g.vegCount} veg, ${g.attending - g.vegCount} non-veg`;
  return s;
}

export default function Guests({ go }) {
  const { guests, stats, wedding } = useStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState({ open: false, guest: null });
  const [imp, setImp] = useState(false);
  const [totals, setTotals] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => (filter === 'all' || g.status === filter) && (!q || g.name.toLowerCase().includes(q) || (g.phone || '').includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, filter, query]);

  const households = (n) => `${n} household${n === 1 ? '' : 's'}`;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {wedding.bride && wedding.groom ? (
          <Label style={{ marginTop: 22 }}>{couple(wedding)}</Label>
        ) : (
          <Pressable onPress={() => go('invite')} style={{ marginTop: 22 }}><Label style={{ color: C.sindoor }}>Add your names →</Label></Pressable>
        )}
        <Heading size={28} style={{ marginTop: 6 }}>Guest list</Heading>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Stat label="Invited" sub="households" value={stats.invited} active={filter === 'all'} onPress={() => setFilter('all')} />
          <Stat label="Attending" sub="households" value={stats.confirmed} active={filter === 'confirmed'} onPress={() => setFilter('confirmed')} />
          <Stat label="Pending" sub="households" value={stats.pending} active={filter === 'pending'} onPress={() => setFilter('pending')} />
        </View>

        <Pressable onPress={() => { tap(); setTotals(true); }}>
          <Card style={styles.totalRow}>
            <View style={{ flex: 1 }}>
              <Label style={{ fontSize: 9.5 }}>Total guests attending</Label>
              <Text style={styles.totalNum}>{stats.people.coming}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
              <Text style={styles.totalMeals}>{stats.people.veg} veg  ·  {stats.people.nonveg} non-veg</Text>
              <Label style={{ marginTop: 4, fontSize: 9.5 }}>People, by family</Label>
            </View>
            <Feather name="chevron-right" size={20} color={C.ink} />
          </Card>
        </Pressable>

        {stats.pending > 0 && (
          <Card soft style={styles.nudge}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeT}>{households(stats.pending)} still to reply</Text>
              <Label style={{ marginTop: 3, fontSize: 9.5 }}>Send a gentle reminder</Label>
            </View>
            <Btn title="Remind" icon="bell" onPress={() => go('updates')} style={{ height: 40, paddingHorizontal: 16 }} />
          </Card>
        )}

        <Pressable onPress={() => { tap(); go('invite'); }}>
          <Card soft style={styles.nudge}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeT}>View invitations</Text>
              <Label style={{ marginTop: 3, fontSize: 9.5 }}>
                {stats.households ? `${stats.sent} of ${stats.households} sent` : 'Add guests to start sending'}
              </Label>
            </View>
            <Feather name="chevron-right" size={20} color={C.ink} />
          </Card>
        </Pressable>

        <View style={styles.guestsHead}>
          <Label>Guests</Label>
          <Btn title="Add guests" icon="plus" onPress={() => setSheet({ open: true, guest: null })} style={{ height: 40, paddingHorizontal: 16 }} />
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={C.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search guests" placeholderTextColor={C.muted} style={styles.search} />
          {!!query && <Pressable onPress={() => setQuery('')} hitSlop={10}><Feather name="x" size={16} color={C.muted} /></Pressable>}
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
            <Text style={styles.emptyBody}>Add families one by one, or pull them in from your phone contacts. Each name covers however many guests you give it.</Text>
            <Btn title="Import contacts" kind="line" icon="user-plus" onPress={() => setImp(true)} style={{ marginTop: 20 }} />
          </View>
        ) : list.length === 0 ? (
          <Text style={[styles.emptyBody, { marginTop: 36, textAlign: 'center' }]}>No guests match.</Text>
        ) : (
          <View style={{ marginTop: 6 }}>
            {list.map((g) => {
              const st = STATUS[g.status];
              return (
                <Pressable key={g.id} style={styles.row} onPress={() => { tap(); setSheet({ open: true, guest: g }); }}>
                  <View style={styles.avatar}><Person size={26} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={styles.gname}>{g.name}</Text>
                    <Text numberOfLines={1} style={styles.gsub}>{detail(g)}</Text>
                  </View>
                  <View style={[styles.pill, { borderColor: st.tone }]}>
                    <View style={[styles.pillDot, { backgroundColor: st.tone }]} />
                    <Text style={styles.pillT}>{st.t}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <GuestSheet visible={sheet.open} guest={sheet.guest} onClose={() => setSheet({ open: false, guest: null })} onImport={() => setImp(true)} />
      <GuestTotals visible={totals} onClose={() => setTotals(false)} />
      <ImportSheet visible={imp} onClose={() => setImp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  totalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 12 },
  totalNum: { fontFamily: F.semi, fontSize: 34, color: C.ink, letterSpacing: -1, marginTop: 2 },
  totalMeals: { fontFamily: F.semi, fontSize: 13, color: C.ink },
  nudge: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 12 },
  nudgeT: { fontFamily: F.heavy, fontSize: 13, letterSpacing: 1.2, color: C.ink, textTransform: 'uppercase' },
  guestsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 16, marginTop: 14 },
  search: { flex: 1, marginLeft: 10, fontFamily: F.med, fontSize: 14, color: C.ink, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  gname: { fontFamily: F.semi, fontSize: 15.5, color: C.ink },
  gsub: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 8, backgroundColor: C.card },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  pillT: { fontFamily: F.semi, fontSize: 9, letterSpacing: 1.2, color: C.ink, textTransform: 'uppercase' },
  empty: { alignItems: 'center', marginTop: 44, paddingHorizontal: 14 },
  ghost: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  emptyTitle: { fontFamily: F.heavy, fontSize: 20, color: C.ink, marginTop: 20, letterSpacing: -0.4 },
  emptyBody: { fontFamily: F.reg, fontSize: 14, color: C.muted, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
