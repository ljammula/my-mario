// ============================================================
// HUD — score, coins, world, timer, and lives
// ============================================================

function drawHUD(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillText('MARIO', 24, 10);
  ctx.fillText(String(score).padStart(6, '0'), 24, 28);

  // Keep the coin counter in the upper-left HUD cluster.
  ctx.fillText('\u00D7' + String(coins).padStart(2, '0'), 102, 10);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(96, 17, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';

  ctx.fillText('\u2665\u00D7' + lives, 152, 10);

  ctx.fillText('WORLD', 296, 10);
  ctx.fillText('1-' + currentLevel, 316, 28);

  ctx.fillText('TIME', 400, 10);
  ctx.fillText(String(Math.max(0, Math.ceil(gameTimer / 60))).padStart(3, '0'), 420, 28);
}
