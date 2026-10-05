import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Execute the shipping functions with synthetic DOM/transport boundaries; no browser or peer is opened.
const html=fs.readFileSync(process.argv[2]||new URL('../src/index.template.html',import.meta.url),'utf8');
function source(name){const start=html.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,`${name} exists`);const rest=html.slice(start),end=rest.slice(1).search(/\n(?:async )?function |\nclass /);return end<0?rest:rest.slice(0,end+1)}
function harness(remote={}){
 let now=1000;
 const sent=[],feedback=[],haptics=[],flashes=[],storage=[],elements=new Map();
 const el=()=>({disabled:false,hidden:false,checked:false,textContent:'',handlers:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(k,fn){this.handlers[k]=fn}});
 const $=s=>{if(!elements.has(s))elements.set(s,el());return elements.get(s)};
 const c=vm.createContext({$,performance:{now:()=>now},PROTOCOL_VERSION:4,POINTER_BUFFER_LIMIT:65536,DISCONNECT_GRACE_MS:8000,APP_CONFIG:{slug:'test'},DEV:null,URL:{revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},localStorage:{setItem:(...x)=>storage.push(x)},transportSession:()=> 'synthetic-session',haptic:x=>haptics.push(x),commandFeedback:x=>feedback.push(x),flashRemoteGesture:x=>flashes.push(x),tr:x=>x,fmtTime:x=>String(x),remoteElapsedMs:()=>0,renderMotionUi(){},renderRemotePresenterView(){},renderConnectionRecoveryUi(){},renderWakeLockUi(){},renderSlideJumpDialog(){},updateLinkUi(){},applyI18n(){},refreshLoadedDocumentText(){},ensureWakeLock(){},releaseWakeLock(){},closeSlideJumpDialog(){},clearDisconnectTimer(){},showToast(){},scheduleRemotePreviewRequest(){}});
 vm.runInContext(html.split('\n').find(x=>x.startsWith('const state='))+'\nglobalThis.state=state;',c);
 const state=c.state;Object.assign(state.remote,{index:1,total:3,totalKnown:true,connected:true,...remote});
 state.channels.control={readyState:'open',bufferedAmount:0,send:x=>sent.push(JSON.parse(x))};
 const names=['sendChannel','sendCommand','setupRemoteSwipe','renderRemoteState','toggleRemoteMore','setLanguage','onAppDisconnected','markTransportRecovered','handleControlMessage','previewCacheClear'];
 if(html.includes('function setRemoteSwipeNavigation('))names.push('setRemoteSwipeNavigation');
 vm.runInContext(names.map(source).join('\n'),c);c.setupRemoteSwipe();c.renderRemoteState();
 const line=html.split('\n').find(x=>x.startsWith(" $('#remotePrev').addEventListener"));
 vm.runInContext(line.slice(0,line.indexOf("$('#remoteBlank')")),c);
 const change=html.match(/\$\('#remoteSwipeNavigation'\)\.addEventListener\('change',[^;]+;/)?.[0];if(change)vm.runInContext(change,c);
 const down=(extra={})=>$('#remoteNav').handlers.pointerdown({button:0,pointerId:1,clientX:200,clientY:100,...extra});
 const up=({dx=-100,dy=0,duration=100,pointerId=1}={})=>{now+=duration;$('#remoteNav').handlers.pointerup({pointerId,clientX:200+dx,clientY:100+dy})};
 return{c,state,$,sent,feedback,haptics,flashes,storage,down,up,swipe:x=>{down();up(x)},advance:ms=>now+=ms,toggle:enabled=>{const e=$('#remoteSwipeNavigation');assert.equal(typeof e.handlers.change,'function','swipe checkbox has its production change handler');e.checked=enabled;e.handlers.change({currentTarget:e})}};
}
function noCommand(h){assert.equal(h.sent.length,0);assert.equal(h.feedback.length,0);assert.equal(h.haptics.length,0);assert.equal(h.flashes.length,0);assert.equal(h.state.transport.commandSeq,0);assert.equal(h.state.transport.lastCommandAt.size,0)}

for(const [label,remote,command,dx] of [
 ['first slide',{index:0},'previous',100],['last slide',{index:2},'next',-100],
 ['one-slide previous',{index:0,total:1},'previous',100],['one-slide next',{index:0,total:1},'next',-100],
 ['known empty deck previous',{index:0,total:0},'previous',100],['known empty deck next',{index:0,total:0},'next',-100]
])test(`${label} rejects direct and swipe commands without transport or feedback side effects`,()=>{
 const h=harness(remote);assert.equal(h.$(command==='next'?'#remoteNext':'#remotePrev').disabled,true);assert.equal(h.c.sendCommand(command),false);noCommand(h);h.swipe({dx});noCommand(h);assert.ok(h.state.remoteUi.suppressNavClickUntil>1000);assert.equal(h.state.remote.index,remote.index);
});

test('rejected boundary command does not debounce the next valid command',()=>{const h=harness({index:2});assert.equal(h.c.sendCommand('next'),false);h.state.remote.index=1;assert.equal(h.c.sendCommand('next'),true);assert.equal(h.sent[0].seq,1);assert.equal(h.state.remote.index,1)});

test('middle-slide swipes preserve direction, protocol and one-command click suppression',()=>{
 for(const [dx,command] of [[-100,'next'],[100,'previous']]){const h=harness();h.swipe({dx});h.$(dx<0?'#remoteNext':'#remotePrev').handlers.click();assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0],{type:'command',v:4,clientSession:'synthetic-session',seq:1,command});assert.deepEqual(h.feedback,[command]);assert.deepEqual(h.haptics,[command]);assert.deepEqual(h.flashes,[command]);assert.equal(h.state.remote.index,1)}
});

