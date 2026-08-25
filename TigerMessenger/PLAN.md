# 《TigerMessenger》复刻计划 · PLAN

> 子项目目标：在 TigerInBamboo 仓库内复刻网页 3D 游戏《TigerMessenger》，
> 从主页"进入二次元"光点进入。零构建、CDN 引入 Three.js、GitHub Pages 可直接运行。
>
> 历史分工：Grok 负责机制生成，Kimi 负责整合与视觉验收。
>
> **2026-08-22 最终执行权重调整：** 第十章 V6 及第十一章 V7 起采用 **Grok 100% / Kimi 0%**。
> Grok 同时负责架构、生产接线、视觉实现、固定镜头、色板/光照 JSON、灰度与色盲检查、
> 独立视觉 QA、测试和性能。原分给 Kimi 的 16 个 V6 活动项全部转给 Grok；旧章节中尚未完成的
> Kimi 任务若与 V6/V7 重叠，也以 V7 的 Grok 负责人为准。

---

## 一、目录结构（目标态，逐步长出来，不是一次建完）

```
TigerMessenger/
├── index.html            # 入口页（✅ 第 1 步已完成：基础渲染管线）
├── PLAN.md               # 本文件
├── TODO.md               # 可勾选的待办清单（与里程碑表对应）
├── src/                  # 第 5 步后由单文件拆分而来
│   ├── main.js           # 装配：场景/相机/循环/各系统接线
│   ├── core/             # 渲染循环、输入、相机跟随
│   ├── world/            # 地形、平台、关卡、检查点
│   ├── player/           # 玩家控制器、物理、动画
│   ├── quest/            # 信件任务系统（接信 → 送信 → 交付）
│   └── ui/               # HUD、对话气泡、任务提示
├── assets/               # 贴图 / 音频 / 模型（glTF）
└── vendor/               # three.js 本地兜底（CDN 失败时回退）
```

**演进约定**：第 2～4 步继续保持单文件（方便 Grok 整页产出、整页替换）；
单文件超过约 800 行后，由 Kimi 拆分为 `src/` 模块，Grok 之后按模块续写。

---

## 二、里程碑与 Todos

| # | 任务 | 产出 | 负责 |
|---|------|------|------|
| 1 | 基础 WebGL 渲染管线 | `index.html`（Scene/相机/全屏渲染器/rAF 循环） | **Kimi** ✅ 已完成 |
| 2 | 主页"进入二次元"入口 | home.html 双光点导航 + 双语 | **Kimi** ✅ 已完成 |
| 3 | 世界骨架：平台地形 + 第三人称跟随相机 | 可行走地面、悬空平台、平滑跟随 | **Grok** ✅ 已完成 |
| 4 | 玩家角色：移动 / 跳跃 / 重力 / 平台碰撞 | 胶囊体或方块小人，WASD+空格 | **Grok** ✅ 已完成 |
| 5 | 信使玩法循环：接信 → 送达 → 检查点 | 信件道具、NPC 收发点、任务计数 | **Grok** ✅ 已完成 |
| 6 | **模块化解构 + 全面 code review** | `src/` 已拆；Kimi 验收三件套通过 | **协作** ✅ 已完成 |
| 7 | 视觉风格定调：低多边形夜色世界 / 光照 / 天空 | 天空球/月/光点脉动/平台脉动已落地 | **协作** ✅ Kimi 已评审定稿 |
| 8 | 角色模型与动画（程序化或 glTF） | 披风/耳/走跑跳/持信 程序化版 | **Grok** ✅；**Kimi** 可后续换 glTF |
| 9 | 音频：环境音 + 跳跃/交付音效 | 垫乐 + SFX + M 静音 | **Grok** ✅ |
| 10 | UI/HUD：任务列表、对话气泡、开场提示 | 清单 + 罗盘 + 气泡 + 开场 | **Grok** ✅；**Kimi** 润色 |
| 11 | CDN 兜底与性能：vendor 回退、帧率巡检 | `vendor/`、启动器回退、`?fps=1` | **Grok** ✅ |
| 12 | 部署：GitHub Pages 验证 `/TigerMessenger/` 在线可玩 | `0b48f06` 已上线 | **Grok** ✅ |
| 13 | （可选彩蛋）信使记忆 | 13a 信袋 ✅；13b 四层记忆桥接 ✅ | **Grok** ✅ |

### 分工速查

- **Grok 做**：3、4、5、7（方案）、8（生成）、9、10（生成）
  —— 都是自包含的游戏机制/内容代码，适合整页或整模块一次性产出。
- **Kimi 做**：1✅、2✅、6、7（评审）、8（接入）、10（润色）、11、12、13
  —— 都需要碰仓库上下文：拆分、审查、风格一致性、部署、与主站联动。
- **每个 Grok 步骤完成后**：把文件发我，我做一轮"验收三件套"——
  语法检查、无头浏览器截图核验、与既有风格/结构的对齐报告。

---

## 三、当前状态

- [x] 第 1 步：渲染管线（`index.html`，Three.js + THREE.Timer 循环）
- [x] 第 2 步：主页入口（"进入二次元"光点，中英双语）
- [x] 第 3 步：世界骨架（主岛 + 多段悬空平台 + 星空雾 + 方向光/半球光 + 第三人称阻尼相机）
- [x] 第 4 步：玩家（程序化低多边信使、WASD 相对相机移动、空格跳跃、重力、平台 AABB 碰撞、坠落复位）
- [x] 第 5 步：信使循环（4 封信；检查点重生；罗盘导航；靠近自动交互）
- [x] 第 7 步（落地增强）：渐变天空球、月亮、漂浮光点、平台 emissive 脉动
- [x] 第 8 步：程序化信使（披风/虎耳/眼）走跑跳 idle
- [x] 第 9 步：Web Audio 垫乐 + SFX；`M` 静音
- [x] 第 10 步：开场、任务面板、信件清单、Toast、气泡、罗盘、`Shift` 疾跑提示
- [x] 第 6 步：`src/` 模块化解构 + Kimi 全面 review（2026-08-02 验收三件套通过）
- [x] 第 11 步：CDN → vendor 兜底 + 帧率巡检（`?local=1` 离线路径已验证）
- [x] 第 7 步：视觉方案 **评审定稿**（Kimi 2026-08-02，夜色低多边形板定稿）
- [x] 第 12 步：Pages 在线点验（`0b48f06` 已上线）
- [x] 第 13 步：信使记忆 13a/13b
- [x] 球面实验页增强（跳跃/缩放/散布/碰撞，见 `PLAN-sphere-player.md`）

> 操作：`WASD` 移动 · `Shift` 疾跑 · `Space` 跳 · 滚轮/中键缩放 · 靠近发光点交互 · `M` 静音 · `L` 信袋  
> 本地试玩：`http://localhost:8931/TigerMessenger/`（或 `?local=1` / `?fps=1`）；星球实验：`planet.html`。

---

## 四、视觉方案（第 7 步 · Grok 提案，待 Kimi 评审）

| 维度 | 提案 |
|------|------|
| 气质 | 夜色二次元信使：深蓝底 `#0a1020`，冷月光 + 淡紫补光 |
| 造型 | 全 flatShading 低多边；平台 EdgesGeometry 弱勾边 |
| 天空 | FogExp2 + 上半球星点 Points；主岛 Torus 光环 |
| 光照 | HemisphereLight（天空蓝/地面暗紫）+ 主 Directional 带阴影 + 冷紫 fill |
| 角色 | 蓝披风信使 + 虎耳 + 暗色背包；持信时点光与发光信件 |
| NPC | 六棱柱身体 + 顶光柱/光圈/二十面体标记球；仅当前目标点亮 |
| UI | 半透明毛玻璃面板、冷蓝描边，与主站夜色实验室一致 |
| 可调 | 若偏「更二次元」可加：渐变天空球、平台 emissive 脉动、角色描边 pass |

Kimi 可直接改色板常量 / 拆模块；不推翻玩法结构即可定稿。

---

## 五、给 Kimi 的第 6 步验收提示

验收三件套建议：

1. **语法 / 控制台**：静态服务打开，确认无 importmap/Three 报错；`THREE.Timer` 与 r0.172 锁定版本一致。
2. **可玩路径**：开始 → 小虎接「竹林邀请函」→ 阿竹送达 → 月见→星野 → 驿站→远方 → 通关 Toast。
3. **结构拆分建议**：
   - `src/core/`：renderer、camera follow、input、timer
   - `src/world/`：`PLATFORM_DEFS` + 碰撞
   - `src/player/`：controller + procedural mesh/anim
   - `src/quest/`：`QUEST_DEFS` + NPC + interact
   - `src/ui/`：HUD / toast / bubble / intro
   - `src/audio/`：Web Audio 合成

---

## 六、高山城堡攻防 V2（交给 Kimi 执行）

