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
  let resultView = 'compare';
  let observing = false;
  let ownedChange = 0;
  let observationToken = 0;
  let changeTimer = 0;

  const challenges = [
    {
      id: 'sed', title: 'Quand le canal s’ensable', topic: 'Le passage de l’eau',
      action: 'Du sable réduit le passage de l’eau dans le canal.',
      beforeLabel: 'Canal dégagé', afterLabel: 'Canal ensablé',
      cause: ['Le canal laisse passer moins d’eau.', 'Moins d’eau fait tourner les turbines.', 'Les centrales produisent moins d’électricité.'],
      observe: 'Voir le canal dans la maquette',
      question: 'Le canal laisse passer moins d’eau. Que devient la puissance produite ?',
      setup: 'La capacité du canal passe de 2 200 à 1 600 m³/s. Le débit du fleuve, les groupes et le réseau restent identiques.',
      explanation: 'Le fleuve a toujours beaucoup d’eau. C’est le canal qui en laisse passer moins vers les turbines : le débit turbiné diminue, et avec lui la puissance produite.',
      takeaway: 'Un fleuve abondant ne suffit pas : la capacité de la dérivation compte aussi.'
    },
    {
      id: 'one', title: 'Un groupe s’arrête', topic: 'L’eau se répartit autrement',
      action: 'Nous arrêtons G24, une machine qui produit de l’électricité. Les autres continuent de fonctionner.',
      beforeLabel: 'Tous les groupes disponibles', afterLabel: 'G24 arrêté',
      cause: ['G24 ne produit plus d’électricité.', 'Les autres groupes récupèrent l’eau disponible.', 'La production totale change peu dans cette situation.'],
      observe: 'Voir les centrales dans la maquette',
      question: 'G24 s’arrête. Que devient la production totale d’électricité ?',
      setup: 'G24, un groupe d’Inga II, est arrêté. Les treize autres groupes restent disponibles ; le canal conserve sa capacité de 2 200 m³/s.',
      explanation: 'Dans la référence, le canal limite déjà le débit total. Les autres groupes peuvent absorber l’eau qui alimentait G24. La production varie peu ; elle n’est pas strictement identique, car la répartition entre Inga I et Inga II, dont les chutes diffèrent, change.',
      takeaway: 'L’effet d’une panne dépend de la contrainte de départ. Si d’autres groupes s’arrêtent, leur capacité peut devenir la limite.'
    },
    {
      id: 'grid', title: 'Le réseau atteint sa limite', topic: 'Transporter l’électricité',
      action: 'Nous réduisons la quantité d’électricité que les lignes du réseau peuvent transporter.',
      beforeLabel: 'Réseau non limitant', afterLabel: 'Transport limité à 900 MW',
      cause: ['Le réseau peut transporter moins d’électricité.', 'Les centrales réduisent leur production pour respecter cette limite.', 'Moins d’eau passe dans les turbines.'],
      observe: 'Voir le réseau dans la maquette',
      question: 'Le réseau peut exporter au maximum 900 MW. Que devient la puissance produite ?',
      setup: 'La capacité de transport passe de 2 000 à 900 MW. L’eau disponible et les groupes restent identiques ; la demande reçue reste à 1 500 MW.',
      explanation: 'Le réseau ne peut pas transporter toute la puissance disponible. Le modèle réduit donc la production et le débit turbiné. Avec les pertes de transport de 5 %, la puissance livrée est encore inférieure à celle produite.',
      takeaway: 'L’eau, les groupes et le réseau forment une chaîne. La limite peut se déplacer d’un maillon à l’autre.'
    }
  ];
  const choices = [
    ['down', 'La production baisse beaucoup'],
    ['near', 'La production change peu'],
    ['up', 'La production augmente beaucoup']
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
  const scene = document.createElement('section');
  scene.id = 'learning-scene';
  scene.hidden = true;
  scene.setAttribute('aria-labelledby', 'learning-scene-title');
  scene.innerHTML = `<header><div><p class="learning-eyebrow">Étape 2 · Observez la maquette</p><h2 id="learning-scene-title"></h2></div><button type="button" data-learning-scene="close" aria-label="Fermer l’expérience et reprendre l’exploration">×</button></header>
    <div class="learning-scene-switch" role="group" aria-label="Comparer les états de la maquette"><button type="button" data-learning-scene="before" aria-pressed="false"><span>Avant</span><strong></strong></button><button type="button" data-learning-scene="after" aria-pressed="false"><span>Après</span><strong></strong></button></div>
    <p id="learning-scene-observation" role="status" aria-live="polite" aria-atomic="true"></p>
    <p id="learning-scene-auto">Le changement s’appliquera après le cadrage. Touchez Avant ou Après pour comparer à votre rythme.</p>
    <div class="learning-scene-actions"><button type="button" class="learning-button learning-primary" data-learning-scene="results">Résultat et explication →</button><button type="button" class="learning-button" data-learning-scene="canal-cut" aria-haspopup="dialog" aria-controls="canal-cut" hidden>Voir le canal en coupe</button><button type="button" class="learning-button" data-learning-scene="alternator-cut" aria-haspopup="dialog" aria-controls="alternator-cut" hidden>Voir l’alternateur en coupe</button></div>`;
  app.append(scene);
  const content = modal.querySelector('#learning-content');
  const heading = modal.querySelector('#learning-title');
  const eyebrow = modal.querySelector('#learning-eyebrow');
  const sync = () => { if (typeof window.syncAccessibility === 'function') window.syncAccessibility(); };
  new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  modal.querySelector('.learning-close').addEventListener('click', dismiss);
  modal.addEventListener('click', event => { if (event.target === modal) dismiss(); });
  button.addEventListener('click', () => open());

  function dismiss() { stopObservation(); modal.hidden = true; sync(); }

  function cancelAutomaticChange() {
    observationToken += 1;
    clearTimeout(changeTimer);
    changeTimer = 0;
  }

  function stopObservation() {
    cancelAutomaticChange();
    if (!observing) return;
    observing = false;
    scene.hidden = true;
    document.body.classList.remove('learning-observing');
    if (typeof window.applyPanels === 'function') window.applyPanels();
    sync();
  }

  function applyOwnedPreset(id) {
    ownedChange += 1;
    try { api.applyPreset(id, { fly: false }); }
    finally { ownedChange -= 1; }
  }

  function sceneState(phase, manual = true) {
    if (!observing) return;
    if (manual) cancelAutomaticChange();
    applyOwnedPreset(phase === 'before' ? 'normal' : current.id);
    scene.dataset.phase = phase;
    scene.querySelectorAll('[aria-pressed]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.learningScene === phase)));
    const before = phase === 'before';
    const r = before ? result.before : result.after;
    const text = current.id === 'sed'
      ? before ? `Regardez le canal : ${number.format(r.Qdiv)} m³/s passent vers les turbines.` : `Des dépôts apparaissent dans le canal. Moins d’eau passe : ${number.format(r.Qdiv)} m³/s.`
      : current.id === 'one'
        ? before ? 'Repérez G24 dans Inga II : son voyant est orange, comme les autres groupes limités par l’eau.' : 'Le voyant de G24 devient rouge. Ce groupe ne produit plus ; les autres récupèrent l’eau disponible.'
        : before ? `Regardez les lignes du réseau : ${mw(r.Pgen)} produits, ${mw(r.Prec)} livrés après les pertes.` : `Le transport est limité : ${mw(r.Pgen)} produits, ${mw(r.Prec)} livrés après les pertes.`;
    scene.querySelector('#learning-scene-observation').textContent = `${before ? 'Avant' : 'Après'} : ${text}`;
    scene.querySelector('#learning-scene-auto').textContent = manual || !before
      ? 'Touchez Avant ou Après pour changer la maquette. Les valeurs indiquent la puissance produite.'
      : 'Le changement s’appliquera après le cadrage. Touchez Avant ou Après pour comparer à votre rythme.';
  }

  function observe(initial = 'after', automatic = false) {
    stopObservation();
    modal.hidden = true;
    if (typeof window.closeInfo === 'function') window.closeInfo();
    observing = true;
    resultView = 'scene';
    scene.hidden = false;
    document.body.classList.add('learning-observing');
    scene.querySelector('#learning-scene-title').textContent = current.title;
    scene.querySelector('[data-learning-scene="canal-cut"]').hidden = current.id !== 'sed';
    scene.querySelector('[data-learning-scene="alternator-cut"]').hidden = current.id !== 'one';
    scene.querySelector('.learning-scene-actions').classList.toggle('has-cutaway', current.id === 'sed' || current.id === 'one');
    scene.querySelector('[data-learning-scene="before"] strong').textContent = mw(result.before.Pgen);
    scene.querySelector('[data-learning-scene="after"] strong').textContent = mw(result.after.Pgen);
    sceneState(initial, !automatic);
    sync();
    const token = observationToken;
    const hasScene = api.focusLearning?.(current.id, () => {
      if (!automatic || !observing || token !== observationToken) return;
      changeTimer = setTimeout(() => {
        if (observing && token === observationToken) sceneState('after');
      }, 3000);
    });
    if (!hasScene) {
      // The accessible numerical comparison also works without a 3D renderer.
      applyOwnedPreset(current.id);
      open('compare');
      return;
    }
    scene.querySelector(`[data-learning-scene="${initial}"]`).focus({ preventScroll: true });
  }

  scene.querySelector('[data-learning-scene="before"]').onclick = () => sceneState('before');
  scene.querySelector('[data-learning-scene="after"]').onclick = () => sceneState('after');
  scene.querySelector('[data-learning-scene="results"]').onclick = () => {
    applyOwnedPreset(current.id);
    open('compare');
  };
  scene.querySelector('[data-learning-scene="close"]').onclick = stopObservation;
  scene.querySelector('[data-learning-scene="canal-cut"]').onclick = () => window.IngaCanal?.open();
  scene.querySelector('[data-learning-scene="alternator-cut"]').onclick = () => window.IngaAlternator?.open('G24');
  window.addEventListener('inga:simulationchange', () => { if (observing && !ownedChange) stopObservation(); });
  window.addEventListener('resize', () => {
    if (!observing) return;
    cancelAutomaticChange();
    scene.querySelector('#learning-scene-auto').textContent = 'Touchez Avant ou Après pour changer la maquette. Les valeurs indiquent la puissance produite.';
    api.focusLearning?.(current.id);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && observing && !document.querySelector('.modal:not([hidden])')) {
      event.preventDefault();
      event.stopPropagation();
      stopObservation();
    }
  });
  new MutationObserver(() => {
    if (observing && document.querySelector('.modal:not([hidden])')) stopObservation();
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden'] });

  function layout(title, label, html) {
    heading.textContent = title;
    eyebrow.textContent = label;
    content.innerHTML = html;
    content.scrollTop = 0;
    if (!modal.hidden) heading.focus({ preventScroll: true });
  }

  function open(view = 'hub') {
    if (api.mode !== 'live') return;
    stopObservation();
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
    else if (view === 'compare' && result) comparison();
    else hub();
    modal.hidden = false;
    sync();
    heading.focus({ preventScroll: true });
  }

  function hub() {
    layout('Comprendre Inga pas à pas', 'Apprendre · 3 expériences', `
      <p class="learning-lead">Que se passe-t-il si le canal se bouche, si une machine s’arrête ou si le réseau est limité ?</p>
      <p class="learning-how"><strong>Comment ça marche ?</strong>Choisissez une situation et donnez votre avis. La fenêtre se ferme pour vous montrer le changement sur la maquette. Comparez Avant / Après, puis ouvrez l’explication.</p>
      <p class="learning-reassurance">Pas besoin de connaître la bonne réponse : vous pouvez aussi choisir « Je ne sais pas, montrez-moi ». Il n’y a pas de note.</p>
      ${result && current ? `<button type="button" class="learning-button learning-resume" data-learning="resume">Revoir mon résultat : ${current.title}</button>` : ''}
      <p class="learning-progress">${explored.size} sur 3 expériences explorées pendant cette session</p>
      <div class="learning-challenges">${challenges.map((challenge, index) => `
        <button type="button" class="learning-challenge" data-learning-challenge="${challenge.id}">
          <span class="learning-number" aria-hidden="true">0${index + 1}</span>
          <span><strong>${challenge.title}</strong><small>${challenge.topic} · environ 2 min${explored.has(challenge.id) ? ' · exploré' : ''}</small></span>
          <svg class="learning-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>`).join('')}</div>
      <button type="button" class="learning-canal-entry" data-learning="canal-cut" aria-haspopup="dialog" aria-controls="canal-cut">
        <svg class="learning-canal-illustration" viewBox="0 0 92 64" aria-hidden="true"><rect width="92" height="64" rx="5" fill="#efe5d2"/><path d="M11 12 31 53h30l20-41" fill="#d6c7a3" stroke="#6f6959" stroke-width="1.6"/><path d="M18 26h56L61 51H31Z" fill="#a9cfd0"/><path d="M25 40c11-9 23 7 42-2l-6 13H31Z" fill="#c69c60"/><path d="M19 25c7-2 11 2 18 0s11 2 18 0 11 2 18 0" fill="none" stroke="#3e8290" stroke-width="1.4"/><path d="M34 34h22m-5-4 5 4-5 4" fill="none" stroke="#3e8290" stroke-width="1.4"/><g fill="#8f703e"><circle cx="36" cy="45" r="1"/><circle cx="45" cy="48" r="1"/><circle cx="54" cy="44" r="1"/></g></svg>
        <span><strong>Le canal en coupe</strong><small>Voyez comment le sable réduit le passage de l’eau, puis dégagez le canal.</small></span>
        <svg class="learning-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button type="button" class="learning-canal-entry" data-learning="alternator-cut" aria-haspopup="dialog" aria-controls="alternator-cut">
        <svg class="learning-canal-illustration" viewBox="0 0 92 64" aria-hidden="true"><rect width="92" height="64" rx="5" fill="#efe5d2"/><circle cx="32" cy="32" r="24" fill="#d6c7a3" stroke="#6f6959" stroke-width="1.4"/><circle cx="32" cy="32" r="17" fill="#f7efdf" stroke="#92866e" stroke-width="1"/><g fill="#bd8855" stroke="#8f603b" stroke-width="1"><rect x="28" y="9" width="8" height="9" rx="2"/><rect x="28" y="46" width="8" height="9" rx="2"/><rect x="9" y="28" width="9" height="8" rx="2"/><rect x="46" y="28" width="9" height="8" rx="2"/></g><path d="M21 32a11 11 0 0 1 22 0Z" fill="#b97669"/><path d="M21 32a11 11 0 0 0 22 0Z" fill="#719ba5"/><circle cx="32" cy="32" r="3" fill="#f7efdf" stroke="#6f6959"/><path d="M22 22c5-6 13-6 19-1m-1-5 1 5-5 1" fill="none" stroke="#6f6959" stroke-width="1.2"/><path d="M61 32h27" stroke="#a79a7e" stroke-width="1"/><path d="M61 32c4-17 9-17 13 0s9 17 13 0" fill="none" stroke="#3e8290" stroke-width="1.7"/></svg>
        <span><strong>L’alternateur en coupe</strong><small>Rotor → bobines fixes → tensions alternées.</small></span>
        <svg class="learning-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <div class="learning-footer-links"><button type="button" class="learning-button" data-learning="glossary">Ouvrir le lexique</button><button type="button" class="learning-button learning-button-quiet" data-learning="recap">Les 3 idées essentielles</button></div>
      <p class="learning-note">Ces expériences utilisent le modèle pédagogique de l’application. Elles ne décrivent pas l’état actuel des installations.</p>`);
    content.querySelectorAll('[data-learning-challenge]').forEach(el => el.addEventListener('click', () => challenge(el.dataset.learningChallenge)));
    bind('glossary', glossary);
    bind('recap', recap);
    bind('canal-cut', () => window.IngaCanal?.open());
    bind('alternator-cut', () => window.IngaAlternator?.open());
    bind('resume', () => resultView === 'scene' ? observe() : resultView === 'explain' ? explanation() : comparison());
  }

  function bind(action, callback) {
    content.querySelector(`[data-learning="${action}"]`)?.addEventListener('click', callback);
  }

  function steps(active) {
    return `<ol class="learning-steps" aria-label="Étapes de l’expérience">${['Votre idée', 'Le résultat', 'Pourquoi'].map((label, index) => `<li${index + 1 === active ? ' aria-current="step"' : ''}><span aria-hidden="true">${index + 1}</span>${label}</li>`).join('')}</ol>`;
  }

  function challenge(id) {
    current = challenges.find(item => item.id === id);
    if (!current) return hub();
    prediction = null;
    result = null;
    const index = challenges.indexOf(current) + 1;
    layout(current.title, `Expérience ${index} sur 3 · Étape 1 sur 3`, `
      ${steps(1)}
      <p class="learning-situation"><strong>Ce que nous allons changer</strong>${current.action}</p>
      <p class="learning-instruction" id="learning-instruction">Choisissez ce que vous pensez. Vous pouvez vous tromper : le résultat vous sera expliqué.</p>
      <form id="learning-prediction"><fieldset class="learning-choices"><legend>${current.question}</legend>
      ${choices.map(([value, label]) => `<label class="learning-choice"><input type="radio" name="prediction" value="${value}" required aria-describedby="learning-instruction"><span><strong>${label}</strong></span></label>`).join('')}
      </fieldset><div class="learning-decision"><button class="learning-button learning-primary" type="submit" id="learning-test" disabled>Lancer l’expérience</button><button class="learning-button" type="button" data-learning="skip-prediction">Je ne sais pas, montrez-moi</button></div></form>
      <p class="learning-note">La fenêtre se ferme au lancement. Vous verrez la maquette avant le changement, puis après. Les réglages sont automatiques ; les boutons Avant / Après vous permettent de comparer librement.</p>
      <details class="learning-details"><summary>Voir les réglages de cette expérience</summary><p>${current.setup}</p><p>Ici, « beaucoup » signifie plus de 5 % de variation ; « peu », 5 % maximum.</p></details>
      <button type="button" class="learning-back" data-learning="hub">← Choisir une autre expérience</button>`);
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
      runExperiment();
    });
    bind('skip-prediction', () => { prediction = null; runExperiment(); });
  }

  function runExperiment() {
    const before = api.simulate(clone(api.BASE));
    applyOwnedPreset('normal');
    applyOwnedPreset(current.id);
    const after = clone(api.R);
    result = { before, after, percent: before.Pgen ? (after.Pgen - before.Pgen) / before.Pgen * 100 : 0 };
    observe('before', true);
  }

  function changeText() {
    const { before, after, percent } = result;
    return Math.abs(percent) < 0.05 ? 'La puissance produite reste identique.' : `La puissance produite ${percent < 0 ? 'baisse' : 'augmente'} de ${decimal.format(Math.abs(percent))} % (${mw(Math.abs(after.Pgen - before.Pgen))}).`;
  }

  function comparison() {
    resultView = 'compare';
    const { before, after, percent } = result;
    const direction = percent < -5 ? 'down' : percent > 5 ? 'up' : 'near';
    const matched = prediction === direction;
    const choiceLabel = value => choices.find(choice => choice[0] === value)[1];
    const scale = Math.max(before.Pgen, after.Pgen, 1);
    const metrics = [['Puissance produite', mw(before.Pgen), mw(after.Pgen)], ['Puissance livrée', mw(before.Prec), mw(after.Prec)], ['Débit turbiné', `${number.format(before.Qdiv)} m³/s`, `${number.format(after.Qdiv)} m³/s`]];
    layout(current.title, `Expérience ${challenges.indexOf(current) + 1} sur 3 · Étape 2 sur 3`, `
      ${steps(2)}
      <p class="learning-applied">Résultat de cette expérience : <strong>${current.afterLabel}.</strong> Voici ce que le simulateur a calculé :</p>
      <div class="learning-comparison" role="group" aria-label="Puissance produite avant et après le changement">
        <h3>Électricité produite par les centrales</h3>
        ${[['Avant', current.beforeLabel, before.Pgen], ['Après', current.afterLabel, after.Pgen]].map(([label, situation, value]) => `<div class="learning-bar-row"><div><span><b>${label}</b> · ${situation}</span><strong>${mw(value)}</strong></div><div class="learning-bar-track" aria-hidden="true"><span style="width:${value / scale * 100}%"></span></div></div>`).join('')}
        <p>${changeText()}</p><small>MW = mégawatts, l’unité de puissance électrique. Plus la barre est longue, plus les centrales produisent.</small>
      </div>
      <div class="learning-verdict"><p>${prediction ? `Vous aviez choisi : « ${choiceLabel(prediction)} ».` : 'Vous avez choisi de découvrir sans répondre.'}</p><strong>${prediction ? matched ? 'Votre réponse est correcte.' : 'Le résultat est différent de votre réponse.' : 'Voici ce que l’on observe.'}</strong><p class="learning-answer">${choiceLabel(direction)}.</p></div>
      <div class="learning-actions"><button type="button" class="learning-button learning-primary" data-learning="explain">Comprendre pourquoi →</button><button type="button" class="learning-button" data-learning="observe">Revoir sur la maquette</button></div>
      <details class="learning-details"><summary>Voir tous les chiffres</summary><table class="learning-results"><caption>Résultats simulés pour cette expérience</caption><thead><tr><th scope="col">Mesure</th><th scope="col">Avant</th><th scope="col">Après</th></tr></thead><tbody>${metrics.map(([label, a, b]) => `<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table></details>
      <button type="button" class="learning-back" data-learning="retry">← Recommencer cette expérience</button>`);
    bind('explain', explanation);
    bind('observe', () => observe());
    bind('retry', () => challenge(current.id));
  }

  function explanation() {
    resultView = 'explain';
    explored.add(current.id);
    const next = challenges[challenges.indexOf(current) + 1];
    layout(current.title, `Expérience ${challenges.indexOf(current) + 1} sur 3 · Étape 3 sur 3`, `
      ${steps(3)}
      <section class="learning-explanation"><h3>Pourquoi ce résultat ?</h3><ol class="learning-cause">${current.cause.map((text, i) => `<li><span aria-hidden="true">${i + 1}</span><p>${text}</p></li>`).join('')}</ol>
      <details class="learning-details"><summary>Aller plus loin</summary><p>${current.explanation}</p></details></section>
      <p class="learning-takeaway"><strong>À retenir</strong>${current.takeaway}</p>
      <div class="learning-actions"><button type="button" class="learning-button learning-primary" data-learning="next">${next ? 'Expérience suivante →' : 'Revenir aux expériences'}</button><button type="button" class="learning-button" data-learning="observe">${current.observe}</button></div>
      <p class="learning-note">Le bouton « Voir » rouvre la maquette avec les commandes Avant / Après. Vous pourrez revenir au résultat depuis le petit panneau.</p>
      <button type="button" class="learning-back" data-learning="compare">← Revoir l’avant et l’après</button>
      <button type="button" class="learning-back" data-learning="glossary">Un mot à éclaircir ? Ouvrir le lexique</button>`);
    bind('compare', comparison);
    bind('observe', () => observe());
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
      <button type="button" class="learning-back" data-learning="back">← ${result ? 'Revenir au résultat' : 'Revenir aux expériences'}</button>
      <p class="learning-lead">Des définitions pour lire la maquette et son bilan.</p>
      <label class="learning-search" for="learning-search">Chercher un mot<input id="learning-search" type="search" placeholder="Débit, puissance, turbine…" autocomplete="off"></label>
      <p id="learning-found" class="learning-note" role="status" aria-live="polite">12 définitions</p>
      <dl class="learning-glossary">${definitions.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join('')}</dl>`);
    bind('back', () => result && current ? resultView === 'explain' ? explanation() : comparison() : hub());
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
