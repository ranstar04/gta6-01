// Combat: pistol (raycast, ammo + pickups), punch, enemy gang members with simple
// AI (advance, shoot inaccurately, health bars), health/ammo/shell pickups.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { clamp, dist2D } from './random.js';

export function createCombat(scene, effects, audio) {
  const enemies = [];
  const pickups = [];
  let gunfireAt = null;
  let gunfireTimer = 0;

  const raycaster = new THREE.Raycaster();

  function buildEnemy(x, z) {
    const g = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0x3a1a2a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
    torso.position.y = 1.28;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.92;
    g.add(head);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), new THREE.MeshStandardMaterial({ color: 0xd7263d }));
    band.position.y = 2.1;
    g.add(band);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.26), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    legL.position.set(-0.17, 0.45, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.17;
    g.add(legR);
    // Health bar sprite above the head.
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8 }),
    );
    barBg.position.y = 2.5;
    g.add(barBg);
    const barFg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xe04040 }),
    );
    barFg.position.set(0, 2.5, 0.01);
    g.add(barFg);
    g.position.set(x, 0, z);
    scene.add(g);
    return { mesh: g, barFg, x, z, health: TUNE.enemyHealth, shootTimer: 1 + Math.random() * 2, phase: Math.random() * 6 };
  }

  function spawnEnemies(points) {
    for (const p of points) enemies.push(buildEnemy(p.x, p.z));
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  function addPickup(kind, x, z) {
    let color = 0x4ae08a;
    let label = 'health';
    if (kind === 'ammo') { color = 0xe8c25a; label = 'ammo'; }
    if (kind === 'shell') { color = 0xffd700; label = 'shell'; }
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3 }),
    );
    mesh.position.set(x, 0.9, z);
    mesh.castShadow = true;
    scene.add(mesh);
    pickups.push({ kind, mesh, x, z, bob: Math.random() * 6 });
    return label;
  }

  // Fire the pistol from the camera toward the crosshair. Returns the hit enemy or null.
  function shoot(camera, player, ammoState) {
    if (ammoState.ammo <= 0) return 'empty';
    ammoState.ammo -= 1;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 90;
    const targets = enemies.map((e) => e.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    const origin = camera.position.clone();
    // NOTE: Vector3.clone() takes no arguments and RETURNS the copy — the old
    // `raycaster.ray.direction.clone(dir)` discarded the return value, leaving
    // dir at (0,0,0). That made the miss-path puff spawn at `origin` itself
    // (the camera lens), where each particle renders as a ~500px square and
    // the whole frame washed peach. Clone properly so the puff lands 60 units
    // downrange and the tracer actually flies.
    const dir = raycaster.ray.direction.clone();
    // Muzzle flash at the player's gun, not at the camera: a flash spawned at
    // the lens would fill the screen (points render as squares up close).
    const muzzle = new THREE.Vector3(player.x, 1.4, player.z).add(dir.clone().multiplyScalar(1.0));
    effects.muzzle(muzzle, dir);
    if (audio) audio.shot();
    gunfireAt = { x: player.x, z: player.z };
    gunfireTimer = 1.5;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.enemyRef) obj = obj.parent;
      const enemy = enemies.find((e) => e.mesh === hits[0].object || e.mesh === obj);
      const hitPoint = hits[0].point;
      effects.hit(hitPoint);
      if (enemy) {
        enemy.health -= TUNE.pistolDamage;
        enemy.barFg.scale.x = clamp(enemy.health / TUNE.enemyHealth, 0, 1);
        enemy.barFg.position.x = -0.525 * (1 - clamp(enemy.health / TUNE.enemyHealth, 0, 1));
        if (enemy.health <= 0) {
          scene.remove(enemy.mesh);
          enemies.splice(enemies.indexOf(enemy), 1);
          effects.burst ? effects.burst(hitPoint, 10, { r: 1, g: 0.4, b: 0.2 }, 5, 0.4) : effects.hit(hitPoint);
          return 'kill';
        }
        return 'hit';
      }
    }
    // Tracer end: a puff where the ray ends.
    const end = origin.clone().add(dir.clone().multiplyScalar(60));
    effects.hit(end);
    return 'miss';
  }

  function update(dt, player, onPickup) {
    if (gunfireTimer > 0) {
      gunfireTimer -= dt;
      if (gunfireTimer <= 0) gunfireAt = null;
    }
    // Enemies advance and shoot (inaccurately) at the player.
    for (const e of [...enemies]) {
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 26) continue;
      e.mesh.lookAt(player.x, 0, player.z);
      if (dist > 8) {
        e.x += (dx / dist) * 3.2 * dt;
        e.z += (dz / dist) * 3.2 * dt;
        e.phase += dt * 8;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 26) {
        e.shootTimer = 1.1 + Math.random() * 1.2;
        // Enemy shot: mostly misses, sometimes lands.
        if (Math.random() < 0.3) {
          player.health -= 8;
          effects.hit({ x: player.x, y: 1.4, z: player.z });
          if (audio) audio.shot();
        }
        const from = new THREE.Vector3(e.x, 1.5, e.z);
        const to = new THREE.Vector3(player.x, 1.4, player.z);
        const dir = to.clone().sub(from).normalize();
        effects.muzzle(from, dir);
        gunfireAt = { x: e.x, z: e.z };
        gunfireTimer = 1;
      }
    }
    // Pickups bob + collect.
    for (const p of [...pickups]) {
      p.bob += dt * 2;
      p.mesh.position.y = 0.9 + Math.sin(p.bob) * 0.15;
      p.mesh.rotation.y += dt * 1.5;
      if (dist2D(p.x, p.z, player.x, player.z) < 1.6) {
        scene.remove(p.mesh);
        pickups.splice(pickups.indexOf(p), 1);
        effects.pickupSparkle({ x: p.x, y: 1, z: p.z });
        if (audio) audio.pickup();
        if (onPickup) onPickup(p.kind);
      }
    }
  }

  return {
    enemies, pickups, spawnEnemies, clearEnemies, addPickup, shoot, update,
    get gunfireAt() { return gunfireAt; },
  };
}
