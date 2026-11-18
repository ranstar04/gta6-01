// SOLMARA — boot and the one loop. Fixed 1/60 s steps, screens (title / play / pause /
// busted / wasted / mission-passed / kingpin), enter-exit-steal, taxi fares, shells,
// garage repaint, shooting, save. ?shot=chase|street|mission|title stages a scene.
import * as THREE from 'three';
import { MISSIONS, SHELLS, SPAWNS, TUNE } from './config.js';
import { mulberry32, clamp, dist2D } from './random.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_MISSION, SCREEN_KINGPIN } from './render.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { createPlayer, stepPlayer, updateCamera } from './player.js';
import { driveCar, nearestCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

// Surface page errors for the screenshot driver / probes (headless validation).
window.__shotError = '';
window.addEventListener('error', (e) => {
  window.__shotError += `${e.message} @${e.filename}:${e.lineno}; `;
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const minimapCanvas = document.getElementById('minimap');
window.__solmara = null; // set after the game state exists (debug hook)

// ---- Build the world -------------------------------------------------------
const renderer = createRenderer(canvas);
const scene = renderer.scene;
const camera = renderer.camera;
const rng = mulberry32(seed);
const city = buildCity(scene, seed);
const world = createWorld(city);
const input = createInput(canvas);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const minimap = createMinimap(minimapCanvas);
const player = createPlayer(scene, SPAWNS.player.x, SPAWNS.player.z);
const traffic = createTraffic(scene, world, seed);
const pedestrians = createPedestrians(scene, world, seed);
const police = createPolice(scene, world);
const combat = createCombat(scene, effects, audio);

// Shared game state — every system reads this one object.
const saved = loadSave();
const game = {
  player, traffic, pedestrians, police, combat, world, city, scene,
  money: saved ? saved.money : 0,
  totalEarned: saved ? saved.totalEarned : 0,
  missionsDone: saved ? saved.missionsDone : [],
  shellsFound: saved ? saved.shells.length : 0,
  shellsCollected: new Set(saved ? saved.shells : []),
  ammo: { ammo: TUNE.pistolAmmo, reserve: TUNE.pistolReserve },
  clock: 0, // seconds since 16:00 in-game
  screen: SCREEN_TITLE,
  playSeconds: saved ? saved.playSeconds : 0,
  taxi: null, // { ped, destX, destZ, startX, startZ }
  feed: (msg) => hud.feed(msg),
  autosave,
};
const missions = createMissions(scene, game, audio);
game.missions = missions;
game.hud = hud;
game.minimap = minimap;
game.effects = effects;
game.audio = audio;
window.__solmara = game;

function autosave() {
  writeSave({
    money: game.money,
    missionsDone: game.missionsDone,
    shells: [...game.shellsCollected],
    bestMoney: Math.max(game.money, saved ? saved.bestMoney : 0),
    totalEarned: game.totalEarned,
    playSeconds: Math.floor(game.playSeconds),
  });
}

// Shell pickups (golden, floating, bobbing).
const shellMeshes = [];
for (let i = 0; i < SHELLS.length; i++) {
  if (game.shellsCollected.has(i)) continue;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xaa7700, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.25 }),
  );
  mesh.scale.y = 0.7;
  mesh.position.set(SHELLS[i].x, 1, SHELLS[i].z);
  scene.add(mesh);
  shellMeshes.push({ mesh, index: i, x: SHELLS[i].x, z: SHELLS[i].z, bob: i });
}

// Taxi flag: a pedestrian with a raised hand hails a Corto. Boarding starts a fare.
let taxiTimer = 0;

function announce(message) {
  status.textContent = message;
}

