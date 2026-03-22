// ============================================================
// INPUT — keyboard + touch / mobile
// ============================================================

const keys    = {};
const keysDown = {};
const keysUp   = {};

window.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keysDown[e.code] = true;
    AudioSystem.init();
  }
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code]  = false;
  keysUp[e.code] = true;
});

function isDown(codes)    { return codes.some(c => keys[c]); }
function isPressed(codes) { return codes.some(c => keysDown[c]); }

function clearInputEdges() {
  for (const k in keysDown) delete keysDown[k];
  for (const k in keysUp)   delete keysUp[k];
}

// ---- Canvas resize (mobile viewport) ----

function resizeCanvas() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const controlsH = isTouchDevice ? 130 : 0;
  const availW = window.innerWidth;
  const availH = window.innerHeight - controlsH;
  const scale  = Math.min(availW / CANVAS_W, availH / CANVAS_H);
  canvas.style.width  = Math.floor(CANVAS_W * scale) + 'px';
  canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
resizeCanvas();

// ---- Touch controls ----

// Maps button id → key codes to activate
const TOUCH_BTN_MAP = {
  'btn-left':  ['ArrowLeft'],
  'btn-right': ['ArrowRight'],
  'btn-a':     ['Space'],
  'btn-b':     ['ShiftLeft', 'KeyX'],
  'btn-start': ['Enter'],
};

// touchIdentifier → btnId currently pressed by that finger
const activeTouches = new Map();

function touchPressKey(code) {
  if (!keys[code]) {
    keysDown[code] = true;
    AudioSystem.init();
  }
  keys[code] = true;
}

function touchReleaseKey(code) {
  keys[code]  = false;
  keysUp[code] = true;
}

function activateBtn(btnId) {
  const codes = TOUCH_BTN_MAP[btnId];
  if (!codes) return;
  codes.forEach(touchPressKey);
  document.getElementById(btnId)?.classList.add('pressed');
}

function deactivateBtn(btnId) {
  const codes = TOUCH_BTN_MAP[btnId];
  if (!codes) return;
  const stillHeld = [...activeTouches.values()].includes(btnId);
  if (!stillHeld) {
    codes.forEach(touchReleaseKey);
    document.getElementById(btnId)?.classList.remove('pressed');
  }
}

function btnIdFromTouch(touch) {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el) return null;
  const btn = el.closest && el.closest('[id^="btn-"]');
  return btn ? btn.id : null;
}

function onTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const btnId = btnIdFromTouch(t);
    if (btnId && TOUCH_BTN_MAP[btnId]) {
      activeTouches.set(t.identifier, btnId);
      activateBtn(btnId);
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const btnId = activeTouches.get(t.identifier);
    if (btnId) {
      activeTouches.delete(t.identifier);
      deactivateBtn(btnId);
    }
  }
}

function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const prevBtnId = activeTouches.get(t.identifier);
    const newBtnId  = btnIdFromTouch(t);
    if (prevBtnId === newBtnId) continue;
    if (prevBtnId) {
      activeTouches.delete(t.identifier);
      deactivateBtn(prevBtnId);
    }
    if (newBtnId && TOUCH_BTN_MAP[newBtnId]) {
      activeTouches.set(t.identifier, newBtnId);
      activateBtn(newBtnId);
    }
  }
}

(function initTouchControls() {
  const tc = document.getElementById('touch-controls');
  if (!tc) return;
  const opts = { passive: false };
  tc.addEventListener('touchstart',  onTouchStart, opts);
  tc.addEventListener('touchend',    onTouchEnd,   opts);
  tc.addEventListener('touchcancel', onTouchEnd,   opts);
  tc.addEventListener('touchmove',   onTouchMove,  opts);

  const cv = document.getElementById('gameCanvas');
  if (cv) {
    cv.addEventListener('touchstart', e => e.preventDefault(), opts);
    cv.addEventListener('touchmove',  e => e.preventDefault(), opts);
  }
})();
