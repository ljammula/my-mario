// ============================================================
// ITEM UPDATES
// ============================================================

function updateItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];

    if (item.type === 'coinpopup') {
      item.y += item.vy;
      item.timer--;
      if (item.timer <= 0) items.splice(i, 1);
      continue;
    }

    // Gravity for mushroom/star
    if (item.type === 'mushroom' || item.type === 'star') {
      item.vy += GRAVITY;
      if (item.vy > MAX_FALL_SPEED) item.vy = MAX_FALL_SPEED;
    }

    if (item.type === 'star') {
      // Horizontal movement + wall bounce
      item.x += item.vx;
      if (item.vx < 0) {
        const col  = Math.floor(item.x / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = (col+1)*TILE; item.vx = -item.vx; break; }
        }
      } else {
        const col  = Math.floor((item.x + item.w - 1) / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = col*TILE - item.w; item.vx = -item.vx; break; }
        }
      }
      // Vertical bounce
      item.y += item.vy;
      const botY = item.y + item.h;
      const row  = Math.floor(botY / TILE);
      const colL = Math.floor(item.x / TILE);
      const colR = Math.floor((item.x + item.w - 1) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, row)) {
          item.y  = row * TILE - item.h;
          item.vy = item.vy * -0.9;
          if (Math.abs(item.vy) < 0.5) item.vy = -4; // min bounce
          break;
        }
      }
    } else if (item.type === 'mushroom') {
      // Horizontal walk + wall bounce
      item.x += item.vx;
      if (item.vx < 0) {
        const col  = Math.floor(item.x / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = (col+1)*TILE; item.vx = -item.vx; break; }
        }
      } else {
        const col  = Math.floor((item.x + item.w - 1) / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = col*TILE - item.w; item.vx = -item.vx; break; }
        }
      }
      // Gravity land
      item.y += item.vy;
      const botY = item.y + item.h;
      const row  = Math.floor(botY / TILE);
      const colL = Math.floor(item.x / TILE);
      const colR = Math.floor((item.x + item.w - 1) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, row)) {
          item.y        = row * TILE - item.h;
          item.vy       = 0;
          item.grounded = true;
          break;
        }
      }
      if (item.y > LOGICAL_H + 32) { items.splice(i, 1); continue; }
    }

    // Mario pickup
    if (item.type !== 'coinpopup' &&
        rectsOverlap(mario.x, mario.y, mario.w, mario.h,
                     item.x,  item.y,  item.w,  item.h)) {
      collectItem(item);
      items.splice(i, 1);
      continue;
    }

    if (item.y > LOGICAL_H + 64) items.splice(i, 1);
  }
}

function collectItem(item) {
  AudioSystem.playSFX('powerup_collect');
  if (item.type === 'mushroom') {
    score += 1000;
    if (mario.form === 'small') {
      mario.form = 'super';
      mario.h    = 24;
      mario.y   -= 8;
    }
  } else if (item.type === 'fireflower') {
    score += 1000;
    if (mario.form !== 'fire') {
      const wasSmall = mario.form === 'small';
      mario.form = 'fire';
      mario.h    = 24;
      if (wasSmall) mario.y -= 8;
    }
  } else if (item.type === 'star') {
    score         += 1000;
    mario.starFrames = 10 * 60;
  }
}
