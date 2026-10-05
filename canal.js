/* A live canal cutaway: the same model as the site, drawn like the Francis plate. */
(() => {
  'use strict';
  const api = window.__INGA;
  const app = document.getElementById('app');
  if (!api || !app || !window.IngaCanalDrawing) return;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const clone = value => JSON.parse(JSON.stringify(value));
  const modal = document.createElement('div');
  modal.id = 'canal-cut';
  modal.className = 'modal canal-modal';
  modal.hidden = true;
  modal.innerHTML = `<section class="mbox canal-box" role="dialog" aria-modal="true" aria-labelledby="canal-title">
    <header class="canal-header"><div><p>Les ouvrages à la loupe · 01</p><h2 id="canal-title" tabindex="-1">Le canal, vu de l’intérieur</h2></div><button type="button" class="canal-close" aria-label="Fermer la coupe du canal">×</button></header>
    <div class="canal-body"><div class="canal-lab">
      <figure class="canal-figure"><div class="canal-plate"><canvas id="canal-canvas" width="900" height="620" role="img" aria-label="Coupe schématique du canal. L’eau traverse le passage libre au-dessus des dépôts de sable." aria-describedby="canal-why"></canvas><button id="canal-motion" type="button" aria-pressed="false" aria-label="Mettre le dessin en pause">Ⅱ</button></div><figcaption><span><i class="canal-water-dot"></i>Eau en circulation</span><span><i class="canal-sand-dot"></i>Dépôts illustratifs</span><span>Coupe non à l’échelle</span></figcaption></figure>
      <div class="canal-console"><p class="canal-invitation">Et si le sable prenait la place de l’eau ?</p><p class="canal-intro">Déplacez le curseur. Observez le passage se réduire et l’effet sur les centrales.</p>
        <div class="canal-presets" role="group" aria-label="État du canal"><button type="button" data-canal-preset="clear" aria-pressed="false">Dégagé<span>2 200 m³/s</span></button><button type="button" data-canal-preset="sed" aria-pressed="false">Ensablé<span>1 600 m³/s</span></button></div>
        <div class="canal-slider"><div><label for="canal-sediment">Dépôts de sable</label><output id="canal-sediment-value" for="canal-sediment">0 %</output></div><input id="canal-sediment" type="range" min="0" max="100" step="1" value="0" aria-describedby="canal-slider-note canal-range-note"><div class="canal-slider-ends"><span>Moins de sable</span><span>Plus de sable</span></div><p id="canal-slider-note">Quantité illustrative, pas une mesure du canal réel.</p></div>
        <p id="canal-range-note" hidden></p>
        <button type="button" id="canal-play" class="canal-play">Animer l’ensablement <span aria-hidden="true">→</span></button><p id="canal-animation" role="status" aria-live="polite">À vous de jouer</p>
        <div class="canal-measures"><div><span>Eau vers les turbines</span><strong id="canal-flow"></strong><div class="canal-meter"><i id="canal-flow-bar"></i></div><small>Capacité du canal : <b id="canal-capacity"></b></small></div><div><span>Électricité produite</span><strong id="canal-power"></strong><div class="canal-meter canal-meter-power"><i id="canal-power-bar"></i></div><small>Canal dégagé : <b id="canal-reference-power"></b></small></div></div>
        <div class="canal-lesson"><span id="canal-impact"></span><p id="canal-why"></p></div>
        <details class="canal-sources"><summary>Comprendre les chiffres et le dessin</summary><p>Seule la capacité du canal change. Le fleuve, les groupes, la demande et le réseau conservent vos réglages. Les chiffres viennent du simulateur ; ils ne décrivent pas la production réelle du site.</p><p>2 200 m³/s : valeur du plan historique SNEL cité dans le rapport Banque mondiale PMEDE de 2011 [S01]. 1 600 m³/s : scénario pédagogique d’ensablement. Les autres positions du curseur interpolent ces deux situations.</p><p>Forme et volume des dépôts, niveau d’eau et trajectoires sont schématiques. L’animation explique une réduction de capacité ; elle ne calcule ni la sédimentation réelle ni la vitesse hydraulique.</p><button type="button" id="canal-sources-button">Consulter les sources du projet</button></details>
      </div></div></div>
    <footer class="canal-footer"><span>Vos réglages sont conservés en revenant au site.</span><button type="button" class="btn pri" id="canal-return">Retour à la maquette</button></footer>
  </section>`;
  app.append(modal);
  const $ = selector => modal.querySelector(selector);
  const canvas = $('#canal-canvas');
  const slider = $('#canal-sediment');
  const headerActions = document.createElement('div');
  headerActions.className = 'canal-header-actions';
  headerActions.append($('#canal-motion'), $('.canal-close'));
  $('.canal-header').append(headerActions);
  let active = false, raf = 0, previous = 0, seconds = 0;
  let ownedChange = 0, animation = null, drawnSediment = 0, targetSediment = 0;
  let paused = motionPreference.matches, reference = null;
  let lastCommit = 0;
  const trigger = document.createElement('button');
  trigger.id = 'canalBtn';
  trigger.type = 'button';
  trigger.textContent = 'Coupe du canal';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', modal.id);
  document.querySelector('.tools [aria-label="Outils"]')?.prepend(trigger);
  trigger.onclick = open;
  const sync = () => window.syncAccessibility?.();

  function write(selector, value) {
    const el = $(selector);
    if (el.textContent !== value) el.textContent = value;
  }

  function stopAnimation(message) {
    animation = null;
    if (message) write('#canal-animation', message);
    updatePlayButton();
  }

  function updatePlayButton() {
    $('#canal-play').textContent = animation ? 'Arrêter la transformation' : targetSediment >= .5 ? 'Animer le nettoyage →' : 'Animer l’ensablement →';
    $('#canal-play').setAttribute('aria-pressed', String(!!animation));
  }

  function setCapacity(capacity) {
    ownedChange += 1;
    try { api.setCanalCapacity(Math.round(capacity)); }
    finally { ownedChange -= 1; }
    updateReadouts();
  }

  function updateReadouts() {
    if (!active) return;
    const { S: state, R: result } = api;
    const referenceState = clone(state);
    referenceState.canal = 2200;
    reference = api.simulate(referenceState);
    const inRange = state.canal >= 1600 && state.canal <= 2200;
    targetSediment = clamp((2200 - state.canal) / 600, 0, 1);
    slider.value = String(Math.round(targetSediment * 100));
    slider.disabled = !inRange;
    slider.setAttribute('aria-describedby', inRange ? 'canal-slider-note' : 'canal-slider-note canal-range-note');
    slider.setAttribute('aria-valuetext', `${fmt.format(targetSediment * 100)} % de dépôts illustratifs, capacité ${fmt.format(state.canal)} mètres cubes par seconde`);
    write('#canal-sediment-value', inRange ? `${fmt.format(targetSediment * 100)} %` : 'Autre réglage');
    $('#canal-range-note').hidden = inRange;
    write('#canal-range-note', `Votre canal est réglé à ${fmt.format(state.canal)} m³/s. Choisissez Dégagé ou Ensablé pour explorer les dépôts de cette coupe.`);
    modal.querySelectorAll('[data-canal-preset]').forEach(button => button.setAttribute('aria-pressed', String(state.canal === (button.dataset.canalPreset === 'clear' ? 2200 : 1600))));
    write('#canal-flow', `${fmt.format(result.Qdiv)} m³/s`);
    write('#canal-capacity', `${fmt.format(state.canal)} m³/s`);
    write('#canal-power', `${fmt.format(result.Pgen)} MW`);
    write('#canal-reference-power', `${fmt.format(reference.Pgen)} MW`);
    $('#canal-flow-bar').style.width = `${clamp(result.Qdiv / Math.max(2200, result.Qdiv) * 100, 0, 100)}%`;
    $('#canal-power-bar').style.width = `${clamp(result.Pgen / Math.max(reference.Pgen, result.Pgen, 1) * 100, 0, 100)}%`;
    const delta = result.Pgen - reference.Pgen;
    const loss = Math.abs(delta) < .5 ? 'Même production' : `${delta < 0 ? '−' : '+'}${fmt.format(Math.abs(delta))} MW`;
    write('#canal-impact', `${loss} par rapport au canal dégagé`);
    const limits = { export: 'le réseau', demand: 'la demande', nodemand: 'la demande nulle', units: 'les groupes disponibles', off: 'les groupes à l’arrêt', river: 'l’eau du fleuve', intake: 'la prise d’eau' };
    let why = state.canal < 2200 && delta < -.5 ? 'Le passage réduit laisse moins d’eau atteindre les turbines. La production diminue.' : state.canal === 2200 ? 'Le canal offre son passage de référence. Ajoutez du sable pour voir ce qui change.' : state.canal > 2200 ? 'Ce réglage offre plus de passage que la référence. Choisissez une situation ci-dessus pour explorer l’ensablement.' : 'Le passage se réduit, mais une autre limite empêche déjà de produire davantage.';
    if (result.bind !== 'canal') why += ` Ici, la limite vient de ${limits[result.bind] || 'vos autres réglages'}.`;
    write('#canal-why', why);
    canvas.setAttribute('aria-label', `Coupe schématique du canal, ${inRange ? fmt.format(targetSediment * 100) + ' % de dépôts illustratifs' : 'forme indicative pour ce réglage'}. ${fmt.format(result.Qdiv)} mètres cubes par seconde vers les turbines ; ${fmt.format(result.Pgen)} mégawatts produits.`);
    if (paused || motionPreference.matches) drawnSediment = targetSediment;
    updatePlayButton();
    draw();
  }

  function draw(rising = false) {
    if (!active || modal.hidden) return;
    window.IngaCanalDrawing.draw(canvas, { sediment: drawnSediment, sedimentRising: rising, flow: api.R.Qdiv, capacity: api.S.canal, production: api.R.Pgen, referenceProduction: reference?.Pgen || 0, seconds, reducedMotion: paused });
  }

  function frame(now) {
    raf = 0;
    if (!active || modal.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0;
    previous = now;
    if (!paused) seconds += dt;
    if (animation) {
      const t = clamp((now - animation.start) / 8000, 0, 1);
      if (now - lastCommit >= 100 || t === 1) {
        lastCommit = now;
        setCapacity(animation.from + (animation.to - animation.from) * (t * t * (3 - 2 * t)));
      }
      if (t === 1) stopAnimation('Transformation terminée. Comparez les deux situations.');
    }
    const rising = targetSediment > drawnSediment + .005;
    drawnSediment = paused ? targetSediment : drawnSediment + (targetSediment - drawnSediment) * (1 - Math.exp(-dt * 6));
    draw(rising);
    if (!paused || animation) raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (!active || raf || (paused && !animation)) return;
    previous = 0;
    raf = requestAnimationFrame(frame);
  }

  function teardown() {
    active = false;
    animation = null;
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
  }

  function close() {
    teardown();
    modal.hidden = true;
    sync();
  }

  function open() {
    if (api.mode !== 'live') return;
    if (document.getElementById('tourBtn')?.getAttribute('aria-pressed') === 'true') document.getElementById('tourBtn').click();
    window.IngaProduct?.dismiss();
    window.closeCut?.();
    window.closeInfo?.();
    document.querySelectorAll('.modal:not([hidden])').forEach(other => { other.hidden = true; });
    teardown();
    modal.hidden = false;
    active = true;
    paused = motionPreference.matches;
    seconds = 0;
    drawnSediment = clamp((2200 - api.S.canal) / 600, 0, 1);
    write('#canal-animation', 'À vous de jouer');
    updateMotionButton();
    updateReadouts();
    $('.canal-body').scrollTop = 0;
    sync();
    $('#canal-title').focus({ preventScroll: true });
    schedule();
    document.fonts?.ready.then(() => { if (active) draw(); });
  }

  function updateMotionButton() {
    const button = $('#canal-motion');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Reprendre l’animation du dessin' : 'Mettre le dessin en pause');
    button.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">${paused ? '<path d="m6 3 11 7-11 7Z" fill="currentColor"/>' : '<path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="3"/>'}</svg>`;
  }

  $('.canal-close').onclick = close;
  $('#canal-return').onclick = close;
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  slider.addEventListener('input', () => {
    stopAnimation('Vous réglez les dépôts de sable.');
    setCapacity(2200 - Number(slider.value) * 6);
  });
  modal.querySelectorAll('[data-canal-preset]').forEach(button => button.onclick = () => {
    stopAnimation(button.dataset.canalPreset === 'clear' ? 'Canal dégagé : comparez le passage de l’eau.' : 'Canal ensablé : observez les dépôts.');
    setCapacity(button.dataset.canalPreset === 'clear' ? 2200 : 1600);
  });
  $('#canal-play').onclick = () => {
    if (animation) { stopAnimation('Transformation arrêtée. Vous pouvez ajuster le curseur.'); return; }
    const inRange = api.S.canal >= 1600 && api.S.canal <= 2200;
    const target = inRange && targetSediment >= .5 ? 2200 : 1600;
    if (motionPreference.matches || paused) {
      setCapacity(target);
      stopAnimation('État appliqué. Le dessin est en pause.');
      return;
    }
    if (!inRange) setCapacity(2200);
    animation = { start: performance.now(), from: api.S.canal, to: target };
    lastCommit = 0;
    write('#canal-animation', target === 1600 ? 'Le sable s’accumule… observez le passage.' : 'Les dépôts se retirent… le passage se libère.');
    updatePlayButton();
    schedule();
  };
  $('#canal-motion').onclick = () => {
    paused = !paused;
    if (paused) {
      stopAnimation('Animation en pause. Les commandes restent utilisables.');
      cancelAnimationFrame(raf); raf = 0;
      drawnSediment = targetSediment;
    }
    updateMotionButton(); draw(); schedule();
  };
  $('#canal-sources-button').onclick = () => { close(); window.openReg?.('srcs'); sync(); };
  window.addEventListener('inga:simulationchange', () => {
    if (!active || ownedChange) return;
    stopAnimation('Les réglages de la simulation ont changé.');
    updateReadouts();
  });
  motionPreference.addEventListener('change', () => {
    if (!active || !motionPreference.matches) return;
    paused = true;
    stopAnimation('Animation réduite selon les préférences de votre appareil.');
    cancelAnimationFrame(raf); raf = 0;
    updateMotionButton(); updateReadouts();
  });
  new MutationObserver(() => {
    if (!active) return;
    if (modal.hidden) { teardown(); sync(); return; }
    if ([...document.querySelectorAll('.modal:not([hidden])')].some(other => other !== modal)) close();
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.IngaCanal = { open, close };
})();
