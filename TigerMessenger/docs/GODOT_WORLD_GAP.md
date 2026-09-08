# Godot 与原作完整世界的差距

核查：2026-09-08。依据当前 `godot/scripts/world.gd`、Web 正式主岛装配器及原故事 `/Users/panglaohu/Downloads/index.html`。这是源码核查；未把未运行的事件当成已经实测。本轮停止新增书店局部美术，没有写入书店候选代码，也没有改 Godot 默认世界。

## 当前判断

用户指出的问题成立：现 Godot 默认场景仍是一个小型原生演示关卡，书店原作模型、材质、墨线、石板与六棵近景树的回接是真实改进，但不能据此说原作世界已经承接。

- Web `src/world/worldScale.js:8` 的 WORLD_RADIUS 为 **160**；`planet.js:10` 直接引用。Godot `world.gd:4` 是 **32**。半径仅原作 1/5；同角度地表面积为 1/25，建筑却保持原尺寸，地平线曲率、城市视野与旅行距离因此完全不同。这是尺度合同差异，不是增加装饰可弥补的问题。
- Godot `build_places` 把六个目标按 angles=[.28,.74,1.12,1.49,2.12,2.64] 摆在同一子午线上。除书店已替换，模型列表仍是 gate/pine/postbox/pine/tower，苔庭、旧港、湖沼、圣城没有对应的完整地貌与建筑群。
- Godot `elevation` 是两组指数隆起与一条连通堤，`build_terrain` 生成球壳地面；没有 Web 的主岛丘陵、深峡谷、水晶高脊、苔庭六景、连续圣城山谷、真实海岸与多水面层级。
- `build_places` 仍使用旧 `res://assets/` 实验 house/tower/pine/aircraft/fox/tiger；`godot/assets/originals/` 里成功导入的档案没有自动接到这些地点。原 fox/tiger 身份、真实群落与动作系统也不能由旧同名实验模型替代。
- 原生“六地点步行通过”只能证明这个小关卡的移动与交互，不代表跨越原世界、搭乘交通、苔庭战争和圣城逃脱已验收。

## 真正的世界装配入口与状态来源

Web 入口是 `src/scenes/messengerIsland.js:97` 的 load：先建平台/丘陵/营地/月湖/旧港，再加载电车、水晶城、圣城，再建立球面表现层、书店、湖沼、海运、苔庭地被、侦察编队与战争系统。`src/scenes/messenger/updateIsland.js` 是当前每帧联动合同，不只是一批静态模型。

导出宏观世界必须在这些步骤完成后采集实际节点世界矩阵、父子关系、边界和活动标记，并记录 URL/FEATURES、随机种子及地图存档摘要。不能仅拷 `planetV8/landmarkManifest.js` 的 DEFAULT_LANDMARK_MANIFEST：它含另一组 art-directed 方向和退役的 five-terrace 硬约束，未必等于正式主页可见资产的落点。正式主页还有 `messengerIsland.js:37` officialPagePlanetFeatures 的兼容配置，默认开启曲率海洋/云与海运、运河限定水晶城。

需只读保存实际生效配置：水晶城 loadCrystalLayoutFromStorage、圣城地形/楼层/地貌对象存档、叹息之门 GATE_ANCHOR_KEY、地图编辑器的运行时移动。默认源码坐标是核对基准，不能覆盖用户保存的设计。

## 区位与空间关系必须整体移植

