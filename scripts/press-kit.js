// Press-kit images for the README: node scripts/press-kit.js [out-dir]  (default docs/press)
// Serve the game first: python3 -m http.server 8765. The GIFs need ffmpeg on the PATH; without it the script skips them.
// The script runs the game in headless Chrome, with animations on, and saves:
// - hero.gif: the title and the subtitle on the animated menu map, with a transparent background.
// - seasons.gif: two views side by side, with a transparent background. Left: the wet season arrives (dry to wet).
//   Right: the dry season arrives (wet to dry).
// - level.png, data.png, debrief.png and scenic.png: 1280x720 each, with a dark frame.
// Level 4 runs on its first map seed with the block plan from auto-plan.js. Each map shows at a whole zoom step
// (1 or 2 screen px per buffer px), so the pixels stay square.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withPage, sleep, GAME_URL, TITLE_ONLY } from './chrome.js';
import { blockPlan } from './auto-plan.js';
import { LEVELS } from '../src/levels.js';
import { resolveLevel } from '../src/sim/mapgen.js';
import { TICKS_PER_YEAR } from '../src/sim/season.js';
import { INTRO_LEVEL } from '../src/render/introStory.js';
import { TW, TH, PAD } from '../src/render/isoMath.js';

const out = process.argv[2] ?? new URL('../docs/press', import.meta.url).pathname;
const W = 1280, H = 720, LEVEL = 4, FRAME_MS = 125, HERO_FRAMES = 32, SEASON_FRAMES = 40;
// The menu map fits the window at scale 2 exactly: fitScale() divides the window by the map box plus PAD.
const n = INTRO_LEVEL(0).size * 2, HERO_W = 2 * (n * TW / 2 + 2 * PAD), HERO_H = 2 * (n * TH / 2 + 2 * PAD);
const PANEL_W = 480, PANEL_H = 300;
const NEW_YEAR = 2 * TICKS_PER_YEAR, DRY_START = NEW_YEAR + 116; // the first tick of year 3; week 29 of year 3
const level = resolveLevel(LEVELS[LEVEL - 1]);
const plan = blockPlan(level);
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'rewet-gif-'));

