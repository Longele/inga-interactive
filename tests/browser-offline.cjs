const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.route('**/__offline-test__',r=>r.fulfill({body:'<!doctype html><title>Offline test</title>',contentType:'text/html'}));
    await page.goto(base+'/__offline-test__');
    await page.evaluate(async()=>{
      await caches.open('unrelated-project-cache');
      await caches.open('inga:'+location.origin+'/:old-version');
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
    const state=await page.evaluate(async()=>{
      const keys=await caches.keys(),prefix='inga:'+location.origin+'/:';
      const current=keys.filter(k=>k.startsWith(prefix));
      const cache=await caches.open(current[0]);
      const html=await (await cache.match('index.html')).text();
      return {unrelated:keys.includes('unrelated-project-cache'),old:keys.includes(prefix+'old-version'),count:current.length,assets:(await cache.keys()).length,updated:html.includes('id="result-feedback"')};
    });
    assert.deepEqual(state,{unrelated:true,old:false,count:1,assets:37,updated:true});
    console.log('PASS offline cache installs all resources, updates this site, and preserves unrelated caches');
    await context.setOffline(true);
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>window.__INGA&&document.querySelector('#loading.gone'),null,{timeout:60000});
    assert.equal(await page.evaluate(()=>__INGA.runValidation().every(r=>r.ok)),true);
    const audio=await page.evaluate(async()=>{const r=await fetch('voix/stop1.mp3');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});
    assert.ok(audio.ok&&audio.bytes>0);
    assert.deepEqual(errors,[]);
    console.log('PASS offline navigation, simulation checks, and narration asset');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
