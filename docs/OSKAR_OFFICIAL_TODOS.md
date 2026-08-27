# Oskar 官方方法 · TODOs

> 与 `docs/OSKAR_OFFICIAL_PLAN.md` 一一对应。完成一项就把 `[ ]` 改成 `[x]` 并注明日期、命令、seed。
>
> **不要**把 `TigerMessenger/TODO.md` 里已勾的 V4–V9 数据测试再抄一遍当新完成。这里只跟官方方法的缺口和必须保住的契约。
>
> 负责人冲突时：V10 接线与本文件未勾项由当前编码代理直接做；不把工作排队给 Kimi。

## 证据纪律（每项都要）

- 来源事实 / 画面归纳 / 项目推导 三栏不混写
- 命令可复现；禁止改 expected 来迁就旧五台地/瀑布路线
- 不得把 Node 时间写成硬件 FPS
- `planetTerrainV1` / `cloudImpostorV1` / `curvedWaterV1` 默认保持 false，除非 O6 门全绿且主人明确要求 DEFAULT_ON

---

## 已保住（不要回退）

- [x] 术语上不存在 Oskar「MFC」。海面流水线按 PLAN 12.23.1：grid → field → MC 结构 → 静态水面 → shader 浪（2026-08-23）
- [x] main/dual geodesic 与球面 WFC/MC 数据层存在且可测（opt-in）
- [x] 高山圣城本地戴帽云/云海框挂在方尖碑场景山脊上，不依赖 V8 开关（2026-08-25，`highlandHeroClouds.js`，`node tools/test_odyssey_citadel.mjs`）
- [x] 蓝车搭乘 BGM 在车上优先于攻城/峡谷（2026-08-25，`node tools/test_tram_ride_bgm_priority.mjs`）
- [x] voxel AO + bounce 默认关；bounce 是实验档不是发售档
- [x] V10 schema/水文/气候/生态 **DATA_TESTED**（DeepSeek 2026-08-24）
- [x] 云 compiler 读 `climateFieldV10`（Grok 2026-08-26）；球面云物理字段不再用 `dot(direction, wind)` 冒充 fetch
- [x] 植被 `vegetationCompilerV9` + InstancedMesh **已接入 opt-in RUNTIME_WIRED**，默认世界未启用（`planetTerrainV1` 仍 false）。compiler 读 `ecologyFieldV10`，不再用 `forestDensityAt` 局部湿度猜测
- [x] **[2026-08-26]** 来源 S12 登记：`x.com/OskSta/status/1852334860137849222`——云 shader 与树共用同一 impostor；写入 `OSKAR_OFFICIAL_PLAN.md` 来源表与 2.6 缺口对照
- [x] **[2026-08-26]** 来源 S13 登记：`x.com/OskSta/status/1991099314714902634`（岸浪展示）+ `1991101097818403263`（实现方法回复：looping vertex shader + 生成期烘焙 + 每顶点 in/out 方向与 time offset）；写入 `OSKAR_OFFICIAL_PLAN.md` 来源表与 2.7.1
- [x] **[2026-08-26]** 白云可见性验收修复：cap 云原贴峰顶（y≈55，被城堡/山峰遮挡，默认视角看不到）→ 移到**城堡正上方**；云 mesh `raycast=()=>{}` 防挡拾取。**2026-08-27 三轮修复（飞艇视角）**：① 玩家出生朝向 +z（面向湖）→ -z（面向城堡）；② 出生点 z=24（湖边，平视只到城堡 y≈15）→ z=60（湖对岸，城堡全景+云进画面）；③ **云分层 58 朵覆盖飞艇全高度带与山脉内外（2026-08-27 云海重做）**：cap（城堡顶上方，scale 25.1）+ castle-cloud（×2，y=38）+ inner-cloud（×4，半径 32–44，y 32–41）+ **ring 加强（×17，半径 56，scale 8.8–13.9，y 30–54，主峰方向抬到山峰以上）** + **outer-cloud 新增（×14，半径 66–102 = 山脉外缘/海上，y 47–68，天空中的云）** + forest；ring 改圆形环（原椭圆压缩致前方云贴城堡半径仅 13–20）+ 32 朵相邻重叠 27 对成云海带；outer 20 朵 8/8 方位全覆盖。验收 `tools/test_cloud_layers.mjs`。
- [x] **[2026-08-26]** S12 云/树共用 impostor 落地（默认世界 hero 层可见）：`buildSharedImpostorAtlas`（云块+树冠块同 atlas）+ `createSharedImpostorMaterial`（aHero 编码选块——低位 authored/高位 canopy，不新增 attribute，总 attribute ≤16 保住 WebGL 下限；树冠无风漂移）+ `createCloudImpostorSystem` 自动切换；圣城山脚 7 树冠卡 + 11 云卡同 mesh 同 draw call；近景 12 株低模树保持几何。V8/V9 全局开关保持 false（O3）。`node tools/test_cloud_tree_shared_impostor.mjs`

