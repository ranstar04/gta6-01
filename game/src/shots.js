// SOLMARA's staged screenshots: each scene plays the real rules forward from
// a fresh seeded world, steered by a small autopilot, so the frame is what a
// short game really looks like. Chase drives straight (a sine weave would hold
// the wheel one way and run the car into a wall); the mission stages on the
// open beach approach to the pier, with clear space behind the player so no
// building face can fill the frame; the chase camera sits ahead of the car
// looking back, so the pursuing cruisers stay in view.

import { SHOT } from './config.js';
import { createCar } from './vehicles.js';

/** The staged shot's state: how many frames to run, and the per-frame driver. */
export function stageShot(name, G) {
  const scene = G.stage.scene;
  const world = G.world;

  function clearShotActors() {
    // Park the player on foot and clear any previous shot's cruisers/enemies.
    G.setDriving(null);
    G.combat.clearEnemies();
    for (const car of [...G.police.state.cruisers]) {
      const i = G.cars.indexOf(car);
      if (i >= 0) G.cars.splice(i, 1);
      scene.remove(car.mesh);
    }
    G.police.state.cruisers.length = 0;
    G.police.state.stars = 0;
  }

  if (name === 'chase') {
    clearShotActors();
    const vesper = G.parked.vesper;
    vesper.pos.set(0, 0, 90);
    vesper.yaw = Math.PI;
    vesper.speed = 26;
    vesper.mesh.rotation.y = Math.PI;
    G.setDriving(vesper);
    G.police.state.stars = 3;
    G.missions.aimAt({ x: 0, z: -160 }, 'Escape the police — lose the tail!');
    // Keep the avenue clear: move any traffic car on the hero's path to the
    // east avenue, and pull walkers off the road, so nothing blocks the run
    // or gets hit by it (a hit pedestrian would add a fourth star).
    for (const car of G.traffic.cars) {
      if (Math.abs(car.pos.x) < 12 && car.pos.z > 10 && car.pos.z < 100) {
        car.pos.set(80, 0, car.pos.z);
      }
    }
    for (const ped of G.peds.peds) {
      if (Math.abs(ped.pos.x) < 10 && ped.pos.z < 110) {
        G.peds.moveTo(ped, ped.pos.x < 0 ? -14 : 14, 120 + Math.abs(ped.pos.x), 12, 150);
      }
    }
    const cruisers = [];
    for (const [x, z] of [[0, 118], [5, 136]]) {
      const car = createCar(scene, 'cruiser', x, z, Math.PI, { driver: 'police', id: 300 + cruisers.length });
      car.speed = 24;
      cruisers.push(car);
      G.cars.push(car);
      G.police.state.cruisers.push(car);
    }
    return {
      frames: 110,
      camera: 'chaseFront',
      update(dt) {
        // Straight down the avenue: no weave, no wall.
        const drive = { throttle: 1, steer: 0, handbrake: false };
        G.driveCar(vesper, dt, drive);
        for (const car of cruisers) {
          // Hold formation ~28 m behind the hero: steer at the point behind
          // the car, not at the car itself, and ease off before contact, so
          // the cruisers never ram the hero to a standstill.
          const fx = Math.sin(vesper.yaw);
          const fz = Math.cos(vesper.yaw);
          const tx = vesper.pos.x - fx * 28;
          const tz = vesper.pos.z - fz * 28;
          const dx = tx - car.pos.x;
          const dz = tz - car.pos.z;
          const dist = Math.hypot(dx, dz);
          const wantYaw = Math.atan2(dx, dz);
          let diff = wantYaw - car.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const throttle = dist > 34 ? 1 : dist > 24 ? 0.6 : 0.2;
          G.driveCar(car, dt, { throttle, steer: Math.max(-1, Math.min(1, diff * 1.8)), handbrake: false });
        }
        G.traffic.step(dt, vesper, G.cars);
        G.peds.step(dt, G.time, G.cars);
        G.effects.step(dt);
      },
    };
  }

  if (name === 'street') {
    clearShotActors();
    const p = G.player.state;
    p.pos.set(8, 0, 150);
    p.camYaw = 0;
    p.yaw = Math.PI;
    G.missions.aimAt({ x: -40, z: 40 }, 'Homecoming: reach the Gull & Anchor diner.');
    // Pull a few walkers onto this sidewalk so the street reads busy.
    for (let i = 0; i < 6 && i < G.peds.peds.length; i += 1) {
      const ped = G.peds.peds[i];
      G.peds.moveTo(ped, 4 + (i % 3) * 4, 132 + Math.floor(i / 3) * 10, 6, 120);
    }
    return {
      frames: 80,
      camera: 'follow',
      cam: { distance: SHOT.followDist, height: SHOT.followHeight },
      update(dt) {
        G.walkPlayer(dt, { f: 1, s: 0, sprint: false, jumpHeld: false }, { x: 0, y: 0 });
        G.traffic.step(dt, null, G.cars);
        G.peds.step(dt, G.time, G.cars);
        G.effects.step(dt);
      },
    };
  }

  if (name === 'mission') {
    clearShotActors();
    const p = G.player.state;
    // Closer to the pier, on the open beach approach: the enemies sit
    // 15–25 m ahead (big enough to read) with the warehouse behind them,
    // and the player starts at full health so the frame does not end with
    // a nearly-dead hero.
    p.pos.set(-192, 0, 84);
    p.camYaw = 0;
    p.yaw = Math.PI;
    p.health = 100;
    G.missions.aimAt({ x: -176, z: 56 }, 'Storm the Pier: clear the Kross enforcers (0/6).');
    const spots = [[-200, 72], [-194, 70], [-188, 74], [-198, 78], [-190, 76], [-184, 70]];
    for (const [x, z] of spots) G.combat.spawnEnemy(x, z);
    G.combat.spawnPickup('health', -196, 84);
    let frame = 0;
    return {
      frames: 120,
      camera: 'follow',
      cam: { distance: SHOT.followDist, height: SHOT.followHeight },
      update(dt) {
        frame += 1;
        // A scripted shot every ~20 frames, timed so the last one lands two
        // frames before the screenshot: muzzle flash and tracer still fresh.
        if (frame % 20 === 18) {
          const res = G.combat.shoot(G.stage.camera, G.time,
            (enemy, point) => {
              G.effects.tracer(p.pos.x, 1.4, p.pos.z - 1, point.x, point.y, point.z);
              G.effects.impact(point.x, point.y, point.z);
              G.effects.muzzle(p.pos.x, 1.4, p.pos.z - 1);
              G.audio.gunshot();
            },
            (point) => {
              G.effects.tracer(p.pos.x, 1.4, p.pos.z - 1, point.x, point.y, point.z);
              G.effects.impact(point.x, point.y, point.z);
              G.effects.muzzle(p.pos.x, 1.4, p.pos.z - 1);
              G.audio.gunshot();
            },
            () => {});
          if (res === 'empty') G.combat.reload();
        }
        G.combat.step(dt, G.time, p.pos, G.player, G.effects);
        G.traffic.step(dt, null, G.cars);
        G.peds.step(dt, G.time, G.cars);
        G.effects.step(dt);
      },
    };
  }

  // title (and any unknown name): the live city vista behind the menu.
  clearShotActors();
  const p = G.player.state;
  p.pos.set(-52, 0, 52);
  return {
    frames: 150,
    camera: 'orbit',
    update(dt) {
      G.traffic.step(dt, null, G.cars);
      G.peds.step(dt, G.time, G.cars);
      G.effects.step(dt);
    },
  };
}
