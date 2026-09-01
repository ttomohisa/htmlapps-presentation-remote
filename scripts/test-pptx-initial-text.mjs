import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');

const classStart = html.indexOf('class HiFiPptxDeck');
const classEnd = html.indexOf('class PptxSvgDeck', classStart);
assert.ok(classStart >= 0 && classEnd > classStart, 'HiFiPptxDeck missing');
const deckSource = html.slice(classStart, classEnd);
assert.ok(deckSource.includes('this.initialConnectedPassPending=true'), 'initial connected stabilization flag missing');
assert.ok(deckSource.includes('async settleAttachedMain(frame,index)'), 'attached text settlement method missing');
assert.ok(deckSource.includes("if(this.disposed||!frame?.isConnected||!this.presentation)return"), 'text settlement must only run on an attached frame');
assert.ok(!deckSource.includes('primeInitialMain('), 'detached initial warm-up must not remain');
assert.ok(!deckSource.includes('if(!thumb)await settlePptxTextLayout()'), 'main text must not settle before attachment');
assert.ok(deckSource.includes('await preparePptxThemeFonts(this.presentation,index)'), 'theme fonts are not prepared before the first main render');

const renderStart = html.indexOf('async function renderCurrent()');
const renderEnd = html.indexOf('function buildThumbs', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'renderCurrent missing');
const renderCurrent = html.slice(renderStart, renderEnd);
const appendPos = renderCurrent.indexOf('surface.append(view)');
const settlePos = renderCurrent.indexOf('await state.deck.settleAttachedMain?.(view,state.current)');
assert.ok(appendPos >= 0 && settlePos > appendPos, 'main PPTX text must settle only after the frame is attached');
assert.ok(renderCurrent.includes('const firstConnectedPass=Boolean(state.deck.needsInitialConnectedPass?.())'), 'first connected pass detection missing');
assert.ok(renderCurrent.includes('view=await state.deck.render(state.current,false)'), 'first connected pass is not followed by a fresh render');
assert.ok(renderCurrent.includes('state.deck.finishInitialConnectedPass?.()'), 'initial connected pass is not marked complete');
assert.ok(renderCurrent.includes("view.style.visibility='hidden'"), 'stabilization pass should not flash incomplete text');

function takeFunction(name, nextName) {
  const start = html.indexOf(`function ${name}`);
  const end = html.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Could not extract ${name}`);
  return html.slice(start, end);
}
const code = [
  takeFunction('officeFontAliases', 'cssFontToken'),
  takeFunction('cssFontToken', 'splitCssFontFamily'),
  takeFunction('themeForSlide', 'themeJapaneseFont'),
  takeFunction('themeJapaneseFont', 'japaneseFontCompatibilityStack'),
].join('\n');
const loaded = [];
const fakeFonts = {
  load: async (spec, sample) => { loaded.push({ spec, sample }); return []; },
  ready: Promise.resolve(),
};
const context = {
  document: { fonts: fakeFonts },
  setTimeout: (fn) => { fn(); return 0; },
  Promise,
};
vm.createContext(context);
vm.runInContext(`${code}\nthis.preparePptxThemeFonts=preparePptxThemeFonts;`, context);
const theme = {
  majorFont: { latin: 'Century Gothic', ea: '', cs: '', scripts: { Jpan: 'メイリオ' } },
  minorFont: { latin: 'Century Gothic', ea: '', cs: '', scripts: { Jpan: 'メイリオ' } },
};
const presentation = {
  slides: [{ layoutIndex: 'layout1' }],
  slideToLayout: new Map([[0, 'layout1']]),
  layoutToMaster: new Map([['layout1', 'master1']]),
  masterToTheme: new Map([['master1', 'theme1']]),
  themes: new Map([['theme1', theme]]),
};
await context.preparePptxThemeFonts(presentation, 0);
assert.ok(loaded.some(({ spec }) => /Meiryo/.test(spec)), 'Meiryo is not proactively loaded');
assert.ok(loaded.every(({ sample }) => sample.includes('テスト')), 'Japanese sample text is not used for font loading');

console.log('PPTX initial connected text-layout regression checks passed');
