// Solmar Heat — missions.js
// The story: Milo "Ace" Ferran owes Madame Sol a debt and works it off
// over five jobs. Missions run as a chain of steps; each step has a
// short objective line, a map target, and a `done` test. Completing a
// mission pays cash and unlocks the next one; being WASTED or BUSTED
// mid-mission (or wrecking the mission car) fails it, and it can be
// retried from the pause menu or with Enter.

import { dist } from './utils.js';
import { makeCar } from './driving.js';
import { spawnEnemy } from './combat.js';
import { spawnCop, clearWanted } from './police.js';

export const MISSIONS = [
  {
    name: '第一单',
    en: 'First Fare',
    intro: 'Madame Sol：去码头接客人，送到 Downtown。别刮花我的车——哦对，你还没车。',
    reward: 300,
  },
  {
    name: '烫手山芋',
    en: 'Hot Wheels',
    intro: 'Vera：老城停着一辆红色敞篷，是“借”来的好车。开去 Ray 的修车铺，别被条子盯上。',
    reward: 450,
  },
  {
    name: '海滩风云',
    en: 'Beachfront Heat',
    intro: 'Madame Sol：条子盯上你了。甩掉他们——躲开视线，或者开进 Spray Shop 洗掉通缉。',
    reward: 600,
  },
  {
    name: '交货',
    en: 'The Drop',
    intro: 'Ray：公园长椅下有个包裹。取了它——那帮人不肯白给，带上你的枪——再送到码头。',
    reward: 800,
  },
  {
    name: '烈日落幕',
    en: 'Solmar Sunset',
    intro: 'Madame Sol：最后一单。开逃亡车冲到码头、登船，债务一笔勾销。别回头。',
    reward: 1500,
  },
];

const R = 70; // arrival radius for "reach the marker" steps

function marker(x, y, label) {
  return { x, y, label };
}

export function startMission(G, idx) {
  const m = MISSIONS[idx];
  if (!m) return;
  const poi = G.city.poi;
  const mission = {
    idx,
    stepIdx: 0,
    active: true,
    timer: 0,
    data: {},
    steps: [],
  };
  G.mission = mission;
  G.missionCarWrecked = false;
  G.addBanner(m.name + ' · ' + m.en, m.intro);
  G.audio.missionDone();

  if (idx === 0) {
    mission.steps = [
      { text: '前往码头接客人', target: marker(poi.marinaPickup.x, poi.marinaPickup.y, '码头'), done: (G) => dist(G.player.x, G.player.y, poi.marinaPickup.x, poi.marinaPickup.y) < R },
      { text: '上车，送客人到 Downtown', target: marker(poi.downtownDrop.x, poi.downtownDrop.y, 'Downtown'), done: (G) => !G.player.onFoot && dist(G.player.x, G.player.y, poi.downtownDrop.x, poi.downtownDrop.y) < R },
    ];
  } else if (idx === 1) {
    // The red convertible, parked in Old Town.
    const car = makeCar(poi.redCarSpot.x, poi.redCarSpot.y, Math.PI / 2, {
      kind: 'convertible', color: '#d92626', driver: 'none', missionCar: true,
    });
    G.cars.push(car);
    mission.data.car = car;
    mission.steps = [
      { text: '偷走老城的红色敞篷车', target: marker(poi.redCarSpot.x, poi.redCarSpot.y, '红色敞篷'), done: (G) => G.player.car === car },
      { text: '把车送到 Ray 的修车铺', target: marker(poi.sprayDoor.x, poi.sprayDoor.y, '修车铺'), done: (G) => G.player.car === car && dist(G.player.x, G.player.y, poi.sprayDoor.x, poi.sprayDoor.y) < R },
    ];
  } else if (idx === 2) {
    G.wanted = 2;
    spawnCop(G);
    spawnCop(G);
    mission.steps = [
      { text: '甩掉警车：躲开视线 40 秒，或进 Spray Shop 洗掉通缉', target: marker(poi.sprayDoor.x, poi.sprayDoor.y, 'Spray Shop'), done: (G) => G.wanted === 0 || mission.data.escaped >= 40 },
    ];
  } else if (idx === 3) {
    mission.data.packageTaken = false;
    mission.steps = [
      { text: '步行到中央公园取包裹', target: marker(poi.parkPackage.x, poi.parkPackage.y, '包裹'), done: (G) => mission.data.packageTaken },
      { text: '干掉 4 名帮派枪手', target: marker(poi.parkPackage.x, poi.parkPackage.y, '枪手'), done: (G) => G.enemies.filter((e) => e.state !== 'down').length === 0 && mission.data.spawned },
      { text: '把包裹送到码头', target: marker(poi.marinaPickup.x, poi.marinaPickup.y, '码头'), done: (G) => dist(G.player.x, G.player.y, poi.marinaPickup.x, poi.marinaPickup.y) < R },
    ];
  } else if (idx === 4) {
    const car = makeCar(poi.escapeCarSpot.x, poi.escapeCarSpot.y, Math.PI, {
      kind: 'sport', color: '#2b2b2b', driver: 'none', missionCar: true,
    });
    G.cars.push(car);
    mission.data.car = car;
    G.wanted = 3;
    spawnCop(G);
    spawnCop(G);
    spawnCop(G);
    mission.steps = [
      { text: '上逃亡车', target: marker(poi.escapeCarSpot.x, poi.escapeCarSpot.y, '逃亡车'), done: (G) => G.player.car === car },
      { text: '冲到码头登船！', target: marker(poi.pierEnd.x, poi.pierEnd.y, '码头'), done: (G) => G.player.car === car && dist(G.player.x, G.player.y, poi.pierEnd.x, poi.pierEnd.y) < R },
    ];
  }
  G.hudFlash = 1;
}

