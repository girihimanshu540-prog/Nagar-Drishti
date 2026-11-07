import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { Ticket } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { surface } from './ScreenState';

export const statusLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ');
export function StatusBadge({ status }: { status: string }) {
  const c = useColors();
  const color = status === 'VERIFIED_CLOSED' ? c.success : status === 'NEEDS_JE_REVIEW' ? c.warning :
    status === 'REOPENED' || status === 'REJECTED' ? c.destructive : c.primary;
  return <Text style={{ color, fontFamily: fonts.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{statusLabel(status)}</Text>;
}
export function TicketCard({ ticket }: { ticket: Ticket }) {
  const c = useColors();
  return <Pressable testID={`ticket-${ticket.id}`} accessibilityRole="button"
    accessibilityLabel={`${ticket.id}: ${ticket.title}, ${statusLabel(ticket.status)}`}
    onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: ticket.id } })}
    style={({ pressed }) => [surface(c), { opacity: pressed ? 0.7 : 1 }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 12 }}>{ticket.id}</Text>
      <StatusBadge status={ticket.status} />
    </View>
    <Text style={{ color: c.foreground, fontFamily: fonts.semibold, fontSize: 18 }}>{ticket.title}</Text>
    <Text numberOfLines={2} style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>{ticket.location} · {ticket.ward_name}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(n => <View key={n} style={{ width: 6, height: 14, borderRadius: 1, backgroundColor: n <= ticket.severity ? c.primary : c.border }} />)}
        </View>
        <Text style={{ fontFamily: fonts.mono, color: c.mutedForeground, fontSize: 10 }}>SEVERITY {ticket.severity}/5</Text>
      </View>
      <Feather name="arrow-up-right" color={c.foreground} size={18} />
    </View>
    {ticket.is_demo ? <Text style={{ color: c.warning, fontFamily: fonts.regular, fontSize: 11 }}>Synthetic demo evidence · no live repair submission</Text> : null}
  </Pressable>;
}
