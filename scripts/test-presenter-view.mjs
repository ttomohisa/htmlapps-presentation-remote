import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('src/index.template.html', 'utf8');
const must = (needle, label = needle) => {
  if (!html.includes(needle)) throw new Error(`Missing Presenter View invariant: ${label}`);
};
const mustMatch = (re, label) => {
  if (!re.test(html)) throw new Error(`Missing Presenter View invariant: ${label}`);
};

const appScript = html.split('<script>').at(-1)?.split('</script>')[0] ?? '';
if (!appScript.includes('function base64ToBytes(base64)')) throw new Error('Presenter View app scope is missing its own Base64 decoder');
if (appScript.includes('decodeBase64Bytes(String(msg.data')) throw new Error('Preview chunks still call the asset-bundle-only Base64 decoder');

const codecSource = [
  appScript.match(/function bytesToBase64\(bytes\)\{[^\n]+\}/)?.[0],
  appScript.match(/function base64ToBytes\(base64\)\{[^\n]+\}/)?.[0]
].filter(Boolean).join('\n');
if (!codecSource.includes('base64ToBytes')) throw new Error('Could not extract Presenter View Base64 codec');
const codec = { Uint8Array, atob, btoa };
vm.createContext(codec);
vm.runInContext(`${codecSource}; this.__enc=bytesToBase64; this.__dec=base64ToBytes;`, codec);
const roundtripInput = Uint8Array.from({length:8192}, (_, i) => (i * 31 + 7) & 255);
const roundtripOutput = codec.__dec(codec.__enc(roundtripInput));
if (roundtripOutput.length !== roundtripInput.length || roundtripOutput.some((v,i)=>v!==roundtripInput[i])) throw new Error('Presenter View Base64 chunk roundtrip failed');

const chunkMatch = html.match(/const PREVIEW_CHUNK_BYTES=(\d+)\*1024/);
if (!chunkMatch) throw new Error('Could not read preview chunk size');
const rawChunkBytes = Number(chunkMatch[1]) * 1024;
const sampleChunkMessage = JSON.stringify({type:'preview-chunk',v:4,id:'1-0-request-abcdefghijkl',requestId:'1-0-abcdefghijkl',revision:1,index:0,seq:0,data:Buffer.alloc(rawChunkBytes).toString('base64')});
if (Buffer.byteLength(sampleChunkMessage, 'utf8') >= 16 * 1024) throw new Error(`Preview chunk JSON is too large for a 16KB DataChannel ceiling: ${Buffer.byteLength(sampleChunkMessage, 'utf8')} bytes`);

