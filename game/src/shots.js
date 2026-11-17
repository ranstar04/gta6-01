// Staged screenshot scenes behind ?shot=chase|street|mission|title (with &seed=N).
// Each one plays the REAL rules forward from a fresh seeded world for a fixed number
// of steps, steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame. No fake static renders.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { createCar } from './vehicles.js';
import { driveCar } from './vehicles.js';

// Drive the player's car forward along the boulevard with simple steering.
function autopilotDrive(game, dt, targetX, targetZ) {
  const car = game.player.car;
  if (!car) return;
  const dx = targetX - car.x;
  const dz = targetZ - car.z;
  const wantYaw = Math.atan2(dx, dz);
  let dy = wantYaw - car.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dy * 1.5));
  driveCar(car, 1, steer, false, dt, game.world.collide);
  game.player.x = car.x;
  game.player.z = car.z;
}

export function stageShot(name, game, scene, camera) {
  const player = game.player;
  const STEP = 1 / 60;

  if (name === 'chase') {
    // COVER: driving the Vesper GT down the boulevard, 2 cruisers behind, 3 stars.
    const car = createCar('vesper', 0, 110, Math.PI);
    car.driver = 'player';
    scene.add(car.mesh);
    game.traffic.parked.push(car);
    player.car = car;
    player.mesh.visible = false;
    player.x = car.x;
    player.z = car.z;
    game.police.addWanted(3);
    // Two cruisers placed manually right behind the player car (not random spawns).
    for (const [cx, cz] of [[-3, 124], [3.5, 130]]) {
      const cruiser = createCar('police', cx, cz, Math.PI);
      cruiser.driver = 'police';
      cruiser.health = 120;
      cruiser.speed = 40;
      scene.add(cruiser.mesh);
      game.police.cruisers.push(cruiser);
    }
    game.missions.update(0.01);
    // Drive forward 4.5 seconds at ~2/3 throttle so the cruisers stay on the tail.
    for (let i = 0; i < 4.5 / STEP; i++) {
      const car = game.player.car;
      const dx = 0 - car.x;
      const dz = -160 - car.z;
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      driveCar(car, 0.65, Math.max(-1, Math.min(1, dy * 1.5)), false, STEP, game.world.collide);
      game.player.x = car.x;
      game.player.z = car.z;
      game.traffic.update(STEP, car, game.pedestrians);
      game.pedestrians.update(STEP, player, car, null);
      game.police.update(STEP, player, null, null);
      game.effects.update(STEP);
    }
    // Camera: front three-quarter view — the Vesper charges toward the camera,
    // cruisers visible behind it down the boulevard.
    camera.position.set(car.x - 2, 3.6, car.z - 16);
    camera.lookAt(car.x, 1.6, car.z + 10);
    game.hud.update(game);
    game.minimap.draw(game);
    return { screen: 'play' };
  }

  if (name === 'street') {
    // On foot on a busy Calle Verde sidewalk: pedestrians, traffic, player visible.
    player.x = 47;
    player.z = 60;
    player.y = 0;
    player.camYaw = Math.PI * 0.78;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.camYaw + Math.PI;
    player.yaw = player.camYaw + Math.PI;
    // Crowd the sidewalk around the player with nearby pedestrians.
    const crowd = [
      [44, 48], [50, 52], [46, 68], [54, 66], [45, 74], [52, 44],
    ];
    game.pedestrians.peds.slice(0, 6).forEach((p, i) => {
      p.x = crowd[i][0];
      p.z = crowd[i][1];
      p.tx = crowd[i][0] + (i % 2 ? -14 : 14);
      p.tz = crowd[i][1] + (i % 3 ? 10 : -10);
      p.mesh.position.set(p.x, 0, p.z);
    });
    // Two traffic cars on the avenue beside the player, looping the block.
    const loop = [{ x: 40, z: 40 }, { x: 40, z: 80 }, { x: 80, z: 80 }, { x: 80, z: 40 }];
    for (const [type, lx, lz] of [['alba', 40, 44], ['corto', 80, 76]]) {
      const c = createCar(type, lx, lz, 0);
      c.driver = 'traffic';
      c.loop = loop;
      c.loopIndex = 0;
      c.lane = 2.2;
      c.speed = 11;
      scene.add(c.mesh);
      game.traffic.cars.push(c);
    }
    for (let i = 0; i < 4 / STEP; i++) {
      game.traffic.update(STEP, null, game.pedestrians);
      game.pedestrians.update(STEP, player, null, null);
    }
    camera.position.set(player.x + 5, 3.4, player.z + 7);
    camera.lookAt(player.x - 2, 1.6, player.z - 8);
    game.hud.update(game);
    game.minimap.draw(game);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // M5 shootout at the pier warehouse: player behind cover, enforcers, muzzle flash.
    // The fight is on the SOUTH side of the warehouse (camera side), so the
    // building never blocks the player or the enforcers.
    player.x = -132;
    player.z = -58;
    player.y = 0;
    player.camYaw = Math.PI * 1.05;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.camYaw + Math.PI;
    player.yaw = player.camYaw + Math.PI;
    // Jump the mission system to M5 so the HUD objective matches the scene.
    // (startMission spawns the 5 warehouse enforcers.)
    game.missions.jumpTo(5);
    // Let the enemies advance a little and fire once for a muzzle flash.
    for (let i = 0; i < 2.5 / STEP; i++) {
      game.combat.update(STEP, player, null);
      game.traffic.update(STEP, null, game.pedestrians);
    }
    // Camera high above the fight, looking down: player and enforcers in the
    // foreground, warehouse as the backdrop. A low camera sees roof undersides
    // (warm flat slabs); from above the city reads as rooftops and streets.
    camera.position.set(-138, 14, -88);
    camera.lookAt(-134, 1, -50);
    // One player shot for the tracer + flash in frame; advance the particles
    // a few steps so the flash is actually in the position buffer.
    game.combat.shoot(camera, player, game.ammo);
    game.effects.update(0.05);
    game.effects.update(0.05);
    game.hud.update(game);
    game.minimap.draw(game);
    return { screen: 'play' };
  }

  // Default: title — live city vista behind the menu, traffic moving.
  for (let i = 0; i < 5 / STEP; i++) {
    game.traffic.update(STEP, null, game.pedestrians);
    game.pedestrians.update(STEP, player, null, null);
  }
  camera.position.set(80, 40, 80);
  camera.lookAt(0, 4, 0);
  return { screen: 'title' };
}
