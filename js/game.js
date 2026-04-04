// ============================================================
// GAME — state machine + main loop
// ============================================================

// Kick off a fade-out → callback → fade-in → doneState sequence
function startFade(callback, doneState) {
  fadeSrcState  = gameState;
  fadeAlpha     = 0;
  fadeDir       = 1;
  fadeCallback  = callback;
  fadeDoneState = doneState;
  gameState     = STATE.FADE;
  AudioSystem.stopMusic();
}

function update() {
  blinkTimer++;
  updateInputRepeat();

  switch(gameState) {
    case STATE.TITLE:
      if (isPressed(['Enter'])) {
        AudioSystem.init();
        startFade(() => { selectedLevel = 1; }, STATE.LEVEL_SELECT);
      }
      break;

    case STATE.LEVEL_SELECT:
      if (isPressed(['ArrowLeft', 'ArrowRight'])) AudioSystem.init();
      if (isPressed(['ArrowLeft']))  selectedLevel = selectedLevel > 1 ? selectedLevel - 1 : 5;
      if (isPressed(['ArrowRight'])) selectedLevel = selectedLevel < 5 ? selectedLevel + 1 : 1;
      if (isPressed(['Enter'])) {
        AudioSystem.init();
        currentLevel = selectedLevel;
        startFade(() => {
          resetLevel(false);
          stateTimer   = 3 * 60;
          musicStarted = false;
        }, STATE.INTRO);
      }
      break;

    case STATE.FADE: {
      const FADE_SPEED = 1 / 20; // 20 frames per direction (0.33 sec each)
      fadeAlpha += fadeDir * FADE_SPEED;
      if (fadeDir === 1 && fadeAlpha >= 1) {
        fadeAlpha = 1;
        if (fadeCallback) { fadeCallback(); fadeCallback = null; }
        fadeDir = -1;
      } else if (fadeDir === -1 && fadeAlpha <= 0) {
        fadeAlpha = 0;
        fadeDir   = 1;
        gameState = fadeDoneState || STATE.TITLE;
        fadeDoneState = null;
      }
      break;
    }

    case STATE.INTRO:
      if (!musicStarted) {
        AudioSystem.init();
        AudioSystem.playMusic(getMusicTrack());
        musicStarted = true;
      }
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.PLAYING;
      }
      if (isPressed(['Enter'])) {
        gameState = STATE.PLAYING;
      }
      break;

    case STATE.PLAYING: {
      if (isPressed(['Enter'])) {
        gameState = STATE.PAUSED;
        AudioSystem.pauseMusic();
        break;
      }
      gameTimer--;
      if (gameTimer <= 0) { triggerMarioDeath(); break; }

      updateMario();
      updateCamera();
      updateEnemies();
      updateItems();
      updateFireballs();
      break;
    }

    case STATE.PAUSED:
      if (isPressed(['Enter'])) {
        gameState = STATE.PLAYING;
        AudioSystem.resumeMusic();
      }
      break;

    case STATE.DEATH:
      mario.vy += GRAVITY;
      mario.y  += mario.vy;
      stateTimer--;
      if (stateTimer <= 0) {
        lives--;
        if (lives <= 0) {
          startFade(() => {
            stateTimer   = 5 * 60;
            musicStarted = false;
          }, STATE.GAMEOVER);
        } else {
          startFade(() => {
            resetLevel(true);
            stateTimer   = 3 * 60;
            musicStarted = false;
          }, STATE.INTRO);
        }
      }
      break;

    case STATE.WIN:
      stateTimer--;
      if (stateTimer <= 0) {
        startFade(() => {
          currentLevel = (currentLevel % 5) + 1;
          resetLevel(true);
          stateTimer   = 3 * 60;
          musicStarted = false;
        }, STATE.INTRO);
      }
      break;

    case STATE.GAMEOVER:
      stateTimer--;
      if (stateTimer <= 0) {
        startFade(() => {
          score        = 0;
          coins        = 0;
          lives        = 3;
          musicStarted = false;
        }, STATE.TITLE);
      }
      break;
  }

  clearInputEdges();
}

// ---- Main loop ----

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const STEP_MS = 1000 / 60;
let accumulator = 0;
let lastTime    = 0;

function loop(timestamp) {
  const delta = Math.min(timestamp - lastTime, 50);
  lastTime     = timestamp;
  accumulator += delta;
  while (accumulator >= STEP_MS) {
    update();
    accumulator -= STEP_MS;
  }
  render(ctx);
  requestAnimationFrame(loop);
}

// Initialize and start
resetLevel(false);
requestAnimationFrame(loop);
