#!/usr/bin/env node

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function createContext() {
  const noop = () => {};
  const fakeCtx = {
    save: noop, restore: noop, scale: noop, translate: noop, beginPath: noop, closePath: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, moveTo: noop, lineTo: noop, arc: noop,
    fill: noop, stroke: noop, fillText: noop, strokeText: noop, drawImage: noop, setTransform: noop,
  };
  const canvas = { style: {}, addEventListener: noop, getContext: () => fakeCtx };
  const generic = { style: {}, classList: { add: noop, remove: noop }, addEventListener: noop };
  const document = {
    body: { style: {} },
    getElementById(id) {
      if (id === 'gameCanvas') return canvas;
      return generic;
    },
    elementFromPoint() { return null; },
  };

  const context = vm.createContext({
    console,
    Math,
    Date,
    setTimeout: noop,
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    performance: { now: () => 0 },
    window: {
      addEventListener: noop,
      matchMedia: () => ({ matches: false }),
      innerWidth: 1024,
      innerHeight: 768,
    },
    document,
    AudioSystem: {
      init: noop,
      playMusic: noop,
      stopMusic: noop,
      pauseMusic: noop,
      resumeMusic: noop,
      playSFX: noop,
    },
  });

  context.globalThis = context;
  context.window.window = context.window;
  context.window.document = document;
  return context;
}

