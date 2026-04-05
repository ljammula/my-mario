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

    if (enemy.type === 'goomba')             updateGoomba(enemy);
    else if (enemy.type === 'koopa')         updateKoopa(enemy);
    else if (enemy.type === 'winged_koopa')  updateWingedKoopa(enemy);
    else if (enemy.type === 'hammer_bro')    updateHammerBro(enemy);
    else if (enemy.type === 'bullet_launcher') updateBulletLauncher(enemy);
    else if (enemy.type === 'bullet_bill')   updateBulletBill(enemy);
    else if (enemy.type === 'hammer_projectile') updateHammerProjectile(enemy);

    // Check Mario collision for active enemy states
    if (enemy.damageOnTouch || enemy.state === 'walk' || enemy.state === 'shell_moving' || enemy.state === 'shell') {
      checkEnemyMarioCollision(enemy);
    }
  }

  updatePiranha();
}

function spawnBulletBill(launcher) {
  const toLeft = mario.x < launcher.x;
  enemies.push({
    type: 'bullet_bill',
    x: launcher.x + (toLeft ? -14 : 16),
    y: launcher.y + 6,
    vx: toLeft ? -2.7 : 2.7,
    vy: 0,
    w: 14,
    h: 10,
    state: 'flying',
    active: true,
    damageOnTouch: true,
  });
}

function spawnHammerProjectile(thrower) {
  const towardMario = mario.x >= thrower.x ? 1 : -1;
  enemies.push({
    type: 'hammer_projectile',
    x: thrower.x + thrower.w / 2,
    y: thrower.y + 4,
    vx: towardMario * 2.2,
    vy: -3.8,
    w: 8,
    h: 8,
    state: 'flying',
    active: true,
    damageOnTouch: true,
    spinFrame: 0,
  });
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

function updateWingedKoopa(k) {
  if (k.edgeAware) {
    const checkCol = k.vx < 0 ? Math.floor((k.x - 1) / TILE) : Math.floor((k.x + k.w) / TILE);
    const groundRow = Math.floor((k.y + k.h + 1) / TILE);
    if (!isSolid(checkCol, groundRow) && k.vy >= 0) k.vx = -k.vx;
  }

  k.wingHopTimer = (k.wingHopTimer || 0) + 1;
  if (k.wingHopTimer >= 70) {
    k.wingHopTimer = 0;
    k.vy = -5.2;
  }

  k.vy += GRAVITY * 0.8;
  if (k.vy > MAX_FALL_SPEED) k.vy = MAX_FALL_SPEED;

  const grounded = resolveEnemyTileCollision(k);
  if (!grounded && k.y > LOGICAL_H + 32) k.state = 'dead';
}

function updateHammerBro(h) {
  h.throwTimer = (h.throwTimer || 0) + 1;
  h.jumpTimer = (h.jumpTimer || 0) + 1;
  h.stateTimer = (h.stateTimer || 0) + 1;

  if (h.stateTimer >= 90) {
    h.stateTimer = 0;
    h.vx = -h.vx;
  }

  if (h.jumpTimer >= 105) {
    h.jumpTimer = 0;
    h.vy = -5.8;
  }

  if (h.throwTimer >= 85) {
    h.throwTimer = 0;
    spawnHammerProjectile(h);
  }

  if (h.edgeAware) {
    const checkCol = h.vx < 0 ? Math.floor((h.x - 1) / TILE) : Math.floor((h.x + h.w) / TILE);
    const groundRow = Math.floor((h.y + h.h + 1) / TILE);
    if (!isSolid(checkCol, groundRow) && h.vy >= 0) h.vx = -h.vx;
  }

  h.vy += GRAVITY;
  if (h.vy > MAX_FALL_SPEED) h.vy = MAX_FALL_SPEED;
  const grounded = resolveEnemyTileCollision(h);
  if (!grounded && h.y > LOGICAL_H + 32) h.state = 'dead';
}

function updateBulletLauncher(launcher) {
  launcher.shootTimer = (launcher.shootTimer || 0) + 1;
  if (launcher.shootTimer >= launcher.shootInterval) {
    launcher.shootTimer = 0;
    spawnBulletBill(launcher);
  }
}

function updateBulletBill(b) {
  b.x += b.vx;
  if (b.x + b.w < cameraX - 64 || b.x > cameraX + LOGICAL_W + 64) b.state = 'dead';
}

function updateHammerProjectile(h) {
  h.spinFrame = ((h.spinFrame || 0) + 1) % 8;
  h.vy += GRAVITY * 0.7;
  if (h.vy > MAX_FALL_SPEED) h.vy = MAX_FALL_SPEED;
  h.x += h.vx;
  h.y += h.vy;
  const col = Math.floor((h.x + h.w / 2) / TILE);
  const row = Math.floor((h.y + h.h / 2) / TILE);
  if (isSolid(col, row) || h.y > LOGICAL_H + 48) h.state = 'dead';
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

  // Stomp check: mario is descending and his feet land in the top 70% of the enemy.
  // Using feet-vs-enemy-height avoids the center-comparison failure with fast enemies
  // or same-height characters (e.g. super Mario h=24 stomping a koopa h=24).
  const marioFeet = mario.y + mario.h;
  const hOverlap  = Math.min(mario.x + mario.w, enemy.x + enemy.w) - Math.max(mario.x, enemy.x);

  if (mario.vy > 0 && marioFeet <= enemy.y + enemy.h * 0.70 && hOverlap > 1) {
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
    } else if (enemy.type === 'winged_koopa') {
      enemy.type = 'koopa';
      enemy.state = 'walk';
      enemy.stateTimer = 0;
      enemy.edgeAware = true;
      enemy.damageOnTouch = false;
      enemy.vx = enemy.vx < 0 ? -1.2 : 1.2;
      score += 200;
      AudioSystem.playSFX('stomp');
    } else if (enemy.type === 'bullet_bill' || enemy.type === 'hammer_bro' || enemy.type === 'hammer_projectile') {
      enemy.state = 'dead';
      score += 200;
      AudioSystem.playSFX('stomp');
    }
  } else {
    damageMario();
  }
}
