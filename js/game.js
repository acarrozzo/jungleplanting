// ===== Jungle Planting: game state, update loop, input and UI =====
(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'junglePlanting.save.v1';
  const SAVE_VERSION = 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nextId = () => Math.random().toString(36).slice(2, 9);
  const ANIMAL_NAMES = ['Kiwi', 'Mango', 'Coco', 'Pip', 'Ziggy', 'Bubbles', 'Peanut', 'Sunny', 'Pickle', 'Biscuit', 'Waffles', 'Nibbles', 'Zazu', 'Mochi', 'Pepper', 'Juju', 'Rocky', 'Daisy', 'Boomer', 'Tiki'];
  const MAX_LEVEL = RULES.upgrade.maxLevel;
  const CLEAR_COST = RULES.slots.clearCost;

  const GY = WORLD.GROUND_Y;
  const TOTAL_SLOTS = WORLD.MAX_SLOTS + WORLD.LAKE_SLOTS.length;
  let S = null;
  // camera: base scale from the screen size, zoom on top, x scroll and a vertical nudge (oy)
  const cam = { x: 0, oy: 0, zoom: 1, base: 1, scale: 1, offY: 0, viewW: 0, targetX: null };
  let W = 0, H = 0, dpr = 1;
  let particles = [], floaters = [], drops = [];
  let rainVis = 0, highlightT = 0, selectedSeed = null, scrollDir = 0;
  let hover = null, focus = null; const mouse = { sx: 0, sy: 0, active: false };
  let saveT = 0, hudT = 0, ambientT = 6, lastFrame = performance.now();
  let sheetOpen = false, sheetDismissable = false;

  const isWaterSlot = i => i >= WORLD.MAX_SLOTS;
  const slotX = i => isWaterSlot(i) ? WORLD.LAKE_SLOTS[i - WORLD.MAX_SLOTS] : WORLD.SLOT_X0 + i * WORLD.SLOT_DX;
  const slotY = i => isWaterSlot(i) ? Draw.waterY(S.lake) : GY;
  const slotOpen = i => isWaterSlot(i) || i < S.slotsOpen;
  const seedFits = (id, i) => (PLANTS[id].kind === 'water') === isWaterSlot(i);
  const dayNum = () => Math.floor(S.t / WORLD.CYCLE) + 1;
  const phase = () => S.t % WORLD.CYCLE;
  const isNight = () => phase() >= WORLD.DAY;
  const activeNow = sp => sp.active === 'both' || ((sp.active === 'night') === isNight());
  const totalSeeds = () => Object.values(S.seeds).reduce((a, b) => a + b, 0);
  const landSeeds = () => S.unlocked.filter(k => PLANTS[k].kind !== 'water').reduce((n, k) => n + (S.seeds[k] || 0), 0);
  const emptyLandSlots = () => { let n = 0; for (let i = 0; i < S.slotsOpen; i++) if (!S.plants[i]) n++; return n; };
  const fruitMax = p => PLANTS[p.id].fruit.max + RULES.upgrade.fruitMaxPerLevel * ((p.level || 1) - 1);
  const fruitInterval = p => PLANTS[p.id].fruit.interval * (1 - RULES.upgrade.fruitSpeedPerLevel * ((p.level || 1) - 1));
  const upgradeCost = p => (p.level || 1) + 1;
  const starText = p => '★'.repeat(p.level || 1) + '☆'.repeat(MAX_LEVEL - (p.level || 1));

  // ---------- state ----------
  function newState() {
    const seeds = {}, unlocked = [];
    for (const k in PLANTS) if (PLANTS[k].starter) { seeds[k] = PLANTS[k].starter; unlocked.push(k); }
    return {
      v: SAVE_VERSION, t: 25, lastDay: 1, lake: 0.5,
      rain: { on: false, left: 0, next: rand(...RULES.rain.firstGap) },
      seeds, unlocked, plants: Array(TOTAL_SLOTS).fill(null),
      people: [], animals: [], queue: [],
      muted: false, started: false, slotsOpen: RULES.slots.start, spawnT: 20, seedlessT: 0, needSeeds: false,
      stats: { planted: 0, seedsGot: 0, grown: 0 }, tips: { controls: true, plants: true },
      sun: { name: 'Sunny', c1: '#ffd84a', c2: '#fff2a8', acc: 'none' }, moon: { name: 'Luna', c1: '#f2f4ff', c2: '#d6dbf0', acc: 'none' },
    };
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be unavailable */ } }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const s = JSON.parse(raw); if (!s || !s.v) return null;
      if (s.v === 1) { s.v = 2; (s.plants || []).forEach(p => { if (p) p.level = 1; }); s.tips = {}; }
      if (s.v !== SAVE_VERSION) return null;
      s.plants = s.plants || []; while (s.plants.length < TOTAL_SLOTS) s.plants.push(null);
      s.animals = (s.animals || []).filter(a => ANIMALS[a.sp]);
      s.people = s.people || []; s.queue = s.queue || []; s.stats = s.stats || { planted: 0, seedsGot: 0, grown: 0 }; s.tips = s.tips || {};
      s.slotsOpen = Math.min(s.slotsOpen || RULES.slots.start, WORLD.MAX_SLOTS);
      s.sun = s.sun || { name: 'Sunny', c1: '#ffd84a', c2: '#fff2a8', acc: 'none' }; s.moon = s.moon || { name: 'Luna', c1: '#f2f4ff', c2: '#d6dbf0', acc: 'none' };
      for (const a of s.animals) { a.anim = a.anim || 0; if (a.state === 'eating') a.state = 'idle'; a.bb = null; }
      for (const p of s.people) { p.anim = 0; p.moving = false; p.planting = false; if (p.task && (p.task.type === 'planting' || p.task.type === 'clearing')) p.task.type = p.task.type === 'planting' ? 'plant' : 'clear'; }
      // any pending seed that lost its planter goes back in the queue
      s.plants.forEach((p, i) => { if (p && p.pending) { const claimed = s.people.some(pe => pe.task && pe.task.slot === i) || s.queue.some(q => q.slot === i); if (!claimed) s.queue.push({ slot: i, id: p.id }); } });
      return s;
    } catch (e) { return null; }
  }

  function stats() {
    const grownBy = {}; let trees = 0, fruitTrees = 0, flowers = 0;
    for (const p of S.plants) {
      if (!p || p.pending || p.progress < 1) continue;
      const d = PLANTS[p.id]; grownBy[p.id] = (grownBy[p.id] || 0) + 1;
      if (d.kind === 'tree') { trees++; if (d.fruit) fruitTrees++; } else if (d.kind === 'flower' || d.kind === 'water') flowers++;
    }
    return { grown: id => grownBy[id] || 0, trees, fruitTrees, flowers, lake: S.lake, present: sp => S.animals.some(a => a.sp === sp && a.state !== 'away') };
  }

  // ---------- camera / canvas ----------
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    // Portrait phones start zoomed in (about 6 planting spots wide); wide screens show more of the jungle.
    cam.base = Math.min(H / WORLD.H, W / 420);
    applyCam();
  }
  function applyCam() {
    cam.scale = cam.base * cam.zoom;
    if (W / cam.scale > WORLD.W) cam.scale = W / WORLD.W;
    cam.viewW = W / cam.scale;
    const anchor = (H > W ? 0.78 : 0.74) + Math.max(0, cam.zoom - 1) * 0.12;
    const base = H * anchor - GY * cam.scale;
    const lo = Math.min(base, H - (GY + 130) * cam.scale), hi = Math.max(base, 0);
    cam.offY = clamp(base + cam.oy, lo, hi); cam.oy = cam.offY - base;
    cam.x = clamp(cam.x, 0, Math.max(0, WORLD.W - cam.viewW));
  }
  function setZoom(z, sx, sy) {
    z = clamp(z, 0.55, 2.4);
    if (sx == null) { sx = W / 2; sy = H / 2; }
    const before = toWorld(sx, sy);
    cam.zoom = z; applyCam();
    cam.x = before.x - sx / cam.scale;
    cam.oy += (sy - before.y * cam.scale) - cam.offY;
    cam.targetX = null; applyCam();
  }
  function worldTransform() { ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, -cam.x * cam.scale * dpr, cam.offY * dpr); }
  function toWorld(sx, sy) { return { x: sx / cam.scale + cam.x, y: (sy - cam.offY) / cam.scale }; }
  function updateCamera(dt) {
    if (scrollDir) { cam.x += scrollDir * cam.viewW * 1.1 * dt; cam.targetX = null; applyCam(); }
    if (cam.targetX != null) { cam.x += (cam.targetX - cam.x) * Math.min(1, dt * 7); if (Math.abs(cam.targetX - cam.x) < 1) { cam.x = cam.targetX; cam.targetX = null; } applyCam(); }
    $('btnLeft').disabled = cam.x <= 0.5; $('btnRight').disabled = cam.x >= WORLD.W - cam.viewW - 0.5;
  }

  // ---------- people ----------
  function makePerson(name, x) {
    return { id: nextId(), name, skin: pick(SKIN_COLORS), shirt: pick(PEOPLE_COLORS), pants: pick(PEOPLE_COLORS), hair: pick(HAIR_COLORS), acc: 'none', x, y: GY, face: 1, task: null, idle: rand(1, 3), anim: 0, moving: false, planting: false };
  }
  function updatePerson(pe, dt, night) {
    pe.anim += dt; pe.moving = false;
    const T = pe.task;
    if (T) {
      if (T.type === 'arrive' || T.type === 'plant' || T.type === 'walk' || T.type === 'clear') {
        const dx = T.tx - pe.x, step = RULES.people.walkSpeed * dt;
        if (Math.abs(dx) <= step) {
          pe.x = T.tx;
          if (T.type === 'arrive') { pe.task = null; onNewcomerArrived(pe); }
          else if (T.type === 'plant') { T.type = 'planting'; T.timer = RULES.people.plantTime; pe.face = slotX(T.slot) > pe.x ? 1 : -1; }
          else if (T.type === 'clear') { T.type = 'clearing'; T.timer = RULES.people.clearTime; pe.face = 1; }
          else { pe.task = null; pe.idle = rand(2, 6); }
        } else { pe.x += Math.sign(dx) * step; pe.face = dx > 0 ? 1 : -1; pe.moving = true; }
      } else if (T.type === 'planting' || T.type === 'clearing') {
        T.timer -= dt; pe.planting = true;
        if (T.timer <= 0) { pe.planting = false; if (T.type === 'planting') doPlant(T.slot, T.id); else doClear(pe); pe.task = null; pe.idle = rand(2, 5); }
      }
    } else if (!night) {
      pe.idle -= dt;
      if (pe.idle <= 0) pe.task = { type: 'walk', tx: rand(40, WORLD.LAKE_X - 60) };
    }
  }
  function assignTasks() {
    while (S.queue.length) {
      const q = S.queue[0];
      const free = S.people.filter(p => !p.task || p.task.type === 'walk');
      if (!free.length) break;
      if (q.clear) {
        const tx = slotX(Math.min(S.slotsOpen, WORLD.MAX_SLOTS - 1)) - 24;
        free.sort((a, b) => Math.abs(a.x - tx) - Math.abs(b.x - tx));
        free[0].task = { type: 'clear', tx };
        toast(`${free[0].name} is off to clear some jungle! 🌿`, 2500);
      } else {
        const tx = isWaterSlot(q.slot) ? WORLD.LAKE_X - 30 : slotX(q.slot);
        free.sort((a, b) => Math.abs(a.x - tx) - Math.abs(b.x - tx));
        const pe = free[0];
        pe.task = { type: 'plant', tx: isWaterSlot(q.slot) ? tx : tx + (tx > pe.x ? -20 : 20), slot: q.slot, id: q.id };
        toast(`${pe.name} is going to plant the ${PLANTS[q.id].name}!`, 2500);
      }
      S.queue.shift();
    }
  }
  function requestPlant(slot, id) {
    if (!S.seeds[id] || S.plants[slot] || !seedFits(id, slot)) return;
    S.seeds[id]--;
    S.plants[slot] = { id, pending: true, progress: 0, fruit: 0, fruitT: 0, level: 1, day: dayNum() };
    S.queue.push({ slot, id });
    Sound.play('pop');
    if (selectedSeed && !S.seeds[selectedSeed]) selectedSeed = null;
    renderSeedBar(); assignTasks(); save();
  }
  function doPlant(slot, id) {
    const p = S.plants[slot]; if (!p || !p.pending) return;
    p.pending = false; S.stats.planted++;
    if (isWaterSlot(slot)) splash(slotX(slot), slotY(slot));
    else { Sound.play('plant'); for (let i = 0; i < 10; i++) particles.push({ x: slotX(slot), y: GY, vx: rand(-40, 40), vy: rand(-90, -30), life: rand(0.4, 0.8), color: '#7a5230', r: rand(1.5, 3) }); }
  }
  function openSlots(n, who) {
    const before = S.slotsOpen;
    S.slotsOpen = Math.min(WORLD.MAX_SLOTS, S.slotsOpen + n);
    for (let i = before; i < S.slotsOpen; i++) { sparkle(slotX(i), GY - 20, '#fff'); for (let k = 0; k < 8; k++) particles.push({ x: slotX(i), y: GY - 10, vx: rand(-60, 60), vy: rand(-120, -40), life: rand(0.5, 1), color: '#2b6b34', r: rand(2, 4) }); }
    return S.slotsOpen - before;
  }
  function doClear(pe) {
    const n = openSlots(1, pe.name);
    Sound.play('sparkle');
    if (n) toast(`🌿 ${pe.name} cleared a new planting spot!`, 3000);
  }
  function onSunrise(d) {
    toast(`☀️ Good morning! It's Day ${d}.`, 4000);
    if (S.people.length < RULES.people.max) {
      const used = S.people.map(p => p.name);
      const pe = makePerson(pick(PERSON_NAMES.filter(n => !used.includes(n))) || 'Friend', -50);
      pe.task = { type: 'arrive', tx: rand(140, 320) };
      S.people.push(pe);
    }
  }
  function onNewcomerArrived(pe) {
    const n = openSlots(RULES.slots.perNewcomer, pe.name);
    Sound.play('fanfare');
    openSheet(buildCustomizer(pe, 'person', { title: `🎉 A new friend arrived on Day ${dayNum()}!`, subtitle: n ? `They cleared ${n} new planting spot${n === 1 ? '' : 's'}. Name them!` : 'Name them and pick a look!', doneLabel: 'Welcome! 👋' }), false);
  }

  // ---------- animals ----------
  function placeOffscreen(a) {
    const sp = ANIMALS[a.sp];
    const left = Math.random() < 0.5;
    switch (sp.kind) {
      case 'bird': case 'bug': case 'climber': a.x = left ? cam.x - 80 : cam.x + cam.viewW + 80; a.y = GY - rand(180, 380); break;
      case 'ground': a.x = -70; a.y = GY; break;
      case 'lake': a.x = rand(WORLD.LAKE_X + 90, WORLD.FALLS_X - 40); a.depth = a.sp === 'fish' ? rand(10, 26) : 2; a.y = Draw.waterY(S.lake) + a.depth; splash(a.x, Draw.waterY(S.lake)); break;
      case 'glow': a.x = rand(100, WORLD.LAKE_X - 100); a.y = GY - 60; break;
    }
  }
  function spawn(key) {
    const sp = ANIMALS[key];
    const n = S.animals.filter(a => a.sp === key).length;
    const a = { id: nextId(), sp: key, name: n === 0 ? sp.name : `${sp.name} ${n + 1}`, c1: sp.c1, c2: sp.c2, acc: 'none', x: 0, y: GY, face: 1, state: 'arriving', tx: 0, ty: 0, timer: 0, giftT: sp.brings.length ? rand(...RULES.animals.welcomeDelay) : 0, welcome: sp.brings.length > 0, slot: -1, anim: Math.random() * 10, named: false, depth: 0 };
    placeOffscreen(a); chooseTarget(a);
    if (sp.kind === 'lake' || sp.kind === 'glow') { a.state = 'idle'; a.timer = rand(3, 8); }
    if (sp.kind === 'glow') { a.x = a.tx; a.y = a.ty; }
    S.animals.push(a);
    Sound.play('chime'); if (sp.sound) setTimeout(() => Sound.play(sp.sound), 450);
    toast(`${sp.name === 'Fireflies' ? '✨ Fireflies have' : 'A ' + sp.name + ' has'} arrived!`, 8000, { big: true, action: { label: 'Name it! ✏️', fn: () => showAnimalSheet(a) } });
    return a;
  }
  function trySpawn() {
    const st = stats(); let spawned = 0;
    for (const key in ANIMALS) {
      const sp = ANIMALS[key];
      const mine = S.animals.filter(a => a.sp === key);
      if (mine.length >= sp.max || mine.some(a => a.state === 'away')) continue;
      if (!activeNow(sp) || !sp.req(st)) continue;
      if (Math.random() < (sp.chance || RULES.animals.spawnChance)) { spawn(key); if (++spawned >= RULES.animals.maxPerCheck) break; }
    }
  }
  function grownPlants() { const out = []; S.plants.forEach((p, i) => { if (p && !p.pending && p.progress >= 1) out.push({ p, i, d: PLANTS[p.id] }); }); return out; }
  function chooseTarget(a) {
    const sp = ANIMALS[a.sp];
    const grown = grownPlants();
    let pool = grown.filter(g => g.d.kind !== 'water');
    if (sp.kind === 'bird' || sp.kind === 'climber') pool = grown.filter(g => g.d.kind === 'tree');
    if (sp.kind === 'bug' || sp.kind === 'glow') pool = grown.filter(g => g.d.kind === 'flower' || g.d.kind === 'water');
    const tasty = pool.filter(g => g.p.fruit > 0 && sp.eats.includes(g.p.id));
    let choice = null;
    if (tasty.length && (a.giftT <= 0 || Math.random() < 0.5)) choice = pick(tasty);
    else if (pool.length) { const others = pool.filter(g => g.i !== a.slot); choice = pick(others.length ? others : pool); }
    if (sp.kind === 'lake') { a.slot = -1; a.tx = rand(WORLD.LAKE_X + 80, WORLD.FALLS_X - 40); if (a.sp === 'fish') a.depth = rand(8, 28); return; }
    if (sp.kind === 'ground') {
      a.ty = GY; a.pad = null;
      if (a.sp === 'frog' && Math.random() < 0.55) {
        const pads = [...WORLD.LILY_PADS, ...grown.filter(g => g.d.kind === 'water').map(g => slotX(g.i))].filter(px => px !== a.pad);
        if (pads.length) { a.slot = -1; a.pad = pick(pads); a.tx = a.pad; a.ty = Draw.waterY(S.lake) - 1; return; }
      }
      if (sp.nearLake && !(choice && tasty.includes(choice) && Math.random() < 0.6)) { a.slot = -1; a.tx = rand(WORLD.LAKE_X - 170, WORLD.LAKE_X - 30); return; }
      if (choice) { a.slot = choice.i; a.tx = slotX(choice.i) + (Math.random() < 0.5 ? -26 : 26); } else { a.slot = -1; a.tx = rand(40, WORLD.LAKE_X - 60); }
      return;
    }
    if (!choice) { a.slot = -1; a.tx = rand(60, WORLD.LAKE_X - 60); a.ty = GY - rand(160, 340); return; }
    a.slot = choice.i;
    const m = Draw.plantMetrics(choice.d, choice.p.progress, choice.p.level), bx = slotX(choice.i), by = slotY(choice.i);
    switch (sp.kind) {
      case 'bird': a.tx = bx + rand(-8, 8); a.ty = by + m.topY + 6; break;
      case 'climber': a.tx = bx + rand(-10, 10); a.ty = a.sp === 'treefrog' ? by - m.H * 0.4 : by + m.canopyY + m.R * 0.5; break;
      case 'bug': a.tx = bx + rand(-10, 10); a.ty = by + m.topY - 12; break;
      case 'glow': a.tx = bx; a.ty = by + m.topY; break;
    }
  }
  function moveToward(a, dt, speed) {
    const sp = ANIMALS[a.sp];
    if (sp.kind === 'lake') {
      const dx = a.tx - a.x, step = speed * dt;
      if (Math.abs(dx) > 1) a.face = dx > 0 ? 1 : -1;
      if (Math.abs(dx) <= step) { a.x = a.tx; return true; }
      a.x += Math.sign(dx) * step; return false;
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy), step = speed * dt;
    if (Math.abs(dx) > 1) a.face = dx > 0 ? 1 : -1;
    if (dist <= step) { a.x = a.tx; a.y = a.ty; return true; }
    a.x += dx / dist * step; a.y += dy / dist * step; return false;
  }
  function updateAnimal(a, dt) {
    const sp = ANIMALS[a.sp]; const active = activeNow(sp);
    a.anim += dt;
    if (sp.kind === 'lake') a.y = Draw.waterY(S.lake) + a.depth + Math.sin(a.anim * 2) * 1.5;
    if (a.pad != null && sp.kind === 'ground') { a.ty = Draw.waterY(S.lake) - 1; if (a.state === 'idle' || a.state === 'eating') a.y = a.ty; }
    // a plant that was replanted under a perched animal: fly off and pick a new spot
    if (a.slot >= 0 && (!S.plants[a.slot] || S.plants[a.slot].pending) && a.state !== 'away' && a.state !== 'leaving') { a.slot = -1; if (a.state !== 'moving') { chooseTarget(a); a.state = 'moving'; } }
    if (a.state === 'away') { if (active) { a.state = 'arriving'; placeOffscreen(a); chooseTarget(a); if (sp.kind === 'glow') { a.state = 'idle'; a.x = a.tx; a.y = a.ty; } } return; }
    if (!active) {
      if (sp.active === 'night') {
        if (sp.kind === 'glow') { a.state = 'away'; return; }
        if (a.state !== 'leaving') { a.state = 'leaving'; a.tx = a.x < WORLD.W / 2 ? -100 : WORLD.W + 100; a.ty = sp.kind === 'ground' ? GY : GY - 320; a.slot = -1; }
        if (moveToward(a, dt, sp.speed * 1.6)) a.state = 'away';
        return;
      }
      if (a.state === 'idle' || a.state === 'eating') { a.state = 'sleep'; return; }
      if (a.state === 'sleep') return;
    } else if (a.state === 'sleep') { a.state = 'idle'; a.timer = rand(1, 4); }

    switch (a.state) {
      case 'arriving': case 'moving': {
        if (moveToward(a, dt, sp.speed)) {
          a.state = 'idle'; a.timer = rand(sp.kind === 'bug' ? 3 : 6, 14);
          if (!active) a.state = 'sleep'; else tryEat(a);
        }
        break;
      }
      case 'idle': {
        a.timer -= dt;
        if (sp.gift && a.giftT > 0) a.giftT -= dt;
        if (sp.gift && a.giftT <= 0) {
          if (a.welcome) { a.welcome = false; giveGift(a, null, true); a.giftT = sp.gift; }
          else if (sp.eats.length === 0) { giveGift(a); a.giftT = sp.gift; }
          else if (tryEat(a)) break;
          else if (!anyFoodPlanted(sp)) { if (Math.random() < RULES.animals.noFoodGiftChance) giveGift(a); a.giftT = sp.gift; }
        }
        if (a.timer <= 0) { chooseTarget(a); a.state = 'moving'; }
        break;
      }
      case 'eating': {
        a.timer -= dt;
        if (a.timer <= 0) {
          const p = S.plants[a.slot];
          if (p && p.fruit > 0) { p.fruit--; Sound.play('munch'); for (let i = 0; i < 6; i++) particles.push({ x: a.x, y: a.y - 20, vx: rand(-30, 30), vy: rand(-60, -10), life: 0.6, color: PLANTS[p.id].fruit.color, r: 2 }); giveGift(a, p); }
          a.giftT = sp.gift; a.state = 'idle'; a.timer = rand(5, 12);
        }
        break;
      }
    }
  }
  function anyFoodPlanted(sp) { return S.plants.some(p => p && !p.pending && p.progress >= 1 && sp.eats.includes(p.id)); }
  function tryEat(a) {
    const sp = ANIMALS[a.sp]; if (a.slot < 0 || a.giftT > 0) return false;
    const p = S.plants[a.slot];
    if (p && !p.pending && p.progress >= 1 && p.fruit > 0 && sp.eats.includes(p.id)) { a.state = 'eating'; a.timer = RULES.animals.eatTime; return true; }
    return false;
  }
  function giveGift(a, fromPlant, sure) {
    const sp = ANIMALS[a.sp]; if (!sp.brings.length) return;
    // upgraded trees make animals more generous; a newly arrived animal always brings a welcome gift
    let chance = (sure || S.needSeeds) ? 1 : (sp.giftChance || RULES.animals.giftChance) + (fromPlant ? RULES.upgrade.giftBonusPerLevel * ((fromPlant.level || 1) - 1) : 0);
    if (Math.random() > chance) return;
    const newOnes = sp.brings.filter(k => !S.unlocked.includes(k));
    const seed = newOnes.length && Math.random() < RULES.animals.newSeedBias ? newOnes[0] : pick(sp.brings);
    addSeed(seed, a.name, a.x, a.y - 30);
  }
  function addSeed(seed, who, x, y) {
    S.seeds[seed] = (S.seeds[seed] || 0) + 1; S.stats.seedsGot++;
    const d = PLANTS[seed];
    if (!S.unlocked.includes(seed)) {
      S.unlocked.push(seed); Sound.play('fanfare');
      toast(`🎉 NEW SEED! ${who} brought you a ${d.name} seed!${d.kind === 'water' ? ' It grows on the floating spots in the lake.' : ''}`, 7000, { big: true });
    } else { Sound.play('seed'); toast(`🌱 ${who} brought you a ${d.name} seed!`, 3500); }
    floaters.push({ x, y, text: d.emoji + ' seed', life: 2 });
    sparkle(x, y, '#ffd21f');
    renderSeedBar(); save();
  }
  function fallbackSeed() {
    const g = grownPlants().filter(x => x.d.fruit && x.d.kind !== 'water');
    if (g.length) { const c = pick(g); addSeed(c.p.id, `The ${c.d.name}`, slotX(c.i), GY - 60); }
    else addSeed('banana', 'The wind', cam.x + cam.viewW / 2, GY - 120);
  }

  // ---------- effects ----------
  function sparkle(x, y, color) { for (let i = 0; i < 12; i++) { const a = rand(0, Math.PI * 2), s = rand(30, 90); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.5, 1), color, r: rand(1.5, 3) }); } }
  function splash(x, y) { Sound.play('splash'); for (let i = 0; i < 10; i++) particles.push({ x: x + rand(-8, 8), y, vx: rand(-40, 40), vy: rand(-120, -50), life: rand(0.4, 0.7), color: '#bfe6ff', r: rand(1.5, 3) }); }
  function updateEffects(dt) {
    for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
    particles = particles.filter(p => p.life > 0);
    for (const f of floaters) { f.life -= dt; f.y -= 25 * dt; }
    floaters = floaters.filter(f => f.life > 0);
    rainVis = clamp(rainVis + (S.rain.on ? dt / 2 : -dt / 2), 0, 1);
    const want = Math.round(140 * rainVis);
    while (drops.length < want) drops.push({ x: rand(0, WORLD.W + 200) - 100, y: rand(-400, GY), v: rand(380, 520) });
    if (drops.length > want) drops.length = want;
    for (const d of drops) { d.y += d.v * dt; d.x -= 40 * dt; if (d.y > GY + (d.x > WORLD.LAKE_X ? 40 : 6)) { d.y = -rand(50, 400); d.x = rand(0, WORLD.W + 200) - 100; } }
  }

  // ---------- update ----------
  function update(dt) {
    S.t += dt;
    const night = isNight();
    const d = dayNum(); if (d > S.lastDay) { S.lastDay = d; onSunrise(d); }

    if (S.rain.on) {
      S.rain.left -= dt; S.lake = Math.min(1, S.lake + RULES.rain.lakeFill * dt);
      if (S.rain.left <= 0) { S.rain.on = false; S.rain.next = rand(...RULES.rain.gap); Sound.setRain(false); toast('🌈 The rain stopped. The lake is fuller!', 4000); }
    } else {
      S.rain.next -= dt; S.lake = Math.max(RULES.rain.lakeFloor, S.lake - RULES.rain.lakeDrain * dt);
      if (S.rain.next <= 0) { S.rain.on = true; S.rain.left = rand(...RULES.rain.length); Sound.setRain(true); toast('🌧️ Rain is coming! Plants grow faster and the lake fills up.', 5000); }
    }

    const rate = (night ? RULES.growth.nightRate : 1) * (S.rain.on ? RULES.growth.rainRate : 1);
    S.plants.forEach((p, i) => {
      if (!p || p.pending) return;
      const def = PLANTS[p.id];
      if (p.progress < 1) {
        p.progress += dt / def.grow * rate;
        if (p.progress >= 1) { p.progress = 1; S.stats.grown++; Sound.play('sparkle'); const m = Draw.plantMetrics(def, 1, p.level); sparkle(slotX(i), slotY(i) + m.topY, '#fff'); toast(`🌟 Your ${def.name} is fully grown!`, 3500); }
      } else if (def.fruit && p.fruit < fruitMax(p)) {
        p.fruitT += dt * (S.rain.on ? RULES.growth.fruitRainRate : 1);
        if (p.fruitT >= fruitInterval(p)) { p.fruitT = 0; p.fruit++; }
      }
    });

    assignTasks();
    for (const pe of S.people) updatePerson(pe, dt, night);
    S.spawnT -= dt; if (S.spawnT <= 0) { S.spawnT = RULES.animals.spawnEvery; trySpawn(); }
    for (const a of S.animals) updateAnimal(a, dt);

    S.needSeeds = landSeeds() === 0 && emptyLandSlots() > 0;
    if (S.needSeeds) { S.seedlessT += dt; if (S.seedlessT > RULES.seeds.fallbackAfter) { S.seedlessT = 0; fallbackSeed(); } } else S.seedlessT = 0;

    ambientT -= dt;
    if (ambientT <= 0) {
      ambientT = rand(4, 9);
      const here = S.animals.filter(a => a.state !== 'away' && a.state !== 'sleep');
      const noisy = here.filter(a => ANIMALS[a.sp].sound);
      if (noisy.length && Math.random() < 0.7) Sound.play(ANIMALS[pick(noisy).sp].sound);
      else if (!night && Math.random() < 0.4) Sound.play('chirp');
    }
    saveT += dt; if (saveT > RULES.save.every) { saveT = 0; save(); }
  }

  // ---------- draw ----------
  function draw() {
    const t = performance.now() / 1000, ph = phase(), frac = ph / WORLD.CYCLE, night = Draw.nightFactor(frac);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Draw.drawSky(ctx, W, H, frac, rainVis);
    worldTransform();
    Draw.drawStars(ctx, t, night);
    if (isHover('sky')) { const sm = Draw.sunMoonPos(ph); drawGlow({ x: sm.x - 40, y: sm.y - 40, w: 80, h: 80 }, c => Draw.drawSunMoonAt(c, sm.x, sm.y, sm.sun ? S.sun : S.moon, sm.sun, t), t); }
    Draw.drawSunMoon(ctx, ph, t, S.sun, S.moon);
    Draw.drawClouds(ctx, S.t * 0.6, rainVis);
    Draw.drawFarJungle(ctx);
    Draw.drawGround(ctx);
    Draw.drawLakeBasin(ctx);
    Draw.drawCliff(ctx);
    Draw.drawWater(ctx, S.lake, t);
    Draw.drawFalls(ctx, S.lake, t);
    WORLD.LILY_PADS.forEach((px, i) => Draw.drawLilyPad(ctx, px, Draw.waterY(S.lake), t, i));
    for (const a of S.animals) if (ANIMALS[a.sp].kind === 'lake' && a.state !== 'away') { if (isHover('animal', a) && a.bb) drawGlow(a.bb, c => drawAnimal(a, t, c, true), t); drawAnimal(a, t); }
    Draw.drawWaterFront(ctx, S.lake);

    highlightT += 1 / 60;
    const hl = selectedSeed ? (PLANTS[selectedSeed].kind === 'water' ? 'water' : 'land') : null;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const water = isWaterSlot(i);
      if (!slotOpen(i)) { if (isHover('bush', i)) drawGlow(hoverBox(hover), c => Draw.drawBush(c, slotX(i), t), t); Draw.drawBush(ctx, slotX(i), t); continue; }
      const p = S.plants[i], x = slotX(i), y = slotY(i);
      if (isHover(p ? 'plant' : 'empty', i)) drawGlow(hoverBox(hover), c => { if (!p || p.pending) { if (water) Draw.drawWaterSpot(c, x, y, t, 0); else Draw.drawMound(c, x, 0); if (!p) Draw.drawPlantButton(c, x, y, t, false); } else Draw.drawPlant(c, x, y, PLANTS[p.id], p, t, night); }, t);
      if (!p) { if (water) Draw.drawWaterSpot(ctx, x, y, t, 0); else Draw.drawMound(ctx, x, 0); Draw.drawPlantButton(ctx, x, y, t, hl === (water ? 'water' : 'land')); }
      else if (p.pending) { if (water) Draw.drawWaterSpot(ctx, x, y, t, 0); else Draw.drawMound(ctx, x, 0); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(PLANTS[p.id].emoji, x, y - 18); ctx.globalAlpha = 1; }
      else Draw.drawPlant(ctx, x, y, PLANTS[p.id], p, t, night);
    }

    const ents = [];
    for (const pe of S.people) ents.push({ y: pe.y, pe });
    for (const a of S.animals) { const k = ANIMALS[a.sp].kind; if (k !== 'lake' && k !== 'glow' && a.state !== 'away') ents.push({ y: a.y, a }); }
    ents.sort((u, v) => u.y - v.y);
    for (const e of ents) {
      if (e.pe) {
        const pe = e.pe, opts = { t: pe.anim, moving: pe.moving, face: pe.face, planting: pe.planting, closed: isNight() && !pe.task };
        pe.bb = { x: pe.x - 22, y: pe.y - 72, w: 44, h: 76 };
        if (isHover('person', pe)) drawGlow(pe.bb, c => Draw.drawPerson(c, pe.x, pe.y, pe, opts), t);
        Draw.drawPerson(ctx, pe.x, pe.y, pe, opts);
        if (isNight() && !pe.task) Draw.drawZzz(ctx, pe.x + 12, pe.y - 66, t);
        Draw.drawLabel(ctx, pe.name, pe.x, pe.y - 84);
      } else { if (isHover('animal', e.a) && e.a.bb) drawGlow(e.a.bb, c => drawAnimal(e.a, t, c, true), t); drawAnimal(e.a, t); }
    }

    if (hover) drawHover(hover, t);
    drawFocus(t);
    for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1; }
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); Draw.circ(ctx, p.x, p.y, p.r, p.color); }
    ctx.globalAlpha = 1;
    if (rainVis > 0) { ctx.strokeStyle = `rgba(200,230,255,${0.6 * rainVis})`; ctx.lineWidth = 1.5; ctx.beginPath(); for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 12); } ctx.stroke(); }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (night > 0) { ctx.fillStyle = `rgba(10,15,45,${0.45 * night})`; ctx.fillRect(0, 0, W, H); }
    worldTransform();
    for (const a of S.animals) if (ANIMALS[a.sp].kind === 'glow' && a.state !== 'away') { Draw.drawFireflies(ctx, a, t); a.bb = { x: a.x - 50, y: a.y - 60, w: 100, h: 70 }; }
  }
  // c = context to draw on (the glow pass uses an offscreen one); plain = critter only, no tag or Zzz
  function drawAnimal(a, t, c = ctx, plain = false) {
    const sp = ANIMALS[a.sp];
    const moving = a.state === 'moving' || a.state === 'arriving' || a.state === 'leaving';
    let y = a.y;
    if (moving && (sp.kind === 'bird' || sp.kind === 'bug')) y += Math.sin(a.anim * 6) * 3;
    if (!moving && sp.kind === 'bug' && a.state !== 'sleep') y += Math.sin(a.anim * 8) * 2;
    if (a.state === 'eating') y += Math.abs(Math.sin(a.anim * 10)) * -2;
    if (moving && a.sp === 'frog') y -= Math.abs(Math.sin(a.anim * 7)) * 14;
    const head = Draw.drawCritter(c, { x: a.x, y, sp: a.sp, acc: a.acc }, { c1: a.c1, c2: a.c2, t: a.anim, moving, closed: a.state === 'sleep', face: a.face, size: 1 });
    if (plain) return;
    if (head) {
      if (a.state === 'sleep') Draw.drawZzz(c, head.hx + head.hr, head.hy - head.hr, t);
      if (a.named) Draw.drawLabel(c, a.name, a.x, Math.min(head.hy - head.hr - 12, y - 46));
    }
    a.bb = { x: a.x - 36, y: y - 62, w: 72, h: 70 };
  }
  const isHover = (type, key) => !!hover && hover.type === type && (type === 'animal' ? hover.a === key : type === 'person' ? hover.pe === key : hover.i === key);
  // Soft glow that hugs the real shape: draw the thing onto an offscreen canvas, then paint only that image's blurred shadow underneath it.
  const glowCanvas = document.createElement('canvas'), gctx = glowCanvas.getContext('2d');
  function drawGlow(bb, fn, t) {
    const pad = 30, sc = cam.scale * dpr;
    const w = Math.ceil((bb.w + pad * 2) * sc), h = Math.ceil((bb.h + pad * 2) * sc);
    if (w < 1 || h < 1 || w > 4096 || h > 4096) return;
    if (glowCanvas.width !== w || glowCanvas.height !== h) { glowCanvas.width = w; glowCanvas.height = h; }
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, w, h);
    gctx.setTransform(sc, 0, 0, sc, (pad - bb.x) * sc, (pad - bb.y) * sc);
    fn(gctx);
    const sx = (bb.x - pad - cam.x) * cam.scale * dpr, sy = (bb.y - pad) * cam.scale * dpr + cam.offY * dpr;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5), far = w + 2000;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = 'rgba(255, 244, 160, 0.95)'; ctx.shadowBlur = (9 + 7 * pulse) * dpr; ctx.shadowOffsetX = far; ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) ctx.drawImage(glowCanvas, sx - far, sy); // image lands off-canvas, only its glow shows
    ctx.restore();
  }

  // ---------- input: drag to scroll, pinch to zoom, tap ----------
  const pointers = new Map();
  let ptr = null, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    Sound.init(); Sound.resume();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinch = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom0: cam.zoom, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
      ptr = null; return;
    }
    ptr = { x: e.clientX, y: e.clientY, cx: cam.x, oy: cam.oy, moved: false, id: e.pointerId };
    cam.targetX = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.active = true; }
    const rec = pointers.get(e.pointerId); if (rec) { rec.x = e.clientX; rec.y = e.clientY; }
    if (pinch && pointers.size >= 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      setZoom(pinch.zoom0 * d / pinch.d0, mx, my);
      cam.x -= (mx - pinch.mx) / cam.scale; cam.oy += my - pinch.my; pinch.mx = mx; pinch.my = my; applyCam();
      return;
    }
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) ptr.moved = true;
    if (ptr.moved) { cam.x = ptr.cx - dx / cam.scale; cam.oy = ptr.oy + dy; applyCam(); }
  });
  function pointerEnd(e) {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.moved && e.type === 'pointerup') onTap(e.clientX, e.clientY);
    ptr = null;
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', e => { e.preventDefault(); Sound.init(); setZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY); }, { passive: false });

  // on-screen buttons: hold to keep scrolling, tap to hop half a screen
  function holdScroll(btn, dir) {
    let downAt = 0;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); Sound.resume(); downAt = performance.now(); scrollDir = dir; try { btn.setPointerCapture(e.pointerId); } catch (err) {} });
    const end = () => { if (!scrollDir) return; const held = performance.now() - downAt; scrollDir = 0; if (held < 220) { cam.targetX = clamp(cam.x + dir * cam.viewW * 0.5, 0, Math.max(0, WORLD.W - cam.viewW)); Sound.play('click'); } };
    btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end); btn.addEventListener('lostpointercapture', end);
  }
  holdScroll($('btnLeft'), -1); holdScroll($('btnRight'), 1);
  $('btnZoomIn').onclick = () => { Sound.init(); Sound.play('click'); setZoom(cam.zoom * 1.3); };
  $('btnZoomOut').onclick = () => { Sound.init(); Sound.play('click'); setZoom(cam.zoom / 1.3); };

  function hitTest(x, y) {
    const inBB = bb => bb && x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h;
    const half = i => isWaterSlot(i) ? 36 : WORLD.SLOT_DX / 2;
    const near = (i, by) => Math.abs(x - slotX(i)) <= half(i) && y > by - 70 && y < by + 44;
    // with a seed picked, an empty spot wins over an animal swimming or standing on it
    if (selectedSeed && S.seeds[selectedSeed]) {
      for (let i = 0; i < TOTAL_SLOTS; i++) if (slotOpen(i) && !S.plants[i] && seedFits(selectedSeed, i) && near(i, slotY(i))) return { type: 'empty', i };
    }
    // overlapping animals and people: the one whose middle is closest to the pointer wins
    const cands = [];
    for (const a of S.animals) if (a.state !== 'away' && inBB(a.bb)) cands.push({ type: 'animal', a, bb: a.bb, d: Math.hypot(a.bb.x + a.bb.w / 2 - x, a.bb.y + a.bb.h / 2 - y) });
    for (const pe of S.people) if (inBB(pe.bb)) cands.push({ type: 'person', pe, bb: pe.bb, d: Math.hypot(pe.x - x, pe.bb.y + pe.bb.h / 2 - y) });
    if (cands.length) return cands.sort((u, v) => u.d - v.d)[0];
    const sm = Draw.sunMoonPos(phase());
    if (Math.hypot(x - sm.x, y - sm.y) <= 48) return { type: 'sky', sun: sm.sun, body: sm.sun ? S.sun : S.moon, bb: { x: sm.x - 40, y: sm.y - 40, w: 80, h: 80 } };
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (Math.abs(x - slotX(i)) > half(i)) continue;
      const by = slotY(i);
      if (!slotOpen(i)) return (y > GY - 60 && y < GY + 40) ? { type: 'bush', i } : null;
      const p = S.plants[i];
      if (!p) return near(i, by) ? { type: 'empty', i } : null;
      const m = Draw.plantMetrics(PLANTS[p.id], p.progress, p.level);
      return (y > by + m.topY - 16 && y < by + 40) ? { type: 'plant', i, p, m } : null;
    }
    if (x > WORLD.LAKE_X - 20 && y > GY - 20 && x < WORLD.FALLS_X) return { type: 'lake' };
    if (x >= WORLD.FALLS_X && y > GY - 190) return { type: 'falls' };
    return null;
  }
  function onTap(sx, sy) {
    if (!S.started || sheetOpen) return;
    const { x, y } = toWorld(sx, sy);
    const h = hitTest(x, y); if (!h) return;
    if (h.type !== 'lake') Sound.play('click');
    switch (h.type) {
      case 'animal': showAnimalSheet(h.a); break;
      case 'person': openSheet(buildCustomizer(h.pe, 'person', { title: `✏️ ${h.pe.name}`, subtitle: 'Change their name or look.' }), true); break;
      case 'bush': showClearSheet(); break;
      case 'empty': if (selectedSeed && S.seeds[selectedSeed] && seedFits(selectedSeed, h.i)) requestPlant(h.i, selectedSeed); else showSeedSheet(h.i); break;
      case 'plant': if (h.p.pending) toast(`${PLANTS[h.p.id].emoji} A ${PLANTS[h.p.id].name} seed is about to be planted.`); else showPlantSheet(h.i); break;
      case 'sky': showSkySheet(h.sun); break;
      case 'lake': toast(`💧 The lake is ${Math.round(S.lake * 100)}% full. Rain fills it up! Water lilies grow on the floating spots.`); break;
      case 'falls': Sound.play('splash'); toast('🌊 The waterfall! Frogs love hopping on the lily pads below it.'); break;
    }
  }
  canvas.addEventListener('pointerleave', () => { mouse.active = false; });

  // ---------- hover highlight (mouse) and "show me" focus ring ----------
  function plantStatus(p) {
    const d = PLANTS[p.id];
    if (p.pending) return 'Waiting for a planter.';
    if (p.progress < 1) return `${Math.round(p.progress * 100)}% grown${S.rain.on ? ' (rain is helping!)' : isNight() ? ' (sleepy at night)' : ''}.`;
    return `Fully grown!${d.fruit ? ` ${p.fruit} of ${fruitMax(p)} ${d.fruit.name}${fruitMax(p) === 1 ? '' : 's'} ready.` : ''}`;
  }
  function hoverLabel(h) {
    switch (h.type) {
      case 'animal': return (h.a.named ? h.a.name : ANIMALS[h.a.sp].name) + (h.a.state === 'sleep' ? ' 💤' : h.a.state === 'eating' ? ' 😋' : '');
      case 'person': return h.pe.name;
      case 'sky': return `${h.sun ? '☀️' : '🌙'} ${h.body.name}`;
      case 'bush': return '🌿 Thick jungle';
      case 'empty': return selectedSeed && S.seeds[selectedSeed] && seedFits(selectedSeed, h.i) ? `Plant ${PLANTS[selectedSeed].name} here!` : isWaterSlot(h.i) ? '🪷 Floating spot' : '🌱 Dirt spot';
      case 'plant': { const d = PLANTS[h.p.id], stars = ' ' + starText(h.p); return h.p.pending ? `${d.emoji} ${d.name} · planting…` : h.p.progress < 1 ? `${d.emoji} ${d.name}${stars} · ${Math.round(h.p.progress * 100)}%` : `${d.emoji} ${d.name}${stars}${d.fruit ? ` · ${h.p.fruit} ${d.fruit.name}${h.p.fruit === 1 ? '' : 's'}` : ' · grown'}`; }
    }
    return '';
  }
  function hoverBox(h) {
    if (h.bb) return h.bb;
    const x = slotX(h.i), by = slotY(h.i);
    if (h.type === 'plant') { const r = Math.max(24, h.m.R + 10); return { x: x - r, y: by + h.m.topY - 10, w: r * 2, h: -h.m.topY + 20 }; }
    if (h.type === 'bush') return { x: x - 28, y: GY - 48, w: 56, h: 58 };
    return { x: x - 26, y: by - 40, w: 52, h: 50 };
  }
  function drawHover(h, t) {
    if (h.type === 'falls') return;
    // the glow itself is painted under the entity while it is drawn; this adds a name tag where there is none
    if (h.type === 'lake' || h.type === 'person' || (h.type === 'animal' && h.a.named)) return;
    const bb = hoverBox(h);
    if (h.type === 'sky') { Draw.drawLabel(ctx, hoverLabel(h), bb.x + bb.w / 2, bb.y + bb.h + 16); return; }
    Draw.drawLabel(ctx, hoverLabel(h), bb.x + bb.w / 2, bb.y - 14);
  }
  function focusSlot(i) {
    cam.targetX = clamp(slotX(i) - cam.viewW / 2, 0, Math.max(0, WORLD.W - cam.viewW));
    focus = { i, t: 3.5 };
  }
  function drawFocus(t) {
    if (!focus) return;
    focus.t -= 1 / 60;
    const x = slotX(focus.i), by = slotY(focus.i), w = 1 + 0.15 * Math.sin(t * 6);
    ctx.save(); ctx.globalAlpha = Math.min(1, focus.t); ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, by + 3, 34 * w, 12 * w, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 6); Draw.line(ctx, x, by - 150 - 8 * Math.sin(t * 6), x, by - 120, '#ffd21f', 5); Draw.line(ctx, x - 14, by - 136, x, by - 120, '#ffd21f', 5); Draw.line(ctx, x + 14, by - 136, x, by - 120, '#ffd21f', 5);
    ctx.restore(); ctx.globalAlpha = 1;
    if (focus.t <= 0) focus = null;
  }

  // ---------- UI: toasts, hud, seed bar ----------
  function toast(msg, ms = 4000, opts = {}) {
    const box = $('toasts'); const el = document.createElement('div');
    el.className = 'toast' + (opts.big ? ' big' : ''); el.textContent = msg;
    if (opts.action) { const b = document.createElement('button'); b.textContent = opts.action.label; b.onclick = e => { e.stopPropagation(); el.remove(); opts.action.fn(); }; el.appendChild(b); }
    box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }
  function updateHud() {
    $('dayLabel').textContent = 'Day ' + dayNum();
    $('clockBar').style.width = (phase() / WORLD.CYCLE * 100) + '%';
    $('weather').textContent = S.rain.on ? '🌧️' : (isNight() ? '🌙' : '☀️');
    $('lakeLabel').textContent = '💧 ' + Math.round(S.lake * 100) + '%';
    $('btnSound').textContent = S.muted ? '🔇' : '🔊';
  }
  function renderSeedBar() {
    const bar = $('seedbar'); bar.innerHTML = '';
    const land = S.unlocked.filter(k => PLANTS[k].kind !== 'water'), water = S.unlocked.filter(k => PLANTS[k].kind === 'water');
    const addChip = k => {
      const d = PLANTS[k], n = S.seeds[k] || 0;
      const chip = document.createElement('button');
      chip.className = 'chip' + (selectedSeed === k ? ' sel' : '') + (n ? '' : ' empty');
      chip.innerHTML = `<span class="em">${d.emoji}</span><span class="n">${n}</span>`; chip.title = d.name;
      chip.onclick = () => {
        Sound.init(); Sound.resume(); Sound.play('click');
        if (!n) { toast(`No ${d.name} seeds right now. Animals bring more!`); return; }
        selectedSeed = selectedSeed === k ? null : k; renderSeedBar();
        if (selectedSeed) toast(d.kind === 'water' ? `${d.emoji} ${d.name} picked! Tap a floating spot in the lake to plant it.` : `${d.emoji} ${d.name} picked! Tap a dirt spot to plant it.`, 3000);
      };
      bar.appendChild(chip);
    };
    const group = (label, keys) => { const g = el('div', 'seedgroup'); g.appendChild(el('span', 'grouplbl', label)); bar.appendChild(g); keys.forEach(addChip); };
    if (water.length) { group('🌱 land', land); group('💧 lake', water); } else land.forEach(addChip);
  }

  // ---------- UI: sheets ----------
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function openSheet(card, dismissable) { const c = $('sheetCard'); c.innerHTML = ''; c.appendChild(card); c.classList.toggle('wide', !!card.dataset.wide); $('sheet').classList.remove('hidden'); sheetOpen = true; sheetDismissable = !!dismissable; scrollDir = 0; }
  function closeSheet() { $('sheet').classList.add('hidden'); sheetOpen = false; lastFrame = performance.now(); save(); }
  $('sheet').addEventListener('pointerdown', e => { if (e.target === $('sheet') && sheetDismissable) closeSheet(); });

  function buildCustomizer(target, type, opts) {
    const card = el('div', 'card compact');
    card.appendChild(el('h2', null, opts.title));
    if (opts.subtitle) card.appendChild(el('p', 'sub', opts.subtitle));
    const body = el('div', 'custbody'), left = el('div', 'custleft'), right = el('div', 'custright');
    const pv = el('canvas', 'preview'); pv.width = 320; pv.height = 260; left.appendChild(pv);
    const inline = el('div', 'inline'); const inp = el('input'); inp.type = 'text'; inp.maxLength = 14; inp.value = target.name; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Name');
    inp.addEventListener('input', () => { if (inp.value.trim()) target.name = inp.value.trim(); });
    const shuffle = el('button', 'small', '🎲'); shuffle.title = 'Random name'; shuffle.onclick = () => { inp.value = pick(type === 'person' ? PERSON_NAMES : ANIMAL_NAMES); target.name = inp.value; Sound.play('click'); };
    inline.append(inp, shuffle); left.appendChild(inline);
    const fields = type === 'person' ? [['skin', 'Skin', SKIN_COLORS], ['shirt', 'Shirt', PEOPLE_COLORS], ['pants', 'Pants', PEOPLE_COLORS], ['hair', 'Hair', HAIR_COLORS]]
      : type === 'sky' ? [['c1', 'Color', SKY_COLORS], ['c2', 'Glow', SKY_COLORS]]
      : [['c1', 'Color', ANIMAL_COLORS], ['c2', 'Accent', ANIMAL_COLORS]];
    for (const [key, label, cols] of fields) {
      const row = el('div', 'optrow'); row.appendChild(el('label', null, label));
      const sw = el('div', 'swatches');
      for (const c of cols) { const b = el('button', 'sw'); b.style.background = c; b.title = label; if (target[key] === c) b.classList.add('sel'); b.onclick = () => { target[key] = c; sw.querySelectorAll('.sw').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.play('click'); redraw(); }; sw.appendChild(b); }
      row.appendChild(sw); right.appendChild(row);
    }
    const arow = el('div', 'optrow'); arow.appendChild(el('label', null, 'Hat'));
    const accs = el('div', 'accs');
    for (const a of ACCESSORIES) { const b = el('button', 'acc', a.emoji); b.title = a.name; if ((target.acc || 'none') === a.id) b.classList.add('sel'); b.onclick = () => { target.acc = a.id; accs.querySelectorAll('.acc').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); Sound.play('click'); redraw(); }; accs.appendChild(b); }
    arow.appendChild(accs); right.appendChild(arow);
    if (opts.extra) right.appendChild(opts.extra);
    body.append(left, right); card.appendChild(body);
    const done = el('button', 'big primary', opts.doneLabel || 'Done ✅');
    done.onclick = () => { if (inp.value.trim()) target.name = inp.value.trim(); Sound.play('chime'); if (opts.onDone) opts.onDone(); closeSheet(); };
    card.appendChild(done);
    function redraw() {
      const c = pv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 320, 260);
      const now = performance.now() / 1000;
      if (type === 'sky') {
        c.fillStyle = opts.sun ? '#8fd0ff' : '#1a2550'; c.fillRect(0, 0, 320, 260);
        c.save(); c.translate(160, 140); c.scale(2.2, 2.2); Draw.drawSunMoonAt(c, 0, 0, target, opts.sun, now); c.restore();
        return;
      }
      c.fillStyle = '#dff3d8'; c.fillRect(0, 0, 320, 260); c.fillStyle = '#6b4a2b'; c.fillRect(0, 215, 320, 45); c.fillStyle = '#3f8f3a'; c.fillRect(0, 215, 320, 12);
      c.save(); c.translate(160, 215); c.scale(2.6, 2.6);
      if (type === 'person') Draw.drawPerson(c, 0, 0, target, { t: 0, face: 1 });
      else { const sp = ANIMALS[target.sp]; if (sp.kind === 'lake') { c.fillStyle = '#3aa0e0'; c.fillRect(-60, 0, 120, 20); } if (sp.kind === 'glow') Draw.drawFireflies(c, { x: 0, y: 10 }, now); else Draw.drawCritter(c, { x: 0, y: 0, sp: target.sp, acc: target.acc }, { c1: target.c1, c2: target.c2, t: now, face: 1, size: 1 }); }
      c.restore();
    }
    redraw();
    const iv = setInterval(() => { if (!document.body.contains(pv)) { clearInterval(iv); return; } redraw(); }, 100);
    return card;
  }
  function showSkySheet(sun) {
    const body = sun ? S.sun : S.moon;
    const extra = el('button', 'big', sun ? '🌙 Call the moon now' : '☀️ Call the sun now');
    extra.onclick = () => { S.t += (sun ? WORLD.DAY : WORLD.CYCLE) - phase(); Sound.play('chime'); toast(sun ? '🌙 Night falls early tonight!' : '☀️ Here comes the sun!', 3500); closeSheet(); };
    openSheet(buildCustomizer(body, 'sky', { title: `${sun ? '☀️' : '🌙'} ${body.name}`, sun, extra }), true);
  }
  function showAnimalSheet(a) {
    const sp = ANIMALS[a.sp];
    openSheet(buildCustomizer(a, 'animal', { title: a.named ? `✏️ ${a.name}` : `🎉 A ${sp.name} is here! Name it!`, subtitle: sp.hint, onDone: () => { a.named = true; } }), true);
  }
  function seedGrid(filterFn, onPick) {
    const grid = el('div', 'seedgrid'); let any = false;
    for (const k of S.unlocked) {
      if (!filterFn(k)) continue; any = true;
      const d = PLANTS[k], n = S.seeds[k] || 0;
      const b = el('button', 'seedbtn' + (n ? '' : ' empty'));
      b.innerHTML = `<div class="em">${d.emoji}</div><div class="nm">${d.name}</div><div class="ct">${n} seed${n === 1 ? '' : 's'}</div>`;
      b.onclick = () => onPick(k, n);
      grid.appendChild(b);
    }
    return any ? grid : null;
  }
  function showSeedSheet(slot) {
    const water = isWaterSlot(slot);
    const card = el('div', 'card'); card.appendChild(el('h2', null, water ? '🪷 Pick a water plant' : '🌱 Pick a seed to plant'));
    const grid = seedGrid(k => seedFits(k, slot), (k, n) => { if (!n) { toast(`No ${PLANTS[k].name} seeds yet. Animals bring more!`); return; } requestPlant(slot, k); closeSheet(); });
    if (grid) card.appendChild(grid);
    if (water && !grid) card.appendChild(el('p', 'sub', 'Only water plants grow here. Turtles, ducks and capybaras bring Water Lily seeds!'));
    else if (!water && !landSeeds()) card.appendChild(el('p', 'sub', 'No seeds left! Animals bring new seeds when they visit your grown trees and flowers.'));
    const c = el('button', 'big', 'Cancel'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function showPlantSheet(i) {
    const p = S.plants[i], d = PLANTS[p.id];
    const card = el('div', 'card');
    const h = el('h2', null, `${d.emoji} ${d.name} `); h.appendChild(el('span', 'levelstars', starText(p))); card.appendChild(h);
    const status = plantStatus(p);
    const fans = Object.values(ANIMALS).filter(a => a.eats.includes(p.id)).map(a => a.name);
    card.appendChild(el('p', 'sub', status + (fans.length ? ` Loved by ${fans.join(', ')}.` : '')));
    const acts = el('div', 'plantactions');
    if (p.progress >= 1 && (p.level || 1) < MAX_LEVEL) {
      const cost = upgradeCost(p), have = S.seeds[p.id] || 0;
      const up = el('button', 'big primary');
      up.innerHTML = `<span>⬆️ Make it bigger! Level ${p.level + 1}</span><small>${cost} ${d.emoji} seeds (you have ${have})</small>`;
      up.disabled = have < cost;
      up.onclick = () => { S.seeds[p.id] -= cost; p.level++; Sound.play('fanfare'); const m = Draw.plantMetrics(d, 1, p.level); sparkle(slotX(i), slotY(i) + m.canopyY, '#ffd21f'); toast(`⬆️ Your ${d.name} grew bigger! ${d.fruit ? 'More fruit and happier animals.' : 'The animals love it.'}`, 4000); renderSeedBar(); closeSheet(); };
      acts.appendChild(up);
    } else if (p.progress >= 1) acts.appendChild(el('p', 'sub', '⭐ This plant is at the top level!'));
    const re = el('button', 'big');
    re.innerHTML = `<span>🔁 Replace with a new seed</span><small>get 1 ${d.emoji} back</small>`;
    re.onclick = () => { S.plants[i] = null; S.seeds[p.id] = (S.seeds[p.id] || 0) + 1; Sound.play('pop'); sparkle(slotX(i), slotY(i) - 30, '#9ad66a'); toast(`🍃 The ${d.name} was moved to the deep jungle. You got 1 seed back.`, 3500); renderSeedBar(); closeSheet(); showSeedSheet(i); };
    acts.appendChild(re);
    card.appendChild(acts);
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function slotName(i) { return isWaterSlot(i) ? `Lake spot ${i - WORLD.MAX_SLOTS + 1}` : `Spot ${i + 1}`; }
  function showPlantsSheet() {
    const card = el('div', 'card'); card.appendChild(el('h2', null, '🌱 My Plants'));
    const list = []; S.plants.forEach((p, i) => { if (p) list.push({ p, i }); });
    const grown = list.filter(x => x.p.progress >= 1).length, growing = list.length - grown;
    const freeLake = WORLD.LAKE_SLOTS.filter((x, k) => !S.plants[WORLD.MAX_SLOTS + k]).length;
    const st = el('div', 'stats');
    st.append(el('div', 'pill', `🌳 ${grown} grown`), el('div', 'pill', `🌿 ${growing} growing`), el('div', 'pill', `🕳️ ${emptyLandSlots()} dirt + ${freeLake} lake spots free`), el('div', 'pill', `🔓 ${S.unlocked.length} of ${Object.keys(PLANTS).length} seed kinds found`));
    card.appendChild(st);
    if (!list.length) card.appendChild(el('p', 'sub', 'Nothing planted yet. Tap a dirt spot to plant your first seed!'));
    else {
      const counts = {}; for (const { p } of list) counts[p.id] = (counts[p.id] || 0) + 1;
      card.appendChild(el('p', 'sub', Object.keys(counts).map(k => `${PLANTS[k].emoji} ×${counts[k]}`).join('   ')));
    }
    const ul = el('div', 'booklist');
    for (const { p, i } of list) {
      const d = PLANTS[p.id], it = el('div', 'bookitem');
      it.appendChild(el('div', 'q', d.emoji));
      const tx = el('div', 'txt');
      const b = el('b', null, d.name + ' '); b.appendChild(el('span', 'levelstars', starText(p))); tx.appendChild(b);
      if (!p.pending && p.progress < 1) { const bar = el('div', 'grow'); const fill = el('div'); fill.style.width = Math.round(p.progress * 100) + '%'; bar.appendChild(fill); tx.appendChild(bar); }
      tx.appendChild(el('span', null, plantStatus(p)));
      tx.appendChild(el('span', null, `${slotName(i)} · Level ${p.level || 1}${p.day ? ` · planted Day ${p.day}` : ''}`));
      it.appendChild(tx);
      const go = el('button', 'small', '👀'); go.title = 'Show me'; go.onclick = () => { Sound.play('click'); closeSheet(); focusSlot(i); };
      const ed = el('button', 'small', '✏️'); ed.title = 'Upgrade or replace'; ed.onclick = () => { Sound.play('click'); if (p.pending) toast(`${d.emoji} The ${d.name} seed is about to be planted.`); else showPlantSheet(i); };
      it.append(go, ed); ul.appendChild(it);
    }
    card.appendChild(ul);
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function showClearSheet() {
    const card = el('div', 'card'); card.appendChild(el('h2', null, '🌿 Thick jungle!'));
    if (S.slotsOpen >= WORLD.MAX_SLOTS) { card.appendChild(el('p', 'sub', 'All the jungle is cleared already!')); }
    else {
      const pendingClears = S.queue.filter(q => q.clear).length + S.people.filter(pe => pe.task && (pe.task.type === 'clear' || pe.task.type === 'clearing')).length;
      card.appendChild(el('p', 'sub', `A new friend clears ${RULES.slots.perNewcomer} spots every sunrise. Or spend ${CLEAR_COST} seeds of one kind to clear a spot right now!`));
      if (pendingClears) card.appendChild(el('p', 'sub', '✅ Someone is already on the way to clear a spot.'));
      const grid = seedGrid(k => PLANTS[k].kind !== 'water' && (S.seeds[k] || 0) >= CLEAR_COST, (k) => { S.seeds[k] -= CLEAR_COST; S.queue.push({ clear: true }); Sound.play('pop'); renderSeedBar(); assignTasks(); closeSheet(); save(); });
      if (grid) card.appendChild(grid); else card.appendChild(el('p', 'sub', `You need ${CLEAR_COST} seeds of the same kind. Let the animals bring more!`));
    }
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function miniCanvas(a) {
    const cv = el('canvas'); cv.width = 112; cv.height = 112; const c = cv.getContext('2d');
    c.fillStyle = '#dff3d8'; c.fillRect(0, 0, 112, 112); c.save(); c.translate(56, 92); c.scale(1.4, 1.4);
    const sp = ANIMALS[a.sp];
    if (sp.kind === 'glow') Draw.drawFireflies(c, { x: 0, y: 20 }, performance.now() / 1000);
    else Draw.drawCritter(c, { x: 0, y: sp.kind === 'lake' ? -10 : 0, sp: a.sp, acc: a.acc }, { c1: a.c1, c2: a.c2, t: 0, face: 1, size: 1 });
    c.restore(); return cv;
  }
  function showBook() {
    const card = el('div', 'card'); card.appendChild(el('h2', null, '📖 Jungle Book'));
    const st = el('div', 'stats');
    st.appendChild(el('div', 'pill', `📅 Day ${dayNum()}`)); st.appendChild(el('div', 'pill', `🌳 ${S.stats.grown} grown`)); st.appendChild(el('div', 'pill', `🌱 ${S.stats.seedsGot} seeds found`)); st.appendChild(el('div', 'pill', `👥 ${S.people.length}/${RULES.people.max} people`));
    card.appendChild(st);
    card.appendChild(el('h3', null, 'Your people'));
    const pl = el('div', 'booklist');
    for (const pe of S.people) { const it = el('div', 'bookitem'); const cv = el('canvas'); cv.width = 112; cv.height = 112; const c = cv.getContext('2d'); c.fillStyle = '#dff3d8'; c.fillRect(0, 0, 112, 112); c.save(); c.translate(56, 100); c.scale(1.4, 1.4); Draw.drawPerson(c, 0, 0, pe, { t: 0, face: 1 }); c.restore(); it.appendChild(cv); const tx = el('div', 'txt'); tx.appendChild(el('b', null, pe.name)); tx.appendChild(el('span', null, pe.task && pe.task.type === 'arrive' ? 'On the way!' : 'Explorer')); it.appendChild(tx); const b = el('button', 'small', '✏️'); b.onclick = () => openSheet(buildCustomizer(pe, 'person', { title: `✏️ ${pe.name}` }), true); it.appendChild(b); pl.appendChild(it); }
    card.appendChild(pl);
    card.appendChild(el('h3', null, `Animals in your jungle (${S.animals.length})`));
    const al = el('div', 'booklist');
    if (!S.animals.length) al.appendChild(el('p', 'sub', 'No animals yet. Grow some trees and flowers!'));
    for (const a of S.animals) { const sp = ANIMALS[a.sp]; const it = el('div', 'bookitem'); it.appendChild(miniCanvas(a)); const tx = el('div', 'txt'); tx.appendChild(el('b', null, a.name)); tx.appendChild(el('span', null, sp.name + (a.state === 'away' ? ' · comes back at night' : a.state === 'sleep' ? ' · sleeping' : ''))); it.appendChild(tx); const b = el('button', 'small', '✏️'); b.onclick = () => showAnimalSheet(a); it.appendChild(b); al.appendChild(it); }
    card.appendChild(al);
    const missing = Object.keys(ANIMALS).filter(k => !S.animals.some(a => a.sp === k));
    card.appendChild(el('h3', null, `Still hiding (${missing.length})`));
    const ml = el('div', 'booklist');
    for (const k of missing) { const sp = ANIMALS[k]; const it = el('div', 'bookitem'); it.appendChild(el('div', 'q', sp.active === 'night' ? '🌙' : '❓')); const tx = el('div', 'txt'); tx.appendChild(el('b', null, '???')); tx.appendChild(el('span', null, sp.hint + (sp.active === 'night' ? ' (night)' : ''))); it.appendChild(tx); ml.appendChild(it); }
    card.appendChild(ml);
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function showMenu() {
    const card = el('div', 'card'); card.appendChild(el('h2', null, '🌴 Jungle Planting'));
    const snd = el('button', 'big', S.muted ? '🔇 Sound is off — turn on' : '🔊 Sound is on — turn off');
    snd.onclick = () => { S.muted = !S.muted; Sound.setMuted(S.muted); snd.textContent = S.muted ? '🔇 Sound is off — turn on' : '🔊 Sound is on — turn off'; updateHud(); save(); };
    card.appendChild(snd);
    const how = el('div', 'howto');
    how.innerHTML = `<ul>
      <li>🌱 <b>Tap a dirt spot</b> and pick a seed. One of your people walks over and plants it.</li>
      <li>🪷 Water lilies grow on the <b>floating spots in the lake</b>.</li>
      <li>☀️ Plants grow in the sun (${Math.round(WORLD.DAY / 60)} minutes of day), slower under the moon (${(WORLD.NIGHT / 60).toFixed(1).replace('.0', '')} minutes of night).</li>
      <li>🌧️ Rain makes plants grow faster and fills the lake.</li>
      <li>🍌 Grown trees make fruit. Animals come to eat it and <b>bring you new seeds</b>!</li>
      <li>⬆️ <b>Tap a grown plant</b> to make it bigger with spare seeds, or swap it for a new seed.</li>
      <li>🌱 The <b>🌱 button</b> lists every plant you own, how grown it is and its level. Tap 👀 to jump to it.</li>
      <li>🌿 <b>Tap the thick jungle</b> to clear a new spot for ${CLEAR_COST} seeds. A new friend also clears ${RULES.slots.perNewcomer} spots every sunrise (up to ${RULES.people.max} friends).</li>
      <li>🦉 Some animals only come out at night. Day animals sleep.</li>
      <li>✏️ <b>Tap any person or animal</b> to name it and give it colors and a hat. The <b>sun and moon</b> too!</li>
      <li>🐸 Frogs hop onto the lily pads under the waterfall.</li>
      <li>👆 Swipe, or use ◀ ▶ to look around and ➕ ➖ to zoom. Pinch works too!</li>
      <li>🖱️ On a computer, point at anything to see what it is before you click.</li>
    </ul>`;
    card.appendChild(how);
    const dev = el('button', 'big', '🔧 Under the hood (for grown-ups)'); dev.onclick = () => { Sound.play('click'); showDevSheet(); }; card.appendChild(dev);
    const reset = el('button', 'big danger', '🗑️ Start a brand new jungle');
    reset.onclick = () => { if (reset.dataset.arm) { localStorage.removeItem(SAVE_KEY); S = newState(); particles = []; floaters = []; selectedSeed = null; Sound.setRain(false); renderSeedBar(); closeSheet(); showWelcome(); } else { reset.dataset.arm = '1'; reset.textContent = '⚠️ Really start over? Tap again to confirm'; } };
    card.appendChild(reset);
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  // ---------- Under the hood: every mechanic, read straight from RULES / PLANTS / ANIMALS ----------
  function showDevSheet() {
    const R = RULES, card = el('div', 'card dev'); card.dataset.wide = '1';
    card.appendChild(el('h2', null, '🔧 Under the hood'));
    card.appendChild(el('p', 'sub', 'Every rule the game runs on. Numbers come live from RULES, PLANTS and ANIMALS in js/data.js, so edit there and this page follows. MECHANICS.md in the project explains the same things in prose.'));
    const sec = (title, items) => { card.appendChild(el('h3', null, title)); const ul = el('ul', 'howto'); for (const i of items) { const li = el('li'); li.innerHTML = i; ul.appendChild(li); } card.appendChild(ul); };
    const rng = a => `${a[0]}–${a[1]}s`, pct = v => Math.round(v * 100) + '%';
    const broughtBy = id => Object.values(ANIMALS).filter(a => a.brings.includes(id)).map(a => a.name).join(', ') || (PLANTS[id].starter ? 'starter' : '—');
    const landW = WORLD.SLOT_X0 + (WORLD.MAX_SLOTS - 1) * WORLD.SLOT_DX;
    sec('🌍 World & time', [
      `World is ${WORLD.W}×${WORLD.H} units, ground at y=${WORLD.GROUND_Y}, lake from x=${WORLD.LAKE_X}, waterfall cliff from x=${WORLD.FALLS_X}. Lily pads at x=${WORLD.LILY_PADS.join(', ')} (frogs hop onto them and onto grown water lilies). ${WORLD.MAX_SLOTS} land spots every ${WORLD.SLOT_DX} units from x=${WORLD.SLOT_X0} to ${landW}, plus ${WORLD.LAKE_SLOTS.length} floating lake spots (water plants only).`,
      `Day ${WORLD.DAY}s + night ${WORLD.NIGHT}s = ${WORLD.CYCLE}s per day. A new jungle starts ${25}s into Day 1. Sunrise = day number changes.`,
      `Camera: base scale fits the ${WORLD.H}-unit height (or 420 units wide on portrait phones), zoom 0.55–2.4×, drag / ◀ ▶ hold or tap (half-screen hop), pinch, wheel.`,
      `Game time only runs while the page is open and no sheet is showing. Nothing grows while the game is closed. Autosave every ${R.save.every}s and when the tab hides (localStorage key <code>${SAVE_KEY}</code>, v${SAVE_VERSION}).`,
    ]);
    sec('🌱 Planting & growth', [
      `Start with ${R.slots.start} open land spots. Each new friend clears +${R.slots.perNewcomer}; tapping thick jungle clears +1 right away for ${R.slots.clearCost} seeds of one kind. Lake spots are always open.`,
      `Tap a spot → seed leaves your pocket at once, the plant is "pending" until the nearest free person walks over (${R.people.walkSpeed} units/s) and plants for ${R.people.plantTime}s (clearing takes ${R.people.clearTime}s). Lake seeds are tossed from the shore.`,
      `Growth per second = 1 / grow-time × ${R.growth.nightRate} at night × ${R.growth.rainRate} in rain. Sprout shows at ${pct(R.growth.sproutAt)}. At 100%: sparkle, toast, counts as grown.`,
      `Grown fruit plants make one fruit every <i>interval</i> seconds (× ${R.growth.fruitRainRate} faster in rain) until <i>max</i>. Animals eat one fruit per visit.`,
      `Upgrade (levels 1–${R.upgrade.maxLevel}): costs level+1 seeds of the same kind (so 2 then 3). Each level: +${pct(R.upgrade.sizePerLevel)} size, +${R.upgrade.fruitMaxPerLevel} max fruit, ${pct(R.upgrade.fruitSpeedPerLevel)} faster fruit, +${pct(R.upgrade.giftBonusPerLevel)} seed chance when eaten from. Stars under the plant show the level.`,
      `Replace: plant removed, 1 seed of its kind refunded, seed picker opens for that spot. Animals perched on it fly off and pick a new spot.`,
    ]);
    sec('🌧️ Rain & lake', [
      `First rain ${rng(R.rain.firstGap)} after a new jungle starts, then every ${rng(R.rain.gap)} after one ends. Each shower lasts ${rng(R.rain.length)}.`,
      `Lake fills ${R.rain.lakeFill}/s while raining (+${pct(R.rain.lakeFill * 45)} in a 45s shower), drains ${R.rain.lakeDrain}/s otherwise, never below ${pct(R.rain.lakeFloor)}. Lake level gates lake animals and lifts the lilies and swimmers.`,
    ]);
    sec('🧑 People', [
      `Start with 1 explorer; one more arrives at each sunrise until ${R.people.max}. Newcomer walks in from the left, clears ${R.slots.perNewcomer} spots and asks for a name and look.`,
      `The sun and moon can be named and dressed up like anyone else; their sheet also has a button that jumps time to the next sunset or sunrise.`,
      `Idle people wander by day and sleep standing at night (they still get up for planting tasks). Queued tasks go to the closest person with nothing to do.`,
    ]);
    sec('🐒 Animals', [
      `Every ${R.animals.spawnEvery}s the game checks each species: not already at its max, right time of day, and its requirement (below) is true → it shows up with ${pct(R.animals.spawnChance)} chance (rare ones have their own chance). At most ${R.animals.maxPerCheck} species arrive per check. Animals never leave for good.`,
      `Kinds: <b>bird</b> perches on tree tops, <b>climber</b> sits in canopies, <b>bug</b> hovers at flowers and lilies, <b>ground</b> walks the land (some stick near the lake), <b>lake</b> swims, <b>glow</b> = fireflies at a flower.`,
      `Day animals fall asleep where they are at night (Zzz). Night animals leave at sunrise and come back at sunset. "Both" animals stay around the clock.`,
      `<b>Welcome gift:</b> every animal that brings seeds hands one over ${rng(R.animals.welcomeDelay)} after settling in, guaranteed.`,
      `After that, each animal has a gift timer (<i>gift</i> column). Non-eaters gift when it runs out. Eaters gift while eating a fruit they like: chance ${pct(R.animals.giftChance)} (+level bonus). If none of an animal's foods is planted anywhere, it gifts on the timer anyway with ${pct(R.animals.noFoodGiftChance)} chance so no seed chain dead-ends.`,
      `A gift is a brand-new kind ${pct(R.animals.newSeedBias)} of the time if the animal knows one you lack, otherwise a random kind from its list. Eating takes ${R.animals.eatTime}s.`,
      `Safety net: with zero land seeds and an empty land spot for ${R.seeds.fallbackAfter}s, a grown fruit plant (or the wind) drops a seed, and every gift is guaranteed until you have one.`,
    ]);
    // plant table
    card.appendChild(el('h3', null, `🌿 Plants (${Object.keys(PLANTS).length})`));
    let html = '<table class="devtable"><tr><th>Plant</th><th>Kind</th><th>Grow</th><th>Height</th><th>Fruit</th><th>Start</th><th>Brought by</th></tr>';
    for (const id in PLANTS) { const d = PLANTS[id]; html += `<tr><td>${d.emoji} ${d.name}<br><small>${id}</small></td><td>${d.kind}</td><td>${d.grow}s</td><td>${d.height}</td><td>${d.fruit ? `${d.fruit.name} every ${d.fruit.interval}s, max ${d.fruit.max}` : '—'}</td><td>${d.starter || ''}</td><td>${broughtBy(id)}</td></tr>`; }
    const pt = el('div'); pt.innerHTML = html + '</table>'; card.appendChild(pt);
    // animal table
    card.appendChild(el('h3', null, `🐾 Animals (${Object.keys(ANIMALS).length})`));
    html = '<table class="devtable"><tr><th>Animal</th><th>Kind</th><th>Active</th><th>Max</th><th>Comes when</th><th>Eats</th><th>Brings</th><th>Gift</th><th>Chance</th></tr>';
    for (const k in ANIMALS) { const a = ANIMALS[k]; const nm = id => PLANTS[id] ? PLANTS[id].emoji : id; html += `<tr><td>${a.name}</td><td>${a.kind}${a.nearLake ? ' (lake)' : ''}</td><td>${a.active}</td><td>${a.max}</td><td>${a.hint}</td><td>${a.eats.map(nm).join(' ') || '—'}</td><td>${a.brings.map(nm).join(' ') || '—'}</td><td>${a.gift ? a.gift + 's' : '—'}</td><td>${a.chance != null ? pct(a.chance) : ''}${a.giftChance != null ? ` gift ${pct(a.giftChance)}` : ''}</td></tr>`; }
    const at = el('div'); at.innerHTML = html + '</table>'; card.appendChild(at);
    sec('🎛️ Console cheats (window.JP)', [
      `<code>JP.skip(sec)</code> fast-forward · <code>JP.give(id, n)</code> seeds · <code>JP.focusSlot(i)</code> scroll to a spot (0–${WORLD.MAX_SLOTS - 1} land, ${WORLD.MAX_SLOTS}–${TOTAL_SLOTS - 1} lake) · <code>JP.state()</code> live save object · <code>JP.hitTest(x, y)</code> what a tap at world x,y would hit · <code>JP.save()</code>`,
    ]);
    const c = el('button', 'big', 'Close'); c.onclick = closeSheet; card.appendChild(c);
    openSheet(card, true);
  }
  function showWelcome() {
    if (!S.people.length) S.people.push(makePerson(pick(PERSON_NAMES), 300));
    const pe = S.people[0];
    openSheet(buildCustomizer(pe, 'person', { title: '🌴 Welcome to Jungle Planting!', subtitle: 'Name your explorer and pick a look!', doneLabel: 'Start planting! 🌱', onDone: () => {
      S.started = true; cam.x = pe.x - cam.viewW / 2; applyCam();
      toast(`Tap a dirt spot to plant your first seed, ${pe.name}!`, 7000, { big: true });
      setTimeout(() => toast('👆 Swipe or use ◀ ▶ to look around. The lake is to the right! ➕ ➖ zoom.', 8000), 2500);
    } }), false);
  }

  $('btnBook').onclick = () => { Sound.init(); Sound.play('click'); showBook(); };
  $('btnPlants').onclick = () => { Sound.init(); Sound.play('click'); showPlantsSheet(); };
  $('btnMenu').onclick = () => { Sound.init(); Sound.play('click'); showMenu(); };
  $('btnSound').onclick = () => { Sound.init(); Sound.resume(); S.muted = !S.muted; Sound.setMuted(S.muted); if (!S.muted) Sound.play('chime'); updateHud(); save(); };

  // ---------- main loop ----------
  function updateHover() {
    const h = (mouse.active && !ptr && !pinch && S.started && !sheetOpen) ? (() => { const w = toWorld(mouse.sx, mouse.sy); return hitTest(w.x, w.y); })() : null;
    hover = h; const cur = h && h.type !== 'lake' && h.type !== 'falls' ? 'pointer' : '';
    if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
    if (S.started && !sheetOpen) update(dt);
    updateEffects(dt); updateCamera(dt); updateHover();
    hudT += dt; if (hudT > 0.25) { hudT = 0; updateHud(); }
    draw();
    requestAnimationFrame(frame);
  }

  function init() {
    S = load() || newState();
    Sound.setMuted(S.muted);
    window.addEventListener('resize', resize); resize();
    cam.x = S.people.length ? S.people[0].x - cam.viewW / 2 : 0; applyCam();
    renderSeedBar(); updateHud();
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else lastFrame = performance.now(); });
    window.addEventListener('pagehide', save);
    if (!S.started) showWelcome();
    else if (!S.tips.controls) { S.tips.controls = true; S.tips.plants = true; setTimeout(() => toast('🆕 New: ◀ ▶ scroll, ➕ ➖ zoom, water lilies in the lake, and tap a grown plant to upgrade it!', 9000, { big: true }), 1000); }
    else if (!S.tips.plants) { S.tips.plants = true; setTimeout(() => toast('🆕 New: the 🌱 button lists all your plants, and lake seeds have their own side of the seed bar!', 8000, { big: true }), 1000); }
    requestAnimationFrame(frame);
  }
  init();
  // Debug helpers (open the browser console): JP.skip(60) fast-forwards 60 seconds of game time.
  window.JP = { state: () => S, cam, focusSlot, hitTest, hover: () => hover, dev: showDevSheet, step: (dt = 1 / 60) => { updateEffects(dt); updateCamera(dt); draw(); }, toScreen: (x, y) => ({ x: (x - cam.x) * cam.scale, y: y * cam.scale + cam.offY }), skip: sec => { for (let i = 0; i < sec * 10; i++) update(0.1); renderSeedBar(); updateHud(); }, save, give: (k, n = 5) => { S.seeds[k] = (S.seeds[k] || 0) + n; if (!S.unlocked.includes(k)) S.unlocked.push(k); renderSeedBar(); } };
})();
