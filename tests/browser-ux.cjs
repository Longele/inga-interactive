const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const report = [];
const errors = [];
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const mw = s => Number(s.replace(/[\s\u00a0\u202f]/g, '').replace(/MW$/, '').replace(',', '.'));
async function check(name, fn) {
  try { const detail = await fn(); report.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) { report.push({ name, ok: false, detail: error.message }); console.error('FAIL', name, error.message); }
}
async function bounds(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, viewport:[innerWidth,innerHeight], scroll:el.scrollWidth, client:el.clientWidth };
  });
}
function assertInViewport(rect) {
  assert.ok(rect.left >= -1 && rect.right <= rect.viewport[0]+1, JSON.stringify(rect));
  assert.ok(rect.top >= -1 && rect.bottom <= rect.viewport[1]+1, JSON.stringify(rect));
}
async function showControlTab(page, id) {
  const show = page.locator('#tgCtrl');
  if (await show.getAttribute('aria-pressed') !== 'true') await show.click();
  await page.locator(`[data-tab="${id}"]`).click();
}
(async () => {
  const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium', headless:true,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__INGA && document.querySelector('#loading').classList.contains('gone') && !document.querySelector('#intro').classList.contains('gone'), null, {timeout:60000});
    await check('index: all built-in simulation checks', async () => {
      const results = await page.evaluate(() => __INGA.runValidation());
      assert.ok(results.length >= 23); assert.deepEqual(results.filter(r=>!r.ok), []); return { passed:results.length };
    });
    await check('initial keyboard focus reaches a visible entry action', async () => {
      // An intentional autofocus is also acceptable: do not skip past it with Tab.
      if (!await page.evaluate(() => !!document.activeElement.closest('#intro'))) await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el=document.activeElement; let opacity=1, a=el;
        while(a&&a.nodeType===1){opacity*=Number(getComputedStyle(a).opacity);a=a.parentElement;}
        return {id:el.id,insideIntro:!!el.closest('#intro'),opacity,inert:!!el.closest('[inert]')};
      });
      assert.equal(focus.insideIntro,true); assert.equal(focus.inert,false); assert.ok(focus.opacity>0.9); return focus;
    });
    for(const [width,height] of [[320,568],[390,844]]) {
      await check(`introduction fits ${width}px viewport`, async () => {
        await page.setViewportSize({width,height}); await frame(page);
        const rect=await bounds(page,'#intro'); assertInViewport(rect); return rect;
      });
    }
    await page.setViewportSize({width:1440,height:900}); await frame(page);
    await page.locator('#skip').click();
    await page.waitForFunction(() => __INGA.mode==='live');
    await check('main tabs support arrow keys and linked selected panel', async () => {
      await showControlTab(page,'cond'); await page.keyboard.press('ArrowRight');
      const result = await page.evaluate(() => { const active=document.activeElement, selected=document.querySelector('.tabs [aria-selected="true"]'); return {
        focused:active.dataset.tab, selected:selected.dataset.tab, controls:selected.getAttribute('aria-controls'),
        zeroStops:[...document.querySelectorAll('.tabs [role="tab"]')].filter(el=>el.tabIndex===0).length,
        panelVisible:!document.querySelector('#p-units').hidden && document.querySelector('#p-units').classList.contains('on')
      }; });
      assert.equal(result.focused,'units'); assert.equal(result.selected,'units'); assert.equal(result.controls,'p-units'); assert.equal(result.zeroStops,1); assert.equal(result.panelVisible,true); return result;
    });
    await check('registry traps focus, isolates shortcuts, and restores its trigger', async () => {
      await page.locator('#openReg').click();
      assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#reg')), true);
      const viewBefore = await page.locator('[data-view][aria-pressed="true"]').getAttribute('data-view');
      await page.keyboard.press(viewBefore==='grid'?'1':'3');
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').getAttribute('data-view'),viewBefore);
      // Paramètres has few controls: crossing both ends proves wrapping.
      for(const key of [...Array(12).fill('Tab'),...Array(12).fill('Shift+Tab')]) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#reg')),true,`focus escaped after ${key}`);
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#reg').getAttribute('hidden'),'');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'openReg');
    });
    await check('scenario multi → one explains the actual increase', async () => {
      await showControlTab(page,'pre');
      await page.locator('[data-p="multi"]').click();
      const before=await page.evaluate(()=>__INGA.R.Pgen);
      await page.locator('[data-p="one"]').click();
      const after=await page.evaluate(()=>__INGA.R.Pgen);
      assert.ok(after>before);
      assert.match(await page.locator('#exp-change').textContent(),/en hausse/i);
      assert.doesNotMatch(await page.locator('#exp-p').textContent(),/production totale baisse peu/i);
      const headers=await page.locator('#exp-ba .h').allTextContents();
      assert.ok(headers.includes('État précédent')); assert.ok(headers.includes('État actuel'));
      assert.equal(mw(await page.locator('#exp-ba .before').first().textContent()),Math.round(before));
      assert.equal(mw(await page.locator('#exp-ba .after').first().textContent()),Math.round(after));
      const feedback=await page.locator('#result-feedback').evaluate(el=>{const r=el.getBoundingClientRect();let a=el,opacity=1;while(a&&a.nodeType===1){opacity*=Number(getComputedStyle(a).opacity);a=a.parentElement;}return {hidden:el.hidden,opacity,width:r.width,height:r.height,text:el.textContent};});
      assert.equal(feedback.hidden,false); assert.ok(feedback.opacity>0.9); assert.ok(feedback.width>0&&feedback.height>0);
      assert.ok((await page.locator('#result-summary').textContent()).trim().length>0);
      assert.ok((await page.locator('#result-cause').textContent()).trim().length>0);
      return {before:Math.round(before),after:Math.round(after)};
    });
    await check('manual change clears preset and refreshes comparison', async () => {
      await showControlTab(page,'cond');
      const before=await page.evaluate(()=>__INGA.R.Pgen);
      // Keyboard Home/End exercises the real range input and its event handler.
      await page.locator('#r-gate').focus(); await page.keyboard.press('Home');
      await page.waitForFunction(()=>__INGA.S.gate===0);
      assert.equal(await page.locator('.pre[aria-pressed="true"]').count(),0);
      assert.match(await page.locator('#exp-t').textContent(),/^Configuration personnalisée/);
      const after=await page.evaluate(()=>__INGA.R.Pgen);
      assert.equal(after,0);
      assert.equal(mw(await page.locator('#exp-ba .before').first().textContent()),Math.round(before));
      assert.equal(mw(await page.locator('#exp-ba .after').first().textContent()),0);
      return {before:Math.round(before),after};
    });
    await check('Basses eaux gives matching river, supply, and output in both controls', async () => {
      await showControlTab(page,'pre'); await page.locator('[data-p="normal"]').click(); await page.locator('[data-p="low"]').click();
      const preset=await page.evaluate(()=>({river:__INGA.S.river,supply:__INGA.S.supply,Pgen:__INGA.R.Pgen}));
      await page.locator('[data-p="normal"]').click(); await showControlTab(page,'cond'); await page.locator('#seg-river [data-v="low"]').click();
      const condition=await page.evaluate(()=>({river:__INGA.S.river,supply:__INGA.S.supply,Pgen:__INGA.R.Pgen}));
      assert.deepEqual(condition,preset); return condition;
    });
    await check('tablet toolbar leaves the title and command panel clear', async () => {
      await page.setViewportSize({width:1024,height:768}); await frame(page);
      const rect=await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('.tb h1'));const h=range.getBoundingClientRect(),t=document.querySelector('.tools').getBoundingClientRect(),c=document.querySelector('#ctrl').getBoundingClientRect();return {titleRight:h.right,toolsLeft:t.left,toolsBottom:t.bottom,controlsTop:c.top};});
      assert.ok(rect.toolsLeft>=rect.titleRight&&rect.toolsBottom<=rect.controlsTop,JSON.stringify(rect));return rect;
    });
    await page.setViewportSize({width:1440,height:900}); await frame(page);
    await page.screenshot({path:'/tmp/inga-ux-desktop-fixed.png'});
    for(const [width,height] of [[320,568],[390,844]]) {
      await check(`guided tour fits ${width}px viewport`, async () => {
        await page.setViewportSize({width,height}); await frame(page);
        await page.locator('[data-mob="none"]').click();
        await page.locator('#tourBtn').click();
        await page.waitForSelector('#tour:not([hidden])');
        if(await page.locator('#tSnd').getAttribute('aria-pressed')==='true') await page.locator('#tSnd').click();
        if((await page.locator('#tPlay').textContent()).trim()==='Pause') await page.locator('#tPlay').click();
        await frame(page); const rect=await bounds(page,'#tour'); assertInViewport(rect);
        for(const id of ['tPrev','tPlay','tSnd','tNext','tQuit']) assertInViewport(await bounds(page,'#'+id));
        if(width===390) await page.screenshot({path:'/tmp/inga-ux-mobile-fixed.png'});
        await page.locator('#tQuit').click(); return rect;
      });
      if(await page.locator('#tour').getAttribute('hidden')===null) await page.locator('#tQuit').click();
    }
    await check('index: no JavaScript page errors', async()=>{assert.deepEqual(errors,[]);});
    await page.close();
    const museum=await context.newPage(); museum.setDefaultTimeout(60000);
    const museumErrors=[]; museum.on('pageerror',e=>museumErrors.push(e.message));
    await museum.goto(base+'/musee.html',{waitUntil:'domcontentloaded'});
    await museum.waitForFunction(()=>window.__INGA && document.querySelector('#loading').classList.contains('gone'),null,{timeout:60000});
    await check('museum: all built-in simulation checks and museum flag',async()=>{
      const state=await museum.evaluate(()=>({results:__INGA.runValidation(),museum:document.documentElement.classList.contains('musee')}));
      assert.equal(state.museum,true);assert.ok(state.results.length>=23);assert.deepEqual(state.results.filter(r=>!r.ok),[]);assert.deepEqual(museumErrors,[]);return {passed:state.results.length};
    });
    await context.close();
  } finally { await browser.close(); }
  console.log(JSON.stringify({passed:report.filter(r=>r.ok).length,total:report.length,results:report},null,2));
  if(report.some(r=>!r.ok)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
