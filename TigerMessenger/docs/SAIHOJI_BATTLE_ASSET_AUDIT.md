## 8931网页漏接修复（2026-09-10）

用户指出实际localhost:8931/TigerMessenger并未加载优化。已核验该服务index与当前工程一致，根因是Web仍调用旧procedural工厂，之前Godot完成不能代表Web。

本轮将vanguard-color-v2和socco-color-v2真实GLB几何/材质转成同步Web模块，通过battleOptimization绑定到原对象；保留原parts/父级/14座位/坡道/VFX状态。重甲补实时关节、握柄、瞄准/举刀/挥击和原炮充能缩放联动。实际生产页before：0新版/27重甲+3运兵艇missing；after：27重甲、3运兵艇active geometryApplied，0missing/0pageerror。见artifacts/pipeline/web-battle-assets/production-report.json。独立模型动作检查见artifacts/pipeline/battle-optimization-web/report.json，图不是自然战斗截图。

边界：仅这两资产回接网页；战船v4等不混算。SOCCO网页坡道未获得真实地面采样，仍标review-angle-ground-unresolved，不宣称完整自然上下船/全战斗验收。接下来接该地形采样并验证真实上下船，再逐项缩小Web/Godot接入差异。Godot两资产维持已接状态。

## 重甲与SOCCO目标配色已接入

用户要求修正明显色差。新增vanguard-color-v2和socco-color-v2，保留原几何/UV/层级和动作；GLB除materials外JSON及二进制完全一致，重甲161帧保存动作一致，SOCCO主Blend原本静态，不声称其包含整场动画。重甲改炭蓝灰/灰褐炮壳护板，SOCCO改珊瑚砖红/暖象牙/深棕底和木坡道；金属度粗糙度保持。三源色元数据同步新色，防止导出恢复旧色。

Godot world已加载两份新GLB，heavy动作仍复用v1 assembly。隔离项目GPU自然战斗到67.1167秒实际出舱截图通过，见artifacts/pipeline/moebius-color-review/godot-report.json及godot-actual-disembarkation.png；仅验证本轮配色接入，不代替完整战斗验收。两份Blender/GLB与material-mapping/验证位于assets/models/optimized对应新目录；总览和moebius-color-review/index.html已更新。已运行旧Godot窗口需重启加载新资源；Web源未改。

## 护航艇合并（用户最新决定）

GatePod统一为一种模型，以pod-41-7的Blender、GLB和动作数据作为唯一母版。pod-55-2与pod-08-9仅保留历史归档及战场实例身份，不再分别优化。Godot苔庭适配器中三艘艇均加载同一母版，各自航线、比例与双索降仍独立；61帧×3艘共183姿态、实例独立和重置检查通过。当前已运行的旧窗口需重启才加载修改；Web原源未改。验收页只展示一种。详见assets/models/optimized/gatepod-escort-v1/shared-model.json。

# 苔庭之战：资产、原作流程与 Godot 接入审计

## 最新补充：六庭树根承托与待机海面净空

原始问题有两层：原球面固定 lift/sag 放置造成 9 棵根盘中心超出背岛陆面（最远约 2.96 世界米）；待机板面以 160.3 为半径基准，而 25 树根心半径只有 160.349–160.534，低于原海面及波峰。单独降低树会入水，原根/seed/六庭局部布局因此保持不变。

已增加可逆连续苔岩承托，实际投影面积由 85.8968 m² 到 120.9808 m²（增加 35.0840 m²），1282 个顶面三角、1 个连通体，并非 25 个独立花盆。原地壳/六庭源网格保留。425 个按真实根盘范围采样的中心/边缘点全部命中实际候选三角面，最大局部高度误差 1.78e-5。此为明确岛缘地形扩展，不能说成只微调根。

待机干燥基准根据全部承托三角面求得 160.85315，比旧值整体提高约 0.55315 世界米，树/石/板一同移动，海半径未改。GPU 实测所有顶面三角内点最小半径 160.61850，高于最大波峰 160.567 约 0.0515 米。鲲升起仍回原 plateY=6.08，归落/复位重新采用计算的干燥基准；restore 可撤掉候选并恢复旧基准。

证据：`artifacts/pipeline/saihoji-pines-v1/root-ground-diagnostic.json`、`root-ground-support-report.json`、`root-support-topology.json`，同目录 `root-ground-near-before/after.png`、`root-ground-far-before/after.png`。保留 r1 承托被水遮挡的失败报告。当前新增承托只增加 1 次绘制；未重跑整场战斗，也不把截图绘制计数当 FPS。实现：`godot/scripts/saihoji_root_support.gd` 与 `godot/assets/saihoji-pines-v1/root-support.json`，主工程及现有 q 已同步，未重启 r24 用户窗口。

本批为真实可见地形与树根支撑，未增加玩家导航网格或宣称全庭园步行/动态碰撞验收。


## 最新补充：25 棵原六庭古松已接入（LOD0）

已按 `artifacts/pipeline/saihoji-pine-source-mapping.json` 的五网格几何匹配结果，将 25 个不同 seed 的候选接入实际原六庭。运行资产在 `godot/assets/saihoji-pines-v1/`，`saihoji_pine_adapter.gd` 保留原树根节点、实际 transform、六庭/鲲父级及可恢复的旧子节点，候选 n0 置为 identity，避免重复原 factory yaw 与 1.02 缩放。战场入口自动加载，无需调试刷入。

本批实际 GPU 核验：25 根/父级不变，25 唯一种子，17 ID/棵，125 个可见材质表面与候选 GLB 线性色值最大误差 2.98e-8，没有重复乘顶点色。树冠由原圆饼形转为较薄的层叠轮廓，保持各树原枝势与三种绿色。仅复制并导入 25 个 LOD0；LOD1/2 留在 canonical 候选目录，**尚无自动 LOD，LOD0 也不是减面性能优化**。

证据：[近景原版](../artifacts/pipeline/saihoji-pines-v1/godot-pine-near-before.png)、[近景候选](../artifacts/pipeline/saihoji-pines-v1/godot-pine-near-after.png)、[六庭远景原版](../artifacts/pipeline/saihoji-pines-v1/godot-six-gardens-before.png)、[六庭远景候选](../artifacts/pipeline/saihoji-pines-v1/godot-six-gardens-after.png)、[GPU 布局与材质报告](../artifacts/pipeline/saihoji-pines-v1/godot-layout-report.json)。同镜头原位置检查已完成，不把固定画面计数当 FPS。未重复整场战斗，r35 完整循环证据保持独立。

**上一批发现（已由上方本批承托处理）：两版截图均有岛边古松根部离开地面的原布局问题。** 本批刻意保留原根/地形，不能宣称六庭贴地、导航或地形布局已经验收；下一地形布局批需沿原庭园边界修正支撑。六庭碰撞与鲲背岛父节点未因换树改动。没有重启 r18/r24 用户窗口；主工程和既有隔离 q 已更新，旧窗口仍是其冻结版本。当前磁盘余量约 137 MB，后续导入先检查空间。


更新：2026-09-09。本文先完成原资产只读审计，随后持续补充真实 Godot 接入。**最新完整循环证据为 r35：原首落地反击时序、SOCCO 真后门、鲲 v2 和原实例恢复同场，670.8 秒完成原巡航终章；305 次真实命中、14 次吞入与排出，18 人出艇、15 生还回艇、3 人战死；20 项检查与重置通过。现有 r24 用户窗口保持不变。视觉/全部原规则仍未最终验收。** 路径均相对 TigerMessenger。

