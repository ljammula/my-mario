/**
 * AudioSystem.ts
 * SE2 — Web Audio API procedural synthesis. No external files.
 *
 * Single AudioContext, created on first user interaction.
 * Music and SFX run on separate gain chains feeding into master gain.
 * All SFX are fire-and-forget (non-blocking).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MusicTrack = 'overworld' | 'underground' | 'underwater' | 'castle' | 'title' | 'starman';
export type SFXKey =
  | 'jump_small'
  | 'jump_super'
  | 'coin'
  | 'powerup_spawn'
  | 'powerup_collect'
  | 'break_block'
  | 'stomp'
  | 'death'
  | 'level_complete'
  | 'oneup'
  | 'fireball'
  | 'flagpole'
  | 'pipe'
  | 'bump';

// ── Note frequencies (Hz) ─────────────────────────────────────────────────────

const NOTE: Record<string, number> = {
  C4:  261.63, D4:  293.66, E4:  329.63, F4:  349.23,
  G4:  392.00, A4:  440.00, Bb4: 466.16, B4:  493.88,
  C5:  523.25, D5:  587.33, E5:  659.25, F5:  698.46,
  G5:  783.99, A5:  880.00, B5:  987.77,
  Eb4: 311.13,
  C6: 1046.50,
};

// ── Overworld melody (freely composed, 120/240 BPM) ───────────────────────────
// [frequency_hz, duration_in_beats]   0 = rest

type MelodyNote = [number, number];

const OVERWORLD_MELODY: MelodyNote[] = [
  // Bar 1 — opening motif
  [NOTE.E5, 0.125], [NOTE.E5, 0.125], [0, 0.125], [NOTE.E5, 0.125],
  [0, 0.125], [NOTE.C5, 0.125], [NOTE.E5, 0.25],
  [NOTE.G5, 0.5], [0, 0.5],
  [NOTE.G4, 0.5], [0, 0.5],
  // Bar 2
  [NOTE.C5, 0.375], [0, 0.125], [NOTE.G4, 0.25], [0, 0.25],
  [NOTE.E4, 0.375], [0, 0.125], [NOTE.A4, 0.25], [0, 0.125],
  [NOTE.B4, 0.125], [0, 0.125], [NOTE.Bb4, 0.25],
  // Bar 3
  [NOTE.A4, 0.375], [NOTE.G4, 0.25], [NOTE.E5, 0.375],
  [NOTE.G5, 0.25], [NOTE.A5, 0.125], [0, 0.125],
  // Bar 4
  [NOTE.F5, 0.25], [NOTE.G5, 0.125], [0, 0.125],
  [NOTE.E5, 0.375], [NOTE.C5, 0.25], [NOTE.D5, 0.125],
  [NOTE.B4, 0.25],
  // Bar 5 — ending phrase
  [NOTE.G4, 0.25], [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.A4, 0.25],
  [NOTE.B4, 0.5], [NOTE.E4, 0.5],
];

const UNDERGROUND_MELODY: MelodyNote[] = [
  [NOTE.C5, 0.25], [0, 0.125], [NOTE.C5, 0.125], [NOTE.C5, 0.25], [0, 0.25],
  [NOTE.C5, 0.25], [NOTE.D5, 0.25], [NOTE.E5, 0.25], [0, 0.125], [NOTE.C5, 0.125],
  [NOTE.A4, 0.25], [NOTE.B4, 0.5], [0, 0.25],
  [NOTE.G4, 0.25], [NOTE.A4, 0.25], [NOTE.B4, 0.25], [NOTE.G5, 0.5],
];

const CASTLE_MELODY: MelodyNote[] = [
  [NOTE.C5, 0.125], [0, 0.125], [NOTE.C5, 0.125], [0, 0.375],
  [NOTE.C5, 0.125], [0, 0.125], [NOTE.C5, 0.125], [NOTE.D5, 0.125], [0, 0.25],
  [NOTE.Eb4, 0.25], [0, 0.125], [NOTE.Eb4, 0.125], [0, 0.25],
  [NOTE.Eb4, 0.125], [0, 0.125], [NOTE.D5, 0.125], [NOTE.Eb4, 0.5],
  [NOTE.C5, 0.5], [0, 0.5],
];

const TITLE_MELODY: MelodyNote[] = [
  [NOTE.G4, 0.25], [NOTE.C5, 0.25], [NOTE.E5, 0.25], [NOTE.G5, 0.5],
  [NOTE.E5, 0.25], [NOTE.G5, 0.75],
  [NOTE.A5, 0.25], [NOTE.F5, 0.25], [NOTE.A5, 0.5],
  [NOTE.G5, 0.25], [NOTE.E5, 0.25], [NOTE.C5, 0.25], [NOTE.G4, 0.5],
];

const STARMAN_MELODY: MelodyNote[] = [
  [NOTE.E4, 0.125], [NOTE.G4, 0.125], [NOTE.E5, 0.125], [NOTE.G5, 0.125],
  [NOTE.F5, 0.125], [NOTE.A5, 0.125], [NOTE.F5, 0.125], [NOTE.A5, 0.125],
  [NOTE.E5, 0.125], [NOTE.G5, 0.125], [NOTE.E5, 0.125], [NOTE.G5, 0.125],
  [NOTE.Eb4, 0.125], [NOTE.F4, 0.125], [NOTE.Eb5, 0.125], [NOTE.F5, 0.125],
];

const TRACK_MELODIES: Record<MusicTrack, MelodyNote[]> = {
  overworld:   OVERWORLD_MELODY,
  underground: UNDERGROUND_MELODY,
  underwater:  UNDERGROUND_MELODY,   // reuse with lower pitch (simple)
  castle:      CASTLE_MELODY,
  title:       TITLE_MELODY,
  starman:     STARMAN_MELODY,
};

// ── AudioSystem class ─────────────────────────────────────────────────────────

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicPlaying = false;
  private musicHurry   = false;
  private currentTrack: MusicTrack | null = null;
  private musicNoteIdx = 0;
  private musicTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ── Initialization ──────────────────────────────────────────────────────

  /**
   * Create AudioContext on first user interaction (browser autoplay policy).
   * Safe to call multiple times — only initializes once.
   */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('AudioSystem: Web Audio API not available:', e);
    }
  }

  private ensureCtx(): boolean {
    if (!this.ctx || !this.masterGain) return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  // ── Low-level tone helpers ───────────────────────────────────────────────

  private playTone(opts: {
    type?:      OscillatorType;
    freq:       number;
    endFreq?:   number;
    duration:   number;
    gainVal?:   number;
    startTime?: number;
    dest?:      AudioNode;
  }): void {
    if (!this.ensureCtx()) return;
    const ctx = this.ctx!;
    const { type = 'square', freq, endFreq, duration, gainVal = 0.3, dest } = opts;
    const t = opts.startTime ?? ctx.currentTime;
    const output = dest ?? this.sfxGain!;

    const osc = ctx.createOscillator();
    const g   = ctx.createGain();

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

  private playNoise(opts: {
    duration:    number;
    gainVal?:    number;
    filterType?: BiquadFilterType;
    filterFreq?: number;
    startTime?:  number;
  }): void {
    if (!this.ensureCtx()) return;
    const ctx = this.ctx!;
    const { duration, gainVal = 0.3, filterType, filterFreq } = opts;
    const t = opts.startTime ?? ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * duration * 2);
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    if (filterType && filterFreq !== undefined) {
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = filterFreq;
      src.connect(filt);
      filt.connect(g);
    } else {
      src.connect(g);
    }

    g.connect(this.sfxGain!);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  // ── Music ────────────────────────────────────────────────────────────────

  playMusic(track: MusicTrack): void {
    if (!this.ensureCtx()) return;
    if (this.musicPlaying && this.currentTrack === track && !this.musicHurry) return;
    this.stopMusic();
    this.currentTrack  = track;
    this.musicPlaying  = true;
    this.musicHurry    = false;
    this.musicNoteIdx  = 0;
    this._scheduleNote(0, this.ctx!.currentTime);
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimeoutId !== null) {
      clearTimeout(this.musicTimeoutId);
      this.musicTimeoutId = null;
    }
  }

  pauseMusic(): void {
    if (this.ctx) void this.ctx.suspend();
  }

  resumeMusic(): void {
    if (this.ctx) void this.ctx.resume();
  }

  setHurryMode(hurry: boolean): void {
    if (this.musicHurry !== hurry && this.musicPlaying && this.currentTrack) {
      const track = this.currentTrack;
      this.stopMusic();
      this.musicHurry   = hurry;
      this.currentTrack = track;
      this.musicPlaying = true;
      this.musicNoteIdx = 0;
      if (this.ensureCtx()) {
        this._scheduleNote(0, this.ctx!.currentTime);
      }
    }
  }

  private _beatDuration(beats: number): number {
    const bpm = this.musicHurry ? 240 : 120;
    return beats * (60 / bpm);
  }

  private _scheduleNote(idx: number, startTime: number): void {
    if (!this.musicPlaying || !this.ctx || !this.musicGain || !this.currentTrack) return;

    const melody = TRACK_MELODIES[this.currentTrack];
    const [freq, beats] = melody[idx];
    const dur = this._beatDuration(beats);

    if (freq > 0) {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.15, startTime);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.92);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(startTime);
      osc.stop(startTime + dur);
    }

    const nextIdx   = (idx + 1) % melody.length;
    const delay     = Math.max(0, (startTime - this.ctx.currentTime + dur) * 1000);
    this.musicTimeoutId = setTimeout(() => {
      if (this.musicPlaying) {
        this._scheduleNote(nextIdx, startTime + dur);
      }
    }, delay);
  }

  // ── Sound Effects ────────────────────────────────────────────────────────

  playSFX(sound: SFXKey): void {
    if (!this.ensureCtx()) return;
    const ctx = this.ctx!;
    const t   = ctx.currentTime;

    switch (sound) {
      // Jump (small): square 300→600 Hz, 0.1s, gain 0.3
      case 'jump_small':
        this.playTone({ type: 'square', freq: 300, endFreq: 600, duration: 0.1, gainVal: 0.3 });
        break;

      // Jump (super): square 200→500 Hz, 0.15s, gain 0.3
      case 'jump_super':
        this.playTone({ type: 'square', freq: 200, endFreq: 500, duration: 0.15, gainVal: 0.3 });
        break;

      // Coin: sine 988 Hz (0.05s) then 1319 Hz (0.15s), gain 0.4
      case 'coin':
        this.playTone({ type: 'sine', freq: 988, duration: 0.05, gainVal: 0.4, startTime: t });
        this.playTone({ type: 'sine', freq: 1319, duration: 0.15, gainVal: 0.4, startTime: t + 0.05 });
        break;

      // Power-up spawn: square arpeggio C4→E4→G4→C5, 0.1s each
      case 'powerup_spawn':
        [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5].forEach((freq, i) => {
          this.playTone({ type: 'square', freq, duration: 0.1, gainVal: 0.35, startTime: t + i * 0.1 });
        });
        break;

      // Power-up collect: square scale C5→C6, 0.05s/note, gain 0.5
      case 'powerup_collect':
        [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.F5, NOTE.G5, NOTE.A5, NOTE.B5, NOTE.C6].forEach((freq, i) => {
          this.playTone({ type: 'square', freq, duration: 0.05, gainVal: 0.5, startTime: t + i * 0.05 });
        });
        break;

      // Break block: white noise 0.08s, gain 0.4, highpass 2000 Hz
      case 'break_block':
        this.playNoise({ duration: 0.08, gainVal: 0.4, filterType: 'highpass', filterFreq: 2000 });
        break;

      // Stomp: square 200→100 Hz, 0.1s, gain 0.5
      case 'stomp':
        this.playTone({ type: 'square', freq: 200, endFreq: 100, duration: 0.1, gainVal: 0.5 });
        break;

      // Death: square descending C5→Eb4, 0.1s/note
      case 'death': {
        const deathNotes = [
          NOTE.C5, NOTE.B4, NOTE.Bb4, NOTE.A4, NOTE.G4,
          NOTE.F4, NOTE.Eb4,
        ];
        deathNotes.forEach((freq, i) => {
          this.playTone({ type: 'square', freq, duration: 0.09, gainVal: 0.4, startTime: t + i * 0.1 });
        });
        break;
      }

      // Level complete: ascending fanfare ~3s
      case 'level_complete': {
        const fanfare: [number, number][] = [
          [NOTE.G4, 0.1], [NOTE.C5, 0.1], [NOTE.E5, 0.1], [NOTE.G5, 0.1],
          [NOTE.E5, 0.05], [NOTE.G5, 0.3],
          [NOTE.A5, 0.1], [NOTE.C6, 0.5],
          [NOTE.G5, 0.1], [NOTE.E5, 0.1], [NOTE.C5, 0.1],
          [NOTE.E5, 0.2], [NOTE.C5, 0.5],
        ];
        let off = 0;
        fanfare.forEach(([freq, dur]) => {
          this.playTone({ type: 'square', freq, duration: dur * 0.9, gainVal: 0.5, startTime: t + off });
          off += dur;
        });
        break;
      }

      // 1-UP: square G4+E5 chord, 0.5s, gain 0.5
      case 'oneup':
        this.playTone({ type: 'square', freq: NOTE.G4, duration: 0.5, gainVal: 0.35, startTime: t });
        this.playTone({ type: 'square', freq: NOTE.E5, duration: 0.5, gainVal: 0.35, startTime: t });
        break;

      // Fireball: white noise 0.05s, lowpass 800 Hz, gain 0.3
      case 'fireball':
        this.playNoise({ duration: 0.05, gainVal: 0.3, filterType: 'lowpass', filterFreq: 800 });
        break;

      // Flagpole: sine descending 660→220 Hz slide 1.0s
      case 'flagpole':
        this.playTone({ type: 'sine', freq: 660, endFreq: 220, duration: 1.0, gainVal: 0.5 });
        break;

      // Pipe: short whoosh (noise + lowpass sweep)
      case 'pipe':
        this.playNoise({ duration: 0.15, gainVal: 0.25, filterType: 'lowpass', filterFreq: 600 });
        break;

      // Bump: low thud
      case 'bump':
        this.playTone({ type: 'square', freq: 150, endFreq: 80, duration: 0.08, gainVal: 0.4 });
        break;
    }
  }

  // ── Volume control ───────────────────────────────────────────────────────

  setMasterVolume(v: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }
}

// Singleton instance exported for easy global use
export const audioSystem = new AudioSystem();
