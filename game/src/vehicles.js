// Cars: procedural box-built models, arcade driving physics, enter/exit/steal,
// damage + smoke, chase camera. Forward is +z; yaw = rotation.y; forward vector
// is (sin(yaw), 0, cos(yaw)), the same convention as the player.
import * as THREE from 'three';
import { CAR_TYPES, CAR_COLORS } from './config.js';
import { collideCircle, clampWorldBounds, isOnRoad, dist2D } from './world.js';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function buildCarModel(type, color) {
  const spec = CAR_TYPES[type];
  const g = new THREE.Group();
  const L = spec.len;
  const W = spec.wid;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a1d24 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  if (spec.truck) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.95, 1.5), glassMat);
    cab.position.set(0, 1.35, L / 2 - 0.95);
    g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.5, L - 2.2), bodyMat);
    bed.position.set(0, 1.05, -0.8);
    g.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.55, L * 0.52), glassMat);
    cabin.position.set(0, 1.18, -L * 0.04);
    g.add(cabin);
  }
  const wheelGeo = new THREE.CylinderGeometry(spec.truck ? 0.55 : 0.42, spec.truck ? 0.55 : 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = {};
  const spots = [
    ['fl', -W / 2, L * 0.32], ['fr', W / 2, L * 0.32],
    ['rl', -W / 2, -L * 0.32], ['rr', W / 2, -L * 0.32],
  ];
  for (const [name, x, z] of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, spec.truck ? 0.55 : 0.42, z);
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    pivot.add(wheel);
    g.add(pivot);
    wheels[name] = { pivot, wheel };
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffedb0 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x7a1010 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(sx * (W / 2 - 0.4), 0.66, L / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(sx * (W / 2 - 0.4), 0.66, -L / 2 - 0.02);
    g.add(tail);
  }
  if (spec.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x8a6d00 }),
    );
    sign.position.set(0, 1.62, -L * 0.04);
    g.add(sign);
  }
  if (spec.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.2, L * 0.7), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
    stripe.position.set(0, 0.72, 0);
    g.add(stripe);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xaa0000 }));
    barR.position.set(-0.35, 1.5, -L * 0.04);
    g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x0000aa }));
    barB.position.set(0.35, 1.5, -L * 0.04);
    g.add(barB);
  }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.5, L + 0.5),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return { group: g, wheels };
}

export function spawnCarAt(S, type, x, z, yaw, opts = {}) {
  const spec = CAR_TYPES[type];
  const color = opts.color ?? spec.color;
  const { group, wheels } = buildCarModel(type, color);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  S.scene.add(group);
  const car = {
    type, spec, group, wheels,
    yaw, speed: 0, steer: 0,
    health: 100, dead: false,
    driver: opts.driver || null, // 'ped' | 'player' | 'police' | null
    isPolice: !!spec.police,
    color,
    smokeT: 0,
  };
  S.cars.push(car);
  return car;
}

