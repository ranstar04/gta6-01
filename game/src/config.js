// SOLMARA — every tuning number, colour and story beat in one place.
// The city is a 600x600 grid (x,z in [-300,300]) with roads every 120 units;
// the ocean lies west of x=-300. Late-afternoon sun, warm light, long shadows.
export const STEP = 1 / 60;
export const CITY = { half: 300, roadGap: 120, roadWidth: 14, block: 106 };
export const ROADS = [-240, -120, 0, 120, 240]; // avenue/street centre lines
export const OCEAN_X = -300; // west edge of the land

export const PALETTE = {
  skyTop: '#5ea9dd', skyBottom: '#ffd9a0', fog: '#eec39a',
  sun: '#ffd9a8', hemiSky: '#bcd8ff', hemiGround: '#8a6f52',
  asphalt: '#3a3f46', sidewalk: '#b8a88f', sand: '#e8d5a3', ocean: '#2e7f9e',
  grass: '#7fae62', building: ['#e8b48c', '#f2d8a0', '#9fc8c0', '#d98c8c', '#c9b8e0', '#f0ead8'],
  glass: '#7fb8d8', gold: '#f2c94c', coral: '#ff7f6b', teal: '#2e8b8b',
  policeBlue: '#2e5fd8', policeWhite: '#f0f0f0', taxiYellow: '#ffd21f',
};

export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 9.5, jumpSpeed: 8, gravity: 22,
  radius: 0.6, height: 1.8, healthMax: 100, regenPerSec: 2.5,
};

export const CAR = {
  accel: 22, brake: 34, reverseAccel: 12, maxSpeed: 38, maxReverse: 10,
  steerMax: 0.55, grip: 6, handbrakeGrip: 1.2, drag: 0.35,
  radius: 2.2, damagePerHit: 12,
};

// Original cars of Solmara. type: handling flavour + colour + size.
export const CAR_TYPES = {
  vesper: { name: 'Vesper GT', color: '#c02030', length: 4.6, width: 1.9, accel: 26, maxSpeed: 42, steer: 0.5, sport: true },
  alba: { name: 'Alba', color: '#4a7fb5', length: 4.4, width: 1.85, accel: 20, maxSpeed: 34, steer: 0.55 },
  corto: { name: 'Corto Taxi', color: '#ffd21f', length: 4.3, width: 1.85, accel: 19, maxSpeed: 33, steer: 0.55, taxi: true },
  bruto: { name: 'Bruto', color: '#7a5c38', length: 6.2, width: 2.3, accel: 14, maxSpeed: 28, steer: 0.42, truck: true },
  vela: { name: 'Vela', color: '#7fae62', length: 5.0, width: 2.0, accel: 17, maxSpeed: 31, steer: 0.5, van: true },
  interceptor: { name: 'Interceptor', color: '#f0f0f0', length: 4.7, width: 1.95, accel: 24, maxSpeed: 40, steer: 0.52, police: true },
};

export const WANTED = {
  decayPerSec: 0.06, // stars lost per second while unseen
  maxStars: 5, cruiserPerStar: 1, footCopsAt: 3,
  stealSeen: 1, hitPed: 1, shootSeen: 1, killCop: 2,
};

export const COMBAT = {
  pistolDamage: 34, pistolRange: 90, magSize: 12, reloadSec: 1.1,
  punchDamage: 20, punchRange: 2.2, enemyHealth: 100, enemyDamage: 8,
  enemyShootInterval: 1.4, enemyAccuracy: 0.35,
};

export const MISSIONS = [
  { id: 1, name: 'Homecoming', brief: 'Mama Izzy wants you at the Gull & Anchor diner. Drive over and say hello.', reward: 200,
    stages: [{ kind: 'goto', at: 'diner', text: 'Drive to the Gull & Anchor diner' }] },
  { id: 2, name: 'The Pickup', brief: 'A package waits at the marina. Collect it, bring it to Izzy — and keep your nose clean.', reward: 350,
    stages: [{ kind: 'goto', at: 'marina', text: 'Collect the package at the marina' },
             { kind: 'goto', at: 'diner', text: 'Deliver the package to Mama Izzy' }] },
  { id: 3, name: 'Hot Pursuit', brief: 'Kross tipped off the cops. Lose the 2-star heat and get to the safehouse.', reward: 400,
    stages: [{ kind: 'wanted', stars: 2, text: 'The cops are onto you — 2 stars!' },
             { kind: 'escape', at: 'safehouse', text: 'Lose the tail and reach the safehouse' }] },
  { id: 4, name: 'Heavy Load', brief: 'A Bruto truck full of "cargo" sits at the docks. Take it to the pier warehouse.', reward: 500,
    stages: [{ kind: 'steal', car: 'bruto', at: 'docks', text: 'Steal the Bruto truck at the docks' },
             { kind: 'deliver', car: 'bruto', at: 'warehouse', text: 'Deliver the truck to the pier warehouse' }] },
  { id: 5, name: 'Storm the Pier', brief: 'Kross enforcers hold the warehouse. Clear them out — all of them.', reward: 600,
    stages: [{ kind: 'goto', at: 'warehouse', text: 'Reach the pier warehouse' },
             { kind: 'clear', count: 6, at: 'warehouse', text: 'Clear the warehouse of enforcers (0/6)' }] },
  { id: 6, name: 'The Golden Gull', brief: 'The casino show car — a red Vesper GT — is yours tonight. Take it to the chop shop at 3 stars.', reward: 800,
    stages: [{ kind: 'steal', car: 'vesper', at: 'casino', text: 'Steal the Vesper GT show car at the casino' },
             { kind: 'deliver', car: 'vesper', at: 'chopshop', text: 'Deliver the Vesper to the chop shop' }] },
];

export const TAXI = { farePerMetre: 0.35, minFare: 25, tipChance: 0.3 };
export const SHELLS = { total: 10, bonus: 50 };
export const SPRAY = { cost: 150 }; // Fresh Coat repaint clears wanted

export const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], handbrake: ['Space'],
  interact: ['KeyE'], punch: ['KeyF'], pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'], mute: ['KeyM'],
};

export const SAVE_KEY = 'solmara.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