function startGame(fresh) {
  if (fresh) {
    game.money = 0;
    game.missionsDone = [];
    game.shellsCollected = new Set();
    game.totalEarned = 0;
    game.playSeconds = 0;
    clearSave();
    for (const s of shellMeshes) scene.remove(s.mesh);
    shellMeshes.length = 0;
    for (let i = 0; i < SHELLS.length; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xaa7700, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.25 }),
      );
      mesh.scale.y = 0.7;
      mesh.position.set(SHELLS[i].x, 1, SHELLS[i].z);
      scene.add(mesh);
      shellMeshes.push({ mesh, index: i, x: SHELLS[i].x, z: SHELLS[i].z, bob: i });
    }
  }
  player.health = TUNE.playerHealth;
  player.x = SPAWNS.player.x;
  player.z = SPAWNS.player.z;
  player.y = 0;
  player.car = null;
  game.ammo = { ammo: TUNE.pistolAmmo, reserve: TUNE.pistolReserve };
  police.clearWanted();
  missions.reset();
  game.screen = SCREEN_PLAY;
  announce('Playing Solmara. Reach the Gull & Anchor diner.');
  hud.feed('Welcome back to Solmara, Rook.');
  hud.feed('Mission: Homecoming — reach the Gull & Anchor diner.');
}

// ---- Enter / exit / steal ---------------------------------------------------
function tryEnterCar() {
  const allCars = traffic.all().concat(police.cruisers);
  const car = nearestCar(allCars, player.x, player.z, 4.5);
  if (!car) return;
  if (car.driver === 'police') {
    hud.feed('That cruiser is occupied. Find another ride.');
    return;
  }
  const wasParked = car.driver === null;
  const hadDriver = car.driver === 'traffic';
  if (hadDriver) {
    // Jack the driver: they flee on foot, witnesses raise the heat.
    car.driver = 'player';
    hud.feed(`You jacked the ${car.name}!`);
    if (police.stars() >= 0 && (police.cruisers.length > 0 || Math.random() < 0.7)) {
      police.addWanted(TUNE.wantedPerSteal);
      hud.feed('Witnesses saw that! Wanted level up.');
    }
    audio.crash();
  } else if (wasParked) {
    car.driver = 'player';
    hud.feed(`You took the ${car.name}.`);
    if (car.type === 'police') police.addWanted(1);
  }
  player.car = car;
  player.mesh.visible = false;
  audio.unlock();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  player.car = null;
  const bx = car.x - Math.sin(car.yaw) * 3;
  const bz = car.z - Math.cos(car.yaw) * 3;
  const fixed = world.collide(bx, bz, 0.55);
  player.x = fixed.x;
  player.z = fixed.z;
  player.y = 0;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  player.camYaw = car.yaw + Math.PI;
  car.driver = 'traffic';
  car.speed = 0;
}

// ---- Taxi fares ---------------------------------------------------------------
function updateTaxi(dt) {
  taxiTimer -= dt;
  if (!game.taxi) {
    // Every ~25 s a pedestrian near the player hails a cab (only while driving a Corto).
    if (taxiTimer <= 0 && player.car && player.car.type === 'corto') {
      taxiTimer = 25;
      const p = pedestrians.peds.find((q) => !q.down && dist2D(q.x, q.z, player.x, player.z) < 30);
      if (p) {
        const dest = world.randomRoadPoint(rng);
        game.taxi = { ped: p, destX: dest.x, destZ: dest.z, startX: player.car.x, startZ: player.car.z };
        hud.feed('Taxi fare! Pick up the passenger waving at you.');
        hud.setHint('Drive to the waving pedestrian (E to pick up)');
      }
    }
    return;
  }
  const t = game.taxi;
  const car = player.car;
  if (!car || car.type !== 'corto') {
    hud.feed('Fare cancelled — you left the taxi.');
    game.taxi = null;
    return;
  }
  if (!t.pickedUp) {
    if (dist2D(car.x, car.z, t.ped.x, t.ped.z) < 4) {
      t.pickedUp = true;
      t.ped.down = true; // they are "in the cab" now
      t.ped.mesh.visible = false;
      hud.feed(`Passenger aboard. Destination marked on the minimap.`);
      hud.setHint('');
    }
    return;
  }
  if (dist2D(car.x, car.z, t.destX, t.destZ) < 8) {
    const dist = dist2D(t.startX, t.startZ, t.destX, t.destZ);
    const fare = Math.round(TUNE.taxiBase + dist * TUNE.taxiPerMetre);
    game.money += fare;
    game.totalEarned += fare;
    hud.feed(`Fare complete +$${fare}`);
    audio.missionPass();
    t.ped.mesh.visible = true;
    t.ped.down = false;
    t.ped.x = t.destX;
    t.ped.z = t.destZ;
    t.ped.mesh.position.set(t.destX, 0, t.destZ);
    game.taxi = null;
    autosave();
  }
}

