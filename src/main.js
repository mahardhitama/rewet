import { LANG } from './i18n.js'; // first: it merges the Indonesian copy before any module reads the text
import { createGame, step, scenicStep, ACTIONS, isWetSeason } from './sim/game.js';
import { TICKS_PER_YEAR, seasonAt, dryStart } from './sim/season.js';
import { checkEarlyLoss, evaluate } from './sim/score.js';
import { LEVELS, buildLevelWorld } from './levels.js';
import { resolveLevel } from './sim/mapgen.js';
import { blip, tap, cue, sfx, setAmbience, setMuted, isMuted } from './audio.js';
import { takeFxEvents, rainLevel, shake, celebrate, setArmed } from './render/fx.js';
import { KIND, WET_WT } from './sim/world.js';
import { buildStory, storyAt } from './render/introStory.js';
import { createMapView } from './render/view.js';
import { LINES, INTRO, TOAST, NOTES, SELECT, UPGRADES, QUIT, ZOOM, JOURNAL, MENU, HOWTO, PAGE } from './strings.js';
import { browserStorage, loadSave, writeSave, clearSave, recordResult, recordFind, buyUpgrade, availableStars, hasProgress, totalStars, UPGRADE_COST, MAX_LEVEL, DEFAULT_SAVE } from './save.js';
import { openJournal, speciesPage } from './journalView.js';
import { icon, withIcon, setText, sourceLink, starIcons } from './icons.js';
import { SPECIES } from './journal.js';
import { initUI, renderUI, afterStep, showYearReport, showDebrief, table } from './ui.js';

export const MAX_TICKS_PER_FRAME = 8;
const TICKS_PER_MS = TICKS_PER_YEAR / 120000; // x1: 120 s a year, so a week is about 2.3 s. x2: 60 s a year.

// How long a toast stays: about 0.4 s a word, from 3 s to 9 s.
export const noteMs = msg => Math.min(9000, Math.max(3000, msg.split(/\s+/).length * 400));

// Pure. speed 0 (paused) returns the carry untouched. A frame gap over the cap (hidden tab) drops the backlog.
export function ticksForFrame(dtMs, speed, carry) {
  if (!speed) return { ticks: 0, carry };
  const acc = carry + dtMs * TICKS_PER_MS * speed;
  const ticks = Math.floor(acc + 1e-9); // epsilon: 120 s must give exactly 208
  return ticks > MAX_TICKS_PER_FRAME ? { ticks: MAX_TICKS_PER_FRAME, carry: 0 } : { ticks, carry: Math.max(0, acc - ticks) };
}

