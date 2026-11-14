import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('src/index.template.html','utf8');
const pairing=readFileSync('components/webrtc-qr-pairing.html','utf8');
const cssClassCount=(src,name)=>[...src.matchAll(new RegExp('\\.'+name+'\\s*\\{','g'))].length;

assert.match(app,/<section class="page-intro" id="introSection">/);
assert.match(app,/data-i18n="introTitle">スライドをスマホで操作<\/h1>/);
assert.match(app,/QRで接続します。<\/p>/);
assert.doesNotMatch(app,/privacyBadge:|class="privacy-badge"|data-i18n="privacyBadge"/);
assert.match(app,/state\.file=file;\$\('#introSection'\)\.hidden=true;\$\('#startView'\)\.hidden=true;/);
assert.match(app,/state\.phase='error';\$\('#loadStatus'\)\.hidden=true;\$\('#introSection'\)\.hidden=false;/);
assert.match(app,/@media\(max-width:1040px\)\{\.presenter\{grid-template-columns:130px minmax\(0,1fr\)\}\.side-column\{grid-column:1\/-1;position:static;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'two cards fill the mid-width row');
assert.doesNotMatch(app,/\.side-column\{grid-column:1\/-1;position:static;grid-template-columns:repeat\(3,/,'no empty third column after removal of the compatibility card');
assert.match(app,/<div class="compat-inline"><details id="compatDetails" class="compat-details"><summary>/);
assert.doesNotMatch(app,/compat-card/,'no compatibility card remains on mobile or desktop');
assert.match(app,/\.compat-inline\{margin:8px 0 0;padding:2px 4px 0;min-width:0\}/,'unboxed compatibility row');
const center=app.slice(app.indexOf('<div class="center-column">'),app.indexOf('<aside class="side-column">'));
assert.ok(center.indexOf('class="nav-bar"')<center.indexOf('class="compat-inline"'),'compatibility lives below the stage navigation');
assert.ok(center.includes('id="compatSummary"'),'disclosure moved with its full summary');
assert.match(app,/id="compatWarning"[^>]+hidden/);
assert.match(app,/\$\('#compatDetails'\)\.open=false/);
assert.match(app,/\$\('#compatWarning'\)\.hidden=\!\(hasWarnings\|\|fallback\)/);
assert.match(app,/\.compat-details\[open\] summary svg\{transform:rotate\(180deg\)\}/);
assert.equal(cssClassCount(pairing,'app-webrtc-role-switch'),1,'role switch style in source component');
assert.equal(cssClassCount(app,'app-webrtc-role-switch'),2,'role switch styled in both embedded blocks');
assert.equal(cssClassCount(pairing,'app-webrtc-scanner-panel'),1,'scanner gap style in source component');
assert.equal(cssClassCount(app,'app-webrtc-scanner-panel'),2,'scanner gap in both embedded blocks');
for(const src of [app,pairing]){
 assert.match(src,/\.app-webrtc-role-switch \{ flex:0 0 auto; white-space:nowrap; \}/);
 assert.match(src,/\.app-webrtc-scanner-panel \{ margin-top:12px; \}/);
 assert.match(src,/joinCoachScanBody:'PCのQRを映すと自動で読み取ります。'/);
 assert.match(src,/joinCoachScanBody:'Aim at the PC QR. It scans automatically.'/);
 assert.equal((src.match(/class="app-webrtc-button small app-webrtc-role-switch"/g)||[]).length,2);
}
console.log('Intro visibility, unboxed compatibility placement and QR layout contracts passed.');
