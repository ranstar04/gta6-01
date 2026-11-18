// Car models (procedural low-poly, built from boxes) + arcade driving physics,
// enter / exit / steal, damage + smoke. One job per car object.
import * as THREE from 'three';
import { PALETTE, TUNE } from './config.js';
import { clamp, dist2D } from './random.js';

export const CAR_TYPES = {
  vesper: { name: 'Vesper GT', color: PALETTE.carVesper, len: 4.4, wid: 2.0, top: 1.15, maxSpeed: 46, accel: 30 },
  alba: { name: 'Alba', color: PALETTE.carAlba, len: 4.2, wid: 1.9, top: 1.3, maxSpeed: 34, accel: 24 },
  corto: { name: 'Corto Taxi', color: PALETTE.carCorto, len: 4.2, wid: 1.9, top: 1.35, maxSpeed: 34, accel: 24 },
  bruto: { name: 'Bruto', color: PALETTE.carBruto, len: 5.6, wid: 2.2, top: 2.2, maxSpeed: 28, accel: 18 },
  vela: { name: 'Vela', color: PALETTE.carVela, len: 4.8, wid: 2.1, top: 1.9, maxSpeed: 30, accel: 20 },
  police: { name: 'Patrol Interceptor', color: PALETTE.carPolice, len: 4.4, wid: 2.0, top: 1.3, maxSpeed: 40, accel: 28 },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.6 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xc02020, emissive: 0x800000, emissiveIntensity: 0.6 });

export function buildCarMesh(type) {
  const t = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.35, metalness: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(t.wid, 0.62, t.len), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.82, t.top, t.len * 0.5), glassMat);
  cabin.position.set(0, 0.95 + t.top / 2 - 0.15, -t.len * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  if (type === 'bruto' || type === 'vela') {
    // Cargo box instead of a low cabin.
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.95, t.top, t.len * 0.55), bodyMat);
    cargo.position.set(0, 0.9 + t.top / 2 - 0.2, -t.len * 0.18);
    cargo.castShadow = true;
    g.add(cargo);
  }
  // Headlights + taillights.
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), lightMat);
    hl.position.set(sx * (t.wid / 2 - 0.35), 0.62, t.len / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tl.position.set(sx * (t.wid / 2 - 0.35), 0.62, -t.len / 2 - 0.01);
    g.add(tl);
  }
  if (type === 'corto') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf2b705, emissiveIntensity: 0.7 }),
    );
    sign.position.set(0, 1.75, 0);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244aa, emissive: 0x2244ff, emissiveIntensity: 1.2 }),
    );
    bar.position.set(0, 1.85, 0);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  // Wheels (spin + front steer).
  const wheels = [];
  const wx = t.wid / 2 - 0.05;
  const wz = t.len / 2 - 0.8;
  for (const [x, z, front] of [[-wx, wz, true], [wx, wz, true], [-wx, -wz, false], [wx, -wz, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, front });
  }
  g.userData.wheels = wheels;
  return g;
}

export function createCar(type, x, z, yaw) {
  const t = CAR_TYPES[type];
  return {
    type, name: t.name, mesh: buildCarMesh(type),
    x, z, yaw, speed: 0, steer: 0,
    health: 100, maxSpeed: t.maxSpeed, accel: t.accel,
    len: t.len, wid: t.wid,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    wanted: false,
    smokeTimer: 0,
  };
}

// Arcade drive step: throttle -1..1, steer -1..1. Returns events for sound/effects.
export function driveCar(car, throttle, steer, handbrake, dt, collideFn) {
  const targetSteer = steer * TUNE.carSteer * clamp(1 - Math.abs(car.speed) / 60, 0.35, 1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (handbrake) {
    car.speed *= Math.pow(0.05, dt);
  } else if (throttle > 0) {
    // Partial throttle caps the speed: a light foot cruises slower than flat-out.
    const cap = car.maxSpeed * (0.4 + 0.6 * throttle);
    if (car.speed < cap) car.speed += car.accel * throttle * dt;
    else car.speed += (cap - car.speed) * Math.min(1, dt * 2);
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= TUNE.carBrake * dt;
    else car.speed -= TUNE.carReverse * dt;
  } else {
    car.speed *= Math.pow(0.4, dt);
  }
  car.speed = clamp(car.speed, -TUNE.carReverse, car.maxSpeed);
  // Damage slows the car.
  if (car.health < 40) car.speed = clamp(car.speed, -TUNE.carReverse, car.maxSpeed * 0.55);
  car.yaw += (car.steer * car.speed * dt) / 3.2;
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  const fixed = collideFn(nx, nz, car.len / 2);
  const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
  if (hitWall && Math.abs(car.speed) > 8) {
    // Floor health at 0: a wrecked car stays wrecked, it never goes negative.
    car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.5);
    car.speed *= 0.35;
  }
  car.x = fixed.x;
  car.z = fixed.z;
  // Mesh sync.
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.yaw;
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.mesh.userData.wheels) {
    w.pivot.children[0].rotation.x += spin;
    if (w.front) w.pivot.rotation.y = car.steer * 0.4;
  }
  // Body roll + pitch for feel.
  car.mesh.rotation.z = -car.steer * Math.min(Math.abs(car.speed) / 40, 1) * 0.06;
  return { hitWall, speed: car.speed };
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = dist2D(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
