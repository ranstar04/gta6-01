// Particles and feedback: muzzle flash, hit sparks, damage smoke, skid marks,
// camera shake. One pooled THREE.Points cloud plus a few reusable meshes — no
// allocation in the hot loop.
import * as THREE from 'three';

const MAX_PARTICLES = 420;
const MAX_SKIDS = 60;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) parts.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 });
  let cursor = 0;

  const flashLight = new THREE.PointLight(0xffc860, 0, 18, 1.6);
  scene.add(flashLight);
  let flashTime = 0;

  // Tracer line for gunfire — held visible for staged shots.
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  let tracerTime = 0;

  const skids = [];
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.6);
  for (let i = 0; i < MAX_SKIDS; i += 1) {
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.visible = false;
    scene.add(m);
    skids.push(m);
  }
  let skidCursor = 0;
  let shake = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.life = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.r = r; p.g = g; p.b = b;
  }

  return {
    burst(x, y, z, n, color, speed, up) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, Math.cos(a) * s, (up || 2) * Math.random(), Math.sin(a) * s, 0.4 + Math.random() * 0.5, c.r, c.g, c.b);
      }
    },
    smoke(x, y, z, n) {
      for (let i = 0; i < n; i += 1) spawn(x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.6, 0.32, 0.32, 0.34);
    },
    muzzle(x, y, z) {
      flashLight.position.set(x, y, z);
      flashLight.intensity = 60;
      flashTime = 0.06;
      this.burst(x, y, z, 6, 0xffc860, 7, 1);
    },
    // Held flash + tracer for the staged mission shot (the capture happens
    // ~300 ms after __shotReady, long after a normal 60 ms flash dies).
    muzzleHold(x, y, z, seconds) {
      flashLight.position.set(x, y, z);
      flashLight.intensity = 60;
      flashTime = seconds;
      this.burst(x, y, z, 10, 0xffc860, 7, 1);
    },
    tracerHold(x1, y1, z1, x2, y2, z2, seconds) {
      const p = tracerGeo.attributes.position.array;
      p[0] = x1; p[1] = y1; p[2] = z1; p[3] = x2; p[4] = y2; p[5] = z2;
      tracerGeo.attributes.position.needsUpdate = true;
      tracer.visible = true;
      tracerTime = seconds;
    },
    skid(x, z, heading) {
      const m = skids[skidCursor];
      skidCursor = (skidCursor + 1) % MAX_SKIDS;
      m.position.x = x; m.position.z = z;
      m.rotation.z = -heading;
      m.visible = true;
    },
    addShake(amount) { shake = Math.min(0.6, shake + amount); },
    shakeAmount() { return shake; },
    update(dt) {
      shake = Math.max(0, shake - dt * 1.4);
      if (flashTime > 0) { flashTime -= dt; if (flashTime <= 0) flashLight.intensity = 0; }
      if (tracerTime > 0) { tracerTime -= dt; if (tracerTime <= 0) tracer.visible = false; }
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vy -= 3.5 * dt;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          const f = Math.max(0, p.life);
          col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
        } else {
          pos[i * 3 + 1] = -100;
          col[i * 3] = 0; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
