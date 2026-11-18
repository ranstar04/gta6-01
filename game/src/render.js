// Rendering only: the three.js scene, camera, late-afternoon sun, hemisphere
// light, gradient sky dome, fog and drifting clouds. No game rules in here.
// placeCamera IS exported on the returned stage object (a missing export once
// killed the whole frame loop with a black canvas).
import * as THREE from 'three';
import { PALETTE } from './config.js';

const SKY_VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
varying vec3 vPos;
uniform vec3 topColor;
uniform vec3 bottomColor;
void main() {
  float h = clamp(normalize(vPos).y * 1.6 + 0.25, 0.0, 1.0);
  gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
}`;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 200, 900);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);

  // Sky dome: gradient top (blue) to bottom (warm horizon == fog colour).
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      bottomColor: { value: new THREE.Color(PALETTE.skyBottom) },
    },
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat);
  scene.add(sky);

  // Sun disc: a warm emissive circle low in the west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  sun.position.set(-1100, 260, -300);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Late-afternoon sun + bright hemisphere (1.2 — dimmer left the warehouse black).
  const sunLight = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 1.9);
  sunLight.position.set(-400, 190, 140);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(new THREE.Color(PALETTE.hemiSky), new THREE.Color(PALETTE.hemiGround), 1.2);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // Drifting clouds: flat white ellipsoids, slowly crossing the sky.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    c.scale.set(46 + Math.random() * 40, 9 + Math.random() * 5, 22 + Math.random() * 14);
    c.position.set(-500 + Math.random() * 1000, 150 + Math.random() * 90, -500 + Math.random() * 1000);
    scene.add(c);
    clouds.push(c);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function placeCamera(pos, look) {
    camera.position.copy(pos);
    camera.lookAt(look);
  }

  return {
    scene, camera, renderer,
    // placeCamera is exported here — shots.js and the main loop use it.
    placeCamera,
    update(dt) {
      for (const c of clouds) {
        c.position.x += dt * 2.2;
        if (c.position.x > 620) c.position.x = -620;
      }
    },
    render() { renderer.render(scene, camera); },
  };
}
