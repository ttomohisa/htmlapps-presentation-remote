# APP_SPEC.md — Browser Kitty Presentation Remote

## 1. Product summary

Browser Kitty Presentation Remote opens a local `.pptx` or `.pdf` on the presenting computer and lets another browser, typically a smartphone, control the presentation through a direct WebRTC DataChannel connection.

The core product promise is:

> Open the deck. Pair the phone. Present without uploading the file.

The application is local-first and account-free. The selected deck stays on the presenting computer. The deck file itself is not sent to the paired phone. The phone receives control/pointer state and, while Presenter View is enabled, low-resolution current/next slide previews plus speaker notes over direct WebRTC DataChannels.

## 2. Release target

- Version: `1.0.0`
- One-file readable build: `dist/index.html`
- One-file self-extracting build: `dist/index.self-extract.html`
- Japanese and English in the same HTML.
- Intended hosting: Browser Kitty / Azure Static Web Apps, while still supporting direct `file://` opening for the core presenter flow.

## 3. Primary flows

### Presenter / host

1. Open the app on the computer.
2. Drop or choose a `.pptx` or `.pdf` file.
3. The app parses the file locally and shows slide/page count and a compatibility summary.
4. Review slides with the thumbnail rail and keyboard controls.
5. Press `スマホを接続 / Connect phone`.
6. The app starts the canonical serverless QR WebRTC host flow.
7. On the phone, open the same tool, choose `スマホで操作 / Use as remote`, and scan the host connection QR.
8. Complete the Answer QR handoff.
9. Use Presenter View on the phone to see the current slide, the next slide and collapsible speaker notes while keeping next/previous, blank screen, direct slide selection, timer state, and touch or motion pointer controls available.
10. Press `プレゼン開始 / Start presentation` on the computer to enter fullscreen; fullscreen must originate from the computer's user gesture.

### Smartphone / joining device

1. Open the same HTML / hosted tool.
2. Choose `スマホで操作 / Use as remote`.
3. The canonical QR pairing UI starts the joining-device scanner.
4. After connection, the pairing UI collapses and Presenter View is shown by default.
5. The current slide is shown larger, the next slide smaller, and speaker notes are collapsible. Presenter View can be disabled from **More** to return to the simple remote.
6. Use large previous / next controls and switch the pointer between touch and motion control as needed.
7. If the peer disconnects, the remote shows a reconnect/disconnected state without affecting the computer's locally loaded deck.

## 4. File input

Accepted:

- `.pptx`
- `.pdf`

Maximum accepted file size: 150 MB. Reject larger files with a local validation message before parsing.

Changing the source is a hard state boundary:

- Increment the source generation token.
- Revoke old Blob URLs.
- Release old PPTX package/object URLs.
- Clear thumbnails, compatibility results, current index, and presentation state.
- Ignore stale async parse/render results.

No persistence of the selected file. Reloading the page clears the deck.

## 5. PPTX renderer

The primary PPTX renderer is pinned `@aiden0z/pptx-renderer@1.2.4`, using its standalone browser ESM bundle embedded into the generated single HTML. It parses OOXML entirely in the browser and renders the presentation as HTML / SVG / Canvas DOM. No document-conversion service or runtime CDN is allowed.

The primary path is chosen specifically for PowerPoint-oriented visual fidelity. Expected coverage includes:

- slide → layout → master background/template inheritance,
- seven-level OOXML text/style inheritance and embedded-font handling,
- preset/custom shapes, connectors and recursive group transforms,
- SmartArt cached/fallback data,
- tables, images, gradients, patterns and effects,
- supported charts via the renderer's bundled ECharts runtime,
- the OOXML theme/color pipeline.

