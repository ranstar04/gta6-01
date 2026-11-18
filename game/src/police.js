// Wanted + police: stars rise on crime and decay when the heat is lost.
// Cruisers chase and ram; foot officers appear at 3+ stars. Busted means a fine
// and a respawn at the station; the Fresh Coat garage clears heat for cash.
import * as THREE from 'three';
import { CFG } from './config.js';
import { spawnCarAt, damageCar } from './vehicles.js';
import { randomRoadPoint, dist2D } from './world.js';
import { buildPersonFigure } from './player.js';

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createPolice(S) {
  const cruisers = [];
  const officers = [];
  let spawnT = 0;
  let decayT = 0;
  let bustedT = 0;

  function removeCar(car) {
    S.scene.remove(car.group);
    const i = S.cars.indexOf(car);
    if (i >= 0) S.cars.splice(i, 1);
  }

  function addStars(n, reason) {
    if (n <= 0) return;
    S.wanted = Math.min(5, S.wanted + n);
    S.calmT = 0;
    decayT = 0;
    if (reason) S.hud.feed(`${reason} — wanted ${S.wanted}★`);
  }

  function spawnCruiser() {
    const pp = S.player.group.position;
    let pt = null;
    for (let i = 0; i < 12; i++) {
      const cand = randomRoadPoint(S.rng);
      const d = dist2D(cand.x, cand.z, pp.x, pp.z);
      if (d > 60 && d < 100) { pt = cand; break; }
    }
    if (!pt) pt = randomRoadPoint(S.rng);
    const car = spawnCarAt(S, 'patrol', pt.x, pt.z, 0, { driver: 'police' });
    car.pursuit = { stuckT: 0, ramT: 0, lastX: pt.x, lastZ: pt.z };
    cruisers.push(car);
  }

  function spawnOfficer() {
    const pp = S.player.group.position;
    const pt = randomRoadPoint(S.rng);
    const figure = buildPersonFigure({ shirt: 0x1a2a4a, pants: 0x1a1a22, skin: 0xc98d64, cap: 0x1a2a4a });
    figure.group.position.set(pt.x, 0, pt.z);
    S.scene.add(figure.group);
    officers.push({ group: figure.group, figure, speed: 6.4, punchT: 0, swing: 0 });
  }

  function clearForce() {
    for (const c of cruisers) removeCar(c);
    cruisers.length = 0;
    for (const o of officers) S.scene.remove(o.group);
    officers.length = 0;
  }

  function respawnPlayerAt(placeName) {
    const pl = S.places[placeName];
    if (S.playerCar) {
      S.playerCar.driver = null;
      S.playerCar.speed = 0;
      S.playerCar = null;
    }
    S.player.group.position.set(pl.x, 0, pl.z + 4);
    S.player.group.visible = true;
    S.player.yaw = 0;
    S.camYaw = 0;
    S.health = CFG.maxHealth;
  }

  function busted() {
    const fine = Math.min(S.money, CFG.bustedFine);
    S.money -= fine;
    S.wanted = 0;
    S.calmT = 0;
    clearForce();
    respawnPlayerAt('station');
    S.hud.showBusted(fine);
    S.hud.feed(`BUSTED — fined $${fine}`);
    S.save();
    S.audio.bustedSting();
  }

  function wasted() {
    const fine = Math.min(S.money, CFG.wastedFine);
    S.money -= fine;
    S.wanted = 0;
    clearForce();
    respawnPlayerAt('hospital');
    S.hud.showWasted(fine);
    S.hud.feed(`WASTED — hospital bill $${fine}`);
    S.save();
    S.audio.bustedSting();
  }

  function trySpray() {
    const car = S.playerCar;
    if (!car) return false;
    const g = S.places.garage;
    if (dist2D(car.group.position.x, car.group.position.z, g.x, g.z) > 9) return false;
    if (S.money < CFG.sprayCost) {
      S.hud.feed(`Fresh Coat costs $${CFG.sprayCost} — not enough cash`);
      return true;
    }
    S.money -= CFG.sprayCost;
    S.wanted = 0;
    S.calmT = 0;
    car.health = 100;
    car.dead = false;
    clearForce();
    S.hud.feed('Fresh Coat: clean ride, clean record. Wanted cleared.');
    S.audio.chime();
    return true;
  }

  function update(dt) {
    const pp = S.playerCar ? S.playerCar.group.position : S.player.group.position;
    // Heat decay: no police close for a while and the stars tick down.
    if (S.wanted > 0) {
      let nearest = Infinity;
      for (const c of cruisers) nearest = Math.min(nearest, dist2D(pp.x, pp.z, c.group.position.x, c.group.position.z));
      for (const o of officers) nearest = Math.min(nearest, dist2D(pp.x, pp.z, o.group.position.x, o.group.position.z));
      if (nearest > 70) {
        S.calmT += dt;
        if (S.calmT > 12) {
          decayT += dt;
          if (decayT > 8) {
            decayT = 0;
            S.wanted = Math.max(0, S.wanted - 1);
            S.hud.feed('You lost the heat — wanted down.');
            if (S.wanted === 0) clearForce();
          }
        }
      } else {
        S.calmT = 0;
        decayT = 0;
      }
    }

    // Cruisers: keep the right count on the road, chasing the player.
    const wantCruisers = S.wanted === 0 ? 0 : Math.min(S.wanted, 4);
    spawnT -= dt;
    if (cruisers.length < wantCruisers && spawnT <= 0) {
      spawnCruiser();
      spawnT = 2;
    }
    if (S.wanted === 0 && cruisers.length > 0) clearForce();
    for (let i = cruisers.length - 1; i >= 0; i--) {
      const car = cruisers[i];
      const cp = car.group.position;
      // Cruisers staged by hand (screenshot scenes) carry no pursuit state yet.
      if (!car.pursuit) car.pursuit = { stuckT: 0, ramT: 0, lastX: cp.x, lastZ: cp.z };
      const dx = pp.x - cp.x;
      const dz = pp.z - cp.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantYaw = Math.atan2(dx / dist, dz / dist);
      car.yaw = lerpAngle(car.yaw, wantYaw, Math.min(1, dt * 2.6));
      let targetSpeed = Math.min(38, 20 + dist * 0.25);
      if (!S.playerCar && dist < 8) targetSpeed = Math.min(targetSpeed, 12); // ease in for the arrest, don't flatten the player
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      cp.x += Math.sin(car.yaw) * car.speed * dt;
      cp.z += Math.cos(car.yaw) * car.speed * dt;
      car.group.rotation.y = car.yaw;
      for (const key of ['fl', 'fr', 'rl', 'rr']) car.wheels[key].wheel.rotation.x += (car.speed * dt) / 0.42;
      // Stuck against a building: teleport back onto a road near the player.
      const moved = Math.hypot(cp.x - car.pursuit.lastX, cp.z - car.pursuit.lastZ);
      if (moved < 0.5) {
        car.pursuit.stuckT += dt;
        if (car.pursuit.stuckT > 2.5) {
          const pt = randomRoadPoint(S.rng);
          cp.set(pt.x, 0, pt.z);
          car.pursuit.stuckT = 0;
        }
      } else {
        car.pursuit.stuckT = 0;
      }
      car.pursuit.lastX = cp.x;
      car.pursuit.lastZ = cp.z;
      car.pursuit.ramT -= dt;
      if (dist < 3.4 && car.pursuit.ramT <= 0) {
        car.pursuit.ramT = 1;
        if (S.playerCar) {
          damageCar(S, S.playerCar, 5);
          S.playerCar.speed *= 0.85;
          car.speed *= 0.6;
          S.effects.shake(0.5);
          S.audio.thud();
        } else if (dist < 3.2) {
          bustedT += dt;
          if (bustedT > 2) { bustedT = 0; busted(); return; }
        }
      } else if (!S.playerCar) {
        bustedT = Math.max(0, bustedT - dt);
      }
    }

    // Foot officers at 3+ stars.
    const wantOfficers = S.wanted >= 3 ? Math.min(S.wanted - 1, 3) : 0;
    if (officers.length < wantOfficers && spawnT <= 0) {
      spawnOfficer();
      spawnT = 1.5;
    }
    for (let i = officers.length - 1; i >= 0; i--) {
      const o = officers[i];
      if (S.wanted < 3) { S.scene.remove(o.group); officers.splice(i, 1); continue; }
      const op = o.group.position;
      const dx = pp.x - op.x;
      const dz = pp.z - op.z;
      const d = Math.hypot(dx, dz) || 1;
      op.x += (dx / d) * o.speed * dt;
      op.z += (dz / d) * o.speed * dt;
      o.group.rotation.y = Math.atan2(dx / d, dz / d);
      o.swing += dt * 5;
      o.figure.legL.rotation.x = Math.sin(o.swing) * 0.5;
      o.figure.legR.rotation.x = -Math.sin(o.swing) * 0.5;
      o.punchT -= dt;
      if (d < 1.8 && o.punchT <= 0) {
        o.punchT = 1;
        S.player.takeDamage(8);
        S.hud.feed('Officer hit you!');
      }
    }
  }

  return { cruisers, officers, addStars, update, trySpray, busted, wasted, clearForce };
}
