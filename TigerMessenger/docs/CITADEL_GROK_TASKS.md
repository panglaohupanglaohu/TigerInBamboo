# 城堡建造管线 · Grok 任务包

> 配 `docs/CITADEL_BUILD_PIPELINE_TODOS.md` 使用。TODOS 里每个 **[Grok]** 项都指向这里的一个 **G-xx**。
> 每个 G-xx 都是**可以直接整段复制给 Grok 的工单**：读什么、写什么、伪代码、验收命令、禁止事项。
> Grok 不读 PLAN，也不需要读；它只需要本文件 + 工单里点名的源文件。
>
> 通用约定（每张工单默认继承）：
> - 仓库根 = `TigerInBamboo/`；所有 `tools/*.mjs` 用 `node tools/xxx.mjs` 从仓库根运行，非零退出 = 失败。
> - 需要 Three.js 的 headless 脚本，**逐字复制** `tools/test_cell_ownership.mjs` 第 14–30 行的 preamble（three 桥接包 + window/document/localStorage 桩），不要自己发明。
> - 纯数据模块（`src/procgen/**`、`src/world/citadel/*Adapter.js`、`*Prototypes.js`）**禁止 import Three.js / DOM**。
> - 不改任何 `FEATURES` / `P.*` 开关默认值；不改任何已有测试的 expected；不动 `odysseyCitadel.js`、`loadCitadel.js`。
> - 确定性：所有随机来自 `createStableRng(seed, streamName)`（`src/procgen/core/stableRng.js`）或 `hashHex`（`src/core/rng.js`），禁止 `Math.random`。
> - 交付物 = 代码 + 脚本 + 一段 ≤10 行的「命令 / 输出数字」文本，贴回 TODOS 对应行。
>
> 状态标记：**[可立即派发]** = 不依赖 Claude 的前置规格；**[等规格]** = 要等 TODOS 里对应 [Claude] 项先交付。

---

## G-01 · `tools/test_face_to_cell_parity.mjs` [可立即派发]（TODOS C4）

**目标**：证明「合并块登记的归属」与「增量重建摘旧网格的判据」覆盖的是同一批格，差集为空。差集不为空 = 重影或丢几何。

**读**：
- `tools/test_cell_ownership.mjs`（preamble + 如何 headless 构建城堡 + 摘除判据的逐字写法）
- `src/world/odysseyCitadel.js:1242–1270`（`faceToCell = [{ triStart, triCount, cell }]` 怎么登记）
- `src/world/odysseyCitadel.js` `rebuildCitadelTownIncremental` 第 2 步（`isDirtySegment` / `dropCellsFromMerged(child, isDirtySegment)` 调用处）

**写**：`tools/test_face_to_cell_parity.mjs`

**伪代码**：
```js
// 1. headless 构建默认高山圣城（与 test_cell_ownership 同一入口、同 seed）
const castle = buildDefaultCitadel();               // 复制 test_cell_ownership 的构建段
// 2. 集合 A：合并前，town 层组里所有会被「摘旧网格」判据命中的网格所声明的格键
const A = new Set();
for (const level of townLevelGroups(castle)) level.traverse(o => {
  if (!o.isMesh) return;
  const u = o.userData;
  if (u.cell) A.add(`${u.cell.ix},${u.cell.iy},${u.cell.iz}`);
  else if (u.townModule) A.add(`${u.townModule.ix},${u.townModule.iy},${u.townModule.iz}`);
  else if (u.cells) for (const k of u.cells) A.add(String(k));
});
// 3. 触发合并（与生产同路径：debounce>0 后采样，见 TODOS C5 注记），集合 B：faceToCell 登记的格键
await settleMerge(castle);                          // 等 400ms 去抖合并落地
const B = new Set();
for (const merged of mergedMeshes(castle)) for (const seg of merged.userData.faceToCell ?? [])
  for (const k of cellKeysOf(seg.cell)) B.add(k);   // seg.cell 可能是 {ix,iy,iz} 或 {cells:[...]}，两种都展开
// 4. 断言
const onlyA = [...A].filter(k => !B.has(k)), onlyB = [...B].filter(k => !A.has(k));
console.log(`A=${A.size} B=${B.size} onlyA=${onlyA.length} onlyB=${onlyB.length}`);
assert.equal(onlyA.length, 0, `摘得到但合并块没登记（会重影）: ${onlyA.slice(0,10)}`);
assert.equal(onlyB.length, 0, `合并块登记了但摘不到（会丢几何）: ${onlyB.slice(0,10)}`);
```

**验收**：`node tools/test_face_to_cell_parity.mjs` 退出 0，打印 `A=… B=… onlyA=0 onlyB=0`。
**禁止**：不改 `collectFaceToCell`；发现差集不为空时**报告清单**，不要在测试里把差集过滤掉。

---

## G-02 · `docs/OSKAR_OFFICIAL_PLAN.md` 来源表补行 [可立即派发]（TODOS C0）