Japanese text rendered with a Latin Office theme face must prefer the theme's East Asian/Jpan face when available, while preserving explicit custom fonts. Theme lookup must follow the renderer model's per-slide `slideToLayout → layoutToMaster → masterToTheme → themes` maps; `PresentationData` has no singular `theme` property. Office theme UI family labels such as `メイリオ 見出し` / `メイリオ 本文` must resolve to the actual Meiryo family instead of being passed to CSS as nonexistent font-family names. PowerPoint SVG-only pictures that store only an `asvg:svgBlip` relationship must be promoted to a resolvable picture relationship before the primary renderer handles the node.

The previous pinned `pptx-svg@0.6.5` + embedded Wasm path remains available as a compatibility fallback. If the primary renderer fails during PPTX parsing/building, the app retries the same local ArrayBuffer with `pptx-svg`; the compatibility panel must make that fallback visible. A failure of both renderers is a PPTX engine failure.

For the primary renderer, slide DOM is rendered at its intrinsic PowerPoint size and wrapped in an application-owned frame. Presentation Remote scales that frame uniformly to the stage (and independently for thumbnails) rather than forcing a small target width into the renderer. Refit must occur after resize/fullscreen changes to avoid text/layout drift.
Thumbnail CSS must only size the application-owned preview root (`> svg` / `> canvas`) and must not apply width/height overrides to nested SVG elements emitted by the renderer.

The high-fidelity renderer mutates slide nodes while resolving placeholder inheritance, so Presentation Remote must not call it concurrently against the same `PresentationData`. Initial current-slide rendering completes before thumbnail generation begins. Later renders pass through an app-owned priority gate that serializes renderer calls and always services presenter/main-slide work before the next background thumbnail job.

Renderer resources are lifecycle-bound to the loaded deck: active slide handles, thumbnail handles, charts/fonts owned by those handles, and shared media Blob URLs must be disposed/revoked when the file changes or the page exits.

Known presentation-time limitations:

- Animations and transitions are rendered as a static slide.
- Audio is not played by Presentation Remote.
- Video uses renderer-provided poster/fallback representation rather than presentation playback.
- PowerPoint remains the reference renderer; exact pixel parity is not promised.

The primary browser ESM bundle must not fetch its own dependencies at runtime. Optional PDF.js fallback inside the PPTX renderer remains disabled in v1.0.0; the application's separate embedded PDF.js pipeline continues to handle `.pdf` files. The existing `pptx-svg` fallback also remains fully embedded.

## 6. PPTX compatibility check

After PPTX parsing show a compact compatibility summary:

- Slide count
- `表示できる基本要素 / Basic content supported`
- Counts of detected unsupported/limited feature categories
- A list of affected slide numbers when feasible
- Recommendation to export to PDF when visual fidelity matters more than editability/structure

Compatibility checking is advisory and does not block presentation.

## 7. PDF handling

PDF files are parsed locally with embedded PDF.js and rendered page-by-page to Canvas. The PDF bytes never leave the presenting browser. The PDF.js worker is also embedded in the standalone HTML.

- PDF.js and its worker are embedded by the standalone build.
- No external PDF service is used.
- Page count comes from PDF.js (`PDFDocumentProxy.numPages`).
- Pages and thumbnails are rendered to local Canvas elements.
- `useWasm: false` avoids hidden runtime WASM fetches; system fonts are allowed as a local fallback.

## 8. Presentation controls

Computer:

- Previous / next buttons
- Thumbnail selection
- Direct slide/page number input
- Start fullscreen
- Toggle blank screen
- Toggle pointer visibility
- Reset timer
- Keyboard:
  - Right / Down / Space / PageDown: next
  - Left / Up / PageUp: previous
  - Home: first
  - End: last when known
  - B: blank screen
  - F: start/exit fullscreen when browser policy permits
  - Escape: browser fullscreen exit

Phone:

- Large previous and next zones/buttons
- Current slide/page and total
- Elapsed presentation time
- A bottom action bar for blank screen, pointer and More
- Direct slide/page selection
- Touchpad pointer mode
- Motion pointer mode using Device Orientation
- Pointer recenter / motion calibration
- Motion Freeze / Resume, sensitivity, dead-zone and stabilization controls

