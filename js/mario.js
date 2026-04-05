// ============================================================
// MARIO — head-bonk callback + physics update
// ============================================================

function handleHeadBonk(col, row) {
  const tile = getTile(col, row);
  if (tile === 'Q') {
    AudioSystem.playSFX('bump');
    const key     = `${col},${row}`;
    const content = currentQContents[key];
    grid[row][col] = 'U'; // mark as used
    if (content === 'coin') {
      score += 200;
      coins++;
      if (coins >= 100) { coins -= 100; lives++; }
      AudioSystem.playSFX('coin');
      items.push({
        type: 'coinpopup',
        x: col * TILE + 2,
        y: (row - 1) * TILE,
        vy: -2,
        timer: 30,
      });
    } else if (content === 'mushroom') {
      items.push({
        type: 'mushroom',
        x: col * TILE,
        y: (row - 1) * TILE,
        vx: 1.5, vy: 0,
        w: 14, h: 14,
        grounded: false,
      });
      AudioSystem.playSFX('bump');
    } else if (content === 'flower' || content === 'bomb') {
      if (mario.form === 'small') {
        items.push({
          type: 'mushroom',
          x: col * TILE,
          y: (row - 1) * TILE,
          vx: 1.5, vy: 0,
          w: 14, h: 14,
          grounded: false,
        });
      } else {
        items.push({
          type: 'bomb',
          x: col * TILE + 1,
          y: (row - 1) * TILE,
          vx: 1.5, vy: 0,
          w: 14, h: 14,
          grounded: false,
        });
      }
      AudioSystem.playSFX('bump');
    } else if (content === 'star') {
      items.push({
        type: 'star',
        x: col * TILE,
        y: (row - 1) * TILE,
        vx: 2, vy: -4,
        w: 12, h: 12,
        grounded: false,
      });
      AudioSystem.playSFX('bump');
    }
  } else if (tile === 'B') {
    if (mario.form !== 'small') {
      AudioSystem.playSFX('break_block');
      score += 50;
      grid[row][col] = '.';
    } else {
      AudioSystem.playSFX('bump');
    }
  } else if (tile === 'U' || tile === 'H') {
    AudioSystem.playSFX('bump');
  }
}

