// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, busted, wasted, mission-passed, kingpin. ?seed=N fixes the world;
// ?shot=chase|street|mission|title stages that scene and sets window.__shotReady.
import * as THREE from 'three';
import { STEP, MISSIONS, SHELLS, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_PUNCH, ACT_MUTE } from './input.js';
import { loadSave, writeSave } from './save.js';
import { createRenderer } from './render.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createCar, driveCar, carCameraTarget } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
window.addEventListener('error', (event) => { window.__shotError = String(event.message || event.error || 'page error'); });

const rng = createRandom(seed);
const renderer = createRenderer(canvas);
const scene = renderer.scene;
const city = buildCity(scene, rng);
const world = createWorld(rng, city.spawns);
const input = createInput(canvas);
const audio = createAudio();
const effects = createEffects(scene);
const player = createPlayer(scene);
const traffic = createTraffic(scene, world, rng, 14);
const pedestrians = createPedestrians(scene, world, rng, 24);
const police = createPolice(scene, rng);
const combat = createCombat(scene, rng);
const missions = createMissions(scene, rng);
const hud = createHud();
const minimap = createMinimap();

const saveData = loadSave() || { money: 0, missionsDone: 0, shells: [], best: { earned: 0, busted: 0 } };

// The shared game state every system reads. Systems are created above and wired
// here; nothing above reads G at construction time.
const G = {
  rng, render: renderer, city, world, input, audio, effects, player,
  traffic, pedestrians, police, combat, missions, hud, minimap,
  saveData, save: { write: writeSave },
  cars: [], playerCar: null, missionCar: null,
  money: saveData.money, collectedShells: saveData.shells.slice(),
  stats: { earned: saveData.best.earned, busted: saveData.best.busted },
  clockMinutes: 16 * 60 + 30,
  screen: 'title', scripted: null, shotState: null,
  events: null, // set below
};
for (const c of traffic.cars) G.cars.push(c);

function spawnParkedCar(type, x, z, heading) {
  const car = createCar(type, x, z, heading || 0);
  car.driver = 'parked';
  scene.add(car.group);
  car.group.position.copy(car.pos);
  G.cars.push(car);
  return car;
}
G.spawnParkedCar = spawnParkedCar;

function nearestCar(maxDist) {
  const pp = player.state.pos;
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.pos.x - pp.x, car.pos.z - pp.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car, silent) {
  const wasParked = car.driver === 'parked' || car.driver === 'traffic';
  if (wasParked && !silent) {
    // Stealing in view of police or pedestrians raises wanted; the casino
    // show car is always hot — Kross's guards call it in at 3 stars.
    const seen = police.wanted() > 0 || pedestrians.peds.some((p) => !p.down && Math.hypot(p.pos.x - player.state.pos.x, p.pos.z - player.state.pos.z) < 25);
    if (car === G.missionCar && car.type === 'vesper') police.addWanted(3, G);
    else if (seen) police.addWanted(WANTED.stealSeen, G);
    if (car.driver === 'traffic') {
      pedestrians.scareAll(car.pos.x, car.pos.z, 12);
      hud.feed('You jacked the car — the driver fled!');
    }
  }
  G.playerCar = car;
  car.driver = 'player';
  player.state.onFoot = false;
  player.state.pos.copy(car.pos);
  player.state.group.visible = false;
  audio.ensure();
  hud.feed(`Driving the ${car.def.name}.`);
}
G.enterCar = enterCar;

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.state.pos.set(car.pos.x + side.x * 2.4, 0, car.pos.z + side.z * 2.4);
  player.state.group.position.copy(player.state.pos);
  player.state.group.visible = true;
  player.state.onFoot = true;
  player.state.heading = car.heading;
  car.driver = 'parked';
  car.speed = 0;
  G.playerCar = null;
}
G.exitCar = exitCar;

