# Citadel V4 · G0 报告

日期：2026-08-22  
负责人：Grok  
阶段门：G0 通过后才允许进入 G1。  
种子：`combat=7` `town=1` `terrain=1`

## 来源事实 / 项目推导

| 栏 | 内容 |
|---|---|
| 来源事实 | Oskar：渲染网格与玩法网格分离；失败应可复现；并行前必须固定 seed 与稳定遍历 |
| 项目推导 | 三个独立开关、fixedStep、canonical hash、29 组基线目录；本阶段不实现 Half-Edge / SurfaceProvider |

## 1. 现状审计

| 文件 | 行数 | 职责 | 主要调用方 | 重叠 |
|---|---:|---|---|---|
| `citadelTown.js` | 2702 | ASCII 栅格、Townscaper 邻接规则、hash 选型、2450 组合常量 | odysseyCitadel、blueprint、editor、messengerIsland | 与 blueprint 都解释台地/层数；选型无 socket |
| `citadelRange.js` | 1913 | 外围地形、瀑布/梯湖、walkLift、木马/夜潜接线、运河广场 | messengerIsland、collision、phalanx extras | 高程真源与 odysseyCitadel / walkLift 并存 |
| `citadelInfiltration.js` | 1395 | 深夜四绳下降、双组巡查、天亮回腹 | citadelRange、phalanx、main | 与日间攻城分裂的状态机 |
| `citadelBlueprint.js` | ~250 | 纯数据编译、台地归一、阶段表 | odysseyCitadel | 应成为唯一语义真源（已开始） |
| `citadelTacticalGraph.js` | 773 | 分层 A*、预约、增量、合法边 | messengerIsland | 节点仍是环采样，非真实 surface |
| `combatEvents.js` | ~65 | seed / 命令 / 事件 digest + canonicalHash | phalanx、range、replay 测试 | — |
| `rng.js` | ~82 | mulberry32、derive、fork、stableShuffle | phalanx、tactical 测试 | — |

未提交改动（Kimi P0/P1 与城堡接线）**全部保留**：蓝图、战术图、重放、士兵风格、rng 注入。未覆盖用户/其他代理实现。

## 2. 功能开关（默认关 = 旧系统）

`src/core/params.js` `FEATURES`：

| 开关 | 默认 | URL | 关闭时 |
|---|---|---|---|
| `citadelTownV4` | false | `?citadelTownV4=1` | 现有 hash 选型 `buildCitadelTown` |
| `citadelTerrainUvV2` | false | `?citadelTerrainUvV2=1` | 现有 `citadelRange` / 每面 0..1 UV |
| `citadelCombatV3` | false | `?citadelCombatV3=1` | 现有 phalanx / infiltration |
| `citadelCombatV2` | false | `?citadelCombatV2=1` | 保留 Kimi P0/P1，与 V4 独立 |

G0 时 V4 管线尚未接线，因此关闭开关是空操作，旧路径 100% 仍是运行时真源。

## 3. 测试命令与结果

```text
node tools/test_citadel_v4_g0.mjs
node tools/test_citadel_blueprint.mjs
node tools/test_citadel_tactical_graph.mjs
node tools/test_citadel_combat_replay.mjs
node tools/test_soldier_style.mjs
node tools/test_townscaper_rules.mjs
node tools/test_townscaper_details.mjs
node tools/test_town_grid.mjs
node tools/test_odyssey_citadel.mjs
node tools/test_canal_citadel.mjs
node tools/citadel_v4_g0_baseline.mjs
```

全部 exit 0。

- 同 seed 连跑 3 次：攻城 4 场景事件流 digest 逐字节一致；换 seed 必分歧。  
- 蓝图 canonical hash `6e6245cc` ×3 一致。  
- 战术图：834 节点 / 离表误差 0.0000 / 10 分钟 4332 次合法跳边、零空中路线。

## 4. 29 组基线

定义于 `src/world/citadel/baselineSpec.js`（5 天气 × 5 镜头 = 25，再加瀑布近景、单格编辑、港口攻城、深夜木马）。

G8/G12 已用同一 id 写出 25 组拓扑 SVG + 相机局部坐标（`tools/out/citadel_v4_shots/`）。GPU 浏览器实拍仍待主人在有头环境补像素基线。战斗/蓝图/选型指纹已写入 `tools/out/citadel_v4_g0.json`。

## 5. 性能与资源（Node 桩）

| 指标 | G0 值 | 说明 |
|---|---|---|
| 战斗重放墙钟 | ~28 s | 4 场景 × 3 跑 |
| 离表误差 | 0.0000 | tactical graph 全体节点 |
| 寻路失败 | 0 | 10 分钟仿真 |
| 模块 fallback | 0 | 现系统无 solver |
| FPS / draw calls / heap | null | 待浏览器镜头（G10） |

## 6. 关键路径随机性

- `saihojiPhalanx.js`：已无 `Math.random()`，一律 `createRng(seed)`。  
- `citadelTown/Range/Infiltration`：无 `Math.random()`。  
- **剩余**：`odysseyCitadel.js` 亮窗 `Math.random()`（表现层，非攻防 digest）。G3/G8 用 `townSeed` 替换。

## 7. 回滚

三个 V4 开关默认 `false`。不要开 `citadelTownV4/citadelTerrainUvV2/citadelCombatV3` 直到对应阶段接线并通过回归。

## 8. 阶段门

**G0 通过。** 允许进入 G1（Blueprint 版本迁移加强 + 纯数据 Half-Edge 拓扑），不得跳到全城模块求解或全量士兵迁移。
