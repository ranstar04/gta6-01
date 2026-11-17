// Particles: muzzle flash, smoke, sparks, hit bursts, skid marks.
// One pooled system; every effect is a short-lived THREE.Points / mesh burst.
import * as THREE from 'three';

const MAX = 400;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  // Skid marks: dark quads laid flat on the road, capped count.
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55, depthWrite: false });
  const skids = [];
  const skidGroup = new THREE.Group();
  scene.add(skidGroup);

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life; p.r = r; p.g = g; p.b = b;
  }

  function burst(pos, count, color, speed, life, up = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(pos.x, pos.y, pos.z,
        Math.cos(a) * s, up * Math.random() * speed * 0.7, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7), color.r, color.g, color.b);
    }
  }

  return {
    muzzle(pos, dir) {
      burst(pos, 8, { r: 1, g: 0.75, b: 0.25 }, 7, 0.14);
      spawn(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z, dir.x * 20, dir.y * 20, dir.z * 20, 0.1, 1, 0.9, 0.5);
    },
    hit(pos) {
      burst(pos, 10, { r: 1, g: 0.4, b: 0.2 }, 5, 0.35);
    },
    smoke(pos) {
      burst(pos, 3, { r: 0.35, g: 0.35, b: 0.35 }, 1.2, 1.4, 1.6);
    },
    sparks(pos) {
      burst(pos, 12, { r: 1, g: 0.85, b: 0.3 }, 9, 0.4);
    },
    pickupSparkle(pos) {
      burst(pos, 14, { r: 1, g: 0.85, b: 0.2 }, 3, 0.6, 1.4);
    },
    addSkid(x, z, yaw) {
      if (skids.length > 220) {
        const old = skids.shift();
        skidGroup.remove(old);
      }
      const m = new THREE.Mesh(skidGeo, skidMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = yaw;
      m.position.set(x, 0.06, z);
      skidGroup.add(m);
      skids.push(m);
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (!p.alive) {
          positions[i * 3 + 1] = -100;
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; positions[i * 3 + 1] = -100; continue; }
        p.vy -= 4 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        const fade = p.life / p.maxLife;
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
        colors[i * 3] = p.r * fade; colors[i * 3 + 1] = p.g * fade; colors[i * 3 + 2] = p.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
