// Keyboard, mouse and pointer lock for SOLMARA. Held keys are read as a live
// state object; one-shot presses (enter car, reload, punch, pause, mute) are queued
// as flags and consumed once, so a press between two frames is never lost and
// never counted twice. Mouse movement orbits the camera while pointer-locked;
// clicking the canvas locks the pointer (first click also wakes the audio).

import { KEYS } from './config.js';

const ALL_KEYS = new Set([
  ...KEYS.forward, ...KEYS.back, ...KEYS.left, ...KEYS.right,
  ...KEYS.sprint, ...KEYS.jump, ...KEYS.enter, ...KEYS.reload,
  ...KEYS.melee, ...KEYS.pause, ...KEYS.mute,
]);

export const ACT_ENTER = 1;
export const ACT_RELOAD = 2;
export const ACT_MELEE = 4;
export const ACT_PAUSE = 8;
export const ACT_MUTE = 16;
export const ACT_JUMP = 32;

export function createInput(canvas, onFirstGesture) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let gestureDone = false;

  function gesture() {
    if (gestureDone) return;
    gestureDone = true;
    if (onFirstGesture) onFirstGesture();
  }

  function queue(code) {
    if (KEYS.enter.includes(code)) actions |= ACT_ENTER;
    else if (KEYS.reload.includes(code)) actions |= ACT_RELOAD;
    else if (KEYS.melee.includes(code)) actions |= ACT_MELEE;
    else if (KEYS.pause.includes(code)) actions |= ACT_PAUSE;
    else if (KEYS.mute.includes(code)) actions |= ACT_MUTE;
    else if (KEYS.jump.includes(code)) actions |= ACT_JUMP;
  }

  window.addEventListener('keydown', (event) => {
    if (!ALL_KEYS.has(event.code)) return;
    gesture();
    event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    queue(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  // A right-click menu would steal the game: never open one over the canvas.
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  canvas.addEventListener('mousedown', (event) => {
    gesture();
    if (event.button === 0) mouseDown = true;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });

  function down(list) {
    return list.some((code) => held.has(code));
  }

  return {
    /** Forward/back/strafe as -1/0/1, from the keys currently held. */
    move() {
      return {
        f: (down(KEYS.forward) ? 1 : 0) - (down(KEYS.back) ? 1 : 0),
        s: (down(KEYS.right) ? 1 : 0) - (down(KEYS.left) ? 1 : 0),
        sprint: down(KEYS.sprint),
        jumpHeld: down(KEYS.jump),
      };
    },
    /** Mouse delta since the last call (pointer-locked only), then cleared. */
    look() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    mouseDown() {
      return mouseDown;
    },
    locked() {
      return document.pointerLockElement === canvas;
    },
    /** Let go of every key (used when the game pauses or the screen changes). */
    reset() {
      held.clear();
      actions = 0;
      mouseDX = 0;
      mouseDY = 0;
      mouseDown = false;
    },
    /** One-shot presses since the last call, as ACT_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
