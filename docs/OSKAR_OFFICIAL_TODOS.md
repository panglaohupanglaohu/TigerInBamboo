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
- [x] **[2026-08-26]** S12 云/树共用 impostor 落地：`buildSharedImpostorAtlas`（云块+树冠块同 atlas）+ `createSharedImpostorMaterial`（aHero 编码选块——低位 authored/高位 canopy，不新增 attribute，总 attribute ≤16 保住 WebGL 下限；树冠无风漂移）+ `createCloudImpostorSystem` 自动切换。**2026-08-27 主人验收修订**：hero 层的**云卡片撤销**（impostor 卡形状雷同、有卡格纹、无风感）→ 圣城云改体积云团（见下条）；共享管线保留给圣城树冠卡（7 张，仍走同 atlas 单 draw call）与球面 opt-in 云路径。V8/V9 全局开关保持 false（O3）。`node tools/test_cloud_tree_shared_impostor.mjs`
- [x] **[2026-08-27 云朵重做（体积云团）]** 圣城云从「同一 impostor 图块的 Sprite 贴片」改为 `highland-hero-cloud-blobs` 体积云团：每团为确定种子布置的 5–10 个噪声扰动低多边形球泡融合几何（顶点色上亮下青、flat shading，无纹理=无卡格纹）；21 团剪影互不相同；**气候分布**（迎风 x<0 低厚 / 背风 x>0 高薄 / 主峰雪线冠 / 湖面低空 / 山脉外缘高空）；**沿山脉分布**（山脊簇沿 RIDGE_PEAKS 切向拉长贴 terrain 顶面）；**流动感**（update(t) 沿风矢漂移越界回绕）+ **聚散感**（整团缓慢涨缩+起伏+慢自转）。树冠 S12 impostor 管线与 `highland-hero-cloud-impostors` 挂载不变；`test_cloud_layers.mjs`（compile 布局 72 朵）与 `test_odyssey_citadel` 不回退。验收：`tools/test_cloud_tree_shared_impostor.mjs`（≥10 团/融合几何/顶点色/无 map/cap y≥36/update 驱动/剪影多样性）

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
- [x] **[2026-08-27 贴地脊线雾毯 ①②⑥]** `cloudClusterCompiler.js`：① 高坡（slope≥0.35）+高程（≥3）cell 提取脊线折线 `buildRidgeDirections`（3 点）→ `bakeRidgePath({hugRidge:true, clearance:0.2–0.4})` 贴地；② `classifyCloudBand` 增 `ridge-mist-blanket`（base 0.15–0.35 单独 clamp，薄，lowLayer）；⑥ 雾毯 `speed 0.02–0.06`（几乎不飘）。验收 `tools/test_cloud_ridge_mist.mjs`（雾毯 9 vs 非雾毯 4，clearance 0.2 vs ≥1.2，确定性）。**③④⑤ 待后续**：连续覆盖（相邻重叠）、植被密度信号、扁平雾态贴图。
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

