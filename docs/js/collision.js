// ============================================================
// COLLISION DETECTION
// ============================================================

function resolvePlayerTileCollision(entity, onHeadBonk) {
  const hw = entity.w;
  const hh = entity.h;
  const prevBottom = entity.y + hh;
  const isOneWayPlatform = (col, row) => getTile(col, row) === 'M';
  const blocksFromSideOrBelow = (col, row) => {
    if (!isSolid(col, row)) return false;
    return !isOneWayPlatform(col, row);
  };

  // Horizontal pass
  entity.x += entity.vx;
  if (entity.vx < 0) {
    const col = Math.floor(entity.x / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (blocksFromSideOrBelow(col, r)) {
        entity.x = (col + 1) * TILE;
        entity.vx = 0;
        break;
      }
    }
  } else if (entity.vx > 0) {
    const col = Math.floor((entity.x + hw - 1) / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (blocksFromSideOrBelow(col, r)) {
        entity.x = col * TILE - hw;
        entity.vx = 0;
        break;
      }
    }
  }

  // Vertical pass (2px horizontal inset)
  entity.y += entity.vy;
  let grounded = false;
  const inset = 2;

  if (entity.vy < 0) {
    // Moving up — check head
    const row  = Math.floor(entity.y / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    let bonked = false;
    for (let c = colL; c <= colR; c++) {
      if (blocksFromSideOrBelow(c, row)) {
        entity.y  = (row + 1) * TILE;
        entity.vy = 0;
        if (!bonked && onHeadBonk) {
          onHeadBonk(c, row);
          bonked = true;
        }
        break;
      }
    }
  } else if (entity.vy >= 0) {
    // Moving down — check feet
    const botY = entity.y + hh;
    const row  = Math.floor(botY / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      const solid = isSolid(c, row);
      const oneWay = solid && isOneWayPlatform(c, row);
      const canLandOnOneWay = oneWay && prevBottom <= row * TILE;
      if ((solid && !oneWay) || canLandOnOneWay) {
        entity.y  = row * TILE - hh;
        entity.vy = 0;
        grounded  = true;
        break;
      }
    }
    // Also check when standing still (vy == 0)
    if (!grounded && entity.vy === 0) {
      const standRow = Math.floor((entity.y + hh) / TILE);
      for (let c = colL; c <= colR; c++) {
        const solid = isSolid(c, standRow);
        const oneWay = solid && isOneWayPlatform(c, standRow);
        if ((solid && !oneWay) || oneWay) { grounded = true; break; }
      }
    }
  }

  return grounded;
}

function resolveEnemyTileCollision(entity) {
  const hw = entity.w;
  const hh = entity.h;

  // Horizontal
  entity.x += entity.vx;
  if (entity.vx < 0) {
    const col    = Math.floor(entity.x / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x  = (col + 1) * TILE;
        entity.vx = -entity.vx;
        break;
      }
    }
  } else if (entity.vx > 0) {
    const col    = Math.floor((entity.x + hw - 1) / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x  = col * TILE - hw;
        entity.vx = -entity.vx;
        break;
      }
    }
  }

  // Vertical
  entity.y += entity.vy;
  let grounded = false;
  const inset  = 1;

  if (entity.vy < 0) {
    const row  = Math.floor(entity.y / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y  = (row + 1) * TILE;
        entity.vy = 0;
        break;
      }
    }
  } else {
    const botY = entity.y + hh;
    const row  = Math.floor(botY / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y  = row * TILE - hh;
        entity.vy = 0;
        grounded  = true;
        break;
      }
    }
    if (!grounded && entity.vy === 0) {
      const standRow = Math.floor((entity.y + hh) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, standRow)) { grounded = true; break; }
      }
    }
  }

  return grounded;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
