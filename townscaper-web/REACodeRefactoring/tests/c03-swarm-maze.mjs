// 第 56 批 C03 · 810157485638189056「fluid pathfinding on a triangle graph」：粗走廊迷宫 → 三角图 → 顶点距离场流向 → 群体像液体一样流向目标；目标换位立刻改道。
import assert from 'node:assert/strict';
import { corridorMaze, insideMaze, triangulateMaze, spawnSwarm } from '../src/core/swarm-maze.js';
import { buildVertexField, buildFaceDirs, stepCrowd, locate } from '../src/world/navmesh-flow.js';
const maze = corridorMaze({ seed: 7 });
const mesh = triangulateMaze(maze, { step: .12 });
assert.ok(mesh.polys.every((p) => p.vs.length === 3), '全是三角形');
assert.ok(mesh.polys.length > 1500, '三角数 ' + mesh.polys.length);
// 三角形顶点都在迷宫内
assert.ok(mesh.verts.every((v) => insideMaze(maze, v.x, v.z)));
const main = mesh.polys.filter((p) => mesh.component[p.id] === mesh.mainComponent);
assert.ok(main.length / mesh.polys.length > .9, '主连通块占绝大多数');
const A = maze.nodes[0], B = maze.nodes[24];
const agents = spawnSwarm(mesh, 160, { x: A.x, z: A.z, r: 1 }, locate);
assert.equal(agents.length, 160);
const run = (goal, secs) => {
  const field = buildVertexField(mesh, { goal }), fd = buildFaceDirs(mesh, field); let left = 0;
  const mean = () => agents.reduce((s, a) => s + field.dist[mesh.polys[a.poly].vs[0]], 0) / agents.length;
  const d0 = mean();
  for (let t = 0; t < secs * 30; t++) left += stepCrowd(mesh, field, agents, 1 / 30, { speed: 1.6, radius: .055, faceDirs: fd }).left;
  return { d0, d1: mean(), left, near: agents.filter((a) => Math.hypot(a.x - goal.x, a.z - goal.z) < goal.r + 1.4).length };
};
const r1 = run({ x: B.x, z: B.z, r: .5 }, 14);
assert.equal(r1.left, 0, '没人走出三角图');
assert.ok(r1.d1 < r1.d0 * .25 && r1.near > 120, '流向目标 ' + JSON.stringify(r1));
// 换目标：立即改道
const C = maze.nodes[4];
const r2 = run({ x: C.x, z: C.z, r: .5 }, 14);
assert.ok(r2.left === 0 && r2.d1 < r2.d0 * .3 && r2.near > 110, '改道 ' + JSON.stringify(r2));
// 沿走廊流动：所有人始终在迷宫内
assert.ok(agents.every((a) => insideMaze(maze, a.x, a.z)));
console.log('PASS 三角图流体寻路', JSON.stringify({ tris: mesh.polys.length, r1, r2 }));
