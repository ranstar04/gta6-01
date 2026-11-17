// SOLMARA — tuning numbers, palette, key bindings, mission table.
// Every number the game balances on lives here so the other files stay readable.
export const WORLD = {
  // City grid: avenues run north-south (along Z) at these X, streets east-west at these Z.
  avenues: [-120, -80, -40, 0, 40, 80, 120],
  streets: [-120, -80, -40, 0, 40, 80, 120],
  roadHalf: 5, // half-width of a road
  bound: 165, // playable edge; beach/ocean begins west of x = -170
  oceanX: -172,
  block: 30, // block cell size between roads
};

export const PALETTE = {
  skyTop: 0x2f6fb8,
  skyBottom: 0xffd9a0,
  sun: 0xffe3b0,
  fog: 0xf2c98f,
  asphalt: 0x3a3f46,
  sidewalk: 0x9a938a,
  sand: 0xe8cf9e,
  ocean: 0x1e7fa8,
  oceanDeep: 0x0d4d6e,
  grass: 0x7fae5a,
  buildingDowntown: 0x8d99ae,
  buildingBrick: 0xb0705a,
  buildingPastel: 0xe8b4a0,
  palm: 0x3f7d44,
  trunk: 0x7a5a3a,
  carVesper: 0xd7263d, // Vesper GT sports, red
  carAlba: 0x4a7fb5, // Alba sedan, blue
  carCorto: 0xf2b705, // Corto taxi, yellow
  carBruto: 0x6b7c5e, // Bruto truck, olive
  carVela: 0xe8e4da, // Vela van, white
  carPolice: 0x1b2a4a, // Patrol Interceptor, dark navy
  playerShirt: 0x2e8b6a,
  playerPants: 0x2b2d42,
};

// Player / car tuning.
export const TUNE = {
  walkSpeed: 7,
  sprintSpeed: 11,
  jumpSpeed: 8,
  gravity: 22,
  carAccel: 26,
  carBrake: 42,
  carReverse: 12,
  carMaxSpeed: 46, // Vesper GT
  carMaxSpeedSlow: 30,
  carSteer: 1.9,
  carGrip: 6,
  trafficCount: 14,
  pedCount: 24,
  policeRamSpeed: 34,
  wantedDecay: 0.12, // stars per second while unseen
  wantedPerSteal: 1,
  wantedPerPedHit: 1,
  wantedPerShot: 0.4,
  wantedPerCopKill: 1,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolReserve: 60,
  enemyHealth: 100,
  playerHealth: 100,
  healthRegen: 2.5,
  taxiBase: 25,
  taxiPerMetre: 0.35,
  shellBonus: 250,
  repaintCost: 150,
  bustFine: 200,
};

// Key bindings (KeyboardEvent.code).
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  enterCar: ['KeyE'],
  handbrake: ['Space'],
  shoot: ['Mouse0'],
  punch: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  interact: ['KeyE'],
};

// The story chain. Each mission: id, name, briefing, target point, reward.
// Targets are world positions; the waypoint beacon + minimap marker point at them.
export const MISSIONS = [
  {
    id: 1, name: 'Homecoming', pay: 200,
    brief: 'Mama Izzy is waiting at the Gull & Anchor diner. Drive over and say hello.',
    objective: 'Reach the Gull & Anchor diner',
    target: { x: 52, z: -92 }, targetLabel: 'Gull & Anchor',
  },
  {
    id: 2, name: 'The Pickup', pay: 450,
    brief: 'A package is waiting at the marina. Pick it up and bring it back to Izzy. Keep it quiet.',
    objective: 'Collect the package at the marina',
    target: { x: -138, z: 96 }, targetLabel: 'Marina package',
  },
  {
    id: 3, name: 'Hot Pursuit', pay: 600,
    brief: 'Kross tipped off the cops. You are at 2 stars — lose the tail and reach the safehouse.',
    objective: 'Lose the police, reach the safehouse',
    target: { x: 118, z: 118 }, targetLabel: 'Safehouse',
  },
  {
    id: 4, name: 'Heavy Load', pay: 800,
    brief: 'Steal a Bruto truck from the docks and deliver it to the pier warehouse. No questions.',
    objective: 'Steal a Bruto truck, deliver to the pier',
    target: { x: -140, z: -40 }, targetLabel: 'Pier warehouse',
  },
  {
    id: 5, name: 'Storm the Pier', pay: 1200,
    brief: 'Kross enforcers hold the warehouse. Clear them out. Izzy is counting on you.',
    objective: 'Clear the warehouse of enforcers',
    target: { x: -140, z: -40 }, targetLabel: 'Pier warehouse',
  },
  {
    id: 6, name: 'The Golden Gull', pay: 2000,
    brief: 'The show car — a cherry Vesper GT — sits outside the casino. Take it. Deliver it to the chop shop.',
    objective: 'Steal the Vesper GT, deliver to the chop shop',
    target: { x: 118, z: -118 }, targetLabel: 'Chop shop',
  },
];

export const SHELLS = [
  { x: -150, z: 40 }, { x: -152, z: -100 }, { x: 60, z: 130 },
  { x: -60, z: 130 }, { x: 130, z: 60 }, { x: -100, z: -130 },
  { x: 20, z: -140 }, { x: -20, z: 140 }, { x: 140, z: -60 },
  { x: 100, z: 100 },
];

export const SPAWNS = {
  player: { x: 10, z: 10 },
  diner: { x: 52, z: -92 },
  marina: { x: -138, z: 96 },
  safehouse: { x: 118, z: 118 },
  pier: { x: -140, z: -40 },
  casino: { x: 100, z: -60 },
  chopShop: { x: 118, z: -118 },
  garage: { x: -60, z: 60 },
  station: { x: 0, z: 140 },
};
