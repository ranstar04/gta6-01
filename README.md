# SOLMARA — a sun-soaked open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ranstar04/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ranstar04/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for [make.fun gta6-01 — Make GTA 6](https://make.fun). An original third-person
open-world crime game in a fictional coastal city. Nothing here is from Rockstar.

## The story

Rook Vega, 28, ex-getaway driver, is back in Solmara after five years — in debt to
fixer Mama Izzy, who runs the Gull & Anchor diner and hands out the jobs. Detective
Mara Quinn is watching. Silas Kross and his syndicate own the pier. Six missions stand
between Rook and the title of SOLMARA KINGPIN.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no install — three.js is vendored locally.

| Input | Action |
|---|---|
| WASD / Arrows | Move on foot / drive |
| Mouse (click to lock) | Look around |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Enter, steal, or exit a car |
| Click | Shoot the pistol |
| F | Punch |
| R | Reload |
| P | Pause |
| M | Mute |

## Systems

- **Open city** — Old Harbor, Downtown towers, colorful Calle Verde, Coral Strand
  beach, Palm Terrace, the Golden Gull casino, and the ocean on the west edge.
- **Driving** — six original cars (Vesper GT, Alba, Corto taxi, Bruto truck, Vela
  van, Patrol Interceptor). Steal any of them; stealing in view raises your wanted
  level.
- **Wanted 0–5 stars** — police cruisers chase and ram; foot officers appear at
  3+ stars. Lose the tail, or pay $150 at the Fresh Coat garage to clear it.
- **Missions M1–M6** — Homecoming, The Pickup, Hot Pursuit, Heavy Load, Storm the
  Pier, The Golden Gull. Briefings, waypoint beacons, minimap markers, rewards.
- **Combat** — pistol with raycast shooting, punch, Kross enforcers with health
  bars, health/ammo pickups.
- **Activities** — taxi fares that pay by distance, and 10 golden shells hidden
  around the city ($500 bonus for all ten).
- **HUD + minimap** — health, money, stars, clock, weapon, objective, speedometer,
  message feed, and a live top-down map.
- **Audio** — fully synthesized WebAudio: engine hum, two-tone sirens, gunshots,
  jingles, and an original chord loop. No audio files.
- **Save** — progress (money, missions, shells) autosaves to localStorage.

## Screenshots

Four staged shots (see `shots.json`): the Vesper GT chase at 3 stars, a walk
down Calle Verde, the M5 pier shootout, and the title screen over the live
city. Each shot is a real seeded game state played forward by the update loop —
no staged render, the frame is the game mid-play.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `dossier.json` via the vendored make.fun library.
