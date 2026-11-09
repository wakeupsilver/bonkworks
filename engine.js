// Core engine: physics world, parts, signals, triggers, effects and rendering.
(function () {
  const { Engine, Composite, Bodies, Body, Constraint, Events, Vector } = Matter;
  const RG = window.RG = window.RG || {};

  // ---------------------------------------------------------------- signals
  // kind: body = travels as a real physical object; field = area effect aimed at linked parts;
  // link = travels along a drawn rope or wire to linked parts.
  RG.SIG = {
    start: { icon: '▶️', label: 'Start', color: '#ffffff', kind: 'start' },
    roll:  { icon: '🎱', label: 'Roll',  color: '#ffb547', kind: 'body', verb: 'something rolling into it' },
    drop:  { icon: '⬇️', label: 'Drop',  color: '#ff8a3d', kind: 'body', verb: 'something dropped on it' },
    push:  { icon: '👉', label: 'Push',  color: '#ff6b6b', kind: 'body', verb: 'a shove' },
    sharp: { icon: '📌', label: 'Sharp', color: '#e0e6f0', kind: 'body', verb: 'something pointy' },
    pour:  { icon: '💧', label: 'Pour',  color: '#4fc3ff', kind: 'body', verb: 'liquid poured into it' },
    fire:  { icon: '🔥', label: 'Fire',  color: '#ff5a1f', kind: 'field', range: 380, verb: 'a flame' },
    wind:  { icon: '💨', label: 'Wind',  color: '#b8f0ff', kind: 'field', range: 480, verb: 'a gust of air' },
    light: { icon: '💡', label: 'Light', color: '#fff27a', kind: 'field', range: 950, verb: 'light shining on it' },
    noise: { icon: '🔊', label: 'Noise', color: '#d6a2ff', kind: 'field', range: 680, verb: 'a loud noise' },
    pull:  { icon: '🪢', label: 'Pull',  color: '#e8c48a', kind: 'link', range: 1600, verb: 'a string yanked' },
    zap:   { icon: '⚡', label: 'Zap',   color: '#7dfcff', kind: 'link', range: 1600, verb: 'electricity' },
  };
  RG.SIG_ORDER = ['roll', 'drop', 'push', 'sharp', 'pour', 'fire', 'wind', 'light', 'noise', 'pull', 'zap'];
  RG.PHYS = new Set(['roll', 'drop', 'push']);

  // Where the next part's input zone goes, relative to this part's output anchor, per signal.
  RG.PLACE = {
    roll: { x: 70, y: 18 }, drop: { x: 0, y: 125 }, push: { x: 34, y: 0 }, sharp: { x: 34, y: -4 },
    pour: { x: 0, y: 120 }, fire: { x: 160, y: 0 }, wind: { x: 240, y: 0 }, light: { x: 280, y: 0 },
    noise: { x: 230, y: 0 }, pull: { x: 210, y: 0 }, zap: { x: 210, y: 0 },
  };

  RG.PARTS = {};
  RG.PART_LIST = [];
  RG.def = function (d) {
    d.inputs = d.inputs || []; d.outputs = d.outputs || [];
    RG.PARTS[d.id] = d; RG.PART_LIST.push(d); return d;
  };

  // ---------------------------------------------------------------- world
  const WORLD = RG.WORLD = { w: 6400, h: 2200 };
  const E = RG.E = {
    engine: null, world: null, parts: [], byId: {}, mode: 'edit', time: 0, slowmo: false,
    assist: true, particles: [], popups: [], rings: [], zones: [], trans: [], timers: [],
    pours: [], shake: 0, lastProgress: 0, runState: null, listeners: {}, sparkles: [],
  };
  // Physics-affecting randomness is seeded and reset with every world, so a machine always plays out
  // exactly the same way: what the tests saw is what you see. (Purely visual sparkle stays random.)
  let seed = 1;
  E.rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  E.reseed = () => { seed = 1234567; };
  RG.on = (ev, fn) => { (E.listeners[ev] = E.listeners[ev] || []).push(fn); };
  RG.fire = (ev, ...a) => (E.listeners[ev] || []).forEach(f => f(...a));

  // ---------------------------------------------------------------- parts
  class Part {
    constructor(spec) {
      this.spec = spec; this.id = spec.id; this.type = spec.type; this.def = RG.PARTS[spec.type];
      this.x = spec.x; this.y = spec.y; this.dir = spec.flip ? -1 : 1; this.angle = spec.angle || 0;
      this.next = spec.next || []; this.bodies = []; this.cons = []; this.s = {};
      this.armed = true; this.fired = false; this.firedAt = 0; this.glow = 0; this.heat = 0; this.windT = 0; this.lightT = 0;
      this.pourSeen = new Set(); this.shakeT = 0;
    }
    toWorld(lx, ly) {
      const X = lx * this.dir, c = Math.cos(this.angle), s = Math.sin(this.angle);
      return { x: this.x + X * c - ly * s, y: this.y + X * s + ly * c };
    }
    vec(lx, ly) { const X = lx * this.dir, c = Math.cos(this.angle), s = Math.sin(this.angle); return { x: X * c - ly * s, y: X * s + ly * c }; }
    wa(a) { return this.angle + a * this.dir; }
    get(k) { const v = this.def[k]; return typeof v === 'function' ? v(this) : v; }
    zoneWorld() {
      if (this.def.zoneWorld) { const w = this.def.zoneWorld(this); if (w) return w; }
      const z = this.get('inZone'); if (!z) return null;
      const pts = [[z.x - z.w / 2, z.y - z.h / 2], [z.x + z.w / 2, z.y - z.h / 2], [z.x + z.w / 2, z.y + z.h / 2], [z.x - z.w / 2, z.y + z.h / 2]].map(([a, b]) => this.toWorld(a, b));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
    outWorld() { const o = this.get('out') || { x: 0, y: 0 }; return this.toWorld(o.x, o.y); }
  }
  RG.Part = Part;

  // ---------------------------------------------------------------- build helpers (B)
  const B = RG.B = {};
  function tagBody(p, body, o) {
    body.rg = {
      part: p, emitter: p, tags: new Set(o.tags || []), fill: o.fill, stroke: o.stroke, emoji: o.emoji, emojiSize: o.emojiSize,
      emojiRot: o.emojiRot || 0, emojiFaceLeft: !!o.faceLeft, kind: o.kind || 'thing', heavy: !!o.heavy, hidden: !!o.hidden,
      draw: o.draw, sound: o.sound, noAssist: !!o.noAssist, liquid: o.liquid, born: E.time, mount: !!o.mount, pokes: 0, still: 0,
      alpha: o.alpha ?? 1, glow: o.glowColor, roll: !!o.roll, rollAngle: 0,
    };
    if (o.collidesNothing) body.collisionFilter = { group: 0, category: 0x0008, mask: 0 };
    if (o.group) body.collisionFilter.group = o.group;
    if (p) p.bodies.push(body);
    Composite.add(E.world, body);
    return body;
  }
  function physOpts(p, o) {
    return {
      isStatic: !!o.static, angle: p ? p.wa(o.angle || 0) : (o.angle || 0), friction: o.friction ?? 0.25, frictionStatic: o.frictionStatic ?? 0.5,
      frictionAir: o.frictionAir ?? 0.008, restitution: o.restitution ?? 0.15, density: o.density ?? 0.002,
      isSensor: !!o.sensor, label: o.label || '', chamfer: o.chamfer ? { radius: o.chamfer } : undefined, slop: 0.02,
    };
  }
  B.rect = (p, lx, ly, w, h, o = {}) => { const c = p.toWorld(lx, ly); return tagBody(p, Bodies.rectangle(c.x, c.y, w, h, physOpts(p, o)), o); };
  B.circle = (p, lx, ly, r, o = {}) => { const c = p.toWorld(lx, ly); return tagBody(p, Bodies.circle(c.x, c.y, r, physOpts(p, o)), o); };
  B.poly = (p, lx, ly, sides, r, o = {}) => { const c = p.toWorld(lx, ly); return tagBody(p, Bodies.polygon(c.x, c.y, sides, r, physOpts(p, o)), o); };
  B.trapezoid = (p, lx, ly, w, h, slope, o = {}) => { const c = p.toWorld(lx, ly); return tagBody(p, Bodies.trapezoid(c.x, c.y, w, h, slope, physOpts(p, o)), o); };
  B.compound = (p, parts, o = {}) => {
    const b = Body.create(Object.assign(physOpts(p, o), { parts, angle: 0 }));
    return tagBody(p, b, o);
  };
  B.rawRect = (p, lx, ly, w, h, o = {}) => { const c = p.toWorld(lx, ly); return Bodies.rectangle(c.x, c.y, w, h, physOpts(p, o)); };
  B.rawCircle = (p, lx, ly, r, o = {}) => { const c = p.toWorld(lx, ly); return Bodies.circle(c.x, c.y, r, physOpts(p, o)); };
  B.pin = (p, a, b, o = {}) => {
    // pin body a (local point la) to world point of part (local pb) or to body b
    const c = Constraint.create(Object.assign({ stiffness: o.stiffness ?? 1, damping: o.damping ?? 0.05, length: o.length }, o.def));
    Object.assign(c, o.raw || {});
    c.rg = { part: p, draw: o.draw, color: o.color, width: o.width };
    p.cons.push(c); Composite.add(E.world, c); return c;
  };
  B.pinTo = (p, body, lx, ly, o = {}) => {
    const w = p.toWorld(lx, ly);
    const c = Constraint.create({ bodyA: body, pointA: o.pointA || { x: 0, y: 0 }, pointB: w, stiffness: o.stiffness ?? 1, damping: 0.05, length: o.length ?? 0 });
    c.rg = { part: p, draw: o.draw ?? 'rope', color: o.color, width: o.width };
    p.cons.push(c); Composite.add(E.world, c); return c;
  };
  B.join = (p, a, b, o = {}) => {
    const c = Constraint.create({ bodyA: a, bodyB: b, pointA: o.pointA || { x: 0, y: 0 }, pointB: o.pointB || { x: 0, y: 0 }, stiffness: o.stiffness ?? 1, damping: 0.05, length: o.length });
    c.rg = { part: p, draw: o.draw ?? 'rope', color: o.color, width: o.width };
    p.cons.push(c); Composite.add(E.world, c); return c;
  };
  B.remove = (p, thing) => {
    if (!thing) return;
    Composite.remove(E.world, thing);
    if (thing.type === 'body') p.bodies = p.bodies.filter(b => b !== thing);
    else p.cons = p.cons.filter(c => c !== thing);
  };
  B.setStatic = (b, v) => Body.setStatic(b, v);
  B.vel = (p, b, vx, vy) => { Body.setVelocity(b, p.vec(vx, vy)); };
  B.spin = (p, b, w) => Body.setAngularVelocity(b, w * p.dir);
  B.move = (p, b, lx, ly) => Body.setPosition(b, p.toWorld(lx, ly));
  B.later = (delay, fn) => E.timers.push({ t: E.time + delay, fn });
  B.sfx = (name, ...a) => !E.silent && window.SFX && SFX.play(name, ...a);
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  B.shake = (amt) => { if (!calm) E.shake = Math.min(26, E.shake + amt); };
  B.popup = (x, y, text, o = {}) => E.popups.push({ x, y, text, color: o.color || '#ffe14d', ink: o.ink || '#2a1033', size: o.size || 34, t: 0, life: o.life || 1.3, rot: (Math.random() - 0.5) * 0.4 });
  B.popAt = (p, lx, ly, text, o) => { const c = p.toWorld(lx, ly); B.popup(c.x, c.y, text, o); };
  B.burst = (x, y, n, o = {}) => {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), sp = (o.speed ?? 5) * (0.4 + Math.random() * 0.8);
      const cols = o.colors || ['#ffe14d', '#ff6b6b', '#5ee7c8', '#7aa8ff', '#ff9ef0'];
      E.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life ?? (0.6 + Math.random() * 0.8), t: 0, type: o.type || 'spark',
        color: cols[(Math.random() * cols.length) | 0], size: o.size ?? (2 + Math.random() * 4), g: o.gravity ?? 0.18, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, text: o.text });
    }
  };
  B.burstAt = (p, lx, ly, n, o = {}) => { const c = p.toWorld(lx, ly); if (o.angle !== undefined) o = Object.assign({}, o, { angle: dirAngle(p, o.angle) }); B.burst(c.x, c.y, n, o); };
  function dirAngle(p, a) { const v = p.vec(Math.cos(a), Math.sin(a)); return Math.atan2(v.y, v.x); }
  B.dirAngle = dirAngle;

  // pour particles (physical liquid blobs)
  const LIQ = {
    water: { color: '#4fc3ff', r: 4.5, density: 0.0012, frictionAir: 0.004, friction: 0.0, restitution: 0.05 },
    honey: { color: '#f5a524', r: 5.5, density: 0.002, frictionAir: 0.09, friction: 0.9, restitution: 0 },
    sand:  { color: '#d9b26f', r: 3.6, density: 0.003, frictionAir: 0.01, friction: 0.8, restitution: 0 },
  };
  B.pour = (p, lx, ly, n, o = {}) => {
    const L = LIQ[o.liquid || 'water'];
    let made = 0;
    const tick = () => {
      if (E.pours.length > 520) { const old = E.pours.shift(); Composite.remove(E.world, old); }
      const base = o.world ? { x: o.world.x + (E.rand() - 0.5) * (o.spread || 6), y: o.world.y } : null;
      const c = base || p.toWorld(lx + (E.rand() - 0.5) * (o.spread || 6), ly + (E.rand() - 0.5) * 4);
      const b = Bodies.circle(c.x, c.y, L.r * (0.8 + E.rand() * 0.4), { density: L.density, frictionAir: L.frictionAir, friction: L.friction, restitution: L.restitution, slop: 0.02 });
      tagBody(null, b, { kind: 'pour', liquid: o.liquid || 'water', fill: L.color, tags: ['pour'] });
      b.rg.part = p; b.rg.emitter = p;
      const v = p.vec(o.vx ?? 0, o.vy ?? 1);
      Body.setVelocity(b, { x: v.x + (E.rand() - 0.5) * (o.jitter ?? 1), y: v.y + (E.rand() - 0.5) * (o.jitter ?? 1) });
      E.pours.push(b);
      made++;
      if (made < n) B.later(o.every ?? 0.03, tick);
    };
    tick();
  };

  // explosion: shove nearby bodies and set off parts that react to a push
  B.blast = (p, x, y, radius, power) => {
    for (const b of Composite.allBodies(E.world)) {
      if (b.isStatic || b.isSensor || !b.rg || b.rg.part === p) continue;
      const dx = b.position.x - x, dy = b.position.y - y, d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const k = power * (1 - d / radius);
      Body.setVelocity(b, { x: b.velocity.x + dx / (d || 1) * k, y: b.velocity.y + dy / (d || 1) * k - k * 0.3 });
      Body.setAngularVelocity(b, (E.rand() - 0.5) * 0.3);
    }
    for (const q of E.parts) {
      if (q === p || !q.armed || !q.def.inputs.some(s => RG.PHYS.has(s))) continue;
      const z = q.zoneWorld(); if (!z) continue;
      if (Math.hypot(z.cx - x, z.cy - y) < radius) B.later(0.05, () => RG.trigger(q, 'push'));
    }
  };

  // ---------------------------------------------------------------- emit (outputs)
  B.emit = (p, sig, o = {}) => {
    p.outFlash = 1;
    const at = o.at ? p.toWorld(o.at.x, o.at.y) : p.outWorld();
    const targets = linkedTargets(p, sig);
    if (sig === 'noise') {
      E.rings.push({ x: at.x, y: at.y, r: 10, max: o.radius || RG.SIG.noise.range, from: p, hit: new Set([p]), speed: 900, color: RG.SIG.noise.color });
    } else if (sig === 'wind') {
      const t = targets[0];
      const tz = t && t.zoneWorld();
      let ang = tz ? Math.atan2(tz.cy - at.y, tz.cx - at.x) : dirAngle(p, o.angle || 0);
      E.zones.push({ type: 'wind', x: at.x, y: at.y, ang, len: o.len || RG.SIG.wind.range, half: 0.32, until: E.time + (o.dur || 3), from: p, strength: o.strength || 1 });
    } else if (sig === 'light') {
      const t = targets[0]; const tz = t && t.zoneWorld();
      let ang = tz ? Math.atan2(tz.cy - at.y, tz.cx - at.x) : dirAngle(p, o.angle || 0);
      const len = tz ? Math.min(RG.SIG.light.range, Math.hypot(tz.cx - at.x, tz.cy - at.y) + 40) : 600;
      E.zones.push({ type: 'light', x: at.x, y: at.y, ang, len, until: E.time + (o.dur || 5), from: p, follow: o.follow });
    } else if (sig === 'fire') {
      E.zones.push({ type: 'fire', x: at.x, y: at.y, r: o.r || 22, until: E.time + (o.dur || 5), from: p, follow: o.follow, fx: o.fx, fy: o.fy });
      for (const t of targets) {
        const tz = t.zoneWorld(); if (!tz) continue;
        const d = Math.hypot(tz.cx - at.x, tz.cy - at.y);
        if (d < 45) continue; // flame already touches it
        if (o.bolt) E.trans.push({ sig: 'bolt', from: p, to: t, ax: at.x, ay: at.y, t0: E.time, dur: 0.35, fizzle: d > RG.SIG.fire.range, then: 'fire' });
        else E.trans.push({ sig, from: p, to: t, ax: at.x, ay: at.y, t0: E.time, dur: d / 230, fizzle: d > RG.SIG.fire.range });
      }
    } else if (sig === 'pull' || sig === 'zap') {
      for (const t of targets) {
        const tz = t.zoneWorld(); if (!tz) continue;
        const d = Math.hypot(tz.cx - at.x, tz.cy - at.y);
        E.trans.push({ sig, from: p, to: t, ax: at.x, ay: at.y, t0: E.time, dur: sig === 'zap' ? 0.12 + d / 1400 : 0.3, fizzle: d > RG.SIG[sig].range });
      }
      if (!targets.length) B.popup(at.x, at.y - 20, sig === 'zap' ? 'bzzt?' : 'yank?', { size: 20, color: '#ccc' });
    }
    RG.fire('emit', p, sig);
  };
  function linkedTargets(p, sig) {
    const ids = (p.next || []).concat(p.autoNext || []);
    return ids.map(id => E.byId[id]).filter(t => t && t.def.inputs.includes(sig));
  }
  RG.linkedTargets = linkedTargets;

  // What a part really produces. Pass-through parts (like the funnel) only put out what flows into them:
  // a marble in means a marble out, never water.
  RG.outputsOf = function (p, depth = 0) {
    const map = p.def.passMap;
    if (!map || depth > 6) return p.def.outputs;
    const ins = new Set();
    for (const q of E.parts) {
      if (!(q.next || []).includes(p.id)) continue;
      for (const s of RG.outputsOf(q, depth + 1)) if (p.def.inputs.includes(s)) ins.add(s);
    }
    if (!ins.size) return p.def.outputs;
    const out = new Set(); ins.forEach(s => (map[s] || []).forEach(o => out.add(o)));
    return p.def.outputs.filter(s => out.has(s));
  };

  // ---------------------------------------------------------------- trigger
  RG.trigger = function (p, via, body) {
    if (!p || E.mode !== 'run') return;
    if (p.def.passthrough && body && RG.PHYS.has(via)) { body.rg.emitter = p; }
    if (!p.armed) return;
    if (p.def.passthrough) { if (p.fired) return; }
    else p.armed = false;
    p.fired = true; p.firedAt = E.time; p.glow = 1; p.via = via;
    E.lastProgress = E.time;
    try { p.def.trigger && p.def.trigger(p, B, via, body); } catch (e) { console.error(p.type, e); }
    RG.fire('trigger', p, via);
  };

  // ---------------------------------------------------------------- build world
  RG.buildWorld = function (specs, mode) {
    if (E.engine) { Events.off(E.engine); Composite.clear(E.world, false, true); Engine.clear(E.engine); }
    E.engine = Engine.create({ enableSleeping: false });
    E.engine.positionIterations = 8; E.engine.velocityIterations = 6; E.engine.constraintIterations = 3;
    E.world = E.engine.world;
    E.world.gravity.y = 1;
    E.mode = mode || 'edit';
    E.reseed();
    E.time = 0; E.particles = []; E.popups = []; E.rings = []; E.zones = []; E.trans = []; E.timers = []; E.pours = []; E.sparkles = []; E.shake = 0; E.lastBumpShake = -9; E.assists = 0; E.lastMagicPop = -9;
    E.lastProgress = 0; E.runState = null;
    // floor and side walls
    const floor = Bodies.rectangle(WORLD.w / 2, WORLD.h + 40, WORLD.w + 400, 80, { isStatic: true, friction: 0.6 });
    tagBody(null, floor, { fill: '#2b2135', kind: 'floor' });
    tagBody(null, Bodies.rectangle(-40, WORLD.h / 2, 80, WORLD.h * 2, { isStatic: true }), { hidden: true, kind: 'wall' });
    tagBody(null, Bodies.rectangle(WORLD.w + 40, WORLD.h / 2, 80, WORLD.h * 2, { isStatic: true }), { hidden: true, kind: 'wall' });
    E.parts = []; E.byId = {};
    for (const s of specs) addPart(s);
    if (E.mode === 'run') autoLink();
    Events.on(E.engine, 'collisionStart', onCollide);
  };
  function addPart(spec) {
    if (!RG.PARTS[spec.type]) return null;
    const p = new Part(spec);
    E.parts.push(p); E.byId[p.id] = p;
    try { p.def.build(p, B); } catch (e) { console.error('build', spec.type, e); }
    computeBox(p);
    return p;
  }
  RG.addPart = addPart;
  function computeBox(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of p.bodies) { x0 = Math.min(x0, b.bounds.min.x); y0 = Math.min(y0, b.bounds.min.y); x1 = Math.max(x1, b.bounds.max.x); y1 = Math.max(y1, b.bounds.max.y); }
    const extra = p.get('box');
    if (extra) { for (const [a, b] of [[extra.x0, extra.y0], [extra.x1, extra.y1], [extra.x0, extra.y1], [extra.x1, extra.y0]]) { const w = p.toWorld(a, b); x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); } }
    if (!isFinite(x0)) { x0 = p.x - 30; y0 = p.y - 30; x1 = p.x + 30; y1 = p.y + 30; }
    p.box = { x0, y0, x1, y1 };
  }
  RG.computeBox = computeBox;
  RG.removePart = function (p) {
    for (const b of p.bodies) Composite.remove(E.world, b);
    for (const c of p.cons) Composite.remove(E.world, c);
    E.parts = E.parts.filter(q => q !== p); delete E.byId[p.id];
  };
  RG.rebuildPart = function (spec) {
    const old = E.byId[spec.id]; const idx = old ? E.parts.indexOf(old) : -1;
    if (old) RG.removePart(old);
    const p = addPart(spec);
    if (p && idx >= 0) { E.parts.splice(E.parts.indexOf(p), 1); E.parts.splice(idx, 0, p); }
    return p;
  };
  // Parts with rope / wire outputs and no explicit link reach for the nearest part that can use them.
  function autoLink() {
    for (const p of E.parts) {
      p.autoNext = [];
      for (const sig of p.def.outputs) {
        if (RG.SIG[sig].kind !== 'link') continue;
        if (linkedTargets(p, sig).length) continue;
        const o = p.outWorld(); let best = null, bd = 520;
        for (const q of E.parts) {
          if (q === p || !q.def.inputs.includes(sig)) continue;
          const z = q.zoneWorld(); if (!z) continue;
          const d = Math.hypot(z.cx - o.x, z.cy - o.y);
          if (d < bd) { bd = d; best = q; }
        }
        if (best) p.autoNext.push(best.id);
      }
    }
  }

  // ---------------------------------------------------------------- collisions → sound + impact triggers
  function onCollide(ev) {
    for (const pair of ev.pairs) {
      const a = pair.bodyA.parent, b = pair.bodyB.parent;
      if (a.isSensor || b.isSensor) continue;
      const rv = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
      if (rv < 2.2) continue;
      const ra = a.rg, rb = b.rg;
      if (!ra || !rb) continue;
      if (ra.kind === 'pour' || rb.kind === 'pour') { if (rv > 4 && Math.random() < 0.08) B.sfx(ra.liquid === 'honey' || rb.liquid === 'honey' ? 'gloop' : 'drip'); continue; }
      const snd = ra.sound || rb.sound || ((a.mass > 6 || b.mass > 6) ? 'thud' : 'tink');
      const v = Math.min(1, rv / 12);
      if (snd === 'clack') B.sfx('clack', 0.9 + Math.random() * 0.4);
      else if (snd === 'thud') B.sfx('thud', v);
      else if (snd === 'tink') B.sfx('tink', v);
      else B.sfx(snd);
      if (rv > 9 && (a.mass > 5 || b.mass > 5) && E.time - (E.lastBumpShake || -9) > 0.3) { E.lastBumpShake = E.time; B.shake(Math.min(6, rv / 3)); }
      const c = pair.collision.supports && pair.collision.supports[0];
      if (c && rv > 5) B.burst(c.x, c.y, 4, { speed: 3, life: 0.35, colors: ['#ffffff', '#ffe9a8'], size: 2.5 });
    }
  }

  // ---------------------------------------------------------------- run
  RG.start = function (specs) {
    RG.buildWorld(specs, 'run');
    const starters = E.parts.filter(p => p.def.inputs.includes('start'));
    starters.forEach((p, i) => B.later(0.35 + i * 0.05, () => RG.trigger(p, 'start')));
    E.runState = { started: E.time, done: false, stalled: false, total: E.parts.length };
    RG.fire('run');
  };

  const STEP = 1000 / 60;
  RG.step = function () {
    // physics always runs at the same rate so results never depend on playback speed;
    // slower playback just steps less often (the UI handles that) and the renderer blends between steps
    const ts = 1;
    E.ts = 1;
    for (const b of Composite.allBodies(E.world)) { if (!b.isStatic) { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; } }
    E.engine.timing.timeScale = ts;
    const dt = (STEP / 1000) * ts;
    preStep(dt);
    Engine.update(E.engine, STEP);
    E.time += dt;
    postStep(dt);
  };

  function inBox(b, z) { return b.bounds.max.x > z.x0 && b.bounds.min.x < z.x1 && b.bounds.max.y > z.y0 && b.bounds.min.y < z.y1; }
  RG.inBox = inBox;

  function preStep(dt) {
    // wind pushes bodies
    for (const z of E.zones) {
      if (z.type !== 'wind' || E.time > z.until) continue;
      const ca = Math.cos(z.ang), sa = Math.sin(z.ang);
      for (const b of Composite.allBodies(E.world)) {
        if (b.isStatic || b.isSensor) continue;
        const dx = b.position.x - z.x, dy = b.position.y - z.y;
        const along = dx * ca + dy * sa; if (along < 0 || along > z.len) continue;
        const perp = Math.abs(-dx * sa + dy * ca); if (perp > along * Math.tan(z.half) + 20) continue;
        const f = 0.0011 * z.strength * (1 - along / z.len * 0.6) * Math.min(b.mass, 4);
        Body.applyForce(b, b.position, { x: ca * f, y: sa * f });
      }
    }
    // assist: gently steer released objects toward the part they are meant to hit
    if (E.assist && E.mode === 'run') {
      for (const b of Composite.allBodies(E.world)) {
        const r = b.rg; if (!r || b.isStatic || r.noAssist || r.kind === 'floor') continue;
        const em = r.emitter; if (!em || !em.fired) continue;
        const t = assistTarget(em); if (!t) continue;
        const z = t.zoneWorld(); if (!z) continue;
        const dx = z.cx - b.position.x, dy = z.cy - b.position.y;
        if (Math.abs(dx) > 900 || dy < -260) continue;
        const toward = Math.sign(dx) * b.velocity.x;
        if (Math.abs(dx) > 8 && toward < 2.6) {
          Body.applyForce(b, b.position, { x: Math.sign(dx) * Math.min(1, Math.abs(dx) / 140) * b.mass * 0.00028 * (r.kind === 'pour' ? 0.6 : 1), y: 0 });
          // steering is magic too: leave a sparkle trail so it's visible
          if (r.kind !== 'pour' && Math.random() < 0.18 && Vector.magnitude(b.velocity) > 0.6) {
            B.burst(b.position.x + (Math.random() - 0.5) * 16, b.position.y + (Math.random() - 0.5) * 16, 1, { type: 'text', text: '✨', speed: 0.4, gravity: -0.01, life: 0.8, size: 12 });
          }
        }
        // stuck rescue
        const sp = Vector.magnitude(b.velocity);
        if (sp < 0.12 && r.kind !== 'pour' && E.time - em.firedAt > 0.8) { r.still += dt; } else r.still = 0;
        if (r.still > 1.1 && r.pokes < 3 && Math.hypot(dx, dy) < 700) {
          r.pokes++; r.still = 0;
          Body.setVelocity(b, { x: Math.sign(dx) * 3.2, y: -3.5 });
          magicAssist(b.position.x, b.position.y, t);
        }
      }
    }
    // safety net: nothing in a contraption should spin like a drill
    for (const b of Composite.allBodies(E.world)) {
      if (!b.isStatic && Math.abs(b.angularVelocity) > 0.6) Body.setAngularVelocity(b, Math.sign(b.angularVelocity) * 0.6);
    }
    // part-specific updates
    for (const p of E.parts) { if (p.def.update) { try { p.def.update(p, B, dt); } catch (e) { console.error(p.type, e); } } }
  }
  function assistTarget(p) {
    for (const id of p.next) {
      const t = E.byId[id];
      if (t && t.armed && !t.fired && t.def.inputs.some(s => RG.SIG[s].kind === 'body' && RG.outputsOf(p).includes(s))) return t;
    }
    return null;
  }

  function postStep(dt) {
    // timers
    if (E.timers.length) {
      const due = E.timers.filter(t => t.t <= E.time);
      E.timers = E.timers.filter(t => t.t > E.time);
      for (const t of due) { try { t.fn(); } catch (e) { console.error(e); } }
    }
    const all = Composite.allBodies(E.world);
    const things = all.filter(b => !b.isStatic && !b.isSensor && b.rg);
    for (const p of E.parts) {
      p.glow = Math.max(0, p.glow - dt * 0.6);
      if (!p.armed) continue;
      const ins = p.def.inputs; if (!ins.length || (ins.length === 1 && ins[0] === 'start')) continue;
      const z = p.zoneWorld(); if (!z) continue;
      if (E.time < 0.25) continue;
      // physical impacts
      if (ins.some(s => RG.PHYS.has(s))) {
        for (const b of things) {
          const r = b.rg; if (r.part === p || r.kind === 'pour') continue;
          if (r.kind === 'debris') continue;
          if (!inBox(b, z)) continue;
          const sp = Vector.magnitude(b.velocity);
          if (sp > (p.def.minSpeed ?? 0.5) || (r.heavy && sp > 0.15)) {
            const via = ins.find(s => RG.PHYS.has(s));
            RG.trigger(p, via, b); break;
          }
        }
      }
      if (!p.armed) continue;
      if (ins.includes('sharp')) {
        for (const b of things) { if (b.rg.part !== p && b.rg.tags.has('sharp') && inBox(b, z)) { RG.trigger(p, 'sharp', b); break; } }
        if (!p.armed) continue;
        for (const s of all) { if (s.isSensor && s.rg && s.rg.tags.has('sharp') && s.rg.part !== p && inBox(s, z)) { RG.trigger(p, 'sharp', s); break; } }
      }
      if (!p.armed) continue;
      if (ins.includes('pour')) {
        for (const b of E.pours) { if (b.rg.part !== p && inBox(b, z)) p.pourSeen.add(b.id); }
        if (p.pourSeen.size >= (p.def.pourNeed || 6)) { RG.trigger(p, 'pour'); continue; }
      }
      // fields
      let inFire = false, inWind = false, inLight = false;
      for (const zn of E.zones) {
        if (E.time > zn.until || zn.from === p) continue;
        if (zn.type === 'fire' && ins.includes('fire')) {
          const fx = zn.x, fy = zn.y;
          if (fx + zn.r > z.x0 && fx - zn.r < z.x1 && fy + zn.r > z.y0 && fy - zn.r < z.y1) inFire = true;
        } else if (zn.type === 'wind' && ins.includes('wind')) {
          const dx = z.cx - zn.x, dy = z.cy - zn.y, ca = Math.cos(zn.ang), sa = Math.sin(zn.ang);
          const along = dx * ca + dy * sa, perp = Math.abs(-dx * sa + dy * ca);
          if (along > 0 && along < zn.len + 30 && perp < along * Math.tan(zn.half) + 40) inWind = true;
        } else if (zn.type === 'light' && ins.includes('light')) {
          if (segBox(zn.x, zn.y, zn.x + Math.cos(zn.ang) * zn.len, zn.y + Math.sin(zn.ang) * zn.len, z)) inLight = true;
        }
      }
      p.heat = inFire ? p.heat + dt : Math.max(0, p.heat - dt * 0.5);
      p.windT = inWind ? p.windT + dt : Math.max(0, p.windT - dt);
      p.lightT = inLight ? p.lightT + dt : Math.max(0, p.lightT - dt);
      if (p.heat > (p.def.burnTime ?? 0.35)) RG.trigger(p, 'fire');
      else if (p.windT > 0.35) RG.trigger(p, 'wind');
      else if (p.lightT > 0.25) RG.trigger(p, 'light');
    }
    // follow-zones
    for (const zn of E.zones) {
      if (zn.follow) { const pos = zn.follow.position; const a = zn.follow.angle; const fx = zn.fx || 0, fy = zn.fy || 0;
        zn.x = pos.x + fx * Math.cos(a) - fy * Math.sin(a); zn.y = pos.y + fx * Math.sin(a) + fy * Math.cos(a); }
    }
    E.zones = E.zones.filter(z => E.time <= z.until + 0.5);
    // noise rings
    for (const r of E.rings) {
      r.r += r.speed * dt;
      for (const p of E.parts) {
        if (r.hit.has(p) || !p.armed || !p.def.inputs.includes('noise')) continue;
        const z = p.zoneWorld(); if (!z) continue;
        const d = Math.hypot(z.cx - r.x, z.cy - r.y);
        if (d < r.r && d < r.max) { r.hit.add(p); p.shakeT = 0.4; RG.trigger(p, 'noise'); }
      }
    }
    E.rings = E.rings.filter(r => r.r < r.max);
    // transmissions along ropes / wires / fuses
    for (const tr of E.trans) {
      const k = (E.time - tr.t0) / tr.dur;
      if (tr.fizzle && k > 0.55 && !tr.done) {
        tr.done = true; const pt = transPoint(tr, 0.55); B.popup(pt.x, pt.y, 'fizzle…', { size: 20, color: '#bbb' }); B.sfx('sad');
      }
      if (k >= 1 && !tr.done) {
        tr.done = true;
        const z = tr.to.zoneWorld();
        if (tr.sig === 'fire' && z) { E.zones.push({ type: 'fire', x: z.cx, y: z.cy, r: 18, until: E.time + 0.8, from: tr.from }); }
        if (tr.sig === 'zap' && z) { B.burst(z.cx, z.cy, 14, { colors: ['#7dfcff', '#ffffff', '#c6a8ff'], speed: 6, life: 0.4 }); B.sfx('zap'); }
        if (tr.sig === 'pull') B.sfx('snap');
        RG.trigger(tr.to, tr.then || tr.sig);
      }
    }
    E.trans = E.trans.filter(t => !t.done || E.time - t.t0 < t.dur + 0.6);
    // magic nudge: a compatible linked part that never got hit gets triggered after a while
    if (E.assist && !E.noMagic && E.mode === 'run') {
      for (const p of E.parts) {
        if (!p.fired || p.def.passthrough && false) continue;
        const since = E.time - p.firedAt; if (since < 4.5) continue;
        for (const id of p.next) {
          const t = E.byId[id];
          if (!t || !t.armed || t.fired) continue;
          const shared = RG.outputsOf(p).filter(s => t.def.inputs.includes(s));
          if (!shared.length) continue;
          if (E.time - E.lastProgress < 3.5) continue;
          if (stillMoving(p)) continue;
          const z = t.zoneWorld(); const o = p.outWorld();
          E.trans.push({ sig: 'magic', from: p, to: t, ax: o.x, ay: o.y, t0: E.time, dur: 0.7, done: true });
          B.sfx('magic');
          B.later(0.7, () => { if (z) magicAssist(z.cx, z.y0 - 10, t, true); RG.trigger(t, shared[0]); });
          E.lastProgress = E.time;
        }
      }
    }
    // remove old pour blobs
    if (E.pours.length) {
      const keep = [];
      for (const b of E.pours) { if (E.time - b.rg.born > 16 || b.position.y > WORLD.h + 100) Composite.remove(E.world, b); else keep.push(b); }
      E.pours = keep;
    }
    // remove things that fell out of the world
    for (const b of things) if (b.position.y > WORLD.h + 300 || b.position.x < -300 || b.position.x > WORLD.w + 300) Composite.remove(E.world, b);
    // fake rolling spin for frictionless balls
    for (const b of things) if (b.rg.roll && b.circleRadius) {
      b.rg.rollAngle += b.velocity.x / b.circleRadius;
      if (b.position.y > WORLD.h - b.circleRadius - 4) Body.setVelocity(b, { x: b.velocity.x * 0.97, y: b.velocity.y });
    }
    // particles
    for (const q of E.particles) { q.t += dt; q.x += q.vx * dt * 60; q.y += q.vy * dt * 60; q.vy += q.g * dt * 60; q.vx *= 0.985; q.rot += q.vr; }
    E.particles = E.particles.filter(q => q.t < q.life);
    if (E.particles.length > 1400) E.particles.splice(0, E.particles.length - 1400);
    for (const q of E.popups) q.t += dt;
    E.popups = E.popups.filter(q => q.t < q.life);
    for (const s of E.sparkles) s.t += dt;
    E.sparkles = E.sparkles.filter(s => s.t < 0.8);
    // run status
    const rs = E.runState;
    if (rs && !rs.done) {
      const done = E.parts.filter(p => p.fired).length;
      rs.count = done;
      if (done === E.parts.length && E.parts.length) { rs.done = true; rs.win = true; RG.fire('complete'); }
      else if (E.time - Math.max(E.lastProgress, 0.4) > 6 && !E.trans.some(t => !t.done) && !rs.stalled && (E.time - E.lastProgress > 20 || !anythingMoving()) && !rescuePending()) { rs.stalled = true; RG.fire('stalled'); }
      else if (rs.stalled && E.time - E.lastProgress < 1) { rs.stalled = false; RG.fire('unstalled'); }
    }
  }
  // A visible, countable "magic assist": wand, sparkles, a purple popup, and a badge on the part it helped
  function magicAssist(x, y, target, big) {
    E.assists = (E.assists || 0) + 1;
    if (target) target.assisted = true;
    E.sparkles.push({ x, y, t: 0 });
    B.sfx('magic');
    B.burst(x, y, big ? 22 : 14, { colors: ['#d6a2ff', '#ffe14d', '#ffffff', '#9ee7ff'], speed: big ? 5 : 3.5, life: 0.9, size: 3.5, gravity: 0.03 });
    if (E.time - (E.lastMagicPop || -9) > 0.8) { E.lastMagicPop = E.time; B.popup(x, y - 34, '🪄 MAGIC ASSIST!', { size: big ? 28 : 24, color: '#e6c8ff', ink: '#2a0f45', life: 1.6 }); }
    RG.fire('assist', target);
  }
  function rescuePending() {
    if (!E.assist || E.noMagic) return false;
    return E.parts.some(p => p.fired && (p.next || []).some(id => { const t = E.byId[id]; return t && t.armed && !t.fired && RG.outputsOf(p).some(s => t.def.inputs.includes(s)); }));
  }
  function stillMoving(p) {
    if (E.time - p.firedAt > 9) return false;
    return Composite.allBodies(E.world).some(b => !b.isStatic && b.rg && b.rg.kind !== 'pour' && (b.rg.emitter === p) && Vector.magnitude(b.velocity) > 0.25);
  }
  function anythingMoving() {
    return Composite.allBodies(E.world).some(b => !b.isStatic && b.rg && b.rg.kind !== 'pour' && b.rg.kind !== 'debris' && Vector.magnitude(b.velocity) > 0.4 && E.time - (b.rg.born || 0) < 30);
  }
  function segBox(x0, y0, x1, y1, z) {
    // sample along the segment, cheap and good enough
    for (let i = 0; i <= 24; i++) { const k = i / 24, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; if (x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1) return true; }
    return false;
  }
  function transPoint(tr, k) {
    const z = tr.to.zoneWorld() || { cx: tr.ax, cy: tr.ay };
    const x0 = tr.ax, y0 = tr.ay, x1 = z.cx, y1 = z.cy;
    const sag = tr.sig === 'pull' ? 0 : tr.sig === 'fire' ? 30 : 0;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag + Math.hypot(x1 - x0, y1 - y0) * (tr.sig === 'zap' ? 0.08 : 0.05);
    const u = 1 - k; return { x: u * u * x0 + 2 * u * k * mx + k * k * x1, y: u * u * y0 + 2 * u * k * my + k * k * y1 };
  }
  RG.transPoint = transPoint;
})();
// Trajectory sampling: run a part alone in a scratch world and record where the thing it throws goes.
(function () {
  const RG = window.RG, E = RG.E, cache = {};
  const { Composite, Vector } = Matter;
  const KEYS = ['engine', 'world', 'parts', 'byId', 'mode', 'time', 'particles', 'popups', 'rings', 'zones', 'trans', 'timers', 'pours', 'sparkles', 'lastProgress', 'runState', 'assist', 'noMagic', 'shake', 'silent', 'slowmo'];
  // Run a machine in a scratch world with pure physics (no assist) and report the first link that failed.
  RG.simulate = function (specs, maxSecs = 60) {
    const saved = {}; KEYS.forEach(k => saved[k] = E[k]);
    let result = { win: false, miss: null };
    try {
      E.silent = true; E.assist = false; E.noMagic = true; E.slowmo = false; E.engine = null;
      RG.start(specs);
      let last = 0;
      for (let i = 0; i < 60 * maxSecs; i++) {
        RG.step();
        if (E.runState.win) break;
        if (E.time - Math.max(E.lastProgress, 0) > 8) break;
      }
      result.win = !!E.runState.win;
      if (!result.win) {
        // first fired part (in chain order) whose linked part never went off
        const order = specs.map(s => E.byId[s.id]).filter(Boolean);
        for (const p of order) {
          if (!p.fired) continue;
          const q = (p.next || []).map(id => E.byId[id]).find(t => t && !t.fired);
          if (q) { result.miss = { from: p.id, to: q.id, fromType: p.type, toType: q.type }; break; }
        }
        if (!result.miss) { const q = order.find(p => !p.fired); if (q) result.miss = { from: null, to: q.id, toType: q.type }; }
      }
    } catch (err) { console.error(err); }
    KEYS.forEach(k => E[k] = saved[k]);
    return result;
  };
  RG.testPair = function (srcSpec, tgtSpec, maxSecs = 12, feedSig) {
    const saved = {}; KEYS.forEach(k => saved[k] = E[k]);
    let ok = false;
    try {
      E.silent = true; E.assist = false; E.noMagic = true; E.slowmo = false; E.engine = null;
      RG.buildWorld([Object.assign({}, srcSpec, { id: '__a', next: ['__b'] }), Object.assign({}, tgtSpec, { id: '__b', next: [] })], 'run');
      E.runState = { done: true };
      const a = E.byId.__a, t = E.byId.__b;
      let rest = 0;
      for (let i = 0; i < 60 * maxSecs; i++) {
        if (i === 8) { if (a.def.passthrough) RG.__feed(a, feedSig); else RG.trigger(a, a.def.inputs[0]); }
        RG.step();
        if (t.fired) { ok = true; break; }
        // give up early once everything has settled and nothing is on its way
        if (i > 120) {
          const moving = Composite.allBodies(E.world).some(b => !b.isStatic && b.rg && Vector.magnitude(b.velocity) > 0.15);
          rest = moving || E.trans.some(x => !x.done) || E.timers.length ? 0 : rest + 1;
          if (rest > 90) break;
        }
      }
    } catch (err) { console.error(err); }
    KEYS.forEach(k => E[k] = saved[k]);
    return ok;
  };
  RG.samplePath = function (spec) {
    const key = spec.type + '|' + (spec.angle || 0).toFixed(3) + '|' + (spec.flip ? 1 : 0);
    if (!cache[key]) {
      const saved = {}; KEYS.forEach(k => saved[k] = E[k]);
      try {
        E.silent = true; E.assist = false; E.noMagic = true; E.slowmo = false;
        E.engine = null; // build the scratch world fresh; never clear the real one we saved above
        const OX = 3000, OY = 1000;
        RG.buildWorld([{ id: '__s', type: spec.type, x: OX, y: OY, flip: spec.flip, angle: spec.angle || 0, next: [] }], 'run');
        const p = E.byId.__s; const box = { x0: p.box.x0 - OX, x1: p.box.x1 - OX, y0: p.box.y0 - OY, y1: p.box.y1 - OY };
        const all = () => Matter.Composite.allBodies(E.world).filter(b => !b.isStatic && b.rg && b.rg.kind !== 'pour' && b.rg.kind !== 'floor');
        const tracks = new Map();
        const rec = () => { for (const b of all()) { if (!tracks.has(b)) tracks.set(b, []); tracks.get(b).push({ x: b.position.x - OX, y: b.position.y - OY }); } };
        for (let i = 0; i < 300; i++) {
          if (i === 8) { if (p.def.passthrough) RG.__feed(p); else RG.trigger(p, p.def.inputs[0]); }
          RG.step(); if (i % 2 === 0) rec();
        }
        let best = null, bd = 0;
        for (const [b, pts] of tracks) { if (pts.length < 2) continue; const d = Math.max(...pts.map(q => Math.hypot(q.x - pts[0].x, q.y - pts[0].y))); if (d > bd && (b.rg.part === p || b.rg.part == null || b.rg.emitter === p)) { bd = d; best = pts; } }
        cache[key] = { path: best && bd > 30 ? best : null, box };
      } catch (err) { console.error(err); cache[key] = { path: null }; }
      KEYS.forEach(k => E[k] = saved[k]);
    }
    const c = cache[key];
    return { path: c.path && c.path.map(q => ({ x: q.x + spec.x, y: q.y + spec.y })), box: c.box && { x0: c.box.x0 + spec.x, x1: c.box.x1 + spec.x, y0: c.box.y0 + spec.y, y1: c.box.y1 + spec.y } };
  };
})();
// Test helper: drop a marble into a passive part's input zone.
window.RG.__feed = function (p, sig) {
  const z = p.zoneWorld(); if (!z) return;
  if (sig === 'pour') { window.RG.B.pour(p, 0, 0, 30, { world: { x: z.cx, y: z.y0 - 10 } }); return; }
  const b = Matter.Bodies.circle(z.x0 + 20, z.y0 - 10, 12, { density: 0.004, friction: 0.02, frictionAir: 0.004, restitution: 0.25 });
  b.rg = { part: null, emitter: null, tags: new Set(), fill: '#fff', kind: 'thing', born: 0, pokes: 0, still: 0, alpha: 1 };
  Matter.Composite.add(window.RG.E.world, b);
  if (p.def.inputs.includes('pour') && !p.def.inputs.includes('drop')) window.RG.B.pour(p, 0, 0, 30, { world: { x: z.cx, y: z.y0 - 10 } });
};
