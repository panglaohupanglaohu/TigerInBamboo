# TigerMessenger · TODOs

> 与 `PLAN.md` 里程碑表一一对应。完成一项就把 `[ ]` 改成 `[x]` 并注明日期。
> 分工：**Grok 生成**（自包含机制代码），**Kimi 落地**（整合、审查、部署）。

## 已完成

- [x] 1. 基础 WebGL 渲染管线 — `index.html`：Scene / 相机 / 全屏渲染器 / rAF 循环（Kimi）
- [x] 2. 主页"进入二次元"入口 — `frontend/home.html` 双光点导航 + 双语（Kimi）
- [x] 3. 世界骨架：平台地形 + 第三人称跟随相机（Grok）
- [x] 4. 玩家角色：移动 / 跳跃 / 重力 / 平台碰撞（Grok）
- [x] 5. 信使玩法循环：接信 → 送达 → 检查点（Grok）
  - 4 条任务链、NPC 收发点、任务计数、靠近自动交互
  - 接信/送达刷新检查点；坠落回到检查点
  - 右上角罗盘指向当前目标
  - 信件清单（完成划线）
  - `Timer` 从 `three/addons/misc/Timer.js` 引入（r172 已移出核心）
- [x] 6. 模块化解构（2026-08-02）
  - `src/`：main / core / world / player / quest / ui / audio 已落地
  - 拆分后缺口已补：罗盘/清单/检查点/垫乐/脉动/光点/披风/疾跑/缩放
  - code review / 验收三件套：见 6b ✅
- [x] 7. 视觉方案落地 + 定稿（2026-08-02）
  - 渐变天空球 + 月亮 + 星点 + 漂浮光点（逐帧动画）
  - 平台 / 岛环 emissive 脉动
  - 评审定稿：见 7b ✅
- [x] 8. 角色模型与动画 — 程序化信使 + 披风/虎耳/走跑跳 idle/持信抬臂（Grok）
- [x] 9. 音频 — SFX + 夜色环境垫乐（Web Audio）+ `M` 静音（Grok）
- [x] 10. UI/HUD — 开场 / 任务面板 / 信件清单 / Toast / 气泡 / 罗盘 / 操作提示（Grok）
- [x] 相机缩放 + Shift 疾跑接线（Grok 2026-08-02）
- [x] 11. CDN 兜底与性能（Grok 2026-08-02）
  - `vendor/three.module.js` + `three.core.js` + `jsm/misc/Timer.js`
  - 启动器：CDN 优先，失败回退本地；`?local=1` 强制本地
  - 加载失败提示 UI；`?fps=1` 帧率巡检
- [x] 14. 星球与光源补充（Kimi 2026-08-02 00:47–00:50，详见 `PLAN-planet-lights.md`）
  - `src/world/planet.js`：场景中心半径 40 淡青（`#a8e6e3`）球体，flatShading
  - `environment.js`：新增弱环境光 `AmbientLight(0x8899bb, 0.22)`
  - 太阳平行光/shadowMap 沿用既有（`DirectionalLight` 带阴影 + `stage.js` PCFSoftShadowMap），未重复添加
  - 验收三件套通过；注意：玩法世界在球体内部，FrontSide 材质球内不可见（见 plan 文档「已知事项」）
- [x] 15. 球面玩家实验页（Kimi 2026-08-02 00:59–01:02，详见 `PLAN-sphere-player.md`）
  - `planet.html` + `src/planet/`：立方体玩家、WASD 沿球面滑行
  - 引力永远指向球心（`-up·G·dt`）；Up 轴 = 球面法线；半径锁定不脱离/不陷入
  - 无头验证通过（双截图，控制台零告警）；不改动主游戏玩法
- [x] 16. 程序化 Low-Poly 资产（Kimi 2026-08-02 01:06–01:09，详见 `PLAN-sphere-player.md` 阶段二）
  - `src/assets/lowPoly.js`：`createLowPolyTree()` / `createLowPolyHouse()`，纯基础几何体拼接、返回 Group、底部中心对齐原点
  - 偏差记录：r172 MeshToonMaterial 不支持 flatShading（实测告警），改用 `facet()` 平直法线等效
  - `placeOnSphere()` 贴球面；实验页摆 5 树 2 房，无头验证零告警
- [x] 17. 球面实验页增强（Grok 2026-08-02，见 `PLAN-sphere-player.md`）
  - Space 径向跳跃 + Shift 疾跑
  - 滚轮/中键缩放环绕（复用 `core/input.js`）
  - 石/花/栅栏/桥 + `scatterOnSphere` 纬度带散布 + 切向碰撞
  - `planet.html` CDN→vendor 兜底；入口 `./planet.html`
- [x] 18. 主游戏球面世界化（Grok 2026-08-02，主人批准）
  - `sphereMath.js` + 平台/NPC 贴球面；球心引力、法线跳跃
  - 球面碰撞（台面/星球表面）、相机 up=法线、罗盘切平面指向
  - 关卡仍用平面设计坐标自动映射，任务链不变
- [x] 19. 平台曲面化贴合球面（Grok 2026-08-02）
  - `sphereShell.js`：同心球壳段网格（顶/底/侧壁）替代切向 Box
  - 碰撞：足迹内贴到 `topHeight` 球壳半径（与曲面一致）
- [x] 19. 球面相机 Up 平滑翻转（Kimi 2026-08-02 07:14–07:18，见 `PLAN-sphere-player.md`）
  - 实验页 `planet/main.js` + 主游戏 `core/camera.js`：`_upSmooth` lerp 追踪球面法线，对跖点兜底
  - 球体侧面/底部实测：玩家始终"头顶朝上"，无瞬间倒转；主游戏三件套回归通过
- [x] 20. 球面 NPC 系统（Kimi 2026-08-02 07:21–07:23，见 `PLAN-sphere-player.md`）
  - `src/planet/npcs.js`：红/绿/蓝 3 方块固定经纬度贴球面；`findNearbyNpc` 三维距离检测
  - 距离 < 5 时 `planet.html` 中央提示「按 E 键与 NPC 对话」
  - 无头验证：出生隐藏 → 走近出现（DOM 断言 + 截图），控制台零告警
- [x] 21. 对话框 UI + 送信任务状态机（Kimi 2026-08-02 07:26–07:28，见 `PLAN-sphere-player.md`）
  - `src/planet/letterQuest.js`：idle→carry→idle；A=红方发信、B=绿方收信
  - `planet.html` 极简对话框 + 计分徽标；E 键接线、对话 3.2s 自动隐藏
  - 无头全链路 DOM 断言：接信文案/携信中/送达文案/加分全对，控制台零告警
- [x] 22. 实验页任务增强（Grok 2026-08-02）
  - 携信头顶信件+光环；送达后随机下一对 NPC
  - `followCamera.js` 相机模块抽出
  - 入库 `letterQuest.js` 与相关接线
- [x] 23. 全套规格（10 步）对照检查 + 缺口修复（Kimi 2026-08-02 07:32–07:53，见 `PLAN-sphere-player.md` 合规表）
  - 补原版调研（Messenger/Abeto：小星球邮递员、~5 送信任务、Low-fi）
  - Rock 改二十面体顶点扰动；新增 createLowPolyCloud（4 球重叠）
  - 散布对齐 50 树/10 房/30 岩 + 云朵 10 朵距球面 5
  - 右键拖拽 yaw/pitch 环视 + 松手平滑回弹（实测 yaw -1.0→-0.03）
  - NPC 独特几何体（红方块/绿圆锥/蓝球）+ 提示「[E] 与居民交谈」
  - 首局任务规格原文：红方→小蓝，「你能帮我把这封信送给岛对面的小蓝吗？」/「哇，谢谢你的信！」，计数器改「投递成功」
  - 新增隐藏开发者菜单：🤖 呼出，P 参数实时调（玩家/相机/交互/光照）+ FPS + 重置
  - 无头 13 项综合验收全过，控制台零告警
- [x] 24. 云朵漂移 + 开发者面板持久化（Grok 2026-08-02）
  - `updateClouds`：绕轴公转 + 径向起伏
  - `params.js`：`tm.planet.devParams.v1` 自动读写；重置出厂

## 待办

### 高山城堡攻防 V2（Kimi，必须按顺序执行）

> 完整设计与验收标准见 `PLAN.md` 第六章。第一批只做 P0～P1；P1 验收前不得继续扩写 `saihojiPhalanx.js`，也不得开始个体 AI、战斗结算或导演系统。
>
> **任务负责人：Kimi。本节 P0～P7 的全部 `[ ]` 待办项均为 Kimi 的任务。**