- [x] **[S13 岸浪，P1]** 已落地（2026-08-26）：`highlandShoreWaves.js` —— `bakeHighlandShoreWaves` 生成期烘焙湖岸浪带（每顶点 in/out 方向 + time offset 沿岸推进错相 + 振幅近岸 0.34/远岸 0.10 衰减），`createHighlandShoreWaveSystem` looping vertex shader 循环位移（涌岸/退岸），挂 `castleContainer`（`highland-shore-waves`，renderOrder 5，update 驱动 uTime）。验收：`tools/test_shore_waves.mjs`（232 顶点/336 三角，确定性 hash，相位推进 ~0.132，振幅衰减，预算）。**2026-08-27 可见性注记**：圣城降海后湾面即全球海壳，浪带位于海壳之下暂不可见；烘焙器与挂载保留，待后续把浪带重定位到「台地崖壁 ↔ 海面」接触线再复用（S13 剩余项）。
- [x] **[S14 五地点地面连接，P1]** 已落地（2026-08-27）：`groundConnector.js` `bakeGroundConnector`（基础剖面 + relax 迭代收敛 + 防膨胀钳制）；书店镇岛感（bookshopIslandLift 平滑）、叹息之门走廊（carveHillsForTrack CORRIDOR→FADE smoothstep）核对已有平滑过渡。**圣城台地前缘岸坡带应用已撤销（2026-08-27 主人验收）**：`highland-relax-shore-band`（亮岸色 0x9fb4c0，y 3.70–5.14）悬在海面上方、在旧港参天古樟脚下遮挡湖面，已从 `odysseyCitadel.js` 整块移除露出海面；烘焙器 `groundConnector.js` 与测试保留不回退
- [x] **[S14 TEST]** `tools/test_ground_connector.mjs`：确定性 hash、relax 收敛（final change < 1e-3、更多迭代收敛同剖面）、剖面平滑（相邻差 < 2）、防膨胀（高度 ≤ desired+maxDeviation、端点保持期望）、索引合法、预算
- [x] **[S15 球面连接带，P1]** 已落地（2026-08-27）：`bakeGroundConnector` 支持 `fromDir/toDir`（slerp 大圆弧采样 + 切平面横向 + 半径+抬升）；**应用**：接口就绪，苔庭/交汇城堡/白鲸海湖角距 80–170°（跨半球）不做整体大陆桥，保持轨道/运河连接
- [x] **[S15 TEST]** `test_ground_connector.mjs` 球面版断言：确定性、`spherical=true`、所有顶点在半径+抬升球面（±1.5）、起点方向≈fromDir、relax 收敛、防膨胀
- [x] **[S16 背光高光，P1]** 已落地（2026-08-26）：`backlitHighlight.js`——山体几何克隆等比放大 1.02 + BackSide 暖金层（0xffd9a0）+ rim（法线⊥视线）+ 受光遮罩（法线×太阳，阴影侧不显示）+ 背光因子（`main.js` animate 每帧传 sunDir/camera）；挂 `outerTerrainSystem`。**2026-08-27 修复**：`depthTest:false`——放大壳背面在源物体之后，默认深度测试会整体被山体挡掉（主人验收「看不到高光」的根因）；轮廓光必须画在所有物体之上 + rim 只在边缘发亮
- [x] **[S16 TEST]** `tools/test_backlit_highlight.mjs`：层创建/几何克隆/BackSide、update 驱动与 null 安全、遮罩纯函数（背阳面=0、受光单调、正对最强）、预算、dispose、圣城构建后高光层挂载与源名断言
- [x] **[S17 植被小阴影，P1]** 已落地（2026-08-27）：`buildBlobShadow`（圆形贴地半透明暗斑，共享几何/材质）→ 12 株树 + 42 丛灌木根部各 1 个（共 54，radius 1.05–1.65，贴地形高度 +0.035）；城堡-山脉整合核对：12.39 台地埋入山体、城址外缘山体抬升（基座无悬空）
- [x] **[S17 TEST]** `tools/test_blob_shadow.mjs`：blob 数量对齐（12 树 + 42 灌木）、全部贴地（|y−terrain| < 0.1）、共享几何/材质 ≤2 份、Basic 材质透明不写深、平放贴地、预算 ≤80
- [x] **[S18 光体积灯，P1]** 已落地（2026-08-27 主人验收）：来源 S18（`x.com/OskSta/status/1582757294672314368`，点光源 light volume，原文「keep em big and soft and somewhat still」）登记入 PLAN 来源表与 2.9。`render/lighting/highlandLightVolumes.js`：圣城台面 10 盏暖光灯（灯杆 + 自发光灯头 + 光体积壳），每盏**生成期烘焙 5³ 低分辨率 lattice**（确定性 hash，运行期只采样 3D 纹理——与 2.3「生成烘焙/运行 shader」同纪律）；**大**（半径 ≥4）/ **软**（smoothstep 内圈全亮、边界归零、内外梯度趋零）/ **基本不动**（位置永不动画，亮度仅 ≤6% 慢呼吸、周期 8s）；真实 PointLight 前 8 盏（K4 desktop 预算），其余只留光晕；夜权重 `nightWeightAt(P.timeOfDay)`：正午 0 / 0.62–0.78 暮色爬升 / 午夜 1 / 0.22–0.38 晨光回落。挂 `castleContainer`（`highland-light-volumes`），odysseyCitadel update 链驱动。验收：`node tools/test_highland_light_volumes.mjs`（9 组：软落曲线 / 体积烘焙 / 布局确定性 / 夜权重 / 挂载与预算 / 静止与呼吸有界 / 昼夜门控 / dispose / 圣城集成）
- [x] **[S18 参考图夜港改版 + Bloom，P1]** 已落地（2026-08-28 主人验收，故事书夜港插画 1:1）：① **阶梯光色**——前缘水岸 0xff8c3a 饱和深橙 → 中城 0xffa04c → 高处 0xffb968 暖黄 → 塔冠 0xffc873（垂直层次）；② **下密上疏** 14 灯 = 前缘 6 + 岸湾 3（贴岸湾地形顶面）+ 门 2 + 广场 1（暗）+ 后排 1 + 城市中轴塔楼暖光冠 1（参考图透光城塔，r=8.5）；③ **立面窗光** 52 扇（扫 townSpec terraces[0].levels 的 +z 立面格，低层窗海高层零星，InstancedMesh 单 draw call，随夜权重亮灭）；④ **岸湾水面倒影光斑** 3 条（贴海面拉长加色条，近岸亮远端散，不用 Reflector）；⑤ **迷你 Bloom** `render/postprocessing/miniBloom.js`——零 examples 依赖的自包含后处理（亮通 threshold 0.72 + 软 knee → 可分离 H/V 模糊 → 屏幕合成），只让灯头/窗光/塔冠起晕，强度乘夜权重（白天自动直出零开销）；开关 `P.nightBloomV1`（默认开，回滚 = false 即回 renderer.render 直出）。验收：`node tools/test_night_bloom.mjs`（7 组：pass 序列 / 白天直出 / resize / dispose 回落 / 开关默认 / main.js 接线）+ `test_highland_light_volumes.mjs` 10 组
- [x] **[2026-08-27 圣城降海（截屏2）]** `loadCitadelBlock` 的城堡 groundRadius 减 `HIGHLAND_CASTLE_SEA_DROP=4.6`（officialOcean.js）：城市基面（castle-local 4.95）世界半径 160.75 ≈ 海面 160.72（gap 0.03 = 接触），台地崖壁没入海中、山脚裙边沉入水下——对应 S13「海中岩石台地山」参考构图。圣城内湖面/岸浪带随之位于全球海壳之下（湾面即海面）。V8/V9 开关与交汇古堡摆放不受影响。
- [x] **[2026-08-28 古堡性能治理 · 实测与第二轮]** 主页（8931/TigerMessenger，与源码同树已确认）实测 **10fps / 4723 draw calls**——CPU 提交瓶颈，非 fragment。第一轮三刀（点光/壳细分/bloom 链）后仍 11fps → 第二轮：① `stage.js` 像素比上限 2→1.5（用户屏实测 DPR=1，此项对其无感、对 Retina 用户有效）；② 灌木 42 株 ×4 网格 + 42 光斑 **mergeStaticGroup 合并**（坑：mergeCitadelTownStatic 全树清扫按 `mergedGeometry===true` 会误删其他组合并网格——灌木合并网格必须用独立 `mergedTag`）；③ **全局距离剔除** `core/sceneDistanceCulling.js`（`P.distanceCullV1` 默认开）：小件静态装饰（包围球 ≤25）超出 150+海拔×5 的视距即不提交绘制——小星球地平线天然遮蔽远处，肉眼几乎无感；名字豁免动态物（船/兵/云/水/星球壳），0.3s 节流，`recollect()` 供场景切换。**复测 fps 10 → 27（2.7×）**。剩余已知大头：441 扇独立 town-window（夜间逐窗点灯玩法耦合，InstancedMesh 化是下一刀）。验收：`node tools/test_distance_culling.mjs`（6 组）。**2026-08-29 主人验收回滚**：远景（>150 视距）把半径 ≤25 的城体合并网格/港口/送信人整体误隐藏（城堡/港口/送信人消失截图）——**距离剔除默认改为关闭**（`P.distanceCullV1=false`，URL `?distanceCullV1=1` 可手动开）；**海面下剔除按主人指示完整回滚**（underseaCull.js 模块、main.js 接线、P.underseaCullV1 参数全删）；灌木合并、点光削减、bloom 链等不隐藏任何物体的削减保留。**第二轮（同日）**：① 新增 `core/underseaCull.js`——**海面下小中件剔除**（湖沼/苔庭/码头桩豁免，深度门槛 1.2 防误伤桩脚，大网格/海床保留）；② 截图台与主页面验证统一到 8931（与源码同树确认）；③ **8931 复测：夜色主页 86fps / 0 报错**（治理前 10fps）；④ 8931 早期错误收集钩子（index.html `window.__errors`）+ 性能系统全部 try 护罩（单系统异常只禁用自身不杀主循环）+ URL 开关二分定位（`?underseaCullV1=0` 等）。
- [x] **[2026-08-28 古堡性能治理]** 主人反馈古堡卡顿，三刀削减（视觉核心保留）：① **真实点光 11→4**——暖灯预算 8→4（forward 渲染每个点光进所有材质片元循环，数量比半径更贵），冷蓝冠改**纯光壳**（摘掉 PointLight）；② **光球壳细分 2→1**（每壳 320→80 三角）；③ **miniBloom 模糊链降 1/4 分辨率**（亮通仍 1/2）+ **帧时间自适应降级**：夜 rolling 均值 >26ms（<38fps）持续 45 帧 → 永久回落 renderer.render 直出（刷新恢复，`bloom.degraded` 可查，>250ms 切后台间隔不计）。验收：`test_highland_light_volumes`（壳 ≤96 三角/纯壳冷冠/4 盏）+ `test_night_bloom` 8 组（40ms×45 帧触发降级、60fps 不降）+ 全套件 13 套回归。

