// ============================================================
// RENDERING — drawing helpers + main render function
// ============================================================

// World → screen coordinate conversion
function wx(worldX) { return (worldX - cameraX) * SCALE; }
function wy(worldY) { return worldY * SCALE; }

// ---- Tile drawing ----

function drawTile(ctx, id, col, row) {
  const sx = (col * TILE - cameraX) * SCALE;
  const sy = row * TILE * SCALE;
  const sz = TILE * SCALE; // 32px

  if (sx + sz < 0 || sx > CANVAS_W) return; // cull off-screen

  switch(id) {
    case 'G': {
      const above = getTile(col, row - 1);
      if (above === '.' || above === 'B' || above === 'Q' || above === 'U' || above === 'H') {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy, sz, sz);
        ctx.fillStyle = '#228B22';
        ctx.fillRect(sx, sy, sz, 4);
        ctx.fillStyle = '#145214';
        ctx.fillRect(sx, sy + 4, sz, 2);
      } else {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy, sz, sz);
      }
      break;
    }
    case 'B': {
      ctx.fillStyle = '#CD853F';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#8B6347';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + 3*sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      break;
    }
    case 'Q': {
      ctx.fillStyle = '#FF8C00';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy+sz-2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx+sz-2, sy, 2, sz);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${sz*0.6}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + sz/2, sy + sz/2 + 1);
      break;
    }
    case 'U': {
      ctx.fillStyle = '#888888';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#666666';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy+sz-2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx+sz-2, sy, 2, sz);
      break;
    }
    case 'H': {
      ctx.fillStyle = '#B87333';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + 3*sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      break;
    }
    case 'PT': {
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#008000';
      ctx.fillRect(sx + 4, sy + 4, sz - 8, sz - 4);
      ctx.fillStyle = '#00A000';
      ctx.fillRect(sx + 4, sy + 4, 4, sz - 4);
      break;
    }
    case 'PR': {
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#008000';
      ctx.fillRect(sx, sy + 4, sz - 4, sz - 4);
      ctx.fillStyle = '#00A000';
      ctx.fillRect(sx, sy + 4, 4, sz - 4);
      break;
    }
    case 'PL': {
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#007000';
      ctx.fillRect(sx + 4, sy, sz - 8, sz);
      ctx.fillStyle = '#009000';
      ctx.fillRect(sx + 4, sy, 4, sz);
      break;
    }
    case 'PB': {
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#007000';
      ctx.fillRect(sx, sy, sz - 4, sz);
      ctx.fillStyle = '#009000';
      ctx.fillRect(sx, sy, 4, sz);
      break;
    }
    case 'FP': {
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(sx + sz/2 - 2, sy, 4, sz);
      break;
    }
    case 'FF': {
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(sx + sz/2 - 2, sy, 4, sz);
      ctx.fillStyle = '#CC0000';
      ctx.beginPath();
      ctx.moveTo(sx + sz/2 + 2,      sy + 2);
      ctx.lineTo(sx + sz/2 + 2 + 16, sy + 8);
      ctx.lineTo(sx + sz/2 + 2,      sy + 14);
      ctx.fill();
      break;
    }
    case 'CA': {
      ctx.fillStyle = '#888888';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#666666';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy, 2, sz);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      break;
    }
    case 'CD': {
      ctx.fillStyle = '#222222';
      ctx.fillRect(sx, sy, sz, sz);
      break;
    }
  }
}

// ---- Entity drawing ----

function drawMario(ctx) {
  if (!mario.flickerVisible) return;
  const x = wx(mario.x);
  const y = wy(mario.y);
  const w = mario.w * SCALE;
  const f = mario.facing;

  if (mario.starFrames > 0) {
    const colors = ['#FF0000','#FF8800','#FFFF00','#00FF00','#0000FF','#FF00FF'];
    ctx.fillStyle = colors[Math.floor(Date.now()/80) % colors.length];
    ctx.fillRect(x, y, w, mario.h * SCALE);
    return;
  }

  ctx.save();
  if (f === -1) {
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
    drawMarioShape(ctx, 0, y, w, mario.h * SCALE, mario.form, mario.animFrame);
  } else {
    drawMarioShape(ctx, x, y, w, mario.h * SCALE, mario.form, mario.animFrame);
  }
  ctx.restore();
}