## 9. Pointer

Version 0.6.1 and later provide two phone-side pointer modes while the host remains the owner of normalized coordinates in `[0,1] × [0,1]`.

Touch mode:

- Finger movement sends relative `pointer-delta` packets over the lossy pointer DataChannel.
- The host applies pointer sensitivity and clamps the resulting coordinates.

Motion mode:

- Uses `DeviceOrientationEvent` on the phone. Platforms such as iOS that expose `requestPermission()` must receive permission from a direct user gesture.
- A secure context is required; the development Quick Tunnel exists in part so the sensor path can be tested on a real phone over HTTPS.
- The current phone orientation is explicitly registered as the presentation-screen center. Screen orientation changes invalidate the calibration.
- Sensitivity controls angular range, dead-zone suppresses very small motion, and Off / Standard / Strong stabilization applies low-pass smoothing.
- Freeze stops motion updates without hiding the laser pointer; Resume recenters to the current phone direction to avoid a jump.
- Motion sends the latest normalized position as `pointer-absolute`, not an accumulated delta, so dropped or reordered packets do not create pointer drift.
- Direction contract after center calibration: physically aiming the phone right/left/up/down must move the pointer right/left/up/down. The final screen-coordinate mapping deliberately inverts the raw calibrated yaw/pitch deltas to match observed Device Orientation direction on phones.
- If yaw/alpha is unavailable, the app falls back to screen-plane tilt values.

For both modes:

- Pointer stream is `ordered:false, maxRetransmits:0`.
- Stale pointer packets may be dropped under backpressure.
- Control/state channel remains reliable and ordered.
- The host renders a non-interactive laser-dot overlay above the slide.

## 10. WebRTC pairing

Reuse `components/webrtc-qr-pairing.html` and its dependency configuration.

- Fully serverless manual QR signaling.
- `iceServers: []`.
- No STUN, TURN, WebSocket or signaling API.
- Same-LAN direct connectivity is expected.
- Three DataChannels:
  - `presentation-control`: `{ ordered: true }` for reliable state, commands and heartbeat messages
  - `presentation-pointer`: `{ ordered: false, maxRetransmits: 0 }` for latency-sensitive pointer movement
  - `presentation-preview`: `{ ordered: true }` retained as a dedicated preview-capable channel; Presenter View does not require it to be open
- Preview transfer must not share the ordered control queue, so navigation commands are never delayed behind image chunks.
- Preserve the canonical component's full ICE gathering guard, delayed Answer generation, retry cleanup, diagnostics, camera fallback and manual code fallback.

Pairing/privacy wording must be precise:

- The presentation file stays on the host computer.
- Control/state and pointer messages are sent directly to the paired browser over WebRTC.
- While Presenter View is enabled, only the requested current/next low-resolution previews and speaker notes are additionally sent to the paired browser.
- No cloud/signaling server is used by the production app.

## 11. State protocol

Protocol v4 JSON messages use three purpose-specific DataChannels. Unknown message types are ignored.

The reliable ordered `presentation-control` channel carries host state, commands and heartbeat messages. Host -> remote state snapshot:

```json
{"type":"state","v":4,"hostSession":"host-session","revision":12,"index":4,"total":18,"title":"demo.pptx","kind":"pptx","deckRevision":3,"blank":false,"pointer":true,"elapsedMs":321000}
```

`deckRevision` changes whenever the host source deck changes. The remote must discard cached previews, speaker notes and partial preview assemblies when a new revision is observed.

Remote -> host commands include a per-client session ID and monotonically increasing sequence number:

```json
{"type":"command","v":4,"clientSession":"phone-session","seq":21,"command":"next"}
{"type":"command","v":4,"clientSession":"phone-session","seq":22,"command":"goto","index":4}
```

