// Pedestrians: sidewalk walkers along one road line at a time, fleeing from
// gunfire and speeding cars, knocked down (and the law involved) when the
// player's car hits them. Count is kept at 24 by respawning the fallen.
import { buildPersonFigure } from './player.js';
import { dist2D } from './world.js';
import { makeRng } from './random.js';
import { CFG } from './config.js';

const SHIRTS = [0xe07a5f, 0xf2c14e, 0x81b29a, 0x3d8bfd, 0xe76f51, 0x8e44ad, 0x27ae60, 0xe8e4da];
const PANTS = [0x2b3a55, 0x3a3a3a, 0x5a4a3a, 0x6c584c];
const SKINS = [0xc98d64, 0x8d5a3b, 0xe8b98a, 0x6b4423];

export function createPedestrians(S) {
  const rng = makeRng(CFG.seed + 7);
  const list = [];

  function pickRoadTarget(ped) {
    const vertical = rng.chance(0.5);
    const r = rng.pick(CFG.roads);
    const t = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 7.5 : -7.5;
    ped.target = vertical ? { x: r + side, z: t } : { x: t, z: r + side };
  }

  function spawnPed(x, z, fleeFrom = null) {
    const figure = buildPersonFigure({
      shirt: rng.pick(SHIRTS),
      pants: rng.pick(PANTS),
      skin: rng.pick(SKINS),
      cap: rng.chance(0.3) ? rng.pick(SHIRTS) : null,
    });
    figure.group.position.set(x, 0, z);
    S.scene.add(figure.group);
    const ped = {
      group: figure.group,
      figure,
      speed: rng.range(1.1, 1.9),
      state: fleeFrom ? 'flee' : 'walk',
      target: null,
      fleeFrom,
      fleeT: fleeFrom ? 3 : 0,
      swing: rng.range(0, 6),
      downT: 0,
      hitDone: false,
      yaw: rng.range(0, Math.PI * 2),
    };
    pickRoadTarget(ped);
    list.push(ped);
    return ped;
  }

  // Spawn the opening crowd on sidewalks near the roads.
  for (let i = 0; i < 24; i++) {
    const vertical = rng.chance(0.5);
    const r = rng.pick(CFG.roads);
    const t = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 7.5 : -7.5;
    spawnPed(vertical ? r + side : t, vertical ? t : r + side);
  }

  function fleeFrom(x, z) {
    // A jacked driver runs away from the player on foot.
    const ped = spawnPed(x, z, { x: S.player.group.position.x, z: S.player.group.position.z });
    ped.speed = 4.2;
    return ped;
  }

  function scare(x, z, radius) {
    for (const ped of list) {
      if (ped.state === 'down') continue;
      const d = dist2D(x, z, ped.group.position.x, ped.group.position.z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeT = 3;
        ped.speed = 4.2;
      }
    }
  }

  function update(dt) {
    const playerCar = S.playerCar;
    for (let i = list.length - 1; i >= 0; i--) {
      const ped = list[i];
      const pos = ped.group.position;
      if (ped.state === 'down') {
        ped.downT -= dt;
        ped.group.rotation.x += (-Math.PI / 2 - ped.group.rotation.x) * Math.min(1, dt * 6);
        if (ped.downT <= 0) {
          S.scene.remove(ped.group);
          list.splice(i, 1);
          const vertical = rng.chance(0.5);
          const r = rng.pick(CFG.roads);
          const t = rng.range(-170, 170);
          const side = rng.chance(0.5) ? 7.5 : -7.5;
          spawnPed(vertical ? r + side : t, vertical ? t : r + side);
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        const dx = pos.x - ped.fleeFrom.x;
        const dz = pos.z - ped.fleeFrom.z;
        const len = Math.hypot(dx, dz) || 1;
        pos.x += (dx / len) * ped.speed * dt;
        pos.z += (dz / len) * ped.speed * dt;
        ped.yaw = Math.atan2(dx / len, dz / len);
        if (ped.fleeT <= 0) { ped.state = 'walk'; ped.speed = rng.range(1.1, 1.9); pickRoadTarget(ped); }
      } else {
        const dx = ped.target.x - pos.x;
        const dz = ped.target.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          pickRoadTarget(ped);
        } else {
          pos.x += (dx / d) * ped.speed * dt;
          pos.z += (dz / d) * ped.speed * dt;
          ped.yaw = Math.atan2(dx / d, dz / d);
        }
        // Keep a little personal space around the player on foot.
        const pd = dist2D(pos.x, pos.z, S.player.group.position.x, S.player.group.position.z);
        if (pd < 1.2 && pd > 0.01 && !S.playerCar) {
          pos.x += ((pos.x - S.player.group.position.x) / pd) * (1.2 - pd);
          pos.z += ((pos.z - S.player.group.position.z) / pd) * (1.2 - pd);
        }
        // A speeding car nearby sends walkers running.
        if (playerCar && Math.abs(playerCar.speed) > 9) {
          const cd = dist2D(pos.x, pos.z, playerCar.group.position.x, playerCar.group.position.z);
          if (cd < 10) {
            ped.state = 'flee';
            ped.fleeFrom = { x: playerCar.group.position.x, z: playerCar.group.position.z };
            ped.fleeT = 2.5;
            ped.speed = 4.2;
          }
        }
      }
      // Hit by the player's car: down, and the law takes notice.
      if (playerCar && !ped.hitDone && ped.state !== 'down') {
        const cd = dist2D(pos.x, pos.z, playerCar.group.position.x, playerCar.group.position.z);
        if (cd < 1.8 && Math.abs(playerCar.speed) > 5) {
          ped.hitDone = true;
          ped.state = 'down';
          ped.downT = 4;
          S.police.addStars(1, 'Pedestrian hit');
          S.hud.feed('Pedestrian hit! +1 star');
          S.audio.thud();
        }
      }
      ped.group.rotation.y = ped.yaw;
      ped.swing += ped.speed * dt * 2.4;
      const amp = 0.5;
      ped.figure.legL.rotation.x = Math.sin(ped.swing) * amp;
      ped.figure.legR.rotation.x = -Math.sin(ped.swing) * amp;
      ped.figure.armL.rotation.x = -Math.sin(ped.swing) * amp * 0.7;
      ped.figure.armR.rotation.x = Math.sin(ped.swing) * amp * 0.7;
    }
  }

  return { list, update, fleeFrom, scare };
}
