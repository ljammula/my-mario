/**
 * Minimal Phaser stub for unit tests.
 * Only exports what production code actually imports/uses.
 */

export class Scene {
  cameras = {
    main: {
      setScroll: (_x: number, _y: number): void => { /* noop */ },
    },
  };
}

export const GameObjects = {
  Graphics: class {},
  Group: class {},
  Image: class {},
  Sprite: class {},
  Text: class {},
};

export const Input = {
  Keyboard: {
    KeyCodes: {},
  },
};

export const Physics = {
  Arcade: {
    Sprite: class {},
    Group: class {},
  },
};

export default {
  Scene,
  GameObjects,
  Input,
  Physics,
};
