// ============================================================
// CAMERA UPDATE
// ============================================================

function updateCamera() {
  const levelWidth = LEVEL_COLS * TILE;
  const maxCamera = levelWidth - LOGICAL_W;
  const marioCenterX = mario.x + mario.w / 2;
  const desiredCameraX = marioCenterX - LOGICAL_W / 2 + mario.facing * CAMERA_LOOKAHEAD;
  const target = Math.max(0, Math.min(desiredCameraX, maxCamera));

  const delta = target - cameraX;
  const maxStep = CAMERA_MAX_STEP + Math.abs(mario.vx) * CAMERA_VX_GAIN;
  const step = Math.max(-maxStep, Math.min(maxStep, delta * CAMERA_SMOOTHING));

  cameraX += step;
  if (Math.abs(target - cameraX) <= CAMERA_SNAP_EPSILON) cameraX = target;
}

function snapCameraToMario(lookAhead = false) {
  const levelWidth = LEVEL_COLS * TILE;
  const maxCamera = levelWidth - LOGICAL_W;
  const marioCenterX = mario.x + mario.w / 2;
  const facingOffset = lookAhead ? mario.facing * CAMERA_LOOKAHEAD : 0;
  const desiredCameraX = marioCenterX - LOGICAL_W / 2 + facingOffset;
  cameraX = Math.max(0, Math.min(desiredCameraX, maxCamera));
}
