// Solmar Heat — main.js
// Boot, the one game loop, and the screen state machine:
// start / play / pause / busted / wasted / failed / complete.
// All world state lives on one object `G` that the feature modules
// share; this file owns the loop, the camera and the transitions.
//
// ?shot=chase|start|onfoot|mission&seed=N stages a screenshot scene
// (see shots.js) and sets window.__shotReady once it is painted.

import { buildCity, WORLD } from './city.js';
import { createInput, isDown, wasPressed, endFrame } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { createPlayer, updatePlayerOnFoot, nearestEnterableCar, enterCar, exitCar } from './player.js';
import { stepCar, playerDriveControls, collideCars } from './driving.js';
import { spawnTraffic, spawnParkedCars, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice, raiseWanted, clearWanted } from './police.js';
import { updateCombat } from './combat.js';
import { startMission, updateMissions, failMission, MISSIONS } from './missions.js';
import { drawHud } from './hud.js';
import { drawWorld, drawStartScreen, drawPauseScreen, drawBustedScreen, drawWastedScreen, drawFailedScreen, drawCompleteScreen } from './render.js';
import { stageShot } from './shots.js';
import { clamp, dist } from './utils.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const VIEW = { w: 1280, h: 720 };

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const shotSeed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.w;
canvas.height = VIEW.h;

const saved = loadSave();

const G = {
  ctx,
  view: VIEW,
  time: 0,
  state: 'start',
  city: buildCity(),
  input: createInput(canvas),
  audio: createAudio(),
  save: saved || { money: 120, missionUnlocked: 0, missionsDone: 0, bestMoney: 0, storyDone: false },
  player: null,
  cars: [],
  peds: [],
  cops: [],
  enemies: [],
  bullets: [],
  particles: [],
  pickups: [],
  skids: [],
  floatTexts: [],
  cam: { x: 640, y: 360 },
  wanted: 0,
  wantedFlash: 0,
  wantedDecay: 0,
  lastSeenAt: 0,
  lastHurtAt: -99,
  mission: { idx: 0, stepIdx: 0, active: false, timer: 0, data: {}, steps: [] },
  missionCarWrecked: false,
  shake: 0,
  muzzle: 0,
  banner: null,
  hudFlash: 0,
  sprayMsg: 0,
  stats: { stolen: 0, kills: 0, missions: 0, sprays: 0 },
  nearestCar: null,
  nearSpray: false,
  shotMode: !!shotName,
};

G.player = createPlayer(G.city);
G.player.money = G.save.money;

// Debug / playtest handle: the Playwright harness reads the live state
// through this (position, mission step, wanted level, errors). It does
// not change how the game plays.
window.__game = G;

// ---- helpers the feature modules call back into -----------------------
G.addText = function (x, y, text, color) {
  G.floatTexts.push({ x, y, text, color: color || '#ffffff', life: 1.6 });
};
G.addBanner = function (title, sub) {
  G.banner = { title, sub, t: 4 };
};
G.burst = function (x, y, color, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    out.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5, max: 0.9,
      color, size: 2 + Math.random() * 4, smoke: false,
    });
  }
  return out;
};
G.raiseWanted = function (amount, why) { raiseWanted(G, amount, why); };
G.nearCop = function (d) {
  for (const c of G.cops) {
    if (dist(c.x, c.y, G.player.x, G.player.y) < d) return true;
  }
  return false;
};
G.saveGame = function () { writeSave(G); };

G.busted = function () {
  if (G.state !== 'play') return;
  const m = G.mission;
  if (m && m.active) {
    m.active = false;
    m.failedIdx = m.idx;
    m.failedReason = '被警察抓住了';
  }
  clearWanted(G, 'busted');
  G.player.money = Math.max(0, G.player.money - 150);
  respawn(G);
  G.state = 'busted';
  G.audio.busted();
  G.saveGame();
};

G.wasted = function () {
  if (G.state !== 'play') return;
  const m = G.mission;
  if (m && m.active) {
    m.active = false;
    m.failedIdx = m.idx;
    m.failedReason = 'Milo 倒下了';
  }
  clearWanted(G, 'wasted');
  G.player.money = Math.floor(G.player.money * 0.8);
  respawn(G);
  G.state = 'wasted';
  G.audio.busted();
  G.saveGame();
};

function respawn(G) {
  const p = G.player;
  if (p.car) {
    p.car.driver = 'none';
    p.car = null;
  }
  p.onFoot = true;
  p.x = G.city.poi.playerStart.x;
  p.y = G.city.poi.playerStart.y;
  p.health = p.maxHealth;
  p.bustedTimer = 0;
  p.invuln = 2;
  G.cam.x = p.x;
  G.cam.y = p.y;
  G.enemies.length = 0;
  G.bullets.length = 0;
}

