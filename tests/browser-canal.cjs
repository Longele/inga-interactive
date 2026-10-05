const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const filter = process.env.INGA_CANAL_CASE;
const report = [], errors = [];
let activePage;
const numeric = text => Number(text.replace(/MW|m³\/s/g, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
const state = page => page.evaluate(() => JSON.stringify(__INGA.S));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const closeButton = page => page.locator('#canal-cut').getByRole('button', { name: /fermer/i }).first();

async function check(name, fn) {
  if (filter && !name.includes(filter) && name !== 'no browser errors') return;
  try { const detail = await fn(); report.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) {
    const screenshot = `/tmp/inga-canal-fail-${report.length + 1}.png`;
    try { await activePage.screenshot({ path: screenshot, timeout: 10000 }); } catch {}
    report.push({ name, ok: false, detail: error.message, screenshot });
    console.error('FAIL', name, error.stack, screenshot);
  }
}

async function ready(page) {
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__INGA && window.IngaCanal && document.querySelector('#loading.gone'), null, { timeout: 120000 });
  // This suite verifies the real canal canvas. Avoid redrawing the unrelated background WebGL scene.
  await page.evaluate(() => { if (typeof renderer !== 'undefined' && renderer) renderer.render = () => {}; });
  await page.locator('#skip').click();
  await page.waitForFunction(() => __INGA.mode === 'live');
  await page.evaluate(() => document.fonts.ready);
}

async function open(page, viaToolbar = false) {
  if (viaToolbar) {
    // The responsive toolbar reparents this button asynchronously after a viewport resize.
    // Wait for its actual destination before deciding which visitor-facing entry to click.
    await page.waitForFunction(() => {
      const button = document.querySelector('#canalBtn');
      return button && !!button.closest('#tools-panel') === matchMedia('(max-width: 900px)').matches;
    });
    if (await page.locator('#canalBtn').isVisible()) await page.locator('#canalBtn').click();
    else { await page.locator('#mobile-options').click(); await page.locator('#canalBtn').click(); }
  } else await page.evaluate(() => IngaCanal.open());
  await page.locator('#canal-cut').waitFor({ state: 'visible' });
  await page.waitForFunction(() => { const c = document.querySelector('#canal-canvas'); return c?.width > 0 && c.height > 0; });
  await frames(page);
}

async function reset(page) {
  await page.evaluate(() => { IngaCanal.close(); if (__INGA.mode !== 'live') __INGA.jump(TT); __INGA.resetAll(); });
}

async function values(page) {
  const expected = await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(__INGA.S)); s.canal = 2200;
    const reference = __INGA.simulate(s);
    return { capacity: __INGA.S.canal, flow: __INGA.R.Qdiv, power: __INGA.R.Pgen, reference: reference.Pgen, bind: __INGA.R.bind };
  });
  for (const [id, key] of [['canal-capacity', 'capacity'], ['canal-flow', 'flow'], ['canal-power', 'power'], ['canal-reference-power', 'reference']]) {
    const shown = numeric(await page.locator('#' + id).textContent());
    assert.equal(shown, Math.round(expected[key]), `${id} must match the actual engine state`);
  }
  return expected;
}

async function canvasHash(page) {
  return page.locator('#canal-canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, opaque = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      hash = Math.imul(hash ^ pixels[i + 1], 16777619);
      hash = Math.imul(hash ^ pixels[i + 2], 16777619);
      if (pixels[i + 3]) opaque++;
    }
    return { hash: hash >>> 0, opaque, width: canvas.width, height: canvas.height };
  });
}

async function startAnimation(page) {
  await reset(page);
  await open(page);
  await page.locator('[data-canal-preset="clear"]').click();
  await page.locator('#canal-play').click();
  await page.waitForFunction(() => __INGA.S.canal < 2199 && __INGA.S.canal > 1601, null, { timeout: 5000 });
}

async function assertStopped(page, expected) {
  assert.equal(await page.locator('#canal-cut').isVisible(), false);
  const frozen = await canvasHash(page);
  await page.waitForTimeout(1200);
  assert.equal(await state(page), expected, 'closed animation must not change the model later');
  assert.deepEqual(await canvasHash(page), frozen, 'closed canvas must stop drawing');
}

