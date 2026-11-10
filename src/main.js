import { createGame, step } from './sim/game.js';
import { TICKS_PER_YEAR, seasonAt } from './sim/season.js';
import { evaluate, checkEarlyLoss } from './sim/score.js';
import { LEVELS, buildLevelWorld } from './levels.js';
import { blip, setMuted, isMuted } from './audio.js';
import { initIntro, drawWorld, smoke, clamp, BW, BH } from './render/intro.js';
import { createMapView } from './render/view.js';
import { LINES, TOAST, SELECT, HUD, REPORT, DEBRIEF } from './strings.js';

export const MAX_TICKS_PER_FRAME = 8;
const TICKS_PER_MS = TICKS_PER_YEAR / 75000;

// Pure. speed 0 (paused) returns the carry untouched. A frame gap over the cap (hidden tab) drops the backlog.
export function ticksForFrame(dtMs, speed, carry) {
  if (!speed) return { ticks: 0, carry };
  const acc = carry + dtMs * TICKS_PER_MS * speed;
  const ticks = Math.floor(acc + 1e-9); // epsilon: 75 s must give exactly 208
  return ticks > MAX_TICKS_PER_FRAME ? { ticks: MAX_TICKS_PER_FRAME, carry: 0 } : { ticks, carry: Math.max(0, acc - ticks) };
}

// Prototype wrapper kept until Task 13 replaces it with src/save.js.
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } },
                set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

function boot() {
  const $ = id => document.getElementById(id);
  const cv = $('bg');
  initIntro(cv);
  const map = createMapView(cv);
  setMuted(store.get('rewet_mute') === '1');

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
    $('report').hidden = p !== 'yearReport';
    $('debrief').hidden = p !== 'debrief';
    $('bData').textContent = map.mode === 'data' ? HUD.mapView : HUD.dataView;
  }
  function startIntro() { t0 = performance.now(); h = 0; shown = -1; smoke.length = 0; show('intro'); }
  function toMenu() {
    if (phase === 'menu') return;
    show('menu'); game = null;
    $('bCont').disabled = !store.get('rewet_save');
    (store.get('rewet_save') ? $('bCont') : $('bNew')).focus({ preventScroll: true });
  }

  // ---- level select
  function toLevelSelect() {
    show('levelSelect');
    $('lsList').replaceChildren(...LEVELS.map(L => {
      const b = document.createElement('button'), s = document.createElement('small');
      b.className = 'btn'; b.textContent = `${L.id}. ${L.name}`;
      s.textContent = `${SELECT.years(L.years)} · ${L.teaches}`; b.append(s);
      b.onclick = () => { blip(880, 0.06); startLevel(L); };
      return b;
    }));
    $('lsList').firstChild.focus({ preventScroll: true });
  }

  // ---- level (temporary text readout until Tasks 11-12)
  function startLevel(level) {
    game = createGame(level, {}, buildLevelWorld(level));
    paused = false; speed = 1; carry = 0; map.leave();
    $('hudKeys').textContent = HUD.keys;
    show('level');
  }
  function readout() {
    const { week } = seasonAt(game.tick);
    $('hudLine').textContent = HUD.line(Math.floor(game.tick / TICKS_PER_YEAR) + 1, game.level.years, week + 1, game.funds)
      + (paused ? ` · ${HUD.paused}` : ` · ${HUD.speed(speed)}`);
  }
  function toDebrief(loss) {
    const r = evaluate(game);
    $('dbTitle').textContent = DEBRIEF.title;
    $('dbBody').textContent = loss ? DEBRIEF.loss[loss] : r.passed ? DEBRIEF.passed : DEBRIEF.failed;
    $('dbStats').textContent = `${DEBRIEF.stars(r.stars)} · ${DEBRIEF.stats(r)}`;
    $('dbMenu').textContent = DEBRIEF.menu;
    show('debrief'); $('dbMenu').focus({ preventScroll: true });
  }
  function tickLevel(dt) {
    const r = ticksForFrame(dt, paused ? 0 : speed, carry);
    carry = r.carry;
    for (let k = 0; k < r.ticks; k++) {
      step(game);
      if (game.events.some(e => e.type === 'yearEnd')) break; // never run past a year report
    }
    const ev = game.events.splice(0); // drain (yearEnd.year is 0-based); Tasks 11-12 will use the other event types
    if (game.tick >= game.level.years * TICKS_PER_YEAR) return toDebrief(null);
    const loss = checkEarlyLoss(game);
    if (loss) return toDebrief(loss);
    const ye = ev.find(e => e.type === 'yearEnd');
    if (ye) {
      paused = true;
      $('rpTitle').textContent = REPORT.title(ye.year + 1);
      $('rpBody').textContent = REPORT.funds(game.funds);
      $('rpCont').textContent = REPORT.cont;
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
    if (phase === 'level') tickLevel(dt);
    if (game) readout();
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
    if (e.key === 'Escape' && ['levelSelect', 'level', 'yearReport', 'debrief'].includes(phase)) return toMenu();
    if (phase !== 'level') return;
    if (e.key === 'p' || e.key === 'P' || e.key === ' ') { e.preventDefault(); paused = !paused; }
    else if (e.key === '1' || e.key === '2') { speed = +e.key; paused = false; }
    else if (e.key === 'd' || e.key === 'D') toggleData();
  });
  $('skip').onclick = toMenu;
  function toggleData() { map.toggleMode(); $('bData').textContent = map.mode === 'data' ? HUD.mapView : HUD.dataView; }
  $('bData').onclick = e => { toggleData(); e.currentTarget.blur(); }; // blur: Space must pause, not re-toggle
  addEventListener('pointermove', e => { map.hover = phase === 'level' ? map.pickTile(e) : null; });
  reduce ? (phase = 'intro', toMenu(), h = 1) : startIntro();
  requestAnimationFrame(frame);

  // ---- menu actions
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
  document.querySelectorAll('.btn').forEach(b => { b.addEventListener('mouseenter', () => !b.disabled && blip(660, 0.03)); b.addEventListener('click', () => blip(880, 0.06)); });
  $('bNew').onclick = toLevelSelect;
  $('bCont').onclick = () => toast(store.get('rewet_save') ? TOAST.continueLater : TOAST.noSave);
  $('bSet').onclick = () => { $('snd').checked = !isMuted(); $('dSet').showModal(); };
  $('bCred').onclick = () => $('dCred').showModal();
  $('snd').onchange = e => { setMuted(!e.target.checked); store.set('rewet_mute', isMuted() ? '1' : '0'); blip(1320, 0.08); };
  $('bReplay').onclick = e => { e.stopPropagation(); $('dSet').close(); startIntro(); }; // stop: the global click-to-skip would end the new intro at once
  $('bReset').onclick = () => { store.set('rewet_save', null); $('bCont').disabled = true; toast(TOAST.saveDeleted); };
  $('lsTitle').textContent = SELECT.title; $('lsBack').textContent = SELECT.back;
  $('lsBack').onclick = toMenu;
  $('rpCont').onclick = () => { paused = false; show('level'); };
  $('dbMenu').onclick = toMenu;
}

if (typeof document !== 'undefined') boot();