function showScreen(name) {
  for (const id of ['title-screen', 'pause-screen', 'busted-screen', 'wasted-screen', 'passed-screen', 'kingpin-screen', 'help-panel', 'missions-panel']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  if (name) {
    const el = document.getElementById(`${name}-screen`);
    if (el) el.style.display = 'block';
  }
  hud.show(name === 'play');
}

G.events = {
  busted(msg) {
    if (G.screen !== 'play') return;
    G.screen = 'busted';
    const fine = Math.min(G.money, 200);
    G.money -= fine;
    G.stats.busted += 1;
    writeSave({ money: G.money, missionsDone: missions.index(), shells: G.collectedShells, best: G.stats });
    document.getElementById('busted-text').textContent = `${msg} Fine $${fine}.`;
    audio.fail();
    audio.siren(false);
    showScreen('busted');
  },
  wasted() {
    if (G.screen !== 'play') return;
    G.screen = 'wasted';
    const bill = Math.min(G.money, 100);
    G.money -= bill;
    writeSave({ money: G.money, missionsDone: missions.index(), shells: G.collectedShells, best: G.stats });
    document.getElementById('wasted-text').textContent = `Hospital bill $${bill}. Mama Izzy is not pleased.`;
    audio.wasted();
    audio.siren(false);
    showScreen('wasted');
  },
  kingpin() {
    G.screen = 'kingpin';
    document.getElementById('kingpin-text').textContent = `All six jobs done. $${G.stats.earned.toLocaleString('en-US')} earned in Solmara. The city is yours, Rook.`;
    audio.jingle();
    showScreen('kingpin');
  },
  enemyDown() {
    missions.onEnemyDown(G);
    hud.feed('Enforcer down.');
  },
};

function respawn(at) {
  police.clearWanted(G);
  combat.clearEnemies();
  player.reset(at.x, at.z, 0);
  if (G.playerCar) { G.playerCar.driver = 'parked'; G.playerCar.speed = 0; G.playerCar = null; }
  G.screen = 'play';
  showScreen('play');
  hud.feed('Back on the streets of Solmara.');
}

function resetWorld(resetSeed) {
  // Parked cars: clear and respawn from the city's fixed list.
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const c = G.cars[i];
    if (c.driver === 'parked' || c.driver === 'player' || c.driver === 'police') {
      scene.remove(c.group);
      G.cars.splice(i, 1);
    }
  }
  for (const s of city.carSpawns) spawnParkedCar(s.type, s.x, s.z);
  G.missionCar = null;
  G.playerCar = null;
  traffic.reset();
  pedestrians.reset();
  police.clearWanted(G);
  combat.clearEnemies();
  combat.clearPickups();
  player.reset(city.spawns.playerStart.x, city.spawns.playerStart.z, city.spawns.playerStart.heading);
  G.money = saveData.money;
  G.collectedShells = saveData.shells.slice();
  G.stats = { earned: saveData.best.earned, busted: saveData.best.busted };
  G.clockMinutes = 16 * 60 + 30;
  missions.initShells(city.shellSpots, G.collectedShells);
  missions.start(G, Math.min(6, saveData.missionsDone));
  // A few pickups around the warehouse and diner so the world feels lived-in.
  combat.spawnPickup('health', -180, -150);
  combat.spawnPickup('ammo', -120, -60);
  combat.spawnPickup('cash', 60, 60);
}
G.resetWorld = resetWorld;

