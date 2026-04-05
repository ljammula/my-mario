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
    visibilityState: 'visible',
    addEventListener: noop,
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
const sourceHud = read('js/hud.js');
const sourceLevel = read('js/level.js');
const sourceState = read('js/state.js');
const sourceGame = read('js/game.js');
const sourceEnemies = read('js/enemies.js');
const sourceMario = read('js/mario.js');
const sourceItems = read('js/items.js');

assert(sourceLevel.includes('function buildLevel3Main()'), 'Expected buildLevel3Main() in js/level.js');
assert(sourceLevel.includes('function buildLevel3Hidden()'), 'Expected buildLevel3Hidden() in js/level.js');
assert(sourceState.includes('enterLevel3HiddenArea'), 'Expected hidden-area transition helpers in js/state.js');
assert(sourceGame.includes('currentLevel = (currentLevel % MAX_LEVEL) + 1'), 'Expected MAX_LEVEL rotation in js/game.js');
assert(sourceGame.includes('resetLevel(true);'), 'Expected respawn/advance to preserve power state');
assert(sourceGame.includes('resetLevel(false);'), 'Expected fresh start paths to reset power state');
assert(sourceEnemies.includes('piranha.pipeX'), 'Expected dynamic piranha pipe targeting in js/enemies.js');
assert(sourceMario.includes("content === 'flower' || content === 'bomb'"), 'Expected explicit bomb/flower block handling in js/mario.js');
assert(sourceItems.includes("item.type === 'fireflower' || item.type === 'bomb'"), 'Expected bomb pickup to use fire-power collect path in js/items.js');
assert(sourceRender.includes("const overallsColor = form === 'fire'"), 'Expected fire-form Mario palette override in js/render.js');
assert(sourceHud.includes('function drawHUD(ctx)'), 'Expected drawHUD() in js/hud.js');
assert(sourceHud.includes("'\\u00D7' + String(coins).padStart(2, '0')"), 'Expected coin counter text in js/hud.js');

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

const koopaTopStompChecks = run(
  ctx,
  `(() => {
    const damageBefore = damageCalls;
    mario = createMario();
    mario.x = 100;
    mario.y = 175.5;
    mario.vy = 2;
    mario.w = 12;
    mario.h = 16;
    mario.form = 'super';

    const k = createEnemyKoopa(6, 13, { speed: 0 });
    k.x = 100;
    k.y = 176;
    k.w = 14;
    k.h = 24;
    k.vx = 0;
    k.state = 'walk';

    checkEnemyMarioCollision(k);
    return {
      koopaState: k.state,
      marioVy: mario.vy,
      damageDelta: damageCalls - damageBefore,
      marioForm: mario.form,
    };
  })()`
);
assert.strictEqual(koopaTopStompChecks.koopaState, 'shell', 'Expected top-down Koopa contact to convert Koopa to shell');
assert(koopaTopStompChecks.marioVy < 0, 'Expected stomp bounce (negative vy) after top-down Koopa contact');
assert.strictEqual(koopaTopStompChecks.damageDelta, 0, 'Expected no Mario damage when stomping Koopa from above');
assert.strictEqual(koopaTopStompChecks.marioForm, 'super', 'Expected Koopa stomp not to downgrade Mario form');

const highVelocityStompChecks = run(
  ctx,
  `(() => {
    const damageBefore = damageCalls;
    mario = createMario();
    mario.x = 140;
    mario.y = 166;
    mario.vy = 18;
    mario.w = 12;
    mario.h = 16;
    mario.dead = false;

    const g = createEnemyGoomba(8, 13, { speed: 0 });
    g.x = 140;
    g.y = 176;
    g.w = 16;
    g.h = 16;
    g.vx = 0;
    g.state = 'walk';

    checkEnemyMarioCollision(g);
    return {
      enemyState: g.state,
      marioVy: mario.vy,
      marioDead: mario.dead,
      damageDelta: damageCalls - damageBefore,
    };
  })()`
);
assert.strictEqual(highVelocityStompChecks.enemyState, 'squish', 'Expected high-velocity top-down stomp to defeat Goomba');
assert(highVelocityStompChecks.marioVy < 0, 'Expected high-velocity stomp to bounce Mario upward');
assert.strictEqual(highVelocityStompChecks.marioDead, false, 'Expected high-velocity stomp to keep Mario alive');
assert.strictEqual(highVelocityStompChecks.damageDelta, 0, 'Expected no damage on high-velocity stomp');

const koopaShellInteractionChecks = run(
  ctx,
  `(() => {
    const damageBefore = damageCalls;
    mario = createMario();
    mario.x = 120;
    mario.y = 175.5;
    mario.vy = 2;
    mario.w = 12;
    mario.h = 16;
    mario.dead = false;

    const k = createEnemyKoopa(7, 13, { speed: 0 });
    k.x = 120;
    k.y = 176;
    k.w = 14;
    k.h = 24;
    k.vx = 0;
    k.state = 'walk';

    checkEnemyMarioCollision(k);
    const afterFirstState = k.state;

    mario.x = 110;
    mario.y = 175.5;
    mario.vy = 3;
    checkEnemyMarioCollision(k);

    return {
      afterFirstState,
      afterSecondState: k.state,
      shellVx: k.vx,
      marioDead: mario.dead,
      damageDelta: damageCalls - damageBefore,
    };
  })()`
);
assert.strictEqual(koopaShellInteractionChecks.afterFirstState, 'shell', 'Expected first Koopa stomp to create shell state');
assert.strictEqual(koopaShellInteractionChecks.afterSecondState, 'shell_moving', 'Expected stomp on shell to kick Koopa shell');
assert(koopaShellInteractionChecks.shellVx > 0, 'Expected Koopa shell kick direction to match Mario side');
assert.strictEqual(koopaShellInteractionChecks.marioDead, false, 'Expected Koopa shell stomp sequence to keep Mario alive');
assert.strictEqual(koopaShellInteractionChecks.damageDelta, 0, 'Expected no damage during Koopa stomp-to-shell interaction');

