// Solmar Heat — shots.js
// Screenshot scenes behind ?shot=chase|start|onfoot|mission&seed=N.
// Each scene stages a real, playable game state — the same code path
// the player uses — then the page paints it and sets
// window.__shotReady. The seed only jitters the staging so a scene is
// reproducible: the same seed always gives the same frame.

import { mulberry32, randRange } from './utils.js';
import { makeCar } from './driving.js';
import { spawnEnemy } from './combat.js';
import { startMission } from './missions.js';
import { spawnCop } from './police.js';

// Run the world forward a few frames so traffic, particles and the
// camera settle before the screenshot is taken.
export function settle(G, frames = 30) {
  for (let i = 0; i < frames; i++) G.step(1 / 60, true);
}

export function stageShot(G, name, seed) {
  const rng = mulberry32(seed || 7);
  const p = G.player;
  const poi = G.city.poi;

  if (name === 'start') {
    G.state = 'start';
    return;
  }

  G.state = 'play';
  if (name === 'chase') {
    // Cover: 3-star wanted, driving east down the Downtown avenue with
    // cop cars on the tail, traffic around, mission 5 live, HUD + minimap.
    startMission(G, 4);
    // Put Milo in the escape car, already moving.
    const car = G.mission.data.car;
    car.x = 1260;
    car.y = 760;
    car.angle = 0;
    car.speed = 330;
    G.player.car = car;
    G.player.onFoot = false;
    car.driver = 'player';
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    p.money = 2350;
    p.health = 92;
    // Cops in pursuit, staggered behind and to the sides.
    for (const c of [...G.cops]) {
      const i = G.cars.indexOf(c);
      if (i >= 0) G.cars.splice(i, 1);
    }
    G.cops.length = 0;
    const copSpots = [
      { x: 1020, y: 700, a: 0.1 },
      { x: 1080, y: 830, a: -0.08 },
      { x: 960, y: 780, a: 0.05 },
    ];
    for (const s of copSpots) {
      const cop = makeCar(s.x, s.y, s.a, { driver: 'cop', color: '#e8e8e8' });
      cop.speed = 350;
      cop.ai = { stuck: 0 };
      cop.flash = rng() * 2;
      G.cars.push(cop);
      G.cops.push(cop);
    }
    // A little traffic ahead so the avenue feels alive.
    const ahead = [
      { x: 1560, y: 782, a: 0 }, { x: 1760, y: 738, a: 0 },
      { x: 1420, y: 1220, a: Math.PI / 2 },
    ];
    for (const s of ahead) {
      const c = makeCar(s.x, s.y, s.a, { driver: 'ai' });
      c.ai = { axis: 'h', road: 760, dir: 1, cruise: 150, wait: 0 };
      c.speed = 150;
      G.cars.push(c);
    }
    G.cam.x = car.x + 120;
    G.cam.y = car.y;
    settle(G, 12);
    G.banner = null; // keep the cover clean: HUD and world only
    return;
  }

  if (name === 'onfoot') {
    // On-foot gunfight in the park: mission 4, package taken, gunmen up.
    startMission(G, 3);
    G.mission.stepIdx = 1;
    G.mission.data.packageTaken = true;
    G.mission.data.spawned = true;
    p.x = 1510;
    p.y = 1480;
    p.onFoot = true;
    p.car = null;
    p.angle = -Math.PI / 2;
    p.aimAngle = -0.6;
    p.ammo = 42;
    p.health = 78;
    p.money = 1240;
    const spots = [
      { x: 1420, y: 1330 }, { x: 1620, y: 1360 },
      { x: 1400, y: 1560 }, { x: 1640, y: 1580 },
    ];
    for (const s of spots) {
      const e = spawnEnemy(G, s.x + randRange(rng, -20, 20), s.y + randRange(rng, -20, 20));
      e.shootCd = 2;
    }
    // One muzzle flash + a few bullets in the air for action.
    G.muzzle = 0.06;
    G.bullets.push({
      x: p.x + 60, y: p.y - 40, vx: 700, vy: -500,
      from: 'player', life: 0.5, dmg: 34,
    });
    G.cam.x = p.x;
    G.cam.y = p.y;
    settle(G, 6);
    G.banner = null;
    return;
  }

  if (name === 'mission') {
    // Mission 2: the red convertible, freshly stolen, heading for Ray's.
    startMission(G, 1);
    const car = G.mission.data.car;
    car.x = 1760;
    car.y = 1220;
    car.angle = 0;
    car.speed = 260;
    G.player.car = car;
    G.player.onFoot = false;
    car.driver = 'player';
    p.x = car.x;
    p.y = car.y;
    p.money = 810;
    p.health = 100;
    G.cam.x = car.x + 100;
    G.cam.y = car.y;
    settle(G, 12);
    G.banner = null;
    return;
  }

  // Unknown scene name: fall back to the title screen.
  G.state = 'start';
}