function boot() {
  const $ = id => document.getElementById(id);
  const cv = $('bg');
  const map = createMapView(cv);
  const storage = browserStorage;
  let save = loadSave(storage);
  document.documentElement.lang = LANG;
  for (const [k, text] of Object.entries(PAGE)) { const [sel, attr] = k.split('@'), e = document.querySelector(sel); attr ? e.setAttribute(attr, text) : (e.firstChild.nodeValue = text); } // before withIcon wraps the button text
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
  const notes = []; // the toast queue (see toast()); declared here because toMenu() can run at boot

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
    $('scenic').hidden = p !== 'scenic';
  }
  function startIntro() { t0 = performance.now(); h = 0; shown = -1; shot.zoom = 1; shot.pan = 0; newStory(); show('intro'); }
  function menuStats() { table($('menuStats'), [MENU.stars(totalStars(save), MAX_LEVEL * 3), MENU.found(save.found.length, SPECIES.length)], { label: MENU.label }); }
  function toMenu() {
    if (phase === 'menu') return;
    clearNotes(); // no level note may show on the menu
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
      starIcons(st, n);
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
    paused = false; speed = 1; carry = 0; map.leave(); mile = null; wetFrac = 0;
    clearNotes(); noted.clear(); wasBurning = false; fireYear = -1; wasWet = true;
    if (map.mode === 'data') map.toggleMode(); // each level starts in map view; the sandbox switches it on after
    initUI(game, { canvas: cv, map, isLevel: () => phase === 'level', setSpeed, toggleData: () => map.toggleMode(), onFind });
    show('level');
    if (HOWTO.items[L.id]) openHowto(L); // the sandbox has no how-to
  }
  // The how-to dialog. The level stays paused until it closes, by any way (button or Esc).
  function openHowto(L) {
    const dlg = $('dHow'), el = (tag, text) => Object.assign(document.createElement(tag), text == null ? {} : { textContent: text });
    $('hTitle').textContent = HOWTO.title(L);
    $('hSub').textContent = L.id === 1 ? HOWTO.sub : HOWTO.newHere;
    $('hList').replaceChildren(...HOWTO.items[L.id].map(x => {
      const li = el('li'), ic = el('span'), body = el('div'), head = el('b', x.name);
      ic.className = 'ic'; ic.append(icon(x.icon)); if (ACTIONS[x.icon]) ic.dataset.r = ACTIONS[x.icon].r; // the colour of the action group, as on the slot
      body.append(head); if (x.key) body.append(el('kbd', x.key)); body.append(el('p', x.text));
      li.append(ic, body); return li;
    }));
    $('hHint').textContent = HOWTO.hint;
    paused = true;
    dlg.onclose = () => { dlg.onclose = null; paused = false; };
    dlg.showModal();
    dlg.scrollTop = 0;
  }
  // The sound bed follows the level: music and nature only while it runs, rain in a shower, darker with fire.
  let wetFrac = 0, mile = null;
  const MILES = [25, 50, 75, 90];
  function ambience() {
    const on = !!game && (phase === 'level' && !paused || phase === 'scenic') && !document.querySelector('dialog[open]');
    if (!on) return { on, rain: false, health: wetFrac, fire: 0 };
    const wd = game.world; let peat = 0, wet = 0, burn = 0;
    for (let i = 0; i < wd.n; i++) { if (wd.fire[i]) burn++; if (wd.kind[i] === KIND.PEAT) { peat++; if (wd.wt[i] <= WET_WT) wet++; } }
    wetFrac += ((peat ? wet / peat : 0) - wetFrac) * .02;
    const pct = peat ? wet / peat * 100 : 0, m = MILES.filter(v => pct >= v).length; // milestones: a toast, a chime and a burst when the dry-season wet share climbs past one
    if (phase === 'scenic') { /* no milestones while the player only looks */ }
    else if (isWetSeason(game)) mile = null; // rain wets all peat for free: only dry-season peat that stays wet counts
    else if (mile == null) mile = m;
    else if (m > mile) { mile = m; toast(TOAST.wet(MILES[m - 1])); sfx('star', Math.min(2, m - 1)); celebrate(1, wd.w, wd.h); }
    return { on, rain: rainLevel() > .3, health: Math.min(1, wetFrac * .7 + game.goodwill / 300), fire: Math.min(1, burn / 8) };
  }
  function setSpeed(s) { if (s) { speed = s; paused = false; } else paused = !paused; }
  function toDebrief() {
    clearNotes();
    showDebrief(game); // evaluate() decides loss itself
    setArmed(null);
    const stars = evaluate(game).stars;
    if (!game.level.sandbox) persist(recordResult(save, game.level.id, stars));
    celebrate(game.level.sandbox ? 0 : stars, game.world.w, game.world.h);
    show('debrief'); $('dbMenu').focus({ preventScroll: true });
  }
  // After the debrief: the map runs on with water, seasons and wildlife only (scenicStep), at speed 1.
  function tickScenic(dt) {
    const r = ticksForFrame(dt, 1, carry); carry = r.carry;
    for (let k = 0; k < r.ticks; k++) scenicStep(game);
    game.events.length = 0;
  }
  function toScenic() { if (map.mode === 'data') map.toggleMode(); show('scenic'); $('scBack').focus({ preventScroll: true }); }
  function backToDebrief() { show('debrief'); $('dbView').focus({ preventScroll: true }); }
  // Field notes: what happened and why, once for each level. The first fire of each year also pauses the game.
  const noted = new Set();
  let wasBurning = false, fireYear = -1, wasWet = true;
  const note = key => { if (!noted.has(key)) { noted.add(key); toast(NOTES[key]); } };
  function fieldNotes(ev) {
    const wd = game.world, y = Math.floor(game.tick / TICKS_PER_YEAR), wet = isWetSeason(game), dryIn = dryStart(game) - seasonAt(game.tick).week;
    if (wet && dryIn <= 4 && !noted.has('dryIn')) { noted.add('dryIn'); toast(NOTES.dryIn(dryIn)); }
    if (wasWet && !wet) note('dry');
    wasWet = wet;
    for (const e of ev) {
      if (e.type === 'washout') note('washout');
      else if (e.type === 'villageFire') note('villageFire');
      else if (e.type === 'arson' && !e.lit && (wd.kind[e.i] === KIND.PEAT || wd.kind[e.i] === KIND.FARM) && wd.wt[e.i] <= WET_WT) note('arsonWet');
    }
    const burning = wd.fire.some(f => f);
    if (burning && !wasBurning && fireYear !== y) { fireYear = y; paused = true; toast(NOTES.fire, true); }
    wasBurning = burning;
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
    const yearEnd = ev.some(e => e.type === 'yearEnd');
    for (const e of ev) if (!(yearEnd && e.type === 'elNinoWarning')) cue(e.type); // the year report shows the warning; one sound at a time
    for (const e of ev) if (e.type === 'arson' || e.type === 'villageFire') shake(2, 300); else if (e.type === 'washout') shake(1, 250);
    fieldNotes(ev);
    if (game.tick >= game.level.years * TICKS_PER_YEAR) return toDebrief();
    if (checkEarlyLoss(game)) return toDebrief(); // triggers the early end; evaluate() in the debrief re-derives the cause
    const ye = yearEnd && ev.find(e => e.type === 'yearEnd');
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
    else if (phase === 'scenic') tickScenic(dt);
    for (const e of takeFxEvents()) if (phase === 'level' || phase === 'scenic') e.type === 'cascade' ? setTimeout(() => sfx('star', Math.min(2, e.n - 2)), 150) : sfx(e.type, e.n ?? 0); // events from other screens are dropped, so they do not play late
    setAmbience(ambience());
    if (game && phase !== 'debrief' && phase !== 'scenic') renderUI(game, { paused: paused || phase !== 'level', speed, data: map.mode === 'data' });
    // Level screens draw the level. Every other screen draws the intro story at the fit zoom, so the whole map shows.
    if (game && ['level', 'yearReport', 'debrief', 'scenic'].includes(phase)) { map.whole = false; map.cursor = phase === 'level'; map.found = save.found; map.draw(game, now); }
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
    if (phase === 'scenic') { // only look: pan and zoom keys, Esc goes back to the results
      if (e.key === 'Escape') return e.repeat || backToDebrief(); // a held Esc must not run on into the menu
      if (map.key(e)) return;
      if (e.key === '+' || e.key === '=') map.zoom(1); else if (e.key === '-') map.zoom(-1); else if (e.key === '0') map.zoom(0);
      return;
    }
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
  let toMenuNow = false; // after a switch of language: the reload opens the menu, not the intro
  try { toMenuNow = sessionStorage.getItem('rewet_menu') === '1'; sessionStorage.removeItem('rewet_menu'); } catch { /* blocked storage: play the intro */ }
  reduce || toMenuNow ? (phase = 'intro', toMenu(), h = 1) : startIntro();
  requestAnimationFrame(frame);
  addEventListener('visibilitychange', () => { if (document.hidden) setAmbience({ on: false }); }); // rAF stops in a hidden tab, but the music scheduler does not

  // ---- menu actions
  // The toast sits above the action bar in a level (a hidden bar has 0 height).
  // Toasts wait in a queue, so a field note is not lost under the next one.
  // urgent: it replaces the toast on the screen now (the fire pause must say why at once).
  function toast(msg, urgent = false) { if (urgent && notes.length) { notes[0] = msg; return showNote(); } notes.push(msg); if (notes.length === 1) showNote(); }
  function showNote() {
    const t = $('toast'), msg = notes[0];
    if (msg == null) return t.classList.remove('on');
    t.textContent = msg; t.style.bottom = `${($('bar').offsetHeight || 0) + 24}px`; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => { notes.shift(); showNote(); }, noteMs(msg));
  }
  function clearNotes() { notes.length = 0; clearTimeout($('toast')._h); $('toast').classList.remove('on'); }
  for (const [id, name] of Object.entries({ bNew: 'new', bCont: 'continue', bJrnMenu: 'journal', bSet: 'settings', bLang: 'journal', bCred: 'credits', bReplay: 'replay', bReset: 'delete', lsBack: 'back', rpCont: 'play', dbMenu: 'menu', dbView: 'fit', scBack: 'back', qYes: 'back', qNo: 'close', jClose: 'close', jHome: 'menu', jPrev: 'back', jNext: 'continue', fJournal: 'journal', fGo: 'play', skip: 'fast' })) withIcon($(id), name);
  document.querySelectorAll('dialog form .btn').forEach(b => withIcon(b, 'close'));
  document.querySelectorAll('#dCred a.srcLink').forEach(a => a.replaceWith(sourceLink(a.href, a.getAttribute('aria-label'))));
  document.addEventListener('mouseover', e => { // delegated: the level select builds its buttons later
    const b = e.target.closest?.('.btn, .hb, .slot');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) blip(660, 0.03, 'square', b.classList.contains('slot') ? 0.012 : 0.035); // action slots are fainter: the player sweeps over them often
  });
  document.addEventListener('click', e => { if (e.target.closest?.('button:not(:disabled)')) setTimeout(tap); }, true); // every button, also the ones made later. Capture: #bReplay stops the bubble. The timeout lets the button's own sound play first.
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
  // A tap on a new animal opens the find card with its journal page. The card pauses the level, as the journal does.
  // It shows even when the save cannot be written: persist keeps the save in memory.
  function onFind(id) {
    const r = recordFind(save, id);
    if (!r.isNew) return;
    persist(r.save); sfx('find');
    const dlg = $('dFind'), was = { paused, speed };
    let book = false; // Open journal: the journal opens after the card closes, so it pauses from the restored state
    $('fTitle').textContent = JOURNAL.newFind; $('fHint').textContent = JOURNAL.findHint;
    $('fBody').replaceChildren(speciesPage(SPECIES.find(s => s.id === id)));
    setText($('fJournal'), JOURNAL.openJournal); setText($('fGo'), JOURNAL.cont);
    $('fJournal').onclick = () => { book = true; dlg.close(); };
    $('fGo').onclick = () => dlg.close();
    dlg.onclose = () => { dlg.onclose = null; ({ paused, speed } = was); if (book) openBook(id); };
    paused = true;
    dlg.showModal(); dlg.scrollTop = 0;
  }
  $('bSet').onclick = () => { $('snd').ariaPressed = String(!isMuted()); $('dSet').showModal(); };
  $('bCred').onclick = () => $('dCred').showModal();
  $('snd').onclick = () => { setMuted(!isMuted()); $('snd').ariaPressed = String(!isMuted()); persist({ ...save, settings: { ...save.settings, mute: isMuted() } }); blip(1320, 0.08); };
  $('bLang').onclick = () => { // all text is read at load, so the new language needs a reload
    persist({ ...save, settings: { ...save.settings, lang: LANG === 'id' ? 'en' : 'id' } });
    try { sessionStorage.setItem('rewet_menu', '1'); } catch { /* blocked storage: the reload plays the intro */ }
    location.reload();
  };
  $('bReplay').onclick = e => { e.stopPropagation(); $('dSet').close(); startIntro(); }; // stop: the global click-to-skip would end the new intro at once
  $('bReset').onclick = () => { clearSave(storage); persist({ ...structuredClone(DEFAULT_SAVE), settings: { ...save.settings } }); $('bCont').disabled = true; menuStats(); toast(TOAST.saveDeleted); }; // keeps the settings (mute, language)
  $('lsTitle').textContent = SELECT.title; setText($('lsBack'), SELECT.back);
  $('lsBack').onclick = toMenu;
  $('rpCont').onclick = () => { paused = false; show('level'); };
  $('dbMenu').onclick = toMenu;
  $('dbView').onclick = toScenic;
  $('scBack').onclick = backToDebrief;
  $('qTitle').textContent = QUIT.title; $('qBody').textContent = QUIT.body; setText($('qYes'), QUIT.yes); setText($('qNo'), QUIT.no);
  $('qYes').onclick = () => { $('dQuit').close(); toMenu(); };
  $('qNo').onclick = () => $('dQuit').close();
  setText(withIcon($('hGo'), 'play'), HOWTO.go);
  $('hGo').onclick = () => $('dHow').close();
  $('zoom').setAttribute('aria-label', ZOOM.group);
  for (const [id, key, dir, name] of [['bZoomIn', 'in', 1, 'zoomIn'], ['bZoomOut', 'out', -1, 'zoomOut'], ['bZoomFit', 'fit', 0, 'fit']]) {
    const b = $(id); b.title = ZOOM[key][1]; b.setAttribute('aria-label', b.title); b.replaceChildren(icon(name));
    b.onclick = () => map.zoom(dir);
  }
  if (new URLSearchParams(location.search).has('debug')) globalThis.rewet = { get game() { return game; }, map }; // ?debug: console access, e.g. replaying a sim-run plan, or the press-kit camera
}

if (typeof document !== 'undefined') boot();
