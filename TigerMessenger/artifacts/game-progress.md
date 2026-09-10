## 圣城动态通行演练（2026-09-10，最新；替代仅静态检视状态）

三兵种现在分别能从真实门洞沿五层旋梯到达顶层：每种完成247路点之间的246段，没有传送到终点。`traversal.json` 为全程固定60Hz控制器验证；额外插入实体挡墙，确认 blocked 后继续tick也不越墙。`traversal-ui.json` 验证启动确实移动、切换结构会停掉演练、重新启动和重置有效。

实际移动揭示了旧代理检查未覆盖的脚跟/踏板角落问题。本轮把旋梯改成平面明暗的扇形踏板，前后距离 GOING=.34、宽 .66、最大级高仍约 .139，保留五层高度和塔外轮廓。动态落脚点按上/下行分别偏向开放边缘（.14/.10），原48点源数据保留，不覆盖原作锚点文件。长矛向前倾 .28rad 防止顶层净空碰撞，手柄继续对齐真实手掌。

控制器 `citadel_roman_traversal.gd` 为刚性腿风格化跃步：先抬起、再前进、再落下；前进阶段的高度为两端较高支撑面加净空余量（短剑 .10、矛/弓 .01）。它是实际模型移动，尚未新增膝关节或独立双脚步态。运动按1cm/2度分段检查可见身体/装备的凸包，遇阻保持最后安全位置；这是高密度离散防穿检查，不是数学严格连续碰撞检测。不要改写成完整屈膝行走、全军避让或攻城已完成。

运行：`godot/scenes/citadel_world.tscn`，右侧选择“短剑兵/长矛兵/弓箭兵 · 通行演练”，镜头跟随；“重置通行演练”清掉角色。每次仅运行一人，换兵种会重建碰撞上下文并取消旧演练；切换塔身/楼梯/区域会终止演练，避免结构改了还使用旧碰撞。塔壳只是为了看清内部而临时隐藏，碰撞仍参与。

验证：`roman-carry.json` 握点/弦端/恢复通过；新扇形踏板下 `full-context-audit.json` 2115点通过且保留楼板正反控制，`roman-envelopes.json` 每种2081点通过，`roman-turns.json` 每种2976个转向采样通过。全程三兵种都 arrived；挡墙控制通过；UI四项通过。`traversal-capture.json` 和 `traversal-{0,80,160,246}.png` 是真实演练截取的阶段，检视页更新在原 citadel-entry 地址。

下一动作：基于此单人通行接入同队队列与人际避让、角色生命周期和逐层实际到达事件；再接外部街道→门洞、守军/交战、木马分支及区域BGM。正式双脚步态需处理认可模型的刚性腿结构，不能靠埋脚或瞬移冒充完成。

工程模块：`citadel_collision_context.gd` 为当前可见城堡建立静态碰撞（已有塔壳/CSG碰撞不重复）；`citadel_roman_traversal.gd` 管移动和阻挡；`citadel_world_entry.gd` 管固定步长、入口、跟随与重置。测试 `test_citadel_traversal.gd` 支持可选 TM_TRAVERSAL_ROLE 单兵诊断，单兵结果写独立文件，不能代替全三兵种 traversal.json。

## 三兵种实际携行接入与逐点几何检查（2026-09-10，最新）

`godot/scripts/roman_carry_pose.gd` 接认可的 `roman-family-v1`，使用 assembly 的 `add:handL/R` 与实际武器握点，未套用旧网页 HAND 偏移。短剑改竖持避免前方踏步；长矛沿用实际握柄；弓箭兵保留原肩部横向位置、抬弓通过窄处，弓弦按真实两端弓梢重接为待机弦，隐藏待发箭。现有握柄保留，不再添加重复盾柄。退出完整恢复节点变换、显隐和弦状态。

`roman-carry.json`：三种61朝向握点/恢复检查通过，最大握点误差5.4e-8，弦端误差3.7e-8；当前携行宽度短剑 .570843、矛 .630959、弓 .431644；高度1.158540 / 1.747689 / 1.639890。原弓箭兵伸臂几何与普通士兵不同，不能给其肩部直接应用同样的横移。

`roman-envelopes.json`：各1671个非零通路段位置，共5013个采样，实际可见网格顶点组成的凸包粗查 + 分网格凸包复核均无剩余阻挡。包含身体、武器和当前整城可见不透明结构；抬步上限仍 .14。粗包围体少量误报来自网格间空白，逐网格复核排除；不把忽略真实碰撞称通过。

Godot 入口新增“检视三兵种携行”，在实际入口平台显示3个认可模型，截图 `artifacts/pipeline/citadel-entry/roman-carry-preview.png`；这是静态姿态检视，不是士兵已自然行走。弓为窄通路抬弓姿态，尚待动画/视觉验收。

下一动作：实现相邻路径朝向间的连续转弯碰撞检查、实际脚掌承托/抬脚与逐级移动，随后接外部进攻街道、队列与到达夺取事件。当前采样未覆盖转弯插值/完整扫掠、不同士兵之间碰撞、足底动画或交战逻辑，不能宣布攻城完成。不要把仅显示三名士兵改写成战斗接入。

## 圣城塔内通路与城镇楼板开洞（2026-09-10，最新）

已完成本批结构接入：10 个原塔身/腰线/顶层楼板段改为可回退空腔，沿用原材质与变换，外包围尺寸差为 0；保留原 1.75×2.8 门洞，补门洞到旋梯的转弯平台与下行段，连接五层连续旋梯及原夺取点。当前 264 个踏板/连接网格（原207为上一轮）。`citadel_world.tscn` 默认启用结构候选，右侧两个开关可恢复旧结构。

整城验证发现并解决了 WFC 第一层楼板穿入塔内：`SharedEdgeCastleCandidate/.../citadel-layer-1/town-terrace-0-level-1/Mesh114`，sourcePath 尾部 `Mesh[165]`，局部薄板范围 [-8.93,4.01,-8.93]、尺寸 [19.86,.19,19.86]。只在原塔基范围及门洞通道使用 CSG 开洞，原 mesh 保留；不是整块删除，也未取消整城碰撞。

证据 `artifacts/pipeline/citadel-entry/full-context-audit.json`：1705 个 0.05m 采样全部通过身体代理/承托检查；宽 .38、高 1.2、显式抬步上限 .14。洞口射线为空，洞外 19 个采样仍有该楼板碰撞。包含当前整个城堡/WFC 的可见不透明几何；关闭候选恢复原结构。实际入口与同机位塔身前后图已放在同一检视页。

限制：这不是完整角色移动。三兵种实际整体包围尺寸已测：短剑兵高1.160659，长矛兵含长矛高1.705190，弓箭兵整体高1.251896；代理只检身体，不代表武器通过。外部街道到门口、脚掌踏面、真实抬脚、携行武器转弯与人群间距仍未验收；不能以此宣布攻城完成。CSG保留外部轮廓与材质的可视核对已做，不称像素完全相同或性能最终验收。

下一动作：用认可三兵种几何校准携行体积，制作实际逐级行走与碰撞推进；沿原外部路线接街道到门洞，再加逐层夺取事件。保留原木马 8 人夜潜与 6 人战后巡逻区别、旧五台地/云梯停用规则，62秒不作为胜利。

工程入口：`godot/scripts/citadel_stair_candidate.gd` 管通路；`citadel_tower_shell.gd` 管塔壳；`citadel_town_cavity.gd` 管穿入楼板；`citadel_world_entry.gd` 集成。测试 `godot/tests/audit_citadel_full_context.gd`（全城碰撞），`capture_citadel_hollow.gd`（前后/入口图），`test_citadel_entry.gd`（地标入口）。全城测试中 CSG 特设第3碰撞层用于验证保留楼板，仍保留第1碰撞层。不要把旧仅楼梯代理测试当作本轮全城证据。

本轮松下集成验证完成：`artifacts/pipeline/saihoji-godot-ambush/cover-world.json`，23项通过、phase=complete、reset通过。可视页 `artifacts/pipeline/saihoji-godot-ambush/index.html` 包含实际场景截图。未称完整登岸/人工自然通关；后续仍先苔庭验收再圣城。

## Godot 松下待命接续（2026-09-10）

首发50人改用静态周边树冠下真实干地站位，排除随鲲升起的庭园树。原1.25网格在全树干避让后只有47点，改为1.0采样后571个同片干地点筛出72候选，保持1m人员间距可分配57人，前50成功；未改地形。数据 `artifacts/pipeline/saihoji-pine-cover/report.json`。树冠投影不是完整敌方视线遮蔽模型。

三兵种使用可恢复髋轴前倾待命，双腿脚底不动、武器随上身保持握持；303采样通过。认可源无独立膝关节，这不是蹲跪动画，头部下降仅2.7–4.1cm。集成0.7秒淡入/起身，仅全员到位并稳定1.6秒后才允许R；出击前回到原武器动画。实景截图 `artifacts/pipeline/saihoji-godot-ambush/pine-formation.png`；完整登岸仍待实现。

Godot伏击门槛本轮验证：`artifacts/pipeline/saihoji-godot-ambush/world.json`，22项实际原场景固定步长检查通过，phase=complete、301次实际投射物命中、重甲完成撤离、reset清空角色，load_error为空。测试等待全员就位10秒再调用真实信号接口，无注入命中/登陆；不称人工自然通关。规则测试 director.json通过，旧核心42项兼容测试通过。场景路径 `godot/scenes/saihoji_battle_world.tscn`，开始任务后等待到位再按R。

## 当前交付顺序：先苔庭 Godot，再高山圣城（2026-09-10）

用户明确：苔庭之战进入 Godot 并完成验收后，再推进高山圣城之战。当前未转入圣城施工。

本轮发现并修正 Godot 伏击顺序：实际战场启用 require_ambush_signal，两船报告登陆后进入 concealment；真实50名首发士兵达到 formed/down 才能发送信号；按钮或 R 调用 request_ambush_signal。无信号时舰队经过不抬鲲、不播放抬升序曲、不自动空降；发信号后仍要真实舰队接近才开始发现。重甲仍只由有效舰队受击触发。重复/提前信号被拒绝，重置清空许可。

这只是战斗门槛接入：concealment 当前仍利用既有阵位等待，尚未称已完成松下隐藏姿态、自然取械登岸、完整剧情存档衔接或整体游玩验收。Director保留默认旧规则用于独立复用，实际battle world明确启用新规则。操作入口 godot/scenes/saihoji_battle_world.tscn；开始任务→等待全员到位→R发送信号。

## 登船衔接：携行与分阶段状态（2026-09-10，接续 v11）

本轮读取 threejs-game-director、threejs-gameplay-systems 及 physics-engine-selection，继续在原系统上修复。交互检视 `artifacts/pipeline/warship-boarding-v11/index.html` 明确是离散位置样本，不是自然走路动画。

