// ============================================================
// AUDIO SYSTEM
// ============================================================

const AudioSystem = (() => {
  let ctx = null;
  let musicNode = null;
  let musicGain = null;
  let musicPlaying = false;
  let audioReady = false;
  let currentMusicName = null;

  function init() {
    if (audioReady) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioReady = true;
    } catch(e) {
      console.warn('Web Audio not available');
    }
  }

  function playSFX(name) {
    if (!audioReady || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    switch(name) {
      case 'jump_small': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.1);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }
      case 'jump_super': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.15);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.15);
        break;
      }
      case 'coin': {
        [988, 1319].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t = now + i * 0.08;
          g.gain.setValueAtTime(0.2, t);
          g.gain.linearRampToValueAtTime(0, t + 0.08);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.1);
        });
        break;
      }
      case 'stomp': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }
      case 'break_block': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.linearRampToValueAtTime(0, now + 0.08);
        src.connect(filter); filter.connect(g); g.connect(ctx.destination);
        src.start(now);
        break;
      }
      case 'powerup_collect': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          const t = now + i * 0.06;
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0, t + 0.06);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.08);
        });
        break;
      }
      case 'death': {
        const notes = [440, 349, 294, 220, 175];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          const t = now + i * 0.12;
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0, t + 0.1);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.12);
        });
        break;
      }
      case 'flagpole': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.8);
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.9);
        break;
      }
      case 'bump': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.1);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.12);
        break;
      }
    }
  }

  function playMusic(name) {
    if (!audioReady || !ctx) return;
    currentMusicName = name;
    if (name !== 'overworld' && name !== 'underground') return;
    stopMusic();
    musicPlaying = true;

    const overworldMelody = [
      // bar 1
      [659,0.15],[659,0.15],[0,0.15],[659,0.15],[0,0.15],[523,0.15],[659,0.15],
      [784,0.30],[0,0.30],[392,0.30],
      // bar 2
      [523,0.30],[0,0.15],[392,0.30],[0,0.15],[330,0.30],
      [0,0.15],[440,0.15],[494,0.15],[466,0.15],[440,0.15],
      [392,0.20],[659,0.20],[784,0.20],[880,0.15],
      [698,0.15],[784,0.15],[0,0.08],[659,0.15],
      [523,0.15],[587,0.15],[494,0.15],[0,0.30],
      // bar 3
      [523,0.30],[0,0.15],[392,0.30],[0,0.15],[330,0.30],
      [0,0.45],[196,0.15],[196,0.15],[196,0.15],
      [196,0.15],[0,0.15],[196,0.15],[0,0.15],[247,0.15],
      [0,0.30],[262,0.15],[0,0.30],[247,0.15],
      [0,0.15],[233,0.15],[0,0.30],[220,0.15],
      [196,0.20],[262,0.20],[330,0.20],[392,0.15],
      [330,0.15],[262,0.15],[0,0.30],
    ];

    const undergroundMelody = [
      // Underground theme approximation
      [262,0.12],[262,0.12],[262,0.18],[0,0.06],
      [208,0.24],[233,0.24],[262,0.18],[0,0.06],[208,0.24],
      [233,0.12],[0,0.20],[196,0.24],[0,0.12],[233,0.24],
      [262,0.24],[233,0.24],[196,0.24],[175,0.30],[0,0.20],
      [165,0.24],[0,0.12],[208,0.24],[233,0.24],[0,0.12],
      [262,0.24],[294,0.30],[0,0.12],[311,0.24],[294,0.12],
      [0,0.12],[262,0.24],[0,0.12],[247,0.24],[233,0.36],
      [0,0.36],[196,0.18],[0,0.06],[196,0.18],[0,0.06],[196,0.24],
      [0,0.12],[175,0.24],[196,0.24],[208,0.18],[0,0.12],
      [196,0.18],[0,0.06],[175,0.24],[0,0.12],[165,0.30],[0,0.30],
    ];

    const melody = name === 'underground' ? undergroundMelody : overworldMelody;

    function startScheduling() {
      if (!musicPlaying) return;
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.08;
      musicGain.connect(ctx.destination);

      function scheduleMelody(startTime) {
        let t = startTime;
        melody.forEach(([freq, dur]) => {
          if (freq > 0) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.8, t);
            g.gain.linearRampToValueAtTime(0, t + dur * 0.9);
            osc.connect(g);
            g.connect(musicGain);
            osc.start(t);
            osc.stop(t + dur);
          }
          t += dur;
        });
        return t;
      }

      const totalDur = melody.reduce((s, [, d]) => s + d, 0);
      let endTime = scheduleMelody(ctx.currentTime + 0.05);

      function scheduleLoop() {
        if (!musicPlaying) return;
        endTime = scheduleMelody(endTime);
        setTimeout(scheduleLoop, totalDur * 1000 * 0.9);
      }
      setTimeout(scheduleLoop, totalDur * 1000 * 0.9);
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(startScheduling);
    } else {
      startScheduling();
    }
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicGain) {
      try { musicGain.disconnect(); } catch(e) {}
      musicGain = null;
    }
  }

  function pauseMusic() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function resumeMusic() {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (currentMusicName) {
          stopMusic();
          playMusic(currentMusicName);
        }
      });
    }
  }

  return { init, playSFX, playMusic, stopMusic, pauseMusic, resumeMusic };
})();
