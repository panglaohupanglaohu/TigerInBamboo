# 城堡建造管线 · Grok 任务包

> 配 `docs/CITADEL_BUILD_PIPELINE_TODOS.md` 使用。TODOS 里每个 **[Grok]** 项都指向这里的一个 **G-xx**。
> 每个 G-xx 都是**可以直接整段复制给 Grok 的工单**：读什么、写什么、伪代码、验收命令、禁止事项。
> Grok 不读 PLAN，也不需要读；它只需要本文件 + 工单里点名的源文件。
>
> 通用约定（每张工单默认继承）：
> - 仓库根 = `TigerInBamboo/`；所有 `tools/*.mjs` 用 `node tools/xxx.mjs` 从仓库根运行，非零退出 = 失败。
> - 需要 Three.js 的 headless 脚本，**逐字复制** `tools/test_cell_ownership.mjs` 第 **14–31** 行的 preamble（three 桥接包 + window/document/localStorage 桩），不要自己发明。（2026-09-04 核对：`globalThis.localStorage` 在第 31 行，早前工单写的 14–30 会漏掉它，脚本一跑就炸。）
> - 纯数据模块（`src/procgen/**`、`src/world/citadel/*Adapter.js`、`*Prototypes.js`）**禁止 import Three.js / DOM**。
> - 不改任何 `FEATURES` / `P.*` 开关默认值；不改任何已有测试的 expected；不动 `odysseyCitadel.js`、`loadCitadel.js`。
> - 确定性：所有随机来自 `createStableRng(seed, streamName)`（`src/procgen/core/stableRng.js`）或 `hashHex`（`src/core/rng.js`），禁止 `Math.random`。
> - 交付物 = 代码 + 脚本 + 一段 ≤10 行的「命令 / 输出数字」文本，贴回 TODOS 对应行。
>
> 状态标记：**[可立即派发]** = 不依赖 Claude 的前置规格；**[等规格]** = 要等 TODOS 里对应 [Claude] 项先交付。
>
> **派单前先看每张单标题下面那行「状态」**（2026-09-04 补）。已交付 / 已作废 / 换了载体的单不要再派——
> 本文件曾经有 5 张单指向压根没被创建的文件（内容并进了别的脚本），照单派会白做一遍。
>
> 四条硬规矩（都是 2026-09-04 用红测试换来的，违反一条整批返工）：
> 1. **禁止用占位输入自证**。「六面 socket 全 any」「规则全 true」这类占位原型下测出来的
>    `fails=0` / `outsideChanged=0` **毫无意义**——压根没有约束在传播。必须用真原型
>    （`townModulePrototypes.js`）重测（G-06 / G-10 踩过）。
> 2. **改守门 / 判据类代码，先用非致命方式跑一遍全量**：把 `throw` 换成 `console.warn`，
>    收集完整清单贴出来，清单为空才改致命（G-01b 踩过：判据写反 → 全部城堡测试红）。
> 3. **测性能前先确认没有第二个人同时在改 `citadelTown.js`**。同一份代码路径实测过
>    P50 115.8ms 与 155.8ms 两个数——差别是机器争用不是回归。另：`test_edit_soak` /
>    `test_castle_building_experience` **每个新 shell 的第一次运行**慢 30~40ms（JIT 冷路径），
>    连着跑两次，两次都红才是真红。
> 4. **发现断言不过时，先分清「测试写错」还是「真 bug」**。G-01 的 onlyB=65 被判成前者，
>    实际是内院 `ownSpanning` 只登记了空格这个真 bug。判不了就把清单交回，不要在测试里过滤差集。

## 开工前 5 分钟：先跑这一串确认基线

**任何一张单动手之前先跑完这 17 条**，把结果贴在你的第一条回复里。
不是形式主义：这个仓库有 3 个脚本**本来就是红的**（见下），不先确认基线就分不清是你弄红的还是本来红的。

```bash
# 你要改的那块的地基（按你的单挑对应那几条跑，全跑也只要两分钟）
node tools/test_corner_prototypes.mjs        # G-13 / G-14 的地基
node tools/probe_grid_migration.mjs          # G-17 的地基
node tools/probe_stencil_windows.mjs         # G-19 的地基
node tools/report_wfc_100seed.mjs            # C6 体检数字
node tools/probe_span_cost.mjs               # G-20 的成本探针
# 全局不倒退门（每张单都要跑）
node tools/test_cell_ownership.mjs
node tools/test_face_to_cell_parity.mjs
node tools/test_edit_exactness.mjs
node tools/test_edit_soak.mjs
node tools/test_castle_building_experience.mjs
node tools/test_wfc_town_selection.mjs
node tools/test_wfc_incremental.mjs
node tools/test_irregular_quad_grid.mjs
node tools/gen_corner_mask_table.mjs
node tools/extract_adjacency_stats.mjs
node tools/test_citadel_tactical_graph.mjs
node tools/test_citadel_topology.mjs         # ⚠️ 这条**本来就红**，见下
```