已实现：Web/Godot 单人 seated/deck-unarmed/deck-armed/ashore 身份与武器独占；Web 保留破盾状态，不能登船后自动获得新盾。三兵种真实工厂新增可恢复携行姿态，武器不缩放、父子关系不变；矛/剑宽0.407667、弓0.245682，握点误差<2.6e-16。实际Web返航原有列队等待阶段使用携行，入座前恢复，默认航路与瞬时登陆旧逻辑仍未替换。

核实：通路船本地0.314333×船scale1.7=世界0.534367，实际人体宽0.33，足够身体；原战斗武器宽剑0.725917/矛0.634667。船座donor世界尺度.85，与地面仍有约15%差异，下一步统一真实几何与骨架尺寸，不能靠隐藏/缩放过渡宣称修好。

Blender v12 隔离跳板候选：水平三片外伸、保持船壳/坐席/武器，65展开采样与平移包络交叉0；入口补踏步后每级约.16世界单位。人体代理在层叠板缝仍有脚底交叉，需真实抬脚；岸面承托、绕桅、取械及完整步行动画未验证。v12未安装，当前运行清单仍v11，boardingValidated=false。

证据：`artifacts/pipeline/warship-boarding-v11/{report.json,web-stage-report.json,godot-stage-report.json}`；`artifacts/pipeline/roman-ship-carry/report.json`；`artifacts/pipeline/warship-boarding-v12/index.html`。Godot仅状态接口接入，未同步三兵种携行骨架动画。

下一步顺序：统一座姿/步行人体体量 → 同人起身与取械动画 → 携行姿态绕桅扫掠及25人排队 → 跳板抬脚/实际岸面 → 完整自然去返程。不要把当前静态检查改写成全部通过。

## 传统战船 v11：同队士兵与甲板布局（2026-09-10，当前版本）

当前运行源由 `assets/models/optimized/warship-runtime.json` 统一管理，Web 与 Godot 均加载 v11，SHA256 `7c9273f5f39e7b8e87b70d76b51216e8e8b488e3f941840899fc134a719bc8ff`。下面 v6/v8 条目保留为历史，不代表当前版本。最新检视 `artifacts/pipeline/warship-top-side/index.html`。

已完成：认可的罗马士兵几何替换 26 个坐姿，保留 25 个战斗身份及 1 人留守；两侧坐席与桨整体外移、人体不拉伸，中部按主人保存 45 件武器/盾牌，尾部货箱及原货台避开最后两排。船壳接连续弯艏柱；目标图侧视眼睛与主透视同端。Web/Godot 使用同一批人员身份控制坐姿、步行表示与存放武器显隐，伤亡者不会自动复活为桨手。

验证：Web 公共工厂 15 项通过（70 次模型绘制），Godot 301 帧、52 握点与人员归属检查通过；v10 全301帧布局/兵器穿插审计保留，v11不改人员及姿态。船头独立面的相邻顶点焊接后统一外向法线，网页回读确认弯木缺面已修正。证据见检视页及 `docs/WARSHIP_CREW_AND_LAYOUT.md`。

下一步仍需真实取械、绕桅步行、跳板扫掠、靠岸和水深验证；当前身份显隐不是完整登岸动画。旧路线贴地/终点重摆尚未解决，不启用未通过的水路候选。Web 地面士兵既有装备覆盖与船上保存几何仍需逐项统一，不能宣称全游戏模型已一致。

## 船头弯木迁移（2026-09-10）

用户截图指定原船尾弯木。已在 Blender v8 副本移动 n59/n61 及其描边至 +X 船头，反转弧线向前、下移 .43 衔接甲板。v6 原文件保留，未采用 v7 未完成的跳板轨迹。Web 导出脚本默认版本8，Godot saihoji_warship_adapter 的模型/assembly 指向v8；兼容控制器名 warshipV6 保留。最新回读图 artifacts/pipeline/warship-bow-ornament，主检视页顶部已更新。此造型改动不解决先前跳板/航道未过项。

## 传统战船 v6 实际接入（2026-09-10，本次更新）
接入后的真实 Web 回归：新游戏/旧 chapter2 共21项通过（artifacts/pipeline/saihoji-campaign-voyage/2026-09-09T22-57-29.150Z/report.json），正常两船50蓝盔进入隐蔽；v6 实际去返程10项通过（artifacts/pipeline/warship-web-navigation/2026-09-09T22-59-27.155Z/report.json），源版本稳定、无页面错误。航向通过不包含地形/泊位碰撞验收。


两轮船头修订 v5/v6 之后，v6 已接入 Web 公共 createFisherBoat 以及 Godot 苔庭战斗 _launch_ship，源 GLB SHA256 为 c18dfbd2d37dff6501fa799d99dd7e698aa1623d1c9c74939240562836a9a397。原模型保留为 createOriginalFisherBoat。Web 将保存的模型几何合批为 39 次绘制，保留 26 桨手/26 桨、蓝红缨、麻醉、清空桨手、夜灯接口；13 项独立真实工厂检查通过，握点误差 <1e-6。Godot 原战斗出航截图和301帧握点测试见 docs/WARSHIP_V6_GODOT.md；Web 证据 artifacts/pipeline/warship-v6-web/report.json。总对照 artifacts/pipeline/warship-prow-review/index.html。

不能把模型接入算登船完成：v6 展开绳扫桨手，v7 独立候选去掉高柱/绳解决收纳及绳扫人，但板体旧展开路径仍撞壳/桨，v7 未接运行时。见 artifacts/pipeline/warship-v6-boarding-audit/README.md 和 assets/models/optimized/warship-battle-v7/README.md。

水路候选仅 ?warshipWaterRoutes=1 开启，默认仍原主线路线以免阻断出兵。实际海深约0.5米，而船桨动态吃水可达1.30米；需真实加深航道并重做接岸，不能删除海底碰撞假称通过。原约4米终点泊位重摆尚未解决。下一步先完成跳板真实扫掠及岸面承托，再调整海底/泊位、替换候选路线并跑完整登陆。

## 传统战船两轮船头与航向修复（2026-09-10）

v5/v6两轮实际Blender副本完成：统一+X船头/眼睛/撞角，-X船尾货物；木质船头前伸上扬、前甲板收尖，竖立登船板改甲板下平放。20项保存资产检查通过，26桨手/26桨/301帧原人员动作保留。对照 `artifacts/pipeline/warship-prow-review/index.html`，工程说明 `docs/WARSHIP_PROW_REVISIONS.md`。此为先前候选记录；Web/Godot 实际接入见本文顶部最新更新，登船/跳板碰撞仍未通过。

Web另修船用反射坐标系与航路切向，真实去返程10项方向检查通过；`artifacts/pipeline/warship-web-navigation/index.html`。原终点约4米泊位重摆、贴地/建筑遮挡未解决，不把方向通过称航路碰撞通过。

## 苔庭无兵触发修复（2026-09-10）

已连接救援章节与原盟军航程：结盟后出航、登陆隐蔽、实际 R 信号后允许舰队发现鲲。两英雄仍为保护技能；主线面板显示航行/隐蔽进度。完整世界不再因可选圣城 V3 分支省略苔庭士兵；控制器缺失时禁止鲲提前升空。保存章节不变，刷新即可按旧章节继续。

验证：主线 DOM 11 项及章节规则通过；真实新游戏/旧 chapter2 两场 21 项通过，原两船运来 50 名可见蓝盔、约57–59秒仿真时间完成隐蔽，信号前鲸升幅0，信号后真实扫描进入伏击，重甲保持未部署。诊断控制玩家/舰队位置并逐步推进原更新器，未使用reset/debug/spawn/写phase；不称完整自然游玩或后续战斗地形验收。证据 `artifacts/pipeline/saihoji-campaign-voyage/2026-09-09T21-49-37.964Z/`，说明 `docs/SAIHOJI_CAMPAIGN_TRIGGER_FIX.md`。Godot未同步此修复。

## 湖沼救虎 · 故事板与关卡配置（2026-09-10）

用户指定插曲《借来的盔甲》已并入故事板，新增结构化16阶段/9区域/6检查点配置以及游戏工作台只读入口。数据测试通过（15错误反例、68缺条件检查）；面板桌面/窄屏加载、失败重试、旧草稿保留、零执行与文本安全通过，证据 artifacts/swamp-rescue-level/panel-1788987286472/。真实地图坐标仍未绑定，捕获、合作、改装、防护、护送与四人登艇均未实现，不启用关卡、不改现有主线或存档。指南 docs/SWAMP_RESCUE_LEVEL.md，数据 godot/data/levels/swamp-rescue-v1.json；苔庭优先不变。

## 精确回岸、伤亡与紧急撤离（2026-09-10，最新接续）

Web已接战斗位置→原集合点的精确静态寻路：soccoGroundRoutes.planReturn最多60米/2500节点，不能把旁边空位当终点，实心石内部、缺失干地或搜索失败明确返回失败，保留原撤离兜底。返回时刷新静态快照；看护保持真实地表哨位，消除0.45–0.85米垂直重定位。地形接缝径向升降限制2.4米/秒，水平保持1.6米/秒。

验证：无伤亡主测试22项通过，21离艇/21真回/0兜底；合成球面精确寻路7项通过；实际苔庭诊断移位一兵后，由原更新器绕行6.0527米，1286观察帧0静态障碍相交、最大帧位移0.04782米，21全部真回。后者含明确起点摆位，不称自然战斗。报告分别在artifacts/pipeline/socco-web-berth、socco-return-routes、socco-battlefield-return。

并行撤离最终稳定报告artifacts/pipeline/socco-web-evacuation/2026-09-09T20-15-51.536Z：3场30断言通过，HTTP源码hash与最终本地一致。正常伤亡18真回/3死/0兜底；45秒持续受阻16真回/3死/2兜底；12秒离站受阻9真回/3死/9兜底；均0未解决，不改45/12时限，不把超时隐藏当真回。受阻为明确持续摆位故障注入，离站为测试设置机队位置。根已独立核对汇总和源码hash。工程指南docs/SOCCO_SHORE_ROUTES.md，统一验收页artifacts/pipeline/socco-web-berth/index.html由当前报告生成。

下一步：战斗阵型推进和跨艇/全场人物动态避障（本导航当前只接撤回与岸边上下船）；运动中鲲地形重规划、自然受击触发、连续重置、搜索帧预算和Godot同步。原作其他区域/资产与战船v4 Web接入仍按既有规划未完成。当前只是本批回程及规则验收，不是整体游戏完成。

## SOCCO Web 岸边路线、排队与真实回收（2026-09-10，最新接续）

新增 src/world/soccoGroundRoutes.js，在实际球面干地上搜索不超过12米的岸边短路线，避开原庭石/树木、自身艇身和已分配的集合位置；原资产、地形未挪动。src/world/vanguardAssault.js 已实际调用，三艇21条路线全部接入，集合位跟随艇朝向，先填远排再填近排，回舱反向复用。回程上一人清空共用岸边段后再放下一人，舷梯单人通过；岸上按1.6米/秒走，不延长原45秒/紧急12秒撤离限制。修正原0.02弧度约3.2米提前到达跳跃和站姿左右手坐标轴。

