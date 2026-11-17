import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, runOnUI, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { PREVIEW_LIMITS, aspectFit, zoomAt, resetPreview, beginTransform,
  updateTransform, endTransform, rebaseTransform, applyPreviewGeometry, geometrySnapshot } from '../core/capture/previewTransform';
import { newPanDiagnostic, samplePanDiagnostic, acceptSyntheticLayout, formatGeometrySnapshot } from '../core/capture/syntheticPanDiagnostics';

const PAGES = [
  { key: 'portrait', width: 900, height: 1200 }, { key: 'landscape', width: 1200, height: 900 },
  { key: 'square', width: 800, height: 800 }, { key: 'tall', width: 200, height: 1600 },
];
function Control({ children, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 16, minHeight: 48, backgroundColor: '#e0ece6' }}><Text>{children}</Text></Pressable>;
}
// Synthetic only. No worksheet sources or storage. Gate 1C parent ownership is retained.
export default function GestureRuntimeProof({ parentScrollGesture }) {
  const active = useRef(true);
  const [metrics, setMetrics] = useState(null);
  const [presses, setPresses] = useState(0);
  const [events, setEvents] = useState({});
  const [viewport, setViewport] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [panSummary, setPanSummary] = useState(null);
  const page = PAGES[pageIndex];
  const selectedKey = useRef('portrait');
  const lastLayout = useRef(null);
  const geometryRequest = useRef(0);
  const model = useSharedValue(resetPreview(null, null, 'portrait', 'initial'));
  const sampleSerial = useSharedValue(0);
  const panGeneration = useSharedValue(0);
  const pinchGeneration = useSharedValue(0);
  const panDiagnostic = useSharedValue(newPanDiagnostic());
  const count = useCallback(name => {
    if (active.current) setEvents(previous => ({ ...previous, [name]: Math.min(999, (previous[name] || 0) + 1) }));
  }, []);
  const report = useCallback(snapshot => {
    if (active.current) {
      setMetrics(previous => !previous || !Number.isFinite(previous.serial) || snapshot.serial > previous.serial ? snapshot : previous);
      count('UI reports');
    }
  }, [count]);
  const publish = useCallback(() => {
    'worklet';
    sampleSerial.set(sampleSerial.value + 1);
    runOnJS(report)(geometrySnapshot(model.value, sampleSerial.value));
  }, [model, sampleSerial, report]);
  const reportPan = useCallback((sample, snapshot) => {
    if (active.current) setPanSummary(previous => !previous || snapshot.generation >= previous.generation ?
      { ...sample, targetX: snapshot.transform.x, targetY: snapshot.transform.y, generation: snapshot.generation } : previous);
  }, []);
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener('change', status => {
      if (status !== 'active') runOnUI(() => {
        'worklet';
        const s = model.value;
        model.set(resetPreview(s, s.geometry, s.pageKey, 'background'));
        publish();
      })();
    });
    return () => {
      active.current = false; subscription.remove();
      runOnUI(() => { 'worklet'; const s = model.value; model.set(resetPreview(s, null, s.pageKey, 'unmount')); })();
    };
  }, [model, publish]);
  useEffect(() => {
    const geometry = viewport ? aspectFit(page.width, page.height, viewport.width, viewport.height) : null;
    const key = page.key;
    const request = ++geometryRequest.current;
    runOnUI(() => {
      'worklet';
      const reason = !geometry ? 'awaiting-layout' : model.value.pageKey !== key ? 'shape-button' :
        model.value.geometry ? 'viewport-layout' : 'initial-layout';
      model.set(applyPreviewGeometry(model.value, geometry, key, request, reason)); publish();
    })();
  }, [viewport, page, model, publish]);

  /* eslint-disable react-hooks/refs -- Builders register callbacks; mounted-ref reads occur only on subsequent JS deliveries. */
  const pinch = useMemo(() => Gesture.Pinch().blocksExternalGesture(parentScrollGesture)
    .onBegin(() => { pinchGeneration.set(model.value.generation); runOnJS(count)('pinch begin'); })
    .onStart(event => {
      model.set(beginTransform(model.value, pinchGeneration.value, 'pinch',
        { x: event.focalX, y: event.focalY }, event.numberOfPointers, event.scale));
      runOnJS(count)('pinch active');
    }).onUpdate(event => {
      model.set(updateTransform(model.value, pinchGeneration.value, 'pinch',
        { x: event.focalX, y: event.focalY }, event.numberOfPointers, event.scale));
    }).onTouchesDown(() => { model.set(rebaseTransform(model.value, pinchGeneration.value, 'pinch')); })
    .onTouchesUp(() => { model.set(rebaseTransform(model.value, pinchGeneration.value, 'pinch')); })
    .onFinalize((_event, success) => {
      model.set(endTransform(model.value, pinchGeneration.value, 'pinch'));
      runOnJS(count)('pinch finalize'); runOnJS(count)(success ? 'pinch success' : 'pinch failed/cancelled');
      publish();
    }), [parentScrollGesture, model, pinchGeneration, count, publish]);
  const pan = useMemo(() => Gesture.Pan().minPointers(2).averageTouches(true).blocksExternalGesture(parentScrollGesture)
    .onBegin(() => { panGeneration.set(model.value.generation); panDiagnostic.set(newPanDiagnostic()); runOnJS(count)('pan begin'); })
    .onStart(event => {
      panDiagnostic.set(newPanDiagnostic(event.translationX, event.translationY, event.numberOfPointers));
      model.set(beginTransform(model.value, panGeneration.value, 'pan',
        { x: event.translationX, y: event.translationY }, event.numberOfPointers));
      runOnJS(count)('pan active');
    }).onUpdate(event => {
      const before = model.value;
      const after = updateTransform(before, panGeneration.value, 'pan',
        { x: event.translationX, y: event.translationY }, event.numberOfPointers);
      model.set(after);
      panDiagnostic.set(samplePanDiagnostic(panDiagnostic.value, before, after, panGeneration.value,
        event.translationX, event.translationY, event.numberOfPointers));
    }).onTouchesDown(() => { model.set(rebaseTransform(model.value, panGeneration.value, 'pan')); })
    .onTouchesUp(() => { model.set(rebaseTransform(model.value, panGeneration.value, 'pan')); })
    .onFinalize((_event, success) => {
      runOnJS(reportPan)(panDiagnostic.value, model.value);
      model.set(endTransform(model.value, panGeneration.value, 'pan'));
      runOnJS(count)('pan finalize'); runOnJS(count)(success ? 'pan success' : 'pan failed/cancelled');
      publish();
    }), [parentScrollGesture, model, panGeneration, panDiagnostic, count, publish, reportPan]);
  const gestures = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);
  const tap = useMemo(() => Gesture.Tap().runOnJS(true).onBegin(() => count('JS tap begin'))
    .onEnd((_event, success) => count(success ? 'JS tap success' : 'JS tap failed')), [count]);
  function changeZoom(kind) {
    count('button pressed');
    runOnUI(() => {
      'worklet';
      const s = model.value;
      let next = resetPreview(s, s.geometry, s.pageKey, kind === 'fit' ? 'fit-button' : `zoom-${kind}`);
      if (kind !== 'fit' && s.geometry) {
        const scale = kind === 'toggle' ? (s.transform.scale === 1 ? 2 : 1) :
          s.transform.scale * (kind === 'in' ? PREVIEW_LIMITS.zoomStep : 1 / PREVIEW_LIMITS.zoomStep);
        next = { ...next, transform: zoomAt(s.geometry, s.transform, scale,
          { x: s.geometry.viewportWidth / 2, y: s.geometry.viewportHeight / 2 }) };
      }
      model.set(next); publish(); runOnJS(count)('button UI completed');
    })();
  }
  function nextShape() {
    const next = (PAGES.findIndex(item => item.key === selectedKey.current) + 1) % PAGES.length;
    selectedKey.current = PAGES[next].key;
    count('shape button'); setPageIndex(next);
  }
  function measureLayout(event) {
    const { width, height } = event.nativeEvent.layout;
    const accepted = acceptSyntheticLayout(lastLayout.current, selectedKey.current, page.key, width, height, event.timeStamp);
    if (accepted === lastLayout.current) return;
    lastLayout.current = accepted;
    setViewport(previous => previous?.width === width && previous?.height === height ? previous : { width, height });
  }
  /* eslint-enable react-hooks/refs */
  const style = useAnimatedStyle(() => {
    const s = model.value;
    return { width: s.geometry?.width || 0, height: s.geometry?.height || 0,
      transform: [{ translateX: s.transform.x }, { translateY: s.transform.y }, { scale: s.transform.scale }] };
  });
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22 }}>Experimental gesture runtime test</Text>
    <Text>Gate 1A diagnostic bundle v1; Gate 1C ownership retained. Gate 2B geometry trial v1. Gate 2B.2 pan diagnostics v1. Gate 2B.3 geometry snapshot v1.</Text>
    <Text>Synthetic page only. TWO fingers pan; pinch to zoom. Scroll outside the pale region. Fit 1x; maximum 4x; cumulative 4% pinch neutral zone. Numbers update on release, tile updates continuously. At Fit there is no overflow to pan.</Text>
    <Text style={{ height: 64 }}>Read the single captured geometry state below. It updates on completion or request, not continuously during a gesture.</Text>
    <Control onPress={() => changeZoom('fit')}>Fit synthetic page</Control>
    <Control onPress={() => changeZoom('in')}>Zoom in (1.25x)</Control>
    <Control onPress={() => changeZoom('out')}>Zoom out (1/1.25x)</Control>
    <Control onPress={() => changeZoom('toggle')}>Test UI worklet (toggle 1x/2x)</Control>
    <Control onPress={nextShape}>Next synthetic page shape (resets Fit)</Control>
    <Control onPress={() => runOnUI(publish)()}>Read current geometry snapshot</Control>
    <GestureHandlerRootView style={{ height: 300, width: '100%', overflow: 'hidden', backgroundColor: '#e0ece6' }}
      onLayout={measureLayout}>
      <GestureDetector gesture={gestures}>
        <Animated.View collapsable={false} onTouchStart={() => count('surface touch')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[{ backgroundColor: '#174b3e', borderWidth: 3, borderColor: '#facf5a', alignItems: 'center', justifyContent: 'center' }, style]}>
            <Text style={{ color: '#fff', fontSize: 20 }}>SYNTHETIC</Text>
            <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#fff' }} />
            <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' }} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
    <Text selectable>{formatGeometrySnapshot(metrics)}</Text>
    <Text selectable>{panSummary ? `HISTORICAL last completed pan (generation ${panSummary.generation}): updates ${panSummary.updates}; raw changes ${panSummary.rawChanges}; applied changes ${panSummary.appliedChanges}; invalid inputs ${panSummary.invalidInputs}; pinch-owned ${panSummary.pinchOwned}; stale ${panSummary.stale}; low pointers ${panSummary.lowPointers}; rebases ${panSummary.rebases}; raw (${panSummary.rawX.toFixed(1)}, ${panSummary.rawY.toFixed(1)}); fingers ${panSummary.pointers}; last owner ${panSummary.owner}; style target (${panSummary.targetX.toFixed(1)}, ${panSummary.targetY.toFixed(1)}).` : 'Last pan: none. Values sampled on UI runtime, displayed on completion; style target is not pixel evidence.'}</Text>
    <Text selectable>{['surface touch', 'JS tap begin', 'JS tap success', 'JS tap failed', 'pinch begin', 'pinch active', 'pinch finalize', 'pinch success', 'pinch failed/cancelled', 'pan begin', 'pan active', 'pan finalize', 'pan success', 'pan failed/cancelled', 'UI reports', 'button pressed', 'button UI completed', 'shape button'].map(name => `${name}: ${events[name] || 0}`).join('; ')}</Text>
    <GestureHandlerRootView style={{ height: 64, backgroundColor: '#d3e1ee' }}>
      <GestureDetector gesture={tap}><View collapsable={false} style={{ flex: 1, justifyContent: 'center' }}><Text>Separate JS Gesture Handler tap pad: tap once without dragging</Text></View></GestureDetector>
    </GestureHandlerRootView>
    <Control onPress={() => setPresses(value => value + 1)}>Surrounding control check: {presses}</Control>
  </View>;
}
