import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { C, F } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { tap } from './src/components/ui';
import Guests from './src/screens/Guests';
import Invite from './src/screens/Invite';
import Auth from './src/screens/Auth';
import Updates from './src/screens/Updates';

const TABS = [
  { k: 'guests', t: 'Guests', icon: 'users' },
  { k: 'invite', t: 'Invite', icon: 'mail' },
  { k: 'updates', t: 'Updates', icon: 'activity' },
];

function Shell() {
  const [tab, setTab] = useState('guests');
  const ins = useSafeAreaInsets();
  const { booting, authed, logout, error, loaded } = useStore();
  const idx = TABS.findIndex((t) => t.k === tab);
  if (booting) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  if (!authed) return <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: ins.top }}><Auth /></View>;
  const Screen = { guests: Guests, invite: Invite, updates: Updates }[tab];
  const signOut = () => Alert.alert('Sign out?', 'Your guest list stays safe on the server.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: logout }]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: ins.top }}>
      <View style={styles.top}>
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('./assets/mark.png')} style={{ width: 22, height: 22, marginRight: 8 }} />
            <Text style={styles.brand}>KnotCount</Text>
          </View>
          <Pressable onPress={signOut} hitSlop={10}><Feather name="log-out" size={17} color={C.muted} /></Pressable>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${((idx + 1) / TABS.length) * 100}%` }]} /></View>
      </View>
      {!!error && <View style={styles.banner}><Text style={styles.bannerT}>{error}</Text></View>}
      <View style={{ flex: 1 }}><Screen go={setTab} /></View>
      <View style={[styles.bar, { paddingBottom: Math.max(ins.bottom, 10) }]}>
        {TABS.map((t) => {
          const on = t.k === tab;
          return (
            <Pressable key={t.k} style={styles.tab} onPress={() => { tap(); setTab(t.k); }}>
              <Feather name={t.icon} size={21} color={on ? C.ink : C.muted} />
              <Text style={[styles.tabT, on && { color: C.ink, fontFamily: F.heavy }]}>{t.t}</Text>
              {on && <View style={styles.pip} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [ok] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_800ExtraBold, Fraunces_400Regular_Italic });
  if (!ok) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider><Shell /></StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 22, paddingTop: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 2.4, color: C.ink, textTransform: 'uppercase' },
  topLabel: { fontFamily: F.med, fontSize: 10.5, letterSpacing: 2.2, color: C.muted, textTransform: 'uppercase' },
  track: { height: 1.5, backgroundColor: C.line },
  fill: { height: 1.5, backgroundColor: C.ink },
  bar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabT: { fontFamily: F.med, fontSize: 9.5, letterSpacing: 1.4, color: C.muted, textTransform: 'uppercase' },
  banner: { backgroundColor: C.ink, paddingVertical: 7, paddingHorizontal: 22 },
  bannerT: { fontFamily: F.med, fontSize: 11.5, color: C.card },
  pip: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.sindoor, marginTop: 1 },
});
