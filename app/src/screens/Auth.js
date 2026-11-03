import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, KeyboardAvoidingView, Platform, Pressable, Linking } from 'react-native';
import { C, F } from '../theme';
import { Btn, Field, Label, Heading } from '../components/ui';
import { useStore } from '../store';
import { getBase, setServer, PRIVACY_URL } from '../api';

const COPY = {
  login: { h: 'Welcome\nback.', lede: 'Sign in to see who has replied.' },
  register: { h: 'Start your\nguest list.', lede: 'One account per wedding. Guests reply from a link, no app needed.' },
  forgot: { h: 'Forgot your\npassword?', lede: 'Enter the email you signed up with and we’ll send you a 6-digit code.' },
  reset: { h: 'Check your\nemail.', lede: 'Type the 6-digit code we sent, then choose a new password.' },
  verify: { h: 'Confirm your\nemail.', lede: 'We sent a 6-digit code to your email. Type it below to finish.' },
};

export default function Auth() {
  const { login, register, verifyEmail, resendVerification, forgotPassword, resetPassword } = useStore();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [srv, setSrv] = useState(getBase());
  const [showSrv, setShowSrv] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const to = (m) => { setMode(m); setErr(''); setInfo(''); setPw(''); setCode(''); };
  const run = async (fn) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e) {
      if (e.data && e.data.needsVerify) { setMode('verify'); setPw(''); setCode(''); setInfo(e.message); } // signing in before confirming the email
      else setErr(e.message);
    }
    setBusy(false);
  };

  const submit = () => run(async () => {
    if (__DEV__) await setServer(srv);
    const mail = email.trim();
    if (mode === 'login') await login(mail, pw);
    else if (mode === 'register') {
      const r = await register(name.trim(), mail, pw);
      if (r && r.needsVerify) { setMode('verify'); setPw(''); setCode(''); setInfo(`We sent a code to ${mail}. It works for 15 minutes.`); }
    } else if (mode === 'verify') await verifyEmail(mail, code.trim());
    else if (mode === 'forgot') {
      await forgotPassword(mail);
      setMode('reset'); setPw(''); setCode('');
      setInfo(`If ${mail} has an account, a code is on its way. It works for 15 minutes.`);
    } else await resetPassword(mail, code.trim(), pw);
  });
  const resend = () => run(async () => {
    if (mode === 'verify') await resendVerification(email.trim()); else await forgotPassword(email.trim());
    setInfo('Sent again. If nothing arrives in a minute, check your spam folder.');
  });

  const ready = !!email && (mode === 'forgot' || (mode === 'verify' ? code.length >= 6 : mode === 'reset' ? code.length >= 6 && pw : pw));
  const title = { login: 'Sign in', register: 'Create account', forgot: 'Send code', reset: 'Reset password', verify: 'Confirm email' }[mode];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ padding: 26, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/mark.png')} style={{ width: 54, height: 54 }} />
        <Label style={{ marginTop: 26 }}>KnotCount</Label>
        <Heading style={{ marginTop: 8 }}>{COPY[mode].h}</Heading>
        <Text style={styles.lede}>{COPY[mode].lede}</Text>
        <View style={{ height: 26 }} />

        {mode === 'register' && <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={mode !== 'reset' && mode !== 'verify'} />
        {(mode === 'reset' || mode === 'verify') && (
          <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" />
        )}
        {mode !== 'forgot' && mode !== 'verify' && (
          <>
            <Field
              label={mode === 'reset' ? 'New password' : 'Password'} value={pw} onChangeText={setPw}
              secureTextEntry={!showPw} autoCapitalize="none" autoCorrect={false}
              placeholder={mode === 'login' ? '' : 'At least 8 characters'} style={{ marginBottom: 6 }}
            />
            <View style={styles.pwRow}>
              <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8}><Label>{showPw ? 'Hide password' : 'Show password'}</Label></Pressable>
              {mode === 'login' && <Pressable onPress={() => to('forgot')} hitSlop={8}><Label style={{ color: C.ink }}>Forgot password?</Label></Pressable>}
            </View>
          </>
        )}

        {!!info && <Text style={styles.info}>{info}</Text>}
        {!!err && <Text style={styles.err}>{err}</Text>}
        <Btn title={busy ? 'One moment…' : title} onPress={submit} disabled={busy || !ready} style={{ marginTop: 6 }} />

        {(mode === 'reset' || mode === 'verify') && (
          <Pressable onPress={resend} disabled={busy} style={{ alignSelf: 'center', padding: 16 }}>
            <Text style={styles.switch}>SEND THE CODE AGAIN</Text>
          </Pressable>
        )}
        {(mode === 'login' || mode === 'register') ? (
          <Pressable onPress={() => to(mode === 'login' ? 'register' : 'login')} style={{ alignSelf: 'center', padding: 18 }}>
            <Text style={styles.switch}>{mode === 'login' ? 'NEW HERE? CREATE AN ACCOUNT' : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => to('login')} style={{ alignSelf: 'center', padding: 18 }}>
            <Text style={styles.switch}>BACK TO SIGN IN</Text>
          </Pressable>
        )}
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL())} style={{ alignSelf: 'center', padding: 8 }}>
          <Label>Privacy policy</Label>
        </Pressable>
        {__DEV__ && <Pressable onPress={() => setShowSrv((s) => !s)} style={{ alignSelf: 'center', padding: 8 }}>
          <Label>Server</Label>
        </Pressable>}
        {__DEV__ && showSrv && <Field label="Server address" value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} style={{ marginTop: 6 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: F.reg, fontSize: 14.5, color: C.soft, lineHeight: 21, marginTop: 14 },
  err: { fontFamily: F.med, color: C.sindoor, marginBottom: 12, lineHeight: 19 },
  info: { fontFamily: F.med, color: C.leaf, marginBottom: 12, lineHeight: 19 },
  pwRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  switch: { fontFamily: F.semi, fontSize: 10.5, letterSpacing: 1.8, color: C.ink },
});
