// SOLMARA's wanted system and police: stars that rise with crimes and fade
// when the heat dies down, cruisers that spawn on the roads and ram the player,
// foot officers at high heat, and the BUSTED / spray-shop rules.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar, stepCar } from './vehicles.js';

export function createPolice(scene, world, rng) {
  const state = {
    stars: 0,
    lastCrimeAt: -99,
    cruisers: [],
    officers: [],
    pinnedTimer: 0,
    busted: false,
  };

  function addStars(n, now) {
    state.stars = Math.max(0, Math.min(5, state.stars + n));
    state.lastCrimeAt = now;
  }

  function spawnCruiser(playerPos, allCars) {
    // On a road 60–110 m away, so it arrives with sirens instead of popping in.
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(60, 110);
    let x = playerPos.x + Math.sin(angle) * dist;
    let z = playerPos.z + Math.cos(angle) * dist;
    const snapped = world.snapToRoad(x, z);
    x = snapped.x;
    z = snapped.z;
    const car = createCar(scene, 'cruiser', x, z, 0, { driver: 'police', id: 200 + state.cruisers.length });
    state.cruisers.push(car);
    // Register with the shared car list, or traffic and the player's car
    // would drive straight through the cruiser (and its despawn splice
    // in step() would never find it).
    if (Array.isArray(allCars)) allCars.push(car);
    return car;
  }

  function spawnOfficer(playerPos) {
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a44 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const torso = new THREE.Mesh(box, navy);
    torso.scale.set(0.56, 0.68, 0.3);
    torso.position.y = 1.1;
    group.add(torso);
    const head = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0xc98a5e }));
    head.scale.set(0.32, 0.34, 0.32);
    head.position.y = 1.66;
    group.add(head);
    const cap = new THREE.Mesh(box, navy);
    cap.scale.set(0.36, 0.1, 0.36);
    cap.position.y = 1.86;
    group.add(cap);
    group.position.set(playerPos.x + rng.range(-30, 30), 0, playerPos.z + rng.range(-30, 30));
    scene.add(group);
    const officer = { mesh: group, pos: group.position, yaw: 0, speed: 5.2 };
    state.officers.push(officer);
    return officer;
  }

  function step(dt, now, playerPos, playerCar, allCars, onBusted) {
    // Stars fade once the player has been quiet and unseen for a while.
    if (state.stars > 0 && now - state.lastCrimeAt > WANTED.decayDelay) {
      state.stars = Math.max(0, state.stars - WANTED.decayPerSec * dt);
    }
    const wanted = Math.floor(state.stars + 0.001);

    // Cruisers: one per star up to the cap, chasing the player.
    const wantCruisers = wanted >= 1 ? Math.min(wanted + 1, WANTED.maxCruisers) : 0;
    while (state.cruisers.length < wantCruisers) spawnCruiser(playerPos, allCars);
    while (state.cruisers.length > wantCruisers) {
      const car = state.cruisers.pop();
      scene.remove(car.mesh);
      const i = allCars.indexOf(car);
      if (i >= 0) allCars.splice(i, 1);
    }
    for (const car of state.cruisers) {
      if (car.wrecked) continue;
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz);
      let diff = wantYaw - car.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.8));
      // Hold off at a distance in a chase: a cruiser glued to the bumper
      // grinds both cars to a halt through the car-car shove. On foot it
      // closes in, so a bust can still happen.
      const holdDist = playerCar ? 12 : 2.5;
      const throttle = dist > holdDist + 18 ? 1 : dist > holdDist ? 0.5 : 0;
      stepCar(car, dt, world, { throttle, steer, handbrake: false }, allCars);
    }

    // Foot officers at 3+ stars, on foot only.
    const wantOfficers = wanted >= 3 && !playerCar ? 2 : 0;
    while (state.officers.length < wantOfficers) spawnOfficer(playerPos);
    while (state.officers.length > wantOfficers) {
      const o = state.officers.pop();
      scene.remove(o.mesh);
    }
    for (const o of state.officers) {
      const dx = playerPos.x - o.pos.x;
      const dz = playerPos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.6) {
        o.yaw = Math.atan2(dx, dz);
        o.pos.x += Math.sin(o.yaw) * o.speed * dt;
        o.pos.z += Math.cos(o.yaw) * o.speed * dt;
        o.mesh.rotation.y = o.yaw;
      }
    }

    // BUSTED: a cruiser (or officer) pins the player on foot for ~2 seconds.
    if (!playerCar && wanted >= 1) {
      let pinned = false;
      for (const car of state.cruisers) {
        if (!car.wrecked && Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) < 3.2) pinned = true;
      }
      for (const o of state.officers) {
        if (Math.hypot(o.pos.x - playerPos.x, o.pos.z - playerPos.z) < 1.8) pinned = true;
      }
      state.pinnedTimer = pinned ? state.pinnedTimer + dt : 0;
      if (state.pinnedTimer > 2 && !state.busted) {
        state.busted = true;
        onBusted();
      }
    } else {
      state.pinnedTimer = 0;
    }
    return wanted;
  }

  /** The spray shop: pay to repaint and clear the heat. */
  function sprayShop(money) {
    if (money < WANTED.sprayCost || state.stars < 0.5) return { ok: false, money };
    state.stars = 0;
    return { ok: true, money: money - WANTED.sprayCost };
  }

  function reset() {
    state.stars = 0;
    state.busted = false;
    state.pinnedTimer = 0;
    for (const car of state.cruisers) scene.remove(car.mesh);
    state.cruisers.length = 0;
    for (const o of state.officers) scene.remove(o.mesh);
    state.officers.length = 0;
  }

  return { state, addStars, step, sprayShop, reset };
}
