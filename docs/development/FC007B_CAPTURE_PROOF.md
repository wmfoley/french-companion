# FC-007B capture technology proof

## Gate 3B: proof consolidation and proposed durable capture contract (2026-11-17)

Gate 2B, Gate 2C.2 and Gate 3A are owner accepted. This is a documentation-only
design proposal, not an implemented repository, schema, service or authorization
change. Production integration and fallback removal remain unauthorized.

### Exact proposed milestone inventory

All 25 paths below belong in ONE coherent proposed Capture Proof commit. Dependency
names in this table refer to other paths in the table. Privacy review found no
credential-pattern matches, image/database artifacts or private-key material in
these files. This is a bounded source review, not a guarantee that arbitrary prose
or future additions cannot contain sensitive data. No worksheet image is committed.

| Path | Category and purpose | Uncommitted dependencies | Privacy consideration |
| --- | --- | --- | --- |
| .easignore | Configuration: excludes Git metadata, private state and build outputs from EAS | eas.json, EAS tests | Exclusion patterns only; not signing material |
| app.config.js | Configuration: isolated identity, camera plugin, permission settings | package.json, variant tests | Package IDs/scheme are public identifiers |
| app/index.js | Proof entry: secondary Android development link | app/capture-proof.js | No protected data |
| app/capture-proof.js | Proof route: dev/Android guard and lazy native loading | CaptureProof.js | No route credentials or image parameters |
| eas.json | Configuration: internal captureproof development APK profile | app.config.js, EAS tests | No secrets; existing project association retained |
| package.json | Configuration: camera/file-system dependencies | package-lock.json, config and proof | No secret values |
| package-lock.json | Configuration: reproducible dependency resolutions | package.json | Registry URLs/integrities, not credentials |
| src/components/CaptureProof.js | Proof host: capture, cache adoption, comparisons, ordering and cleanup | route, both viewers, capture and diagnostic helpers, new dependencies | Handles local images/URIs at runtime; no embedded worksheet data |
| src/components/GestureRuntimeProof.js | Proof: synthetic runtime/geometry experiment | previewTransform.js, syntheticPanDiagnostics.js, host | Anonymous bounded diagnostics; no worksheet content |
| src/components/CaptureImagePreview.js | Reusable viewer candidate: image rendering, gestures, lifecycle | capturePreview.js, previewTransform.js, host | Runtime file URI, never diagnostic URI output |
| src/core/capture/captureProof.js | Proof: measurement, operation guard and owned cleanup helpers | CaptureProof.js, proof tests | Runtime file references; no real files embedded |
| src/core/capture/capturePreview.js | Reusable lifecycle/selection candidate | viewer, viewer tests | Opaque local aliases, bounded in-memory events |
| src/core/capture/previewTransform.js | Reusable pure worklet geometry and transform model | both viewers, geometry tests | Geometry only |
| src/core/capture/previewDiagnostics.js | Proof: original-preview diagnostic allowlist/summary | CaptureProof.js, diagnostic tests | Drops content/URI fields; memory only |
| src/core/capture/syntheticPanDiagnostics.js | Proof: bounded pan evidence | synthetic viewer, gesture tests | Numeric/anonymous diagnostics only |
| tests/appVariants.test.js | Tests: identities, plugins and permissions | app.config.js | Existing public app IDs/configuration |
| tests/easCaptureproof.test.js | Tests: profile, exclusions and native-source preservation | eas.json, .easignore, config | Existing public owner/project UUID; no credential |
| tests/captureProof.test.js | Tests: route restrictions, measurement, guards and cleanup | proof route/helper | Synthetic cache paths only |
| tests/captureImagePreview.test.js | Tests: page/lifecycle/identity/stale event contracts | viewer, host, capturePreview.js, geometry | Synthetic local paths, not real captures |
| tests/gestureRuntimeProof.test.js | Tests: runtime-probe structure, ownership and diagnostics | synthetic viewer, host, geometry/diagnostic helpers | Synthetic state only |
| tests/previewDiagnostics.test.js | Tests: bounded retention, allowlists and safe summaries | previewDiagnostics.js | Synthetic privacy-rejection probes |
| tests/previewTransform.test.js | Tests: geometry, transitions, compiled/serialized worklets | previewTransform.js, installed Expo compiler tooling | Synthetic geometry only |
| docs/development/FC007B_CAPTURE_PROOF.md | Documentation: evidence, gates, procedures and design | complete proof milestone | Local paths, account/project/build IDs and public certificate fingerprints; not private signing keys |
| docs/development/TODO.md | Documentation: accepted/deferred status | proof notes | No credential material identified |
| docs/development/DEVELOPMENT_LOG.md | Documentation: historical decisions and validation | proof notes/tests | Same public metadata/local-path considerations as proof notes |

Configuration nuance: the development variant also receives the camera plugin
with microphone recording disabled; its configuration is not byte-for-byte unchanged
from HEAD, although development and production identities remain preserved. Default/
production config is returned unchanged. The route permits Android __DEV__ hosts,
not only the captureproof package; the physically validated host is captureproof.
Do not describe the route as package-ID restricted. Generated android/, .expo/
troubleshooting scripts and APKs remain outside the proposed commit.

No path needs unrelated-work deferral. Keep diagnostics, synthetic probe and original
preview in this milestone because they preserve the tested comparison and evidence;
removal/production cleanup requires later approval. Normal-development camera plugin
scope should be explicitly acknowledged at commit review, not silently removed.

Proposed grouping P1: all 25 exact paths above, one commit, suggested message
`feat: add isolated worksheet capture proof and gesture preview`.
Do not split helpers from their consumers/tests or split manifests from lockfile.
Proposed later grouping P2: separately authorized production contracts/repository
with tests and docs; P3: production host/viewer adaptation with tests and docs.
P2/P3 have no approved file list or implementation yet. Do not stage them now.

Before P1 authorization: recheck main/HEAD, exact 25-path inventory and empty index;
rerun full tests, focused proof/viewer/config/worklet tests, lint, relevant web export/
browser compatibility and secret/artifact/whitespace checks. Reconcile evidence with
owner Android records and inspect the exact staged diff only after staging approval.
Previous 53/53 focused and 343/343 full results are historical, not a Gate 3B rerun.
Neither the proof milestone nor a Git commit establishes production acceptance.

### Proposed minimum production capture/page contract

These are logical fields/invariants for owner review, not an assignment schema
extension. Use a separate versioned capture repository (SQLite metadata plus private
app-owned files on Android), not the existing household installation JSON envelope.
The current sqliteStore serializes household state with SecureStore credential
binding; indexedDbStore serializes the web household envelope. Do not put image bytes,
file paths or new credentials into those stores, and do not broaden their adapters.
Android capture need not imply a functional web camera/storage implementation.

| Contract item | Proposed minimum and invariant |
| --- | --- |
| Capture identity | Opaque stable captureId allocated once, independent of title, path, assignment ID or household credential; versioned record with positive monotonic captureRevision and CAS for changes |
| Page identity | Stable pageId within capture, independent of index; immutable assetId; reordering keeps IDs, retake creates a new asset/page identity rather than overwriting evidence |
| Local asset reference | Repository-owned opaque assetId resolving to a confined private relative file key; no caller-supplied arbitrary absolute path, traversal or network URI; UI receives short-lived file:// resolution only |
| Source geometry | Positive original pixel width/height in display orientation after capture processing, MIME type and byte count; preserve returned asset bytes unchanged after adoption; reject unsupported orientation/metadata rather than guess |
| Capture method | Fixed camera or document_scanner declaration; evidence of acquisition only, never a fidelity/confidence/approval claim |
| Page order | One ordered unique pageId list, resolving only owned committed pages; atomic revisioned reorder; no educational array-position associations inferred |
| Lifecycle | Proposed draft, saved and deletion_pending capture states; saved means recoverably committed image set only, not prepared, safe or approved; failures recorded separately, not mislabelled as saved |
| File ownership | Repository alone adopts, finalizes and deletes assets; viewer is read-only; source-linked assets retained while referenced; explicit reference ownership prevents cleanup deleting a live source |
| Retention | User-visible deletion policy and abandoned-draft grace period require approval; no invented automatic lifetime. Backup exclusions, orphan-reconciliation scope and storage limits must be approved before native/storage implementation |
| Loading errors | Host/repository distinguish unavailable asset, missing file, metadata mismatch and storage failure; viewer separately tracks loading/loaded/load_error with retry tokens. No fallback to a different page, silent deletion or assignment reset |
| Authorization | Student may begin capture without PIN. Capture access is not authority over existing parent-protected assignment details, correction, review, policy, approval or deletion of linked evidence. Exact saved-capture browsing/deletion policy remains an owner decision |

Temporary session data: camera/scanner return URIs, in-flight operation epoch, busy
flags, unfinished pages, current selection, zoom/pan, load tokens and diagnostics.
These cannot be treated as durable source records. A saved draft may be recoverable
across restart, but saving it is a deliberate repository operation, not session state
implicitly becoming an assignment. No raw image URI or diagnostic event needs to be
stored in assignment educational fields.

Persisted capture records contain committed manifest/page/asset references and capture
revision; future preparation records reference captureId/revision and page/asset IDs.
FC-007A already separates capture/preparation revisions from assignment contentRevision
and writeRevision. Its current sources are extracted text with UTF-16 span evidence,
not image regions or a verified pixel-to-text association. A future conversion service
must explicitly define image-to-extracted-source mapping and revision ownership;
do not claim the current preparation validator supplies it. Assignment-source links
and retention references require their own reviewed conversion contract, not an
automatic assignment-schema modification during capture work.

Recoverability proposal: create an uncommitted operation identity; copy returned
images to private staging; validate sizes/metadata; finalize immutable asset files;
commit a CAS manifest only when all required files exist. Filesystem and SQLite
cannot share one atomic transaction. Reconcile interrupted staging/finalized orphans
by repository-owned operation records; never delete unknown files or pretend a
missing referenced image was recovered. Mark deletion intent durably before removing
unreferenced owned files, then finalize metadata, with restart-safe retries. Referenced
source deletion policy is unresolved. No retention timeout or quota selected here.

### Responsibilities and trust boundaries

| Component | Owns | Must not do |
| --- | --- | --- |
| Production Capture Host | Camera permission, student capture flow, navigation, operation epochs, repository calls, resolved active page, local scroll recognizer and existing authorization where applicable | Manufacture approvals, treat route IDs as capabilities, persist raw session state as assignments |
| Capture Repository | Version validation, IDs/CAS, immutable file adoption, private resolution, ordered manifests, recoverability, retention references and cleanup | Grade/interpret images, normalize educational text, weaken household authorization |
| CaptureImagePreview | Read-only resolved page rendering, measured geometry, pinch/pan, Fit, buttons, load/error/retry and stale-event invalidation | Copy/delete/reorder files, approve, invoke OCR, store manifests or acquire authorization |
| Parent Review workflow | Existing protected field review/correction and explicit approval; fresh authoritative documents/revisions | Treat preview/load/capture success as acceptance or upgrade source fidelity |

