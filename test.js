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
assert(sourceGame.includes('resetLevel(true);'), 'Expected respawn/advance to preserve power state');
assert(sourceGame.includes('resetLevel(false);'), 'Expected fresh start paths to reset power state');
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
    const lockAfterEnter = pipeTransitionLock;
    exitLevel3HiddenArea();
    const lockAfterExit = pipeTransitionLock;
    const returnCol = Math.floor((mario.x + mario.w / 2) / TILE);
    const returnFeetRow = Math.floor((mario.y + mario.h) / TILE);
    return {
      spawnOnSolid,
      startArea,
      hiddenArea,
      startPiranha,
      hiddenPiranha: hiddenPiranha === null,
      hiddenMusic,
      lockAfterEnter,
      lockAfterExit,
      returnArea: currentArea,
      returnCol,
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
assert.strictEqual(transitionChecks.lockAfterEnter, 45, 'Expected pipeTransitionLock=45 after entering hidden area');
assert.strictEqual(transitionChecks.lockAfterExit, 45, 'Expected pipeTransitionLock=45 after exiting hidden area');
assert(transitionChecks.returnCol >= 120 && transitionChecks.returnCol <= 122, 'Expected return spawn to be on top of main-area entry pipe (cols 120-121)');

const powerRetentionChecks = run(
  ctx,
  `(() => {
    currentLevel = 3;
    currentArea = 'main';
    mario = createMario();
    mario.form = 'fire';
    mario.h = 24;
    mario.y = 184;
    mario.starFrames = 180;

    enterLevel3HiddenArea();
    const hiddenForm = mario.form;
    const hiddenStarFrames = mario.starFrames;
    const hiddenY = mario.y;

    exitLevel3HiddenArea();
    const returnedForm = mario.form;
    const returnedStarFrames = mario.starFrames;
    const returnedY = mario.y;

    resetLevel(true);
    const respawnForm = mario.form;
    const respawnStarFrames = mario.starFrames;
    const respawnH = mario.h;
    const respawnY = mario.y;

    resetLevel(false);
    return {
      hiddenForm,
      hiddenStarFrames,
      hiddenY,
      returnedForm,
      returnedStarFrames,
      returnedY,
      respawnForm,
      respawnStarFrames,
      respawnH,
      respawnY,
      freshStartForm: mario.form,
      freshStartStarFrames: mario.starFrames,
      freshStartH: mario.h,
      freshStartY: mario.y,
    };
  })()`
);
assert.strictEqual(powerRetentionChecks.hiddenForm, 'fire', 'Expected form preserved when entering hidden pipe area');
assert.strictEqual(powerRetentionChecks.hiddenStarFrames, 180, 'Expected star timer preserved when entering hidden pipe area');
assert.strictEqual(powerRetentionChecks.hiddenY, 10 * 16 - 8, 'Expected tall form pipe entry spawn to align feet to pipe top');
assert.strictEqual(powerRetentionChecks.returnedForm, 'fire', 'Expected form preserved when exiting hidden pipe area');
assert.strictEqual(powerRetentionChecks.returnedStarFrames, 180, 'Expected star timer preserved when exiting hidden pipe area');
assert.strictEqual(powerRetentionChecks.returnedY, 10 * 16 - 8, 'Expected tall form pipe exit spawn to align feet to pipe top');
assert.strictEqual(powerRetentionChecks.respawnForm, 'fire', 'Expected resetLevel(true) to preserve fire form');
assert.strictEqual(powerRetentionChecks.respawnStarFrames, 180, 'Expected resetLevel(true) to preserve star timer');
assert.strictEqual(powerRetentionChecks.respawnH, 24, 'Expected resetLevel(true) to preserve tall hitbox');
assert.strictEqual(powerRetentionChecks.respawnY, 184, 'Expected resetLevel(true) to preserve tall-form spawn feet alignment');
assert.strictEqual(powerRetentionChecks.freshStartForm, 'small', 'Expected resetLevel(false) to reset to small Mario');
assert.strictEqual(powerRetentionChecks.freshStartStarFrames, 0, 'Expected resetLevel(false) to clear star timer');
assert.strictEqual(powerRetentionChecks.freshStartH, 16, 'Expected resetLevel(false) to restore small hitbox');
assert.strictEqual(powerRetentionChecks.freshStartY, 192, 'Expected resetLevel(false) to use small spawn position');

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

// ============================================================
// POWER-UP MECHANICS — separate context that loads items.js + mario.js
// ============================================================

const ctxPow = createContext();
loadScripts(ctxPow, ['js/constants.js', 'js/level.js', 'js/state.js', 'js/tiles.js', 'js/collision.js']);
// Stubs required by mario.js (not needed for the functions under test, but must exist)
run(ctxPow, `
  function isDown()  { return false; }
  function isPressed() { return false; }
  function updateCamera() {}
  function updateEnemies() {}
  function updateFireballs() {}
  function updatePiranha() {}
`);
loadScripts(ctxPow, ['js/items.js', 'js/mario.js']);

// ---- collectItem: mushroom upgrade chain ----
const collectMushroomChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();

  // small + mushroom → super
  mario.form = 'small'; mario.h = 16; mario.y = 192;
  const prevY = mario.y;
  collectItem({ type: 'mushroom' });
  const afterSmallForm = mario.form;
  const afterSmallH    = mario.h;
  const afterSmallYDelta = prevY - mario.y;  // should be +8 (y decremented)

  // super + mushroom → stays super, no position change
  mario.form = 'super'; mario.h = 24; mario.y = 184;
  collectItem({ type: 'mushroom' });
  const afterSuperForm = mario.form;
  const afterSuperH    = mario.h;

  // fire + mushroom → stays fire
  mario.form = 'fire'; mario.h = 24;
  collectItem({ type: 'mushroom' });
  const afterFireForm = mario.form;

  return { afterSmallForm, afterSmallH, afterSmallYDelta, afterSuperForm, afterSuperH, afterFireForm };
})()`);
assert.strictEqual(collectMushroomChecks.afterSmallForm,  'super', 'collectItem(mushroom): small → super');
assert.strictEqual(collectMushroomChecks.afterSmallH,     24,      'collectItem(mushroom): small h becomes 24');
assert.strictEqual(collectMushroomChecks.afterSmallYDelta, 8,      'collectItem(mushroom): y decrements 8 to keep feet in place');
assert.strictEqual(collectMushroomChecks.afterSuperForm,  'super', 'collectItem(mushroom): super stays super');
assert.strictEqual(collectMushroomChecks.afterSuperH,     24,      'collectItem(mushroom): super h stays 24');
assert.strictEqual(collectMushroomChecks.afterFireForm,   'fire',  'collectItem(mushroom): fire stays fire');

// ---- collectItem: fireflower upgrade chain ----
const collectFlowerChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();

  // small + fireflower → fire, y adjusts
  mario.form = 'small'; mario.h = 16; mario.y = 192;
  const prevY = mario.y;
  collectItem({ type: 'fireflower' });
  const fromSmallForm   = mario.form;
  const fromSmallH      = mario.h;
  const fromSmallYDelta = prevY - mario.y;

  // super + fireflower → fire, y unchanged
  mario.form = 'super'; mario.h = 24; mario.y = 184;
  const superPrevY = mario.y;
  collectItem({ type: 'fireflower' });
  const fromSuperForm   = mario.form;
  const fromSuperH      = mario.h;
  const fromSuperYDelta = superPrevY - mario.y;

  // fire + fireflower → still fire
  mario.form = 'fire'; mario.h = 24;
  collectItem({ type: 'fireflower' });
  const fromFireForm = mario.form;

  return { fromSmallForm, fromSmallH, fromSmallYDelta, fromSuperForm, fromSuperH, fromSuperYDelta, fromFireForm };
})()`);
assert.strictEqual(collectFlowerChecks.fromSmallForm,    'fire', 'collectItem(fireflower): small → fire');
assert.strictEqual(collectFlowerChecks.fromSmallH,       24,     'collectItem(fireflower): small h becomes 24');
assert.strictEqual(collectFlowerChecks.fromSmallYDelta,  8,      'collectItem(fireflower): small y decrements 8 (feet stay put)');
assert.strictEqual(collectFlowerChecks.fromSuperForm,    'fire', 'collectItem(fireflower): super → fire');
assert.strictEqual(collectFlowerChecks.fromSuperH,       24,     'collectItem(fireflower): super h stays 24');
assert.strictEqual(collectFlowerChecks.fromSuperYDelta,  0,      'collectItem(fireflower): super y unchanged (already tall)');
assert.strictEqual(collectFlowerChecks.fromFireForm,     'fire', 'collectItem(fireflower): fire stays fire');

