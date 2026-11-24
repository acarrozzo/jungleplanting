// ===== Tiny synthesized sound effects (no audio files needed) =====
const Sound = (() => {
  let ac = null, master = null, muted = false, voicesOn = true, rainGain = null, rainSrc = null;

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); unlockVoice(); }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; if (m) hush(); }

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
    growl:   () => { tone(120, 0.35, 'sawtooth', 0.07, -30); tone(100, 0.3, 'sawtooth', 0.07, -20, 0.22); },
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
    squawk:  () => squawk(0),
    chomp:   () => { tone(160, 0.12, 'square', 0.12, -60); noise(0.1, 0.2, 700); tone(130, 0.1, 'square', 0.1, -40, 0.16); },
    whale:   () => { tone(170, 1.3, 'sine', 0.3, 110); tone(260, 1.1, 'sine', 0.2, -90, 0.7); tone(140, 1.4, 'triangle', 0.12, 60, 1.2); },
  };

  function play(name) { if (!ac || muted) return; const f = fx[name]; if (f) f(); }

  // Spoken words for the parrot and the whale, using the device's own voice. iPads only allow speech after a first tap,
  // so the first tap speaks a silent word to unlock it.
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  // Browsers only allow speech after a real tap. Words asked for before that are held back silently and can jam the
  // queue so that later words never play, so: nothing is spoken until the first tap, the first tap unlocks speech
  // (Safari needs a word spoken inside a tap), and an utterance that never starts is cleared before the next one.
  let voiceUnlocked = false, waitingSince = 0, current = null;
  const tapped = () => voiceUnlocked || (navigator.userActivation ? navigator.userActivation.hasBeenActive : false);
  function queueWords(u, done) { current = u; waitingSince = performance.now(); u.onstart = () => { waitingSince = 0; }; u.onend = u.onerror = () => { waitingSince = 0; if (done) done(); }; speechSynthesis.speak(u); }
  // the device's voices, found by name (macOS and iOS have fun ones: Albert, Junior, Fred, Ralph, Bahh, Grandpa...)
  function findVoice(name) {
    if (!canSpeak || !name) return null;
    const all = speechSynthesis.getVoices(), en = all.filter(v => /^en/i.test(v.lang));
    return en.find(v => v.name === name) || en.find(v => v.name.startsWith(name + ' (English (United States))')) || en.find(v => v.name.startsWith(name)) || null;
  }
  if (canSpeak) { try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices()); } catch (e) {} }
  function unlockVoice(e) {
    if (!canSpeak || voiceUnlocked || (e && e.isTrusted === false)) return; voiceUnlocked = true;
    try { speechSynthesis.cancel(); speechSynthesis.getVoices(); const u = new SpeechSynthesisUtterance(''); u.volume = 0; queueWords(u); } catch (err) { /* no voice on this device */ }
  }
  // Safari only counts a finger lifting (not touching down) as permission to speak, so unlock on every kind of tap
  if (canSpeak) for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlockVoice, { capture: true, passive: true });
  // o: pitch, rate, volume, voice (a voice name), done (called when the words finish). Returns false if nothing will be said.
  function say(text, o = {}) {
    if (!canSpeak || muted || !voicesOn || !tapped()) return false;
    const words = String(text).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim(); if (!words) return false;
    try {
      const u = new SpeechSynthesisUtterance(words), v = findVoice(o.voice);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.pitch = o.pitch != null ? o.pitch : 1; u.rate = o.rate != null ? o.rate : 1; u.volume = o.volume != null ? o.volume : 0.9;
      if (speechSynthesis.paused) speechSynthesis.resume(); // Chrome can get stuck paused
      if (waitingSince && performance.now() - waitingSince > 2500) { speechSynthesis.cancel(); waitingSince = 0; setTimeout(() => queueWords(u, o.done), 80); return true; } // jammed: clear it first
      queueWords(u, o.done);
      return true;
    } catch (e) { return false; /* speech is a bonus; ignore failures */ }
  }

  // ---------- the parrot's voice ----------
  // A browser voice cannot be run through sound effects, so the parrot mixes three things: a synthesized squawk,
  // a synthesized squawky babble (one honk per syllable), and the device's voice (a fun one, pitched up).
  let distCurve = null;
  function rasp() { if (distCurve) return distCurve; const n = 1024, k = 22; distCurve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; distCurve[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return distCurve; }
  // One squawk: two slightly out-of-tune buzzy oscillators, bent in pitch, roughened by a fast flutter and a little
  // distortion, then shaped by two "beak" resonances (formants) that slide down like "RAAWK".
  // o: f (pitch), dur, vol, shape ('rawk' down-up-down, 'up' rising, 'syll' a babble syllable), formants [F1, F2], sweep, flutter
  function squawk(delay = 0, o = {}) {
    if (!ac || muted) return 0;
    const t0 = ac.currentTime + delay, dur = o.dur || 0.34, f = o.f || 950, vol = o.vol != null ? o.vol : 0.3, shape = o.shape || 'rawk';
    const out = ac.createGain(); out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.2)); out.gain.setValueAtTime(vol, t0 + dur * 0.55); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    const pre = ac.createGain(); pre.gain.value = 0.5;
    const shaper = ac.createWaveShaper(); shaper.curve = rasp();
    const flut = ac.createGain(); flut.gain.value = 0.55;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = o.flutter || 52; lg.gain.value = 0.45; lfo.connect(lg).connect(flut.gain);
    const [F1, F2] = o.formants || [1300, 2600], sw = o.sweep != null ? o.sweep : 0.65;
    const b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter(), g2 = ac.createGain(); g2.gain.value = 0.8;
    for (const [b, F] of [[b1, F1], [b2, F2]]) { b.type = 'bandpass'; b.Q.value = 4.5; b.frequency.setValueAtTime(F, t0); b.frequency.exponentialRampToValueAtTime(F * sw, t0 + dur); }
    pre.connect(shaper).connect(flut); flut.connect(b1).connect(out); flut.connect(b2).connect(g2).connect(out);
    for (const [type, k] of [['sawtooth', 1], ['square', 1.013]]) {
      const s = ac.createOscillator(), fr = s.frequency; s.type = type;
      if (shape === 'up') { fr.setValueAtTime(f * k * 0.8, t0); fr.exponentialRampToValueAtTime(f * k * 1.45, t0 + dur); }
      else if (shape === 'syll') { fr.setValueAtTime(f * k, t0); fr.exponentialRampToValueAtTime(f * k * 0.88, t0 + dur); }
      else { fr.setValueAtTime(f * k * 0.85, t0); fr.exponentialRampToValueAtTime(f * k * 1.22, t0 + dur * 0.22); fr.exponentialRampToValueAtTime(f * k * 0.58, t0 + dur); }
      s.connect(pre); s.start(t0); s.stop(t0 + dur + 0.05);
    }
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    // a puff of breath through the upper resonance
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const ns = ac.createBufferSource(); ns.buffer = buf; ns.connect(b2); ns.start(t0);
    return dur;
  }
  // squawky babble: one honk per syllable, shaped by its vowel (parrot-sized formants), a gap between words, a rising squawk on "!"
  const VOWEL = { a: [1350, 2200], e: [900, 3000], i: [650, 3500], o: [950, 1600], u: [700, 1400], y: [700, 3300] };
  function babble(text, delay = 0, o = {}) {
    if (!ac || muted) return 0;
    const words = String(text).toLowerCase().replace(/[^a-z!' ]/g, ' ').split(/\s+/).filter(w => /[a-z]/.test(w));
    let t = delay; const base = o.f || 1050;
    for (const w of words) {
      const syl = w.match(/[aeiouy]+/g) || ['a'];
      syl.forEach((v, k) => { const dur = (o.syll || 0.085) + Math.random() * 0.045; squawk(t, { f: base * (0.82 + Math.random() * 0.42) * (k === syl.length - 1 ? 0.92 : 1), dur, vol: o.vol || 0.24, formants: VOWEL[v[0]] || VOWEL.a, sweep: 0.9, shape: 'syll', flutter: 60 }); t += dur + 0.012; });
      t += o.gap != null ? o.gap : 0.055;
    }
    if (/!\s*$/.test(text)) t += squawk(t, { shape: 'up', f: base * 1.05, dur: 0.2, vol: (o.vol || 0.24) + 0.04 }) + 0.02;
    return t - delay;
  }
  // a parrot echoes the important name at the end: "Mango Tree fully grown!" -> "Mango Tree fully grown! Mango Tree! Mango Tree!",
  // "Hello! I'm Kiwi!" -> "Hello! I'm Kiwi! Kiwi!". The name is the last run of Capitalised Words (not "A", "New", "Hello"...).
  const NOT_NAMES = new Set(['A', 'An', 'The', "I'm", 'I', 'New', 'Hello', 'Three', 'Chomp', 'Welcome', 'Squawk']);
  function parrotify(text) {
    const t = String(text).trim(), runs = []; let run = [];
    for (const w of t.split(/\s+/)) { const bare = w.replace(/[^A-Za-z']/g, ''); if (/^[A-Z]/.test(bare)) { run.push(bare); if (/[!?.,]$/.test(w)) { runs.push(run); run = []; } } else { if (run.length) runs.push(run); run = []; } }
    if (run.length) runs.push(run);
    const names = runs.map(r => { while (r.length && NOT_NAMES.has(r[0])) r = r.slice(1); return r.join(' '); }).filter(Boolean);
    const key = names.length ? names[names.length - 1] : (t.replace(/[^A-Za-z' ]/g, ' ').trim().split(/\s+/).pop() || '');
    if (!key) return t;
    const Key = key.charAt(0).toUpperCase() + key.slice(1), endsWithIt = t.replace(/[!?.\s]+$/, '').toLowerCase().endsWith(key.toLowerCase());
    return `${/[!?.]$/.test(t) ? t : t + '!'} ${Key}!${endsWithIt ? '' : ` ${Key}!`}`;
  }
  // The parrot voice styles to choose from (the game uses RULES.parrot.voice; parrot-lab.html plays them all).
  // pre / post: squawks before and after; voice: a device voice by name (falls back to the normal one); babble: honk it out first.
  const PARROT_STYLES = [
    { name: 'Squeaky squawker', about: 'Squawk, a very high voice, squawk (the family\'s pick)', pre: {}, post: { dur: 0.22, shape: 'up' }, pitch: 2, rate: 1.2 },
    { name: 'Raspy old parrot', about: 'Albert, a crackly voice, pitched up', voice: 'Albert', pre: {}, post: { dur: 0.22 }, pitch: 1.7, rate: 1.1 },
    { name: 'Little parrot', about: 'Junior, a kid voice, high and fast', voice: 'Junior', pre: { f: 1150 }, post: { dur: 0.2, shape: 'up' }, pitch: 2, rate: 1.35 },
    { name: 'Robo parrot', about: 'Fred, an old-school computer voice, pitched up', voice: 'Fred', pre: {}, post: { dur: 0.22 }, pitch: 2, rate: 1.3 },
    { name: 'Gravelly parrot', about: 'Ralph, a rough voice, pitched up', voice: 'Ralph', pre: { f: 820 }, post: { dur: 0.24 }, pitch: 2, rate: 1.2 },
    { name: 'Wobbly parrot', about: 'Bahh, a warbly bleating voice', voice: 'Bahh', pre: {}, post: { dur: 0.22, shape: 'up' }, pitch: 1.8, rate: 1.15 },
    { name: 'Grandpa parrot', about: 'Grandpa, a creaky voice, pitched way up', voice: 'Grandpa', pre: {}, post: { dur: 0.22 }, pitch: 2, rate: 1.25 },
    { name: 'Copycat (raspy)', about: 'Albert, then it echoes the name: "…grown! Mango Tree! Mango Tree!"', voice: 'Albert', repeat: true, pre: {}, post: { dur: 0.22, shape: 'up' }, pitch: 1.7, rate: 1.2 },
    { name: 'Copycat (squeaky)', about: 'A very high voice, then it echoes the name like a real parrot', repeat: true, pre: { f: 1100 }, post: { dur: 0.22, shape: 'up' }, pitch: 2, rate: 1.3 },
    { name: 'Squawk talk', about: 'No real words: one squawk per syllable, like parrot gibberish', words: false, babble: {}, pre: { dur: 0.26 } },
    { name: 'Squawk talk, then words', about: 'Parrot gibberish first, then a squeaky voice says it', babble: { syll: 0.07, gap: 0.04 }, pitch: 2, rate: 1.25 },
    { name: 'Just squawks', about: 'Three big squawks, no words at all', words: false, pre: {}, squawks: 2 },
  ];
  function parrotSay(text, style = 1) {
    if (muted) return;
    const st = PARROT_STYLES[(style | 0) - 1] || PARROT_STYLES[0];
    let t = 0;
    if (st.pre) t += squawk(0, { vol: 0.3, ...st.pre }) + 0.06;
    for (let k = 0; k < (st.squawks || 0); k++) t += squawk(t, { f: 900 + k * 180, dur: 0.3, shape: k % 2 ? 'up' : 'rawk' }) + 0.08;
    if (st.babble) t += babble(text, t, st.babble) + 0.1;
    if (st.words === false) return;
    const post = () => { if (st.post) squawk(0.05, { vol: 0.28, ...st.post }); };
    setTimeout(() => { if (!say(st.repeat ? parrotify(text) : text, { voice: st.voice, pitch: st.pitch, rate: st.rate, done: post })) post(); }, t * 1000);
  }
  function hush() { if (canSpeak) try { speechSynthesis.cancel(); } catch (e) {} }
  // the menu's talking-voices switch: off keeps the squawks and other sounds, just no spoken words
  function setVoices(on) { voicesOn = !!on; if (!voicesOn) hush(); }

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

  return { init, resume, play, setMuted, setVoices, setRain, say, hush, squawk, babble, parrotSay, parrotify, findVoice, PARROT_STYLES, get ready() { return !!ac; } };
})();
