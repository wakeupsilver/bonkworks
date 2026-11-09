// Synthesised sound effects. No audio files: everything is built from oscillators and noise.
(function () {
  const SFX = {};
  let ctx = null, master = null, noiseBuf = null, muted = false;
  let lastPlay = {};

  SFX.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = 0.55;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  SFX.setMuted = m => { muted = m; if (master) master.gain.value = m ? 0 : 0.55; };
  SFX.isMuted = () => muted;

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, o = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibDepth || 20;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    env(g, t, o.attack || 0.005, o.vol ?? 0.3, dur);
    osc.connect(g); g.connect(o.dest || master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    env(g, t, o.attack || 0.004, o.vol ?? 0.3, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  const R = (a, b) => a + Math.random() * (b - a);

  const S = {
    pop() { noise(0.12, { freq: 3000, vol: 0.7, filter: 'highpass' }); tone(180, 0.08, { to: 60, type: 'square', vol: 0.25 }); },
    bang() { noise(0.9, { freq: 900, to: 80, vol: 0.9 }); tone(90, 0.6, { to: 30, type: 'sine', vol: 0.7 }); noise(0.15, { freq: 5000, vol: 0.4, filter: 'highpass' }); },
    boom() { noise(1.3, { freq: 500, to: 50, vol: 1 }); tone(60, 1, { to: 25, vol: 0.8 }); },
    click() { tone(1800, 0.03, { type: 'square', vol: 0.15 }); },
    clack(p = 1) { tone(900 * p, 0.04, { type: 'triangle', vol: 0.25 }); noise(0.03, { freq: 4000 * p, vol: 0.15, filter: 'bandpass', q: 4 }); },
    thud(v = 1) { tone(110, 0.18, { to: 50, vol: 0.45 * v }); noise(0.08, { freq: 400, vol: 0.3 * v }); },
    tink(v = 1) { tone(R(2200, 3000), 0.12, { type: 'sine', vol: 0.18 * v }); },
    clang() { [220, 331, 467, 612].forEach((f, i) => tone(f * R(.98, 1.02), 1.2, { type: 'triangle', vol: 0.18 })); noise(0.1, { freq: 3000, vol: 0.4 }); },
    boing() { tone(140, 0.45, { to: 520, slide: 0.12, type: 'sine', vol: 0.35, vib: 18, vibDepth: 60 }); },
    sproing() { tone(200, 0.6, { to: 900, slide: 0.2, type: 'triangle', vol: 0.3, vib: 25, vibDepth: 120 }); },
    whoosh() { noise(0.6, { freq: 300, to: 3000, filter: 'bandpass', q: 1.5, vol: 0.5, attack: 0.15 }); },
    wind() { noise(2.2, { freq: 500, to: 1400, filter: 'bandpass', q: 0.8, vol: 0.35, attack: 0.4 }); },
    zap() { tone(80, 0.35, { to: 1600, type: 'sawtooth', vol: 0.18 }); noise(0.3, { freq: 6000, filter: 'highpass', vol: 0.2 }); },
    buzz() { tone(110, 0.8, { type: 'sawtooth', vol: 0.12, vib: 50, vibDepth: 10 }); },
    ding() { tone(1568, 0.9, { vol: 0.3 }); tone(2093, 0.7, { vol: 0.12, delay: 0.01 }); },
    gong() { [98, 147, 196, 277, 349].forEach(f => tone(f, 3, { type: 'sine', vol: 0.2, vib: 4, vibDepth: 3 })); noise(0.3, { freq: 800, vol: 0.4 }); },
    snap() { noise(0.05, { freq: 5000, filter: 'highpass', vol: 0.8 }); tone(600, 0.05, { type: 'square', to: 100, vol: 0.3 }); },
    snip() { noise(0.04, { freq: 6000, filter: 'highpass', vol: 0.5 }); noise(0.04, { freq: 7000, filter: 'highpass', vol: 0.5, delay: 0.08 }); },
    sizzle() { noise(1.2, { freq: 5000, filter: 'highpass', vol: 0.2, attack: 0.05 }); },
    fwoosh() { noise(0.7, { freq: 200, to: 1200, filter: 'lowpass', vol: 0.6, attack: 0.05 }); },
    splash() { noise(0.5, { freq: 1500, to: 400, filter: 'bandpass', q: 0.7, vol: 0.6 }); for (let i = 0; i < 5; i++) tone(R(600, 1400), 0.06, { to: R(1500, 2500), vol: 0.08, delay: i * 0.05 }); },
    drip() { tone(R(900, 1300), 0.08, { to: R(1800, 2400), vol: 0.12 }); },
    squelch() { tone(90, 0.6, { to: 55, type: 'sawtooth', vol: 0.2, vib: 9, vibDepth: 25 }); noise(0.5, { freq: 300, vol: 0.4, q: 3, filter: 'bandpass' }); },
    gloop() { tone(140, 0.3, { to: 70, type: 'sine', vol: 0.25, vib: 12, vibDepth: 30 }); },
    meow() { tone(500, 0.6, { to: 900, slide: 0.2, type: 'sawtooth', vol: 0.12, vib: 7, vibDepth: 30 }); tone(900, 0.35, { to: 450, type: 'sawtooth', vol: 0.1, delay: 0.25 }); },
    woof() { for (let i = 0; i < 2; i++) { tone(220, 0.12, { to: 120, type: 'sawtooth', vol: 0.3, delay: i * 0.22 }); noise(0.1, { freq: 700, vol: 0.3, delay: i * 0.22 }); } },
    rooster() { const n = [520, 700, 820, 620]; n.forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.2, { type: 'sawtooth', vol: 0.12, vib: 9, vibDepth: 20, delay: i * 0.2, to: i === 3 ? 380 : undefined })); },
    sneeze() { noise(0.4, { freq: 600, to: 2000, filter: 'bandpass', vol: 0.15, attack: 0.3 }); noise(0.35, { freq: 3000, filter: 'highpass', vol: 0.8, delay: 0.42 }); tone(400, 0.2, { to: 200, type: 'sawtooth', vol: 0.15, delay: 0.42 }); },
    whistle() { tone(1900, 1.5, { vol: 0.15, vib: 6, vibDepth: 40, attack: 0.3 }); noise(1.5, { freq: 2000, filter: 'bandpass', q: 8, vol: 0.2, attack: 0.3 }); },
    ring() { for (let i = 0; i < 10; i++) tone(2400, 0.06, { type: 'square', vol: 0.06, delay: i * 0.07 }); },
    tinkle() { for (let i = 0; i < 7; i++) tone(R(2500, 5000), 0.25, { vol: 0.1, delay: i * 0.03 }); noise(0.2, { freq: 7000, filter: 'highpass', vol: 0.3 }); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.18, { type: 'square', vol: 0.12, delay: i * 0.14 })); [1047, 1319, 1568].forEach(f => tone(f, 0.9, { type: 'triangle', vol: 0.06, delay: 0.42 })); },
    sad() { [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.3, vib: i === 3 ? 5 : 0, vibDepth: 8 })); },
    magic() { for (let i = 0; i < 6; i++) tone(880 * Math.pow(1.26, i), 0.2, { vol: 0.08, delay: i * 0.04 }); },
    pew() { tone(1800, 0.2, { to: 300, type: 'square', vol: 0.12 }); },
    rocket() { noise(1.4, { freq: 800, to: 3000, filter: 'bandpass', vol: 0.4, attack: 0.05 }); tone(300, 1.2, { to: 1400, type: 'sawtooth', vol: 0.06 }); },
    popcorn() { for (let i = 0; i < 12; i++) { noise(0.03, { freq: R(1500, 3500), filter: 'bandpass', q: 3, vol: 0.4, delay: R(0, 1.2) }); } },
    whirr() { tone(70, 1.6, { type: 'sawtooth', vol: 0.06, vib: 30, vibDepth: 5 }); noise(1.6, { freq: 900, filter: 'bandpass', vol: 0.12 }); },
    squeak() { tone(1400, 0.15, { to: 2000, type: 'sine', vol: 0.2, vib: 30, vibDepth: 80 }); tone(1900, 0.12, { to: 1300, vol: 0.15, delay: 0.15 }); },
    clap() { for (let i = 0; i < 2; i++) noise(0.06, { freq: 1500, filter: 'bandpass', q: 1, vol: 0.6, delay: i * 0.18 }); },
    grow() { for (let i = 0; i < 8; i++) tone(262 * Math.pow(1.122, i), 0.12, { type: 'triangle', vol: 0.1, delay: i * 0.07 }); },
    chime() { [1047, 1319, 1568].forEach((f, i) => tone(f, 0.5, { vol: 0.12, delay: i * 0.08 })); },
    creak() { tone(150, 0.5, { to: 90, type: 'sawtooth', vol: 0.08, vib: 40, vibDepth: 30 }); },
    honk() { tone(330, 0.25, { type: 'square', vol: 0.12 }); tone(415, 0.25, { type: 'square', vol: 0.1 }); },
    clink() { tone(3200, 0.15, { vol: 0.12 }); },
    rumble() { noise(1.0, { freq: 150, vol: 0.5 }); },
    hum() { tone(120, 1.4, { type: 'triangle', vol: 0.1 }); tone(240, 1.4, { type: 'sine', vol: 0.05 }); },
    kazoo() { tone(350, 0.25, { type: 'sawtooth', vol: 0.12, vib: 20, vibDepth: 15 }); tone(470, 0.4, { type: 'sawtooth', vol: 0.12, delay: 0.25, vib: 20, vibDepth: 15 }); },
    cymbal() { for (let i = 0; i < 3; i++) noise(0.35, { freq: 6000, filter: 'highpass', vol: 0.4, delay: i * 0.25 }); },
    glide() { tone(600, 0.8, { to: 300, vol: 0.06, attack: 0.1 }); noise(0.8, { freq: 1200, filter: 'bandpass', vol: 0.12, attack: 0.2 }); },
  };

  SFX.play = function (name, ...args) {
    if (!ctx || muted) return;
    const now = performance.now();
    // light throttling so dense collisions don't turn into mush
    if (lastPlay[name] && now - lastPlay[name] < 35) return;
    lastPlay[name] = now;
    const f = S[name];
    if (f) try { f(...args); } catch (e) { /* ignore audio errors */ }
  };
  SFX.names = Object.keys(S);
  window.SFX = SFX;
})();
