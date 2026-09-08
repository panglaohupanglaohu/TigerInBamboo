# 资产覆盖补查：载具、木马与士兵

更新：2026-09-08。范围为当前工作树的源码、95 项源索引、72 项制作目录及全部 72 份原始节点快照；本次没有运行游戏、导出或改动模型。下列是查证结果与待办，不是新增资产完成报告。其他并行制作若扩大目录，应另记增量，保留此基线。

## 结论

72 项目录只覆盖当时选取的对象，并非完整游戏资产全集。95 个源文件被索引也不代表其中所有工厂被捕获。

- `bubblePod` 已有独立快照、`assets/models/originals/blender-r3/bubblePod.blend` 和 `godot/assets/originals/bubblePod.glb`，不是漏归档；尚不能把它的 Godot 静态导入当成驾驶/炮弹/巡航已移植。
- `scoutAircraft`、`gatePodCraft`、`gateHaulerCraft`、Socco 运兵变体、木马与先锋重甲兵，在此次 72 项制作目录中未独立注册，扫描原始快照也未找到其根节点。它们的源模块已在 95 项中索引。
- 罗马盔造型有部分嵌套覆盖：`oldHarbor.source.json` 中 `n637/n668/n700/n731` 是四名 `harbor-porter` 搬运工，有 soldier-helm/crest；`fisherBoat` 有 `crew-helmet` 船员。它们并不是已带齐盾、矛、短剑、长弓、火炬的战斗士兵，不能代替战斗变体验收。
- 阿喀琉斯、奥德休斯目前能确认主线文本和能力入口；本轮 `src` 中未找到以这两个姓名命名的独立模型工厂。不能把 `highlandHeroClouds` 的 hero 云景或 generic paperSoldier 当成这两名英雄。英雄需要剧情定义与视觉身份单列，而不是虚报“已有模型已迁移”。

## 必须补录的模型与调用参数

源码位置为相对项目根的文件及查证行号。建议 ID 不改变既有 72 项 ID；共用网格的涂装/装备应作为变体，实例数量不计成独立模型数量。

| 建议 ID / 覆盖 | 工厂与源位置 | 实际调用与参数 | 不可丢失的动态接口 |
|---|---|---|---|
| `bubblePod` / 已独立归档 | `src/assets/bubblePod.js:91` createBubblePod | `loadMoebius.js:37` 花厅最多 3 艘；工厂模块 :369 scale=.72，accent 三色；`loadMoebius.js:98` 书店另有 .72、0xffd98e 变体 | cockpitAnchor、muzzle、巡航/驾驶切换；bubblePodRide；气泡炮弹的附着/更新/销毁 |
| `scoutAircraft` / 缺独立制作记录 | `src/world/planetV8/tripleGateScout.js:51` createTripleGateScoutAircraft | 当前是 `src/world/scoutDefense.js:607` scale=.72；编队 count 默认 5 (:10/:104/:128)，不要误用旧 mountTripleGateScoutAircraft 当当前入口 | canopy、cockpitAnchor、navigationLights、beaconLight、propeller、gunMuzzles (:184–190)；`src/player/scoutAircraftRide.js:46` 驾驶接管 |
| `gatePodCraft` / 缺失 | `src/world/gatePodCraft.js:49` createGatePodCraft | 三涂装定义 :21；门前实际 `src/scenes/messenger/loadTraffic.js:292` count=2；舰队 `loadMoebius.js:136` mountGatePodEscort 默认 3 艘，scale=.62/.55/.58（工厂模块 :312） | escortSlot、tranq-muzzle；编队跟随、受击部署、索降兵锚点；pilot 默认 true |
| `gateHaulerCraft` + `soccoCraft` / 缺失 | `src/world/gateHaulerCraft.js:60` createGateHaulerCraft；:372 createSoccoCraft 强制 carrier=true | 基础三涂装 :34。当前 `loadTraffic.js:294` 门前 gateHaulers=null，不能恢复旧停艇。实际 `loadCitadel.js:291` 3 次 createSoccoCraft()，初始隐藏 | soccoRamp 铰链、soccoSeats、soccoRopeAnchors (:323/:353/:365)，开尾门、海面气帘、登艇/离艇；不能只抓隐藏初始状态 |
| `citadelTrojanHorse` / 缺失 | `src/assets/citadelTrojanHorse.js:19` createCitadelTrojanHorse | `src/world/citadelRange.js:1532` seed=9901，root.scale=.72；`odysseyCitadel.js:2063` 还有编辑器按 placement.scale 的配置实例，不应重复为第二套原作 | troy-belly-hatch、双门、腔体，setBellyOpen (:192–225)；白天 tiedownSquad、倾倒与夜潜绳索在 citadelRange/infiltration 模块运行时加入 |
| `vanguardTrooper` / 缺失 | `src/world/vanguardTrooper.js:183` createVanguardTrooper({scale=1,seed=0}) | :494 createVanguardSquad，seed=i；`loadCitadel.js:284` 默认调用；现常量 :51 是 **27**，按 :66 花名册分 6 名泡机 + 21 名运输艇兵 | parts 的 fig/torso/head/arms/legs/blade/gun (:342)，枪口充能/电弧、劈砍、污损、伤亡、归属载具、部署/回收；避免静态合并掉关节 |
| `romanSpearSoldier` / 战斗变体缺失 | `src/assets/harbor.js:1602` createHarborPatrolSoldier | `saihojiPhalanx.js:570` spawnSoldier 非弓/剑分支；同文件 :3023 木马夜巡同源 | 盾矛、parts、受击/记仇/阵列；红蓝缨共享青铜盔，不给整顶头盔换色 |
| `romanGladiusSoldier` / 缺失 | `src/assets/harbor.js:1642` createGladiusSoldier | :1632 createCitadelMeleeSoldier 在 isCitadelCombatV3 开启时改为枪兵，否则短剑兵；捕获时必须显式记录模式 | 隐藏旧矛，保留 right-hand-gladius、盾和腕臂动作，不能把两个分支只验一次 |
| `romanLongbowSoldier` / 缺失 | `src/assets/harbor.js:1722` createLongbowSoldier({rand}) | `saihojiPhalanx.js:573` 传入可重复 rand；:583 六阶段 bowCycle | 弓/弦/箭、reach/nock/draw/hold/follow/recover，updateLongbowShot :1915；原矛/盾隐藏 |
| `romanTorchSoldier` + `romanNightShieldSoldier` / 缺失 | `src/assets/harbor.js:2040` createNightInfiltrationSoldier({torchLeft}) | `src/world/citadelInfiltration.js:575` i=0/3 为火炬兵，其余盾兵；两种装备均需样本 | torchBearer、火焰、盾矛、绳索下降/登岸、双臂姿态；纸片厚度与双面材质 |
| `romanTieSoldier` / 缺失 | `src/assets/harbor.js:1507` createTieSoldier | `src/world/citadelRange.js:1675` 木马白天绑绳队 | kind=tieSoldier，后仰拉绳姿态、木马倾倒计数，不与夜潜兵合并身份 |
| `harborPorter` / 父场景嵌套 | `src/assets/harbor.js:1060` buildPorter；:1148 createPorterSquad | oldHarbor 快照四名已捕获；提取时保留原节点与父级位姿 | 搬箱、起重机联动，明确 combatant=false；不是战斗兵 |
| `warshipCrew` / 父场景嵌套 | `src/assets/harbor.js:115` createFisherBoat，船员构造/parts 到 :922 | fisherBoat 快照已带 crew-helmet；:1568 paintBoatCrewCrest 可切阵营缨色 | 实例化桨手、桨动作、麻醉与人数；不要以一顶头盔断言战船士兵完整迁移 |

