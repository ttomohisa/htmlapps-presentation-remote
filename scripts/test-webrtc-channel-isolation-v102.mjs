import fs from 'node:fs';

const html=fs.readFileSync('src/index.template.html','utf8');
const component=fs.readFileSync('components/webrtc-qr-pairing.html','utf8');
const must=(cond,label)=>{if(!cond)throw new Error(`WebRTC v1.0.2 invariant failed: ${label}`)};
const has=(needle,label=needle)=>must(html.includes(needle),label);

has("function previewTransportChannel(){const dedicated=state.channels.preview;if(dedicated?.readyState==='open')return dedicated;return null}",'preview transport uses only dedicated preview channel');
must(!/function previewTransportChannel\(\)\{[^}]*state\.channels\.control/.test(html),'control channel is not selected for bulk previews');
has("rememberChannel(role,createDataChannel(CONTROL_CHANNEL,{ordered:true}))",'host registers control channel immediately');
has("rememberChannel(role,createDataChannel(PREVIEW_CHANNEL,{ordered:true}))",'host registers preview channel immediately');
has('function markTransportLongDisconnected(role)','long-disconnect state is separate from hard failure');
const longBlock=html.match(/function markTransportLongDisconnected\(role\)\{[^\n]+\}/)?.[0]||'';
must(!longBlock.includes('state.channels.control=null'),'long disconnect preserves control channel reference');
must(!longBlock.includes('state.channels.preview=null'),'long disconnect preserves preview channel reference');
const hardBlock=html.match(/function onAppDisconnected\(role,temporary=false\)\{[^\n]+\}/)?.[0]||'';
must(hardBlock.includes('state.channels.control=null'),'hard failure clears control channel reference');
must(hardBlock.includes('state.channels.preview=null'),'hard failure clears preview channel reference');
has("diagRouteLostAfterConnected:'一度は候補ペアで接続できましたが",'connected-then-lost diagnostic');
has("const useLastPairStats=!meaningfulPairStats&&['failed','disconnected'].includes(pc.iceConnectionState)&&bucket.lastPairStats",'last meaningful candidate-pair stats are preserved');
has("useLastPairStats?` · ${t('diagLastObserved')}`:''",'diagnostic marks preserved stats as last observed');
must(component.includes('lastPairStats:null'),'reusable WebRTC component also preserves pair diagnostics');

console.log('WebRTC v1.0.2 channel isolation / recovery / diagnostic snapshot checks passed.');
