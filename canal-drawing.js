/* A schematic canal, drawn as a living engineering plate. No hydraulic solver here. */
(() => {
  'use strict';
  const W = 900, H = 620;
  const INK = '#34312a', PAPER = '#e9e1ca', WATER = '#458aa1';
  const HAND = '"Architects Daughter", "Segoe Print", cursive';
  const SANS = '"IBM Plex Sans", sans-serif';
  let paper = null;
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const seed = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  function paperTexture() {
    if (paper) return paper;
    paper = document.createElement('canvas'); paper.width = W; paper.height = H;
    const p = paper.getContext('2d');
    p.fillStyle = PAPER; p.fillRect(0, 0, W, H);
    const light = p.createLinearGradient(0, 0, W, H);
    light.addColorStop(0, 'rgba(255,255,245,.18)');
    light.addColorStop(.6, 'rgba(255,255,245,0)');
    light.addColorStop(1, 'rgba(92,68,32,.055)');
    p.fillStyle = light; p.fillRect(0, 0, W, H);
    for (let i = 0; i < 1700; i++) {
      p.fillStyle = i % 2 ? 'rgba(67,51,25,.035)' : 'rgba(255,255,245,.19)';
      p.fillRect(seed(i) * W, seed(i + 5000) * H, 1 + seed(i + 100) * 2.4, .65);
    }
    return paper;
  }

  function draw(canvas, options = {}) {
    if (!canvas || !canvas.width || !canvas.height) return;
    const c = canvas.getContext('2d'); if (!c) return;
    const sediment = clamp(finite(options.sediment, 0), 0, 1);
    const flow = Math.max(0, finite(options.flow, 2200));
    const time = options.reducedMotion ? 0 : finite(options.seconds, 0);
    const motion = !options.reducedMotion;
    const scale = Math.min(canvas.width / W, canvas.height / H);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = PAPER; c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(scale, 0, 0, scale, (canvas.width - W * scale) / 2, (canvas.height - H * scale) / 2);
    c.drawImage(paperTexture(), 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.textBaseline = 'middle';

    function path(points, close = false) {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      if (close) c.closePath();
    }
    function polygon(points, fill, stroke = INK, width = 1.3) {
      path(points, true);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function line(points, color = INK, width = 1.2, dash = []) {
      path(points); c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
    }
    function label(text, x, y, size = 27, color = INK, align = 'left', font = HAND) {
      c.font = `${size}px ${font}`; c.fillStyle = color; c.textAlign = align; c.fillText(text, x, y);
    }
    function arrow(x1, y1, x2, y2, color = WATER, width = 2.5, head = 10) {
      line([[x1, y1], [x2, y2]], color, width);
      const a = Math.atan2(y2 - y1, x2 - x1);
      line([[x2 - head * Math.cos(a - .5), y2 - head * Math.sin(a - .5)], [x2, y2],
        [x2 - head * Math.cos(a + .5), y2 - head * Math.sin(a + .5)]], color, width);
    }
    function hatch(points, step = 11) {
      c.save(); path(points, true); c.clip();
      for (let k = -H; k < W + H; k += step) line([[k, 0], [k + H, H]], 'rgba(64,55,36,.17)', .7);
      c.restore();
    }
    function dot(x, y, radius, color) {
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = color; c.fill();
    }

    // A little cartouche, using the lettering of the Francis drawing.
    label('Le canal, vu de l’intérieur', 42, 43, 31);
    label('Coupe de principe', 858, 44, 19, '#736a59', 'right', SANS);
    line([[42, 71], [858, 71]], 'rgba(72,62,42,.25)', 1);
    label('Depuis le fleuve', 49, 111, 27);
    label('Vers les turbines', 644, 111, 27);
    line([[134, 134], [105, 163], [105, 212]], '#817665', 1);
    line([[771, 134], [823, 162], [823, 214]], '#817665', 1);

    const left = 100, right = 785, surface = 242, floor = 364, dx = 64, dy = -67;
    function bed(x) {
      const u = (x - left) / (right - left);
      const a = Math.exp(-Math.pow((u - .28) / .19, 2));
      const b = Math.exp(-Math.pow((u - .7) / .23, 2));
      return floor - sediment * (14 + 63 * a + 69 * b) - sediment * 2.3 * Math.sin(u * Math.PI * 7);
    }
    const profile = [];
    for (let x = left; x <= right; x += 5) profile.push([x, bed(x)]);
    if (profile.at(-1)[0] !== right) profile.push([right, bed(right)]);

    // Far bank and the cut through the front bank: depth is deliberately uncalibrated.
    const farBank = [[left + dx - 13, surface + dy - 23], [right + dx + 12, surface + dy - 23],
      [right + dx + 12, surface + dy], [left + dx - 13, surface + dy]];
    polygon(farBank, '#d2c5a7'); hatch(farBank);
    polygon([[left - 19, floor], [right + 17, floor], [right + 17, floor + 26], [left - 19, floor + 26]], '#d0c3a5');
    hatch([[left - 19, floor], [right + 17, floor], [right + 17, floor + 26], [left - 19, floor + 26]], 9);
    polygon([[right, floor], [right + dx, floor + dy], [right + dx + 17, floor + dy + 12], [right + 17, floor + 26]], '#c5b796');

    // Water surface and the transparent longitudinal section.
    const waterShape = [[left, surface], [right, surface], ...profile.slice().reverse()];
    const waterGradient = c.createLinearGradient(0, surface, 0, floor);
    waterGradient.addColorStop(0, 'rgba(129,184,195,.80)');
    waterGradient.addColorStop(1, 'rgba(98,159,175,.84)');

    // The top of a deposit extends back into the cutaway; the front face reveals its grain.
    if (sediment > .002) {
      const sandTop = [...profile, ...profile.slice().reverse().map(([x, y]) => [x + dx, y + dy])];
      polygon(sandTop, '#cbb279', '#8b7347', 1.1);
      const sandFace = [...profile, [right, floor], [left, floor]];
      const sandGradient = c.createLinearGradient(0, surface + 35, 0, floor);
      sandGradient.addColorStop(0, '#c5a366'); sandGradient.addColorStop(1, '#ab894c');
      polygon(sandFace, sandGradient, '#856a3c', 1.3);
      c.save(); path(sandFace, true); c.clip();
      for (let i = 0; i < 230; i++) dot(left + seed(i + 50) * (right - left), surface + seed(i + 2300) * (floor - surface),
        .7 + seed(i + 14) * 1.4, i % 3 ? 'rgba(84,60,28,.30)' : 'rgba(255,241,189,.48)');
      for (let i = 0; i < 4; i++) {
        const points = profile.map(([x, y]) => [x, y + 13 + i * 15]);
        line(points, 'rgba(99,71,33,.18)', .85);
      }
      c.restore();
    }

    // Draw the water in front of the submerged rear deposits; the exposed cut remains ochre.
    polygon([[left, surface], [right, surface], [right + dx, surface + dy], [left + dx, surface + dy]], 'rgba(114,174,188,.48)', '#627f82', 1);
    path(waterShape, true); c.fillStyle = waterGradient; c.fill();
    // A few grains settle only if the controller explicitly says the deposit is increasing.
    if (sediment > .002 && motion && options.sedimentRising === true) {
      c.save(); path(waterShape, true); c.clip();
      for (let i = 0; i < 13; i++) {
        const px = left + 80 + seed(i + 771) * (right - left - 150);
        const k = (time * .34 + seed(i + 44)) % 1;
        const py = surface + 9 + k * Math.max(0, bed(px) - surface - 12);
        dot(px + Math.sin(k * 6 + i) * 2.5, py, 1.8, '#ae8745');
      }
      c.restore();
    }
    // All moving water is clipped to the free passage, never to the sediment or bank.
    c.save(); path(waterShape, true); c.clip();
    const particles = Math.round(clamp(flow / 2200, 0, 1) * 77);
    for (let i = 0; i < particles; i++) {
      const u = (seed(i + 831) + time * .105) % 1;
      const px = left + u * (right - left);
      const lane = .12 + seed(i + 139) * .78;
      const py = surface + 9 + lane * Math.max(0, bed(px) - surface - 20);
      const radius = 1.7 + seed(i + 71) * 1.2;
      line([[px - 9, py], [px - 3, py]], 'rgba(33,99,123,.36)', 1.4);
      dot(px, py, radius, 'rgba(32,99,124,.82)');
    }
    // Slow, shallow ripples describe a surface, not a changing canal level.
    for (let i = 0; i < 4; i++) {
      const x0 = left + 55 + i * 164;
      const points = [];
      for (let k = 0; k <= 45; k += 3) points.push([x0 + k, surface + 2.2 * Math.sin(k / 16 + time * .7 + i)]);
      line(points, 'rgba(51,113,133,.50)', 1.1);
    }
    c.restore();
    line([[left, surface], [right, surface]], '#557b83', 1.35);
    line([[left, floor], [right, floor]], INK, 1.6);
    line([[left, surface], [left, floor]], 'rgba(52,49,42,.52)', 1);
    line([[right, surface], [right, floor]], 'rgba(52,49,42,.52)', 1);

    // Flow arrows sit inside the water passage. Their speed never claims real hydraulics.
    arrow(29, 273, 98, 273, WATER, 3, 11);
    arrow(785, 273, 870, 273, WATER, 3, 11);
    arrow(369, 205, 466, 205, '#4c8190', 2.4, 9);

    // The section mark links the large drawing to the inset below.
    line([[459, 243], [523, 175]], 'rgba(52,49,42,.70)', 1.2, [5, 5]);
    label('A', 451, 229, 20, INK, 'center', SANS);
    label('A', 535, 169, 20, INK, 'center', SANS);

    // Front section: the same water level, with an unmistakably smaller blue opening.
    const bx = 42, by = 421, bw = 411, bh = 160;
    polygon([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], 'rgba(255,250,232,.28)', 'rgba(82,68,43,.30)', 1);
    label('Le passage de l’eau · coupe A–A', bx + 17, by + 23, 23);
    const bowl = [[78, 471], [134, 561], [354, 561], [410, 471]];
    const bankMass = [[65, 471], [78, 471], [134, 561], [354, 561], [410, 471], [423, 471], [370, 576], [118, 576]];
    polygon(bankMass, '#cbbd9e'); hatch(bankMass, 8);
    polygon(bowl, 'rgba(91,157,179,.29)', '#6a6558', 1.4);
    const crossTop = [];
    for (let i = 0; i <= 40; i++) {
      const x = 134 + i / 40 * 220;
      crossTop.push([x, 561 - sediment * (40 + 16 * Math.sin(i / 40 * Math.PI))]);
    }
    if (sediment > .002) {
      const height = sediment * 40;
      const extent = height * 56 / 90;
      const sandCross = [[134 - extent, 561 - height], ...crossTop, [354 + extent, 561 - height], [354, 561], [134, 561]];
      polygon(sandCross, '#bb9859', '#8d7142', 1);
      c.save(); path(sandCross, true); c.clip();
      for (let i = 0; i < 65; i++) dot(112 + seed(i + 621) * 267, 487 + seed(i + 399) * 76, 1.1, 'rgba(84,60,28,.3)');
      c.restore();
    }
    line([[78, 471], [410, 471]], '#477c8d', 1.6);
    // Small circles, viewed end-on, stand for water passing through this section.
    for (let i = 0; i < 19; i++) {
      const px = 130 + seed(i + 977) * 230;
      const u = clamp((px - 134) / 220, 0, 1);
      const bottom = 561 - sediment * (40 + 16 * Math.sin(u * Math.PI));
      const py = 481 + seed(i + 35) * Math.max(1, bottom - 491);
      const leftAtY = 78 + (py - 471) * 56 / 90, rightAtY = 410 - (py - 471) * 56 / 90;
      if (px > leftAtY + 7 && px < rightAtY - 7) dot(px, py, 2, 'rgba(44,109,132,.66)');
    }

    // Two large keys and one short observation keep the plate readable on a phone.
    const tx = 491;
    dot(tx + 7, 442, 6, '#4389a0');
    label('L’eau qui passe', tx + 26, 443, 26, '#315f70');
    polygon([[tx, 480], [tx + 8, 470], [tx + 18, 480]], '#b99451', '#876a3d', .8);
    label('Les dépôts de sable', tx + 26, 480, 26, '#7d6031');
    label(sediment < .08 ? 'Le passage est dégagé.' : 'Le sable prend de la place.', tx, 536, 26);
    label(flow <= .01 ? 'Aucun débit turbiné.' : sediment < .08 ? 'L’eau traverse le canal.' : 'Moins d’eau peut passer.', tx, 570, 26);

    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  window.IngaCanalDrawing = Object.freeze({ draw });
})();
