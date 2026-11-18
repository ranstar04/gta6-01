// Missions: the M1–M6 story chain with a beacon + objective text, plus the two
// open activities — taxi fares and the 10 golden shells. Finishing all six
// missions makes Rook the SOLMARA KINGPIN.
import * as THREE from 'three';
import { MISSIONS, CFG } from './config.js';
import { spawnCarAt } from './vehicles.js';
import { dist2D } from './world.js';

export function createMissions(S) {
  let index = S.missionsDone.length;
  let stepIdx = 0;
  let active = false;
  let kills = 0;
  let heatTriggered = false;
  let targetCar = null;
  let beacon = null;
  let beaconMark = null;

  const taxi = { state: 'idle', from: null, to: null, fare: 0, cooldown: 8, marker: null, ped: null };
  const shellMeshes = [];

  function makeBeacon() {
    const group = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 35;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd34d }),
    );
    gem.position.y = 9;
    group.add(cyl, gem);
    S.scene.add(group);
    return { group, gem };
  }

  function currentMission() { return MISSIONS[index]; }
  function currentStep() { return MISSIONS[index] ? MISSIONS[index].steps[stepIdx] : null; }

  function markerPos() {
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'steal' && targetCar) {
      const p = targetCar.group.position;
      return { x: p.x, z: p.z };
    }
    if (step.type === 'heat') return null;
    if (step.place) {
      const pl = S.places[step.place];
      return pl ? { x: pl.x, z: pl.z } : null;
    }
    return null;
  }

  function activateStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'steal') {
      // Make sure the target car is parked at its place.
      const pl = S.places[step.place];
      let car = null;
      for (const c of S.cars) {
        if (c.type === step.car && !c.isPolice && dist2D(c.group.position.x, c.group.position.z, pl.x, pl.z) < 30) { car = c; break; }
      }
      if (!car) car = spawnCarAt(S, step.car, pl.x + 4, pl.z + 4, Math.PI / 2, { driver: null });
      targetCar = car;
    } else if (step.type === 'clear') {
      const pl = S.places[step.place];
      kills = 0;
      S.combat.spawnEnemies(pl.x, pl.z, step.count);
    } else if (step.type === 'heat' && !heatTriggered) {
      heatTriggered = true;
      S.police.addStars(step.stars, 'Detective Quinn put a tail on you');
    }
    S.hud.setObjective(stepText());
  }

  function stepText() {
    const step = currentStep();
    if (!step) return '';
    if (step.type === 'clear') return `Clear the Kross enforcers (${kills}/${step.count})`;
    return step.text;
  }

  function advanceStep() {
    stepIdx++;
    const mission = currentMission();
    if (stepIdx >= mission.steps.length) {
      completeMission(mission);
    } else {
      activateStep();
    }
  }

  function completeMission(mission) {
    S.money += mission.reward;
    S.missionsDone.push(mission.id);
    S.hud.banner('MISSION PASSED', `+$${mission.reward} — ${mission.name}`);
    S.hud.feed(`Mission passed: ${mission.name} (+$${mission.reward})`);
    S.audio.jingle();
    S.save();
    index++;
    stepIdx = 0;
    heatTriggered = false;
    targetCar = null;
    if (index >= MISSIONS.length) {
      active = false;
      S.mode = 'kingpin';
      S.hud.showKingpin();
      S.save();
    } else {
      start();
    }
  }

  function start() {
    if (index >= MISSIONS.length) return;
    active = true;
    stepIdx = 0;
    const mission = currentMission();
    activateStep();
    S.hud.banner(mission.name, mission.brief, 5);
  }

  function restartCurrent() {
    // Clear live enforcers, then replay the current mission from step one.
    for (const e of [...S.combat.enemies]) {
      S.scene.remove(e.group);
    }
    S.combat.enemies.length = 0;
    stepIdx = 0;
    kills = 0;
    heatTriggered = false;
    targetCar = null;
    activateStep();
    S.hud.feed(`Restarted mission: ${currentMission().name}`);
  }

  function onEnemyKilled() {
    const step = currentStep();
    if (!active || !step || step.type !== 'clear') return;
    kills++;
    S.hud.setObjective(stepText());
  }

  // ---- Taxi fares ---------------------------------------------------------
  function taxiMarkerMesh() {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.8),
      new THREE.MeshBasicMaterial({ color: 0x2ecc40 }),
    );
    S.scene.add(m);
    return m;
  }
  function spawnFare() {
    const pp = S.player.group.position;
    let spot = null;
    for (let i = 0; i < 20; i++) {
      const cand = S.pedWaypoints[Math.floor(Math.random() * S.pedWaypoints.length)];
      if (dist2D(cand.x, cand.z, pp.x, pp.z) < 110) { spot = cand; break; }
    }
    if (!spot) spot = S.pedWaypoints[0];
    const ped = S.peds.spawnPed(spot.x, spot.z);
    taxi.ped = ped;
    taxi.from = { x: spot.x, z: spot.z };
    taxi.marker = taxiMarkerMesh();
    taxi.state = 'waiting';
    S.hud.feed('Taxi fare waiting — drive your car up to the green marker');
  }
  function updateTaxi(dt) {
    if (taxi.state === 'idle') {
      taxi.cooldown -= dt;
      if (taxi.cooldown <= 0) spawnFare();
      return;
    }
    if (taxi.marker) {
      const anchor = taxi.state === 'waiting' ? taxi.from : taxi.to;
      taxi.marker.position.set(anchor.x, 3 + Math.sin(S.time * 3) * 0.4, anchor.z);
      taxi.marker.rotation.y += dt * 2;
    }
    if (taxi.state === 'waiting') {
      if (S.playerCar && dist2D(S.playerCar.group.position.x, S.playerCar.group.position.z, taxi.from.x, taxi.from.z) < 5) {
        // Passenger boards.
        if (taxi.ped) {
          S.scene.remove(taxi.ped.group);
          const i = S.peds.list.indexOf(taxi.ped);
          if (i >= 0) S.peds.list.splice(i, 1);
          taxi.ped = null;
        }
        let to = null;
        for (let i = 0; i < 20; i++) {
          const cand = S.pedWaypoints[Math.floor(Math.random() * S.pedWaypoints.length)];
          if (dist2D(cand.x, cand.z, taxi.from.x, taxi.from.z) > 60) { to = cand; break; }
        }
        taxi.to = to || { x: -taxi.from.x, z: -taxi.from.z };
        taxi.fare = Math.round(CFG.taxiBase + CFG.taxiPerMetre * dist2D(taxi.from.x, taxi.from.z, taxi.to.x, taxi.to.z));
        taxi.state = 'riding';
        S.hud.feed(`Passenger aboard — drive to the green marker ($${taxi.fare})`);
      }
    } else if (taxi.state === 'riding') {
      if (!S.playerCar) {
        taxi.state = 'idle';
        taxi.cooldown = 15;
        if (taxi.marker) { S.scene.remove(taxi.marker); taxi.marker = null; }
        S.hud.feed('Fare cancelled — you left the car');
      } else if (dist2D(S.playerCar.group.position.x, S.playerCar.group.position.z, taxi.to.x, taxi.to.z) < 7) {
        S.money += taxi.fare;
        S.taxisDone++;
        S.hud.feed(`Fare paid +$${taxi.fare}`);
        S.audio.chime();
        S.save();
        if (taxi.marker) { S.scene.remove(taxi.marker); taxi.marker = null; }
        taxi.state = 'idle';
        taxi.cooldown = 15;
      }
    }
  }

  // ---- Golden shells -------------------------------------------------------
  function buildShells() {
    const geo = new THREE.TorusGeometry(0.45, 0.16, 8, 14);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x8a6d00 });
    S.shellSpots.forEach((spot, i) => {
      if (S.shellsGot.has(i)) return;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, 1.1, spot.z);
      S.scene.add(mesh);
      shellMeshes.push({ mesh, index: i, x: spot.x, z: spot.z });
    });
  }
  function updateShells(dt) {
    const pp = S.playerCar ? S.playerCar.group.position : S.player.group.position;
    for (let i = shellMeshes.length - 1; i >= 0; i--) {
      const s = shellMeshes[i];
      s.mesh.rotation.y += dt * 1.5;
      s.mesh.position.y = 1.1 + Math.sin(S.time * 2 + i) * 0.15;
      if (dist2D(pp.x, pp.z, s.x, s.z) < 2.4) {
        S.shellsGot.add(s.index);
        S.scene.remove(s.mesh);
        shellMeshes.splice(i, 1);
        S.audio.chime();
        const n = S.shellsGot.size;
        S.hud.feed(`Golden shell ${n}/10`);
        if (n >= 10) {
          S.money += CFG.shellBonus;
          S.hud.banner('ALL SHELLS FOUND', `+$${CFG.shellBonus} bonus`);
          S.audio.jingle();
          S.save();
        }
      }
    }
  }

  buildShells();

  function update(dt) {
    if (beacon) {
      const mp = markerPos();
      if (mp) {
        beacon.group.visible = true;
        beacon.group.position.set(mp.x, 0, mp.z);
        beacon.gem.rotation.y += dt * 2;
        beacon.gem.position.y = 9 + Math.sin(S.time * 2.5) * 0.6;
      } else {
        beacon.group.visible = false;
      }
    }
    if (active) {
      const step = currentStep();
      const pp = S.playerCar ? S.playerCar.group.position : S.player.group.position;
      if (step) {
        if (step.type === 'goto') {
          const pl = S.places[step.place];
          if (pl && dist2D(pp.x, pp.z, pl.x, pl.z) < 8) advanceStep();
        } else if (step.type === 'heat') {
          if (S.wanted === 0) advanceStep();
        } else if (step.type === 'steal') {
          if (S.playerCar && S.playerCar.type === step.car) {
            if (currentMission().id === 'm6') S.police.addStars(3, 'Casino alarm — the whole city is watching');
            advanceStep();
          }
        } else if (step.type === 'clear') {
          if (kills >= step.count) advanceStep();
        }
      }
    }
    updateTaxi(dt);
    updateShells(dt);
  }

  return {
    get index() { return index; },
    get active() { return active; },
    start,
    restartCurrent,
    onEnemyKilled,
    update,
    markerPos,
    ensureBeacon() {
      if (!beacon) beacon = makeBeacon();
      return beacon;
    },
    reset() {
      for (const e of [...S.combat.enemies]) S.scene.remove(e.group);
      S.combat.enemies.length = 0;
      if (beacon) beacon.group.visible = false;
      for (const s of shellMeshes) S.scene.remove(s.mesh);
      shellMeshes.length = 0;
      if (taxi.marker) { S.scene.remove(taxi.marker); taxi.marker = null; }
      if (taxi.ped) { S.scene.remove(taxi.ped.group); taxi.ped = null; }
      taxi.state = 'idle';
      taxi.cooldown = 8;
      index = S.missionsDone.length;
      stepIdx = 0;
      active = false;
      kills = 0;
      heatTriggered = false;
      targetCar = null;
      buildShells();
    },
    taxiMarker() {
      if (taxi.state === 'waiting') return taxi.from;
      if (taxi.state === 'riding') return taxi.to;
      return null;
    },
  };
}
