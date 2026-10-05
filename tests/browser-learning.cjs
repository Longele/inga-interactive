const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INGA_TEST_URL || 'http://127.0.0.1:8001';
const errors = [];
const report = [];
const numeric = text => Number(text.replace(/MW|m³\/s/g, '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));

async function check(name, fn) {
  try { const detail = await fn(); report.push({ name, ok: true, detail }); console.log('PASS', name, detail ? JSON.stringify(detail) : ''); }
  catch (error) { report.push({ name, ok: false, detail: error.message }); console.error('FAIL', name, error.stack); }
}

async function ready(page, path = '/index.html', inspectIntro = false) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__INGA && window.IngaProduct && document.querySelector('#loading').classList.contains('gone'));
  // This suite checks the learning UI; the cutaway/UX suites check the rendered scene.
  // Avoid software-GPU redraw contention while exercising DOM focus and layout.
  await page.evaluate(() => { if (typeof renderer !== 'undefined' && renderer) renderer.render = () => {}; });
  if (await page.evaluate(() => __INGA.mode !== 'live')) {
    if (inspectIntro) {
      await page.waitForFunction(() => !document.querySelector('#intro').classList.contains('gone'));
      for (const [width, height] of [[320, 568], [844, 390]]) {
        await page.setViewportSize({ width, height });
        for (const id of ['goTour', 'skip', 'go']) {
          const action = page.locator('#' + id);
          await action.scrollIntoViewIfNeeded();
          const rect = await action.boundingBox();
          assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= height + 1, `introduction action ${id}: ${JSON.stringify(rect)}`);
        }
        await page.locator('#intro').evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: `/tmp/inga-learning-intro-${width}.png` });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    // Enter through the visitor-facing action. Museum mode can already have entered by itself.
    await page.locator('#skip').click();
    await page.waitForFunction(() => __INGA.mode === 'live');
  }
}

async function openLearning(page) {
  if (await page.locator('#learning').isVisible()) await page.locator('.learning-close').click();
  const mobile = page.locator('#mobile-learn');
  if (await mobile.count() && await mobile.isVisible()) await mobile.click();
  else await page.locator('#learningBtn').click();
  await page.locator('#learning').waitFor({ state: 'visible' });
}