The host acknowledges sequenced commands and must not execute a sequence number twice for the same client session. Common tap commands are also debounced briefly on the phone to suppress accidental double taps.

Both peers exchange heartbeat messages on the control channel:

```json
{"type":"ping","id":"session:7"}
{"type":"pong","id":"session:7"}
```

The measured round-trip time is advisory UI only; a missing heartbeat contributes to the reconnecting state but never pauses the local presentation.

The lossy `presentation-pointer` channel carries relative touch movement or the latest absolute motion-pointer position:

```json
{"type":"pointer-delta","dx":0.012,"dy":-0.004}
{"type":"pointer-absolute","x":0.62,"y":0.41}
```

Pointer messages are deliberately lossy. If the pointer channel buffer is backed up, stale motion packets may be dropped rather than increasing latency.

Presenter View uses the already-open reliable `presentation-control` DataChannel as its primary request/response path. The ordered `presentation-preview` channel is retained for compatibility/future optimization but is not required for Presenter View. The remote requests at most the current and next slide that are missing from its cache:

```json
{"type":"preview-request","v":4,"requestId":"3-4-abc","revision":3,"indexes":[4,5],"notesIndex":4}
```

The host immediately returns a small progress status, then speaker-note text and, for each requested preview, metadata followed by chunked image data. Raw image chunks are limited to 8 KB before base64/JSON encoding. The target preview width is about 420 px. WebP is preferred with JPEG fallback. For PPTX, the host first snapshots the same high-fidelity DOM/SVG/Canvas renderer used by the PC presenter and thumbnail views. Existing rendered current/thumbnail DOM is reused when possible; otherwise the same renderer is scheduled at low priority. Canvas layers and local Blob-backed picture resources are flattened into the snapshot before encoding. The older `pptx-svg` renderer is only the final compatibility fallback. All preview stages have finite timeouts so the phone cannot remain in a permanent loading state.

```json
{"type":"preview-notes","v":4,"requestId":"3-4-abc","revision":3,"index":4,"kind":"pptx","text":"Speaker note text"}
{"type":"preview-meta","v":4,"id":"preview-id","requestId":"3-4-abc","revision":3,"index":4,"mime":"image/webp","width":420,"height":236,"bytes":18234,"total":2}
{"type":"preview-chunk","v":4,"id":"preview-id","requestId":"3-4-abc","revision":3,"index":4,"seq":0,"data":"...base64..."}
```

The phone keeps only a small preview/note cache (maximum four entries). Disabling Presenter View stops further preview requests and releases cached Blob URLs. A source-deck revision mismatch causes incoming preview data to be ignored.

For PPTX, the host generates Presenter View previews from the primary `@aiden0z/pptx-renderer` output first. The current presenter DOM and already-rendered thumbnail DOM are preferred because they are the same visual path the user sees on the PC. If neither exists yet, the host performs a low-priority render with the same presentation model and renderer. The DOM snapshot is made self-contained, including Canvas content and Blob-backed local pictures, before it is rasterized to the 420 px transfer image. Only if this high-fidelity path fails does the host lazily initialize the already bundled `pptx-svg` compatibility renderer. Speaker notes are extracted locally by following the slide relationship to `notesSlide` and reading the `body` placeholder. For PDF, previews are rendered from the local PDF.js document and the UI explicitly states that PowerPoint speaker notes are not available.

## 12. Async phases

Presenter phase:

- `empty`
- `loading`
- `ready`
- `error`

Pairing phase is owned by the reusable WebRTC component and exposed in a separate status region.

Remote phase:

- `idle`
- `pairing`
- `connected`
- `disconnected`

## 13. Layout and UX

Desktop presenter layout:

- Header uses Browser Kitty template styling.
- After file load: left thumbnail rail, central slide stage, right compact control/status column.
- The right column must remain compact and should not stretch to the entire document height.
- Connection and presentation actions remain visible near the stage.

Smartphone layout:

