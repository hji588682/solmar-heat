// Solmar Heat — pedestrians.js
// People of Solmar: they stroll the sidewalks, cross at intersections,
// and scatter in panic at gunfire, crashes or a car bearing down on
// them. A pedestrian hit by a car is a crime — the wanted level rises.

import { clamp, dist, mulberry32, randRange, pick } from './utils.js';
import { WORLD, ROADS_V, ROADS_H, ROAD_W, WALK_W, isOnWalk, isWater } from './city.js';

const SHIRT_COLORS = ['#e8e8e8', '#e86a5e', '#5e9be8', '#7dd95e', '#e8c33a', '#c95ee8', '#5ed9c9', '#f2f2f2'];
const PANIC_TIME = 4;

export function spawnPedestrians(G, count) {
  const rng = mulberry32(4242);
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      const vx = pick(rng, ROADS_V);
      const side = rng() < 0.5 ? 1 : -1;
      x = vx + side * (ROAD_W / 2 + WALK_W / 2 + randRange(rng, -8, 8));
      y = randRange(rng, 80, WORLD.h - 220);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const hy = pick(rng, ROADS_H);
      const side = rng() < 0.5 ? 1 : -1;
      y = hy + side * (ROAD_W / 2 + WALK_W / 2 + randRange(rng, -8, 8));
      x = randRange(rng, 80, WORLD.w - 80);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    G.peds.push({
      x, y, angle,
      speed: randRange(rng, 28, 52),
      state: 'walk',       // 'walk' | 'flee' | 'down'
      fleeX: 0, fleeY: 0,
      color: pick(rng, SHIRT_COLORS),
      panic: 0,
      phase: rng() * 6,
      downTimer: 0,
    });
  }
}

// Panic every pedestrian near (x, y): gunfire, a crash, a stolen car.
export function panicNear(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'down') continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.fleeX = x;
      p.fleeY = y;
      p.panic = PANIC_TIME;
    }
  }
}

export function updatePedestrians(G, dt) {
  for (const p of G.peds) {
    if (p.state === 'down') {
      p.downTimer -= dt;
      if (p.downTimer <= 0) {
        // They get up, shaken, and walk away.
        p.state = 'walk';
        p.panic = 2;
      }
      continue;
    }
    if (p.state === 'flee') {
      p.panic -= dt;
      const away = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      p.angle = away;
      p.x += Math.cos(away) * 130 * dt;
      p.y += Math.sin(away) * 130 * dt;
      p.phase += dt * 12;
      if (p.panic <= 0) p.state = 'walk';
    } else {
      // Stroll along the sidewalk; turn at intersections sometimes.
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.phase += dt * 6;
      if (Math.random() < dt * 0.12) {
        const vertical = Math.abs(Math.cos(p.angle)) < 0.5;
        p.angle = vertical
          ? (Math.random() < 0.5 ? 0 : Math.PI)
          : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      // A car speeding at them: run.
      for (const c of G.cars) {
        if (c.wrecked || Math.abs(c.speed) < 120) continue;
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < 70) {
          p.state = 'flee';
          p.fleeX = c.x;
          p.fleeY = c.y;
          p.panic = PANIC_TIME;
          break;
        }
      }
    }
    // Keep them on land and out of buildings.
    p.x = clamp(p.x, 16, WORLD.w - 16);
    p.y = clamp(p.y, 16, WORLD.h - 16);
    if (isWater(p.x, p.y, G.city)) p.y = G.city.zones.ocean.y - 18;
  }

  // Player car vs pedestrian: a hit knocks them down and raises the heat.
  const pc = G.player.car;
  if (pc && Math.abs(pc.speed) > 40) {
    for (const p of G.peds) {
      if (p.state === 'down') continue;
      if (dist(p.x, p.y, pc.x, pc.y) < 26) {
        p.state = 'down';
        p.downTimer = 6;
        G.particles.push(...G.burst(p.x, p.y, '#ffd24a', 8));
        G.audio.crash();
        G.shake = Math.min(10, G.shake + 4);
        G.raiseWanted(1, 'hit-ped');
        panicNear(G, p.x, p.y, 260);
        G.addText(p.x, p.y - 26, '撞到行人！', '#ff6b5e');
      }
    }
  }
}