**目标**：纯文档抄录。来源表加 **S21** 一行；S20 一行的「原文」栏补上 ⑤–⑧ 四句。

**读**：`TigerMessenger/docs/CITADEL_BUILD_PIPELINE_PLAN.md` §2.1 的表（①–⑧ 逐字）与 S21 段落。

**写**：只改 `docs/OSKAR_OFFICIAL_PLAN.md` §1 表格两行。S21 行格式照 S20 行。

**验收**：`grep -c "S21" docs/OSKAR_OFFICIAL_PLAN.md` ≥ 2；`grep -c "hexagonal grid" docs/OSKAR_OFFICIAL_PLAN.md` ≥ 1。
**禁止**：不改 §2–§6 任何结论；不新增「项目推导」。

---

## G-03 · `tools/test_module_prototypes.mjs` [可立即派发：C5 已交付 2026-09-03]（TODOS C5）

**已有探针可直接改造**：`tools/probe_c5_prototypes.mjs`（Claude 写的，含相容率全对枚举、S19 场景复现、200 seed 可解性）——把它的 `console.log` 改成 `assert`，就是本测试。当前实测：22 原型 → 48 变体，相容率 **18.7%**（水平 24.9% / 竖向 6.2%），dead=none，200 seed 零失败零回溯。

**目标**：Claude 交付 `src/world/citadel/townModulePrototypes.js`（导出 `TOWN_MODULE_PROTOTYPES: ModulePrototype[]`）后，验证它能被 V7 编译，且约束**有区分度**（门 H 上半）。

**读**：
- `src/procgen/wfc/moduleSchema.js`（`validateModulePrototype(proto)` → `{ok, errors}`；proto 结构见文件头注释）
- `src/procgen/wfc/socketCompiler.js`（`compileVariants(prototypes)` → `{variants, variantIndex, equivalence, stats}`）
- `src/procgen/wfc/compatibilityTable.js`（`compileCompatibilityTable(compiled, {onDeadVariant:"throw"})` → `{compatible[dir][vi]: BitSet, …}`；`BitSet.popcount()`）

**写**：`tools/test_module_prototypes.mjs`

**伪代码**：
```js
import { TOWN_MODULE_PROTOTYPES as protos } from "../TigerMessenger/src/world/citadel/townModulePrototypes.js";
for (const p of protos) { const v = validateModulePrototype(p); assert.ok(v.ok, `${p.id}: ${v.errors}`); }
const compiled = compileVariants(protos);
const table = compileCompatibilityTable(compiled, { onDeadVariant: "throw" }); // dead variant 直接炸
// 相容率：六向全对枚举（不是抽样）
const n = compiled.variants.length; let ok = 0, total = 0;
for (const dir of ["N","E","S","W","U","D"]) for (let a = 0; a < n; a++) { ok += table.compatible[dir][a].popcount(); total += n; }
const rate = ok / total;
console.log(`prototypes=${protos.length} variants=${n} deduped=${compiled.stats.deduped} compat=${(rate*100).toFixed(1)}%`);
assert.ok(rate <= 0.40, `相容率 ${(rate*100).toFixed(1)}% > 40%（门 H 上半）`);
// 每个 family 至少一个 variant；每个 connector 名至少在两侧各出现一次（否则永远接不上）
```

**验收**：退出 0；打印相容率。**参照基线**：旧 V6 目录（`moduleCatalog.js`）同法枚举为 74.9%（水平 87.1% / 竖向 50.6%），新目录必须 ≤ 40%。
**禁止**：不改 `townModulePrototypes.js` 来凑数字——超标就把数字贴回 TODOS 让 Claude 改词汇表。

---

## G-04 · `tools/extract_adjacency_stats.mjs` [可立即派发]（TODOS C5）

**目标**：从现有生产布局（高山 + canal-junction 两实例）统计**家族 × 家族 × 方向**的实际相邻次数，给 Claude 校核 socket 词汇表。只统计，不生成规则。

**读**：
- `src/world/citadelTown.js:65 townscaperModuleSelection(ix,iy,iz,char,salt,openMask)` → `{foundation,floor,fence,balcony,stairs,support,hole,decor}`（每项是家族内 variant 下标）
- `src/world/citadel/moduleFamilies.js`（`TOWNSCAPER_MODULE_FAMILIES`）
- `src/world/citadelTown.js` 导出的 `HIGHLAND_TOWNSCAPER_TOWN_SPEC` / `CANAL_JUNCTION_TOWN_SPEC` / `levelsToGrid`（把 ASCII levels 变 `Map "ix,iy,iz"->char`）
- `tools/audit_module_adjacency.mjs`（已有同类脚本，**只作参考**：它审的是装饰家族，本任务要的是逐格 × 六向 × 家族的原始计数）

**写**：`tools/extract_adjacency_stats.mjs` → 落 `tools/out/adjacency_stats.json`

