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

// Dramatic celebratory hit — meaty impact punch followed immediately by a
// bright ascending arpeggio so the shooter feels rewarded.
function playPlayerHit() {
  const c   = getCtx();
  const now = c.currentTime;

  // === Impact layer (instant) ===

  // Deep thud
  const thud  = c.createBufferSource();
  thud.buffer = getNoise();
  const thudF = c.createBiquadFilter();
  thudF.type  = "lowpass";
  thudF.frequency.setValueAtTime(320, now);
  thudF.frequency.exponentialRampToValueAtTime(70, now + 0.18);
  const thudG = c.createGain();
  thudG.gain.setValueAtTime(0,   now);
  thudG.gain.linearRampToValueAtTime(2.4, now + 0.003);
  thudG.gain.setValueAtTime(1.5, now + 0.018);
  thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  thud.connect(thudF); thudF.connect(thudG); thudG.connect(c.destination);
  thud.start(now); thud.stop(now + 0.30);

  // Punch tone — descending bass sine
  const punch = c.createOscillator();
  punch.type  = "sine";
  punch.frequency.setValueAtTime(180, now);
  punch.frequency.exponentialRampToValueAtTime(38, now + 0.22);
  const punchG = c.createGain();
  punchG.gain.setValueAtTime(0,   now);
  punchG.gain.linearRampToValueAtTime(1.1, now + 0.004);
  punchG.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  punch.connect(punchG); punchG.connect(c.destination);
  punch.start(now); punch.stop(now + 0.26);

  // === Celebratory arpeggio — starts 60ms after impact ===
  // C5 · E5 · G5 · C6 — major chord sweep, triangle for brightness
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const noteDur  = 0.10;
  const arpStart = now + 0.06;

  notes.forEach((freq, i) => {
    const t   = arpStart + i * noteDur;
    const osc = c.createOscillator();
    osc.type  = "triangle";
    osc.frequency.value = freq;

    // Slight pitch bend up on each note for a snappy feel
    osc.frequency.setValueAtTime(freq * 0.97, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.015);

    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.012);
    g.gain.setValueAtTime(0.28, t + noteDur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + noteDur * 1.1);

    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + noteDur * 1.2);
  });

  // High sparkle ping at the top of the arpeggio
  const sparkleT = arpStart + notes.length * noteDur - 0.02;
  const sparkle  = c.createOscillator();
  sparkle.type   = "sine";
  sparkle.frequency.setValueAtTime(2800, sparkleT);
  sparkle.frequency.exponentialRampToValueAtTime(3400, sparkleT + 0.06);
  const sparkleG = c.createGain();
  sparkleG.gain.setValueAtTime(0, sparkleT);
  sparkleG.gain.linearRampToValueAtTime(0.18, sparkleT + 0.008);
  sparkleG.gain.exponentialRampToValueAtTime(0.001, sparkleT + 0.14);
  sparkle.connect(sparkleG); sparkleG.connect(c.destination);
  sparkle.start(sparkleT); sparkle.stop(sparkleT + 0.16);
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

// ── Drill sound — looping, started/stopped by game.js ────────────────────────

let drillActive = false;
let drillNodes  = null;

export function startDrillSound() {
  if (drillActive) return;
  drillActive = true;

  const c   = getCtx();
  const now = c.currentTime;

  // Noise layer — rasping scrape texture
  const noiseSrc    = c.createBufferSource();
  noiseSrc.buffer   = getNoise();
  noiseSrc.loop     = true;

  const bandpass        = c.createBiquadFilter();
  bandpass.type         = 'bandpass';
  bandpass.frequency.value = 550;
  bandpass.Q.value      = 4;

  const noiseGain       = c.createGain();
  noiseGain.gain.value  = 0.5;

  // LFO pulses the noise gain to create a rhythmic "brrrr" grind
  const lfo         = c.createOscillator();
  lfo.type          = 'sawtooth';
  lfo.frequency.value = 16;
  const lfoGain     = c.createGain();
  lfoGain.gain.value = 0.35;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);

  noiseSrc.connect(bandpass);
  bandpass.connect(noiseGain);

  // Low mechanical oscillator — rumbling churn underneath
  const osc         = c.createOscillator();
  osc.type          = 'sawtooth';
  osc.frequency.value = 58;
  const oscFilter   = c.createBiquadFilter();
  oscFilter.type    = 'lowpass';
  oscFilter.frequency.value = 300;
  const oscGain     = c.createGain();
  oscGain.gain.value = 0.22;
  osc.connect(oscFilter);
  oscFilter.connect(oscGain);

  // Master gain — fade in on start, fade out on stop
  const masterGain  = c.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.6, now + 0.08);

  noiseGain.connect(masterGain);
  oscGain.connect(masterGain);
  masterGain.connect(c.destination);

  noiseSrc.start(now);
  lfo.start(now);
  osc.start(now);

  drillNodes = { noiseSrc, lfo, osc, masterGain };
}

export function stopDrillSound() {
  if (!drillActive || !drillNodes) return;
  drillActive = false;

  const c   = getCtx();
  const now = c.currentTime;
  const { noiseSrc, lfo, osc, masterGain } = drillNodes;
  drillNodes = null;

  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + 0.12);
  noiseSrc.stop(now + 0.14);
  lfo.stop(now + 0.14);
  osc.stop(now + 0.14);
}

function playFreezeActivate() {
  const c   = getCtx();
  const now = c.currentTime;

  // Ascending crystal chime — four triangle-wave tones
  [1320, 1760, 2200, 2640].forEach((freq, i) => {
    const t   = now + i * 0.04;
    const osc = c.createOscillator();
    osc.type  = "triangle";
    osc.frequency.setValueAtTime(freq * 0.95, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.01);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.27);
  });

  // High hiss — noise through highpass
  const src    = c.createBufferSource();
  src.buffer   = getNoise();
  const filter = c.createBiquadFilter();
  filter.type  = "highpass";
  filter.frequency.value = 3000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0,    now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  src.connect(filter); filter.connect(gain); gain.connect(c.destination);
  src.start(now); src.stop(now + 0.24);
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
      case "playerHit":       playPlayerHit();       break;
      case "freezeActivate":  playFreezeActivate();  break;
    }
  } catch (_) {
    // Audio errors are non-fatal — game continues without sound.
  }
}
