# SOLMARA — Make GTA 6 (gta6-01)

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/ranstar04/gta6-01/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/ranstar04/gta6-01/reward.svg)](https://make.fun)

**SOLMARA** is a third-person open-world crime game in a sun-soaked fictional coastal
city. Rook Vega is back in Solmara after five years — in debt to Mama Izzy, hunted by
Detective Mara Quinn, and one job away from freedom. Steal cars, dodge the law, run
six missions, and take the city back from Silas Kross.

## How to play

Open `game/index.html` in a desktop browser (or serve the folder with `node serve.ts`
and open http://localhost:8080). No network needed — three.js is vendored locally and
all audio is synthesized in the browser.

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Sprint |
| Space | Jump / handbrake |
| Mouse | Look (click to lock the pointer) |
| Click | Shoot the pistol |
| F | Punch |
| E | Enter / steal a car |
| Esc / P | Pause |
| M | Mute |

## What's in the city

- **Open world**: five districts (Old Harbor, Downtown, Calle Verde, Coral Strand,
  Palm Terrace), a marina, a pier, a casino, a beach and an ocean — all procedural,
  no two buildings alike.
- **Driving**: six original cars (Vesper GT, Alba, Corto taxi, Bruto truck, Vela van,
  Patrol Interceptor) with arcade physics, damage and smoke. Steal any parked car —
  jacking one in front of witnesses raises your wanted level.
- **Wanted 0–5 stars**: police cruisers chase and ram you, foot officers join at 3+
  stars. Get BUSTED if they pin you, or clear the heat at Fresh Coat garage ($150).
- **Combat**: pistol with ammo pickups, punching, gang enforcers with health bars.
- **Six story missions** for Mama Izzy — deliveries, a hot pursuit, a truck heist, a
  pier shootout, and stealing the show car from the Golden Gull casino.
- **Side activities**: taxi fares in a Corto, and 10 golden shells hidden around the
  city ($250 each).
- **HUD + minimap**: health, money, wanted stars, ammo, objective, in-game clock,
  speedometer, message feed, and a live top-down minimap with traffic, police and
  mission markers.
- **Save**: progress (money, missions, shells) autosaves to localStorage.

## Tech

- three.js (vendored `three.module.min.js`, no CDN), plain ES modules, static files.
- Fixed 1/60 s simulation step; seeded RNG so the world is deterministic.
  Append `?seed=N` to the page URL to reproduce the exact same world (traffic,
  pedestrians, parked cars, shells); without it a random seed is used.
- Staged screenshots are produced by `game/src/shots.js` (`?shot=chase|street|mission|title`),
  which plays the real rules forward from a fresh seeded world.

All names, characters, story, art and sound are original. Nothing from Rockstar.
