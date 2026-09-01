import fs from 'node:fs';

const html = fs.readFileSync('src/index.template.html','utf8');
const must = (needle,label=needle)=>{ if(!html.includes(needle)) throw new Error(`Missing v0.9.0 remote UX invariant: ${label}`); };
const mustMatch = (re,label)=>{ if(!re.test(html)) throw new Error(`Missing v0.9.0 remote UX invariant: ${label}`); };

// Wake Lock: automatic while connected, visible state, re-acquire after visibility restoration.
must("wakeLockStatus:'idle'",'Wake Lock lifecycle state');
must('id="remoteWakeRow"','Wake Lock status UI');
must("navigator.wakeLock?.request",'Screen Wake Lock API guard');
mustMatch(/markTransportRecovered\(role\)[\s\S]*?wakeLockWanted=true[\s\S]*?ensureWakeLock\(\)/,'Wake Lock requested after phone connection recovery');
mustMatch(/visibilitychange[\s\S]*?wakeLockWanted[\s\S]*?ensureWakeLock/,'Wake Lock re-acquired when the page becomes visible');
mustMatch(/releaseWakeLock\(\)[\s\S]*?wakeLockWanted=false/,'Wake Lock released explicitly');

// Disconnect/recovery UX: temporary recovery and finite lost-state action.
must('id="remoteConnectionBanner"','connection recovery banner');
must('id="remoteReconnectButton"','manual re-pair action');
must('connectionUnstableTitle','temporary disconnect explanation');
must('connectionLostTitle','permanent disconnect explanation');
mustMatch(/onAppDisconnected\(role,temporary=false\)[\s\S]*?remote\.lost=state\.remote\.everConnected/,'permanent phone disconnect becomes explicit lost state');
mustMatch(/markTransportRecovered\(role\)[\s\S]*?remote\.lost=false[\s\S]*?remote\.connected=true/,'recovery clears lost state');
mustMatch(/restartRemotePairing\(\)[\s\S]*?openPair\('join'\)/,'Reconnect action returns to QR pairing');

// Speaker notes: persisted readable text size and top reset on slide changes.
must('id="remoteNotesSmaller"','speaker-note text-size decrease control');
must('id="remoteNotesLarger"','speaker-note text-size increase control');
must('notes-font-size','speaker-note size localStorage key');
mustMatch(/setNotesFontSize\(size\)[\s\S]*?Math\.max\(11,Math\.min\(19/,'speaker-note size clamped to readable range');
mustMatch(/slideChanged[\s\S]*?notes\.scrollTop=0/,'speaker notes reset to top after slide navigation');
must('max-height:min(28vh,220px)','long notes keep an internal scroll area');

// Slide navigation: count is tappable, dialog has direct input + generated number grid.
must('id="remoteSlideJumpOpen"','tappable current/total slide counter');
must('id="remoteSlideDialog"','slide jump dialog');
must('id="remoteSlideGrid"','slide number grid');
must('function slideJumpIndexes(total,current)','large-deck compact slide index generation');
mustMatch(/remoteSlideGrid[\s\S]*?data-slide-index/,'slide grid selection handler');
mustMatch(/sendCommand\('goto',\{index\}\)/,'slide grid sends goto command');

// Operation feedback: immediate visual + optional haptic feedback, without optimistic slide-state mutation.
must('function commandFeedback(command)','command visual feedback');
must("navigator.vibrate",'haptic feedback capability');
must("classList.add('command-feedback')",'visible command pulse');
mustMatch(/sendCommand\(command,extra=\{\}\)[\s\S]*?if\(sent\)\{haptic\(command\);commandFeedback\(command\)\}/,'feedback only after successful DataChannel send');
if (/sendCommand\(command,extra=\{\}\)[\s\S]*?state\.remote\.index\s*[+\-=]/.test(html)) throw new Error('Remote command feedback must not optimistically mutate the slide index');

// Mobile layout safety.
must('.remote-slide-dialog{width:calc(100% - 12px)','mobile slide dialog stays inside viewport');
must('.remote-notes-size-button{display:grid;place-items:center;min-width:42px;min-height:40px','note size controls retain meaningful tap targets');

console.log('v0.9.0 Wake Lock / reconnect / notes / slide jump / feedback regression checks passed.');
