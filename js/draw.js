// ===== Drawing: sky, ground, lake, plants, critters, people =====
const Draw = (() => {
  const TAU = Math.PI * 2;
  // Set by the game every frame. skyTop = world y at the top of the screen; stretch = backdrop height factor; boost = plant size factor (both grow when zoomed out so the jungle fills the view).
  const view = { skyTop: -60, stretch: 1, boost: 1 };
  function setView(v) { Object.assign(view, v); }

  // --- primitives ---
  function ell(ctx, x, y, rx, ry, color, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  function circ(ctx, x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function rrect(ctx, x, y, w, h, r, color) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
  function line(ctx, x1, y1, x2, y2, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function poly(ctx, pts, color) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function eye(ctx, x, y, r, closed, iris) {
    if (closed) { ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, r * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return; }
    circ(ctx, x, y, r, '#fff');
    if (iris) circ(ctx, x + r * 0.2, y, r * 0.7, iris);
    circ(ctx, x + r * 0.25, y, r * 0.5, '#222');
    circ(ctx, x + r * 0.4, y - r * 0.3, r * 0.2, '#fff');
  }
  function smile(ctx, x, y, r, color = '#222') { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function shade(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + amt, g + amt, b + amt); }
  function lerpColor(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function seeded(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // --- sky & time of day ---
  const SKY = [
    [0.00, '#ff9a5c', '#ffd3a0'],
    [0.08, '#5fb8ff', '#bfe6ff'],
    [0.58, '#5fb8ff', '#bfe6ff'],
    [0.667, '#ff7a4d', '#ffc27a'],
    [0.73, '#0b1230', '#1d2b5a'],
    [0.95, '#0b1230', '#1d2b5a'],
    [1.00, '#ff9a5c', '#ffd3a0'],
  ];
  function skyColors(frac) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (frac >= a[0] && frac <= b[0]) { const t = (frac - a[0]) / (b[0] - a[0]); return [lerpColor(a[1], b[1], t), lerpColor(a[2], b[2], t)]; }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  function nightFactor(frac) {
    if (frac < 0.04) return 1 - frac / 0.04;
    if (frac < 0.64) return 0;
    if (frac < 0.73) return (frac - 0.64) / 0.09;
    if (frac < 0.96) return 1;
    return 1 - (frac - 0.96) / 0.04;
  }

  function drawSky(ctx, W, H, frac, rain) {
    const [top, bot] = skyColors(frac);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rain ? lerpColor(top, '#6b7a8a', rain * 0.6) : top);
    g.addColorStop(1, rain ? lerpColor(bot, '#9aa6b2', rain * 0.6) : bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawStars(ctx, t, night) {
    if (night <= 0) return;
    for (let i = 0; i < 90; i++) {
      const top = Math.min(-60, view.skyTop), x = seeded(i) * WORLD.W, y = top + seeded(i + 500) * (WORLD.GROUND_Y - 200 - top);
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + seeded(i + 900)) + i);
      ctx.globalAlpha = night * (0.4 + 0.6 * tw);
      circ(ctx, x, y, 1 + seeded(i + 300) * 1.5, '#fff');
    }
    ctx.globalAlpha = 1;
  }

  // Where the sun (by day) or moon (by night) is right now.
  function sunMoonPos(phase) {
    const gy = WORLD.GROUND_Y, sun = phase < WORLD.DAY;
    const p = sun ? phase / WORLD.DAY : (phase - WORLD.DAY) / WORLD.NIGHT;
    const peak = Math.min(60, view.skyTop + 90); // climbs higher when more sky is on screen
    return { x: 60 + p * (WORLD.W - 120), y: gy - 40 - Math.sin(Math.PI * p) * (gy - 40 - peak), sun };
  }
  // body: { c1, c2, acc } chosen by the player
  function drawSunMoonAt(ctx, x, y, body, sun, t) {
    const c1 = (body && body.c1) || (sun ? '#ffd84a' : '#f2f4ff'), c2 = (body && body.c2) || (sun ? '#fff2a8' : '#d6dbf0');
    const g = ctx.createRadialGradient(x, y, 20, x, y, sun ? 90 : 80);
    g.addColorStop(0, sun ? 'rgba(255,230,120,0.55)' : 'rgba(220,230,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 90, y - 90, 180, 180);
    if (sun) {
      // rays
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.15); ctx.globalAlpha = 0.5;
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); line(ctx, 0, -40, 0, -50 - (i % 2) * 6, c1, 3); }
      ctx.restore(); ctx.globalAlpha = 1;
      circ(ctx, x, y, 34, c1); circ(ctx, x - 8, y - 8, 10, c2);
      eye(ctx, x - 10, y - 4, 4, false); eye(ctx, x + 10, y - 4, 4, false); smile(ctx, x, y + 6, 10);
      ctx.globalAlpha = 0.5; circ(ctx, x - 17, y + 6, 4, '#ff9f6e'); circ(ctx, x + 17, y + 6, 4, '#ff9f6e'); ctx.globalAlpha = 1;
      if (body) drawAccessory(ctx, body.acc, x, y, 30);
    } else {
      circ(ctx, x, y, 30, c1);
      circ(ctx, x - 9, y - 6, 6, c2); circ(ctx, x + 8, y + 8, 4, c2); circ(ctx, x + 6, y - 12, 3, c2);
      eye(ctx, x - 9, y + 2, 3, true); eye(ctx, x + 9, y + 2, 3, true); smile(ctx, x, y + 8, 7);
      if (body) drawAccessory(ctx, body.acc, x, y, 27);
    }
  }
  function drawSunMoon(ctx, phase, t, sunBody, moonBody) {
    const p = sunMoonPos(phase);
    drawSunMoonAt(ctx, p.x, p.y, p.sun ? sunBody : moonBody, p.sun, t);
    return p;
  }

  function drawClouds(ctx, t, rain) {
    const col = lerpColor('#ffffff', '#6f7c8c', rain);
    for (let i = 0; i < 6; i++) {
      const sp = 6 + seeded(i + 42) * 8;
      const x = ((seeded(i) * (WORLD.W + 400) + t * sp) % (WORLD.W + 400)) - 200;
      const top = Math.min(40, view.skyTop + 60), y = top + seeded(i + 7) * (WORLD.GROUND_Y - 260 - top);
      const s = 0.7 + seeded(i + 11) * 0.6;
      ctx.globalAlpha = 0.85;
      ell(ctx, x, y, 40 * s, 18 * s, col); circ(ctx, x - 22 * s, y + 2, 18 * s, col); circ(ctx, x + 10 * s, y - 10 * s, 22 * s, col); circ(ctx, x + 32 * s, y + 2, 16 * s, col);
      ctx.globalAlpha = 1;
    }
  }

  // --- the deep jungle behind everything: misty far canopy, tall trees with vines, palms, ferns ---
  function vine(ctx, x, y, len, seed) {
    ctx.strokeStyle = '#1c4d2a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 1; k <= 4; k++) ctx.lineTo(x + Math.sin(seed + k * 1.7) * 7, y + len * k / 4);
    ctx.stroke();
    for (let k = 1; k <= 4; k++) ell(ctx, x + Math.sin(seed + k * 1.7) * 7 + (k % 2 ? 5 : -5), y + len * k / 4 - 4, 5, 2.5, '#2a6f38', k % 2 ? 0.6 : -0.6);
  }
  function palmSil(ctx, x, gy, h, col, seed) {
    const lean = (seeded(seed) - 0.5) * 50, tx = x + lean, ty = gy - h;
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + lean * 0.3, gy - h * 0.6, tx, ty); ctx.stroke();
    for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.95 + k * Math.PI * 0.9 / 6, L = 48 + seeded(seed + k) * 16; ell(ctx, tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 + 6, L * 0.55, 6, col, a); }
    circ(ctx, tx, ty + 6, 6, col);
  }
  function fern(ctx, x, gy, size, col, seed) {
    for (let k = -2; k <= 2; k++) { const a = -Math.PI / 2 + k * 0.42 + (seeded(seed) - 0.5) * 0.2, L = size * (1 - Math.abs(k) * 0.15); const ex = x + Math.cos(a) * L, ey = gy + Math.sin(a) * L; line(ctx, x, gy, ex, ey, col, 2); for (let j = 1; j <= 3; j++) { const px = x + (ex - x) * j / 4, py = gy + (ey - gy) * j / 4, s = L * 0.18 * (1 - j / 5); line(ctx, px, py, px + Math.cos(a + 1.1) * s, py + Math.sin(a + 1.1) * s, col, 1.5); line(ctx, px, py, px + Math.cos(a - 1.1) * s, py + Math.sin(a - 1.1) * s, col, 1.5); } }
  }
  function drawFarJungle(ctx) {
    const gy = WORLD.GROUND_Y, W = WORLD.W, st = view.stretch, rs = 1 + (st - 1) * 0.45;
    // far misty canopy
    for (let i = -2; i * 64 < W + 100; i++) { const x = i * 64 + seeded(i * 7) * 30, r = (55 + seeded(i * 3 + 1) * 40) * rs; circ(ctx, x, gy - (135 + seeded(i) * 40) * st + r * 0.3, r, '#3b7a62'); }
    rect(ctx, -200, gy - 260 * st, W + 600, 270 * st, 'rgba(190,225,215,0.16)');
    // tall jungle trees with buttress roots, big crowns and the odd hanging vine
    for (let i = -1; i * 84 < W + 60; i++) {
      const x = i * 84 + seeded(i * 11 + 5) * 40, h = (190 + seeded(i * 5 + 2) * 90) * st, tw = (7 + seeded(i) * 5) * rs, R = (34 + seeded(i * 13) * 22) * rs;
      const col = '#245f33', dark = '#1c4d2a';
      rect(ctx, x - tw / 2, gy - h, tw, h + 10, dark);
      poly(ctx, [[x - tw / 2, gy - 30], [x - tw * 2.2, gy + 2], [x - tw / 2, gy + 2]], dark); poly(ctx, [[x + tw / 2, gy - 30], [x + tw * 2.2, gy + 2], [x + tw / 2, gy + 2]], dark);
      circ(ctx, x - R * 0.8, gy - h + R * 0.2, R * 0.75, col); circ(ctx, x + R * 0.85, gy - h + R * 0.15, R * 0.8, col); circ(ctx, x, gy - h - R * 0.3, R, col); circ(ctx, x + R * 0.1, gy - h - R * 0.9, R * 0.6, col);
      if (i % 3 === 0) { line(ctx, x, gy - h + 12, x + 44, gy - h - 4, dark, 4); vine(ctx, x + 44, gy - h - 4, 70 + seeded(i) * 50, i); vine(ctx, x + 22, gy - h + 4, 40 + seeded(i + 1) * 30, i + 9); }
    }
    for (let i = 0; 70 + i * 190 < W; i++) { const x = 70 + i * 190 + seeded(i * 17) * 60; palmSil(ctx, x, gy, (150 + seeded(i * 3) * 60) * st, '#1c4d2a', i); }
    // near ferns and bushes along the ground
    for (let i = -2; i * 30 < W + 40; i++) { const x = i * 30 + seeded(i * 19) * 20; if (i % 2) fern(ctx, x, gy, 20 + seeded(i) * 16, '#163f22', i); else circ(ctx, x, gy - 12, 16 + seeded(i + 3) * 12, '#1a4a28'); }
  }

  function drawGround(ctx) {
    const gy = WORLD.GROUND_Y;
    // grass all the way down: bright at the top, deeper green further down
    const g = ctx.createLinearGradient(0, gy, 0, gy + 170); g.addColorStop(0, '#3f8f3a'); g.addColorStop(1, '#245c2a');
    ctx.fillStyle = g; ctx.fillRect(-3000, gy, 8000, 170);
    rect(ctx, -3000, gy + 170, 8000, 3000, '#245c2a');
    rect(ctx, -3000, gy, 8000, 5, '#56b04a');
    // grass tufts along the edge
    for (let i = -20; i < 200; i++) {
      const x = i * 23 + seeded(i) * 10;
      if (x > WORLD.LAKE_X - 10) break;
      line(ctx, x, gy + 2, x - 3, gy - 6 - seeded(i + 5) * 5, '#56b04a', 2);
      line(ctx, x + 3, gy + 2, x + 6, gy - 5 - seeded(i + 9) * 5, '#4aa040', 2);
    }
    // lighter blades scattered down the meadow
    for (let i = -20; i < 400; i++) {
      const x = i * 15 + seeded(i * 3) * 12, y = gy + 14 + seeded(i * 7) * 130;
      if (x > WORLD.LAKE_X - 40) break;
      line(ctx, x, y + 4, x - 2, y - 4 - seeded(i) * 4, 'rgba(130,205,95,0.38)', 2);
      line(ctx, x + 3, y + 4, x + 5, y - 3 - seeded(i + 2) * 3, 'rgba(130,205,95,0.3)', 2);
    }
  }

  function drawBush(ctx, x, t) {
    const gy = WORLD.GROUND_Y;
    const sway = Math.sin(t * 1.3 + x) * 2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 4);
      line(ctx, x, gy + 4, x + Math.cos(a) * 34 + sway, gy + Math.sin(a) * 40, '#1e4d26', 7);
      line(ctx, x, gy + 4, x + Math.cos(a) * 34 + sway, gy + Math.sin(a) * 40, '#2b6b34', 3);
    }
    circ(ctx, x - 14, gy - 10, 16, '#245c2c'); circ(ctx, x + 12, gy - 12, 18, '#2b6b34'); circ(ctx, x, gy - 4, 14, '#1e4d26');
  }

  // --- the cave on the left ---
  function drawCave(ctx, t) {
    const gy = WORLD.GROUND_Y, cx = WORLD.CAVE_X;
    // rocky hill
    ell(ctx, cx - 20, gy + 6, 150, 130, '#5a4a3a'); ell(ctx, cx + 40, gy + 6, 95, 95, '#655241');
    ell(ctx, cx - 60, gy - 30, 40, 30, '#6b5a48'); ell(ctx, cx + 70, gy - 20, 30, 22, '#4a3b2d');
    // moss and plants on top
    circ(ctx, cx - 50, gy - 112, 22, '#2e8b3a'); circ(ctx, cx - 10, gy - 126, 26, '#3f8f3a'); circ(ctx, cx + 35, gy - 108, 20, '#2e8b3a'); circ(ctx, cx + 75, gy - 84, 16, '#3f8f3a');
    fern(ctx, cx - 80, gy - 60, 18, '#2a6f38', 71); fern(ctx, cx + 95, gy - 36, 16, '#2a6f38', 72);
    vine(ctx, cx - 30, gy - 100, 50, 3); vine(ctx, cx + 22, gy - 96, 36, 5);
    // opening
    ctx.beginPath(); ctx.moveTo(cx - 42, gy + 2); ctx.lineTo(cx - 42, gy - 40); ctx.quadraticCurveTo(cx - 40, gy - 86, cx, gy - 88); ctx.quadraticCurveTo(cx + 40, gy - 86, cx + 42, gy - 40); ctx.lineTo(cx + 42, gy + 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, gy - 88, 0, gy); g.addColorStop(0, '#120c08'); g.addColorStop(1, '#2a1c12'); ctx.fillStyle = g; ctx.fill();
    // stalactites and a few rocks
    for (let k = 0; k < 4; k++) { const sx = cx - 26 + k * 17; poly(ctx, [[sx - 5, gy - 84 + k % 2 * 3], [sx + 5, gy - 84 + k % 2 * 3], [sx, gy - 70 - (k % 2) * 6]], '#3b2d22'); }
    ell(ctx, cx - 36, gy + 2, 9, 5, '#6b5a48'); ell(ctx, cx + 48, gy + 3, 11, 6, '#4a3b2d'); ell(ctx, cx + 30, gy + 4, 6, 3.5, '#6b5a48');
  }
  // --- the camp: a tent the people sleep in, and a little campfire that burns at night ---
  function drawTent(ctx, t, night, sleepers) {
    const gy = WORLD.GROUND_Y, x = WORLD.TENT_X, by = gy + 6, w = 58, h = 82;
    ctx.globalAlpha = 0.22; ell(ctx, x, by + 1, w + 12, 7, '#000'); ctx.globalAlpha = 1;
    // guy ropes and pegs
    line(ctx, x - w * 0.55, by - h * 0.45, x - w - 16, by + 2, '#e6d5ac', 1.5); line(ctx, x + w * 0.55, by - h * 0.45, x + w + 16, by + 2, '#e6d5ac', 1.5);
    rect(ctx, x - w - 18, by - 3, 3, 7, '#6b4320'); rect(ctx, x + w + 15, by - 3, 3, 7, '#6b4320');
    // canvas: middle, shaded side, sunny side
    poly(ctx, [[x - w, by], [x, by - h], [x + w, by]], '#f08a3c');
    poly(ctx, [[x - w, by], [x, by - h], [x - w * 0.42, by]], '#d96a2a');
    poly(ctx, [[x + w, by], [x, by - h], [x + w * 0.42, by]], '#ffa95a');
    // doorway, lit from inside when someone is asleep in there
    const warm = sleepers > 0 && night > 0.2;
    poly(ctx, [[x - 21, by], [x, by - h * 0.74], [x + 21, by]], warm ? '#5a3418' : '#3a2415');
    if (warm) { ctx.globalAlpha = 0.55 + 0.1 * Math.sin(t * 3); poly(ctx, [[x - 15, by], [x, by - h * 0.6], [x + 15, by]], '#ffcf70'); ctx.globalAlpha = 1; }
    poly(ctx, [[x - 21, by], [x, by - h * 0.74], [x - 12, by - 14], [x - 16, by]], '#ffc78a'); // rolled-back flaps
    poly(ctx, [[x + 21, by], [x, by - h * 0.74], [x + 12, by - 14], [x + 16, by]], '#ffc78a');
    // pole and flag
    line(ctx, x, by - h - 16, x, by - h + 4, '#6b4320', 3);
    poly(ctx, [[x, by - h - 16], [x + 17, by - h - 11 + Math.sin(t * 3) * 2], [x, by - h - 6]], '#ffd21f');
    if (sleepers > 0) drawZzz(ctx, x + 14, by - h * 0.72, t);
    // campfire: a ring of stones, two logs, and flames once it gets dark
    const fx = x + 84, fy = gy + 9;
    for (let k = 0; k < 5; k++) ell(ctx, fx - 12 + k * 6, fy + (k % 2) * 2, 4, 3, k % 2 ? '#8a8a84' : '#a5a59c');
    line(ctx, fx - 9, fy - 2, fx + 9, fy - 7, '#6b4320', 4); line(ctx, fx + 9, fy - 2, fx - 9, fy - 7, '#8a5a2b', 4);
    if (night > 0.05) {
      const f = 0.85 + 0.15 * Math.sin(t * 11);
      ctx.globalAlpha = Math.min(1, night * 3);
      poly(ctx, [[fx - 8, fy - 5], [fx - 3 + Math.sin(t * 9) * 2, fy - 26 * f], [fx + 1, fy - 13], [fx + 5 + Math.sin(t * 7) * 2, fy - 21 * f], [fx + 8, fy - 5]], '#ff8c1a');
      poly(ctx, [[fx - 4, fy - 5], [fx + Math.sin(t * 13) * 1.5, fy - 15 * f], [fx + 4, fy - 5]], '#ffe066');
      ctx.globalAlpha = 1;
    }
  }
  // warm light painted after the night tint, so the camp glows in the dark
  function drawCampGlow(ctx, t, night) {
    if (night <= 0.05) return;
    const gy = WORLD.GROUND_Y, fx = WORLD.TENT_X + 84, fy = gy - 4, r = 74 + Math.sin(t * 9) * 4;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    g.addColorStop(0, `rgba(255,190,90,${0.5 * night})`); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
    const f = 0.85 + 0.15 * Math.sin(t * 11), y0 = gy + 9;
    poly(ctx, [[fx - 4, y0 - 5], [fx + Math.sin(t * 13) * 1.5, y0 - 15 * f], [fx + 4, y0 - 5]], '#ffe066');
  }
  // little thought bubble with an emoji, shown over people and animals while they play
  function drawBubble(ctx, emoji, x, y, t) {
    const b = Math.sin(t * 5) * 1.5;
    ctx.globalAlpha = 0.95; circ(ctx, x, y + b, 12, '#fff'); poly(ctx, [[x - 4, y + b + 10], [x + 4, y + b + 10], [x, y + b + 17]], '#fff'); ctx.globalAlpha = 1;
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#222'; ctx.fillText(emoji, x, y + b + 1);
  }
  // --- beaver things: sticks on the ground and the dam ---
  function drawStick(ctx, x, y, r, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r);
    rrect(ctx, -11, -3, 22, 6, 3, '#8a5a2b'); rrect(ctx, -9, -2, 18, 2, 1, '#a9743d'); line(ctx, 4, -3, 9, -8, '#8a5a2b', 2.5);
    ctx.restore();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); circ(ctx, x + 10, y - 10, 2, '#fff'); ctx.globalAlpha = 1;
  }
  function drawDam(ctx, stage, level, t, spill) {
    if (!stage) return;
    const gy = WORLD.GROUND_Y, dx = WORLD.DAM_X, floor = gy + WORLD.LAKE_FLOOR, wy = waterY(level), extra = WORLD.LAKE_FLOOR - 75;
    const h = [0, 34, 58, 86][Math.min(stage, 3)] + (stage ? extra : 0), top = floor - h;
    rrect(ctx, dx - 16, top, 32, h, 6, '#6b4320');
    for (let k = 0; k < Math.floor(h / 9); k++) { const y = floor - 6 - k * 9, off = (k % 2) * 5; rrect(ctx, dx - 15 + off, y - 3, 28 - off * 2, 6, 3, k % 2 ? '#8a5a2b' : '#a9743d'); circ(ctx, dx - 14 + off, y, 2.5, '#d9b48a'); circ(ctx, dx + 13 - off, y, 2.5, '#d9b48a'); }
    if (stage >= 3) { circ(ctx, dx - 10, top - 4, 6, '#3f8f3a'); circ(ctx, dx + 8, top - 5, 7, '#2e8b3a'); }
    if (spill > 0 && wy < top + 6) {
      // water pouring over the dam
      ctx.globalAlpha = 0.8 * spill; rect(ctx, dx + 14, top - 4, 10, Math.max(8, floor - top) , '#9fd8f5'); ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * spill})`; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { const off = (t * 150 + k * 29) % (floor - top); ctx.beginPath(); ctx.moveTo(dx + 16 + k * 3, top + off - 4); ctx.lineTo(dx + 16 + k * 3, Math.min(floor, top + off + 14)); ctx.stroke(); }
      for (let k = 0; k < 4; k++) { ctx.globalAlpha = spill * (0.4 + 0.3 * Math.sin(t * 5 + k)); circ(ctx, dx + 12 + k * 6, top - 2 - Math.abs(Math.sin(t * 3 + k)) * 6, 4, '#eaf7ff'); }
      ctx.globalAlpha = 1;
    }
  }
  // --- waterfall at the right end of the lake ---
  function drawCliff(ctx) {
    const gy = WORLD.GROUND_Y, fx = WORLD.FALLS_X, top = gy - 170;
    const bot = gy + WORLD.LAKE_FLOOR + 5;
    poly(ctx, [[fx, bot], [fx - 6, gy + 10], [fx + 4, gy - 60], [fx - 3, gy - 120], [fx + 6, top], [WORLD.W + 400, top], [WORLD.W + 400, bot]], '#5a4a3a');
    for (let k = 0; k < 6; k++) { const y = top + 25 + k * 38; rrect(ctx, fx - 2 + (k % 2) * 6, y, 30 + (k % 3) * 8, 10, 4, k % 2 ? '#6b5a48' : '#4a3b2d'); }
    rect(ctx, fx - 4, top - 6, WORLD.W + 400, 8, '#2e8b3a'); // mossy lip
    for (let k = 0; k < 4; k++) circ(ctx, fx + 10 + k * 14, top - 8, 7 + (k % 2) * 3, '#3f8f3a');
    fern(ctx, fx + 8, top - 4, 22, '#2a6f38', 41); fern(ctx, fx + 30, top - 4, 18, '#2a6f38', 42);
    rect(ctx, fx + 8, top - 10, WORLD.W + 400, 7, '#3aa0e0'); // the stream feeding the falls
  }
  function drawFalls(ctx, level, t) {
    const gy = WORLD.GROUND_Y, fx = WORLD.FALLS_X, top = gy - 176, wy = waterY(level), x0 = fx + 6, w = 28;
    ctx.globalAlpha = 0.85; rect(ctx, x0, top, w, wy - top, '#7cc8f0'); ctx.globalAlpha = 1;
    // falling streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const sx = x0 + 4 + k * 4; const off = ((t * 180 + k * 37) % (wy - top)); ctx.beginPath(); ctx.moveTo(sx, top + off); ctx.lineTo(sx, Math.min(wy, top + off + 26)); ctx.stroke(); }
    // mist and foam where it lands
    for (let k = 0; k < 7; k++) { const px = x0 - 14 + k * 9 + Math.sin(t * 3 + k) * 3, py = wy - 2 - Math.abs(Math.sin(t * 2.5 + k * 1.3)) * 9; ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 4 + k); circ(ctx, px, py, 5 + (k % 3) * 2, '#eaf7ff'); }
    ctx.globalAlpha = 1;
  }
  function drawLilyPad(ctx, x, wy, t, i) {
    const y = wy + Math.sin(t * 1.6 + i * 2) * 1.2;
    ell(ctx, x, y, 17, 7.5, '#2e8b3a');
    ell(ctx, x - 2, y - 1, 12, 4.5, '#3fa84a');
    // notch
    poly(ctx, [[x, y], [x + 17, y - 4], [x + 17, y + 2]], '#3aa0e0');
    line(ctx, x - 10, y, x + 10, y - 1, '#56b04a', 1);
  }
  // round "plant here" button under an empty spot; hot = a seed is picked so it bounces
  function drawPlantButton(ctx, x, y, t, hot) {
    const by = y + 44 - (hot ? Math.abs(Math.sin(t * 5)) * 4 : 0), r = 12;
    ctx.globalAlpha = 0.35; ell(ctx, x, y + 46, r + 2, 4, '#000'); ctx.globalAlpha = 1;
    circ(ctx, x, by, r, hot ? '#ffd21f' : '#ffffff');
    ctx.strokeStyle = hot ? '#b8860b' : '#2e8b3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, by, r, 0, TAU); ctx.stroke();
    line(ctx, x - 6, by, x + 6, by, '#2e8b3a', 3.5); line(ctx, x, by - 6, x, by + 6, '#2e8b3a', 3.5);
  }
  function drawMound(ctx, x, highlight) {
    const gy = WORLD.GROUND_Y;
    ell(ctx, x, gy + 4, 20, 7, '#5a3b1e');
    ell(ctx, x, gy + 2, 14, 4.5, '#7a5230');
    if (highlight) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(highlight * 4); line(ctx, x, gy - 30, x, gy - 14, '#fff', 3); line(ctx, x - 8, gy - 22, x, gy - 14, '#fff', 3); line(ctx, x + 8, gy - 22, x, gy - 14, '#fff', 3); ctx.globalAlpha = 1; }
  }

  // --- lake ---
  function waterY(level) { return WORLD.GROUND_Y + 60 - level * 62; }
  function drawLakeBasin(ctx) {
    const gy = WORLD.GROUND_Y, lx = WORLD.LAKE_X, fl = gy + WORLD.LAKE_FLOOR;
    const g = ctx.createLinearGradient(0, gy, 0, fl); g.addColorStop(0, '#8a6a3e'); g.addColorStop(1, '#4d3a24');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx - 20, gy); ctx.lineTo(lx + 50, fl); ctx.lineTo(WORLD.W + 400, fl); ctx.lineTo(WORLD.W + 400, gy); ctx.closePath(); ctx.fill();
    poly(ctx, [[lx - 20, gy], [lx + 50, fl], [lx + 70, fl], [lx + 5, gy]], '#a68556'); // sandy slope
  }
  // swaying seaweed and pebbles on the lake bottom (drawn on top of the water, under the front tint)
  function drawSeaweed(ctx, level, t) {
    const gy = WORLD.GROUND_Y, floor = gy + WORLD.LAKE_FLOOR, wy = waterY(level);
    const x0 = WORLD.LAKE_X + 64, x1 = WORLD.DAM_X - 34;
    for (let i = 0; x0 - 20 + i * 41 < x1 + 30; i++) { const x = x0 - 20 + i * 41 + seeded(i * 9) * 20; ell(ctx, x, floor - 2, 5 + seeded(i) * 5, 3, i % 2 ? '#6b5a48' : '#8a7a62'); }
    ctx.lineCap = 'round';
    for (let i = 0; x0 + i * 26 < x1; i++) {
      const x = x0 + i * 26 + seeded(i * 23) * 14, h = Math.min(floor - wy - 8, 26 + seeded(i * 5) * 44), col = i % 3 ? '#1f7a4a' : '#2a9a5a';
      if (h < 8) continue;
      const sway = Math.sin(t * 1.4 + i * 1.3) * 5, segs = 5;
      ctx.strokeStyle = col; ctx.lineWidth = 3 + (i % 2);
      ctx.beginPath(); ctx.moveTo(x, floor + 2);
      for (let k = 1; k <= segs; k++) { const f = k / segs; ctx.lineTo(x + Math.sin(f * 3 + t * 1.4 + i) * 3 * f + sway * f, floor - h * f); }
      ctx.stroke();
      for (let k = 1; k < segs; k += 2) { const f = k / segs, lx = x + sway * f, ly = floor - h * f; ell(ctx, lx - 5, ly - 2, 5, 2.5, col); ell(ctx, lx + 5, ly + 1, 5, 2.5, col); }
    }
  }

  function drawWater(ctx, level, t) {
    const gy = WORLD.GROUND_Y, lx = WORLD.LAKE_X;
    const wy = waterY(level);
    const fl = gy + WORLD.LAKE_FLOOR, xl = lx - 20 + (wy - gy) / WORLD.LAKE_FLOOR * 70;
    ctx.globalAlpha = 0.9;
    const g = ctx.createLinearGradient(0, wy, 0, fl); g.addColorStop(0, '#3aa0e0'); g.addColorStop(1, '#1f6fae');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xl, wy); ctx.lineTo(lx + 50, fl); ctx.lineTo(WORLD.W + 400, fl); ctx.lineTo(WORLD.W + 400, wy); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // surface shimmer
    for (let i = 0; i < 9; i++) {
      const x = xl + 20 + i * 38 + Math.sin(t * 1.5 + i) * 6;
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2 + i * 1.7);
      line(ctx, x, wy + 6 + (i % 3) * 7, x + 16, wy + 6 + (i % 3) * 7, '#dff4ff', 2);
    }
    ctx.globalAlpha = 1;
    return { wy, xl };
  }
  function drawWaterFront(ctx, level) {
    const gy = WORLD.GROUND_Y, lx = WORLD.LAKE_X;
    const wy = waterY(level);
    const fl = gy + WORLD.LAKE_FLOOR, xl = lx - 20 + (wy - gy) / WORLD.LAKE_FLOOR * 70;
    ctx.globalAlpha = 0.35;
    poly(ctx, [[xl, wy], [lx + 50, fl], [WORLD.W + 400, fl], [WORLD.W + 400, wy]], '#4fb4f0');
    ctx.globalAlpha = 1;
    line(ctx, xl, wy, WORLD.W + 400, wy, '#e8f7ff', 2);
  }

  // --- plants ---
  // level (1-3) makes an upgraded plant bigger.
  const UI_DY = 38; // stars and grow bar sit this far under a land plant, in front of everyone's feet
  function levelScale(level) { return 1 + RULES.upgrade.sizePerLevel * ((level || 1) - 1); }
  function plantMetrics(def, progress, level) {
    const pr = Math.min(1, progress);
    const s = (pr < 0.12 ? 0.08 : 0.25 + 0.75 * (pr - 0.12) / 0.88) * levelScale(level) * view.boost;
    const H = def.height * s;
    let topY, canopyY, R;
    switch (def.style) {
      case 'round': { const trunkH = H * 0.62; R = H * 0.17; topY = -(trunkH + R * 1.55); canopyY = -(trunkH + R * 0.6); break; }
      case 'kapok': { const trunkH = H * 0.6; R = H * 0.19; topY = -(trunkH + R * 1.75); canopyY = -(trunkH + R * 0.8); break; }
      case 'banana': R = H * 0.2; topY = -H * 0.9; canopyY = -H * 0.62; break;
      case 'palm': R = H * 0.18; topY = -H * 0.9; canopyY = -H * 0.82; break;
      case 'papaya': R = H * 0.16; topY = -H * 0.94; canopyY = -H * 0.82; break;
      case 'bamboo': R = H * 0.1; topY = -H * 0.93; canopyY = -H * 0.65; break;
      case 'bush': R = H * 0.4; topY = -H * 0.9; canopyY = -H * 0.5; break;
      case 'lily': R = H * 0.35; topY = -H * 0.9; canopyY = -H * 0.5; break;
      default: R = H * 0.17; topY = -H * 0.95; canopyY = -H * 0.78; // flowers
    }
    return { H, s, topY, canopyY, R, grown: pr >= 1 };
  }

  function fruitDots(ctx, def, n, spots, r) {
    if (!def.fruit) return;
    for (let i = 0; i < Math.min(n, spots.length); i++) {
      const [x, y] = spots[i];
      circ(ctx, x, y, r, def.fruit.color);
      circ(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,255,0.55)');
    }
  }

  function drawTrunk(ctx, h, wBot, wTop, color) {
    poly(ctx, [[-wBot / 2, 0], [wBot / 2, 0], [wTop / 2, -h], [-wTop / 2, -h]], color);
    poly(ctx, [[-wBot / 2 + 1.5, 0], [-wBot / 2 + 1.5 + wBot * 0.25, 0], [-wTop / 2 + 1 + wTop * 0.25, -h], [-wTop / 2 + 1, -h]], shade(color, 25));
  }

  // x, baseY = where the plant meets the ground (or the water surface for water plants)
  function drawPlant(ctx, x, baseY, def, plant, t, night) {
    const m = plantMetrics(def, plant.progress, plant.level);
    const pr = Math.min(1, plant.progress);
    const water = def.kind === 'water';
    ctx.save(); ctx.translate(x, baseY);
    if (water) { ctx.globalAlpha = 0.5; ell(ctx, 0, 2, 26 * m.s + 8, 5, '#dff4ff'); ctx.globalAlpha = 1; }
    else ell(ctx, 0, 4, 20, 7, '#5a3b1e');
    if (pr < 0.12) {
      const k = pr / 0.12;
      if (water) { ell(ctx, 0, 0, 10 * k + 2, 3.5 * k + 1, '#2e7d32'); }
      else {
        ell(ctx, 0, 2, 15, 5, '#7a5230');
        if (k > 0.3) { const h = 14 * k; line(ctx, 0, 2, 0, -h, '#4aa040', 3); ell(ctx, -6 * k, -h + 2, 6 * k, 3 * k, '#56b04a', -0.5); ell(ctx, 6 * k, -h + 2, 6 * k, 3 * k, '#56b04a', 0.5); }
        else circ(ctx, 0, -1, 3, '#c9a66b');
      }
      ctx.restore(); return m;
    }
    const s = m.s, H = m.H;
    const sway = Math.sin(t * 1.2 + x * 0.05) * 2.5 * s;
    const fruit = plant.fruit || 0;
    switch (def.style) {
      case 'round': {
        const trunkH = H * 0.62, R = m.R, leaf = def.leaf || '#2e8b3a';
        drawTrunk(ctx, trunkH, 11 * s + 2, 6 * s + 2, '#6b4423');
        ctx.translate(sway, 0);
        circ(ctx, -R * 0.8, -trunkH - R * 0.3, R * 0.85, shade(leaf, -20));
        circ(ctx, R * 0.8, -trunkH - R * 0.3, R * 0.85, shade(leaf, -20));
        circ(ctx, 0, -trunkH - R * 0.85, R, leaf);
        circ(ctx, 0, -trunkH - R * 0.25, R * 0.9, leaf);
        circ(ctx, -R * 0.3, -trunkH - R * 1.05, R * 0.45, shade(leaf, 30));
        fruitDots(ctx, def, fruit, [[-R * 0.6, -trunkH - R * 0.35], [R * 0.65, -trunkH - R * 0.7], [0, -trunkH - R * 1.15], [R * 0.15, -trunkH], [-R * 0.95, -trunkH - R * 0.8]], 5 * s + 2);
        break;
      }
      case 'kapok': {
        const trunkH = H * 0.6, R = m.R, leaf = def.leaf || '#2f7a3f';
        poly(ctx, [[-18 * s, 0], [-7 * s, -trunkH * 0.25], [-7 * s, 0]], '#5a3b1e');
        poly(ctx, [[18 * s, 0], [7 * s, -trunkH * 0.25], [7 * s, 0]], '#5a3b1e');
        drawTrunk(ctx, trunkH, 17 * s + 3, 10 * s + 2, '#7b5634');
        ctx.translate(sway, 0);
        for (let i = -2; i <= 2; i++) circ(ctx, i * R * 0.85, -trunkH - R * 0.7 + Math.abs(i) * R * 0.3, R * (1 - Math.abs(i) * 0.12), i % 2 ? shade(leaf, -18) : leaf);
        circ(ctx, 0, -trunkH - R * 1.25, R * 0.9, shade(leaf, 10));
        circ(ctx, -R * 0.4, -trunkH - R * 1.45, R * 0.4, shade(leaf, 40));
        break;
      }
      case 'banana': {
        const stemH = H * 0.52;
        drawTrunk(ctx, stemH, 12 * s + 2, 9 * s + 2, '#7aa84a');
        ctx.translate(sway, -stemH);
        const angs = [-2.6, -2.1, -1.0, -0.5, -1.9, -1.25];
        angs.forEach((a, i) => {
          const L = H * 0.4 * (0.8 + (i % 3) * 0.1), w = H * 0.075;
          ell(ctx, Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5, L * 0.5, w, i % 2 ? '#3fa34d' : '#2e8b3a', a);
          line(ctx, 0, 0, Math.cos(a) * L, Math.sin(a) * L, '#9ad66a', 1.5);
        });
        if (fruit > 0) for (let i = 0; i < fruit; i++) ell(ctx, 7 * s + i * 5 * s, 12 + i * 2, 4 * s + 1.5, 9 * s + 2, '#ffe135', 0.3);
        break;
      }
      case 'palm': {
        const topX = H * 0.1, topY = -H * 0.86;
        ctx.strokeStyle = '#8b6b3e'; ctx.lineWidth = 8 * s + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-H * 0.04, -H * 0.5, topX, topY); ctx.stroke();
        for (let i = 1; i < 9; i++) { const q = i / 9; const px = 2 * (1 - q) * q * (-H * 0.04) + q * q * topX; const py = 2 * (1 - q) * q * (-H * 0.5) + q * q * topY; line(ctx, px - 4 * s, py, px + 4 * s, py, '#6b4e2b', 1.5); }
        ctx.translate(topX + sway, topY);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + i * (Math.PI / 6);
          const ex = Math.cos(a) * H * 0.3, ey = Math.sin(a) * H * 0.14 + H * 0.1;
          ctx.strokeStyle = i % 2 ? '#2f9e44' : '#3fb950'; ctx.lineWidth = 6 * s + 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(ex * 0.6, ey - H * 0.14, ex, ey); ctx.stroke();
        }
        fruitDots(ctx, def, fruit, [[-5 * s, 5], [5 * s, 7], [0, 11]], 5 * s + 2);
        break;
      }
      case 'papaya': {
        const trunkH = H * 0.8;
        drawTrunk(ctx, trunkH, 8 * s + 2, 6 * s + 2, '#9c8a5a');
        ctx.translate(sway, -trunkH);
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI + i * (Math.PI / 7), L = H * 0.2;
          line(ctx, 0, 0, Math.cos(a) * L, Math.sin(a) * L * 0.6, '#8fbf4a', 2);
          circ(ctx, Math.cos(a) * L, Math.sin(a) * L * 0.6, H * 0.065, i % 2 ? '#3fa34d' : '#56b04a');
        }
        circ(ctx, 0, -H * 0.04, H * 0.07, '#56b04a');
        fruitDots(ctx, def, fruit, [[-6 * s, 10 * s + 4], [6 * s, 15 * s + 4], [0, 24 * s + 4]], 6 * s + 2);
        break;
      }
      case 'bamboo': {
        const offs = [-9 * s - 1, 0, 9 * s + 1], hs = [0.82, 1, 0.9];
        offs.forEach((ox, k) => {
          const h = H * hs[k] * 0.95, w = 5 * s + 1.5, segs = 8;
          for (let i = 0; i < segs; i++) {
            const y0 = -h * i / segs, y1 = -h * (i + 1) / segs, sx = sway * i / segs;
            rrect(ctx, ox - w / 2 + sx, y1, w, y0 - y1 - 1.5, 2, i % 2 ? '#7ccf5a' : '#8fd86a');
            line(ctx, ox - w / 2 - 1 + sx, y1, ox + w / 2 + 1 + sx, y1, '#4a8f3a', 1.5);
          }
          ell(ctx, ox + 9 * s + sway, -h * 0.9, 9 * s + 3, 3 * s + 1, '#5bb04a', -0.4);
          ell(ctx, ox - 9 * s + sway, -h * 0.75, 9 * s + 3, 3 * s + 1, '#5bb04a', 0.5);
          ell(ctx, ox + 8 * s + sway, -h * 0.55, 8 * s + 3, 3 * s + 1, '#6bc05a', -0.3);
        });
        fruitDots(ctx, def, fruit, [[-14 * s - 4, -6], [14 * s + 4, -5], [0, -4]], 5 * s + 2);
        break;
      }
      case 'bush': {
        const R = m.R;
        circ(ctx, -R * 0.8, -R * 0.6, R * 0.8, '#2e7d32'); circ(ctx, R * 0.8, -R * 0.6, R * 0.8, '#2e7d32');
        circ(ctx, 0, -R * 1.1, R, '#3fa34d'); circ(ctx, 0, -R * 0.5, R * 0.9, '#388e3c');
        fruitDots(ctx, def, fruit, [[-R * 0.6, -R * 0.8], [R * 0.5, -R * 1.2], [0, -R * 0.4], [R * 0.9, -R * 0.5], [-R * 0.2, -R * 1.6]], 4 * s + 1.5);
        break;
      }
      case 'lily': {
        // floating on the water: big round pad with a notch, flower sitting on it
        const bob = Math.sin(t * 1.5 + x) * 1.2;
        ctx.translate(0, bob);
        ell(ctx, 0, 0, 24 * s + 4, 8 * s + 2, '#2e7d32');
        ell(ctx, -4 * s, -1, 16 * s + 2, 4 * s + 1, '#3fa34d');
        poly(ctx, [[0, 0], [20 * s + 4, -8 * s - 3], [24 * s + 4, 0]], '#3aa0e0');
        ctx.translate(2 * s, -7 * s - 2);
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * TAU / 7; ell(ctx, Math.cos(a) * 7 * s, Math.sin(a) * 4 * s, 8 * s + 2, 3.5 * s + 1, def.petal, a); }
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5 + 0.3; ell(ctx, Math.cos(a) * 3 * s, Math.sin(a) * 2 * s - 2, 5 * s + 1, 2.5 * s + 1, shade(def.petal, 25), a); }
        circ(ctx, 0, -2, 3 * s + 1, fruit > 0 ? '#fff6a0' : '#f3c04a');
        break;
      }
      case 'orchid': {
        ctx.strokeStyle = '#4a8f3a'; ctx.lineWidth = 3 * s + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-H * 0.3, -H * 0.5, H * 0.1 + sway, -H * 0.95); ctx.stroke();
        ell(ctx, -8 * s, -6, 12 * s + 2, 4 * s + 1, '#3fa34d', -0.8); ell(ctx, 8 * s, -4, 12 * s + 2, 4 * s + 1, '#3fa34d', 0.8);
        [[-H * 0.2, -H * 0.55], [-H * 0.05, -H * 0.8], [H * 0.1 + sway, -H * 0.95]].forEach((p, k) => {
          const r = (6 - k) * s + 2;
          for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ell(ctx, p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, r * 0.9, r * 0.55, def.petal, a); }
          circ(ctx, p[0], p[1], r * 0.45, fruit > k ? '#fff6a0' : '#f3c04a');
        });
        break;
      }
      case 'rainbow':
      case 'moonflower':
      case 'flower':
      default: {
        const stemH = H * 0.78, R = m.R;
        line(ctx, 0, 0, sway, -stemH, '#4a8f3a', 4 * s + 1);
        ell(ctx, -10 * s, -stemH * 0.4, 12 * s + 2, 5 * s + 1, '#3fa34d', -0.6);
        ell(ctx, 10 * s, -stemH * 0.6, 12 * s + 2, 5 * s + 1, '#56b04a', 0.6);
        ctx.translate(sway, -stemH);
        let open = 1, petalR = R, petals = 6;
        if (def.style === 'moonflower') { open = 0.25 + 0.75 * night; if (night > 0.2) { const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 3.5); g.addColorStop(0, `rgba(210,225,255,${0.5 * night})`); g.addColorStop(1, 'rgba(210,225,255,0)'); ctx.fillStyle = g; ctx.fillRect(-R * 3.5, -R * 3.5, R * 7, R * 7); } }
        if (def.style === 'rainbow') petals = 7;
        const rainbowCols = ['#ff3b3b', '#ff8c1a', '#ffd21f', '#5bd15b', '#2f6bff', '#8a4fff', '#ff4fa0'];
        for (let i = 0; i < petals; i++) {
          const a = -Math.PI / 2 + i * TAU / petals + (1 - open) * 0.4;
          const col = def.style === 'rainbow' ? rainbowCols[i] : def.petal;
          const d = petalR * (0.5 + 0.5 * open);
          ell(ctx, Math.cos(a) * d, Math.sin(a) * d, petalR * 0.95 * (0.6 + 0.4 * open), petalR * 0.55, col, a);
        }
        circ(ctx, 0, 0, petalR * 0.5, fruit > 0 ? '#fff6a0' : '#f3c04a');
        if (fruit > 0) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); circ(ctx, -petalR * 0.25, -petalR * 0.2, 1.5, '#fff'); circ(ctx, petalR * 0.25, petalR * 0.15, 1.5, '#fff'); ctx.globalAlpha = 1; }
        break;
      }
    }
    ctx.restore();
    // level stars under every sprouted plant: gold = current level, faint = levels still to earn
    if (!plant.pending && pr < 1) drawGrowBar(ctx, x, baseY + (water ? 10 : UI_DY), pr, t);
    else if (!plant.pending) drawLevelStars(ctx, x, baseY + (water ? 10 : UI_DY), plant.level || 1, t);
    return m;
  }

  // the floating spot where a water plant can be planted
  function star(ctx, cx, cy, r, fill, stroke) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  // little progress bar under a growing plant
  function drawGrowBar(ctx, x, y, pr, t) {
    const w = 34, h = 6;
    ctx.globalAlpha = 0.45; rrect(ctx, x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2, 4, '#1b2a1d'); ctx.globalAlpha = 1;
    rrect(ctx, x - w / 2, y - h / 2, w, h, 3, '#d7e4d2');
    const fw = Math.max(h, w * pr);
    rrect(ctx, x - w / 2, y - h / 2, fw, h, 3, pr < 0.5 ? '#9ad66a' : '#56b04a');
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); circ(ctx, x - w / 2 + fw - 2, y, 2, '#fff'); ctx.globalAlpha = 1;
  }
  function drawLevelStars(ctx, x, y, level, t) {
    const n = RULES.upgrade.maxLevel, gap = 12;
    for (let i = 0; i < n; i++) {
      const sx = x + (i - (n - 1) / 2) * gap, earned = i < level;
      ctx.globalAlpha = earned ? 0.85 + 0.15 * Math.sin(t * 3 + i * 2) : 0.45;
      star(ctx, sx, y, earned ? 5 : 4, earned ? '#ffd21f' : 'rgba(255,255,255,0.7)', earned ? '#b8860b' : 'rgba(0,0,0,0.3)');
    }
    ctx.globalAlpha = 1;
  }
  function drawWaterSpot(ctx, x, y, t, highlight) {
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 2 + x);
    ell(ctx, x, y + 1, 22, 6, '#dff4ff'); ell(ctx, x, y + 1, 14, 3.5, '#3aa0e0');
    ctx.globalAlpha = 1;
    ell(ctx, x, y, 7, 3, '#2e7d32');
    if (highlight) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(highlight * 4); line(ctx, x, y - 30, x, y - 14, '#fff', 3); line(ctx, x - 8, y - 22, x, y - 14, '#fff', 3); line(ctx, x + 8, y - 22, x, y - 14, '#fff', 3); ctx.globalAlpha = 1; }
  }

  // --- accessories (hats etc) ---
  function drawAccessory(ctx, id, hx, hy, hr, face = 1) {
    if (!id || id === 'none') return;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(face, 1);
    switch (id) {
      case 'cap': ctx.beginPath(); ctx.arc(0, -hr * 0.55, hr * 1.02, Math.PI, 0); ctx.fillStyle = '#e53935'; ctx.fill(); rrect(ctx, -hr * 0.2, -hr * 0.62, hr * 1.7, hr * 0.28, 3, '#b71c1c'); circ(ctx, 0, -hr * 1.55, hr * 0.15, '#b71c1c'); break;
      case 'partyhat': poly(ctx, [[-hr * 0.7, -hr * 0.7], [hr * 0.7, -hr * 0.7], [0, -hr * 2.4]], '#8a4fff'); poly(ctx, [[-hr * 0.35, -hr * 1.55], [hr * 0.35, -hr * 1.55], [0, -hr * 2.4]], '#ffd21f'); circ(ctx, 0, -hr * 2.4, hr * 0.25, '#ff4fa0'); break;
      case 'crown': poly(ctx, [[-hr * 0.8, -hr * 0.7], [hr * 0.8, -hr * 0.7], [hr * 0.8, -hr * 1.5], [hr * 0.4, -hr * 1.1], [0, -hr * 1.7], [-hr * 0.4, -hr * 1.1], [-hr * 0.8, -hr * 1.5]], '#ffd21f'); circ(ctx, 0, -hr * 0.95, hr * 0.14, '#ff3b3b'); circ(ctx, -hr * 0.45, -hr * 0.95, hr * 0.1, '#2f6bff'); circ(ctx, hr * 0.45, -hr * 0.95, hr * 0.1, '#2f6bff'); break;
      case 'bow': { const bx = -hr * 0.55, by = -hr * 0.9; poly(ctx, [[bx, by], [bx - hr * 0.6, by - hr * 0.45], [bx - hr * 0.6, by + hr * 0.35]], '#ff4fa0'); poly(ctx, [[bx, by], [bx + hr * 0.6, by - hr * 0.45], [bx + hr * 0.6, by + hr * 0.35]], '#ff4fa0'); circ(ctx, bx, by, hr * 0.17, '#d81b60'); break; }
      case 'glasses': ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1.5, hr * 0.14); ctx.beginPath(); ctx.arc(-hr * 0.45, -hr * 0.05, hr * 0.38, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(hr * 0.45, -hr * 0.05, hr * 0.38, 0, TAU); ctx.stroke(); line(ctx, -hr * 0.07, -hr * 0.05, hr * 0.07, -hr * 0.05, '#222', hr * 0.14); break;
      case 'flower': { const fx = -hr * 0.7, fy = -hr * 0.8; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circ(ctx, fx + Math.cos(a) * hr * 0.28, fy + Math.sin(a) * hr * 0.28, hr * 0.2, '#fff'); } circ(ctx, fx, fy, hr * 0.17, '#ffd21f'); break; }
      case 'scarf': rrect(ctx, -hr * 1.05, hr * 0.65, hr * 2.1, hr * 0.5, hr * 0.2, '#e53935'); rrect(ctx, -hr * 0.9, hr * 0.9, hr * 0.45, hr * 1.1, hr * 0.15, '#e53935'); line(ctx, -hr * 0.9, hr * 1.4, -hr * 0.45, hr * 1.4, '#ffd21f', 2); break;
      case 'tophat': rrect(ctx, -hr * 1.1, -hr * 0.95, hr * 2.2, hr * 0.3, 3, '#222'); rrect(ctx, -hr * 0.7, -hr * 2.2, hr * 1.4, hr * 1.4, 3, '#222'); rect(ctx, -hr * 0.7, -hr * 1.2, hr * 1.4, hr * 0.25, '#e53935'); break;
    }
    ctx.restore();
  }

  // --- people ---
  // p: {skin, shirt, pants, hair, acc}; o: {t, moving, face, planting, closed}
  function drawPerson(ctx, x, y, p, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(o.face || 1, 1);
    const sw = o.moving ? Math.sin(o.t * 11) * 7 : 0;
    const squash = o.planting ? 0.85 : 1;
    ctx.scale(1, squash);
    rrect(ctx, -8 + sw * 0.5, -24, 7, 25, 3, p.pants); rrect(ctx, 1 - sw * 0.5, -24, 7, 25, 3, p.pants);
    rect(ctx, -9 + sw * 0.5, -2, 9, 4, '#4a3321'); rect(ctx, 0 - sw * 0.5, -2, 9, 4, '#4a3321');
    rrect(ctx, -10, -48, 20, 26, 6, p.shirt);
    line(ctx, -9, -44, -13 - sw * 0.4, -28, p.skin, 5); line(ctx, 9, -44, 13 + sw * 0.4, -28, p.skin, 5);
    circ(ctx, 0, -58, 11, p.skin);
    ctx.beginPath(); ctx.arc(0, -59, 11.5, Math.PI, 0); ctx.fillStyle = p.hair; ctx.fill();
    rect(ctx, -11.5, -59, 4, 7, p.hair);
    eye(ctx, 3, -58, 2.2, o.closed); eye(ctx, 7.5, -58, 2.2, o.closed);
    smile(ctx, 5, -54, 3);
    ctx.restore();
    drawAccessory(ctx, p.acc, x, y - 58 * squash, 11, o.face || 1);
  }

  // --- critters --- each returns {hx,hy,hr}: head position for accessories (in local coords, facing right)
  const C = {};
  C.parrot = (ctx, o) => {
    const { c1, c2 } = o; const flap = o.moving ? Math.sin(o.t * 22) * 0.6 : 0;
    ell(ctx, -11, -8, 4, 11, c2, 0.45);
    ell(ctx, 0, -17, 9, 13, c1);
    ell(ctx, -1, -17, 5, 11, c2, -0.35 + flap);
    ell(ctx, 2, -11, 5, 6, shade(c1, 50));
    circ(ctx, 5, -31, 8.5, c1);
    poly(ctx, [[11, -34], [19, -32], [13, -26], [10, -29]], '#f3c04a'); circ(ctx, 17, -31, 1.3, '#222');
    circ(ctx, 7, -32, 3.5, '#fff'); eye(ctx, 8, -32, 2.3, o.closed);
    line(ctx, -2, -5, -2, 0, '#555', 2); line(ctx, 3, -5, 3, 0, '#555', 2);
    return { hx: 5, hy: -31, hr: 8.5 };
  };
  C.toucan = (ctx, o) => {
    const { c1, c2 } = o; const flap = o.moving ? Math.sin(o.t * 20) * 0.6 : 0;
    ell(ctx, -10, -9, 4, 9, c1, 0.4);
    ell(ctx, 0, -17, 10, 13, c1);
    ell(ctx, 3, -14, 5, 8, '#fff');
    ell(ctx, -3, -18, 5, 11, shade(c1, 30), -0.3 + flap);
    circ(ctx, 4, -31, 9, c1);
    ell(ctx, 7, -30, 5, 6, '#fff');
    ell(ctx, 18, -31, 11, 4.5, c2, 0.12); ell(ctx, 26, -29.5, 3.5, 3, '#222', 0.12);
    eye(ctx, 8, -32, 2.4, o.closed, '#4fb3ff');
    line(ctx, -2, -5, -2, 0, '#4fb3ff', 2); line(ctx, 3, -5, 3, 0, '#4fb3ff', 2);
    return { hx: 4, hy: -31, hr: 9 };
  };
  C.hummingbird = (ctx, o) => {
    const { c1, c2 } = o;
    ctx.globalAlpha = 0.5; ell(ctx, -2, -16, 8, 3, c2, -0.9 + Math.sin(o.t * 60) * 0.6); ell(ctx, -2, -16, 8, 3, c2, 0.9 + Math.sin(o.t * 60) * 0.6); ctx.globalAlpha = 1;
    ell(ctx, -7, -8, 3, 5, shade(c1, -30), 0.5);
    ell(ctx, 0, -12, 6, 7, c1); ell(ctx, 1, -10, 3, 4, c2);
    circ(ctx, 4, -19, 4.5, c1);
    line(ctx, 8, -19, 17, -18, '#222', 1.5);
    eye(ctx, 5.5, -20, 1.4, o.closed);
    return { hx: 4, hy: -19, hr: 4.5 };
  };
  C.monkey = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 12) * 4 : 0;
    ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(-22, -16, -20, -30); ctx.quadraticCurveTo(-19, -38, -13, -34); ctx.stroke();
    line(ctx, -6, -8, -7 + sw, 0, c1, 4); line(ctx, 6, -8, 7 - sw, 0, c1, 4);
    ell(ctx, 0, -18, 10, 12, c1); ell(ctx, 1, -15, 6, 8, c2);
    line(ctx, -8, -24, -14 - sw * 0.5, -10, c1, 4); line(ctx, 8, -24, 14 + sw * 0.5, -10, c1, 4);
    circ(ctx, -9, -31, 4.5, c1); circ(ctx, 9, -31, 4.5, c1); circ(ctx, -9, -31, 2.5, c2); circ(ctx, 9, -31, 2.5, c2);
    circ(ctx, 0, -31, 9.5, c1); ell(ctx, 1, -29, 7, 6, c2);
    eye(ctx, -2.5, -32, 2.2, o.closed); eye(ctx, 4, -32, 2.2, o.closed); smile(ctx, 1, -28, 2.5);
    return { hx: 0, hy: -31, hr: 9.5 };
  };
  C.sloth = (ctx, o) => {
    const { c1, c2 } = o;
    line(ctx, -8, -24, -16, -40, c1, 5); line(ctx, 8, -24, 16, -40, c1, 5);
    circ(ctx, -16, -41, 3, '#555'); circ(ctx, 16, -41, 3, '#555');
    ell(ctx, 0, -14, 13, 14, c1); ell(ctx, 0, -11, 8, 9, shade(c1, 25));
    line(ctx, -6, -4, -8, 0, c1, 5); line(ctx, 6, -4, 8, 0, c1, 5);
    circ(ctx, 0, -29, 10, c2);
    ell(ctx, -4, -30, 4.5, 3.5, shade(c1, -40), 0.4); ell(ctx, 4, -30, 4.5, 3.5, shade(c1, -40), -0.4);
    eye(ctx, -4, -30, 1.6, o.closed); eye(ctx, 4, -30, 1.6, o.closed);
    circ(ctx, 0, -25, 1.5, '#333'); smile(ctx, 0, -25, 4);
    return { hx: 0, hy: -29, hr: 10 };
  };
  C.butterfly = (ctx, o) => {
    const { c1, c2 } = o; const f = Math.abs(Math.cos(o.t * 9)) * 0.7 + 0.3;
    ctx.save(); ctx.scale(f, 1);
    ell(ctx, -9, -20, 9, 8, c1, 0.4); ell(ctx, 9, -20, 9, 8, c1, -0.4); ell(ctx, -7, -9, 7, 6, shade(c1, -30), -0.3); ell(ctx, 7, -9, 7, 6, shade(c1, -30), 0.3);
    circ(ctx, -9, -20, 2.5, c2); circ(ctx, 9, -20, 2.5, c2); circ(ctx, -7, -9, 1.5, c2); circ(ctx, 7, -9, 1.5, c2);
    ctx.restore();
    ell(ctx, 0, -14, 2.2, 9, '#222'); circ(ctx, 0, -24, 2.5, '#222');
    line(ctx, -1, -26, -4, -31, '#222', 1); line(ctx, 1, -26, 4, -31, '#222', 1);
    return { hx: 0, hy: -24, hr: 3 };
  };
  C.moth = (ctx, o) => {
    const { c1, c2 } = o; const f = Math.abs(Math.cos(o.t * 7)) * 0.7 + 0.3;
    ctx.save(); ctx.scale(f, 1);
    ell(ctx, -9, -17, 9, 6, c1, 0.2); ell(ctx, 9, -17, 9, 6, c1, -0.2); ell(ctx, -7, -9, 6, 5, shade(c1, -20), -0.2); ell(ctx, 7, -9, 6, 5, shade(c1, -20), 0.2);
    circ(ctx, -9, -17, 3, c2); circ(ctx, 9, -17, 3, c2); circ(ctx, -9, -17, 1.2, '#222'); circ(ctx, 9, -17, 1.2, '#222');
    ctx.restore();
    ell(ctx, 0, -13, 3, 8, shade(c1, -40)); circ(ctx, 0, -22, 3, shade(c1, -40));
    line(ctx, -1, -24, -5, -29, c2, 1.5); line(ctx, 1, -24, 5, -29, c2, 1.5);
    return { hx: 0, hy: -22, hr: 3 };
  };
  C.bee = (ctx, o) => {
    const { c1, c2 } = o;
    ctx.globalAlpha = 0.6; ell(ctx, -2, -15, 6, 3, '#dff', -0.5 + Math.sin(o.t * 50) * 0.3); ell(ctx, 2, -15, 6, 3, '#dff', 0.5 - Math.sin(o.t * 50) * 0.3); ctx.globalAlpha = 1;
    ell(ctx, 0, -9, 8, 5.5, c1);
    rect(ctx, -5, -14, 2.5, 10, c2); rect(ctx, 0, -14, 2.5, 10, c2);
    poly(ctx, [[-8, -9], [-12, -9], [-8, -7]], '#222');
    circ(ctx, 8, -10, 4, c2); eye(ctx, 9, -11, 1.4, o.closed);
    line(ctx, 8, -14, 6, -18, '#222', 1); line(ctx, 10, -14, 12, -18, '#222', 1);
    return { hx: 8, hy: -10, hr: 4 };
  };
  C.capybara = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 10) * 3 : 0;
    rrect(ctx, -14 + sw, -8, 6, 8, 2, shade(c1, -30)); rrect(ctx, 8 - sw, -8, 6, 8, 2, shade(c1, -30));
    rrect(ctx, -19, -28, 38, 22, 10, c1);
    rrect(ctx, -9 - sw, -8, 6, 8, 2, c1); rrect(ctx, 3 + sw, -8, 6, 8, 2, c1);
    rrect(ctx, 10, -34, 20, 16, 7, c1); circ(ctx, 13, -35, 3, c1); circ(ctx, 20, -36, 3, c1);
    rrect(ctx, 24, -27, 7, 5, 2, c2);
    eye(ctx, 18, -29, 2, o.closed);
    return { hx: 20, hy: -27, hr: 8 };
  };
  C.tapir = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 10) * 3 : 0;
    rrect(ctx, -15 + sw, -10, 6, 10, 2, c1); rrect(ctx, 8 - sw, -10, 6, 10, 2, c1);
    ell(ctx, 0, -22, 22, 13, c1); ell(ctx, -8, -22, 13, 12, c2);
    rrect(ctx, -9 - sw, -10, 6, 10, 2, shade(c1, 20)); rrect(ctx, 3 + sw, -10, 6, 10, 2, shade(c1, 20));
    ell(ctx, 17, -30, 10, 8, c1); ell(ctx, 26, -27, 6, 4, c1, 0.4); circ(ctx, 30, -25, 2.5, shade(c1, -20));
    circ(ctx, 14, -38, 3.5, c1); circ(ctx, 14, -38, 1.8, c2);
    eye(ctx, 20, -32, 2, o.closed);
    return { hx: 18, hy: -31, hr: 8 };
  };
  C.elephant = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 8) * 4 : 0;
    rrect(ctx, -22 + sw, -16, 10, 16, 3, shade(c1, -25)); rrect(ctx, 10 - sw, -16, 10, 16, 3, shade(c1, -25));
    ell(ctx, 0, -34, 32, 24, c1);
    rrect(ctx, -14 - sw, -16, 10, 16, 3, c1); rrect(ctx, 2 + sw, -16, 10, 16, 3, c1);
    ell(ctx, 28, -40, 16, 14, c1);
    ell(ctx, 22, -42, 10, 13, shade(c1, -20)); ell(ctx, 22, -42, 7, 10, c2);
    ctx.strokeStyle = c1; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(40, -36);
    if (o.pose === 'drink') ctx.quadraticCurveTo(60, -24, 58, 4 + Math.sin(o.t * 6) * 1.5);       // trunk down in the water
    else if (o.pose === 'spray') ctx.quadraticCurveTo(64, -40, 52 + Math.sin(o.t * 10), -66);     // trunk up, spraying
    else ctx.quadraticCurveTo(50, -20, 44 + sw * 0.5, -6);
    ctx.stroke();
    line(ctx, 38, -32, 46, -28, '#fff', 3);
    eye(ctx, 34, -43, 2.5, o.closed);
    return { hx: 30, hy: -42, hr: 14 };
  };
  C.gorilla = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 9) * 4 : 0;
    rrect(ctx, -16 + sw, -14, 10, 14, 4, c1); rrect(ctx, 6 - sw, -14, 10, 14, 4, c1);
    ell(ctx, 0, -32, 24, 24, c1); ell(ctx, 2, -28, 13, 13, c2);
    line(ctx, -18, -36, -26 - sw * 0.5, -4, c1, 10); line(ctx, 18, -36, 26 + sw * 0.5, -4, c1, 10);
    circ(ctx, -26 - sw * 0.5, -3, 6, shade(c1, 20)); circ(ctx, 26 + sw * 0.5, -3, 6, shade(c1, 20));
    circ(ctx, 4, -54, 14, c1); circ(ctx, -8, -52, 4, c1); circ(ctx, 16, -52, 4, c1);
    ell(ctx, 6, -50, 9, 8, c2); rrect(ctx, -3, -58, 16, 5, 2, c1);
    eye(ctx, 2, -55, 2.2, o.closed); eye(ctx, 10, -55, 2.2, o.closed);
    circ(ctx, 4, -48, 1.3, '#222'); circ(ctx, 8, -48, 1.3, '#222'); smile(ctx, 6, -47, 3);
    return { hx: 4, hy: -54, hr: 14 };
  };
  C.owl = (ctx, o) => {
    const { c1, c2 } = o; const flap = o.moving ? Math.sin(o.t * 15) * 0.5 : 0;
    ell(ctx, 0, -16, 12, 15, c1);
    ell(ctx, -9, -16, 5, 12, shade(c1, -25), -0.25 + flap); ell(ctx, 9, -16, 5, 12, shade(c1, -25), 0.25 - flap);
    ell(ctx, 0, -13, 7, 10, c2);
    for (let i = 0; i < 4; i++) circ(ctx, -3 + (i % 2) * 6, -18 + Math.floor(i / 2) * 6, 1.2, shade(c1, -10));
    circ(ctx, 0, -33, 12, c1);
    poly(ctx, [[-10, -40], [-13, -50], [-4, -43]], c1); poly(ctx, [[10, -40], [13, -50], [4, -43]], c1);
    circ(ctx, -5, -34, 5.5, c2); circ(ctx, 5, -34, 5.5, c2);
    eye(ctx, -5, -34, 4, o.closed, '#f3c04a'); eye(ctx, 5, -34, 4, o.closed, '#f3c04a');
    poly(ctx, [[-2, -30], [2, -30], [0, -26]], '#f3c04a');
    line(ctx, -3, -3, -3, 0, '#f3c04a', 2); line(ctx, 3, -3, 3, 0, '#f3c04a', 2);
    return { hx: 0, hy: -33, hr: 12 };
  };
  C.bear = (ctx, o) => {
    const { c1, c2 } = o; const w = o.moving ? Math.sin(o.t * 8) * 3 : 0, dark = shade(c1, -25);
    rrect(ctx, -18 + w, -13, 8, 14, 3, dark); rrect(ctx, 6 - w, -13, 8, 14, 3, dark);
    ell(ctx, -3, -24, 22, 14, c1);
    rrect(ctx, -10 - w, -13, 8, 14, 3, c1); rrect(ctx, 0 + w, -13, 8, 14, 3, c1);
    circ(ctx, -24, -26, 4, c1);
    circ(ctx, 10, -42, 4.5, c1); circ(ctx, 22, -42, 4.5, c1); circ(ctx, 10, -42, 2.2, c2); circ(ctx, 22, -42, 2.2, c2);
    circ(ctx, 16, -33, 11, c1);
    ell(ctx, 20, -29, 6.5, 4.5, c2); circ(ctx, 23, -31, 2.4, '#222');
    eye(ctx, 12, -35, 2, o.closed); eye(ctx, 19, -35, 2, o.closed);
    return { hx: 16, hy: -33, hr: 11 };
  };
  C.beaver = (ctx, o) => {
    const { c1, c2 } = o; const w = o.moving ? Math.sin(o.t * 9) * 2 : 0;
    ell(ctx, -22, -4, 12, 5, c2, 0.15 + Math.sin(o.t * 3) * 0.1); // flat tail
    line(ctx, -22, -4, -14, -4, c2, 1);
    rrect(ctx, -10 + w, -10, 7, 11, 3, shade(c1, -20)); rrect(ctx, 3 - w, -10, 7, 11, 3, shade(c1, -20));
    ell(ctx, -2, -17, 16, 11, c1);
    circ(ctx, 12, -26, 9, c1); circ(ctx, 8, -34, 3.5, c1); circ(ctx, 16, -34, 3.5, c1);
    ell(ctx, 17, -23, 5, 3.5, shade(c1, 30)); circ(ctx, 20, -25, 2, '#222');
    rect(ctx, 16, -21, 2, 4, '#fff'); rect(ctx, 18.5, -21, 2, 4, '#fff'); // buck teeth
    eye(ctx, 10, -28, 1.8, o.closed); eye(ctx, 15, -28, 1.8, o.closed);
    return { hx: 12, hy: -26, hr: 9 };
  };
  C.panda = (ctx, o) => {
    const { c1, c2 } = o; const w = o.moving ? Math.sin(o.t * 8) * 3 : 0;
    rrect(ctx, -16 + w, -12, 9, 13, 4, c2); rrect(ctx, 7 - w, -12, 9, 13, 4, c2);
    ell(ctx, -2, -24, 20, 15, c1);
    ell(ctx, -2, -31, 15, 6, c2);
    rrect(ctx, -9 - w, -14, 9, 14, 4, c2); rrect(ctx, 0 + w, -14, 9, 14, 4, c2);
    circ(ctx, 9, -43, 5, c2); circ(ctx, 23, -43, 5, c2);
    circ(ctx, 16, -35, 12, c1);
    ell(ctx, 11, -36, 4, 5, c2, 0.3); ell(ctx, 21, -36, 4, 5, c2, -0.3);
    eye(ctx, 11, -36, 2, o.closed); eye(ctx, 21, -36, 2, o.closed);
    circ(ctx, 16, -29, 2.2, c2); smile(ctx, 16, -29, 3.5);
    return { hx: 16, hy: -35, hr: 12 };
  };
  C.bat = (ctx, o) => {
    const { c1, c2 } = o; const f = o.moving ? Math.sin(o.t * 18) * 8 : 4;
    poly(ctx, [[-4, -16], [-16, -22 - f], [-28, -14 - f], [-22, -10], [-16, -14], [-10, -8]], c1);
    poly(ctx, [[4, -16], [16, -22 - f], [28, -14 - f], [22, -10], [16, -14], [10, -8]], c1);
    ell(ctx, 0, -13, 7, 9, c1); ell(ctx, 0, -11, 4, 5, c2);
    circ(ctx, 0, -24, 6.5, c1); poly(ctx, [[-5, -28], [-7, -36], [-1, -30]], c1); poly(ctx, [[5, -28], [7, -36], [1, -30]], c1);
    eye(ctx, -2.5, -25, 1.6, o.closed); eye(ctx, 2.5, -25, 1.6, o.closed);
    poly(ctx, [[-2, -20], [-1, -17], [0, -20]], '#fff'); poly(ctx, [[2, -20], [1, -17], [0, -20]], '#fff');
    return { hx: 0, hy: -24, hr: 6.5 };
  };
  C.jaguar = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 10) * 5 : 0;
    ctx.strokeStyle = c1; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-22, -20); ctx.quadraticCurveTo(-36, -22, -34, -34); ctx.stroke();
    rrect(ctx, -18 + sw, -12, 6, 12, 2, c1); rrect(ctx, 10 - sw, -12, 6, 12, 2, c1);
    ell(ctx, 0, -22, 25, 12, c1);
    rrect(ctx, -12 - sw, -12, 6, 12, 2, shade(c1, 15)); rrect(ctx, 4 + sw, -12, 6, 12, 2, shade(c1, 15));
    for (let i = 0; i < 7; i++) { const sx = -16 + i * 5.5, sy = -27 + ((i % 2) * 7); ctx.strokeStyle = c2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, TAU); ctx.stroke(); }
    circ(ctx, 22, -30, 10, c1); poly(ctx, [[14, -36], [15, -44], [21, -39]], c1); poly(ctx, [[30, -36], [29, -44], [23, -39]], c1);
    ell(ctx, 26, -27, 5, 3.5, shade(c1, 50)); circ(ctx, 29, -29, 1.6, '#222');
    eye(ctx, 20, -32, 2.4, o.closed, '#7bd34a'); eye(ctx, 27, -32, 2.4, o.closed, '#7bd34a');
    return { hx: 22, hy: -30, hr: 10 };
  };
  C.treefrog = (ctx, o) => {
    const { c1, c2 } = o;
    line(ctx, -7, -6, -13, -1, c1, 3); line(ctx, 7, -6, 13, -1, c1, 3); circ(ctx, -13, -1, 2, shade(c1, 40)); circ(ctx, 13, -1, 2, shade(c1, 40));
    ell(ctx, 0, -9, 10, 8, c1); ell(ctx, 0, -6, 6, 4, shade(c1, 60));
    ell(ctx, 1, -17, 9, 6, c1);
    circ(ctx, -4, -22, 4, c1); circ(ctx, 6, -22, 4, c1);
    eye(ctx, -4, -22, 3, o.closed, c2); eye(ctx, 6, -22, 3, o.closed, c2);
    smile(ctx, 1, -17, 4);
    return { hx: 1, hy: -19, hr: 7 };
  };
  C.armadillo = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 12) * 2 : 0;
    rrect(ctx, -12 + sw, -6, 5, 6, 2, c2); rrect(ctx, 6 - sw, -6, 5, 6, 2, c2);
    ctx.beginPath(); ctx.ellipse(0, -8, 20, 14, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
    for (let i = -2; i <= 2; i++) line(ctx, i * 6, -21 + Math.abs(i) * 1.5, i * 6, -8, c2, 1.5);
    line(ctx, -19, -8, -32, -3, c1, 4);
    ell(ctx, 22, -9, 8, 5, c1); circ(ctx, 29, -9, 2, '#333'); poly(ctx, [[16, -13], [15, -19], [20, -14]], c1);
    eye(ctx, 23, -11, 1.5, o.closed);
    return { hx: 22, hy: -11, hr: 6 };
  };
  C.fish = (ctx, o) => {
    const { c1, c2 } = o; const tw = Math.sin(o.t * 8) * 3;
    poly(ctx, [[-12, 0], [-20, -7 + tw], [-20, 7 + tw]], c1);
    ell(ctx, 0, 0, 13, 7.5, c1); ell(ctx, 1, 2, 8, 3.5, c2);
    poly(ctx, [[-2, -6], [2, -13], [6, -6]], c2);
    eye(ctx, 7, -2, 2, o.closed);
    return { hx: 7, hy: -3, hr: 5 };
  };
  C.turtle = (ctx, o) => {
    const { c1, c2 } = o; const sw = o.moving ? Math.sin(o.t * 6) * 3 : 0;
    ell(ctx, -12 + sw, 2, 6, 3, c2, 0.4); ell(ctx, 10 - sw, 2, 6, 3, c2, -0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
    for (let i = -1; i <= 1; i++) circ(ctx, i * 9, -5, 3.5, shade(c1, -30));
    ell(ctx, 20, -2, 7, 5, c2); eye(ctx, 23, -4, 1.6, o.closed); smile(ctx, 22, -1, 2);
    return { hx: 20, hy: -3, hr: 6 };
  };
  // the armadillo curled up: a rolling armoured ball
  C.armadilloBall = (ctx, o) => {
    const { c1, c2 } = o;
    ctx.save(); ctx.translate(0, -13); ctx.rotate(o.moving ? o.rot : 0);
    circ(ctx, 0, 0, 13, c1);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 13, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + 1.1); ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.strokeStyle = c2; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    if (!o.moving && o.peek) { circ(ctx, 9, -8, 4, c1); eye(ctx, 10, -9, 1.4, o.closed); } // peeking out while curled
    ctx.globalAlpha = 0.25; ell(ctx, 0, 1, 12, 3, '#000'); ctx.globalAlpha = 1;
    return { hx: 0, hy: -13, hr: 13 };
  };
  C.crocodile = (ctx, o) => {
    const { c1, c2 } = o; const tw = Math.sin(o.t * 3) * 2;
    poly(ctx, [[-30, 0], [-50, -3 + tw], [-30, 4]], c1);
    const lw = o.moving ? Math.sin(o.t * 8) * 2 : 0;
    rrect(ctx, -22 + lw, 2, 7, 5, 2, shade(c1, -20)); rrect(ctx, 4 - lw, 2, 7, 5, 2, shade(c1, -20));
    ell(ctx, -8, 0, 26, 7, c1);
    for (let i = 0; i < 5; i++) poly(ctx, [[-28 + i * 9, -5], [-25 + i * 9, -10], [-22 + i * 9, -5]], c2);
    rrect(ctx, 14, -4, 26, 8, 4, c1); rrect(ctx, 16, -1, 24, 4, 3, shade(c1, 30));
    for (let i = 0; i < 5; i++) poly(ctx, [[18 + i * 5, 0], [20 + i * 5, 3], [22 + i * 5, 0]], '#fff');
    circ(ctx, 14, -7, 4.5, c1); circ(ctx, 22, -7, 4.5, c1);
    eye(ctx, 14, -8, 2.2, o.closed, '#d4d44a'); eye(ctx, 22, -8, 2.2, o.closed, '#d4d44a');
    return { hx: 18, hy: -8, hr: 7 };
  };
  C.duck = (ctx, o) => {
    const { c1, c2 } = o;
    ell(ctx, 0, -5, 14, 9, c1); ell(ctx, -4, -7, 7, 5, shade(c1, -25), -0.3);
    poly(ctx, [[-12, -8], [-22, -14], [-13, -3]], c1);
    circ(ctx, 11, -19, 8, c1);
    ell(ctx, 20, -17, 6, 3, c2); line(ctx, 15, -17, 25, -17, shade(c2, -40), 1);
    eye(ctx, 13, -21, 2, o.closed);
    return { hx: 11, hy: -19, hr: 8 };
  };
  C.frog = (ctx, o) => {
    const { c1, c2 } = o;
    ell(ctx, -9, -2, 7, 4, c1, -0.3); ell(ctx, 9, -2, 7, 4, c1, 0.3);
    ell(ctx, 0, -9, 12, 9, c1); ell(ctx, 0, -6, 8, 5, c2);
    circ(ctx, -5, -18, 4.5, c1); circ(ctx, 5, -18, 4.5, c1);
    eye(ctx, -5, -18, 3, o.closed); eye(ctx, 5, -18, 3, o.closed);
    smile(ctx, 0, -13, 5);
    return { hx: 0, hy: -16, hr: 8 };
  };
  C.otter = (ctx, o) => {
    const { c1, c2 } = o; const tw = Math.sin(o.t * 5) * 2;
    line(ctx, -18, 0, -32, -4 + tw, c1, 5);
    ell(ctx, 0, 0, 21, 8, c1); ell(ctx, 2, 2, 14, 4, c2);
    line(ctx, 6, -2, 12, -8, c1, 4); line(ctx, -2, -2, -6, -8, c1, 4);
    circ(ctx, 20, -8, 8, c1); circ(ctx, 14, -14, 3, c1); circ(ctx, 24, -15, 3, c1);
    ell(ctx, 24, -6, 5, 3.5, c2); circ(ctx, 27, -8, 1.6, '#222');
    line(ctx, 25, -5, 33, -4, '#fff', 1); line(ctx, 25, -5, 33, -7, '#fff', 1);
    eye(ctx, 20, -10, 2, o.closed);
    return { hx: 20, hy: -9, hr: 8 };
  };

  // Draws an animal at (x,y) (feet / waterline point). Returns head position in world coords.
  function drawCritter(ctx, a, o) {
    const fn = C[a.sp]; if (!fn) return null;
    const face = o.face || 1;
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(face * (o.size || 1), o.size || 1);
    const h = fn(ctx, o);
    ctx.restore();
    const hx = a.x + h.hx * face * (o.size || 1), hy = a.y + h.hy * (o.size || 1), hr = h.hr * (o.size || 1);
    drawAccessory(ctx, a.acc, hx, hy, hr, face);
    return { hx, hy, hr };
  }

  function drawFireflies(ctx, a, t) {
    for (let i = 0; i < 9; i++) {
      const ph = t * (0.6 + seeded(i) * 0.7) + i * 1.3;
      const x = a.x + Math.cos(ph) * (22 + seeded(i + 3) * 26), y = a.y - 30 + Math.sin(ph * 1.3) * (16 + seeded(i + 8) * 14);
      const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + i * 2));
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, `rgba(216,255,90,${glow})`); g.addColorStop(1, 'rgba(216,255,90,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
      circ(ctx, x, y, 1.6, '#f6ffb0');
    }
  }

  function drawZzz(ctx, x, y, t) {
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.33) % 1; ctx.globalAlpha = 1 - ph; ctx.fillText('z', x + 6 + i * 4 + ph * 10, y - 6 - ph * 22 - i * 3); }
    ctx.globalAlpha = 1;
  }

  function drawLabel(ctx, text, x, y) {
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 10;
    ctx.globalAlpha = 0.75; rrect(ctx, x - w / 2, y - 8, w, 16, 8, '#1b2a1d'); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y);
  }

  return { setView, ell, circ, rect, rrect, line, poly, eye, smile, shade, lerpColor, seeded, nightFactor, drawSky, drawStars, drawSunMoon, drawClouds, drawFarJungle, drawGround, drawBush, drawMound, drawCave, drawCliff, drawFalls, drawStick, drawDam, drawLilyPad, drawPlantButton, sunMoonPos, drawSunMoonAt, waterY, drawLakeBasin, drawSeaweed, drawWater, drawWaterFront, plantMetrics, drawPlant, drawWaterSpot, levelScale, star, drawLevelStars, drawAccessory, drawPerson, drawCritter, drawFireflies, drawZzz, drawLabel, drawTent, drawCampGlow, drawBubble };
})();
