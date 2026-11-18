// SOLMARA's HUD: plain DOM over the canvas — health, money, wanted stars,
// weapon and ammo, the current objective, the in-game clock, a fading message
// feed and the speedometer. Updated only when a value actually changes.

export function createHud(document) {
  const el = {
    root: document.getElementById('hud'),
    health: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    money: document.getElementById('money'),
    stars: document.getElementById('stars'),
    clock: document.getElementById('clock'),
    weapon: document.getElementById('weapon'),
    objective: document.getElementById('objective'),
    objectiveDist: document.getElementById('objective-dist'),
    feed: document.getElementById('feed'),
    speed: document.getElementById('speed'),
    shells: document.getElementById('shells'),
    banner: document.getElementById('banner'),
  };
  const last = { health: -1, money: -1, stars: -1, clock: '', weapon: '', objective: '', speed: -1, shells: -1 };
  let bannerTimer = 0;

  /** Show or hide the whole HUD (hidden on the title screen). */
  function setVisible(visible) {
    el.root.style.display = visible ? '' : 'none';
  }

  function setStars(n) {
    const full = Math.floor(n);
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < full ? '★' : '☆';
    el.stars.textContent = out;
    el.stars.classList.toggle('hot', full >= 3);
  }

  function update(s) {
    const hp = Math.round(s.health);
    if (hp !== last.health) {
      last.health = hp;
      el.health.style.width = `${hp}%`;
      el.healthText.textContent = `${hp}`;
      el.health.classList.toggle('low', hp <= 25);
    }
    if (s.money !== last.money) {
      last.money = s.money;
      el.money.textContent = `$${s.money.toLocaleString('en-US')}`;
    }
    const stars = Math.floor(s.stars + 0.001);
    if (stars !== last.stars) {
      last.stars = stars;
      setStars(s.stars);
    }
    const mins = Math.floor(s.clockMin) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    const clockStr = `${hh}:${mm}`;
    if (clockStr !== last.clock) {
      last.clock = clockStr;
      el.clock.textContent = clockStr;
    }
    const weaponStr = s.driving ? `${s.carLabel}` : `Pistol ${s.ammo}/${s.reserve}`;
    if (weaponStr !== last.weapon) {
      last.weapon = weaponStr;
      el.weapon.textContent = weaponStr;
    }
    if (s.objective !== last.objective) {
      last.objective = s.objective;
      el.objective.textContent = s.objective;
    }
    el.objectiveDist.textContent = s.objectiveDist != null ? `${Math.round(s.objectiveDist)}m` : '';
    const kmh = s.driving ? Math.round(Math.abs(s.speed) * 3.6) : 0;
    if (kmh !== last.speed) {
      last.speed = kmh;
      el.speed.textContent = s.driving ? `${kmh} km/h` : '';
    }
    if (s.shells !== last.shells) {
      last.shells = s.shells;
      el.shells.textContent = `◆ ${s.shells}/10`;
    }
  }

  function feed(message, good = false) {
    const line = document.createElement('div');
    line.className = `feed-line${good ? ' good' : ''}`;
    line.textContent = message;
    el.feed.prepend(line);
    while (el.feed.children.length > 4) el.feed.removeChild(el.feed.lastChild);
    setTimeout(() => {
      if (line.parentNode) line.classList.add('fade');
    }, 3200);
    setTimeout(() => {
      if (line.parentNode) line.parentNode.removeChild(line);
    }, 4200);
  }

  function banner(message, sub = '') {
    el.banner.querySelector('.banner-title').textContent = message;
    el.banner.querySelector('.banner-sub').textContent = sub;
    el.banner.classList.add('show');
    bannerTimer = 2.6;
  }

  function step(dt) {
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('show');
    }
  }

  return { update, feed, banner, step, setVisible };
}