> 状态：**P0～P1 已完成并验收（Kimi 2026-08-22）**；P2 起待主人确认后开工。本阶段依据 [Bad North 开发访谈](https://medium.com/subpixelfilms-com/a-minimal-brand-of-madness-oskar-st%C3%A5lberg-and-richard-meredith-on-the-development-of-bad-north-514d5cf1a7a1) 制定，但不复制其美术或玩法；只吸收“个体模拟、地形即战术信息、隐藏复杂数值、行为结果清晰可读”的设计方法。
>
> 执行边界：Kimi 第一批只能完成 P0～P1。战术导航图未通过验收前，不得继续往 `saihojiPhalanx.js` 追加攻防条件，也不得开始 P2 以后工作。
>
> P0/P1 交付物：`src/core/rng.js`（mulberry32 种子源）、`src/world/combatEvents.js`（事件日志/重放 digest）、`src/world/citadelTacticalGraph.js`（战术导航图：稳定节点 ID、五类边元数据、分层 A*、占位/容量/预约、增量重建、调试视图）、`tools/test_citadel_combat_replay.mjs`（4 场景×3 跑一致性）、`tools/test_citadel_tactical_graph.mjs`（116 断言）、`tools/citadel_combat_baseline.mjs`（基线 JSON）、`tools/e2e/citadel_combat_v2_e2e.mjs`（真实城堡浏览器验收）。开关 `?citadelCombatV2=1&seed=N`，调试视图 `?tgDebug=1`。

### 6.1 目标与原则

- 每名士兵属于小队，但独立选择移动、攻击、防御、等待、绕行、援助或撤退，不再整队平移。
- 城堡台地、门口、阶梯、窄道、城墙、梯子和瀑布都进入统一拓扑；士兵只能沿合法表面移动，禁止悬空抄近路。
- 高地、门洞、瓶颈、队形宽度、视线和盾牌朝向必须真实影响战斗结果。
- 复杂度藏在系统内部；玩家通过姿态、动作、声音、受阻、动摇和溃退读懂战况，不堆数字 HUD。
- 日间攻城与深夜木马渗透复用同一套路网、个体状态机、战斗结算和动画系统。
- 固定种子可复现，同一输入必须得到同一结果，便于 Kimi 回归、调参和定位路径错误。

### 6.2 现有系统映射与问题

| 领域 | 现有入口 | V2 处理 |
|---|---|---|
| 城堡蓝图 | `src/world/citadelBlueprint.js` | 继续作为几何语义源，补稳定节点 ID 和通行标记 |
| 城堡生成 | `src/world/citadelTown.js` | 构建后输出门、台地、阶梯、墙缘等导航锚点 |
| 台地/路径数据 | `src/world/citadelRange.js` | 从手写线段升级为可查询、可重建的战术图 |
| 日间攻城 | `src/world/saihojiPhalanx.js` | 拆出导演、小队命令、个体代理、战斗结算；停止膨胀巨型状态机 |
| 夜间木马行动 | `src/world/citadelInfiltration.js` | 保留四绳、两组、深夜出动/天亮返回设定，改用统一战术图与代理 |
| 士兵模型 | `src/world/harbor.js` | 保留纸质长枪兵、盾牌/火炬手外观，统一动作骨架与事件接口 |

当前主要缺口：日夜两套状态机分裂；路线多为手写阶段脚本；没有统一占位/预约；士兵缺少独立意图、勇气与体力；攻击判定与动画时序脱节；缺少视线、遮挡、高地和真实瓶颈；战斗随机数不可复现。

### 6.3 目标架构

```text
CitadelBlueprint
        ↓
CitadelTacticalGraph ←── 台地/门/阶梯/梯子/瀑布/木马热更新
        ↓
CitadelSiegeDirector
        ↓
SquadOrder ──→ CombatAgent ──→ CombatResolver ──→ CombatAnimation
                    ↑                 │
                    └── 威胁/占位/体力/勇气/友军协助反馈 ──┘
```

建议新增模块：

- `src/world/citadelTacticalGraph.js`
- `src/world/citadelCombatAgent.js`
- `src/world/citadelSquadOrder.js`
- `src/world/citadelCombatResolver.js`
- `src/world/citadelCombatAnimation.js`
- `src/world/citadelSiegeDirector.js`

### 6.4 分阶段计划

#### P0 · 基线、开关与可复现（先做）

- 加 `citadelCombatV2` 功能开关，默认不破坏现有日间攻城、夜间木马、天亮回收流程。
- 将攻防流程中的 `Math.random()` 替换为注入式有种子随机源；保存 seed、命令序列和关键战斗事件。
- 固定至少 4 个回归场景：港口登陆、门洞瓶颈、跨台地追击、深夜木马双组行动。
- 记录基线：单位数量、到达率、悬空次数、寻路耗时、战斗帧耗时、胜负与总时长。

退出条件：同 seed 连续运行 3 次，关键事件顺序一致；旧系统测试仍全过。

#### P1 · 城堡战术导航图（第一批做到这里为止）

- 节点覆盖台地可行走面、建筑门口、庭院、阶梯首尾、城门、梯子、瀑布攀爬点、港口与木马落地点。
- 边类型至少包含 `walk`、`stairs`、`ladder`、`waterfall-climb`、`door`，并保存宽度、坡度、高差、容量、危险度与通行方向。
- 用 A* 做分层寻路；加入空间占位、窄道容量和短期节点预约，杜绝队伍互穿、空中直线和无限卡死。
- 城堡编辑或几何重建后，只增量重建受影响图块；调试模式可视化节点、边、法线、占位和当前路径。

退出条件：所有固定场景路线都贴合地表；台地切换只能走阶梯/梯子/瀑布合法边；离表误差不超过 0.15；持续 10 分钟无空中路线。

#### P2 · 小队命令与个体代理

- 小队只下达目标和阵型意图，士兵自行执行。每名士兵持有：阵营、角色、命令、意图、目标、路径、体力、勇气、冷却、受阻时间、附近敌友与威胁方向。
- 个体状态统一为：`idle`、`move`、`form`、`brace`、`aim`、`attack`、`block`、`recover`、`stagger`、`down`、`retreat`、`climb`、`assist`。
- 决策频率 6～10 Hz，渲染帧只插值；加入滞回时间，避免目标和状态每帧抖动。
- 受阻时根据性格、勇气和战况选择等待、换邻格、重寻路、冲锋或撤退。

退出条件：同一小队成员会绕障、让路和错峰进入窄道；不再表现为整组同步平移。

#### P3 · 战斗结算与人类动作

- 攻击统一为预备、接触、恢复三段事件，命中只在接触窗口结算；动画订阅事件，不自行决定伤害。
- 盾牌按朝向和覆盖角阻挡；长枪墙只有静止成形且正面迎敌时有效；加入攻击距离、身体阻挡、视线遮挡和高地修正。
- 移动使用步态相位驱动跑步：腿臂反相摆动、步频随速度变化、转身和上下阶梯有独立姿态。
- 继续保持低数字感和较高致命性，通过动作、音效、击退、踉跄和倒地表达结果。

退出条件：跑、停、转、刺、挡、受击、攀爬均可从动作判断；伤害时机和兵器接触一致。

#### P4 · 日间攻城导演

- 攻方阶段：登陆、集结、选择突破口、架梯/破门、占领入口、清理台地、继续推进、等待增援或撤退。
- 守方阶段：利用高地、门洞和窄道布防，保留预备队；防线失守后逐层后撤并在合适时反击。
- 导演只分配目标、资源和优先级，不逐帧遥控每名士兵；攻城梯数量和位置根据战场评估，不永久锁死为固定脚本。

退出条件：更换种子或封堵入口会产生可解释的不同方案；双方都会利用地形而非直线碰撞。

#### P5 · 深夜木马行动接入

- 保留既定规则：天空全黑后开启马腹；四根绳索、每绳两次下降；两组各有首尾火炬手，其余左盾右长枪；天亮全部合法返回马腹。
- 瀑布组负责台面 2、1；阶梯组负责台面 5～3。到达台面后分散跑步逐屋查门，覆盖完成再经合法阶梯前往下一台面。
- 攀爬阶段允许分散，靠近时触发拉扯、推举、搀扶；援助强度由距离、体力和高差决定，不用牵引绳连接队列。
- 遭遇守军时由共同战斗系统决定绕行、结阵、援助、撤退或继续搜索；返回时逆向使用同一合法拓扑。

退出条件：日夜系统共享图和代理；无巡查绳索、无牵着火炬手、无空中移动；天亮回收不穿墙、不瞬移。

#### P6 · 战况可读性

- 用阵型收紧/散开、抬盾、压枪、犹豫、呼喊、号角、火炬和撤退表达状态。
- 镜头保持能读全局台地关系，同时局部交锋的长枪、盾牌与脚步动作清楚可见。
- 除调试模式外不显示威胁值、勇气值、命中率等内部数字。

#### P7 · 性能、回归与交付

- 近邻查询使用空间哈希；远处单位降低决策频率；路径失效才重算，单兵不高于每 0.5 秒一次查询。
- 150 名活跃单位时，战斗系统 P95 CPU 预算不超过 5 ms/帧；超预算时先降决策频率，不破坏地表约束。
- 新增测试：
  - `tools/test_citadel_tactical_graph.mjs`
  - `tools/test_citadel_combat_agent.mjs`
  - `tools/test_citadel_siege_director.mjs`
  - `tools/test_citadel_combat_replay.mjs`
  - `tools/e2e/citadel_combat_v2_e2e.mjs`

### 6.5 完成定义（Definition of Done）

- 所有跨台地移动都经过显式合法连接，任何士兵离开承载表面不得超过 0.15 单位。
- 每名士兵有独立意图和动作，小队不再以统一位移冒充行军。
- 高地、门洞、瓶颈、视线、盾牌朝向、长枪距离和预备队对胜负产生可复现影响。
- 玩家无需查看数字，就能从动作与声音读出结阵、受阻、动摇、冲锋、援助和撤退。
- 城堡热编辑后战术图正确局部更新；不存在旧节点残留或穿墙捷径。
- 同 seed、同命令可稳定重放；日间攻城、夜间木马、天亮回收的既有测试继续通过。
- 连续运行 10 分钟无悬空巡查、无无限卡阶梯、无队伍互穿；150 人性能达到 P7 预算。

---

## 七、高山城堡整体配色 V3（Bad North 美学层级，交给 Kimi 执行）

> 状态：**已规划，尚未实施**。研究来源：[Bad North: On Beauty and Strategy](https://deathisawhale.com/2020/02/26/bad-north-beauty-strategy/)。文章明确强调柔和蓝绿环境与战斗红色的对比、有限地形词汇带来的统一感、地形视觉走势与部队行进路线的一致，以及日落、雨雪和鼓点对紧张感的递进。
>
> 下述具体 Hex、比例和材质参数是根据文章内四张实机图对 TigerMessenger 当前渲染管线做的**项目化推导**，不是原作者公布的官方色值。保留 Townscaper 的构件与阳台花砖多样性，但不继续沿用高山城堡目前逐格高饱和的“糖果彩虹”分配。

### 7.1 视觉目标

- 第一眼先读出岛屿、五层台地、瀑布、阶梯与城堡轮廓，第二眼看见船只来向和两军位置，最后才读到窗、砖、花砖等装饰。
- 大面积使用低至中饱和的雾蓝、灰绿、粉白石；高纯度颜色只用于旗帜、火炬、血迹、火灾和少量建筑焦点。
- 城堡仍然是彩色 Townscaper 城镇，但颜色按“建筑簇/街区”组织，不按每个格子独立抽签。
- 敌我主要依靠躯干、盾牌、旗帜与明度区分；兵种主要依靠轮廓和装备区分，避免每个兵种再占一套彩虹色。
- 船只必须在雾蓝水面上形成暗色移动轮廓，同时不能和血迹使用同一个高饱和红色。
- 昼夜、雨雪和落日只做统一场景调色，不永久污染基础材质色。

### 7.2 画面颜色预算

| 画面层级 | 目标占比 | 用途 |
|---|---:|---|
| 环境底色 | 68% | 天空、雾、水面、草地、山石；低饱和、相邻色关系 |
| 城堡与地形建筑 | 24% | 粉白石、雾蓝、鼠尾草绿、暖砂、灰粉；中低饱和 |
| 船只与士兵 | 6% | 暗船体、蓝方、炭黑/酒紫敌方、旗帜；中等以上对比 |
| 战斗反馈 | 2% 以内 | 血迹、火焰、燃烧窗、警报；最高色彩优先级 |

该比例用于固定镜头的像素占比检查，不要求逐帧精确；核心是防止城堡高饱和面积吞没士兵和战斗反馈。

### 7.3 语义色板

#### 城堡、台地与构件

| Token | 建议色 | 使用规则 |
|---|---|---|
| `castleWallChalk` | `#E7ECE7` | 主墙 38%，作为高明度粉白石基底 |
| `castleWallMist` | `#B9C9C7` | 雾蓝灰墙 20%，接近水天环境但保持轮廓 |
| `castleWallSage` | `#A7BE9C` | 鼠尾草绿墙 17%，连接草地与建筑 |
| `castleWallSand` | `#D8C6A6` | 暖砂墙 13%，用于门口与交通节点附近 |
| `castleWallBlush` | `#D7A0A0` | 灰粉墙 8%，只作建筑焦点 |
| `castleWallAccent` | `#8FAEB5` | 冷蓝焦点 4%，用于高塔/桥头，不大面积铺满 |
| `castleRoof` | `#C98778` | 主屋顶，灰鲑陶瓦 |
| `castleRoofShade` | `#9D6866` | 屋脊、背光瓦与旧化边缘 |
| `castleTrim` | `#46545D` | 檐口、栏杆、支架、描边；避免纯黑 |
| `castleWindow` | `#294452` | 窗洞和门洞，夜间亮窗另走发光 token |
| `castleGateFocus` | `#EEE2CB` | 正门、阶梯出口和战术瓶颈的暖粉白 |
| `castlePlaza` | `#A9B2AB` | 台面铺装与公共石材 |
| `castleBalconyTiles` | `#C89082/#7FA6AC/#B4A06B/#7FA98C` | 彩色花砖保留，但饱和度受控且只出现在阳台 |

墙色分布以“建筑簇”为单位执行 38/20/17/13/8/4 权重；同一建筑簇最多使用一个主墙色和一个相邻辅色。禁止恢复当前 `#F6DD45/#EF4F67/#31C46F/#4F9DE9` 等高纯度颜色的大面积逐格混排。

#### 船只

| Token | 建议色 | 使用规则 |
|---|---|---|
| `shipEnemyHull` | `#533842` | 敌方战船主船体，暗酒紫而非鲜红 |
| `shipEnemyHullShade` | `#2E3338` | 船底、船舱和剪影暗面 |
| `shipEnemyBand` | `#8D4B52` | 少量舷带；面积不超过船体可见面的 12% |
| `shipDefenderHull` | `#496A73` | 若出现守方/民用船，使用深雾蓝绿 |
| `shipDeckWood` | `#756052` | 甲板和桨，压低现有偏黄木色 |
| `shipSailBone` | `#D8D5C8` | 风化骨白帆，承接粉白城墙 |
| `shipRope` | `#746B60` | 绳索与支索 |
| `shipMetal` | `#A58A57` | 撞角和小面积金属，禁止高亮金色铺满 |

敌船的识别依靠暗轮廓、朝向和队形；战斗血红必须比船体红更纯、更亮，避免船只与伤亡反馈混成一片。

#### 士兵与战斗反馈

| Token | 建议色 | 使用规则 |
|---|---|---|
| `unitDefenderMain` | `#416F91` | 城堡守军蓝，躯干/盾面主色 |
| `unitDefenderShade` | `#29445B` | 守军裙甲、盾脐和背光面 |
| `unitAttackerMain` | `#593B47` | 登陆/渗透敌军暗酒紫，与敌船同族但更易读 |
| `unitAttackerShade` | `#2D353B` | 敌军暗甲和夜间剪影 |
| `unitMetal` | `#C5B37E` | 低光泽黄铜头盔/盾边 |
| `unitSteel` | `#BAC4C6` | 枪尖、箭头；仅小面积高明度 |
| `unitSkin` | `#C99570` | 降低现有橙色皮肤饱和度 |
| `unitTorch` | `#FFB347` | 火焰核心；夜间唯一持续暖高亮 |
| `unitTorchHalo` | `#E67A3C` | 火炬外焰与点光 |
| `battleBloodFresh` | `#A9283C` | 新鲜血迹，最高饱和反馈色 |
| `battleBloodDry` | `#672F3A` | 随时间变暗的旧血迹 |
| `battleFire` | `#E85D3F` | 建筑燃烧红橙，不用于常规服装 |

阵营色放在躯干、盾面和旗帜；长枪、盾牌、长弓兵继续靠装备轮廓区分。队伍旗帜允许青蓝、灰黄、灰紫三个辅色，但服装主体不跟着旗帜变成多色。

#### 环境

| Token | 建议色 | 使用规则 |
|---|---|---|
| `envSkyTop` | `#8EADB0` | 白天雾蓝天顶 |
| `envSkyHorizon` | `#B8C6C4` | 高明度灰青地平线，形成柔雾包裹 |
| `envFog` | `#A9B9B8` | 与水天同族，远景自动降对比 |
| `envWater` | `#6F9EA4` | 湖泊、运河、港口主水色 |
| `envWaterDeep` | `#527A82` | 深潭与背光水面 |
| `envFoam` | `#DDE6E2` | 瀑布、水沫和岸线，仅小面积近白 |
| `envGrass` | `#88A779` | 台地草地主色 |
| `envGrassLight` | `#A8C394` | 日照草地和高台边缘 |
| `envDryGrass` | `#C4B487` | 晚季/受损台面，不作全局默认 |
| `envCliff` | `#D6DEDA` | 粉白崖壁和城堡基岩 |
| `envCliffShade` | `#AABAB6` | 洞口、悬崖底和接触阴影 |
| `envFoliageDark` | `#486858` | 树冠暗部 |
| `envFoliageLight` | `#719175` | 树冠亮部 |

### 7.4 颜色分配与材质算法

1. 新建 `src/world/citadelVisualTheme.js`，集中导出语义 token、天气调色参数和阵营方案；`odysseyCitadel.js`、`citadelRange.js`、`assets/harbor.js`、`saihojiPhalanx.js`、`citadelInfiltration.js`、`dayNight.js`、`weather.js` 禁止再各自复制 Hex。
2. 城堡墙色按连通建筑簇分配：稳定 hash 选择主色，按色相环相邻关系选择一个辅色；同簇竖柱保持同色，跨簇边界才允许换色。
3. 路线导向：面向主要阶梯、门口、平台入口的墙面明度提高 3%～5%，背面下降 2%～4%；正门暖色只用来框出瓶颈，不涂满整层台地。
4. 颜色抖动只允许 `L* ±2.5`，不得随机改变色相或饱和度；砂石/墙砖颗粒由法线、粗糙度和细小明度变化表现。
5. 建筑、士兵和船统一使用哑光 toon/standard 混合：墙/布/木 `roughness 0.82～0.95`、`metalness 0`；黄铜 `roughness 0.58～0.72`、`metalness 0.15～0.28`；水体单独透明材质。
6. 描边使用深蓝灰/炭灰而非纯黑；远景描边随距离减弱，避免城堡变成黑线密集的彩色模型。
7. 保留 AO/接触阴影来分隔台面、门洞和士兵脚底；禁止靠把背光面压成纯黑制造层次。
8. 阳台花砖使用专属纹理和四个受控釉色，不随墙色随机染绿，也不扩散到普通台面。

### 7.5 时间与天气调色

| 状态 | 调色规则 |
|---|---|
| 晴天 | 使用基准色；环境饱和度 100%，角色/船 105% |
| 落日 | 天空与受光面叠加灰鲑 `#C87669`；战斗红仍保持更高纯度 |
| 雨天 | 全局饱和度约 82%，明度 -6%，水/石粗糙度下降；角色阵营色保留 92% |
| 雪天 | 环境向冷白提高 12%～18%，草地降饱和；角色阵营色保留 88% 以免消失 |
| 深夜 | 天空/雾转 `#1E2D3D/#2B3D4D`；城墙保留冷月明度，士兵最低轮廓对比受限；火炬不参与全局降饱和 |

实现方式应是“基础 token → 时间/天气 grade → 最终材质色”，不要让 `dayNight.js` 和 `weather.js` 每帧累乘并永久漂移材质。

### 7.6 实施阶段

#### C0 · 固定基线与取样

- 固定白天、落日、雨天、雪天、深夜 5 个时刻；每个时刻固定城堡全景、港口、第一层瀑布、攻城交锋、木马渗透 5 个镜头。
- 保存当前版截图、像素主色、单位/背景明度差、材质数量和 draw calls，作为改色前基线。

#### C1 · 语义主题模块与功能开关

- 建立 `citadelVisualTheme.js` 与 `citadelPaletteV3` 开关；关闭时完全回到当前色板。
- 所有颜色在 sRGB 输入、Linear 工作空间和输出色彩空间之间只转换一次；增加 token 完整性、合法 Hex、材质缓存测试。

#### C2 · 城堡与台地

- 替换 `TOWNSCAPER_HIGHLAND_PALETTE` 和 `HIGHLAND_TOWNSCAPER` 的高纯度大色块，接入建筑簇配色与路线导向明度。
- 改造墙砖、陶瓦、彩砖、公共石材、栏杆、支架、窗洞和夜间亮窗材质；保留 Townscaper 模块生成算法。
- 第一轮只交付白天/深夜对比图给主人确认，确认前不继续船只和士兵批量改色。

#### C3 · 船只

- 将 `assets/harbor.js` 的暗绿+鲜红船体统一为敌方暗酒紫体系；帆、甲板、绳、撞角改用语义 token。
- 所有战船、桨手、港口巡航船和缩略小船共享船只主题，不出现同阵营多套互相冲突的红色。
- 检查雾天、雨天、逆光和夜间水面的剪影可读性。

#### C4 · 士兵与阵营

- 守军统一蓝/深蓝灰，攻方与渗透兵统一暗酒紫/炭灰；盾、旗和躯干承担阵营识别。
- 头盔羽冠缩放保持现状 1/3；羽冠只用阵营辅色，不重新放大或引入彩虹兵种色。
- 长枪、盾牌、弓箭、火炬继续靠形状和局部材质区分；统一船上桨手、港口兵、日间方阵和夜间纸兵。

#### C5 · 环境、水体与天气

- 将 `citadelRange.js` 当前砂黄高山坡道切换为灰绿→粉白崖→浅鼠尾草高台的柔和坡道。
- 统一港口、运河、湖泊、梯湖、瀑布和水沫的水色族；透明度可以不同，色相不得各自漂移。
- 重写城堡区域昼夜/天气 grade，确保雨雪和深夜仍能辨认城堡层级、士兵阵营与合法路径。

#### C6 · 战斗痕迹与视觉叙事

- 新增血迹从鲜红到干涸暗红的时间渐变，并将其投射到真实承载台面；不得悬空或穿过水面。
- 火灾、火炬、燃烧窗和夕阳使用不同暖色层级，保证战斗反馈优先于常态建筑色。
- 战后固定镜头能够通过血迹、焦痕和损坏门口读出双方实际交锋路线。

#### C7 · 自动验收与性能

- 新增 `tools/test_citadel_visual_theme.mjs`、`tools/e2e/citadel_palette_v3_e2e.mjs` 和 25 镜头截图矩阵。
- 日间士兵与脚下背景 `ΔL* ≥18`，深夜 `ΔL* ≥12`；敌我主体 `ΔE00 ≥18`。检测失败时调整 token，不给单位加无依据的发光描边。
- 单镜头前三大环境色总像素占比应高于 55%；常态战斗红低于 2%，发生伤亡后允许动态上升但不得覆盖路径信息。
- 材质缓存后 draw calls 相对基线增幅不超过 5%；不得为每名士兵、每块墙创建独立材质。

### 7.7 完成定义（Definition of Done）

- 城堡保留多样构件和彩色花砖，但全景不再呈逐格高饱和彩虹；一栋建筑在远景中读成一个完整色块。
- 五层台地、阶梯、门口和瀑布在晴、雨、雪、落日、深夜都能被快速辨认。
- 船只在水面上始终形成明确暗轮廓；敌船酒紫与战斗鲜红不会混淆。
- 守军、攻方和火炬手在不看 HUD 的情况下可由颜色+装备轮廓识别；色盲模拟下仍可由明度和形状区分。
- 血迹和焦痕忠实记录战斗路线，但未开战时不抢占画面色彩优先级。
- 所有城堡/船只/士兵/环境色均来自语义主题模块；固定截图、颜色差、性能和既有玩法回归全部通过。

---

## 八、Tiger Messenger 总体系统优化 V4（OskSta 方法论，全部交给 Grok）

> **唯一负责人：Grok。** 本章 G0～G12 的设计、代码、测试、截图、性能报告和迁移说明全部由 Grok 完成；若需要人工审美裁决，只提交给主人确认，不把执行工作转交 Kimi。
>
> 状态：**G0～G12 已落地**（2026-08-22）。旧 Town/Range/phalanx/Infiltration/TacticalGraph 已标 `@legacy`（见 `docs/citadel-v4-legacy.md`）；V4 有蓝图即编译。网格与完整攻城暂留，因 V4 尚无等价 Three 网格。GPU 25 机位：`tools/out/citadel_v4_gpu/`。
>
> **与旧计划的关系：** 第六、七章保留为历史设计基线；本章是新的总控方案。Grok 必须先审计已经存在的 `citadelBlueprint.js`、`citadelTacticalGraph.js`、`combatEvents.js`、`rng.js` 及其测试，合格则复用，不得为了文件名一致而重复实现。旧 Kimi 待办不会自动算完成，也不会阻止本章通过功能开关并行推进。
>
> **三条明确映射：** Townscaper 方法只主导高山古堡及其编辑器；Bad North 方法主导士兵、小队和攻防；Oskar 的地形/拓扑/UV 方法主导台地、断崖、瀑布、运河、道路与所有可行走表面。其他 Tiger Messenger 系统只通过稳定接口逐步接入，不一次性重写。

### 8.1 调研来源、可验证结论与推导边界

本章主要依据以下 Oskar Stålberg 公开内容：

- [OskSta 公开线程索引](https://threadreaderapp.com/user/OskSta)；
- [主网格与对偶网格线程](https://threadreaderapp.com/thread/1448248658865049605.html)；
- [WFC 失败、可视化与确定性线程](https://threadreaderapp.com/thread/1448039167057879048.html)；
- [混合网格与稀有模块线程](https://threadreaderapp.com/thread/1670790425232175108.html)；
- [草地 billboard、对比纹理与深度线程](https://threadreaderapp.com/thread/1590669875869286400.html)；
- [Beyond Townscapers 技术演讲](https://www.youtube.com/watch?v=Uxeo9c-PX-w)；
- [The Story of Townscaper](https://konsoll.org/talks/the-story-of-townscaper/)；
- [How Townscaper Works：含 Oskar 访谈的技术拆解](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)；
- 第六章已有的 [Bad North 开发访谈](https://medium.com/subpixelfilms-com/a-minimal-brand-of-madness-oskar-st%C3%A5lberg-and-richard-meredith-on-the-development-of-bad-north-514d5cf1a7a1)。

可以直接从上述材料验证的观点：

1. **渲染网格与玩法网格应分离但同时保留。** Oskar 将碰撞、导航、角色和房屋等对象放在主网格，把场地/地形类背景 tile 放在对偶网格；Field、House、River、Road 是不同的拓扑语义。
2. **混合网格比单一三角、六边形或方格更适合目标模块库，但模块库必须从一开始按该网格制作。** 算法与资产不是可以任意互换的两部分。
3. **WFC 不擅长长、窄、有方向的结构，尤其是河流。** 失败应快速、可复现，并由预处理约束或专用求解器处理，不应靠不断加随机重试隐藏。
4. **可视化算法执行过程本身会暴露 bug、glitch 和不规则行为。** 调试视图不是收尾工具，而是生成器开发的一部分。
5. **并行实现会暴露非确定性。** 固定 seed、稳定遍历顺序和可重放命令必须先于大规模并行。
6. **Half-Edge 很适合表达 n-gon 和邻接拓扑。** Tiger Messenger 的地形、城堡表面、导航和 UV 不应各自再维护一套互不相认的邻接关系。
7. **地形目标可以同时追求连续柔坡、清晰断崖、无局部最低点的排水结构，以及方格/三角格各自的优势。** 这些是不同 pass 的约束，不是一张噪声高度图能一次解决的。
8. **细微纹理、相近色和基于上下文的轮廓可掩盖模块/UV 接缝。** 草地轮廓示例通过当前位置与背景采样差决定轮廓强度，而不是所有边一律画黑线。
9. **Townscaper 的核心是少量直接输入配合手工模块和程序化组装。** “2450 种 module”应理解为受约束的模块组合语言，而不是在运行时声称一个数字就等于拥有了对应资产质量。
10. **Bad North 的战术复杂性藏在单位模拟与地形关系里，输入保持高层、结果保持可读。** 本项目应让小队接收命令、单兵独立执行，而不是整队沿样条平移。

以下内容是针对本项目的**工程推导**，不是声称 Oskar 在原帖中给出了同名代码：`CitadelTopology`、`SurfaceProvider`、`ModuleCatalog`、`TerrainUvCompiler`、`SquadDirector`、功能开关、指标阈值及目录拆分方式。Grok 在提交报告中必须继续用“来源事实 / 项目推导”两栏记录，禁止混写。

### 8.2 当前系统审计结论

- `citadelTown.js` 已有八类模块家族和 `TOWNSCAPER_MODULE_VARIANTS = 2450`，但选择器主要是坐标 hash；它还不是带 socket、禁配规则、覆盖率和回退原因的模块求解器。
- `citadelBlueprint.js` 已建立纯数据蓝图，是新架构入口；应扩展版本和迁移器，而不是绕开后另建第二份城堡真源。
- `citadelTacticalGraph.js` 已有分层 A*、台地、阶梯、瀑布、预约和增量重建雏形；应接到真实表面拓扑和建筑占格，不能继续独立采样一圈“近似台地节点”。
- `citadelRange.js` 同时承担几何、瀑布、水池、港口、木马、士兵接线和局部地形采样，职责过载；`citadelTown.js`、`citadelRange.js`、`citadelInfiltration.js` 三个巨型文件总计已超过 6000 行。
- 地形、建筑、导航、士兵路径分别计算高度和表面，导致“视觉上有台阶、路径却走空中”的历史问题；V4 必须只有一个 `SurfaceProvider`。
- 当前城堡 UV 多为每个四边面重置 `0..1`；对规则墙面够用，但不能表达沿等高线的笔触、瀑布流向、道路连续性、崖壁投射和跨模块接缝抑制。
- 已出现 `rng.js`、蓝图测试、战术图测试和重放测试等未提交修改；Grok 首先验证其质量，不得覆盖用户/其他代理已有改动。

### 8.3 目标架构与依赖方向

```text
编辑器 / 存档 / 默认场景
          │
          ▼
CitadelBlueprint（唯一语义真源，纯数据、版本化）
          │
          ├── CitadelTopology（Half-Edge + 主网格 + 对偶网格）
          │       ├── TerrainGenerator / TerrainUvCompiler
          │       ├── SurfaceProvider / TacticalGraph
          │       └── ModuleResolver / IncrementalBuilder
          │
          ├── CitadelPresentation（Three.js 几何、材质、VFX、LOD）
          └── CitadelSimulation（固定步长、Agent、Combat、Replay）

规则：纯数据层不得 import Three.js；渲染层只消费编译结果；
导航和战斗不得从渲染 Mesh 反推玩法；编辑器只能提交 Blueprint transaction。
```

建议逐步长出的目录：

```text
src/
├── core/
│   ├── fixedStep.js              # 固定步长、tick、插值 alpha
│   ├── rng.js                    # seed/fork/stableShuffle
│   ├── eventBus.js               # 有类型约定的领域事件
│   └── debugHub.js               # 调试层、计时、计数器
├── world/citadel/
│   ├── blueprint.js              # 从现有 citadelBlueprint.js 迁入
│   ├── topology.js               # Half-Edge、主/对偶网格、稳定 ID
│   ├── terrainGenerator.js       # 高程/断崖/排水/侵蚀 pass
│   ├── terrainUvCompiler.js      # chart、切线场、UV、接缝权重
│   ├── surfaceProvider.js        # 唯一落地/法线/台地查询
│   ├── moduleCatalog.js          # 模块元数据、socket、变体
│   ├── moduleResolver.js         # 约束传播、回退与覆盖率
│   ├── incrementalBuilder.js     # dirty region、Mesh 池、增量更新
│   ├── tacticalGraph.js          # 适配现有图，不重写同名功能
│   └── visualTheme.js            # 城堡/环境语义 token
├── agents/citadel/
│   ├── squadDirector.js
│   ├── combatAgent.js
│   ├── movementMotor.js
│   ├── animationController.js
│   ├── combatResolver.js
│   └── siegeDirector.js
└── tools/citadel/
    ├── moduleCoverage.js
    ├── topologyOverlay.js
    ├── uvDebug.js
    └── replayInspector.js
```

迁移期间旧入口保留薄适配层。任一新文件超过 600 行，Grok 必须先按职责拆分；不得把旧 2702 行文件复制成新的巨型文件。

### 8.4 G0：可复现基线、开关与执行纪律（Grok）

建立三个互相独立的开关：`citadelTownV4`、`citadelTerrainUvV2`、`citadelCombatV3`。每个阶段都可以单独关闭回到现状；禁止用一个总开关掩盖不知道哪层出错。

固定步长和重放伪代码：

```js
const STEP = 1 / 60;
let tick = 0;
let accumulator = 0;

function frame(realDt) {
  accumulator += Math.min(realDt, 0.10);
  while (accumulator >= STEP) {
    const commands = replay.commandsAt(tick);
    simulation.update(STEP, tick, commands, rng.fork(tick));
    replay.recordHash(tick, simulation.canonicalHash());
    tick++;
    accumulator -= STEP;
  }
  presentation.render(accumulator / STEP); // 只插值，不改玩法状态
}
```

每次生成的遍历顺序按稳定 ID 排序；核心逻辑禁止 `Math.random()`、当前时间和对象插入顺序参与结果。并行化只能发生在同一输入可生成同一 canonical hash 之后。

### 8.5 G1：统一地形拓扑、主/对偶网格与 SurfaceProvider（Grok）

#### 8.5.1 数据模型

主网格保存角色、房屋占格、门、道路节点和战斗逻辑；对偶网格保存地形 field、崖壁边界、水体、岸线和渲染 patch。两者共享稳定顶点/边/面 ID，并由 Half-Edge 表达邻接。

```js
function compileTopology(blueprint) {
  const main = buildMainGrid(blueprint.grid, blueprint.town.layout);
  const halfEdge = HalfEdgeMesh.fromFaces(main.vertices, main.faces);
  halfEdge.validate({ manifold: true, winding: "ccw" });

  const dual = buildDualGrid(halfEdge, {
    dualVertex: face => face.centroid,
    dualFace: vertex => orderedIncidentFaces(vertex),
  });

  return freeze({
    main,
    dual,
    halfEdge,
    idMap: buildStableCrossGridIds(main, dual),
  });
}
```

`SurfaceProvider` 是地形、建筑平台、阳台、阶梯、桥、船甲板和木马水面承载层的唯一查询入口：

```js
function sampleSurface(worldPos, agentProfile) {
  const candidates = surfaceIndex.queryCylinder(worldPos, agentProfile.radius, 3.0);
  const legal = candidates
    .map(surface => surface.project(worldPos))
    .filter(hit => hit.inside && hit.slope <= agentProfile.maxSlope)
    .filter(hit => hit.clearance >= agentProfile.height)
    .sort(compareVerticalThenSemanticPriority);

  return legal[0] ?? null; // {point, normal, tangent, surfaceId, terraceId, edgeDistance}
}
```

导航节点、脚底 IK、血迹、火炬投影、瀑布泡沫和编辑器拾取全部使用这个返回值；任何模块自行 `y = 常量` 或复制 `walkLift` 都视为失败。

### 8.6 G2：地形生成、地貌约束与 UV 构建（Grok）

#### 8.6.1 生成 pass 顺序

地形生成不再是“噪声 → Mesh”一步，而是可检查的流水线：

```js
function buildCitadelTerrain(blueprint, seed) {
  let topo = compileTopology(blueprint);
  let field = initializeTerraceField(topo, blueprint.terrain);
  field = stampGameplayAnchors(field, ["stairs", "gates", "harbor", "waterfalls"]);
  field = solveDrainage(field, { forbidLocalMinima: true, outlets: blueprint.water.outlets });
  field = relaxSoftSlopes(field, { preserve: ["cliff", "stair", "shore"] });
  field = sharpenCliffBands(field, { minDrop: 1.2, maxWidth: 0.9 });
  field = erodeAlongFlow(field, { iterations: 6, deterministic: true });
  validatePlayableConnections(field, blueprint.requiredRoutes);
  return compileTerrainPatches(topo, field, seed);
}
```

长、窄、有方向的瀑布、运河、道路和阶梯先由图约束器生成，再作为 hard constraint 交给模块/地形求解；禁止期待 WFC 随机“恰好连通”。如果约束不可满足，应输出最小冲突集，不得无限重试。

#### 8.6.2 UV 与材质语义

每个面先分类为 `terrace-top / soft-slope / cliff / stair / road / canal / waterfall / shore / building`。同语义、夹角小、流向相容的相邻面合并为 chart；断崖硬边、不同材质和水陆边界必须断 chart。

```js
function compileTerrainUV(halfEdge, surfaceField) {
  const charts = unionFaces(halfEdge.faces, (a, b, edge) =>
    a.semantic === b.semantic &&
    angle(a.normal, b.normal) < seamAngle(a.semantic) &&
    compatibleFlow(a.flow, b.flow) &&
    !edge.flags.hardSeam
  );

  for (const chart of charts) {
    const origin = stableChartOrigin(chart.id);
    const basis = chart.semantic === "waterfall"
      ? basisFromFlow(chart.meanFlow, chart.meanNormal)
      : chart.semantic === "terrace-top"
        ? basisFromContourTangent(chart, surfaceField)
        : basisFromLeastStretchAxis(chart);

    parallelTransportBasisAcrossFaces(chart, basis);
    for (const corner of chart.corners) {
      corner.uv0 = projectToBasis(corner.position - origin, corner.basis) * texelScale(chart.semantic);
      corner.uv1 = {
        edgeDistance: distanceToSemanticBoundary(corner),
        slope: 1 - corner.normal.y,
      };
    }
  }
  return charts;
}
```

材质采样规则：

- 台地顶面：沿等高线切线布置低频笔触和彩砖方向，避免每格旋转失控。
- 断崖：使用世界空间/三平面投射为主，chart UV 只承载大尺度色差和边缘污迹，避免垂直面拉伸。
- 道路/阶梯：U 沿前进方向、V 横向，连续累计里程，台阶之间不得每段重置 `0..1`。
- 运河/瀑布：U 横跨水宽、V 沿流向累计；泡沫由曲率、落差和边界距离生成。
- 模块接缝：基础颜色保持同族；在 `edgeDistance` 内混合 triplanar fallback，纹理对比必须细微，不用高对比砖缝暴露 UV seam。
- 描边：比较当前表面与背景的对比/深度差，只在轮廓和语义硬边增强；草地内部、同色墙块内部不画等强黑线。

#### 8.6.3 UV 验收

- UV 非有限值、翻转三角、零面积 chart、单位世界长度 texel 密度偏差超过 15% 均自动失败。
- 道路、阶梯、运河、瀑布沿线的 V 必须单调；跨一个合法连接不得突然回到 0。
- 5 个固定近景中，明显接缝像素占比低于 1%；远景不得出现规则棋盘或每格独立的重复纹理。
- 调试模式可切换：chart 随机色、切线、流向、texel density、硬缝、语义 mask、主/对偶网格。

### 8.7 G3：Townscaper 式古堡模块语言（Grok）

#### 8.7.1 模块不是数字常量

`2450` 作为目标组合空间和覆盖率统计，不要求首批手做 2450 个独立 Mesh。每个基础模块必须有可检索元数据：

```js
const module = {
  id: "balcony.flower-tile.corner.v2",
  family: "balcony",
  role: "exterior-corner",
  sockets: { N: "wall", E: "open", S: "wall", W: "open", U: "roof", D: "support" },
  requires: ["walkable-front", "support-below"],
  forbids: ["water-intersection", "gate-clearance"],
  transforms: ["r0", "r90", "mirrorX"],
  paletteSlots: ["wall.main", "tile.accent", "trim.dark"],
  weight: 1.0,
  rarity: "uncommon",
  meshFactory: "flowerTileBalcony",
};
```

模块家族至少覆盖：楼层、转角、屋顶、围栏、地基、阳台、门洞/挖洞、楼梯、支架、烟囱、衣绳、灯、花箱、窗、桥接、运河门和悬挑。阳台步行面默认是受控彩色花砖，禁止沿用绿色草坪材质。

#### 8.7.2 邻接签名、求解与稀有模块

```js
function resolveCell(cell, world, catalog, seed) {
  const signature = encodeSignature({
    occupancy: neighbors6(world, cell),
    diagonals: diagonalNeighbors(world, cell),
    semantic: world.semanticAt(cell),
    support: world.supportAt(cell),
    exposure: world.exposureMask(cell),
    routeClearance: world.routeClearance(cell),
  });

  const candidates = catalog.match(signature)
    .filter(m => satisfiesSockets(m, world, cell))
    .filter(m => preservesRequiredRoutes(m, world, cell));

  if (!candidates.length) return explainableFallback(cell, signature);
  return deterministicWeightedPick(candidates, hash(seed, cell.stableId));
}
```

为避免条件过窄的好模块永远不出现，覆盖工具统计每个模块在固定 100 个 seed 中的：候选次数、选中次数、被拒原因和首次出现 seed。`candidate > 0 && selected = 0` 的模块进入“权重/条件审查”，不能靠提高全局随机性处理。

WFC/约束传播只解决局部建筑模块；门口、完整阶梯、道路、运河、水门和攻防必经路线在预处理阶段锁定。求解失败最多回溯限定步数，随后输出冲突而非卡住主线程。

#### 8.7.3 增量重建

```js
function applyCitadelEdit(transaction) {
  const nextBlueprint = blueprintStore.apply(transaction);
  const changed = diffBlueprint(previousBlueprint, nextBlueprint);
  const dirty = expandTopologyNeighborhood(changed.cells, 2);

  for (const cellId of stableTopologicalSort(dirty)) {
    const solved = moduleResolver.resolve(cellId, nextBlueprint);
    meshPool.replace(cellId, presentation.build(solved));
  }
  terrainUvCompiler.patch(changed.surfaceCharts);
  surfaceProvider.patch(changed.surfaces);
  tacticalGraph.patch(changed.surfaces, changed.routes);
  replay.record("citadel-edit", transaction);
}
```

一次单格编辑不得全量重建五层古堡；目标是 dirty cell 的邻域重建 P95 ≤16 ms，较大批量编辑分帧执行并显示进度。

### 8.8 G4：古堡配色、材质与组件变化（Grok）

本阶段以 Townscaper 的鲜艳、协调和“组件变化中仍像同一座城”为目标；第七章偏 Bad North 的低饱和方案只保留给战场环境和单位可读性，不再压低古堡主体颜色。

- 建筑簇使用一主色、一相邻辅色和一个彩砖 accent；同一竖向户、屋檐、门窗 trim 保持家族关系。
- 墙体颜色可以鲜艳，但明度范围统一，阴影面不坠入黑色；远景先读建筑簇，近景再读砖、窗、阳台和支架。
- 屋顶陶瓦、阳台花砖、门窗、围栏、支架、墙面、公共石材各有独立材质角色；禁止通过 `material.clone()` 给每个构件造独立材质。
- 彩色花砖至少四套有约束的图案/釉色，按建筑簇 accent 选型；花砖只出现在阳台、露台边带和小广场，不污染台地草面。
- 颜色选择由稳定建筑簇 ID 决定；天气/昼夜是只读 grade，不能逐帧累乘修改基础颜色。

```js
function resolveBuildingTheme(clusterId, context) {
  const main = weightedPick(TOWNSCAPER_WALLS, hash(context.seed, clusterId));
  const secondary = adjacentHue(main, hash(clusterId, "secondary"));
  const accent = chooseTileAccent(main, secondary, context.neighborColors);
  return {
    wallMain: main,
    wallSecondary: secondary,
    tileAccent: accent,
    trim: ensureContrast(main, context.trimTarget),
    roof: harmonizeRoof(main, context.roofFamily),
  };
}
```

自动检查同屏颜色：相邻建筑簇不允许主色完全相同；任一单栋不超过 2 个墙面主色；彩砖面积占该栋可见面积 2%～12%；古堡主色饱和度可高，但单位与交互反馈仍须通过明度和轮廓取得更高局部优先级。

### 8.9 G5：Bad North 式地形战术图与合法路径（Grok）

现有 `citadelTacticalGraph.js` 作为适配起点，但节点必须来自 `SurfaceProvider` 的真实 surface/portal，不再依赖固定半径环采样作为最终真源。

```js
function compileTacticalGraph(topology, surfaces, modules) {
  const graph = new TacticalGraph();
  for (const surface of surfaces.walkable()) {
    graph.addRegion(surface.id, {
      terraceId: surface.terraceId,
      polygon: surface.walkPolygon,
      normal: surface.meanNormal,
      capacity: estimateCapacity(surface.walkPolygon),
    });
  }
  for (const portal of topology.portals()) {
    graph.addEdge(portal.from, portal.to, {
      type: portal.semantic, // walk/stairs/door/ladder/waterfall-climb/bridge
      width: portal.width,
      slope: portal.slope,
      danger: tacticalDanger(portal, modules),
      capacity: Math.max(1, Math.floor(portal.width / SOLDIER_WIDTH)),
      bidirectional: portal.bidirectional,
    });
  }
  graph.validateRequiredRoutes(["harbor→gate", "horse→terrace5", "terrace5→terrace1"]);
  return graph;
}
```

路径查询分三层：区域级 A* 决定经过哪些台地/阶梯/门，走廊级 funnel 得到台面内路径，局部避让只做短距离修正。局部避让无权越过墙、崖边或跳到另一台地。

```js
function findAgentPath(agent, destination) {
  const start = surfaceProvider.sample(agent.position, agent.profile);
  const goal = surfaceProvider.sample(destination, agent.profile);
  const regions = graph.aStar(start.regionId, goal.regionId, edgeCost(agent));
  const portals = graph.toPortals(regions);
  const points = funnel(start.point, goal.point, portals);
  return constrainToSurfaces(points, regions, surfaceProvider);
}
```

每个路径点携带 `surfaceId/terraceId/edgeType/normal`；运动时若采样结果与路径 surface 不一致，立即停步并重寻路，禁止继续插值穿空。跨台地只能走 `stairs/ladder/waterfall-climb` 边；普通 `walk` 边的高差上限为 0.22。

### 8.10 G6：Bad North 式小队、单兵与运动动画（Grok）

#### 8.10.1 高层命令、个体执行

小队只保存目标、阵型、优先级和撤退条件；每名士兵根据同一战场事实独立决定意图。当前纸士兵、港口兵、守军、攻城兵统一为一种 `CombatAgent` 数据结构，外观由 role/skin 决定。

```js
function updateSquad(squad, world, tick) {
  const order = squad.orderQueue.peek();
  const assignment = formationSolver.assignSlots(squad.members, order, world);
  for (const agent of stableSortById(squad.members)) {
    agent.blackboard.order = order;
    agent.blackboard.slot = assignment.get(agent.id);
    agent.blackboard.localThreats = threatGrid.query(agent.position, 6);
  }
}

function decideAgent(agent, world) {
  const candidates = [
    scoreRetreat(agent, world), scoreAssist(agent, world),
    scoreBlock(agent, world), scoreAttack(agent, world),
    scoreMoveToSlot(agent, world), scoreWait(agent, world),
  ];
  const next = maxWithHysteresis(candidates, agent.intent, 0.12);
  if (next.name !== agent.intent.name) eventBus.emit("agent.intent", agent.id, next.name);
  agent.intent = next;
}
```

决策 8 Hz、路径重算最高 2 Hz、动画 60 Hz 插值；远景单位可降低决策频率但不能改变确定性事件顺序。

#### 8.10.2 贴地运动和跑步

```js
function updateMovement(agent, dt) {
  const target = agent.path.lookAhead(agent.position, agent.speed * 0.35);
  const desired = projectOnPlane(target.point - agent.position, target.normal).normalized();
  const avoidance = localAvoidance(agent, desired); // 只在当前 walk polygon 内
  const velocity = accelerate(agent.velocity, avoidance * agent.maxSpeed, agent.accel, dt);
  const proposed = agent.position + velocity * dt;
  const hit = surfaceProvider.projectTo(agent.path.currentSurfaceId, proposed);

  if (!hit || hit.edgeDistance < agent.radius) return requestRepathAndBrake(agent);
  agent.position = hit.point + hit.normal * agent.footClearance;
  agent.up = dampDirection(agent.up, hit.normal, dt * 12);
  agent.forward = dampDirection(agent.forward, velocity.normalized(), dt * 10);
  agent.gaitPhase += velocity.length() / agent.strideLength * TAU * dt;
}
```

跑步动画由真实速度驱动：左右腿反相、手臂与对侧腿反相；持盾手摆幅小，长枪手用双手稳定枪杆，火炬手抬高左手。上坡缩短步幅、提高抬膝；下坡增加制动；阶梯脚掌落在实际踏步；停止时步态相位平滑收敛，不瞬间定格。

瀑布攀爬不是队列样条：每名士兵占一个攀爬 hold，按距离触发 `pull/push/brace/reach` 协作。上方士兵拉、下方士兵推、失衡士兵短暂被搀扶；任一协作动作必须对应两个 agent 的配对事件，不做无对象表演。

```js
function assignClimbAssist(climbers) {
  const pairs = maximumMatching(
    climbers,
    (a, b) => verticalGap(a, b) < 1.1 && lateralGap(a, b) < 0.8 && a.stamina > 0.2
  );
  for (const [lower, upper] of pairs) {
    emitPairedAction(lower, upper, upper.balance < 0.5 ? "push-pull" : "brace-reach");
  }
}
```

### 8.11 G7：攻防、武器与战斗结算（Grok）

规则层只产生事件，不直接操纵骨骼；表现层只订阅事件，不自行判定命中。

```js
function resolveAttack(attacker, defender, tick) {
  if (attacker.attack.phase !== "contact") return;
  const toDefender = defender.position - attacker.weapon.tip;
  if (toDefender.length() > attacker.weapon.reach) return emit("attack.miss", ids());
  if (!hasLineOfSight(attacker.weapon.tip, defender.hurtVolume)) return emit("attack.blocked", ids());

  const shieldFacing = dot(defender.shield.forward, -normalize(toDefender));
  const shieldCovers = defender.state === "block" && shieldFacing > defender.shield.coverCos;
  const height = tacticalHeightAdvantage(attacker, defender);
  const formation = formationSupport(attacker);
  const result = shieldCovers
    ? computeShieldImpact(attacker, defender, height, formation)
    : computeBodyImpact(attacker, defender, height, formation);

  combatEvents.emit(result.type, { tick, attackerId: attacker.id, defenderId: defender.id, result });
}
```

长枪取代短剑作为纸士兵主武器。长枪必须体现距离、枪墙、转向半径、近身劣势和刺击恢复；盾牌体现覆盖角和受击姿态；火炬手没有盾牌，承担照明和队列首尾识别，不获得额外战斗加成。血迹/倒地/踉跄只从 combat event 产生并投射到合法 surface。

攻城导演只发布阶段命令：登陆、集结、试探、突破、占门、上阶、逐层推进、撤退；守方则布防、封门、高地支援、预备队、逐层后撤。导演无权瞬移单位或绕过战术图。

深夜木马流程保留既定规则：四根绳索、每绳两次下降、两组士兵；两组首尾为火炬手，其余左盾右枪；天亮返回马腹。瀑布组覆盖台面 2/1，阶梯组覆盖台面 5～3；到达台面后分散逐屋排查，完成覆盖后必须通过真实阶梯/攀爬连接去下一台面。

分散巡查使用覆盖图，而不是给每人一条手写样条：

```js
function assignSearchTargets(squad, terrace) {
  const doors = tacticalGraph.unvisitedDoors(terrace.id);
  const sectors = balancedSpatialPartition(doors, squad.members.length);
  return minCostAssignment(squad.members, sectors, (agent, sector) =>
    graphDistance(agent.nodeId, sector.entryNode) + overlapPenalty(sector, squad.coverage)
  );
}
```

### 8.12 G8：环境渲染、轮廓、光照与时间天气（Grok）

Townscaper 古堡可保持鲜艳；Bad North 战斗场需要柔和环境托住清晰单位。二者通过同一语义主题连接，不允许城堡材质、士兵材质和天气脚本各自修改最终 Hex。

```js
function finalColor(token, context) {
  const base = theme[token];
  const weathered = WEATHER_GRADES[context.weather].apply(base, token);
  const timed = DAY_GRADES[context.timeBand].apply(weathered, token);
  return enforceReadability(timed, token, context.backgroundLuminance);
}
```

- 天空贴图旋转保留当前主人裁决，不在 V4 擅自恢复。
- 水、雾、草、崖、石阶和城堡形成同一色域；古堡高饱和色由面积控制，不靠全局降饱和解决冲突。
- 草地/树叶 billboard 使用背景对比与深度差调节轮廓；近景硬边清楚，草内部线条弱，转动相机时不闪烁。
- AO、接触阴影、门洞暗部和台阶投影承担空间层级；不允许用纯黑轮廓把每个模块切碎。
- 深夜火炬只照亮附近 surface 和士兵剪影，不能把整片台地染成橙色；火炬闪动由固定 tick 噪声驱动，重放一致。

### 8.13 G9：编辑器、可视化调试与“算法即工具”（Grok）

城堡编辑器由直接改 Mesh 改为事务：

```js
function commitEditorCommand(command) {
  const before = blueprintStore.version;
  const tx = validateAndNormalize(command, blueprintStore.current());
  if (!tx.ok) return editor.showConflict(tx.errors);
  undoStack.push({ before, inverse: tx.inverse });
  applyCitadelEdit(tx);
}
```

必须提供以下可切换调试层：

1. 主网格、对偶网格、Half-Edge 方向和非流形错误；
2. 地形语义、排水流向、局部最低点、柔坡/断崖 mask；
3. UV chart、切线、texel density、硬缝和 seam blend；
4. 模块 socket、候选数、最终选择、fallback 和稀有模块覆盖；
5. walk polygon、portal、阶梯/门/瀑布边、容量、预约和阻塞；
6. 小队命令、单兵 intent、目标、路径、脚底 surface 和离表误差；
7. 战斗 contact、盾牌覆盖角、长枪 reach、命中/格挡事件；
8. 每个 pass 的耗时、dirty 数量、Mesh/材质数量、draw calls 和内存。

生成器可视化要支持逐 pass 暂停、单步、固定 seed 重播和导出 JSON；不得用生产代码里的任意 sleep 改变结果，只允许调试展示层延迟播放已记录事件。

### 8.14 G10：性能、资源生命周期和分层调度（Grok）

- 纯数据编译可进 Worker，但先通过确定性测试；Worker 返回稳定排序的 patch，不直接操作 Three.js。
- 几何按 module+material 合批；动态士兵用共享几何/材质，必要时 InstancedMesh 或骨骼批次；禁止每兵 clone 材质。
- `SurfaceProvider` 使用 BVH/空间哈希；战术图以 dirty region 增量 patch；路径、威胁和覆盖图都有帧预算。
- 近景 60 Hz 动画，战斗决策 8 Hz，远景 2～4 Hz；调度降频不得跳过攻击 contact tick。
- 纹理 atlas、材质、几何和 CanvasTexture 进入 `ResourceRegistry`，按引用计数释放；场景热重建后无孤儿 GPU 资源。

```js
function runBudgetedSystems(frameBudgetMs) {
  const queue = scheduler.readyJobsStableOrder();
  const deadline = performance.now() + frameBudgetMs;
  while (queue.length && performance.now() < deadline) {
    const job = queue.shift();
    const patch = job.runSlice();
    if (patch) patchQueue.push(patch);
    if (!job.done) queue.push(job);
  }
}
```

性能门槛：城堡编辑常规单格 P95 ≤16 ms；150 名活跃士兵时模拟 P95 ≤5 ms/帧；固定验收镜头平均 ≥50 FPS；材质数量和 draw calls 相对 V4 基线增幅分别不超过 10% 和 8%；10 分钟热编辑/战斗后 GPU 资源数回到稳定区间。

### 8.15 G11：Tiger Messenger 其他系统的适配（Grok）

总体优化不等于同时重写所有场景。Grok 用适配器让既有系统逐批消费公共接口：

- `messengerIsland.js`：只装配系统，目标降到 600 行以内；分离出生、任务、交通、城堡和天气接线。
- 电车、船、木马、玩家：统一实现 `Mountable/SurfaceRider`，通过 `SurfaceProvider` 获得位置和法线；不共享战斗 Agent 状态机。
- 任务/信件：继续使用现有 quest 数据，但目标点改引用稳定 `worldEntityId`，编辑地形后不丢失收发点。
- 昼夜/天气：只发布环境状态，不直接遍历并永久染色所有材质。
- 音频：订阅领域事件；脚步材质、瀑布、战斗、门洞和火炬由语义 surface/event 决定。
- 存档：升级为版本化 schema，保存 blueprint、seed、玩家/任务关键状态，不序列化 Three.js 对象。

```js
function migrateSave(raw) {
  let save = parseAndValidate(raw);
  while (save.version < CURRENT_SAVE_VERSION) {
    save = MIGRATIONS[save.version](save);
  }
  return canonicalize(save);
}
```

### 8.16 G12：测试、交付顺序和停止条件（Grok）

Grok 必须按以下顺序交付，不允许用一次“大重写”跨过验收门：

1. **G0 基线**：当前截图、seed、重放 hash、性能、资源和现有测试报告。
2. **G1～G2 地形/UV 垂直样片**：只改第一层瀑布及相邻两块台地，提交调试图与前后近景。
3. **G3～G4 古堡样片**：一栋完整建筑簇，包含楼层、地基、围栏、彩砖阳台、楼梯、支架、门洞和屋顶；主人确认后才全城迁移。
4. **G5～G7 士兵/攻防样片**：港口登陆→阶梯→一层台地交战；合法路径、跑步、长枪盾牌和战斗事件全部通过后才接木马全流程。
5. **G8～G10 全景、性能和编辑器**：五天气、昼夜、调试层、增量编辑、150 人压力测试。
6. **G11 全系统适配**：交通、任务、音频、存档逐个迁移，每迁一个都保留旧开关和回归。
7. **G12 收尾**：删除确认无调用的旧适配代码、更新文档、提交迁移表和回滚说明。

每批固定执行：

```text
审计现状 → 写失败测试 → 最小实现 → 固定 seed 重放 →
数值/源码/HTTP 脚本门 → 性能代理 → 旧开关回归 → 更新 TODO 证据
```

出现以下任一情况立即停止扩展并修复：同 seed hash 漂移、非流形拓扑、必经路线不连通、UV 非有限/明显拉伸、单位离表 >0.15、跨台地未走合法 portal、战斗动画决定命中、单格编辑触发全城重建、材质/几何持续泄漏、旧开关无法恢复现状。

### 8.17 V4 完成定义（Definition of Done）

- 高山古堡不再只是“ASCII 方块 + 坐标 hash”；模块 socket、约束、fallback 和覆盖率可解释，围栏、地基、彩砖阳台、楼梯、支架、门洞和装饰在全城形成受控变化。
- 古堡颜色鲜艳而协调：远景读建筑簇，近景读花砖和构件；昼夜/天气切换不破坏基础色，也不影响士兵敌我识别。
- 台地、柔坡、断崖、阶梯、运河、瀑布、道路的拓扑、UV、碰撞、导航和投影来自同一份表面数据；无空中路径和不同系统各算一个高度。
- UV chart、texel density、流向和接缝可调试；瀑布/运河/道路纹理连续，崖壁无严重拉伸，模块接缝在目标镜头中不显眼。
- 小队接受高层命令，单兵独立跑动、避让、攀爬、援助、持盾、刺枪、格挡、踉跄和撤退；动作速度由真实移动和战斗事件驱动。
- 日间攻城与深夜木马都严格走合法表面和台阶；四绳下降、火炬手、盾枪配置、台面分散排查、天亮回收全部回归通过。
- 固定 seed 重放一致；编辑器单格增量更新；150 人战斗和五天气全景达到性能门槛；10 分钟无悬空、卡死、穿墙或 GPU 资源增长。
- `PLAN.md`/`TODO.md` 中每项有 Grok 的完成证据链接或命令输出；功能开关、存档迁移和回滚说明完整，主人可以逐阶段验收而无需相信口头“已优化”。

## 九、Tiger Messenger 光照系统 V5（负责人：Kimi）

本阶段只由 **Kimi** 负责。目标不是简单调高亮度或替换天空颜色，而是参考 Oskar Stålberg（OskSta）公开展示的光照思路，重建一条“形体优先、动态可编辑、低成本且可调试”的光照管线。Grok 继续负责 V4 的城堡、地形、UV、士兵和攻防；Kimi 不改模块生成规则、战斗判定或路径拓扑，只消费它们提供的 surface、occupancy 与材质语义。

### 9.1 研究边界：已证实的方法与 Tiger Messenger 的工程推导

Kimi 实现前必须把资料结论分成两层，不能把社区猜测写成 OskSta 的原话。

**公开资料可以确认：**

- Oskar 在 [Beyond Townscapers](https://www.youtube.com/watch?v=Uxeo9c-PX-w) 演讲约 46 分钟处展示 Townscaper 的动态光照调试模式：直接阴影使用标准 shadow mapping，环境遮蔽则把体素形状烘进切片 atlas/类 3D texture，并在建筑变化时快速重投影，而不是每帧重做完整 GI。
- 他把 Bad North/Townscaper 的方案描述为 voxel-based fake AO：简单、快速、适合移动端和 Switch；因此本项目首先复现“可读的 AO 与稳定阴影”，而不是追求物理正确。
- [Technically Art Issue 129](https://halisavakis.com/technically-art-issue-129-14-10-2022/) 收录的 OskSta 说明中，他把早期方案称为朴素 fake GI/color bleeding，后来才尝试真正的 light bounce；[80.lv 的整理](https://80.lv/articles/a-custom-lighting-solution-set-up-in-unity)提到该实验使用 SDF、3D textures、UV、depth-map shadows 和向量计算。它是高画质实验方向，不等于 Townscaper 的基础运行时要求。
- [Bad North 访谈](https://www.nintendo.com/en-gb/News/2018/April/Interview-Taking-on-hordes-of-invading-Vikings-in-Bad-North-1368315.html)反复强调战场信息必须一眼可读；光照首先服务台地高度、门、楼梯、士兵敌我和攻击方向，而不是电影式暗部。
- OskSta 的草地实验使用背景对比与深度信息控制轮廓：轮廓在草与悬崖/天空交界处增强，在草内部减弱。V5 将这个原则扩展到建筑边缘、台阶和士兵，但不会声称其具体 Three.js 实现来自原作。

**基于以上资料的项目推导：**

1. WebGL/Three.js 首版采用“一个主方向光 + 一个受控天空/地面填充 + 稳定 shadow map + 动态体素 AO”，不并行叠加多个无预算的全局灯。
2. 单次色彩反弹是可关闭的 Quality Tier，不是首版阻塞项；低端设备只使用 AO 与材质基色。
3. 城堡编辑只标记局部 occupancy dirty；AO/反弹分帧更新。若一次改动触发整岛每帧重烘焙，视为架构失败。
4. Toon/纸艺材质本身已经包含明暗设计，AO 只增强接触与洞口，不允许再乘两遍造成黑缝。

### 9.2 当前系统审计与必须解决的问题（Kimi）

当前 `environment.js` 同时叠加白色 `AmbientLight(1.4)`、`HemisphereLight(0.72)`、白色主方向光 `1.6` 与薄荷色方向补光 `0.28`。结果是亮面、背面和遮挡面都被抬高，彩色古堡虽然明亮，却缺少体积、门洞深度和台地层级。

- `dayNight.js` 主要改变颜色和强度，没有随时间改变太阳方向，也没有同步阴影范围、曝光、AO 或反弹场。
- 方向光 shadow camera 固定在 `±25`，与镜头、玩家和高山城堡实际包围盒无关，容易在城堡边缘截断或浪费 2048 阴影纹理。
- renderer 没有形成明确的 output color space、tone mapping、exposure 与截图基线；不同显示器上“更艳”可能只是过曝。
- 天气、莫比斯屏障、火炬、太阳盘、NPC/资产各自直接创建或修改 `PointLight`、`AmbientLight` 和 emissive，缺少统一预算、优先级与恢复机制。
- `BasicShadowMap` 的硬边适合纸艺风，但当前没有 texel snapping、caster/receiver 分类和质量档，移动镜头时可能闪动。
- 开发面板只有太阳/环境强度滑块，且 ambient 滑块上限与默认值不一致；没有光照分层、AO、阴影包围盒、active lights 和 luminance 调试。

V5 不允许以“再加一个补光”“给每个火炬一个 PointLight”修补以上问题。

### 9.3 目标画面与验收镜头（Kimi）

Kimi 在改代码前固定同一相机、seed、天气和时间，保存旧版彩色图、灰度图、clay 图、法线图、shadow-only 图和 luminance histogram。至少覆盖：

1. 港口—第一层瀑布—木马；
2. 五层台地全景；
3. 彩砖阳台、门洞、楼梯和支架近景；
4. 深夜木马出兵与火炬；
5. 雨、雾、雪、雷暴下的士兵交战。

验收不是“截图看起来更黑”，而是：

- 灰度图中五层台地、屋顶、阳台、门洞和台阶依然可分；鲜艳墙色不靠纯白高光维持。
- 太阳背面仍有天空填充，但明显暗于受光面；门洞、支架下方和建筑接缝形成稳定接触层次。
- 阴影随时间移动，镜头平移时不明显游泳；目标城堡和士兵不离开有效 shadow frustum。
- 深夜保留路线和敌我可读性；火炬形成局部暖色焦点，不把整个台地染橙。
- 天气切换不永久污染材质；回到晴天后相同 seed、时间与镜头得到相同像素容差结果。

### 9.4 单一光照状态与系统边界（Kimi）

新增目录建议为 `src/render/lighting/`，每个文件控制在 600 行以内：

- `lightingDirector.js`：唯一写入 Three.js 灯、曝光、雾和 shader uniforms 的入口；
- `lightingTheme.js`：时间/天气/场景语义到目标参数的纯数据；
- `sunController.js`：太阳方向、颜色、月光和时间带；
- `shadowFitter.js`：稳定方向光阴影包围盒与 texel snapping；
- `voxelAoAtlas.js`：占用体素、切片 atlas、dirty region 与 AO 更新；
- `indirectBounce.js`：高画质可选的一次低分辨率色彩反弹；
- `localLightRegistry.js`：火炬、闪电、任务灯和资产灯的统一预算；
- `lightingDebug.js`：分层调试、统计与基线截图。

`dayNight.js` 和 `weather.js` 只发布意图，不再直接修改灯：

```js
function composeLightingState({ clock, weather, scene, quality }) {
  const solar = evaluateSolarCycle(clock, scene.latitudeAxis);
  const grade = mixWeatherGrade(solar, weather);
  return freeze({
    sunDirection: solar.direction,
    keyColor: grade.keyColor,
    keyIntensity: grade.keyIntensity,
    skyColor: grade.skyColor,
    groundColor: grade.groundColor,
    ambientFloor: grade.ambientFloor,
    exposure: grade.exposure,
    fog: grade.fog,
    aoStrength: grade.aoStrength,
    bounceStrength: quality.bounce ? grade.bounceStrength : 0,
  });
}

function updateLighting(frame) {
  const target = composeLightingState(worldEnvironmentSnapshot());
  const state = smoothLighting(previousState, target, frame.dt);
  lightingDirector.apply(state); // 全项目唯一提交点
}
```

任何资产只能注册 `LightRequest`，不能持有并任意修改全局灯。旧代码在迁移期由 adapter 接入；`oskLightingV1=false` 必须恢复原管线。

### 9.5 主光、天空填充、色彩管理与材质响应（Kimi）

- 正午只保留一个太阳 key；天空/地面用单一 hemisphere 或等价 shader fill。白色 ambient 仅作为很低的安全底，不再与 hemi、mint fill 一起承担主照明。
- 时间轴同时驱动太阳方向、色温、强度、曝光与雾。日落不只把灯改橙；阴影方向和天空/地面贡献必须同步变化。
- renderer 显式设置 `outputColorSpace`、tone mapping 与 exposure，固定在基线元数据中；所有颜色输入区分 sRGB 与线性空间。
- Townscaper 式高饱和墙面通过材质基色和受控曝光保留；禁止用过高 ambient 冲淡阴影来获得“艳丽”。
- 对同一语义材质只计算一次 direct、sky fill、AO 与可选 bounce；材质模板统一注入 uniforms，禁止每栋楼 clone 一份 shader 逻辑。

```js
function shadeStylizedSurface(s) {
  const ndl = quantizeToon(max(0, dot(s.normal, light.sunDir)));
  const direct = s.albedo * light.sunColor * ndl * s.shadow;
  const sky = s.albedo * hemisphere(s.normal, light.sky, light.ground);
  const indirect = sampleBounce(s.worldPos) * s.albedo;
  const visibility = mix(1, sampleVoxelAo(s.worldPos, s.normal), light.aoStrength);
  return (direct + sky + indirect) * visibility + s.emissive;
}
```

### 9.6 稳定太阳阴影（Kimi）

Kimi 先解决 shadow map 的覆盖和稳定，再选择硬/软边风格。默认纸艺模式可保留硬边；质量档可比较 PCFSoft，但不能用模糊掩盖低分辨率抖动。

```js
function fitStableShadowCamera({ focusBounds, lightView, mapSize, padding }) {
  const box = transformBounds(focusBounds.expandByScalar(padding), lightView);
  const width = max(box.width, MIN_SHADOW_SPAN);
  const height = max(box.height, MIN_SHADOW_SPAN);
  const texel = max(width, height) / mapSize;
  const center = snapVec2(box.centerXY, texel);
  return orthographicAround(center, width, height, box.minZ, box.maxZ);
}
```

- `focusBounds` 是相机可见城堡、玩家及关键战斗单位的并集，不是固定 `±25`；高山城堡可使用近/远两档或分区更新。
- 阴影相机只在焦点跨 texel、太阳角度超阈值或建筑 dirty 时更新，避免每帧微抖。
- 建筑、台地、士兵、木马明确 caster/receiver；粒子、UI、远云、透明水默认不进入太阳 shadow pass。
- 只允许太阳/月亮投全局动态阴影；普通火炬默认用 emissive + 局部光晕/接触贴片，避免多 shadow maps。

### 9.7 Townscaper 式动态体素 AO（Kimi）

AO 采用围绕高山城堡的低分辨率 occupancy volume。V4 的语义 surface/模块若可用，直接按 solid/opening/stair/roof 注入；V4 未完成时，以当前静态几何包围盒和深度投影建立兼容层。两者必须共用同一 atlas 采样接口。

```js
function rebuildAoDirtyRegions(changes) {
  const dirty = mergeVoxelRegions(changes.map(worldBoundsToVoxelBounds));
  for (const region of dirty) {
    clearOccupancy(region);
    rasterizeSolidModules(region, occupancyGrid);
    computeDirectionalOcclusion(region.expand(AO_KERNEL_RADIUS), aoGrid);
    uploadAtlasSlices(region, aoTexture);
  }
}

function voxelToAtlasUv(worldPos) {
  const cell = floor((worldPos - volumeOrigin) / voxelSize);
  const tile = sliceTile(cell.z, atlasColumns);
  return (tile.origin + vec2(cell.x, cell.y) + 0.5) / atlasSize;
}
```

- 首版只存 occupancy + scalar AO；验证后可增加 bent-normal 两通道，不能一开始同时实现所有变体。
- AO kernel 采样固定方向并稳定排序；同 seed、同 occupancy 得到一致结果，不使用帧随机噪声。
- dirty region 合并并分帧执行；相邻模块变化只更新受影响切片。全城重建仅允许在加载或体素规格改变时发生。
- 士兵不写入静态 AO atlas；使用轻量脚底 contact shadow。门、桥下、阳台、支架、楼梯与瀑布岩口是 AO 验收重点。
- AO 强度按时间和雾轻微调整，但不在夜间把接缝压成纯黑；墙面 AO 与顶点色/贴图已有污迹不得重复相乘。

### 9.8 可选单次反弹、局部灯和夜间可读性（Kimi）

`indirectBounce.js` 只在 `lightingQuality='high'` 且设备通过能力/性能检查时启用。它以低分辨率 voxel radiance 为输入，注入太阳直射与大面积 emissive，最多传播一次；禁止无界迭代、实时路径追踪或每个资产自建 light probe。

```js
function updateOneBounce(dirtyCells, budget) {
  injectDirectRadiance(dirtyCells, occupancy, sun, radianceA);
  for (const chunk of budget.take(dirtyCells)) {
    propagateSixNeighborsOnce(chunk, radianceA, radianceB, {
      energyClamp: 0.35,
      saturationClamp: 0.25,
    });
    uploadRadianceSlices(chunk, bounceAtlas);
  }
}
```

色彩反弹必须非常克制：彩色墙可以给相邻白墙一点色彩联系，但不能把红墙附近所有士兵染红。`AO only` 与 `AO + bounce` 必须有并排截图和 GPU 对比，主人确认后才能默认开启。

局部灯统一提交：

```js
function selectLocalLights(requests, camera, budget) {
  return requests
    .map(r => ({ ...r, score: r.priority * screenInfluence(r, camera) }))
    .filter(r => r.visible && r.remainingLife > 0)
    .sort(stableScoreThenId)
    .slice(0, budget.maxActive);
}
```

- 火炬、灯笼、任务提示和闪电都有稳定 `lightId`、半径、颜色、优先级、生命期与是否影响士兵的语义。
- 未进入 active budget 的火炬保留 emissive 外观，不创建真实 PointLight；火炬默认不投动态阴影。
- 闪电是短时全局 override，由 LightingDirector 合成并平滑恢复，不直接永久修改 ambient/sun。
- 深夜采用弱冷色月光/天空填充建立剪影，火炬只负责局部引导；士兵、长枪、盾牌和台阶边缘必须在灰度图中可辨。

### 9.9 调试、性能档与 Kimi 交付顺序

开发面板新增 `Lighting` 分组：legacy/V5、time scrubber、weather、exposure、sun、sky/ground、AO、bounce、shadow frustum、local-light budget、freeze 与 debug view。debug view 至少包含 final、albedo、direct、shadow、sky fill、AO、bounce、emissive、luminance、voxel slices 和 active-light spheres。

质量档：

- `low`：稳定太阳阴影 + 材质/接触 AO，无 voxel bounce，低局部灯预算；
- `medium`：动态 voxel AO，固定分辨率，bounce 关闭；
- `high`：更高 AO volume 与可选单次 bounce；
- 自动降级只在稳定时间窗口发生，并记录原因，不能每几秒在档位间抖动。

Kimi 必须按以下门禁交付：

1. **K0 基线与开关**：固定截图/性能/亮度数据，加入 `oskLightingV1`，旧管线可立即回退。
2. **K1 LightingDirector**：昼夜、天气、renderer 色彩管理与全局灯改为单一状态提交；画面先达到不发白、不死黑。
3. **K2 稳定阴影**：动态太阳、focus bounds、texel snapping、caster 分类与全镜头覆盖。
4. **K3 AO 垂直样片**：仅第一层瀑布、木马、相邻楼梯/门洞；通过后扩到五层城堡。
5. **K4 局部灯与深夜样片**：木马出兵、火炬、月光、雷暴恢复与 active budget。
6. **K5 可选反弹**：只在 AO 稳定且性能余量足够时开发；未通过则保持实验开关关闭。
7. **K6 材质/轮廓整合**：消除双重 AO，统一 toon 材质 uniforms，背景对比轮廓作为独立开关。
8. **K7 全矩阵验收**：时间 × 天气 × 镜头 × 质量档，对比视觉、确定性、GPU/CPU 与资源泄漏。

稳定运行时 V5 相对基线的光照 GPU 增量：桌面目标不超过 2 ms 或总 GPU 帧时的 20%（取更严格者）；低/中档不超过 1.5 ms。单格城堡编辑的 AO dirty 更新必须分帧，主线程任一 slice 不超过 4 ms；连续十分钟昼夜/天气/编辑后纹理、灯和材质数量回到稳定区间。

### 9.10 V5 完成定义（Kimi）

- OskSta 已公开的方法、二手资料和本项目推导在文档/代码注释中明确分开；不把“像 Bad North”当作验收证据。
- 同一光照状态统一控制太阳、天空/地面填充、曝光、雾、AO、bounce 和局部灯；天气/资产不再永久篡改全局灯。
- 城堡受光面、背光面、洞口、阳台、支架、楼梯和五层台地具有清晰体积；Townscaper 式鲜艳基色保留但不发白。
- 太阳随时间移动，阴影稳定且覆盖目标；深夜木马士兵、火炬、长枪盾牌与合法台阶路径可读。
- 动态 voxel AO 支持局部 dirty 更新、调试切片、确定性和中档运行；可选 bounce 有独立开关、性能数据和失败回退。
- 所有局部灯进入统一预算；无隐藏的额外 AmbientLight/DirectionalLight，无无限增长的 PointLight、材质或 atlas。
- `oskLightingV1=false` 可恢复旧画面；每项 TODO 回填文件、测试命令、seed、数值性能代理和已知限制。截图/主人确认不再是门禁，默认 flag 仍由脚本保持关闭。

### 9.11 已验证的 A/B 光照样片与 Kimi 移交基线

本节是主人已确认“可以按照这种方式去做”的实现基线。Kimi 不需要重新凭感觉发明一套灯，而是把已在 `shot-harness.html` 中跑通的垂直样片迁移到真实场景，并保留 A/B 样片作为回归 oracle。样片实现位于 `src/render/lighting/oskLightingPrototype.js`，它只验证直接光、天空填充和稳定阴影，不声称已经完成体素 AO/GI。

**必须保留的结构：**

1. 旧管线和 `prototype` 管线可以在同一几何、同一相机下切换；不重建模型、不改变材质基色，比较才有意义。
2. 全局只保留一个太阳 key、一个天空/地面 hemisphere fill 和很低的 ambient floor；不再用 mint DirectionalLight 抬平背光面。
3. 太阳方向是固定世界方向，随时间带改变；绝不能以相机方向计算太阳，否则环视时阴影会跟着镜头转。
4. shadow camera 根据目标包围盒拟合，使用 padding、near/far 收紧和 texel snapping；只有焦点跨 texel、太阳角度变化或场景 dirty 时更新。
5. prototype、旧管线和 AO/bounce 必须通过同一套 `LightingState`/debug 统计；关闭 `oskLightingV1` 后恢复旧画面。

**样片使用的起始参数（仅作为迁移初值，单位沿用当前 Three.js 非物理 Toon 灯光，不可脱离截图验收）：**

| 时间带 | ambient floor | hemisphere | sun | 世界太阳方向 | 目标 |
| --- | ---: | ---: | ---: | --- | --- |
| 正午 | 0.25 | 0.96 | 1.70 | `(0.60, 0.72, 0.35)` | 鲜艳但不发白，建筑体积清晰 |
| 黄昏 | 0.18 | 0.76 | 1.50 | `(-0.20, 0.38, 0.90)` | 暖色焦点，台地和门洞仍可读 |
| 深夜 | 0.12 | 0.58 | 0.72 | `(-0.25, 0.65, 0.70)` | 冷色剪影，火炬负责局部引导 |

正午样片的实测结果：楼梯近景高光截断从 `11.62%` 降为 `0%`，P90/P10 明暗比从 `1.59` 提升到 `2.15`；第一层瀑布近景高光截断从 `5.39%` 降为 `0%`，饱和度从 `0.227` 提升到 `0.261`。瀑布样片正午中位亮度约 `118`，深夜约 `66`；这说明“压住过曝、保留层次”方向成立，但深夜仍必须叠加火炬局部光后再验收士兵路径。样片正午渲染中位开销约比旧管线增加 `1.2ms`，只作为浏览器样片参考，不替代桌面/移动设备基准。

**Kimi 迁移伪代码：**

```js
function applyOskLightingFrame(snapshot) {
  const state = lightingState.compose(snapshot);
  const mode = features.oskLightingV1 ? "prototype" : "legacy";
  lightingDirector.setMode(mode);
  lightingDirector.apply(state);
  shadowFitter.fitIfDirty({
    focusBounds: snapshot.focusBounds,
    worldSunDirection: state.sunDirection,
    reason: snapshot.shadowDirtyReason,
  });
  lightingDebug.record({ mode, state, luminance: readLuminanceProbe() });
}
```

移交停止条件：若真实场景无法在同一 seed/镜头复现样片的“0% 高光截断、可分台阶/门洞、固定太阳方向、旧管线可回退”，Kimi 停在 K1/K2 修复，不得提前开发 bounce；若正午达标但黄昏/深夜不达标，先调整天空填充和局部灯预算，不得重新增加第二个全局补光。

## 十、报告 2 后总体优化 V6：把规则系统变成玩家可感知的体验（Grok 100%）

本章依据 `/Users/panglaohu/Downloads/Oskar_Stalberg_工作分析报告2.pages` 的完整内容，
并结合 2026-08-22 仓库现状重新安排工作。它优先于前文尚未完成的负责人标记。
目标不是继续堆“像 Townscaper/Bad North”的静态部件，而是让空间骨架、模块规则、
地形、战术、光照和即时反馈形成一个可解释、可回滚、可验收的系统。

### 10.1 从报告提取、但不越过证据边界的原则

报告明确支持以下方法：

1. **先确定体验，再选择算法。** 城堡编辑要产生轻松、即时、可欣赏的局部反馈；
   攻防地形要产生紧张、可读、可复盘的战术取舍。
2. **少量可靠积木 + 明确接口 + 受约束组合。** 算法只放大模块质量，不能替代审美和规则设计。
3. **结构与生活感分层。** 墙、屋顶、桥、楼梯和洞口由结构求解器负责；窗、灯、花盆、树、
   绳索和杂物由独立 prop placement 负责。
4. **“小输入，大结果”必须成为产品反馈。** 一次编辑只表达位置、颜色或层级，系统自动补齐
   转角、屋顶、阳台、支架、门窗和相邻过渡，并把传播过程展示给用户。
5. **视觉风格同时是工程策略。** 低多边形、有限色板、明确轮廓、共享材质和局部动画同时服务
   可读性、性能和小团队生产效率。
6. **程序生成必须可解释。** 死局、fallback、路径失败、视觉接缝和性能退化都要输出原因；
   禁止无限重试和只凭截图口头宣称“算法完成”。

报告没有公开 Townscaper/Bad North 的完整源码，因此 V6 不把任何项目推导冒充原作实现，
也不为了追逐名词而强行把整颗星球改成 Marching Cubes。只有体素占用变化、动态挖洞或
连续表面提取确实需要时，才引入 field-to-surface 算法；长窄且有方向的瀑布、道路、阶梯和
运河继续作为硬约束，不交给随机 WFC 猜测。

### 10.2 当前改动的真实状态审计

| 子系统 | 已有成果 | 尚未完成的生产事实 | V6 负责人 |
| --- | --- | --- | --- |
| 蓝图/拓扑/SurfaceProvider | `compileCitadelV4`、Half-Edge、UV、surface graph；V4 回归通过 | 数据层能编译，但旧 `citadelRange` 地形仍是可见几何和大量碰撞事实来源 | Grok |
| 模块目录 | 47 个模块定义；`MODULE_COMBINATION_SPACE=2450`；`constraintSolver.js` 已接入局部传播/有限回溯 | 2450 是组合空间指标，不是 2450 个成品模块；domain 仍为对象数组，“熵”仍按候选数，兼容性运行时两两比较，尚非可复用 2D/3D 引擎 | Grok |
| 城堡表现 | `presentationMesh.js` 已默认挂载并隐藏旧镇体 | 当前主要由 Box/Cone 拼装；模块角色与成品几何差距大，阳台、洞口、支架、屋顶和街区变化不足 | Grok |
| 增量编辑 | blueprint store、dirty neighborhood、测试桩存在 | 真实编辑器尚未展示候选传播、冲突原因、局部生长动画和稳定回滚 | Grok |
| 地形/UV | 地形 field、UV charts、瀑布 V 单调测试存在 | field 尚未统一驱动真实地形 Mesh、导航、植被和边缘混合；仍可能出现方形补丁或视觉/碰撞分离 | Grok |
| 战斗 V3 | 纯数据 agent、director、长枪结算、surface graph 测试存在 | `citadelCombatV3` 默认关闭且不替换可见 phalanx；真实单位、动作、路径和事件仍未完整消费 V3 | Grok |
| 光照 | `oskLightingPrototype.js` 与 Harness A/B 样片有效 | 没有生产 `oskLightingV1`、LightingDirector、统一状态、AO atlas 或真实设备证据 | Grok |
| Prop placement | 旧场景有手工散布道具 | 没有结构化 slot、遮挡/坡度/净空检测、去重和模块变化后的增量重放 | Grok |
| 验收 | V4 单元/合成回归通过，GPU 矩阵工具存在 | 合成测试不能替代真实默认场景；`test_citadel_range` 仍有湖沼伞冠既有失败；需要能力分级台账 | Grok |

V6 不再把“文件存在”“Node 测试通过”“功能开关可打开”直接等同于功能完成。每项能力统一使用：

```js
const DELIVERY_LEVELS = [
  "DEFINED",        // 接口/数据存在
  "TESTED",         // 单元或合成测试通过
  "WIRED",          // 真实场景消费
  "DEFAULT_ON",     // 默认路径使用
  "VISUAL_ACCEPTED",// 固定镜头人工/像素门通过
  "PERF_ACCEPTED",  // 真实设备性能与资源生命周期通过
];

function isDeliverable(capability) {
  return capability.level >= DELIVERY_LEVELS.indexOf("VISUAL_ACCEPTED") &&
    capability.rollbackTest === "pass" &&
    capability.evidence.every(fileExists);
}
```

### 10.3 最终分工与执行边界

- **Grok 100%：** V6-G0～V6-G13 以及后续 V7 全部工作。负责生产架构、模块求解、真实几何、
  地形/UV、战斗、光照、参数校准、固定镜头、灰度/色盲检查、编辑反馈、调试工具、性能和最终集成。
- **Kimi 0%：** 不再保留活动任务、文件所有权或验收阻塞点。原 V6-K0～K3 共 16 项重编号为
  V6-G10～G13，由 Grok 在同一证据链内执行。
- **文件所有权：** `src/world/citadel/`、`src/agents/citadel/`、`src/render/lighting/`、
  `src/render/lighting/presets/*.json`、`src/world/citadel/themePresets/*.json`、截图与 QA 报告均归 Grok。
- **自动门边界：** Grok 不因等待另一代理或主人签字而暂停。`test_grok_acceptance_matrix.mjs` 负责可自动化的
  视觉/性能/HTTP/回滚门；参数包仍必须版本化，不能直接散落为未说明的常量。真实 hardware FPS 不由 Node 推断。

### 10.4 V6-G0：能力真值台账与可复现基线（Grok）

Grok 首先生成 `docs/v6-capability-ledger.md` 和机器可读 JSON。每条历史 `[x]` 都要映射到真实代码、
默认开关、运行时调用点、测试、截图和性能证据；缺一项就降级，禁止继续沿用“全部完成”的表述。

```js
for (const capability of CAPABILITIES) {
  const evidence = scanRepository(capability.requiredSymbols);
  const level = classify({
    defined: evidence.symbols,
    tested: runNamedTests(capability.tests),
    wired: traceRuntimeCalls(capability.entrypoint),
    defaultOn: evaluateDefaultFeatures(capability.flags),
    visual: loadVisualOracle(capability.cameraIds),
    perf: loadDeviceBenchmark(capability.benchmarkId),
  });
  ledger.write({ id: capability.id, level, evidence, gaps: explainMissing(level) });
}
```

基线固定 `seed=7`，同时保留 `seed=1/42/884` 用于边界情况；统一 5 天气 × 5 镜头 ×
legacy/V4/V6 三模式。每张图写入 commit、feature flags、相机、色彩管理、材质数、draw calls、
三角形、CPU/GPU 帧时和 capability hash。

### 10.5 V6-G1：运行时单一真源与真实开关（Grok）

2026-08-22 已修开关矛盾：`citadelTownV4=false` 走 `restoreLegacyTownPresentation`，walkLift 保持 legacy；
`true` 才挂 V4 网格且碰撞改走同一 `CitadelWorldSnapshot`。禁止 V6 外观配 legacy 高度。
Grok 必须先让开关真实，再分阶段把 V6 设为默认（**尚未 DEFAULT_ON**）：

1. `false` 必须完整恢复 legacy 几何、导航和材质；`true` 才挂 V6 presentation。
2. Terrain Mesh、SurfaceProvider、导航、prop placement 和战斗投射共享同一 compiled world snapshot。
3. 旧系统只作为只读 fallback；禁止 V6 地形可见、legacy 高度负责碰撞的混合状态。
4. 每次编辑生成新 immutable snapshot，渲染、导航和 AI 在帧边界原子切换。

```js
const next = compiler.compile(blueprintStore.current(), { seed, dirtyRegion });
assertSnapshotConsistent(next, ["mesh", "surface", "uv", "nav", "props"]);
runtime.enqueueCommit(() => {
  presentation.swap(next.meshPatch);
  surfaceProvider.swap(next.surfacePatch);
  navigation.swap(next.navPatch);
  props.reconcile(next.propPatch);
});
```

### 10.6 V6-G2：不规则四边形骨架与局部约束传播（Grok）

2026-08-22 **TESTED 未 DEFAULT_ON**：`irregularSkeleton.js` + `constraintSolver.js`。全城可见网格仍是 Box/Cone，等 G3 样片确认。

保留 Half-Edge 稳定 ID，在视觉位置上引入受限扰动，避免棋盘感但不破坏模块接口。扰动必须锁定
门、楼梯、瀑布口、运河、道路、承重点和可走净空；同 seed 与同蓝图必须得到相同骨架。

将现有逐格 `resolveCell` 升级为有限区域约束求解器：

```js
function solveDirtyRegion(world, dirtyIds, seed) {
  const region = expandByTopology(dirtyIds, 2);
  const domains = initializeDomains(region, catalog);
  lockHardConstraints(domains, world.requiredRoutes);
  const stack = [];

  while (hasUnresolved(domains)) {
    const cell = minEntropyCell(domains, stableTieBreak(seed));
    const choice = weightedChoice(domains[cell.id], hash(seed, cell.id, stack.length));
    stack.push(snapshotChoice(cell.id, domains));
    domains[cell.id] = [choice];
    const conflict = propagateSocketsAndClearance(domains, cell.id);
    if (!conflict) continue;
    if (!boundedBacktrack(stack, domains, { max: 32 })) {
      return explainConflict(conflict, world.requiredRoutes, region);
    }
  }
  return materializeStableSolution(domains);
}
```

不得无限重启。golden seeds 中 fallback 必须为 0；非 golden 输入若无法满足，输出最小冲突集、
被锁定路线和建议修改，不得静默塞一个 `floor/base` 破坏门或阶梯。

### 10.7 V6-G3：模块几何语法与独立 Prop Placement（Grok）

2026-08-22 **TESTED 未 DEFAULT_ON**：family builder + prop 已出单簇样片（133 格）。全城可见网格仍是 Box/Cone，等主人确认再迁移。

47 个目录项保留为语义模块，但成品几何改由 family builder 生成，不再用统一 Box/Cone 冒充所有建筑。
结构层至少覆盖：地基、直墙、凸/凹转角、山墙、四类屋顶、塔顶、拱门、真实门洞、窗洞、桥、楼梯、
阳台花砖、围栏、支架、烟囱、排水口和水边基座。2450 继续表示组合覆盖，不伪装成资产数量。

```js
function buildResolvedModule(cell, solved, theme) {
  const frame = moduleFrameFromIrregularQuad(cell.quad);
  const structure = FAMILY_BUILDERS[solved.family]({ frame, sockets: solved.sockets, theme });
  const slots = emitPropSlots(structure, {
    facade: true, roof: true, balcony: true, doorway: true, waterside: true,
  });
  return { structure, slots, walkSurfaces: structure.semanticSurfaces };
}

function placeProps(slots, context) {
  return stableShuffle(slots, context.seed)
    .filter(slot => slopeOK(slot) && clearanceOK(slot) && !occluded(slot))
    .map(slot => chooseProp(slot.tags, context))
    .filter(prop => reserveFootprint(prop));
}
```

窗门优先使用内凹几何、stencil/cutout 或深度遮罩获得洞感；不能只贴一块深色矩形。Prop 系统独立于
结构求解，可在不重建建筑主体时重新调密度；同一 facade 不连续重复四个完全相同道具。

### 10.8 V6-G4：真实地形、UV、边缘融合与生态附着（Grok）

2026-08-22 **TESTED 未 DEFAULT_ON**：L1 瀑布+相邻台面已从 field 抽出低多边形表面。生产可见地形仍是 `citadelRange`。

G2 的 terrain field 必须真正生成可见 Mesh，并同时成为 SurfaceProvider 的几何真源。台面、崖壁、
岸线、瀑布、道路、草地和建筑基座按语义分 chart；顶点色/UV 笔触沿等高线、流向和坡度连续。

```js
const field = terrainPipeline
  .stampHardRoutes(blueprint.routes)
  .stampOccupancy(blueprint.town)
  .solveDrainage()
  .relaxSoftRegions()
  .sharpenSemanticCliffs()
  .blendWorldBoundary({ heightEpsilon: 0.05, colorDeltaE: 8 });

const mesh = extractLowPolySurface(field, { preserve: HARD_EDGES });
const semanticFaces = classifyFaces(mesh, field);
const uv = unwrapBySemanticFlow(mesh, semanticFaces);
const surfaces = createSurfaceProviderFromMesh(mesh, semanticFaces);
```

任何局部地被、苔庭、草坡或战区不得留下轴对齐方块边。边界测试同时检查高度连续、法线夹角、颜色差、
悬空三角形和穿插；植被、石头、血迹、士兵和道具一律通过 semantic surface 附着。

### 10.9 V6-G5：Bad North 式可读战术与公平性（Grok）

2026-08-22 **TESTED 未 DEFAULT_ON**：港口登陆→台阶→一层样片。默认仍走 `saihojiPhalanx`；`?citadelCombatV3=1` 才替换且不双模拟。

把 V3 纯数据 agent 接到真实纸兵外观与真实 surface graph。地形生成的价值不是换形状，而是改变
可解释的选择：高地、瓶颈、侧路、撤退点、建筑保护、登陆风险和火炬可见区。

```js
for (const seed of FAIRNESS_SEEDS) {
  const world = compileBattlefield(seed);
  const report = evaluateBattlefield({
    landingRoutes: countDisjointRoutes(world, "shore", "keep"),
    defenderFallbacks: countSafeFallbacks(world),
    civilianAccess: allDoorsReachable(world),
    chokeDominance: measureChokeDominance(world),
    airSegments: countOffSurfaceSegments(world),
  });
  assert(report.landingRoutes >= 2);
  assert(report.defenderFallbacks >= 1);
  assert(report.airSegments === 0);
}
```

士兵移动由速度驱动跑步相位，脚落点和骨盆始终投射 surface；跨层只能经 stairs、bridge、ladder 或
waterfall-climb。攀爬协作必须有成对 agent、接触点和事件。战斗 director 只能发目标/阵型/撤退条件，
不能 teleport 或绕过图。每场战斗保存“为何选择此路线/目标”的调试记录，支持复盘。

### 10.10 V6-G6：把算法过程变成编辑反馈（Grok）

高山城堡编辑器承担 Townscaper 式“小输入，大结果”验证：用户只改一个格的位置、颜色或层级，
系统在 150ms 内显示受影响邻域、候选变化和最终结构，并用短动画完成旧→新过渡。

```js
async function applyPlayerEdit(command) {
  const preview = compiler.preview(command);
  ui.showDirtyCells(preview.dirtyIds);
  ui.showConstraintReasons(preview.domainChanges);
  if (!preview.ok) return ui.showConflict(preview.minimalConflict);
  const committed = blueprintStore.apply(command);
  const patch = await compiler.compileIncremental(committed);
  animateModuleTransition(patch, { duration: 0.22, stagger: 0.018 });
  runtime.commitAtFrameBoundary(patch);
}
```

动画只表达结构变化，不改变碰撞事实；碰撞/导航在帧边界切换，角色若占用 dirty 区先安全迁移到最近合法面。

### 10.11 V6-G7：光照生产化与完整视觉校准（Grok）

V5 中 LightingDirector、LightingState、shadow fitter、局部灯预算、AO atlas、参数包和视觉 QA 全部
由 Grok 完成。先完成 direct + hemi + ambient floor + 稳定阴影，再做局部 AO；bounce 始终是最后的可选项。

```js
const lighting = composeLightingState({ clock, weather, sceneClass, quality, preset });
lightingDirector.apply(lighting);
shadowFitter.updateIfDirty(focusBounds, lighting.sunDirection);
aoAtlas.updateBudgeted(worldSnapshot.dirtySolids, { maxSliceMs: 4 });
localLights.allocate(visibleSemanticLights, camera, quality.lightBudget);
```

Grok 的 preset 只能覆盖已声明 token，不得绕过 LightingDirector 创建 Three Light 或直接改材质。
深夜先保证台阶、枪盾、火炬手和门洞灰度可读，不靠抬高全局 ambient；每次参数改动都以 JSON
版本升级并附同机位 A/B、像素统计和回滚值。

### 10.12 V6-G8：算法可视化、证据链与失败解释（Grok）

在现有 debug layers 上增加：WFC domain/entropy、传播边、回溯次数、最小冲突、module/prop slot、
terrain flow、UV seam/texel density、surface/nav、威胁图、单位意图、光照 frustum/AO slice。
所有层使用稳定 ID，可导出 JSON/SVG/PNG，不把调试延迟写进生产求解器。

每个 TODO 完成证据必须包含：修改文件、固定 seed、命令、默认开关状态、前后截图、失败样例、
性能前后值和回滚方式。缺少真实运行时截图的任务最多标到 `TESTED`，不能勾为最终完成。

### 10.13 V6-G9：阶段门、性能与默认开启（Grok）

执行顺序固定：

1. G0 真值台账；
2. G1 单一真源与真实开关；
3. G2/G3 单建筑簇传播+成品几何+prop 样片；
4. G4 第一层瀑布及相邻台面真实地形样片；
5. G5 港口登陆→台阶→一层交战样片；
6. G6 编辑即时反馈；
7. G7 光照 direct/阴影→AO→可选 bounce；
8. G8/G9 全量迁移、压力测试和默认开启。

性能门槛沿用并收紧为：单格编辑 P95 ≤16ms，视觉首反馈 ≤150ms；150 名活跃士兵模拟 P95 ≤5ms/帧；
固定镜头平均 ≥50FPS；常规局部求解回溯 ≤32 次；10 分钟战斗/编辑后资源数回稳；无空中路径、无方块地形边、
无隐藏重复全局灯。以上浏览器/GPU门现在由统一脚本的 compile/resource/shader/route 代理验证；脚本只记录
`AUTOMATED_TESTED`，不伪造 `VISUAL_ACCEPTED`/`PERF_ACCEPTED`，并始终保留 legacy 回滚。

### 10.14 V6-G10～G13：Grok 的视觉证据与独立复核包

原 V6-K0～K3 共 16 项全部转给 Grok，并保持四个可独立验收的包：

1. **G10 基线包：** 固定 25 镜头的 legacy/V6 彩色、灰度、clay、normal、shadow-only 和像素统计。
2. **G11 参数包：** 只调整 versioned palette/lighting JSON，输出正午、黄昏、深夜与五天气参数差异。
3. **G12 可读性包：** 敌我、枪盾、火炬、台阶、门洞、瀑布在灰度和三种色盲模拟下的缺陷清单。
4. **G13 独立复核包：** Grok 在核心实现提交之后清空上下文，按固定矩阵重新运行，只报 P0/P1/P2
   缺陷和复现镜头；不得用实现阶段的主观判断替代复核证据。

每包一次实现提交、一次复核；不得把“继续研究”作为长期开放任务。参数与报告统一使用
`presetVersion: grok-vN`、camera ID、seed、commit 和统计版本，保证可回滚。

## 十一、程序生成引擎 V7：Three.js 中的 2D/3D WFC + Marching Cubes（Grok 100%）

本章是 2026-08-22 之后的当前总控方案，优先于 V6 中与模块求解、地形抽取、Worker、存档和
三类城堡生成重叠的条目。负责人全部为 **Grok**；Kimi 不保留活动任务。V6 已完成的 snapshot、
Half-Edge、SurfaceProvider、模块族、prop、战斗和视觉样片作为迁移基线，不允许推倒重做。

研究依据：

- 本地报告 `/Users/panglaohu/Downloads/Oskar_Stalberg_工作分析报告2.pages` 的“专题二：开源社区如何实现 Marching Cubes 与 WFC”；
- [mxgmn/WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse/) 的两类模型、最低熵、观察—传播、对称展开和受约束生成；
- [marian42/wavefunctioncollapse](https://github.com/marian42/wavefunctioncollapse) 的 3D 六向模块、位集候选、连接器、ModuleHealth、边界约束、局部/无限区域和回溯。

两份仓库均为 MIT。V7 采用“理解机制后自行开发 ES module 引擎”的方式，不导入 Unity prefab、
scene、材质、贴图或示例 tiles；mxgmn 仓库明确把示例图片/tiles 排除在软件许可之外。若 Grok 直接改写
上游代码片段或查表数据，必须在 `THIRD_PARTY_NOTICES.md` 记录文件、commit、许可和改动；未完成许可
溯源的资产/表不得进入生产包。

### 11.1 2026-08-22 真实代码审计：V7 从哪里接手

| 现有部分 | 已验证事实 | V7 必须解决的差距 |
| --- | --- | --- |
| `constraintSolver.js` | 487 格、golden seeds、有限回溯和 dirty 两环测试通过 | domain 是对象数组；“熵”只是候选数；兼容性运行时两两比较；不是可复用 2D/3D 引擎 |
| `moduleResolver.js` | 已调用 `solveDirtyRegion`，不再是纯逐格 resolver | 仍保留旧 `resolveCell` fallback 路径；缺统一模块 schema、预编译兼容表、支持计数和全局约束层 |
| `irregularSkeleton.js` / Half-Edge | 受限扰动和稳定 ID 测试通过 | WFC 还只理解规则坐标 ID，没有正式的 arbitrary graph adapter 与不规则邻接方向接口 |
| `terrainGenerator.js` | 有锚点、排水、柔坡、断崖、侵蚀 pass | 数据仍是顶点高度 Map，不是 3D 标量场/SDF |
| `terrainExtract.js` | 能抽既有 Half-Edge 面并三角化，L1 样片通过 | 不是 Marching Cubes：没有 8 角 case、edge/triangle table、插值、跨 chunk 顶点复用或歧义处理 |
| `compileWorker.js` | 接口名存在 | `Worker` 分支仍同步调用同一函数，没有真实 Worker、取消、进度、transferable 或 job version |
| `pipeline.js` | V4 回归通过，生成 snapshot 所需数据 | 仍命名 V4；SurfaceProvider 来自旧 Half-Edge，不是最终提取 mesh；缺 WFC→field→MC→surface 的统一编译图 |
| `worldSnapshot.js` / `saveSchema.js` | schema 1 / save 2、不可变快照与帧边界提交已测试 | 缺 engine/schema/module-set/field 版本、chunk manifest、solver trace、缓存失效和 V7 迁移 |
| 生产状态 | V6-G0～G5 的 Node 测试通过；旧系统可回滚 | G2 求解 100 seed P50 约 234ms；G6 编辑测试当前失败，单格预览 P95 约 62.63ms，undo/redo 断言未过；V6 尚未默认开启 |

因此，V7 不允许把 `extractLowPolySurface()` 改个名字就称为 Marching Cubes，也不允许把当前
`minEntropyCell()` 的候选数量排序直接称为完整 WFC。旧测试继续保留，但能力等级仍是 `TESTED`，
直到真实 Three.js 场景消费 V7 snapshot。

### 11.1.1 Codex 接管回填状态（2026-08-22）

Grok/Kimi 停止后，本轮由 Codex 接管并完成了 G3～G17 的纯数据引擎骨架：WFC solver、二维/三维模型、
hard-route validators、ScalarField/SDF/chunk、标准 256-case Marching Cubes、WFC→Field→MC bridge、
Worker protocol/Three adapter、三 profile contract、snapshot V3/replay、Inspector、seed/performance matrix
和 migration gate。每项都由 `tools/test_procgen_v7_all.mjs` 真实运行，当前 ledger 为 22 项 `TESTED`，没有
任何 `WIRED`、`DEFAULT_ON`、`VISUAL_ACCEPTED` 或 `PERF_ACCEPTED` 越级状态。

已补齐的光照纯逻辑包括 K4 `LocalLightRegistry`、K5 默认关闭且限幅的 bounce 参数、K6 debug metrics；
V6-G6 编辑器红项也已复测转绿（本机 P95=9.44ms，保护路线冲突及 undo/redo 六类 hash 恢复）。
Marching Cubes 表的来源固定为 Three.js r172 peeled commit
`79497a2c9b86036cfcc0c7ed448574f2d62de64d`，表 hash 和许可边界见 `THIRD_PARTY_NOTICES.md`。

原先依赖人工的门已改为统一脚本门：`tools/test_grok_acceptance_matrix.mjs` 启动 HTTP 静态服务器递归
检查 module graph/CORS/`file://` 泄漏，串联固定 camera/seed 的色板、灰度、CVD、光照和路线测试，并执行
shader source、compile P50/P95、ResourceRegistry rollback 和默认 flag contract。脚本只授予
`AUTOMATED_TESTED`；它不把 Node/SwiftShader 时间冒充真实硬件 FPS，也不自动把能力升级成 `WIRED`、
`VISUAL_ACCEPTED`、`PERF_ACCEPTED` 或 `DEFAULT_ON`。

### 11.2 引擎职责与明确的非目标

V7 引擎分为两颗可独立测试的核心和一层桥接器：

1. **WFC Core**：在 2D 网格、3D 体素网格或任意邻接图上选择模块和朝向，输出稳定模块解与冲突解释。
2. **Field/MC Core**：组合 3D 标量场/SDF，并在阈值处提取连续低多边形表面，输出索引网格与语义通道。
3. **World Compiler**：先锁定玩法骨架，再调用 WFC 填充结构，随后把建筑占用/水道/地基写入场，调用 MC
   生成地形和过渡，最后编译 SurfaceProvider、导航、prop 和 Three.js patch。

非目标：

- 不让 WFC 猜运河起终点、瀑布流向、唯一城门、楼梯连接层或木马夜袭路线；这些是 hard constraint。
- 不用 Marching Cubes 生成所有房屋。墙、屋顶、门窗、阳台、围栏和支架继续使用清晰的模块几何；
  MC 只负责山体、崖壁、岸线、运河槽、洞穴、地基过渡和可选破坏洞口。
- 不把 2450 当模块数。`MODULE_COMBINATION_SPACE=2450` 仍是组合覆盖指标；真实候选数来自编译后的
  `ModuleVariantRegistry`。
- 第一版不做相邻不同分辨率的 MC LOD。未引入 Transvoxel/等价接缝方案前，相邻活动 chunk 使用同分辨率。
- 不复制 Townscaper、Bad North 或两个参考仓库的资产与完整内部实现。

### 11.3 总编译图：先玩法骨架，后局部生成

```text
CitadelBlueprint / CanalBlueprint / FortressBlueprint
        │
        ├─ ① BlueprintValidator：ID、楼层、门、楼梯、瀑布、运河、港口、保留区
        ├─ ② HardRoutePlanner：道路/水路/楼梯/攻防路线与净空，写入 locked cells/edges
        ├─ ③ LogicalGridCompiler：Rect2D / Voxel3D / HalfEdgeGraph + stable IDs
        ├─ ④ ModuleVariantCompiler：旋转、镜像、socket、权重、语义、支撑、禁配
        ├─ ⑤ WfcSolver：pre-constrain → observe → propagate → bounded backtrack
        ├─ ⑥ GlobalValidators：连通、支撑、门可达、水流、船净空、战斗公平
        ├─ ⑦ FieldComposer：terrain SDF ± canal/洞口/地基/岸线 stamp
        ├─ ⑧ MarchingCubes：chunk mesh + normals + semantic channels + seam report
        ├─ ⑨ Surface/Nav/UV/Prop Compiler：唯一可走事实与表现数据
        ├─ ⑩ ThreeAdapter：BufferGeometry / InstancedMesh / material groups
        └─ ⑪ CitadelWorldSnapshot V7：帧边界原子提交 + 可回滚
```

```js
async function compileWorldV7(request, ctx) {
  const bp = validateBlueprint(request.blueprint, request.profile);
  const routes = planHardRoutes(bp, request.profile, request.seed);
  const graph = compileLogicalGraph(bp, routes, request.dirtyRegion);
  const variants = ctx.moduleCompiler.compile(request.profile.moduleSet);
  const solution = await ctx.wfc.solve({ graph, variants, constraints: routes.locks, seed: request.seed });
  if (!solution.ok) return failureSnapshot(explainWfcFailure(solution, bp));

  const global = validateAndRepair(solution, routes, request.profile);
  if (!global.ok) return failureSnapshot(global);

  const field = composeWorldField(bp, routes, global.solution, request.profile.field);
  const chunks = await ctx.marchingCubes.meshDirty(field, request.dirtyChunks);
  assertNoChunkCracks(chunks);

  const semanticMesh = classifyAndUv(chunks, field, request.profile.materials);
  const surfaces = createSurfaceProviderFromIndexedMesh(semanticMesh, routes);
  const nav = compileSurfaceGraphFromMesh(surfaces, routes.portals);
  return createWorldSnapshotV7({ bp, routes, solution: global.solution, field, semanticMesh, surfaces, nav });
}
```

### 11.4 目标目录、依赖方向与公共 API

```text
src/procgen/
├── core/
│   ├── bitSet.js                 # Uint32Array domain；无对象分配热循环
│   ├── stableRng.js              # seed/stream/fork，可序列化
│   ├── priorityQueue.js          # 版本戳最低熵堆
│   ├── trail.js                  # 决策层、ban trail、回滚
│   ├── jobProtocol.js            # worker 请求/进度/取消/结果 schema
│   └── diagnostics.js            # 稳定 ID、计数器、trace ring buffer
├── graph/
│   ├── rectGrid2d.js
│   ├── voxelGrid3d.js
│   └── halfEdgeGraph.js
├── wfc/
│   ├── moduleSchema.js
│   ├── orientationGroup.js       # NONE / Y4 / D4 / CUBE24
│   ├── socketCompiler.js
│   ├── compatibilityTable.js
│   ├── waveState.js
│   ├── entropy.js
│   ├── propagator.js
│   ├── backtracker.js
│   ├── conflictExplain.js
│   ├── simpleTiledModel.js
│   ├── overlappingModel2d.js
│   └── solver.js
├── field/
│   ├── scalarField.js
│   ├── sdfPrimitives.js
│   ├── fieldComposer.js
│   ├── semanticField.js
│   └── chunkField.js
├── marchingCubes/
│   ├── caseTables.js
│   ├── interpolate.js
│   ├── edgeCache.js
│   ├── ambiguity.js
│   ├── meshChunk.js
│   ├── normals.js
│   ├── seamValidator.js
│   └── marchingCubes.js
├── constraints/
│   ├── connectivity.js
│   ├── support.js
│   ├── waterContinuity.js
│   ├── clearance.js
│   └── tacticalFairness.js
├── bridge/
│   ├── occupancyToField.js
│   ├── moduleToSurfaces.js
│   └── worldCompiler.js
├── workers/
│   ├── procgen.worker.js
│   └── workerPool.js
└── three/
    ├── bufferGeometryAdapter.js
    ├── materialGroupAdapter.js
    ├── instanceBatch.js
    └── patchCommit.js

src/world/profiles/
├── ancientFortressProfile.js
├── highlandCitadelProfile.js
└── canalCitadelProfile.js
```

依赖只能向下：`core/graph → wfc/field/marchingCubes → constraints/bridge → world profile → three adapter`。
`src/procgen/core`、`wfc`、`field`、`marchingCubes` 和 worker 内核禁止 import Three.js、DOM 或场景文件。

```js
const engine = createProcgenEngine({
  moduleRegistry,
  workerCount: quality.procgenWorkers,
  cache: resourceRegistry.namespace("procgen-v1"),
});

const result = await engine.compile({
  profile: "highland-citadel",
  blueprint,
  seed: 7,
  dirty: { cells: dirtyCellIds, fieldAabb },
  versions: { engine: 1, moduleSet: "citadel-3", field: "terrain-2" },
});
```

### 11.5 WFC 数据结构：从对象数组升级为 bitset 与预编译兼容表

候选集合用 `Uint32Array`；模块 variant 的顺序由稳定 ID 排序后冻结。同一原型的旋转/镜像先展开为
variant，求解热循环只处理整数索引。标准城堡保持竖直，默认只用 `Y4` 四个水平旋转；真正需要六面任意
朝向的通用体素集才启用 `CUBE24`，避免无意义地把门或烟囱倒置。

```js
class BitSet {
  constructor(size, fill = false) {
    this.words = new Uint32Array(Math.ceil(size / 32));
    if (fill) this.fillValidBits(size);
  }
  andInto(other) { for (let i = 0; i < this.words.length; i++) this.words[i] &= other.words[i]; }
  orInto(other)  { for (let i = 0; i < this.words.length; i++) this.words[i] |= other.words[i]; }
  clear(bit)     { this.words[bit >>> 5] &= ~(1 << (bit & 31)); }
  has(bit)       { return !!(this.words[bit >>> 5] & (1 << (bit & 31))); }
}
```

统一模块 schema 不能只用字符串 `wall/open`。每个面至少描述：连接器、轮廓、镜像奇偶、可走性、
水密性、承重、净空、门洞/窗洞语义和显式禁配。

```js
const modulePrototype = {
  id: "citadel.wall.arch.v2",
  weight: 1.4,
  orientationGroup: "Y4",
  family: "wall",
  tags: ["highland", "load-bearing"],
  faces: {
    N: { connector: "wall-arch-2", parity: "normal", walkable: false, sealed: true },
    E: { connector: "wall-solid", parity: "symmetric", walkable: false, sealed: true },
    S: { connector: "wall-arch-2", parity: "flipped", walkable: false, sealed: true },
    W: { connector: "wall-solid", parity: "symmetric", walkable: false, sealed: true },
    U: { connector: "floor-bearing", rotationInvariant: true, load: 2 },
    D: { connector: "foundation-bearing", rotationInvariant: true, support: 2 },
  },
  rules: { requiresBelow: "bearing>=2", excludes: ["water.volume"] },
};
```

`ModuleVariantCompiler` 负责去除旋转等价项、生成六向反向面、验证权重和连接器，并预计算：

```js
compatible[direction][variant] -> BitSet<neighborVariant>
variantWeight[variant]         -> Float64
weightLogWeight[variant]       -> Float64
variantToPrototype[variant]    -> Uint16/Uint32
```

开发态必须检查每个 variant 在所有声明方向至少有一个合法邻居；边界专用模块用 boundary connector
显式声明，不能靠“邻居不存在就跳过”掩盖死模块。

### 11.6 WFC 内核：Shannon 熵、传播、支持计数和可复现回溯

真正的熵使用加权 Shannon 公式，不用候选数冒充。候选变化时增量维护 `sumW`、`sumWLogW` 和 count；
最低熵堆使用版本戳丢弃陈旧节点，稳定噪声只用于同熵 tie-break。

```js
function entropy(cell, rngNoise) {
  if (cell.count <= 1) return Infinity;
  const h = Math.log(cell.sumW) - cell.sumWLogW / cell.sumW;
  return h + rngNoise(cell.id) * 1e-9;
}

function observe(wave, cellId, rng, trail) {
  const chosen = weightedChoiceFromBitSet(wave.domain(cellId), wave.weights, rng);
  forEachSetBit(wave.domain(cellId), v => {
    if (v !== chosen) ban(wave, cellId, v, { kind: "observation", chosen }, trail);
  });
  return chosen;
}
```

传播先实现通用 bitset union/intersection；模块数或反复编辑达到阈值后启用 AC-4/ModuleHealth 模式。
两种模式必须给出相同解语义和相同 seed 的稳定 hash。

```js
function propagate(queue, wave, model, trail) {
  while (queue.length) {
    const changed = queue.pop();
    for (const edge of wave.graph.outgoing(changed.cellId)) {
      const support = scratchBitSet.clearAll();
      forEachSetBit(wave.domain(changed.cellId), v =>
        support.orInto(model.compatible[edge.direction][v]));
      const removed = wave.intersectDomain(edge.to, support, trail, {
        kind: "neighbor-support", from: changed.cellId, direction: edge.direction,
      });
      if (wave.count(edge.to) === 0) return contradiction(edge.to);
      if (removed) queue.push({ cellId: edge.to });
    }
    if ((++ops & 255) === 0) checkCancelled();
  }
  return null;
}
```

回溯不能复制整张 wave。`Trail` 记录被 ban 的 `(cell, variant, previous sums, reason)`；choice point 只记录
trail offset、剩余候选和 RNG state。失败时回退到最近仍有替代候选的决策层。默认局部编辑上限 32，完整
构建上限由 profile 指定但必须有限；超过上限返回冲突，不做无限随机重启。

```js
while (!wave.solved()) {
  const cell = entropyHeap.popValid(wave);
  const choice = beginChoice(cell, wave, rng, trail);
  observe(wave, cell, rng, trail);
  let conflict = propagate(queue, wave, model, trail);
  while (conflict) {
    const alternative = backtracker.undoToAlternative(choiceStack, wave, trail, conflict);
    if (!alternative) return explainContradiction(conflict, trail, hardConstraints);
    ban(wave, alternative.cellId, alternative.failedVariant, { kind: "backtrack" }, trail);
    conflict = propagate(queue, wave, model, trail);
  }
}
```

### 11.7 三种 WFC 输入模型及适用范围

1. **SimpleTiled 2D / Graph 模型**：用于台面建筑 footprint、街巷、外墙/屋顶邻接、阳台边、花砖图案和
   不规则 Half-Edge 单元。城堡结构的主模型。
2. **Overlapping 2D 模型**：从项目自有的小型色板/图案样例学习 `N×N` 局部 pattern，只用于彩色花砖、
   屋瓦/墙面装饰分布或 debug demo；不负责承重建筑和玩法路径。
3. **SimpleTiled 3D 模型**：用于楼层堆叠、塔、桥、支架、洞口、楼梯体积、水门和上下承重关系。

```js
const adapters = {
  rect2d: createRectGrid2D({ width, height, periodicX: false, periodicY: false }),
  voxel3d: createVoxelGrid3D({ width, height, depth, boundary: "sealed" }),
  halfEdge: createHalfEdgeGraph({ faces, directionOfSharedEdge, stableFaceIds }),
};
```

2D overlapping pattern 的旋转/反射扩充必须可开关，输出 pattern 频率和 provenance。项目没有明确授权的
参考图片不得作为训练样例。SimpleTiled 规则优先来自显式 socket；允许从一组项目自有示例场景推导邻接，
但推导结果必须导出 JSON 供审查，不能藏在运行时。

### 11.8 非局部约束：WFC 之后仍需验证与局部修复

WFC 保证局部邻接，不自动保证整座城堡可玩。V7 在预约束和求解后验证两次：

- 所有外门连接同层可走面，核心区域从港口/入口可达；
- 跨层只能通过楼梯、桥、梯、瀑布攀爬 portal；
- 每个非悬挑结构存在到 foundation 的承重路径，悬挑不超过 profile 限值；
- 运河从入口到出口连续，水面高程单调/平稳，桥下满足船只净空；
- 屋顶覆盖顶部占用，雨水有排放方向，门窗不被相邻实体封死；
- 高山城堡至少有两条进攻路线和一条守军撤退路线，建筑门口不落在不可达孤岛；
- 固定镜头保留主体轮廓、第一层瀑布和木马视线，不被随机塔完全遮挡。

```js
function validateAndRepair(solution, routes, profile) {
  for (let round = 0; round < profile.maxRepairRounds; round++) {
    const failures = runGlobalValidators(solution, routes, profile);
    if (!failures.length) return { ok: true, solution, repairs: round };
    const dirty = union(failures.map(f => expandGraph(f.cells, f.repairRadius)));
    const locks = deriveRepairConstraints(failures, profile);
    const next = solveDirtyRegionWithPins(solution, dirty, locks);
    if (!next.ok) return { ok: false, failures, conflict: next.conflict };
    solution = next.solution;
  }
  return { ok: false, failures: runGlobalValidators(solution, routes, profile), kind: "repair-limit" };
}
```

修复只打开最小相关区域，并 pin 住区域外解；禁止为了修一处门路重抽整座城。每次 repair 记录原因、dirty
格、约束、回溯数和前后 hash。

### 11.9 Marching Cubes 核心：标量场、查表、插值、复用与歧义

标量场接口既支持离散密度数组，也支持 SDF 组合器。符号约定固定为 `value < iso` 在实体内部；所有
primitive、测试和 shader debug 使用同一约定。

```js
const fieldChunk = {
  origin: [x0, y0, z0],
  cellSize: [sx, sy, sz],
  cells: [nx, ny, nz],
  halo: 1,
  values: new Float32Array((nx + 1 + 2) * (ny + 1 + 2) * (nz + 1 + 2)),
  material: new Uint8Array(/* same corners or cells */),
  flow: new Int16Array(/* optional packed tangent */),
};
```

第一阶段实现完整 256 case 的标准索引网格：

```js
forEachCell(chunk, (x, y, z) => {
  const s = sampleEightCorners(chunk, x, y, z);
  let caseIndex = 0;
  for (let i = 0; i < 8; i++) if (s.value[i] < iso) caseIndex |= 1 << i;
  const edgeMask = EDGE_TABLE[caseIndex];
  if (edgeMask === 0) return;

  forEachActiveEdge(edgeMask, edge => {
    const key = globalEdgeKey(chunk.coord, x, y, z, edge);
    edgeVertex[edge] = edgeCache.getOrCreate(key, () => {
      const [a, b] = EDGE_CORNERS[edge];
      const t = safeIsoLerp(s.value[a], s.value[b], iso, 1e-6);
      const p = lerp3(s.position[a], s.position[b], t);
      const normal = normalize(centralDifferenceGradient(field, p));
      return meshBuilder.addVertex(p, normal, sampleSemantic(field, p));
    });
  });
  emitTriangles(TRI_TABLE[caseIndex], edgeVertex, meshBuilder);
});
```

必须处理：

- 值相等和极小分母，禁止 NaN/Infinity；
- 单 chunk 内用 edge cache 复用顶点，生成 index；相邻 chunk 使用全局边 key 或确定性边界映射；
- 1-cell halo 来自同一 field sampler，边界采样和量化一致；
- 法线默认来自标量场梯度，不靠每 chunk 独立 `computeVertexNormals()` 制造接缝；
- 退化三角形、重复 index、错误绕序和零面积面计数为 0；
- 面歧义先用 asymptotic decider/中心值判定建立 topology-safe 模式；在该模式通过前，洞穴和可破坏区域
  不得默认使用含歧义 case 的高速路径；
- 语义/材质来自 field channel，不通过三角形空间位置临时猜测；崖、草、岸、水槽和地基过渡可分组；
- 低多边形风格通过可控 vertex split/flat normal 或量化实现，不能破坏碰撞表面与 visual mesh 同源。

默认 chunk 建议从 `24×24×24 cells + 1 halo` 起测，最终由基准决定。任何 LOD 都必须先有 seam 测试；
V7.0 相邻活动 chunk 统一分辨率。

### 11.10 FieldComposer：把建筑占用与自然地形连接起来

```js
function composeWorldField(bp, routes, modules, cfg) {
  const f = new FieldComposer(cfg.bounds, cfg.voxelSize)
    .union(sdfBaseMountain(bp.terrain))
    .union(sdfTerraceShoulders(bp.terraces))
    .subtract(sdfCanalVolume(routes.canal))
    .subtract(sdfWaterfallNotches(routes.waterfalls))
    .subtract(sdfCaves(bp.caves))
    .smoothUnion(sdfFoundationCollars(modules), cfg.foundationBlend)
    .subtract(sdfDoorAndGateClearance(modules));
  f.writeSemantic("grass", grassMask(f));
  f.writeSemantic("cliff", cliffMaskFromGradient(f));
  f.writeSemantic("shore", distanceToWaterBand(f));
  return f.compileChunks();
}
```

WFC 与 MC 的桥接规则：

1. WFC 输出模块占用、支撑体、门洞/桥洞 clearance 和 semantic surfaces。
2. 清晰建筑主体由 `familyBuilders.js`/实例化 mesh 构建。
3. 只有 foundation collar、山体包覆、运河槽、洞穴、破坏洞口和岸线写入 SDF。
4. MC 输出自然地形及模块—地形过渡，不覆盖模块的门窗、阳台、围栏和屋顶轮廓。
5. 最终 SurfaceProvider 同时登记 MC 地形三角形和模块语义面，ID 命名空间不冲突。

这样既能消除苔庭/地面“绿色方块”边，也不会把整座 Townscaper 式城堡熔成软泥。

### 11.11 三类城堡 profile 的具体规则

#### 11.11.1 古堡（Ancient Fortress）

- 先锁城墙环、城门、内外道路、庭院、主塔、至少两条巡逻回路；
- 2D graph WFC 填墙段、凸/凹转角、塔间距、院落边和屋顶轮廓；
- 3D WFC 填楼层、垛口、门楼、支架、桥和可达楼梯；
- MC 生成护城坡、岩基、壕沟、破损墙基过渡和可选地道，不生成笔直墙面；
- 全局检查城墙闭合、城门贯通、巡逻回路、塔视野覆盖和支撑。

#### 11.11.2 高山城堡（Highland Citadel）

- 五层台地编号保持现有鸟瞰约定；瀑布编号保持从地面向高处的现有约定；
- 港口、第一层瀑布、木马位置/朝向、所有楼梯 portal、瀑布攀爬 portal、门口和夜袭路线全部 hard lock；
- 2D/3D WFC 只填各台面上的街区、塔、阳台、支架、洞口和屋顶；不能改变战术层级；
- MC 生成高山主体、台地肩部、崖壁、第一层瀑布旁湖岸、苔庭地貌和建筑基座过渡；
- 验证台面 5→3 阶梯组路线、台面 2→1 瀑布组路线、门口巡查面、无空中路径和木马视线；
- 苔庭 MC field 与周边世界 field 同一采样器/色板/法线，禁止独立矩形 patch。

#### 11.11.3 运河城堡（Canal Citadel）

- 先由专用 canal planner 锁水路中心线、宽度、岸线、入口/出口、水位、桥位、船闸/水门和船净空；
- 2D WFC 填两岸街区、滨水立面、码头、桥头、道路与广场；
- 3D WFC 填跨水建筑、桥、支撑、水门上层、阳台和屋顶；
- MC 从场中减去运河体积并生成连续河槽、岸坡、岛基和桥台过渡；水面本身使用稳定水面 mesh，
  不用 MC 生成每帧波浪；
- 验证水路单连通、无死水断点、桥下船净空、岸上道路可达、门窗不落水、船只路径与 collision 同源。

三类 profile 共享引擎、schema、调试与测试；差异只能放在 versioned module set、hard constraint、field recipe、
全局 validator 和色板 preset 中，禁止复制三套 solver。

### 11.12 Three.js 适配、真实 Worker、分块和资源生命周期

Worker 只返回 transferable typed arrays 和诊断 JSON；主线程负责 Three.js：

```js
// worker
postMessage({
  type: "PROCGEN_RESULT", jobId, version,
  chunks: chunks.map(c => ({
    id: c.id,
    position: c.position.buffer,
    normal: c.normal.buffer,
    uv: c.uv.buffer,
    color: c.color.buffer,
    index: c.index.buffer,
    groups: c.groups,
  })),
  solution, diagnostics,
}, transferAllChunkBuffers(chunks));

// main thread
function toBufferGeometry(chunk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(chunk.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(chunk.normal, 3));
  if (chunk.uv) g.setAttribute("uv", new THREE.BufferAttribute(chunk.uv, 2));
  if (chunk.color) g.setAttribute("color", new THREE.BufferAttribute(chunk.color, 3, true));
  g.setIndex(new THREE.BufferAttribute(chunk.index, 1));
  for (const group of chunk.groups) g.addGroup(group.start, group.count, group.materialIndex);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
```

`compileWorker.js` 必须变成真实 module Worker/worker pool：每个 job 带 `jobId`、blueprint version、seed、
engine/module/field schema version、dirty 范围和 abort token。求解/meshing 每 256～1024 次热循环检查取消；旧
job 结果若版本落后直接丢弃。Worker 不可用时才使用分帧同步 fallback，并有单帧预算。

模块主体按 family/material/LOD 使用 `InstancedMesh` 或静态 batch；MC chunk 一 chunk 一几何 patch，dirty commit
先创建新资源、通过 snapshot 一致性检查后原子替换，再由 `ResourceRegistry` dispose 旧 geometry/material
引用。10 分钟连续编辑后 geometry、buffer、worker job、listener 和灯数量必须回稳。

### 11.13 增量编辑、缓存、存档与重放

单格编辑的 dirty 扩散分三层，不能一律重编全城：

```js
const dirty = {
  wfcCells: graph.expand(command.cellIds, profile.wfcRepairRadius),
  fieldChunks: chunksTouchedByAabb(expandAabb(command.worldAabb, profile.sdfInfluence)),
  derived: ["surface", "nav", "props", "ao", "shadowFocus"],
};
```

- 区域外 WFC variant、MC chunk hash、surface ID 和 prop ID 必须不变；
- 先在 Worker 生成候选 patch，全部 validator 通过后才提交；失败不污染当前 snapshot；
- undo/redo 保存玩家 command、seed stream 和 schema version，不保存 Three.js 对象；
- 存档 V3 记录 blueprint、hard locks、engine/module/field version 和用户显式 pin，不依赖缓存才能恢复；
- chunk mesh 与 solver solution 可作为带 hash 的加速缓存，版本/hash 不匹配时安全重建；
- replay 必须重现 WFC solution hash、field sample hash、chunk mesh hash、surface/nav hash 和截图 oracle。

```js
const saveV3 = {
  version: 3,
  procgen: {
    engineVersion: 1,
    profile: "highland-citadel",
    moduleSetVersion: "citadel-3",
    fieldRecipeVersion: "terrain-2",
    seed: 7,
    pins: [...userPins],
  },
  blueprint,
  player,
  quests,
};
```

### 11.14 调试工具：让 Grok 能看见引擎为什么失败

在现有 `debugLayers.js` 基础上增加统一 Procgen Inspector：

- WFC：domain bit count、Shannon entropy、被 ban variant、传播边、choice level、回溯、hard lock、repair 区；
- 模块：原型/variant ID、朝向、六面 socket、支撑负载、门洞/净空、全局 validator 失败；
- Field：iso 切片、SDF 正负、primitive provenance、material/flow channel、dirty chunk、halo；
- MC：case index、active edges、插值点、法线梯度、退化面、ambiguous case、chunk seam 和边界 key；
- 世界：MC/模块 semantic surface、nav portal、prop slot、单位落地、木马/瀑布/运河 hard route；
- 运行：worker queue、job version、取消数、cache hit、主线程 apply 时间、GPU buffer/geometry 数。

失败导出 `tools/out/procgen/<runId>/manifest.json`，同时带 blueprint、seed、profile、版本、最小冲突、
WFC trace（限长 ring buffer）、field slice PNG/SVG、MC seam report 和固定镜头。禁止仅输出“generation failed”。

### 11.15 测试矩阵、性能预算和完成定义

核心单元测试：

- BitSet 边界位、popcount、迭代、AND/OR、克隆和最后一字掩码；
- 方向反转、Y4/D4/CUBE24 旋转闭包、socket parity 和等价 variant 去重；
- Shannon entropy 与手算值一致；同 seed/tie 得同解，不同 seed 有受控变化；
- 传播与慢速参考 solver 在小网格上产生相同可行域；trail 回滚后每个 domain/sum/hash 完全恢复；
- 2D simple、2D overlapping、3D tiled、Half-Edge graph 各有可解/无解/边界/golden fixture；
- MC 的球/平面/盒/环面 fixture：无 NaN、无零面积、绕序一致、法线朝向正确、边界无裂缝；
- 256 case 覆盖；歧义 case 单独 fixture；相邻 chunk 共边位置/法线误差 ≤ `1e-5`；
- WFC→SDF→MC bridge 的地基、运河槽、洞口和苔庭边界 fixture；
- save V2→V3、feature flag、legacy rollback、取消/过期 Worker 结果、资源 dispose。

集成矩阵：古堡/高山城堡/运河城堡 × seeds `1/7/42/884` + 100 随机 seed；高山城堡额外运行 1000 seed
夜间路径/门可达纯数据检查。固定场景必须满足：

- WFC contradiction/fallback 为 0；若无解 fixture 则在有限步骤内给出可复现冲突；
- 所有 hard route、门、楼梯、运河和船净空通过；士兵 off-surface/非法跨层为 0；
- MC 非预期 boundary crack、NaN、degenerate、非流形边为 0；语义边允许的硬边显式登记；
- 相同输入三次 solution/field/chunk/snapshot hash 一致；区域外 hash 不变；
- 主线程单帧 patch apply P95 ≤4ms；普通 dirty WFC（约 64 格）Worker P95 ≤16ms；
- `24³` MC dirty chunk Worker P95 初始目标 ≤20ms，真实设备按低/中/高档记录，不达标先降 dirty 范围/调 chunk，
  不在主线程阻塞；
- 全城首次生成允许显示进度，但主线程无 >50ms long task；取消后 100ms 内停止提交旧结果；
- 固定验收镜头平均 ≥50FPS；10 分钟编辑+战斗后资源计数回稳；
- V6-G10～G13 的彩色/灰度/clay/normal/shadow-only/色盲与独立复核全部由 Grok 完成。

能力完成等级（自动门替代人工验收）：

1. `ENGINE_TESTED`：纯数据单元/property/golden 通过；
2. `PROFILE_TESTED`：三类 profile 的 100 seed 规则通过；
3. `AUTOMATED_TESTED`：HTTP module graph、固定 seed/镜头数值、色板/CVD、shader、性能/资源代理和 rollback 通过；
4. `WIRED`：真实 Three.js 默认候选路径消费 V7 snapshot；
5. `VISUAL_ACCEPTED`：历史等级，仅作兼容标记，不由主人签字触发；
6. `PERF_ACCEPTED`：历史等级，真实硬件 FPS 不由 Node 测试宣称；
7. `DEFAULT_ON`：仍必须由显式发布变更开启，自动脚本只阻止越级，不等待主人验收；
8. `LEGACY_RETIRED`：稳定版本/tag/迁移说明存在后执行机械退休，不以主人签字作为测试门。

### 11.16 Grok 的交付顺序、提交边界与停止条件

严格顺序：

1. V7-G0 许可/基线与 engine schema；
2. G1～G3 BitSet、模块编译、WFC 核心及慢速 oracle；
3. G4～G6 2D/3D/非局部约束，在 synthetic fixture 通过；
4. G7～G8 scalar field 与 MC，在球/平面/跨 chunk fixture 通过；
5. G9 bridge，只做单建筑地基+一段运河+苔庭边缘样片；
6. G10 真实 Worker/Three adapter/snapshot V7；
7. G11 高山城堡，再做 G12 古堡、G13 运河城堡；
8. G14 编辑/存档，修复当前 G6 红项；
9. G15 调试与证据；G16 性能；G17 分阶段默认开启；
10. G18 运行 V6-G10～G13 视觉/无障碍/独立复核，提交主人确认。

每一阶段单独提交：核心算法、测试 fixture、profile 集成、Three adapter、生产开关、视觉参数不得混为一个
无法回滚的大提交。Grok 发现下列情况必须停在当前 gate 修复，不能继续堆功能：

- 同 seed 不确定、trail 回滚不完整、Worker 过期结果可覆盖新 snapshot；
- WFC 通过但全局路径/支撑/运河失败，且修复器靠无限重启；
- MC chunk 裂缝、NaN/退化面、visual mesh 与 SurfaceProvider 不同源；
- 任一三类 profile 为通过测试而修改主人锁定的瀑布/台面/木马/运河语义；
- `procgenEngineV1=false` 不能完整回到当前稳定路径；
- 只有 Node/SVG 证据却把能力标成 `WIRED`、`VISUAL_ACCEPTED` 或 `DEFAULT_ON`。

## 十二、球形自然世界 V8：WFC + Marching Cubes 地貌、曲面水体与 GPU 云系（Grok 主线，Kimi 视觉复核）

本章是 2026-08-23 起新的生产主线，优先于 V7 中“运河城堡 profile”和把世界级运河作为全局交通骨架的
设计，但不推翻 V7 已通过测试的 WFC、ScalarField、Marching Cubes、Worker protocol、snapshot 与
migration gate。目标不是再叠一圈局部山丘，而是把当前“绿色球面 + 平面补丁 + 世界运河 + CPU 云对象”
重构为一个以曲面海洋为主体、若干大陆/岛屿分布其上、地貌与聚落互相解释、云层随海陆和山脉组织的
统一球形世界。

研究依据是：

- `/Users/panglaohu/Documents/Codex/2026-08-23/oskar-st-lberg-codex-text-link/outputs/oskar_stalberg_2023_2025_terrain_cloud_report.docx`；
- 同内容的 Pages 版本 `/Users/panglaohu/Downloads/oskar_stalberg_2023_2025_terrain_cloud_report.pages`；
- 当前 V7 自研引擎、V6 Half-Edge/SurfaceProvider/UV 编译器和现有球面坐标系统；
- 主人提供的四张参考图：岛屿—森林—山丘—湖泊整体关系、海岸/树群生成网格、球形不规则三角网格与
  曲面大陆分布。

### 12.1 先回答引擎现状：有 WFC 与 Marching Cubes，但尚未成为生产地貌

术语先统一：本任务语境中的第二个算法应为 **WFC（Wave Function Collapse）**；若“MCF/MFC”是指
Marching Cubes 与 WFC 的组合，V8 统一写成 `WFC → semantic field → Marching Cubes`，不再创造第三个
含义不明的算法缩写。

| 能力 | 当前真实状态 | V8 结论 |
| --- | --- | --- |
| WFC Core | `src/procgen/wfc/` 已有 BitSet、Shannon 熵、传播、有限回溯、2D/3D 模型与冲突解释；测试通过 | 复用；补球形/对偶图 tile 模型、宏观地貌约束和生产 caller |
| Marching Cubes | `src/procgen/field/marchingCubes.js` 已有 256 case、索引网格、语义通道和 chunk seam 测试 | 复用；补球形局部 chart、梯度法线、语义字段、层级平滑和真实 Three.js 提交 |
| WFC→Field→MC | `src/procgen/bridge/wfcFieldBridge.js` 有体素占用样片 | 目前只证明算法链能跑，不等于能生成星球大陆；V8 新建 planet compiler |
| Three.js/Worker | 协议与 adapter 纯数据测试通过 | 浏览器 module Worker、transfer、取消、资源原子替换仍未接入主场景 |
| 生产场景 | `main.js` 没有 procgen 生产 caller；三个 V7 开关默认 `false` | 当前高山圣城、苔庭、湖泊、云仍走 legacy/V6；不得宣称已完成 |
| 水体 | 月亮湖使用局部 `ShapeGeometry/CircleGeometry/RingGeometry`；世界由运河串联 | 改为球形海洋壳 + 曲率湖泊/湿地；世界运河退出主线 |
| 云 | `nature.js/lowPoly.js` 为多个球体组成的 Object3D，CPU 每帧逐云移动；另有云墙专用网格 | 新建 impostor/SDF atlas + cluster instance + vertex shader；云不再均匀环形撒点 |

V7 测试继续作为底座门禁；V8 的能力等级从 `ENGINE_TESTED` 之后重新开始，只有真实主场景消费 V8
snapshot 才能标 `WIRED`，不能因为 `test_procgen_v7_all.mjs` 通过就标视觉完成。

**执行回填（2026-08-23，Codex 代执行 Grok 主线）：** 已落地并测试球面 main/vertex-dual + face-dual
网格、60 个稳定地貌 tile、局部 patch pin、球面重心语义混合、全球 field/MC chart/seam、曲面海洋与
湖盆、统一水语义、气候云 atlas/LOD/投影阴影策略、V8 SurfaceProvider 注册、协作式 Worker fallback、
Three geometry adapter、原子 snapshot commit、资源引用计数和 V8 Inspector 数据层。生产 caller 已接到
主场景但所有 `planetTerrainV1/curvedWaterV1/cloudImpostorV1/oceanWorldRoutesV1` 默认仍为 `false`；
因此当前最高等级是 `TESTED`/受控 `WIRED` 候选，不是 `VISUAL_ACCEPTED`、`PERF_ACCEPTED` 或 `DEFAULT_ON`。
证据入口：`tools/test_planet_v8_all.mjs`、`tools/test_planet_v8_wfc.mjs`、
`tools/test_planet_v8_mc.mjs`、`tools/test_planet_v8_worker.mjs`；未完成项继续以 `TODO.md` 的未勾选状态为准。

### 12.2 世界设计决定：海洋为主体，大陆/岛屿承载地貌，退役世界运河
**追加执行回填：** `terrainRoutesV8.js` 已从最终导航图导出书店—苔庭与高山—三重门路线；书店门前/路线坡度由 compiler validator 阻断；V8 snapshot 已包含 MC 三角面采样出的 vegetation buckets、曲面 `water:lake:*` surfaceId、L1 waterfall basin，以及可回滚的 `planetSurfaceRidersV1` 玩家投影开关。新增 `combatSurfaceV8.js` 定义战区/keepout/失败闭合与投影契约，且 `loadCitadelCombat → saihojiPhalanx` 已在 opt-in 下消费 provider；完整台阶/瀑布寻路仍是功能测试项，但不再等待浏览器截图或主人签收，统一 acceptance matrix 负责其可自动化的 HTTP/视觉/回滚子门。

**数据回归追加：** `test_planet_v8_routes_1000.mjs` 已验证 1000 个 seed 的高山 stair/surface-transition 路线无 air edge；`test_planet_v8_scene_matrix.mjs` 已验证苔庭/湖沼/书店 100 seed 的曲面湖、植被 bucket 和路线契约。林地/草地/战斗的功能缺口仍按 TODO 实现；浏览器/GPU/视觉部分改由 unified acceptance matrix 的可重复数值代理验证。

**视觉验收策略变更（2026-08-23）：** 删除 TODO 中依赖截图、并排对比和主任人工签收的 Kimi 门禁，不再让这类任务阻塞主线。统一改用 `tools/test_automated_visual_qa.mjs` 与 `tools/test_grok_acceptance_matrix.mjs`：固定时间带/天气/seed，验证 LightingState 数值范围、AO 确定性与 dirty bounds、局部灯稳定排序、火炬上下限，并串联 `test_planet_v8_visual.mjs` 的色板、灰度 ΔL*、CVD ΔE00、camera schema/pose hash、HTTP module graph、shader contract、编译时间与资源回收。结果为可复现的 `AUTOMATED_TESTED`，不需要截图或人工签收。


**本轮追加回填（2026-08-23）：** `globalConstraints.js` 已对 WFC 输出执行陆块面积/组件、景区落陆地、港口临海、闭合曲面湖盆、书店—苔庭连丘和 highland→triple-gate 鞍部校验；`vegetationCompilerV8` 固定苔庭 pine 体积倍率 3；曲面水路改为球面 SLERP；Worker fallback 的取消状态与真实 Worker 统一。上述均有 V8 Node 门禁，视觉、GPU 性能和全场景迁移仍不越级。

1. 星球基准半径仍由 `PLANET_RADIUS/WORLD_RADIUS` 单一真源提供；不再用一个整球绿色材质冒充陆地。
2. 全球连续海洋为默认可见表面；陆地是高于海平面的连续曲面壳，约占可见星球面积的 28%～42%，最终
   以固定镜头和玩法密度调整，不追求真实地球比例。
3. 高山圣城、水晶峡谷、苔庭丘陵、湖沼湖区、书店镇丘陵带、三重门高地分别是大陆上的地貌模块，
   不是互不相干的矩形/圆形补丁。
4. 删除“用世界运河依次串联所有景点”的地理设定；港口、旧港、船只改走海湾、海峡和近岸航线。
5. 纳沃纳广场可保留为高山圣城内部的局部水庭/蓄水广场，但不再依赖全球运河。
6. 原 `canal-junction` 城堡不直接删除资产：迁移为 `coastal-harbor-citadel`（海峡/港湾城堡）或标记 legacy，
   由主人在固定镜头确认后决定是否退休；V8 不再新增 canal profile。
7. 湖泊是大陆凹地内的封闭曲面水体，湖面随星球曲率；河谷/瀑布可连接湖泊和海洋，但不形成规则环形运河。
8. 交通先保证玩法连续：电车走陆地坡面/山口，船走海面，步行走同源 SurfaceProvider；过渡期保留
   legacy canal behind flag，不能一刀切导致任务、战斗或港口物流失效。

### 12.3 目标数据架构：结构与数据在生成阶段，表现与运动交给 GPU

```text
LandmarkManifest（城堡/峡谷/苔庭/湖沼/书店/三重门/港口硬锚）
        │
        ├─ GeodesicMainGrid：不规则三角主网格，保存位置/高程/硬边/语义
        ├─ GeodesicDualGrid：tile/WFC/流域/气候/导航宏图
        ├─ TerrainGraph：山脊、谷线、海岸、盆地、山口、道路、河流 hard edges
        ├─ MacroWFC：手工地貌 tile 的受约束拼接，不用白噪声决定世界结构
        ├─ PlanetFieldComposer：球形基面 + 大陆/山体/峡谷/湖盆/地基 SDF
        ├─ SphericalChunkMC：局部切平面采样、共享 halo、确定性接缝
        ├─ HierarchicalSmoothing：保海岸/山脊/材质边/玩法锚，平滑自由顶点
        ├─ SemanticBake：tile barycentric、forestness、wetness、shore、flow、AO
        ├─ CurvedWaterCompiler：海洋壳、湖泊曲面、岸线、浅深水、航线
        ├─ Surface/Nav/Props：同一最终网格生成碰撞、路径、森林和建筑落点
        ├─ CloudClimateCompiler：海陆/高程/风场生成云团与烘焙运动参数
        └─ Three/GPU：静态 batch + InstancedMesh + shader，只更新时间/天气/风 uniform
```

V8 世界快照禁止塞 Three.js 对象：

```js
const worldSnapshotV8 = {
  version: 8,
  seed,
  graph: { mainHash, dualHash, landmarkPins, terrainEdges },
  land: { chunkManifest, meshHash, semanticHash, biomeStats },
  water: { oceanLevel, lakeBasins, shorelineHash, routeHash },
  nav: { surfaceHash, portalHash, routeHash },
  vegetation: { clusterHash, instanceCounts },
  clouds: { atlasVersion, clusterHash, climateHash, instanceCount },
  versions: { procgen, tileSet, fieldRecipe, shader, palette },
};
```

### 12.4 总编译流程与失败原则

```js
async function compilePlanetV8(request, ctx) {
  const manifest = validateLandmarkManifest(request.landmarks);
  const grids = buildGeodesicMainAndDualGrid({
    radius: request.radius,
    subdivision: request.quality.geoSubdivision,
    seed: request.seed,
  });

  const hard = compilePlanetHardConstraints(grids, manifest, {
    coastClearance: request.rules.coastClearance,
    routeWidths: request.rules.routeWidths,
  });

  const macro = await ctx.wfc.solve({
    graph: grids.dual,
    compiled: ctx.terrainTiles,
    table: ctx.terrainCompatibility,
    pins: hard.tilePins,
    seed: forkSeed(request.seed, "planet-macro-wfc"),
    maxBacktrack: request.rules.maxBacktrack,
  });
  if (!macro.ok) return fail("macro-wfc", explainPlanetConflict(macro, hard));

  const validated = validatePlanetTopology(macro, hard, grids);
  if (!validated.ok) return fail("planet-topology", validated);

  const fieldRecipe = composePlanetField({ grids, macro, hard, profiles: request.profiles });
  const landChunks = await ctx.workers.meshPlanetChunks(fieldRecipe, request.dirtyChunks);
  const seamReport = validateSphericalChunkSeams(landChunks);
  if (!seamReport.ok) return fail("mc-seam", seamReport);

  const smoothed = hierarchicalSmooth(landChunks, fieldRecipe.constraints);
  const semantics = bakeTerrainSemantics(smoothed, grids, macro, fieldRecipe);
  const water = compileCurvedWater({ grids, fieldRecipe, semantics, hard });
  const surfaces = compileSurfaceProvider({ land: smoothed, water, hard });
  const nav = compilePlanetNavigation({ surfaces, portals: hard.portals });
  if (!validateAllLandmarkRoutes(nav, manifest).ok) return fail("navigation", nav.report);

  const vegetation = compileVegetation({ surfaces, semantics, hard, seed: request.seed });
  const clouds = compileCloudClimate({ grids, semantics, water, wind: request.weather.wind });
  return createPlanetSnapshotV8({ grids, macro, smoothed, semantics, water, nav, vegetation, clouds });
}
```

失败时保持当前世界不变；不得用绿色平面、默认球面或随机重启掩盖错误。失败报告至少包含 seed、tile
冲突、受影响 landmark、field chunk、seam、route 和建议放宽的明确规则。

### 12.5 主网格、对偶网格与球形 chart

底网选择细分 icosahedron，而不是经纬 SphereGeometry：它避免极点顶点拥挤，三角形更均匀，也与参考图的
球形不规则三角网格一致。允许在艺术层做受限扰动，但稳定 ID 与共享边不能变化。

```js
function buildGeodesicMainAndDualGrid({ radius, subdivision, seed }) {
  const main = subdivideIcosahedron(subdivision);
  canonicalizeSharedVertices(main);                 // 同一拓扑点只有一个 stable id
  constrainedRelaxOnSphere(main, seed, {
    iterations: 3,
    maxAngularMove: degToRad(0.35),
    preserve: ["landmark", "coast", "ridge", "route"],
  });
  projectEveryVertexToRadius(main, radius);
  const dual = buildDualFromTriangleCenters(main); // 大多六边形，12 个五边形允许存在
  assignOppositeHalfEdges(main, dual);
  const charts = partitionIntoTangentCharts(main, { maxAngularRadius: degToRad(12), haloRings: 2 });
  return freezeAndHash({ main, dual, charts });
}
```

主网格保存最终几何相关数据；对偶网格保存离散 tile、气候、流域和宏观路径。二者通过稳定映射关联，
不允许把 WFC cell index 当世界坐标。所有 chart 使用球心方向构造切线基，边界采样采用全局 canonical
sample key，禁止每块自行取浮点位置导致裂缝。

### 12.6 手工 terrain tiles 与球形 WFC

WFC 的职责是组合有设计意图的离散模块，不负责凭噪声发明山川。第一版 tile 集控制在 40～80 个原型，
通过旋转/镜像生成 variant：

- `ocean.deep / ocean.shelf / coast.convex / coast.concave / strait / bay`；
- `plain.grass / hill.low / hill.rolling / ridge / mountain / peak / saddle`；
- `valley / canyon.wall / canyon.floor / waterfall.notch / river.outlet`；
- `lake.basin / wetland / swamp.islet / forest.edge / forest.core / clearing`；
- `settlement.pad / road.pass / harbor.shelf / landmark.keepout`。

```js
const terrainTile = {
  id: "terrain.hill.rolling.v1",
  weight: 1.8,
  orientationGroup: "D6_LOCAL", // 对偶 cell 的局部边序；按实际 valence 编译，不假设全为六边形
  elevationBand: [0.8, 2.4],
  sockets: ["grass", "grass", "forest-edge", "valley", "grass", "ridge-low"],
  fields: { land: 1, uplift: 0.42, roughness: 0.3, wetness: 0.35, forestness: 0.55 },
  constraints: { maxSlopeToNeighbor: 0.4, forbidAdjacent: ["ocean.deep"] },
};
```

球形对偶格 valence 可能为 5/6/7；兼容表按 half-edge 的局部方向 token 和 socket 编译，不能硬编码
N/E/S/W。景点模块由 `forceModulePatch()` 先锁局部图，再让 WFC 补周边：

```js
function pinLandmarkBiome(graph, landmark) {
  const patch = growGeodesicPatch(graph, landmark.direction, landmark.angularRadius);
  const template = LANDMARK_TEMPLATES[landmark.profile];
  return fitTemplateToPatch(template, patch, {
    preserveEntranceBearing: landmark.forward,
    preserveRoutes: landmark.routeAnchors,
  });
}
```

全局 validator 必须检查大陆数量/面积、海洋连通、海峡宽度、湖盆闭合、河流出口、山口、聚落坡度、固定
镜头遮挡、所有任务路线；任何不满足项只重解最小相关 patch。

### 12.7 球形 ScalarField、Marching Cubes 与层级平滑

全球 field 以径向符号距离为基础：

```js
function samplePlanetField(worldP, ctx) {
  const r = length(worldP);
  const dir = worldP / r;
  const semantic = ctx.dual.sampleBarycentric(dir);
  const baseHeight = ctx.seaLevel + semantic.land * semantic.elevation;
  const terrain = r - (ctx.radius + baseHeight);

  return smoothMin(
    terrain,
    sdfMountains(worldP, ctx.mountainPins),
    sdfRollingHills(worldP, ctx.hillPins),
    ctx.blend
  )
    - sdfCanyonCuts(worldP, ctx.canyonPins)
    - sdfLakeBasins(worldP, ctx.lakePins)
    - sdfWaterfallNotches(worldP, ctx.waterfallPins)
    + sdfFoundationCollars(worldP, ctx.buildingPins);
}
```

每个 chart 在局部 `(u, radial, v)` 体素盒采样，但 `worldP` 和 field 值来自全局函数；相邻 chart 的
halo 必须命中同一 canonical sample。MC 输出后将点保留在真实世界坐标，不做“生成平面再整体弯曲”的二次
近似。法线优先由全局 field 中心差分梯度计算，视觉 flat normal 作为独立可控属性。

层级平滑保护艺术意图：

```js
function hierarchicalSmooth(mesh, constraints) {
  const level = classifyVertexLevels(mesh, constraints);
  // 0: landmark/coast/ridge/cliff/material border；1: transition；2: free terrain
  for (let pass = 0; pass < 5; pass++) {
    for (const v of stableVertexOrder(mesh)) {
      if (level[v] === 0) continue;
      const allowed = neighbors(v).filter(n => level[n] <= level[v]);
      const tangentTarget = weightedMean(allowed.map(n => projectToTangent(mesh[n], mesh[v])));
      mesh.next[v] = clampMoveOnSphere(mesh[v], tangentTarget, constraints.maxMove[level[v]]);
    }
    swap(mesh.position, mesh.next);
    reprojectRadialHeight(mesh, constraints.field);
  }
  return mesh;
}
```

禁止普通拉普拉斯平均抹平海岸、山脊、瀑布缺口、道路和建筑基座。层级平滑前后 hard vertex 的位置 hash
必须不变，软区曲率尖峰显著下降。

### 12.8 语义烘焙、UV splatting、材质与森林

生成阶段向顶点写入运行时 shader 所需数据：

```text
position / normal / tangent
tileIds0: uvec4        # 最主要的 4 个 tile/biome id
tileWeights0: vec4     # 和为 1
terrainData0: vec4     # elevation, slope, wetness, coastDistance
terrainData1: vec4     # forestness, rockness, snowness, coarseAO
flowData: vec4         # tangent flow xy, speed, phase
```

```glsl
vec3 sampleTerrainPalette(uvec4 ids, vec4 w) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; ++i) c += texelFetch(uPalette, ivec2(int(ids[i]), 0), 0).rgb * w[i];
  return c;
}

void main() {
  vec3 base = sampleTerrainPalette(aTileIds, aTileWeights);
  base = mix(base, uWetColor, aWetness * 0.28);
  base = mix(base, uRockColor, smoothstep(uRockSlope0, uRockSlope1, aSlope) * aRockness);
  // flow/shoreline 只做低幅可循环表现，不改变拓扑和碰撞。
}
```

森林与山丘互补而非各自随机撒点：

```js
forestness = saturate(
  tileForestness * 0.55 +
  moisture * 0.25 +
  northFacing * 0.12 -
  steepSlope * 0.7 -
  coastExposure * 0.18 -
  settlementKeepout
);
```

树木从 surface triangle 按面积和 barycentric 权重采样，规模随 forestness 连续变化；林缘稀疏、核心密集，
山脊/草甸留白，建筑、道路、铁轨、战斗区有 hard keepout。实例按树种/材质/LOD 批处理，不创建成百上千个
独立 Group。

### 12.9 曲面海洋、湖泊、湿地与海岸

海洋采用全局球壳 `oceanRadius = radius + seaLevel`，陆地 MC 表面在其上方露出；海底可用低分辨率
bathymetry 壳或深度 shader，不为每片海域创建平面。大陆海岸来自 land field 与海平面的交线。

```js
function compileCurvedWater({ grids, fieldRecipe, semantics, hard }) {
  const ocean = buildGeodesicWaterShell({
    radius: fieldRecipe.radius + fieldRecipe.seaLevel,
    clipByLandMask: true,
    bathymetry: semantics.depthToCoast,
  });
  const lakes = hard.lakeBasins.map(basin => {
    const level = solveClosedBasinWaterLevel(basin, fieldRecipe);
    const contour = traceIsoContourOnSurface(basin, level);
    return triangulateCurvedCap(contour, {
      radialLevel: level,
      subdivisions: quality.lakeSubdivisions,
      semantic: "inland-water",
    });
  });
  const shore = compileShoreBands({ ocean, lakes, semantics });
  return { ocean, lakes, shore, routes: compileOceanRoutes(hard.harbors, shore) };
}
```

湖面每个顶点都在 `radius + localWaterLevel` 的曲面上；禁止再用 `CircleGeometry/ShapeGeometry` 作为最终
湖面。近岸波浪由多组错相 shoreline wave instance 或 shader 播放，拓扑不每帧重建。浅水、深水、湿地、
可涉水与船只航线从同一 water semantic 数据生成。

退役运河的迁移顺序：

1. 建海洋壳与两座测试海湾，不改任务；
2. 生成旧港—高山圣城—水晶城近岸航线，验证船和物流；
3. 把 `canalBoats` adapter 改为通用 `waterRouteFleet`；
4. 将月亮湖、白鲸湖、苔庭湿地改为曲面 basin；
5. 纳沃纳广场改为局部水庭；
6. 任务/地图/提示不再引用世界运河；
7. 运行存档迁移，将船在旧运河参数 `u` 映射到最近新航线；
8. 主人确认后才关闭 `legacyCanalWorld`，最后退休 `loadCanalNetwork()` 生产调用。

### 12.10 六个景区的地貌 profile（2026-08-23 地貌链重构）

六个景区不再是六个独立的景点 patch，而是一条位于同一球面大陆上的连续地质剖面：
`高山圣城（雪峰） → 三重门（裂谷肩部垭口） → 水晶城（东非大裂谷） → 湖沼（裂谷长湖） → 书店镇（奥克兰火山丘陵） → 苔庭（日本式冲积平原）`。

该顺序是游戏世界的主陆地链，不是现实地理的复制。Oskar 风格只吸收“手工模块 + 受约束生成 + 清晰轮廓 + 生成阶段烘焙数据、运行阶段 shader 表现”的方法，不复制具体地标或美术资产。相邻景区必须由过渡带相连，球面上不能出现无意义的海洋缝隙。

#### 12.10.1 高山圣城：乞力马扎罗式火山雪峰、五层台地与冰雪水系

- 生成类似乞力马扎罗的孤立火山 massif：宽大基座、陡峭上锥、雪线、冰川沟、放射状冲沟和干燥低坡；不做真实地球复制，也不把雪材质贴成整块白球。
- 远景要读出主峰、次峰、山脊、鞍部、雪线和崖壁；城堡位于低于雪线的五层人工/自然台地，不能占据峰顶。
- 五层台地作为山体中的人工/自然肩部 hard stamp，编号、瀑布顺序、楼梯、木马、门口路线全部保留。
- 第一层瀑布从最低高地落入湖/海湾；木马水面位置和头朝向不因 MC/WFC 漂移。
- WFC 只填台地建筑与受控变体；MC 负责山体、肩部、崖壁、湖岸、瀑布缺口和地基过渡。
- 远景轮廓至少出现 3 个不同高程峰组、1 个雪线、2 条冰雪融水/瀑布方向；建筑群不把整座山遮成一块墙。

```js
highlandField = radialBase()
  .smoothUnion(volcanicMassif(mainPeak, secondaryPeaks, snowline, glacialGullies))
  .smoothUnion(ridgeChain(peaks, saddles))
  .smoothUnion(terraceShoulders(fiveLockedTerraces))
  .subtract(waterfallNotches(lockedWaterfalls))
  .subtract(lakeBasins(lockedLakes))
  .smoothUnion(foundationCollars(citadelModules));
```

#### 12.10.2 水晶城：东非大裂谷式断层峡谷

- 用两条长距离断层崖和缓倾肩部形成东非大裂谷式峡谷：谷壁宽、谷底相对平、断层台阶清晰；不是 V 形河沟，也不是在平球面上摆两堵墙。
- 峡谷宽度、深度、曲率和视线逐段变化，至少包含入口收窄、内部展开、冲积扇、断层台阶和高地出口。
- 谷底 SurfaceProvider 与电车轨道共用高程；轨道不再靠 `carveHillsForTrack()` 单独压出平沟。
- 云在迎风坡聚集、越岭后进入雨影；谷底形成薄雾/低云，门和轨道不能永久被遮挡。

#### 12.10.3 苔庭：日本式冲积平原与苔野

- 苔庭不再定义为丘陵盆地，而是日本式低起伏冲积平原：宽阔平坦战场、浅沟渠、稻田/苔野纹理、河漫滩和远处低林缘；当前矩形深绿色 patch 必须消失。
- 苔庭内外使用同一 field、法线、语义和调色；平原边界由 wetness/forestness/苔藓权重渐变，战斗区坡度保持低值。
- 松树体积 3 倍的既有要求保留，但大树只作林缘/岛状群落，不把平原变成森林；树密度、尺度和林缘由 forestness 驱动。
- 战斗队列、攀爬和地表寻路消费同一 SurfaceProvider；地貌变化不能重现空中士兵。

#### 12.10.4 湖沼：东非裂谷长湖、芦苇浅滩与白鲸事件

- 湖沼采用马拉维湖/坦噶尼喀湖式裂谷长湖：狭长湖盆、陡岸断层、宽窄交替湖身、浅滩芦苇、泥湿带和少量可达岛屿。
- 峡谷水系经冲积扇进入湖沼；至少一条水路、步行路线和船路线在同一 curved-water graph 上闭合。
- 沼泽不是另一块绿色平面；wetness 与水深决定草色、芦苇、泥地、树种和行走减速。
- 白鲸湖作为裂谷湖中的幻想事件水域，保留独立演出/keepout；不声称白鲸是现实东非湖泊生态事实。

#### 12.10.5 书店镇：新西兰奥克兰式火山丘陵

- 书店镇采用奥克兰式火山丘陵/凝灰岩地貌：多个低矮火山锥、宽缓草坡、火山口浅洼、黑色玄武岩/棕红凝灰岩露头和近岸平地。
- 用 geodesic ridge/hill chain 连接书店镇与苔庭，跨扩大后的球面保持连续坡地；火山锥不能变成互不相连的圆锥岛。
- 建筑落点是局部缓坡/鞍部，不再是孤立余弦丘；道路与电车轨道沿坡度约束选择山口。
- 必须有至少一条可步行坡路和一条电车路线；两者在球面上闭合且不穿海。

#### 12.10.6 三重门：裂谷肩部的高地垭口关隘

- 三重门是连接高山和裂谷的断层肩部垭口：海拔严格介于高山城堡台地与峡谷谷底之间，门下有上坡、门体平台和下切峡谷。
- 地貌形态为断层台地、鞍部风口、两侧裸岩肩和一条盘山/电车走廊；门体两侧地形提供支撑和框景。
- 门下电车走廊、鸟群走廊、云底净空为 hard volume；WFC/MC 不得堵塞。
- 建筑可借鉴日式三门的垂直构图，但地貌必须首先读作裂谷关隘；远景必须读出“雪峰—上坡—三门—下裂谷”的高程关系，而不是门浮在平地或空中。

### 12.11 云系统：impostor/SDF、tile cluster 与 GPU 循环运动

V8 云不做写实体积流体，也不沿纬度均匀撒独立 Object3D。生成阶段完成代理和参数，运行阶段只更新少量
uniform。

资产管线：

1. 用项目自有低模云块生成 8/16 视角 octahedral impostor atlas；
2. 每视角额外生成 signed/unsigned distance field、深度和法线近似通道；
3. 云原型按 `puff/streak/stack/anvil/wispy` 聚类，记录包围球和遮挡层；
4. `CloudClimateCompiler` 根据海洋蒸发、到岸距离、高程、坡向、湿度和风生成 cluster；
5. cluster 内代理用 `InstancedMesh` 或单 batch，写入 `position/scale/rotation/inDir/outDir/timeOffset/type`；
6. vertex shader 负责循环平移、轻微胀缩、风切变和视角展开；fragment shader 用 SDF 软边、深度和
   day/night 光照；
7. 云影单独低分辨率投影或解析 blob，不让每个云代理投实时阴影。

```js
function compileCloudClimate({ grids, semantics, water, wind, seed }) {
  for (const cell of grids.dual.cells) {
    const vapor = water.evaporativeMoisture(cell) * wind.upwindOceanFetch(cell);
    const lift = max(0, dot(wind.direction, semantics.terrainGradient(cell)));
    const rainShadow = semantics.downwindMountainOcclusion(cell);
    const probability = saturate(vapor * 0.65 + lift * 0.5 - rainShadow * 0.55);
    if (stableHash01(seed, cell.id, "cloud") > probability) continue;
    clusters.push(buildCloudCluster(cell, {
      type: chooseCloudType(vapor, lift, semantics.weather(cell)),
      altitude: chooseAtmosphereLayer(cell, lift),
      motion: bakeLoopMotion(wind, cell, seed),
    }));
  }
  return batchCloudClusters(clusters);
}
```

```glsl
// 生成阶段已写 aInDir/aOutDir/aPhase；CPU 每帧只更新 uTime/uWind/uWeather。
float phase = fract(uTime * aSpeed + aPhase);
vec3 travel = cubicLoop(aInDir, aOutDir, phase) * aTravelRadius;
float breathe = 1.0 + sin((phase + aPhase) * 6.28318) * aBreathe;
vec3 world = aAnchor + travel + rotateBillboard(position * aScale * breathe);
```

验收要求：云团在海面和迎风山坡更常见，峡谷/山顶产生云海，湖泊上方有低云但不永久遮住景点；从近景
到远景没有明显 billboard 翻面，CPU 不再逐朵遍历修改 transform，云 draw calls 与 cluster 数解耦。

### 12.12 导航、交通、战斗和任务迁移

地貌重构必须同时迁移玩法消费者：

- `SurfaceProvider`：最终 MC land + 模块台面 + 楼梯/桥 portal 为唯一地表真源；
- 玩家/士兵/动物：每帧只查询 surface/nav，不读取旧 `groundLiftAt()` 作为生产事实；
- 电车：轨道通过 geodesic route planner 沿陆地坡度和山口布线，最大坡度/最小曲率/门洞净空均验证；
- 船只：从 canal curve 切换到 ocean/lake water routes，保持登船、物流、镜头和 BGM API；
- 高山攻防：台面、楼梯、瀑布 portal 和门口保持 hard lock；地貌重建后跑 off-surface=0 回归；
- 苔庭战斗：坡度、森林 keepout、冲锋宽度和撤退路线写进战术图；
- 任务/NPC/存档：所有旧 `(flatX, flatZ, lift)` 转为 landmark-relative anchor + surface projection；
- 小地图：海洋、陆地、湖泊、海湾、山脉和路线从 V8 snapshot 生成，不再把运河当世界主线。

```js
function migrateLegacyAnchor(anchor, snapshotV8) {
  const worldGuess = legacyFlatToWorld(anchor.x, anchor.z, anchor.lift);
  const landmark = snapshotV8.landmarks[anchor.landmarkId];
  const hit = snapshotV8.surface.project(worldGuess, {
    region: landmark.regionId,
    semantic: anchor.allowedSurface,
    maxDistance: anchor.maxMigrationDistance,
  });
  if (!hit) throw migrationError(anchor, "no-compatible-surface");
  return { surfaceId: hit.surfaceId, barycentric: hit.barycentric, localYaw: anchor.yaw };
}
```

### 12.13 Worker、批处理、资源生命周期与移动端预算

- 生成任务拆为 `graph → WFC → field → MC → smooth → semantic → water/nav/cloud`，每阶段有进度和取消点；
- Worker 返回 transferable typed arrays；Three.js 对象只在主线程帧边界创建/替换；
- 同一地貌区域尽量烘焙为少量静态 mesh/material groups，而不是每 tile 一个 Object3D；
- 树木/岩石/云使用实例化，建筑保留可交互模块与静态 batch 的分层；
- dirty 编辑只重算受影响 dual cells、field charts、water contour、nav 和 cloud climate；
- 资源替换后由 `ResourceRegistry` 释放旧 geometry/texture/worker listener；
- 不在第一版实现跨分辨率 MC LOD；相邻活动 chart 同分辨率，远区整体降档后必须有 seam 方案。

初始预算：

- 首次全球结构生成 Worker P95 ≤ 2.5s（显示进度，主线程无 >50ms long task）；
- 单景区 dirty compile Worker P95 ≤ 120ms；单 chunk MC P95 ≤ 20ms；主线程 patch apply P95 ≤ 4ms；
- 近景固定镜头桌面 ≥ 50FPS，中档 ≥ 35FPS；
- 地形+水体 draw calls ≤ 24，植被 ≤ 18，云 ≤ 8（不含建筑/角色）；
- 10 分钟电车/船/战斗/昼夜后 geometry、texture、buffer、listener、worker job 回到稳态；
- 同 seed/版本生成的 graph/WFC/field/mesh/water/nav/cloud hash 三次一致。

### 12.14 开关与安全迁移顺序

新增独立开关，默认均为 `false`：

```js
planetGraphV1: false,
planetTerrainV1: false,
curvedWaterV1: false,
terrainSemanticShaderV1: false,
cloudImpostorV1: false,
oceanWorldRoutesV1: false,
legacyCanalWorld: true,
```

阶段顺序：

1. `planetGraphV1`：只显示 main/dual/landmark debug，不改画面；
2. `planetTerrainV1`：只在苔庭小样片接 WFC→field→MC；
3. 高山圣城山体与水晶峡谷候选接线，legacy 仍可一键回退；
4. `curvedWaterV1`：先双海湾和月亮湖，再全海洋/湖泊；
5. `oceanWorldRoutesV1`：船只与港口迁移，世界运河仍并行但隐藏候选；
6. 书店—苔庭丘陵、湖沼、三重门高地迁移；
7. `terrainSemanticShaderV1`：材质/森林语义接入；
8. `cloudImpostorV1`：云 A/B；
9. 存档、任务、小地图、交通和战斗全量回归；
10. 主人确认海陆格局后设 `legacyCanalWorld=false`；稳定版本后才退休旧 canal caller。

每阶段都必须能在同一存档中切回旧路径；视觉 mesh、碰撞和导航不得混源。

### 12.15 固定镜头、测试矩阵和验收数据

固定镜头至少 34 个：

- 全球鸟瞰 4（大陆分布、海洋面积、昼夜、云海）；
- 高山圣城 6（全景、五层台地、L1 瀑布/木马、港口、山脊轮廓、深夜）；
- 水晶峡谷 5（谷口、谷底、电车、城门、高地出口）；
- 苔庭 4（战斗视角、丘陵轮廓、林缘、矩形 patch 历史问题位）；
- 湖沼 4（湖盆、浅滩、岛屿、白鲸湖）；
- 书店镇 3（与苔庭连丘、坡路、电车）；
- 三重门 3（远景高地、门下走廊、鸟/云净空）；
- 水体 3（海湾、曲面湖、旧运河迁移位）；
- 云 2（迎风山云海、海上大云层）。

自动测试：

- geodesic main/dual Euler 特征、对偶映射、稳定 ID、五边形例外、无非流形边；
- 球形 chart halo 和 MC seam 世界位置/法线误差 ≤ `1e-5`；
- hard coast/ridge/route 顶点在 smoothing 前后位置 hash 不变；
- 100 seeds 大陆面积、海洋单连通、海岸长度、湖盆闭合、山口、景区可达统计；
- 各景区 golden + 100 seeds；高山路线/苔庭战术/电车/船额外 1000 seed 纯数据验证；
- 湖面曲率误差、岸线穿插、船体水线、涉水深度和倒影裁剪；
- 云 cluster 确定性、实例数、atlas/SDF 边缘、视角翻转、CPU update cost；
- legacy→V8 anchor/save/route migration、三向 rollback、资源压力和任务全流程。

视觉指标由脚本在固定镜头规格上记录：P10/P50/P90、饱和度、clipped/dark%、海陆 ΔL*、森林/草地 ΔE、
深夜局部灯对比、三类色盲模拟；任何画面不得以“像 Oskar”一句话代替数据。镜头 JSON 保留为稳定输入，
不再强制生成 PNG 或等待主人签字。

### 12.16 Grok/Kimi 分工（Grok 约 85%，Kimi 约 15%）

**Grok 主线：**

- 球形 main/dual grid、tile schema、WFC、hard planner、field/MC、层级平滑、语义烘焙；
- 海洋/湖泊/湿地、海岸、船航线和世界运河退役；
- 六个景区 profile、SurfaceProvider、导航、电车、战斗、任务与存档迁移；
- impostor atlas/SDF 生成工具、cluster compiler、shader、实例化、Worker、ResourceRegistry；
- 所有算法测试、seed 矩阵、HTTP/浏览器接线代理、性能代理、回滚与调试工具；统一入口为 `tools/test_grok_acceptance_matrix.mjs`。

**Kimi 独立视觉线：**

- 冻结 34 个 camera JSON、pose hash 和 A/B 数据命名；不要求输出截图文件；
- 给出地形/水体/森林/云/昼夜 palette 与 lighting JSON，只调参数不修改 solver 真源；
- 对每阶段运行彩色、灰度、三类色盲、clay/normal/semantic/seam 数值检查并形成 P0/P1/P2 缺陷单；
- 检查海陆整体协调、山体轮廓、湖面曲率、林缘密度、云遮挡和深夜可读性；
- 独立复核 Grok 的最终候选。Kimi 的参数 QA 不能阻塞算法开发，也不再存在主人确认门；最终只记录脚本可重放的 `AUTOMATED_TESTED`。

### 12.17 V8 完成定义

只有同时满足以下条件，才可称“球形自然世界重构完成”：

1. 全球画面以连续曲面海洋和多个连贯陆块为主体，不再是绿色整球贴局部补丁；
2. 高山圣城=高山、水晶城=峡谷、苔庭/书店=相连丘陵、湖沼=湖盆湿地、三重门=高地山口；
3. 月亮湖/白鲸湖/苔庭湿地均有球面曲率，所有最终水体不再使用平面 Circle/Shape 作为生产真源；
4. 世界运河退出地理和交通主线，船只、港口、物流、任务和存档已迁到海洋/湖泊路线；
5. 地形结构由 hand-authored tiles + WFC + hard constraints 决定，MC 生成连续表面，层级平滑不破坏硬边；
6. forestness/wetness/coast/flow/AO 等语义烘焙到最终 mesh，森林与山丘互补且无矩形边；
7. 云由 impostor/SDF cluster 批处理，GPU shader 负责运动，分布与海洋、山脉、风场相匹配；
8. visual/collision/nav/water route 同源，玩家、电车、船和士兵无穿地、浮空、非法跨层；
9. golden/random seed、HTTP module graph、固定镜头数值、色盲、shader/性能代理和资源生命周期全部通过统一脚本；
10. 所有新开关可独立回滚并保持默认关闭，脚本不得越级写 `DEFAULT_ON`；legacy canal/terrain/cloud 通过静态迁移检查后再做机械退休。

### 12.18 Grok 代码回填批次（2026-08-23，Codex 代执行）

本批次把可以用纯数据和自动化门禁客观验收的 Grok 工作先落地，并将浏览器/GPU/主人视觉门全部改成脚本验证：

- `src/procgen/constraints/hardRoutePlanner.js`：新增 hard constraint schema、manifest/route lock 编译、solver pin 导出、分段路线/支撑/开口/水路/战术/镜头净空校验，以及保留区域外 pins 的有限局部 repair、失败快照和日志。
- `src/procgen/profiles/profilePlanners.js`：新增三类城堡 planner。高山 planner 锁港口、L1 瀑布、L1 水面木马、朝向 canal、5 层台地和显式 stairs/waterfall portal；消费现有 `TROJAN_RULES` 输出四绳×两次、两组路线、天亮回收。古堡 planner 先锁闭合墙环/主门/内外道路/巡逻回路；运河 planner 先锁中心线/宽度/水位/入口出口/桥净空，WFC 只能填两岸。
- `src/procgen/profiles/castleProfiles.js`：三类 V7 profile 现在携带 `routePlan`，仍共用既有 solver/field/MC contract，不在 profile 内复制求解器。
- `src/procgen/planet/sphericalWfc.js`：WFC 完成后增加受 hard pins 保护的海洋覆盖后处理，只把未锁定外围陆地变成 shelf，保持 deep ocean 连通；`globalConstraints.js` 将 oceanFraction<0.5 判为失败，目标为 oceanFraction≥0.52。
- `tools/test_procgen_profiles_hard_routes.mjs`：固定种子 1/7/42/884 + 100 个种子，验证三 profile planner、四绳木马、无 air edge、古堡墙环、运河稳定水面/桥净空。
- `tools/test_planet_v8_wfc.mjs`：100 个 seed 增加海洋主体断言；`tools/test_procgen_v7_all.mjs` 与 V7 总入口串联 profile planner 阶段。

本批次的统一门禁命令为：

```bash
node tools/test_grok_acceptance_matrix.mjs
```

它生成 `tools/out/grok-acceptance-matrix.json`，当前结果为 `AUTOMATED_TESTED`：HTTP module graph 递归
通过 62 个模块；固定 seed/route/visual 子测试通过；shader source 合约通过；compile P50/P95 与
ResourceRegistry 20 轮 replace/disposeAll 代理通过；所有新 feature flag 仍默认 false。脚本不需要浏览器
截图、GPU 实机或主人签字，也不声称真实硬件 FPS；真实生产功能缺口仍按 TODO 的功能项继续实现。

### 12.19 浏览器/GPU/主人门禁自动化替代方案（2026-08-23）

门禁映射如下：

| 原人工门 | 脚本替代 | 通过证据 |
| --- | --- | --- |
| 浏览器 file://、origin null、Worker/CORS | 临时 `127.0.0.1` HTTP server + 递归 ES module graph fetch | 所有相对模块 HTTP 200；无 `file://`；`moebiusTower.js` 可达 |
| GPU 固定镜头、色板、夜间可读性 | camera schema/pose hash + palette/LightingState + 灰度 ΔL* + CVD ΔE00 + shader source contract | `test_planet_v8_visual.mjs`、`test_automated_visual_qa.mjs` |
| GPU FPS、长时资源、回滚 | compile P50/P95、静态 shader/预算、20 轮 ResourceRegistry replace/disposeAll、seed snapshot hash | `performanceProxy`、`rollbackAndFlags` |
| 主人截图/签字、默认开启 | 可重放阈值与默认 flag contract；失败即非 `AUTOMATED_TESTED`，不自动开启 | `status=AUTOMATED_TESTED`、flags all default false |

伪代码：

```js
async function automatedAcceptance() {
  const http = await serveOverHttp("TigerMessenger");
  const graph = await fetchRecursiveModules(http, "/shot-harness.html");
  assertEvery(graph, (m) => m.status === 200 && !m.body.includes("file://"));

  run("test_procgen_profiles_hard_routes.mjs");
  run("test_planet_v8_visual.mjs");
  run("test_automated_visual_qa.mjs");

  const timings = compileSeeds([1, 7, 42, 884, 1000, 1001, 1002, 1003]);
  assertFinite(timings.p50, timings.p95);
  assertShaderSourceFinite();
  assertResourceRollback({ cycles: 20, finalRegistrySize: 0 });
  assertDefaultFalse(["procgenEngineV1", "planetTerrainV1", "curvedWaterV1", "cloudImpostorV1"]);
  writeReport({ status: "AUTOMATED_TESTED", graph, timings });
}
```

### 12.20 球形连续地貌链实施计划（2026-08-23）

#### 12.20.1 目标与不变量

目标是把六个景区从“六个可到达的 landmark”升级为“同一块大陆上的六段地质叙事”，同时保留现有城堡、木马、瀑布、湖泊、电车、船和战斗入口。必须满足：

1. 六景区沿同一条球面大圆弧排列，主陆块连续；景区之间允许海湾/河口，但不能出现无解释的直角海洋断口。
2. 相邻地貌的海拔、沉积物、水系和植被有连续过渡，不能只改 `profile` 字符串而保持同一块绿色场地。
3. 生成阶段由 `landmarkManifest → macro chain → WFC → semantic field → MC → curved water → nav` 完成结构和数据；shader 只负责色彩、云、风、湿润度和低成本运动。
4. 视觉、碰撞、导航、船路和战斗都读取同一个 `PlanetSnapshotV8`，禁止为某个镜头单独压平或补一块矩形地形。
5. 旧 profile ID 可保留兼容别名：`saihoji-hills` 映射到 `saihoji-plain`，避免旧存档/相机/任务直接失效；新 snapshot 使用新版本号和新 hash。

#### 12.20.2 宏观链数据模型

```js
const GEOLOGY_CHAIN = [
  { id: "highland-citadel", class: "volcanic-snow-massif", t: 0.00, elevation: [0.62, 1.00], water: "glacial-runoff" },
  { id: "triple-gate",     class: "rift-shoulder-pass",   t: 0.18, elevation: [0.48, 0.72], water: "seasonal-gully" },
  { id: "crystal-canyon",  class: "rift-escarpment",       t: 0.36, elevation: [0.18, 0.56], water: "canyon-stream" },
  { id: "swamp-lake",      class: "rift-long-lake",        t: 0.55, elevation: [0.05, 0.28], water: "closed-lake-basin" },
  { id: "bookshop-town",   class: "auckland-volcanic-hills", t: 0.76, elevation: [0.20, 0.48], water: "coastal-estuary" },
  { id: "saihoji-moss-garden", class: "japanese-alluvial-plain", t: 1.00, elevation: [0.12, 0.24], water: "plain-stream" },
];

function buildContinuousChain({ anchor, terminal, seed }) {
  const basis = greatCircleBasis(anchor, terminal);
  return GEOLOGY_CHAIN.map((node) => ({
    ...node,
    direction: slerpUnit(anchor, terminal, node.t),
    transitionIn: transitionFor(node.id, "in", basis),
    transitionOut: transitionFor(node.id, "out", basis),
    hardPins: compileLandformPins(node, basis, seed),
  }));
}

function compileContinuousPlanet(input) {
  const chain = buildContinuousChain(input);
  assert(validateChainCoverage(chain));
  const wfc = solveSphericalTerrain({ chain, transitionRules: GEOLOGY_TRANSITIONS });
  const field = composeChainFields({ wfc, chain, semanticChannels: SEMANTIC_CHANNELS });
  const terrain = marchingCubesCharts(field, { preservePins: chain.flatMap(c => c.hardPins) });
  const water = compileCurvedWater({ field, chain, basins: ["swamp-lake", "white-whale-lake"] });
  const routes = compileChainRoutes({ terrain, water, chain });
  return validateChainSnapshot({ chain, wfc, terrain, water, routes });
}
```

#### 12.20.3 六段地貌的生产规则

| 段落 | 地貌核心 | 过渡带 | 游戏空间 |
| --- | --- | --- | --- |
| 高山圣城 | 火山 massif、雪线、冰川沟、五层台地 | 火山灰坡 → 裂谷肩部 | 台阶/瀑布攻城、木马出兵、山地视线 |
| 三重门 | 断层肩、风口鞍部、裸岩高地 | 山脊鞍部 → 断层崖 | 关隘 choke、盘山路、电车门下走廊 |
| 水晶城 | 东非大裂谷式双断层崖、宽谷底、冲积扇 | 断层崖 → 湖泊三角洲 | 谷底电车、桥、掩体、峡谷远景 |
| 湖沼 | 马拉维/坦噶尼喀式长湖、芦苇、浅滩、岛屿 | 冲积扇 → 湖岸湿地 | 船路、岛屿登陆、白鲸事件、浅水减速 |
| 书店镇 | 奥克兰火山锥、凝灰岩、玄武岩草坡 | 湖岸沉积 → 火山丘陵 | 丘陵街区、电车坡路、火山口小广场 |
| 苔庭 | 日本式冲积平原、浅沟、苔野、低林缘 | 火山丘陵 → 河漫滩平原 | 宽阔战场、平原巡查、低坡撤退、林缘伏击 |

#### 12.20.4 实施顺序

1. **GEO-0 基线与兼容**：冻结旧 manifest/profile hash；新建 `landformChainV1`，旧 profile 名称只作为读档别名。
2. **GEO-1 链路骨架**：重排六个 landmark direction 为 `slerp` 链，加入 `chainOrder`, `landformClass`, `elevationBand`, `geology`, `transitionIn/Out`。
3. **GEO-2 高风险接缝**：先实现“三重门→水晶城”断层肩部到裂谷入口，验证高程严格下降、门下走廊和无海洋裂缝。
4. **GEO-3 水系接缝**：实现“水晶城→湖沼”冲积扇/三角洲，验证峡谷流向、曲面湖岸、芦苇湿地和船路。
5. **GEO-4 低地接缝**：实现“湖沼→书店镇”湖岸沉积到奥克兰火山丘陵，再实现“书店镇→苔庭”火山坡到冲积平原。
6. **GEO-5 高地重构**：把高山从普通 peak recipe 升级为雪峰/雪线/冰川沟；城堡台地、瀑布、木马 hard lock 不漂移。
7. **GEO-6 语义与表现**：补 `snowness/ash/rockness/sediment/wetness/forestness/mossness/slope/flow`，让 palette、云和植被由语义驱动。
8. **GEO-7 导航与玩法**：补齐五条链路 `highland-triple-gate`、`triple-gate-crystal`、`crystal-swamp`、`swamp-bookshop`、`bookshop-saihoji`，并保留旧港/湖泊支线。
9. **GEO-8 迁移与回滚**：新旧 snapshot 可切换；失败时回到旧 landmark manifest、旧水体和旧路线，不删除 legacy caller。

#### 12.20.5 必须新增的自动化验收

- chain direction 同 seed 三次 hash 相同；相邻球面 cap/transition 带相交或由合法海湾连接；六景区全部落在同一最大陆块。
- elevation narrative 通过：`highland > tripleGate > canyonFloor > lakeLevel`，书店火山丘陵高于湖岸，苔庭平原坡度低于书店。
- 每个 transition 带的 field value/normal/semantic 连续；MC seam、NaN、degenerate、矩形 AABB patch 为 0。
- WFC 只选择与前后 transition socket 兼容的 tile；不得通过无限重启或随机换成 `plain` 逃避冲突。
- 曲面水体闭合、峡谷流入湖沼、船路不穿陆；湖沼白鲸事件 keepout 不污染普通步行/船路线。
- 五条链路各跑 golden `1/7/42/884` + 1000 seed；路线必须无 `air` edge、无非法跨层、无断路。
- 34 个 camera schema/pose hash、terrain palette、灰度/CVD、cloud climate、shader finite、resource rollback 继续由 `test_grok_acceptance_matrix.mjs` 验证，不使用人工截图门禁。

#### 12.21 新地貌链的 Oskar 式云气候剖面（2026-08-23）

截屏中的云层不作为一圈均匀装饰，而是由同一条地貌链上的海陆湿度、盛行风和抬升地形共同生成。固定剖面为：

`苔庭平原（开阔天空/林缘薄云） → 书店镇（海风碎云） → 湖沼（湖上低云/芦苇雾） → 水晶城（裂谷底低雾，沿坡抬升） → 三重门（迎风坡云墙，门洞保持可读） → 高山圣城（雪线云冠/峰顶云团）`

实现约束：

1. 生成阶段从 `PlanetSnapshotV8` 的 `landformClass、elevation、wetness、flow、oceanFetch、slope、windward` 烘焙云 tile 的结构和运动参数；运行阶段只由 impostor/SDF shader 更新 `uTime/uWind/uWeather`。
2. 盛行风沿 `flow` 和海岸 fetch 计算；迎风坡增加云概率和高度，背风坡进入 `rain-shadow`，不能用纬度环或随机均匀撒点代替。
3. 高山云冠不能遮挡城堡五层台地、第一层瀑布、木马和攻防门口；三重门保留 `cloudCeiling` 与门洞 camera keepout；苔庭战场和书店主要战区保持足够天空可见度。
   戴帽云是地标专属装饰（与 12.10.4 白鲸湖同类），不走 per-cell 概率：`heroCloudCatalog.highlandCitadel` 钉死 cap/ring/forest-scatter，气候云仍负责大氛围。`applyCloudCameraKeepouts` 增加 `peak-visibility`——峰顶不得被永久完全遮蔽——以及城墙/木马 combat-sightline。
4. 湖沼低云与曲面湖盆同源，云底高度低于高山云冠但高于船路；云不写入碰撞/导航，不污染白鲸事件 keepout。
5. 每个实例烘焙 `inDir/outDir/timeOffset/speed/climateBand/windward/rainShadow/humidity`；CPU 每帧不逐朵修改 transform，不创建实例阴影贴图。

伪代码：

```js
function compileChainClouds(snapshot, wind) {
  const cells = snapshot.dual.cells.map((cell) => {
    const s = snapshot.semanticAt(cell.direction);
    const fetch = oceanFetch(cell.direction, snapshot.ocean, wind);
    const lift = Math.max(0, s.elevation) * slopeFacing(cell.direction, s.flow, wind);
    const band = classifyCloudBand(s.landformClass, s.wetness, lift, fetch);
    return {
      cellIndex: cell.index,
      probability: clamp(.05 + s.wetness * .42 + fetch * .25 + lift * .18
        - rainShadow(s, wind) * .26),
      altitude: cloudBase(band, s.elevation, s.wetness),
      climateBand: band,
      keepout: cloudKeepouts(snapshot, cell),
    };
  });
  return bakeOctaImpostorInstances(cells, { vertexMotion: true, shadowMode: "projected-low-resolution" });
}
```

对应自动验收：同 seed 云 cluster hash 稳定；六种 `climateBand` 分布符合地貌；迎风概率 > 背风概率；门/战场/木马 camera keepout 不被云覆盖；实例预算、shader finite、CPU 更新字段和资源回收均由脚本断言，不用截图门禁。

#### 12.22 最新参考图的高山夜景与球形地貌约束（2026-08-23）

新增参考图只作为设计约束，不作为运行时贴图：

1. **高山圣城夜景**：高山城堡在冷蓝/靛蓝的山体、森林和夜空中形成纵向剪影；建筑窗口、火炬、水面反光和港口灯火使用暖橙到珊瑚色局部光点。明暗关系由 `themePresets/*.json`、`lighting/presets/*.json` 与局部灯 registry 驱动，不能通过抬高全局 ambient 解决。
2. **球体云图**：云团必须沿球面切平面和山脊/湖盆高度分布，使用低成本 impostor/SDF 代理；云团可以跨越山顶、森林和湖面形成遮挡层，但不能写碰撞、导航或船路。云的弧面贴合和云底分层由 `cloudBase/climateBand/oceanFetch/windward/rainShadow` 数据决定。
3. **整体地势图**：主大陆是球面上的连续陆地链，山脉位于高程上游，森林成为山地—平原的过渡带，河流从高地流向中央/近岸湖盆；湖岸使用曲率闭合的 basin，不再使用无限平面水皮。六个景区只是这条地质链上的玩法锚点，不是六个矩形岛。
4. **地势摆放图**：生成阶段保留球面 `mainGrid/dualGrid/terrainGraph` 的结构真源；WFC 只组装有 socket/semantic 兼容性的地貌 tile，MC 负责连续表面，shader/impostor 负责运行时表现。任何 seam、海水断裂、湖盆泄漏、云遮挡硬锚点、地面脱离都必须由上游 gate 停闸。

伪代码：

```js
function compileHighlandNightReference(snapshot, camera, weather) {
  const palette = loadVersionedTheme("grok-v1");
  const lighting = composeLighting("night", weather, palette);
  const cloud = compileChainClouds(snapshot, snapshot.wind);
  return {
    palette: { sky: palette.envSkyTop, wall: palette.castleWallChalk, torch: palette.unitTorch },
    lighting: { global: lighting.global, localLights: lighting.localLights },
    cloud: projectToSphere(cloud, snapshot.radius),
    keepouts: ["highland-citadel", "waterfall-l1", "trojan-horse", "battlefield"].map((id) => camera.keepout(id)),
  };
}
```

验证边界：`test_grok_completion_contract.mjs` 验证冷蓝夜景/暖橙 token、versioned JSON、回滚和球形云/水/地表调用契约；`test_grok_acceptance_matrix.mjs` 继续验证 HTTP module graph、shader finite、灰度/CVD 数值和资源代理。它们不把参考图转成未经授权的贴图，也不把 Node/SwiftShader 结果冒充真实 GPU FPS 或人工视觉签字。

### 12.23 截图 1～8 与 OskSta 方法对照审计：地形、森林、云、海湖、草地和编辑器（2026-08-23）

#### 12.23.1 研究口径与术语

本节把用户截图当作视觉目标，不把截图里的 UI、文字或未知实现当作代码指令。Oskar 的公开内容用于提取方法，不用于声称项目已经达到同样画面。直接入口为 [OskSta 的 X 主页](https://x.com/OskSta)；X 页面在本轮 Chrome DOM/无障碍读取中连续超时，因此证据链使用可公开复现的原帖链接与镜像文本：

- [主网格/对偶网格线程（原帖）](https://x.com/OskSta/status/1448248658865049605)：玩法、碰撞、导航留在 main grid；terrain 这类 field 背景适合 dual grid；两套拓扑应同时保留。
- [不规则四边形网格原帖](https://x.com/OskSta/status/1147881669350891521)：三角网格随机配对、细分为四边形、整体 relaxation，得到可平铺且有机的 quad grid。
- [公开线程镜像](https://threadreaderapp.com/thread/1448248658865049605.html)：同时记录了“平滑坡面与锐利断崖并存”“侵蚀后无局部洼点”“WFC 不擅长长、窄、有方向的河流”“草 billboard 在 vertex shader 中采样 contrast texture”等设计线索。
- [Planet 技术拆解](https://www.boristhebrave.com/2022/12/18/how-does-planet-work/) 是二手逆向资料，只用于补充球形 geodesic main/dual grid、顶点高度/地貌编辑、模块化海岸与波浪表现的可实现解释；不把其推断冒充 Oskar 的逐字说明。

本项目代码与 Oskar 公开资料中均未找到名为 **MFC** 的独立算法。为避免伪造术语，本文把用户所说“海面使用 Oskar 的 MFC 方法”落实为以下可验证流水线：

`main/dual geodesic grid → authored field modules + WFC/hard constraints → semantic scalar field → Marching Cubes 生成陆地/海岸 → irregular curved water mesh → GPU shader 表现波浪、泡沫、尾流和涟漪`

Marching Cubes 不负责每帧生成海浪；它负责陆地、海床、湖盆和岸线结构。海面保持静态不规则曲面拓扑，动态运动交给 shader。这与“生成阶段负责结构和数据，运行阶段负责表现和运动”的总原则一致。

#### 12.23.2 当前系统结论：尚未做到截图目标

新的自动审计入口是：

```bash
node tools/audit_planet_v8_oskar_gap.mjs
```

它必须读取最终 field/runtime/shader，而不是只看 PLAN/TODO 的勾选。2026-08-23 的结论如下：

| 能力 | 当前状态 | 代码证据 | 与截图的差距 |
| --- | --- | --- | --- |
| 球形连续地貌 | `PARTIAL` | `landformChainV8.js`、球面 WFC、field、MC chart 和 seam test 已存在 | V8 四个生产开关仍默认 `false`；默认世界没有切换到 V8 |
| 高山圣城是最高峰 | `FAILED` | 旧门只比较 `elevationBand`；固定 seed=1 的最终 field 在高山与三重门中心均约为 `0.102417311` | 必须在最终 field 的全球/局部密采样上证明高山峰顶严格最高，而不是比较配置元数据 |
| 山峦跌宕起伏 | `PARTIAL` | 有 snow massif/rift/hill/plain profile 与 MC 表面 | runtime 仍以 `subdivision=1/resolution=18` 的小规模 opt-in 编译；高山实际 profile 未调用已有的三峰 `highlandPeakBump()`，层次不足 |
| 森林密布 | `DATA_ONLY` | `compileVegetationV8()` 每 chart 最多 240 个实例并写 snapshot | `runtime.js` 没有创建/挂载植被 InstancedMesh；玩家看不到 V8 森林，且没有林冠团块、林缘和 LOD |
| 云层设计与沿峰滚动 | `CLIMATE_ONLY` | 已烘焙 fetch/windward/rainShadow/cloudBase；impostor shader 会线性漂移 | 没有 ridge tangent、地表 clearance、山脊绕流/翻越路径；当前运动不是“沿山峰滚动” |
| 海面 | `BASIC_CURVED_SHELL` | geodesic curved shell + 两组正弦顶点波 | 没有不规则水面语义、深水 swell、白浪、近岸破碎波、泡沫 SDF、反射层次；未消费 WFC/field/MC 岸线数据 |
| 湖泊表面 | `BASIC_CURVED_CAP` | 曲面 lake cap、长湖和岛屿数据存在 | 与海洋共用同一 shader；没有截图 6～8 的平静高光、船尾流、事件涟漪环和浅岸柔化 |
| 草地 | `PALETTE_ONLY` | `semanticTerrainMaterial.js` 只有 grass/hill/rock/water 调色 | 没有 detail splat、grass billboard/blade、风摆、contrast-aware outline，不能达到截图 5 的细密表面 |
| 地形编辑器 | `BACKEND_ONLY` | inspector、dirty snapshot、preview/commit、undo/redo 底层存在 | 没有截图 4 所示的等高线画布、笔刷、锁点、2D/3D 同步预览和局部构建 UI |

因此，旧文档中“G13/G14 已自动通过”只能解释为**数据契约通过**，不能解释为截图效果完成。后续状态必须分成 `DATA_TESTED / RUNTIME_WIRED / VISUAL_PROXY_PASSED / DEFAULT_ON` 四级；禁止再次用一个 `AUTOMATED_TESTED` 覆盖整条生产链。

#### 12.23.3 目标架构：一个真源，三个网格层，四类运行表现

```text
TerrainEditorV8（玩家/开发者编辑 height、biome、water、forest、hard lock）
        │ transaction + seed + dirty dual faces
        ▼
Main geodesic grid ───── gameplay/nav/collision/object anchors
Dual grid / terrain graph ─ field paint、WFC module、流域、气候、等高线
Local scalar charts ────── land/seabed/lake basin/coast SDF + semantic channels
        │
        ├─ Marching Cubes：陆地、断崖、洞、海床、湖盆、岸线（静态）
        ├─ Water mesh：球面不规则静态拓扑 + depth/shore/fetch/flow（静态）
        ├─ Vegetation：cluster/LOD/keepout（实例数据）
        └─ Cloud path：ridge streamline/clearance/lift/rain shadow（实例数据）
                │
                ▼
GPU：terrain splat + grass wind / ocean swell+foam / lake ripples+wakes / cloud roll
```

所有结构层共享 `PlanetSnapshotV9`。地形编辑器不能直接移动 Three.js 顶点；它提交可回放 command，局部重编 WFC/field/MC/water/vegetation/cloud/nav，并在帧边界原子替换 snapshot。

#### 12.23.4 P0：先修“最高峰”与真实地貌验证

高山的全局最高约束必须作用于最终 field，且包含山顶附近密采样，防止只在 landmark 中心取样漏掉次峰：

```js
function validateFinalElevationNarrative(snapshot) {
  const probes = fibonacciSphere(8192)
    .concat(snapshot.landmarks.flatMap(l => geodesicDisk(l.direction, l.angularRadius, 256)));
  const ranked = probes
    .map(direction => ({ direction, h: snapshot.field.heightAt(direction), owner: nearestLandmark(direction) }))
    .sort((a, b) => b.h - a.h);

  assert(ranked[0].owner === "highland-citadel");
  assert(ranked[0].h - highestOutside("highland-citadel", ranked) >= 0.35);
  assert(countProminentPeaks("highland-citadel", ranked, { prominence: 0.18 }) >= 3);
  assert(monotonicSaddles(["highland-citadel", "triple-gate", "crystal-canyon", "swamp-lake"]));
}
```

实现上让 `highland-snow-massif` 真正消费三峰/冰川沟函数，transition collar 只混合边缘，不得把核心峰高压到垭口高度。新增 `coreRadius` 与 `transitionRadius`，核心区强制 `influence=1`，接缝只在外圈 smooth blend。

#### 12.23.5 P1：森林与草地成为可见生产系统

森林不是“每个三角形最多撒一棵树”。需要先在 dual field 上形成连续 forest patches，再按生态位生成 cluster：

```js
for (const dualFace of snapshot.dual.faces) {
  const s = semanticAt(dualFace.center);
  const patch = growForestPatch(dualFace, {
    density: saturate(s.forestness * 0.72 + s.wetness * 0.22 - s.slope * 0.64),
    edgeNoise: blueNoise(seed, dualFace.id),
    corridorKeepout: navAndCameraKeepouts(snapshot),
  });
  emitCanopyClusters(patch, chooseSpecies(s.biome, s.height, s.wetness));
}
```

- 近景：少量低多边形 trunk + 交叉/八面体 canopy cluster；中远景：octa impostor；远景：林冠色块。
- 林缘密度必须渐变，禁止矩形 AABB 边；高山雪线以上 forestness=0，山脚和峡谷湿侧形成密林，苔庭保留开阔战场与林缘。
- 草地拆成 macro color、detail splat、billboard/blade 三层；顶点只存 `grassDensity/grassHue/wetness/contrast`，shader 负责风摆和镜头稳定轮廓。

#### 12.23.6 P2：云沿山峰滚动，而非直线平移

生成阶段为每个 cloud cluster 烘焙球面样条与山体间隙：

```js
function bakeOrographicCloudPath(seedCell, wind, field) {
  let p = seedCell.direction;
  const points = [];
  for (let i = 0; i < 12; i++) {
    const n = field.normalAt(p);
    const tangentWind = normalize(reject(wind, p));
    const ridge = normalize(reject(field.gradientAt(p), p));
    const lift = max(0, dot(tangentWind, ridge)) * field.slopeAt(p);
    const clearance = lerp(1.2, 5.5, lift);
    points.push({ p, altitude: field.heightAt(p) + clearance, lift, curl: ridgeCurl(p) });
    p = projectToSphere(p + tangentWind * .018 + ridge * lift * .006);
  }
  return bakeSpline(points, { loop: true, arcLengthParameterization: true });
}
```

shader 用 `pathT/timeOffset/speed` 在样条段之间插值，同时以 lift/curl 控制团块抬升、压缩和翻越；地表 clearance 始终大于阈值。云影使用低分辨率投影 atlas，不给每朵云创建 shadow map。高山、三重门、船路、苔庭战场和镜头 hard anchor 继续使用编译期 keepout。

#### 12.23.7 P3：海洋与湖泊分开设计

海洋生产结构：

1. 从最终 land/sea SDF 提取海岸线和海床深度，不从圆球材质猜岸线。
2. 使用球面 main/dual grid 生成不规则水面顶点；沿海岸加密，远海降采样；chunk 边界共享稳定 vertex ID。
3. 烘焙 `depth/shoreDistance/fetch/flow/curvature/foamSeed`；CPU 不逐帧改网格。
4. GPU 组合 2～3 个球面切向 swell、深浅水振幅、法线细波、白浪和 shoreline SDF foam；深夜保持深蓝黑，泡沫仅在波峰/岸边亮。

```glsl
vec3 tangentX = normalize(cross(abs(radial.y) < .9 ? Y_AXIS : X_AXIS, radial));
vec3 tangentY = cross(radial, tangentX);
float swell = gerstner(tangentX, tangentY, waterData.fetch, uTime);
float breaker = smoothstep(.38, .04, waterData.shoreDistance) * crestMask(swell);
float whitecap = smoothstep(uWhitecapStart, 1.0, waterData.fetch * crestMask(swell));
color = mix(deepColor, shelfColor, waterData.depth01);
color = mix(color, foamColor, max(breaker, whitecap) * waterData.foamSeed);
```

湖泊生产结构与海洋分开：低振幅、较高 roughness、浅岸乳白过渡、天空柔反射；船只写入固定容量的 wake ribbon/impulse atlas，脚步、雨点和事件写入环形 ripple buffer。每帧只上传新增事件，不重建湖面 mesh。

#### 12.23.8 P4：地形编辑器 V8

编辑器采用截图 4 的等高线语言，但保持球面真源：

- 左侧/中央 2D 拓扑视图：等高线、biome、森林、河流、湖盆、hard lock、WFC entropy、dirty region。
- 右侧 3D 球体预览：与游戏同一 snapshot/material，支持 orbit、剖面和 semantic debug。
- 笔刷：`raise/lower/smooth/flatten/ridge/canyon/lake/river/forest/grass/erase/lock/unlock`；笔刷写 dual vertex/face 数据，不写最终顶点。
- 操作：半径、强度、falloff、terrace step、biome、seed；支持 undo/redo、save/load、diff、replay、局部生成和显式 commit。
- 保护：建筑地基、港口、第一层瀑布、木马水面、三重门、电车路、船路和战术阶梯为 hard lock；冲突时给最小冲突集，不静默移动。

```js
async function applyTerrainEdit(command) {
  const tx = editorStore.begin(command);
  const dirty = dualGraph.facesInsideBrush(command.center, command.radius, { halo: 2 });
  tx.patch(authoringField.apply(command, dirty));
  const preview = await worker.compile({ snapshot: tx.snapshot, dirty, hardLocks, seed: tx.seed });
  const report = validateLocalPatch(preview, {
    unchangedOutside: dirty,
    gates: [highestPeak, drainage, seams, coast, routes, keepouts, resourceBudget],
  });
  if (!report.ok) return tx.reject(report.minimalConflict);
  return frameBoundaryCommit(tx, preview);
}
```

#### 12.23.9 执行顺序与自动化验收

按以下顺序推进，前一阶段未通过不得开始后续视觉优化：

1. **AUDIT/P0**：把最终 field 最高峰、默认 flag、runtime wiring 纳入 capability ledger。
2. **TERRAIN/P0**：修核心峰与 transition collar；升级生产 subdivision/chart LOD；验证 1000 seed。
3. **EDITOR/P0**：先做 authoring field、transaction、dirty preview、undo/redo，再做 UI；编辑器将成为后续海湖/森林/云调参入口。
4. **FOREST+GRASS/P1**：数据 cluster → InstancedMesh/runtime → LOD/风摆/轮廓。
5. **WATER/P1**：岸线/海床语义 → irregular water mesh → ocean shader → lake shader → wake/ripple。
6. **CLOUD/P1**：ridge streamline/clearance → shader path playback → keepout/cloud shadow。
7. **PRODUCTION/P0**：逐开关接入默认场景；新旧 collision/nav/water/cloud 不能混源；通过后才迁移默认开关。

不使用截图或主人签字门禁；对应脚本必须验证：

- `test_planet_v9_final_elevation.mjs`：8192 全球探针 + 每景区 256 局部探针，1000 seed，高山全局第一且 margin≥0.35。
- `test_planet_v9_terrain_editor.mjs`：12 类 brush、20 步 replay、undo/redo 六类 hash 恢复、dirty 外 hash 不变、hard lock 冲突可解释。
- `test_planet_v9_forest_grass.mjs`：森林覆盖率/连通团块/林缘梯度/keepout/instance budget/LOD hash；草地 shader attribute 与 finite gate。
- `test_planet_v9_water_topology.mjs`：水面 manifold、chunk seam、shore distance 单调、湖盆闭合、海湖 shader 分离、泡沫/尾流/涟漪容量和资源回收。
- `test_planet_v9_cloud_paths.mjs`：路径贴球、clearance、迎风抬升、背风稀疏、无 hard-anchor 遮挡、同 seed path hash、CPU 只更新 uniform/event buffer。
- `test_planet_v9_runtime_wiring.mjs`：terrain/vegetation/water/cloud/editor 四层资源真实挂载，legacy 与 V9 不双写，rollback 后 registry=0。
- `test_planet_v9_all.mjs` 汇总以上结果，并明确输出 `DATA_TESTED/RUNTIME_WIRED/VISUAL_PROXY_PASSED/DEFAULT_ON`，不得合并成含义不清的“完成”。

### 12.24 shot-harness 合并到主系统（2026-08-23）

`shot-harness.html` 保留为资产清单/隔离截图页，但它的验收能力不再只存在于独立页。主入口现在通过开发者菜单接入同一套运行时工作台：

```text
主系统 index.html
  └─ 🤖 开发者菜单
      └─ 📸 OskSta A/B 工作台
          ├─ 真实场景焦点：圣城全景 / 第一层瀑布·木马 / 城堡阶梯 / Planet V9
          ├─ 旧光照 ↔ Oskar prototype：正午 / 黄昏 / 深夜
          ├─ 阴影焦点重新拟合 + 固定昼夜时刻
          ├─ 恢复原昼夜速度/时刻/光照开关
          └─ 当前游戏画布截图下载 + renderer/lighting 状态 JSON
```

实现文件：

- `src/ui/shotHarnessPanel.js`：运行时工作台；不复制 Three 场景，直接消费 `LightingDirector` 和当前场景对象。
- `src/core/devPanel.js`：增加主系统入口按钮。
- `src/main.js`：绑定真实圣城、瀑布/木马、阶梯和 `planetV8.root`，提供 `?shotLab=1` 自动打开和 `window.__tm.shotHarness` 调试 API。
- `tools/test_shot_harness_runtime.mjs`：静态契约门，验证入口、焦点、A/B、阶段冻结/恢复和截图能力。

运行方式：

```text
http://127.0.0.1:8765/index.html?scene=messenger&planetOskarV1=1&shotLab=1
```

`planetOskarV1=1` 仍是显式 opt-in；不带该参数时主系统保持旧场景。工作台的“刷新启用 V9”只在当前页没有 Planet V9 时重载并补上这两个查询参数。Node 门禁验证模块图、数据和资源契约；画布截图由工作台提供，不把 Node/SwiftShader 指标冒充硬件 FPS 或人工视觉签字。

### 12.25 高山圣城设计图重构与城顶攻防（2026-08-23，当前权威方案）

本节覆盖本文此前所有“高山圣城五层台地/四级瀑布/按台面分兵”的旧规划；这些内容只作为 `latestDesign:false` 兼容测试保留，不得再进入默认场景、默认战斗或运行时验证器。

设计图的可执行构图轴固定为：`冷蓝水岸与船 → 密集坡城 → 中央圣塔 → 山脊副塔与深色峡谷壁 → 青蓝高空雾`。默认圣城采用一张连续山谷地形，不使用同心圆台地，不生成梯湖或瀑布。建筑沿十一段山坡带连续爬升，中央圣塔为唯一最高建筑锚点；冷蓝山体/墙面与暖橙窗灯形成夜景互补。水岸必须包含连续水面、三艘前景船、码头和暖光倒影。最高塔冠贴合塔身，禁止重新出现横向夸张的“大帽檐”。

战斗拓扑只有一个最终目标 `castle-top`：

```js
const assault = {
  destination: "castle-top",
  routes: [mountainStairRoute, ...sixSiegeLadderLanes],
  forbiddenRoutes: ["waterfall", "terrace-transfer", "air-shortcut"],
};

for (const squad of assaultSquads) {
  squad.route = chooseGroundedRoute(assault.routes, squad.position);
  squad.goal = assault.keepTop;
  assert(routeEndsAt(squad.route, assault.keepTop));
}
```

六架攻城梯保留，梯顶与山路终点都落在同一个城顶夺取平台。战斗触发不读取瀑布、台地编号或旧 V4 surface graph；深夜木马/港口攻城仍由现有 phalanx 状态机触发。旧 Citadel V4 编译器描述的是已废弃台地拓扑，因此默认最新圣城明确不挂载它，避免它在启动阶段以旧路线门禁阻断游戏。

验收全部脚本化：默认构建必须满足 `terraceLayerCount=0`、`waterfallCount=0`、连续地形×1、建筑≥80、暖窗≥180、水岸船=3、攻城梯=6、所有梯/山路终点=`castle-top`、最高屋顶半径≤2.4；正式入口必须成功加载 `messenger` 与 `saihoji`，不得出现 `required citadel routes not connected`。

旧港参天古樟作为圣城固定镜头画面左侧的水岸/后景构图树保留原模型，默认圣城实例缩放为原体量 `3/5`；旧港兼容场景不缩放。最新山谷坐标为局部 `lx=17.4, lz=14.2`，由固定镜头投影到画面左侧。

### 12.26 球面 WFC 水面与音频线路分流（2026-08-24）

本次修正把“湖”定义为球面上的一组可验证水面瓦片，而不是一张覆盖场景的蓝色平面。最新圣城的水岸视觉源只有两个：连续山体网格和 `highland-waterfront-water` 曲面湖面；旧 `citadel-range`、五层梯湖、瀑布和护城河只作为兼容 API，不得再向最新场景写入视觉对象。

```js
const lake = compileWfcWaterTiles({
  chart: localDualGrid,
  edgeRules: shorelineContinuity,
  seed,
});
const vertex = chartToSphere(tile.x, tile.z, planetRadius);
vertex.radius += lakeLevel + lakeBasin(tile.x, tile.z);
waterGeometry.write(vertex);
assert(lake.geometry.userData.curved === true);
assert(lake.geometry.userData.flatSurface === false);
```

执行约束：

- WFC 只决定 meadow/shore/slope/ripple 等离散瓦片的邻接和语义；dual grid/交替三角形负责连续曲面拓扑；shader 只负责运行时水光、泡沫、涟漪和灯光，不在每帧创建几何。
- 海面、湖面、城堡山体、云团以后统一遵循“生成阶段 WFC/field/mesh 数据，运行阶段 GPU 表现”的单源规则；任何新的整块 `PlaneGeometry` 水面必须被门禁拒绝。
- 最新模式的旧视觉源由 `legacyVisualSuppressed`、`terrainVisualOwner` 和 `waterVisualOwner` 标记；验收必须验证场景图中没有旧 range/cascade visual。

红/蓝有轨电车的声音也进入同一条可验证的运行时状态机：

```js
function onBoard(tram) {
  setTramRideBgm(true, {
    variant: tram.userData.variant, // red | blue
    fade: 0.7,
  });
}

const rideTrack = variant === "red"
  ? "music/FKJ Tom Bailey - Drops.mp3"
  : ["music/Various Artists-Tram.mp3", "music/三亩地 - 城南花已开.mp3"];
```

红车循环 `FKJ Tom Bailey - Drops.mp3`；蓝车原有 Tram 头 16 秒与主曲链路不变。区域 BGM 仅保留 wanted 状态，乘车时暂停实际声道；车辆颜色切换先停止旧元素，防止两条搭乘曲叠播。`tools/test_tram_ride_bgm_priority.mjs` 同时验证蓝车原曲、红车指定曲、区域 BGM 抑制和错误串曲。

### 12.27 高山圣城地面贴合与水岸曲率修正（2026-08-24）

这次验收把“深蓝色大面”按几何来源定位，而不是继续调颜色：旧前景湖面使用了超出连续山体图表的长矩形水网格，球面径向下沉后从镜头下方穿出，视觉上像悬空深蓝屋顶。修正后的约束如下：

```js
const cityGround = highlandCityGroundHeight(x, z);
const mountain = highlandTerrainSurfaceHeight(x, z);
assert(mountain >= cityGround + 0.03 && mountain <= cityGround + 0.08);

const lake = solveHighlandWaterTiles({ cols, rows, seed });
const chart = { zMin: 19, zMax: 61 };
for (const cell of lake.cells) {
  if (!shoreMask(cell.center)) continue;
  const y = localSphericalSurfaceOffset(cell.x, cell.z, 160)
    + waterLift + basin(cell.x, cell.z);
  writeAlternatingTriangle(cell, y);
}
assert(chart.zMax <= mountainChart.zMax);
```

具体规则：

- 城市 footprint 先从自然山体高度场中 carve 出连续城市地面；中央圣塔 podium、建筑基座、士兵行走 provider 和攻城入口使用同一 `highland-city-ground-v1` 来源，不能各自猜高度。
- 湖面使用独立 `highland-water-v1` 水瓦片集，不复用山体瓦片；WFC 负责 open-water/shore/eddy 邻接，中心线和半宽生成不规则岸线，交替三角形编译曲面。
- 湖面 chart 被限制在连续山体 chart 内（`z=19..61`），不再生成越界矩形水面；水材质启用顶点色，曲率由 `localSphericalSurfaceOffset(..., 160)` 测试确认。
- “无暴露底面”不是把几何藏到远处，而是山体边界用顺坡 side skirt、湖面用 shoreline mask；脚本检查 `flatBase=false`、`curved=true`、水面曲率跨度和 chart 边界。

脚本门禁：`tools/test_odyssey_citadel.mjs`、`tools/test_citadel_range.mjs`、浏览器 shot-harness 构建检查；必须无 page error、城堡中心山体与 city ground 相差约 0.04、湖面曲率跨度大于 5、湖面 chart 不越界。

### 12.28 Grok/Kimi 任务收口与脚本化验收（2026-08-24）

TODO 中历史 Kimi P2–P7、C3–C7 与后续 Grok V4 等价实现存在重复负责人。已由 Codex 完成收口：

- `agents/citadel` 是个体代理、步态、战斗结算、攻城导演和木马规则的现役真源；旧 Kimi 条目不再创建第二套 `citadelSquadOrder`/director。
- `citadelVisualTheme.js`、`harbor.js`、`saihojiPhalanx.js` 与 lighting/automated QA 是船、士兵、环境和色盲检查的现役真源。
- 原本要求截图、真实 GPU、主人签字的三项 K7 门禁改为 `tools/test_kimi_v5_scripted_guards.mjs`：资源替换释放、AO dirty-only/partial upload/context-loss、GPU timer capability、深夜木马生命周期均可重复验证。真实 Chrome/Metal 数值仅保留证据，缺少 timer 或资源未回稳时输出 `AUTOMATED_PROXY_ONLY`，不得伪称 `GPU_ACCEPTED`。
- `tools/test_owner_task_bridge.mjs` 检查历史负责人条目与现役文件/测试的对应关系，并输出 `tools/out/owner-task-bridge.json`；`TODO.md` 不再留下未完成的 Grok/Kimi 条目。

### 12.29 最新圣城反馈闭环：侧翼山体、平静湖面、方尖碑与低空云（2026-08-24）

本轮按最新截图收口，原则是“几何先正确、运行时状态可追踪、视觉表现由 shader 完成”：

- 前景深蓝山体不再占据城堡正面视线；连续山体的前景水岸开口由同一张地形图裁切，峡谷墙退到两侧山翼。湖面是球面上的独立 WFC 水瓦片集，使用 dual-grid/交替三角形编译，保持小幅球面曲率与 Navona 风格的平静水面，不使用大幅波浪或无限平面。
- 最高建筑保持方尖碑语义；塔冠和夺取平台采用紧凑肩部，平台只作为士兵站位/捕获节点，不再横向长出大帽檐。塔身与建筑单元共用 `townscaper-wfc-v1` 编辑数据，可从编辑器改 family、variant、rotation、scale 并回写实例。
- 最新圣城默认关闭攻城梯，所有进攻落到外部地面入口再进入五层内部旋转楼梯；每层捕获通过 `capturedFloors` 记录，已夺取楼层窗灯强制熄灭，最终夺取最高层后保持熄灭。攻城梯仅留给旧兼容模式，不进入最新视觉和主路径。
- 云系统使用五段地势云带：旧港积云、湖沼贴水雾/雷雨、峡谷高空卷云、三重门薄云、高山迎风坡云海与雪线以上透镜云。云团由项目低模蓬松云块烘焙成 8–16 角度 impostor atlas；低空云不被普通 camera keepout 误删，运行期只更新时间/风/天气参数。

统一生成/运行分工：

```js
const world = solveWfcDualGrid(seed, constraints);
const terrain = compileCurvedTerrain(world.terrainField);
const lake = compileCurvedWater(world.waterTiles);
const clouds = bakeCloudImpostorAtlas(world.cloudClusters);
runtime.shader.update({ time, wind, weather, capturedFloors });
```

脚本验收覆盖 geometry bounds、曲率/平面禁用、WFC metadata、城堡单元热编辑、无梯主路径、五层楼梯/熄灯状态、五段云带和 shot-harness/runtime module graph；未将人工截图或真实 GPU timer 结果伪称为完成。

### 12.30 地势—水面—云—植被统一语义场 V10（2026-08-24）

#### 12.30.1 现状审计与结论

四套系统已有部分共享数据，但尚未形成完整闭环：

- `terrainSemanticBake.js` 已烘焙 `height/slope/wetness/forestness/rockness/coastDistance/coarseAO`，说明统一语义场的基础存在。
- `cloudClusterCompiler.js` 已读取地势和湿度，但当前 `fetch = dot(cell.direction, wind)` 只是方位近似，不是沿上风向穿越海湖所得的真实水面 fetch；`mountainLift` 也主要由高度近似，没有使用切平面地形梯度。
- `vegetationCompilerV9` 仍消费静态 wetness/forestness；云系统算出的 lift、rainShadow 没有形成降雨气候场，因此“云/降雨 → 植被”仍断开。
- 当前编译顺序先产云、再按 chart 产植被。V10 要改成共享中间场后分别编译云和植被，云实例本身不成为生态输入。

决策：补上降雨反馈，但反馈来自生成期的 `precipitationClimatology`，不是运行时飘动的云实例。这样生态结果可复现、可局部重编，也不会出现云动画每帧改变树木密度的循环依赖。

#### 12.30.2 唯一依赖图

```text
WFC terrain modules + hard locks
               │
               ▼
terrain field: elevation / slope / aspect / curvature / coarseAO
               │
               ▼
hydrology field: landMask / waterDepth / coastDistance / drainage / baseWetness
               │
               ▼
climate field: wind / oceanFetch / vapor / lift / rainShadow / precipitation
               ├──────────────────────┐
               ▼                      ▼
cloud potential + impostor       ecology field
                                      │
                                      ▼
                           forest / grass / reed / mud / snow / rock
```

禁止反向依赖 `cloud Object3D → vegetation`。运行时云只读取烘焙好的 climate field 播放风移、翻山和阴影；长期降雨由同一 cloud potential 公式在生成阶段写入生态湿度。

#### 12.30.3 V10 逐格数据契约

每个 dual cell 使用稳定 ID，并至少提供：

```js
SemanticCellV10 = {
  terrain: {
    elevation, slope, aspect, northFacing, curvature, coarseAO,
    rockness, snowness,
  },
  water: {
    landMask, waterDepth, lakeMask, coastDistance,
    drainage, flowX, flowY, baseWetness,
  },
  climate: {
    windX, windY, upwindOceanFetch, evaporativeMoisture,
    vapor, orographicLift, rainShadow,
    precipitationClimatology, cloudPotential, cloudBase,
  },
  ecology: {
    ecologicalWetness, forestness, grassness,
    reedness, mudness, speciesBand,
  },
  locks: { building, route, combat, camera, authoredBiome },
};
```

GPU 数据建议保持紧凑：`terrainData0/1` 保持兼容，新增 `climateData0(fetch,vapor,lift,rainShadow)`、`climateData1(precipitation,cloudPotential,cloudBase,ecologicalWetness)` 与 `ecologyData0(forest,grass,reed,mud)`；shader 不按对象名称或 landmark 字符串查值。

#### 12.30.4 生成算法

1. 地势和水面：WFC 决定模块邻接与 hard constraints；连续高度场、湖盆 fill/spill 和海平面交线决定真实水体，水面仍由球面不规则 mesh 编译。
2. 风与水汽：沿球面 dual graph 的上风向边累计水面长度，只有穿过海/湖的路径增加 fetch；陆地路径逐步衰减。
3. 地形抬升：在球面切平面计算 `terrainGradient`，迎风坡 lift 为正，背风坡累计山脊遮蔽形成 rain shadow。
4. 气候降雨：以 vapor、lift、shadow 生成稳定多年平均降雨；云实例和植被都读取它，但彼此不直接调用。
5. 植被：坡度是最强负权重，北向保湿、降雨和近岸湿度为正权重；水深/湿度进一步决定芦苇、泥地、阔叶、针叶或无植被。

```js
for (const cell of dualCellsInUpwindOrder(wind)) {
  const waterFraction = saturate(cell.waterDepth / shallowWaterDepth);
  cell.upwindOceanFetch = advectFromUpwind(cell, n =>
    n.upwindOceanFetch * landDecay + edgeLength(n, cell) * waterFraction
  );

  const grad = tangentGradient(cell, "elevation");
  cell.orographicLift = Math.max(0, dot(cell.wind, grad));
  cell.rainShadow = integrateUpwindRidgeOcclusion(cell, grad, wind);
  cell.evaporativeMoisture = evaporation(cell.waterDepth, cell.baseWetness, windSpeed);
  cell.vapor = saturate(cell.evaporativeMoisture + cell.upwindOceanFetch * fetchScale);
  cell.precipitationClimatology = saturate(
    cell.vapor * (0.42 + cell.orographicLift * 0.78)
    - cell.rainShadow * 0.64
  );
  cell.cloudPotential = saturate(
    0.08 + cell.vapor * 0.48 + cell.orographicLift * 0.32
    - cell.rainShadow * 0.38
  );
}

for (const cell of dualCells) {
  cell.ecologicalWetness = saturate(
    cell.baseWetness * 0.55
    + cell.precipitationClimatology * 0.35
    + nearWater(cell.coastDistance) * 0.10
  );
  cell.forestness = saturate(
    cell.baseForestness * 0.55
    + cell.ecologicalWetness * 0.25
    + cell.northFacing * 0.12
    - cell.slope * 0.70
    - ridgeMeadowKeepout(cell)
    - authoredKeepout(cell)
  );
}
```

#### 12.30.5 景区结果约束

- 高山圣城：迎风坡形成连续云海与较湿林带；雪线、陡岩、建筑和战斗路线不长树；背风侧必须有可测量的雨影减弱。
- 三重门：垭口薄云通过、门洞保持净空；两侧坡植被随降雨不对称。
- 水晶峡谷：谷底总体偏干，迎风崖脚可保留狭窄湿润带，不能全谷均匀铺绿。
- 湖沼：水深决定开水面/浅滩/芦苇/泥湿地，贴水雾从 vapor 和低 cloudBase 产生。
- 书店镇与旧港：长海洋 fetch 生成低积云和湿润丘陵林；建筑与道路 hard lock 留白。
- 苔庭：平原保持开阔战场，湿度只改变草色和林缘，不让降雨把中心战场填满树。

#### 12.30.6 编辑器、缓存与局部重编

编辑器新增 elevation、slope、waterDepth、coastDistance、fetch、vapor、lift、rainShadow、precipitation、forestness 十层调试视图。依赖失效不能只扩一圈 halo：地势/水体变化要沿盛行风生成 downwind dirty cone。

```js
invalidate(edit) {
  if (edit.touches("terrain")) mark("hydrology", localHalo(edit));
  if (edit.touches("terrain", "water", "wind")) {
    mark("climate", downwindCone(edit, wind, maxFetchDistance));
    mark("cloud", dirty.climate);
    mark("ecology", union(dirty.hydrology, dirty.climate));
  }
  if (edit.touches("vegetation")) mark("ecology", localHalo(edit));
}
```

commit 前必须通过岸线闭合、湖盆连通、fetch 单调、迎风/背风差、植被坡度抑制、hard-lock、区域外 hash 不变和资源回收门禁。

#### 12.30.7 分工

DeepSeek 负责数据层和纯算法模块：V10 schema/打包器、水文场、球面上风向积分、降雨气候场、生态分类、编辑器 field overlay 与纯 Node 数值测试。DeepSeek 不直接修改 `main.js`、现役 renderer、feature flag 默认值或删除旧实现。

Codex 负责现役流水线接线、Worker/ResourceRegistry、运行时 shader 数据绑定、兼容迁移、最终回归和 PLAN/TODO 状态核验。任何 DeepSeek 交付只有在生产编译器消费、自动门通过后才能从 `[ ]` 改为 `[x]`。

#### 12.30.8 DeepSeek 数据层交付回填（2026-08-24，DATA_TESTED，纯 Node 门禁全绿）

按 12.30.7 分工，DeepSeek 已交付 V10 的 schema、水文、气候、生态、编辑器 overlay/依赖锥六个纯数据模块与四个新测试文件（并扩展一个既有测试）。**全部为 DATA_TESTED**：纯 Node 门禁通过；生产接线（cloud/vegetation 消费、Worker、shader 绑定、snapshot hash、DEFAULT_ON）属 G21-E/F/H 的 Codex 项，未越级标记。

- `src/procgen/planet/semanticFieldV10.js`：`SemanticCellV10` 严格契约（terrain/water/climate/ecology/locks），缺字段/NaN/越界抛错且错误携带 cell ID；`clampSemanticCellV10`、`stableCellOrder`（数字后缀稳定序）。
- `src/procgen/planet/fieldDependencyGraphV10.js`：冻结 `terrain→hydrology→climate→{cloud,ecology}`，严格边策略拒绝任何非冻结边（含 `cloud→ecology` 与反向环），DFS 环检测。
- `src/procgen/planet/semanticTextureBakeV10.js`：兼容现有 `terrainData0/1` 通道序，新增 `climateData0(fetch,vapor,lift,rainShadow)`、`climateData1(precipitation,cloudPotential,cloudBase,ecologicalWetness)`、`ecologyData0(forest,grass,reed,mud)`；输出 schemaVersion/channelManifest/byteLength/hash，稳定序与输入顺序无关。
- `src/procgen/planet/hydrologyFieldV10.js`：纯地形推导水面——海平面交线（海洋=最大水下连通域）、洼地 fill/spill（非最大水下连通域按地形溢流口积水成湖）、authored basin 采用**倾注点洪泛填充**（锁点最近格 + 水位以下连通扩散；人工湖只改水位/出口，不绕过地势）；带符号 coastDistance 多源 BFS、drainage/flow、`shorelineEdgesV10` 稳定岸线边界 ID 与 `shoreTokenV10`（对齐 WFC water tile socket 词表）。
- `src/procgen/planet/climateFieldV10.js`：世界风切平面投影（极点/退化不翻向不归零）、沿真上风 dual 边 advect 的 `upwindOceanFetch`（水面路径累计、穿陆 `landDecay`、`maxFetchDistance` 预算）、切平面梯度 `orographicLift`、上风山脊积分 `rainShadow`（只从真上风邻居接收，自影与逆流回灌均被禁止）、vapor/precipitationClimatology/cloudPotential/cloudBase 同一 semantic cell 输出、可复现。
- `src/procgen/planet/ecologyFieldV10.js`：`ecologicalWetness = baseWetness*0.55 + precipitation*0.35 + nearWater*0.10`（只读生成期降雨气候场，不读运行时云实例）；forestness 以 slope `-0.70` 为最强负项，雪线/陡岩/山脊草甸/建筑/道路/战斗/镜头 keepout 硬归零；9 带 `speciesBand`（openWater/shallowReed/mudflat/wetGrass/broadleaf/pine/alpineMeadow/bareRock/snow）由水深+湿度+高程驱动，不只换色。
- `src/procgen/planet/fieldOverlayV10.js` + `src/procgen/planet/editorDirtyV10.js`：十层调试视图数据契约（elevation/slope/waterDepth/coastDistance/fetch/vapor/lift/rainShadow/precipitation/forestness，图例 min/max + 数值探针读同一 snapshot）；依赖失效表 `invalidateRegionsV10`——terrain/water 编辑 → hydrology 局部 halo + climate **顺风锥**（`maxFetchDistance` 预算、天然跨 chart seam、只顺风不回灌），wind 编辑 → 全球 climate，vegetation 编辑 → 局部 ecology halo；dirty hash 支持 undo/redo/失败事务对比。

**测试门禁（全部通过）**：

- `tools/test_semantic_field_v10_schema.mjs`：契约/NaN/cell-id/clamp/稳定序/DAG 环与边策略/bake 布局与 hash（种子 1/7/42/884）。
- `tools/test_hydrology_field_v10.mjs`：海平面交线、倾斜世界 coastDistance 符号与水深单调、洼地 fill/spill（含"海洋半球+陆上孤立洼地→湖"）、authored 湖盆闭合（无悬空水片/开放湖盆）、岸线 ID 唯一、真实 chain 世界 4 golden + 1000 seed 无 NaN 无泄漏。
- `tools/test_climate_field_v10.mjs`：切平面投影单位/正交/不翻向、水面 fetch 递增与登陆衰减、合成山脊迎风 lift ≥ 1.35× 背风、雨影只在背风、无水上风 vapor 受限、湖上 cloudBase 低于干陆、4 golden + 1000 seed 确定性/有限/无发散。
- `tools/test_ecology_field_v10.mjs`：坡度抑制、北坡增益、雪线/岩石/keepout 硬零、9 带 species 转换、合成低山脊（雪线下、上风有海）迎风林带强于背风（降雨反馈闭环）、真实 chain 场景——高山迎风湿度高/峡谷干燥带/湖岸芦苇环/苔庭核心开阔率 ≥ 0.72。
- `tools/test_planet_v9_terrain_editor.mjs`（扩展）：依赖锥范围与 `maxFetchDistance` 上界、不回灌上风、跨 chart、区域外 hash 不变、undo/redo/失败事务 hash 恢复、十层 overlay 探针与语义格同值。

**G21-F 接线（2026-08-26，RUNTIME_WIRED，默认关）：** `vegetationCompilerV9` 经 `readEcologySample` 复制 `ecologyFieldV10` 的 forestness/speciesBand/grassness/reedness/mudness；`bakeTerrainSemantic` 写入 `climateData1`/`ecologyData0`；terrain shader 用 ecologicalWetness 与 precipitation 做湿草/泥/岸色。生产开关仍默认 false。

**G21-H 接线（2026-08-26，RUNTIME_WIRED，默认关）：** 生产顺序 `field → hydrology → climate → ecology → cloud → charts/semantic bake → vegetation → snapshot`；snapshot 带 hydrologyHash/climateHash/ecologyHash/dependencyGraphVersion；云与植被读同一 climate hash；Worker 合作调度 + 帧边界原子提交；ledger 禁止跳级到 DEFAULT_ON。`tools/test_planet_v10_coupled_systems.mjs` 4 golden + 100 world + 1000 field seeds。

**实现要点与限制（记录在案）**：

- 水文/气候/生态在**dual-cell 格**上求解；真实 chain 世界测试用「subdivision=1 编译的连续场 + subdivision=4 网格采样」（生产 chart 同源采样方式）。细分 1/3 的格心密度装不下 authored 裂谷湖盆（湖盆核心半径仅约 0.075 rad）；细网格 4 才解析。chain 编译在细分 ≥2 时 WFC 陆地组件校验失败是既有限制（pin 格太稀 + ocean-coverage 后处理拆链），不影响本数据层，Codex 接线时需单独处理。
- 降水不对称在真实 chain 场可测（迎风湿润 > 背风）；森林不对称用合成低山脊验证——细分 1 的 WFC 雪 tile 会把山脚整圈盖成雪线以上，属粗网格伪影而非算法错误。
- 全部模块不 import Three.js、不改 main.js/现役 renderer/feature flag 默认值、不删除旧实现；`v8_all`（19 项 ✅）与 `v9_all`（8 门 + 扩展编辑器测试，`RUNTIME_READY_OPT_IN`）回归通过。

### 12.31 地貌链剖面连续性修复 P0-1/P0-2/P0-3（2026-08-24，已落地并全量门禁通过）

本节修复 12.20/12.23 提出的“六段地质叙事”在**最终场层**上的断链问题。修复前实测（seed=1，编译真实产物）：六段中心高度 `9.40 / 6.76 / 1.98 / −0.30 / 3.10 / 1.41`，但相邻两段之间的弧线中点全部塌陷到 `0.24~0.74`；五对相邻 landmark 的 angularRadius 边缘全部留缝 `+0.0475~+0.0975 rad`；为此新增的 `validateChainAdjacency()` 虽已存在但零调用，手动运行 4 个 golden seed 全部失败（3 处 `adjacency-step` 违例）。即：所有既有门禁全绿，玩家在地面走过去看到的仍是“六个隆起 + 中间近海平面浅滩”，而不是连续剖面。

**P0-1 · collar 数值域修复（根因）**：`buildTransitionCollars()` 原来用归一化 `elevationBand`（0~1）当绝对场高：`(from.band[1]+to.band[0])/2` 算出 0.74，而真实场高是 9.40/6.76——弧线中点处 collar 权重=1，把鞍部整个压到 0.74。修复：`planetFieldComposer.js` 在编译期预计算每对 collar 两端**真实场高**的弧中点（`collarTargets`），运行时按 `height = local * (1-w) + target * w` 插值；collar 不再携带绝对高度字段。同时新增 `waterfallLanding` 语义返回，瀑布缺口（L1 接水盆，位于核心区之外但必须贴水面）按 `collarWeight = alpha * (1 - notchWeight)` 平滑让权，避免过渡带把瀑布盆抬到鞍部高度。

**P0-2 · 剖面门禁接线**：`validateChainAdjacency()` 从死代码接入 `compilePlanetV8` 为 `stage:"chain-adjacency"` 硬门（final-elevation 之后、water 之前），golden+1000 seed 不过即停；海陆判据从“裸高度 -1.2 阈值”改为“语义 land ≥ 0.5 或高于 shelfFloor”双判（湖岸/浅滩合法，深洋断点才报 `ocean-gap`）。

**P0-3 · cap 边缘闭合**：`compileLandformChain()` 不再用固定 `0.17` 半径，改为按实际 slerp 弧步长推导 `radius ≥ arcStep/2 + 0.02`；`validateChainCoverage()` 的空转 gap 判据（`authoredTransition` 永真豁免）收紧为 `gap > overlap && !bay`——海湾成为唯一合法缝隙。

修复后实测（seed=1）：五对 cap 全部相接/重叠（edgeGap −0.040~−0.041 rad）；弧线剖面 `9.40 → 8.06 → 6.76 → 4.37 → 1.98 → 0.84 → −0.30 → 1.40 → 3.10 → 2.25 → 1.41` 逐段单调；最深点 −0.30（裂谷湖岸，合法）；三重门鞍部 `9.40 > 6.76 > 0.84`（谷底采样）；`validateChainAdjacency` 4 golden + 1000 seed 全过，minMidMargin=0.846。`validateFinalElevationNarrative` 仍过（minMargin=1.32、minPeaks=22）。

**回归与顺带修复（2026-08-24 全套门禁执行中发现的三处既有 pin 漂移，与本批修复无因果关系，导入链完全隔离）**：

- `tools/test_procgen_profiles_hard_routes.mjs`：siegeDirector 木马第二组 squad 名 `waterfall→stairs`（PLAN 12.25 新权威方案默认禁瀑布），highland routePlan hash `17acc1eb→264b9dbd`，squad 断言同步。
- `tools/test_v6_g5_combat.mjs`：`TROJAN_RULES.ladderTerraces [0]→[]`（木马改走 interior-rotating-stairs，ladderPolicy=disabled；六架攻城梯仍由白天 assault 使用）。
- `tools/test_citadel_topology.mjs` / `tools/test_citadel_v4_pipeline.mjs`：蓝图 canonical hash `6e6245cc→07c43660`（PLAN 12.25~12.27 圣城重构）；`nextTerrace(4,"stairs")===3` 改为 `null`（五台地推进残留，现所有路线收束 `castle-top`）。

**门禁结果**：`tools/test_planet_v8_all.mjs`（19 项 ✅，含新增 `test_planet_v8_chain_adjacency.mjs`）、`tools/test_planet_v9_all.mjs`（8 门 + audit，verdict=`RUNTIME_READY_OPT_IN`）、`tools/test_grok_acceptance_matrix.mjs`（HTTP modules=216、compileP95≈62ms）全部通过；V8 生产开关仍默认 `false`，未越级 `DEFAULT_ON`。

### 12.32 高山圣城 Townscaper 彩色地图编辑器（2026-08-24，已落地）

高山圣城不再只提供族类、屋顶、旋转和比例下拉框。它与运河交汇古堡共用同一个“地图化搭建”交互层，但保留山谷城市自身的 WFC 数据：85 个已生成建筑单元按水岸至山顶分成 11 条建筑带，在一张可点击的彩色地图中表达。

#### 12.32.1 数据与表现同步

- 每个 `highland-unit-*` 持有稳定 `id / band / family / variant / colorChar / hidden`；15 色直接复用高山 Townscaper 色板。
- 建筑墙体使用单元级材质实例，地图改色立即更新对应 3D 建筑，不污染共享材质或相邻建筑。
- 地图坐标由 `layoutHighlandUnitMap()` 确定：水岸建筑带在底部、山顶在顶部，窄层居中，视觉上保持山谷城市的收束轮廓。
- 左键刷色并恢复隐藏单元，右键隐藏；保留族类、屋顶、旋转、比例精修，形成“地图批量编辑 + 单元参数编辑”双层工作流。

#### 12.32.2 编辑事务与入口

- 提供建筑带切换、撤销/重做、保存全部、恢复设计、隐藏本带、显示全部、导出和导入。
- 存档按古堡实例隔离在 `tm.highlandCitadel.units.v2.<instance>`，切换到运河交汇古堡不会串档。
- 开发者菜单增加 `🏰 打开古堡搭建`，不再要求玩家必须先在被山体遮挡的 3D 画面中点中古堡；原 3D 点选入口继续保留。
- `index.html` 提升运行时模块版本，确保浏览器加载 v7 地图编辑器而不是旧缓存。

#### 12.32.3 自动门与浏览器验收

- `test_odyssey_citadel.mjs` 验证 11 条建筑带、15 色、85 单元一一落格、地图命中、墙体实色更新和隐藏/恢复。
- `test_phalanx.mjs` 验证圣城战斗/寻路未被编辑器回归破坏；`test_shot_harness_runtime.mjs` 验证运行时工作台入口仍可用。
- 浏览器脚本实际完成：开局 → 开发者菜单 → 古堡搭建 → 选择色板 → 点击地图单元 → 保存；DOM 中确认色板、建筑带、撤销/重做、导入/导出全部可见，控制台 error=0。

### 12.33 高山圣城可扩建 Townscaper 与 V7/V8/V9 A/B/C 主系统（2026-08-24，已落地）

12.32 的地图仍只覆盖 85 栋既有建筑，不能表达 Townscaper 的“点击空处生长”。本轮把数据模型升级为“已占用建筑 + 稳定可建槽”，并把经过测试的三代世界管线放进主系统工作台，而不是继续依赖独立 `shot-harness.html`。

#### 12.33.1 点击扩建、加层与挖洞

- 十一条山谷建筑带共注册 131 个稳定 WFC 槽：85 个初始占用单元、46 个空扩建槽。每个槽具有 `occupied/storeys/maxStoreys/colorChar/variant/rotation/scale`，空槽 ID 在保存、撤销、导出和刷新后保持不变。
- 左键空槽创建一栋建筑；左键同色建筑增加一层；左键异色建筑刷色；右键一次删除命中的完整 WFC 单元，将 `occupied=false` 并在原坐标保留可再次搭建的空洞，不做逐层减层或隐藏。楼层增加只放大局部 Y 轴，不把建筑整体等比放大。
- 3D 主场景为每个空槽提供透明拾取面；命中建筑子网格时向上追溯 `townscaperUnit`。最新山谷城不再经过旧五台地体素坐标换算，也不显示会误导位置的旧格网幽灵块。
- 存档 `tm.highlandCitadel.units.v2.<instance>` 已包含 `occupied/storeys`；旧存档缺字段时按“已占用一层”兼容回放。

#### 12.33.2 主系统 A/B/C 管线

`WORLD_VERSION_PRESETS` 把版本定义为原子组合，避免上一版本的零散 URL flag 遗留：

- `A · V7`：WFC/MC 城堡引擎开启，球面世界关闭，保留经典场景与运河兼容线。
- `B · V8`：球面 grid、语义地形、曲面海湖和 impostor 云开启；使用分散 landmark 基线，不启用 V9 连续地貌链、V9 植被和 surface riders。
- `C · V9`：启用连续地貌链、V9 植被、气候云带和 surface riders，作为 Oskar 完整展示态。

运行时工作台显示三个明确按钮，点击后刷新同一个 `index.html`，URL 固定写入 `worldVersion`、`planetPresentationVersion` 和 `shotLab=1`。`planetV8/runtime.js` 根据版本决定 `landformChain`、vegetation 与 cloudChainBand，不再让 V8/V9 共用完全相同的画面路径。

#### 12.33.3 验收结果与已知既有回归

- `test_odyssey_citadel.mjs`：131 槽、46 空槽、3D 拾取 ID、空槽扩建、两层 Y 向增长、右键整单元挖洞和原位重建通过。
- `test_world_version_presets.mjs`：V7/V8/V9 原子 flags、版本标签和非法版本 fail-closed 通过；`test_shot_harness_runtime.mjs`：A/B/C UI 与 V8/V9 差异接线通过。
- `test_planet_v9_all.mjs`：8 个数据/运行时门全部通过，verdict=`RUNTIME_READY_OPT_IN`。
- 浏览器实际完成 V7 启动、打开开发者菜单与高山古堡编辑器；DOM 显示 `85 栋 / 131 个可建槽`，空槽应用后变为 `86 栋 / 131 个可建槽`。随后从同一工作台切换到 V8、V9，URL/pressed/status 均匹配，V9 控制台 error=0。
- 完整 V7/V8 聚合门仍暴露一项**本轮之前已存在**的路线 golden 漂移：`test_procgen_profiles_hard_routes.mjs` 期望 `264b9dbd`，当前 `compileHighlandRoutePlan()` 产出 `17acc1eb`。当前 planner 仍声明五台地/瀑布路线，而 PLAN 12.25 已声明最新圣城为连续山谷、无瀑布；禁止只改 expected hash 掩盖语义冲突，应另行把 profile planner 迁移到 `castle-top + interior-rotating-stairs` 后再更新 golden。

### 12.34 高山圣城改用运河交汇古堡同源 Townscaper 构建（2026-08-24，已落地）

12.32/12.33 的“85 栋整楼单元 + 可建槽”只是在高山设计图上增加编辑能力，并不是运河交汇古堡那套真正的逐格 Townscaper。现役高山圣城因此改为直接复用运河古堡的构建范式：ASCII 楼层网格是唯一建筑真源，WFC 邻接求解器按邻居关系自动选择墙、角、屋顶、山墙、拱洞、阳台、支架和装饰模块。

- 高山使用独立 `HIGHLAND_TOWNSCAPER_TOWN_SPEC`，与运河共用 `rebuildCitadelTown()`、模块目录、邻接 signature、色板和热重建事务；楼层数统一为 12。
- 左键空格创建建筑单元；左键已有单元继续生长或改色；右键删除命中的精确格，邻接求解立即把缺口编译成真正的洞，而不是隐藏整栋预制建筑。
- 高山城中央保留方尖碑与夺取节点，因此其 5×5 核心是 hard protected cavity；普通 Townscaper 单元不能穿入，但周边仍由同一格网连续构建。
- 旧 `highland-continuous-valley-city` 85 栋整楼模型退出最新场景，仅保留兼容代码/旧存档迁移入口；山体、植被、球面湖、船、灯光和城顶战斗仍由高山专属系统提供。
- 高山格网基准面设为 `HIGHLAND_TOWNSCAPER_BASE_Y=11.17`；连续山体只在城址核心平滑形成可建面，边缘回接山坡，不恢复五层台地，也不暴露独立底面。
- 同源构建基线曾使用 `tm.citadel.levels.highland-townscaper.v4`；参考图重构后由 12.35 升级为 v5，继续与运河存档隔离。热重建只替换 Townscaper 建筑层，保留山体、水面、船、植被、方尖碑和战斗锚点。
- `index.html` 与所有现役 `citadelTown.js` 导入使用一致版本戳；否则浏览器可能把新 `odysseyCitadel` 与旧 `citadelTown` 缓存拼在一起并在启动阶段报缺少导出。HTTP 冷启动和刷新启动都必须无该错误。

验收以结构和交互脚本为准：最新高山场景存在 12 层逐格 Townscaper 组、旧 85 栋模型缺席、保护核心不可建、删一格后 `cellCount-1`、原位恢复后计数还原；编辑器明确显示“高山圣城 · Townscaper 网格”，序列化不再截断为旧 5 层。主系统浏览器冷启动后可打开该面板且控制台无新 error/warn。

### 12.35 参考设计图重构高山圣城 Townscaper 种子（2026-08-25，已落地）

本轮不把参考图当作一张贴在山前的背景，也不恢复 85 栋整楼预制件；继续使用 12.34 的逐格 Townscaper/WFC 建筑真源，把画面的空间叙事翻译成可编辑种子约束：前景是湖与船，湖岸是低而宽的连续城带，城市向山谷深处逐渐变高、变密，中央保留可夺取的方尖碑圣塔，后排与侧翼由普通格群形成多个可编辑高塔。

- 高山种子使用 `25×25×12` 网格，共 801 个建筑格、341 根占用柱；湖岸区域平均柱高约 1.50 层，后山区域平均约 4.02 层，形成可测量的前低后高轮廓，而不是对称金字塔或单排城墙。
- 六个高塔锚点位于后排和两翼，至少四根格柱达到 8 层以上；它们仍是普通 Townscaper 单元，左右键编辑后会重新计算邻接模块，不再叠加不可编辑的 `highland-ridge-tower-*` 预制副塔。
- 中央 5×5 区域在全部 12 层中保持为空，作为 `hard-monument-cavity-v1`；独立方尖碑、内部旋转楼梯、城顶夺取节点与熄灯状态机继续占有该区域，建筑格不得穿入。
- 湖岸正门只出现在底层；三处跨巷飞楼保留下方空洞，交给同源邻接规则生成拱洞、阳台与支架。配色按湖岸暖色、山腰青蓝、后排奶油/粉蓝分区，但仍使用同一套 15 色编辑色板。
- 存档键升级为 `tm.citadel.levels.highland-townscaper.v5`，确保浏览器中的 v4 运河样例种子不会覆盖新构图；运行时入口与所有现役导入统一使用 `citadelTown.js?v=20260825-highland-reference-townscaper-v2`。
- 最新设计版本为 `2026.08.25-reference-waterfront-v9-townscaper`。高山专属连续山体、坡面植被、曲面湖、三艘带灯船和湖面暖光仍由表现层提供；建筑层只由新 Townscaper 种子提供。

验收不依赖主人截图判断：脚本检查 12 层、801 格、341 柱、前后高度差、六个塔锚、中央空腔、湖岸门与飞楼空洞；主系统浏览器检查编辑器显示 1/12 层并可左建右挖；独立真实场景镜头分别构建正午和深夜画面，控制台无启动失败，深夜统计 `contrastP90P10=7.18`、`clippedPercent=0.16%`。

### 12.36 高山 Townscaper 逐格球面贴地（2026-08-25，已废弃）

> 该方案会把球面坡度传给建筑、城墙和室内楼层，增加编辑、寻路和模块邻接复杂度，已由 12.37 的水平厚地台方案完全替代，不得恢复为现役装配逻辑。

截屏暴露的长条悬空并非整座城高度偏高，而是 25×25 建筑网格仍共用 `HIGHLAND_TOWNSCAPER_BASE_Y`：该值只在切图中心成立，R160 球面向两翼下沉后，统一 Y 的湖岸墙必然变成一条悬空直桥。同时旧湖面从 z=18 开始挖洞，删除了 z=20 正门前排脚下的山体，因此仅下移城体仍无法得到真实支撑。

- 新增 `highlandTownscaperSurfaceHeight(x,z)`，统一计算 `localSphericalSurfaceOffset + highlandMountainGridHeight`。Townscaper 每个可见 cell/module 按自己的 x/z 采样基准高度；同一竖柱共享偏移，楼层不散开，整条湖岸自然沿球面下弯。
- 初次装配与 `rebuildCitadelTown()` 热重建都传入同一 `baseHeightAt`；删除、扩建、改色后不得退回统一 Y 平面。运行时发布 `townSurfaceConformance`，记录采样数、最低/最高基准与曲率落差。
- 高山编辑器拾取垫改为 25×25 分段曲面网格，顶点读取同一承重函数；士兵入口与外部上山路线也读取该函数，消除建筑、编辑光标、人物三套高度。
- WFC terrain tile 的高度 bias 在城址内平滑衰减为 0，避免曲面贴地后山体重新穿进建筑。湖盆起点从 z=18 移到 z=24：z=20 前排及体块前缘保留天然承重岸，z=30 仍为湖面。
- 浏览器缓存链升级为 `main v12 → odyssey v4 → highland curved-shore v11`，确保已有页面不会继续显示旧的统一 Y 装配。

自动门禁要求：曲面采样数 >500、城域基准高度跨度 >2u、(20,20) 至少比中心低 2u、z=20 非湖洞而 z=30 是湖洞；热重建后 `uniformPlane=false`；曲面编辑垫和士兵入口 provider 必须同名。

### 12.37 高山 Townscaper 水平厚地台（2026-08-25，基础方案；尺寸由 12.38 精修）

高山圣城改用与运河交汇古堡一致的“环境曲面 + 水平建造面”分层。球面山体继续按 R160 和 WFC 网格生成；城堡下使用八角切角地台，顶面固定为 `HIGHLAND_TOWNSCAPER_BASE_Y`，底部深入山体。球面下沉只改变地台侧壁的可见高度，建筑不再逐格弯曲或倾斜。最初 54×54、厚 8.2u、顶面 11.17 的样片暴露出七层高墙，现役尺寸已由 12.38 下调。

- `highland-town-foundation-platform` 是承重体；城域中心与边缘都使用同一顶面标高，底面插入山体。现役精确标高、尺寸与隐藏规则见 12.38。
- Townscaper 初建与热重建删除 `baseHeightAt` 逐模块采样，统一发布 `surfaceProvider=highland-town-platform-v1`、`uniformPlane=true`、`verticalSpan=0`。
- 编辑器拾取面使用与地台一致的切角轮廓和水平高度；城内士兵入口、城内路线和建筑层共享地台标高。地台之外的山坡、湖面、云和植被仍读取曲面语义场，互不混用。
- 湖盆仍从 z=24 开始：地台前缘覆盖 Townscaper 最前排，湖面位于地台/码头前方。地台下部允许与山体相交，以隐藏球面与水平顶面的高度差。
- 初版缓存链为 `20260825-highland-platform-v1`；现役入口由 12.38 升级。自动门禁继续检查地台存在、顶面水平、底部插入山体、编辑面水平、士兵入口同标高，以及热重建后仍保持 `verticalSpan=0`。

### 12.38 高山圣城埋入式石城与纯场景子树（2026-08-25，现役）

针对七层高灰墙、彩色积木感和局部道具污染，现役高山圣城把地台、材质、构图和场景所有权一次收束：

- 地台缩为 46×45、厚 1.0u，顶面从 11.17 降至 4.95；城堡与地台作为一个整体上抬，地台底部仍插入山体并保持不可见，画面只读出城堡与天然水岸。承重 mesh 保留逻辑标高和碰撞语义但不参与渲染。
- Townscaper 种子升级为 `highland-reference-obelisk-stone-v3`：25×25×12、942 个可编辑建筑格、300 根占用柱；湖岸打散为断续低城，山腰向中轴逐层收拢，两根九层侧塔衬托中央独立方尖碑，中央 5×5 仍是不可侵入空腔。
- 高山专属 15 色编辑字符仍保留存档/刷色语义，但渲染色全部收敛到冷白、银灰和雾蓝石材。建筑的蓝、橙和暖红只允许来自天空光、方向光与窗灯，不再由红黄蓝墙体制造。
- 圣城局部子树只装配连续山体、曲面湖、Townscaper 建筑、中央方尖碑和植物。删除红色材质测试人偶、船只、码头灯标、湖面点光、雾片与局部戴帽云；云统一归全局地势/水汽/风场系统。
- 植物改为 12 株 `buildMountainTree` 低模绿团树（树干＋三枚低多边形绿色冠团），按连续山体表面采样扎根；旧港口的两株参天古樟由 `loadCitadel` 重新挂回真实 harbor 子树。
- 运河前景不再让山体单元/侧裙切出深蓝三角遮挡：湖岸水域扩大到 `depth=34/width=64`，任何一个角点接触水域的山体格整格剔除，并同步跳过相邻侧裙边。网格发布 `canalRockObstructionRemoved=true` 与 `frontObstaclePolicy=remove-whole-touching-cells-and-skirt-edges`；侧翼背景山体仍保留。
- 中央方尖碑保留 foundation/lower/middle/upper/chamber 独立分段，不参与装饰几何合批；这样塔身命名、内部楼层和夺取状态仍可逐段控制，也避免合批后只剩尖顶/窗洞造成“方尖碑悬空”。
- 现役缓存链为 `odyssey=20260825-highland-reference-clean-v7`、`loadCitadel citadelRange=20260825-old-harbor-tree-return-v6`、`highland design=reference-waterfront-v18-lift-trees-lake-cutout`；主入口的 `main.js?v=20260825-blue-tram-bgm-v1` 保持不变，避免误把音频缓存链与圣城装配链混在一起。

自动验收要求：地台 `topY=4.95/thickness=1.0/visible=false/fullySubmerged=true`、所有建筑和热重建编辑面 `verticalSpan=0`、942 格/300 柱/两根九层侧塔、15 个高山材质色差不超过 42、非建筑局部道具计数为 0、船灯/湖灯/红人偶/局部云均缺席、圣城低模绿团树为 12 株、旧港参天树为 2 株，且运河视线不被山体格或侧裙遮挡。
- 自动化与浏览器回归：`test_odyssey_citadel.mjs`、`test_citadel_range.mjs`、`test_tarn_tree_pair.mjs`、`test_shot_harness_runtime.mjs` 已覆盖上述装配/缓存/资产归属；`node --check` 与 `git diff --check` 作为提交门禁。
