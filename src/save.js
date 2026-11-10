// The only module that touches localStorage. Pure helpers take an injected `storage` ({getItem, setItem, removeItem?}).
export const SAVE_KEY = 'rewet_v1';
export const MAX_LEVEL = 6; // levels above this are the sandbox; unlocked = MAX_LEVEL + 1 opens it
export const DEFAULT_SAVE = { version: 1, unlocked: 1, stars: {}, upgrades: { crew: 0, cheapBlocks: 0, fastCrew: 0 }, settings: { mute: false } };
export const UPGRADE_COST = { crew: 3, cheapBlocks: 3, fastCrew: 4 };

// Lazy methods: merely reading `localStorage` can throw when storage is blocked, and the callers here catch that.
export const browserStorage = { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: (k) => localStorage.removeItem(k) };

const fresh = () => structuredClone(DEFAULT_SAVE);
const num = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Rebuilds the save field by field, so junk in a hand-edited or damaged save cannot reach the game.
function sanitize(o) {
  if (!o || typeof o !== 'object' || o.version !== 1) return null;
  const s = fresh();
  if (num(o.unlocked, 1, MAX_LEVEL + 1)) s.unlocked = o.unlocked;
  for (let id = 1; id <= MAX_LEVEL; id++) if (num(o.stars?.[id], 1, 3)) s.stars[id] = o.stars[id];
  for (const k of Object.keys(UPGRADE_COST)) if (o.upgrades?.[k] === 1) s.upgrades[k] = 1;
  s.settings.mute = o.settings?.mute === true;
  return s;
}

export function writeSave(storage, save) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function loadSave(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); } catch { return fresh(); }
  if (raw == null) return migrate(storage);
  try { return sanitize(JSON.parse(raw)) ?? fresh(); } catch { return fresh(); }
}

// Prototype keys: rewet_mute ('1' = muted) and rewet_save ({started} only, no progress).
function migrate(storage) {
  const s = fresh();
  try {
    if (storage.getItem('rewet_mute') === '1') s.settings.mute = true;
    if (typeof storage.removeItem === 'function') {
      const had = storage.getItem('rewet_mute') != null || storage.getItem('rewet_save') != null;
      storage.removeItem('rewet_mute'); storage.removeItem('rewet_save');
      if (had) writeSave(storage, s);
    }
  } catch { /* storage blocked: the fresh save is still usable in memory */ }
  return s;
}

export function clearSave(storage) {
  try { storage.removeItem(SAVE_KEY); } catch { /* blocked storage: nothing to delete */ }
}

export const totalStars = (save) => Object.values(save.stars).reduce((a, b) => a + b, 0);
export const spentStars = (save) => Object.entries(UPGRADE_COST).reduce((a, [k, c]) => a + (save.upgrades[k] ? c : 0), 0);
export const availableStars = (save) => totalStars(save) - spentStars(save);
export const hasProgress = (save) => save.unlocked > 1 || totalStars(save) > 0;

export function recordResult(save, levelId, stars) {
  const s = structuredClone(save);
  if (levelId > MAX_LEVEL) { s.unlocked = Math.max(s.unlocked, MAX_LEVEL + 1); return s; } // sandbox: no stars
  if (stars > 0) {
    s.stars[levelId] = Math.max(s.stars[levelId] || 0, stars);
    s.unlocked = Math.max(s.unlocked, Math.min(levelId + 1, MAX_LEVEL + 1));
  }
  return s;
}

export function buyUpgrade(save, id) {
  if (!Object.hasOwn(UPGRADE_COST, id)) return { error: 'unknown' };
  if (save.upgrades[id]) return { error: 'owned' };
  if (availableStars(save) < UPGRADE_COST[id]) return { error: 'stars' };
  const s = structuredClone(save);
  s.upgrades[id] = 1;
  return s;
}
