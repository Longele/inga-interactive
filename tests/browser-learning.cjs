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
  if (path.includes('musee=1') || path.includes('musee.html')) {
    // Museum startup is automatic; clicking an intro that is leaving races its six-second timer.
    await page.waitForFunction(() => __INGA.mode === 'live');
    return;
  }
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
  if (await page.locator('#learning-scene').isVisible()) await page.locator('[data-learning-scene="close"]').click();
  if (await page.locator('#learning').isVisible()) await page.locator('.learning-close').click();
  const mobile = page.locator('#mobile-learn');
  if (await mobile.count() && await mobile.isVisible()) await mobile.click();
  else await page.locator('#learningBtn').click();
  await page.locator('#learning').waitFor({ state: 'visible' });
}

async function assertStep(page, number) {
  const labels = ['Votre idée', 'Le résultat', 'Pourquoi'];
  const active = page.locator('.learning-steps [aria-current="step"]');
  assert.equal(await active.count(), 1, 'exactly one learning step is current');
  assert.ok((await active.textContent()).includes(labels[number - 1]), `expected step ${number}: ${labels[number - 1]}`);
}

async function compareValues(page) {
  const values = await page.evaluate(() => {
    const before = __INGA.simulate(JSON.parse(JSON.stringify(__INGA.BASE)));
    const after = __INGA.R;
    return { before: { Pgen: before.Pgen, Prec: before.Prec, Qdiv: before.Qdiv }, after: { Pgen: after.Pgen, Prec: after.Prec, Qdiv: after.Qdiv, bind: after.bind }, failed: __INGA.S.units.filter(u => u.failed).map(u => u.id) };
  });
  assert.equal(await page.locator('.learning-comparison').isVisible(), true, 'production comparison is visible without opening details');
  const visual = (await page.locator('.learning-comparison').textContent()).replace(/\s/g, '');
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  for (const power of [values.before.Pgen, values.after.Pgen]) {
    assert.ok(visual.includes(number.format(power).replace(/\s/g, '')), `visual comparison is missing ${power} MW`);
  }
  assert.equal(await page.locator('.learning-results').evaluate(el => !!el.closest('details')), true, 'full figures are available in disclosure details');
  // Read the DOM intentionally: the secondary table is collapsed until requested.
  const rows = await page.locator('.learning-results tbody tr').evaluateAll(items => items.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent)));
  assert.equal(rows.length, 3);
  for (const [i, key] of ['Pgen', 'Prec', 'Qdiv'].entries()) {
    assert.equal(numeric(rows[i][0]), Math.round(values.before[key]));
    assert.equal(numeric(rows[i][1]), Math.round(values.after[key]));
  }
  return values;
}

async function finishObservation(page) {
  assert.equal(await page.locator('#learning').isVisible(), false, 'launch leaves the modal to show the actual model');
  await page.locator('#learning-scene').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'before');
  assert.equal(await page.evaluate(() => document.body.classList.contains('learning-observing')), true);
  await page.locator('[data-learning-scene="after"]').click();
  assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'after');
  await page.locator('[data-learning-scene="results"]').click();
  assert.equal(await page.locator('#learning-scene').isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('learning-observing')), false);
  await page.locator('#learning').waitFor({ state: 'visible' });
}

async function predict(page, preset, answer) {
  await openLearning(page);
  const original = await page.evaluate(() => JSON.stringify(__INGA.S));
  await page.locator(`[data-learning-challenge="${preset}"]`).click();
  await assertStep(page, 1);
  assert.equal(await page.locator('#learning-test').isDisabled(), true, 'a guess is required for the test action');
  assert.equal(await page.locator('[name="prediction"]').count(), 3);
  assert.equal(await page.locator('[name="prediction"]:checked').count(), 0);
  assert.equal(await page.evaluate(() => JSON.stringify(__INGA.S)), original, 'choosing a challenge does not alter the simulation');
  if (answer) {
    const choice = page.locator(`[name="prediction"][value="${answer}"]`);
    await choice.focus();
    await page.keyboard.press('Space');
    assert.equal(await choice.isChecked(), true, 'native radio supports keyboard selection');
    assert.equal(await page.locator('#learning-test').isDisabled(), false);
    assert.equal(await page.evaluate(() => JSON.stringify(__INGA.S)), original, 'making a prediction does not alter the simulation');
    await page.locator('#learning-test').click();
  } else {
    const skip = page.locator('[data-learning="skip-prediction"]');
    assert.match(await skip.textContent(), /Je ne sais pas, montrez-moi/);
    await skip.click();
  }
  await finishObservation(page);
  await assertStep(page, 2);
  assert.equal(await page.locator('.learning-explanation').isVisible(), false, 'explanation is a separate third step');
  return compareValues(page);
}

