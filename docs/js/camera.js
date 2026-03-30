// ============================================================
// CAMERA UPDATE
// ============================================================

function updateCamera() {
  const levelWidth = LEVEL_COLS * TILE; // 224 * 16 = 3584
  const target     = mario.x - 128;
  if (target > cameraX) cameraX = target;
  if (cameraX < 0) cameraX = 0;
  const maxCamera = levelWidth - LOGICAL_W;
  if (cameraX > maxCamera) cameraX = maxCamera;
}