---

## O0 · 术语与审计

- [x] **[2026-08-26]** 写明官方方法计划：`docs/OSKAR_OFFICIAL_PLAN.md`
- [x] **[2026-08-26]** 代码/注释搜索 `MFC`：仅出现在 PLAN 12.23.1 的否定声明（「不存在名为 MFC 的独立算法」），无第三算法实现
- [x] **[Grok 2026-08-26 复审]** `node tools/audit_planet_v8_oskar_gap.mjs`（读 field/runtime/shader，不读勾选）
  - `verdict=RUNTIME_READY_OPT_IN`；`productionEnabled=false`
  - 默认 flag：`planetTerrainV1/curvedWaterV1/terrainSemanticShaderV1/cloudImpostorV1` 全 false
  - `dense-forest` = RUNTIME_WIRED（opt-in；`vegetationDataCount=167`，runtime 有 InstancedMesh；**默认世界未启用**）
  - `grass-surface` / `mountain-rolling-clouds` / `ocean-surface` / `lake-surface` / `terrain-editor` = RUNTIME_WIRED
  - `terrain-chain` / `highland-global-maximum` = DATA_TESTED（highland 4 golden 场高 9.4，strictHighest）
  - 未 DEFAULT_ON
- [x] **[2026-08-26]** 来源 S14 登记：`x.com/OskSta/status/1769641473895432220`——relax pass 防蘑菇化（模块格收敛到期望形状尺寸，左上角格子收缩演示）；写入 PLAN 来源表与 2.7.2
- [x] **[2026-08-26]** 来源 S15 登记：`x.com/OskSta/status/1768627849529893109`——把瓦片格子地形放到球体上（球面格子星球，与 S14 同期同系列）；写入 PLAN 来源表与 2.7.2 球面化段落
- [x] **[2026-08-26]** 来源 S16 登记：`x.com/OskSta/status/1751945034851570056`——背光高光（反向网格轮廓层 + 阴影遮罩）；写入 PLAN 来源表与 2.7.3
- [ ] 任何新云/海/草 PR 的描述必须引用 PLAN 本文件的 S 编号（S1–S17），禁止「更像 Oskar」

---

## O1 · 气候/生态单源（原 V10-G21 E/F，P0）

对应官方方法 2.3：生成期烘焙，一处真源。

