// Combat: pistol raycast shooting, punch, Kross enforcers with health bars,
// and health/ammo pickups. The shot ray uses a fresh direction vector written
// by the camera — never a discarded clone — so a miss lands where aimed.
import * as THREE from 'three';
import { CFG } from './config.js';
import { dist2D, collideCircle } from './world.js';
import { buildPersonFigure } from './player.js';

const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _to = new THREE.Vector3();

function rayHitBuilding(ox, oy, oz, dx, dy, dz, colliders, maxT) {
  // Slab test against each building AABB (y 0..40). Returns nearest t or Infinity.
  let best = Infinity;
  for (const c of colliders) {
    let t0 = 0;
    let t1 = maxT;
    // x slab
    if (Math.abs(dx) < 1e-8) { if (ox < c.x0 || ox > c.x1) continue; }
    else {
      let a = (c.x0 - ox) / dx;
      let b = (c.x1 - ox) / dx;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-8) { if (oz < c.z0 || oz > c.z1) continue; }
    else {
      let a = (c.z0 - oz) / dz;
      let b = (c.z1 - oz) / dz;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) continue;
    }
    // y slab (building height 40)
    if (Math.abs(dy) < 1e-8) { if (oy < 0 || oy > 40) continue; }
    else {
      let a = (0 - oy) / dy;
      let b = (40 - oy) / dy;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) continue;
    }
    if (t0 < best) best = t0;
  }
  return best;
}

function rayHitSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox; const ly = cy - oy; const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

