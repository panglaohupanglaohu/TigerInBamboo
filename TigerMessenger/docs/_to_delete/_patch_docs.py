import re, sys, os

DOCS = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs")
p = os.path.join(DOCS, "CITADEL_GROK_TASKS.md")
s = open(p).read()

# ---------- 1. 通用约定补四条硬规矩 ----------
anchor = "> 状态标记：**[可立即派发]** = 不依赖 Claude 的前置规格；**[等规格]** = 要等 TODOS 里对应 [Claude] 项先交付。"
assert anchor in s, "anchor 1 not found"
s = s.replace(anchor, """> 状态标记：**[可立即派发]** = 不依赖 Claude 的前置规格；**[等规格]** = 要等 TODOS 里对应 [Claude] 项先交付。
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
>    实际是内院 `ownSpanning` 只登记了空格这个真 bug。判不了就把清单交回，不要在测试里过滤差集。""")

# ---------- 2. 每张单插状态行 ----------
STATUS = {
 "G-01 ·": "**状态：✅ 已交付并复核（2026-09-04）** — `A=853 B=853 onlyA=0 onlyB=0`。注意：Grok 交付时报的 `onlyB=65` **不是测试写错，是真 bug**（内院 `ownSpanning` 只登记了 `region.cells`，那全是空格，而编辑只发生在实心格上 → 拆围墙时这段内院永远不判 dirty）。已由 Claude 修：格集补上四邻的实心围墙格。",
 "G-02 ·": "**状态：✅ 已交付（2026-09-04）** — `grep -c \"S21\"` = 2、`grep -c \"hexagonal grid\"` = 1，§2–§6 未改。",
 "G-03 ·": "**状态：⚠️ 已交付，但换了载体（2026-09-04）** — **没有 `tools/test_module_prototypes.mjs` 这个文件**，内容并进了 `tools/test_wfc_town_selection.mjs` 的 G-03 段（相容率 **18.7%**，水平 24.9% / 竖向 6.2%，dead variant 0，另加反向下限 ≥2%）。**不要再按本单新建文件。**",
 "G-04 ·": "**状态：✅ 已交付（2026-09-04）** — `totalCells=1213 highland=978 canal=235 countKeys=2980` → `tools/out/adjacency_stats.json`。",
 "G-05 ·": "**状态：⚠️ 已交付，但被 Claude 重写（2026-09-04）** — Grok 版六向都建边、exposure 是布尔、banPolicy 是占位，与本单「适配器契约」段不符。现行版本：**异色相邻不建水平边**（不同建筑不合并屋顶）、exposure 四态（`edge/edge-top/air/foreign`）、含 `columnHeight` / `columnIsolated`，且**塔按柱判定不按格**（按格判会让锥顶找不到支撑，实测 `19,2,10` empty-domain）。改这两个文件前先读现行实现。",
 "G-06 ·": "**状态：⚠️ 已交付，但被 Claude 重写（2026-09-04）** — Grok 版用「六面 connector 全 any」的占位原型自证，`fails=0` 无意义。现行脚本冻的是三条：解可回放（pins 全钉逐格相等）、同 seed 同 hash、真实布局 100 seed 零失败。实测 `replay=978/978 determinism=5f185a4f fails=0/100`。",
 "G-07 ·": "**状态：❌ 作废（2026-09-04）** — **没有 `tools/test_wfc_determinism.mjs`**。门 F 已由 `tools/test_wfc_selection_golden.mjs` + `tools/test_wfc_incremental.mjs` 覆盖（`outsideChanged=0 / ring=2 / P50 21.9ms`）。不要派。",
 "G-08 ·": "**状态：✅ 已交付（2026-09-04）** — `node tools/test_wfc_explain.mjs`：不相容 pins → `reason: unsatisfiable` / `empty cell: 1,0,0` / involved 两格；`src/ui/wfcFailurePanel.js` 已 `mountWfcFailureSection` 进 `createDevPanel`，只读、无重试按钮。",
 "G-09 ·": "**状态：❌ 作废（2026-09-04）** — **没有 `tools/test_wfc_propagation_visible.mjs`**。门 H 下半并进 `tools/test_wfc_town_selection.mjs` 的 G-09 段（钉一格触发 8 个格域收缩、累计 20 次；旧哈希路径此数恒为 0）。不要派。",
 "G-10 ·": "**状态：⚠️ 已交付，测试被 Claude 换真原型重测（2026-09-04）** — `outsideChanged=0 ring=2 soakSame=66 soakDiff=892 fullHash=4edc1143 P50=24.5ms`。原交付用的占位原型下这些数字不成立，见头部硬规矩第 1 条。",
 "G-11 ·": "**状态：⏳ 前置已解锁（`docs/CITADEL_DECOR_BOUNDARY.md` 2026-09-03 已交付），但本单 2026-09-04 前一直不完整**（无验收命令、无禁止事项、没点名要剪哪些分支）。下方已重写为完整五件套。",
 "G-12 ·": "**状态：✅ 已交付（2026-09-04）** — `classes=55 (Y4-only would be 70)`，`classCount === 55`，256 行可回放 → `tools/out/corner_mask_table.json`。",
 "G-13 ·": "**状态：⛔ 仍派不了（2026-09-04 复核）** — 前置 [Claude] **角落分段目录 `src/world/citadel/cornerPrototypes.js` 未开始**。目录里要有每个基础类的几何、六向 socket 与 `allowedClasses`，缺了 Grok 无从下手。",
 "G-14 ·": "**状态：⛔ 仍派不了（2026-09-04 复核）** — 等 G-13。",
 "G-15 ·": "**状态：✅ 已交付（2026-09-04）**；⚠️ **本单原写的验收条件「边界顶点位置逐位不变」是错的**——那条太强，也不是该守的东西。已由 Claude 改成：**拐角顶点逐位不变 + 其余边界顶点仍落在原边界折线上（< 1e-6）**，并为此给 `irregularQuadGrid` 加了 `boundaryEdges` 导出让它可被机器判定。下方「禁止」段已同步。",
 "G-16 ·": "**状态：✅ 已交付（2026-09-04）** — 全四边形 / 凸 / 确定性 / HalfEdge 无 non-manifold；100 seed radius=6：`minAngle worst=49.48°（≥45 过）`、`edgeRatio worst=1.977（≤2 过）`。边长比一开始 2.118 不过，根因**不是调参**：① 整圈边界钉死 → 贴边那圈永远保持原形状；② relax 只收敛形状不管尺寸，**迭代越多越糟**（it 50→600，2.03→2.56）。修法：边界改沿轮廓滑动（拐角仍钉死）+ 补尺寸项（轻推限幅）+ 默认迭代 50→30。",
 "G-17 ·": "**状态：⛔ 仍派不了（2026-09-04 复核）** — 前置 [Claude] **存档迁移 v5→v6（`migrateAsciiToFaces` / `facesToAscii`）未开始**。",
 "G-18 ·": "**状态：⛔ 仍派不了（2026-09-04 复核）** — 前置 [Claude] **下游适配清单未开始**。",
 "G-19 ·": "**状态：⛔ 仍派不了（2026-09-04 复核）** — 前置 [Claude] **stencil 挖窗原型未开始**。",
 "G-01b ·": "**状态：❌ 作废（2026-09-04）——判据写反了，不要派。** 本单要求「作用域外 `add` 直接 throw」，实际按这个判据实现会让 `town-cell` 第一个撞上（它自己就写了 `userData.cell`，本不需要环境作用域），`buildOdysseyCitadel` 直接抛、全部城堡测试红。Claude 已改成按**「有没有网格最终无主」**报错（自声明的网格与空 Group 放行），并在 `tools/test_cell_ownership.mjs` 加了 throw 路径用例。**这次误伤反而挖出 4 类真实归属空洞**（`town-plaza`、内院 241 件、`town-canal-water`、`town-watergate`、z 向连拱）——说明原 `test_cell_ownership` 会漏报：无主的面不进 `faceToCell`，合并后就从普查里消失。现无主真为 0。",
}
count = 0
for key, line in STATUS.items():
    m = re.search(r"^(## " + re.escape(key) + r".*)$", s, re.M)
    assert m, "header not found: " + key
    s = s[:m.end()] + "\n\n" + line + s[m.end():]
    count += 1
