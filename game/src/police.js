// Wanted system + police: stars 0-5, cruisers that spawn and chase (pursuit AI +
// ramming), foot officers at 3+ stars, BUSTED when pinned on foot or health hits 0,
// decay when out of sight, Fresh Coat garage repaint to clear stars.
import * as THREE from 'three';
import { TUNE, SPAWNS } from './config.js';
import { clamp, dist2D } from './random.js';
import { createCar } from './vehicles.js';

export function createPolice(scene, world) {
  const cruisers = [];
  const officers = [];
  let wanted = 0; // float, displayed as ceil
  let spawnTimer = 0;
  let officerTimer = 0;
  let bustTimer = 0;
  let sirenOn = false;

  function stars() {
    return Math.min(5, Math.ceil(wanted - 0.001));
  }

  function addWanted(amount) {
    wanted = clamp(wanted + amount, 0, 5);
  }

  function clearWanted() {
    wanted = 0;
    for (const c of cruisers) {
      scene.remove(c.mesh);
    }
    cruisers.length = 0;
    for (const o of officers) scene.remove(o.mesh);
    officers.length = 0;
    sirenOn = false;
  }

  function spawnCruiserNear(player) {
    const p = world.randomRoadPoint(Math.random);
    const car = createCar('police', p.x, p.z, Math.atan2(player.x - p.x, player.z - p.z));
    car.driver = 'police';
    car.health = 120;
    scene.add(car.mesh);
    cruisers.push(car);
    return car;
  }

  function buildOfficer(x, z) {
    const g = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.34), navy);
    torso.position.y = 1.22;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.82;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.42), navy);
    cap.position.y = 2.04;
    g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), navy);
    legL.position.set(-0.16, 0.42, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);
    g.position.set(x, 0, z);
    scene.add(g);
    return { mesh: g, x, z, yaw: 0, phase: 0, health: 60 };
  }

  // Returns 'busted' | null. The caller shows the BUSTED screen.
  function update(dt, player, effects, audio) {
    const st = stars();
    const px = player.car ? player.car.x : player.x;
    const pz = player.car ? player.car.z : player.z;
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;

    // Decay: stars fade when no police is close.
    let nearestPolice = Infinity;
    for (const c of cruisers) nearestPolice = Math.min(nearestPolice, dist2D(px, pz, c.x, c.z));
    for (const o of officers) nearestPolice = Math.min(nearestPolice, dist2D(px, pz, o.x, o.z));
    if (wanted > 0 && nearestPolice > 55) {
      wanted = Math.max(0, wanted - TUNE.wantedDecay * dt);
      if (wanted === 0) clearWanted();
    }

    // Spawn cruisers up to the wanted level.
    const wantCruisers = st >= 1 ? Math.min(st, 3) : 0;
    spawnTimer -= dt;
    if (cruisers.length < wantCruisers && spawnTimer <= 0) {
      spawnCruiserNear(player);
      spawnTimer = 2.5;
    }
    // Foot officers at 3+ stars.
    const wantOfficers = st >= 3 ? Math.min(st - 1, 3) : 0;
    officerTimer -= dt;
    if (officers.length < wantOfficers && officerTimer <= 0) {
      const p = world.randomRoadPoint(Math.random);
      officers.push(buildOfficer(p.x, p.z));
      officerTimer = 3;
    }

    sirenOn = cruisers.length > 0;
    if (audio) audio.siren(sirenOn);

    // Cruiser pursuit: steer toward the player, ram, and push. Iterate a copy:
    // far cruisers despawn (splice) inside this loop, and mutating the array
    // under a live for...of would skip the cruiser after the removed one.
    for (const c of [...cruisers]) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.yaw += dy * Math.min(1, dt * 2.6);
      const desired = dist > 60 ? 38 : dist > 25 ? TUNE.policeRamSpeed : 26;
      c.speed += (desired - c.speed) * Math.min(1, dt * 1.2);
      c.x += Math.sin(c.yaw) * c.speed * dt;
      c.z += Math.cos(c.yaw) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.yaw;
      const spin = (c.speed * dt) / 0.36;
      for (const w of c.mesh.userData.wheels) w.pivot.children[0].rotation.x += spin;
      // Light bar flash.
      const bar = c.mesh.userData.lightBar;
      if (bar) bar.material.emissive.setHex(Math.floor(performance.now() / 250) % 2 ? 0xff2222 : 0x2244ff);
      // Ram the player's car.
      if (player.car && dist < 3.4) {
        player.car.health -= 14 * dt;
        player.car.speed *= 0.995;
        if (effects && Math.random() < dt * 6) {
          effects.sparks({ x: px, y: 1, z: pz });
        }
      }
      // Despawn far cruisers when the heat dies.
      if (wanted === 0 && dist > 120) {
        scene.remove(c.mesh);
        cruisers.splice(cruisers.indexOf(c), 1);
      }
    }

    // Officers chase on foot and punch.
    for (const o of officers) {
      const dx = px - o.x;
      const dz = pz - o.z;
      const dist = Math.hypot(dx, dz);
      o.yaw = Math.atan2(dx, dz);
      const sp = 6.5;
      o.x += (dx / (dist || 1)) * sp * dt;
      o.z += (dz / (dist || 1)) * sp * dt;
      o.phase += dt * 10;
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.yaw;
      if (dist < 1.6 && !player.car) {
        player.health -= 12 * dt;
      }
    }

    // BUSTED: a cruiser pins the player on foot for ~2 s, or health hits 0.
    if (!player.car) {
      let pin = false;
      for (const c of cruisers) {
        if (dist2D(px, pz, c.x, c.z) < 3 && Math.abs(c.speed) < 3) pin = true;
      }
      if (pin && st >= 1) {
        bustTimer += dt;
        if (bustTimer > 2) return 'busted';
      } else {
        bustTimer = 0;
      }
    }
    if (player.health <= 0) return st >= 3 ? 'busted' : 'wasted';
    return null;
  }

  function nearGarage(player) {
    const px = player.car ? player.car.x : player.x;
    const pz = player.car ? player.car.z : player.z;
    return dist2D(px, pz, SPAWNS.garage.x, SPAWNS.garage.z) < 12;
  }

  return {
    get wanted() { return wanted; },
    stars, addWanted, clearWanted, update, nearGarage,
    cruisers, officers,
  };
}
