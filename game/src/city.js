// Solmar Heat — city.js
// Procedural generation of Solmar: road grid, building blocks, beach,
// ocean, central park, marina, spray shop and props. The layout is
// fully deterministic (fixed seed), so screenshots and playtests always
// see the same city.

import { mulberry32, randRange, randInt, pick, clamp, pointInRect } from './utils.js';

export const WORLD = { w: 2600, h: 2000 };

// Road centre lines. Roads are 96 px wide with a 26 px sidewalk on each side.
export const ROADS_V = [260, 760, 1260, 1760, 2260];
export const ROADS_H = [300, 760, 1220, 1680];
export const ROAD_W = 96;
export const WALK_W = 26;

export const CITY_SEED = 1337;

const ROOF_COLORS = [
  '#c96f4a', '#d9a05b', '#7d9bb5', '#b5a27d', '#8fa98f',
  '#b57d8f', '#6f8f7d', '#c9b458', '#9b7dc9', '#d97b6c',
];
const DOWNTOWN_COLORS = ['#5d7ea6', '#7d8aa6', '#a68a5d', '#6a7d9b', '#8a7d6a'];

export function buildCity(seed = CITY_SEED) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const trees = [];

  // Named zones (rectangles in world coordinates).
  const zones = {
    ocean: { x: 0, y: 1930, w: WORLD.w, h: 70 },
    beach: { x: 0, y: 1830, w: WORLD.w, h: 100 },
    park: { x: 1310, y: 1270, w: 400, h: 360 },
    marina: { x: 60, y: 1700, w: 340, h: 130 },
    spray: { x: 2310, y: 1470, w: 150, h: 130 },
    gas: { x: 1900, y: 620, w: 130, h: 110 },
    pier: { x: 180, y: 1860, w: 90, h: 70 },
  };

  // Blocks are the rectangles between neighbouring roads. Fill each with
  // 1-4 buildings, except the park block and the marina / spray blocks.
  const vEdges = [0, ...ROADS_V, WORLD.w];
  const hEdges = [0, ...ROADS_H, WORLD.h];
  for (let bi = 0; bi < vEdges.length - 1; bi++) {
    for (let bj = 0; bj < hEdges.length - 1; bj++) {
      const bx0 = vEdges[bi] + ROAD_W / 2 + WALK_W;
      const bx1 = vEdges[bi + 1] - ROAD_W / 2 - WALK_W;
      const by0 = hEdges[bj] + ROAD_W / 2 + WALK_W;
      const by1 = hEdges[bj + 1] - ROAD_W / 2 - WALK_W;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      // Skip the park block, the beach strip and the marina block.
      if (bx0 >= 1260 && bx1 <= 1810 && by0 >= 1220 && by1 <= 1730) continue;
      if (by0 >= 1800) continue;
      if (bx0 < 450 && by0 >= 1650) continue;
      // Downtown: blocks around (1260, 760) get tall glass towers.
      const downtown = bx0 >= 1000 && bx1 <= 1810 && by0 >= 500 && by1 <= 1010;
      const oldTown = bx0 >= 500 && bx1 <= 1010 && by0 >= 1000 && by1 <= 1470;
      const n = downtown ? randInt(rng, 1, 2) : randInt(rng, 1, 4);
      const cols = n <= 2 ? 2 : 2;
      const rows = Math.ceil(n / cols);
      const cw = bw / cols;
      const ch = bh / rows;
      let placed = 0;
      for (let r = 0; r < rows && placed < n; r++) {
        for (let c = 0; c < cols && placed < n; c++) {
          const m = 14;
          const w = cw - m * 2;
          const h = ch - m * 2;
          if (w < 40 || h < 40) continue;
          const x = bx0 + c * cw + m + randRange(rng, 0, 8);
          const y = by0 + r * ch + m + randRange(rng, 0, 8);
          // Keep clear of the spray shop and gas station lots.
          if (rectOverlaps(x, y, w, h, zones.spray) || rectOverlaps(x, y, w, h, zones.gas)) continue;
          buildings.push({
            x, y, w, h,
            color: downtown ? pick(rng, DOWNTOWN_COLORS) : pick(rng, ROOF_COLORS),
            tall: downtown,
            old: oldTown,
            seed: rng(),
          });
          placed++;
        }
      }
    }
  }

  // Palm trees along the beach and around the park / marina.
  for (let x = 60; x < WORLD.w - 40; x += 90) {
    if (rng() < 0.8) palms.push({ x: x + randRange(rng, -20, 20), y: randRange(rng, 1852, 1905) });
  }
  for (let i = 0; i < 26; i++) {
    trees.push({
      x: randRange(rng, zones.park.x + 20, zones.park.x + zones.park.w - 20),
      y: randRange(rng, zones.park.y + 20, zones.park.y + zones.park.h - 20),
    });
  }
  for (let i = 0; i < 10; i++) {
    trees.push({ x: randRange(rng, 80, 400), y: randRange(rng, 1720, 1810) });
  }

  // Fixed points of interest used by missions and spawns.
  const poi = {
    playerStart: { x: 320, y: 1760 },
    marinaPickup: { x: 300, y: 1755 },
    downtownDrop: { x: 1260, y: 700 },
    redCarSpot: { x: 822, y: 1290 },
    sprayDoor: { x: 2385, y: 1535 },
    parkPackage: { x: 1510, y: 1450 },
    pierEnd: { x: 225, y: 1895 },
    escapeCarSpot: { x: 1260, y: 900 },
    policeStation: { x: 1760, y: 300 },
  };

  return { buildings, palms, trees, zones, poi, rng };
}

