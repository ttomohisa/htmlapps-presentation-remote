import fs from 'node:fs';

const html = fs.readFileSync('src/index.template.html','utf8');
const component = fs.readFileSync('components/webrtc-qr-pairing.html','utf8');
const must = (cond,label)=>{ if(!cond) throw new Error(`WebRTC diagnostics v1.0.1 regression: ${label}`); };

for (const [name,source] of [['app',html],['component',component]]) {
  for (const token of [
    'function candidatePairDiagnostics(pc)',
    'function classifyCandidatePairStats(summary, pc)',
    "diagPairTests:'候補ペア試行'",
    "diagConnectivity:'疎通確認'",
    "diagLikelyCause:'推定原因'",
    "diagRouteOutboundNoReply",
    "diagRouteInboundNoReply",
    "diagRouteAsymmetric",
    'requestsSent',
    'responsesReceived',
    'requestsReceived',
    'responsesSent',
    'startDiagnosticPolling(role,pc,attempt)',
    'stopDiagnosticPolling(role)'
  ]) must(source.includes(token),`${name} contains ${token}`);
}

const start = html.indexOf('function classifyCandidatePairStats(summary, pc)');
const end = html.indexOf('async function candidatePairDiagnostics(pc)',start);
must(start >= 0 && end > start,'classifier source can be extracted');
const classifierSource = html.slice(start,end);
const classify = new Function(`${classifierSource}; return classifyCandidatePairStats;`)();
const failedPc = {remoteDescription:{type:'answer'},iceConnectionState:'failed',connectionState:'failed'};
const base = {available:true,total:1,succeeded:0,checking:0,failed:1,requestsSent:0,responsesReceived:0,requestsReceived:0,responsesSent:0,hasCounters:true,selectedLabel:''};

must(classify({...base,available:false,total:0},failedPc)==='diagPairFailed','unavailable stats fall back safely');
must(classify({...base,total:0},failedPc)==='diagRouteNoPairs','no compatible pair classification');
must(classify({...base,succeeded:1,selectedLabel:''},failedPc)==='diagRouteSucceededNotSelected','succeeded but unselected classification');
must(classify({...base,hasCounters:false},failedPc)==='diagPairFailed','missing counters fall back safely');
must(classify({...base},failedPc)==='diagRouteNoChecks','no checks classification');
must(classify({...base,requestsSent:4},failedPc)==='diagRouteOutboundNoReply','outbound checks without reply classification');
must(classify({...base,requestsReceived:3},failedPc)==='diagRouteInboundNoReply','inbound checks without local reply classification');
must(classify({...base,requestsSent:4,requestsReceived:3,responsesSent:3},failedPc)==='diagRouteAsymmetric','asymmetric connectivity classification');
must(classify({...base,requestsSent:4,responsesReceived:2},failedPc)==='diagRouteChecksResponded','checks responded but connection failed classification');
must(classify({...base,requestsSent:73,responsesReceived:3,selectedLabel:'UDP host IPv6 ↔ UDP host IPv6'},failedPc)==='diagRouteLostAfterConnected','previously selected route that later fails is classified explicitly');
must(classify({...base,requestsSent:4}, {...failedPc,iceConnectionState:'checking',connectionState:'connecting'})==='', 'no premature cause while still checking');
must(classify({...base,succeeded:1,selectedLabel:''}, {...failedPc,iceConnectionState:'checking',connectionState:'connecting'})==='', 'succeeded-but-unselected is not reported before ICE fails');


const diagStart = html.indexOf('function addressKind(address)');
const diagEnd = html.indexOf('async function updateDiagnostics(role, pc, extra={})',diagStart);
must(diagStart >= 0 && diagEnd > diagStart,'candidate-pair diagnostics source can be extracted');
const diagnosticsSource = html.slice(diagStart,diagEnd);
const candidatePairDiagnostics = new Function(`${diagnosticsSource}; return candidatePairDiagnostics;`)();
const fakeReports = [
  {id:'local1',type:'local-candidate',protocol:'udp',candidateType:'host',address:'192.168.1.10'},
  {id:'remote1',type:'remote-candidate',protocol:'udp',candidateType:'host',address:'peer.local'},
  {id:'pair1',type:'candidate-pair',state:'failed',localCandidateId:'local1',remoteCandidateId:'remote1',requestsSent:7,responsesReceived:0,requestsReceived:2,responsesSent:2},
  {id:'transport1',type:'transport',selectedCandidatePairId:''}
];
const fakePc = {signalingState:'stable',getStats:async()=>({forEach(cb){for(const item of fakeReports)cb(item);}})};
const aggregate = await candidatePairDiagnostics(fakePc);
must(aggregate.total===1 && aggregate.failed===1,'candidate-pair state counts are aggregated');
must(aggregate.requestsSent===7 && aggregate.requestsReceived===2 && aggregate.responsesSent===2,'connectivity counters are aggregated');
must(aggregate.hasCounters===true,'counter availability is detected');