function loadScripts(ctx, files) {
  for (const file of files) vm.runInContext(read(file), ctx, { filename: file });
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

const sourceRender = read('js/render.js');
const sourceLevel = read('js/level.js');
const sourceState = read('js/state.js');
const sourceGame = read('js/game.js');
const sourceEnemies = read('js/enemies.js');

assert(sourceLevel.includes('function buildLevel3Main()'), 'Expected buildLevel3Main() in js/level.js');
assert(sourceLevel.includes('function buildLevel3Hidden()'), 'Expected buildLevel3Hidden() in js/level.js');
assert(sourceState.includes('enterLevel3HiddenArea'), 'Expected hidden-area transition helpers in js/state.js');
assert(sourceGame.includes('currentLevel = (currentLevel % 3) + 1'), 'Expected 3-level rotation in js/game.js');
assert(sourceEnemies.includes('piranha.pipeX'), 'Expected dynamic piranha pipe targeting in js/enemies.js');

for (const label of ['CONTROLS', '\\u2190/\\u2192  MOVE', 'SPACE/Z  JUMP', 'ENTER  START/PAUSE']) {
  assert(sourceRender.includes(label), `Expected controls label "${label}" in js/render.js`);
}

for (const file of fs.readdirSync('js').filter(f => f.endsWith('.js')).sort()) {
  assert.strictEqual(
    read(`js/${file}`),
    read(`docs/js/${file}`),
    `Expected docs/js/${file} to stay in sync with js/${file}`
  );
}

const ctx = createContext();
loadScripts(ctx, ['js/constants.js', 'js/level.js', 'js/state.js', 'js/tiles.js', 'js/collision.js']);
run(ctx, 'let damageCalls = 0; function damageMario() { damageCalls++; }');
loadScripts(ctx, ['js/enemies.js']);

const levelShapes = run(
  ctx,
  `(() => {
    const main = buildLevel3Main();
    const hidden = buildLevel3Hidden();
    return {
      mainRows: main.length,
      hiddenRows: hidden.length,
      mainCols: main[0].length,
      hiddenCols: hidden[0].length,
      mainFlag: main[4][210],
      hiddenReturnPipe: hidden[11][196],
      hiddenEntryPipe: hidden[11][8]
    };
  })()`
);
assert.strictEqual(levelShapes.mainRows, 15, 'Expected Level 3 main area rows = 15');
assert.strictEqual(levelShapes.hiddenRows, 15, 'Expected Level 3 hidden area rows = 15');
assert.strictEqual(levelShapes.mainCols, 224, 'Expected Level 3 main area cols = 224');
assert.strictEqual(levelShapes.hiddenCols, 224, 'Expected Level 3 hidden area cols = 224');
assert.strictEqual(levelShapes.mainFlag, 'FF', 'Expected Level 3 main flag tile');
assert.strictEqual(levelShapes.hiddenReturnPipe, 'PT', 'Expected hidden area return pipe top');
assert.strictEqual(levelShapes.hiddenEntryPipe, 'PT', 'Expected hidden area entry pipe top');

const secretChecks = run(
  ctx,
  `(() => {
    const main = buildLevel3Main();
    const hidden = buildLevel3Hidden();
    const mainSecrets = Object.entries(Q_CONTENTS_L3_MAIN).every(([k]) => {
      const [c, r] = k.split(',').map(Number);
      return main[r][c] === 'Q';
    });
    const hiddenSecrets = Object.entries(Q_CONTENTS_L3_HIDDEN).every(([k]) => {
      const [c, r] = k.split(',').map(Number);
      return hidden[r][c] === 'Q';
    });
    const mainHasMushroom = Object.values(Q_CONTENTS_L3_MAIN).includes('mushroom');
    const mainHasStar = Object.values(Q_CONTENTS_L3_MAIN).includes('star');
    const hiddenHasStar = Object.values(Q_CONTENTS_L3_HIDDEN).includes('star');
    return { mainSecrets, hiddenSecrets, mainHasMushroom, mainHasStar, hiddenHasStar };
  })()`
);
assert(secretChecks.mainSecrets, 'Expected Level 3 main secret map to match Q-block tiles');
assert(secretChecks.hiddenSecrets, 'Expected Level 3 hidden secret map to match Q-block tiles');
assert(secretChecks.mainHasMushroom, 'Expected Level 3 main to include mushroom secret');
assert(secretChecks.mainHasStar, 'Expected Level 3 main to include star secret');
assert(secretChecks.hiddenHasStar, 'Expected Level 3 hidden area to include star secret');

const transitionChecks = run(
  ctx,
  `(() => {
    currentLevel = 3;
    resetLevel();
    const spawnOnSolid = isSolid(Math.floor((mario.x + mario.w / 2) / TILE), Math.floor((mario.y + mario.h) / TILE));
    const startArea = currentArea;
    const startPiranha = piranha ? piranha.pipeX : null;
    enterLevel3HiddenArea();
    const hiddenArea = currentArea;
    const hiddenPiranha = piranha;
    const hiddenMusic = getMusicTrack();
    exitLevel3HiddenArea();
    const returnCol = Math.floor((mario.x + mario.w / 2) / TILE);
    const returnFeetRow = Math.floor((mario.y + mario.h) / TILE);
    return {
      spawnOnSolid,
      startArea,
      hiddenArea,
      startPiranha,
      hiddenPiranha: hiddenPiranha === null,
      hiddenMusic,
      returnArea: currentArea,
      returnSpawnOnSolid: isSolid(returnCol, returnFeetRow),
      returnPiranha: piranha ? piranha.pipeX : null
    };
  })()`
);
assert(transitionChecks.spawnOnSolid, 'Expected Level 3 spawn not to softlock in air/pit');
assert.strictEqual(transitionChecks.startArea, 'main', 'Expected Level 3 reset to start in main area');
assert.strictEqual(transitionChecks.hiddenArea, 'hidden', 'Expected hidden-area transition to switch area');
assert.strictEqual(transitionChecks.startPiranha, 75 * 16 + 8, 'Expected main-area piranha at Level 3 pipe');
assert(transitionChecks.hiddenPiranha, 'Expected no piranha in hidden area');
assert.strictEqual(transitionChecks.hiddenMusic, 'underground', 'Expected hidden area to use underground track');
assert.strictEqual(transitionChecks.returnArea, 'main', 'Expected return pipe to switch back to main area');
assert(transitionChecks.returnSpawnOnSolid, 'Expected hidden-area return to place Mario on solid pipe top');
assert.strictEqual(transitionChecks.returnPiranha, 75 * 16 + 8, 'Expected piranha restored when returning to main area');

const piranhaChecks = run(
  ctx,
  `(() => {
    currentLevel = 3;
    resetLevel();
    mario.x = piranha.pipeX - mario.w / 2;
    piranha.state = 'hidden';
    piranha.timer = 120;
    updatePiranha();
    const nearState = piranha.state;

    mario.x = piranha.pipeX + TILE * 4;
    piranha.state = 'hidden';
    piranha.timer = 120;
    updatePiranha();
    const farState = piranha.state;

    piranha.state = 'up';
    piranha.visible = true;
    mario.x = piranha.x;
    mario.y = piranha.y;
    updatePiranha();
    return { nearState, farState, damageCalls };
  })()`
);
assert.strictEqual(piranhaChecks.nearState, 'hidden', 'Expected piranha to stay hidden while Mario is near');
assert.strictEqual(piranhaChecks.farState, 'rising', 'Expected piranha to rise when Mario is far');
assert.strictEqual(piranhaChecks.damageCalls, 1, 'Expected piranha contact to damage Mario');

console.log('All checks passed.');
