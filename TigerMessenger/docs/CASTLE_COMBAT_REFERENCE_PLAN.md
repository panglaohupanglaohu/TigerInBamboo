# 原作古堡 WFC 与战斗参考实施合同

核查：2026-09-08。目标是在原作半径160的完整世界上延续既有古堡算法和战争，采用 Townscaper 的模块生成思路、Bad North 的战术可读性与概念图迭代。本文为只读源码/公开来源核查及移植规格，不代表本轮已生成概念图、启用WFC或移植战斗。

## 参考事实：两个游戏、同一位核心创作者、不同职责

Townscaper 的开发者是 Oskar Stålberg，发行商 Raw Fury；它把玩家在不规则网格放下的彩色块按配置转为房屋、拱、楼梯、桥与庭院。[官方商店说明](https://store.steampowered.com/app/1291340/Townscaper/)

Bad North 由 Plausible Concept 开发，工作室由 Oskar Stålberg 与 Richard Meredith 创立；不是“Oskar单人完成的所有战斗系统”。[开发团队官方介绍](https://www.badnorth.com/team)

Oskar 在 IndieCade Europe 2019 的演讲摘要明确将 Marching Cubes 和 Wave Function Collapse 组合，用于交互速度的城镇生成。WFC 原作者项目 README 也记录了 Townscaper 的不规则网格组合、Bad North 关卡生成与可行走区域启发式。[大会演讲页](https://indiecade-europe.eu/en/programme/conferences)、[WFC 原作者仓库](https://github.com/mxgmn/WaveFunctionCollapse)

WFC 在这里负责约束满足与模块/地形生成；行走表面、路线通达性可作为约束或生成后验证。**小队下令、单兵避让、攻击/反击、登陆/撤离属于战术与运动系统，不叫WFC战斗。** Bad North 官方强调地形卡口、站位、反应与撤退，以及每名单兵的独立模拟。[官方游戏说明](https://www.badnorth.com/press-kit)

可回看的原作者讲座：[Wave Function Collapse in Bad North，EPC2018](https://www.youtube.com/watch?v=0bcZb-SsnrA)、[Organic Towns from Square Tiles，IndieCade Europe 2019](https://www.youtube.com/watch?v=1hqt8JkYRdI)。本轮检索核实讲座链接/大会摘要；未获得完整视频转录，不冒称已逐帧看完。参考只用于机制和风格研究，本项目使用用户原网格及自行制作副本，不导入这些游戏的角色/贴图/声音资产。

## 当前原算法：保留什么，哪些开关实际未开

| 层 | 已有实现 | 必须如实保留的边界 |
|---|---|---|
| 通用WFC | `src/procgen/wfc/moduleSchema.js` schemaVersion=1；socketCompiler → compatibilityTable → solver；solver有pins、bans、有限回溯、失败原因、稳定solutionHash；变体数到256切support-count传播 | 直接复用编译器与求解产物，不在Godot写简化随机房子替代。失败必须报告，无解不算完成 |
| 古堡体块角色 | `src/world/citadel/wfcTownSelection.js` 把格图送入上述求解器，输出byCell；townModulePrototypes定义body/tower/passage/gable/hip/cone/terrace/flat/garden；六向socket、Y4旋转、暴露/同色邻接和policy | WFC决定体块角色，窗/栏杆/花箱/支架是后续装饰，不是拿一个“8家族哈希”冒充求解 |
| 实际接线 | `citadelTown.js:1570` 使用ctx或P.wfcTownV1；`core/params.js:83` 默认false。增量路径wfcIncremental，普通路径resolveTownSelection，统一roleOracle | 代码已有算法 ≠ 正式画面已启用。先记录用户当前URL/开关/存档，再用相同布局可切换A/B求解；用户已要求WFC，可在完成可见传播及路线验证后正式启用，不能无截图直接翻开关 |
| 不规则格与形状 | gridMigration schemaV6、irregularSkeleton；moduleFrame/cageDeform；cornerGraphAdapter/cornerPrototypes/cornerAssembly | 要输出真实face/cage与映射，不只输出整数格坐标。cornerModulesV1当前默认false，不能把“角落模块完整投产”写成事实 |
| 原模块和编辑归属 | `citadelTown.js:1764` registerModule 的townModule含family/variant/ix/iy/iz和openFaces/roof/supportBelow/continuationAbove；decoratePass及建筑归属机制 | 网格合并后仍需保留单元→三角面区间/资源实例映射；编辑一格不能留下旧窗、孤立支架或跨模块灯光 |
| 当前连续圣城 | `odysseyCitadel.js:2619` 高山与运河共享逐格Townscaper承重面；:2636 externalTownscaperCity=true；`highlandCitadelDesign.js` 保留山壁/方尖碑/山脊副塔/水岸/室内楼梯 | 外围构图和城格生成应分层。恢复已退休五台地、梯湖、瀑布、断口会破坏用户当前设计 |
| 地形WFC与名词陷阱 | `highlandCitadelDesign.js:215` solveHighlandTerrainTiles确有域收缩/传播；:1051 solveHighlandCastleUnitGrid按行列抽family/variant并写socket标签 | 后者代码没有邻接传播，只凭algorithm="townscaper-wfc-v1"标签不能证明WFC。当前共享城格入口也不应被这个旧构图分支替代 |

山谷模式的硬条件来自 `src/scenes/messenger/loadCitadel.js:53`：presentationMode=mountain-valley-v1，cascadeEnabled=false、cascadePoolsEnabled=false、notchedLayers=0；:137 v4Runtime=null。`citadel/pipeline.js` 的compileCitadelV4和worldSnapshot有可借鉴接口，但不能直接重启整条旧五台地管线。最新主城仅terrace0是真实空间，其余空terrace只是存档兼容槽，不能渲染成台阶山。

## Godot 消费的包：复用现有产物，补一层可序列化封装

目前没有一个已验证的“山谷城WFC→Godot完整合同”。下表的**源字段**已经存在，**封装字段**是待实现建议，二者不混写。GLB保存形状/材质；JSON保存生成、编辑、寻路与事件语义。不能把JS函数或Map直接JSON.stringify后声称逻辑已移植。

| 建议包字段 | 可直接提取的源字段 / 正确含义 |
|---|---|
| `schemaVersion`, `sourceRevision`, `sourceMode`, `seed`, `flags`, `sourceSaveHash`, `radius`, `regionMatrix` | 新封装；锁定mountain-valley-v1、160、真实生效布局/开关与最终matrixWorld；不二次缩放 |
| `grid.schemaVersion`, `grid.faceIds`, `grid.corners`, `grid.centroids`, `grid.mapping`, `grid.hash` | 来自gridMigration/gridV6；稳定faceId与legacy cellKey双向映射；四边笼子和坐标轴必须明确 |
| `selection.enabled/ok/byCell/hash/unresolved` | resolveTownSelection及wfcReport。byCell[cellKey]现有family/variant/rot/key；求解失败不能拿别的seed/随机结果悄悄填补 |
| `prototypes[]`, `variants[]`, `compatibility` | schemaVersion1；faces按N/E/S/W/U/D，connector/parity/walkable/sealed/load/support/clearance/portal；builderKey/tags/rules/orientationGroup。将typed arrays/Map显式转为数组/字典，稳定排序 |
| `modules[]` | 新封装引用原townModule、cell/face ID、variant key、GLB node或mesh资源、局部matrix、cage corners、可见性、owner、surface/triangle range。不能丢失shared roof/ridge的多格所有权 |
| `geometry` | 实际Blender优化副本GLB：positions/indices/normals/UV/colors、primitive/material、厚度/背面显示、原墨线；动态窗/门/绳索保留节点；碰撞独立网格，不拿合批装饰冒充可走地板 |
| `surface[]`, `portals[]`, `navEdges[]` | 新封装，取**现山谷实际**walkSurface/门/室内阶梯/地形。含surfaceId、三角形/normal、width、clearance、bidirectional、active、cost、destination；无实体表面不可只因格相邻连边 |
| `assaultAnchors` | `highlandCitadelDesign.js:2147` 已有destination、surfaceProvider、feetClearance=.22、keepTop、approach、stairRoute、interiorFloorRoutes、floorCount、ladderPolicy="disabled"、ladderLanes=[]、captureMode="interior-rotating-stairs" |
| `actors[]`, `spawns[]`, `events[]` | 新封装：稳定unitId、faction/role/equipment、squad/vehicle/seat、初始状态/动画挂点、任务触发ID；运行中的状态机由Godot脚本消费，不烘进静态JSON函数字符串 |
| `validation` | 新封装：网格/模块/解hash、邻接冲突、保留通路、模型/碰撞对齐、不可达/窄道、截图与行为报告路径；未通过字段明确false |

Godot先消费既有JS编译结果，允许美术/编辑变更后离线重编译。后续如果需要原生实时编辑，再按同schema移植或调用求解器，要求同seed同assignmentHash与相同增量影响区，不能因为引擎改变就全城重随机。有限回溯失败要保持上一有效城快照并显示受影响单元。

## 当前战争实现与实际启用边界

- 苔庭主战斗入口：`loadCitadel.js:275` → createSaihojiPhalanxBattle；`updateIsland.js:118`逐帧更新。已有红/蓝缨、盾矛/短剑/长弓、船运、集结、鲸相关事件、受击反击与攻城阶段。
- 当前圣城战斗取 highlandAssaultAnchors；`saihojiPhalanx.js:1850`消费interiorFloorRoutes，沿外部阶梯到塔内旋梯，目的castle-top。不是沿旧五层台地攀升。
- `citadelTacticalGraph.js:563`已有分区路径+A*、危险/宽度加权、单向边、占位/预约、绕障重寻路；但 `loadCitadel.js:384` 仅 FEATURES.citadelCombatV2 && !latestAssault 时创建。**最新山谷分支当前没接这张图**；迁移时重用算法思想/纯数据部分，需从当前表面重建图，不能导出旧图充数。
- `agents/citadel/squadDirector.js`目标/阵位与单兵分离；movementMotor通过SurfaceProvider投影、失败刹车；siegeDirector有land/gather/probe/breach/seize-gate/climb/push/retreat及防守命令。这些是可复用组件，不能因为存在于仓库就声明当前正式战役全走此框架。
- 先锋舰队分工由vanguardAssault/scoutDefense/vanguardTrooper运行；27人花名册是当前代码值，3架泡机各2人、3艘登陆艇各7人并含看护。受攻击→部署→作战→回自己的载具的生命周期要保留；不让刷新任务无限生兵。

## Bad North 参考怎样变成可测交付

官方资料支持“站位/卡口/撤退/独立单兵模拟”的方向，下列数值是**本项目拟定验收阈值**，不是声称Bad North内部使用同样数值。

| 战术质量 | 本项目场景 / 验收 |
|---|---|
| 登陆前有反应时间 | 在真实苔庭岸边选择至少2个空间分离的合法登陆点；船在入战前可见；危险提示后保留不少于3秒的可下令窗口；登陆点/宽度从原岸线取，无法满足则显式报告地图约束 |
| 卡口和高地有意义 | 同seed固定编成，比较开阔地与窄口防守，记录伤亡、接敌时间、同时接战人数；至少能观察不同结果和走位选择，不用纯血量倍率假装地形战术 |
| 玩家命令与单兵自治分离 | 小队接到hold/move/retreat后的下一模拟tick登记命令；单兵自行占位、转身、受击、追击；同目标下无重叠瞬移，死者不再领阵位 |
| 可行走性支撑战场 | 全部任务必经岸口→广场→入口→塔内各层→城顶可达；路径段必须落真实surfaceId；无穿墙/跨空跳边；楼梯/通道宽度至少容纳对应兵半径与余量 |
| 围堵与撤离可靠 | 临时封一个非唯一通道可刹车/重寻路；唯一通路被堵时不穿墙，应等待/回撤并记录阻塞；存活兵能归还原载具座位，无重复unitId |
| 兵种外观和战斗读得懂 | 同游戏相机看清盾、矛、弓/箭、红蓝缨和重甲枪刃；长弓上弦/拉弓/放箭分阶段；重甲充能预警后放电，不只播同一挥臂 |
| 生成改变而故事不坏 | 对现布局及至少10个受限测试seed验证邻接、门口净空、登陆到目标路径；编辑一个城格后只重建受影响区，主线硬锁与家人逃生路径不丢 |

通达性是硬门槛；战术优势是需要A/B实测的软目标。WFC局部邻接通过不能保证全局可达，要同时验证路线/门/楼梯与进攻防守可用区域。

## 概念图输入与截图迭代

已确认本地可用参考：`docs/citadel-s19-frames.jpg`（商店短片12帧）、`docs/sheet_0.jpg`至`sheet_3.jpg`、`sheetA.jpg`、`sheetB.jpg`、`z1.png`、`z2.png`；用户提供原录像 `docs/824177437-1-208.mp4`的路径见CITADEL_BUILD_PIPELINE_PLAN.md。本轮已实际查看S19拼图和z1立面：共脊屋顶/栏杆随占格改变、暖浅墙砖/蓝窗与橙瓦可作为局部视觉参考。它们是Townscaper参考，不是TigerMessenger原圣城实景，不能取代原作构图输入。

需要主制作从当前完整Web世界抓取三张原作基准，连同camera/projection/timeOfDay/feature/save hash保存：①港湾望向连续圣城与方尖碑；②苔庭海岸的守军/舰队/鲲全战场；③城内人高视角展示可走巷道、门洞、塔内入口。现 `artifacts/godot-export/citadelWatchtower-godot.png` 仅单塔，不能充当圣城基准。

以原作三视角为构图硬约束，用内置生图生成“目标图+区域标注”，保持山谷/水岸/原城格、真实尺度、主线道路与英雄身份；Townscaper参考只影响模块衔接和材质细节，Bad North参考影响战术可读性。生图无法证明WFC、碰撞、战斗或通关已完成。

Blender MCP优化原模块副本，先一组墙/角/屋顶/门洞/楼梯，保留socket plane、cage、尺寸与owner；导出回同编译格图后在Godot原世界固定镜头比较。对照按轮廓/层次/色板/材质/路口可读性分项记录，先改最大差距，不以像素完全相同作为艺术目标。另做几何/节点/通路回归防止优化把洞封住或把护栏伸进兵路。

## 下一步与状态

- [ ] 捕获当前正式城格/开关/存档与三视角原作基准。
- [ ] 复用已存在求解器，对同一原布局跑WFC开/关对照，显示共享屋顶和晒台转墙的传播；本轮未执行。
- [ ] 建立上述Godot可序列化包并核验当前山谷surface/assaultAnchors，不导入旧五台地图。
- [ ] 一组原模块Blender→Godot回接，按真实战场可达性与美术目标迭代。
- [ ] 接真实登陆/守口/撤离与家人逃脱事件，保存固定seed游玩证据。

注意：旧文档提到 `tools/test_wfc_town_selection.mjs` 等历史测试，本次当前 tools 目录未找到wfc/citadel命名文件，不应报“重跑通过”。接手需定位真实测试位置或针对当前接口补齐必要测试；历史文字不替代本轮执行证据。
