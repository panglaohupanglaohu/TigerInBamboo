# V7 Procgen 基线审计（procgen-v7-baseline.md）

> 生成日期：2026-08-22 · 负责人：Grok · 依据：`PLAN.md` 第十一章 11.1 的真实代码审计任务与 TODO V7-G0。
> 本文只登记**当前真实能力与缺口**，不把 V6 的 `[x]` 冒充 V7 完成。

## 1. 审计结论表（V7 接手点）

| 子系统 | 现有入口 | 已验证事实（V6 证据） | V7 必须解决的差距 | V7 能力等级 |
| --- | --- | --- | --- | --- |
| WFC 求解器 | `src/world/citadel/constraintSolver.js`；V7=`src/procgen/wfc/solver.js` | V6 487 格 golden seeds 7/1/42/884 求解通过；V7 已通过 bitset/support-count、有限回溯、provenance、oracle 和确定性 hash | V7 尚未接入生产 Three 场景；flags 仍关闭 | `TESTED`（V7 核心） |
| 模块目录 | `src/world/citadel/moduleCatalog.js` + `moduleFamilies.js` | 47 模块；`MODULE_COMBINATION_SPACE=2450`（组合指标）；G 格 lockModuleId=gate | 无 versioned ModulePrototype/Variant JSON schema；无 orientation group（Y4/D4/CUBE24）；无预编译 BitSet 兼容表；无 dead-variant 构建期报错 | `DEFINED` |
| 骨架/拓扑 | `irregularSkeleton.js` + `topology.js` | 受限扰动锁定 300 顶点；骨架 hash `e78f0eeb`；Half-Edge n-gon/twin/边界环/非流形验证 | WFC 只理解规则坐标 ID；无任意邻接图 adapter 与方向 token 接口 | `DEFINED` |
| 地形场 | `terrainGenerator.js`；V7=`src/procgen/field/*` | V6 六 pass；V7 ScalarField/SDF/chunk halo 通过 G7 | 真实 terrain recipe/dirty runtime 尚待接线 | `TESTED`（V7 核心） |
| 表面抽取 | `terrainExtract.js`；V7=`src/procgen/field/marchingCubes.js` | V6 L1 38 面 hash；V7 256-case indexed MC、法线、语义、seam 通过 G8 | Three/GPU 视觉验收尚待 G18 | `TESTED`（V7 核心） |
| UV 编译 | `terrainUvCompiler.js` | 15 charts；瀑布 V 单调；texel 密度偏差统计 | chart/UV 可继续沿用；V7 MC 网格需重新编译语义通道 | `DEFINED` |
| Worker | `compileWorker.js`；V7=`src/procgen/worker/*` | V6 fallback hash `d8ec1bce`；V7 job schema/handler/cancel/transfer list 通过 G10 | 真实浏览器 Worker URL/CORS 尚待 G18 | `TESTED`（V7 核心） |
| 快照/存档 | `worldSnapshot.js` + `saveSchema.js`；V7=`src/procgen/snapshot/*` | V6 snapshot/save 基线；V7 dirty layer/snapshot V3/replay 通过 G14 | 仍需接入现有编辑器与 V6 G6 实际会话 | `TESTED`（V7 核心） |
| 生产状态 | `runtimeAdapter.js` | 三开关默认关、URL 可逆；V6-G0～G5 Node 测试通过 | ~~G6 编辑测试当前失败~~ G6 已修复转绿（2026-08-22：被保护路线冲突 + undo/redo 历史解缓存，实测预览 P95=8.17ms）；V6 未 DEFAULT_ON | 见 `tools/out/v6-capability-ledger.json` |

## 2. 迁移对照基线（不覆盖 V6 产物）