实际 test_socco_berth_web.mjs：21项检查通过，21编入/21离艇/21真实回舱/0超时兜底/0未解决/0阵亡；每10帧采样的同艇回程根间距最低约2.49米，27士兵单位旋转误差<1e-6，0网页错误。35项模型/战斗动作回接检查也通过。stats().transport逐UID/座位记录 departed、returned、forcedReturn 和失败快照，不能只看phase=done。截图与报告在artifacts/pipeline/socco-web-berth，工程指南docs/SOCCO_SHORE_ROUTES.md，页面由tools/pipeline/build_socco_shore_review.py从当前报告生成。

仍未完成：整个战斗区域到岸边集合点的全程避障（现有walkOnGround仍直达）；其他艇/全场人物动态避障；脚底IK及全身碰撞；运动中的鲲地形重规划；自然受击触发、有伤亡、紧急追随撤离及连续重置验收；同步搜索帧预算。当前证据是独立浏览器begin诊断运行，不是完整自然战斗交付。Godot未在本批改动，战船v4仍未接Web，不能混算。

## SOCCO 网页岸边树石避让（2026-09-10，最新）

已修改 src/world/soccoBerth.js：保留原树石，搜索岸边位置与六种朝向，对船身和尾门出口空间做树石实际三角面相交检查（先以单网格包围盒筛选）。实际苔庭识别171个障碍网格，三艇分别146/401/466次候选尝试成功；原干地、坡度、坡道支撑约束保留。未改Godot或战船v4运行代码。

验证 tools/pipeline/test_socco_berth_web.mjs：14项全部通过，含434座位路径支撑采样、堵住旧出口后改变位置或朝向、原障碍不移动、真实球形海下地形拒绝；实际8931任务以begin诊断启动，12000步运行至done，三艇resolved-local-ground，0网页错误。artifacts/pipeline/socco-web-berth/actual-unloading.png已人工查看，原出口巨石现在位于侧边。报告及页面同目录。

边界：这是船身/出口空间与路径根支撑检查，不是完整人体碰撞、脚底IK或自然受击触发验收。下一步核查出口至作战目标的完整避障路径、士兵拥挤及回收人数；候选搜索仍为同步计算，需测量正常游玩帧耗时再决定预算化。不能把诊断phase=done当成完整战斗交付。战船v4仍是候选，不混算为Web接入。

## 网页SOCCO真实泊位与坡道（2026-09-10，本轮）

新增src/world/soccoBerth.js：直接射线采样真实地形，排除海面/缺失地面/隐藏或移除对象，旧海上泊位不足时搜索原苔庭岸边；检查艇底采样、坡道内部、两侧出口干地和25度角度上限。停泊后不再被seaSkim钉回海面，尾门朝向岸内；三艘泊位均求解成功。未知或未完全打开的坡道不再放人。

新增soccoBoardingPoint按座位→过道→门槛→坡道路径，并采样新模型表面；回程反向复用，移除旧提前跳到地面行为。14座位434路径采样无缺失，路径根保持表面上0.06米；这是根路径支持，不是完整脚底IK或全身碰撞认证。

验证tools/pipeline/test_socco_berth_web.mjs，12项通过，包含真实网页任务begin诊断启动并运行至done，三艇resolved-local-ground，保存actual-unloading.png。不是自然舰队受击触发验收，未核定所有回收人数或全主线。旧35项模型/战斗更新测试也通过。实际截图仍显示出口附近巨石和树木，下一步必须做植被/巨石避让及真实上下船人数/通路验收，不能把本批说成完整可玩。

战船本轮只读审计已在docs/WARSHIP_WEB_INTEGRATION_AUDIT.md：需接同舷同步、286实例与104新增手臂/手的驱动、隐藏/换缨/麻醉生命周期；25兵目前并未经过跳板。未改战船运行代码。

## 8931网页漏接修复（2026-09-10）

用户指出实际localhost:8931/TigerMessenger并未加载优化。已核验该服务index与当前工程一致，根因是Web仍调用旧procedural工厂，之前Godot完成不能代表Web。

本轮将vanguard-color-v2和socco-color-v2真实GLB几何/材质转成同步Web模块，通过battleOptimization绑定到原对象；保留原parts/父级/14座位/坡道/VFX状态。重甲补实时关节、握柄、瞄准/举刀/挥击和原炮充能缩放联动。实际生产页before：0新版/27重甲+3运兵艇missing；after：27重甲、3运兵艇active geometryApplied，0missing/0pageerror。见artifacts/pipeline/web-battle-assets/production-report.json。独立模型动作检查见artifacts/pipeline/battle-optimization-web/report.json，图不是自然战斗截图。

边界：仅这两资产回接网页；战船v4等不混算。SOCCO网页坡道未获得真实地面采样，仍标review-angle-ground-unresolved，不宣称完整自然上下船/全战斗验收。接下来接该地形采样并验证真实上下船，再逐项缩小Web/Godot接入差异。Godot两资产维持已接状态。

## 重甲与SOCCO目标配色已接入

用户要求修正明显色差。新增vanguard-color-v2和socco-color-v2，保留原几何/UV/层级和动作；GLB除materials外JSON及二进制完全一致，重甲161帧保存动作一致，SOCCO主Blend原本静态，不声称其包含整场动画。重甲改炭蓝灰/灰褐炮壳护板，SOCCO改珊瑚砖红/暖象牙/深棕底和木坡道；金属度粗糙度保持。三源色元数据同步新色，防止导出恢复旧色。

Godot world已加载两份新GLB，heavy动作仍复用v1 assembly。隔离项目GPU自然战斗到67.1167秒实际出舱截图通过，见artifacts/pipeline/moebius-color-review/godot-report.json及godot-actual-disembarkation.png；仅验证本轮配色接入，不代替完整战斗验收。两份Blender/GLB与material-mapping/验证位于assets/models/optimized对应新目录；总览和moebius-color-review/index.html已更新。已运行旧Godot窗口需重启加载新资源；Web源未改。

## 战船两轮迭代最新交付

- 用户要求眼位与尖头对齐目标图；已完成v3/v4两个独立Blender/GLB候选。目标多视图有眼位矛盾，以主3q卷曲端眼为准，原+X航向/撞角保持。
- v3移眼与初收尖，保留眼穿壳和船壳封口接触失败证据。v4细分贴合眼、两端船壳/甲板/上层平台收尖，船员区旧封口下降，登船支撑窄缝补齐。
- v4重新验证301保存帧，新壳体对指定身体/桨及眼壳检查通过；15652握点检查通过，450登船接面射线无缺口。不能扩称全身/货物/舱棚全碰撞验收，901研究姿态未重跑，单兵通路/25人调度未验，未正式Godot回接。
- 两轮实际GLB图已查看并放入artifacts/pipeline/warship-two-pass-review/index.html，总览已更新v4。验证见assets/models/optimized/warship-battle-v4/validation-summary.json。下一步以v4为候选继续战场接入；不要再把v2当最新造型，也不要继承v1旧登船路径通过结论。

## 护航艇合并（用户最新决定）

GatePod统一为一种模型，以pod-41-7的Blender、GLB和动作数据作为唯一母版。pod-55-2与pod-08-9仅保留历史归档及战场实例身份，不再分别优化。Godot苔庭适配器中三艘艇均加载同一母版，各自航线、比例与双索降仍独立；61帧×3艘共183姿态、实例独立和重置检查通过。当前已运行的旧窗口需重启才加载修改；Web原源未改。验收页只展示一种。详见assets/models/optimized/gatepod-escort-v1/shared-model.json。

## 最新续做交付（优先于下方历史记录）

- 六庭25树保留原局部布局；连续承托扩边35.084平方米、1个连通体，425根盘采样全命中。待机整组抬约0.553米，最低顶面超过最大波峰约5.15厘米；升鲲恢复原板面设置。真实Godot近远图已检查，地面折面/根际仍需美术细化，未新增导航或动态碰撞。证据：artifacts/pipeline/saihoji-pines-v1/root-ground-support-report.json。
- 战船v2已保存、导出和真实GLB回读：301保存帧相邻桨碰撞36→0；26桨手握持/身体/甲板检查通过。890原局部网格保持，只改变划桨时序。901研究姿态与301保存帧分开记录。候选位于assets/models/optimized/warship-battle-v2，未接正式战场，25人登陆调度仍待接。
- 同材质表面适配已接Godot world：2602原盒体15612→2602表面，位置/UV/拓扑保持。独立电车GPU372→97次绘制，最大像素误差1/255；没有整战场FPS结论。见artifacts/pipeline/original-surface-restore/report.json。
- 当前验收网页已更新。r35仍是上轮完整战斗证据，本轮仅定向几何/GPU验证，不能把r35当新版全战斗验收。
- 已清理本任务过时r18临时工程287MB，源资产与证据保留。r24用户窗口、主编辑器和q开发副本保留；下方保留r18的旧要求已失效。
- 下一步：把战船v2时序与25人登陆调度接入实际战场，再补完整步态和拔河动作；并继续根际美术过渡及新版完整游玩。

## 当前交付与下一步（覆盖下方历史版本）

可看 `artifacts/pipeline/saihoji-battle-review/index.html` 和 `docs/SAIHOJI_BATTLE_PLAY_GUIDE.md`。用户r24验收窗口保持不动，开发使用隔离项目。

- 三兵种六款脸型/头盔/胸裙/握持候选已复核；蓝色三兵种进入实际苔庭。新重甲、五飞艇、三GatePod也进入战场，斜绳端点已修。
- 最新r35：670.8秒完成原巡航终章，305真命中、六档削弱、14吞入/14排出、18重甲真实出门、15幸存者回舱/3战死，6实际补给船到达，20检查与reset通过（report-r35.json）。首人落地即可反击已按原代码修正，鲲v2实际海上吞噬图见native-r34-actual-swallow.png；不等于完整主线/最终视觉。
- SOCCO新舱底与全坡道真实地形净空已修，r30出门/回艇GPU截图已看，无抬地。完整行走步态仍欠，当前有脚底支持的姿态沿路径移动。
- 鲲v2经295原ID/100原网格保持、121姿态484组内外面无交叉检查；正常+诊断补光GLB已根查看，已接下一隔离版。该资产无任何normalTexture，建议只在该GLB导入禁生成切线，避免无UV切线报错；不塞假UV改已验证源。
- 25个六庭古松不同seed已从真实factory逐一快照并导入Blender（25×17节点、0顶点误差），新saihoji-pines-v1的75实际GLB已通过检查；125原可见mesh对应25个源位置最大误差2.22e-16。五页最终图完成；25棵LOD0已接原六庭，近/远GPU与25原根/125材质验证通过。部分岛边树根原布局即悬空，尚未修地形贴合，不能称地形验收完成；LOD1/2未自动接入。不能拿单棵候选覆盖25种原形。
- 战船301帧候选含26原桨手，15652握点、身体/甲板/座板检查通过，单兵229点通道通过；原和候选同有36帧相邻桨叶相碰，标记blocked_candidate/readyForBattle:false，仅入Godot候选目录，运行时未替换。26桨手仍原简化脸盔，不算新版六款战斗兵。
- 原曲Godot原生控制和实际CoreAudio各3秒无削波/重置无尾音通过，全曲听验与缺失雷声待补。