// ---- collectItem: star ----
const collectStarChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();
  mario.form = 'super'; mario.starFrames = 0;
  collectItem({ type: 'star' });
  const superGotStar = mario.starFrames;
  const superFormUnchanged = mario.form;

  mario.form = 'fire'; mario.starFrames = 0;
  collectItem({ type: 'star' });
  const fireGotStar = mario.starFrames;
  const fireFormUnchanged = mario.form;

  return { superGotStar, superFormUnchanged, fireGotStar, fireFormUnchanged };
})()`);
assert.strictEqual(collectStarChecks.superGotStar,      600,    'collectItem(star): sets starFrames = 600');
assert.strictEqual(collectStarChecks.superFormUnchanged,'super', 'collectItem(star): form unchanged for super');
assert.strictEqual(collectStarChecks.fireGotStar,       600,    'collectItem(star): sets starFrames = 600 for fire');
assert.strictEqual(collectStarChecks.fireFormUnchanged, 'fire',  'collectItem(star): form unchanged for fire');

// ---- damageMario: downgrade chain ----
const damageChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();

  // fire → super on damage
  mario.form = 'fire'; mario.h = 24; mario.invincibleFrames = 0; mario.starFrames = 0;
  damageMario();
  const afterFireForm  = mario.form;
  const afterFireH     = mario.h;
  const afterFireInv   = mario.invincibleFrames;

  // super → small on damage; feet should not move (y += 8)
  mario.form = 'super'; mario.h = 24; mario.y = 100; mario.invincibleFrames = 0; mario.starFrames = 0;
  const superY = mario.y;
  damageMario();
  const afterSuperForm = mario.form;
  const afterSuperH    = mario.h;
  const afterSuperInv  = mario.invincibleFrames;
  const afterSuperFeet = mario.y + mario.h;   // feet pixel = y + h
  const expectedFeet   = superY + 24;         // should equal feet before damage

  // small → death
  mario.form = 'small'; mario.h = 16; mario.dead = false; mario.invincibleFrames = 0; mario.starFrames = 0;
  damageMario();
  const afterSmallDead = mario.dead;

  return {
    afterFireForm, afterFireH, afterFireInv,
    afterSuperForm, afterSuperH, afterSuperInv, afterSuperFeet, expectedFeet,
    afterSmallDead,
  };
})()`);
assert.strictEqual(damageChecks.afterFireForm,   'super', 'damageMario: fire → super');
assert.strictEqual(damageChecks.afterFireH,      24,      'damageMario: h stays 24 (fire→super, both tall)');
assert.strictEqual(damageChecks.afterFireInv,    120,     'damageMario: fire→super grants 120 invincible frames');
assert.strictEqual(damageChecks.afterSuperForm,  'small', 'damageMario: super → small');
assert.strictEqual(damageChecks.afterSuperH,     16,      'damageMario: h becomes 16 after super→small');
assert.strictEqual(damageChecks.afterSuperInv,   120,     'damageMario: super→small grants 120 invincible frames');
assert.strictEqual(damageChecks.afterSuperFeet,  damageChecks.expectedFeet, 'damageMario: super→small feet pixel stays constant (y += 8)');
assert(damageChecks.afterSmallDead, 'damageMario: small Mario dies');

