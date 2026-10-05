/* User-supplied narration. One voice at a time; playback always starts with a click. */
(() => {
  'use strict';
  const api = window.__INGA, app = document.getElementById('app');
  if (!api || !app) return;
  const clips = {
  "river": {
    "name": "Fleuve",
    "src": "voix/journey-river.mp3",
    "duration": 18.599184,
    "text": "Tout commence avec l'eau du Congo. À Inga, elle peut descendre d'un niveau élevé vers un niveau plus bas. Cette descente peut faire tourner une machine. On dirige donc une partie de l'eau vers les centrales, les installations qui produisent l'électricité. Le reste continue dans le fleuve. Suivons maintenant l'eau qui entre dans le canal."
  },
  "canal": {
    "name": "Canal",
    "src": "voix/journey-canal.mp3",
    "duration": 17.319184,
    "text": "Le canal est un passage aménagé pour conduire l'eau jusqu'aux machines. Si du sable s'accumule, il reste moins de place pour l'eau. Moins d'eau peut alors arriver aux machines, et la production d'électricité peut diminuer. En retirant les dépôts, on libère le passage. Suivons l'eau jusqu'à la roue qu'elle va faire tourner."
  },
  "turbine": {
    "name": "Turbine",
    "src": "voix/journey-turbine.mp3",
    "duration": 16.927347,
    "text": "L'eau fait alors tourner la roue de la turbine. La roue entraîne une grande tige en métal, appelée l'arbre. Cette tige transmet le mouvement à l'alternateur, la machine qui produit l'électricité. Après ce passage, l'eau retourne au fleuve. Suivons maintenant la rotation de la tige."
  },
  "alternator": {
    "name": "Alternateur",
    "src": "voix/journey-alternator.mp3",
    "duration": 23.24898,
    "text": "La roue entraîne maintenant l'alternateur, la machine qui produit l'électricité. À l'intérieur, une pièce aimantée tourne devant des fils enroulés qui restent immobiles. Le mouvement de la pièce aimantée agit sur ces fils et permet de produire l'électricité. Le courant change régulièrement de sens : c'est le courant alternatif. Il faut ensuite transporter cette énergie jusqu'aux lieux où elle sera utilisée."
  },
  "transformer": {
    "name": "Transformateur",
    "src": "voix/journey-transformer.mp3",
    "duration": 19.957551,
    "text": "Le transformateur augmente la tension, mesurée en volts, sans créer d'énergie. La tension permet de faire circuler le courant : le mouvement de minuscules particules dans les fils. Pour transporter la même énergie chaque seconde, une tension plus élevée demande moins de courant. Les fils chauffent alors moins, et davantage d'énergie arrive à destination."
  },
  "city": {
    "name": "Ville",
    "src": "voix/journey-city.mp3",
    "duration": 22.047347,
    "text": "Nous arrivons en ville. Avant les bâtiments, la tension est abaissée pour alimenter les lampes et les appareils. Résumons : l'eau fait tourner une roue ; la roue entraîne l'alternateur, qui produit l'électricité ; le transformateur prépare le transport ; les lignes acheminent l'énergie jusqu'aux utilisateurs. Après avoir fait tourner la roue, l'eau est retournée au fleuve."
  }
};
  const modalKeys = { 'canal-cut': 'canal', cut: 'turbine', 'alternator-cut': 'alternator', 'transformer-cut': 'transformer' };
  const bar = document.createElement('section');
  bar.id = 'journey-narration'; bar.className = 'journey-narration'; bar.setAttribute('role', 'group');
  bar.innerHTML = `<div class="journey-audio-buttons"><button type="button" id="journey-audio-play">Écouter</button><span id="journey-audio-time" aria-hidden="true"></span><button type="button" id="journey-audio-stop" aria-label="Arrêter la narration et revenir au début" disabled>Arrêter</button></div><p id="journey-audio-status" role="status"></p>`;
  const transcript = document.createElement('details');
  transcript.id = 'journey-transcript'; transcript.className = 'journey-transcript';
  transcript.innerHTML = '<summary>Lire l’explication</summary><p></p>';
  const play = bar.querySelector('#journey-audio-play'), stopButton = bar.querySelector('#journey-audio-stop');
  const status = bar.querySelector('#journey-audio-status'), clock = bar.querySelector('#journey-audio-time');
  let surface = null, media = null, state = 'idle', wanted = false, attempt = 0, watchdog = 0, lastTime = 0;
  const deadline = 12000;
  const format = seconds => { const value = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };
  function currentSurface() {
    if (api.mode !== 'live' || document.body.classList.contains('touring')) return null;
    const modal = [...app.querySelectorAll('.modal:not([hidden])')].at(-1);
    if (!modal) return null;
    const key = modal.id === 'journey-detail' ? modal.dataset.kind : modalKeys[modal.id];
    if (!clips[key]) return null;
    const host = modal.querySelector('.canal-console') || modal.querySelector('.cutgrid > div:last-child');
    return host ? { key, modal, host } : null;
  }
  function valid(node) {
    const visible = currentSurface();
    return media === node && surface && visible?.key === surface.key && visible.modal === surface.modal;
  }
  function clearWatch() { clearTimeout(watchdog); watchdog = 0; }
  function release() {
    clearWatch(); wanted = false; attempt++;
    const old = media; media = null;
    if (old) { old.pause(); old.removeAttribute('src'); old.load(); old.remove(); }
  }
  function render() {
    if (!surface) return;
    const labels = { idle: 'Écouter', loading: 'Pause', playing: 'Pause', paused: 'Reprendre', ended: 'Réécouter', error: 'Réessayer' };
    play.textContent = labels[state];
    play.setAttribute('aria-label', `${labels[state]} l’explication : ${clips[surface.key].name}`);
    stopButton.disabled = !['playing', 'loading', 'paused'].includes(state);
    bar.dataset.state = state;
    const messages = { idle: 'Explication audio · à votre rythme', loading: 'Chargement de la voix…', playing: 'La voix explique cette étape', paused: 'Narration en pause', ended: 'Explication terminée · vous pouvez continuer', error: 'Lecture indisponible. Réessayez ou lisez l’explication ci-dessous.' };
    if (status.textContent !== messages[state]) status.textContent = messages[state];
    const duration = media && Number.isFinite(media.duration) ? media.duration : clips[surface.key].duration;
    clock.textContent = `${format(media?.currentTime)} / ${format(duration)}`;
    play.setAttribute('aria-busy', String(state === 'loading'));
  }
  function fail(node) {
    if (!valid(node) || !wanted) return;
    release(); state = 'error'; render();
  }
  function watch(node) {
    clearWatch();
    watchdog = setTimeout(() => fail(node), deadline);
  }
  function stop() { release(); state = 'idle'; lastTime = 0; render(); }
  function pause() {
    if (!media) return;
    wanted = false; attempt++; clearWatch(); media.pause(); state = 'paused'; render();
  }
  function createMedia() {
    const node = new Audio();
    node.id = 'journey-audio-media'; node.hidden = true; node.preload = 'none';
    node.setAttribute('playsinline', '');
    node.src = clips[surface.key].src; media = node; bar.append(node);
    node.addEventListener('playing', () => {
      if (!valid(node) || !wanted || document.hidden) { node.pause(); return; }
      state = 'playing'; watch(node); render();
    });
    node.addEventListener('waiting', () => { if (valid(node) && wanted) { state = 'loading'; watch(node); render(); } });
    node.addEventListener('timeupdate', () => {
      if (!valid(node)) return;
      if (wanted && node.currentTime > lastTime) { lastTime = node.currentTime; watch(node); }
      render();
    });
    node.addEventListener('loadedmetadata', () => { if (valid(node)) render(); });
    node.addEventListener('pause', () => {
      if (valid(node) && wanted && !node.ended) { wanted = false; attempt++; clearWatch(); state = 'paused'; render(); }
    });
    node.addEventListener('ended', () => {
      if (!valid(node)) return;
      wanted = false; clearWatch(); state = 'ended'; render();
    });
    node.addEventListener('error', () => fail(node));
    return node;
  }
  function toggle() {
    if (!surface || document.hidden) return;
    if (state === 'playing' || state === 'loading') { pause(); return; }
    if (!currentSurface() || currentSurface().key !== surface.key) return;
    if (!media) createMedia();
    const node = media, ticket = ++attempt;
    if (state === 'ended') node.currentTime = 0;
    lastTime = node.currentTime; wanted = true; state = 'loading'; render(); watch(node);
    try {
      const promise = node.play(); // Keep this call inside the visitor's click, including on iOS.
      promise?.then(() => {
        if (!valid(node) || !wanted || document.hidden) node.pause();
      }).catch(() => { if (ticket === attempt) fail(node); });
    } catch { fail(node); }
  }
  function reconcile() {
    const next = currentSurface();
    if (next?.key === surface?.key && next?.modal === surface?.modal && next?.host === surface?.host && (!next || next.host.contains(bar))) return;
    stop(); bar.remove(); transcript.remove(); surface = next;
    if (!surface) return;
    transcript.open = false; transcript.querySelector('p').textContent = clips[surface.key].text;
    bar.setAttribute('aria-label', `Explication audio : ${clips[surface.key].name}`);
    surface.host.prepend(bar, transcript); render();
    window.syncAccessibility?.();
  }
  play.addEventListener('click', toggle); stopButton.addEventListener('click', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden && wanted) pause(); });
  window.addEventListener('pagehide', stop);
  new MutationObserver(reconcile).observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-kind'] });
  new MutationObserver(reconcile).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.IngaJourneyAudio = Object.freeze({ stop });
  reconcile();
})();
