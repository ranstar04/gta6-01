// Pedestrians: sidewalk walkers between waypoints; they flee from gunfire and
// speeding cars, and getting hit raises the wanted level. Distinct colours/outfits.
import * as THREE from 'three';
import { TUNE, WORLD } from './config.js';
import { mulberry32, range, pick, dist2D, clamp } from './random.js';

const SHIRTS = [0xe05a5a, 0x5a8de0, 0x5ac07a, 0xe0c25a, 0x9a5ac0, 0xe08a5a, 0x5ac0c0, 0xd0d0d0];
const PANTS = [0x2b2d42, 0x4a3a2a, 0x3a4a2b, 0x222222, 0x5a5a6a];

function buildPedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, [0xc98a5e, 0x8a5a3a, 0xe8b890, 0x6a4a2a]), roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.76;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legL.position.set(-0.15, 0.4, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.19), shirt);
  armL.position.set(-0.38, 1.18, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.38;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPedestrians(scene, world, seed) {
  const rng = mulberry32(seed ^ 0x9ed5);
  const peds = [];
  for (let i = 0; i < TUNE.pedCount; i++) {
    const p = world.sidewalkPoint(rng);
    const mesh = buildPedMesh(rng);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const target = world.sidewalkPoint(rng);
    peds.push({
      mesh, x: p.x, z: p.z, tx: target.x, tz: target.z,
      speed: range(rng, 1.2, 2.2), yaw: 0, phase: rng() * 6,
      fleeing: false, fleeTimer: 0, down: false,
    });
  }

  function update(dt, player, playerCar, gunfireAt) {
    for (const p of peds) {
      if (p.down) continue;
      // Flee from gunfire or a speeding car nearby.
      let threat = null;
      if (gunfireAt && dist2D(p.x, p.z, gunfireAt.x, gunfireAt.z) < 18) threat = gunfireAt;
      if (playerCar && Math.abs(playerCar.speed) > 12 && dist2D(p.x, p.z, playerCar.x, playerCar.z) < 10) {
        threat = { x: playerCar.x, z: playerCar.z };
      }
      if (threat) {
        p.fleeing = true;
        p.fleeTimer = 2.5;
        const dx = p.x - threat.x;
        const dz = p.z - threat.z;
        const d = Math.hypot(dx, dz) || 1;
        // Flee target clamped to the playable bounds: an unclamped 20-unit
        // dash could send a ped past the world edge or into the ocean, where
        // they would keep walking on water forever.
        p.tx = clamp(p.x + (dx / d) * 20, -WORLD.bound, WORLD.bound);
        p.tz = clamp(p.z + (dz / d) * 20, -WORLD.bound, WORLD.bound);
      }
      if (p.fleeTimer > 0) {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) p.fleeing = false;
      }
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        const np = world.sidewalkPoint(rng);
        p.tx = np.x;
        p.tz = np.z;
        continue;
      }
      const sp = p.fleeing ? p.speed * 2.6 : p.speed;
      p.yaw = Math.atan2(dx, dz);
      p.x += (dx / dist) * sp * dt;
      p.z += (dz / dist) * sp * dt;
      p.phase += dt * sp * 4;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.yaw;
      const swing = Math.sin(p.phase) * 0.55;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }

  // A car hit a pedestrian: they go down, the caller raises wanted.
  function hitByCar(car) {
    let hit = null;
    for (const p of peds) {
      if (p.down) continue;
      if (dist2D(p.x, p.z, car.x, car.z) < 2.2) {
        p.down = true;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.position.y = 0.4;
        hit = p;
        break;
      }
    }
    return hit;
  }

  return { peds, update, hitByCar };
}
