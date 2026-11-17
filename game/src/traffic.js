// Traffic: AI cars looping block circuits with lane offsets, slowing for the
// player's car ahead. Parked cars too — stealable, with drivers who flee.
import { TUNE } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { createCar, driveCar } from './vehicles.js';

const TRAFFIC_TYPES = ['alba', 'alba', 'corto', 'vela', 'alba', 'bruto', 'vela', 'corto'];

export function createTraffic(scene, world, seed) {
  const rng = mulberry32(seed ^ 0x5eed);
  const cars = [];
  const parked = [];

  for (let i = 0; i < TUNE.trafficCount; i++) {
    const type = pick(rng, TRAFFIC_TYPES);
    const loop = world.blockLoop(rng);
    const p = loop[Math.floor(rng() * loop.length)];
    const car = createCar(type, p.x, p.z, 0);
    car.driver = 'traffic';
    car.loop = loop;
    car.loopIndex = 0;
    car.lane = (rng() < 0.5 ? -1 : 1) * 2.2;
    car.speed = range(rng, 8, 13);
    scene.add(car.mesh);
    cars.push(car);
  }
  // Parked cars along roads — the ones the player steals.
  for (let i = 0; i < 10; i++) {
    const type = pick(rng, ['alba', 'vesper', 'vela', 'corto', 'bruto']);
    const p = world.randomRoadPoint(rng);
    const yaw = p.vertical ? 0 : Math.PI / 2;
    const off = rng() < 0.5 ? -3.4 : 3.4;
    const x = p.vertical ? p.x + off : p.x;
    const z = p.vertical ? p.z : p.z + off;
    const car = createCar(type, x, z, yaw + (rng() < 0.5 ? Math.PI : 0));
    car.driver = null;
    scene.add(car.mesh);
    parked.push(car);
  }

  function update(dt, playerCar, peds) {
    for (const car of cars) {
      const target = car.loop[(car.loopIndex + 1) % car.loop.length];
      // Lane offset: perpendicular to travel direction.
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.loopIndex = (car.loopIndex + 1) % car.loop.length;
        continue;
      }
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.yaw += dy * Math.min(1, dt * 2.2);
      // Slow for the player car ahead.
      let desired = 11;
      if (playerCar) {
        const pd = Math.hypot(playerCar.x - car.x, playerCar.z - car.z);
        const ahead = Math.sin(car.yaw) * (playerCar.x - car.x) + Math.cos(car.yaw) * (playerCar.z - car.z);
        if (pd < 12 && ahead > 0) desired = Math.max(0, (pd - 5) * 1.2);
      }
      car.speed += (desired - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.yaw) * car.speed * dt;
      car.z += Math.cos(car.yaw) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.yaw;
      const spin = (car.speed * dt) / 0.36;
      for (const w of car.mesh.userData.wheels) w.pivot.children[0].rotation.x += spin;
    }
  }

  return { cars, parked, update, all: () => cars.concat(parked) };
}
