const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = (process.env.INGA_TEST_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const cases = [
  { file: 'index.html', width: 320, height: 568 },
  { file: 'index.html', width: 390, height: 844, cancellation: true },
  { file: 'index.html', width: 844, height: 390 },
  { file: 'index.html', width: 900, height: 700 },
  { file: 'index.html', width: 1440, height: 900, motion: 'no-preference' },
  { file: 'musee.html', width: 390, height: 844 }
];
const report = [];

async function bounds(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      width: r.width, height: r.height, viewport: [innerWidth, innerHeight] };
  });
}

function inViewport(rect, name) {
  assert.ok(rect.width > 0 && rect.height > 0, `${name} has no visible size`);
  assert.ok(rect.left >= -1 && rect.right <= rect.viewport[0] + 1,
    `${name} exceeds viewport width: ${JSON.stringify(rect)}`);
  assert.ok(rect.top >= -1 && rect.bottom <= rect.viewport[1] + 1,
    `${name} exceeds viewport height: ${JSON.stringify(rect)}`);
}

async function step(page, number) {
  await page.waitForFunction(n => document.querySelector('#tour-k').textContent.startsWith(`${n} / `), number);
}

async function pause(page) {
  if ((await page.locator('#tPlay').textContent()).trim() === 'Pause') {
    await page.locator('#tPlay').click();
  }
}

async function assertRestored(page) {
  await page.waitForSelector('#cut[hidden]', { state: 'attached' });
  assert.equal(await page.locator('#tour').evaluate(el => el.parentElement.id), 'app');
  assert.equal(await page.locator('#tour').evaluate(el => !!el.closest('[inert]')),
    await page.locator('#tour').evaluate(el => el.hidden), 'restored tour is interactive only while visible');
}

async function inspectPopup(page) {
  // Do not open the cutaway directly: the step must open it automatically.
  await page.waitForSelector('#cut:not([hidden])', { timeout: 15000 });
  assert.match(await page.locator('#cut-h').textContent(), /groupe Francis/i);
  assert.equal(await page.locator('#cut #tour').count(), 1,
    'tour controls must remain available inside the modal');
  inViewport(await bounds(page, '#cut .mbox'), 'cutaway dialog');
  inViewport(await bounds(page, '#tour'), 'tour footer');
  for (const id of ['tPrev', 'tPlay', 'tSnd', 'tNext', 'tQuit']) {
    const control = page.locator('#' + id);
    assert.equal(await control.isVisible(), true, `${id} is hidden`);
    assert.equal(await control.isEnabled(), true, `${id} is disabled`);
    assert.equal(await control.evaluate(el => !!el.closest('[inert]')), false, `${id} is inert`);
    inViewport(await bounds(page, '#' + id), id);
  }

  const canvas = await bounds(page, '#cutc');
  const body = await bounds(page, '#cut .mbody');
  inViewport(body, 'cutaway scroll area');
  assert.ok(canvas.width >= 160 && canvas.height >= 110,
    `cutaway drawing is too small: ${JSON.stringify(canvas)}`);
  const visibleHeight = Math.min(canvas.bottom, body.bottom) - Math.max(canvas.top, body.top);
  assert.ok(visibleHeight >= 110,
    `cutaway drawing has only ${visibleHeight}px visible above the tour controls`);
  assert.ok(canvas.left >= -1 && canvas.right <= canvas.viewport[0] + 1,
    'cutaway drawing overflows horizontally');

  // Scientific details can scroll without taking Next/Quit out of view.
  const footerBefore = await bounds(page, '#tour');
  const scrolling = await page.locator('#cut .mbody').evaluate(el => {
    el.scrollTop = el.scrollHeight;
    return { top: el.scrollTop, scroll: el.scrollHeight, client: el.clientHeight };
  });
  if (scrolling.scroll > scrolling.client + 1) assert.ok(scrolling.top > 0, 'cutaway body cannot scroll');
  const footerAfter = await bounds(page, '#tour');
  assert.ok(Math.abs(footerAfter.top - footerBefore.top) < 1, 'scrolling moves the tour controls');
  inViewport(footerAfter, 'tour footer after scrolling');
  await page.locator('#cut .mbody').evaluate(el => { el.scrollTop = 0; });
  return { canvas: [Math.round(canvas.width), Math.round(canvas.height)], visibleHeight: Math.round(visibleHeight) };
}

