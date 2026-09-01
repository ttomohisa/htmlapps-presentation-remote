# Changelog

## Unreleased

- Remove the former umbrella-brand name from product UI, metadata, documentation, reusable-component guidance, development output, and release assets so this public repository stands on its own as Presentation Remote.
- Refresh Japanese/English desktop and mobile screenshots with a brand-neutral demo deck, and remove unreferenced legacy introduction MP4 files.
- Refresh loaded file/page/slide labels and compatibility text immediately when the UI language changes.
- Add a small `Map.prototype.getOrInsertComputed` compatibility shim before loading embedded PDF.js so current PDF.js builds keep working in Chromium versions that do not yet provide that API.
- Remove stale v1.0.1/v1.0.2 release-lock tests that intentionally fail against v1.0.3; current v1.0.3 and behavior-specific regression coverage remains.
- Add repository cleanup regression coverage for product naming, generated HTML parity, PDF compatibility, language refresh, and screenshots.

## 1.0.3 - 2026-09-01

- Treat the control DataChannel as the reusable pairing component's default channel, so application connection is not reported until both ICE and the control channel are ready.
- Prevent the phone pairing dialog from closing during the narrow interval where ICE is connected but the control DataChannel is still opening.
- Close the pairing dialog only after the control channel has opened and the application transport is marked recovered.

## 1.0.2 - 2026-09-01

- Restore the intended WebRTC channel isolation: Presenter View preview traffic now uses the dedicated ordered `presentation-preview` DataChannel instead of preferring `presentation-control`.
- Keep the control DataChannel reserved for navigation commands, state synchronization, acknowledgements and heartbeat ping/pong traffic.
- Preserve PeerConnection/DataChannel references across prolonged transient `disconnected` states so WebRTC can recover without forcing a new QR pairing.
- Tear down application channel references only when the underlying peer actually reaches `failed` or `closed`.
- Preserve the last meaningful candidate-pair statistics when Chromium drops failed-pair reports, avoiding the misleading “no compatible candidate pair” diagnosis after a route had already connected.
- Add a specific diagnostic for “connected once, then connectivity-check replies stopped,” matching the observed connected → disconnected → failed transition.

## 1.0.1 - 2026-09-01

- Expand direct-WebRTC diagnostics with candidate-pair attempt counts and connectivity-check send/receive counters from `RTCPeerConnection.getStats()`.
- Add plain-language likely-cause guidance for no compatible pair, no connectivity checks, no reply, local reply failure, asymmetric connectivity, and successful-but-unselected pairs.
- Refresh diagnostics once per second while ICE is checking and stop polling after connect/fail/close.
- Keep candidate diagnostics privacy-preserving by reporting transport/type/address family rather than raw IP addresses.

## 1.0.0 - 2026-09-01

- Promote Presentation Remote to the first stable release after the v0.9.0 live-presentation UX pass and the v0.8.x Presenter View reliability/fidelity fixes.
- Keep protocol v4 and the existing local-first architecture unchanged: the source PPTX / PDF remains on the presenting computer, while control data, low-resolution current/next previews and speaker notes travel directly to the paired phone over WebRTC.
- Complete release regression coverage for PPTX initial text/layout, Japanese theme fonts, thumbnail rendering, renderer serialization, Presenter View fidelity/transfer/timeouts, motion pointer mapping, Wake Lock, reconnect flow, speaker-note sizing, slide jump and operation feedback.
- Refresh Japanese and English release screenshots, add explicit browser-support notes, and align README / APP_SPEC / visible version metadata with v1.0.0.
- No new runtime CDN, signaling server, STUN/TURN service, analytics, telemetry or document-upload path is introduced.

## 0.9.0 - 2026-09-01

