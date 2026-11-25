// r222 · 1344290848180203523 QA 残差核销：外露墙带漏面 + 悬空体块支撑核查（src/core/qa-replay.js）。
// node 真 WorldMesh（关烘焙）：
//   · auditSurfaceCoverage：双网格默认镇全部外露已建墙带 9 点采样覆盖；删一整带 → 必被抓；
//   · auditUndersideSupport：默认镇悬空体块 + 手工方格拱（两对边下层支撑）/ 平底+钢柱全有底；
//     抽平底 / 抽钢柱 / 拆拱腹反例 → 各自被判 unsupported；
//   · runWorldQA 逐步带着两条核查跑 16 步、runMonkeyQA 核对点也过，结束 World 逐数组还原。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World, MAX_LEVEL } = await import('../src/core/world.js');
const { PALETTES } = await import('../src/core/palette.js');
const { buildScene } = await import('../src/world/scenes.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const Q = await import('../src/core/qa-replay.js');
const M = await import('../src/core/qa-monkey.js');
const L = 0.5;

/** 把 geometry 里满足 pred(triVerts) 的三角形删掉，返回新 BufferGeometry。 */
const dropTris = (geometry, pred) => {
  const p = geometry.getAttribute('position').array, idx = geometry.index?.array, keep = [];
  for (let t = 0; t + 2 < (idx ? idx.length : p.length); t += 3) {
    const ids = [0, 1, 2].map((k) => (idx ? idx[t + k] : t + k));
    const v = ids.map((i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
    if (!pred(v)) keep.push(...v.flat());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keep), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(keep.length), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(keep.length), 3));
  return g;
};

const out = [];
for (const kind of ['quad', 'mixed']) {
  const grid = decorateCells(kind === 'mixed' ? buildMixedGrid({ radius: 22, hexSize: 0.62 }) : buildQuadGrid({ radius: 14, hexSize: 1 }));
  const world = new World(grid); world.palette = PALETTES.town; buildScene(world, 'town', 7);
  const wm = new WorldMesh(world, { levelHeight: L }); wm.bake = false; wm.rebuild();
  const geometry = wm.geometry, index = Q.triangleIndex(geometry);

  // 1) 外露墙带：默认镇全覆盖
  const faces = Q.exposedWallFaces(world, L);
  const walls = Q.auditSurfaceCoverage(world, geometry, { L, index });
  assert.ok(faces.length > 100 && walls.faces === faces.length);
  assert.ok(walls.valid && walls.missing.length === 0 && walls.uncovered.length === 0 && walls.covered === walls.samples,
    `${kind} 默认镇墙带应全覆盖 ${JSON.stringify(walls.uncovered.slice(0, 3))}`);

  // 2) 反例：删掉一整条墙带 → 必报 uncovered/missing
  const f = faces.find((x) => x.len > 0.3) ?? faces[0];
  const sIn = -Math.min(0.10, 0.45 * f.len), sOut = Math.max(0.02 * f.len, 0.13);
  const holed = dropTris(geometry, (v) => v.every((q) => {
    const d = f.nx * (q[0] - f.ax) + f.nz * (q[2] - f.az);
    const t = ((q[0] - f.ax) * (f.bx - f.ax) + (q[2] - f.az) * (f.bz - f.az)) / f.len;
    return d >= sIn && d <= sOut && t >= -0.05 && t <= f.len + 0.05 && q[1] >= f.yA - 0.04 * L && q[1] <= f.yB + 0.04 * L;
  }));
  const w2 = Q.auditSurfaceCoverage(world, holed, { L });
  assert.ok(!w2.valid && w2.uncovered.some((u) => u.cell === f.cell && u.edge === f.edge && u.level === f.level),
    `${kind} 删带必须被抓 cell ${f.cell} edge ${f.edge} lv ${f.level}`);

  // 3) 悬空支撑：默认镇全有底
  const sup = Q.auditUndersideSupport(world, geometry, { L, index });
  assert.ok(sup.floating > 0 && sup.valid && sup.unsupported.length === 0,
    `${kind} 默认镇悬空体块应有底 ${JSON.stringify(sup.unsupported.slice(0, 3))}`);

  // 4) runWorldQA 16 步逐步带核查（真实 stub view：render=整体重建）
  const before = world.snapshot();
  const view = { worldMesh: wm, changed() {}, render() { wm.rebuild(); } };
  const r = await Q.runWorldQA({ world, view });
  assert.equal(r.steps.length, 16);
  for (const s of r.steps) {
    assert.ok(s.valid && s.walls.valid && s.support.valid, `${kind} 第 ${s.step.level}/${s.step.on} 步墙带/支撑应过 ${JSON.stringify(s.errors)}`);
    assert.ok(s.walls.faces > 0 && s.walls.covered === s.walls.samples, `${kind} 逐步墙带应全覆盖`);
  }
  for (const k of ['solid', 'rock', 'color', 'river']) assert.deepEqual(Array.from(world[k]), Array.from(before[k]), `${kind} ${k} 还原`);
  out.push(`${kind}: 墙带 ${walls.faces} 覆盖 ${walls.covered}/${walls.samples} · 悬空 ${sup.floating}(拱${sup.arch}/平${sup.flat},柱${sup.postsExpected}) · 16步核查全过`);
}

// 5) 手工配置：quad 平底悬空 + 钢柱；方格两对边支撑 → 拱
{
  const grid = decorateCells(buildQuadGrid({ radius: 6, hexSize: 1 }));
  const world = new World(grid); world.palette = PALETTES.town;
  const center = [...world.cells].sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz));
  const c = center.find((x) => x.n === 4 && x.edgeNeighbors.every((id) => id >= 0));
  // 拱配置：c 第 1、3 层实心（第 2 层空），边 i 与 i+2 的邻格 1..2 层实心
  const i = [0, 1].find((k) => c.edgeNeighbors[k] >= 0 && c.edgeNeighbors[k + 2] >= 0);
  for (const k of [i, i + 2]) world.fill(world.cells[c.edgeNeighbors[k]], 2);
  world.fill(c, 1); world.setSolid(c, 3, true);
  // 平底+钢柱：孤立的另一格只留第 4 层（1..3 层空 → runBottom，无对边支撑）
  const d = center.find((x) => x !== c && x.id !== c.id && Math.hypot(x.cx - c.cx, x.cz - c.cz) > 2 && x.edgeNeighbors.every((id) => id < 0 || !world.isSolid(world.cells[id], 1)));
  world.setSolid(d, 4, true);
  const wm = new WorldMesh(world, { levelHeight: L }); wm.bake = false; wm.rebuild();
  const geometry = wm.geometry, index = Q.triangleIndex(geometry);
  const vox = Q.floatingVoxels(world, L);
  const vc = vox.find((v) => v.cell === c.id), vd = vox.find((v) => v.cell === d.id);
  assert.ok(vc && vc.kind === 'arch', '两对边支撑的悬空方格应判拱');
  assert.ok(vd && vd.kind === 'flat' && vd.posts.length >= 1, '无支撑角应判平底+钢柱');
  const sup = Q.auditUndersideSupport(world, geometry, { L, index });
  assert.ok(sup.valid && sup.unsupported.length === 0, `手工配置支撑应过 ${JSON.stringify(sup.unsupported)}`);

  // 反例 A：抽掉 d 的平底 → 'flat-bottom'
  const cD = d, inside = (x, z) => { for (let e = 0; e < cD.n; e++) { const a = cD.pts[e], b = cD.pts[(e + 1) % cD.n]; let nx = -(b.z - a.z), nz = b.x - a.x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * ((a.x + b.x) / 2 - cD.cx) + nz * ((a.z + b.z) / 2 - cD.cz) < 0) { nx = -nx; nz = -nz; } if (nx * (x - a.x) + nz * (z - a.z) > 0.01) return false; } return true; };
  const noBottom = dropTris(geometry, (v) => {
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3;
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    const ny = (uz * wx - ux * wz) / (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) || 1);
    return ny < -0.5 && Math.abs(cy - vd.yBase) < 0.02 * L && inside(cx, cz);
  });
  const s2 = Q.auditUndersideSupport(world, noBottom, { L });
  assert.ok(s2.unsupported.some((u) => u.cell === d.id && u.level === vd.level && u.reason === 'flat-bottom'), '抽平底必须被抓');

  // 反例 B：抽掉 d 的钢柱（柱轴附近三角）→ 'post'
  const post = vd.posts.find((p) => p.free.length) ?? vd.posts[0];
  const noPost = dropTris(geometry, (v) => {
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3;
    return Math.hypot(cx - post.x, cz - post.z) <= 0.07 && cy > post.yFloor - 0.05 && cy < post.yBase + 0.05;
  });
  const s3 = Q.auditUndersideSupport(world, noPost, { L });
  assert.ok(s3.unsupported.some((u) => u.cell === d.id && u.level === vd.level && u.reason === 'post'), `抽钢柱必须被抓 ${JSON.stringify(s3.unsupported)}`);

  // 反例 C：拆 c 的拱腹 → 'arch-soffit'
  const cC = c, insideC = (x, z) => { for (let e = 0; e < cC.n; e++) { const a = cC.pts[e], b = cC.pts[(e + 1) % cC.n]; let nx = -(b.z - a.z), nz = b.x - a.x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * ((a.x + b.x) / 2 - cC.cx) + nz * ((a.z + b.z) / 2 - cC.cz) < 0) { nx = -nx; nz = -nz; } if (nx * (x - a.x) + nz * (z - a.z) > 0.01) return false; } return true; };
  const noSoffit = dropTris(geometry, (v) => {
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3;
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    const ny = (uz * wx - ux * wz) / (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) || 1);
    return ny < -0.2 && cy > vc.yBase - 0.95 * L && cy < vc.yBase + 0.02 * L && insideC(cx, cz);
  });
  const s4 = Q.auditUndersideSupport(world, noSoffit, { L });
  assert.ok(s4.unsupported.some((u) => u.cell === c.id && u.level === vc.level && u.reason === 'arch-soffit'), `拆拱腹必须被抓 ${JSON.stringify(s4.unsupported)}`);
  out.push(`手工: 拱 ${c.id}:${vc.level} 平底柱 ${d.id}:${vd.level}(${vd.posts.length}角) 三反例全被抓`);
}

// 6) 猴子 QA 核对点带墙带/悬空核查（quad 网格）
{
  const grid = decorateCells(buildQuadGrid({ radius: 14, hexSize: 1 }));
  const world = new World(grid); world.palette = PALETTES.town; buildScene(world, 'town', 7);
  const wm = new WorldMesh(world, { levelHeight: L }); wm.bake = false;
  const view = { worldMesh: wm, changed() {}, render() { wm.rebuild(); } };
  const r = await M.runMonkeyQA({ world, view }, { seed: 11, steps: 60, checkEvery: 10 });
  assert.ok(r.surfaceChecks.length >= 6 && r.surfaceChecks.every((s) => s.uncovered === 0 && s.unsupported === 0),
    `猴子核对点墙带/支撑应全过 ${JSON.stringify(r.surfaceChecks)}`);
  assert.ok(r.endState.floating > 0);
  out.push(`猴子 60 步核对 ${r.surfaceChecks.length} 次：未覆盖 0 · 失支撑 0 · 结束悬空 ${r.endState.floating}`);
}
console.log('PASS qa-replay r222: ' + out.join(' | '));
