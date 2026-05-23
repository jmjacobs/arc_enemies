// sound.js
// All sounds are synthesized via the Web Audio API — no audio files needed.
// The AudioContext is created lazily on the first playSound call (after a user
// gesture) so browsers don't block it under their autoplay policy.

let ctx = null;
let noiseBuffer = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Two seconds of white noise, generated once and reused by all noise sources.
function getNoise() {
  const c = getCtx();
  if (noiseBuffer) return noiseBuffer;
  const len  = c.sampleRate * 2;
  noiseBuffer = c.createBuffer(1, len, c.sampleRate);
  const data  = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// Quick upward whoosh — noise burst through a rising bandpass filter.
function playThrow() {
  const c   = getCtx();
  const now = c.currentTime;

  const src    = c.createBufferSource();
  src.buffer   = getNoise();

  const filter = c.createBiquadFilter();
  filter.type  = "bandpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(250, now);
  filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(now);
  src.stop(now + 0.25);
}

// Heavier super bomb throw — deeper, longer whoosh with a low oscillator underneath.
function playThrowSuper() {
  const c   = getCtx();
  const now = c.currentTime;

  const src   = c.createBufferSource();
  src.buffer  = getNoise();

  const filter = c.createBiquadFilter();
  filter.type  = "bandpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(80, now);
  filter.frequency.exponentialRampToValueAtTime(900, now + 0.32);

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.7, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.30);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.5, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  src.connect(filter);    filter.connect(noiseGain); noiseGain.connect(c.destination);
  osc.connect(oscGain);   oscGain.connect(c.destination);
  src.start(now); src.stop(now + 0.40);
  osc.start(now); osc.stop(now + 0.38);
}

// Pure shaped noise — no oscillators. All character comes from the envelope.
// Fast attack spike → brief punch → smooth tail.
function playExplosion() {
  const c   = getCtx();
  const now = c.currentTime;

  const src  = c.createBufferSource();
  src.buffer = getNoise();

  const filter = c.createBiquadFilter();
  filter.type  = "lowpass";
  filter.frequency.value = 1000;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0,    now);
  gain.gain.linearRampToValueAtTime(1.0,  now + 0.002);  // 2ms attack
  gain.gain.setValueAtTime(0.80, now + 0.022);            // punch plateau
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

  src.connect(filter); filter.connect(gain); gain.connect(c.destination);
  src.start(now); src.stop(now + 0.38);
}

// Super version — darker filter, harder hit, longer tail.
function playExplosionSuper() {
  const c   = getCtx();
  const now = c.currentTime;

  const src  = c.createBufferSource();
  src.buffer = getNoise();

  const filter = c.createBiquadFilter();
  filter.type  = "lowpass";
  filter.frequency.value = 600;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0,    now);
  gain.gain.linearRampToValueAtTime(1.6,  now + 0.002);  // harder hit
  gain.gain.setValueAtTime(1.25, now + 0.030);            // longer punch
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.70);

  src.connect(filter); filter.connect(gain); gain.connect(c.destination);
  src.start(now); src.stop(now + 0.75);
}

// Short ascending arpeggio — C5 · E5 · G5.
function playRoundWin() {
  const c   = getCtx();
  const now = c.currentTime;
  const dur = 0.13;

  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc  = c.createOscillator();
    osc.type   = "triangle";
    osc.frequency.value = freq;

    const gain = c.createGain();
    const t    = now + i * dur;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur);
  });
}

// Longer fanfare — C5 · E5 · G5 · C6, filtered sawtooth for warmth.
function playMatchWin() {
  const c   = getCtx();
  const now = c.currentTime;
  const dur = 0.20;

  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc  = c.createOscillator();
    osc.type   = "sawtooth";
    osc.frequency.value = freq;

    const filter    = c.createBiquadFilter();
    filter.type     = "lowpass";
    filter.frequency.value = 1800;

    const gain = c.createGain();
    const t    = now + i * dur;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.015);
    gain.gain.setValueAtTime(0.2, t + dur * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur * 1.4);
  });
}

// Descending sine whistle — projectile sails off screen.
function playMiss() {
  const c   = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.setValueAtTime(680, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.38);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.setValueAtTime(0.28, now + 0.22);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

// Menacing rising hum — super bomb armed.
function playSuperBombArm() {
  const c   = getCtx();
  const now = c.currentTime;

  // Low rising growl
  const osc = c.createOscillator();
  osc.type  = "sawtooth";
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);

  const filter = c.createBiquadFilter();
  filter.type  = "lowpass";
  filter.frequency.value = 600;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.04);
  gain.gain.setValueAtTime(0.3, now + 0.22);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  // High shimmer on top
  const shimmer = c.createOscillator();
  shimmer.type  = "sine";
  shimmer.frequency.setValueAtTime(1200, now);
  shimmer.frequency.exponentialRampToValueAtTime(2600, now + 0.28);

  const shimGain = c.createGain();
  shimGain.gain.setValueAtTime(0.12, now);
  shimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

  osc.connect(filter);    filter.connect(gain);     gain.connect(c.destination);
  shimmer.connect(shimGain); shimGain.connect(c.destination);
  osc.start(now);     osc.stop(now + 0.34);
  shimmer.start(now); shimmer.stop(now + 0.32);
}

// Deflating descending tone — super bomb disarmed.
function playSuperBombDisarm() {
  const c   = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.22);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.27);
}

// Sine pluck — angle locked.
function playLock() {
  const c   = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.value = 360;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

// Soft blip — arrow key navigation on selection screens.
function playNavigate() {
  const c   = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

// Rising two-note chime — Enter to confirm.
function playConfirm() {
  const c   = getCtx();
  const now = c.currentTime;

  [660, 880].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type  = "triangle";
    osc.frequency.value = freq;

    const gain = c.createGain();
    const t    = now + i * 0.09;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.20);
  });
}

// Very short soft tick — name typing and backspace.
function playType() {
  const c   = getCtx();
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type  = "sine";
  osc.frequency.value = 900;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function playSound(name) {
  try {
    switch (name) {
      case "throw":           playThrow();           break;
      case "throwSuper":      playThrowSuper();      break;
      case "explosion":       playExplosion();       break;
      case "explosionSuper":  playExplosionSuper();  break;
      case "roundWin":        playRoundWin();        break;
      case "matchWin":        playMatchWin();        break;
      case "miss":            playMiss();            break;
      case "superBombArm":    playSuperBombArm();    break;
      case "superBombDisarm": playSuperBombDisarm(); break;
      case "lock":            playLock();            break;
      case "navigate":        playNavigate();        break;
      case "confirm":         playConfirm();         break;
      case "type":            playType();            break;
    }
  } catch (_) {
    // Audio errors are non-fatal — game continues without sound.
  }
}
