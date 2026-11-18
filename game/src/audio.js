// All sound is synthesized WebAudio — no files, no network. Created lazily on the
// first user gesture (browser rule); M toggles mute. Engine hum follows speed,
// the siren is a two-tone wail, gunshots are noise bursts, pickups chime, missions
// play a little jingle, and a slow original chord arpeggio loops underneath.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let muted = false;
  let musicStep = 0;
  const CHORDS = [
    [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66], [164.81, 220.0, 261.63],
  ];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function tone(freq, dur, type, vol, when) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    ensure,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    muted() { return muted; },
    engine(speed01, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + 0.08 * speed01 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + 140 * speed01, t, 0.08);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(sirenOsc.frequency.value > 800 ? 660 : 920, ctx.currentTime, 0.45);
    },
    shot() { noise(0.12, 0.35, 2400); tone(180, 0.08, 'square', 0.12); },
    punch() { noise(0.08, 0.2, 900); },
    chime() { tone(880, 0.12, 'sine', 0.18); tone(1318, 0.2, 'sine', 0.15, 0.08); },
    coin() { tone(988, 0.08, 'triangle', 0.15); tone(1319, 0.14, 'triangle', 0.15, 0.06); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, i * 0.11)); },
    fail() { tone(220, 0.3, 'sawtooth', 0.15); tone(165, 0.4, 'sawtooth', 0.15, 0.15); },
    wasted() { [392, 311, 233, 175].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, i * 0.22)); },
    update(dt, driving) {
      if (!ctx || muted) return;
      musicTimer += dt;
      if (musicTimer < 0.42) return;
      musicTimer = 0;
      const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      const note = chord[musicStep % 3] * (musicStep % 8 >= 4 ? 2 : 1);
      tone(note, 0.4, 'triangle', driving ? 0.045 : 0.07);
      musicStep += 1;
    },
  };
}
