const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const filter = process.env.INGA_JOURNEY_CASE;
const ids = ['river', 'canal', 'turbine', 'alternator', 'transformer', 'city'];
const modals = { river: 'journey-detail', canal: 'canal-cut', turbine: 'cut', alternator: 'alternator-cut', transformer: 'transformer-cut', city: 'journey-detail' };
const results = [], errors = [];
let currentPage;
const state = page => page.evaluate(() => JSON.stringify(__INGA.S));
const journey = page => page.evaluate(() => IngaJourney.state);
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const numeric = text => Number(text.replace(/m³\/s|MW/g, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
async function check(name, fn) {
  if (filter && !name.includes(filter) && name !== 'no browser errors') return;
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) {
    const screenshot = `/tmp/inga-journey-fail-${results.length + 1}.png`;
    try { await currentPage.screenshot({ path: screenshot, timeout: 10000 }); } catch {}
    results.push({ name, ok: false, detail: error.message, screenshot }); console.error('FAIL', name, error.stack, screenshot);
  }
}
async function ready(page) {
  page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.IngaJourney && window.IngaJourneyEndpoints && window.__INGA && document.querySelector('#loading.gone'), null, { timeout: 120000 });
  // The actual cutaway canvases/SVGs and camera clock remain active.
  await page.evaluate(() => { if (typeof renderer !== 'undefined' && renderer) renderer.render = () => {}; });
  await page.locator('#skip').click(); await page.waitForFunction(() => __INGA.mode === 'live'); await page.evaluate(() => document.fonts.ready);
}
async function reset(page) {
  await page.evaluate(() => { IngaJourney.stop(); if (__INGA.mode !== 'live') __INGA.jump(TT); __INGA.resetAll(); }); await frames(page);
}
async function start(page, id = 'river', entry = false) {
  if (entry) await page.locator('#journey-entry').click();
  else await page.evaluate(id => IngaJourney.start(id), id);
  await page.waitForFunction(id => IngaJourney.state.active && IngaJourney.state.current === id, id);
}
async function opened(page, id) {
  await page.locator('#' + modals[id]).waitFor({ state: 'visible' });
  assert.equal((await journey(page)).current, id);
  assert.equal(await page.locator('.modal:not([hidden])').count(), 1, 'only the current chapter dialog is open');
  if (id === 'river' || id === 'city') assert.equal(await page.locator('#journey-detail-svg').getAttribute('data-kind'), id);
}
async function open(page, id) {
  await page.evaluate(id => IngaJourney.go(id, { open: true }), id); await opened(page, id);
}
async function map(page) {
  const button = page.locator('.journey-modal-footer:visible [data-journey-map]');
  if (await button.count()) await button.click();
  await page.locator('#energy-journey').waitFor({ state: 'visible' });
}
async function stopped(page) {
  assert.equal((await journey(page)).active, false);
  assert.equal(await page.locator('#energy-journey').isVisible(), false);
  assert.equal(await page.locator('#journey-hotspot').isVisible(), false);
  assert.equal(await page.locator('.journey-modal-footer:visible').count(), 0);
}
async function reachable(page, locator, width, height, name) {
  await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox();
  assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, `${name}: ${JSON.stringify(r)}`);
  assert.equal(await locator.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !el.closest('[inert],[hidden]') && !!hit && (el === hit || el.contains(hit)); }), true, `${name} is covered or inert`);
}
async function endpointReadouts(page, id) {
  const expected = await page.evaluate(() => ({ river: __INGA.R.Qr, diverted: __INGA.R.Qdiv, bypass: __INGA.R.bypass, generated: __INGA.R.Pgen, delivered: __INGA.R.Prec, kinshasa: __INGA.R.kin }));
  const keys = id === 'river' ? ['river', 'diverted', 'bypass'] : ['generated', 'delivered', 'kinshasa'];
  for (const key of keys) {
    const selector = key === 'river' ? '#endpoint-river-flow' : '#endpoint-' + key;
    assert.ok(Math.abs(numeric(await page.locator(selector).textContent()) - expected[key]) <= .051, `${selector} matches the live simulation`);
  }
  return expected;
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = currentPage = await context.newPage(); await ready(page);
    await check('the visitor traverses all six chapters and completes without changing the simulation', async () => {
      await reset(page); const before = await state(page); await start(page, 'river', true); await page.locator('#journey-open').click();
      for (const [index, id] of ids.entries()) {
        await opened(page, id); assert.equal(await state(page), before);
        assert.equal(await page.locator('.journey-modal-footer:visible [data-journey-prev]').isDisabled(), index === 0);
        if (id === 'river' || id === 'city') await endpointReadouts(page, id);
        await page.locator('.journey-modal-footer:visible [data-journey-next]').click();
      }
      await stopped(page); assert.equal(await page.locator('.modal:not([hidden])').count(), 0); assert.equal(await state(page), before);
      assert.deepEqual((await journey(page)).visited, ids); assert.match(await page.locator('#journey-entry').textContent(), /6 étapes explorées/);
    });
    await check('chapter buttons and return-to-map preserve the current step and expose a usable scene', async () => {
      await reset(page); const before = await state(page); await start(page);
      for (const id of ['city', 'canal', 'turbine', 'alternator', 'transformer', 'river']) {
        await page.locator(`[data-journey-step="${id}"]`).click(); assert.equal((await journey(page)).current, id);
        assert.equal(await page.locator(`[data-journey-step="${id}"]`).getAttribute('aria-current'), 'step');
        assert.equal(await page.locator('.modal:not([hidden])').count(), 0);
        assert.equal(await page.locator('#gl').evaluate(el => !!el.closest('[inert]')), false);
        await page.locator('#journey-open').click(); await opened(page, id); await map(page);
        assert.equal((await journey(page)).active, true); assert.equal((await journey(page)).current, id); assert.equal(await state(page), before);
        if (id === 'canal') {
          await page.locator('#journey-hotspot').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#journey-hotspot').evaluate(el => !!el.closest('[inert],[hidden]')), false);
          await page.locator('#journey-hotspot').click(); await opened(page, 'canal'); await map(page);
        }
      }
    });
    await check('a real G11 scene pick opens its turbine and the following alternator keeps the same group', async () => {
      await reset(page); const before = await state(page);
      await page.evaluate(() => __INGA.selectUnit('G24', false)); await start(page, 'turbine');
      // Let the guide's initial ResizeObserver framing finish before aiming at another visible group.
      await frames(page);
      await page.evaluate(() => __INGA.focusJourney('turbine', null, 'G11'));
      await page.waitForFunction(() => !tween, null, { timeout: 30000 }); await frames(page);
      const pick = await page.evaluate(() => {
        // WebGL redraws normally refresh these matrices. Keep raycasting faithful when suppressing that redraw.
        scene.updateMatrixWorld(true); camera.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(T3.unitBoxes.G11), corners = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(camera); corners.push({ x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 });
        }
        const rect = { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
        const visible = PICK.filter(object => { for (let p = object; p; p = p.parent) if (p.visible === false && p.material?.visible !== false) return false; return true; });
        const ray = new THREE.Raycaster();
        const samples = [];
        for (let row = 1; row < 16; row++) for (let column = 1; column < 16; column++) {
          const cx = rect.left + (rect.right - rect.left) * column / 16, cy = rect.top + (rect.bottom - rect.top) * row / 16;
          ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2), camera);
          const target = ray.intersectObjects(visible, false)[0]?.object, element = document.elementFromPoint(cx, cy);
          if (samples.length < 12) samples.push({ hit: target?.userData, dom: element?.id || element?.tagName });
          if (target?.userData.unit === 'G11' && element === renderer.domElement) return { point: { x: cx, y: cy } };
        }
        return { point: null, rect, samples };
      });
      assert.ok(pick.point, `G11 has an unobscured, pickable canvas point: ${JSON.stringify(pick)}`);
      await page.mouse.click(pick.point.x, pick.point.y); await opened(page, 'turbine');
      assert.equal((await journey(page)).unitId, 'G11'); assert.equal(await page.evaluate(() => __INGA.selectedUnitId), 'G11');
      await page.locator('.journey-modal-footer:visible [data-journey-next]').click(); await opened(page, 'alternator');
      assert.equal(await page.locator('#alternator-unit').inputValue(), 'G11'); assert.equal(await state(page), before);
    });
    await check('learning and mapped scene shortcuts join the journey while other scene information exits it', async () => {
      await reset(page); const before = await state(page); await page.locator('#learningBtn').click(); await page.locator('[data-learning="journey"]').click();
      assert.equal(await page.locator('#learning').isVisible(), false); assert.equal((await journey(page)).current, 'river'); assert.equal((await journey(page)).active, true);
      for (const [key, id] of [['congo', 'river'], ['canal', 'canal'], ['switchyard', 'transformer'], ['kinshasa', 'city']]) {
        assert.equal(await page.evaluate(key => IngaJourney.fromScene(key, null), key), true); await opened(page, id);
      }
      assert.equal(await page.evaluate(() => IngaJourney.fromScene('hvdc', null)), false); await stopped(page); assert.equal(await state(page), before);
    });
    await check('Escape and a chapter close return to the guide while closing the guide ends the journey', async () => {
      await reset(page); await start(page); await open(page, 'river'); await page.locator('#journey-detail .endpoint-close').click();
      assert.equal((await journey(page)).active, true); assert.equal((await journey(page)).current, 'river'); assert.equal(await page.locator('#energy-journey').isVisible(), true);
      await page.locator('#journey-open').click(); await opened(page, 'river'); await page.keyboard.press('Escape');
      assert.equal((await journey(page)).active, true); assert.equal(await page.locator('#journey-detail').isVisible(), false);
      await page.keyboard.press('Escape'); await stopped(page);
      await start(page); await page.locator('#journey-close').click(); await stopped(page);
    });
    await check('rapid chapter changes and stop never reopen an obsolete detail', async () => {
      await reset(page); const before = await state(page); await start(page);
      await page.evaluate(() => { IngaJourney.go('canal', { open: true }); IngaJourney.go('alternator', { open: true, unitId: 'G11' }); IngaJourney.go('city', { open: true }); });
      await opened(page, 'city'); await page.evaluate(() => IngaJourney.stop()); await frames(page); await page.waitForTimeout(700);
      await stopped(page); assert.equal(await page.locator('.modal:not([hidden])').count(), 0); assert.equal(await state(page), before);
    });
    await check('tour, reset, paper and learning interrupt the journey without a later return', async () => {
      for (const action of ['tour', 'reset', 'paper', 'learning']) {
        await reset(page); await start(page); await open(page, 'canal');
        if (action === 'tour') await page.evaluate(() => { NARR.on = false; __INGA.tour(0); });
        if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
        if (action === 'paper') await page.evaluate(() => toPaper());
        if (action === 'learning') await page.evaluate(() => IngaProduct.open());
        await frames(page); await page.waitForTimeout(600); await stopped(page); assert.equal(await page.locator('#canal-cut').isVisible(), false);
        if (action === 'tour') await page.locator('#tQuit').click();
        if (action === 'paper') { await page.waitForFunction(() => __INGA.mode === 'paper'); await page.locator('#skip').click(); await page.waitForFunction(() => __INGA.mode === 'live'); }
        if (action === 'learning') await page.keyboard.press('Escape');
      }
    });
    await check('river and city readouts follow actual changes in flow, production, losses and delivered power', async () => {
      await reset(page); await start(page); await open(page, 'river'); const river = await endpointReadouts(page, 'river');
      assert.ok(river.river > river.diverted); await page.evaluate(() => __INGA.setCanalCapacity(1600)); const changed = await endpointReadouts(page, 'river'); assert.ok(changed.diverted < river.diverted);
      await open(page, 'city'); await endpointReadouts(page, 'city');
      await page.evaluate(() => __INGA.applyPreset('grid', { fly: false })); await endpointReadouts(page, 'city');
      assert.match(await page.locator('#endpoint-loss-note').textContent(), /5\s*%/);
      await page.evaluate(() => __INGA.S.units.forEach(unit => __INGA.setUnitEnabled(unit.id, false)));
      assert.equal((await endpointReadouts(page, 'city')).delivered, 0);
      assert.equal(await page.locator('#journey-detail').evaluate(el => el.classList.contains('endpoint-city-lit')), false);
      await open(page, 'river'); assert.equal((await endpointReadouts(page, 'river')).diverted, 0);
      assert.equal(await page.locator('#journey-detail').evaluate(el => el.classList.contains('endpoint-no-diversion')), true);
    });
    await check('the transformer experiment leaves the journey city balance and all site settings unchanged', async () => {
      await reset(page); const before = await state(page); await start(page); await open(page, 'city'); const city = await endpointReadouts(page, 'city');
      await page.locator('.journey-modal-footer:visible [data-journey-prev]').click(); await opened(page, 'transformer');
      assert.equal(await page.evaluate(() => IngaTransformer.state.power), 100); await page.locator('[data-transformer-voltage="400"]').click();
      assert.equal(await page.evaluate(() => IngaTransformer.state.loss), .625); assert.equal(await state(page), before);
      await page.locator('.journey-modal-footer:visible [data-journey-next]').click(); await opened(page, 'city'); assert.deepEqual(await endpointReadouts(page, 'city'), city);
    });
    await check('focus stays inside details, the guide remains nonmodal and closing restores the journey entry', async () => {
      await reset(page); await start(page, 'river', true);
      assert.equal(await page.locator('#gl').evaluate(el => !!el.closest('[inert]')), false);
      await page.locator('#journey-open').click(); await opened(page, 'river');
      assert.equal(await page.locator('#gl').evaluate(el => !!el.closest('[inert]')), true);
      for (const key of [...Array(14).fill('Tab'), ...Array(14).fill('Shift+Tab')]) { await page.keyboard.press(key); assert.equal(await page.evaluate(() => !!document.activeElement.closest('#journey-detail')), true); }
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#gl').evaluate(el => !!el.closest('[inert]')), false);
      await page.keyboard.press('Escape'); await stopped(page); assert.equal(await page.evaluate(() => document.activeElement.id), 'journey-entry');
      await page.evaluate(() => IngaTransformer.open()); await page.locator('#journey-entry').waitFor({ state: 'hidden' });
      await page.keyboard.press('Escape'); await page.locator('#journey-entry').waitFor({ state: 'visible' });
      await reachable(page, page.locator('#journey-entry'), 1440, 900, 'entry after closing another modal');
    });
    for (const [width, height] of [[320, 568], [390, 844], [740, 800], [844, 390], [1440, 900]]) {
      await check(`layout ${width}×${height} keeps the guide and six chapter footers reachable`, async () => {
        await reset(page); await page.setViewportSize({ width, height }); await start(page, 'river', true);
        assert.equal(await page.locator('#energy-journey').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        await reachable(page, page.locator('#journey-close'), width, height, 'guide close'); await reachable(page, page.locator('#journey-open'), width, height, 'open chapter');
        for (const id of ids) {
          await reachable(page, page.locator(`[data-journey-step="${id}"]`), width, height, `step ${id}`);
          await page.locator(`[data-journey-step="${id}"]`).click(); await page.locator('#journey-open').click(); await opened(page, id);
          const dialog = page.locator('#' + modals[id] + ' [role="dialog"]'), box = await dialog.boundingBox();
          assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${id}: ${JSON.stringify(box)}`);
          if (id !== 'turbine') {
            const illustration = page.locator(id === 'river' || id === 'city' ? '#journey-detail-svg' : '#' + id + '-canvas');
            const drawing = await illustration.boundingBox(); assert.ok(drawing.width >= 240 && drawing.height >= 180, `${id} illustration: ${JSON.stringify(drawing)}`);
          }
          assert.equal(await page.locator('.journey-modal-footer:visible').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
          for (const action of ['map', 'next']) await reachable(page, page.locator(`.journey-modal-footer:visible [data-journey-${action}]`), width, height, `${id} ${action}`);
          if (id !== 'river') await reachable(page, page.locator('.journey-modal-footer:visible [data-journey-prev]'), width, height, `${id} previous`);
          await map(page);
        }
        await page.screenshot({ path: `/tmp/inga-journey-test-${width}.png` }); await page.locator('#journey-close').click();
      });
    }
    await check('the desktop toolbar and mobile Plus remain accessible alongside the journey entry', async () => {
      await reset(page); await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForFunction(() => !document.querySelector('#transformerBtn').closest('#tools-panel'));
      const clipped = await page.locator('.tools [aria-label="Outils"]').evaluate(group => { const g = group.getBoundingClientRect(); return [...group.querySelectorAll('button')].filter(button => { const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.x < Math.max(0, g.x) - 1 || r.right > Math.min(innerWidth, g.right) + 1 || !hit || !(button === hit || button.contains(hit)); }).map(button => button.id); });
      assert.deepEqual(clipped, []); await reachable(page, page.locator('#journey-entry'), 1024, 768, 'journey entry');
      await page.setViewportSize({ width: 320, height: 568 }); await page.waitForFunction(() => !!document.querySelector('#transformerBtn').closest('#tools-panel'));
      await reachable(page, page.locator('#mobile-options'), 320, 568, 'mobile Plus'); await page.locator('#mobile-options').click();
      for (const id of ['learningBtn', 'canalBtn', 'alternatorBtn', 'transformerBtn']) await reachable(page, page.locator('#' + id), 320, 568, id);
      await page.keyboard.press('Escape'); await reachable(page, page.locator('#journey-entry'), 320, 568, 'mobile journey entry');
    });
    await check('reduced motion keeps endpoint artwork still while pause controls and navigation remain usable', async () => {
      await reset(page); await start(page); await open(page, 'river');
      assert.equal(await page.locator('#journey-detail-motion').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('#journey-detail').evaluate(el => el.classList.contains('endpoint-running')), false);
      assert.equal(await page.locator('.endpoint-river-upstream').evaluate(el => getComputedStyle(el).animationName), 'none');
      const before = await state(page); await page.locator('.journey-modal-footer:visible [data-journey-next]').click(); await opened(page, 'canal'); assert.equal(await state(page), before);
    });
    await check('normal motion endpoint animation pauses and stopping during a camera flight never opens a late chapter', async () => {
      const normal = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
      const np = currentPage = await normal.newPage();
      try {
        await ready(np); await start(np); await open(np, 'river');
        assert.equal(await np.locator('#journey-detail-motion').getAttribute('aria-pressed'), 'false'); assert.equal(await np.locator('#journey-detail').evaluate(el => el.classList.contains('endpoint-running')), true);
        const offset = () => np.locator('.endpoint-river-upstream').evaluate(el => getComputedStyle(el).strokeDashoffset);
        const moving = await offset();
        await np.waitForFunction(value => getComputedStyle(document.querySelector('.endpoint-river-upstream')).strokeDashoffset !== value, moving, { timeout: 5000 });
        await np.locator('#journey-detail-motion').click(); assert.equal(await np.locator('#journey-detail').evaluate(el => el.classList.contains('endpoint-running')), false);
        assert.equal(await np.locator('.endpoint-river-upstream').evaluate(el => getComputedStyle(el).animationPlayState), 'paused'); await frames(np);
        const paused = await offset(); await np.waitForTimeout(250); assert.equal(await offset(), paused);
        await map(np); const before = await state(np); await np.locator('[data-journey-step="city"]').click(); await np.locator('#journey-close').click();
        await np.waitForTimeout(2400); await stopped(np); assert.equal(await np.locator('.modal:not([hidden])').count(), 0); assert.equal(await state(np), before);
      } finally { await normal.close(); currentPage = page; }
    });
    await check('no browser errors', async () => assert.deepEqual(errors, []));
    if (filter) assert.ok(results.some(item => item.name !== 'no browser errors'), `No checks matched ${filter}`);
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2)); if (results.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
