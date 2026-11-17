// Solmar Heat — traffic.js
// AI traffic: cars that cruise the road grid, keep to the right-hand
// lane, turn at intersections, slow for the car ahead, and stop briefly
// after a crash. Parked cars line the kerbs for the player to steal.

import { clamp, dist, mulberry32, randRange, pick, TAU } from './utils.js';
import { WORLD, ROADS_V, ROADS_H, ROAD_W, isOnRoad } from './city.js';
import { makeCar, CAR_COLORS } from './driving.js';

const LANE = 18; // lane offset from the road centre line (keeps traffic 44 px clear of kerb-parked cars)

export function spawnTraffic(G, count) {
  const rng = mulberry32(20240);
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      const vx = pick(rng, ROADS_V);
      const dir = rng() < 0.5 ? 1 : -1;
      x = vx + (dir > 0 ? LANE : -LANE);
      y = randRange(rng, 80, WORLD.h - 220);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const hy = pick(rng, ROADS_H);
      const dir = rng() < 0.5 ? 1 : -1;
      y = hy + (dir > 0 ? LANE : -LANE);
      x = randRange(rng, 80, WORLD.w - 80);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar(x, y, angle, { driver: 'ai', color: pick(rng, CAR_COLORS) });
    car.ai = {
      axis: vertical ? 'v' : 'h',
      road: vertical ? nearestRoad(x, ROADS_V) : nearestRoad(y, ROADS_H),
      dir: vertical ? (angle > 0 ? 1 : -1) : (angle === 0 ? 1 : -1),
      cruise: randRange(rng, 120, 190),
      wait: 0,
    };
    G.cars.push(car);
  }
}

function nearestRoad(v, roads) {
  let best = roads[0];
  let bd = Math.abs(v - best);
  for (const r of roads) {
    const d = Math.abs(v - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

export function spawnParkedCars(G) {
  // A handful of parked cars along kerbs, ready to steal.
  const spots = [
    { x: 322, y: 1760, a: -Math.PI / 2 }, // right by the player's start, for mission 1 (faces north, up the road)
    { x: 760 + 62, y: 420, a: Math.PI / 2 },
    { x: 1260 - 62, y: 980, a: -Math.PI / 2 },
    { x: 1760 + 62, y: 500, a: Math.PI / 2 },
    { x: 260 + 62, y: 900, a: Math.PI / 2 },
    { x: 2260 - 62, y: 1000, a: -Math.PI / 2 },
    { x: 380, y: 760 + 62, a: 0 },
    { x: 1500, y: 1220 - 62, a: Math.PI },
    { x: 900, y: 1680 - 62, a: Math.PI },
    { x: 2050, y: 300 - 62, a: 0 },
    { x: 1100, y: 1680 + 62, a: 0 },
  ];
  const rng = mulberry32(777);
  for (const s of spots) {
    const car = makeCar(s.x, s.y, s.a, { driver: 'none', color: pick(rng, CAR_COLORS) });
    G.cars.push(car);
  }
}

// One AI traffic step: follow the lane, maybe turn at an intersection,
// slow down for traffic ahead, nudge around a wreck.
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'ai' || car.wrecked) continue;
    const ai = car.ai;
    if (!ai) continue;
    if (ai.wait > 0) {
      ai.wait -= dt;
      car.speed *= Math.max(0, 1 - 4 * dt);
      continue;
    }
    // Am I near an intersection? Maybe turn.
    const onV = nearestRoad(car.x, ROADS_V);
    const onH = nearestRoad(car.y, ROADS_H);
    const nearCross =
      Math.abs(car.x - onV) < 26 && Math.abs(car.y - onH) < 26;
    if (nearCross && Math.random() < dt * 0.55) {
      // Turn onto the crossing road (keep right-hand traffic).
      if (ai.axis === 'v') {
        ai.axis = 'h';
        ai.road = onH;
        ai.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = ai.dir > 0 ? 0 : Math.PI;
        car.y = onH + (ai.dir > 0 ? LANE : -LANE);
      } else {
        ai.axis = 'v';
        ai.road = onV;
        ai.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = onV + (ai.dir > 0 ? LANE : -LANE);
      }
    }
    // Stay in lane: gently steer back to the lane line.
    if (ai.axis === 'v') {
      const wantX = ai.road + (ai.dir > 0 ? LANE : -LANE);
      car.x += clamp(wantX - car.x, -1, 1) * 60 * dt;
      car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.y += ai.dir * car.speed * dt;
    } else {
      const wantY = ai.road + (ai.dir > 0 ? LANE : -LANE);
      car.y += clamp(wantY - car.y, -1, 1) * 60 * dt;
      car.angle = ai.dir > 0 ? 0 : Math.PI;
      car.x += ai.dir * car.speed * dt;
    }
    // Slow for the car ahead on the same lane.
    let target = ai.cruise;
    for (const o of G.cars) {
      if (o === car || o.wrecked) continue;
      const ahead = ai.axis === 'v'
        ? Math.abs(o.x - car.x) < 34 && (o.y - car.y) * ai.dir > 0 && (o.y - car.y) * ai.dir < 95
        : Math.abs(o.y - car.y) < 34 && (o.x - car.x) * ai.dir > 0 && (o.x - car.x) * ai.dir < 95;
      if (ahead) { target = 0; break; }
    }
    // The player on foot crossing right ahead: brake, don't run them over.
    const p = G.player;
    if (p.onFoot) {
      const ahead = ai.axis === 'v'
        ? Math.abs(p.x - car.x) < 34 && (p.y - car.y) * ai.dir > 0 && (p.y - car.y) * ai.dir < 70
        : Math.abs(p.y - car.y) < 34 && (p.x - car.x) * ai.dir > 0 && (p.x - car.x) * ai.dir < 70;
      if (ahead) target = 0;
    }
    car.speed += clamp(target - car.speed, -260 * dt, 150 * dt);
    car.x = clamp(car.x, 20, WORLD.w - 20);
    car.y = clamp(car.y, 20, WORLD.h - 20);
    // Off the grid edge: wrap around to the far side so traffic never ends.
    if (ai.axis === 'v' && (car.y < 40 || car.y > WORLD.h - 240)) {
      car.y = ai.dir > 0 ? 60 : WORLD.h - 260;
    }
    if (ai.axis === 'h' && (car.x < 40 || car.x > WORLD.w - 40)) {
      car.x = ai.dir > 0 ? 60 : WORLD.w - 60;
    }
  }
}
