// buildCity: the whole of Solmara — road grid, blocks, procedural buildings with
// canvas window textures, palms, streetlights, beach, pier, marina, casino,
// docks. Ground is 1200x1200, the ocean 500x1200 to the west, skyBottom == fog
// so the horizon never shows a hard edge. Warehouses use the same window
// texture as every other building (a bare facade reads as a black slab).
import * as THREE from 'three';
import { CITY, PALETTE, ROADS } from './config.js';
import { pick, range } from './random.js';

function windowTexture(base, rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 128, 10);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#5a7d94';
      g.fillRect(12 + col * 28, 22 + row * 28, 18, 16);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(12 + col * 28, 22 + row * 28, 18, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);
  const fogColor = new THREE.Color(PALETTE.fog);

  // --- ground, sand, ocean -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 1200),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-279, 0.04, 0);
  group.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(500, 1200, 24, 48);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({ color: PALETTE.ocean }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-551, 0.12, 0);
  group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  // --- sidewalks: one light slab per block --------------------------------
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const blockCentres = [-180, -60, 60, 180];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block, CITY.block), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx, 0.03, bz);
      group.add(slab);
    }
  }

  // --- road dashes (one instanced mesh) ------------------------------------
  const dashGeo = new THREE.PlaneGeometry(0.5, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const dashPositions = [];
  for (const r of ROADS) {
    for (let v = -288; v <= 288; v += 24) {
      dashPositions.push([r, v, 0]); // avenue dash (along z)
      dashPositions.push([v, r, 1]); // street dash (along x)
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  dashPositions.forEach(([x, z, along], i) => {
    e.set(-Math.PI / 2, 0, along === 0 ? 0 : Math.PI / 2);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 0.05, z), q, s);
    dashes.setMatrixAt(i, m4);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // --- building textures + materials ---------------------------------------
  const texes = PALETTE.building.map((c) => windowTexture(c, rng, 0.45));
  const mats = texes.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: '#6b5a4a' });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxUV = boxGeo.attributes.uv;

  function addBuilding(cx, cz, w, d, h, matIdx, collider = true) {
    const m = new THREE.Mesh(boxGeo, mats[matIdx % mats.length]);
    m.scale.set(w, h, d);
    m.position.set(cx, h / 2, cz);
    group.add(m);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.8, d + 0.6);
    roof.position.set(cx, h + 0.4, cz);
    group.add(roof);
    if (collider) colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return m;
  }

  // Landmark blocks first (fixed), then fill the rest procedurally.
  // Old Harbor warehouse (north-west block) — window texture, NOT a bare slab.
  addBuilding(-180, -180, 64, 40, 16, 2);
  // Marina low sheds (south-west block).
  addBuilding(-196, 196, 30, 18, 9, 3);
  addBuilding(-156, 214, 22, 14, 8, 0);
  // Casino "The Golden Gull" (south-east block): big gold-trimmed hall.
  const casino = addBuilding(180, 180, 72, 46, 24, 1);
  casino.material = new THREE.MeshLambertMaterial({ map: texes[1], emissive: 0x332200 });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 14),
    new THREE.MeshBasicMaterial({ map: signTexture('GOLDEN GULL', '#3a2408', '#f2c94c') }),
  );
  sign.position.set(180, 20, 155.5);
  sign.rotation.y = Math.PI;
  group.add(sign);
  // Chop shop (east block).
  addBuilding(180, 60, 44, 30, 11, 4);
  // Fresh Coat garage (south-west block, east side).
  addBuilding(-132, 186, 34, 22, 9, 5);
  // Gull & Anchor diner (west-central block).
  addBuilding(-186, -60, 30, 20, 10, 0);
  const dinerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: signTexture('GULL & ANCHOR', '#274156', '#ffe9b0') }),
  );
  dinerSign.position.set(-170.5, 9, -60);
  dinerSign.rotation.y = Math.PI / 2;
  group.add(dinerSign);

  // Fill remaining blocks with 2–4 buildings each; downtown (near centre) goes tall.
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const landmark = (bx === -180 && bz === -180) || (bx === -180 && bz === 180) || (bx === 180 && bz === 180)
        || (bx === 180 && bz === 60) || (bx === -180 && bz === -60);
      if (landmark) continue;
      const downtown = Math.abs(bx) <= 60 && Math.abs(bz) <= 60;
      const n = downtown ? 2 : 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i += 1) {
        const w = range(rng, 22, 40);
        const d = range(rng, 22, 40);
        const cx = bx + range(rng, -28, 28);
        const cz = bz + range(rng, -28, 28);
        const h = downtown ? range(rng, 34, 62) : range(rng, 11, 26);
        addBuilding(cx, cz, w, d, h, Math.floor(rng() * mats.length));
      }
    }
  }

  // --- palms along sidewalks ----------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5c38' });
  const frondMat = new THREE.MeshLambertMaterial({ color: '#3f8f4f' });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const frondGeo = new THREE.ConeGeometry(0.9, 4.2, 4);
  for (let i = 0; i < 46; i += 1) {
    const road = pick(rng, ROADS);
    const along = range(rng, -280, 280);
    const side = rng() < 0.5 ? -1 : 1;
    const px = rng() < 0.5 ? road + side * 10 : along;
    const pz = rng() < 0.5 ? along : road + side * 10;
    if (px < -256 || Math.abs(px) > 292 || Math.abs(pz) > 292) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    group.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(px, 7.2, pz);
      frond.rotation.z = 1.1;
      frond.rotation.y = (f / 6) * Math.PI * 2;
      frond.scale.set(1, 1, 0.4);
      group.add(frond);
    }
  }

  // --- streetlights ---------------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: '#2c2f36' });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6);
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const r of ROADS) {
    for (let v = -240; v <= 240; v += 120) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(r + 8, 3.75, v);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(r + 8, 7.6, v);
      group.add(lamp);
    }
  }

  // --- pier (Old Harbor, west over the ocean) ------------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: '#8a6f4d' });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(100, 1.2, 14), pierMat);
  pier.position.set(-310, 1.4, -180);
  group.add(pier);
  colliders.push({ minX: -360, maxX: -260, minZ: -187, maxZ: -173 });
  const shack = new THREE.Mesh(boxGeo, mats[3]);
  shack.scale.set(10, 6, 8);
  shack.position.set(-348, 4.4, -180);
  group.add(shack);

  // --- marina docks + boats -------------------------------------------------
  for (let i = 0; i < 3; i += 1) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 5), pierMat);
    dock.position.set(-282, 1.0, 150 + i * 42);
    group.add(dock);
    const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, ['#e8e8e8', '#c02030', '#4a7fb5']) }));
    hull.scale.set(9, 2.2, 3.4);
    hull.position.set(-288, 1.4, 162 + i * 42);
    group.add(hull);
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: '#f0ead8' }));
    cab.scale.set(3.5, 1.8, 2.6);
    cab.position.set(-288, 3.2, 162 + i * 42);
    group.add(cab);
  }

  // --- dock containers (east edge) ------------------------------------------
  const contCols = ['#c02030', '#2e7f9e', '#d98c2b', '#5a7d3a'];
  for (let i = 0; i < 8; i += 1) {
    const cx = 262 + (i % 2) * 10;
    const cz = -216 + Math.floor(i / 2) * 22;
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    c.scale.set(9, 4, 4);
    c.position.set(cx, 2 + (i % 3 === 2 ? 4 : 0), cz);
    group.add(c);
    colliders.push({ minX: cx - 4.5, maxX: cx + 4.5, minZ: cz - 2, maxZ: cz + 2 });
  }

  // --- park patch (centre-north block corner) ------------------------------
  const park = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  park.rotation.x = -Math.PI / 2;
  park.position.set(60, 0.04, -180);
  group.add(park);

  return {
    colliders,
    spawns: {
      diner: { x: -132, z: -60 }, marina: { x: -272, z: 186 }, safehouse: { x: 234, z: -66 },
      docks: { x: 252, z: -180 }, warehouse: { x: -186, z: -156 }, casino: { x: 126, z: 186 },
      chopshop: { x: 186, z: 80 }, garage: { x: -132, z: 202 }, playerStart: { x: -108, z: -36, heading: Math.PI / 2 },
      taxiStand: { x: 0, z: 120 },
    },
    shellSpots: [
      { x: -352, z: -180 }, { x: -280, z: 60 }, { x: -282, z: 210 }, { x: 126, z: 200 },
      { x: 60, z: -180 }, { x: -108, z: -36 }, { x: 246, z: 120 }, { x: 0, z: -246 },
      { x: -240, z: 240 }, { x: 180, z: -120 },
    ],
    carSpawns: [
      { type: 'alba', x: -108, z: -48 }, { type: 'vesper', x: 126, z: 174 }, { type: 'bruto', x: 252, z: -168 },
      { type: 'corto', x: 12, z: 120 }, { type: 'vela', x: -12, z: -120 }, { type: 'alba', x: 132, z: 60 },
      { type: 'vesper', x: -60, z: 132 }, { type: 'corto', x: 240, z: -12 },
    ],
    update(dt, time) {
      // Ocean swell: gentle sine over the stored base positions.
      const p = oceanGeo.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const bx = oceanBase[i * 3];
        const by = oceanBase[i * 3 + 1];
        p.array[i * 3 + 2] = Math.sin(bx * 0.05 + time * 0.9) * 0.35 + Math.cos(by * 0.04 + time * 0.6) * 0.3;
      }
      p.needsUpdate = true;
      oceanGeo.computeVertexNormals();
    },
  };
}
