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
- [x] 植被 compiler/runtime 读 `ecologyFieldV10`（Grok 2026-08-26）；生产路径不再用 `forestDensityAt` 局部湿度猜测

---

## O0 · 术语与审计

- [x] **[2026-08-26]** 写明官方方法计划：`docs/OSKAR_OFFICIAL_PLAN.md`
- [x] **[2026-08-26]** 代码/注释搜索 `MFC`：仅出现在 PLAN 12.23.1 的否定声明（「不存在名为 MFC 的独立算法」），无第三算法实现
- [x] **[Grok 2026-08-26]** 跑 `node tools/audit_planet_v8_oskar_gap.mjs`（读 field/runtime/shader，不读勾选）。结论：`verdict=RUNTIME_READY_OPT_IN`；默认 `planetTerrainV1/curvedWaterV1/terrainSemanticShaderV1/cloudImpostorV1` 全是 false；`dense-forest`/`grass-surface`/`mountain-rolling-clouds`/`ocean-surface`/`lake-surface`/`terrain-editor` = RUNTIME_WIRED；`terrain-chain`/`highland-global-maximum` = DATA_TESTED。未 DEFAULT_ON。
- [ ] 任何新云/海/草 PR 的描述必须引用 PLAN 本文件的 S 编号，禁止「更像 Oskar」

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

---

## O2 · 生产顺序与快照（原 V10-G21 H，P0）

- [ ] `planetCompilerV8.js` 生产顺序：`field → hydrology → climate → charts/semantic bake → cloud+ecology → snapshot`
- [ ] cloud 与 vegetation 读取 **同一个** climate hash
- [ ] Worker 生成，帧边界原子提交；旧 V8/V9 semantic 可 flag 回滚；场景不得双套水/云/植被 renderer
- [ ] snapshot 增加 `hydrologyHash` / `climateHash` / `ecologyHash` / `dependencyGraphVersion`
- [ ] capability ledger 只允许 DATA_TESTED → RUNTIME_WIRED → DEFAULT_ON，禁止跳级
- [ ] 新建 `tools/test_planet_v10_coupled_systems.mjs`：schema+水文+气候+生态+云+植被+编辑器+runtime；golden `1/7/42/884` + 100 full world + 1000 field seeds
- [ ] 全部绿灯后才改 PLAN.md / TigerMessenger/TODO.md 对应勾选

---

## O3 · 默认世界仍 opt-in

- [ ] `params.js` 中 `planetTerrainV1` `curvedWaterV1` `cloudImpostorV1` `terrainSemanticShaderV1` 保持默认 false
- [ ] `test_grok_completion_contract.mjs` 继续锁默认 false 与 rollback
- [ ] 主系统 A/B/C（V7/V8/V9）按钮不得在 O1/O2 红灯时把 V9 设成默认进入页
- [ ] 文档写清：方尖碑圣城本地山体 ≠ 球面 V8 大陆链；两套云不要互相覆盖成双层错误

---

## O4 · 默认镜头看得到的草 / 岸 / 云海

官方方法是玩家看见结果，不是只有 Node 哈希。

- [ ] 默认高山圣城山坡：contrast-aware 草或明确的低端 billboard 降级，禁止只换绿色
- [ ] 默认圣城湖面继续 WFC/dual-grid 曲面，禁止回归整块平面蓝
- [ ] 戴帽云保持本地钉点；气候抽样云不得再随机盖住峰顶（`peak-visibility` keepout）
- [x] **[Grok 2026-08-26]** 球面 opt-in 路径气候抽样云读 `climateFieldV10`，不再 `dot(wind)` 近似；戴帽云仍是本地钉点

---

## O5 · 硬路线与聚合测试

- [ ] **P0** 不得把 `test_procgen_profiles_hard_routes.mjs` 的 expected 从 `264b9dbd` 改回 `17acc1eb`
- [ ] planner 删除五台地/瀑布旧权威路线；改为连续山谷地面入口 → 五层内部旋转楼梯 → `castle-top`，再冻新 golden
- [ ] `test_procgen_v7_all.mjs` 与 `test_planet_v8_all.mjs` 聚合入口转绿
- [ ] 1000 seed 水面：无悬空水片/开放湖盆；岸线 seam ≤ `1e-4`（G21-I）
- [ ] 气候：迎风 lift ≥ 背风 `1.35×`；长水面 fetch 区 vapor 高于无水上风 ≥ `0.18`
- [ ] 生态：坡度 `>0.70` 非雪线森林密度 ≤ `0.08`；高山迎风林带高于背风 ≥ `0.12`；苔庭核心开阔率 ≥ `0.72`
- [ ] 同 seed hash 稳定；dirty cone 外不变；20 轮 mount/replace/dispose 后 registry=0
- [ ] 运行时每帧只更新 shader uniforms 与固定容量 buffer，不重跑 hydrology/climate/ecology solver

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

云和植被单源都已接线。下一刀 **O2 生产顺序与快照**（G21-H）：`field → hydrology → climate → charts/semantic bake → cloud+ecology → snapshot`，同一 climate hash 供给云和树；仍不碰 DEFAULT_ON。