Household service remains authoritative for student eligibility. Strict policy blocks
unapproved assignments; independent policy uses existing service eligibility rather
than approval alone. Captures themselves are never practice candidates under either
policy. Later trusted preparation/suitability enforcement must precede assignment
conversion; it is not implemented by this design. Parent approval and source fidelity
remain distinct. Preserve FC-005-06 transaction authorization and FC-005-07 selective
review semantics; viewing must not increment assignment revisions or review fields.

### Future gates and stop conditions

1. Repository contract: approve version/IDs, CAS, reference ownership, deletion/access
   policy, limits/retention, orientation handling and backup exclusions. Implement pure
   validation plus a separate repository only under explicit authorization. Test
   interrupted adoption, CAS conflicts, storage-full, missing/corrupt file, restart,
   orphan reconciliation and traversal rejection. Stop for assignment/schema or
   household-store changes not explicitly approved.
2. Production host: depend on repository acceptance and final scanner/fallback choice;
   implement student capture/preview/save/cancel and recoverable drafts only. Stop
   for unclear privacy/access rules, unsupported native APIs or practice coupling.
3. Viewer integration: depend on host/page contract and target-APK native evidence;
   adapt dev presentation/guards with unchanged accepted geometry and explicit stable
   page selection. Do not remove original proof viewer. Stop for global-screen or
   native/dependency changes outside separately approved scope.
4. Automated regression gate: repository failure injection plus viewer lifecycle,
   worklet serialization, real host contracts, navigation and entire FC-005/FC-006
   policy suite; lint, relevant export/browser and privacy/scope checks. Unit or
   source-pattern checks alone cannot establish pixel visibility/native operation.
5. Isolated Android gate: separately approve any build/signing/upload/install; first
   test isolated package without touching Dev data. Cover large/multipage images,
   scanner portrait/landscape limitations, retries, interruptions/restart/storage
   failures, Fit after pan/zoom, rotation, stale navigation and gesture accessibility.
   Stop on crashes, wrong identity/permissions/signature or data-integrity failure.
6. Promotion/fallback decision: owner accepts main-host evidence, separately approves
   a correctly signed data-preserving Dev update if required, then decides fallback
   retention/removal and production defect closure. Roll back host navigation/JS
   entry without deleting files or reinterpreting assignments. Native rollback must
   be reviewed; uninstall, clear-data and unverified signing replacement are forbidden.

Still requiring owner decisions: limits/page count and storage budget; abandoned
draft retention and referenced-source deletion; saved-capture browsing/access;
retake/replacement UX; image orientation representation; repository/assignment link
and partial-conversion retention; main-Dev native verification/update; final capture
method/fallback and eventual proof cleanup. No new parent preparation steps are
proposed. Two-minute parent involvement remains the product target. FC-007C OCR,
trusted enforcement, FC-008, TalkBack and eight Expo patches remain separate.

Status: READY FOR GATE 3B DESIGN AND MILESTONE REVIEW. No source, dependency,
native, signing, device or household-data changes; no build/upload/stage/commit/push.

## Gate 3A: production integration design review (2026-11-17)

Owner accepts Gate 2B and Gate 2C.2: Gesture Preview passed all nine reported
Android acceptance categories on Lenovo TB-J616F, Android 12. Pinch, pan and Fit
performed well. The original CameraView ScrollView comparison was reported failed;
its precise symptom is unconfirmed. Image disappearance is validated as addressed
in Capture Proof under tested conditions only, not closed in the production app.
This supersedes the pending Gate 2C.2 status in the historical implementation entry.
No production integration, original-preview removal or native build is authorized.

### Integration boundary and reuse

There is no production capture/image-review host yet: app/add-assignment.js remains
informational. CaptureProof.js owns temporary cache files, not a durable capture
repository. Do not promote that screen or its cache lifecycle into production.

- src/core/capture/previewTransform.js can retain its pure, worklet-compatible
  geometry and accepted 4% cumulative dead zone, 1-4x bounds and 1.25x controls.
  Preserve helper dependency ordering and serialized-worklet regression checks.
- capturePreview.js can retain file-page validation and asynchronous load-token
  rejection. Its array-reference selection and local-image-N diagnostics are proof
  conventions, not durable capture/page identity. A repository reread producing a
  new array currently selects page one. A production adapter must resolve stable
  capture/page IDs and make replacement/deletion reset semantics explicit.
- CaptureImagePreview.js supplies measured width/fixed 380-point viewport, aspect
  fit, one bounded transform, focal zoom, page/viewport/background Fit invalidation,
  explicit retry and stale callback suppression. Its current __DEV__ guard,
  comparison wording, original-preview error advice and diagnostic UI require
  an explicitly reviewed production adaptation; it cannot be reused unchanged as
  a release component. Keep proof diagnostics optional/local and preserve fallback.
- CaptureProof.js and GestureRuntimeProof.js remain development hosts. Reuse the
  local GestureHandlerRootView / Gesture.Native actual-parent-scroll relationship,
  not the capture implementation. Shared Screen.js and global navigation need no
  change under this plan. A future host must own the actual scroll recognizer.

### Image/page contract and lifecycle

Proof pages are {uri, width, height, bytes}, with file:// URIs into application cache,
ordered in one result array. Source dimensions come from Image.getSize; decoded
onLoad dimensions are diagnostic only. content:// is not accepted. The viewer's
React session key is URI; Fit never changes source or key. A future private-file
repository must supply a resolvable local URI plus positive source dimensions and
stable capture/page IDs. Never use an expiring cache path as durable identity or
silently copy/delete assets from the viewer. URI reuse for different assets must
not retain an old session. File ownership, retention and deletion remain repository
responsibilities, separately authorized before a durable production workflow.

Preserve explicit Previous/Next, one active image, Fit on page change and orientation
recalculation, and loading/error/retry states. Orientation changes do not imply an
orientation lock. Background/resume resets transforms, not files; route unmount
invalidates callbacks. Missing/deleted files must show a safe error without falling
through to another page or mutating the capture. Test large-image memory pressure
and restart/re-resolution separately: successful load callbacks do not prove pixels
are visible. Native layout ordering cannot be established when timestamps are absent.
Two-finger pan is the accepted implementation; one-finger enlarged-image panning
would be an additional interaction decision, not an implicit promotion change.

### Trust and native readiness

The viewer imports geometry/lifecycle helpers, React Native image APIs and gestures;
it issues no submission, review, correction, approval or practice commands. Rendering,
zoom and image load success cannot establish source fidelity, preparation suitability,
OCR confidence, parent acceptance or practice authorization. No OCR is triggered.
Keep future repository adapters separate from household services. Parent-protected
source viewing must remain behind existing parent lifecycle checks; a viewer must
not become a second authorization mechanism or reveal protected data after locking.

The lockfile currently resolves Gesture Handler 3.5.0, Reanimated 4.7.1 and Worklets
0.13.1 (transitive dependencies), with RN 0.88.1 / Expo 58.0.23. Capture Proof runtime
compatibility is physically demonstrated, including worklets. That does not identify
the modules/versions inside the installed com.frenchcompanion.dev APK. No verified
main-Dev artifact/runtime evidence was established in this gate. Inspect its artifact
and registration, then run a separately authorized isolated runtime check before
claiming Metro-only promotion is possible. Camera/file-system additions also require
a compatible native host for production capture. Any necessary main-Dev rebuild,
source upload, signing or installation needs separate authorization. Verify the
existing signing identity before any in-place update; never uninstall, clear data,
rotate credentials or use the proof certificate to replace Dev. Production dependency
ownership should be explicit rather than relying indefinitely on optional transitive
peers, but no manifest or lockfile change is authorized by this review.

### Proposed integration and acceptance gates

1. A — Owner approves target host and durable image/page contract, dependency/native
   evidence plan, viewport sizing and diagnostic policy. Implement only the approved
   host adapter and viewer presentation changes; preserve physics and proof fallback.
   If no durable capture repository exists, keep the host isolated rather than claim
   a complete production capture workflow. No OCR, assignment or trust-state changes.
2. B — Run geometry, serialized-worklet, image lifecycle, stale callback, selection,
   Fit/retry/orientation and navigation tests; full household/FC-005/FC-006 regressions,
   lint, relevant web/browser compatibility, export and scope checks. Confirm viewing
   performs no persistence writes, file deletion or approval/eligibility changes.
3. C — Separately authorize isolated Android host testing, and a native build only
   if installed-host evidence requires one. Repeat actual CameraView and scanner
   pages, multipage changes, arbitrary pan/zoom then repeated Fit, edge reversal,
   rotate/background/resume, retry/missing file, rapid navigation and memory pressure.
   Check surrounding controls and parent locking, with no household-data access.
   Record recognition and pixel visibility separately. Physical TalkBack remains
   unverified; accessible labels/buttons are not physical accessibility acceptance.
4. D — Owner accepts main-host results and separately decides fallback disposition.
   Only then close the production disappearing-image defect. Preserve the original
   proof preview until removal is explicitly authorized; clarify its reported failure
   symptom before attributing it to a particular native cause.

Stop for unexpected dependency/native/global-screen requirements, authorization or
source-fidelity changes, file ownership ambiguity, wrong package/signing identity,
new crashes or unverified host compatibility. Roll back the future JS host entry to
its prior informational/accepted flow without deleting captures; keep the proof
comparison available. APK rollback is not assumed safe through uninstall/downgrade:
signing/data-preserving recovery must be reviewed before an update.

### Git and outstanding decisions

Gate 3A starts on main at 539e8ce0b9391440954c4f5f9e4a1c233d5f6ac5 with 25
uncommitted paths and an empty index. These comprise proof/EAS configuration and
dependencies, development entry points, reusable viewer/helpers, diagnostics,
regression tests and development documentation. No unrelated tracked change was
identified. Generated native projects and .expo artifacts stay excluded. Do not
commit only the viewer while omitting its helper/worklet and lifecycle tests.
Propose a reviewed coherent proof milestone first, with explicit native/config
scope; keep later production adaptation in a separately authorized commit. No
staging, commit or push is part of this review.

Owner decisions still required: durable capture integration timing/host, installed
Dev verification and any build/update authorization, production viewport/control
presentation, diagnostic visibility, and final fallback removal. Scanner remains
leading candidate with CameraView fallback candidate, not a final production choice.
Portrait is a device-verified scanner workaround; landscape privacy-panel limitation
remains. OCR suitability, FC-007C/trusted enforcement, FC-008 history, physical
TalkBack and eight deferred Expo patch recommendations remain separate work.

Gate 3A modifies development documentation only. Previously reported automated
evidence is 53/53 focused and 343/343 full with lint; it is not a new test run or
proof of main-Dev runtime compatibility. Status: READY FOR GATE 3A DESIGN REVIEW.

## FC-007B Gate 2C.1: controlled worksheet viewer implementation

