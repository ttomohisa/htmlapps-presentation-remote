import fs from 'node:fs';

const html = fs.readFileSync('src/index.template.html','utf8');
const must = (cond,label)=>{ if(!cond) throw new Error(`PPTX chart v1.0.5 regression failed: ${label}`); };

const start = html.indexOf('async renderUnlocked(index,thumb=false)');
const end = html.indexOf('\n}', start);
must(start >= 0, 'HiFiPptxDeck.renderUnlocked exists');
const body = html.slice(start, end > start ? end + 2 : start + 8000);

const createHost = body.indexOf("const stagingHost=document.createElement('div')");
const appendSlide = body.indexOf('stagingHost.append(handle.element)');
const attachHost = body.indexOf('document.body.append(stagingHost)');
const awaitReady = body.indexOf('await handle.ready');
const wrapFrame = body.indexOf('wrapPptxDom(handle.element');
const removeHost = body.indexOf('stagingHost.remove()');

must(createHost >= 0, 'off-screen staging host is created');
must(appendSlide > createHost, 'rendered slide is placed in staging host');
must(attachHost > appendSlide, 'staging host is attached to the document');
must(awaitReady > attachHost, 'renderer readiness is awaited only after DOM connection');
must(wrapFrame > awaitReady, 'visible frame is created after async chart initialization');
must(removeHost > wrapFrame, 'staging host is removed after moving the rendered element');
must(body.includes('width:${this.width}px;height:${this.height}px'), 'staging host provides real slide dimensions');
must(body.includes("if(thumb)this.thumbHandles.set(index,handle);else this.mainHandle=handle"), 'main and thumbnail render paths share the fixed sequence');

const presenterPreview = html.indexOf('async function renderHiFiPresenterPreview(index)');
must(presenterPreview >= 0, 'Presenter View high-fidelity preview still exists');
const presenterSlice = html.slice(presenterPreview, presenterPreview + 6500);
must(presenterSlice.indexOf('document.body.append(host)') < presenterSlice.indexOf('await previewTimeout(handle.ready'), 'Presenter View remains connected before readiness');

console.log('Presentation Remote v1.0.5 PPTX chart connected-render checks passed.');
