// Minimap: a north-up 2D canvas — roads, beach, player arrow, traffic dots,
// police blips, mission marker, taxi marker, remaining shells.
import { CFG } from './config.js';

export function createMinimap(S, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const SCALE = W / 420; // covers x/z -210..210
  function px(x) { return W / 2 + x * SCALE; }
  function py(z) { return H / 2 + z * SCALE; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, W, H);
    // Ocean + beach on the west edge.
    ctx.fillStyle = '#1d4e63';
    ctx.fillRect(0, 0, px(-186), H);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(px(-186), 0, px(-178) - px(-186), H);
    // Roads.
    ctx.strokeStyle = '#5a5a63';
    ctx.lineWidth = 4;
    for (const r of CFG.roads) {
      ctx.beginPath(); ctx.moveTo(px(r), py(-186)); ctx.lineTo(px(r), py(186)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(-186), py(r)); ctx.lineTo(px(186), py(r)); ctx.stroke();
    }
    // Remaining shells.
    ctx.fillStyle = '#ffd34d';
    for (const spot of S.shellSpots) {
      if (S.shellsGot.has(S.shellSpots.indexOf(spot))) continue;
      ctx.beginPath(); ctx.arc(px(spot.x), py(spot.z), 2, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker (gold diamond).
    const mp = S.missions ? S.missions.markerPos() : null;
    if (mp) {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(px(mp.x), py(mp.z) - 6);
      ctx.lineTo(px(mp.x) + 5, py(mp.z));
      ctx.lineTo(px(mp.x), py(mp.z) + 6);
      ctx.lineTo(px(mp.x) - 5, py(mp.z));
      ctx.closePath(); ctx.fill();
    }
    // Taxi fare marker (green diamond).
    const tm = S.missions ? S.missions.taxiMarker() : null;
    if (tm) {
      ctx.fillStyle = '#2ecc40';
      ctx.beginPath();
      ctx.moveTo(px(tm.x), py(tm.z) - 5);
      ctx.lineTo(px(tm.x) + 4, py(tm.z));
      ctx.lineTo(px(tm.x), py(tm.z) + 5);
      ctx.lineTo(px(tm.x) - 4, py(tm.z));
      ctx.closePath(); ctx.fill();
    }
    // Traffic dots.
    ctx.fillStyle = '#f2c14e';
    for (const car of S.traffic.list) {
      ctx.beginPath(); ctx.arc(px(car.group.position.x), py(car.group.position.z), 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips (blink red/blue while wanted).
    const blink = Math.floor(S.time * 3) % 2 === 0;
    ctx.fillStyle = S.wanted > 0 && blink ? '#ff4040' : '#3d8bfd';
    for (const car of S.police.cruisers) {
      ctx.beginPath(); ctx.arc(px(car.group.position.x), py(car.group.position.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow (white, rotated by facing).
    const pp = S.player.group.position;
    const yaw = S.playerCar ? S.playerCar.yaw : S.player.yaw;
    ctx.save();
    ctx.translate(px(pp.x), py(pp.z));
    ctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', W - 14, 14);
  }

  return { draw };
}