## 最新状态（先读这里）

- 入口：原世界的「进入苔庭之战」→ `godot/scenes/saihoji_battle_world.tscn` →「开始苔庭守卫任务」。战场提供本场静音、近看蓝军/鲲与返回原世界；返回前清理本轮。
- 真实证据：`artifacts/pipeline/saihoji-battle-world/report-r35.json`，305 次真实舰队命中、六档回落、14 次真实吞入与排出，一轮完成，reset 清空；`full_visual_gameplay_accepted=false`。不是补造命中或计时完成。23 项独立战斗/失败门槛检查通过；当前同版自然失败仍未验收。
- 三兵种六候选已在 Godot，脸型候选已随模型接入；长弓使用 assembly 射箭动作。**长矛投掷、短剑近战、运输尾门等完整动作仍需收口**，不能把所有候选静态姿势称为完整动画。
- 新鲲目标图及 Blender 下颌/喉囊已回接真实鲸吞，保留原鲲根、原运行背岛与六庭；顶点色漏开造成白块已修复。`native-r23-actual-swallow.png` 和 `native-r23-actual-expel.png` 是真实战斗吞入、排出画面；口腔材质与镜头仍需打磨。
- 地形根因已定位为原有机苔庭网格朝地底的绕序/法线；Godot 仅修副本方向，未移动任何地形顶点，Web 原工厂也已有独立回归。干燥连通站位从 0 恢复到 373 点，蓝军站位按原实际陆片分配，各兵种足偏从模型足部几何测量；不是抬海床。路径通行仍待完整检查。
- 原 BGM 已复制至 `godot/assets/audio/saihoji` 并接 `saihoji_battle_audio.gd`；17 项原生解码、优先级、单次/静音/重置及 SFX 检查通过。新增真实 CoreAudio 三首各 3 秒混音输出检查通过（见文末），主观全流程听验仍待，缺失的雷声资源没有假装存在。
- 现有目标图包括古松、鲲、主机、GatePod、SOCCO、重甲兵。古松候选已入 Godot 资产目录但尚不代表本战场所有种子/变体已替换；5 架主机、先锋重甲和三款 GatePod 候选已回接；重甲 161 帧是战斗/索降姿态，尚无完整 walk 步态。
- **明确剩余**：绳网/拔河耦合、完整舱门逐座索降与登艇、全世界巡航路径、同版自然失败游玩证据、真实听验，以及后续章节。电车原轨道距本登陆点约95米，超过原42米补兵门槛，不能用计时刷驻军冒充接通。

后面的库存逐项段落保留最初审计时的磁盘证据，其「待生成/未找到」属于历史状态；最新接入以本节和文末推进记录为准。

## 原始审计结论与范围（历史基线）

首个交付定义为 **Godot 原作苔庭的一轮正常战斗**：正常航线触发 → 运兵登陆 → 列阵与射击 → 舰队受击后才空降重甲兵 → 鲲鲸吞反抗 → 鲲落回 → 撤军 → 可重置。现有 `roman_combat_slice.tscn` 是短剑规则子集，不能代替此交付；`test_roman_combat_runtime.gd:121` 自述全局运兵、攻城路线、弹丸及原世界部署尚未移植。

原作模型与叙事需分开核对。用户现在希望蓝盔反抗，但现代码 **苔庭参战者先红缨，战役结束后换蓝缨再攻城**（`saihojiPhalanx.js:3439`）。实现蓝盔苔庭战时，应明确记录这项叙事调整，不能声称原代码本来如此。后续圣城攻城、木马夜袭本批不扩展，但保留交接事件。

## 本轮实战资产清单

| 资产/系统 | 实际 factory / 调用位置 | 本轮角色及接入约束 |
|---|---|---|
| 苔庭六景及地形 | `src/world/saihoji.js:552 buildSaihojiPlanet`；`src/scenes/saihojiGarden.js:81` | 入口苔径、主石、枯瀑、苔海岛群、空庭、回望石组；实际附着于鲲背，不能用独立鲸 GLB 覆盖整个复合场景 |
| 古松 | `src/assets/ancient.js createAncientPineTree`；`saihoji.js:612` | 六景核心植被、舰队吸取反馈对象；保留种子、×2场景体积与遮挡关系 |
| 园石、踏步、苔床、园路与土台 | `saihoji.js:224 createGardenStone`、`:263 createStoneStep`、`:479/:539/:595/:638` | 多为场景内部程序对象，未逐件独立优化；需与落地/阵位/镜头一起验收 |
| 登陆点、列阵空间、行进地表 | `saihojiPhalanx.js groundHeightAt/isAssembled/spawnWave`；`vanguardAssault.js getGroundHeightAt` | 球面方向+地表高度，地面兵不能跟随飞行舰队父节点；鲸背与岸边必须分开采样 |
| 鲲本体、胸鳍、尾、眼、浮岛壳 | `src/assets/leviathanIsland.js buildEcoLeviathanIsland`；`saihojiGarden.js` | ID `leviathanIsland`，与 `swamp_whale` 不同。原归档不含运行时六景；不能损失摆尾、眨眼、雨滴和升降 |
| 鲲下颌、喉囊、吞吐与挣扎 | `src/world/whaleMaw.js:365 createWhaleMaw`；`saihojiPhalanx.js:3211` | 原代码动态切分/变形，非独立已验收资产；范围26、容量3、张嘴0.9s/吸入2.6s/含住2.4s/排出1.8s/冷却9s。需保留敌人吞入、隐显、排出、短暂呆滞后归队 |
| 主莫比斯舰队 | `src/assets/moebiusAircraft.js:84/:500 createMoebiusAircraft/Squad`；`src/scenes/messenger/loadMoebius.js:136`附近 | 实际扫描/吸食主角；编队合计每50箭降一档吸取力，共6档/300箭。飞艇本身不因该规则下沉，鲲才回落 |
| GatePod 护航泡机×3 | `src/world/gatePodCraft.js mountGatePodEscort`；`loadMoebius.js:136`、`loadCitadel.js:305` | 实际随主舰的 escort，索降/麻醉攻击/接回；和叹息之门静态泡机不是同一部署身份 |
| SOCCO 运兵艇×3 | `src/world/gateHaulerCraft.js createSoccoCraft`；`loadCitadel.js:292–299` | 实际代码创建 SOCCO，而注释仍写 gateHauler。海面进场、尾门、卸兵与收绳；应以调用为准，不直接拿默认 hauler 代替 |
| GateHauler 三编号艇 | `gateHaulerCraft.js createGateHaulerCraft` | 已有独立归档，但本轮运输实际 factory 为 SOCCO；作为共同源与变体纳入库存，不计作另外三艘实战运输艇 |
| scoutAircraft 侦察机 | `src/world/planetV8/tripleGateScout.js createTripleGateScoutAircraft`；`src/world/scoutDefense.js`、`updateIsland.js:52` | 有护航/目标指示系统；不能仅从存在推断每场苔庭战都参与。需在实际航线记录本轮进入/攻击目标/退出；已有静态候选部署不等于战斗接入 |
| bubblePod 气泡艇 | `src/assets/bubblePod.js createBubblePod`；`loadMoebius.js:37/:98` | 水晶花楼周边3艇及书店艇，玩家可驾驶；原苔庭空降 getPods 读取 GatePodEscort，不读取 bubblePods。列为可介入/共用载具，非固定参战兵力 |
| 先锋重甲兵 | `src/world/vanguardTrooper.js createVanguardTrooper/createVanguardSquad`；`loadCitadel.js:284` | 当前 `VANGUARD_SQUAD_SIZE=27`；唯一花名册0..5为三台泡机各2人，6..26为三艇各7人、seat6留守看护；旧注释20/22人已过时。激光刀、闪电炮、破盾、弹反、受伤及撤离 |
| 罗马短剑红/蓝 | `src/assets/harbor.js createCitadelMeleeSoldier`；`saihojiPhalanx.js:578` | 原始头盔、裙甲、盾和剑引用保留；最新 Blender 六变体与脸型候选已存在并接入 Godot；动作及实场验收仍分项记录 |
| 罗马长矛红/蓝 | `harbor.js createHarborPatrolSoldier`；同上 | 列阵持盾、投矛、拉绳需同骨架验收；左前臂旋转用户已指出，不能只验静态图 |
| 罗马长弓红/蓝 | `harbor.js createLongbowSoldier/updateLongbowShot`；同上 | 七阶段弓弦/箭尾/握弓与放箭，必须用动作真实锚点；原始弦端存在偏差，不能作为正确姿势基准 |
| 古战船、桨、桨手 | `harbor.js createFisherBoat/updateWarshipOars/paintBoatCrewCrest/emptyBoatCrew`；`saihojiPhalanx.js spawnWave` | 两船、5×5队列/船、16秒船间隔；登陆不能只让甲板装饰消失而不生成同一批兵 |
| 羽箭、标枪、盾破、烟灰、闪电光圈 | `saihojiPhalanx.js`箭池150、投枪池与 `spawnSmoke`；`vanguardTrooper.js createBoltArcFx` | 动态生成材质/拖尾与命中回调，未独立归档不代表没有资产。重甲弹反与主舰命中不可混淆 |
| 拔河绳索、撒网、索降绳 | `saihojiPhalanx.js:3210`之后；`whaleMaw.js castNet`；`vanguardAssault.js` | 鲲身侧锚、士兵手端、船端均需动态跟随，鲸 update 之后再应用挣扎；不能只导出静态直线 |
| 吸取光束、飞叶、尘土、落档震颤 | `saihojiGarden.js:238/:369/:455`之后 | 使用同一 suction01 驱动光强、飞叶、鲲高度，落档时震颤/尘/闷响必须同步 |
| 红狐、湖沼之虎、送信人 | `loadCitadel.js:321`保护名单；玩家系统 | 是故事主体/被保护对象，不应被广域扫荡目标收集误杀；本轮苔庭战不把湖沼虎改作鲲或一般野生敌人 |
| 木马、守城兵、云梯 | `saihojiPhalanx.js siege/siegeNight` | 属下一段圣城战，当前只保留衔接与归档；不是本轮苔庭环境堆放物 |

