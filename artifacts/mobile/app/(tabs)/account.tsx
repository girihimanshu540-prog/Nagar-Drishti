import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/providers/AuthProvider';
import { apiOrigin } from '@/lib/config';
import { Button, Header, Notice, surface, useBottomSpace } from '@/components/ScreenState';
import { fonts } from '@/constants/theme';

export default function AccountScreen() {
  const c = useColors(); const auth = useAuth(); const bottom = useBottomSpace();
  const [error, setError] = useState<string | null>(null);
  return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ paddingBottom: bottom }}>
    <Header eyebrow="NagarDrishti / field companion" title="Your account" subtitle="The same identity. The same municipal record." />
    <View style={{ paddingHorizontal: 22, gap: 20 }}>
      <View style={surface(c)}>
        <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 24 }}>{auth.user?.name}</Text>
        <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>{auth.user?.email}</Text>
        <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 12, textTransform: 'uppercase' }}>{auth.user?.role}</Text>
      </View>
      <Notice>Only live camera captures are accepted. Enable camera and foreground location permissions when prompted. GPS accuracy must be 50 m or better; repair evidence must be within 15 m of the ticket.</Notice>
      <View style={surface(c)}>
        <Text style={{ color: c.foreground, fontFamily: fonts.semibold }}>Connected API</Text>
        <Text selectable style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 12 }}>{apiOrigin}</Text>
        <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 21 }}>Changes are saved to the existing FastAPI service. Tickets refresh every 15 seconds while the app is active. Staff review and assignment remain on the web.</Text>
      </View>
      {error ? <Notice danger>{error}</Notice> : null}
      <Button title="Open web dashboard" testID="open-web" secondary icon="external-link"
        onPress={() => { void Linking.openURL(apiOrigin).catch(() => setError('Could not open the browser.')); }} />
      <Button title="Sign out" testID="sign-out" icon="log-out" onPress={() => void auth.signOut()} />
    </View>
  </ScrollView>;
}
