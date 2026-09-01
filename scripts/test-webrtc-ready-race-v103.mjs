import fs from 'node:fs';

const html=fs.readFileSync('src/index.template.html','utf8');
const component=fs.readFileSync('components/webrtc-qr-pairing.html','utf8');
const must=(cond,label)=>{if(!cond)throw new Error(`WebRTC v1.0.3 readiness race invariant failed: ${label}`)};
const has=(needle,label=needle)=>must(html.includes(needle),label);

has("createDefaultChannel:true,dataChannelLabel:CONTROL_CHANNEL,dataChannelInit:{ordered:true}",'control channel is the pairing component default channel');
must(component.includes("if(options.createDefaultChannel!==false&&(!bucket.channel||bucket.channel.readyState!=='open'))return;"),'pairing component defers connected callback until default control channel is open');
must(!html.includes("createDefaultChannel:false,payloadPrefix:'bkpr1'"),'custom pairing no longer disables the default readiness channel');
const setup=html.match(/function setupPairing\(\)\{[^\n]+\}/)?.[0]||'';
must(!setup.includes('createDataChannel(CONTROL_CHANNEL'),'host does not create a duplicate control channel');
must(setup.includes('createDataChannel(POINTER_CHANNEL'),'pointer channel remains separate');
must(setup.includes('createDataChannel(PREVIEW_CHANNEL'),'preview channel remains separate');

const connected=html.match(/function onAppConnected\(role\)\{[^\n]+\}/)?.[0]||'';
must(!connected.includes("else{$('#pairDialog').open&&$('#pairDialog').close()"),'join does not close pairing dialog immediately on ICE connected');
must(connected.includes("const channelReady=state.channels.control?.readyState==='open'"),'application readiness checks control channel state');

const recovered=html.match(/function markTransportRecovered\(role\)\{[^\n]+\}/)?.[0]||'';
must(recovered.includes("state.remote.connected=true"),'transport is marked connected before dialog close');
must(recovered.includes("if($('#pairDialog').open)setTimeout"),'pairing dialog closes only from recovered transport path');
must(recovered.indexOf('state.remote.connected=true') < recovered.indexOf("if($('#pairDialog').open)setTimeout"),'connected flag is set before closing pairing dialog');

has("$('#pairDialog').addEventListener('close',()=>{if(!state.remote.connected)state.pairing?.close()})",'dialog close cleanup remains guarded by application readiness');


has("function previewTransportChannel(){const dedicated=state.channels.preview;if(dedicated?.readyState==='open')return dedicated;return null}",'preview transport remains isolated to dedicated preview channel');
const longBlock=html.match(/function markTransportLongDisconnected\(role\)\{[^\n]+\}/)?.[0]||'';
must(!longBlock.includes('state.channels.control=null'),'long disconnect preserves control channel reference');
must(!longBlock.includes('state.channels.preview=null'),'long disconnect preserves preview channel reference');
const hardBlock=html.match(/function onAppDisconnected\(role,temporary=false\)\{[^\n]+\}/)?.[0]||'';
must(hardBlock.includes('state.channels.control=null'),'hard failure clears control channel reference');
must(hardBlock.includes('state.channels.preview=null'),'hard failure clears preview channel reference');
has("const useLastPairStats=!meaningfulPairStats&&['failed','disconnected'].includes(pc.iceConnectionState)&&bucket.lastPairStats",'last meaningful candidate-pair stats are preserved');

console.log('WebRTC v1.0.3 readiness / channel isolation / recovery checks passed.');
