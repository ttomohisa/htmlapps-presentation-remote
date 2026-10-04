import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html=fs.readFileSync(new URL('../src/index.template.html',import.meta.url),'utf8');
function source(name){const start=html.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,`${name} exists`);const rest=html.slice(start),end=rest.slice(1).search(/\n(?:async )?function |\nclass /);return end<0?rest:rest.slice(0,end+1)}
function context(names,values){const c=vm.createContext(values);vm.runInContext(names.map(source).join('\n'),c);return c}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const element=()=>({value:'',style:{},dataset:{},children:[],classList:{contains:()=>false,toggle(){}},setAttribute(){},removeAttribute(){},replaceChildren(...a){this.children=a},append(x){this.children.push(x)},remove(){},setCustomValidity(x){this.error=x},reportValidity(){this.reported=true}});

test('remote jump retains an edited draft through state refresh and resets for another deck',()=>{
 const input=element();input.value='12';const dialog={open:true};const state={lang:'en',remote:{index:2,total:30,totalKnown:true,connected:true,deckRevision:4},remoteUi:{slideJumpRevision:4}};
 const c=context(['renderSlideJumpDialog'],{state,$:s=>s==='#remoteGoto'?input:s==='#remoteSlideDialog'?dialog:null,templateText:()=>'',tr:x=>x});
 c.renderSlideJumpDialog();assert.equal(input.value,'12');state.remote.index=3;c.renderSlideJumpDialog();assert.equal(input.value,'12');state.remote.deckRevision++;c.renderSlideJumpDialog();assert.equal(input.value,'4');
});
test('host navigation rejects fractions, empty/non-numeric values and out-of-range numbers',async()=>{
 const state={phase:'ready',totalKnown:true,total:5,current:2};let renders=0;
 const c=context(['goTo'],{state,renderCurrent:async()=>renders++,syncState(){}});
 for(const n of [1.5,NaN,Infinity,-1,5,'',null,'2'])await c.goTo(n);
 assert.equal(state.current,2);assert.equal(renders,0);await c.goTo(4);assert.equal(state.current,4);assert.equal(renders,1);
});
test('jump input reports an accessible validation error and sends only a whole in-range number',()=>{
 const input=element(),sent=[];const state={remote:{totalKnown:true,total:5}};
 const c=context(['slideIndexFromInput','jumpFromInput'],{state,$:()=>input,tr:x=>x,templateText:()=> '1–5',sendCommand:(...x)=>{sent.push(x);return false},closeSlideJumpDialog(){}});
 for(const value of ['', '1.5','0','6']){input.value=value;c.jumpFromInput();assert.ok(input.error)}
 assert.equal(sent.length,0);input.value='3';c.jumpFromInput();assert.equal(input.error,'');assert.equal(sent[0][1].index,2);
});
test('latest same-deck navigation is the only result appended',async()=>{
 const jobs=[],surface=element(),state={phase:'ready',generation:1,renderGeneration:0,kind:'pdf',current:0,pdfRenderTask:null};
 const c=context(['discardRenderedView','renderCurrent'],{state,$:()=>surface,renderPdfCanvas:()=>{const p=deferred();jobs.push(p);return p.promise},updateCurrentThumb(){},updatePointer(){},updateUiText(){}});
 const a=c.renderCurrent();state.current=1;const b=c.renderCurrent();const latest=element(),old=element();jobs[1].resolve(latest);await b;jobs[0].resolve(old);await a;assert.deepEqual(surface.children,[latest]);
});
test('a stale PDF getPage result never starts rendering or replaces the active task',async()=>{
 const pages=[deferred(),deferred()],rendered=[];const doc={getPage:n=>pages[n-1].promise};const state={generation:1,pdfDoc:doc,pdfRenderTask:null};let current=true;
 const c=context(['renderPdfCanvas'],{state,pdfRenderMetrics:()=>({viewport:{width:1,height:1},cssW:1,cssH:1}),document:{createElement:()=>({...element(),getContext:()=>({})})}});
 const a=c.renderPdfCanvas(0,false,()=>current);current=false;const newer={promise:Promise.resolve()};state.pdfRenderTask=newer;pages[0].resolve({render(){rendered.push(0);return{promise:Promise.resolve()}}});assert.equal(await a,null);assert.deepEqual(rendered,[]);assert.equal(state.pdfRenderTask,newer);
});
test('stale PPTX result is released and never settles or changes the current surface',async()=>{
 const jobs=[],surface=element();let disposed=0;const deck={render:()=>{const p=deferred();jobs.push(p);return p.promise},settleAttachedMain:async()=>{},needsInitialConnectedPass:()=>false};
 const state={phase:'ready',generation:1,renderGeneration:0,kind:'pptx',current:0,deck};const c=context(['discardRenderedView','renderCurrent'],{state,$:()=>surface,renderCompatibility(){},updateCurrentThumb(){},updatePointer(){},updateUiText(){}});
 const a=c.renderCurrent();state.current=1;const b=c.renderCurrent();const newer=element();jobs[1].resolve(newer);await b;jobs[0].resolve({...element(),dispose(){disposed++}});await a;assert.deepEqual(surface.children,[newer]);assert.equal(disposed,1);
});
test('new deck clears the actual blackout overlay',async()=>{
 const elements=new Map([['#blankOverlay',{hidden:false}]]),$=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)};
 const state={generation:1,deckRevision:1,preview:{hostToken:0,hostCache:new Map(),hostInflight:new Map()},blank:true,pointerVisible:true};
 const c=context(['openFile'],{state,$,MAX_FILE_BYTES:150*1024*1024,cleanupDeck:async()=>{},loadPdf:async()=>({numPages:2}),performance:{now:()=>1},formatBytes:()=>'',tr:x=>x,renderCompatibility(){},renderCurrent:async()=>{},buildThumbs(){},updateUiText(){},syncState(){},showToast(){},console});
 await c.openFile({name:'replacement.pdf',size:100});assert.equal(state.blank,false);assert.equal($('#blankOverlay').hidden,true);
});
test('late source parsing disposes the old deck without replacing the newer deck',async()=>{
 const elements=new Map(),$=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)},a=deferred(),b=deferred();let disposed=0;
 const state={generation:0,deckRevision:0,preview:{hostToken:0,hostCache:new Map(),hostInflight:new Map()}};
 const c=context(['openFile'],{state,$,MAX_FILE_BYTES:1e9,cleanupDeck:async()=>{},loadPptx:file=>file.name==='a.pptx'?a.promise:b.promise,performance:{now:()=>1},formatBytes:()=>'',tr:x=>x,renderCompatibility(){},renderCurrent:async()=>{},buildThumbs(){},updateUiText(){},syncState(){},showToast(){},console});
 const old=c.openFile({name:'a.pptx',size:1});await new Promise(setImmediate);const recent=c.openFile({name:'b.pptx',size:1});await Promise.resolve();const newer={slides:[0,1],compat:[],notes:[]};b.resolve(newer);await recent;a.resolve({slides:[0],cleanup(){disposed++}});await old;assert.equal(state.deck,newer);assert.equal(state.file.name,'b.pptx');assert.equal(disposed,1);
});
test('old asynchronous PDF cleanup cannot clear a replacement source or surface',async()=>{
 const destroy=deferred(),elements=new Map(),$=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)};
 const state={generation:0,renderGeneration:0,thumbJob:0,preview:{hostToken:0,hostCache:new Map(),hostInflight:new Map()},pdfDoc:{destroy:()=>destroy.promise}};
 const c=context(['cleanupDeck'],{state,$});const cleaning=c.cleanupDeck();const replacement={id:'new PDF'};state.pdfDoc=replacement;$('#slideSurface').append('new slide');destroy.resolve();await cleaning;assert.equal(state.pdfDoc,replacement);assert.deepEqual($('#slideSurface').children,['new slide']);
});
test('presentation shortcuts leave dialogs, interactive controls, modifiers and IME alone',()=>{
 let handler,calls=0;const document={addEventListener:(_,fn)=>handler=fn,querySelector:()=>null};const state={phase:'ready'};
 const line=html.split('\n').find(x=>x.startsWith(" document.addEventListener('keydown'"));
 const c=vm.createContext({document,state,HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},next(){calls++},previous(){calls++},goTo(){calls++},setBlank(){calls++},$:()=>({click(){calls++}})});
 vm.runInContext(line,c);const event=extra=>({key:' ',target:{closest:()=>null},preventDefault(){this.prevented=true},...extra});
 for(const extra of [{defaultPrevented:true},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{target:{closest:()=>({})}}])handler(event(extra));
 document.querySelector=()=>({open:true});handler(event({}));assert.equal(calls,0);document.querySelector=()=>null;handler(event({}));assert.equal(calls,1);
});

