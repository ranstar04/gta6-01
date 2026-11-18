// HUD: DOM overlay — health bar, money, wanted stars, weapon + ammo, objective,
// in-game clock, message feed, speedometer. Text that holds a number is rebuilt
// only when the number changes. Hidden on the title screen.
const FEED_MAX = 5;
const FEED_TTL = 6;

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const moneyEl = el('money');
  const starsEl = el('stars');
  const ammoEl = el('ammo');
  const objectiveEl = el('objective');
  const clockEl = el('clock');
  const districtEl = el('district');
  const speedEl = el('speed');
  const feedEl = el('feed');
  const feedItems = [];
  let last = { health: -1, money: -1, stars: -1, ammo: '', objective: '', clock: '', district: '', speed: -1 };

  function feed(text) {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.textContent = text;
    feedEl.prepend(div);
    feedItems.push({ div, ttl: FEED_TTL });
    while (feedItems.length > FEED_MAX) {
      const old = feedItems.shift();
      old.div.remove();
    }
  }

  return {
    feed,
    show(inGame) { hud.style.display = inGame ? 'block' : 'none'; },
    objective(text) { if (text !== last.objective) { last.objective = text; objectiveEl.textContent = text; } },
    update(dt, G) {
      for (let i = feedItems.length - 1; i >= 0; i -= 1) {
        feedItems[i].ttl -= dt;
        if (feedItems[i].ttl <= 0) {
          feedItems[i].div.remove();
          feedItems.splice(i, 1);
        }
      }
      const hp = Math.round(G.player.state.health);
      if (hp !== last.health) {
        last.health = hp;
        healthFill.style.width = `${hp}%`;
        healthFill.style.background = hp > 50 ? '#35d05a' : hp > 25 ? '#f2c94c' : '#ff3b30';
        healthText.textContent = `${hp}`;
      }
      if (G.money !== last.money) { last.money = G.money; moneyEl.textContent = `$${G.money.toLocaleString('en-US')}`; }
      const stars = Math.round(G.police.wanted());
      if (stars !== last.stars) {
        last.stars = stars;
        starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
        starsEl.style.color = stars > 0 ? '#ffd21f' : 'rgba(255,255,255,0.35)';
      }
      const ammoText = G.playerCar ? '' : `PISTOL ${G.combat.ammo()} / ${G.combat.reloading() ? 'RELOADING' : '12'}`;
      if (ammoText !== last.ammo) { last.ammo = ammoText; ammoEl.textContent = ammoText; }
      const mins = Math.floor(G.clockMinutes) % (24 * 60);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      const clockText = `${hh}:${mm}`;
      if (clockText !== last.clock) { last.clock = clockText; clockEl.textContent = clockText; }
      const dist = G.world.district(G.player.state.pos.x, G.player.state.pos.z);
      if (dist !== last.district) { last.district = dist; districtEl.textContent = dist; }
      const kmh = G.playerCar ? Math.round(Math.abs(G.playerCar.speed) * 3.6) : -1;
      if (kmh !== last.speed) {
        last.speed = kmh;
        speedEl.textContent = kmh >= 0 ? `${kmh} km/h` : '';
        speedEl.style.display = kmh >= 0 ? 'block' : 'none';
      }
    },
  };
}
