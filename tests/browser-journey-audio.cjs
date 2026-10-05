const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const keys = ['river', 'canal', 'turbine', 'alternator', 'transformer', 'city'];
const expected = [18.599, 17.319, 16.927, 23.249, 19.958, 22.047];
const errors = [], results = [];
let page;
const read = () => page.evaluate(() => {
  const a = document.querySelector('#journey-audio-media');
  return { state: document.querySelector('#journey-narration')?.dataset.state, time: a?.currentTime, paused: a?.paused, src: a?.getAttribute('src'), duration: a?.duration };
});
async function ready(p) {
  p.setDefaultTimeout(30000); p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + '/index.html');
  await p.waitForFunction(() => window.IngaJourneyAudio && document.querySelector('#loading.gone'), null, { timeout: 120000 });
  await p.evaluate(() => { renderer.render = () => {}; });
  await p.locator('#skip').click(); await p.waitForFunction(() => __INGA.mode === 'live');
}
async function open(key) {
  await page.evaluate(key => IngaJourney.go(key, { open: true }), key);
  await page.locator('#journey-narration').waitFor({ state: 'visible' });
  assert.equal((await read()).state, 'idle');
}
async function play() {
  await page.locator('#journey-audio-play').click();
  await page.waitForFunction(() => { const a = document.querySelector('#journey-audio-media'); return a && !a.paused && a.currentTime > .12; });
}
async function check(name, run) {
  try { await run(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (error) {
    results.push({ name, ok: false, error: error.message }); console.error('FAIL', name, error.stack);
    await page.screenshot({ path: '/tmp/inga-journey-audio-failure-' + results.length + '.png' }).catch(() => {});
  }
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    page = await context.newPage(); await ready(page);
    const initial = await page.evaluate(() => JSON.stringify(__INGA.S));
    await check('six real clips play only on request and match their chapters and durations', async () => {
      for (const [index, key] of keys.entries()) {
        await open(key);
        assert.equal(await page.locator('#journey-audio-media').count(), 0);
        assert.ok((await page.locator('#journey-transcript p').textContent()).length > 180);
        await play(); const audio = await read();
        assert.equal(audio.src, `voix/journey-${key}.mp3`);
        assert.ok(Math.abs(audio.duration - expected[index]) < .15);
        assert.equal(await page.evaluate(() => JSON.stringify(__INGA.S)), initial);
      }
    });
    await check('pause resumes in place; Stop resets; ending offers replay without advancing the chapter', async () => {
      await open('river'); await play();
      await page.locator('#journey-audio-play').click(); const paused = await read();
      await page.waitForTimeout(300); assert.equal((await read()).time, paused.time); assert.equal(paused.paused, true);
      await play(); assert.ok((await read()).time >= paused.time);
      await page.locator('#journey-audio-stop').click(); assert.equal((await read()).state, 'idle');
      assert.equal(await page.locator('#journey-audio-media').count(), 0);
      await play(); await page.evaluate(() => { const a = document.querySelector('#journey-audio-media'); a.currentTime = a.duration - .15; });
      await page.waitForFunction(() => document.querySelector('#journey-narration').dataset.state === 'ended');
      assert.equal(await page.evaluate(() => IngaJourney.state.current), 'river');
      assert.equal(await page.locator('#journey-audio-play').textContent(), 'Réécouter');
      await play(); assert.ok((await read()).time < 3);
    });
    await check('close, map, next, reset and another dialog cancel the old audio and late callbacks', async () => {
      for (const action of ['escape', 'map', 'next', 'reset', 'learning']) {
        await page.evaluate(() => { IngaProduct.dismiss(); IngaJourney.stop(); });
        await open('river'); await play(); await page.evaluate(() => { window.oldJourneyAudio = document.querySelector('#journey-audio-media'); });
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'map') await page.locator('.journey-modal-footer:visible [data-journey-map]').click();
        if (action === 'next') await page.locator('.journey-modal-footer:visible [data-journey-next]').click();
        if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
        if (action === 'learning') await page.evaluate(() => IngaProduct.open());
        await page.evaluate(() => { oldJourneyAudio.dispatchEvent(new Event('playing')); oldJourneyAudio.dispatchEvent(new Event('error')); });
        assert.equal(await page.evaluate(() => oldJourneyAudio.paused && !oldJourneyAudio.getAttribute('src')), true);
        assert.equal(await page.locator('#journey-audio-media').count(), 0);
      }
      await page.evaluate(() => IngaProduct.dismiss());
    });
    await check('a pending request cannot resume after navigation', async () => {
      let release, received;
      const gate = new Promise(resolve => release = resolve), requested = new Promise(resolve => received = resolve);
      const handler = async route => { received(); await gate; await route.continue().catch(() => {}); };
      await page.route('**/voix/journey-canal.mp3', handler);
      try {
        await open('canal'); await page.locator('#journey-audio-play').click(); await requested;
        await page.locator('.journey-modal-footer:visible [data-journey-next]').click(); release();
        await page.waitForTimeout(350); assert.equal((await read()).state, 'idle');
        assert.equal(await page.locator('#journey-audio-media').count(), 0);
      } finally { release(); await page.unroute('**/voix/journey-canal.mp3', handler); }
    });
    await check('failed requests show readable fallback and retry works with the real audio', async () => {
      const handler = route => route.fulfill({ status: 404, body: 'missing audio' });
      await page.route('**/voix/journey-transformer.mp3', handler);
      await open('transformer'); await page.locator('#journey-audio-play').click();
      await page.waitForFunction(() => document.querySelector('#journey-narration').dataset.state === 'error');
      assert.match(await page.locator('#journey-audio-status').textContent(), /lisez l’explication/);
      await page.locator('#journey-transcript summary').click(); assert.equal(await page.locator('#journey-transcript p').isVisible(), true);
      await page.unroute('**/voix/journey-transformer.mp3', handler); await play();
    });
    await check('a hanging play promise expires and a late resolution after Stop stays silent', async () => {
      await open('city');
      await page.evaluate(() => {
        window.originalJourneyPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () { window.hangingJourneyAudio = this; return new Promise(resolve => window.resolveJourneyPlay = resolve); };
      });
      try {
        await page.locator('#journey-audio-play').click();
        await page.waitForFunction(() => document.querySelector('#journey-narration').dataset.state === 'error', null, { timeout: 16000 });
        await page.locator('#journey-audio-play').click(); await page.locator('#journey-audio-stop').click();
        await page.evaluate(() => { resolveJourneyPlay(); hangingJourneyAudio.dispatchEvent(new Event('playing')); });
        assert.equal((await read()).state, 'idle'); assert.equal(await page.evaluate(() => hangingJourneyAudio.paused), true);
      } finally { await page.evaluate(() => { HTMLMediaElement.prototype.play = originalJourneyPlay; }); }
      await play();
    });
    await check('backgrounding pauses the narration and foregrounding does not start it automatically', async () => {
      await open('river'); await play();
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal((await read()).state, 'paused'); assert.equal((await read()).paused, true);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal((await read()).paused, true); await play();
    });
    await check('standalone cutaways offer narration while the existing guided tour keeps its own voice', async () => {
      await page.evaluate(() => { IngaJourney.stop(); IngaCanal.open(); });
      await page.locator('#journey-audio-play').waitFor({ state: 'visible' }); await play();
      await page.evaluate(() => { window.oldJourneyAudio = document.querySelector('#journey-audio-media'); NARR.on = false; __INGA.tour(5); });
      assert.equal(await page.locator('#journey-narration').count(), 0);
      assert.equal(await page.evaluate(() => oldJourneyAudio.paused), true);
      await page.evaluate(() => endTour());
    });
    await check('audio buttons and explanations stay reachable on five screen formats', async () => {
      for (const [width, height] of [[320,568],[390,844],[740,800],[844,390],[1440,900]]) {
        await page.setViewportSize({ width, height });
        for (const key of keys) {
          await open(key);
          for (const selector of ['#journey-audio-play','#journey-transcript summary']) {
            const button = page.locator(selector); await button.scrollIntoViewIfNeeded();
            assert.equal(await button.evaluate(el => { const r = el.getBoundingClientRect(), at = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&!el.closest('[inert]')&&(el===at||el.contains(at)); }), true, `${key} ${selector} ${width}×${height}`);
          }
          await page.locator('#journey-transcript summary').click();
          await page.locator('#journey-transcript p').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('#journey-transcript').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
          await play(); await page.locator('#journey-audio-stop').click();
          if (width === 320 && key === 'city') await page.screenshot({ path: '/tmp/inga-narration-city-320.png' });
        }
      }
    });
    await context.close();
    await check('the six narrations play offline and cached MP3 byte ranges are served correctly', async () => {
      const offline = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      try {
        page = await offline.newPage(); await ready(page);
        await page.waitForFunction(() => window.__INGA_OFFLINE?.state.mode === 'ready' && !!navigator.serviceWorker.controller, null, { timeout: 60000, polling: 100 });
        await offline.setOffline(true);
        for (const key of keys) { await open(key); await play(); }
        const ranges = await page.evaluate(async () => {
          const url = 'voix/journey-river.mp3', whole = new Uint8Array(await (await fetch(url)).arrayBuffer());
          async function range(value) { const r = await fetch(url, { headers: { Range: value } }); return { status: r.status, bytes: [...new Uint8Array(await r.arrayBuffer())], header: r.headers.get('Content-Range') }; }
          return { size: whole.length, first: [...whole.slice(0,16)], last: [...whole.slice(-8)], partial: await range('bytes=0-15'), suffix: await range('bytes=-8'), invalid: await range('bytes=9999999-') };
        });
        assert.equal(ranges.partial.status, 206); assert.deepEqual(ranges.partial.bytes, ranges.first);
        assert.equal(ranges.partial.header, `bytes 0-15/${ranges.size}`);
        assert.equal(ranges.suffix.status, 206); assert.deepEqual(ranges.suffix.bytes, ranges.last);
        assert.equal(ranges.invalid.status, 416); assert.equal(ranges.invalid.header, `bytes */${ranges.size}`);
      } finally { await offline.close(); }
    });
    assert.deepEqual(errors, []); console.log('PASS no browser errors');
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
