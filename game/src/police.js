// Solmar Heat — police.js
// The wanted system (0-3 stars) and the police cars that answer it.
// Crimes raise stars; cops spawn off-screen, chase and ram the player,
// and drag a player on foot into custody (BUSTED) if they get too close
// for too long. Lose the cops' line of sight and the heat cools off;
// the Spray Shop washes it away for cash.

import { clamp, dist, angDiff } from './utils.js';
import { WORLD, ROADS_V, ROADS_H } from './city.js';
import { makeCar, stepCar, damageCar } from './driving.js';

export const MAX_WANTED = 3;
const COP_TOP = { 1: 330, 2: 380, 3: 440 };

export function raiseWanted(G, amount, why) {
  if (G.state !== 'play') return;
  const before = G.wanted;
  G.wanted = clamp(G.wanted + amount, 0, MAX_WANTED);
  if (G.wanted > before) {
    G.wantedFlash = 1;
    G.lastSeenAt = G.time;
    G.addText(G.player.x, G.player.y - 40, '通缉 +' + (G.wanted - before) + ' ★', '#ff5e4a');
  }
  if (G.wanted > 0) G.audio.blip(520, 0.12, 'square', 0.12, 780);
}

// How many cop cars the current wanted level should have on the street.
function wantedCopCount(wanted) {
  return wanted <= 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : 4;
}

// Spawn a cop car on a road some distance from the player.
export function spawnCop(G) {
  const p = G.player;
  const vertical = Math.random() < 0.5;
  let x, y;
  for (let tries = 0; tries < 12; tries++) {
    if (vertical) {
      x = ROADS_V[Math.floor(Math.random() * ROADS_V.length)];
      y = clamp(p.y + (Math.random() < 0.5 ? -1 : 1) * (520 + Math.random() * 260), 60, WORLD.h - 260);
    } else {
      y = ROADS_H[Math.floor(Math.random() * ROADS_H.length)];
      x = clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * (520 + Math.random() * 260), 60, WORLD.w - 60);
    }
    if (dist(x, y, p.x, p.y) > 480) break;
  }
  const angle = Math.atan2(p.y - y, p.x - x);
  const car = makeCar(x, y, angle, { driver: 'cop', kind: 'sedan', color: '#e8e8e8' });
  car.ai = { stuck: 0 };
  car.topSpeed = COP_TOP[G.wanted] || 380;
  G.cars.push(car);
  G.cops.push(car);
  return car;
}

function removeCop(G, car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  const j = G.cops.indexOf(car);
  if (j >= 0) G.cops.splice(j, 1);
}

export function clearWanted(G, why) {
  G.wanted = 0;
  G.wantedDecay = 0;
  for (const c of [...G.cops]) removeCop(G, c);
  if (why === 'spray') {
    G.addText(G.player.x, G.player.y - 40, '通缉已清除！', '#8fe388');
    G.audio.missionDone();
  }
}

// A cop can see the player if it is close enough (and, loosely, the
// player is not hiding far off the road network).
export function copSeesPlayer(G, cop) {
  const p = G.player;
  return dist(cop.x, cop.y, p.x, p.y) < 560;
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Keep the street staffed to the wanted level.
  const want = wantedCopCount(G.wanted);
  while (G.cops.length < want) spawnCop(G);
  while (G.cops.length > want) removeCop(G, G.cops[G.cops.length - 1]);

  // Heat cools off when no cop has seen the player for a while.
  if (G.wanted > 0) {
    let seen = false;
    for (const c of G.cops) if (copSeesPlayer(G, c)) { seen = true; break; }
    if (seen) {
      G.lastSeenAt = G.time;
      G.wantedDecay = 0;
    } else {
      G.wantedDecay += dt;
      if (G.wantedDecay > 7) {
        G.wantedDecay = 0;
        G.wanted -= 1;
        G.addText(p.x, p.y - 40, '风头过去了 ★' + G.wanted, '#cfe8ff');
        if (G.wanted <= 0) clearWanted(G, 'cooled');
      }
    }
  }

  // Cop driving: steer at the player, ram, and recover from walls.
  // The arrest timer is applied once per frame, after the loop: one
  // cop far away must not cancel out the one right next to the player.
  let arrestNear = false;
  for (const cop of [...G.cops]) {
    if (cop.wrecked) {
      cop.wreckTimer = (cop.wreckTimer || 0) + dt;
      if (cop.wreckTimer > 5) removeCop(G, cop);
      continue;
    }
    const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    const dAng = angDiff(cop.angle, targetAngle);
    const d = dist(cop.x, cop.y, p.x, p.y);
    let ctrl;
    if (p.onFoot) {
      // Creep up on a player on foot: approach slowly and hold close
      // enough to make the arrest, instead of charging past them.
      ctrl = {
        throttle: d > 48,
        brake: d < 30,
        steer: clamp(dAng * 2.6, -1, 1),
        handbrake: false,
      };
    } else if (cop.ai.stuck > 1.2) {
      // Wedged against a building: back up and turn around.
      ctrl = { throttle: false, brake: true, steer: dAng > 0 ? -1 : 1, handbrake: false };
      if (cop.ai.stuck > 2.2) cop.ai.stuck = 0;
    } else {
      ctrl = {
        throttle: d > 46,
        brake: d < 40,
        steer: clamp(dAng * 2.2, -1, 1),
        handbrake: false,
      };
    }
    stepCar(G, cop, dt, ctrl);
    // Only count as stuck when trying to move but not moving.
    if (ctrl.throttle && Math.abs(cop.speed) < 12) cop.ai.stuck += dt;
    else cop.ai.stuck = 0;
    // Light bar flash + siren-side particles.
    cop.flash = (cop.flash || 0) + dt;

    // On foot, a cop that pulls up next to the player counts toward
    // the arrest (the timer itself is applied once, after this loop).
    if (p.onFoot && d < 80) arrestNear = true;
    // Ramming the player's car damages it.
    const pc = p.car;
    if (pc && !pc.wrecked && d < (cop.len + pc.len) / 2 - 4) {
      if (Math.abs(cop.speed) > 150 || Math.abs(pc.speed) > 150) {
        damageCar(G, pc, 4);
        G.shake = Math.min(10, G.shake + 2);
      }
    }
    // A cop car wrecked by the player is a crime too.
    if (cop.health <= 30 && !cop.counted) {
      cop.counted = true;
    }
  }

  // The arrest, applied once per frame: a cop next to the player on
  // foot counts the timer up; with no cop near, it slowly counts down.
  if (p.onFoot) {
    if (arrestNear) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 0.8) {
        G.busted();
        return;
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 0.8);
    }
  }

  // Spray Shop: drive in with heat and cash, drive out clean.
  const sp = G.city.zones.spray;
  const pc = p.car;
  if (G.wanted > 0 && pc && !pc.wrecked &&
      p.x > sp.x && p.x < sp.x + sp.w && p.y > sp.y && p.y < sp.y + sp.h) {
    if (p.money >= 100) {
      p.money -= 100;
      clearWanted(G, 'spray');
      G.stats.sprays++;
    } else {
      G.sprayMsg = 2;
      G.addText(p.x, p.y - 40, '洗白需要 $100', '#ffd24a');
    }
  }
}
