## 2026-10-05 高山圣城五小时批次与局部城堡WFC

沿用 `OSKAR_DEEP_RESEARCH_STATUS.md`、`OSKAR_WORLD_ENGINE_STUDY.md` 与顾问技能中的公开研究。手工模块、兼容选择、建筑邻接和局部编辑是设计参考；球面变形、草缘阈值、色板与双层拱体均为本项目实现，不归称Oskar原始算法，也未新增完整音画观看结论。

默认 `citadel-mountain-20261005-r19` 保留真实峰冠高差、宽岩台、受硬边约束的岩面法线和最终表面植被承托；以较淡中性石灰岩改善层次，额外地形遮蔽未启用。无云同机位图、日暮夜分开验证；山地云仍是柔性雾片，不声称还原Oskar体积云。独立六图63/100，湾折壁、尖草缘和弱暮色仍未解决。证据 `artifacts/pipeline/citadel-five-hour-20261005/review.html`。

城堡 `junctionWfcPassage=2` 用上下socket真实求解6格3组双层拱；保留其它区域和基础。实际右键、承重拒删、撤销及重做通过；中央净高2.30m，外部2.70m地基落差未解决，默认关闭。属于局部WFC几何试验，不代表全城已被WFC重建。证据 `artifacts/pipeline/junction-wfc-passage/review.html`。

## 2026-10-04 十二门徒三小时实景迭代

依据既有本地 Oskar/Bad North/Townscaper 研究及用户澳洲十二门徒目标图，采用手工大体块优先、接口兼容、最终表面附着和本色/明暗分离的项目适配。实际图、源版本、独立评分与差距见 `artifacts/pipeline/twelve-apostles-three-hour/review.html`、`manifest.json`。本轮自制SDF岩体、枝叶网格、2.5D光照及球面水线，不是作者原资产/私有引擎，不宣称完成所有视频音画学习。最终69/100，地质断面及破碎岩肩仍需深化。

## 2026-10-04 Oskar 深入研究增量与顾问技能更新

完成游戏系统/大会/动图三份专项研究和总报告 `docs/OSKAR_DEEP_RESEARCH_STATUS.md`，12段相关动图197个去重时间点实际检查；Beyond镜像文字读至51:39。修正云原帖编号与旧媒体发现页归属。仓库及个人Skill新增表现和模块实施规格，顾问定义接入总报告。可视页：`artifacts/research/oskar-deep-20261004/review.html`，12张图、17个本地链接检查通过。**完整大会音画观看仍为0，全X目录未遍历，原始全量学习目标保持未完成**；读取限制在证据清单记录，不归因用户未登录。本轮未改游戏场景或部署新引擎。下一步按可得的新原始视频/全文字幕补缺口；实现请求按技能的最小样区推进。

## 2026-09-28 主山脊结构四轮修改（已接入）

本轮按用户授权重构裸山高度分布：人工主脊/支脉图、较低鞍部、局部沟槽、两轮受约束平滑；保持城基、海岸底边、铁路和步行面固定。默认启用，citadelRidges=0 可看本轮之前。保留原始快照及四轮四机位实景，review: artifacts/pipeline/citadel-ridge-structure/review.html。

最终 23049 次铁路净空探针零命中，后山最小海面余量 0.647m；500 个步行网格/30057 顶点 hash 83626823 不变；1000 个建筑网格记录完全相同；99 树+116 灌木无悬空，4 项边界/鞍部单测通过，非有限顶点及页面异常均 0。实际查看 r04 日夜画面；仍有陡崖/植被密度等目标差距，不宣称整体写实达标。未实施完整新地形模块 WFC 或水力侵蚀；用户追加 Bad North 调研已确认 WFC+手工地形模块+通行启发式，来源与下一步记录 docs/CITADEL_TERRAIN_ALGORITHM_RESEARCH.md。缺失的 threejs-game-director 技能未加载，未使用子代理。旧的桥位/城墙通路等任务未混入完成项。

## 2026-09-28 新旧城配色落地

完成伊斯坦布尔色彩研究接入：旧城暖灰石/砖红瓦/深木色，新城浅暖石/铅蓝灰主穹顶/松石绿旗帜。修正合批材质来源识别，保留历史风化。974 个网格着色，几何/局部变换/范围外材质变更均 0，步行网格前后相同，两项测试通过；已查看日夜实景。配色完成不等于建筑与山体达到目标图。记录与对照：`artifacts/pipeline/citadel-city-colours/review.html`、`notes.md`、`verification.json`。

## 2026-09-28 圣城山体两小时迭代（本轮完成，仍有目标差距）

以用户确认的 citadel-istanbul-study-v3.png 为目标，02:08:39 UTC 开始，持续至 04:08:47 UTC 后完成验收（北京时间 10:08–12:08，超过两小时）。保留基线 r00 与 r01–r13 共 13 轮修改的四机位截图；review: artifacts/pipeline/citadel-mountain-two-hour/review.html。query citadelMountain=0 可看旧山体，默认 r13。threejs-game-director 指定技能目录缺失，本批未加载，未用子代理。

实景改动：7 组山岩采用蓝灰矿物色、断续层理/裂隙与浅几何风化；187 块嵌入岩壁的碎岩，移除新碎面的金线；上部裸山 367 顶点调整不对称山肩（最大 4.86m，绕开城市和铁路）；旧漂浮褐色植被退场，最终重新采样 85 棵柏树、107 丛灌木，灰绿材质不再被 1.5/5 秒的旧城配色回扫覆盖，平缓岩台增加少量苔色。布局与建筑本体保持现状。

后山净空：最终海湾变换后重投影背景岩山，低处后山沿红蓝铁路让出海岸走廊。基线 196 次岩石碰撞降为 0。乘车机位进一步发现被岩山掩盖的旧轨面低于海面，r13 在生成钢轨/桥面/车辆之前抬高同一条局部曲线；新测 23,049 个包络探针零命中（含新增植被），后山核心段最低海面余量 0.647m，低于 0.35m 的样本为 0。500 个 walkable 网格 / 30,057 顶点世界 hash 保持 83626823。轨道相机回放已查看，不等于人工 F/C/E 全流程游戏验收。

云系统重新烘焙最终地形高度场 101×101，烘焙前恢复距离剔除隐藏的网格，避免当前机位影响采样。最终 r13 正午/黄昏/夜间截图与全部 192 株植被根部射线检查通过：无缺失承托岩面、最高根部仍嵌入岩面约 0.04m，无悬空根部。3 个有意义的几何/边界/轨面单测通过；无非有限岩顶点、无页面 JS 异常。单独串行的同机位 headless Chrome 性能：r00 中位 40.5ms / P95 43.1ms，r13 39.9ms / P95 43.5ms；三角面约 260 万→282 万，调用约 7311→7308。没有宣称帧率提升；结果不代表用户机器所有视角。

已知差距：山峰总体仍偏锥形，整体仍是低多边形场景，尚未达到绘画目标的山体剪影/林地密度；建筑铅蓝穹顶等整城配色尚未实施。Jev r13 仅接收文字证据、建议下一步继续 geometry，不能算看图或用户验收。启动基线已有 3 个警告（master terrain 源不匹配、parcel 候选无法加载、lighting supports 缺失），本轮未修。旧任务（莫比斯舰队重做、木马落地、桥位降高、城墙通道、整库 GitHub 推送）不在本次完成项内。

## 2026-09-28 圣城暮色配色示意 v2（仅绘图）

按用户提供的夕照照片冷暖关系重绘前版圣城示意，保留两城、门、桥与港口布局。输出 artifacts/pipeline/citadel-current-diagram/citadel-dusk-palette-v2.png；参考照片 user-color-reference.png，完整生成说明 prompt-dusk-v2.txt。暖赭石/旧砖红、铅蓝穹顶、灰紫阴影、深青海面与金橙夕照。图像为内置 imagegen 生成的配色方案，未改游戏材质或光照，未把桥位/通道/木马等待修项标为完成。前版和实景保留在同目录 review.html。

## 2026-09-28 当前高山圣城示意（仅绘图）