function drawMarioShape(ctx, x, y, w, h, form, frame) {
  const s = SCALE;
  // Hat
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(x + 2*s, y, 8*s, 3*s);
  ctx.fillRect(x, y + 3*s, 10*s, 2*s);
  // Face
  ctx.fillStyle = '#FC9838';
  ctx.fillRect(x + 1*s, y + 4*s, 9*s, 5*s);
  // Eye
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 6*s, y + 5*s, 2*s, 2*s);
  // Mustache
  ctx.fillStyle = '#5C3317';
  ctx.fillRect(x + 3*s, y + 7*s, 7*s, 2*s);
  // Overalls
  ctx.fillStyle = '#0000CC';
  if (form === 'small') {
    ctx.fillRect(x + 1*s, y + 9*s, 9*s, 4*s);
    ctx.fillRect(x + 3*s, y + 9*s, 5*s, 2*s);
  } else {
    ctx.fillRect(x + 1*s, y + 9*s, 9*s, 9*s);
    ctx.fillRect(x + 3*s, y + 9*s, 5*s, 3*s);
  }
  // Shirt
  ctx.fillStyle = '#CC0000';
  if (form === 'small') {
    ctx.fillRect(x,        y + 9*s, 3*s, 4*s);
    ctx.fillRect(x + 9*s,  y + 9*s, 2*s, 4*s);
  } else {
    ctx.fillRect(x,        y + 9*s, 3*s, 7*s);
    ctx.fillRect(x + 9*s,  y + 9*s, 2*s, 7*s);
  }
  // Shoes
  ctx.fillStyle = '#5C3317';
  if (form === 'small') {
    if (frame === 1 || frame === 3) {
      ctx.fillRect(x,       y + 13*s, 5*s, 3*s);
      ctx.fillRect(x + 6*s, y + 12*s, 5*s, 4*s);
    } else {
      ctx.fillRect(x,       y + 13*s, 4*s, 3*s);
      ctx.fillRect(x + 7*s, y + 13*s, 4*s, 3*s);
    }
  } else {
    if (frame === 1 || frame === 3) {
      ctx.fillRect(x,       y + 18*s, 5*s, 6*s);
      ctx.fillRect(x + 6*s, y + 17*s, 5*s, 7*s);
    } else {
      ctx.fillRect(x,       y + 18*s, 4*s, 6*s);
      ctx.fillRect(x + 7*s, y + 18*s, 4*s, 6*s);
    }
  }
}

function drawGoomba(ctx, enemy) {
  if (enemy.state === 'dead') return;
  const x = wx(enemy.x);
  const y = wy(enemy.y);
  const s = SCALE;

  if (enemy.state === 'squish') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, y + enemy.h*s - 6*s, enemy.w*s, 6*s);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 2*s, y + enemy.h*s - 5*s, 3*s, 3*s);
    ctx.fillRect(x + 10*s, y + enemy.h*s - 5*s, 3*s, 3*s);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 3*s,  y + enemy.h*s - 4*s, 2*s, 2*s);
    ctx.fillRect(x + 11*s, y + enemy.h*s - 4*s, 2*s, 2*s);
    return;
  }

  const w = enemy.w * s;
  const h = enemy.h * s;

  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y + 4*s, w, h - 4*s, 4) : ctx.rect(x, y + 4*s, w, h - 4*s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w/2, y + 5*s, 7*s, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + 3*s, 4*s, 4*s);
  ctx.fillRect(x + 9*s, y + 3*s, 4*s, 4*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 3*s,  y + 4*s, 2*s, 2*s);
  ctx.fillRect(x + 10*s, y + 4*s, 2*s, 2*s);
  ctx.fillRect(x + 2*s,  y + 2*s, 5*s, 2*s);
  ctx.fillRect(x + 8*s,  y + 2*s, 5*s, 2*s);

  ctx.fillStyle = '#5C2E00';
  const anim = Math.floor(Date.now() / 150) % 2;
  if (anim === 0) {
    ctx.fillRect(x,        y + h - 4*s, 5*s, 4*s);
    ctx.fillRect(x + 10*s, y + h - 2*s, 6*s, 2*s);
  } else {
    ctx.fillRect(x,        y + h - 2*s, 6*s, 2*s);
    ctx.fillRect(x + 11*s, y + h - 4*s, 5*s, 4*s);
  }
}

