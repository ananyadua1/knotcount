import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { C, F } from './src/theme';
import { StoreProvider, useStore, couple } from './src/store';
import { tap } from './src/components/ui';
import Guests from './src/screens/Guests';
import Invite from './src/screens/Invite';
import Auth from './src/screens/Auth';
import Updates from './src/screens/Updates';
import Profile from './src/screens/Profile';

const TABS = [
  { k: 'guests', t: 'Guests', icon: 'users' },
  { k: 'invite', t: 'Invitations', icon: 'mail' },
  { k: 'updates', t: 'Activity', icon: 'activity' },
  { k: 'profile', t: 'Profile', icon: 'user' },
];

function Shell() {
  const [tab, setTab] = useState('guests');
  const ins = useSafeAreaInsets();
  const { booting, authed, loaded, error, wedding, saveStatus, retrySave, refresh } = useStore();
  const idx = TABS.findIndex((t) => t.k === tab);
  if (booting) return <View style={{ flex: 1, backgroundColor: C.paper, justifyContent: 'center' }}><ActivityIndicator color={C.ink} accessibilityLabel="Loading KnotCount" /></View>;
  if (!authed) return <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: ins.top }}><Auth /></View>;
  const Screen = { guests: Guests, invite: Invite, updates: Updates, profile: Profile }[tab];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: ins.top }}>
      <View style={styles.top}>
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('./assets/mark.png')} style={{ width: 22, height: 22, marginRight: 8 }} />
            <Text style={styles.brand}>KnotCount</Text>
          </View>
          <Pressable onPress={() => setTab('profile')} hitSlop={10} style={styles.wedPill}>
            <Text numberOfLines={1} style={styles.wedT}>{wedding.bride || wedding.groom ? couple(wedding) : 'New wedding'}</Text>
            <Feather name="chevron-down" size={14} color={C.muted} />
          </Pressable>
        </View>

      </View>
      {saveStatus !== 'saved' && <Pressable accessibilityRole="button" onPress={() => retrySave().catch(e => Alert.alert('Could not save', e.message))} style={styles.saveBar}>
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.med, color: saveStatus === 'error' ? C.sindoor : C.soft }}>{saveStatus === 'error' ? 'Changes not saved. Tap to retry.' : saveStatus === 'saving' ? 'Saving changes…' : 'Unsaved changes'}</Text>
      </Pressable>}
      {!!error && <View style={styles.banner}><Text style={styles.bannerT}>{error}</Text></View>}
      <View style={{ flex: 1 }}>{!loaded ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        {error ? <Pressable accessibilityRole="button" onPress={refresh}><Text style={{ color: C.sindoor, fontFamily: F.semi }}>Try again</Text></Pressable> : <ActivityIndicator color={C.ink} />}
        <Text style={{ color: C.soft }}>Loading your wedding…</Text>
      </View> : <Screen go={setTab} />}</View>
      <View style={[styles.bar, { paddingBottom: Math.max(ins.bottom, 10) }]}>
        {TABS.map((t) => {
          const on = t.k === tab;
          return (
            <Pressable accessibilityRole="tab" accessibilityLabel={t.t} accessibilityState={{ selected: on }} key={t.k} style={styles.tab} onPress={() => { tap(); setTab(t.k); }}>
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
  const [ok, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_800ExtraBold, Fraunces_400Regular_Italic });
  if (!ok && !fontError) return <View style={{ flex: 1, backgroundColor: C.paper, justifyContent: 'center' }}><ActivityIndicator color={C.ink} /></View>;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider><Shell /></StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  saveBar: { paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.wash },
  top: { paddingHorizontal: 22, paddingTop: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 2.4, color: C.ink, textTransform: 'uppercase' },
  wedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 190 },
  wedT: { fontFamily: F.med, fontSize: 11, color: C.soft, flexShrink: 1 },
  topLabel: { fontFamily: F.med, fontSize: 10.5, letterSpacing: 2.2, color: C.muted, textTransform: 'uppercase' },
  track: { height: 1.5, backgroundColor: C.line },
  fill: { height: 1.5, backgroundColor: C.ink },
  bar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabT: { fontFamily: F.med, fontSize: 11, letterSpacing: 0, color: C.muted },
  banner: { backgroundColor: C.ink, paddingVertical: 7, paddingHorizontal: 22 },
  bannerT: { fontFamily: F.med, fontSize: 11.5, color: C.card },
  pip: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.sindoor, marginTop: 1 },
});
