// SOLMARA's sound, all synthesized with WebAudio — no audio files. Engine hum
// that follows speed, a two-tone siren that fades with distance, gunshots,
// pickup chimes, mission jingles and a quiet chord-arpeggio music loop.
// The context is created on the first user gesture (browser rule); M mutes.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;

  const CHORDS = [
    [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6],
    [196.0, 246.9, 293.7],
    [164.8, 196.0, 246.9],
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 30;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineOsc.start();
      engineOsc2.start();
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenGain.connect(master);
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenOsc.connect(sirenGain);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
      tone(140, 0.08, 'square', 0.2);
    },
    /** Tyre screech for a handbrake slide (two detuned high tones). */
    screech() {
      tone(1150, 0.3, 'sawtooth', 0.07);
      tone(1720, 0.3, 'sawtooth', 0.05);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.3);
      tone(1318, 0.18, 'sine', 0.25, 0.07);
    },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.11));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.18, i * 0.14));
    },
    engine(speedNorm, on) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.09 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(28 + speedNorm * 65, t, 0.08);
    },
    siren(nearestDist, wanted) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const on = wanted >= 1 && nearestDist < 140;
      sirenGain.gain.setTargetAtTime(on ? Math.max(0.02, 0.16 * (1 - nearestDist / 140)) : 0, t, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(t * 4.4) > 0 ? 920 : 700, t, 0.05);
    },
    music(dt) {
      if (!ctx || muted) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer = 0.24;
      const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      const note = chord[musicStep % 3];
      tone(note * 2, 0.3, 'sine', 0.12);
      if (musicStep % 4 === 0) tone(chord[0], 0.5, 'triangle', 0.1);
      musicStep += 1;
    },
  };
}