## 原作正常流程与必须纠正的陷阱

1. 主舰真实航线接近苔庭，`saihojiGarden.js:410` 用切向角距判断 near/far，先暴雨前奏，再鲲升空。不是按调试按钮直接生成敌军。
2. `saihojiPhalanx.js:399`状态链为 atCastle → sailOut → fight → return → siege → siegeNight → done。鼓静1.6s后发船，船间隔16s；兵已离城后不再受鼓声控制。鲲起告警，射手排队、矛盾围护、拉绳与射击。
3. 主舰中箭/投枪才触发重甲：命中调用在 `saihojiPhalanx.js:969/:1125`。`vanguardAssault.js:1690 onFleetUnderAttack` 记威胁，3s节流；idle/done 请求开局。`:1955 requestStation`必须同时满足主舰存在、在当前地点停稳、此地未刚扫荡。战场来自主舰地面投影。进行中的任务不因连续箭雨重装填。
4. **发现一个实际回调缺陷**：上述两处命中将 `ac`（被打的飞机）作为 `attacker` 传入，但 `onFleetUnderAttack`把该参数登记为优先攻击威胁。Godot迁移应携带真正射手ID与受击舰ID，并核查Web回调；否则重甲威胁池可能指向己方飞机。
5. **兼容分支仍有自动空降**：`saihojiPhalanx.js:3802`在缺 `requestStation` 的旧后端按鲸起/成阵直接 begin/deploy。完整 Godot 不能照搬此 fallback，否则违反用户要求。
6. 重甲任务为 approach → insert → combat → withdraw → extract → done (`vanguardAssault.js:668/736/921/1246/1319`)。运载器与步兵需独立地面坐标。持续挨打可以还击但不能倒回装填；侦察指示 `designateTarget` 本身不能触发空降。
7. 主舰合计伤害计数由 `moebiusAircraft.js:1180`计算，每50箭削弱1/6吸力，300箭归零，`saihojiGarden.js:453`控制鲲阶梯回落；同时拉绳、尘土与音效。鲲吞吐只能作用于嘴前方合格重甲兵，容量/冷却受限，吞入后必须能恢复归队，不是删除对象。
8. 鲲 lift<0.03 时 `whaleReturned()` 仅一次。士兵原代码换蓝缨，原地3.2s可见后登船。原舰队离开 → 终扫一次 → 再离开才清 arrowHits、storyPhase恢复0（`saihojiGarden.js:504–525`）。不能一落地立即满吸力再升起。
9. 硬 reset 是另一路：`saihojiPhalanx.js:1146`清绳/阵列/船/驻军/弹丸并复位 atCastle；不能把它当剧情结尾。Godot需同步鲲、主舰、重甲、音乐及所有临时对象，测试第二轮没有残留/重入。

## BGM 与音效交给 Godot 的具体清单

重用原配乐迁移，不需要重新生成一首。原入口 `src/audio/sfx.js`。最初审计时 Godot 尚无配乐；现已迁移到 `godot/assets/audio/saihoji`，17 项原生检查通过，实际听验仍待。原 mp3 后缀资源实际为 Ogg，保持编码复制为 .ogg，未转码。

| 事件 | 原资源/入口 | Godot对应行为 |
|---|---|---|
| 鼓声与潜入任务 | `music/鬼太鼓座-大太鼓.mp3`、`isInfiltrationMissionActive` | 保留发船许可状态；音乐停止与剧情任务结束不可混为一谈 |
| 方阵警报 | `cuePhalanxAlarmOnce/rearmPhalanxAlarm` | 单次告警，重置后可再次响 |
| 鲲起前奏 | `music/CV君言君与-狂风暴雨.mp3`、`cueLeviathanStormOnce` | 前奏只触发一次，不能每帧重播 |
| 鲲升空风暴 | `music/The Original Movies Orchestra (电影原声带)-Terminator 2.mp3`、`setLeviathanStormBgm` | 一次播完不重复，本轮升空 Done 标记阻止每帧重播；收飞才复位。早期注释“循环”已过时，以实际播放器 loop=false 为准 |
| 主舰突击 | `music/徐嘉良-战 (大提琴版).mp3`、`setFleetAssaultBgm` | 由突击任务状态控制；苔庭前奏/Terminator 2 优先，本曲让位（潜入/电车也阻止起播），收队淡出 |
| 玩家气泡艇开炮 | `music/黄英华-Opening.mp3` | 仅实际玩家炮击条件，非所有泡机出现就播放 |
| 后续蓝盔攻城 | `music/Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3` | 保留后续交接，本轮不凭苔庭结束提前触发攻城音乐 |
| 雷、鲸落档、弓箭/刀/炮/盾/水/绳 | `纯音乐-雷声闪电.mp3`及 `sfx.js`合成/采样调用 | 分BGM/SFX/Ambience总线；距离衰减、并发限制、暂停/重置清理；合成声需要导出或原生重建，不能只复制mp3 |