**伪代码**：
```js
const DELTA = { N:[0,0,-1], S:[0,0,1], W:[-1,0,0], E:[1,0,0], U:[0,1,0], D:[0,-1,0] };
const counts = {};   // key `${famA}.${varA}|${dir}|${famB}.${varB}` -> n
for (const spec of [HIGHLAND_TOWNSCAPER_TOWN_SPEC, CANAL_JUNCTION_TOWN_SPEC]) {
  const grid = levelsToGrid(normalizeCitadelTerraceLayout(spec).levels /* 按现有测试的取法 */);
  const openMask = (ix,iy,iz) => 四向邻空位掩码（照 citadelTown.js:1403 的位序 DIRS）;
  for (const [key, char] of grid) {
    const [ix,iy,iz] = key.split(",").map(Number);
    const a = townscaperModuleSelection(ix,iy,iz,char,0,openMask(ix,iy,iz));
    for (const [dir,[dx,dy,dz]] of Object.entries(DELTA)) {
      const nk = `${ix+dx},${iy+dy},${iz+dz}`; const nc = grid.get(nk);
      if (!nc) { bump(counts, `*|${dir}|air`); continue; }         // 邻空也要计
      const b = townscaperModuleSelection(ix+dx,iy+dy,iz+dz,nc,0,openMask(ix+dx,iy+dy,iz+dz));
      for (const fam of Object.keys(a)) bump(counts, `${fam}.${a[fam]}|${dir}|${fam}.${b[fam]}`);
    }
  }
}
writeJson("tools/out/adjacency_stats.json", { generatedAt, specs:[…], totalCells, counts, byFamily: 汇总到 family 粒度 });
// 自检：totalCells > 0 且 counts 非空，否则非零退出
```

**验收**：`node tools/extract_adjacency_stats.mjs` 退出 0；JSON 里 `totalCells` ≥ 900（高山 942 格）；每个家族的 `byFamily` 行都有 `air` 方向计数。
**禁止**：不输出「规则」「allowed」之类字段；不修改任何 spec。

---

## G-05 · `wfcGraphAdapter.js` + `wfcTownSelection.js` [可立即派发：规格已定 2026-09-03]（TODOS C6）

**参考实现**：`tools/probe_c5_prototypes.mjs` 里的 `graphOf()` / `solve()` 已经是一个能跑的最小适配器——
本工单等于把它搬进 `src/world/citadel/`、补上 `columnHeight`、换成从 `citadelTown` 的 `grid` 取输入。
契约（逐字照做）：水平边只在**同色格**之间建（异色 = 不同建筑，屋顶不合并），竖向边不分颜色；
`exposure(i)` 返回 `air|foreign|edge|edge-top` 四态；`bans` 全部来自 `townBanPolicy({iy, exposure, columnHeight, variant})`；
失败不回退哈希、不塞默认（S20④），原样返回 `failure` + `unresolved:[cellId]`。

**目标**：把 `citadelTown` 的格图喂给 V7 `solveWfc`，输出与 `townscaperModuleSelection` **同形**的按格选型表。策略（哪些 variant 在哪种邻空情况下禁用）由 Claude 的规格给出，本任务只做胶水；接口先按下面固定，规格到了只填 `banPolicy`。

**读**：
- `src/procgen/graph/voxelGrid3d.js`（**图适配器接口范本**：`cells()/cellId(i)/indexOfId(id)/neighborsOf(i)→[{to,direction}]/validate()`，方向 token N/E/S/W/U/D）
- `src/procgen/wfc/solver.js:solveWfc({graph, compiled, table, seed, pins, bans, maxBacktrack})` → 成功 `{ok:true, assignment:Int32Array, assignmentByCellId:{id:variantKey}, solutionHash, stats}`；失败 `{ok:false, reason, cell, conflict:{emptyCell, banChain, involvedCells}, suggestedRelaxations, …}`
- `src/procgen/wfc/socketCompiler.js` / `compatibilityTable.js`（编译）
- `src/world/citadelTown.js:1380–1406`（`grid` 是 `Map "ix,iy,iz"->char`；`openMaskFor` 位序 = `DIRS` 顺序）

**写**：
- `src/world/citadel/wfcGraphAdapter.js`：`createCitadelCellGraph(grid)`
- `src/world/citadel/wfcTownSelection.js`：`solveTownSelection({grid, prototypes, seed, pins, banPolicy})`