async function explain(page) {
  await page.locator('[data-learning="explain"]').click();
  await assertStep(page, 3);
  assert.equal(await page.locator('.learning-explanation').isVisible(), true);
  assert.equal(await page.locator('.learning-cause li').count(), 3, 'explanation has three causal links');
}

async function assertPanelFits(page, width, height, screen, actionSelector) {
  const bounds = await page.locator('.learning-box').evaluate(el => {
    const rect = el.getBoundingClientRect(), close = el.querySelector('.learning-close').getBoundingClientRect(), body = el.querySelector('.learning-content');
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, closeTop: close.top, closeBottom: close.bottom, scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, contentHeight: body.clientHeight };
  });
  assert.ok(bounds.left >= -1 && bounds.right <= width + 1, `${screen}: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.top >= -1 && bounds.bottom <= height + 1, `${screen}: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.closeTop >= 0 && bounds.closeBottom <= height);
  assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1, `horizontal overflow: ${screen}: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.contentHeight > 90, `no usable scrolling content: ${JSON.stringify(bounds)}`);
  if (actionSelector) {
    const action = page.locator(actionSelector);
    await action.scrollIntoViewIfNeeded();
    const rect = await action.boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= height + 1,
      `unreachable ${screen} action: ${JSON.stringify(rect)}`);
    assert.equal(await action.evaluate(el => {
      const rect = el.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return !!hit && (el === hit || el.contains(hit));
    }), true, `${screen} action is covered by another element`);
  }
  if (width === 320 && ['hub', 'prediction', 'result', 'explanation'].includes(screen)) {
    await page.locator('.learning-content').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `/tmp/inga-learning-${screen}-${width}.png` });
  }
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

    await check('wrong prediction uses reference values without changing the simulation before the test', async () => {
      // Begin from a different state; this challenge must compare against the declared reference.
      await page.evaluate(() => __INGA.applyPreset('multi', { fly: false }));
      const values = await predict(page, 'sed', 'near');
      assert.ok(values.after.Pgen < values.before.Pgen * 0.95);
      assert.ok(values.after.Qdiv < values.before.Qdiv);
      assert.equal(values.after.bind, 'canal');
      const verdict = await page.locator('.learning-verdict').textContent();
      assert.match(verdict, /Vous aviez choisi/);
      assert.match(verdict, /Le résultat est différent/);
      assert.doesNotMatch(verdict, /Votre réponse est correcte/);
      // Closing during the comparison must not mark the challenge as understood.
      await page.keyboard.press('Escape');
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /0 sur 3/);
      assert.equal(await page.locator('[data-learning="resume"]').isVisible(), true);
      await page.locator('[data-learning="resume"]').click();
      await assertStep(page, 2);
      assert.equal(await page.locator('.learning-verdict').textContent(), verdict);
      await compareValues(page);
      await explain(page);
      return values;
    });

    await check('comparison details are reachable by Tab and toggle with Enter', async () => {
      await page.locator('[data-learning="compare"]').click();
      await assertStep(page, 2);
      const details = page.locator('details').filter({ has: page.locator('.learning-results') });
      const summary = details.locator('summary');
      assert.equal(await details.evaluate(el => el.open), false, 'secondary numbers start collapsed');
      // Begin at the first modal control and use actual sequential keyboard navigation.
      await page.locator('.learning-close').focus();
      let reached = false;
      const limit = await page.locator('#learning button, #learning input, #learning summary, #learning a[href]').count() + 3;
      for (let n = 0; n < limit; n++) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => !!document.activeElement.closest('#learning')), true);
        if (await summary.evaluate(el => document.activeElement === el)) { reached = true; break; }
      }
      assert.equal(reached, true, 'Tab reaches the native details summary');
      await page.keyboard.press('Enter');
      assert.equal(await details.evaluate(el => el.open), true);
      assert.equal(await page.locator('.learning-results').isVisible(), true);
      assert.equal(await summary.evaluate(el => document.activeElement === el), true);
      await page.keyboard.press('Enter');
      assert.equal(await details.evaluate(el => el.open), false);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.learning), 'retry', 'Tab continues past summary instead of restarting the modal');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await summary.evaluate(el => document.activeElement === el), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.learning), 'observe', 'reverse tab order passes through summary');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.learning), 'explain');
      await explain(page);
    });

    await check('resume retains the explanation, compare returns to the result, and retry clears the guess', async () => {
      await page.keyboard.press('Escape');
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /1 sur 3/);
      await page.locator('[data-learning="resume"]').click();
      await assertStep(page, 3);
      await page.locator('[data-learning="compare"]').click();
      await assertStep(page, 2);
      await compareValues(page);
      await explain(page);
      const original = await page.evaluate(() => JSON.stringify(__INGA.S));
      await page.locator('[data-learning="compare"]').click();
      await assertStep(page, 2);
      await page.locator('[data-learning="retry"]').click();
      await assertStep(page, 1);
      assert.match(await page.locator('#learning-title').textContent(), /canal/i);
      assert.equal(await page.locator('[name="prediction"]:checked').count(), 0);
      assert.equal(await page.locator('#learning-test').isDisabled(), true);
      assert.equal(await page.evaluate(() => JSON.stringify(__INGA.S)), original);
      await page.locator('[name="prediction"][value="down"]').check();
      await page.locator('#learning-test').click();
      await finishObservation(page);
      assert.match(await page.locator('.learning-verdict').textContent(), /Votre réponse est correcte/);
      await explain(page);
      await page.locator('[data-learning="observe"]').click();
      assert.equal(await page.locator('#learning').isVisible(), false);
      assert.equal(await page.locator('#learning-scene').isVisible(), true);
      assert.equal(await page.locator('#learning-scene').getAttribute('data-phase'), 'after');
      assert.equal(await page.locator('[data-p="sed"]').getAttribute('aria-pressed'), 'true');
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /1 sur 3/, 'retry does not count twice');
      await page.keyboard.press('Escape');
    });

    await check('correct one-group prediction explains the small water-limited change', async () => {
      const values = await predict(page, 'one', 'near');
      assert.deepEqual(values.failed, ['G24']);
      assert.ok(Math.abs(values.after.Pgen - values.before.Pgen) / values.before.Pgen < 0.05);
      assert.ok(Math.abs(values.after.Qdiv - values.before.Qdiv) < 0.01);
      const verdict = await page.locator('.learning-verdict').textContent();
      assert.match(verdict, /Vous aviez choisi/);
      assert.match(verdict, /Votre réponse est correcte/);
      await explain(page);
      assert.match(await page.locator('.learning-explanation').textContent(), /répartition/);
      await page.locator('[data-learning="next"]').click();
      await assertStep(page, 1);
      assert.match(await page.locator('#learning-title').textContent(), /réseau/i);
      await page.keyboard.press('Escape');
      return values;
    });

    await check('skip prediction teaches the network limit without grading an unanswered question', async () => {
      const values = await predict(page, 'grid', null);
      const verdict = await page.locator('.learning-verdict').textContent();
      assert.match(verdict, /Vous avez choisi de découvrir sans répondre/);
      assert.doesNotMatch(verdict, /Votre réponse est correcte|Le résultat est différent/);
      assert.equal(values.after.bind, 'export');
      assert.ok(Math.abs(values.after.Pgen - 900) < 0.01);
      assert.ok(Math.abs(values.after.Prec - 855) < 0.01);
      assert.ok(values.after.Qdiv < values.before.Qdiv);
      await page.keyboard.press('Escape');
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /2 sur 3/);
      await page.locator('[data-learning="resume"]').click();
      await assertStep(page, 2);
      await explain(page);
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
      await check(`three learning steps fit ${width}×${height} with reachable actions`, async () => {
        await page.setViewportSize({ width, height });
        await openLearning(page);
        await assertPanelFits(page, width, height, 'hub', '[data-learning-challenge="sed"]');
        await page.locator('[data-learning-challenge="sed"]').click();
        await assertStep(page, 1);
        await assertPanelFits(page, width, height, 'prediction', '[data-learning="skip-prediction"]');
        await page.locator('[name="prediction"][value="down"]').check();
        await assertPanelFits(page, width, height, 'prediction', '#learning-test');
        await page.locator('#learning-test').click();
        await finishObservation(page);
        await assertStep(page, 2);
        await assertPanelFits(page, width, height, 'result', '[data-learning="explain"]');
        await explain(page);
        await assertPanelFits(page, width, height, 'explanation', '[data-learning="observe"]');
        await assertPanelFits(page, width, height, 'explanation', '[data-learning="next"]');
        await page.locator('[data-learning="glossary"]').click();
        await assertPanelFits(page, width, height, 'glossary', '[data-learning="back"]');
        await page.locator('[data-learning="back"]').click();
        await assertStep(page, 3);
        await page.locator('.learning-close').click();
      });
    }

    await check('reset clears session progress and museum completion leaves the exhibit free', async () => {
      await page.evaluate(() => __INGA.resetAll());
      await openLearning(page);
      assert.match(await page.locator('.learning-progress').textContent(), /0 sur 3/);
      assert.equal(await page.locator('[data-learning="resume"]').count(), 0, 'reset discards the previous result');
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