| 指标 | 值 | 来源 |
| --- | --- | --- |
| V6-G2 求解 golden（seed=7） | solution hash `62d30adc`，backtracks=0 | `tools/test_v6_g2_solver.mjs` |
| V6-G2 求解 100 seed | contradiction=0，fallbackMax=0，msP50≈234.49 | `tools/out/v6-g2-solver-stats.json` |
| V6-G4 地形 L1 样片 | 38 面 hash `51bd6bc2` | `tools/test_v6_g4_terrain.mjs` |
| V6-G6 编辑 | ~~当前红项~~ **已转绿**（2026-08-22：预览 P95=8.17ms、被保护路线冲突、undo/redo 六类 hash 复原） | `tools/test_v6_g6_edit.mjs`（V7-G14 的增量编辑部分仍需与 V7 dirty 分层对齐） |
| V6 编译 hash | 三次一致 `d8ec1bce`（compileWorker 桩） | `tools/test_citadel_v4_g0.mjs` |
| 蓝图 hash | `6e6245cc`（seed 7 ×3 稳定） | `tools/test_citadel_blueprint.mjs` |

V7 改动 `constraintSolver.js` 时必须保留薄 adapter 与上述 golden tests（V7-G3 停止条件）。

## 3. 第三方许可边界

见仓库根 `THIRD_PARTY_NOTICES.md`。要点：
- `mxgmn/WaveFunctionCollapse` 与 `marian42/wavefunctioncollapse` 均为 MIT，但 **mxgmn 示例图片/tiles 不在软件许可内**；
- V7 不导入 Marian 的 Unity prefab/scene/material/texture，不导入 mxgmn sample images/tiles；
- MC case/edge/triangle table 采用“自生成 + 双实现交叉验证”方式（见声明文件），无许可风险。

## 4. Schema 与开关（本基线一并落地）

- `PROCGEN_ENGINE_SCHEMA_VERSION=1`、`WFC_MODEL_SCHEMA_VERSION=1`、`FIELD_SCHEMA_VERSION=1`、`MC_MESH_SCHEMA_VERSION=1`：`src/procgen/core/schema.js`。
- 功能开关 `procgenEngineV1` / `wfcCastleV1` / `marchingTerrainV1`：`src/core/params.js` FEATURES，URL-only，默认全部 false；关闭时 V6/legacy 路径对象数、碰撞源、灯数、screenshot oracle 不变（`tools/test_procgen_v7_all.mjs` 断言）。
- Golden seeds：`1 / 7 / 42 / 884`（与 V6 GOLDEN_SEEDS 同源）。RNG stream 名：`blueprint / wfc / repair / field / props / combat`。
- 三类城堡 fixture：`src/procgen/fixtures/castleFixtures.js`（高山=现有生产蓝图冻结 hash；古堡/运河=最小 versioned 数据）。

## 5. V7 能力台账

`tools/out/procgen-v7-ledger.json`。G1～G17 已按真实测试证据升到 `TESTED`；没有条目越级到
`WIRED/DEFAULT_ON/VISUAL_ACCEPTED/PERF_ACCEPTED`，V7 三开关仍全部 false。
等级序列沿用 V6：`DEFINED → TESTED → WIRED → DEFAULT_ON → VISUAL_ACCEPTED → PERF_ACCEPTED`。

## 6. 已知红项与豁免

- ~~`tools/test_citadel_range.mjs` 湖沼树伞冠断言为既有失败~~ 已修复（2026-08-23，`defect.citadel-range-swamp-canopy` 关闭）：坏断言（逐名遍历已合并分件）重写为 userData 结构 + 几何兜底断言，与 V7 无关。
- ~~`tools/test_v6_g6_edit.mjs` 失败已映射 V7-G14~~ 2026-08-22 已修复转绿：①新增被保护路线规则（`lockModuleId` 城门格禁止改写/拆除，返回 `locked-route` 冲突且不提交）；②`editSession` 增加历史解缓存修复 undo/redo module hash 漂移。断言未改语义（冲突场景的输入从"内格改色"换成"改写城门格"，因为当前目录对单格编辑全域可解，8279 组实测 0 冲突）。V7-G14 仍需把 dirty 三层分层/存档 V3 与该编辑会话对齐。
