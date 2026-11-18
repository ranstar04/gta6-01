// MissionSystem: the M1–M6 story chain. Briefing text + waypoint beacon + objective
// checklist + rewards. Each mission is a small state machine driven by the world.
import * as THREE from 'three';
import { MISSIONS, TUNE, SPAWNS } from './config.js';
import { dist2D } from './random.js';
import { createCar } from './vehicles.js';

export function createMissions(scene, game, audio) {
  // game: the shared state (player, police, combat, effects, hud feed, money).
  let index = 0; // current mission (0-based)
  let phase = 'go'; // go | pickup | deliver | escape | steal | clear | done
  let packageMesh = null;
  let beacon = null;
  let targetCar = null;
  let showCar = null;
  let enemiesLeft = 0;
  let timer = 0;

  // Waypoint beacon: a tall glowing column + a floating gold marker.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.28, depthWrite: false });
  const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });

  function setBeacon(x, z) {
    clearBeacon();
    beacon = new THREE.Group();
    const col = new THREE.Mesh(beaconGeo, beaconMat);
    col.position.y = 30;
    beacon.add(col);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), markerMat);
    diamond.position.y = 8;
    diamond.name = 'marker';
    beacon.add(diamond);
    beacon.position.set(x, 0, z);
    scene.add(beacon);
  }
  function clearBeacon() {
    if (beacon) { scene.remove(beacon); beacon = null; }
  }

  function current() {
    return MISSIONS[index] || null;
  }

  function playerPos() {
    const p = game.player;
    return p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
  }

  function pay(amount, label) {
    game.money += amount;
    game.totalEarned += amount;
    game.feed(`${label} +$${amount}`);
    if (audio) audio.missionPass();
    game.autosave();
  }

  function completeMission() {
    const m = current();
    // Guard the save against a double-complete (e.g. jumpTo then complete):
    // the same mission id must never be counted twice.
    if (!game.missionsDone.includes(m.id)) game.missionsDone.push(m.id);
    game.feed(`Mission Passed: ${m.name}`);
    pay(m.pay, `Mission ${m.name}`);
    clearBeacon();
    if (packageMesh) { scene.remove(packageMesh); packageMesh = null; }
    index += 1;
    phase = 'go';
    if (index >= MISSIONS.length) {
      game.screen = 'kingpin';
      return;
    }
    startMission();
  }

  function startMission() {
    const m = current();
    if (!m) return;
    game.feed(`New mission: ${m.name} — ${m.brief}`);
    if (audio) audio.pickup();
    switch (m.id) {
      case 1:
        setBeacon(m.target.x, m.target.z);
        phase = 'go';
        break;
      case 2:
        setBeacon(m.target.x, m.target.z);
        phase = 'pickup';
        packageMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.8, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.8 }),
        );
        packageMesh.position.set(m.target.x, 0.6, m.target.z);
        packageMesh.castShadow = true;
        scene.add(packageMesh);
        break;
      case 3:
        game.police.addWanted(2);
        setBeacon(m.target.x, m.target.z);
        phase = 'escape';
        break;
      case 4: {
        // A Bruto truck waits at the docks.
        const truck = createCar('bruto', -120, -20, Math.PI / 2);
        truck.driver = null;
        scene.add(truck.mesh);
        game.traffic.parked.push(truck);
        targetCar = truck;
        game.feed('A Bruto truck is parked at the docks. Steal it.');
        setBeacon(-120, -20);
        phase = 'steal';
        break;
      }
      case 5: {
        game.combat.spawnEnemies([
          { x: -124, z: -54 }, { x: -140, z: -56 }, { x: -148, z: -52 },
          { x: -128, z: -62 }, { x: -144, z: -64 },
        ]);
        enemiesLeft = 5;
        setBeacon(m.target.x, m.target.z);
        phase = 'clear';
        break;
      }
      case 6: {
        const car = createCar('vesper', 100, -44, Math.PI);
        car.driver = null;
        scene.add(car.mesh);
        game.traffic.parked.push(car);
        showCar = car;
        game.feed('The cherry Vesper GT is parked outside the casino. Take it.');
        setBeacon(100, -44);
        phase = 'steal';
        break;
      }
      default:
        break;
    }
  }

  function objectiveText() {
    const m = current();
    if (!m) return 'All missions complete — you run Solmara now.';
    switch (m.id) {
      case 2: return phase === 'pickup' ? 'Collect the package at the marina' : 'Deliver the package to Mama Izzy';
      case 3: return phase === 'escape' ? 'Lose the police, then reach the safehouse' : 'Reach the safehouse';
      case 4: return phase === 'steal' ? 'Steal the Bruto truck at the docks' : 'Deliver the truck to the pier warehouse';
      case 5: return `Clear the warehouse — ${game.combat.enemies.length} enforcers left`;
      case 6: return phase === 'steal' ? 'Steal the Vesper GT at the casino' : 'Deliver the Vesper GT to the chop shop';
      default: return m.objective;
    }
  }

  function update(dt) {
    const m = current();
    if (!m) return;
    if (beacon) {
      const marker = beacon.getObjectByName('marker');
      if (marker) {
        marker.rotation.y += dt * 2;
        marker.position.y = 8 + Math.sin(performance.now() / 300) * 0.6;
      }
    }
    const pos = playerPos();
    const p = game.player;
    switch (m.id) {
      case 1:
        if (dist2D(pos.x, pos.z, m.target.x, m.target.z) < 10) completeMission();
        break;
      case 2:
        if (phase === 'pickup') {
          if (dist2D(pos.x, pos.z, m.target.x, m.target.z) < 4) {
            if (packageMesh) { scene.remove(packageMesh); packageMesh = null; }
            game.feed('Package collected. Bring it to Izzy.');
            setBeacon(SPAWNS.diner.x, SPAWNS.diner.z);
            phase = 'deliver';
          }
        } else if (dist2D(pos.x, pos.z, SPAWNS.diner.x, SPAWNS.diner.z) < 10) {
          completeMission();
        }
        break;
      case 3:
        if (phase === 'escape' && game.police.stars() === 0) {
          phase = 'go';
          game.feed('Clean. Now get to the safehouse.');
        }
        if (dist2D(pos.x, pos.z, m.target.x, m.target.z) < 10) completeMission();
        break;
      case 4:
        if (phase === 'steal' && p.car === targetCar) {
          game.feed('Truck stolen. Deliver it to the pier warehouse.');
          setBeacon(m.target.x, m.target.z);
          phase = 'deliver';
        } else if (phase === 'deliver' && p.car === targetCar && dist2D(pos.x, pos.z, m.target.x, m.target.z) < 12) {
          completeMission();
        }
        break;
      case 5:
        if (game.combat.enemies.length === 0) completeMission();
        break;
      case 6:
        if (phase === 'steal' && p.car === showCar) {
          game.police.addWanted(3);
          game.feed('Three stars! Deliver the Vesper to the chop shop.');
          setBeacon(m.target.x, m.target.z);
          phase = 'deliver';
        } else if (phase === 'deliver' && p.car === showCar && dist2D(pos.x, pos.z, m.target.x, m.target.z) < 12) {
          completeMission();
        }
        break;
      default:
        break;
    }
    timer += dt;
  }

  return {
    current, startMission, completeMission, objectiveText, update,
    get index() { return index; },
    get phase() { return phase; },
    get targetCar() { return targetCar; },
    get showCar() { return showCar; },
    // Staging hook (screenshots only): jump straight to a mission and start it.
    jumpTo(id) {
      index = id - 1;
      phase = 'go';
      clearBeacon();
      startMission();
    },
    reset() {
      index = 0;
      phase = 'go';
      clearBeacon();
      if (packageMesh) { scene.remove(packageMesh); packageMesh = null; }
      game.combat.clearEnemies();
      startMission();
    },
  };
}
