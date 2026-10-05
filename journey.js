/* One continuous route through the site and its existing engineering plates. */
(() => {
  'use strict';
  const api = window.__INGA, app = document.getElementById('app');
  if (!api || !app) return;
  const steps = [
    { id: 'river', name: 'Fleuve', short: 'Fleuve', title: 'Tout commence avec le Congo', text: 'Une partie de l’eau rejoint le canal. Le reste continue dans le fleuve.', action: 'Voir le chemin de l’eau', modal: 'journey-detail', kind: 'water' },
    { id: 'canal', name: 'Canal', short: 'Canal', title: 'Le canal conduit l’eau aux centrales', text: 'Le canal est un chemin pour l’eau. Du sable peut rétrécir ce passage et laisser passer moins d’eau.', action: 'Ouvrir le canal en coupe', modal: 'canal-cut', kind: 'water' },
    { id: 'turbine', name: 'Turbine', short: 'Turbine', title: 'L’eau fait tourner la turbine', text: 'L’eau fait tourner une roue : la turbine. Une tige transmet cette rotation à l’alternateur. L’eau retourne ensuite au fleuve.', action: 'Ouvrir la turbine en coupe', modal: 'cut', kind: 'water' },
    { id: 'alternator', name: 'Alternateur', short: 'Alternat.', title: 'La rotation devient électricité', text: 'Une pièce aimantée tourne devant des fils enroulés. C’est ainsi que l’alternateur transforme la rotation de la turbine en électricité.', action: 'Ouvrir l’alternateur en coupe', modal: 'alternator-cut', kind: 'power' },
    { id: 'transformer', name: 'Transformateur', short: 'Transfo.', title: 'Préparer le transport de l’électricité', text: 'Le transformateur augmente la tension, mesurée en volts. Cela permet de transporter l’énergie avec moins de pertes en chaleur dans les lignes.', action: 'Voir le transformateur et la ligne', modal: 'transformer-cut', kind: 'power' },
    { id: 'city', name: 'Ville', short: 'Ville', title: 'L’électricité fait fonctionner les appareils', text: 'À l’arrivée, d’autres transformateurs abaissent la tension pour les bâtiments. L’électricité sert à éclairer et à faire fonctionner des appareils. Liaison schématique.', action: 'Voir l’arrivée en ville', modal: 'journey-detail', kind: 'power' }
  ];
  const entry = document.createElement('button');
  entry.id = 'journey-entry'; entry.type = 'button'; entry.hidden = true;
  entry.setAttribute('aria-controls', 'energy-journey'); entry.setAttribute('aria-expanded', 'false');
  entry.innerHTML = '<svg viewBox="0 0 46 36" aria-hidden="true"><path d="M2 10c7-9 12 9 19 0M2 19c7-9 12 9 19 0M2 28c7-9 12 9 19 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="m33 2-8 18h9l-3 14 13-21H33Z" fill="#e8b45a"/></svg><span><strong>Du fleuve à la ville</strong><small>Explorer les 6 étapes</small></span><span class="journey-entry-arrow" aria-hidden="true">→</span>';
  const guide = document.createElement('section');
  guide.id = 'energy-journey'; guide.hidden = true; guide.setAttribute('aria-labelledby', 'journey-title');
  guide.innerHTML = `<header><div><p class="journey-eyebrow">Le chemin de l’énergie · <span id="journey-position">1 / 6</span></p><h2 id="journey-title" tabindex="-1"></h2></div><button id="journey-close" type="button" aria-label="Quitter le parcours et revenir à l’exploration libre">×</button></header>
    <nav aria-label="Les six étapes du fleuve à la ville"><ol>${steps.map((step, index) => `<li><button type="button" data-journey-step="${step.id}" data-kind="${step.kind}" aria-label="Étape ${index + 1} sur 6 : ${step.name}"><span class="journey-step-number" aria-hidden="true">${index + 1}</span><span class="journey-step-full">${step.name}</span><span class="journey-step-short" aria-hidden="true">${step.short}</span><i aria-hidden="true"></i></button></li>`).join('')}</ol></nav>
    <div class="journey-guide-bottom"><p id="journey-description"></p><button id="journey-open" type="button" aria-haspopup="dialog"></button></div>`;
  const hotspot = document.createElement('button');
  hotspot.id = 'journey-hotspot'; hotspot.type = 'button'; hotspot.hidden = true; hotspot.setAttribute('aria-haspopup', 'dialog');
  hotspot.innerHTML = '<span aria-hidden="true"></span><strong></strong><i aria-hidden="true"><svg width="15" height="15" viewBox="0 0 20 20"><path d="M4 16 16 4M5 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></i>';
  const announcement = document.createElement('p');
  announcement.id = 'journey-announcement'; announcement.className = 'journey-sr-only'; announcement.setAttribute('role', 'status');
  app.append(entry, guide, hotspot, announcement);
  const $ = selector => guide.querySelector(selector);
  const sync = () => window.syncAccessibility?.();
  const visited = new Set();
  let active = false, current = 'river', unitId = 'G24', detail = false, ownedModal = null;
  let frame = 0, restoringFocus = false, switching = false, originalFocus = null, complete = false;
  const selected = () => steps.find(step => step.id === current);
  const shownModal = () => [...app.querySelectorAll('.modal:not([hidden])')].at(-1) || null;
  const setHidden = (element, value) => {
    if (element.hidden === value) return;
    element.hidden = value;
    // These controls are added after the core accessibility observers are installed.
    sync();
  };
  const validUnit = id => typeof id === 'string' && !!api.getAlternatorUnit(id);
  function rememberUnit() { if (validUnit(api.selectedUnitId)) unitId = api.selectedUnitId; }
  function closeDetail() {
    const id = ownedModal?.id;
    ownedModal = null; detail = false;
    if (id === 'journey-detail') window.IngaJourneyEndpoints?.close();
    if (id === 'canal-cut') window.IngaCanal?.close();
    if (id === 'cut') window.closeCut?.();
    if (id === 'alternator-cut') window.IngaAlternator?.close();
    if (id === 'transformer-cut') window.IngaTransformer?.close();
  }
  function positionEntry() {
    const title = document.querySelector('.tb');
    if (title) entry.style.top = `${Math.ceil(title.getBoundingClientRect().bottom + 12)}px`;
  }
  function drawHotspot() {
    frame = 0;
    if (!active || detail || guide.hidden) { setHidden(hotspot, true); return; }
    const point = api.projectJourney(current, unitId), box = guide.getBoundingClientRect();
    const width = hotspot.offsetWidth || 160, height = hotspot.offsetHeight || 48;
    const titleBottom = document.querySelector('.tb')?.getBoundingClientRect().bottom || 0;
    const visible = point?.visible && point.x - width / 2 >= 8 && point.x + width / 2 <= innerWidth - 8 && point.y - height / 2 >= titleBottom + 8 && point.y + height / 2 <= box.top - 8;
    setHidden(hotspot, !visible);
    if (visible) { hotspot.style.left = `${point.x}px`; hotspot.style.top = `${point.y}px`; }
    frame = requestAnimationFrame(drawHotspot);
  }
  function scheduleHotspot() { if (!frame && active && !detail) frame = requestAnimationFrame(drawHotspot); }
  function update() {
    const step = selected(), index = steps.indexOf(step);
    $('#journey-title').textContent = step.title;
    $('#journey-position').textContent = `${index + 1} / 6`;
    $('#journey-description').textContent = step.text;
    $('#journey-open').textContent = step.action + ' →';
    $('#journey-open').setAttribute('aria-controls', step.modal);
    guide.dataset.kind = step.kind;
    guide.querySelectorAll('[data-journey-step]').forEach(button => {
      if (button.dataset.journeyStep === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      button.classList.toggle('is-visited', visited.has(button.dataset.journeyStep));
    });
    hotspot.dataset.kind = step.kind;
    hotspot.querySelector('span').textContent = index + 1;
    hotspot.querySelector('strong').textContent = current === 'city' ? 'Ville · schéma' : step.name;
    hotspot.setAttribute('aria-label', step.action + ', depuis la maquette');
    hotspot.setAttribute('aria-controls', step.modal);
    entry.querySelector('small').textContent = complete ? '6 étapes explorées · Revoir' : visited.size ? `${visited.size} / 6 étapes explorées · Reprendre` : 'Explorer les 6 étapes';
    entry.setAttribute('aria-expanded', String(active));
  }
  function attachFooter(modal) {
    app.querySelectorAll('.journey-cutaway').forEach(element => { if (element !== modal) element.classList.remove('journey-cutaway'); });
    modal.classList.add('journey-cutaway');
    let footer = modal.querySelector('.journey-modal-footer');
    if (!footer) {
      footer = document.createElement('nav'); footer.className = 'journey-modal-footer'; footer.setAttribute('aria-label', 'Continuer le chemin de l’énergie');
      footer.innerHTML = '<button type="button" data-journey-prev></button><button type="button" data-journey-map><small></small><span>Maquette</span></button><button type="button" data-journey-next></button>';
      modal.querySelector('.mbox').append(footer);
      footer.querySelector('[data-journey-prev]').onclick = () => { const index = steps.findIndex(step => step.id === current); if (index > 0) go(steps[index - 1].id, { open: true }); };
      footer.querySelector('[data-journey-next]').onclick = () => { const index = steps.findIndex(step => step.id === current); if (index < steps.length - 1) go(steps[index + 1].id, { open: true }); else finish(); };
      footer.querySelector('[data-journey-map]').onclick = returnToMap;
    }
    const index = steps.findIndex(step => step.id === current), prev = footer.querySelector('[data-journey-prev]'), next = footer.querySelector('[data-journey-next]');
    prev.disabled = index === 0; prev.textContent = index ? `← ${steps[index - 1].name}` : 'Début';
    prev.setAttribute('aria-label', index ? `Revenir à l’étape ${steps[index - 1].name}` : 'Première étape du parcours');
    next.textContent = index < 5 ? `${steps[index + 1].name} →` : 'Terminer le parcours ✓';
    next.setAttribute('aria-label', index < 5 ? `Continuer vers l’étape ${steps[index + 1].name}` : 'Terminer le parcours et revenir à la maquette');
    footer.querySelector('[data-journey-map] small').textContent = `${index + 1} / 6 · ${selected().name}`;
  }
  function openCurrent() {
    if (!active || api.mode !== 'live') return false;
    rememberUnit(); switching = true;
    closeDetail();
    if (current === 'river' || current === 'city') window.IngaJourneyEndpoints?.open(current);
    if (current === 'canal') window.IngaCanal?.open();
    if (current === 'turbine') api.openJourneyTurbine(unitId);
    if (current === 'alternator') window.IngaAlternator?.open(unitId);
    if (current === 'transformer') window.IngaTransformer?.open();
    ownedModal = document.getElementById(selected().modal);
    detail = !!ownedModal && !ownedModal.hidden;
    if (detail) { visited.add(current); attachFooter(ownedModal); }
    switching = false; update(); reconcile(); sync();
    return detail;
  }
  function go(id, options = {}) {
    if (!steps.some(step => step.id === id) || api.mode !== 'live') return false;
    if (!active && !start(id)) return false;
    rememberUnit();
    if (validUnit(options.unitId)) { unitId = options.unitId; api.selectUnit(unitId, false); }
    switching = true; closeDetail(); current = id; update(); setHidden(guide, false); sync();
    api.focusJourney(current, null, unitId);
    switching = false;
    if (options.open) return openCurrent();
    reconcile(); $('#journey-title').focus({ preventScroll: true });
    return true;
  }
  function start(id = 'river') {
    if (!steps.some(step => step.id === id) || api.mode !== 'live') return false;
    if (active) return go(id);
    originalFocus = document.activeElement;
    if (document.getElementById('tourBtn')?.getAttribute('aria-pressed') === 'true') document.getElementById('tourBtn').click();
    window.IngaProduct?.dismiss();
    window.IngaCanal?.close(); window.IngaAlternator?.close(); window.IngaTransformer?.close(); window.IngaJourneyEndpoints?.close(); window.closeCut?.(); window.closeInfo?.();
    app.querySelectorAll('.modal:not([hidden])').forEach(modal => { modal.hidden = true; });
    rememberUnit(); active = true; current = id; detail = false; complete = false;
    document.body.classList.add('energy-exploring');
    update(); setHidden(guide, false); setHidden(entry, true); sync();
    api.focusJourney(current, null, unitId); scheduleHotspot();
    $('#journey-title').focus({ preventScroll: true });
    return true;
  }
  function returnToMap() {
    if (!active) return;
    rememberUnit(); switching = true; closeDetail(); switching = false;
    app.querySelectorAll('.journey-cutaway').forEach(modal => modal.classList.remove('journey-cutaway'));
    setHidden(guide, false); update(); sync(); api.focusJourney(current, null, unitId); scheduleHotspot();
    $('#journey-open').focus({ preventScroll: true });
  }
  function stop() {
    if (!active) return;
    active = false; switching = true; closeDetail(); switching = false;
    api.cancelJourneyFocus(); cancelAnimationFrame(frame); frame = 0;
    document.body.classList.remove('energy-exploring');
    app.querySelectorAll('.journey-cutaway').forEach(modal => modal.classList.remove('journey-cutaway'));
    setHidden(guide, true); setHidden(hotspot, true); update(); reconcile(); sync();
    if (!shownModal()) {
      const target = originalFocus && originalFocus.getClientRects().length && !originalFocus.closest('[hidden],[inert]') ? originalFocus : entry;
      if (!target.hidden && !target.closest('[inert]')) target.focus({ preventScroll: true });
    }
  }
  function reset() { stop(); visited.clear(); complete = false; current = 'river'; unitId = 'G24'; update(); }
  function finish() {
    complete = visited.size === steps.length; stop();
    announcement.textContent = complete ? 'Les six étapes sont explorées. À retenir : l’eau fait tourner la turbine ; l’alternateur produit l’électricité ; les transformateurs adaptent la tension ; les lignes apportent l’énergie aux bâtiments. L’eau retourne au fleuve.' : 'Retour à la maquette. Vous pouvez reprendre les étapes du parcours à tout moment.';
  }
  function fromScene(key, requestedUnit) {
    if (!active) return false;
    if (validUnit(requestedUnit)) return go(current === 'alternator' ? 'alternator' : 'turbine', { open: true, unitId: requestedUnit });
    const id = { congo: 'river', rapids: 'river', intake: 'river', canal: 'canal', fwamalo: 'canal', fwdam: 'canal', pexvii: 'canal', shongo: 'turbine', inga1: 'turbine', inga2: 'turbine', switchyard: 'transformer', kinshasa: 'city' }[key];
    if (!id) { stop(); return false; }
    return go(id, { open: true, unitId: key === 'inga1' || key === 'shongo' ? 'G11' : key === 'inga2' ? 'G24' : unitId });
  }
  function reconcile() {
    if (switching || restoringFocus) return;
    const modal = shownModal();
    if (active && (api.mode !== 'live' || document.body.classList.contains('touring') || document.body.classList.contains('learning-observing'))) { stop(); return; }
    if (active && modal && modal !== ownedModal) { stop(); return; }
    if (active) {
      const wasDetail = detail; detail = !!modal;
      setHidden(guide, detail);
      if (detail) { setHidden(hotspot, true); cancelAnimationFrame(frame); frame = 0; }
      else {
        if (wasDetail || ownedModal) {
          ownedModal?.classList.remove('journey-cutaway'); ownedModal = null;
          rememberUnit(); update();
          restoringFocus = true; sync(); $('#journey-open').focus({ preventScroll: true }); restoringFocus = false;
          api.focusJourney(current, null, unitId);
        }
        scheduleHotspot();
      }
    }
    const hidden = active || api.mode !== 'live' || !!modal || document.body.classList.contains('touring') || document.body.classList.contains('learning-observing');
    setHidden(entry, hidden); positionEntry();
  }
  entry.onclick = () => start(visited.size ? current : 'river');
  $('#journey-close').onclick = stop; $('#journey-open').onclick = openCurrent; hotspot.onclick = openCurrent;
  guide.querySelectorAll('[data-journey-step]').forEach(button => { button.onclick = () => go(button.dataset.journeyStep); });
  document.addEventListener('keydown', event => { if (active && !shownModal() && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stop(); } });
  window.addEventListener('resize', () => { positionEntry(); if (active && !detail) api.focusJourney(current, null, unitId); });
  new ResizeObserver(() => { if (active && !detail) api.focusJourney(current, null, unitId); }).observe(guide);
  new MutationObserver(reconcile).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  new MutationObserver(reconcile).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.fonts?.ready.then(() => { positionEntry(); if (active && !detail) api.focusJourney(current, null, unitId); });
  window.IngaJourney = { start, go, openCurrent, stop, reset, fromScene, get state() { return { active, current, unitId, visited: [...visited], detail }; } };
  update(); reconcile();
})();
