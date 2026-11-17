// Save / load in localStorage: money, missions done, shells found, best stats.
// Everything is guarded — headless runs and private mode must never throw.
const KEY = 'solmara-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      shells: Array.isArray(data.shells) ? data.shells : [],
      bestMoney: typeof data.bestMoney === 'number' ? data.bestMoney : 0,
      totalEarned: typeof data.totalEarned === 'number' ? data.totalEarned : 0,
      playSeconds: typeof data.playSeconds === 'number' ? data.playSeconds : 0,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
