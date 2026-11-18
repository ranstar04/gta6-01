// Rook Vega on foot: procedural low-poly character (limbs swing as he walks),
// WASD relative to the camera, sprint, jump, third-person orbit camera with
// pointer lock. The camera is the player's — driving hands it to vehicles.js.
import * as THREE from 'three';
import { PLAYER } from './config.js';

const LIMB_COLORS = { shirt: 0x2e5f8a, pants: 0x2c2f36, skin: 0xd9a077, hair: 0x1a1a1a };

export function createPlayer(scene) {
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), mat(LIMB_COLORS.shirt));
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), mat(LIMB_COLORS.skin));
  head.position.y = 1.68;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), mat(LIMB_COLORS.hair));
  hair.position.y = 1.9;
  group.add(hair);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), mat(LIMB_COLORS.shirt));
  armL.position.set(-0.42, 1.12, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.2), mat(LIMB_COLORS.pants));
  legL.position.set(-0.16, 0.42, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  scene.add(group);

  const state = {
    group, pos: new THREE.Vector3(-108, 0, -36), vel: new THREE.Vector3(),
    heading: Math.PI / 2, camYaw: Math.PI / 2, camPitch: 0.32,
    health: PLAYER.healthMax, vy: 0, grounded: true, walkPhase: 0,
    invulnerable: 0, onFoot: true,
  };
  group.position.copy(state.pos);

  function resolveCircle(pos, radius, colliders) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          pos.x = c.maxX + radius;
        }
      }
    }
  }

  return {
    state,
    reset(x, z, heading) {
      state.pos.set(x, 0, z);
      state.vel.set(0, 0, 0);
      state.heading = heading;
      state.camYaw = heading;
      state.health = PLAYER.healthMax;
      state.onFoot = true;
      state.invulnerable = 0;
      group.position.copy(state.pos);
      group.visible = true;
    },
    damage(amount) {
      if (state.invulnerable > 0) return false;
      state.health = Math.max(0, state.health - amount);
      state.invulnerable = 0.5;
      return true;
    },
    heal(amount) { state.health = Math.min(PLAYER.healthMax, state.health + amount); },
    update(dt, input, G) {
      if (!state.onFoot) return;
      const mouse = input.takeMouse();
      state.camYaw -= mouse.x * 0.0028;
      state.camPitch = Math.max(-0.15, Math.min(0.9, state.camPitch + mouse.y * 0.0022));
      const mv = input.move();
      // Jumps commit you: steering authority in the air is less than half.
      const airFactor = state.grounded ? 1 : 0.45;
      const speed = (input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * airFactor;
      const sin = Math.sin(state.camYaw);
      const cos = Math.cos(state.camYaw);
      // Forward on screen is -Z rotated by camYaw; strafe is perpendicular.
      const fx = -sin;
      const fz = -cos;
      const rx = -fz;
      const rz = fx;
      let mx = fx * mv.f + rx * mv.s;
      let mz = fz * mv.f + rz * mv.s;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        state.pos.x += mx * speed * dt;
        state.pos.z += mz * speed * dt;
        state.heading = Math.atan2(mx, mz);
        state.walkPhase += dt * speed * 1.6;
      }
      if (input.jump() && state.grounded) { state.vy = PLAYER.jumpSpeed; state.grounded = false; }
      if (!state.grounded) {
        state.vy -= PLAYER.gravity * dt;
        state.pos.y += state.vy * dt;
        if (state.pos.y <= 0) { state.pos.y = 0; state.vy = 0; state.grounded = true; }
      }
      const c = G.city.colliders;
      resolveCircle(state.pos, PLAYER.radius, c);
      const clamped = G.world.clampToCity(state.pos.x, state.pos.z);
      state.pos.x = clamped.x; state.pos.z = clamped.z;
      if (state.invulnerable > 0) state.invulnerable -= dt;
      if (state.health < PLAYER.healthMax) state.health = Math.min(PLAYER.healthMax, state.health + PLAYER.regenPerSec * dt);
      group.position.copy(state.pos);
      group.rotation.y = state.heading;
      const swing = len > 0.01 ? Math.sin(state.walkPhase) * 0.55 : 0;
      armL.rotation.x = swing;
      armR.rotation.x = -swing;
      legL.rotation.x = -swing;
      legR.rotation.x = swing;
      torso.position.y = 1.12 + (len > 0.01 ? Math.abs(Math.sin(state.walkPhase)) * 0.05 : 0);
    },
    cameraTarget() {
      // Camera sits behind the player at camYaw, looking slightly down.
      const d = 7.5;
      const h = 3.2 + state.camPitch * 4;
      return {
        pos: new THREE.Vector3(
          state.pos.x + Math.sin(state.camYaw) * d,
          h,
          state.pos.z + Math.cos(state.camYaw) * d,
        ),
        look: new THREE.Vector3(state.pos.x, 1.6, state.pos.z),
      };
    },
  };
}
