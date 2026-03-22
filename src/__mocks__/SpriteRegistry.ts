/**
 * Minimal SpriteRegistry mock for unit tests.
 */
export const SpriteRegistry = {
  getTexture: (_key: string) => ({
    key: _key,
    width: 16,
    height: 16,
  }),
  registerAll: () => { /* noop */ },
};

export default SpriteRegistry;
