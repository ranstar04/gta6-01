// SOLMARA tuning: palette, city layout, cars, missions. One place for every number
// the rest of the game reads, so balance tweaks never touch system code.
export const CFG = {
  seed: 1,
  cityHalf: 186,
  roadWidth: 12,
  roads: [-150, -90, -30, 30, 90, 150],
  groundSize: 2400,
  beachX: -186,
  oceanX: -235,
  fogColor: 0xffc890,
  fogNear: 130,
  fogFar: 720,
  skyTop: 0x6ea8e0,
  skyBottom: 0xffc890, // same as fogColor: the horizon melts into haze, never wash-out
  sunColor: 0xffe3b0,
  sunPos: [190, 230, -150],
  dayStart: 16.5, // 16:30, late afternoon
  playerWalk: 7,
  playerSprint: 11,
  playerJump: 8.5,
  gravity: 24,
  maxHealth: 100,
  startMoney: 250,
  pistolMag: 12,
  pistolDamage: 34,
  punchDamage: 25,
  punchRange: 2.4,
  sprayCost: 150,
  shellBonus: 500,
  taxiBase: 40,
  taxiPerMetre: 0.6,
  bustedFine: 200,
  wastedFine: 150,
  chaseCruiseSpeed: 26, // staged chase shot: caps the Vesper so the cruisers hold their gap
};

export const PALETTE = {
  asphalt: 0x33333a,
  sidewalk: 0x9a938a,
  ground: 0x8a7f6d,
  sand: 0xe2c88f,
  ocean: 0x2e7f9e,
  downtown: [0x8d99ae, 0x6d7d94, 0xa8b0bf, 0x7d8ba0],
  verde: [0xe07a5f, 0xf2c14e, 0x81b29a, 0xf4a261, 0xe76f51, 0x3d8bfd],
  harbor: [0x9c6644, 0x7f5539, 0xb08968, 0x6c584c],
  terrace: [0xf1e3c6, 0xe8dcc8, 0xdcc7a8, 0xcbb59a],
  roof: 0x4a4440,
  windowLit: 0xffd97a,
  windowDark: 0x2b3542,
  palmTrunk: 0x8a6b48,
  palmLeaf: 0x3f8f4f,
};

export const CAR_TYPES = {
  vesper: { name: 'Vesper GT', top: 44, accel: 27, brake: 34, steer: 0.55, len: 4.4, wid: 2.0, color: 0xc0392b, price: 0 },
  alba: { name: 'Alba', top: 33, accel: 19, brake: 30, steer: 0.5, len: 4.2, wid: 1.9, color: 0x2e6fb0, price: 0 },
  corto: { name: 'Corto Taxi', top: 31, accel: 18, brake: 30, steer: 0.5, len: 4.2, wid: 1.9, color: 0xf2c200, price: 0, taxi: true },
  bruto: { name: 'Bruto', top: 25, accel: 13, brake: 24, steer: 0.38, len: 6.6, wid: 2.4, color: 0x7a5a34, price: 0, truck: true },
  vela: { name: 'Vela Van', top: 29, accel: 15, brake: 26, steer: 0.42, len: 5.0, wid: 2.1, color: 0xe8e4da, price: 0 },
  patrol: { name: 'Patrol Interceptor', top: 39, accel: 25, brake: 36, steer: 0.58, len: 4.4, wid: 2.0, color: 0x16161e, price: 0, police: true },
};

export const CAR_COLORS = [0xc0392b, 0x2e6fb0, 0x27ae60, 0xe67e22, 0x8e44ad, 0xe8e4da, 0x222222, 0x7f8c8d, 0xd35400];

// Mission chain: each step is a place to reach, a thing to collect, a car to
// steal, a wanted level to lose, or enemies to clear. Places are named in city.js.
export const MISSIONS = [
  {
    id: 'm1', name: 'Homecoming', reward: 300,
    brief: 'Rook is back in Solmara after five years. Mama Izzy is waiting at the Gull & Anchor diner. Get there.',
    steps: [{ type: 'goto', place: 'diner', text: 'Drive to the Gull & Anchor diner' }],
  },
  {
    id: 'm2', name: 'The Pickup', reward: 500,
    brief: 'Izzy needs a package from the marina, no questions asked. Grab it and bring it back to the diner. Keep it quiet.',
    steps: [
      { type: 'goto', place: 'marina', text: 'Collect the package at the marina' },
      { type: 'goto', place: 'diner', text: 'Deliver the package to Izzy' },
    ],
  },
  {
    id: 'm3', name: 'Hot Pursuit', reward: 700,
    brief: 'Detective Mara Quinn put a tail on you. Lose the heat — get the wanted level down — then slip to the safehouse.',
    steps: [
      { type: 'heat', stars: 2, text: 'Lose the 2-star wanted level' },
      { type: 'goto', place: 'safehouse', text: 'Reach the safehouse' },
    ],
  },
  {
    id: 'm4', name: 'Heavy Load', reward: 900,
    brief: 'Kross keeps a Bruto truck at the docks. Take it — any way you can — and park it at the pier warehouse.',
    steps: [
      { type: 'steal', car: 'bruto', place: 'docks', text: 'Steal the Bruto truck at the docks' },
      { type: 'goto', place: 'warehouse', text: 'Deliver the truck to the pier warehouse' },
    ],
  },
  {
    id: 'm5', name: 'Storm the Pier', reward: 1200,
    brief: 'Kross enforcers hold the warehouse. Clear them out. Izzy is counting on you — and so is the whole harbor.',
    steps: [
      { type: 'goto', place: 'warehouse', text: 'Reach the pier warehouse' },
      { type: 'clear', count: 6, place: 'warehouse', text: 'Clear the Kross enforcers (0/6)' },
    ],
  },
  {
    id: 'm6', name: 'The Golden Gull', reward: 2000,
    brief: 'The show car — a red Vesper GT — sits in front of the Golden Gull casino. Steal it and run it to the chop shop. The whole city will be watching.',
    steps: [
      { type: 'steal', car: 'vesper', place: 'casino', text: 'Steal the Vesper GT at the casino' },
      { type: 'goto', place: 'chopshop', text: 'Deliver the Vesper to the chop shop' },
    ],
  },
];

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  mute: ['KeyM'],
  pause: ['KeyP', 'Escape'],
};
