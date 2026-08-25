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

## 2. 官方方法（按流水线）

### 2.1 图，不是一张噪声高度图

**来源事实（S1, S4, S11）：** 不同数据住在不同图上。main grid 承载房屋、碰撞、导航、附加物；dual / terrain graph 承载场地、坡度、流域一类 field。两套拓扑共享部分操作，但顶点和三角形不是同一份。

**项目现状：** `geodesicMainGrid.js` / `geodesicDualGrid.js` 存在；V8 编译走 geodesic main/dual。生产开关 `planetTerrainV1` 等默认 **false**。默认玩家世界仍是球面切图上的手摆圣城，不是 V8 默认开启。

### 2.2 手工模块 + 受约束生成，不是纯随机

**来源事实（S3, S4, S7）：** Townscaper 核心是少量输入 + 手工模块 + 程序化组装。WFC **不擅长** 长、窄、有方向的结构（尤其河流）。失败必须可解释，不能靠无限重启。

**项目现状：** 城堡侧有 Townscaper 单元目录、socket、WFC/约束求解（V6/V7）。球面侧有 `sphericalWfc.js` + hard pins。河流/岸线仍有「后处理补丁」痕迹；V10 水文场已 DATA_TESTED，**尚未**接到生产 cloud/vegetation compiler。

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

**项目现状：** `semanticTerrainMaterial` 有草语义色；contrast-aware grass outline 在 V9 有 shader 契约测试。默认世界的地面仍大量走旧材质，玩家在圣城山坡上不一定看见这套草。

### 2.6 云：代理，不是体积云模拟器

**来源事实 / 画面归纳（S11）：** 蓬松云块 → 多角度 impostor；叠放制造云海遮挡；运动在 shader。

**项目现状：** Planet V8 impostor atlas 存在，默认关。高山圣城 **本地山脊** 已钉戴帽云/云海框（`highlandHeroClouds.js`），不依赖 V8 开关。球面 opt-in 气候抽样云已读 `climateFieldV10`。

### 2.7 海面不是第三种等值面算法

**项目推导（明确）：** 用户口头「Oskar 的 MFC」落实为：

```
main/dual grid → 手工/WFC 约束 → semantic field → MC 陆地/海岸/海床
→ 不规则静态水面拓扑 → GPU shader（swell / 泡沫 / 尾流 / 涟漪）
```

MC 只生成结构。浪是 shader。

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
| 草 contrast outline | V9 grass shader 契约 | VISUAL_PROXY_PASSED，默认世界未见 |
| 海面结构 ≠ 浪 | curved water + shader | RUNTIME_WIRED，默认关 |
| 假 AO + 可选 bounce | `render/lighting`、`render/ao` | RUNTIME_WIRED，bounce 默认关 |
| 编辑小输入 | 高山格网编辑器 | RUNTIME_WIRED |
| 气候→云/植被单源 | `climateFieldV10` / `ecologyFieldV10` | RUNTIME_WIRED，默认关 |

审计入口（读代码与 field，不读勾选）：

```bash
node tools/audit_planet_v8_oskar_gap.mjs
```

## 4. 官方方法尚未完成的缺口

按 Oskar 方法，而不是按「文件是否存在」：

1. **单源气候。** 云 compiler 已读 `climateFieldV10`（2026-08-26）。
2. **单源生态。** 植被 compiler/runtime 已读 `ecologyFieldV10`（2026-08-26）；默认世界的山坡草仍不是这套 InstancedMesh。
3. **生产顺序。** `planetCompilerV8` 已按 `field → hydrology → climate → charts → ecology+clouds → semantic → vegetation → snapshot` 接线（2026-08-26）；snapshot 带 hydrology/climate/ecology hash。默认世界仍 opt-in。
4. **默认世界。** 官方方法要求玩家看见 main/dual/field 的结果。当前默认仍是 legacy 圣城切图 + 本地山体；V8/V9 要 URL/`worldVersion`。
5. **草与地面。** 默认镜头里的山坡/苔庭仍不是 contrast-aware billboard 草。
6. **WFC 与河流。** 岸线/湖盆应来自地形场，禁止再出现与 field 无关的大矩形水面。最新圣城湖面已改 WFC cap；球面海洋仍是 opt-in。
7. **硬路线 golden。** `test_procgen_profiles_hard_routes.mjs` 不得把 expected 改回旧五台地/瀑布 hash；应冻「地面入口 → 内部旋梯 → castle-top」。

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

- 来源事实栏能指到 S1–S11 之一；
- 生产代码路径（不是死文件）消费该数据；
- 有非零退出的脚本；
- 开关默认值没有被测试偷偷改掉。

截图、GPU timer、主人审美仍是独立人工验收。