function drawKoopa(ctx, enemy) {
  if (enemy.state === 'dead') return;
  const x = wx(enemy.x);
  const y = wy(enemy.y);
  const s = SCALE;
  const w = enemy.w * s;
  const h = enemy.h * s;

  if (enemy.state === 'shell' || enemy.state === 'shell_moving') {
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 2*s, y + h/2, w - 4*s, h/2, 4) : ctx.rect(x + 2*s, y + h/2, w - 4*s, h/2);
    ctx.fill();
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(x + 4*s, y + h/2 + 2*s, w - 8*s, 4*s);
    ctx.fillStyle = '#006400';
    ctx.fillRect(x + w/2 - s, y + h/2, 2*s, h/2);
    ctx.fillRect(x + 2*s, y + h*0.75, w - 4*s, 2*s);
    return;
  }

  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x + 1*s, y + 8*s, w - 2*s, h - 12*s, 3) : ctx.rect(x + 1*s, y + 8*s, w - 2*s, h - 12*s);
  ctx.fill();
  ctx.fillStyle = '#006400';
  ctx.fillRect(x + w/2 - s, y + 8*s, 2*s, h - 12*s);
  ctx.fillRect(x + 1*s, y + (h-12*s)/2 + 8*s, w - 2*s, 2*s);

  ctx.fillStyle = '#90EE90';
  ctx.fillRect(x + 3*s, y + 2*s, w - 6*s, 8*s);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 4*s, y + 3*s, 3*s, 3*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 5*s, y + 4*s, 2*s, 2*s);
  ctx.fillStyle = '#5C3317';
  ctx.fillRect(x,           y + h - 6*s, 5*s, 6*s);
  ctx.fillRect(x + w - 5*s, y + h - 4*s, 5*s, 4*s);
}

function drawMushroom(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  ctx.fillStyle = '#CC0000';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 5*s, 7*s, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + 2*s, 3*s, 3*s);
  ctx.fillRect(x + 9*s, y + 2*s, 3*s, 3*s);
  ctx.fillStyle = '#FC9838';
  ctx.fillRect(x + 3*s, y + 5*s, 8*s, 7*s);
  ctx.fillStyle = '#E08828';
  ctx.fillRect(x + 3*s, y + 5*s, 2*s, 7*s);
}

function drawFireFlower(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + 6*s, y + 6*s, 2*s, 8*s);
  const t = Math.floor(Date.now() / 200) % 2;
  ctx.fillStyle = t === 0 ? '#FF4400' : '#FF8800';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 4*s, 5*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 4*s, 3*s, 0, Math.PI*2);
  ctx.fill();
}

function drawStar(ctx, item) {
  const x  = wx(item.x);
  const y  = wy(item.y);
  const s  = SCALE;
  const colors = ['#FFD700','#FFFF00','#FFA500'];
  ctx.fillStyle = colors[Math.floor(Date.now()/100) % colors.length];
  const cx = x + 6*s, cy = y + 6*s, r = 6*s;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI/2;
    const rad   = i % 2 === 0 ? r : r * 0.4;
    const px    = cx + Math.cos(angle) * rad;
    const py    = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else         ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawFireball(ctx, fb) {
  const x = wx(fb.x);
  const y = wy(fb.y);
  const s = SCALE;
  const t = Math.floor(Date.now()/60) % 2;
  ctx.fillStyle = t === 0 ? '#FF6600' : '#FFFF00';
  ctx.beginPath();
  ctx.arc(x + fb.w*s/2, y + fb.h*s/2, fb.w*s/2, 0, Math.PI*2);
  ctx.fill();
}

function drawCoinPopup(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + 4*s, y + 4*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.arc(x + 4*s, y + 4*s, 2*s, 0, Math.PI*2);
  ctx.fill();
}

function drawPiranha(ctx) {
  if (!piranha || !piranha.visible) return;
  const x = wx(piranha.x);
  const y = wy(piranha.y);
  const s = SCALE;
  const w = piranha.w * s;
  const h = piranha.h * s;
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(x, y, w, h * 0.6);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + h*0.4, w - 4*s, h*0.15);
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + w*0.3, y + h*0.6, w*0.4, h*0.4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w - 5*s, y + 2*s, 3*s, 3*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - 4*s, y + 3*s, 2*s, 2*s);
}