- Strengthen the phone remote for real presentation use without changing the local-first/WebRTC-only data model.
- Request Screen Wake Lock while the phone remote is connected, show the current sleep-prevention state, re-acquire it after returning to the tab, and release it after final disconnect. Unsupported or denied Wake Lock degrades gracefully.
- Add an explicit reconnecting state during the existing 8-second WebRTC recovery window. If recovery fails, show a persistent disconnected banner with a **Reconnect** action that restarts QR pairing while leaving the PC presentation intact.
- Improve speaker notes with persisted 11–19 px text sizing, internal scrolling for long notes, and automatic scroll-to-top whenever the slide changes.
- Make the top slide counter tappable and add a modal slide-move sheet with numbered slide buttons plus direct numeric entry. Large decks use compact first/current/last neighborhoods instead of rendering hundreds of controls.
- Add immediate visual command feedback and optional short vibration after a control message is successfully sent, without optimistically changing the remote slide state before the host confirms it.
- Preserve Presenter View fidelity/reliability work from v0.8.4, including high-fidelity PPTX previews, finite preview timeouts, 8 KB chunks, deck-revision invalidation and Control DataChannel fallback.
- Add v0.9.0 remote UX regression tests covering Wake Lock lifecycle, reconnect behavior, note controls, slide navigation and command feedback.

## 0.8.4 - 2026-09-01

- Fix Presenter View PPTX previews using a visually different renderer from the PC presenter, which could turn theme/background colors pale or white even though the main slide looked correct.
- Generate PPTX Presenter View previews from the same high-fidelity `@aiden0z/pptx-renderer` DOM used by the PC main slide and thumbnails.
- Reuse an already-rendered current slide or thumbnail when available; otherwise schedule the same high-fidelity renderer through the low-priority render gate.
- Flatten Canvas layers and local Blob-backed image resources into a self-contained DOM snapshot before converting it to the ~420 px WebP/JPEG transfer image, with a self-contained SVG fallback if bitmap encoding cannot finish.
- Keep `pptx-svg` only as the final Presenter View compatibility fallback instead of using it as the normal preview renderer.
- Preserve the v0.8.3 finite-timeout, control-channel transport, 8 KB chunking, deck-revision and speaker-note reliability fixes.

## 0.8.3 - 2026-08-31

- Fix the actual permanent Presenter View receive stall: the preview chunk decoder was scoped inside the embedded-asset loader IIFE, so the Presenter View receiver could not call it. Each chunk raised a `ReferenceError` that was then swallowed by the old decode guard, leaving metadata received but the image assembly incomplete.
- Add an app-scope Base64 decoder and regression-check an 8 KB encode/decode round trip.
- Set the application role as soon as pairing/channel setup begins and do not discard a host preview request merely because global role propagation is racing.
- Separate request-send timestamps from actual host progress. A no-response preview attempt now reaches a finite error state instead of resetting its own wait timer forever.
- Start and preserve the unresolved-preview attempt clock before transport lookup, so a temporarily missing DataChannel cannot reset the 30-second timeout on every retry.
- Remove the phone preview scheduler's dependency on global `state.role`; a connected remote can request previews as soon as the reliable control channel is usable.
- When a request arrives before the deck is ready, acknowledge it with a progress state; when deck revisions disagree, immediately resync host state instead of silently dropping the request.
- Make the already-established reliable control DataChannel the primary Presenter View transport so preview delivery no longer depends on the third preview channel opening correctly.
- Add finite timeouts around PPTX preview renderer startup, SVG image loading, and preview encoding.
- Fall back to a sanitized portable SVG preview when PPTX SVG rasterization cannot complete.
- Send Presenter View progress messages and show requesting / generating / receiving / slow states on the phone instead of leaving an indefinite “Preparing preview…” placeholder.
- Keep the 8 KB raw chunk ceiling and existing deck-revision cache invalidation.

## 0.8.2 - 2026-08-31

- Fix Presenter View previews that could remain on “Preparing preview…” indefinitely.
- Reduce raw preview chunks from 12 KB to 8 KB so Base64 + JSON messages stay safely below legacy 16 KB DataChannel message limits.
- Treat failed preview-meta / preview-chunk sends as real errors instead of silently dropping chunks.
- Fall back to the reliable control DataChannel when the dedicated `presentation-preview` channel is unavailable, while continuing to prefer the dedicated channel when it is open.
- Reply on the same DataChannel that carried a fallback preview request, avoiding asymmetric channel-open races.
- Keep preview generation failures visible as “Preview unavailable” instead of repeatedly resetting the UI to “Preparing preview…”.
- Retain the v0.8.1 retry-race fix: repeated requests share in-progress PPTX initialization and slide rasterization.

## 0.8.0 - 2026-08-31