function rectOverlaps(x, y, w, h, r) {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

// Is this point on a road surface (drivable)?
export function isOnRoad(x, y) {
  for (const vx of ROADS_V) {
    if (Math.abs(x - vx) <= ROAD_W / 2 && y >= 0 && y <= WORLD.h) return true;
  }
  for (const hy of ROADS_H) {
    if (Math.abs(y - hy) <= ROAD_W / 2 && x >= 0 && x <= WORLD.w) return true;
  }
  return false;
}

// Is this point on a sidewalk (walkable strip beside a road)?
export function isOnWalk(x, y) {
  const m = ROAD_W / 2 + WALK_W;
  for (const vx of ROADS_V) {
    if (Math.abs(x - vx) <= m && y >= 0 && y <= WORLD.h) return true;
  }
  for (const hy of ROADS_H) {
    if (Math.abs(y - hy) <= m && x >= 0 && x <= WORLD.w) return true;
  }
  return false;
}

export function isWater(x, y, city) {
  return y >= city.zones.ocean.y;
}

export function isBeach(x, y, city) {
  const b = city.zones.beach;
  return pointInRect(x, y, b.x, b.y, b.w, b.h) && !isWater(x, y, city);
}

// Circle vs buildings collision. Returns the building hit, or null.
export function hitBuilding(x, y, r, city) {
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of any building it overlaps. Returns true if pushed.
export function resolveBuilding(x, y, r, city) {
  const b = hitBuilding(x, y, r, city);
  if (!b) return null;
  // Push out along the smallest penetration axis.
  const left = x + r - b.x;
  const right = b.x + b.w - (x - r);
  const top = y + r - b.y;
  const bottom = b.y + b.h - (y - r);
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: b.x - r, y };
  if (m === right) return { x: b.x + b.w + r, y };
  if (m === top) return { x, y: b.y - r };
  return { x, y: b.y + b.h + r };
}

// Nearest intersection centre to a point (used by AI traffic turns).
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of ROADS_V) {
    for (const hy of ROADS_H) {
      const d = (vx - x) * (vx - x) + (hy - y) * (hy - y);
      if (d < bestD) { bestD = d; best = { x: vx, y: hy }; }
    }
  }
  return best;
}
