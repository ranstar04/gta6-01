// All audio is synthesized with WebAudio — no files, no network.
// Engine hum, two-tone siren, gunshots, pickup chimes, mission jingle, ambient music loop.
// Audio starts on the first user gesture (browser rule); headless runs stay silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 58;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0);
    } catch (e) { /* ignore */ }
  }

  // Original ambient loop: warm major arpeggio, one chord per bar.
  const CHORDS = [
    [261.6, 329.6, 392.0, 493.9], // C major
    [220.0, 261.6, 329.6, 415.3], // A minor
    [174.6, 220.0, 261.6, 349.2], // F major
    [196.0, 246.9, 293.7, 392.0], // G major
  ];

  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      const note = chord[musicStep % 4];
      tone(note * 2, 0.5, 'triangle', 0.05);
      if (musicStep % 8 === 0) tone(chord[0], 1.6, 'sine', 0.06);
      musicStep += 1;
    }, 320);
  }

  return {
    unlock() {
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        startMusic();
      }
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    setEngine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      const target = driving ? 0.05 + speed01 * 0.12 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      // Shift BOTH detuned saws together so the 3 Hz beat stays constant at
      // any speed; shifting only the first turned the pair into an odd
      // interval (165 Hz vs a fixed 58 Hz) at full throttle.
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(58 + speed01 * 110, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx) return;
      if (on && !sirenTimer) {
        let high = true;
        sirenTimer = setInterval(() => {
          if (!muted) tone(high ? 660 : 520, 0.28, 'sine', 0.045);
          high = !high;
        }, 300);
      } else if (!on && sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
    shot() { noise(0.14, 0.35, 2500); tone(180, 0.08, 'square', 0.12, 0, 60); },
    punch() { noise(0.08, 0.25, 900); },
    pickup() { tone(880, 0.12, 'sine', 0.18); tone(1318, 0.18, 'sine', 0.18, 0.09); },
    shell() { tone(1046, 0.15, 'triangle', 0.2); tone(1568, 0.25, 'triangle', 0.2, 0.1); },
    missionPass() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.11));
    },
    busted() { [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.12, i * 0.18)); },
    crash() { noise(0.3, 0.4, 700); },
    click() { tone(1200, 0.05, 'square', 0.08); },
  };
}
