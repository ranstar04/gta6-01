// Traffic: AI cars looping rectangular circuits on the road grid with a right-hand
// lane offset, slowing for the car ahead and for the player. Far cars respawn
// onto another loop so the streets never feel empty.
import { createCar, driveCar } from './vehicles.js';
import { pick, range } from './random.js';

const TRAFFIC_TYPES = ['alba', 'corto', 'vela', 'alba', 'vesper'];

export function createTraffic(scene, world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const car = createCar(pick(rng, TRAFFIC_TYPES), 0, 0, 0);
    const loop = world.randomLoop();
    const start = loop.points[0];
    car.pos.set(start.x, 0, start.z);
    car.driver = 'traffic';
    car.loop = loop;
    car.wp = 1;
    car.cruise = range(rng, 9, 14);
    scene.add(car.group);
    cars.push(car);
  }

  function steerTo(car, tx, tz) {
    const dx = tx - car.pos.x;
    const dz = tz - car.pos.z;
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.max(-1, Math.min(1, diff * 1.6));
  }

  return {
    cars,
    reset() {
      for (const car of cars) {
        const loop = world.randomLoop();
        const start = loop.points[0];
        car.loop = loop;
        car.wp = 1;
        car.pos.set(start.x, 0, start.z);
        car.speed = 0;
        car.heading = 0;
        car.group.position.copy(car.pos);
      }
    },
    update(dt, G) {
      for (const car of cars) {
        const loop = car.loop;
        const target = loop.points[car.wp % loop.points.length];
        // Lane offset: right-hand side of the direction of travel.
        const next = loop.points[(car.wp + 1) % loop.points.length];
        const dx = next.x - target.x;
        const dz = next.z - target.z;
        const dl = Math.hypot(dx, dz) || 1;
        const ox = (-dz / dl) * loop.lane * loop.dir;
        const oz = (dx / dl) * loop.lane * loop.dir;
        const dist = Math.hypot(target.x + ox - car.pos.x, target.z + oz - car.pos.z);
        if (dist < 6) car.wp += 1;
        // Slow for the car ahead (any car within 10 m in front).
        let slow = false;
        for (const o of G.cars) {
          if (o === car) continue;
          const ox2 = o.pos.x - car.pos.x;
          const oz2 = o.pos.z - car.pos.z;
          const d = Math.hypot(ox2, oz2);
          if (d < 11 && d > 0.01) {
            const dot = (ox2 * Math.sin(car.heading) + oz2 * Math.cos(car.heading)) / d;
            if (dot > 0.6) { slow = true; break; }
          }
        }
        const throttle = slow ? 0 : 0.55;
        const steer = steerTo(car, target.x + ox, target.z + oz);
        // Cruise control: ease toward the cruise speed.
        const want = slow ? 0 : car.cruise;
        const effThrottle = car.speed < want ? throttle : (car.speed > want + 1 ? -0.6 : 0);
        driveCar(car, dt, effThrottle, steer, false, G.city.colliders, G.cars);
        // Respawn far-away cars onto a fresh loop so traffic stays near the action.
        const pd = Math.hypot(car.pos.x - G.player.state.pos.x, car.pos.z - G.player.state.pos.z);
        if (pd > 420) {
          const nl = world.randomLoop();
          const s = nl.points[0];
          car.loop = nl;
          car.wp = 1;
          car.pos.set(s.x, 0, s.z);
          car.speed = 0;
        }
      }
    },
  };
}
