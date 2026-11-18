// SOLMARA — every number that shapes how the city plays, in one place.
// Distances are meters, speeds are m/s, angles are radians, money is dollars.
// The city is a road grid: avenues run north-south and streets east-west at the
// coordinates in ROADS, so any system can ask "which road am I on?" cheaply.

export const STEP = 1 / 60;
export const WORLD = {
  groundSize: 1200,
  cityHalf: 200,
  oceanEdge: -220,
  beachEdge: -180,
  seaLevel: -0.6,
};

export const ROADS = [-160, -80, 0, 80, 160];
export const ROAD_WIDTH = 12;
export const BLOCK = 68;

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  jumpSpeed: 7.5,
  radius: 0.55,
  height: 1.8,
  health: 100,
  regenPerSec: 2.5,
  regenDelay: 6,
};

export const CARS = {
  vesper: { label: 'Vesper GT', color: 0xc22e2e, topSpeed: 42, accel: 17, brake: 34, length: 4.6, width: 2.0, price: 0 },
  alba: { label: 'Alba', color: 0x2e6fc2, topSpeed: 30, accel: 13, brake: 30, length: 4.4, width: 1.9, price: 0 },
  corto: { label: 'Corto Taxi', color: 0xe8b400, topSpeed: 28, accel: 12, brake: 30, length: 4.4, width: 1.9, price: 0 },
  bruto: { label: 'Bruto Truck', color: 0x3d7a3d, topSpeed: 22, accel: 9, brake: 26, length: 6.4, width: 2.3, price: 0 },
  vela: { label: 'Vela Van', color: 0xd8d8d8, topSpeed: 26, accel: 11, brake: 28, length: 5.0, width: 2.1, price: 0 },
  cruiser: { label: 'Patrol Interceptor', color: 0x14181f, topSpeed: 38, accel: 16, brake: 34, length: 4.8, width: 2.0, price: 0 },
};

export const WANTED = {
  stealSeen: 1,
  hitPed: 1,
  shootSeen: 0.5,
  killCop: 2,
  decayPerSec: 0.06,
  decayDelay: 8,
  maxCruisers: 4,
  sprayCost: 150,
  bustedFine: 200,
  wastedFine: 100,
};

export const COMBAT = {
  pistolDamage: 34,
  magSize: 12,
  reloadSec: 1.1,
  range: 70,
  meleeDamage: 20,
  meleeRange: 2.2,
  enemyHealth: 100,
  enemyShotDelay: 1.4,
  enemyHitChance: 0.24,
  enemyDamage: 9,
};

export const MISSIONS = [
  { id: 'm1', name: 'Homecoming', reward: 300, briefing: 'Mama Izzy is waiting at the Gull & Anchor diner. Get there.', target: { x: -40, z: 40 }, radius: 8 },
  { id: 'm2', name: 'The Pickup', reward: 450, briefing: 'Collect the package at the marina, then bring it to Izzy.', target: { x: -40, z: -168 }, radius: 8 },
  { id: 'm3', name: 'Hot Pursuit', reward: 600, briefing: 'The heat is on. Lose the tail and reach the safehouse on Calle Verde.', target: { x: 40, z: 168 }, radius: 8 },
  { id: 'm4', name: 'Heavy Load', reward: 800, briefing: 'Steal the Bruto truck from the docks and deliver it to the pier warehouse.', target: { x: -176, z: 56 }, radius: 9 },
  { id: 'm5', name: 'Storm the Pier', reward: 1200, briefing: 'Clear the Kross enforcers out of the warehouse.', target: { x: -150, z: 72 }, radius: 14 },
  { id: 'm6', name: 'The Golden Gull', reward: 1500, briefing: 'Steal the Vesper GT show car from the casino and deliver it to the chop shop — at 3 stars.', target: { x: 168, z: 120 }, radius: 9 },
];

export const SHELLS = [
  { x: -196, z: -120 }, { x: -196, z: 120 }, { x: -120, z: -176 }, { x: 120, z: -176 },
  { x: 176, z: -40 }, { x: 176, z: 160 }, { x: -40, z: 176 }, { x: 40, z: -120 },
  { x: -160, z: 0 }, { x: 80, z: 80 },
];
export const SHELL_BONUS = 250;

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyBottom: 0xf7c98a,
  fog: 0xf2c184,
  sun: 0xffd9a0,
  ground: 0x8a7a5c,
  cityGround: 0x55504a,
  road: 0x2c2f36,
  sidewalk: 0x8f8a80,
  ocean: 0x1d6f8f,
  sand: 0xd9c08a,
  text: '#f5efe4',
  gold: '#f2c94c',
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  enter: ['KeyE'],
  reload: ['KeyR'],
  melee: ['KeyF'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};

export const SAVE_KEY = 'solmara.save.v1';
export const START_MONEY = 120;
export const START_POS = { x: -52, z: 52 };

/** Staged-shot camera tuning: the chase cover sits higher and further ahead
 *  than the play camera, so the road never swallows the frame. */
export const SHOT = {
  chaseCamDist: 20,
  chaseCamHeight: 7,
  followDist: 6.5,
  followHeight: 2.8,
};