**伪代码**：
```js
// wfcGraphAdapter.js —— 只有非空格是节点；邻空方向没有边（由 bans 约束暴露面）
const DELTA = { N:[0,0,-1], E:[1,0,0], S:[0,0,1], W:[-1,0,0], U:[0,1,0], D:[0,-1,0] };
const OPP = { N:"S", S:"N", E:"W", W:"E", U:"D", D:"U" };
export function createCitadelCellGraph(grid) {
  const ids = [...grid.keys()].map(k => k.split(",").map(Number))
    .sort((a,b) => a[1]-b[1] || a[2]-b[2] || a[0]-b[0])          // 稳定序：iy, iz, ix
    .map(([ix,iy,iz]) => `${ix},${iy},${iz}`);
  const index = new Map(ids.map((id,i) => [id,i]));
  const adjacency = ids.map(id => {
    const [ix,iy,iz] = id.split(",").map(Number); const list = [];
    for (const dir of ["N","E","S","W","U","D"]) { const [dx,dy,dz] = DELTA[dir];
      const j = index.get(`${ix+dx},${iy+dy},${iz+dz}`); if (j !== undefined) list.push({ to:j, direction:dir }); }
    return list;
  });
  return { kind:"citadel-cell-graph", get cellCount(){return ids.length;},
    cells:() => ids.map((id,index) => ({id,index})), cellId:i => ids[i], indexOfId:id => index.get(id) ?? -1,
    neighborsOf:i => adjacency[i] || [],
    exposure(i) { /* 返回 {N:bool,E,S,W,U,D}：该向无邻居 = true */ },
    validate() { /* 逐字照 voxelGrid3d.validate：每条边有反向边且方向为 OPP */ } };
}

// wfcTownSelection.js
export function solveTownSelection({ grid, prototypes, seed, pins = [], banPolicy = defaultBanPolicy, maxBacktrack = 64 }) {
  const graph = createCitadelCellGraph(grid);
  const compiled = compileVariants(prototypes);
  const table = compileCompatibilityTable(compiled, { onDeadVariant: "throw" });
  const bans = [];
  for (const { id, index } of graph.cells())
    for (const v of compiled.variants)
      if (!banPolicy({ cellId:id, char:grid.get(id), exposure:graph.exposure(index), variant:v })) bans.push({ cell:index, variant:v.index, reason:"policy" });
  const r = solveWfc({ graph, compiled, table, seed, pins, bans, maxBacktrack });
  const byCell = {};
  if (r.ok) for (const [id, key] of Object.entries(r.assignmentByCellId)) {
    const v = compiled.variants[compiled.variantIndex.get(key)];
    byCell[id] = { family: protoFamilyOf(v.protoId, prototypes), variant: v.builderKey, rot: v.transformName, key };
  }
  return { ok:r.ok, byCell, hash:r.solutionHash, stats:r.stats, failure: r.ok ? null : r,
           unresolved: r.ok ? [] : [graph.cellId(r.cell)] };            // S20④ 静默失败：只标格，不塞默认
}
// defaultBanPolicy（规格到之前的占位，必须可被替换）：
//   暴露面（exposure[dir]===true）上 connector==="wall.interior" 的 variant 禁用；
//   非暴露面上 connector==="air" 的 variant 禁用；D 面无邻居且 variant.rules.requiresBelow 存在 → 禁用。
```

**验收**：`node tools/test_wfc_selection_golden.mjs`（G-06）。
**禁止**：不改 `procgen/wfc/*`；不在 `citadelTown.js` 里接线（那是 Claude 的项）；失败时不回退到 `townscaperModuleSelection` 填格。

---

## G-06 · `tools/test_wfc_selection_golden.mjs` [等 G-05]（TODOS C6）

**目标**：证明适配器**能回放哈希路径**（pins 全钉 = 逐格相等）并且在无约束时**确定性**（同 seed 同 hash，100 seed 零失败）。注意：不钉 pins 时 WFC 的随机选择**本来就不会**等于哈希路径，别把这当失败。

**伪代码**：
```js
const grid = levelsToGrid(HIGHLAND 布局);   // 942 格
const protos = anyPrototypesFrom(TOWNSCAPER_MODULE_FAMILIES); // 每个 family.variant 一个原型，六面 connector 全 "any"，weight 1，orientationGroup "NONE"
// (a) 回放：pins = 哈希路径的选择（family 取 "floor"）
const pins = [...grid].map(([id,char]) => { const [ix,iy,iz]=id.split(",").map(Number);
  const h = townscaperModuleSelection(ix,iy,iz,char,0,openMask(ix,iy,iz));
  return { cell:id, variant:`floor.${TOWNSCAPER_MODULE_FAMILIES.floor[h.floor]}@r0` }; });
const r = solveTownSelection({ grid, prototypes:protos, seed:1, pins });
assert.ok(r.ok); for (const [id] of grid) assert.equal(r.byCell[id].key, pinKeyOf(id));   // 逐格相等
// (b) 确定性 + 零失败
const h1 = solveTownSelection({grid, prototypes:protos, seed:7}).hash, h2 = 同 seed 再跑一次;
assert.equal(h1, h2);
let fails = 0; for (let s = 1; s <= 100; s++) if (!solveTownSelection({grid, prototypes:protos, seed:s}).ok) fails++;
assert.equal(fails, 0);
console.log(`replay=942/942 determinism=${h1} fails=0/100`);
```

**验收**：退出 0，打印上面一行。

---

