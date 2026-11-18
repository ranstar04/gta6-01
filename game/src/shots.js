// Staged screenshot scenes: each one configures a real, seeded world state,
// swaps the live input for a scripted one (throttle, walk, aim, clicks), and
// lets the real update loop play forward. After `frames` frames the shot is
// ready. Nothing here fakes a render — the frame is the game, mid-play.
import { CFG } from './config.js';
import { spawnCarAt } from './vehicles.js';
import { TRAFFIC_LOOPS } from './world.js';

export function setupShot(S, name) {
  const realInput = S.input;
  let frame = 0;
  let aimYaw = null;

  const fake = {
    down: () => false,
    pressed: () => false,
    consumeClick() {
      if (name === 'mission' && frame > 30 && frame % 35 === 0) return true;
      return false;
    },
    consumeMouse() {
      if (aimYaw === null) return { dx: 0, dy: 0 };
      let d = aimYaw - S.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const dx = Math.max(-30, Math.min(30, -d / 0.0032));
      return { dx, dy: 0 };
    },
    isLocked: () => false,
    requestLock() {},
    exitLock() {},
    moveAxis() {
      // Chase: straight down the boulevard. The old sine weave never completed
      // a cycle over the shot, so it steered the Vesper off the road into the
      // walls instead of holding the lane.
      if (name === 'chase') return { x: 0, y: 1 };
      if (name === 'street') return { x: 0, y: 0.55 };
      return { x: 0, y: 0 };
    },
    sprinting: () => false,
    endFrame() {},
  };
  S.input = fake;
  S.realInput = realInput;

  function update(f) {
    frame = f;
    // Chase: cap the Vesper at cruise speed so the cruisers hold their gap
    // behind it instead of piling into the camera.
    if (name === 'chase' && S.playerCar) S.playerCar.speed = Math.min(S.playerCar.speed, CFG.chaseCruiseSpeed);
    if (name === 'title') {
      const a = f * 0.004;
      S.camera.position.set(Math.cos(a) * 150, 58, Math.sin(a) * 150);
      S.camera.lookAt(0, 10, 0);
    } else if (name === 'mission') {
      // Keep aiming at the nearest living enforcer.
      let best = null;
      let bestD = Infinity;
      for (const e of S.combat.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.group.position.x - S.player.group.position.x, e.group.position.z - S.player.group.position.z);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        aimYaw = Math.atan2(
          best.group.position.x - S.player.group.position.x,
          best.group.position.z - S.player.group.position.z,
        );
      }
    }
  }

  if (name === 'chase') {
    S.mode = 'play';
    S.hud.showGame();
    S.money = 1250;
    S.wanted = 3;
    S.hud.setObjective('Escape the police — lose the tail!');
    const car = spawnCarAt(S, 'vesper', -30, -110, 0, { driver: 'player' });
    car.speed = 24;
    S.playerCar = car;
    S.player.group.visible = false;
    // Cruisers trail 32 / 48 units back: with the Vesper capped at cruise
    // speed they close slowly and stay visible behind it, not on top of it.
    const c1 = spawnCarAt(S, 'patrol', -30, -142, 0, { driver: 'police' });
    c1.speed = 30;
    const c2 = spawnCarAt(S, 'patrol', -26, -158, 0, { driver: 'police' });
    c2.speed = 30;
    S.police.cruisers.push(c1, c2);
    // Two traffic cars on the parallel boulevard, so the chase lane stays clear.
    const t1 = spawnCarAt(S, 'alba', 30, -58, 0, { driver: 'ped' });
    t1.traffic = { loop: TRAFFIC_LOOPS[0], wp: 1, speed: 10, lane: 2.6, stunned: 0 };
    S.traffic.list.push(t1);
    const t2 = spawnCarAt(S, 'corto', 30, -18, 0, { driver: 'ped' });
    t2.traffic = { loop: TRAFFIC_LOOPS[0], wp: 1, speed: 9, lane: -2.6, stunned: 0 };
    S.traffic.list.push(t2);
    return { frames: 100, update, name };
  }

  if (name === 'street') {
    S.mode = 'play';
    S.hud.showGame();
    S.hud.setObjective('On foot in Calle Verde — the city is yours');
    S.player.group.position.set(37.5, 0.12, 55);
    S.player.yaw = Math.PI;
    S.camYaw = Math.PI;
    S.camPitch = 0.2;
    // Pull a few walkers into the frame.
    for (let i = 0; i < 6 && i < S.peds.list.length; i++) {
      const ped = S.peds.list[i];
      ped.group.position.set(30 + (i % 3) * 5, 0, 42 + Math.floor(i / 3) * 10);
      ped.state = 'walk';
    }
    return { frames: 90, update, name };
  }

  if (name === 'mission') {
    S.mode = 'play';
    S.hud.showGame();
    S.hud.setObjective('Clear the Kross enforcers (0/6)');
    // Rook holds the boulevard south of the warehouse, enforcers coming down
    // the road at him. (The old yard-corner spot put a tower block 1.4 units
    // from the camera, its south face filling the frame and hiding Rook.)
    S.player.group.position.set(-150, 0, -30);
    S.player.yaw = Math.PI;
    S.camYaw = Math.PI;
    S.camPitch = 0.14;
    S.ammo = 12;
    S.reserveAmmo = 48;
    S.combat.spawnEnemies(-150, -45, 6);
    const beacon = S.missions.ensureBeacon();
    beacon.group.visible = true;
    // The gold beacon marks the warehouse door on the road, in frame.
    beacon.group.position.set(-144, 0, -60);
    return { frames: 130, update, name };
  }

  // title (default): live city vista behind the menu.
  S.mode = 'title';
  S.hud.showTitle();
  return { frames: 80, update, name };
}
