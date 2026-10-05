/* Schematic transformer and transmission plate. Values come from the lesson's local model. */
(() => {
  'use strict';
  const W = 900, H = 620, TAU = Math.PI * 2;
  const PAPER = '#e9e1ca', INK = '#373228', COPPER = '#af7946', FLUX = '#4d8495', ENERGY = '#bd8c37';
  const HAND = '"Architects Daughter", "Segoe Print", cursive', SANS = '"IBM Plex Sans", sans-serif';
  let paper = null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const seed = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  function texture() {
    if (paper) return paper;
    paper = document.createElement('canvas'); paper.width = W; paper.height = H;
    const p = paper.getContext('2d'); p.fillStyle = PAPER; p.fillRect(0, 0, W, H);
    const shade = p.createLinearGradient(0, 0, W, H);
    shade.addColorStop(0, 'rgba(255,255,240,.20)'); shade.addColorStop(1, 'rgba(99,74,32,.055)');
    p.fillStyle = shade; p.fillRect(0, 0, W, H);
    for (let i = 0; i < 1500; i++) {
      p.fillStyle = i % 2 ? 'rgba(71,52,27,.035)' : 'rgba(255,255,245,.18)';
      p.fillRect(seed(i) * W, seed(i + 510) * H, 1 + seed(i + 22) * 2, .7);
    }
    return paper;
  }

  function draw(canvas, state = {}) {
    if (!canvas?.width || !canvas?.height) return;
    const c = canvas.getContext('2d'); if (!c) return;
    const phase = finite(state.phase, 0), voltage = clamp(finite(state.voltage, 200), 200, 400);
    const inputVoltage = Math.max(.1, finite(state.inputVoltage, 20));
    const power = Math.max(0, finite(state.power, 100)), received = Math.max(0, finite(state.received, power));
    const loss = power > 0 ? Math.max(0, finite(state.loss, 0)) : 0;
    const referenceLoss = Math.max(.000001, finite(state.referenceLoss, 1));
    const heat = clamp(loss / referenceLoss, 0, 1.5);
    const lit = power > 0 && received > 0;
    const focus = state.focus || null;
    const scale = Math.min(canvas.width / W, canvas.height / H);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, canvas.width, canvas.height); c.fillStyle = PAPER; c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
    c.drawImage(texture(), 0, 0); c.lineCap = 'round'; c.lineJoin = 'round'; c.textBaseline = 'middle';

    function path(points, close = false) {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (close) c.closePath();
    }
    function line(points, color = INK, width = 1.2, dash = []) {
      path(points); c.lineWidth = width; c.strokeStyle = color; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
    }
    function polygon(points, fill, stroke = INK, width = 1.2) {
      path(points, true); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function rect(x, y, w, h, radius, fill, stroke = INK, width = 1.2) {
      c.beginPath(); c.roundRect(x, y, w, h, radius);
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function circle(x, y, radius, fill, stroke = INK, width = 1) {
      c.beginPath(); c.arc(x, y, radius, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function label(value, x, y, size = 26, color = INK, align = 'left', font = HAND) {
      c.font = `${size}px ${font}`; c.textAlign = align; c.fillStyle = color; c.fillText(value, x, y);
    }
    function arrow(x, y, angle, color, size = 8, width = 1.8) {
      line([[x - size * Math.cos(angle - .5), y - size * Math.sin(angle - .5)], [x, y],
        [x - size * Math.cos(angle + .5), y - size * Math.sin(angle + .5)]], color, width);
    }
    function glowBox(x, y, w, h) {
      rect(x, y, w, h, 10, 'rgba(205,155,65,.035)', 'rgba(184,130,43,.14)', 12);
      rect(x, y, w, h, 10, null, 'rgba(169,119,42,.55)', 1);
    }
    function cable(a, b, sag) {
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, b[0], b[1]);
      c.lineWidth = 1.5; c.strokeStyle = '#514d43'; c.stroke();
    }
    function onCable(a, b, sag, t) {
      const q = 1 - t;
      return [a[0] + (b[0] - a[0]) * t,
        q * q * a[1] + 2 * q * t * ((a[1] + b[1]) / 2 + sag) + t * t * b[1]];
    }
    function energyDot(x, y, strength = 1) {
      circle(x, y, 5.5, `rgba(214,164,61,${.16 * strength})`, null);
      circle(x, y, 2.6, `rgba(173,120,30,${.94 * strength})`, null);
    }

    label('De la centrale à la ville', 40, 41, 32);
    label('Coupe de principe', 858, 43, 19, '#796c56', 'right', SANS);
    line([[40, 73], [860, 73]], 'rgba(88,71,43,.24)');
    label('Le transformateur', 43, 113, 29);
    label('Le transport', 454, 113, 29);
    label('La ville', 771, 113, 29);
    if (focus === 'transformer') glowBox(31, 164, 321, 269);
    if (focus === 'line') glowBox(422, 154, 244, 278);
    if (focus === 'city') glowBox(679, 292, 199, 143);

    // Fixed laminated iron core. Only its field reverses; no transformer part rotates.
    rect(99, 183, 214, 237, 14, '#bdb298', INK, 1.6);
    for (let i = 1; i < 6; i++) rect(99 + i * 3, 183 + i * 3, 214 - i * 6, 237 - i * 6, 13,
      null, i % 2 ? '#e1d4b8' : '#92866d', .85);
    rect(153, 239, 106, 125, 4, PAPER, '#625a49', 1.3);
    rect(158, 244, 96, 115, 2, '#e9e1cc', '#c1b597', .8);
    // These annotate the post's input/output voltages, not individual phase-coil terminals.
    const voltageText = value => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' kV';
    label(voltageText(inputVoltage), 206, 270, 25, '#66533b', 'center', SANS);
    line([[206, 290], [206, 310]], '#8e7960', 1.5);
    arrow(206, 310, Math.PI / 2, '#8e7960', 6, 1.5);
    label(voltageText(voltage), 206, 334, 25, '#3e7283', 'center', SANS);
    // Small through-bolts reinforce the stationary iron frame.
    [[124, 208], [288, 208], [124, 394], [288, 394]].forEach(([x, y]) => {
      circle(x, y, 5, '#aa9a7e', '#675b46', 1); line([[x - 2, y - 2], [x + 2, y + 2]], '#675b46', .8);
    });
    label('Fer fixe', 175, 159, 24, '#675d4b');
    line([[206, 173], [206, 183]], '#887961', 1);

    // Separate copper windings on the two limbs: schematic turns, never actual Inga hardware.
    function winding(x, top, height, turns, secondary) {
      rect(x - 31, top, 62, height, 10, secondary ? '#c48b53' : '#bd8150', '#78512d', 1.2);
      const step = (height - 15) / Math.max(1, turns - 1);
      for (let i = 0; i < turns; i++) {
        const yy = top + 7 + i * step;
        c.beginPath(); c.moveTo(x - 27, yy + 4); c.bezierCurveTo(x - 27, yy - 5, x + 27, yy - 5, x + 27, yy + 4);
        c.strokeStyle = '#edc18a'; c.lineWidth = secondary ? 1.1 : 4; c.stroke();
        c.beginPath(); c.moveTo(x - 27, yy + 5); c.bezierCurveTo(x - 17, yy + 9, x + 19, yy + 9, x + 27, yy + 5);
        c.strokeStyle = '#865530'; c.lineWidth = secondary ? .65 : 1.3; c.stroke();
      }
      rect(x - 18, top - 5, 36, 5, 1, '#e3d7be', '#8a775c', .7);
      rect(x - 18, top + height, 36, 5, 1, '#e3d7be', '#8a775c', .7);
    }
    winding(124, 248, 99, 4, false);
    winding(288, 232, 147, Math.round(clamp(voltage / inputVoltage * 4, 8, 90)), true);

    // The primary circuit closes to its own AC source, never to the secondary wire.
    line([[96, 254], [49, 254], [49, 281]], COPPER, 2.2);
    line([[96, 340], [49, 340], [49, 322]], COPPER, 2.2);
    circle(49, 301, 21, '#ece4ce', '#6a604e', 1.3);
    const ac = [];
    for (let i = 0; i <= 25; i++) ac.push([36 + i, 301 - Math.sin(i / 25 * TAU) * 6]);
    line(ac, '#6d6757', 1.6);
    circle(96, 254, 3, PAPER, COPPER, 1.1); circle(96, 340, 3, PAPER, COPPER, 1.1);

    // A cutaway shows one phase. The small complete post groups all three phases for transport.
    line([[316, 242], [354, 242], [354, 265]], COPPER, 1.9);
    line([[316, 367], [354, 367], [354, 332]], COPPER, 1.9);
    circle(316, 242, 3, PAPER, COPPER, 1.1); circle(316, 367, 3, PAPER, COPPER, 1.1);
    rect(342, 263, 56, 72, 3, '#d0c4a7', '#635a48', 1.1);
    for (let j = 0; j < 3; j++) {
      rect(351 + j * 13, 277, 8, 40, 2, '#ac9e81', '#7a6b53', .7);
      line([[355 + j * 13, 268], [355 + j * 13, 277]], '#6d624f', 1.1);
    }
    line([[339, 335], [402, 335]], '#786b55', 1.2);
    label('3 phases', 373, 385, 19, '#796e59', 'center', SANS);

    // Flux is proportional to sin(phase); arrows reverse sign and fade at each zero crossing.
    // Excitation is present at no load. Magnetizing losses/current are omitted by the lesson.
    if (state.field !== false && inputVoltage > 0 && voltage > 0) {
      const flux = Math.sin(phase), alpha = Math.abs(flux) * .82;
      const fluxColor = `rgba(49,111,133,${alpha})`;
      rect(126, 210, 160, 183, 3, null, fluxColor, 2.0);
      const direction = flux >= 0 ? 1 : -1;
      arrow(212, 210, direction > 0 ? 0 : Math.PI, fluxColor, 9);
      arrow(286, 314, direction > 0 ? Math.PI / 2 : -Math.PI / 2, fluxColor, 9);
      arrow(202, 393, direction > 0 ? Math.PI : 0, fluxColor, 9);
      arrow(126, 282, direction > 0 ? -Math.PI / 2 : Math.PI / 2, fluxColor, 9);
    }

    function pylon(x, top, bottom) {
      const color = '#6e6759';
      polygon([[x - 24, bottom], [x - 6, top + 13], [x + 6, top + 13], [x + 24, bottom]], null, color, 1.3);
      for (let j = 0; j < 5; j++) {
        const y1 = top + 30 + j * (bottom - top - 30) / 5;
        const y2 = top + 30 + (j + 1) * (bottom - top - 30) / 5;
        const a = 6 + (y1 - top) / (bottom - top) * 18;
        const b = 6 + (y2 - top) / (bottom - top) * 18;
        line([[x - a, y1], [x + b, y2]], color, .9); line([[x + a, y1], [x - b, y2]], color, .9);
      }
      for (let j = 0; j < 3; j++) {
        const yy = top + j * 21;
        line([[x - 21 - j * 4, yy], [x + 21 + j * 4, yy]], color, 1.8);
        line([[x - 6, yy + 12], [x - 21 - j * 4, yy], [x - 5, yy]], color, 1);
        for (let k = 0; k < 3; k++) line([[x - 3, yy + 5 + k * 3], [x + 3, yy + 5 + k * 3]], '#a4987e', 1.5);
      }
      rect(x - 28, bottom, 15, 6, 1, '#c6b799', color, .7);
      rect(x + 13, bottom, 15, 6, 1, '#c6b799', color, .7);
    }
    pylon(448, 181, 417); pylon(628, 181, 417);

    // Three AC conductors. The golden moving marks below denote average energy, not electrons.
    for (let wire = 0; wire < 3; wire++) {
      const a = [398, 277 + wire * 14], b = [448, 192 + wire * 21];
      const d = [628, 192 + wire * 21], e = [703 + wire * 6, 313];
      cable(a, b, 11); cable(b, d, 42); cable(d, e, 16);
      if (power > 0) {
        for (let k = 0; k < 6; k++) {
          const t = ((phase * .067 + k / 6 + wire * .04) % 1 + 1) % 1;
          const position = t < .18 ? onCable(a, b, 11, t / .18)
            : t < .75 ? onCable(b, d, 42, (t - .18) / .57) : onCable(d, e, 16, (t - .75) / .25);
          energyDot(position[0], position[1]);
        }
      }
    }

    // Heat remains a qualitative cue; its strength follows the calculated losses.
    if (heat > 0) {
      const amount = Math.max(2, Math.round(heat * 7));
      for (let i = 0; i < amount; i++) {
        const x = 480 + seed(i + 78) * 120;
        const y = 201 + seed(i + 813) * 41;
        const size = 11 + 29 * Math.min(heat, 1);
        const wobble = Math.sin(phase * .7 + i) * 4;
        c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 8 - wobble, y - size * .35, x + 9 + wobble, y - size * .6, x + 1, y - size);
        c.strokeStyle = `rgba(205,136,109,${.10 + Math.min(heat, 1) * .58})`; c.lineWidth = 1.4 + heat * .65; c.stroke();
      }
    }

    // Arrival substation lowers voltage again before the illustrated buildings.
    rect(687, 352, 49, 58, 3, '#b9aa8c', '#605848', 1.2);
    for (let j = 0; j < 6; j++) line([[691 + j * 7, 359], [691 + j * 7, 404]], '#817154', 1.1);
    rect(683, 410, 58, 8, 1, '#c9ba9b', '#776b53', .8);
    for (let j = 0; j < 3; j++) {
      const x = 703 + j * 6;
      line([[x, 313], [x, 352]], '#74664d', 1.2);
      for (let z = 0; z < 5; z++) line([[x - 3, 324 + z * 4], [x + 3, 324 + z * 4]], '#a68e64', 1.5);
    }
    line([[736, 370], [754, 370], [754, 358], [875, 358]], '#75694f', 1.4);
    if (lit) {
      for (let k = 0; k < 3; k++) {
        const t = ((phase * .08 + k / 3) % 1 + 1) % 1;
        energyDot(749 + t * 124, 358, clamp(received / Math.max(power, .001), .35, 1));
      }
    }

    function window(x, y, w = 8, h = 12) {
      rect(x, y, w, h, .8, lit ? '#e8bd66' : '#8f9289', '#6c6450', .8);
      line([[x + w / 2, y], [x + w / 2, y + h]], '#9a8151', .55);
    }
    // A small town: workshop, house and apartment block, softly lit with received power.
    rect(757, 378, 41, 39, 1, '#d7cbae', '#635947', 1);
    polygon([[753, 378], [777, 360], [802, 378]], '#829193', '#576669', 1.2);
    window(763, 386); window(783, 386);
    rect(772, 401, 11, 16, 1, '#a29477', '#6a5e48', .8);
    rect(806, 342, 34, 75, 1, '#d3c7a8', '#695e47', 1);
    polygon([[803, 342], [823, 325], [843, 342]], '#9c8a6c', '#6b5a42', 1.2);
    rect(827, 327, 5, 10, .5, '#bbab8c', '#76694f', .8);
    for (let r = 0; r < 3; r++) { window(811, 351 + r * 19, 8, 11); window(827, 351 + r * 19, 8, 11); }
    rect(846, 374, 30, 43, 1, '#d6c7a6', '#695d47', 1);
    polygon([[843, 374], [862, 359], [880, 374]], '#748a8b', '#556c6d', 1.2);
    window(850, 383); window(864, 383);
    rect(857, 401, 10, 16, 1, '#a5987a', '#6e6049', .8);
    // The little street tree is part of the drawing, not another electrical load model.
    line([[793, 415], [793, 399]], '#77633f', 1.5);
    circle(793, 397, 7, '#a6ad86', '#76825e', .8);
    line([[676, 419], [887, 419]], '#9c8d6e', 1);
    line([[430, 425], [652, 425]], 'rgba(128,109,74,.4)', 1);

    label('Bobines séparées', 59, 457, 27);
    label('Une phase représentée', 59, 488, 22, '#796d55');
    label('3 conducteurs CA', 429, 457, 24, '#6d644f');
    label('Distribution', 686, 457, 26, '#605a48');
    line([[714, 438], [714, 421]], '#8a7a5c', 1);

    line([[42, 513], [858, 513]], 'rgba(88,71,43,.20)', 1);
    line([[57, 545], [93, 545]], FLUX, 2);
    // The key stays still; the alternating direction is shown only in the core itself.
    arrow(93, 545, 0, FLUX, 7);
    arrow(57, 545, Math.PI, FLUX, 7);
    label('Champ alternatif', 109, 547, 24, '#466f7b');
    energyDot(398, 545);
    label('Énergie transportée', 418, 547, 24, '#8d682b');
    c.beginPath(); c.moveTo(711, 553); c.bezierCurveTo(701, 543, 721, 537, 711, 526);
    c.strokeStyle = '#cd886d'; c.lineWidth = 1.8; c.stroke();
    label('Chaleur', 731, 547, 24, '#995e49');
    label('Le transformateur ne crée pas de puissance.', 450, 594, 26, INK, 'center');
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  window.IngaTransformerDrawing = Object.freeze({ draw });
})();
