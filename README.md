# Browser Kitty Presentation Remote

[日本語 README](README.ja.md)

**Open a local PPTX / PDF without uploading it, then use a phone as a direct WebRTC presentation remote.**

Built on Browser Kitty's Single HTML App Template v1.1.0. No desktop app, phone app, browser extension, account, runtime CDN, analytics or telemetry is required.

![Presentation Remote desktop](assets/screenshot-en.png)

The phone remote is designed for both portrait and short-landscape screens; Presenter View shows the current slide, next slide and speaker notes without sending the source deck to the phone.

## v1.0.0 implementation

- Local PPTX / PDF loading, up to 150 MB
- PowerPoint-oriented local PPTX rendering with pinned `@aiden0z/pptx-renderer@1.2.4`
  - slide → layout → master background/template inheritance
  - seven-level text/style inheritance and embedded-font handling
  - 187+ preset/custom shapes, connectors and recursive groups
  - SmartArt fallback data, tables, images, gradients/patterns and charts
  - browser-native HTML/SVG/Canvas output with no conversion service
  - animations and transitions remain static
- Automatic compatibility fallback to the existing pinned `pptx-svg@0.6.5` engine if the primary renderer cannot load a deck
- Japanese Office theme fonts prefer the deck's East Asian / Jpan face and local Yu Gothic / Meiryo-style fallbacks instead of a mismatched browser font
- PowerPoint SVG-only pictures (`asvg:svgBlip`), including **Insert > Icons** objects without a raster fallback, are restored before rendering
- PPTX thumbnails preserve nested renderer SVG geometry so text and shape layers remain visible at small preview sizes
- PPTX rendering is serialized with presenter/main-slide priority so background thumbnails cannot race placeholder inheritance on the shared presentation model
- PPTX compatibility scan kept as an advisory layer for motion/media/hidden slides; node-level renderer failures are surfaced by affected slide
- Local PDF.js Canvas rendering with embedded standard-font data and packed CMaps
- Desktop presentation controls: next / previous, direct navigation, keyboard, black screen, fullscreen, timer and pointer
- Fully serverless QR WebRTC pairing using the template's canonical pairing component
- Stabilized WebRTC application protocol
  - reliable ordered control channel + lossy low-latency pointer channel
  - per-client command sequence numbers and duplicate suppression
  - ping/pong latency and liveness checks
  - 8-second temporary-disconnect recovery window
  - full presenter-state re-sync after recovery
  - pointer backpressure protection
  - phone Screen Wake Lock while connected when supported, with visible status and automatic re-acquisition after returning to the tab
  - explicit reconnecting state during the 8-second grace window, then a clear **Reconnect** action if the connection is lost
- Phone remote redesigned for live presentation use
  - dominant **Next** target with a smaller **Previous** target
  - horizontal swipe navigation with accidental-click suppression
  - black screen / pointer / More moved into a bottom action bar
  - pointer controls shown only while the pointer is enabled
  - switch between touch pointer and Device Orientation motion pointer
  - motion calibration, Freeze / Resume, sensitivity, dead zone and three-level stabilization
  - tap the slide counter to open a slide-move sheet; the same action remains available from **More**
  - compact numbered slide buttons plus direct number entry; very large decks show the first/current/last neighborhoods instead of hundreds of buttons
  - timer reset and disconnect remain in **More**
  - optional short vibration feedback on supported phones plus immediate visual feedback after a command is successfully sent
  - boundary-aware Previous/Next disabling
  - Presenter View enabled by default with a larger current-slide preview and a smaller next-slide preview
  - collapsible speaker notes with persisted 11–19 px text sizing, internal scrolling for long notes, and automatic scroll-to-top on slide change
  - a Presenter View toggle in **More** to return to the simple remote
  - short-landscape optimization that moves the tool bar to a right-side action rail so previews and **Next** remain on-screen