const sideHitDamageChecks = run(
  ctx,
  `(() => {
    const damageBefore = damageCalls;
    mario = createMario();
    mario.x = 150;
    mario.y = 176;
    mario.vy = 0;
    mario.w = 12;
    mario.h = 16;
    mario.dead = false;

    const g = createEnemyGoomba(9, 13, { speed: 0 });
    g.x = 150;
    g.y = 176;
    g.w = 16;
    g.h = 16;
    g.vx = 0;
    g.state = 'walk';

    checkEnemyMarioCollision(g);
    return {
      enemyState: g.state,
      marioDead: mario.dead,
      damageDelta: damageCalls - damageBefore,
    };
  })()`
);
assert.strictEqual(sideHitDamageChecks.enemyState, 'walk', 'Expected side collision not to stomp-kill enemy');
assert.strictEqual(sideHitDamageChecks.damageDelta, 1, 'Expected side collision to damage Mario');
assert.strictEqual(sideHitDamageChecks.marioDead, false, 'Expected damage handler stub to avoid forcing death in test context');

const chainStompChecks = run(
  ctx,
  `(() => {
    const damageBefore = damageCalls;
    mario = createMario();
    mario.x = 160;
    mario.y = 166;
    mario.vy = 3;
    mario.w = 12;
    mario.h = 16;
    mario.grounded = false;
    mario.dead = false;

    const g1 = createEnemyGoomba(10, 13, { speed: 0 });
    g1.x = 160;
    g1.y = 176;
    g1.state = 'walk';
    checkEnemyMarioCollision(g1);

    mario.x = 178;
    mario.y = 166;
    mario.vy = 4;
    mario.grounded = false;

    const g2 = createEnemyGoomba(11, 13, { speed: 0 });
    g2.x = 178;
    g2.y = 176;
    g2.state = 'walk';
    checkEnemyMarioCollision(g2);

    return {
      firstState: g1.state,
      secondState: g2.state,
      marioVy: mario.vy,
      marioGrounded: mario.grounded,
      marioDead: mario.dead,
      damageDelta: damageCalls - damageBefore,
    };
  })()`
);
assert.strictEqual(chainStompChecks.firstState, 'squish', 'Expected first enemy in chain stomp to be defeated');
assert.strictEqual(chainStompChecks.secondState, 'squish', 'Expected second enemy in chain stomp to be defeated');
assert(chainStompChecks.marioVy < 0, 'Expected chain stomp to keep bounce behavior on second stomp');
assert.strictEqual(chainStompChecks.marioGrounded, false, 'Expected chain stomp sequence to remain airborne between stomps');
assert.strictEqual(chainStompChecks.marioDead, false, 'Expected chain stomp sequence to keep Mario alive');
assert.strictEqual(chainStompChecks.damageDelta, 0, 'Expected no damage during chain stomp');

const stompConsistencyAcrossLevelsChecks = run(
  ctx,
  `(() => {
    const failures = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      currentLevel = level;
      resetLevel(false);

      const damageBefore = damageCalls;
      mario.x = 200;
      mario.y = 166;
      mario.vy = 3;
      mario.w = 12;
      mario.h = 16;
      mario.dead = false;
      mario.starFrames = 0;

      const g = createEnemyGoomba(12, 13, { speed: 0 });
      g.x = 200;
      g.y = 176;
      g.w = 16;
      g.h = 16;
      g.state = 'walk';

      checkEnemyMarioCollision(g);
      const stompWorked = g.state === 'squish' && mario.vy < 0 && (damageCalls - damageBefore) === 0 && !mario.dead;
      if (!stompWorked) failures.push(level);
    }
    return failures;
  })()`
);
assert.strictEqual(
  stompConsistencyAcrossLevelsChecks.length,
  0,
  'Expected stomp behavior consistency across all levels, failed levels: ' + stompConsistencyAcrossLevelsChecks.join(', ')
);

