// Staged screenshot scenes behind ?shot=chase|street|mission|title. Each one plays
// the REAL rules forward from a fresh seeded world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import * as THREE from 'three';
import { STEP } from './config.js';

const CHASE_SECONDS = 4.5;
const STREET_SECONDS = 3.5;
const MISSION_SECONDS = 3.0;
const TITLE_SECONDS = 5;

function autopilotDrive(G) {
  // Hold W, steer to stay on avenue x=0 heading +z (south).
  const car = G.playerCar;
  if (!car) return { f: 0, s: 0 };
  const steer = Math.max(-1, Math.min(1, -car.pos.x * 0.02 - Math.sin(car.heading) * 0.8));
  return { f: 1, s: steer };
}

function autopilotWalk(G) {
  // Walk forward along the Calle Verde sidewalk.
  return { f: 1, s: 0 };
}

export function stageShot(name, G) {
  const shotName = ['chase', 'street', 'mission', 'title'].includes(name) ? name : 'chase';
  G.shotState = { name: shotName, t: 0 };
  G.resetWorld(1);
  // Staging must run the PLAY simulation (driving, police, camera). Without
  // this the steps fall into the title attract branch: nothing drives, the
  // camera never moves from the origin, and the shot is a ground-level still.
  G.screen = 'play';
  const pp = G.player.state;

  if (shotName === 'chase') {
    // COVER: Vesper GT at speed down the boulevard, 2 cruisers trailing, 3 stars.
    const car = G.spawnParkedCar('vesper', 0, -200);
    car.heading = 0; // +z = south, straight down avenue 0
    car.pos.set(0, 0, -200);
    car.speed = 20;
    G.enterCar(car, true);
    G.police.addWanted(3, G);
    // One step so the wanted level spawns its cruisers, then trail them
    // 30 m and 44 m behind the player car (the pursuit AI holds ~28 m).
    G.scripted = autopilotDrive(G);
    G.stepGame(STEP);
    for (let i = 0; i < 2; i += 1) {
      const c = G.police.cruisers[i];
      if (c) { c.pos.set(0, 0, -200 - 30 - i * 14); c.heading = 0; c.speed = 22; }
    }
    // A little traffic ahead on the same avenue.
    G.traffic.cars[0].pos.set(6, 0, -120);
    G.traffic.cars[0].heading = 0;
    for (let i = 1; i < Math.floor(CHASE_SECONDS / STEP); i += 1) {
      G.scripted = autopilotDrive(G);
      G.stepGame(STEP);
    }
    // Final composition: trail two cruisers 28 m and 42 m behind the player
    // car (the pursuit AI holds ~28 m, but the Vesper outruns the Interceptor
    // over 4.5 s, so they drift too far back to read in the frame).
    const pc = G.playerCar;
    for (let i = 0; i < 2; i += 1) {
      const c = G.police.cruisers[i];
      if (c) {
        c.pos.set(pc.pos.x - Math.sin(pc.heading) * (28 + i * 14), 0, pc.pos.z - Math.cos(pc.heading) * (28 + i * 14));
        c.heading = pc.heading;
        c.speed = pc.speed;
        c.group.position.copy(c.pos);
        c.group.rotation.y = c.heading;
      }
    }
    G.scripted = null;
    return { screen: 'play', best: 0 };
  }

  if (shotName === 'street') {
    // On foot on a busy Calle Verde avenue: the player walks down the road
    // itself (clear of the palms that line the sidewalks), pedestrians on the
    // sidewalks, traffic passing both ways.
    pp.pos.set(-120, 0, 20);
    pp.heading = Math.PI;
    pp.camYaw = Math.PI;
    G.player.state.pos.copy(pp.pos);
    G.player.state.group.position.copy(pp.pos);
    for (let i = 0; i < 8; i += 1) {
      const p = G.pedestrians.peds[i];
      if (p) {
        const side = i % 2 === 0 ? -130 : -110;
        p.pos.set(side, 0, 0 + i * 8);
        p.target = { x: side, z: 90 };
      }
    }
    G.traffic.cars[0].pos.set(-120, 0, -40);
    G.traffic.cars[0].heading = 0;
    G.traffic.cars[1].pos.set(-114, 0, 100);
    G.traffic.cars[1].heading = Math.PI;
    for (let i = 0; i < Math.floor(STREET_SECONDS / STEP); i += 1) {
      G.scripted = autopilotWalk(G);
      G.stepGame(STEP);
    }
    G.scripted = null;
    return { screen: 'play', best: 0 };
  }

  if (shotName === 'mission') {
    // M5 shootout at the pier warehouse: player behind cover, 6 enforcers,
    // health bars, objective text, muzzle flash held for the photo.
    // The player starts just south of the warehouse front, inside the goto
    // radius, so the first step completes it and the clear stage spawns its
    // enforcers around the warehouse. Heading 0 = face north toward the
    // warehouse; camYaw 0 = camera south of the player, behind him, looking
    // north at the fight (heading PI / camYaw PI would put the camera north,
    // in front of him, with the enemies behind it).
    G.missions.start(G, 4); // M5 (0-based index 4)
    pp.pos.set(-186, 0, -140);
    pp.heading = 0;
    pp.camYaw = 0;
    pp.camPitch = 0.1; // lower camera: enemies read as people, not rooftops
    G.player.state.pos.copy(pp.pos);
    G.player.state.group.position.copy(pp.pos);
    // Stage the player aiming at the warehouse; fire twice mid-sequence.
    for (let i = 0; i < Math.floor(MISSION_SECONDS / STEP); i += 1) {
      G.scripted = { f: 0, s: 0 };
      if (i === 90 || i === 150) G.combat.shoot(G);
      G.stepGame(STEP);
    }
    G.scripted = null;
    // Hold one muzzle flash + tracer into the frame for the capture.
    const enemy = G.combat.enemies.find((e) => !e.dead);
    if (enemy) {
      const cam = G.render.camera;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const mx = cam.position.x + dir.x * 1.2;
      const my = cam.position.y - 0.25 + dir.y * 1.2;
      const mz = cam.position.z + dir.z * 1.2;
      G.effects.muzzleHold(mx, my, mz, 2.0);
      G.effects.tracerHold(mx, my, mz, enemy.pos.x, 1.3, enemy.pos.z, 2.0);
    }
    return { screen: 'play', best: 0 };
  }

  // title: live city vista behind the menu — traffic and pedestrians moving.
  for (let i = 0; i < Math.floor(TITLE_SECONDS / STEP); i += 1) {
    G.scripted = { f: 0, s: 0 };
    G.stepGame(STEP);
  }
  G.scripted = null;
  // Vista camera: high over downtown looking north-west toward the ocean + sun.
  G.render.placeCamera(new THREE.Vector3(150, 55, 190), new THREE.Vector3(-140, 8, -120));
  return { screen: 'title', best: G.saveData ? G.saveData.money : 0 };
}