Owner accepts Gate 2B after reported 2B.4 Android usability results: horizontal/vertical
and diagonal pan PASS; pinch recognition PASS with 5/5 first-attempt successes;
unintended zoom, bounds/reversal, Fit, restart/near-edge recognition and shape/control
tests PASS; overall comfort COMFORTABLE. No inferred total attempt count. This
supersedes earlier blocked/pending synthetic records below. Gate 2C.1 implementation
authorized; Gate 2C.2 actual-image acceptance pending. No production promotion.

CaptureImagePreview.js is a reusable development-only local-file viewer receiving the
existing page object, page number, opaque image alias, method and parent recognizer.
It uses approved previewTransform physics and the same simultaneous pinch/two-finger
pan, averaged pointers, single translation owner, native-scroll blocking and rebasing
as accepted synthetic proof. Central 4% cumulative dead zone, 1–4x bounds and 1.25x
button steps unchanged. New gate only adds image loading/rendering integration.

CaptureProof defaults to Original ScrollView Preview and exposes two explicit dev
comparison controls. Its original preview block is preserved verbatim, including
Enlarge/Fit, all-page display and existing diagnostics. New Gesture Preview displays
one active page with Previous/Next, preserving existing array order and URI identity.
New captures immediately select page1; switching modes retains selected page for the
gesture viewer and never changes capture data. Returning to it starts Fit. Both modes
read identical cache files. Hash comparisons confirm capture run function and original
preview block unchanged. No camera/scanner settings, file adoption or cleanup changes.

New viewport has fixed 380-point height and measured width. Metadata from capture
Image.getSize drives geometry; native image onLoad dimensions are diagnostic only.
Image uses memoized source URI with aspect-contain rendering inside one transformed
view. Fit/pan/zoom/layout never change image key or source identity. Only actual page
change, explicit retry or development lifecycle remount creates a new image lifetime.
Image decodes are asynchronous; no extra copies, prefetch, export or file writes.

createImagePreviewLifecycle in capturePreview.js tracks per-session load tokens,
success/error, retry, bounded stale-event counts and at most40 anonymous events.
Source URI is used only for Image and React page identity, never diagnostic output.
Opaque local-image-N aliases are scoped to a single capture result, not global IDs.
Old-page callbacks target closed lifecycle objects; retry tokens reject late events
from previous load requests. Old UI deliveries are suppressed when closed or out of
serial order. Transform generations invalidate pre-Fit/layout/background callbacks.
Window-size changes reset Fit even when max-width keeps viewport width unchanged.
Background and active return both reset Fit; unmount invalidates state and removes
listeners. Missing layout timestamps cannot establish native event ordering and remain
an observation limit. No imperative parent-scroll toggling; shared Screen unchanged.

Controls are labelled >=48-point targets; gestures/zoom wait for loaded status, zoom
buttons stop at bounds, errors are safe messages with explicit retry. Loading/error
UI does not remove a successfully loaded image during Fit. Diagnostics distinguish
source/fitted/transformed/viewport dimensions, scale/translation/limits, reset reason,
JS session mounts/unmounts, native load-start/success/error, retries and rejected
events. A bounded last10 report summary persists in CaptureProof for mode/page switch
comparison. Session mount counts are not native pixel visibility evidence. No image
paths, raw native error payloads, worksheet text, logging, transmission or persistence.

Automated verification: focused image/geometry/gesture/worklet53/53; full343/343;
lint passed. Includes local-source validation, frozen page-order/identity selection,
load/error/retry and stale callback guards, strict lifecycle reentry, old timestamps,
bounded/private diagnostics, Fit/zoom/orientation/background resets, unchanged gesture
bindings, stable image-key/source contracts, retained fallback and Expo compiler checks.
Existing serialized-helper execution coverage remains. Component wiring tests cannot
prove image decode, visible pixels, native event timing, TalkBack or Android comfort.
No extra APK expected: only existing React Native/Gesture Handler/Reanimated modules.

Gate 2C.2 Android protocol (owner testing only; no additional build authorized):
1. Reload correct captureproof Metro client. Use a non-identifying printed page, capture
   with CameraView, leave capture files in existing proof cache. Confirm metadata.
2. Original ScrollView Preview: Enlarge, manipulate/scroll, Fit. Record any disappearance.
3. Select New Gesture Preview on SAME capture. Wait for loaded. Zoom buttons/pinch to
   enlarge, pan both axes/diagonally where bounds allow, Fit. Repeat three times, including
   Fit after substantial pan. Image must stay visible; Fit=centred1x. Native load-start
   count should not increase just from Fit; report any image error/reload or blank pixels.
4. Verify natural-speed pinch/4% pan stability, near edges, reversal, outside scroll and
   controls. Try Fit while gesture is active if practical; stale motion must not undo it.
5. Use scanner in portrait (verified device workaround), scan 2–3 pages. Repeat original
   disappearing-image sequence and new-viewer zoom/pan/Fit on each active page. Previous/
   Next must preserve order, reset Fit and show correct page; rapid switching while
   loading must not reveal previous image or inherit its transform. Compare same files
   with original fallback; no new scan needed merely to switch viewer.
6. Rotate preview and background/resume: verify Fit/reset and usable scrolling. On route
   exit/re-entry verify safe loading/controls; a retained stack instance need not remount,
   and this temporary proof does not add capture persistence. No household interaction. Source metadata
   and page order must remain unchanged. Explicit cleanup remains existing clear action;
   do it only after evidence recorded and temporary images no longer needed.
7. If blank/crash/warnings occur, stop and record method/page alias, source/viewport/fit/
   scale/translation/bounds, reset reason and load counts (no URI or worksheet uploads).

Do NOT declare original disappearance resolved until actual Android image testing.
Native texture/decoder memory and Fabric clipping remain physical verification risks.
Physical TalkBack remains deferred/unverified. Scanner landscape notice limitation,
OCR suitability, production capture/storage and final method selection remain separate.
Keep fallback and synthetic proof; no promotion/removal without separate approval.

## FC-007B Gate 2B.3: geometry/state consistency verification pending

Owner could not complete 2B.2: apparent shape changes, fitted 38x300 at one point,
225x300 with X0/Y158.5 at another, and earlier 640x300 viewport/225x300 fitted with
X480/Y450. Exact source identity, scale and event sequence were not captured together.
Smoothness appeared improved. Suspend broad testing; Gate 2B blocked, Gate 2C unauthorized.

Mathematics for viewport 640x300 and fitted portrait 225x300:

| Scale | X limit | Y limit | Transformed dimensions |
| --- | --- | --- | --- |
| 1 | 0 | 0 | 225x300 |
| 2 | 0 | 150 | 450x600 |
| 4 | 130 | 450 | 900x1200 |
| 617/300 (about 2.056667) | 0 | 158.5 | 462.75x617 |

Thus X0/Y158.5 can be valid if that scale/viewport apply; the actual historical scale
remains unknown. X480/Y450 is impossible for that portrait geometry under approved
max 4x, but exactly matches LANDSCAPE fitted 400x300 at 4x. This is a compatible
alternative/mixed-reading hypothesis, not proof of what occurred. Intentional tall
source 200x1600 fits to 37.5x300 (formerly displayed rounded to 38x300). Rounded 38
is not itself corruption. Fit geometry and transformed/cropped appearance differ.

Code findings: shape index changes only in the explicit Next handler (or initialization/
reload); gesture helpers preserve geometry/page identity. The old shape label read
current React page while numeric geometry used completion snapshots; Last pan could
belong to a prior generation. This is a confirmed display-consistency gap, not a
confirmed cause of unexpected source transitions. Queued geometry work lacked explicit
request ordering; missing native timestamps prevent proving all native layout ordering.

Minimal changes: preserve source dimensions alongside aspect-fit metadata; one worklet
geometrySnapshot captures source identity/ratio, viewport, fitted and transformed sizes,
scale, X/Y, calculated bounds, generation, owner and last reset/geometry reason from
the SAME model object. Serial ordering rejects old JS deliveries. Display formatting
uses only that snapshot, never the current React shape. Snapshot is completion/request
sampled, not live during gestures; Read current geometry snapshot samples UI state
explicitly. Historical pan summary is marked with its generation. Shape-button counter
records handler invocation, not proof of deliberate user intent. Fast Refresh legacy
display state is safely treated as awaiting refresh, not formatted as current metadata.

Geometry requests carry increasing serials; older queued requests cannot overwrite
newer geometry. Layout acceptance checks current selected shape, finite dimensions and
monotonic native timestamp when supplied. Missing timestamps cannot identify stale
same-shape native measurements; report that limit, do not infer freshness. Identical
viewport sizes don't reset Fit; shape/layout changes record their reason and reset
Fit atomically with new geometry. Gesture generation invalidation remains. Fit/zoom/
background reasons are distinct and preserve last geometry-update reason. Gesture
arbitration, ownership, sensitivity and source presets are unchanged.

Tests: exact requested limits, legitimate tall preset, source/aspect transitions, Fit
and reset provenance, stale gesture/geometry requests, stale page/layout callbacks,
native timestamp limitations, pointer metadata invariance, non-overflow centring and
single-snapshot text consistency. Existing compiler and serialized execution checks
now exercise geometry updates and snapshot limits too. Focused 41/41; full suite
331/331; lint passed. No worksheet/capture/file/native/dependency/build changes.

Limited Android verification ONLY:
1. Fully Reload; verify Gate 2B.3 geometry snapshot v1.
2. Do not press Next yet: initial source should be portrait 900x1200. Tap Read current
   geometry snapshot and record the entire captured-state block and shape-button count.
3. At viewport 640x300 expect fitted 225x300, Fit scale1, X/Y limits0. Different viewport
   is permitted: record actual values, don't force them to match this reference.
4. Press Test UI worklet once from Fit (known 2x), then Read snapshot. For reference
   viewport expect X0/Y150, transformed450x600. Horizontal pan intentionally unavailable.
5. Perform ONE controlled vertical two-finger pan, release, Read snapshot. Shape/source
   and fitted dimensions must remain the same; only bounded Y/transform may change.
6. Press Next ONCE and Read snapshot. Expect landscape1200x900, fitted400x300 at reference
   viewport, scale1/X0/Y0, shape-button count1 and shape-button geometry/reset reason.
7. Without Next, press Read again; identity/source must remain stable. No broad testing.

If appearance/identity changes unexpectedly, STOP, do not press Next to restore it;
press Read and provide the full state block plus shape-button count and immediately
preceding action. State target/snapshot does not prove native pixels. Existing APK/
Metro expected sufficient; native cause and original preview disappearance unresolved.

## FC-007B Gate 2B.2: pan-path diagnostics, not a behavioural correction

Owner smoke results accept 2B.1 crash correction: loads, square 4x, pinch and Fit
work; horizontal/vertical pan fail. Pinch occasionally needs repeated attempts.
Gate 2B remains blocked, Gate 2C unauthorized; full acceptance must not resume yet.

Inspected current component/helpers and installed Android pan/pinch event builders.
Those builders emit translationX/Y and numberOfPointers; live device event values
are not established by that source inspection. Deterministic square-at-4x geometry
has nonzero X/Y bounds for this <=640-wide, 300-high surface. Styles read translation
from the same model that helpers update; all synthetic children are inside the
transformed rectangle. None proves actual touch delivery or pixel displacement.

