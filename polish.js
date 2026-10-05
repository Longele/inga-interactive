/* Responsive navigation and a readable, live water-to-power balance. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const tools = document.querySelector('.tools');
  const mobile = matchMedia('(max-width: 900px)');
  const options = document.createElement('div');
  options.id = 'tools-panel';
  options.className = 'modal';
  options.hidden = true;
  options.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-labelledby="tools-title">
    <button class="x" aria-label="Fermer les options">×</button>
    <div class="mhead"><div class="k">À votre rythme</div><h2 id="tools-title">Vues et options</h2></div>
    <div class="mbody"><div class="options-grid"></div><p class="note">Recentrer replace la caméra sans modifier votre expérience. Réinitialiser rétablit les réglages de départ et efface les défis explorés dans cette session.</p></div>
  </div>`;
  app.appendChild(options);
  const group = document.createElement('div');
  group.className = 'tg mobile-options-group';
  group.innerHTML = '<button id="mobile-options" type="button" aria-haspopup="dialog" aria-controls="tools-panel">Plus</button>';
  tools.appendChild(group);
  const trigger = group.firstElementChild;
  const close = () => { options.hidden = true; syncAccessibility(); };
  trigger.onclick = () => { options.hidden = false; syncAccessibility(); };
  options.querySelector('.x').onclick = close;
  // Restore background focus before an existing action opens its own dialog.
  options.querySelector('.options-grid').addEventListener('click', e => {
    if (e.target.closest('button')) close();
  }, true);
  new MutationObserver(() => syncAccessibility()).observe(options, { attributes: true, attributeFilter: ['hidden'] });
  const moved = ['toPaper', 'recenter', 'openReg', 'resetAll', 'learningBtn', 'canalBtn', 'alternatorBtn', 'transformerBtn', 'offline-status'].map(id => {
    const el = document.getElementById(id);
    if (!el) return null;
    const home = document.createComment(`${id} home`);
    el.before(home);
    return { el, home };
  }).filter(Boolean);
  function arrange() {
    if (!mobile.matches && !options.hidden) close();
    for (const { el, home } of moved) {
      if (mobile.matches) {
        const destination=options.querySelector('.options-grid');
        if(el.parentElement!==destination) destination.appendChild(el);
      } else if(home.nextSibling!==el) home.after(el);
    }
    group.hidden = !mobile.matches;
    requestAnimationFrame(() => {
      if (!mobile.matches) {
        const top = Math.max(70, tools.getBoundingClientRect().bottom + 12);
        document.getElementById('ctrl').style.top = `${top}px`;
        document.documentElement.style.setProperty('--controls-top', `${top}px`);
      }
      syncAccessibility();
    });
  }
  mobile.addEventListener('change', arrange);
  window.addEventListener('resize', arrange);
  new ResizeObserver(arrange).observe(tools);
  if (document.fonts) document.fonts.ready.then(arrange);

  const learn = document.createElement('button');
  learn.id = 'mobile-learn';
  learn.type = 'button';
  learn.textContent = 'Apprendre';
  learn.setAttribute('aria-haspopup', 'dialog');
  learn.onclick = () => window.IngaProduct?.open();
  document.querySelector('.tabbar').appendChild(learn);

  const balance = document.querySelector('#dash > .mobonly');
  balance.innerHTML = `<div class="sec-h">Du fleuve au réseau <span class="chip sim">Modèle</span></div>
    <ol class="mobile-flow" aria-label="Bilan de l’eau et de la puissance">
      <li data-flow="river"><span class="flow-number" aria-hidden="true">1</span><div><span class="flow-name">Le fleuve</span><strong id="mf-river"></strong><p id="mf-bypass"></p></div></li>
      <li data-flow="canal"><span class="flow-number" aria-hidden="true">2</span><div><span class="flow-name">L’eau dérivée</span><strong id="mf-canal"></strong><p id="mf-capacity"></p></div></li>
      <li data-flow="units"><span class="flow-number" aria-hidden="true">3</span><div><span class="flow-name">Les centrales</span><strong id="mf-generation"></strong><p>Puissance électrique produite</p></div></li>
      <li data-flow="grid"><span class="flow-number" aria-hidden="true">4</span><div><span class="flow-name">Le réseau</span><strong id="mf-delivered"></strong><p id="mf-loss"></p></div></li>
    </ol><p class="flow-limit" id="mf-limit"></p><p class="note">Une fraction du fleuve est dérivée. Après les turbines, cette eau rejoint le fleuve. Les chiffres décrivent votre simulation.</p>`;
  const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const write = (id, text) => { const node = document.getElementById(id); if (node.textContent !== text) node.textContent = text; };
  function renderBalance() {
    const { R: r, S: s } = window.__INGA;
    write('mf-river', `${format.format(r.Qr)} m³/s`);
    write('mf-bypass', `${format.format(r.bypass)} m³/s restent hors des turbines`);
    write('mf-canal', `${format.format(r.Qdiv)} m³/s vers les turbines`);
    write('mf-capacity', `Capacité du canal : ${format.format(s.canal)} m³/s`);
    write('mf-generation', `${format.format(r.Pgen)} MW`);
    write('mf-delivered', `${format.format(r.Prec)} MW livrés`);
    write('mf-loss', `${format.format(r.Pgen - r.Prec)} MW de pertes · ${format.format(r.unserved)} MW de demande non servie`);
    write('mf-limit', `Ce qui limite : ${BIND_TXT[r.bind]}`);
    const limit = ['demand', 'nodemand', 'export'].includes(r.bind) ? 'grid' : ['off', 'units'].includes(r.bind) ? 'units' : r.bind === 'intake' ? 'canal' : r.bind;
    balance.querySelectorAll('[data-flow]').forEach(el => el.classList.toggle('is-limiting', el.dataset.flow === limit));
  }
  window.addEventListener('inga:simulationchange', renderBalance);
  renderBalance();
  arrange();
})();