用户要求针对当前场景出图。本轮用 capture_citadel_current_diagram.mjs 重新截取全景 after.png，并结合 r50-old/new/gate 既有建筑近照，用内置 imagegen 生成 citadel-current-layout.png。保存于 artifacts/pipeline/citadel-current-diagram/review.html，生成原文 prompt.txt。图中左旧城/右阶梯新城/左前高山之门/前铁路后步行桥的主要关系按当前实景；植被、山石和细节为绘画表达，不是游戏现状的逐像素记录。待修通道编号仅提示，实际截图的城墙阻塞位置仍需核对，不能把图上新城标号当定位证据。本轮没有改城市场景，铁路降高移位、木马落地、城墙通道仍未实施。

## 2026-09-28 巨轮细化与完整索具（Web 已接入）

保持侧翼单泊位及原船五倍尺寸。修正悬空吊杆为甲板桅杆根部铰接吊杆；补桅杆支索、顶升索、绞盘—桅顶滑轮—吊杆端滑轮—吊钩—甲板收存环的完整索具，增加两条随船轻微起伏更新的系泊缆及岸上系缆桩。吊装转运桁架两端增鞍座与连接杆接到既有横梁。补船艏弧形甲板/闭合护栏、船尾栏杆、驾驶舱窗框门/灯/救生圈、货舱围板、通风筒、烟囱箍及支索。没有新增船舶航行或完整装卸玩法。

实景前后对照 artifacts/pipeline/freighter-detail/review.html，source-before 保留本轮三文件原始快照，浏览器路由加载旧源产生同机位对照。10215 次局部红蓝铁路净空探测零命中，7 个船体起伏时间点实际缆绳网格端点误差最大 4.8e-14，船体顶点无非有限值，页面无异常。已人工看图确认吊索和甲板细节出现；船体仍是风格化程序模型，未声称与写实示意等效，也未做完整人工乘车/步行验收。

## 2026-09-28 侧翼单泊位（取代已否决的前港及大型后港）

用户否决扩大后港，要求只把船和紧凑码头放到基地一侧、完整保留临海弧形广场，货物不能占轨。现 dock 平面坐标 (-120.159400,-2.448781)，方向 PI/2-1.85；船仍为原型线性五倍，移走后港额外指廊/连接带。收货棚、箱子、零件托盘随泊位外移。红蓝铁路局部 10,215 包络探测零命中、页面无异常；未做人工全程驾驶验收。当前实景 after-overview.png / after-plaza.png 在 artifacts/pipeline/bookshop-side-berth。用户现在要求先看示意，以便巨轮建模。

side-berth-modeling-v4.png 使用当前两张实景作参考，由内置 imagegen 生成：保留三厂/圆广场/铁路线相对布局，仅一侧巨轮和卸货平台；下方为船侧视结构说明。该图不是游戏截图或施工尺寸，船舱细节是建模参考，不表示所有细节已实现。之前两个港口概念均已否决，保留作历史。

附带完成蝗虫默认端枪：idle/move/transport 均抬枪、非开火，disabled 放下；三个准备姿态枪轴与正前方点积为 1，原 18 个移动/运输瞄准检查仍通过，无页面异常，实景 artifacts/pipeline/locust-ready/raised-rifle.png。尚未完成：莫比斯舰队重做（已检查扫描秒杀/麻醉未区分机器人的旧逻辑，未修改舰队）、木马落地、圣城拱桥移位降高、城墙给港口上行通道开口。不要把这些标为完成。

## 2026-09-28 后港布局取代广场前港（当前）

用户否决广场临海弧外延码头。五倍巨轮、吊机、收货区现已移到工厂背后（基地平面坐标 0,-128，沿后岸停泊），码头改为后伸主平台、两侧突出卸货指廊及后场连接带。临海公共弧线无新增港口平台；吊装桁架自动接到最近工厂后场端点。红蓝轨道附近 5,652 次净空探测无碰撞，页面无异常。未做人工全程步行/乘车验收。

artifacts/pipeline/bookshop-rear-harbor/after-overview.png、after-plaza.png 为实景；rear-harbor-concept-v3.png 为内置 imagegen 修订示意，非游戏截图，图中复杂机器人装卸不表示玩法完成。此前 unloading-concept-v2.png 前港布局已被用户否决，仅保留历史。生成原文在 prompt.txt。港口源前快照保留。后续优先修复用户指出的木马悬空、圣城铁路拱桥位置高度、港口上行通道被墙阻塞。

## 2026-09-28 巨轮结构纠错与装卸示意图

修正上一轮只整体放大遗留问题：补 freighter-boiler-engine-house 锅炉/机舱，使烟囱底端与甲板连接；大船船底从原 1.9 单位加深到 3.4，收窄水下船腹，改善球面海水截断浅船底。未变形甲板/驾驶舱，不声称改平整个球面海洋。港口吊梁延至 -39，吊货起点从真实船甲板坐标计算；新增 bookshopHarborRunway.js，将最近工厂吊装跑道接到码头起重机内端，双层桁架两端落在既有支架上。移除新泊位模式下旧 plaza 原地缆绳，保留旧船 query 对照。

包含新船腹、机舱、连续桁架的红蓝轨道局部 18,441 次射线检查无碰撞，页面无异常。实景 after-plaza.png、after-overview.png、checks.json 在 artifacts/pipeline/bookshop-freighter-repair。没有新增完整机器人海运装卸逻辑/可登船功能，图中的机器人装卸属于设计示意。

用户追加要求已用 imagegen 内置工具生成 unloading-concept-v2.png，以修复后两张实景为参考；图下标明“非游戏实景”。实际游戏模型和写实概念仍有差距。原图保留，生成说明在 prompt.txt。最终需要用户审阅图中布局；不能把生成图当实景或已验收建模。

## 2026-09-28 原蒸汽货船扩大与泊位迁移

用户原船截图及广场侧泊位截图保存在 artifacts/pipeline/bookshop-grand-freighter/reference-ship.png / reference-berth.png。保留原货船模型，按用户要求线性尺度 5 倍，泊位沿广场海侧且通过铁路净空检查；不据此称已完成可登船交通系统。实现 bookshopFactoryBase.js，实景在 review.html。

## 2026-09-28 蓝灰海蚀石林与水晶高度

用户认可目标 exec-4b2aa3a8-1668-4d68-870a-51316f4c02c7.png 已复制至 artifacts/pipeline/gate-sea-stacks/target.png。仅参考其宽窄高低不一的海蚀石柱、蓝灰层理、凹蚀岩脚和崖顶低矮植物，未改成黄色石灰岩。实际实现 gateSeaStacks.js / gateTargetThirty.js / gateTargetGreenery.js，实景与目标在 review.html 分开展示。追加水晶截图要求直接映射 crystalV10.js 的中央/侧棱高度层次，12 组生效；未生成新目标替代用户参考。

## 2026-09-28 已认可两城布局图

参考：`artifacts/pipeline/citadel-bay-layout/approved-target.png`，用户确认的 imagegen 生成示意图（2026-09-28），来自原高山之门目标图。映射：旧城左/新城右、扩大内湾、前方露天跨湾铁路及沿新城海岸绕行、后方独立步行桥。代码 `bayLayout.js`、`bayLayoutMath.js`、`coastalTramRoute.js`、`coastalTramStructures.js`；原建筑造型保留。本轮实际截图 after.png 与概念图分开展示，不把示意图当游戏渲染。

## 2026-09-28 圣城陈旧与厚重 / 机器人音效补充

- 圣城沿用 `assets/concepts/citadel-style-v2/target-v2.png`、`assets/concepts/highland-gate/target-v1.png`；针对砌块变化、石缝、修补、雨痕、石质檐口和常绿植物做 50 项累计改动，实景见 `artifacts/pipeline/citadel-history-fifty/review.html`。原图未覆盖，未新造目标替代现有认可图。目标整体建筑密度与植被仍有差距。
- 用户提供讨论 https://www.reddit.com/r/GameAudio/comments/1g6d3u8/games_with_good_sound_design/?rdt=42628 已阅读：Hunt/Helldivers 的空间辨位、MW/Battlefield 枪声、Alien Isolation 的信息性环境音仅作为听感意见。不是工程数据来源。
- 武器音源改为 CC0 实录 The Free Firearm Sound Library：https://opengameart.org/content/the-free-firearm-sound-library ，具体作者、原文件哈希、切片时段与处理在 `assets/audio/robot-combat/SOURCES.md` / `manifest.json`。没有提取商业游戏录音。Infinity Ward 官方音效介绍仍作为分层/空间反射设计依据，未声称已复制其品质。


