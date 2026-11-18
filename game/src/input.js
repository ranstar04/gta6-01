// Keyboard + mouse + pointer lock. Action flags are read by the player / vehicle code.
import { KEYS } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    pointerLocked: false,
    shootPressed: false,
    // One-shot flags, consumed by the loop each frame.
    jumpQueued: false,
    enterQueued: false,
    punchQueued: false,
    pauseQueued: false,
    muteQueued: false,
    anyKey() {
      return keys.size > 0;
    },
    axis(name) {
      const [neg, pos] = name === 'moveX' ? ['left', 'right'] : ['up', 'down'];
      let v = 0;
      if (KEYS[neg].some((k) => keys.has(k))) v -= 1;
      if (KEYS[pos].some((k) => keys.has(k))) v += 1;
      return v;
    },
    sprint() {
      return KEYS.sprint.some((k) => keys.has(k));
    },
    handbrake() {
      return KEYS.handbrake.some((k) => keys.has(k));
    },
    lockPointer() {
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) { /* headless: ignore */ }
      }
    },
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    endFrame() {
      input.mouseDX = 0;
      input.mouseDY = 0;
      input.jumpQueued = false;
      input.enterQueued = false;
      input.punchQueued = false;
      input.pauseQueued = false;
      input.muteQueued = false;
      input.shootPressed = false;
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    // Arrow keys drive too (KEYS maps them); stop the page scrolling under the game.
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (KEYS.jump.includes(e.code)) input.jumpQueued = true;
    if (KEYS.enterCar.includes(e.code)) input.enterQueued = true;
    if (KEYS.punch.includes(e.code)) input.punchQueued = true;
    if (KEYS.pause.includes(e.code)) input.pauseQueued = true;
    if (KEYS.mute.includes(e.code)) input.muteQueued = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.shootPressed = true;
      input.lockPointer();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (input.pointerLocked) {
      input.mouseDX += e.movementX || 0;
      input.mouseDY += e.movementY || 0;
    }
  });
  return input;
}