**2026-09-04 晚实测：上面 17 条里 16 条绿，只有 `test_citadel_topology` 红**
（「G0 蓝图 hash 不得因 G1 派生 API 漂移」）。它在本轮工作开始前就红了，
`citadelBlueprint.js` 是别人改的。**不要顺手改它的 expected 去转绿**，
也不要因为它红就不敢提交——它跟你的单没关系，除非你的单是 G-18（那张单的 §3 专门讲了怎么处理）。

另外两个已知红项（不在上面的清单里，跑到了别当成自己弄的）：
`test_townscaper_support`（支柱构造被外部改成单斜柱，测试还在断言旧的四环柱设计）、
`test_planet_v9_runtime_wiring`（`messengerIsland.js` 被外部改过）。
`test_procgen_profiles_hard_routes` 的 expected 里 highland 一项写的是字符串 `"PLACEHOLDER"`，**从来没绿过**。


---

## G-01 · `tools/test_face_to_cell_parity.mjs` [✅ 已交付]（TODOS C4）

**状态：✅ 已交付并复核（2026-09-04）** — `A=853 B=853 onlyA=0 onlyB=0`。注意：Grok 交付时报的 `onlyB=65` **不是测试写错，是真 bug**（内院 `ownSpanning` 只登记了 `region.cells`，那全是空格，而编辑只发生在实心格上 → 拆围墙时这段内院永远不判 dirty）。已由 Claude 修：格集补上四邻的实心围墙格。

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

## G-02 · `docs/OSKAR_OFFICIAL_PLAN.md` 来源表补行 [✅ 已交付]（TODOS C0）

**状态：✅ 已交付（2026-09-04）** — `grep -c "S21"` = 2、`grep -c "hexagonal grid"` = 1，§2–§6 未改。

**目标**：纯文档抄录。来源表加 **S21** 一行；S20 一行的「原文」栏补上 ⑤–⑧ 四句。

**读**：`TigerMessenger/docs/CITADEL_BUILD_PIPELINE_PLAN.md` §2.1 的表（①–⑧ 逐字）与 S21 段落。

**写**：只改 `docs/OSKAR_OFFICIAL_PLAN.md` §1 表格两行。S21 行格式照 S20 行。

**验收**：`grep -c "S21" docs/OSKAR_OFFICIAL_PLAN.md` ≥ 2；`grep -c "hexagonal grid" docs/OSKAR_OFFICIAL_PLAN.md` ≥ 1。
**禁止**：不改 §2–§6 任何结论；不新增「项目推导」。

---

## G-03 · `tools/test_module_prototypes.mjs` [⚠️ 已交付·换载体]（TODOS C5）

**状态：⚠️ 已交付，但换了载体（2026-09-04）** — **没有 `tools/test_module_prototypes.mjs` 这个文件**，内容并进了 `tools/test_wfc_town_selection.mjs` 的 G-03 段（相容率 **18.7%**，水平 24.9% / 竖向 6.2%，dead variant 0，另加反向下限 ≥2%）。**不要再按本单新建文件。**

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

## G-04 · `tools/extract_adjacency_stats.mjs` [✅ 已交付]（TODOS C5）

**状态：✅ 已交付（2026-09-04）** — `totalCells=1213 highland=978 canal=235 countKeys=2980` → `tools/out/adjacency_stats.json`。

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

## G-05 · `wfcGraphAdapter.js` + `wfcTownSelection.js` [⚠️ 已交付·被重写]（TODOS C6）

**状态：⚠️ 已交付，但被 Claude 重写（2026-09-04）** — Grok 版六向都建边、exposure 是布尔、banPolicy 是占位，与本单「适配器契约」段不符。现行版本：**异色相邻不建水平边**（不同建筑不合并屋顶）、exposure 四态（`edge/edge-top/air/foreign`）、含 `columnHeight` / `columnIsolated`，且**塔按柱判定不按格**（按格判会让锥顶找不到支撑，实测 `19,2,10` empty-domain）。改这两个文件前先读现行实现。

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

## G-06 · `tools/test_wfc_selection_golden.mjs` [⚠️ 已交付·被重写]（TODOS C6）

**状态：⚠️ 已交付，但被 Claude 重写（2026-09-04）** — Grok 版用「六面 connector 全 any」的占位原型自证，`fails=0` 无意义。现行脚本冻的是三条：解可回放（pins 全钉逐格相等）、同 seed 同 hash、真实布局 100 seed 零失败。实测 `replay=978/978 determinism=5f185a4f fails=0/100`。

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

## G-07 · `tools/test_wfc_determinism.mjs`（门 F）[❌ 作废]

**状态：❌ 作废（2026-09-04）** — **没有 `tools/test_wfc_determinism.mjs`**。门 F 已由 `tools/test_wfc_selection_golden.mjs` + `tools/test_wfc_incremental.mjs` 覆盖（`outsideChanged=0 / ring=2 / P50 21.9ms`）。不要派。

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