Comparison: accepted Gate 1C directly wrote pan shared X/Y from native translation.
Gate 2B routes through generation guards, cursor rebase and a single translation
owner. A pinch owner suppresses pan updates until pinch finishes; subsequent pan
samples rebase before applying deltas. This is an intentional new dependency, not
a confirmed cause of this Android failure. No exact root cause established; no
speculative geometry, dead-zone, activation or ownership correction applied.

Gate 2B.2 adds fixed-field syntheticPanDiagnostics: at most 999 updates/raw changes/
applied changes, invalid-input, pinch-owned, stale-generation, low-pointer and rebase
counts; bounded last raw translation, pointer count and owner. Sampling is pure,
immutable and runs on the UI thread. A new per-pan sample starts on activation;
only finalization sends the summary to JS. No per-frame React update or event log.
Existing begin/active/finalize counters remain. Viewport/fitted dimensions and
calculated JS pan limits from the UI snapshot are shown separately. Style target
is the sampled model translation, not proof of native pixel movement. No URI/text/
image/household data, persistence or uploads. Original previews/capture untouched.

Tests demonstrate that raw motion plus pinch ownership can yield zero applied pan,
distinguish movement, stale/pointer/rebase paths, bound counts and discard private
payload fields. Diagnostics also execute after Expo Android worklet compilation.
Prior geometry/serialized tests proved helper operations for supplied event sequences;
they did not reproduce actual native event ordering, owner transitions or rendering.
Unknown device failure cannot yet be claimed reproduced or fixed by automated tests.

Android smoke: fully Reload; verify Gate 2B.2 pan diagnostics v1. Select square and
zoom to 4x. Record viewport/fitted sizes and calculated X/Y limits (both should >0).
Pan horizontally once, release and copy Last pan plus begin/active/finalize deltas;
report visible motion separately. Repeat vertically. Pinch intentionally once: if
it fails, record surface-touch and pinch begin/active/finalize deltas; do not repeatedly
retry without recording. Fit; check outside scrolling/tap pad/surrounding control.

Interpretation: no begin/active points to recognition/delivery; zero updates despite
active needs callback investigation; raw changes with pinch-owned rejects implicate
ownership; stale/low-pointers/rebases identify different guards; applied/style-target
changes without visible movement need rendering/reference observation. Fit-to-zero
or zero bounds is not a gesture failure. Root cause and intermittent pinch remain
pending evidence. No new APK expected, no build/native/dependency work authorized.

Verification: focused 33/33 including compiled/serialized checks, full suite 323/323,
lint passed. These are diagnostic/isolation regressions, not Android acceptance.

## FC-007B Gate 2B.1: captured worklet dependency correction

Owner Android report: uncaught undefined-is-not-a-function at previewTransform.js
1:370; Gate 2B acceptance blocked, Gate 2C not authorized.

Confirmed local mechanism: updateTransform appeared before rebaseTransform. Standard
Node function declarations are hoisted, but worklet transformation creates factories
that capture dependency values while the module initializes. Expo Android/Hermes
preset output captured undefined in updateTransform.__closure[0], the rebaseTransform
slot. The serialized call rebaseTransform(state,generation,owner) occupies columns
355–394 in reconstructed original output, including reported column 370. Executing
the original compiled one-pointer branch reproduced rebaseTransform-is-not-a-function.
This is a JS compilation/capture-order defect, not evidence of an unavailable Math
API or missing Android native module.

Minimal correction: move rebaseTransform before updateTransform, with an ordering
comment. No geometry, dead-zone, bounds, gesture, ownership or preview behaviour
redesign. Existing 4% cumulative mapping and all trial constants unchanged.

Prior tests used untransformed CommonJS functions (where declaration hoisting works)
and only checked that worklet compiler output contained hashes. They never evaluated
the compiled captured closures. New regression fixtures reproduce bad capture order
and show ordered capture succeeds; actual Expo-compiled exports are checked for missing
dependencies, then serialized bodies are executed with recursively rebuilt closures.
The pointer-count transition test failed before correction and passes afterward.
This VM harness models compiler/capture semantics; it is not Hermes or Android proof.

Verification: 29/29 focused geometry/gesture/compiler checks; 319/319 full regression;
lint passed. No native/dependency/build changes; existing APK/Metro expected sufficient.
Gate 2B.1 Android smoke pending, not accepted. Full Gate 2B testing must wait for smoke.

Smoke: fully Reload the captureproof client (not just Fast Refresh), confirm Gate 2B
geometry trial v1 loads. Select square synthetic shape; Zoom in to 4x so BOTH axes
overflow. Pan once horizontally, once vertically, pinch intentionally, then Fit.
Expect no crash, visible movement/zoom, centred 1x after Fit. Report results; if any
error returns, stop and provide complete error/call stack and action that triggered
it, without worksheet content. No worksheet capture needed; original previews untouched.

## FC-007B Gate 2B: pure geometry and synthetic stability implementation

Implemented only geometry and the synthetic surface, not worksheet integration.
previewTransform.js exports PREVIEW_LIMITS (1–4 Fit scale, 1.25 zoom step, 0.04
dead zone), aspectFit, fitTransform, panBounds, clampTransform, pinchRatio, zoomAt,
resetPreview, beginTransform, updateTransform, endTransform and rebaseTransform.
Helpers are pure immutable CommonJS exports with worklet directives; no React/native,
capture, persistence or worksheet dependencies. Invalid/zero layout waits without
usable geometry; dimensions smaller than viewport upscale to aspect Fit.

Fit centres the aspect-sized rectangle. At scale s, each pan limit is
max(0,(baseSize*s-viewportSize)/2); non-overflowing axes remain centred. Translation
is screen-point displacement applied outside scale. Focal zoom maps the image point
under the old focal coordinate to the new one, then clamps to valid coverage.
Boundary cursor advances even during overshoot: reversing immediately moves inward.

Cumulative log-space dead zone: effective ratio =
exp(sign(log(r))*max(abs(log(r))-log(1.04),0)). r is relative to the current
two-pointer baseline, not individual frame change. Mapping is continuous at 1.04
and 1/1.04; hundreds of small changes can cross it. Neutral-zone centroid movement
still pans without changing scale. Beyond-threshold unintended variation can still
zoom: comfort/stability requires physical acceptance, not only numeric continuity.

The single state has geometry/page identity, transform, generation and one translation
owner. Pinch takes precedence; pan updates/finalize cannot add to or clear pinch's
transform. Finger changes clear/rebase the cursor; first subsequent sample retains
the transform. Gesture begins capture a generation. Fit, zoom controls, synthetic-page
shape, layout/background/unmount resets increment it, rejecting old begin/update/end.
Repeated Fit yields the same visible transform (generation intentionally advances).
Callbacks returning to JS ignore an older generation than the displayed one.

Gate 1C native parent-scroll ownership, simultaneous handlers, stable recognizers and
bounded counters are retained. Per-frame updates stay on the UI runtime; reports are
completion-only. The source shape and viewport use a single model shared value, so
geometry and transform change together. Fixed viewport is 300 points high with measured
width. A plain synthetic rectangle/crosshair, not an image asset, displays the model.
Portrait/landscape/square/tall selectors affect this synthetic test ONLY. Existing
capture results, original ScrollView previews, page ordering and cleanup unchanged.
One-finger enlarged panning/new worksheet viewer are not part of this gate.

Validation: Node 22 focused geometry/gesture tests 27/27; full regression 317/317;
lint passed. Includes installed worklet compiler transformation, extreme/small geometry,
four-edge coverage, focal reference coordinates, cumulative dead zone/continuity,
single owner, pan/zoom limit reversal, pointer restart/handover, immutable inputs,
Fit-during-gesture and stale/page/viewport invalidation. Static gesture tests establish
wiring only; compiled worklets do not establish actual Android smoothness.

Android preparation (no worksheet required): reload existing captureproof Metro client
and confirm Gate 2B geometry trial v1. Select square synthetic page for easier two-axis
testing; press Zoom in until 4x. Pan horizontal/vertical/diagonal slowly and naturally,
at centre and near region edges; verify no parent takeover, immediate reversal at limits
and no blank strips on overflowing axes. Move both fingers together with normal small
separation variations: assess unintended magnification independently from smoothness.
Fit, then intentionally pinch out/in at normal speed. Gently vary separation around
the neutral band then pass it: expect no abrupt scale step, not a requirement to measure
4% by hand. Zoom buttons allow checking/returning to a known scale. Numbers update on
release; scene updates live. Record scale before/after stable two-finger pans.

Fit from arbitrary zoom/pan repeatedly; if practical hold gesture fingers down and use
another finger on Fit, then continue old motion: old gesture must not undo Fit. Test
lifting/replacing fingers, cancellation, navigation away/re-entry and background/resume.
Cycle synthetic shapes and rotate viewport: each resets Fit, without inherited pan.
Tall/non-overflowing axes correctly have no pan until sufficiently enlarged. Verify
one-finger outside scrolling, tap pad and surrounding controls. Report recognition,
smoothness, scale drift, bounds, reset results and warnings separately. Original
worksheet-image disappearance remains unresolved/unmodified by this gate.

Existing APK and Metro expected sufficient; no native/dependency/EAS changes. Physical
Gate 2B pending. No worksheet-preview integration authorized; trial 4% remains subject
to owner usability acceptance. TalkBack and unrelated deferred work remain unchanged.

## FC-007B.3 Gate 2A: proposed unified preview design (not implemented)

### Accepted evidence and scope

Owner accepts Gate 1C technical proof on Lenovo TB-J616F/Android 12: all attempted
horizontal/vertical/diagonal pans, pinch and near-edge gestures recognized; horizontal,
vertical, pinch and edge motion smooth; minor diagonal hesitation. No parent takeover;
outside scroll/controls worked; failed/cancelled counters increased; no warnings/errors.
These counters include gestures that did not win/activate and are not alone defects.
Critical finding: tiny finger-separation changes during two-finger pan caused unwanted
zoom. Gate 2A authorizes design/documentation ONLY. No viewer implementation authorized.

Current code directly multiplies saved scale by every reported pinch scale while pan
runs simultaneously. Incidental span variation therefore directly changes magnification;
relative sensitivity also increases for a small starting finger span. This explains
the coupling in code; device-specific perceived severity is the owner's observation.
Minor diagonal hesitation has no confirmed separate cause. Original disappearing-image
native cause remains unconfirmed; the new design removes dependence on native image
ScrollView offsets rather than claiming to diagnose or fix that native implementation.

### Zoom stability alternatives and recommendation

A: continuous scale dead zone, proposed +/-4 percent in log-scale about each new
two-pointer baseline (ratio thresholds 1.04 and 1/1.04). Define z=log(span ratio),
d=log(1.04), effective ratio exp(sign(z)*max(abs(z)-d,0)). This is continuous at the
threshold, symmetric for zoom in/out, and uses total gesture-relative change, NOT
independent per-frame deltas (which could suppress a slow intentional pinch forever).
Centroid translation remains live inside the dead zone. No forced slow movement,
no timers, no latch requiring release to change intent. Downside: slight initial
travel before zoom and a neutral band near the baseline on reversal. This filters
bounded incidental variation, not every possible unintentional zoom. Four percent
is a proposed trial constant, not device-validated or a shipped policy.

