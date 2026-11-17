// HUD: health bar, money, wanted stars, weapon + ammo, mission objective, in-game
// clock, message feed, speedometer while driving. DOM only — no canvas text.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const moneyEl = el('money');
  const starsEl = el('stars');
  const ammoEl = el('ammo');
  const objectiveEl = el('objective');
  const clockEl = el('clock');
  const feedEl = el('feed');
  const speedEl = el('speed');
  const speedNum = el('speed-num');
  const shellEl = el('shells');
  const hintEl = el('hint');

  const feedItems = [];
  let lastMoney = -1;
  let lastStars = -1;
  let lastAmmo = -1;
  let lastHealth = -1;
  let lastObjective = '';
  let lastShells = -1;

  function setStars(n) {
    if (n === lastStars) return;
    lastStars = n;
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    starsEl.textContent = s;
    starsEl.classList.toggle('hot', n >= 3);
  }

  return {
    feed(msg) {
      feedItems.unshift(msg);
      if (feedItems.length > 4) feedItems.pop();
      feedEl.innerHTML = feedItems.map((m) => `<div>${m}</div>`).join('');
    },
    setHint(text) {
      if (hintEl.textContent !== text) hintEl.textContent = text;
    },
    update(g) {
      const hp = Math.max(0, Math.round(g.player.health));
      if (hp !== lastHealth) {
        lastHealth = hp;
        healthFill.style.width = `${hp}%`;
        healthText.textContent = `${hp}`;
        healthFill.classList.toggle('low', hp < 30);
      }
      if (g.money !== lastMoney) {
        lastMoney = g.money;
        moneyEl.textContent = `$${g.money.toLocaleString('en-US')}`;
      }
      setStars(g.police.stars());
      const ammoStr = `${g.ammo.ammo} / ${g.ammo.reserve}`;
      if (ammoStr !== lastAmmo) {
        lastAmmo = ammoStr;
        ammoEl.textContent = `🔫 ${ammoStr}`;
      }
      const obj = g.missions.objectiveText();
      if (obj !== lastObjective) {
        lastObjective = obj;
        objectiveEl.textContent = obj;
      }
      const hours = 16 + Math.floor(g.clock / 3600);
      const mins = Math.floor((g.clock % 3600) / 60);
      clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      if (g.shellsFound !== lastShells) {
        lastShells = g.shellsFound;
        shellEl.textContent = `🐚 ${g.shellsFound}/10`;
      }
      if (g.player.car) {
        speedEl.style.display = 'block';
        speedNum.textContent = Math.round(Math.abs(g.player.car.speed) * 2.4);
      } else {
        speedEl.style.display = 'none';
      }
    },
  };
}
