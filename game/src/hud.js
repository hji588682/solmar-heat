// Solmar Heat — hud.js
// The HUD, drawn in screen space after the world: wanted stars, health,
// money, the mission objective bar, speed, context hints, floating
// texts, banners, and the minimap (bottom right).

import { clamp, fmtMoney } from './utils.js';
import { WORLD, ROADS_V, ROADS_H } from './city.js';
import { currentObjective } from './missions.js';

const MM = { w: 216, h: 166, pad: 10 };

export function drawHud(G) {
  const ctx = G.ctx;
  const W = G.view.w;
  const H = G.view.h;
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // ---- top left: wanted stars, health, money, ammo ----
  ctx.fillStyle = 'rgba(10,10,16,0.55)';
  roundRect(ctx, 12, 12, 250, 108, 10);
  ctx.fill();
  // Stars.
  for (let i = 0; i < 3; i++) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < G.wanted ? (G.wantedFlash > 0.4 ? '#ff5e4a' : '#ffd24a') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 24 + i * 32, 42);
  }
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Milo “Ace” Ferran', 24, 66);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(24, 74, 150, 10);
  ctx.fillStyle = p.health > 50 ? '#7dd95e' : p.health > 25 ? '#ffd24a' : '#ff5e4a';
  ctx.fillRect(24, 74, 150 * clamp(p.health / 100, 0, 1), 10);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#cfe8ff';
  ctx.fillText('生命 ' + Math.ceil(p.health), 182, 84);
  // Money + ammo + respect, one row.
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#8fe388';
  ctx.fillText(fmtMoney(p.money), 24, 110);
  ctx.font = '13px sans-serif';
  if (p.onFoot) {
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText('子弹 ' + p.ammo, 108, 110);
  }
  ctx.fillStyle = '#ffd24a';
  ctx.fillText('尊重 ' + G.save.missionsDone + '/5 任务', 168, 110);

  // ---- top centre: mission objective ----
  const obj = currentObjective(G);
  if (obj) {
    ctx.font = 'bold 17px sans-serif';
    const tw = ctx.measureText(obj.text).width;
    const bx = (W - tw) / 2 - 16;
    ctx.fillStyle = 'rgba(10,10,16,0.6)';
    roundRect(ctx, bx, 12, tw + 32, 34, 9);
    ctx.fill();
    ctx.fillStyle = obj.idx >= 0 ? '#ffd24a' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(obj.text, W / 2, 36);
    ctx.textAlign = 'left';
    // Distance to the marker, when there is one.
    if (obj.target) {
      const d = Math.round(Math.hypot(p.x - obj.target.x, p.y - obj.target.y));
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#cfe8ff';
      ctx.textAlign = 'center';
      ctx.fillText(d + 'm', W / 2, 60);
      ctx.textAlign = 'left';
    }
  }

  // ---- bottom left: context hints ----
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const hints = [];
  if (p.onFoot) {
    hints.push('WASD 步行 · Shift 跑 · 鼠标瞄准 · 点击开枪');
    const near = G.nearestCar;
    if (near) hints.push('按 E 上车 / 偷车');
    if (G.nearSpray) hints.push('Spray Shop：开车进来洗掉通缉（$100）');
  } else {
    hints.push('W/S 油门刹车 · A/D 转向 · Space 手刹 · E 下车');
    if (G.wanted > 0) hints.push('甩掉警车，或开进 Spray Shop（东边）洗白');
  }
  hints.push('Esc 暂停 · M 静音 · T 任务');
  hints.forEach((h, i) => {
    ctx.fillStyle = 'rgba(10,10,16,0.5)';
    const hw = ctx.measureText(h).width;
    roundRect(ctx, 12, H - 26 - i * 24, hw + 14, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(h, 19, H - 11 - i * 24);
  });

  // ---- speedometer (driving) ----
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + '', W - MM.w - 30, H - 24);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText('km/h', W - MM.w - 30, H - 6);
    ctx.textAlign = 'left';
    // Car health.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(W - MM.w - 30, H - 52, 110, 8);
    ctx.fillStyle = p.car.health > 50 ? '#7dd95e' : '#ff5e4a';
    ctx.fillRect(W - MM.w - 30, H - 52, 110 * clamp(p.car.health / 100, 0, 1), 8);
  }

  drawMinimap(G);
  drawBanner(G);
  drawFloatTexts(G);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const W = G.view.w;
  const H = G.view.h;
  const mx = W - MM.w - MM.pad;
  const my = H - MM.h - MM.pad;
  const sx = MM.w / WORLD.w;
  const sy = MM.h / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  roundRect(ctx, mx - 4, my - 4, MM.w + 8, MM.h + 8, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(mx, my, MM.w, MM.h);
  ctx.clip();
  // Ground: grass, beach, ocean, park.
  ctx.fillStyle = '#3f6b3a';
  ctx.fillRect(mx, my, MM.w, MM.h);
  ctx.fillStyle = '#e8d28a';
  ctx.fillRect(mx, my + 1830 * sy, MM.w, 100 * sy);
  ctx.fillStyle = '#2f6fb5';
  ctx.fillRect(mx, my + 1930 * sy, MM.w, 70 * sy);
  ctx.fillStyle = '#4d8a4d';
  ctx.fillRect(mx + 1310 * sx, my + 1270 * sy, 400 * sx, 360 * sy);
  // Roads.
  ctx.strokeStyle = '#555560';
  ctx.lineWidth = 5;
  for (const vx of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(mx + vx * sx, my);
    ctx.lineTo(mx + vx * sx, my + MM.h);
    ctx.stroke();
  }
  for (const hy of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(mx, my + hy * sy);
    ctx.lineTo(mx + MM.w, my + hy * sy);
    ctx.stroke();
  }
  // Spray shop.
  const sp = G.city.zones.spray;
  ctx.fillStyle = '#e88f3a';
  ctx.fillRect(mx + sp.x * sx - 3, my + sp.y * sy - 3, 6, 6);
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of G.cars) {
    if (c.driver === 'cop') continue;
    ctx.fillRect(mx + c.x * sx - 1.5, my + c.y * sy - 1.5, 3, 3);
  }
  // Enemies.
  ctx.fillStyle = '#ff5e6e';
  for (const e of G.enemies) {
    if (e.state === 'down') continue;
    ctx.beginPath();
    ctx.arc(mx + e.x * sx, my + e.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target: pulsing yellow diamond.
  const obj = currentObjective(G);
  if (obj && obj.target) {
    const t = obj.target;
    const pulse = 4 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(mx + t.x * sx, my + t.y * sy - pulse);
    ctx.lineTo(mx + t.x * sx + pulse, my + t.y * sy);
    ctx.lineTo(mx + t.x * sx, my + t.y * sy + pulse);
    ctx.lineTo(mx + t.x * sx - pulse, my + t.y * sy);
    ctx.closePath();
    ctx.fill();
  }
  // Cops: flashing blue/red.
  for (const c of G.cops) {
    ctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#4a7dff' : '#ff4a4a';
    ctx.beginPath();
    ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: white arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4, -4.5);
  ctx.lineTo(-4, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Viewport rectangle.
  const cam = G.cam;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + (cam.x - G.view.w / 2) * sx, my + (cam.y - G.view.h / 2) * sy, G.view.w * sx, G.view.h * sy);
  ctx.restore();
}

function drawBanner(G) {
  if (!G.banner || G.banner.t <= 0) return;
  const ctx = G.ctx;
  const W = G.view.w;
  const alpha = clamp(G.banner.t / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(G.banner.title, W / 2, 150);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#ffffff';
  const lines = wrapText(ctx, G.banner.sub, 760);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 182 + i * 24));
  ctx.restore();
}

function drawFloatTexts(G) {
  const ctx = G.ctx;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  for (const t of G.floatTexts) {
    const alpha = clamp(t.life / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    const sx = t.x - G.cam.x + G.view.w / 2;
    const sy = t.y - G.cam.y + G.view.h / 2;
    ctx.fillText(t.text, sx, sy);
  }
  ctx.restore();
}

function wrapText(ctx, text, maxW) {
  const words = text.split('');
  const lines = [];
  let cur = '';
  for (const ch of words) {
    if (ctx.measureText(cur + ch).width > maxW && cur.length > 0) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}
