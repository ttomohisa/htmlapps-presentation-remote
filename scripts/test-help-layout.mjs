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

test('Japanese and English Help explain scrolling without changing privacy claims',()=>{
 const begin=source.indexOf('const T={'),end=source.indexOf('const $=',begin);
 const translations=vm.runInNewContext(source.slice(begin,end)+'\nT');
 assert.match(translations.ja.helpDialogScroll||'',/本文.*スクロール/);
 assert.match(translations.ja.helpDialogScroll||'',/閉じる/);
 assert.match(translations.en.helpDialogScroll||'',/scroll.*Help body/i);
 assert.match(translations.en.helpDialogScroll||'',/Close/);
 const section=source.slice(source.indexOf('<!-- APP:HELP:BEGIN -->'),source.indexOf('<!-- APP:HELP:END -->'));
 assert.match(section,/data-i18n="helpDialogScroll"/,'new behavior is in the maintained Help section');
 for(const language of ['ja','en']){
  assert.match(translations[language].helpPrivacyBody,/WebRTC/);
  assert.match(translations[language].helpPrivacyBody,/STUN/);
  assert.match(translations[language].helpPrivacyBody,/TURN/);
 }
});
