import { useState } from 'react';
import { Image, Keyboard, Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useLogin } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Button, Notice, useBottomSpace } from '@/components/ScreenState';
import { fonts } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/lib/client';
import { privacyUrl } from '@/lib/config';

export default function LoginScreen() {
  const c = useColors(); const insets = useSafeAreaInsets(); const bottom = useBottomSpace();
  const auth = useAuth(); const mutation = useLogin();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    Keyboard.dismiss(); setError(null); setBusy(true);
    try {
      const result = await mutation.mutateAsync({ data: { email: email.trim().toLowerCase(), password } });
      await auth.acceptSession(result);
      setPassword(''); router.replace('/(tabs)');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
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
    <View style={{ gap: 9 }}>
      <Text style={[s.label, { color: c.foreground }]}>EMAIL ADDRESS</Text>
      <TextInput testID="login-email" accessibilityLabel="Email address" value={email} onChangeText={setEmail} editable={!busy}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username"
        placeholder="you@example.com" placeholderTextColor={c.mutedForeground}
        style={[s.input, { backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius }]} />
    </View>
    <View style={{ gap: 9 }}>
      <Text style={[s.label, { color: c.foreground }]}>PASSWORD</Text>
      <TextInput testID="login-password" accessibilityLabel="Password" value={password} onChangeText={setPassword} editable={!busy}
        secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => { if (!busy) void submit(); }}
        placeholder="Your password" placeholderTextColor={c.mutedForeground}
        style={[s.input, { backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius }]} />
    </View>
    {error ? <Notice danger>{error}</Notice> : null}
    <Button title="Sign in" icon="arrow-right" testID="login-submit" busy={busy} onPress={() => void submit()} />
    <View style={{ gap: 12, borderTopWidth: 1, borderColor: c.border, paddingTop: 20 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 }}>Not an official municipal service. Reports are unverified until staff review them; repairs close only after a junior engineer approves. No AI detection is used. New citizens can register on the web app.</Text>
      {privacyUrl ? <Button title="Privacy notice" icon="shield" secondary testID="login-privacy"
        onPress={() => { void Linking.openURL(privacyUrl).catch(() => setError('Could not open the privacy notice.')); }} /> : null}
    </View>
  </KeyboardAwareScrollViewCompat>;
}
const s = StyleSheet.create({
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 },
  input: { minHeight: 54, borderWidth: 1, paddingHorizontal: 15, fontFamily: fonts.regular, fontSize: 16 },
});