function updateMario() {
  if (mario.dead) {
    mario.vy += GRAVITY;
    if (mario.vy > MAX_FALL_SPEED) mario.vy = MAX_FALL_SPEED;
    mario.y += mario.vy;
    return;
  }

  if (mario.onFlagpole) {
    mario.y += 1.5;
    if (mario.y >= 13 * TILE - mario.h) {
      mario.onFlagpole = false;
      gameState = STATE.WIN;
      stateTimer = 4 * 60;
      AudioSystem.playSFX('flagpole');
      const timeBonus = Math.floor(gameTimer / 60) * 50;
      score += timeBonus;
      AudioSystem.stopMusic();
    }
    return;
  }

  const left         = isDown(['ArrowLeft',  'KeyA']);
  const right        = isDown(['ArrowRight', 'KeyD']);
  const downHeld     = isDown(['ArrowDown', 'KeyS']);
  const run          = isDown(['KeyX', 'ShiftLeft', 'ShiftRight']);
  const jumpPressed  = isPressed(['Space', 'KeyZ']);
  const jumpHeld     = isDown(['Space', 'KeyZ']);

  // Jump buffer
  if (jumpPressed) mario.jumpBuffer = JUMP_BUFFER;
  else if (mario.jumpBuffer > 0) mario.jumpBuffer--;

  // Coyote time
  if (mario.grounded) mario.coyoteFrames = COYOTE_FRAMES;
  else if (mario.coyoteFrames > 0) mario.coyoteFrames--;

  // Horizontal movement
  const accel  = run ? RUN_ACCELERATION : WALK_ACCELERATION;
  const maxSpd = run ? RUN_MAX_SPEED    : WALK_MAX_SPEED;
  const reverseControl = mario.grounded ? SKID_DECELERATION : SKID_DECELERATION * 0.55;
  const minStartSpeed = run ? 0.42 : 0.34;

  if (left && !right) {
    mario.facing = -1;
    const turningFromRight = mario.vx > 0.12;
    if (turningFromRight) {
      mario.vx -= reverseControl;
      if (mario.vx < 0 && mario.vx > -minStartSpeed) mario.vx = -minStartSpeed;
    } else {
      mario.vx -= accel;
      if (mario.vx > -minStartSpeed) mario.vx = Math.min(mario.vx, -minStartSpeed);
    }
    if (mario.vx < -maxSpd) mario.vx = -maxSpd;
  } else if (right && !left) {
    mario.facing = 1;
    const turningFromLeft = mario.vx < -0.12;
    if (turningFromLeft) {
      mario.vx += reverseControl;
      if (mario.vx > 0 && mario.vx < minStartSpeed) mario.vx = minStartSpeed;
    } else {
      mario.vx += accel;
      if (mario.vx < minStartSpeed) mario.vx = Math.max(mario.vx, minStartSpeed);
    }
    if (mario.vx > maxSpd) mario.vx = maxSpd;
  } else {
    if (mario.grounded) {
      if (Math.abs(mario.vx) < GROUND_FRICTION) mario.vx = 0;
      else mario.vx -= Math.sign(mario.vx) * GROUND_FRICTION;
    } else {
      if (Math.abs(mario.vx) < AIR_RESISTANCE) mario.vx = 0;
      else mario.vx -= Math.sign(mario.vx) * AIR_RESISTANCE;
    }
  }

  // Jump
  if (mario.jumpBuffer > 0 && mario.coyoteFrames > 0 && !mario.jumpedThisPress) {
    mario.vy             = JUMP_VELOCITY;
    mario.coyoteFrames   = 0;
    mario.jumpBuffer     = 0;
    mario.jumpedThisPress = true;
    mario.grounded       = false;
    AudioSystem.playSFX(mario.form === 'small' ? 'jump_small' : 'jump_super');
  }
  if (!isDown(['Space', 'KeyZ'])) mario.jumpedThisPress = false;

  // Variable-height jump
  if (jumpHeld && mario.vy < 0) mario.vy += JUMP_HOLD_GRAVITY;
  else                           mario.vy += GRAVITY;
  if (mario.vy > MAX_FALL_SPEED) mario.vy = MAX_FALL_SPEED;

  // Tile collision
  mario.grounded = resolvePlayerTileCollision(mario, handleHeadBonk);
  if (pipeTransitionLock > 0) pipeTransitionLock--;
  tryLevel3PipeTransition(downHeld);

  // World left boundary
  if (mario.x < 0) { mario.x = 0; mario.vx = 0; }

  // Fall into pit
  if (mario.y > LOGICAL_H + 32) { triggerMarioDeath(); return; }

  // Flagpole check
  const marioColCenter = Math.floor((mario.x + mario.w / 2) / TILE);
  if (currentArea === 'main' && marioColCenter === 210 && !mario.won) {
    mario.won        = true;
    mario.onFlagpole = true;
    mario.vx         = 0;
    mario.vy         = 0;
    mario.x          = 210 * TILE - mario.w / 2;
    const marioRow   = Math.floor(mario.y / TILE);
    let bonus = 100;
    if (marioRow <= 5)  bonus = 5000;
    else if (marioRow <= 7)  bonus = 2000;
    else if (marioRow <= 9)  bonus = 1000;
    else if (marioRow <= 11) bonus = 500;
    score += bonus;
    AudioSystem.playSFX('flagpole');
    AudioSystem.stopMusic();
  }

  // Invincibility flicker
  if (mario.invincibleFrames > 0) {
    mario.invincibleFrames--;
    mario.flickerVisible = (Math.floor(mario.invincibleFrames / 3) % 2 === 0);
  } else {
    mario.flickerVisible = true;
  }
  if (mario.starFrames > 0) {
    mario.starFrames--;
    mario.flickerVisible = (Math.floor(mario.starFrames / 3) % 2 === 0);
  }

  // Animation
  mario.animTimer++;
  if (mario.grounded && (left || right)) {
    if (mario.animTimer % 6 === 0) mario.animFrame = (mario.animFrame + 1) % 4;
  } else if (!mario.grounded) {
    mario.animFrame = 2;
  } else {
    mario.animFrame = 0;
  }

  // Fireball
  if (mario.form === 'fire' && isPressed(['KeyX'])) {
    if (fireballCooldown <= 0 && fireballs.filter(f => f.active).length < 2) {
      fireballs.push({
        x: mario.x + (mario.facing === 1 ? mario.w : 0),
        y: mario.y + mario.h / 2 - 4,
        vx: 6 * mario.facing,
        vy: 3,
        w: 8, h: 8,
        active: true,
        bounces: 0,
      });
      fireballCooldown = 10;
    }
  }
  if (fireballCooldown > 0) fireballCooldown--;
}

function tryLevel3PipeTransition(downHeld) {
  if (currentLevel !== 3 || !downHeld || !mario.grounded || pipeTransitionLock > 0) return;

  const centerX = mario.x + mario.w / 2;
  const feetY = mario.y + mario.h;

  if (currentArea === 'main') {
    const entryCol = 120;
    const pipeTopY = 11 * TILE;
    const onPipe = centerX >= entryCol * TILE &&
                   centerX <= (entryCol + 2) * TILE &&
                   Math.abs(feetY - pipeTopY) <= 2;
    if (onPipe) {
      enterLevel3HiddenArea();
    }
    return;
  }

  const returnCol = 196;
  const returnTopY = 11 * TILE;
  const onReturnPipe = centerX >= returnCol * TILE &&
                       centerX <= (returnCol + 2) * TILE &&
                       Math.abs(feetY - returnTopY) <= 2;
  if (onReturnPipe) {
    exitLevel3HiddenArea();
  }
}

function triggerMarioDeath() {
  if (mario.invincibleFrames > 0 || mario.dead) return;
  mario.dead = true;
  mario.vy   = DEATH_POP_VY;
  mario.vx   = 0;
  AudioSystem.playSFX('death');
  AudioSystem.stopMusic();
  gameState  = STATE.DEATH;
  stateTimer = 2 * 60;
}

function damageMario() {
  if (mario.invincibleFrames > 0 || mario.starFrames > 0) return;
  if (mario.form === 'fire') {
    mario.form             = 'super';
    mario.invincibleFrames = 2 * 60;
  } else if (mario.form === 'super') {
    mario.form             = 'small';
    mario.y               += 8;
    mario.h                = 16;
    mario.invincibleFrames = 2 * 60;
  } else {
    triggerMarioDeath();
  }
}