async function assertNoLatePopup(page, leave) {
  await page.evaluate(() => {
    window.__cutawayOpens = 0;
    window.__cutawayObserver = new MutationObserver(records => {
      if (records.some(r => r.attributeName === 'hidden') && !document.querySelector('#cut').hidden) {
        window.__cutawayOpens++;
      }
    });
    window.__cutawayObserver.observe(document.querySelector('#cut'), { attributes: true, attributeFilter: ['hidden'] });
  });
  // Jump only to the preceding stop; exercise the actual Next handler for step 6.
  await page.evaluate(() => __INGA.tour(4));
  await pause(page);
  await page.locator('#tNext').click();
  await step(page, 6);
  await page.locator(leave).click();
  await page.waitForTimeout(3300); // Exceeds the automatic cutaway delay (2700 ms).
  assert.equal(await page.locator('#cut').isVisible(), false, `late popup after ${leave}`);
  const opens = await page.evaluate(() => {
    window.__cutawayObserver.disconnect();
    return window.__cutawayOpens;
  });
  assert.equal(opens, 0, `cutaway opened after leaving step 6 with ${leave}`);
  await assertRestored(page);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const selectedCases = cases.filter(test => !process.env.INGA_CUTAWAY_CASE || `${test.file}:${test.width}`.includes(process.env.INGA_CUTAWAY_CASE));
    assert.ok(selectedCases.length, 'No cutaway cases selected');
    for (const test of selectedCases) {
      const name = `${test.file}: guided cutaway at ${test.width}×${test.height}`;
      const context = await browser.newContext({
        viewport: { width: test.width, height: test.height },
        isMobile: test.width < 900, hasTouch: test.width < 900,
        reducedMotion: test.motion || 'reduce', serviceWorkers: 'block'
      });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/${test.file}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__INGA && document.querySelector('#loading').classList.contains('gone'));
        // Keep the live tour/camera loop and 2D cutaway drawing; its modal layout
        // does not depend on repeatedly drawing the software-rendered terrain.
        // The UX suite separately exercises the real WebGL render path.
        await page.evaluate(() => { renderer.render = () => {}; });
        if (test.file === 'musee.html') {
          // Kiosk mode leaves the introduction automatically; start from its live controls.
          await page.waitForFunction(() => __INGA.mode === 'live');
          if (await page.locator('#tour').evaluate(el => el.hidden)) await page.locator('#tourBtn').click();
        } else {
          await page.locator('#goTour').click();
        }
        await page.waitForSelector('#tour:not([hidden])');
        await step(page, 1);
        if (await page.locator('#tSnd').getAttribute('aria-pressed') === 'true') await page.locator('#tSnd').click();
        await pause(page); // Keep the assertions independent of narration duration and automatic advancement.
        for (let n = 2; n <= 6; n++) {
          await page.locator('#tNext').click();
          await step(page, n);
        }
        const detail = await inspectPopup(page);
        await page.screenshot({ path: `/tmp/inga-cutaway-${test.file.replace('.html', '')}-${test.width}.png` });

        await page.locator('#tNext').click();
        await step(page, 7);
        await assertRestored(page);
        await page.locator('#tPrev').click();
        await step(page, 6);
        await inspectPopup(page);
        await page.locator('#tQuit').click();
        await assertRestored(page);
        assert.equal(await page.locator('#tour').isVisible(), false);
        assert.equal(await page.locator('#tourBtn').getAttribute('aria-pressed'), 'false');

        if (test.cancellation) {
          await assertNoLatePopup(page, '#tNext');
          await step(page, 7);
          await page.locator('#tQuit').click();
          await assertNoLatePopup(page, '#tQuit');
          assert.equal(await page.locator('#tour').isVisible(), false);
          await page.evaluate(() => __INGA.tour(5));
          await pause(page);
          await page.waitForSelector('#cut:not([hidden])');
          await page.keyboard.press('Escape');
          await assertRestored(page);
          assert.equal(await page.evaluate(() => !!document.activeElement.closest('#tour')), true);

          await page.locator('#tPrev').click();
          await page.locator('#tNext').click();
          await page.waitForSelector('#cut:not([hidden])');
          await page.locator('#tPlay').click();
          // Exercise automatic advance without waiting for the entire narrated stop.
          await page.evaluate(() => { TOUR.t = TOUR_STOPS[5].dur; });
          await step(page, 7);
          await assertRestored(page);
          await page.locator('#tQuit').click();

          await page.evaluate(() => __INGA.selectUnit('G24', true));
          await page.waitForSelector('#cut:not([hidden])');
          assert.equal(await page.locator('#cut #tour').count(), 0, 'free exploration has no tour footer');
          await page.locator('#cut .x').click();
          assert.equal(await page.locator('#cut').isVisible(), false);
          assert.equal(await page.evaluate(() => __INGA.runValidation().every(r => r.ok)), true);

        }
        assert.deepEqual(errors, [], 'unexpected browser errors');
        report.push({ name, ok: true, detail });
        console.log('PASS', name, JSON.stringify(detail));
      } catch (error) {
        report.push({ name, ok: false, error: error.message });
        console.error('FAIL', name, error.stack);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ passed: report.filter(r => r.ok).length, total: report.length, results: report }, null, 2));
  if (report.some(r => !r.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
