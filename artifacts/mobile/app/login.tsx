import { useState } from 'react';
import { Image, Keyboard, Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { registerAndSignInCitizen, useLogin, useRegister } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Notice, useBottomSpace } from '@/components/ScreenState';
import { fonts } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/lib/client';
import { privacyUrl } from '@/lib/config';
import { AccountRecovery } from '@/components/AccountRecovery';

export default function LoginScreen() {
  const c = useColors(); const insets = useSafeAreaInsets(); const bottom = useBottomSpace();
  const auth = useAuth(); const mutation = useLogin();
  const register = useRegister();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password || (mode === 'register' && name.trim().length < 2)) { setError(mode === 'register' ? 'Enter your name, email and password.' : 'Enter your email and password.'); return; }
    Keyboard.dismiss(); setError(null); setBusy(true);
    try {
      const credentials = { email: email.trim().toLowerCase(), password };
      if (mode === 'register') {
        await registerAndSignInCitizen({
          credentials: { ...credentials, name: name.trim() },
          register: data => register.mutateAsync({ data }),
          login: data => mutation.mutateAsync({ data }),
          acceptSession: auth.acceptSession,
        });
      } else {
        const result = await mutation.mutateAsync({ data: credentials });
        await auth.acceptSession(result);
      }
      setPassword(''); router.replace('/(tabs)');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const waiting = busy || mutation.isPending || register.isPending;
  return <KeyboardAwareScrollViewCompat style={{ flex: 1, backgroundColor: c.background }}
    contentContainerStyle={{ paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 26, paddingHorizontal: 24, paddingBottom: bottom, gap: 22 }}
    keyboardShouldPersistTaps="handled" bottomOffset={60}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Image source={require('@/assets/images/icon.png')} style={{ width: 46, height: 46, borderRadius: 10 }} />
      <View><Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 24 }}>NagarDrishti</Text>
        <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2 }}>FIELD COMPANION</Text></View>
    </View>
    <View style={{ paddingVertical: 18, gap: 14 }}>
      <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 44, lineHeight: 47 }}>Report it.{'\n'}Track the repair.</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 }}>Report a road hazard with a live photo.{'\n'}Engineers review every repair.</Text>
    </View>
    {auth.notice ? <Notice>{auth.notice}</Notice> : null}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button title="Sign in" secondary testID="button-mode-login" disabled={waiting} onPress={() => { setMode('login'); setError(null); }} />
      <Button title="Create citizen account" secondary testID="button-mode-register" disabled={waiting} onPress={() => { setMode('register'); setError(null); }} />
    </View>
    {mode === 'register' ? <>
      <View style={{ gap: 9 }}>
        <Text style={[s.label, { color: c.foreground }]}>FULL NAME</Text>
        <TextInput testID="signup-name" accessibilityLabel="Full name" value={name} onChangeText={setName} editable={!waiting}
          autoCapitalize="words" autoComplete="name" textContentType="name" placeholder="Your name" placeholderTextColor={c.mutedForeground}
          style={[s.input, { backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius }]} />
      </View>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 13 }}>Public signup creates citizen accounts only. Use a password of 10–72 bytes. Your account is active immediately.</Text>
    </> : null}
    <View style={{ gap: 9 }}>
      <Text style={[s.label, { color: c.foreground }]}>EMAIL ADDRESS</Text>
      <TextInput testID="login-email" accessibilityLabel="Email address" value={email} onChangeText={setEmail} editable={!waiting}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username"
        placeholder="you@example.com" placeholderTextColor={c.mutedForeground}
        style={[s.input, { backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius }]} />
    </View>
    <View style={{ gap: 9 }}>
      <Text style={[s.label, { color: c.foreground }]}>PASSWORD</Text>
      <TextInput testID="login-password" accessibilityLabel="Password" value={password} onChangeText={setPassword} editable={!waiting}
        secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        textContentType={mode === 'login' ? 'password' : 'newPassword'} returnKeyType="go" onSubmitEditing={() => { if (!waiting) void submit(); }}
        placeholder="Your password" placeholderTextColor={c.mutedForeground}
        style={[s.input, { backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius }]} />
    </View>
    {error ? <Notice danger>{error}</Notice> : null}
    <Button title={mode === 'login' ? 'Sign in' : 'Create account and sign in'} icon="arrow-right" testID="login-submit" busy={waiting} onPress={() => void submit()} />
    <AccountRecovery />
    <View style={{ gap: 12, borderTopWidth: 1, borderColor: c.border, paddingTop: 20 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 }}>Not an official municipal service. Reports are unverified until staff review them; repairs close only after a junior engineer approves. No AI detection is used.</Text>
      {privacyUrl ? <Button title="Privacy notice" icon="shield" secondary testID="login-privacy"
        onPress={() => { void Linking.openURL(privacyUrl).catch(() => setError('Could not open the privacy notice.')); }} /> : null}
    </View>
  </KeyboardAwareScrollViewCompat>;
}
const s = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 },
  input: { minHeight: 54, borderWidth: 1, paddingHorizontal: 15, fontFamily: fonts.regular, fontSize: 16 },
});
