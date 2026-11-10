import { createGame, step } from './sim/game.js';
import { TICKS_PER_YEAR } from './sim/season.js';
import { checkEarlyLoss, evaluate } from './sim/score.js';
import { LEVELS, buildLevelWorld } from './levels.js';
import { resolveLevel } from './sim/mapgen.js';
import { blip, setMuted, isMuted } from './audio.js';
import { initIntro, drawWorld, smoke, clamp, BW, BH } from './render/intro.js';
import { createMapView } from './render/view.js';
import { LINES, TOAST, SELECT, UPGRADES, QUIT, ZOOM } from './strings.js';
import { browserStorage, loadSave, writeSave, clearSave, recordResult, buyUpgrade, availableStars, hasProgress, UPGRADE_COST, MAX_LEVEL, DEFAULT_SAVE } from './save.js';
import { initUI, renderUI, afterStep, showYearReport, showDebrief } from './ui.js';

export const MAX_TICKS_PER_FRAME = 8;
const TICKS_PER_MS = TICKS_PER_YEAR / 75000;

// Pure. speed 0 (paused) returns the carry untouched. A frame gap over the cap (hidden tab) drops the backlog.
export function ticksForFrame(dtMs, speed, carry) {
  if (!speed) return { ticks: 0, carry };
  const acc = carry + dtMs * TICKS_PER_MS * speed;
  const ticks = Math.floor(acc + 1e-9); // epsilon: 75 s must give exactly 208
  return ticks > MAX_TICKS_PER_FRAME ? { ticks: MAX_TICKS_PER_FRAME, carry: 0 } : { ticks, carry: Math.max(0, acc - ticks) };
}

