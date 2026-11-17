// Solmar Heat — save.js
// localStorage save: money, unlocked mission, missions completed and
// best money. Storage may be off (private windows); every call is
// guarded so a failed save never breaks the game.

const KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return {
      money: typeof s.money === 'number' ? s.money : 120,
      missionUnlocked: typeof s.missionUnlocked === 'number' ? s.missionUnlocked : 0,
      missionsDone: typeof s.missionsDone === 'number' ? s.missionsDone : 0,
      bestMoney: typeof s.bestMoney === 'number' ? s.bestMoney : 0,
      storyDone: !!s.storyDone,
    };
  } catch {
    return null;
  }
}

export function writeSave(G) {
  try {
    const s = {
      money: Math.round(G.player.money),
      missionUnlocked: G.save.missionUnlocked,
      missionsDone: G.save.missionsDone,
      bestMoney: Math.max(G.save.bestMoney, Math.round(G.player.money)),
      storyDone: G.save.storyDone,
    };
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: the session keeps playing unsaved.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
