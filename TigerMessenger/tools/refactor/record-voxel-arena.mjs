// R105+ ⑦ 擂台登记：13 个体素层能力（capabilities/registry.js CAPABILITIES 全部）在同一座
// 固定种子擂台岛上各跑一遍 match→run（layer 类只到 match），实测量：
//   targets   match 出的目标数（考场确实喂得出目标才算上擂）
//   applied   run 实际处置数（几何类）
//   voxels    run 前后 solid/rock/color 位面变化的体素数（几何类）
//   layer3d   layer 类能力的显示层声明（其真实层附着证据在 voxel-caps-browser e2e）
// 判定规则写死：几何类 targets≥1 且 applied≥1 为「擂过」；layer 类 targets≥1 且 layer3d 已声明。
// 每个能力一份 catalog/arena/<id>.json 指针文件指向共享表 voxel.json（参照 terrain.json 先例）。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-voxel-arena.mjs
import fs from 'node:fs';
import { CAPABILITIES } from '../../../townscaper-web/REACodeRefactoring/src/capabilities/registry.js';
import { top, ground, isSolid, isRock, setVoxel, cloneWorldData } from '../../../townscaper-web/REACodeRefactoring/src/capabilities/ops.js';

const N = 9, cid = (x, y) => y * N + x;
const ARENA_SEED = 20261125;

/** 一座擂台岛喂全部 13 个能力：水缘 + 铺地内院 + 双峰塔 + 岩台崖 + 拱桥对 + 隧道脊 + 孤水格。 */
function arenaWorld() {
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const id = y * N + x;
    cells.push({ id, n: 4, cx: x + .5, cz: y + .5, edgeNeighbors: [x > 0 ? id - 1 : -1, y > 0 ? id - N : -1, x < N - 1 ? id + 1 : -1, y < N - 1 ? id + N : -1] });
  }
  const w = {
    cells, grid: { cells }, seed: ARENA_SEED,
    solid: new Int32Array(N * N), rock: new Int32Array(N * N), color: new Int32Array(N * N), river: new Int32Array(N * N),
    touched: 0, touch() { this.touched++; },
  };
  w.top = (c) => top(w, c.id); w.ground = (c) => ground(w, c.id);
  w.isSolid = (c, lv) => isSolid(w, c.id, lv); w.isRock = (c, lv) => isRock(w, c.id, lv);
  w.isBuilt = (c, lv) => isSolid(w, c.id, lv) && !isRock(w, c.id, lv);
  w.setSolid = (c, lv, on, o) => setVoxel(w, c.id, lv, on, o);
  w.neighbor = (c, e) => { const id = c.edgeNeighbors[e]; return id >= 0 ? cells[id] : null; };
  w.snapshot = () => cloneWorldData(w);
  w.restore = (s) => { w.solid.set(s.solid); w.rock.set(s.rock); w.color.set(s.color); w.river.set(s.river); };
  const fill = (id, h, rock = true) => { for (let lv = 1; lv <= h; lv++) setVoxel(w, id, lv, true, { rock }); };
  // 铺地内院 4×4（top=1 建筑）→ assembly court / smoke / contours / watervol 岸线
  for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) fill(cid(x, y), 1, false);
  // 岩台 3×3 h=4 岩石 → shrub 台地边 / overhang / ledge（邻铺地 h=1，落差 ≥3）
  for (let y = 5; y <= 7; y++) for (let x = 5; x <= 7; x++) fill(cid(x, y), 4, true);
  // 低架 h=1 岩石沿岩台北缘（ledge 需要「本格顶 t 邻 wt≥t+3 的岩壁」）
  for (const x of [5, 6, 7]) fill(cid(x, 4), 1, true);
  // 细高塔 h=6 建筑临海（lighthouse / lighthouse-light：邻格有 h=0 水、其他邻 ≤t-2）
  fill(cid(1, 7), 6, false);
  fill(cid(1, 8), 1, false); fill(cid(2, 8), 1, false);           // 塔下基座，不靠水那侧
  // 拱桥对：两 h=5 岩柱隔 2 格 h=1（arch：柱间 1–6 格、低 ≥2 层）
  fill(cid(6, 1), 5, true); fill(cid(8, 1), 5, true);
  fill(cid(7, 1), 1, true); fill(cid(7, 2), 1, true);
  // 隧道脊：两端同高地面、中间 2 格 h=3 岩（tunnel：中间高 ≥2）
  fill(cid(5, 8), 1, true); fill(cid(6, 8), 1, true);
  fill(cid(6, 6), 3, true); fill(cid(7, 6), 3, true); fill(cid(8, 6), 3, true);
  // 孤水格留给 seastack：东北角 (0,8)/(1,8) 水，陆地在两格外的 (1,7) 塔 —— 前面已布好
  return w;
}

function voxelDelta(before, w) {
  let n = 0;
  for (let i = 0; i < w.solid.length; i++)
    n += ((w.solid[i] ^ before.solid[i]) !== 0) + ((w.rock[i] ^ before.rock[i]) !== 0) + ((w.color[i] ^ before.color[i]) !== 0);
  return n;
}

const day = new Date().toISOString().slice(0, 10);
const results = [];
for (const cap of CAPABILITIES) {
  const w = arenaWorld();
  const targets = cap.match(w, {}, {});
  const entry = { id: cap.meta.id, name: cap.meta.name, kind2: cap.meta.kind2 || 'geometry', layer3d: cap.meta.layer3d || null, targets: targets.length, tried: targets.length };
  if (cap.run) {
    const before = w.snapshot();
    const t0 = Date.now();
    const out = cap.run(w, { targets, params: {}, ctx: {} });
    entry.ms = Date.now() - t0;
    entry.applied = out.applied.length;
    entry.voxels = voxelDelta(before, w);
    entry.pass = targets.length >= 1 && out.applied.length >= 1;
    entry.reasons = targets.filter((t) => out.applied.includes(t.id)).map((t) => t.reason);
  } else {
    entry.pass = targets.length >= 1 && !!entry.layer3d;
  }
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { seed: ARENA_SEED, grid: `${N}×${N} 体素擂台岛（水缘+铺地内院+细高塔+岩台崖+拱桥对+隧道脊+孤水格）`, runner: 'TigerMessenger/tools/refactor/record-voxel-arena.mjs（实算）' },
  judge: '规则写死：几何类 targets≥1 且 applied≥1 为「擂过」；layer 类 targets≥1 且声明 layer3d 显示层（层附着实景证据在 voxel-caps e2e）。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('voxel.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'voxel', schemaVersion: 1, pass: r.pass,
    basis: `本能力在固定种子擂台岛（voxel.json）真实跑过 match${cap_run_note(r)}，成绩见共享表——判定规则写在表头，不手改。`,
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/voxel.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-voxel-arena.mjs（实算）',
    test: 'TigerMessenger/tests/registry-caps.test.mjs',
    arena: { seed: ARENA_SEED },
    result: { verdict: r.verdict, targets: r.targets, applied: r.applied ?? null, voxels: r.voxels ?? null, layer3d: r.layer3d, ms: r.ms ?? null },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
function cap_run_note(r) { return r.applied !== undefined && r.applied !== null ? '→run' : '（layer 类无 run，层声明与实景附着另见 e2e）'; }
console.log(`voxel arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets}${r.applied !== undefined ? ` applied=${r.applied} voxels=${r.voxels}` : ' layer=' + r.layer3d}`);
