// =====================================================================
// 阶段 2 · WFC 选型层门禁（2026-09-04）
//
// 一个脚本盖住四张单，因为它们共用同一次编译，分开跑要重复付编译成本：
//   G-03 门 H 上半 —— 原型合法 / 无 dead variant / 相容率 ≤ 40%
//   G-06           —— 回放（pins 全钉逐格相等）+ 确定性 + 100 seed 零失败
//   G-09 门 H 下半 —— 传播确实会收缩邻居的域（钉一格，别的格跟着坍缩）
//   门 I           —— 复现 S19 的四个画面事实
//
// 纯数据，不需要 Three.js：这一层只决定"每格是什么体块角色"，不碰几何。
// 运行：node tools/test_wfc_town_selection.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const { TOWN_MODULE_PROTOTYPES: protos } = await import(new URL("world/citadel/townModulePrototypes.js", SRC).href);
const { validateModulePrototype } = await import(new URL("procgen/wfc/moduleSchema.js", SRC).href);
const { compileVariants } = await import(new URL("procgen/wfc/socketCompiler.js", SRC).href);
const { compileCompatibilityTable } = await import(new URL("procgen/wfc/compatibilityTable.js", SRC).href);
const { partialObservation } = await import(new URL("procgen/wfc/partialObservation.js", SRC).href);
const { solveTownSelection } = await import(new URL("world/citadel/wfcTownSelection.js", SRC).href);
const { createCitadelCellGraph } = await import(new URL("world/citadel/wfcGraphAdapter.js", SRC).href);
const town = await import(new URL("world/citadelTown.js", SRC).href);

const mk = (rows) => new Map(rows.map(([x, y, z, c = "0"]) => [`${x},${y},${z}`, c]));
const roleOf = (r, id) => r.byCell[id]?.variant ?? null;
const DIRS = ["N", "E", "S", "W", "U", "D"];

// ---------------------------------------------------------------- G-03
{
  for (const p of protos) {
    const v = validateModulePrototype(p);
    assert.ok(v.ok, `${p.id} 不合法: ${v.errors?.join(",")}`);
  }
  const compiled = compileVariants(protos);
  const table = compileCompatibilityTable(compiled, { onDeadVariant: "report" });
  assert.equal(table.deadVariants.length, 0,
    `dead variant（声明了面却在任何方向都没有邻居）: ${table.deadVariants.map((d) => d.key).join(", ")}`);

  const n = compiled.variants.length;
  let ok = 0, total = 0, h = 0, ht = 0, v = 0, vt = 0;
  for (const dir of DIRS) {
    for (let a = 0; a < n; a++) {
      const c = table.compatible[dir][a].popcount();
      ok += c; total += n;
      if (dir === "U" || dir === "D") { v += c; vt += n; } else { h += c; ht += n; }
    }
  }
  const rate = ok / total;
  console.log(`G-03  原型 ${protos.length} → 变体 ${n}（去重 ${compiled.stats.deduped}）· dead 0`);
  console.log(`      相容率 ${(100 * rate).toFixed(1)}%（水平 ${(100 * h / ht).toFixed(1)}% / 竖向 ${(100 * v / vt).toFixed(1)}%）`);
  // 门 H 上半：旧 V6 目录同法枚举是 74.9%——那种"几乎全相容"的表等于没有约束。
  assert.ok(rate <= 0.40, `相容率 ${(100 * rate).toFixed(1)}% > 40%：约束没有区分度，传播不会收缩域`);
  // 反向守门：也不能过严到连自己都拼不起来
  assert.ok(rate >= 0.02, `相容率 ${(100 * rate).toFixed(1)}% < 2%：约束过严，正常布局会解不出来`);
}

// ------------------------------------------------------- G-06 真实布局
const layout = town.normalizeCitadelTerraceLayout(town.HIGHLAND_TOWNSCAPER_TOWN_SPEC, 12);
const grid = town.levelsToGrid(layout.levels ?? layout.terraces?.[0]?.levels ?? layout);
assert.ok(grid.size > 900, `高山布局应有 900+ 格，实得 ${grid.size}`);
{
  const A = solveTownSelection({ grid, seed: 1 });
  assert.ok(A.ok, `真实布局解不出来：${JSON.stringify(A.failure?.conflict ?? A.failure?.reason)}`);
  assert.equal(A.unresolved.length, 0);

  // 回放：把解全部钉回去，换个 seed 也必须逐格一致
  const pins = Object.entries(A.byCell).map(([cell, c]) => ({ cell, variant: c.key }));
  const R = solveTownSelection({ grid, seed: 99, pins });
  assert.ok(R.ok, "回放失败");
  let same = 0;
  for (const id of Object.keys(A.byCell)) if (R.byCell[id]?.key === A.byCell[id].key) same++;
  assert.equal(same, grid.size, `回放 ${same}/${grid.size} 不逐格一致`);

  // 确定性：同 seed 同 hash；不同 seed 应当不同（否则 seed 没接进随机流）
  assert.equal(solveTownSelection({ grid, seed: 1 }).hash, A.hash, "同 seed 出了不同 hash");
  assert.notEqual(solveTownSelection({ grid, seed: 2 }).hash, A.hash, "换 seed 竟然同 hash");

  let fails = 0;
  for (let s = 1; s <= 100; s++) if (!solveTownSelection({ grid, seed: s }).ok) fails++;
  assert.equal(fails, 0, `100 seed 里有 ${fails} 次解不出来`);

  const use = {};
  for (const c of Object.values(A.byCell)) use[c.variant] = (use[c.variant] ?? 0) + 1;
  console.log(`G-06  ${grid.size} 格 · 回放 ${same}/${grid.size} · hash ${A.hash} · 100 seed 零失败`);
  console.log(`      体块角色分布 ${JSON.stringify(use)}`);
  // 分布合理性：不能整城一种角色（那说明约束或权重塌了）
  assert.ok(Object.keys(use).length >= 5, `只用到 ${Object.keys(use).length} 种角色，分布塌了`);
}