// ---- world setup -------------------------------------------------------
function resetWorld() {
  G.cars.length = 0;
  G.peds.length = 0;
  G.cops.length = 0;
  G.enemies.length = 0;
  G.bullets.length = 0;
  G.particles.length = 0;
  G.pickups.length = 0;
  G.skids.length = 0;
  G.floatTexts.length = 0;
  G.wanted = 0;
  G.wantedDecay = 0;
  G.missionCarWrecked = false;
  G.mission = { idx: 0, stepIdx: 0, active: false, timer: 0, data: {}, steps: [] };
  spawnTraffic(G, 14);
  spawnParkedCars(G);
  spawnPedestrians(G, 24);
  // A few pickups around town.
  G.pickups.push(
    { x: 760, y: 340, kind: 'ammo', taken: false },
    { x: 1760, y: 1180, kind: 'health', taken: false },
    { x: 300, y: 760, kind: 'ammo', taken: false },
    { x: 2260, y: 1600, kind: 'health', taken: false },
  );
}

function startGame() {
  resetWorld();
  const p = G.player;
  p.x = G.city.poi.playerStart.x;
  p.y = G.city.poi.playerStart.y;
  p.onFoot = true;
  p.car = null;
  p.health = p.maxHealth;
  p.ammo = Math.max(p.ammo, 24);
  G.cam.x = p.x;
  G.cam.y = p.y;
  G.state = 'play';
  G.audio.ensure();
  // Jump straight into the next unlocked job so the player is playing
  // within seconds of the title screen.
  if (!G.save.storyDone) {
    startMission(G, Math.min(G.save.missionUnlocked, MISSIONS.length - 1));
  }
}

// ---- one simulation step ----------------------------------------------
G.step = function (dt, quiet) {
  G.time += dt;
  if (G.wantedFlash > 0) G.wantedFlash -= dt;
  if (G.hudFlash > 0) G.hudFlash -= dt;
  if (G.sprayMsg > 0) G.sprayMsg -= dt;
  if (G.muzzle > 0) G.muzzle -= dt;
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
  for (const t of G.floatTexts) { t.life -= dt; t.y -= 14 * dt; }
  G.floatTexts = G.floatTexts.filter((t) => t.life > 0);
  for (const s of G.skids) s.life -= dt * 0.25;
  G.skids = G.skids.filter((s) => s.life > 0);
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);

  if (G.state !== 'play') return;

  const input = G.input;
  const p = G.player;

  // Mouse position in world coordinates (for aiming).
  input.mouse.wx = G.cam.x - VIEW.w / 2 + input.mouse.x;
  input.mouse.wy = G.cam.y - VIEW.h / 2 + input.mouse.y;

  if (!quiet) {
    // One-shot keys.
    if (wasPressed(input, 'm')) {
      const muted = G.audio.toggleMute();
      G.addText(p.x, p.y - 30, muted ? '已静音' : '声音开启', '#cfe8ff');
    }
    if (wasPressed(input, 'Escape', 'p')) {
      G.state = 'pause';
      G.audio.ensure();
      return;
    }
    if (wasPressed(input, 't')) {
      if ((!G.mission || !G.mission.active) && !G.save.storyDone) {
        startMission(G, Math.min(G.save.missionUnlocked, MISSIONS.length - 1));
      }
    }
    if (wasPressed(input, 'e')) {
      if (p.onFoot) {
        const near = nearestEnterableCar(G, 64);
        if (near) enterCar(G, near.car);
      } else {
        exitCar(G);
      }
    }
  }

  // Player movement / driving.
  if (p.onFoot) {
    updatePlayerOnFoot(G, dt);
  } else if (p.car) {
    const ctrl = quiet ? { throttle: false, brake: false, steer: 0, handbrake: false } : playerDriveControls(G);
    stepCar(G, p.car, dt, ctrl);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (p.car.wrecked) {
      // stepCar's damage path ejects the player; sync the flags.
      p.car = null;
      p.onFoot = true;
    }
  }

  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  if (G.state !== 'play') return;
  updatePolice(G, dt);
  if (G.state !== 'play') return;
  updateCombat(G, dt);
  if (G.state !== 'play') return;
  updateMissions(G, dt);
  if (G.state !== 'play') return;

  // Car vs car collisions (all pairs).
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      if (cars[i].wrecked && cars[j].wrecked) continue;
      collideCars(G, cars[i], cars[j]);
    }
  }

  // HUD context, refreshed every frame.
  G.nearestCar = p.onFoot ? nearestEnterableCar(G, 64) : null;
  const sp = G.city.zones.spray;
  G.nearSpray = p.x > sp.x && p.x < sp.x + sp.w && p.y > sp.y && p.y < sp.y + sp.h;

  // Camera: follow the player with a look-ahead along the velocity.
  let lookX = 0;
  let lookY = 0;
  if (!p.onFoot && p.car) {
    lookX = Math.cos(p.car.angle) * p.car.speed * 0.28;
    lookY = Math.sin(p.car.angle) * p.car.speed * 0.28;
  } else if (p.moving) {
    lookX = Math.cos(p.angle) * 40;
    lookY = Math.sin(p.angle) * 40;
  }
  const tx = clamp(p.x + lookX, VIEW.w / 2, WORLD.w - VIEW.w / 2);
  const ty = clamp(p.y + lookY, VIEW.h / 2, WORLD.h - VIEW.h / 2);
  const k = 1 - Math.pow(0.001, dt);
  G.cam.x += (tx - G.cam.x) * k;
  G.cam.y += (ty - G.cam.y) * k;

  // Audio follows the drive.
  const driving = !p.onFoot && !!p.car;
  G.audio.update(dt, driving, driving ? Math.abs(p.car.speed) / 430 : 0, G.wanted);
};

