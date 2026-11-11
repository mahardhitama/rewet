// Work crews: 1 to 3 people walk to each job tile, work there, and walk away when the job ends. A guard stands at each fire group post.
// Display only. This module reads game.jobs and game.fireGroups and never writes to the game.
import { KIND } from '../sim/world.js';

const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp01 = v => Math.max(0, Math.min(1, v));

export const PS = 12; // person sprite size in px; the feet are at the bottom centre (column 6)
export const WALK_MS = 800, STAY_MS = 600, WORK_FRAME_MS = 300, WALK_FRAME_MS = 150, GUARD_MS = 5000;

// Person frames, facing right. Keys: k skin, s shirt, p trousers, h hat or hair, t wood, m metal, w water, g plant green, b sack, e peat.
// All rows put the body on columns 4 to 8 and the feet on the last row.
const STAND = ['.....hhh....', '.....kkk....', '....sssss...', '....sssss...', '....ksssk...', '.....ppp....', '.....p.p....', '.....p.p....'];
const KNEEL = ['.....hhh....', '.....kkk....', '....sssss...', '....sssss...', '....ssssk...', '....pppp....', '...ppp.p....'];
const legs = (rows, l) => rows.slice(0, -2).concat(l ? ['....p...p...', '....p...p...'] : ['.....pp.....', '.....pp.....']);
export const FRAMES = {
  walk: [legs(['.....hhh....', '.....kkk....', '.....sss....', '....ssss....', '....ksssk...', '.....ppp....', '', ''], 1),
    legs(['.....hhh....', '.....kkk....', '.....sss....', '.....sss....', '.....ssk....', '.....ppp....', '', ''], 0)],
  stand: [STAND, STAND],
  look: [['....hhh.....', '....kkk.....', ...STAND.slice(2)], ['......hhh...', '......kkk...', ...STAND.slice(2)]], // the head turns left, then right
  shade: [['.....hhh....', '.....kkkk...', '....sssssk..', '....sssss...', '....ksss....', '.....ppp....', '.....p.p....', '.....p.p....'], STAND],
  sackCarry: [['.....hhhbb..', '.....kkkbbb.', '....sssssbb.', '....ssssk...', '....sssss...', '.....ppp....', '.....p.p....', '.....p.p....'],
    legs(['.....hhhbb..', '.....kkkbbb.', '....sssssbb.', '....ssssk...', '....sssss...', '.....ppp....', '', ''], 1)],
  sackStack: [['.......hhh..', '....sssskkk.', '....sssssk..', '....ssss.bbb', '.....ppp.bbb', '.....p.p....', '.....p.p....'],
    ['.......hhh..', '....ssssskk.', '....sssss.k.', '.....ppp.bbb', '.....p.p.bbb', '.....p.p.bbb']],
  stamp: [['.....hhh....', '.....kkk....', '....sssss...', '....sssss...', '....ksssk...', '.....ppp....', '.....p..p...', '.....p......', '...bbbbbbb..'],
    ['.....hhh....', '.....kkk....', '....sssss...', '....sssss...', '....ksssk...', '.....ppp....', '....p..p....', '.......p....', '...bbbbbbb..']],
  hammer: [['..........mm', '.....hhh..t.', '.....kkk.t..', '....sssssk..', '....sssss...', '....ssss....', '.....ppp....', '.....p.p..t.', '.....p.p..t.'],
    ['.....hhh....', '.....kkk....', '....ssssskt.', '....sssss.mm', '....ssss..t.', '.....ppp..t.', '.....p.p..t.', '.....p.p..t.']],
  plank: [['.....hhh....', '.....kkk....', 'ttttttttttt.', '....sssss...', '....ksssk...', '.....ppp....', '.....p.p....', '.....p.p....'],
    legs(['.....hhh....', '.....kkk....', '.ttttttttttt', '....sssss...', '....ksssk...', '.....ppp....', '', ''], 1)],
  post: [['.........t..', '.....hhh.t..', '.....kkk.t..', '....sssskt..', '....sssskt..', '....ssss.t..', '.....ppp.t..', '.....p.p.t..', '.....p.p.t..'],
    ['..........t.', '.....hhh..t.', '.....kkk.t..', '....sssskt..', '....sssskt..', '....ssss.t..', '.....ppp.t..', '.....p.p.t..', '.....p.p.t..']],
  dig: [['.....hhh....', '.....kkk....', '....sssss...', '....ssssk...', '....sssstk..', '.....ppp.t..', '.....p.p.t..', '.....p.p.mm.'],
    ['.....hhh....', '.....kkk.ee.', '....ssssskmm', '....sssst...', '....ssst....', '.....ppp....', '.....p.p....', '.....p.p....']],
  throw: [['.....hhh....', '.....kkk....', '....sssss...', '...tsssss...', '..t.ssss....', '.mm..ppp....', '.....p.p....', '.....p.p....'],
    ['.....hhh...e', '.....kkk..e.', '....ssssskmm', '....sssst...', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....']],
  barrow: [['.....hhh....', '.....kkk....', '....sssss...', '....ssssskk.', '....sssss.tt', '.....ppp.eee', '.....p.p.mmm', '.....p.p..m.'],
    legs(['.....hhh....', '.....kkk....', '....sssss...', '....ssssskk.', '....sssss.tt', '.....ppp.eee', '', ''], 1).map((r, y) => (y > 5 ? r.slice(0, 9) + (y === 6 ? 'mmm' : '.m.') : r))],
  pump: [['..........t.', '.....hhh..t.', '.....kkk..k.', '....sssssk..', '....sssss.m.', '....ssss..m.', '.....ppp..m.', '.....p.p..m.', '.....p.p.mmm'],
    ['............', '.....hhh....', '.....kkk....', '....sssss.m.', '....sssssktt', '....ssss..m.', '.....ppp..m.', '.....p.p..m.', '.....p.p.mmm']],
  pipe: [['.........m..', '.....hhh.m..', '.....kkk.m..', '....sssskm..', '....ssss.m..', '....ssssk...', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['.........m..', '.....hhh.m..', '.....kkk.m..', '....ssss.m..', '....sssskm..', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....']],
  hoseKneel: [['.....hhh....', '.....kkk....', '....sssss...', '....sssssk..', '....pppp.m..', '...ppp.pmmmm'],
    ['.....hhh....', '.....kkk....', '....sssss...', '....ssssss..', '....pppp.k..', '...ppp.pmmmm']],
  seedling: [['.....hhh....', '.....kkk....', '....sssss...', '....sssssk..', '....pppp.g..', '...ppp.p.g..'],
    ['.....hhh....', '.....kkk....', '....sssss...', '....ssssss..', '....pppp.kg.', '...ppp.p.gg.']],
  dibble: [['.....hhh..t.', '.....kkk..t.', '....sssssk..', '....sssss...', '....ksss....', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['.....hhh....', '.....kkk....', '....sssss...', '....ssssskt.', '....ksss..t.', '.....ppp..t.', '.....p.p..t.', '.....p.p..t.']],
  tray: [['.....hhh....', '.....kkk....', '....sssssgg.', '....ssssttt.', '....sssss...', '.....ppp....', '.....p.p....', '.....p.p....'],
    legs(['.....hhh....', '.....kkk....', '....sssssgg.', '....ssssttt.', '....sssss...', '.....ppp....', '', ''], 1)],
  hoe: [['..........mm', '.....hhh.t..', '.....kkkt...', '....sssk....', '....sssss...', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['.....hhh....', '.....kkk....', '....ssssskt.', '....sssss..t', '....ssss...t', '.....ppp...t', '.....p.p..mm', '.....p.p....']],
  pat: [['.....hhh....', '.....kkk....', '....sssss...', '....sssssk..', '....pppp.kee', '...ppp.peeee'],
    ['.....hhh....', '.....kkk....', '....ssssskk.', '....sssss...', '....pppp.eee', '...ppp.peeee']],
  basket: [['....bbbbb...', '.....bbb....', '.....kkk....', '....sssss...', '....sssss...', '....ksssk...', '.....ppp....', '.....p.p....', '.....p.p....'],
    legs(['....bbbbb...', '.....bbb....', '.....kkk....', '....sssss...', '....sssss...', '....ksssk...', '.....ppp....', '', ''], 1)],
  weed: [['.....hhh....', '.....kkk....', '....sssss.g.', '....ssssskg.', '....pppp.g..', '...ppp.p.g..'],
    ['.....hhh....', '.....kkk..g.', '....ssssskg.', '....sssss...', '....pppp.g..', '...ppp.p....']],
  net: [['.....hhh....', '.....kkk....', '....sssssmm.', '....ssssmmm.', '....ksss....', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['.....hhh...m', '.....kkk.m.m', '....sssssk.m', '....sssss.m.', '....ssss.m.m', '.....ppp....', '.....p.p....', '.....p.p....']],
  bucket: [['.......hhh..', '....sssskkk.', '....sssssk..', '....ssss.mm.', '.....ppp.mm.', '.....p.p....', '.....p.p....'],
    ['.....hhh....', '.....kkk....', '....sssss.w.', '....ssssskmm', '....sssss.mm', '.....ppp....', '.....p.p....', '.....p.p....']],
  hose: [['.........w..', '.....hhh.w.w', '.....kkk...w', '....ssssmm..', '....sssk....', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['..........w.', '.....hhh..w.', '.....kkk.w.w', '....ssssmm.w', '....sssk....', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....']],
  beater: [['.........mm.', '.....hhh.mm.', '.....kkk.t..', '....sssskt..', '....sssss...', '....ssss....', '.....ppp....', '.....p.p....', '.....p.p....'],
    ['.....hhh....', '.....kkk....', '....ssssskt.', '....sssss..t', '....ssss...t', '.....ppp..mm', '.....p.p..mm', '.....p.p....']],
  backpack: [['.....hhh....', '....mkkk....', '...msssss...', '...mssssskm.', '...msssss..w', '.....ppp...w', '.....p.p....', '.....p.p....'],
    ['.....hhh....', '....mkkk....', '...msssss...', '...mssssskm.', '...msssss.w.', '.....ppp..w.', '.....p.p.w..', '.....p.p....']],
};

// Poses for each job type, and the crew size range [min, max].
export const CREW = {
  tempBlock: { size: [2, 3], poses: ['sackCarry', 'sackStack', 'stamp'] },
  permBlock: { size: [2, 3], poses: ['hammer', 'plank', 'post'] },
  backfill: { size: [3, 3], poses: ['dig', 'throw', 'barrow'] },
  well: { size: [1, 2], poses: ['pump', 'pipe', 'hoseKneel'] },
  plant: { size: [2, 3], poses: ['seedling', 'dibble', 'tray'] },
  mound: { size: [1, 2], poses: ['hoe', 'pat'] },
  palud: { size: [1, 2], poses: ['hoe', 'basket', 'weed'] },
  pond: { size: [2, 2], poses: ['net', 'bucket', 'dig'] },
  fireCrew: { size: [3, 3], poses: ['hose', 'beater', 'backpack'], fire: true },
  fireGroup: { size: [2, 2], poses: ['post', 'hammer'] },
  guard: { size: [1, 1], poses: ['stand', 'look', 'walk', 'shade'] },
};

// Clothes: 4 palettes, 2 skin tones and 4 hat types. The fire crew always wears yellow and a red helmet.
const SHIRTS = ['#3c7ec8', '#e2683e', '#f6eed8', '#4e9e4e'], TROUSERS = ['#3a3430', '#4a4a5a', '#5a4632', '#2e3a4a'];
const SKIN = ['#d8955e', '#b07244'], HATS = ['straw', 'cap', 'scarf', 'none'], HAT_COL = { straw: '#f0d47c', cap: '#2e6aa8', scarf: '#c8406a', none: '#2a2018', helmet: '#d23a2a' };
const TOOLS = { t: '#8a5a32', m: '#9aa0a4', w: '#8ad0f0', g: '#5aa040', b: '#c8b088', e: '#4a3424' };

// Pure. The pal for person k of the job with key seed: { k, s, p, h, hat }.
export function crewPal(seed, k, fire = false) {
  const r = n => Math.floor(hash(seed * 13.7 + k * 3.1 + n) * 4);
  const hat = fire ? 'helmet' : HATS[r(1)];
  return { k: SKIN[r(2) & 1], s: fire ? '#e8c030' : SHIRTS[r(3)], p: TROUSERS[r(4)], h: HAT_COL[hat], hat };
}

const sprites = new Map();
// Builds the sprite of one frame the first time, then keeps it. The hat type changes the h pixels of the lowest hat row.
export function personSprite(pose, frame, pal, flip) {
  const key = `${pose}/${frame}/${pal.k}${pal.s}${pal.p}${pal.h}${pal.hat}/${flip ? 1 : 0}`;
  let c = sprites.get(key);
  if (c) return c;
  const rows = FRAMES[pose][frame], oy = PS - rows.length, px = new Map();
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') px.set(x + ',' + (oy + y), ch); }));
  const hy = rows.findIndex(r => r.includes('h')); // the hat row (none for a basket on the head)
  if (hy >= 0) {
    const r = rows[hy], a = r.indexOf('h'), z = r.lastIndexOf('h'), y = oy + hy;
    if (pal.hat === 'straw') { px.set(a - 1 + ',' + y, 'h'); px.set(z + 1 + ',' + y, 'h'); }
    else if (pal.hat === 'cap' || pal.hat === 'helmet') px.set(z + 1 + ',' + y, 'h');
    else if (pal.hat === 'scarf') px.set(a + ',' + (y + 1), 'h');
  }
  c = document.createElement('canvas'); c.width = c.height = PS;
  const g = c.getContext('2d');
  for (const [xy, ch] of px) {
    const [x, y] = xy.split(',').map(Number);
    g.fillStyle = pal[ch] ?? TOOLS[ch];
    g.fillRect(flip ? PS - 1 - x : x, y, 1, 1);
  }
  sprites.set(key, c);
  return c;
}

const keySeed = key => { let s = 0; for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 100003; return s; };
const SPOTS = [[0, 1], [-7, -1], [7, -1]]; // screen px offsets from the tile centre for persons 0, 1 and 2

// Pure. The crew of a job: [{ tile, pose, pal, ox, oy, flip, from: [tx, ty] }]. from is in tile units; tile x, y are integers.
// type: an ACTIONS id or 'guard'. tiles: the tiles of a plant job, or undefined.
export function crewPlan(type, i, key, w, h, kind, tiles) {
  const spec = CREW[type], seed = keySeed(key), r = n => hash(seed + n * 7.3);
  const [lo, hi] = spec.size, size = lo + Math.floor(r(0) * (hi - lo + 1));
  let vx = 1, vy = 1, best = Infinity; // walk in from the nearest village; with no village, from the bottom of the screen
  const x0 = i % w, y0 = (i / w) | 0;
  for (let j = 0; j < w * h; j++) if (kind[j] === KIND.VILLAGE && j !== i) {
    const dx = j % w - x0, dy = ((j / w) | 0) - y0, d = dx * dx + dy * dy;
    if (d < best) { best = d; vx = dx; vy = dy; }
  }
  const n = Math.hypot(vx, vy) || 1;
  const out = [], first = Math.floor(r(1) * spec.poses.length);
  for (let k = 0; k < size; k++) {
    const tile = tiles?.length ? tiles[Math.floor(k * tiles.length / size)] : i;
    const [sx, sy] = type === 'guard' ? [8, -4] : tiles?.length > 1 ? SPOTS[0] : SPOTS[k]; // a guard stands left of the red post
    const back = spec.fire ? 0.7 : 0; // the fire crew stands 0.7 tile back from the flames, on the side it came from (1 tile = 16 px across, 8 px down)
    const ox = sx + Math.round(r(10 + k) * 4 - 2 + back * (vx - vy) / n * 16), oy = sy + Math.round(r(20 + k) * 2 - 1 + back * (vx + vy) / n * 8);
    const tx = tile % w, ty = (tile / w) | 0;
    out.push({ tile, pose: spec.poses[(first + k) % spec.poses.length], pal: crewPal(seed, k, spec.fire), ox, oy,
      flip: spec.fire ? vx - vy < 0 : ox > 2 || (ox >= -2 && r(30 + k) < 0.5), // the fire crew faces the fire
      from: type === 'guard' ? [tx, ty] : [tx + 2 * vx / n, ty + 2 * vy / n] });
  }
  return out;
}

// Pure. The pose of a guard at time now: it changes every GUARD_MS, with a phase for each tile.
export const guardPose = (i, now) => CREW.guard.poses[(Math.floor(now / GUARD_MS + hash(i)) + Math.floor(hash(i * 5.1) * 4)) % 4];

// Crew state by key: { plan, seenAt, leaveAt, f }. f is the draw frame that last saw the job.
const crews = new Map();
export const resetCrews = () => crews.clear();
export const crewCount = () => crews.size;

// Marks the crew of key as seen in this frame. make() builds the plan the first time.
export function crewSeen(key, now, frame, make, map = crews) {
  let s = map.get(key);
  if (!s) map.set(key, s = { plan: make(), seenAt: now, leaveAt: -1, f: frame });
  s.f = frame;
  if (s.leaveAt >= 0) s.leaveAt = -1; // the job came back (the same key): stay
  return s;
}
// Starts the walk away of each crew that this frame did not see, and deletes each crew whose walk away ended.
// A crew works at least STAY_MS after it arrives.
export function crewSweep(now, frame, map = crews) {
  for (const [key, s] of map) {
    if (s.f !== frame && s.leaveAt < 0) s.leaveAt = Math.max(now, s.seenAt + WALK_MS + STAY_MS);
    if (s.leaveAt >= 0 && now >= s.leaveAt + WALK_MS) map.delete(key);
  }
}
// Pure. t: 0 at the start point, 1 at the work spot. alpha: 0 to 1. walking: true while the person walks.
export function crewPhase(s, now, out = { t: 0, alpha: 0, walking: false }) {
  if (s.leaveAt >= 0 && now >= s.leaveAt) {
    const u = clamp01((now - s.leaveAt) / WALK_MS);
    out.t = 1 - u; out.alpha = 1 - clamp01(u * 2 - 1); out.walking = u < 1;
  } else {
    const u = clamp01((now - s.seenAt) / WALK_MS);
    out.t = u; out.alpha = clamp01(u * 2); out.walking = u < 1;
  }
  return out;
}
export const crewEntries = () => crews.entries();
export { hash as crewHash };
