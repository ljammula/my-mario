// renderer.js — All canvas drawing for Super Mario Bros

import { TILE_SIZE, LEVEL_COLS, LEVEL_ROWS, getTile, TILES } from './level.js';

// NES color palette constants
const COLOR = {
  SKY:          '#5C94FC',
  GROUND_TOP:   '#C84B0F',
  GROUND_FILL:  '#8B4513',
  BRICK:        '#C84B0F',
  BRICK_SHADOW: '#7B2D00',
  QUESTION:     '#FAB005',
  QUESTION_ALT: '#FFFFFF',
  QUESTION_FACE:'#8B4513',
  HARD:         '#9B9B9B',
  HARD_DARK:    '#6B6B6B',
  PIPE_LIGHT:   '#00A000',
  PIPE_DARK:    '#006000',
  PIPE_CAP:     '#00C000',
  FLAGPOLE:     '#C0C0C0',
  FLAG:         '#FF0000',
  CASTLE:       '#9B9B9B',
  CASTLE_DARK:  '#6B6B6B',
  CASTLE_WIN:   '#C0C0C0',
  WHITE:        '#FFFFFF',
  BLACK:        '#000000',
  RED:          '#FF0000',
  YELLOW:       '#FFFF00',
  COIN:         '#FAB005',
  MUSHROOM_RED: '#FF3030',
  MUSHROOM_GRN: '#00BB00',
  FLOWER_RED:   '#FF4040',
  FLOWER_YELL:  '#FFFF00',
  STAR_YELLOW:  '#FAD000',
  GOOMBA_BROWN: '#8B4000',
  GOOMBA_DARK:  '#5A2D00',
  KOOPA_GREEN:  '#00A000',
  KOOPA_DARK:   '#006000',
  KOOPA_SKIN:   '#FAB005',
  PIRANHA:      '#00CC00',
  PIRANHA_DARK: '#008000',
  FIREBALL:     '#FF6600',
  MARIO_RED:    '#FF0000',
  MARIO_SKIN:   '#FAB005',
  MARIO_BLUE:   '#0000CC',
  MARIO_BROWN:  '#8B4513',
  HUD_BG:       '#000000',
};

// ── Draw helpers ──────────────────────────────────────────────────────────────

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function pixel(ctx, x, y, size, color) {
  rect(ctx, x, y, size, size, color);
}

// ── Tile drawing ──────────────────────────────────────────────────────────────

// questionFlash: frame counter for animating question blocks
let globalFrame = 0;

export function setGlobalFrame(frame) {
  globalFrame = frame;
}

export function drawTile(ctx, tileId, x, y, scale) {
  const s = scale;
  const ts = TILE_SIZE * s;
  const px = x;
  const py = y;

  switch (tileId) {
    case 'G': // Ground
      drawGroundTile(ctx, px, py, ts);
      break;

    case 'B': // Brick
      drawBrickTile(ctx, px, py, ts);
      break;

    case 'Q': // Question block
      drawQuestionTile(ctx, px, py, ts, false);
      break;

    case 'U': // Used/depleted question block
      drawUsedBlockTile(ctx, px, py, ts);
      break;

    case 'H': // Hard block
      drawHardTile(ctx, px, py, ts);
      break;

    case 'I': // Invisible block — not drawn
      break;

    case 'PT': // Pipe top-left
      drawPipeTopLeft(ctx, px, py, ts);
      break;

    case 'PR': // Pipe top-right
      drawPipeTopRight(ctx, px, py, ts);
      break;

    case 'PL': // Pipe body-left
      drawPipeBodyLeft(ctx, px, py, ts);
      break;

    case 'PB': // Pipe body-right
      drawPipeBodyRight(ctx, px, py, ts);
      break;

    case 'FP': // Flagpole segment
      drawFlagpole(ctx, px, py, ts);
      break;

    case 'FF': // Flag
      drawFlag(ctx, px, py, ts);
      break;

    case 'CA': // Castle wall
      drawCastleWall(ctx, px, py, ts);
      break;

    case 'CD': // Castle door
      drawCastleDoor(ctx, px, py, ts);
      break;
  }
}

function drawGroundTile(ctx, x, y, ts) {
  // Dark brown fill
  rect(ctx, x, y, ts, ts, COLOR.GROUND_FILL);
  // Light orange-brown top row
  rect(ctx, x, y, ts, ts * 0.15, COLOR.GROUND_TOP);
  // Grid lines for texture
  ctx.strokeStyle = COLOR.GROUND_TOP;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.4;
  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(x, y + ts * 0.5);
  ctx.lineTo(x + ts, y + ts * 0.5);
  ctx.stroke();
  // Vertical lines
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.5, y + ts * 0.15);
  ctx.lineTo(x + ts * 0.5, y + ts);
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

