'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const url=pathToFileURL(path.resolve('scripts/webrtc-local-self-test.html')).href;
   for(const [locale,width,height] of [['en-US',1280,800],['ja-JP',375,812]]){
     const ctx=await browser.newContext({locale,viewport:{width,height}});
     const page=await ctx.newPage();
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(url);
     assert.equal(await page.locator('html').getAttribute('lang'),locale.startsWith('ja')?'ja':'en');
     await page.locator('#start').click();
     await page.waitForFunction(()=>document.querySelector('#status')?.dataset.result==='success',null,{timeout:45000});
     const details=await page.locator('#details').innerText();
     assert.ok(details.includes('Result: PASS')||details.includes('結果: 成功'));
     assert.ok(details.includes('responsesReceived='));
     assert.ok(!details.match(/(?:\d{1,3}\.){3}\d{1,3}/),'raw IPv4 not shown');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
     assert.deepEqual(errors,[]);
     await ctx.close();
     console.log('PASS '+locale+' same-device WebRTC test');
   }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