test('unknown total allows next and rejects previous only at the first slide',()=>{const h=harness({index:0,total:0,totalKnown:false});assert.equal(h.c.sendCommand('previous'),false);assert.equal(h.c.sendCommand('next'),true);assert.equal(h.sent.length,1);assert.equal(h.state.remote.index,0)});

test('swipe navigation starts on with a labeled, described keyboard-operable checkbox in More',()=>{
 const h=harness();assert.equal(h.state.remoteUi.swipeNavigation,true);assert.equal(h.$('#remoteSwipeNavigation').checked,true);
 assert.match(html,/<label class="remote-toggle-row"[^>]*>[\s\S]*?<strong id="remoteSwipeNavigationLabel" data-i18n="swipeNavigation">[\s\S]*?<small id="remoteSwipeNavigationHint" data-i18n="swipeNavigationHint">[\s\S]*?<input id="remoteSwipeNavigation" type="checkbox" checked aria-labelledby="remoteSwipeNavigationLabel" aria-describedby="remoteSwipeNavigationHint">/);
 assert.ok(html.indexOf('id="remoteSwipeNavigation"')>html.indexOf('id="remoteMorePanel"'));
});

test('turning swipe off suppresses horizontal drag commands and their underlying clicks, without storage or messages',()=>{
 const h=harness();h.toggle(false);h.swipe();h.$('#remoteNext').handlers.click();noCommand(h);assert.equal(h.storage.length,0);assert.equal(h.$('#remoteSwipeNavigation').checked,false);h.advance(361);h.$('#remoteNext').handlers.click();assert.equal(h.sent[0].command,'next');assert.equal(h.state.remote.index,1);
});

test('off mode retains plain taps, direct goto and unrelated controls',()=>{
 const h=harness();h.toggle(false);h.swipe({dx:2,dy:1});h.$('#remoteNext').handlers.click();assert.equal(h.sent[0].command,'next');assert.equal(h.c.sendCommand('goto',{index:0}),true);assert.equal(h.c.sendCommand('blank'),true);assert.deepEqual(h.sent.map(x=>x.command),['next','goto','blank']);assert.equal(h.c.sendCommand('goto',{index:3}),false);assert.equal(h.state.remote.index,1);
});

test('re-enabling swipe restores navigation, and a new page starts on again',()=>{const h=harness();h.toggle(false);h.toggle(true);h.swipe();assert.equal(h.sent[0].command,'next');assert.equal(harness().state.remoteUi.swipeNavigation,true)});

for(const values of [[false],[false,true]])test(`changing the setting ${values.join(' then ')} during a gesture cancels navigation but still suppresses its click`,()=>{const h=harness();h.down();for(const v of values)h.toggle(v);h.up();h.$('#remoteNext').handlers.click();noCommand(h)});
test('enabling swipe during an off-mode drag does not turn that old drag into navigation',()=>{const h=harness();h.toggle(false);h.down();h.toggle(true);h.up();h.$('#remoteNext').handlers.click();noCommand(h);h.advance(361);h.swipe();assert.equal(h.sent.length,1)});

test('off choice survives host updates, deck replacement, reconnect and language changes',()=>{
 const h=harness();h.toggle(false);h.c.handleControlMessage('join',JSON.stringify({type:'state',index:1,total:4,deckRevision:2}));assert.equal(h.state.remoteUi.swipeNavigation,false);h.c.onAppDisconnected('join',true);h.c.markTransportRecovered('join');h.c.setLanguage('en');h.c.setLanguage('ja');h.c.renderRemoteState();assert.equal(h.$('#remoteSwipeNavigation').checked,false);h.swipe();noCommand(h);assert.deepEqual(h.storage.map(x=>x[0]),['test:language','test:language']);
});

for(const remote of [{connected:false},{reconnecting:true},{lost:true}])test(`unavailable control state ${JSON.stringify(remote)} never sends swipe or button commands`,()=>{const h=harness(remote);h.swipe();h.$('#remoteNext').handlers.click();noCommand(h)});
for(const [label,gesture] of [['vertical',{dx:25,dy:150}],['short',{dx:40}],['slow',{duration:900}],['diagonal',{dx:60,dy:60}]])test(`${label} movement is not navigation and suppresses a dragged button click`,()=>{const h=harness();h.swipe(gesture);h.$('#remoteNext').handlers.click();noCommand(h)});
test('pointer cancellation and a different pointer cannot complete a swipe',()=>{const h=harness();h.down();h.up({pointerId:2});noCommand(h);h.$('#remoteNav').handlers.pointercancel();h.up();noCommand(h)});
test('failed channel send gives no success feedback and never advances the remote index',()=>{const h=harness();h.state.channels.control.readyState='closed';h.swipe();assert.equal(h.sent.length,0);assert.equal(h.feedback.length,0);assert.equal(h.haptics.length,0);assert.equal(h.flashes.length,0);assert.equal(h.state.remote.index,1)});
