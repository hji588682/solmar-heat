// Solmar Heat — player.js
// The on-foot player: walking / running, entering and leaving cars,
// and stealing them. Driving physics lives in driving.js; this file
// owns the person, not the vehicle.

import { clamp, dist } from './utils.js';
import { WORLD, hitBuilding, resolveBuilding, isOnRoad, isWater } from './city.js';
import { isDown } from './input.js';

export const WALK_SPEED = 150;
export const RUN_SPEED = 250;

export function createPlayer(city) {
  const s = city.poi.playerStart;
  return {
    x: s.x, y: s.y,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    car: null,           // the car the player is driving, or null
    health: 100,
    maxHealth: 100,
    money: 120,
    ammo: 24,
    aimAngle: -Math.PI / 2,
    invuln: 0,           // brief grace period after being hurt
    bustedTimer: 0,
    moving: false,
    stepPhase: 0,
  };
}

// Find the nearest car the player could enter (parked, empty, or with a
// driver to drag out). Returns { car, d } or null.
export function nearestEnterableCar(G, maxD = 60) {
  let best = null;
  let bestD = maxD;
  for (const c of G.cars) {
    if (c.wrecked || c === G.player.car) continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? { car: best, d: bestD } : null;
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'ai') {
    // Drag the driver out: they run away, and stealing in sight of a
    // cop raises the wanted level.
    car.driver = 'none';
    const ped = {
      x: car.x + Math.cos(car.angle + Math.PI / 2) * 30,
      y: car.y + Math.sin(car.angle + Math.PI / 2) * 30,
      angle: car.angle, speed: 0, state: 'flee',
      fleeX: car.x, fleeY: car.y, color: '#e8b04b', panic: 3,
    };
    G.peds.push(ped);
    G.addText(car.x, car.y - 30, '偷车！', '#ffd24a');
    G.audio.steal();
    if (G.nearCop(520)) G.raiseWanted(1, 'steal');
    else G.raiseWanted(0, 'steal');
    G.stats.stolen++;
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.audio.blip(440, 0.08, 'square', 0.12, 660);
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'none';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.x = clamp(p.x, 12, WORLD.w - 12);
  p.y = clamp(p.y, 12, WORLD.h - 12);
  p.angle = car.angle;
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let mx = 0;
  let my = 0;
  if (isDown(input, 'w', 'ArrowUp')) my -= 1;
  if (isDown(input, 's', 'ArrowDown')) my += 1;
  if (isDown(input, 'a', 'ArrowLeft')) mx -= 1;
  if (isDown(input, 'd', 'ArrowRight')) mx += 1;
  const run = isDown(input, 'Shift');
  const sp = run ? RUN_SPEED : WALK_SPEED;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    p.x += mx * sp * dt;
    p.y += my * sp * dt;
    p.angle = Math.atan2(my, mx);
    p.stepPhase += dt * (run ? 14 : 9);
  }
  p.x = clamp(p.x, 14, WORLD.w - 14);
  p.y = clamp(p.y, 14, WORLD.h - 14);
  // Can't walk into the sea or through buildings.
  if (isWater(p.x, p.y, G.city)) {
    p.y = G.city.zones.ocean.y - 16;
  }
  const pushed = resolveBuilding(p.x, p.y, 12, G.city);
  if (pushed) { p.x = pushed.x; p.y = pushed.y; }

  // Aim follows the mouse (world coordinates).
  const m = input.mouse;
  p.aimAngle = Math.atan2(m.wy - p.y, m.wx - p.x);

  if (p.invuln > 0) p.invuln -= dt;
  // Slow health regen out of combat.
  if (p.health < p.maxHealth && G.time - G.lastHurtAt > 6) {
    p.health = Math.min(p.maxHealth, p.health + 4 * dt);
  }

  // Pickups: walk over ammo / health.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'ammo') {
        p.ammo += 24;
        G.addText(p.x, p.y - 24, '+24 子弹', '#8fe388');
      } else if (pk.kind === 'money') {
        p.money += 50;
        G.addText(p.x, p.y - 24, '+$50', '#ffd24a');
      } else {
        p.health = Math.min(p.maxHealth, p.health + 50);
        G.addText(p.x, p.y - 24, '+50 生命', '#ff8f8f');
      }
      G.audio.pickup();
      G.particles.push(...G.burst(pk.x, pk.y, pk.kind === 'ammo' ? '#8fe388' : '#ff8f8f', 10));
    }
  }
}

// Hurt the player (enemy bullet, explosion). Returns true if it killed them.
export function hurtPlayer(G, amount, srcX, srcY) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'play') return false;
  p.health -= amount;
  p.invuln = 0.35;
  G.lastHurtAt = G.time;
  G.shake = Math.min(10, G.shake + 5);
  G.audio.blip(140, 0.15, 'sawtooth', 0.2, 70);
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}
