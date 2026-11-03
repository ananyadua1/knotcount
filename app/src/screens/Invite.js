import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C, F, shadow } from '../theme';
import { Label, Heading, Btn, Field, Chip, tap } from '../components/ui';
import InviteCard, { PALETTES, SWATCHES, themeOf, isHex } from '../components/InviteCard';
import { useStore, MESSAGES, inviteText, msgStyleOf, wordingOf, compose } from '../store';
import { sendChat } from '../send';

export default function Invite() {
  const { wedding, setWedding, guests, updateGuest } = useStore();
  const set = (k) => (v) => setWedding((w) => ({ ...w, [k]: v }));
  const design = wedding.template || 'classic';
  const style = msgStyleOf(wedding);
  const text = inviteText(wedding);
  const todo = guests.filter((g) => !g.invited);
  const sent = guests.filter((g) => g.invited);

  // the colour box keeps what is being typed; it only becomes the card colour once it is a full #rrggbb
  const [hex, setHex] = useState(wedding.color || '');
  useEffect(() => { if (isHex(wedding.color)) setHex(wedding.color); }, [wedding.color]);
  const pickColor = (c) => { setHex(c); setWedding((w) => ({ ...w, template: 'custom', color: c })); };
  const typeHex = (v) => {
    const s = v.startsWith('#') ? v : `#${v}`;
    setHex(s.slice(0, 7));
    if (isHex(s)) setWedding((w) => ({ ...w, template: 'custom', color: s.toLowerCase() }));
  };

  // "My own" starts from the wording you were looking at, so you can tweak it or paste over it
  const pickMessage = (k) => setWedding((w) => {
    if (k !== 'custom') return { ...w, msgStyle: k };
    const cur = msgStyleOf(w);
    return { ...w, msgStyle: 'custom', invite: cur === 'custom' ? w.invite : wordingOf(cur, w) };
  });

  const send = async (g) => {
    if (!text.trim()) { Alert.alert('Write your invitation first', 'Paste or type the text you want to send in the box above.'); return; }
    const ok = await sendChat(g, compose(text, g, wedding));
    if (ok) updateGuest(g.id, { invited: true });
  };

  const customOn = design === 'custom';
  const customBg = isHex(wedding.color) ? wedding.color : '#1F3A5F';

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Label style={{ marginTop: 26 }}>Invitation</Label>
      <Heading size={28} style={{ marginTop: 6 }}>Design your{'\n'}invitation</Heading>

      <Label style={{ marginTop: 24 }}>1 · Wedding details</Label>
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

      <Label style={{ marginTop: 12 }}>2 · Choose a design</Label>
      <Text style={styles.hint}>Same card and fonts, your choice of colours.</Text>
      <View style={styles.tiles}>
        {PALETTES.map((p) => {
          const on = design === p.k;
          return (
            <Pressable key={p.k} onPress={() => { tap(); set('template')(p.k); }} style={styles.tileWrap}>
              <View style={[styles.tile, { backgroundColor: p.bg, borderColor: on ? C.ink : p.line }, on && styles.tileOn]}>
                <Text style={[styles.tileMono, { color: p.acc }]}>{(wedding.bride || 'A')[0]}&{(wedding.groom || 'R')[0]}</Text>
                {on && <View style={styles.tick}><Feather name="check" size={11} color={C.card} /></View>}
              </View>
              <Text style={[styles.tileName, on && styles.tileNameOn]}>{p.t}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => { tap(); pickColor(customBg); }} style={styles.tileWrap}>
          <View style={[styles.tile, { backgroundColor: customOn ? customBg : C.paper, borderColor: customOn ? C.ink : C.muted, borderStyle: customOn ? 'solid' : 'dashed' }, customOn && styles.tileOn]}>
            <Feather name="droplet" size={20} color={customOn ? themeOf(wedding).ink : C.ink} />
            {customOn && <View style={styles.tick}><Feather name="check" size={11} color={C.card} /></View>}
          </View>
          <Text style={[styles.tileName, customOn && styles.tileNameOn]}>My colour</Text>
        </Pressable>
      </View>

      {customOn && (
        <View style={styles.colors}>
          <View style={styles.swatches}>
            {SWATCHES.map((c) => (
              <Pressable key={c} onPress={() => { tap(); pickColor(c); }} style={[styles.swatch, { backgroundColor: c }, hex.toLowerCase() === c.toLowerCase() && styles.swatchOn]} />
            ))}
          </View>
          <Field label="Or type a colour code" value={hex} onChangeText={typeHex} autoCapitalize="none" autoCorrect={false} maxLength={7}
            placeholder="#1F3A5F" style={{ marginTop: 14, marginBottom: 0 }} />
        </View>
      )}

      <View style={[{ marginTop: 18 }, shadow]}>
        <InviteCard w={wedding} />
      </View>

      <Label style={{ marginTop: 32 }}>3 · Choose a message</Label>
      <Text style={styles.hint}>This is the text that goes with the card on WhatsApp. Each guest’s own reply link is added at the end.</Text>
      <View style={styles.chips}>
        {MESSAGES.map((m) => <Chip key={m.k} title={m.t} active={style === m.k} onPress={() => pickMessage(m.k)} />)}
      </View>

      {style === 'custom' ? (
        <>
          <Field label="" value={text} onChangeText={set('invite')} multiline lines={9} style={{ marginTop: 14 }}
            placeholder="Paste your invitation text here" />
        </>
      ) : null}

      <Label style={{ fontSize: 9.5, marginTop: style === 'custom' ? 0 : 16 }}>What a guest receives</Label>
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
  tiles: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tileWrap: { flex: 1, alignItems: 'center' },
  tile: { width: '100%', height: 70, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileOn: { borderWidth: 2.5 },
  tileMono: { fontFamily: F.serif, fontSize: 19 },
  tileName: { fontFamily: F.med, fontSize: 9.5, letterSpacing: 1.2, color: C.muted, marginTop: 8, textTransform: 'uppercase' },
  tileNameOn: { color: C.ink, fontFamily: F.heavy },
  tick: { position: 'absolute', right: 5, top: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  colors: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 14 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.line },
  swatchOn: { borderWidth: 3, borderColor: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 8 },
  hint: { fontFamily: F.reg, fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 6 },
  preview: { marginTop: 8, borderRadius: 14, backgroundColor: C.wash, padding: 14 },
  previewT: { fontFamily: F.reg, fontSize: 13.5, lineHeight: 20, color: C.ink },
  sectionHead: { marginTop: 28, marginBottom: 6 },
  none: { fontFamily: F.reg, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  gname: { fontFamily: F.semi, fontSize: 15, color: C.ink },
  gsub: { fontFamily: F.reg, fontSize: 12, color: C.muted, marginTop: 2 },
});
