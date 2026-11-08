import { Text, View } from 'react-native';
import type { OnnxResult } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { surface } from './ScreenState';

export function OnnxSummary({ result }: { result?: OnnxResult | null }) {
  const c = useColors();
  if (!result) return <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 12 }}>ONNX details were not recorded for this report.</Text>;
  return <View testID="onnx-result" style={surface(c)}>
    <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 12 }}>ONNX POTHOLE MODEL</Text>
    <Text style={{ color: c.foreground, fontFamily: fonts.regular, lineHeight: 24 }}>
      Model ran: {result.status === 'ran' ? 'Yes' : result.status === 'failed' ? 'Failed · vision fallback' : 'No'}{'\n'}
      Pothole detected: {result.detected == null ? 'Not assessed' : result.detected ? 'Yes' : 'No'}{'\n'}
      ONNX confidence: {result.confidence == null ? 'Not available' : `${(result.confidence * 100).toFixed(1)}%`}{'\n'}
      Detection threshold: {(result.confidence_threshold * 100).toFixed(0)}%
    </Text>
    <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19 }}>{result.reason}{'\n'}Model score only—not the final report decision or proof of repair.</Text>
  </View>;
}
