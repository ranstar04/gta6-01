// Minimap: 2D canvas top-down — roads, ocean edge, player arrow, traffic dots,
// police blips (red/blue), mission marker (gold), shells (tiny gold dots), north
// indicator. Always visible during play.
import { CITY, ROADS } from './config.js';

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const S = 168; // canvas px
  const HALF = 320; // world units shown (a little past the city edge)
  const scale = S / (HALF * 2);

  function toMap(x, z) {
    return { x: (x + HALF) * scale, y: (z + HALF) * scale };
  }

  function draw(G) {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(16, 20, 28, 0.78)';
    ctx.fillRect(0, 0, S, S);
    // Ocean (west).
    const ox = toMap(-320, 0).x;
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, 0, Math.max(0, ox), S);
    // Beach strip.
    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(ox, 0, toMap(-258, 0).x - ox, S);
    // Roads.
    ctx.strokeStyle = '#565d68';
    ctx.lineWidth = 4;
    for (const r of ROADS) {
      const a = toMap(r, -HALF);
      const b = toMap(r, HALF);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = toMap(-HALF, r);
      const d = toMap(HALF, r);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    // Shells.
    ctx.fillStyle = '#ffd700';
    for (const sh of G.missions.shells) {
      const p = toMap(sh.pos.x, sh.pos.z);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // Mission marker (pulsing gold).
    const marker = G.missions.marker(G);
    if (marker) {
      const p = toMap(marker.x, marker.z);
      const r = 5 + Math.sin(performance.now() * 0.005) * 1.5;
      ctx.fillStyle = marker.kind === 'taxi' ? '#ffd21f' : '#f2c94c';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#cfd6de';
    for (const c of G.traffic.cars) {
      const p = toMap(c.pos.x, c.pos.z);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // Police blips.
    for (const c of G.police.cruisers) {
      const p = toMap(c.pos.x, c.pos.z);
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff3b30' : '#2a6bff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const pp = G.player.state.pos;
    const p = toMap(pp.x, pp.z);
    const heading = G.playerCar ? G.playerCar.heading : G.player.state.heading;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fill();
    // Dark outline so the arrow reads over pale sand and bright roads.
    ctx.strokeStyle = '#111418';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', S - 10, 13);
  }

  return { draw };
}
