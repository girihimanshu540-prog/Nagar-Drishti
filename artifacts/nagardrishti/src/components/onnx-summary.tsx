import type { OnnxResult } from '@workspace/api-client-react';

export function OnnxSummary({ result }: { result?: OnnxResult | null }) {
  if (!result) return <p className="mt-2 text-xs text-muted-foreground">ONNX details were not recorded for this report.</p>;
  const score = result.confidence == null ? 'Not available' : `${(result.confidence * 100).toFixed(1)}%`;
  return <section data-testid="onnx-result" aria-label="ONNX pothole model result" className="mt-3 rounded-md border border-border bg-background/60 p-3 text-xs">
    <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">ONNX pothole model</h3>
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
      <dt className="text-muted-foreground">Model ran</dt><dd data-testid="onnx-ran">{result.status === 'ran' ? 'Yes' : result.status === 'failed' ? 'Failed · vision fallback' : 'No'}</dd>
      <dt className="text-muted-foreground">Pothole detected</dt><dd data-testid="onnx-detected">{result.detected == null ? 'Not assessed' : result.detected ? 'Yes' : 'No'}</dd>
      <dt className="text-muted-foreground">ONNX confidence</dt><dd data-testid="onnx-confidence" className="font-mono">{score}</dd>
      <dt className="text-muted-foreground">Detection threshold</dt><dd className="font-mono">{(result.confidence_threshold * 100).toFixed(0)}%</dd>
    </dl>
    <p className="mt-2 leading-relaxed text-muted-foreground">{result.reason}</p>
    <p className="mt-1 text-muted-foreground">Model score only—not the final report decision or proof of repair.</p>
  </section>;
}
