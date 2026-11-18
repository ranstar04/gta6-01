// Rook Vega on foot: procedural low-poly character, WASD movement, jump, sprint,
// over-shoulder camera that orbits with the mouse.
import * as THREE from 'three';
import { PALETTE, TUNE } from './config.js';
import { clamp } from './random.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: PALETTE.playerShirt, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: PALETTE.playerPants, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), shirt);
  torso.position.y = 1.28;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.92;
  head.castShadow = true;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hair);
  hairM.position.y = 2.16;
  g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.26), pants);
  legL.position.set(-0.17, 0.45, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), shirt);
  armL.position.set(-0.43, 1.28, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.43;
  g.add(armR);
  // Pistol in the right hand: parented to the arm so it swings with the hand
  // instead of floating at a fixed spot while the arm moves. Local position is
  // the hand (arm centre y 1.28 minus half the 0.72 arm height).
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }),
  );
  gun.position.set(0, -0.33, 0.2);
  armR.add(gun);

  g.userData = { torso, head, legL, legR, armL, armR, gun };
  return g;
}

export function createPlayer(scene, x, z) {
  const mesh = buildPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x, z, y: 0, vy: 0,
    yaw: 0, // facing
    camYaw: 0, camPitch: 0.32,
    health: TUNE.playerHealth,
    grounded: true,
    walkPhase: 0,
    moving: false,
    car: null, // car object when driving
  };
}

// On-foot step. Returns whether the player moved (for animation + audio).
export function stepPlayer(player, input, dt, collideFn) {
  const mx = input.axis('moveX');
  const mz = -input.axis('moveY'); // W = forward
  // Mouse orbit.
  player.camYaw -= input.mouseDX * 0.0032;
  player.camPitch = clamp(player.camPitch + input.mouseDY * 0.0024, -0.15, 0.85);

  const speed = input.sprint() ? TUNE.sprintSpeed : TUNE.walkSpeed;
  const sin = Math.sin(player.camYaw);
  const cos = Math.cos(player.camYaw);
  // Camera-relative movement: forward is away from the camera.
  const fx = -sin;
  const fz = -cos;
  const rx = -cos;
  const rz = sin;
  let vx = (fx * mz + rx * mx) * speed;
  let vz = (fz * mz + rz * mx) * speed;
  const len = Math.hypot(vx, vz);
  if (len > speed) { vx = (vx / len) * speed; vz = (vz / len) * speed; }
  player.moving = len > 0.5;

  const nx = player.x + vx * dt;
  const nz = player.z + vz * dt;
  const fixed = collideFn(nx, nz, 0.55);
  player.x = fixed.x;
  player.z = fixed.z;

  if (player.grounded && input.jumpQueued) {
    player.vy = TUNE.jumpSpeed;
    player.grounded = false;
  }
  player.vy -= TUNE.gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }
  if (player.moving) {
    player.yaw = Math.atan2(vx, vz);
    player.walkPhase += dt * (input.sprint() ? 13 : 9);
  }

  // Mesh sync + limb swing.
  const m = player.mesh;
  m.position.set(player.x, player.y, player.z);
  m.rotation.y = player.yaw;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.65 : 0;
  const u = m.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  u.torso.position.y = 1.28 + (player.moving ? Math.abs(Math.sin(player.walkPhase)) * 0.05 : 0);
  return player.moving;
}

// Third-person camera: behind the player on foot, chase behind the car when driving.
export function updateCamera(camera, player, dt) {
  if (player.car) {
    const car = player.car;
    const back = 9.5 + Math.abs(car.speed) * 0.08;
    const tx = car.x - Math.sin(car.yaw) * back;
    const tz = car.z - Math.cos(car.yaw) * back;
    const ty = 4.2 + Math.abs(car.speed) * 0.02;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
    camera.lookAt(car.x + Math.sin(car.yaw) * 6, 1.6, car.z + Math.cos(car.yaw) * 6);
    return;
  }
  const dist = 7.5;
  const cx = player.x + Math.sin(player.camYaw) * Math.cos(player.camPitch) * dist;
  const cz = player.z + Math.cos(player.camYaw) * Math.cos(player.camPitch) * dist;
  const cy = player.y + 2.2 + Math.sin(player.camPitch) * dist;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 12);
  camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 12);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 12);
  camera.lookAt(player.x, player.y + 1.7, player.z);
}
