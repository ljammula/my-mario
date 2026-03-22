/**
 * types/input.ts
 * InputSnapshot interface — the canonical per-frame input state.
 */

export interface InputSnapshot {
  left:     boolean;   // move left (continuous)
  right:    boolean;   // move right (continuous)
  down:     boolean;   // crouch/duck (continuous)
  run:      boolean;   // X held → run speed (continuous)
  jumpHeld: boolean;   // Space/Z held → variable-height jump gravity (continuous)
  jump:     boolean;   // edge: jump pressed this frame (Space/Z)
  fire:     boolean;   // edge: X pressed this frame (for fireball)
  start:    boolean;   // edge: Enter pressed this frame (title/pause)
}
