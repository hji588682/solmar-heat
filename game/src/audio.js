// Solmar Heat — audio.js
// Fully synthesized WebAudio sound: no audio files, no network.
// Engine hum follows car speed, a two-tone siren, gunshots, pickups,
// a mission-complete jingle and a light bass loop. Everything is
// guarded so the game still runs when AudioContext is unavailable
// (headless screenshots) or before the first user gesture.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
    musicTimer: 0,
    musicStep: 0,
    started: false,
  };

  A.ensure = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      // Engine: two detuned sawtooths through a lowpass, gain by speed.
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      const eng2 = A.ctx.createOscillator();
      eng2.type = 'sawtooth';
      eng2.frequency.value = 58;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      A.engineOsc.connect(filt);
      eng2.connect(filt);
      filt.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      eng2.start();
      A.engineOsc2 = eng2;
      // Siren: a square wave whose frequency flips between two tones.
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'square';
      A.sirenOsc.frequency.value = 660;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      A.started = true;
      return true;
    } catch (e) {
      return false;
    }
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (A.master) A.master.gain.value = A.muted ? 0 : 0.5;
    return A.muted;
  };

  // Short beep / blip.
  A.blip = function (freq, dur, type, vol, slideTo) {
    if (!A.ctx || A.muted) return;
    try {
      const t = A.ctx.currentTime;
      const o = A.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(A.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  };

  // Noise burst (gunshot, crash, explosion).
  A.noise = function (dur, vol, filterFreq) {
    if (!A.ctx || A.muted) return;
    try {
      const t = A.ctx.currentTime;
      const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = filterFreq || 1800;
      const g = A.ctx.createGain();
      g.gain.value = vol || 0.35;
      src.connect(filt);
      filt.connect(g);
      g.connect(A.master);
      src.start(t);
    } catch (e) { /* audio is best-effort */ }
  };

  A.shoot = function () { A.noise(0.12, 0.4, 3200); A.blip(180, 0.08, 'square', 0.12, 60); };
  A.enemyShoot = function () { A.noise(0.1, 0.22, 2400); };
  A.crash = function () { A.noise(0.18, 0.3, 900); };
  A.pickup = function () { A.blip(660, 0.09, 'sine', 0.2); A.blip(990, 0.12, 'sine', 0.2); };
  A.steal = function () { A.blip(220, 0.1, 'square', 0.15, 440); };
  A.busted = function () { A.blip(330, 0.5, 'sawtooth', 0.2, 110); };
  A.missionDone = function () {
    if (!A.ctx || A.muted) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'triangle', 0.25), i * 130));
  };
  A.fail = function () {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => setTimeout(() => A.blip(f, 0.25, 'sawtooth', 0.16), i * 160));
  };

  // Per-frame: engine pitch from speed, siren while wanted, bass loop.
  A.update = function (dt, driving, speedNorm, wanted) {
    if (!A.ctx || A.muted) return;
    try {
      if (A.engineGain) {
        A.engineGain.gain.value = driving ? 0.05 + speedNorm * 0.09 : 0.015;
        const f = 50 + speedNorm * 130;
        A.engineOsc.frequency.value = f;
        A.engineOsc2.frequency.value = f * 1.02;
      }
      if (A.sirenGain) {
        A.sirenGain.gain.value = wanted > 0 ? 0.045 : 0;
        if (wanted > 0) {
          A.sirenTimer += dt;
          if (A.sirenTimer > 0.42) {
            A.sirenTimer = 0;
            A.sirenHigh = !A.sirenHigh;
            A.sirenOsc.frequency.value = A.sirenHigh ? 880 : 660;
          }
        }
      }
      // Simple laid-back bass loop, one note per beat.
      A.musicTimer += dt;
      if (A.musicTimer > 0.42) {
        A.musicTimer = 0;
        const bass = [110, 0, 131, 0, 98, 0, 147, 123][A.musicStep % 8];
        A.musicStep++;
        if (bass) A.blip(bass, 0.3, 'triangle', 0.07);
      }
    } catch (e) { /* audio is best-effort */ }
  };

  return A;
}
