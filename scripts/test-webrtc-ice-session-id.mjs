import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const files=[
  'components/webrtc-qr-pairing.html',
  'src/index.template.html',
  'presentation-remote.html'
];
const source=files.map(file=>readFileSync(file,'utf8'));
function extract(s){
  const begin=s.indexOf('    async function iceSessionTag(sdp) {');
  const end=s.indexOf('    function stateLabel(value)',begin);
  assert.ok(begin>=0&&end>begin,'ICE session helper must be present');
  return s.slice(begin,end);
}
const helper=extract(source[0]);
for(let i=1;i<source.length;i++){
  assert.equal(extract(source[i]),helper,files[i]+' diverged from component');
}
for(let i=0;i<source.length;i++){
  assert.ok(source[i].includes("if(pc.localDescription||pc.remoteDescription)lines.push("),files[i]+' missing session display');
  assert.ok(source[i].includes("if(state[role].pc!==pc)return;"),files[i]+' missing stale peer guard');
}
const tag=Function('crypto','TextEncoder',helper+';return iceSessionTag;')(webcrypto,TextEncoder);
const a='a=ice-ufrag:pc-generation-001\r\na=ice-pwd:very-secret\r\n';
const b='a=ice-ufrag:phone-generation-002\r\n';
const idA=await tag(a),idB=await tag(b);
assert.match(idA,/^[A-F0-9]{10}$/);
assert.notEqual(idA,idB,'different ICE generations should differ');
assert.equal(idA,await tag(a),'local and remote copy must produce the same ID');
assert.equal(await tag(''),'—');
assert.ok(!idA.includes('pc-generation-001')&&!idA.includes('very-secret'));
console.log('PASS: privacy-safe ICE generation tags match across component, template, standalone, and SDP copies.');
