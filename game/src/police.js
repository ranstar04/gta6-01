// Wanted + police: stars rise on crimes seen by cops or pedestrians and decay
// when the player is out of sight. Cruisers spawn per star and PURSUE — they
// trail a point ~28 m behind the player's car, throttling by distance, and never
// make contact (a cruiser that rams the player to a stop is a bug, not a feature).
// At 3+ stars foot officers join. BUSTED when a cruiser pins the player on foot
// for ~2 s, or health hits 0 at high wanted. Fresh Coat repaints clear the heat.
import * as THREE from 'three';
import { createCar, driveCar } from './vehicles.js';
import { WANTED, SPRAY } from './config.js';

export function createPolice(scene, rng) {
  const cruisers = [];
  const cops = [];
  let wanted = 0;
  let bustedTimer = 0;
  let flashPhase = 0;

  function spawnCruiser(G, near) {
    const car = createCar('interceptor', near.x + 40, near.z + 40, 0);
    car.driver = 'police';
    scene.add(car.group);
    cruisers.push(car);
    G.cars.push(car);
    return car;
  }

  function spawnCop(G, near) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), mat);
    torso.position.y = 1.1;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), new THREE.MeshLambertMaterial({ color: 0xd9a077 }));
    head.position.y = 1.66;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 1.88;
    group.add(cap);
    scene.add(group);
    const cop = { group, pos: new THREE.Vector3(near.x + 12, 0, near.z + 8), speed: 4.2 };
    cops.push(cop);
    return cop;
  }

  function nearestCruiserDist(G) {
    let best = Infinity;
    for (const c of cruisers) best = Math.min(best, Math.hypot(c.pos.x - G.player.state.pos.x, c.pos.z - G.player.state.pos.z));
    return best;
  }

  function visibleToPolice(G) {
    // Seen if a cruiser is within 70 m, or a pedestrian within 25 m witnesses.
    if (nearestCruiserDist(G) < 70) return true;
    for (const p of G.pedestrians.peds) {
      if (!p.down && Math.hypot(p.pos.x - G.player.state.pos.x, p.pos.z - G.player.state.pos.z) < 25) return true;
    }
    return false;
  }

  return {
    cruisers, cops,
    wanted() { return wanted; },
    addWanted(n, G) {
      wanted = Math.min(WANTED.maxStars, wanted + n);
      if (wanted > 0 && G) G.audio.siren(true);
    },
    clearWanted(G) {
      wanted = 0;
      bustedTimer = 0;
      if (G) G.audio.siren(false);
    },
    update(dt, G) {
      flashPhase += dt;
      // Spawn / despawn cruisers to match stars.
      const wantCruisers = Math.min(wanted * WANTED.cruiserPerStar, 5);
      const pp = G.player.state.pos;
      while (cruisers.length < wantCruisers) spawnCruiser(G, { x: pp.x, z: pp.z });
      while (cruisers.length > wantCruisers) {
        const c = cruisers.pop();
        scene.remove(c.group);
        const i = G.cars.indexOf(c);
        if (i >= 0) G.cars.splice(i, 1);
      }
      const wantCops = wanted >= WANTED.footCopsAt ? 2 : 0;
      while (cops.length < wantCops) spawnCop(G, { x: pp.x, z: pp.z });
      while (cops.length > wantCops) {
        const c = cops.pop();
        scene.remove(c.group);
      }
      // Wanted decays only while unseen.
      if (wanted > 0 && !visibleToPolice(G)) {
        wanted = Math.max(0, wanted - WANTED.decayPerSec * dt);
        if (wanted === 0) G.audio.siren(false);
      }
      // Pursuit: each cruiser trails a point 28 m behind the player's car (or the
      // player on foot), throttling by distance — never ramming into contact.
      const target = G.playerCar || null;
      const tx = target ? target.pos.x : pp.x;
      const tz = target ? target.pos.z : pp.z;
      const theading = target ? target.heading : G.player.state.heading;
      for (const c of cruisers) {
        const bx = tx - Math.sin(theading) * 28;
        const bz = tz - Math.cos(theading) * 28;
        const dx = bx - c.pos.x;
        const dz = bz - c.pos.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = want - c.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 1.8));
        // Throttle by distance: full speed far away, ease off inside 12 m.
        const throttle = dist > 12 ? 0.9 : (dist > 6 ? 0.35 : 0);
        driveCar(c, dt, throttle, steer, false, G.city.colliders, G.cars);
        // Light bar flash.
        const on = Math.floor(flashPhase * 4) % 2 === 0;
        if (c.group.userData.lightL) c.group.userData.lightL.material.color.setHex(on ? 0xff2a2a : 0x550000);
        if (c.group.userData.lightR) c.group.userData.lightR.material.color.setHex(on ? 0x2a6bff : 0x000055);
      }
      // Foot officers walk at the player; pinning him on foot ~2 s = BUSTED.
      // They respect building colliders (they used to walk straight through walls).
      for (const cop of cops) {
        const dx = pp.x - cop.pos.x;
        const dz = pp.z - cop.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          cop.pos.x += (dx / d) * cop.speed * dt;
          cop.pos.z += (dz / d) * cop.speed * dt;
          for (const c of G.city.colliders) {
            const nx = Math.max(c.minX, Math.min(cop.pos.x, c.maxX));
            const nz = Math.max(c.minZ, Math.min(cop.pos.z, c.maxZ));
            let ox = cop.pos.x - nx;
            let oz = cop.pos.z - nz;
            const d2 = ox * ox + oz * oz;
            if (d2 < 0.36) {
              if (d2 < 1e-6) { ox = 0.6; oz = 0; }
              const dd = Math.sqrt(ox * ox + oz * oz);
              cop.pos.x = nx + (ox / dd) * 0.6;
              cop.pos.z = nz + (oz / dd) * 0.6;
            }
          }
          cop.group.position.copy(cop.pos);
          cop.group.rotation.y = Math.atan2(dx, dz);
        }
      }
      if (wanted >= 2 && !G.playerCar && nearestCruiserDist(G) < 4) {
        bustedTimer += dt;
        if (bustedTimer > 2) G.events.busted('The cops pinned you down.');
      } else {
        bustedTimer = Math.max(0, bustedTimer - dt * 2);
      }
      // Fresh Coat spray shop: drive in with wanted > 0 and $150 to clear it.
      const g = G.city.spawns.garage;
      const gd = Math.hypot(pp.x - g.x, pp.z - g.z);
      if (wanted > 0 && gd < 12 && G.playerCar && G.money >= SPRAY.cost) {
        G.money -= SPRAY.cost;
        this.clearWanted(G);
        G.hud.feed(`Fresh Coat repaint — $${SPRAY.cost}. Heat cleared.`);
        G.audio.chime();
      }
    },
  };
}
