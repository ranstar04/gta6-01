// World queries: the road graph, spawn points, circle-vs-building collision,
// and the walkable bounds (beach edge, with a pier corridor cut through it).
import { CFG } from './config.js';

const ROADS = CFG.roads;
const HALF = CFG.cityHalf;

// Nearest point on any road centerline, plus which way the road runs (0 = along z,
// PI/2 = along x) so traffic and spawns can face down the road.
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const r of ROADS) {
    const cz = Math.max(-HALF, Math.min(HALF, z));
    const dV = Math.hypot(x - r, z - cz);
    if (dV < bestD) { bestD = dV; best = { x: r, z: cz, dir: 0 }; }
    const cx = Math.max(-HALF, Math.min(HALF, x));
    const dH = Math.hypot(x - cx, z - r);
    if (dH < bestD) { bestD = dH; best = { x: cx, z: r, dir: Math.PI / 2 }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const r = rng.pick(ROADS);
  const t = rng.range(-HALF + 10, HALF - 10);
  return vertical
    ? { x: r, z: t, dir: 0 }
    : { x: t, z: r, dir: Math.PI / 2 };
}

export function isOnRoad(x, z) {
  const w = CFG.roadWidth / 2 + 2;
  for (const r of ROADS) {
    if (Math.abs(x - r) < w && Math.abs(z) <= HALF) return true;
    if (Math.abs(z - r) < w && Math.abs(x) <= HALF) return true;
  }
  return false;
}

export function isOnSidewalk(x, z) {
  for (const r of ROADS) {
    if (Math.abs(x - r) > 6 && Math.abs(x - r) < 9 && Math.abs(z) <= HALF) return true;
    if (Math.abs(z - r) > 6 && Math.abs(z - r) < 9 && Math.abs(x) <= HALF) return true;
  }
  return false;
}

// Rectangular traffic loops that follow the road lines: corners are road coords.
export function loopWaypoints(a, b) {
  return [
    { x: a, z: a }, { x: b, z: a }, { x: b, z: b }, { x: a, z: b },
  ];
}
export const TRAFFIC_LOOPS = [
  loopWaypoints(-30, 30),
  loopWaypoints(-90, 90),
  loopWaypoints(-150, 150),
  [{ x: -150, z: -150 }, { x: -30, z: -150 }, { x: -30, z: 150 }, { x: -150, z: 150 }],
];

// Push a circle (x/z, radius) out of every building AABB it overlaps.
// Returns true when a push happened.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // Center inside the box: shove out along the smallest penetration axis.
      const pl = pos.x - c.x0 + radius;
      const pr = c.x1 - pos.x + radius;
      const pt = pos.z - c.z0 + radius;
      const pb = c.z1 - pos.z + radius;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = c.x0 - radius;
      else if (m === pr) pos.x = c.x1 + radius;
      else if (m === pt) pos.z = c.z0 - radius;
      else pos.z = c.z1 + radius;
    }
  }
  return hit;
}

// Keep walkers and drivers inside the world: the beach edge blocks the sea,
// except the pier corridor (z near -120) which runs out to the pier end.
export function clampWorldBounds(pos, radius) {
  const minX = (pos.z > -132 && pos.z < -108) ? -262 : -232;
  if (pos.x < minX + radius) pos.x = minX + radius;
  if (pos.x > 1150 - radius) pos.x = 1150 - radius;
  if (pos.z < -1150 + radius) pos.z = -1150 + radius;
  if (pos.z > 1150 - radius) pos.z = 1150 - radius;
}

export function dist2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
