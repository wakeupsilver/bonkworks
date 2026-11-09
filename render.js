// Canvas renderer: pegboard, parts, bodies, fields, particles and comic popups.
(function () {
  const { Composite } = Matter;
  const RG = window.RG, E = RG.E, WORLD = RG.WORLD;
  const R = RG.R = {};
  const cam = RG.cam = { x: 900, y: 700, z: 0.75 };
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const COMIC = '"Luckiest Guy","Bowlby One",Impact,system-ui,sans-serif';
  R.COMIC = COMIC;
  const ecache = new Map();
  function emojiImg(e, size) {
    const k = e + '|' + size;
    let c = ecache.get(k);
    if (!c) {
      c = document.createElement('canvas');
      const s = Math.ceil(size * 1.35); c.width = c.height = s;
      const g = c.getContext('2d');
      g.font = `${size}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(e, s / 2, s / 2 + size * 0.06);
      ecache.set(k, c);
    }
    return c;
  }
  R.emoji = function (ctx, e, x, y, size, rot = 0, mirror = false, alpha = 1) {
    const q = Math.min(160, Math.max(12, Math.round(size / 4) * 4));
    const img = emojiImg(e, q * 2);
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (mirror) ctx.scale(-1, 1);
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    const s = size * 1.35; ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  };

  // pegboard tile
  let peg = null;
  function pegPattern(ctx) {
    if (peg) return peg;
    const c = document.createElement('canvas'); c.width = c.height = 40;
    const g = c.getContext('2d');
    g.fillStyle = '#245159'; g.fillRect(0, 0, 40, 40);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * 40, Math.random() * 40, 2, 1); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(20.6, 20.8, 4.6, 0, 7); g.fill();
    g.fillStyle = '#0e2328'; g.beginPath(); g.arc(20, 20, 4, 0, 7); g.fill();
    peg = ctx.createPattern(c, 'repeat');
    return peg;
  }

  R.worldToScreen = (x, y, cw, ch) => ({ x: (x - cam.x) * cam.z + cw / 2, y: (y - cam.y) * cam.z + ch / 2 });
  R.screenToWorld = (sx, sy, cw, ch) => ({ x: (sx - cw / 2) / cam.z + cam.x, y: (sy - ch / 2) / cam.z + cam.y });

  R.local = function (ctx, p) { ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.scale(p.dir, 1); };

  function path(ctx, verts) { ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y); for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y); ctx.closePath(); }

  // blend between physics steps when playback is slower than real time
  R.alpha = 1;
  function interp(ctx, b) {
    if (b.isStatic || b._px === undefined || R.alpha >= 1) return;
    const k = R.alpha - 1; // offset back toward the previous step
    const dx = (b.position.x - b._px) * k, dy = (b.position.y - b._py) * k, da = (b.angle - b._pa) * k;
    if (Math.abs(dx) > 60 || Math.abs(dy) > 60) return; // teleported: don't smear
    ctx.translate(b.position.x + dx, b.position.y + dy); ctx.rotate(da); ctx.translate(-b.position.x, -b.position.y);
  }
  function drawBody(ctx, b) {
    const r = b.rg; if (!r || r.hidden) return;
    ctx.save();
    interp(ctx, b);
    if (r.alpha !== 1) ctx.globalAlpha = r.alpha;
    if (r.draw) {
      ctx.translate(b.position.x, b.position.y);
      const ang = r.roll ? r.rollAngle : b.angle; ctx.rotate(ang);
      const p = r.part; if (p && p.dir === -1 && !r.noMirror && !r.roll) ctx.scale(-1, 1);
      r.draw(ctx, b, p, ang);
    } else if (r.fill) {
      const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
      for (const q of parts) {
        if (q.circleRadius) { ctx.beginPath(); ctx.arc(q.position.x, q.position.y, q.circleRadius, 0, Math.PI * 2); }
        else path(ctx, q.vertices);
        ctx.fillStyle = q.rgFill || r.fill; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = r.stroke || 'rgba(15,10,25,0.75)'; ctx.stroke();
      }
      if (r.mount) {
        ctx.fillStyle = '#d8dde6';
        const vs = b.vertices, n = vs.length;
        if (n === 4) {
          const a = vs[0], c = vs[1], d = vs[3];
          const ux = (c.x - a.x), uy = (c.y - a.y), L = Math.hypot(ux, uy);
          for (const k of [0.12, 0.88]) {
            if (L < 40 && k !== 0.12) continue;
            const px = a.x + ux * (L < 40 ? 0.5 : k) + (d.x - a.x) * 0.5, py = a.y + uy * (L < 40 ? 0.5 : k) + (d.y - a.y) * 0.5;
            ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 7); ctx.fill();
          }
        }
      }
    }
    if (r.emoji) {
      const p = r.part;
      const mirror = p ? (r.emojiFaceLeft ? p.dir === 1 : p.dir === -1) : false;
      R.emoji(ctx, r.emoji, b.position.x, b.position.y, r.emojiSize || 40, b.angle + (r.emojiRot || 0) * (p ? p.dir : 1), mirror);
    }
    ctx.restore();
  }
  R.drawBody = drawBody;

  function drawCons(ctx, c) {
    const r = c.rg; if (!r || r.draw === 'none') return;
    const a = c.bodyA ? { x: c.bodyA.position.x + c.pointA.x, y: c.bodyA.position.y + c.pointA.y } : c.pointA;
    const b = c.bodyB ? { x: c.bodyB.position.x + c.pointB.x, y: c.bodyB.position.y + c.pointB.y } : c.pointB;
    ctx.save();
    if (r.draw === 'spring') {
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), n = 10;
      const nx = -dy / L, ny = dx / L;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      for (let i = 1; i < n; i++) { const k = i / n, s = (i % 2 ? 1 : -1) * 7; ctx.lineTo(a.x + dx * k + nx * s, a.y + dy * k + ny * s); }
      ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 3; ctx.stroke();
    } else if (r.draw === 'rod') {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = '#a8743f'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill();
    } else if (r.draw === 'pivot') {
      ctx.fillStyle = '#d8dde6'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = r.color || '#e8c48a'; ctx.lineWidth = r.width || 2.5; ctx.stroke();
    }
    ctx.restore();
  }

  function flame(ctx, x, y, s, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fl = 1 + Math.sin(t * 31 + x) * 0.08 + Math.sin(t * 17) * 0.06;
    const layers = [['rgba(255,80,20,0.55)', 1.0], ['rgba(255,170,40,0.7)', 0.7], ['rgba(255,245,170,0.9)', 0.4]];
    for (const [col, k] of layers) {
      const h = s * 2.1 * k * fl, w = s * 0.9 * k;
      ctx.beginPath(); ctx.moveTo(x, y - h);
      ctx.bezierCurveTo(x + w, y - h * 0.4, x + w, y + w * 0.6, x, y + w * 0.6);
      ctx.bezierCurveTo(x - w, y + w * 0.6, x - w, y - h * 0.4, x, y - h);
      ctx.fillStyle = col; ctx.fill();
    }
    const g = ctx.createRadialGradient(x, y - s * 0.5, 0, x, y - s * 0.5, s * 3);
    g.addColorStop(0, 'rgba(255,160,60,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 3, 0, 7); ctx.fill();
    ctx.restore();
  }
  R.flame = flame;

  R.bolt = function (ctx, x0, y0, x1, y1, color = '#bff8ff', jag = 14) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(x0, y0);
    const n = 9, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const k = i / n, o = (Math.random() - 0.5) * jag * 2; ctx.lineTo(x0 + dx * k + nx * o, y0 + dy * k + ny * o); }
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.restore();
  };

  function drawLinks(ctx, opts) {
    for (const p of E.parts) {
      const ids = (p.next || []).map(id => [id, false]).concat((p.autoNext || []).map(id => [id, true]));
      for (const [id, auto] of ids) {
        const t = E.byId[id]; if (!t) continue;
        const shared = p.def.outputs.filter(s => t.def.inputs.includes(s));
        const sig = shared[0];
        const o = p.outWorld(), z = t.zoneWorld(); if (!z) continue;
        const d = Math.hypot(z.cx - o.x, z.cy - o.y);
        const tooFar = sig && RG.SIG[sig].range && d > RG.SIG[sig].range;
        const kind = sig ? RG.SIG[sig].kind : 'bad';
        const run = E.mode === 'run';
        if (run && kind !== 'link' && sig !== 'fire') continue;
        if (run && sig === 'fire' && d < 45) continue;
        // skip ropes/wires/fuses currently animating
        if (run && E.trans.some(tr => tr.from === p && tr.to === t && tr.sig !== 'magic')) continue;
        const mx = (o.x + z.cx) / 2, my = (o.y + z.cy) / 2 + d * (kind === 'link' || sig === 'fire' ? 0.12 : 0.0);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.quadraticCurveTo(mx, my, z.cx, z.cy);
        if (!sig) { ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = 3; }
        else if (sig === 'pull') { ctx.strokeStyle = tooFar ? '#ff9a4d' : '#e8c48a'; ctx.lineWidth = 2.5; }
        else if (sig === 'zap') { ctx.strokeStyle = tooFar ? '#ff9a4d' : '#1b1b22'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = tooFar ? '#ff9a4d' : '#d9534f'; ctx.lineWidth = 2; }
        else if (sig === 'fire') { ctx.strokeStyle = tooFar ? '#ff9a4d' : '#3a2a20'; ctx.lineWidth = 3.5; ctx.setLineDash([2, 3]); }
        else { ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.strokeStyle = RG.SIG[sig].color; ctx.globalAlpha = 0.8; ctx.lineWidth = 3.5; }
        if (auto) ctx.globalAlpha *= 0.5;
        ctx.stroke();
        ctx.restore();
        if (!run || opts.selected === p || opts.selected === t) {
          const lx = 0.25 * o.x + 0.5 * mx + 0.25 * z.cx, ly = 0.25 * o.y + 0.5 * my + 0.25 * z.cy;
          ctx.save();
          ctx.fillStyle = !sig ? '#ff5a5a' : tooFar ? '#ff9a4d' : 'rgba(10,20,30,0.85)';
          ctx.beginPath(); ctx.arc(lx, ly, 13, 0, 7); ctx.fill();
          ctx.restore();
          if (!sig) { ctx.save(); ctx.fillStyle = '#fff'; ctx.font = `bold 16px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✗', lx, ly + 1); ctx.restore(); }
          else R.emoji(ctx, tooFar ? '⚠️' : RG.SIG[sig].icon, lx, ly, 15);
        }
      }
    }
  }

  function drawTrans(ctx) {
    for (const tr of E.trans) {
      const k = Math.min(1, (E.time - tr.t0) / tr.dur);
      const z = tr.to.zoneWorld() || { cx: tr.ax, cy: tr.ay };
      const kk = tr.fizzle ? Math.min(k, 0.55) : k;
      if (tr.sig === 'pull') {
        const snapT = Math.max(0, E.time - tr.t0 - tr.dur);
        ctx.save(); ctx.beginPath(); ctx.moveTo(tr.ax, tr.ay);
        const wob = Math.sin(E.time * 60) * 6 * Math.max(0, 1 - snapT * 4);
        ctx.quadraticCurveTo((tr.ax + z.cx) / 2, (tr.ay + z.cy) / 2 + (1 - k) * 30 + wob, z.cx, z.cy);
        ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      } else if (tr.sig === 'zap') {
        ctx.save(); ctx.beginPath(); ctx.moveTo(tr.ax, tr.ay);
        const mx = (tr.ax + z.cx) / 2, my = (tr.ay + z.cy) / 2 + Math.hypot(z.cx - tr.ax, z.cy - tr.ay) * 0.12;
        ctx.quadraticCurveTo(mx, my, z.cx, z.cy); ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#7dfcff'; ctx.lineWidth = 2; ctx.shadowColor = '#7dfcff'; ctx.shadowBlur = 10; ctx.stroke();
        ctx.restore();
        if (k < 1) { const u = 1 - kk; const px = u * u * tr.ax + 2 * u * kk * mx + kk * kk * z.cx, py = u * u * tr.ay + 2 * u * kk * my + kk * kk * z.cy; R.bolt(ctx, px - 10, py - 10, px + 10, py + 10, '#7dfcff', 8); R.bolt(ctx, px + 10, py - 10, px - 10, py + 10, '#ffffff', 8); }
      } else if (tr.sig === 'fire') {
        const mx = (tr.ax + z.cx) / 2, my = (tr.ay + z.cy) / 2 + Math.hypot(z.cx - tr.ax, z.cy - tr.ay) * 0.12;
        ctx.save(); ctx.beginPath();
        const N = 30; let started = false;
        for (let i = 0; i <= N; i++) { const s = i / N; if (s < kk) continue; const u = 1 - s; const x = u * u * tr.ax + 2 * u * s * mx + s * s * z.cx, y = u * u * tr.ay + 2 * u * s * my + s * s * z.cy; if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 3.5; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.restore();
        if (k < 1 && !(tr.fizzle && k > 0.55)) {
          const u = 1 - kk; const px = u * u * tr.ax + 2 * u * kk * mx + kk * kk * z.cx, py = u * u * tr.ay + 2 * u * kk * my + kk * kk * z.cy;
          flame(ctx, px, py, 7, E.time);
          if (Math.random() < 0.6) RG.B.burst(px, py, 1, { colors: ['#ffd36b', '#ff7a2a'], speed: 2.5, life: 0.4, size: 2 });
        }
      } else if (tr.sig === 'bolt') {
        if (k < 1) R.bolt(ctx, tr.ax, tr.ay, z.cx, z.cy, '#d6b8ff', 22);
      } else if (tr.sig === 'magic') {
        const N = 10;
        for (let i = 0; i < N; i++) {
          const s = ((E.time - tr.t0) * 1.6 + i / N) % 1;
          const x = tr.ax + (z.cx - tr.ax) * s, y = tr.ay + (z.cy - tr.ay) * s - Math.sin(s * Math.PI) * 60;
          R.emoji(ctx, '✨', x, y, 16, 0, false, 1 - s * 0.5);
        }
      }
    }
  }

  function drawZones(ctx) {
    for (const z of E.zones) {
      const left = z.until - E.time; const fade = Math.max(0, Math.min(1, left / 0.5));
      if (fade <= 0) continue;
      if (z.type === 'fire') {
        ctx.save(); ctx.globalAlpha = fade; flame(ctx, z.x, z.y, z.r * 0.75, E.time); ctx.restore();
        if (E.mode === 'run' && Math.random() < 0.25) RG.B.burst(z.x, z.y - z.r, 1, { type: 'smoke', colors: ['rgba(80,80,90,0.5)'], speed: 0.6, angle: -Math.PI / 2, spread: 0.6, gravity: -0.03, life: 1.4, size: 8 });
      } else if (z.type === 'wind') {
        ctx.save(); ctx.globalAlpha = 0.75 * fade; ctx.strokeStyle = '#d8f8ff'; ctx.lineCap = 'round';
        const ca = Math.cos(z.ang), sa = Math.sin(z.ang);
        for (let i = 0; i < 22; i++) {
          const ph = (E.time * 1.7 + i * 0.137) % 1; const along = ph * z.len;
          const lane = ((i * 0.618) % 1 - 0.5) * 2;
          const perp = lane * (along * Math.tan(z.half) + 12);
          const x = z.x + ca * along - sa * perp, y = z.y + sa * along + ca * perp;
          ctx.globalAlpha = 0.7 * fade * Math.sin(ph * Math.PI);
          ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ca * 34, y + sa * 34); ctx.stroke();
        }
        ctx.restore();
      } else if (z.type === 'light') {
        if (z.follow) { z.x = z.follow.position.x; z.y = z.follow.position.y; }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const ca = Math.cos(z.ang), sa = Math.sin(z.ang), L = z.len, w0 = 8, w1 = 46;
        const g = ctx.createLinearGradient(z.x, z.y, z.x + ca * L, z.y + sa * L);
        g.addColorStop(0, `rgba(255,245,160,${0.55 * fade})`); g.addColorStop(1, `rgba(255,240,120,${0.12 * fade})`);
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(z.x - sa * w0, z.y + ca * w0); ctx.lineTo(z.x + ca * L - sa * w1, z.y + sa * L + ca * w1);
        ctx.lineTo(z.x + ca * L + sa * w1, z.y + sa * L - ca * w1); ctx.lineTo(z.x + sa * w0, z.y - ca * w0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,220,${0.5 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + ca * L, z.y + sa * L); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function ipos(b) {
    if (b._px === undefined || R.alpha >= 1) return b.position;
    const k = R.alpha - 1; return { x: b.position.x + (b.position.x - b._px) * k, y: b.position.y + (b.position.y - b._py) * k };
  }
  function drawPours(ctx) {
    const groups = {};
    for (const b of E.pours) (groups[b.rg.fill] = groups[b.rg.fill] || []).push(b);
    for (const col in groups) {
      ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (const b of groups[col]) { const r = b.circleRadius * 1.45, p = ipos(b); ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 7); }
      ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (const b of groups[col]) { const r = b.circleRadius * 0.45, p = ipos(b); ctx.moveTo(p.x - 1 + r, p.y - 2); ctx.arc(p.x - 1, p.y - 2, r, 0, 7); }
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(ctx) {
    for (const q of E.particles) {
      const a = 1 - q.t / q.life;
      ctx.globalAlpha = Math.max(0, a);
      if (q.type === 'confetti') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.color; ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size); ctx.restore(); }
      else if (q.type === 'smoke') { ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + q.t * 1.6), 0, 7); ctx.fill(); }
      else if (q.type === 'text') { ctx.globalAlpha = Math.max(0, a); R.emoji(ctx, q.text, q.x, q.y, q.size, 0); }
      else { ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx) {
    for (const r of E.rings) {
      const a = 1 - r.r / r.max;
      ctx.save(); ctx.strokeStyle = r.color; ctx.globalAlpha = a * 0.8;
      for (let i = 0; i < 3; i++) { const rr = r.r - i * 26; if (rr <= 0) continue; ctx.lineWidth = 4 - i; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, 7); ctx.stroke(); }
      ctx.restore();
    }
  }

  function drawPopups(ctx) {
    for (const q of E.popups) {
      const k = q.t / q.life;
      const s = k < 0.15 ? easeBack(k / 0.15) : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save(); ctx.translate(q.x, q.y - k * 40); ctx.rotate(q.rot); ctx.scale(s, s); ctx.globalAlpha = a;
      ctx.font = `${q.size}px ${COMIC}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // starburst
      const w = ctx.measureText(q.text).width / 2 + q.size * 0.5, h = q.size * 0.95;
      ctx.beginPath();
      const N = 14;
      for (let i = 0; i < N * 2; i++) { const ang = i / (N * 2) * Math.PI * 2, rr = i % 2 ? 0.78 : 1.0; ctx.lineTo(Math.cos(ang) * w * rr, Math.sin(ang) * h * rr); }
      ctx.closePath(); ctx.fillStyle = q.ink; ctx.globalAlpha = a * 0.85; ctx.fill(); ctx.globalAlpha = a;
      ctx.lineJoin = 'round'; ctx.lineWidth = q.size * 0.2; ctx.strokeStyle = q.ink; ctx.strokeText(q.text, 0, 2);
      ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 2);
      ctx.restore();
    }
  }
  function easeBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  R.draw = function (ctx, cw, ch, dpr, overlay) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b161a'; ctx.fillRect(0, 0, cw, ch);
    // screen shake decays every frame, whether or not the machine is running
    E.shake = E.shake < 0.3 ? 0 : E.shake * 0.88;
    const sx = (Math.random() - 0.5) * E.shake, sy = (Math.random() - 0.5) * E.shake;
    ctx.translate(cw / 2 + sx, ch / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // board
    ctx.fillStyle = pegPattern(ctx); ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    const vg = ctx.createLinearGradient(0, 0, 0, WORLD.h); vg.addColorStop(0, 'rgba(0,0,0,0.25)'); vg.addColorStop(0.3, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // frame
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 22; ctx.strokeRect(-11, -11, WORLD.w + 22, WORLD.h + 22);
    ctx.strokeStyle = '#a8743f'; ctx.lineWidth = 6; ctx.strokeRect(-8, -8, WORLD.w + 16, WORLD.h + 16);
    // floor
    ctx.fillStyle = '#3b2a1e'; ctx.fillRect(-20, WORLD.h, WORLD.w + 40, 60);
    ctx.fillStyle = '#5a4030'; for (let x = 0; x < WORLD.w; x += 80) ctx.fillRect(x, WORLD.h + 2, 76, 6);

    if (overlay && overlay.before) overlay.before(ctx);
    drawLinks(ctx, overlay || {});
    // glow halos of fired parts
    for (const p of E.parts) {
      if (p.glow > 0.02) {
        const cx = (p.box.x0 + p.box.x1) / 2, cy = (p.box.y0 + p.box.y1) / 2, rr = Math.max(p.box.x1 - p.box.x0, p.box.y1 - p.box.y0) * 0.8 + 30;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, `rgba(255,230,120,${0.35 * p.glow})`); g.addColorStop(1, 'rgba(255,230,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
      }
    }
    for (const p of E.parts) if (p.def.drawBack) { ctx.save(); try { p.def.drawBack(p, ctx, RG.B); } catch (e) { console.error(e); } ctx.restore(); }
    for (const c of Composite.allConstraints(E.world)) drawCons(ctx, c);
    // bodies: statics first, with a bounce when their part just fired
    const bodies = Composite.allBodies(E.world).filter(b => b.rg && b.rg.kind !== 'pour');
    for (const b of bodies) {
      const p = b.rg.part;
      const dtf = p ? E.time - p.firedAt : 9;
      const jiggle = p && p.fired && b.isStatic && dtf < 0.45;
      const shk = p && p.shakeT > 0;
      if (jiggle || shk) {
        ctx.save();
        const s = jiggle ? 1 + Math.sin(dtf * 30) * 0.12 * (1 - dtf / 0.45) : 1;
        ctx.translate(p.x, p.y); ctx.scale(s, 2 - s); ctx.translate(-p.x, -p.y);
        if (shk) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        drawBody(ctx, b); ctx.restore();
      } else drawBody(ctx, b);
    }
    for (const p of E.parts) { if (p.shakeT > 0) p.shakeT -= 1 / 60; if (p.outFlash > 0) p.outFlash -= 1 / 40; }
    for (const p of E.parts) if (p.def.drawFront) { ctx.save(); try { p.def.drawFront(p, ctx, RG.B); } catch (e) { console.error(e); } ctx.restore(); }
    drawPours(ctx);
    drawZones(ctx);
    drawTrans(ctx);
    drawRings(ctx);
    drawParticles(ctx);
    for (const s of E.sparkles) R.emoji(ctx, '🪄', s.x + 10, s.y - 20 - s.t * 30, 26, -0.4, false, 1 - s.t / 0.8);
    if (overlay && overlay.after) overlay.after(ctx);
    drawPopups(ctx);
  };
})();
