// SOLMARA's save: money, missions done, shells collected and best stats in
// localStorage. Saves are plain JSON; a corrupt or missing save just starts
// a fresh game — never a crash.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: typeof data.money === 'number' ? data.money : null,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      shells: Array.isArray(data.shells) ? data.shells : [],
      bestMoney: typeof data.bestMoney === 'number' ? data.bestMoney : 0,
      kills: typeof data.kills === 'number' ? data.kills : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}

/** True when a save exists (checked without parsing it). */
export function saveExists() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