## G-07 · `tools/test_wfc_determinism.mjs`（门 F）[等 G-05 + C5 词汇表]

**伪代码**：
```js
// 1. 同 seed 同布局 → 同 hash（真词汇表，非 "any"）
// 2. 编辑一格（setCell/clearCell 来自 citadelTown.js），全量重解两次，比较：
//    - 编辑格 2-ring（曼哈顿 ≤2，含上下 ±2 层）以外的格：byCell[id].key 必须逐格相同
//    - 2-ring 以内允许不同；打印实际变化格数与最远曼哈顿距离
// 3. 100 seed：ok 率、stats.backtracks 分布（P50/P95）、耗时 P50
assert.equal(outsideChanged.length, 0, `传播锥外变化: ${outsideChanged.slice(0,10)}`);
```
**验收**：退出 0；打印 `hash=… ripple=<n>cells maxManhattan=<d> ok=100/100 backtracksP95=…`。
**注意**：如果真词汇表下传播锥外确实会变（例如屋顶跨整个连通分量，S20⑦），**把实际最远距离贴回 TODOS**，不要把断言改成锥外可变——那是 Claude 决定的事。

---

## G-08 · `explainFailure` → `devPanel` 只读列表（门 G）[等 G-05]

**读**：`src/core/devPanel.js`（现有面板的 section 添加方式）、`src/procgen/wfc/conflictExplain.js`（失败结构：`reason / cell / conflict.emptyCell / conflict.involvedCells / suggestedRelaxations`）。

**写**：`src/ui/wfcFailurePanel.js`（纯 DOM，只读）+ `tools/test_wfc_explain.mjs`。

**伪代码**：
```js
export function renderWfcFailure(container, failure) {  // failure = solveTownSelection().failure
  if (!failure) { container.textContent = "WFC: ok"; return; }
  rows = [ `reason: ${failure.reason}`, `empty cell: ${failure.conflict?.emptyCell}`,
           `involved: ${failure.conflict?.involvedCells?.join(" ")}`,
           ...(failure.suggestedRelaxations ?? []).map(s => `relax: ${JSON.stringify(s)}`) ];
  container.replaceChildren(...rows.map(t => Object.assign(document.createElement("div"), { textContent: t })));
}
// test：人为构造必失败的原型集（两个 connector 永不相容 + pins 钉死相邻两格）→ failure 非空 → renderWfcFailure 后 container 至少 3 行且包含 "empty cell"
```
**禁止**：不在面板里加「重试/重启」按钮（禁 while-restart）。

---

## G-09 · 门 H 下半：传播可见性统计 [等 C5 词汇表 + G-05]

**目标**：证明约束会**收缩邻居的域**——钉一格后，只做初始传播，统计其它格有多少被坍缩到 1。

**读**：`src/procgen/wfc/partialObservation.js`（`partialObservation({model:{graph,compiled,table}, pins, bans})` → `{cells:[{id, domainSize, collapsed, entropy, candidates}], …}`）

**写**：`tools/test_wfc_propagation_visible.mjs`

**伪代码**：
```js
for (let s = 1; s <= 100; s++) {
  const target = 稳定随机选一格（createStableRng(s,"pick")）;
  const pinVariant = 该格域内第一个 variant;
  const before = partialObservation({ model, bans });            // 只有 policy bans
  const after  = partialObservation({ model, bans, pins:[{cell:target, variant:pinVariant}] });
  const collapsedByPin = after.cells.filter((c,i) => c.collapsed && !before.cells[i].collapsed && c.id !== target).length;
  const shrunk = after.cells.filter((c,i) => c.domainSize < before.cells[i].domainSize && c.id !== target).length;
  record(s, collapsedByPin, shrunk);
}
assert.ok(seedsWithCollapse >= 1, "100 seed 里没有任何一次传播把邻居坍缩到 1（门 H 下半）");
console.log(`seedsWithCollapse=${…}/100 avgShrunk=${…}`);
```

---

## G-10 · 增量重解（C7）[等 G-05 + C4 已绿]

**目标**：编辑一格时不整城重解：编辑格 + 2-ring 域重置为全集，其余格用上次解 `pins` 钉死，从编辑格传播。

**写**：`src/world/citadel/wfcIncremental.js`：`resolveIncremental({ grid, prototypes, seed, previous /* byCell */, dirtyKeys, ring = 2 })`

**伪代码**：
```js
const region = new Set(); for (const k of dirtyKeys) for (const n of manhattanNeighbors(k, ring, 包含 ±ring 层)) if (grid.has(n)) region.add(n);
const pins = []; for (const [id] of grid) if (!region.has(id) && previous[id]) pins.push({ cell:id, variant: previous[id].key, source:"previous" });
const r = solveTownSelection({ grid, prototypes, seed, pins, banPolicy });
// r.ok=false 且 failure.conflict.involvedCells 全在 region 外 → 说明 ring 太小：把 ring+1 再试一次（最多 2 次），仍失败则返回 failure（不整城重解，不静默）
return { ...r, region:[...region], ringUsed };
```
**验收**：`tools/test_wfc_incremental.mjs`：① region 外 `byCell[id].key === previous[id].key` 逐格；② 20 次连续编辑后与全量重解 `hash` 比较，打印相同/不同格数（不断言相等——WFC 增量与全量本来可以不同，Claude 看数字）；③ 耗时 P50 打印。