must("const PREVIEW_CHANNEL='presentation-preview'", 'dedicated preview DataChannel');
must('const PROTOCOL_VERSION=4', 'protocol v4');
must('const PREVIEW_TARGET_WIDTH=420', '420px preview target');
must('const PREVIEW_CHUNK_BYTES=8*1024', '8KB raw preview chunks');
must('const PREVIEW_CACHE_LIMIT=4', 'small preview cache');
must('createDataChannel(PREVIEW_CHANNEL,{ordered:true})', 'preview channel creation');
mustMatch(/indexes:missing[\s\S]*?notesIndex:index/, 'preview request payload');
mustMatch(/Array\.from\(new Set\([\s\S]*?\)\)\.slice\(0,2\)/, 'current + next request cap');
mustMatch(/deckRevision:state\.deckRevision/, 'deck revision in host state');
mustMatch(/incomingRevision!==state\.remote\.deckRevision[\s\S]*?previewCacheClear\(\)/, 'remote cache invalidation');
must('async function extractPptxSpeakerNotes', 'speaker-note extraction');
must('/\\/notesSlide$/i', 'notesSlide relationship lookup');
must("toLowerCase()!=='body'", 'body placeholder filter');
must("pdfNoSpeakerNotes:'PDFにはPowerPointの発表者ノートはありません。'", 'PDF note explanation');
mustMatch(/if\(!state\.remoteUi\.presenterView\|\|!state\.remote\.connected\|\|state\.remote\.reconnecting\)return/, 'Presenter View OFF or disconnected remote stops preview requests');
if (/scheduleRemotePreviewRequest\(force=false\)\{[^\n]*state\.role/.test(html)) throw new Error('Remote preview scheduling must not depend on global state.role');
mustMatch(/const ch=previewTransportChannel\(\);if\(!ch\)\{state\.remoteUi\.previewRequestTimer=setTimeout\(\(\)=>scheduleRemotePreviewRequest\(true\),1000\);return\}/, 'missing preview channel retries instead of waiting forever');
mustMatch(/lastPreviewRequestKey=key[\s\S]*?const ch=previewTransportChannel\(\)/, 'preview attempt key is committed before a missing-channel retry');
mustMatch(/setRemotePresenterView\(enabled[\s\S]*?previewCacheClear\(\)/, 'Presenter View OFF clears preview data');
must('id="remotePresenterView"', 'Presenter View DOM');
must('id="remoteCurrentPreview"', 'current preview DOM');
must('id="remoteNextPreview"', 'next preview DOM');
must('id="remoteNotes"', 'speaker notes DOM');
must('id="remotePresenterToggle"', 'Presenter View toggle');
mustMatch(/loadPptxFallback\(buffer,file,generation,\{withCompatibility:false\}\)/, 'preview renderer skips duplicate compatibility scan');


must('function existingHiFiPreviewFrame(index)', 'existing high-fidelity DOM reuse');
must('function buildHiFiPreviewSvg(originalRoot,width,height)', 'high-fidelity DOM snapshot builder');
must('function copyCanvasPreviewPixels(originalRoot,cloneRoot)', 'Canvas layers are flattened into the snapshot');
must('function inlineHiFiPreviewResources(root)', 'local Blob resources are inlined');
must('function renderHiFiPresenterPreview(index)', 'high-fidelity Presenter View preview path');
must('function generateFallbackPptxPresenterPreview(index)', 'compatibility renderer remains a final fallback');
mustMatch(/existingHiFiPreviewFrame\(index\)[\s\S]*?#slideSurface \.pptx-dom-frame/, 'current slide DOM is preferred for preview snapshots');
mustMatch(/thumbList \.thumb\[data-index=\"\$\{index\}\"\][\s\S]*?pptx-thumb-frame/, 'high-fidelity thumbnail DOM is reused when available');
mustMatch(/deck\.renderGate\.run\('thumb'[\s\S]*?deck\.lib\.renderSlide/, 'missing preview DOM is rendered by the same high-fidelity engine at low priority');
mustMatch(/XMLSerializer[\s\S]*?<foreignObject/, 'high-fidelity DOM is serialized through a foreignObject snapshot');
mustMatch(/state\.deck\?\.engine==='hifi'[\s\S]*?renderHiFiPresenterPreview\(index\)[\s\S]*?generateFallbackPptxPresenterPreview\(index\)/, 'high-fidelity path runs before pptx-svg fallback');


mustMatch(/if\(!sendPreviewJson\(\{type:'preview-chunk'[\s\S]*?\)\)throw new Error\('PREVIEW_CHUNK_SEND_FAILED'\)/, 'chunk send failure is not silently ignored');
mustMatch(/respondPresenterRequest\(msg,responseChannel=null\)[\s\S]*?sendPreviewImage\(index,requestId,revision,token,channel\)/, 'preview replies stay on the request channel');

must('function previewTransportChannel()', 'preview transport selection');
mustMatch(/function previewTransportChannel\(\)\{const dedicated=state\.channels\.preview;if\(dedicated\?\.readyState==='open'\)return dedicated;return null\}/, 'dedicated preview channel is the normal preview transport');
if (/function previewTransportChannel\(\)\{[^}]*state\.channels\.control/.test(html)) throw new Error('Presenter View bulk transfer must not prefer the control channel');
mustMatch(/startsWith\(['"]preview-['"]\)[\s\S]*?handlePreviewMessage/, 'preview messages tunneled over control channel');
must('previewErrors:new Map()', 'persistent remote preview error state');
mustMatch(/function previewPlaceholderText[\s\S]*?previewErrors\.has\(index\)[\s\S]*?previewUnavailable/, 'current preview failure remains visible');



mustMatch(/PREVIEW_CHUNK_DECODE_FAILED/, 'chunk decode failure becomes a visible preview error');
mustMatch(/function openPair\(mode\)\{state\.role=mode;/, 'pairing role is set before DataChannel traffic');
mustMatch(/function rememberChannel\(role,channel\)\{if\(role==='host'\|\|role==='join'\)state\.role=role;/, 'channel discovery also synchronizes app role');
if (/respondPresenterRequest\(msg,responseChannel=null\)\{if\(state\.role!==['"]host['"]/.test(html)) throw new Error('Preview requests must not be dropped while host role propagation is racing');
must('previewAttemptStartedAt:0', 'finite remote preview attempt clock');
mustMatch(/attemptAge>=30000[\s\S]*?PREVIEW_TIMEOUT/, 'preview request has a finite no-response timeout');
mustMatch(/previewLastProgressAt\?now-state\.remoteUi\.previewLastProgressAt:Infinity/, 'host progress is tracked separately from request send time');
must("notesUnavailable:'ノートを表示できません。'", 'speaker-note failure state');
must('function previewTimeout(promise,ms,code)', 'preview generation timeout guard');
mustMatch(/previewTimeout\(loaded,5000,'PREVIEW_IMAGE_TIMEOUT'\)/, 'SVG image loading has a finite timeout');
mustMatch(/catch\(error\)\{console\.warn\('\[Presenter preview raster fallback\]'[\s\S]*?portableSvgPreview\(source\)/, 'raster failure falls back to portable SVG');
mustMatch(/loadPptxFallback\(buffer,file,generation,\{withCompatibility:false\}\)/, 'preview renderer reuses the compatibility renderer without duplicate analysis');
mustMatch(/previewTimeout\(rawPromise,12000,'PREVIEW_RENDERER_TIMEOUT'\)/, 'preview renderer initialization has a finite timeout');
must("type:'preview-status'", 'host progress status');
must("previewStatus:new Map()", 'remote preview progress state');
mustMatch(/sendPreviewJson\(\{type:'preview-request'[\s\S]*?,ch\)/, 'preview request explicitly uses the dedicated selected transport');

must('pptxPreviewDeckPromise:null', 'shared PPTX preview initialization promise');
must('hostInflight:new Map()', 'shared in-flight slide preview generation');
mustMatch(/const token=state\.preview\.hostToken,indexes=/, 'preview retry does not invalidate in-flight generation');
if (/respondPresenterRequest\([\s\S]*?\+\+state\.preview\.hostToken/.test(html)) throw new Error('Presenter preview requests must not cancel in-flight preview generation');
mustMatch(/channel\.label===PREVIEW_CHANNEL&&channel\.readyState===['"]open['"]&&role===['"]join['"][\s\S]*?scheduleRemotePreviewRequest\(true\)/, 'already-open preview channel triggers request');
must('id="versionBadge">v1.0.3', 'visible v1.0.3 badge');
must('@media(max-height:560px) and (orientation:landscape) and (max-width:1000px)', 'short landscape layout');
must('.remote-mode .remote-tools{left:auto;right:7px;', 'landscape side action rail');

for (const stale of [
  '操作情報だけ',
  'Only small control/state messages and pointer events'
]) {
  if (html.includes(stale)) throw new Error(`Stale privacy claim remains: ${stale}`);
}

console.log('Presenter View v1.0.3 protocol / timeout / fidelity / channel isolation / DOM / privacy regression checks passed.');
