/* An ideal transformer and a resistive AC line, explored at constant sent power. */
(() => {
  'use strict';
  const api = window.__INGA, app = document.getElementById('app');
  const physics = window.IngaTransformerModel, artist = window.IngaTransformerDrawing;
  if (!api || !app || !physics || !artist) return;
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
  const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const modal = document.createElement('div');
  modal.id = 'transformer-cut'; modal.className = 'modal canal-modal transformer-modal'; modal.hidden = true;
  modal.innerHTML = `<section class="mbox canal-box transformer-box" role="dialog" aria-modal="true" aria-labelledby="transformer-title">
    <header class="canal-header"><div><p>Les ouvrages à la loupe · 03</p><h2 id="transformer-title" tabindex="-1">Du transformateur à la ville</h2></div><div class="canal-header-actions"><button id="transformer-motion" type="button" aria-label="Mettre le dessin en pause" aria-pressed="false"></button><button type="button" class="canal-close" aria-label="Fermer le transformateur et la ligne">×</button></div></header>
    <div class="canal-body"><div class="canal-lab">
      <figure class="canal-figure"><div class="canal-plate"><canvas id="transformer-canvas" width="900" height="620" role="img" aria-describedby="transformer-explanation"></canvas></div><figcaption><span><i class="transformer-energy-dot"></i>Énergie transportée</span><span><i class="transformer-heat-dot"></i>Pertes en chaleur</span><span>Animation de principe</span></figcaption></figure>
      <div class="canal-console transformer-console">
        <div class="transformer-stats"><div><span>Courant de ligne</span><strong id="transformer-current"></strong><small>A</small></div><div><span>Pertes en chaleur</span><strong id="transformer-loss"></strong><small>MW</small></div><div><span>Reçu à l’arrivée</span><strong id="transformer-received"></strong><small>MW</small></div></div>
        <p class="transformer-intro"><strong>La même puissance. Moins de pertes.</strong>Changez la tension et observez le courant dans la ligne.</p>
        <div class="transformer-power"><span>Puissance envoyée</span><strong id="transformer-power"></strong><small id="transformer-power-origin">Exemple fixé pour la comparaison</small></div>
        <div class="canal-presets transformer-presets" role="group" aria-label="Comparer deux tensions"><button type="button" data-transformer-voltage="200" aria-pressed="true">200 kV<span>Situation de référence</span></button><button type="button" data-transformer-voltage="400" aria-pressed="false">400 kV<span>Tension doublée</span></button></div>
        <div class="transformer-voltage-label"><label for="transformer-voltage">Tension au départ de la ligne</label><output id="transformer-voltage-value" for="transformer-voltage">200 kV</output></div><input type="range" id="transformer-voltage" min="200" max="400" step="1" value="200" aria-describedby="transformer-scope">
        <button type="button" id="transformer-compare" class="canal-play" aria-pressed="false">Animer la comparaison 200 → 400 kV</button><p id="transformer-status" role="status" aria-live="polite">À vous de comparer.</p>
        <div class="transformer-loss-bars"><div><span>À 200 kV</span><b id="transformer-reference-loss"></b></div><div class="transformer-loss-track"><i id="transformer-reference-bar"></i></div><div><span id="transformer-current-voltage-label">À 200 kV</span><b id="transformer-compared-loss"></b></div><div class="transformer-loss-track"><i id="transformer-loss-bar"></i></div><small>Pertes en chaleur, à puissance envoyée identique.</small></div>
        <div class="canal-lesson"><span id="transformer-insight"></span><p id="transformer-why"></p></div>
        <div class="transformer-power-buttons" role="group" aria-label="Choisir la puissance de la comparaison"><button type="button" data-transformer-power="example" aria-pressed="true">Exemple 100 MW</button><button type="button" data-transformer-power="site" aria-pressed="false">Prendre la puissance du site</button></div>
        <div class="alternator-stages transformer-stages" role="group" aria-label="Suivre l’énergie"><button type="button" data-transformer-stage="transformer" aria-pressed="true"><span>01</span>Transformer</button><button type="button" data-transformer-stage="line" aria-pressed="false"><span>02</span>Transporter</button><button type="button" data-transformer-stage="city" aria-pressed="false"><span>03</span>Distribuer</button></div><p id="transformer-explanation" role="status" aria-live="polite"></p>
        <label class="transformer-field-label"><input type="checkbox" id="transformer-field" checked>Voir le flux magnétique dans le noyau</label>
        <p id="transformer-scope">Expérience pédagogique de courant alternatif. Les réglages et le bilan de la maquette restent inchangés.</p>
        <details class="canal-sources"><summary>Comprendre les chiffres et les hypothèses</summary><p>On compare une ligne triphasée équilibrée, purement résistive, à facteur de puissance égal à 1. La puissance envoyée reste fixe pendant la comparaison. « Prendre la puissance du site » en mémorise la valeur au moment du clic.</p><p>Tensions efficaces entre phases : 20 kV à l’entrée du transformateur idéal, puis 200 à 400 kV au départ de la ligne. Résistance totale choisie : 10 Ω pour chacun des trois conducteurs de phase. Ces valeurs définissent l’expérience ; elles ne décrivent pas un équipement réel d’Inga.</p><p>Avec P en watts, U en volts et I en ampères : I = P / (√3 × U) ; pertes = 3 × R × I² ; puissance reçue = puissance envoyée − pertes. La tension baisse aussi le long de la résistance.</p><p id="transformer-arrival"></p><p>Le transformateur idéal conserve la puissance : il élève la tension et réduit le courant. Le rapport de tension choisi correspond au rapport de spires pour un même couplage. Le dessin montre une phase et des bobines schématiques ; le fer reste fixe, le flux alterne. Le champ à vide est supposé établi et le courant magnétisant est négligé.</p><p>Réactance, pertes propres aux transformateurs, effet couronne, régulation et équipements de distribution ne sont pas calculés. Le curseur compare des configurations idéales ; ce n’est pas une commande d’un transformateur réel. Le petit poste d’arrivée rappelle l’abaissement nécessaire avant les bâtiments.</p><p>Repères historiques du projet : 2 × 220 kV vers Kinshasa [S01, 2011] ; ligne 400 kV annoncée dans [S04, 2016]. L’axe Inga–Kolwezi à ±500 kV est en courant continu : cette expérience ne le représente pas. Le bilan principal de la maquette conserve son hypothèse distincte de pertes.</p><button id="transformer-sources" type="button">Consulter les sources du projet</button></details>
      </div></div></div>
    <footer class="canal-footer"><span>Le transformateur élève la tension, pas la puissance.</span><div class="alternator-footer-actions"><button type="button" class="btn" id="transformer-alternator">Voir l’alternateur</button><button type="button" class="btn pri" id="transformer-return">Retour à la maquette</button></div></footer>
  </section>`;
  app.append(modal);
  const $ = selector => modal.querySelector(selector);
  const canvas = $('#transformer-canvas');
  const trigger = document.createElement('button');
  trigger.id = 'transformerBtn'; trigger.type = 'button'; trigger.textContent = 'Transformateur et transport';
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', modal.id);
  document.querySelector('.tools [aria-label="Outils"]')?.prepend(trigger);
  trigger.onclick = open;
  const next = document.createElement('button');
  next.id = 'alternator-transformer'; next.type = 'button'; next.className = 'btn'; next.textContent = 'Transformateur →';
  next.setAttribute('aria-label', 'Continuer vers le transformateur et la ligne');
  next.setAttribute('aria-haspopup', 'dialog'); next.setAttribute('aria-controls', modal.id);
  document.getElementById('alternator-return')?.before(next); next.onclick = open;
  const sync = () => window.syncAccessibility?.();
  const clamp = (value, a, b) => Math.max(a, Math.min(b, value));
  let active = false, raf = 0, previous = 0, phase = Math.PI / 2, paused = reduced.matches;
  let power = 100, voltage = 200, source = 'example', animation = null, lastRead = 0, focus = 'transformer';
  let result = physics.calculate(power, voltage);
  const explanations = {
    transformer: 'Deux bobines séparées entourent un noyau de fer fixe. Le flux magnétique alterne et induit une tension dans la seconde bobine. Le transformateur idéal transmet la même puissance.',
    line: 'Les conducteurs résistent au passage du courant et chauffent. À puissance envoyée égale, une tension plus élevée réduit le courant, puis les pertes en chaleur.',
    city: 'La puissance reçue est ce qui reste après les pertes de la ligne. Le poste d’arrivée abaisse ensuite la tension pour la distribution, avant d’autres adaptations jusqu’aux bâtiments.'
  };
  function write(selector, text) { const element = $(selector); if (element.textContent !== text) element.textContent = text; }
  function motionButton() {
    const button = $('#transformer-motion');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Reprendre l’animation du dessin' : 'Mettre le dessin en pause');
    button.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">${paused ? '<path d="m6 3 11 7-11 7Z" fill="currentColor"/>' : '<path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="3"/>'}</svg>`;
  }
  function draw() { if (active && !modal.hidden) artist.draw(canvas, { ...result, phase, focus, field: $('#transformer-field').checked }); }
  function update() {
    result = physics.calculate(power, voltage);
    if (!result || !active) return;
    write('#transformer-current', fmt.format(result.current));
    write('#transformer-loss', fmt.format(result.loss));
    write('#transformer-received', fmt.format(result.received));
    write('#transformer-power', `${fmt.format(power)} MW`);
    write('#transformer-power-origin', source === 'site' ? 'Puissance du site fixée au moment du clic' : 'Exemple fixé pour la comparaison');
    write('#transformer-voltage-value', `${whole.format(voltage)} kV`);
    $('#transformer-voltage').value = String(voltage);
    $('#transformer-voltage').setAttribute('aria-valuetext', `${whole.format(voltage)} kilovolts au départ, pour ${fmt.format(power)} mégawatts envoyés`);
    modal.querySelectorAll('[data-transformer-voltage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.transformerVoltage) === voltage)));
    modal.querySelectorAll('[data-transformer-power]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.transformerPower === source)));
    write('#transformer-reference-loss', `${fmt.format(result.referenceLoss)} MW`);
    write('#transformer-compared-loss', `${fmt.format(result.loss)} MW`);
    write('#transformer-current-voltage-label', `À ${whole.format(voltage)} kV`);
    $('#transformer-reference-bar').style.width = power > 0 ? '100%' : '0%';
    $('#transformer-loss-bar').style.width = result.referenceLoss > 0 ? `${result.loss / result.referenceLoss * 100}%` : '0%';
    write('#transformer-insight', power === 0 ? 'Aucune puissance n’est envoyée.' : voltage === 200 ? 'La référence : 200 kV.' : `${percent.format(result.savingPercent)} % de pertes en moins qu’à 200 kV.`);
    write('#transformer-why', power === 0 ? 'Le courant de charge et les pertes de ligne sont nuls. La tension et le flux du transformateur peuvent rester présents : ils sont supposés établis dans ce dessin.' : voltage === 400 ? 'La tension est doublée : le courant est divisé par deux et les pertes par quatre. La puissance envoyée reste la même.' : 'Augmentez la tension : le courant diminue. Les pertes dépendent du carré du courant, elles diminuent donc plus vite.');
    write('#transformer-arrival', `À ce réglage, la tension calculée à l’arrivée est d’environ ${fmt.format(result.receivingVoltage)} kV, avant le poste de distribution. Ce résultat appartient seulement à l’exemple résistif.`);
    canvas.setAttribute('aria-label', `Transformateur et ligne pédagogiques. ${fmt.format(power)} mégawatts envoyés à ${whole.format(voltage)} kilovolts ; courant ${fmt.format(result.current)} ampères ; ${fmt.format(result.loss)} mégawatts perdus en chaleur ; ${fmt.format(result.received)} mégawatts reçus à l’arrivée.`);
    draw();
  }
  function stopComparison(message) {
    animation = null;
    $('#transformer-compare').setAttribute('aria-pressed', 'false');
    $('#transformer-compare').textContent = 'Animer la comparaison 200 → 400 kV';
    if (message) write('#transformer-status', message);
  }
  function frame(now) {
    raf = 0;
    if (!active || modal.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0; previous = now;
    if (!paused) phase += dt * 1.4;
    if (animation) {
      const t = clamp((now - animation.start - 1000) / 6000, 0, 1);
      if (now - lastRead >= 100 || t === 1) {
        lastRead = now; voltage = Math.round(200 + 200 * t * t * (3 - 2 * t)); update();
      }
      if (t === 1) stopComparison(power > 0 ? 'Comparaison terminée : même puissance envoyée, pertes divisées par quatre.' : 'À puissance nulle, courant et pertes restent nuls.');
    }
    draw();
    if (!paused || animation) raf = requestAnimationFrame(frame);
  }
  function schedule() { if (active && !raf && (!paused || animation)) { previous = 0; raf = requestAnimationFrame(frame); } }
  function teardown() { active = false; animation = null; cancelAnimationFrame(raf); raf = 0; previous = 0; }
  function close() { teardown(); modal.hidden = true; sync(); }
  function open() {
    if (api.mode !== 'live') return false;
    if (document.getElementById('tourBtn')?.getAttribute('aria-pressed') === 'true') document.getElementById('tourBtn').click();
    window.IngaProduct?.dismiss(); window.IngaAlternator?.close(); window.IngaCanal?.close(); window.closeCut?.(); window.closeInfo?.();
    document.querySelectorAll('.modal:not([hidden])').forEach(other => { other.hidden = true; });
    teardown(); active = true; modal.hidden = false;
    power = 100; voltage = 200; source = 'example'; paused = reduced.matches; phase = Math.PI / 2; focus = 'transformer'; lastRead = 0;
    $('#transformer-field').checked = true;
    stopComparison('À vous de comparer. La puissance envoyée reste fixe.');
    setFocus(focus); motionButton(); update(); $('.transformer-console').scrollTop = 0;
    sync(); $('#transformer-title').focus({ preventScroll: true }); schedule();
    document.fonts?.ready.then(() => { if (active) draw(); });
    return true;
  }
  function setFocus(value) {
    focus = value;
    modal.querySelectorAll('[data-transformer-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.transformerStage === value)));
    write('#transformer-explanation', explanations[value]); draw();
  }
  modal.querySelectorAll('[data-transformer-stage]').forEach(button => button.onclick = () => setFocus(button.dataset.transformerStage));
  modal.querySelectorAll('[data-transformer-voltage]').forEach(button => button.onclick = () => {
    stopComparison('Vous comparez les tensions à puissance identique.'); voltage = Number(button.dataset.transformerVoltage); update();
  });
  $('#transformer-voltage').oninput = event => { stopComparison('Vous choisissez la tension de départ.'); voltage = Number(event.target.value); update(); };
  modal.querySelectorAll('[data-transformer-power]').forEach(button => button.onclick = () => {
    const candidate = button.dataset.transformerPower === 'site' ? api.R.Pgen : 100;
    if (!physics.calculate(candidate, voltage)) { write('#transformer-status', 'Cette puissance ne peut pas être utilisée dans cet exemple.'); return; }
    stopComparison('Puissance fixée pour la comparaison. La maquette garde ses réglages.');
    power = candidate; source = button.dataset.transformerPower; update();
  });
  $('#transformer-compare').onclick = () => {
    if (animation) { stopComparison('Comparaison arrêtée. Vous pouvez déplacer le curseur.'); return; }
    if (paused || reduced.matches) {
      voltage = 400; update(); stopComparison(power > 0 ? 'Comparaison appliquée : tension doublée, pertes divisées par quatre.' : 'À puissance nulle, courant et pertes restent nuls.'); return;
    }
    voltage = 200; update(); animation = { start: performance.now() }; lastRead = 0;
    $('#transformer-compare').setAttribute('aria-pressed', 'true');
    $('#transformer-compare').textContent = 'Arrêter la comparaison';
    write('#transformer-status', 'La tension augmente ; la puissance envoyée reste fixe.'); schedule();
  };
  $('#transformer-motion').onclick = () => {
    paused = !paused;
    if (paused) { stopComparison('Dessin en pause. Les commandes restent utilisables.'); cancelAnimationFrame(raf); raf = 0; }
    motionButton(); draw(); schedule();
  };
  $('#transformer-field').onchange = draw;
  $('.canal-close').onclick = close; $('#transformer-return').onclick = close;
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  $('#transformer-alternator').onclick = () => { close(); window.IngaAlternator?.open(); };
  $('#transformer-sources').onclick = () => { close(); window.openReg?.('srcs'); sync(); };
  reduced.addEventListener('change', () => {
    if (active && reduced.matches) { paused = true; stopComparison('Animation réduite selon les préférences de votre appareil.'); cancelAnimationFrame(raf); raf = 0; motionButton(); draw(); }
  });
  new MutationObserver(() => {
    if (!active) return;
    if (modal.hidden) { teardown(); sync(); }
    else if ([...document.querySelectorAll('.modal:not([hidden])')].some(other => other !== modal)) close();
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.IngaTransformer = { open, close, get state() { return { ...result, source }; } };
})();