磁盘核对：上表六个具名BGM文件均存在，但 `music/纯音乐-雷声闪电.mp3` **不存在于该引用路径**，需要定位真实文件或明确补建，不能静默当作已接音效。原BGM文件存在不等于Godot播放已通过；仍需实际听验淡变、重复触发和退出残音。

## 按目标图推进的优先级

- **P0 先完成共同兵体**：三兵种已有目标图（下表），六变体和本次脸型候选已接入。继续用真实射箭、持盾/投矛/拉绳动作验收；静态候选完成不等于全部动作完成。
- **P0 鲲**：先生成同一生物的全身、张嘴/喉囊、鲸背六景三视目标，参考真实鲸解剖+原作浮岛布局；不能生成普通鲸替代六景。模型、动作、吞吐反馈同一批交付。
- **P0 主舰+GatePod护航+SOCCO+重甲兵**：每家族统一目标图，再出建模/舱门/武器/挂绳锚点；让扫描吸取、麻醉、空降、地面反击都可读。
- **P1 苔庭环境套件**：古松近景/剪影、园石踏步、苔床与登陆/阵列整体构图分别目标图；先调整通行和战场镜头，避免树盖住行动。
- **P1 战船与特效**：战船/船员/桨与登船参考图；吸取/鲸吞/弹丸/破盾/绳网使用效果分镜图。动态特效不强制建成不可动画的单一GLB。
- **P2 侦察机已有图再实战迭代；bubblePod与默认gateHauler有真实介入需求后推进**。不能为了库存数字把未参战载具刷入本轮。

## 最初审计记录的 Godot 缺口（历史；最新见顶部和文末）

- `godot/scripts/original_world.gd`具有原世界静态加载与部分候选替换；这不是苔庭故事状态机。
- `godot/scripts/roman_combat_runtime.gd`及 `roman_combat_adapter.gd`是可复用短剑近战子集；`test_roman_combat_runtime.gd`覆盖自主命中/伤亡，明确未覆盖全局运输、弹丸与部署。
- 三兵种最新 Blender 模型已出 review 页面，但这批文件不能视为Godot已替换或完整动画已验收。
- 鲲六景附着、地表随动、航线吸取、受击空降、撤军/归队、音乐优先级目前没有本次审计可引用的完整 Godot 闭环证据。
- 首轮需录屏与事件日志互证：玩家正常靠近/任务触发；每个士兵来源与登船/下船一致；无受击不空降；一发真实命中触发一次；连续命中不反复空投；鲲吞吐3人上限/9s冷却；六档回落；撤军可见；离开-终扫-离开复位；第二轮状态和音频没有残留。调试刷兵只用于局部诊断，不计首轮通关。

## 初始库存逐项证据（保留历史磁盘/注册表核对，不代表最新状态）

下列原始归档、候选、图与Godot资源路径逐项列出。注册表 `stages` 是历史记录，可能落后于新候选；文件存在只证明产物存在。batch-candidates-v2 是整理候选，**没有新目标图视觉验收不称美术优化**。Godot `res://` 路径对应项目 `godot/`；`stages.artOptimized=false` 不因有GLB自动改true。

### pine · 古松

- 原工厂：`(opts = {}) => createAncientPineTree(opts.seed)`；代码：`src/assets/ancient.js`。
- 原始snapshot：`assets/models/originals/pine.source.json`（存在）。
- 原始blend：`assets/models/originals/blender-r3/pine.blend`（存在）。
- Blender候选：`assets/models/optimized/batch-candidates-v2/pine.blend`；`assets/models/optimized/batch-candidates-v1/pine.blend`。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/originals/pine.glb`；replacement状态：`none`；原世界匹配记录25条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### saihoji · 西芳寺·苔海

- 原工厂：`(opts = {}) => {
      const g = new THREE.Group();
      buildSaihojiPlanet(g, {});
      return g;
    }`；代码：`src/world/saihoji.js`。
- 原始snapshot：`assets/models/originals/saihoji.source.json`（存在）。
- 原始blend：`assets/models/originals/blender-r3/saihoji.blend`（存在）。
- Blender候选：`assets/models/optimized/batch-candidates-v2/saihoji.blend`；`assets/models/optimized/batch-candidates-v1/saihoji.blend`。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/originals/saihoji.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### leviathanIsland · 鲲

- 原工厂：`buildEcoLeviathanIsland`；代码：`src/assets/leviathanIsland.js`。
- 原始snapshot：`assets/models/originals/leviathan/leviathanIsland.source.json`（存在）。
- 原始blend：`assets/models/originals/leviathan/blender-r3/leviathanIsland.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/leviathanIsland.glb`；replacement状态：`not-started`；原世界匹配记录1条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### moebiusAircraft · 莫比斯飞碟

- 原工厂：`() => createMoebiusAircraft()`；代码：`src/assets/moebiusAircraft.js`。
- 原始snapshot：`assets/models/originals/moebiusAircraft.source.json`（存在）。
- 原始blend：`assets/models/originals/blender-r3/moebiusAircraft.blend`（存在）。
- Blender候选：`assets/models/optimized/batch-candidates-v2/moebiusAircraft.blend`；`assets/models/optimized/batch-candidates-v1/moebiusAircraft.blend`。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/originals/moebiusAircraft.glb`；replacement状态：`none`；原世界匹配记录5条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### bubblePod · 气泡座舱

- 原工厂：`() => createBubblePod({})`；代码：`src/assets/bubblePod.js`。
- 原始snapshot：`assets/models/originals/bubblePod.source.json`（存在）。
- 原始blend：`assets/models/originals/blender-r3/bubblePod.blend`（存在）。
- Blender候选：`assets/models/optimized/batch-candidates-v2/bubblePod.blend`；`assets/models/optimized/batch-candidates-v1/bubblePod.blend`。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/originals/bubblePod.glb`；replacement状态：`none`；原世界匹配记录3条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### scoutAircraft · 三重门侦察机

- 原工厂：`createTripleGateScoutAircraft`；代码：`src/world/planetV8/tripleGateScout.js`。
- 原始snapshot：`assets/models/originals/supplemental/scoutAircraft.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/scoutAircraft.blend`（存在）。
- Blender候选：`assets/models/optimized/scoutAircraft-art-v1.blend`。
- 目标图：`assets/concepts/scoutAircraft-target-v1.png`。
- Godot归档：`res://assets/supplemental/scoutAircraft.glb`；replacement状态：`godot-review-candidate`；原世界匹配记录5条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false, "staticWorldDeployed": true}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### soccoCraft · 先锋兵登陆艇（货舱与活动尾门）

- 原工厂：`createSoccoCraft`；代码：`src/world/gateHaulerCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/soccoCraft.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/soccoCraft.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/soccoCraft.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### vanguardTrooper · 先锋重甲兵

- 原工厂：`createVanguardTrooper`；代码：`src/world/vanguardTrooper.js`。
- 原始snapshot：`assets/models/originals/supplemental/vanguardTrooper.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/vanguardTrooper.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/vanguardTrooper.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodCraft_pod-55-2 · 泡形侦察艇 pod-55-2

- 原工厂：`createGatePodCraft`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodCraft_pod-55-2.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodCraft_pod-55-2.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodCraft_pod-55-2.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodCraft_pod-41-7 · 泡形侦察艇 pod-41-7