- Add Presenter View to the phone remote with a larger current-slide preview, a smaller next-slide preview, and collapsible speaker notes.
- Keep **Next** dominant over **Previous**, preserve the existing simple remote behind a Presenter View toggle, and add dedicated portrait / short-landscape layouts.
- Move black screen / pointer / More into a compact right-side action rail on short landscape phones so Presenter View and navigation remain within the viewport.
- Add a third ordered `presentation-preview` WebRTC DataChannel so preview traffic cannot block the reliable control queue.
- Generate only the requested current + next low-resolution previews at about 420 px wide, prefer WebP with JPEG fallback, transfer raw image data in 12 KB chunks, and cap the phone preview cache at four entries.
- Extract PPTX speaker notes locally through the slide → notesSlide relationship and `body` placeholder; explicitly explain that PDF has no PowerPoint speaker notes.
- Bump the application protocol to v4 and add deck-revision cache invalidation so changing the source deck cannot leave stale previews or notes on the phone.
- Stop Presenter View preview requests and release cached preview Blob URLs when Presenter View is disabled.
- Update privacy copy to state precisely that the source PPTX/PDF remains on the PC while control data, low-resolution previews, and speaker notes are sent directly to the paired phone over WebRTC.
- Add Presenter View protocol / DOM / privacy regression checks while retaining the existing PPTX, thumbnail, font, initial-render and motion-pointer regressions.

## 0.7.8 - 2026-08-31

- Fix the first visible PPTX slide losing text on initial file load by letting the renderer complete its dynamic text-fit pass while the slide is attached to the real presentation surface.
- Perform one hidden connected stabilization pass before the first visible PPTX render; this mirrors the layout state that previously only existed after navigating away and back.
- Remove the detached warm-up render added in v0.7.7, which did not reproduce the browser layout conditions of the real slide surface.
- Keep Japanese theme font resolution, Office SVG icon recovery, serialized PPTX rendering, thumbnail text fixes, and WebRTC/motion-pointer behavior unchanged.

## 0.7.7 - 2026-08-31

- Fix first-load PPTX text disappearing until the slide is rendered a second time.
- Preload the slide theme's Japanese font (for the supplied deck, Meiryo) before the first visible high-fidelity render so browser font metrics are ready for PowerPoint text auto-fit.
- Run one hidden warm-up render for the initial slide, then render the visible slide after the font/layout pipeline has been primed; this mirrors the previously reliable second-render path without showing a blank first frame.
- Wait for the renderer's deferred text auto-fit / font layout frames before exposing the initial main slide.
- Preserve v0.7.6 thumbnail serialization, v0.7.4 Japanese theme-font correction, and SVG-only Office icon compatibility.

## 0.7.6 - 2026-08-31

- Fix the remaining first-thumbnail text loss by removing concurrent HiFi renderer calls against the same mutable PPTX presentation model.
- Render the current/main slide before starting background thumbnail generation.
- Add a priority render gate: PPTX rendering is serialized, and presenter navigation always runs before the next thumbnail job, avoiding race regressions without making page changes wait for the full thumbnail queue.
- Keep the v0.7.4 Japanese theme-font correction and SVG-only Office icon compatibility unchanged.
- Gzip the embedded QR generator asset in standalone builds; this is a small size reduction with no runtime feature loss because the standalone asset loader already decompresses other embedded dependencies.
- Keep the high-fidelity PPTX renderer, local `pptx-svg` fallback, PDF.js CMaps/standard fonts, and offline/runtime-network guarantees unchanged.

## 0.7.5 - 2026-08-31

- Fixed PPTX thumbnail text disappearing for placeholders and SmartArt labels positioned outside the thumbnail viewport's unscaled layout box.
- Keep the full-size slide root in normal flow for thumbnail scaling instead of forcing it to absolute positioning.
- Refit PPTX thumbnails after insertion using the actual thumbnail host size so the full slide is contained without unintended cropping.
- Preserved the v0.7.4 Japanese theme-font fix and v0.7.1 SVG-only Office icon compatibility.

## 0.7.4 - 2026-08-31

