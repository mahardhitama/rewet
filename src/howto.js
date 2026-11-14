// The how-to slides: one demo for each item, drawn on the level map, zoomed in. DOM and canvas only; the demo sim is src/demo.js.
// The main map does not draw while this is open: the renderer keeps its slide, smoke and fx state in module globals.
import { ACTIONS } from './sim/game.js';
import { newDemo, demoStep, nextAction } from './demo.js';
import { drawWorld, resetSlides, resetSmoke, clearTrack, keepTrack } from './render/iso.js';
import { backdrop, resetFx, placed, setArmed, keepFx } from './render/fx.js';
import { cameraFor, tileToScreen, TW } from './render/isoMath.js';
import { HOWTO } from './strings.js';
import { icon, setText } from './icons.js';
import { sfx } from './audio.js';

const HOLD_MS = 1500; // the last frame of a demo stays 1.5 s, then the demo starts again
const resetRender = () => { resetFx(); resetSlides(); resetSmoke(); clearTrack(); };

// items: HOWTO items. level: the resolved level of the game (its map). onClose runs however the dialog closes.
export function openHowto({ level, title, sub, items, onClose }) {
  const $ = id => document.getElementById(id), dlg = $('dHow'), cv = $('hMap'), ctx = cv.getContext('2d'), ic = $('hCap').querySelector('.ic');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; // reduced motion: each slide shows the end of its demo, still
  const keep = [keepTrack(), keepFx()]; // the level's render state, given back on close
  let k = 0, demo, raf = 0, last = 0, acc = 0, holdUntil = 0, flash = 0;
  function show(n) {
    k = n; const x = items[k];
    demo = newDemo(level, x.demo ?? x.icon); acc = 0; holdUntil = 0;
    if (reduce) while (demo.t < demo.ticks) demoStep(demo);
    resetRender();
    $('hName').textContent = x.name; $('hText').textContent = x.text;
    ic.replaceChildren(icon(x.icon)); ic.dataset.r = ACTIONS[x.icon]?.r ?? ''; ic.classList.remove('on'); // the colour of the action group, as on the slot
    $('hPos').textContent = HOWTO.pos(k + 1, items.length);
    if (k === 0 && document.activeElement === $('hPrev')) $('hGo').focus(); // a disabled button drops the focus, and the arrow keys with it
    $('hPrev').disabled = k === 0;
    setText($('hGo'), k === items.length - 1 ? HOWTO.go : HOWTO.next);
  }
  // The demo does an action: the sound and the build ring of a real tap, and the button on the slide lights up.
  function press(id, i) {
    if (!ACTIONS[id]) return;
    sfx(id); placed(i, id, ACTIONS[id].cost);
    if (id !== (items[k].icon)) return;
    ic.classList.add('on'); clearTimeout(flash); flash = setTimeout(() => ic.classList.remove('on'), 400);
  }
  // A camera at the demo zoom, centred on the focus tile.
  function draw(now) {
    const { width: cw, height: ch } = cv.getBoundingClientRect(), wd = demo.g.world, s = cw / (demo.span * TW);
    if (!cw || !ch) return;
    const c0 = cameraFor(cw, ch, wd.w, wd.h, { x: 0, y: 0 }, s), [sx, sy] = tileToScreen(demo.focus % wd.w, (demo.focus / wd.w) | 0, 0, c0);
    const cam = cameraFor(cw, ch, wd.w, wd.h, { x: c0.bw / 2 - sx, y: c0.bh / 2 - sy }, s);
    if (cv.width !== cam.bw || cv.height !== cam.bh) { cv.width = cam.bw; cv.height = cam.bh; }
    const nx = reduce ? null : nextAction(demo); // the cursor waits on the tile of the next action, in the colour of that action
    backdrop(ctx, cv.width, cv.height);
    setArmed(nx && ACTIONS[nx[1]] ? nx[1] : null);
    drawWorld(ctx, demo.g, cam, demo.mode, nx ? nx[2] : null, now);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(250, now - (last || now)); last = now;
    if (!reduce && demo.t >= demo.ticks) { holdUntil ||= now + HOLD_MS; if (now > holdUntil) show(k); }
    else if (!reduce) for (acc += dt; acc >= demo.ms && demo.t < demo.ticks; acc -= demo.ms) for (const [id, i, ok] of demoStep(demo)) if (ok) press(id, i);
    draw(now);
  }
  $('hTitle').textContent = title; $('hSub').textContent = sub; $('hHint').textContent = HOWTO.hint;
  $('hPrev').onclick = () => k > 0 && show(k - 1);
  $('hGo').onclick = () => k < items.length - 1 ? show(k + 1) : dlg.close();
  dlg.onkeydown = e => {
    if (e.key === 'ArrowLeft' && k > 0) show(k - 1);
    else if (e.key === 'ArrowRight' && k < items.length - 1) show(k + 1);
    else return;
    e.preventDefault();
  };
  dlg.onclose = () => { dlg.onclose = null; cancelAnimationFrame(raf); clearTimeout(flash); setArmed(null); resetRender(); keep.forEach(f => f()); onClose?.(); };
  show(0);
  dlg.showModal();
  dlg.scrollTop = 0;
  raf = requestAnimationFrame(frame);
}