- 原工厂：`createGatePodCraft`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodCraft_pod-41-7.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodCraft_pod-41-7.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodCraft_pod-41-7.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodCraft_pod-08-9 · 泡形侦察艇 pod-08-9

- 原工厂：`createGatePodCraft`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodCraft_pod-08-9.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodCraft_pod-08-9.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodCraft_pod-08-9.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodEscort_pod-55-2 · 伴飞泡机（含麻醉炮口） pod-55-2

- 原工厂：`mountGatePodEscort`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodEscort_pod-55-2.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-55-2.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodEscort_pod-55-2.glb`；replacement状态：`none`；原世界匹配记录1条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodEscort_pod-41-7 · 伴飞泡机（含麻醉炮口） pod-41-7

- 原工厂：`mountGatePodEscort`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodEscort_pod-41-7.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-41-7.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodEscort_pod-41-7.glb`；replacement状态：`none`；原世界匹配记录1条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gatePodEscort_pod-08-9 · 伴飞泡机（含麻醉炮口） pod-08-9

- 原工厂：`mountGatePodEscort`；代码：`src/world/gatePodCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gatePodEscort_pod-08-9.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-08-9.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gatePodEscort_pod-08-9.glb`；replacement状态：`none`；原世界匹配记录1条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gateHaulerCraft_hauler-71-4 · 重型运输艇 hauler-71-4

- 原工厂：`createGateHaulerCraft`；代码：`src/world/gateHaulerCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gateHaulerCraft_hauler-71-4.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gateHaulerCraft_hauler-71-4.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gateHaulerCraft_hauler-71-4.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gateHaulerCraft_hauler-23-8 · 重型运输艇 hauler-23-8

- 原工厂：`createGateHaulerCraft`；代码：`src/world/gateHaulerCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gateHaulerCraft_hauler-23-8.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gateHaulerCraft_hauler-23-8.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gateHaulerCraft_hauler-23-8.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### gateHaulerCraft_hauler-96-1 · 重型运输艇 hauler-96-1

- 原工厂：`createGateHaulerCraft`；代码：`src/world/gateHaulerCraft.js`。
- 原始snapshot：`assets/models/originals/supplemental/gateHaulerCraft_hauler-96-1.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/gateHaulerCraft_hauler-96-1.blend`（存在）。
- Blender候选：未找到本ID优化候选。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/supplemental/gateHaulerCraft_hauler-96-1.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。

### romanSoldier_spear_red · 罗马羽冠兵 spear red

- 原工厂：`createHarborPatrolSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_spear_red.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_spear_red.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_spear_red.blend`。
- 目标图：`assets/concepts/roman-spearman-target-v1.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_spear_red.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}}`。

### romanSoldier_spear_blue · 罗马羽冠兵 spear blue

- 原工厂：`createHarborPatrolSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_spear_blue.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_spear_blue.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_spear_blue.blend`。
- 目标图：`assets/concepts/roman-spearman-target-v1.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_spear_blue.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}}`。

### romanSoldier_gladius_red · 罗马羽冠兵 gladius red

- 原工厂：`createGladiusSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_gladius_red.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_gladius_red.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_gladius_red.blend`。
- 目标图：`assets/concepts/roman-soldier-target-v2.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_gladius_red.glb`；replacement状态：`godot-concept-armor-grip-review-candidate`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}, "godot": {"status": "original-combat-rule-subset-tested", "adapter": "res://scripts/roman_combat_adapter.gd", "runtime": "res://scripts/roman_combat_runtime.gd", "scene": "res://scenes/roman_combat_slice.tscn", "globalEligibleGladiusActors": 0, "globalDeployment": false}}`。

### romanSoldier_gladius_blue · 罗马羽冠兵 gladius blue

- 原工厂：`createGladiusSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_gladius_blue.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_gladius_blue.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.blend`。
- 目标图：`assets/concepts/roman-soldier-target-v2.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_gladius_blue.glb`；replacement状态：`godot-concept-armor-grip-review-candidate`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}, "godot": {"status": "original-combat-rule-subset-tested", "adapter": "res://scripts/roman_combat_adapter.gd", "runtime": "res://scripts/roman_combat_runtime.gd", "scene": "res://scenes/roman_combat_slice.tscn", "globalEligibleGladiusActors": 0, "globalDeployment": false}}`。

### romanSoldier_longbow_red · 罗马羽冠兵 longbow red

- 原工厂：`createLongbowSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_longbow_red.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_longbow_red.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_longbow_red.blend`。
- 目标图：`assets/concepts/roman-archer-target-v1.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_longbow_red.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}}`。

### romanSoldier_longbow_blue · 罗马羽冠兵 longbow blue

- 原工厂：`createLongbowSoldier + paintSoldierHelm`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/supplemental/romanSoldier_longbow_blue.source.json`（存在）。
- 原始blend：`assets/models/originals/supplemental/blender-r3/romanSoldier_longbow_blue.blend`（存在）。
- Blender候选：`assets/models/optimized/roman-family-v1/romanSoldier_longbow_blue.blend`。
- 目标图：`assets/concepts/roman-archer-target-v1.png`。
- Godot归档：`res://assets/supplemental/romanSoldier_longbow_blue.glb`；replacement状态：`none`；原世界匹配记录0条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：`{"web": {"status": "shared-armor-integrated-program-verified", "source": "src/world/saihojiPhalanx.js", "familyGuide": "docs/ROMAN_FAMILY_INTEGRATION.md", "scope": "88 family checks passed; bow headwear regression resolved; original lower-string/skirt contact and full body geometry remain unaccepted"}}`。

### fisherBoat · 古战船

- 原工厂：`() => createFisherBoat()`；代码：`src/assets/harbor.js`。
- 原始snapshot：`assets/models/originals/fisherBoat.source.json`（存在）。
- 原始blend：`assets/models/originals/blender-r3/fisherBoat.blend`（存在）。
- Blender候选：`assets/models/optimized/batch-candidates-v2/fisherBoat.blend`；`assets/models/optimized/batch-candidates-v1/fisherBoat.blend`。
- 目标图：当前 concepts 目录未找到本项专用目标图；待生成。
- Godot归档：`res://assets/originals/fisherBoat.glb`；replacement状态：`none`；原世界匹配记录1条（不等于本战役部署）。
- 注册表阶段：`{"captured": true, "blenderArchived": true, "glbExported": true, "godotInstantiated": true, "artOptimized": false, "worldIntegrated": false, "gameplayAccepted": false}`。
- Web/Godot动态状态：Web由上述原代码生成；本项没有注册表动态优化回接记录，Godot完整战斗状态未知/未验收。


## 已实现的 Godot 状态核心接口（独立测试，不等于场景接入）

实现：`godot/scripts/saihoji_battle_director.gd`。测试：`godot/tests/test_saihoji_battle_director.gd`。
证据：`artifacts/pipeline/saihoji-battle-director/report.json` 与 `test.log`，隔离临时Godot 4.7.2工程42项通过；没有打开前台或动原工程导入缓存。

### 所有权与输入

核心是 Node，只管理状态与发出 `event_emitted(Dictionary)`，不创建兵、不移动船、不判命中、不播放声音。每条事件含 `type/round_id/time`。adapter须按round_id清理旧回调，`reset`后取消旧弹丸/船异步任务，不能把上一轮回报送入新轮。

