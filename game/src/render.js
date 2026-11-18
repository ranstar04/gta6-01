// three.js scene, lighting, sky, fog, ocean. Owns the renderer and camera; the game
// logic lives in the other files and only asks this one to render and to move the camera.
import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_MISSION = 'mission';
export const SCREEN_KINGPIN = 'kingpin';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(20, 12, 30);

  // Late-afternoon sun, warm and low from the west so shadows stretch east.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-120, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x5a5a68, 0.9));

  // Procedural sky dome: gradient shader + sun disc + drifting cloud billboards.
  const skyGeo = new THREE.SphereGeometry(700, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      bottom: { value: new THREE.Color(PALETTE.skyBottom) },
      sunDir: { value: new THREE.Vector3(-0.75, 0.42, 0.25).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.65));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.85, 0.55) * pow(s, 220.0) * 1.4;
        col += vec3(1.0, 0.7, 0.35) * pow(s, 8.0) * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Clouds: soft white flattened spheres drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.85, fog: false });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let j = 0; j < puffs; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + (j % 3) * 3, 8, 6), cloudMat);
      s.position.set(j * 7 - puffs * 3, (j % 2) * 1.5, (j % 3) * 3 - 3);
      s.scale.y = 0.45;
      g.add(s);
    }
    g.position.set(-260 + i * 40 + (i % 3) * 13, 95 + (i % 5) * 9, -320 + (i * 53) % 640);
    scene.add(g);
    clouds.push(g);
  }

  // Ocean: animated plane west of the beach, vertex waves in the update loop.
  // Oversized like the ground (500 x 1200) so its far edges sit beyond the fog
  // and never show a hard seam against the sky dome's lower hemisphere.
  const oceanGeo = new THREE.PlaneGeometry(500, 1200, 24, 48);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.35, metalness: 0.1 });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(-400, -0.4, 0);
  scene.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  let shake = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    addShake(amount) { shake = Math.min(1.2, shake + amount); },
    update(dt, time) {
      // Ocean waves.
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = oceanBase[i * 3];
        const bz = oceanBase[i * 3 + 2];
        pos.array[i * 3 + 1] = Math.sin(bx * 0.08 + time * 1.1) * 0.35 + Math.cos(bz * 0.05 + time * 0.7) * 0.3;
      }
      pos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      for (const c of clouds) {
        c.position.x += dt * 1.2;
        if (c.position.x > 320) c.position.x = -320;
      }
      // Camera shake decays.
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.25;
        camera.position.y += (Math.random() - 0.5) * shake * 0.25;
        shake *= Math.pow(0.02, dt);
      } else {
        shake = 0;
      }
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