## 2026-09-25 湖沼V2与虎专项（本条覆盖湖沼旧进度）
唯一目标assets/concepts/moebius-swamp/target-v2-existing-layout.png，用户再次要求仔细对照其中的橙黑成年虎。已记录50/50轮Web实景修改，最后15轮重点改虎头身/四肢/脚掌/毛色与饮水姿态。src/assets/characters/swampTigerV2.js仅在湖沼V2应用，旧Blender数据保留。证据与每轮限制见artifacts/pipeline/swamp-v2-fifty-rounds/PROGRESS.md及comparison.html。50轮不代表目标风格达标，虎仍卡通化、树冠与岸壁不够自然、水下偏暗。虎600秒完整状态循环、饮水鼻端距水面0.0105、aircraft实际吸蜜4次已采样；额外修复V6船员无row.x导致湖沼送水NaN，未修改其他文明或共享战船。完整故事/网格碰撞未验收，未同步Blender/Godot。v2自动任务此前已删除，未重建。
# TigerMessenger 美术参考与模型改造依据

## 2026-09-09：用户圣城概念图已接收

用户上传的蓝夜峡谷灯城作为当前圣城主要视觉目标，已保存 `assets/references/citadel/user-concept-20260909.jpg`，完整执行依据见 `docs/CITADEL_ART_TARGET.md`。概念输入已具备，不再将imagegen网络恢复作为开工依赖。采用青蓝暮光/靛蓝山体、层叠浅色塔城、暖金与桃红窗灯、原水系倒影；保留原中央圣塔、街巷关系与球面世界。下一可见交付是原圣城一片区同镜头的「原版／蓝夜候选」对照。按用户最新分工：Blender只制作远山、峡谷地形地势与植物；建筑用原工程Townscaper式模块及WFC约束搭建，保留中央圣塔、街巷与原水系；Godot负责材质、布光、雾与本片区倒影。生成目标图已保存于 assets/concepts/citadel-user-reference-target-20260909-v1.png。执行与验收清单以 docs/CITADEL_ART_TARGET.md 为准；本次是计划修订，不据此声称新建模/渲染完成。


更新：2026-09-07。状态：**参考研究与改造方案；本文件不表示模型已经重做、导入 Godot 或验收。**

后续实施补记：主虎照片已下载到 assets/references/tiger/；基于它与旧模型配色生成的二维候选为 [虎概念图](../assets/concepts/moebius-tiger-anatomy-v2.png)。已查看概念的虎头、四足与肩胸结构，尚未生成新三维模型。文末“研究未下载/生成”仅描述初始研究阶段。

## 本轮方向

用户最新指示允许基于图像重塑模型：湖沼之虎需要更像虎；莫比斯世界参考 Mœbius 漫画；传统世界参考真实建筑与自然环境。原有角色身份、故事关系、球面世界和中西结合的构想仍保留。以下“改造建议”是本项目的设计判断，不是来源作者对本游戏的建议。

过去的重复顶点整理与本轮造型改善属于不同工作：前者保持原画面，后者必须产生能看出来的改善。新的造型分支应保留旧模型，展示正面、侧面、四分之三视图以及游戏镜头对照；不能再用“零像素差异”证明造型改善成功。

## 1. 湖沼之虎：先解决体态，再处理幻想配色

### 主照片：真实孟加拉虎全身侧面