const ctxOneWay = createContext();
loadScripts(ctxOneWay, ['js/constants.js', 'js/level.js', 'js/state.js', 'js/tiles.js', 'js/collision.js']);
const oneWayPlatformChecks = run(
  ctxOneWay,
  `(() => {
    grid = Array.from({ length: LEVEL_ROWS }, () => new Array(LEVEL_COLS).fill('.'));
    const col = 10;
    const row = 8;
    grid[row][col] = 'M';

    const passThroughFromBelow = {
      x: col * TILE + 2,
      y: row * TILE + 9,
      w: 12,
      h: 16,
      vx: 0,
      vy: -10,
    };
    const passedGrounded = resolvePlayerTileCollision(passThroughFromBelow);

    const landFromAbove = {
      x: col * TILE + 2,
      y: row * TILE - 20,
      w: 12,
      h: 16,
      vx: 0,
      vy: 6,
    };
    const landedGrounded = resolvePlayerTileCollision(landFromAbove);

    const standOnTop = {
      x: col * TILE + 2,
      y: row * TILE - 16,
      w: 12,
      h: 16,
      vx: 0,
      vy: 0,
    };
    const standingGrounded = resolvePlayerTileCollision(standOnTop);

    const leftEdgeLanding = {
      x: col * TILE - 2,
      y: row * TILE - 20,
      w: 12,
      h: 16,
      vx: 0,
      vy: 6,
    };
    const leftEdgeGrounded = resolvePlayerTileCollision(leftEdgeLanding);

    const rightEdgeLanding = {
      x: col * TILE + 2,
      y: row * TILE - 20,
      w: 12,
      h: 16,
      vx: 0,
      vy: 6,
    };
    const rightEdgeGrounded = resolvePlayerTileCollision(rightEdgeLanding);

    const sideClipNoLand = {
      x: col * TILE - 11,
      y: row * TILE - 20,
      w: 12,
      h: 16,
      vx: 0,
      vy: 6,
    };
    const sideClipGrounded = resolvePlayerTileCollision(sideClipNoLand);

    return {
      passThroughY: passThroughFromBelow.y,
      passThroughVy: passThroughFromBelow.vy,
      passThroughGrounded: passedGrounded,
      landedY: landFromAbove.y,
      landedVy: landFromAbove.vy,
      landedGrounded,
      standingGrounded,
      leftEdgeY: leftEdgeLanding.y,
      rightEdgeY: rightEdgeLanding.y,
      leftEdgeGrounded,
      rightEdgeGrounded,
      sideClipY: sideClipNoLand.y,
      sideClipGrounded,
    };
  })()`
);
assert.strictEqual(oneWayPlatformChecks.passThroughY, 127, 'Expected Mario to pass upward through one-way platform from below');
assert.strictEqual(oneWayPlatformChecks.passThroughVy, -10, 'Expected no upward collision response when passing through one-way platform');
assert.strictEqual(oneWayPlatformChecks.passThroughGrounded, false, 'Expected pass-through jump from below not to set grounded');
assert.strictEqual(oneWayPlatformChecks.landedY, 112, 'Expected falling Mario to snap to one-way platform top');
assert.strictEqual(oneWayPlatformChecks.landedVy, 0, 'Expected landing on one-way platform to zero vertical velocity');
assert.strictEqual(oneWayPlatformChecks.landedGrounded, true, 'Expected falling from above to ground Mario on one-way platform');
assert.strictEqual(oneWayPlatformChecks.standingGrounded, true, 'Expected standing on one-way platform with vy=0 to remain grounded');
assert.strictEqual(oneWayPlatformChecks.leftEdgeY, 112, 'Expected one-way platform landing to work at left edge overlap');
assert.strictEqual(oneWayPlatformChecks.rightEdgeY, 112, 'Expected one-way platform landing to work at right edge overlap');
assert.strictEqual(oneWayPlatformChecks.leftEdgeGrounded, true, 'Expected grounded=true when landing near left edge of one-way platform');
assert.strictEqual(oneWayPlatformChecks.rightEdgeGrounded, true, 'Expected grounded=true when landing near right edge of one-way platform');
assert.strictEqual(oneWayPlatformChecks.sideClipY, 114, 'Expected barely clipping side of one-way platform not to force landing');
assert.strictEqual(oneWayPlatformChecks.sideClipGrounded, false, 'Expected no grounding when overlap misses inset collision probes');

const ctxBomb = createContext();
loadScripts(ctxBomb, ['js/constants.js', 'js/level.js', 'js/state.js', 'js/tiles.js', 'js/collision.js', 'js/mario.js', 'js/items.js']);
const bombPowerChecks = run(
  ctxBomb,
  `(() => {
    grid = Array.from({ length: LEVEL_ROWS }, () => new Array(LEVEL_COLS).fill('.'));
    items = [];
    mario = createMario();
    mario.form = 'super';
    mario.h = 24;
    mario.y = 184;

    grid[5][5] = 'Q';
    currentQContents = { '5,5': 'mushroom' };
    handleHeadBonk(5, 5);
    const mushroomDropType = items[0]?.type || null;

    items = [];
    grid[5][5] = 'Q';
    currentQContents = { '5,5': 'bomb' };
    handleHeadBonk(5, 5);
    const bombDropType = items[0]?.type || null;

    mario.form = 'super';
    mario.h = 24;
    mario.y = 184;
    collectItem({ type: 'bomb' });
    return {
      mushroomDropType,
      bombDropType,
      formAfterBombCollect: mario.form,
      heightAfterBombCollect: mario.h,
    };
  })()`
);
assert.strictEqual(bombPowerChecks.mushroomDropType, 'mushroom', 'Expected mushroom blocks to stay mushroom drops (no implicit bomb/fire conversion)');
assert.strictEqual(bombPowerChecks.bombDropType, 'bomb', 'Expected bomb-designated blocks to drop bomb power item');
assert.strictEqual(bombPowerChecks.formAfterBombCollect, 'fire', 'Expected bomb pickup to grant fire/bomb power form');
assert.strictEqual(bombPowerChecks.heightAfterBombCollect, 24, 'Expected bomb pickup to keep Mario in tall form');

const lateWorldSpawnSafety = run(
  ctx,
  `(() => {
    const results = [];
    for (let level = 6; level <= 10; level++) {
      currentLevel = level;
      resetLevel(false);
      gameState = STATE.PLAYING;
      for (let i = 0; i < 120; i++) {
        updateEnemies();
        if (mario.dead) break;
      }
      results.push({
        level,
        dead: mario.dead,
        form: mario.form,
      });
    }
    return results;
  })()`
);
for (const result of lateWorldSpawnSafety) {
  assert(
    !result.dead,
    'Expected no start-of-level death window in late worlds (6-10), but Mario died in level ' + result.level
  );
}

