// audio.js — Web Audio API sound effects and background music
// All audio is procedurally synthesized — no external files.

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;

let musicScheduler = null;
let musicPlaying = false;
let musicHurry = false;
let musicNoteIndex = 0;

// ── AudioContext initialization ───────────────────────────────────────────────

export function initAudio() {
  if (audioCtx) return; // already initialized
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(masterGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.8;
    sfxGain.connect(masterGain);
  } catch (e) {
    console.warn('Web Audio API not available:', e);
  }
}

function ensureCtx() {
  if (!audioCtx) return false;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return true;
}

// ── Generic tone helpers ──────────────────────────────────────────────────────

function playTone({ type = 'square', freq, endFreq, duration, gainVal = 0.3, startTime = null, dest = null }) {
  if (!ensureCtx()) return;
  const t = startTime !== null ? startTime : audioCtx.currentTime;
  const output = dest || sfxGain;

  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== undefined) {
    osc.frequency.linearRampToValueAtTime(endFreq, t + duration);
  }

  g.gain.setValueAtTime(gainVal, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(g);
  g.connect(output);

  osc.start(t);
  osc.stop(t + duration + 0.01);
}

function playNoise({ duration, gainVal = 0.3, filterType = null, filterFreq = null, startTime = null }) {
  if (!ensureCtx()) return;
  const t = startTime !== null ? startTime : audioCtx.currentTime;

  const bufferSize = Math.floor(audioCtx.sampleRate * duration * 2);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gainVal, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);

  let lastNode = source;

  if (filterType && filterFreq) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    source.connect(filter);
    filter.connect(g);
  } else {
    source.connect(g);
  }

  g.connect(sfxGain);
  source.start(t);
  source.stop(t + duration + 0.01);
}

// ── Sound Effects ─────────────────────────────────────────────────────────────

export function playJump(isSuper = false) {
  if (isSuper) {
    playTone({ type: 'square', freq: 200, endFreq: 500, duration: 0.15, gainVal: 0.3 });
  } else {
    playTone({ type: 'square', freq: 300, endFreq: 600, duration: 0.1, gainVal: 0.3 });
  }
}

export function playCoin() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // Two-tone: 988Hz then 1319Hz
  playTone({ type: 'sine', freq: 988, duration: 0.05, gainVal: 0.4, startTime: t });
  playTone({ type: 'sine', freq: 1319, duration: 0.15, gainVal: 0.4, startTime: t + 0.05 });
}

export function playPowerUpAppear() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // Rising arpeggio: C4 E4 G4 C5
  const notes = [261.63, 329.63, 392.00, 523.25];
  notes.forEach((freq, i) => {
    playTone({ type: 'square', freq, duration: 0.1, gainVal: 0.35, startTime: t + i * 0.1 });
  });
}

export function playPowerUpGet() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // Rising scale: C5 D5 E5 F5 G5 A5 B5 C6
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50];
  notes.forEach((freq, i) => {
    playTone({ type: 'square', freq, duration: 0.05, gainVal: 0.5, startTime: t + i * 0.05 });
  });
}

export function playDeath() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // Descending sequence: C5 B4 Bb4 A4 Ab4 G4 Gb4 F4 E4 Eb4
  const notes = [523.25, 493.88, 466.16, 440.00, 415.30, 392.00, 369.99, 349.23, 329.63, 311.13];
  notes.forEach((freq, i) => {
    playTone({ type: 'square', freq, duration: 0.09, gainVal: 0.4, startTime: t + i * 0.1 });
  });
}

export function playLevelComplete() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // Ascending fanfare
  const seq = [
    [392.00, 0.1], [523.25, 0.1], [659.25, 0.1], [783.99, 0.1],
    [659.25, 0.05], [783.99, 0.3],
    [880.00, 0.1], [1046.50, 0.5],
    [783.99, 0.1], [659.25, 0.1], [523.25, 0.1],
    [659.25, 0.2], [523.25, 0.5],
  ];
  let offset = 0;
  seq.forEach(([freq, dur]) => {
    playTone({ type: 'square', freq, duration: dur * 0.9, gainVal: 0.5, startTime: t + offset });
    offset += dur;
  });
}

export function playKick() {
  if (!ensureCtx()) return;
  playTone({ type: 'square', freq: 200, endFreq: 100, duration: 0.1, gainVal: 0.5 });
}

export function playStomp() {
  if (!ensureCtx()) return;
  playTone({ type: 'square', freq: 200, endFreq: 100, duration: 0.1, gainVal: 0.5 });
}

