import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F, shadow } from '../theme';
import { Label, Heading, Btn, Field, tap } from '../components/ui';
import InviteCard, { GOLD, MAROON, SAGE } from '../components/InviteCard';
import { useStore, DESIGNS, inviteText, compose } from '../store';
import { sendChat } from '../send';

// the little swatch shown for each design in the chooser
const SWATCH = {
  classic: { bg: C.card, border: C.ink, fg: C.ink },
  royal: { bg: MAROON, border: MAROON, fg: GOLD },
  garden: { bg: SAGE, border: C.leaf, fg: C.leaf },
  custom: { bg: C.paper, border: C.muted, fg: C.ink },
};

export default function Invite() {
  const { wedding, setWedding, guests, updateGuest } = useStore();
  const set = (k) => (v) => setWedding((w) => ({ ...w, [k]: v }));
  const design = wedding.template || 'classic';
  const todo = guests.filter((g) => !g.invited);
  const sent = guests.filter((g) => g.invited);
  const text = inviteText(wedding);
  const ownText = !!wedding.invite && wedding.invite.trim() !== '' && !wedding.invite.includes('{couple} are getting married');

  const send = async (g) => {
    if (!text.trim()) { Alert.alert('Write your invitation first', 'Paste or type the text you want to send in the Your message box.'); return; }
    const ok = await sendChat(g, compose(text, g, wedding));
    if (ok) updateGuest(g.id, { invited: true });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Label style={{ marginTop: 26 }}>Invitation</Label>
      <Heading size={28} style={{ marginTop: 6 }}>Design your{'\n'}invitation</Heading>

      <Label style={{ marginTop: 22 }}>Choose a design</Label>
      <View style={styles.tiles}>
        {DESIGNS.map((d) => {
          const s = SWATCH[d.k], on = design === d.k;
          return (
            <Pressable key={d.k} onPress={() => { tap(); set('template')(d.k); }} style={styles.tileWrap}>
              <View style={[styles.tile, { backgroundColor: s.bg, borderColor: on ? C.ink : s.border }, on && styles.tileOn, d.k === 'custom' && { borderStyle: 'dashed' }]}>
                {d.k === 'custom'
                  ? <Feather name="edit-3" size={20} color={s.fg} />
                  : <Text style={[styles.tileMono, { color: s.fg }]}>{(wedding.bride || 'A')[0]}&{(wedding.groom || 'R')[0]}</Text>}
                {on && <View style={styles.tick}><Feather name="check" size={11} color={C.card} /></View>}
              </View>
              <Text style={[styles.tileName, on && { color: C.ink, fontFamily: F.heavy }]}>{d.t}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[{ marginTop: 20 }, design !== 'custom' && shadow]}>
        <InviteCard w={wedding} design={design} />
      </View>

      <Label style={{ marginTop: 30 }}>Wedding details</Label>
      <Text style={styles.hint}>These appear on the card, in your message, and on the page your guests open.</Text>
      <View style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Bride" value={wedding.bride} onChangeText={set('bride')} autoCapitalize="words" />
          <Field style={{ flex: 1 }} label="Groom" value={wedding.groom} onChangeText={set('groom')} autoCapitalize="words" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1.5 }} label="Date" value={wedding.date} onChangeText={set('date')} placeholder="Sat, 20 Feb 2027" />
          <Field style={{ flex: 1 }} label="Time" value={wedding.time} onChangeText={set('time')} placeholder="7:00 PM" />
        </View>
        <Field label="Venue" value={wedding.venue} onChangeText={set('venue')} placeholder="Hotel / hall, city" />
        <Field label="Extra line (optional)" value={wedding.extra} onChangeText={set('extra')} placeholder="Dress code, reception to follow…" />
      </View>

      <Label style={{ marginTop: 14 }}>Your message</Label>
      <Text style={styles.hint}>
        {design === 'custom'
          ? 'Paste or type your own invitation. Each guest’s personal reply link is added at the end for you.'
          : 'This is the wording for the design you chose. Edit it, or paste your own. Each guest’s personal reply link is added at the end.'}
      </Text>
      <Field label="" value={text} onChangeText={set('invite')} multiline lines={9} style={{ marginTop: 8 }}
        placeholder={design === 'custom' ? 'Paste your invitation text here' : undefined} />
      {design !== 'custom' && ownText && (
        <Pressable onPress={() => { tap(); set('invite')(''); }} style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
          <Label style={{ color: C.ink }}>Use the {DESIGNS.find((d) => d.k === design).t} wording again</Label>
        </Pressable>
      )}
      <Label style={{ fontSize: 9.5 }}>What a guest receives</Label>
      <View style={styles.preview}>
        <Text style={styles.previewT}>
          {text.trim() ? compose(text, { name: 'Guest', link: guests[0]?.link || 'their personal reply link' }, wedding) : 'Nothing yet. Write your invitation above.'}
        </Text>
      </View>

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
  tiles: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tileWrap: { flex: 1, alignItems: 'center' },
  tile: { width: '100%', height: 74, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileOn: { borderWidth: 2.5 },
  tileMono: { fontFamily: F.serif, fontSize: 20 },
  tileName: { fontFamily: F.med, fontSize: 10, letterSpacing: 1.4, color: C.muted, marginTop: 8, textTransform: 'uppercase' },
  tick: { position: 'absolute', right: 6, top: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 6 },
  preview: { marginTop: 8, borderRadius: 14, backgroundColor: C.wash, padding: 14 },
  previewT: { fontFamily: F.reg, fontSize: 13.5, lineHeight: 20, color: C.ink },
  sectionHead: { marginTop: 28, marginBottom: 6 },
  none: { fontFamily: F.reg, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  gname: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  gsub: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
});