const click = id => `document.getElementById(${JSON.stringify(id)}).click()`;
const css = (id, rules) => `document.getElementById(${JSON.stringify(id)})?.remove();
  ${rules ? `document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style id="${id}">${rules}</style>`)})` : ''}`;
const NO_UI = '#hud,#bar,#toast{display:none!important}';
// In the page: press.go(t) runs the sim to tick t at once; press.live() applies the plan while the game runs.
const INSTALL = `(async () => {
  const { applyAction, step } = await import('/src/sim/game.js');
  const { afterStep } = await import('/src/ui.js');
  const { idx } = await import('/src/sim/world.js');
  const g = rewet.game, todo = ${JSON.stringify(plan)}, size = ${level.size};
  let k = 0;
  const due = () => { for (; k < todo.length && todo[k].tick <= g.tick; k++) applyAction(g, todo[k].id, idx(size, todo[k].x, todo[k].y)); };
  const live = () => { due(); requestAnimationFrame(live); };
  globalThis.press = {
    go(t) { while (g.tick < t) { due(); step(g); afterStep(g); } g.events.length = 0; },
    live,
  };
})()`;
const CLOSE_REPORT = `if (!document.getElementById('report').hidden) document.getElementById('rpCont').click()`;
const SCALE = `innerWidth / document.querySelector('canvas').width`;

// Frame folders to a looping GIF with a transparent background. vf: an ffmpeg filter that gives one stream.
function gif(inputs, vf, file) {
  const args = ['-y', '-loglevel', 'error'];
  for (const dir of inputs) args.push('-framerate', String(1000 / FRAME_MS), '-i', join(dir, 'f%03d.png'));
  args.push('-filter_complex', `${vf},split[a][b];[a]palettegen=max_colors=128:reserve_transparent=1[p];[b][p]paletteuse=dither=none:alpha_threshold=128`, file);
  try { execFileSync('ffmpeg', args); console.log(`Wrote ${file}`); } catch { console.log(`No ffmpeg: skipped ${file}`); }
}

try {
  await withPage(HERO_W, HERO_H, async ({ send, evaluate, shot, transparent, outline, key, size }) => {
    const save = async (name) => { writeFileSync(join(out, name), await shot()); console.log(`Wrote ${join(out, name)}`); };
    const frames = async (name, count, each = '') => {
      const dir = join(tmp, name); mkdirSync(dir);
      for (let f = 0; f < count; f++) {
        writeFileSync(join(dir, `f${String(f).padStart(3, '0')}.png`), await shot());
        if (each) await evaluate(each);
        await sleep(FRAME_MS);
      }
      return dir;
    };
    // A whole zoom step: '0' gives the fit zoom, then '+' until the scale is a whole number.
    const wholeZoom = async () => {
      await key('0'); await sleep(100);
      for (let k = 0; k < 3 && !Number.isInteger(+(await evaluate(SCALE)).toFixed(3)); k++) { await key('+'); await sleep(100); }
      console.log(`Zoom: ${await evaluate(SCALE)}`);
    };

    // rewet_menu: the flag that a change of language sets, so the page opens on the menu, not the intro
    await send('Page.navigate', { url: `${GAME_URL}?debug` }); await sleep(500);
    await evaluate(`sessionStorage.setItem('rewet_menu', '1'); location.reload()`);
    await sleep(4000); // the font and the map sprites load
    // The menu camera zooms in on the story map; without the camera shot it shows the whole map at the fit zoom.
    await evaluate(`{ const m = rewet.map, draw = m.draw; m.draw = (g, now) => { m.shot = null; draw(g, now); }; }`);
    await transparent(true);
    await evaluate(css('shotTitle', TITLE_ONLY)); await sleep(1500);
    console.log(`Hero zoom: ${await evaluate(SCALE)}`);
    const hero = await frames('hero', HERO_FRAMES);
    await evaluate(css('shotTitle', ''));

    await evaluate(click('bNew')); await sleep(500);
    // The level button picks a random seed from L.seeds; random 0 gives the first one, as in sim-run.js.
    await evaluate(`{ const r = Math.random; Math.random = () => 0; document.querySelectorAll('#lsList button')[${LEVEL - 1}].click(); Math.random = r; }`);
    await sleep(500);
    await evaluate(`while (document.getElementById('dHow').open) document.getElementById('hGo').click()`); await sleep(300); // past every slide of the level
    await evaluate(INSTALL);
    await size(PANEL_W, PANEL_H); await evaluate(css('shotUi', NO_UI)); await sleep(300);
    await wholeZoom();
    await evaluate(`import('/src/render/fx.js').then(m => m.setBanner(false))`); // the season banner would cover the map
    await evaluate(`press.go(${NEW_YEAR}); press.live()`);
    await evaluate(click('bX2')); await sleep(300);
    const wet = await frames('wet', SEASON_FRAMES, CLOSE_REPORT);
    await evaluate(`press.go(${DRY_START})`); await sleep(300);
    const dry = await frames('dry', SEASON_FRAMES, CLOSE_REPORT);
    await evaluate(click('bPause'));
    await evaluate(`import('/src/render/fx.js').then(m => m.setBanner(true))`);

    await transparent(false); await evaluate(css('shotUi', '')); await size(W, H); await sleep(300);
    await wholeZoom(); await outline(true); await sleep(500);
    await save('level.png');
    await evaluate(click('bData')); await sleep(800);
    await save('data.png');
    await evaluate(click('bData'));
    await evaluate(click('bPause'));
    await evaluate(`press.go(${level.years * TICKS_PER_YEAR - 1})`); await sleep(6000); // the stars and the burst settle
    await save('debrief.png');
    await evaluate(click('dbView')); await sleep(800);
    await wholeZoom(); await sleep(3000);
    await save('scenic.png');

    gif([hero], '[0:v]null', join(out, 'hero.gif'));
    gif([wet, dry], '[0:v][1:v]hstack=inputs=2', join(out, 'seasons.gif'));
  }, { motion: true });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