- [x] **[Grok 2026-08-26]** `cloudClusterCompiler.js` 经 `readClimateSample` 读取 `climateFieldV10`；无气候场时 fetch/shadow=0，不再 `dot(direction, wind)`。`node tools/test_planet_v9_cloud_paths.mjs` seed=42
- [x] **[Grok 2026-08-26]** 五段 `OSKAR_CLOUD_CHAIN_BANDS` 只影响 `lowLayer` / `chainBand` / 尺度抖动；altitude 由 terrain+climate.cloudBase 决定
- [x] **[Grok 2026-08-26]** ridge path 采样 `field.heightAt`；clearance 绑 lift；cloudBase 复制气候场。`planetCompilerV8` 在云之前跑 hydrology+climate
- [x] **[Grok 2026-08-26]** impostor shader 仍只更新 `uTime/uWind/uWeather/uDay/uHeroDayWeight`；测试断言不含 precipitation/forestness/upwindOceanFetch
- [x] **[Grok 2026-08-26 TEST]** `test_planet_v9_cloud_paths.mjs` 对齐 climate.hash；`test_planet_v8_cloud_climate_chain.mjs` 4 golden+100 seed；`test_planet_v8_determinism.mjs`
- [x] **[Grok 2026-08-26]** `vegetationCompilerV9.js` 经 `readEcologySample` 只读 `ecologyFieldV10` 的 forestness/speciesBand/grassness/reedness/mudness；无生态场时才回退 V8。`planetCompilerV8` 在植被之前 `solveEcologyV10`
- [x] **[Grok 2026-08-26]** terrain shader 吃 `climateData1`（precipitation + ecologicalWetness）与 `ecologyData0`（forest/grass/reed/mud）：湖岸湿色、湿草、泥、雪岩按同一字段混合
- [x] **[Grok 2026-08-26]** InstancedMesh 按 chart chunk + 稳定 `instanceId`；`bindVegetationChunks` / `replaceDirty` 只换脏 chunk；runtime 每帧只改 `uGrassTime`
- [x] **[Grok 2026-08-26 TEST]** `node tools/test_planet_v9_forest_grass.mjs` seed=1/7/42/884：ecology hash 对齐、species bucket、dirty 区域外 instance hash 不变、20 轮 ResourceRegistry 归零
- [x] **[S12 云/树共用 impostor，P1]** 已落地：`buildSharedImpostorAtlas`（云块+树冠块同 atlas，`cloud+canopy-shared-octa-impostor`）+ `createSharedImpostorMaterial`（aHero 编码逐实例选块——云 0/1、树冠 3，不新增 attribute，总 attribute ≤16 保住 WebGL 下限；canopy 无风漂移）+ `createCloudImpostorSystem` 检测 canopy 自动切共享管线；圣城山脚 7 个树冠卡片与 11 个云卡片同一 mesh 同一 draw call（默认世界可见，V8/V9 全局开关保持 opt-in）。**剩余**：全星球 V9 `vegetationRuntime` 远 LOD 接入共享 impostor（atlas 版本进 snapshot hash）。验收：`tools/test_cloud_tree_shared_impostor.mjs`
- [x] **[S12 TEST]** `tools/test_cloud_tree_shared_impostor.mjs`：共享 atlas 确定性/双族像素（云白、树冠绿+树干棕）、aShape 选块与 uniform（uCloudViews/uTotalViews）、云+树冠同 mesh 单 draw call、canopy 静态路径（speed 0 / 单点 path）、近景 12 株低模树与 legacy cloud pipeline 不变

