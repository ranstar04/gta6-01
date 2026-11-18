// SOLMARA's story: six missions in a chain, each with a waypoint beacon, an
// objective line and a payout. The system owns the current objective, the
// beacon mesh and the mission-passed / kingpin moments; the world supplies
// the checks (reach the point, clear the enemies, survive the heat).

import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissions(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.6, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.visible = false;
  scene.add(ring);

  const state = {
    index: 0, // into MISSIONS; MISSIONS.length means the chain is done
    phase: 'go', // go | deliver | escape | clear | done
    target: null,
    objectiveText: '',
    killsNeeded: 0,
    killsDone: 0,
    stage: 0,
    passed: false,
  };

  function current() {
    return MISSIONS[state.index] ?? null;
  }

  /** Point the beacon and objective text at the current mission's target. */
  function aimAt(target, text) {
    state.target = target;
    state.objectiveText = text;
    beacon.position.set(target.x, 30, target.z);
    ring.position.set(target.x, 0.1, target.z);
    beacon.visible = true;
    ring.visible = true;
  }

  function start(index) {
    state.index = index;
    state.phase = 'go';
    state.stage = 0;
    state.killsDone = 0;
    state.passed = false;
    const m = current();
    if (!m) {
      state.target = null;
      state.objectiveText = 'SOLMARA KINGPIN — the city is yours.';
      beacon.visible = false;
      ring.visible = false;
      return state;
    }
    aimAt(m.target, `${m.name}: ${m.briefing}`);
    return state;
  }

  /** M2 has two legs (pickup, then deliver); M4/M6 are steal-and-deliver too. */
  function advanceLeg(game) {
    const m = current();
    if (!m) return;
    if (m.id === 'm2' && state.stage === 0) {
      state.stage = 1;
      aimAt({ x: -40, z: 40 }, 'The Pickup: bring the package to Izzy at the diner.');
      game.hud.feed('Package collected — deliver it to Izzy.', true);
      return;
    }
    if (m.id === 'm4' && state.stage === 0) {
      state.stage = 1;
      aimAt({ x: -176, z: 56 }, 'Heavy Load: deliver the Bruto to the pier warehouse.');
      game.hud.feed('Truck stolen — deliver it to the pier warehouse.', true);
      return;
    }
    if (m.id === 'm6' && state.stage === 0) {
      state.stage = 1;
      aimAt({ x: 168, z: 120 }, 'The Golden Gull: deliver the Vesper GT to the chop shop.');
      game.hud.feed('Show car stolen — deliver it to the chop shop.', true);
      return;
    }
    complete(game);
  }

  function complete(game) {
    const m = current();
    if (!m) return;
    state.passed = true;
    game.money += m.reward;
    game.audio.jingle();
    game.hud.banner('MISSION PASSED', `${m.name}  +$${m.reward}`);
    game.hud.feed(`Mission passed: ${m.name} +$${m.reward}`, true);
    game.saveProgress();
    state.index += 1;
    state.passed = false;
    if (state.index >= MISSIONS.length) {
      state.target = null;
      state.objectiveText = 'SOLMARA KINGPIN — the city is yours.';
      beacon.visible = false;
      ring.visible = false;
      game.onKingpin();
      return;
    }
    start(state.index);
  }

  /**
   * Per-frame mission checks. Returns nothing; calls game hooks on progress.
   * `ctx` carries the player position, the car, wanted stars and live enemies.
   */
  function step(dt, ctx, game) {
    const m = current();
    if (!m) return;
    // The beacon pulses so the target reads from across the city.
    const pulse = 0.22 + Math.sin(performance.now() / 280) * 0.08;
    beaconMat.opacity = pulse;
    ring.scale.setScalar(1 + Math.sin(performance.now() / 280) * 0.08);

    if (state.phase === 'clear') {
      if (ctx.enemiesLeft <= 0) complete(game);
      return;
    }
    const t = state.target;
    if (!t) return;
    const d = Math.hypot(ctx.playerPos.x - t.x, ctx.playerPos.z - t.z);
    state.distance = d;
    if (d > m.radius) return;

    // Arrived. What happens next depends on the mission.
    if (m.id === 'm1') {
      complete(game);
    } else if (m.id === 'm2' || m.id === 'm4' || m.id === 'm6') {
      advanceLeg(game);
    } else if (m.id === 'm3') {
      if (ctx.wanted < 1) complete(game);
      else state.objectiveText = 'Hot Pursuit: lose the tail first — then reach the safehouse.';
    } else if (m.id === 'm5') {
      if (state.phase !== 'clear') {
        state.phase = 'clear';
        state.killsNeeded = 6;
        state.objectiveText = 'Storm the Pier: clear the Kross enforcers (0/6).';
        game.startShootout();
      }
    }
  }

  function objective() {
    return { text: state.objectiveText, target: state.target, distance: state.distance ?? null };
  }

  /** Missions cleared so far, for the missions screen. */
  function progress() {
    return { done: state.done, total: MISSIONS.length };
  }

  return { state, start, step, objective, current, complete, aimAt, progress };
}
