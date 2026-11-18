// Save in localStorage: money, missions done, shells, best stats. Autosaves on
// mission complete; the title screen offers Continue when a save exists.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return {
      money: Math.max(0, s.money | 0),
      missionsDone: Math.min(6, Math.max(0, s.missionsDone | 0)),
      shells: Array.isArray(s.shells) ? s.shells.filter((n) => typeof n === 'number') : [],
      best: { earned: Math.max(0, (s.best && s.best.earned) | 0), busted: Math.max(0, (s.best && s.best.busted) | 0) },
    };
  } catch (e) { return null; }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: data.money | 0, missionsDone: data.missionsDone | 0,
      shells: data.shells.slice(0, 10),
      best: { earned: data.best.earned | 0, busted: data.best.busted | 0 },
    }));
  } catch (e) { /* storage off: the run lasts this visit only */ }
}

/** A fresh save: New Game uses this so the shape lives in one place. */
export function defaultSave() {
  return { money: 0, missionsDone: 0, shells: [], best: { earned: 0, busted: 0 } };
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
