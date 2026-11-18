// Pedestrians: sidewalk walkers between waypoints, distinct colours, limbs
// swinging. They flee from gunfire and speeding cars; getting hit raises wanted.
// One of them can carry the yellow TAXI flag for the taxi-fare activity.
import * as THREE from 'three';
import { pick, range } from './random.js';

const SHIRTS = [0xd96a5f, 0x5f8ad9, 0x7fb069, 0xe0a458, 0x9b7fd9, 0x4db6ac, 0xe8e8e8, 0x2c2f36];

export function createPedestrians(scene, world, rng, count) {
  const peds = [];
  const shirtMat = SHIRTS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a077 });

  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.32), shirtMat[i % shirtMat.length]);
    torso.position.y = 1.05;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
    head.position.y = 1.56;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), pantsMat);
    legL.position.set(-0.14, 0.38, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(legR);
    scene.add(group);
    const p = world.randomSidewalkPoint();
    peds.push({
      group, legL, legR,
      pos: new THREE.Vector3(p.x, 0, p.z),
      target: world.randomSidewalkPoint(),
      speed: range(rng, 1.1, 1.9),
      heading: 0, phase: rng() * 6,
      flee: 0, taxi: false, down: false,
    });
  }

  // The taxi flag: one walker near the stand carries it.
  function flagTaxi() {
    for (const p of peds) p.taxi = false;
    const near = peds.filter((p) => Math.hypot(p.pos.x - 0, p.pos.z - 120) < 90);
    const chosen = near.length ? pick(rng, near) : peds[0];
    chosen.taxi = true;
    return chosen;
  }

  return {
    peds, flagTaxi,
    reset() {
      for (const p of peds) {
        const q = world.randomSidewalkPoint();
        p.pos.set(q.x, 0, q.z);
        p.target = world.randomSidewalkPoint();
        p.flee = 0;
        p.down = false;
        p.taxi = false;
        p.group.visible = true;
        p.group.position.copy(p.pos);
      }
      flagTaxi();
    },
    update(dt, G) {
      for (const p of peds) {
        if (p.down) continue;
        if (p.flee > 0) p.flee -= dt;
        const dx = p.target.x - p.pos.x;
        const dz = p.target.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) {
          p.target = p.flee > 0 ? { x: p.pos.x + range(rng, -60, 60), z: p.pos.z + range(rng, -60, 60) } : world.randomSidewalkPoint();
          continue;
        }
        const sp = p.flee > 0 ? p.speed * 2.6 : p.speed;
        p.pos.x += (dx / d) * sp * dt;
        p.pos.z += (dz / d) * sp * dt;
        p.heading = Math.atan2(dx, dz);
        p.phase += dt * sp * 3.2;
        p.group.position.copy(p.pos);
        p.group.rotation.y = p.heading;
        const swing = Math.sin(p.phase) * 0.5;
        p.legL.rotation.x = swing;
        p.legR.rotation.x = -swing;
        // Flee from gunfire / speeding cars nearby.
        if (G.combat.gunfireAt) {
          const gd = Math.hypot(p.pos.x - G.combat.gunfireAt.x, p.pos.z - G.combat.gunfireAt.z);
          if (gd < 26) p.flee = 3;
        }
        const pc = G.playerCar;
        if (pc && Math.abs(pc.speed) > 14) {
          const cd = Math.hypot(p.pos.x - pc.pos.x, p.pos.z - pc.pos.z);
          if (cd < 14) p.flee = 2.5;
        }
      }
    },
    scareAll(x, z, radius) {
      for (const p of peds) {
        if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) p.flee = 3;
      }
    },
  };
}