| 原作区域 | 当前实际源码与约束 | Godot 缺口 / 正确交付内容 |
|---|---|---|
| 星球、两个文明与海岸 | worldScale/planet；`world/hills.js`、`canyon.js`；`planetV8/runtime.js` 与 `waterV8/officialOcean.js` | 原半径 160、轴向/经纬约定、实际地形碰撞、水面层级、远景地平线；不能把整个世界缩成 radius32 小岛 |
| 主岛、营地、书店、月亮湖林道 | `messengerIsland.js:171` 书店 flatX=11.5×4=46、flatZ=5.5×4=22，groundLiftAt，yaw=-.5；`hills.js:71` CORRIDOR_FOREST_PATH 连营地—书店—月湖；`nature.js` 实际林带；`startingCamp.js` | 保留原曲面丘陵与路线净空，书店资源可复用但须回到真实区位。原作已停用随机房屋/灯杆，不应从旧实验重新铺镇 |
| 月亮湖与周围水域 | `world/lake.js:53` createMoonLake；`moonOrb.js`；`updateIsland.js:40` updateLakeFx | 月亮浮沉、昼夜/月光路、涉水、涟漪、倒影；不是一张统一海球表面 |
| 莫比斯峡谷、水晶高脊城市、花厅 | `world/canyon.js:8` 中心 lat=-50/lon=-112、深度15×4=60；`moebiusCity.js:74` GRAND_CRYSTAL lat=-24/lon=CANYON.lon；`loadMoebius.js:32` 读取已保存城市布局 | 峡谷剖面、塔群高度层次、花厅/鸟群、局部湖海与城市运河、列车入城视线；用一栋塔不能代表城市 |
| 莫比斯湖沼生态 | `loadMoebius.js:81` createCatalogObject("moebiusSwamp",seed7711,scale.5)，crystalCanyonSwampDir，lift=canyonOffsetDir-4；`world/moebiusSwamp.js:3200` 球面适配 | 完整坑口/水位/湖床、植物与动物在父场景中的关系；保存峡谷下沉，不恢复悬空草盘；虎的位置与生物吸食必须取实际对象 |
| 雄伟叹息之门 | `loadTraffic.js:236` buildAbandonedGate 依电车曲线落位；`main.js:521` 可应用保存门锚；`world/abandonedGate.js` 巨门/通道与座标 | 新旧文明边界、轨道穿门、鸟涡净空、门前 2 架 gatePod；当前实验 gate 的小碰撞框不代表原门 |
| 苔庭六景及鲲 | `world/saihoji.js:50` SAIHOJI_HUB=(32,-120)，六景分别独立经纬与半径；`messengerIsland.js:258` 地被 footprint rx18.4/rz11.6；`saihojiPhalanx.js`、`whaleMaw.js` | 连续园林、真实松石/朝圣石阶与苔色、鲲承载/上升/战斗空间、海岸登陆。不能把六景压成一棵 pine |
| 旧港、老人、红狐、八音盒 | `loadCitadel.js:220` placeHarborOnCitadel 与 :196 snapOldHarborToSeaCove；`assets/harbor.js:2387`；老人最后由 `messengerIsland.js:68/:196` 固定在 (-69.7,142.01,27.71)；`main.js:1480` foxAli 来自 camp.landmarks | 港湾、半沉战船、码头物流/吊机、原巨树、人物与音乐关系。代码后续会搬移老人/狐，迁移时取最终实位；不能仅根据故事“旧港”名字强行归父节点 |
| 高山圣城、纳沃纳广场与木马 | `citadelRange.js:48` RANGE_SITE=(24.1,36.05)；`loadCitadel.js:53` mountain-valley-v1、禁旧梯湖/瀑布/缺口；:89 buildOdysseyCitadel latestDesign=true；:114 广场落城堡—旧港连线70%；:86 木马只一匹 | 连续山谷、城堡复合街区/城墙/顶楼、港口海湾、广场集结与木马夜潜。保留降海后的城市基面，不回退五台地实验；一座 tower 无法承接终章 |

## 人物、战争和交通不是可选装饰

| 系统 | 当前 Web 真实入口 | Godot 必须承接的行为 |
|---|---|---|
| 信使与原送信委托 | `player/player.js`、controller/animation；`quest/questSystem.js`、letterJournal；main 的 E 委托与 R 家书分别运行 | 同一原角色身份、地形行走、原委托/收信/投递/信件记录，不用六个 R 邮筒替换整套玩法 |
| 红狐与老人音乐 | `world/foxNpc.js`、`elderMusic.js`；`main.js:1381/:1481` | 八音盒/唱诗交互、跟随/休息/乘车关系，家庭重逢触发；恢复角色而非在目标盘上放静态狐 |
| 虎与湖沼生态 | `world/moebiusTiger.js`、moebiusSwamp 与其生物行为模块；`story/escortMotion.js` | 湖沼的真实原虎/重塑副本、动作与地形接触、与红狐共同逃离；蓝猴投石和回击需明确实现状态 |
| 莫比斯主舰生命吸食 | `assets/moebiusAircraft.js`；`updateIsland.js:105` updateAircraftHover；`rescueCampaign.js` rescueSuppressed | 花蕊→生物的威胁、目标选择/吸食效果、战斗影响和救援抑制。目前 Godot 只有三架实验飞机正弦盘旋，protection 改 theta，不能算吸食系统 |
| 侦察/泡机/登陆艇/重甲协作 | `messengerIsland.js:381` 5侦察机、3编舰队2守水晶城；scoutDefense、gatePodCraft、gateHaulerCraft、vanguardAssault、vanguardTrooper | 侦察标记、麻醉/打击分工、27人载具花名册、开门登陆/绳索部署、召回原载具、战争触发去重；详见 ASSET_COVERAGE_AUDIT.md |
| 苔庭传统守军与鲲反击 | `world/saihojiPhalanx.js`、`whaleMaw.js`；`loadCitadel.js:275`；`updateIsland.js:118` | 船只运兵、红/蓝缨角色/装备、射箭/投矛/反击、鲸与重甲交互、任务阶段到战争事件链 |
| 木马日夜事件与圣城攻防 | `world/citadelInfiltration.js`、citadelRange、saihojiPhalanx、agents/citadel 下有效分支 | 白天拽绳/倾倒、夜晚双舱门/火炬兵索降/巡逻、城门与街区可走通、屋顶终章；`loadCitadel.js:137` 已禁退役 v4Runtime，勿自动复活 |
| 双线电车 | `world/tramSystem.js:556`，红蓝平行 CatmullRom 曲线、路号11/12；`loadTraffic.js:34` carveHillsForTrack；`player/tramRide.js` | 实际轨道、高架、进站/运行、F 上下车、车厢/驾驶视角、鸟群与音乐联动；不是铺90块路线提示石 |
| 海运与飞行搭乘 | `loadTraffic.js:46`、waterV8/waterRouteFleet、canalBoats；player 下 boatRide/airshipRide/aircraftRide/scoutAircraftRide/bubblePodRide | 正式主页保留水晶城运河、海洋外航线；曲面船位/桨/尾迹与上下船；气泡艇带家人去圣城必须可实际完成 |
| 昼夜、天气、声音与可见性 | world/dayNight、weather、seasonBands、environment；render/lighting、clouds；audio/sfx、scenes/messenger/swampBgm | 原世界昼夜/水云关系与区域音景；事件音与空间音，不以三条合成提示音代表音效迁移。分区加载/实例化预算与地平线裁剪需随全世界验证 |

