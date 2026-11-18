// HUD: health, money, wanted stars, weapon, objective, clock, speed, message
// feed, banner, and every screen (title / pause / busted / wasted / passed /
// kingpin / how-to / missions). All DOM lives in index.html.
import { MISSIONS } from './config.js';

export function createHud(S, cb) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), healthFill: $('health-fill'), healthNum: $('health-num'),
    money: $('money'), shells: $('shells'), stars: $('stars'), clock: $('clock'),
    weapon: $('weapon'), ammo: $('ammo'), objective: $('objective'),
    speed: $('speed'), feed: $('feed'), banner: $('banner'),
    bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    crosshair: $('crosshair'), damage: $('damage-flash'),
    title: $('title-screen'), pause: $('pause-screen'),
    busted: $('busted-screen'), wasted: $('wasted-screen'),
    kingpin: $('kingpin-screen'), howto: $('howto-screen'),
    missions: $('missions-screen'), missionList: $('mission-list'),
    bustedText: $('busted-text'), wastedText: $('wasted-text'),
  };
  const feedItems = [];
  let bannerT = 0;

  function showOnly(name) {
    for (const key of ['title', 'pause', 'busted', 'wasted', 'kingpin', 'howto', 'missions']) {
      el[key].classList.toggle('hidden', key !== name);
    }
    el.hud.classList.toggle('hidden', name === 'title' || name === 'howto' || name === 'missions');
  }

  function feed(msg) {
    feedItems.push({ msg, ttl: 5 });
    if (feedItems.length > 5) feedItems.shift();
    renderFeed();
  }
  function renderFeed() {
    el.feed.innerHTML = feedItems.map((f) => `<div class="feed-item">${f.msg}</div>`).join('');
  }
  function banner(title, sub = '', ttl = 3) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub;
    el.banner.classList.remove('hidden');
    bannerT = ttl;
  }
  function setObjective(text) {
    el.objective.textContent = text;
  }
  function showGame() { showOnly(null); }
  function showTitle() {
    showOnly('title');
    $('btn-continue').classList.toggle('hidden', S.missionsDone.length === 0 && S.money <= 250);
  }
  function showPause() { showOnly('pause'); }
  function showBusted(fine) {
    el.bustedText.textContent = `The Solmara PD caught you. Fine: $${fine}. Your car stayed where it was.`;
    showOnly('busted');
  }
  function showWasted(fine) {
    el.wastedText.textContent = `You woke up at St. Marina Hospital. Bill: $${fine}.`;
    showOnly('wasted');
  }
  function showKingpin() {
    showOnly('kingpin');
  }
  function showHowTo() { showOnly('howto'); }
  function showMissions() {
    el.missionList.innerHTML = MISSIONS.map((m) => {
      const done = S.missionsDone.includes(m.id);
      return `<div class="mission-row ${done ? 'done' : ''}">
        <span class="mission-check">${done ? '✓' : '○'}</span>
        <span class="mission-name">${m.name}</span>
        <span class="mission-reward">$${m.reward}</span>
        <div class="mission-brief">${m.brief}</div>
      </div>`;
    }).join('');
    showOnly('missions');
  }

  // Wire the buttons.
  $('btn-new').addEventListener('click', () => cb.onNewGame());
  $('btn-continue').addEventListener('click', () => cb.onContinue());
  $('btn-howto').addEventListener('click', () => showHowTo());
  $('btn-missions').addEventListener('click', () => showMissions());
  $('btn-close-howto').addEventListener('click', () => showTitle());
  $('btn-close-missions').addEventListener('click', () => showTitle());
  $('btn-resume').addEventListener('click', () => cb.onResume());
  $('btn-restart-mission').addEventListener('click', () => cb.onRestartMission());
  $('btn-save').addEventListener('click', () => { cb.onSave(); feed('Game saved.'); });
  $('btn-quit').addEventListener('click', () => cb.onQuitToTitle());
  $('btn-busted-ok').addEventListener('click', () => cb.onBustedOk());
  $('btn-wasted-ok').addEventListener('click', () => cb.onWastedOk());
  $('btn-kingpin-ok').addEventListener('click', () => cb.onKingpinOk());

  function update(dt) {
    // Health bar.
    const hp = Math.max(0, Math.round(S.health));
    el.healthFill.style.width = `${hp}%`;
    el.healthFill.style.background = hp > 50 ? '#2ecc40' : hp > 25 ? '#f2c14e' : '#e74c3c';
    el.healthNum.textContent = hp;
    el.money.textContent = `$${Math.round(S.money).toLocaleString('en-US')}`;
    el.shells.textContent = `◆ ${S.shellsGot.size}/10`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
    el.stars.textContent = stars;
    el.stars.classList.toggle('hot', S.wanted > 0);
    const hh = Math.floor(S.dayTime) % 24;
    const mm = Math.floor((S.dayTime % 1) * 60);
    el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    el.weapon.textContent = S.playerCar ? (S.playerCar.spec.name) : 'Pistol';
    el.ammo.textContent = S.playerCar ? '' : `${S.ammo} / ${S.reserveAmmo}`;
    el.speed.textContent = S.playerCar ? `${Math.round(S.speedKmh)} km/h` : '';
    el.speed.classList.toggle('hidden', !S.playerCar);
    el.crosshair.classList.toggle('hidden', !!S.playerCar || S.mode !== 'play');
    // Damage flash fades fast.
    const sinceHit = S.time - S.lastDamageAt;
    el.damage.style.opacity = sinceHit < 0.4 ? String(0.55 * (1 - sinceHit / 0.4)) : '0';
    // Feed expiry.
    let changed = false;
    for (let i = feedItems.length - 1; i >= 0; i--) {
      feedItems[i].ttl -= dt;
      if (feedItems[i].ttl <= 0) { feedItems.splice(i, 1); changed = true; }
    }
    if (changed) renderFeed();
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) el.banner.classList.add('hidden');
    }
  }

  return {
    feed, banner, setObjective,
    showGame, showTitle, showPause, showBusted, showWasted, showKingpin,
    showHowTo, showMissions, update,
  };
}
