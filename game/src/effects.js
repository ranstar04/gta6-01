// Effects: pooled particles (bursts, smoke, sparks), tracer lines, muzzle
// flash, and camera shake. Everything is pre-allocated — no per-frame news.
import * as THREE from 'three';

export function createEffects(S) {
  const particles = [];
  const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  for (let i = 0; i < 160; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false;
    S.scene.add(m);
    particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, baseScale: 1 });
  }
  let pIdx = 0;
  function spawnParticle(x, y, z, color, vx, vy, vz, life, grav, scale = 1) {
    const p = particles[pIdx];
    pIdx = (pIdx + 1) % particles.length;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.set(color);
    p.mesh.material.opacity = 1;
    p.mesh.scale.setScalar(scale);
    p.vel.set(vx, vy, vz);
    p.life = life;
    p.maxLife = life;
    p.grav = grav;
    p.baseScale = scale;
  }
  function burst(x, y, z, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawnParticle(
        x, y, z, color,
        Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.3, Math.sin(a) * Math.cos(b) * s,
        life * (0.6 + Math.random() * 0.6), 6, 1,
      );
    }
  }
  function smoke(x, y, z) {
    spawnParticle(x, y, z, 0x777777, (Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6, 1.4, -1.2, 2.6);
  }
  function sparks(x, y, z) {
    burst(x, y, z, 0xffd97a, 10, 5, 0.4);
    burst(x, y, z, 0xffffff, 4, 7, 0.25);
  }

  // Muzzle flash: one reusable additive plane, shown for a blink.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  S.scene.add(flash);
  let flashT = 0;
  function muzzle(pos, dir) {
    flash.position.copy(pos).addScaledVector(dir, 0.3);
    flash.lookAt(S.camera.position);
    flash.material.opacity = 0.95;
    flashT = 0.06;
    burst(pos.x, pos.y, pos.z, 0xffd97a, 3, 2, 0.15);
  }

  // Tracers: thin stretched boxes that live one blink.
  const tracers = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.visible = false;
    S.scene.add(m);
    tracers.push({ mesh: m, life: 0 });
  }
  let tIdx = 0;
  function tracer(from, to) {
    const t = tracers[tIdx];
    tIdx = (tIdx + 1) % tracers.length;
    const d = from.distanceTo(to);
    t.mesh.visible = true;
    t.mesh.position.copy(from).lerp(to, 0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, Math.max(0.1, d));
    t.mesh.material.opacity = 0.9;
    t.life = 0.09;
  }

  let trauma = 0;
  function shake(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  function update(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const f = p.life / p.maxLife;
      p.mesh.material.opacity = f;
      p.mesh.scale.setScalar(p.baseScale * (0.5 + f * 0.5));
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) { t.mesh.visible = false; t.mesh.material.opacity = 0; }
    }
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0) flash.material.opacity = 0;
    }
    trauma = Math.max(0, trauma - dt * 1.6);
  }

  function applyShake(camera) {
    if (trauma <= 0) return;
    const s = trauma * trauma * 0.55;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }

  return { burst, smoke, sparks, muzzle, tracer, shake, update, applyShake };
}
