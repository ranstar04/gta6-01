// Cars: procedural box-built models, arcade driving physics, enter/exit/steal,
// damage + smoke. A car is one object; traffic and police reuse the same model
// and physics, only the driver differs.
import * as THREE from 'three';
import { CAR, CAR_TYPES } from './config.js';

export function buildCarMesh(type, colorOverride) {
  const def = CAR_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorOverride || def.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const L = def.length;
  const W = def.width;
  const bodyH = def.truck ? 1.5 : 0.72;
  const bodyY = def.truck ? 1.05 : 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, L), bodyMat);
  body.position.y = bodyY;
  group.add(body);
  if (def.truck) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 1.1, 1.4), bodyMat);
    cab.position.set(0, 1.9, L / 2 - 0.9);
    group.add(cab);
    const load = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 1.0, L * 0.45), darkMat);
    load.position.set(0, 2.0, -L * 0.2);
    group.add(load);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.62, L * 0.45), glassMat);
    cabin.position.set(0, bodyY + bodyH / 2 + 0.28, -L * 0.05);
    group.add(cabin);
  }
  if (def.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.3, L * 0.9), new THREE.MeshLambertMaterial({ color: 0x2e5fd8 }));
    stripe.position.y = bodyY + 0.1;
    group.add(stripe);
    const barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    barL.position.set(-0.4, bodyY + bodyH / 2 + 0.72, 0);
    group.add(barL);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    barR.position.set(0.4, bodyY + bodyH / 2 + 0.72, 0);
    group.add(barR);
    group.userData.lightL = barL;
    group.userData.lightR = barR;
  }
  // Headlights + taillights (small emissive boxes).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), headMat);
    h.position.set(sx * (W / 2 - 0.3), bodyY, L / 2 + 0.02);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(sx * (W / 2 - 0.3), bodyY, -L / 2 - 0.02);
    group.add(t);
  }
  // Wheels: cylinders spun 90° so they roll around the X axis.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  const wheelY = 0.36;
  const wheelZ = L / 2 - 0.85;
  const wheelX = W / 2 - 0.1;
  for (const [wx, wz] of [[-wheelX, wheelZ], [wheelX, wheelZ], [-wheelX, -wheelZ], [wheelX, -wheelZ]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, wheelY, wz);
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createCar(type, x, z, heading, colorOverride) {
  const def = CAR_TYPES[type];
  const group = buildCarMesh(type, colorOverride);
  return {
    type, def, group,
    pos: new THREE.Vector3(x, 0, z),
    heading, speed: 0, steer: 0,
    damage: 0, driver: null, // 'player' | 'traffic' | 'police' | 'parked'
    length: def.length, width: def.width,
    smokeTimer: 0, stuck: 0,
  };
}

function resolveCarCircle(car, colliders) {
  const r = CAR.radius;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(car.pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(car.pos.z, c.maxZ));
    const dx = car.pos.x - nx;
    const dz = car.pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        car.pos.x = nx + (dx / d) * r;
        car.pos.z = nz + (dz / d) * r;
      } else {
        car.pos.x = c.maxX + r;
      }
      if (Math.abs(car.speed) > 4) {
        car.damage = Math.min(100, car.damage + CAR.damagePerHit);
        car.speed *= 0.45;
      } else {
        car.speed *= 0.5;
      }
    }
  }
}

export function driveCar(car, dt, throttle, steerInput, handbrake, colliders, others) {
  const def = car.def;
  const maxF = def.maxSpeed;
  const maxR = CAR.maxReverse;
  // Throttle: +1 forward, -1 brake/reverse.
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > maxF) car.speed = maxF;
  if (car.speed < -maxR) car.speed = -maxR;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  // Steering: less at speed, more grip normally, loose with the handbrake.
  const speedFactor = 1 - Math.min(0.55, Math.abs(car.speed) / maxF * 0.55);
  const targetSteer = steerInput * def.steer * speedFactor;
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  car.steer += (targetSteer - car.steer) * Math.min(1, grip * dt);
  const turnRate = car.steer * (car.speed / 6) * (handbrake ? 1.5 : 1);
  car.heading += turnRate * dt;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  resolveCarCircle(car, colliders);
  // Car-car push-apart (circles).
  for (const o of others) {
    if (o === car) continue;
    const dx = car.pos.x - o.pos.x;
    const dz = car.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    const min = 2.6;
    if (d > 0.001 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      car.pos.x += ux * push;
      car.pos.z += uz * push;
      o.pos.x -= ux * push;
      o.pos.z -= uz * push;
      if (Math.abs(car.speed) > 6 || Math.abs(o.speed) > 6) {
        car.damage = Math.min(100, car.damage + 4);
        car.speed *= 0.7;
        o.speed *= 0.7;
      }
    }
  }
  // Visuals: wheels spin + steer, body leans a touch.
  const wheels = car.group.userData.wheels;
  if (wheels) {
    for (let i = 0; i < wheels.length; i += 1) {
      wheels[i].rotation.x += car.speed * dt * 1.4;
      if (i < 2) wheels[i].rotation.y = car.steer * 0.9;
    }
  }
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.heading;
  car.group.rotation.z = -car.steer * Math.min(0.06, Math.abs(car.speed) * 0.002);
  if (car.damage > 55) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.22;
      return { smoke: true };
    }
  }
  return null;
}

export function carCameraTarget(car) {
  // Front camera looking back at the car (used by the chase shot): the camera
  // sits AHEAD of the car and looks back at it. Normal driving uses behind-car.
  const d = 11;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  return {
    behind: {
      pos: new THREE.Vector3(car.pos.x - fx * d, 4.2, car.pos.z - fz * d),
      look: new THREE.Vector3(car.pos.x + fx * 6, 1.6, car.pos.z + fz * 6),
    },
    front: {
      pos: new THREE.Vector3(car.pos.x + fx * d * 1.45, 4.5, car.pos.z + fz * d * 1.45),
      look: new THREE.Vector3(car.pos.x, 1.8, car.pos.z),
    },
  };
}
