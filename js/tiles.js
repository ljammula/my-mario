// ============================================================
// TILE HELPERS
// ============================================================

function getTile(col, row) {
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= LEVEL_ROWS) return '.';
  return grid[row][col];
}

function isSolid(col, row) {
  return SOLID_TILES.has(getTile(col, row));
}

function tileAt(worldX, worldY) {
  return { col: Math.floor(worldX / TILE), row: Math.floor(worldY / TILE) };
}
