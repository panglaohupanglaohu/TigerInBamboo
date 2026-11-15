// 第 56 批 C03 · 807256278154301441「cheap swarm pathfinding」：整群共用一棵到目标的最短路树，沿分层导航图爬台阶、换目标整群改道。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { CrabSwarm } = await import('../src/life/crab-swarm.js');
// 2 行 × 12 列：左半 1 层、右半 2 层（中间一步台阶，maxStep 内可走）
const W = 12, cells = [];
for (let j = 0; j < 2; j++) for (let i = 0; i < W; i++) { const id = j * W + i; cells.push({ id, n: 4, cx: i, cz: j, pts: [{ x: i - .5, z: j - .5 }, { x: i + .5, z: j - .5 }, { x: i + .5, z: j + .5 }, { x: i - .5, z: j + .5 }], edgeNeighbors: [j > 0 ? id - W : -1, i < W - 1 ? id + 1 : -1, j < 1 ? id + W : -1, i > 0 ? id - 1 : -1] }); }
const world = new World({ cells }); for (const c of cells) world.fill(c, c.cx < 6 ? 1 : 2, { rock: true });
const index = { cellAt(x, z) { const i = Math.round(x), j = Math.round(z); return i >= 0 && i < W && j >= 0 && j < 2 ? cells[j * W + i] : null; } };
const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh: null, navLayer: null };
const sw = new CrabSwarm(view, world, { count: 40, retarget: 1e9 });
sw.step(.05);
const g = sw.nav.graph;
assert.ok(sw.stats.nodes >= 20 && sw.stats.floors === 2, JSON.stringify(sw.stats));
const goalHi = sw.pool.find((i) => g.nodes[i].cell.cx === 11 && g.nodes[i].floor === 2), goalLo = sw.pool.find((i) => g.nodes[i].cell.cx === 0 && g.nodes[i].floor === 1);
const mean = () => sw.crabs.reduce((s, c) => s + sw.dist[c.node], 0) / sw.crabs.length;
const run = (goal, secs) => { sw.setTarget(goal); const d0 = mean(); let maxDy = 0; for (let t = 0; t < secs; t += .05) { const ys = sw.crabs.map((c) => c.y); sw.step(.05); sw.crabs.forEach((c, k) => { maxDy = Math.max(maxDy, Math.abs(c.y - ys[k])); }); } return { d0, d1: mean(), maxDy, near: sw.crabs.filter((c) => Math.hypot(c.x - g.nodes[goal].x, c.z - g.nodes[goal].z) < 1.2).length }; };
const r1 = run(goalHi, 25);
assert.ok(r1.d1 < .6 && r1.near >= 35, '整群到高层目标 ' + JSON.stringify(r1));
assert.ok(sw.crabs.every((c) => Math.abs(c.y - 1) < .05), '在 2 层表面（y=1）');
assert.ok(r1.maxDy < .12, '上台阶高度连续，单步跳变小 ' + r1.maxDy);
const r2 = run(goalLo, 25);
assert.ok(r2.d1 < .6 && r2.near >= 35, '换目标整群改道下台阶 ' + JSON.stringify(r2));
assert.equal(sw.mesh.count, 40);
// 共用一棵树：下一跳表一次算全图
assert.equal(sw.next.length, g.nodes.length); assert.equal(sw.next[goalLo], -1);
console.log('PASS crab swarm', JSON.stringify({ nodes: sw.stats.nodes, r1, r2 }));
