// Combat: pistol (raycast from the camera, magazine + reload), punch, Kross
// enforcers with health bars, pickups (health / ammo / cash). Shooting direction
// is copied into a FRESH vector via getWorldDirection — never a discarded clone.
import * as THREE from 'three';
import { COMBAT, WANTED } from './config.js';

const ENEMY_COLORS = [0x8a2a2a, 0x6b3a8a, 0x2a5a8a];

export function createCombat(scene, rng) {
  const raycaster = new THREE.Raycaster();
  const enemies = [];
  const pickups = [];
  let ammo = COMBAT.magSize;
  let reloadTimer = 0;
  let gunfireAt = null;
  let gunfireTimer = 0;

  const pickupGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const pickupMats = {
    health: new THREE.MeshBasicMaterial({ color: 0x35d05a }),
    ammo: new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
    cash: new THREE.MeshBasicMaterial({ color: 0x2aff8a }),
  };

  function spawnEnemy(x, z) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), new THREE.MeshLambertMaterial({ color: ENEMY_COLORS[enemies.length % 3] }));
    torso.position.y = 1.12;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
    head.position.y = 1.68;
    group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.2, 0.3);
    group.add(gun);
    // Health bar: a thin box above the head, scaled by health.
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x330000 }));
    barBg.position.y = 2.15;
    group.add(barBg);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    bar.position.y = 2.15;
    group.add(bar);
    scene.add(group);
    const e = {
      group, bar, pos: new THREE.Vector3(x, 0, z),
      health: COMBAT.enemyHealth, shootTimer: 1 + Math.random() * 1.2, dead: false, phase: Math.random() * 6,
    };
    enemies.push(e);
    return e;
  }

  function spawnPickup(kind, x, z) {
    const m = new THREE.Mesh(pickupGeo, pickupMats[kind]);
    m.position.set(x, 0.7, z);
    scene.add(m);
    pickups.push({ mesh: m, kind, pos: new THREE.Vector3(x, 0.7, z), taken: false, bob: Math.random() * 6 });
    return m;
  }

  const state = { cashPending: 0 }; // collected cash awaiting bank — read by main.js HUD

  return {
    state, enemies, pickups,
    ammo() { return ammo; },
    reloading() { return reloadTimer > 0; },
    get gunfireAt() { return gunfireAt; },
    spawnEnemy, spawnPickup,
    clearEnemies() {
      for (const e of enemies) scene.remove(e.group);
      enemies.length = 0;
    },
    clearPickups() {
      for (const p of pickups) scene.remove(p.mesh);
      pickups.length = 0;
    },
    shoot(G) {
      if (reloadTimer > 0) return;
      if (ammo <= 0) {
        reloadTimer = COMBAT.reloadSec;
        G.audio.fail();
        return;
      }
      ammo -= 1;
      G.audio.shot();
      const cam = G.render.camera;
      // Fresh direction vector from the camera — no discarded clone.
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const origin = cam.position.clone();
      raycaster.set(origin, dir);
      raycaster.far = COMBAT.pistolRange;
      const targets = [];
      for (const e of enemies) if (!e.dead) targets.push(e.group);
      for (const c of G.cars) targets.push(c.group);
      const hits = raycaster.intersectObjects(targets, true);
      const muzzlePos = origin.clone().add(dir.clone().multiplyScalar(1.2));
      muzzlePos.y -= 0.25;
      G.effects.muzzle(muzzlePos.x, muzzlePos.y, muzzlePos.z);
      gunfireAt = { x: G.player.state.pos.x, z: G.player.state.pos.z };
      gunfireTimer = 0.5;
      G.pedestrians.scareAll(G.player.state.pos.x, G.player.state.pos.z, 30);
      if (hits.length > 0) {
        const hit = hits[0];
        G.effects.burst(hit.point.x, hit.point.y, hit.point.z, 8, 0xffd34d, 4, 2);
        // Walk up to the enemy root to find which one was hit.
        let node = hit.object;
        while (node && node.parent && node.parent !== scene) node = node.parent;
        const enemy = enemies.find((e) => e.group === node);
        if (enemy) {
          enemy.health -= COMBAT.pistolDamage;
          if (enemy.health <= 0 && !enemy.dead) {
            enemy.dead = true;
            enemy.group.visible = false;
            G.events.enemyDown(enemy);
          }
        }
      }
      if (ammo === 0) reloadTimer = COMBAT.reloadSec;
    },
    punch(G) {
      G.audio.punch();
      const pp = G.player.state.pos;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
        if (d < COMBAT.punchRange) {
          e.health -= COMBAT.punchDamage;
          G.effects.burst(e.pos.x, 1.4, e.pos.z, 6, 0xffffff, 3, 2);
          if (e.health <= 0) { e.dead = true; e.group.visible = false; G.events.enemyDown(e); }
        }
      }
    },
    update(dt, G) {
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) { ammo = COMBAT.magSize; G.hud.feed('Reloaded.'); }
      }
      if (gunfireTimer > 0) { gunfireTimer -= dt; if (gunfireTimer <= 0) gunfireAt = null; }
      // Enemies advance and shoot (inaccurately) at the player.
      const pp = G.player.state.pos;
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = pp.x - e.pos.x;
        const dz = pp.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        e.phase += dt;
        if (d > 14) {
          e.pos.x += (dx / d) * 3.4 * dt;
          e.pos.z += (dz / d) * 3.4 * dt;
        } else if (d < 6) {
          e.pos.x -= (dx / d) * 1.5 * dt;
          e.pos.z -= (dz / d) * 1.5 * dt;
        }
        e.pos.x += Math.sin(e.phase * 0.7) * 0.4 * dt;
        e.group.position.copy(e.pos);
        e.group.rotation.y = Math.atan2(dx, dz);
        const hw = Math.max(0.02, e.health / COMBAT.enemyHealth);
        e.bar.scale.x = hw;
        e.bar.position.x = -(1 - hw) * 0.5;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 45) {
          e.shootTimer = COMBAT.enemyShootInterval * (0.8 + Math.random() * 0.5);
          if (Math.random() < COMBAT.enemyAccuracy) {
            if (G.player.damage(COMBAT.enemyDamage)) {
              G.effects.burst(pp.x, 1.4, pp.z, 5, 0xff3b30, 3, 2);
              G.effects.addShake(0.25);
            }
          }
          G.audio.shot();
        }
      }
      // Pickups bob, spin, and get collected on touch.
      for (const p of pickups) {
        if (p.taken) continue;
        p.bob += dt;
        p.mesh.position.y = 0.7 + Math.sin(p.bob * 3) * 0.15;
        p.mesh.rotation.y += dt * 2;
        const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
        if (d < 2.2) {
          p.taken = true;
          p.mesh.visible = false;
          if (p.kind === 'health') { G.player.heal(40); G.hud.feed('Health +40'); }
          else if (p.kind === 'ammo') { ammo = COMBAT.magSize; reloadTimer = 0; G.hud.feed('Ammo restocked'); }
          else if (p.kind === 'cash') { state.cashPending += 100; G.hud.feed('Cash +$100'); }
          G.audio.chime();
        }
      }
    },
  };
}