性能是当前明确阻塞：r28宽镜约31655绘制调用。根已恢复原导出展开的71组8503实例为MultiMesh，实际GPU独立位置/材质/恢复/幂等全过，理论surface16208→137；`original_instance_adapter.gd`与map/test/`docs/ORIGINAL_INSTANCE_RESTORE.md`齐。实战开始同镜头11545→10296 calls（约10.8%），非FPS；隔离6000鸟群12000→12 calls且逐像素0差。下一瓶颈已只读核定：电车1920原网格却有11329表面，重复同材质表面可减少9409；尚未实施，见surface-next-audit.json。保留8503原节点，未来逐实例动画需refresh，不合并士兵骨骼或鲲形变。

接下来：六庭边缘树根与实际地面贴合→战船候选最终回读/单兵通道交付→完整步态/拔河pull联动→重复同材质表面合并性能验证→自然失败路径及完整故事/BGM验收。保留前台shoreline-corrected.blend与用户运行窗口，不改活动.godot缓存。只有机队真实受击才允许重甲投放。

磁盘实际只余约132MiB。已清本轮可确认的结束临时测试工程与自有自动备份；原模型、已产资产、证据和用户窗口全部保留。最后对照改5页小图完成；后续大型导入/渲染前须先恢复工作空间，不能无边界删除用户文件。

<!-- 以下为历史记录；当前状态以上方为准。 -->

## 最新接续：苔庭干地与候选管线

当前可看 `docs/SAIHOJI_BATTLE_PLAY_GUIDE.md` 和 `artifacts/pipeline/saihoji-battle-review/index.html`。r17 修复原地面后306真实命中、六档回落、八船返航、结束与重置通过。r18有50蓝兵脚底实测160.670–161.499，高于海波峰160.567。重要：新干地布局没有实际触发鲸吞，不能引用旧版吞噬次数；世界worker正加鲲受压主动缓转向真实敌群，保持26范围/.15前锥/容量3/原冷却，不搬敌军或伪造命中。

实际根因是原有机苔地1008法线全朝下，不是陆地不存在。已修Web原工厂pushTriangle绕序/对应颜色并跑实际factory：上方射线0/9→9/9，旧方形分支仍9/9。旧Godot归档不改，用saihoji_terrain_adapter内存副本修面；原373连通干地用于站位，海R160.5/原地形顶点不变。

重甲候选已收口并由根独立复跑：84源ID、161帧握柄/炮甲与前臂手柄接触、77UV网格、17原材质通过；hash8961c19f…，Godot目录vanguard-battle-v1。飞艇67ID候选已入Godot，根新saihoji_aircraft_adapter保留原5运动根、挂新视觉并提供原尾焰脉动，语法通过、场景接入待世界worker。古松三LOD同样入库待原变体摆放验收。SOCCO与GatePod正在Blender优化，未宣称完成。

请优先保留一版可交互Godot验收窗口（r18由世界worker建立）；下一版隔离加入重甲/飞艇及真实鲸吞。剩余完整路径避障、动态绳索/挣扎、SOCCO尾门上下船、GatePod绞盘、BGM听验及完整主线仍待收口。原电车轨道不能到达42米门槛，须真实接驳，不刷兵替代。

## 2026-09-09 苔庭战场当前证据（接管先读）

查看 `artifacts/pipeline/saihoji-battle-review/index.html`：六组士兵、鲲、古松、重甲、吸食飞艇、SOCCO、GatePod 的参考/实际模型/未完成项并列。目标图不是完成数量。

Godot 原战场 r12 固定步长验证实际航行/投射物接触跑通一轮：309 命中、六档吸力削弱、吞噬、八艘船返航、结束与重置；14 检查通过。证据 `artifacts/pipeline/saihoji-battle-world/report-r12.json`，明确 `full_visual_gameplay_accepted=false`。核心42项与战斗原规则18项另有验证。此前 r2/r3 快武器间隔结果已废弃，不引用为交付依据。仅实际受击触发重甲部署；按主舰真实投影落点，不能固定苔庭反复空投。

鲲 Blender 独立复查295源节点、121帧下颌/喉囊、23原材质通过，背岛73节点签名相同；候选已进入 Godot 吞噬动作。古松三档3598/2228/1222三角已入Godot候选目录，场景替换待核。重甲及飞艇正在 Blender 迭代，SOCCO/GatePod只有目标图与原模型，还未优化。

原音乐已迁 Godot 原生 Ogg 控制，含原报警/脚步合成，17项音频逻辑检查通过；实际听验未完成，headless Dummy退出还有14个Ogg播放资源警告。雷声源文件缺失不可冒称齐全。当前画面缺口：鲲候选需启用顶点色；原海面 Shader 移植已写入 `saihoji_water_adapter.gd`，GPU/登陆不淹水待验；绳网/电车接驳待做。原电车轨道距登陆点约95米而补兵门槛42，必须改线路或明确接驳，不能定时刷兵冒充。

下一步：完成海面/鲲同镜头验证；重甲/飞艇候选动作与材质复查；接古松摆放与原变体；然后实际Godot整轮游玩、BGM听验、故事入口与重置。不要覆盖前台 shoreline-corrected.blend，不动活动 .godot 缓存；隔离运行验证。

## 当前交接：士兵本轮候选收口，进入苔庭之战

六种红蓝士兵已完成本轮脸型/头盔/胸裙与握持修正。独立报告 `artifacts/pipeline/roman-family-blender-validation/family-face-final-v1/report.json` 六种结构、锚点、采样表面交叉、保存时间轴检查均通过；不等于全步态/连续扫掠或游戏端完整验收。源 .blend 保留，新候选在 `assets/models/optimized/roman-family-v1`，GLB与动作assembly已复制到 `godot/assets/roman-family-v1` 供接入；GLB为静态ready/hold，不能声称自动带了运行逻辑。

下阶段依据 `docs/SAIHOJI_BATTLE_ASSET_AUDIT.md` 逐项生成缺失目标图/优化。Godot状态核心42项隔离测试通过，原战场adapter仍在实现；原音乐已复制，native音频控制正在接入/验证。蓝盔反抗采用用户最新叙事，严格仅机队实际受击后申请重甲部署。完成标准仍是实际原苔庭正常触发→战斗→结束→重置一整轮，不用debug刷兵代替。

## 最新用户纠正：裙甲、头盔佩戴、武器必须迭代

用户指出当前可见模型裙甲不像裙甲、头盔佩戴与武器有误，尤其弓兵。此前创建的 Reference Workshop 下排为原模型对照；随后检测当前 Blender 已切到 /Users/panglaohu/Downloads/shoreline-corrected.blend，因而未添加 BEFORE 标签或修改这个新文件。不能推断用户当前指的是工作区原模型；候选仍必须修正。第一份候选必须按目标检查：腰带下垂独立有厚度的裙甲片；盔碗包头、眉沿避眼、护颊贴脸、面开口+X；手包实际武器柄。弓弦验证发现原公式端点离弓梢约0.306/0.337 actor单位，候选须按真实梢与nock重建，不继续沿用错误弦段。先看一份多视角候选并迭代，再扩六份。

## 2026-09-09 当前批：在 Blender 优化三兵种完整角色

用户确认三类士兵都按目标图进入 Blender 优化。本批从六份原 .blend 出发，保留源节点/父级/隐藏装备，制作完整角色副本而非仅 Web 装甲适配。三张目标图已通过真实 MCP 放入前台 `Roman Family · Reference Workshop`，并放入原短剑55节点、长弓89节点、长矛50节点的对照模型。此前未保存的虎场景已备份到 `artifacts/pipeline/blender-session-backups/before-roman-family-20260909-074855.blend`，原文件未覆盖。

制作分工：后台独立 Blender 生成六角色；独立验证者提供真实长弓480帧120Hz七阶段与精确parts/equipment挂点，检查候选结构和接触；根负责 MCP 前台对照、渲染审查和记录。源姿势 `artifacts/pipeline/roman-family-blender-validation/source-poses.json`。前台当前仅是参考与原模型工作区，尚不表示新完整模型已完成。

## 2026-09-09 三兵种目标图已齐备

新增内置生图长矛兵参考 `assets/concepts/roman-spearman-target-v1.png`，与 `roman-soldier-target-v2.png`、`roman-archer-target-v1.png` 统一家族风格，包含红蓝/预备/前刺/背侧及握矛、盾把特写。弓/矛新图尚未收到用户反馈，不自动标认可；后续根据各自参考在 Blender 与实际动作中迭代，图像不等于三维完成。提示词保存在对应 `.prompt.md`。

家族上一批正式封版：`artifacts/pipeline/roman-family-web/summary.json`，88项程序检查通过、720帧三兵种两色、14原专属角色装配；新增弓兵头部穿弦已清除。公平对照原/新下弦穿腰裙均46帧，整体全身几何仍未验收。下一步按照弓兵专用目标修原持弓/下弦间距，再用长矛目标核对握矛与持盾。

## 2026-09-09 新增弓箭兵专用概念原型

用户指出不能仅复用短剑概念后直接改模型。本轮已用内置 image_gen 参考认可的罗马短剑兵图生成 `assets/concepts/roman-archer-target-v1.png`，包含红蓝变体、待机/满弓/背侧姿态与握弓、拉弦特写；完整提示词在同名 `.prompt.md`。本图是新参考，尚未收到用户反馈，不标“已认可”。后续 Blender/姿态应按弓兵专用参考对照，不把当前临时压窄护具当最终美术方案。保留既有家族回接及测试证据；原下弦穿裙仍待按专用原型修复。

## 2026-09-09 罗马兵家族正在收口

按用户要求共用一套认可盔甲覆盖长矛、长弓、短剑红蓝六组合，并补原场景6名木马绑缚、4名夜潜火把和4名夜盾兵。短剑34项回归与原方阵15项通过；完整原世界通过原debugSiege生成44长矛、20短剑、14长弓，全数挂接，14专属角色也已挂接（跳过运输剧情，不计完整通关）。

**当前阻止美术验收的明确缺陷：长弓hold/loose时新版盔/盔缨与弓弦实体交叉，原版同姿势没有。** 独立报告 `artifacts/pipeline/roman-family-web/bow-contact-2026-09-08T23-29-02.880Z/report.json`。正在调整仅弓兵护具侧向宽度，原弓弦箭与臂动画不变；必须复验几何，不能用85项程序通过覆盖新增穿插。接续指南 `docs/ROMAN_FAMILY_INTEGRATION.md`。Godot家族尚未同步。

## 2026-09-09 区域接续：书店原场景与海岸关系

