// Solmar Heat — render.js
// Drawing only: the world in, pixels out. Top-down 2D canvas: ground,
// roads, buildings, palms, cars, people, bullets and particles, then
// the screens (title / pause / busted / wasted / failed / complete).
// The camera follows the player with a velocity look-ahead.

import { clamp, dist, TAU } from './utils.js';
import { WORLD, ROADS_V, ROADS_H, ROAD_W, WALK_W } from './city.js';
import { fmtMoney } from './utils.js';
import { MISSIONS } from './missions.js';

export function drawWorld(G) {
  const ctx = G.ctx;
  const cam = G.cam;
  const view = G.view;
  ctx.save();
  ctx.clearRect(0, 0, view.w, view.h);
  // Warm late-afternoon light over everything.
  ctx.fillStyle = '#e8c98f';
  ctx.fillRect(0, 0, view.w, view.h);
  const shx = (Math.random() - 0.5) * G.shake;
  const shy = (Math.random() - 0.5) * G.shake;
  ctx.translate(Math.round(view.w / 2 - cam.x + shx), Math.round(view.h / 2 - cam.y + shy));

  drawGround(G);
  drawRoads(G);
  drawZones(G);
  drawBuildings(G);
  drawProps(G);
  drawSkids(G);
  drawPickups(G);
  drawCars(G);
  drawPeds(G);
  drawEnemies(G);
  drawPlayer(G);
  drawBullets(G);
  drawParticles(G);
  drawMissionMarker(G);
  ctx.restore();
}