function stepGame(dt) {
  G.clockMinutes += dt * 1; // 1 game minute per real second
  const mv = G.scripted || input.move();
  const shooting = G.scripted ? !!G.scripted.shoot : input.shooting();
  if (G.screen === 'title') {
    // Attract mode: the city lives while the menu sits on top.
    traffic.update(dt, G);
    pedestrians.update(dt, G);
    combat.update(dt, G);
    effects.update(dt);
    renderer.update(dt);
    city.update(dt, G.clockMinutes);
    return;
  }
  if (G.screen !== 'play') return;

  // Interact: enter / exit a car.
  if (!G.scripted) {
    const acts = input.takeActions();
    if (acts & ACT_MUTE) { const m = audio.toggleMute(); hud.feed(m ? 'Muted.' : 'Sound on.'); }
    if (acts & ACT_PAUSE) { G.screen = 'paused'; showScreen('paused'); audio.engine(0, false); return; }
    if (acts & ACT_INTERACT) {
      if (G.playerCar) exitCar();
      else {
        const car = nearestCar(3.6);
        if (car) enterCar(car, false);
      }
    }
    if (acts & ACT_PUNCH && !G.playerCar) combat.punch(G);
  }

  if (G.playerCar) {
    const car = G.playerCar;
    player.state.pos.copy(car.pos);
    const smoke = driveCar(car, dt, mv.f, mv.s, input.handbrake(), city.colliders, G.cars);
    if (smoke) effects.smoke(car.pos.x, 1.2, car.pos.z, 1);
    if (input.handbrake() && Math.abs(car.speed) > 12) {
      effects.skid(car.pos.x - Math.sin(car.heading) * 1.5, car.pos.z - Math.cos(car.heading) * 1.5, car.heading);
    }
    audio.engine(Math.abs(car.speed) / car.def.maxSpeed, true);
    audio.siren(police.wanted() > 0);
    // Running over pedestrians is a crime.
    for (const p of pedestrians.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
      if (d < 2.4 && Math.abs(car.speed) > 6) {
        p.down = true;
        p.group.rotation.x = -Math.PI / 2;
        p.group.position.y = 0.4;
        police.addWanted(WANTED.hitPed, G);
        effects.burst(p.pos.x, 1, p.pos.z, 8, 0xff3b30, 3, 2);
        hud.feed('You hit a pedestrian! The cops saw that.');
      }
    }
  } else {
    player.update(dt, input, G);
    audio.engine(0, false);
    audio.siren(police.wanted() > 0);
    if (shooting) combat.shoot(G);
    // Traffic can hit the player on foot.
    for (const c of G.cars) {
      if (Math.abs(c.speed) < 5) continue;
      const d = Math.hypot(c.pos.x - player.state.pos.x, c.pos.z - player.state.pos.z);
      if (d < 2.2) {
        if (player.damage(25)) {
          effects.burst(player.state.pos.x, 1.2, player.state.pos.z, 8, 0xff3b30, 4, 2);
          effects.addShake(0.35);
          audio.punch();
        }
      }
    }
  }

  traffic.update(dt, G);
  pedestrians.update(dt, G);
  police.update(dt, G);
  combat.update(dt, G);
  missions.update(dt, G);
  effects.update(dt);
  renderer.update(dt);
  city.update(dt, G.clockMinutes);
  audio.update(dt, !!G.playerCar);

  // WASTED / BUSTED checks.
  if (player.state.health <= 0) {
    if (police.wanted() >= 2) G.events.busted('You went down with the heat on you.');
    else G.events.wasted();
  }

  // Camera: smoothed chase cam. The chase shot uses the FRONT camera looking
  // back (override lives in vehicles.js, gated on shotState.name === 'chase').
  const shake = effects.shakeAmount();
  const shX = shake ? (Math.random() - 0.5) * shake : 0;
  const shY = shake ? (Math.random() - 0.5) * shake : 0;
  let target;
  if (G.playerCar) {
    const views = carCameraTarget(G.playerCar);
    const view = (G.shotState && G.shotState.name === 'chase') ? views.front : views.behind;
    target = view;
  } else {
    target = player.cameraTarget();
  }
  cameraPos.lerp(new THREE.Vector3(target.pos.x + shX, target.pos.y + shY, target.pos.z), 1 - Math.exp(-dt * 10));
  cameraLook.lerp(target.look, 1 - Math.exp(-dt * 12));
  renderer.placeCamera(cameraPos, cameraLook);

  hud.update(dt, G);
  minimap.draw(G);
}
G.stepGame = stepGame;

const cameraPos = new THREE.Vector3(150, 55, 190);
const cameraLook = new THREE.Vector3(0, 0, 0);

function startGame(fresh) {
  audio.ensure();
  if (fresh) {
    saveData.money = 0; saveData.missionsDone = 0; saveData.shells = [];
    saveData.best = { earned: 0, busted: 0 };
    writeSave({ money: 0, missionsDone: 0, shells: [], best: saveData.best });
  }
  resetWorld(seed);
  G.screen = 'play';
  showScreen('play');
  hud.banner(fresh ? 'WELCOME TO SOLMARA' : 'WELCOME BACK, ROOK');
  hud.feed(fresh ? 'New game — welcome back to Solmara, Rook.' : `Welcome back, Rook. $${G.money.toLocaleString('en-US')} in your pocket.`);
}

