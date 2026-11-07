import { useQueryClient } from '@tanstack/react-query';
import { useSubmitReport } from '@workspace/api-client-react';
import { LiveCapture } from '@/components/LiveCapture';
import { ScreenState } from '@/components/ScreenState';
import { useAuth } from '@/providers/AuthProvider';

export default function ReportScreen() {
  const { user } = useAuth(); const cache = useQueryClient();
  const mutation = useSubmitReport();
  if (user?.role !== 'citizen') return <ScreenState title="Citizen access only" message="Contractors submit repair evidence from an assigned ticket." />;
  return <LiveCapture submit={async data => {
    const result = await mutation.mutateAsync({ data });
    await cache.invalidateQueries();
    return result;
  }} />;
}
