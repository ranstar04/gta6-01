// Rook Vega on foot: a low-poly character with swinging limbs, camera-relative
// WASD movement, sprint and jump, and a simple health model with slow regen.
// The character mesh is built from boxes so it reads clearly at a distance.

import * as THREE from 'three';
import { PLAYER } from './config.js';

const SKIN = 0xc98a5e;
const JACKET = 0x27435f;
const PANTS = 0x2c2c34;
const SHIRT = 0xe8e0cc;

function buildBody() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: JACKET });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS });
  const skin = new THREE.MeshLambertMaterial({ color: SKIN });
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRT });
  const box = new THREE.BoxGeometry(1, 1, 1);

  const torso = new THREE.Mesh(box, jacket);
  torso.scale.set(0.62, 0.72, 0.34);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const chest = new THREE.Mesh(box, shirt);
  chest.scale.set(0.4, 0.5, 0.06);
  chest.position.set(0, 1.16, 0.19);
  group.add(chest);
  const head = new THREE.Mesh(box, skin);
  head.scale.set(0.34, 0.36, 0.34);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.scale.set(0.36, 0.12, 0.36);
  hair.position.y = 1.88;
  group.add(hair);

  const armL = new THREE.Mesh(box, jacket);
  armL.scale.set(0.16, 0.62, 0.16);
  armL.position.set(-0.4, 1.1, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(box, jacket);
  armR.scale.set(0.16, 0.62, 0.16);
  armR.position.set(0.4, 1.1, 0);
  armR.castShadow = true;
  group.add(armR);
  const legL = new THREE.Mesh(box, pants);
  legL.scale.set(0.2, 0.72, 0.2);
  legL.position.set(-0.16, 0.38, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(box, pants);
  legR.scale.set(0.2, 0.72, 0.2);
  legR.position.set(0.16, 0.38, 0);
  legR.castShadow = true;
  group.add(legR);

  return { group, armL, armR, legL, legR };
}

export function createPlayer(scene, start) {
  const { group, armL, armR, legL, legR } = buildBody();
  group.position.set(start.x, 0, start.z);
  scene.add(group);

  const state = {
    mesh: group,
    pos: group.position,
    yaw: Math.PI,
    camYaw: Math.PI,
    camPitch: -0.22,
    vy: 0,
    grounded: true,
    speed: 0,
    health: PLAYER.health,
    lastHurtAt: -99,
    walkPhase: 0,
    moving: false,
  };

  function damage(amount, now) {
    state.health = Math.max(0, state.health - amount);
    state.lastHurtAt = now;
    return state.health <= 0;
  }

  function heal(amount) {
    state.health = Math.min(PLAYER.health, state.health + amount);
  }

  /** Advance one fixed step. `move` is input.move(), `look` is input.look(). */
  function step(dt, move, look, world, now) {
    // Mouse orbits the camera; the character turns toward the camera yaw when moving.
    state.camYaw -= look.x * 0.0028;
    state.camPitch = Math.max(-0.9, Math.min(0.45, state.camPitch - look.y * 0.0022));

    const sprint = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(state.camYaw);
    const cos = Math.cos(state.camYaw);
    let mx = (move.f * -sin + move.s * cos) * sprint;
    let mz = (move.f * -cos - move.s * sin) * sprint;
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.1;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const sp = state.moving ? sprint : 0;
      state.pos.x += mx * sp * dt;
      state.pos.z += mz * sp * dt;
      state.yaw = Math.atan2(mx, mz);
      state.walkPhase += dt * (move.sprint ? 11 : 7.5);
    }
    // Jump + gravity, landing on the flat city floor.
    if (move.jumpHeld && state.grounded) {
      state.vy = PLAYER.jumpSpeed;
      state.grounded = false;
    }
    if (!state.grounded) {
      state.vy -= 22 * dt;
      state.pos.y += state.vy * dt;
      if (state.pos.y <= 0) {
        state.pos.y = 0;
        state.vy = 0;
        state.grounded = true;
      }
    }
    world.collideCircle(state.pos, PLAYER.radius);
    world.clampToLand(state.pos);
    state.speed = len > 0.1 ? sprint : 0;

    // Limb swing: legs and arms counter-swing with the stride.
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.6 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    group.rotation.y = state.yaw;

    // Slow regen after a quiet spell.
    if (now - state.lastHurtAt > PLAYER.regenDelay && state.health > 0) {
      state.health = Math.min(PLAYER.health, state.health + PLAYER.regenPerSec * dt);
    }
    return state;
  }

  return { state, step, damage, heal };
}