## G-08 · `explainFailure` → `devPanel` 只读列表（门 G）[✅ 已交付]

**状态：✅ 已交付（2026-09-04）** — `node tools/test_wfc_explain.mjs`：不相容 pins → `reason: unsatisfiable` / `empty cell: 1,0,0` / involved 两格；`src/ui/wfcFailurePanel.js` 已 `mountWfcFailureSection` 进 `createDevPanel`，只读、无重试按钮。

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

## G-09 · 门 H 下半：传播可见性统计 [❌ 作废]

**状态：❌ 作废（2026-09-04）** — **没有 `tools/test_wfc_propagation_visible.mjs`**。门 H 下半并进 `tools/test_wfc_town_selection.mjs` 的 G-09 段（钉一格触发 8 个格域收缩、累计 20 次；旧哈希路径此数恒为 0）。不要派。

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

## G-10 · 增量重解（C7）[⚠️ 已交付·测试重测]

**状态：⚠️ 已交付，测试被 Claude 换真原型重测（2026-09-04）** — `outsideChanged=0 ring=2 soakSame=66 soakDiff=892 fullHash=4edc1143 P50=24.5ms`。原交付用的占位原型下这些数字不成立，见头部硬规矩第 1 条。

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

## G-11 · `decoratePass.js` + `tools/test_decor_pass.mjs`（C8）[✅ 已交付]

**状态：✅ 已交付（2026-09-05）** — `bodyNames=3142 decor=3193 skipDecorDecor=0 unowned=0 catalog=24`。
门 A 无主 0；edit exactness 0/0；soak 累积偏差 0.4%（第二次 P50 91.3ms）。
`skipDecor` 在层组 add 处剥装饰（混装组只剥孩子）；`decorateTown` 挂钩已就位。
发射点仍在家族循环：装饰与体块共用 `ctx.random`，整段搬迁会搅动体块。
报回：清单 `town-gable-oculus` 现网是 `town-gable-diamond`。

**状态（工单原文，2026-09-04）**：前置已解锁（`docs/CITADEL_DECOR_BOUNDARY.md` 2026-09-03 已交付），但本单 2026-09-04 前一直不完整（无验收命令、无禁止事项、没点名要剪哪些分支）。以下是重写后的完整版。

**目标**（S20③ *the decoration of a tile is separate from when it is generated*）：把「装饰」从 `buildCitadelTown` 的家族循环里拆成一个独立 pass，使得关掉装饰后**体块几何逐字不变**。这是 C8 滞后合并（体块先合并、装饰下一帧合并）的前置。

**读**（四份，缺一不可）：
- `docs/CITADEL_DECOR_BOUNDARY.md` —— 66 个 `town-*` 逐条分类。**这份清单是唯一权威**，不要自己判断某个网格算不算装饰。特别注意三条反直觉的：**窗洞/门洞算体块**（改变墙的拓扑）、**支架算体块**（构造式，PLAN §4 N3 不进域）、**栏杆算装饰**（按 exposure 生成）。
- `src/world/citadelTown.js:1489–1530` —— `ownCell / ownSpanning / ownNone / stampOwner` 与层组 `add` 拦截。装饰 pass **必须沿用同一套归属声明**，不能自己发明。
- `src/world/citadelTown.js` 里 `want(ix,iy,iz)` 与 `_spanWant` 的用法 —— 增量模式下每个发射点都要过门。
- `tools/test_cell_ownership.mjs` —— headless preamble（逐字复制第 14–30 行）+ 无主判据的逐字写法。

**写**：
1. `src/world/citadel/decoratePass.js`
   ```js
   export function decorateTown({ grid, at, want, own, levelGroups, ctx, materials, mesh, stats, cs, ch, cx, cy, cz, selection })
   ```
   - `own` = `{ cell, spanning, none }`，直接把 `citadelTown.js` 里的三个闭包传进来（**不要在本文件里重新实现归属**）。
   - 每个规则块开头 `own.cell(ix,iy,iz,char)` 或 `own.spanning(keys)`，结尾 `own.none()`。
   - 纯装饰逻辑，**不读也不写体块的判定中间量**（`roofCells` / `gardenCells` / `columnHeight` 这些如果需要，由调用方作为入参传入只读副本）。
2. `citadelTown.js` 调用点：
   ```js
   const bodyStats = /* 体块家族循环，原样保留 */;
   if (ctx.skipDecor !== true) decorateTown({ ... });
   ```
3. `tools/test_decor_pass.mjs`