- `configure(fleet_ids:Array, blue_ids:Array, heavy_ids:Array) -> bool`：唯一非空String实体ID，不允许跨阵营复用；运行中不可重配。
- `start() -> bool`：开始正常流程；`stop(reason)`终止并发cleanup；`reset()`清临时计数、船/命中/音乐意图并发cleanup，保留注册ID；`snapshot()`只读副本。
- `tick(delta, observation)`：由真实原场景每帧输入 `fleet_present:bool`、`fleet_ground_dir:Vector3单位方向`、`near/far:bool`（由真实球面角距判断）、`drum_active:bool`、`whale_lift:float[0,1]`（真实变换测量）。未给鼓声默认为active，不能误发船。
- `report_landing(ship_id)`：只接受已发出请求的 `saihoji-warship-0/1`，两次真实到岸后才fight；同船重报拒绝。
- `report_formation_ready()`：真实单位已落地列阵后调用；核心定时器不能替代这个条件。
- `report_fleet_hit(event_id, shooter_id, aircraft_id, kind="arrow")`：真实碰撞命中后调用，kind只收arrow/javelin，事件ID去重；明确分离攻击士兵与受击舰，修正原威胁错登记。重甲部署只能从此入口请求，计时器/鲲升起/列阵都不触发。
- `report_assault_stage(next_stage)`：真实approach到位后报insert，索降/卸兵完成报combat，实际撤离报withdraw、extract、done；拒绝跳过阶段。舰队在场、26单位内停稳3秒、此站150秒冷却判定在核心，敌人/艇位置在adapter。
- `report_whale_swallow(event_id, enemy_ids)`：adapter先判嘴前锥体、26单位距离、活体/可吞状态，再回报实际捕获；核心验证注册敌人、至多3人、重复ID和9秒冷却。吞吐动画/排出归队在adapter。
- `report_withdrawal_complete()`：真实士兵登船撤离结束；核心还要求鲲落回、舰队离开-终扫-离开与重甲完成才round_completed。

### 输出事件

`ship_departure_requested`（含ship_id）、`formation_requested`、`resistance_enabled`（目标舰IDs）、`assault_requested`（主舰地面direction、真正threat_ids、heavy_ids）、`suction_changed`（50箭一档，6档）、`whale_lift_requested`（目标高度比例）、`whale_swallow`、`whale_returned`、`withdrawal_requested`（3.2秒可见列阵）、`round_completed`、`cleanup_requested`。

`bgm_intent.cue` 值为 `kun_prelude_once / kun_storm_once / fleet_assault / ""`。意图变化只发一次，`restart=false`；adapter使用现有原BGM资源，once曲结束不因状态仍active重播；不要把empty当作暂停所有环境音。

### 测试实际覆盖与未覆盖

42项含ID重复/不可变、未发船不能登陆、timer不能伪造登陆、鲲升及列阵不自动空降、同命中去重、攻击者必须蓝兵、真实威胁ID、不得跳过索降、鲸吞容量/敌我/冷却、300真实输入命中产生6档、物理鲸落回才撤军、连续箭雨不反复空投、站点冷却、实际登船条件、清理复位与停止拒绝晚到输入。测试输入是模拟观察与显式事件，**未覆盖实际世界几何、碰撞命中、音乐听验或真实整轮游玩**；需要根任务的原场景adapter完成。


## 原生实场推进记录（2026-09-09，r12）

以下是后续实现证据，不覆盖上文归档时的历史状态。**原生一轮物理闭环已取得，视觉和全套原战斗规则尚未验收。**

- 实场：`godot/scenes/saihoji_battle_world.tscn`；适配实现：`godot/scripts/saihoji_battle_world.gd`；规则核心：`godot/scripts/saihoji_battle_director.gd`。
- 保留原世界 GLB 的鲲根、动态背岛和真实六庭、5 主机、3 原护航舱、95 个原地形碰撞网格。球面射线落地无 fallback；这只证明碰撞成立，**不证明水面以下落地点适合站立**。
- 六个优化罗马候选从 `godot/assets/roman-family-v1` 接入；同一名士兵从甲板下船到战斗，使用 assembly 动作。非 GLB 自带动画。
- 原两艘 5×5 战船，静鼓 1.6 秒后调度，间隔 16 秒；新增忠实源战船补给，部署后 20 秒首船，随后每 30 秒，最多 6 艘 3×3，每艘实际沿原航段靠岸。共 104 唯一蓝军 ID，未直接刷入阵列。原 `roleAt` 在 3×3 中仍引用 5×5 中心，保留源实际比例。
- 真实箭/矛跟踪抛物弧、几何连续命中与原地形遮挡。源冷却、飞行时长、散射保留；不能使用先前临时更快射速试验来声称完成。
- 重甲 3 条命，分别累计 20 箭 / 10 矛 / 15 近战才各损一命，伤害类别不混算；首刀破盾不伤身、下一刀倒地；两次闪电命中倒地；1.55 秒充能、0.18 秒放电、0.85 秒冷却。uint32 `vtHash` 与直接运行原 JS 函数的 4 个样例逐值一致。受击记仇 9 秒、7 米同伴传播 6.3 秒已接。
- 重甲必须由真实主机受击触发；降落点按当次主机地面投影设置，修复“核心记另一站，实际却总落苔庭”的适配错误。运输艇留场接回人后才离开，修复先飞走导致索降兵永远追不上的撤离卡死。
- 鲲候选 `godot/assets/kun-battle-v1` 的原 n1 身体和新增下颌/喉囊回接；原运行眼、背岛与六庭保留，未叠加第二只鲸。下颌与四种 morph 由真实吞噬事件驱动，reset 清零；候选导入有 4 条缺 UV 无法生成 tangent 日志，运行未发现脚本错误。结构回接不等于颜色验收。
- 原 BGM 与音效已交给 `saihoji_battle_audio.gd`：序曲、单次主曲、舰队曲让位和清理；告警接 `resistance_enabled`，六档真实回落接 `suction_changed`。使用原来源音轨，未重新作曲。

### 可重复证据及边界

`artifacts/pipeline/saihoji-battle-world/report-r12.json`：486.8 秒完成一轮，309 次真实主机命中、6 档回落、9 次实际吞噬、2 次受击部署、六艘补给到岸、全部战船实际返航、舰队离开后结束。14 项身份/几何/事件检查通过，reset 清空演员。`full_visual_gameplay_accepted` **仍为 false**。

`godot/tests/test_saihoji_combat_rules.gd` / `combat-rules.log`：18 项独立规则检查通过；`source-hash-oracle.json` 来自直接执行原 JS 哈希函数。`test_saihoji_battle_world.gd` 使用固定步长推进实际运动与碰撞，没有注入命中或登陆事件；不是用户实时完整游玩验收。

保留失败证据：r2/r3 的早期成功用了临时射速且地面全部 fallback，不能当正式成果；r5 修复真实地形后 204 命中即败，r10 114 命中卡撤离，r11 181 命中未结束。r12 成功来自原补给与正确投影/撤离，而非补造第 300 次命中。

GPU `native-r12-84.png` 已暴露鲲本体纯白及旧海面缺失问题；现正在补候选顶点色开关与原 ocean shader，不将此图算美术验收。

### 电车补兵：当前原布局不满足触发距离

独立原代码导出器 `tools/pipeline/export_saihoji_tram_routes.mjs` 在浏览器直接调用 `buildChristchurchTramSystem`，输出 `godot/data/saihoji-tram-routes.json`。两条曲线各 4096 个等弧长采样，源速度 7，长度 1056.215 / 1052.268。对当前苔庭登陆点最近距约 96.62 / 94.90，远超 `tryTramDrop` 的 42 阈值。因此不能靠计时往苔庭刷驻军来宣称电车已打通。下一步应明确选择轨道支线或真实接驳运输，并结合全局球面布局验收；本轮战船补给已成立，不悄悄改电车距离门槛。