- Do not stack the desktop presenter UI into one long page.
- If used as remote, show the remote surface as the primary page and hide presenter-only sections.
- Presenter View is enabled by default: current slide larger, next slide smaller, speaker notes collapsible.
- **Next** remains the dominant target and **Previous** remains available but smaller. Presenter information must not displace these primary controls.
- The Presenter View toggle lives in **More** and immediately restores the simple remote when disabled.
- On narrow portrait phones, the persistent tool bar remains reachable at the bottom and content must reserve enough safe-area space.
- On short landscape screens, the tool bar moves to a compact right-side vertical rail so the preview area and navigation stay within one viewport.
- Pointer touchpad is adjacent to pointer controls when the pointer is enabled.
- Safe-area padding is required.

## 14. Accessibility

- All controls have accessible names.
- Visible keyboard focus.
- Dialog focus is restored when closed.
- Status changes use polite live regions.
- Reduced-motion disables decorative transitions.
- Remote next/previous controls are buttons, not gesture-only hit targets.
- Do not rely on color alone for connected/disconnected state.

## 15. Privacy and CSP

No runtime CDN, analytics, telemetry, external font, API request, or hidden network dependency.

Production standalone HTML keeps `connect-src 'none'`. PDF.js runs entirely from embedded script/worker blobs and does not require a network connection.

The development server is a deliberate exception: while serving `dist/index.html`, it rewrites only the development response to `connect-src 'self'` so the browser can exchange WebRTC Offer/Answer JSON with the development signaling endpoint. The PC uses loopback HTTP; the phone opens the same development app through a temporary trusted HTTPS Quick Tunnel so camera APIs remain available. Production HTML remains unchanged.

WebRTC peer-to-peer DataChannels are the only intentional cross-device data path after pairing. The source PPTX/PDF file remains on the presenter computer; the paired phone receives control/pointer state and, only while Presenter View is enabled, low-resolution current/next previews and speaker notes.

## 16. Persistence

Persist only lightweight preferences:

- Language
- Presenter View enabled/disabled state
- Existing remote vibration/motion-pointer preferences

Do not persist:

- Presentation file bytes
- Slide text/content
- WebRTC SDP/candidates/session data
- Presentation timer state

## 17. Acceptance criteria

- The repository follows the template source/build layout.
- `src/index.template.html` is the only app implementation source unless explicitly split later.
- WebRTC pairing reuses the canonical component and pinned QR dependencies.
- A simple PPTX containing text, basic shapes and images can be opened and navigated locally.
- Compatibility warnings are shown for detected advanced content.
- A PDF can be parsed and rendered locally with embedded PDF.js without upload.
- A paired phone can move next/previous, blank/unblank, jump to a known slide, and move the pointer.
- Presenter View shows current/next low-resolution previews and PPTX speaker notes without sending the source deck file to the phone.
- Presenter View can be disabled without reducing the usability of the simple remote.
- At approximately 390×844 portrait and 844×390 landscape, Presenter View does not introduce horizontal scrolling or hide the dominant Next control behind fixed UI.
- Disconnecting the phone does not stop or clear the computer presentation.
- Fullscreen starts only from a computer user gesture.
- Both desktop and smartphone layouts are usable at 360 px width.
- No runtime HTTP/API/CDN dependency is present.
- Build metadata and help copy describe peer-to-peer transfer accurately.

## PDF font resources

The production build embeds PDF.js packed CMaps and standard-font files from the pinned `pdfjs-dist` package. `useWorkerFetch` is disabled and a custom `BinaryDataFactory` resolves those files from `StandaloneAssets`, preserving the no-runtime-network contract while supporting PDFs that depend on non-embedded standard fonts or CID CMaps.

## Development pairing