- Presenter View preview transfer over WebRTC
  - uses the already-established reliable Control DataChannel as the primary transport in v0.8.4; the third `presentation-preview` channel remains optional rather than a dependency
  - does not gate preview scheduling on global role propagation; an open reliable Control Channel is sufficient
  - preserves the unresolved-attempt clock across missing-channel retries so the 30-second timeout cannot reset itself
  - acknowledges not-ready requests and resynchronizes stale deck revisions instead of silently discarding requests
  - generates only the current + next previews requested by the phone at about 420 px wide
  - captures PPTX previews from the same high-fidelity `@aiden0z/pptx-renderer` DOM used by the PC presenter/thumbnail views, reusing an already-rendered current/thumbnail slide when available and otherwise rendering the same engine at low priority
  - flattens high-fidelity HTML/SVG/Canvas output into a self-contained preview, normally WebP/JPEG with a self-contained SVG fallback; the older `pptx-svg` renderer is now only the final compatibility fallback for Presenter View as well
  - sends WebP (JPEG fallback) in 8 KB raw chunks so Base64 + JSON stays below a 16 KB message ceiling, falls back to a portable SVG preview if rasterization cannot finish, and keeps at most four previews cached on the phone
  - keeps Base64 decoding inside the Presenter View application scope so received chunks can actually be reassembled
  - treats failed chunk sends and chunk-decode failures as visible transfer errors instead of silently waiting for missing chunks
  - tracks request-send time separately from host progress and moves an unanswered preview to a visible failure state after 30 seconds
  - establishes the application role before DataChannel traffic so the first preview request after pairing cannot be dropped by role propagation
  - invalidates preview/note caches by deck revision when the source changes
  - stops preview requests while Presenter View is disabled
  - shares in-progress PPTX preview initialization/rasterization across retries so slow first-time setup cannot cancel itself
- PPTX speaker-note extraction follows `slide → relationship → notesSlide` and reads the `body` placeholder
- PDF explicitly reports that PowerPoint speaker notes are unavailable
- Presentation continues locally if the phone drops
- Japanese / English UI

## Privacy and networking

The PPTX / PDF source file stays in the presenting computer's browser. The presentation file itself is not sent to the phone.

The phone receives control/state and pointer messages and, while Presenter View is enabled, **low-resolution previews of the current and next slides** plus **speaker notes**. Only the requested two previews are generated on the computer at about 420 px wide. All of this data is sent directly from the computer to the phone over WebRTC DataChannels.

Pairing uses `components/webrtc-qr-pairing.html` with no signaling server, STUN or TURN. Devices therefore normally need direct reachability on the same Wi-Fi / LAN. Guest isolation, VPNs and firewalls can prevent pairing.

## PPTX fidelity

v1.0.0 uses `@aiden0z/pptx-renderer@1.2.4` as the primary renderer, whose rendering pipeline is explicitly built around PowerPoint visual regression coverage. It reconstructs slide/layout/master inheritance, SmartArt fallback content, groups/connectors and the OOXML text/color cascade before rendering to browser DOM/SVG/Canvas.

Presenter View now uses that same primary renderer before preview transfer, so slide colors/backgrounds/text are derived from the same DOM used on the PC rather than from a separate fallback renderer. The previous `pptx-svg@0.6.5` renderer is retained as a compatibility fallback rather than the main path. If the primary renderer cannot parse a deck, Presentation Remote automatically retries with the fallback and reports that state in the compatibility panel.

Presentation Remote does not redistribute Office fonts. Embedded fonts are handled by the primary renderer when present; otherwise Office theme fonts are resolved against fonts installed on the presenting device. For Japanese text, the East Asian / Jpan theme face is preferred and common local aliases such as Yu Gothic and Meiryo are included as fallbacks.

It is still not PowerPoint itself: animations and transitions are static and unusual Office content can differ. The compatibility panel also reports slide-level renderer errors. PDF remains the recommended path when exact PowerPoint appearance is more important than presenting the original PPTX directly.

