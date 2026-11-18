// SOLMARA's minimap: a small top-down canvas — roads, the beach, the player
// arrow, traffic dots, police blips, the mission marker and a north tick.
// Redrawn every frame from live state; it is cheap at 150x150.

import { ROADS } from './config.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const RANGE = 460; // world units shown across the map
  const scale = W / RANGE;

  function toMap(x, z) {
    return [W / 2 + x * scale, H / 2 + z * scale];
  }

  function draw(state) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(12,16,22,0.78)';
    ctx.fillRect(0, 0, W, H);
    // Beach + ocean on the west edge.
    ctx.fillStyle = '#3d6a7a';
    ctx.fillRect(0, 0, toMap(-220, 0)[0], H);
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(toMap(-220, 0)[0], 0, toMap(-180, 0)[0] - toMap(-220, 0)[0], H);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 3;
    for (const r of ROADS) {
      const [x1] = toMap(r, -220);
      const [, z1] = toMap(-220, r);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(W, z1);
      ctx.stroke();
    }
    // Mission marker: a gold diamond.
    if (state.missionTarget) {
      const [mx, mz] = toMap(state.missionTarget.x, state.missionTarget.z);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(mx, mz - 6);
      ctx.lineTo(mx + 5, mz);
      ctx.lineTo(mx, mz + 6);
      ctx.lineTo(mx - 5, mz);
      ctx.closePath();
      ctx.fill();
    }
    // Taxi destination: a gold triangle so the fare is findable at a glance.
    if (state.taxiTarget) {
      const [tx, tz] = toMap(state.taxiTarget.x, state.taxiTarget.z);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(tx, tz - 6);
      ctx.lineTo(tx + 5, tz + 4);
      ctx.lineTo(tx - 5, tz + 4);
      ctx.closePath();
      ctx.fill();
    }
    // Shells not yet collected: tiny gold dots.
    ctx.fillStyle = '#f2c94c';
    for (const s of state.shells) {
      const [sx, sz] = toMap(s.x, s.z);
      ctx.fillRect(sx - 1, sz - 1, 2, 2);
    }
    // Traffic: pale dots.
    ctx.fillStyle = '#c8ccd2';
    for (const c of state.traffic) {
      const [cx, cz] = toMap(c.pos.x, c.pos.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    // Police: red/blue blips.
    for (const c of state.police) {
      const [cx, cz] = toMap(c.pos.x, c.pos.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(cx, cz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: a white arrow pointing along the heading.
    const [px, pz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(state.playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', W / 2, 11);
  }

  return { draw };
}
