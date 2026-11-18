// SOLMARA's world: the road graph, the colliders, and the named places every
// system needs. Pure data and geometry queries — no three.js, no drawing — so
// traffic, pedestrians, police, missions and the minimap all agree on one map.
//
// Roads run at ROADS coordinates in both directions. A road is a straight strip;
// an intersection is where an avenue meets a street. Sidewalks are the 3-meter
// band just outside each road's asphalt.

import { BLOCK, ROADS, ROAD_WIDTH, WORLD } from './config.js';

const HALF_ROAD = ROAD_WIDTH / 2;

export function createWorld() {
  const colliders = [];
  const places = {
    diner: { x: -40, z: 40, label: 'Gull & Anchor Diner' },
    marina: { x: -40, z: -168, label: 'Marina' },
    safehouse: { x: 40, z: 168, label: 'Safehouse' },
    docks: { x: -176, z: 8, label: 'Docks' },
    warehouse: { x: -176, z: 56, label: 'Pier Warehouse' },
    casino: { x: 168, z: -160, label: 'The Golden Gull Casino' },
    chopShop: { x: 168, z: 120, label: 'Chop Shop' },
    garage: { x: 120, z: 120, label: 'Fresh Coat Garage' },
    station: { x: 80, z: -40, label: 'Police Station' },
    hospital: { x: -80, z: 120, label: 'St. Coral Hospital' },
    pier: { x: -260, z: 56, label: 'Old Pier' },
    beach: { x: -200, z: 0, label: 'Coral Strand' },
  };

  /** Register a solid box the player, cars and peds cannot pass through. */
  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  /** True when (x, z) is on asphalt (inside a road strip). */
  function onRoad(x, z) {
    for (const r of ROADS) {
      if (Math.abs(x - r) <= HALF_ROAD) return true;
      if (Math.abs(z - r) <= HALF_ROAD) return true;
    }
    return false;
  }

  /** The nearest road coordinate to a value on one axis. */
  function nearestRoadCoord(v) {
    let best = ROADS[0];
    for (const r of ROADS) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
    return best;
  }

  /** Snap a point to the centre of the nearest road, keeping the other axis. */
  function snapToRoad(x, z) {
    const dx = Math.abs(x - nearestRoadCoord(x));
    const dz = Math.abs(z - nearestRoadCoord(z));
    if (dx <= dz) return { x: nearestRoadCoord(x), z };
    return { x, z: nearestRoadCoord(z) };
  }

  /** All intersections, for waypoints and spawns. */
  function intersections() {
    const out = [];
    for (const x of ROADS) for (const z of ROADS) out.push({ x, z });
    return out;
  }

  /** The intersection nearest to (x, z). */
  function nearestIntersection(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const ix of ROADS) {
      for (const iz of ROADS) {
        const d = Math.hypot(ix - x, iz - z);
        if (d < bestD) {
          bestD = d;
          best = { x: ix, z: iz };
        }
      }
    }
    return best;
  }

  /** Push a circle (x, z, radius) out of every collider it overlaps. Returns true on contact. */
  function collideCircle(p, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        // Dead centre inside the box: shove out along the shortest face.
        const pushL = p.x - c.minX + radius;
        const pushR = c.maxX - p.x + radius;
        const pushT = p.z - c.minZ + radius;
        const pushB = c.maxZ - p.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) p.x = c.minX - radius;
        else if (m === pushR) p.x = c.maxX + radius;
        else if (m === pushT) p.z = c.minZ - radius;
        else p.z = c.maxZ + radius;
      }
    }
    return hit;
  }

  /** True when the circle overlaps any collider. */
  function hitsCollider(x, z, radius) {
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }

  /** Clamp a point inside the playable land (the sea is a wall, not a swim). */
  function clampToLand(p) {
    p.x = Math.max(WORLD.oceanEdge + 6, Math.min(WORLD.cityHalf + 40, p.x));
    p.z = Math.max(-WORLD.cityHalf - 40, Math.min(WORLD.cityHalf + 40, p.z));
  }

  return {
    colliders, places,
    addCollider, onRoad, nearestRoadCoord, snapToRoad,
    intersections, collideCircle, hitsCollider, clampToLand,
    blockSize: BLOCK,
  };
}
