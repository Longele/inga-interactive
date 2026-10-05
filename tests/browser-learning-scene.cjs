const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const errors = [], report = [];
const sceneButton = (page, action) => page.locator(`[data-learning-scene="${action}"]`);
const snapshot = page => page.evaluate(() => JSON.stringify(__INGA.S));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function check(name, fn) {
  try { const detail = await fn(); report.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) { report.push({ name, ok: false, detail: error.message }); console.error('FAIL', name, error.stack); }
}

async function launch(page, id = 'sed') {
  if (await page.locator('#learning-scene').isVisible()) await sceneButton(page, 'close').click();
  if (await page.locator('#learning').isVisible()) await page.locator('.learning-close').click();
  const mobile = page.locator('#mobile-learn');
  if (await mobile.isVisible()) await mobile.click();
  else await page.locator('#learningBtn').click();
  await page.locator(`[data-learning-challenge="${id}"]`).click();
  await page.locator('[data-learning="skip-prediction"]').click();
  await page.locator('#learning-scene').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#learning').isVisible(), false);
  assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'before');
  assert.equal(await page.evaluate(() => document.body.classList.contains('learning-observing')), true);
  assert.equal(await snapshot(page), await page.evaluate(() => JSON.stringify(__INGA.BASE)), 'the actual model begins in the reference state');
}

async function assertCamera(page, id) {
  const expectedView = id === 'grid' ? 'grid' : 'flow';
  await page.waitForFunction(expected => tween === null && view === expected, expectedView, { timeout: 30000 });
  await frames(page);
  const result = await page.evaluate(({ id, expectedView }) => {
    const shot = VIEWS[id === 'sed' ? 'canal' : id === 'one' ? 'inga2' : 'grid'];
    const distance = controls.target.distanceTo(new THREE.Vector3(...shot.t));
    const projected = new THREE.Vector3(...shot.t).project(camera);
    const point = { x: (projected.x + 1) * innerWidth / 2, y: (1 - projected.y) * innerHeight / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    const gl = document.querySelector('#gl');
    return { view, expectedView, distance, point, targetVisible: hit === gl, targetHit: hit?.id || hit?.tagName, rendered: renderer.info.render.calls > 0 };
  }, { id, expectedView });
  assert.equal(result.view, expectedView);
  assert.ok(result.distance < 1, `wrong scene target: ${JSON.stringify(result)}`);
  assert.equal(result.targetVisible, true, `the intended subject is covered: ${JSON.stringify(result)}`);
  assert.equal(result.rendered, true, 'the real WebGL renderer is active');
  return result;
}

async function assertRenderedPhase(page, id, phase) {
  await page.waitForFunction(({ id, phase }) => {
    const after = phase === 'after';
    if (id === 'sed') return __INGA.S.canal === (after ? 1600 : 2200) && (after ? T3.sediment.userData.s > .5 : T3.sediment.userData.s < .05);
    if (id === 'one') return T3.lamps.G24.material.color.getHex() === (after ? 0xdc7362 : 0xe5ab4f);
    const reference = __INGA.simulate(JSON.parse(JSON.stringify(__INGA.BASE)));
    return view === 'grid' && Math.abs(__INGA.R.Prec - (after ? 855 : reference.Prec)) < .01;
  }, { id, phase }, { timeout: 30000 });
}

async function assertSceneLayout(page, width, height) {
  const result = await page.evaluate(() => {
    const guide = document.querySelector('#learning-scene'), gl = document.querySelector('#gl');
    const r = guide.getBoundingClientRect(), center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const clear = learningSceneArea();
    let free = 0, total = 0;
    if (clear) for (const x of [.1, .3, .5, .7, .9]) for (const y of [.1, .3, .5, .7, .9]) {
      total++;
      if (document.elementFromPoint(clear.left + (clear.right - clear.left) * x, clear.top + (clear.bottom - clear.top) * y) === gl) free++;
    }
    const actions = [...guide.querySelectorAll('[data-learning-scene]')].map(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { action: el.dataset.learningScene, x: r.x, y: r.y, width: r.width, height: r.height, reachable: !el.closest('[inert],[hidden]') && !!hit && (el === hit || el.contains(hit)) };
    });
    return { x: r.x, y: r.y, width: r.width, height: r.height, overflow: guide.scrollWidth - guide.clientWidth,
      canvasInert: !!gl.closest('[inert],[hidden]'), centerCanvas: center === gl, centerHit: center?.id || center?.tagName,
      visibleModals: [...document.querySelectorAll('.modal')].filter(el => !el.hidden).map(el => el.id), clear, free, total, actions };
  });
  assert.ok(result.x >= -1 && result.y >= -1 && result.x + result.width <= width + 1 && result.y + result.height <= height + 1, JSON.stringify(result));
  assert.ok(result.overflow <= 1, `guide overflows horizontally: ${JSON.stringify(result)}`);
  assert.equal(result.canvasInert, false, 'observation does not make the model inert');
  assert.deepEqual(result.visibleModals, [], 'observation has no blocking modal');
  assert.ok(result.clear && result.clear.right - result.clear.left >= 240 && result.clear.bottom - result.clear.top >= 160, `too little usable model area: ${JSON.stringify(result)}`);
  assert.ok(result.free / result.total >= .8, `the designated model area is obstructed: ${JSON.stringify(result)}`);
  for (const action of ['before', 'after', 'results', 'close']) {
    const control = result.actions.find(item => item.action === action);
    assert.ok(control?.reachable, `unreachable ${action}: ${JSON.stringify(result)}`);
    assert.ok(control.x >= -1 && control.y >= -1 && control.x + control.width <= width + 1 && control.y + control.height <= height + 1, `offscreen ${action}: ${JSON.stringify(control)}`);
  }
  return result;
}

