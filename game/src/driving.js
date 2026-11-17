// Solmar Heat — driving.js
// Car physics for every vehicle: arcade handling with speed-sensitive
// steering, handbrake slides, skid marks, and collisions with buildings,
// other cars, pedestrians and the sea wall.

import { clamp, dist, angDiff, circleRect } from './utils.js';
import { WORLD, hitBuilding, resolveBuilding, isWater } from './city.js';
import { isDown } from './input.js';
import { exitCar } from './player.js';

export const CAR_TOP_SPEED = 430;   // px/s, sports car
export const CAR_ACCEL = 320;
export const CAR_BRAKE = 520;
export const CAR_REVERSE = 170;

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#7dd93d', '#d9d9d9', '#8a5fd9', '#e88f3a', '#3db5b5'];
export const CAR_KINDS = ['sedan', 'sedan', 'sport', 'taxi', 'truck', 'sedan', 'sport'];

export function makeCar(x, y, angle, opts = {}) {
  const kind = opts.kind || 'sedan';
  return {
    x, y, angle,
    speed: 0,
    kind,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    driver: opts.driver || 'none',   // 'player' | 'ai' | 'cop' | 'none'
    len: kind === 'truck' ? 62 : kind === 'sport' ? 46 : 50,
    wid: kind === 'truck' ? 26 : 24,
    health: 100,
    wrecked: false,
    smoking: false,
    topSpeed: kind === 'sport' ? CAR_TOP_SPEED : kind === 'truck' ? 320 : 380,
    ai: null,          // traffic brain (traffic.js) or cop brain (police.js)
    missionCar: !!opts.missionCar,
    id: opts.id || 0,
    skid: 0,
  };
}

// One physics step for a single car. `ctrl` is {throttle, brake, steer,
// handbrake} for the player; AI drivers fill it from their own brains.
export function stepCar(G, car, dt, ctrl) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    return;
  }
  const accel = CAR_ACCEL * (car.kind === 'sport' ? 1.25 : 1);
  if (ctrl.throttle) car.speed += accel * dt;
  if (ctrl.brake) {
    if (car.speed > 10) car.speed -= CAR_BRAKE * dt;
    else car.speed -= accel * 0.6 * dt; // reverse
  }
  if (!ctrl.throttle && !ctrl.brake) {
    // Engine braking / rolling drag.
    car.speed -= Math.sign(car.speed) * 90 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE, car.topSpeed);

  // Steering: less bite at high speed, more at low speed; handbrake
  // loosens the rear and drops speed.
  const spd = Math.abs(car.speed);
  const steerRate = clamp(2.6 - spd / 260, 1.1, 2.6);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += ctrl.steer * steerRate * (spd / 120 + 0.25) * dt * dir;
  if (ctrl.handbrake && spd > 60) {
    car.angle += ctrl.steer * 1.6 * dt * dir;
    car.speed -= Math.sign(car.speed) * 260 * dt;
    car.skid += dt;
    if (car.skid > 0.05) {
      car.skid = 0;
      G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 1 });
      if (Math.random() < 0.5) {
        G.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#bbbbbb', size: 7, smoke: true });
      }
    }
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(nx, 20, WORLD.w - 20);
  car.y = clamp(ny, 20, WORLD.h - 20);

  // Buildings are solid: bounce off them, lose speed, take damage.
  const hit = hitBuilding(car.x, car.y, car.len / 2 - 2, G.city);
  if (hit) {
    const pushed = resolveBuilding(car.x, car.y, car.len / 2 - 2, G.city);
    if (pushed) { car.x = pushed.x; car.y = pushed.y; }
    if (Math.abs(car.speed) > 120) {
      damageCar(G, car, 12);
      G.audio.crash();
      G.shake = Math.min(12, G.shake + 4);
      G.particles.push(...G.burst(car.x, car.y, '#ffcf5e', 8));
    }
    car.speed *= -0.25;
  }
  // The sea stops cars at the beach edge.
  if (isWater(car.x, car.y, G.city)) {
    car.y = G.city.zones.ocean.y - car.len / 2;
    car.speed *= -0.2;
  }
}

// Player driving input -> control object.
export function playerDriveControls(G) {
  const input = G.input;
  let steer = 0;
  if (isDown(input, 'a', 'ArrowLeft')) steer -= 1;
  if (isDown(input, 'd', 'ArrowRight')) steer += 1;
  return {
    throttle: isDown(input, 'w', 'ArrowUp'),
    brake: isDown(input, 's', 'ArrowDown'),
    steer,
    handbrake: isDown(input, ' '),
  };
}

// Damage a car; at 0 health it becomes a smoking wreck.
export function damageCar(G, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 55) car.smoking = true;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    G.particles.push(...G.burst(car.x, car.y, '#ff7a3c', 22));
    G.particles.push(...G.burst(car.x, car.y, '#555555', 14));
    G.audio.noise(0.5, 0.4, 700);
    G.shake = Math.min(14, G.shake + 6);
    if (car.driver === 'player') {
      // The player is thrown out of a wrecked car.
      exitCar(G);
      G.addText(car.x, car.y - 34, '车毁了！', '#ff6b5e');
    }
    if (car.missionCar) G.missionCarWrecked = true;
  }
}

// Car vs car: simple circle push-apart with speed exchange.
export function collideCars(G, a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = (a.len + b.len) / 2 - 10; // a little slack: kerb-parked cars sit 44 px from the lane
  if (d >= min || d === 0) return;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  const overlap = (min - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 90) {
    G.audio.crash();
    G.particles.push(...G.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffcf5e', 6));
    if (a.driver === 'player' || b.driver === 'player') {
      const other = a.driver === 'player' ? b : a;
      damageCar(G, other, 6);
      if (other.driver === 'cop') G.raiseWanted(1, 'ram-cop');
      G.shake = Math.min(10, G.shake + 3);
    }
  }
  // Exchange a little speed so a ram actually shoves the other car.
  const tmp = a.speed;
  a.speed = a.speed * 0.6 + b.speed * 0.3;
  b.speed = b.speed * 0.6 + tmp * 0.3;
}