const renderStart = html.indexOf('function parseIceCandidates(sdp)');
const renderEnd = html.indexOf('function iceError(code)',renderStart);
must(renderStart >= 0 && renderEnd > renderStart,'render diagnostics source can be extracted');
const renderedEl = {hidden:true,textContent:'',classList:{toggle(){}}};
const ja = {
  diagGather:'ICE収集',diagLocal:'ローカル候補',diagRemote:'相手候補',diagIce:'ICE状態',diagPeer:'接続状態',diagPair:'候補ペア',diagNoPair:'まだ確立していません',
  diagPairTests:'候補ペア試行',diagPairSuccess:'成功',diagPairChecking:'確認中',diagPairFailedCount:'失敗',diagConnectivity:'疎通確認',diagSent:'送信',diagRepliesReceived:'応答受信',diagReceived:'受信',diagRepliesSent:'応答送信',diagLikelyCause:'推定原因',
  diagRouteOutboundNoReply:'OUTBOUND_NO_REPLY',diagRouteLostAfterConnected:'LOST_AFTER_CONNECTED',diagLastObserved:'直前の観測',diagPairFailed:'GENERIC',stateComplete:'完了',stateConnected:'接続済み',stateFailed:'失敗'
};
const q = ()=>renderedEl;
const t = key=>ja[key] ?? key;
const state={host:{lastPairStats:null},join:{lastPairStats:null}};
const diagnosticsApi = new Function('q','t','state',`${html.slice(renderStart,renderEnd)}; return {updateDiagnostics};`)(q,t,state);
const sdpLocal='v=0\r\na=candidate:1 1 UDP 1 192.168.1.2 5000 typ host\r\n';
const sdpRemote='v=0\r\na=candidate:2 1 UDP 1 192.168.1.3 5001 typ host\r\n';
const renderReports = [
  {id:'l',type:'local-candidate',protocol:'udp',candidateType:'host',address:'192.168.1.2'},
  {id:'r',type:'remote-candidate',protocol:'udp',candidateType:'host',address:'192.168.1.3'},
  {id:'p',type:'candidate-pair',state:'failed',localCandidateId:'l',remoteCandidateId:'r',requestsSent:5,responsesReceived:0,requestsReceived:0,responsesSent:0}
];
await diagnosticsApi.updateDiagnostics('host',{
  signalingState:'stable',iceGatheringState:'complete',iceConnectionState:'failed',connectionState:'failed',
  localDescription:{sdp:sdpLocal},remoteDescription:{sdp:sdpRemote},
  getStats:async()=>({forEach(cb){for(const item of renderReports)cb(item);}})
});
must(renderedEl.textContent.includes('候補ペア試行: 1 · 成功 0 / 確認中 0 / 失敗 1'),'rendered diagnostics include pair state counts');
must(renderedEl.textContent.includes('疎通確認: 送信 5 / 応答受信 0 · 受信 0 / 応答送信 0'),'rendered diagnostics include explicit connectivity counters');
must(renderedEl.textContent.includes('推定原因: OUTBOUND_NO_REPLY'),'rendered diagnostics include classified likely cause');

// Preserve the last meaningful route when Chromium drops candidate-pair reports after failure.
state.host.lastPairStats=null;
const connectedReports = [
  {id:'l2',type:'local-candidate',protocol:'udp',candidateType:'host',address:'2001:db8::1'},
  {id:'r2',type:'remote-candidate',protocol:'udp',candidateType:'host',address:'2001:db8::2'},
  {id:'p2',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'l2',remoteCandidateId:'r2',requestsSent:4,responsesReceived:3,requestsReceived:1,responsesSent:1,currentRoundTripTime:0.09},
  {id:'t2',type:'transport',selectedCandidatePairId:'p2'}
];
await diagnosticsApi.updateDiagnostics('host',{
  signalingState:'stable',iceGatheringState:'complete',iceConnectionState:'connected',connectionState:'connected',
  localDescription:{sdp:sdpLocal},remoteDescription:{sdp:sdpRemote},
  getStats:async()=>({forEach(cb){for(const item of connectedReports)cb(item);}})
});
const failedWithoutPairs={
  signalingState:'stable',iceGatheringState:'complete',iceConnectionState:'failed',connectionState:'failed',
  localDescription:{sdp:sdpLocal},remoteDescription:{sdp:sdpRemote},
  getStats:async()=>({forEach(){}})
};
await diagnosticsApi.updateDiagnostics('host',failedWithoutPairs);
must(renderedEl.textContent.includes('直前の観測'),'failed diagnostics retain and label the last meaningful selected route');
must(renderedEl.textContent.includes('推定原因: LOST_AFTER_CONNECTED'),'connected-then-failed transition does not regress to no-pair diagnosis');


must(!html.includes('${report.address}'),'diagnostic label does not interpolate raw candidate address');
must(!component.includes('${report.address}'),'shared component does not interpolate raw candidate address');

console.log('WebRTC candidate-pair diagnostics v1.0.1 regression checks passed.');
