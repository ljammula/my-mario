// ============================================================
// GAME — state machine + main loop
// ============================================================

function update() {
  blinkTimer++;
  updateInputRepeat();

  switch(gameState) {
    case STATE.TITLE:
      if (isPressed(['Enter'])) {
        AudioSystem.init();   // unlock AudioContext during user gesture
        gameState  = STATE.INTRO;
        stateTimer = 3 * 60;
        resetLevel(false);
      }
      break;

    case STATE.INTRO:
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.PLAYING;
        AudioSystem.init();
        AudioSystem.playMusic(getMusicTrack());
        musicStarted = true;
      }
      if (isPressed(['Enter'])) {
        gameState = STATE.PLAYING;
        AudioSystem.init();
        AudioSystem.playMusic(getMusicTrack());
        musicStarted = true;
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
          gameState    = STATE.GAMEOVER;
          stateTimer   = 5 * 60;
          musicStarted = false;
        } else {
          gameState    = STATE.INTRO;
          stateTimer   = 3 * 60;
          resetLevel(true);
          musicStarted = false;
        }
      }
      break;

    case STATE.WIN:
      stateTimer--;
      if (stateTimer <= 0) {
        currentLevel = (currentLevel % 3) + 1;
        gameState    = STATE.INTRO;
        stateTimer   = 3 * 60;
        resetLevel(true);
        musicStarted = false;
      }
      break;

    case STATE.GAMEOVER:
      stateTimer--;
      if (stateTimer <= 0) {
        gameState    = STATE.TITLE;
        score        = 0;
        coins        = 0;
        lives        = 3;
        musicStarted = false;
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
