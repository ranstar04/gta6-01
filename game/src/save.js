// localStorage save: money, finished missions, found shells, best stats.
// Everything is guarded — a blocked or corrupt store never crashes the game.
const KEY = 'solmara-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      money: typeof data.money === 'number' && Number.isFinite(data.money) ? data.money : 250,
      done: Array.isArray(data.done) ? data.done : [],
      shells: Array.isArray(data.shells) ? data.shells : [],
      taxis: typeof data.taxis === 'number' ? data.taxis : 0,
      bestMoney: typeof data.bestMoney === 'number' ? data.bestMoney : 0,
    };
  } catch (err) {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: Number.isFinite(state.money) ? Math.round(state.money) : 250,
      done: state.missionsDone,
      shells: [...state.shellsGot],
      taxis: state.taxisDone,
      bestMoney: Math.max(state.bestMoney || 0, Math.round(state.money)),
    }));
  } catch (err) {
    // storage full or blocked: the session keeps playing, nothing is lost in-memory
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
}
