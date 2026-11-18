// World queries over the road graph: nearest road point, random road spawn,
// sidewalk waypoints. Pure geometry — no three.js, no DOM.
import { WORLD } from './config.js';
import { clamp, dist2D } from './random.js';

export function createWorld(city) {
  // Road segments: each avenue is a vertical segment, each street horizontal.
  const segments = [];
  for (const x of WORLD.avenues) {
    segments.push({ x1: x, z1: -WORLD.bound, x2: x, z2: WORLD.bound, vertical: true });
  }
  for (const z of WORLD.streets) {
    segments.push({ x1: -WORLD.bound, z1: z, x2: WORLD.bound, z2: z, vertical: false });
  }

  function nearestRoadPoint(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const s of segments) {
      let px;
      let pz;
      let d;
      if (s.vertical) {
        pz = clamp(z, s.z1, s.z2);
        px = s.x1;
        d = Math.abs(x - s.x1);
      } else {
        px = clamp(x, s.x1, s.x2);
        pz = s.z1;
        d = Math.abs(z - s.z1);
      }
      if (d < bestD) {
        bestD = d;
        best = { x: px, z: pz, vertical: s.vertical };
      }
    }
    return best;
  }

  function onRoad(x, z) {
    // One lookup, not two: nearestRoadPoint is pure, so call it once and reuse.
    const p = nearestRoadPoint(x, z);
    return p && dist2D(x, z, p.x, p.z) <= WORLD.roadHalf + 0.5;
  }

  function randomRoadPoint(rng) {
    const s = segments[Math.floor(rng() * segments.length)];
    const t = rng();
    return {
      x: s.x1 + (s.x2 - s.x1) * t,
      z: s.z1 + (s.z2 - s.z1) * t,
      vertical: s.vertical,
    };
  }

  // A rectangular loop around one city block, for traffic circuits.
  function blockLoop(rng) {
    const ai = 1 + Math.floor(rng() * (WORLD.avenues.length - 2));
    const si = 1 + Math.floor(rng() * (WORLD.streets.length - 2));
    const x0 = WORLD.avenues[ai - 1];
    const x1 = WORLD.avenues[ai];
    const z0 = WORLD.streets[si - 1];
    const z1 = WORLD.streets[si];
    const dir = rng() < 0.5 ? 1 : -1;
    const pts = [
      { x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 },
    ];
    if (dir < 0) pts.reverse();
    return pts;
  }

  // Sidewalk waypoint: a point just off a road, inside a block edge.
  function sidewalkPoint(rng) {
    const p = randomRoadPoint(rng);
    const off = WORLD.roadHalf + 2 + rng() * 3;
    const side = rng() < 0.5 ? -1 : 1;
    if (p.vertical) return { x: p.x + off * side, z: p.z };
    return { x: p.x, z: p.z + off * side };
  }

  // Collision: circle (x, z, radius) against building AABBs and the world edge.
  function collide(x, z, radius) {
    let cx = x;
    let cz = z;
    for (const b of city.colliders) {
      const nx = clamp(cx, b.minX, b.maxX);
      const nz = clamp(cz, b.minZ, b.maxZ);
      const dx = cx - nx;
      const dz = cz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          cx = nx + (dx / d) * radius;
          cz = nz + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const pl = cx - b.minX;
          const pr = b.maxX - cx;
          const pt = cz - b.minZ;
          const pb = b.maxZ - cz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) cx = b.minX - radius;
          else if (m === pr) cx = b.maxX + radius;
          else if (m === pt) cz = b.minZ - radius;
          else cz = b.maxZ + radius;
        }
      }
    }
    cx = clamp(cx, -WORLD.bound, WORLD.bound);
    cz = clamp(cz, -WORLD.bound, WORLD.bound);
    return { x: cx, z: cz };
  }

  function insideBuilding(x, z) {
    for (const b of city.colliders) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  return { segments, nearestRoadPoint, onRoad, randomRoadPoint, blockLoop, sidewalkPoint, collide, insideBuilding };
}