- [x] **[S13 岸浪，P1]** 已落地（2026-08-26）：`highlandShoreWaves.js` —— `bakeHighlandShoreWaves` 生成期烘焙湖岸浪带（每顶点 in/out 方向 + time offset 沿岸推进错相 + 振幅近岸 0.34/远岸 0.10 衰减），`createHighlandShoreWaveSystem` looping vertex shader 循环位移（涌岸/退岸），挂 `castleContainer`（`highland-shore-waves`，renderOrder 5，update 驱动 uTime）。验收：`tools/test_shore_waves.mjs`（232 顶点/336 三角，确定性 hash，相位推进 ~0.132，振幅衰减，预算）
- [x] **[S14 五地点地面连接，P1]** 已落地（2026-08-27）：`groundConnector.js` `bakeGroundConnector`（基础剖面 + relax 迭代收敛 + 防膨胀钳制）；**应用二挂（飞艇鸟瞰验收）**：圣城台地前缘 relax 岸坡带 `highland-relax-shore-band`——初版 y 2.95–4.36 灰蓝像水下台地被撤，二挂**整体抬高（5.2→4.4）+ 亮岸色 0x9fb4c0**，y 3.70–5.14 高于湖面（2.99/2.50/1.76），飞艇鸟瞰时湖面上可见平滑亮岸带；书店镇岛感（bookshopIslandLift 平滑）、叹息之门走廊（carveHillsForTrack CORRIDOR→FADE smoothstep）核对已有平滑过渡
- [x] **[S14 TEST]** `tools/test_ground_connector.mjs`：确定性 hash、relax 收敛（final change < 1e-3、更多迭代收敛同剖面）、剖面平滑（相邻差 < 2）、防膨胀（高度 ≤ desired+maxDeviation、端点保持期望）、索引合法、预算
- [x] **[S15 球面连接带，P1]** 已落地（2026-08-27）：`bakeGroundConnector` 支持 `fromDir/toDir`（slerp 大圆弧采样 + 切平面横向 + 半径+抬升）；**应用**：接口就绪，苔庭/交汇城堡/白鲸海湖角距 80–170°（跨半球）不做整体大陆桥，保持轨道/运河连接
- [x] **[S15 TEST]** `test_ground_connector.mjs` 球面版断言：确定性、`spherical=true`、所有顶点在半径+抬升球面（±1.5）、起点方向≈fromDir、relax 收敛、防膨胀
- [x] **[S16 背光高光，P1]** 已落地（2026-08-26）：`backlitHighlight.js`——山体几何克隆等比放大 1.02 + BackSide 暖金层（0xffd9a0）+ rim（法线⊥视线）+ 受光遮罩（法线×太阳，阴影侧不显示）+ 背光因子（`main.js` animate 每帧传 sunDir/camera）；挂 `outerTerrainSystem`。**2026-08-27 修复**：`depthTest:false`——放大壳背面在源物体之后，默认深度测试会整体被山体挡掉（主人验收「看不到高光」的根因）；轮廓光必须画在所有物体之上 + rim 只在边缘发亮
- [x] **[S16 TEST]** `tools/test_backlit_highlight.mjs`：层创建/几何克隆/BackSide、update 驱动与 null 安全、遮罩纯函数（背阳面=0、受光单调、正对最强）、预算、dispose、圣城构建后高光层挂载与源名断言
- [x] **[S17 植被小阴影，P1]** 已落地（2026-08-27）：`buildBlobShadow`（圆形贴地半透明暗斑，共享几何/材质）→ 12 株树 + 42 丛灌木根部各 1 个（共 54，radius 1.05–1.65，贴地形高度 +0.035）；城堡-山脉整合核对：12.39 台地埋入山体、城址外缘山体抬升（基座无悬空）
- [x] **[S17 TEST]** `tools/test_blob_shadow.mjs`：blob 数量对齐（12 树 + 42 灌木）、全部贴地（|y−terrain| < 0.1）、共享几何/材质 ≤2 份、Basic 材质透明不写深、平放贴地、预算 ≤80
- [x] **[2026-08-27 地势重做]** 台地崖壁：城址边缘过渡 0.80–1.08 → 0.90–1.04（鸟瞰可见台地边界崖线，湖岸不受影响）；出城山体台阶 1.6u → 2.6u（鸟瞰可见岩层）；验收 `tools/test_terrain_profile.mjs`（台地平坦/崖壁落差≥2.5/台阶级/湖面低于台地/过渡有层级）。
- [x] **[S13 TEST]** `tools/test_shore_waves.mjs`：烘焙确定性、in/out 反向、time offset ∈[0,1)、沿岸排相位推进、近岸振幅 > 远岸 ×2、浪带贴合真实湖岸线（`highlandWaterHalfWidth`/`highlandWaterCenterX`）、索引合法、预算、legacy 水面不受影响
- [x] **[S13 高山-台地结构]** 已落地（2026-08-26）：视频逐帧/缩略图分析（暖橙棕岩石山、顶部平台、岩层层理、山腰台阶、台地受光）→ 出城台阶化 + 山坡灌木层 `buildHighlandSlopeShrubs`（42 丛，避开湖/城址，独立统计层）复刻视频成片暗绿树丛；**山体岩石配色按主人验收恢复 2026-08-25 基线（冷蓝灰）**。**剩余差距**：岸浪带 → 归 [S13 岸浪]（已落地，见上）