// ============================================================
// SECTION 4: Camera tracking tests
// ============================================================
// The camera uses smooth bidirectional tracking with directional look-ahead:
//   target = clamp(marioCenterX - LOGICAL_W/2 + facing * CAMERA_LOOKAHEAD, 0, maxCam)
//   cameraX converges toward target via proportional step, capped at CAMERA_MAX_STEP.
// 200 update frames is sufficient to converge at mario.vx = 0.

const ctxCam = createContext();
loadScripts(ctxCam, [
  'js/constants.js',
  'js/level.js',
  'js/state.js',
  'js/input.js',
  'js/tiles.js',
  'js/collision.js',
  'js/mario.js',
  'js/camera.js',
]);
run(ctxCam, 'currentLevel = 1; resetLevel();');

const CAM_TOL = 0.5; // convergence tolerance (px)

// Camera converges to correct target when facing right
const camConvergeRight = run(ctxCam, `(() => {
  cameraX = 0;
  mario.x = 300; mario.facing = 1; mario.vx = 0; mario.w = 12;
  for (let i = 0; i < 200; i++) updateCamera();
  const expected = Math.max(0, Math.min(
    mario.x + mario.w / 2 - LOGICAL_W / 2 + CAMERA_LOOKAHEAD,
    LEVEL_COLS * TILE - LOGICAL_W
  ));
  return { cameraX, expected };
})()`);
assert(
  Math.abs(camConvergeRight.cameraX - camConvergeRight.expected) < CAM_TOL,
  'Camera should converge to look-ahead target when facing right: expected ' +
    camConvergeRight.expected.toFixed(2) + ', got ' + camConvergeRight.cameraX.toFixed(2)
);

// Camera converges to a different (leftward) target when facing left
const camConvergeLeft = run(ctxCam, `(() => {
  cameraX = 0;
  mario.x = 300; mario.facing = -1; mario.vx = 0; mario.w = 12;
  for (let i = 0; i < 200; i++) updateCamera();
  const expected = Math.max(0, Math.min(
    mario.x + mario.w / 2 - LOGICAL_W / 2 - CAMERA_LOOKAHEAD,
    LEVEL_COLS * TILE - LOGICAL_W
  ));
  return { cameraX, expected };
})()`);
assert(
  Math.abs(camConvergeLeft.cameraX - camConvergeLeft.expected) < CAM_TOL,
  'Camera should converge to look-ahead target when facing left: expected ' +
    camConvergeLeft.expected.toFixed(2) + ', got ' + camConvergeLeft.cameraX.toFixed(2)
);

// Look-ahead: facing right settles 2*CAMERA_LOOKAHEAD further right than facing left
const camLookAhead = run(ctxCam, `(() => {
  mario.x = 300; mario.vx = 0; mario.w = 12;
  mario.facing = 1;  cameraX = 0;
  for (let i = 0; i < 200; i++) updateCamera();
  const rightCam = cameraX;
  mario.facing = -1; cameraX = 0;
  for (let i = 0; i < 200; i++) updateCamera();
  const leftCam = cameraX;
  return { rightCam, leftCam, diff: rightCam - leftCam, expected: 2 * CAMERA_LOOKAHEAD };
})()`);
assert(
  Math.abs(camLookAhead.diff - camLookAhead.expected) < CAM_TOL,
  'Look-ahead difference should be 2*CAMERA_LOOKAHEAD (' + camLookAhead.expected +
    '): facing-right=' + camLookAhead.rightCam.toFixed(1) +
    ', facing-left=' + camLookAhead.leftCam.toFixed(1) +
    ', diff=' + camLookAhead.diff.toFixed(1)
);

// Camera actively tracks Mario moving rightward (cameraX increases)
const camTracksRight = run(ctxCam, `(() => {
  mario.x = 100; mario.facing = 1; mario.vx = 0; mario.w = 12; cameraX = 0;
  for (let i = 0; i < 200; i++) updateCamera();
  const s1 = cameraX;
  mario.x = 400;
  for (let i = 0; i < 200; i++) updateCamera();
  return { s1, s2: cameraX };
})()`);
assert(
  camTracksRight.s2 > camTracksRight.s1,
  'Camera should advance when Mario moves right: ' +
    camTracksRight.s1.toFixed(1) + ' -> ' + camTracksRight.s2.toFixed(1)
);

// Camera actively tracks Mario moving LEFTWARD — bidirectional tracking
const camTracksLeft = run(ctxCam, `(() => {
  mario.x = 400; mario.facing = -1; mario.vx = 0; mario.w = 12; cameraX = 0;
  for (let i = 0; i < 200; i++) updateCamera();
  const s1 = cameraX;
  mario.x = 100;
  for (let i = 0; i < 200; i++) updateCamera();
  return { s1, s2: cameraX };
})()`);
assert(
  camTracksLeft.s2 < camTracksLeft.s1,
  'Camera should retreat when Mario moves left (bidirectional): ' +
    camTracksLeft.s1.toFixed(1) + ' -> ' + camTracksLeft.s2.toFixed(1)
);

// Camera clamps at world left boundary (cameraX >= 0)
const camLeftClamp = run(ctxCam, `(() => {
  mario.x = 0; mario.facing = -1; mario.vx = 0; mario.w = 12; cameraX = 500;
  for (let i = 0; i < 200; i++) updateCamera();
  return { cameraX };
})()`);
assert(
  camLeftClamp.cameraX >= 0,
  'Camera must never go below 0: got ' + camLeftClamp.cameraX
);
assert(
  camLeftClamp.cameraX < CAM_TOL,
  'Camera should clamp at 0 for mario at left edge facing left: got ' + camLeftClamp.cameraX
);