`start-dev.bat` builds `dist/index.html` and starts a loopback PowerShell development server. It also starts a development-only Cloudflare Quick Tunnel and injects its temporary HTTPS origin into the development response. The phone therefore runs in a secure context and can use camera / QR APIs. The PC creates a one-time room URL/QR, and the local server relays only WebRTC offer/answer descriptions in memory. The selected PPTX/PDF is never posted to the signaling endpoint. The production standalone HTML does not include this signaling service or tunnel and keeps the two-way serverless QR flow.

## Presenter preview reliability requirements (v0.8.4)

- Preview Base64 encode/decode functions used by Presenter View MUST exist in the Presenter View application scope. Helpers private to the embedded-asset loader IIFE are not callable from the preview receiver.
- Receiving a valid `preview-meta` followed by chunks MUST either complete the image assembly or surface an error; chunk decode failures may not be silently converted into an indefinite loading state.
- Presenter View request scheduling MUST NOT depend on a separately lagging global `state.role`; remote connectivity plus an open transport channel are the authoritative prerequisites. Preview serving may use the receive callback role directly.
- The unresolved-preview attempt key/clock MUST be committed before transport lookup. A missing transport may schedule retries, but those retries MUST NOT reset the 30-second failure deadline.
- A host that cannot serve a request yet MUST acknowledge the request with progress or resynchronize deck state; it MUST NOT silently discard a request because the deck is still loading or the requested deck revision is stale.
- Request-send time and host-progress time MUST be tracked separately. Sending a retry must not count as remote progress or postpone the no-response timeout.
- A preview request with no usable response MUST transition to a visible failure state within a finite interval; v0.8.4 caps one unresolved request set at 30 seconds.
- A repeated `preview-request` MUST NOT invalidate an already-running preview generation for the same deck revision.
- PPTX preview renderer initialization MUST be shared while it is in progress; duplicate retries must await the same initialization promise.
- Slide rasterization for the same `deckRevision:index` MUST be coalesced while in progress.
- When the dedicated preview DataChannel is already open when application handlers are attached, the join side MUST request previews immediately rather than waiting for a later state sync.
- Deck replacement / cleanup may invalidate in-flight preview work.
- Raw preview chunks MUST remain small enough that their Base64 + JSON representation stays below 16 KB; v0.8.4 uses 8 KB raw chunks.
- Preview generation MUST have finite timeouts. A renderer/image encoder promise may not leave the phone in a permanent loading state.
- PPTX Presenter View previews MUST prefer the same high-fidelity renderer path used by the PC presenter/thumbnail UI. `pptx-svg` is a compatibility fallback, not a parallel default preview renderer.
- When a high-fidelity slide is already rendered on the PC, preview generation SHOULD snapshot that existing DOM to avoid fidelity drift and redundant rendering. If it is not rendered yet, the same high-fidelity renderer SHOULD run through the low-priority render gate.
- DOM snapshotting MUST preserve Canvas output and SHOULD inline local Blob-backed picture resources before rasterization so chart/image layers are not lost in the transferred preview.
- Rasterization failure SHOULD fall back to an SVG preview when a valid PPTX SVG source is available.
- The remote MUST show progress states (requesting, generating, receiving, slow) rather than an undifferentiated permanent loading placeholder.
- Presenter View MUST work when only the reliable control DataChannel is open; the dedicated preview DataChannel is optional.
- A failed preview metadata/chunk send MUST be surfaced as a transfer failure; silently dropping a chunk is not allowed.
- If the request arrives over the control-channel fallback, the host SHOULD reply on that same channel for the request so asymmetric preview-channel readiness cannot strand the transfer.
- A dedicated preview-channel failure MUST NOT prevent Presenter View from requesting previews while the reliable control channel remains open.

## Phone remote UX requirements (v1.0.0)

The phone surface is optimized for use while speaking rather than for configuration.

