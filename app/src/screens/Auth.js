import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { C, F } from '../theme';
import { Btn, Field, Label, Heading } from '../components/ui';
import { useStore } from '../store';
import { getBase, setServer } from '../api';

export default function Auth() {
  const { login, register } = useStore();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [srv, setSrv] = useState(getBase());
  const [showSrv, setShowSrv] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr(''); setBusy(true);
    try {
      await setServer(srv);
      if (mode === 'login') await login(email.trim(), pw); else await register(name.trim(), email.trim(), pw);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ padding: 26, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/mark.png')} style={{ width: 54, height: 54 }} />
        <Label style={{ marginTop: 26 }}>KnotCount</Label>
        <Heading style={{ marginTop: 8 }}>{mode === 'login' ? 'Welcome\nback.' : 'Start your\nguest list.'}</Heading>
        <Text style={styles.lede}>
          {mode === 'login' ? 'Sign in to see who has replied.' : 'One account per wedding. Guests reply from a link, no app needed.'}
        </Text>
        <View style={{ height: 26 }} />
        {mode === 'register' && <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder={mode === 'register' ? 'At least 8 characters' : ''} />
        {!!err && <Text style={styles.err}>{err}</Text>}
        <Btn title={busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={go} disabled={busy || !email || !pw} style={{ marginTop: 6 }} />
        <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }} style={{ alignSelf: 'center', padding: 18 }}>
          <Text style={styles.switch}>{mode === 'login' ? 'NEW HERE? CREATE AN ACCOUNT' : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}</Text>
        </Pressable>
        <Pressable onPress={() => setShowSrv((s) => !s)} style={{ alignSelf: 'center', padding: 8 }}>
          <Label>Server</Label>
        </Pressable>
        {showSrv && <Field label="Server address" value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} style={{ marginTop: 6 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: F.reg, fontSize: 14.5, color: C.soft, lineHeight: 21, marginTop: 14 },
  err: { fontFamily: F.med, color: C.sindoor, marginBottom: 12, lineHeight: 19 },
  switch: { fontFamily: F.semi, fontSize: 10.5, letterSpacing: 1.8, color: C.ink },
});
