import fs from 'node:fs';

const html = fs.readFileSync('src/index.template.html', 'utf8');
const fail = message => { throw new Error(message); };
const must = (needle, label = needle) => { if (!html.includes(needle)) fail(`Missing preview-fidelity invariant: ${label}`); };
const mustMatch = (re, label) => { if (!re.test(html)) fail(`Missing preview-fidelity invariant: ${label}`); };

must("state.deck?.engine!=='hifi'", 'high-fidelity availability gate');
must("#slideSurface .pptx-dom-frame:not(.pptx-thumb-frame)", 'reuse currently displayed high-fidelity slide');
must('pptx-dom-frame.pptx-thumb-frame', 'reuse high-fidelity thumbnail');
must('copyCanvasPreviewPixels(originalRoot,cloneRoot)', 'Canvas preservation');
must("original.toDataURL('image/png')", 'Canvas pixel capture');
must('inlineHiFiPreviewResources(root)', 'Blob resource inlining');
must("value?.startsWith('blob:')", 'Blob-backed image detection');
must('Promise.all([...urls].map(async url=>', 'Blob resources are resolved in parallel');
must('new XMLSerializer().serializeToString(clone)', 'DOM serialization');
must('<foreignObject', 'HTML/SVG snapshot wrapper');
must("deck.renderGate.run('thumb'", 'low-priority same-renderer job');
must('deck.lib.renderSlide(deck.presentation,slide', 'primary PPTX renderer reuse');
must("pdfjs:false", 'no runtime PDF fallback introduced');
must("console.warn('[Presenter high-fidelity preview failed; trying SVG compatibility renderer]'", 'explicit final fallback logging');

const start = html.indexOf('async function generatePresenterPreview(index)');
const end = html.indexOf('async function sendPreviewImage', start);
const generator = start >= 0 && end > start ? html.slice(start, end) : '';
if (!generator) fail('Could not extract Presenter View generator');
const hifi = generator.indexOf('renderHiFiPresenterPreview(index)');
const fallback = generator.indexOf('generateFallbackPptxPresenterPreview(index)');
if (hifi < 0 || fallback < 0 || hifi > fallback) fail('pptx-svg compatibility renderer is not strictly after the high-fidelity path');

if (/renderHiFiPresenterPreview[\s\S]*?loadPptxFallback/.test(generator.slice(0, fallback))) fail('High-fidelity path unexpectedly initializes pptx-svg before it fails');

console.log('Presenter View high-fidelity PPTX preview regression checks passed.');