// -------------------------------------------------- G-09 传播确实收缩域
{
  const compiled = compileVariants(protos);
  const table = compileCompatibilityTable(compiled, { onDeadVariant: "report" });
  const small = mk([[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0],[1,0,1],[1,1,1]]);
  const graph = createCitadelCellGraph(small);
  const model = { graph, compiled, table };
  const before = partialObservation({ model });
  let seeds = 0, shrunkTotal = 0;
  for (const { id, index } of graph.cells()) {
    const dom = before.cells[index];
    if (dom.domainSize <= 1) continue;
    const pinKey = dom.candidates[0].variant;
    const after = partialObservation({ model, pins: [{ cell: id, variant: pinKey }] });
    let shrunk = 0;
    for (let i = 0; i < after.cells.length; i++) {
      if (i === index) continue;
      if (after.cells[i].domainSize < before.cells[i].domainSize) shrunk++;
    }
    if (shrunk > 0) seeds++;
    shrunkTotal += shrunk;
  }
  console.log(`G-09  钉一格会连带收缩邻居域：${seeds} 个格触发过传播，累计收缩 ${shrunkTotal} 次`);
  // 门 H 下半：只要有一次就证明"传播真的在工作"——旧哈希路径永远是 0。
  assert.ok(seeds > 0, "没有任何一次坍缩收缩了别的格的域：约束没在传播");
}

// ------------------------------------------------------------ 门 I（S19）
{
  const one = solveTownSelection({ grid: mk([[0,0,0]]), seed: 1 });
  assert.ok(one.ok);
  assert.equal(roleOf(one, "0,0,0"), "terrace",
    "S19 t=0.35：单格落地应当是带栏杆的晒台，不是小房子");

  // t=0.70：同一格上面加一层 → 它从"顶格"变"体块"，栏杆消失变墙
  const two = solveTownSelection({ grid: mk([[0,0,0],[0,1,0]]), seed: 1 });
  assert.ok(two.ok);
  assert.equal(roleOf(two, "0,0,0"), "body",
    "S19 t=0.70：上面加一格后，下格必须从晒台变成墙体");
  assert.notEqual(roleOf(two, "0,1,0"), "body", "新的顶格不能还是体块");

  // t=1.40：两根柱子并排各两层 → 顶上两格必须给出同一种顶（共脊 / 连片），
  // 不允许一个坡顶一个晒台那样各修各的
  for (const seed of [1, 2, 3, 4, 5]) {
    const pair = solveTownSelection({ grid: mk([[0,0,0],[0,1,0],[1,0,0],[1,1,0]]), seed });
    assert.ok(pair.ok, `seed ${seed} 解不出来`);
    const l = roleOf(pair, "0,1,0");
    const r = roleOf(pair, "1,1,0");
    assert.equal(l, r, `S19 t=1.40：相邻顶格应连成一片（seed ${seed} 得到 ${l} / ${r}）`);
    assert.ok(["gable", "terrace", "flat", "garden", "hip"].includes(l),
      `顶格角色不该是 ${l}`);
  }

  // t=3.50：孤立高柱 = 塔 + 锥顶；贴着它的房子自己收边，不跨过去合并
  let towerSeen = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const scene = solveTownSelection({
      grid: mk([[0,0,0],[0,1,0],[1,0,0],[1,1,0],[3,0,0,"3"],[3,1,0,"3"],[3,2,0,"3"]]),
      seed,
    });
    assert.ok(scene.ok, `seed ${seed} 解不出来`);
    if (roleOf(scene, "3,2,0") === "cone") {
      towerSeen = true;
      assert.equal(roleOf(scene, "3,1,0"), "tower", "锥顶下面必须是塔身");
      // 最底下那格可以是普通体块：`body.tower.base` 的 D 面是 stack，
      // 允许"塔从楼上长出来"（原型注释里就是这么定的）。真正的硬约束是
      // 锥顶下面必须有塔身，且塔身之间只能与塔身相接。
    }
  }
  assert.ok(towerSeen, "8 个 seed 里孤立 3 高柱一次都没长成塔");

  // S20⑥：封闭庭院的中心才可能出花园；开敞的顶格不行
  let gardenSeen = false;
  const ring = [];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    ring.push([x, 0, z]);
    if (!(x === 1 && z === 1)) ring.push([x, 1, z]);
  }
  for (const seed of [1, 2, 3]) {
    const yard = solveTownSelection({ grid: mk(ring), seed });
    assert.ok(yard.ok, `seed ${seed} 庭院解不出来`);
    if (roleOf(yard, "1,0,1") === "garden") gardenSeen = true;
  }
  assert.ok(gardenSeen, "S20⑥：3×3 环形庭院的中心一次都没出花园（花园权重最高，应当几乎必出）");
  console.log("门 I  S19 复现：t=0.35 晒台 / t=0.70 栏杆→墙 / t=1.40 顶面连片 / t=3.50 塔+锥顶 / 庭院出花园");
}

console.log("✅ test_wfc_town_selection");