// ---- rendering ----------------------------------------------------------
function render() {
  if (G.state === 'start') {
    drawStartScreen(G);
    return;
  }
  drawWorld(G);
  if (G.state === 'play' || G.state === 'pause') drawHud(G);
  if (G.state === 'pause') drawPauseScreen(G);
  else if (G.state === 'busted') drawBustedScreen(G);
  else if (G.state === 'wasted') drawWastedScreen(G);
  else if (G.state === 'failed') drawFailedScreen(G);
  else if (G.state === 'complete') drawCompleteScreen(G);
}

// ---- menus / transitions -------------------------------------------------
function handleMenus() {
  const input = G.input;
  if (G.state === 'start') {
    if (wasPressed(input, 'Enter', ' ') || input.mouse.clicked) {
      G.audio.ensure();
      startGame();
    }
    return;
  }
  if (G.state === 'pause') {
    if (wasPressed(input, 'Escape', 'p')) G.state = 'play';
    else if (wasPressed(input, 'r')) {
      const idx = G.mission && G.mission.active ? G.mission.idx
        : (G.mission && G.mission.failedIdx !== undefined ? G.mission.failedIdx : G.save.missionUnlocked);
      resetWorld();
      const p = G.player;
      p.x = G.city.poi.playerStart.x;
      p.y = G.city.poi.playerStart.y;
      p.onFoot = true;
      p.car = null;
      p.health = p.maxHealth;
      G.cam.x = p.x;
      G.cam.y = p.y;
      startMission(G, Math.min(idx, MISSIONS.length - 1));
      G.state = 'play';
    } else if (wasPressed(input, 'q')) {
      G.state = 'start';
    }
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted') {
    if (wasPressed(input, 'Enter', ' ')) G.state = 'play';
    return;
  }
  if (G.state === 'failed') {
    if (wasPressed(input, 'Enter', ' ')) {
      const idx = G.mission.failedIdx !== undefined ? G.mission.failedIdx : G.save.missionUnlocked;
      resetWorld();
      const p = G.player;
      p.x = G.city.poi.playerStart.x;
      p.y = G.city.poi.playerStart.y;
      p.onFoot = true;
      p.car = null;
      p.health = p.maxHealth;
      G.cam.x = p.x;
      G.cam.y = p.y;
      startMission(G, Math.min(idx, MISSIONS.length - 1));
      G.state = 'play';
    }
    return;
  }
  if (G.state === 'complete') {
    if (wasPressed(input, 'Enter', ' ')) G.state = 'play';
    return;
  }
}

// ---- boot ----------------------------------------------------------------
resetWorld();

if (shotName) {
  stageShot(G, shotName, shotSeed);
  // Let the world breathe for a couple of frames, then declare ready.
  let painted = 0;
  const paint = () => {
    render();
    painted++;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleMenus();
    let stepped = false;
    if (G.state === 'play') {
      while (acc >= STEP) {
        G.step(STEP, false);
        stepped = true;
        acc -= STEP;
        if (G.state !== 'play') { acc = 0; break; }
      }
    } else {
      acc = 0;
      // The title screen still animates (time drives the sun / prompt).
      G.time += 1 / 60;
      if (G.banner) {
        G.banner.t -= 1 / 60;
        if (G.banner.t <= 0) G.banner = null;
      }
    }
    render();
    // One-shot presses are only cleared once a fixed step has had a
    // chance to see them (or the game is on a menu, where handleMenus
    // consumed them): on a fast display a frame can run with no step,
    // and clearing here would swallow the press entirely.
    if (stepped || G.state !== 'play') endFrame(G.input);
  };
  requestAnimationFrame(frame);
}