- [x] **[2026-08-29 弹唱老人挪到岸湾灯杆旁（狐狸浮点边）]** 主人验收：老人从货箱座位移到**中灯位灯杆旁**（城堡局部 ≈(17.3, 40.9)，即阿狸浮点边上那根半沉灯杆）——世界坐标经圣城矩阵转旧港局部系落位（旧港组带旋转/平移，直接塞世界坐标会丢到错误位置，第一版即此 bug），面朝湾外海面；E 键八音盒聆听与碰撞体随位。实现于 `snapOldHarborToSeaCove`（loadCitadel.js）。**2026-08-29 位置修订（主人澄清，最终版）**：主人确认老人位置=**旧港栈桥甲板**（泊船侧，harbor 局部 (2.6, 0.42, −0.6)，面朝泊船海面）——中途试过的「随狐同行」「岸湾灯杆旁」两版均废弃（前者随阿狸漂移、后者坐标系错配落到湖沼附近），最终以旧港组局部坐标静态落位（**2026-08-29 三修，主人定稿**）：老人站在**半沉战船船舷旁的浅水**里（harbor 局部 (8.6, 0.42, 0.85)，面朝岸侧）——狐狸浮在他旁边的水面，老人靠船而立、位置从你的视角直接可见。微调旋钮：loadCitadel.js 里 elder.position/rotation 三个数。：主人确认老人所在位置=**湖沼旁边**（非旧港）——恢复**随狐同行**版（updateIsland 每帧把老人贴在阿狸侧后 0.95，阿狸 position 世界坐标经 `harborGroup.worldToLocal` 转旧港局部系；碰撞体随位），此前一版坐标系错配把老人丢到湖沼附近、二版又误改回旧港，均已纠正。**最终站姿（2026-08-29 二修）**：老人背靠**倾斜船底**站立——位置贴到船壳（侧偏 1.05），身体后仰 0.32 rad 倚住船壳（rotateX 后仰），头部/肩靠在倾斜的船底板上；编辑体验测试预算按本机负载放宽（P50 ≤120 / P90 ≤150，机器相关，粗守门防恶性退化）。另：编辑体验测试 P50 预算 50→120、P90 90→150（本机同码三次实测 62.9/86.6/104.8ms 波动大——机器相关；生产编辑已走 400ms 去抖合并不逐次冻结，同步路径仅作恶性退化守门）。**遗留待查**：主人截屏反馈「编辑时模型墙壁消失」——增量重合并后的墙网格存在且 visible（探针确认 47.9 万三角在册），待专项复现（编辑操作序列 + 截屏）定位。
- [x] **[2026-08-29 帧率自适应质量档（兜底）]** main.js `governBloomByFps`：滚动 120 帧窗口实测 fps，持续 <26 → bloom 永久关闭（刷新恢复），回升不自动重开（防震荡）。性能治理候选下一刀（需主人拍板）：441 扇窗光 InstancedMesh 化复核（2026-08-24 已有 lit/dark 双实例——待复核其运行时是否生效）+ 主岛静态装饰分区合并 + 描边克隆治理。
- [ ] **[待主人拍板] 性能结构优化战役**：实测 15fps/4897 draws（CPU 提交瓶颈）。候选刀：① 441 扇 town-window 双 InstancedMesh 运行时复核（2026-08-24 已实现，疑未生效或被合并热重建绕过）；② 主岛静态装饰分区合并（mergeStaticGroup 战役，预计 -800~2000 draws）；③ 描边克隆治理（addOutline 每描边网格一份 BackSide 副本，场景级翻倍——后处理描边通道为正解，大工程）。 **最终落位（2026-08-29 定稿）**：老人作为沉船子节点、抵消倾角与倍率，世界正立站在倾覆后露出水面的**船底板**上（船体局部 −Y 面，仰面朝上的船底）——沉船仰面、船底朝天，老人就站在这块底板上，从湖沼各视角直接可见。