function drawBrickTile(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.BRICK);
  // Mortar lines
  const mColor = COLOR.BRICK_SHADOW;
  rect(ctx, x, y, ts, 1, mColor);              // top
  rect(ctx, x, y + ts * 0.5, ts, 1, mColor);  // middle h
  rect(ctx, x, y + ts - 1, ts, 1, mColor);    // bottom
  // Vertical mortar lines (offset on each row)
  rect(ctx, x + ts * 0.5, y, 1, ts * 0.5, mColor);      // top half center
  rect(ctx, x, y + ts * 0.5, 1, ts * 0.5, mColor);       // bottom half left
  rect(ctx, x + ts - 1, y + ts * 0.5, 1, ts * 0.5, mColor); // bottom half right
}

function drawQuestionTile(ctx, x, y, ts, used) {
  // Flash between yellow and white at ~8fps (every 7-8 frames)
  const flash = Math.floor(globalFrame / 8) % 2 === 0;
  const bg = flash ? COLOR.QUESTION : '#FFD050';
  rect(ctx, x, y, ts, ts, bg);
  // Border
  rect(ctx, x, y, ts, 2, '#FFFFFF');
  rect(ctx, x, y, 2, ts, '#FFFFFF');
  rect(ctx, x, y + ts - 2, ts, 2, COLOR.BRICK_SHADOW);
  rect(ctx, x + ts - 2, y, 2, ts, COLOR.BRICK_SHADOW);
  // Draw "?" in center
  ctx.fillStyle = COLOR.BRICK_SHADOW;
  ctx.font = `bold ${ts * 0.55}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x + ts / 2, y + ts / 2 + 1);
}

function drawUsedBlockTile(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.HARD);
  rect(ctx, x, y, ts, 2, COLOR.HARD_DARK);
  rect(ctx, x, y, 2, ts, COLOR.HARD_DARK);
  rect(ctx, x, y + ts - 2, ts, 2, '#D0D0D0');
  rect(ctx, x + ts - 2, y, 2, ts, '#D0D0D0');
}

function drawHardTile(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.HARD);
  rect(ctx, x, y, ts, 2, '#C8C8C8');
  rect(ctx, x, y, 2, ts, '#C8C8C8');
  rect(ctx, x, y + ts - 2, ts, 2, COLOR.HARD_DARK);
  rect(ctx, x + ts - 2, y, 2, ts, COLOR.HARD_DARK);
  // Grid texture
  ctx.globalAlpha = 0.3;
  rect(ctx, x, y + ts * 0.5, ts, 1, COLOR.HARD_DARK);
  rect(ctx, x + ts * 0.5, y, 1, ts, COLOR.HARD_DARK);
  ctx.globalAlpha = 1.0;
}

function drawPipeTopLeft(ctx, x, y, ts) {
  // Pipe cap (slightly wider left)
  rect(ctx, x - 2, y, ts + 2, ts, COLOR.PIPE_CAP);
  rect(ctx, x - 2, y, ts + 2, ts * 0.4, COLOR.PIPE_LIGHT);
  rect(ctx, x - 2, y, 2, ts, COLOR.PIPE_DARK); // left edge
}

function drawPipeTopRight(ctx, x, y, ts) {
  rect(ctx, x, y, ts + 2, ts, COLOR.PIPE_CAP);
  rect(ctx, x, y, ts + 2, ts * 0.4, COLOR.PIPE_LIGHT);
  rect(ctx, x + ts, y, 2, ts, COLOR.PIPE_DARK); // right edge
}

function drawPipeBodyLeft(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.PIPE_DARK);
  rect(ctx, x, y, ts * 0.7, ts, COLOR.PIPE_LIGHT);
  rect(ctx, x, y, ts * 0.15, ts, COLOR.PIPE_CAP); // highlight strip
}

function drawPipeBodyRight(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.PIPE_DARK);
  rect(ctx, x + ts * 0.3, y, ts * 0.7, ts, COLOR.PIPE_DARK);
  rect(ctx, x + ts - ts * 0.15, y, ts * 0.15, ts, '#004000'); // shadow
}

function drawFlagpole(ctx, x, y, ts) {
  // Draw the pole as a thin vertical line centered in the tile
  const poleX = x + ts / 2 - 1;
  rect(ctx, poleX, y, 2, ts, COLOR.FLAGPOLE);
}

function drawFlag(ctx, x, y, ts) {
  // Pole
  const poleX = x + ts / 2 - 1;
  rect(ctx, poleX, y, 2, ts, COLOR.FLAGPOLE);
  // Flag (triangle on the left side of the pole)
  ctx.fillStyle = COLOR.FLAG;
  ctx.beginPath();
  ctx.moveTo(poleX, y + 2);
  ctx.lineTo(poleX - ts * 0.6, y + ts * 0.35);
  ctx.lineTo(poleX, y + ts * 0.65);
  ctx.closePath();
  ctx.fill();
}

function drawCastleWall(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, COLOR.CASTLE);
  // Brick pattern
  ctx.globalAlpha = 0.35;
  rect(ctx, x, y, ts, 1, COLOR.CASTLE_DARK);
  rect(ctx, x, y + ts * 0.5, ts, 1, COLOR.CASTLE_DARK);
  rect(ctx, x + ts * 0.5, y, 1, ts * 0.5, COLOR.CASTLE_DARK);
  rect(ctx, x, y + ts * 0.5, 1, ts * 0.5, COLOR.CASTLE_DARK);
  ctx.globalAlpha = 1.0;
}

function drawCastleDoor(ctx, x, y, ts) {
  rect(ctx, x, y, ts, ts, '#000000');
  // Door frame
  ctx.strokeStyle = COLOR.CASTLE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 1);
}

// ── Background ────────────────────────────────────────────────────────────────

export function drawBackground(ctx, cameraX, scale, canvasW, canvasH) {
  const s = scale;

  // Sky
  rect(ctx, 0, 0, canvasW, canvasH, COLOR.SKY);

  // Hills (far background, subtle)
  ctx.fillStyle = '#6CA800';
  // Hill 1 (large, starting around x=100 in world)
  drawHill(ctx, (100 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);
  drawHill(ctx, (180 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 50 * s, 30 * s);
  drawHill(ctx, (500 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);
  drawHill(ctx, (600 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 50 * s, 30 * s);
  drawHill(ctx, (900 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);
  drawHill(ctx, (1100 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);
  drawHill(ctx, (1400 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);
  drawHill(ctx, (1600 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, 80 * s, 40 * s);

  // Bushes
  ctx.fillStyle = '#00A000';
  drawBush(ctx, (50 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (200 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (420 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (680 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (850 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (1050 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (1300 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);
  drawBush(ctx, (1550 * s) - cameraX * s, canvasH - 3 * TILE_SIZE * s, s);

  // Clouds
  ctx.fillStyle = '#FFFFFF';
  drawCloud(ctx, (30 * s) - cameraX * s,  3 * TILE_SIZE * s, s);
  drawCloud(ctx, (120 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (250 * s) - cameraX * s, 4 * TILE_SIZE * s, s);
  drawCloud(ctx, (380 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (510 * s) - cameraX * s, 3 * TILE_SIZE * s, s);
  drawCloud(ctx, (640 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (770 * s) - cameraX * s, 3 * TILE_SIZE * s, s);
  drawCloud(ctx, (900 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (1030 * s) - cameraX * s, 3 * TILE_SIZE * s, s);
  drawCloud(ctx, (1160 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (1290 * s) - cameraX * s, 4 * TILE_SIZE * s, s);
  drawCloud(ctx, (1420 * s) - cameraX * s, 2 * TILE_SIZE * s, s);
  drawCloud(ctx, (1550 * s) - cameraX * s, 3 * TILE_SIZE * s, s);
}

function drawHill(ctx, cx, baseY, w, h) {
  ctx.beginPath();
  ctx.ellipse(cx, baseY, w / 2, h / 2, 0, Math.PI, 0);
  ctx.fill();
}

function drawBush(ctx, x, baseY, s) {
  const bw = 40 * s;
  const bh = 16 * s;
  ctx.beginPath();
  ctx.ellipse(x, baseY - bh * 0.5, bw * 0.5, bh * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - bw * 0.3, baseY - bh * 0.3, bw * 0.3, bh * 0.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + bw * 0.3, baseY - bh * 0.3, bw * 0.3, bh * 0.4, 0, Math.PI, 0);
  ctx.fill();
}

function drawCloud(ctx, x, y, s) {
  const cw = 48 * s;
  const ch = 20 * s;
  ctx.beginPath();
  ctx.ellipse(x, y, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - cw * 0.3, y + ch * 0.2, cw * 0.35, ch * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + cw * 0.3, y + ch * 0.2, cw * 0.35, ch * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── HUD ───────────────────────────────────────────────────────────────────────

export function drawHUD(ctx, gameState, scale, canvasW) {
  const s = scale;
  const hudH = 24 * s;

  // HUD background bar
  rect(ctx, 0, 0, canvasW, hudH, COLOR.HUD_BG);

  ctx.fillStyle = COLOR.WHITE;
  ctx.font = `bold ${7 * s}px monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // Shadow helper
  function hudText(text, x, y) {
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = COLOR.WHITE;
    ctx.fillText(text, x, y);
  }

  const y1 = 2 * s; // top label row
  const y2 = 12 * s; // value row

  // MARIO label + score
  hudText('MARIO', 4 * s, y1);
  const score = String(gameState.score || 0).padStart(6, '0');
  hudText(score, 4 * s, y2);

  // Coin icon + count
  ctx.fillStyle = COLOR.COIN;
  ctx.beginPath();
  ctx.arc(60 * s, y1 + 4 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.WHITE;
  hudText('\u00d7' + String(gameState.coins || 0).padStart(2, '0'), 65 * s, y1);

  // WORLD label + value
  hudText('WORLD', 96 * s, y1);
  hudText(gameState.world || '1-1', 102 * s, y2);

  // TIME label + value
  hudText('TIME', 130 * s, y1);
  const timeVal = Math.ceil(gameState.time || 0);
  hudText(String(timeVal).padStart(3, '0'), 130 * s, y2);
}

// ── Enemy drawing ─────────────────────────────────────────────────────────────

export function drawEnemy(ctx, enemy, cameraX, scale) {
  const s = scale;
  const ex = (enemy.x - cameraX) * s;
  const ey = enemy.y * s;
  const ew = enemy.width * s;
  const eh = enemy.height * s;

  if (enemy.dead) return;

  const type = enemy.constructor.name;

  if (type === 'Goomba') {
    drawGoomba(ctx, enemy, ex, ey, ew, eh, s);
  } else if (type === 'KoopaTroopa') {
    drawKoopa(ctx, enemy, ex, ey, ew, eh, s);
  } else if (type === 'PiranhaPlant') {
    drawPiranhaPlant(ctx, enemy, cameraX, s);
  } else if (type === 'Shell') {
    drawShell(ctx, enemy, ex, ey, ew, eh, s);
  }
}

function drawGoomba(ctx, enemy, ex, ey, ew, eh, s) {
  if (enemy.state === 'stomped') {
    // Flat squished goomba
    rect(ctx, ex, ey + eh * 0.6, ew, eh * 0.4, COLOR.GOOMBA_BROWN);
    // Eyes still visible
    rect(ctx, ex + ew * 0.1, ey + eh * 0.6, ew * 0.2, ew * 0.2 * 0.4, '#FFFFFF');
    rect(ctx, ex + ew * 0.7, ey + eh * 0.6, ew * 0.2, ew * 0.2 * 0.4, '#FFFFFF');
    return;
  }

  const flipped = enemy.state === 'flipped';

  ctx.save();
  if (flipped) {
    // Flip vertically around enemy center
    ctx.translate(ex + ew / 2, ey + eh / 2);
    ctx.scale(1, -1);
    ctx.translate(-(ex + ew / 2), -(ey + eh / 2));
  }

  // Body
  rect(ctx, ex, ey + eh * 0.3, ew, eh * 0.7, COLOR.GOOMBA_BROWN);
  // Head
  rect(ctx, ex + ew * 0.1, ey, ew * 0.8, eh * 0.5, COLOR.GOOMBA_BROWN);
  // Eyebrows (dark angled lines)
  ctx.fillStyle = COLOR.GOOMBA_DARK;
  rect(ctx, ex + ew * 0.1, ey + eh * 0.1, ew * 0.3, 2, COLOR.GOOMBA_DARK);
  rect(ctx, ex + ew * 0.6, ey + eh * 0.1, ew * 0.3, 2, COLOR.GOOMBA_DARK);
  // Eyes
  rect(ctx, ex + ew * 0.15, ey + eh * 0.2, ew * 0.2, ew * 0.2, '#FFFFFF');
  rect(ctx, ex + ew * 0.65, ey + eh * 0.2, ew * 0.2, ew * 0.2, '#FFFFFF');
  // Pupils
  rect(ctx, ex + ew * 0.2, ey + eh * 0.25, ew * 0.1, ew * 0.1, '#000000');
  rect(ctx, ex + ew * 0.7, ey + eh * 0.25, ew * 0.1, ew * 0.1, '#000000');
  // Feet (alternating walk frames)
  const walkAnim = enemy.animFrame % 2;
  const footW = ew * 0.35;
  const footH = eh * 0.2;
  if (walkAnim === 0) {
    rect(ctx, ex, ey + eh - footH, footW, footH, COLOR.GOOMBA_DARK);
    rect(ctx, ex + ew - footW, ey + eh - footH * 0.7, footW, footH * 0.7, COLOR.GOOMBA_DARK);
  } else {
    rect(ctx, ex + ew - footW, ey + eh - footH, footW, footH, COLOR.GOOMBA_DARK);
    rect(ctx, ex, ey + eh - footH * 0.7, footW, footH * 0.7, COLOR.GOOMBA_DARK);
  }

  ctx.restore();
}

function drawKoopa(ctx, enemy, ex, ey, ew, eh, s) {
  const state = enemy.state;

  if (state === 'shell' || state === 'sliding') {
    // Shell sprite (1x1 tile)
    drawShellSprite(ctx, ex, ey, ew, eh, enemy.animFrame, state === 'sliding');
    return;
  }

  const flipped = enemy.flipped;
  ctx.save();
  if (flipped) {
    ctx.translate(ex + ew / 2, ey + eh / 2);
    ctx.scale(1, -1);
    ctx.translate(-(ex + ew / 2), -(ey + eh / 2));
  }

  // Shell (body)
  rect(ctx, ex + ew * 0.1, ey + eh * 0.35, ew * 0.8, eh * 0.5, COLOR.KOOPA_GREEN);
  // Shell highlight
  rect(ctx, ex + ew * 0.15, ey + eh * 0.37, ew * 0.3, eh * 0.12, '#00CC00');
  // Head
  rect(ctx, ex + ew * 0.1, ey, ew * 0.7, eh * 0.4, COLOR.KOOPA_SKIN);
  // Eye
  rect(ctx, ex + ew * 0.55, ey + eh * 0.08, ew * 0.2, ew * 0.2, '#FFFFFF');
  rect(ctx, ex + ew * 0.6, ey + eh * 0.1, ew * 0.1, ew * 0.1, '#000000');
  // Feet
  const fW = ew * 0.3;
  const fH = eh * 0.15;
  const walkAnim = enemy.animFrame % 2;
  if (walkAnim === 0) {
    rect(ctx, ex, ey + eh - fH, fW, fH, COLOR.KOOPA_SKIN);
    rect(ctx, ex + ew - fW, ey + eh - fH * 0.7, fW, fH * 0.7, COLOR.KOOPA_SKIN);
  } else {
    rect(ctx, ex + ew - fW, ey + eh - fH, fW, fH, COLOR.KOOPA_SKIN);
    rect(ctx, ex, ey + eh - fH * 0.7, fW, fH * 0.7, COLOR.KOOPA_SKIN);
  }

  ctx.restore();
}

function drawShellSprite(ctx, ex, ey, ew, eh, frame, sliding) {
  rect(ctx, ex, ey, ew, eh, COLOR.KOOPA_GREEN);
  rect(ctx, ex + ew * 0.1, ey + eh * 0.1, ew * 0.8, eh * 0.8, '#00CC00');
  // Shell pattern lines
  ctx.strokeStyle = COLOR.KOOPA_DARK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex + ew * 0.5, ey + eh * 0.1);
  ctx.lineTo(ex + ew * 0.5, ey + eh * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex + ew * 0.1, ey + eh * 0.5);
  ctx.lineTo(ex + ew * 0.9, ey + eh * 0.5);
  ctx.stroke();
  if (sliding) {
    // Motion lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(ex - (i + 1) * 4, ey + (eh / 4) * (i + 1));
      ctx.lineTo(ex, ey + (eh / 4) * (i + 1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }
}

function drawPiranhaPlant(ctx, enemy, cameraX, s) {
  if (enemy.dead) return;
  const ex = (enemy.x - cameraX) * s;
  const ey = enemy.y * s;
  const ew = enemy.width * s;
  const eh = enemy.height * s;

  // Stem
  const stemW = ew * 0.3;
  rect(ctx, ex + ew * 0.35, ey + eh * 0.5, stemW, eh * 0.5, COLOR.PIPE_LIGHT);
  // Head
  rect(ctx, ex, ey, ew, eh * 0.55, COLOR.PIRANHA);
  // Spots
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.5;
  rect(ctx, ex + ew * 0.15, ey + eh * 0.1, ew * 0.18, eh * 0.12, '#FFFFFF');
  rect(ctx, ex + ew * 0.65, ey + eh * 0.1, ew * 0.18, eh * 0.12, '#FFFFFF');
  ctx.globalAlpha = 1.0;
  // Mouth / teeth
  rect(ctx, ex + ew * 0.1, ey + eh * 0.32, ew * 0.8, eh * 0.2, '#FF0000');
  // Teeth (white rects)
  const tW = ew * 0.15;
  rect(ctx, ex + ew * 0.12, ey + eh * 0.32, tW, eh * 0.12, '#FFFFFF');
  rect(ctx, ex + ew * 0.32, ey + eh * 0.4, tW, eh * 0.12, '#FFFFFF');
  rect(ctx, ex + ew * 0.54, ey + eh * 0.32, tW, eh * 0.12, '#FFFFFF');
  rect(ctx, ex + ew * 0.74, ey + eh * 0.4, tW, eh * 0.12, '#FFFFFF');
}

function drawShell(ctx, enemy, ex, ey, ew, eh, s) {
  drawShellSprite(ctx, ex, ey, ew, eh, enemy.animFrame, true);
}

// ── Item drawing ──────────────────────────────────────────────────────────────

export function drawItem(ctx, item, cameraX, scale) {
  if (item.dead) return;
  const s = scale;
  const ix = (item.x - cameraX) * s;
  const iy = item.y * s;
  const iw = item.width * s;
  const ih = item.height * s;

  const type = item.type;

  if (type === 'coin') {
    drawCoinSprite(ctx, ix, iy, iw, ih, item.animFrame, s);
  } else if (type === 'mushroom') {
    drawMushroomSprite(ctx, ix, iy, iw, ih, s, false);
  } else if (type === 'oneup') {
    drawMushroomSprite(ctx, ix, iy, iw, ih, s, true);
  } else if (type === 'flower') {
    drawFlowerSprite(ctx, ix, iy, iw, ih, item.animFrame, s);
  } else if (type === 'star') {
    drawStarSprite(ctx, ix, iy, iw, ih, item.animFrame, s);
  } else if (type === 'fireball') {
    drawFireballSprite(ctx, item, ix, iy, iw, ih, s);
  }
}

function drawCoinSprite(ctx, x, y, w, h, frame, s) {
  // Coin spins: full circle → narrow → full
  const phases = [1.0, 0.6, 0.2, 0.6];
  const scaleX = phases[frame % 4];
  const cx = x + w / 2;
  const halfW = (w / 2) * scaleX;
  ctx.fillStyle = COLOR.COIN;
  ctx.beginPath();
  ctx.ellipse(cx, y + h / 2, halfW, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shine
  ctx.fillStyle = '#FFE060';
  ctx.beginPath();
  ctx.ellipse(cx - halfW * 0.2, y + h * 0.3, halfW * 0.25, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroomSprite(ctx, x, y, w, h, s, isOneUp) {
  const capColor = isOneUp ? COLOR.MUSHROOM_GRN : COLOR.MUSHROOM_RED;
  // Stem
  rect(ctx, x + w * 0.2, y + h * 0.5, w * 0.6, h * 0.5, '#FAB005');
  // Cap
  rect(ctx, x, y, w, h * 0.55, capColor);
  // Cap highlight
  ctx.fillStyle = isOneUp ? '#00FF00' : '#FF8080';
  ctx.globalAlpha = 0.5;
  rect(ctx, x + w * 0.15, y + h * 0.05, w * 0.25, h * 0.2, isOneUp ? '#88FF88' : '#FFAAAA');
  ctx.globalAlpha = 1.0;
  // Spots
  ctx.fillStyle = '#FFFFFF';
  rect(ctx, x + w * 0.1, y + h * 0.15, w * 0.2, h * 0.15, '#FFFFFF');
  rect(ctx, x + w * 0.65, y + h * 0.1, w * 0.2, h * 0.15, '#FFFFFF');
  // Eyes on stem
  rect(ctx, x + w * 0.25, y + h * 0.58, w * 0.15, h * 0.12, '#000000');
  rect(ctx, x + w * 0.6, y + h * 0.58, w * 0.15, h * 0.12, '#000000');
}

function drawFlowerSprite(ctx, x, y, w, h, frame, s) {
  // Stem
  rect(ctx, x + w * 0.45, y + h * 0.55, w * 0.1, h * 0.45, '#00CC00');
  // Petals (4 petals in cross)
  const cx = x + w / 2;
  const cy = y + h * 0.35;
  const petalColor = frame % 2 === 0 ? COLOR.FLOWER_RED : COLOR.FLOWER_YELL;
  const pR = w * 0.25;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    ctx.fillStyle = petalColor;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(angle) * pR, cy + Math.sin(angle) * pR, pR * 0.7, pR * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.arc(cx, cy, pR * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarSprite(ctx, x, y, w, h, frame, s) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  const spinColors = ['#FAD000', '#FFFFFF', '#FAD000', '#FFD700'];
  ctx.fillStyle = spinColors[frame % 4];
  // 5-pointed star
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const aInner = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(aInner) * r * 0.45, cy + Math.sin(aInner) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  // Eyes
  rect(ctx, cx - r * 0.35, cy - r * 0.1, r * 0.2, r * 0.2, '#000000');
  rect(ctx, cx + r * 0.15, cy - r * 0.1, r * 0.2, r * 0.2, '#000000');
}

function drawFireballSprite(ctx, item, x, y, w, h, s) {
  if (item.exploding) {
    // Explosion burst
    const colors = ['#FFFF00', '#FF6600', '#FF0000'];
    const cr = (w * 0.8) * (1 + item.animFrame * 0.5);
    ctx.fillStyle = colors[item.animFrame % 3];
    ctx.globalAlpha = 1 - item.animFrame * 0.3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  } else {
    // Spinning fireball
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = w / 2;
    ctx.fillStyle = COLOR.FIREBALL;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // White hot center
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Mario drawing ─────────────────────────────────────────────────────────────

export function drawMario(ctx, mario, cameraX, scale) {
  if (!mario || mario.state === 'dead' && mario.deadOffScreen) return;

  const s = scale;
  const mx = (mario.x - cameraX) * s;
  const my = mario.y * s;
  const mw = mario.width * s;
  const mh = mario.height * s;

  const isSuper = (mario.marioState === 'super' || mario.marioState === 'fire');
  const isFire  = mario.marioState === 'fire';
  const isInvincible = mario.invincible && mario.invincibleTimer > 0;
  const isDead = mario.state === 'dead';
  const isFlicker = mario.invincible && Math.floor(globalFrame / 3) % 2 === 0;

  if (isFlicker && !isDead) return; // flicker effect

  ctx.save();

  // Rainbow tint for star invincibility
  if (isInvincible && !isDead) {
    const hue = (globalFrame * 6) % 360;
    ctx.filter = `hue-rotate(${hue}deg)`;
  }

  // Flip horizontally if facing left
  if (mario.facing === -1) {
    ctx.translate(mx + mw, my);
    ctx.scale(-1, 1);
    ctx.translate(-mx, -my);
  }

  if (isDead) {
    drawMarioDead(ctx, mx, my, mw, mh, s);
  } else if (isSuper) {
    drawMarioSuper(ctx, mario, mx, my, mw, mh, s, isFire);
  } else {
    drawMarioSmall(ctx, mario, mx, my, mw, mh, s);
  }

  ctx.filter = 'none';
  ctx.restore();
}

function marioBodyColors(isFire) {
  return {
    hat:    isFire ? '#FFFFFF' : COLOR.MARIO_RED,
    shirt:  isFire ? '#FFFFFF' : COLOR.MARIO_RED,
    pants:  isFire ? '#FF0000' : COLOR.MARIO_BLUE,
    skin:   COLOR.MARIO_SKIN,
    shoes:  COLOR.MARIO_BROWN,
    hair:   '#8B4513',
  };
}

function drawMarioSmall(ctx, mario, x, y, w, h, s) {
  const c = marioBodyColors(false);
  const anim = mario.animFrame || 0;

  // Hat
  rect(ctx, x + w * 0.1, y, w * 0.8, h * 0.2, c.hat);
  // Head/skin
  rect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.3, c.skin);
  // Eyes
  rect(ctx, x + w * 0.55, y + h * 0.25, w * 0.2, h * 0.1, '#000000');
  // Mustache
  rect(ctx, x + w * 0.3, y + h * 0.38, w * 0.6, h * 0.07, c.hair);
  // Body/overalls
  rect(ctx, x + w * 0.05, y + h * 0.5, w * 0.9, h * 0.35, c.shirt);
  // Legs
  const legOff = (anim % 2 === 0) ? 0 : h * 0.05;
  rect(ctx, x + w * 0.1, y + h * 0.82 + legOff, w * 0.35, h * 0.18, c.pants);
  rect(ctx, x + w * 0.55, y + h * 0.82 - legOff, w * 0.35, h * 0.18, c.pants);
  // Shoes
  rect(ctx, x, y + h * 0.88 + legOff, w * 0.45, h * 0.12, c.shoes);
  rect(ctx, x + w * 0.45, y + h * 0.88 - legOff, w * 0.55, h * 0.12, c.shoes);
}

function drawMarioSuper(ctx, mario, x, y, w, h, s, isFire) {
  const c = marioBodyColors(isFire);
  const anim = mario.animFrame || 0;

  // Hat (top 20% of height)
  rect(ctx, x + w * 0.1, y, w * 0.8, h * 0.1, c.hat);
  rect(ctx, x + w * 0.05, y + h * 0.08, w * 0.9, h * 0.06, c.hat);
  // Head
  rect(ctx, x + w * 0.1, y + h * 0.14, w * 0.8, h * 0.18, c.skin);
  // Eyes
  rect(ctx, x + w * 0.55, y + h * 0.17, w * 0.2, h * 0.06, '#000000');
  // Mustache
  rect(ctx, x + w * 0.3, y + h * 0.26, w * 0.6, h * 0.05, c.hair);
  // Body
  rect(ctx, x + w * 0.1, y + h * 0.32, w * 0.8, h * 0.35, c.shirt);
  // Overalls
  rect(ctx, x + w * 0.2, y + h * 0.35, w * 0.6, h * 0.28, c.pants);
  // Buttons
  rect(ctx, x + w * 0.25, y + h * 0.38, w * 0.1, h * 0.04, c.shirt);
  rect(ctx, x + w * 0.65, y + h * 0.38, w * 0.1, h * 0.04, c.shirt);
  // Arms
  rect(ctx, x, y + h * 0.33, w * 0.12, h * 0.25, c.skin);
  rect(ctx, x + w * 0.88, y + h * 0.33, w * 0.12, h * 0.25, c.skin);
  // Legs
  const legOff = (anim % 2 === 0) ? 0 : h * 0.03;
  rect(ctx, x + w * 0.1, y + h * 0.67 + legOff, w * 0.35, h * 0.2, c.pants);
  rect(ctx, x + w * 0.55, y + h * 0.67 - legOff, w * 0.35, h * 0.2, c.pants);
  // Shoes
  rect(ctx, x, y + h * 0.85 + legOff, w * 0.45, h * 0.1, c.shoes);
  rect(ctx, x + w * 0.45, y + h * 0.85 - legOff, w * 0.55, h * 0.1, c.shoes);
}

function drawMarioDead(ctx, x, y, w, h, s) {
  // Classic death pose: arms up, face forward
  rect(ctx, x + w * 0.1, y, w * 0.8, h * 0.2, COLOR.MARIO_RED);  // hat
  rect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.3, COLOR.MARIO_SKIN);  // head
  rect(ctx, x + w * 0.55, y + h * 0.25, w * 0.2, h * 0.1, '#000000');  // eye
  rect(ctx, x + w * 0.3, y + h * 0.38, w * 0.6, h * 0.07, '#8B4513');  // mustache
  rect(ctx, x + w * 0.05, y + h * 0.5, w * 0.9, h * 0.35, COLOR.MARIO_RED);  // body
  // Arms raised
  rect(ctx, x - w * 0.15, y + h * 0.4, w * 0.2, h * 0.25, COLOR.MARIO_SKIN);
  rect(ctx, x + w * 0.95, y + h * 0.4, w * 0.2, h * 0.25, COLOR.MARIO_SKIN);
  rect(ctx, x + w * 0.1, y + h * 0.82, w * 0.35, h * 0.18, COLOR.MARIO_BLUE);
  rect(ctx, x + w * 0.55, y + h * 0.82, w * 0.35, h * 0.18, COLOR.MARIO_BLUE);
  rect(ctx, x, y + h * 0.88, w * 0.45, h * 0.12, COLOR.MARIO_BROWN);
  rect(ctx, x + w * 0.45, y + h * 0.88, w * 0.55, h * 0.12, COLOR.MARIO_BROWN);
}

// ── Title Screen ──────────────────────────────────────────────────────────────

export function drawTitleScreen(ctx, scale, canvasW, canvasH, frame) {
  const s = scale;
  rect(ctx, 0, 0, canvasW, canvasH, '#000000');

  ctx.textAlign = 'center';

  // Title
  ctx.font = `bold ${14 * s}px monospace`;
  ctx.fillStyle = '#000000';
  ctx.fillText('SUPER MARIO BROS', canvasW / 2 + 2, canvasH * 0.3 + 2);
  ctx.fillStyle = '#FF0000';
  ctx.fillText('SUPER MARIO BROS', canvasW / 2, canvasH * 0.3);

  // Subtitle line
  ctx.font = `bold ${7 * s}px monospace`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('- 1985 INSPIRED WEB RECREATION -', canvasW / 2, canvasH * 0.42);

  // Blinking "PRESS ENTER"
  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${8 * s}px monospace`;
    ctx.fillText('PRESS ENTER TO START', canvasW / 2, canvasH * 0.62);
  }

  // Controls help
  ctx.font = `${6 * s}px monospace`;
  ctx.fillStyle = '#AAAAAA';
  ctx.fillText('ARROWS / WASD: MOVE    SPACE / Z: JUMP    X: RUN / FIRE', canvasW / 2, canvasH * 0.8);

  // Simple decorative Mario
  const mx = canvasW / 2 - 8 * s;
  const my = canvasH * 0.48;
  const mw = 16 * s;
  const mh = 16 * s;
  rect(ctx, mx + mw * 0.1, my, mw * 0.8, mh * 0.2, COLOR.MARIO_RED);
  rect(ctx, mx + mw * 0.1, my + mh * 0.2, mw * 0.8, mh * 0.3, COLOR.MARIO_SKIN);
  rect(ctx, mx + mw * 0.05, my + mh * 0.5, mw * 0.9, mh * 0.35, COLOR.MARIO_RED);
  rect(ctx, mx + mw * 0.1, my + mh * 0.82, mw * 0.35, mh * 0.18, COLOR.MARIO_BLUE);
  rect(ctx, mx + mw * 0.55, my + mh * 0.82, mw * 0.35, mh * 0.18, COLOR.MARIO_BLUE);
}

// ── Game Over Screen ──────────────────────────────────────────────────────────

export function drawGameOver(ctx, scale, canvasW, canvasH) {
  rect(ctx, 0, 0, canvasW, canvasH, '#000000');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${16 * scale}px monospace`;
  ctx.fillStyle = '#000000';
  ctx.fillText('GAME OVER', canvasW / 2 + 2, canvasH / 2 + 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('GAME OVER', canvasW / 2, canvasH / 2);
}

// ── Win Screen ────────────────────────────────────────────────────────────────

export function drawWinScreen(ctx, gameState, scale, canvasW, canvasH) {
  rect(ctx, 0, 0, canvasW, canvasH, COLOR.SKY);
  ctx.textAlign = 'center';

  ctx.font = `bold ${10 * scale}px monospace`;
  ctx.fillStyle = '#000000';
  ctx.fillText('LEVEL COMPLETE!', canvasW / 2 + 1, canvasH * 0.3 + 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('LEVEL COMPLETE!', canvasW / 2, canvasH * 0.3);

  ctx.font = `bold ${7 * scale}px monospace`;
  const timeBonus = Math.floor(gameState.time) * 50;
  ctx.fillStyle = '#FFFF00';
  ctx.fillText(`TIME BONUS: ${timeBonus} pts`, canvasW / 2, canvasH * 0.48);
  ctx.fillText(`TOTAL SCORE: ${gameState.score + timeBonus}`, canvasW / 2, canvasH * 0.58);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = `${6 * scale}px monospace`;
  ctx.fillText('WORLD 1-2 COMING SOON...', canvasW / 2, canvasH * 0.75);
}

// ── Pause Overlay ─────────────────────────────────────────────────────────────

export function drawPauseOverlay(ctx, scale, canvasW, canvasH) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${16 * scale}px monospace`;
  ctx.fillText('PAUSED', canvasW / 2, canvasH / 2);
}

// ── World Intro Screen ────────────────────────────────────────────────────────

export function drawWorldIntro(ctx, gameState, scale, canvasW, canvasH) {
  rect(ctx, 0, 0, canvasW, canvasH, '#000000');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${10 * scale}px monospace`;
  ctx.fillText(`WORLD ${gameState.world}`, canvasW / 2, canvasH * 0.4);
  ctx.font = `bold ${8 * scale}px monospace`;
  ctx.fillText(`\u00d7 ${gameState.lives}`, canvasW / 2, canvasH * 0.58);
  // Draw tiny mario icon next to lives
  const mx = canvasW / 2 - 20 * scale;
  const my = canvasH * 0.52;
  const ms = 10 * scale;
  rect(ctx, mx + ms * 0.1, my, ms * 0.8, ms * 0.2, COLOR.MARIO_RED);
  rect(ctx, mx + ms * 0.1, my + ms * 0.2, ms * 0.8, ms * 0.3, COLOR.MARIO_SKIN);
  rect(ctx, mx + ms * 0.05, my + ms * 0.5, ms * 0.9, ms * 0.5, COLOR.MARIO_RED);
}
