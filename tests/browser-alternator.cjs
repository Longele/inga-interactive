const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const filter = process.env.INGA_ALTERNATOR_CASE;
const results = [], errors = [];
let currentPage;
const state = page => page.evaluate(() => JSON.stringify(__INGA.S));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closeButton = page => page.locator('#alternator-cut').getByRole('button', { name: /fermer/i });
const numeric = text => Number(text.replace(/MW|tr\/min/g, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
async function check(name, fn) {
  if (filter && !name.includes(filter) && name !== 'no browser errors') return;
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) {
    const screenshot = `/tmp/inga-alternator-fail-${results.length + 1}.png`;
    try { await currentPage.screenshot({ path: screenshot, timeout: 10000 }); } catch {}
    results.push({ name, ok: false, detail: error.message, screenshot }); console.error('FAIL', name, error.stack, screenshot);
  }
}
async function ready(page) {
  page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.IngaAlternator && window.__INGA && document.querySelector('#loading.gone'), null, { timeout: 120000 });
  // Keep the real alternator drawing and core clock; only stop the unrelated WebGL redraws.
  await page.evaluate(() => { if (typeof renderer !== 'undefined' && renderer) renderer.render = () => {}; });
  await page.locator('#skip').click();
  await page.waitForFunction(() => __INGA.mode === 'live');
  await page.evaluate(() => document.fonts.ready);
}
async function reset(page) {
  await page.evaluate(() => { IngaAlternator.close(); if (__INGA.mode !== 'live') __INGA.jump(TT); __INGA.resetAll(); });
  await frames(page);
}
async function open(page, id = 'G24', toolbar = false) {
  if (toolbar) {
    await page.waitForFunction(() => { const b = document.querySelector('#alternatorBtn'); return b && !!b.closest('#tools-panel') === matchMedia('(max-width:900px)').matches; });
    if (!await page.locator('#alternatorBtn').isVisible()) await page.locator('#mobile-options').click();
    await page.locator('#alternatorBtn').click();
  } else await page.evaluate(id => IngaAlternator.open(id), id);
  await page.locator('#alternator-cut').waitFor({ state: 'visible' });
  await frames(page);
}
async function snapshot(page, id = 'G24') { return page.evaluate(id => __INGA.getAlternatorUnit(id), id); }
async function readouts(page) {
  const id = await page.locator('#alternator-unit').inputValue();
  const value = await snapshot(page, id);
  assert.ok(Math.abs(numeric(await page.locator('#alternator-power').textContent()) - value.result.P) <= .051);
  assert.ok(Math.abs(numeric(await page.locator('#alternator-rpm').textContent()) - value.rpm) <= .051);
  assert.equal(await page.locator('#alternator-state').getAttribute('data-state'), value.status);
  return value;
}
async function hash(page) {
  return page.locator('#alternator-canvas').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 2166136261, opaque = 0;
    for (let i = 0; i < data.length; i += 16) { h = Math.imul(h ^ data[i], 16777619); h = Math.imul(h ^ data[i + 1], 16777619); h = Math.imul(h ^ data[i + 2], 16777619); if (data[i + 3]) opaque++; }
    return { hash: h >>> 0, opaque };
  });
}
async function pause(page) {
  if (await page.locator('#alternator-motion').getAttribute('aria-pressed') !== 'true') await page.locator('#alternator-motion').click();
  await frames(page);
}
async function closed(page, expected) {
  assert.equal(await page.locator('#alternator-cut').isVisible(), false);
  const frozen = await hash(page);
  await page.waitForTimeout(550);
  assert.deepEqual(await hash(page), frozen, 'closed alternator keeps no drawing activity');
  assert.equal(await state(page), expected, 'closing the illustration must not modify steady model settings');
}
async function reachable(page, locator, width, height, name) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, `${name}: ${JSON.stringify(r)}`);
  assert.equal(await locator.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !el.closest('[inert],[hidden]') && !!hit && (el === hit || el.contains(hit)); }), true, `${name} is covered or inert`);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    const page = currentPage = await context.newPage(); await ready(page);
    await check('opening and choosing a group preserve all model settings', async () => {
      await reset(page); const before = await state(page); await open(page, 'G24', true);
      assert.equal(await state(page), before); assert.equal(await page.locator('#alternator-unit').inputValue(), 'G24');
      await page.locator('#alternator-unit').selectOption('G11');
      assert.equal(await state(page), before);
      const unit = await readouts(page); assert.equal(unit.unit.id, 'G11'); assert.equal(unit.rpmTarget, 136); assert.equal(unit.plantSource.reference, 'S03');
      await page.locator('#alternator-unit').selectOption('G24');
      assert.equal((await snapshot(page)).plantSource.reference, 'S11'); assert.equal(await state(page), before);
    });
    await check('loads 0, 30 and 100 percent change only the chosen load and retain synchronous speed', async () => {
      await reset(page); await open(page);
      const before = JSON.parse(await state(page)); const powers = [];
      for (const load of [0, .3, 1]) {
        if (!load) { await page.locator('#alternator-load').focus(); await page.keyboard.press('Home'); }
        else await page.locator(`[data-alternator-load="${load * 100}"]`).click();
        const value = await readouts(page); powers.push(value.result.P);
        assert.equal(value.unit.load, load); assert.equal(value.rpmTarget, 107.1); assert.ok(Math.abs(value.rpm - 107.1) < .01);
        const expected = JSON.parse(JSON.stringify(before)); expected.units.find(u => u.id === 'G24').load = load;
        assert.deepEqual(JSON.parse(await state(page)), expected);
      }
      assert.equal(powers[0], 0); assert.ok(powers[1] > 0 && powers[2] > powers[1]); return { powers };
    });
    await check('water and network constraints are reflected in the actual group power', async () => {
      await reset(page); await open(page); const normal = await readouts(page);
      await page.evaluate(() => __INGA.setCanalCapacity(1600)); const water = await readouts(page);
      assert.equal(water.status, 'water'); assert.ok(water.result.P < normal.result.P);
      await page.evaluate(() => __INGA.applyPreset('grid', { fly: false })); const grid = await readouts(page);
      assert.equal(grid.status, 'grid'); assert.ok(grid.result.P < normal.result.P); assert.equal(grid.rpmTarget, 107.1);
      assert.equal(grid.result.P, await page.evaluate(() => __INGA.R.units.find(u => u.id === 'G24').P));
      return { normal: normal.result.P, water: water.result.P, grid: grid.result.P };
    });
    await check('snapshots are defensive and invalid or unchanged API calls do not alter the model', async () => {
      await reset(page);
      const checked = await page.evaluate(() => {
        const original = JSON.stringify(__INGA.S), actualPower = __INGA.R.units.find(u => u.id === 'G24').P;
        const copy = __INGA.getAlternatorUnit('G24'); copy.unit.failed = true; copy.result.P = -100; copy.plantSource.rpm = 999;
        const defensive = JSON.stringify(__INGA.S) === original && __INGA.getAlternatorUnit('G24').result.P === actualPower && __INGA.getAlternatorUnit('G24').plantSource.rpm === 107.1;
        let events = 0; const listener = () => events++; window.addEventListener('inga:simulationchange', listener);
        const invalid = [__INGA.setUnitLoad('missing', .3), __INGA.setUnitLoad('G24', NaN), __INGA.setUnitLoad('G24', Infinity), __INGA.setUnitLoad('G24', '0.3'), __INGA.setUnitEnabled('missing', true), __INGA.setUnitEnabled('G24', 1), __INGA.setUnitFault('missing', true), __INGA.setUnitFault('G24', 'yes')];
        __INGA.setUnitLoad('G24', 1); __INGA.setUnitEnabled('G24', true); __INGA.setUnitFault('G24', false);
        window.removeEventListener('inga:simulationchange', listener);
        return { defensive, invalid: invalid.every(value => value === false), unchanged: JSON.stringify(__INGA.S) === original, events, missing: __INGA.getAlternatorUnit('missing') };
      });
      assert.deepEqual(checked, { defensive: true, invalid: true, unchanged: true, events: 0, missing: null });
      assert.deepEqual(await page.evaluate(() => [__INGA.setUnitLoad('G24', -2), __INGA.setUnitLoad('G24', 2)]), [0, 1]);
    });
    await check('stop, startup, fault and repair retain the existing group behavior', async () => {
      await reset(page); await open(page); await page.locator('[data-alternator-load="30"]').click();
      const beforeOff = await snapshot(page);
      await page.locator('#alternator-on').uncheck(); const off = await snapshot(page);
      assert.equal(off.result.P, 0); assert.equal(off.status, 'off'); assert.equal(off.rpmTarget, 0);
      // Software rendering may schedule core frames slowly; observe real coasting without advancing its clock.
      await page.waitForFunction(rpm => __INGA.getAlternatorUnit('G24').rpm < rpm, beforeOff.rpm, { timeout: 10000 });
      const began = Date.now(); await page.locator('#alternator-on').check(); const starting = await snapshot(page);
      assert.ok(starting.unit.starting > 0); assert.equal(starting.result.P, 0); assert.equal(starting.status, 'start');
      await page.waitForFunction(() => __INGA.getAlternatorUnit('G24').unit.starting === 0, null, { timeout: 20000 });
      assert.ok(Date.now() - began >= 2200, 'the illustration must not double-advance the 2.5-second startup');
      assert.ok((await snapshot(page)).result.P > 0);
      await page.locator('#alternator-fault').click(); const failed = await snapshot(page);
      assert.equal(failed.unit.failed, true); assert.equal(failed.unit.on, true); assert.equal(failed.unit.load, .3); assert.equal(failed.result.P, 0);
      assert.equal(await page.locator('#alternator-on').isDisabled(), true); assert.equal(await page.locator('#alternator-load').isDisabled(), true);
      assert.equal(await page.evaluate(() => __INGA.setUnitEnabled('G24', false)), false);
      await page.locator('#alternator-fault').click(); const repaired = await snapshot(page);
      assert.equal(repaired.unit.failed, false); assert.equal(repaired.unit.on, true); assert.equal(repaired.unit.load, .3); assert.equal(repaired.unit.starting, 0);
      await page.locator('#alternator-on').uncheck(); await page.locator('#alternator-fault').click(); await page.locator('#alternator-fault').click();
      assert.equal((await snapshot(page)).unit.on, false, 'repair does not switch on a previously stopped unit');
    });
    await check('zero power retains normalized voltage, and visual field and phase toggles preserve the model', async () => {
      await reset(page); await open(page); await pause(page); await page.locator('[data-alternator-stage="induction"]').click();
      const drawing = await hash(page); await page.locator('#alternator-load').focus(); await page.keyboard.press('Home'); await frames(page);
      assert.equal((await snapshot(page)).result.P, 0); assert.equal((await snapshot(page)).rpmTarget, 107.1);
      assert.deepEqual(await hash(page), drawing, 'zero load must not flatten the normalized voltage curves');
      assert.match(await page.locator('#alternator-insight').textContent(), /tension.*sans puissance/i);
      const before = await state(page);
      await page.locator('#alternator-field').uncheck(); const hiddenField = await hash(page); assert.notEqual(hiddenField.hash, drawing.hash);
      await page.locator('#alternator-phases').uncheck(); assert.notEqual((await hash(page)).hash, hiddenField.hash); assert.equal(await state(page), before);
      const rendered = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 900; c.height = 620;
        const draw = producing => { IngaAlternatorDrawing.draw(c, { angle: .73, energized: true, producing, field: true, phases: true, focus: 'induction' }); return c.toDataURL(); };
        return draw(true) === draw(false);
      });
      assert.equal(rendered, true, 'renderer preserves voltage at equal angle and excitation regardless of production');
      await page.locator('#alternator-field').check(); await page.locator('#alternator-phases').check();
    });
    await check('the canvas animates, pauses and advances a quarter turn without modifying the simulation', async () => {
      await reset(page); await open(page); const model = await state(page), first = await hash(page);
      assert.ok(first.opaque > 500); await page.waitForTimeout(300); assert.notEqual((await hash(page)).hash, first.hash);
      await pause(page); const paused = await hash(page); await page.waitForTimeout(300); assert.deepEqual(await hash(page), paused);
      await page.locator('#alternator-step').click(); assert.notEqual((await hash(page)).hash, paused.hash);
      assert.equal(await page.locator('#alternator-motion').getAttribute('aria-pressed'), 'true'); assert.equal(await state(page), model);
    });
    await check('keyboard focus stays in the dialog and Escape restores its trigger', async () => {
      await reset(page); await open(page, 'G24', true);
      for (const key of [...Array(22).fill('Tab'), ...Array(22).fill('Shift+Tab')]) { await page.keyboard.press(key); assert.equal(await page.evaluate(() => !!document.activeElement.closest('#alternator-cut')), true); }
      await page.keyboard.press('Escape'); await closed(page, await state(page));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'alternatorBtn');
    });
    await check('close, reset, tour, paper and another cutaway stop the drawing cleanly', async () => {
      for (const action of ['close', 'reset', 'tour', 'paper', 'canal']) {
        await reset(page); await open(page);
        if (action === 'close') await closeButton(page).click();
        if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
        if (action === 'tour') await page.evaluate(() => { NARR.on = false; __INGA.tour(0); });
        if (action === 'paper') await page.evaluate(() => toPaper());
        if (action === 'canal') await page.evaluate(() => IngaCanal.open());
        await closed(page, await state(page));
        if (action === 'tour') await page.locator('#tQuit').click();
        if (action === 'paper') await page.evaluate(() => __INGA.jump(TT));
        if (action === 'canal') { assert.equal(await page.locator('#canal-cut').isVisible(), true); await page.evaluate(() => IngaCanal.close()); }
      }
    });
    await check('Francis and alternator links keep the selected group and model state', async () => {
      await reset(page); const before = await state(page);
      await page.evaluate(() => { __INGA.selectUnit('G11', false); openCut(); });
      await page.locator('#c-alternator').click();
      assert.equal(await page.locator('#cut').isVisible(), false); assert.equal(await page.locator('#alternator-unit').inputValue(), 'G11');
      await page.locator('#alternator-francis').click();
      assert.equal(await page.locator('#alternator-cut').isVisible(), false); assert.equal(await page.locator('#cut').isVisible(), true);
      assert.equal(await page.evaluate(() => __INGA.getAlternatorUnit().unit.id), 'G11');
      await page.locator('#c-alternator').click(); assert.equal(await state(page), before); await closeButton(page).click();
    });
    await check('learning hub and group-fault scene open the alternator and cancel automatic scenario changes', async () => {
      await reset(page); await page.locator('#learningBtn').click(); const before = await state(page);
      await page.locator('[data-learning="alternator-cut"]').click(); assert.equal(await page.locator('#alternator-cut').isVisible(), true); assert.equal(await state(page), before);
      await closeButton(page).click(); await page.locator('#learningBtn').click(); await page.locator('[data-learning-challenge="one"]').click();
      await page.locator('[data-learning="skip-prediction"]').click(); await page.locator('[data-learning-scene="alternator-cut"]').click();
      assert.equal(await page.locator('#learning-scene').isVisible(), false); assert.equal(await page.locator('#alternator-unit').inputValue(), 'G24');
      const preserved = await state(page); await page.waitForTimeout(5500); assert.equal(await state(page), preserved);
      await closeButton(page).click(); await page.locator('#learningBtn').click(); await page.locator('[data-learning-challenge="sed"]').click();
      await page.locator('[data-learning="skip-prediction"]').click(); assert.equal(await page.locator('[data-learning-scene="alternator-cut"]').isVisible(), false);
      await page.locator('[data-learning-scene="close"]').click();
    });
    for (const [width, height] of [[320, 568], [390, 844], [740, 800], [844, 390], [1440, 900]]) {
      await check(`layout ${width}×${height} keeps the drawing, measurements and controls usable`, async () => {
        await reset(page); await page.setViewportSize({ width, height }); await open(page, 'G24', true);
        const box = await page.locator('#alternator-cut [role="dialog"]').boundingBox(), canvas = await page.locator('#alternator-canvas').boundingBox();
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, JSON.stringify(box));
        assert.ok(canvas.width >= 240 && canvas.height >= 180, JSON.stringify(canvas));
        if (width === 740) assert.ok(canvas.height <= height * .45, 'tablet drawing leaves space for the controls');
        assert.equal(await page.locator('.alternator-console').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        await reachable(page, closeButton(page), width, height, 'close');
        for (const selector of ['#alternator-unit', '[data-alternator-stage="induction"]', '#alternator-field', '#alternator-phases', '#alternator-step', '#alternator-on', '#alternator-load', '[data-alternator-load="30"]', '#alternator-fault', '#alternator-motion', '#alternator-francis']) await reachable(page, page.locator(selector), width, height, selector);
        await page.locator('#alternator-load').scrollIntoViewIfNeeded();
        for (const selector of ['#alternator-rpm', '#alternator-power']) await reachable(page, page.locator(selector), width, height, `sticky ${selector}`);
        await page.locator('.alternator-console').evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: `/tmp/inga-alternator-test-${width}.png` }); await closeButton(page).click();
        return { canvas: [Math.round(canvas.width), Math.round(canvas.height)] };
      });
    }
    await check('reduced motion is static while quarter turns and load controls stay usable', async () => {
      const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const rp = currentPage = await reduced.newPage();
      try {
        await ready(rp); await open(rp); const initial = await hash(rp), before = await state(rp);
        assert.equal(await rp.locator('#alternator-motion').getAttribute('aria-pressed'), 'true'); await rp.waitForTimeout(350); assert.deepEqual(await hash(rp), initial);
        await rp.locator('#alternator-step').click(); assert.notEqual((await hash(rp)).hash, initial.hash); assert.equal(await state(rp), before);
        await rp.locator('[data-alternator-load="30"]').click(); assert.equal((await snapshot(rp)).unit.load, .3); assert.equal((await snapshot(rp)).rpmTarget, 107.1);
        const changed = await hash(rp); await rp.waitForTimeout(300); assert.deepEqual(await hash(rp), changed); await readouts(rp);
      } finally { await reduced.close(); currentPage = page; }
    });
    await check('no browser errors', async () => assert.deepEqual(errors, []));
    if (filter) assert.ok(results.some(item => item.name !== 'no browser errors'), `No checks matched ${filter}`);
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2)); if (results.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