书店 Godot 原世界修复已完成：仅对唯一原招牌恢复 Web 原有不受灯光影响的文字材质，保留纹理、透明策略及所有节点关系。默认日光前后变化很小；独立暗光诊断确认文字不再消失。真实原世界截图、12,727 个有 sourcePath 节点的身份/父级/变换保留、6 次回退检查通过。正式报告 `artifacts/pipeline/bookshop-world-sign/final-03/report.json`；源入口 `godot/scripts/original_world.gd` 默认启用 `bookshop_world_adapter.gd`。这不是书店完整区域收口或全局布光完成，活动编辑器未被本轮隔离检查刷新。

用户要求每区同时接入、优化环境和整体布局。当前只推进书店镇收口，不重复已完成的石板/两阶材质/六树，也不恢复已停用随机房屋、路灯、电线杆。

全球交通这批新增 10 条基于实际候选海底网格的绕陆海路；383 条边独立检查通过，预览无页面错误。入口 `http://127.0.0.1:8765/TigerMessenger/tools/world-terrain/` 的“绕陆航线候选”显示青色海路和橙色未建岸上连接。原场景/地形未搬迁，Godot 载具尚未使用新路线。

发现必须先修的布局问题：V3 候选书店到外洋约 66.16 世界单位、旧港约 61.86，大陆支撑过宽。下一动作是结合原书店—营地—月湖内部占地调整区域外缘/海湾，重算海路；不能把区域锚直接吸附海边或将未建连接标成可玩。详情与复验见 `docs/WORLD_LAYOUT_V2.md` 最新节。

新增工程文件：`tools/pipeline/build_coastal_routes.mjs`、`test_coastal_routes.mjs`、`godot/data/world-coastal-routes-v1.json`。证据 `artifacts/world-terrain/coastal-validation.json`、`coastal-browser.json`。

## 2026-09-09 最新批次：红蓝短剑兵战斗接入与全球地势展开

Godot 同批补充：已完成可复用 `roman_combat_adapter.gd` 与 `roman_combat_runtime.gd`，独立 `roman_combat_slice.tscn` 复用原近战规则；24 项原函数伤害对照、红蓝自动命中、108 原节点/父级保留、阵亡 3.7 秒隐藏通过。正式证据 `artifacts/pipeline/roman-combat-godot/final-02/report.json`。**原 Godot 世界仍有 0 个真实 gladius 角色，尚缺生成/运兵部署生命周期，不能称全局战斗已接完。** 下一步实际部署实例赋球面变换后 register_actor，卸载前 unregister_actor；不能把搬运工和木马绑定兵误当短剑兵。活动编辑器未被隔离测试刷新。

本节优先于下方历史待办。继续 Astra + 已认可图 + Blender 资源 + Godot；Qwen/LLaDA 暂缓。

- Web：已将认可的 v3 盔甲、原红蓝盔缨、盾把接到 `saihojiPhalanx` 实际生成/更新/销毁流程，保留原角色与伤害规则，支持回退。独立浏览器运行真实战斗模块 720 帧，34 项检查通过；原方阵 6 组/15 项通过。不是完整世界通关测试。证据：`artifacts/pipeline/roman-equipment-web/REPORT.md`、`report.json`。
- 动作：覆盖行走、挥击、攀爬、倒地；569 个非攀爬/非倒地姿态验证盾与身体/腿、剑分离。裙板仍为静态十片，裙腿自碰撞及攀爬背盾/举臂全身穿插尚未验收。
- 地势：复用原 geodesicGrid 与 terrainProfilesV8/classifyProfileField 生成 R160 双半球地势候选，16,002 顶点/32,000 三角，闭合无缝拓扑；陆地顶点采样约 37%。同一 GLB 已通过 Web 预览和隔离 Godot 实例检查（14 地标）。本批没有执行 WFC 求解或迁移原建筑，不能计作完整地形部署。
- 查看：`http://127.0.0.1:8765/TigerMessenger/tools/world-terrain/`，拖动旋转、切另一半球、选择区域；打开路线显示穿陆航线及水上陆路问题。原游戏入口仍为 `/TigerMessenger/`。Godot 对应 `res://scenes/world_layout.tscn`。
- 下一批地势先修真实海岸/港口入口与海陆交通路径，再核对场景所有权和真实占地。原 camp/city/castle 复合范围大，规划圆不能当模型边界，更不能整个组重复旋转。详细阶段见 `docs/WORLD_LAYOUT_V2.md` 最新节。

当前地势证据：`artifacts/world-terrain/generation.json`、`browser.json`、`godot-validation.json`；源文件 `tools/pipeline/build_world_terrain.mjs`，产物 `godot/assets/terrain/world-terrain-v3.glb`。原活动世界地形、存档和建筑位置未替换。

## 最新交付：湖沼对答地面修复 + Godot 原作待机尾摆

沿用已经认可的概念和 Blender anatomy-v3 资源，继续接入原游戏。Qwen/LLaDA 按用户要求暂缓。

- **Web 湖沼地面已修**：旧通用球面把玩家从半径 139.21 顶到 151.43，单步位移 12.21；新判定沿真实径向采样原坑壁、湖底和八级入口石阶。只对有实际交点的局部范围覆盖，坑外回退原地面，不把装饰当作地面。平台横向推出后重新采样最终位置，地面登记独立于虎，删除角色不会删地面。
- **真实对答回归通过**：独立浏览器初始化玩家到湖沼近虎位置一次，随后保留正常物理 160 帧（7.76 秒），全部在 7.5 世界单位内；原灯谜经历 tiger → messenger → cool。另六帧受控近距确认原冷却仍保留。没有修改剧情门控或推进救援章节；这不是从出生地步行到湖沼的完整通关验收。正式报告：`artifacts/pipeline/tiger-web-v3/world-physics-2026-09-08T20-05-25-512Z/report.json`。
- **独立局部检查 38 项通过**：旋转/缩放、坑外/对跖点回退、装饰排除、移除角色/整个区域、平台推出进入/离开局部范围。报告 `artifacts/pipeline/swamp-ground-review/fixture-review.json`，审查 `artifacts/pipeline/swamp-ground-review/REVIEW.md`。
- **Godot 已加入原作尾部待机**：9 个原 pivot、约 -150° 的真实尾根 rest，37 姿态与独立 Three.js 原公式对照，最大矩阵差 0.0000633；80 原 ID、六次开关恢复和原世界变换通过。正式报告 `artifacts/pipeline/godot-tiger-idle/final-01/report.json`。动作图/动图是实际引擎关节采样的绘图，不是模型渲染截图。

修改入口：`src/world/swampGround.js`、`src/world/collision.js`、`src/world/moebiusSwamp.js`、`src/main.js`；Godot 为 `godot/scripts/tiger_world_adapter.gd`。原 .blend/GLB 未再次重制或覆盖。活动 Godot 编辑器未被本轮隔离验证刷新，需重新运行原世界查看新尾摆。

后续：按原角色契约推进红蓝短剑兵在真实战斗中的盔甲与握盾回接；继续 Godot 湖沼巡游/饮水/救援适配。坑口与球体整体地形的连续进出、外部路线和完整救援尚未验收，不把这次局部修复当作全世界地形完成。

历史报告保留：20:02 的160帧已完成对答，但旧测试随后期待立即重复触发，故总体失败；最终报告修正了冷却期的验收条件。更早的 world smoke 失败已由本次针对性修复解释，不删除历史。

## 当前执行方向：继续 Astra + Blender + 图像参考 + Godot

用户明确暂缓 Qwen/LLaDA 接入。保留现有桥接程序，暂停模型部署、端点追问与生产线扩建；不把本地模型连接列为游戏开发阻塞。继续原作认可参考 → Blender 迭代 → Godot 真实场景与动作接入 → Web 兼容验证。已有认可图优先复用，只有设计缺口需要时再生图。

当前两项：根线程定位湖沼近距被推出的问题；Godot 工作者将实际尾部待机动画从原 Web 契约接到候选，保留真实 rest 和世界身份。完整巡游、救援与区域地形仍逐步推进，不以静态导入代替玩法。

## 2026-09-09：最新检查点——新虎已进入原 Web 湖沼

此节更新下方历史状态中的“Web 尚未回接”。本次将已有 Blender anatomy-v3 的实际几何、材质、4 张纹理和原节点变换接回原角色，而不是再建一只独立展示虎。原角色身份、80 个节点、尾巴、灯光引用、巡游、饮水、相见回调和救援目标保留；默认使用新外观，可通过 anatomy:false 回退。旧原作采集页面显式使用原模型。

- [x] 修正新模型静止姿态与旧动画之间的偏移，尾根按实际 -150° 基准运动；脚掌增加平面支撑补偿，眼部灯光强度降为旧值的 4%，避免整个面部发红。
- [x] 浏览器 36 项检查通过：原身份、切换/回退、纹理解码失败恢复、资源释放、行走/饮水/相见与平面脚掌接触。最新证据：`artifacts/pipeline/local-runs/web-tiger-anatomy/11b8305744ac41b1856b78380159c18c/`。旧拓扑优化的 idle/walk/drink 对照也保持零像素差异。
- [x] 原游戏完整场景确认新虎默认加载、40 次真实帧更新、相见状态和救援目标仍是同一角色；无页面、控制台或请求错误。实景：`artifacts/pipeline/tiger-web-v3/world-2026-09-08T19-35-35-092Z/02-candidate-world.png`。
- [ ] **完整场景对话没有触发，world smoke 总结果仍为失败。** 必须查距离/阻塞条件并完成实际触发，不能把独立 fixture 的对话通过写成完整救援通关。详情与诊断入口：`artifacts/pipeline/tiger-web-v3/world-smoke-summary.json`。脚掌平面支撑通过也不等于球面坡地/踏水接触验收。
- [x] 一次精确对话诊断完成：初始站位距虎 1.4142 世界单位，但原世界更新后实际对话采样距虎 10.59–18.47，24 帧均在范围外；游戏开始和阻挡条件正常。受控保持 2 世界单位时，6 帧均激活原对话（idle → tiger）。生产源码未改、救援章节未推进。证明对话链能用，尚不能证明自然靠近能触发；下一步查玩家地面/碰撞更新为何把站位推出近距。新证据：`artifacts/pipeline/tiger-web-v3/world-dialog-2026-09-08T19-47-11-400Z/report.json`；原 smoke 的失败状态继续保留。
- [x] 本地执行器增加 Web 作业，现在有六个受审查的工程任务；修改输入会重新检查，已通过且哈希一致则复用。作业数不是新优化资产数。
- [x] 恢复用户原预览地址 `http://127.0.0.1:8765/TigerMessenger/`，HTTP 200；服务写入文件日志，避免原服务空响应。启动记录 `artifacts/pipeline/preview-server/server.json`。

**下一步顺序**：1. 按新诊断核对玩家地面/碰撞更新造成的近距脱离，补齐自然相见与地形接触；2. 同家族沉淀可审查的建模修改模板，推进红蓝兵的 Web 回接/真实战斗检查；3. 接通目标 Studio 后执行真实 Qwen 工具续答与双图理解，单独验证 LLaDA Mac 推理。当前连接主机仍为 M2 16GiB，未向它下载目标机权重。Godot 完整行为迁移和前台最新资源验收仍待做。

