// Level HUD, 3R action bar, year report and debrief. DOM only: reads game state, changes it only via applyAction.
import { ACTIONS, applyAction, costOf, isWetSeason, freeCrews, plantWeeks, PLANT_R } from './sim/game.js';
import { evaluate, co2Estimate, dryWetPct, seedlingSurvival } from './sim/score.js';
import { seasonAt, TICKS_PER_YEAR } from './sim/season.js';
import { KIND, WET_WT } from './sim/world.js';
import { heatColor } from './render/iso.js';
import { blip } from './audio.js';
import { icon, setText } from './icons.js';
import { SPECIES } from './journal.js';
import { HUD, BAR, R_NAMES, ACTION_TEXT, actionMeta, SELECT_HINT, REASON, REPORT, DEBRIEF, HINTS } from './strings.js';

const $ = id => document.getElementById(id);
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
let G = null, H = null, armed = null, bound = false, short = null; // short: the media query that shortens the HUD time value
let weeks = []; // weekly mean peat wt

function meanPeatWt(wd) {
  let s = 0, n = 0;
  for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT) { s += wd.wt[i]; n++; }
  return n ? s / n : 0;
}

function tip(msg, x, y) {
  const t = $('tip'); t.textContent = msg; t.hidden = false;
  t.style.left = `${Math.min(x, innerWidth - t.offsetWidth - 8)}px`; t.style.top = `${Math.max(8, y - 40)}px`;
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2000);
}

// The name line shows the hovered or focused slot, else the selected action, else the idle hint.
// The line under it shows the how-to text of that action.
const metaOf = (id, c) => id === 'plant' ? actionMeta(c, plantWeeks((2 * PLANT_R + 1) ** 2), true) : actionMeta(c, ACTIONS[id].weeks);
let hover = null;
function showName() {
  const id = hover ?? armed, n = $('barName'), h = $('barHint');
  const t = id ? BAR.name(ACTION_TEXT[id][0], metaOf(id, costOf(G, id))) : SELECT_HINT, how = id ? ACTION_TEXT[id][1] : '';
  if (n.textContent !== t) n.textContent = t;
  if (h.textContent !== how) h.textContent = how;
  n.classList.toggle('sel', !!id);
}

function arm(id) {
  armed = armed === id ? null : id;
  for (const b of $('slots').querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === armed);
  showName();
}

function bind() {
  bound = true;
  const groups = {};
  for (const [id, a] of Object.entries(ACTIONS)) (groups[a.r] ??= []).push(id);
  const R = ['rewet', 'reveg', 'revit', 'defense'];
  // 2 rows: rewet + reveg, revit + defense. CSS stacks them on a portrait phone.
  $('slots').replaceChildren(...[R.slice(0, 2), R.slice(2)].map(rs => {
    const row = document.createElement('div'); row.className = 'row';
    for (const r of rs) groups[r].forEach((id, k) => {
      const b = document.createElement('button'), s = document.createElement('small');
      b.className = k ? 'slot' : 'slot first'; b.dataset.id = id; b.dataset.r = r; b.title = ACTION_TEXT[id][1]; const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = ACTION_TEXT[id][2]; tag.setAttribute('aria-hidden', 'true');
      b.append(tag, icon(id, 36), s);
      b.onclick = () => { blip(880, 0.04); arm(id); b.blur(); };
      for (const [on, off] of [['pointerenter', 'pointerleave'], ['focus', 'blur']]) {
        b.addEventListener(on, () => { hover = id; showName(); });
        b.addEventListener(off, () => { hover = null; showName(); });
      }
      row.append(b);
    });
    return row;
  }));
  const speed = { bPause: 0, bX1: 1, bX2: 2 };
  for (const [id, s] of Object.entries(speed)) { $(id).textContent = HUD[id.slice(1).toLowerCase()]; $(id).onclick = e => { H.setSpeed(s); e.currentTarget.blur(); }; }
  $('bData').onclick = e => { H.toggleData(); e.currentTarget.blur(); }; // blur: Space must pause, not re-toggle
  // icon and text. The text hides on a phone, so the name goes in aria-label too. renderUI changes the data button text through setText.
  $('bData').textContent = HUD.dataView;
  for (const [id, name] of Object.entries({ bPause: 'pause', bX1: 'play', bX2: 'fast', bData: 'data', bJournal: 'journal' })) {
    const b = $(id), t = Object.assign(document.createElement('span'), { className: 't', textContent: b.textContent });
    b.replaceChildren(icon(name), t); b.setAttribute('aria-label', t.textContent); b.title = t.textContent; // the title is the tooltip when the text is hidden
  }
  for (const p of document.querySelectorAll('#hudRow .part')) p.prepend(icon(p.dataset.id));
  const [c0, c40, c150] = [0, WET_WT, 1.5].map(v => rgb(heatColor(v)));
  $('legendBar').style.background = `linear-gradient(90deg,${c0},${c40} ${(WET_WT / 1.5 * 100).toFixed(1)}%,${c150})`;
  $('legend').title = HUD.legendTitle;
  [...$('legend').querySelectorAll('i')].forEach((el, k) => { el.textContent = HUD.legend[k]; });
  $('legendMark').style.left = $('legend').querySelectorAll('i')[1].style.left = `${(WET_WT / 1.5 * 100).toFixed(1)}%`;
  $('hudKeys').textContent = HUD.keys;
  short = matchMedia('(max-width:1759px), (max-height:500px)');
  for (const id of ['rpChart', 'dbChart']) $(id).setAttribute('aria-label', REPORT.chartAria);
  // canvas-only listener: clicks on HUD/panels never reach it; drags are pans, not taps
  H.canvas.addEventListener('click', e => {
    if (!G || H.map.wasDrag || !H.isLevel()) return;
    if (!armed) { const a = H.map.pickAnimal(e); if (a) H.onFind(a.species); return; } // no action selected: a tap on an animal marks it found
    const i = H.map.pickTile(e);
    if (i == null) return;
    const r = applyAction(G, armed, i);
    if (!r.ok) { blip(160, 0.08, 'square'); return tip(REASON[r.reason], e.clientX, e.clientY); }
    blip(1100, 0.05);
  });
}

