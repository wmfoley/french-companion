import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { cleanupOwned, createOperationGuard, measurements } from '../core/capture/captureProof';
import { createPreviewDiagnostics, summarizePreviewDiagnostics } from '../core/capture/previewDiagnostics';
import { selectPreviewPage } from '../core/capture/capturePreview';

const guard = createOperationGuard();
const GestureRuntimeProof = __DEV__ ? require('./GestureRuntimeProof').default : null;
const CaptureImagePreview = __DEV__ ? require('./CaptureImagePreview').default : null;
const owned = new Directory(Paths.cache, 'fc-capture-proof');
let sequence = 0;
function Button({ children, onPress, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ padding: 16, minHeight: 48, backgroundColor: disabled ? '#687b73' : '#174b3e', borderRadius: 8 }}>
    <Text style={{ color: '#fff', fontSize: 18 }}>{children}</Text>
  </Pressable>;
}
function imageSize(uri) {
  return new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}
export default function CaptureProof() {
  const parentScrollGesture = useMemo(() => Gesture.Native(), []);
  const camera = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState(false);
  const [viewer, setViewer] = useState('original');
  const [selection, setSelection] = useState(null);
  const [viewerHistory, setViewerHistory] = useState([]);
  const selected = selectPreviewPage(selection, result?.pages);
  const onViewerDiagnostic = useCallback(entry => {
    const text = `${entry.method} page ${entry.pageNumber} (${entry.imageIdentity}): ${entry.status}; mounts ${entry.mounts}; unmounts ${entry.unmounts}; loads ${entry.loads}; errors ${entry.errors}; retries ${entry.retries}; stale ${entry.stale}`;
    setViewerHistory(previous => [...previous, text].slice(-10));
  }, []);
  const diagnostics = useRef(null);
  if (diagnostics.current === null) diagnostics.current = createPreviewDiagnostics(__DEV__);
  const [diagnosticText, setDiagnosticText] = useState('Select Show diagnostics after a test.');
  const mode = zoom ? 'enlarge' : 'fit';
  const record = (kind, index, metrics) => diagnostics.current.record(kind, index + 1, mode, metrics);
  useEffect(() => {
    result?.pages.forEach((page, index) => diagnostics.current.record('js_dimensions', index + 1, mode,
      { imageWidth: zoom ? page.width : 280, imageHeight: zoom ? page.height : 380 }));
  }, [result, zoom, mode]);
  useFocusEffect(useCallback(() => {
    guard.enter();
    setBusy(false);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { setCameraOpen(false); setReady(false); }
    });
    return () => { guard.leave(); subscription.remove(); setCameraOpen(false); setReady(false); };
  }, []));

  async function run(kind) {
    const token = guard.begin();
    if (token === null) return;
    setBusy(true); setMessage('');
    const created = [];
    try {
      if (kind === 'open') {
        const response = permission?.granted ? permission : await requestPermission();
        if (guard.current(token)) {
          if (response.granted) { setReady(false); setCameraOpen(true); }
          else setMessage('Camera permission denied. Enable it in Android app settings to test photographs.');
        }
        return;
      }
      owned.create({ intermediates: true, idempotent: true });
      if (kind === 'clear') {
        await cleanupOwned(owned.list().filter(entry => entry instanceof File), owned.uri);
        if (guard.current(token)) setResult(null);
        return;
      }
      const start = performance.now();
      let sources;
      if (kind === 'scanner') {
        if (!CameraView.isDocumentScannerAvailable) {
          if (guard.current(token)) setMessage('Document scanner unavailable. Google Play services and device support must be checked.');
          return;
        }
        setCameraOpen(false);
        const scan = await CameraView.scanDocumentAsync({ requestPdf: false });
        if (!scan) { if (guard.current(token)) setMessage('Scan cancelled or unavailable.'); return; }
        sources = scan.pages;
      } else {
        sources = [(await camera.current.takePictureAsync({ quality: 0.9, skipProcessing: false, exif: false })).uri];
      }
      const captureEnd = performance.now();
      const pages = [];
      for (const uri of sources) {
        const target = new File(owned, `${Date.now()}-${++sequence}.jpg`);
        created.push(target);
        // Adopt only the exact image returned by this operation, not shared cache.
        await new File(uri).move(target);
        const size = await imageSize(target.uri);
        pages.push({ uri: target.uri, ...size, bytes: target.size });
      }
      if (guard.current(token)) {
        diagnostics.current.clear();
        setDiagnosticText('New capture: select Show diagnostics after a test.');
        setResult({ kind, ...measurements(start, performance.now(), pages), captureMs: captureEnd - start });
        setCameraOpen(false); setReady(false);
      } else await cleanupOwned(created, owned.uri);
    } catch {
      try { await cleanupOwned(created, owned.uri); } catch { /* Explicit cleanup can be retried. */ }
      if (guard.current(token)) setMessage('Capture could not complete. Check permissions, scanner support and free space; retry or clear temporary results.');
    } finally {
      guard.finish();
      if (guard.current(token)) setBusy(false);
    }
  }
  // Local scroll shell: expose this actual ScrollView to gesture coordination.
  // Shared Screen and every other route remain unchanged.
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <GestureDetector gesture={parentScrollGesture}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: '#f5f8f3', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 24 }}>
    <Text accessibilityRole="header" style={{ fontSize: 26 }}>Capture comparison — development only</Text>
    <Text>Temporary images only. No assignments, OCR, approval or household storage. Use non-identifying worksheets.</Text>
    <Text>Scanner capability: {CameraView.isDocumentScannerAvailable ? 'reported available; launch still needs testing' : 'unavailable'}. RAM and Google Play services version: record manually.</Text>
    <Button disabled={busy} onPress={() => run('open')}>Open camera</Button>
    {cameraOpen && <View>
      <CameraView ref={camera} facing="back" mode="picture" style={{ height: 400 }} onCameraReady={() => setReady(true)}
        onMountError={() => { setCameraOpen(false); setMessage('Camera unavailable.'); }} />
      <Button disabled={busy || !ready} onPress={() => run('photo')}>Photograph page</Button>
      <Button disabled={busy} onPress={() => { setCameraOpen(false); setReady(false); }}>Cancel camera</Button>
    </View>}
    <Button disabled={busy || cameraOpen} onPress={() => run('scanner')}>Scan document / multiple pages</Button>
    <Button disabled={busy} onPress={() => run('clear')}>Clear temporary proof images</Button>
    {busy && <Text accessibilityLiveRegion="polite">Capture or cleanup in progress…</Text>}
    <Text accessibilityLiveRegion="polite">{message}</Text>
    <Text>Scanner timing includes interaction and possible first-use downloads. Photo timing starts at shutter. Compare those separately.</Text>
    {result && <>
      <Text>{result.kind}: {result.pageCount} pages; capture {Math.round(result.captureMs)} ms; including cache transfer {Math.round(result.elapsedMs)} ms.</Text>
      {__DEV__ && <>
        <Text>Development comparison only. Viewer: {viewer === 'original' ? 'Original ScrollView Preview' : 'New Gesture Preview'}. Both use the same captured files.</Text>
        <Button disabled={viewer === 'original'} onPress={() => setViewer('original')}>Original ScrollView Preview</Button>
        <Button disabled={viewer === 'gesture'} onPress={() => setViewer('gesture')}>New Gesture Preview</Button>
      </>}
      {__DEV__ && viewer === 'gesture' && CaptureImagePreview ? <>
        <Text>Page {selected.index + 1} of {result.pages.length}</Text>
        <Button disabled={selected.index === 0} onPress={() => setSelection(previous => selectPreviewPage(previous, result.pages, -1))}>Previous page</Button>
        <Button disabled={selected.index === result.pages.length - 1} onPress={() => setSelection(previous => selectPreviewPage(previous, result.pages, 1))}>Next page</Button>
        <CaptureImagePreview page={result.pages[selected.index]} imageIdentity={`local-image-${selected.index + 1}`}
          pageNumber={selected.index + 1} captureMethod={result.kind} parentScrollGesture={parentScrollGesture} onDiagnostic={onViewerDiagnostic} />
      </> : <>
      <Button onPress={() => {
        result.pages.forEach((page, index) => record(zoom ? 'action_fit' : 'action_enlarge', index));
        setZoom(value => !value);
      }}>{zoom ? 'Fit previews' : 'Enlarge previews (scroll)'}</Button>
      {result.pages.map((page, index) => <View key={page.uri}>
        <Text>Page {index + 1}: {page.width} × {page.height}; {page.bytes} bytes</Text>
        <ScrollView horizontal
          onLayout={event => record('viewport_layout', index, {
            viewportWidth: event.nativeEvent.layout.width, viewportHeight: event.nativeEvent.layout.height })}
          onContentSizeChange={(width, height) => record('content_size', index, { contentWidth: width, contentHeight: height })}
          onScroll={event => { const e = event.nativeEvent; record('scroll', index, {
            x: e.contentOffset.x, y: e.contentOffset.y, viewportWidth: e.layoutMeasurement.width,
            viewportHeight: e.layoutMeasurement.height, contentWidth: e.contentSize.width, contentHeight: e.contentSize.height }); }}
          scrollEventThrottle={64}><Image accessible accessibilityLabel={`Captured worksheet page ${index + 1}`} source={{ uri: page.uri }}
          onLayout={event => record('image_layout', index, { imageWidth: event.nativeEvent.layout.width, imageHeight: event.nativeEvent.layout.height })}
          onLoad={() => record('image_load', index)} onError={() => record('image_error', index)}
          style={{ width: zoom ? page.width : 280, height: zoom ? page.height : 380 }} resizeMode="contain" /></ScrollView>
      </View>)}
      </>}
      {__DEV__ && viewerHistory.length > 0 && <Text selectable>Historical gesture-viewer lifecycle (last 10 reports, opaque identities scoped to each capture):{'\n'}{viewerHistory.join('\n')}</Text>}
    </>}
    <Link href="/">Return to student home</Link>
    {__DEV__ && GestureRuntimeProof && <GestureRuntimeProof parentScrollGesture={parentScrollGesture} />}
    {__DEV__ && <View style={{ height: 240, gap: 8 }}>
      <Button onPress={() => setDiagnosticText(summarizePreviewDiagnostics(diagnostics.current.snapshot()))}>Show diagnostics</Button>
      <Text>Last 40 of at most 200 local events. JS dimensions/actions are requested values; scroll/layout events are native-reported. No pixel visibility test.</Text>
      <ScrollView><Text selectable style={{ fontSize: 12 }}>{diagnosticText}</Text></ScrollView>
    </View>}
        </View>
      </ScrollView>
    </GestureDetector>
  </GestureHandlerRootView>;
}
