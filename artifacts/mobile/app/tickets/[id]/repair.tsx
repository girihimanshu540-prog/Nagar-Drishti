import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetTicket, useSubmitRepair, type CaptureResult } from '@workspace/api-client-react';
import { LiveCapture } from '@/components/LiveCapture';
import { ScreenState } from '@/components/ScreenState';
import { SubmissionResult } from '@/components/SubmissionResult';
import { useAuth } from '@/providers/AuthProvider';

export default function RepairScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user } = useAuth();
  const cache = useQueryClient(); const mutation = useSubmitRepair();
  const [outcome, setOutcome] = useState<CaptureResult | null>(null);
  const query = useGetTicket(id, { query: { enabled: !!id && !!user, retry: false, refetchOnMount: 'always' } });
  // Keep the returned decision visible even when cache refresh makes the ticket
  // no longer eligible for another submission (e.g. verified or sent to JE).
  if (outcome) return <SubmissionResult result={outcome} repair onRetake={() => { setOutcome(null); void query.refetch(); }} />;
  if (query.isPending) return <ScreenState loading title="Checking ticket eligibility" />;
  if (query.isError || !query.data) return <ScreenState error={query.error || new Error('Ticket not found.')} retry={() => void query.refetch()} />;
  const ticket = query.data;
  if (user?.role !== 'contractor' || ticket.assigned_contractor_id !== user.id) return <ScreenState title="Not assigned to you" message="Only the assigned contractor can submit repair evidence." />;
  if (ticket.is_demo) return <ScreenState title="Sample data" message="This is a demonstration record, not a real report. Repairs cannot be submitted against it." />;
  if (!['ASSIGNED', 'REOPENED'].includes(ticket.status)) return <ScreenState title="Repair submission unavailable" message={`Ticket status is ${ticket.status.replaceAll('_', ' ').toLowerCase()}. Refresh the ticket to see the latest decision.`} />;
  return <LiveCapture repair target={{ lat: ticket.lat, lng: ticket.lng }} submit={async data => {
    const result = await mutation.mutateAsync({ id, data });
    setOutcome(result);
    void cache.invalidateQueries();
    return result;
  }} />;
}