**伪代码（测试三条）**：
```js
const DECOR_NAMES = new Set(/* 从 docs/CITADEL_DECOR_BOUNDARY.md 里「装饰」那一栏读出的 town-* 名字 */);
// ① 体块逐字相等：skipDecor 两次构建，名字**不在**装饰清单里的网格，其
//    「名字多重集 + 每个名字的三角形总数 + 位置签名」必须逐字相等
const withDecor = buildDefaultCitadel({ skipDecor: false });
const noDecor   = buildDefaultCitadel({ skipDecor: true  });
assert.deepEqual(bodySignature(noDecor), bodySignature(withDecor));
// ② 门 A 不倒退：skipDecor=false 时无主几何仍 === 0（判据逐字复制 test_cell_ownership）
assert.equal(censusUnowned(withDecor).length, 0);
// ③ 装饰归属正确：每个装饰网格的 userData.cell（或 cells）必须等于它所装饰的那一格——
//    窗台 → 那扇窗的格；花箱 → 阳台的格。抽查方式：装饰网格中心的 XZ 落进 userData.cell 的格投影内
for (const o of decorMeshes(withDecor)) assert.ok(cellProjectionContains(o.userData.cell ?? o.userData.cells, center(o)));
// ④ skipDecor=true 时装饰清单里的名字一个都不出现
assert.equal(decorMeshes(noDecor).length, 0);
```

**验收（四条命令全部退出 0，把数字贴回 TODOS C8）**：
```bash
node tools/test_decor_pass.mjs            # 本单
node tools/test_cell_ownership.mjs        # 门 A：无主 === 0
node tools/test_edit_exactness.mjs        # 单次编辑仍与全量重建逐格相等
node tools/test_edit_soak.mjs             # 20 次累积偏差不得超过当前值（现 0.4%）
```
另外必须**跑前先跑一遍基线并记下数字**，否则分不清是本单弄坏的还是本来就红。

**禁止**：
- 不改 `docs/CITADEL_DECOR_BOUNDARY.md` 的分类去迁就实现——分类不对就报回 Claude。
- 不在 `decoratePass.js` 里重新实现 `ownCell/ownSpanning/stampOwner`（归属口径必须只有一份）。
- 不加 `allowUnowned` 之类的绕过开关。
- 不动 `odysseyCitadel.js` / `geometryMerge.js`（滞后合并是 C8 的另一项，[Claude] 负责）。
- 改了 `citadelTown.js` 必须同步 bump `index.html` 里的 `?v=` 缓存版本号。

---

## G-20 · 跨格构件分量签名缓存（C4 未尽项）[❌ 撤单·不要派]

**状态：❌ 2026-09-04 撤单。** 决策过程留个记录，免得以后有人照着下面的伪代码再做一遍：

1. 早些时候主人裁定「照做」（当作给 C6 接线预留性能余量）；
2. 当晚并行的一轮 profiling **推翻了立项前提**：`node tools/probe_edit_phases.mjs` +
   `--cpu-prof` 显示一次编辑里 **闭包扩张平均 +0.0 格**——签名缓存想省的那部分**压根没发生**；
   长尾来自「与 dirty 规模无关的全图 pass」（一次编辑跑 5 遍，5 个台地各一次 `buildCitadelTown`）。
3. 于是改削固定成本，三刀都是等价改写、输出逐位不变：内院 flood fill 字符串键 → 位图（3.2×）、
   `breaksFourInARow` O(n²) → O(1)、`collectCitadelHouses` 一次构建收 3 遍 → 收 1 遍。
   实测 P50 中位 99~108ms → **~74ms**，P90 中位 173~179ms → **~130ms**。

**所以本单不做**：签名缓存要维护「分量形状签名」这套额外状态，禁区一大堆
（户色簇必须进签名、`stats.shrubCount` / `ctx.random` 流位置不能进签名、
内院树那处忽略返回值的调用点不能开缓存），而它要省的钱已经被证明不存在。
详见 `CITADEL_BUILD_PIPELINE_TODOS.md` C4 那一节的「G-20 撤单理由」。

**下面的伪代码只作技术存档，不是工单。**

**原始复核记录：** 本项当初的理由是「跨格构件改整组重建后 P90 从 115 涨到 190ms」。
2026-09-04 实测 `node tools/test_castle_building_experience.mjs`：**P50 75.6–80.2ms / P90 123.1–128.5ms**，
已经回到原来的 150 门内（C13-6 支架改形把每格支架网格数从 8 压到 3~5，顺带削掉了长尾）。
生产路径（`debounceMs=400` 去抖合并）实测更低：**P50 65.3ms / P90 76.0ms**（`node tools/probe_span_cost.mjs`）。

**所以派单前主人/Claude 要先决定一件事**：是
（a）**不做**，把 `tools/test_castle_building_experience.mjs` 里放宽到 200 的 P90 门收回 150（那本来就是本项的验收标准，现在无条件满足），还是
（b）**照做**，把它当成给 C6 接线（WFC 上生产路径）预留的余量。

若选 (b)，工单如下。

**目标**：`ownSpanning` 额外收一个 signature；与上次构建的签名一致就**既不摘也不重发**。