---

## G-11 · `decoratePass.js`（C8）[等规格：C8 装饰边界清单]

**目标**：把装饰从 `buildCitadelTown` 家族循环里拆成独立 pass。**规格到之前不要动 `citadelTown.js`**。

**读**：`src/world/citadelTown.js` 里 `ownCell/ownSpanning/ownNone/stampOwner`（1411–1427）——装饰 pass 必须沿用同一套归属声明；Claude 清单会列出哪些 `town-*` 名字属于装饰。

**写**：`src/world/citadel/decoratePass.js`：`decorateTown({ grid, selection /* byCell */, levelGroups, ctx, want, own })`；`tools/test_decor_pass.mjs`

**伪代码**：
```js
// citadelTown.js 里：把清单点名的分支（例如 town-window-sill / town-balcony-flowerbox / town-clothesline / town-bird / town-lantern …）
// 剪切到 decorateTown；调用点变成：
//   const bodyStats = buildBody(...);  // 体块
//   if (!ctx.skipDecor) decorateTown({...});  // 装饰
// decorateTown 内每个规则块开头 own.cell(ix,iy,iz,char) 或 own.spanning(keys)，结尾 own.none()
// test：① skipDecor=true 与 false 两次构建，体块网格（名字不在装饰清单内）的三角形数与名字多重集逐字相等；
//       ② skipDecor=false 时无主几何仍 === 0（复用 test_cell_ownership 的判据）；
//       ③ 装饰网格的 userData.cell 必须等于它所贴的格（窗台 → 那扇窗的格）
```

---

## G-12 · `tools/gen_corner_mask_table.mjs` [可立即派发]（TODOS C9）

**目标**：枚举角柱的 8-bit 邻域 mask，按 D4（绕 Y 四旋转 × 镜像）归并成基础类，输出映射表。**不做几何**。

**位序（固定，别改）**：角柱位于 4 个格的公共角、两层之间。周围 8 格 = (dx,dz) ∈ {0,1}² × dy ∈ {0,1}；`bit = dx | (dz << 1) | (dy << 2)`；dy=0 是下层，dy=1 是上层。

**写**：`tools/gen_corner_mask_table.mjs` → `tools/out/corner_mask_table.json`

**伪代码**：
```js
const idx = (dx,dz,dy) => dx | (dz<<1) | (dy<<2);
function transform(mask, k /*旋转次数 0..3*/, m /*镜像 0/1*/) {
  let out = 0;
  for (let dy=0; dy<2; dy++) for (let dz=0; dz<2; dz++) for (let dx=0; dx<2; dx++) {
    if (!((mask >> idx(dx,dz,dy)) & 1)) continue;
    let x=dx, z=dz; for (let i=0;i<k;i++) [x,z] = [1-z, x];   // 绕 Y 旋转 90°
    if (m) x = 1-x;                                             // 镜像
    out |= 1 << idx(x,z,dy);                                    // dy 不变：重力破坏上下对称
  }
  return out;
}
const OPS = [];  for (let k=0;k<4;k++) for (const m of [0,1]) OPS.push([k,m]);
const table = [];  // 256 行：{ mask, canonical, k, m, classId }
const classes = new Map();
for (let mask=0; mask<256; mask++) {
  let best = { c:Infinity }; for (const [k,m] of OPS) { const c = transform(mask,k,m); if (c < best.c) best = { c,k,m }; }
  if (!classes.has(best.c)) classes.set(best.c, classes.size);
  table.push({ mask, canonical: best.c, k: best.k, m: best.m, classId: classes.get(best.c),
               lowerCount: popcount(mask & 0xF), upperCount: popcount(mask >> 4) });
}
// 自检 + 落盘
assert.equal(classes.size, 55);            // D4 轨道数：55（含全空 0 与全满 255）——这是数学事实，不是可调参数
assert.equal(table.length, 256);
for (const row of table) assert.equal(transform(row.mask, row.k, row.m), row.canonical); // 每行可回放
writeJson("tools/out/corner_mask_table.json", { bitOrder:"dx|dz<<1|dy<<2", symmetry:"D4-about-Y", classCount:55, classes:[...classes.keys()], table });
console.log(`classes=55 (Y4-only would be 70)`);
```

**验收**：退出 0；JSON 里 `classCount === 55`。
**禁止**：不把上下翻转加进对称群（会把「有屋顶的地基」和「有地基的屋顶」并成一类）。

---

## G-13 · `cornerGraphAdapter.js` [等规格：C9 角落分段目录]（TODOS C9）

