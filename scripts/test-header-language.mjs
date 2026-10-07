// Runs real translation, language-update and click-handler code with a minimal
// DOM adapter. This is not browser layout, focus, permissions or WebRTC testing.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const app=JSON.parse(fs.readFileSync(new URL('../app.config.json',import.meta.url),'utf8'));
const source=fs.readFileSync(process.env.HEADER_HTML||new URL('../src/index.template.html',import.meta.url),'utf8');
const presentation=true;
function extract(name){
 const indent=presentation?'':'      ';
 const lines=source.split('\n');
 const start=lines.findIndex(line=>line.startsWith(`${indent}function ${name}(`));
 assert.ok(start>=0,`Production function ${name} exists`);
 const end=lines[start].trimEnd().endsWith('}')?start:lines.findIndex((line,i)=>i>start&&line===`${indent}}`);
 assert.ok(end>=start,`Production function ${name} is complete`);
 return lines.slice(start,end+1).join('\n');
}
function harness(lang){
 const nodes=[],byId=new Map(),saved=new Map();
 // Only real markup preceding application JavaScript is used to create elements.
 const markup=source.slice(0,source.indexOf('<script>'));
 function element(attributes={},text=''){
  const el={attributes,dataset:{},textContent:text,hidden:true,title:attributes.title||'',events:{},
   setAttribute(name,value){this.attributes[name]=value},getAttribute(name){return this.attributes[name]??null},
   addEventListener(name,handler){this.events[name]=handler}};
  for(const [key,value] of Object.entries(attributes))if(key.startsWith('data-'))el.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  return el;
 }
 for(const m of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>([^<]*)/gi)){
  const attrs=Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
  if(!attrs.id&&!Object.keys(attrs).some(k=>k.startsWith('data-i18n')))continue;
  const el=element(attrs,m[3]);nodes.push(el);if(attrs.id)byId.set('#'+attrs.id,el);
 }
 const $=selector=>{if(!byId.has(selector))byId.set(selector,element());return byId.get(selector)};
 const $$=selector=>nodes.filter(el=>selector.slice(1,-1) in el.attributes);
 const ctx={APP_CONFIG:app,document:{documentElement:{lang:''}},navigator:{language:lang},$: $, $$,
  state:{lang,pairing:null},language:lang,role:'',recording:false,storageKeys:{language:`${app.slug}:language`},
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  renderSensorRoster(){},renderSensorLayoutPanel(){},renderRecordMarkers(){},updateSelectedPeerUi(){},renderExperimentPresetUi(){},updateMeasurementModeUi(){},updateDisplayModeUi(){},renderImpactPanel(){},renderPostAnalysis(){},updateSensorResourceUi(){},
  updateUiText(){},refreshLoadedDocumentText(){},renderRemotePresenterView(){},renderConnectionRecoveryUi(){},renderWakeLockUi(){},renderSlideJumpDialog(){}};
 vm.createContext(ctx);
 const translationStart=source.indexOf(presentation?'const T={':'      const translations={');
 const translationEnd=source.indexOf(presentation?'const $=':'      const $=',translationStart);
 vm.runInContext(source.slice(translationStart,translationEnd),ctx);
 const names=presentation?['tr','applyI18n','setLanguage']:['t','applyLanguage','readStorage','writeStorage'];
 vm.runInContext(names.map(extract).join('\n'),ctx);
 const binding=source.match(/\$\('#languageButton'\)\.addEventListener\('click',[^\n]*?\);(?=\n|$)/)?.[0];
 assert.ok(binding,'Actual language click handler exists');
 vm.runInContext(binding,ctx);
 vm.runInContext(presentation?'applyI18n()':'applyLanguage()',ctx);
 return {ctx,$,saved,copy:key=>nodes.find(el=>el.dataset.i18n===key)?.textContent};
}
for(const lang of ['en','ja']){
 test(`${lang}: language target uses EN/JA and a localized accessible name and tooltip`,()=>{
  const h=harness(lang),button=h.$('#languageButton');
  assert.equal(button.textContent,lang==='ja'?'EN':'JA');
  const label=lang==='ja'?'英語に切り替え':'Switch to Japanese';
  assert.equal(button.getAttribute('aria-label'),label);
  assert.equal(button.title,label);
  assert.equal(h.ctx.document.documentElement.lang,lang);
 });
 test(`${lang}: Help and Close controls stay localized`,()=>{
  const h=harness(lang),help=h.$('#helpButton'),close=h.$('#closeHelpButton');
  const helpLabel=lang==='ja'?'使い方と注意事項':'How to use & notes';
  assert.equal(help.getAttribute('aria-label'),helpLabel);assert.equal(help.title,helpLabel);
  const closeLabel=lang==='ja'?'閉じる':'Close';
  assert.equal(close.getAttribute('aria-label'),closeLabel);assert.equal(close.title,closeLabel);
 });
 test(`${lang}: repeated actual language clicks update and save the target label`,()=>{
  const h=harness(lang),button=h.$('#languageButton');let current=lang;
  for(let i=0;i<4;i++){
   button.events.click();current=current==='ja'?'en':'ja';
   assert.equal(h.ctx.document.documentElement.lang,current);
   assert.equal(h.saved.get(`${app.slug}:language`),current);
   assert.equal(button.textContent,current==='ja'?'EN':'JA');
   assert.equal(button.getAttribute('aria-label'),current==='ja'?'英語に切り替え':'Switch to Japanese');
   assert.equal(button.title,button.getAttribute('aria-label'));
  }
 });
 test(`${lang}: WebRTC privacy copy preserves the real peer-transfer boundary`,()=>{
  const h=harness(lang),badge=h.copy(presentation?'privacyBadge':'localBadge'),help=h.copy('helpPrivacyBody');
  assert.equal(badge,presentation?(lang==='ja'?'資料はアップロードしません':'The deck is not uploaded'):(lang==='ja'?'シグナリング / STUN / TURN 不使用':'No signaling / STUN / TURN servers'));
  assert.match(help,/WebRTC/);assert.match(help,/STUN/);assert.match(help,/TURN/);
  if(presentation){assert.match(help,lang==='ja'?/低解像度プレビュー/:/low-resolution current\/next slide previews/);assert.match(help,lang==='ja'?/発表者ノート/:/speaker notes/);assert.match(help,lang==='ja'?/操作情報/:/control data/)}
  else assert.match(help,lang==='ja'?/接続相手へ直接/:/directly to the peer/);
 });
}
test('canonical patch version is bumped exactly once',()=>assert.equal(app.version,'1.0.6'));
