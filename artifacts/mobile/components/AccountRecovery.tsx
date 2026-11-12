import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useConfirmPasswordReset, useConfirmVerification, useRequestPasswordReset, useRequestVerification } from '@workspace/api-client-react';
import { Button, Notice } from '@/components/ScreenState';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/lib/client';

export function AccountRecovery() {
  const c = useColors();
  const auth = useAuth();
  const [purpose, setPurpose] = useState<'verify' | 'reset' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const verification = useRequestVerification();
  const recovery = useRequestPasswordReset();
  const verify = useConfirmVerification();
  const reset = useConfirmPasswordReset();
  const submit = async () => {
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try {
      if (confirm && (!/^[A-Za-z0-9_-]{43}$/.test(token.trim()) || password.length < 10)) throw new Error('Enter your full email code and a password of 10–72 bytes.');
      const result = confirm
        ? await (purpose === 'verify' ? verify : reset).mutateAsync({ data: { token: token.trim(), password } })
        : await (purpose === 'verify' ? verification : recovery).mutateAsync({ data: { email: email.trim() } });
      if (confirm) {
        await auth.signOut();
        setToken(''); setPassword(''); setConfirm(false);
      }
      setMessage(result.message);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const input = { minHeight: 54, borderWidth: 1, paddingHorizontal: 15, fontFamily: fonts.regular, fontSize: 16,
    backgroundColor: c.card, borderColor: c.input, color: c.foreground, borderRadius: c.radius };
  return <View style={{ gap: 12 }}>
    {(['reset', 'verify'] as const).map(p => <Button key={p} title={p === 'reset' ? 'Reset your password' : 'Verify your email'} secondary
      testID={`recovery-open-${p}`} disabled={busy} onPress={() => { setPurpose(p); setConfirm(false); setMessage(''); setError(''); setToken(''); setPassword(''); }} />)}
    {purpose ? <View style={{ gap: 12 }}>
      <Text style={{ color: c.foreground, fontFamily: fonts.semibold, fontSize: 18 }}>{purpose === 'verify' ? 'Verify your email' : 'Reset your password'}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 22 }}>Request an email and copy its code here. Codes expire after 30 minutes. Choose a password of 10–72 bytes. Completing this signs out all existing sessions.</Text>
      {confirm ? <>
        <TextInput testID="recovery-token" accessibilityLabel="Email code" style={input} value={token} onChangeText={setToken}
          autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={43} editable={!busy} placeholder="Email code" placeholderTextColor={c.mutedForeground} />
        <TextInput testID="recovery-password" accessibilityLabel="New password" style={input} value={password} onChangeText={setPassword}
          secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={72} editable={!busy} placeholder="New password" placeholderTextColor={c.mutedForeground} />
      </> : <TextInput testID="recovery-email" accessibilityLabel="Account email" style={input} value={email} onChangeText={setEmail}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} placeholder="Email address" placeholderTextColor={c.mutedForeground} />}
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice danger>{error}</Notice> : null}
      <Button title={confirm ? 'Set password and verify' : 'Request email'} testID="recovery-submit" busy={busy} onPress={() => void submit()} />
      <Button title={confirm ? 'Request a new email' : 'I have an email code'} testID="recovery-toggle-code" secondary disabled={busy}
        onPress={() => { setConfirm(!confirm); setMessage(''); setError(''); setToken(''); setPassword(''); }} />
      <Button title="Close" testID="recovery-close" secondary disabled={busy}
        onPress={() => { setPurpose(null); setPassword(''); setToken(''); }} />
    </View> : null}
  </View>;
}