接手时先读此节、`docs/LOCAL_PIPELINE_RUNBOOK.md`、状态页与原始失败报告，再领取具体任务；不要重新生成已有虎，也不要把工程通过自动提升为美术/玩法完成。最新读取的现有续作任务已设为每 2.5 小时检查（ACTIVE）；未改动这个外部更新的频率。下方旧记录的“每小时”仅为当时状态。执行器本身运行一轮后退出。

## 2026-09-09：睡眠期间续作检查点——本地执行链已实际运行

用户要求持续推进，准备睡 5 小时；当前原任务已有每小时续作检查，保持启用，未创建重复自动化。最新操作指南 `docs/LOCAL_PIPELINE_RUNBOOK.md`；查看 `artifacts/pipeline/local-runs/status.html`；可双击项目根目录 `Check-Local-Pipeline.command` 重跑工程作业。此执行器一轮结束即退出，持续续作仍由现有任务调度触发。

- 已实现 runner：真实子进程执行、既有队列 validation 家族租约、资源互斥、输入/报告/导出文件哈希、断点恢复与两次失败上限。修复了恢复时占着自己的旧租约，以及 SIGTERM 留下子进程的问题。验证租约不能把候选美术或玩法阶段改成完成。
- 已实现 MCP stdio 客户端；真实 Blender get_scene_info 成功（28 个工具、94 个场景对象），只读，没有改/保存前台模型。
- 已实现 Qwen 6 轮/12 调用桥接：实际 HTTP 模拟服务验证工具结果续答、资产范围、两张参考/渲染图提交、错误与停止。真实 Studio 未连接，不能把模拟服务测试称为 Qwen 已上线。LLaDA 仍未部署。
- **五项真实作业通过**：虎与盔甲分别从保存的 .blend 导出 NEW GLB，经 Blender 重导入，再由隔离 Godot 导入同一新文件；另有虎世界变换、士兵 252 姿态、城堡 20202 节点/12 层替换回退检查。第二次运行五项全部返回 cached_pass，没有重复开引擎。
- 合并本地测试 57 项＋旧队列 8 项通过。`artifacts/pipeline/local-runs/checkpoint.json` 和每项 execution/report 保存证据。五项作业不等于五个新优化资产；此轮主要交付可运行管线。
- 补齐湖沼之虎队列中的认可图、现有 v3 .blend、Godot GLB 和静态原位证据。原 source/blend 归档保留，完整行为和视觉验收仍待做，避免接手重复生成已存在成果。

尚未完成：目标 Studio 真实模型联调；LLaDA MPS；可审查的家族建模修改模板和自动区域部署；Web 新虎行为回接；活动编辑器最新资源前台验收。电脑锁屏时继续在隔离副本工作，不能声称前台已刷新。

下一条独立动作：审计原 Web 虎的工厂/动作赋值，补新几何和 rest-offset 适配，先做可回退候选与行为对照；同时扩充模型可调用的审查模板。Studio 地址未提供，不重复询问，也不在当前 M2 16GiB 自动下载目标 M5 Max 64GB 的大模型。

## 2026-09-09：本地生产线规划、虎与城堡对接检查点

用户要求减少 Astra 逐资产消耗，采用自己的 Qwen3.8-27B 与 LLaDA-Image 建立长期生产线。完整执行方案：`docs/LOCAL_ASSET_FACTORY.md`。已查官方模型卡/仓库，新增 `tools/pipeline/local/` 预检与工具调用探测包；8 项离线测试通过，旧队列8项测试通过，队列已同步92条登记与鲲/湖沼之虎名称。Qwen/LLaDA尚未配置和部署，目标硬件已知为用户的 M5 Max 64GB，连接入口尚未提供；当前主机 M2 16 GiB；常驻runner、MCP工具循环、LLaDA worker仍待阶段B/C，不能称全线运行。

本轮实际资产：
- 湖沼之虎（TigerMessenger待救援角色，非竹虎图）：真实Blender MCP三轮重塑，保留80原节点/父级，原比例与头腿尾静止姿态改造；Godot可见8376三角。`tiger_anatomy_candidate.tscn`提供用户图与同镜头对照，`tiger_world_adapter.gd`接原湖沼位置。源GLB未覆盖；Web尚未回接新形。
- 士兵：头盔和盔缨方向由+Z纠正至身体+X，裙甲/腰带/盾握持不转。`roman_armor_direction_adapter.gd`和v3GLB已接原候选UI，252组姿态与两色全身候选检查通过。v2历史图在 `artifacts/pipeline/romanSoldier/v2-before-direction-fix/`。
- 城堡：`castle_world_adapter.gd`已接`original_world.gd`，只替换原castleContainer的12个town层；共享边WFC输出92424三角/3内嵌纹理，20202原节点变换/回退检查通过。不是Godot原生WFC编辑，不是概念图完整美术复刻；山体/云和其它原环境仍需后续优化。

验证与显示：电脑锁屏，不能操作前台；为避免争抢当前编辑器缓存，复制到隔离Godot工程完成最新资源导入、虎/城堡原位部署、士兵同镜头截图。证据已复制回 `artifacts/pipeline/`，`20260909-integration-checkpoint.json`记录路径与资源SHA。主编辑器虎缓存可能旧、城堡尚待导入，解锁激活后核对重导入，再打开原世界/虎候选。不要误报前台已经显示最新虎或城堡。

下一步：1.解锁后更新主编辑器导入并前台验收；2.拿到硬件后执行LOCAL_ASSET_FACTORY阶段B，真实文本/工具/视觉/图像/Blender/Godot闭环；3.旧队列上加执行runner与图像worker，完成可中断恢复的小批标定；4.按区域接入行为，再改地形。

## 2026-09-09：鲲入库与红蓝短剑兵概念候选

- **鲲**：用户正式命名；内部 `leviathanIsland` 保留。已补独立源快照、Blender 归档、309 KB GLB，并在 Godot 资产库实际检视。清单 92 项、Godot 实例化 92 项；这不是 92 项美术/玩法完成。鲲不等于 `swamp_whale`，归档不含运行时挂载的六景。证据：`artifacts/pipeline/leviathan-kun-review.png`。
- **红/蓝短剑兵**：内置生图生成 `assets/concepts/roman-soldier-target-v2.png`，真实 Blender MCP 两轮制作头盔、10 片裙甲与独立盾把；已接入 `roman_grip_blue/red.tscn` 候选。资产库选红/蓝 gladius → 查看优化候选，可切原作/候选、四视角和三种检查姿态。
- **验证**：新盔甲纳入 252 个离散姿态的盾/身体/剑几何分离检查；全候选两色三姿态运行通过；Godot 三项新资源导入缓存与 GLB 哈希匹配。`artifacts/pipeline/romanSoldier/full-candidate-validation.json`、`shield-armor-validation.json` 保存证据。
- **仍未完成**：士兵优化尚未回接原世界的战斗/程序步行；裙甲仍为静态几何，需要腿部动作与甲片碰撞验证。鲲的六景装配、升沉/摆尾/眨眼/雨滴程序未迁移。不要把单项候选或归档当作全局优化交付。
- **接续**：先将士兵适配器用于实际战斗角色生命周期和腿部运动校验；鲲保持原世界完整根节点，补六景及行为适配后再替换，不用独立鲸体覆盖现有鲸背世界。

## 本轮收口状态：生成联动与可见资产入口

## 2026-09-09：用户圣城概念图已接收

用户上传的蓝夜峡谷灯城作为当前圣城主要视觉目标，已保存 `assets/references/citadel/user-concept-20260909.jpg`，完整执行依据见 `docs/CITADEL_ART_TARGET.md`。概念输入已具备，不再将imagegen网络恢复作为开工依赖。采用青蓝暮光/靛蓝山体、层叠浅色塔城、暖金与桃红窗灯、原水系倒影；保留原中央圣塔、街巷关系与球面世界。下一可见交付是原圣城一片区同镜头的「原版／蓝夜候选」对照。按用户最新分工：Blender只制作远山、峡谷地形地势与植物；建筑用原工程Townscaper式模块及WFC约束搭建，保留中央圣塔、街巷与原水系；Godot负责材质、布光、雾与本片区倒影。生成目标图已保存于 assets/concepts/citadel-user-reference-target-20260909-v1.png。执行与验收清单以 docs/CITADEL_ART_TARGET.md 为准；本次是计划修订，不据此声称新建模/渲染完成。


## 2026-09-09：罗马短剑兵握持候选已可见

- [x] 红／蓝短剑兵的剑柄对齐原手部；保留原几何/材质/父级/朝向，关闭恢复原变换。72组变换测试通过，最大握持误差1.093e-6。
- [x] 独立Godot候选提供握持开关、红蓝选择、站立/摆臂/瞄准检视；资产库两个条目均有候选入口，已通过真实前台点击打开。两变体三姿态和同镜头前后图验证通过。
- [x] 原档案/currentResource保留。证据与查看指南：`artifacts/pipeline/romanSoldier/GRIP_CANDIDATE.md`。
- [ ] 后续：盾牌挂点、角色实际动作与世界兵团回接；完整士兵美术/玩法尚未验收。继续城堡共享边向屋顶/门窗/庭院迁移，五架侦察机待编队/驾驶/LOD。


## 2026-09-09：原位飞机候选与共享边墙体

- [ ] 后续握持修复：罗马短剑兵原factory把剑固定在独立装备组；源/snapshot/Blender/GLB一致，非导出错位。握柄距右臂末端约0.40339（fig缩放后），原瞄准只转方向不补位置。先做红/蓝共用可回退握持适配、站立/摆臂/瞄准验证，保留原档案，不能只补动画后声称已修。

- [x] 已核对旧 `tripleGateScoutAircraft` 地标其实是整个五架防卫队的别名，生产场景没有独立 mounted .86 门区飞机。五架皆为原factory scale .72；不编造额外飞机或门区hover。
- [x] Godot原世界五架候选按sourcePath+父路径核对后同父、同完整变换接入，原子树隐藏；界面可切回原版、近看原位置。实际渲染和重复开关/挂点/46节点检查通过。`artifacts/pipeline/scoutAircraft/deployment/`。只标staticWorldDeployed；驾驶、编队、LOD、完整worldIntegrated/gameplayAccepted仍未完成。
- [x] `faceCageFromGraph`稳定顶点环直接供墙体生成；真实共享边含异色边界与空占用邻面验证。`makeExposedFaceGeometry`从同图读取暴露面和笼形，抑制重合内墙，补浮空下表面；已有cage墙面修正真实法线。
- [x] 共享边墙体实际Three几何验证：60顶点法线与实际三角面一致，36斜面法线非轴向。完整原圣城92424三角面新旧图仍一致。`artifacts/pipeline/townscaper-contract/face-body.json`、`castle-geometry-scale.json`。
- [ ] 墙体接口不代表完整城镇不规则几何已接通：屋顶、门窗、庭院、跨格部件和导航仍需共同迁移后部署；当前接口拒绝带非零高度的3D face，避免错误压平球面。
- [ ] 圣城内置生图本次重试仍因 images/edits 网络错误失败，无图像产物；完整提示词见 `artifacts/pipeline/citadel/concept-request-20260909.md`。此前请求记录的undefined已明确纠正，不把旧失败记成功。


