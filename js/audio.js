// ===== Tiny synthesized sound effects (no audio files needed) =====
const Sound = (() => {
  let ac = null, master = null, muted = false, rainGain = null, rainSrc = null;

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }

  function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol = 0.2, freq = 1200) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(master); src.start();
  }

  const fx = {
    click:   () => tone(900, 0.05, 'square', 0.06),
    pop:     () => tone(320, 0.14, 'sine', 0.35, 260),
    plant:   () => { tone(200, 0.1, 'triangle', 0.25, 120); noise(0.12, 0.12, 600); },
    chime:   () => { tone(523, 0.25, 'sine', 0.25); tone(659, 0.25, 'sine', 0.25, 0, 0.12); tone(784, 0.4, 'sine', 0.25, 0, 0.24); },
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.22, 0, i * 0.11)); },
    chirp:   () => { tone(1900, 0.07, 'sine', 0.1, 900); tone(2300, 0.07, 'sine', 0.1, 700, 0.1); },
    hoot:    () => { tone(420, 0.25, 'sine', 0.18, -60); tone(400, 0.3, 'sine', 0.18, -60, 0.3); },
    croak:   () => tone(140, 0.18, 'sawtooth', 0.08, -40),
    buzz:    () => tone(210, 0.35, 'sawtooth', 0.04, 20),
    quack:   () => tone(520, 0.14, 'square', 0.07, -180),
    ooh:     () => { tone(330, 0.2, 'sine', 0.14, 140); tone(330, 0.2, 'sine', 0.14, 140, 0.22); },
    trumpet: () => tone(280, 0.5, 'sawtooth', 0.1, 220),
    splash:  () => noise(0.35, 0.25, 900),
    munch:   () => { noise(0.06, 0.15, 400); noise(0.06, 0.15, 400); },
    seed:    () => { tone(880, 0.1, 'sine', 0.15); tone(1320, 0.18, 'sine', 0.15, 0, 0.08); },
    sparkle: () => { tone(1568, 0.12, 'sine', 0.1); tone(2093, 0.2, 'sine', 0.1, 0, 0.07); },
  };

  function play(name) { if (!ac || muted) return; const f = fx[name]; if (f) f(); }

  function setRain(on) {
    if (!ac) return;
    if (on && !rainSrc) {
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      rainSrc = ac.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      rainGain = ac.createGain(); rainGain.gain.value = 0.0001;
      rainSrc.connect(f).connect(rainGain).connect(master);
      rainSrc.start();
      rainGain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 2);
    } else if (!on && rainSrc) {
      const src = rainSrc, g = rainGain;
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 2);
      setTimeout(() => { try { src.stop(); } catch (e) {} }, 2200);
      rainSrc = null; rainGain = null;
    }
  }

  return { init, resume, play, setMuted, setRain, get ready() { return !!ac; } };
})();