- [Wikimedia 来源、作者与许可页：Panthera tigris tigris original](https://commons.wikimedia.org/wiki/File:Panthera_tigris_tigris_original.jpg)
- [原图：3000 × 2004](https://upload.wikimedia.org/wikipedia/commons/f/f9/Panthera_tigris_tigris_original.jpg)
- 作者：John and Karen Hollingsworth；来源：U.S. Fish & Wildlife Service。文件页将此照片列为美国联邦政府职务作品、公有领域，并归入虎侧面图分类。此记录针对该照片，不代表同站其他照片也相同。
- 用途：首选全身比例依据及图像生成的结构参考。记录来源；生成候选仍需要检查四肢数量、脚掌、尾巴连接和左右形体，不能把单张照片的透视压缩直接当作三维比例。

### 头部补充参考

- [苏门答腊虎近照：San Antonio Zoo，Greverod](https://commons.wikimedia.org/wiki/File:Panthera_tigris_sumatrae_(Sumatran_Tiger)_close-up.jpg)
- **许可有冲突**：摘要写公有领域，但 Licensing 与结构化数据列出 GFDL / CC BY-SA 3.0。暂用作打开观察的辅助来源，不按无条件公有领域照片登记。它是另一亚种，只帮助核对头部结构，不混用为同一只虎的多视图。
- [Smithsonian National Zoo：Tiger](https://nationalzoo.si.edu/animals/tiger)说明虎有强健颌部、明显条纹和耳部白斑；不同个体纹样不同。
- [San Diego Zoo：Tiger](https://animals.sandiegozoo.org/animals/tiger)说明其身体肌肉发达、前掌强大，并与水域生活相关。这与游戏湖沼角色的环境相容。

### 对应模型与可见改造

原模型入口：`src/assets/characters/moebiusTiger.js`；漫游逻辑：`src/world/moebiusTiger.js`。本次核对了模型开头的配色、条纹、缩放及躯干定义；未据此声称重新通读全部动画实现。

当前代码明确使用墨黑身体、白掌、少量白色面部、红眼及收窄腰部。建议保留这套身份标记，首先改变体态：

| 部位 | 本轮改造建议 | 目视通过条件 |
|---|---|---|
| 头颈 | 做出较宽颅部、明确口鼻块、颊部与颈部衔接；控制眼睛与耳朵的相对大小 | 灰色无贴图版本也能辨认为虎，不能只靠条纹 |
| 胸肩 | 建立肩胛与胸腔的体积关系，前躯有重量 | 侧面不再是细长圆筒接四根腿 |
| 腹腰与臀部 | 腰部有收束，但胸腹和臀部连续；避免局部过度捏细 | 四分之三视角无突然塌陷的腰线 |
| 四肢与脚掌 | 前掌厚实，腕部与后肢关节方向明确，脚底接地 | 站立有承重感；行走、饮水时不扭腿或悬掌 |
| 尾部 | 尾根有厚度，向末端渐细；保留原有可动分段含义 | 转身不穿臀部，动画仍可驱动 |
| 纹样 | 先校验普通虎纹结构，再转译为墨黑／靛灰体系，面颊和额头纹样有辨识度 | 游戏默认镜头下仍能分辨头部与身体，夜间不完全糊黑 |

执行路径：真实照片 → 保持游戏身份的概念候选 → Blender 模型与拓扑、脚底及关节修整 → Web / Godot 同模型展示 → 站立、走路、饮水、跟随检查。图像候选只是二维设计，不能计为三维资产完成。

## 2. 莫比斯世界：作品来源与本游戏的转译

优先使用出版社与 Mœbius Production 的作品入口，避免把搜索结果中的粉丝图或其他作者续作误认成 Mœbius 原作。

| 参考来源 | 来源能确认的内容 | 对应原模型 | 本项目可借鉴方向 |
|---|---|---|---|
| [Les Humanoïdes Associés：Arzach Classique](https://www.humano.com/album/35689)；[出版社 Mœbius 专题](https://www.humano.com/univers/moebius) | 作者与作品、官方试读入口；专题说明飞行者与幻想沙漠旅程 | `src/assets/characters/longWingGlider.js`、`src/assets/moebiusAirship.js`、`src/world/canyon.js` | 把飞行物轮廓与地形大形做清楚；细节集中在乘坐、悬挂、推进等功能区；通过空间留白突出巨大尺度 |
| [出版社：L’Incal，Ce qui est en bas，黑白版](https://www.humano.com/album/37756) | Mœbius 绘画、Jodorowsky 编剧及黑白版本信息 | `src/assets/moebiusTower.js`、`src/world/moebiusCity.js`、`src/assets/moebiusAircraft.js` | 以清晰线条分层组织建筑主体、平台、舱体与管线；先检查黑白结构可读性，再确定色块；这张黑白版页面不能作为准确原版配色证据 |
| [Mœbius Production 官方入口](https://www.moebius.fr/) | 原作出版、艺术印刷品和展览入口 | 科幻世界整体参考索引 | 用于追溯作品来源与后续补充；不是任意搜索图的版权担保 |

### 具体改造，不只增加装饰

1. **Aircraft**：保留原舰船角色与扫描、吸取生物的故事作用。梳理船体、驾驶舱、推进器及扫描装置的比例；消除部件相互埋没。现有代码包含驾驶舱锚点、能量线、扫描光束和灯光，不能把这些功能节点合成无法驱动的一整块模型。
2. **航空艇与长翼滑翔机**：原航空艇有气囊、网架、尾翼、悬索、吊舱与登艇绳。保留装配关系，用受力与轮廓可读性检查悬索和吊舱，不生成一艘无关的通用飞艇替代。
3. **晶塔与城市**：保留原晶塔／生物穹顶的设定，通过主塔、平台、次级舱体和连接件的层级改善剪影；建立入口、可走平台与地面的实际连接。
4. **峡谷与湖沼**：用大地形起伏、少量明确岩层和植被群组织画面；避免靠随机小石块掩盖地面断裂。飞行路线和地面通路都应在游戏镜头下可读。

上面的几何与构图方向是本项目建议，尚未完成逐页图像分析，不将其冒充某一页漫画的精确复刻方案。下一步针对实际修改的资产保留参考页、截图视角和对应问题记录。

**作品使用记录**：Mœbius Production 页脚为 All Rights Reserved；出版社提供 [Rights and Permissions](https://www.humano.com/foreign_rights) 联系入口。尚未取得漫画画面、角色、标志或贴图的项目使用授权；当前记录的是参考出处，未下载漫画或把画格打包成游戏贴图。作品风格研究与原图素材授权分别记录。

## 3. 传统世界：真实建筑和环境参考

| 来源 | 已核验事实／资料 | 对应原模型 | 改造建议 | 图像许可记录 |
|---|---|---|---|---|
| [莎士比亚书店巴黎外立面照片](https://commons.wikimedia.org/wiki/File:Shakespeare_and_Company_Front,_Paris.jpg) | Ken Eckert，2012 年拍摄，1200 × 900 | `src/assets/bookshop.js`、书店镇道具 | 观察店面门窗、招牌与临街尺度的关系；保留用户双凸窗、砖色、白饰边及可编辑招牌，修复窗体被墙遮挡和台阶接地 | 文件页为 CC BY-SA 4.0；直接使用或改编照片时须保留署名、许可链接和改动说明；不复制店名标志进入游戏 |
| [法国国家古迹中心：圣米歇尔山修道院建筑](https://www.abbaye-mont-saint-michel.fr/decouvrir/l-eglise-abbatiale) | 建筑建立在岩顶，地下支撑空间与台阶连接不同高度；页面有航拍及内部建筑照片 | `src/assets/townscaperBuilding.js`、`src/assets/citadelWatchtower.js`、`src/world/citadel/*` | 重点参考山体—挡墙—平台—建筑的支承关系、台阶路径和高低聚落轮廓；用于修复圣城悬空与层级不连续 | 照片有 Centre des monuments nationaux 等署名，未核验开放复用许可；仅作参考链接 |
| [UNESCO：苏州古典园林](https://whc.unesco.org/en/list/813)；[官方文档与地图](https://whc.unesco.org/en/list/813/documents/) | 以水、石、植物、建筑在有限空间内构成自然缩景，提供园林资料和地图 | 苔庭、中式庭院、圣城庭院及 `src/assets/ancient.js` 中适用构件 | 观察院墙开口、廊道、石与水的空间组合；中式元素集中到完整院落逻辑，不在每座西式塔楼上随意贴屋檐 | UNESCO 简介文字标明 CC-BY-SA IGO 3.0；不能据此推断每张照片或第三方地图也采用同一许可 |
| [西芳寺官方](https://saihoji-kokedera.com/en/)；[日本国家旅游局：Saihoji Temple](https://www.japan.travel/en/spot/1134/) | 官方庭园图像与历史，寺院庭园与苔环境 | `src/world/saihoji.js`、`src/assets/terrain/mossyGround.js`、苔庭植物与石阶 | 参考苔地与树根、岩石、水岸的连续关系；区分泥土、苔层、步石，修复水边接缝和步道可走性；不把球面整个刷成单一荧光绿 | 西芳寺页脚有版权标记；图片复用许可未核验。旅游局照片亦不假设为开放素材 |

真实世界参考用于解决尺度、结构、材料分区和环境关系，最终仍用低多边形语言制作。Bad North / Townscaper 在这里是玩家已指定的体积与可读性方向，不能因此删去其原有中西结合设计。

## 4. 参考如何落到 Blender 与 Godot

- **Blender**：每项资产记录原模型入口、参考来源、拟改部位；先解决剪影与结构，再处理拓扑、UV、材质分区、关节和碰撞代理。原始文件与重塑候选分开存放。
- **Godot**：接收可复现导出的 GLB 及必要贴图，在实际工程资源目录登记；几何出现不等于材质、动画、碰撞和玩法已经迁移。描边、分层色调、红眼、扫描光与可编辑招牌需要专门适配。
- **可见验收**：虎先看无贴图三视图和行走，再看墨色风格；建筑先看入口、支承与通路，再看光照；同一资产在 Blender、Web、Godot 的名称与来源可追溯。
- **整批节奏**：按一个区域或一组有关联资产推进。每批提交一张问题前后对照、一个可打开模型或引擎场景、一个清楚的未完成列表；导出成功、候选生成和实际改善分别计数。

## 待办

- [x] 为虎选择有出处和一致许可标记的主照片。
- [x] 核验 Mœbius 原作出版社入口，区分黑白结构参考与配色参考。
- [x] 建立真实书店、山地古堡、中式园林、苔寺来源和原模型映射。
- [ ] 依据主虎照片制作本游戏角色概念并检查体态；本研究未生成图像。
- [ ] 针对第一批待改模型完成原代码、调用、材质、动画与碰撞的完整阅读。
- [ ] 在 Blender 完成虎造型候选与三视图，并检查现有动作兼容性。
- [ ] 把首批原作资产导入实际 Godot 工程并完成资源浏览展示。
- [ ] 补充各区域实际截图、问题编号及同视角改进证据。

本次研究仅新增本文件，未下载参考图、未生成模型、未调用付费生成 API，也未修改运行中的游戏。

## 鲲翻身摆尾（2026-09-20）
依据Segre等鲸类研究：纵轴滚转主要由胸鳍控制，后部可有轻微扭转滞后；不将尾巴左右甩动当成滚转主动力。参考 https://pubmed.ncbi.nlm.nih.gov/27591304/ 与 https://academic.oup.com/icb/article/59/1/48/5184268 。研究涉及水下运动，腾空鲲属于风格化改编。
现有12秒动作中，翻转进度驱动尾柄局部Z上下摆动（最大系数0.12rad）和局部X扭转滞后（0.10rad），尾鳍以0.55rad相位差跟随（0.08rad）。用sin²包络在0°及360°归零，保留原基础尾姿，复位取消摆动。Web与Godot正式动作及模型预览均接入；苔地25松仍由共同根节点翻转，不受尾部局部动画影响。未把胸鳍水动力或腾空物理模拟说成已实现。

## v2 水晶与交通（待审定）
图像target-v2.png；独立交通图transport-v2.svg。参考The Crystal Lake：https://bookpalace.com/info_moebiuscrystallake1；Edena图像汇集：https://doorofperception.com/2017/11/moebius-the-world-of-edena/；色彩讨论：https://www.williamstout.com/news/journal/2014/07/17/18-tips-for-comic-book-artists-by-jean-%E2%80%9Cmoebius%E2%80%9D-giraud-14/ 。仅参考，不将作品搬入游戏资产。
A西花厅—B母塔—C东花厅区域贯通线；三港侧湾停泊、主湖道互通；各站港间坡道/升降/步行衔接。不是新授权重做实际轨道。主塔尖仍贴边，概念图未解算模型尺寸、球面高程、水深或净空。下一步先提取现有车船包络、既有线路与湖面高程，再给站台/桥下净空/回转水域定尺寸，不能直接按画面创建穿模交通。

## 2026-09-24 高山之门目标V1（用户明确认可）
- 目标：assets/concepts/highland-gate/target-v1.png；原粗壮双塔造型来自 gate-of-sighs/target-v3-front-back.png 和原 gateTargetData.js，圣城文明参考 citadel-style-v2/target-v2.png。
- 独立30轮迁移至圣城外侧实际轨道：暖白石、蓝旗、阶梯双塔、三重纵深拱、岩基与柏树。当前莫比斯文明的纤细叹息之门保持独立。
- 实际差距及逐轮记录：artifacts/pipeline/highland-gate-thirty-rounds/PROGRESS.md。此图是概念参考；没有以二维目标图替代游戏几何，也不声称已经复刻其画面精度。


## 叹息之门V6空间优化
用户要求优化原目标图，新增assets/concepts/gate-of-sighs/target-v6-unified.png，保留V4/V5。内置image_gen两次生成：初稿上方仍有侧向拱廊歧义，修订为沿铁路的斜俯正面，三道横跨轨道的门依次后退。补齐迎门正视、左侧站台/台阶/三人会面台。此为美术空间参考，非尺寸图或已完成模型；跨视角细部和双轨净空仍须建模核对。提示词target-v6-prompts.md。


## 叹息之门V7重绘候选
用户否定V6透视，V6不再是建模依据。先在后台Blender构建同一结构的三个机位，文件artifacts/pipeline/gate-v7-perspective/gate-perspective.blend及blockout.py；三等大横向拱门沿直双轨排列，左侧会面台。内置image_gen以三幅底稿约束重绘，输出assets/concepts/gate-of-sighs/target-v7-perspective.png。仍为待用户复核候选，生成图不是精确投影/尺寸证明，平台连接和列车朝向仍需核对。未改变游戏模型。


## 叹息之门几何校验
用户否定V7并要求先做三视图。artifacts/pipeline/gate-geometry-check/index.html提供同一Blender模型直接渲染的正/侧/俯投影与斜视图，三道门橙绿紫分色。正投影三门同轴重合，严格侧投影为三组侧边；斜视才同时显示三道完整门洞。门位y=0/21/42，柱x=±6，等大平行，数值仅为空间验证非用户确认尺寸。此批未调用生成图重绘，也未改游戏。V6/V7不能作为已认可建模依据。


## 2026-09-25 V8双侧拱廊目标候选
用户明确指出缺少纵向侧墙，而非仅横向拱门透视问题。新增target-v8-side-arcades.png，明确左右侧拱廊与横向门洞共享柱网形成完整建筑，保留蓝色莫比斯风格和会面台。内置image_gen生成。原三片拱框不再是完整结构基准；该候选尚待用户确认，侧面三孔与横向柱网需后续建模核对，不能当精确施工图。未改变真实游戏模型。

## 2026-09-26 用户10张手机截图：莫比斯文明配色优先
参见 MOEBIUS_PALETTE.md。截图含 HUDesigner/AIGC 标识，作为用户认可的色彩参考，不标注为莫比斯原作。提炼青蓝、蓝紫、奶油、珊瑚与青绿的关系，落地到 moebiusPalette.js 及水晶城/叹息之门/湖沼专属材质，区域天空同步提亮。真实8931对照位于 artifacts/pipeline/moebius-palette-reference/comparison.html。

# 水晶城晚霞与配色

2026-09-26 已回接实际游戏。水晶珊瑚色，露台水晶蓝；6组水晶的顶部以橙黄色渐变。叹息之门青蓝主体，侧廊与会面平台奶油色，门区钢轨局部暖沙金。

晚霞复用圣城 ridgeFlowClouds 的 puffTexture 与实例化 billboard 着色，实现独立180云团、单次绘制和缓慢漂移。圣城文件只导出原贴图函数，原云分布/动画不变。第一候选过暗过厚，修正色彩输出、降低透明度后重新截图目视复核。当前为柔软晚霞云带，不是体积云。

截图与运行记录：../moebius-palette-reference/sunset-*.png、sunset.json。12组水晶保留；错误为空。未计入老虎轮次，未宣称完成水面或整体性能任务。

## 2026-09-26 叹息之门新30轮
已默认回接 gateTargetThirty.js，逐轮源参数与截图报告见 artifacts/pipeline/gate-target-thirty/PROGRESS.md 和 comparison.html。近岸退让、远山水晶、门区水面与拱廊细部；保留最新青蓝/奶油/暖沙金。最终原碰撞解算步行通过，非完整剧情验收。远山自然度与玻璃精细度仍低于目标。老虎20轮与全城性能仍为独立未完事项。


## 2026-09-26 叹息之门绿植补正
用户指出目标图绿植缺失。已增补岩坡灌丛、平台花槽、植物舱阔叶和远山肩部植被，保留宽水域。参考仍为gate-target-thirty/target.png。实际截图、通路检查及限制见artifacts/pipeline/gate-target-greenery/PROGRESS.md与comparison.html。581组种植合并5批，轨道1152射线及原碰撞步行检查通过；非完整目标验收。


## 2026-09-27 水晶城及湖沼续修
本批补密水晶植物舱，调整中央树冠轮廓，轻度提亮水下。原目标V10水晶城/V2湖沼与最新配色指示保持。截图及动作检查见artifacts/pipeline/city-swamp-refinement/PROGRESS.md与comparison.html。未计入旧50轮，不代表整体达标；岩岸规则性、树冠团块及晚霞云广角检查仍待继续。


## 2026-09-27 水晶基座降低与珊瑚渐变
按用户最新参考改岩基为低矮珊瑚色，水晶顶部浅、底部深。主附加岩基15→5.2；旧岸岩仅压低高尖峰，保留低岸支撑。源快照、8931实景对照及限制见artifacts/pipeline/crystal-coral-foundation/PROGRESS.md。


## 2026-09-27 蓝色电车水晶分布平衡
依据用户指出右多左少，以蓝车实际direction=-1测量，移动3组副塔，最近轨道切线分侧由左3右9改为左6右6。证据artifacts/pipeline/crystal-track-balance/PROGRESS.md及comparison.html；部分视角仍受栏杆/地形遮挡。2700采样线无移动几何阻挡，不代表完整全路线验收。


2026-09-27：用户接受母塔＋湖沼逆时针试排，真实场景落实30°球面刚性旋转，含三塔、岸桥、港口与船只导航、气泡艇、水面遮罩及晚霞云。12塔保留，启动无错误，船只离泊/返泊数值误差7.1e-15。俯视及红蓝线截图见 artifacts/pipeline/crystal-core-live/。桥面/树冠遮挡仍在，未称可见性问题已解决。书店镇机器人任务继续，未被此调整替换。


## 2026-09-27 Bookshop Town: user old-town references
Four user images under Downloads/书店镇 guide weathered pale stone, slate roofs, grey-blue air, warm orange windows, and fantastic flying engineering. Gallery research: https://galerie-kunst-landschaft.de/pages/kuenstler-der-galerie/vadim-voitekhovitch.php . New built-in image_gen target: artifacts/pipeline/bookshop-steampunk-v1/target-oldtown-v2.png; prompt saved alongside. Three bookstores surround one open plaza, each paired with its own robot. Concept only, not implemented environment or model-quality evidence. Latest actual mesh renders assessed separately: locust 6/10, ant 5.5/10, beetle 6/10; none accepted at user threshold 8/10. See model-score-review.json.


## 2026-09-27 海港蒸汽基地集中构建（最新）
用户授权两小时建设基地、四店和三台机器人。本轮实际源与证据见 artifacts/pipeline/bookshop-two-hour/PROGRESS.md；统一检视 review.html，真实入口 ?autostart=1&baseReview=1。保留用户选定的 -35/115 基地位置；低圆形地面随球面，三座大书店工厂围绕圆形广场，原 Hard to Find 为临海旅游小店。补厂房/阅读室、球面法线、碰撞与相机、运输环路/支线、卸货吊机/蒸汽货船、仓库与系泊飞艇。机器工作单元有动画，机器人仍是静态资产。
三机器人 v4 正背面实际看图后主观自评：蝗虫8.0、蚂蚁8.1、甲壳虫8.1；权重/剩余缺口见 robot-scores.json，不是用户验收。三份 GLB 已由独立后台 Blender 导入并保存 .blend；无非法顶点，未动前台未保存文件。程序旧化不在 GLB 内。
用户追加三机器人站立/移动/开火目标图，已用内置 image_gen 生成并保存 actions/ 三张三姿态概念图；actions.html 汇总。甲壳虫移动为四轮行驶；蚂蚁站立展开短腿、前臂炮与杯架为提案。并有基于实际布局的基地 base-target-v2.png。概念图不是动画完成证据；图上生成的尺寸/重量/口径不是已定参数。
验证：366入口贴地点、3621运输通路点、实键行走、三店室内相机、7个机械节点运动、模型网格/网页错误、GLB导入均有记录；Chrome/Metal入口约30FPS。此前工厂各20/基地20是累计几何版本、按批次复核，不是80轮完整人工游玩。下一阶段与用户规划生产、机器人绑定和虚构战斗规则；未接生产/战争系统。建筑细节和材质仍比目标图简化。


## 2026-09-27 四小时基地货运与动作版本（当前）

继续使用用户认可的三厂目标：蝗虫重型装配厂 exec-0447317f-e5d9-456f-a88b-d5865d8009e0.png、蚂蚁蒸汽动力厂 exec-b96260bf-5b99-4eb7-9018-d57e9f08bec3.png、甲壳虫精密机械厂 exec-2a9fddf4-b0b3-469f-99be-03af9f81612b.png，原图位于 /Users/panglaohu/.codex/generated_images/01a0ceaf-9c40-7dd1-8395-6e4b8c6a4bb6/。环形临海基地继续沿用用户认可的 exec-056f6e4f-b8c2-4402-b500-cc8e750cc272.png 及后续完整环形要求；不把货运道路改为装饰假轨。

三机器人外形原参考位于 /Users/panglaohu/Downloads/robotworldwar/（0233f9a3f08dadbb9a2971420b5aef08.jpg、3363a3f775f99f5fd38e00d4c29550e5.jpg、b2bee10c0b2e938de1db356ff574db67.jpg）；动作依照 artifacts/pipeline/bookshop-two-hour/actions/{locust,ant,beetle}-actions.png 与已确认 robot-combat-review/design.md。本批没有重新生成目标图。

原静态 v4 保留，另建刚体关节变体：蝗虫肩肘/髋膝与架枪，蚂蚁短腿展开、收杯/前臂炮，甲壳虫四轮转向/独立炮塔；实际整机比例装运、四索吊带、移动横梁沿球面，机车轮辐/连杆/蒸汽。高山之门仅为货列净空对原长墙分段再沿曲线贴合，边界、UV、材质分组保留。

真实模型及场景渲染位于 artifacts/pipeline/base-four-hour/：rig-*-idle/move/attack/transport、hoist-*-load/unload、route-after-*、freight-motion-* 与视频。Astra已看图：轮廓和型号能区分，实际装甲仍偏几何化、蚂蚁铜锈有斑点感、甲壳虫轮罩偏圆鼓；蒸汽仍为风格化粒子。不能凭功能通过宣称本批动态模型已达到8/10。GLB没有运行时旧化着色、部分描边和战斗逻辑。性能及世界战役缺口见本批PROGRESS.md，旧静态评分不沿用。


## 2026-09-27 甲壳虫舱体四前灯补建
用户指出舱体缺四前灯。重新查看原始 b2bee10c0b2e938de1db356ff574db67.jpg，实际 bookshopRobots.js 已补主观察镜旁 2×2 灯组：暗色凹座、金属灯框、凸玻璃、暖色灯芯；删除原先悬浮于腿上方的小传感器环。共享模型工厂已供实景/独立审阅页读取。证据 artifacts/pipeline/beetle-wide-stance/before-front-lamps.png 与 four-front-lamps.png（同相机）；原源码快照 source-before/bookshopRobots-before-front-lamps.js。实际游戏 E 三模型、F 红蓝第五货厢、C 切机车复测通过，无 pageerror；同时修正 main.js 新运行时碰撞参数 assetColliders 引用。旧 GLB 下载未重导，整体机器人未按 8 分验收。此前信使 30 轮、正式苔庭战役、云/行人/基地防御完整验收仍未完成，不可据此宣布全部结束。


## 2026-09-27 武器区分、载货路线、落地点与信使帽子
实景修复：基地防御原先所有机器人都用一条同色直线；新增 weaponEffects.js，演练与基地防御共用。蝗虫三连发抛壳、蚂蚁单发弹体喷汽与冲击汽团、甲壳虫左右双管交替5发，新增左枪口与枪械后坐脉冲。目标为 robot-combat-review 中已认可的三张动作图；没有改成激光或虚构新武器。
空车原因之一：就近试验场把刚装的整机卸空。运行时新增真实轨道行驶距离门槛，先载货走主要世界线路，再返站卸车；工厂批次未齐且正在生产时等待，不假造货物。军团面板可选“观看整机装运”，镜头自动选择较少墙体遮挡的方向。旧的空车返程和无物料经停仍合法。
重叠原因：落地点按当前已部署列表序号推算，较早编号后到可挤占已有机体位置。deployment.js 为每个ID保留空落地点，旧存档读取时修复重叠。独立浏览器加速真实列车更新：9台全到站、最小中心距5.6；首批3台实际货车运输2495.82米，轨道长2546.17；全部33项robotOps回归通过，存读档通过，无pageerror。不是正式苔庭前线卸车闭环。
信使按最新要求新增第26–35轮；额外36–38轮纠正球块面部、帽檐遮眼与铆钉悬空。防风镜移至帽冠、帽檐上翘、缝线、镜带扣、鼻梁下颌眉眼。38份实际源码/截图记录在 courier-wasteland-30；当前仍候选，humanCourier.js仍旧入口，未达到或声称8分。整体衣服仍硬，需要继续自然褶皱与脸部雕刻。
证据总览 artifacts/pipeline/robot-weapon-effects/review.html、check.json、freight-check.json；原始快照source-before。旧GLB未重导。其它尚未完成的苔庭战役、行人/云系统完整验证不要据此改为已验收。


## 2026-09-27 信使最新帽子与脸部纠正（覆盖先前露眼要求）
用户新裁图指定连续侧脸轮廓，又明确“太阳帽+风镜”，最后强调低帽檐盖住双眼。候选第39轮连续鼻梁/薄唇/下颌，第40轮去掉硬盔护耳金属附件，第41轮压低帽檐遮眼，第42轮闭合帽冠接缝。风镜在帽冠，眉眼不再要求外露。目标和同机位前后图：artifacts/pipeline/courier-face-outline/{target,before,after}.png。实际源courierWasteland.js已改；仍是独立候选，未切换humanCourier.js，未声称全身8分。下一步只沿此软太阳帽方向完善，禁止恢复夸张装甲帽。


## 2026-09-27 基地实景接续、九机货列与圣城绿植

本批按用户睡前授权继续修改真实 Web 场景；审阅入口 `artifacts/pipeline/base-target-refinement/review.html`。不是新生成目标图，也没有把截图数量记作迭代或美术验收。

- 基地保留完整临海圆形广场、三座大型工厂及临海 Hard to Find 小店。增加门面书架暖光、石柱檐口、深蓝旗帜、厂房桁架；蚂蚁增加卧式铜锅炉与压力表，甲壳虫玻璃穹顶改为透光玻璃并增加内部暖光，蝗虫龙门吊补格构。灰绿底面改为石铺地；三厂后方突出卸货台保留，吊车纵轨扩大到 ±38 米并补支脚。实际仍明显简化于认可目标图，未宣称整体达到 8 分。
- 信使最新第44轮造型已真正接入 `humanCourier.js`，不再只是独立候选。低帽檐探险草帽（用户最终要求为路飞同款方向）、帽上风镜、溜肩单肩甲、翻领夹克；按原角色 1.66 米高度校准，保留行走、骑乘与持信动画接口。此记录覆盖旧条目的“尚未回接”和“太阳帽”要求；脸部与服装细节仍待美术精修。
- C 驾驶视角眼位移到驾驶室前横梁之外，红蓝车 F 上车/C 切换已实测。列车蒸汽改用高山圣城 `ridgeFlowClouds` 的真实 puffTexture，世界坐标漂移、寿命淡出、48 个有界云团，避免尾烟跟着车身硬转。
- 红蓝各九个整机货位（另两节补给），必须实际完成蝗虫、蚂蚁、甲壳虫各三台吊装。旧六货位存档保留编号迁移。缺料通过原有蒸汽船补给流程生产；卸空后物理倒车回首厂收齐三种，避免空车离开基地。倒车联锁按尾车占区。运行时总上限54台，纯物流模块默认24台未改。
- 卸货前为整车预留安全落地点；接收区不足则保留整车货物，避免隐藏或重叠。6500秒加速真实运行诊断：27台部署可见、无缺失，红蓝仍各载9台，保存/读取成功；该加速诊断不是正常时钟长测。正式苔庭前线卸车战役仍未接完，当前接收站仍为就近试验场。
- 高山圣城保留41株柏树、2株大松，原灰色块状灌木换为带枝条的叶簇；遵守台地落地、墙体与通道避让，将通过检查的灌木从67丛补至114丛。没有替换原始柏树/松树模型或修改前台 Blender。

验证：34项 robotOps 回归全通过；基地3621个公共/后勤路线采样均可走；实际信使行走保持球面落地；页面无 pageerror；审阅页24个本地链接均HTTP200。前后比较使用同机位/光照。Jev仅做文字证据下一步分类，未代替看图或批准美术。

证据目录：`base-target-refinement`（总览、三厂前后、路线）、`courier-live-integration`（真实角色回接）、`freight-dispatch-update`（驾驶、双列九机、capacity-check.json）、`citadel-greenery-followup`（同机位绿植）。上述目录均在 `artifacts/pipeline/` 下，有改动前源快照。旧GLB下载仍需单独重新导出；尚未完成正式苔庭战役、目标图级完整细化及整体性能验收。

本批实际参照：`artifacts/pipeline/bookshop-compound-targets/locust-target.png`、`ant-approved.png`、`beetle-approved.png`；高山圣城 `assets/concepts/citadel-style-v2/target-v2.png` 与 `assets/art-references/citadel/shore-to-plaza-target-v1.png`。信使沿用户最终低帽檐探险草帽、风镜置帽冠、溜肩和翻领夹克修订，而非早期披风重甲轮廓。


## 2026-09-28 连续反馈修正：空货列、贴地、射击、驾驶与标牌

本批实际修改 Web 主场景，汇总 `artifacts/pipeline/september-28-fixes/review.html`。保留各批 source-before，未清理用户存档、未触碰 Godot 或旧导出。

1. **空货列确有开局/恢复漏洞**：旧开局红蓝从 progress=0 空车在世界线路运行，新开局改为分别停首厂等真实生产。旧近站存档（距平台中心0.01米）等待生产状态未恢复，正常时钟12秒检查会离站；新代码重新建立平台等货锁，同样检查保持停车。之后红蓝均实际装齐三种各3台。没有假造9台初始货物；厂内空编组等待/回厂仍可见，旧存档在世界线上的空车仍需先返厂。证据 freight-empty-start-fix/{before-check,check}.json。
2. **重甲兵腿部埋地**：旧先锋兵 gh 仅采样苔庭/星球，不包含基地地面。新增 bookshopGroundSampler，径向采样真实圆形铺装、厂院与通道，结合已登记卸货台；只有基地内接管，区域外返回原采样。排除房顶/吊车，缓存静态地面。六个实际优化模型位置检查脚底约0.024米离地，15个厂院采样成功，区域外null。vanguard-base-ground-fix/grounded.png 是隔离位置验证，不是完整登陆流程录像。
3. **移动与运输射击**：原 combat.js 仅甲壳虫移动命令分支会射击，现三种均能沿行进方向移动并独立瞄准。robotArticulation 新增独立fire/pitch参数，保留下肢行走或运输蹲姿，叠加上身/炮塔瞄准；火炮、步枪、双管的原武器效果保留。baseDefense 允许 transit，车载不移动货位；地面防御增加贴地接近、墙体探测与机器人间距检查。生产/预留/吊装中不参与防御；隐藏、未落地士兵不作为目标；瞄准角、墙体和友方遮挡会阻止开火。远离基地的货车可对附近真实舰队自卫。
4. **C视角仍遮挡**：前批眼位调整不够。现在驾驶时隐藏当前机车组，切C回乘客或F下车恢复原visible；红蓝均测3个轨道位置。只影响本机车，不隐藏世界建筑或轨道。证据 freight-driver-clear。
5. **蝗虫更绿**：单独材质映射为主甲#4d703e、副甲#789361，甲壳虫sage#879881不改；clearcoat=.8仍在。共享工厂入口覆盖展示/生产/运输/战斗实例，不改旧GLB。locust-green-paint同光照对照。
6. **牌面语言和字体**：所有本轮书店镇场景牌改英文；按用户最后指示，蚂蚁例外为“螞蟻書店”“螞蟻・蒸汽動力廠”。英文店招Georgia/Palatino，工业Trebuchet MS/Arial，繁体Songti TC/Noto Serif TC；Canvas按牌面宽高、字距和measureText适配，不用fillText最大宽度挤扁。Hard to Find保留。

验证：37项robotOps测试通过（新增三种移动射击）；受控靶标实景测试三机均发生位移及射击，车载三机在行驶中开火且货位偏移0；浏览器无pageerror。robot-mobile-fire/transport-fire.png 的红球是隔离测试靶，未加入生产代码；测试时隐藏真实敌人避免干扰生产。不是完整莫比斯/苔庭战役验收。地面防御仍为局部避障接近，不等于完整基地导航网；战役弹药/性能整体验收尚待完成。

动作来源：用户Ashley Wood图片；查证书名 World War Robot，未取得能核实的书中步态原文，不宣称读过完整书或照搬文字动作规格。工程分层参考 Epic 官方 Aim Offset 文档：https://dev.epicgames.com/documentation/unreal-engine/aim-offset?application_version=4.27 。出版信息检索：https://www.indiegogo.com/en/projects/idwpublishing/ashley-wood-s-world-war-robot-hardcover-book 。Jev只做文字证据分类，不代替看图/验收。

## 2026-09-28 信使肩胯/帽色、机器人音效、主视角右键修复
- 信使：实际 courierWasteland builder 肩轴 x±.205→±.163，y .325→.294；收窄夹克肩线、袖帽与腰带，补连续裤装骨盆、后侧臀部和上腿体积。保留单肩甲，改曲面壳覆盖抬臂接缝；帽色从黄色改锈棕 #85452c，帽檐使用同一织物材质，风镜仍在帽上。humanCourier 实际入口直接调用，非独立候选。正背侧、行走、坐姿截图见 courier-shoulder-hips；未声称目标图已达8分或新增虚构迭代轮数。
- 三机原创WebAudio：蝗虫三连发/枪机/退壳，蚂蚁低频压力炮/泄压，甲壳虫五发短脉冲。接 weaponEffects 实际枪口与撞击点，移动/运输共享；真实伤害和失能事件才触发确认脆响。近身破空仅当听点靠近弹道中段；蚂蚁压力弹无超音速裂响。五方向厂墙射线每模型700ms缓存估计反射，带距离延迟/衰减/左右声像，复用既有声部预算与压缩总线；M键同时压低现有SFX总线。不是完整声学仿真，未用COD录音。
- 音频验证：实际三个模型触发枪声3/1/5次，撞击3/1/3次（快速撞击受预算限流）；浏览器无pageerror。试听录制峰值0.433，无削波，远距/静音拒绝新声测试通过，破空和反射均触发。听感需用户试听，不把数值检查当音质验收。robot-combat-audio/review.html 与 preview.webm。
- C主视角：camera.js 第一人称分支原先忽略 camOrbit/camPitch。现在右键拖动应用两角度，松开沿用回正规则，只转相机不改列车方向。红蓝车实鼠标测试yaw/pitch/回正/驾驶室隐藏均通过，零pageerror。first-person-right-look/check.json。
- 37项robotOps测试通过。全战役与长期密集交火混音仍待完整验收。旧Godot/GLB未更新。
- 声音参考：Infinity Ward 官方2019年武器独立声、退壳和环境反射/延迟介绍 https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Creating-an-Orchestra-of-Incredible-Audio-Effects-Weapon-Sounds-in-Call-of-Duty-Modern-Warfare 。信使依据用户认可目标图及9月28日穿模/帽色截图；没有另造风格目标。


## 2026-09-28 岩群 WFC 初版与飞艇加速
- 十二门徒岩群已接入纵向模块 WFC（seaStackWfc.js）；21 根接口匹配，6,624 次铁路探测无命中；按各自海面法线定向。实际前后截图：artifacts/pipeline/sea-stacks-wfc/review.html。
- **未视觉验收**：用户指出缺少多级宽岩台；当前仅为纵向半径接口组合，不能声称完成 Bad North 式地形模块布局。用户截图还显示岩脚悬空感，需核对可见海面与采样面。下一步应重构台地模块、岩台植被约束，并单独接入云雾渲染。
- 飞艇新增左 Shift 按住加速，沿用 2.5 倍平滑推进，松开回落；保留 E 兼容，Ctrl 下降。上下艇复位倍率；直接运行控制器检查正常约 9、加速约 22.5、释放及重新登艇约 9 单位/秒。证据：artifacts/pipeline/airship-left-shift/check.json。
- 莫比斯飞行器持续低频振荡层已静音，吸附音 55/82.6Hz 嗡鸣已删除，保留风声与战斗反馈。语法/场景加载检查通过；尚未进行主观听感验收。


## 2026-09-28 Oskar engine research: partial
User requested all OskSta media. Chrome Apple-event JavaScript disabled; user assistance requested. X web access returned 403. Located 9 public embedded clips and inspected 36 sampled times, not full-duration or full-timeline review. One clip has several dark sampled frames. Draft: docs/OSKAR_WORLD_ENGINE_STUDY.md. Evidence: artifacts/research/oskar-engine/index.html. Existing WFC, vegetation and cloud modules inspected at their entry points; no new engine implemented. Next: continue logged-in media inventory after user enables access, especially tree/cloud experiments.


## 2026-09-28 Oskar 方法顾问接入
- 用户指定十二门徒岩群与高山圣城城堡优先使用顾问，重点为配色与模块建模，增加人物动作约束研究。
- 角色定义：仓库 .codex/agents/oskar_world_advisor.toml；Skill：.agents/skills/oskar-world-advisor，已安装 ~/.codex/skills/oskar-world-advisor。项目 AGENTS.md 已记录委派路由；本会话普通子代理明确加载 Skill 做首次双场景研究，未声称自定义角色配置已热加载。
- 来源、视觉观察、项目推断分开；X登录标签已发现但内容读取超时，尚未全量遍历。Bad North/Townscaper深入研究未完成，角色动作WFC作者证据待核。
- 本批只添加研究与顾问配置，未改变游戏场景。下一步按顾问方案先做岩群宽台地/城堡台基候选区，再做同机位配色与功能验收。


## 2026-09-28 十二门徒峡谷边缘岩台与配色第一版
- 已接入 seaStackTerraces.js；两级真实宽台面与蓝灰/浅岩台/深湿岩/灰绿配色，属于项目试色，非作者官方色板。WFC只用于局部崖壁变体，未实现完整3D模块拓扑。
- 用户要求放峡谷边缘：球面径向布置，实际海面三角射线承托，底圈/泡沫/碎石统一采样，台面灌木实例贴地。
- 21候选中8组通过铁路与城市保护盒选址；13组保守隐藏，不称全部迁移成功。全铁路46800次抽样零碰撞，底圈入水，默认页面/着色器零错误。
- review: artifacts/pipeline/sea-stack-terraces/review.html；notes.md包含范围限制、回退与证据。仍有规则台阶感，未最终美术验收。圣城城堡未改。
- 顾问只读审查已使用；Jev文本复核请求连接失败，本地人工复核，未假报通过。下一步可细化城市保护盒恢复安全候选，并继续打散台面轮廓。


## 2026-09-28 顾问研究后的十二门徒海岸模块与选址修正
- 用户指出上一版侵占书店广场；本批限定叹息之门左侧海岸，7/8候选通过，1个保护区冲突排除，其他旧候选隐藏。书店圆形场地整体保护，城市包围盒增加三角面窄检测。
- oskar_world_advisor先调研WFC作者与Parks Victoria官方资料后实施两轮：12海蚀模块/6段接口，真实一维WFC选择宏观岩段，目前3种合法链。单侧岩台、平缓碎顶、较窄岩脚与蓝灰色层级；不是完整Bad North引擎。
- 100 seed模块网格检查与3项几何测试通过；实际浏览器/着色器零错，46800铁路抽样零碰撞，底圈入水，广场截图完整开放。局部岩壁仍较平整，未称最终美术验收；多天气/长期漫游待做。
- 当前检查页 artifacts/pipeline/sea-stacks-gate-left/review.html；顾问研究 artifacts/pipeline/sea-stacks-bad-north/advisor-research.md。本批未改圣城城堡。

来源：WFC作者 https://github.com/mxgmn/WaveFunctionCollapse ；公园管理方 https://www.parks.vic.gov.au/places-to-see/parks/twelve-apostles-marine-national-park 。2018演讲读取失败，未声称看完。


## 2026-09-29 十二门徒海岸形体
用户提供蓝灰概念图为配色与轮廓目标；实际海岸照片查看来源 https://offloadmedia.feverup.com/secretmelbourne.com/wp-content/uploads/2023/12/08154739/new-lookouts-port-campbell-national-park.jpg ，属于第三方摄影资料，非官方图、未复制为游戏纹理。观察：宽厚断崖、略收腰柱身、短碎顶、水平层理、深湿脚。官方地貌背景 https://www.parks.vic.gov.au/places-to-see/parks/twelve-apostles-marine-national-park 。算法事实与视频覆盖见 artifacts/research/oskar-engine/conference-study.md。模型是项目原创程序化实现。


## 2026-09-29 十二门徒植被专项
- 用户认可岩体；保持岩体和布局，新增seaStackVegetation.js：真实上承三角面草皮色域、三瓣灰绿低丛、短草扇。由随机圆灌木改为连续色块与簇状组织。
- 顾问查阅既有2022年草实验抽帧；不是Bad North原始植被算法。未实现作者深度/背景对比shader，也不称为植被WFC。研究来源 https://threadreaderapp.com/thread/1590669875869286400.html 。
- 12seed测试覆盖草皮贴面、根点、灌丛8向外围承托及原岩体position不变。渲染与运行记录 artifacts/pipeline/sea-stack-vegetation/review.html / after.json。近景仍风格化，草皮边界受三角分辨率限制。


## 2026-09-29 Highland Citadel landform rebuild
Two implemented candidates: rejected isolated spikes in candidate1, then runtime-probed subordinate shoulders with safe partial displacement and three protected relaxation passes. Old-town main ridge, low bay shoulder and new-city backdrop changed; city transforms and sea openings retained. Actual review: artifacts/pipeline/citadel-landform-rebuild/review.html. 10 tests pass; 514 checked structural meshes / 59267 world vertices have identical before/after hash3924031306; 23049 rail probes0hits,0wet rear-coast samples;212 planted roots supported. Three existing candidate/lighting warnings unchanged, not fixed. Query citadelLandform=0 retains baseline; source-before preserved. This is authored ridge-field terrain, not full WFC/hydraulic erosion. Notes include limits and actual screenshots; no all-weather long-run claim.


## 2026-09-29 Citadel vegetation integrated

Added supported slope turf and denser cypress/scrub using the project advisor proposal (not an exact Oskar shader reproduction). 618 roots supported; 23,049 rail probes clear; protected structures unchanged. Real before/after evidence and remaining visual limits: `artifacts/pipeline/citadel-vegetation/review.html` and `notes.md`. Current mountain geometry retained.


## 2026-09-29 Old-town crown correction

Completed local tower top-storey correction: seated octagonal transition, thicker shorter piers, eight arch rings; retained roof palette and lower tower. Actual close-up comparison: `artifacts/pipeline/old-tower-crown/review.html`. No page errors; existing three warnings unchanged. Notes include rollback and scope.


2026-09-29 crown follow-up complete: solid arch spandrels, centered depth, narrower capitals; front/rear/skyline runtime images reviewed. Evidence: `artifacts/pipeline/old-tower-crown/review.html`; prior round preserved.


## 2026-09-30 Citadel living slopes integrated

Advisor-guided project implementation: shared turf/woodland habitat, 8000 supported short-grass instances, copied terrain winding repaired, final-mesh cloud cache replacing stale HF. 731 planted roots supported; 23049 rail probes clear; protected structure hash unchanged; 7 tests pass. Actual evidence/limits/source links: `artifacts/pipeline/citadel-living-slopes/review.html`, `notes.md`, `advisor-cloud-method.md`. Not an exact Oskar shader reproduction; clouds remain thin in front view and turf patch edges angular.

Final cloud follow-up: repaired duplicated -52 composition translation via explicit coordinate conversion. Final runtime cloud close-up/overview now visibly correct; 8 total tests pass, active cloud centres at least61.05 scene units from rail in capture. Final evidence in citadel-living-slopes/cloud-fixed*.png.
