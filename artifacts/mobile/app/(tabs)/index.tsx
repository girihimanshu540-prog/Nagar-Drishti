import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useGetMyReports, useGetTickets, type Report, type Ticket } from '@workspace/api-client-react';
import { useAuth } from '@/providers/AuthProvider';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { Button, Header, Notice, ScreenState, surface, useBottomSpace } from '@/components/ScreenState';
import { StatusBadge, TicketCard } from '@/components/TicketCard';

type Row = { kind: 'ticket'; ticket: Ticket } | { kind: 'report'; report: Report; ticket?: Ticket };
export default function MyTicketsScreen() {
  const { user } = useAuth(); const c = useColors(); const bottom = useBottomSpace();
  const citizen = user?.role === 'citizen';
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const tickets = useGetTickets({ mine: true, sort: citizen ? 'recent' : 'priority' }, {
    query: { enabled: !!user, refetchInterval: 15_000, retry: false },
  });
  const reports = useGetMyReports({ query: { enabled: citizen, refetchInterval: 15_000, retry: false } });
  const byId = new Map((tickets.data ?? []).map(t => [t.id, t]));
  const rows: Row[] = citizen ? (reports.data ?? []).map(report => ({
    kind: 'report', report, ticket: report.ticket_id ? byId.get(report.ticket_id) : undefined,
  })) : (tickets.data ?? []).filter(t => filter === 'all' || (filter === 'closed' ? t.status === 'VERIFIED_CLOSED' : t.status !== 'VERIFIED_CLOSED'))
    .map(ticket => ({ kind: 'ticket', ticket }));
  const refresh = () => { void tickets.refetch(); if (citizen) void reports.refetch(); };
  const error = tickets.error || (citizen ? reports.error : null);
  const loading = tickets.isPending || (citizen && reports.isPending);
  return <FlatList<Row> testID="my-ticket-list" style={{ flex: 1, backgroundColor: c.background }}
    data={error || loading ? [] : rows} keyExtractor={row => row.kind === 'report' ? `report-${row.report.id}` : row.ticket.id}
    contentContainerStyle={{ paddingBottom: bottom, flexGrow: 1 }}
    refreshControl={<RefreshControl refreshing={tickets.isRefetching || (citizen && reports.isRefetching)} onRefresh={refresh} tintColor={c.primary} />}
    ListHeaderComponent={<>
      <Header eyebrow={`NagarDrishti / ${citizen ? 'citizen' : 'contractor'}`}
        title={citizen ? 'Your reports' : 'Your work queue'}
        subtitle={citizen ? 'Every report is evidence. Track what happens next.' : 'Assigned work, ordered by priority. Repairs need proof.'} />
      <View style={{ paddingHorizontal: 22, paddingBottom: 20, gap: 18 }}>
        {citizen ? <Button title="Report a road hazard" icon="camera" testID="new-report" onPress={() => router.push('/report')} /> :
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['active', 'closed', 'all'] as const).map(value => <Pressable key={value} testID={`filter-${value}`}
              accessibilityRole="button" accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)} style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: c.radius,
                backgroundColor: filter === value ? c.primary : c.muted }}>
              <Text style={{ color: filter === value ? c.primaryForeground : c.foreground, fontFamily: fonts.medium, textTransform: 'capitalize' }}>{value}</Text>
            </Pressable>)}
          </View>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 }}>{citizen ? `${reports.data?.length ?? 0} CAPTURES` : `${rows.length} TICKETS`}</Text>
          <Text style={{ color: c.success, fontFamily: fonts.mono, fontSize: 10 }}>UPDATES EVERY 15s</Text>
        </View>
      </View>
    </>}
    ListEmptyComponent={loading ? <ScreenState loading title={citizen ? 'Loading your reports' : 'Loading assigned tickets'} /> :
      error ? <ScreenState error={error} retry={refresh} /> :
        <ScreenState title={citizen ? 'No reports yet' : 'No tickets here'} message={citizen ? 'Capture a road hazard to create your first report.' : 'Assigned tickets will appear here. Pull down to refresh or select another filter.'} />}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => <View style={{ paddingHorizontal: 22 }}>
      {item.kind === 'ticket' ? <TicketCard ticket={item.ticket} /> : <View style={{ gap: 0 }}>
        {item.ticket ? <TicketCard ticket={item.ticket} /> : <View style={surface(c)}>
          <StatusBadge status={item.report.validation_status} />
          <Text style={{ color: c.foreground, fontFamily: fonts.semibold }}>Report #{item.report.id}</Text>
          <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 21 }}>{item.report.reason || (item.report.ticket_id ? `Linked to ${item.report.ticket_id}` : 'No ticket was created for this capture.')}</Text>
          {item.report.ticket_id ? <Button title={`View ${item.report.ticket_id}`} secondary testID={`report-ticket-${item.report.id}`}
            onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: item.report.ticket_id! } })} /> : null}
        </View>}
        <Text style={{ color: c.mutedForeground, fontFamily: fonts.mono, fontSize: 10, paddingTop: 8, paddingBottom: 4 }}>CAPTURE #{item.report.id} · {new Date(item.report.captured_at).toLocaleString()}</Text>
      </View>}
    </View>} />;
}
