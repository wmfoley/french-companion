import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, runOnUI, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { PREVIEW_LIMITS, aspectFit, zoomAt, resetPreview, beginTransform, updateTransform,
  endTransform, rebaseTransform, applyPreviewGeometry, geometrySnapshot } from '../core/capture/previewTransform';
import { validPreviewPage, createImagePreviewLifecycle } from '../core/capture/capturePreview';

function Control({ children, onPress, disabled }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ padding: 16, minHeight: 48, backgroundColor: disabled ? '#687b73' : '#174b3e', borderRadius: 8 }}>
    <Text style={{ fontSize: 18, color: '#fff' }}>{children}</Text>
  </Pressable>;
}
export default function CaptureImagePreview(props) {
  if (!__DEV__) return null;
  if (!validPreviewPage(props.page)) return <Text>Local image or source dimensions unavailable.</Text>;
  // A real page/URI change is a new image lifetime. Gestures, Fit and layout do not change this key.
  return <PreviewSession key={props.page.uri} {...props} />;
}
function PreviewSession({ page, imageIdentity, pageNumber, captureMethod, parentScrollGesture, onDiagnostic }) {
  const [lifecycle] = useState(() => createImagePreviewLifecycle({ imageIdentity,
    method: captureMethod, pageNumber, width: page.width, height: page.height }));
  const identity = useMemo(() => lifecycle.snapshot().imageIdentity, [lifecycle]);
  const [request, setRequest] = useState(() => lifecycle.token());
  const [status, setStatus] = useState('loading');
  const [viewport, setViewport] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const geometryRequest = useRef(0);
  const latestSnapshot = useRef(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const source = useMemo(() => ({ uri: page.uri }), [page.uri]);
  const model = useSharedValue(resetPreview(null, null, identity, 'page-mount'));
  const serial = useSharedValue(0);
  const panGeneration = useSharedValue(0);
  const pinchGeneration = useSharedValue(0);
  const report = useCallback(geometry => {
    if (!lifecycle.active()) return;
    if (latestSnapshot.current && geometry.serial <= latestSnapshot.current.serial) return;
    latestSnapshot.current = geometry;
    setSnapshot(geometry);
    onDiagnostic?.({ ...lifecycle.snapshot(), geometry });
  }, [lifecycle, onDiagnostic]);
  const publish = useCallback(() => {
    'worklet';
    serial.set(serial.value + 1);
    runOnJS(report)(geometrySnapshot(model.value, serial.value));
  }, [serial, model, report]);
  useEffect(() => {
    const token = lifecycle.open();
    // Synchronize a reopened external image request (Strict Effects); unchanged epochs bail out.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequest(previous => previous.epoch === token.epoch ? previous : token);
    onDiagnostic?.(lifecycle.snapshot());
    const subscription = AppState.addEventListener('change', state => {
      runOnUI(() => {
        'worklet';
        const s = model.value;
        model.set(resetPreview(s, s.geometry, s.pageKey, state === 'active' ? 'resume' : 'background'));
        publish();
      })();
    });
    return () => {
      lifecycle.close(); subscription.remove();
      onDiagnostic?.({ ...lifecycle.snapshot(), geometry: latestSnapshot.current });
      runOnUI(() => { 'worklet'; const s = model.value; model.set(resetPreview(s, null, s.pageKey, 'unmount')); })();
    };
  }, [lifecycle, model, publish, onDiagnostic]);
  useEffect(() => {
    const g = viewport ? aspectFit(page.width, page.height, viewport.width, viewport.height) : null;
    const order = ++geometryRequest.current;
    runOnUI(() => {
      'worklet';
      const reason = !g ? 'awaiting-layout' : model.value.geometry ? 'viewport-orientation' : 'page-layout';
      model.set(applyPreviewGeometry(model.value, g, identity, order, reason)); publish();
    })();
  }, [viewport, page.width, page.height, windowWidth, windowHeight, identity, model, publish]);

  const ready = status === 'loaded';
  /* eslint-disable react-hooks/refs -- Builders register native callbacks; report reads its ref only on subsequent JS delivery. */
  const pinch = useMemo(() => Gesture.Pinch().enabled(ready).blocksExternalGesture(parentScrollGesture)
    .onBegin(() => { pinchGeneration.set(model.value.generation); })
    .onStart(event => { model.set(beginTransform(model.value, pinchGeneration.value, 'pinch',
      { x: event.focalX, y: event.focalY }, event.numberOfPointers, event.scale)); })
    .onUpdate(event => { model.set(updateTransform(model.value, pinchGeneration.value, 'pinch',
      { x: event.focalX, y: event.focalY }, event.numberOfPointers, event.scale)); })
    .onTouchesDown(() => { model.set(rebaseTransform(model.value, pinchGeneration.value, 'pinch')); })
    .onTouchesUp(() => { model.set(rebaseTransform(model.value, pinchGeneration.value, 'pinch')); })
    .onFinalize(() => { model.set(endTransform(model.value, pinchGeneration.value, 'pinch')); publish(); }),
  [ready, parentScrollGesture, model, pinchGeneration, publish]);
  const pan = useMemo(() => Gesture.Pan().enabled(ready).minPointers(2).averageTouches(true).blocksExternalGesture(parentScrollGesture)
    .onBegin(() => { panGeneration.set(model.value.generation); })
    .onStart(event => { model.set(beginTransform(model.value, panGeneration.value, 'pan',
      { x: event.translationX, y: event.translationY }, event.numberOfPointers)); })
    .onUpdate(event => { model.set(updateTransform(model.value, panGeneration.value, 'pan',
      { x: event.translationX, y: event.translationY }, event.numberOfPointers)); })
    .onTouchesDown(() => { model.set(rebaseTransform(model.value, panGeneration.value, 'pan')); })
    .onTouchesUp(() => { model.set(rebaseTransform(model.value, panGeneration.value, 'pan')); })
    .onFinalize(() => { model.set(endTransform(model.value, panGeneration.value, 'pan')); publish(); }),
  [ready, parentScrollGesture, model, panGeneration, publish]);
  const gestures = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);
  function changeZoom(kind) {
    runOnUI(() => {
      'worklet';
      const s = model.value;
      let next = resetPreview(s, s.geometry, s.pageKey, kind === 'fit' ? 'fit-button' : `zoom-${kind}`);
      if (kind !== 'fit' && s.geometry) next = { ...next, transform: zoomAt(s.geometry, s.transform,
        s.transform.scale * (kind === 'in' ? PREVIEW_LIMITS.zoomStep : 1 / PREVIEW_LIMITS.zoomStep),
        { x: s.geometry.viewportWidth / 2, y: s.geometry.viewportHeight / 2 }) };
      model.set(next); publish();
    })();
  }
  function loaded(event) {
    const decoded = event?.nativeEvent?.source;
    if (lifecycle.load(request, 'success', decoded?.width, decoded?.height)) setStatus('loaded');
    if (lifecycle.active()) runOnUI(publish)();
  }
  function started() {
    if (lifecycle.start(request)) setStatus('loading');
    if (lifecycle.active()) runOnUI(publish)();
  }
  function failed() {
    if (lifecycle.load(request, 'error')) {
      setStatus('error');
      runOnUI(() => { 'worklet'; const s = model.value; model.set(resetPreview(s, s.geometry, s.pageKey, 'image-error')); publish(); })();
    } else if (lifecycle.active()) runOnUI(publish)();
  }
  function retry() {
    const next = lifecycle.retry();
    if (!next) return;
    setStatus('loading'); setRequest(next);
    runOnUI(() => { 'worklet'; const s = model.value; model.set(resetPreview(s, s.geometry, s.pageKey, 'image-retry')); publish(); })();
  }
  /* eslint-enable react-hooks/refs */
  const style = useAnimatedStyle(() => {
    const s = model.value;
    return { width: s.geometry?.width || 0, height: s.geometry?.height || 0,
      transform: [{ translateX: s.transform.x }, { translateY: s.transform.y }, { scale: s.transform.scale }] };
  });
  const life = lifecycle.snapshot();
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22 }}>New Gesture Preview — page {pageNumber}</Text>
    <Text>Pinch to zoom; use two fingers to pan. Scroll outside the image region. Fit is 1x; maximum 4x. Numbers update after gestures.</Text>
    <Control disabled={!ready} onPress={() => changeZoom('fit')}>Fit image</Control>
    <Control disabled={!ready || snapshot?.scale >= PREVIEW_LIMITS.maxScale} onPress={() => changeZoom('in')}>Zoom In</Control>
    <Control disabled={!ready || snapshot?.scale <= PREVIEW_LIMITS.minScale} onPress={() => changeZoom('out')}>Zoom Out</Control>
    {status === 'loading' && <Text accessibilityLiveRegion="polite">Loading local image…</Text>}
    {status === 'error' && <><Text accessibilityLiveRegion="polite">Local image could not load. Retry or use the original preview. Captured files have not been changed.</Text><Control onPress={retry}>Retry image load</Control></>}
    <View style={{ height: 380, width: '100%', overflow: 'hidden', backgroundColor: '#e0ece6' }}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        if (!lifecycle.layout(event.timeStamp) || ![width, height].every(n => Number.isFinite(n) && n > 0)) return;
        setViewport(previous => previous?.width === width && previous?.height === height ? previous : { width, height });
      }}>
      <GestureDetector gesture={gestures}>
        <Animated.View collapsable={false} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View pointerEvents="none" style={style}>
            <Image key={request.epoch} source={source} resizeMode="contain" style={{ width: '100%', height: '100%' }}
              accessible accessibilityLabel={`Captured worksheet page ${pageNumber}`} onLoadStart={started} onLoad={loaded} onError={failed} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
    <Control onPress={() => runOnUI(publish)()}>Read gesture preview diagnostics</Control>
    <Text selectable>{`${life.method}; page ${life.pageNumber}; URI identity ${life.imageIdentity} (opaque within this capture).\nLoad ${life.status}; session mounts ${life.mounts}; session unmounts ${life.unmounts}; native load starts ${life.loadStarts}; loads ${life.loads}; errors ${life.errors}; explicit reloads ${life.retries}; rejected events ${life.stale}.\nSource ${life.sourceWidth} x ${life.sourceHeight}; decoded ${life.decodedWidth || '?'} x ${life.decodedHeight || '?'}. Source metadata drives geometry.\nRecent lifecycle events: ${life.events.slice(-5).map(event => event.kind).join(', ')}.`}</Text>
    <Text selectable>{snapshot ? `UI snapshot #${snapshot.serial}: viewport ${snapshot.viewportWidth.toFixed(1)} x ${snapshot.viewportHeight.toFixed(1)}; fitted ${snapshot.fittedWidth.toFixed(1)} x ${snapshot.fittedHeight.toFixed(1)}; transformed ${snapshot.transformedWidth.toFixed(1)} x ${snapshot.transformedHeight.toFixed(1)}.\nScale ${snapshot.scale.toFixed(4)}; translation (${snapshot.x.toFixed(1)}, ${snapshot.y.toFixed(1)}); limits (${snapshot.limitX.toFixed(1)}, ${snapshot.limitY.toFixed(1)}); generation ${snapshot.generation}; owner ${snapshot.owner}; reset ${snapshot.lastResetReason}.` : 'UI geometry snapshot pending.'}</Text>
    <Text>No pixel visibility test. Diagnostics stay in memory; no image paths or worksheet contents are recorded.</Text>
  </View>;
}
