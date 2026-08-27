# Oskar 官方方法计划

> 状态：2026-08-26 起草。本文件只记录 **Oskar Stålberg 公开说过 / 公开展示过** 的方法，以及这些方法在 Tiger Messenger 里还缺什么。
>
> 它不是 `TigerMessenger/PLAN.md` 的替代件。PLAN.md 第十章以后是本项目工程推导（文件名、开关、阈值、目录拆分）。两边冲突时：
>
> 1. **方法与术语** 以本文件为准；
> 2. **本仓库怎么接线、怎么测** 以 PLAN.md / TODO.md 为准。

## 0. 证据规则

每一条结论必须落在三栏之一，禁止混写。

| 栏 | 含义 | 写法 |
| --- | --- | --- |
| **来源事实** | 帖子原文、演讲标题/可核页面、Oskar 自己的说明 | 附 URL |
| **画面归纳** | 只从公开 GIF/视频画面读出的行为，Oskar 未必用过这个词 | 标「画面归纳」 |
| **项目推导** | 为 Three.js / 本仓库发明的类型名、开关、阈值 | 标「项目推导」，不得写成 Oskar 原话 |

禁止事项：

- 不得声称存在名为 **MFC** 的第三算法。公开资料与本仓库源码都没有这个名字。
- 不得把 Boris the Brave 的 [How does Planet work?](https://www.boristhebrave.com/2022/12/18/how-does-planet-work/) 写成 Oskar 逐字说明。它是二手逆向。
- 不得把「看起来像 Townscaper / Planet」当作完成证据。
- 不得因 PLAN/TODO 勾选就把 `DEFAULT_ON` 打开。

本地辅助报告（只作索引，不升级为官方原文）：

- `/Users/panglaohu/Downloads/oskar_stalberg_2023_2025_terrain_cloud_report.pages`
- `/Users/panglaohu/Downloads/oskar_stalberg_2023_2025_terrain_cloud_report2.pages`
- `/Users/panglaohu/Downloads/Oskar_Stalberg_工作分析报告2.pages`

## 1. 官方来源

| ID | 来源 | 能核什么 |
| --- | --- | --- |
| S1 | [主网格 / 对偶网格](https://x.com/OskSta/status/1448248658865049605) · [镜像](https://threadreaderapp.com/thread/1448248658865049605.html) | 玩法、碰撞、导航留在 **main grid**；terrain 这类 field 放 **dual grid**；两套拓扑同时保留 |
| S2 | [不规则四边形网格](https://x.com/OskSta/status/1147881669350891521) | 三角随机配对 → 细分四边形 → relaxation，得到可平铺的有机 quad |
| S3 | [WFC 失败与可视化](https://threadreaderapp.com/thread/1448039167057879048.html) | 失败要快、可复现；可视化执行过程会暴露 bug；并行会暴露非确定性 |
| S4 | [混合网格与稀有模块](https://threadreaderapp.com/thread/1670790425232175108.html) | 混合网格比单一三角/六边/方格更适合目标模块库；模块必须按该网格制作 |
| S5 | [草地 contrast / depth](https://threadreaderapp.com/thread/1590669875869286400.html) | 草 billboard 在 vertex shader 里采样 contrast；轮廓在草与悬崖/天空交界增强、草内部减弱 |
| S6 | [Beyond Townscapers](https://www.youtube.com/watch?v=Uxeo9c-PX-w) | 演讲存在（SGC21）。PLAN 所称「约 46 分钟 voxel AO 切片 atlas」在本仓库的字幕抓取中 **未能核到原文**，见 `TigerMessenger/docs/lighting-v5-research.md` |
| S7 | [How Townscaper Works](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making) | 手工模块 + 受约束组装；合批减 draw call；窗洞用 stencil 从网格挖除（访谈转述） |
| S8 | [Bad North 访谈](https://medium.com/subpixelfilms-com/a-minimal-brand-of-madness-oskar-st%C3%A5lberg-and-richard-meredith-on-the-development-of-bad-north-514d5cf1a7a1) | 战术复杂性藏在单位与地形关系里；输入保持高层、结果保持可读 |
| S9 | [Technically Art 129](https://halisavakis.com/technically-art-issue-129-14-10-2022/) | Oskar 原文：此前 GI 是 naive ad hoc color bleeding；2022-10 才第一次像样地做 light **bounce** |
| S10 | [80.lv 转述](https://80.lv/articles/a-custom-lighting-solution-set-up-in-unity) | 该 bounce 实验用 SDF、3D textures、UV、depth-map shadows。**不等于** Townscaper 发售版运行时 |
| S11 | 2023–2025 公开地形/云画面（见本地 pages 报告） | **画面归纳**：层级平滑保留硬边；云团 impostor 叠放造云海；生成阶段烘焙、运行阶段 shader |
| S12 | [蓬松云 shader 与树共用 impostor](https://x.com/OskSta/status/1852334860137849222)（2024-11-01） | 原文：*A fluffy cloud shader. It is using the same impostors as the trees.*——**云与树共用同一套 impostor 管线/代理资源**；云是蓬松软边 shader，不是独立体积云模拟器 |
| S13 | [高山圣城岸浪展示](https://x.com/OskSta/status/1991099314714902634) + [岸浪实现方法（回复）](https://x.com/OskSta/status/1991101097818403263) | 原文①：*Got some pretty sweet new shore waves going*（海中岩石台地山的岸浪视频，缩略图证据：中央暖棕岩石台地、四周深蓝海、外缘岸线过渡带）；原文②：*It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset.*——**岸浪 = 生成期烘焙 + 循环顶点 shader**；每顶点 in/out 方向与时间偏移 |
| S14 | [relax pass 防蘑菇化](https://x.com/OskSta/status/1769641473895432220)（2024-03） | 原文：*In cute tile based planets like this you often get a "mushrooming" issue where tall mountains get weirdly wide. I managed to mitigate this by a relax pass where all module-containing cells try to achieve their desired shape and size. Note the cells on the top left contracting.*——瓦片星球高山会「蘑菇化」（越高越宽）；**relax pass：所有含模块的格子尝试达到期望形状与尺寸**（左上角格子收缩演示） |
| S17 | [纹理植被与城堡-山脉整合](https://x.com/OskSta/status/1707490932017279035)（2023-09） | 原文：*They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are.*——**植被 = 100% 纹理画在低多边形网格** + **小阴影** → 无需 billboard 已有体积感；视频画面（640×640 逐帧）：岩石山体（暖色）顶部草甸（绿）、城堡亮部**嵌入山体** |
| S16 | [背光高光](https://x.com/OskSta/status/1751945034851570056)（2024-01） | 原文：*Some nice new highlights when the island is backlit. Achieved by simply adding another inverted mesh outline layer that shows up when looking into the sun. And masked by shadows, of course.*——**背光高光 = 反向网格轮廓层**（看向太阳时显示）+ **阴影遮罩**（阴影区不显示） |
| S15 | [放到球体上](https://x.com/OskSta/status/1768627849529893109)（2024-03） | 原文：*For reasons I will not be explaining at this point I've gone and put this on a sphere*——把瓦片格子地形**放到球体上**；视频（640×640，6.9s）：海中的绿色格子陆地在球面上，曲率可见、视角旋转，陆地边缘有缺口/内凹。与 S14 同期同系列（球面格子星球） |

## 2. 官方方法（按流水线）

### 2.1 图，不是一张噪声高度图

**来源事实（S1, S4, S11）：** 不同数据住在不同图上。main grid 承载房屋、碰撞、导航、附加物；dual / terrain graph 承载场地、坡度、流域一类 field。两套拓扑共享部分操作，但顶点和三角形不是同一份。

**项目现状：** `geodesicMainGrid.js` / `geodesicDualGrid.js` 存在；V8 编译走 geodesic main/dual。生产开关 `planetTerrainV1` 等默认 **false**。默认玩家世界仍是球面切图上的手摆圣城，不是 V8 默认开启。

### 2.2 手工模块 + 受约束生成，不是纯随机

**来源事实（S3, S4, S7）：** Townscaper 核心是少量输入 + 手工模块 + 程序化组装。WFC **不擅长** 长、窄、有方向的结构（尤其河流）。失败必须可解释，不能靠无限重启。

**项目现状：** 城堡侧有 Townscaper 单元目录、socket、WFC/约束求解（V6/V7）。球面侧有 `sphericalWfc.js` + hard pins。河流/岸线仍有「后处理补丁」痕迹；V10 水文/气候/生态已接入生产 compiler（opt-in），默认世界未启用。

### 2.3 生成阶段烘焙，运行阶段只动 shader

**来源事实 / 画面归纳（S5, S11）：** 树的尺度吃 `forestness` 一类烘焙量，而不是每帧改 instance 数量。云是 fluffy impostor，instance 绘制；CPU 不每帧重建语义。海浪是 shader 里的线波/层波，不是每帧 Marching Cubes 造浪。

**项目现状：**

| 层 | 数据 | 运行时 |
| --- | --- | --- |
| 云 | `cloudClusterCompiler` 烘焙 fetch/lift/path；高山圣城另有 **本地戴帽云** | impostor 只更 `uTime/uWind/uWeather/uDay` |
| 海/湖 | 曲面 mesh + `waterData0/1` | shader 波浪；湖有 wake/ripple 缓冲 |
| 植被 | V9 compiler 读 `ecologyFieldV10` + InstancedMesh（opt-in） | 开关默认关 |
| 气候/生态 V10 | hydrology/climate/ecology 纯数据 | 云与植被编译器已消费；运行时仍 opt-in |

### 2.4 平滑与硬边同时存在

**来源事实 / 画面归纳（S1 镜像, S11）：** 目标可以同时有连续柔坡和清晰断崖；层级平滑修复接缝时 **不得抹掉硬边和材质边**。无出口的局部洼点应被抬走（排水）。

**项目现状：** field 有 snow massif / rift / 瀑布缺口 / collar。最终场最高峰与剖面连续性已有脚本门。默认画面仍不是 V8/V9 全开。

### 2.5 草：对比，不是满屏黑描边

**来源事实（S5）：** vertex shader 采脚下与背景 contrast，差值控制轮廓。草内部低、与悬崖/天空交界高。

**项目现状：** `semanticTerrainMaterial` 有草语义色；contrast-aware grass outline 在 V9 有 shader 契约测试。默认高山圣城山坡另挂 **本地 billboard 草**（`highlandSlopeGrass.js`），不依赖 V8 开关。

### 2.6 云：代理，不是体积云模拟器

**来源事实 / 画面归纳（S11, S12）：** 蓬松云块 → 多角度 impostor；叠放制造云海遮挡；运动在 shader。**云与树共用同一套 impostor（S12 原文）**——代理资源、atlas 与渲染管线跨云/树复用，风格统一且不重复造轮子。

**项目现状：** Planet V8 impostor atlas 存在，默认关。高山圣城 **本地山脊** 已钉戴帽云/云海框（`highlandHeroClouds.js`），不依赖 V8 开关。球面 opt-in 气候抽样云已读 `climateFieldV10`。**S12 已落地（默认世界可见）**：`impostorAtlasBuilder.buildSharedImpostorAtlas` 把云块与树冠块烘焙进**同一个 atlas**（`cloud+canopy-shared-octa-impostor`），`createSharedImpostorMaterial` 用 `aHero` 高位编码逐实例选块（不新增 attribute，总 attribute ≤16），圣城山脚树冠与戴帽云在**同一个 InstancedBufferGeometry、同一次 draw call** 渲染；近景 12 株低模树保持真实几何（S12「近景几何、远景 impostor」分工）。V8/V9 全局开关保持默认关（O3），未强制打开。

### 2.7 海面不是第三种等值面算法

**项目推导（明确）：** 用户口头「Oskar 的 MFC」落实为：

```
main/dual grid → 手工/WFC 约束 → semantic field → MC 陆地/海岸/海床
→ 不规则静态水面拓扑 → GPU shader（swell / 泡沫 / 尾流 / 涟漪）
```

MC 只生成结构。浪是 shader。

### 2.7.1 岸浪：台地与大海的衔接面（S13）

**来源事实（S13）：** 原文① *Got some pretty sweet new shore waves going*；原文② *It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset.*

**画面归纳：** 海中一座棕色岩石台地山（缩略图 640×640：中央暖棕岩石台地，四周深蓝海，外缘有浅色岸线过渡带；视频逐帧未核对，缩略图 + 原文为证据）。台地与大海的衔接**不是一条硬边，而是一条岸浪带**——波浪沿岸推进、涌上/退下，是循环动画，不是独立粒子或物理模拟。

**项目推导：**
- 岸浪数据在**生成期烘焙**：岸线顶点的 `in-direction`（来浪方向）、`out-direction`（退浪方向）、`time offset`（错相）。
- 运行期一个 **looping vertex shader** 沿 in→out 循环位移；`time offset` 让相邻顶点相位错开，形成沿岸推进的浪。
- 与 2.7 的分工：MC 只生成结构；静态水面已有 swell shader；岸浪是**台地外缘专属**的衔接层——近岸振幅大、向深海衰减回 swell，**不引入第三种水面算法**。
- **高山-台地建立（画面归纳）：** 场景是一体的——居住台地嵌在岩石山体上，外缘没入海面。与本仓库 12.39「连续山地 + 台地平台埋入山体」方向一致；差异在衔接：画面有岸浪过渡带，当前仓库是台地下沉入水的硬边。
- **山脉与台地改造（2026-08-26，`highlandCitadelDesign.js`）：** 视频形态对照后曾尝试暖橙棕岩石配色，**主人验收后山体岩石配色恢复 2026-08-25 基线（冷蓝灰系）**；保留的形态项：**出城山体台阶化**（~1.6u 一级岩石台阶，城址外 1.02–1.30 平滑过渡，城址内保持水平承重面）。验收：`test_odyssey_citadel` 12 组。**山坡植被（2026-08-26）**：视频山坡有成片暗绿树丛（≈ 80–112,96–112,80，右下坡最密）→ 新增独立「山坡灌木层」`buildHighlandSlopeShrubs`（42 丛 × 4 圆冠低模丛，确定性散布在城址外山坡环带，避开湖面/城址/12 株低模树，不计入道具统计），挂 `outerTerrainSystem`。

### 2.7.2 relax pass：地形格子收敛到期望形状（S14）

**来源事实（S14）：** 原文见来源表。*relax pass* 是 Oskar 对瓦片星球「蘑菇化」的缓解——含模块的格子迭代尝试达到自己的期望形状与尺寸。

**画面归纳：** 海中的绿色格子大陆（视频 640×640 逐帧：前段绿色岛山 → 转场 → 后段大陆带中央内凹湖面）；左上角格子在 relax 过程中收缩。地形由格子单元组成，单元之间地面连续。

**项目推导：**
- **蘑菇化** = 连接/山体单元在迭代中异常膨胀（高度越高、宽度越宽）。
- **relax pass** = 每个地形单元朝「期望剖面」收敛：高度向邻居均值回归、宽度受期望约束，迭代 N 次后稳定。
- **应用**：高山圣城、交汇城堡、书店镇、叹息之门、苔庭五个地点当前是分离的岛/地标（角距 80–170°，跨半球不可整体连接）；落地为——① 主岛内地点（圣城/书店/叹息之门）与主岛地面生成 **relax 连接带**（高度剖面收敛、防蘑菇化）；② 岛感抬升平滑化；③ 远处地点（苔庭/交汇城堡）保持轨道/运河连接（已有交通网）。

**球面化（S15）：** 瓦片格子地形最终是**放在球体上的**（原文 *put this on a sphere*）。因此连接带分两版：
- **平面版**：主岛平面内（圣城台地外缘、书店镇、叹息之门走廊），`bakeGroundConnector(from, to, {fromHeight, toHeight})` 输出平面 XZ 地形带，relax 收敛高度剖面；
- **球面版**：远处地点（苔庭 lat 56/-120、交汇城堡、白鲸海湖）之间，`bakeGroundConnector` 扩展为 `fromDir/toDir` 输入——沿大圆弧采样，高度向球面（`localSphericalSurfaceOffset`）收敛，relax 同样防蘑菇化。

### 2.7.3 背光高光：反向轮廓层（S16）

**来源事实（S16）：** 原文见来源表。*inverted mesh outline layer* + *masked by shadows*。

**画面归纳：** 高山城堡在背光（逆光）时，轮廓出现暖色高光——暗色剪影边缘一条亮线，随镜头旋转移动；阴影里的轮廓没有高光。

**项目推导：**
- **反向轮廓层**：取山体/城堡几何，等比放大 1.01–1.03、`BackSide` 渲染、暖金色半透明——从正面看是边缘亮线（与 `applyInkOutlines` 深色描边互补）。
- **背光因子**：高光强度随「相机方向 × 太阳方向」动态——相机看向太阳（逆光构图）时最强。
- **阴影遮罩**：顶点按「法线 × 太阳方向」过滤——背阳面（阴影侧）alpha 归零，只有受光轮廓发光。
- 应用：圣城连续山体 + 台地 + 城堡轮廓；驱动挂 `castleContainer.update`（每帧传太阳/相机方向）。

### 2.7.4 城堡-山脉整合与植被小阴影（S17）

**来源事实（S17）：** 原文见来源表。植被体积感来自**纹理 + 小阴影**，不需要 billboard 体积。

**画面归纳：** 岩石山体（暖色）占画面主体，顶部是草甸（绿），城堡（亮部）**坐在山体上**——建筑基座与岩石融为一体；山坡散布纹理树丛，根部有小阴影（暗斑），让扁平的纹理植被有体积感。

**项目推导：**
- **城堡-山脉整合**：建筑区（城址）与山体不是「台上放模型」，而是山体覆盖到建筑基座边缘、城墙外缘直接长出岩石坡（圣城 12.39 已实现「台地埋入山体」；核对并强化：基座外缘无悬空、无独立厚板可见）。
- **植被小阴影（blob shadow）**：每株树/灌木根部加一块圆形半透明暗斑（贴地、随地形法线），让低模/纹理植被「坐」在地面上，产生体积感——对应原文 *lil' shadows, they look quite volumetric*。

### 2.8 编辑是小输入、大结果

**来源事实（S7）：** 玩家点一格，系统补模块、转角、屋顶。失败要看得见。

**项目现状：** 高山 Townscaper 编辑器可刷色/扩建/挖洞。Planet V9 地形编辑器有 command/brush 数据测试；主系统里不是截图那种完整 2D 等高线工作台。

### 2.9 光照：可读优先，bounce 是实验档

**来源事实（S8, S9, S10）：** 战场必须一眼可读。发售级方案是假 AO + 稳定阴影，不是物理 GI。真正 bounce 是 2022 实验，默认关闭才符合 Oskar 自己的代际划分。

**项目现状：** V5 LightingDirector + voxel AO + 默认关的 bounce。圣城另有一层独立灯。主场景仍可能和旧四灯并存，取决于开关。

### 2.10 战斗：命令在小队，动作在单兵

**来源事实（S8）：** Bad North 复杂性在模拟与地形，不在 HUD。

**项目现状：** `agents/citadel` 为现役真源。最新圣城路线收束 `castle-top`，默认无攻城梯。

## 3. 和当前仓库的对照

能力只允许：`MISSING / DATA_TESTED / RUNTIME_WIRED / VISUAL_PROXY_PASSED / DEFAULT_ON`。

| 官方方法 | 仓库落点 | 级别（2026-08-26） |
| --- | --- | --- |
| main + dual 同时保留 | `geodesicMainGrid` / `geodesicDualGrid` | RUNTIME_WIRED，默认关 |
| 手工模块 + WFC/约束 | 城堡 Townscaper；球面 `sphericalWfc` | 城堡默认开；球面 opt-in |
| 长窄结构不靠 WFC 碰运气 | `hardRoutePlanner`、水文 V10 | 水文已接入编译器；硬路线 golden 仍是 P0 |
| 生成烘焙 / 运行 shader | 云 impostor、水面 data 纹理 | 圣城本地云已挂；球面云默认关 |
| 云海 impostor | `cloudImpostorSystem` + `highlandHeroClouds` | 圣城本地 RUNTIME_WIRED；球面 opt-in |
| 云/树共用 impostor（S12） | `impostorAtlasBuilder`（共享 atlas）+ `createSharedImpostorMaterial` + `highlandHeroClouds` | **RUNTIME_WIRED（默认世界 hero 层）**：云块+树冠块同 atlas、同 shader 家族、同 draw call；近景树保持几何；V8/V9 全局开关保持 opt-in |
| 岸浪：台地-海衔接（S13） | `highlandShoreWaves.js`（烘焙 in/out/time + looping vertex shader）+ 圣城台地外缘湖岸浪带 | **RUNTIME_WIRED**（默认世界 hero 层可见：232 顶点浪带沿湖岸线，推进波 + 振幅衰减；与全局水面 swell 共存，无第三种水面算法）；山体岩石配色按主人验收恢复基线（冷蓝灰），出城台阶 + 山坡灌木保留 |
| 草 contrast outline | V9 grass shader 契约 | VISUAL_PROXY_PASSED，默认世界未见 |
| 海面结构 ≠ 浪 | curved water + shader | RUNTIME_WIRED，默认关 |
| 假 AO + 可选 bounce | `render/lighting`、`render/ao` | RUNTIME_WIRED，bounce 默认关 |
| 背光高光（S16） | `backlitHighlight.js`（反向轮廓层 + 背光因子 + 受光遮罩） | **RUNTIME_WIRED**（圣城山体高光层已挂，main 循环驱动）；城堡/台地轮廓层待扩展 |
| 城堡-山脉整合 + 植被小阴影（S17） | 山体覆盖建筑基座 + 树/灌木根部 blob shadow | **RUNTIME_WIRED**（12 树 + 42 灌木 54 个贴地暗斑已挂）；整合已核对（12.39 台地埋入山体） |
| 编辑小输入 | 高山格网编辑器 | RUNTIME_WIRED |
| 地形连接 relax（S14/S15） | 五地点地面连接带（relax 收敛剖面，平面版 + 球面版） | **MISSING**（烘焙器 `groundConnector.js` 平面版已写未测；球面版未实现） |
| 气候→云/植被单源 | `climateFieldV10` / `ecologyFieldV10` | RUNTIME_WIRED，默认关 |

审计入口（读代码与 field，不读勾选）：

```bash
node tools/audit_planet_v8_oskar_gap.mjs
```

## 4. 官方方法尚未完成的缺口

按 Oskar 方法，而不是按「文件是否存在」：

1. **单源气候。** 云 compiler 已读 `climateFieldV10`（2026-08-26）。
2. **单源生态。** 植被 compiler/runtime 已读 `ecologyFieldV10`（2026-08-26）；默认世界的山坡草仍不是这套 InstancedMesh。
3. **生产顺序。** `planetCompilerV8` 已按 `field → hydrology → climate → ecology → cloud → charts/semantic bake → vegetation → snapshot` 接线（2026-08-26）；snapshot 带 hydrology/climate/ecology hash。默认世界仍 opt-in。
4. **默认世界。** 官方方法要求玩家看见 main/dual/field 的结果。当前默认仍是 legacy 圣城切图 + 本地山体；V8/V9 要 URL/`worldVersion`。
5. **草与地面。** 默认高山圣城山坡已挂本地 contrast-aware billboard 草；球面 V9 InstancedMesh 草仍 opt-in。
6. **WFC 与河流。** 岸线/湖盆应来自地形场，禁止再出现与 field 无关的大矩形水面。最新圣城湖面已改 WFC cap；球面海洋仍是 opt-in。
7. **硬路线 golden。** `test_procgen_profiles_hard_routes.mjs` 不得把 expected 改回旧五台地/瀑布 hash；应冻「地面入口 → 内部旋梯 → castle-top」。
8. **云/树共用 impostor（S12）。** 已落地（默认世界 hero 层）：共享 atlas + 共享 shader 家族 + 单 draw call（`test_cloud_tree_shared_impostor.mjs` 验收）。**剩余**：全星球 V9 `vegetationRuntime` 的树 canopy 远 LOD 仍为 InstancedMesh 几何，`octa-impostor` 在 compiler schema 声明但未接入运行时——接入时复用 `buildSharedImpostorAtlas`/`createSharedImpostorMaterial`，atlas 版本进入 snapshot hash。

9. **岸浪：台地与大海的衔接面（S13）。** 已落地（默认世界 hero 层）：`highlandShoreWaves.js` 烘焙湖岸浪带（in/out/time/振幅）+ looping vertex shader（`tools/test_shore_waves.mjs` 验收）。**剩余**：球面 V8 海岸线接入同款岸浪（复用烘焙器与 shader 家族）；浪带与水位/船行路径的冲突测试。

10. **五地点地面连接（S14/S15 relax pass + 球面化）。** 高山圣城/交汇城堡/书店镇/叹息之门/苔庭当前各自独立（角距 80–170°）。落地分两版：**平面版**（主岛内：圣城台地外缘/书店镇/叹息之门走廊）与**球面版**（远处地点沿大圆弧、高度向球面收敛）。验收：`tools/test_ground_connector.mjs`（relax 收敛性 / 剖面平滑 / 防膨胀 / 确定性 / 球面曲率一致性）。

11. **背光高光（S16）。** 已落地（山体层）：`backlitHighlight.js`（等比放大 BackSide 暖金层 + rim + 受光遮罩 + 背光因子），`tools/test_backlit_highlight.mjs` 验收。**剩余**：城堡（942 格合并几何）与台地轮廓高光层扩展、与 `applyInkOutlines` 的描边优先级核对。

12. **植被小阴影（S17）。** 已落地：`buildBlobShadow` 共享圆片贴地暗斑（54 个），`tools/test_blob_shadow.mjs` 验收。**剩余**：球面 V9 植被接入同款 blob shadow。

不在本文件范围、但已单独完成、不要回退：

- 高山圣城本地戴帽云（地标专属，不是气候抽样）
- 蓝车搭乘 BGM 优先于攻城/峡谷

## 5. 执行顺序

```text
O0  冻结本文件术语：main/dual、WFC、MC、impostor、无 MFC
O1  气候/生态单源接入云和植被（原 TODO V10-G21 E/F/H）
O2  编译器生产顺序 + Worker 提交 + snapshot hash
O3  默认世界仍 opt-in，直到 O1/O2 脚本全绿
O4  默认镜头的草/岸线/云海只消费烘焙字段
O5  硬路线 golden 与聚合测试转绿
O6  才允许讨论 DEFAULT_ON
```

负责人：与 PLAN 12.28 一致，活动实现归当前编码代理；Kimi 不再承担活动项。V10 数据层已由 DeepSeek DATA_TESTED，接线仍是缺口。

## 6. 完成定义

一项官方方法只能在同时满足时标完成：

- 来源事实栏能指到 S1–S13 之一；
- 生产代码路径（不是死文件）消费该数据；
- 有非零退出的脚本；
- 开关默认值没有被测试偷偷改掉。

截图、GPU timer、主人审美仍是独立人工验收。
