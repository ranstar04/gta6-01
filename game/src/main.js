// SOLMARA boot + main loop: builds the shared state, wires every system, and
// runs the fixed-clamp frame — input, player/car, traffic, peds, police,
// combat, missions, effects, audio, HUD, minimap, render. Screens (title /
// pause / busted / wasted / kingpin) freeze the world and show their overlay.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createRender } from './render.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { spawnCarAt, updatePlayerCar, tryEnterCar, exitCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { setupShot } from './shots.js';

window.addEventListener('error', (e) => { window.__shotError = String(e.message || e.error); });

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);

const canvas = document.getElementById('game-canvas');
const render = createRender(canvas);

const saved = loadSave();
const S = {
  renderer: render.renderer,
  scene: render.scene,
  camera: render.camera,
  render,
  rng: makeRng(seed),
  time: 0,
  dayTime: CFG.dayStart,
  mode: 'title',
  money: saved ? saved.money : CFG.startMoney,
  missionsDone: saved ? saved.done : [],
  shellsGot: new Set(saved ? saved.shells : []),
  taxisDone: saved ? saved.taxis : 0,
  bestMoney: saved ? saved.bestMoney : 0,
  health: CFG.maxHealth,
  ammo: CFG.pistolMag,
  reserveAmmo: 48,
  wanted: 0,
  calmT: 0,
  speedKmh: 0,
  lastDamageAt: -99,
  cars: [],
  playerCar: null,
  camYaw: 0,
  camPitch: 0.22,
  shotState: null,
  realInput: null,
};
S.input = createInput(canvas);
S.audio = createAudio();
S.save = () => writeSave({
  money: S.money,
  missionsDone: S.missionsDone,
  shellsGot: S.shellsGot,
  taxisDone: S.taxisDone,
  bestMoney: Math.max(S.bestMoney, Math.round(S.money)),
});
S.effects = createEffects(S);
buildCity(S);
S.player = createPlayer(S);

// Ambient parked cars on the marked spots.
const PARKED = ['alba', 'vela', 'corto', 'alba', 'vela', 'alba'];
S.carSpawns.slice(0, 6).forEach((spot, i) => {
  spawnCarAt(S, PARKED[i % PARKED.length], spot.x, spot.z, spot.dir, { driver: null });
});
S.traffic = createTraffic(S);
S.peds = createPedestrians(S);
S.police = createPolice(S);
S.combat = createCombat(S);
S.missions = createMissions(S);
S.hud = createHud(S, {
  onNewGame() {
    clearSave();
    S.money = CFG.startMoney;
    S.missionsDone = [];
    S.shellsGot = new Set();
    S.taxisDone = 0;
    S.bestMoney = 0;
    S.health = CFG.maxHealth;
    S.ammo = CFG.pistolMag;
    S.reserveAmmo = 48;
    S.wanted = 0;
    S.calmT = 0;
    S.missions.reset();
    S.player.group.position.set(-60, 0, 92);
    S.player.yaw = 0;
    S.camYaw = 0;
    S.mode = 'play';
    S.hud.showGame();
    S.missions.start();
    S.audio.ensure();
  },
  onContinue() {
    S.mode = 'play';
    S.hud.showGame();
    S.missions.start();
    S.audio.ensure();
  },
  onResume() { S.mode = 'play'; S.hud.showGame(); },
  onRestartMission() {
    S.missions.restartCurrent();
    S.mode = 'play';
    S.hud.showGame();
  },
  onSave() { S.save(); },
  onQuitToTitle() {
    S.save();
    S.mode = 'title';
    S.input.exitLock();
    S.hud.showTitle();
  },
  onBustedOk() { S.mode = 'play'; S.hud.showGame(); },
  onWastedOk() { S.mode = 'play'; S.hud.showGame(); },
  onKingpinOk() { S.mode = 'title'; S.hud.showTitle(); },
});
S.minimap = createMinimap(S, document.getElementById('minimap'));

function pauseGame() {
  if (S.mode !== 'play') return;
  S.mode = 'pause';
  S.input.exitLock();
  S.audio.setEngine(0, 0);
  S.hud.showPause();
}

function handleKeys() {
  const input = S.input;
  if (input.pressed('KeyE')) {
    if (S.playerCar) {
      if (!S.police.trySpray()) exitCar(S);
    } else {
      tryEnterCar(S);
    }
  }
  if (input.pressed('KeyF')) S.combat.punch();
  if (input.pressed('KeyR')) S.combat.startReload();
  if (input.pressed('KeyM')) {
    const m = S.audio.toggleMute();
    S.hud.feed(m ? 'Sound muted (M)' : 'Sound on (M)');
  }
  if (input.pressed('KeyP')) pauseGame();
  if (input.pressed('Escape') && !input.isLocked() && S.mode === 'play') pauseGame();
  if (input.consumeClick()) {
    S.audio.ensure();
    if (!S.playerCar && S.mode === 'play') {
      if (S.shotState || input.isLocked()) S.combat.shoot();
      else input.requestLock();
    }
  }
}

let last = performance.now();
let titleAngle = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;
  S.dayTime = (CFG.dayStart + S.time / 240) % 24;

  if (S.shotState) S.shotState.update(S.shotState.frame);

  if (S.mode === 'play') {
    handleKeys();
    S.player.update(dt);
    updatePlayerCar(S, dt);
    S.traffic.update(dt);
    S.peds.update(dt);
    S.police.update(dt);
    S.combat.update(dt);
    S.missions.update(dt);
    S.effects.update(dt);
    S.audio.update(dt, S.wanted);
    S.audio.setSiren(S.wanted > 0 && S.police.cruisers.length > 0);
    if (!S.playerCar) S.audio.setEngine(0, 0); // the hum stops when Rook steps out
    if (S.time - S.lastDamageAt > 5 && S.health < CFG.maxHealth) {
      S.health = Math.min(CFG.maxHealth, S.health + 2 * dt);
    }
    if (S.health <= 0) {
      if (S.wanted > 0) S.police.busted();
      else S.police.wasted();
    }
    S.hud.update(dt);
    S.minimap.draw();
  } else if (S.mode === 'title') {
    S.traffic.update(dt);
    S.peds.update(dt);
    S.effects.update(dt);
    if (!S.shotState) {
      titleAngle += dt * 0.03;
      S.camera.position.set(Math.cos(titleAngle) * 150, 58, Math.sin(titleAngle) * 150);
      S.camera.lookAt(0, 10, 0);
    }
  }

  if (S.shotState) {
    S.shotState.frame++;
    if (S.shotState.frame >= S.shotState.frames && !window.__shotReady) {
      window.__shotReady = true;
    }
  }

  S.render.update(dt, S.time);
  S.effects.applyShake(S.camera);
  S.renderer.render(S.scene, S.camera);
  S.input.endFrame();
}

// Boot: title screen over the live city; a ?shot= URL stages a screenshot.
S.hud.showTitle();
if (shotName) {
  S.shotState = setupShot(S, shotName);
  S.shotState.frame = 0;
}
window.__solmara = S;
requestAnimationFrame(frame);