// ---- One fixed step ------------------------------------------------------------
function step(dt) {
  game.clock += dt;
  game.playSeconds += dt;

  // Health regen (slow, out of combat).
  if (player.health > 0 && player.health < TUNE.playerHealth) {
    player.health = Math.min(TUNE.playerHealth, player.health + TUNE.healthRegen * dt);
  }

  // Mute toggle.
  if (input.muteQueued) {
    const m = audio.setMuted(!audio.isMuted());
    hud.feed(m ? 'Sound muted (M)' : 'Sound on (M)');
  }

  // Shooting (on foot only).
  if (!player.car && input.mouseDown) {
    if (!step._shootCd) step._shootCd = 0;
    step._shootCd -= dt;
    if (step._shootCd <= 0) {
      step._shootCd = 0.28;
      const result = combat.shoot(camera, player, game.ammo);
      if (result === 'empty') {
        if (game.ammo.reserve > 0) {
          const load = Math.min(TUNE.pistolAmmo, game.ammo.reserve);
          game.ammo.ammo = load;
          game.ammo.reserve -= load;
          hud.feed('Reloaded.');
        } else {
          hud.feed('Out of ammo — find an ammo pickup.');
        }
      } else if (result === 'kill') {
        hud.feed('Enforcer down.');
        if (police.stars() >= 1) police.addWanted(0.2);
      }
    }
  }
  // Punch.
  if (!player.car && input.punchQueued) {
    audio.punch();
    for (const p of pedestrians.peds) {
      if (!p.down && dist2D(p.x, p.z, player.x, player.z) < 2) {
        p.down = true;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.4;
        police.addWanted(TUNE.wantedPerPedHit * 0.5);
      }
    }
  }

  // Enter / exit car.
  if (input.enterQueued) {
    if (player.car) exitCar();
    else tryEnterCar();
  }

  // Move.
  if (player.car) {
    const car = player.car;
    const throttle = input.axis('moveY');
    const steer = -input.axis('moveX');
    const res = driveCar(car, throttle, steer, input.handbrake(), dt, world.collide);
    audio.setEngine(Math.abs(car.speed) / car.maxSpeed, true);
    // Skid marks + smoke when damaged or handbraking.
    if (input.handbrake() && Math.abs(car.speed) > 10) {
      effects.addSkid(car.x - Math.sin(car.yaw) * 1.5, car.z - Math.cos(car.yaw) * 1.5, car.yaw);
    }
    if (car.health < 40) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        effects.smoke({ x: car.x, y: 1.2, z: car.z });
      }
    }
    if (res.hitWall && Math.abs(car.speed) > 12) {
      audio.crash();
      renderer.addShake(0.4);
    }
    // Pedestrian hit by the player's car.
    const hit = pedestrians.hitByCar(car);
    if (hit && Math.abs(car.speed) > 6) {
      police.addWanted(TUNE.wantedPerPedHit);
      hud.feed('You hit a pedestrian! Wanted level up.');
      audio.crash();
    }
    player.x = car.x;
    player.z = car.z;
  } else {
    stepPlayer(player, input, dt, world.collide);
    audio.setEngine(0, false);
  }

  // Garage repaint: clear wanted for $150.
  if (police.nearGarage(player) && police.stars() > 0 && game.money >= TUNE.repaintCost) {
    game.money -= TUNE.repaintCost;
    police.clearWanted();
    hud.feed(`Fresh Coat repaint -$${TUNE.repaintCost}. Wanted cleared.`);
    audio.pickup();
    autosave();
  }

  traffic.update(dt, player.car, pedestrians);
  pedestrians.update(dt, player, player.car, combat.gunfireAt);
  combat.update(dt, player, (kind) => {
    if (kind === 'health') player.health = Math.min(TUNE.playerHealth, player.health + 40);
    if (kind === 'ammo') game.ammo.reserve += 24;
    if (kind === 'shell') {
      game.shellsFound += 1;
      game.money += TUNE.shellBonus;
      hud.feed(`Golden shell! +$${TUNE.shellBonus}`);
    }
  });
  missions.update(dt);
  updateTaxi(dt);

  // Shells bob + collect.
  for (const s of [...shellMeshes]) {
    s.bob += dt * 2;
    s.mesh.position.y = 1 + Math.sin(s.bob) * 0.2;
    s.mesh.rotation.y += dt;
    if (dist2D(s.x, s.z, player.x, player.z) < 2) {
      scene.remove(s.mesh);
      shellMeshes.splice(shellMeshes.indexOf(s), 1);
      game.shellsCollected.add(s.index);
      game.shellsFound += 1;
      game.money += TUNE.shellBonus;
      game.totalEarned += TUNE.shellBonus;
      hud.feed(`Golden shell ${game.shellsFound}/10! +$${TUNE.shellBonus}`);
      audio.shell();
      effects.pickupSparkle({ x: s.x, y: 1, z: s.z });
      autosave();
    }
  }

  // Police + busted / wasted.
  const outcome = police.update(dt, player, effects, audio);
  if (outcome === 'busted') {
    game.money = Math.max(0, game.money - TUNE.bustFine);
    audio.busted();
    game.screen = SCREEN_BUSTED;
    announce(`Busted. Fine $${TUNE.bustFine}.`);
    autosave();
  } else if (outcome === 'wasted') {
    audio.busted();
    game.screen = SCREEN_WASTED;
    announce('Wasted.');
  }

  effects.update(dt);
  updateCamera(camera, player, dt);
  renderer.update(dt, performance.now() / 1000);

  // HUD + minimap.
  hud.update(game);
  minimap.draw(game);
  const hint = player.car
    ? 'WASD drive · Space handbrake · E exit · M mute'
    : 'WASD move · Shift sprint · Space jump · E enter car · Click shoot · F punch';
  hud.setHint(hint);
}