B: explicit intent arbitration comparing centroid movement with span change, then
locking to pan or zoom. Stronger pan stability, but ambiguous diagonal gestures and
transitions can be classified incorrectly; a hard lock forces finger release or
extra reclassification logic. Higher complexity and harder child predictability.
Useful fallback only if A cannot meet usability acceptance; not proposed initially.

C: lower sensitivity (e.g. scale ratio exponent <1) or temporal low-pass smoothing.
Reduced gain keeps direct response but requires more travel and still permits drift;
time smoothing introduces lag and release/convergence questions. Neither separates
intent on its own. No temporal filter proposed for first implementation.

Recommend A alone first; do not stack several unmeasured tuning mechanisms. Zoom
buttons bypass the dead zone. Acceptance must include two-finger pans with incidental
span variation and natural-speed intentional pinch; record subjective controllability
separately from recognition. Do not promise zero zoom for variations above threshold.

### Proposed interaction contract (owner confirmation required)

- One measured viewport and active page, explicit Previous/Next controls. These only
  select existing ordered page references; they never reorder or modify the manifest.
- Viewport uses available measured width and a bounded height chosen from available
  window height; stable while gesturing, no source-pixel-sized native scroll content.
- At Fit, one finger does not pan the image. Initial simplest ownership proposal:
  viewport reserved for image interaction, page scrolling starts OUTSIDE it, as in the
  accepted proof. Allowing one-finger parent scrolling from inside Fit is an optional
  alternative requiring separate ownership validation, not silently promised here.
- Enlarged: one-finger drag pans. Two fingers pan at all scales where image bounds
  allow, with dead-zone filtered pinch. At Fit, pure pan has no visible effect because
  there is no overflowing image. Start region is entire viewport, not visible ink.
- Only one transform writer owns translation at a time: one-pointer pan or two-pointer
  controller. Before pinch activation, two-pointer pan can own translation; on pinch
  activation rebase current transform/focal point, then pinch centroid drives both
  axes and zoom. Concurrent pan must not add the same centroid movement again.
- Adding/removing fingers rebases at current values, avoiding jumps. No inertia or
  rubber-band overscroll initially. Bounds stop motion without handing an active
  drag to the parent; reverse direction immediately moves back. Clamp/rebase at limits
  so out-of-range accumulated movement does not create a sticky return distance.
- Proposed scale range 1–4 relative to Fit. Zoom +/- uses x1.25 or /1.25, centred on
  viewport, then clamps. Fit and page changes reset scale=1, tx=ty=0. Controls outside
  detector have readable labels, >=48-point targets and disabled states at bounds.
- Fit is idempotent and interrupts gestures. Fit/page/viewport change advances a
  generation; late callbacks from old generations cannot restore stale transforms.
- Viewport/orientation changes recompute geometry and reset Fit. No orientation lock.
  Scanner's portrait workaround remains separate; landscape scanner limitation remains.

### Geometry and component boundaries

Proposed new src/core/capture/previewTransform.js: pure, worklet-compatible geometry
and deterministic transform helpers, no React/files/storage. With image iw/ih and
viewport vw/vh, base factor=min(vw/iw,vh/ih), base width/height=iw/ih times factor.
Reject nonfinite/nonpositive geometry and wait for valid dimensions. Translation in
viewport points, scale about image centre: limitX=max(0,(baseWidth*s-vw)/2), similarly Y.
Clamp each axis independently; letterboxed axis stays centred until it overflows.
Focal anchoring: q=(f0-centre-t0)/s0, new translation=f-centre-s*q, then bound clamp.
Use focal coordinates only after activation; clamping near edges necessarily limits
exact focal preservation. Dead-zone mapping supplies s; centroid change supplies f.
Render using an explicit transform order matching this screen-space translation model;
test it against known reference coordinates, not just helper self-consistency.

Proposed src/components/CaptureImagePreview.js: reusable image+viewport+accessible
controls, props pageKey, local URI, source dimensions, parent scroll recognizer and
optional development-only observer. No camera/scanner/file repository/approval logic.
It receives an opaque stable page key, handles measured layout, loading/error/retry
and transform reset; generic page labels must not expose URI. Keep viewport geometry
stable during image load. On source change, clear prior visible image/loading state;
ignore old onLoad/onError callbacks using identity/generation. Show safe errors without
raw URI/native error text. Invalid dimensions or zero layout disables gestures/zoom.

CaptureProof.js retains acquisition, ordered page array, metrics and cleanup; adds
active page selection and integrates the viewer. Existing local root and actual
ScrollView Gesture.Native remain; related viewer recognizers share that root and
explicit external blocking relation. No imperative scroll disabling and no shared
Screen/global navigation change. Keep raw camera/scanner operations untouched.
GestureRuntimeProof stays as independent regression proof, not reused as production
geometry. UI worklets/shared values own all per-frame transforms; React receives only
loading, page and infrequent completion summaries. Stable recognizers, fixed-size
controls and diagnostics below viewport prevent layout churn during interaction.

Existing versions/APK contain Gesture Handler 3.5.0, Reanimated 4.7.1, Worklets 0.13.1;
Gate 1C now demonstrates runtime integration. Existing Metro delivery expected, no
dependency/native config/new APK required. No package changes proposed. Native scroll
coordination is Android-proven for proof, not asserted identical on web; web must have
separate compatibility checks and usable controls without false gesture claims.

### Diagnostics, lifecycle, privacy and rollback

Preserve existing bounded diagnostics and original preview instrumentation until
implementation approval explicitly permits adapting integration. New observer records
anonymous page ordinal, generation, viewport, mode, scale/translation and bounded
lifecycle/failure categories at completion, not worksheet text, URI or raw errors.
No per-frame JS logging, persistence, analytics or uploads. Load does not prove pixel
visibility; physical retest remains mandatory. Keep observer below viewport.
On unmount/background, invalidate active generation and gesture ownership; on resume
reset Fit for this temporary viewer. No file write/copy/delete or ownership by viewer;
existing cleanup remains capture owner's responsibility. Switching pages doesn't
delete assets. Preserve stable IDs, ordering and original bytes. Component unmount
must ignore late image/worklet deliveries and must leave parent scroll usable.

Rollback: retain old preview implementation during bounded development acceptance,
selectable by a development-only switch or a small integration revert, never both
active simultaneously. No persistence/asset migration; Metro rollback without APK
replacement. Do not claim old preview is defect-free. Remove fallback only under later
approval after Android acceptance. No commits/checkpoint operations authorized here.

### Proposed gates, tests and effort

1. Approve interaction choices/constants and geometry contracts. Implement pure helper
   with focused tests ONLY if separately authorized.
2. Bounded synthetic stability/ownership validation using the new transform controller:
   confirm dead zone, one-pointer enlarged pan, two-pointer handover and Fit interruption
   at natural speed before integrating worksheet images. Owner Android usability gate.
3. Separately authorized captureproof integration: image load/error, existing page
   selection, Fit/zoom controls, bounded observer. No production capture repository.
4. Full automation/lint/web regression and Android image acceptance; owner approval
   before calling the new preview accepted or finalizing production capture choice.

Pure tests: aspect fit for portrait/landscape/extreme ratios, invalid/zero dimensions,
letterbox/pan bounds, screen-space transform order, focal anchoring and edge clamps,
dead-zone symmetry/continuity and cumulative slow increments, limits/reversal, pointer
handover, idempotent Fit, generation invalidation, page/orientation reset, immutability.
Configuration/integration tests: parent relation, simultaneous callbacks have only one
translation writer, continuous UI-only updates, accessible buttons/disabled states,
late load/error suppression and unmount, no storage/file/capture mutation. Static tests
alone cannot establish native pixel visibility or gesture timing.
Android: original A/B/C image-disappearance sequences on photo/scanner/multiple pages;
repeat zoom/pan/Fit rapidly, Fit mid-gesture, page changes mid-load, portrait/landscape,
all pan directions, region edges, pointer addition/removal, reverse at bounds, background/
navigation/resume, surrounding scroll/controls; assess magnification stability and
diagonal smoothness separately. No stale page/transform or parent takeover. Verify
original asset count/order/metadata/bytes unchanged by preview, cleanup still works.
Accessibility: readable labels/contrast, 48-point controls, non-gesture zoom/Fit/page
navigation, sensible focus and no continuous announcements. Physical TalkBack remains
unverified/deferred to prepublication; never mark it passed from static checks.

Planning estimate: 3–5 development days plus owner test turnaround, split into above
gates. Main risks: dead-zone preference, duplicate transform writers, pointer transitions,
scroll ownership and image-memory/rendering performance; bounded increments and real
device acceptance mitigate them. Maximum zoom/viewport size require readability testing.
No OCR suitability, final capture-method selection or production readiness claim.

Approval questions: 4% trial dead zone; Fit-relative max 4x and 1.25x buttons; one active
page with Previous/Next; reserve viewport at Fit versus permit inside-to-parent scrolling;
Fit reset on page/orientation/background; development-only fallback retention. All are
proposals, not newly implemented or accepted requirements. Gate 2 remains unauthorized.

## FC-007B.3 Gate 1C: local ownership/smoothness correction

Owner Gate 1B: slow centre pinch/pan 2/2 each; natural centre 2/2 each;
slow edge 0/2 each; natural edge 2/2 each. Total 12/16, natural 8/8, but
vertical drags scrolled the parent; response felt staccato. Controls worked,
no warnings. Gate 1B NOT passed. Runtime compatibility is demonstrated.

Evidence: existing simultaneous relation joined only pinch and pan, not the parent
RN ScrollView. Parent vertical takeover demonstrates competing ownership; it does
not establish every cause of staccato/edge failures. UI styles were already driven
by shared values, not JS reporting. Gesture-relative restarts and +/-70 clamp could
look like jumps/stops; diagnostic rerenders/layout were additional plausible factors.

Gate 1C gives only CaptureProof a local root/native ScrollView recognizer. The
experimental pinch/pan block that external scroll recognizer while they compete for
touches inside the region; outside touches retain scrolling. Shared Screen/navigation
are unchanged. No imperative scrollEnabled toggling or restoration state. Native
gesture state resolves completion/failure/cancellation. All related handlers share
the top proof root; existing inner roots are retained and normally ignored.
Recognizer/callback identities are stable. Pan averages the two fingers and offsets
from its saved start; pinch multiplies saved scale. Both remain bounded experimental
geometry. Per-update worklets only set shared values; numeric JS reports occur on
finalize/button, counters remain bounded. Counters moved below the surface to avoid
their text growth shifting its position. Success/failed-or-cancelled counters added.
Original diagnostic marker retained; current marker is Gate 1C ownership trial v1.
No source-image preview replacement, capture/file/order/cleanup changes.