async function reachable(page, locator, width, height, name) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `${name}: ${JSON.stringify(rect)}`);
  assert.equal(await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !el.closest('[inert],[hidden]') && !!hit && (hit === el || el.contains(hit));
  }), true, `${name} is covered or inert`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    const page = activePage = await context.newPage();
    await ready(page);

    await check('opening preserves the model; endpoints show actual flow and power', async () => {
      await reset(page);
      const before = await state(page);
      await open(page, true);
      assert.equal(await state(page), before);
      const clear = await values(page);
      assert.equal(clear.capacity, 2200);
      assert.ok(Math.abs(clear.power - 1055.945922) < .01);
      await page.locator('#canal-sediment').focus();
      await page.keyboard.press('End');
      const sed = await values(page);
      assert.equal(sed.capacity, 1600);
      assert.ok(Math.abs(sed.power - 767.960671) < .01);
      assert.ok(Math.abs(sed.flow - 1600) < .01);
      assert.match(await page.locator('#canal-why').textContent(), /canal|passage/i);
      await page.keyboard.press('Home');
      assert.equal((await values(page)).capacity, 2200);
      await page.locator('[data-canal-preset="sed"]').click();
      assert.equal((await values(page)).capacity, 1600);
      await page.locator('[data-canal-preset="clear"]').click();
      assert.equal((await values(page)).capacity, 2200);
      return { clear, sediment: sed };
    });

    await check('comparison preserves the network constraint instead of substituting the default reference', async () => {
      await reset(page);
      await page.evaluate(() => __INGA.applyPreset('grid', { fly: false }));
      await open(page);
      const clear = await values(page);
      assert.ok(Math.abs(clear.power - 900) < .01);
      assert.ok(Math.abs(clear.reference - 900) < .01);
      assert.match(await page.locator('#canal-why').textContent(), /réseau|transport/i);
      await page.locator('[data-canal-preset="sed"]').click();
      const sed = await values(page);
      assert.ok(Math.abs(sed.power - 767.960671) < .01);
      assert.ok(Math.abs(sed.reference - 900) < .01);
      assert.equal(await page.evaluate(() => __INGA.S.exportLim), 900);
      return { clear, sediment: sed };
    });

    await check('capacity editing preserves groups, gate, demand, and other model parameters', async () => {
      await reset(page);
      await page.evaluate(() => editSimulation(() => { S.units.find(u => u.id === 'G24').failed = true; S.units[0].load = .6; S.gate = .8; S.demand = 1100; S.exportLim = 1200; }));
      const untouched = await page.evaluate(() => { const s = JSON.parse(JSON.stringify(__INGA.S)); delete s.canal; delete s.canalCond; return s; });
      await open(page);
      await page.locator('[data-canal-preset="sed"]').click();
      assert.deepEqual(await page.evaluate(() => { const s = JSON.parse(JSON.stringify(__INGA.S)); delete s.canal; delete s.canalCond; return s; }), untouched);
      return values(page);
    });

    await check('a 3000 m³/s canal is preserved and offers explicit entry into the illustrative range', async () => {
      await reset(page);
      await page.evaluate(() => __INGA.setCanalCapacity(3000));
      const original = await state(page);
      await open(page);
      assert.equal(await state(page), original);
      assert.equal(await page.locator('#canal-sediment').isDisabled(), true);
      assert.equal(await page.locator('#canal-range-note').isVisible(), true);
      assert.equal((await values(page)).capacity, 3000);
      await page.locator('[data-canal-preset="clear"]').click();
      assert.equal(await page.locator('#canal-sediment').isDisabled(), false);
      assert.equal(await page.locator('#canal-range-note').isVisible(), false);
      assert.equal(await page.evaluate(() => __INGA.S.canal), 2200);
      await page.evaluate(() => __INGA.setCanalCapacity(3000));
      assert.equal(await page.locator('#canal-sediment').isDisabled(), true);
      await page.locator('#canal-play').click();
      assert.equal(await page.locator('#canal-sediment').isDisabled(), false, 'choosing animation explicitly enters the illustrative range');
      assert.equal(await page.locator('#canal-range-note').isVisible(), false);
      await page.locator('#canal-play').click();
    });

    await check('the capacity API rejects invalid values without modifying the model', async () => {
      await reset(page);
      const result = await page.evaluate(() => {
        const original = JSON.stringify(__INGA.S);
        const invalid = [NaN, Infinity, -Infinity, null, undefined, '1600', {}, true];
        return invalid.map(value => ({ rejected: __INGA.setCanalCapacity(value) === false, unchanged: JSON.stringify(__INGA.S) === original }));
      });
      assert.equal(result.length, 8);
      assert.ok(result.every(item => item.rejected && item.unchanged));
      await page.evaluate(() => __INGA.setCanalCapacity(0));
      assert.equal(await page.evaluate(() => __INGA.S.canal), 0);
      await page.evaluate(() => __INGA.setCanalCapacity(4000));
      assert.equal(await page.evaluate(() => __INGA.S.canal), 4000);
      assert.deepEqual(await page.evaluate(() => [__INGA.setCanalCapacity(-10), __INGA.setCanalCapacity(5000)]), [0, 4000], 'finite capacities are clamped to the supported range');
    });

    await check('animation progresses, pauses, and completes ensablement and cleaning', async () => {
      await startAnimation(page);
      assert.equal(await page.locator('#canal-animation').getAttribute('role'), 'status');
      await page.locator('#canal-play').click();
      const paused = await state(page);
      await page.waitForTimeout(500);
      assert.equal(await state(page), paused);
      await page.locator('[data-canal-preset="clear"]').click();
      await page.locator('#canal-play').click();
      await page.waitForFunction(() => __INGA.S.canal === 1600, null, { timeout: 13000 });
      await values(page);
      await page.locator('#canal-play').click();
      await page.waitForFunction(() => __INGA.S.canal > 1601 && __INGA.S.canal < 2199, null, { timeout: 5000 });
      await page.waitForFunction(() => __INGA.S.canal === 2200, null, { timeout: 13000 });
      await values(page);
    });

    await check('the live canvas animates, can pause, and redraws state changes while paused', async () => {
      await reset(page);
      await open(page);
      const initial = await canvasHash(page);
      assert.ok(initial.opaque > 500, 'canvas contains a rendered illustration');
      await page.waitForTimeout(300);
      assert.notEqual((await canvasHash(page)).hash, initial.hash, 'water animation changes real pixels');
      await page.locator('#canal-motion').click();
      assert.equal(await page.locator('#canal-motion').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#canal-motion').getAttribute('aria-label'), /reprendre/i);
      await frames(page);
      const paused = await canvasHash(page);
      await page.waitForTimeout(350);
      assert.deepEqual(await canvasHash(page), paused);
      await page.locator('[data-canal-preset="sed"]').click();
      await frames(page);
      assert.notEqual((await canvasHash(page)).hash, paused.hash, 'sediment remains visibly editable with motion paused');
      await page.locator('#canal-motion').click();
      assert.equal(await page.locator('#canal-motion').getAttribute('aria-pressed'), 'false');
    });

    await check('Escape cancels mid-animation, stops drawing, and restores keyboard focus', async () => {
      await reset(page);
      await open(page, true);
      await page.locator('#canal-play').click();
      await page.waitForFunction(() => __INGA.S.canal < 2199 && __INGA.S.canal > 1601);
      for (const key of [...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('#canal-cut')), true);
      }
      await page.keyboard.press('Escape');
      const stopped = await state(page);
      await assertStopped(page, stopped);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'canalBtn');
    });

    for (const action of ['close', 'reset', 'tour', 'paper', 'other modal']) {
      await check(`${action} cancels canal animation and drawing without a late change`, async () => {
        await startAnimation(page);
        if (action === 'close') await closeButton(page).click();
        if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
        if (action === 'tour') await page.evaluate(() => { NARR.on = false; __INGA.tour(0); });
        if (action === 'paper') await page.evaluate(() => toPaper());
        if (action === 'other modal') await page.evaluate(() => document.querySelector('#openReg').click());
        await assertStopped(page, await state(page));
        if (action === 'tour') await page.locator('#tQuit').click();
        if (action === 'other modal') { assert.equal(await page.locator('#reg').isVisible(), true); await page.keyboard.press('Escape'); }
        if (action === 'paper') await page.evaluate(() => __INGA.jump(TT));
      });
    }

    await check('learning hub and canal scene open the same cutaway without an automatic late change', async () => {
      await reset(page);
      await page.locator('#learningBtn').click();
      const before = await state(page);
      await page.locator('[data-learning="canal-cut"]').click();
      assert.equal(await page.locator('#canal-cut').isVisible(), true);
      assert.equal(await page.locator('#learning').isVisible(), false);
      assert.equal(await state(page), before);
      await closeButton(page).click();
      await page.locator('#learningBtn').click();
      await page.locator('[data-learning-challenge="sed"]').click();
      await page.locator('[data-learning="skip-prediction"]').click();
      await page.locator('#learning-scene').waitFor({ state: 'visible' });
      await page.locator('[data-learning-scene="canal-cut"]').click();
      assert.equal(await page.locator('#learning-scene').isVisible(), false);
      assert.equal(await page.locator('#canal-cut').isVisible(), true);
      const preserved = await state(page);
      await page.waitForTimeout(4000);
      assert.equal(await state(page), preserved, 'opening the cutaway cancels the learning scene timer');
      await closeButton(page).click();
      await page.locator('#learningBtn').click();
      await page.locator('[data-learning-challenge="one"]').click();
      await page.locator('[data-learning="skip-prediction"]').click();
      assert.equal(await page.locator('[data-learning-scene="canal-cut"]').isVisible(), false);
      await page.locator('[data-learning-scene="close"]').click();
    });

    for (const [width, height] of [[320, 568], [390, 844], [740, 800], [844, 390], [1440, 900]]) {
      await check(`layout ${width}×${height} keeps drawing and controls legible and reachable`, async () => {
        await reset(page);
        await page.setViewportSize({ width, height });
        await open(page, true);
        const layout = await page.locator('#canal-cut').evaluate(el => {
          const box = el.querySelector('[role="dialog"]'), r = box.getBoundingClientRect(), c = el.querySelector('canvas').getBoundingClientRect();
          const overflow = [...el.querySelectorAll('*')].filter(node => node.clientWidth > 0 && getComputedStyle(node).overflowX === 'auto').map(node => node.scrollWidth - node.clientWidth);
          return { x: r.x, y: r.y, width: r.width, height: r.height, canvasWidth: c.width, canvasHeight: c.height, overflow };
        });
        assert.ok(layout.x >= -1 && layout.y >= -1 && layout.x + layout.width <= width + 1 && layout.y + layout.height <= height + 1, JSON.stringify(layout));
        assert.ok(layout.canvasHeight >= 180 && layout.canvasWidth >= 240, `illegible drawing: ${JSON.stringify(layout)}`);
        if (width === 740) assert.ok(layout.canvasHeight <= height * .45, `tablet drawing leaves too little room for controls: ${JSON.stringify(layout)}`);
        assert.ok(layout.overflow.every(value => value <= 1), `horizontal scrolling: ${JSON.stringify(layout)}`);
        await reachable(page, closeButton(page), width, height, 'close');
        for (const selector of ['#canal-sediment', '#canal-play', '#canal-motion', '[data-canal-preset="clear"]', '[data-canal-preset="sed"]']) {
          await reachable(page, page.locator(selector), width, height, selector);
        }
        await page.locator('[data-canal-preset="sed"]').click();
        await page.locator('#canal-canvas').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/inga-canal-${width}.png` });
        await closeButton(page).click();
        return layout;
      });
    }

    await check('reduced motion keeps the drawing static and changes animation endpoints immediately', async () => {
      const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const reducedPage = activePage = await reduced.newPage();
      try {
        await ready(reducedPage);
        await open(reducedPage);
        await frames(reducedPage);
        const initial = await canvasHash(reducedPage);
        await reducedPage.waitForTimeout(350);
        assert.deepEqual(await canvasHash(reducedPage), initial);
        await reducedPage.locator('#canal-play').click();
        assert.equal(await reducedPage.evaluate(() => __INGA.S.canal), 1600);
        await frames(reducedPage);
        const sediment = await canvasHash(reducedPage);
        assert.notEqual(sediment.hash, initial.hash);
        await reducedPage.waitForTimeout(350);
        assert.deepEqual(await canvasHash(reducedPage), sediment);
        await reducedPage.locator('#canal-play').click();
        assert.equal(await reducedPage.evaluate(() => __INGA.S.canal), 2200);
        await values(reducedPage);
      } finally { await reduced.close(); activePage = page; }
    });

    await check('no browser errors', async () => assert.deepEqual(errors, []));
    if (filter) assert.ok(report.some(item => item.name !== 'no browser errors'), `No tests matched ${filter}`);
  } finally { await browser.close(); }
  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
