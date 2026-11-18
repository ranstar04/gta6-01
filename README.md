# SOLMARA

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ranstar04/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ranstar04/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original third-person open-world crime game for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Sun-soaked fictional
coastal city, six story missions, drivable and stealable cars, police wanted
levels, combat, taxi fares and ten golden shells — all offline, all synthesized
in the browser (three.js vendored locally, WebAudio synth, canvas textures).

## Play

Serve it locally and open it in a desktop browser:

```sh
node serve.ts --port 8901
# open http://127.0.0.1:8901/
```

You are **Rook Vega**, 28, ex-getaway driver back in Solmara after five years,
in debt to fixer **Mama Izzy**. Run her six jobs, lose Detective Mara Quinn's
cops, and take the crown from **Silas Kross**.

## Controls

- **WASD / arrows** — walk / drive · **Shift** — sprint · **Space** — jump / handbrake
- **Mouse** — look (click to lock) · **Click** — shoot · **F** — punch
- **E** — enter / steal car, pick up fares · **P / Esc** — pause · **M** — mute

Steal cars, run missions, grab taxi fares and golden shells. Lose the heat at
Fresh Coat — a repaint costs $150. Wanted stars decay when nobody can see you.

## Structure

- `game/index.html` — page, import map, canvas + HUD DOM, CSS.
- `game/src/main.js` — boot, fixed-step loop, screens, screenshot staging.
- `game/src/config.js` — tuning, palette, cars, mission table.
- `game/src/city.js` — the city: roads, buildings, beach, pier, marina, casino.
- `game/src/world.js` — road graph, traffic loops, sidewalk waypoints.
- `game/src/player.js` — Rook on foot: movement, camera, health.
- `game/src/vehicles.js` — car models, arcade driving, enter/exit/steal.
- `game/src/traffic.js` — AI cars on road loops. `game/src/pedestrians.js` — walkers.
- `game/src/police.js` — wanted stars, cruiser pursuit, BUSTED, spray shop.
- `game/src/combat.js` — pistol, punch, enforcers, pickups.
- `game/src/missions.js` — the M1–M6 chain, taxi fares, golden shells.
- `game/src/hud.js` — HUD DOM. `game/src/minimap.js` — canvas minimap.
- `game/src/render.js` — three.js scene, sun, sky, fog, clouds.
- `game/src/effects.js` — particles, muzzle flash, smoke, skid marks.
- `game/src/audio.js` — synthesized WebAudio: engine, siren, shots, music.
- `game/src/save.js` — localStorage save. `game/src/shots.js` — staged scenes.
