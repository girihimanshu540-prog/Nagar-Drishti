import { useState } from 'react';
import { Image, Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGetTicket } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/providers/AuthProvider';
import { fonts } from '@/constants/theme';
import { evidenceUrl } from '@/lib/config';
import { Button, Notice, ScreenState, surface, useBottomSpace } from '@/components/ScreenState';
import { StatusBadge, statusLabel } from '@/components/TicketCard';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const c = useColors(); const bottom = useBottomSpace(); const { user } = useAuth();
  const [linkError, setLinkError] = useState<string | null>(null);
  const query = useGetTicket(id, { query: { enabled: !!id && !!user, refetchInterval: 15_000, retry: false } });
  if (query.isPending) return <ScreenState loading title="Loading ticket" />;
  if (query.isError || !query.data) return <ScreenState error={query.error || new Error('Ticket not found.')} retry={() => void query.refetch()} />;
  const ticket = query.data;
  const canRepair = user?.role === 'contractor' && ticket.assigned_contractor_id === user.id &&
    ['ASSIGNED', 'REOPENED'].includes(ticket.status) && !ticket.is_demo;
  const navigate = () => {
    const destination = `${ticket.lat},${ticket.lng}`;
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?daddr=${destination}` : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    void Linking.openURL(url).catch(() => setLinkError('Could not open maps on this device.'));
  };
  return <ScrollView testID="ticket-detail" style={{ flex: 1, backgroundColor: c.background }}
    refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} />}
    contentContainerStyle={{ padding: 22, paddingTop: Platform.OS === 'web' ? 67 : 22, paddingBottom: bottom, gap: 20 }}>
    <StatusBadge status={ticket.status} />
    <View style={{ gap: 9 }}>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono }}>{ticket.id}</Text>
      <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 32 }}>{ticket.title}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 22 }}>{ticket.location} · {ticket.ward_name}</Text>
    </View>
    {ticket.is_demo ? <Notice>Synthetic demonstration ticket. Photos and verification scores are illustrative, not real field measurements. Live repair submission is disabled.</Notice> : null}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={[surface(c), { flex: 1 }]}><Text style={{ color: c.primary, fontFamily: fonts.heading, fontSize: 28 }}>{ticket.severity}<Text style={{ color: c.mutedForeground, fontSize: 14 }}>/5</Text></Text><Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 10 }}>SEVERITY</Text></View>
      <View style={[surface(c), { flex: 1 }]}><Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 28 }}>{ticket.report_count}</Text><Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 10 }}>REPORTS</Text></View>
    </View>
    <EvidenceImage label="ORIGINAL HAZARD" path={ticket.before_image_url} />
    <View style={surface(c)}>
      <Text style={{ color: c.foreground, fontFamily: fonts.semibold }}>Location & assignment</Text>
      <Text selectable style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 12 }}>{ticket.lat.toFixed(6)}, {ticket.lng.toFixed(6)}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>{ticket.contractor_name || 'Awaiting contractor assignment'}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>Created {new Date(ticket.created_at).toLocaleString()}</Text>
      <Button title="Directions to ticket" testID="ticket-directions" secondary icon="navigation" onPress={navigate} />
    </View>
    {linkError ? <Notice danger>{linkError}</Notice> : null}
    {canRepair ? <Button title="Capture repair evidence" icon="camera" testID="ticket-repair"
      onPress={() => router.push({ pathname: '/tickets/[id]/repair', params: { id } })} /> : null}
    {user?.role === 'contractor' && ticket.status === 'NEEDS_JE_REVIEW' ? <Notice>Evidence is awaiting Junior Engineer review. This is not a verified closure.</Notice> : null}
    {ticket.repairs.map(repair => <View key={repair.id} style={surface(c)}>
      <Text style={{ color: c.foreground, fontFamily: fonts.semibold }}>Repair evidence · {new Date(repair.captured_at).toLocaleString()}</Text>
      <EvidenceImage label="AFTER" path={repair.image_url} />
      <StatusBadge status={repair.decision} />
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 22 }}>{repair.vision_reason}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 11 }}>
        SSIM global {score(repair.ssim_global)} · defect {score(repair.ssim_defect_region)}{'\n'}Same-location score {score(repair.same_location_score)}
      </Text>
      {repair.je_decision ? <Notice>Engineer: {statusLabel(repair.je_decision)}{repair.je_notes ? `\n${repair.je_notes}` : ''}</Notice> : null}
    </View>)}
    <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 23 }}>Evidence timeline</Text>
    {ticket.events.length ? ticket.events.map(event => <View key={event.id} style={{ borderLeftWidth: 1, borderColor: c.border, paddingLeft: 16, gap: 6, paddingBottom: 10 }}>
      <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 10 }}>{statusLabel(event.event_type).toUpperCase()}</Text>
      <Text style={{ color: c.foreground, fontFamily: fonts.regular, lineHeight: 21 }}>{event.description}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 12 }}>{event.actor_name} · {new Date(event.at).toLocaleString()}</Text>
    </View>) : <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>No events recorded yet.</Text>}
  </ScrollView>;
}
const score = (value: number | null | undefined) => value == null ? 'not available' : value.toFixed(3);
function EvidenceImage({ label, path }: { label: string; path: string }) {
  const c = useColors(); const [failed, setFailed] = useState(false);
  return <View style={{ gap: 9 }}>
    <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 }}>{label}</Text>
    {failed || !path ? <Notice danger>Evidence image is unavailable. Refresh the ticket to retry.</Notice> :
      <Image source={{ uri: evidenceUrl(path) }} onError={() => setFailed(true)} resizeMode="cover"
        accessibilityLabel={label === 'AFTER' ? 'Submitted repair evidence' : 'Original road hazard evidence'}
        style={{ width: '100%', height: 220, backgroundColor: c.card, borderRadius: c.radius }} />}
  </View>;
}