function previewContext(){let now=100000;const sent=[],timers=[];const state={remote:{connected:true,reconnecting:false,lost:false,deckRevision:1,index:0,totalKnown:true,total:3,kind:'pptx'},channels:{preview:{readyState:'open'},control:{readyState:'open'}},preview:{assemblies:new Map()},remoteUi:{presenterView:true,previewCache:new Map([[1,{url:'keep'}],[2,{url:'other'}]]),previewErrors:new Map([[0,'FAIL']]),previewStatus:new Map(),notesCache:new Map([[1,'keep note']]),notesErrors:new Set([0]),lastPreviewRequestKey:'',lastPreviewRequestAt:0,previewAttemptStartedAt:0,previewLastProgressAt:0,previewRequestTimer:0,previewRetry:null}};
 const c=context(['previewRetryState','retryRemotePreview','scheduleRemotePreviewRequest','previewTransportChannel','handlePreviewMessage','cacheRemotePreview','touchCache','base64ToBytes'],{state,Date:{now:()=>now},clearTimeout(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length},renderRemotePresenterView(){},PROTOCOL_VERSION:4,PREVIEW_CACHE_LIMIT:4,Blob,Uint8Array,atob,URL:{createObjectURL:()=> 'received',revokeObjectURL(){}},sendPreviewJson(msg,ch){sent.push({msg,ch});return true}});
 return{c,state,sent,timers,advance(ms){now+=ms}}}
