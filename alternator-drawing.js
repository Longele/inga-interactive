/* A two-pole teaching diagram, not the construction drawing of an Inga alternator. */
(() => {
  'use strict';
  const WIDTH = 900, HEIGHT = 620, TAU = Math.PI * 2;
  const PAPER = '#e9e1ca', INK = '#34312a', GOLD = '#ae813c';
  const HAND = '"Architects Daughter", "Segoe Print", cursive';
  const SANS = '"IBM Plex Sans", sans-serif';
  const COLORS = ['#a65343', '#3e8296', '#7a7750'];
  const PHASES = ['A', 'B', 'C'];
  let texture = null;
  const random = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  function paperTexture() {
    if (texture) return texture;
    texture = document.createElement('canvas'); texture.width = WIDTH; texture.height = HEIGHT;
    const c = texture.getContext('2d');
    c.fillStyle = PAPER; c.fillRect(0, 0, WIDTH, HEIGHT);
    const shade = c.createLinearGradient(0, 0, WIDTH, HEIGHT);
    shade.addColorStop(0, 'rgba(255,255,240,.21)'); shade.addColorStop(1, 'rgba(111,86,43,.045)');
    c.fillStyle = shade; c.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < 1600; i++) {
      c.fillStyle = i % 2 ? 'rgba(81,64,31,.04)' : 'rgba(255,255,245,.17)';
      c.fillRect(random(i) * WIDTH, random(i + 1800) * HEIGHT, 1 + random(i + 90) * 2, .7);
    }
    return texture;
  }

  function draw(canvas, state = {}) {
    if (!canvas || !canvas.width || !canvas.height) return;
    const c = canvas.getContext('2d'); if (!c) return;
    const angle = Number.isFinite(Number(state.angle)) ? Number(state.angle) : 0;
    const normalized = ((angle % TAU) + TAU) % TAU;
    const energized = state.energized !== false;
    const showField = state.field !== false && energized;
    const allPhases = state.phases !== false;
    const focus = state.focus || null;
    // producing is intentionally irrelevant: an excited machine has voltage at no load.
    const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, canvas.width, canvas.height); c.fillStyle = PAPER;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(scale, 0, 0, scale, (canvas.width - WIDTH * scale) / 2, (canvas.height - HEIGHT * scale) / 2);
    c.drawImage(paperTexture(), 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.textBaseline = 'middle';
    const cx = 279, cy = 317, outer = 197, bore = 145;

    function path(points, close = false) {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      if (close) c.closePath();
    }
    function line(points, color = INK, width = 1.2, dash = []) {
      path(points); c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
    }
    function text(value, x, y, size = 26, color = INK, align = 'left', font = HAND) {
      c.font = `${size}px ${font}`; c.fillStyle = color; c.textAlign = align; c.fillText(value, x, y);
    }
    function circle(x, y, radius, fill, stroke = INK, width = 1.2) {
      c.beginPath(); c.arc(x, y, radius, 0, TAU);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); }
    }
    function rectangle(x, y, w, h, radius, fill, stroke = INK, width = 1.2) {
      c.beginPath(); c.roundRect(x, y, w, h, radius);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(); }
    }
    function arrow(x, y, direction, color, size = 7) {
      line([[x - size * Math.cos(direction - .5), y - size * Math.sin(direction - .5)], [x, y],
        [x - size * Math.cos(direction + .5), y - size * Math.sin(direction + .5)]], color, 1.8);
    }
    function radial(radius, phi) { return [cx + radius * Math.cos(phi), cy - radius * Math.sin(phi)]; }
    function halo(radius) {
      circle(cx, cy, radius, null, 'rgba(197,143,57,.12)', 17);
      circle(cx, cy, radius, null, 'rgba(151,105,40,.70)', 1.6);
    }

    text('Dans l’alternateur', 40, 42, 32);
    text('Coupe de principe', 858, 43, 19, '#786c56', 'right', SANS);
    line([[40, 73], [860, 73]], 'rgba(79,65,41,.24)');

    // Fixed laminated stator: the dashed radial marks are construction lines.
    if (focus === 'stator') halo(outer + 8);
    circle(cx, cy, outer + 6, '#d1c4a7', INK, 1.5);
    circle(cx, cy, outer, '#dcd1b8', INK, 1.2);
    c.save(); c.beginPath(); c.arc(cx, cy, outer, 0, TAU); c.arc(cx, cy, bore, 0, TAU, true); c.clip('evenodd');
    for (let n = -300; n < 650; n += 9) line([[cx - 240 + n, cy - 230], [cx - 240 + n + 460, cy + 230]], 'rgba(91,75,45,.16)', .75);
    for (let n = 0; n < 36; n++) {
      const a = n / 36 * TAU;
      line([radial(bore, a), radial(outer, a)], '#8d816a', .7);
    }
    c.restore();
    circle(cx, cy, bore, '#e7dfc9', '#686052', 1.5);
    circle(cx, cy, bore - 7, null, 'rgba(86,75,54,.26)', .8);

    // Coil flux axes are alpha = 0,120,240 degrees. Opposite coil sides lie at alpha ±90°.
    // This is a concentrated full-pitch winding sketch, not the actual slot or pole count.
    for (let phase = 0; phase < 3; phase++) {
      const alpha = phase * TAU / 3;
      const active = phase === 0 || allPhases;
      for (const sign of [-1, 1]) {
        const phi = alpha + sign * Math.PI / 2;
        const [px, py] = radial(171, phi);
        c.save(); c.translate(px, py); c.rotate(-phi);
        rectangle(-22, -28, 44, 56, 8, active ? '#bf8e56' : '#c4b394', '#765b36', 1.2);
        for (let k = 0; k < 5; k++) rectangle(-17 + k * 1.7, -23 + k * 1.9, 34 - k * 3.4, 46 - k * 3.8,
          6, null, k % 2 ? '#8a5d32' : '#e2b67b', 1.25);
        rectangle(-23, -7, 46, 14, 2, '#a99b7d', '#655947', .85);
        line([[-16, -1], [16, -1]], '#d5c9ae', .8);
        c.restore();
        const [lx, ly] = radial(221, phi);
        circle(lx, ly, 15, '#ede5d0', active ? COLORS[phase] : '#9a8f7a', 1.3);
        text(PHASES[phase], lx, ly + 1, 22, active ? COLORS[phase] : '#918775', 'center', SANS);
      }
    }

    // Small clamps and bolts make the fixed casing legible without adding real dimensions.
    for (let k = 0; k < 6; k++) {
      const phi = k / 6 * TAU;
      const [bx, by] = radial(198, phi);
      circle(bx, by, 5, '#b6a78a', '#665b47', 1);
      line([[bx - 2, by - 2], [bx + 2, by + 2]], '#665b47', .8);
    }

    // Curved magnetic field lines run N → S outside the rotating poles.
    if (showField) {
      c.save(); circle(cx, cy, bore - 2, null, null); c.clip();
      c.translate(cx, cy); c.rotate(-angle);
      for (const sign of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const spread = 91 + k * 34;
          c.beginPath(); c.moveTo(107, 0); c.bezierCurveTo(138, sign * spread, -138, sign * spread, -107, 0);
          c.strokeStyle = focus === 'induction' ? 'rgba(93,111,123,.77)' : 'rgba(78,104,119,.49)';
          c.lineWidth = k === 1 ? 1.6 : 1.1; c.stroke();
          arrow(0, sign * spread * .75, Math.PI, '#637e8b', 6);
        }
      }
      c.restore();
    }

    // Two illustrative poles. N and S letters remain upright while their pole shoes rotate.
    if (focus === 'rotor') halo(123);
    c.save(); c.translate(cx, cy); c.rotate(-angle);
    circle(0, 0, 119, null, 'rgba(98,88,66,.37)', .9);
    rectangle(-103, -34, 206, 68, 17, '#b5a88c', '#4f493d', 1.5);
    for (const side of [-1, 1]) {
      c.save(); if (side < 0) c.rotate(Math.PI);
      c.beginPath(); c.moveTo(72, -45); c.lineTo(98, -61); c.arc(0, 0, 116, -.553, .553); c.lineTo(72, 45); c.closePath();
      c.fillStyle = !energized ? '#bcb299' : side > 0 ? '#bd7761' : '#799aa4'; c.fill();
      c.strokeStyle = '#615441'; c.lineWidth = 1.3; c.stroke();
      for (let n = 0; n < 4; n++) line([[55 + n * 6, -28], [55 + n * 6, 28]], '#8b6f46', 3.1);
      c.restore();
    }
    circle(0, 0, 43, '#cbbfa4', '#554d3f', 1.5);
    circle(0, 0, 23, '#8f8877', '#49463c', 1.2);
    circle(0, 0, 12, '#aaa18b', '#555043', .9);
    rectangle(-4, -24, 8, 12, 1, '#696456', '#454236', .7);
    for (let k = 0; k < 4; k++) {
      const a = (k + .5) * Math.PI / 2;
      circle(33 * Math.cos(a), 33 * Math.sin(a), 3, '#94866e', '#5c5140', .7);
    }
    for (const side of [-1, 1]) {
      c.save(); c.translate(side * 96, 0); c.rotate(angle);
      text(side > 0 ? 'N' : 'S', 0, 1, 27, '#302e29', 'center', SANS);
      c.restore();
    }
    // Rotor orientation pointer on the shaft, and a subtle CCW rotation cue.
    line([[0, 0], [15, 0]], '#ede3c9', 2);
    c.restore();
    const arcStart = -.37, arcEnd = -1.03;
    c.beginPath(); c.arc(cx, cy, 128, arcStart, arcEnd, true); c.strokeStyle = '#655b46'; c.lineWidth = 1.1; c.stroke();
    const tip = [cx + 128 * Math.cos(arcEnd), cy + 128 * Math.sin(arcEnd)];
    arrow(tip[0], tip[1], arcEnd - Math.PI / 2, '#655b46', 7);

    // Three schematic outgoing conductors; exact internal connections are intentionally omitted.
    const leadY = [254, 281, 308];
    for (let i = 0; i < (allPhases ? 3 : 1); i++) {
      const yy = leadY[i];
      const startX = cx + Math.sqrt(Math.max(0, (outer + 7) ** 2 - (cy - yy) ** 2));
      line([[startX, yy], [526 + i * 7, yy], [526 + i * 7, 190 + i * 20], [561, 190 + i * 20]], COLORS[i], 2.1);
      circle(startX, yy, 3.2, PAPER, COLORS[i], 1.2);
    }

    // Fixed amplitude, normalized voltage versus rotor angle: Φk=cos(θ−αk), ek=sin(θ−αk).
    // The cursor is the rotor position. Pausing the illustration freezes the entire snapshot.
    const panel = { x: 561, y: 147, w: 301, h: 313 };
    rectangle(panel.x, panel.y, panel.w, panel.h, 3, 'rgba(255,250,232,.26)', focus === 'induction' ? '#b48c47' : '#a19375', focus === 'induction' ? 2 : 1);
    if (focus === 'induction') rectangle(panel.x - 4, panel.y - 4, panel.w + 8, panel.h + 8, 5, null, 'rgba(180,140,71,.14)', 7);
    text('Tensions induites', 573, 111, 28);
    const plot = { left: 592, top: 207, width: 243, height: 147 };
    const mid = plot.top + plot.height / 2, amplitude = 61;
    for (let k = 0; k <= 4; k++) {
      const xx = plot.left + k / 4 * plot.width;
      line([[xx, plot.top], [xx, plot.top + plot.height]], 'rgba(128,113,81,.16)', .75);
    }
    line([[plot.left, mid - amplitude], [plot.left + plot.width, mid - amplitude]], 'rgba(128,113,81,.15)', .7);
    line([[plot.left, mid + amplitude], [plot.left + plot.width, mid + amplitude]], 'rgba(128,113,81,.15)', .7);
    line([[plot.left - 8, mid], [plot.left + plot.width + 6, mid]], '#8c816a', 1);
    text('0', plot.left - 13, mid, 17, '#796e58', 'right', SANS);
    text('Un tour', plot.left + plot.width, 381, 22, '#6f6553', 'right');
    text('0°', plot.left, 381, 19, '#6f6553', 'left', SANS);
    for (let phase = 0; phase < (allPhases ? 3 : 1); phase++) {
      const points = [];
      for (let i = 0; i <= 150; i++) {
        const theta = i / 150 * TAU;
        points.push([plot.left + i / 150 * plot.width, mid - (energized ? Math.sin(theta - phase * TAU / 3) : 0) * amplitude]);
      }
      line(points, energized ? COLORS[phase] : '#8c8472', energized ? 2.3 : 1.5);
    }
    const cursorX = plot.left + normalized / TAU * plot.width;
    line([[cursorX, plot.top - 13], [cursorX, plot.top + plot.height + 9]], 'rgba(73,63,43,.52)', 1, [3, 4]);
    for (let phase = 0; phase < (allPhases ? 3 : 1); phase++) {
      const yy = mid - (energized ? Math.sin(angle - phase * TAU / 3) : 0) * amplitude;
      circle(cursorX, yy, 4.2, energized ? COLORS[phase] : '#8c8472', PAPER, 1.2);
    }
    text('A', 607, 418, 24, COLORS[0], 'center', SANS);
    if (allPhases) {
      text('B', 704, 418, 24, COLORS[1], 'center', SANS);
      text('C', 800, 418, 24, COLORS[2], 'center', SANS);
    } else text('Une phase visible', 660, 418, 20, '#6f6553');
    text('Tracé de principe', 711, 487, 22, '#746750', 'center');
    text('Amplitude normalisée', 711, 516, 20, '#746750', 'center', SANS);

    // Separate labels avoid leader lines crossing the moving poles or their waveforms.
    text('Stator fixe', 49, 99, 27);
    line([[99, 113], [120, 155]], '#81725c', 1);
    text('Rotor tournant', 42, 561, 28);
    line([[205, 541], [220, 510], [244, 430]], '#81725c', 1);
    text('2 pôles illustratifs', 81, 594, 22, '#746750');
    if (!energized) text('Champ supposé coupé', 567, 560, 25, '#756955');
    else if (showField) text('Champ magnétique N → S', 517, 560, 24, '#536c79');
    else text('Champ masqué dans le dessin', 502, 560, 23, '#756955');
    text('Bobines fixes en cuivre', 519, 593, 23, '#82613c');
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  window.IngaAlternatorDrawing = Object.freeze({ draw });
})();
