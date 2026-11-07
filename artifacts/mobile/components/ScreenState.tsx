import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { errorMessage } from '@/lib/client';

export function Button({ title, onPress, busy = false, disabled = false, secondary = false, testID, icon }:
  { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; testID: string; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  const c = useColors();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title}
    disabled={disabled || busy} onPress={() => { void Haptics.selectionAsync().catch(() => {}); onPress(); }}
    style={({ pressed }) => [s.button, { borderRadius: c.radius, backgroundColor: secondary ? c.muted : c.primary,
      opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 }]}>
    {busy ? <ActivityIndicator color={c.foreground} /> : icon ? <Feather name={icon} size={18} color={secondary ? c.foreground : c.primaryForeground} /> : null}
    <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: secondary ? c.foreground : c.primaryForeground }}>{title}</Text>
  </Pressable>;
}
export function ScreenState({ title, message, loading, error, retry }:
  { title?: string; message?: string; loading?: boolean; error?: unknown; retry?: () => void }) {
  const c = useColors();
  return <View style={[s.state, { backgroundColor: c.background }]}>
    {loading ? <ActivityIndicator size="large" color={c.primary} /> :
      <Feather name={error ? 'alert-circle' : 'inbox'} size={30} color={error ? c.destructive : c.primary} />}
    <Text style={{ fontFamily: fonts.heading, color: c.foreground, fontSize: 22, textAlign: 'center' }}>{title || (loading ? 'Loading…' : error ? 'Couldn’t load this' : 'Nothing here yet')}</Text>
    {(message || error) ? <Text accessibilityLiveRegion="polite" style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 22, textAlign: 'center' }}>{message || errorMessage(error)}</Text> : null}
    {retry ? <Button title="Try again" testID="state-retry" onPress={retry} secondary /> : null}
  </View>;
}
export function Header({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const c = useColors(); const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 20, paddingHorizontal: 22, paddingBottom: 24, gap: 9 }}>
    <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5 }}>{eyebrow.toUpperCase()}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 32, flex: 1 }}>{title}</Text>{action}
    </View>
    {subtitle ? <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 21 }}>{subtitle}</Text> : null}
  </View>;
}
export function Notice({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  const c = useColors();
  return <View style={{ backgroundColor: c.muted, padding: 14, borderLeftWidth: 3, borderColor: danger ? c.destructive : c.primary, borderRadius: c.radius }}>
    <Text accessibilityLiveRegion="polite" style={{ color: c.foreground, fontFamily: fonts.regular, lineHeight: 21 }}>{children}</Text>
  </View>;
}
export function useBottomSpace(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 50 : insets.bottom + 24;
}
export const surface = (c: ReturnType<typeof useColors>): ViewStyle => ({
  backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: c.radius, padding: 18, gap: 10,
});
const s = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  state: { flex: 1, minHeight: 230, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 18 },
});