- **Next** is the largest primary target; **Previous** remains available but visually smaller.
- Horizontal swipes over the navigation area are supported. A gesture must exceed both a horizontal distance threshold and a horizontal-vs-vertical ratio before it becomes navigation.
- A recognized swipe suppresses the synthetic/underlying button click to avoid double navigation.
- Black screen, pointer and **More** are persistent secondary controls. On narrow portrait phones they remain in the lower action bar; on short landscape phones they move to a right-side vertical rail.
- The pointer panel is hidden unless the pointer is enabled, and exposes Touch / Motion mode tabs.
- Touch mode keeps the drag touchpad and one-tap recenter action.
- Motion mode requests Device Orientation permission from a user gesture when required, requires a secure context, and exposes explicit center calibration, Freeze / Resume, sensitivity, dead-zone and Off / Standard / Strong stabilization.
- The slide counter itself is a direct-navigation affordance. Tapping it opens a modal slide-move sheet; the same action also remains available behind **More**.
- For known deck lengths up to 120 slides, the sheet exposes all slide numbers. For larger decks it exposes compact first/current/last neighborhoods plus direct numeric entry instead of rendering hundreds of buttons. It does not require sending extra slide previews.
- Timer reset and disconnect stay behind **More** so they do not compete with the main navigation targets.
- Previous is disabled on the first slide. Next is disabled on the last slide when the total slide count is known.
- Presenter View is ON by default and shows the current slide larger than the next slide. Speaker notes are collapsed by default.
- Speaker-note text size is adjustable from 11 to 19 px, persists only in local browser storage, and long notes scroll inside the notes panel instead of growing the whole remote indefinitely. On slide change, the notes panel returns to the top.
- Presenter View may be disabled from **More**; when disabled, preview requests stop and the navigation surface expands back to the simple remote layout.
- Preview traffic uses the already-established reliable control DataChannel as the primary transport. The optional dedicated preview DataChannel remains available, but Presenter View MUST NOT depend on it opening successfully.
- A successfully sent command receives immediate visual feedback. Optional vibration feedback uses `navigator.vibrate` only when supported and is stored only in local browser storage. Visual/haptic acknowledgement MUST NOT optimistically mutate the current slide index; the remote continues to wait for host state.
- While the phone remote is connected, the app requests Screen Wake Lock when supported. It exposes the current sleep-prevention state, re-acquires the lock after returning to a visible tab, releases it after final disconnect, and degrades without blocking presentation when the API is unavailable or denied.
- A transient WebRTC disconnect enters the existing 8-second recovery state, visibly pauses remote controls, and preserves the local PC presentation. If recovery succeeds, state/previews are resynchronized and controls resume. If the grace period expires, the phone shows a persistent disconnected banner with an explicit **Reconnect** action that restarts the QR pairing flow; stale preview cache is cleared.
- On narrow phone screens, remote mode reduces surrounding page chrome and hides the footer. Short landscape screens receive a compact layout; dialogs and fixed controls must remain inside the viewport and may not introduce horizontal scrolling.

## WebRTC stability requirements (v0.4.1)

- The application creates separate DataChannels for reliable controls, low-latency pointer updates (relative touch deltas or absolute motion positions), and Presenter View preview/note transfer. Presenter View may tunnel over the reliable control DataChannel only as a compatibility fallback when the dedicated preview channel is unavailable.
- A UI is considered connected only after the control DataChannel is open.
- Commands include a per-client session ID and monotonically increasing sequence number; duplicate or stale sequence numbers must not execute twice.
- Both peers send heartbeat ping/pong messages and display measured round-trip latency when available.
- A transient `disconnected` state enters an 8-second reconnecting grace window without interrupting the locally running presentation.
- If the same connection recovers within the window, controls are re-enabled and the host sends the complete current presentation state.
- After the grace window expires, the remote is considered disconnected and requires pairing again.
- Pointer packets may be dropped when the unreliable pointer DataChannel buffer is backed up; stale pointer motion must not delay control commands.
- The smartphone requests Screen Wake Lock while connected when supported and re-acquires it after visibility restoration.
