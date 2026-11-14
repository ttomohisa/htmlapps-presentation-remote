import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=fs.readFileSync(new URL('../src/index.template.html',import.meta.url),'utf8');
const pairing=fs.readFileSync(new URL('../components/webrtc-qr-pairing.html',import.meta.url),'utf8');
function oneLine(name,text=source){
 const line=text.split('\n').find(line=>new RegExp('^\\s*(?:async )?function '+name+'\\(').test(line));
 assert.ok(line, name+' exists');if(name==='openCamera'){const start=text.indexOf(line),end=text.indexOf('\n    function renderChunks(',start);assert.ok(end>start,'camera function boundary');return text.slice(start,end);}return line;
}
function run(line,context){
 const c=vm.createContext(context);
 vm.runInContext(line,c);
 return c;
}
test('footer aligns to the header content edge, and small-screen visibility remains intact',()=>{
 assert.match(source,/\.header-inner\{width:min\(1420px,100%\);[^}]*padding:10px clamp\(14px,2\.4vw,28px\);/);
 assert.match(source,/footer\{width:min\(1420px,100%\);margin:0 auto;padding:20px clamp\(14px,2\.4vw,28px\) 30px;text-align:left;/);
 assert.match(source,/@media \(max-width:720px\), \(max-height:560px\).*?body > footer \{ display: none; \}/);
});
test('first-use notes font keeps its intended 13px size',()=>{
 const state={remoteUi:{hapticsSupported:false,haptics:true,presenterView:true,notesFontSize:13}};
 const c=run(oneLine('initRemotePreferences'),{state,localStorage:{getItem:()=>null},navigator:{},$:()=>null,renderNotesControls(){},renderWakeLockUi(){},initMotionPreferences(){},tr:x=>x});
 c.initRemotePreferences();
 assert.equal(state.remoteUi.notesFontSize,13);
});
test('first-use motion settings keep sensitivity 1 and deadzone 0.6',()=>{
 const motion={sensitivity:1,deadzone:.6,smoothing:'standard'};
 const state={remoteUi:{motion}};
 const c=run(oneLine('initMotionPreferences'),{state,window:{DeviceOrientationEvent:function(){},isSecureContext:true},localStorage:{getItem:()=>null},$:()=>null,renderMotionUi(){}});
 c.initMotionPreferences();assert.equal(motion.deadzone,.6);assert.equal(motion.sensitivity,1);
});
test('missing device-orientation angles cannot be calibrated as zeros',()=>{
 const c=run(oneLine('motionSample'),{screenAngle:()=>0});
 assert.equal(c.motionSample({alpha:30,beta:null,gamma:10}),null);
 assert.equal(c.motionSample({alpha:30,beta:20,gamma:undefined}),null);
 assert.equal(c.motionSample({alpha:30,beta:20,gamma:10}).pitch,20);
});
test('navigation render errors roll back to the previous slide',async()=>{
 const state={phase:'ready',current:0,totalKnown:true,total:3,generation:2};
 let renders=0,syncs=0;const warnings=[];
 const c=run(oneLine('goTo'),{state,renderCurrent:async()=>{renders++;if(renders===1)throw new Error('render failure');return true},syncState(){syncs++},updateUiText(){},showToast:(...x)=>warnings.push(x),tr:x=>x,console:{warn(){}}});
 assert.equal(await c.goTo(1),false);
 assert.equal(state.current,0);assert.equal(renders,2);assert.equal(syncs,1);assert.equal(warnings[0][0],'slideRenderFailed');
});
test('PDF window resize and fullscreen use throttled PDF redrawing',()=>{
 assert.match(source,/const schedulePdfRefit=\(\)=>\{clearTimeout\(pdfFitTimer\)/);
 assert.match(source,/window\.addEventListener\('resize',\(\)=>\{schedulePptxRefit\(\);schedulePdfRefit\(\)\}\)/);
 assert.match(source,/document\.addEventListener\('fullscreenchange',\(\)=>\{if\(state\.phase==='ready'&&state\.kind==='pdf'\)schedulePdfRefit\(\)/);
});
test('camera request is cancelled after scanner is closed while permission is pending',async()=>{
 let resolve,stopped=0;
 const scanner={generation:7,cameraRequestId:0,mode:'join',stream:null};
 const state={scanner,destroyed:false};
 const fakeStream={getTracks:()=>[{stop(){stopped++}}],getVideoTracks:()=>[]};
 const video={srcObject:null,play:async()=>{}};
 const c=run(oneLine('openCamera',pairing),{
   state,navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r})}},
   scannerElements:()=>({video,resolution:{textContent:''},cameraSelect:{innerHTML:'',append(){}},cameraField:{hidden:true}}),
   format:()=>'',t:x=>x
 });
 const pending=c.openCamera('join');
 scanner.generation++;scanner.mode='';
 resolve(fakeStream);
 assert.equal(await pending,false);assert.equal(stopped,1);assert.equal(video.srcObject,null);
});
test('superseded camera selection cannot reopen an older stream',async()=>{
 const resolutions=[],stopped=[];
 const scanner={generation:2,cameraRequestId:0,mode:'join',stream:null};
 const state={scanner,destroyed:false};
 const streams=[0,1].map(i=>({getTracks:()=>[{stop(){stopped.push(i)}}],getVideoTracks:()=>[{getSettings:()=>({}),getCapabilities:()=>({}),applyConstraints:async()=>{}}]}));
 const video={srcObject:null,videoWidth:640,videoHeight:480,play:async()=>{}};
 const c=run(oneLine('openCamera',pairing),{
   state,navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolutions.push(r)),enumerateDevices:async()=>[]}},
   scannerElements:()=>({video,resolution:{textContent:''},cameraSelect:{innerHTML:'',append(){}},cameraField:{hidden:true}}),
   format:()=>'',t:x=>x
 });
 const old=c.openCamera('join','camera-old'),recent=c.openCamera('join','camera-new');
 resolutions[0](streams[0]);resolutions[1](streams[1]);
 assert.equal(await old,false);assert.equal(await recent,true);
 assert.ok(stopped.includes(0));assert.equal(video.srcObject,streams[1]);
});
console.log('Maintenance regressions passed.');