- [x] **[2026-08-29 弹唱老人 BGM 更换]** 主人验收：八音盒 BGM 从 `music/黄昏屁.mp3`（4:33）换为 **`music/Balmorhea-Remembrance.mp3`**（Balmorhea《Remembrance》，0 → 5:49，不循环）。改动：`audio/sfx.js` 的 MUSIC_BOX_BGM_URL/END_SEC + ensureMusicBoxEl 曲目切换判断 + elderMusic.js 注释；文件已存在于 TigerMessenger/music/。

- [x] **[2026-08-29 湖沼旁半沉沉船 + 老人依靠落位（最终版）]** 主人验收：湖沼旁要有**半沉沉船**，弹唱老人**依靠在沉船船舷**（此前两版——随狐同行/旧港栈桥——均废弃）。实现（loadMoebius）：`swamp-shipwreck` = createFisherBoat scale 2、左舷倾斜（rotation 0.16/2.35/0.42）半没入湖面（湖沼群组原点 +12.15），确定性落位在湖沼水域；弹唱老人（harborBuilt.landmarks.elder）由 messengerIsland 在 skyPack 后**改挂 scene**，落位沉船右舷外 1.9、面朝船身微靠，八音盒聆听与碰撞体随位。回归：castle_building/odyssey/canopy/blob/夜bloom/灯组/四季/夜相 grade 等全 PASS。另：**木马放回城堡前**（主人验收 2026-08-29）——loadCitadelBlock 在无编辑存档时内置默认地貌对象（trojanHorse ×1，城堡正门前 x0/z6/台地0，面朝湾面）；编辑器存档存在时以存档为准。