---

## O2 · 生产顺序与快照（原 V10-G21 H，P0）

- [x] **[Grok 2026-08-26]** `planetCompilerV8` 实测 pipeline：`field → hydrology → climate → ecology → cloud → charts/semantic bake → vegetation → snapshot`
- [x] **[Grok 2026-08-26]** cloud 与 vegetation 的 `snapshot.*.climateHash` 都等于同一个 `climateFieldV10.hash`
- [x] **[Grok 2026-08-26]** Worker `createPlanetCompileHost` + `commitAtFrameBoundary`；semantic shader 仍走 flag；`cloudImpostorV1` 开启时跳过 legacy `createCloudRing`
- [x] **[Grok 2026-08-26]** 完整 snapshot 契约：顶栏 `hydrologyHash` / `climateHash` / `ecologyHash` / `dependencyGraphVersion=fieldDependencyGraphV10`；植被依赖 `vegetation.climateHash === clouds.climateHash === climate.hash`（seed 42 实测 `6786f1a6`）。`validatePlanetSnapshot` 缺任一 hash 即失败
- [x] **[Grok 2026-08-26]** capability ledger 禁止从 DATA_TESTED 跳到 DEFAULT_ON，禁止新建条目直接 DEFAULT_ON
- [x] **[Grok 2026-08-26 TEST]** `node tools/test_planet_v10_coupled_systems.mjs` golden 1/7/42/884 + 100 full world + 1000 field seeds
- [x] **[Grok 2026-08-26]** PLAN.md / TigerMessenger/TODO.md G21-H 已按绿灯回填

---

## O3 · 默认世界仍 opt-in

- [x] **[Grok 2026-08-26]** `params.js` 中 `planetTerrainV1` `curvedWaterV1` `cloudImpostorV1` `terrainSemanticShaderV1` 保持默认 false；耦合测试与 grok contract 锁死
- [x] **[Grok 2026-08-26]** `node tools/test_grok_completion_contract.mjs` 继续锁默认 false 与 rollback
- [x] **[Grok 2026-08-26]** 默认 `worldVersion=custom`、`planetPresentationVersion=legacy`；A/B/C 只有 URL/`worldVersion` 才进 V7/V8/V9。`resolveActiveWorldVersion("")===custom`
- [x] **[Grok 2026-08-26]** 球面 impostor 开时 `messengerIsland` 跳过 legacy `createCloudRing`；圣城戴帽云仍是本地钉点，不等于 V8 大陆链
- [x] **[Grok 2026-08-26]** 正式主页 `custom` 场景通过 `officialPagePlanetFeatures` 挂球面 impostor 云海 + 曲率海洋壳（`curvedWaterV1` 仅场景 opt-in，测地线 subdiv 5，峡谷顶点随 `canyonOffsetDir` 下潜，不关 `planet-surface`）；`canalScope=crystal-city` 只留水晶城运河；交汇古堡保留；战船走海面巡航（8 艘 `ocean-warship`）。圣城 `highlandIslandLift=0`（山脚接海面）。`FEATURES.curvedWaterV1/oceanWorldRoutesV1/legacyCanalWorld` 全局默认不变。不碰地形 DEFAULT_ON
- [x] **[Grok 2026-08-26]** 书店镇海岛台地 `BOOKSHOP_OCEAN_ISLAND_LIFT=3.2`、苔庭 `saihojiIslandLift=3.2` 高于海面；海洋用贴地球壳（海面 `#4cb8c4` 青）浮在地面之上，谷缘保持海平面并向谷内平滑下灌；湖沼在水晶城峡谷水岸阶地

