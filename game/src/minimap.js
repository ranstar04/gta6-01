// Minimap: 2D canvas top-down — roads, beach, player arrow, traffic dots, police
// blips (red/blue), mission marker (gold), north indicator. Always visible.
import { WORLD } from './config.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const SIZE = 180;
  const SCALE = SIZE / (WORLD.bound * 2 + 60);

  function toMap(x, z) {
    return [
      (x + WORLD.bound + 30) * SCALE,
      (z + WORLD.bound + 30) * SCALE,
    ];
  }

  function draw(g) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Backdrop: land.
    ctx.fillStyle = 'rgba(20, 32, 24, 0.82)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Ocean strip on the west.
    ctx.fillStyle = 'rgba(30, 127, 168, 0.9)';
    const [ox] = toMap(WORLD.oceanX, 0);
    ctx.fillRect(0, 0, Math.max(0, ox), SIZE);
    // Roads.
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.75)';
    ctx.lineWidth = 2;
    for (const x of WORLD.avenues) {
      const [mx] = toMap(x, 0);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, SIZE);
      ctx.stroke();
    }
    for (const z of WORLD.streets) {
      const [, mz] = toMap(0, z);
      ctx.beginPath();
      ctx.moveTo(0, mz);
      ctx.lineTo(SIZE, mz);
      ctx.stroke();
    }
    // Mission marker (gold diamond).
    const m = g.missions.current();
    if (m) {
      const [mx, mz] = toMap(m.target.x, m.target.z);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(mx, mz - 6);
      ctx.lineTo(mx + 5, mz);
      ctx.lineTo(mx, mz + 6);
      ctx.lineTo(mx - 5, mz);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic dots (white).
    ctx.fillStyle = '#ffffff';
    for (const c of g.traffic.cars) {
      const [mx, mz] = toMap(c.x, c.z);
      ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
    }
    // Police blips (red/blue alternating).
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ff4444' : '#4488ff';
    for (const c of g.police.cruisers) {
      const [mx, mz] = toMap(c.x, c.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow (green), rotated by heading. The arrow is drawn pointing
    // up (north, -z), but yaw is measured from +z (south, down on the map),
    // so add half a turn or the arrow points exactly backwards.
    const p = g.player;
    const px = p.car ? p.car.x : p.x;
    const pz = p.car ? p.car.z : p.z;
    const yaw = p.car ? p.car.yaw : p.camYaw;
    const [mx, mz] = toMap(px, pz);
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(yaw + Math.PI);
    ctx.fillStyle = '#4ae08a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', SIZE - 10, 14);
  }

  return { draw };
}