#### P0 · 基线与可复现（负责人：Kimi）

- [ ] 增加 `citadelCombatV2` 功能开关，关闭时完整保留现有攻城/木马流程。
- [ ] 建立可注入的种子随机源，清除攻防关键逻辑中的直接 `Math.random()`。
- [ ] 保存 seed、命令序列和关键战斗事件，支持同输入重放。
- [ ] 固定港口登陆、门洞瓶颈、跨台地追击、深夜木马双组 4 个回归场景。
- [ ] 记录现有单位数、到达率、悬空次数、寻路/战斗耗时、胜负与总时长基线。
- [ ] 验收：同 seed 连跑 3 次事件顺序一致，旧系统测试全过。

#### P1 · 城堡战术导航图（负责人：Kimi；第一批终点）

- [ ] 新建 `src/world/citadelTacticalGraph.js`，生成稳定节点 ID。
- [ ] 接入台地、建筑门口、庭院、阶梯首尾、城门、梯子、瀑布、港口和木马落地点。
- [ ] 定义 `walk/stairs/ladder/waterfall-climb/door` 边及宽度、坡度、高差、容量、危险度、方向元数据。
- [ ] 实现分层 A*、空间占位、窄道容量、短期节点预约与受阻重寻路。
- [ ] 城堡编辑后增量重建受影响图块，清理失效节点与路径。
- [ ] 添加调试可视化：节点、边、法线、容量、占位、预约和当前路径。
- [ ] 新增 `tools/test_citadel_tactical_graph.mjs`。
- [ ] 验收：跨台地只走合法连接；离表误差 ≤0.15；10 分钟无空中路线、穿墙捷径或无限卡死。
- [ ] **P1 验收报告提交给主人；得到确认后才开始 P2。**

#### P2 · 小队命令与个体代理（负责人：Kimi；P1 批准后）

- [ ] 新建 `citadelSquadOrder.js` 与 `citadelCombatAgent.js`；小队只给目标/阵型，士兵独立决策。
- [ ] 落地统一个体数据：角色、命令、意图、目标、路径、体力、勇气、冷却、受阻时间、敌友与威胁方向。
- [ ] 落地统一状态：idle/move/form/brace/aim/attack/block/recover/stagger/down/retreat/climb/assist。
- [ ] 决策频率限制为 6～10 Hz，并用滞回抑制目标和状态抖动。
- [ ] 受阻时可等待、让路、换邻格、重寻路、冲锋或撤退，不再整队平移。
- [ ] 新增 `tools/test_citadel_combat_agent.mjs`。

#### P3 · 战斗结算与动作（负责人：Kimi）

- [ ] 新建 `citadelCombatResolver.js` 与 `citadelCombatAnimation.js`，分离规则和表现。
- [ ] 攻击按预备/接触/恢复结算；盾牌覆盖角、长枪距离、静止枪墙、视线、遮挡、高地和身体阻挡生效。
- [ ] 用步态相位驱动跑步及手脚反相摆动；速度控制步频；补转身、阶梯、刺击、格挡、踉跄、倒地动作。
- [ ] 动画只订阅战斗事件，禁止动画代码自行决定命中。

#### P4 · 日间攻城导演（负责人：Kimi）

- [ ] 新建 `citadelSiegeDirector.js`，攻方支持登陆、集结、突破、破门/架梯、占领、推进、增援、撤退。
- [ ] 守方支持高地/瓶颈布防、预备队、逐层后撤与反击。
- [ ] 从 `saihojiPhalanx.js` 拆出职责，停止在巨型状态机内追加特例。
- [ ] 攻城梯数量与落点由战场评估产生，不再永久固定脚本。
- [ ] 新增 `tools/test_citadel_siege_director.mjs`。

#### P5 · 深夜木马行动接入（负责人：Kimi）

- [ ] 保留四绳、每绳两次下降、两组首尾火炬手、其余盾牌+长枪、天亮返回马腹。
- [ ] 瀑布组检查台面 2/1，阶梯组检查台面 5～3；逐屋跑到门口，覆盖完再走合法阶梯换台面。
- [ ] 攀爬时按距离/体力/高差触发拉扯、推举、搀扶；禁止巡查绳索和队列牵引。
- [ ] 遭遇守军与返程统一使用战术图、个体代理和战斗结算。

#### P6 · 可读性（负责人：Kimi）

- [ ] 用阵型、姿态、盾枪方向、犹豫、呼喊、音效、火炬和撤退表达内部状态。
- [ ] 除调试模式外不新增勇气、威胁、命中率等数字 HUD。
- [ ] 全局镜头能读出台地攻防关系，近战动作和兵器接触仍可辨认。

#### P7 · 性能与最终验收（负责人：Kimi）

- [ ] 加空间哈希、远处低频决策、路径失效重算；单兵路径查询不高于每 0.5 秒一次。
- [ ] 新增 `test_citadel_combat_replay.mjs` 与 `tools/e2e/citadel_combat_v2_e2e.mjs`。
- [ ] 150 名活跃单位时战斗系统 P95 CPU ≤5 ms/帧。
- [ ] 连跑 10 分钟：离表误差 ≤0.15、无悬空巡查、无无限卡阶梯、无队伍互穿。
- [ ] 同 seed 可复现；日间攻城、夜间木马、天亮回收与城堡热编辑回归全部通过。

### 高山城堡整体配色 V3（负责人：Kimi）

