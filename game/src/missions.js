// Missions: the M1–M6 story chain, each with stages (go to, steal, deliver,
// clear, escape), a waypoint beacon + minimap marker + objective text, and a
// payout. Taxi fares and the 10 golden shells run alongside as side money.
import * as THREE from 'three';
import { MISSIONS, SHELLS, TAXI, WANTED } from './config.js';
import { pick } from './random.js';

export function createMissions(scene, rng) {
  // Waypoint beacon: a glowing gold cylinder + light pillar.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.85 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.5, 20), beaconMat);
  beacon.position.y = 0.3;
  beacon.visible = false;
  scene.add(beacon);
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 90, 12, 1, true), pillarMat);
  pillar.position.y = 45;
  pillar.visible = false;
  scene.add(pillar);

  // Shells: small gold octahedrons at fixed scenic spots.
  const shellGeo = new THREE.OctahedronGeometry(0.55);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const shells = [];

  let index = 0; // 0-based mission index; 6 = all done
  let stage = 0;
  let stageData = null;
  let taxi = null; // { ped, dest, fare }
  let taxiCooldown = 0;

  function current() { return index < 6 ? MISSIONS[index] : null; }
  function stageDef() { const m = current(); return m ? m.stages[stage] : null; }

  function setBeacon(x, z) {
    beacon.position.set(x, 0.3, z);
    pillar.position.set(x, 45, z);
    beacon.visible = true;
    pillar.visible = true;
  }
  function hideBeacon() { beacon.visible = false; pillar.visible = false; }

  return {
    beacon, pillar, shells,
    index() { return index; },
    current, stageDef,
    taxiActive() { return taxi !== null; },
    initShells(spots, collected) {
      for (const s of shells) scene.remove(s.mesh);
      shells.length = 0;
      spots.forEach((sp, i) => {
        if (collected.includes(i)) return;
        const m = new THREE.Mesh(shellGeo, shellMat);
        m.position.set(sp.x, 0.8, sp.z);
        scene.add(m);
        shells.push({ mesh: m, pos: { x: sp.x, z: sp.z }, idx: i, bob: Math.random() * 6 });
      });
    },
    start(G, missionIdx) {
      index = missionIdx;
      stage = 0;
      stageData = null;
      this.enterStage(G);
    },
    enterStage(G) {
      const m = current();
      const s = stageDef();
      if (!m || !s) { hideBeacon(); return; }
      G.hud.objective(s.text);
      G.hud.feed(`${m.name}: ${s.text}`);
      if (s.kind === 'goto' || s.kind === 'escape' || s.kind === 'deliver') {
        const at = G.city.spawns[s.at];
        setBeacon(at.x, at.z);
      } else if (s.kind === 'steal') {
        const at = G.city.spawns[s.at];
        setBeacon(at.x, at.z);
        // The target car must exist and be parked there.
        if (!G.missionCar || G.missionCar.type !== s.car) {
          const car = G.spawnParkedCar(s.car, at.x, at.z);
          G.missionCar = car;
        }
      } else if (s.kind === 'clear') {
        const at = G.city.spawns[s.at];
        setBeacon(at.x, at.z);
        stageData = { killed: 0, total: s.count };
        // Enforcers hold the open ground in FRONT of the warehouse (south of
        // its front face, toward the player) — never inside the building's
        // footprint, where they would be invisible and unreachable. Spread
        // wide across the front so they read in frame around the player.
        for (let i = 0; i < s.count; i += 1) {
          G.combat.spawnEnemy(at.x + (Math.random() - 0.5) * 56, at.z + 2 + Math.random() * 6);
        }
        G.hud.objective(`Clear the warehouse of enforcers (0/${s.count})`);
      } else if (s.kind === 'wanted') {
        G.police.addWanted(s.stars, G);
        hideBeacon();
      }
    },
    advance(G) {
      const m = current();
      if (!m) return;
      stage += 1;
      if (stage >= m.stages.length) {
        // Mission complete.
        G.money += m.reward;
        G.stats.earned += m.reward;
        G.hud.feed(`Mission Passed — ${m.name} +$${m.reward}`);
        G.audio.jingle();
        G.save.write({ money: G.money, missionsDone: index + 1, shells: G.collectedShells, best: G.stats });
        index += 1;
        stage = 0;
        stageData = null;
        if (index >= 6) {
          G.events.kingpin();
          return;
        }
        this.enterStage(G);
      } else {
        this.enterStage(G);
      }
    },
    onEnemyDown(G) {
      const s = stageDef();
      if (!s || s.kind !== 'clear' || !stageData) return;
      stageData.killed += 1;
      G.hud.objective(`Clear the warehouse of enforcers (${stageData.killed}/${stageData.total})`);
      if (stageData.killed >= stageData.total) this.advance(G);
    },
    update(dt, G) {
      const m = current();
      const s = stageDef();
      const pp = G.player.state.pos;
      if (m && s) {
        if (s.kind === 'goto' || s.kind === 'escape') {
          const at = G.city.spawns[s.at];
          const d = Math.hypot(pp.x - at.x, pp.z - at.z);
          // Generous radii: landmark points sit in front of buildings, and the
          // player/car can never reach a building's centre (colliders).
          if (s.kind === 'escape') {
            if (d < 24 && G.police.wanted() < 2) this.advance(G);
          } else if (d < 24) {
            this.advance(G);
          }
        } else if (s.kind === 'steal') {
          if (G.playerCar && G.playerCar === G.missionCar) this.advance(G);
        } else if (s.kind === 'deliver') {
          const at = G.city.spawns[s.at];
          const car = G.playerCar;
          if (car && car.type === s.car) {
            const d = Math.hypot(car.pos.x - at.x, car.pos.z - at.z);
            if (d < 20) {
              // Park the delivered car, take the player out.
              G.exitCar();
              this.advance(G);
            }
          }
        }
      }
      // Shells.
      for (const sh of shells) {
        sh.bob += dt;
        sh.mesh.position.y = 0.8 + Math.sin(sh.bob * 2.5) * 0.2;
        sh.mesh.rotation.y += dt * 1.5;
        const d = Math.hypot(pp.x - sh.pos.x, pp.z - sh.pos.z);
        if (d < 2.5) {
          sh.mesh.visible = false;
          shells.splice(shells.indexOf(sh), 1);
          G.collectedShells.push(sh.idx);
          G.money += SHELLS.bonus;
          G.stats.earned += SHELLS.bonus;
          G.hud.feed(`Golden shell ${G.collectedShells.length}/${SHELLS.total} +$${SHELLS.bonus}`);
          G.audio.chime();
          break;
        }
      }
      // Taxi fares: E near a flagged pedestrian picks them up; drive to the marker.
      taxiCooldown = Math.max(0, taxiCooldown - dt);
      if (!taxi && taxiCooldown <= 0 && !G.playerCar) {
        const ped = G.pedestrians.peds.find((p) => p.taxi && !p.down);
        if (ped) {
          const d = Math.hypot(pp.x - ped.pos.x, pp.z - ped.pos.z);
          if (d < 3) {
            const dest = G.world.randomRoadPoint();
            const fare = Math.max(TAXI.minFare, Math.round(Math.hypot(dest.x - ped.pos.x, dest.z - ped.pos.z) * TAXI.farePerMetre));
            taxi = { ped, dest, fare, start: { x: ped.pos.x, z: ped.pos.z } };
            ped.taxi = false;
            ped.down = true; // riding with the player
            ped.group.visible = false;
            setBeacon(dest.x, dest.z);
            G.hud.objective(`Taxi fare: drive the passenger to the marker ($${fare})`);
            G.hud.feed('Taxi fare picked up — drive to the gold marker.');
          }
        }
      } else if (taxi) {
        if (!G.playerCar) {
          // Passenger left (player got out) — fare cancelled.
          taxi.ped.down = false;
          taxi.ped.group.visible = true;
          taxi = null;
          this.enterStage(G);
          return;
        }
        const car = G.playerCar;
        const d = Math.hypot(car.pos.x - taxi.dest.x, car.pos.z - taxi.dest.z);
        if (d < 10) {
          const tip = Math.random() < TAXI.tipChance ? 15 : 0;
          G.money += taxi.fare + tip;
          G.stats.earned += taxi.fare + tip;
          G.hud.feed(`Fare complete +$${taxi.fare}${tip ? ` (+$${tip} tip)` : ''}`);
          G.audio.chime();
          taxi.ped.down = false;
          taxi.ped.group.visible = true;
          taxi.ped.pos.set(taxi.dest.x + 3, 0, taxi.dest.z + 3);
          taxi.ped.group.position.copy(taxi.ped.pos);
          taxi = null;
          taxiCooldown = 4;
          G.pedestrians.flagTaxi();
          this.enterStage(G);
        }
      }
      // Beacon pulse.
      if (beacon.visible) {
        const s2 = 1 + Math.sin(performance.now() * 0.004) * 0.12;
        beacon.scale.set(s2, 1, s2);
      }
    },
    marker(G) {
      // Minimap marker: current objective position, or the taxi destination.
      if (taxi) return { x: taxi.dest.x, z: taxi.dest.z, kind: 'taxi' };
      const s = stageDef();
      if (!s || !s.at) return null;
      const at = G.city.spawns[s.at];
      return { x: at.x, z: at.z, kind: 'mission' };
    },
  };
}