**目标**：以角柱为节点的图（节点 = 格顶点 (gx,gz) × 层 iy），喂 V7。边 = 两角柱共享一条格边（水平 4 向）或同一 (gx,gz) 相邻层（U/D）。mask → bans 用 G-12 的表 + Claude 目录里每个原型的 `allowedClasses`。

**伪代码**：
```js
export function createCornerGraph(grid, { cols, rows, floors }) {
  // 节点：只保留至少有一个相邻格非空的角柱（否则全是空气，域退化）
  ids = []; for (iy in 0..floors) for (gz in 0..rows) for (gx in 0..cols) { mask = maskAt(grid,gx,gz,iy); if (mask) ids.push(`c:${gx}:${gz}:${iy}`, mask) }
  // 邻接：水平 (gx±1,gz) / (gx,gz±1) 同层；竖向 (gx,gz,iy±1)
  // 方向 token 仍用 N/E/S/W/U/D（角柱图是规则网格，halfEdgeGraph 留给阶段 5）
  return { cells, cellId, indexOfId, neighborsOf, maskOf(index), validate };
}
export function cornerBans(graph, compiled, maskTable, allowedClassesOf /* variant -> Set<classId> */) {
  bans = []; for (const {index} of graph.cells()) { const cls = maskTable.table[graph.maskOf(index)].classId;
    for (const v of compiled.variants) if (!allowedClassesOf(v).has(cls)) bans.push({ cell:index, variant:v.index, reason:`mask-class-${cls}` }); }
  return bans;
}
```
**验收**：`tools/test_corner_graph.mjs`：`validate().ok`；高山布局角柱节点数打印；每个节点 bans 后域非空（否则打印该 mask 的 classId 清单——那是目录缺件，报回 Claude）。

---

## G-14 · `tools/test_corner_seams.mjs`（门 J）[等 G-13 + Claude 目录含几何]

**伪代码**：
```js
// 对每对相邻角柱 (a,b)，取两者几何在共享格边上的顶点（|x - edgeX| < 1e-6 或 |z - edgeZ| < 1e-6，同层）
// 断言：a 的边界顶点集合 == b 的边界顶点集合（按 (x,y,z) 四舍五入到 1e-5 比较），逐位相等
// 另：S19 t=1.05 复现——两个相邻地面格的基座（plinth）合并后，沿共享边不存在「一侧有顶点另一侧没有」的 T 型接缝
```

---

## G-15 · `src/procgen/graph/irregularQuadGrid.js` [可立即派发]（TODOS C10）

**目标**：Oskar 的不规则四边形网格（S20⑤）：六边形三角格 → 三角随机配对成四边形 → 每面一分四 → relaxation。纯数据，输出能直接喂 `createHalfEdgeGraph({faces, positions})`。

**读**：`src/procgen/graph/halfEdgeGraph.js`（输入格式：`faces = [[vid,vid,vid,vid], …]` 顶点稳定 ID、绕序一致；`positions`）；`src/procgen/core/stableRng.js`。

**写**：`src/procgen/graph/irregularQuadGrid.js`：`createIrregularQuadGrid({ seed, radius, relaxIterations = 50, relaxStep = 0.2, locked = new Set() })`

**伪代码**：
```js
// ⚠️ 顺序按 S22（BorisTheBrave/Sylves 教程实测）：**先把整片网格拼满，最后统一 relax**。
//    逐块松弛会破坏块边界的精确贴合（原文：relaxation would get in the way）。
// 1. 三角格：六边形范围内的等边三角形格点（radius = 环数）；顶点 id "v:<n>" 按生成序；三角形列表 tris
// 2. 随机配对：把所有内部边（被两个三角形共享）用 rng 稳定洗牌；顺序遍历，若两侧三角形都未合并 → 合并成四边形（去掉公共边），标记已用
//    剩下未配对的三角形保留
// 3. 一分四细分：每条边插中点、每面插重心；四边形 → 4 个四边形，三角形 → 3 个四边形。此后**全部是四边形**
//    新顶点 id 继续按 "v:<n>" 递增；面 id "f:<n>"；面顶点绕序统一 CCW（用有向面积符号纠正）
// 4. relaxation（Oskar 式「让每个四边形朝正方形收敛」）：
//    for it in 1..relaxIterations:
//      force = zeros(vertexCount)
//      for each quad [p0,p1,p2,p3]:
//        c = (p0+p1+p2+p3)/4
//        // 把四个角对齐到同一朝向后取平均，得到「理想正方形」的一个角向量
//        v = ( (p0-c) + rot90(p1-c) + rot180(p2-c) + rot270(p3-c) ) / 4
//        target_i = c + rot(-90*i)(v)        // i = 0..3
//        force[p_i] += target_i - p_i
//      for each vertex not in locked and not on boundary: pos += force[v] / valence[v] * relaxStep
// 5. 输出 { faces, positions, vertexIds, faceIds, boundaryVertexIds, hash: hashHex(positions 四舍五入 1e-6 + faces) }
```