test('explicit retry requests only failed visible entries, preserves caches and uses preview channel',()=>{
 const t=previewContext();t.c.retryRemotePreview();assert.equal(t.sent.length,1);assert.deepEqual(Array.from(t.sent[0].msg.indexes),[0]);assert.equal(t.sent[0].ch,t.state.channels.preview);assert.equal(t.state.remoteUi.previewCache.get(1).url,'keep');assert.equal(t.state.remoteUi.previewCache.get(2).url,'other');assert.equal(t.state.remoteUi.notesCache.get(1),'keep note');assert.equal(t.c.previewRetryState().pending,true);t.c.retryRemotePreview();assert.equal(t.sent.length,1);
 t.state.remoteUi.previewCache.set(0,{url:'recovered'});t.state.remoteUi.notesCache.set(0,'recovered');assert.equal(t.c.previewRetryState().pending,false);assert.equal(t.c.previewRetryState().failed,false);
});
test('retry terminates on timeout, handles notes-only failures and is blocked while reconnecting',()=>{
 const t=previewContext();t.state.remote.reconnecting=true;t.c.retryRemotePreview();assert.equal(t.sent.length,0);t.state.remote.reconnecting=false;t.state.remoteUi.previewCache.set(0,{url:'keep current'});t.state.remoteUi.previewErrors.delete(0);t.c.retryRemotePreview();assert.equal(t.sent.length,1);assert.deepEqual(Array.from(t.sent[0].msg.indexes),[]);t.advance(31000);t.c.scheduleRemotePreviewRequest(true);assert.equal(t.state.remoteUi.notesErrors.has(0),true);assert.equal(t.c.previewRetryState().pending,false);assert.equal(t.c.previewRetryState().failed,true);
});
test('preview-only retry omits cached notes and waits for other pending visible work',()=>{
 const t=previewContext();t.state.remoteUi.notesCache.set(0,'keep note');t.state.remoteUi.notesErrors.delete(0);t.c.retryRemotePreview();assert.ok(!('notesIndex' in t.sent[0].msg));
 const u=previewContext();u.state.remoteUi.previewCache.delete(1);u.state.remoteUi.previewStatus.set(1,'receiving');u.state.remoteUi.previewAttemptStartedAt=100000;u.c.retryRemotePreview();assert.equal(u.sent.length,0);
});
test('partial recovery never extends the 30-second unresolved deadline',()=>{
 const t=previewContext();t.state.remoteUi.previewCache.delete(1);t.state.remoteUi.previewErrors.set(1,'FAIL');t.c.retryRemotePreview();const started=t.state.remoteUi.previewAttemptStartedAt;t.advance(29000);t.state.remoteUi.previewCache.set(0,{url:'done'});t.c.scheduleRemotePreviewRequest(true);assert.equal(t.state.remoteUi.previewAttemptStartedAt,started);t.advance(2000);t.c.scheduleRemotePreviewRequest(true);assert.equal(t.state.remoteUi.previewErrors.get(1),'PREVIEW_TIMEOUT');
});
test('retry then navigation accepts the new request and late errors cannot erase success',()=>{
 const t=previewContext();t.state.remoteUi.previewCache.delete(1);t.state.remoteUi.previewErrors.set(1,'FAIL');t.c.retryRemotePreview();const oldId=t.sent[0].msg.requestId;
 t.state.remote.index=1;t.state.remoteUi.previewErrors.delete(1);t.c.scheduleRemotePreviewRequest(true);const requestId=t.sent.at(-1).msg.requestId;
 for(const msg of [{type:'preview-meta',id:'new',index:1,total:1,mime:'image/png'},{type:'preview-chunk',id:'new',index:1,seq:0,data:'AA=='}])t.c.handlePreviewMessage('join',JSON.stringify({v:4,revision:1,requestId,...msg}));
 assert.equal(t.state.remoteUi.previewCache.get(1)?.url,'received');t.c.handlePreviewMessage('join',JSON.stringify({v:4,revision:1,requestId:oldId,type:'preview-error',index:1,code:'LATE'}));assert.equal(t.state.remoteUi.previewErrors.has(1),false);
});
test('retry UI stays hidden for ordinary loading and identifies only explicit retries',()=>{
 const t=previewContext();t.state.remoteUi.previewErrors.clear();t.state.remoteUi.notesErrors.clear();t.state.remoteUi.previewAttemptStartedAt=100000;assert.equal(t.c.previewRetryState().pending,true);assert.equal(t.c.previewRetryState().retrying,false);
 t.state.remoteUi.previewErrors.set(0,'FAIL');t.state.remoteUi.notesErrors.add(0);t.c.retryRemotePreview();assert.equal(t.c.previewRetryState().retrying,true);
 assert.match(html,/remote-preview-retry\{[^}]*grid-column:1\/-1/);
 assert.ok(html.indexOf('id="remotePreviewRetry"')>html.indexOf('id="remoteNotesBody"'),'landscape notes remain the second grid cell');
});