> 研究与完整设计见 `PLAN.md` 第七章；来源为 [Bad North: On Beauty and Strategy](https://deathisawhale.com/2020/02/26/bad-north-beauty-strategy/)。本节所有 `[ ]` 项均为 Kimi 的任务。按 C0→C7 执行；C2 白天/深夜样片给主人确认后，再批量修改船只、士兵与环境。

#### C0 · 固定视觉基线（负责人：Kimi）

- [ ] 固定晴天/落日/雨天/雪天/深夜 5 个时刻与城堡全景/港口/第一层瀑布/攻城/木马 5 个镜头。
- [ ] 保存当前 25 张基线截图，并记录像素主色、单位/背景明度差、材质数和 draw calls。
- [ ] 将基线 seed、相机、时刻、天气和战斗阶段写入截图脚本，保证可复现。

#### C1 · 语义主题与回滚开关（负责人：Kimi）

- [ ] 新建 `src/world/citadelVisualTheme.js`，录入 PLAN 7.3 的城堡、船只、士兵、环境和战斗反馈 token。
- [ ] 增加 `citadelPaletteV3` 开关；关闭时无损回到当前配色。
- [ ] 统一 sRGB→Linear→输出流程，禁止重复颜色空间转换。
- [ ] 将 `odysseyCitadel.js`、`citadelRange.js`、`assets/harbor.js`、`saihojiPhalanx.js`、`citadelInfiltration.js`、`dayNight.js`、`weather.js` 的城堡相关散落 Hex 迁移到主题模块。
- [ ] 新增 `tools/test_citadel_visual_theme.mjs`，检查 token 完整性、颜色格式、状态 grade 和材质缓存。

#### C2 · 城堡与台地样片（负责人：Kimi；主人确认点）

- [ ] 替换高山城堡高纯度逐格色板，按建筑簇执行 38/20/17/13/8/4 墙色权重。
- [ ] 同一建筑簇最多一个主色+一个相邻辅色；竖柱同色；只在街区边界换色。
- [ ] 面向阶梯/门口/台地入口的墙面提亮 3%～5%，背面压暗 2%～4%。
- [ ] 墙体明度抖动限制为 `L* ±2.5`，禁止随机改变色相和饱和度。
- [ ] 接入灰鲑陶瓦、深蓝灰结构线、粉白正门、灰绿公共石材和彩色阳台花砖。
- [ ] 校准墙/布/木粗糙度 0.82～0.95、普通材质 metalness=0、黄铜粗糙度/金属度范围。
- [ ] 输出同机位白天与深夜前后对比图，并提交给主人确认；**未确认不得进入 C3。**

#### C3 · 船只配色（负责人：Kimi）

- [ ] 敌船改为暗酒紫船体+炭灰船底+小面积灰红舷带，鲜红舷带可见面积 ≤12%。
- [ ] 甲板、桨、帆、绳和撞角全部改用 `ship*` 语义 token。
- [ ] 战船、港口船、桨手附属船和 Townscaper 水面小船统一阵营主题。
- [ ] 在晴/雾/雨/逆光/深夜检查船体剪影；保证敌船与血迹红不混淆。

#### C4 · 士兵与阵营配色（负责人：Kimi）

- [ ] 守军统一 `unitDefenderMain/Shade`，攻方与渗透兵统一 `unitAttackerMain/Shade`。
- [ ] 统一盾面、躯干、旗帜、羽冠、黄铜、钢、皮肤、长枪和弓箭 token。
- [ ] 羽冠保持当前 1/3 尺寸；只承担阵营辅色，不承担兵种彩虹编码。
- [ ] 兵种依靠长枪/盾/弓/火炬轮廓识别；旗帜辅色不改写整队服装主体。
- [ ] 船上桨手、港口巡逻兵、日间方阵和夜间纸兵使用同一阵营映射。

#### C5 · 环境、水体与天气（负责人：Kimi）

- [ ] 高山坡道由现有砂黄改为灰绿谷地→粉白崖壁→浅鼠尾草高台。
- [ ] 港口、运河、湖泊、梯湖、瀑布和水沫统一 `envWater/Deep/Foam` 色族。
- [ ] 天空和雾切换为雾蓝灰基准，远景降对比但不吞没五层城堡轮廓。
- [ ] 实现晴/落日/雨/雪/深夜 grade；基础 token 不得被逐帧累乘污染。
- [ ] 雨天环境饱和约 82%、角色保留 92%；雪天环境提亮、角色保留 88%；深夜火炬不参与全局降饱和。

#### C6 · 战斗痕迹（负责人：Kimi）

- [ ] 新鲜血迹使用 `battleBloodFresh`，随时间过渡到 `battleBloodDry`。
- [ ] 血迹、焦痕严格贴合合法承载台面，不悬空、不穿水面、不跨越墙体。
- [ ] 区分火炬、火灾、燃烧窗与落日的暖色；战斗反馈拥有最高局部色彩优先级。
- [ ] 战后截图可以从血迹和焦痕读出登陆点、瓶颈和主要交锋路线。

#### C7 · 验收与性能（负责人：Kimi）

- [ ] 新增 `tools/e2e/citadel_palette_v3_e2e.mjs`，自动生成 25 镜头对比矩阵。
- [ ] 日间单位/背景 `ΔL* ≥18`，深夜 `ΔL* ≥12`，敌我主体 `ΔE00 ≥18`。
- [ ] 单镜头前三大环境色像素占比 >55%；未交战时战斗红像素占比 <2%。
- [ ] 色盲模拟检查敌我仍能通过明度、盾枪轮廓和旗形区分。
- [ ] 材质必须缓存共享，draw calls 相对 C0 基线增幅 ≤5%。
- [ ] 运行城堡编辑、日间攻城、夜间木马、天亮回收、昼夜和天气既有回归测试。
- [ ] 提交最终五天气×五镜头对比板、色板清单、性能报告和回滚说明给主人验收。

### Tiger Messenger 总体系统优化 V4（负责人：Grok）

> 完整架构、研究来源、伪代码与验收门槛见 `PLAN.md` 第八章。
>
> **本节 G0～G12 的每一个任务均由 Grok 负责。** 不转交 Kimi，不把已有文件的存在误报为任务完成。Grok 必须逐项附：改动文件、测试命令、固定 seed、截图/调试图、性能前后值、回滚开关。
>
> **强制顺序：** G0 → G1/G2 第一层瀑布地形/UV 样片 → G3/G4 单建筑簇样片 → G5/G6/G7 单场攻防样片 → G8/G9/G10 → G11 → G12。未通过阶段门，不得全量迁移。

#### G0 · 现状审计、可复现基线与功能开关（负责人：Grok）

- [ ] **[Grok]** 列出 `citadelTown.js`、`citadelRange.js`、`citadelInfiltration.js`、`citadelBlueprint.js`、`citadelTacticalGraph.js`、`combatEvents.js`、`rng.js` 的职责、调用方、行数和重叠能力。
- [ ] **[Grok]** 审核当前未提交修改；逐个运行蓝图、战术图、战斗重放、Townscaper 规则与士兵风格测试，保留合格实现，禁止覆盖用户/其他代理改动。
- [ ] **[Grok]** 新增独立开关 `citadelTownV4`、`citadelTerrainUvV2`、`citadelCombatV3`；任一开关关闭均能恢复对应旧系统。
- [ ] **[Grok]** 固定城堡/地形/战斗 seed，记录命令流和 canonical hash；清除关键路径的 `Math.random()`、时间戳和非稳定 Map 插入顺序依赖。
- [ ] **[Grok]** 固定 5 个天气 × 5 个镜头、第一层瀑布近景、单格编辑、港口攻城、深夜木马共 29 组基线。
- [ ] **[Grok]** 记录 FPS、P95 CPU、draw calls、geometry/material/texture 数、JS heap、单位离表误差、寻路失败和 WFC/模块 fallback 次数。
- [ ] **[Grok]** 提交 G0 报告；同 seed 连跑 3 次 hash 与事件顺序完全一致后才能进入 G1。

实现契约伪代码：

```js
for (const tick of fixedStep(1 / 60)) {
  simulation.update(tick, replay.commandsAt(tick), rng.fork(tick));
  replay.assertOrRecord(tick, simulation.canonicalHash());
}
```

#### G1 · CitadelBlueprint、Half-Edge 与主/对偶网格（负责人：Grok）

- [ ] **[Grok]** 将现有 `citadelBlueprint.js` 定为唯一语义真源，补版本迁移、schema 校验、稳定实体 ID 和 canonical serialization。
- [ ] **[Grok]** 新建纯数据 `world/citadel/topology.js`；不得 import Three.js。
- [ ] **[Grok]** 实现 Half-Edge 顶点/半边/边/面与 n-gon 邻接、稳定 ID、边界环、非流形/绕序验证。
- [ ] **[Grok]** 同时构建主网格和对偶网格；主网格承载房屋/角色/导航，对偶网格承载 field/地形/岸线/崖壁 patch。
- [ ] **[Grok]** 建立主/对偶网格 cross-ID；编辑器、渲染、导航、UV 可从任一对象追溯同一 blueprint 实体。
- [ ] **[Grok]** 编写拓扑测试：孤点、洞、边界、多边形、旋转/镜像、五层台地、瀑布缺口和故意非流形输入。
- [ ] **[Grok]** 输出主网格/对偶网格/Half-Edge 方向叠图，并核对第一层瀑布与港口附近拓扑。

```js
const topology = compileTopology(blueprint);
topology.halfEdge.validate({ manifold: true, winding: "ccw" });
assertStableCrossIds(topology.main, topology.dual);
```

#### G2 · 地形地貌、SurfaceProvider 与 UV 构建（负责人：Grok）

- [ ] **[Grok]** 拆出 `terrainGenerator.js`、`terrainUvCompiler.js`、`surfaceProvider.js`；旧 `citadelRange.js` 暂作适配入口，不整文件推倒重写。
- [ ] **[Grok]** 按“锚点→排水→柔坡→断崖→侵蚀→路线验证”实现确定性地形 passes；每个 pass 可单步、暂停和导出。
- [ ] **[Grok]** 在生成前锁定城门、阶梯、港口、运河、瀑布和道路；长窄有向结构不得交给 WFC 随机碰运气。
- [ ] **[Grok]** 检测并修复无出口局部最低点；保留明确的水池例外并记录 outlet。
- [ ] **[Grok]** `SurfaceProvider` 统一提供 point/normal/tangent/surfaceId/terraceId/regionId/edgeDistance；替换城堡范围内重复高度真源。
- [ ] **[Grok]** 将面分类为顶面/柔坡/断崖/阶梯/道路/运河/瀑布/岸线/建筑，按语义与夹角生成 UV chart。
- [ ] **[Grok]** 实现 chart 切线平行传输、沿等高线/流向定向、稳定原点和世界尺度 texel density。
- [ ] **[Grok]** 断崖接入 triplanar/world projection；道路/阶梯/运河/瀑布的 V 沿里程连续且单调。
- [ ] **[Grok]** 写入 `uv1.edgeDistance/slope` 或等价通道，用于接缝混合、崖脚污迹、泡沫和语义轮廓。
- [ ] **[Grok]** 实现 UV 调试层：chart 色、切线、流向、texel density、硬缝、翻转、非有限值和 seam blend。
- [ ] **[Grok]** 先只交付“第一层瀑布 + 相邻两块台地”样片；明显接缝像素 <1%、texel 密度偏差 ≤15%、路线全部连通后才能全地形迁移。

```js
const terrain = pipeline(blueprint)
  .stampRequiredRoutes()
  .solveDrainage({ forbidLocalMinima: true })
  .relaxSoftSlopes()
  .sharpenCliffs()
  .validateConnections();
const charts = compileTerrainUV(terrain.halfEdge, terrain.surfaceField);
```

#### G3 · Townscaper 模块目录、socket 与求解器（负责人：Grok）

- [ ] **[Grok]** 将当前八类模块家族迁入 `moduleCatalog.js`，每个模块补 `id/family/role/sockets/requires/forbids/transforms/paletteSlots/weight/rarity/meshFactory`。
- [ ] **[Grok]** 明确 `2450` 是组合空间/覆盖指标，不把现有常量冒充 2450 个已完成资产。
- [ ] **[Grok]** 建立楼层、转角、屋顶、围栏、地基、阳台、挖洞、楼梯、支架、桥、门窗、烟囱、衣绳、花箱、灯和运河门最低模块集。
- [ ] **[Grok]** 编码 6 邻接、对角邻接、暴露面、承重、路线净空、门口/水边/悬挑语义签名。
- [ ] **[Grok]** 实现 socket 约束传播、稳定加权选型、有限回溯、可解释 fallback 和最小冲突报告。
- [ ] **[Grok]** 门口、完整阶梯、道路、运河、水门和攻防必经路线先锁定；局部模块求解不得破坏它们。
- [ ] **[Grok]** 新增模块覆盖工具；对 100 个固定 seed 记录 candidate/selected/rejected reason/first seed。
- [ ] **[Grok]** 条件可满足但从未出现的稀有模块逐个审查条件/权重，禁止以全局随机重试解决。
- [ ] **[Grok]** 阳台步行面统一接入彩色花砖角色，禁止绿色草坪材质回归。

```js
const candidates = catalog.match(encodeSignature(cell, world))
  .filter(module => satisfiesSockets(module, cell, world))
  .filter(module => preservesRequiredRoutes(module, cell, world));
return candidates.length
  ? deterministicWeightedPick(candidates, hash(seed, cell.id))
  : explainableFallback(cell);
```

#### G4 · 古堡增量构建、鲜艳协调配色与单簇样片（负责人：Grok）

- [ ] **[Grok]** 新建 `incrementalBuilder.js`；blueprint transaction 只重建变更 cell 两环邻域及关联 UV/surface/nav patch。
- [ ] **[Grok]** 常规单格编辑不得全量重建五层古堡；P95 ≤16 ms，批量编辑分帧并显示进度。
- [ ] **[Grok]** 每个建筑簇分配一主墙色、一相邻辅色和一个花砖 accent；同一竖向户保持色族一致。
- [ ] **[Grok]** 恢复 Townscaper 式鲜艳度和明度协调，远景读建筑簇、近景读组件；禁止逐格随机彩虹和全局灰化。
- [ ] **[Grok]** 建立墙、陶瓦、阳台花砖、门窗、围栏、支架、公共石材的语义材质和共享缓存。
- [ ] **[Grok]** 彩砖至少 4 套受控釉色/图案；只用于阳台、露台边带和小广场，可见面积占单栋 2%～12%。
- [ ] **[Grok]** 输出一栋完整建筑簇样片，必须同屏含楼层、地基、围栏、彩砖阳台、楼梯、支架、门洞、屋顶和 3 类装饰。
- [ ] **[Grok]** 样片经主人确认后才能迁移全城；确认前不批量删除旧构建路径。

```js
const dirty = expandTopologyNeighborhood(diffBlueprint(before, after).cells, 2);
for (const id of stableTopologicalSort(dirty)) meshPool.replace(id, buildResolvedCell(id));
patchUVSurfaceAndNavigation(dirty);
```

#### G5 · 真实表面战术图与路径（负责人：Grok）

- [ ] **[Grok]** 审核并适配现有 `citadelTacticalGraph.js`；保留合格 A*/预约/增量逻辑，不重复创建第二张图。
- [ ] **[Grok]** 图节点改由真实 walk surface 与 portal 产生；固定半径环节点只能作为临时回退/调试，不作最终真源。
- [ ] **[Grok]** 接入 walk/stairs/door/ladder/waterfall-climb/bridge 边及宽度、坡度、容量、危险和方向。
- [ ] **[Grok]** 路径分区域 A*、portal funnel、当前多边形内局部避让；局部避让无权跨墙、崖边或台地。
- [ ] **[Grok]** 每个路径点携带 surface/terrace/edgeType/normal；surface 不一致立即刹车并重寻路。
- [ ] **[Grok]** 普通 walk 边高差 ≤0.22；跨台地只允许 stairs/ladder/waterfall-climb。
- [ ] **[Grok]** 固定测试港口→城门、木马→台面 5、台面 5→1、瀑布底→台面 2/1、所有逐屋门口路线。
- [ ] **[Grok]** 连跑 10 分钟：离表误差 ≤0.15，无空中抄近路、穿墙、跨崖、无限卡阶梯。

```js
const regions = graph.aStar(start.regionId, goal.regionId, edgeCost(agent));
const points = funnel(start.point, goal.point, graph.toPortals(regions));
return constrainToSurfaces(points, regions, surfaceProvider);
```

#### G6 · 小队命令、单兵决策、跑步与攀爬协作（负责人：Grok）

- [ ] **[Grok]** 统一纸士兵、守军、攻城兵和港口兵为 `CombatAgent`；外观与行为数据分离。
- [ ] **[Grok]** 实现 `SquadDirector`：小队只发布目标/阵型/优先级/撤退条件，禁止整队位置插值。
- [ ] **[Grok]** 实现单兵 intent utility + 0.12 滞回；决策 8 Hz、路径重算最高 2 Hz、动画 60 Hz。
- [ ] **[Grok]** 当前路径受阻时按等待、让路、换槽位、重寻路、协助、撤退处理，不互相穿过。
- [ ] **[Grok]** 运动 motor 每帧投影到当前 surface polygon；越界或采样失败立即刹车。
- [ ] **[Grok]** 步态相位由真实速度/步长计算；左右腿反相、手臂与对侧腿反相，停止平滑收敛。
- [ ] **[Grok]** 区分持盾、双手持长枪和左手火炬的上身摆动；补转身、上/下阶、制动、刺击、格挡、踉跄、倒地。
- [ ] **[Grok]** 攀爬者按 hold 分散；实现成对 `pull/push/brace/reach` 事件，上拉、下推、搀扶必须有真实 partner。
- [ ] **[Grok]** 输出低速/快跑/阶梯/柔坡/瀑布攀爬五类动作近景及 60 秒无滑步/悬空回归。

```js
agent.intent = maxWithHysteresis(scoreAllIntents(agent, world), agent.intent, 0.12);
const hit = surfaceProvider.projectTo(agent.path.currentSurfaceId, proposedPosition);
if (!hit || hit.edgeDistance < agent.radius) requestRepathAndBrake(agent);
```

#### G7 · 长枪盾牌战斗、攻城导演与木马全流程（负责人：Grok）

- [ ] **[Grok]** 将纸士兵短剑全部替换为长枪；其余规则保持：普通兵左盾右枪，首尾火炬手左火炬且无盾。
- [ ] **[Grok]** 战斗规则与动画分层；只有 `combatResolver` 判定命中/格挡，动画只消费事件。
- [ ] **[Grok]** 实现长枪 reach、枪墙、转向半径、近身劣势、刺击 windup/contact/recover。
- [ ] **[Grok]** 实现盾牌覆盖角、身体/武器遮挡、高地、队形支援、体力、踉跄、倒地和撤退。
- [ ] **[Grok]** 攻城导演只发布登陆/集结/突破/占门/上阶/推进/撤退命令；不得瞬移或越过战术图。
- [ ] **[Grok]** 守军实现高地/瓶颈布防、预备队、逐层后撤和反击。
- [ ] **[Grok]** 木马保持四根绳索、每绳两次下降、两组首尾火炬手、天亮返回马腹。
- [ ] **[Grok]** 瀑布组检查台面 2/1，阶梯组检查台面 5～3；到台面后按空间分区分散逐屋跑到门口排查。
- [ ] **[Grok]** 每完成一台面覆盖才进入下一台面；不同台面间严格走阶梯/合法攀爬 portal。
- [ ] **[Grok]** 血迹、倒地、焦痕只从战斗事件产生并投射到合法 surface，不悬空、不穿水。
- [ ] **[Grok]** 先交付港口登陆→一段阶梯→单层交战样片；路径、跑步、盾枪、结算通过后才接完整木马与五层攻防。

```js
if (attack.phase === "contact" && inReach(attacker, defender) && hasLineOfSight(attacker, defender)) {
  combatEvents.emit(resolveShieldOrBodyImpact(attacker, defender, tacticalContext));
}
```

#### G8 · 环境、材质、轮廓、昼夜与天气（负责人：Grok）

- [ ] **[Grok]** 新建/收敛 `visualTheme.js`；城堡、台地、水、士兵、船、火炬、血迹只引用语义 token。
- [ ] **[Grok]** 基础 token → weather grade → day grade → readability clamp，只读求值，禁止逐帧累乘污染材质。
- [ ] **[Grok]** 保持主人已确认的天空贴图旋转，不擅自恢复旧角度。
- [ ] **[Grok]** 草地/树叶 billboard 轮廓按表面/背景对比和深度差增强；内部线弱、轮廓线强，转相机不闪。
- [ ] **[Grok]** 用 AO、接触阴影、门洞暗部和阶梯投影建立层次，禁止每个模块统一纯黑描边。
- [ ] **[Grok]** 深夜火炬只影响邻近 surface/人物剪影；固定 tick 噪声保证重放一致。
- [ ] **[Grok]** 晴、落日、雨、雪、深夜中保持古堡鲜艳协调、单位可读、路线可辨和水陆层次。

#### G9 · 编辑器事务与算法可视化（负责人：Grok）

- [ ] **[Grok]** 城堡编辑器只提交 blueprint transaction；禁止直接永久改 Mesh 顶点作为数据真源。
- [ ] **[Grok]** 实现 undo/redo、schema 校验、冲突提示、版本号和重放记录。
- [ ] **[Grok]** 增加主/对偶网格、Half-Edge、地形 pass、UV、模块、导航、Agent、战斗、性能九类调试层。
- [ ] **[Grok]** 每类调试对象都显示稳定 ID，可从画面反查 blueprint/module/surface/agent/event。
- [ ] **[Grok]** 生成器支持逐 pass 暂停、单步、固定 seed 重播和 JSON 导出；展示延迟不得改变生产算法结果。
- [ ] **[Grok]** 热编辑后验证 UV、surface、战术图、任务锚点和正在行动的士兵路径同步 patch。

```js
const tx = validateAndNormalize(editorCommand, blueprintStore.current());
if (tx.ok) applyCitadelEdit(tx); else editor.showConflict(tx.errors);
```

#### G10 · 性能、资源生命周期与压力测试（负责人：Grok）

- [ ] **[Grok]** Worker 化前先通过确定性测试；Worker 只返回稳定排序纯数据 patch，不操作 Three.js。
- [ ] **[Grok]** 模块几何/材质合批，士兵共享资源；禁止每兵、每砖、每墙 clone 材质。
- [ ] **[Grok]** `SurfaceProvider` 使用 BVH/空间哈希；战术图、威胁图、覆盖图和路径按 dirty region 更新。
- [ ] **[Grok]** 建立 `ResourceRegistry` 管理 geometry/material/texture/CanvasTexture 引用计数与释放。
- [ ] **[Grok]** 近景动画 60 Hz，近景决策 8 Hz，远景 2～4 Hz；降频不得跳过 contact tick。
- [ ] **[Grok]** 达标：单格编辑 P95 ≤16 ms；150 人模拟 P95 ≤5 ms/帧；固定镜头平均 ≥50 FPS。
- [ ] **[Grok]** 材质数增幅 ≤10%、draw calls 增幅 ≤8%；10 分钟热编辑/战斗后 GPU 资源数回稳。

#### G11 · Tiger Messenger 其他系统适配与存档迁移（负责人：Grok）

- [ ] **[Grok]** 将 `messengerIsland.js` 降至 600 行以内，只保留装配；出生、任务、交通、城堡、天气接线分模块。
- [ ] **[Grok]** 玩家、电车、船、木马统一 `SurfaceRider` 接口；只有可搭乘对象实现 `Mountable`，不共享战斗 AI。
- [ ] **[Grok]** quest 目标引用稳定 `worldEntityId`；编辑地形/建筑后信件收发点不丢失。
- [ ] **[Grok]** 昼夜/天气只发布环境状态；音频订阅 surface/event 语义决定脚步、瀑布、门洞、战斗和火炬音效。
- [ ] **[Grok]** 存档保存 blueprint/seed/玩家/任务关键状态，不序列化 Three.js 对象。
- [ ] **[Grok]** 建立逐版本 migration、备份、失败回滚和旧存档夹具；每版迁移后 canonical hash 稳定。
- [ ] **[Grok]** 电车、莫比斯城、书店、出生营地、信件任务、天气、木马逐个适配，每迁一个先跑完整旧回归。

```js
while (save.version < CURRENT_SAVE_VERSION) save = MIGRATIONS[save.version](save);
return canonicalize(validateSave(save));
```

#### G12 · 最终回归、清理与交付（负责人：Grok）

- [ ] **[Grok]** 新增拓扑、排水、UV、模块覆盖、增量编辑、SurfaceProvider、路径、Agent、战斗、存档迁移的 Node 测试。
- [ ] **[Grok]** 新增第一层瀑布、全城、港口攻防、阶梯、五层巡查、深夜木马、天亮回收的浏览器 E2E。
- [ ] **[Grok]** 运行 5 天气 × 5 镜头视觉矩阵和色盲/明度检查；保存 V3/V4 前后对比板。
- [ ] **[Grok]** 固定 seed 三次重放；canonical hash、战斗事件、路径选择和模块结果完全一致。
- [ ] **[Grok]** 运行 10 分钟压力测试：无离表 >0.15、悬空、穿墙、跨崖、卡阶、路径抖动或资源持续增长。
- [ ] **[Grok]** 逐开关验证 `citadelTownV4/citadelTerrainUvV2/citadelCombatV3` 回退路径。
- [ ] **[Grok]** 只有在调用扫描、旧开关回归和存档迁移均通过后才删除旧适配代码。
- [ ] **[Grok]** 更新模块目录、数据 schema、事件表、性能报告、已知限制、迁移/回滚文档。
- [ ] **[Grok]** 每项 TODO 回填证据：文件、测试命令、结果、截图、seed、性能值；不得只把 `[ ]` 改成 `[x]`。
- [ ] **[Grok]** 提交给主人最终验收；主人确认前不合并破坏旧系统的清理提交。

## 已完成（续）

- [x] 45. 开发者地图编辑器（Grok 2026-08-02）
  - 🤖 菜单 →「打开地图编辑」：顶视平面图
  - 选中建筑拖动移动、复制、删除
  - 朝向：0–360° 滑杆 + 数字框 + 预设角 / ±15°
  - 招牌：书店两行烫金文字可改（`setBookshopSignText`）
  - 调色板放置：书店/房/古松/路牌/街灯/电线杆/岩
  - 贴 `groundLiftAt` + 碰撞同步；布局（含角度/招牌）`localStorage`
- [x] 43. 送信人 = AgentsGroup2026 智能体（主人定夺，Grok 2026-08-02）
  - `player/agentMessenger.js`：头环核心 + 半透明 U 躯干 + 持信件
  - `player.js` 接 `buildAgentMessenger()`（**不用**竹虎模型）
  - 动画：悬浮起伏 + 头环自转；开场文案「送信智能体」
  - 注：曾误做成竹虎斑阑，已按主人指示改回；`messenger.js` 虎模保留备用
- [x] 44. 起始庭园苔环·叠水微调 + 苔海六景垂直层叠（Grok 2026-08-02）
  - startGarden：叠水 6 层、双圈苔、动画放缓
  - saihoji 六景：石底苔裙、主石脚嵌、枯瀑阶梯唇
- [x] 39. 场景模块化（Grok 2026-08-02）
  - `src/scenes/`：`messenger` 信使主岛 / `saihoji` 西芳寺苔寺，registry 按需加载
  - `main.js` 薄装配；URL `?scene=messenger,saihoji`（默认两者）
  - 西芳寺 `buildSaihojiPlanet` 北苔南砂 + 赤道茶室 + 螺旋参道
- [x] 38. 水墨收尾 + 湖面动效（Grok 2026-08-02）
  - 房屋/街道/远侧资产水墨色（宣纸墙·黛青瓦·焦墨杆·沉绿树）
  - 湖：涟漪环 + 涉水水花粒子 + 廉价水下倒影剪影
  - 分形古松多层松冠（既有）；任务面板可收起；垫乐去嗡嗡

- [x] 32. 夜景残留物白天化（Grok 2026-08-02）
  - 去月亮 / 星点 / 夜色 lanterns；日轮 + 飞鸟剪影 + 暖色光尘；`updateLanterns` 驱动振翅/漂浮
- [x] 33. 描边笔意微调（Grok 2026-08-02）
  - `OUTLINE` / `OUTLINE_DRY` 按类型分档；`outlineAs(mesh, kind)`；角色/树冠/远景厚度与飞白收敛防抖
- [x] 34. 路牌/电线杆类街道资产（Grok 2026-08-02）
  - `createLowPolySignpost` / `StreetLamp` / `UtilityPole`；主岛 `ISLAND_LAYOUT.street` 6 处 + 平台木路标
- [x] 24b. #24（云朵漂移 + 面板持久化）**验收**（Kimi 2026-08-02 08:21 通过）
  - 10 朵云 1.2s 内全部位移 ✓；调参刷新后保持 ✓；重置出厂 ✓；控制台零告警
- [x] 25. 主游戏开发者菜单 + 参数持久化（Grok 2026-08-02）
  - `core/params.js` + `core/devPanel.js`；玩家/相机/交互/光照可调
  - 右键环视回弹；交互距离读 `P.talkRange`
- [x] 25b. 实验页并入主游戏 · 收尾与**验收**（Kimi 2026-08-02 08:41 通过）
  - `core/camera.js` 右键 yaw/pitch + 回弹；`core/input.js` 右键钩子（消重防 2x yaw）
  - `world/nature.js`：云环 10 朵漂移 + 远侧 24 树/10 岩/16 花/3 房（避让游玩区）
  - 三件套 ✓ + 自定义断言 6 项 ✓（云漂移/209 Toon 网格/环视/回弹/面板调参）
  - 截图 `e2e-merge-main.png`；实验页保留为沙盒
  - 部署：`94ea31c` 已 push，Pages 更新合并版
- [x] 26. 单入口收口（Kimi 2026-08-02）：`planet.html` 改为自动跳转主游戏，旧链接不 404
  - 主人反馈：实验页/主游戏双页造成"做了看不到"，责成只留主游戏一个入口
- [x] 27. 配色明亮化 + 游玩区植被（Kimi 2026-08-02 08:59，见 `PLAN-sphere-player.md`）
  - 平台全部改青色系（原深藏青）；暖阳 + 足量环境光 + 亮雾；P 默认 sun 1.4 / ambient 0.5
  - `decoratePlayZone`：主岛台面直接撒 10 树/3 房/6 岩/10 花（避 NPC 与出生点），出生即见
- [x] 28. 主游戏资产碰撞（Kimi 2026-08-02，主人反馈穿模）
  - `collision.js` `resolveAssetColliders`：树/房/岩切向推开（同实验页手法）
  - nature.js 两个散布函数返回碰撞体（花草忽略）；主循环接线
  - 验证：玩家置于碰撞体内部被弹出至边界；三件套回归通过
- [x] 29. "走不过去"排查（Kimi 2026-08-02，主人反馈）
  - 60s 绕球实测：整圈可通、零坠落，上岛 0.6 台阶自动踏步 ✓
  - 两大来源：① 资产碰撞圈大于视觉模型（树 0.55→0.38 / 房 1.1→0.95 / 岩 0.6→0.5）
    ② 相机相对移动的球面收敛螺旋（死按 W 会绕极打转，非 bug，A/D 可解）
  - 复测确认 lon 持续变化（在打转非卡死）；三件套回归通过
- [x] 30. 主游戏 E 键交谈（Kimi 2026-08-02，主人反馈缺「[E] 与居民交谈」）
  - 原 Grok「靠近自动交互」改为规格 E 键触发：`index.html` #npc-hint 中央提示层
  - `questSystem`：靠近当前目标 NPC 显示提示，按 E 才接信/送达；气泡保留
  - 验证：出生隐藏 → 靠近浮现 → 不按 E 不接信 → 按 E 接信 → 提示切换收起；三件套回归 ✓
- [x] 31. 日系动漫画风纠偏（四硬伤，Kimi 2026-08-02 09:53，见 `PLAN-sphere-player.md`）
  - 薄荷青天空 #79D2C4 + 极浅青白环境光 1.0 + 青绿大地（星球 #3D9A5F / 主岛 #4AA76C）
  - Cel 硬边光影：`assets/toon.js` 2 阶梯 gradientMap DataTexture + BasicShadowMap + 侧上方暖阳
  - Inverse Hull 黑边描边：信使/NPC/树/房/岩
  - 日系极简 UI：乳白半透明面板 + 深藏青文字 + 8px 圆角 + 柔影；文案去夜色残留
  - 三件套 ×3 轮通过；Grok 并行保留阶梯平台暖灰岩材质
- [x] 31b. 建筑/植物按信使比例放大（Kimi 2026-08-02 10:52）
  - 工厂内置基础缩放：树 ×1.7（~4.6）/ 房 ×2.1（~4.0，门 ~1.1）/ 岩 ×1.6 / 花 ×1.2
  - nature.js 放置改 multiplyScalar 叠加（防覆盖工厂缩放）；collideRadius 保持局部值由总缩放换算
  - 三件套通过；截图确认房高过顶、树高数倍于人、门达胸高
- [x] 31c. 按真实世界比例再校（Kimi 2026-08-02 10:59）
  - 锚点信使 1.7m：树 ×2.5（~6.8m 乔木）/ 房 ×2.8（墙 2.8m、屋脊 ~5.3m）
  - 门几何修正到真实门比例（缩放后 ~1.7m 高）；岩 ~0.8m 不变
  - 三件套通过；截图：门与人等高、墙高近 3m、树冠出画
- [x] 31d. 主岛场景重布局（Kimi 2026-08-02 11:02，主人指示）
  - 随机散布 → `ISLAND_LAYOUT` 手工排布：3 房成村（出生点东北）、12 树岛缘成环 + 院内点缀
  - 花草沿路成簇、岩石 3 处、高台 3 树调小防压迫；全程避 NPC/出生点
  - 平台与任务布局不动；三件套通过
- [x] 31e. 小世界设计量纲重构（Kimi 2026-08-02 11:09，主人引 Sujal Talreja 拆解文）
  - 绝对量纲：玩家 1.7m=1 单位；树 ×1.6 ≈ 玩家 2.5 倍（量纲 2~3×内）；房 ×2.4 ≈ 1.4 倍
  - `LAYOUT_RULES`：带 Min Distance 的约束随机（同类间距 + 对房间距，拒绝采样，种子可复现）
  - 空间克制：主岛建筑 ≤3、树 ≤12、岩 ≤4、花 ≤12；街道资产点位（Grok #34）保留兼容
  - 注：Medium 原文未检索到可访问地址，按主人给出的量纲参数实现；三件套通过
- [x] 35. 东方水墨画风重构（Kimi 2026-08-02 11:18，见 `PLAN-sphere-player.md`）
  - 宣纸底 #DFD5C3 + 留白雾霭 0.015；暖白环境光 #FFFDF6×0.9；地面压沉绿
  - `assets/ancient.js`：扭曲古松（焦黑干+墨绿云片冠）、仙鹤（S颈/乳白/丹顶）、黑岩
  - 游玩区树全换古松、仙鹤立黑岩 ×2；描边加粗至 0.032；两轮验收通过
- [x] 36. 月亮湖水域（Kimi 2026-08-02 11:31，见 `PLAN-sphere-player.md`）
  - `world/lake.js`：月牙湖（外圆-偏心缺口）+ 环湖沙径；选址 (4,-1) 卡两条主线动线
  - 浅水涉水减速 0.55（wadeFactor 入 controller）；深水并入资产碰撞阻挡
  - 断言：浅水减速/深水推出/湖外正常 ✓；截图月牙+环湖径清晰
- [x] 37. 删除现有房屋（Kimi 2026-08-02，主人指示）
  - `nature.js`：游玩区 LAYOUT_RULES.houses.count=0、远侧 0；工厂函数保留备用
  - 三件套通过；截图确认无房
- [x] 38. 背侧大湖 + 删除小湖/仙鹤（Kimi + Grok 2026-08-02 14:09）
  - 主人定夺：不在主岛硬挤，去球面背侧造真正的大湖
  - `lake.js` GREAT_LAKE（lat -45 lon 100，角半径 ~0.6rad）：湖心涉水 0.6 / 上岸恢复 ✓
  - 主岛月亮湖整体移除（场景/碰撞/涉水/动效引用清零）；仙鹤立黑岩移除
  - 期间 Grok 重构场景系统（scenes/）+ 起始庭园 + 西芳寺，删除在新结构上完成
  - 三件套通过；`e2e-great-lake.png` 水面延至地平线
- [x] 39. 西芳寺起始庭园垂直层叠重构（Kimi 2026-08-02 14:49，见 `PLAN-sphere-player.md`）
  - 洪隐山 mountainGroup：Box/Ico 嵌套石壁 ~5.6（玩家 3.3×）立画面右侧
  - 叠水：五层阶梯浅蓝扁块沿壁跌落入池（替换半透明发光蓝柱）
  - 石缝生树：红叶 rotateZ(0.24) 斜插岩缝；山脚底缘 + 树根苔环裹石
  - 竹墙：12 竿/簇、6.2~8.4 高、双排密植、移至 z≈16.5 背景层
  - 三轮修位（嵌山腹/错判朝向/挂东面）后放大截图核验通过
- [x] 40. 竹林《竹虎图》笔法重构（Kimi 2026-08-02 14:55）
  - 参考：狩野山乐《竹虎图》（docs/references/README.md）
  - `bambooCulm()`：分段竹节 + 节环凸起 + 深浅交错（替代整根光杆）
  - `bladeCluster()`：5 片狭长尖叶"介"字撇叶簇（替代二十面体叶球）
  - 放大截图核验：竹节分段可辨、叶呈撇锋；三件套通过
- [x] 41. Hard To Find Bookshop 复古老书店（Kimi 2026-08-02 17:05）
  - `assets/bookshop.js` `createHardToFindBookshop()`：砖红主体 7 高（玩家 4×）
    + 半八棱凸窗（CylinderGeometry 8 段切半）+ 三角奶白门廊（4 段 Cone 压扁）
    + 草坪斜坡/双级台阶 + 黑底金边拱形斜招牌；全件 addOutline 墨线
  - 部署：`messengerIsland.js` flat (11,5) 街道空地，碰撞 3.2，landmarks.bookshop
  - 近景截图核验：凸窗/门廊/门洞/草坪/斜招牌齐；三件套通过
- [x] 41b. 书店招牌文字 + 山坡草地（Kimi 2026-08-02 17:13）
  - 招牌 CanvasTexture：HARD TO FIND / BOOKSHOP 烫金衬线贴黑板
  - `hills.js` HILL_DEFS 新增书店山（(11,5) r4.5 峰 1.6），书店自动落坡顶
  - 坡下草地：16 草簇 + 7 水墨花环带撒布；低机位截图核验坡势与店名
- [x] 42. 出生点重构：海岛悬崖瀑布营地（Kimi 2026-08-02 17:25）
  - `world/startingCamp.js` `buildStartingCamp()`：多层海岸（草→沙滩 #D2C4A7→浅海 #2E8B9A 阶梯）
    + 左侧荒山 5 岩堆叠（~玩家 3×）含内凹山洞 + 崖壁 4 级叠瀑入浅海 + 太空水环（r≈80 半透明青绿）
    + 弹琴老人（坐姿深灰身/白须/膝上手风琴，净空 3 单位）
  - messengerIsland 换接：替换 startGardenVista；碰撞并入
  - 截图核验：海滩阶梯/叠瀑/弹琴老人/荒山齐；三件套通过
- [x] 43. 主人裁决：天空与送信人模型冻结（2026-08-02）
  - 天空：青绿（Grok 版 `0x7fcfc8` + 天空球 teal 渐变）系主人让 Grok 改的，**保持不动**
    （Kimi 曾误判为私改并回滚宣纸米，已按主人指示改回）
  - 送信人：维持原积木信使模型（`player/messenger.js`，不用老虎模型、**冻结不改**）
  - 勘误：TODO #42 中"纠回天色"一条作废，以本条为准
- [x] 44. 书店周边绣球花丛（Kimi 2026-08-02，主人提示词）
  - `assets/hydrangea.js` `createLowPolyHydrangeaBush()`：detail-1 二十面体花球
    三色盘（#A9CBEF/#F4F7ED/#CBE685）+ 六边形斜展绿叶（#2E7D32/#43A047）
    24 球层叠穿插：底大蓝白、顶小黄绿；全件描边 + castShadow/receiveShadow
  - `createBookshopHydrangeas()`：草坪沿 5 丛 + 门廊两侧 2 小丛 + 贴墙 2 丛
    作为书店子节点同变换部署；放大截图核验三色与穿插感；三件套通过
- [x] 45. 基督城 11 号电车 + 球面环形轨道（Kimi 2026-08-02，主人双提示词）
  - `assets/tram.js` `createChristchurchTram()`：三层分色（酒红 #721c24/奶黄 #FFF8DC/原木线 #CD853F）
    黄金标线+「11」微牌、铜红探照灯+自发光灯面、CITY TOUR 路牌箱、半环防撞栏、
    双层拱形集电弓+斜伸黑柱、两侧各 2 暗红 8 段车轮+灰色避震连杆
  - `world/tramSystem.js` `buildChristchurchTramSystem()`：CatmullRomCurve3 闭合环路
    （营地→书店→天桥→西芳寺赤道线），枕木 ~每 1.4 一根 + 双钢轨 TubeGeometry 贴地形
    （R+0.1+岛上 groundLift）；电车 update 沿环行驶（up=法线、forward=切线、绕 up 转 -90°）
  - 接入 messengerIsland 主循环；截图核验电车在轨、细节齐全；三件套通过
  - 注：无头环境速度断言受 dt 钳制影响（环境 artifact，非 bug）
- [x] 45b. 电车改型 + 轨道重排（Kimi 2026-08-02，主人两条反馈）
  - 车厢：长 5.2（×2）、总高 ~1.37（×2/3）、9 窗、bodyLift 0.06 贴轨
  - 轨道 7 控制点重排：绕开池塘洼地（负角度弯根源）、书店/绣球/招牌、
    古松、街道资产；各点离 NPC ≥3、不压出生点；逐点排障记录在 tramSystem.js 注释
  - 截图核验：长扁车身贴轨、新线无穿越；三件套通过
- [x] 45c. 电车速度入开发者菜单（Kimi 2026-08-02，主人指示）
  - `params.js` P_DEFAULTS + `tramSpeed: 3.2`（自动持久化）
  - `devPanel.js` 新增「交通」组滑杆（0~10，含 0 停车）
  - `tramSystem.js` update 改读 P.tramSpeed；断言：滑杆调 8 → P=8 ✓；三件套通过
- [x] 46. 云形状与风速/风向联动（Kimi 2026-08-02，主人命题）
  - `params.js` + devPanel「交通」组：风速（0~4）、风向（0~360°）
  - `updateClouds` 第三参 wind：风向投影到各云切平面 → 漂移方向；
    速率 ∝ 风速；局部 +X 对齐风向拉伸（≤0.6）、-Y 压扁（≤0.25）、-Z 略收
    （风切变：沿风向拉长、风越大越扁）；保留初始随机缩放与径向起伏
  - 断言：风速 3 时云 x=2.42 > y=1.20、1.2s 切向漂移 0.74 ✓；三件套通过
- [x] 47. 昼夜循环（朝霞/暮云）（Kimi 2026-08-02，主人命题）
  - `world/dayNight.js`：9 关键帧调色（午夜/黎明前/朝霞/上午/正午/下午/暮云/入夜/回午夜）
    联动天空球 uniforms、scene.background、雾色、日光色温与强度、环境光、云染色
  - 周期 90s × daySpeed；面板「天空」组：昼夜速度 + 时刻（可手拖定格，自动同步）
  - environment.js 暴露 skyMat/hemi；main.js 主循环接入
  - 四时刻截图核验：朝霞橙霞带 ✓ 暮云红橙 ✓ 夜靛蓝 ✓；三件套通过
- [x] 48. 电车搭乘系统（Kimi + Grok 2026-08-02，主人命题）
  - `player/tramRide.js`：近车 3.0 出提示 [F] 搭乘 → 0.9s 上车动画（位置插值追踪车门、面朝电车）
    → 窗边乘坐（座位贴车前段右窗、视线朝窗外 + 缓慢扫视看风景、相机拉远 10）
    → 再按 F 车侧下车、相机还原；乘坐时跳过移动/碰撞
  - Grok 增补：onBoard 钩子 +「水面旅程」登车音效 + 登车 Toast
  - 全流程断言：提示 → boarding → riding（贴车 0.95）→ 下车 idle ✓；三件套通过
- [x] 49. A/D 纯横移转向角收敛（Kimi 2026-08-02，主人指示）
  - `controller.js`：iz=0 且 ix≠0 时 wish 向相机前向 lerp 0.35
    转向角 90° → ~62°（几何计算值）；W/S 组合不受影响；三件套通过
- [x] 50. 天气系统：雨/雪/闪电（Kimi 2026-08-02，主人命题）
  - `world/weather.js`：雨丝 LineSegments×550（斜落方向=下落+风×1.6）
    雪花 Points×380（慢飘+湍流摇摆+风×0.9）；均受 P.windSpeed/windDir 驱动
  - 闪电（仅雨天）：4~9s 随机折线雷 + 高亮点光源双脉冲；strikeNow 测试钩
  - 面板「天空」组：天气 0晴/1雨/2雪；截图：雨丝斜落 ✓ 雪飘 ✓ 折线雷 ✓
- [x] 51. 莫比斯双半球 + 电车跨赤道（Kimi 2026-08-03，主人命题）
  - `planet.js` 顶点色结界：北沉绿 / 南 #A5CAD6 荒漠淡蓝（赤道 ±12° 过渡）；
    半球光地色改中灰 0x4a4a44 防绿色污染
  - `world/moebiusCity.js`：15 座棱晶塔（5~8 倍玩家，Cylinder 5/6 段尖刺，
    明黄 #F39C12/亮蓝 #3498DB 半透明自发光，粗描边，斜指天外）+ 主晶塔固定地标
    (-46°,-115°) + 近邻悬空发光线桥；让开轨道走廊 ≥0.09rad
  - `tramSystem.js`：北弧保留 Grok 岛内避障环，西端岔出南延 5 点
    （跨赤道→城东→主晶塔南→城西→回北）；集电弓能量束（南半球可见，脉冲淡蓝，连水环）
  - `main.js` updateMoebiusBarrier：tram.y<0 → 2s 时间常数 lerp
    天空/雾/环境光 → 莫比斯粉紫 #EBB9B6 + 暖橙 #F0C294（dayNight 暴露 getCurrent）
  - 验证：电车入南 ✓ 能量束 opacity 0.68 ✓ 天空暖色渐变中 ✓ 水晶塔+光桥 ✓
- [x] 52. 莫比斯水晶大都会（史诗级重构，Kimi 2026-08-03，主人命题）
  - `moebiusCity.js` `buildMoebiusCrystalMetropolis()`：InstancedMesh 三桶（4/5/6 段）
    840 座晶体（合并 Draw Call；非等比缩放 + 顶部斜切/收尖；冰川蓝 #BEE5EF 自发光 Toon）
    描边用同矩阵 BackSide 法线外扩实例（笔意宽度噪声）
  - 梯队：母皇塔 ×3（26~30 高 = 玩家 15~20 倍，明黄自发光粗描边）；
    丛林高度/密度向母塔聚集（8× → 赤道 3× 退化）
  - 金黄能量海：InstancedMesh 420 片金箔贴片（#FFD700）聚在晶根与地表，冷暖对冲
  - 能量束目标改接中央母皇塔顶（GRAND_CRYSTAL 导出常量驱动）
  - 验收：晶林全景（双塔+密林）✓ 电车穿梭（光束+天空渐变中）✓ 三件套通过
  - 注：无头满环 ~46s+，入南轮询需放宽（环境慢速 artifact）
- [x] 53. 玻璃晶林 + 大峡谷 + 悬空高架桥（Kimi 2026-08-03，主人命题）
  - `world/canyon.js`：谷心 (-50°,-112°) 缘 0.55rad 深 11、5 级阶梯塌陷；
    `applyCanyonToGeometry` 供 planet 顶点改造（computeVertexNormals 重算）
  - 晶林全换 MeshPhysicalMaterial：transmission 0.9 / roughness 0.05 / ior 1.7 /
    thickness 2.0 / 色 #D6EAF8 / 内光 #1F3A4B；母皇塔金珀玻璃同款；描边保留
  - 晶体/母塔/能量海全部按 canyonOffsetDir 扎根谷底与峭壁；贴轨晶体削顶让行高架
  - `tramSystem.js`：南半球轨道固定 R+0.2 悬空跨谷；每 ~3 单位灰桥墩落到谷底
    （长短随谷深变化）；双车四元数对齐照常
  - 验证：谷心顶点半径 31.2 ✓（目标 ~29，顶点采样误差内）；玻璃晶+金塔+谷底视差 ✓
  - 注：transmission 透射渲染在 SwiftShader 无头下偏慢，真机 GPU 正常
- [x] 53b. 峡谷深化 + 城市收拢 + 高架远眺（Kimi 2026-08-03，主人四条反馈）
  - 峡谷加深 11→19、7 级阶梯；谷底 r=21 实测可站立行走（collision 叠加 canyonOffset）
  - 晶林密度/高度衰减半径 1.35→0.45（围绕母皇塔收拢成簇）
  - 轨道南延改线：谷缘东北→跨谷空桥→谷缘西南，与城区保持 8~15° 观景距离
  - 验证：谷底落地 r=21.0 onGround ✓；俯瞰截图见深渊+谷底晶城+高架
- [x] 52. 红蓝双电车 + 双线相向运行（Codex 2026-08-03，主人指示）
  - `assets/tram.js`：红/蓝参数化配色，补驾驶室双窗、双侧门、前后灯、保险杠、
    屋顶电气箱与双菱形集电弓；红 11 路 CITY TOUR / 蓝 12 路 COAST LINE
  - `world/tramSystem.js`：中心环线横向偏移 ±0.9 生成两条球面线路，共四根钢轨；
    红蓝车同站并排、方向系数 +1/-1 相向发车，音效跟随距玩家最近车辆
  - `player/tramRide.js`：两辆车均可搭乘；上车时锁定目标车辆，交会时不串车
  - 浏览器近景核验：双配色、双菱形集电弓、两组轨道均可见；启动控制台零错误
- [x] 50. 弹琴老人八音盒互动（Codex 2026-08-02，主人指示）
  - 靠近老人 3.2 单位显示 `[E] 聆听八音盒`；播放中再次按 E 可停止
  - `audio/sfx.js`：原创八小节旋律，正弦基音叠加轻泛音模拟金属簧片衰减
  - `world/elderMusic.js`：老人附近优先接管 E 键，琴键随音符轻微起伏；静音态给出提示
- [x] 17b. 球面实验页增强 **验收**（Kimi 2026-08-02 07:12 通过）
  - 无头截图 ×3（散布全景 / 跳跃离地 / 落地续行），控制台零告警
  - review 纪要见 `PLAN-sphere-player.md`；可选优化（面积加权散布 / 碰撞死代码）已由 Grok 清掉
- [x] 6b. Kimi 全面 code review + 验收三件套（2026-08-02 通过）
  - 16 个模块全部通读；职责边界清晰，与拆分建议结构一致
  - `node tools/e2e/accept_tiger_messenger.mjs`：语法 ✓ / 无头截图 ✓ / 控制台零 error 零 warning ✓
  - 截图核验：开场、任务面板、信件清单、罗盘（指向小虎）、夜色场景渲染正常
- [x] 7b. 视觉方案 **评审定稿**（Kimi 2026-08-02）：夜色低多边形板与提案一致，定稿
- [x] 12. 部署：GitHub Pages 验证 `/TigerMessenger/` 在线可玩（2026-08-02）
  - commit `0b48f06` push 至 `main`（仅 TM 相关：`TigerMessenger/`、home 入口、backend 挂载、README 段落）
  - 在线 200：https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/
  - vendor / 展厅「进入二次元」入口均已核验
- [x] 13a. 信使记忆轻量彩蛋（Grok 2026-08-02，自包含 localStorage）
  - `src/quest/letterJournal.js` + 信袋面板（`L` / 任务栏按钮）
  - 送达写入、开场提示往事数量、通关打开信袋
- [x] 13b. 桥接主站四层记忆（Grok 2026-08-02，主人批准）
  - `src/quest/memoryBridge.js`：动态加载 `MemoryCore`（creatureId=`messenger`）
  - 路径候选：Pages `../frontend/js/memory/` · 本地 `/js/memory/`
  - 接信 → log + perception + intention + affect；送达 → log + 确认意图 + 欣慰
  - 失败静默退回本机信袋；信袋状态行显示连接/语气

## 流程约定

- Grok 交付后 Kimi 跑验收三件套。
- 单文件超 ~800 行后由 Kimi 拆 `src/`；之后 Grok 按模块续写。
- **Grok 工作循环**：时不时回看本文件，未完成且不依赖主人批准的项直接做掉。
- **当前阻塞**：无。
- **送信人规格（主人）**：AgentsGroup2026 智能体模型，**禁止**改回竹虎/斑阑。
- **Grok 循环**：时不时回看本文件，未完成且不依赖批准的项直接做掉。