// ---- HUD ----

function drawHUD(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillText('MARIO', 24, 10);
  ctx.fillText(String(score).padStart(6, '0'), 24, 28);

  ctx.fillText('\u00D7' + String(coins).padStart(2,'0'), 200, 28);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(196, 35, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';

  ctx.fillText('WORLD', 296, 10);
  ctx.fillText('1-' + currentLevel, 316, 28);

  ctx.fillText('TIME', 400, 10);
  ctx.fillText(String(Math.max(0, Math.ceil(gameTimer / 60))).padStart(3,'0'), 420, 28);

  ctx.fillText('\u2665\u00D7' + lives, 100, 10);
}

// ---- Screen overlays ----

function drawSky(ctx) {
  ctx.fillStyle = currentLevel === 2 ? '#000000' : '#5C94FC';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTitleScreen(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MY MARIO', CANVAS_W/2, CANVAS_H/2 - 60);
  if (Math.floor(blinkTimer / 30) % 2 === 0) {
    ctx.font = '16px monospace';
    ctx.fillText('PRESS ENTER TO START', CANVAS_W/2, CANVAS_H/2 + 20);
  }
  ctx.font = '10px monospace';
  ctx.fillStyle = '#888888';
  ctx.fillText('WORLD 1-1', CANVAS_W/2, CANVAS_H/2 + 80);
}

function drawIntroScreen(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WORLD 1-' + currentLevel, CANVAS_W/2, CANVAS_H/2 - 30);
  ctx.font = '16px monospace';
  ctx.fillText('\u2665 \u00D7 ' + lives, CANVAS_W/2, CANVAS_H/2 + 20);
}

function drawPausedOverlay(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', CANVAS_W/2, CANVAS_H/2);
}

function drawGameOver(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', CANVAS_W/2, CANVAS_H/2);
}

function drawWinScreen(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL CLEAR!', CANVAS_W/2, CANVAS_H/2 - 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + score, CANVAS_W/2, CANVAS_H/2 + 20);
}

// ---- Main render ----

function render(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (gameState === STATE.TITLE) {
    drawTitleScreen(ctx);
    return;
  }
  if (gameState === STATE.INTRO) {
    drawIntroScreen(ctx);
    return;
  }
  if (gameState === STATE.GAMEOVER) {
    drawGameOver(ctx);
    return;
  }

  drawSky(ctx);

  // Draw visible tiles
  const startCol = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const endCol   = Math.min(LEVEL_COLS - 1, Math.floor((cameraX + LOGICAL_W) / TILE) + 2);
  for (let r = 0; r < LEVEL_ROWS; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tile = grid[r][c];
      if (tile !== '.') drawTile(ctx, tile, c, r);
    }
  }

  // Items
  for (const item of items) {
    if (item.x + 16 < cameraX || item.x > cameraX + LOGICAL_W) continue;
    if (item.type === 'mushroom')   drawMushroom(ctx, item);
    else if (item.type === 'fireflower') drawFireFlower(ctx, item);
    else if (item.type === 'star')  drawStar(ctx, item);
    else if (item.type === 'coinpopup') drawCoinPopup(ctx, item);
  }

  // Fireballs
  for (const fb of fireballs) {
    if (fb.active) drawFireball(ctx, fb);
  }

  // Enemies
  for (const enemy of enemies) {
    if (!enemy.active || enemy.state === 'dead') continue;
    if (enemy.x + enemy.w < cameraX || enemy.x > cameraX + LOGICAL_W) continue;
    if (enemy.type === 'goomba')     drawGoomba(ctx, enemy);
    else if (enemy.type === 'koopa') drawKoopa(ctx, enemy);
  }

  drawPiranha(ctx);
  drawMario(ctx);
  drawHUD(ctx);

  if (gameState === STATE.PAUSED) drawPausedOverlay(ctx);
  if (gameState === STATE.WIN)    drawWinScreen(ctx);
}