- Fix Japanese PowerPoint theme-font resolution against the actual per-slide `slide → layout → master → theme` chain used by the high-fidelity renderer.
- Fix a v0.7.1–v0.7.3 compatibility bug that looked for a nonexistent `presentation.theme` property, causing the Japanese Jpan font override to silently do nothing.
- Prefer the theme's `Jpan` script face before generic East Asian fallback when resolving Japanese text. In the supplied test deck this resolves the PowerPoint UI label “メイリオ 見出し” to the actual theme face `メイリオ`.
- Keep the v0.7.3 thumbnail nested-SVG fix and the v0.7.1 Office SVG-icon compatibility path unchanged.

## 0.7.3 - 2026-08-31

- Fix PPTX thumbnail text/shape rendering by limiting the thumbnail sizing rule to the preview root SVG/Canvas only.
- Stop `.thumb-preview svg` from resizing every nested SVG emitted by the high-fidelity PPTX renderer; nested shape SVGs now keep their intrinsic geometry and no longer cover or distort text in thumbnails.
- Keep the main-slide rendering, SVG-only Office icon compatibility patch, and Japanese font compatibility logic unchanged while the remaining PowerPoint font-metric difference is investigated against the source deck.

## 0.7.2 - 2026-08-30

- Fix PowerPoint theme UI families such as `メイリオ 見出し` / `メイリオ 本文` by resolving them to the actual installed `Meiryo` family before browser font selection.
- Add equivalent heading/body aliases for Meiryo and Yu Gothic, including parenthesized Office-style labels.
- Normalize explicit Office font stacks before the existing Japanese Jpan/East-Asian theme fallback, so a pseudo family name is not mistaken for an already-compatible Japanese font.
- Keep the SVG-only PowerPoint icon compatibility fix from v0.7.1 unchanged.

## 0.7.1 - 2026-08-30

- Improved Japanese Office theme-font fallback so Japanese text prefers the deck's Jpan/East-Asian theme font instead of falling through to an unrelated browser font.
- Added aliases for Yu Gothic / Meiryo / MS Gothic families used by Japanese PowerPoint installations.
- Added support for PowerPoint SVG-only pictures (`asvg:svgBlip`) used by Insert > Icons when no raster `a:blip r:embed` fallback is present.
- Kept all PPTX fixes local to the browser; no external conversion or font service was introduced.

## 0.7.0 - 2026-08-30

- Replace `pptx-svg` as the primary visual path with pinned `@aiden0z/pptx-renderer@1.2.4` and its self-contained browser ESM build.
- Target the major fidelity gaps seen in real PowerPoint decks: slide/layout/master backgrounds, seven-level text inheritance, SmartArt fallback data, groups, connectors, tables and charts.
- Render each slide at intrinsic PowerPoint dimensions and scale the completed DOM uniformly for the presenter stage and thumbnails, including resize/fullscreen refit.
- Retain `pptx-svg@0.6.5` as an automatic local compatibility fallback if the primary renderer cannot parse/build a deck.
- Surface primary-renderer node errors by affected slide in the compatibility panel and clearly indicate when the fallback renderer is active.
- Keep PPTX/PDF bytes local and production runtime networking blocked; no conversion service or CDN is introduced.

## 0.6.1 - 2026-08-30

- Correct the motion-pointer axes so the empirically observed phone motions map naturally: right → pointer right, left → pointer left, up → pointer up, down → pointer down.
- Centralize calibrated angle-to-screen mapping in a pure helper and add a regression test for all four directions, wrap-around, dead-zone and clamping.

## 0.6.0 - 2026-08-30

- Move **Black screen**, **Pointer** and **More** out of the middle of the phone remote and into a bottom action bar; on portrait phones the bar stays reachable at the bottom of the viewport.
- Add a motion-pointer mode alongside the existing touch pointer.
- Request `DeviceOrientationEvent` permission from a user gesture on platforms that require it and show explicit unsupported / HTTPS-required / denied states.
- Add center calibration, Freeze / Resume, sensitivity, dead-zone and three-level stabilization controls.
- Persist motion-pointer tuning locally in the browser.
- Send motion pointer positions as lossy absolute normalized coordinates so dropped/reordered packets do not accumulate drift.
- Fall back to screen-plane tilt when a browser does not expose an alpha/yaw value, and re-require center calibration when the phone orientation changes.
- Bump the app control/pointer protocol to v3 for the absolute-pointer message.

