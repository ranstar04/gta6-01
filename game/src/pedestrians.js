// SOLMARA's pedestrians: walkers on the sidewalks between intersections,
// each with their own colour and pace. They flee gunfire and speeding cars,
// and getting hit by a car is a crime the wanted system notices.

import * as THREE from 'three';
import { ROADS } from './config.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8b400, 0x9a5fd8, 0xe8e0cc, 0x3d9a8a, 0xd87a3d];
const PANTS = [0x2c2c34, 0x3d4a5a, 0x5a4a3d, 0x222222];

function buildWalker(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[rng.int(0, SHIRTS.length - 1)] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[rng.int(0, PANTS.length - 1)] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const torso = new THREE.Mesh(box, shirt);
  torso.scale.set(0.5, 0.6, 0.28);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(box, skin);
  head.scale.set(0.3, 0.32, 0.3);
  head.position.y = 1.55;
  group.add(head);
  const legL = new THREE.Mesh(box, pants);
  legL.scale.set(0.16, 0.62, 0.16);
  legL.position.set(-0.13, 0.32, 0);
  group.add(legL);
  const legR = new THREE.Mesh(box, pants);
  legR.scale.set(0.16, 0.62, 0.16);
  legR.position.set(0.13, 0.32, 0);
  group.add(legR);
  const armL = new THREE.Mesh(box, shirt);
  armL.scale.set(0.12, 0.5, 0.12);
  armL.position.set(-0.32, 1.02, 0);
  group.add(armL);
  const armR = new THREE.Mesh(box, shirt);
  armR.scale.set(0.12, 0.5, 0.12);
  armR.position.set(0.32, 1.02, 0);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

function sidewalkPoint(rng) {
  // A point just off a road: on a sidewalk band next to an intersection.
  const x = rng.pick(ROADS) + rng.range(-9, 9);
  const z = rng.pick(ROADS) + rng.range(-9, 9);
  return { x, z };
}

export function createPedestrians(scene, world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const { group, legL, legR, armL, armR } = buildWalker(rng);
    const spot = sidewalkPoint(rng);
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    peds.push({
      mesh: group, legL, legR, armL, armR,
      pos: group.position,
      yaw: rng.range(0, Math.PI * 2),
      target: sidewalkPoint(rng),
      speed: rng.range(1.3, 2.4),
      phase: rng.range(0, Math.PI * 2),
      fleeUntil: 0,
      fleeFrom: null,
      down: false,
    });
  }

  /** A gunshot or a near miss at (x, z) sends nearby walkers running. */
  function scare(x, z, radius) {
    for (const ped of peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
        ped.fleeUntil = performance.now() / 1000 + 2.5;
        ped.fleeFrom = { x, z };
      }
    }
  }

  function step(dt, now, cars) {
    for (const ped of peds) {
      if (ped.down) continue;
      let speed = ped.speed;
      let tx = ped.target.x;
      let tz = ped.target.z;
      if (now < ped.fleeUntil && ped.fleeFrom) {
        // Run away from the scare, fast.
        speed = 5.5;
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 20;
        tz = ped.pos.z + (dz / d) * 20;
      } else {
        // A speeding car close by is also worth running from.
        for (const car of cars) {
          if (car.wrecked || Math.abs(car.speed) < 8) continue;
          if (Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z) < 7) {
            ped.fleeUntil = now + 2;
            ped.fleeFrom = { x: car.pos.x, z: car.pos.z };
            break;
          }
        }
      }
      const dx = tx - ped.pos.x;
      const dz = tz - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        ped.target = sidewalkPoint(rng);
        continue;
      }
      const wantYaw = Math.atan2(dx, dz);
      let diff = wantYaw - ped.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.yaw += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.pos.x += Math.sin(ped.yaw) * speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * speed * dt;
      world.collideCircle(ped.pos, 0.4);
      world.clampToLand(ped.pos);
      ped.phase += dt * speed * 3.2;
      const swing = Math.sin(ped.phase) * 0.55;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
      ped.armL.rotation.x = -swing * 0.7;
      ped.armR.rotation.x = swing * 0.7;
      ped.mesh.rotation.y = ped.yaw;
    }
  }

  /** Move a walker to a spot with a fresh destination (staging, taxi fares). */
  function moveTo(ped, x, z, tx, tz) {
    ped.pos.set(x, 0, z);
    ped.target = { x: tx, z: tz };
    ped.fleeUntil = 0;
    ped.fleeFrom = null;
  }

  return { peds, step, scare, moveTo };
}