// Per level. handlers: { canvas, map, isLevel(), setSpeed(s; 0 = pause), toggleData() }
export function initUI(game, handlers) {
  G = game; H = handlers; weeks = [];
  if (!bound) bind();
  armed = null; hover = null; arm(null); // clears the selection
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
  const parts = HUD.parts({ year: Math.min(year + 1, game.level.years), years: game.level.years, wet: isWetSeason(game), week: week + 1 },
    game.funds, freeCrews(game), game.crews.length, Math.round(game.goodwill), peat ? Math.round(wet / peat * 100) : 0,
    game.dryWtHistory.length ? Math.round(dryWetPct(game)) : null, short.matches); // scored measure: none before the first dry season
  for (const p of parts) {
    const el = $('hudRow').querySelector(`[data-id=${p.id}]`), l = el.querySelector('.l'), v = el.querySelector('.v');
    if (l.textContent !== p.label) l.textContent = p.label;
    if (v.textContent !== p.value) v.textContent = p.value;
    if (el.title !== p.full) { el.title = p.full; el.setAttribute('aria-label', p.full); }
  }
  $('bPause').classList.toggle('on', paused); $('bX1').classList.toggle('on', !paused && speed === 1); $('bX2').classList.toggle('on', !paused && speed === 2);
  const dt = data ? HUD.mapView : HUD.dataView;
  if ($('bData').lastChild.textContent !== dt) { setText($('bData'), dt); $('bData').setAttribute('aria-label', dt); $('bData').title = dt; }
  if ($('legend').hidden === data) $('legend').hidden = !data;
  for (const b of $('slots').querySelectorAll('button')) {
    const id = b.dataset.id, c = costOf(game, id), m = metaOf(id, c), a = BAR.slot(ACTION_TEXT[id][0], R_NAMES[b.dataset.r], m);
    if (b.lastChild.textContent !== String(c)) b.lastChild.textContent = c; // the weeks are in the aria-label
    if (b.getAttribute('aria-label') !== a) b.setAttribute('aria-label', a);
    b.classList.toggle('poor', c > game.funds);
  }
  showName();
}

function chart(cv, data) {
  const ctx = cv.getContext('2d'), W = cv.width, Hh = cv.height, pad = 6, min = -0.3, max = Math.max(1, ...data); // wt clamp floor -0.3
  const y = v => pad + (Hh - 2 * pad) * (Math.max(min, Math.min(max, v)) - min) / (max - min); // depth grows downward
  ctx.fillStyle = '#0e0d0b'; ctx.fillRect(0, 0, W, Hh);
  ctx.fillStyle = '#5ff0ff'; for (let x = 0; x < W; x += 6) ctx.fillRect(x, Math.round(y(WET_WT)), 3, 1);
  ctx.font = '12px Silkscreen'; ctx.fillText(REPORT.line40, pad + 2, y(WET_WT) + 14);
  ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v, k) => ctx[k ? 'lineTo' : 'moveTo'](pad + (W - 2 * pad) * k / Math.max(1, data.length - 1), y(v)));
  ctx.stroke();
}

