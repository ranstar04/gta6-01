// Renderer + scene dressing: sky dome, sun, fog, ocean, clouds, ground, beach.
// The sky's base color equals the fog color so the horizon never washes out,
// and the ground + ocean both run far past the fog far plane.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 3200);

  // Sky dome: gradient + sun glow, fog off so it never greys out.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(CFG.skyTop) },
      bottomColor: { value: new THREE.Color(CFG.skyBottom) },
      sunDir: { value: new THREE.Vector3(...CFG.sunPos).normalize() },
      sunColor: { value: new THREE.Color(CFG.sunColor) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.05, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(max(h, 0.0), 0.55));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 600.0) * 1.4 + pow(s, 10.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat);
  scene.add(sky);

  // Lights: warm late-afternoon sun + soft sky bounce. No shadow maps (SwiftShader
  // budget); long shadows are faked with blob shadows under characters and cars.
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x5a4a3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.sunColor, 1.6);
  sun.position.set(...CFG.sunPos);
  scene.add(sun);

  // Ground: one huge plane so the city never ends at a visible edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize),
    new THREE.MeshLambertMaterial({ color: 0x8a7f6d }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  scene.add(ground);

  // Beach sand along the whole west edge.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 1400),
    new THREE.MeshLambertMaterial({ color: 0xe2c88f }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-214, 0.0, 0);
  scene.add(beach);

  // Ocean: vertex waves, far past the fog so the sea meets the haze.
  const oceanGeo = new THREE.PlaneGeometry(1000, 1400, 36, 48);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanBase = oceanGeo.attributes.position.array.slice();
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({ color: 0x2e7f9e }));
  ocean.position.set(-735, 0.1, 0);
  scene.add(ocean);

  // Drifting clouds: flattened white blobs that wrap around the city.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(14 + ((i * 7 + j * 13) % 12), 8, 6), cloudMat);
      puff.position.set(j * 16 - puffs * 8, (j % 2) * 4, ((i + j) % 3) * 8 - 8);
      puff.scale.y = 0.45;
      group.add(puff);
    }
    group.position.set(-700 + i * 160, 130 + (i % 4) * 22, -500 + ((i * 173) % 1000));
    scene.add(group);
    clouds.push(group);
  }

  let frame = 0;
  function update(dt, t) {
    frame++;
    // Ocean waves, every third frame to save the software renderer.
    if (frame % 3 === 0) {
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = oceanBase[i * 3];
        const bz = oceanBase[i * 3 + 2];
        pos.setY(i, Math.sin(bx * 0.045 + t * 1.1) * 0.5 + Math.cos(bz * 0.03 + t * 0.8) * 0.35);
      }
      pos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
    }
    for (const c of clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x > 900) c.position.x = -900;
    }
    // Sky dome follows the camera so its edge is never reached.
    sky.position.set(camera.position.x, 0, camera.position.z);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, update };
}
