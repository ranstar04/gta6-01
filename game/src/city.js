// buildCity: the whole of Solmara — road graph, blocks, buildings with procedural
// window textures, palms, streetlights, beach, pier, marina, casino, diner, garage,
// chop shop, safehouse. Exports colliders + landmark positions for the other systems.
import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';
import { mulberry32, range, pick } from './random.js';

function windowTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 14) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#20242e';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);
  const add = (m) => group.add(m);

  // Ground: grass base, then sand strip on the west, asphalt roads, sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, -0.1, 0);
  ground.receiveShadow = true;
  add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 700),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-186, -0.05, 0);
  sand.receiveShadow = true;
  add(sand);

  // Roads: dark asphalt strips + pale centre dashes.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c4 });
  for (const x of WORLD.avenues) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadHalf * 2, WORLD.bound * 2 + 20), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.02, 0);
    r.receiveShadow = true;
    add(r);
    for (let z = -160; z <= 160; z += 16) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.04, z);
      add(d);
    }
  }
  for (const z of WORLD.streets) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.bound * 2 + 20, WORLD.roadHalf * 2), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.02, z);
    r.receiveShadow = true;
    add(r);
    for (let x = -160; x <= 160; x += 16) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.04, z);
      add(d);
    }
  }

  // Sidewalk slabs around every block.
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  for (let ai = 0; ai < WORLD.avenues.length - 1; ai++) {
    for (let si = 0; si < WORLD.streets.length - 1; si++) {
      const x0 = WORLD.avenues[ai];
      const x1 = WORLD.avenues[ai + 1];
      const z0 = WORLD.streets[si];
      const z1 = WORLD.streets[si + 1];
      const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 2, z1 - z0 - 2), walkMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
      w.receiveShadow = true;
      add(w);
    }
  }

  // Buildings: one or two per block. Downtown (near centre) goes tall glass;
  // Calle Verde (south) goes low pastel; the harbour blocks go brick warehouses.
  const texDowntown = windowTexture(rng, '#7d8aa0', 0.35);
  const texBrick = windowTexture(rng, '#a5695a', 0.22);
  const texPastel = windowTexture(rng, '#e0a88f', 0.3);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 1 });

  function building(cx, cz, w, d, h, tex) {
    const m = box(w, h, d, 0xffffff, cx, h / 2, cz, { map: tex });
    add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
    roof.position.set(cx, h + 0.25, cz);
    add(roof);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return m;
  }

  for (let ai = 0; ai < WORLD.avenues.length - 1; ai++) {
    for (let si = 0; si < WORLD.streets.length - 1; si++) {
      const x0 = WORLD.avenues[ai] + 8;
      const x1 = WORLD.avenues[ai + 1] - 8;
      const z0 = WORLD.streets[si] + 8;
      const z1 = WORLD.streets[si + 1] - 8;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const distCentre = Math.abs(cx) + Math.abs(cz);
      // Landmark blocks are reserved below; keep them clear.
      if (ai === 5 && si === 1) continue; // diner block
      if (ai === 0 && si === 5) continue; // marina block
      if (ai === 6 && si === 6) continue; // safehouse block
      if (ai === 0 && si === 2) continue; // pier warehouse block
      if (ai === 5 && si === 2) continue; // casino block
      if (ai === 1 && si === 4) continue; // garage block
      if (ai === 6 && si === 0) continue; // chop shop block
      const downtown = distCentre < 90;
      const h = downtown ? range(rng, 26, 58) : range(rng, 7, 16);
      const tex = downtown ? texDowntown : (cz > 40 ? texPastel : texBrick);
      if (rng() < 0.45) {
        // Two smaller buildings side by side.
        const w2 = (x1 - x0) / 2 - 3;
        building(x0 + w2 / 2 + 1, cz, w2, z1 - z0 - 4, h * range(rng, 0.7, 1), tex);
        building(x1 - w2 / 2 - 1, cz, w2, z1 - z0 - 4, h * range(rng, 0.7, 1), tex);
      } else {
        building(cx, cz, x1 - x0 - 4, z1 - z0 - 4, h, tex);
      }
    }
  }

  // --- Landmarks (original names, built from boxes) ---
  // Gull & Anchor diner: low white building, red roof, neon sign board.
  const diner = box(22, 6, 14, 0xf2ead8, 52, 3, -92);
  add(diner);
  add(box(23, 1.2, 15, 0xc23b2e, 52, 6.6, -92));
  const dinerSign = box(10, 2.4, 0.6, 0xffe9a8, 52, 8.4, -92, { emissive: 0xffb347, emissiveIntensity: 0.9 });
  add(dinerSign);
  colliders.push({ minX: 41, maxX: 63, minZ: -99, maxZ: -85 });

  // The Golden Gull casino: tall gold tower with a glowing crown ring.
  const casino = box(20, 34, 20, 0xd9a441, 100, 17, -60, { metalness: 0.35, roughness: 0.4 });
  add(casino);
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(9, 1.1, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xaa7700, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 }),
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.set(100, 36, -60);
  add(crown);
  colliders.push({ minX: 90, maxX: 110, minZ: -70, maxZ: -50 });

  // Pier warehouse (mission 4/5): long brick shed on the west docks.
  const warehouse = box(26, 9, 18, 0x9a5a48, -140, 4.5, -40);
  add(warehouse);
  add(box(27, 1, 19, 0x5a4a42, -140, 9.5, -40));
  colliders.push({ minX: -153, maxX: -127, minZ: -49, maxZ: -31 });

  // Marina: wooden pier jutting into the ocean + moored boats.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 8), pierMat);
  pier.position.set(-180, 0.6, 96);
  pier.castShadow = true;
  pier.receiveShadow = true;
  add(pier);
  for (let i = 0; i < 5; i++) {
    const boat = box(5, 1.6, 2.4, pick(rng, [0xe8e4da, 0x4a7fb5, 0xd7263d]), -190 - i * 2, 0.4, 88 + i * 4);
    add(boat);
    add(box(1.2, 3, 0.3, 0x7a5a3a, -190 - i * 2, 2.2, 88 + i * 4));
  }

  // Safehouse: small house with a blue door, north-east corner block.
  add(box(12, 5, 10, 0xe8dcc8, 118, 2.5, 118));
  add(box(13, 0.8, 11, 0x7a4a3a, 118, 5.4, 118));
  add(box(2.2, 3.4, 0.4, 0x2b5aa8, 118, 1.7, 112.9));
  colliders.push({ minX: 112, maxX: 124, minZ: 113, maxZ: 123 });

  // Fresh Coat garage: open-front spray shop with a striped awning.
  add(box(16, 7, 12, 0x5a6b7d, -60, 3.5, 60));
  add(box(17, 1, 13, 0xf2b705, -60, 7.5, 60));
  colliders.push({ minX: -68, maxX: -52, minZ: 54, maxZ: 66 });

  // Chop shop: corrugated shed, south-east.
  add(box(18, 6, 12, 0x6b7c5e, 118, 3, -118));
  colliders.push({ minX: 109, maxX: 127, minZ: -124, maxZ: -112 });

  // Police station: grey block with a blue stripe, south edge.
  add(box(20, 10, 14, 0x8d99ae, 0, 5, 140));
  add(box(21, 1.4, 14.5, 0x1b4a8a, 0, 7, 140));
  colliders.push({ minX: -10, maxX: 10, minZ: 133, maxZ: 147 });

  // Palms along the beach and boulevards.
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 }),
    );
    trunk.position.y = 3.5;
    trunk.rotation.z = (rng() - 0.5) * 0.15;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palm, roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.5), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    add(g);
  }
  for (let z = -160; z <= 160; z += 20) {
    palm(-168 + range(rng, -2, 2), z + range(rng, -4, 4));
    if (rng() < 0.6) palm(126 + range(rng, -2, 2), z + range(rng, -4, 4));
  }
  for (let x = -140; x <= 140; x += 40) {
    if (rng() < 0.5) palm(x + range(rng, -3, 3), -126);
  }

  // Streetlights along every avenue.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.8 });
  for (const x of WORLD.avenues) {
    for (let z = -140; z <= 140; z += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), poleMat);
      pole.position.set(x + 6.5, 3.25, z);
      pole.castShadow = true;
      add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 6.5, 6.7, z);
      add(lamp);
    }
  }

  // Boardwalk benches + crates as small props (no colliders, cosmetic).
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  for (let i = 0; i < 24; i++) {
    const px = -150 + rng() * 300;
    const pz = -150 + rng() * 300;
    // Keep crates off the roads (check distance to the nearest avenue / street).
    const nearRoad = WORLD.avenues.some((x) => Math.abs(px - x) < 8)
      || WORLD.streets.some((z) => Math.abs(pz - z) < 8);
    if (nearRoad) continue;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateMat);
    c.position.set(px, 0.7, pz);
    c.rotation.y = rng() * Math.PI;
    c.castShadow = true;
    add(c);
  }

  return {
    colliders,
    group,
    landmarks: {
      diner: { x: 52, z: -92 },
      casino: { x: 100, z: -60 },
      warehouse: { x: -140, z: -40 },
      marina: { x: -138, z: 96 },
      safehouse: { x: 118, z: 118 },
      garage: { x: -60, z: 60 },
      chopShop: { x: 118, z: -118 },
      station: { x: 0, z: 140 },
      pier: { x: -180, z: 96 },
    },
  };
}
