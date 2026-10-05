const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const filter = process.env.INGA_TRANSFORMER_CASE;
const results = [], errors = [];
let currentPage;
const state = page => page.evaluate(() => JSON.stringify(__INGA.S));
const local = page => page.evaluate(() => IngaTransformer.state);
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closeButton = page => page.locator('#transformer-cut').getByRole('button', { name: /fermer/i });
const numeric = text => Number(text.replace(/MW|kV/g, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
async function check(name, fn) {
  if (filter && !name.includes(filter) && name !== 'no browser errors') return;
  try { const detail = await fn(); results.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) {
    const screenshot = `/tmp/inga-transformer-fail-${results.length + 1}.png`;
    try { await currentPage.screenshot({ path: screenshot, timeout: 10000 }); } catch {}
    results.push({ name, ok: false, detail: error.message, screenshot }); console.error('FAIL', name, error.stack, screenshot);
  }
}
async function ready(page) {
  page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.IngaTransformer && window.__INGA && document.querySelector('#loading.gone'), null, { timeout: 120000 });
  // Keep the real lesson canvas and core clock; suppress only unrelated background WebGL redraws.
  await page.evaluate(() => { if (typeof renderer !== 'undefined' && renderer) renderer.render = () => {}; });
  await page.locator('#skip').click(); await page.waitForFunction(() => __INGA.mode === 'live');
  await page.evaluate(() => document.fonts.ready);
}
async function reset(page) {
  await page.evaluate(() => { IngaTransformer.close(); if (__INGA.mode !== 'live') __INGA.jump(TT); __INGA.resetAll(); });
  await frames(page);
}
async function open(page, toolbar = false) {
  if (toolbar) {
    // Resizing reparents tool buttons. Resolve their actual destination before choosing the entry.
    await page.waitForFunction(() => { const b = document.querySelector('#transformerBtn'); return b && !!b.closest('#tools-panel') === matchMedia('(max-width:900px)').matches; });
    if (!await page.locator('#transformerBtn').isVisible()) await page.locator('#mobile-options').click();
    await page.locator('#transformerBtn').click();
  } else await page.evaluate(() => IngaTransformer.open());
  await page.locator('#transformer-cut').waitFor({ state: 'visible' }); await frames(page);
}
async function readouts(page) {
  const value = await local(page);
  for (const key of ['current', 'loss', 'received', 'power']) near(numeric(await page.locator('#transformer-' + key).textContent()), value[key], .000501);
  assert.equal(Number(await page.locator('#transformer-voltage').inputValue()), value.voltage);
  return value;
}
async function hash(page) {
  return page.locator('#transformer-canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 2166136261, opaque = 0;
    for (let i = 0; i < pixels.length; i += 16) { h = Math.imul(h ^ pixels[i], 16777619); h = Math.imul(h ^ pixels[i + 1], 16777619); h = Math.imul(h ^ pixels[i + 2], 16777619); if (pixels[i + 3]) opaque++; }
    return { hash: h >>> 0, opaque };
  });
}
async function pause(page) {
  if (await page.locator('#transformer-motion').getAttribute('aria-pressed') !== 'true') await page.locator('#transformer-motion').click();
  await frames(page);
}
async function reachable(page, locator, width, height, name) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  assert.ok(r && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, `${name}: ${JSON.stringify(r)}`);
  assert.equal(await locator.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !el.closest('[inert],[hidden]') && !!hit && (hit === el || el.contains(hit)); }), true, `${name} is covered or inert`);
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    const page = currentPage = await context.newPage(); await ready(page);
    await check('100 MW gives the expected current and losses at 200 and 400 kV', async () => {
      const [a, b] = await page.evaluate(() => [IngaTransformerModel.calculate(100, 200), IngaTransformerModel.calculate(100, 400)]);
      near(a.current, 288.675134594813); near(a.loss, 2.5); near(a.received, 97.5);
      near(b.current, 144.3375672974065); near(b.loss, .625); near(b.received, 99.375);
      near(a.current / b.current, 2); near(a.loss / b.loss, 4); near(b.savingPercent, 75);
      near(a.ratio, 10); near(b.ratio, 20); near(a.inputCurrent, 2886.75134594813);
      return { current: [a.current, b.current], losses: [a.loss, b.loss] };
    });
    await check('the pure model rejects invalid inputs, freezes results and conserves passive power throughout its range', async () => {
      const before = await state(page);
      const report = await page.evaluate(() => {
        const f = IngaTransformerModel.calculate, r = f(100, 200), original = JSON.stringify(r);
        Reflect.set(r, 'power', 999);
        const invalid = [[-1, 200], [2001, 200], [NaN, 200], [Infinity, 200], ['100', 200], [null, 200], [100, 199], [100, 401], [100, NaN], [100, Infinity], [100, '200'], [100, null]];
        return { frozen: Object.isFrozen(IngaTransformerModel) && Object.isFrozen(r), unchanged: JSON.stringify(r) === original, invalid: invalid.every(args => f(...args) === null), values: [0, .001, 1, 100, 1056, 2000].flatMap(p => [200, 201, 300, 399, 400].map(v => f(p, v))) };
      });
      assert.equal(report.frozen, true); assert.equal(report.unchanged, true); assert.equal(report.invalid, true);
      for (const r of report.values) {
        for (const value of Object.values(r)) assert.ok(Number.isFinite(value) && value >= 0);
        assert.ok(r.loss <= r.power && r.received <= r.power && r.receivingVoltage <= r.voltage);
        near(r.received + r.loss, r.power); near(Math.sqrt(3) * r.receivingVoltage * r.current / 1000, r.received, 1e-8);
        near(Math.sqrt(3) * r.inputVoltage * r.inputCurrent / 1000, r.power, 1e-8);
      }
      assert.equal(await state(page), before);
    });
    await check('opening preserves the site and presents an independent accessible 100 MW example', async () => {
      await reset(page); const before = await state(page); await open(page, true); const r = await readouts(page);
      assert.equal(r.power, 100); assert.equal(r.voltage, 200); assert.equal(r.source, 'example'); assert.equal(await state(page), before);
      assert.equal(await page.locator('#transformer-cut [role="dialog"]').getAttribute('aria-modal'), 'true');
      assert.match(await page.locator('#transformer-canvas').getAttribute('aria-label'), /100 mégawatts envoyés.*200 kilovolts/);
      assert.match(await page.locator('#transformer-scope').textContent(), /réglages.*inchangés/);
      await page.evaluate(() => { const copy = IngaTransformer.state; copy.power = -1; copy.source = 'changed'; });
      assert.equal((await local(page)).power, 100); assert.equal((await local(page)).source, 'example');
      await closeButton(page).click(); await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForFunction(() => !document.querySelector('#transformerBtn').closest('#tools-panel'));
      const clipped = await page.locator('.tools [aria-label="Outils"]').evaluate(group => {
        const g = group.getBoundingClientRect();
        return [...group.querySelectorAll('button')].filter(button => {
          const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return r.x < Math.max(0, g.x) - 1 || r.right > Math.min(innerWidth, g.right) + 1 || !hit || !(button === hit || button.contains(hit));
        }).map(button => button.id);
      });
      await page.screenshot({ path: '/tmp/inga-transformer-toolbar-1024.png' });
      assert.deepEqual(clipped, [], 'all desktop toolbar actions must remain reachable at 1024px');
      await open(page, true); await closeButton(page).click(); await page.setViewportSize({ width: 1440, height: 900 });
    });
    await check('voltage presets and keyboard range keep sent power fixed and update all comparisons', async () => {
      await reset(page); await open(page); const before = await state(page);
      await page.locator('[data-transformer-voltage="400"]').click(); let r = await readouts(page);
      assert.equal(r.power, 100); near(r.loss, .625); assert.equal(await page.locator('#transformer-loss-bar').evaluate(el => el.style.width), '25%');
      assert.match(await page.locator('#transformer-insight').textContent(), /75.*%/);
      assert.match(await page.locator('#transformer-why').textContent(), /courant.*deux.*pertes.*quatre/);
      await page.waitForFunction(() => !tween, null, { timeout: 30000 });
      const cameraTarget = await page.evaluate(() => controls.target.toArray());
      await page.locator('#transformer-voltage').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      r = await readouts(page); assert.equal(r.voltage, 201); assert.equal(r.power, 100);
      assert.deepEqual(await page.evaluate(() => controls.target.toArray()), cameraTarget, 'range arrows must not pan the background camera');
      for (const v of ['200', '400']) assert.equal(await page.locator(`[data-transformer-voltage="${v}"]`).getAttribute('aria-pressed'), 'false');
      await page.keyboard.press('End'); assert.equal((await readouts(page)).voltage, 400);
      await page.locator('[data-transformer-voltage="200"]').click(); assert.equal((await readouts(page)).loss, 2.5); assert.equal(await state(page), before);
    });
    await check('automatic comparison reaches 400 kV through an intermediate state without changing sent power or the site', async () => {
      await reset(page); await open(page); const before = await state(page); await page.locator('#transformer-compare').click();
      assert.equal(await page.locator('#transformer-compare').getAttribute('aria-pressed'), 'true');
      await page.waitForFunction(() => IngaTransformer.state.voltage > 200 && IngaTransformer.state.voltage < 400, null, { timeout: 7000 });
      assert.equal((await local(page)).power, 100); assert.equal(await state(page), before);
      await page.waitForFunction(() => IngaTransformer.state.voltage === 400 && document.querySelector('#transformer-compare').getAttribute('aria-pressed') === 'false', null, { timeout: 10000 });
      near((await readouts(page)).loss, .625); assert.match(await page.locator('#transformer-status').textContent(), /terminée/); assert.equal(await state(page), before);
    });
    await check('manual changes, stop and pause cancel automatic comparison without late changes', async () => {
      await reset(page); await open(page); const before = await state(page);
      for (const action of ['preset', 'stop', 'pause']) {
        await page.locator('#transformer-compare').click();
        if (action === 'preset') await page.locator('[data-transformer-voltage="400"]').click();
        if (action === 'stop') await page.locator('#transformer-compare').click();
        if (action === 'pause') await pause(page);
        assert.equal(await page.locator('#transformer-compare').getAttribute('aria-pressed'), 'false');
        const value = await local(page); await page.waitForTimeout(1250); assert.deepEqual(await local(page), value);
      }
      await page.locator('#transformer-compare').click(); assert.equal((await readouts(page)).voltage, 400);
      assert.equal(await page.locator('#transformer-compare').getAttribute('aria-pressed'), 'false'); assert.equal(await state(page), before);
    });
    await check('site power is a frozen snapshot until explicitly refreshed and never writes back to the dispatcher', async () => {
      await reset(page); await open(page); const before = await state(page), original = await page.evaluate(() => __INGA.R.Pgen);
      await page.locator('[data-transformer-power="site"]').click(); near((await readouts(page)).power, original); assert.equal(await state(page), before);
      assert.match(await page.locator('#transformer-power-origin').textContent(), /moment du clic/);
      await page.evaluate(() => __INGA.setCanalCapacity(1600)); const changed = await state(page), newPower = await page.evaluate(() => __INGA.R.Pgen);
      assert.ok(newPower < original); await frames(page); near((await readouts(page)).power, original);
      await page.locator('[data-transformer-voltage="400"]').click(); near((await readouts(page)).power, original); assert.equal(await state(page), changed);
      await page.locator('[data-transformer-power="site"]').click(); near((await readouts(page)).power, newPower);
      await page.locator('[data-transformer-power="example"]').click(); assert.equal((await readouts(page)).power, 100); assert.equal(await state(page), changed);
    });
    await check('zero site power gives zero current and losses while explaining that voltage may remain', async () => {
      await reset(page); await page.evaluate(() => __INGA.S.units.forEach(u => __INGA.setUnitEnabled(u.id, false))); await open(page);
      const before = await state(page); await page.locator('[data-transformer-power="site"]').click();
      for (const voltage of ['200', '400']) {
        await page.locator(`[data-transformer-voltage="${voltage}"]`).click(); const r = await readouts(page);
        for (const key of ['power', 'current', 'loss', 'received', 'savingPercent']) assert.equal(r[key], 0);
        assert.equal(await page.locator('#transformer-loss-bar').evaluate(el => el.style.width), '0%');
      }
      assert.match(await page.locator('#transformer-why').textContent(), /tension.*flux.*présents/); assert.equal(await state(page), before);
    });
    await check('the real canvas animates, pauses and responds to stages and field visibility without model changes', async () => {
      await reset(page); await open(page); const before = await state(page), first = await hash(page); assert.ok(first.opaque > 500);
      await frames(page); assert.notEqual((await hash(page)).hash, first.hash);
      await pause(page); const paused = await hash(page); await page.waitForTimeout(350); assert.deepEqual(await hash(page), paused);
      await page.locator('#transformer-field').uncheck(); const fieldOff = await hash(page); assert.notEqual(fieldOff.hash, paused.hash);
      await page.locator('[data-transformer-stage="line"]').click(); assert.notEqual((await hash(page)).hash, fieldOff.hash); assert.match(await page.locator('#transformer-explanation').textContent(), /courant.*chaleur/);
      await page.locator('[data-transformer-stage="city"]').click(); assert.match(await page.locator('#transformer-explanation').textContent(), /abaisse.*tension/);
      assert.equal(await state(page), before); await page.locator('#transformer-motion').click(); const restarted = await hash(page); await frames(page); assert.notEqual((await hash(page)).hash, restarted.hash);
    });
    await check('closing, Escape, reset, tour, paper and another modal stop both drawing and comparison', async () => {
      for (const action of ['close', 'escape', 'reset', 'tour', 'paper', 'canal']) {
        await reset(page); await open(page); await page.locator('#transformer-compare').click();
        if (action === 'close') await closeButton(page).click();
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
        if (action === 'tour') await page.evaluate(() => { NARR.on = false; __INGA.tour(0); });
        if (action === 'paper') await page.evaluate(() => toPaper());
        if (action === 'canal') await page.evaluate(() => IngaCanal.open());
        await page.locator('#transformer-cut').waitFor({ state: 'hidden' }); await frames(page);
        const frozen = await hash(page), snapshot = await local(page), model = await state(page);
        await page.waitForTimeout(1250); assert.deepEqual(await hash(page), frozen, `${action} stops drawing`); assert.deepEqual(await local(page), snapshot, `${action} cancels comparison`); assert.equal(await state(page), model);
        if (action === 'tour') await page.locator('#tQuit').click();
        if (action === 'paper') await page.evaluate(() => __INGA.jump(TT));
        if (action === 'canal') await page.evaluate(() => IngaCanal.close());
      }
    });
    await check('keyboard navigation includes native disclosure and Escape returns focus to the toolbar', async () => {
      await reset(page); await open(page, true);
      for (const key of [...Array(24).fill('Tab'), ...Array(24).fill('Shift+Tab')]) { await page.keyboard.press(key); assert.equal(await page.evaluate(() => !!document.activeElement.closest('#transformer-cut')), true); }
      await page.locator('#transformer-field').focus(); await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
      await page.keyboard.press('Enter'); assert.equal(await page.locator('#transformer-cut details').getAttribute('open'), '');
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'transformer-sources');
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); assert.equal(await page.locator('#transformer-cut details').getAttribute('open'), null);
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'transformerBtn');
      // The shared keyboard guard must preserve native sliders in the other engineering lessons too.
      await page.evaluate(() => IngaCanal.open()); await page.locator('#canal-sediment').focus();
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#canal-sediment').inputValue(), '1');
      assert.equal(await page.evaluate(() => __INGA.S.canal), 2194); await page.keyboard.press('Escape');
    });
    await check('alternator, learning and AC network entries open the lesson and cancel learning auto changes', async () => {
      await reset(page); const before = await state(page); await page.evaluate(() => IngaAlternator.open('G11'));
      await page.locator('#alternator-transformer').click(); assert.equal(await page.locator('#alternator-cut').isVisible(), false); assert.equal(await page.locator('#transformer-cut').isVisible(), true);
      await page.locator('#transformer-alternator').click(); assert.equal(await page.locator('#alternator-unit').inputValue(), 'G11'); await page.evaluate(() => IngaAlternator.close());
      await page.locator('#learningBtn').click(); await page.locator('[data-learning="transformer-cut"]').click(); assert.equal(await page.locator('#transformer-cut').isVisible(), true); assert.equal(await state(page), before);
      await closeButton(page).click(); await page.locator('#learningBtn').click(); await page.locator('[data-learning-challenge="grid"]').click();
      await page.locator('[data-learning="skip-prediction"]').click(); await page.locator('[data-learning-scene="transformer-cut"]').click();
      assert.equal(await page.locator('#learning-scene').isVisible(), false); const preserved = await state(page); await page.waitForTimeout(5500); assert.equal(await state(page), preserved); await closeButton(page).click();
      for (const key of ['switchyard', 'kinshasa']) {
        await page.evaluate(key => openInfo(key), key); await page.locator('[data-open-transformer]').click(); assert.equal(await page.locator('#transformer-cut').isVisible(), true); await closeButton(page).click();
      }
      await page.evaluate(() => openInfo('hvdc')); assert.equal(await page.locator('[data-open-transformer]').count(), 0); await page.evaluate(() => closeInfo());
    });
    for (const [width, height] of [[320, 568], [390, 844], [740, 800], [844, 390], [1440, 900]]) {
      await check(`layout ${width}×${height} keeps the drawing, sticky measurements and every control usable`, async () => {
        await reset(page); await page.setViewportSize({ width, height }); await open(page, true);
        const box = await page.locator('#transformer-cut [role="dialog"]').boundingBox(), canvas = await page.locator('#transformer-canvas').boundingBox();
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, JSON.stringify(box));
        assert.ok(canvas.width >= 240 && canvas.height >= 180, JSON.stringify(canvas));
        if (width === 740) assert.ok(canvas.height <= height * .45, 'tablet drawing leaves space for controls');
        assert.equal(await page.locator('.transformer-console').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        await reachable(page, closeButton(page), width, height, 'close');
        for (const selector of ['[data-transformer-power="example"]', '[data-transformer-power="site"]', '[data-transformer-voltage="200"]', '[data-transformer-voltage="400"]', '#transformer-voltage', '#transformer-compare', '[data-transformer-stage="city"]', '#transformer-field', '#transformer-cut summary', '#transformer-motion', '#transformer-alternator', '#transformer-return']) await reachable(page, page.locator(selector), width, height, selector);
        await page.locator('#transformer-voltage').scrollIntoViewIfNeeded();
        for (const selector of ['#transformer-current', '#transformer-loss', '#transformer-received']) await reachable(page, page.locator(selector), width, height, `sticky ${selector}`);
        await page.locator('.transformer-console').evaluate(el => { el.scrollTop = 0; }); await page.screenshot({ path: `/tmp/inga-transformer-test-${width}.png` }); await closeButton(page).click();
        return { canvas: [Math.round(canvas.width), Math.round(canvas.height)] };
      });
    }
    await check('reduced motion stays static and comparison applies immediately with usable controls', async () => {
      const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const rp = currentPage = await reduced.newPage();
      try {
        await ready(rp); await open(rp); const before = await state(rp), initial = await hash(rp);
        assert.equal(await rp.locator('#transformer-motion').getAttribute('aria-pressed'), 'true'); await rp.waitForTimeout(350); assert.deepEqual(await hash(rp), initial);
        await rp.locator('#transformer-compare').click(); const value = await readouts(rp); assert.equal(value.voltage, 400); near(value.loss, .625);
        assert.equal(await rp.locator('#transformer-compare').getAttribute('aria-pressed'), 'false'); assert.notEqual((await hash(rp)).hash, initial.hash);
        const changed = await hash(rp); await rp.waitForTimeout(350); assert.deepEqual(await hash(rp), changed); assert.equal(await state(rp), before);
        await rp.locator('#transformer-voltage').focus(); await rp.keyboard.press('Home'); assert.equal((await readouts(rp)).voltage, 200);
      } finally { await reduced.close(); currentPage = page; }
    });
    await check('no browser errors', async () => assert.deepEqual(errors, []));
    if (filter) assert.ok(results.some(item => item.name !== 'no browser errors'), `No checks matched ${filter}`);
  } finally { await browser.close(); }
  console.log(JSON.stringify(results, null, 2)); if (results.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
