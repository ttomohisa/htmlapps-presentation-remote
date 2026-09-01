import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
function takeFunction(name, nextName) {
  const start = html.indexOf(`function ${name}`);
  const end = html.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Could not extract ${name}`);
  return html.slice(start, end);
}
const code = [
  takeFunction('officeFontAliases', 'cssFontToken'),
  takeFunction('cssFontToken', 'splitCssFontFamily'),
  takeFunction('splitCssFontFamily', 'normalizeOfficeFontStack'),
  takeFunction('normalizeOfficeFontStack', 'themeForSlide'),
  takeFunction('themeForSlide', 'themeJapaneseFont'),
  takeFunction('themeJapaneseFont', 'japaneseFontCompatibilityStack'),
  takeFunction('japaneseFontCompatibilityStack', 'applyJapaneseFontCompatibility'),
].join('\n');
const context = {};
vm.createContext(context);
vm.runInContext(`${code}\nthis.officeFontAliases=officeFontAliases;this.normalizeOfficeFontStack=normalizeOfficeFontStack;this.themeForSlide=themeForSlide;this.themeJapaneseFont=themeJapaneseFont;this.japaneseFontCompatibilityStack=japaneseFontCompatibilityStack;`, context);

assert.deepEqual([...context.officeFontAliases('メイリオ 見出し')], ['Meiryo', 'メイリオ']);
assert.deepEqual([...context.officeFontAliases('メイリオ（見出し）')], ['Meiryo', 'メイリオ']);
assert.deepEqual([...context.officeFontAliases('Meiryo (Headings)')], ['Meiryo', 'メイリオ']);
assert.deepEqual([...context.officeFontAliases('メイリオ 本文')], ['Meiryo', 'メイリオ']);
assert.deepEqual([...context.officeFontAliases('游ゴシック 見出し')], ['Yu Gothic', '游ゴシック', 'Yu Gothic UI']);
assert.deepEqual([...context.normalizeOfficeFontStack('"メイリオ 見出し", Aptos')].slice(0, 3), ['Meiryo', 'メイリオ', 'Aptos']);
assert.deepEqual([...context.normalizeOfficeFontStack('"Meiryo", "メイリオ"')], ['Meiryo', 'メイリオ']);

// Mirrors the supplied テスト.pptx: ThemeData is stored in maps, not presentation.theme.
const theme = {
  majorFont: { latin: 'Century Gothic', ea: '', cs: '', scripts: { Jpan: 'メイリオ', Hans: '宋体' } },
  minorFont: { latin: 'Century Gothic', ea: '', cs: '', scripts: { Jpan: 'メイリオ', Hans: '宋体' } },
};
const presentation = {
  slides: [{ layoutIndex: 'ppt/slideLayouts/slideLayout1.xml' }],
  slideToLayout: new Map([[0, 'ppt/slideLayouts/slideLayout1.xml']]),
  layoutToMaster: new Map([['ppt/slideLayouts/slideLayout1.xml', 'ppt/slideMasters/slideMaster1.xml']]),
  masterToTheme: new Map([['ppt/slideMasters/slideMaster1.xml', 'ppt/theme/theme1.xml']]),
  themes: new Map([['ppt/theme/theme1.xml', theme]]),
};
assert.equal(context.themeForSlide(presentation, 0), theme);
assert.equal(context.themeJapaneseFont(theme, true), 'メイリオ');
assert.equal(context.themeJapaneseFont(theme, false), 'メイリオ');
const renderedStack = [...context.japaneseFontCompatibilityStack('"Century Gothic", "宋体"', 'テスト', presentation, 0)];
assert.deepEqual(renderedStack.slice(0, 2), ['Meiryo', 'メイリオ']);
assert.ok(renderedStack.includes('Century Gothic'));
assert.ok(renderedStack.includes('宋体'));

// Explicit non-theme custom fonts must stay untouched.
assert.deepEqual([...context.japaneseFontCompatibilityStack('"BIZ UDPゴシック"', 'テスト', presentation, 0)], ['BIZ UDPゴシック']);
// Latin-only text does not get an East Asian override.
assert.deepEqual([...context.japaneseFontCompatibilityStack('"Century Gothic"', 'Test', presentation, 0)], ['Century Gothic']);

console.log('PPTX font compatibility tests passed.');
