const assert = require('node:assert/strict');
const http = require('node:http');
const {chromium} = require('playwright');
const base = (process.env.INGA_TEST_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

(async()=>{
  // Real release files behind a subpath, with controlled download/update failures.
  // Keep the lifecycle tests independent of the 3D renderer; then boot the full app offline.
  const source=await (await fetch(base+'/sw.js')).text();
  const files=JSON.parse(source.match(/const FILES=(\[.*?\]);/)[1]);
  assert.ok(files.includes('offline.js')&&files.includes('offline.css'),'Offline interface must itself be available offline');
  const version=source.match(/const CACHE_VERSION='([^']+)';/)[1];
  const upstream=new Map();
  let revision=1,failAsset=true,failWorker=false,legacyWorker=false;
  const fixture='<!doctype html><html lang="fr"><meta charset="utf-8"><title>Offline lifecycle</title><style>[hidden]{display:none!important}</style><link rel="stylesheet" href="offline.css"><div id="app"><nav class="tools"><div aria-label="Outils"></div></nav></div><script src="offline.js"></script></html>';
  const server=http.createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname.replace(/^\/release\//,'');
      res.setHeader('Cache-Control','no-store');
      if(path==='__legacy__'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Legacy visit</title>Visite en cours');return;}
      if(path==='__offline-test__'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
      if(path==='sw.js'){
        res.setHeader('Content-Type','application/javascript');
        if(legacyWorker){res.end("const CACHE='inga:'+self.registration.scope+':legacy';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['index.html'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request))));");return;}
        if(failWorker){res.writeHead(503);res.end('Unavailable');return;}
        res.end(source.replace(/const CACHE_VERSION='[^']+';/,"const CACHE_VERSION='"+version+'-test'+revision+"';"));return;
      }
      if(failAsset&&path==='voix/stop8.mp3'){res.writeHead(503);res.end('Retry this download');return;}
      const name=path||'index.html';
      if(!upstream.has(name))upstream.set(name,fetch(base+'/'+name).then(async result=>({body:Buffer.from(await result.arrayBuffer()),type:result.headers.get('content-type'),status:result.status})));
      const result=await upstream.get(name);
      res.statusCode=result.status;
      if(result.type)res.setHeader('Content-Type',result.type);
      res.end(result.body);
    }catch(error){res.writeHead(502);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const url=origin+'/release/';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  async function waitMode(target,mode){
    try{
      // Service-worker state can change in a background tab, independently of animation frames.
      await target.waitForFunction(expected=>window.__INGA_OFFLINE?.state.mode===expected,mode,{timeout:60000,polling:100});
    }catch(error){
      const diagnostic=await target.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration();
        return {visibility:document.visibilityState,focused:document.hasFocus(),offline:window.__INGA_OFFLINE?.state,
          controller:navigator.serviceWorker.controller?.state,active:registration?.active?.state,
          waiting:registration?.waiting?.state,installing:registration?.installing?.state};
      }).catch(failure=>({diagnosticError:failure.message}));
      console.error('Offline mode timeout',JSON.stringify({expected:mode,...diagnostic}));
      throw error;
    }
  }
  try{
    // Registration errors are visible and retryable, rather than silently swallowed.
    failWorker=true;
    await page.goto(url+'__offline-test__');
    await waitMode(page,'error');
    await page.locator('#offline-status').click();
    assert.equal(await page.locator('#offline-retry').isVisible(),true);
    failWorker=false;
    await page.evaluate(async()=>{
      await caches.open('unrelated-project-cache');
      await caches.open('inga:'+location.origin+'/different/:old-version');
      await caches.open('inga:'+location.origin+'/release/:old-version');
    });
    await page.locator('#offline-retry').click();
    await waitMode(page,'incomplete');
    await page.waitForFunction(()=>!!__INGA_OFFLINE.state.current,null,{polling:100});
    const incomplete=await page.evaluate(()=>__INGA_OFFLINE.state);
    assert.equal(incomplete.current.ready,false);
    assert.equal(incomplete.current.cached,files.length-1);
    assert.equal(incomplete.current.total,files.length);
    assert.match(await page.locator('#offline-detail').textContent(),/fichiers enregistrés/);
    console.log('PASS registration failure, partial download, exact progress and actionable retry');

    failAsset=false;
    await page.locator('#offline-retry').click();
    await waitMode(page,'ready');
    assert.equal(await page.evaluate(()=>__INGA_OFFLINE.state.current.cached),files.length);
    await context.setOffline(true);
    const audio=await page.evaluate(async()=>{const r=await fetch('voix/stop8.mp3');return {ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};});
    assert.ok(audio.ok&&audio.bytes>0);
    await context.setOffline(false);
    // Simulate storage eviction after an earlier successful install: never keep a stale green badge.
    await page.evaluate(async()=>{
      const keys=await caches.keys();
      const name=keys.find(key=>key.includes('/release/:')&&!key.endsWith('old-version'));
      await (await caches.open(name)).delete(new URL('voix/stop8.mp3',location.href));
    });
    await page.reload();
    await waitMode(page,'incomplete');
    await page.locator('#offline-status').click();
    await page.locator('#offline-retry').click();
    await waitMode(page,'ready');
    console.log('PASS download recovery, cached narration and readiness rechecked after missing cached asset');

    // A failed new version must leave the complete running version in place.
    const marker='ongoing-visit';
    await page.evaluate(value=>window.visitMarker=value,marker);
    failAsset=true;revision=2;
    await page.locator('#offline-check').click();
    await waitMode(page,'incomplete');
    const updateFailed=await page.evaluate(()=>__INGA_OFFLINE.state);
    assert.equal(updateFailed.current.version,version+'-test1');
    assert.equal(updateFailed.current.ready,true);
    assert.equal(updateFailed.pending.ready,false);
    assert.match(await page.locator('#offline-detail').textContent(),/version actuelle reste disponible/);
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{polling:100});
    const denied=await page.evaluate(async()=>{
      const r=await navigator.serviceWorker.getRegistration(),worker=r.waiting;
      return new Promise((resolve,reject)=>{
        const channel=new MessageChannel();
        const timeout=setTimeout(()=>{channel.port1.close();reject(new Error('Activation refusal was not acknowledged'));},5000);
        channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data);};
        worker.postMessage({type:'INGA_OFFLINE_ACTIVATE'},[channel.port2]);
      });
    });
    assert.equal(denied.accepted,false,'An incomplete worker must acknowledge refusal to activate');
    assert.equal(await page.evaluate(()=>__INGA_OFFLINE.state.current.version),version+'-test1');
    failAsset=false;
    await page.locator('#offline-retry').click();
    await waitMode(page,'update');
    assert.equal(await page.evaluate(()=>window.visitMarker),marker);
    assert.equal(await page.evaluate(()=>__INGA_OFFLINE.state.current.version),version+'-test1');
    assert.equal(await page.locator('#offline-update').isVisible(),true);
    console.log('PASS failed update preserves current offline version; complete update waits for user action');

    const other=await context.newPage();
    await other.goto(url+'__offline-test__');
    await waitMode(other,'update');
    await other.evaluate(()=>window.visitMarker='other-ongoing-visit');
    // The user returns to the first tab to install; a protocol click alone need not activate it.
    await page.bringToFront();
    await page.locator('#offline-update').click();
    await waitMode(page,'ready');
    await page.waitForFunction(expected=>window.__INGA_OFFLINE?.state.current?.version===expected,version+'-test2',{polling:100});
    assert.equal(await page.evaluate(()=>window.visitMarker),undefined);
    await other.waitForFunction(expected=>window.__INGA_OFFLINE?.state.current?.version===expected,version+'-test2',{polling:100});
    assert.equal(await other.evaluate(()=>window.visitMarker),'other-ongoing-visit');
    const cacheState=await page.evaluate(async()=>{
      const keys=await caches.keys(),prefix='inga:'+location.origin+'/release/:';
      return {unrelated:keys.includes('unrelated-project-cache'),otherScope:keys.includes('inga:'+location.origin+'/different/:old-version'),own:keys.filter(key=>key.startsWith(prefix))};
    });
    assert.equal(cacheState.unrelated,true);
    assert.equal(cacheState.otherScope,true);
    assert.deepEqual(cacheState.own,['inga:'+url+':'+version+'-test2']);
    await other.close();
    console.log('PASS explicit update reloads only requesting page and cleans only this deployment cache');

    await context.setOffline(true);
    await page.goto(url+'index.html');
    await page.waitForFunction(()=>window.__INGA&&document.querySelector('#loading.gone'),null,{timeout:120000});
    await waitMode(page,'ready');
    assert.equal(await page.evaluate(()=>__INGA.runValidation().every(result=>result.ok)),true);
    assert.deepEqual(errors,[]);
    console.log('PASS full release boots offline under a subpath; all simulation checks pass');
    // The real scene has rendered; the remaining assertions concern only DOM navigation.
    await page.evaluate(()=>{renderer.render=()=>{};});
    await page.locator('#skip').click();
    await page.waitForFunction(()=>__INGA.mode==='live');
    await page.locator('#mobile-options').click();
    await page.locator('#offline-status').click();
    assert.equal(await page.locator('#tools-panel').isHidden(),true);
    assert.equal(await page.locator('#offline-panel').isVisible(),true);
    const geometry=await page.locator('#offline-panel .mbox').boundingBox();
    assert.ok(geometry.x>=0&&geometry.y>=0&&geometry.x+geometry.width<=390&&geometry.y+geometry.height<=844,'Offline dialog fits phone viewport');
    await page.locator('#offline-close').click();
    assert.equal(await page.locator('#offline-panel').isHidden(),true);
    assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]')),false);
    await page.locator('#mobile-options').click();
    await page.locator('#offline-status').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#offline-panel').isHidden(),true);
    assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[hidden],[inert]')),false);
    console.log('PASS phone options opens offline dialog, fits screen and restores reachable focus on close/Escape');
    await context.close();

    // Released versions before the update UI cannot approve a waiting worker.
    // Their migration must finish atomically without reloading their ongoing visit.
    legacyWorker=true;
    const legacyContext=await browser.newContext();
    const legacy=await legacyContext.newPage();
    await legacy.goto(url+'__legacy__');
    await legacy.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});
    await legacy.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{polling:100});
    await legacy.evaluate(()=>{window.visitMarker='legacy-visit';window.controllerChanges=0;navigator.serviceWorker.addEventListener('controllerchange',()=>controllerChanges++);});
    legacyWorker=false;revision=3;failAsset=true;
    await legacy.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await legacy.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;},null,{timeout:60000,polling:100});
    assert.equal(await legacy.evaluate(()=>controllerChanges),0);
    failAsset=false;
    await legacy.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await legacy.waitForFunction(()=>controllerChanges===1,null,{timeout:60000,polling:100});
    assert.equal(await legacy.evaluate(()=>window.visitMarker),'legacy-visit');
    await legacy.goto(url+'__offline-test__');
    await waitMode(legacy,'ready');
    assert.equal(await legacy.evaluate(()=>__INGA_OFFLINE.state.current.version),version+'-test3');
    await legacyContext.close();
    console.log('PASS legacy migration retries incomplete install and makes new UI available without reloading ongoing visit');
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
