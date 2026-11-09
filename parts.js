// The parts catalog. Each part declares what it accepts (inputs) and what it produces (outputs),
// how it is built out of physics bodies, and what happens when it is triggered.
(function () {
  const RG = window.RG, E = RG.E, B = RG.B, R = RG.R;
  const { Body, Composite } = Matter;
  const WOOD = '#b07a43', WOOD_D = '#6b4a2b', METAL = '#a9b3c1', RED = '#e8453c', CREAM = '#f4efe2';
  const since = p => (p.fired ? E.time - p.firedAt : -1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  function shelf(p, x, y, w, o = {}) { return B.rect(p, x, y, w, 10, Object.assign({ static: true, fill: WOOD, mount: true, friction: 0.5, chamfer: 2 }, o)); }
  function shade(hex, k = 0.55) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k; return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function ballDraw(col) {
    return (ctx, b, p, ang) => {
      const r = b.circleRadius;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = shade(col, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, -0.6, 0.9); ctx.stroke();
      ctx.rotate(-(ang ?? b.angle));
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.35, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(10,5,20,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    };
  }
  function ball(p, x, y, r, col, o = {}) {
    return B.circle(p, x, y, r, Object.assign({ fill: col, draw: ballDraw(col), sound: 'tink', density: 0.004, friction: 0, frictionAir: 0.004, restitution: 0.25, roll: true }, o));
  }
  RG.helpers = { shelf, ball, ballDraw, since, shade };

  // A device: a wall-mounted gadget drawn mostly by its emoji, which reacts and then emits signals.
  function device(d) {
    const w = d.w || 56, h = d.h || 56;
    return RG.def(Object.assign({
      inZone: { x: 0, y: 0, w: w + 20, h: h + 20 },
      out: { x: w / 2 + 6, y: 0 },
      build(p) {
        if (d.plate !== false) shelf(p, 0, h / 2 + 5, w + 12);
        p.s.body = B.rect(p, 0, 0, w, h, { static: true, emoji: d.bodyEmoji === undefined ? d.emoji : d.bodyEmoji, emojiSize: d.size || 50, faceLeft: d.faceLeft, fill: d.fill, draw: d.bodyDraw, chamfer: d.fill ? 6 : 0 });
        if (d.build2) d.build2(p);
      },
      trigger(p, B_, via) {
        if (d.sfx) B.sfx(d.sfx);
        if (d.word) B.popAt(p, 0, -h / 2 - 20, d.word, { color: d.wordColor, size: d.wordSize });
        B.burstAt(p, 0, 0, 10, { speed: 4, life: 0.5 });
        if (d.onTrigger) d.onTrigger(p, via);
        const emits = d.emits || d.outputs.map(s => [s, {}]);
        B.later(d.delay ?? 0.25, () => emits.forEach(([s, o]) => B.emit(p, s, o || {})));
      },
    }, d));
  }
  RG.device = device;

  // ================================================================= STARTERS
  RG.def({
    id: 'marble_hopper', name: 'Marble Hopper', emoji: '🫙', cat: 'Starters', inputs: ['start'], outputs: ['drop'],
    desc: 'Opens a trapdoor and lets a marble fall.',
    out: { x: 0, y: 44 },
    build(p) {
      B.rect(p, -23, -2, 6, 54, { static: true, fill: '#cfe8f0', alpha: 0.85 });
      B.rect(p, 23, -2, 6, 54, { static: true, fill: '#cfe8f0', alpha: 0.85 });
      p.s.gate = B.rect(p, 0, 28, 40, 6, { static: true, fill: RED });
      B.rect(p, 0, -32, 60, 8, { static: true, fill: WOOD, mount: true });
      p.s.ball = ball(p, 0, 10, 13, '#3fc8ff');
    },
    trigger(p) { B.remove(p, p.s.gate); B.sfx('click'); B.popAt(p, 0, -50, 'PLINK!'); },
  });

  RG.def({
    id: 'windup_car', name: 'Wind-up Car', emoji: '🚗', cat: 'Starters', inputs: ['start'], outputs: ['push', 'roll'],
    desc: 'A clockwork car that zooms off its shelf.',
    out: { x: 112, y: 0 },
    build(p) {
      shelf(p, 20, 20, 190);
      p.s.car = B.rect(p, -50, 2, 56, 24, {
        density: 0.004, friction: 0, frictionAir: 0.01, sound: 'thud', chamfer: 6,
        draw(ctx, b) {
          ctx.fillStyle = '#ff5a4f'; ctx.strokeStyle = '#2a1020'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(-28, -8, 56, 18, 6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff7d6e'; ctx.beginPath(); ctx.roundRect(-14, -20, 28, 14, 6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#bfe9ff'; ctx.fillRect(-9, -16, 8, 8); ctx.fillRect(2, -16, 8, 8);
          const sp = (E.time * 20) % 6.28;
          for (const x of [-16, 16]) { ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.arc(x, 10, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + Math.cos(sp) * 6, 10 + Math.sin(sp) * 6); ctx.stroke(); }
          ctx.save(); ctx.translate(-30, -2); ctx.rotate(E.time * 8); ctx.fillStyle = '#ffd34d'; ctx.fillRect(-2, -8, 4, 16); ctx.fillRect(-8, -2, 16, 4); ctx.restore();
        },
      });
    },
    trigger(p) { p.s.motor = 2.4; B.sfx('whirr'); B.popAt(p, -50, -30, 'VROOM!'); },
    update(p) {
      if (p.s.motor > 0) {
        p.s.motor -= 1 / 60;
        const c = p.s.car;
        if (c.velocity.x * p.dir < 5) Body.applyForce(c, c.position, { x: p.dir * c.mass * 0.0009, y: 0 });
      }
    },
  });

  device({ id: 'alarm_clock', name: 'Alarm Clock', emoji: '⏰', cat: 'Starters', inputs: ['start'], outputs: ['noise'], desc: 'BRRRING! Wakes up anything that listens.', sfx: 'ring', word: 'BRRRING!', delay: 0.2,
    onTrigger(p) { p.shakeT = 1.2; } });
  device({ id: 'big_button', name: 'Big Red Button', emoji: '🔴', cat: 'Starters', inputs: ['start'], outputs: ['zap'], desc: 'Press it. Sends electricity down a wire.', sfx: 'click', word: 'CLICK!', size: 46,
    onTrigger(p) { B.sfx('zap'); } });
  device({ id: 'rip_cord', name: 'Rip Cord', emoji: '🪢', cat: 'Starters', inputs: ['start'], outputs: ['pull'], desc: 'Someone yanks the cord. Pulls whatever it is tied to.', sfx: 'whoosh', word: 'YANK!', size: 44 });
  device({ id: 'lit_match', name: 'Strike a Match', emoji: '🔥', cat: 'Starters', inputs: ['start'], outputs: ['fire'], desc: 'A match flares up and lights a fuse.', sfx: 'fwoosh', word: 'FSSST!',
    w: 30, h: 60, out: { x: 0, y: -40 }, emits: [['fire', { dur: 7 }]],
    bodyDraw(ctx) { ctx.fillStyle = '#f2d39b'; ctx.fillRect(-4, -28, 8, 56); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.ellipse(0, -30, 7, 9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke(); },
    bodyEmoji: null });
  device({ id: 'flashlight', name: 'Flashlight', emoji: '🔦', cat: 'Starters', inputs: ['start'], outputs: ['light'], desc: 'Click! A beam of light.', sfx: 'click', word: 'CLICK!', emits: [['light', { dur: 7 }]] });
  RG.def({
    id: 'water_tank', name: 'Water Tank', emoji: '🚰', cat: 'Starters', inputs: ['start'], outputs: ['pour'],
    desc: 'Opens the tap and pours water.', out: { x: 36, y: 40 },
    build(p) {
      shelf(p, 0, 36, 76);
      p.s.tank = B.rect(p, 0, 0, 60, 60, { static: true, draw(ctx) {
        ctx.fillStyle = '#7fb6d6'; ctx.strokeStyle = '#1d2a36'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-30, -30, 60, 60, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3aa6ff'; ctx.fillRect(-26, -4, 52, 30);
        ctx.fillStyle = METAL; ctx.fillRect(28, 14, 12, 7); ctx.fillRect(34, 18, 6, 12);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('H₂O', 0, -12);
      } });
    },
    trigger(p) { B.sfx('splash'); B.popAt(p, 0, -48, 'GLUG!'); B.pour(p, 37, 34, 44, { vy: 1.5, vx: 0.2, every: 0.035 }); },
  });
  RG.def({
    id: 'cue_stick', name: 'Cue Stick', emoji: '🎱', cat: 'Starters', inputs: ['start'], outputs: ['roll'],
    desc: 'Pool cue smacks a ball off the shelf.', out: { x: 108, y: 0 },
    build(p) {
      shelf(p, 30, 18, 160);
      p.s.ball = ball(p, -20, 0, 13, '#ffffff', { draw: (ctx, b, p, ang) => { ballDraw('#f5f5f5')(ctx, b, p, ang); ctx.rotate(ang); ctx.fillStyle = '#111'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('8', 0, 1); } });
    },
    drawFront(p, ctx) {
      const t = since(p);
      const off = t < 0 ? -6 : t < 0.12 ? -6 - 26 * ease(t / 0.12) : Math.min(0, -32 + (t - 0.12) * 420);
      ctx.save(); R.local(ctx, p);
      const tip = -34 + off;
      ctx.fillStyle = '#d9b07a'; ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tip, -2); ctx.lineTo(tip - 120, -5); ctx.lineTo(tip - 120, 5); ctx.lineTo(tip, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2d6cdf'; ctx.fillRect(tip - 3, -2.5, 4, 5);
      ctx.fillStyle = '#3b2412'; ctx.fillRect(tip - 120, -5, 30, 10);
      ctx.restore();
    },
    trigger(p) { B.later(0.12, () => { B.vel(p, p.s.ball, 7.5, 0); B.sfx('clack', 1.2); B.popAt(p, -30, -30, 'THWACK!'); }); },
  });

  // ================================================================= ROLLING & FALLING
  function rampDef(id, name, len, desc) {
    RG.def({
      id, name, emoji: '📐', cat: 'Rolling & Falling', inputs: ['roll', 'drop'], outputs: ['roll'], desc, rotatable: true, passthrough: true, defaultAngle: 0.18,
      inZone: { x: -len / 2 + 50, y: -18, w: 100, h: 40 }, out: { x: len / 2 + 4, y: -12 },
      build(p) { B.rect(p, 0, 0, len, 12, { static: true, fill: WOOD, mount: true, friction: 0.05, chamfer: 3 }); },
      drawFront(p, ctx) { ctx.save(); R.local(ctx, p); ctx.strokeStyle = 'rgba(60,35,15,0.5)'; ctx.lineWidth = 1; for (let x = -len / 2 + 14; x < len / 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 8, 5); ctx.stroke(); } ctx.restore(); },
    });
  }
  rampDef('ramp', 'Ramp', 190, 'A plank that turns falling things into rolling things. Tilt it with the rotate buttons.');
  rampDef('long_ramp', 'Long Ramp', 330, 'An extra long plank for long rolls. Rotatable.');

  RG.def({
    id: 'funnel', name: 'Funnel', emoji: '🔻', cat: 'Rolling & Falling', inputs: ['drop', 'pour', 'roll'], outputs: ['drop', 'pour'], passthrough: true,
    passMap: { drop: ['drop'], roll: ['drop'], pour: ['pour'] },
    desc: 'Catches falling stuff and liquids, and drops them in one spot. What goes in comes out: a marble stays a marble.',
    inZone: { x: 0, y: -14, w: 100, h: 56 }, out: { x: 0, y: 66 },
    build(p) {
      B.rect(p, -35, 0, 8, 64, { static: true, angle: -0.5, fill: '#ff9f43', friction: 0 });
      B.rect(p, 35, 0, 8, 64, { static: true, angle: 0.5, fill: '#ff9f43', friction: 0 });
      B.rect(p, -19, 42, 6, 26, { static: true, fill: '#e8862e', friction: 0 });
      B.rect(p, 19, 42, 6, 26, { static: true, fill: '#e8862e', friction: 0 });
    },
  });

  RG.def({
    id: 'trampoline', name: 'Trampoline', emoji: '🤸', cat: 'Rolling & Falling', inputs: ['drop'], outputs: ['drop'], passthrough: true,
    desc: 'Boing! Bounces a falling thing up and over.',
    inZone: { x: 0, y: -18, w: 110, h: 30 }, out: { x: 170, y: -10 },
    build(p) {
      B.rect(p, 0, 0, 112, 8, { static: true, restitution: 0.6, draw(ctx) {
        const t = E.time - (p.s.lastBounce || -9); const sag = t < 0.3 ? Math.sin(t / 0.3 * Math.PI) * 10 : 0;
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-56, 26); ctx.moveTo(50, 0); ctx.lineTo(56, 26); ctx.stroke();
        ctx.fillStyle = '#2d6cdf'; ctx.beginPath(); ctx.moveTo(-56, -3); ctx.quadraticCurveTo(0, -3 + sag * 2, 56, -3); ctx.lineTo(56, 3); ctx.quadraticCurveTo(0, 3 + sag * 2, -56, 3); ctx.fill();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(-58, -5, 8, 10); ctx.fillRect(50, -5, 8, 10);
      } });
      shelf(p, 0, 30, 130);
    },
    update(p) {
      if (E.mode !== 'run') return;
      const z = p.zoneWorld();
      for (const b of Composite.allBodies(E.world)) {
        if (b.isStatic || !b.rg || b.rg.kind === 'pour' || b.rg.part === p) continue;
        if (!RG.inBox(b, z) || b.velocity.y < 0.5) continue;
        Body.setVelocity(b, p.vec(3.1, -11.5)); b.rg.emitter = p;
        p.s.lastBounce = E.time; B.sfx('boing'); B.popAt(p, 0, -40, 'BOING!', { size: 26 });
        if (!p.fired) RG.trigger(p, 'drop', b);
      }
    },
  });

  RG.def({
    id: 'bumper', name: 'Pinball Bumper', emoji: '🟣', cat: 'Rolling & Falling', inputs: ['roll', 'drop'], outputs: ['roll'], passthrough: true,
    desc: 'A springy kicker: anything that touches it gets launched up and forward with a flash.',
    inZone: { x: 0, y: 0, w: 72, h: 72 }, out: { x: 44, y: 10 },
    build(p) {
      p.s.b = B.circle(p, 0, 0, 24, { static: true, restitution: 1, draw(ctx) {
        const t = E.time - (p.s.hit || -9); const s = 1 + (t < 0.2 ? (0.2 - t) * 1.5 : 0);
        ctx.scale(s, s);
        ctx.fillStyle = '#5b2a86'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
        ctx.fillStyle = t < 0.2 ? '#fff' : '#d36bff'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1a0a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke();
      } });
    },
    update(p) {
      if (E.mode !== 'run') return;
      const c = p.s.b.position;
      for (const b of Composite.allBodies(E.world)) {
        if (b.isStatic || !b.rg || b.rg.kind === 'pour') continue;
        const dx = b.position.x - c.x, dy = b.position.y - c.y, d = Math.hypot(dx, dy);
        const rr = 24 + (b.circleRadius || 14) + 3;
        if (d < rr && (b.rg.bumped || 0) < E.time - 0.25) {
          b.rg.bumped = E.time; b.rg.emitter = p;
          const nx = dx / d, ny = dy / d;
          // a kicker: always launches up and forward, so where the ball goes is predictable
          Body.setVelocity(b, { x: p.dir * 5.5, y: -7 });
          p.s.hit = E.time; B.sfx('boing'); B.burst(c.x + nx * 24, c.y + ny * 24, 12, { colors: ['#ff9ef0', '#ffe14d', '#fff'], speed: 5 });
          B.popup(c.x, c.y - 40, '+100', { size: 22, color: '#ff9ef0' });
          if (!p.fired) RG.trigger(p, 'roll', b);
        }
      }
    },
  });

  RG.def({
    id: 'domino_run', name: 'Domino Run', emoji: '🁢', cat: 'Rolling & Falling', inputs: ['push', 'roll'], outputs: ['push'],
    desc: 'Seven dominoes in a row. Knock the first one over.',
    inZone: { x: -16, y: 0, w: 26, h: 56 }, out: { x: 170, y: -4 },
    build(p) {
      shelf(p, 76, 33, 200);
      p.s.d = [];
      for (let i = 0; i < 7; i++) {
        p.s.d.push(B.rect(p, i * 26, 1, 10, 54, { fill: i % 2 ? CREAM : '#ffe9a8', sound: 'clack', density: 0.003, friction: 0.5, restitution: 0.05, chamfer: 2,
          draw(ctx) { ctx.fillStyle = i % 2 ? CREAM : '#ffe9a8'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-5, -27, 10, 54, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#222'; ctx.fillRect(-4, -1, 8, 2); ctx.beginPath(); ctx.arc(0, -14, 1.8, 0, 7); ctx.arc(0, 14, 1.8, 0, 7); ctx.fill(); } }));
      }
    },
    trigger(p) { Body.setAngularVelocity(p.s.d[0], 0.07 * p.dir); B.sfx('clack', 1); },
  });

  RG.def({
    id: 'big_book', name: 'Big Book', emoji: '📕', cat: 'Rolling & Falling', inputs: ['push', 'roll'], outputs: ['push', 'drop'],
    desc: 'A heavy dictionary standing on end. Topples with a thud.',
    inZone: { x: -16, y: 0, w: 26, h: 76 }, out: { x: 56, y: -6 },
    build(p) {
      shelf(p, 6, 43, 74);
      p.s.book = B.rect(p, 0, 0, 26, 76, { density: 0.004, friction: 0.8, sound: 'thud', draw(ctx) {
        ctx.fillStyle = '#c0392b'; ctx.strokeStyle = '#2a0e0a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-13, -38, 26, 76, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(-13, -28, 26, 4); ctx.fillRect(-13, 24, 26, 4);
        ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('PHYSICS', 0, 4); ctx.restore();
      } });
    },
    trigger(p) { Body.setAngularVelocity(p.s.book, 0.05 * p.dir); },
  });

  RG.def({
    id: 'bowling_ball', name: 'Bowling Ball', emoji: '🎳', cat: 'Rolling & Falling', inputs: ['push', 'roll'], outputs: ['roll'],
    desc: 'A heavy ball resting on a ledge. Nudge it and it rolls off with momentum.',
    inZone: { x: -22, y: 0, w: 50, h: 50 }, out: { x: 100, y: 6 },
    build(p) {
      shelf(p, 34, 26, 150);
      p.s.ball = ball(p, -20, 0, 20, '#2b2d42', { density: 0.012, heavy: true, sound: 'thud', draw: (ctx, b, p, ang) => { ballDraw('#30345a')(ctx, b, p, ang); ctx.rotate(ang); ctx.fillStyle = '#0b0b12'; for (const [x, y] of [[-4, -8], [4, -8], [0, -1]]) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); } } });
    },
    trigger(p) { B.vel(p, p.s.ball, 3, 0); B.sfx('rumble'); },
  });

  RG.def({
    id: 'honey_balloon', name: 'Honey Balloon', emoji: '🍯', cat: 'Rolling & Falling', inputs: ['push', 'roll', 'drop', 'sharp'], outputs: ['roll', 'pour'],
    // popped by something sharp it just splats (pour); bumped, it rolls first and splats on landing
    passMap: { push: ['roll', 'pour'], roll: ['roll', 'pour'], drop: ['roll', 'pour'], sharp: ['pour'] },
    desc: 'A balloon filled with honey. It rolls very, very slowly. Poke it and honey gushes out.',
    out: { x: 192, y: 18 },
    zoneWorld(p) {
      const b = p.s.ball; if (!b || p.s.popped) return null;
      const r = 34; return { x0: b.position.x - r, x1: b.position.x + r, y0: b.position.y - r, y1: b.position.y + r, cx: b.position.x, cy: b.position.y };
    },
    inZone: { x: -70, y: -16, w: 64, h: 64 },
    build(p) {
      B.rect(p, 50, 30, 270, 10, { static: true, fill: WOOD, mount: true, angle: 0.1, friction: 0.9 });
      p.s.chock = B.rect(p, -38, 4, 8, 18, { static: true, fill: WOOD_D });
      p.s.ball = B.circle(p, -74, -18, 26, {
        density: 0.006, friction: 1, frictionAir: 0.045, restitution: 0, heavy: true, sound: 'gloop', noAssist: false,
        draw(ctx, b) {
          ctx.rotate(-b.angle);
          const sp = Math.hypot(b.velocity.x, b.velocity.y);
          const w = 1 + Math.sin(E.time * 7) * 0.04 + sp * 0.05, h = 2 - w;
          ctx.scale(w, h);
          const g = ctx.createRadialGradient(-9, -10, 2, 0, 0, 28);
          g.addColorStop(0, '#fff3c4'); g.addColorStop(0.3, '#ffbe3b'); g.addColorStop(1, '#b8640b');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill();
          ctx.strokeStyle = '#6b3a05'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = 'rgba(120,60,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 12, 20, 9, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#6b3a05'; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(4, -26); ctx.lineTo(0, -31); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-10, -12, 6, 3.5, -0.6, 0, 7); ctx.fill();
          ctx.fillStyle = '#6b3a05'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('HONEY', 0, 4);
        },
      });
    },
    trigger(p, B_, via) {
      if (via === 'sharp') { splat(p, 'SPLORCH!'); return; }
      B.remove(p, p.s.chock); B.vel(p, p.s.ball, 1.0, 0); B.sfx('gloop'); B.popAt(p, -74, -60, 'gloooop…', { size: 24, color: '#ffbe3b' });
      p.s.rolling = true;
    },
    update(p) {
      const b = p.s.ball; if (!b || p.s.popped || E.mode !== 'run') return;
      if (p.s.rolling) {
        const sp = Math.hypot(b.velocity.x, b.velocity.y);
        const onTrack = (b.position.x - p.toWorld(186, 0).x) * p.dir < 0;
        if (sp < 0.8) Body.applyForce(b, b.position, { x: p.dir * b.mass * 0.00022, y: 0 });
        if (onTrack) {
          if (sp > 1.15) Body.setVelocity(b, { x: b.velocity.x * 0.92, y: b.velocity.y * 0.95 });
        } else if ((p.s.vy || 0) > 2.5 && b.velocity.y < p.s.vy * 0.35) {
          splat(p, 'SPLAT!'); return;
        }
        p.s.vy = b.velocity.y;
        if (Math.random() < 0.08) B.burst(b.position.x, b.position.y + 22, 1, { colors: ['#f5a524'], speed: 0.3, life: 1.2, size: 4, gravity: 0.08 });
      }
    },
  });
  function splat(p, word) {
    const b = p.s.ball; const pos = { x: b.position.x, y: b.position.y };
    p.s.popped = true; B.remove(p, b); B.remove(p, p.s.chock);
    B.sfx('squelch'); B.sfx('pop'); B.popup(pos.x, pos.y - 30, word, { color: '#ffbe3b' }); B.shake(5);
    B.burst(pos.x, pos.y, 26, { colors: ['#ffbe3b', '#f5a524', '#ffe08a'], speed: 5, size: 5 });
    B.pour(p, 0, 0, 46, { liquid: 'honey', world: { x: pos.x, y: pos.y - 6 }, spread: 30, vx: 0, vy: -1, jitter: 3, every: 0.012 });
  }

  RG.def({
    id: 'seesaw', name: 'Seesaw Launcher', emoji: '⚖️', cat: 'Rolling & Falling', inputs: ['drop'], outputs: ['drop'],
    desc: 'Drop something heavy on the low end and the ball on the other end goes flying.',
    inZone: { x: -66, y: -22, w: 60, h: 46 }, out: { x: 230, y: -30 },
    build(p) {
      B.trapezoid(p, 0, 24, 34, 26, 0.9, { static: true, fill: '#7d8597' });
      p.s.plank = B.rect(p, 0, 8, 190, 8, { fill: WOOD, density: 0.002, friction: 0.6 });
      B.pinTo(p, p.s.plank, 0, 8, { draw: 'pivot' });
      B.rect(p, 88, 22, 10, 18, { static: true, fill: '#7d8597' });
      p.s.ball = ball(p, 80, -6, 12, '#7bed9f');
      Body.setStatic(p.s.ball, true); Body.setStatic(p.s.plank, true);
    },
    trigger(p) { Body.setStatic(p.s.plank, false); Body.setStatic(p.s.ball, false); Body.setAngularVelocity(p.s.plank, -0.2 * p.dir); B.vel(p, p.s.ball, 2.6, -12); B.sfx('boing'); B.popAt(p, 80, -40, 'FWING!'); },
  });

  RG.def({
    id: 'cactus_cart', name: 'Cactus Cart', emoji: '🌵', cat: 'Pokey Things', inputs: ['push', 'roll'], outputs: ['sharp'],
    desc: 'A prickly cactus on wheels. Shove it into something you want popped.',
    inZone: { x: -48, y: -6, w: 56, h: 56 }, out: { x: 170, y: -16 },
    build(p) {
      shelf(p, 50, 26, 220);
      p.s.cart = B.rect(p, -40, -4, 44, 50, { tags: ['sharp'], density: 0.003, friction: 0, frictionAir: 0.008, sound: 'thud', draw(ctx) {
        ctx.fillStyle = '#8d5a2b'; ctx.fillRect(-22, 10, 44, 10);
        ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.arc(-14, 21, 5, 0, 7); ctx.arc(14, 21, 5, 0, 7); ctx.fill();
        R.emoji(ctx, '🌵', 0, -8, 38);
      } });
    },
    trigger(p) { B.vel(p, p.s.cart, 5, 0); B.sfx('creak'); },
  });

  RG.def({
    id: 'candle_cart', name: 'Candle Cart', emoji: '🕯️', cat: 'Fire & Light', inputs: ['push', 'roll'], outputs: ['fire'],
    desc: 'A lit candle on a little cart. Push it and it rolls its flame under something.',
    inZone: { x: -48, y: -6, w: 56, h: 56 }, out: { x: 150, y: -40 },
    build(p) {
      shelf(p, 50, 26, 220);
      B.rect(p, 168, 10, 8, 24, { static: true, fill: WOOD_D });
      p.s.cart = B.rect(p, -40, -2, 40, 46, { density: 0.003, friction: 0, frictionAir: 0.012, sound: 'thud', draw(ctx) {
        ctx.fillStyle = '#8d5a2b'; ctx.fillRect(-20, 10, 40, 8);
        ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.arc(-12, 20, 5, 0, 7); ctx.arc(12, 20, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.fillRect(-6, -22, 12, 32); ctx.strokeRect(-6, -22, 12, 32);
        ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -27); ctx.stroke();
        if (E.mode !== 'run') R.flame(ctx, 0, -28, 6, E.time);
      } });
      if (E.mode === 'run') E.zones.push({ type: 'fire', x: 0, y: 0, r: 16, until: 1e9, from: p, follow: p.s.cart, fx: 0, fy: -34 });
    },
    trigger(p) { B.vel(p, p.s.cart, 4.5, 0); B.sfx('creak'); },
    update(p) {
      if (!p.fired || p.s.lit) return;
      const c = p.s.cart, t = since(p);
      if ((t > 0.6 && Math.abs(c.velocity.x) < 0.3) || t > 2.5) { p.s.lit = true; B.popAt(p, 140, -60, 'FWOOSH!', { color: '#ff9f43', size: 26 }); B.emit(p, 'fire', { dur: 5, r: 10 }); }
    },
  });

  // ================================================================= RELEASES (strings, wires, gates)
  RG.def({
    id: 'trapdoor', name: 'Trapdoor Shelf', emoji: '🚪', cat: 'Sparks & Strings', inputs: ['pull', 'zap'], outputs: ['drop'],
    desc: 'A marble waits on a hinged door. Yank it or zap it and the door swings open.',
    inZone: { x: 0, y: 0, w: 90, h: 60 }, out: { x: 22, y: 50 },
    build(p) {
      shelf(p, -32, 20, 40);
      p.s.door = B.rect(p, 22, 20, 54, 8, { static: true, fill: '#ff9f43' });
      p.s.ball = ball(p, 20, 3, 13, '#ff6b9a');
    },
    trigger(p) { B.remove(p, p.s.door); B.sfx('creak'); B.popAt(p, 20, -30, 'CREAK!'); },
    drawFront(p, ctx) {
      const t = since(p); if (t < 0) return;
      ctx.save(); R.local(ctx, p); ctx.translate(-5, 20); ctx.rotate(Math.min(1.5, t * 8));
      ctx.fillStyle = '#ff9f43'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.fillRect(0, -4, 54, 8); ctx.strokeRect(0, -4, 54, 8); ctx.restore();
    },
  });

  RG.def({
    id: 'starting_gate', name: 'Starting Gate', emoji: '🏁', cat: 'Sparks & Strings', inputs: ['pull', 'zap'], outputs: ['roll'],
    desc: 'A ball waits behind a gate on a slope. Lift the gate and it rolls away.',
    inZone: { x: -20, y: -10, w: 80, h: 60 }, out: { x: 128, y: 14 },
    build(p) {
      B.rect(p, 34, 20, 190, 10, { static: true, fill: WOOD, mount: true, angle: 0.15, friction: 0.05 });
      p.s.gate = B.rect(p, -26, -10, 6, 36, { static: true, fill: '#ffffff' });
      p.s.ball = ball(p, -46, -10, 13, '#ffd34d');
    },
    trigger(p) { B.remove(p, p.s.gate); B.sfx('whoosh'); B.popAt(p, -26, -50, 'GO!'); },
    drawFront(p, ctx) {
      const t = since(p); if (t < 0) return;
      ctx.save(); R.local(ctx, p); ctx.translate(-26, -10 - Math.min(60, t * 300)); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.fillRect(-3, -18, 6, 36); ctx.strokeRect(-3, -18, 6, 36); ctx.restore();
    },
  });

  RG.def({
    id: 'catapult', name: 'Catapult', emoji: '🥄', cat: 'Rolling & Falling', inputs: ['fire', 'sharp', 'pull'], outputs: ['drop'],
    desc: 'A spoon held down by a string. Burn it, cut it or pull the pin and the ball is flung in an arc.',
    inZone: { x: -6, y: 8, w: 120, h: 56 }, out: { x: 190, y: -40 },
    build(p) {
      shelf(p, 0, 34, 120);
      B.rect(p, 40, 18, 12, 24, { static: true, fill: WOOD_D });
      p.s.arm = B.rect(p, -10, 4, 110, 8, { static: true, fill: '#8d6e63' });
      p.s.lip = B.rect(p, -62, -4, 6, 14, { static: true, fill: '#8d6e63' });
      p.s.ball = ball(p, -44, -12, 11, '#ff7675');
    },
    drawFront(p, ctx) {
      ctx.save(); R.local(ctx, p);
      if (!p.fired) { ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(28, 6); ctx.lineTo(28, 30); ctx.stroke(); }
      const t = since(p);
      if (t >= 0) {
        const a = Math.min(1.3, ease(t / 0.12) * 1.3);
        ctx.translate(44, 4); ctx.rotate(a);
        ctx.fillStyle = '#8d6e63'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.fillRect(-110, -4, 110, 8); ctx.strokeRect(-110, -4, 110, 8);
        ctx.fillRect(-112, -12, 6, 14);
      }
      ctx.restore();
    },
    trigger(p) {
      B.remove(p, p.s.arm); B.remove(p, p.s.lip);
      p.s.arm = null;
      B.vel(p, p.s.ball, 5.6, -10.5); B.sfx('sproing'); B.popAt(p, -40, -40, 'FLING!');
    },
  });

  RG.def({
    id: 'anvil', name: 'Anvil on a Rope', emoji: '🪨', cat: 'Rolling & Falling', inputs: ['fire', 'sharp'], outputs: ['drop'],
    desc: 'A very heavy anvil hangs by a rope. Burn or cut the rope and it plummets.',
    inZone: { x: 0, y: -38, w: 44, h: 54 }, out: { x: 0, y: 64 },
    build(p) {
      B.rect(p, 0, -78, 40, 10, { static: true, fill: METAL, mount: true });
      p.s.anvil = B.trapezoid(p, 0, 26, 60, 32, -0.4, { density: 0.02, heavy: true, sound: 'clang', friction: 0.6, draw(ctx) {
        ctx.fillStyle = '#4a4f5c'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(30, -14); ctx.quadraticCurveTo(40, -12, 44, -18); ctx.lineTo(26, -4); ctx.lineTo(14, -2); ctx.lineTo(18, 14); ctx.lineTo(-20, 14); ctx.lineTo(-16, -2); ctx.lineTo(-30, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-30, -13, 56, 3);
        ctx.fillStyle = '#fff'; ctx.font = '900 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('1 TON', -1, 8);
      } });
      p.s.rope = B.pinTo(p, p.s.anvil, 0, -74, { pointA: { x: 0, y: -14 }, length: 86, stiffness: 0.9, draw: 'rope' });
    },
    trigger(p, B_, via) {
      B.remove(p, p.s.rope); B.sfx(via === 'fire' ? 'sizzle' : 'snip'); B.popAt(p, 0, -50, via === 'fire' ? 'FZZT!' : 'SNIP!');
      B.later(0.5, () => B.sfx('whoosh'));
    },
  });

  RG.def({
    id: 'party_balloon', name: 'Party Balloon', emoji: '🎈', cat: 'Pokey Things', inputs: ['sharp', 'fire'], outputs: ['noise', 'drop'],
    desc: 'A balloon holding up a sandbag. Pop it with something sharp or hot: BANG, and the sandbag drops.',
    inZone: { x: 0, y: -40, w: 70, h: 76 }, out: { x: 0, y: 62 },
    build(p) {
      p.s.balloon = B.circle(p, 0, -40, 28, { static: true, sensor: true, draw(ctx) {
        const bob = Math.sin(E.time * 2 + p.x) * 2;
        ctx.translate(0, bob);
        ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 31, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7a0f25'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#7a0f25'; ctx.beginPath(); ctx.moveTo(-4, 31); ctx.lineTo(4, 31); ctx.lineTo(0, 26); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-9, -12, 6, 10, -0.5, 0, 7); ctx.fill();
      } });
      p.s.bag = B.rect(p, 0, 34, 30, 24, { density: 0.006, heavy: true, sound: 'thud', draw(ctx) {
        ctx.fillStyle = '#b08b57'; ctx.strokeStyle = '#3b2a12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-15, -12, 30, 24, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3b2a12'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('SAND', 0, 4);
      } });
      p.s.str = B.join(p, p.s.balloon, p.s.bag, { pointA: { x: 0, y: 30 }, pointB: { x: 0, y: -12 }, length: 12, draw: 'rope', color: '#eee', width: 1.5 });
    },
    trigger(p) {
      const c = p.s.balloon.position;
      B.remove(p, p.s.str); B.remove(p, p.s.balloon);
      B.sfx('pop'); B.shake(8); B.popup(c.x, c.y, 'POP!', { color: '#ff4d6d', size: 44 });
      B.burst(c.x, c.y, 30, { type: 'confetti', colors: ['#ff4d6d', '#ff8fa3', '#ffe14d'], speed: 7 });
      B.emit(p, 'noise', { at: { x: 0, y: -40 } });
    },
  });

  RG.def({
    id: 'water_balloon', name: 'Water Balloon', emoji: '💦', cat: 'Pokey Things', inputs: ['sharp', 'fire'], outputs: ['pour', 'noise'],
    desc: 'A wobbly water balloon on a hook. Pop it for a splash.',
    inZone: { x: 0, y: 0, w: 66, h: 70 }, out: { x: 0, y: 34 },
    build(p) {
      B.rect(p, 0, -56, 30, 8, { static: true, fill: METAL, mount: true });
      p.s.b = B.circle(p, 0, 0, 26, { static: true, sensor: true, draw(ctx) {
        const w = 1 + Math.sin(E.time * 5 + p.x) * 0.04;
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -28); ctx.stroke();
        ctx.scale(w, 2 - w);
        ctx.fillStyle = 'rgba(60,170,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, 2, 25, 27, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#0d4a7a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-8, -8, 5, 9, -0.5, 0, 7); ctx.fill();
      } });
    },
    trigger(p) {
      const c = p.s.b.position; B.remove(p, p.s.b);
      B.sfx('pop'); B.sfx('splash'); B.popup(c.x, c.y - 20, 'SPLOOSH!', { color: '#4fc3ff' });
      B.pour(p, 0, 6, 40, { spread: 40, vy: 1, jitter: 3, every: 0.008 });
      B.emit(p, 'noise', { radius: 520 });
    },
  });

  RG.def({
    id: 'toaster', name: 'Toaster', emoji: '🍞', cat: 'Sparks & Strings', inputs: ['zap'], outputs: ['drop', 'noise'],
    desc: 'Electricity makes toast. DING! The toast launches out in an arc.',
    inZone: { x: 0, y: 0, w: 80, h: 60 }, out: { x: 150, y: -10 },
    build(p) {
      shelf(p, 0, 26, 86);
      B.rect(p, 0, 0, 70, 40, { static: true, draw(ctx) {
        ctx.fillStyle = '#d0d6df'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-35, -20, 70, 40, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2f38'; ctx.fillRect(-22, -20, 18, 4); ctx.fillRect(4, -20, 18, 4);
        ctx.fillStyle = p.fired ? '#ff7043' : '#555'; ctx.fillRect(28, -6, 10, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-28, -14, 4, 22);
      } });
    },
    trigger(p) {
      B.sfx('buzz');
      B.later(0.5, () => {
        B.sfx('ding'); B.popAt(p, 0, -50, 'DING!');
        const t = B.rect(p, 10, -30, 28, 26, { density: 0.003, sound: 'thud', emoji: '🍞', emojiSize: 32 });
        t.rg.emitter = p; B.vel(p, t, 2.8, -12); B.spin(p, t, 0.15);
        B.emit(p, 'noise', { radius: 400 });
      });
    },
  });

  RG.def({
    id: 'cannon', name: 'Cannon', emoji: '💣', cat: 'Fire & Light', inputs: ['fire'], outputs: ['push', 'roll', 'noise'],
    desc: 'Light the fuse. BOOM. A cannonball flies out sideways.',
    inZone: { x: -46, y: -10, w: 34, h: 34 }, out: { x: 210, y: -12 },
    build(p) {
      shelf(p, 0, 30, 110);
      B.rect(p, 4, 0, 90, 34, { static: true, draw(ctx) {
        const t = since(p); const k = t >= 0 && t < 0.3 ? (0.3 - t) * 30 : 0;
        ctx.translate(-k, 0);
        ctx.fillStyle = '#2f3542'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-42, -14); ctx.lineTo(44, -10); ctx.lineTo(44, 10); ctx.lineTo(-42, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#57606f'; ctx.fillRect(38, -13, 8, 26);
        ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(-14, 18, 13, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -6); ctx.quadraticCurveTo(-52, -16, -48, -22); ctx.stroke();
      } });
    },
    trigger(p) {
      B.sfx('sizzle');
      B.later(0.7, () => {
        const cb = ball(p, 56, -2, 14, '#2f3542', { density: 0.014, heavy: true, sound: 'thud', frictionAir: 0.004 });
        cb.rg.emitter = p; B.vel(p, cb, 13, -2.6);
        B.sfx('boom'); B.shake(18); B.popAt(p, 70, -40, 'BOOM!', { size: 50, color: '#ff9f43' });
        B.burstAt(p, 56, 0, 30, { type: 'smoke', colors: ['rgba(180,180,190,0.6)', 'rgba(120,120,130,0.6)'], speed: 3, angle: 0, spread: 1.2, gravity: -0.02, life: 1.6, size: 12 });
        B.burstAt(p, 56, 0, 20, { colors: ['#ffe14d', '#ff9f43', '#ff4d4d'], speed: 8, angle: 0, spread: 0.8 });
        B.emit(p, 'noise', { at: { x: 50, y: 0 } });
      });
    },
  });

  RG.def({
    id: 'rocket', name: 'Bottle Rocket', emoji: '🚀', cat: 'Fire & Light', inputs: ['fire'], outputs: ['push', 'noise'],
    desc: 'Light the tail and it screams sideways into whatever is in front.',
    inZone: { x: -44, y: 0, w: 30, h: 34 }, out: { x: 250, y: -16 },
    build(p) {
      shelf(p, 0, 18, 100);
      p.s.r = B.rect(p, 0, 0, 52, 16, { density: 0.002, frictionAir: 0.02, sound: 'thud', draw(ctx) {
        ctx.fillStyle = '#eceff4'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-24, -7); ctx.lineTo(14, -7); ctx.quadraticCurveTo(28, 0, 14, 7); ctx.lineTo(-24, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.moveTo(-24, -7); ctx.lineTo(-32, -14); ctx.lineTo(-16, -7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-24, 7); ctx.lineTo(-32, 14); ctx.lineTo(-16, 7); ctx.fill();
        ctx.fillStyle = '#4fc3ff'; ctx.beginPath(); ctx.arc(2, 0, 3.5, 0, 7); ctx.fill();
        if (p.s.thrust > 0) R.flame(ctx, -32, 0, 7, E.time);
      } });
    },
    trigger(p) { B.sfx('sizzle'); B.later(0.4, () => { p.s.thrust = 1.1; B.sfx('rocket'); B.popAt(p, 0, -30, 'WHEEE!'); B.emit(p, 'noise', { radius: 420 }); }); },
    update(p) {
      if (!(p.s.thrust > 0)) return;
      p.s.thrust -= 1 / 60;
      const r = p.s.r, a = r.angle;
      const f = r.mass * 0.0026;
      Body.applyForce(r, r.position, { x: Math.cos(a) * f * p.dir, y: Math.sin(a) * f * p.dir - r.mass * 0.00085 });
      Body.setAngularVelocity(r, r.angularVelocity * 0.8);
      const back = { x: r.position.x - Math.cos(a) * 30 * p.dir, y: r.position.y - Math.sin(a) * 30 * p.dir };
      B.burst(back.x, back.y, 2, { colors: ['#ffe14d', '#ff9f43', '#ffffff'], speed: 2, life: 0.4 });
      B.burst(back.x, back.y, 1, { type: 'smoke', colors: ['rgba(200,200,210,0.4)'], speed: 0.5, gravity: -0.02, life: 1, size: 7 });
    },
  });

  // Levers that topple over when triggered (pin on a stick, sunflower, beanstalk).
  // Driven around their pivot directly: a pinned joint in the physics engine is unstable here and
  // sends the stick spinning. The stick is still a real moving body, so it hits and shoves things.
  function toppler(p, len, o) {
    const pv = p.toWorld(0, 0);
    const tip = B.rawCircle(p, 0, -len + 6, o.tipR || 7, {});
    const stick = B.rawRect(p, 0, -len / 2, o.w || 8, len, {});
    tip.rgFill = o.tipFill || METAL; stick.rgFill = o.fill || WOOD;
    const body = B.compound(p, [stick, tip], { fill: o.fill || WOOD, tags: o.tags, density: o.density || 0.002, friction: 0.5, sound: 'thud', draw: o.draw, frictionAir: 0 });
    const group = Body.nextGroup(true);
    body.collisionFilter.group = group;
    for (const q of p.bodies) if (q.isStatic) q.collisionFilter.group = group;
    B.circle(p, 0, 0, 4.5, { static: true, sensor: true, fill: '#d8dde6' });
    body.rg.topple = { pv, off: { x: body.position.x - pv.x, y: body.position.y - pv.y }, th: 0, w: 0, active: false, max: o.max || 1.45 };
    Body.setStatic(body, true);
    return body;
  }
  function startTopple(p, body, w0) {
    const t = body.rg.topple; if (!t || t.active || t.done) return;
    Body.setStatic(body, false); t.active = true; t.w = w0;
  }
  function driveTopple(p, body) {
    const t = body && body.rg.topple; if (!t || !t.active) return;
    const pose = th => {
      const a = th * p.dir, c = Math.cos(a), s = Math.sin(a);
      return { x: t.pv.x + t.off.x * c - t.off.y * s, y: t.pv.y + t.off.x * s + t.off.y * c, angle: p.angle + a };
    };
    t.w += 0.0045 * Math.sin(t.th + 0.15);
    let next = t.th + t.w;
    if (next >= t.max) next = t.max;
    const cur = pose(t.th), nxt = pose(next);
    Body.setPosition(body, cur); Body.setAngle(body, cur.angle);
    Body.setVelocity(body, { x: nxt.x - cur.x, y: nxt.y - cur.y });
    Body.setAngularVelocity(body, nxt.angle - cur.angle);
    t.th = next;
    if (next >= t.max) {
      t.active = false; t.done = true;
      Body.setPosition(body, nxt); Body.setAngle(body, nxt.angle); Body.setStatic(body, true);
      B.sfx('thud', 0.8); B.shake(2);
    }
  }
  RG.helpers.toppler = toppler;

  RG.def({
    id: 'pin_lever', name: 'Pin on a Stick', emoji: '📌', cat: 'Pokey Things', inputs: ['push', 'roll', 'drop'], outputs: ['sharp'],
    desc: 'A stick with a pin taped to the end. Knock it and the pin swings down to stab.',
    inZone: { x: -6, y: -40, w: 30, h: 80 }, out: { x: 48, y: -16 }, placeOffset: { sharp: { x: 22, y: 6 } },
    build(p) {
      B.rect(p, 0, 8, 40, 12, { static: true, fill: WOOD_D, mount: true });
      p.s.stick = toppler(p, 86, { tags: ['sharp'], tipR: 5, draw(ctx, b) {
        ctx.rotate(-b.angle); ctx.rotate(b.angle);
        // drawn via compound fill below
      } });
      p.s.stick.rg.draw = null; p.s.stick.rg.fill = WOOD;
      p.s.stick.rg.emoji = null;
    },
    drawFront(p, ctx) {
      const b = p.s.stick; if (!b) return;
      const tip = b.parts[2] || b.parts[1];
      ctx.save(); ctx.translate(tip.position.x, tip.position.y); ctx.rotate(b.angle);
      ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(0, 2, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -16); ctx.stroke();
      ctx.restore();
    },
    trigger(p) { startTopple(p, p.s.stick, 0.05); B.sfx('creak'); },
    update(p) { driveTopple(p, p.s.stick); },
  });

  RG.def({
    id: 'scissors', name: 'Snippy Scissors', emoji: '✂️', cat: 'Pokey Things', inputs: ['push', 'drop', 'pull', 'zap'], outputs: ['sharp'],
    desc: 'Spring-loaded scissors. Bonk the handle and they snap shut on whatever is in front.',
    inZone: { x: -20, y: 0, w: 50, h: 50 }, out: { x: 40, y: 0 }, placeOffset: { sharp: { x: 16, y: 0 } },
    build(p) { shelf(p, -10, 24, 60); B.rect(p, -6, 0, 50, 34, { static: true, emoji: '✂️', emojiSize: 46, emojiRot: Math.PI / 4 * 0 }); },
    trigger(p) {
      B.sfx('snip'); B.popAt(p, 30, -30, 'SNIP!');
      const s = B.rect(p, 44, 0, 52, 46, { static: true, sensor: true, tags: ['sharp'], hidden: true });
      B.later(0.8, () => B.remove(p, s));
      B.burstAt(p, 40, 0, 10, { colors: ['#e0e6f0', '#ffffff'], speed: 4 });
    },
  });

  RG.def({
    id: 'dart_gun', name: 'Dart Launcher', emoji: '🎯', cat: 'Pokey Things', inputs: ['pull', 'zap'], outputs: ['sharp'],
    desc: 'Fires a pointy dart in a straight line.',
    inZone: { x: 0, y: 0, w: 70, h: 50 }, out: { x: 190, y: -6 },
    build(p) {
      shelf(p, 0, 20, 70);
      B.rect(p, 0, 0, 60, 26, { static: true, draw(ctx) {
        ctx.fillStyle = '#2d6cdf'; ctx.strokeStyle = '#0c1a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-30, -13, 60, 26, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(22, -6, 12, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DART-O', -4, 4);
      } });
    },
    trigger(p) {
      B.sfx('pew'); B.popAt(p, 0, -34, 'PEW!');
      const d = B.rect(p, 50, -1, 36, 5, { density: 0.003, frictionAir: 0.001, tags: ['sharp'], noAssist: false, draw(ctx) {
        ctx.fillStyle = '#e0e6f0'; ctx.fillRect(4, -1.5, 14, 3); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(-18, -2.5, 22, 5);
        ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-24, -7); ctx.lineTo(-12, 0); ctx.lineTo(-24, 7); ctx.fill();
      } });
      d.rg.emitter = p; B.vel(p, d, 15, -1.6);
    },
  });

  RG.def({
    id: 'wine_glass', name: 'Fancy Wine Glass', emoji: '🍷', cat: 'Pokey Things', inputs: ['noise'], outputs: ['sharp', 'noise'],
    desc: 'A delicate glass. A loud noise shatters it into flying shards.',
    inZone: { x: 0, y: 0, w: 50, h: 70 }, out: { x: 40, y: -6 }, placeOffset: { sharp: { x: 40, y: 6 } },
    build(p) { shelf(p, 0, 32, 54); p.s.g = B.rect(p, 0, 0, 34, 54, { static: true, emoji: '🍷', emojiSize: 52 }); },
    trigger(p) {
      B.later(0.15, () => {
        B.remove(p, p.s.g); B.sfx('tinkle'); B.popAt(p, 0, -40, 'CRASH!', { color: '#e0e6f0' });
        for (let i = 0; i < 7; i++) {
          const s = B.poly(p, 6 + i * 2, -10 + i * 3, 3, 7, { density: 0.002, tags: ['sharp'], fill: 'rgba(220,240,255,0.85)', stroke: '#9fb3c8', sound: 'clink' });
          s.rg.emitter = p; B.vel(p, s, 3 + E.rand() * 4, -3 - E.rand() * 4); Body.setAngularVelocity(s, (E.rand() - 0.5) * 0.5);
        }
        B.emit(p, 'noise', { radius: 300 });
      });
    },
  });

  RG.def({
    id: 'hedgehog', name: 'Startled Hedgehog', emoji: '🦔', cat: 'Critters', inputs: ['noise'], outputs: ['sharp', 'roll'],
    desc: 'Napping on a slope. A loud noise makes it curl into a spiky ball and roll away.',
    inZone: { x: -40, y: -10, w: 60, h: 50 }, out: { x: 124, y: 10 },
    build(p) {
      B.rect(p, 34, 20, 180, 10, { static: true, fill: WOOD, mount: true, angle: 0.14 });
      p.s.chock = B.rect(p, -18, 2, 6, 14, { static: true, fill: WOOD_D });
      p.s.h = B.circle(p, -40, -8, 17, { density: 0.004, friction: 0, frictionAir: 0.005, sound: 'thud', roll: true, draw(ctx, b) {
        if (!p.fired) { ctx.rotate(-b.angle); R.emoji(ctx, '🦔', 0, -2, 38, 0, p.dir === 1); if (E.mode === 'run' && Math.random() < 0.01) B.burst(b.position.x, b.position.y - 20, 1, { type: 'text', text: '💤', speed: 0.5, gravity: -0.02, life: 1.5, size: 16 }); return; }
        ctx.fillStyle = '#7a5532'; ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, r = i % 2 ? 13 : 20; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#2b1a0a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#c69c6d'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      } });
    },
    trigger(p) {
      B.later(0.2, () => { p.s.h.rg.tags.add('sharp'); B.remove(p, p.s.chock); B.vel(p, p.s.h, 2.2, -1); B.sfx('squeak'); B.popAt(p, -40, -40, 'EEP!'); });
    },
  });

  // ================================================================= SNAPS, SWITCHES, NOISEMAKERS
  RG.def({
    id: 'mousetrap', name: 'Mousetrap', emoji: '🪤', cat: 'Sparks & Strings', inputs: ['push', 'roll', 'drop'], outputs: ['pull', 'noise'],
    desc: 'Touch the trigger and SNAP! The bar flips and yanks a string.',
    inZone: { x: 0, y: -8, w: 76, h: 30 }, out: { x: 36, y: -4 },
    build(p) { B.rect(p, 0, 8, 74, 12, { static: true, fill: '#d9a066', mount: true }); },
    drawFront(p, ctx) {
      ctx.save(); R.local(ctx, p);
      const t = since(p); const a = t < 0 ? 0 : Math.min(Math.PI, ease(t / 0.08) * Math.PI);
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3;
      ctx.save(); ctx.translate(0, 2); ctx.rotate(-a); ctx.strokeRect(-30, -2, 30, 1); ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-30, -4); ctx.lineTo(0, -4); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(10, -1, 16, 4); R.emoji(ctx, '🧀', 22, -8, 14);
      ctx.restore();
    },
    trigger(p) { B.sfx('snap'); B.shake(4); B.popAt(p, 0, -30, 'SNAP!'); B.later(0.08, () => { B.emit(p, 'pull'); B.emit(p, 'noise', { radius: 420 }); }); },
  });

  RG.def({
    id: 'bucket', name: 'Bucket Counterweight', emoji: '🪣', cat: 'Air & Water', inputs: ['drop', 'pour'], outputs: ['pull'], pourNeed: 8,
    desc: 'A bucket on a pulley. When it gets heavy (something lands in it, or it fills up) it sinks and pulls a rope.',
    inZone: { x: 0, y: 2, w: 84, h: 54 }, out: { x: 0, y: -72 },
    build(p) {
      p.s.parts = [
        B.rect(p, 0, 28, 74, 6, { static: true, fill: '#8fa3b8' }),
        B.rect(p, -36, 6, 6, 50, { static: true, fill: '#8fa3b8', angle: -0.14 }),
        B.rect(p, 36, 6, 6, 50, { static: true, fill: '#8fa3b8', angle: 0.14 }),
      ];
      B.rect(p, 0, -72, 24, 24, { static: true, sensor: true, mount: true, draw(ctx) { ctx.fillStyle = METAL; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); } });
      p.s.dy = 0;
    },
    drawBack(p, ctx) {
      const top = p.toWorld(0, -72), l = p.toWorld(-38, -18 + p.s.dy), r = p.toWorld(38, -18 + p.s.dy);
      ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(top.x, top.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    },
    trigger(p) {
      B.sfx('creak'); B.popAt(p, 0, -40, 'CLUNK!');
      let k = 0; const step = () => { k++; p.s.dy += 2; p.s.parts.forEach(b => Body.setPosition(b, { x: b.position.x, y: b.position.y + 2 })); if (k < 26) B.later(1 / 60, step); };
      step();
      B.later(0.2, () => B.emit(p, 'pull'));
    },
  });

  RG.def({
    id: 'pressure_plate', name: 'Pressure Plate', emoji: '🟥', cat: 'Sparks & Strings', inputs: ['push', 'roll', 'drop'], outputs: ['zap'],
    desc: 'A big switch on the floor of the wall. Anything that bumps it closes the circuit.',
    inZone: { x: 0, y: -10, w: 74, h: 30 }, out: { x: 36, y: 6 },
    build(p) {
      B.rect(p, 0, 10, 74, 10, { static: true, fill: '#3d4352', mount: true });
      p.s.plate = B.rect(p, 0, 1, 62, 8, { static: true, fill: '#ff4d4d' });
    },
    trigger(p) { Body.setPosition(p.s.plate, p.toWorld(0, 4)); p.s.plate.rg.fill = '#7dfcff'; B.sfx('click'); B.popAt(p, 0, -24, 'CLICK!', { size: 24 }); B.emit(p, 'zap'); },
  });

  RG.def({
    id: 'gong', name: 'Gong', emoji: '🥁', cat: 'Sparks & Strings', inputs: ['push', 'roll', 'drop'], outputs: ['noise'],
    desc: 'Hit it with anything. GONNNG. Everything nearby hears it.',
    inZone: { x: 0, y: -12, w: 92, h: 106 }, out: { x: 0, y: 0 },
    build(p) {
      B.rect(p, 0, -50, 90, 8, { static: true, fill: '#8b1e1e', mount: true });
      p.s.g = B.circle(p, 0, 0, 32, { static: true, restitution: 0.5, draw(ctx) {
        const t = since(p); const w = t >= 0 && t < 1.5 ? Math.sin(t * 40) * 0.08 * (1.5 - t) : 0;
        ctx.scale(1 + w, 1 - w);
        const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 32); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#e0a526'); g.addColorStop(1, '#8a5a0a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.fill(); ctx.strokeStyle = '#4a2f05'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(80,40,0,0.4)'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
      } });
    },
    drawBack(p, ctx) { ctx.save(); R.local(ctx, p); ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, -46); ctx.lineTo(-18, -26); ctx.moveTo(30, -46); ctx.lineTo(18, -26); ctx.stroke(); ctx.restore(); },
    trigger(p) { B.sfx('gong'); B.shake(6); B.popAt(p, 0, -60, 'GONNNG!', { size: 40 }); B.emit(p, 'noise', { radius: 760 }); },
  });

  device({ id: 'cymbal_monkey', name: 'Cymbal Monkey', emoji: '🐒', cat: 'Critters', inputs: ['zap'], outputs: ['noise'], desc: 'A wind-up monkey. Zap it and it bashes its cymbals.', sfx: 'cymbal', word: 'CRASH!', faceLeft: true,
    onTrigger(p) { p.shakeT = 0.9; } });
  device({ id: 'clap_switch', name: 'Clap Switch', emoji: '👏', cat: 'Sparks & Strings', inputs: ['noise'], outputs: ['zap'], desc: 'A sound-activated switch. Any loud noise turns the power on.', sfx: 'clap', word: 'CLAP CLAP!', fill: '#f4efe2', size: 34, w: 50, h: 44, wordSize: 24 });
  device({ id: 'doorbell', name: 'Doorbell', emoji: '🔔', cat: 'Sparks & Strings', inputs: ['zap'], outputs: ['noise'], desc: 'Ding dong! Zap it and it rings loud.', sfx: 'ding', word: 'DING DONG!', onTrigger(p) { B.later(0.3, () => B.sfx('chime')); p.shakeT = 0.6; } });
  device({ id: 'party_popper', name: 'Party Popper', emoji: '🎉', cat: 'Sparks & Strings', inputs: ['pull'], outputs: ['noise'], desc: 'Pull the string: BANG and confetti everywhere.', sfx: 'pop', word: 'POP!',
    onTrigger(p) { B.sfx('bang'); B.burstAt(p, 20, -10, 50, { type: 'confetti', angle: -0.6, spread: 1.4, speed: 9 }); } });

  // ================================================================= CRITTERS
  RG.def({
    id: 'sleeping_cat', name: 'Sleeping Cat', emoji: '🐈', cat: 'Critters', inputs: ['noise', 'pour'], outputs: ['push', 'noise'], pourNeed: 4,
    desc: 'Fast asleep on a cushion. A loud noise or a splash of water makes it leap forward, yowling.',
    inZone: { x: 0, y: -4, w: 76, h: 54 }, out: { x: 120, y: 0 },
    build(p) {
      B.rect(p, 0, 22, 80, 12, { static: true, fill: '#7a3fb0', chamfer: 6, mount: true });
      p.s.cat = B.rect(p, 0, -2, 56, 36, { density: 0.003, friction: 0.5, sound: 'thud', draw(ctx, b) {
        ctx.rotate(-b.angle * 0.5);
        R.emoji(ctx, p.fired ? '🙀' : '🐈', 0, -2, 46, 0, p.fired ? false : (p.dir === 1));
      } });
    },
    update(p) { if (!p.fired && E.mode === 'run' && Math.random() < 0.012) { const c = p.toWorld(14, -30); B.burst(c.x, c.y, 1, { type: 'text', text: '💤', speed: 0.6, angle: -1.2, spread: 0.3, gravity: -0.02, life: 1.6, size: 18 }); } },
    trigger(p) {
      B.later(0.15, () => { B.sfx('meow'); B.popAt(p, 0, -50, 'MRROWW!', { color: '#ffb3e6' }); B.vel(p, p.s.cat, 6.2, -8.5); B.spin(p, p.s.cat, 0.1); B.emit(p, 'noise', { radius: 380 }); });
    },
  });

  RG.def({
    id: 'guard_dog', name: 'Guard Dog', emoji: '🐕', cat: 'Critters', inputs: ['noise'], outputs: ['pull', 'noise'],
    desc: 'Hears a noise, bolts out of the doghouse barking, and yanks its leash.',
    inZone: { x: 0, y: 0, w: 110, h: 70 }, out: { x: 60, y: 10 },
    build(p) {
      shelf(p, 0, 34, 120);
      B.rect(p, -30, 0, 54, 58, { static: true, draw(ctx) {
        ctx.fillStyle = '#c0392b'; ctx.strokeStyle = '#2a0e0a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(0, -32); ctx.lineTo(30, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8b27a'; ctx.fillRect(-25, -10, 50, 40); ctx.strokeRect(-25, -10, 50, 40);
        ctx.fillStyle = '#2a1a0a'; ctx.beginPath(); ctx.arc(0, 14, 12, Math.PI, 0); ctx.lineTo(12, 30); ctx.lineTo(-12, 30); ctx.fill();
      } });
    },
    drawFront(p, ctx) {
      ctx.save(); R.local(ctx, p);
      const t = since(p); const x = t < 0 ? -20 : -20 + ease(t / 0.4) * 70;
      R.emoji(ctx, '🐕', x, 12, 40, 0, true);
      ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, 12); ctx.lineTo(-30, 20); ctx.stroke();
      ctx.restore();
    },
    trigger(p) { B.sfx('woof'); B.popAt(p, 10, -40, 'WOOF WOOF!'); B.later(0.35, () => { B.emit(p, 'pull'); B.emit(p, 'noise', { radius: 400 }); }); },
  });

  device({ id: 'rooster', name: 'Rooster', emoji: '🐓', cat: 'Critters', inputs: ['light'], outputs: ['noise'], desc: 'Thinks the sun is up whenever light hits it. Crows very loudly.', sfx: 'rooster', word: 'COCKADOODLEDOO!', wordSize: 26, faceLeft: true, delay: 0.4,
    onTrigger(p) { p.shakeT = 1; } });

  RG.def({
    id: 'hamster_wheel', name: 'Hamster Wheel', emoji: '🐹', cat: 'Critters', inputs: ['noise', 'light'], outputs: ['pull'],
    desc: 'A startled hamster sprints in its wheel and winds up a string.',
    inZone: { x: 0, y: 0, w: 80, h: 80 }, out: { x: 40, y: -20 },
    build(p) { shelf(p, 0, 42, 70); B.circle(p, 0, 0, 34, { static: true, sensor: true, draw(ctx) {
      const t = since(p); const rot = t < 0 ? 0 : t * t * 6;
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.stroke();
      ctx.save(); ctx.rotate(rot); ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(32, 0); ctx.stroke(); } ctx.restore();
      R.emoji(ctx, '🐹', 0, 16, 28, t < 0 ? 0 : Math.sin(t * 30) * 0.2);
    } }); },
    trigger(p) { B.sfx('squeak'); B.popAt(p, 0, -50, 'SQUEAK!'); B.later(0.6, () => B.emit(p, 'pull')); },
  });

  // ================================================================= PLANTS & WATER
  RG.def({
    id: 'sunflower', name: 'Sunflower', emoji: '🌻', cat: 'Fire & Light', inputs: ['light', 'pour'], outputs: ['push'], pourNeed: 5,
    desc: 'Light or water makes it lurch toward the sun, bonking whatever is in front of it.',
    inZone: { x: 0, y: -60, w: 70, h: 90 }, out: { x: 60, y: -40 },
    build(p) {
      B.rect(p, 0, 12, 36, 24, { static: true, fill: '#c0663a', mount: true });
      p.s.s = toppler(p, 96, { fill: '#3aa655', tipFill: '#3aa655', tipR: 10, w: 6, density: 0.003 });
    },
    drawFront(p, ctx) { const b = p.s.s; const tip = b.parts[2]; R.emoji(ctx, '🌻', tip.position.x, tip.position.y, 38, b.angle); },
    trigger(p) { B.sfx('chime'); B.popAt(p, 0, -120, 'BLOOM!', { color: '#ffd34d' }); startTopple(p, p.s.s, 0.05); },
    update(p) { driveTopple(p, p.s.s); },
  });

  RG.def({
    id: 'beanstalk', name: 'Magic Beanstalk', emoji: '🌱', cat: 'Air & Water', inputs: ['pour'], outputs: ['push'], pourNeed: 6,
    desc: 'Add water and it shoots up into a giant stalk, then flops over onto whatever is nearby.',
    inZone: { x: 0, y: -20, w: 60, h: 50 }, out: { x: 90, y: -80 },
    build(p) {
      B.trapezoid(p, 0, 14, 44, 30, 0.3, { static: true, fill: '#c0663a', mount: true });
      p.s.sprout = B.rect(p, 0, -10, 20, 20, { static: true, sensor: true, emoji: '🌱', emojiSize: 26 });
    },
    update(p) { driveTopple(p, p.s.stalk); },
    trigger(p) {
      B.sfx('grow'); B.popAt(p, 0, -60, 'SPROUT!', { color: '#7bed9f' }); B.remove(p, p.s.sprout);
      p.s.growT = 0;
      B.later(0.9, () => {
        p.s.stalk = toppler(p, 146, { fill: '#2e8b3e', tipFill: '#3aa655', tipR: 9, w: 12, density: 0.004 });
        startTopple(p, p.s.stalk, 0.04); p.s.growT = null;
      });
    },
    drawFront(p, ctx) {
      if (p.s.growT != null && p.fired) {
        const k = Math.min(1, since(p) / 0.9);
        ctx.save(); R.local(ctx, p); ctx.fillStyle = '#2e8b3e'; ctx.fillRect(-6, -146 * k, 12, 146 * k);
        for (let i = 1; i < 5; i++) { if (k * 146 > i * 30) R.emoji(ctx, '🍃', i % 2 ? 12 : -12, -i * 30, 18); }
        ctx.restore();
      }
      if (p.s.stalk) { const b = p.s.stalk; for (let i = 1; i < 5; i++) { const c = { x: b.position.x, y: b.position.y }; } const tip = b.parts[2]; R.emoji(ctx, '🍃', tip.position.x, tip.position.y, 22, b.angle); }
    },
  });

  RG.def({
    id: 'rubber_duck', name: 'Rubber Duck Float', emoji: '🦆', cat: 'Air & Water', inputs: ['pour'], outputs: ['push'], pourNeed: 8,
    desc: 'A duck in a tube. Pour water in and the duck floats up and pops out the top.',
    inZone: { x: 0, y: -10, w: 50, h: 60 }, out: { x: 100, y: -20 },
    build(p) {
      B.rect(p, -24, 0, 6, 80, { static: true, fill: 'rgba(200,230,255,0.6)' });
      B.rect(p, 24, 0, 6, 80, { static: true, fill: 'rgba(200,230,255,0.6)' });
      B.rect(p, 0, 42, 54, 6, { static: true, fill: WOOD, mount: true });
    },
    drawFront(p, ctx) { if (!p.s.launched) { const t = since(p); const y = t < 0 ? 22 : 22 - ease(t / 0.6) * 60; const c = p.toWorld(0, y); R.emoji(ctx, '🦆', c.x, c.y, 34, 0, p.dir === 1); } },
    trigger(p) {
      B.sfx('squeak');
      B.later(0.6, () => {
        p.s.launched = true; B.popAt(p, 0, -60, 'QUACK!');
        const d = B.rect(p, 0, -48, 34, 30, { density: 0.003, sound: 'squeak', emoji: '🦆', emojiSize: 34, faceLeft: true });
        d.rg.emitter = p; B.vel(p, d, 4.2, -8);
      });
    },
  });

  RG.def({
    id: 'sponge', name: 'Thirsty Sponge', emoji: '🧽', cat: 'Air & Water', inputs: ['pour'], outputs: ['drop'], pourNeed: 8,
    desc: 'Soaks up water until it is so heavy that its flimsy shelf gives way.',
    inZone: { x: 0, y: -10, w: 60, h: 46 }, out: { x: 0, y: 50 },
    build(p) {
      shelf(p, -40, 20, 20);
      p.s.sh = B.rect(p, 6, 20, 64, 6, { static: true, fill: '#d9b77a' });
      p.s.sp = B.rect(p, 0, 2, 44, 28, { density: 0.006, heavy: true, sound: 'gloop', friction: 0.9, emoji: '🧽', emojiSize: 44 });
    },
    trigger(p) { B.sfx('gloop'); B.popAt(p, 0, -40, 'SLURP!', { color: '#ffe14d' }); B.later(0.5, () => { B.remove(p, p.s.sh); B.sfx('creak'); p.s.drop = E.time; }); },
    drawFront(p, ctx) { if (p.s.drop) { const t = E.time - p.s.drop; ctx.save(); R.local(ctx, p); ctx.translate(-26, 20); ctx.rotate(Math.min(1.4, t * 6)); ctx.fillStyle = '#d9b77a'; ctx.fillRect(0, -3, 64, 6); ctx.restore(); } },
  });

  RG.def({
    id: 'water_wheel', name: 'Water Wheel', emoji: '⚙️', cat: 'Air & Water', inputs: ['pour'], outputs: ['zap'], pourNeed: 8,
    desc: 'Pour water on the paddles and it spins a little generator.',
    inZone: { x: 0, y: -10, w: 80, h: 60 }, out: { x: 44, y: 0 },
    build(p) {
      B.rect(p, 0, 50, 30, 10, { static: true, fill: WOOD_D, mount: true });
      B.circle(p, 0, 0, 12, { static: true, draw(ctx) {
        const t = since(p); const rot = t < 0 ? 0 : t * 5;
        ctx.save(); ctx.rotate(rot); ctx.fillStyle = WOOD; ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(10, -4, 28, 8); ctx.strokeRect(10, -4, 28, 8); }
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(28, -6, 16, 12); ctx.fillStyle = '#222'; ctx.font = 'bold 10px system-ui'; ctx.fillText('⚡', 30, 4);
      } });
    },
    trigger(p) { B.sfx('hum'); B.popAt(p, 0, -50, 'WHIRRR!', { color: '#7dfcff' }); B.later(0.7, () => B.emit(p, 'zap')); },
  });

  RG.def({
    id: 'watering_can', name: 'Watering Can', emoji: '🫗', cat: 'Air & Water', inputs: ['push', 'roll', 'drop'], outputs: ['pour'],
    desc: 'Knock it and it tips forward, pouring water out of its spout.',
    inZone: { x: -14, y: -4, w: 50, h: 50 }, out: { x: 44, y: 10 }, placeOffset: { pour: { x: 40, y: 120 } },
    build(p) { shelf(p, 0, 26, 70); p.s.can = B.rect(p, 0, 0, 46, 40, { static: true, emoji: '🫗', emojiSize: 46, faceLeft: false }); },
    trigger(p) { Body.setAngle(p.s.can, p.wa(0.5)); B.sfx('splash'); B.popAt(p, 0, -40, 'GLUG GLUG!', { color: '#4fc3ff', size: 26 }); B.pour(p, 30, 6, 40, { vx: 1.8, vy: 0.8, every: 0.03 }); },
  });

  RG.def({
    id: 'faucet', name: 'Faucet', emoji: '🚰', cat: 'Air & Water', inputs: ['pull', 'zap'], outputs: ['pour'],
    desc: 'A wall tap. Yank the handle or zap the valve and water pours straight down.',
    inZone: { x: 0, y: 0, w: 70, h: 50 }, out: { x: 22, y: 26 },
    build(p) { B.rect(p, 0, 0, 56, 40, { static: true, draw(ctx) {
      ctx.fillStyle = '#c9ced8'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 2;
      ctx.fillRect(-28, -8, 20, 16); ctx.strokeRect(-28, -8, 20, 16);
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(18, -8); ctx.quadraticCurveTo(28, -8, 28, 4); ctx.lineTo(28, 18); ctx.lineTo(16, 18); ctx.lineTo(16, 6); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      const a = p.fired ? -1.2 : 0; ctx.save(); ctx.translate(2, -10); ctx.rotate(a); ctx.fillStyle = '#e8453c'; ctx.fillRect(-12, -5, 24, 6); ctx.restore();
    } }); },
    trigger(p) { B.sfx('splash'); B.popAt(p, 0, -40, 'SHHHH!', { color: '#4fc3ff' }); B.pour(p, 22, 22, 45, { vy: 2, vx: 0, every: 0.03, spread: 8 }); },
  });

  RG.def({
    id: 'ice_block', name: 'Ice Block', emoji: '🧊', cat: 'Air & Water', inputs: ['fire'], outputs: ['pour'], burnTime: 0.25,
    desc: 'Heat it and it melts into a stream of water.',
    inZone: { x: 0, y: 0, w: 70, h: 70 }, out: { x: 0, y: 40 },
    build(p) { shelf(p, -30, 32, 22); shelf(p, 30, 32, 22); p.s.ice = B.rect(p, 0, 4, 60, 46, { static: true, draw(ctx) {
      const k = p.s.melt || 0; ctx.scale(1 - k * 0.7, 1 - k * 0.8); ctx.globalAlpha = 1 - k * 0.6;
      ctx.fillStyle = 'rgba(190,235,255,0.9)'; ctx.strokeStyle = '#5aa9d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-30, -23, 60, 46, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-22, -16, 10, 4); ctx.fillRect(-22, -10, 4, 10);
    } }); },
    trigger(p) { B.sfx('sizzle'); B.popAt(p, 0, -40, 'DRIP DRIP!', { color: '#bfe9ff', size: 26 }); p.s.meltStart = E.time; B.pour(p, 0, 30, 34, { vy: 1, every: 0.045, spread: 18 }); },
    update(p) { if (p.s.meltStart) p.s.melt = Math.min(1, (E.time - p.s.meltStart) / 1.6); },
  });

  RG.def({
    id: 'sandbag', name: 'Sandbag', emoji: '🟫', cat: 'Pokey Things', inputs: ['sharp'], outputs: ['pour'],
    desc: 'Poke a hole in the burlap and a stream of sand pours out.',
    inZone: { x: 0, y: 0, w: 70, h: 70 }, out: { x: 0, y: 36 },
    build(p) { B.rect(p, 0, -50, 30, 8, { static: true, fill: METAL, mount: true }); B.rect(p, 0, 0, 52, 60, { static: true, sensor: true, draw(ctx) {
      ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -28); ctx.stroke();
      const k = p.fired ? Math.min(1, since(p) / 2) : 0;
      ctx.fillStyle = '#b08b57'; ctx.strokeStyle = '#3b2a12'; ctx.beginPath(); ctx.moveTo(-8, -28); ctx.quadraticCurveTo(-28 + k * 8, 0, -22 + k * 6, 26 - k * 10); ctx.lineTo(22 - k * 6, 26 - k * 10); ctx.quadraticCurveTo(28 - k * 8, 0, 8, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2a12'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('SAND', 0, 8);
    } }); },
    trigger(p) { B.sfx('snip'); B.sfx('sizzle'); B.popAt(p, 0, -40, 'SHHHHH!', { color: '#d9b26f' }); B.pour(p, 0, 26, 50, { liquid: 'sand', vy: 1, every: 0.03 }); },
  });

  // ================================================================= AIR
  function fanDraw(p, col, label) {
    return (ctx) => {
      const t = since(p); const on = t >= 0 && t < 4;
      ctx.fillStyle = '#2f3542'; ctx.fillRect(-6, 10, 12, 20); ctx.fillRect(-18, 26, 36, 6);
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4, 24, 0, 7); ctx.stroke();
      ctx.save(); ctx.translate(0, -4); ctx.rotate(on ? E.time * 30 : 0.3); ctx.fillStyle = col;
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(11, 0, 11, 5, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(220,230,240,0.5)'; ctx.lineWidth = 1; for (let i = -20; i <= 20; i += 8) { ctx.beginPath(); ctx.moveTo(i, -26); ctx.lineTo(i, 18); ctx.stroke(); }
    };
  }
  RG.def({ id: 'desk_fan', name: 'Desk Fan', emoji: '🌀', cat: 'Air & Water', inputs: ['zap'], outputs: ['wind'], desc: 'Plug it in with electricity and it blows a strong breeze.',
    inZone: { x: 0, y: 0, w: 66, h: 70 }, out: { x: 28, y: -4 },
    build(p) { shelf(p, 0, 36, 60); B.rect(p, 0, 0, 52, 60, { static: true, draw: fanDraw(p, '#4fc3ff') }); },
    trigger(p) { B.sfx('whirr'); B.sfx('wind'); B.popAt(p, 0, -46, 'WHOOOSH!', { color: '#b8f0ff' }); B.later(0.2, () => B.emit(p, 'wind', { dur: 3.5 })); } });

  device({ id: 'hair_dryer', name: 'Hair Dryer', emoji: '💨', cat: 'Air & Water', inputs: ['zap'], outputs: ['wind'], desc: 'A blast of hot air when the power comes on.', sfx: 'wind', word: 'VWOOOM!', emits: [['wind', { dur: 3, strength: 1.3 }]],
    w: 60, h: 40, bodyEmoji: null, out: { x: 34, y: -6 },
    bodyDraw(ctx) { ctx.fillStyle = '#ff7eb6'; ctx.strokeStyle = '#3a0f24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-30, -18, 50, 24, 10); ctx.fill(); ctx.stroke(); ctx.fillRect(18, -14, 12, 16); ctx.strokeRect(18, -14, 12, 16); ctx.beginPath(); ctx.roundRect(-14, 4, 12, 22, 4); ctx.fill(); ctx.stroke(); } });

  RG.def({ id: 'bellows', name: 'Bellows', emoji: '🪗', cat: 'Air & Water', inputs: ['drop', 'push', 'pull'], outputs: ['wind'], desc: 'Squash it (drop something on it, shove it or pull its handle) and it puffs a strong gust.',
    inZone: { x: -6, y: -14, w: 70, h: 44 }, out: { x: 44, y: 4 },
    build(p) { shelf(p, 0, 22, 80); B.rect(p, -6, 2, 64, 30, { static: true, draw(ctx) {
      const t = since(p); const sq = t >= 0 && t < 0.6 ? Math.sin(t / 0.6 * Math.PI) : 0;
      ctx.fillStyle = '#8b4513'; ctx.strokeStyle = '#2a1405'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-30, -14 + sq * 10); ctx.lineTo(24, -4 + sq * 3); ctx.lineTo(24, 4); ctx.lineTo(-30, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.moveTo(-26, -10 + sq * 9); ctx.lineTo(18, -2); ctx.lineTo(18, 2); ctx.lineTo(-26, 10); ctx.fill();
      ctx.fillStyle = METAL; ctx.fillRect(24, -3, 16, 6);
    } }); },
    trigger(p) { B.sfx('whoosh'); B.popAt(p, 0, -34, 'PFOOF!', { color: '#b8f0ff' }); B.burstAt(p, 40, 0, 10, { type: 'smoke', colors: ['rgba(230,240,255,0.5)'], angle: 0, spread: 0.5, speed: 4, gravity: 0, size: 6 }); B.later(0.1, () => B.emit(p, 'wind', { dur: 1.4, strength: 1.8 })); } });

  RG.def({ id: 'pepper_nose', name: 'Pepper & Nose', emoji: '🤧', cat: 'Critters', inputs: ['push', 'drop'], outputs: ['wind', 'noise'],
    desc: 'Knock the pepper shaker onto the giant nose. Ah... ah... ACHOO! A huge gust and a huge noise.',
    inZone: { x: -46, y: -20, w: 40, h: 50 }, out: { x: 40, y: 0 },
    build(p) { shelf(p, -46, 14, 40); B.rect(p, -46, -6, 22, 30, { static: true, emoji: '🧂', emojiSize: 30 }); shelf(p, 14, 30, 64); B.rect(p, 14, 0, 56, 50, { static: true, emoji: '👃', emojiSize: 54, faceLeft: false }); },
    trigger(p) {
      B.burstAt(p, -30, -10, 26, { colors: ['#222', '#555', '#888'], speed: 2.5, angle: 0.3, spread: 0.8, size: 2, gravity: 0.05, life: 1.2 });
      B.popAt(p, 14, -50, 'ah… ah…', { size: 22, color: '#fff' });
      B.later(0.9, () => { B.sfx('sneeze'); B.later(0.42, () => { p.shakeT = 0.5; B.shake(10); B.popAt(p, 30, -50, 'ACHOO!!', { size: 48, color: '#7bed9f' }); B.emit(p, 'wind', { dur: 1.3, strength: 2.2 }); B.emit(p, 'noise'); B.burstAt(p, 40, 4, 24, { colors: ['#c8f7c5', '#e9ffe7'], angle: 0, spread: 0.6, speed: 8, size: 3 }); }); });
    } });

  RG.def({ id: 'pinwheel', name: 'Pinwheel Winch', emoji: '🎡', cat: 'Air & Water', inputs: ['wind'], outputs: ['pull'], desc: 'A breeze spins the pinwheel, which reels in a string.',
    inZone: { x: 0, y: -16, w: 70, h: 80 }, out: { x: 30, y: 20 },
    build(p) { B.rect(p, 0, 30, 8, 60, { static: true, fill: WOOD_D, mount: true }); B.circle(p, 0, -20, 28, { static: true, sensor: true, draw(ctx) {
      const t = since(p); ctx.rotate(t < 0 ? 0 : t * t * 10 + t * 4);
      const cols = ['#ff4d6d', '#ffd34d', '#4fc3ff', '#7bed9f'];
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.lineTo(0, -28); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
    } }); },
    trigger(p) { B.sfx('whirr'); B.popAt(p, 0, -60, 'WHIRRR!', { size: 26 }); B.later(0.7, () => B.emit(p, 'pull')); } });

  RG.def({ id: 'sail_cart', name: 'Sail Cart', emoji: '⛵', cat: 'Air & Water', inputs: ['wind'], outputs: ['push', 'roll'], desc: 'A little cart with a sail. Blow on it and it zooms along its shelf.',
    inZone: { x: -40, y: -20, w: 70, h: 70 }, out: { x: 160, y: -6 },
    build(p) { shelf(p, 40, 30, 220); p.s.cart = B.rect(p, -40, 0, 46, 50, { density: 0.002, friction: 0, frictionAir: 0.01, sound: 'thud', draw(ctx) {
      ctx.fillStyle = '#8d5a2b'; ctx.fillRect(-22, 12, 44, 8);
      ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.arc(-14, 22, 5, 0, 7); ctx.arc(14, 22, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-2, -24, 3, 36);
      const t = since(p); const bil = t >= 0 && t < 2 ? 10 : 2;
      ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -24); ctx.quadraticCurveTo(-2 - bil, -6, -2, 10); ctx.lineTo(-22, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    } }); },
    trigger(p) { p.s.boost = 1.6; B.sfx('whoosh'); B.popAt(p, -40, -50, 'AHOY!'); },
    update(p) { if (p.s.boost > 0) { p.s.boost -= 1 / 60; const c = p.s.cart; if (c.velocity.x * p.dir < 6) Body.applyForce(c, c.position, { x: p.dir * c.mass * 0.0009, y: 0 }); } } });

  RG.def({ id: 'paper_plane', name: 'Paper Airplane', emoji: '✈️', cat: 'Air & Water', inputs: ['wind'], outputs: ['push', 'drop'], desc: 'A gust launches it gliding across the gap.',
    inZone: { x: -10, y: -10, w: 60, h: 50 }, out: { x: 240, y: 30 },
    build(p) { shelf(p, 0, 12, 60); p.s.pl = B.rect(p, 0, 0, 40, 12, { density: 0.001, frictionAir: 0.01, friction: 0.3, draw(ctx) {
      ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-20, -8); ctx.lineTo(-12, 0); ctx.lineTo(-20, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-12, 0); ctx.stroke();
    } }); },
    trigger(p) { B.vel(p, p.s.pl, 5.5, -2.5); p.s.glide = 2.6; B.sfx('glide'); B.popAt(p, 0, -30, 'SWOOSH!', { size: 26 }); },
    update(p) { if (p.s.glide > 0) { p.s.glide -= 1 / 60; const b = p.s.pl; Body.applyForce(b, b.position, { x: 0, y: -b.mass * 0.00082 }); Body.setAngle(b, p.wa(Math.atan2(b.velocity.y, Math.abs(b.velocity.x) + 0.01))); } } });

  // ================================================================= FIRE & LIGHT
  RG.def({ id: 'desk_lamp', name: 'Desk Lamp', emoji: '💡', cat: 'Fire & Light', inputs: ['zap', 'pull'], outputs: ['light'], desc: 'Electricity or a tug on the pull-chain switches on a bright beam.',
    inZone: { x: 0, y: 0, w: 70, h: 80 }, out: { x: 30, y: -16 },
    build(p) { shelf(p, 0, 38, 60); B.rect(p, 0, 0, 60, 70, { static: true, draw(ctx) {
      ctx.strokeStyle = '#2f3542'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(-10, 2); ctx.lineTo(10, -20); ctx.stroke();
      ctx.fillStyle = '#2f3542'; ctx.fillRect(-26, 28, 30, 6);
      ctx.save(); ctx.translate(14, -22); ctx.rotate(0.4); ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#3a2a05'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(10, -12); ctx.lineTo(18, 10); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (p.fired) { ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(0, 10, 7, 0, 7); ctx.fill(); }
      ctx.restore();
    } }); },
    trigger(p) { B.sfx('click'); B.popAt(p, 0, -50, 'CLICK!', { size: 24, color: '#fff27a' }); B.later(0.15, () => B.emit(p, 'light', { dur: 7 })); } });

  RG.def({ id: 'window_blinds', name: 'Window Blinds', emoji: '🪟', cat: 'Fire & Light', inputs: ['pull'], outputs: ['light'], desc: 'Pull the cord and the blinds fly up. Sunshine pours in.',
    inZone: { x: 0, y: 0, w: 90, h: 90 }, out: { x: 40, y: 10 },
    build(p) { B.rect(p, 0, 0, 80, 80, { static: true, draw(ctx) {
      ctx.fillStyle = '#8fd3ff'; ctx.fillRect(-36, -36, 72, 72);
      const t = since(p); if (t >= 0) R.emoji(ctx, '☀️', 10, -6, 34);
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 6; ctx.strokeRect(-38, -38, 76, 76); ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 38); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.stroke();
      const k = t < 0 ? 1 : Math.max(0.08, 1 - t * 4);
      ctx.fillStyle = '#e8dcc4'; for (let i = 0; i < 9 * k; i++) { ctx.fillRect(-36, -36 + i * 8, 72, 6); }
      ctx.strokeStyle = '#e8c48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, -36); ctx.lineTo(32, 44); ctx.stroke();
    } }); },
    trigger(p) { B.sfx('whoosh'); B.popAt(p, 0, -56, 'FWIPP!', { color: '#fff27a' }); B.later(0.3, () => B.emit(p, 'light', { dur: 8 })); } });

  device({ id: 'magnifier', name: 'Magnifying Glass', emoji: '🔍', cat: 'Fire & Light', inputs: ['light'], outputs: ['fire'], desc: 'Focuses light to a scorching point. Things in front of it catch fire.', sfx: 'sizzle', word: 'SIZZLE!', delay: 0.4,
    out: { x: 50, y: 6 }, emits: [['fire', { dur: 5, r: 18 }]] });
  RG.def({ id: 'solar_panel', name: 'Solar Panel', emoji: '🔆', cat: 'Fire & Light', inputs: ['light'], outputs: ['zap'], desc: 'Turns light into electricity.',
    inZone: { x: 0, y: 0, w: 80, h: 60 }, out: { x: 40, y: 10 },
    build(p) { B.rect(p, 0, 26, 12, 30, { static: true, fill: '#57606f', mount: true }); B.rect(p, 0, 0, 74, 34, { static: true, angle: -0.2, draw(ctx) {
      ctx.fillStyle = p.fired ? '#3d7bff' : '#22336b'; ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 2; ctx.fillRect(-37, -17, 74, 34); ctx.strokeRect(-37, -17, 74, 34);
      ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1; for (let x = -37; x < 37; x += 12) { ctx.beginPath(); ctx.moveTo(x, -17); ctx.lineTo(x, 17); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-37, 0); ctx.lineTo(37, 0); ctx.stroke();
    } }); },
    trigger(p) { B.sfx('hum'); B.popAt(p, 0, -40, 'CHARGED!', { color: '#7dfcff', size: 26 }); B.later(0.5, () => B.emit(p, 'zap')); } });

  RG.def({ id: 'candle', name: 'Candle', emoji: '🕯️', cat: 'Fire & Light', inputs: ['fire'], outputs: ['light', 'fire'], desc: 'Light it and it glows, and keeps a flame going for a long time.',
    inZone: { x: 0, y: -34, w: 40, h: 40 }, out: { x: 0, y: -40 },
    build(p) { shelf(p, 0, 34, 44); B.rect(p, 0, 4, 22, 52, { static: true, draw(ctx) {
      ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.fillRect(-10, -26, 20, 54); ctx.strokeRect(-10, -26, 20, 54);
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.ellipse(-4, -26, 5, 8, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -34); ctx.stroke();
    } }); },
    trigger(p) { B.sfx('fwoosh'); B.popAt(p, 0, -70, 'FLICKER!', { color: '#ffd36b', size: 24 }); B.emit(p, 'fire', { dur: 12, r: 14, at: { x: 0, y: -38 } }); B.later(0.3, () => B.emit(p, 'light', { dur: 10, at: { x: 0, y: -40 } })); } });

  RG.def({ id: 'long_fuse', name: 'Long Fuse', emoji: '🧶', cat: 'Fire & Light', inputs: ['fire'], outputs: ['fire'], burnTime: 0.15, desc: 'A slow-burning fuse. Light one end and the spark crawls to the other.',
    inZone: { x: -110, y: 0, w: 34, h: 34 }, out: { x: 116, y: 0 },
    build(p) { B.rect(p, -110, 8, 20, 8, { static: true, fill: WOOD_D, mount: true }); B.rect(p, 110, 8, 20, 8, { static: true, fill: WOOD_D, mount: true }); },
    drawFront(p, ctx) {
      const t = since(p); const k = t < 0 ? 0 : Math.min(1, t / 1.6);
      ctx.save(); R.local(ctx, p);
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.setLineDash([3, 3]);
      ctx.beginPath(); for (let i = 0; i <= 40; i++) { const s = i / 40; if (s < k) continue; const x = -110 + s * 220, y = Math.sin(s * 9) * 8; if (s - 1 / 40 < k) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
      ctx.restore();
      if (t >= 0 && k < 1) { const c = p.toWorld(-110 + k * 220, Math.sin(k * 9) * 8); R.flame(ctx, c.x, c.y, 7, E.time); if (Math.random() < 0.7) B.burst(c.x, c.y, 1, { colors: ['#ffd36b', '#ff7a2a'], speed: 3, life: 0.4, size: 2 }); }
    },
    trigger(p) { B.sfx('sizzle'); B.later(1.6, () => { B.sfx('fwoosh'); B.emit(p, 'fire', { dur: 4 }); }); } });

  RG.def({ id: 'firecracker', name: 'Firecracker', emoji: '🧨', cat: 'Fire & Light', inputs: ['fire'], outputs: ['noise', 'push'], desc: 'Light the fuse and BANG! Shoves everything nearby and makes a huge noise.',
    inZone: { x: -6, y: -32, w: 36, h: 30 }, out: { x: 40, y: 0 }, placeOffset: { push: { x: 70, y: 0 } },
    build(p) { shelf(p, 0, 26, 50); p.s.c = B.rect(p, 0, 0, 30, 40, { static: true, emoji: '🧨', emojiSize: 46 }); },
    trigger(p) {
      B.sfx('sizzle');
      B.later(0.8, () => {
        const c = p.toWorld(0, 0); B.remove(p, p.s.c);
        B.sfx('bang'); B.shake(20); B.popup(c.x, c.y - 20, 'KA-BLAM!', { size: 50, color: '#ff4d4d', ink: '#2a0505' });
        B.burst(c.x, c.y, 50, { colors: ['#ffe14d', '#ff9f43', '#ff4d4d', '#fff'], speed: 10 });
        B.burst(c.x, c.y, 20, { type: 'smoke', colors: ['rgba(120,120,130,0.6)'], speed: 3, gravity: -0.03, life: 1.8, size: 14 });
        B.blast(p, c.x, c.y, 190, 12);
        B.emit(p, 'noise');
      });
    } });

  RG.def({ id: 'popcorn', name: 'Popcorn Pot', emoji: '🍿', cat: 'Fire & Light', inputs: ['fire'], outputs: ['noise', 'push'], desc: 'Heat the pot and kernels explode out in every direction.',
    inZone: { x: 0, y: 20, w: 60, h: 40 }, out: { x: 50, y: -40 },
    build(p) { shelf(p, 0, 38, 70); B.rect(p, 0, 16, 56, 34, { static: true, draw(ctx) { ctx.fillStyle = '#9aa5b4'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-28, -17, 56, 34, 6); ctx.fill(); ctx.stroke(); ctx.fillRect(-36, -12, 10, 5); ctx.fillRect(26, -12, 10, 5); } });
      p.s.lid = B.rect(p, 0, -4, 60, 6, { static: true, fill: '#57606f' }); },
    trigger(p) {
      B.sfx('popcorn'); B.popAt(p, 0, -40, 'POP POP POP!', { size: 26 });
      B.later(0.4, () => { B.remove(p, p.s.lid); });
      for (let i = 0; i < 26; i++) B.later(0.4 + i * 0.045, () => {
        const k = B.circle(p, (E.rand() - 0.5) * 30, -12, 6, { density: 0.0025, restitution: 0.4, friction: 0.3, sound: 'tink', emoji: '🍿', emojiSize: 14, fill: null });
        k.rg.emitter = p; B.vel(p, k, 1.5 + E.rand() * 5, -6 - E.rand() * 5);
        if (i === 6) B.emit(p, 'noise', { radius: 450 });
      });
    } });

  RG.def({ id: 'kettle', name: 'Whistling Kettle', emoji: '🫖', cat: 'Fire & Light', inputs: ['fire'], outputs: ['wind', 'noise'], burnTime: 0.25, desc: 'Heat it and it boils, shrieks, and blasts steam out the spout.',
    inZone: { x: 0, y: 30, w: 60, h: 40 }, out: { x: 40, y: -10 },
    build(p) { shelf(p, 0, 34, 66); B.rect(p, 0, 4, 54, 50, { static: true, emoji: '🫖', emojiSize: 56, faceLeft: false }); },
    trigger(p) { B.sfx('sizzle'); B.later(1, () => { B.sfx('whistle'); p.shakeT = 1.3; B.popAt(p, 0, -50, 'WHEEEEE!', { color: '#ffffff' }); B.emit(p, 'wind', { dur: 2.5 }); B.emit(p, 'noise'); }); },
    update(p) { if (p.fired && since(p) > 1 && since(p) < 3.5 && Math.random() < 0.5) { const c = p.toWorld(38, -10); B.burst(c.x, c.y, 1, { type: 'smoke', colors: ['rgba(240,245,255,0.55)'], angle: B.dirAngle(p, -0.3), spread: 0.4, speed: 4, gravity: -0.02, life: 1, size: 7 }); } } });

  RG.def({ id: 'bunsen', name: 'Bunsen Burner', emoji: '⚗️', cat: 'Fire & Light', inputs: ['zap'], outputs: ['fire'], desc: 'An electric igniter lights a tall blue flame.',
    inZone: { x: 0, y: 0, w: 50, h: 70 }, out: { x: 0, y: -40 }, placeOffset: { fire: { x: 0, y: -40 } },
    build(p) { shelf(p, 0, 34, 50); B.rect(p, 0, 6, 26, 46, { static: true, draw(ctx) { ctx.fillStyle = '#9aa5b4'; ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 2; ctx.fillRect(-6, -24, 12, 44); ctx.strokeRect(-6, -24, 12, 44); ctx.fillRect(-14, 18, 28, 6); ctx.strokeRect(-14, 18, 28, 6); } }); },
    trigger(p) { B.sfx('fwoosh'); B.popAt(p, 0, -80, 'FWOOMP!', { color: '#7aa8ff' }); B.emit(p, 'fire', { dur: 8, r: 16, at: { x: 0, y: -26 } }); } });

  RG.def({ id: 'tesla', name: 'Tesla Coil', emoji: '🗼', cat: 'Fire & Light', inputs: ['zap'], outputs: ['fire', 'light', 'noise'], desc: 'Feed it power and it throws crackling lightning bolts that set things alight.',
    inZone: { x: 0, y: 0, w: 60, h: 110 }, out: { x: 0, y: -56 },
    build(p) { shelf(p, 0, 54, 60); B.rect(p, 0, 0, 30, 100, { static: true, draw(ctx) {
      ctx.fillStyle = '#b87333'; for (let y = -30; y < 46; y += 4) { ctx.fillRect(-9, y, 18, 3); }
      ctx.fillStyle = '#57606f'; ctx.fillRect(-14, 44, 28, 6);
      ctx.fillStyle = '#c9ced8'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -40, 22, 10, 0, 0, 7); ctx.fill(); ctx.stroke();
    } }); },
    drawFront(p, ctx) { const t = since(p); if (t < 0 || t > 3) return; const c = p.toWorld(0, -42); for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 50; R.bolt(ctx, c.x, c.y, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, '#d6b8ff', 10); } },
    trigger(p) { B.sfx('zap'); B.sfx('buzz'); B.popAt(p, 0, -100, 'KZZZAAP!', { color: '#d6b8ff', size: 40 }); B.later(0.3, () => { B.emit(p, 'fire', { dur: 2, r: 12, bolt: true }); B.emit(p, 'light', { dur: 3 }); B.emit(p, 'noise', { radius: 500 }); B.sfx('zap'); }); } });

  RG.def({ id: 'match_striker', name: 'Match Striker', emoji: '🎇', cat: 'Fire & Light', inputs: ['pull', 'push'], outputs: ['fire'], desc: 'A tug or a shove drags a match across the striker. FSSST!',
    inZone: { x: -20, y: 0, w: 60, h: 50 }, out: { x: 42, y: -14 },
    build(p) { shelf(p, 0, 20, 70); B.rect(p, -6, 6, 50, 18, { static: true, draw(ctx) { ctx.fillStyle = '#e8453c'; ctx.strokeStyle = '#2a0e0a'; ctx.lineWidth = 2; ctx.fillRect(-25, -9, 50, 18); ctx.strokeRect(-25, -9, 50, 18); ctx.fillStyle = '#3a2a20'; ctx.fillRect(-25, -9, 50, 4); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('MATCHES', 0, 6); } }); },
    drawFront(p, ctx) { const t = since(p); const x = t < 0 ? -20 : -20 + ease(t / 0.2) * 56; ctx.save(); R.local(ctx, p); ctx.translate(x, -6); ctx.rotate(-0.3); ctx.fillStyle = '#f2d39b'; ctx.fillRect(-22, -2, 24, 4); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(4, 0, 4, 0, 7); ctx.fill(); ctx.restore(); },
    trigger(p) { B.sfx('fwoosh'); B.later(0.2, () => { B.popAt(p, 30, -40, 'FSSST!', { color: '#ff9f43' }); B.emit(p, 'fire', { dur: 6, r: 14 }); }); } });

  // ================================================================= PUNCHY GADGETS
  RG.def({ id: 'boxing_glove', name: 'Boxing Glove', emoji: '🥊', cat: 'Sparks & Strings', inputs: ['pull', 'zap'], outputs: ['push'], desc: 'A spring-loaded punch. Pull the trigger or zap it and POW!',
    inZone: { x: -20, y: 0, w: 60, h: 50 }, out: { x: 70, y: 0 },
    build(p) { shelf(p, -20, 22, 60); B.rect(p, -24, 0, 40, 34, { static: true, fill: '#8d6e63', chamfer: 5 });
      p.s.g = B.rect(p, 14, 0, 34, 30, { static: true, density: 0.004, frictionAir: 0.02, sound: 'thud', emoji: '🥊', emojiSize: 36, faceLeft: true });
    },
    drawBack(p, ctx) { const a = p.toWorld(-4, 0), b = p.s.g.position; const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; const nx = -dy / L, ny = dx / L; ctx.beginPath(); ctx.moveTo(a.x, a.y); for (let i = 1; i < 12; i++) { const k = i / 12, s = (i % 2 ? 1 : -1) * 8; ctx.lineTo(a.x + dx * k + nx * s, a.y + dy * k + ny * s); } ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3; ctx.stroke(); },
    trigger(p) {
      Body.setStatic(p.s.g, false); p.s.punch = 0;
      B.vel(p, p.s.g, 15, 0); B.sfx('sproing'); B.later(0.1, () => B.popAt(p, 70, -30, 'POW!', { color: '#ff4d4d', size: 44 }));
    },
    update(p) {
      if (p.s.punch == null || p.s.home) return;
      p.s.punch += 1 / 60;
      const g = p.s.g, home = p.toWorld(14, 0);
      Body.applyForce(g, g.position, { x: 0, y: -g.mass * 0.001 });
      if (p.s.punch > 0.45) {
        const dx = home.x - g.position.x, dy = home.y - g.position.y;
        Body.setVelocity(g, { x: dx * 0.15, y: dy * 0.15 }); Body.setAngularVelocity(g, 0); Body.setAngle(g, p.angle);
        if (Math.hypot(dx, dy) < 2) { Body.setPosition(g, home); Body.setStatic(g, true); p.s.home = true; }
      }
    } });

  RG.def({ id: 'jack_box', name: 'Jack-in-the-Box', emoji: '🤡', cat: 'Sparks & Strings', inputs: ['pull', 'zap', 'noise'], outputs: ['push', 'noise'], desc: 'POP goes the clown, springing out to bonk whatever is next to it.',
    inZone: { x: 0, y: 0, w: 60, h: 60 }, out: { x: 54, y: -50 },
    build(p) { shelf(p, 0, 28, 64); B.rect(p, 0, 4, 50, 40, { static: true, draw(ctx) { ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#3a2a05'; ctx.lineWidth = 2; ctx.fillRect(-25, -20, 50, 40); ctx.strokeRect(-25, -20, 50, 40); ctx.fillStyle = '#e8453c'; ctx.fillRect(-25, -6, 50, 10); ctx.fillStyle = '#4fc3ff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 14); if (!p.fired) { ctx.fillStyle = '#e8453c'; ctx.fillRect(-27, -24, 54, 6); } } }); },
    drawBack(p, ctx) { if (!p.s.head) return; const a = p.toWorld(0, -16), b = p.s.head.position; const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; const nx = -dy / L, ny = dx / L; ctx.beginPath(); ctx.moveTo(a.x, a.y); for (let i = 1; i < 12; i++) { const k = i / 12, s = (i % 2 ? 1 : -1) * 9; ctx.lineTo(a.x + dx * k + nx * s, a.y + dy * k + ny * s); } ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3; ctx.stroke(); },
    trigger(p) {
      B.sfx('sproing'); B.popAt(p, 0, -70, 'BOING-OING!', { size: 30 });
      p.s.head = B.circle(p, 0, -30, 17, { density: 0.004, restitution: 0.4, sound: 'boing', emoji: '🤡', emojiSize: 38 });
      p.s.head.rg.emitter = p;
      B.pinTo(p, p.s.head, 0, -16, { length: 60, stiffness: 0.006, draw: 'none' });
      B.vel(p, p.s.head, 7, -12);
      B.later(0.2, () => B.emit(p, 'noise', { radius: 420 }));
    } });

  RG.def({ id: 'swing_hammer', name: 'Swinging Hammer', emoji: '🔨', cat: 'Sparks & Strings', inputs: ['pull', 'zap'], outputs: ['push'], desc: 'A heavy hammer cocked back on a pivot. Release the latch and it swings down to whack.',
    inZone: { x: -80, y: -60, w: 70, h: 70 }, out: { x: 34, y: 0 },
    build(p) {
      B.rect(p, 0, -100, 40, 10, { static: true, fill: METAL, mount: true });
      p.s.h = B.rect(p, -94, -56, 44, 26, { static: true, density: 0.01, heavy: true, sound: 'clang', angle: -1.2, draw(ctx) { ctx.fillStyle = '#57606f'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.fillRect(-22, -13, 44, 26); ctx.strokeRect(-22, -13, 44, 26); ctx.fillStyle = '#8a929e'; ctx.fillRect(-22, -13, 8, 26); } });
      p.s.rod = B.pinTo(p, p.s.h, 0, -92, { length: 104, draw: 'rod' });
    },
    trigger(p) { Body.setStatic(p.s.h, false); Body.setAngularVelocity(p.s.h, 0); B.sfx('creak'); B.later(0.5, () => B.popAt(p, 20, -30, 'WHAM!', { size: 40 })); } });

  RG.def({ id: 'electromagnet', name: 'Electromagnet', emoji: '🧲', cat: 'Sparks & Strings', inputs: ['zap'], outputs: ['pull'], desc: 'Power makes the magnet snap toward its iron plate, tugging a string.',
    inZone: { x: 0, y: 0, w: 70, h: 60 }, out: { x: 40, y: 10 },
    build(p) { shelf(p, 0, 30, 70); B.rect(p, 0, 0, 50, 46, { static: true, emoji: '🧲', emojiSize: 46, emojiRot: 0 }); },
    drawFront(p, ctx) { const t = since(p); if (t < 0 || t > 1.2) return; const c = p.toWorld(26, 0); for (let i = 0; i < 2; i++) R.bolt(ctx, c.x, c.y, c.x + 30 + Math.random() * 20, c.y + (Math.random() - 0.5) * 40, '#7dfcff', 6); },
    trigger(p) { B.sfx('hum'); B.sfx('clink'); B.popAt(p, 0, -40, 'CLANK!', { color: '#c9ced8' }); B.later(0.3, () => B.emit(p, 'pull')); } });

  RG.def({ id: 'conveyor', name: 'Conveyor Belt', emoji: '🛞', cat: 'Sparks & Strings', inputs: ['zap'], outputs: ['roll'], desc: 'Power turns the belt and the ball on it rides off the end.',
    inZone: { x: 0, y: 10, w: 220, h: 40 }, out: { x: 116, y: 0 },
    build(p) {
      p.s.belt = B.rect(p, 0, 16, 210, 14, { static: true, friction: 0.9, draw(ctx) {
        ctx.fillStyle = '#2f3542'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-105, -7, 210, 14, 7); ctx.fill(); ctx.stroke();
        const off = p.s.on ? (E.time * 60) % 16 : 0; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
        for (let x = -100 + off; x < 100; x += 16) { ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x + 6, 7); ctx.stroke(); }
        ctx.fillStyle = METAL; for (const x of [-98, 98]) { ctx.beginPath(); ctx.arc(x, 0, 6, 0, 7); ctx.fill(); }
      } });
      B.rect(p, 0, 30, 220, 6, { static: true, fill: WOOD, mount: true });
      p.s.ball = ball(p, -80, -2, 13, '#a29bfe');
    },
    trigger(p) { p.s.on = true; B.sfx('whirr'); B.popAt(p, 0, -30, 'WHIRR-CLANK!', { size: 24 }); },
    update(p) { if (!p.s.on) return; const z = p.zoneWorld(); for (const b of Composite.allBodies(E.world)) { if (b.isStatic || !b.rg) continue; if (!RG.inBox(b, z)) continue; if (b.velocity.x * p.dir < 3) Body.setVelocity(b, { x: b.velocity.x + p.dir * 0.3, y: b.velocity.y }); } } });

  // ================================================================= FINALES
  // Every machine should end with a payoff. Finales produce nothing; they celebrate.
  function celebrate(p, text, color, lx = 0, ly = -60) {
    const c = p.toWorld(lx, ly);
    B.sfx('fanfare');
    B.popup(c.x, c.y, text, { size: 46, color: color || '#ffe14d', ink: '#2a1033', life: 2.6 });
    for (let i = 0; i < 4; i++) B.later(i * 0.15, () => B.burst(c.x + (Math.random() - 0.5) * 160, c.y - 40, 26, { type: 'confetti', speed: 7, spread: Math.PI * 1.6, life: 2.2, gravity: 0.12, size: 5 }));
  }
  const FIN = 'Finales';

  RG.def({ id: 'helium_end', name: 'THE END Balloon', emoji: '🎈', cat: FIN, finale: true, inputs: ['pull', 'sharp', 'fire'], outputs: [],
    desc: 'A helium balloon tied down with a banner. Cut, burn or yank the string and it floats away: THE END.',
    inZone: { x: 0, y: 6, w: 54, h: 60 },
    build(p) {
      B.rect(p, 0, 40, 40, 10, { static: true, fill: WOOD, mount: true });
      B.rect(p, 0, 26, 18, 18, { static: true, draw(ctx) { ctx.fillStyle = '#57606f'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('KG', 0, 3); } });
    },
    drawFront(p, ctx) {
      const t = since(p); const rise = t < 0 ? 0 : Math.pow(t, 1.6) * 160;
      ctx.save(); R.local(ctx, p);
      const by = -60 - rise, bx = t < 0 ? Math.sin(E.time * 1.5) * 3 : Math.sin(t * 3) * 14;
      // string
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 30);
      if (t < 0) ctx.lineTo(0, 17); else ctx.quadraticCurveTo(bx - 10, by + 60, bx + 4, by + 80);
      ctx.stroke();
      // banner
      ctx.save(); ctx.translate(bx + (t < 0 ? 0 : 0), by + 50);
      ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = '#2a1033'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(-34, 0, 68, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8453c'; ctx.font = `16px ${R.COMIC}`; ctx.textAlign = 'center'; ctx.fillText('THE END', 0, 16);
      ctx.restore();
      // balloon
      ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.ellipse(bx, by, 24, 29, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a0f25'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(bx - 8, by - 11, 5, 9, -0.5, 0, 7); ctx.fill();
      ctx.restore();
    },
    box: { x0: -36, y0: -92, x1: 36, y1: 46 },
    trigger(p, B_, via) { B.sfx(via === 'fire' ? 'sizzle' : 'snip'); B.later(0.3, () => { B.sfx('whoosh'); celebrate(p, 'THE END', '#ff8fa3', 0, -110); }); },
  });

  RG.def({ id: 'finish_flag', name: 'Finish Flag', emoji: '🏁', cat: FIN, finale: true, inputs: ['pull', 'zap', 'push', 'drop', 'roll'], outputs: [],
    desc: 'Bump the lever, yank the rope or zap the motor and the checkered flag runs up the pole: FINISH!',
    inZone: { x: -26, y: 20, w: 56, h: 50 },
    build(p) { B.rect(p, 0, 48, 90, 10, { static: true, fill: WOOD, mount: true }); B.rect(p, 20, -30, 6, 150, { static: true, fill: '#c9ced8' }); B.rect(p, -26, 34, 36, 14, { static: true, fill: '#e8453c', chamfer: 4 }); },
    drawFront(p, ctx) {
      const t = since(p); const k = t < 0 ? 0 : ease(t / 1.1);
      ctx.save(); R.local(ctx, p); ctx.translate(23, 30 - k * 120);
      const wave = Math.sin(E.time * 8) * 3;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff'; ctx.fillRect(c * 8, r * 7 + Math.sin(E.time * 8 + c) * (c / 6) * 3 + wave * 0, 8, 7); }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, 48, 28);
      ctx.restore();
    },
    box: { x0: -46, y0: -106, x1: 74, y1: 54 },
    trigger(p) { B.sfx('whoosh'); B.later(1.1, () => celebrate(p, 'FINISH!', '#ffffff', 40, -130)); },
  });

  RG.def({ id: 'fireworks', name: 'Grand Fireworks', emoji: '🎆', cat: FIN, finale: true, inputs: ['fire', 'zap'], outputs: [],
    desc: 'Light the fuse or zap the igniter: three rockets shoot up and burst over the whole machine.',
    inZone: { x: 0, y: 0, w: 70, h: 60 },
    build(p) {
      B.rect(p, 0, 26, 76, 10, { static: true, fill: WOOD, mount: true });
      B.rect(p, 0, 4, 60, 34, { static: true, draw(ctx) { ctx.fillStyle = '#3d4352'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.fillRect(-30, -17, 60, 34); ctx.strokeRect(-30, -17, 60, 34);
        if (!p.fired) for (const [x, col] of [[-18, '#ff4d6d'], [0, '#ffd34d'], [18, '#4fc3ff']]) { ctx.fillStyle = col; ctx.fillRect(x - 4, -32, 8, 18); ctx.beginPath(); ctx.moveTo(x - 5, -32); ctx.lineTo(x, -40); ctx.lineTo(x + 5, -32); ctx.fill(); } } });
    },
    box: { x0: -40, y0: -44, x1: 40, y1: 32 },
    trigger(p) {
      B.sfx('sizzle');
      [[-18, '#ff4d6d', -0.25], [0, '#ffd34d', 0], [18, '#4fc3ff', 0.25]].forEach(([x, col, a], i) => B.later(0.4 + i * 0.35, () => {
        B.sfx('rocket');
        const start = p.toWorld(x, -30), top = { x: start.x + Math.sin(a) * 160 * p.dir, y: start.y - 380 - i * 40 };
        for (let k = 0; k < 18; k++) B.later(k * 0.03, () => { const f = k / 18; B.burst(start.x + (top.x - start.x) * f, start.y + (top.y - start.y) * f, 1, { colors: ['#ffe9a8', col], speed: 1, life: 0.5, size: 3 }); });
        B.later(0.6, () => { B.sfx('bang'); B.shake(6); B.burst(top.x, top.y, 70, { colors: [col, '#ffffff', '#ffe14d'], speed: 9, spread: Math.PI * 2, life: 1.6, gravity: 0.05, size: 3.5 }); });
      }));
      B.later(1.8, () => celebrate(p, 'TA-DAAA!', '#ffe14d', 0, -300));
    },
  });

  RG.def({ id: 'tada_curtain', name: 'Ta-Da Curtain', emoji: '🎭', cat: FIN, finale: true, inputs: ['pull', 'wind', 'noise'], outputs: [],
    desc: 'A tiny stage. Pull the cord, blow on it or make a racket and the curtains part: TA-DA!',
    inZone: { x: 0, y: 0, w: 110, h: 100 },
    build(p) { B.rect(p, 0, 50, 112, 10, { static: true, fill: WOOD, mount: true }); B.rect(p, 0, 0, 100, 90, { static: true, draw(ctx) {
      ctx.fillStyle = '#2a1033'; ctx.fillRect(-50, -45, 100, 90);
      ctx.fillStyle = '#ffd34d'; ctx.font = `20px ${R.COMIC}`; ctx.textAlign = 'center'; ctx.fillText('TA-DA!', 0, 4); R.emoji(ctx, '⭐', 0, 24, 18);
      const t = since(p); const k = t < 0 ? 0 : ease(t / 0.9);
      ctx.fillStyle = '#b3123a'; const w = 50 * (1 - k * 0.85);
      for (const side of [-1, 1]) { ctx.save(); ctx.scale(side, 1); ctx.beginPath(); ctx.moveTo(-50, -45); ctx.lineTo(-50 + w, -45); ctx.quadraticCurveTo(-50 + w * 0.6, 0, -50 + w, 45); ctx.lineTo(-50, 45); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50 + w * i / 4, -45); ctx.lineTo(-50 + w * i / 4 * 0.9, 45); ctx.stroke(); } ctx.restore(); }
      ctx.fillStyle = '#e8b04a'; ctx.fillRect(-54, -50, 108, 8);
    } }); },
    trigger(p) { B.sfx('whoosh'); B.later(0.9, () => celebrate(p, 'TA-DA!', '#ffd34d', 0, -80)); },
  });

  RG.def({ id: 'victory_trophy', name: 'Victory Trophy', emoji: '🏆', cat: FIN, finale: true, inputs: ['roll', 'drop', 'push'], outputs: [],
    desc: 'Hit the bell plate and a golden trophy springs up: YOU WIN!',
    inZone: { x: 0, y: -8, w: 84, h: 44 },
    build(p) { B.rect(p, 0, 16, 90, 10, { static: true, fill: WOOD, mount: true }); B.rect(p, 0, 6, 70, 10, { static: true, fill: '#e0a526', chamfer: 4 }); },
    drawFront(p, ctx) { const t = since(p); if (t < 0) return; const k = Math.min(1, t / 0.35); const s = 0.3 + 0.7 * k + Math.sin(Math.min(t, 1) * 12) * 0.08 * (1 - Math.min(1, t)); const c = p.toWorld(0, -10 - 40 * k); R.emoji(ctx, '🏆', c.x, c.y, 60 * s); },
    box: { x0: -46, y0: -80, x1: 46, y1: 22 },
    trigger(p) { B.sfx('ding'); B.later(0.15, () => celebrate(p, 'YOU WIN!', '#ffe14d', 0, -110)); },
  });

  RG.def({ id: 'breakfast', name: 'Breakfast Bowl', emoji: '🥣', cat: FIN, finale: true, inputs: ['pour', 'drop'], outputs: [], pourNeed: 6,
    desc: 'The classic payoff: pour milk (or drop anything) into the cereal bowl. Breakfast is served!',
    inZone: { x: 0, y: -4, w: 76, h: 40 },
    build(p) {
      B.rect(p, 0, 26, 90, 10, { static: true, fill: WOOD, mount: true });
      B.rect(p, 0, 16, 60, 8, { static: true, fill: '#4fa3ff' });
      B.rect(p, -32, 4, 6, 30, { static: true, fill: '#4fa3ff', angle: -0.4 });
      B.rect(p, 32, 4, 6, 30, { static: true, fill: '#4fa3ff', angle: 0.4 });
    },
    drawFront(p, ctx) { ctx.save(); R.local(ctx, p); for (let i = 0; i < 7; i++) { ctx.fillStyle = ['#ffbe3b', '#e8862e', '#ffd34d'][i % 3]; ctx.beginPath(); ctx.arc(-18 + i * 6, 8 - (i % 2) * 3, 4, 0, 7); ctx.fill(); } ctx.restore(); },
    trigger(p) { B.sfx('chime'); B.later(0.2, () => celebrate(p, 'BREAKFAST IS SERVED!', '#fff6e0', 0, -70)); },
  });

  RG.def({ id: 'neon_sign', name: 'Neon THE END Sign', emoji: '💡', cat: FIN, finale: true, inputs: ['zap', 'light', 'noise'], outputs: [],
    desc: 'Power it, shine a light on its sensor or clap: the neon sign buzzes on and spells THE END.',
    inZone: { x: 0, y: 0, w: 130, h: 70 },
    build(p) { B.rect(p, 0, 34, 130, 10, { static: true, fill: WOOD, mount: true }); B.rect(p, 0, 0, 120, 56, { static: true, draw(ctx) {
      ctx.fillStyle = '#15121f'; ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-60, -28, 120, 56, 8); ctx.fill(); ctx.stroke();
      const t = since(p); const on = t >= 0 && (t > 0.6 || Math.sin(t * 60) > 0);
      ctx.font = `24px ${R.COMIC}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (on) { ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 18; ctx.fillStyle = '#ffc2f2'; } else { ctx.fillStyle = '#4a3a55'; }
      ctx.fillText('THE END', 0, 2); ctx.shadowBlur = 0;
    } }); },
    trigger(p) { B.sfx('buzz'); B.later(0.6, () => celebrate(p, 'THE END', '#ffc2f2', 0, -80)); },
  });
})();
