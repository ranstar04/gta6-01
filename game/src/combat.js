// SOLMARA's combat: the pistol, melee, Kross enforcers with simple AI, and
// pickups. Shooting is a raycast from the camera along its own forward
// direction — the direction vector is copied into a fresh vector first, so a
// missed shot never spawns its impact at the camera.

import * as THREE from 'three';
import { COMBAT } from './config.js';

const raycaster = new THREE.Raycaster();

function buildEnemy() {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const torso = new THREE.Mesh(box, red);
  torso.scale.set(0.6, 0.7, 0.32);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(box, skin);
  head.scale.set(0.33, 0.35, 0.33);
  head.position.y = 1.66;
  group.add(head);
  const gun = new THREE.Mesh(box, dark);
  gun.scale.set(0.1, 0.1, 0.5);
  gun.position.set(0.3, 1.15, 0.3);
  group.add(gun);
  // Health bar: a dark plate with a green fill that shrinks as health drops.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  plate.position.y = 2.05;
  group.add(plate);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.08), new THREE.MeshBasicMaterial({ color: 0x44cc44 }));
  fill.position.set(0, 2.05, 0.01);
  group.add(fill);
  return { group, fill };
}

export function createCombat(scene) {
  const enemies = [];
  const pickups = [];
  const state = {
    ammo: COMBAT.magSize,
    reserve: 60,
    reloading: 0,
    lastShotAt: -99,
    kills: 0,
    // Cash pickups bank here; main.js sweeps it into the wallet each step.
    cashPending: 0,
  };

  function spawnEnemy(x, z) {
    const { group, fill } = buildEnemy();
    group.position.set(x, 0, z);
    scene.add(group);
    const enemy = {
      mesh: group, fill,
      pos: group.position,
      yaw: 0,
      health: COMBAT.enemyHealth,
      shootTimer: 1 + Math.random(),
      dead: false,
    };
    enemies.push(enemy);
    return enemy;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  function spawnPickup(kind, x, z) {
    const colors = { health: 0x44cc66, ammo: 0xe8b400, cash: 0x44dd88 };
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshLambertMaterial({ color: colors[kind] ?? 0xffffff, emissive: 0x222222 }),
    );
    mesh.position.set(x, 1, z);
    scene.add(mesh);
    const pickup = { kind, mesh, pos: mesh.position, taken: false, spin: 0 };
    pickups.push(pickup);
    return pickup;
  }

  /** Fire the pistol. Returns 'hit' | 'miss' | 'empty' | 'reloading'. */
  function shoot(camera, now, onHit, onMiss, onNoise) {
    if (state.reloading > 0) return 'reloading';
    if (state.ammo <= 0) return 'empty';
    state.ammo -= 1;
    state.lastShotAt = now;
    // A fresh direction vector, copied from the camera — never a discarded clone.
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(origin, dir);
    raycaster.far = COMBAT.range;
    const targets = enemies.filter((e) => !e.dead).map((e) => e.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hit = hits[0];
      let enemy = null;
      for (const e of enemies) {
        if (!e.dead && e.mesh === hit.object.parent) enemy = e;
      }
      if (enemy) {
        enemy.health -= COMBAT.pistolDamage;
        onHit(enemy, hit.point);
        if (enemy.health <= 0) {
          enemy.dead = true;
          state.kills += 1;
          scene.remove(enemy.mesh);
        }
        return 'hit';
      }
      onMiss(hit.point);
      return 'hit';
    }
    // Miss: the impact point is far along the ray, never at the camera.
    const far = origin.clone().addScaledVector(dir, COMBAT.range);
    onMiss(far);
    onNoise(origin, dir);
    return 'miss';
  }

  function reload() {
    if (state.reloading > 0 || state.ammo === COMBAT.magSize || state.reserve <= 0) return false;
    state.reloading = COMBAT.reloadSec;
    return true;
  }

  function melee(playerPos, playerYaw, onSwing) {
    const fx = Math.sin(playerYaw);
    const fz = Math.cos(playerYaw);
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - playerPos.x;
      const dz = e.pos.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < COMBAT.meleeRange && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        e.health -= COMBAT.meleeDamage;
        onSwing(e);
        if (e.health <= 0) {
          e.dead = true;
          state.kills += 1;
          scene.remove(e.mesh);
        }
        return true;
      }
    }
    onSwing(null);
    return false;
  }

  /** Enemies advance and shoot; pickups spin and get collected. */
  function step(dt, now, playerPos, player, effects) {
    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) {
        const need = COMBAT.magSize - state.ammo;
        const take = Math.min(need, state.reserve);
        state.ammo += take;
        state.reserve -= take;
        state.reloading = 0;
      }
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      e.yaw = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.yaw;
      if (dist > 14) {
        e.pos.x += Math.sin(e.yaw) * 3.2 * dt;
        e.pos.z += Math.cos(e.yaw) * 3.2 * dt;
      }
      // The health bar rides with the enemy group, so it faces the player
      // whenever the enemy does; it only needs its width updated.
      e.fill.scale.x = Math.max(0.01, e.health / COMBAT.enemyHealth);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 42) {
        e.shootTimer = COMBAT.enemyShotDelay * (0.8 + Math.random() * 0.5);
        if (Math.random() < COMBAT.enemyHitChance) {
          player.damage(COMBAT.enemyDamage, now);
          effects.muzzle(e.pos.x, 1.4, e.pos.z);
        }
      }
    }
    for (const p of pickups) {
      if (p.taken) continue;
      p.spin += dt * 2;
      p.mesh.rotation.y = p.spin;
      p.mesh.position.y = 1 + Math.sin(p.spin * 1.5) * 0.15;
      if (Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z) < 1.6) {
        p.taken = true;
        scene.remove(p.mesh);
        if (p.kind === 'health') player.heal(30);
        else if (p.kind === 'ammo') state.reserve += 24;
        else if (p.kind === 'cash') state.cashPending += 50;
      }
    }
  }

  return { state, enemies, pickups, spawnEnemy, clearEnemies, spawnPickup, shoot, reload, melee, step };
}
