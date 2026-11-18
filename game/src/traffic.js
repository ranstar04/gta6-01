// Traffic: AI cars looping the road circuits on the right-hand lane, slowing
// for the car ahead. Cars far from the player are recycled onto a loop near him
// so the streets always feel alive. A jacked traffic car leaves the system.
import { spawnCarAt } from './vehicles.js';
import { TRAFFIC_LOOPS, dist2D } from './world.js';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createTraffic(S) {
  const list = [];
  const TYPES = ['alba', 'corto', 'vela', 'alba', 'vela', 'corto', 'alba'];

  function spawnOne() {
    const loop = TRAFFIC_LOOPS[Math.floor(Math.random() * TRAFFIC_LOOPS.length)];
    const wp = Math.floor(Math.random() * loop.length);
    const point = loop[wp];
    const next = loop[(wp + 1) % loop.length];
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const car = spawnCarAt(S, type, point.x, point.z, Math.atan2(next.x - point.x, next.z - point.z), { driver: 'ped' });
    car.traffic = {
      loop, wp,
      speed: 8 + Math.random() * 4,
      lane: Math.random() < 0.5 ? -2.6 : 2.6,
      stunned: 0,
      lastX: point.x, lastZ: point.z, stuckT: 0,
    };
    list.push(car);
    return car;
  }

  for (let i = 0; i < 14; i++) spawnOne();

  function update(dt) {
    const px = S.player.group.position.x;
    const pz = S.player.group.position.z;
    for (let i = list.length - 1; i >= 0; i--) {
      const car = list[i];
      if (car.driver === 'player' || car.dead) { list.splice(i, 1); continue; }
      const t = car.traffic;
      if (t.stunned > 0) { t.stunned -= dt; continue; }
      const cp = car.group.position;
      if (dist2D(cp.x, cp.z, px, pz) > 240) {
        const wp = Math.floor(Math.random() * t.loop.length);
        const pt = t.loop[wp];
        cp.set(pt.x, 0, pt.z);
        t.wp = wp;
      }
      const target = t.loop[(t.wp + 1) % t.loop.length];
      const dx = target.x - cp.x;
      const dz = target.z - cp.z;
      const len = Math.hypot(dx, dz) || 1;
      const rx = dz / len;
      const rz = -dx / len;
      const tx = target.x + rx * t.lane;
      const tz = target.z + rz * t.lane;
      // Slow down for anything stopped ahead in our lane.
      let want = t.speed;
      for (const other of S.cars) {
        if (other === car) continue;
        const ox = other.group.position.x - cp.x;
        const oz = other.group.position.z - cp.z;
        const ahead = ox * Math.sin(car.yaw) + oz * Math.cos(car.yaw);
        const side = Math.abs(ox * Math.cos(car.yaw) - oz * Math.sin(car.yaw));
        if (ahead > 0 && ahead < 11 && side < 3) { want = 0; break; }
      }
      car.speed += (want - car.speed) * Math.min(1, dt * 2);
      const wantYaw = Math.atan2(tx - cp.x, tz - cp.z);
      car.yaw = lerpAngle(car.yaw, wantYaw, Math.min(1, dt * 2.2));
      cp.x += Math.sin(car.yaw) * car.speed * dt;
      cp.z += Math.cos(car.yaw) * car.speed * dt;
      car.group.rotation.y = car.yaw;
      for (const key of ['fl', 'fr', 'rl', 'rr']) {
        car.wheels[key].wheel.rotation.x += (car.speed * dt) / 0.42;
      }
      // Stuck against something for 3 s: skip to the next waypoint.
      const moved = Math.hypot(cp.x - t.lastX, cp.z - t.lastZ);
      if (car.speed > 1 && moved < 0.2) {
        t.stuckT += dt;
        if (t.stuckT > 3) { t.wp = (t.wp + 1) % t.loop.length; t.stuckT = 0; }
      } else {
        t.stuckT = 0;
      }
      t.lastX = cp.x;
      t.lastZ = cp.z;
      if (Math.hypot(tx - cp.x, tz - cp.z) < 4) t.wp = (t.wp + 1) % t.loop.length;
    }
  }

  return { list, update };
}