Android retest through existing Metro client, portrait, pale region fully visible:
twice each at slow and natural speed, pan horizontal/vertical/diagonal and pinch
out/in. Include starts near the REGION edge, both fingers inside. Reverse direction
when pan reaches +/-70 or scale reaches 0.5/2; stopping at a bound is expected.
Report recognition separately from smoothness, any page movement, and success/
failed-or-cancelled counters for failures. Then scroll outside with one finger,
press surrounding control, interrupt one gesture by lifting fingers/navigating away
and re-enter. No warnings, lost controls or stuck page scroll should occur.
Acceptance requires continuous normal-speed movement, all pan directions, pinch,
no parent takeover while active and usable outside scrolling/controls. Native runtime
behaviour is pending owner acceptance; no new APK expected. Gate 2 not authorized.

## FC-007B.3 Gate 1B: reliability comparison pending

Owner Gate 1A evidence confirms current APK compatibility: diagnostic bundle loaded;
button UI worklet visibly changed the tile and completed; JS tap begin/success,
surface touch and pinch/pan begin/active/finalize registered. Outside scrolling and
control worked, with no crashes/warnings. Recognition was intermittent; slower
movement seemed better. Runtime compatibility demonstrated, reliability NOT accepted.

Inspection: pan requires two pointers and retains Android default touch-slop distance;
pinch uses native span-change slop. Simultaneous composition coordinates these two
handlers, not the ancestor RN ScrollView. Local root is inside that ScrollView.
Interception during first-finger movement is a leading unconfirmed hypothesis.
The detector covers the whole pale 300-high region, not only the 100-square tile.
Scale is gesture-relative (0.5–2), pan gesture-relative (+/-70), not cumulative;
repeated movements can end at the same values. JS reporting is throttled to 100 ms,
but animated style updates are not. Recreated gesture builders cause config updates;
installed detector code does not prove they are detached each render. Diagnostic
text wrapping may change layout; whether that matters is unverified.

No behaviour or instrumentation change for Gate 1B. Existing counters suffice for
a first controlled comparison, but finalize does not distinguish failure/cancellation,
and UI reports also occur on finalize without an onUpdate. If activation occurs with
no visible/numeric updates, next proposal is per-gesture update counters/last values
and explicit end-success versus finalize-success diagnostics, not a configuration fix.

Portrait controlled test: keep the entire pale region visible and stationary, no
camera/image needed. Four conditions: slow centre, natural-speed centre, slow tile
edge, natural-speed tile edge. For each condition do two pinches (out then in) and
two pans (right then left): 16 total attempts. Both fingers remain inside pale region;
centre/edge means finger-pair midpoint relative to tile, not screen boundary. Place
both fingers before moving; use comparable travel, about 2 seconds slow versus
0.5–1 second natural. Do not artificially pause normal gestures to make them pass.
Reload once before each condition if needed to restore baseline; confirm bundle v1.
After each attempt wait one second, record relevant begin/active/finalize deltas,
UI-report delta, final scale/position, visible response and unintended parent scroll.
Record whether numbers/text wrapping or region position shift. Group success counts
as pinch X/2 and pan X/2 for each condition. Count natural movements as successful
only with timely visible response, not merely counters. Check outside scroll/control.

Gate criterion: all 8 natural-speed attempts visibly respond without retries or parent
scroll takeover; slow controls also respond, controls remain usable and no warnings.
This is a bounded experiment gate, not production viewer acceptance. Any failure
keeps Gate 2 unauthorized and drives a narrower follow-up. No new APK indicated;
root placement/arbitration or diagnostic geometry corrections would need approval.

## FC-007B.3 Gate 1A: runtime failure diagnostics

Owner Gate 1 results: neither pinch nor two-finger pan moved the tile or metrics;
outside scrolling and the control counter worked; no warnings/crashes reported.
Gate 1 did NOT pass. No definitive implementation/native cause established.
Installed detector supports legacy Gesture builders, Expo preset auto-enables the
worklet plugin, but neither static fact proves runtime execution. Local root below
the parent ScrollView leaves interception/arbitration a plausible hypothesis.

Diagnostic bundle marker: Gate 1A diagnostic bundle v1. Added bounded surface-touch,
gesture begin/active/finalize and UI-to-JS report counters; a separate JS-only tap
pad; and a button that toggles the tile via a UI worklet then reports completion.
No interception override, native changes or preview fix. Reports are local only.

Retest without capturing: verify the marker; press Test UI worklet twice and report
button pressed/completed, UI reports, metrics and visible tile changes. Tap the
separate blue pad without dragging and report JS tap counters. Touch TEST, then
pinch and two-finger pan; report surface touch and pinch/pan counters. Check outside
scroll/control again. Unknowns remain pending Android results. A working JS tap
does not alone establish pinch recognition; UI completion reports establish worklet
execution/shared-value readback, not visible rendering. No new APK expected yet.

Validation: focused static contracts 3/3; full suite 293/293; lint passed. Physical
Gate 1A pending; Gate 2 remains unauthorized.

## FC-007B.3 Gate 1: isolated gesture runtime experiment

Owner diagnostic A stayed visible; B (photo) and C (scanner pages 1 and 2) disappeared
after scrolling. Opening diagnostics did not restore them. Native cause unconfirmed.

The development-only synthetic TEST tile uses installed Gesture Handler/Reanimated,
a local gesture root, simultaneous pinch/two-finger pan, shared values and worklets.
Reports cross to JS at most every 100 ms plus gesture completion. No image, storage,
capture or diagnostic changes. This is not the replacement viewer.

Pending Android test: open Capture comparison through captureproof Metro, scroll to
Experimental gesture runtime test. Pinch TEST and check tile/scale changes. Pan with
TWO fingers and check position changes. Scroll outside with one finger and tap
Surrounding control check. Report worklet errors, warnings, blocked scrolling or
failed controls. No worksheet needed. No new APK expected; stop for review on native
initialization failure. Gate 2 remains unauthorized.

## Current decision review: two defects — 2026-11-16

### FC-007B.2: authorized preview diagnostics, Android evidence pending

This authorization supersedes the earlier documentation-only diagnostic stop below.
Automated verification: 9/9 combined diagnostic/capture tests, 290/290 full tests,
lint and Git whitespace/conflict checks passed. No Android A/B/C result yet.

Added memory-only diagnostics in the existing proof preview. No scroll reset,
remount key, clipping flag, image dimension formula, capture or cleanup change.
Scroll/layout handlers record numbers into a ref-backed ring (200 events maximum).
They do not set React state. The appended fixed-height diagnostic panel refreshes
only when Show diagnostics is pressed, displaying a per-page summary and last 40
events. No console logging, file persistence, telemetry or worksheet uploads.
New capture clears old metrics; event sequence is monotonic during this mount.

Events: action_enlarge/action_fit; js_dimensions after commit; native-reported
scroll contentOffset/layoutMeasurement/contentSize; viewport/image onLayout;
onContentSizeChange; image_load/image_error (without source or error messages).
Only page ordinal, sequence, relative monotonic milliseconds, callback JS mode,
and whitelisted finite numeric dimensions/offsets are retained. Native event objects,
URIs/paths, images/bytes, worksheet text, names and household IDs are never retained.
JS mode is the callback's render mode, not proof of native commit timing. Requested
dimensions are layout units, not a pixel-visibility observation. Native event values
can be stale or absent; summary labels missing post-Fit scroll samples as unknown.
No onLoad callback on Fit is normal when an existing image is reused, not a load
failure. Layout does not expose visible pixels, native clipping region, actual
GPU rendering, EXIF orientation or Fabric internal state. No new native dependency.

Observer limitations: scroll event delivery is throttled to 64ms; logging/layout
callbacks and the appended panel can perturb timing or outer content size. The
original preview subtree, keys, dimensions and source remain unchanged, but exact
native visual behaviour must be checked physically. Show diagnostics itself causes
a render: record whether the image is blank BEFORE pressing it, and whether pressing
it restores the image. Do not claim a fix if the diagnostic build masks the defect.

Metro retest (same installed captureproof APK; no new build):

1. Reconnect/reload French Companion Capture Proof from the captureproof Metro
   server if necessary. Confirm Show diagnostics is present; use non-identifying paper.
2. A: capture one photo; Enlarge, do not scroll, Fit. Report visible/blank, then
   Show diagnostics. Report the P1 summary and recent action/layout/scroll lines.
3. B: same photo, Enlarge, scroll toward bottom-right, Fit. Before any recovery
   toggle report visible/blank; Show diagnostics and report P1 summary / recent
   events. Note whether pressing Show diagnostics restores visibility.
4. C: portrait scanner capture; repeat B on one returned page. With three pages,
   manipulate only page 3, Fit, compare all pages. Existing interface is a scrollable
   list, not a page-switcher. Record only page ordinals and numeric diagnostics.
5. If defect cannot reproduce, stop and report the diagnostic gap; do not treat
   this as corrected. No images or worksheet text need be shared.

Hypothesis interpretation: a post-Fit native offset outside reported bounds supports
stale-offset handling. Valid layout/offsets plus a blank image and no load error
leave clipping/Fabric/rendering unresolved. Invalid image layout or image_error
supports image/layout investigation. None of these events alone distinguishes
native culling from compositor failure. No behavioural correction is authorized
in FC-007B.2. Tests A/B/C and correction justification await owner observations.

### Required follow-on: familiar pinch/pan/Fit review (not implemented)

Production review must support pinch enlargement/reduction, bounded panning, visible
Fit restoring a centred full image, and predictable page transitions for both capture
sources. Double tap/animation optional. This does not authorize replacing the preview
during diagnostics or prematurely abandoning investigation of the present defect.

Proposed interaction for separate approval: one fitted base image per viewport,
one scale/translation model, simultaneous pinch/pan, no competing image-sized native
scroll offsets. Fit sets scale to 1 and translation to zero around the fitted centre.
Clamp translation to image/viewport bounds; proposal is reset to Fit on page change
or viewport/orientation change rather than carrying another page's pan. Maximum zoom,
gesture arbitration with the page list and page-transition UI require design review.

Installed/lockfile packages already include Gesture Handler 3.5.0, Reanimated 4.7.1
and Worklets 0.13.1 transitively; Gate 5 APK evidence includes their native components.
They are NOT declared direct application dependencies. Prefer evaluating those exact
SDK-compatible versions before adding any image-viewer package. Direct dependency
declarations, worklet/Babel/root gesture setup and any configuration change require
separate approval. [Gesture Handler pinch API](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pinch-gesture/)
and [pan API](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pan-gesture/)
support composing gestures; Reanimated supplies shared UI-thread transforms. Fabric
and installed API compatibility still require a bounded implementation spike/retest;
presence in an APK is not proof the gesture implementation works.

