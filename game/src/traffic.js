// SOLMARA's traffic: AI cars looping rectangular circuits around the blocks,
// keeping their lane, slowing for the car ahead and for the player's car.
// Each car owns a loop of waypoints on the road grid; the loop never leaves
// asphalt, so traffic always looks like it belongs.

import { ROADS, ROAD_WIDTH } from './config.js';
import { createCar, stepCar } from './vehicles.js';

const TRAFFIC_TYPES = ['alba', 'alba', 'corto', 'vela', 'alba', 'vela'];

/** A rectangular loop around one block, offset into the right-hand lane. */
function makeLoop(rng) {
  const cx = rng.pick([-120, -40, 40, 120]);
  const cz = rng.pick([-120, -40, 40, 120]);
  const half = 40;
  const lane = ROAD_WIDTH / 2 - 2;
  // Clockwise: north edge eastward, east edge southward, and so on.
  return [
    { x: cx - half + lane, z: cz - half - lane },
    { x: cx + half - lane, z: cz - half - lane },
    { x: cx + half + lane, z: cz - half + lane },
    { x: cx + half + lane, z: cz + half - lane },
    { x: cx + half - lane, z: cz + half + lane },
    { x: cx - half + lane, z: cz + half + lane },
    { x: cx - half - lane, z: cz + half - lane },
    { x: cx - half - lane, z: cz - half + lane },
  ];
}

export function createTraffic(scene, world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const loop = makeLoop(rng);
    const start = loop[i % loop.length];
    const car = createCar(scene, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length], start.x, start.z, 0, { driver: 'traffic', id: 100 + i });
    car.ai = { loop, wp: 0, cruise: rng.range(8, 12) };
    cars.push(car);
  }

  function step(dt, playerCar, allCars) {
    for (const car of cars) {
      if (car.wrecked || !car.ai || car.driver === 'player') continue;
      const ai = car.ai;
      const target = ai.loop[ai.wp];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        ai.wp = (ai.wp + 1) % ai.loop.length;
        continue;
      }
      // Desired heading toward the waypoint; steer the shortest way round.
      const wantYaw = Math.atan2(dx, dz);
      let diff = wantYaw - car.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));

      // Slow for anything ahead: another car, or the player, in the same lane.
      let throttle = 1;
      const aheadX = car.pos.x + Math.sin(car.yaw) * 12;
      const aheadZ = car.pos.z + Math.cos(car.yaw) * 12;
      for (const other of allCars) {
        if (other === car || other.wrecked) continue;
        if (Math.hypot(other.pos.x - aheadX, other.pos.z - aheadZ) < 7) {
          throttle = 0;
          break;
        }
      }
      if (playerCar && Math.hypot(playerCar.pos.x - aheadX, playerCar.pos.z - aheadZ) < 7) throttle = 0;
      // A 3-second standstill means the loop is jammed: skip to the next point.
      ai.stuck = throttle === 0 ? (ai.stuck ?? 0) + dt : 0;
      if ((ai.stuck ?? 0) > 3) {
        ai.wp = (ai.wp + 1) % ai.loop.length;
        ai.stuck = 0;
      }
      car.speed = Math.min(car.speed, ai.cruise);
      stepCar(car, dt, world, { throttle, steer, handbrake: false }, allCars);
      if (car.speed > ai.cruise) car.speed = ai.cruise;
    }
  }

  return { cars, step };
}
