import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('src/index.template.html', 'utf8');
const match = html.match(/function scheduleRemotePreviewRequest\(force=false\)\{[^\n]+\}/);
if (!match) throw new Error('Could not extract scheduleRemotePreviewRequest');
const source = match[0];

function makeContext({ withChannel = false } = {}) {
  let now = 100_000;
  const sent = [];
  const timerCalls = [];
  const channel = withChannel ? { readyState: 'open' } : null;
  const state = {
    role: '',
    remote: { connected: true, reconnecting: false, deckRevision: 7, index: 0, total: 2, totalKnown: true, kind: 'pptx' },
    remoteUi: {
      presenterView: true,
      previewCache: new Map(), previewErrors: new Map(), previewStatus: new Map(),
      notesCache: new Map(), notesErrors: new Set(),
      lastPreviewRequestKey: '', lastPreviewRequestAt: 0,
      previewAttemptStartedAt: 0, previewLastProgressAt: 0, previewRequestTimer: 0
    }
  };
  const context = {
    state,
    Date: { now: () => now },
    clearTimeout: () => {},
    setTimeout: (fn, delay) => { timerCalls.push(delay); return timerCalls.length; },
    renderRemotePresenterView: () => {},
    previewTransportChannel: () => channel,
    sendPreviewJson: payload => { sent.push(payload); return true; },
    Math,
    PROTOCOL_VERSION: 4,
  };
  vm.createContext(context);
  vm.runInContext(`${source}; this.run=scheduleRemotePreviewRequest;`, context);
  return { context, state, sent, timerCalls, advance(ms) { now += ms; } };
}

// Global role must not gate requests. This reproduces the timing race where the
// receive callback already identifies the join side but state.role is blank.
{
  const t = makeContext({ withChannel: true });
  t.context.run(true);
  if (t.sent.length !== 1 || t.sent[0].type !== 'preview-request') {
    throw new Error('Presenter preview request is still gated by global role state');
  }
}

// Missing transport must not reset the attempt clock on each retry.
{
  const t = makeContext({ withChannel: false });
  t.context.run(true);
  const started = t.state.remoteUi.previewAttemptStartedAt;
  if (!started) throw new Error('Missing-channel preview attempt did not start its timeout clock');
  if (!t.timerCalls.includes(1000)) throw new Error('Missing-channel preview attempt did not schedule a retry');
  t.advance(31_000);
  t.context.run(true);
  if (t.state.remoteUi.previewAttemptStartedAt !== started) {
    throw new Error('Missing-channel retry reset the preview attempt clock');
  }
  if (t.state.remoteUi.previewErrors.get(0) !== 'PREVIEW_TIMEOUT' || t.state.remoteUi.previewErrors.get(1) !== 'PREVIEW_TIMEOUT') {
    throw new Error('Missing-channel preview did not reach PREVIEW_TIMEOUT');
  }
  if (!t.state.remoteUi.notesErrors.has(0)) throw new Error('Speaker notes did not leave the waiting state after preview timeout');
}

console.log('Presenter preview scheduling state-machine regression checks passed.');
