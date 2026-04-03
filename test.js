#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const sourceRender = read('js/render.js');

assert(
  sourceRender.includes('function drawControlsHelpOverlay(ctx)'),
  'Expected drawControlsHelpOverlay to be defined in js/render.js'
);

for (const label of ['CONTROLS', '\\u2190/\\u2192  MOVE', 'SPACE/Z  JUMP', 'ENTER  START/PAUSE']) {
  assert(
    sourceRender.includes(label),
    `Expected controls label "${label}" in js/render.js`
  );
}

const hudCallPos = sourceRender.indexOf('drawHUD(ctx);');
const overlayCallPos = sourceRender.indexOf('drawControlsHelpOverlay(ctx);');
assert(
  hudCallPos !== -1 && overlayCallPos !== -1 && hudCallPos < overlayCallPos,
  'Expected controls help overlay to render after HUD in render()'
);
assert(
  /STATE\.(PLAYING|PAUSED).*drawControlsHelpOverlay/s.test(sourceRender),
  'Expected controls help overlay to be guarded by STATE.PLAYING or STATE.PAUSED'
);

const sourceLevel = read('js/level.js');
assert(sourceLevel.includes('function buildLevel3Main()'), 'Expected buildLevel3Main() in js/level.js');
assert(sourceLevel.includes('function buildLevel3Hidden()'), 'Expected buildLevel3Hidden() in js/level.js');
assert(sourceLevel.includes('Q_CONTENTS_L3_MAIN'), 'Expected Q_CONTENTS_L3_MAIN in js/level.js');
assert(sourceLevel.includes('Q_CONTENTS_L3_HIDDEN'), 'Expected Q_CONTENTS_L3_HIDDEN in js/level.js');

const sourceState = read('js/state.js');
for (const token of ['currentArea', 'enterLevel3HiddenArea', 'exitLevel3HiddenArea', 'pipeTransitionLock']) {
  assert(sourceState.includes(token), `Expected "${token}" in js/state.js`);
}

const sourceMario = read('js/mario.js');
assert(sourceMario.includes('tryLevel3PipeTransition'), 'Expected tryLevel3PipeTransition() in js/mario.js');

const sourceEnemies = read('js/enemies.js');
assert(sourceEnemies.includes('g.edgeAware'), 'Expected edge-aware goomba handling in js/enemies.js');

const sourceConstants = read('js/constants.js');
assert(sourceConstants.includes("PLATFORM:    'M'"), 'Expected PLATFORM tile constant in js/constants.js');
assert(sourceConstants.includes("'M'"), 'Expected M tile to be included in solid tile set');

const sourceGame = read('js/game.js');
assert(sourceGame.includes('getMusicTrack()'), 'Expected game.js to use getMusicTrack() for music selection');
assert(sourceGame.includes('currentLevel = (currentLevel % 3) + 1'), 'Expected game.js to rotate through 3 levels');

const sourceDir = 'js';
const docsDir = 'docs/js';
const sourceFiles = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.js')).sort();
const docsFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith('.js')).sort();

assert.deepStrictEqual(
  sourceFiles,
  docsFiles,
  'Expected docs/js and js to contain the same .js files'
);

for (const file of sourceFiles) {
  const sourcePath = path.join(sourceDir, file);
  const docsPath = path.join(docsDir, file);
  assert.strictEqual(
    read(sourcePath),
    read(docsPath),
    `Expected ${docsPath} to stay in sync with ${sourcePath}`
  );
}

console.log('All checks passed.');