function drawGround(G) {
  const ctx = G.ctx;
  const city = G.city;
  // Grass base.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  // Subtle mowing stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < WORLD.h; y += 120) ctx.fillRect(0, y, WORLD.w, 60);
  // Beach sand, then the sea.
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(city.zones.beach.x, city.zones.beach.y, city.zones.beach.w, city.zones.beach.h);
  const grad = ctx.createLinearGradient(0, 1930, 0, 2000);
  grad.addColorStop(0, '#3f8fd9');
  grad.addColorStop(1, '#1d5a9e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 1930, WORLD.w, 70);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wy = 1942 + i * 18 + Math.sin(G.time * 1.4 + i * 2) * 3;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.w; x += 60) {
      const yy = wy + Math.sin(x / 130 + G.time * 2 + i) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawRoads(G) {
  const ctx = G.ctx;
  // Sidewalks: a pale border around every road.
  ctx.fillStyle = '#b8b0a0';
  for (const vx of ROADS_V) {
    ctx.fillRect(vx - ROAD_W / 2 - WALK_W, 0, ROAD_W + WALK_W * 2, WORLD.h);
  }
  for (const hy of ROADS_H) {
    ctx.fillRect(0, hy - ROAD_W / 2 - WALK_W, WORLD.w, ROAD_W + WALK_W * 2);
  }
  // Asphalt.
  ctx.fillStyle = '#33333a';
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const hy of ROADS_H) ctx.fillRect(0, hy - ROAD_W / 2, WORLD.w, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#e8c33a';
  for (const vx of ROADS_V) {
    for (let y = 0; y < WORLD.h; y += 64) {
      if (isIntersection(vx, y)) continue;
      ctx.fillRect(vx - 3, y, 6, 34);
    }
  }
  for (const hy of ROADS_H) {
    for (let x = 0; x < WORLD.w; x += 64) {
      if (isIntersection(x, hy)) continue;
      ctx.fillRect(x, hy - 3, 34, 6);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const vx of ROADS_V) {
    for (const hy of ROADS_H) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(vx - ROAD_W / 2 + 6, hy + i * 12 - 3, ROAD_W - 12, 6);
      }
    }
  }
}

function isIntersection(x, y) {
  for (const hy of ROADS_H) if (Math.abs(y - hy) < ROAD_W) return true;
  for (const vx of ROADS_V) if (Math.abs(x - vx) < ROAD_W) return true;
  return false;
}

function drawZones(G) {
  const ctx = G.ctx;
  const z = G.city.zones;
  // Central park: lawn, pond, paths.
  ctx.fillStyle = '#4d8a4d';
  ctx.fillRect(z.park.x, z.park.y, z.park.w, z.park.h);
  ctx.fillStyle = '#3f8fd9';
  ctx.beginPath();
  ctx.ellipse(z.park.x + 200, z.park.y + 180, 70, 44, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d9c9a0';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(z.park.x, z.park.y + 180);
  ctx.lineTo(z.park.x + z.park.w, z.park.y + 180);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(z.park.x + 200, z.park.y);
  ctx.lineTo(z.park.x + 200, z.park.y + z.park.h);
  ctx.stroke();
  // Marina: docks and moored boats.
  ctx.fillStyle = '#8a7a5e';
  ctx.fillRect(z.marina.x, z.marina.y, z.marina.w, z.marina.h);
  ctx.fillStyle = '#c9b896';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(z.marina.x + 20 + i * 80, z.marina.y + 10, 50, 14);
  }
  const boatColors = ['#e8e8e8', '#d94f3d', '#3d7dd9', '#e8c33a'];
  for (let i = 0; i < 4; i++) {
    const bx = z.marina.x + 30 + i * 80;
    const by = z.marina.y + 60 + (i % 2) * 40;
    ctx.fillStyle = boatColors[i];
    ctx.beginPath();
    ctx.ellipse(bx, by, 26, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 6, by - 18, 12, 14);
  }
  // Spray Shop (Ray's garage): orange lot with a big SPRAY sign.
  ctx.fillStyle = '#c97a2e';
  ctx.fillRect(z.spray.x, z.spray.y, z.spray.w, z.spray.h);
  ctx.fillStyle = '#8a5a1e';
  ctx.fillRect(z.spray.x + 10, z.spray.y + 10, z.spray.w - 20, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPRAY', z.spray.x + z.spray.w / 2, z.spray.y + 40);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#ffd24a';
  ctx.fillText("RAY'S · 洗掉通缉 $100", z.spray.x + z.spray.w / 2, z.spray.y + 76);
  ctx.textAlign = 'left';
  // Gas station.
  ctx.fillStyle = '#7d8aa6';
  ctx.fillRect(z.gas.x, z.gas.y, z.gas.w, z.gas.h);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAS', z.gas.x + z.gas.w / 2, z.gas.y + 30);
  ctx.textAlign = 'left';
  // Wooden pier into the sea at the marina end.
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(z.pier.x, z.pier.y, z.pier.w, z.pier.h);
  ctx.fillStyle = '#a8845a';
  for (let y = z.pier.y; y < z.pier.y + z.pier.h; y += 12) {
    ctx.fillRect(z.pier.x, y, z.pier.w, 3);
  }
}

function drawBuildings(G) {
  const ctx = G.ctx;
  for (const b of G.city.buildings) {
    // Drop shadow: tall towers cast further.
    const sh = b.tall ? 14 : 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Rooftop detail: inner panel + a few skylight dots.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const stepX = Math.max(24, b.w / 4);
    const stepY = Math.max(24, b.h / 4);
    for (let x = b.x + 14; x < b.x + b.w - 10; x += stepX) {
      for (let y = b.y + 14; y < b.y + b.h - 10; y += stepY) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
  }
}

function drawProps(G) {
  const ctx = G.ctx;
  // Palm trees: trunk dot + frond star.
  for (const t of G.city.palms) {
    ctx.fillStyle = '#7a5a30';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3f8a3f';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      ctx.beginPath();
      ctx.ellipse(t.x + Math.cos(a) * 9, t.y + Math.sin(a) * 9, 9, 3.5, a, 0, TAU);
      ctx.fill();
    }
  }
  for (const t of G.city.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4d9b4d';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, 7, 0, TAU);
    ctx.fill();
  }
}

function drawSkids(G) {
  const ctx = G.ctx;
  for (const s of G.skids) {
    ctx.save();
    ctx.globalAlpha = clamp(s.life, 0, 1) * 0.5;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-14, -11, 28, 4);
    ctx.fillRect(-14, 7, 28, 4);
    ctx.restore();
  }
}

function drawPickups(G) {
  const ctx = G.ctx;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 4 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'ammo') {
      ctx.fillStyle = '#8fe388';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#1d4a1d';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('弹', 0, 4);
    } else if (pk.kind === 'money') {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a5a00';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#e83a3a';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    }
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

function drawCars(G) {
  const ctx = G.ctx;
  for (const car of G.cars) drawCar(G, car);
}

function drawCar(G, car) {
  const ctx = G.ctx;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
  // Wheels.
  ctx.fillStyle = '#141414';
  const wl = car.len / 2 - 9;
  ctx.fillRect(-wl, -car.wid / 2 - 3, 12, 6);
  ctx.fillRect(wl - 4, -car.wid / 2 - 3, 12, 6);
  ctx.fillRect(-wl, car.wid / 2 - 3, 12, 6);
  ctx.fillRect(wl - 4, car.wid / 2 - 3, 12, 6);
  // Body.
  if (car.wrecked) {
    ctx.fillStyle = '#3a3a3a';
  } else if (car.driver === 'cop') {
    ctx.fillStyle = '#e8e8e8';
  } else {
    ctx.fillStyle = car.color;
  }
  roundRectPath(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  // Cop livery: black doors + flashing light bar.
  if (car.driver === 'cop' && !car.wrecked) {
    ctx.fillStyle = '#14181f';
    ctx.fillRect(-6, -car.wid / 2, 12, car.wid);
    const flash = Math.floor((car.flash || 0) * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -car.wid / 2 - 1, 8, 5);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, car.wid / 2 - 4, 8, 5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.textAlign = 'left';
  }
  // Windshield + roof (convertibles have no roof).
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(car.len / 2 - 16, -car.wid / 2 + 3, 8, car.wid - 6);
  if (car.kind !== 'convertible') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-8, -car.wid / 2 + 3, 16, car.wid - 6);
  }
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-car.len / 2 + 6, -car.wid / 2 + 3, 7, car.wid - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(car.len / 2 - 2, -car.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.len / 2 - 2, car.wid / 2 - 8, 3, 5);
  // Player's car: a white outline so it reads at a glance.
  if (car.driver === 'player') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -car.len / 2 - 2, -car.wid / 2 - 2, car.len + 4, car.wid + 4, 8);
    ctx.stroke();
  }
  // Smoke from a damaged car.
  if (car.smoking && !car.wrecked && Math.random() < 0.3) {
    G.particles.push({
      x: car.x - Math.cos(car.angle) * car.len / 2, y: car.y - Math.sin(car.angle) * car.len / 2,
      vx: 0, vy: -14, life: 0.9, max: 0.9, color: '#888888', size: 8, smoke: true,
    });
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPeds(G) {
  const ctx = G.ctx;
  for (const p of G.peds) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'down') {
      // Lying flat, dazed.
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8b48f';
      ctx.beginPath();
      ctx.arc(13, 0, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(p.phase) * 1.5;
    ctx.rotate(p.angle);
    // Little walking figure: body + head, feet stepping.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 8, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b48f';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.fillRect(10 + bob, -6, 4, 3);
    ctx.fillRect(10 - bob, 3, 4, 3);
    ctx.restore();
    // Panic "!" over a fleeing pedestrian.
    if (p.state === 'flee') {
      ctx.fillStyle = '#ff5e4a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 16);
      ctx.textAlign = 'left';
    }
  }
}

function drawEnemies(G) {
  const ctx = G.ctx;
  for (const e of G.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.state === 'down') {
      ctx.rotate(e.angle + Math.PI / 2);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.rotate(e.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b48f';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, TAU);
    ctx.fill();
    // Gun barrel.
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
    ctx.fillStyle = '#ff5e6e';
    ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.health / 60, 0, 1), 5);
  }
}

