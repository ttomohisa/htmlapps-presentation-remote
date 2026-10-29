import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=['components/webrtc-qr-pairing.html','src/index.template.html','presentation-remote.html'];
const texts=files.map(p=>readFileSync(p,'utf8'));
const fragment=(text,start,end)=>{
  const i=text.indexOf(start),j=text.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'expected function '+start);
  return text.slice(i,j);
};
const pairing=text=>fragment(text,'  const COPY = {','  window.AppWebRtcQrPairing = Object.freeze({ mount });');
for(let i=1;i<texts.length;i++)assert.equal(pairing(texts[i]),pairing(texts[0]),'embedded pairing component diverges: '+files[i]);
const source=texts[0];
for(const token of ['scheduleJoinRegeneration','autoRetryTimer','answerAutoRetryLimit']){
  assert.ok(!source.includes(token),'old automatic Answer retry is still present: '+token);
}
for(const token of ['data-join-retry','data-join-share','data-action="join-restart"','answerExpiredHelp']){
  assert.ok(source.includes(token),'missing manual retry UI: '+token);
}

function makeUi(){
  const elements=new Map();
  return selector=>{
    if(!elements.has(selector))elements.set(selector,{hidden:false,textContent:'',value:'old',disabled:false,dataset:{}});
    return elements.get(selector);
  };
}

const joinFunction=fragment(source,'    async function invalidateJoinAnswer(pc,attempt,note=\'\') {','    async function invalidateHostOffer(pc,attempt,note=\'\') {');
{
  const q=makeUi(),pc={id:1},events=[],state={
    join:{pc,attempt:4,failureHandling:false,answerCode:'old answer',answerState:'ready',pendingOffer:{sdp:'old offer'}},
    qr:{joinPages:['old-qr-part'],joinIndex:0}
  };
  let release;
  const invoke=new Function('state','isCurrentPc','stopQr','q','renderQrPlaceholder','t','setCoach','setStatus','updateDiagnostics','emitState','options','closePc',
    joinFunction+';return invalidateJoinAnswer;')(
    state,(role,p,a)=>state[role].pc===p&&state[role].attempt===a,
    role=>events.push('stop-'+role),q,(role,key)=>events.push('placeholder-'+key),key=>key,
    (role,stage)=>events.push('coach-'+stage),(role,msg)=>events.push('status-'+msg),
    async()=>{events.push('diagnostics');await new Promise(r=>release=r);},
    (role,phase)=>events.push('phase-'+phase),
    {onDisconnected:()=>events.push('disconnected')},
    role=>{state[role].pc=null;events.push('closed');}
  );
  const pending=invoke(pc,4);
  assert.equal(state.join.answerState,'invalid','reply invalidated before awaiting stats');
  assert.equal(state.join.answerCode,'');
  assert.equal(state.join.pendingOffer,null);
  assert.deepEqual(state.qr.joinPages,[]);
  assert.equal(q('[data-join-answer-code]').value,'');
  assert.equal(q('[data-join-share]').hidden,true,'old QR and manual code hidden');
  assert.equal(q('[data-join-retry]').hidden,false,'fresh-Offer recovery is available');
  assert.equal(q('[data-fullscreen]').hidden,true,'fullscreen QR hidden');
  await invoke(pc,4);
  assert.equal(events.filter(x=>x==='diagnostics').length,1,'duplicate failure is ignored');
  release();
  await pending;
  assert.equal(state.join.pc,null,'failed PeerConnection closed after final diagnostics');
  assert.equal(events.filter(x=>x==='phase-failed').length,1);
  await invoke(pc,4);
  assert.equal(events.filter(x=>x==='phase-failed').length,1,'stale peer cannot invalidate again');
}

const hostFunction=fragment(source,'    async function invalidateHostOffer(pc,attempt,note=\'\') {','    function closePc(role) {');
{
  const q=makeUi(),pc={},state={host:{pc,attempt:5,failureHandling:false,offerInvalidated:false,offerCode:'old offer'},qr:{hostPages:['old host QR']}};
  const events=[];
  const fn=new Function('state','isCurrentPc','stopQr','q','stopScanner','renderQrPlaceholder','t','setCoach','setStatus','updateDiagnostics','emitState','options','closePc',hostFunction+';return invalidateHostOffer;')(
    state,(role,p,a)=>state[role].pc===p&&state[role].attempt===a,
    role=>events.push('stop-'+role),q,()=>events.push('stop-camera'),()=>{},key=>key,()=>{},()=>{},
    async()=>{events.push('stats');},(role,phase)=>events.push('phase-'+phase),
    {onDisconnected:()=>events.push('disconnected')},role=>{state[role].pc=null;}
  );
  await fn(pc,5);
  assert.equal(state.host.offerInvalidated,true);
  assert.equal(state.host.offerCode,'');
  assert.deepEqual(state.qr.hostPages,[]);
  assert.equal(q('[data-action="host-copy"]').disabled,true);
  assert.equal(q('[data-action="host-scan-answer"]').disabled,true);
  assert.equal(q('[data-action="host-apply-answer"]').disabled,true);
  assert.equal(q('[data-fullscreen]').hidden,true);
  assert.deepEqual(events,['stop-host','stop-camera','stats','phase-failed','disconnected']);
}

const renderFunction=fragment(source,'    async function renderQr(target,text,isValid=()=>true) {','    function renderQrPlaceholder(role,text) {');
{
  let release;const target={innerHTML:'invalid placeholder'};let valid=true;
  const renderer=new Function('ensureQrLibrary','language',renderFunction+';return renderQr;')(
    ()=>new Promise(r=>{release=()=>r(()=>({addData(){},make(){},createSvgTag(){return '<svg>old QR</svg>';}}));}),
    'ja'
  );
  const pending=renderer(target,'old answer',()=>valid);
  valid=false;release();
  assert.equal(await pending,false);
  assert.equal(target.innerHTML,'invalid placeholder','late QR library resolution cannot revive invalid Answer');
}
const showFunction=fragment(source,'    async function showQr(role,index=null) {','    function stopQr(role){');
{
  const state={qr:{joinPages:['old page'],joinIndex:0}},q=makeUi();
  let release;
  const show=new Function('state','q','renderQr',showFunction+';return showQr;')(
    state,q,async(target,text,valid)=>{await new Promise(r=>release=r);if(!valid())return false;target.innerHTML=text;return true;}
  );
  const pending=show('join');
  state.qr.joinPages=[];release();await pending;
  assert.equal(q('[data-qr="join"]').innerHTML,undefined,'cancelled generation never writes QR');
  assert.equal(q('[data-qr-progress="join"]').textContent,'','cancelled QR never updates progress');
}
console.log('PASS: Answer/Offer expiry, duplicate and stale events, async QR cancellation, and all three embedded copies.');