**读**：`src/world/citadelTown.js` 的 `ownSpanning` / `_spanWant` / `stampOwner`；`src/world/odysseyCitadel.js` 的 `closeDirtyOverSpanningParts` / `citadelSegmentIsDirty` / `dropCellsFromMerged` 调用处。

**伪代码**：
```js
// citadelTown.js —— 签名必须覆盖「所有能改变这块几何的东西」，不只是 cells：
const spanLocalSig = (cells) => cells.map(String).sort().map(key => {
  const [x,y,z] = key.split(",").map(Number);
  const cid = townClusters.clusterOf.get(x*32+z);             // 户色簇（远处同簇格被删也会改颜色）
  return `${key}:${at(x,y,z)}:${at(x+1,y,z)}${at(x-1,y,z)}${at(x,y,z+1)}${at(x,y,z-1)}${at(x,y+1,z)}${at(x,y-1,z)}:${cid}#${clusterSize(cid)}`;
}).join(";");
const ownSpanning = (cells, signature = null) => {
  … 原逻辑得到 dirtyHit …
  if (signature == null) return dirtyHit;                      // 没给签名的调用点维持旧行为
  const id = cells.map(String).sort().join("|");
  const sig = `${signature}@${spanLocalSig(cells)}`;
  nextSigs.set(id, sig);                                       // 全量/增量都记，判定循环本来就是全量
  if (!dirtyHit) return false;
  if (dirtySet && prevSigs?.get(id) === sig) { kept.add(id); _ownerCell = null; _spanWant = null; return false; }
  _ownerCell = { cells, spanId: id };
  return true;
};
// 调用点传的 signature：屋顶 = `${shape.kind}:${shape.axis??""}`；连拱 = `arcX:${runX}:${supportL}${supportR}`；
// 内院 = `court:${cells.length}`；广场/水道 = `plaza` / `canal`；晾衣绳 = `wire`
// odysseyCitadel.js —— 摘除谓词同样跳过：
//   第 2 步 traverse 里 `if (kept.has(o.userData.spanId)) return;`
//   dropCellsFromMerged 的谓词里 `if (kept.has(seg.spanId)) return false;`（faceToCell 需带上 spanId）
```

**验收**：
```bash
node tools/test_castle_building_experience.mjs   # P90 ≤ 150（把门从 200 改回 150）
node tools/test_edit_exactness.mjs               # 单次编辑逐格 0 误差——这条最容易被签名缓存打破
node tools/test_edit_soak.mjs                    # 20 次累积 ≤ 现值 0.4%
node tools/test_face_to_cell_parity.mjs          # onlyA=0 onlyB=0
node tools/probe_span_cost.mjs                   # 贴回「跨格件件数/tris」前后对比
```

**禁止**：
- 签名**只放局部占用与户色**这类能从 `grid` 重算的量；**不要**把 `stats.shrubCount`、`ctx.random` 的流位置写进签名——那两个一旦进签名，缓存就永远不命中，等于白改。
- 不要给没有传 signature 的调用点开缓存（`citadelTown.js:3100` 内院树那处**忽略返回值**，跳过它会导致「无主几何」直接抛）。
- 缓存只在增量路径生效（`dirtySet` 非空）；全量重建必须永远重发。

---

## G-12 · `tools/gen_corner_mask_table.mjs` [✅ 已交付]（TODOS C9）

**状态：✅ 已交付（2026-09-04）** — `classes=55 (Y4-only would be 70)`，`classCount === 55`，256 行可回放 → `tools/out/corner_mask_table.json`。

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

## G-13 · `cornerGraphAdapter.js` [✅ 已交付]（TODOS C9）

**状态：✅ 已交付（2026-09-05）** — `node tools/test_corner_graph.mjs`：`highland cells=978 cornerNodes=1431 floors=12`，`validate().ok`，`variants=78 bans=102853 domain1=27/1431`，空域 0。

前置（2026-09-04 晚）：`src/world/citadel/cornerPrototypes.js` 已上线，28 件，自检 `node tools/test_corner_prototypes.mjs` 全绿。

**直接用这几个导出，不要自己再造**：
- `cornerBuildAllowedClasses(maskTableRows)` → `Map<protoId, Set<classId>>`，就是本单伪代码里的 `allowedClassesOf`（传 `tools/out/corner_mask_table.json` 的 `table`）。它内部会断言「同一 classId 里所有 mask 的允许集一致」，不一致直接抛——**那是目录 bug，报回 Claude，不要绕过**。
- `cornerFaceBits(mask, dir)` → 该面共享的 4-bit 截面。两侧用同一个函数取，所以必然一致；建图时可以拿它当自检。
- `CORNER_DIRS` / `CORNER_OPP` / `CORNER_DELTA`（方向 → 节点偏移 (dgx,dgz,diy)）。
- `cornerShapeOf(mask)` → `air/top/soffit/through/setback/overhang/skew`，打印分布用。

**节点定义（照抄，别改）**：节点 = (gx, gz, iy)，gx∈[0..cols]、gz∈[0..rows] 是**格顶点**编号；
mask 的第 `dx|(dz<<1)|(dy<<2)` 位 = 格 `(gx-1+dx, iy+dy, gz-1+dz)` 是否非空。
只保留 `mask !== 0` 的节点（全空的角柱域退化）。

**已知数字，可以拿来对**：256 个 mask 允许集大小 1件×196 / 2件×51 / 3件×4 / 6件×4 / 7件×1。
所以 **bans 之后域大小 1 的节点会占绝大多数**，这是设计使然（自由度集中在顶面），不是 bug。

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

## G-14 · `tools/test_corner_seams.mjs`（门 J）[✅ 已交付]

**状态：✅ 已交付（2026-09-05）** — `node tools/test_corner_seams.mjs`：任意选件 3546 对同名零件对齐；同件 1840 对对齐；S19 t=1.05 基座 2 对无 T 缝。判据与 `test_corner_prototypes` ④ 相同：只比同名零件，一侧没出该零件则跳过。

前置（2026-09-04 晚）已齐。**而且门 J 的地基已经有机器判据了**：
`tools/test_corner_prototypes.mjs` 的 ④ 段已在**纯 mask 层**证过「4096 对相邻角柱、同名零件截面逐位相等」。
本单要做的是把它抬到**装配后的真几何**上：几何来自 `cornerGeometryParts(mask, protoId)`（单位立方体里的
`{kind:"box",min,max}` / `{kind:"prism",quad,yLo,yHi,base}`），乘 (cs,ch,cs) 平移后比顶点。
**先跑一遍 `node tools/test_corner_prototypes.mjs` 确认地基是绿的**，再写本单——它红了就不是你的问题。

**伪代码**：
```js
// 对每对相邻角柱 (a,b)，取两者几何在共享格边上的顶点（|x - edgeX| < 1e-6 或 |z - edgeZ| < 1e-6，同层）
// 断言：a 的边界顶点集合 == b 的边界顶点集合（按 (x,y,z) 四舍五入到 1e-5 比较），逐位相等
// 另：S19 t=1.05 复现——两个相邻地面格的基座（plinth）合并后，沿共享边不存在「一侧有顶点另一侧没有」的 T 型接缝
```

---

## G-15 · `src/procgen/graph/irregularQuadGrid.js` [✅ 已交付]（TODOS C10）

**状态：✅ 已交付（2026-09-04）**；⚠️ **本单原写的验收条件「边界顶点位置逐位不变」是错的**——那条太强，也不是该守的东西。已由 Claude 改成：**拐角顶点逐位不变 + 其余边界顶点仍落在原边界折线上（< 1e-6）**，并为此给 `irregularQuadGrid` 加了 `boundaryEdges` 导出让它可被机器判定。下方「禁止」段已同步。

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
**禁止**：不 import Three.js；不用 `Math.random`。
**边界不变量（2026-09-04 修正，原文写错过一次）**：不是「边界顶点位置逐位不变」，而是
**拐角顶点逐位不变 + 其余边界顶点仍落在原边界折线上（偏差 < 1e-6）**——边界顶点必须允许沿轮廓滑动，
否则贴边那圈四边形永远保持原三角形状，边长比恒 > 2。`locked` 集合里的顶点仍然逐位不变。

---

## G-16 · `tools/test_irregular_quad_grid.mjs`（门 K 上半）[✅ 已交付]

**状态：✅ 已交付（2026-09-04）** — 全四边形 / 凸 / 确定性 / HalfEdge 无 non-manifold；100 seed radius=6：`minAngle worst=49.48°（≥45 过）`、`edgeRatio worst=1.977（≤2 过）`。边长比一开始 2.118 不过，根因**不是调参**：① 整圈边界钉死 → 贴边那圈永远保持原形状；② relax 只收敛形状不管尺寸，**迭代越多越糟**（it 50→600，2.03→2.56）。修法：边界改沿轮廓滑动（拐角仍钉死）+ 补尺寸项（轻推限幅）+ 默认迭代 50→30。

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

## G-17 · `tools/test_grid_migration.mjs`（门 K 下半）[✅ 已交付]

**状态：✅ 已交付（2026-09-05）** — `node tools/test_grid_migration.mjs`：faces=804 hash=`0b70f22c`；highland 300 列 / 978 格 P50=0.428 P95=0.790 max=0.985；canal 82/235 P50=0.412 P95=0.778 max=0.971；零丢失、逐字符可逆、信封往返、hash 不符抛错。

前置（2026-09-04 晚）：`src/world/citadel/gridMigration.js` 已上线，地基自检 `node tools/probe_grid_migration.mjs` 全绿。

**接口（照抄，别自己造）**：
```js
import {
  citadelIrregularGrid, migrateAsciiToFaces, facesToAscii,
  createCitadelLevelsV6, readCitadelLevelsV6,
} from "../TigerMessenger/src/world/citadel/gridMigration.js";
const quad = citadelIrregularGrid({});                       // 默认 radius 8 / seed 20260904
const m = migrateAsciiToFaces(levels, quad);                 // { byFace, legacy, unmapped, mapping, occupiedColumns }
const back = facesToAscii(m.byFace, quad, { floors: levels.length, legacy: m.legacy });
```
`byFace` 的键是 `"<faceId>,<iy>"`（层不参与不规则化，键里必须带层号）。
`legacy` 是 `faceId → "ix,iz"`，**回读必须传它**——映射只配非空列，不传就逆不回来。

**⚠️ 本单原写的门槛「重心偏差 ≤ 0.75 格」作废，改成下面这套**：
| 门 | 值 | 实测（radius 8） |
| --- | --- | --- |
| 丢失 | `=== 0` | highland 0 / canal 0 |
| 可逆 | **逐字符相等**（比原来的「字符多重集守恒」强） | ✓ / ✓ |
| 偏差 P50 | ≤ 0.50 格 | 0.428 / 0.412 |
| 偏差 P95 | ≤ 0.85 格 | 0.790 / 0.778 |
| 偏差 max | ≤ 1.25 格（兜底，不是主门） | 0.985 / 0.971 |
**为什么不守 max ≤ 0.75**：列与 face 在被占用那片区域里密度几乎相同，等密度双射的最坏位移有理论下界，
连最优解（拍卖算法）都做不到。硬守 max 只会逼人去改算法参数凑数字。

**「942 格」也过期了**：高山现在是 **978 格 / 300 非空列**，canal-junction 235 格 / 82 列。

**禁止**：不改 `gridMigration.js` 的拍卖算法参数去凑偏差；不给「没有 face 的列」做方格回落。

**伪代码**：
```js
// Claude 交付 migrateAsciiToFaces(levels, grid) → { byFace: Map faceId->char, unmapped:[] } 与 facesToAscii(byFace, grid) → levels
const levels = HIGHLAND 布局; const g = createIrregularQuadGrid({seed:HIGHLAND_GRID_SEED, radius:…});
const m = migrateAsciiToFaces(levels, g); assert.equal(m.unmapped.length, 0);           // 942 格零丢失
const back = facesToAscii(m.byFace, g); assert.deepEqual(countChars(back), countChars(levels)); // 字符多重集守恒
// 每个非空 ASCII 格映射到的 face 重心与该格中心距离 ≤ 0.75 格宽（打印 max）
```

---

## G-18 · 下游最小适配（C10）[✅ 已交付]

**状态：✅ 已交付（2026-09-05）** — `citadelColumnCenter` 抽出；`odysseyCitadel.js` 地形裁剪与 `main.js` 承重判定共用；无 face 列返回 null；蓝图 `grid.kind` / `grid.gridHash`。
`node tools/test_column_center_parity.mjs`：25×25 差集空 both=300 mappedColumns=300。
`test_citadel_tactical_graph` 不倒退（864 节点 / 离表 0）。
`test_citadel_topology` 仍红：实际 `6e816c28` vs expected `07c43660`（加字段导致，**未改 expected**）。

清单（2026-09-04 晚）已交付：**`docs/CITADEL_GRID_V6_DOWNSTREAM.md`**，照它做，不要照下面这段旧正文。

⚠️ **下面那段正文里猜的三个文件，两个猜错了**（清单 §0 有逐条证据）：
`citadelTacticalGraph.js` 是 `@legacy V2`、按世界坐标环采样、压根不读 ASCII 格；`collision.js` 零处 `(ix,iz)`。
**两个都不改。** 真正要改的是三处：`odysseyCitadel.js:3356`、`main.js:957`（这两处必须逐字一致）、
`citadelBlueprint.js:194`（加 `kind` / `gridHash`）。清单里写了每处的改法、为什么、以及验收。

⚠️ 清单 §3 有一条硬约束：加字段会让 `test_citadel_topology` 的 blueprint hash 变，
**而那个脚本本来就是红的**——不要顺手改它的 expected 转绿。

Claude 会给一张「文件:函数 → 现在按 (ix,iz) 取中心，改为按 faceId 取重心」的清单（预计：`citadelTacticalGraph.js`、`collision.js`、`citadelBlueprint.js`）。只做清单上的替换；每处替换后跑 `node tools/test_citadel_tactical_graph.mjs` 与 `node tools/test_citadel_topology.mjs`，把两个脚本的关键数字（节点数 / 离表误差）贴回。**不重写寻路算法**。

---

## G-19 · `tools/test_window_stencil_positions.mjs`（门 L 部分）[✅ 已交付]

**状态：✅ 已交付（2026-09-05）** — `node tools/test_window_stencil_positions.mjs`：窗=420 跨格角=0 最大越界=−0.8100 格宽=2 drawCallΔ=20（2/层）；共享材质零污染 156 件 · cutters=10 reveals=10。

前置（2026-09-04 晚）：`src/render/stencilWindows.js` 已上线（`P.stencilWindowsV1` 默认 false），地基自检 `node tools/probe_stencil_windows.mjs` 全绿。

**⚠️ 本单原写的判据是错的，照下面这条做**：
- ❌ 原文：「每窗 AABB 投影到 XZ，断言完整落在某一个格内；跨格窗 === 0」。
  **实测 420 扇窗全部"跨格"** —— 因为窗贴在墙面上，而墙面正是两格的分界面
  （窗心 `cx(ix) + dx*(cs/2 + 0.028)`）。这条门永远过不了，且不该过。
- ✅ 改成 **不跨格角**：窗沿着墙走的那一段（along-wall 区间）必须完整落在所属格的边长之内。
  判据已经实现好了，直接调：
  ```js
  import { stencilWindowPlan, windowSpansCellCorner } from "../TigerMessenger/src/render/stencilWindows.js";
  const plan = stencilWindowPlan(castle);       // plan.windows 每项带 cell / dir / position
  for (const w of plan.windows) {
    const r = windowSpansCellCorner(
      { cell: w.cell, center: [w.position[0], w.position[2]], dir: w.dir, halfWidth: 0.19 },
      { cellSize: castle.userData.townSpec.cellSize, gridSize: castle.userData.townSpec.gridSize }
    );
    assert.ok(r.ok, `${JSON.stringify(w.cell)} 跨格角 ${r.overhang}`);
  }
  ```
  实测：**420 扇越界 0 扇，最大越界 −0.81**（格宽 **2.0**，不是 1.6——别写死）。

**本单还可以顺手加的两条**（都已有现成断言可抄，见 `tools/probe_stencil_windows.mjs`）：
draw call 增量必须是 **+2/层**（不是 +2/窗）；**共享材质零污染**（本模块只 clone，改了原件会污染城门/废墟/岛屿）。

**判不了的别写进测试**：「窗洞里露不露描边壳」要看画面，脚本判不了。

**伪代码**：
```js
// 对每个名为 town-window（或 Claude 原型里的新名字）的网格：世界 AABB 投影到 XZ，
// 断言它完整落在某一个格内（AABB 的四角 floor((x - origin)/cs) 相同、floor((z - origin)/cs) 相同）
// 打印跨格窗数；断言 === 0
```

---

## 派发顺序建议（2026-09-05 已全部交付本批）

**2026-09-05 Grok 已交付：G-13 / G-14 / G-17 / G-18 / G-19 / G-11**，评估报告 `docs/citadel-corner-eval.md`。
**同日续：C8 滞后合并**（`test_decor_lag_merge.mjs`：体块帧 decorU=3193、下一帧 decorU=0）。
G-20 仍撤单。C6 / C9（含屋顶零件）/ C10 拾取与笼形变形 / C11 stencil 均已接线且**默认关**。
下一步是主人看画面再翻开关，以及截图：不规则高亮格、窗洞描边壳。

（以下为 2026-09-04 晚原文，作废。）

**现在能派的只有一张：G-11（decoratePass）**，且必须用上面重写过的版本。
G-20（签名缓存）要先由主人/Claude 在 (a) 收门槛 / (b) 照做 之间选一个。

**其余五张单（G-13 / G-14 / G-17 / G-18 / G-19）卡的是同一件事：Claude 欠着四份规格。**

| 欠的规格（全是 [Claude]，全部未开始） | 写出来解锁 |
| --- | --- |
| C9 角落分段目录 `src/world/citadel/cornerPrototypes.js` | G-13 → G-14 → 角落评估报告 |
| C10 存档迁移 `migrateAsciiToFaces` / `facesToAscii` | G-17 |
| C10 下游适配清单（哪几个文件的哪个函数改按 face 重心取样） | G-18 |
| C11 stencil 挖窗原型 | G-19 |

所以**下一刀不是派 Grok，是 Claude 补这四份规格**。补完之后五张单可并行。

---

## G-01b · 作用域外 `add` 改为 `throw`（与 G-01 同批）[❌ 作废·判据写反]（TODOS C3）

**状态：❌ 作废（2026-09-04）——判据写反了，不要派。** 本单要求「作用域外 `add` 直接 throw」，实际按这个判据实现会让 `town-cell` 第一个撞上（它自己就写了 `userData.cell`，本不需要环境作用域），`buildOdysseyCitadel` 直接抛、全部城堡测试红。Claude 已改成按**「有没有网格最终无主」**报错（自声明的网格与空 Group 放行），并在 `tools/test_cell_ownership.mjs` 加了 throw 路径用例。**这次误伤反而挖出 4 类真实归属空洞**（`town-plaza`、内院 241 件、`town-canal-water`、`town-watergate`、z 向连拱）——说明原 `test_cell_ownership` 会漏报：无主的面不进 `faceToCell`，合并后就从普查里消失。现无主真为 0。

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
