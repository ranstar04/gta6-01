// buildCity: roads + sidewalks, district buildings with procedural window
// textures, named story places with signs, pier + marina, palms, streetlights.
// Exports colliders, named places, shell spots, car spawns and ped waypoints.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { makeRng } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33333a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3a41';
    for (let i = 0; i < 200; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#d8d8d8'; g.fillRect(3, 0, 2, h); g.fillRect(w - 5, 0, 2, h);
    g.fillStyle = '#f2c14e'; g.fillRect(w / 2 - 2, 8, 4, 40); g.fillRect(w / 2 - 2, 72, 4, 40);
  });
}

function windowTexture(rng) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#c9ced6'; g.fillRect(0, 0, w, h);
    const cols = 5; const rows = 10;
    const cw = w / cols; const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g.fillStyle = rng.chance(0.28) ? '#ffd97a' : '#2b3542';
        g.fillRect(x * cw + 4, y * ch + 6, cw - 8, ch - 12);
      }
    }
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.font = 'bold 52px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function buildCity(S) {
  const rng = makeRng(CFG.seed);
  const scene = S.scene;
  const colliders = [];
  const places = {};
  const shellSpots = [];
  const carSpawns = [];
  const pedWaypoints = [];
  const matCache = new Map();
  const winTexs = [windowTexture(rng), windowTexture(rng), windowTexture(rng), windowTexture(rng)];
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });

  function lambert(color) {
    let m = matCache.get(color);
    if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
    return m;
  }
  function windowed(color, texIdx) {
    const key = `w${color}_${texIdx}`;
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshLambertMaterial({ color, map: winTexs[texIdx % winTexs.length] }); matCache.set(key, m); }
    return m;
  }
  function addBox(x, y, z, w, h, d, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    scene.add(mesh);
    if (collide) colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return mesh;
  }
  function addBuilding(x, z, w, h, d, color, texIdx = 0) {
    const side = windowed(color, texIdx);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofMat, roofMat, side, side]);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // Rooftop AC box so flat roofs read as rooftops.
    if (h > 12) addBox(x + w * 0.2, h, z - d * 0.15, 3, 1.6, 3, lambert(0x5a564f), false);
    return mesh;
  }
  function addSign(x, y, z, text, bg, fg, w = 16) {
    const tex = signTexture(text, bg, fg);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3, 0.4),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  // ---- Roads + sidewalks -------------------------------------------------
  // One shared road material: the asphalt texture repeats along every road,
  // so no per-road texture upload is needed.
  const roadTex = roadTexture();
  roadTex.repeat.set(1, 24);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = lambert(PALETTE.sidewalk);
  for (const r of CFG.roads) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(vertical ? CFG.roadWidth : 372, 0.1, vertical ? 372 : CFG.roadWidth), roadMat);
      road.position.set(vertical ? r : 0, 0.02, vertical ? 0 : r);
      scene.add(road);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 3 : 372, 0.16, vertical ? 372 : 3), walkMat);
        walk.position.set(vertical ? r + side * 7.5 : 0, 0.04, vertical ? 0 : r + side * 7.5);
        scene.add(walk);
      }
    }
  }
  // Sidewalk waypoint grid for pedestrians (every 30 units along each road).
  for (const r of CFG.roads) {
    for (let t = -170; t <= 170; t += 30) {
      pedWaypoints.push({ x: r + 7.5, z: t });
      pedWaypoints.push({ x: r - 7.5, z: t });
      pedWaypoints.push({ x: t, z: r + 7.5 });
      pedWaypoints.push({ x: t, z: r - 7.5 });
    }
  }

  // ---- District blocks ----------------------------------------------------
  const BLOCKS = [-171, -120, -60, 0, 60, 120, 171];
  const NAMED = {
    '-60,120': 'diner', '60,-60': 'casino', '0,120': 'garage', '120,120': 'chopshop',
    '-171,-60': 'warehouse', '-171,60': 'docks', '120,-120': 'safehouse',
    '60,0': 'station', '-60,-120': 'hospital', '0,171': 'park',
  };
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const key = `${bx},${bz}`;
      if (NAMED[key]) continue;
      const downtown = Math.abs(bx) <= 60 && Math.abs(bz) <= 60;
      const harbor = bx <= -120;
      const verde = bx >= 120;
      const terrace = bz <= -120;
      if (downtown) {
        const h = rng.range(26, 68);
        addBuilding(bx, bz, rng.range(26, 32), h, rng.range(26, 32), rng.pick(PALETTE.downtown), rng.int(0, 3));
      } else if (harbor) {
        addBuilding(bx, bz, rng.range(30, 38), rng.range(8, 13), rng.range(20, 26), rng.pick(PALETTE.harbor), rng.int(0, 3));
      } else if (verde) {
        for (const ox of [-11, 11]) for (const oz of [-11, 11]) {
          if (rng.chance(0.2)) continue;
          addBuilding(bx + ox, bz + oz, rng.range(13, 17), rng.range(6, 12), rng.range(13, 17), rng.pick(PALETTE.verde), rng.int(0, 3));
        }
      } else if (terrace) {
        for (const ox of [-11, 11]) for (const oz of [-11, 11]) {
          if (rng.chance(0.25)) continue;
          addBuilding(bx + ox, bz + oz, rng.range(12, 15), rng.range(5, 9), rng.range(12, 15), rng.pick(PALETTE.terrace), rng.int(0, 3));
        }
      } else {
        addBuilding(bx, bz, rng.range(22, 28), rng.range(10, 22), rng.range(22, 28), rng.pick(PALETTE.downtown), rng.int(0, 3));
        if (rng.chance(0.5)) addBuilding(bx + 14, bz - 14, 10, rng.range(6, 10), 10, rng.pick(PALETTE.verde), rng.int(0, 3));
      }
    }
  }

  // ---- Named story places ---------------------------------------------------
  // Diner: Gull & Anchor.
  addBuilding(-60, 120, 20, 8, 14, 0xf1e3c6, 1);
  addSign(-60, 8.6, 112.4, 'GULL & ANCHOR', '#7a1f1f', '#ffe9a8');
  places.diner = { x: -60, z: 96 };
  // Casino: The Golden Gull.
  addBuilding(60, -60, 34, 22, 26, 0xd9a441, 2);
  addSign(60, 22.6, -46.4, 'THE GOLDEN GULL', '#1a1a22', '#ffd97a', 24);
  places.casino = { x: 60, z: -36 };
  // Fresh Coat garage (spray shop).
  addBuilding(0, 120, 24, 9, 16, 0x3d8bfd, 0);
  addSign(0, 9.6, 111.4, 'FRESH COAT', '#e8e4da', '#c0392b');
  places.garage = { x: 0, z: 96 };
  // Chop shop.
  addBuilding(120, 120, 22, 9, 18, 0x5a564f, 1);
  addSign(120, 9.6, 110.4, 'CHOP SHOP', '#222222', '#f2c14e');
  places.chopshop = { x: 120, z: 96 };
  // Pier warehouse.
  addBuilding(-171, -60, 36, 12, 22, 0x9c6644, 0);
  addSign(-152.4, 12.6, -60, 'PIER WAREHOUSE', '#6c584c', '#ffe9a8', 20);
  places.warehouse = { x: -144, z: -60 };
  // Docks warehouses.
  addBuilding(-171, 60, 20, 10, 14, 0x7f5539, 1);
  addBuilding(-171, 82, 20, 10, 14, 0xb08968, 2);
  places.docks = { x: -144, z: 60 };
  // Safehouse.
  addBuilding(120, -120, 14, 7, 12, 0xe8dcc8, 3);
  places.safehouse = { x: 120, z: -96 };
  // Police station.
  addBuilding(60, 0, 26, 14, 20, 0x4a6fa5, 0);
  addSign(60, 14.6, 10.4, 'POLICE', '#1a1a22', '#dfe9ff');
  places.station = { x: 60, z: 30 };
  // Hospital.
  addBuilding(-60, -120, 24, 12, 18, 0xe8e4da, 1);
  addSign(-60, 12.6, -110.4, 'HOSPITAL', '#e8e4da', '#c0392b');
  places.hospital = { x: -60, z: -96 };
  // Marina marker (docks at the water's edge).
  places.marina = { x: -196, z: -132 };

  // ---- Pier + marina -------------------------------------------------------
  const woodMat = lambert(0x8a6b48);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(76, 0.5, 10), woodMat);
  pier.position.set(-224, 0.35, -120);
  scene.add(pier);
  for (let x = -190; x >= -258; x -= 9) {
    for (const dz of [-4.4, 4.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), woodMat);
      post.position.set(x, 0.4, -120 + dz);
      scene.add(post);
    }
  }
  // Marina docks + boats.
  for (const dz of [-150, -138]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 4), woodMat);
    dock.position.set(-205, 0.3, dz);
    scene.add(dock);
  }
  const boatHull = lambert(0x2e4a5a);
  const boatCabin = lambert(0xe8e4da);
  for (let i = 0; i < 3; i++) {
    const bx = -206 - i * 9;
    const bz = -146 + (i % 2) * 12;
    addBox(bx, 0.2, bz, 9, 1.6, 3, boatHull, false);
    addBox(bx - 1, 1.8, bz, 3.5, 1.8, 2.4, boatCabin, false);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), woodMat);
    mast.position.set(bx + 1, 5, bz);
    scene.add(mast);
  }

  // ---- Palms, streetlights, crates -----------------------------------------
  const trunkMat = lambert(PALETTE.palmTrunk);
  const leafMat = lambert(PALETTE.palmLeaf);
  function addPalm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = rng.range(-0.08, 0.08);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      leaf.scale.set(1, 1, 0.35);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ x0: x - 0.5, z0: z - 0.5, x1: x + 0.5, z1: z + 0.5 });
  }
  for (let z = -160; z <= 160; z += 40) addPalm(-196, z);
  for (let x = -120; x <= 120; x += 60) { addPalm(x + 20, 178); addPalm(x - 20, -178); }
  for (let i = 0; i < 8; i++) addPalm(rng.range(-14, 14), 171 + rng.range(-10, 10));
  for (let i = 0; i < 6; i++) addPalm(150 + rng.range(-8, 8), rng.range(-140, 140));

  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a });
  const poleMat = lambert(0x2a2a30);
  for (const r of [-90, 30, 150]) {
    for (let t = -120; t <= 120; t += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6), poleMat);
      pole.position.set(r + 7.5, 3.25, t);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(r + 7.5, 6.6, t);
      scene.add(lamp);
    }
  }
  const crateMat = lambert(0xa67c52);
  const crateSpots = [[-150, -48], [-156, -52], [-148, -70], [-160, 72], [-152, 68], [132, 108], [108, 108], [-48, 108]];
  for (const [cx, cz] of crateSpots) addBox(cx, 0, cz, rng.range(1.4, 2.4), rng.range(1.4, 2.2), rng.range(1.4, 2.4), crateMat);

  // ---- Shell spots (10 golden shells) --------------------------------------
  shellSpots.push(
    { x: -252, z: -120 }, { x: -205, z: 40 }, { x: -200, z: -140 }, { x: -150, z: -52 },
    { x: 52, z: -36 }, { x: 112, z: 104 }, { x: 128, z: -112 }, { x: 8, z: 104 },
    { x: 52, z: 30 }, { x: -52, z: -96 },
  );

  // ---- Ambient parked-car spots --------------------------------------------
  for (const [x, z, dir] of [
    [-144, -20, 0], [-24, -144, Math.PI / 2], [96, -24, 0], [24, 96, Math.PI / 2],
    [-96, 144, Math.PI / 2], [144, 24, 0], [36, -144, Math.PI / 2], [-36, 144, Math.PI / 2],
  ]) carSpawns.push({ x, z, dir });

  S.colliders = colliders;
  S.places = places;
  S.shellSpots = shellSpots;
  S.carSpawns = carSpawns;
  S.pedWaypoints = pedWaypoints;
  return { places, shellSpots, carSpawns, pedWaypoints };
}
