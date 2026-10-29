import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files=['components/webrtc-qr-pairing.html','src/index.template.html','dist/index.html'];
const all=files.map(f=>readFileSync(f,'utf8'));
const fragment=s=>{const a=s.indexOf('  const COPY = {'),e=s.indexOf('  window.AppWebRtcQrPairing = Object.freeze({ mount });',a);assert.ok(a>=0&&e>a);return s.slice(a,e+'  window.AppWebRtcQrPairing = Object.freeze({ mount });'.length)};
assert.equal(fragment(all[0]),fragment(all[1]));
assert.equal(fragment(all[0]),fragment(all[2]));
for(const s of all){
  for(const k of ['data-webrtc-troubleshoot="host"','data-webrtc-troubleshoot="join"','data-diag-details="${side}"','data-copy="androidPermission"','data-join-scan','どちらの端末で使いますか？','Which device are you using?','付近のデバイス','Nearby devices','scheduleJoinRegeneration'])assert.ok(s.includes(k),'missing '+k);
}
assert.ok(fragment(all[0]).includes("q('[data-join-scan]').hidden=true"));
assert.ok(fragment(all[0]).includes("q('[data-join-scan]').hidden=Boolean(state.join.pendingOffer)"));
for(const s of all.slice(1)){assert.ok(s.includes('data-i18n="helpRtcNearby"'));assert.equal((s.match(/helpRtcNearby:/g)||[]).length,2);}
console.log('Pairing UX regression passed');