Pure tests should cover fitted geometry, scale/translation bounds, Fit idempotence,
page/orientation reset, and source immutability; physical tests cover simultaneous
gestures, outer-list arbitration, all pages, camera/scanner parity and accessibility.
Reusing the APK's exact native versions may permit Metro-only testing, provided
worklet transformation/setup is compatible. Native version/plugin/build changes
require another development APK and separate build approval. No guarantee or build
is authorized now. Physical TalkBack and the eight Expo patches remain deferred.

Production selection is DEFERRED. Google document scanning remains the leading
primary candidate; CameraView remains a fallback candidate. Capture is separate
from interpretation, approval and practice eligibility. OCR suitability is untested.
The gate/local-build instructions below are historical and do not authorize new work.

### Follow-up physical observations and focused-correction gate

Owner subsequently identified an access notice after the first scan: the scanner
says the application has access only to scanned images. In landscape, this notice
and the right-side controls occupy about half the screen. Waiting did not restore
the viewfinder. Rotating to portrait shrank the notice panel and restored framing;
keeping portrait for subsequent pages avoided the problem on this tablet. This is
a device-verified workaround, NOT a general SDK fix. Do not suppress the privacy
notice, force orientation or claim landscape usability has passed. No orientation
lock has been implemented.

Focused preview investigation confirms that Enlarge changes only zoom=false->true,
switching Image layout dimensions from 280x380 to metadata width/height. Panning
changes native scroll state, not a React state field; no custom pinch transform is
implemented. Fit switches zoom=true->false and restores 280x380 on the SAME Image
and horizontal ScrollView. Stable page.uri keys preserve those native instances;
all pages share zoom, but each scroller has independent native offsets. There is
no separate page-switching state: all result pages are rendered in the outer
vertical Screen. A second button press while fitted is actually Enlarge, not an
idempotent Fit action. Fit never modifies image files, URI, order or metadata.

Additional installed RN 0.88.1 evidence: ReactHorizontalScrollView.kt onLayout
reapplies pendingContentOffsetX/Y or current scrollX/Y, then scrollTo updates Fabric
state through ReactScrollViewHelper. Its onLayoutChange handles RTL specially and
does not explicitly reset LTR offset to zero. This establishes retained state,
but super.scrollTo may clamp and native clipping/Fabric reconciliation can still
affect visibility. It does NOT prove that an out-of-range offset is the actual
cause of the disappearance. No Android rendering fixture exists in the current
Node test harness; deterministic pure-JS or source-pattern assertions cannot
reproduce or prove this native visual failure. Automated regression passes must
not be presented as a reproduced or corrected preview defect.

Under the owner's explicit non-speculative correction/stop rule, correction is
BLOCKED pending runtime evidence; no preview implementation changed. The earlier
inner-remount proposal remains an option, not an established fix. Smallest proposed
next step, requiring separate approval: development-only JavaScript diagnostics
for each page's mode transition, onScroll offsets, viewport onLayout dimensions,
onContentSizeChange, Image layout and onLoad/onError. Use page ordinal and timings,
not worksheet pixels, URI, content or identifying data. Collect before/after Fit on
one photo and the third of three scanner pages, with and without panning, then
repeat Fit cycles and portrait/landscape transitions. No clipping flag, key or
layout changes during that diagnostic run. If offsets remain outside the fitted
content after layout, a targeted reset is supported; if offsets/layout are valid
but image disappears, investigate clipping/render state before choosing a fix.
Diagnostics would be Metro-only, with no new dependency or APK. Do not implement
them or claim Android preview success without further authorization/evidence.
Verification for this documentation-only stop: existing capture tests 4/4, full
regression suite 285/285 and lint passed. Whitespace/conflict checks passed with
existing LF/CRLF notices. These are not focused native preview reproduction tests;
Android correction/retest is pending and no fix is claimed.

Physical evidence supplied by the owner on Lenovo TB-J616F / Android 12:

- Gate 6A: separate Capture Proof installation, Metro/Home, proof route, camera
  preview and scanner entry point verified. Camera permission-prompt occurrence
  was not separately reported. Existing Dev application/data were not accessed.
- Camera photo readability/sharpness good; metrics described as acceptable, but
  exact times, dimensions, bytes and tap counts were not recorded.
- Scanner identified the page, felt quick and produced usually good images.
  Some scans required discard/retake. Three pages returned; reorder worked.
- Initialized scanner successfully returned an image with tablet connectivity
  disabled. First-use offline availability/download behaviour remains unverified.
- CAP-PREVIEW-01: after Enlarge, manipulation and Fit, the manipulated image can
  disappear; another Enlarge/Fit toggle restores it. Both photo and scan affected.
  In a three-page result only the manipulated third page disappeared.
- CAP-SCANNER-01: first scanner page nearly fills the screen except a thin right
  menu; subsequent-page capture window is approximately half size, making complete
  worksheet framing difficult. Multi-page functionality passed, usability did not.

### CAP-SCANNER-01: SDK-controlled viewfinder, exact cause unresolved

Local evidence: `src/components/CaptureProof.js` run('scanner') calls
`CameraView.scanDocumentAsync({ requestPdf: false })` once for the whole batch.
`node_modules/expo-camera/src/CameraView.tsx` delegates to CameraManager.
Android CameraViewModule.kt scanDocumentAsync/launchDocumentScanner uses
GmsDocumentScanning.getClient(...).getStartScanIntent(activity); the
DocumentScannerContract.kt launches that IntentSender through the activity-result
contract. buildDocumentScannerOptions fixes SCANNER_MODE_FULL and JPEG output.
DocumentScannerOptions.kt exposes requestPdf and quality; quality is ignored on
Android. The installed dependency declares scanner 16.0.0-beta1. It does not expose
page limit, gallery policy, capture mode, full-screen or viewfinder-size controls
through this Expo API. No page-by-page React layout or scanner window flags are set.
The app's 400-high CameraView and Screen maxWidth 640 do not directly size Google's
separate scanner UI. AppState closes the app-owned CameraView; it does not change
the scanner viewport between pages. Recreation is handled as interruption/rejection,
not as an intentional half-size scanner layout.

