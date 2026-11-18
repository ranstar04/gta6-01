// World queries: the road graph, nearest-road lookups, traffic loops, sidewalk
// waypoints, district names. Pure geometry over the city layout — no drawing.
import { CITY, ROADS } from './config.js';
import { pick, range } from './random.js';

const LOOPS = [
  // Rectangular circuits on road centre lines; cars follow them with a lane offset.
  [{ x: -240, z: -240 }, { x: 0, z: -240 }, { x: 0, z: 0 }, { x: -240, z: 0 }],
  [{ x: 0, z: -240 }, { x: 240, z: -240 }, { x: 240, z: 0 }, { x: 0, z: 0 }],
  [{ x: -240, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 240 }, { x: -240, z: 240 }],
  [{ x: 0, z: 0 }, { x: 240, z: 0 }, { x: 240, z: 240 }, { x: 0, z: 240 }],
  [{ x: -240, z: -240 }, { x: 240, z: -240 }, { x: 240, z: 240 }, { x: -240, z: 240 }],
  [{ x: -120, z: -120 }, { x: 120, z: -120 }, { x: 120, z: 120 }, { x: -120, z: 120 }],
];

export function createWorld(rng, spawns) {
  function nearestRoad(x, z) {
    // Snap to the closest road centre line, keeping the other coordinate.
    let best = null;
    let bestD = Infinity;
    for (const r of ROADS) {
      const d = Math.abs(x - r);
      if (d < bestD) { bestD = d; best = { x: r, z, onAvenue: true }; }
      const d2 = Math.abs(z - r);
      if (d2 < bestD) { bestD = d2; best = { x, z: r, onAvenue: false }; }
    }
    return best;
  }

  function randomRoadPoint() {
    const r = pick(rng, ROADS);
    const along = range(rng, -280, 280);
    return rng() < 0.5 ? { x: r, z: along } : { x: along, z: r };
  }

  function randomLoop() {
    const loop = pick(rng, LOOPS);
    return { points: loop, dir: rng() < 0.5 ? 1 : -1, lane: 3.5 };
  }

  function randomSidewalkPoint() {
    // Sidewalk edges run 10 units off each road centre line.
    const r = pick(rng, ROADS);
    const along = range(rng, -280, 280);
    const off = (rng() < 0.5 ? -1 : 1) * 10;
    return rng() < 0.5 ? { x: r + off, z: along } : { x: along, z: r + off };
  }

  function district(x, z) {
    if (x < -240) return 'Coral Strand';
    if (x < -120 && z < -120) return 'Old Harbor';
    if (x > 120 && z > 120) return 'Marina';
    if (Math.abs(x) <= 60 && Math.abs(z) <= 60) return 'Downtown';
    if (x < -120) return 'Calle Verde';
    if (z > 120) return 'Palm Terrace';
    return 'Calle Verde';
  }

  // True when a point sits on a road (within 7 m of a centre line) — used
  // to keep spawns and waypoints out of building footprints.
  function isOnRoad(x, z) {
    for (const r of ROADS) if (Math.abs(x - r) < 7 || Math.abs(z - r) < 7) return true;
    return false;
  }

  function clampToCity(x, z) {
    return {
      x: Math.max(-CITY.half + 4, Math.min(CITY.half - 4, x)),
      z: Math.max(-CITY.half + 4, Math.min(CITY.half - 4, z)),
    };
  }

  return { nearestRoad, randomRoadPoint, randomLoop, randomSidewalkPoint, district, clampToCity, isOnRoad, spawns };
}
