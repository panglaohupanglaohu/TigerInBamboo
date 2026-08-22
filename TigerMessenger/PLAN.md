# 《TigerMessenger》复刻计划 · PLAN

> 子项目目标：在 TigerInBamboo 仓库内复刻网页 3D 游戏《TigerMessenger》，
> 从主页"进入二次元"光点进入。零构建、CDN 引入 Three.js、GitHub Pages 可直接运行。
>
> 分工原则：**Grok 负责"生成"——自包含、可一次性产出的游戏机制代码；
> Kimi 负责"落地"——仓库整合、模块化拆分、验证、风格、部署。**

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

> 状态：**已规划，尚未实施**。本阶段依据 [Bad North 开发访谈](https://medium.com/subpixelfilms-com/a-minimal-brand-of-madness-oskar-st%C3%A5lberg-and-richard-meredith-on-the-development-of-bad-north-514d5cf1a7a1) 制定，但不复制其美术或玩法；只吸收“个体模拟、地形即战术信息、隐藏复杂数值、行为结果清晰可读”的设计方法。
>
> 执行边界：Kimi 第一批只能完成 P0～P1。战术导航图未通过验收前，不得继续往 `saihojiPhalanx.js` 追加攻防条件，也不得开始 P2 以后工作。

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
截图/调试图审查 → 性能对比 → 旧开关回归 → 更新 TODO 证据
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