## 原故事与当前两端剧情摘要的差距

原信不只是六个地点名。它的因果是：父亲进入异时空 → 伊利亚特战争与英雄分歧/木马 → 借书店的信获得通行身份 → 在文明边界结盟 → 利用苍鹭把吸食生物的 aircraft 引去苔庭，鲲无法被吸动、英雄部队争取时间 → 旧港红狐/音乐重逢 → 湖沼灯谜认女与蓝猴阻拦 → aircraft 再临、三人搭气泡艇逃离 → 木马兵夜间潜出、上圣城屋顶 → 回望英雄命运与家书。

当前 Web `story/rescueState.js` 与 Godot `data/chapters.json` 六章摘要相同。摘要已经建立方向，但触发大多仍是到点按键：

1. 六章以“书店”开头，原信前序伊利亚特/木马/吱吱尚没有对应完整演出。
2. 英雄名字目前主要在文本/按钮，未确认独立英雄模型；按钮暂时设置抑制秒数，未要求真正完成苍鹭诱敌/鲲吸不动/英雄抵达的因果任务。
3. 原信最后明确写“阿喀琉斯的脚踝被射中，奥德修斯在奋战”；两端摘要却改成“阿喀琉斯仍在掩护”。应恢复用户原信这一故事事实，不能把当前摘要当不可改的原作定稿。
4. Web 终章以抵达圣城目标为条件，Godot 以抵达第六盘为条件；都不能据此宣称气泡艇逃离、夜潜、跑上顶楼和回望战场已完成。
5. 原作中的吱吱、苍竹/阿竹、英雄、八音盒以及家人关系要建立剧情对象/事件合同；“没有独立资产”与“没有行为”分开补，不盲目生成 generic hero。

## 迁移执行顺序与能验收的证据

1. **先锁完整世界空间。** 从当前真实 Web 场景输出 radius160、全部有效区域根、世界矩阵、地形/海岸、列车与航线、角色与动态系统锚点。保存源码和生效存档摘要；含有效/退役说明。Godot 独立原世界入口按同轴/同尺度接入，保留小关卡作为历史测试场景而非继续扩张。
2. **再建立原世界可移动入口。** 书店出生，能观察球面远景与真实城市/峡谷轮廓；地面碰撞/道路净空/水位正确。宏观总览与书店、巨门、苔庭、湖沼、港口、圣城固定视角逐一对照。分区占位必须明确标注未迁移，不能用实验松树冒充。
3. **交通先打通，按实际旅程集成。** 电车/海运/气泡艇所需路线、搭乘及角色附着先完成，才有跨原世界章节的可玩路径。动态系统单独拥有节点与更新，不烘入静态 mesh。
4. **战争与主线因果接入。** 把既有可序列化救援状态当基础，扩展真实事件条件；原军队/鲲/aircraft 系统按依赖移植；不另做一套用正弦移动假冒的战斗。
5. **美术迭代回到原场景。** 用户认可的书店成果复用；概念图引导比例/材质/石路/花色，与真实视角、光照对照，随后分区推广。宏观世界尚缺时不以反复修一栋书店代替整体交付。

完成门槛：实际世界位置误差与比例报告；原地区全景截图；玩家沿真实地形/交通走完整救援路线；剧情触发、家人跟随、敌我任务状态、昼夜/加载后恢复测试；Godot 和 Web 各自记录。只完成清单、静态模型加载或一次全景截图，都保持对应的“行为/游玩待验收”状态。
