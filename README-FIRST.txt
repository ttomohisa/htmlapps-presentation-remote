Presentation Remote
=================================

1. Read README.ja.md for the app behavior and current limitations.
2. Read APP_SPEC.md for the product contract and acceptance criteria.
3. Read AGENTS.md before modifying the source.
4. The app implementation lives in src/index.template.html.
5. Keep components/webrtc-qr-pairing.html aligned with the canonical template component.
6. WebRTC QR, PPTX renderer, compatibility fallback, and PDF.js dependencies are pinned in dependencies.json. PDF.js standard-font data and packed CMaps are embedded at build time.
7. On Windows, run build-standalone.bat for the production standalone files.
8. During PC/phone development, run start-dev.bat. It uses a local PowerShell server plus a temporary HTTPS Quick Tunnel so the phone camera can be used. Python is not required.
9. Development tunneling is never part of the production standalone HTML. Production keeps the serverless two-way QR pairing flow.
10. Test dist/index.html and dist/index.self-extract.html on PC and phone, preferably on the same Wi-Fi with the external network disconnected.

Do not edit generated files under dist/ directly.