// ---- Screens -------------------------------------------------------------------
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const bustedEl = document.getElementById('busted-screen');
const wastedEl = document.getElementById('wasted-screen');
const missionEl = document.getElementById('mission-screen');
const kingpinEl = document.getElementById('kingpin-screen');

// Only touch the DOM when the screen actually changes: showScreen is called
// every frame from the play loop, and re-assigning style.display to the same
// value each frame forces needless style recalculation.
let currentScreen = null;
function showScreen(name) {
  if (name === currentScreen) return;
  currentScreen = name;
  for (const [el, key] of [[titleEl, 'title'], [pauseEl, 'paused'], [bustedEl, 'busted'], [wastedEl, 'wasted'], [missionEl, 'mission'], [kingpinEl, 'kingpin']]) {
    el.style.display = key === name ? 'flex' : 'none';
  }
  document.getElementById('hud').style.display = name === 'play' || name === 'paused' ? 'block' : 'none';
}

function bindButtons() {
  const click = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => { audio.unlock(); audio.click(); fn(); });
  };
  click('btn-continue', () => startGame(false));
  click('btn-new', () => startGame(true));
  click('btn-how', () => {
    document.getElementById('howto').style.display = 'block';
  });
  click('btn-how-close', () => {
    document.getElementById('howto').style.display = 'none';
  });
  click('btn-resume', () => { game.screen = SCREEN_PLAY; showScreen('play'); });
  click('btn-restart-mission', () => { missions.reset(); game.screen = SCREEN_PLAY; showScreen('play'); });
  click('btn-save', () => { autosave(); hud.feed('Game saved.'); game.screen = SCREEN_PLAY; showScreen('play'); });
  click('btn-quit-title', () => { game.screen = SCREEN_TITLE; showScreen('title'); });
  click('btn-busted-ok', () => {
    player.health = TUNE.playerHealth;
    player.x = SPAWNS.station.x;
    player.z = SPAWNS.station.z;
    player.mesh.position.set(player.x, 0, player.z);
    police.clearWanted();
    game.screen = SCREEN_PLAY;
    showScreen('play');
  });
  click('btn-wasted-ok', () => startGame(false));
  click('btn-mission-ok', () => { game.screen = SCREEN_PLAY; showScreen('play'); });
  click('btn-kingpin-again', () => startGame(true));
  click('btn-kingpin-title', () => { game.screen = SCREEN_TITLE; showScreen('title'); });
}