function lines(el, list) {
  el.replaceChildren(...list.map(t => Object.assign(document.createElement('p'), { textContent: t })));
}

// Replaces the contents of el with a table. rows: [[label, value, ...]]. A row with one cell spans all columns. head: optional column names.
// label: aria-label text; labelledby: id of a heading that names the table.
export function table(el, rows, { head, label, labelledby } = {}) {
  const cols = head ? head.length : Math.max(...rows.map(r => r.length));
  const t = document.createElement('table');
  t.className = 'metrics';
  if (label) t.setAttribute('aria-label', label);
  if (labelledby) t.setAttribute('aria-labelledby', labelledby);
  const tr = (cells, tag) => {
    const row = document.createElement('tr');
    for (const c of cells) {
      const cell = Object.assign(document.createElement(tag), { textContent: c });
      if (tag === 'th') cell.scope = 'col';
      if (cells.length === 1 && cols > 1) cell.colSpan = cols;
      row.append(cell);
    }
    return row;
  };
  if (head) t.createTHead().append(tr(head, 'th'));
  t.createTBody().append(...rows.map(r => tr(r, 'td')));
  el.replaceChildren(t);
}

// the species row, then the names row when there are names
const speciesRows = game => {
  const [label, count, names] = REPORT.speciesRow(seenNames(game));
  return names ? [[label, count], [names]] : [[label, count]];
};

const seenNames = game => {
  const ids = evaluate(game).speciesSeen;
  return ids.map(id => SPECIES.find(s => s.id === id)?.name ?? id);
};

export function showYearReport(game, year, elNino) {
  $('rpTitle').textContent = REPORT.title(year + 1);
  $('rpChartLabel').textContent = REPORT.chart;
  chart($('rpChart'), weeks);
  const sv = seedlingSurvival(game, game.tick - TICKS_PER_YEAR); // seeded this year
  table($('rpBody'), [
    ...REPORT.rows((game.burnt.size / game.world.n * 100).toFixed(0), sv, Math.round(game.goodwill), game.level.grant, game.funds),
    ...speciesRows(game),
  ], { labelledby: 'rpTitle' });
  $('rpElNino').textContent = REPORT.elNino; $('rpElNino').hidden = !elNino;
  setText($('rpCont'), REPORT.cont);
}

function thumb(cv, w, h, wt) {
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const c = heatColor(wt[i]); img.data.set([c[0], c[1], c[2], 255], i * 4); }
  ctx.putImageData(img, 0, 0);
}

export function showDebrief(game) {
  const r = evaluate(game), sv = seedlingSurvival(game), loss = r.loss, p = game.level.pass, co2 = co2Estimate(game), wd = game.world;
  $('dbTitle').textContent = DEBRIEF.title;
  const sb = game.level.sandbox; // sandbox: figures only, no pass verdict
  $('dbStars').textContent = sb ? '' : DEBRIEF.stars(r.stars);
  $('dbBody').textContent = loss ? DEBRIEF.loss[loss] : sb ? DEBRIEF.sandbox(game.level.seed) : r.passed ? DEBRIEF.passed : DEBRIEF.failed;
  thumb($('dbBefore'), wd.w, wd.h, game.wt0); thumb($('dbAfter'), wd.w, wd.h, wd.wt);
  $('dbBeforeL').textContent = DEBRIEF.before; $('dbAfterL').textContent = DEBRIEF.after; $('dbThumbs').title = DEBRIEF.thumbs;
  $('dbGoalsTitle').textContent = DEBRIEF.goalsTitle;
  if (loss) lines($('dbGoals'), [DEBRIEF.loss[loss]]); // no goal table on a loss
  else table($('dbGoals'), sb ? DEBRIEF.figureRows(r) : DEBRIEF.goalRows(r, p), { head: sb ? DEBRIEF.figureHead : DEBRIEF.goalHead, labelledby: 'dbGoalsTitle' });
  $('dbDataTitle').textContent = DEBRIEF.dataTitle;
  chart($('dbChart'), weeks);
  table($('dbData'), [...DEBRIEF.dataRows(co2, sv), ...speciesRows(game)], { labelledby: 'dbDataTitle' });
  // one hint: the early-loss cause, else the first unmet goal
  $('dbHint').textContent = loss ? DEBRIEF.lossHint[loss] : sb ? '' : r.hints.length ? HINTS[r.hints[0]] : DEBRIEF.allMet;
  setText($('dbMenu'), DEBRIEF.menu);
}
