// Focused informational-footer regression, not a release certification.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const cfg={"slug": "presentation-remote", "bp": 720, "end": "[data-i18n=\"helpFullscreenLimit\"]", "badge": "privacyBadge", "header": ".dialog-head", "close": "#closeHelpButton"};
const evidence=path.resolve('test-results/mobile-footer');

async function assertHeaderVersionFits(page, width, height, label) {
  const expected = 'v' + JSON.parse(fs.readFileSync(path.resolve('app.config.json'), 'utf8')).version;
  const version = page.locator('.app-header .version-badge, .app-header .version');
  assert.equal(await version.count(), 1, label + ': one header version');
  assert.equal((await version.textContent()).trim(), expected, label + ': current version');
  assert.equal(await version.isVisible(), true, label + ': header version visible');
  const box = await version.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect();
    let left = 0, right = innerWidth, top = 0, bottom = innerHeight;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(style.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (/hidden|clip|auto|scroll/.test(style.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    const actions = document.querySelector('.header-actions').getBoundingClientRect();
    return { x:r.left, y:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height, left, clipRight:right, top, clipBottom:bottom,
      overlapsActions: r.left < actions.right && r.right > actions.left && r.top < actions.bottom && r.bottom > actions.top };
  });
  assert.ok(box.width > 0 && box.height > 0 && box.x >= box.left - .5 && box.right <= box.clipRight + .5 && box.y >= box.top - .5 && box.bottom <= box.clipBottom + .5 && !box.overlapsActions, label + ': full version glyphs fit viewport/ancestor clips without action overlap ' + JSON.stringify(box));
}

async function main(){
 fs.mkdirSync(evidence,{recursive:true});const browser=await chromium.launch();
 try{for(const language of ['ja','en'])for(const [width,height,touch]of [[1360,900,false],[cfg.bp+1,568,false],[cfg.bp,568,false],[320,568,false],[360,640,false],[390,844,false],[393,252,false],...(cfg.slug==='presentation-remote'?[[900,500,false]]:[])]){
 const context=await browser.newContext({viewport:{width,height},locale:language,reducedMotion:'reduce',hasTouch:touch});
 const page=await context.newPage(),errors=[],requests=[],label=`${language}-${width}x${height}${touch?'-coarse':''}`;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 try{
 await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
 await page.locator('#helpButton').waitFor();
 if(await page.locator('html').getAttribute('lang')!==language)await page.locator('#languageButton').click();
await assertHeaderVersionFits(page, width, height, label);
 const badge=page.locator('[data-i18n="'+cfg.badge+'"]');
 assert.equal((await badge.textContent()).trim(),cfg.slug==='presentation-remote'?(language==='ja'?'資料のアップロードなし':'The deck is not uploaded'):(language==='ja'?'完全ローカル処理':'Fully local processing'));
 assert.equal(await page.locator('.privacy-badge').count(),1,label+': retain one badge');
 assert.match(await page.locator('.privacy-badge svg path').first().getAttribute('d'),/^M12 3 /,label+': retain shield');
 assert.ok(await page.locator('.privacy-badge').isVisible(),label+': badge visible');
 const phone=width<=cfg.bp||(cfg.slug==='presentation-remote'&&width>height&&height<=560&&width<=1000);
 assert.equal(await page.locator('body > footer').isVisible(),!phone,label+': footer');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page width');
 if(cfg.slug==='markdown-preview-lab')assert.equal(await page.locator('.mobile-view-switch').isVisible(),width<=720,label+': workflow switch');
 if(cfg.slug==='smart-image-sorter')assert.equal(await page.locator('.mobile-bottom-bar').isVisible(),width<=600,label+': existing navigation breakpoint');
 if([1360,320].includes(width))await page.screenshot({path:path.join(evidence,label+'.png')});
 await page.locator('#helpButton').click();
 await page.locator('#helpDialog .dialog-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const bounds=await page.locator(cfg.end).evaluate(el=>{const range=document.createRange(),t=el.firstChild;range.setStart(t,t.textContent.length-1);range.setEnd(t,t.textContent.length);const r=range.getBoundingClientRect();let top=0,bottom=innerHeight;for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(s.overflowY)){const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}return{top:r.top,bottom:r.bottom,clipTop:top,clipBottom:bottom};});
 assert.ok(bounds.top>=bounds.clipTop-1&&bounds.bottom<=bounds.clipBottom+1,label+': Help end reachable '+JSON.stringify(bounds));
 const header=await page.locator('#helpDialog '+cfg.header).boundingBox();assert.ok(header&&header.y>=0&&header.y+header.height<=height,label+': Help header visible');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#helpDialog').isVisible(),false,label+': Escape closes Help');
 await page.locator('#helpButton').click();await page.locator(cfg.close).click();assert.equal(await page.locator('#helpDialog').isVisible(),false,label+': close');
 assert.deepEqual(errors,[],label+': runtime errors');assert.deepEqual(requests,[],label+': external requests');console.log('PASS '+label);
 }catch(error){await page.screenshot({path:path.join(evidence,'failure-'+label+'.png')}).catch(()=>{});throw error;}finally{await context.close();}
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
