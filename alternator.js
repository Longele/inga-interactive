/* A live group, with a deliberately simplified illustration of induction. */
(() => {
  'use strict';
  const api = window.__INGA, app = document.getElementById('app');
  if (!api || !app || !window.IngaAlternatorDrawing) return;
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const modal = document.createElement('div');
  modal.id = 'alternator-cut';
  modal.className = 'modal canal-modal alternator-modal';
  modal.hidden = true;
  modal.innerHTML = `<section class="mbox canal-box alternator-box" role="dialog" aria-modal="true" aria-labelledby="alternator-title">
    <header class="canal-header"><div><p>Les ouvrages à la loupe · 02</p><h2 id="alternator-title" tabindex="-1">L’alternateur en coupe</h2></div><div class="canal-header-actions"><button type="button" id="alternator-motion" aria-label="Mettre le dessin en pause" aria-pressed="false"></button><button type="button" class="canal-close" aria-label="Fermer la coupe de l’alternateur">×</button></div></header>
    <div class="canal-body"><div class="canal-lab alternator-lab">
      <figure class="canal-figure"><div class="canal-plate"><canvas id="alternator-canvas" width="900" height="620" role="img" aria-describedby="alternator-explanation" aria-label="Coupe de principe d’un alternateur : rotor mobile, bobines fixes et trois tensions alternées."></canvas></div><figcaption><span>Schéma à 2 pôles illustratifs</span><span>Rotation ralentie ×10</span><span>Coupe schématique</span></figcaption></figure>
      <div class="canal-console alternator-console">
        <div class="alternator-unit"><label for="alternator-unit">Groupe observé</label><select id="alternator-unit"></select><span id="alternator-state"></span></div>
        <div class="alternator-stages" role="group" aria-label="Comprendre l’alternateur"><button type="button" data-alternator-stage="rotor" aria-pressed="true"><span>01</span>Le rotor</button><button type="button" data-alternator-stage="stator" aria-pressed="false"><span>02</span>Le stator</button><button type="button" data-alternator-stage="induction" aria-pressed="false"><span>03</span>L’alternatif</button></div>
        <p id="alternator-explanation" role="status" aria-live="polite"></p>
        <div class="alternator-options"><label><input type="checkbox" id="alternator-field" checked>Voir le champ magnétique</label><label><input type="checkbox" id="alternator-phases" checked>Voir les trois phases</label></div>
        <button type="button" id="alternator-step">Avancer le dessin de ¼ de tour <span aria-hidden="true">→</span></button>
        <div class="alternator-controls"><div class="alternator-operation"><label><input type="checkbox" id="alternator-on">Groupe en marche</label><button type="button" id="alternator-fault">Simuler une panne</button></div>
          <div class="alternator-load-label"><label for="alternator-load">Consigne de charge</label><output id="alternator-load-value" for="alternator-load"></output></div><input type="range" id="alternator-load" min="0" max="100" step="1" value="100" aria-describedby="alternator-load-note"><p id="alternator-load-note">Changez la charge : observez la puissance et la vitesse.</p>
          <div class="alternator-load-presets" role="group" aria-label="Comparer deux charges"><button type="button" data-alternator-load="30">Charge 30 %</button><button type="button" data-alternator-load="100">Charge 100 %</button></div>
        </div>
        <div class="canal-measures alternator-measures"><div><span>Vitesse du groupe</span><strong id="alternator-rpm"></strong><small id="alternator-rpm-reference"></small></div><div><span>Puissance électrique du groupe</span><strong id="alternator-power"></strong><small>Plafond du modèle : <b id="alternator-rating"></b></small></div></div>
        <div class="canal-lesson"><span id="alternator-insight"></span><p id="alternator-why"></p></div>
        <details class="canal-sources"><summary>Comprendre les chiffres et le dessin</summary><p>La vitesse et la puissance viennent du groupe choisi dans le simulateur. Les commandes modifient uniquement ce groupe ; le fleuve, le canal, le réseau et les autres groupes conservent vos réglages.</p><p id="alternator-source"></p><p>Le rotor à deux pôles et les trois enroulements espacés de 120° expliquent le principe. Leur géométrie ne reproduit pas un alternateur d’Inga. Le nombre réel de pôles, la tension aux bornes et la fréquence électrique ne sont pas établis par cette coupe.</p><p>Les courbes montrent des tensions induites normalisées, décalées d’un tiers de période. Leur amplitude reste fixe lorsque vous changez la charge : ce ne sont ni des courbes de courant, ni des mesures en volts. Un groupe peut porter une tension sans livrer de puissance.</p><p>Le champ d’excitation est supposé établi lorsque le groupe tourne en marche. L’excitation, la régulation de tension et les pertes propres à l’alternateur ne sont pas calculées. Le rendement du modèle reste combiné turbine-alternateur.</p><button type="button" id="alternator-sources">Consulter les sources du projet</button></details>
      </div></div></div>
    <footer class="canal-footer"><span>Vos réglages du groupe sont conservés.</span><div class="alternator-footer-actions"><button type="button" class="btn" id="alternator-francis">Voir la turbine</button><button type="button" class="btn pri" id="alternator-return">Retour à la maquette</button></div></footer>
  </section>`;
  app.append(modal);
  const $ = selector => modal.querySelector(selector);
  const canvas = $('#alternator-canvas');
  const picker = $('#alternator-unit');
  $('#alternator-state').setAttribute('role', 'status');
  $('#alternator-state').setAttribute('aria-live', 'polite');
  $('.alternator-console').prepend($('.alternator-measures'));
  for (const unit of api.S.units) {
    const option = document.createElement('option');
    option.value = unit.id; option.textContent = `${unit.id} · Inga ${unit.plant}`;
    picker.append(option);
  }
  const trigger = document.createElement('button');
  trigger.id = 'alternatorBtn'; trigger.type = 'button'; trigger.textContent = 'Coupe de l’alternateur';
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', modal.id);
  document.querySelector('.tools [aria-label="Outils"]')?.prepend(trigger);
  trigger.onclick = () => open();
  const sync = () => window.syncAccessibility?.();
  const states = { off: 'À l’arrêt', fail: 'Groupe en panne', start: 'Démarrage · pas encore couplé', sync: 'Synchronisé', water: 'Limité par l’eau', grid: 'Limité par la demande ou le réseau' };
  const explanations = {
    rotor: 'La turbine entraîne le rotor, au centre. Son champ magnétique tourne avec lui : suivez les pôles N et S.',
    stator: 'Les bobines du stator restent fixes. Le champ du rotor les traverse et varie pendant la rotation.',
    induction: 'Cette variation induit trois tensions alternées. Les phases A, B et C sont décalées d’un tiers de période : suivez les points sur les courbes.'
  };
  let active = false, raf = 0, previous = 0, lastRead = 0;
  let paused = reduced.matches, angle = 0, focus = 'rotor', id = 'G24', snapshot = null, visualKey = '';

  function write(selector, value) { const el = $(selector); if (el.textContent !== value) el.textContent = value; }
  function motionButton() {
    const button = $('#alternator-motion');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Reprendre l’animation du dessin' : 'Mettre le dessin en pause');
    button.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">${paused ? '<path d="m6 3 11 7-11 7Z" fill="currentColor"/>' : '<path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="3"/>'}</svg>`;
  }
  function draw() {
    if (!active || modal.hidden || !snapshot) return;
    const energized = snapshot.unit.on && !snapshot.unit.failed && snapshot.rpm > .01;
    window.IngaAlternatorDrawing.draw(canvas, { angle, field: $('#alternator-field').checked, phases: $('#alternator-phases').checked, energized, producing: snapshot.result.P > .01, focus });
    visualKey = `${energized}/${snapshot.result.P > .01}`;
  }
  function readouts() {
    if (!active) return;
    snapshot = api.getAlternatorUnit(id);
    if (!snapshot) { close(); return; }
    const { unit, result, rpm, plantSource, status } = snapshot;
    picker.value = unit.id;
    $('#alternator-on').checked = unit.on && !unit.failed;
    $('#alternator-on').disabled = unit.failed;
    $('#alternator-on').setAttribute('aria-label', `Marche du groupe ${unit.id}`);
    $('#alternator-load').value = String(Math.round(unit.load * 100));
    $('#alternator-load').disabled = unit.failed;
    $('#alternator-load').setAttribute('aria-valuetext', `${Math.round(unit.load * 100)} pour cent de consigne pour ${unit.id}`);
    write('#alternator-load-value', `${Math.round(unit.load * 100)} %`);
    modal.querySelectorAll('[data-alternator-load]').forEach(button => {
      button.disabled = unit.failed;
      button.setAttribute('aria-pressed', String(Math.round(unit.load * 100) === Number(button.dataset.alternatorLoad)));
    });
    write('#alternator-fault', unit.failed ? 'Réparer ce groupe' : 'Simuler une panne');
    $('#alternator-fault').setAttribute('aria-pressed', String(unit.failed));
    $('#alternator-step').disabled = rpm <= .01;
    write('#alternator-state', states[status] || status);
    $('#alternator-state').dataset.state = status;
    write('#alternator-rpm', `${number.format(rpm)} tr/min`);
    write('.alternator-measures>div:first-child>span', `Vitesse · ${unit.id}`);
    write('#alternator-power', `${number.format(result.P)} MW`);
    write('#alternator-rating', `${number.format(result.rating)} MW`);
    write('#alternator-rpm-reference', `En régime établi : ≈ ${number.format(plantSource.rpm)} tr/min`);
    write('#alternator-source', `Vitesse de référence : ≈ ${number.format(plantSource.rpm)} tr/min. ${plantSource.note} [${plantSource.reference}]`);
    let insight = 'Plus de puissance ne signifie pas plus vite.';
    let why = 'Quand le groupe est synchronisé, sa vitesse reste constante. La charge règle la puissance demandée ; l’eau et le réseau peuvent limiter ce qui est fourni.';
    if (unit.failed) {
      insight = 'Une panne interrompt la production.';
      why = 'Le groupe ne fournit plus de puissance. Réparez-le pour le remettre à disposition. S’il était à l’arrêt, remettez-le ensuite en marche.';
    } else if (!unit.on) {
      insight = 'Le groupe est arrêté.';
      why = 'Le rotor ralentit puis s’immobilise. Remettez le groupe en marche pour suivre la rotation et les tensions induites.';
    } else if (unit.starting > 0) {
      insight = 'Le rotor accélère avant le couplage.';
      why = 'Le groupe rejoint sa vitesse de fonctionnement. Dans ce modèle simplifié, il ne fournit de puissance qu’après le démarrage.';
    } else if (result.P < .01) {
      insight = 'Une tension peut exister sans puissance livrée.';
      why = 'Le groupe tourne, mais la consigne, l’eau ou le réseau empêchent ici la production. Les courbes illustrent une tension induite, avec un champ supposé établi.';
    }
    write('#alternator-insight', insight); write('#alternator-why', why);
    canvas.setAttribute('aria-label', `Alternateur du groupe ${unit.id}, ${states[status] || status}. Vitesse simulée ${number.format(rpm)} tours par minute ; puissance ${number.format(result.P)} mégawatts. Rotor à deux pôles illustratifs, trois tensions de principe.`);
    const key = `${unit.on && !unit.failed && rpm > .01}/${result.P > .01}`;
    if (key !== visualKey) draw();
  }
  function frame(now) {
    raf = 0;
    if (!active || modal.hidden) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0;
    previous = now;
    if (now - lastRead >= 100) { lastRead = now; readouts(); }
    if (!active) return;
    if (!paused && snapshot.rpm > .01) {
      angle = (angle + snapshot.rpm / 60 * Math.PI * 2 * dt / 10) % (Math.PI * 2);
      draw();
    }
    // Readouts follow startup/coasting even while the illustration is paused.
    raf = requestAnimationFrame(frame);
  }
  function teardown() { active = false; cancelAnimationFrame(raf); raf = 0; previous = 0; }
  function close() { teardown(); modal.hidden = true; sync(); }
  function open(requestedId) {
    if (api.mode !== 'live') return false;
    const chosen = api.getAlternatorUnit(requestedId);
    if (!chosen) return false;
    if (document.getElementById('tourBtn')?.getAttribute('aria-pressed') === 'true') document.getElementById('tourBtn').click();
    window.IngaProduct?.dismiss(); window.IngaCanal?.close(); window.closeCut?.(); window.closeInfo?.();
    document.querySelectorAll('.modal:not([hidden])').forEach(other => { other.hidden = true; });
    teardown(); id = chosen.unit.id; api.selectUnit(id, false);
    modal.hidden = false; active = true; paused = reduced.matches; angle = 0; lastRead = 0; visualKey = '';
    focus = 'rotor'; setFocus(focus); motionButton(); readouts(); draw();
    $('.alternator-console').scrollTop = 0;
    sync(); $('#alternator-title').focus({ preventScroll: true });
    raf = requestAnimationFrame(frame);
    document.fonts?.ready.then(() => { if (active) draw(); });
    return true;
  }
  function setFocus(value) {
    focus = value;
    modal.querySelectorAll('[data-alternator-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.alternatorStage === value)));
    write('#alternator-explanation', explanations[value]); draw();
  }
  modal.querySelectorAll('[data-alternator-stage]').forEach(button => button.onclick = () => setFocus(button.dataset.alternatorStage));
  picker.onchange = () => { id = picker.value; api.selectUnit(id, false); readouts(); draw(); };
  $('#alternator-load').oninput = event => { api.setUnitLoad(id, Number(event.target.value) / 100); readouts(); };
  modal.querySelectorAll('[data-alternator-load]').forEach(button => button.onclick = () => { api.setUnitLoad(id, Number(button.dataset.alternatorLoad) / 100); readouts(); });
  $('#alternator-on').onchange = event => { api.setUnitEnabled(id, event.target.checked); readouts(); };
  $('#alternator-fault').onclick = () => { api.setUnitFault(id, !snapshot.unit.failed); readouts(); };
  $('#alternator-field').onchange = draw;
  $('#alternator-phases').onchange = draw;
  $('#alternator-motion').onclick = () => { paused = !paused; motionButton(); };
  $('#alternator-step').onclick = () => { paused = true; angle = (angle + Math.PI / 2) % (Math.PI * 2); motionButton(); draw(); };
  $('.canal-close').onclick = close; $('#alternator-return').onclick = close;
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  $('#alternator-francis').onclick = () => { const selectedId = id; close(); api.selectUnit(selectedId, false); window.openCut?.(); };
  $('#alternator-sources').onclick = () => { close(); window.openReg?.('srcs'); sync(); };
  window.addEventListener('inga:simulationchange', readouts);
  reduced.addEventListener('change', () => { if (active && reduced.matches) { paused = true; motionButton(); draw(); } });
  new MutationObserver(() => {
    if (!active) return;
    if (modal.hidden) { teardown(); sync(); }
    else if ([...document.querySelectorAll('.modal:not([hidden])')].some(other => other !== modal)) close();
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.IngaAlternator = { open, close };
})();
