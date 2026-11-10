import { createGame, step } from './sim/game.js';
import { TICKS_PER_YEAR } from './sim/season.js';
import { checkEarlyLoss, evaluate } from './sim/score.js';
import { LEVELS, buildLevelWorld } from './levels.js';
import { resolveLevel } from './sim/mapgen.js';
import { blip, setMuted, isMuted } from './audio.js';
import { buildStory, storyAt } from './render/introStory.js';
import { createMapView } from './render/view.js';
import { LINES, INTRO, TOAST, SELECT, UPGRADES, QUIT, ZOOM, JOURNAL, MENU } from './strings.js';
import { browserStorage, loadSave, writeSave, clearSave, recordResult, recordFind, buyUpgrade, availableStars, hasProgress, totalStars, UPGRADE_COST, MAX_LEVEL, DEFAULT_SAVE } from './save.js';
import { openJournal } from './journalView.js';
import { icon, withIcon, setText, sourceLink } from './icons.js';
import { SPECIES } from './journal.js';
import { initUI, renderUI, afterStep, showYearReport, showDebrief, table } from './ui.js';

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
  const map = createMapView(cv);
  const storage = browserStorage;
  let save = loadSave(storage);
  setMuted(save.settings.mute);
  const persist = next => { save = next; writeSave(storage, save); };

  const INTRO_END = 10.5;
  // Intro camera (art values): the whole map first (zoom factor 1). From ZOOM_START it zooms in to SHOT_ZOOM times the fit scale.
  // In the menu it stays zoomed in and pans once, slowly, to the left or the right edge (PAN), then stops.
  const SHOT_ZOOM = 2.5, ZOOM_START = 8, PAN = 0.7, shot = { zoom: 1, pan: 0 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase, t0, h = 0, shown = -1, last = null, story = null, panTo = 0;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const newStory = () => { story = buildStory(Math.floor(Math.random() * 2 ** 31)); map.leave(); };
  let game = null, paused = false, speed = 1, carry = 0;

  // phase is one of intro | menu | levelSelect | level | yearReport | debrief
  function show(p) {
    phase = p;
    $('intro').hidden = $('skip').hidden = p !== 'intro';
    $('menu').classList.toggle('on', p === 'menu');
    $('levelSelect').hidden = p !== 'levelSelect';
    $('hud').hidden = p !== 'level' && p !== 'yearReport';
    $('bar').hidden = p !== 'level'; // the zoom buttons are inside the bar
    $('report').hidden = p !== 'yearReport';
    $('debrief').hidden = p !== 'debrief';
    $('findToast').hidden = true;
  }
  function startIntro() { t0 = performance.now(); h = 0; shown = -1; shot.zoom = 1; shot.pan = 0; newStory(); show('intro'); }
  function menuStats() { table($('menuStats'), [MENU.stars(totalStars(save), MAX_LEVEL * 3), MENU.found(save.found.length, SPECIES.length)], { label: MENU.label }); }
  function toMenu() {
    if (phase === 'menu') return;
    show('menu'); game = null; map.leave(); panTo = Math.random() < 0.5 ? -PAN : PAN; // leave: a level's pan must not carry into the menu
    $('bCont').disabled = !hasProgress(save);
    menuStats();
    (hasProgress(save) ? $('bCont') : $('bNew')).focus({ preventScroll: true });
  }

  // ---- level select
  function toLevelSelect() {
    show('levelSelect');
    const items = LEVELS.map(L => {
      const b = document.createElement('button'), s = document.createElement('small');
      b.className = 'btn'; b.textContent = `${L.id}. ${L.name}`;
      const n = save.stars[L.id] || 0, st = document.createElement('span');
      st.className = 'lsBest'; st.setAttribute('aria-label', SELECT.best(n));
      for (let k = 0; k < 3; k++) { const e = icon(k < n ? 'starOn' : 'star'); e.classList.toggle('on', k < n); st.append(e); }
      s.textContent = `${SELECT.years(L.years)} · ${L.teaches}`;
      b.append(st, s); withIcon(b, 'level');
      b.onclick = () => { blip(880, 0.06); startLevel({ ...L, seed: L.seeds[Math.floor(Math.random() * L.seeds.length)] }); };
      return b;
    });
    if (save.unlocked > MAX_LEVEL) {
      const b = document.createElement('button'), s = document.createElement('small');
      b.className = 'btn'; b.textContent = SELECT.sandbox; s.textContent = SELECT.sandboxNote; b.append(s); withIcon(b, 'sandbox');
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
      s.textContent = `${own ? SELECT.owned : SELECT.buy(cost)} · ${UPGRADES[id][1]}`; b.append(s); withIcon(b, 'upgrade');
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
    initUI(game, { canvas: cv, map, isLevel: () => phase === 'level', setSpeed, toggleData: () => map.toggleMode(), onFind });
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
      const p = clamp((t - ZOOM_START) / (INTRO_END - ZOOM_START)), e = reduce ? 0 : p * p * (3 - 2 * p); // smoothstep; with reduced motion the camera stays on the whole map
      shot.zoom = 1 + (SHOT_ZOOM - 1) * e; shot.pan = 0;
      if (t > INTRO_END) toMenu();
    } else {
      h += (1 - h) * 0.04;
      if (!reduce) { shot.zoom += (SHOT_ZOOM - shot.zoom) * 0.03; shot.pan += (panTo - shot.pan) * 0.01; } // eased: it slows down and stops at the edge
    }
    if (phase === 'level' && !$('dQuit').open) tickLevel(dt);
    if (game && phase !== 'debrief') renderUI(game, { paused: paused || phase !== 'level', speed, data: map.mode === 'data' });
    // Level screens draw the level. Every other screen draws the intro story at the fit zoom, so the whole map shows.
    if (game && ['level', 'yearReport', 'debrief'].includes(phase)) { map.whole = false; map.draw(game, now); }
    else {
      if (!story) newStory(); // first frame with reduced motion
      map.whole = true; map.shot = shot; storyAt(story, h); map.draw(story.game, now);
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
    if (e.key === ' ' && e.target.closest?.('button')) return; // a focused button takes Space itself
    if (e.key === 'p' || e.key === 'P' || e.key === ' ') { e.preventDefault(); setSpeed(0); }
    else if (e.key === '1' || e.key === '2') setSpeed(+e.key);
    else if (e.key === 'd' || e.key === 'D') map.toggleMode();
    else if (e.target.closest?.('input, textarea, select')) return;
    else if (e.key === '+' || e.key === '=') map.zoom(1);
    else if (e.key === '-') map.zoom(-1);
    else if (e.key === '0') map.zoom(0);
  });
  $('skip').onclick = toMenu;
  $('skip').textContent = INTRO.skip;
  reduce ? (phase = 'intro', toMenu(), h = 1) : startIntro();
  requestAnimationFrame(frame);

  // ---- menu actions
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
  for (const [id, name] of Object.entries({ bNew: 'new', bCont: 'continue', bJrnMenu: 'journal', bSet: 'settings', bCred: 'credits', bReplay: 'replay', bReset: 'delete', lsBack: 'back', rpCont: 'play', dbMenu: 'menu', qYes: 'back', qNo: 'close', jClose: 'close', jPrev: 'back', jNext: 'continue', findOpen: 'journal', skip: 'fast' })) withIcon($(id), name);
  document.querySelectorAll('dialog form .btn').forEach(b => withIcon(b, 'close'));
  document.querySelectorAll('#dCred a.srcLink').forEach(a => a.replaceWith(sourceLink(a.href, a.getAttribute('aria-label'))));
  document.querySelectorAll('.btn').forEach(b => { b.addEventListener('mouseenter', () => !b.disabled && blip(660, 0.03)); b.addEventListener('click', () => blip(880, 0.06)); });
  $('bNew').onclick = toLevelSelect;
  $('bCont').onclick = () => hasProgress(save) ? toLevelSelect() : toast(TOAST.noSave);
  // The journal pauses a level. On close, the speed and the paused state come back. The intro hides both buttons, so no click can reach it.
  $('bJrnMenu').onclick = () => openJournal({ found: save.found });
  $('bJournal').textContent = JOURNAL.open;
  function openBook(page) {
    const was = { paused, speed };
    paused = true;
    openJournal({ found: save.found, page, onClose: () => { ({ paused, speed } = was); if (page) $('bJournal').focus({ preventScroll: true }); } }); // the toast is gone, so focus goes to the HUD button
  }
  $('bJournal').onclick = e => { e.currentTarget.blur(); openBook(); };
  // A tap on an animal. The toast shows even when the save cannot be written: persist keeps the save in memory.
  let findTimer;
  function onFind(id) {
    const r = recordFind(save, id);
    if (!r.isNew) return;
    persist(r.save); blip(1320, 0.08);
    const t = $('findToast'); $('findMsg').textContent = JOURNAL.found(SPECIES.find(s => s.id === id).name);
    setText($('findOpen'), JOURNAL.openEntry);
    $('findOpen').onclick = () => { t.hidden = true; openBook(id); };
    t.style.bottom = `${$('bar').offsetHeight + 8}px`; t.hidden = false;
    clearTimeout(findTimer); findTimer = setTimeout(() => { t.hidden = true; }, 8000);
  }
  $('bSet').onclick = () => { $('snd').checked = !isMuted(); $('dSet').showModal(); };
  $('bCred').onclick = () => $('dCred').showModal();
  $('snd').onchange = e => { setMuted(!e.target.checked); persist({ ...save, settings: { ...save.settings, mute: isMuted() } }); blip(1320, 0.08); };
  $('bReplay').onclick = e => { e.stopPropagation(); $('dSet').close(); startIntro(); }; // stop: the global click-to-skip would end the new intro at once
  $('bReset').onclick = () => { clearSave(storage); persist({ ...structuredClone(DEFAULT_SAVE), settings: { ...DEFAULT_SAVE.settings, mute: isMuted() } }); $('bCont').disabled = true; menuStats(); toast(TOAST.saveDeleted); }; // keeps the mute setting
  $('lsTitle').textContent = SELECT.title; setText($('lsBack'), SELECT.back);
  $('lsBack').onclick = toMenu;
  $('rpCont').onclick = () => { paused = false; show('level'); };
  $('dbMenu').onclick = toMenu;
  $('qTitle').textContent = QUIT.title; $('qBody').textContent = QUIT.body; setText($('qYes'), QUIT.yes); setText($('qNo'), QUIT.no);
  $('qYes').onclick = () => { $('dQuit').close(); toMenu(); };
  $('qNo').onclick = () => $('dQuit').close();
  $('zoom').setAttribute('aria-label', ZOOM.group);
  for (const [id, key, dir, name] of [['bZoomIn', 'in', 1, 'zoomIn'], ['bZoomOut', 'out', -1, 'zoomOut'], ['bZoomFit', 'fit', 0, 'fit']]) {
    const b = $(id); b.title = ZOOM[key][1]; b.setAttribute('aria-label', b.title); b.replaceChildren(icon(name));
    b.onclick = () => map.zoom(dir);
  }
  if (new URLSearchParams(location.search).has('debug')) globalThis.rewet = { get game() { return game; } }; // ?debug: console access, e.g. replaying a sim-run plan
}

if (typeof document !== 'undefined') boot();