### 仍需原规则和画面收口

1. 原海面/地形岸线恢复及实际站立点水位检查；原 ocean 材质由 root 的 `saihoji_water_adapter.gd` 提供。
2. 鲲候选游戏内顶点色、下颌/喉囊实际吞吐画面对照，原翅鳍与身体材质一致性。
3. 原 SOCCO 尾门逐座卸载、护航舱分人索降/回收的原节拍和动作；当前是实际移动的简化调度，不能说全部原动画已移植。
4. 原绳索四队、撒网、挣扎和拉力耦合；当前鲸吞有真实控场，绳网仍缺。
5. 原主舰完整巡航排程：当前为独立来回/驻留候选，尚不是所有世界景点航线迁移。
6. 原重甲明确威胁优先级、护盾弹反概率精确核对与各种动画细节；现已登记实际射手 ID，不再误登记受击主机，但目标选择仍需完整对照。
7. 原电车驻军的实际可达运输方案；新增松树候选只按匹配 seed/variant 替换，不用一棵模板覆盖原森林。
8. 用同版代码验证可赢、正常战败与停止/重开；目前 r12 胜利及 reset 通过，历史 r5 失败不代替最新版失败路径验收。


## r18 可交互验收窗口（冻结快照）

已打开独立游戏窗口，未自动开始战斗，原活动 Godot 工程未修改：

- 工程：`/var/folders/n7/kzrzmcl11nz_2g29sqbjtd980000gn/T/TigerMessenger-saihoji-review-r18-r6burp81`
- 启动 PID：94838（只表示启动记录；进程关闭后不可视作仍在运行）。
- 程序：`/Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot`，参数 `--path <上述工程> --rendering-method gl_compatibility --position 120,100 --resolution 1440x900 res://scenes/saihoji_battle_world.tscn`。
- 完整启动参数及日志：`artifacts/pipeline/saihoji-battle-world/review-r18-session.json`、`review-r18-runtime.log`。
- 原世界 → 战场（等待用户开始）→ 原世界三段真实场景路由已在此完整隔离工程运行通过，见 `review-r18-routes.log`。场景提供开始、停止/复位、静音、近看阵列、看鲲、返回原世界。
- 此快照明确仍缺新干地布局下的主动鲸吞，不能拿旧版吞噬计数替代。下一版正在另一隔离工程接转向反抗及新重甲/主机；不修改/关闭本验收窗口。
- `native-r18-report.json.samples["64"].feet`：50 名站立蓝军足底半径 160.670–161.499，全部高于原海面最高波浪 160.567。站位成立；下船、追击全路径仍需游玩检查。
- `combat-rules-r18.log`：23 项规则测试通过，新增 5 项失败收束的反例保护（后续补给、在途船、在途弹、存活防空单位不提前失败）。此为谓词测试，**不替代同版自然战败实场证据**。


### r19–r20 新候选接入与反抗动作（进行中）

- r19 原世界实运行已接入先锋重甲 161 帧局部矩阵姿态和 5 架莫比斯新模型，保留原外部运动根、原节点及战斗数值。r19 正常一轮得到 304 次真实舰队命中并完成，14 项结构检查通过；证据 `artifacts/pipeline/saihoji-battle-world/report-r19.json`。这不代表全部动作/观感验收完成。
- 新干燥阵地中鲲仍没有成功吞入：`swallow-geometry-r19.log` 在 84 秒确认敌人距鲲根切向约 10.3–15.4 米，而嘴前伸约 15 米；敌人在嘴后方，原锥体阈值正确拒绝。不能用扩大范围或移动敌人来修。当前实现有限真实后撤蓄势，最多 10 米、2 米/秒，径向高度继续由吸力控制，整根及背岛六庭跟随；保留 26 米范围、dot > .15、容量 3 和原冷却。尚待新一轮真实吞入、排出及画面证据。口部扫掠仅局部净空检查，不能当成完整鲲身体碰撞。
- 三款 GatePod 新候选与腹部导绳孔已接工作源码，等待下一轮隔离实测；实际绳索从导绳孔到重甲握绳点，双兵向两侧分开，不再以同一艇中心作绳端。斜绳、兵体与全艇净空仍待检验。
- 音频增加了真实 CoreAudio 混音输出证据（`artifacts/pipeline/saihoji-battle-audio/mixer-report.json`）：三首各取 3 秒输出，每首约 12–13 万帧，RMS .022–.060、峰值低于 .39、无削波，reset 后尾音为零；独立进程静音测试未改变系统音量。主观听感与完整战斗曲目衔接仍待实际窗口验收，不能把短段输出验证称作整曲已听。


#### r20 后撤反抗实际结果

`report-r20.json` 正常启动一轮实际获得 310 次舰队命中、6 次吸力下降、2 次受击后部署，完成撤军并通过 reset。新干燥阵地上第一次真实吞入发生在 75.48 秒，全轮 10 次吞入；第三次 93.85 秒吞入 3 人，范围与锥体不变。14 项既有结构检查通过。此版只加入真实缓慢后撤与原朝向恢复，尚未加入向前突进；口部局部净空不等于完整身体扫掠。

**仍明确缺口**：先锋 161 帧是站立、瞄准、斩击、受击和索降姿态，没有完整 walk 步态；地面移动仍可见整体滑行。蓝盔弓箭动作已按原帧事件运行，短剑/长矛的完整动态握持还需要进一步实战视角验收。不能把 poseFrames 数量当作完整步态完成。r21 接入双导绳孔候选后正在做同镜头实际索降、开口、吞入与排出截帧。r18 可见验收窗口保持不变。


#### r23–r24 真实嘴部与导绳画面

- `native-r23-actual-swallow.png` / `native-r23-actual-expel.png` 是正常战斗实截，实际人员进入嘴后又排出；不是播放展示动画。`native-r23-report.json` 112 秒观察包含 4 次真实吞入，三款 GatePod 视觉 adapter 匹配成功，无加载错误。
- `native-r23-actual-ropes.png` 实际显示双导绳口到两名分开索降的重甲。r22 曾发现斜绳显示成横杆，原因是按全局 Y 缩放柱体；r23 改成沿局部绳方向构造长度。`line-geometry-r23.log` 三个方向的柱体端点误差均为 0、退出干净。
- `rope-endpoints-r24.log` 读取实际 6 名人员在索降姿态中的掌心与绳握点，差距仅 0.0000076–0.0000133 米，绳两端与导绳孔/掌心误差最多 0.0000153 米。画面手与炮的重叠不能被误判为挂点错误；反之该端点测试也不能替代全程绳索/机身/身体净空检查。
- 画面仍需改善：鲲口腔内材质较平、战斗镜头中吞入人员较小；重甲缺完整行走步态，蓝兵武器全动作握持尚待近景。当前不是最终视觉验收。


#### r24 最新合体完整循环收口

`report-r24.json` / `native-r24.log`：正常启动，486.8 秒完成；308 次真实舰队命中、9 次真实吞入与 9 次对应排出、6 档回落、2 次受击后部署、2 初始船和 6 补给船真实到岸。五主机/新先锋/三款 GatePod/鲲候选实际同场运行，14 项结构检查与 reset 清场通过，无运行脚本错误。所有既有视觉/完整规则缺口仍保留；`full_visual_gameplay_accepted=false`。

