// Source/CSS contract plus actual Help handler checks. This deliberately does
// not simulate layout, focus restoration, native Escape, or wheel scrolling;
// those still require native-browser checks of the generated release.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=fs.readFileSync(process.env.HELP_HTML||new URL('../src/index.template.html',import.meta.url),'utf8');
const css=[...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
function declarations(selector){
 const values={};
 for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(!match[1].split(',').some(part=>part.trim()===selector))continue;
  for(const declaration of match[2].split(';')){
   const colon=declaration.indexOf(':');
   if(colon>=0)values[declaration.slice(0,colon).trim()]=declaration.slice(colon+1).trim();
  }
 }
 return values;
}

test('modal root and body lock scrolling only while a native modal is present',()=>{
 for(const selector of ['html:has(dialog:modal)','body:has(dialog:modal)']){
  const rule=declarations(selector);
  assert.equal(rule.overflow,'hidden',`${selector} prevents background scrolling`);
  assert.equal(rule['overscroll-behavior'],'none',`${selector} prevents background overscroll`);
 }
 for(const selector of ['html','body'])assert.notEqual(declarations(selector).overflow,'hidden','ordinary page scrolling remains available after dismissal');
});

test('Help has an allocated dynamic-viewport shell without displaying a closed dialog',()=>{
 const shell=declarations('#helpDialog'),open=declarations('#helpDialog[open]');
 assert.match(shell.height||'',/\b\d+dvh\b/,'Help allocates a bounded height to its children');
 assert.match(shell['max-height']||'',/env\(safe-area-inset-top\)/,'top safe area is reserved');
 assert.match(shell['max-height']||'',/env\(safe-area-inset-bottom\)/,'bottom safe area is reserved');
 assert.equal(shell.overflow,'hidden','the Help shell must not scroll its header away');
 assert.equal(shell.display,undefined,'closed native Help stays hidden');
 assert.equal(open.display,'flex');
 assert.equal(open['flex-direction'],'column');
});

test('Help reserves its header and Close button while the body owns scrolling',()=>{
 assert.equal(declarations('#helpDialog > .dialog-head').flex,'0 0 auto','header cannot shrink into the body');
 assert.equal(declarations('#closeHelpButton').flex,'0 0 auto','Close keeps its full target size');
 assert.equal(declarations('#helpDialog > .dialog-head > div')['min-width'],'0','localized header text can wrap');
 const body=declarations('#helpDialog > .dialog-body');
 assert.equal(body.flex,'1 1 auto','body receives remaining shell height');
 assert.equal(body['min-height'],'0','body can shrink below content height');
 assert.equal(body.overflow,'auto','Help body is the scroll owner');
 assert.equal(body['overscroll-behavior'],'contain','body boundary does not chain scrolling');
});

function helpHarness(){
 const nodes=new Map();
 const $=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{open:false,events:{},
   addEventListener(type,handler){this.events[type]=handler},
   showModal(){this.open=true},close(){this.open=false}});
  return nodes.get(selector);
 };
 const begin=source.indexOf("$('#helpButton').addEventListener('click'");
 const end=source.indexOf("$('#closePairButton').addEventListener",begin);
 assert.ok(begin>=0&&end>begin,'extract only actual Help event bindings');
 vm.runInNewContext(source.slice(begin,end),{$});
 return {$,dialog:$('#helpDialog')};
}

test('actual Help handlers support repeated open, Close and backdrop dismissal',()=>{
 const {$,dialog}=helpHarness();
 for(let cycle=0;cycle<3;cycle++){
  $('#helpButton').events.click();assert.equal(dialog.open,true);
  dialog.events.click({target:{}});assert.equal(dialog.open,true,'body clicks keep Help open');
  $('#closeHelpButton').events.click();assert.equal(dialog.open,false);
  $('#helpButton').events.click();assert.equal(dialog.open,true);
  dialog.events.click({target:dialog});assert.equal(dialog.open,false);
 }
 assert.equal(dialog.events.cancel,undefined,'native Escape cancellation is not intercepted by Help');
});

test('Help gives beginners a complete five-step pairing flow without dismissal instructions',()=>{
 const begin=source.indexOf('const T={'),end=source.indexOf('const $=',begin);
 const translations=vm.runInNewContext(source.slice(begin,end)+'\nT');
 const dialogStart=source.indexOf('<dialog id="helpDialog">');
 const section=source.slice(dialogStart,source.indexOf('</dialog>',dialogStart)+9);
 const stepTitles=[...section.matchAll(/data-i18n="helpStep(\\d)Title"/g)].map(match=>Number(match[1]));
 assert.deepEqual(stepTitles,[1,2,3,4,5]);
 assert.equal((section.match(/class="help-more"/g)||[]).length,2,'optional details stay collapsed initially');
 assert.doesNotMatch(section,/data-i18n="helpDialogScroll"/);
 assert.equal(source.includes('「閉じる」、Esc、ダイアログ外のクリックで閉じます。'),false);
 assert.equal(source.includes('Close Help with Close, Esc, or a click outside the dialog.'),false);
 for(const language of ['ja','en']){
  const t=translations[language];
  assert.equal(t.helpDialogScroll,undefined,'dismissal copy is not part of translations');
  for(let i=1;i<=5;i++){
   assert.ok(t['helpStep'+i+'Title'],'step '+i+' title in '+language);
   assert.ok(t['helpStep'+i],'step '+i+' description in '+language);
  }
  for(const key of ['helpDuringTitle','helpPreviewBody','helpPointerBody','helpExtraTitle','helpTechnicalTitle','helpPptxDetail']){
   assert.ok(t[key],key+' translated in '+language);
  }
  assert.match(t.helpPrivacyBody,/WebRTC/);
  assert.match(t.helpPrivacyBody,/STUN/);
  assert.match(t.helpPrivacyBody,/TURN/);
  assert.match(t.helpRtcLimit,language==='ja'?/Wi-Fi/:/Wi-Fi/);
  assert.match(t.helpStep4,language==='ja'?/返答QR/:/reply QR/i);
  assert.match(t.helpStep5,language==='ja'?/プレゼン開始/:/Start presentation/);
 }
});