## 0.5.0 - 2026-08-30

- Redesign the phone remote around presentation use: make **Next** the dominant target and keep **Previous** smaller.
- Add horizontal swipe navigation with distance/direction/time thresholds. Any meaningful drag suppresses the underlying button click so vertical/short drags and recognized swipes cannot cause accidental navigation.
- Move lower-frequency actions into a compact **More** panel: direct slide jump, timer reset, vibration preference and disconnect.
- Show the touchpad only while the pointer is enabled, and add a dedicated **Recenter** action.
- Add optional short vibration feedback for navigation/mode actions on supported phones, remembered locally per browser.
- Make black-screen and pointer states visually explicit with `aria-pressed` state, disable Previous/Next at deck boundaries, and ensure the first command immediately after connection is never swallowed by the debounce guard.
- Tighten the connected/reconnecting status presentation and optimize the remote layout for portrait and short landscape phone screens.
- Hide the footer and reduce page chrome while the phone is actively being used as the remote.

## 0.4.1 - 2026-08-30

- Fix `pptx-svg` startup in the standalone Blob-module loader. The package resolves `./main.wasm` against `import.meta.url` at module evaluation time; a Blob module cannot be used as a base URL for that relative path.
- Patch only the package's automatic Wasm URL constant at runtime and continue passing the embedded Wasm bytes directly to `PptxRenderer.init()`.
- Add a fail-fast guard so a future `pptx-svg` source-layout change reports `PPTX_WASM_URL_PATCH_FAILED` instead of an opaque `Invalid URL`.

## 0.4.0 - 2026-08-30

- Replace the minimal in-house PPTX SVG renderer with pinned `pptx-svg@0.6.5` + embedded Wasm and its local ES module graph.
- Greatly improve PPTX fidelity for rich text, themes, shapes, group transforms, image crops/effects, tables, charts, SmartArt fallbacks and other advanced PowerPoint content.
- Keep an advisory PPTX compatibility scan for static animations/transitions, media behavior, hidden slides and embedded-font fallback.
- Add WebRTC protocol v2 with per-client command sequence numbers and duplicate suppression.
- Add ping/pong liveness and latency measurement.
- Add an 8-second temporary-disconnect recovery window and full state re-sync after recovery.
- Treat the remote as connected only after the reliable control DataChannel is actually open.
- Add low-latency pointer backpressure protection and phone Screen Wake Lock support.

## 0.3.1 - 2026-08-30

- Restore the original first-screen flow: opening a PPTX / PDF on the computer implicitly starts the presenter.
- Remove the redundant **Start as host** role-selection button while keeping the phone-remote entry point.
- Keep the development HTTPS tunnel and PDF font/CMap fixes introduced in v0.3.0.

## 0.3.0 - 2026-08-30

- Replace LAN-HTTP phone development with a temporary trusted HTTPS Quick Tunnel so mobile camera / QR APIs are available during development.
- Replace the Python development server with a PowerShell loopback server; `start-dev.bat` can obtain `cloudflared` as a development-only tool when needed.
- Add explicit initial role selection: **Start as host** or **Use as phone remote**.
- Embed PDF.js packed CMaps and standard font data into the standalone build.
- Add an embedded PDF.js `BinaryDataFactory` so CMaps and non-embedded standard fonts are resolved without runtime network access.

## 0.2.0 - 2026-08-29

- Replace browser PDF iframe viewing with local PDF.js Canvas rendering.
- Add PDF thumbnails and reliable page counting through PDF.js.
- Add development-only one-QR automatic WebRTC signaling.
- Keep production QR pairing serverless; the development relay is only available from the local development server.

## 0.1.0 - 2026-08-29

- Initial Presentation Remote implementation.
- Added local PPTX parsing/rendering for text, images, basic shapes, fills and placeholder geometry.
- Added advisory PPTX compatibility checks for advanced/unsupported content.
- Added local PDF presentation fallback through the browser PDF renderer.
- Added desktop presenter layout with thumbnails, keyboard navigation, fullscreen, blank screen and timer.
- Added the canonical fully serverless QR WebRTC pairing flow from the single-HTML template.
- Added separate reliable control and low-latency pointer DataChannels.
- Added smartphone remote UI with next/previous, jump, blank screen and touch pointer controls.
