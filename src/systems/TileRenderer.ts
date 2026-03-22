/**
 * TileRenderer.ts
 * SE2 — Viewport-culled tile rendering using pooled Phaser Image objects.
 *
 * Contract:
 * - buildFromGrid() creates a pool of Image objects, one per visible slot.
 * - update(cameraX) repositions only columns within [cameraX-32, cameraX+256+32].
 * - setTile() mutates the grid (for brick breaks, Q→used) and refreshes visible images.
 * - Zero object creation / destruction during PLAYING state.
 */

import * as SpriteRegistry from './SpriteRegistry';
import { TILE_SIZE, LEVEL_COLS, LEVEL_ROWS } from '../config/constants';

type TileGrid = string[][];

// Tile ID → sprite key mapping
const TILE_SPRITE: Record<string, string> = {
  'G':  'tile_ground_top',   // top row of ground segment → rendered by context
  'B':  'tile_brick',
  'Q':  'tile_question_1',
  'U':  'tile_used',
  'H':  'tile_hard',
  'PT': 'tile_pipe_top_left',
  'PR': 'tile_pipe_top_right',
  'PL': 'tile_pipe_body_left',
  'PB': 'tile_pipe_body_right',
  'FP': 'tile_flagpole',
  'FF': 'tile_flag',
  'CA': 'tile_castle_wall',
  'CD': 'tile_castle_door',
};

// How many tile columns fit in the viewport + 2-tile margin each side
const VIEWPORT_COLS = Math.ceil(256 / TILE_SIZE) + 4; // ~20

interface TileSlot {
  image:   Phaser.GameObjects.Image;
  col:     number;
  row:     number;
  visible: boolean;
}

export class TileRenderer {
  private scene:    Phaser.Scene;
  private registry: typeof SpriteRegistry;
  private grid:     TileGrid = [];
  private pool:     TileSlot[] = [];

  // Map from "col,row" → pool slot index (only for currently displayed tiles)
  private slotMap: Map<string, TileSlot> = new Map();

  constructor(scene: Phaser.Scene, registry: typeof SpriteRegistry) {
    this.scene    = scene;
    this.registry = registry;
  }

  // ── Build ────────────────────────────────────────────────────────────────

  /**
   * Create the image pool. Call once after level data is loaded.
   * Pool size = VIEWPORT_COLS * LEVEL_ROWS so every visible cell can be shown.
   */
  buildFromGrid(grid: TileGrid): void {
    this.grid = grid;

    // Destroy any existing pool (e.g. on level reload)
    for (const slot of this.pool) {
      slot.image.destroy();
    }
    this.pool    = [];
    this.slotMap = new Map();

    const poolSize = VIEWPORT_COLS * LEVEL_ROWS;
    for (let i = 0; i < poolSize; i++) {
      // Use a placeholder texture; will be set in update()
      const img = this.scene.add.image(0, 0, 'tile_sky');
      img.setOrigin(0, 0);
      img.setVisible(false);
      img.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.pool.push({ image: img, col: -1, row: -1, visible: false });
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────

  /**
   * Reposition and texture pooled images to match the visible column range.
   * Called every frame. Never creates or destroys objects.
   */
  update(cameraX: number): void {
    if (!this.grid.length) return;

    const firstCol = Math.max(0, Math.floor((cameraX - 32) / TILE_SIZE));
    const lastCol  = Math.min(LEVEL_COLS - 1, Math.ceil((cameraX + 256 + 32) / TILE_SIZE));

    // Collect visible (col, row) pairs with non-empty tiles
    const visible: { col: number; row: number; id: string }[] = [];
    for (let col = firstCol; col <= lastCol; col++) {
      for (let row = 0; row < LEVEL_ROWS; row++) {
        const id = this.grid[row]?.[col];
        if (id && id !== '.') {
          visible.push({ col, row, id });
        }
      }
    }

    // Hide all pool slots first
    for (const slot of this.pool) {
      slot.image.setVisible(false);
      slot.visible = false;
    }
    this.slotMap.clear();

    // Assign visible tiles to pool slots
    let poolIdx = 0;
    for (const { col, row, id } of visible) {
      if (poolIdx >= this.pool.length) break; // pool exhausted (shouldn't happen with correct pool size)

      const slot     = this.pool[poolIdx++];
      const spriteKey = this._spriteKey(id, col, row);
      if (!spriteKey) continue;

      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      slot.image.setTexture(spriteKey);
      slot.image.setPosition(x, y);
      slot.image.setVisible(true);
      slot.col     = col;
      slot.row     = row;
      slot.visible = true;

      this.slotMap.set(`${col},${row}`, slot);
    }
  }

  // ── Tile mutation ────────────────────────────────────────────────────────

  /**
   * Update grid at (col, row) to a new tile ID.
   * Used for brick breaks (→ '.') and Q→used block transitions.
   * If the tile is currently visible, refreshes its image immediately.
   */
  setTile(col: number, row: number, id: string): void {
    if (row < 0 || row >= LEVEL_ROWS || col < 0 || col >= LEVEL_COLS) return;
    this.grid[row][col] = id;

    const key  = `${col},${row}`;
    const slot = this.slotMap.get(key);
    if (!slot) return; // not currently visible — will be set correctly on next update()

    if (id === '.') {
      slot.image.setVisible(false);
      slot.visible = false;
      this.slotMap.delete(key);
    } else {
      const spriteKey = this._spriteKey(id, col, row);
      if (spriteKey) {
        slot.image.setTexture(spriteKey);
      }
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /**
   * Map tile ID + position to a sprite registry key.
   * Ground tiles use tile_ground_top for the top visible row and tile_ground_fill below.
   */
  private _spriteKey(id: string, col: number, row: number): string | null {
    if (id === '.') return null;

    if (id === 'G') {
      // Top row of ground segment — check if row above is empty/sky
      const above = this.grid[row - 1]?.[col];
      if (!above || above === '.') {
        return 'tile_ground_top';
      }
      return 'tile_ground_fill';
    }

    const key = TILE_SPRITE[id];
    if (!key) return null;

    // Q block animation: alternate between question_1 / question_2 based on scene time
    if (id === 'Q') {
      const frame = Math.floor(this.scene.time.now / 200) % 2;
      return frame === 0 ? 'tile_question_1' : 'tile_question_2';
    }

    // Check sprite exists (graceful fallback)
    if (!this.registry.hasTexture(key)) return null;

    return key;
  }
}
