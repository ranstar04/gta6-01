// Audio: everything synthesized in WebAudio — engine hum, two-tone siren,
// gunshots, chimes, jingles, and a quiet original chord-loop. No audio files.
// The context starts on the first user gesture (browser rule); headless runs
// stay silent without crashing.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicGain = null;
  let muted = false;
  let musicT = 0;
  let musicStep = 0;
  let sirenPhase = 0;

  // Original progression: Am – F – C – G, one pluck per beat.
  const CHORDS = [
    [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6],
    [196.0, 261.6, 329.6],
    [196.0, 246.9, 293.7],
  ];
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass.
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();
      // Siren: one square osc, frequency flipped in update().
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.05;
      musicGain.connect(master);
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function note(freq, at, dur, type = 'sine', vol = 0.3) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
  function noiseBurst(dur, filterFreq, vol, type = 'lowpass') {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    ensure,
    setEngine(ratio, throttle) {
      if (!ctx || !engineGain) return;
      const t = ctx.currentTime;
      engineOsc1.frequency.setTargetAtTime(50 + ratio * 150 + throttle * 25, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(26 + ratio * 70, t, 0.08);
      engineGain.gain.setTargetAtTime(ratio > 0.02 ? 0.04 + ratio * 0.05 : 0.015, t, 0.1);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.1);
    },
    shot() { if (!ctx) return; noiseBurst(0.14, 1800, 0.5, 'bandpass'); note(130, ctx.currentTime, 0.1, 'sine', 0.35); },
    distantShot() { if (!ctx) return; noiseBurst(0.12, 900, 0.14, 'bandpass'); },
    punch() { if (!ctx) return; noiseBurst(0.08, 300, 0.4); },
    thud() { if (!ctx) return; note(70, ctx.currentTime, 0.2, 'sine', 0.45); },
    honk() { if (!ctx) return; const t = ctx.currentTime; note(370, t, 0.22, 'square', 0.16); note(440, t, 0.22, 'square', 0.16); },
    chime() { if (!ctx) return; const t = ctx.currentTime; note(880, t, 0.25, 'sine', 0.25); note(1318, t + 0.09, 0.3, 'sine', 0.25); },
    jingle() { if (!ctx) return; const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.12, 0.35, 'triangle', 0.28)); },
    bustedSting() { if (!ctx) return; const t = ctx.currentTime; [392, 311, 233].forEach((f, i) => note(f, t + i * 0.18, 0.4, 'triangle', 0.3)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    update(dt, wanted = 0) {
      if (!ctx) return;
      // Duck the music a little while the heat is on.
      if (musicGain) musicGain.gain.setTargetAtTime(wanted > 0 ? 0.03 : 0.05, ctx.currentTime, 0.5);
      sirenPhase += dt;
      if (sirenGain && sirenGain.gain.value > 0.005) {
        sirenOsc.frequency.value = (sirenPhase % 0.8) < 0.4 ? 700 : 950;
      }
      // Music loop: one arpeggio pluck per beat, chord changes every 8 beats.
      musicT += dt;
      if (musicT > 0.42) {
        musicT = 0;
        const chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
        const n = chord[ARP[musicStep % 8]];
        note(n, ctx.currentTime, 0.5, 'triangle', 0.09);
        if (musicStep % 8 === 0) note(chord[0] / 2, ctx.currentTime, 1.6, 'sine', 0.12);
        musicStep++;
      }
    },
  };
}
