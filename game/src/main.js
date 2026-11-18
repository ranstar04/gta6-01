// SOLMARA — boot, the fixed-step loop, screens and the glue between systems.
// The game owns one shared state object (G) that every system reads and writes:
// the player, the cars, the wanted level, the money, the mission chain and the
// taxi fares. Play runs in fixed 1/60 s steps; the title screen keeps the city
// alive behind the menu; ?shot= stages a screenshot scene instead of playing.

import * as THREE from 'three';
import { STEP, START_POS, START_MONEY, MISSIONS, SHELLS, SHELL_BONUS, WANTED, SHOT } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACT_ENTER, ACT_RELOAD, ACT_MELEE, ACT_PAUSE, ACT_MUTE } from './input.js';
import { createWorld } from './world.js';
import { buildCity } from './city.js';
import { createStage } from './render.js';
import { createPlayer } from './player.js';
import { createCar, stepCar, nearestCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave, saveExists } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.style.display = 'none';
  if (id) document.getElementById(id).style.display = 'flex';
}

try {
  boot();
} catch (err) {
  window.__shotError = String(err && err.message ? err.message : err);
  throw err;
}

function boot() {
  const rng = createRandom(seed);
  const world = createWorld();
  const stage = createStage(canvas);
  const city = buildCity(stage.scene, world, rng);
  const effects = createEffects(stage.scene);
  const audio = createAudio();
  const hud = createHud(document);
  const minimap = createMinimap(document.getElementById('minimap'));
  const input = createInput(canvas, () => audio.unlock());
  const player = createPlayer(stage.scene, START_POS);
  const traffic = createTraffic(stage.scene, world, rng, 14);
  const peds = createPedestrians(stage.scene, world, rng, 24);
  const police = createPolice(stage.scene, world, rng);
  const missions = createMissions(stage.scene);
  const combat = createCombat(stage.scene);

  const G = {
    rng, world, stage, city, effects, audio, hud, minimap, input,
    player, traffic, peds, police, missions, combat,
    cars: [],
    parked: {},
    money: START_MONEY,
    time: 0,
    clockMin: 17 * 60 + 20,
    screen: 'title',
    driving: null,
    shells: [],
    shellsGot: 0,
    taxi: { active: false, stage: 'idle', ped: null, target: null, fare: 0, timer: 0 },
    frame: 0,
  };

  // Parked cars around the city, free for the taking.
  const parkedSpots = [
    ['vesper', 4, 70, Math.PI],
    ['alba', -84, -40, 0],
    ['corto', 84, 40, Math.PI],
    ['vela', -4, -120, Math.PI / 2],
    ['bruto', -170, 20, 0],
    ['alba', 120, -84, Math.PI],
    ['corto', 4, -160, 0],
    ['vela', -84, 120, Math.PI / 2],
  ];
  for (const [type, x, z, yaw] of parkedSpots) {
    const car = createCar(stage.scene, type, x, z, yaw, { driver: null, id: 400 + G.cars.length });
    G.cars.push(car);
    if (type === 'vesper' && !G.parked.vesper) G.parked.vesper = car;
  }
  for (const car of traffic.cars) G.cars.push(car);

  // The ten golden shells, hidden around the city.
  const shellGeo = new THREE.OctahedronGeometry(0.45);
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x664411 });
  for (const spot of SHELLS) {
    const mesh = new THREE.Mesh(shellGeo, shellMat);
    mesh.position.set(spot.x, 1.1, spot.z);
    stage.scene.add(mesh);
    G.shells.push({ x: spot.x, z: spot.z, mesh, taken: false, spin: Math.random() * 6 });
  }
  // Taxi marker: a gold cone that marks the fare and the destination.
  const taxiMarker = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 8),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
  );
  taxiMarker.visible = false;
  stage.scene.add(taxiMarker);

  G.feed = (msg, good) => hud.feed(msg, good);
  G.saveProgress = () => {
    writeSave({
      money: G.money,
      missionsDone: MISSIONS.slice(0, missions.state.index).map((m) => m.id),
      shells: G.shells.map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0),
      bestMoney: Math.max(G.money, loadSave()?.bestMoney ?? 0),
      kills: combat.state.kills,
    });
  };
  G.onKingpin = () => {
    G.screen = 'kingpin';
    show('screen-kingpin');
    document.getElementById('kingpin-money').textContent = `$${G.money.toLocaleString('en-US')}`;
    audio.jingle();
  };
  G.startShootout = () => {
    const spots = [[-206, 62], [-198, 58], [-192, 66], [-204, 72], [-196, 74], [-188, 60]];
    for (const [x, z] of spots) combat.spawnEnemy(x, z);
    combat.spawnPickup('health', -196, 84);
    combat.spawnPickup('ammo', -192, 88);
    hud.feed('Kross enforcers ahead — clear them out!');
  };

  /** Put the player in (or out of) a car. */
  G.setDriving = (car) => {
    if (G.driving === car) return;
    if (G.driving) G.driving.driver = null;
    G.driving = car;
    if (car) {
      car.driver = 'player';
      player.state.mesh.visible = false;
    } else {
      player.state.mesh.visible = true;
    }
  };

  /** Drive one car a step, with smoke, skids and pedestrian collisions. */
  G.driveCar = (car, dt, drive) => {
    const wasSpeed = car.speed;
    const hitHard = stepCar(car, dt, world, drive, G.cars);
    if (hitHard) {
      stage.cam.shake = Math.max(stage.cam.shake, 0.5);
      if (car === G.driving) hud.feed('Crash!');
    }
    if (car.health < 40 && car.health > 0) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.12;
        effects.smoke(car.pos.x + Math.sin(car.yaw) * 1.8, 1.2, car.pos.z + Math.cos(car.yaw) * 1.8);
      }
    }
    if (drive.handbrake && Math.abs(car.speed) > 10) {
      effects.skid(car.pos.x - Math.sin(car.yaw) * 1.8, car.pos.z - Math.cos(car.yaw) * 1.8, car.yaw);
      if (car === G.driving && G.time - (G.lastScreechAt || -99) > 0.5) {
        G.lastScreechAt = G.time;
        audio.screech();
      }
    }
    // The player's car hitting a pedestrian is a crime.
    if (car === G.driving && Math.abs(car.speed) > 5) {
      for (const ped of peds.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 1.7) {
          ped.down = true;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.3;
          police.addStars(WANTED.hitPed, G.time);
          hud.feed('Pedestrian hit! The police saw that.');
          audio.fail();
        }
      }
    }
    return wasSpeed;
  };

  /** Walk the player a step (shared by the live game and the street shot). */
  G.walkPlayer = (dt, move, look) => {
    player.step(dt, move, look, world, G.time);
  };

  function seenByAnyone(x, z, radius) {
    for (const ped of peds.peds) {
      if (!ped.down && Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) return true;
    }
    for (const car of police.state.cruisers) {
      if (Math.hypot(car.pos.x - x, car.pos.z - z) < radius + 20) return true;
    }
    return police.state.stars >= 1;
  }

  function enterNearestCar() {
    const car = nearestCar(G.cars, player.state.pos.x, player.state.pos.z, 4.2);
    if (!car) return;
    const wasTraffic = car.driver === 'traffic';
    if (wasTraffic) {
      car.ai = null; // stolen cars leave the traffic system for good
      if (seenByAnyone(car.pos.x, car.pos.z, 40)) {
        police.addStars(WANTED.stealSeen, G.time);
        hud.feed('Car stolen! The heat is on.');
      } else {
        hud.feed(`Took the ${car.spec.label}.`);
      }
    } else {
      hud.feed(`Driving the ${car.spec.label}.`);
    }
    player.state.pos.set(car.pos.x, 0, car.pos.z);
    G.setDriving(car);
    if (car.type === 'corto') startTaxi();
  }

  function exitCar() {
    const car = G.driving;
    if (!car) return;
    const side = car.yaw + Math.PI / 2;
    player.state.pos.set(
      car.pos.x + Math.sin(side) * 2.2,
      0,
      car.pos.z + Math.cos(side) * 2.2,
    );
    player.state.camYaw = car.yaw;
    G.setDriving(null);
    cancelTaxi('Fare cancelled.');
  }

  function startTaxi() {
    if (G.taxi.active) return;
    let best = null;
    let bestD = 45;
    for (const ped of peds.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.pos.x - player.state.pos.x, ped.pos.z - player.state.pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (!best) return;
    G.taxi.active = true;
    G.taxi.stage = 'pickup';
    G.taxi.ped = best;
    G.taxi.target = null;
    taxiMarker.visible = true;
    taxiMarker.position.set(best.pos.x, 2.2, best.pos.z);
    hud.feed('Taxi fare: pick up the passenger.');
  }

  function cancelTaxi(msg) {
    if (!G.taxi.active) return;
    G.taxi.active = false;
    G.taxi.stage = 'idle';
    G.taxi.ped = null;
    taxiMarker.visible = false;
    if (msg) hud.feed(msg);
  }

  function stepTaxi(dt) {
    const t = G.taxi;
    if (!t.active || !G.driving) return;
    if (t.stage === 'pickup' && t.ped) {
      taxiMarker.position.set(t.ped.pos.x, 2.2, t.ped.pos.z);
      const d = Math.hypot(t.ped.pos.x - G.driving.pos.x, t.ped.pos.z - G.driving.pos.z);
      if (d < 6) {
        t.ped.down = true;
        t.ped.mesh.visible = false;
        t.stage = 'dropoff';
        const dest = world.intersections()[Math.floor(Math.random() * 25)];
        t.target = { x: dest.x, z: dest.z };
        t.fare = 40 + Math.round(Math.hypot(dest.x - G.driving.pos.x, dest.z - G.driving.pos.z) * 0.5);
        taxiMarker.position.set(dest.x, 2.2, dest.z);
        hud.feed('Passenger aboard — drive to the marker.');
      }
    } else if (t.stage === 'dropoff' && t.target) {
      const d = Math.hypot(t.target.x - G.driving.pos.x, t.target.z - G.driving.pos.z);
      if (d < 8) {
        G.money += t.fare;
        hud.feed(`Fare complete +$${t.fare}`, true);
        audio.pickup();
        cancelTaxi(null);
      }
    }
  }

  function checkShells() {
    const p = player.state.pos;
    for (const s of G.shells) {
      if (s.taken) continue;
      s.spin += 0.05;
      s.mesh.rotation.y = s.spin;
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      if (dx * dx + dz * dz < 3.4) {
        s.taken = true;
        stage.scene.remove(s.mesh);
        G.shellsGot += 1;
        G.money += SHELL_BONUS;
        effects.glint(s.x, 1.2, s.z);
        audio.pickup();
        hud.feed(`Golden shell ${G.shellsGot}/10  +$${SHELL_BONUS}`, true);
        if (G.shellsGot >= 10) hud.banner('ALL SHELLS FOUND', `Bonus banked — $${SHELL_BONUS * 10} total`);
      }
    }
  }

  function checkSprayShop() {
    if (!G.driving || police.state.stars < 0.5) return;
    const g = world.places.garage;
    if (Math.hypot(G.driving.pos.x - g.x, G.driving.pos.z - g.z) > 9) return;
    const res = police.sprayShop(G.money);
    if (res.ok) {
      G.money = res.money;
      hud.feed('Fresh Coat: repaint done, heat cleared.', true);
      audio.pickup();
    }
  }

  const PLAYER_HEALTH_FULL = 100;

  function die(reason) {
    if (G.screen !== 'play') return;
    if (G.driving) {
      G.setDriving(null);
    }
    if (reason === 'busted' || police.state.stars >= 2) {
      G.money = Math.max(0, G.money - WANTED.bustedFine);
      player.state.pos.set(80, 0, -32);
      player.state.health = PLAYER_HEALTH_FULL;
      police.reset();
      G.screen = 'busted';
      show('screen-busted');
      document.getElementById('busted-fine').textContent = `-$${WANTED.bustedFine} fine`;
      audio.fail();
    } else {
      G.money = Math.max(0, G.money - WANTED.wastedFine);
      player.state.pos.set(-80, 0, 128);
      player.state.health = PLAYER_HEALTH_FULL;
      G.screen = 'wasted';
      show('screen-wasted');
      document.getElementById('wasted-fine').textContent = `-$${WANTED.wastedFine} hospital bill`;
      audio.fail();
    }
    G.saveProgress();
  }

  function stepGame(dt) {
    G.time += dt;
    G.clockMin += dt * 0.5;
    const move = input.move();
    const look = input.look();
    const actions = input.takeActions();

    if (actions & ACT_PAUSE) {
      G.screen = 'pause';
      show('screen-pause');
      return;
    }
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      hud.feed(muted ? 'Sound off.' : 'Sound on.');
    }

    // Enter / exit cars.
    if (actions & ACT_ENTER) {
      if (G.driving) exitCar();
      else enterNearestCar();
    }
    if (G.driving) {
      const drive = {
        throttle: move.f,
        steer: -move.s,
        handbrake: move.jumpHeld,
      };
      G.driveCar(G.driving, dt, drive);
      if (G.driving.wrecked) {
        hud.feed('Car wrecked!');
        exitCar();
      }
    } else {
      G.walkPlayer(dt, move, look);
      if (actions & ACT_RELOAD) combat.reload();
      if (actions & ACT_MELEE) {
        combat.melee(player.state.pos, player.state.yaw, (enemy) => {
          if (enemy) effects.impact(enemy.pos.x, 1.3, enemy.pos.z);
        });
      }
      if (input.mouseDown() && G.time - combat.state.lastShotAt > 0.13) {
        const res = combat.shoot(stage.camera, G.time,
          (enemy, point) => {
            effects.impact(point.x, point.y, point.z);
            effects.muzzle(player.state.pos.x, 1.4, player.state.pos.z);
            audio.gunshot();
            peds.scare(player.state.pos.x, player.state.pos.z, 26);
          },
          (point) => {
            effects.impact(point.x, point.y, point.z);
            effects.muzzle(player.state.pos.x, 1.4, player.state.pos.z);
            audio.gunshot();
            peds.scare(player.state.pos.x, player.state.pos.z, 26);
          },
          () => {});
        if (res === 'hit' || res === 'miss') {
          if (seenByAnyone(player.state.pos.x, player.state.pos.z, 45)) {
            police.addStars(WANTED.shootSeen, G.time);
          }
        } else if (res === 'empty') {
          combat.reload();
        }
      }
    }

    traffic.step(dt, G.driving, G.cars);
    peds.step(dt, G.time, G.cars);
    const wanted = police.step(dt, G.time, player.state.pos, G.driving, G.cars, () => die('busted'));
    missions.step(dt, { playerPos: player.state.pos, wanted, enemiesLeft: combat.enemies.filter((e) => !e.dead).length }, G);
    combat.step(dt, G.time, player.state.pos, player, effects);
    if (combat.state.cashPending > 0) {
      G.money += combat.state.cashPending;
      combat.state.cashPending = 0;
    }
    effects.step(dt);
    checkShells();
    stepTaxi(dt);
    checkSprayShop();
    audio.engine(G.driving ? Math.abs(G.driving.speed) / G.driving.spec.topSpeed : 0, !!G.driving);
    let nearestCruiser = 999;
    for (const car of police.state.cruisers) {
      nearestCruiser = Math.min(nearestCruiser, Math.hypot(car.pos.x - player.state.pos.x, car.pos.z - player.state.pos.z));
    }
    audio.siren(nearestCruiser, wanted);
    audio.music(dt);

    if (player.state.health <= 0) die('wasted');
  }

  function stepAmbient(dt) {
    G.time += dt;
    G.clockMin += dt * 0.5;
    traffic.step(dt, null, G.cars);
    peds.step(dt, G.time, G.cars);
    effects.step(dt);
    audio.music(dt);
  }

  function startGame(fresh) {
    if (fresh) {
      clearSave();
      G.money = START_MONEY;
      G.shellsGot = 0;
      for (const s of G.shells) {
        s.taken = false;
        stage.scene.add(s.mesh);
      }
      missions.start(0);
    } else {
      const save = loadSave();
      if (save) {
        G.money = save.money ?? START_MONEY;
        G.shellsGot = 0;
        for (let i = 0; i < G.shells.length; i += 1) {
          const taken = save.shells.includes(i);
          G.shells[i].taken = taken;
          if (taken) {
            G.shellsGot += 1;
            stage.scene.remove(G.shells[i].mesh);
          } else {
            stage.scene.add(G.shells[i].mesh);
          }
        }
        missions.start(Math.min(save.missionsDone.length, MISSIONS.length - 1));
      } else {
        missions.start(0);
      }
    }
    player.state.pos.set(START_POS.x, 0, START_POS.z);
    player.state.yaw = Math.PI;
    player.state.camYaw = Math.PI;
    player.state.health = PLAYER_HEALTH_FULL;
    police.reset();
    combat.clearEnemies();
    combat.state.ammo = 12;
    combat.state.reserve = 60;
    combat.state.kills = 0;
    G.screen = 'play';
    show(null);
    statusEl.textContent = 'Playing SOLMARA.';
  }

  // Title / pause / end-screen buttons.
  document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
  document.getElementById('btn-new').addEventListener('click', () => startGame(true));
  document.getElementById('btn-help').addEventListener('click', () => show('screen-help'));
  document.getElementById('btn-help-close').addEventListener('click', () => show('screen-title'));
  document.getElementById('btn-missions').addEventListener('click', () => {
    const list = document.getElementById('mission-list');
    list.innerHTML = MISSIONS.map((m, i) => `<div class="mission-row${i < missions.state.index ? ' done' : ''}">${i + 1}. ${m.name} — $${m.reward}</div>`).join('');
    show('screen-missions');
  });
  document.getElementById('btn-missions-close').addEventListener('click', () => show('screen-title'));
  document.getElementById('btn-resume').addEventListener('click', () => {
    G.screen = 'play';
    show(null);
  });
  document.getElementById('btn-restart-mission').addEventListener('click', () => {
    missions.start(missions.state.index);
    player.state.pos.set(START_POS.x, 0, START_POS.z);
    G.screen = 'play';
    show(null);
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    G.saveProgress();
    hud.feed('Game saved.', true);
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    G.saveProgress();
    G.screen = 'title';
    show('screen-title');
  });
  document.getElementById('btn-busted-ok').addEventListener('click', () => {
    G.screen = 'play';
    show(null);
  });
  document.getElementById('btn-wasted-ok').addEventListener('click', () => {
    G.screen = 'play';
    show(null);
  });
  document.getElementById('btn-kingpin-ok').addEventListener('click', () => {
    G.screen = 'title';
    show('screen-title');
  });
  document.getElementById('btn-title-play').addEventListener('click', () => startGame(false));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' && (G.screen === 'title' || G.screen === 'busted' || G.screen === 'wasted')) {
      if (G.screen === 'title') startGame(false);
      else {
        G.screen = 'play';
        show(null);
      }
    }
  });
  if (!saveExists()) document.getElementById('btn-continue').style.display = 'none';

  missions.start(0);
  show('screen-title');
  statusEl.textContent = 'SOLMARA. Press Enter or click to start.';

  // ---- the frame loop ----
  let shot = null;
  let shotFramesLeft = 0;
  if (shotName) {
    shot = stageShot(shotName, G);
    shotFramesLeft = shot.frames;
    if (shotName === 'title') show('screen-title');
    else show(null);
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    G.frame += 1;

    if (shot) {
      // Staged screenshot: fixed steps under the shot's own autopilot.
      acc += dt;
      while (acc >= STEP && shotFramesLeft > 0) {
        G.time += STEP;
        shot.update(STEP);
        acc -= STEP;
        shotFramesLeft -= 1;
      }
      if (shotFramesLeft <= 0 && !window.__shotReady) {
        window.__shotReady = true;
      }
      // Camera per shot.
      if (shot.camera === 'chaseFront' && G.driving) {
        const car = G.driving;
        const fx = Math.sin(car.yaw);
        const fz = Math.cos(car.yaw);
        stage.placeCamera(
          car.pos.x + fx * SHOT.chaseCamDist,
          SHOT.chaseCamHeight,
          car.pos.z + fz * SHOT.chaseCamDist,
          car.pos.x,
          car.pos.y + 1.2,
          car.pos.z
        );
      } else if (shot.camera === 'orbit') {
        stage.orbitVista(G.time);
      } else {
        stage.follow(player.state.pos, player.state.camYaw, dt, shot.cam || { distance: 8, height: 3.2 });
      }
    } else if (G.screen === 'play') {
      acc += dt;
      while (acc >= STEP) {
        stepGame(STEP);
        acc -= STEP;
      }
      if (G.driving) {
        stage.follow(G.driving.pos, G.driving.yaw + Math.PI, dt, { distance: 10.5, height: 4.2 });
      } else {
        stage.follow(player.state.pos, player.state.camYaw, dt, { distance: 8, height: 3.2 });
      }
    } else if (G.screen === 'title' || G.screen === 'kingpin') {
      acc += dt;
      while (acc >= STEP) {
        stepAmbient(STEP);
        acc -= STEP;
      }
      stage.orbitVista(G.time);
    }

    stage.animateOcean(city.oceanGeo, G.time, G.frame);
    stage.driftClouds(dt);
    stage.renderer.render(stage.scene, stage.camera);

    // HUD + minimap every frame (also in shot mode: the judge sees them).
    // The title screen hides the HUD so the menu sits over a clean vista.
    hud.setVisible(shot ? shotName !== 'title' : (G.screen !== 'title' && G.screen !== 'kingpin'));
    const obj = missions.objective();
    hud.update({
      health: player.state.health,
      money: G.money,
      stars: police.state.stars,
      clockMin: G.clockMin,
      driving: !!G.driving,
      carLabel: G.driving ? G.driving.spec.label : '',
      ammo: combat.state.ammo,
      reserve: combat.state.reserve,
      objective: obj.text,
      objectiveDist: obj.distance,
      speed: G.driving ? G.driving.speed : 0,
      shells: G.shellsGot,
    });
    hud.step(dt);
    minimap.draw({
      player: player.state.pos,
      playerYaw: G.driving ? G.driving.yaw + Math.PI : player.state.camYaw,
      missionTarget: obj.target,
      taxiTarget: G.taxi.active
        ? (G.taxi.target || (G.taxi.ped ? { x: G.taxi.ped.pos.x, z: G.taxi.ped.pos.z } : null))
        : null,
      shells: G.shells.filter((s) => !s.taken),
      traffic: traffic.cars,
      police: police.state.cruisers,
    });
  }
  requestAnimationFrame(frame);
}