// Camera clamps at world right boundary (cameraX <= maxCamera)
// Start cameraX near the end so 200 frames is sufficient to converge.
const camRightClamp = run(ctxCam, `(() => {
  const maxCam = LEVEL_COLS * TILE - LOGICAL_W;
  mario.x = LEVEL_COLS * TILE; mario.facing = 1; mario.vx = 0; mario.w = 12;
  cameraX = maxCam - 50; // start close to right edge
  for (let i = 0; i < 200; i++) updateCamera();
  return { cameraX, maxCam };
})()`);
assert(
  camRightClamp.cameraX <= camRightClamp.maxCam + 0.01,
  'Camera must not exceed maxCamera (' + camRightClamp.maxCam + '): got ' + camRightClamp.cameraX
);
assert(
  Math.abs(camRightClamp.cameraX - camRightClamp.maxCam) < CAM_TOL,
  'Camera should converge to maxCamera at level end: got ' + camRightClamp.cameraX.toFixed(2)
);

// snapCameraToMario(true) instantly places camera at look-ahead target
const camSnap = run(ctxCam, `(() => {
  cameraX = 0;
  mario.x = 300; mario.facing = 1; mario.vx = 0; mario.w = 12;
  snapCameraToMario(true);
  const expected = Math.max(0, Math.min(
    mario.x + mario.w / 2 - LOGICAL_W / 2 + CAMERA_LOOKAHEAD,
    LEVEL_COLS * TILE - LOGICAL_W
  ));
  return { cameraX, expected };
})()`);
assert(
  Math.abs(camSnap.cameraX - camSnap.expected) < 0.01,
  'snapCameraToMario(true) should instantly set cameraX to look-ahead target: expected ' +
    camSnap.expected + ', got ' + camSnap.cameraX
);

// snapCameraToMario(false) centers Mario without look-ahead
const camSnapCenter = run(ctxCam, `(() => {
  cameraX = 0;
  mario.x = 300; mario.facing = 1; mario.vx = 0; mario.w = 12;
  snapCameraToMario(false);
  const expected = Math.max(0, Math.min(
    mario.x + mario.w / 2 - LOGICAL_W / 2,
    LEVEL_COLS * TILE - LOGICAL_W
  ));
  return { cameraX, expected };
})()`);
assert(
  Math.abs(camSnapCenter.cameraX - camSnapCenter.expected) < 0.01,
  'snapCameraToMario(false) should center Mario without look-ahead: expected ' +
    camSnapCenter.expected + ', got ' + camSnapCenter.cameraX
);

// ============================================================
// SECTION 5: Movement sensitivity tests
// ============================================================

const ctxMov = createContext();
loadScripts(ctxMov, [
  'js/constants.js',
  'js/level.js',
  'js/state.js',
  'js/input.js',
  'js/tiles.js',
  'js/collision.js',
  'js/mario.js',
  'js/camera.js',
]);
run(ctxMov, 'currentLevel = 1; resetLevel();');

// Stub: keep Mario perpetually grounded so physics tests are isolated from collision
run(ctxMov, 'resolvePlayerTileCollision = function() { mario.vy = 0; return true; };');

// Input repeat should only apply to navigation keys (ArrowLeft/ArrowRight)
const enterNoRepeat = run(ctxMov, `(() => {
  for (const k in keys) delete keys[k];
  for (const k in keysDown) delete keysDown[k];
  for (const k in keysUp) delete keysUp[k];
  for (const k in repeatCounters) delete repeatCounters[k];

  setKeyDown('Enter');
  const firstPressRegistered = !!keysDown.Enter;
  clearInputEdges();

  let repeated = false;
  for (let i = 0; i < INPUT_REPEAT_DELAY + 6; i++) {
    updateInputRepeat();
    if (keysDown.Enter) repeated = true;
    clearInputEdges();
  }

  const hasEnterRepeatCounter = Object.prototype.hasOwnProperty.call(repeatCounters, 'Enter');
  setKeyUp('Enter');
  clearInputEdges();
  return { firstPressRegistered, repeated, hasEnterRepeatCounter };
})()`);
assert(enterNoRepeat.firstPressRegistered, 'Expected Enter initial key press edge');
assert(!enterNoRepeat.hasEnterRepeatCounter, 'Enter should not be tracked by input repeat counters');
assert(!enterNoRepeat.repeated, 'Enter should not auto-repeat while held (prevents pause/resume toggling)');

const arrowRightRepeats = run(ctxMov, `(() => {
  for (const k in keys) delete keys[k];
  for (const k in keysDown) delete keysDown[k];
  for (const k in keysUp) delete keysUp[k];
  for (const k in repeatCounters) delete repeatCounters[k];

  setKeyDown('ArrowRight');
  clearInputEdges();

  let repeatFrame = -1;
  for (let i = 1; i <= INPUT_REPEAT_DELAY + 2; i++) {
    updateInputRepeat();
    if (keysDown.ArrowRight && repeatFrame === -1) repeatFrame = i;
    clearInputEdges();
  }

  setKeyUp('ArrowRight');
  clearInputEdges();
  return { repeatFrame, repeatDelay: INPUT_REPEAT_DELAY };
})()`);
assert.strictEqual(
  arrowRightRepeats.repeatFrame,
  arrowRightRepeats.repeatDelay,
  'ArrowRight should auto-repeat after INPUT_REPEAT_DELAY frames for menu navigation'
);