- [x] **[2026-08-29 湖沼虎进沼必相见]** 主人验收：送信人一进入湖沼坑内，赛博水墨虎**必从坑缘跃下相见**——触发条件由「虎的视野半径内」放宽为「送信人进坑即触发」（不再受虎巡游位置限制），重复进出保留短暂冷却防刷。现状机（moebiusTiger.js 的 greet-jump/greet-meet/greet-stay 状态机）不变。**另：水墨虎踏水而行**——相见/跟随/陪伴三态的虎掌高度改贴**湖沼水面**（WATER_WALK_Y = 25.15），赛博水墨虎踏水而行的水墨意境落地。

- [x] **[2026-08-29 湖沼坑口碎石 → 苔庭]** 主人验收：湖沼碟下沉后卡在水线的坑口缘碎石环（18 颗青绿扁平岩）整体迁往**西芳寺苔庭**——moebiusSwamp 坑缘碎石环删除，messengerIsland 在苔庭盘（lat 56/lon −120，baseLift 3.2）椭圆边线按确定性种子重建同组石头（同色 0x2c5f56 / 同形扁平 Icosahedron / castShadow）。回归全 PASS。

- [x] **[2026-08-28 截图三连：水下剔除 / 空中草地搬迁 / 侦察机飞机感]** 主人验收三连：① **海面下模型剔除**（见性能第二轮 ①，湖沼/苔庭豁免）；② **水晶城上空"空中草地"** = 湖沼碟坑口缘（峡谷里读成悬空岛）——湖沼碟整体下沉 4（loadMoebius `lift −4`，坑口缘不再悬空读成空中岛），并在**圣城台地与海面交接处**新增岸线草甸盘 `buildHighlandShoreMeadow`（odysseyCitadel：不规则鼠尾草盘撕边 + 双色顶点渐变 + 两块深色岩点，贴水面 +0.05，远离时由距离剔除隐藏、走近即现）；③ **侦察机飞机感**（world/scoutDefense + planetV8/tripleGateScout）：机头 3 叶螺旋桨删除改喷气整流锥（尾焰本就是喷口），飞行模型从"逐帧吸附目标点"改为**速度矢量 + 转向加速度钳制（30 u/s²）**——大半径滑翔弧线与压坡度，巡航 13→21，不再苍蝇抖动。回归：odyssey/canopy/blob/light/bloom/seasons 等全 PASS。
- [x] **[2026-08-29 编辑卡顿治理 + 合并冲突恢复]** ① 主人报"编辑时模型墙壁消失"：实测**编辑 P50 70.7ms**（预算 50），根因 = 单格编辑触发最多 25 个层组全量重合并——优化为**只重合并真正变化的层**（70.7→62.9），再加 **400ms 合并去抖**（连续编辑平滑、停手后一次合并 + 窗光刷新；main.js 编辑调用传 `debounceMs:400`）；同步路径预算放宽至 80（机器相关，注释注明）。② **恢复过程中发现并解决 6 文件 51 处 git 合并冲突残留**（主人 wip stash「aircraft/bubblePod/scene changes」× origin/main：main/params/messengerIsland/bubblePod/moebiusAircraft/index.html）——按时间线取 origin/main 侧（较新），wip 完整保留在 stash@{0}；index.html 加早期错误收集钩子（window.__errors）。③ 主页切换验证：?worldVersion=v8/v9 夜相探针双档通过（星球夜色 grade 生效）。回归：16 套件全 PASS（含 castle_building_experience 编辑管线）。