---

## O4 · 默认镜头看得到的草 / 岸 / 云海

官方方法是玩家看见结果，不是只有 Node 哈希。

- [x] **[Grok 2026-08-26]** 默认山坡挂 `highland-slope-grass-billboards`（contrast-aware + wind billboard），不是只换顶点绿
- [x] **[Grok 2026-08-26]** 默认湖面 `curved=true`、WFC dual-grid、非 PlaneGeometry；`test_odyssey_citadel.mjs` 锁曲率
- [x] **[Grok 2026-08-26]** 本地戴帽云钉回方尖碑山脊；气候抽样云不进圣城子树；球面 keepout 仍挡峰顶
- [x] **[Grok 2026-08-26]** 球面 opt-in 路径气候抽样云读 `climateFieldV10`，不再 `dot(wind)` 近似；戴帽云仍是本地钉点

---

## O5 · 硬路线与聚合测试

定量数字只写在文末「定量门槛」，这里不重复勾选。

- [ ] **P0** 不得把 `test_procgen_profiles_hard_routes.mjs` 的 expected 从 `264b9dbd` 改回 `17acc1eb`
- [ ] planner 删除五台地/瀑布旧权威路线；改为连续山谷地面入口 → 五层内部旋转楼梯 → `castle-top`，再冻新 golden
- [ ] `test_procgen_v7_all.mjs` 与 `test_planet_v8_all.mjs` 聚合入口转绿
- [ ] 定量门槛（水面 / 气候 / 生态 / 稳定性 / 性能）在生产路径上证明，见文末

---

## O6 · DEFAULT_ON（未授权前禁止）

- [ ] 仅当 O1–O5 脚本全绿、审计脚本不再报「renderer 未挂」或「默认 false 却声称完成」
- [ ] 另开提交专门改 flag；不得夹在功能 PR 里把默认打开
- [ ] 提交说明列出 rollback 命令与 legacy 真源仍在

---

## 定量门槛（未勾 = 未在生产路径上证明）

这些数字来自 `TigerMessenger/TODO.md` G21-I，是官方方法「可复现」的最低条，不是截图分数。

- [ ] 水面：1000 seed 无悬空水片/开放湖盆；岸线 seam 最大误差 ≤ `1e-4`
- [ ] 气候：迎风坡平均 lift 至少为背风坡 `1.35×`；长水面 fetch 区平均 vapor 高于无水上风区至少 `0.18`
- [ ] 生态：坡度 `>0.70` 非雪线森林密度 ≤ `0.08`；高山迎风林带 forestness 高于对称背风带至少 `0.12`；苔庭核心开阔率 ≥ `0.72`
- [ ] 稳定性：同 seed 所有 field/snapshot hash 一致；局部编辑后 dirty cone 外 hash 不变；20 轮 mount/replace/dispose 后 registry=0
- [ ] 性能：运行时每帧仅更新云/水/植被 shader uniforms 与固定容量动态 buffer，不重新执行 hydrology/climate/ecology solver

---

## 建议下一刀

O1–O4 已接线。下一刀 **O5 硬路线 golden 与聚合测试**；不得把 `264b9dbd` 改回 `17acc1eb`。仍不碰 DEFAULT_ON。

新来源 **S12**（2024-11-01 蓬松云 shader 与树共用 impostor）已登记：O1 末尾新增「云/树共用 impostor 管线」P1 任务与测试项（当前云 atlas 与树 InstancedMesh 两套独立，树侧 `octa-impostor` 仅 schema 声明未实现）。
