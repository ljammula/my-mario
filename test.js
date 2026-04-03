#!/usr/bin/env node

const fs = require('fs');
const assert = require('assert');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const sourceRender = read('js/render.js');
const docsRender = read('docs/js/render.js');

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

assert(
  /drawHUD\(ctx\);\s*\n\s*drawControlsHelpOverlay\(ctx\);/.test(sourceRender),
  'Expected controls help overlay to render after HUD in render()'
);

assert.strictEqual(
  sourceRender,
  docsRender,
  'Expected docs/js/render.js to stay in sync with js/render.js'
);

console.log('Overlay checks passed.');