function drawPlayer(G) {
  const ctx = G.ctx;
  const p = G.player;
  if (!p.onFoot) return;
  // Invulnerability blink.
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 7, 0, 0, TAU);
  ctx.fill();
  // Milo: teal jacket, dark hair.
  ctx.fillStyle = '#1f8a8a';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2c98f';
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2b2018';
  ctx.beginPath();
  ctx.arc(2, -2, 4, 0, TAU);
  ctx.fill();
  // Feet.
  ctx.fillStyle = '#222222';
  ctx.fillRect(9 + bob, -7, 4, 3);
  ctx.fillRect(9 - bob, 4, 4, 3);
  ctx.restore();
  // Aim line + gun when on foot.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(52, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(10, -2, 12, 4);
  if (G.muzzle > 0) {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(26, 0, 7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // White ring so the player is findable in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14, 0, TAU);
  ctx.stroke();
}

function drawBullets(G) {
  const ctx = G.ctx;
  ctx.fillStyle = '#ffd24a';
  for (const b of G.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();
  }
}

function drawParticles(G) {
  const ctx = G.ctx;
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.max, 0, 1);
    ctx.globalAlpha = pt.smoke ? a * 0.5 : a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.smoke ? (2 - a) : 1), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(G) {
  const ctx = G.ctx;
  const obj = G.mission && G.mission.active && G.mission.steps[G.mission.stepIdx];
  const target = obj && obj.target;
  if (!target) return;
  const pulse = 26 + Math.sin(G.time * 4) * 5;
  const x = target.x;
  const y = target.y;
  // Ground ring + bouncing diamond.
  ctx.strokeStyle = 'rgba(255,210,74,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, pulse, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  const bob = Math.sin(G.time * 4) * 6;
  ctx.save();
  ctx.translate(x, y - 34 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.fillStyle = '#7a5a00';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.label, x, y + 34);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- screens

function panel(ctx, W, H, w, h) {
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,74,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  return { x, y };
}

export function drawStartScreen(G) {
  const ctx = G.ctx;
  const W = G.view.w;
  const H = G.view.h;
  // Sunset gradient sky over a dimmed city backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b1a4a');
  grad.addColorStop(0.45, '#c94f3d');
  grad.addColorStop(0.75, '#e88f3a');
  grad.addColorStop(1, '#ffd24a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Sun, low over the skyline so the story text stays on dark sky.
  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.arc(W / 2, 430, 66, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,242,176,0.35)';
  ctx.beginPath();
  ctx.arc(W / 2, 430, 96, 0, TAU);
  ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#1d1428';
  const base = 470;
  const tops = [0.5, 0.72, 0.42, 0.66, 0.55, 0.78, 0.48, 0.7, 0.6, 0.44, 0.68, 0.58];
  let x = 0;
  for (let i = 0; i < tops.length; i++) {
    const bw = W / tops.length;
    const bh = 190 * tops[i];
    ctx.fillRect(x, base - bh, bw - 6, bh + 260);
    x += bw;
  }
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 74px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('烈日港湾', W / 2, 190);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#ffd24a';
  ctx.fillText('S O L M A R   H E A T', W / 2, 232);
  ctx.shadowBlur = 0;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffffff';
  const story = [
    '索尔玛，阳光普照的海滨之城。跑路司机 Milo “Ace” Ferran 欠了俱乐部老板 Madame Sol 一笔债。',
    '五场任务，还清债务，就此上岸。开车、偷车、甩掉条子——别被抓到。',
  ];
  story.forEach((ln, i) => ctx.fillText(ln, W / 2, 292 + i * 24));
  // Controls card.
  const pw = 640;
  const ph = 168;
  const px = (W - pw) / 2;
  const py = 360;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#e8e8e8';
  const lines = [
    '步行：WASD 移动 · Shift 跑 · 鼠标瞄准 · 点击开枪',
    '驾驶：W 油门 · S 刹车/倒车 · A/D 转向 · Space 手刹',
    'E 上车 / 下车 / 偷车 · T 开始任务 · Esc 暂停 · M 静音',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, py + 40 + i * 30));
  ctx.fillStyle = '#ffd24a';
  ctx.font = '15px sans-serif';
  const save = G.save;
  const cont = save && (save.missionsDone > 0 || save.money !== 120)
    ? `存档：已完成 ${save.missionsDone}/5 任务 · 持有 ${fmtMoney(save.money)} · 按 C 继续`
    : '新游戏 · 按 Enter 开始';
  ctx.fillText(cont, W / 2, py + 136);
  // Blinking start prompt.
  if (Math.floor(G.time * 1.6) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('按 Enter 或点击开始', W / 2, 600);
  }
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('原创作品 · 与任何商业游戏无关 · 离线运行', W / 2, 668);
  ctx.textAlign = 'left';
}

function drawOverlay(G, title, lines, prompt, accent) {
  const ctx = G.ctx;
  const W = G.view.w;
  const H = G.view.h;
  ctx.fillStyle = 'rgba(5,5,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  const w = 620;
  const h = 150 + lines.length * 30 + 70;
  const { x, y } = panel(ctx, W, H, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd24a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(title, W / 2, y + 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 112 + i * 30));
  if (Math.floor(G.time * 1.6) % 2 === 0) {
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(prompt, W / 2, y + h - 30);
  }
  ctx.textAlign = 'left';
}

export function drawPauseScreen(G) {
  const p = G.player;
  drawOverlay(G, '暂停', [
    '金钱 ' + fmtMoney(p.money) + ' · 已完成任务 ' + G.save.missionsDone + '/5',
    G.mission && G.mission.active
      ? '当前任务：' + MISSIONS[G.mission.idx].name
      : '当前无进行中的任务（按 T 开始下一单）',
    'Esc 继续 · R 重开本任务 · Q 回到标题',
  ], '按 Esc 继续游戏', '#cfe8ff');
}

export function drawBustedScreen(G) {
  drawOverlay(G, 'BUSTED · 被捕', [
    '条子把你按在了地上。保释金 $150。',
    '金钱 ' + fmtMoney(G.player.money),
  ], '按 Enter 重新开始', '#4a7dff');
}

export function drawWastedScreen(G) {
  drawOverlay(G, 'WASTED · 倒下', [
    'Milo 倒在了索尔玛的街头。医院账单扣了 20% 的钱。',
    '金钱 ' + fmtMoney(G.player.money),
  ], '按 Enter 重新开始', '#ff5e4a');
}

export function drawFailedScreen(G) {
  const m = G.mission;
  const name = m && m.failedIdx !== undefined ? MISSIONS[m.failedIdx].name : '任务';
  drawOverlay(G, '任务失败', [
    name + '：' + (m.failedReason || '失败'),
    '别灰心，索尔玛从不缺第二次机会。',
  ], '按 Enter 重开本任务', '#ff8f5e');
}

export function drawCompleteScreen(G) {
  const p = G.player;
  drawOverlay(G, '烈日落幕 · 债务清零', [
    'Milo 登上了出海的船。五场任务，全部完成。',
    '最终持有 ' + fmtMoney(p.money) + ' · 偷车 ' + G.stats.stolen + ' 次 · 击倒 ' + G.stats.kills + ' 人',
    '索尔玛的太阳照常升起——而这一次，自由了。',
  ], '按 Enter 自由漫游', '#8fe388');
}