用户可见 r18 验收窗口未被关闭或更新；r24 最新工程在独立测试目录，需父任务按验收节奏决定切换可见版，避免反复打断正在查看的窗口。


### SOCCO 原后门与座位接入（r25–r29，未验收）

- 新 `godot/scripts/saihoji_socco_transport.gd` 使用 `godot/assets/socco-craft-v1` 的 127 原节点、原 14 锚点与本战 active `[0,1,2,4,5,8,9]`。每艇 6 人卸载、1 人留守，三艇加三 GatePod 双人仍为原 27 编成。
- 舱门按 n87 原铰链开合，使用真实地形求坡度，后排按自己车道先出，过门后再分散；回艇按相反占位顺序。船体/坡道脚下支持从新重甲实际足部最低角点与原模型三角面检测，并接真实地面。没有添加行走步态或脚 IK，静态脚跨阈值的姿态仍有限制。
- r25 首测足部节点被误当 mesh（实际是包含 mesh 的 Node3D）而中断提取，明确失败；r26 又发现径向贴地会把艇内路径 XZ 拉回，修为沿艇上方向的真实地面射线，保存路径 XZ。失败日志保留。
- r28 观察到 18 人真正在开门后依序走出，300 秒时已有 16 人走回，正常战斗达到 300 命中和回落。但近景 `native-r28-actual-socco-exit.png` 显示局部丘陵穿过坡道/舱底，故不算完成。r29 扩展靠泊检测到整舱底和坡道全段，正在验证；绝不抬地或隐藏原地形解决穿模。
- 原舰队第二次部署位置在远处海洋时，新后门靠泊会检查实际干地并拒绝不可达着陆，装载人员随艇撤回；不得像旧简化路径那样在海面生成地面兵。

#### 可见验收窗口

r24 冻结版已独立打开，当前 PID **99909**，标题「TigerMessenger · 苔庭之战 · r24 新模型验收」，停正常开始页。路径与命令在 `review-r24-session.json`。它不含尚未验收的 SOCCO 新路径；r18 原窗口未动。后续不再随自动测试重启这些验收窗口。

#### 真实渲染计数（不是 FPS）

`native-r28-report.json.render_samples`：开始画面 11,545 draw calls / 246,335 primitives；110 秒战场镜头 31,655 draw calls / 581,896 primitives、31,674 场景节点；近看索降仍 5,916 draw calls。这是实际 GPU 渲染帧的监视器计数，固定步长快跑不能用作实时帧率。绘制调用过多是明确可玩性能缺口，需在保持动作节点、船/鲲/兵独立的前提下处理原世界静态合批/重复材质。


#### r29 后门循环的实际证据与测试修正

`report-r29.json`：328.85 秒正常完成，300 次真实命中、6 次吞入与 6 次排出、18 名 SOCCO 卸兵逐座出门并 18 名逐座回艇，3 名守卫始终留艇。整舱底/全坡道取样后，实际坡角约 -12.15°、-4.66°、+6.11°；地形位置不变，失去支撑次数为 0。

此版旧测试整体显示 false，唯一失败断言是强制「六条补给船全部到岸」：实际战斗已提前结束，只调度了 4 条、总蓝兵 86 人。原规则是**最多六条**，不能为了测试另刷两条船。下一测试改为核对所有实际调度的船数、唯一身份与真实到岸事件，并增加原 14 座锚、真实出入门、幸存者归艇、关门、脚下真实支持的检查。

同时下一版修正离场的旧简化路径：关门后按实际当前位置逐帧飞回机队，不能用「自接近开始的总时间」把船一下移回机队。用户验收窗口不变，尚待新坡道 GPU 同镜头与最新回航版的最终循环检查。


### r31–r35 首落地反击、鲲 v2 与真实性能

- SOCCO 门控/返航版 r31 的 19 项检查与 reset 通过，但 GPU 首吞镜头发生在 298 命中、鲲已降到水下，暴露原战斗移植时序错误：原 `vanguardAssault.js:909` 第一人落地即 deployed，`vanguardTrooper.js:619/633` 的战斗只检查 deployed 与 onGround，不等待整个 assault=combat。已让实际落地者在卸兵期间按原武器规则反击，仍全员完成登陆才进入阵型推进计时。
- 鲲现在能对实际落地敌军及时反抗，`native-r34-actual-swallow.png` 首次实吞仅 90 次舰队命中、1 档下降，鲲在海面上；没有抬鲲、扩范围或改胜利阈值。原拔河 `pull > .35` 的完整绳队耦合依然是明确缺口，不能把当前反击表现称作原拔河系统全复刻。
- 新 `kun-battle-v2` 内喉和下颌 morph 按原正弦/余弦契约接入；原 295 节点、原背岛/六庭不动。单资源 `godot/assets/kun-battle-v2/kun-battle-v2.glb.import` 持久化 `meshes/ensure_tangents=false`，隔离重导入切线错误为 0；没有修改 GLB 或补无意义 UV，也没有禁用全项目切线。
- 根的原实例恢复模块已接，71 个原批次/8503 个实例，无跳过，保留所有原节点并隐藏展开副本，角色/嘴/门/武器不合并。相同初始镜头的 GPU draw calls 从 **11,545 降到 10,296（约 10.8%）**；这是实际渲染提交计数，**不是 FPS**。110 秒实战为 18,463 calls，但前后战斗时序与存活者已经改变，不能把它和旧 31,655 的全部差值算作合批收益。
- r33 观察到 305 命中、14 次吞入与排出、18 出艇和 15 回艇（3 人战死），500 秒时仍等待原巡航终章。原检查误要求18人全回，已改为幸存者归艇；观察上限增至720秒，绝不改变“离开→回扫→再离开”的结束条件。
- 同轮发现跨部署旧根 queue_free 尚未移除会导致 Godot 自动改显示名为 vanguard-27 等。已将逻辑 ID 固定为工厂序号并先移除旧根，增加不可变 ID 检查；显示名不再决定实体身份。r35 在跑最终循环验收，现有用户窗口均不重启。


#### r35 稳定验证结果与入口

- `report-r35.json`：670.8 秒等待完整原巡航终章完成，20 项检查与 reset 通过。305 命中、14 次吞入与对应排出、18 名实际走出 SOCCO、15 名幸存者实际回艇、3 名战死；6 条实际补给船。后续 3 次缺少可达干地的登陆请求正常撤回，没有在海上生成地面兵。
- `director-r33.json`：时序核心 42 项检查通过。实体 ID 与可见节点名已分开，跨部署仍是 vanguard-0…26，撤退不能被战死占用者锁住通行队列。
- `stable-r35-session.json` 记录当前验证工程与准确运行命令。由于磁盘空间不足，没有新复制整工程，也没有再开第三个用户窗口；直接保留现有 `/var/folders/n7/kzrzmcl11nz_2g29sqbjtd980000gn/T/saihoji-world-t5s9wp81`。主工程最新场景为 `godot/scenes/saihoji_battle_world.tscn`，与当前 r24 窗口相比新增真后门、原首落地反击、鲲 v2 内腔、原 GPU 实例恢复。
- 明确限制：尚无完整行走步态/脚 IK，当前有真实支撑的路径移动仍可见滑行；全程人体/散置道具/绳索净空尚未穷尽；真实拔河绳队与 pull 触发未完整移植；主世界全部舰队航线、同版自然失败和完整主观听验仍待；draw calls 仍高，不能称已达到流畅发布标准。