function nearestCar(S, x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = dist2D(x, z, car.group.position.x, car.group.position.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function witnessesNear(S, x, z, radius) {
  for (const c of S.police.cruisers) {
    if (dist2D(x, z, c.group.position.x, c.group.position.z) < radius) return true;
  }
  for (const p of S.peds.list) {
    if (p.state !== 'down' && dist2D(x, z, p.group.position.x, p.group.position.z) < radius * 0.6) return true;
  }
  return false;
}

export function tryEnterCar(S) {
  const p = S.player.group.position;
  const car = nearestCar(S, p.x, p.z, 4.2);
  if (!car) return false;
  if (car.driver === 'ped') {
    // Jack the driver: he flees on foot, the car is yours.
    S.peds.fleeFrom(car.group.position.x, car.group.position.z);
    car.driver = null;
  }
  if (car.driver === 'police') {
    S.police.addStars(2, 'Stole a police cruiser!');
    S.hud.feed('You stole a police cruiser! +2 stars');
  } else if (witnessesNear(S, p.x, p.z, 40)) {
    S.police.addStars(1, 'Car stolen in view');
    S.hud.feed('Car stolen — someone saw you! +1 star');
  }
  car.driver = 'player';
  S.playerCar = car;
  S.player.group.visible = false;
  S.audio.honk();
  return true;
}

export function exitCar(S) {
  const car = S.playerCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  S.playerCar = null;
  const p = S.player.group.position;
  const side = car.yaw + Math.PI / 2;
  p.set(car.group.position.x + Math.sin(side) * 2.2, 0, car.group.position.z + Math.cos(side) * 2.2);
  S.player.group.visible = true;
  S.player.yaw = car.yaw;
}

export function damageCar(S, car, n) {
  if (car.dead) return;
  car.health -= n;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
    if (car === S.playerCar) S.hud.feed('Your car is wrecked — press E to get out');
    S.effects.burst(car.group.position.x, 1.2, car.group.position.z, 0x555555, 14, 3, 1.2);
  }
}

export function updatePlayerCar(S, dt) {
  const car = S.playerCar;
  if (!car) return;
  const input = S.input;
  const axis = input.moveAxis();
  const spec = car.spec;
  const handbrake = input.down('Space');

  if (!car.dead) {
    if (axis.y > 0) car.speed += spec.accel * dt;
    else if (axis.y < 0) {
      car.speed += car.speed > 0.5 ? -spec.brake * dt : -spec.accel * 0.7 * dt;
    } else {
      car.speed -= car.speed * 0.55 * dt;
    }
    car.speed = Math.max(-spec.top * 0.4, Math.min(spec.top, car.speed));
    if (handbrake) car.speed *= Math.max(0, 1 - 2.2 * dt);
    const speedFactor = Math.max(-1, Math.min(1, car.speed / 12));
    const targetSteer = axis.x * spec.steer;
    car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
    car.yaw += car.steer * speedFactor * 1.9 * dt;
    if (handbrake && Math.abs(car.speed) > 6) car.yaw += axis.x * 0.9 * dt;
  } else {
    car.speed *= Math.max(0, 1 - 2 * dt);
  }

  const pos = car.group.position;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  pos.x += fx * car.speed * dt;
  pos.z += fz * car.speed * dt;
  const radius = spec.len * 0.42;
  if (collideCircle(pos, radius, S.colliders)) {
    if (Math.abs(car.speed) > 4) {
      damageCar(S, car, Math.abs(car.speed) * 0.7);
      S.effects.sparks(pos.x, 0.8, pos.z);
      S.effects.shake(0.4);
      S.audio.thud();
    }
    car.speed *= -0.25;
  }
  clampWorldBounds(pos, radius);

  // Bump into other cars: shove apart, trade a little speed.
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const op = other.group.position;
    const d = dist2D(pos.x, pos.z, op.x, op.z);
    const min = radius + other.spec.len * 0.42;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (pos.x - op.x) / d;
      const nz = (pos.z - op.z) / d;
      pos.x += nx * push; pos.z += nz * push;
      op.x -= nx * push; op.z -= nz * push;
      if (Math.abs(car.speed) > 8) {
        damageCar(S, car, 4);
        damageCar(S, other, 6);
        other.speed = car.speed * 0.3;
        S.effects.shake(0.3);
      }
      car.speed *= 0.92;
    }
  }

  car.group.rotation.y = car.yaw;
  for (const key of ['fl', 'fr', 'rl', 'rr']) {
    const w = car.wheels[key];
    w.wheel.rotation.x += (car.speed * dt) / 0.42;
    if (key === 'fl' || key === 'fr') w.pivot.rotation.y = car.steer * 0.45;
  }
  if (car.health < 40 && !car.dead) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.12;
      S.effects.smoke(pos.x - fx * 1.5, 1.4, pos.z - fz * 1.5);
    }
  }

  S.speedKmh = Math.abs(car.speed) * 3.6;
  S.audio.setEngine(Math.abs(car.speed) / spec.top, axis.y > 0 ? 1 : 0.2);

  // Staged chase shot: the camera rides ahead of the Vesper and looks back
  // down the boulevard, so the trailing cruisers read in frame behind it.
  // (The normal rear camera would hide them — they sit behind the camera.)
  if (S.shotState && S.shotState.name === 'chase') {
    S.camera.position.set(pos.x, 4.5, pos.z + 22);
    S.camera.lookAt(pos.x, 1.5, pos.z - 10);
    return;
  }

  // Chase camera: settles behind the car, mouse can look around briefly.
  const mouse = input.consumeMouse();
  if (input.isLocked()) S.camYaw -= mouse.dx * 0.0028;
  S.camYaw = lerpAngle(S.camYaw, car.yaw, 1 - Math.pow(0.04, dt));
  const cam = S.camera;
  const dist = 10;
  const tx = pos.x - Math.sin(S.camYaw) * dist;
  const tz = pos.z - Math.cos(S.camYaw) * dist;
  const ty = 3.6;
  const k = 1 - Math.pow(0.0005, dt);
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (ty - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(pos.x + fx * 5, 1.4, pos.z + fz * 5);
}

export function repaintCar(car) {
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  car.group.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && o.geometry && o.geometry.type === 'BoxGeometry' && o.position.y === 0.62) {
      o.material = new THREE.MeshLambertMaterial({ color });
    }
  });
  car.color = color;
}
