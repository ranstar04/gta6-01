// SOLMARA's cars: box-built models with spinning, steering wheels, arcade
// driving physics, enter/exit/steal, and damage smoke. One car object serves
// the player, traffic and police — only the driver input differs.

import * as THREE from 'three';
import { CARS } from './config.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x141414 });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0x1c2f42 });
const LIGHT_FRONT = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833 });
const LIGHT_BACK = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x661111 });
const CHROME = new THREE.MeshLambertMaterial({ color: 0xcfd6dd });

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

/** Build the visible model for a car type. Returns { group, wheels, steerWheels }. */
export function buildCarMesh(type) {
  const spec = CARS[type];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: spec.color });
  const L = spec.length;
  const W = spec.width;

  const body = box(W, 0.62, L, paint);
  body.position.y = 0.55;
  group.add(body);

  if (type === 'bruto') {
    const cab = box(W - 0.2, 0.9, 1.4, paint);
    cab.position.set(0, 1.25, L / 2 - 0.9);
    group.add(cab);
    const bed = box(W - 0.1, 0.5, L - 2.2, new THREE.MeshLambertMaterial({ color: 0x4a4a48 }));
    bed.position.set(0, 1.05, -0.8);
    group.add(bed);
  } else {
    const cabin = box(W - 0.35, 0.6, L * 0.45, GLASS_MAT);
    cabin.position.set(0, 1.1, -L * 0.06);
    group.add(cabin);
    const roof = box(W - 0.3, 0.1, L * 0.42, paint);
    roof.position.set(0, 1.44, -L * 0.06);
    group.add(roof);
  }

  if (type === 'cruiser') {
    const roofWhite = box(W - 0.3, 0.12, L * 0.3, CHROME);
    roofWhite.position.set(0, 1.42, -L * 0.06);
    group.add(roofWhite);
    const bar = box(1.0, 0.16, 0.3, new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x112266 }));
    bar.position.set(0, 1.56, -L * 0.06);
    group.add(bar);
    const barR = box(0.45, 0.16, 0.3, new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x661111 }));
    barR.position.set(-0.28, 1.56, -L * 0.06);
    group.add(barR);
  }
  if (type === 'corto') {
    const sign = box(0.9, 0.22, 0.4, new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0x333333 }));
    sign.position.set(0, 1.56, -L * 0.06);
    group.add(sign);
  }

  const headL = box(0.32, 0.14, 0.08, LIGHT_FRONT);
  headL.position.set(-W / 2 + 0.3, 0.62, L / 2 + 0.02);
  group.add(headL);
  const headR = box(0.32, 0.14, 0.08, LIGHT_FRONT);
  headR.position.set(W / 2 - 0.3, 0.62, L / 2 + 0.02);
  group.add(headR);
  const tailL = box(0.32, 0.14, 0.08, LIGHT_BACK);
  tailL.position.set(-W / 2 + 0.3, 0.62, -L / 2 - 0.02);
  group.add(tailL);
  const tailR = box(0.32, 0.14, 0.08, LIGHT_BACK);
  tailR.position.set(W / 2 - 0.3, 0.62, -L / 2 - 0.02);
  group.add(tailR);

  const wheels = [];
  const steerWheels = [];
  for (const [wx, wz, steer] of [
    [-W / 2 + 0.1, L / 2 - 0.9, true],
    [W / 2 - 0.1, L / 2 - 0.9, true],
    [-W / 2 + 0.1, -L / 2 + 0.9, false],
    [W / 2 - 0.1, -L / 2 + 0.9, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (steer) steerWheels.push(pivot);
  }
  return { group, wheels, steerWheels };
}

export function createCar(scene, type, x, z, yaw, opts = {}) {
  const spec = CARS[type];
  const { group, wheels, steerWheels } = buildCarMesh(type);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  scene.add(group);
  return {
    type, spec, mesh: group, wheels, steerWheels,
    pos: group.position,
    yaw,
    speed: 0,
    steer: 0,
    health: 100,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | 'parked' | null
    ai: null,
    smokeTimer: 0,
    wrecked: false,
    id: opts.id ?? 0,
  };
}

/**
 * One fixed step of arcade driving. `drive` is { throttle: -1..1, steer: -1..1,
 * handbrake: bool }. Returns true when the car hit something hard.
 */
export function stepCar(car, dt, world, drive, others) {
  const spec = car.spec;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12 + 0.25);
  const targetSteer = drive.steer * 0.55 * (drive.handbrake ? 1.25 : 1) * (car.speed >= 0 ? 1 : -1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);

  if (drive.throttle > 0) car.speed += spec.accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    if (car.speed > 0.5) car.speed += spec.brake * drive.throttle * dt;
    else car.speed += spec.accel * 0.55 * drive.throttle * dt; // reverse
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.35 * dt;
  if (drive.handbrake) car.speed -= car.speed * 1.4 * dt;
  car.speed = Math.max(-11, Math.min(spec.topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05 && drive.throttle === 0) car.speed = 0;

  car.yaw += car.steer * car.speed * dt * 0.32;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;

  // Buildings stop the car; a hard hit costs speed and health.
  const radius = spec.length / 2;
  if (world.collideCircle(car.pos, radius)) {
    const lost = Math.abs(car.speed);
    car.speed *= 0.35;
    if (lost > 9) {
      car.health = Math.max(0, car.health - (lost - 9) * 1.6);
      return true;
    }
  }
  // Soft car-car shove: both slow down, no tunnelling.
  if (others) {
    for (const other of others) {
      if (other === car || other.wrecked) continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const min = (spec.length + other.spec.length) / 2 - 0.4;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        car.pos.x += (dx / d) * push;
        car.pos.z += (dz / d) * push;
        car.speed *= 0.8;
        other.speed *= 0.8;
      }
    }
  }
  world.clampToLand(car.pos);
  car.mesh.rotation.y = car.yaw;
  for (const pivot of car.steerWheels) pivot.rotation.y = car.steer * 0.9;
  const spin = (car.speed * dt) / 0.36;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  if (car.health <= 0) car.wrecked = true;
  return false;
}

/** The nearest car to (x, z) within maxDist, or null. */
export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
