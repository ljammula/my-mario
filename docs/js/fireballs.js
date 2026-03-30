// ============================================================
// FIREBALL UPDATES
// ============================================================

function updateFireballs() {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    fb.vy += GRAVITY;
    fb.x  += fb.vx;

    // Horizontal wall collision
    const col  = fb.vx > 0 ? Math.floor((fb.x + fb.w) / TILE) : Math.floor(fb.x / TILE);
    const rowT = Math.floor(fb.y / TILE);
    const rowB = Math.floor((fb.y + fb.h - 1) / TILE);
    for (let r = rowT; r <= rowB; r++) {
      if (isSolid(col, r)) { fb.active = false; break; }
    }
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    fb.y += fb.vy;
    // Floor bounce
    const botRow = Math.floor((fb.y + fb.h) / TILE);
    const colL   = Math.floor(fb.x / TILE);
    const colR   = Math.floor((fb.x + fb.w - 1) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, botRow)) {
        fb.y  = botRow * TILE - fb.h;
        fb.vy *= -0.75;
        fb.bounces++;
        if (fb.bounces >= 5) fb.active = false;
        break;
      }
    }
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    // Off screen
    if (fb.y > LOGICAL_H + 32 || fb.x < cameraX - 32 || fb.x > cameraX + LOGICAL_W + 32) {
      fireballs.splice(i, 1);
      continue;
    }

    // Hit enemies
    for (const enemy of enemies) {
      if (enemy.state === 'dead' || enemy.state === 'squish') continue;
      if (rectsOverlap(fb.x, fb.y, fb.w, fb.h, enemy.x, enemy.y, enemy.w, enemy.h)) {
        enemy.state = 'dead';
        score += 200;
        fb.active = false;
        fireballs.splice(i, 1);
        AudioSystem.playSFX('stomp');
        break;
      }
    }
  }
}