export function createCombat(S) {
  const enemies = [];
  const pickups = [];
  let reloadT = 0;

  function spawnPickup(type, x, z) {
    let mesh;
    if (type === 'health') {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x1a6a38 }));
      cross1.position.z = 0.42;
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.1), new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x1a6a38 }));
      cross2.position.z = 0.42;
      g.add(box, cross1, cross2);
      mesh = g;
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.5, 0.7),
        new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x6a5200 }),
      );
    }
    mesh.position.set(x, 0.9, z);
    S.scene.add(mesh);
    pickups.push({ type, mesh, x, z, taken: false, respawnT: 0, spin: Math.random() * 6 });
  }

  // Opening pickups scattered near the roads.
  const pickupSpots = [
    ['health', -52, 84], ['ammo', -24, -96], ['health', 84, -24], ['ammo', 96, 84],
    ['health', -96, -84], ['ammo', 24, 144], ['health', 144, -84], ['ammo', -144, 24],
  ];
  for (const [type, x, z] of pickupSpots) spawnPickup(type, x, z);

  function spawnEnemies(x, z, count) {
    for (let i = 0; i < count; i++) {
      const figure = buildPersonFigure({ shirt: 0x8e2f2f, pants: 0x222222, skin: 0xc98d64, cap: 0x8e2f2f });
      const ex = x + (Math.random() - 0.5) * 24;
      const ez = z + (Math.random() - 0.5) * 24;
      figure.group.position.set(ex, 0, ez);
      collideCircle(figure.group.position, 1, S.colliders); // never spawn inside a wall
      S.scene.add(figure.group);
      // Health bar: dark back + green front that shrinks with hp.
      const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.18), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      barBack.position.y = 2.6;
      const barFront = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.12), new THREE.MeshBasicMaterial({ color: 0x2ecc40 }));
      barFront.position.set(0, 2.6, 0.01);
      figure.group.add(barBack, barFront);
      enemies.push({
        group: figure.group, figure, barFront,
        hp: 50, maxHp: 50, shootT: 1 + Math.random() * 1.5, swing: Math.random() * 6, dead: false, deadT: 0,
      });
    }
  }

  function shoot() {
    if (S.playerCar || reloadT > 0 || S.ammo <= 0) return;
    S.ammo--;
    S.audio.shot();
    const cam = S.camera;
    cam.getWorldDirection(_dir);
    _origin.copy(cam.position);
    // Muzzle at the lower right of the view.
    const right = new THREE.Vector3().crossVectors(_dir, cam.up).normalize();
    const muzzle = _origin.clone().addScaledVector(_dir, 0.7).addScaledVector(right, 0.3);
    muzzle.y -= 0.25;
    const maxT = 120;
    let bestT = rayHitBuilding(_origin.x, _origin.y, _origin.z, _dir.x, _dir.y, _dir.z, S.colliders, maxT);
    let hitEnemy = null;
    for (const e of enemies) {
      if (e.dead) continue;
      const ep = e.group.position;
      const t = rayHitSphere(_origin.x, _origin.y, _origin.z, _dir.x, _dir.y, _dir.z, ep.x, ep.y + 1.4, ep.z, 0.75);
      if (t < bestT) { bestT = t; hitEnemy = e; }
    }
    // Ground plane hit so a miss still lands somewhere sensible.
    if (_dir.y < -0.001) {
      const tg = -_origin.y / _dir.y;
      if (tg > 0 && tg < bestT) { bestT = tg; hitEnemy = null; }
    }
    const hitPoint = _origin.clone().addScaledVector(_dir, Math.min(bestT, maxT));
    S.effects.tracer(muzzle, hitPoint);
    S.effects.muzzle(muzzle, _dir);
    S.effects.shake(0.12);
    S.peds.scare(_origin.x, _origin.z, 30);
    if (hitEnemy) {
      hitEnemy.hp -= CFG.pistolDamage;
      S.effects.burst(hitPoint.x, hitPoint.y, hitPoint.z, 0xff5040, 8, 2.5, 0.5);
      hitEnemy.barFront.scale.x = Math.max(0.01, hitEnemy.hp / hitEnemy.maxHp);
      if (hitEnemy.hp <= 0) killEnemy(hitEnemy);
    } else if (bestT < maxT) {
      S.effects.burst(hitPoint.x, hitPoint.y, hitPoint.z, 0xffd97a, 6, 2, 0.4);
    }
    if (S.ammo <= 0) startReload();
  }

  function startReload() {
    if (S.reserveAmmo <= 0 || reloadT > 0) return;
    reloadT = 1.2;
    S.hud.feed('Reloading…');
  }

  function punch() {
    if (S.playerCar) return;
    S.audio.punch();
    const pp = S.player.group.position;
    const fx = Math.sin(S.player.yaw);
    const fz = Math.cos(S.player.yaw);
    for (const e of enemies) {
      if (e.dead) continue;
      const ep = e.group.position;
      const d = dist2D(pp.x, pp.z, ep.x, ep.z);
      const dot = ((ep.x - pp.x) * fx + (ep.z - pp.z) * fz) / (d || 1);
      if (d < CFG.punchRange && dot > 0.4) {
        e.hp -= CFG.punchDamage;
        e.barFront.scale.x = Math.max(0.01, e.hp / e.maxHp);
        e.group.position.x += fx * 0.6;
        e.group.position.z += fz * 0.6;
        if (e.hp <= 0) killEnemy(e);
        return;
      }
    }
  }

  function killEnemy(e) {
    e.dead = true;
    e.deadT = 2.5;
    e.group.rotation.x = -Math.PI / 2;
    S.effects.burst(e.group.position.x, 1.2, e.group.position.z, 0xc0392b, 12, 3, 0.8);
    if (Math.random() < 0.3) spawnPickup('ammo', e.group.position.x + 1, e.group.position.z);
    else if (Math.random() < 0.2) spawnPickup('health', e.group.position.x + 1, e.group.position.z);
    if (S.missions) S.missions.onEnemyKilled();
  }

  function update(dt) {
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        const need = CFG.pistolMag - S.ammo;
        const take = Math.min(need, S.reserveAmmo);
        S.ammo += take;
        S.reserveAmmo -= take;
      }
    }
    const pp = S.player.group.position;
    // Enemy AI: close in, then shoot inaccurately at the player.
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) {
        e.deadT -= dt;
        if (e.deadT <= 0) {
          S.scene.remove(e.group);
          enemies.splice(i, 1);
        }
        continue;
      }
      const ep = e.group.position;
      const dx = pp.x - ep.x;
      const dz = pp.z - ep.z;
      const d = Math.hypot(dx, dz) || 1;
      // The bar rides on the group, so it faces the player whenever the enemy does.
      if (d < 45 && S.mode === 'play') {
        if (d > 16) {
          ep.x += (dx / d) * 4.5 * dt;
          ep.z += (dz / d) * 4.5 * dt;
          e.group.rotation.y = Math.atan2(dx / d, dz / d);
          e.swing += dt * 5;
          e.figure.legL.rotation.x = Math.sin(e.swing) * 0.5;
          e.figure.legR.rotation.x = -Math.sin(e.swing) * 0.5;
        } else {
          e.group.rotation.y = Math.atan2(dx / d, dz / d);
          e.shootT -= dt;
          if (e.shootT <= 0) {
            e.shootT = 1.6 + Math.random() * 1.2;
            S.audio.distantShot();
            const from = new THREE.Vector3(ep.x, ep.y + 1.5, ep.z);
            _to.set(pp.x, pp.y + 1.3, pp.z);
            S.effects.tracer(from, _to);
            if (Math.random() < 0.28 && !S.playerCar) {
              S.player.takeDamage(6 + Math.floor(Math.random() * 5));
              S.hud.feed('You took a hit!');
            }
          }
        }
      }
    }
    // Pickups bob, spin, respawn, and get collected.
    for (const p of pickups) {
      if (p.taken) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          p.taken = false;
          p.mesh.visible = true;
        }
        continue;
      }
      p.spin += dt * 2;
      p.mesh.rotation.y = p.spin;
      p.mesh.position.y = 0.9 + Math.sin(p.spin * 1.4) * 0.15;
      if (!S.playerCar && dist2D(pp.x, pp.z, p.x, p.z) < 1.7) {
        p.taken = true;
        p.mesh.visible = false;
        p.respawnT = 20;
        if (p.type === 'health') {
          S.health = Math.min(CFG.maxHealth, S.health + 30);
          S.hud.feed('Health +30');
        } else {
          S.reserveAmmo += 24;
          S.hud.feed('Ammo +24');
        }
        S.audio.chime();
      }
    }
  }

  return { enemies, pickups, spawnEnemies, shoot, punch, startReload, update };
}