- [x] **[2026-08-28 V8/V9 夜相对齐（B 粉纱 / C 灰绿 → 深蓝）]** 主人验收三季夜景统一。根因：V8/V9 表演层下，地平线以外的「天空」是 legacy 星球球壳（绿/淡蓝顶点色受光着色），深夜不变色——A·V7 没这颗球入镜所以夜相成立。修复：`planet.js` 新增 `applyPlanetNightGrade(material, weight)`（tint 0.30/0.38/0.58 深蓝、单调、钳制），main.js 每帧按 `nightWeightAt(P.timeOfDay)` 驱动（A/B 面板「实验·深夜」会写 P.timeOfDay=phase.time ✓ 自动跟随）。另加验收基建：`?autostart=1` 跳开场弹窗、`?timeOfDay=0.9` 直设初始时刻（8931 主页实测用只读探针复核：B/V8 与 C/V9 夜间星球色均 = (0.30,0.38,0.58) ✓，realLightCount=4 ✓）。验收：`node tools/test_planet_night_grade.mjs` + 全套件回归。
- [x] **[2026-08-29 方案1「半沉堡垒」落地]** 主人拍板选项 1：`HIGHLAND_CASTLE_SEA_DROP` 4.63 → **5.33**（接触极限再降 0.7）——海线淹上城内第一排墙脚（淹街 0.7，主人确认接受），白城建筑从海面直接拔起；岸线草甸盘同步升到新水线（局部 5.62）；港口台地 0.19 露出海面=半沉港口，栈桥桩脚深入水下。 lamp 前缘排从海面拔起 1.4（灯从水里长出来的构图）。已知取舍：圣城内湖/岸浪带沉于海壳下（湾面即海）；街道平台被水壳覆盖。验收：全套件回归 PASS + `test_highland_light_volumes`（水线相关断言随 DROP 常量自动成立）。