async function compare(page, preset, answer) {
  await openLearning(page);
  await page.locator(`[data-learning-challenge="${preset}"]`).click();
  assert.equal(await page.locator('#learning-test').isDisabled(), true, 'prediction precedes the experiment');
  await page.locator(`[name="prediction"][value="${answer}"]`).check();
  await page.locator('#learning-test').click();
  const values = await page.evaluate(() => {
    const before = __INGA.simulate(JSON.parse(JSON.stringify(__INGA.BASE)));
    const after = __INGA.R;
    return { before: { Pgen: before.Pgen, Prec: before.Prec, Qdiv: before.Qdiv }, after: { Pgen: after.Pgen, Prec: after.Prec, Qdiv: after.Qdiv, bind: after.bind }, failed: __INGA.S.units.filter(u => u.failed).map(u => u.id) };
  });
  const rows = await page.locator('.learning-results tbody tr').evaluateAll(items => items.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent)));
  for (const [i, key] of ['Pgen', 'Prec', 'Qdiv'].entries()) {
    assert.equal(numeric(rows[i][0]), Math.round(values.before[key]));
    assert.equal(numeric(rows[i][1]), Math.round(values.after[key]));
  }
  return values;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await ready(page, '/index.html', true);

    await check('canal challenge calculates an actual loss and explains a changed prediction', async () => {
      // Begin from another scenario: the challenge must still explicitly compare with the reference.
      await page.evaluate(() => __INGA.applyPreset('multi', { fly: false }));
      const values = await compare(page, 'sed', 'near');
      assert.ok(values.after.Pgen < values.before.Pgen * 0.95);
      assert.ok(values.after.Qdiv < values.before.Qdiv);
      assert.equal(values.after.bind, 'canal');
      assert.match(await page.locator('.learning-verdict').textContent(), /autre résultat/);
      await page.locator('[data-learning="observe"]').click();
      assert.equal(await page.locator('#learning').isVisible(), false);
      assert.equal(await page.locator('[data-p="sed"]').getAttribute('aria-pressed'), 'true');
      return values;
    });

    await check('one-group challenge explains the small water-limited change', async () => {
      const values = await compare(page, 'one', 'near');
      assert.deepEqual(values.failed, ['G24']);
      assert.ok(Math.abs(values.after.Pgen - values.before.Pgen) / values.before.Pgen < 0.05);
      assert.ok(Math.abs(values.after.Qdiv - values.before.Qdiv) < 0.01);
      assert.match(await page.locator('.learning-verdict').textContent(), /correspond/);
      assert.match(await page.locator('.learning-explanation').textContent(), /répartition/);
      await page.keyboard.press('Escape');
      return values;
    });

    await check('network challenge distinguishes generated and delivered power', async () => {
      const values = await compare(page, 'grid', 'down');
      assert.equal(values.after.bind, 'export');
      assert.ok(Math.abs(values.after.Pgen - 900) < 0.01);
      assert.ok(Math.abs(values.after.Prec - 855) < 0.01);
      assert.ok(values.after.Qdiv < values.before.Qdiv);
      await page.locator('[data-learning="next"]').click();
      assert.match(await page.locator('.learning-progress').textContent(), /3 sur 3/);
      await page.keyboard.press('Escape');
      return values;
    });

    await check('learning dialog contains focus, searches accented words, and restores its trigger', async () => {
      await openLearning(page);
      await page.locator('[data-learning="glossary"]').click();
      await page.locator('#learning-search').fill('debit');
      const terms = await page.locator('.learning-glossary > div:not([hidden]) dt').allTextContents();
      assert.ok(terms.length > 0); assert.ok(terms.includes('Débit · m³/s'));
      await page.locator('#learning-search').fill('zzzzzzzz');
      assert.match(await page.locator('#learning-found').textContent(), /Aucune définition/);
      for (const key of [...Array(10).fill('Tab'), ...Array(10).fill('Shift+Tab')]) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('#learning')), true);
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#learning').isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'learningBtn');
      return { terms };
    });

    await check('tour completion shows recap; quitting does not', async () => {
      await page.evaluate(() => __INGA.tour(7));
      await page.locator('#tQuit').click();
      assert.equal(await page.locator('#learning').isVisible(), false);
      await page.evaluate(() => __INGA.tour(7));
      await page.locator('#tNext').click();
      await page.locator('.learning-recap').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.learning-recap li').count(), 3);
      await page.locator('[data-learning="explore"]').click();
      assert.equal(await page.locator('#learning').isVisible(), false);
    });

    for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
      await check(`learning panels fit ${width}×${height} and keep close reachable`, async () => {
        await page.setViewportSize({ width, height });
        await openLearning(page);
        for (const screen of ['hub', 'prediction', 'result', 'glossary']) {
          if (screen === 'prediction') await page.locator('[data-learning-challenge="sed"]').click();
          if (screen === 'result') { await page.locator('[name="prediction"][value="down"]').check(); await page.locator('#learning-test').click(); }
          if (screen === 'glossary') await page.locator('[data-learning="glossary"]').click();
          const bounds = await page.locator('.learning-box').evaluate(el => {
            const rect = el.getBoundingClientRect(), close = el.querySelector('.learning-close').getBoundingClientRect(), body = el.querySelector('.learning-content');
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, closeTop: close.top, closeBottom: close.bottom, scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, contentHeight: body.clientHeight };
          });
          assert.ok(bounds.left >= -1 && bounds.right <= width + 1, `${screen}: ${JSON.stringify(bounds)}`);
          assert.ok(bounds.top >= -1 && bounds.bottom <= height + 1, `${screen}: ${JSON.stringify(bounds)}`);
          assert.ok(bounds.closeTop >= 0 && bounds.closeBottom <= height);
          assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1, `horizontal overflow: ${screen}: ${JSON.stringify(bounds)}`);
          assert.ok(bounds.contentHeight > 90, `no usable scrolling content: ${JSON.stringify(bounds)}`);
          if (width === 320 && ['hub', 'result'].includes(screen)) await page.screenshot({ path: `/tmp/inga-learning-${screen}-${width}.png` });
        }
        await page.screenshot({ path: `/tmp/inga-learning-${width}.png` });
        await page.locator('.learning-close').click();
      });
    }

    await check('reset clears session progress and museum completion leaves the exhibit free', async () => {
      await page.evaluate(() => __INGA.resetAll());
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /0 sur 3/);
      await page.keyboard.press('Escape');
      await ready(page, '/index.html?musee=1');
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('inga:tour-complete')));
      assert.equal(await page.locator('#learning').isVisible(), false);
    });

    await check('no browser JavaScript errors', async () => assert.deepEqual(errors, []));
  } finally { await browser.close(); }
  console.log(JSON.stringify(report, null, 2));
  if (report.some(item => !item.ok)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