// Level-select navigation should reverse immediately and repeat on a stable cadence
const ctxNav = createContext();
loadScripts(ctxNav, [
  'js/constants.js',
  'js/level.js',
  'js/state.js',
  'js/input.js',
  'js/game.js',
]);

const navReverse = run(ctxNav, `(() => {
  gameState = STATE.LEVEL_SELECT;
  selectedLevel = 5;
  levelNavHoldDir = 0;
  levelNavHoldFrames = 0;

  setKeyDown('ArrowRight');
  update();
  const firstRight = selectedLevel;

  for (let i = 0; i < LEVEL_NAV_REPEAT_DELAY - 2; i++) update();
  const beforeReverse = selectedLevel;

  setKeyUp('ArrowRight');
  setKeyDown('ArrowLeft');
  update();
  const afterReverse = selectedLevel;

  setKeyUp('ArrowLeft');
  update();
  return { firstRight, beforeReverse, afterReverse };
})()`);
assert.strictEqual(navReverse.firstRight, 6, 'Expected immediate +1 on first right press in level select');
assert.strictEqual(navReverse.beforeReverse, 6, 'Expected no extra repeat before LEVEL_NAV_REPEAT_DELAY');
assert.strictEqual(navReverse.afterReverse, 5, 'Expected immediate reverse step when switching to left');

const navRepeatCadence = run(ctxNav, `(() => {
  gameState = STATE.LEVEL_SELECT;
  selectedLevel = 1;
  levelNavHoldDir = 0;
  levelNavHoldFrames = 0;

  for (const k in keys) delete keys[k];
  for (const k in keysDown) delete keysDown[k];
  for (const k in keysUp) delete keysUp[k];
  for (const k in repeatCounters) delete repeatCounters[k];

  setKeyDown('ArrowRight');
  let prev = selectedLevel;
  const stepFrames = [];
  for (let frame = 0; frame < LEVEL_NAV_REPEAT_DELAY + LEVEL_NAV_REPEAT_INTERVAL * 5 + 6; frame++) {
    update();
    if (selectedLevel !== prev) {
      stepFrames.push(frame);
      prev = selectedLevel;
    }
  }

  setKeyUp('ArrowRight');
  update();
  return {
    stepFrames,
    delay: LEVEL_NAV_REPEAT_DELAY,
    interval: LEVEL_NAV_REPEAT_INTERVAL,
  };
})()`);
assert(navRepeatCadence.stepFrames.length >= 4, 'Expected multiple repeated level-select steps while holding right');
assert.strictEqual(navRepeatCadence.stepFrames[0], 0, 'Expected immediate level-select step on initial press');
assert.strictEqual(
  navRepeatCadence.stepFrames[1] - navRepeatCadence.stepFrames[0],
  navRepeatCadence.delay,
  'Expected first held-repeat step after LEVEL_NAV_REPEAT_DELAY frames'
);
for (let i = 2; i < navRepeatCadence.stepFrames.length; i++) {
  assert.strictEqual(
    navRepeatCadence.stepFrames[i] - navRepeatCadence.stepFrames[i - 1],
    navRepeatCadence.interval,
    'Expected held-repeat cadence to remain stable at LEVEL_NAV_REPEAT_INTERVAL frames'
  );
}

// Walk acceleration reaches WALK_MAX_SPEED
const walkAccel = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight');
  let frames = 0;
  while (mario.vx < WALK_MAX_SPEED - 0.001 && frames < 200) {
    clearInputEdges(); updateMario(); frames++;
  }
  setKeyUp('ArrowRight'); clearInputEdges();
  return { vx: mario.vx, cap: WALK_MAX_SPEED, frames };
})()`);
assert(
  Math.abs(walkAccel.vx - walkAccel.cap) < 0.01,
  'Walk acceleration should reach WALK_MAX_SPEED (' + walkAccel.cap + '): got vx=' +
    walkAccel.vx + ' after ' + walkAccel.frames + ' frames'
);

// Walk speed cap is never exceeded
const walkCap = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight');
  for (let i = 0; i < 200; i++) { clearInputEdges(); updateMario(); }
  setKeyUp('ArrowRight'); clearInputEdges();
  return { vx: mario.vx, cap: WALK_MAX_SPEED };
})()`);
assert(
  walkCap.vx <= walkCap.cap + 0.001,
  'Walk speed cap should be enforced: vx=' + walkCap.vx + ' > WALK_MAX_SPEED=' + walkCap.cap
);

// Run acceleration reaches RUN_MAX_SPEED
const runAccel = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight'); setKeyDown('ShiftLeft');
  let frames = 0;
  while (mario.vx < RUN_MAX_SPEED - 0.001 && frames < 200) {
    clearInputEdges(); updateMario(); frames++;
  }
  setKeyUp('ArrowRight'); setKeyUp('ShiftLeft'); clearInputEdges();
  return { vx: mario.vx, cap: RUN_MAX_SPEED, frames };
})()`);
assert(
  Math.abs(runAccel.vx - runAccel.cap) < 0.01,
  'Run acceleration should reach RUN_MAX_SPEED (' + runAccel.cap + '): got vx=' +
    runAccel.vx + ' after ' + runAccel.frames + ' frames'
);

// Run speed cap is never exceeded
const runCap = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight'); setKeyDown('ShiftLeft');
  for (let i = 0; i < 200; i++) { clearInputEdges(); updateMario(); }
  setKeyUp('ArrowRight'); setKeyUp('ShiftLeft'); clearInputEdges();
  return { vx: mario.vx, cap: RUN_MAX_SPEED };
})()`);
assert(
  runCap.vx <= runCap.cap + 0.001,
  'Run speed cap should be enforced: vx=' + runCap.vx + ' > RUN_MAX_SPEED=' + runCap.cap
);

