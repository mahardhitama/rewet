// Headless level run: node scripts/sim-run.js --level N --plan plan.json  (plan = [{tick,id,x,y}])
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { createGame, applyAction, step } from '../src/sim/game.js';
import { evaluate, checkEarlyLoss, co2Estimate } from '../src/sim/score.js';
import { TICKS_PER_YEAR } from '../src/sim/season.js';
import { idx } from '../src/sim/world.js';
import { resolveLevel } from '../src/sim/mapgen.js';

// Applies each plan entry at its tick, runs to level end or early loss. refused = [{...entry, reason}].
export function runPlan(levelId, plan) {
  const found = LEVELS.find((l) => l.id === levelId);
  if (!found) throw new Error(`no level ${levelId}`);
  const level = resolveLevel(found);
  const g = createGame(level, {}, buildLevelWorld(level));
  const todo = [...plan].sort((a, b) => a.tick - b.tick);
  const refused = [];
  let loss = null, k = 0;
  for (let t = 0; t < level.years * TICKS_PER_YEAR && !loss; t++) {
    for (; k < todo.length && todo[k].tick <= t; k++) {
      const e = todo[k], r = applyAction(g, e.id, idx(level.size, e.x, e.y));
      if (!r.ok) refused.push({ ...e, reason: r.reason });
    }
    step(g);
    loss = checkEarlyLoss(g);
  }
  return { evaluate: evaluate(g), co2Estimate: co2Estimate(g), loss, refused, tick: g.tick };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const levelId = Number(arg('--level'));
  const plan = arg('--plan') ? JSON.parse(readFileSync(arg('--plan'), 'utf8')) : [];
  const r = runPlan(levelId, plan);
  for (const e of r.refused) console.error(`refused tick ${e.tick} ${e.id} (${e.x},${e.y}): ${e.reason}`);
  console.log(JSON.stringify({ evaluate: r.evaluate, co2Estimate: r.co2Estimate, loss: r.loss }, null, 2));
}
