/* Read-only first and last chapters of the water-to-electricity journey. */
(() => {
  'use strict';
  const api = window.__INGA, app = document.getElementById('app');
  if (!api || !app) return;
  const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const modal = document.createElement('div');
  modal.id = 'journey-detail'; modal.className = 'modal canal-modal endpoint-modal'; modal.hidden = true;
  modal.innerHTML = `<section class="mbox canal-box endpoint-box" role="dialog" aria-modal="true" aria-labelledby="journey-detail-title">
    <header class="canal-header"><div><p id="journey-detail-kicker">Du fleuve à la ville</p><h2 id="journey-detail-title" tabindex="-1"></h2></div><div class="canal-header-actions"><button id="journey-detail-motion" type="button" aria-pressed="false" aria-label="Mettre le dessin en pause"></button><button type="button" class="canal-close endpoint-close" aria-label="Fermer cette étape">×</button></div></header>
    <div class="canal-body"><div class="canal-lab"><figure class="canal-figure"><div class="canal-plate" id="journey-detail-plate"></div><figcaption><span><i class="endpoint-water-key"></i><b id="endpoint-figure-key"></b></span><span>Schéma pédagogique</span></figcaption></figure><div class="canal-console endpoint-console" id="journey-detail-console"></div></div></div>
    <footer class="canal-footer"><span id="journey-detail-footer-note"></span><button type="button" class="btn pri" id="journey-detail-return">Retour à la maquette</button></footer>
  </section>`;
  app.append(modal);
  const $ = selector => modal.querySelector(selector);
  const sync = () => window.syncAccessibility?.();
  let active = false, kind = null, paused = reduced.matches;

  function svg(kind, title, description, drawing) {
    return `<svg id="journey-detail-svg" class="endpoint-drawing" data-kind="${kind}" viewBox="0 0 900 620" role="img" aria-labelledby="endpoint-svg-title endpoint-svg-description" xmlns="http://www.w3.org/2000/svg">
      <title id="endpoint-svg-title">${title}</title><desc id="endpoint-svg-description">${description}</desc>
      <defs><linearGradient id="endpoint-paper" x2="1" y2="1"><stop stop-color="#eee7d2"/><stop offset="1" stop-color="#e5dbc0"/></linearGradient><linearGradient id="endpoint-water" x2="0" y2="1"><stop stop-color="#a9c7cc"/><stop offset="1" stop-color="#82adb8"/></linearGradient><pattern id="endpoint-hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M-2 2 7 11M2-2 11 7" stroke="#7f7054" stroke-opacity=".23" stroke-width=".8"/></pattern><marker id="endpoint-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="m1 1 7 4-7 4" fill="none" stroke="#427c8e" stroke-width="1.3"/></marker></defs>
      <rect width="900" height="620" fill="url(#endpoint-paper)"/><path d="M40 73H860M40 519H860" stroke="#83734f" stroke-opacity=".24"/>
      <text x="40" y="44" class="endpoint-svg-title">${title}</text><text x="859" y="44" text-anchor="end" class="endpoint-svg-note">Coupe de principe</text>${drawing}</svg>`;
  }

  function riverDrawing() {
    const upstream = 'M24 275C106 248 159 250 224 276';
    const bypass = 'M224 276C289 307 378 365 487 348S661 251 744 252';
    const downstream = 'M744 252Q815 252 876 271';
    const river = `${upstream}${bypass}${downstream}`;
    const feed = 'M224 276Q214 184 344 151H418';
    const branches = 'M418 151H454Q480 151 480 180V227M418 151H574Q600 151 600 180V227';
    const returns = 'M480 269V282Q480 308 512 308H669Q712 308 744 252M600 269V282Q600 308 624 308';
    const plant = (x, name) => `<g class="endpoint-plant"><text x="${x}" y="125" text-anchor="middle">${name}</text><rect x="${x - 34}" y="222" width="68" height="55" rx="2" fill="#cfc2a3" stroke="#74674f"/><path d="M${x - 39} 222 ${x} 204 ${x + 39} 222Z" fill="#a2a69c" stroke="#686c60"/><rect x="${x - 27}" y="228" width="54" height="43" fill="url(#endpoint-hatch)"/><circle cx="${x}" cy="249" r="15" fill="#e4dcc7" stroke="#6b6658"/><path d="M${x - 11} 249H${x + 11}M${x} 238V260M${x - 8} 241 ${x + 8} 257M${x - 8} 257 ${x + 8} 241" stroke="#778e92" stroke-width="2"/><circle cx="${x}" cy="249" r="4" fill="#93886e"/></g>`;
    return svg('river', 'Une partie de l’eau est dérivée', 'Une large rivière continue de gauche à droite. Une prise envoie une fraction de l’eau vers un canal, puis vers Inga I et Inga II en parallèle. Après les turbines, cette eau rejoint le fleuve.', `
      <path d="${river}" class="endpoint-river-bank"/><path d="${river}" class="endpoint-river-water"/>
      <path d="${upstream}" class="endpoint-flow endpoint-river-upstream"/><path d="${bypass}" class="endpoint-flow endpoint-river-bypass"/><path d="${downstream}" class="endpoint-flow endpoint-river-downstream"/>
      <g class="endpoint-emphasis endpoint-river-intake"><circle cx="234" cy="220" r="31"/></g>
      <g class="endpoint-emphasis endpoint-river-split"><rect x="359" y="121" width="277" height="70" rx="16"/></g>
      <g class="endpoint-emphasis endpoint-river-return"><circle cx="734" cy="274" r="45"/></g>
      <path d="${feed}${branches}${returns}" fill="none" stroke="#746b55" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${feed}${branches}${returns}" fill="none" stroke="#a8cbd1" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${feed}${branches}${returns}" class="endpoint-flow endpoint-diversion-flow"/>
      <path d="M220 222H248M224 214V232M242 214V232" fill="none" stroke="#756b53" stroke-width="3"/>
      <path d="M224 214H242V210H224Z" fill="#c7b692" stroke="#756b53"/>
      ${plant(480, 'Inga I')}${plant(600, 'Inga II')}
      <text x="69" y="169">Prise d’eau</text><path d="M157 181 206 198 225 210" class="endpoint-leader"/>
      <text x="294" y="116">Le canal</text><path d="M333 163H391" class="endpoint-direction"/>
      <text x="89" y="345" class="endpoint-river-name">Le Congo</text>
      <path d="M319 347 365 364" class="endpoint-direction"/><path d="M787 258 829 265" class="endpoint-direction"/>
      <text x="132" y="434">Le reste poursuit son cours.</text><path d="M399 414 422 382" class="endpoint-leader"/>
      <text x="614" y="388">Retour au fleuve</text><path d="M735 366 740 312" class="endpoint-leader"/>
      <path d="M75 549H124" stroke="#7ca8b5" stroke-width="13" stroke-linecap="round"/><text x="141" y="553" class="endpoint-key-text">Le fleuve</text>
      <path d="M351 549H400" stroke="#6096a8" stroke-width="5" stroke-linecap="round"/><text x="417" y="553" class="endpoint-key-text">La dérivation</text>
      <path d="M663 549H705" class="endpoint-direction"/><text x="723" y="553" class="endpoint-key-text">Le retour</text>
      <text x="450" y="598" text-anchor="middle" class="endpoint-svg-conclusion">L’eau n’est pas consommée par les turbines.</text>`);
  }

  function cityDrawing() {
    return svg('city', 'Du réseau aux usages', 'Le réseau arrive dans un poste où la tension est abaissée pour la distribution. Des lignes de distribution alimentent ensuite des logements, une école et un atelier. Ces usages sont illustratifs, sans calcul d’équivalents de maisons.', `
      <g class="endpoint-emphasis endpoint-city-arrival"><rect x="208" y="162" width="152" height="231" rx="14"/></g>
      <g class="endpoint-emphasis endpoint-city-distribution"><rect x="357" y="298" width="514" height="128" rx="14"/></g>
      <g class="endpoint-emphasis endpoint-city-uses"><rect x="489" y="193" width="385" height="198" rx="14"/></g>
      <g fill="none" stroke="#6c6657" stroke-width="1.8"><path d="M69 374 101 166 111 166 143 374M85 276 126 224 94 211 133 321 78 321 137 366M97 189H145M66 208H145M62 231H150M64 254H154"/><path d="M60 379H149" stroke-width="5"/></g>
      <g fill="none" stroke="#635e50" stroke-width="1.6"><path d="M23 184Q101 241 253 204M23 211Q118 269 270 219M23 238Q133 296 287 234"/></g>
      <g class="endpoint-city-flow endpoint-city-incoming" fill="none"><path d="M23 184Q101 241 253 204M23 211Q118 269 270 219M23 238Q133 296 287 234"/></g>
      <text x="46" y="125">Le réseau</text><text x="211" y="126">Poste d’arrivée</text>
      <rect x="233" y="279" width="94" height="96" rx="4" fill="#bfb090" stroke="#655c49" stroke-width="1.5"/><rect x="225" y="375" width="113" height="10" rx="1" fill="#d0c2a4" stroke="#817154"/>
      <path d="M242 292V362M252 292V362M262 292V362M272 292V362M282 292V362M292 292V362M302 292V362M312 292V362" stroke="#847353" stroke-width="2"/>
      <g stroke="#79684b" fill="#bbaa88"><path d="M253 204V279M270 219V279M287 234V279" stroke-width="2"/><path d="M245 231H261M245 239H261M245 247H261M245 255H261M245 263H261M262 238H278M262 246H278M262 254H278M262 262H278M279 245H295M279 253H295M279 261H295" stroke-width="3"/></g>
      <path d="M327 333H372V408H853M539 408V371M666 408V372M814 408V374" fill="none" stroke="#807252" stroke-width="3" stroke-linejoin="round"/>
      <path d="M327 333H372V408H853M539 408V371M666 408V372M814 408V374" class="endpoint-city-flow endpoint-city-outgoing"/>
      <text x="430" y="443">Distribution</text><path d="M460 426V408" class="endpoint-leader"/>
      <text x="180" y="443" class="endpoint-use-label">Tension abaissée</text><path d="M276 422V388" class="endpoint-leader"/>
      <g stroke="#6e624b" stroke-width="1.4"><rect x="500" y="291" width="80" height="81" rx="1" fill="#d6c9a9"/><path d="M492 291 539 254 587 291Z" fill="#8b9a9b"/><rect x="550" y="261" width="9" height="21" fill="#b8a98a"/><rect x="531" y="343" width="17" height="29" rx="1" fill="#a19375"/><rect class="endpoint-window" x="510" y="307" width="16" height="23"/><rect class="endpoint-window" x="551" y="307" width="16" height="23"/><path d="M518 307V330M559 307V330" stroke-width=".8"/></g>
      <g stroke="#6f624c" stroke-width="1.3"><rect x="613" y="252" width="110" height="120" fill="#d7caaa"/><path d="M604 252 668 214 732 252Z" fill="#a99572"/><rect x="655" y="337" width="27" height="35" fill="#a79570"/><path d="M668 337V372"/><circle cx="668" cy="244" r="12" fill="#ede5cf"/><path d="M668 236V244L675 246"/><rect class="endpoint-window" x="626" y="271" width="17" height="21"/><rect class="endpoint-window" x="660" y="271" width="17" height="21"/><rect class="endpoint-window" x="693" y="271" width="17" height="21"/><rect class="endpoint-window" x="626" y="306" width="17" height="21"/><rect class="endpoint-window" x="693" y="306" width="17" height="21"/></g>
      <g stroke="#6f624b" stroke-width="1.4"><path d="M752 307 786 278V301L824 278V301L866 278V374H752Z" fill="#cfbfa0"/><path d="M752 307 786 278V301L824 278V301L866 278" fill="none" stroke-width="3"/><rect x="786" y="337" width="35" height="37" rx="1" fill="#a5997d"/><rect class="endpoint-window" x="762" y="317" width="20" height="15"/><rect class="endpoint-window" x="833" y="317" width="22" height="15"/></g>
      <g transform="translate(849 354)"><g class="endpoint-workshop-wheel" stroke="#7b6947"><circle r="10" fill="#d8cbb0"/><path d="M-8 0H8M0-8V8M-6-6 6 6M-6 6 6-6"/><circle r="3" fill="#938065"/></g></g>
      <g stroke="#7b7257" stroke-width="1.2"><path d="M593 375V351"/><circle cx="593" cy="348" r="11" fill="#a5ad88"/><path d="M730 375V353"/><circle cx="730" cy="350" r="8" fill="#b4b993"/></g>
      <path d="M486 378H875" stroke="#b1a07c"/><text x="539" y="483" text-anchor="middle" class="endpoint-use-label">Logements</text><text x="668" y="483" text-anchor="middle" class="endpoint-use-label">École</text><text x="815" y="483" text-anchor="middle" class="endpoint-use-label">Atelier</text>
      <circle cx="66" cy="551" r="6" fill="#bc8d38"/><text x="86" y="555" class="endpoint-key-text">Énergie livrée</text><text x="486" y="555" class="endpoint-key-text">Des usages illustratifs</text>
      <text x="450" y="598" text-anchor="middle" class="endpoint-svg-conclusion">La tension est adaptée avant d’arriver aux bâtiments.</text>`);
  }

  const explanations = {
    river: [
      ['intake', 'La prise', 'Une prise en rive droite dirige une fraction du débit vers le système d’amenée. Le reste du Congo poursuit son cours.'],
      ['split', 'Les centrales', 'L’eau du canal alimente Inga I et Inga II en parallèle. Elle ne traverse pas successivement les deux centrales.'],
      ['return', 'Le retour', 'Après les turbines, l’eau rejoint le fleuve en aval. L’énergie est convertie ; l’eau n’est pas consommée.']
    ],
    city: [
      ['arrival', 'L’arrivée', 'Le réseau transporte l’électricité jusqu’aux postes d’arrivée. La puissance livrée est inférieure à la puissance produite à cause des pertes de transport du modèle.'],
      ['distribution', 'Distribuer', 'Les postes abaissent la tension pour la distribution, avec d’autres adaptations jusqu’aux bâtiments. Les équipements et leurs pertes propres ne sont pas calculés ici.'],
      ['uses', 'Les usages', 'Habitations, services et ateliers utilisent l’électricité. Ces bâtiments illustrent des usages ; le modèle ne calcule ni leur consommation ni un nombre de maisons alimentées.']
    ]
  };

  function render() {
    const river = kind === 'river';
    $('#journey-detail-title').textContent = river ? 'Le fleuve et la dérivation' : 'L’arrivée de l’électricité en ville';
    $('#journey-detail-kicker').textContent = river ? 'Du fleuve à la ville · le départ' : 'Du fleuve à la ville · les usages';
    $('#journey-detail-plate').innerHTML = river ? riverDrawing() : cityDrawing();
    $('#endpoint-figure-key').textContent = river ? 'Chemin de l’eau' : 'Énergie transportée';
    modal.dataset.kind = kind;
    const metric = (label, id, unit, extra = '') => `<div><span>${label}</span><strong id="${id}"></strong><small>${unit}</small>${extra ? `<p>${extra}</p>` : ''}</div>`;
    $('#journey-detail-console').innerHTML = `
      <p class="endpoint-live"><span></span>Votre simulation · aucune mesure SNEL en direct</p>
      <p class="endpoint-lead">${river ? 'Suivez une partie de l’eau du Congo jusqu’aux centrales, puis retrouvez-la dans le fleuve.' : 'Suivez l’électricité jusqu’à la distribution, puis aux usages du quotidien.'}</p>
      ${river ? '' : '<p id="endpoint-recap" class="endpoint-note"><strong>À retenir</strong><br>L’eau fait tourner la turbine, qui entraîne l’alternateur. Il produit l’électricité, transportée par les lignes. Les transformateurs adaptent la tension. L’eau retourne au fleuve.</p>'}
      <div class="endpoint-measures">${river
        ? metric('Débit du fleuve', 'endpoint-river-flow', 'm³/s') + metric('Vers les turbines', 'endpoint-diverted', 'm³/s') + metric('Reste dans le fleuve', 'endpoint-bypass', 'm³/s')
        : metric('Produit aux centrales', 'endpoint-generated', 'MW') + metric('Livré au réseau', 'endpoint-delivered', 'MW') + metric('Part vers Kinshasa', 'endpoint-kinshasa', 'MW', 'Répartition illustrative du modèle.')}</div>
      <p id="endpoint-main-insight" class="endpoint-insight"></p>
      <div class="endpoint-stages" role="group" aria-label="${river ? 'Suivre l’eau' : 'Suivre l’électricité'}">${explanations[kind].map(([key, title], index) => `<button type="button" data-endpoint-stage="${key}" aria-pressed="${index === 0}"><span>0${index + 1}</span>${title}</button>`).join('')}</div>
      <p id="journey-detail-explanation" class="endpoint-explanation" role="status" aria-live="polite"></p>
      ${river ? '<p class="endpoint-note">Ces débits sont calculés à partir des réglages de la maquette. Ils ne donnent pas l’état réel du site.</p>' : '<p id="endpoint-loss-note" class="endpoint-note"></p><p class="endpoint-note">Ce bilan principal est distinct de l’expérience indépendante du transformateur, qui démarre à 100 MW. Modifier sa comparaison 200 / 400 kV ne modifie pas les chiffres ci-dessus.</p>'}
      <details class="canal-sources"><summary>Repères et limites du dessin</summary>${river
        ? '<p>Le plan SNEL reproduit dans le dossier Banque mondiale PMEDE de 2011 [S01] décrit la prise, le système d’amenée et les deux centrales. Le débit moyen d’environ 40 000 m³/s est un repère historique. La planche est schématique : ni échelle, ni bathymétrie, ni simulation de remous.</p><p>Les traits animés montrent le sens de circulation. Leur vitesse ne représente pas une vitesse mesurée de l’eau.</p>'
        : '<p>Les couloirs de transport s’appuient sur des références datées [S01, S04, S16]. Cette planche montre le principe de l’arrivée et de la distribution ; elle ne reproduit pas le réseau urbain réel de Kinshasa.</p><p>La part de puissance vers Kinshasa est une répartition choisie dans le modèle, sans ventilation SNEL confirmée. Les bâtiments sont illustratifs : aucune tension de distribution, consommation ou équivalence en logements n’est attribuée.</p><p>Les points dorés représentent le transfert moyen d’énergie, pas le déplacement des électrons.</p>'}</details>`;
    write('#journey-detail-footer-note', river ? 'L’eau rejoint le fleuve après les turbines.' : 'De l’énergie livrée, puis distribuée aux usages.');
    setFocus(explanations[kind][0][0]);
  }

  function write(selector, text) { const el = $(selector); if (el && el.textContent !== text) el.textContent = text; }
  function update() {
    if (!active || modal.hidden) return;
    const r = api.R, s = api.S;
    const value = key => Math.max(0, Number.isFinite(r[key]) ? r[key] : 0);
    if (kind === 'river') {
      const river = value('Qr'), diverted = value('Qdiv'), bypass = value('bypass');
      write('#endpoint-river-flow', number.format(river)); write('#endpoint-diverted', number.format(diverted)); write('#endpoint-bypass', number.format(bypass));
      write('#endpoint-main-insight', river > 0 ? `${number.format(diverted / river * 100)} % du débit du fleuve passent ici par les turbines.` : 'Aucun débit du fleuve dans ce réglage.');
      modal.classList.toggle('endpoint-no-water', river <= 0);
      modal.classList.toggle('endpoint-no-diversion', diverted <= 0);
      modal.classList.toggle('endpoint-no-bypass', bypass <= 0);
    } else {
      const generated = value('Pgen'), delivered = value('Prec');
      write('#endpoint-generated', number.format(generated)); write('#endpoint-delivered', number.format(delivered)); write('#endpoint-kinshasa', number.format(value('kin')));
      write('#endpoint-main-insight', generated > 0 ? `${number.format(Math.max(0, generated - delivered))} MW séparent la production de la puissance livrée.` : 'Aucune puissance produite dans ce réglage.');
      const lossPercent = Number.isFinite(s.loss) ? Math.max(0, s.loss * 100) : 0;
      write('#endpoint-loss-note', `Pertes du bilan principal : ${number.format(lossPercent)} %, hypothèse de la maquette. Le transport, la répartition et les usages restent schématiques.`);
      modal.classList.toggle('endpoint-city-lit', delivered > 0);
    }
  }

  function setFocus(key) {
    const entry = explanations[kind]?.find(row => row[0] === key); if (!entry) return;
    modal.dataset.focus = key;
    modal.querySelectorAll('[data-endpoint-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.endpointStage === key)));
    write('#journey-detail-explanation', entry[2]);
  }

  function motion() {
    const stopped = paused || reduced.matches;
    modal.classList.toggle('endpoint-running', active && !modal.hidden && !stopped);
    const button = $('#journey-detail-motion');
    button.setAttribute('aria-pressed', String(stopped));
    button.setAttribute('aria-label', stopped ? 'Reprendre l’animation du dessin' : 'Mettre le dessin en pause');
    button.disabled = reduced.matches;
    if (reduced.matches) button.setAttribute('aria-label', 'Animation désactivée : préférence de mouvement réduit');
    button.innerHTML = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">${stopped ? '<path d="m6 3 11 7-11 7Z" fill="currentColor"/>' : '<path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="3"/>'}</svg>`;
  }
  function teardown() { active = false; modal.classList.remove('endpoint-running'); window.removeEventListener('inga:simulationchange', update); }
  function close() { teardown(); modal.hidden = true; sync(); }
  function open(nextKind) {
    if (!['river', 'city'].includes(nextKind) || api.mode !== 'live') return false;
    const tour = document.getElementById('tourBtn'); if (tour?.getAttribute('aria-pressed') === 'true') tour.click();
    window.IngaProduct?.dismiss(); window.IngaCanal?.close(); window.IngaAlternator?.close(); window.IngaTransformer?.close(); window.closeCut?.(); window.closeInfo?.();
    document.querySelectorAll('.modal:not([hidden])').forEach(other => { if (other !== modal) other.hidden = true; });
    teardown(); kind = nextKind; paused = reduced.matches; render();
    active = true; modal.hidden = false; window.addEventListener('inga:simulationchange', update);
    update(); motion(); $('.endpoint-console').scrollTop = 0;
    sync(); $('#journey-detail-title').focus({ preventScroll: true });
    return true;
  }
  $('#journey-detail-motion').onclick = () => { paused = !paused; motion(); };
  $('.endpoint-close').onclick = close; $('#journey-detail-return').onclick = close;
  $('#journey-detail-console').addEventListener('click', event => { const button = event.target.closest('[data-endpoint-stage]'); if (button) setFocus(button.dataset.endpointStage); });
  new MutationObserver(() => { if (modal.hidden) teardown(); sync(); }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  reduced.addEventListener('change', () => { paused = reduced.matches; if (active) motion(); });
  window.IngaJourneyEndpoints = Object.freeze({ open, close });
  sync();
})();