[Google's guide](https://developers.google.com/ml-kit/vision/doc-scanner/android)
documents SDK-provided viewfinder/review UI and configurable gallery import, page
limit, formats and scanner feature mode. No documented full-screen sizing option
was found. [Builder reference](https://developers.google.com/android/reference/com/google/mlkit/vision/documentscanner/GmsDocumentScannerOptions.Builder).
Changing page limit or feature mode is not a proven framing fix; the installed
Expo wrapper does not expose them. Do not pass undocumented JavaScript options.

[Public issue #991](https://github.com/googlesamples/mlkit/issues/991) reports a
small tablet viewfinder due to split-pane controls, on Samsung tablets and scanner
16.0.0, with 2026 reports of persistence. This is a similar user report, NOT vendor
confirmation of this Lenovo first/subsequent-page defect or a verified workaround.
Likely SDK adaptive layout/thumbnail panel behaviour; orientation/aspect ratio or
tablet windowing are competing hypotheses. No Lenovo-specific confirmed cause or
supported restore-full-screen control was established. Dynamically delivered Play
services UI also prevents assuming the Maven version alone fixes runtime layout.

Smallest next investigation, using non-identifying paper and no settings changes:
launch scanner from the existing proof; compare first and next page while holding
orientation constant. Note whether unused space is black bars, page thumbnails,
editing controls or a live viewfinder. Confirm that the smaller area is the live
capture screen, not the crop/review screen. Note visible collapse/back-to-camera
controls; try one only if its purpose is clear, otherwise report the label first.
Repeat a fresh scan in the other orientation if rotation is already available;
do not enable/change system rotation, windowing or Play services settings. Record
whether adding a page or entering review triggers the shrink. No private images
need be shared. Rotation may cancel scanning; record that instead of forcing it.

Options requiring approval: keep scanner pending those observations; evaluate
separate one-page scanner invocations (extra student effort and later aggregation,
not production-ready); or use CameraView for repeatable full-page capture. Existing
CameraView is manually framed, fixed-height in this proof and lacks automatic crop,
perspective correction and a multi-photo batch manager. A native scanner-options
experiment or dependency change would require separate approval and another APK;
neither is recommended before the no-code observation above.

### CAP-PREVIEW-01: application layout/state lifecycle, high-confidence hypothesis

CaptureProof.js has one global zoom boolean; toggle only calls setZoom. Each
page.uri-keyed View retains a horizontal ScrollView/Image while its image dimensions
switch from page.width/page.height (used as layout units) to 280 x 380, contain.
Screen.js supplies the outer vertical ScrollView. There is no pan/translation
state in JS, no pinch-zoom implementation, no scroll ref/reset on Fit, and no
separate reusable image-preview component. Each native horizontal scroller keeps
its own state, explaining why only a manipulated page is affected. Content shrink,
native scroll/Fabric state and clipping are the leading mechanism; exact offsets
and clipping have not been instrumented on-device. RN's installed native horizontal
onLayoutChange does not explicitly reset LTR position to zero. Do not assert that
this proves an unbounded native offset or a specific upstream RN bug.

The result URI/dimensions are not cleared on Fit, and no image file is modified or
deleted by toggling. Recovery by toggling and identical photo/scanner symptoms
argue against capture corruption. Image.getSize supplies dimensions; no manual
orientation transform occurs. Landscape/large-image cases still need regression
coverage. [RN ScrollView reference](https://reactnative.dev/docs/scrollview) warns
of missing-content issues with clipping; actual clipping participation is unverified.

Smallest proposed correction (NOT implemented): reset only each inner preview's
native scroll lifecycle when changing display mode, e.g. key that inner ScrollView
by URI and mode while retaining stable outer page keys/results. Alternatively show
Fit as an ordinary non-scrolling Image and use a fresh scroller only when enlarged.
No new pinch/pan framework. Remount intentionally resets pan; image reload/flicker
and outer vertical reflow must be checked. Ref-based scrollTo(0,0) is an alternative,
but requires handling layout/gesture ordering; do not combine speculative fixes.
Avoid changes to shared Screen or native clipping defaults without direct evidence.
This is JavaScript-only and can be tested through Metro on the installed proof APK;
no native rebuild is needed for that correction.

### Proposed focused verification and decision gate

- Preview: toggle without pan; pan far then Fit; rapid toggles; portrait/landscape
  dimensions; large images; repeat with photo and scanner results. For three pages,
  manipulate only page 3, then all pages independently. Verify every fitted image
  is visible, expected aspect ratio, stable order/URI, no file/measurement changes,
  cleanup and navigation guards intact. Unit tests can cover mode/reset identity
  and immutable results; Android rendering/offset regression requires physical
  verification, not a source-string assertion or browser pass alone.
- Scanner: first/second/third page framing in constant orientation, supported
  native review/collapse controls, retake/reorder/cancel and repeat initialization.
  Mocked JS tests can check one scanner call and unchanged returned order; cannot
  prove Google activity layout. Existing lifecycle/cleanup tests remain applicable.
- Record exact metrics/taps, Google Play services version manually if available,
  and lighting/orientation. No updates, data clearing or new APK authorized.
- Production scanner-first selection awaits acceptable multi-page framing and
  preview correction acceptance. CameraView stays a fallback candidate; OCR accuracy,
  source retention, production capture storage and preparation remain separate.

Investigation changed documentation only; no correction, build, install, household
operation or worksheet upload was performed. Actionable preview correction and
scanner observation are READY FOR FC-007B CORRECTION REVIEW.

## Historical workflow: EAS Gate 1 — 2026-11-16

Local Windows build troubleshooting is stopped. Both local corrections helped
Reanimated link on all four ABIs, but app-level Gesture Handler codegen still
failed with a 368-character object path. No APK was produced or installed.
The historical local-build instructions below are superseded by this workflow.

Gate 1 prepares repository configuration only. The new `captureproof` EAS profile
uses a development client, internal distribution, APK output, the `development`
environment and `APP_VARIANT=captureproof`. The existing development profile and
EAS project identity are unchanged. The proof route requires `__DEV__`; a normal
release preview build would hide it. Metro is required for JavaScript delivery.

Pinned image: `ubuntu-26.04-jdk-17-ndk-r27b-sdk-58`, verified on 2026-11-16 against
[Expo's infrastructure inventory](https://docs.expo.dev/build-reference/infrastructure/).
It lists SDK 58, Java 17, Node 22.23.2 and NDK 27.1.12297006. This is documented
compatibility, not an authenticated service-availability or successful-build check.

Upload exclusions preserve the local PBKDF2 module source, Gradle configuration,
registration and public test assets. Root generated native projects, nested module
build caches, `.expo/` (including checkpoints, browser profiles and both Windows
workarounds), credentials, environment secrets, database files, diagnostics,
profiling outputs and archives are excluded. Application image assets remain
included. Captured images live in device-private cache, outside the repository;
do not copy household data or private worksheets into uploadable source paths.
The exact archive must still be inspected before upload. EAS uses `.easignore`
instead of `.gitignore`; the current uncommitted proof source must be included.

Only `APP_VARIANT=captureproof` is required by the application configuration.
No API key, cloud token or other application secret is required by the proof.
Remote development-environment variables have NOT been inspected: after separate
authentication approval, review names/visibility without exposing secret values,
and check for unintended overrides such as build hooks or `GRADLE_OPTS`.
Signing credentials and EAS account authentication are separate service concerns.

Approval gates (none beyond Gate 1 authorized):

1. Gate 1: profile, exclusions, regression tests and instructions only.
2. Gate 2: separately authorize login and verify access to the existing project
   `0234dc22-4a9d-4bc3-b515-769a186c2acb`, owner `wmtfoley`, quota and environment.
   Do not initialize a replacement project.
3. Separately authorize local archive inspection; verify source inclusion and
   sensitive-file exclusion before any upload.
4. Separately authorize proof-package signing credentials and one cloud build /
   source upload. Do not reuse or replace Dev signing material accidentally.
5. Inspect the downloaded APK identity, permissions, backup resources, native
   module inclusion and signing certificate before requesting installation approval.
6. Install/launch only after separate approval; never replace or clear Dev.

Future build command, ONLY after cloud/signing/upload approval:

```powershell
$env:APP_VARIANT = 'captureproof'
eas build --platform android --profile captureproof
```

Do not pass either Windows-only correction to EAS: omit the local Gradle init
script and `-Pexpo.android.cmakeObjectPathMax=240`. Linux native generation comes
from the uploaded Expo configuration, not the excluded Windows Android project.

After a verified APK is separately approved for installation, serve JavaScript:

```powershell
$env:APP_VARIANT = 'captureproof'
npx.cmd expo start --dev-client --lan --scheme french-companion-captureproof
```

The captureproof package/name/scheme remain `com.frenchcompanion.captureproof`,
`French Companion Capture Proof`, and `french-companion-captureproof`.
Cloud build success, signing, installation and physical comparison remain unverified.
No paid enrollment, account access, credential creation or upload is part of Gate 1.

## Historical Stage 1 status — isolated variant

Stage 1 source/native-generation inspection is complete; ready for Stage 2 review,
not authorization to build or install. The earlier development-replacement build
instructions below are superseded by the isolated identity described here.

- APP_VARIANT=captureproof; package/namespace com.frenchcompanion.captureproof;
  name French Companion Capture Proof; scheme french-companion-captureproof.
- Development and default branches retain their prior identities/configuration.
- Tablet authorized, Android 12; com.frenchcompanion.dev present and proof package
  absent at the Stage 1 check. No household data was accessed.
- SDK Platform 37.0 revision 2, Build Tools 37.0.0 and NDK 27.1.12297006 verified
  installed. Node/JDK/SDK settings were terminal-local only.
- Regenerated android/ is ignored. Camera request present, microphone request
  absent; READ/WRITE_EXTERNAL_STORAGE have tools:node="remove" directives only
  in captureproof. INTERNET/SYSTEM_ALERT_WINDOW/VIBRATE remain development defaults.
- This is NOT a final merged-manifest result. Stage 2 must run the Gradle manifest
  merger (for example :app:processDebugMainManifest), review all dependency
  permissions, and stop if blocked/microphone requests survive.
- SecureStore backup resource references resolve to the library's XML resources;
  SecureStore preferences remain excluded from cloud backup and device transfer.
- Native autolinking resolves expo.modules.fcpbkdf2.FcNativePbkdf2Module, camera,
  filesystem and SecureStore. No Kotlin/PBKDF2 changes or compilation performed.
- No explicit CMake version is set in generated application configuration; AGP
  selects its default. Installed Expo source identifies that default as 3.22.1;
  ReactAndroid's own source build separately specifies 3.30.5. No CMake is installed.
  Stage 2 must confirm the effective application selection before requesting a
  specific CMake package. No additional SDK installation was performed here.
- Prebuild rewrites npm's android script; restored expo start --android afterward.
- Focused tests 8/8; full suite 280/280; lint and whitespace checks passed.

Stage 2 needs explicit authorization for Gradle configuration/manifest tasks,
proof-specific signing selection and APK build/install. Existing development app
must never be updated/uninstalled. The generated template debug key is not a new
private signing identity; no signing key was generated or replaced.

After separate build/install authorization, the proof Metro command is:

```powershell
$env:APP_VARIANT = 'captureproof'
npx.cmd expo start --dev-client --lan --scheme french-companion-captureproof --port 8084
```

Never run these captureproof-generated native files as the development variant
without regeneration and explicit identity inspection.

Development-only, Android-only, cache-only comparison. No assignment creation,
OCR, preparation, approval or practice authorization. Production route displays
an unavailable message and conditionally excludes the native proof component.

## Build and installation gate

Camera requires a new development APK. Local inspection found no `java` or `adb`
on PATH and no JAVA_HOME/ANDROID_HOME/ANDROID_SDK_ROOT environment configuration.
No local build, EAS build, source upload or installation was performed.
The approved no-cloud-upload constraint prevents use of the existing EAS cloud
workflow for this task. Do not install a toolchain or select a new signing key
without owner review.

Local prerequisites: supported JDK and Android SDK/build tools for Expo SDK 58,
platform tools, USB debugging with an authorized tablet, and the SAME signing key
as the installed development application. Package remains
`com.frenchcompanion.dev`; scheme remains `french-companion-dev`.
Confirm signing identity before building/installing; do not accept a new debug
signature merely because the package matches. Never uninstall or clear data to
resolve a signature mismatch.

After prerequisites and signing are reviewed, the local Expo Android build flow
is `npx.cmd expo run:android --variant debug --device` with APP_VARIANT set to
development. This command generates native projects and may install immediately;
do not run it until signing is established. Alternatively generate/build the APK
separately and inspect its application ID and signing certificate first.
The typical generated artifact is
`android/app/build/outputs/apk/debug/app-debug.apk` (not yet created).
An approved matching-signed artifact can be installed with
`adb install -r <approved-apk-path>`. No APK is supplied by this proof work.

Launch Metro in the repository's terminal-local Node 22 session:

```powershell
$env:APP_VARIANT = 'development'
npx.cmd expo start --dev-client --lan --scheme french-companion-dev
```

Open Home > Développement > Capture technology comparison. The existing APK
cannot run the new camera module. Web displays only the unavailable message.

## Physical procedure

Use non-identifying printed worksheets; record tablet model, RAM, Google Play
services version and scanner capability message. Google Play Store access alone
does not establish scanner support. Settings > Apps > Google Play services can
show its version. Do not change or clear Play services data.

Compare the same pages at similar distance and light. Take three samples per
method. Include small accents, articles, multiword terms, vocabulary tables,
portrait/landscape pages, slanted pages, shadows and uneven lighting. Inspect
zoomed results for clipping, blur, altered punctuation and table row integrity.
Enlarged previews use scrollable native pixel dimensions, not OCR analysis.

| Worksheet/case | Method/run | Actions/retakes | Ready delay (manual) | Capture ms | Total ms | Pixels/page | Bytes/page | Readability/edges/perspective observations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Not tested | Camera/scanner | — | — | — | — | — | — | Physical evidence pending |

Photo capture timing starts at shutter; scanner capture timing includes native
interaction and possible initialization/download. Total includes copying and
metadata inspection. Images are moved into the owned cache directory rather than
duplicated. These are not directly comparable processing benchmarks.
Record scanner time-to-ready manually and separate first/warm runs.

- Check camera permission denial and permanent denial, then grant through Settings.
- Check scanner capability and actual successful launch/multipage completion.
- Count actions, retakes and native preview editing controls.
- Check cancellation, rapid taps, navigation away during capture and re-entry.
- Check background/resume: CameraView closes; scanner activity may continue.
- Check offline CameraView; initialize scanner online, then test offline scanning.
- First-use offline availability is NOT VERIFIED if components already exist.
- Clear temporary proof images and verify previews disappear; repeat after restart.
- Confirm household PIN/policy, stored assignments and both practice types unchanged.

## Storage and limitations

Owned copies live only under cache `fc-capture-proof`, never gallery or document
storage. Clear deletes only direct files in that directory, including abandoned
images from earlier visits. Failed cleanup can be retried. Exact returned SDK
images are moved into the owned directory; shared/native cache directories are
never swept. SDK intermediates or interrupted native work may remain until
Android reclaims cache. Cache is not durable evidence, secure
erasure or production retention. No backup exclusions are added here.

Native operation concurrency is held until completion even after navigation;
late results are suppressed and their owned copies are removed where possible.
If a native operation never settles, restart the app rather than bypass its guard.
No timeout releases a still-active native capture. Document scanner availability,
RAM, actual image quality and offline behaviour remain physical-device checks.
The installed Expo scanner uses FULL processing and does not expose scanner mode,
page limits or gallery-import controls; record resulting behaviour without
assuming fidelity or OCR improvements.

## Local verification

Focused proof tests: 4 passed. Full suite: 276 passed. Lint, production web export,
production/development Android JavaScript exports and existing browser regressions
passed. The browser harness requires Metro on localhost:8083; its first attempt
stopped at that unavailable server, then passed after starting it. Android exports
are not native builds or runtime verification. The eight existing SDK patch
recommendations remain deferred. Physical proof and APK build remain pending.
