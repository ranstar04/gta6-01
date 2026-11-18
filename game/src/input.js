// Keyboard + mouse + pointer lock. Held keys give a steering vector; one-shot
// presses (confirm, pause, interact, punch) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
import { KEYS } from './config.js';

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_INTERACT = 4;
export const ACT_PUNCH = 8;
export const ACT_MUTE = 16;

function has(keys, code) { return keys.indexOf(code) !== -1; }

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) { if (has(KEYS.jump, event.code) || has(KEYS.handbrake, event.code)) event.preventDefault(); return; }
    held.add(event.code);
    if (has(KEYS.confirm, event.code)) actions |= ACT_CONFIRM;
    else if (has(KEYS.pause, event.code)) actions |= ACT_PAUSE;
    else if (has(KEYS.interact, event.code)) actions |= ACT_INTERACT;
    else if (has(KEYS.punch, event.code)) actions |= ACT_PUNCH;
    else if (has(KEYS.mute, event.code)) actions |= ACT_MUTE;
    if (has(KEYS.up, event.code) || has(KEYS.down, event.code) || has(KEYS.left, event.code) || has(KEYS.right, event.code) || has(KEYS.jump, event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      if (!locked && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (e) { /* headless: no lock */ } }
    }
  });
  window.addEventListener('mouseup', (event) => { if (event.button === 0) mouseDown = false; });
  canvas.addEventListener('click', () => { actions |= ACT_CONFIRM; });

  function axis(neg, pos) {
    let v = 0;
    for (const k of neg) if (held.has(k)) v -= 1;
    for (const k of pos) if (held.has(k)) v += 1;
    return v;
  }

  return {
    /** -1..1 forward/back, -1..1 left/right, from held keys. */
    move() { return { f: axis(KEYS.down, KEYS.up), s: axis(KEYS.left, KEYS.right) }; },
    sprint() { return KEYS.sprint.some((k) => held.has(k)); },
    jump() { return KEYS.jump.some((k) => held.has(k)); },
    handbrake() { return KEYS.handbrake.some((k) => held.has(k)); },
    shooting() { return mouseDown; },
    takeMouse() { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeActions() { const t = actions; actions = 0; return t; },
    locked() { return locked; },
    /** True while any key is held — for "press any key" prompts. */
    anyKey() { return held.size > 0; },
  };
}
