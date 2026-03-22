/**
 * SpriteRegistry.ts
 * OWNED BY SE2 — this file is a stub placeholder for SE1 integration.
 *
 * SE2 implements this file. SE1 imports getTexture() to retrieve
 * pre-baked RenderTextures for sprites by key.
 *
 * Sprite key format examples:
 *   mario_small_walk1, mario_small_idle, mario_small_jump
 *   mario_super_idle, mario_fire_idle
 *   goomba_walk1, goomba_stomped
 *   koopa_walk1, koopa_shell, koopa_shell_slide
 *   tile_ground_top, tile_brick, tile_question, tile_pipe_tl
 *   item_mushroom, item_flower, item_star, item_coin
 */

let _scene: Phaser.Scene | null = null;

/**
 * Initialize the registry with the active Phaser scene.
 * SE2 calls this in PreloadScene.create() after baking all sprites.
 */
export function initRegistry(scene: Phaser.Scene): void {
  _scene = scene;
}

/**
 * Retrieve a baked RenderTexture by sprite key.
 * Returns the texture if it exists in Phaser's cache.
 * SE1 uses this to set textures on pooled Image game objects.
 *
 * @param key  Sprite key string e.g. 'mario_small_walk1'
 * @returns    Phaser.Textures.Texture from cache
 * @throws     Error if texture not found (indicates SE2 forgot to bake it)
 */
export function getTexture(key: string): Phaser.Textures.Texture {
  if (!_scene) {
    throw new Error(`SpriteRegistry: scene not initialized. Call initRegistry() first.`);
  }
  if (!_scene.textures.exists(key)) {
    throw new Error(`SpriteRegistry: texture '${key}' not found. SE2 must bake this sprite in PreloadScene.`);
  }
  return _scene.textures.get(key);
}

/**
 * Check whether a texture key has been registered (safe query without throwing).
 */
export function hasTexture(key: string): boolean {
  return _scene !== null && _scene.textures.exists(key);
}
