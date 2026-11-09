// UI: inventory, chain picker, editing, camera, generator, run controls.
(function () {
  const RG = window.RG, E = RG.E, R = RG.R, cam = RG.cam, WORLD = RG.WORLD;
  const $ = s => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const KEY = 'bonkworks.v1';
  const OLD_KEY = 'contraptionator.v1'; // earlier name: still read so saved machines carry over
  const CATS = ['Starters', 'Rolling & Falling', 'Pokey Things', 'Fire & Light', 'Air & Water', 'Sparks & Strings', 'Critters', 'Finales'];
  let layout = { parts: [] };
  let sel = null, linkMode = false, filterSig = null, query = '';
  let running = false, follow = true, cw = 0, ch = 0, dpr = 1;
  let hover = null, mouseW = { x: 0, y: 0 };
  let nid = 1;

  const specById = id => layout.parts.find(s => s.id === id);
  const newId = () => { while (specById('p' + nid)) nid++; return 'p' + (nid++); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch (e) { /* storage unavailable */ } };
  const sigIcons = arr => arr.map(s => RG.SIG[s].icon).join('');

  // ---------------------------------------------------------------- sizing
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = r.width; ch = r.height;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  }
  window.addEventListener('resize', resize);
  // refit when the stage changes size (e.g. the page frame settles after load), unless the user moved the camera
  if (window.ResizeObserver) new ResizeObserver(() => { const had = cw; resize(); if (!running && (!userCam || !had)) viewStart(); }).observe(document.getElementById('stage'));

  // ---------------------------------------------------------------- toast & status
  let toastT = 0;
  function toast(msg, warn) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show' + (warn ? ' warn' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, warn ? 4200 : 2600);
  }
  function status(big, small) { $('#status').innerHTML = big ? `${big}${small ? `<small>${small}</small>` : ''}` : ''; }

  // ---------------------------------------------------------------- placement
  function zoneOffset(type, flip, angle) {
    const t = new RG.Part({ id: '_tmp', type, x: 0, y: 0, flip, angle });
    const z = t.zoneWorld();
    return z ? { x: z.cx, y: z.cy } : { x: 0, y: 0 };
  }
  // Candidate positions for the next part, best first. Thrown/rolling things use the source's simulated trajectory.
  function candidates(srcPart, type, sig, dx = 0, dy = 0) {
    const def = RG.PARTS[type];
    const flip = srcPart.dir === -1;
    const angle = def.defaultAngle ? def.defaultAngle * (flip ? -1 : 1) : 0;
    const zo = zoneOffset(type, flip, angle);
    const mk = tz => ({ x: Math.round(tz.x - zo.x), y: Math.round(tz.y - zo.y), flip, angle });
    const o = srcPart.outWorld(), dir = srcPart.dir;
    const po = srcPart.def.placeOffset && srcPart.def.placeOffset[sig];
    if (RG.SIG[sig].kind === 'body' && sig !== 'pour' && !po) {
      const { path, box } = RG.samplePath(srcPart.spec);
      if (path) {
        const beyond = q => dir === 1 ? q.x > box.x1 + 16 : q.x < box.x0 - 16;
        let start = -1;
        if (sig === 'drop') start = path.findIndex((q, i) => i > 0 && q.y > Math.max(box.y1, o.y) + 50 && q.y >= path[i - 1].y);
        else start = path.findIndex(beyond);
        if (start >= 0) {
          const out = [];
          for (let i = start; i < path.length && out.length < 16; i += 2) out.push(mk(path[i]));
          return out;
        }
      }
    }
    const off = po || RG.PLACE[sig] || { x: 200, y: 0 };
    return [mk({ x: o.x + (off.x + dx) * dir, y: o.y + off.y + dy })];
  }
  // For things that physically travel: the first free candidate spot where a quick pure-physics test
  // shows the source really sets the new part off. Returns { pos, ok }.
  function verifiedPlacement(src, type, sig, accept) {
    const cands = candidates(src, type, sig);
    const feedSig = src.def.passthrough ? (RG.outputsOf(src).includes('pour') && sig === 'pour' ? 'pour' : 'drop') : undefined;
    let firstFree = null;
    const tries = cands.slice(0, 10);
    // nudged variations around the best few spots, in case the ideal spot just misses
    for (const c of cands.slice(0, 3)) for (const [jx, jy] of [[0, -20], [20, 0], [-20, 0], [0, 20], [30, -25], [-30, -25], [40, 0], [-40, 0], [0, -40], [50, 20], [-50, 20], [0, 45]]) tries.push({ x: c.x + jx, y: c.y + jy, flip: c.flip, angle: c.angle });
    for (const c of tries) {
      const test = RG.addPart({ id: '__try', type, x: c.x, y: c.y, flip: c.flip, angle: c.angle, next: [] });
      // touching the source is fine (scissors, pins and flames work up close); other parts are not
      const free = !overlaps(test, src) && (!accept || accept(test)); RG.removePart(test);
      if (!free) continue;
      if (!firstFree) firstFree = c;
      if (RG.testPair(Object.assign({}, src.spec, { next: [] }), { type, x: c.x, y: c.y, flip: c.flip, angle: c.angle }, 12, feedSig)) return { pos: c, ok: true };
    }
    return { pos: firstFree || cands[0], ok: false };
  }
  // Try candidates and return the first that doesn't collide with existing parts (and passes accept()).
  function placeNext(srcPart, type, sig, dx = 0, dy = 0, accept) {
    const cands = candidates(srcPart, type, sig, dx, dy);
    for (const c of cands) {
      const p = RG.addPart({ id: '__try', type, x: c.x, y: c.y, flip: c.flip, angle: c.angle, next: [] });
      const ok = !overlaps(p) && (!accept || accept(p));
      RG.removePart(p);
      if (ok) return c;
    }
    return accept ? null : cands[0];
  }
  function overlaps(p, ignore) {
    const a = p.box, pad = 6;
    return E.parts.some(q => q !== p && q !== ignore && !(a.x1 + pad < q.box.x0 || a.x0 - pad > q.box.x1 || a.y1 + pad < q.box.y0 || a.y0 - pad > q.box.y1));
  }
  const VERIFIED = window.RG_VERIFIED || {};
  // true = works with pure physics when auto-placed, false = failed the test, undefined = not tested
  const tested = (srcType, tgtType) => VERIFIED[srcType + '>' + tgtType] === undefined ? undefined : !!VERIFIED[srcType + '>' + tgtType];
  const outsOf = x => (x && x.def ? RG.outputsOf(x) : x.outputs);
  const sharedSig = (a, b) => outsOf(a).find(s => b.inputs.includes(s));

  function addNext(srcId, type) {
    const src = E.byId[srcId]; if (!src) return;
    const def = RG.PARTS[type];
    const sig = sharedSig(src, def);
    let spec;
    if (sig) {
      const kind = RG.SIG[sig].kind;
      let pos = placeNext(src, type, sig);
      let verified = kind !== 'body';
      if (kind === 'body') { const v = verifiedPlacement(src, type, sig); pos = v.pos; verified = v.ok; }
      // for signals that reach (ropes, wires, noise, light...) slide up or down to find free wall space
      if (kind !== 'body') {
        for (let i = 1; i < 10; i++) {
          const test = RG.addPart({ id: '__try', type, x: pos.x, y: pos.y, flip: pos.flip, angle: pos.angle, next: [] });
          const bad = overlaps(test); RG.removePart(test);
          if (!bad) break;
          pos = candidates(src, type, sig, 0, (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 60)[0];
        }
      }
      spec = { id: newId(), type, x: pos.x, y: pos.y, flip: pos.flip, angle: pos.angle, next: [] };
      layout.parts.push(spec); RG.addPart(spec);
      src.spec.next.push(spec.id);
      const verb = { body: 'hits it (tested ✓)', field: 'will reach it', link: 'is tied to it' }[kind];
      if (verified) toast(`${src.def.emoji} ${src.def.name} → ${def.emoji} ${def.name}: the ${RG.SIG[sig].label.toLowerCase()} ${verb}.`);
      else toast(`Placed ${def.name}, but in our physics test the ${RG.SIG[sig].label.toLowerCase()} missed it. Drag it to adjust, or let 🪄 Assist help.`, true);
      RG.SFX_ok && RG.SFX_ok();
      SFX.play('click');
    } else {
      const o = src.outWorld();
      spec = { id: newId(), type, x: Math.round(o.x + 160 * src.dir), y: Math.round(o.y), flip: src.dir === -1, angle: def.defaultAngle || 0, next: [] };
      layout.parts.push(spec); RG.addPart(spec);
      src.spec.next.push(spec.id);
      toast(`Hmm. ${def.name} won't notice ${src.def.name}. ${whyNot(src, def)}`, true);
      SFX.play('sad');
    }
    afterEdit(); select(spec.id); focusPlace(E.byId[spec.id], src); coachAfterAdd();
  }
  function addFree(type, wx, wy, fromId) {
    const def = RG.PARTS[type];
    if (wx == null) { wx = cam.x; wy = cam.y; }
    const spec = { id: newId(), type, x: Math.round(wx / 10) * 10, y: Math.round(wy / 10) * 10, flip: false, angle: def.defaultAngle || 0, next: [] };
    layout.parts.push(spec); let p = RG.addPart(spec);
    for (let i = 0; i < 6 && overlaps(p); i++) { spec.y += 30; p = RG.rebuildPart(spec); }
    const src = fromId && E.byId[fromId];
    if (src) {
      const sig = sharedSig(src, def);
      if (sig) { src.spec.next.push(spec.id); src.next = src.spec.next; toast(`Linked: ${src.def.emoji} ${src.def.name} → ${def.emoji} ${def.name} (${RG.SIG[sig].icon} ${RG.SIG[sig].label}). Drag it to fine-tune.`); }
      else toast(`Placed, but not linked: ${def.name} won't react to ${src.def.name}. ${whyNot(src, def)}`, true);
    }
    if (!src && layout.parts.length === 1) toast(`${def.emoji} ${def.name} is on the wall. Now pick what it sets off.`);
    afterEdit(); select(spec.id); focusPlace(E.byId[spec.id], src); SFX.play('click');
  }
  function afterEdit() { layout.mine = true; save(); renderChain(); updateEmptyHint(); }
  function updateEmptyHint() {
    const empty = !layout.parts.length;
    $('#inv').classList.toggle('empty-board', empty);
    $('#panelToggle').classList.toggle('coach-pulse', empty);
  }

  // ---------------------------------------------------------------- why not
  const NEED = {
    sharp: 'something pointy', fire: 'a flame', noise: 'a loud noise', light: 'light shining on it', wind: 'a breeze',
    pour: 'liquid poured on it', zap: 'electricity', pull: 'a string that gets yanked', roll: 'a physical bump', push: 'a physical bump', drop: 'a physical bump',
  };
  function orList(a) { a = [...new Set(a)]; return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  function whyNot(srcDef, def) {
    if (def.inputs.includes('start')) return 'Starters go off by themselves when you press GO.';
    const srcName = srcDef.def ? srcDef.def.name : srcDef.name;
    const gives = outsOf(srcDef).map(s => RG.SIG[s].label.toLowerCase());
    return `It needs ${orList(def.inputs.map(s => NEED[s]))}, and ${srcName} only makes ${orList(gives)}.`;
  }

  // ---------------------------------------------------------------- inventory
  function cardEl(def, opts = {}) {
    const b = document.createElement('button');
    b.className = 'card' + (opts.fit ? ' fit' : '') + (opts.bad ? ' bad' : '') + (opts.shaky ? ' shaky' : '');
    b.dataset.type = def.id;
    const ins = def.inputs.map(s => `<span class="${opts.hit === s ? 'hit' : ''}" title="${RG.SIG[s].label}">${RG.SIG[s].icon}</span>`).join('');
    const outs = def.outputs.map(s => `<span title="${RG.SIG[s].label}">${RG.SIG[s].icon}</span>`).join('');
    b.innerHTML = `<span class="em">${def.emoji}</span><span class="nm">${def.name}${def.finale ? ' <small class="fin">END</small>' : ''}</span><span class="io">${ins}<span class="arrow">→</span>${outs}</span>` + ((opts.bad || opts.shaky) ? `<span class="why">${opts.why}</span>` : '');
    b.title = def.desc + ((opts.bad || opts.shaky) ? '\n\n' + opts.why : '');
    attachCardDrag(b, def.id);
    return b;
  }
  function matches(def) {
    if (filterSig && !def.inputs.includes(filterSig) && !def.outputs.includes(filterSig)) return false;
    if (query) { const q = query.toLowerCase(); if (!(def.name.toLowerCase().includes(q) || def.desc.toLowerCase().includes(q) || def.cat.toLowerCase().includes(q))) return false; }
    return true;
  }
  let arrowSeen = false, lastInvKey = null;
  function coachArrow(label) {
    const arrow = document.createElement('div');
    arrow.className = 'coach-arrow' + (arrowSeen ? ' once' : '');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = `<svg viewBox="0 0 40 52" width="34" height="44"><path d="M13 2h14v24h11L20 50 2 26h11z" fill="#ffd23f" stroke="#1b1405" stroke-width="3" stroke-linejoin="round"/></svg><span>${label}</span>`;
    arrowSeen = true;
    return arrow;
  }
  function renderInvInner() {
    const inv = $('#inv');
    // whenever what we're picking for changes, start at the top, where the parts that fit are
    const key = (sel || '') + '|' + layout.parts.length + '|' + (running ? 1 : 0);
    const keepScroll = key === lastInvKey ? inv.scrollTop : 0;
    lastInvKey = key;
    inv.innerHTML = '';
    __invScroll = keepScroll;
    const head = $('#nextHead');
    const src = sel && E.byId[sel];
    const defs = RG.PART_LIST.filter(matches);
    if (src && !running && !RG.outputsOf(src).length) {
      head.innerHTML = steps(3) + `<div class="next-title"><span class="big">${src.def.emoji}</span><span>The ${src.def.name} is a finale</span><button class="x-sel" id="xsel">done</button></div>
        <div class="next-sub">Nothing comes after it: it's the big ending. Press <b>GO!</b> to watch your machine run.</div>`;
      $('#xsel').onclick = () => select(null);
    } else if (src && !running) {
      head.innerHTML = steps(2) + `<div class="next-title"><span class="big">${src.def.emoji}</span><span>What does the ${src.def.name} set off?</span><button class="x-sel" id="xsel">done</button></div>
        <div class="next-sub">It makes <b>${RG.outputsOf(src).map(s => RG.SIG[s].icon + ' ' + RG.SIG[s].label).join(', ')}</b>. Click a part to attach it.</div>`;
      $('#xsel').onclick = () => select(null);
      const used = new Set();
      const shaky = [];
      for (const sig of RG.outputsOf(src)) {
        const all = defs.filter(d => !used.has(d.id) && d.inputs.includes(sig) && !d.inputs.includes('start'));
        all.filter(d => tested(src.type, d.id) === false).forEach(d => { used.add(d.id); shaky.push(d); });
        const list = all.filter(d => tested(src.type, d.id) !== false);
        if (!list.length) continue;
        list.forEach(d => used.add(d.id));
        const h = document.createElement('div'); h.className = 'group-h fit';
        h.innerHTML = `${RG.SIG[sig].icon} ${RG.SIG[sig].label} sets off <span class="count">${list.length}</span>`;
        inv.appendChild(h);
        const g = document.createElement('div'); g.className = 'grid';
        list.forEach(d => g.appendChild(cardEl(d, { fit: true, hit: sig })));
        if (!inv.querySelector('.coach-arrow')) { g.classList.add('coach'); g.appendChild(coachArrow('Pick what it sets off')); }
        inv.appendChild(g);
      }
      if (shaky.length) {
        const h = document.createElement('div'); h.className = 'group-h shaky'; h.innerHTML = `⚠️ Might not work here <span class="count">${shaky.length}</span>`; inv.appendChild(h);
        const g = document.createElement('div'); g.className = 'grid';
        shaky.forEach(d => g.appendChild(cardEl(d, { shaky: true, why: `It reacts to the ${src.def.name}, but it missed in our physics tests. You may need to adjust it, or rely on 🪄 Assist.` })));
        inv.appendChild(g);
      }
      const bad = defs.filter(d => !used.has(d.id));
      if (bad.length) {
        const h = document.createElement('div'); h.className = 'group-h'; h.innerHTML = `Won't react <span class="count">${bad.length}</span>`; inv.appendChild(h);
        const g = document.createElement('div'); g.className = 'grid';
        bad.forEach(d => g.appendChild(cardEl(d, { bad: true, why: whyNot(src, d) })));
        inv.appendChild(g);
      }
    } else {
      head.innerHTML = layout.parts.length
        ? steps(1) + `<div class="next-sub">Click a part on the wall, or a yellow <b class="plus">+</b> at the end of the chain, to choose what it sets off.</div>`
        : steps(0) + `<div class="next-sub">Click a <b>▶ starter</b> below to put it on the wall, or press <b>🎲 Generate</b>.</div>`;
      for (const cat of CATS) {
        const list = defs.filter(d => d.cat === cat); if (!list.length) continue;
        const h = document.createElement('div'); h.className = 'group-h' + (cat === 'Starters' ? ' fit' : ''); h.innerHTML = `${cat === 'Starters' ? '▶️ ' : cat === 'Finales' ? '🎉 ' : ''}${cat}<span class="count">${list.length}</span>`; inv.appendChild(h);
        const g = document.createElement('div'); g.className = 'grid';
        list.forEach(d => g.appendChild(cardEl(d)));
        // empty wall: a bouncing arrow points at the starters
        if (cat === 'Starters' && !layout.parts.length && !running) {
          g.classList.add('coach');
          const arrow = coachArrow('Start here: pick a starter');
          g.appendChild(arrow);
        }
        inv.appendChild(g);
      }
    }
  }
  function renderInv() { renderInvInner(); finishInv(); }
  function finishInv() { $('#inv').scrollTop = __invScroll; }
  let __invScroll = 0;
  function steps(cur) {
    const labels = ['Add a starter', 'Pick a part', 'Choose what it sets off', 'Press GO!'];
    const k = cur === 0 ? [0, 3] : [1, 2, 3];
    return `<div class="steps">${k.map((i, n) => `<span class="${i === (cur === 0 ? 0 : cur) || (cur === 3 && i === 3) ? 'on' : ''}">${n + 1}. ${labels[i]}</span>`).join('')}</div>`;
  }
  function renderSigFilter() {
    const f = $('#sigFilter'); f.innerHTML = '';
    for (const s of RG.SIG_ORDER) {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = RG.SIG[s].icon + ' ' + RG.SIG[s].label;
      b.setAttribute('aria-pressed', filterSig === s); b.title = `Show parts that use or make ${RG.SIG[s].label.toLowerCase()}`;
      b.onclick = () => { filterSig = filterSig === s ? null : s; renderSigFilter(); renderInv(); };
      f.appendChild(b);
    }
  }
  function attachCardDrag(el, type) {
    let start = null, ghost = null;
    el.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!start) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        ghost = document.createElement('div');
        ghost.className = 'ghost';
        const src = !running && sel && E.byId[sel];
        const sig = src && sharedSig(src, RG.PARTS[type]);
        ghost.innerHTML = `<span class="g-em">${RG.PARTS[type].emoji}</span><span class="g-lbl">${src ? (sig ? `links from ${src.def.emoji} ${src.def.name}` : `won't react to ${src.def.name}`) : 'drop on the wall'}</span>`;
        if (src && !sig) ghost.classList.add('bad');
        document.body.appendChild(ghost);
        $('#panel').classList.remove('open');
      }
      if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    });
    el.addEventListener('pointerup', e => {
      if (!start) return;
      const wasDrag = !!ghost;
      if (ghost) { ghost.remove(); ghost = null; }
      start = null;
      if (running) reset();
      if (wasDrag) {
        const r = cv.getBoundingClientRect();
        if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
          const w = R.screenToWorld(e.clientX - r.left, e.clientY - r.top, cw, ch); addFree(type, w.x, w.y, sel);
        }
      } else {
        if (sel && E.byId[sel]) addNext(sel, type); else addFree(type);
        if (window.innerWidth <= 860) $('#panel').classList.remove('open');
      }
    });
    el.addEventListener('pointercancel', () => { if (ghost) ghost.remove(); ghost = null; start = null; });
  }

  // ---------------------------------------------------------------- guidance
  let coachCount = 0;
  function openPicker() {
    const p = sel && E.byId[sel]; if (!p) return;
    $('#panel').classList.add('open'); $('#inv').scrollTop = 0;
    const h = $('#panel'); h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
    if (coachCount < 3) { coachCount++; toast(`Now pick what the ${p.def.name} sets off. Green cards will react.`); }
  }
  function coachAfterAdd() {
    const n = layout.parts.length;
    if (n === 2) toast('Nice! Keep clicking cards to grow the chain, then press GO!');
  }
  // yellow + bubbles at the open end of every chain, and on the selected part
  let bubbles = [];
  function bubbleAt(w) {
    const r = 18 / cam.z;
    const b = bubbles.find(b => Math.hypot(b.x - w.x, b.y - w.y) < r);
    return b ? b.id : null;
  }
  function drawBubbles(ctx) {
    bubbles = [];
    if (running) return;
    const ends = E.parts.filter(p => p.def.outputs.length && !(p.next || []).length);
    const selP = sel && E.byId[sel];
    if (selP && !ends.includes(selP)) ends.push(selP);
    if (ends.length > 12) ends.length = 12;
    const R0 = 15 / cam.z, pulse = 1 + Math.sin(performance.now() / 180) * 0.12;
    for (const p of ends) {
      const o = p.outWorld();
      const x = o.x + 30 * p.dir / Math.max(cam.z, 0.6), y = o.y - 30 / Math.max(cam.z, 0.6);
      bubbles.push({ x, y, id: p.id });
      const isSel = p === selP;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.beginPath(); ctx.arc(0, 0, R0, 0, 7); ctx.fillStyle = isSel ? '#5ee7a0' : '#ffd23f'; ctx.fill();
      ctx.lineWidth = 2.5 / cam.z; ctx.strokeStyle = '#1b1405'; ctx.stroke();
      ctx.strokeStyle = '#1b1405'; ctx.lineWidth = 3.5 / cam.z; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-R0 * 0.45, 0); ctx.lineTo(R0 * 0.45, 0); ctx.moveTo(0, -R0 * 0.45); ctx.lineTo(0, R0 * 0.45); ctx.stroke();
      ctx.restore();
      if (isSel || ends.length === 1) {
        const txt = isSel ? 'pick the next part from the list' : 'click to add the next part';
        ctx.save(); ctx.font = `600 ${13 / cam.z}px "Barlow Condensed", sans-serif`; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(txt).width, pad = 6 / cam.z, lx = x + R0 + 6 / cam.z;
        ctx.fillStyle = 'rgba(16,22,24,0.9)'; ctx.fillRect(lx, y - 10 / cam.z, tw + pad * 2, 20 / cam.z);
        ctx.fillStyle = isSel ? '#5ee7a0' : '#ffd23f'; ctx.fillText(txt, lx + pad, y + 1 / cam.z);
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- selection & toolbar
  function select(id) {
    sel = id; linkMode = false;
    renderInv(); updateToolbar();
  }
  function updateToolbar() {
    const tb = $('#toolbar');
    const p = sel && E.byId[sel];
    if (!p || running) { tb.hidden = true; return; }
    tb.hidden = false;
    $('#tbName').textContent = p.def.emoji + ' ' + p.def.name;
    tb.querySelector('[data-act=rotl]').hidden = tb.querySelector('[data-act=rotr]').hidden = !p.def.rotatable;
    tb.querySelector('[data-act=link]').setAttribute('aria-pressed', linkMode);
    positionToolbar();
  }
  function positionToolbar() {
    const tb = $('#toolbar'); const p = sel && E.byId[sel];
    if (!p || tb.hidden) return;
    const s = R.worldToScreen((p.box.x0 + p.box.x1) / 2, p.box.y0, cw, ch);
    tb.style.left = Math.max(120, Math.min(cw - 120, s.x)) + 'px'; tb.style.top = Math.max(50, s.y - 14) + 'px';
  }
  $('#toolbar').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act; if (!act) return;
    doAct(act);
  });
  function doAct(act) {
    const spec = specById(sel); if (!spec) return;
    if (act === 'next') { openPicker(); return; }
    if (act === 'flip') { spec.flip = !spec.flip; if (spec.angle) spec.angle = -spec.angle; RG.rebuildPart(spec); }
    if (act === 'rotl' || act === 'rotr') { spec.angle = Math.round(((spec.angle || 0) + (act === 'rotl' ? -1 : 1) * Math.PI / 36) * 1000) / 1000; RG.rebuildPart(spec); }
    if (act === 'link') { linkMode = !linkMode; toast(linkMode ? 'Click another part to link it (or unlink it).' : 'Link mode off.'); }
    if (act === 'del') {
      layout.parts = layout.parts.filter(s => s !== spec);
      layout.parts.forEach(s => { s.next = s.next.filter(id => id !== spec.id); });
      RG.buildWorld(layout.parts, 'edit'); sel = null; renderInv();
      const v = fitView(); if (v) { camTarget = v; userCam = false; }
    }
    afterEdit(); updateToolbar();
  }

  // ---------------------------------------------------------------- canvas input
  const pointers = new Map();
  let drag = null, pinch = null;
  function hitTest(w) {
    let best = null, ba = Infinity;
    for (const p of E.parts) {
      const b = p.box, pad = 8;
      if (w.x > b.x0 - pad && w.x < b.x1 + pad && w.y > b.y0 - pad && w.y < b.y1 + pad) {
        const a = (b.x1 - b.x0) * (b.y1 - b.y0); if (a < ba) { ba = a; best = p; }
      }
    }
    return best;
  }
  function localXY(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', e => {
    window.SFX && SFX.init();
    cv.setPointerCapture(e.pointerId);
    const s = localXY(e); pointers.set(e.pointerId, s);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null; return;
    }
    const w = R.screenToWorld(s.x, s.y, cw, ch);
    const bub = bubbleAt(w);
    if (bub) { if (running) reset(); select(bub); openPicker(); drag = null; return; }
    let p = hitTest(w);
    if (p && running) { const id = p.id; reset(); toast('Back to editing. Press GO to run it again.'); p = E.byId[id]; }
    if (p && linkMode && sel && p.id !== sel) {
      const src = specById(sel); const i = src.next.indexOf(p.id);
      if (i >= 0) { src.next.splice(i, 1); toast('Unlinked.'); }
      else {
        src.next.push(p.id);
        const sig = sharedSig(E.byId[sel], p.def);
        if (sig) toast(`Linked: ${RG.SIG[sig].icon} ${RG.SIG[sig].label}.`); else toast(`Linked, but ${p.def.name} won't react. ${whyNot(E.byId[sel], p.def)}`, true);
      }
      E.byId[sel].next = src.next; linkMode = false; afterEdit(); updateToolbar(); return;
    }
    if (p) { if (sel !== p.id) select(p.id); drag = { type: 'part', id: p.id, ox: w.x - p.spec.x, oy: w.y - p.spec.y, moved: false, sx: s.x, sy: s.y }; }
    else drag = { type: 'pan', sx: s.x, sy: s.y, cx: cam.x, cy: cam.y, moved: false };
    cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', e => {
    const s = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, s);
    mouseW = R.screenToWorld(s.x, s.y, cw, ch);
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; cam.z = clampZ(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); return; }
    if (!drag) { const bb = bubbleAt(mouseW); const h = bb ? null : hitTest(mouseW); hover = running ? null : h; cv.style.cursor = bb ? 'pointer' : h ? (running ? 'pointer' : 'grab') : 'default'; return; }
    if (Math.hypot(s.x - drag.sx, s.y - drag.sy) > 4) drag.moved = true;
    if (drag.type === 'pan' && drag.moved) { camTarget = null; userCam = true; }
    if (drag.type === 'pan') { cam.x = drag.cx - (s.x - drag.sx) / cam.z; cam.y = drag.cy - (s.y - drag.sy) / cam.z; if (drag.moved && running) setFollow(false); }
    else if (drag.moved) {
      const spec = specById(drag.id);
      const nx = Math.round((mouseW.x - drag.ox) / 10) * 10, ny = Math.round((mouseW.y - drag.oy) / 10) * 10;
      if (nx !== spec.x || ny !== spec.y) { spec.x = nx; spec.y = ny; RG.rebuildPart(spec); positionToolbar(); }
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag) return;
    if (drag.type === 'pan' && !drag.moved && !running) select(null);
    if (drag.type === 'part' && drag.moved) afterEdit();
    if (drag.type === 'part' && !drag.moved) openPicker();
    drag = null; cv.classList.remove('dragging');
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  const clampZ = z => Math.max(0.25, Math.min(2.2, z));
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const s = localXY(e); const before = R.screenToWorld(s.x, s.y, cw, ch);
    camTarget = null; userCam = true;
    cam.z = clampZ(cam.z * Math.exp(-e.deltaY * 0.0015));
    const after = R.screenToWorld(s.x, s.y, cw, ch);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
  }, { passive: false });
  $('#zoom').addEventListener('click', e => {
    const z = e.target.closest('button')?.dataset.z; if (!z) return;
    if (z === 'fit') { const v = fitView(); if (v) { camTarget = v; userCam = false; } } else { cam.z = clampZ(cam.z * parseFloat(z)); userCam = true; }
  });

  let camTarget = null;
  function panTo(p, z) { if (!p) return; camTarget = { x: (p.box.x0 + p.box.x1) / 2, y: (p.box.y0 + p.box.y1) / 2, z }; }
  // after placing a part, glide to the new zoom-to-fit (with room for the one after it)
  function focusPlace(p) {
    if (!p) return;
    const v = fitView(p); if (!v) return;
    camTarget = v; userCam = false;
  }

  // Zoom to fit: the whole machine, plus room beside its open end for the next part.
  // One part = fairly close; a big machine = zoomed out until it all fits.
  let userCam = false;
  function fitView(endPart) {
    if (!cw || !ch) return null;
    if (!E.parts.length) return { x: 900, y: 700, z: 1 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of E.parts) { x0 = Math.min(x0, p.box.x0); y0 = Math.min(y0, p.box.y0); x1 = Math.max(x1, p.box.x1); y1 = Math.max(y1, p.box.y1); }
    const end = endPart || (sel && E.byId[sel]) || chainEnd();
    if (end) {
      // reserve room where the next part would go: below for drops and pours, beside for everything else
      const o = end.outWorld();
      const sig = end.def.outputs[0];
      const off = (end.def.placeOffset && end.def.placeOffset[sig]) || RG.PLACE[sig] || { x: 200, y: 0 };
      const nx = o.x + off.x * end.dir, ny = o.y + off.y;
      const rx = off.y > 60 ? 120 : 150, ry = off.y > 60 ? 110 : 130;
      x0 = Math.min(x0, o.x - 40, nx - rx); x1 = Math.max(x1, o.x + 40, nx + rx);
      y0 = Math.min(y0, o.y - 40, ny - ry); y1 = Math.max(y1, o.y + 40, ny + ry);
      // chains mostly travel forward and down (gravity), so keep that quadrant open too
      if (end.dir === 1) x1 = Math.max(x1, o.x + 380); else x0 = Math.min(x0, o.x - 380);
      y1 = Math.max(y1, o.y + 240);
    }
    const pad = 70;
    const z = clampZ(Math.min(1.25, cw / (x1 - x0 + pad * 2), ch / (y1 - y0 + pad * 2)));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z };
  }
  function wholeView() {
    if (!E.parts.length || !cw) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of E.parts) { x0 = Math.min(x0, p.box.x0); y0 = Math.min(y0, p.box.y0); x1 = Math.max(x1, p.box.x1); y1 = Math.max(y1, p.box.y1); }
    const pad = 90;
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: clampZ(Math.min(1.2, cw / (x1 - x0 + pad * 2), ch / (y1 - y0 + pad * 2))), follow: true };
  }
  function chainEnd() {
    const ends = E.parts.filter(p => p.def.outputs.length && !(p.next || []).length);
    const last = layout.parts.length && E.byId[layout.parts[layout.parts.length - 1].id];
    return ends.includes(last) ? last : ends[ends.length - 1] || last || null;
  }
  function viewStart() {
    userCam = false;
    const v = fitView(); if (!v) return;
    camTarget = null; cam.x = v.x; cam.y = v.y; cam.z = v.z; clampCam();
  }
  // keep the pegboard filling the view: never scroll far past its edges
  function clampCam() {
    // allow a little past the edges (the wooden frame shows) so machines near an edge can still be centered
    const m = 240, hw = cw / 2 / cam.z, hh = ch / 2 / cam.z;
    if (hw * 2 >= WORLD.w + m * 2) cam.x = WORLD.w / 2; else cam.x = Math.max(hw - m, Math.min(WORLD.w + m - hw, cam.x));
    if (hh * 2 >= WORLD.h + m * 2 + 60) cam.y = WORLD.h / 2; else cam.y = Math.max(hh - m, Math.min(WORLD.h + 60 + m - hh, cam.y));
  }

  // Follow cam: frame a sliding window of the chain, the last 2 parts that went off and the next 3,
  // plus whatever the latest part just threw, zoomed to fit. More of the window is ahead, so it leans forward.
  let followOrder = [], finale = false;
  function followView() {
    if (!followOrder.length) followOrder = chainOrder();
    const order = followOrder.filter(p => E.byId[p.id] === p);
    if (!order.length) return null;
    let hotIdx = -1, hotT = -1;
    order.forEach((p, i) => { if (p.fired && p.firedAt >= hotT) { hotT = p.firedAt; hotIdx = i; } });
    const from = Math.max(0, hotIdx - 1), to = Math.min(order.length - 1, Math.max(hotIdx, 0) + 3);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    for (let i = from; i <= to; i++) { const b = order[i].box; grow(b.x0, b.y0, b.x1, b.y1); }
    // keep the thing in flight in view (the ball, the toast, the cat...)
    const hot = order[hotIdx];
    if (hot) for (const b of Matter.Composite.allBodies(E.world)) {
      if (b.isStatic || !b.rg || b.rg.emitter !== hot || b.rg.kind === 'pour') continue;
      if (Math.hypot(b.velocity.x, b.velocity.y) < 0.4) continue;
      grow(b.bounds.min.x, b.bounds.min.y, b.bounds.max.x, b.bounds.max.y);
    }
    const pad = 110;
    const z = Math.max(0.45, Math.min(1.3, cw / (x1 - x0 + pad * 2), ch / (y1 - y0 + pad * 2)));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, follow: true };
  }

  // ---------------------------------------------------------------- run
  function setFollow(v) { follow = v; $('#follow').setAttribute('aria-pressed', v); }
  function go() {
    window.SFX && SFX.init();
    if (running) return reset();
    if (!layout.parts.length) { toast('Add some parts first, or press 🎲 Generate.'); return; }
    running = true; $('#go').textContent = '⟲ RESET'; $('#panel').classList.remove('open'); $('#go').classList.add('running');
    RG.start(layout.parts); followOrder = []; finale = false;
    status('');
    updateToolbar(); renderInv(); renderChain();
    if (!E.parts.some(p => p.def.inputs.includes('start'))) toast('Nothing to start it! Add a ▶ starter part.', true);
  }
  function reset() {
    running = false; finale = false; $('#go').textContent = '▶ GO!'; $('#go').classList.remove('running');
    RG.buildWorld(layout.parts, 'edit'); status(''); updateToolbar(); renderInv(); renderChain();
    const v = fitView(); if (v) { camTarget = v; userCam = false; }
  }
  RG.on('trigger', () => { lastChainUpdate = 0; });
  let assistExplained = false;
  RG.on('assist', () => { lastChainUpdate = 0; if (!assistExplained) { assistExplained = true; toast('🪄 Magic assist! A part needed a helping hand. Turn off Assist for pure physics.'); } });
  RG.on('complete', () => {
    setTimeout(() => {
      if (!running || !E.runState || !E.runState.win) return;
      finale = true;
      if (follow) { const v = wholeView(); if (v) camTarget = v; }
    }, 1400);
    const secs = E.time.toFixed(1);
    const n = E.assists || 0;
    status('MACHINE COMPLETE!', `${E.parts.length} parts went off in ${secs} seconds · ${n ? `🪄 ${n} magic assist${n === 1 ? '' : 's'}` : 'pure physics, no magic!'}`);
    SFX.play('fanfare');
    const w0 = R.screenToWorld(0, 0, cw, ch), w1 = R.screenToWorld(cw, 0, cw, ch);
    for (let i = 0; i < 8; i++) RG.B.later(i * 0.12, () => RG.B.burst(w0.x + Math.random() * (w1.x - w0.x), w0.y + 20, 30, { type: 'confetti', speed: 6, angle: Math.PI / 2, spread: 2, life: 2.4, gravity: 0.12, size: 5 }));
  });
  RG.on('stalled', () => {
    const fired = E.parts.filter(p => p.fired).length;
    const stuck = E.parts.filter(p => p.fired).flatMap(p => p.next.map(id => E.byId[id])).find(t => t && !t.fired);
    status('STALLED', `${fired} of ${E.parts.length} went off.${stuck ? ` The ${stuck.def.name} never got set off.` : ''} Reset, nudge a part and try again.`);
    SFX.play('sad'); lastChainUpdate = 0;
  });
  RG.on('unstalled', () => status(''));

  // ---------------------------------------------------------------- chain strip
  let lastChainUpdate = 0;
  function chainOrder() {
    const seen = new Set(), order = [];
    const q = E.parts.filter(p => p.def.inputs.includes('start'));
    while (q.length) {
      const p = q.shift(); if (seen.has(p.id)) continue; seen.add(p.id); order.push(p);
      for (const id of p.next.concat(p.autoNext || [])) { const t = E.byId[id]; if (t && !seen.has(t.id)) q.push(t); }
    }
    for (const p of E.parts) if (!seen.has(p.id)) order.push(p);
    return order;
  }
  function renderChain() {
    const el = $('#chain');
    const order = chainOrder();
    const fired = order.filter(p => p.fired).length;
    const stuckIds = new Set();
    if (E.runState && E.runState.stalled) E.parts.filter(p => p.fired).forEach(p => p.next.forEach(id => { const t = E.byId[id]; if (t && !t.fired) stuckIds.add(id); }));
    const latest = order.filter(p => p.fired).sort((a, b) => b.firedAt - a.firedAt)[0];
    el.innerHTML = `<span class="lbl">${running ? `<b>${fired}/${order.length}</b> triggered` : `Chain · <b>${order.length}</b> parts`}</span>` +
      order.map((p, i) => `<span class="link">${i ? '<span class="arr">▸</span>' : ''}<button class="node ${p.fired ? 'done' : ''} ${p.assisted ? 'magic' : ''} ${latest === p && running ? 'hot' : ''} ${stuckIds.has(p.id) ? 'stuck' : ''}" data-id="${p.id}" title="${p.def.name}${p.assisted ? ' (needed a magic assist)' : ''}">${p.def.emoji}</button></span>`).join('');
  }
  $('#chain').addEventListener('click', e => { const id = e.target.closest('.node')?.dataset.id; if (!id) return; const p = E.byId[id]; panTo(p); if (!running) select(id); });

  // ---------------------------------------------------------------- generator
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function generate(n, seed) {
    const rand = rng(seed ?? (Math.random() * 1e9));
    const pick = a => a[Math.floor(rand() * a.length)];
    layout = { parts: [] }; nid = 1;
    RG.buildWorld([], 'edit');
    const starters = RG.PART_LIST.filter(d => d.inputs.includes('start'));
    const others = RG.PART_LIST.filter(d => !d.inputs.includes('start') && !d.finale);
    const finales = RG.PART_LIST.filter(d => d.finale);
    const used = {}, banned = new Set();
    const inBounds = p => { const b = p.box; return b.x0 > 30 && b.x1 < WORLD.w - 30 && b.y0 > 40 && b.y1 < WORLD.h - 30; };
    const st = pick(starters);
    const spec0 = { id: newId(), type: st.id, x: 220, y: 300, flip: false, angle: 0, next: [] };
    layout.parts.push(spec0); RG.addPart(spec0); used[st.id] = 1;
    const lastPart = () => E.byId[layout.parts[layout.parts.length - 1].id];
    const deadline = performance.now() + 2500; // keep generation snappy; the fallback below still guarantees a working machine
    const late = () => performance.now() > deadline;

    function extend() {
      let cur = lastPart();
      while (layout.parts.length < n - 1) {
        let placed = false;
        for (let attempt = 0; attempt < 30 && !placed; attempt++) {
          const outs = RG.outputsOf(cur);
          const low = cur.box.y1 > WORLD.h - 520, high = cur.box.y0 < 300;
          let cands = others.filter(d => d.inputs.some(s => outs.includes(s)) && !banned.has(cur.type + '>' + d.id) && tested(cur.type, d.id) !== false);
          if (low) { const climb = cands.filter(d => d.inputs.some(s => outs.includes(s) && RG.SIG[s].kind !== 'body')); if (climb.length) cands = climb; }
          if (!cands.length) break;
          const weights = cands.map(d => 1 / (1 + (used[d.id] || 0) * 6));
          let r = rand() * weights.reduce((a, b) => a + b, 0), def = cands[0];
          for (let k = 0; k < cands.length; k++) { r -= weights[k]; if (r <= 0) { def = cands[k]; break; } }
          const sigs = outs.filter(s => def.inputs.includes(s));
          const sig = low ? (sigs.find(s => RG.SIG[s].kind !== 'body') || sigs[0]) : pick(sigs);
          const kind = RG.SIG[sig].kind;
          let dx = 0, dy = 0;
          if (kind === 'link') { dx = rand() * 120; dy = low ? -(260 + rand() * 300) : high ? rand() * 220 : (rand() - 0.5) * 380; }
          else if (kind === 'field') {
            const lim = { noise: 260, light: 320, wind: 120, fire: 70 }[sig];
            dy = low ? -lim * (0.6 + rand() * 0.4) : (rand() - 0.5) * lim;
            if (sig === 'fire' && (cur.def.placeOffset || {}).fire) dy = 0;
          }
          let pos;
          if (kind === 'body') { const v = verifiedPlacement(cur, def.id, sig, inBounds); if (!v.ok) { banned.add(cur.type + '>' + def.id); continue; } pos = v.pos; }
          else pos = placeNext(cur, def.id, sig, dx, dy, inBounds);
          if (!pos) continue;
          const ns = { id: newId(), type: def.id, x: pos.x, y: pos.y, flip: pos.flip, angle: pos.angle, next: [] };
          const p = RG.addPart(ns);
          layout.parts.push(ns); cur.spec.next.push(ns.id); cur.next = cur.spec.next;
          used[def.id] = (used[def.id] || 0) + 1; cur = p; placed = true;
        }
        if (!placed) break;
      }
    }
    // add a finale the last part can set off; tries several spots for reaching signals
    function addFinaleOnce() {
      const cur = lastPart();
      const outs = RG.outputsOf(cur);
      const opts = finales.filter(d => d.inputs.some(s => outs.includes(s)) && !banned.has(cur.type + '>' + d.id) && tested(cur.type, d.id) !== false);
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      for (const def of opts) {
        const sig = outs.find(s => def.inputs.includes(s));
        let pos = null;
        if (RG.SIG[sig].kind === 'body') { const v = verifiedPlacement(cur, def.id, sig, inBounds); if (v.ok) pos = v.pos; }
        else for (const dy of [0, -140, 140, -260, 260, -380]) { pos = placeNext(cur, def.id, sig, 0, dy, inBounds); if (pos) break; }
        if (!pos) continue;
        const ns = { id: newId(), type: def.id, x: pos.x, y: pos.y, flip: pos.flip, angle: pos.angle, next: [] };
        RG.addPart(ns); layout.parts.push(ns); cur.spec.next.push(ns.id); cur.next = cur.spec.next;
        return true;
      }
      return false;
    }
    // if no finale fits, rebuild the last couple of parts with fresh choices and try again
    function ensureFinale() {
      for (let k = 0; k < 12 && !late(); k++) {
        if (addFinaleOnce()) return true;
        if (layout.parts.length <= 2) { extend(); continue; }
        truncateAt(layout.parts[Math.max(1, layout.parts.length - 2)].id);
        extend();
      }
      return false;
    }
    // drop the part with this id and everything after it in the chain
    function truncateAt(id) {
      const i = layout.parts.findIndex(s => s.id === id);
      if (i <= 0) return;
      for (const s of layout.parts.slice(i)) { const p = E.byId[s.id]; if (p) RG.removePart(p); }
      layout.parts = layout.parts.slice(0, i);
      for (const s of layout.parts) { s.next = s.next.filter(x => layout.parts.some(q => q.id === x)); const p = E.byId[s.id]; if (p) p.next = s.next; }
    }

    extend(); ensureFinale();
    // test the whole machine with pure physics; rebuild from any link that doesn't really work
    let ok = false;
    for (let tries = 0; tries < 20 && !late(); tries++) {
      const res = RG.simulate(layout.parts);
      if (res.win) { ok = true; break; }
      if (!res.miss || !res.miss.from) break;
      const fromDef = RG.PARTS[res.miss.fromType];
      const prev = layout.parts.find(s => s.next.includes(res.miss.from));
      if ((fromDef.passthrough || fromDef.passMap) && prev) {
        // a pass-through part only passes on what it was fed (a car jams in a funnel), so the real
        // culprit is the link into it: ban that and rebuild from there
        banned.add(prev.type + '>' + res.miss.fromType);
        truncateAt(res.miss.from);
      } else {
        banned.add(res.miss.fromType + '>' + res.miss.toType);
        truncateAt(res.miss.to);
      }
      extend(); ensureFinale();
    }
    if (!ok) {
      // keep only the part of the chain that works by itself
      const res = RG.simulate(layout.parts);
      if (!res.win && res.miss && res.miss.from) truncateAt(res.miss.to);
    }
    // make sure it ends with a finale: walk back from the end until one fits and the machine still works
    const endsWithFinale = () => RG.PARTS[layout.parts[layout.parts.length - 1].type].finale;
    for (let k = 0; k < 6 && !endsWithFinale() && layout.parts.length > 1; k++) {
      if (addFinaleOnce()) { if (RG.simulate(layout.parts).win) break; truncateAt(layout.parts[layout.parts.length - 1].id); }
      if (layout.parts.length > 3) truncateAt(layout.parts[layout.parts.length - 1].id);
    }
    RG.buildWorld(layout.parts, 'edit');
    sel = null; save(); updateEmptyHint(); renderInv(); renderChain(); updateToolbar(); viewStart();
    return layout.parts.length;
  }
  RG.generate = generate;
  RG.buildVerifiedTable = function () {
    const table = {};
    const defs = RG.PART_LIST;
    for (const s of defs) {
      for (const t of defs) {
        if (t.inputs.includes('start')) continue;
        const srcSpec = { id: 'a', type: s.id, x: 1500, y: 900, angle: s.defaultAngle || 0, next: [] };
        RG.buildWorld([srcSpec], 'edit');
        const sp = E.byId.a;
        const sig = RG.outputsOf(sp).find(x => t.inputs.includes(x));
        if (!sig) continue;
        if (RG.SIG[sig].kind !== 'body') { table[s.id + '>' + t.id] = 1; continue; }
        // for pass-through parts, test with the kind of thing that would flow in for this signal
        if (s.passMap) {
          const feeder = sig === 'pour' ? 'water_tank' : 'marble_hopper';
          const fs = { id: 'f', type: feeder, x: 1500, y: 700, next: ['a'] };
          srcSpec.next = []; RG.buildWorld([fs, srcSpec], 'edit');
        }
        table[s.id + '>' + t.id] = verifiedPlacement(E.byId.a, t.id, sig).ok ? 1 : 0;
      }
    }
    RG.buildWorld(layout.parts, 'edit');
    return table;
  };
  RG.placeNext = placeNext;
  RG.getLayout = () => layout;
  RG.setLayout = l => { layout = l; RG.buildWorld(layout.parts, 'edit'); renderChain(); viewStart(); };

  // ---------------------------------------------------------------- welcome
  const EXAMPLE = { n: 12, seed: 11 };
  function showWelcome() {
    if (running) reset();
    $('#wContinue').hidden = !(layout.mine && layout.parts.length);
    $('#welcome').hidden = false;
  }
  function closeWelcome() { $('#welcome').hidden = true; SFX.init(); }
  function loadExample() { generate(EXAMPLE.n, EXAMPLE.seed); layout.example = true; save(); viewStart(); }
  $('#wExample').onclick = () => {
    closeWelcome(); loadExample(); setFollow(true);
    toast('An example machine. Press Reset any time, then click a part to change it.');
    setTimeout(() => { if (!running) go(); }, 900);
  };
  $('#wBuild').onclick = () => {
    closeWelcome(); if (running) reset();
    layout = { parts: [], mine: true }; RG.buildWorld([], 'edit'); sel = null; save();
    renderInv(); renderChain(); updateToolbar(); updateEmptyHint(); viewStart();
    $('#panel').classList.add('open');
    toast('Click a ▶ starter to put it on the wall.');
  };
  $('#wSurprise').onclick = () => {
    closeWelcome(); toast('🔧 Building and testing a machine…');
    setTimeout(() => {
      generate(14); viewStart(); setFollow(true); SFX.play('magic');
      toast('A random machine, tested to work without magic. Watch it go!');
      setTimeout(() => { if (!running) go(); }, 900);
    }, 40);
  };
  $('#wContinue').onclick = () => { closeWelcome(); viewStart(); };
  $('#wHelp').onclick = () => { $('#helpBox').hidden = false; };
  $('#home').onclick = showWelcome;

  // ---------------------------------------------------------------- buttons & keys
  $('#go').onclick = go;
  $('#slow').onclick = () => { E.slowmo = !E.slowmo; $('#slow').setAttribute('aria-pressed', E.slowmo); };
  $('#follow').onclick = () => setFollow(!follow);
  $('#assist').onclick = () => { E.assist = !E.assist; $('#assist').setAttribute('aria-pressed', E.assist); toast(E.assist ? 'Assist on: released objects get steered toward their target, and stuck chains get a nudge.' : 'Assist off: pure physics. Good luck!'); };
  $('#gen').onclick = () => {
    if (running) reset(); SFX.init();
    const n = Math.max(3, Math.min(40, parseInt($('#genN').value) || 14));
    toast('🔧 Building and testing a machine…');
    setTimeout(() => { const got = generate(n); viewStart(); toast(`Generated a ${got}-part machine, tested to work without magic. Press GO!`); SFX.play('magic'); }, 40);
  };
  let clearArmed = null;
  $('#clear').onclick = () => {
    const btn = $('#clear');
    if (!layout.parts.length) { toast('The wall is already empty.'); return; }
    if (!clearArmed) {
      btn.classList.add('armed'); btn.innerHTML = '⚠️<span class="l"> Really clear?</span>';
      toast(`Click again to remove all ${layout.parts.length} parts. This can't be undone.`, true);
      clearArmed = setTimeout(disarmClear, 4000);
      return;
    }
    disarmClear();
    if (running) reset(); layout = { parts: [], mine: true }; RG.buildWorld([], 'edit'); sel = null; save(); renderInv(); renderChain(); updateToolbar(); updateEmptyHint(); viewStart(); toast('Board cleared. Click a ▶ starter to begin.');
  };
  function disarmClear() { clearTimeout(clearArmed); clearArmed = null; const btn = $('#clear'); btn.classList.remove('armed'); btn.innerHTML = '🧹<span class="l"> Clear</span>'; }
  $('#mute').onclick = () => { SFX.init(); const m = !SFX.isMuted(); SFX.setMuted(m); $('#mute').textContent = m ? '🔇' : '🔊'; $('#mute').setAttribute('aria-pressed', m); };
  $('#help').onclick = () => { $('#helpBox').hidden = false; };
  $('#helpClose').onclick = () => { $('#helpBox').hidden = true; SFX.init(); try { localStorage.setItem(KEY + '.seenHelp', '1'); } catch (e) { /* ignore */ } };
  $('#panelToggle').onclick = () => $('#panel').classList.toggle('open');
  $('#search').addEventListener('input', e => { query = e.target.value.trim(); renderInv(); });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || !$('#welcome').hidden || !$('#helpBox').hidden) return;
    if (e.code === 'Space') { e.preventDefault(); go(); return; }
    if (running) return;
    if (e.key === 'Escape') select(null);
    if (!sel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') doAct('del');
    else if (e.key === 'f' || e.key === 'F') doAct('flip');
    else if ((e.key === 'q' || e.key === 'Q') && E.byId[sel]?.def.rotatable) doAct('rotl');
    else if ((e.key === 'e' || e.key === 'E') && E.byId[sel]?.def.rotatable) doAct('rotr');
    else if (e.key === 'l' || e.key === 'L') doAct('link');
  });
  $('#sigLegend').innerHTML = RG.SIG_ORDER.map(s => `<span>${RG.SIG[s].icon} ${RG.SIG[s].label}</span>`).join('');

  // ---------------------------------------------------------------- loop
  let last = performance.now(), acc = 0;
  const PLAY_SPEED = 0.6;
  const overlay = {
    before(ctx) {
      if (running) return;
      const p = sel && E.byId[sel];
      if (hover && hover !== p) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5 / cam.z; const b = hover.box; ctx.strokeRect(b.x0 - 6, b.y0 - 6, b.x1 - b.x0 + 12, b.y1 - b.y0 + 12); ctx.restore(); }
      if (!p) return;
      const b = p.box;
      ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeRect(b.x0 - 8, b.y0 - 8, b.x1 - b.x0 + 16, b.y1 - b.y0 + 16); ctx.restore();
      const z = p.zoneWorld();
      if (z && !p.def.inputs.includes('start')) {
        ctx.save(); ctx.fillStyle = 'rgba(94,231,160,0.16)'; ctx.strokeStyle = 'rgba(94,231,160,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.restore();
        p.def.inputs.forEach((s, i) => R.emoji(ctx, RG.SIG[s].icon, z.x0 + 10 + i * 20, z.y0 - 12, 16));
      }
      const o = p.outWorld();
      ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#3a2a05'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, 7, 0, 7); ctx.fill(); ctx.stroke();
      for (const s of p.def.outputs) {
        const rng = RG.SIG[s].range; if (!rng || RG.SIG[s].kind !== 'field') continue;
        ctx.strokeStyle = RG.SIG[s].color; ctx.globalAlpha = 0.25; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(o.x, o.y, rng, 0, 7); ctx.stroke();
      }
      ctx.restore();
      p.def.outputs.forEach((s, i) => R.emoji(ctx, RG.SIG[s].icon, o.x + 18 + i * 20, o.y - 16, 16));
    },
    after(ctx) {
      drawBubbles(ctx);
      if (linkMode && sel && E.byId[sel]) { const o = E.byId[sel].outWorld(); ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(mouseW.x, mouseW.y); ctx.stroke(); ctx.restore(); }
    },
    get selected() { return sel && E.byId[sel]; },
  };
  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    if (running) {
      // playback speed: normal is 60% of real time, slow-mo 30%; physics steps are identical either way
      const stepMs = (1000 / 60) / (E.slowmo ? 0.3 : PLAY_SPEED);
      acc += dt; let n = 0;
      while (acc >= stepMs && n < 4) { RG.step(); acc -= stepMs; n++; }
      if (n === 4) acc = 0;
      R.alpha = Math.min(1, acc / stepMs);
      if (follow && !finale) { const v = followView(); if (v) camTarget = v; }
      if (now - lastChainUpdate > 250) { lastChainUpdate = now; renderChain(); }
    } else {
      R.alpha = 1;
      E.time += dt / 1000;
      // cosmetic particles keep moving in edit mode
      for (const q of E.particles) { q.t += dt / 1000; q.x += q.vx; q.y += q.vy; q.vy += q.g; }
      E.particles = E.particles.filter(q => q.t < q.life);
    }
    if (camTarget) {
      // follow cam glides slowly (frame-rate independent); editing moves snap a bit quicker
      const kp = camTarget.follow ? 1 - Math.exp(-dt / 1000 * 2.0) : 0.08;
      const kz = camTarget.follow ? 1 - Math.exp(-dt / 1000 * 1.4) : 0.08;
      cam.x += (camTarget.x - cam.x) * kp; cam.y += (camTarget.y - cam.y) * kp;
      if (camTarget.z) cam.z += (camTarget.z - cam.z) * kz;
      if (!running && Math.hypot(camTarget.x - cam.x, camTarget.y - cam.y) < 2 && (!camTarget.z || Math.abs(camTarget.z - cam.z) < 0.01)) camTarget = null;
    }
    if (!drag || drag.type !== 'pan') clampCam();
    R.draw(ctx, cw, ch, dpr, overlay);
    positionToolbar();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    resize();
    renderSigFilter();
    let loaded = null;
    try { loaded = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || 'null'); } catch (e) { loaded = null; }
    // an untouched example from an older version gets replaced by the current one
    if (loaded && loaded.example && !loaded.mine) loaded = null;
    if (loaded && loaded.parts && loaded.parts.length && loaded.parts.every(s => RG.PARTS[s.type])) {
      layout = loaded; RG.buildWorld(layout.parts, 'edit');
    } else loadExample();
    viewStart();
    renderInv(); renderChain(); updateEmptyHint();
    showWelcome();
    // the page frame can settle a moment after load; frame again once it has
    requestAnimationFrame(() => requestAnimationFrame(() => { resize(); if (!userCam) viewStart(); }));
    requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
})();