## 当前执行状态：共享边正式接线与侦察机减负（2026-09-08）

本节优先于下方历史记录。

- [x] 新增生产 `faceLayerGraph`：稳定 face/layer、共享顶点、双向半边、局部侧对与拓扑缓存身份。`solveTownSelection`、全量缓存及增量选择接收 graph；`buildOdysseyCitadel({wfcTownV1:true,wfcTopology:"legacy-faces"})` 可进入保留原街道连接的共享边模式，编辑沿用模式与种子。默认世界未强制切换。
- [x] 原圣城默认 978 格、三个种子：新旧选择哈希全部一致。小型真实浏览器场景初始/增量/全量三角数量一致；随后拆顶、两层改色、两层恢复连续检查通过。证据：`artifacts/pipeline/townscaper-contract/castle-scale.json`、`geometry-edit.json`；不是完整原城堡的通行或美术验收。
- [x] 侦察机候选 GLB 材质分组整理：同镜头实际 Godot 绘制 85→32，图元 2104 不变；截图通道最大差 1/255。46 原节点、23 可见网格及动态挂点保留。注册表已附材料等价证据；currentResource 仍指向原归档。`artifacts/pipeline/scoutAircraft/godot/materials-review.md`。
- [x] 侦察机 Godot 候选已实现原 mounted 悬停/尾灯、manual 防卫灯覆盖与座舱/双炮口挂点；6个时刻与实际执行原JS回调对照通过（不是手写同公式的自证）。驾驶、编队、开炮和正式世界部署仍未迁移。
- [x] 原圣城完整生产工厂（978格）新旧图的92424个镇体三角面位置/朝向一致（1e-4容差）；`castle-geometry-scale.json`。
- [x] 全量重建先生成独立候选，所有区域有解才替换；故意让第二区域无解，旧几何/缓存/spec/待合并任务均保留。第三参数可合法全量改变seed/开关/拓扑，局部重建拒绝全局配置变化。证据 `full-rebuild-transaction.json`。
- [ ] 接下来：共享边继续进入角模块/屋顶/庭院与碰撞的共同几何数据路径；侦察机按原世界唯一部署位置接入交通/驾驶。
- [x] 编辑面板已接通失败反馈：保留未应用草稿/撤销栈，禁止按钮与Ctrl+S误存；成功后恢复，各城堡目标隔离。真实浏览器测试 `test_citadel_editor_apply_failure.mjs` 通过。
- [x] Godot世界GLB的874个重名材质已唯一化；完整BIN哈希、其余JSON/PBR完全不变，生产导出器同步修复。通过Godot自身重新加载后，源MD5与导入缓存一致；`artifacts/world-migration/import-repair/editor-reload-verification.json`。历史递归导入错误不能仅凭材质修复宣称同源。
- [ ] 未完成：任意不规则 face 布局的完整几何装配、主线路径可达性、原世界动态迁移。legacy-faces 保留原方格街道，并不是已经生成 Townscaper 式不规则城堡。
- [ ] 圣城概念图此前两次内置生图网络失败，无新图像；已有原作三镜头参考可用于几何工作，不能把失败记成生成成功。


- 角图底部统一；WFC增量影响与几何替换做同一闭包；各区域独立缓存、种子持续、增量无解保留旧画面。小夹具实际浏览器增量/全量均3846三角形；原正式源布局978格的3种子全部可解。
- Godot资产库默认展示注册表currentResource，书店默认第三轮（含石径与花丛、材质/墨线适配），可切“查看原始归档（优化前）”；侦察机独立候选通过注册表入口检视，不替换正式世界。Godot实际渲染/切换/布局测试通过。截图 `artifacts/world-migration/registry-current-bookshop.png`。
- 原圣城3视角参考及真实半边迁移原型已保存。圣城目标图两次内置生成均网络失败，没有图像产物；见 `artifacts/pipeline/citadel/concept-request.md`。不要重复声称已生成。
- 下一可执行项：先让真实face邻接与原街道边保持一致，再让角模块装配消费定向求解结果；验证旧城堡屋顶/庭院/门口真实编辑；继续侦察机材质批次合并与行为回接。不要直接把候选GLB放到正式世界后标已验收。

## 2026-09-08 侦察机候选进入 Godot 检视

- 已从Blender候选导出 `godot/assets/art-pilots/scoutAircraft-art-v1.glb`，46原节点/挂点保留，18隐藏描边壳在适配脚本内隐藏，23可见网格，玻璃做明确Godot材质适配。
- 注册表 `replacement` 指向候选GLB和 `res://scenes/scout_candidate.tscn`，`currentResource`继续原归档；没有标为worldIntegrated或gameplayAccepted。
- 统一资产库现在按注册表显示“查看优化候选”按钮，后续资产可用同一入口。侦察机选中后可打开候选；检视器布局/取景/入口测试通过。
- 实际图片/验证/差距：`artifacts/pipeline/scoutAircraft/godot/`。当前玻璃非真实折射，座椅/面板/墨线尚待完善；单模型检视含UI约81draw，性能未收口，不能把导入当优化完成。
- 部署名称匹配可用 `tools/build_world_deployments.py` 重现：只读跑得到41/91匹配；`--write`更新候选位置清单，不自动替换。名称匹配不能证明父子归属与具体变体。

## 2026-09-08 后续实作：WFC 对应到实际几何重建

- `cornerGraphAdapter`纳入底部iy=-1，`cornerAssembly`删掉独立补底分支。同一图驱动全部装配，空/单格/三层/阶梯四例实际生产装配的网格数、顶点SHA及边界均与修改前一致。
- `odysseyCitadel.rebuildCitadelTownIncremental`在生成与删除前统一WFC影响分量和跨格构件闭包，避免选型改变但旧屋顶遗留。各terrace独立保存上一解；初建和编辑保存seed/显式开关。所有terrace成功才替换旧几何；增量无解保持旧几何和旧选择，不提前取消待合并装饰。
- 浏览器实际调用生产装配，12列两层建筑加一顶层格：重建25格，同布局增量/全量均3846三角形；种子37保持；两个非空terrace缓存各为24/2格且独立。小夹具编辑约25ms，此数不代表全圣城性能；还需正式原城堡、多轮编辑、碰撞和可达性验证。
- `tools/pipeline/test_wfc_geometry_browser.mjs`、`artifacts/pipeline/townscaper-contract/geometry-edit.json`与截图保留。对比只证明本夹具数量与接口，不把三角形数量相等宣称逐像素等同。
- 新真实半边原型验证了两端局部侧（含E:E）和反向共享边。`docs/TOWNSCAPER_TOPOLOGY_MIGRATION.md`记录现存位置双射破坏邻接反例；正式街道迁移必须先保留原连接关系再变形，未把原型直接覆盖当前城堡。

下一项：原圣城三个实际视角捕获 → 图/几何共用真实邻接的小批迁移；侦察机Blender候选→Godot独立检视并行。全机制清单仍有真实邻接和全局可达性两项未满足，不声称Townscaper复现完成。

## 2026-09-08 最新执行入口：原作全球、并发资产与 Townscaper 机制

本节优先于下方历史检查点。用户最新要求：完整 R160 原作世界为正式迁移对象；旧 R32 六地点实验游戏保留为镜像小岛的实验空间。不能用小球实验关卡代表完整原作。

- 当前 Godot 默认入口 `res://scenes/original_world.tscn` 已载入原 Web 组装世界的静态部署，含 21 个地标引用；这不是完整动画、战争、交通和主线迁移。源为新浏览器默认状态，不含用户已有浏览器的本地存档修改。GLB 的云、海洋等自定义着色仍需专门适配。
- 统一库 `godot/data/asset-registry.json` 已含 91 条目（原72 + 补19载具/角色配置），全部有归档与Godot实例检查；条目数不是91项美术验收。41条根名称匹配只作为部署候选，变体与父子归属仍需确认。
- 并发执行入口 `docs/ASSET_PIPELINE.md`、`tools/pipeline/asset_pipeline.py` 与 `assets/pipeline/queue.json`。同资产/家族互斥，前台Blender编辑单写者，概念准备与Godot集成可并行；未过行为/视觉验收不得标完成。
- 侦察机已生成原作参考概念，并由真实Blender MCP迭代两轮保存 `assets/models/optimized/scoutAircraft-art-v1.blend`。保留46原节点与变换，改善座舱穿模和玻璃；尚未回接Godot，玻璃需引擎适配，座椅/墨线仍有差距。证据 `artifacts/pipeline/scoutAircraft/model/visual-review.md`。
- 用户全球参考保存到 `assets/references/world/layout-reference.png`。`docs/WORLD_LAYOUT_V2.md` 与 `godot/data/world-layout-v2.json` 提供完整360°候选：14区域/19路线，保留区域内部设计，海运、迁徙与生态预留各有责任。Godot `res://scenes/world_layout.tscn` 可转至另半球、选区域、返回原作；这是导航规划覆盖，不是陆地面积验收，原地形/坐标未改。
- Townscaper 改造以机制正确性为准：先看作者访谈/原WFC库/已有演示帧，再做反例测试。最新矩阵与测试见 `docs/TOWNSCAPER_MECHANISM_AUDIT.md`；重点为真实face邻接、角模块解与装配一致、增量编辑传播、几何接缝和全局可走性。不能只检查功能开关，也不能只靠概念图证明算法。

本轮已修复求解器局部影响区过小导致的提前失败：按需扩大到受影响连通分量，固定无关分量；4项回归通过。完整机制检查9项通过、3项仍待满足。尚未据此声称正式城堡的几何重建及玩法已验收。

当前顺序：将求解变化范围与真实几何重建对应 → face/half-edge迁移与角模块合约 → 原城堡同镜头模块迭代/可达性 → 按全局布局准备地区唯一归属及地形迁移。资产候选和Godot回接并行，书店历史已完成项不重复制作。


# TigerMessenger 当前工作检查点

## 本轮续接：Godot 原作书店近景林带

用户继续后按资产路线执行。主代理核对五项资产实际用途、提取源数据；Godot书店协作任务负责native局部替换/碰撞/截图/六地点路线。原nature明确houses.count=0且street=[]，因此不恢复随机房屋/街灯/电线杆；本批只接实际corridor林带，排除近景旧实验装饰。

主代理已完成：`docs/BOOKSHOP_ASSET_LEDGER.md`；`tools/capture_bookshop_surroundings.mjs`从完整默认Web世界取书店18m内6棵现场树，保留各自枝叶形态、原色区、根尺度/朝向、碰撞尺度与墨线。数据`godot/data/bookshop-surroundings.json`约1.07MB，282个原表面mesh合色区，3876表面三角形+等量墨线。只读Web源场景，不改blend/GLB。`test_bookshop_surroundings_data.mjs`合约与SHA/法线/墨线检查通过，来源截图已查看。此前说的五资产批次不是硬把停用资产搬回来。

