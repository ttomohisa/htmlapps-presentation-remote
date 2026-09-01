import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
const start = html.indexOf('class PptxRenderGate');
const end = html.indexOf('class HiFiPptxDeck', start);
if (start < 0 || end < 0) throw new Error('PptxRenderGate not found');
const source = html.slice(start, end);
const context = { Promise, Error };
vm.createContext(context);
vm.runInContext(`${source}\nthis.PptxRenderGate=PptxRenderGate;`, context);

let releaseFirst;
const firstWait = new Promise((resolve) => { releaseFirst = resolve; });
const events = [];
const gate = new context.PptxRenderGate();
const thumb1 = gate.run('thumb', async () => { events.push('thumb1:start'); await firstWait; events.push('thumb1:end'); });
await new Promise((resolve) => setTimeout(resolve, 0));
const thumb2 = gate.run('thumb', async () => { events.push('thumb2:start'); events.push('thumb2:end'); });
const main = gate.run('main', async () => { events.push('main:start'); events.push('main:end'); });
releaseFirst();
await Promise.all([thumb1, thumb2, main]);
assert.deepEqual(events, ['thumb1:start', 'thumb1:end', 'main:start', 'main:end', 'thumb2:start', 'thumb2:end']);

const openStart = html.indexOf('async function openFile(file)');
const openEnd = html.indexOf('async function goTo(index)', openStart);
const openFile = html.slice(openStart, openEnd);
const mainPos = openFile.indexOf('await renderCurrent()');
const thumbPos = openFile.indexOf('buildThumbs(generation)');
assert.ok(mainPos >= 0 && thumbPos > mainPos, 'initial main render must complete before thumbnail generation starts');

console.log('PPTX render priority/concurrency regression checks passed');
