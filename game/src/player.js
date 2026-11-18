// Rook Vega on foot: procedural low-poly figure, WASD movement relative to the
// orbit camera, sprint, jump, limb-swing animation, health regen, blob shadow.
// Also exports buildPersonFigure, reused for pedestrians.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle, clampWorldBounds, isOnSidewalk } from './world.js';

export function buildPersonFigure({ shirt = 0x2e8b8b, pants = 0x2b3a55, skin = 0xc98d64, cap = null } = {}) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const capMat = cap ? new THREE.MeshLambertMaterial({ color: cap }) : null;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.42), shirtMat);
  torso.position.y = 1.28;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.95;
  group.add(head);
  if (capMat) {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), capMat);
    hat.position.y = 2.18;
    group.add(hat);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.24), capMat);
    brim.position.set(0, 2.14, 0.3);
    group.add(brim);
  }
  function limb(mat, x, y, w, h) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  }
  const armL = limb(shirtMat, -0.45, 1.62, 0.22, 0.78);
  const armR = limb(shirtMat, 0.45, 1.62, 0.22, 0.78);
  const legL = limb(pantsMat, -0.18, 0.86, 0.26, 0.86);
  const legR = limb(pantsMat, 0.18, 0.86, 0.26, 0.86);

  // Fake contact shadow: a dark disc that grounds the figure without shadow maps.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, armL, armR, legL, legR };
}

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function groundHeightAt(x, z) {
  // Sidewalk strips sit 0.12 above the road plane.
  return isOnSidewalk(x, z) ? 0.12 : 0;
}

export function createPlayer(S) {
  const figure = buildPersonFigure({ shirt: 0x2e8b8b, pants: 0x2b3a55, cap: 0x1a1a22 });
  const group = figure.group;
  group.position.set(-60, 0, 92);
  S.scene.add(group);
  S.camYaw = 0;
  S.camPitch = 0.22;

  const state = {
    group, figure,
    yaw: 0,
    vy: 0,
    onGround: true,
    swing: 0,
    speed: 0,
  };

  function update(dt) {
    if (S.playerCar) { group.visible = false; return; }
    group.visible = true;
    const input = S.input;
    const mouse = input.consumeMouse();
    if (input.isLocked()) {
      S.camYaw -= mouse.dx * 0.0032;
      S.camPitch = Math.max(-0.05, Math.min(0.7, S.camPitch + mouse.dy * 0.0024));
    }
    const axis = input.moveAxis();
    const fx = Math.sin(S.camYaw);
    const fz = Math.cos(S.camYaw);
    const rx = Math.cos(S.camYaw);
    const rz = -Math.sin(S.camYaw);
    let mx = fx * axis.y + rx * axis.x;
    let mz = fz * axis.y + rz * axis.x;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const target = (input.sprinting() ? CFG.playerSprint : CFG.playerWalk) * (ml > 0.01 ? 1 : 0);
    state.speed += (target - state.speed) * Math.min(1, dt * 8);
    const pos = group.position;
    pos.x += mx * state.speed * dt;
    pos.z += mz * state.speed * dt;
    collideCircle(pos, 0.6, S.colliders);
    clampWorldBounds(pos, 0.6);

    // Jump + gravity, landing on the road or sidewalk height.
    const gy = groundHeightAt(pos.x, pos.z);
    if (input.pressed('Space') && state.onGround) {
      state.vy = CFG.playerJump;
      state.onGround = false;
    }
    if (!state.onGround) {
      state.vy -= CFG.gravity * dt;
      pos.y += state.vy * dt;
      if (pos.y <= gy) { pos.y = gy; state.vy = 0; state.onGround = true; }
    } else {
      pos.y += (gy - pos.y) * Math.min(1, dt * 12);
    }

    // Face the movement direction; swing limbs with speed.
    if (ml > 0.05) {
      const want = Math.atan2(mx, mz);
      state.yaw = lerpAngle(state.yaw, want, Math.min(1, dt * 10));
    }
    group.rotation.y = state.yaw;
    state.swing += state.speed * dt * 1.9;
    const amp = Math.min(1, state.speed / CFG.playerWalk) * 0.65;
    figure.legL.rotation.x = Math.sin(state.swing) * amp;
    figure.legR.rotation.x = -Math.sin(state.swing) * amp;
    figure.armL.rotation.x = -Math.sin(state.swing) * amp * 0.8;
    figure.armR.rotation.x = Math.sin(state.swing) * amp * 0.8;
    figure.group.position.y = pos.y + Math.abs(Math.sin(state.swing)) * 0.05 * amp;

    // Third-person orbit camera.
    const cam = S.camera;
    const dist = 7.2;
    const cx = pos.x - Math.sin(S.camYaw) * Math.cos(S.camPitch) * dist;
    const cz = pos.z - Math.cos(S.camYaw) * Math.cos(S.camPitch) * dist;
    const cy = pos.y + 2.0 + Math.sin(S.camPitch) * dist;
    const k = 1 - Math.pow(0.0001, dt);
    cam.position.x += (cx - cam.position.x) * k;
    cam.position.y += (cy - cam.position.y) * k;
    cam.position.z += (cz - cam.position.z) * k;
    cam.lookAt(pos.x, pos.y + 1.8, pos.z);
  }

  function takeDamage(n) {
    S.health = Math.max(0, S.health - n);
    S.lastDamageAt = S.time;
    S.effects.shake(0.35);
  }

  return { ...state, update, takeDamage };
}