Godot协作接入已通过并由主代理查看实景前后。14m内8座实验建筑与12棵实验pine不再生成，6棵真实原树的局部XZ/scale/yaw保留、树根射线贴当前共用物理地形，按7色+2墨线合批。两棵边界旧松虽AABB交叠，精确表面交叉测试为false，因此范围保持14m，不额外删树。远处保留模型完整变换/scale指纹与legacy对照一致，RNG序列保留。703→565draws、157902→169722图元；出生→书店→门前/墙体/R与6地点12.5秒步行通过。证据`artifacts/bookshop-context/`。全世界地形和其他章节仍为后续，不能把局部替换叫完整世界迁移。

## 最新执行：并发资产工作与石板路遗漏

用户要求并发，并指出静态图有石径而游戏没有。主代理回接 Web 石径，Godot 书店协作任务独立移植两阶明暗材质。Web 原因是4块 Entrance path 位于 scene 根，不属于 shop.children；另有源cube面向内问题。后台 Blender 只读v3，独立导出临时评估网格纠正绕序；输出4块176三角形，一次绘制，真实地形+原土坡贴地。原blend哈希不变。

`test_bookshop_path.mjs`最终通过：4块顶面皆在地面以上，真实W移动、落地/R章节0→1、无页面错误。前后draws2997→2998，同步渲染对照已查看；用户当前IAB也已看到路。证据`artifacts/bookshop-path/`。首轮测试发现背面问题失败后已修复重跑，不隐藏失败。旧书店运行时拓扑零像素差异/招牌编辑/回退复测通过。

Godot材质最终已通过并由主代理查看前后截图：76网格/181材质面复用9个shader材质，原颜色、招牌纹理、窗框双面和原墨线保留。真实步行、墙体/R通过，无失败；703绘制/157902图元前后不变。4块Godot原石板双面可见，未改源。证据`artifacts/bookshop-materials/godot-validation.json`。下方历史待材质叙述不再是当前状态。

本轮用director并行分工、graphics技术美术/authoring、QA实际场景对照；对应参考已读。无付费生成，无前台Blender操作。下一步先收Godot验收，再续原作书店近景批。

## 2026-09-08 用户要求整体资产规划

已读 director、项目约束、72 项导入映射与实际救援章节。新增 `docs/ASSET_ROADMAP.md`：7 个制作分组覆盖 72 项，按书店→门/苔庭→旧港→湖沼→圣城路线组织交付，角色独立高优先，避免父场景/子件重复计量。明确目录之外剧情对象与程序系统的漏项、Web/Godot 独立状态、每批实景验收和性能证据。同步 PLAN/TODOS/HANDOFF。

本轮使用 director 的场景级交付与连续检查点流程，仅规划和清单核对，不启动外部生成、不更改模型或游戏。下一小批是书店两阶材质、五个相关资产的运行时依赖记录、Godot 原作近景；虎准备不阻塞书店。

## 2026-09-08 续接：书店入口林带与 Godot 毛笔墨线

- Web：新增 `src/scenes/messenger/bookshopLayout.js`，林带工厂在原随机消耗后执行局部避让，释放拒绝树的独有几何、不注册其碰撞；其他树材质/形状不变。默认世界 3 棵避让、38 棵保留。
- 验证：`tools/test_bookshop_site.mjs` 通过。无轨道夹具 47→45，保留树造型/变换完全一致、碰撞一一对应；真实世界招牌 9 采样与入口 3 条射线无树遮挡，W 实际移动、落地、R 章节 0→1、无页面错误。`test_landmark_corridors.mjs` 五项通过。
- Godot：`bookshop_ink.gd` 与专用 shader 在真实主场景合批 26 个原建筑部件，绘制 702→703、图元 157486→157902。开/关对照 1181 像素变化，行走/碰撞/招牌/R 交信通过。主代理已查看 Web 游戏截图与 Godot 双图。
- 技能沿用 director/graphics/QA 的来源映射、预算和真实运行验证流程；未生成新概念图，未修改前台 Blender 或保存 v3。
- 初始玩家相机新增 9 个招牌射线采样，复查通过。用户当前标签页实查揭示旧林带模块仍被缓存，场景入口已给 nature.js 加本次版本标识；不清除地图/剧情存档。Blender v3 SHA256 与此前完全一致。

证据：`artifacts/bookshop-refinement/README.md`。Web 截图为软件渲染检查，不能当设备帧率基准；近景保留完整世界，经过的原作飞行器可能遮挡部分建筑，不隐藏对象伪造全无遮挡画面。Godot 两阶材质、周围原作完整环境及整体性能仍待后续。

## 2026-09-08 最新：书店 v3 实际环境回接

已核对旧文档落后于文件：存在第三轮 Blender 与 GLB，此前只接到检视场景。现已将 v3 接入 Web 默认书店和 Godot 默认主场景书店地点。Web 使用 Blender 评估网格与窗框，保留原墨线/招牌编辑/地形/任务引用；Godot 使用实际 GLB 并适配球面外裙及碰撞。Web 门前绣球同步第三轮两侧布局。

证据与脚本：`artifacts/bookshop-integration/README.md`、`tools/test_bookshop_art_integration.mjs`、`godot/scripts/test_bookshop_integration.gd`。Godot 实际步行与 R 交信通过；Web 完整世界行走、碰撞和接信通过，花丛布局调整后的最终复查也通过，实际游戏截图已查看。原拓扑零像素差异回归也通过。

前台 Blender 仍含未保存虎与书店场景，未覆盖；保存 v3 未改。原 8765 服务本轮返回空响应；已在仓库根启动 8767 本地预览。无付费生成任务。本批实际加载/沿用 director、gameplay、graphics、UI、debug、QA 技能；相关 authoring-recipes、technical-art、shader-cookbook、visual-test-harness、evidence-manifest 已读取。

下一项：用户在实际场景检视书店；进一步改善 Godot 墨线/材质及书店镇原作环境。周围旧实验内容和完整世界迁移尚未完成。

以下均为历史检查点，优先级低于本节。

## 2026-09-08 新增：概念图驱动的美术迭代

采用用户给出的「概念图 → Blender MCP 建模 → 固定镜头游戏截图 → 逐项改进」流程。书店目标图已生成，MCP 已修改并保存独立 `bookshop-art-v1.blend`；仍待渲染审查与游戏回接。详见 `docs/美术截图迭代.md`。不把 72 项几何导入或概念图当作美术优化完成。


## 2026-09-08 实测检查点（优先于下方历史批次）

- 72/72 原作 GLB 已写入 `godot/assets/originals/`，已由 Godot 4.7.2 导入并逐项实例化成功。
- `artifacts/godot-export/glb-validation.json`：72 项可见三角面数量与原快照一致，无不匹配；`godot-verification.json`：72 项加载通过。
- `asset_review.tscn` 已实现独立视口、原名选择、旋转/缩放/重置、缺口提示和按需释放；行为测试通过。7 个代表模型有实际 Godot 渲染截图，书店与虎已人工查看。
- 全部暂标 partial：原作档案导入完成，不等于 72 项造型优化或游戏回接完成。墨线、程序动画、碰撞及交互仍需迁移；虎仍为旧造型。Web 回接仍为 2 项。
- 新导出器保护旧资产目录和已有文件，保留原 blend，不触碰前台未保存编辑；每项保存日志和报告。线段保留，关闭非 Points 模型的散点导出。
- 下一条动作：在检视器完成书店/虎狐材质和墨线适配及同角度对照，然后建立原作书店可走可投递的 Godot 场景。继续按真实虎参考重塑；缺生成凭据不阻塞本地工作。
- 操作方法：`docs/原作资产检视指南.md`。当前主场景还是旧实验关卡；请运行 `res://scenes/asset_review.tscn` 检视原作。


更新：2026-09-07。

## 最新意图

用户要求使用已安装的 majidmanzarpour Three.js 技能包、配置 Blender MCP，并改变美术改善方式：莫比斯世界参考漫画，传统文明参考真实图像。湖沼虎需要按真实虎重新生成，当前猫样体态不再作为保真目标。保留旧版并延续角色与世界身份。

## 已完成

- 原有基础：72 项 Blender 候选、63 项重复顶点整理、2 项 Web 几何回接；尚未导入 Godot。
- 已读取 threejs-game-director、threejs-3d-generator、threejs-image-generator 及生成恢复说明；还读取了内置 imagegen 与 MCP 配置相关技能。
- Blender MCP 1.9.1 安装、Codex 注册、前台插件启用、遥测关闭；真实 MCP 握手和当前场景读取成功。
- 已下载并检查 USFWS 公有领域成年孟加拉虎参考，位于 assets/references/tiger/，许可和来源另有 source.json。
- 莫比斯漫画与真实传统环境参考清单在 docs/ART_REFERENCES.md。

## 本轮未完成与依赖

- 虎概念图已生成并查看，保存为 assets/concepts/moebius-tiger-anatomy-v2.png。已确认四足、虎头、圆耳、肩胸及原墨色身份；这是二维概念，尚无新三维网格。后续复用此图，不重复生成。
- Tripo / Gemini / ElevenLabs 凭据探测均为 MISSING；没有向这些服务提交付费任务。
- 已询问用户选择在本机配置 Tripo 或按图使用 Blender 重塑。不要让用户在聊天中粘贴密钥。
- 新虎三维模型、动作与游戏/Godot 回接尚未完成。概念图不是三维模型。

## 下一步

新虎三维路径仍等待用户选择或 Tripo 凭据，只挂起该依赖项。下一位负责人先执行 docs/TODOS.md 的 H01 → G01，推进不依赖生成服务的 Godot 原资产导入与检视场景；新虎条件满足后再继续三维重塑、动作和回接。

## 跨模型交接

用户已授权其他开发模型接任整个项目负责人。接手流程见 docs/PROJECT_HANDOFF.md；Codex 额度不足不构成等待理由。已新增工作区及游戏目录 CLAUDE.md 作为入口。本轮完成交接文档，未启动 Claude 或自动调度，未提交新的生成/导入任务。现有成果大量未提交 Git，接手时保留全部本地修改并核对进程与未保存 Blender 内容。

## 原件与当前前台

前台 Blender 打开 moebiusTiger.blend 且已有未保存内容。不得直接打开另一文件覆盖或保存原件。必要时使用独立工作副本/新场景，并确认未保存编辑得到保留。

### 正式源布局规模验证与前台检视

`test_castle_wfc_scale.mjs`直接读取HIGHLAND_TOWNSCAPER_TOWN_SPEC（12层/978占格），种子1、37、20260808全部求解成功，约15–34ms（只含求解，非完整城堡帧耗时）；证据castle-scale.json。尚未把拓扑原型接到正式街道，也未宣称战场可达性通过。

通过Godot前台真实点击：原作全局→91条目资产库→三重门侦察机→查看优化候选，已确认显示候选；可拖动旋转、缩放、返回资产库。镜像实验关卡headless启动10帧无脚本错误，仍不代表完整通关。