function boot() {
  const $ = id => document.getElementById(id);
  const cv = $('bg');
  initIntro(cv);
  const map = createMapView(cv);
  const storage = browserStorage;
  let save = loadSave(storage);
  setMuted(save.settings.mute);
  const persist = next => { save = next; writeSave(storage, save); };

  const INTRO_END = 10.5;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase, t0, h = 0, shown = -1, shift = 0, last = null;
  let game = null, paused = false, speed = 1, carry = 0;

  // phase is one of intro | menu | levelSelect | level | yearReport | debrief
  function show(p) {
    phase = p;
    $('intro').hidden = $('skip').hidden = p !== 'intro';
    $('menu').classList.toggle('on', p === 'menu');
    $('levelSelect').hidden = p !== 'levelSelect';
    $('hud').hidden = p !== 'level' && p !== 'yearReport';
    $('bar').hidden = $('zoom').hidden = p !== 'level';
    $('report').hidden = p !== 'yearReport';
    $('debrief').hidden = p !== 'debrief';
  }
  function startIntro() { t0 = performance.now(); h = 0; shown = -1; smoke.length = 0; show('intro'); }
  function toMenu() {
    if (phase === 'menu') return;
    show('menu'); game = null;
    $('bCont').disabled = !hasProgress(save);
    (hasProgress(save) ? $('bCont') : $('bNew')).focus({ preventScroll: true });
  }

  // ---- level select
  function toLevelSelect() {
    show('levelSelect');
    const items = LEVELS.map(L => {
      const b = document.createElement('button'), s = document.createElement('small'), open = L.id <= save.unlocked;
      b.className = 'btn'; b.textContent = `${L.id}. ${L.name}`; b.disabled = !open;
      s.textContent = open ? `${SELECT.best(save.stars[L.id] || 0)} · ${SELECT.years(L.years)} · ${L.teaches}` : SELECT.locked(L.id - 1);
      b.append(s);
      b.onclick = () => { blip(880, 0.06); startLevel(L); };
      return b;
    });
    if (save.unlocked > MAX_LEVEL) {
      const b = document.createElement('button'), s = document.createElement('small');
      b.className = 'btn'; b.textContent = SELECT.sandbox; s.textContent = SELECT.sandboxNote; b.append(s);
      b.onclick = () => { blip(880, 0.06); startSandbox(); };
      items.push(b);
    }
    $('lsList').replaceChildren(...items);
    renderUpgrades();
    ($('lsList').querySelector('button:not(:disabled)')).focus({ preventScroll: true });
  }
  function renderUpgrades() {
    $('lsStars').textContent = SELECT.stars(availableStars(save));
    $('lsUpList').replaceChildren(...Object.entries(UPGRADE_COST).map(([id, cost]) => {
      const b = document.createElement('button'), s = document.createElement('small'), own = save.upgrades[id];
      b.className = 'btn'; b.textContent = UPGRADES[id][0]; b.dataset.id = id;
      s.textContent = `${own ? SELECT.owned : SELECT.buy(cost)} · ${UPGRADES[id][1]}`; b.append(s);
      b.disabled = !!own || availableStars(save) < cost;
      b.onclick = () => { const r = buyUpgrade(save, id); if (r.error) return; blip(1100, 0.08); persist(r); renderUpgrades(); };
      return b;
    }));
  }
  function startSandbox() {
    const L = { ...LEVELS[MAX_LEVEL - 1], id: MAX_LEVEL + 1, name: SELECT.sandbox, sandbox: true, seed: Math.floor(Math.random() * 2 ** 31) };
    startLevel(L);
    if (map.mode !== 'data') map.toggleMode();
  }

  // ---- level
  function startLevel(L) {
    const level = resolveLevel(L);
    game = createGame(level, save.upgrades, buildLevelWorld(level));
    paused = false; speed = 1; carry = 0; map.leave();
    if (map.mode === 'data') map.toggleMode(); // each level starts in map view; the sandbox switches it on after
    initUI(game, { canvas: cv, map, isLevel: () => phase === 'level', setSpeed, toggleData: () => map.toggleMode() });
    show('level');
  }
  function setSpeed(s) { if (s) { speed = s; paused = false; } else paused = !paused; }
  function toDebrief() {
    showDebrief(game); // evaluate() decides loss itself
    if (!game.level.sandbox) persist(recordResult(save, game.level.id, evaluate(game).stars));
    show('debrief'); $('dbMenu').focus({ preventScroll: true });
  }
  function tickLevel(dt) {
    const r = ticksForFrame(dt, paused ? 0 : speed, carry);
    carry = r.carry;
    for (let k = 0; k < r.ticks; k++) {
      step(game);
      afterStep(game);
      if (game.events.some(e => e.type === 'yearEnd')) break; // never run past a year report
    }
    const ev = game.events.splice(0); // drain (yearEnd.year is 0-based)
    if (game.tick >= game.level.years * TICKS_PER_YEAR) return toDebrief();
    if (checkEarlyLoss(game)) return toDebrief(); // triggers the early end; evaluate() in the debrief re-derives the cause
    const ye = ev.find(e => e.type === 'yearEnd');
    if (ye) {
      paused = true;
      showYearReport(game, ye.year, ev.some(e => e.type === 'elNinoWarning'));
      show('yearReport'); $('rpCont').focus({ preventScroll: true });
    }
  }

  function frame(now) {
    const dt = last == null ? 0 : now - last; last = now;
    if (phase === 'intro') {
      const t = (now - t0) / 1000;
      h = clamp((t - 5.6) / 4.5);
      const idx = LINES.reduce((n, l, i) => t >= l[0] ? i : n, 0);
      if (idx !== shown) { shown = idx; $('line').textContent = LINES[idx][1]; blip(220 + idx * 110, 0.12, 'triangle'); }
      if (t > INTRO_END) toMenu();
    } else h += (1 - h) * 0.04;
    if (phase === 'level' && !$('dQuit').open) tickLevel(dt);
    if (game && phase !== 'debrief') renderUI(game, { paused: paused || phase !== 'level', speed, data: map.mode === 'data' });
    shift += ((phase === 'menu' && innerWidth > 600 ? 1 : 0) - shift) * 0.05;
    // Level screens resize the canvas to the window (view.js); everything else keeps the intro's 320x180 buffer.
    if (game && ['level', 'yearReport', 'debrief'].includes(phase)) map.draw(game, now);
    else {
      if (cv.width !== BW || cv.height !== BH) { cv.width = BW; cv.height = BH; map.leave(); }
      drawWorld(h, now, shift);
    }
    requestAnimationFrame(frame);
  }

  ['click', 'keydown'].forEach(ev => addEventListener(ev, e => { if (phase === 'intro' && !e.target.closest?.('#skip')) toMenu(); }));
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return; // Esc there closes the dialog itself
    if (e.key === 'Escape' && (phase === 'level' || phase === 'yearReport')) { e.preventDefault(); return $('dQuit').showModal(); } // preventDefault: this Esc would also cancel the new dialog
    if (e.key === 'Escape' && ['levelSelect', 'debrief'].includes(phase)) return toMenu();
    if (phase !== 'level') return;
    if (map.key(e)) return;
    if (e.key === 'p' || e.key === 'P' || e.key === ' ') { e.preventDefault(); setSpeed(0); }
    else if (e.key === '1' || e.key === '2') setSpeed(+e.key);
    else if (e.key === 'd' || e.key === 'D') map.toggleMode();
    else if (e.target.closest?.('input, textarea, select')) return;
    else if (e.key === '+' || e.key === '=') map.zoom(1);
    else if (e.key === '-') map.zoom(-1);
    else if (e.key === '0') map.zoom(0);
  });
  $('skip').onclick = toMenu;
  reduce ? (phase = 'intro', toMenu(), h = 1) : startIntro();
  requestAnimationFrame(frame);

  // ---- menu actions
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
  document.querySelectorAll('.btn').forEach(b => { b.addEventListener('mouseenter', () => !b.disabled && blip(660, 0.03)); b.addEventListener('click', () => blip(880, 0.06)); });
  $('bNew').onclick = toLevelSelect;
  $('bCont').onclick = () => hasProgress(save) ? toLevelSelect() : toast(TOAST.noSave);
  $('bSet').onclick = () => { $('snd').checked = !isMuted(); $('dSet').showModal(); };
  $('bCred').onclick = () => $('dCred').showModal();
  $('snd').onchange = e => { setMuted(!e.target.checked); persist({ ...save, settings: { ...save.settings, mute: isMuted() } }); blip(1320, 0.08); };
  $('bReplay').onclick = e => { e.stopPropagation(); $('dSet').close(); startIntro(); }; // stop: the global click-to-skip would end the new intro at once
  $('bReset').onclick = () => { clearSave(storage); persist({ ...structuredClone(DEFAULT_SAVE), settings: { ...DEFAULT_SAVE.settings, mute: isMuted() } }); $('bCont').disabled = true; toast(TOAST.saveDeleted); }; // keeps the mute setting
  $('lsTitle').textContent = SELECT.title; $('lsBack').textContent = SELECT.back;
  $('lsBack').onclick = toMenu;
  $('rpCont').onclick = () => { paused = false; show('level'); };
  $('dbMenu').onclick = toMenu;
  $('qTitle').textContent = QUIT.title; $('qBody').textContent = QUIT.body; $('qYes').textContent = QUIT.yes; $('qNo').textContent = QUIT.no;
  $('qYes').onclick = () => { $('dQuit').close(); toMenu(); };
  $('qNo').onclick = () => $('dQuit').close();
  $('zoom').setAttribute('aria-label', ZOOM.group);
  for (const [id, key, dir] of [['bZoomIn', 'in', 1], ['bZoomOut', 'out', -1], ['bZoomFit', 'fit', 0]]) {
    const b = $(id); [b.textContent, b.title] = ZOOM[key]; b.setAttribute('aria-label', b.title);
    b.onclick = () => map.zoom(dir);
  }
  if (new URLSearchParams(location.search).has('debug')) globalThis.rewet = { get game() { return game; } }; // ?debug: console access, e.g. replaying a sim-run plan
}

if (typeof document !== 'undefined') boot();
