import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import type { CaptureResult } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { Button, Notice, surface, useBottomSpace } from './ScreenState';
import { statusLabel } from './TicketCard';
import { OnnxSummary } from './OnnxSummary';

export function SubmissionResult({ result, repair, onRetake }: { result: CaptureResult; repair: boolean; onRetake: () => void }) {
  const c = useColors(); const bottom = useBottomSpace();
  const closed = result.decision === 'VERIFIED_CLOSED';
  const title = repair ? closed ? 'Repair verified' : result.decision === 'NEEDS_JE_REVIEW' ? 'Engineer review needed' :
    result.decision === 'REOPENED' ? 'Defect still present' : 'Evidence not accepted' :
    !result.accepted ? 'Report not accepted' : (result.ticket?.report_count ?? 0) > 1 ? 'Added to an existing ticket' : 'Hazard reported';
  return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 24, paddingBottom: bottom, gap: 22 }}>
    <View style={{ paddingVertical: 20 }}><Feather size={46} color={closed || (!repair && result.accepted) ? c.success : c.primary} name={closed ? 'check-circle' : 'clipboard'} /></View>
    <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 32 }}>{title}</Text>
    <Notice danger={!result.accepted}>{result.reason}</Notice>
    {!repair ? <OnnxSummary result={result.onnx} /> : null}
    <View style={surface(c)}>
      <Text style={{ color: c.primary, fontFamily: fonts.mono, textTransform: 'uppercase', fontSize: 12 }}>{statusLabel(result.decision)}</Text>
      {result.ticket ? <Text style={{ color: c.foreground, fontFamily: fonts.semibold }}>{result.ticket.id} · {result.ticket.title}</Text> : null}
      <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular }}>Analysis: {result.detector_engine}</Text>
    </View>
    {repair && !closed ? <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 22 }}>This ticket has not been automatically closed. Follow its latest status and the engineer’s decision.</Text> : null}
    {result.ticket ? <Button title="View ticket" testID="result-ticket" icon="arrow-right"
      onPress={() => router.replace({ pathname: '/tickets/[id]', params: { id: result.ticket!.id } })} /> : null}
    {!result.accepted ? <Button title="Retake evidence" testID="result-retake" secondary onPress={onRetake} /> : null}
    <Button title="Back to my list" testID="result-list" secondary onPress={() => router.replace('/(tabs)')} />
  </ScrollView>;
}