// ---- damageMario: invincibility blocks damage ----
const damageBlockChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();

  // invincibleFrames > 0 → no downgrade
  mario.form = 'super'; mario.invincibleFrames = 60; mario.starFrames = 0;
  damageMario();
  const blockedByInv = mario.form;

  // starFrames > 0 → no downgrade
  mario.form = 'fire'; mario.invincibleFrames = 0; mario.starFrames = 60;
  damageMario();
  const blockedByStar = mario.form;

  return { blockedByInv, blockedByStar };
})()`);
assert.strictEqual(damageBlockChecks.blockedByInv,  'super', 'damageMario: invincibleFrames blocks damage');
assert.strictEqual(damageBlockChecks.blockedByStar, 'fire',  'damageMario: starFrames blocks damage');

// ---- Pipe transitions: super and small form retention ----
const pipeFormChecks = run(ctxPow, `(() => {
  currentLevel = 3;

  // super Mario enters hidden area
  currentArea = 'main';
  mario = createMario();
  mario.form = 'super'; mario.h = 24;
  applyCurrentAreaData();
  enterLevel3HiddenArea();
  const hiddenSuperForm = mario.form;
  const hiddenSuperH    = mario.h;
  const hiddenSuperFeet = mario.y + mario.h;

  // super Mario exits hidden area
  exitLevel3HiddenArea();
  const exitedSuperForm = mario.form;
  const exitedSuperH    = mario.h;
  const exitedSuperFeet = mario.y + mario.h;

  // small Mario enters hidden area
  currentArea = 'main';
  mario = createMario();
  mario.form = 'small'; mario.h = 16;
  applyCurrentAreaData();
  enterLevel3HiddenArea();
  const hiddenSmallForm = mario.form;
  const hiddenSmallH    = mario.h;

  return {
    hiddenSuperForm, hiddenSuperH, hiddenSuperFeet,
    exitedSuperForm, exitedSuperH, exitedSuperFeet,
    hiddenSmallForm, hiddenSmallH,
  };
})()`);
assert.strictEqual(pipeFormChecks.hiddenSuperForm, 'super', 'pipe enter: super form preserved in hidden area');
assert.strictEqual(pipeFormChecks.hiddenSuperH,    24,      'pipe enter: super h=24 preserved in hidden area');
assert.strictEqual(pipeFormChecks.hiddenSuperFeet, 11 * 16, 'pipe enter: super Mario feet land on pipe top row 11');
assert.strictEqual(pipeFormChecks.exitedSuperForm, 'super', 'pipe exit: super form preserved back in main area');
assert.strictEqual(pipeFormChecks.exitedSuperH,    24,      'pipe exit: super h=24 preserved back in main area');
assert.strictEqual(pipeFormChecks.exitedSuperFeet, 11 * 16, 'pipe exit: super Mario feet land on pipe top row 11');
assert.strictEqual(pipeFormChecks.hiddenSmallForm, 'small', 'pipe enter: small form preserved in hidden area');
assert.strictEqual(pipeFormChecks.hiddenSmallH,    16,      'pipe enter: small h=16 preserved in hidden area');

// ---- resetLevel(true): small and super form retention ----
const resetFormChecks = run(ctxPow, `(() => {
  currentLevel = 1; resetLevel();

  // small preserved
  mario.form = 'small'; mario.h = 16;
  resetLevel(true);
  const smallForm = mario.form; const smallH = mario.h; const smallY = mario.y;

  // super preserved
  mario.form = 'super'; mario.h = 24;
  resetLevel(true);
  const superForm = mario.form; const superH = mario.h; const superY = mario.y;

  // fire preserved (covered by existing suite; include for completeness)
  mario.form = 'fire'; mario.h = 24;
  resetLevel(true);
  const fireForm = mario.form; const fireH = mario.h; const fireY = mario.y;

  return { smallForm, smallH, smallY, superForm, superH, superY, fireForm, fireH, fireY };
})()`);
assert.strictEqual(resetFormChecks.smallForm, 'small', 'resetLevel(true): small form preserved');
assert.strictEqual(resetFormChecks.smallH,    16,      'resetLevel(true): small h=16');
assert.strictEqual(resetFormChecks.smallY,    192,     'resetLevel(true): small spawn y=192');
assert.strictEqual(resetFormChecks.superForm, 'super', 'resetLevel(true): super form preserved');
assert.strictEqual(resetFormChecks.superH,    24,      'resetLevel(true): super h=24');
assert.strictEqual(resetFormChecks.superY,    184,     'resetLevel(true): super spawn y=184 (feet aligned)');
assert.strictEqual(resetFormChecks.fireForm,  'fire',  'resetLevel(true): fire form preserved');
assert.strictEqual(resetFormChecks.fireH,     24,      'resetLevel(true): fire h=24');
assert.strictEqual(resetFormChecks.fireY,     184,     'resetLevel(true): fire spawn y=184 (feet aligned)');

// ---- Level advancement (win) preserves power across all three level transitions ----
const levelAdvanceChecks = run(ctxPow, `(() => {
  // Level 1 → 2 with super form
  currentLevel = 1; resetLevel();
  mario.form = 'super'; mario.h = 24;
  currentLevel = (currentLevel % 3) + 1;  // → 2
  resetLevel(true);
  const l1to2Form = mario.form; const l1to2H = mario.h;

  // Level 2 → 3 with fire form
  currentLevel = 2; resetLevel();
  mario.form = 'fire'; mario.h = 24;
  currentLevel = (currentLevel % 3) + 1;  // → 3
  resetLevel(true);
  const l2to3Form = mario.form; const l2to3H = mario.h;

  // Level 3 → 1 with super form
  currentLevel = 3; resetLevel();
  mario.form = 'super'; mario.h = 24;
  currentLevel = (currentLevel % 3) + 1;  // → 1
  resetLevel(true);
  const l3to1Form = mario.form; const l3to1H = mario.h;

  // Level 2 → 3 with star frames
  currentLevel = 2; resetLevel();
  mario.form = 'fire'; mario.starFrames = 250;
  currentLevel = (currentLevel % 3) + 1;  // → 3
  resetLevel(true);
  const l2to3Star = mario.starFrames;

  return { l1to2Form, l1to2H, l2to3Form, l2to3H, l3to1Form, l3to1H, l2to3Star };
})()`);
assert.strictEqual(levelAdvanceChecks.l1to2Form, 'super', 'level 1→2 win: super form preserved');
assert.strictEqual(levelAdvanceChecks.l1to2H,    24,      'level 1→2 win: super h=24 preserved');
assert.strictEqual(levelAdvanceChecks.l2to3Form, 'fire',  'level 2→3 win: fire form preserved');
assert.strictEqual(levelAdvanceChecks.l2to3H,    24,      'level 2→3 win: fire h=24 preserved');
assert.strictEqual(levelAdvanceChecks.l3to1Form, 'super', 'level 3→1 win: super form preserved');
assert.strictEqual(levelAdvanceChecks.l3to1H,    24,      'level 3→1 win: super h=24 preserved');
assert.strictEqual(levelAdvanceChecks.l2to3Star, 250,     'level 2→3 win: star frames preserved');

console.log('All checks passed.');