print("状态行插入", count, "条")

# ---------- 3. G-15 禁止段修正 ----------
old = "**禁止**：不 import Three.js；不用 `Math.random`；边界顶点与 `locked` 集合**位置逐位不变**。"
assert old in s
s = s.replace(old, "**禁止**：不 import Three.js；不用 `Math.random`。\n**边界不变量（2026-09-04 修正，原文写错过一次）**：不是「边界顶点位置逐位不变」，而是\n**拐角顶点逐位不变 + 其余边界顶点仍落在原边界折线上（偏差 < 1e-6）**——边界顶点必须允许沿轮廓滑动，\n否则贴边那圈四边形永远保持原三角形状，边长比恒 > 2。`locked` 集合里的顶点仍然逐位不变。")

# ---------- 4. G-11 重写 ----------
start = s.index("## G-11 ·")
end = s.index("## G-12 ·")
g11 = '''## G-11 · `decoratePass.js` + `tools/test_decor_pass.mjs`（C8）[可派发：前置已交付，2026-09-04 重写工单]

**状态：⏳ 前置已解锁（`docs/CITADEL_DECOR_BOUNDARY.md` 2026-09-03 已交付），但本单 2026-09-04 前一直不完整**（无验收命令、无禁止事项、没点名要剪哪些分支）。以下是重写后的完整版。

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

## G-20 · 跨格构件分量签名缓存（C4 未尽项）[**前提已失效，派前先复核**]

**状态：⚠️ 2026-09-04 复核——立项前提没了。** 本项当初的理由是「跨格构件改整组重建后 P90 从 115 涨到 190ms」。
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

'''
s = s[:start] + g11 + s[end:]