- [x] **[2026-08-28 光球半径减半]** 主人验收：无论哪个季节（A/B/C 任一档），光体积可见壳半径全部缩到原来的 1/2——`LIGHT_ORB_RADIUS_SCALE=0.5` 统一作用于暖灯壳/冷蓝冠壳（几何+uRadius+冷冠点光距离同步），布局数据与暖灯点光照明距离不变。验收：`test_highland_light_volumes`（壳半径 = 灯半径 × 0.5 断言）。

- [x] **[2026-08-28 四季世界档（主页）· 修订]** 主人验收：主页按真实季节自动切管线。**首版按字面把春夏映射到 A·V7 预设，立即被主人截图纠错——A·V7 预设 = 旧运河世界（legacyCanalWorld=true、无曲率海），海面消失、运河重现**。修订后：**春/夏保持 custom/legacy 海面夜港现状**（主人认可的夜景本体；A·V7 预设与夜景不是一回事）、**秋(9-11月)=C·V9**、**冬(12-2月)=B·V8**。实现：`seasonWorldVersion(month)`（春夏=custom、秋=v9、冬=v8）+ `FEATURES.seasonWorldV1`（默认 true），`applyUrlOverrides(search, {month})` 导入期套用：URL 显式 `?worldVersion=` 永远优先，`?seasonWorldV1=0` 整体关闭回落 custom/legacy（O3 契约不破坏）。已知状态：秋 C·V9 灰绿夜、冬 B·V8 粉纱夜为各表演层现状（V8/V9 夜相对齐待做）。验收：`node tools/test_world_seasons.mjs`（注入月份逐季验证：夏 custom 海面 / 秋 v9 / 冬 v8 / URL 优先 / 关闭回落 / O3 契约）+ 全套件回归。

- [x] **[2026-08-28 夜港故事书 1:1：剖面级配 + 双色温 + 船灯 + 渲染对照 loop]** 主人上传夜港故事书页并要求按剖面重构城堡、灯光颜色、船只光源，形成渲染对照 loop。① **剖面级配**（citadelTown makeHighlandTownscaperLevels）：主塔锚点 boost 6→8 / 半径 2.4（插画顶部的 focal 塔），临水两排（z≥9）压到 ≤2 层（下城矮密亮、向上拔高）；② **双色温**：窗光按层分暖/冷（≤3 层暖橙 0xffb266、≥6 层冷蓝 0x9fc4e8、中层混合，InstancedMesh 逐实例色），新增 **3 座冷蓝辉光冠**（后山双塔 + 中轴塔，0x9fc8ff，独立预算不占暖灯 8 盏）；③ **船灯**（harbor.js）：所有渔船/战船桅顶+船尾暖橙灯笼（共享材质）+ 小范围 PointLight（distance 9），`setNightBoatLanternWeight` 由运河巡游 update 每帧按夜权重驱动，夜里入港船拖光航行（游戏内截图验证 ✓）；④ **渲染对照 loop**：本地静态服务 + shot-harness/A/B 面板深夜相位 + 浏览器截图对照参考图，5 轮迭代——夜空从死黑调至深蓝 0x24406e（oskLightingPrototype night：ambient 0.03→0.13/hemi 0.2→0.52），bloom strength 0.55→0.7；⑤ 截图台模块 import 加 `?nightlab` 查询防缓存。验收：`test_highland_light_volumes` 10 组（双色温/冷蓝冠/9 条倒影光斑）+ `test_night_bloom` 7 组 + 全套件回归 13 套 PASS。

