// The three.js stage for SOLMARA: renderer, late-afternoon sun, procedural sky,
// fog matched to the horizon, and the ocean. The camera rig lives here too —
// one follow camera that serves on-foot play, driving and the title vista.

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // Sky and fog share one warm haze colour, so distant buildings melt into the
  // horizon instead of ending in a hard line.
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 640);
  scene.background = new THREE.Color(PALETTE.skyBottom);

  // Sky dome: a big sphere with a vertical gradient, warm at the horizon.
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      bottom: { value: new THREE.Color(PALETTE.skyBottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(vP.y / 900.0, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Low sun disc in the west, over the ocean.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-700, 150, -80);
  sun.lookAt(0, 40, 0);
  scene.add(sun);

  // Drifting clouds: flat white puffs high up.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let p = 0; p < puffs; p += 1) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(9 + p * 3, 8, 6), cloudMat);
      ball.position.set(p * 10 - 12, (p % 2) * 2, (p % 3) * 4 - 4);
      ball.scale.y = 0.45;
      cloud.add(ball);
    }
    cloud.position.set(-400 + i * 95, 150 + (i % 3) * 18, -320 + (i * 67) % 560);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Light: warm low sun plus a soft sky fill. Shadows only from the sun.
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a4a, 1.2);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.1);
  sunLight.position.set(-260, 190, -120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 800;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, 8, 24);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const cam = {
    yaw: 0,
    pitch: -0.22,
    distance: 8,
    height: 3.2,
    shake: 0,
  };
  const lookTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  /** Follow `focus` (a Vector3) from behind `yaw`, smoothing the motion. */
  function follow(focus, yaw, dt, opts = {}) {
    const dist = opts.distance ?? cam.distance;
    const height = opts.height ?? cam.height;
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    camPos.copy(focus).addScaledVector(back, dist);
    camPos.y = focus.y + height;
    if (cam.shake > 0.01) {
      camPos.x += (Math.random() - 0.5) * cam.shake;
      camPos.y += (Math.random() - 0.5) * cam.shake * 0.6;
      camPos.z += (Math.random() - 0.5) * cam.shake;
      cam.shake *= Math.pow(0.02, dt);
    }
    camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    lookTarget.copy(focus);
    lookTarget.y += 1.4;
    camera.lookAt(lookTarget);
  }

  /** A slow orbit for the title screen: the city vista behind the menu. */
  function orbitVista(time) {
    const a = time * 0.03;
    camera.position.set(Math.sin(a) * 150, 55 + Math.sin(time * 0.11) * 8, Math.cos(a) * 150 - 20);
    camera.lookAt(0, 12, 0);
  }

  /** Put the camera at an exact spot looking at an exact point (staged shots). */
  function placeCamera(x, y, z, tx, ty, tz) {
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
  }

  let oceanBase = null;
  /** Ripple the ocean mesh: every third frame is enough at this scale. */
  function animateOcean(oceanGeo, time, frame) {
    if (!oceanGeo) return;
    if (!oceanBase) {
      oceanBase = oceanGeo.attributes.position.array.slice();
    }
    if (frame % 3 !== 0) return;
    const pos = oceanGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const bx = oceanBase[i * 3];
      const by = oceanBase[i * 3 + 1];
      pos.array[i * 3 + 2] = Math.sin(bx * 0.08 + time * 0.9) * 0.55 + Math.cos(by * 0.06 + time * 0.7) * 0.45;
    }
    pos.needsUpdate = true;
    oceanGeo.computeVertexNormals();
  }

  function driftClouds(dt) {
    for (const cloud of clouds) {
      cloud.position.x += dt * 1.4;
      if (cloud.position.x > 480) cloud.position.x = -480;
    }
  }

  return { renderer, scene, camera, cam, follow, placeCamera, orbitVista, animateOcean, driftClouds };
}
