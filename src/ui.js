// Level HUD, 3R action bar, year report and debrief. DOM only: reads game state, changes it only via applyAction.
import { ACTIONS, applyAction, costOf, isWetSeason, freeCrews } from './sim/game.js';
import { evaluate, co2Estimate } from './sim/score.js';
import { seasonAt, TICKS_PER_YEAR } from './sim/season.js';
import { KIND, WET_WT } from './sim/world.js';
import { heatColor } from './render/iso.js';
import { blip } from './audio.js';
import { HUD, R_NAMES, ACTION_TEXT, actionMeta, SELECT_HINT, REASON, REPORT, DEBRIEF, HINTS } from './strings.js';

const $ = id => document.getElementById(id);
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
let G = null, H = null, armed = null, bound = false;
let weeks = [], plantedYear = new Set(), plantedAll = new Set(); // weekly mean peat wt; tiles planted

function meanPeatWt(wd) {
  let s = 0, n = 0;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) { s += wd.wt[i]; n++; }
  return n ? s / n : 0;
}
const alive = (g, set) => [...set].filter(i => g.seedlings.has(i) || g.world.cover[i] >= 1 || g.jobs.some(j => j.i === i && j.id === 'plant')).length;

function tip(msg, x, y) {
  const t = $('tip'); t.textContent = msg; t.hidden = false;
  t.style.left = `${Math.min(x, innerWidth - t.offsetWidth - 8)}px`; t.style.top = `${Math.max(8, y - 40)}px`;
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2000);
}

function arm(id) {
  armed = armed === id ? null : id;
  for (const b of $('bar').querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === armed);
  $('barHint').textContent = armed ? ACTION_TEXT[armed][1] : SELECT_HINT;
}

function bind() {
  bound = true;
  const groups = {};
  for (const [id, a] of Object.entries(ACTIONS)) (groups[a.r] ??= []).push(id);
  $('barGroups').replaceChildren(...['rewet', 'reveg', 'revit', 'defense'].map(r => {
    const g = document.createElement('div'), h = document.createElement('span');
    g.className = 'grp'; h.textContent = R_NAMES[r]; g.append(h);
    for (const id of groups[r]) {
      const b = document.createElement('button'), s = document.createElement('small');
      b.dataset.id = id; b.textContent = ACTION_TEXT[id][0]; b.title = ACTION_TEXT[id][1]; b.append(s);
      b.onclick = () => { blip(880, 0.04); arm(id); b.blur(); };
      g.append(b);
    }
    return g;
  }));
  const speed = { bPause: 0, bX1: 1, bX2: 2 };
  for (const [id, s] of Object.entries(speed)) { $(id).textContent = HUD[id.slice(1).toLowerCase()]; $(id).onclick = e => { H.setSpeed(s); e.currentTarget.blur(); }; }
  $('bData').onclick = e => { H.toggleData(); e.currentTarget.blur(); }; // blur: Space must pause, not re-toggle
  const [c0, c40, c150] = [0, WET_WT, 1.5].map(v => rgb(heatColor(v)));
  $('legendBar').style.background = `linear-gradient(90deg,${c0},${c40} ${(WET_WT / 1.5 * 100).toFixed(1)}%,${c150})`;
  $('legend').title = HUD.legendTitle;
  [...$('legend').querySelectorAll('i')].forEach((el, k) => { el.textContent = HUD.legend[k]; });
  $('legendMark').style.left = $('legend').querySelectorAll('i')[1].style.left = `${(WET_WT / 1.5 * 100).toFixed(1)}%`;
  $('hudKeys').textContent = HUD.keys;
  for (const id of ['rpChart', 'dbChart']) $(id).setAttribute('aria-label', REPORT.chartAria);
  // canvas-only listener: clicks on HUD/panels never reach it; drags are pans, not taps
  H.canvas.addEventListener('click', e => {
    if (!G || !armed || H.map.wasDrag || !H.isLevel()) return;
    const i = H.map.pickTile(e);
    if (i == null) return;
    const r = applyAction(G, armed, i);
    if (!r.ok) { blip(160, 0.08, 'square'); return tip(REASON[r.reason], e.clientX, e.clientY); }
    blip(1100, 0.05);
    if (armed === 'plant') { plantedYear.add(i); plantedAll.add(i); }
  });
}

// Per level. handlers: { canvas, map, isLevel(), setSpeed(s; 0 = pause), toggleData() }
export function initUI(game, handlers) {
  G = game; H = handlers; weeks = []; plantedYear = new Set(); plantedAll = new Set();
  if (!bound) bind();
  armed = null; arm(null); // clears the selection
}

// After every sim step: one mean-wt sample per week for the year-report chart.
export function afterStep(game) {
  if (game.tick % 4) return;
  weeks.push(meanPeatWt(game.world));
  if (weeks.length > 52) weeks.shift();
}

