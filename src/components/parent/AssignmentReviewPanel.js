import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { parentInteraction } from '../../services/parent/parentActivity';

import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const ActivityContext = createContext(() => false);

const names = { instruction: 'Instruction', term: 'French term', definition: 'French definition', example_sentence: 'Example sentence',
  grammar_label: 'Grammar concept', grammar_explanation: 'Grammar explanation', adjective: 'Adjective', feminine: 'Feminine form', adverb: 'Adverb', supporting_content: 'Supporting content' };
const origins = { teacher: 'Teacher-reported interpretation', parent_corrected: 'Parent-corrected interpretation', ai_generated: 'AI-generated supplementary content', illustrative: 'Illustrative supplementary content' };
const fidelity = { reported_teacher_content: 'Reported teacher content, not checked against the worksheet', unverified_transcription: 'Unverified transcription', verified_transcription: 'Previously recorded as verified transcription', illustrative: 'Illustrative material' };
function Button({ children, disabled, onPress, label }) {
  const activity = useContext(ActivityContext);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={parentInteraction(activity, onPress)} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{children}</Text></Pressable>;
}
function Check({ children, checked, disabled, onChange, label }) {
  const activity = useContext(ActivityContext);
  const change = parentInteraction(activity, () => onChange(!checked));
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={change}
    {...(Platform.OS === 'web' ? { 'aria-checked': checked, onKeyDownCapture: event => {
      if (!disabled && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); change(); }
    } } : {})} style={styles.check}><Text style={styles.text}>{checked ? '[✓]' : '[ ]'} {children}</Text></Pressable>;
}
function Sources({ field, sources }) {
  const activity = useContext(ActivityContext);
  const [expanded, setExpanded] = useState(false);
  const selected = field ? sources.filter(source => field.provenance.sourceIds.includes(source.id)) : sources;
  return <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={field ? `Original sources for ${names[field.kind]}` : 'All original source material'}
      onPress={parentInteraction(activity, () => setExpanded(value => !value))} style={styles.outline}><Text style={styles.text}>{expanded ? 'Hide original sources' : 'Show original sources'}</Text></Pressable>
    {expanded && (selected.length ? selected.map(source => <View key={source.id} style={styles.notice}>
      <Text style={styles.text}>Preserved original excerpt (read-only)</Text>
      <Text selectable style={styles.text}>{source.originalText || 'No excerpt supplied.'}</Text>
      <Text selectable style={styles.small}>Reference: {source.reference || 'Not supplied'}</Text>
      <Text style={styles.small}>Source fidelity: {fidelity[source.fidelity]}. Parent acceptance does not verify this source.</Text>
    </View>) : <Text style={styles.text}>No original source excerpt linked. Supplementary content is not a verified school transcription.</Text>)}
  </View>;
}
export default function AssignmentReviewPanel({ onActivity, ...props }) {
  return <ActivityContext.Provider value={onActivity}><ReviewContent {...props} onActivity={onActivity} /></ActivityContext.Provider>;
}
function ReviewContent({ controller, onActivity, householdBusy }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const { view, detail, busy, edit, confirmation } = state;
  if (view === 'home') return <Button disabled={householdBusy} onPress={controller.list}>Review assignments</Button>;
  const assignment = detail?.document.assignment;
  const accepted = detail?.approvalValidation.valid;
  const approvalLabel = accepted ? (detail.document.approval.method === 'reviewed' ? 'Accepted after detailed review' : 'Accepted without detailed review (risk acknowledged)') : 'Not accepted for strict-mode practice';
  const groups = [['instructions', 'Instructions'], ['vocabulary', 'Vocabulary'], ['grammarConcepts', 'Grammar'], ['supportingMaterial', 'Supporting material']];
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.heading}>Assignment review</Text>
    <Button disabled={busy} onPress={() => controller.navigate('home')}>Back to household settings</Button>
    <Text accessibilityLiveRegion="polite" style={[styles.text, styles.status]}>{busy ? 'Loading or saving…' : state.message}</Text>
    {view === 'list' && <>
      <Button disabled={busy} onPress={controller.list}>Refresh assignment list</Button>
      {!busy && !state.list.length && !state.message && <Text style={styles.text}>No stored assignments yet.</Text>}
      {state.list.map(item => <View key={item.id} style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{item.title}</Text>
        {item.purpose === 'development_sample' && <Text style={styles.notice}>Development sample — excluded from production</Text>}
        <Text style={styles.text}>Status: {item.reviewStatus.replaceAll('_', ' ')}. Reviewed: {item.reviewProgress.reviewed} of {item.reviewProgress.total}.</Text>
        <Text style={styles.text}>{item.approvalValid ? (item.approvalMethod === 'reviewed' ? 'Accepted after detailed review' : 'Accepted without detailed review (risk acknowledged)') : 'Not accepted for strict-mode practice'}</Text>
        <Button disabled={busy} label={`Review ${item.title}`} onPress={() => controller.open(item.id)}>Open assignment</Button>
      </View>)}
    </>}
    {view === 'detail' && <Button disabled={busy} onPress={() => controller.navigate('list')}>Back to assignments</Button>}
    {assignment && <>
      <Text accessibilityRole="header" style={styles.heading}>{assignment.title}</Text>
      {detail.document.purpose === 'development_sample' && <Text style={styles.notice}>Development sample — excluded from production</Text>}
      <Text style={styles.text}>{approvalLabel}</Text>
      <Text style={styles.text}>Reviewed: {detail.review.reviewedFieldPaths.length} of {detail.fields.length}. Field review and assignment acceptance are separate.</Text>
      <Text style={styles.text}>Acceptance means you accept the interpreted content for practice. It does not verify the original worksheet. Supplementary content remains supplementary.</Text>
      <Sources sources={assignment.sources} />
      {!!detail.review.gaps.length && <Text style={styles.notice}>Detailed approval unavailable: {detail.review.gaps.map(gap => gap.code === 'missing_definition' ? 'a vocabulary definition is missing' : 'no educational content supplied').join('; ')}. Missing fields cannot be created here. Risk acceptance cannot supply missing content or guarantee playable questions.</Text>}
    </>}
    {view === 'detail' && detail && <>
      {groups.map(([prefix, title]) => {
        const fields = detail.fields.filter(field => field.path.startsWith(`/${prefix}/`));
        return fields.length ? <View key={prefix} style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
          {fields.map((field, index) => <View key={`${assignment.id}:${field.path}`} style={styles.card}>
            <Text style={styles.small}>{names[field.kind]}</Text>
            <Text selectable style={styles.text}>{field.text}</Text>
            <Text style={styles.small}>{origins[field.provenance.origin]}. {field.provenance.reviewStatus === 'approved' ? 'Reviewed' : 'Not yet reviewed'}.</Text>
            {!!field.provenance.correctionExplanation && <Text style={styles.text}>Parent correction explanation: {field.provenance.correctionExplanation}</Text>}
            <Sources field={field} sources={assignment.sources} />
            <Check checked={field.provenance.reviewStatus === 'approved'} disabled={busy || !!edit} label={`Reviewed ${title} field ${index + 1}`}
              onChange={reviewed => controller.reviewField(field.path, reviewed)}>Reviewed</Check>
            <Button disabled={busy} label={`Edit ${title} field ${index + 1}`} onPress={() => controller.editField(field.path)}>Edit</Button>
            {edit?.path === field.path && <View style={styles.group}>
              <Text style={styles.small}>Unsaved correction. Changed fields need review again; other reviews stay saved. Changes clear assignment approval. Original sources stay unchanged.</Text>
              <TextInput accessibilityLabel="Corrected educational text" editable={!busy} multiline value={edit.text} onChangeText={parentInteraction(onActivity, text => controller.changeEdit('text', text))} style={styles.input} />
              <TextInput accessibilityLabel="Correction explanation" editable={!busy} placeholder="Explain the correction" placeholderTextColor="#52665e" multiline value={edit.explanation} onChangeText={parentInteraction(onActivity, text => controller.changeEdit('explanation', text))} style={styles.input} />
              <Button disabled={busy || !edit.text.trim() || !edit.explanation.trim()} onPress={controller.saveCorrection}>Save correction</Button>
              <Button disabled={busy} onPress={() => controller.navigate('detail')}>Cancel editing</Button>
              {!!state.discard && <View style={styles.notice} accessibilityRole="alert">
                <Text style={styles.text}>Discard unsaved correction and explanation?</Text>
                <Button onPress={controller.keepEditing}>Keep editing</Button>
                <Button onPress={controller.discardEdits}>Discard unsaved changes</Button>
              </View>}
            </View>}
          </View>)}
        </View> : null;
      })}
      <Button disabled={busy || !!edit || !detail.fields.length} onPress={() => controller.confirm('all')}>Mark All Reviewed</Button>
      <Button disabled={busy || !!edit || !detail.review.ready} onPress={() => controller.confirm('detailed')}>Approve reviewed content</Button>
      <Button disabled={busy || !!edit} onPress={() => controller.confirm('risk')}>Approve all without checking each item</Button>
      {confirmation && <View style={styles.notice}>
        <Text accessibilityRole="header" style={styles.heading}>{confirmation.kind === 'all' ? 'Declare all supplied content reviewed' : confirmation.kind === 'detailed' ? 'Accept reviewed assignment' : 'Accept without detailed review'}</Text>
        <Text style={styles.text}>{confirmation.kind === 'all' ? 'Marks supplied fields reviewed; does not approve.' : confirmation.kind === 'detailed' ? 'Accept this content for practice. This does not verify the worksheet.' : 'Errors may remain. Acceptance does not mark fields reviewed or verify the worksheet.'}</Text>
        <Check checked={confirmation.checked} disabled={busy} onChange={value => controller.changeConfirmation('checked', value)}>{confirmation.kind === 'all' ? 'I declare that I reviewed all supplied educational content.' : confirmation.kind === 'detailed' ? 'I accept this interpreted content for practice.' : 'I understand and accept the risk of unreviewed transcription or interpretation errors.'}</Check>
        {confirmation.kind === 'detailed' && <Check checked={confirmation.noGaps} disabled={busy} onChange={value => controller.changeConfirmation('noGaps', value)}>I know of no unresolved omissions or gaps.</Check>}
        <Button disabled={busy || !confirmation.checked || (confirmation.kind === 'detailed' && !confirmation.noGaps)} onPress={controller.submitConfirmation}>Confirm {confirmation.kind === 'all' ? 'review declaration' : 'assignment acceptance'}</Button>
        <Button disabled={busy} onPress={controller.cancelConfirmation}>Cancel confirmation</Button>
      </View>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  status: { minHeight: 56 }, check: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: '#789384', borderRadius: 8 },
  group: { gap: 20 }, card: { gap: 16, padding: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#789384', borderRadius: 10 },
  text: { fontSize: 18, lineHeight: 28, color: '#243b33' }, small: { fontSize: 16, lineHeight: 24, color: '#243b33' },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#174b3e' }, notice: { padding: 16, backgroundColor: '#fff3cb', color: '#243b33', fontSize: 18, lineHeight: 28, gap: 16, borderRadius: 8 },
  button: { backgroundColor: '#174b3e', padding: 16, minHeight: 52, borderRadius: 10 }, buttonText: { color: '#fff', fontSize: 18 }, disabled: { opacity: 0.6 },
  outline: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: '#789384', borderRadius: 8 },
  input: { minHeight: 100, padding: 16, borderWidth: 1, borderColor: '#789384', borderRadius: 8, color: '#243b33', backgroundColor: '#fff', fontSize: 20, textAlignVertical: 'top' },
});
