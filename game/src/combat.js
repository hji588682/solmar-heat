// Solmar Heat — combat.js
// Shooting on foot: the player's pistol (mouse aim, click to fire),
// enemy gunmen (mission 4), bullets, muzzle flash, and pickups.
// Driving into someone is handled in pedestrians.js; this file is
// the gunplay.

import { dist, clamp, mulberry32, randRange } from './utils.js';
import { hitBuilding } from './city.js';
import { panicNear } from './pedestrians.js';
import { hurtPlayer } from './player.js';

const BULLET_SPEED = 920;
const ENEMY_BULLET_SPEED = 520;
const BULLET_RANGE = 560;

export function spawnEnemy(G, x, y) {
  const e = {
    x, y,
    angle: 0,
    health: 60,
    speed: 95,
    shootCd: randRange(Math.random, 0.4, 1.2),
    state: 'fight', // 'fight' | 'down'
    color: '#7a2e6e',
    flash: 0,
  };
  G.enemies.push(e);
  return e;
}

export function spawnEnemiesForMission(G, spots) {
  for (const s of spots) spawnEnemy(G, s.x, s.y);
}

// Fire one bullet from (x, y) along `angle`. `from` is 'player' | 'enemy'.
export function fireBullet(G, x, y, angle, from) {
  G.bullets.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * (from === 'player' ? BULLET_SPEED : ENEMY_BULLET_SPEED),
    vy: Math.sin(angle) * (from === 'player' ? BULLET_SPEED : ENEMY_BULLET_SPEED),
    from,
    life: BULLET_RANGE / (from === 'player' ? BULLET_SPEED : ENEMY_BULLET_SPEED),
    dmg: from === 'player' ? 34 : 10,
  });
  G.muzzle = 0.06;
  if (from === 'player') G.audio.shoot();
  else G.audio.enemyShoot();
}

export function updateCombat(G, dt) {
  const p = G.player;
  // Player shooting: hold mouse to fire, limited by fire rate and ammo.
  p.fireCd = Math.max(0, (p.fireCd || 0) - dt);
  if (p.onFoot && G.input.mouse.down && p.fireCd <= 0 && G.state === 'play') {
    if (p.ammo > 0) {
      p.ammo -= 1;
      p.fireCd = 0.22;
      fireBullet(G, p.x, p.y, p.aimAngle, 'player');
      G.shake = Math.min(6, G.shake + 1.5);
      panicNear(G, p.x, p.y, 320);
      if (G.wanted < 1) G.raiseWanted(1, 'shoot');
    } else {
      p.fireCd = 0.3;
      G.audio.blip(180, 0.06, 'square', 0.1);
      G.addText(p.x, p.y - 26, '没子弹了！', '#ffd24a');
    }
  }

  // Bullets fly, hit buildings, cars, enemies and the player.
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (hitBuilding(b.x, b.y, 2, G.city)) {
      b.dead = true;
      G.particles.push(...G.burst(b.x, b.y, '#c9c9c9', 4));
      continue;
    }
    if (b.from === 'player') {
      // Enemy gunmen.
      for (const e of G.enemies) {
        if (e.state === 'down') continue;
        if (dist(b.x, b.y, e.x, e.y) < 16) {
          b.dead = true;
          e.health -= b.dmg;
          e.flash = 0.12;
          G.particles.push(...G.burst(b.x, b.y, '#ff5e6e', 6));
          if (e.health <= 0) {
            e.state = 'down';
            G.stats.kills++;
            G.addText(e.x, e.y - 24, '击倒！', '#ffd24a');
            G.particles.push(...G.burst(e.x, e.y, '#ff5e6e', 14));
            // Sometimes they drop ammo or cash.
            if (Math.random() < 0.45) {
              G.pickups.push({ x: e.x + 14, y: e.y + 10, kind: 'ammo', taken: false });
            } else if (Math.random() < 0.35) {
              G.pickups.push({ x: e.x - 14, y: e.y + 10, kind: 'money', taken: false });
            }
          }
          break;
        }
      }
      if (b.dead) continue;
      // Cars (a parked car is a fine bullet stop).
      for (const c of G.cars) {
        if (c.wrecked) continue;
        const dx = b.x - c.x;
        const dy = b.y - c.y;
        const ca = Math.cos(-c.angle);
        const sa = Math.sin(-c.angle);
        const lx = dx * ca - dy * sa;
        const ly = dx * sa + dy * ca;
        if (Math.abs(lx) < c.len / 2 && Math.abs(ly) < c.wid / 2) {
          b.dead = true;
          G.particles.push(...G.burst(b.x, b.y, '#ffcf5e', 5));
          break;
        }
      }
    } else {
      // Enemy bullets vs the player.
      if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 14) {
        b.dead = true;
        if (hurtPlayer(G, b.dmg, b.x, b.y)) G.wasted();
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);

  // Enemy AI: close in, keep a firing distance, shoot with a cooldown.
  for (const e of G.enemies) {
    if (e.state === 'down') continue;
    if (e.flash > 0) e.flash -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    const want = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = want;
    if (d > 260) {
      e.x += Math.cos(want) * e.speed * dt;
      e.y += Math.sin(want) * e.speed * dt;
    } else if (d < 150) {
      e.x -= Math.cos(want) * e.speed * 0.6 * dt;
      e.y -= Math.sin(want) * e.speed * 0.6 * dt;
    }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 420 && p.onFoot) {
      e.shootCd = randRange(Math.random, 0.9, 1.7);
      const jitter = (Math.random() - 0.5) * 0.22;
      fireBullet(G, e.x, e.y, want + jitter, 'enemy');
    }
  }
  // Downed enemies stay lying on the ground; they no longer fight.
}
