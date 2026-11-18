// SOLMARA's city, built once from a seed: the ground and roads, the buildings
// with procedural window textures, palms, lamps, the pier, the warehouse and the
// casino, plus every solid collider the other systems push against. Nothing here
// moves; the ocean vertices are animated by render.js.

import * as THREE from 'three';
import { PALETTE, ROADS, ROAD_WIDTH, WORLD } from './config.js';

/** A canvas texture of lit windows on a coloured facade. */
function windowTexture(base, lit, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      const on = rng.next() < lit;
      g.fillStyle = on ? '#ffd98a' : 'rgba(20,28,40,0.85)';
      g.fillRect(8 + x * 20, 10 + y * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The whole city floor in one 1024px canvas: sidewalks, asphalt, dashes, crossings. */
function groundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const half = 200;
  const px = (v) => ((v + half) / (half * 2)) * S;
  g.fillStyle = '#8f8a80';
  g.fillRect(0, 0, S, S);
  // Blocks get a slightly varied tint so the grid reads at a glance.
  for (let bx = 0; bx < 4; bx += 1) {
    for (let bz = 0; bz < 4; bz += 1) {
      g.fillStyle = (bx + bz) % 2 === 0 ? '#93908a' : '#8a877f';
      g.fillRect(px(-160 + bx * 80), px(-160 + bz * 80), px(80) - px(0), px(80) - px(0));
    }
  }
  g.fillStyle = '#3a3f47';
  for (const r of ROADS) {
    g.fillRect(px(r - ROAD_WIDTH / 2), 0, px(ROAD_WIDTH) - px(0), S);
    g.fillRect(0, px(r - ROAD_WIDTH / 2), S, px(ROAD_WIDTH) - px(0));
  }
  // Centre dashes.
  g.fillStyle = '#e8d24a';
  for (const r of ROADS) {
    for (let v = -190; v < 190; v += 16) {
      g.fillRect(px(r) - 2, px(v), 4, 8);
      g.fillRect(px(v), px(r) - 2, 8, 4);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(240,240,235,0.85)';
  for (const x of ROADS) {
    for (const z of ROADS) {
      for (let i = -2; i <= 2; i += 1) {
        g.fillRect(px(x + i * 3) - 2, px(z - ROAD_WIDTH / 2 - 4), 4, 8);
        g.fillRect(px(x - ROAD_WIDTH / 2 - 4), px(z + i * 3) - 2, 8, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(scene, world, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // The big sand ground, far past the fog, so the horizon never shows void.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.1;
  sand.receiveShadow = true;
  group.add(sand);

  // The city slab with the painted road map.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0.02;
  slab.receiveShadow = true;
  group.add(slab);

  // The ocean, west of the beach: a segmented plane render.js ripples.
  const oceanGeo = new THREE.PlaneGeometry(420, 900, 28, 48);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-430, WORLD.seaLevel, 0);
  group.add(ocean);

  // Beach strip between the city and the water.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 420),
    new THREE.MeshLambertMaterial({ color: 0xe0c78f }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-200, 0.05, 0);
  beach.receiveShadow = true;
  group.add(beach);

  // Facade materials: a few shared window textures, reused across the city.
  const facades = [
    new THREE.MeshLambertMaterial({ map: windowTexture('#7a6a58', 0.45, rng) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#5d6b7a', 0.55, rng) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#8a5f52', 0.4, rng) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#c96f4a', 0.5, rng) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#4a7a6a', 0.45, rng) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#b8a05a', 0.5, rng) }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const specialMat = new THREE.MeshLambertMaterial({ color: 0xd8b25a });
  // The warehouse gets windows like the rest of the city: a plain colour
  // reads as a black slab on its sunless south face, while the lit windows
  // keep the facade readable from any angle.
  const warehouseMat = new THREE.MeshLambertMaterial({ map: windowTexture('#8a7a62', 0.3, rng) });

  let buildingCount = 0;
  function addBuilding(x, z, w, d, h, mat) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.4, d + 0.6);
    roof.position.set(x, h + 0.2, z);
    group.add(roof);
    world.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    buildingCount += 1;
    return mesh;
  }

  // District rule: downtown towers in the middle, low colour in Calle Verde south,
  // mid blocks elsewhere. Blocks sit between the roads at -120/-40/40/120.
  const centres = [-120, -40, 40, 120];
  for (const bx of centres) {
    for (const bz of centres) {
      const downtown = Math.abs(bx) <= 40 && Math.abs(bz) <= 40;
      const calleVerde = bz === 120;
      if (bx === -120 && bz === 40) continue; // diner block, kept low and open
      if (bx === 120 && bz === -120) continue; // casino block, special building
      if (rng.chance(0.5)) {
        const h = downtown ? rng.range(20, 42) : calleVerde ? rng.range(5, 9) : rng.range(8, 18);
        addBuilding(bx, bz, 46, 46, h, facades[rng.int(0, facades.length - 1)]);
      } else {
        const h1 = downtown ? rng.range(16, 34) : rng.range(6, 14);
        const h2 = downtown ? rng.range(16, 30) : rng.range(6, 12);
        addBuilding(bx - 12, bz, 22, 46, h1, facades[rng.int(0, facades.length - 1)]);
        addBuilding(bx + 12, bz, 22, 46, h2, facades[rng.int(0, facades.length - 1)]);
      }
    }
  }

  // Special places, each with its own silhouette so the minimap reads.
  addBuilding(168, -160, 40, 30, 16, specialMat); // The Golden Gull casino
  addBuilding(-176, 56, 30, 22, 9, warehouseMat); // Pier warehouse
  addBuilding(-176, 8, 26, 18, 8, warehouseMat); // Docks shed
  addBuilding(-40, 40, 20, 14, 6, facades[3]); // Gull & Anchor diner
  addBuilding(80, -40, 18, 18, 10, facades[1]); // Police station
  addBuilding(-80, 120, 22, 16, 8, facades[4]); // Hospital
  addBuilding(120, 120, 18, 14, 6, facades[5]); // Fresh Coat garage

  // The pier: planks out over the water from the warehouse.
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  for (let i = 0; i < 10; i += 1) {
    const plank = new THREE.Mesh(boxGeo, plankMat);
    plank.scale.set(10, 0.5, 6);
    plank.position.set(-200 - i * 12, 1.2, 56);
    plank.castShadow = true;
    group.add(plank);
  }

  // Palms along the beach, the boardwalk and Calle Verde.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a30 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const frondGeo = new THREE.ConeGeometry(2.2, 1.2, 5);
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3, z);
    trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.position.set(x, 6.6, z);
    fronds.scale.y = 0.55;
    group.add(fronds);
    world.addCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
  }
  for (let z = -180; z <= 180; z += 30) {
    addPalm(-188, z + rng.range(-4, 4));
    if (rng.chance(0.6)) addPalm(168, z);
  }
  for (let x = -120; x <= 120; x += 40) addPalm(x, 132);

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9933 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (const x of ROADS) {
    for (const z of ROADS) {
      if ((x + z) % 160 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 8, 3.5, z + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + 8, 7.2, z + 8);
      group.add(lamp);
    }
  }

  // Crates stacked by the warehouse, and a couple of billboards.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const crateSpots = [[-158, 76], [-162, 80], [-158, 80], [-190, 40], [-186, 44]];
  for (const [x, z] of crateSpots) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    crate.scale.set(2.2, 2.2, 2.2);
    crate.position.set(x, 1.1, z);
    crate.castShadow = true;
    group.add(crate);
    world.addCollider(x - 1.1, x + 1.1, z - 1.1, z + 1.1);
  }

  return { ocean, oceanGeo, buildingCount, group };
}
