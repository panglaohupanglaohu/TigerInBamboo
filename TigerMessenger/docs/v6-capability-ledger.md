# V6 能力真值台账

日期：2026-08-22  
commit：`a04887d`  
seed 主：`7`；边界：`1 / 42 / 884`  
机器可读：`tools/out/v6-capability-ledger.json`

分级：`DEFINED` → `TESTED` → `WIRED` → `DEFAULT_ON` → `VISUAL_ACCEPTED` → `PERF_ACCEPTED`  
禁止把 V4 历史 `[x]` 抄成已交付。本表按仓库现状降级。

## 必须写明的事实

| 说法 | 事实 |
|---|---|
| 2450 modules | **组合空间指标** `MODULE_COMBINATION_SPACE`，不是 2450 个成品 Mesh |
| 47 modules | 当前 `moduleCatalog` 目录规模（含 extra families） |
| `resolveTown` | **G2**：domain 初始化 + 最小熵 + 邻域传播 + 回溯≤32。golden fallback=0。不是静默 floor/base。成品几何仍等 G3 |
| `citadelCombatV3` | 默认关；开时跑无外观 `combatSim`，**不替换**可见 `saihojiPhalanx` |
| `oskLightingPrototype.js` | shot-harness A/B **样片**。生产入口是 `lightingDirector.js` + `?oskLightingV1=1`，默认关 |
| 开关 vs 画面 | **已修**：`citadelTownV4=false` 必须 `restoreLegacyTownPresentation`；true 才 `applyTownV4Presentation` |
| `CitadelWorldSnapshot` | **TESTED 未 DEFAULT_ON**：schema v1。seed=7 hashLegacy `3a1261c7`、hashTown `b8eb5e27`。关开关 walkLift 保持 legacy |
| G2 骨架/WFC | **TESTED**：skeleton `e78f0eeb`；town hash `62d30adc`；golden fallback=0 |
| G3 family/prop | **TESTED**：单簇 hash `17ca1ad7`（133 格 / 698 solids / 204 props）。全城 Mesh 仍 Box/Cone |
| G4 terrain | **TESTED**：L1 样片 hash `51bd6bc2`（38 面）。Range 仍是生产可见地形 |
| G5 combat | **TESTED**：登陆样片 replay `701569ed`；公平性 4 路线 / 1 撤退。默认 phalanx |

## 独立缺陷（不归因 V6）

- ~~`tools/test_citadel_range.mjs` 湖沼参天树伞冠断言失败（既有）~~ **已修复（2026-08-23）**：`defect.citadel-range-swamp-canopy` 关闭。根因：f5a23b7 把深潭太古木换成 `createColossalVernacularTree`（77 团云片伞冠 + mergeStaticGroup 合并）后，断言仍逐名遍历旧定制树分件名——坏测试而非坏资产。已重写为 userData 结构事实（77 冠/4 枝/3 干）+ 合并几何顶点数（12192）+ 沿树轴包围盒高（29.8）断言，测试 11 组全绿。

## 基线镜头

5 天气 × 5 机位，见 `baselineSpec.js`。

| 模式 | 现状 |
|---|---|
| legacy | GPU 25 张：`tools/out/citadel_v4_gpu/*.png`（拍时默认仍是 legacy 镇体）+ `citadel_v4_gpu_matrix.json` |
| V4 | `?citadelTownV4=1` 才挂 Box/Cone 镇体；**尚未**重拍 25 GPU |
| V6 | **无**第三套 presentation；无 25 镜头 |

V6 三模式矩阵 = 缺口。不得用 SVG 顶替 VISUAL_ACCEPTED。

## 能力表

| id | level | 入口 | 默认 | fallback | 测试 | 缺口 |
|---|---|---|---|---|---|---|
| topology | WIRED | `compileTopology(blueprint, seed)` 含不规则骨架 | 数据层总编译 | 无可见地形 Mesh | topology + `test_v6_g2_solver.mjs` | 对偶网格不驱动渲染；扰动未进生产镇体 Mesh |
| terrain | TESTED | `extractLowPolySurface` + L1 样片 | field 出数据 Mesh；**生产可见仍 Range** | `citadelRange` | `test_v6_g4_terrain.mjs` | 未换五层/港口/苔庭 |
| uv | TESTED | `compileTerrainUV` | 不写进生产材质 | 旧每面 0..1 | pipeline G2 | 未贴到可见 Mesh |
| modules | TESTED | `solveDirtyRegion` ← `resolveTown` | 编译用；**非 DEFAULT_ON** | 无解解释，禁止静默 floor/base | G2 golden fallback=0；100 seed | 成品几何仍等 G3；highland 回溯=0 |
| presentation | WIRED | `syncTownPresentation` ← snapshot.sources | **关** = legacy 镇体 | `buildCitadelTown` 仍构建后隐藏/显示 | pipeline 487 格；G1 snapshot | 全城仍 Box/Cone；G3 仅单簇样片 |
| props | TESTED | `propPlacement.js` + `town.props` | 手工摆件仍在场景 | dirty reconcile | `test_v6_g3_family.mjs` 簇 neverSelected=[] | 未挂全城 Three；等确认 |
| nav | TESTED | `compileSurfaceGraph` 挂在 snapshot.graph | phalanx **不用** | flags 关 = `citadelWalkLiftLocal`；town/uv 开 = snapshot sampleWalkLift | pipeline G5、G1 回滚 | 未接纸兵 |
| combat | TESTED | `createHarborLandingSample` | **关**；可见仍 phalanx | `saihojiPhalanx`；V3 开则互斥 | `test_v6_g5_combat.mjs` | 未扩展完整攻城/木马夜袭 |
| lighting | WIRED | `createLightingDirector` `?oskLightingV1=1` | **关** = 旧四灯 | `environment.js` + `dayNight.js` 改灯 | harness 样片 | 无 AO atlas；非 DEFAULT_ON |
| editor | TESTED | `blueprintStore` / 编辑器仍 `rebuildCitadelTown` | 旧 2D/3D 编辑 | 无预览传播/冲突 UI | pipeline G9 | V6-G6 |
| save | TESTED | `saveSchema.js` v1→v2 | 未接主存档循环 | localStorage 旧键 | pipeline G11 hash `3a5e6c20` | 未做主游戏存档切换 |
| performance | TESTED | Node 桩 | 无设备 FPS | — | 150 决策 ~1ms；单格 dirty ~0.3–1ms | 无 GPU P95；无 10min 资源回稳 |

最高已达：`WIRED`。没有任何一项 `VISUAL_ACCEPTED` 或 `PERF_ACCEPTED`。

## 回滚

`?citadelTownV4=0`（默认）恢复可见 legacy 镇体，walkLift 不包 V4 高度。  
`?citadelCombatV3=0` 不跑 V3 sim。  
`?oskLightingV1=0` 旧四灯。