export function playFireball() {
  playNoise({ duration: 0.05, gainVal: 0.3, filterType: 'lowpass', filterFreq: 800 });
}

export function playBreakBlock() {
  playNoise({ duration: 0.08, gainVal: 0.4, filterType: 'highpass', filterFreq: 2000 });
}

export function playOneUp() {
  if (!ensureCtx()) return;
  const t = audioCtx.currentTime;
  // G4 + E5 chord
  playTone({ type: 'square', freq: 392.00, duration: 0.5, gainVal: 0.35, startTime: t });
  playTone({ type: 'square', freq: 659.25, duration: 0.5, gainVal: 0.35, startTime: t });
}

export function playFlagpole() {
  if (!ensureCtx()) return;
  playTone({ type: 'sine', freq: 660, endFreq: 220, duration: 1.0, gainVal: 0.5 });
}

export function playBlockBump() {
  if (!ensureCtx()) return;
  playTone({ type: 'square', freq: 150, endFreq: 80, duration: 0.08, gainVal: 0.4 });
}

// ── Background Music ──────────────────────────────────────────────────────────

// A freely-composed upbeat chiptune melody (not Nintendo's copyrighted work).
// Structured as [frequency_hz, duration_in_beats] pairs; 0 = rest.
// Using note frequencies for a cheerful platformer feel.

const MELODY = [
  // Bar 1 - opening motif
  [659, 0.125], [659, 0.125], [0, 0.125], [659, 0.125],
  [0, 0.125], [523, 0.125], [659, 0.25],
  [784, 0.5], [0, 0.5],
  [392, 0.5], [0, 0.5],
  // Bar 2
  [523, 0.375], [0, 0.125], [392, 0.25], [0, 0.25],
  [330, 0.375], [0, 0.125], [294, 0.25], [0, 0.125],
  [330, 0.125], [0, 0.125], [294, 0.25],
  // Bar 3 - bridge
  [523, 0.125], [0, 0.125], [440, 0.125], [0, 0.125],
  [466, 0.125], [0, 0.125], [440, 0.25],
  [0, 0.125], [392, 0.25], [659, 0.375],
  [784, 0.25], [880, 0.125], [0, 0.125],
  // Bar 4 - resolve
  [784, 0.375], [0, 0.125], [523, 0.25], [0, 0.125],
  [659, 0.375], [0, 0.125], [587, 0.25], [0, 0.125],
  [523, 0.375], [0, 0.125],
  // Bar 5 - ending phrase
  [392, 0.25], [523, 0.25], [659, 0.25], [440, 0.25],
  [523, 0.5], [330, 0.5],
];

let musicTimeoutIds = [];

function beatToDuration(beats, hurry) {
  // 120 BPM normal, 240 BPM hurry
  const bpm = hurry ? 240 : 120;
  return beats * (60 / bpm);
}

function scheduleMusicNote(index, startTime, hurry) {
  if (!audioCtx || !musicPlaying) return;

  const note = MELODY[index];
  const [freq, beats] = note;
  const dur = beatToDuration(beats, hurry);

  if (freq > 0) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.15, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.95);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(startTime);
    osc.stop(startTime + dur);
  }

  const nextIndex = (index + 1) % MELODY.length;
  const delay = (startTime - audioCtx.currentTime + dur) * 1000;
  const tid = setTimeout(() => {
    if (musicPlaying) {
      scheduleMusicNote(nextIndex, startTime + dur, musicHurry);
    }
  }, Math.max(0, delay));
  musicTimeoutIds.push(tid);
}

export function startMusic(hurry = false) {
  if (!ensureCtx()) return;
  if (musicPlaying && musicHurry === hurry) return;

  stopMusic();
  musicPlaying = true;
  musicHurry = hurry;
  musicNoteIndex = 0;

  // Schedule first note
  scheduleMusicNote(0, audioCtx.currentTime, hurry);
}

export function stopMusic() {
  musicPlaying = false;
  musicTimeoutIds.forEach(id => clearTimeout(id));
  musicTimeoutIds = [];
}

export function pauseMusic() {
  if (audioCtx) audioCtx.suspend();
}

export function resumeMusic() {
  if (audioCtx) audioCtx.resume();
}

export function setMusicHurry(hurry) {
  if (musicHurry !== hurry) {
    startMusic(hurry);
  }
}

export function setMasterVolume(vol) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol));
}
