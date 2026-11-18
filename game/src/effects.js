// SOLMARA's particles and marks: one reusable pool of points for muzzle
// flashes, hit sparks, damage smoke and pickup glints, plus skid marks that
// fade on the asphalt. Nothing allocates while the game runs.

import * as THREE from 'three';

const MAX_PARTICLES = 400;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.r = r; p.g = g; p.b = b;
  }

  function burst(x, y, z, n, speed, life, r, g, b) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.7), r, g, b);
    }
  }

  /** Orange sparks where a bullet lands. */
  function impact(x, y, z) {
    burst(x, y, z, 10, 5, 0.5, 1.0, 0.75, 0.25);
  }

  /** Yellow-white flash at a muzzle. */
  function muzzle(x, y, z) {
    burst(x, y, z, 6, 3, 0.16, 1.0, 0.9, 0.4);
  }

  /** Grey smoke puff from a damaged engine. */
  function smoke(x, y, z) {
    spawn(x, y, z, (Math.random() - 0.5) * 0.6, 1.4 + Math.random(), (Math.random() - 0.5) * 0.6, 1.1, 0.45, 0.45, 0.45);
  }

  /** A golden glint for a collected shell. */
  function glint(x, y, z) {
    burst(x, y, z, 14, 3.5, 0.7, 1.0, 0.85, 0.3);
  }

  // Skid marks: dark translucent quads that fade over a few seconds.
  const skids = [];
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5, depthWrite: false });
  function skid(x, z, yaw) {
    if (skids.length > 60) {
      const old = skids.shift();
      scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(skidGeo, skidMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -yaw;
    mesh.position.set(x, 0.06, z);
    scene.add(mesh);
    skids.push({ mesh, life: 5 });
  }

  // Tracer lines: four reusable THREE.Line objects, one per recent shot.
  const tracers = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 })
    );
    line.visible = false;
    scene.add(line);
    tracers.push({ line, ttl: 0 });
  }

  /** A tracer line from a muzzle to an impact point (fades in 0.12s). */
  function tracer(x1, y1, z1, x2, y2, z2) {
    const t = tracers.find((item) => item.ttl <= 0) || tracers[0];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, x1, y1, z1);
    pos.setXYZ(1, x2, y2, z2);
    pos.needsUpdate = true;
    t.line.visible = true;
    t.line.material.opacity = 0.9;
    t.ttl = 0.12;
  }

  function step(dt) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = pool[i];
      if (!p.alive) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= 6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      const fade = p.life / p.maxLife;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      colors[i * 3] = p.r * fade;
      colors[i * 3 + 1] = p.g * fade;
      colors[i * 3 + 2] = p.b * fade;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    for (let i = skids.length - 1; i >= 0; i -= 1) {
      const s = skids[i];
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life / 5) * 0.5;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        skids.splice(i, 1);
      }
    }
    for (const t of tracers) {
      if (t.ttl <= 0) continue;
      t.ttl -= dt;
      t.line.material.opacity = Math.max(0, t.ttl / 0.12) * 0.9;
      if (t.ttl <= 0) t.line.visible = false;
    }
  }

  return { impact, muzzle, smoke, glint, skid, tracer, step };
}
