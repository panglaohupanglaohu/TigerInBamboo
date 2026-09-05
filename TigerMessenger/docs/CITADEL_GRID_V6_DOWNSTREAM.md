# 不规则网格（v6）下游适配清单 · C10 [Claude] 规格

> 2026-09-04。G-18 的唯一前置。**只做本表点名的替换**，不重写寻路（PLAN §4 N5）。
> 迁移函数在 `src/world/citadel/gridMigration.js`，自检 `node tools/probe_grid_migration.mjs`。

## 先说一条：工单里猜的三个文件，两个是猜错的

`CITADEL_GROK_TASKS.md` 的 G-18 原文写「预计：`citadelTacticalGraph.js`、`collision.js`、`citadelBlueprint.js`」。
2026-09-04 逐个读过之后：

| 文件 | 实际情况 | 要不要改 |
| --- | --- | --- |
| `src/world/citadelTacticalGraph.js` | 文件头第一行就写着 **`@legacy V2 环采样战术图（禁止新代码依赖）`**，V4 真源是 `src/world/citadel/surfaceGraph.js`，只在 `?citadelCombatV2=1` 时挂载。而且它**按世界坐标环采样**（`RING_SPACING = 2.2`），压根不读 ASCII 格 | **不改** |
| `src/world/collision.js` | 只处理 `platforms` / `hills` 的世界坐标 AABB，没有一处 `(ix,iz)` | **不改** |
| `src/world/citadel/surfaceGraph.js`（V4 真源） | `grep ix\|iz\|cellSize\|gridSize` 零命中 | **不改** |
| `src/world/citadelBlueprint.js` | 确实要改，但不是「按 face 重心采样」，是**蓝图里要能区分两种网格**（见 §3） | **要改** |

真正要改的是另外两处**承重判定**，工单里一个都没提到。它们才是「按 (ix,iz) 取中心」的实际调用点。

---

## 1 · `src/world/odysseyCitadel.js:3356` —— 地形承重裁剪（P0）

```js
const trimmedTerraces = current.terraces.map((terrace, terraceIndex) => {
  const result = trimCitadelGridToTerrain(terrace.levels, (ix, iz) => {
    const c = citadelGridCellCenter(ix, 0, iz);          // ← 这一行
    return citadelTerrainCellSupported(contour, c.x, c.z, terraceIndex, CITADEL_TOWN_SPEC.cellSize * 0.5);
  });
```

**改成**：`(ix, iz)` → `mapping.cellToFace.get(\`${ix},${iz}\`)` → `quad.centroids[i]` 取 `(x, z)`。
半径参数 `cellSize * 0.5` 改成**该 face 的内切半径**（`quad` 提供 `corners[i]`，取重心到四条边的最小距离），
否则不规则四边形上会出现「重心支撑但半个面悬空」。

**没有 face 的列**（v6 里不存在的地皮）一律判**不支撑**，不要回落到方格中心——
回落会让某些格在方格和 face 两套坐标下得到不同答案，而下一节那处必须与本处逐字一致。

## 2 · `src/main.js:957` —— 编辑器放置的承重判定（P0，必须与 §1 逐字一致）

```js
// Pure canonical transform: safe even while the panel is still being
// constructed, and exactly identical to both the 2D map and 3D generator.
const c = citadelGridCellCenter(ix, 0, iz);
```

注释自己写了「**exactly identical to both the 2D map and 3D generator**」——这条约束是本项最容易踩的坑：
§1 和 §2 用同一个 `(ix,iz) → (x,z)` 变换，改了一处不改另一处，编辑器会允许放一个 3D 侧随后又裁掉的格。

**做法**：把变换抽成 `gridMigration.js` 的一个导出（建议 `citadelColumnCenter(ix, iz, { quad, mapping })`，
无 quad 时回落到 `citadelGridCellCenter`），两处都调它。**不要各写各的。**

**验收**：编辑器里能放的格集合 == 3D 侧裁剪后的格集合。写一个小脚本枚举 25×25 两边对比，差集必须为空。

## 3 · `src/world/citadelBlueprint.js:194–200` —— 蓝图要能区分两种网格（P0）

```js
grid: Object.freeze({
  size: townLayout.gridSize ?? CITADEL_GRID_SIZE,
  cellSize: CITADEL_TOWN_SPEC.cellSize,
  cellHeight: CITADEL_TOWN_SPEC.cellHeight,
}),
```

**加两个字段**：`kind: "ascii" | "faces"`、`gridHash`（v6 时填 `quad.hash`，方格时 `null`）。

**为什么必须加**：蓝图的 canonical hash 是存档一致性的锚（`saveSchema.js` / `test_citadel_topology`）。
不加这两个字段，同一份 `levels` 在方格模式和 face 模式下会算出**同一个 hash**，
而它们是两座不同的城——存档串味、回归测试也看不出来。

⚠️ **加字段会让 `test_citadel_topology` 的 blueprint hash 变**。那个脚本目前**本来就是红的**
（「G0 蓝图 hash 不得因 G1 派生 API 漂移」，本会话开始前就红）。**不要顺手改它的 expected 来转绿**——
先把它已有的红修掉、确认基线，再单独提交本项引起的 hash 变化，并在提交信息里写清楚新旧 hash。

## 4 · 不在本清单、但别忘了它们属于 [Claude]

| 项 | 归属 | 说明 |
| --- | --- | --- |
| `citadelTown.js` 的 `cx()/cz()` 与模块几何 | [Claude] 笼形变形 | 模块要按四边形四角做双线性插值，不是简单换个中心点 |
| `ui/citadelEditorPanel.js:2301` / `ui/citadelSceneEdit.js:124` | [Claude] 编辑器拾取 | 拾取要从「射线打到哪个格」改成「打到哪个 face」，是交互改造不是采样替换 |

---

## 验收（G-18 的交付物就是这三行数字）

```bash
node tools/probe_grid_migration.mjs        # 地基：零丢失 + 逐字符可逆 + 偏差 P95 ≤ 0.85
node tools/test_citadel_tactical_graph.mjs # 不得倒退（本清单不改它，红了就是别的问题）
node tools/test_citadel_topology.mjs       # 见 §3 的警告：它本来就红，先确认基线
```

再加一条本清单特有的：**编辑器可放集合 == 3D 裁剪后集合，差集为空**（§2）。

## 禁止

- 不重写寻路（N5）。`citadelTacticalGraph` / `surfaceGraph` / `collision` 一行都不要动。
- 不给「没有 face 的列」做方格回落——两套坐标必须是二选一，不能混。
- 不改 `test_citadel_topology` 的 expected 来吸收 §3 的 hash 变化。
- 不动 `gridMigration.js` 的拍卖算法参数去凑偏差数字（它已经是近最优：P95 0.79 / max 0.99，
  贪心版是 P95 1.5 / max 3.0；理由写在文件头注释里）。
