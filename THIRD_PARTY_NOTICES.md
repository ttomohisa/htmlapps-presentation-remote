# Third-party notices

Browser Kitty Presentation Remote embeds the following pinned browser libraries at build time. They are not loaded from a CDN at runtime.

## qrcode-generator 1.4.4

- Package: `qrcode-generator`
- License: MIT
- Homepage: https://github.com/kazuhikoarase/qrcode-generator
- Purpose: Generate the manual WebRTC Offer / Answer QR pages.

## jsQR 1.4.0

- Package: `jsqr`
- License: Apache-2.0
- Homepage: https://github.com/cozmo/jsQR
- Purpose: QR decoding fallback when the browser does not expose a usable `BarcodeDetector`.

## @aiden0z/pptx-renderer 1.2.4

- Package: `@aiden0z/pptx-renderer`
- License: Apache-2.0
- Project: https://github.com/aiden0z/pptx-renderer
- Purpose: primary browser-native PPTX parsing and PowerPoint-oriented HTML/SVG/Canvas rendering.

The standalone browser ESM bundle is embedded at build time. Its browser bundle includes the renderer's required JSZip and ECharts runtime. Presentation Remote does not load it from a CDN at runtime and does not upload PPTX files to a conversion service.

The upstream browser bundle also contains `mtx-decompressor 1.4.2` (MPL-2.0) for embedded PowerPoint font handling. The corresponding source is available from the upstream project at https://github.com/ChristopherVR/mtx-decompressor/tree/v1.4.2 and remains governed by MPL-2.0. JSZip is distributed under MIT/GPLv3 terms and Apache ECharts under Apache-2.0; their upstream notices remain part of the pinned renderer distribution.

## pptx-svg 0.6.5

- Package: `pptx-svg`
- License: MIT
- Project: https://github.com/t-ujiie-g/pptx-svg
- Purpose: compatibility fallback for local PPTX parsing and SVG rendering.

The JavaScript modules and Wasm binary required by `pptx-svg` are embedded at build time. It is retained as a local fallback when the primary PPTX renderer cannot load a deck.

## PDF.js / pdfjs-dist

- Version: 6.3.289
- License: Apache-2.0
- Project: https://github.com/mozilla/pdf.js
- Used for local PDF parsing and Canvas rendering.

PDF.js standard-font files and packed CMaps from the pinned `pdfjs-dist` package are embedded into the standalone build. The upstream `standard_fonts` directory contains Foxit and Liberation font resources with their respective upstream license notices. These resources are used only for local PDF rendering and are not fetched at runtime.

`cloudflared` may be downloaded by `start-dev.bat` as a development-only executable to provide a temporary trusted HTTPS origin. It is not embedded in or distributed with the generated standalone HTML.