function runShot(name) {
  const sceneInfo = stageShot(name, G);
  showScreen(sceneInfo.screen === 'title' ? 'title' : null);
  if (sceneInfo.screen === 'title') {
    document.getElementById('title-screen').style.display = 'block';
    hud.show(false);
  } else {
    hud.show(true);
    hud.update(0, G);
    minimap.draw(G);
  }
  let painted = 0;
  function paint() {
    renderer.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  G.screen = 'title';
  showScreen('title');
  document.getElementById('continue-btn').style.display = saveData.missionsDone > 0 || saveData.money > 0 ? 'block' : 'none';
  document.getElementById('continue-btn').textContent = saveData.missionsDone >= 6
    ? `Continue — SOLMARA KINGPIN ($${saveData.money})`
    : saveData.missionsDone > 0
      ? `Continue — ${MISSIONS[saveData.missionsDone].name} ($${saveData.money})`
      : 'Continue';
  document.getElementById('new-btn').addEventListener('click', () => startGame(true));
  document.getElementById('continue-btn').addEventListener('click', () => startGame(false));
  document.getElementById('how-btn').addEventListener('click', () => {
    const h = document.getElementById('help-panel');
    h.style.display = h.style.display === 'block' ? 'none' : 'block';
  });
  document.getElementById('missions-btn').addEventListener('click', () => {
    const m = document.getElementById('missions-panel');
    if (m.style.display === 'block') { m.style.display = 'none'; return; }
    m.innerHTML = '<h2>Missions</h2>' + MISSIONS.map((mm, i) => `<p>${i < saveData.missionsDone ? '✓' : i === saveData.missionsDone ? '▶' : '·'} <b>${mm.name}</b> — ${mm.brief} <i>+$${mm.reward}</i></p>`).join('') + `<p>Golden shells: ${saveData.shells.length}/${SHELLS.total}</p>`;
    m.style.display = 'block';
  });
  document.getElementById('resume-btn').addEventListener('click', () => { G.screen = 'play'; showScreen('play'); });
  document.getElementById('restart-btn').addEventListener('click', () => { missions.start(G, missions.index()); G.screen = 'play'; showScreen('play'); });
  document.getElementById('save-btn').addEventListener('click', () => { writeSave({ money: G.money, missionsDone: missions.index(), shells: G.collectedShells, best: G.stats }); hud.feed('Game saved.'); });
  document.getElementById('quit-btn').addEventListener('click', () => { G.screen = 'title'; showScreen('title'); });
  document.getElementById('busted-btn').addEventListener('click', () => respawn(city.spawns.safehouse));
  document.getElementById('wasted-btn').addEventListener('click', () => respawn(city.spawns.playerStart));
  document.getElementById('kingpin-btn').addEventListener('click', () => { G.screen = 'title'; showScreen('title'); });
  document.getElementById('passed-btn').addEventListener('click', () => { G.screen = 'play'; showScreen('play'); });

  let accumulator = 0;
  let last = performance.now();
  let orbitT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (G.screen === 'title') {
      orbitT += 0.016;
      while (accumulator >= STEP) { stepGame(STEP); accumulator -= STEP; }
      const a = orbitT * 0.05;
      cameraPos.set(Math.cos(a) * 260, 95, Math.sin(a) * 260);
      cameraLook.set(0, 10, 0);
      renderer.placeCamera(cameraPos, cameraLook);
      renderer.render();
      return;
    }
    if (G.screen === 'paused') {
      const acts = input.takeActions();
      if (acts & ACT_PAUSE || acts & ACT_CONFIRM) { G.screen = 'play'; showScreen('play'); }
      renderer.render();
      return;
    }
    while (accumulator >= STEP && G.screen === 'play') {
      stepGame(STEP);
      accumulator -= STEP;
    }
    if (G.screen === 'play') accumulator = 0;
    else accumulator = 0;
    renderer.render();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') { G.screen = 'paused'; showScreen('paused'); }
  });
  status.textContent = 'SOLMARA. Press Enter or click to start.';
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
