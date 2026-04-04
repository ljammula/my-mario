// ============================================================
// GAME — state machine + main loop
// ============================================================

// Smoothstep easing: maps linear t→[0,1] to ease-in-out curve
function smoothstep(t) { return t * t * (3 - 2 * t); }

let fadeProgress  = 0; // raw linear progress 0→1
let levelNavHoldDir = 0;    // -1 left, 1 right, 0 idle
let levelNavHoldFrames = 0; // consecutive frames held in same nav direction
const LEVEL_NAV_REPEAT_DELAY = 10;
const LEVEL_NAV_REPEAT_INTERVAL = 4;

function stepSelectedLevel(dir) {
  if (dir < 0) {
    selectedLevel = selectedLevel > 1 ? selectedLevel - 1 : MAX_LEVEL;
  } else if (dir > 0) {
    selectedLevel = selectedLevel < MAX_LEVEL ? selectedLevel + 1 : 1;
  }
}

function updateLevelSelectNavigation() {
  const leftDown = isDown(['ArrowLeft']);
  const rightDown = isDown(['ArrowRight']);
  const dir = leftDown === rightDown ? 0 : (leftDown ? -1 : 1);

  if (dir === 0) {
    levelNavHoldDir = 0;
    levelNavHoldFrames = 0;
    return;
  }

  if (dir !== levelNavHoldDir) {
    levelNavHoldDir = dir;
    levelNavHoldFrames = 0;
    stepSelectedLevel(dir); // immediate response when direction changes
    return;
  }

  levelNavHoldFrames++;
  if (levelNavHoldFrames >= LEVEL_NAV_REPEAT_DELAY) {
    const repeatFrame = levelNavHoldFrames - LEVEL_NAV_REPEAT_DELAY;
    if (repeatFrame % LEVEL_NAV_REPEAT_INTERVAL === 0) {
      stepSelectedLevel(dir);
    }
  }
}

// Kick off a fade-out → callback → fade-in → doneState sequence
function startFade(callback, doneState) {
  fadeSrcState  = gameState;
  fadeAlpha     = 0;
  fadeProgress  = 0;
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
        startFade(() => {
          selectedLevel = 1;
          levelNavHoldDir = 0;
          levelNavHoldFrames = 0;
        }, STATE.LEVEL_SELECT);
      }
      break;

    case STATE.LEVEL_SELECT:
      updateLevelSelectNavigation();
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
      const FADE_FRAMES = 25; // frames per half (out or in) = 0.42s each
      fadeProgress += 1 / FADE_FRAMES;
      fadeAlpha = smoothstep(Math.min(fadeProgress, 1));
      if (fadeDir === 1 && fadeProgress >= 1) {
        fadeAlpha    = 1;
        fadeProgress = 0;
        if (fadeCallback) { fadeCallback(); fadeCallback = null; }
        fadeDir = -1;
      } else if (fadeDir === -1) {
        // Fading in: alpha goes 1→0 as progress 0→1
        fadeAlpha = smoothstep(Math.max(0, 1 - fadeProgress));
        if (fadeProgress >= 1) {
          fadeAlpha     = 0;
          fadeProgress  = 0;
          fadeDir       = 1;
          gameState     = fadeDoneState || STATE.TITLE;
          fadeDoneState = null;
        }
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
          currentLevel = (currentLevel % MAX_LEVEL) + 1;
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