## Desktop shortcuts

Drop a PPTX / PDF onto the file area or choose a file; opening the deck implicitly makes that browser the presenter.

- `→` / `↓` / `PageDown` / `Space`: next
- `←` / `↑` / `PageUp`: previous
- `Home`: first slide
- `End`: last slide
- `B`: toggle black screen
- `F`: toggle fullscreen

Browser security requires fullscreen to be initiated by a user action on the presenting computer.

## Phone remote

1. Open the deck on the presenting computer and choose **Connect phone**.
2. On the phone choose **Use as phone remote** and complete the QR handoff.
3. After connecting, Presenter View shows the current slide larger, the next slide smaller, and speaker notes in a collapsible section. Disable Presenter View from **More** to return to the simple remote.
4. Use the large navigation targets or horizontal swipes. Tap the slide counter (for example `12 / 38`) to jump directly to another slide.
5. Expand speaker notes when needed; use **A− / A+** to adjust note text size. The preference stays on that phone.
6. If the connection becomes unstable, controls pause during the recovery window. If it cannot recover, use **Reconnect** to restart the QR pairing flow.
7. While connected, the phone attempts to keep the screen awake when the browser supports Screen Wake Lock.
8. Enable the pointer to choose **Touch** or **Motion**. Motion mode asks for sensor permission when required; aim the phone at the center of the presentation and press **Set center** before moving it.
9. Use Freeze / Resume, sensitivity, dead zone and stabilization to tune the motion pointer. Black screen, pointer and More stay in the lower action bar.

## Browser support

- Chrome / Edge: primary targets.
- Safari: WebRTC remote control is supported where the required browser APIs are available; Device Orientation and Wake Lock availability depends on the OS/browser version.
- Firefox: core presentation and WebRTC paths may work, but Chrome / Edge receive the primary release testing.
- Motion pointer requires a secure context and a browser that exposes Device Orientation.
- Fullscreen always requires a user gesture on the presenting computer.

## Build

On Windows 10 / 11:

```bat
build-standalone.bat
```

Outputs:

```text
dist/
├─ index.html
├─ index.self-extract.html
├─ dependency-manifest.json
├─ build-size-report.json
├─ self-extract-manifest.json
└─ .nojekyll
```

`dependencies.json` pins `qrcode-generator@1.4.4`, `jsqr@1.4.0`, `@aiden0z/pptx-renderer@1.2.4`, fallback `pptx-svg@0.6.5` and `pdfjs-dist@6.3.289`; their required assets are embedded at build time so there is no runtime CDN dependency.

## Main source files

```text
src/index.template.html
components/webrtc-qr-pairing.html
APP_SPEC.md
app.config.json
dependencies.json
```

See [AGENTS.md](AGENTS.md) for implementation rules and [docs/WEBRTC_QR_PAIRING.md](docs/WEBRTC_QR_PAIRING.md) for the reusable WebRTC component.

## Roadmap candidates

- validate long-session presentation behavior across more phone/browser combinations
- continue expanding the real-world PPTX regression set and reducing PowerPoint visual differences
- keep any additional presenter information subordinate to the primary phone controls

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.

## Development phone pairing

Run `start-dev.bat` to build the standalone HTML, serve the PC page on loopback, and create a temporary Cloudflare Quick Tunnel HTTPS URL for the phone. The trusted HTTPS origin allows the in-browser camera / QR scanner to work on mobile during development. If `cloudflared` is not available, the script downloads a development-only copy into `.tools/`; Python is not required. The development relay stores only WebRTC offer/answer data in memory and never receives the selected PPTX/PDF. App HTML and signaling requests do traverse the temporary tunnel during development. Production standalone HTML does not include the tunnel or relay and keeps the serverless two-way QR pairing flow. Use `start-dev-no-build.bat` to skip rebuilding after the first build.