export function completeMission(G) {
  const m = MISSIONS[G.mission.idx];
  const p = G.player;
  p.money += m.reward;
  G.save.missionsDone = Math.max(G.save.missionsDone, G.mission.idx + 1);
  G.save.missionUnlocked = Math.max(G.save.missionUnlocked, Math.min(G.mission.idx + 1, MISSIONS.length - 1));
  if (G.mission.idx === MISSIONS.length - 1) G.save.storyDone = true;
  G.addBanner('任务完成 · ' + m.name, '报酬 $' + m.reward + ' 已到手。' + (G.mission.idx === MISSIONS.length - 1 ? '债务清零——Milo 自由了。' : '下一单已解锁，按 T 接受。'));
  G.audio.missionDone();
  G.stats.missions++;
  G.mission.active = false;
  G.mission.doneIdx = G.mission.idx;
  if (G.mission.idx === MISSIONS.length - 1) {
    G.state = 'complete';
    G.saveGame();
  } else {
    G.mission = { idx: G.mission.idx, stepIdx: 0, active: false, timer: 0, data: {}, steps: [] };
  }
  G.saveGame();
}

export function failMission(G, reason) {
  if (!G.mission || !G.mission.active) return;
  const m = MISSIONS[G.mission.idx];
  G.addBanner('任务失败 · ' + m.name, reason + '——按 Enter 重开本任务。');
  G.audio.fail();
  G.mission.active = false;
  G.mission.failedIdx = G.mission.idx;
  G.mission.failedReason = reason;
  G.state = 'failed';
  clearWanted(G, 'fail');
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m || !m.active) return;
  const step = m.steps[m.stepIdx];
  if (!step) {
    completeMission(G);
    return;
  }
  // Mission 3: count seconds with no cop in sight.
  if (m.idx === 2) {
    let seen = false;
    for (const c of G.cops) {
      if (dist(c.x, c.y, G.player.x, G.player.y) < 560) { seen = true; break; }
    }
    if (!seen) m.data.escaped = (m.data.escaped || 0) + dt;
    else m.data.escaped = 0;
  }
  // Mission 4: picking up the package spawns the gunmen.
  if (m.idx === 3 && m.stepIdx === 0 && !m.data.packageTaken) {
    const poi = G.city.poi;
    if (G.player.onFoot && dist(G.player.x, G.player.y, poi.parkPackage.x, poi.parkPackage.y) < 34) {
      m.data.packageTaken = true;
      m.data.spawned = true;
      G.addBanner('有埋伏！', '帮派枪手从树后冲出来了！');
      G.audio.busted();
      const spots = [
        { x: 1420, y: 1330 }, { x: 1620, y: 1360 },
        { x: 1400, y: 1560 }, { x: 1640, y: 1580 },
      ];
      for (const s of spots) spawnEnemy(G, s.x, s.y);
    }
  }
  // Wrecked the mission car: fail.
  if (G.missionCarWrecked) {
    G.missionCarWrecked = false;
    failMission(G, '任务车辆被毁');
    return;
  }
  if (step.done(G)) {
    m.stepIdx++;
    G.audio.pickup();
    if (m.stepIdx >= m.steps.length) {
      completeMission(G);
    }
  }
}

// Current objective text for the HUD (or null when free-roaming).
export function currentObjective(G) {
  const m = G.mission;
  if (m && m.active && m.steps[m.stepIdx]) {
    return { text: m.steps[m.stepIdx].text, target: m.steps[m.stepIdx].target, idx: m.idx };
  }
  if (m && m.failedIdx !== undefined && G.state === 'failed') {
    return { text: '任务失败 — 按 Enter 重开', target: null, idx: m.failedIdx };
  }
  if (!m || !m.active) {
    const next = Math.min(G.save.missionUnlocked, MISSIONS.length - 1);
    if (G.save.storyDone) return { text: '自由漫游 — 索尔玛是你的了', target: null, idx: -1 };
    return { text: '按 T 开始任务：' + MISSIONS[next].name, target: null, idx: next };
  }
  return null;
}