**验收**：G-16。
**禁止**：不 import Three.js；不用 `Math.random`；边界顶点与 `locked` 集合**位置逐位不变**。

---

## G-16 · `tools/test_irregular_quad_grid.mjs`（门 K 上半）[等 G-15]

**伪代码**：
```js
const g = createIrregularQuadGrid({ seed:7, radius:6 });
// ① 全四边形
for (const f of g.faces) assert.equal(f.length, 4);
// ② 无自交 / 凸：每个四边形四个有向面积（相邻边叉积）同号且 > 0（CCW）
// ③ 最小内角：打印分布（min / P05 / P50）；断言 min ≥ 45°——**若 100 seed 里达不到，把实际 min 贴回 TODOS，不要改 45**
// ④ 边长比：每面 max(edge)/min(edge) ≤ 2（同上处理）
// ⑤ 确定性：同 seed 两次 hash 相等；不同 seed hash 不等
// ⑥ 能进 halfEdgeGraph：createHalfEdgeGraph({faces:g.faces, positions:g.positions}) 不抛错，且无 non-manifold
// 100 seed 统计：faces 数、min angle、max edge ratio 的 P50/P95，打印一行
```

---

## G-17 · `tools/test_grid_migration.mjs`（门 K 下半）[等规格：C10 Claude 迁移函数]

**伪代码**：
```js
// Claude 交付 migrateAsciiToFaces(levels, grid) → { byFace: Map faceId->char, unmapped:[] } 与 facesToAscii(byFace, grid) → levels
const levels = HIGHLAND 布局; const g = createIrregularQuadGrid({seed:HIGHLAND_GRID_SEED, radius:…});
const m = migrateAsciiToFaces(levels, g); assert.equal(m.unmapped.length, 0);           // 942 格零丢失
const back = facesToAscii(m.byFace, g); assert.deepEqual(countChars(back), countChars(levels)); // 字符多重集守恒
// 每个非空 ASCII 格映射到的 face 重心与该格中心距离 ≤ 0.75 格宽（打印 max）
```

---

## G-18 · 下游最小适配（C10）[等规格：Claude 清单]

Claude 会给一张「文件:函数 → 现在按 (ix,iz) 取中心，改为按 faceId 取重心」的清单（预计：`citadelTacticalGraph.js`、`collision.js`、`citadelBlueprint.js`）。只做清单上的替换；每处替换后跑 `node tools/test_citadel_tactical_graph.mjs` 与 `node tools/test_citadel_topology.mjs`，把两个脚本的关键数字（节点数 / 离表误差）贴回。**不重写寻路算法**。

---

## G-19 · `tools/test_window_stencil_positions.mjs`（门 L 部分）[等规格：C11 Claude 原型]

**伪代码**：
```js
// 对每个名为 town-window（或 Claude 原型里的新名字）的网格：世界 AABB 投影到 XZ，
// 断言它完整落在某一个格内（AABB 的四角 floor((x - origin)/cs) 相同、floor((z - origin)/cs) 相同）
// 打印跨格窗数；断言 === 0
```

---

## 派发顺序建议

今天就能派：**G-01、G-02、G-04、G-12、G-15+G-16**（五张单互不依赖，可并行）。
其余按 TODOS 里 [Claude] 前置项交付顺序解锁：C5 词汇表 → G-03/G-05/G-06/G-07/G-09 → G-08/G-10 → C8 清单 → G-11 → C9 目录 → G-13/G-14 → C10 迁移 → G-17/G-18 → C11 原型 → G-19。

---

## G-01b · 作用域外 `add` 改为 `throw`（与 G-01 同批）[可立即派发]（TODOS C3）

**读**：`src/world/citadelTown.js:1411–1437`（`_ownerCell` / `stampOwner` / 层组 `group.add` 拦截）与 `:3061` 附近的 `restoreAdd`。

**改**（≤ 10 行）：
```js
const stampOwner = (object, iy) => {
  if (!_ownerCell) throw new Error(`town level ${iy}: add() outside ownCell/ownSpanning scope: ${object.name || object.type}`);
  …原逻辑不变…
};
```
**步骤**：① 先不改，只把 `return` 换成 `console.warn` 跑一遍 `node tools/test_cell_ownership.mjs`、`node tools/test_castle_building_experience.mjs`、`node tools/test_odyssey_citadel.mjs`，收集所有作用域外 add 的 `object.name` 清单；② 清单为空 → 改成 `throw`，并在 `test_cell_ownership.mjs` 加用例：在 `ownNone()` 之后向层组 `add` 一个空 Group 必须抛错；③ 清单非空 → **不改 throw**，把清单贴回 TODOS C3 那一行，等 Claude 判定哪些该补 `ownCell`。
**禁止**：不加 `allowUnowned` 之类的绕过开关。