# ---------- 5. 派发顺序建议更新 ----------
old = """## 派发顺序建议

今天就能派：**G-01、G-02、G-04、G-12、G-15+G-16**（五张单互不依赖，可并行）。
其余按 TODOS 里 [Claude] 前置项交付顺序解锁：C5 词汇表 → G-03/G-05/G-06/G-07/G-09 → G-08/G-10 → C8 清单 → G-11 → C9 目录 → G-13/G-14 → C10 迁移 → G-17/G-18 → C11 原型 → G-19。"""
assert old in s
s = s.replace(old, """## 派发顺序建议（2026-09-04 晚重写；原版已全部交付，作废）

**现在能派的只有一张：G-11（decoratePass）**，且必须用上面重写过的版本。
G-20（签名缓存）要先由主人/Claude 在 (a) 收门槛 / (b) 照做 之间选一个。

**其余五张单（G-13 / G-14 / G-17 / G-18 / G-19）卡的是同一件事：Claude 欠着四份规格。**

| 欠的规格（全是 [Claude]，全部未开始） | 写出来解锁 |
| --- | --- |
| C9 角落分段目录 `src/world/citadel/cornerPrototypes.js` | G-13 → G-14 → 角落评估报告 |
| C10 存档迁移 `migrateAsciiToFaces` / `facesToAscii` | G-17 |
| C10 下游适配清单（哪几个文件的哪个函数改按 face 重心取样） | G-18 |
| C11 stencil 挖窗原型 | G-19 |

所以**下一刀不是派 Grok，是 Claude 补这四份规格**。补完之后五张单可并行。""")

open(p, "w").write(s)
print("GROK_TASKS.md 写回", len(s), "字节")
