# SOLMARA — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ranstar04/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ranstar04/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

Rook Vega is back in Solmara after five years — in debt to Mama Izzy, who runs
the Gull & Anchor diner, and on the list of Silas Kross and his syndicate.
Drive, steal, run taxi fares, dodge the Solmara PD and take the city back,
one mission at a time, across six story missions in a sun-soaked coastal city:
the Old Harbor pier, downtown towers, colourful Calle Verde, Coral Strand beach
and the Golden Gull casino.

## How to play

Open `game/index.html` in a desktop browser (or serve the repo with
`node serve.ts` and open http://localhost:8080). No network needed; three.js
is vendored under `game/vendor/`, all audio is synthesized, all textures are
procedural.

- **On foot:** WASD move · Shift sprint · Space jump · Mouse look (click to lock)
- **Driving:** E enter / exit a car · WASD drive · Space handbrake
- **Combat:** Left click shoot · R reload · F punch
- **Other:** P / Esc pause · M mute

Stealing a car in view of the police raises your wanted level. Lose the tail,
or pay Fresh Coat garage $150 to clear it. Collect all 10 golden shells for a
bonus. Taxi fares pay by distance. Progress saves in the browser.

## Screenshots

1. `1-chase.jpg` — escaping the police in the Vesper GT, 3 wanted stars.
2. `2-street.jpg` — on foot on Calle Verde, pedestrians and traffic.
3. `3-mission.jpg` — "Storm the Pier": the shootout at the warehouse.
4. `4-title.jpg` — the title screen over the live city.

## Development

Serve and take the staged shots with the CDP driver, then build:

```
node serve.ts --port 8901
node ../tools/cdp-shot.mjs "http://127.0.0.1:8901/?shot=chase&seed=3" screenshots/1-chase.jpg "window.__shotReady" 120000
# … repeat for street, mission, title …
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node cli/makefun.mjs check --kit . --repo .
```

The shots are driven by `game/src/shots.js`: each scene plays the real rules
forward from a fresh seeded world. Keep the build honest — edit every game
file with the file tools, never through the shell.