async function dragScene(page, clear) {
  const start = { x: (clear.left + clear.right) / 2, y: (clear.top + clear.bottom) / 2 };
  const position = await page.evaluate(() => camera.position.toArray());
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 18, y: start.y + 5 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 38, y: start.y + 10 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
  await page.waitForFunction(position => camera.position.distanceTo(new THREE.Vector3(...position)) > .01, position, { timeout: 10000 });
  assert.equal(await page.locator('#learning-scene').isVisible(), true, 'touch dragging the model retains its guide');
}

async function assertStopped(page, state, delay = 6000) {
  assert.equal(await page.locator('#learning-scene').isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('learning-observing')), false);
  await page.waitForTimeout(delay); // Exceeds camera arrival + the automatic after-state delay.
  assert.equal(await snapshot(page), state, 'a stale observation callback changed the simulation');
  assert.equal(await page.locator('#learning-scene').isVisible(), false);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // Keep the real scene and ordinary camera transitions: the companion suite tests modal content.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'no-preference', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__INGA && window.IngaProduct && document.querySelector('#loading.gone'), null, { timeout: 120000 });
    await page.locator('#skip').click();
    await page.waitForFunction(() => __INGA.mode === 'live');
    const cases = [[320, 568, 'sed'], [390, 844, 'one'], [844, 390, 'grid'], [1440, 900, 'sed']];
    const filter = process.env.INGA_LEARNING_SCENE_CASE;
    const selected = cases.filter(([width]) => !filter || String(width) === filter);
    assert.ok(selected.length || filter === 'lifecycle', `unknown scene case: ${filter}`);
    for (const [width, height, id] of selected) {
      await check(`real ${id} scene is usable at ${width}×${height}`, async () => {
        await page.setViewportSize({ width, height });
        await launch(page, id);
        // Hold the initial phase while inspecting the shot; this must also cancel deferred auto-advance.
        await sceneButton(page, 'before').click();
        const camera = await assertCamera(page, id);
        await assertRenderedPhase(page, id, 'before');
        const layout = await assertSceneLayout(page, width, height);
        assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'before');
        await page.screenshot({ path: `/tmp/inga-learning-scene-${width}-${id}.png` });
        await dragScene(page, layout.clear);
        await sceneButton(page, 'after').click();
        assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'after');
        await assertRenderedPhase(page, id, 'after');
        const changed = await page.evaluate(() => ({ canal: __INGA.S.canal, export: __INGA.S.exportLim, failed: __INGA.S.units.filter(u => u.failed).map(u => u.id) }));
        if (id === 'sed') assert.equal(changed.canal, 1600);
        if (id === 'one') assert.deepEqual(changed.failed, ['G24']);
        if (id === 'grid') assert.equal(changed.export, 900);
        await sceneButton(page, 'close').click();
        return { camera, freeCanvasSamples: `${layout.free}/${layout.total}`, guide: [Math.round(layout.width), Math.round(layout.height)] };
      });
    }

    if (!filter || filter === 'lifecycle') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await check('automatic observation applies the change after showing the reference', async () => {
        await launch(page);
        await page.waitForFunction(() => document.querySelector('#learning-scene').dataset.phase === 'after', null, { timeout: 30000 });
        assert.equal(await page.evaluate(() => __INGA.S.canal), 1600);
        await sceneButton(page, 'results').click();
        assert.equal(await page.locator('#learning-scene').isVisible(), false);
        assert.equal(await page.locator('.learning-comparison').isVisible(), true);
        await page.keyboard.press('Escape');
      });

      await check('manual Before cancels automatic After; Results applies the result before displaying it', async () => {
        await launch(page);
        await sceneButton(page, 'before').click();
        await assertCamera(page, 'sed');
        await page.waitForTimeout(3500);
        assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'before');
        assert.equal(await page.evaluate(() => __INGA.S.canal), 2200);
        await sceneButton(page, 'results').click();
        assert.equal(await page.evaluate(() => __INGA.S.canal), 1600);
        const displayed = await page.locator('.learning-results tbody tr').first().locator('td').last().textContent();
        assert.equal(Number(displayed.replace(/MW|\s/g, '')), Math.round(await page.evaluate(() => __INGA.R.Pgen)));
        await page.keyboard.press('Escape');
      });

      await check('closing observation preserves state and restores the prior panels', async () => {
        const panels = await page.evaluate(() => JSON.stringify(PANELS));
        await launch(page);
        const state = await snapshot(page);
        await sceneButton(page, 'close').click();
        await assertStopped(page, state);
        assert.equal(await page.evaluate(() => JSON.stringify(PANELS)), panels);
      });

      for (const action of ['preset', 'reset', 'tour', 'modal']) {
        await check(`${action} cancels observation without a late scenario change`, async () => {
          await launch(page);
          if (action === 'preset') await page.evaluate(() => __INGA.applyPreset('grid', { fly: false }));
          if (action === 'reset') await page.evaluate(() => __INGA.resetAll());
          if (action === 'tour') await page.evaluate(() => { NARR.on = false; __INGA.tour(0); });
          if (action === 'modal') await page.evaluate(() => document.querySelector('#openReg').click());
          const state = await snapshot(page);
          await assertStopped(page, state);
          if (action === 'tour') await page.locator('#tQuit').click();
          if (action === 'modal') { assert.equal(await page.locator('#reg').isVisible(), true); await page.keyboard.press('Escape'); }
        });
      }
    }
    await check('no JavaScript errors in real scene and lifecycle checks', async () => assert.deepEqual(errors, []));
  } finally { await browser.close(); }
  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