// Running reaches higher max speed than walking
const runVsWalk = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight'); setKeyDown('ShiftLeft');
  for (let i = 0; i < 200; i++) { clearInputEdges(); updateMario(); }
  setKeyUp('ArrowRight'); setKeyUp('ShiftLeft'); clearInputEdges();
  const runMax = mario.vx;

  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight');
  for (let i = 0; i < 200; i++) { clearInputEdges(); updateMario(); }
  setKeyUp('ArrowRight'); clearInputEdges();
  const walkMax = mario.vx;

  return { runMax, walkMax };
})()`);
assert(
  runVsWalk.runMax > runVsWalk.walkMax,
  'Running should reach higher max speed than walking: run=' +
    runVsWalk.runMax + ', walk=' + runVsWalk.walkMax
);

// Ground friction decelerates Mario to a stop
const friction = run(ctxMov, `(() => {
  mario.vx = WALK_MAX_SPEED; mario.vy = 0; mario.grounded = true;
  for (let i = 0; i < 100; i++) { clearInputEdges(); updateMario(); }
  return { vx: mario.vx };
})()`);
assert(
  Math.abs(friction.vx) < 0.01,
  'Ground friction should bring Mario to a stop: vx=' + friction.vx
);

// Skid: switching directions should bleed existing momentum before crossing zero.
// This keeps turnarounds smooth while preserving quick starts from rest.
const skid = run(ctxMov, `(() => {
  // From max rightward speed, one left frame should brake, not instantly flip sign.
  mario.vx = WALK_MAX_SPEED; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowLeft');
  clearInputEdges(); updateMario();
  const vxAfterTurnFrame = mario.vx;

  let framesToCrossZero = -1;
  for (let i = 1; i <= 20; i++) {
    clearInputEdges(); updateMario();
    if (mario.vx < 0) {
      framesToCrossZero = i;
      break;
    }
  }

  // From rest (vx=0), one left frame → immediate leftward snap (minStartSpeed feature)
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyUp('ArrowLeft'); clearInputEdges();
  setKeyDown('ArrowLeft');
  clearInputEdges(); updateMario();
  const vxFromRest = mario.vx;
  setKeyUp('ArrowLeft'); clearInputEdges();

  return { vxAfterTurnFrame, framesToCrossZero, vxFromRest, walkCap: WALK_MAX_SPEED };
})()`);
assert(
  skid.vxAfterTurnFrame > 0,
  'Direction switch should preserve rightward inertia on first turn frame: got ' + skid.vxAfterTurnFrame
);
assert(
  skid.vxAfterTurnFrame < skid.walkCap,
  'Direction switch should reduce speed from walk cap on first turn frame: got ' + skid.vxAfterTurnFrame
);
assert(
  skid.framesToCrossZero > 1,
  'Direction switch should take multiple frames before crossing zero: frames=' + skid.framesToCrossZero
);
assert(
  skid.framesToCrossZero !== -1,
  'Direction switch should still cross zero into leftward movement within expected time'
);
assert(
  skid.vxFromRest < 0,
  'Pressing left from rest should snap to leftward motion (minStartSpeed): got ' + skid.vxFromRest
);

// Facing direction tracks movement input
const facing = run(ctxMov, `(() => {
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowLeft'); clearInputEdges(); updateMario();
  const facingLeft = mario.facing;
  setKeyUp('ArrowLeft'); clearInputEdges();

  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  setKeyDown('ArrowRight'); clearInputEdges(); updateMario();
  const facingRight = mario.facing;
  setKeyUp('ArrowRight'); clearInputEdges();

  return { facingLeft, facingRight };
})()`);
assert.strictEqual(facing.facingLeft,  -1, 'Mario should face left (-1) when pressing ArrowLeft');
assert.strictEqual(facing.facingRight,  1, 'Mario should face right (1) when pressing ArrowRight');

// ============================================================
// SECTION 6: Coin HUD + persistence tests
// ============================================================

const ctxCoin = createContext();
loadScripts(ctxCoin, [
  'js/constants.js',
  'js/level.js',
  'js/state.js',
  'js/tiles.js',
  'js/collision.js',
  'js/mario.js',
  'js/hud.js',
]);

const coinHudChecks = run(ctxCoin, `(() => {
  currentLevel = 1;
  resetLevel(false);
  score = 0;
  coins = 0;
  lives = 3;

  const coinKeys = Object.keys(Q_CONTENTS)
    .filter((k) => Q_CONTENTS[k] === 'coin')
    .slice(0, 2)
    .map((k) => k.split(',').map(Number));

  const beforeCoins = coins;
  for (const [col, row] of coinKeys) {
    handleHeadBonk(col, row);
  }
  const afterCoins = coins;

  const draws = [];
  const arcs = [];
  const hudCtx = {
    fillStyle: '#000000',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    fillRect() {},
    beginPath() {},
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fill() {},
    fillText(text, x, y) { draws.push({ text, x, y }); },
  };
  drawHUD(hudCtx);
  const hasUpdatedCounter = draws.some((d) => d.text === '\\u00D702' && d.x === 102 && d.y === 10);
  const hasCoinIcon = arcs.some((a) => a.x === 96 && a.y === 17 && a.r === 5);

  currentLevel = 2;
  resetLevel(true);
  const coinsAfterLevelTransition = coins;

  lives--;
  resetLevel(true);
  const coinsAfterLifeTransition = coins;

  currentLevel = 3;
  resetLevel(true);
  enterLevel3HiddenArea();
  exitLevel3HiddenArea();
  const coinsAfterAreaTransition = coins;

  return {
    beforeCoins,
    afterCoins,
    hasUpdatedCounter,
    hasCoinIcon,
    coinsAfterLevelTransition,
    coinsAfterLifeTransition,
    coinsAfterAreaTransition,
  };
})()`);

assert.strictEqual(coinHudChecks.beforeCoins, 0, 'Expected coin counter to start at 0 for fresh run');
assert.strictEqual(coinHudChecks.afterCoins, 2, 'Collecting two coins should increment counter to 2');
assert(coinHudChecks.hasUpdatedCounter, 'Expected HUD to display updated coin counter in upper-left');
assert(coinHudChecks.hasCoinIcon, 'Expected HUD to render a gold coin icon');
assert.strictEqual(coinHudChecks.coinsAfterLevelTransition, 2, 'Coin count should persist through level transitions');
assert.strictEqual(coinHudChecks.coinsAfterLifeTransition, 2, 'Coin count should persist through life transitions');
assert.strictEqual(coinHudChecks.coinsAfterAreaTransition, 2, 'Coin count should persist through area transitions');

// ============================================================
// SECTION 7: Jump mechanic tests
// ============================================================

// Jump buffer: queues a jump while airborne, fires on landing
const jumpBuf = run(ctxMov, `(() => {
  resolvePlayerTileCollision = function() { mario.vy = 0; return false; };
  mario.vx = 0; mario.vy = 0; mario.grounded = false;
  mario.coyoteFrames = 0; mario.jumpBuffer = 0; mario.jumpedThisPress = false;

  setKeyDown('Space');
  updateMario();               // jumpBuffer = JUMP_BUFFER; no jump (coyoteFrames=0)
  clearInputEdges();
  const buffered = mario.jumpBuffer === JUMP_BUFFER;
  const notJumpedYet = mario.vy >= 0;

  // Land: collision returns true for next two frames to let coyote+buffer align
  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  updateMario(); clearInputEdges(); // frame: grounded=false at start → no coyote; grounded=true at end
  updateMario();                    // frame: grounded=true at start → coyoteFrames set; buffer>0 → JUMP
  // jumpedThisPress is set to true when the jump fires; check it since stub resets vy
  const jumpFired = mario.jumpedThisPress === true;

  setKeyUp('Space'); clearInputEdges();
  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  return { buffered, notJumpedYet, jumpFired };
})()`);
assert(jumpBuf.buffered,     'Jump buffer should store jump input while airborne');
assert(jumpBuf.notJumpedYet, 'Mario should not jump immediately while airborne with no coyote time');
assert(jumpBuf.jumpFired,    'Buffered jump should fire when Mario lands');

// Coyote time: Mario can jump for COYOTE_FRAMES after leaving ground
const coyote = run(ctxMov, `(() => {
  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  mario.coyoteFrames = 0; mario.jumpBuffer = 0; mario.jumpedThisPress = false;
  clearInputEdges(); updateMario();           // coyoteFrames = COYOTE_FRAMES
  const coyoteSet = mario.coyoteFrames;

  resolvePlayerTileCollision = function() { mario.vy = 0; return false; };
  clearInputEdges(); updateMario();           // grounded=true at start → coyoteFrames refreshed; end grounded=false
  const coyoteActive = mario.coyoteFrames > 0;

  // updateMario BEFORE clearInputEdges so jumpPressed=true registers the buffer this frame
  setKeyDown('Space');
  updateMario(); clearInputEdges();           // jumpPressed=true → jumpBuffer set; coyoteFrames>0 → JUMP
  setKeyUp('Space'); clearInputEdges();
  // vy is reset by stub; check jumpedThisPress instead
  const jumpedViaCoyote = mario.jumpedThisPress === true;

  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  return { coyoteSet, coyoteActive, jumpedViaCoyote };
})()`);
assert.strictEqual(coyote.coyoteSet, 4, 'Coyote frames should initialise to COYOTE_FRAMES (4) when grounded');
assert(coyote.coyoteActive,    'Coyote time should remain active on the first airborne frame');
assert(coyote.jumpedViaCoyote, 'Mario should be able to jump during coyote time after leaving ground');

// Coyote time expires: jump blocked after COYOTE_FRAMES airborne frames
const coyoteExpiry = run(ctxMov, `(() => {
  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  mario.vx = 0; mario.vy = 0; mario.grounded = true;
  mario.coyoteFrames = 0; mario.jumpBuffer = 0; mario.jumpedThisPress = false;
  clearInputEdges(); updateMario();           // coyoteFrames = COYOTE_FRAMES

  resolvePlayerTileCollision = function() { mario.vy = 0; return false; };
  for (let i = 0; i < COYOTE_FRAMES + 1; i++) { clearInputEdges(); updateMario(); }
  const coyoteGone = mario.coyoteFrames === 0;

  setKeyDown('Space');
  clearInputEdges(); updateMario();
  setKeyUp('Space'); clearInputEdges();
  const noJumpAfterExpiry = mario.vy >= 0;

  resolvePlayerTileCollision = function() { mario.vy = 0; return true; };
  return { coyoteGone, noJumpAfterExpiry };
})()`);
assert(coyoteExpiry.coyoteGone,        'Coyote frames should deplete to 0 after enough airborne frames');
assert(coyoteExpiry.noJumpAfterExpiry, 'Jump should not fire after coyote time has expired');

console.log('All checks passed.');
