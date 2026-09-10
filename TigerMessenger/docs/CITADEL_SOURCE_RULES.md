# 高山圣城原作规则审计（2026-09-10）

范围：只读实际 JavaScript 调用与规则；没有把索引、仿真样例或场景检视当作 Godot 完整战斗。本文是本批迁移依据，未修改原作运行时代码。行号为本次读取时位置。

## 真正激活的路线

- `src/scenes/messenger/loadCitadel.js:129–136` 明确停用旧五台地 V4 snapshot：`v4Runtime = null`，原因 `retired-five-terrace-topology`。保留 adapter 不等于当前运行使用它。
- `src/scenes/messenger/loadCitadel.js:337–355` 创建 `createSaihojiPhalanxBattle`；`src/world/saihojiPhalanx.js:552` 从实际城堡读 `highlandAssaultAnchors`。旧战术图只在 `citadelCombatV2 && !latestAssault` 挂载（loadCitadel:374）。
- 当前设计版本 `src/world/highlandCitadelDesign.js:11` 为 `2026.08.27-reference-obelisk-stone-v12-vegetation-bands`。其 `latestDesign` 明示 `terraceLayerCount:0`、`waterfallCount:0`、`preservesGameplayTerraces:false`（约2130行）。不能因旧文件注释仍写瀑布/台地而重新造回来。
- 权威锚点在 `highlandCitadelDesign.js:2144–2167`：`destination:castle-top`，7点 `stairRoute`，接 `interiorFloorRoutes`，终于 `keepTop`；`feetClearance:.22`，`ladderPolicy:disabled`，`ladderLanes:[]`，`captureMode:interior-rotating-stairs`。路线是城堡局部坐标，必须应用该城堡世界变换，不能与旧 range 局部坐标混用。
- `saihojiPhalanx.js:1917–1964` 实际按外部路线后接每层内部路线，记录每层起止索引，再读取 keepTop。`citadelRange.js:1713–1743` 给木马系统的路线也读取同一锚点。

## V4 规则能用什么，不能假称什么

`src/agents/citadel/siegeDirector.js` 是纯数据命令/规则模块：进攻 land、gather、probe、breach、seize-gate、climb、push、retreat；守方 hold-high、choke、reserve、fall-back、counter。命令明确 `teleport:false, skipGraph:false`。它没有自动完成战斗或判胜。

`battlefield.js` 提供合法跨面、门可达、高地、瓶颈等数据诊断，当前 still uses terrace 0/4 fallback 和旧图节点，不能以它的样例通过宣称新连续山城已可达。`combatSample.js` 在 src 中没有实际场景调用；`runtimeAdapter.js:99` 的模拟依赖 combat flag，且当前 loadCitadel 根本不挂载 adapter。当前迁移应采用新场景真实锚点/表面作验证输入。

## 进攻与兵种必须保留

- 苔庭返航的同一批士兵换蓝缨，抵纳沃纳广场后才攻城（saihojiPhalanx:3480–3582、2260）。不得新造满员军团或恢复伤亡来冒充连续战役。
- `beginSiege` 先建立可用路线，再给存活士兵分配路线；已到岸波次才可攻击或被攻击（2620附近）。船中隐藏增援不是地面靶子。
- 集结5秒，随后实际走到入口，再逐点上楼；长矛兵行进中不攻击，爬升时不能开弓，短剑盾兵近战缠斗/爬升时不能同时挡箭（2600、2824、2903、2977）。这是原代码的战斗设计，不声称其简化数值是 Bad North 的精确原版参数。
- 红盔守军以高处哨位防守；蓝军16秒后可触发两船增援，红船日间18–28秒轮换增援（2635附近）。计时可调度船出发，但不能替代到岸判定。

## 木马是两套现存行为，不能误合人数

1. 独立昼夜潜入：`siegeDirector.js:17–30` 的4绳、每绳2兵、2组共8人；每组首尾火炬、中间盾矛；回收在黎明。实际动画 `citadelInfiltration.js:17–22, 513–602`，入夜相位≥.82或<.22启动，4绳分两批，每批每组2人。`assignSearchTargets` 给门扇区分配，而不是士兵朝建筑中心穿行。
2. 攻城深夜收尾：`saihojiPhalanx.js:72–73, 3015–3202`，最多5名蓝盔残部，由6名木马红盔巡查兵驱离；残部全退出且巡查兵全回腹才故事结束，不等黎明。
3. 白天系绳班与两者不同。`citadelRange.js:373–420,1703` 仅统计 tie-soldier 麻醉比例决定木马倾斜，夜间班组隐藏时回正；不得把夜潜兵受伤当白天绳索失控。

### 已发现但未改的源代码缺口

- `siegeDirector.makeTrojanWave` 仍将前半组标为 ladder，尽管 ladderPolicy 已 disabled。
- `citadelRange:1723` 最新路线返回空 ladderRoute（兼容名 waterfallRoute）；`citadelInfiltration:504–518` 的 topAssaultMode 仍创建 ladder 组，`baseRoutes.ladder` 只有出生点，随后 patrol 可跳向顶层。这是旧名/路线未收口的风险，不能复制成 Godot 穿空通道。
- `citadelInfiltration` 的 setRoutes 没有更新闭包内 captureTarget/topAssaultMode，热重建目标需要另行校验。
- 原深夜逃离以离开滞留点距离为准，设置 dead=true 兼容清场；Godot应区分撤出与死亡。巡查回腹还有4秒隐藏兜底（saihojiPhalanx:3194），不能当真实走回木马的证明。

## 不得用计时冒充这些事件

| 事件 | 原作证据/必要判定 |
| --- | --- |
| 到岸 | 航程终点、有效靠泊与同一士兵下岸；不是增援出发即加入靶子 |
| 进入上楼 | 士兵距路线入口<.35（saihojiPhalanx:2800） |
| 夺取一层 | 到该 floorRoute.end 路点距离≤.28，才记录 castleFloorCaptured（2834–2842） |
| 顶层驻守 | 走完所有路点，距最终部署位≤.25（2872–2896）；capture stage 本身不是胜利 |
| 战役收尾 | 残部已退出，且巡查兵回腹（3199）；原作 phase done 不是攻城胜利旗标 |
| 地形可走 | 实际脚底表面/净宽/转角/碰撞验证，不仅路线点数量正确 |

62秒 `SIEGE_MIN_DAY_SEC` 是深夜抵达时给白天攻城留展示时间的替代时钟；深夜正常门控为≥.88或<.16（2630–2633），不是倒数结束攻城成功。原作目前没有严谨的“清除争夺守军并占领全层”胜利裁决；若 Godot 新增这种玩法必须明确标作新增规则，不能标作原作复现。

## 本批 Godot 接续建议

先把真实城堡根变换、stairRoute、逐层 interiorFloorRoutes、keepTop、木马和纳沃纳广场记录在同一导出契约，并显示有来源的路线与阶段。证明几何通路后让同一批演员逐点行进、受阻停下、实际到达后发事件；未通行不推进层占领。木马两组都使用有效的地面入口和内部楼梯，保留4绳8人规则，禁用旧空梯。独立收尾6兵应明确身份和职责。场景音乐归圣城所有，离开淡出；音乐变化不可作为攻城队被强制拉走的命令。
