import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the same peer creation/channel selection code from the reusable
// component and the embedded standalone source, without physical hardware.
for (const file of ['components/webrtc-qr-pairing.html', 'src/index.template.html']) {
  const source = fs.readFileSync(file, 'utf8');
  function extract(first, next) {
    const a = source.indexOf(first);
    const b = source.indexOf(next, a + first.length);
    assert.ok(a >= 0 && b > a, file + ': expected function boundaries');
    return source.slice(a, b);
  }
  const order = [];
  class Peer {
    constructor(config) {
      assert.deepEqual(config, {iceServers: []});
      this.connectionState = 'new';
    }
    addEventListener() {}
    createDataChannel(label) {
      order.push(label);
      return {label, readyState: 'connecting', addEventListener() {}};
    }
  }
  const state = {host: {pc: null, channel: null}, join: {pc: null, channel: null}};
  const options = {
    createDefaultChannel: true,
    dataChannelLabel: 'control',
    dataChannelInit: {ordered: true},
    onPeerCreated({role, createDataChannel}) {
      if (role === 'host') {
        createDataChannel('pointer', {ordered: false, maxRetransmits: 0});
        createDataChannel('preview', {ordered: true});
      }
    }
  };
  const createPeer = new Function('RTCPeerConnection', 'state', 'isCurrentPc', 'updateDiagnostics', 'handleConnectionState', 'bindChannel', 'options', 'startDiagnosticPolling',
    extract('    function createPeer(role, attempt) {', '    function bindChannel(role, channel, pc, attempt) {') + '\nreturn createPeer;'
  )(Peer, state, () => true, () => {}, () => {}, () => {}, options, () => {});
  createPeer('host', 1);
  assert.deepEqual(order, ['control', 'pointer', 'preview'], file + ': original control-first channel ordering');
  assert.equal(state.host.channel.label, 'control');

  // If the peer announces pointer before control, don't mistake it for
  // the required default control channel.
  const joinPeer = {connectionState: 'new'};
  state.join.pc = joinPeer;
  state.join.attempt = 2;
  const bind = new Function('state', 'isCurrentPc', 'options', 'markConnected',
    extract('    function bindChannel(role, channel, pc, attempt) {', '    function markConnected(role, pc, attempt) {') + '\nreturn bindChannel;'
  )(state, (role, pc, attempt) => state[role].pc === pc && state[role].attempt === attempt, options, () => {});
  function channel(label) {
    const listeners = {};
    return {label, readyState: 'open', addEventListener(name, fn) {listeners[name] = fn;}, emit(name) {listeners[name]?.();}};
  }
  const pointer = channel('pointer');
  bind('join', pointer, joinPeer, 2);
  pointer.emit('open');
  assert.equal(state.join.channel, null, file + ': pointer must not satisfy control readiness');
  const control = channel('control');
  bind('join', control, joinPeer, 2);
  control.emit('open');
  assert.equal(state.join.channel, control, file + ': control should become primary');
  assert.ok(source.includes("bucket.channel.label!==options.dataChannelLabel"), file + ': readiness checks the control channel label');
}

// A late failure from a closed PeerConnection must not reset the active link.
{
  const source = fs.readFileSync('src/index.template.html', 'utf8');
  const line = source.split('\n').find(x => x.startsWith('function bindTransportState(role,pc)'));
  assert.ok(line, 'transport state hook exists');
  const active = {connectionState: 'connected', listeners: {}, addEventListener(name, fn) {this.listeners[name] = fn;}};
  const old = {connectionState: 'failed', listeners: {}, addEventListener(name, fn) {this.listeners[name] = fn;}};
  const observed = [];
  const state = {dev: {pc: null}, pairing: {peerConnection: () => active}};
  const bind = new Function('state', 'onTransportState', line + '\nreturn bindTransportState;')(state, (role, status) => observed.push([role, status]));
  bind('host', old);
  bind('host', active);
  old.listeners.connectionstatechange();
  assert.deepEqual(observed, [], 'stale failure ignored');
  active.listeners.connectionstatechange();
  assert.deepEqual(observed, [['host', 'connected']], 'active transport still reports state');
}
console.log('WebRTC control-first and stale-peer regressions passed.');