function runShot(name) {
  const shotState = stageShot(name, game, scene, camera);
  // Debug isolation (?hide=sky|fog|clouds|beacon|buildings): hide one layer at a
  // time to find what paints a bad frame. Not used in normal play.
  const hide = params.get('hide');
  if (hide) {
    if (hide === 'fog') scene.fog = null;
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const t = o.geometry.type;
      if (hide === 'sky' && t === 'SphereGeometry' && o.geometry.parameters.radius > 100) o.visible = false;
      if (hide === 'clouds' && o.material.transparent && o.material.opacity === 0.85) o.visible = false;
      if (hide === 'beacon' && t === 'CylinderGeometry' && o.material.transparent) o.visible = false;
      if (hide === 'buildings' && t === 'BoxGeometry' && o.material.map) o.visible = false;
      if (hide === 'landmark' && t === 'BoxGeometry' && !o.material.map) o.visible = false;
      if (hide === 'planes' && t === 'PlaneGeometry') o.visible = false;
      if (hide === 'ocean' && t === 'PlaneGeometry' && o.position.x < -200) o.visible = false;
    });
  }
  let painted = 0;
  function paint() {
    renderer.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  showScreen(shotState.screen);
  requestAnimationFrame(paint);
}

function runGame() {
  bindButtons();
  // Title screen shows the live city behind it: slow orbit camera.
  let titleAngle = 0;
  let screen = SCREEN_TITLE;
  game.screen = SCREEN_TITLE;
  showScreen('title');
  document.getElementById('best-money').textContent = saved ? `$${(saved.bestMoney || 0).toLocaleString('en-US')}` : '$0';
  document.getElementById('missions-done').textContent = saved ? `${saved.missionsDone.length}/6` : '0/6';
  announce('Solmara. Press Enter or click Continue to play.');

  let accumulator = 0;
  let last = performance.now();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      showScreen('paused');
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (input.pauseQueued) {
      if (game.screen === SCREEN_PLAY) {
        game.screen = SCREEN_PAUSED;
        showScreen('paused');
        input.unlockPointer();
      } else if (game.screen === SCREEN_PAUSED) {
        game.screen = SCREEN_PLAY;
        showScreen('play');
      }
    }

    if (game.screen === SCREEN_TITLE) {
      // Ambient title backdrop: traffic + pedestrians move, camera orbits.
      titleAngle += dt * 0.05;
      camera.position.set(Math.sin(titleAngle) * 90, 42, Math.cos(titleAngle) * 90);
      camera.lookAt(0, 4, 0);
      traffic.update(dt, null, pedestrians);
      pedestrians.update(dt, player, null, null);
      effects.update(dt);
      renderer.update(dt, now / 1000);
      renderer.render();
      input.endFrame();
      return;
    }

    if (game.screen !== SCREEN_PLAY) {
      // Busted / wasted / kingpin: keep rendering the frozen city.
      if (game.screen === SCREEN_BUSTED) showScreen('busted');
      else if (game.screen === SCREEN_WASTED) showScreen('wasted');
      else if (game.screen === SCREEN_KINGPIN) showScreen('kingpin');
      renderer.render();
      input.endFrame();
      return;
    }

    showScreen('play');
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      step(STEP);
      accumulator -= STEP;
      steps += 1;
      if (game.screen !== SCREEN_PLAY) break;
    }
    if (steps >= 5) accumulator = 0;
    renderer.render();
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
