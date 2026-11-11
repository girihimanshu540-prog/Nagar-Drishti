import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useIsFocused, usePreventRemove } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/theme';
import { captureInput, discardCapture, freshLocation, type CapturedEvidence, type TicketLocation } from '@/lib/capture';
import { validateEvidence } from '@/lib/capture-policy';
import { privacyUrl } from '@/lib/config';
import { errorMessage } from '@/lib/client';
import type { CaptureInput, CaptureResult } from '@workspace/api-client-react';
import { Button, Notice, ScreenState, useBottomSpace } from './ScreenState';
import { SubmissionResult } from './SubmissionResult';

export function LiveCapture({ target, submit, repair = false }: {
  target?: TicketLocation; repair?: boolean; submit: (data: CaptureInput) => Promise<CaptureResult>;
}) {
  const c = useColors(); const bottom = useBottomSpace(); const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [locationPermission, requestLocation] = Location.useForegroundPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [evidence, setEvidence] = useState<CapturedEvidence | null>(null);
  const [stage, setStage] = useState<'idle' | 'capturing' | 'gps' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const [uncertain, setUncertain] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const imageUri = useRef<string | null>(null);
  const mounted = useRef(true);
  const busy = stage !== 'idle';
  usePreventRemove(stage === 'sending', () => setError('Your photo is uploading. Please wait for the result before leaving.'));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); if (imageUri.current) void discardCapture(imageUri.current); };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active'); setReady(false);
      if (state !== 'active') controller.current?.abort();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => { if (!focused) { controller.current?.abort(); setReady(false); } }, [focused]);
  useEffect(() => {
    if (!evidence) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [evidence]);

  const settings = async () => {
    if (Platform.OS === 'web') { setError('Use your browser site settings to allow camera and location, then reload.'); return; }
    try { await Linking.openSettings(); } catch { setError('Open device settings and enable camera and location for this app.'); }
  };
  const allow = async () => {
    if (requestingPermissions) return;
    setError(null); setRequestingPermissions(true);
    try {
      const cameraStatus = cameraPermission?.granted ? cameraPermission : await requestCamera();
      const locationStatus = locationPermission?.granted ? locationPermission : await requestLocation();
      if (!cameraStatus.granted || !locationStatus.granted) {
        setError('Camera and foreground location are required to submit evidence. Permission was not granted. Try again, or enable access in device/browser settings.');
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { if (mounted.current) setRequestingPermissions(false); }
  };
  const retake = () => {
    if (imageUri.current) void discardCapture(imageUri.current);
    imageUri.current = null; setEvidence(null); setResult(null); setError(null); setReady(false); setNow(Date.now());
  };
  const take = async () => {
    if (!camera.current || !ready || busy) return;
    setError(null); setStage('capturing');
    const abort = new AbortController(); controller.current = abort;
    try {
      const capturedAt = new Date().toISOString();
      const photo = await camera.current.takePictureAsync({ quality: 0.65, exif: false, skipProcessing: false });
      if (!photo?.uri) throw new Error('Camera did not return a photo. Try again.');
      imageUri.current = photo.uri;
      if (!mounted.current || abort.signal.aborted) throw new Error('Capture interrupted. Please retake.');
      setStage('gps');
      const position = await freshLocation(abort.signal);
      const captured = { ...position, uri: photo.uri, capturedAt };
      validateEvidence(captured, target);
      if (mounted.current) { setEvidence(captured); setNow(Date.now()); }
    } catch (e) {
      if (imageUri.current) void discardCapture(imageUri.current);
      imageUri.current = null;
      if (mounted.current) setError(errorMessage(e));
    } finally { if (mounted.current) setStage('idle'); controller.current = null; }
  };
  const send = async () => {
    if (!evidence || busy) return;
    setStage('sending'); setError(null);
    try {
      const data = await captureInput(evidence, target);
      const response = await submit(data);
      if (mounted.current) setResult(response);
      await discardCapture(evidence.uri); imageUri.current = null;
    } catch (e) {
      if (mounted.current) {
        setError(errorMessage(e));
        // Never automatically resubmit an upload whose outcome may be unknown.
        const code = (e as { status?: number }).status;
        if (!code || code >= 500) setUncertain(true);
      }
    } finally { if (mounted.current) setStage('idle'); }
  };
  if (result) return <SubmissionResult result={result} repair={repair} onRetake={retake} />;
  if (!cameraPermission || !locationPermission) return <ScreenState loading title="Checking permissions" />;
  const permissionsGranted = cameraPermission.granted && locationPermission.granted;
  if (!permissionsGranted) return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 22, paddingBottom: bottom, gap: 18 }}>
    <View style={{ alignItems: 'flex-start', paddingVertical: 24 }}><Feather name="camera" size={44} color={c.primary} /></View>
    <Text style={{ color: c.foreground, fontFamily: fonts.heading, fontSize: 28 }}>Evidence starts here.</Text>
    <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 }}>Camera access captures the actual road. Foreground location confirms where you are. We never use your gallery or track location in the background. Photos and precise GPS are visible only to you and authorised staff; the public sees a general location.</Text>
    {privacyUrl ? <Button title="Read the privacy notice" testID="capture-privacy" secondary icon="shield" onPress={() => { void Linking.openURL(privacyUrl).catch(() => setError('Could not open the privacy notice.')); }} /> : null}
    <Notice>Camera: {cameraPermission.granted ? 'allowed' : 'not allowed'}{'\n'}Location: {locationPermission.granted ? 'allowed' : 'not allowed'}</Notice>
    {error ? <Notice danger>{error}</Notice> : null}
    <Button title="Allow camera & location" testID="capture-permissions" busy={requestingPermissions} onPress={() => void allow()} />
    {(!cameraPermission.canAskAgain || !locationPermission.canAskAgain) ? <Button title={Platform.OS === 'web' ? 'Permission help' : 'Open settings'} testID="capture-settings" secondary onPress={() => void settings()} /> : null}
  </ScrollView>;

  const expired = !!evidence && now - Date.parse(evidence.capturedAt) > 120_000;
  const gpsOld = !!evidence && now - evidence.timestamp > 30_000;
  return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingBottom: bottom, gap: 16 }}>
    <View style={[s.viewfinder, { backgroundColor: c.card, borderColor: c.border }]}>
      {evidence ? <Image source={{ uri: evidence.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> :
        focused && active ? <CameraView key="live-camera" ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" mute
          onCameraReady={() => setReady(true)} onMountError={event => { setReady(false); setError(event.message || 'Camera could not start. Check permissions and try reopening this screen.'); }} /> :
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.mutedForeground }}>Camera paused</Text></View>}
      <View pointerEvents="none" style={[s.corner, { borderColor: c.primary, top: 18, left: 18, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View pointerEvents="none" style={[s.corner, { borderColor: c.primary, bottom: 18, right: 18, borderBottomWidth: 2, borderRightWidth: 2 }]} />
      <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: c.background, padding: 8, borderRadius: c.radius }}>
        <Text style={{ color: c.primary, fontFamily: fonts.mono, fontSize: 10 }}>{evidence ? 'CAPTURED' : 'LIVE CAMERA ONLY'}</Text>
      </View>
    </View>
    <Text style={{ color: c.mutedForeground, fontFamily: fonts.regular, lineHeight: 21 }}>
      {repair ? 'Match the original photo’s angle and include permanent surroundings. Stand within 15 m of the ticket.' :
        'Frame the hazard and its surroundings clearly. Avoid glare and blur. Photograph the road directly, not a screen.'} Do not photograph faces or number plates. Not an emergency service.
    </Text>
    {evidence ? <Notice>
      GPS ±{evidence.accuracy.toFixed(1)} m · {evidence.lat.toFixed(5)}, {evidence.lng.toFixed(5)}{'\n'}
      Captured {new Date(evidence.capturedAt).toLocaleTimeString()}{'\n'}
      {expired || gpsOld ? 'Capture or GPS has expired. Retake before submitting.' : 'Fresh capture and GPS ready. Submit now.'}
    </Notice> : null}
    {error ? <Notice danger>{error}</Notice> : null}
    {uncertain ? <Notice>Submission outcome is unknown. Go back and refresh your {repair ? 'ticket' : 'reports'} before capturing again. Do not resubmit the same photo.</Notice> : null}
    {stage === 'sending' ? <Notice>Uploading. Keep this screen open. Nothing closes automatically; a junior engineer reviews every repair.</Notice> : null}
    {!evidence ? <Button title={stage === 'gps' ? 'Getting accurate GPS…' : stage === 'capturing' ? 'Capturing…' : 'Capture live photo'} icon="camera"
      testID="capture-photo" busy={busy} disabled={!ready || !active || uncertain} onPress={() => void take()} /> : <>
      <Button title={repair ? 'Submit repair evidence' : 'Submit hazard report'} icon="upload" testID="capture-submit" busy={stage === 'sending'}
        disabled={expired || gpsOld || busy || uncertain} onPress={() => void send()} />
      <Button title="Retake photo" secondary icon="refresh-cw" testID="capture-retake" disabled={busy || uncertain} onPress={retake} />
    </>}
  </ScrollView>;
}
const s = StyleSheet.create({
  viewfinder: { height: 330, borderWidth: 1, overflow: 'hidden', borderRadius: 6 },
  corner: { position: 'absolute', height: 30, width: 30 },
});