以上 loadMoebius/loadTraffic/loadCitadel 简写均在 `src/scenes/messenger/`。武器/盾/盔/缨/火炬优先作为角色子资产与装备插槽管理；除非有真实独立使用点，不靠拆成许多 ID 增加“完成数量”。

## 数字冲突与遗漏原因

1. 制作目录来自 catalog 捕获，源索引还包含运行时/生成模块；目录唯一覆盖不等于全游戏无遗漏。
2. `moebiusAircraft` 快照是单机资产，并未包含 loadMoebius 随后挂上的 gatePodEscort。父模块有关联也不意味着快照含有几何。
3. 门前重型艇实际已停用；新补入的是可检视的模型和舰队任务里的 Socco，不应把停用场景恢复成旧版。
4. `vanguardTrooper.js:46` 和 `loadCitadel.js:288` 有旧 20/22/24、6/6/4 注释，现可执行常量/花名册是 27（3×2 + 3×7，每运输艇最后一位看护）。资产容量/动作测试以当前花名册为准，不按旧注释做 20 人。
5. 木马舱门腔体与 Socco 初始隐藏、装备替换和运行时挂载，要求闭合/打开、待机/任务等状态捕获。只导出 visible 初态会漏掉真正交互内容。

## 并行批次与验收

- 区域集成持续收口书店镇；独立载具工作线先补 scoutAircraft / gatePodCraft / Socco，bubblePod 只补真实双端状态与变体，不重复归档。每类保留源快照、Blender 副本和 Godot 可检视资源。
- 圣城与苔庭角色线先建立 vanguard 和罗马装备族的完整节点合同，再复用动画；木马和日夜兵队应在同一剧情验收批绑定。英雄身份与虎、狐、玩家仍属主线高优先级，不能被小装饰挤后。
- 同一文件只设一位编辑者；资产捕获、模型优化与区域集成可分工，但合并前要在统一关卡验收，不把画廊旋转模型视为可玩交付。

每个新增 ID 至少记录：原工厂/参数/种子、父级球面变换、变体及可见状态、动态节点名称、几何与材质对照、Blender 路径、Godot 路径、Web 回接状态、Godot 回接状态、实际场景检查证据。概念图对照检查轮廓/比例/主色/材质/装饰布局；固定相机截图用来发现差异，不以所有像素相同作为艺术优化完成标准。

载具验收应包括进入/退出驾驶、相机锚点、球面方向、炮口、编队随行、攻防触发、开尾门和上/下艇。兵种验收包含红蓝缨两色、全部装备、行走/攻击/受伤/撤离，木马包含白天拴绳与夜间开舱两状态。任何一项仅导入成功，都保持“待行为回接/待场景验收”。