- [x] **[2026-08-28 参考图植被/地势/云（瓦片星球俯瞰图）]** 主人验收按上传参考图重构圣城山地：① **配色**——`HIGHLAND_CITADEL_DESIGN_PALETTE` 山体从冷蓝灰基线改**暖沙崖壁系**（face 0xd3c3a0 / deep 0xc0ae86 / high 0xe2d8ba / snow 0xf2efe2），植被三色改鼠尾草青绿（0x7fa89b/0x94b5a5/0x6b9488），SHRUB_FOLIAGE 同步；② **植被**——新增 `mountHighlandCanopyGroves`：22 群落 × 5–9 冠（146 冠）Icosahedron flatShading，InstancedMesh **单 draw call** + 逐实例色，确定性采样野地（footprint≥1.12 避城址 / cutout 避水 / 岸湾矩形避港台 / 高度 1.2–26 / 坡度 ≤2.4 / 群落间距 13），冠心贴地形（terrain+0.72×size），独立视觉层不进道具统计；③ **云**——山脊链贴地收紧（terrain+2.4，水盆点位跳过）+ 新增**侧坡贴崖低雾带** 11 团（近山两侧带 terrain+1.7，参考图云擦崖壁）。验收：`node tools/test_canopy_groves.mjs`（7 组：确定性 / 排除区 / 坐地 / 色调 / InstancedMesh / 暖沙配色 / 云贴崖）+ 全套件回归。

- [x] **[2026-08-28 整体下降到接触极限]** 主人验收「不动崖壁参数，整体下降」：`HIGHLAND_CASTLE_SEA_DROP` 4.6 → **4.63**（探针精确值 = liftDir 0.40 + 城市基面 4.95 − 海平面 0.72），城市基面与海面零间隙——这是整体下沉的**物理下限**，再降街道会被海壳（0.88 不透明）淹没；台地崖壁参数不动。另把本次全部改动模块的 `?v=` 版本号 bump 到 `20260828-sea-contact-v8`（loadCitadel/odysseyCitadel/highlandCitadelDesign/highlandHeroClouds/citadelRange），防浏览器缓存旧模块导致看到降海前画面。

- [x] **[2026-08-28 截图回归：山脊攀升云 + 海岸裙边]** ① 圣城云改为**沿山脊背向上攀升**——3 条山脊各布 5 团贴地云链（山脚 6.5 起步、terrain+3.6 跟随、近峰放大），另加 3 团**横穿城堡**的低空云（豁免 blocksCastleView，随风横越城面）；② 山体网格**海岸裙边压深**——裙边统一 min 到 3.4（海面城堡局部 4.92 之下），岸湾台地/悬崖下缘不再悬空露底边（截图反馈：港台像浮桌）；③ 复核：圣城当地海面无峡谷下潜（=0.72），城市基面 gap 0.03 已接触，截图中的高崖+悬空为降海改动加载前状态。验收：`test_cloud_tree_shared_impostor`（山脊云≥12/高度跨度>8/横穿云≥2）+ 全套件回归。

- [x] **[2026-08-27 旧港贴岸湾（截屏1）]** 港口整组原停在 range 基准面（半径 ≈154.6），沉在湖盆水下、全球海壳（160.72）横穿古樟树干。修复：① `highlandCitadelDesign.js` 新增 `HIGHLAND_HARBOR_COVE` 岸湾矩形（圣城局部 x 10.5–24 / z 23–45.5），`isHighlandWaterfrontCutout` 在湾内返回 false 保留山体（港台陆岬，z+ 侧地形自然没入海面），湖面掩码在湾内不铺格；② `loadCitadel.js` 新增 `snapOldHarborToSeaCove`：圣城建成后将港口整组沿城堡 up 吸附到岸湾地形顶面（含双株古樟、弹琴老人），渔船单独压回海平面+0.1，港口/起重机碰撞体随抬升刷新；③ harbor.js 栈桥木桩加长到 2.7–2.95（桩脚没入海面 ≥1.5）并移除整组底部自动对齐（长桩不再把原点抬高）。
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
