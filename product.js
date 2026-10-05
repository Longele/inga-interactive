/* Educational journey. Uses the same simulation and presets as the main exhibit. */
(() => {
  'use strict';
  const api = window.__INGA;
  const app = document.getElementById('app');
  if (!api || !app) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const mw = value => `${number.format(value)} MW`;
  const museum = document.documentElement.classList.contains('musee');
  const explored = new Set();
  let current = null;
  let prediction = null;
  let result = null;

  const challenges = [
    {
      id: 'sed', title: 'Quand le canal s’ensable', topic: 'Le passage de l’eau',
      question: 'Le canal laisse passer moins d’eau. Que devient la puissance produite ?',
      setup: 'La capacité du canal passe de 2 200 à 1 600 m³/s. Le débit du fleuve, les groupes et le réseau restent identiques.',
      explanation: 'Le fleuve a toujours beaucoup d’eau. C’est le canal qui en laisse passer moins vers les turbines : le débit turbiné diminue, et avec lui la puissance produite.',
      takeaway: 'Un fleuve abondant ne suffit pas : la capacité de la dérivation compte aussi.'
    },
    {
      id: 'one', title: 'Un groupe s’arrête', topic: 'L’eau se répartit autrement',
      question: 'Le groupe G24 devient indisponible. La puissance totale baisse-t-elle beaucoup ?',
      setup: 'G24, un groupe d’Inga II, est arrêté. Les treize autres groupes restent disponibles ; le canal conserve sa capacité de 2 200 m³/s.',
      explanation: 'Dans la référence, le canal limite déjà le débit total. Les autres groupes peuvent absorber l’eau qui alimentait G24. La production varie peu ; elle n’est pas strictement identique, car la répartition entre Inga I et Inga II, dont les chutes diffèrent, change.',
      takeaway: 'L’effet d’une panne dépend de la contrainte de départ. Si d’autres groupes s’arrêtent, leur capacité peut devenir la limite.'
    },
    {
      id: 'grid', title: 'Le réseau atteint sa limite', topic: 'Transporter l’électricité',
      question: 'Le réseau peut exporter au maximum 900 MW. Que devient la puissance produite ?',
      setup: 'La capacité de transport passe de 2 000 à 900 MW. L’eau disponible et les groupes restent identiques ; la demande reçue reste à 1 500 MW.',
      explanation: 'Le réseau ne peut pas transporter toute la puissance disponible. Le modèle réduit donc la production et le débit turbiné. Avec les pertes de transport de 5 %, la puissance livrée est encore inférieure à celle produite.',
      takeaway: 'L’eau, les groupes et le réseau forment une chaîne. La limite peut se déplacer d’un maillon à l’autre.'
    }
  ];
  const choices = [
    ['down', 'Elle baisse nettement', 'Baisse de plus de 5 %.'],
    ['near', 'Elle reste proche de la référence', 'Variation de 5 % maximum.'],
    ['up', 'Elle augmente nettement', 'Hausse de plus de 5 %.']
  ];
  const definitions = [
    ['Débit · m³/s', 'Volume d’eau qui passe en une seconde. Le débit du fleuve, celui du canal et celui des turbines sont différents.'],
    ['Chute · m', 'Différence de niveau utile à la turbine. La chute nette tient compte des pertes hydrauliques. Le dénivelé de l’ensemble des rapides n’est pas la chute d’un groupe.'],
    ['Groupe hydroélectrique', 'Ensemble turbine et alternateur. À Inga, la turbine met un arbre en rotation ; cet arbre entraîne l’alternateur.'],
    ['Turbine Francis', 'Turbine dans laquelle l’eau transmet son énergie à une roue. La coupe présentée est générique : elle explique le principe, sans reproduire les plans mécaniques du site.'],
    ['Alternateur', 'Machine qui transforme la rotation de l’arbre en électricité. Il tourne à une vitesse liée à la fréquence du réseau.'],
    ['Puissance · MW', 'Énergie électrique produite ou livrée par unité de temps. Un mégawatt vaut un million de watts, soit un million de joules par seconde. Les nombres affichés dans le bilan sont des puissances simulées.'],
    ['Énergie · MWh', 'Quantité produite pendant une durée. Une puissance constante de 100 MW pendant une heure fournit 100 MWh. Le modèle présente un état de fonctionnement, pas une production annuelle.'],
    ['Rendement', 'Part de l’énergie reçue qui est convertie en énergie utile. Un rendement de 90 % signifie que 10 % sont perdus lors de la conversion.'],
    ['Puissance produite et puissance livrée', 'La puissance produite sort des groupes. La puissance livrée est celle qui reste après les pertes de transport. Leur différence n’est pas une panne.'],
    ['Contrainte limitante', 'Le facteur qui empêche de produire davantage dans la configuration choisie : eau admise, canal, groupes disponibles, demande ou capacité de transport.'],
    ['Courant alternatif · CA', 'Courant dont le sens varie périodiquement. Les couloirs vers Kinshasa représentés dans cette expérience sont à courant alternatif.'],
    ['Courant continu · CC', 'Courant qui circule dans un seul sens. La liaison Inga–Kolwezi transporte l’électricité en courant continu ; des stations de conversion la relient au réseau alternatif.']
  ];

  const intro = document.getElementById('intro');
  if (intro && !document.getElementById('learning-intro')) {
    const note = document.createElement('p');
    note.id = 'learning-intro';
    note.className = 'learning-intro';
    note.innerHTML = '<strong>Visite guidée · environ 3 minutes</strong><span>Suivez l’eau, comprenez une turbine, repérez ce qui limite la production.</span>';
    intro.querySelector('.acts')?.before(note);
  }

  const button = document.createElement('button');
  button.id = 'learningBtn';
  button.type = 'button';
  button.textContent = 'Apprendre';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'learning');
  const toolGroup = document.querySelector('.tools [aria-label="Outils"]');
  if (toolGroup) toolGroup.prepend(button);

  const modal = document.createElement('div');
  modal.id = 'learning';
  modal.className = 'modal learning-modal';
  modal.hidden = true;
  modal.innerHTML = '<section class="mbox learning-box" role="dialog" aria-modal="true" aria-labelledby="learning-title"><header class="learning-header"><div><p class="learning-eyebrow" id="learning-eyebrow"></p><h2 id="learning-title" tabindex="-1"></h2></div><button class="learning-close" type="button" aria-label="Fermer Apprendre">×</button></header><div class="learning-content" id="learning-content"></div></section>';
  app.append(modal);
  const content = modal.querySelector('#learning-content');
  const heading = modal.querySelector('#learning-title');
  const eyebrow = modal.querySelector('#learning-eyebrow');
  const sync = () => { if (typeof window.syncAccessibility === 'function') window.syncAccessibility(); };
  new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  modal.querySelector('.learning-close').addEventListener('click', dismiss);
  modal.addEventListener('click', event => { if (event.target === modal) dismiss(); });
  button.addEventListener('click', () => open());

  function dismiss() { modal.hidden = true; sync(); }

  function layout(title, label, html) {
    heading.textContent = title;
    eyebrow.textContent = label;
    content.innerHTML = html;
    content.scrollTop = 0;
    if (!modal.hidden) heading.focus({ preventScroll: true });
  }

  function open(view = 'hub') {
    if (api.mode !== 'live') return;
    const tourButton = document.getElementById('tourBtn');
    if (tourButton?.getAttribute('aria-pressed') === 'true') tourButton.click();
    // Keep a single dialog visible, including the compact mobile tools menu.
    document.querySelectorAll('.modal:not([hidden])').forEach(other => {
      if (other === modal) return;
      if (other.id === 'cut' && typeof window.closeCut === 'function') window.closeCut();
      else other.hidden = true;
    });
    if (view === 'glossary') glossary();
    else if (view === 'recap') recap();
    else hub();
    modal.hidden = false;
    sync();
    heading.focus({ preventScroll: true });
  }

  function hub() {
    current = null;
    prediction = null;
    result = null;
    layout('Comprendre en expérimentant', 'Apprendre · 3 défis', `
      <p class="learning-lead">Faites une hypothèse, testez-la, puis suivez le résultat de l’eau jusqu’au réseau.</p>
      <p class="learning-progress">${explored.size} sur 3 défis explorés pendant cette session</p>
      <div class="learning-challenges">${challenges.map((challenge, index) => `
        <button type="button" class="learning-challenge" data-learning-challenge="${challenge.id}">
          <span class="learning-number" aria-hidden="true">0${index + 1}</span>
          <span><strong>${challenge.title}</strong><small>${challenge.topic} · environ 2 min${explored.has(challenge.id) ? ' · exploré' : ''}</small></span>
          <svg class="learning-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>`).join('')}</div>
      <div class="learning-footer-links"><button type="button" class="learning-button" data-learning="glossary">Ouvrir le lexique</button><button type="button" class="learning-button learning-button-quiet" data-learning="recap">Les 3 idées essentielles</button></div>
      <p class="learning-note">Ces expériences utilisent le modèle pédagogique de l’application. Elles ne décrivent pas l’état actuel des installations.</p>`);
    content.querySelectorAll('[data-learning-challenge]').forEach(el => el.addEventListener('click', () => challenge(el.dataset.learningChallenge)));
    bind('glossary', glossary);
    bind('recap', recap);
  }

  function bind(action, callback) {
    content.querySelector(`[data-learning="${action}"]`)?.addEventListener('click', callback);
  }

  function challenge(id) {
    current = challenges.find(item => item.id === id);
    if (!current) return hub();
    prediction = null;
    result = null;
    const index = challenges.indexOf(current) + 1;
    layout(current.title, `Défi ${index} sur 3 · 1. Prédire`, `
      <button type="button" class="learning-back" data-learning="hub">← Tous les défis</button>
      <p class="learning-lead">${current.setup}</p>
      <form id="learning-prediction"><fieldset class="learning-choices"><legend>${current.question}</legend>
      ${choices.map(([value, label, hint]) => `<label class="learning-choice"><input type="radio" name="prediction" value="${value}" required><span><strong>${label}</strong><small>${hint}</small></span></label>`).join('')}
      </fieldset><p class="learning-note">Le test remplace vos réglages par la configuration de référence, puis applique ce seul changement. Vous pourrez ensuite explorer le résultat dans la maquette.</p>
      <button class="learning-button learning-primary" type="submit" id="learning-test" disabled>Tester mon hypothèse</button></form>`);
    bind('hub', hub);
    const form = content.querySelector('form');
    form.addEventListener('change', event => {
      if (event.target.name !== 'prediction') return;
      prediction = event.target.value;
      content.querySelector('#learning-test').disabled = false;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!prediction) return;
      const before = api.simulate(clone(api.BASE));
      api.applyPreset('normal', { fly: false });
      api.applyPreset(current.id, { fly: true });
      const after = api.R;
      result = { before, after, percent: before.Pgen ? (after.Pgen - before.Pgen) / before.Pgen * 100 : 0 };
      explored.add(current.id);
      explanation();
    });
  }

  function explanation() {
    const { before, after, percent } = result;
    const direction = percent < -5 ? 'down' : percent > 5 ? 'up' : 'near';
    const matched = prediction === direction;
    const change = Math.abs(percent) < 0.05 ? 'La puissance produite reste identique.' : `La puissance produite ${percent < 0 ? 'baisse' : 'augmente'} de ${decimal.format(Math.abs(percent))} % (${mw(Math.abs(after.Pgen - before.Pgen))}).`;
    const next = challenges[challenges.indexOf(current) + 1];
    const limits = { canal: 'le canal', intake: 'la prise d’eau', river: 'le fleuve', units: 'les groupes disponibles', demand: 'la demande', nodemand: 'la demande nulle', export: 'le réseau de transport', off: 'les groupes à l’arrêt' };
    const metrics = [['Puissance produite', mw(before.Pgen), mw(after.Pgen)], ['Puissance livrée', mw(before.Prec), mw(after.Prec)], ['Débit turbiné', `${number.format(before.Qdiv)} m³/s`, `${number.format(after.Qdiv)} m³/s`]];
    layout(current.title, `Défi ${challenges.indexOf(current) + 1} sur 3 · 2. Observer · 3. Comprendre`, `
      <button type="button" class="learning-back" data-learning="hub">← Tous les défis</button>
      <div class="learning-verdict"><p>${matched ? 'Votre hypothèse correspond au résultat.' : 'Le modèle révèle un autre résultat.'}</p><strong>${change}</strong></div>
      <table class="learning-results"><caption>Comparaison calculée par le modèle</caption><thead><tr><th scope="col">Mesure</th><th scope="col">Référence</th><th scope="col">Après le changement</th></tr></thead><tbody>${metrics.map(([label, a, b]) => `<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
      <section class="learning-explanation"><h3>Pourquoi ce résultat ?</h3><p>${current.explanation}</p><p class="learning-constraint">La limite après le changement : <strong>${limits[after.bind] || 'la configuration choisie'}</strong>.</p></section>
      <p class="learning-takeaway"><strong>À retenir</strong>${current.takeaway}</p>
      <div class="learning-actions"><button type="button" class="learning-button learning-primary" data-learning="observe">Observer sur la maquette</button><button type="button" class="learning-button" data-learning="next">${next ? 'Défi suivant' : 'Revenir aux défis'}</button></div>
      <button type="button" class="learning-back" data-learning="glossary">Un mot à éclaircir ? Ouvrir le lexique</button>`);
    bind('hub', hub);
    bind('observe', dismiss);
    bind('next', () => next ? challenge(next.id) : hub());
    bind('glossary', glossary);
  }

  function recap() {
    layout('Du fleuve au réseau : l’essentiel', 'Les 3 idées à emporter', `
      <p class="learning-lead">Vous pouvez maintenant suivre le chemin de l’eau et comprendre ce qui détermine la production.</p>
      <ol class="learning-recap"><li><span aria-hidden="true">01</span><div><h3>Une partie du fleuve est dérivée</h3><p>Le reste du Congo continue par les rapides. L’eau turbinée rejoint le fleuve en aval ; Inga I et Inga II fonctionnent en parallèle.</p></div></li>
      <li><span aria-hidden="true">02</span><div><h3>L’eau met un groupe en mouvement</h3><p>Elle fait tourner la turbine Francis. L’arbre entraîne l’alternateur, qui transforme cette rotation en électricité.</p></div></li>
      <li><span aria-hidden="true">03</span><div><h3>La production dépend de toute la chaîne</h3><p>Le canal, les groupes et le réseau peuvent chacun imposer une limite. La puissance livrée tient aussi compte des pertes de transport.</p></div></li></ol>
      <div class="learning-actions"><button type="button" class="learning-button learning-primary" data-learning="hub">Mettre ces idées à l’épreuve</button><button type="button" class="learning-button" data-learning="explore">Continuer l’exploration</button></div>`);
    bind('hub', hub);
    bind('explore', dismiss);
  }

  function glossary() {
    layout('Les mots de l’hydroélectricité', 'Lexique · 12 repères', `
      <button type="button" class="learning-back" data-learning="back">← ${result ? 'Revenir au résultat' : 'Revenir aux défis'}</button>
      <p class="learning-lead">Des définitions pour lire la maquette et son bilan.</p>
      <label class="learning-search" for="learning-search">Chercher un mot<input id="learning-search" type="search" placeholder="Débit, puissance, turbine…" autocomplete="off"></label>
      <p id="learning-found" class="learning-note" role="status" aria-live="polite">12 définitions</p>
      <dl class="learning-glossary">${definitions.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join('')}</dl>`);
    bind('back', () => result && current ? explanation() : hub());
    const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    content.querySelector('#learning-search').addEventListener('input', event => {
      const query = normalized(event.target.value.trim());
      let count = 0;
      content.querySelectorAll('.learning-glossary > div').forEach(item => {
        item.hidden = !normalized(item.textContent).includes(query);
        if (!item.hidden) count += 1;
      });
      content.querySelector('#learning-found').textContent = count ? `${count} définition${count > 1 ? 's' : ''}` : 'Aucune définition trouvée. Essayez un autre mot.';
    });
  }

  window.addEventListener('inga:tour-complete', () => { if (!museum) open('recap'); });
  window.IngaProduct = {
    open,
    dismiss,
    reset() { explored.clear(); current = null; prediction = null; result = null; dismiss(); }
  };
  sync();
})();
