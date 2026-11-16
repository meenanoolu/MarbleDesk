// Random-search each level for a winning placement, to prove it is solvable.
// Usage: node test/solve.mjs [tries]
import { readFileSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../src/levels.js';
import { initPhysics, simulate, W } from '../src/sim.js';

await initPhysics();
const tries = Number(process.argv.find((a) => /^\d+$/.test(a)) || 3000);
const snap = (v) => Math.round(v / 0.01) * 0.01;
const rnd = (a, b) => a + Math.random() * (b - a);

function clearOfStatics(level, p) {
  for (const s of level.statics) {
    if (Math.abs(p.x - s.x) < s.w / 2 + 0.05 && Math.abs(p.y - s.y) < s.h / 2 + 0.03) return false;
  }
  return true;
}

function randomPlacement(level) {
  const pieces = [];
  for (const [type, n] of Object.entries(level.inventory)) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 20; k++) {
        const p = { type, x: snap(rnd(-W / 2 + 0.05, W / 2 - 0.05)), y: snap(rnd(0.03, 0.27)) };
        const farEnough = pieces.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.07);
        if (farEnough && clearOfStatics(level, p)) { pieces.push(p); break; }
      }
    }
  }
  return pieces;
}

let allOk = true;
const out = [];
for (const [i, level] of LEVELS.entries()) {
  if (level.sandbox) continue;
  let wins = 0, best = null;
  const total = level.solution && level.solution.length ? 1 : tries;
  if (level.solution && level.solution.length) {
    const r = simulate(level, level.solution);
    console.log(`Level ${i + 1} "${level.name}": stored solution ${r.won ? 'WINS' : 'FAILS'} (${r.time.toFixed(2)}s)`);
    if (!r.won) allOk = false;
    continue;
  }
  for (let t = 0; t < total; t++) {
    const sol = randomPlacement(level);
    const r = simulate(level, sol);
    if (r.won) { wins++; if (!best || sol.length < best.length) best = sol; if (wins >= 1 && !best) best = sol; }
  }
  console.log(`Level ${i + 1} "${level.name}": ${wins}/${total} random layouts win`);
  if (best) out.push({ level: i + 1, solution: best });
  else allOk = false;
}
if (process.argv.includes('--write')) {
  const sols = LEVELS.map((l, i) => (out.find((o) => o.level === i + 1)?.solution) || l.solution || []);
  writeFileSync(new URL('../src/solutions.json', import.meta.url), JSON.stringify(sols));
  console.log('wrote src/solutions.json');
}
process.exit(allOk ? 0 : 1);
