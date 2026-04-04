// ============================================================
// ENEMY UPDATES
// ============================================================

function updateEnemies() {
  const viewRight = cameraX + LOGICAL_W + 300;

  for (const enemy of enemies) {
    if (enemy.state === 'dead') continue;

    // Activate when in range
    if (!enemy.active && enemy.x < viewRight) enemy.active = true;
    if (!enemy.active) continue;

    // Deactivate if far behind camera
    if (enemy.x + enemy.w < cameraX - 32) { enemy.state = 'dead'; continue; }

    if (enemy.type === 'goomba')      updateGoomba(enemy);
    else if (enemy.type === 'koopa')  updateKoopa(enemy);

    // Check Mario collision for active enemy states
    if (enemy.state === 'walk' || enemy.state === 'shell_moving' || enemy.state === 'shell') {
      checkEnemyMarioCollision(enemy);
    }
  }

  updatePiranha();
}

function updateGoomba(g) {
  if (g.state === 'squish') {
    g.stateTimer++;
    if (g.stateTimer >= 30) g.state = 'dead';
    return;
  }

  if (g.edgeAware) {
    const checkCol  = g.vx < 0 ? Math.floor((g.x - 1) / TILE) : Math.floor((g.x + g.w) / TILE);
    const groundRow = Math.floor((g.y + g.h + 1) / TILE);
    if (!isSolid(checkCol, groundRow) && g.vy >= 0) g.vx = -g.vx;
  }

  g.vy += GRAVITY;
  if (g.vy > MAX_FALL_SPEED) g.vy = MAX_FALL_SPEED;

  const grounded = resolveEnemyTileCollision(g);
  if (!grounded && g.vy > 0 && g.y > LOGICAL_H + 32) g.state = 'dead';
}

function updateKoopa(k) {
  if (k.state === 'shell') {
    k.stateTimer++;
    return;
  }

  k.vy += GRAVITY;
  if (k.vy > MAX_FALL_SPEED) k.vy = MAX_FALL_SPEED;

  if (k.state === 'walk') {
    // Turn around at ledges
    const checkCol  = k.vx < 0 ? Math.floor((k.x - 1) / TILE) : Math.floor((k.x + k.w) / TILE);
    const groundRow = Math.floor((k.y + k.h + 1) / TILE);
    if (!isSolid(checkCol, groundRow) && k.vy >= 0) k.vx = -k.vx;
  }

  const grounded = resolveEnemyTileCollision(k);
  if (!grounded && k.y > LOGICAL_H + 32) k.state = 'dead';

  if (k.state === 'shell_moving') {
    for (const other of enemies) {
      if (other === k || other.state === 'dead') continue;
      if (rectsOverlap(k.x, k.y, k.w, k.h, other.x, other.y, other.w, other.h)) {
        other.state = 'dead';
        score += 200;
      }
    }
  }
}

function updatePiranha() {
  if (!piranha) return;
  const pipeX = piranha.pipeX ?? (piranha.x + piranha.w / 2);
  const marioCenterX = mario.x + mario.w / 2;
  const marioNear = Math.abs(marioCenterX - pipeX) < TILE;

  piranha.timer++;
  const cycle = 120; // 2s at 60fps

  if (piranha.state === 'hidden') {
    if (!marioNear && piranha.timer >= cycle) {
      piranha.state = 'rising';
      piranha.timer = 0;
    }
    piranha.visible = false;
    piranha.y       = piranha.baseY;
  } else if (piranha.state === 'rising') {
    piranha.y -= 0.5;
    piranha.visible = true;
    if (piranha.y <= piranha.targetY) {
      piranha.y     = piranha.targetY;
      piranha.state = 'up';
      piranha.timer = 0;
    }
  } else if (piranha.state === 'up') {
    piranha.visible = true;
    if (piranha.timer >= cycle) {
      piranha.state = 'lowering';
      piranha.timer = 0;
    }
    if (rectsOverlap(piranha.x, piranha.y, piranha.w, piranha.h,
                     mario.x,   mario.y,   mario.w,   mario.h)) {
      damageMario();
    }
  } else if (piranha.state === 'lowering') {
    piranha.y += 0.5;
    piranha.visible = true;
    if (piranha.y >= piranha.baseY) {
      piranha.y     = piranha.baseY;
      piranha.state = 'hidden';
      piranha.timer = 0;
    }
  }
}

function checkEnemyMarioCollision(enemy) {
  if (!rectsOverlap(mario.x, mario.y, mario.w, mario.h,
                    enemy.x, enemy.y, enemy.w, enemy.h)) return;

  // Star invincibility
  if (mario.starFrames > 0) {
    enemy.state = 'dead';
    score += 200;
    return;
  }

  // Stomp check: mario is descending and his center is above enemy center
  const marioFeet = mario.y + mario.h;
  const marioCenterY = mario.y + mario.h * 0.5;
  const enemyCenterY = enemy.y + enemy.h * 0.5;
  const hOverlap  = Math.min(mario.x + mario.w, enemy.x + enemy.w) - Math.max(mario.x, enemy.x);

  if (mario.vy > 0 && marioFeet > enemy.y + 1 && marioCenterY < enemyCenterY && hOverlap > 1) {
    mario.vy       = -5;
    mario.grounded = false;
    if (enemy.type === 'goomba') {
      if (enemy.state === 'walk') {
        enemy.state      = 'squish';
        enemy.stateTimer = 0;
        score += 100;
        AudioSystem.playSFX('stomp');
      }
    } else if (enemy.type === 'koopa') {
      if (enemy.state === 'walk') {
        enemy.state      = 'shell';
        enemy.stateTimer = 0;
        enemy.vx         = 0;
        score += 100;
        AudioSystem.playSFX('stomp');
      } else if (enemy.state === 'shell') {
        const kickDir = mario.x < enemy.x ? 1 : -1;
        enemy.vx      = 8 * kickDir;
        enemy.state   = 'shell_moving';
        AudioSystem.playSFX('stomp');
      } else if (enemy.state === 'shell_moving') {
        enemy.vx         = 0;
        enemy.state      = 'shell';
        enemy.stateTimer = 0;
        AudioSystem.playSFX('stomp');
      }
    }
  } else {
    damageMario();
  }
}