export function renderUI(game, { paused, speed, data }) {
  const wd = game.world, year = Math.floor(game.tick / TICKS_PER_YEAR), { week } = seasonAt(game.tick);
  let peat = 0, wet = 0;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) { peat++; if (wd.wt[i] <= WET_WT) wet++; }
  $('hudTime').textContent = HUD.time(Math.min(year + 1, game.level.years), game.level.years, isWetSeason(game), week + 1);
  $('hudStats').textContent = HUD.stats(game.funds, freeCrews(game), game.crews.length,
    Math.round(game.goodwill), peat ? Math.round(wet / peat * 100) : 0);
  $('bPause').classList.toggle('on', paused); $('bX1').classList.toggle('on', !paused && speed === 1); $('bX2').classList.toggle('on', !paused && speed === 2);
  $('bData').textContent = data ? HUD.mapView : HUD.dataView;
  for (const b of $('barGroups').querySelectorAll('button')) {
    const id = b.dataset.id, c = costOf(game, id);
    b.lastChild.textContent = actionMeta(c, ACTIONS[id].weeks);
    b.classList.toggle('poor', c > game.funds);
  }
}

function chart(cv, data) {
  const ctx = cv.getContext('2d'), W = cv.width, Hh = cv.height, pad = 6, min = -0.3, max = Math.max(1, ...data); // wt clamp floor -0.3
  const y = v => pad + (Hh - 2 * pad) * (Math.max(min, Math.min(max, v)) - min) / (max - min); // depth grows downward
  ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, W, Hh);
  ctx.fillStyle = '#5ff0ff'; for (let x = 0; x < W; x += 6) ctx.fillRect(x, Math.round(y(WET_WT)), 3, 1);
  ctx.font = '16px VT323'; ctx.fillText(REPORT.line40, pad + 2, y(WET_WT) + 14);
  ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v, k) => ctx[k ? 'lineTo' : 'moveTo'](pad + (W - 2 * pad) * k / Math.max(1, data.length - 1), y(v)));
  ctx.stroke();
}

function lines(el, list) {
  el.replaceChildren(...list.map(t => Object.assign(document.createElement('p'), { textContent: t })));
}

export function showYearReport(game, year, elNino) {
  $('rpTitle').textContent = REPORT.title(year + 1);
  $('rpChartLabel').textContent = REPORT.chart;
  chart($('rpChart'), weeks);
  lines($('rpBody'), [
    REPORT.burnt((game.burnt.size / game.world.n * 100).toFixed(0)),
    REPORT.seedlings(alive(game, plantedYear), plantedYear.size),
    REPORT.goodwill(Math.round(game.goodwill)),
    REPORT.grant(game.level.grant, game.funds),
  ]);
  $('rpElNino').textContent = REPORT.elNino; $('rpElNino').hidden = !elNino;
  $('rpCont').textContent = REPORT.cont;
  plantedYear = new Set();
}

function thumb(cv, w, h, wt) {
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const c = heatColor(wt[i]); img.data.set([c[0], c[1], c[2], 255], i * 4); }
  ctx.putImageData(img, 0, 0);
}

export function showDebrief(game) {
  const r = evaluate(game), loss = r.loss, p = game.level.pass, co2 = co2Estimate(game), wd = game.world;
  $('dbTitle').textContent = DEBRIEF.title;
  const sb = game.level.sandbox; // sandbox: figures only, no pass verdict
  $('dbStars').textContent = sb ? '' : DEBRIEF.stars(r.stars);
  $('dbBody').textContent = loss ? DEBRIEF.loss[loss] : sb ? DEBRIEF.sandbox : r.passed ? DEBRIEF.passed : DEBRIEF.failed;
  thumb($('dbBefore'), wd.w, wd.h, game.wt0); thumb($('dbAfter'), wd.w, wd.h, wd.wt);
  $('dbBeforeL').textContent = DEBRIEF.before; $('dbAfterL').textContent = DEBRIEF.after; $('dbThumbs').title = DEBRIEF.thumbs;
  $('dbGoalsTitle').textContent = DEBRIEF.goalsTitle;
  lines($('dbGoals'), sb ? DEBRIEF.figures(r) : DEBRIEF.goals(r, p));
  $('dbDataTitle').textContent = DEBRIEF.dataTitle;
  chart($('dbChart'), weeks);
  lines($('dbData'), [DEBRIEF.avoided(co2.avoidedTC), DEBRIEF.fire(co2.fireTC), DEBRIEF.seedlings(alive(game, plantedAll), plantedAll.size)]);
  // one hint: the early-loss cause, else the first unmet goal
  $('dbHint').textContent = loss ? DEBRIEF.lossHint[loss] : sb ? '' : r.hints.length ? HINTS[r.hints[0]] : DEBRIEF.allMet;
  $('dbMenu').textContent = DEBRIEF.menu;
}
