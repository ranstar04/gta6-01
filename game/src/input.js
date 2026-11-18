// Keyboard + mouse input: held keys, one-shot presses, pointer-lock look deltas.
// The game reads this once per frame; endFrame() clears the edge-triggered state.
import { KEYS } from './config.js';

export function createInput(canvas) {
  const held = new Set();
  const pressedSet = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;
  let clicked = false;

  const GAME_KEYS = new Set([
    ...Object.values(KEYS).flat(),
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ]);

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressedSet.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) clicked = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function anyHeld(codes) {
    for (const c of codes) if (held.has(c)) return true;
    return false;
  }

  return {
    down: (code) => held.has(code),
    pressed: (code) => pressedSet.has(code),
    consumeClick: () => { const c = clicked; clicked = false; return c; },
    consumeMouse: () => { const r = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return r; },
    isLocked: () => locked,
    requestLock: () => { try { canvas.requestPointerLock(); } catch (err) { /* headless: ignore */ } },
    exitLock: () => { try { document.exitPointerLock(); } catch (err) { /* ignore */ } },
    // -1..1 strafe / forward from WASD or arrows.
    moveAxis() {
      const x = (anyHeld(KEYS.right) ? 1 : 0) - (anyHeld(KEYS.left) ? 1 : 0);
      const y = (anyHeld(KEYS.forward) ? 1 : 0) - (anyHeld(KEYS.back) ? 1 : 0);
      return { x, y };
    },
    sprinting: () => anyHeld(KEYS.sprint),
    endFrame() { pressedSet.clear(); },
  };
}
