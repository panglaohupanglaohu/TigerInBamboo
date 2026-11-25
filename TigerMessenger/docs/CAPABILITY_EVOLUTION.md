# 作者时间线与能力补全索引

日期：2026-11-14。根据现有作者原文、视频审核和重构映射整理；本轮没有新增全片观看或代码补全验收。

共同资料指纹：`sha256:9aa982dd0ce9654c4de18f61ffd53dcf3efa561392515bca0541a8a23fe09a30`。来源：REACodeRefactoring/learn/data.js + learn/pipeline.js.evolution。

来源 285 条，原管线 268 行／249 个唯一帖子，5 行无帖子锚点；未登管线 36 条。28 个主题，85 条有效解释关系；161 条没有足够依据连接前后关系（包括独立能力、展示等，不等于待学习）。

部分实现 57 条：高 3、中 42、低 12。这是来源记录数，同一实现的多视频需合并施工，不等于177个独立开发任务。

高：共享机制/组合接口/正确性阻塞；中：局部能力补齐与交付对账；低：旧分支/非关键表现/可选实验。来源不足单独标记，不能用新日期或 partial 数量自动判定工作量。

next 是本地对后续未命名程序化世界实验的分组，不是已确认的正式游戏名。2016 早期实验不自动称为 Townscaper；球面不只有 2024 一个阶段。

## 阶段导航

| 阶段 | 来源 | 部分实现 |
|---|---:|---:|
| Bad North | 104 | 21 |
| Townscaper | 75 | 12 |
| next · 后续未命名实验 | 79 | 17 |
| sphere · 球面世界 | 7 | 2 |
| 早期实验 | 14 | 3 |
| 其他来源 | 6 | 2 |

## 日期冲突（原登记不覆盖）

| 帖子 | 登记日期 | ID发布时间 UTC |
|---|---|---|
| 818857408848130048 | 2018-06-20 | 2017-01-10 |
| 832633189277409280 | 2018-06-22 | 2017-02-17 |
| 827561690896162816 | 2018-06-15 | 2017-02-03 |
| 837027901853810688 | 2018-06-18 | 2017-03-01 |

X Snowflake 格式与原始实现：[X 文档](https://docs.x.com/fundamentals/x-ids)、[Twitter IdWorker](https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala)。发布时间不等于作者第一次产生想法的时间。

## 补全队列（作者时间顺序，按优先级筛选在页面完成）

| 发布时间 | 阶段 | 来源 | 优先级 | 下一步 |
|---|---|---|---|---|
| 2016-10-08 | early | [784847588893814785](http://localhost:8769/pipeline.html?evolutionClip=784847588893814785) | 低 | 先核现有落点，再围绕以下原记录残差补全：片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现 |
| 2016-10-08 | early | [784847933686575104](http://localhost:8769/pipeline.html?evolutionClip=784847933686575104) | 低 | 先核现有落点，再围绕以下原记录残差补全：缺装配起点可指定与格内细分 |
| 2016-10-08 | early | [784848286272327680](http://localhost:8769/pipeline.html?evolutionClip=784848286272327680) | 低 | 先核现有落点，再围绕以下原记录残差补全：缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块 |
| 2016-11-01 | badnorth | [793557992931266561](http://localhost:8769/pipeline.html?evolutionClip=793557992931266561) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：不将本地四选项冒充SSAO/方向AO。 |
| 2016-11-15 | badnorth | [798580832906739712](http://localhost:8769/pipeline.html?evolutionClip=798580832906739712) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。 |
| 2016-12-31 | badnorth | [815236105079398400](http://localhost:8769/pipeline.html?evolutionClip=815236105079398400) | 中 | 无可执行残差：同高片/逻辑阶差面积诊断已交付（plateauRuns/stepDropArea · scene.plateau-diag · tests/plateau-diag.test.mjs，擂台/复算通过）；剩余为原片算法未公开的永久卡点，再立项需新证据，不把推测当原算法。 |
| 2017-01-24 | badnorth | [823848950553780226](http://localhost:8769/pipeline.html?evolutionClip=823848950553780226) | 低 | 先核现有落点，再围绕以下原记录残差补全：命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。 |
| 2017-02-02 | badnorth | [827215002448846848](http://localhost:8769/pipeline.html?evolutionClip=827215002448846848) | 低 | 先核现有落点，再围绕以下原记录残差补全：本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。 |
| 2017-02-02 | badnorth | [827216768783495168](http://localhost:8769/pipeline.html?evolutionClip=827216768783495168) | 低 | 先核现有落点，再围绕以下原记录残差补全：真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。 |
| 2017-02-07 | badnorth | [828984794407170048](http://localhost:8769/pipeline.html?evolutionClip=828984794407170048) | 中 | 先核现有落点，再围绕以下原记录残差补全：保留已有每人navFloor，修高度缓动随帧率变化，30/60/120Hz真实Battle双楼层解析一致。原火球/动作/坡面未复现。 |
| 2017-02-17 | other | [832633189277409280](http://localhost:8769/pipeline.html?evolutionClip=832633189277409280) | 中 | 先核现有落点，再围绕以下原记录残差补全：共用 field-surface.js，缺'地形圆角+建筑硬棱'的分层混合 |
| 2017-05-18 | other | [865200072685912064](http://localhost:8769/pipeline.html?evolutionClip=865200072685912064) | 中 | 先核现有落点，再围绕以下原记录残差补全：默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 |
| 2017-07-27 | badnorth | [890611046435627008](http://localhost:8769/pipeline.html?evolutionClip=890611046435627008) | 低 | 先核现有落点，再围绕以下原记录残差补全：双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 |
| 2017-08-28 | badnorth | [902103473365417984](http://localhost:8769/pipeline.html?evolutionClip=902103473365417984) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入 |
| 2017-09-08 | badnorth | [906207980802252801](http://localhost:8769/pipeline.html?evolutionClip=906207980802252801) | 中 | 先核现有落点，再围绕以下原记录残差补全：实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真… |
| 2017-09-09 | badnorth | [906416813810049025](http://localhost:8769/pipeline.html?evolutionClip=906416813810049025) | 低 | 先核现有落点，再围绕以下原记录残差补全：725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。 |
| 2017-11-04 | badnorth | [926903893866541057](http://localhost:8769/pipeline.html?evolutionClip=926903893866541057) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。 |
| 2017-12-19 | badnorth | [943230620242796544](http://localhost:8769/pipeline.html?evolutionClip=943230620242796544) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整冬景美术/植被覆盖及船群战斗组合未实现验收。 |
| 2017-12-19 | badnorth | [943230624369868800](http://localhost:8769/pipeline.html?evolutionClip=943230624369868800) | 中 | 先核现有落点，再围绕以下原记录残差补全：Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。 |
| 2018-02-02 | badnorth | [959530111187013632](http://localhost:8769/pipeline.html?evolutionClip=959530111187013632) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整物种/生态/雨景未复现。 |
| 2018-03-15 | badnorth | [974325184525201409](http://localhost:8769/pipeline.html?evolutionClip=974325184525201409) | 中 | 先核现有落点，再围绕以下原记录残差补全：核心接触策略/输入防NaN通过，实际规划消费者待接 后续已接真实发船泊位/固定朝向直线走廊预留，完整岸礁/动态避让仍缺。 |
| 2018-04-13 | badnorth | [984813819280191488](http://localhost:8769/pipeline.html?evolutionClip=984813819280191488) | 中 | 先核现有落点，再围绕以下原记录残差补全：934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；地面红点是互不重叠小点，**同点位反复死亡仍测不出变深变大**（第2次复证）→ 「堆厚变暗」降级为可选美术增强，不再排期标定 |
| 2018-05-23 | badnorth | [999185422403055616](http://localhost:8769/pipeline.html?evolutionClip=999185422403055616) | 中 | 先核现有落点，再围绕以下原记录残差补全：血斑按物体空间噪声画、头部这轮补上了（头 48px/身 179px 已量），但只有一套空间：原作躯干走皮肤空间、盔与手臂走精灵空间（0096… |
| 2018-06-24 | badnorth | [1010979395719319552](http://localhost:8769/pipeline.html?evolutionClip=1010979395719319552) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。 |
| 2018-07-06 | badnorth | [1015142746372366336](http://localhost:8769/pipeline.html?evolutionClip=1015142746372366336) | 中 | 先核现有落点，再围绕以下原记录残差补全：303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状 |
| 2018-07-10 | badnorth | [1016680972610359298](http://localhost:8769/pipeline.html?evolutionClip=1016680972610359298) | 低 | 先核现有落点，再围绕以下原记录残差补全：本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。 |
| 2019-09-02 | townscaper | [1168571866405097472](http://localhost:8769/pipeline.html?evolutionClip=1168571866405097472) | 中 | 先核现有落点，再围绕以下原记录残差补全：原GPU重投影/动态纹理仍缺。 |
| 2019-11-22 | townscaper | [1197909675443916803](http://localhost:8769/pipeline.html?evolutionClip=1197909675443916803) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整原作视觉与参数未复现。 |
| 2019-11-25 | townscaper | [1198957499027795969](http://localhost:8769/pipeline.html?evolutionClip=1198957499027795969) | 中 | 先核现有落点，再围绕以下原记录残差补全：实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。 |
| 2019-12-13 | townscaper | [1205420678859632640](http://localhost:8769/pipeline.html?evolutionClip=1205420678859632640) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作手绘轮廓和匹配的阴影caster/impostor仍待补。 |
| 2020-01-10 | townscaper | [1215642481162887168](http://localhost:8769/pipeline.html?evolutionClip=1215642481162887168) | 中 | 先核现有落点，再围绕以下原记录残差补全：真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。 |
| 2020-03-13 | townscaper | [1238474550511308800](http://localhost:8769/pipeline.html?evolutionClip=1238474550511308800) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。 |
| 2020-03-20 | townscaper | [1241046107125399552](http://localhost:8769/pipeline.html?evolutionClip=1241046107125399552) | 中 | 先核现有落点，再围绕以下原记录残差补全：原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共… |
| 2020-05-13 | townscaper | [1260586697538113537](http://localhost:8769/pipeline.html?evolutionClip=1260586697538113537) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整动作动画/水花音效、镜头和节奏录制仍缺。 |
| 2020-09-15 | townscaper | [1305951750638231552](http://localhost:8769/pipeline.html?evolutionClip=1305951750638231552) | 中 | 先核现有落点，再围绕以下原记录残差补全：真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。 |
| 2020-12-30 | townscaper | [1344290848180203523](http://localhost:8769/pipeline.html?evolutionClip=1344290848180203523) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：不冒充原作QA、无漏面或完整几何验收。 |
| 2021-03-15 | townscaper | [1371460793032716290](http://localhost:8769/pipeline.html?evolutionClip=1371460793032716290) | 中 | 先核现有落点，再围绕以下原记录残差补全：新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。 |
| 2021-08-24 | townscaper | [1430224300003545091](http://localhost:8769/pipeline.html?evolutionClip=1430224300003545091) | 中 | 先核现有落点，再围绕以下原记录残差补全：第三方DCC及水/植被/材质尚未验收。 |
| 2021-11-12 | next | [1459169210752507904](http://localhost:8769/pipeline.html?evolutionClip=1459169210752507904) | 中 | 先核 patchLayout 现有落点，再做补丁级刚性：让三族按补丁成块而不是按格交错，松弛以补丁为单位；族向约束方案上游试过会到 45°，不要重复。 |
| 2021-12-17 | next | [1471817524148940807](http://localhost:8769/pipeline.html?evolutionClip=1471817524148940807) | 中 | 先核现有落点，再围绕以下原记录残差补全：不改World导航，完整岩岛模块生成未迁移。 |
| 2022-01-15 | next | [1482346496460828674](http://localhost:8769/pipeline.html?evolutionClip=1482346496460828674) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。 |
| 2022-10-10 | next | [1579474420749725696](http://localhost:8769/pipeline.html?evolutionClip=1579474420749725696) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原文未揭示生成器算法，完整坡面/模块联合生成仍待补。 |
| 2022-10-14 | next | [1580835075629133825](http://localhost:8769/pipeline.html?evolutionClip=1580835075629133825) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照… |
| 2022-11-17 | next | [1593215065423245313](http://localhost:8769/pipeline.html?evolutionClip=1593215065423245313) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。 |
| 2023-06-02 | next | [1664566546683899905](http://localhost:8769/pipeline.html?evolutionClip=1664566546683899905) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：真实双网格通过，独立原版buildShoreDistance API未迁移。 |
| 2023-09-05 | next | [1699038611125985317](http://localhost:8769/pipeline.html?evolutionClip=1699038611125985317) | 中 | 裁判对齐后的残差：四岩性色幅超裁判两色±0.08（C09帧近似，需核画面是否过强）；抖动场xz分量与海拔色偏未移植；vendor地形网格换库（B批）后接SEDIMENT_GLSL mode 3/4 并同视角对照。 |
| 2023-09-05 | next | [1699146321318314094](http://localhost:8769/pipeline.html?evolutionClip=1699146321318314094) | 中 | 剪切场尺度已按裁判标定；残差为场形（裁判二倍频值噪声 vs 本地解析正弦场）与位移xz分量（y-only可逆设计）。原作场未知，不宣称完整通用3D逆场。 |
| 2023-09-18 | next | [1703750394164199473](http://localhost:8769/pipeline.html?evolutionClip=1703750394164199473) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 |
| 2023-09-19 | next | [1704246032626762189](http://localhost:8769/pipeline.html?evolutionClip=1704246032626762189) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 |
| 2023-10-02 | next | [1708815475801505819](http://localhost:8769/pipeline.html?evolutionClip=1708815475801505819) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。 |
| 2023-10-05 | next | [1710031224838771027](http://localhost:8769/pipeline.html?evolutionClip=1710031224838771027) | 中 | 先核现有落点，再围绕以下原记录残差补全：其他特征、离散采样和原版完整接口待补。 |
| 2023-11-22 | next | [1727324352264474664](http://localhost:8769/pipeline.html?evolutionClip=1727324352264474664) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… |
| 2024-03-15 | sphere | [1768627849529893109](http://localhost:8769/pipeline.html?evolutionClip=1768627849529893109) | 高 | 补后续世界到球面的 World/模块接线和平滑岸线；不要用已有柱群球面代替。 |
| 2024-03-18 | sphere | [1769641473895432220](http://localhost:8769/pipeline.html?evolutionClip=1769641473895432220) | 高 | 补多格模块的联合形状拟合与误差约束。 |
| 2024-06-05 | next | [1798310423554658732](http://localhost:8769/pipeline.html?evolutionClip=1798310423554658732) | 高 | 将 field-plots 的地块共用主轴/人字耕纹接回 terrainmesh 的真实着色。 |
| 2024-10-24 | next | [1849427564034498642](http://localhost:8769/pipeline.html?evolutionClip=1849427564034498642) | 中 | 先核现有落点，再围绕以下原记录残差补全：原球面卡片/多俯仰仍缺。 |
| 2024-11-01 | next | [1852334860137849222](http://localhost:8769/pipeline.html?evolutionClip=1852334860137849222) | 中 | 先核现有落点，再围绕以下原记录残差补全：共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。 |

## 全部来源覆盖

| 发布时间 | 登记日期 | 阶段 | 帖子 | 状态 | 本地映射 |
|---|---|---|---|---|---|
| 2016-08-25 | 2016-08-25 | early | 768886648625061889 | ref | 不涉及实现 |
| 2016-09-18 | 2016-09-18 | early | 777501038274281472 | ref | 不涉及实现 |
| 2016-09-18 | 2016-09-18 | early | 777596437534240768 | ref | 不涉及实现 |
| 2016-09-28 | 2016-09-28 | early | 781027725452648448 | ref | 不涉及实现 |
| 2016-09-30 | 2016-09-30 | other | 781957658597269506 | done | src/terrain/thin-platform.js、src/world/climb-route.js、src/core/ladder-profile.js、src/world/navlayer.js、src/capabilities/terrain.js、src/terrain/generate.js |
| 2016-10-08 | 2016-10-08 | early | 784847588893814785 | partial | src/sphere/planet.js |
| 2016-10-08 | 2016-10-08 | early | 784847933686575104 | partial | src/sphere/planet.js |
| 2016-10-08 | 2016-10-08 | early | 784848286272327680 | partial | src/sphere/planet.js |
| 2016-10-15 | 2016-10-15 | other | 787319655648100352 | done | src/build/assembly-modules.js、src/build/assembly-sequence.js、src/capabilities/build.js |
| 2016-11-01 | 2016-11-01 | badnorth | 793545297376972801 | done | src/build/multitile-wfc.js、src/build/multitile-iso.js |
| 2016-11-01 | 2016-11-01 | badnorth | 793557992931266561 | partial | src/world/worldmesh.js、src/light/bake.js |
| 2016-11-02 | 2016-11-02 | badnorth | 793806535898136576 | done | src/core/wfc.js |
| 2016-11-05 | 2016-11-05 | early | 794993371261665280 | done | src/world/voxel-ghost.js |
| 2016-11-05 | 2016-11-05 | badnorth | 795010582239997952 | done | src/core/adjacency.js |
| 2016-11-11 | 2016-11-11 | badnorth | 797119718477991936 | done | src/world/layerednav.js、src/world/battle-navigation.js、src/world/fine-portals.js、src/badnorth/battle.js |
| 2016-11-13 | 2016-11-13 | early | 797844857821732864 | done | src/world/voxel-ghost.js |
| 2016-11-15 | 2016-11-15 | badnorth | 798580832906739712 | partial | src/core/space-visibility.js、src/world/space-visibility.js |
| 2016-11-26 | 2016-11-26 | early | 802496920790777856 | done | src/build/buildings.js、src/core/arch-floor-budget.js、src/core/arch-profile.js |
| 2016-11-28 | 2016-11-28 | early | 803190517534248960 | ref | 不涉及实现 |
| 2016-12-08 | 2016-12-08 | early | 806856212260278272 | ref | 不涉及实现 |
| 2016-12-08 | 2016-12-08 | early | 806904557502464000 | done | src/build/canal-bridge-r56.js、src/core/arch-profile.js、src/build/buildings.js |
| 2016-12-09 | 2016-12-09 | early | 807135253215199233 | ref | 不涉及实现 |
| 2016-12-09 | 2016-12-09 | badnorth | 807256278154301441 | done | src/build/buildings.js、src/world/app.js |
| 2016-12-17 | 2016-12-17 | badnorth | 810157485638189056 | done | src/core/route-preview.js |
| 2016-12-19 | 2016-12-19 | badnorth | 810878197134950401 | done | src/core/nav-visibility.js、src/world/visibility.js |
| 2016-12-31 | 2016-12-31 | badnorth | 815236105079398400 | partial | src/core/terrace-profile.js |
| 2017-01-03 | 2017-01-03 | badnorth | 816332161036984320 | done | src/core/trajectory-fan.js |
| 2017-01-04 | 2017-01-04 | badnorth | 816743289500106752 | done | src/world/battle-navigation.js、src/badnorth/battle.js、src/badnorth/battle-c01.js |
| 2017-01-04 | 2017-01-04 | badnorth | 816748103193817088 | done | src/world/navmesh-flow.js、src/world/battle-navigation.js、src/badnorth/battle-c02.js |
| 2017-01-06 | 2017-01-06 | badnorth | 817323301357948928 | ref | 不涉及实现 |
| 2017-01-10 | 2018-06-20 | other | 818857408848130048 | done | src/core/field-surface.js |
| 2017-01-16 | 2017-01-16 | badnorth | 820977247083528192 | done | src/core/unit-shadow.js、src/life/unit-shadow-batch.js、src/badnorth/battle-g3.js、src/badnorth/battle-c02.js |
| 2017-01-17 | 2017-01-17 | badnorth | 821321422140309504 | done | src/core/unit-shadow.js、src/life/unit-shadow-batch.js、src/badnorth/battle.js |
| 2017-01-18 | 2017-01-18 | badnorth | 821680056514781186 | done | src/core/unit-shadow.js、src/life/unit-shadow-batch.js、src/badnorth/battle.js |
| 2017-01-24 | 2017-01-24 | badnorth | 823848950553780226 | partial | artifacts/coverage/path-samples-review.md |
| 2017-02-02 | 2017-02-02 | badnorth | 827215002448846848 | partial | src/core/unit-tier.js |
| 2017-02-02 | 2017-02-02 | badnorth | 827216768783495168 | partial | src/core/banner.js、src/badnorth/battle.js |
| 2017-02-03 | 2018-06-15 | badnorth | 827561690896162816 | ref | 不涉及实现（机制已在 src/badnorth/*） |
| 2017-02-07 | 2017-02-07 | badnorth | 828984794407170048 | partial | src/core/unit-ground-height.js、src/badnorth/battle.js |
| 2017-02-17 | 2018-06-22 | other | 832633189277409280 | partial | src/core/field-surface.js |
| 2017-03-01 | 2018-06-18 | badnorth | 837027901853810688 | done | src/life/smoke.js、src/life/fire-coupling.js、src/badnorth/battle-c01.js |
| 2017-03-07 | 2017-03-07 | badnorth | 839067977781768193 | done | src/badnorth/squad-hud.js |
| 2017-03-31 | 2017-03-31 | badnorth | 847717312912211970 | ref | 不涉及实现（角色外观分件本仓无对应模块） |
| 2017-05-12 | 2017-05-12 | badnorth | 863019585162932224 | done | src/core/coroutine.js |
| 2017-05-18 | 2017-05-18 | other | 865200072685912064 | partial | src/core/wfc.js |
| 2017-06-01 | 2017-06-01 | badnorth | 870296307889573889 | ref | 不涉及实现（纯展示） |
| 2017-06-02 | 2017-06-02 | badnorth | 870558914345041921 | na | 未关联代码 |
| 2017-06-22 | 2017-06-22 | badnorth | 877995885250138119 | na | 未关联代码 |
| 2017-06-30 | 2017-06-30 | badnorth | 880853661936734211 | done | src/world/traffic.js、src/world/battle-navigation.js、src/badnorth/battle.js |
| 2017-07-07 | 2017-07-07 | badnorth | 883447205176238083 | done | src/badnorth/squad-footprint.js、src/badnorth/battle.js |
| 2017-07-15 | 2017-07-15 | badnorth | 886199305522085890 | done | src/world/point-floor.js、src/badnorth/battle.js、src/badnorth/battle-c02.js、src/world/passage-overlay.js |
| 2017-07-27 | 2017-07-27 | badnorth | 890611046435627008 | partial | src/core/house-door-presence.js、src/badnorth/battle.js |
| 2017-08-26 | 2017-08-26 | badnorth | 901469409579061248 | done | src/life/boats.js、src/core/wake-sampling.js、src/world/view.js |
| 2017-08-27 | 2017-08-27 | badnorth | 901842167508992000 | done | src/badnorth/flowfield.js、src/badnorth/battle.js、src/badnorth/battle-g3.js |
| 2017-08-28 | 2017-08-28 | badnorth | 902069261304287232 | done | src/badnorth/flowfield.js、src/badnorth/battle.js、src/badnorth/battle-g3.js |
| 2017-08-28 | 2017-08-28 | badnorth | 902103473365417984 | partial | src/core/distance-isolines.js |
| 2017-09-01 | 2017-09-01 | badnorth | 903647529203634176 | done | src/badnorth/battle.js、src/core/spear-thrust.js |
| 2017-09-08 | 2017-09-08 | badnorth | 906207980802252801 | partial | src/life/atmosphere.js、src/core/fog-envelope.js |
| 2017-09-09 | 2017-09-09 | badnorth | 906416813810049025 | partial | artifacts/coverage/cloud-depth-review.md |
| 2017-09-09 | 2017-09-09 | badnorth | 906425294533394432 | done | src/world/layerednav.js、src/world/battle-navigation.js、src/world/fine-portals.js、src/badnorth/battle.js |
| 2017-09-24 | 2017-09-24 | badnorth | 911913981731885056 | done | src/world/island-snapshot.js |
| 2017-09-26 | 2017-09-26 | badnorth | 912691357440978945 | done | src/badnorth/battle-c01.js |
| 2017-09-28 | 2017-09-28 | badnorth | 913407568730615808 | na | 未关联代码 |
| 2017-10-09 | 2017-10-09 | badnorth | 917405214638006273 | done | src/badnorth/island.js、src/world/navlayer.js |
| 2017-11-04 | 2017-11-04 | badnorth | 926834721392340992 | done | src/badnorth/battle.js |
| 2017-11-04 | 2017-11-04 | badnorth | 926890207298899969 | done | src/badnorth/battle.js |
| 2017-11-04 | 2017-11-04 | badnorth | 926903893866541057 | partial | src/life/atmosphere.js、src/core/world-probes.js |
| 2017-11-11 | 2017-11-11 | badnorth | 929417420921556993 | done | src/world/view.js |
| 2017-11-16 | 2017-11-16 | badnorth | 931196707236392960 | done | src/core/world.js、src/core/world-probes.js、src/life/atmosphere.js |
| 2017-12-06 | 2017-12-06 | badnorth | 938395867215728640 | ref | 未关联代码 |
| 2017-12-06 | 2017-12-06 | badnorth | 938405900573986816 | done | src/core/region-groups.js、src/campaign/campaign.js |
| 2017-12-06 | 2017-12-06 | badnorth | 938422757288792064 | done | src/core/region-groups.js、src/campaign/campaign.js |
| 2017-12-19 | 2017-12-19 | badnorth | 943230620242796544 | partial | src/life/atmosphere.js、src/badnorth/battle.js |
| 2017-12-19 | 2017-12-19 | badnorth | 943230624369868800 | partial | src/life/atmosphere.js、src/core/world-probes.js |
| 2017-12-29 | 2017-12-29 | badnorth | 946660607008403456 | done | src/badnorth/battle-c01.js、src/badnorth/battle.js |
| 2018-01-30 | 2018-01-30 | badnorth | 958371606350454784 | done | src/core/part-random.js、src/ui/slot-portrait.js |
| 2018-01-30 | 2018-01-30 | badnorth | 958410200146497537 | done | src/core/banner.js、src/life/banner.js、src/badnorth/battle.js |
| 2018-02-02 | 2018-02-02 | badnorth | 959530111187013632 | partial | src/core/level-flora.js、src/life/vegetation.js |
| 2018-02-03 | 2018-02-03 | badnorth | 959752525867036672 | done | src/core/vertex-dual.js、src/world/vertex-dual-overlay.js |
| 2018-03-03 | 2018-03-03 | badnorth | 969860566322958336 | done | src/core/sprite-ambiguity.js、src/life/unit-sprites.js、src/badnorth/battle.js |
| 2018-03-11 | 2018-03-11 | badnorth | 972829402873716737 | done | src/badnorth/flowfield.js、src/badnorth/battle.js |
| 2018-03-15 | 2018-03-15 | badnorth | 974325184525201409 | partial | src/core/obb.js、src/badnorth/landing-plan.js、src/badnorth/battle.js |
| 2018-03-16 | 2018-03-16 | badnorth | 974564862729838592 | done | src/core/spatial.js、src/world/bary-gizmo.js |
| 2018-03-16 | 2018-03-16 | badnorth | 974579499802202113 | done | src/core/spatial.js、src/world/bary-gizmo.js |
| 2018-03-26 | 2018-03-26 | badnorth | 978194866520944641 | na | 未关联代码 |
| 2018-03-26 | 2018-03-26 | badnorth | 978195201901711360 | na | 未关联代码 |
| 2018-03-26 | 2018-03-26 | badnorth | 978211952504852480 | done | src/world/island-snapshot.js |
| 2018-04-13 | 2018-04-13 | badnorth | 984703192465330176 | na | 未关联代码 |
| 2018-04-13 | 2018-04-13 | badnorth | 984813819280191488 | partial | src/badnorth/battle.js、src/core/combat-state.js |
| 2018-04-20 | 2018-04-20 | badnorth | 987267068495003648 | done | src/core/ballistic-table.js、src/badnorth/battle.js |
| 2018-05-11 | 2018-05-11 | badnorth | 995034777756536833 | done | src/badnorth/battle-c03.js、src/ui/scene-capability-panel.js |
| 2018-05-11 | 2018-05-11 | badnorth | 995043346778415104 | done | src/core/route-preview.js、src/badnorth/battle-c01.js |
| 2018-05-23 | 2018-05-23 | badnorth | 999185422403055616 | partial | src/badnorth/battle.js |
| 2018-05-23 | 2018-05-23 | badnorth | 999191760944418817 | done | src/badnorth/battle.js |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587812462530561 | done | src/water/waterfall.js |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587817021636609 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587821220229120 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587825024425984 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587828992266240 | done | src/badnorth/battle.js、src/badnorth/battle-c02.js、src/badnorth/battle-c01.js、src/life/banner.js |
| 2018-06-24 | 2018-06-24 | badnorth | 1010979395719319552 | partial | src/core/part-random.js |
| 2018-07-06 | 2018-07-06 | badnorth | 1015140880666300416 | done | src/life/smoke.js、src/core/smoke-order.js |
| 2018-07-06 | 2018-07-06 | badnorth | 1015142746372366336 | partial | life/smoke.js#CROWN_STYLE · smoke.html · battle-c01 |
| 2018-07-06 | 2018-07-06 | badnorth | 1015149712469524480 | done | src/life/smoke.js |
| 2018-07-06 | 2018-07-06 | badnorth | 1015151731804721152 | done | src/life/smoke.js |
| 2018-07-10 | 2018-07-10 | badnorth | 1016680972610359298 | partial | ui.html（本地UI实验，未接游戏指令） |
| 2018-07-12 | 2018-07-12 | badnorth | 1017355723171344385 | done | src/world/outline.js |
| 2018-07-26 | 2018-07-26 | badnorth | 1022573208590057472 | done | src/badnorth/battle.js |
| 2018-07-27 | 2018-07-27 | badnorth | 1022855252574437376 | na | 未关联代码 |
| 2018-08-01 | 2018-08-01 | badnorth | 1024679338292256769 | done | src/core/ui-reveal.js |
| 2018-09-20 | 2018-09-20 | badnorth | 1042732450730913793 | done | src/core/campaign-graph.js、src/campaign/campaign.js |
| 2018-10-29 | 2018-10-29 | badnorth | 1056990611738451968 | done | src/life/effects.js |
| 2018-10-29 | 2018-10-29 | badnorth | 1056992291108413446 | done | src/life/effects.js |
| 2018-10-29 | 2018-10-29 | badnorth | 1056999668486471682 | done | src/life/effects.js |
| 2018-11-10 | 2018-11-10 | badnorth | 1061221291137605633 | done | src/core/mirror-uv.js、src/ui/ornament.js |
| 2018-11-10 | 2018-11-10 | badnorth | 1061227418961219585 | done | src/core/mirror-uv.js |
| 2018-11-10 | 2018-11-10 | badnorth | 1061229717582475264 | done | src/core/mirror-uv.js |
| 2018-11-13 | 2018-11-13 | badnorth | 1062374549407350790 | done | src/core/meshwriter.js、src/terrain/terrainmesh.js |
| 2018-11-15 | 2018-11-15 | badnorth | 1063115611289645057 | done | src/life/vegetation.js |
| 2018-12-28 | 2018-12-28 | badnorth | 1078792665980915714 | done | src/core/campaign-graph.js、src/campaign/campaign.js |
| 2019-02-05 | 2019-02-05 | badnorth | 1092709665199345664 | done | src/badnorth/battle-c03.js |
| 2019-02-18 | 2019-02-18 | badnorth | 1097458505315946496 | done | src/core/frontier.js、src/campaign/frontier-overlay.js、src/campaign/map-ink.js |
| 2019-03-10 | 2019-03-10 | badnorth | 1104771432440049664 | done | src/core/ornament-field.js、src/ui/ornament.js |
| 2019-03-11 | 2019-03-11 | badnorth | 1105131621391495176 | done | src/core/ornament-field.js、src/ui/ornament.js |
| 2019-04-21 | 2019-04-21 | townscaper | 1120036868966502401 | done | src/core/cell-selection.js、src/world/app.js、src/world/view.js |
| 2019-07-07 | 2019-07-07 | townscaper | 1147881669350891521 | done | src/core/grid.js |
| 2019-07-16 | 2019-07-16 | townscaper | 1151137783785771008 | done | src/core/infinite.js、src/core/infinite-c06.js |
| 2019-07-16 | 2019-07-16 | townscaper | 1151152046055272449 | na | 未关联代码 |
| 2019-07-18 | 2019-07-18 | townscaper | 1151770831619534848 | done | src/core/infinite.js |
| 2019-08-20 | 2019-08-20 | townscaper | 1163836000688365571 | done | src/core/marching-cubes.js |
| 2019-08-23 | 2019-08-23 | townscaper | 1164926304640229376 | done | src/core/wfc.js |
| 2019-09-01 | 2019-09-01 | townscaper | 1168168400155267072 | done | src/light/bake.js |
| 2019-09-02 | 2019-09-02 | townscaper | 1168571866405097472 | partial | src/world/worldmesh.js、src/light/bake.js |
| 2019-09-18 | 2019-09-18 | townscaper | 1174406613031170049 | na | 未关联代码 |
| 2019-09-24 | 2019-09-24 | townscaper | 1176516621223043073 | done | src/build/buildings.js |
| 2019-09-30 | 2019-09-30 | townscaper | 1178731576982724611 | done | src/build/garden-plots-c07.js、src/build/buildings.js、src/world/view-c07.js |
| 2019-10-08 | 2019-10-08 | townscaper | 1181464374839521280 | done | src/build/buildings.js、src/core/building-components.js |
| 2019-10-29 | 2019-10-29 | townscaper | 1189109278361165825 | ref | src/build/buildings.js |
| 2019-10-31 | 2019-10-31 | townscaper | 1189902695303458816 | done | src/build/steel-frame-edit.js、src/build/steel-r56.js |
| 2019-10-31 | 2019-10-31 | townscaper | 1189908238566903808 | done | src/build/buildings.js、src/core/arch-profile.js |
| 2019-11-01 | 2019-11-01 | townscaper | 1190191289922465793 | done | src/world/view.js |
| 2019-11-06 | 2019-11-06 | townscaper | 1191990107785572352 | done | src/core/anchored-billboard.js、src/life/vegetation.js |
| 2019-11-15 | 2019-11-15 | townscaper | 1195463004919357443 | na | 未关联代码 |
| 2019-11-22 | 2019-11-22 | townscaper | 1197909675443916803 | partial | src/build/buildings.js、src/light/bake.js |
| 2019-11-25 | 2019-11-25 | townscaper | 1198957499027795969 | partial | src/world/save.js |
| 2019-11-29 | 2019-11-29 | townscaper | 1200520827898343425 | done | src/core/palette.js、src/core/palette-store.js |
| 2019-12-01 | 2019-12-01 | townscaper | 1201179450668441600 | done | src/ui/game-ui-c06.js、src/ui/icon-toolbar.js、src/ui/icon-ink.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205416648397721601 | done | src/core/opening-footprint.js、src/build/buildings.js、src/build/yard-prop-art-r56.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205420678859632640 | partial | src/core/leaf-atlas.js、src/life/leaf-surface.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205422438437273601 | done | src/render/opening-punch-layer.js、src/world/app.js |
| 2019-12-24 | 2019-12-24 | townscaper | 1209519206233968641 | na | 未关联代码 |
| 2019-12-28 | 2019-12-28 | townscaper | 1210969316071477248 | na | 未关联代码 |
| 2020-01-02 | 2020-01-02 | townscaper | 1212732478458343424 | done | src/life/decor.js |
| 2020-01-10 | 2020-01-10 | townscaper | 1215642481162887168 | partial | src/water/shore.js、src/core/shore-loops.js、src/world/townDemo.js |
| 2020-01-10 | 2020-01-10 | townscaper | 1215644531221311488 | done | src/water/planar-reflection.js、src/water/shore.js、src/world/view.js |
| 2020-03-10 | 2020-03-10 | townscaper | 1237293295887319040 | done | src/core/palette.js、src/world/app.js |
| 2020-03-10 | 2020-03-10 | townscaper | 1237305125070426112 | done | src/light/bake.js、src/world/worldmesh.js |
| 2020-03-13 | 2020-03-13 | townscaper | 1238474550511308800 | partial | src/core/courtyards.js、src/build/buildings.js |
| 2020-03-17 | 2020-03-17 | townscaper | 1239901715266244609 | na | 未关联代码 |
| 2020-03-20 | 2020-03-20 | townscaper | 1241046107125399552 | partial | src/core/leaf-atlas.js、src/life/leaf-surface.js |
| 2020-03-20 | 2020-03-20 | townscaper | 1241096929490149376 | done | src/core/texel-skip.js、src/core/town-skin.js、src/world/town-skin-layer.js |
| 2020-03-25 | 2020-03-25 | townscaper | 1242824460325052417 | done | src/ui/game-ui-c06.js、src/core/playful-layout.js |
| 2020-03-26 | 2020-03-26 | townscaper | 1243228419162341379 | done | src/light/cloud-shadow.js、src/world/cloud-deck-layer.js、src/world/view.js、src/water/reflection.js、src/life/vegetation.js |
| 2020-03-31 | 2020-03-31 | townscaper | 1244892370392489989 | done | src/life/birds.js |
| 2020-04-03 | 2020-04-03 | townscaper | 1246074663546916873 | done | src/core/prop-anim.js、src/world/prop-anim-layer.js |
| 2020-05-04 | 2020-05-04 | townscaper | 1257213678056857600 | done | src/build/steel-r56.js |
| 2020-05-06 | 2020-05-06 | townscaper | 1258005604066627586 | ref | 未关联代码 |
| 2020-05-07 | 2020-05-07 | townscaper | 1258421104756097029 | done | src/life/splash-c07.js、src/life/effects.js |
| 2020-05-11 | 2020-05-11 | townscaper | 1259838941299183619 | done | src/core/wire-route.js、src/life/decor.js |
| 2020-05-13 | 2020-05-13 | townscaper | 1260586697538113537 | partial | src/core/snapshot-replay.js、src/world/app.js |
| 2020-06-10 | 2020-06-10 | townscaper | 1270725616430530566 | done | src/life/decor.js、src/world/view.js |
| 2020-06-18 | 2020-06-18 | townscaper | 1273520600221433857 | done | src/life/decor.js、src/world/view.js |
| 2020-06-22 | 2020-06-22 | townscaper | 1275089608758484992 | done | src/build/church-niche-r56.js、src/build/buildings.js、src/core/ladder-profile.js |
| 2020-06-29 | 2020-06-29 | townscaper | 1277554535297236994 | ref | 未关联代码 |
| 2020-07-03 | 2020-07-03 | townscaper | 1279107097108635649 | done | src/build/buildings.js、src/build/module-catalog-r56.js |
| 2020-08-05 | 2020-08-05 | townscaper | 1290997501332525056 | done | src/build/garden-plots-c07.js、src/build/buildings.js、src/world/view-c07.js |
| 2020-08-26 | 2020-08-26 | townscaper | 1298689301488775169 | done | src/world/ao-mesh-debug.js、src/world/view.js |
| 2020-09-04 | 2020-09-04 | townscaper | 1301816247479345152 | done | src/core/radial-patch.js |
| 2020-09-06 | 2020-09-06 | townscaper | 1302686201401442309 | done | src/core/infinite.js、src/core/grid.js |
| 2020-09-15 | 2020-09-15 | townscaper | 1305948413872267265 | done | src/world/view.js |
| 2020-09-15 | 2020-09-15 | townscaper | 1305951750638231552 | partial | src/core/penumbra.js、src/light/penumbra.js、src/world/penumbra-layer.js、src/world/view.js |
| 2020-09-28 | 2020-09-28 | townscaper | 1310503825510367232 | done | src/core/mixed-perspective.js、src/world/view-mixed-persp.js、src/world/view.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313837640366596096 | done | src/world/flying-town-c06.js、src/core/loop-lift.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313840428685447170 | done | src/core/penumbra.js、src/light/penumbra.js、src/world/penumbra-layer.js、src/world/view.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313841094069817344 | done | src/world/view.js、src/ui/environment-panel.js |
| 2020-11-26 | 2020-11-26 | townscaper | 1331905048801144836 | done | src/build/lighthouse.js |
| 2020-11-27 | 2020-11-27 | townscaper | 1332410042784641026 | done | src/core/infinite.js |
| 2020-12-15 | 2020-12-15 | townscaper | 1338825080844021760 | done | src/sphere/planet.js、src/sphere/sphere-stages.js |
| 2020-12-15 | 2020-12-15 | townscaper | 1338829205157646336 | done | src/sphere/stereo-insert-c06.js、src/sphere/planet-town.js |
| 2020-12-30 | 2020-12-30 | townscaper | 1344290848180203523 | partial | src/core/qa-replay.js |
| 2021-03-13 | 2021-03-13 | townscaper | 1370772056279805953 | na | 未关联代码 |
| 2021-03-14 | 2021-03-14 | townscaper | 1371191380773629956 | na | 未关联代码 |
| 2021-03-15 | 2021-03-15 | townscaper | 1371460793032716290 | partial | src/core/palette.js、src/world/app.js |
| 2021-04-21 | 2021-04-21 | townscaper | 1384958097542819845 | done | src/core/grid.js、src/ui/game-ui-c06.js |
| 2021-06-05 | 2021-06-05 | townscaper | 1401145625572425728 | done | src/tools/merge-bench-c06.js、src/tools/mesh-wire-overlay.js、src/world/worldmesh.js |
| 2021-07-01 | 2021-07-01 | townscaper | 1410697531424714752 | na | 未关联代码 |
| 2021-08-17 | 2021-08-17 | townscaper | 1427721874490933250 | done | src/core/decal-accum.js、src/world/view-c07.js |
| 2021-08-24 | 2021-08-24 | townscaper | 1430224300003545091 | partial | src/tools/objexport.js |
| 2021-08-24 | 2021-08-24 | townscaper | 1430227487376781317 | done | src/core/town-skin.js、src/world/town-skin-layer.js、src/world/view-c07.js |
| 2021-10-11 | 2021-10-11 | next | 1447483550257799171 | done | src/world/build-reel-c09.js、src/terrain/terrain-strokes-c09.js、src/core/stroke-reveal-c09.js、src/world/scenes.js |
| 2021-10-11 | 2021-10-11 | next | 1447488323845509121 | done | src/terrain/soft-tops.js、src/terrain/terrainmesh.js、src/world/terrace-edges.js、src/terrain/generate.js、src/core/depression-fill.js、src/terrain/drainage.js |
| 2021-10-11 | 2021-10-11 | next | 1447494168448753667 | done | src/core/grid.js、src/core/wfc.js |
| 2021-10-11 | 2021-10-11 | next | 1447496205282549761 | done | src/core/grid.js、src/terrain/generate.js |
| 2021-10-12 | 2021-10-12 | next | 1448039167057879048 | done | src/terrain/island-viz-c09.js、src/core/stroke-reveal-c09.js、src/terrain/pipeline-stages.js |
| 2021-11-11 | 2021-11-11 | next | 1458921394855718917 | done | src/core/halfedge.js、src/core/halfedge-patch-c08.js |
| 2021-11-12 | 2021-11-12 | next | 1459169210752507904 | partial | src/core/grid-wireframe.js |
| 2021-12-01 | 2021-12-01 | next | 1466059785703460870 | na | 未关联代码 |
| 2021-12-17 | 2021-12-17 | next | 1471817524148940807 | partial | src/core/corner-footprint.js |
| 2022-01-03 | 2022-01-03 | next | 1478114309263839244 | done | src/core/uv-radial-atlas.js |
| 2022-01-10 | 2022-01-10 | next | 1480635131614355459 | done | src/terrain/blotch-pattern.js、src/world/view.js |
| 2022-01-13 | 2022-01-13 | next | 1481661852887265288 | done | src/core/paint-normal.js、src/light/lightvolume.js、src/light/megatexture-gi.js |
| 2022-01-14 | 2022-01-14 | next | 1482011744843223042 | done | src/world/view-c11-normalline.js |
| 2022-01-15 | 2022-01-15 | next | 1482346496460828674 | partial | src/core/contrast-field.js |
| 2022-02-03 | 2022-02-03 | next | 1489193847422865410 | na | 未关联代码 |
| 2022-02-05 | 2022-02-05 | next | 1490068909042642944 | done | src/core/graph-bands-c08.js |
| 2022-10-10 | 2022-10-10 | next | 1579474420749725696 | partial | src/terrain/generate.js |
| 2022-10-10 | 2022-10-10 | next | 1579478470098243584 | done | src/terrain/cage-c09.js、src/terrain/terrain-strokes-c09.js、src/world/build-reel-c09.js |
| 2022-10-10 | 2022-10-10 | next | 1579483114178768898 | done | src/build/multicell.js、src/build/prefab-socket.js、src/ui/house-project.js、src/world/scenes.js |
| 2022-10-12 | 2022-10-12 | next | 1580158269267406849 | done | src/core/canopy.js、src/life/vegetation.js |
| 2022-10-12 | 2022-10-12 | next | 1580162341668237312 | done | src/core/canopy.js、src/life/vegetation.js、src/life/impostor.js |
| 2022-10-14 | 2022-10-14 | next | 1580835075629133825 | partial | src/core/voxel-distance.js、src/light/lightvolume.js |
| 2022-10-14 | 2022-10-14 | next | 1580845127207387137 | done | src/light/megatexture-gi.js、src/light/megatexture-gi-debug.js、src/world/view-c11-megagi.js |
| 2022-10-14 | 2022-10-14 | next | 1580846877855338497 | done | src/light/megatexture-gi.js、src/world/view-c11-megagi.js |
| 2022-10-18 | 2022-10-18 | next | 1582293326815862786 | done | src/core/frontier-candidates.js |
| 2022-10-19 | 2022-10-19 | next | 1582757294672314368 | done | src/core/voxel-ray.js、src/light/lightvolume.js、src/world/view.js |
| 2022-10-24 | 2022-10-24 | next | 1584623053061099520 | done | src/build/splice-polygon-c09.js、src/terrain/terrainmesh.js |
| 2022-11-10 | 2022-11-10 | next | 1590669875869286400 | done | src/life/vegetation.js、src/core/anchored-billboard.js |
| 2022-11-10 | 2022-11-10 | next | 1590674061092212738 | done | src/world/view-c11-grassline.js、src/core/c11-maps.js |
| 2022-11-17 | 2022-11-17 | next | 1593215065423245313 | partial | src/life/impostor.js |
| 2023-05-05 | 2023-05-05 | next | 1654401054828638214 | done | src/terrain/pipeline-stages.js、src/terrain/clay-ao.js |
| 2023-06-02 | 2023-06-02 | next | 1664565063552847873 | done | src/world/float-bands.js |
| 2023-06-02 | 2023-06-02 | next | 1664566546683899905 | partial | src/water/shore.js、src/core/shore-profile.js |
| 2023-06-07 | 2023-06-07 | next | 1666429884208381953 | done | src/water/shore.js、src/water/foam-mask.js、src/world/view-c10.js |
| 2023-06-15 | 2023-06-15 | next | 1669315384619540487 | done | src/terrain/island-quality-c09.js |
| 2023-06-17 | 2023-06-17 | next | 1670064751181791233 | done | src/terrain/pipeline-job-c08.js |
| 2023-06-19 | 2023-06-19 | next | 1670720537662836736 | done | src/terrain/shape.js |
| 2023-06-19 | 2023-06-19 | next | 1670725072540106755 | done | src/terrain/shape.js |
| 2023-06-19 | 2023-06-19 | next | 1670790425232175108 | done | src/core/grid-kinds-c08.js、src/core/grid.js、src/world/app.js |
| 2023-06-19 | 2023-06-19 | next | 1670794261669769217 | done | src/terrain/features.js、src/core/module-audit.js |
| 2023-06-22 | 2023-06-22 | next | 1671808851895627776 | done | src/core/rock-topology.js、src/terrain/terrainmesh.js、src/terrain/shape.js、src/terrain/terrain-collide.js |
| 2023-06-22 | 2023-06-22 | next | 1671840905957978113 | done | src/core/terrain-burial.js |
| 2023-07-07 | 2023-07-07 | next | 1677242779162877952 | done | src/core/trigraph.js、src/core/trigraph-edit-c08.js |
| 2023-08-30 | 2023-08-30 | next | 1696864977171189980 | done | src/terrain/blotch-atlas.js、src/terrain/blotch-tongue-c09.js、src/world/view-shading.js |
| 2023-08-30 | 2023-08-30 | next | 1696896119794479541 | done | src/terrain/blotch-atlas.js、src/terrain/blotch-tongue-c09.js、src/world/view-shading.js |
| 2023-09-05 | 2023-09-05 | next | 1699038611125985317 | partial | src/core/sediment.js、src/core/sediment-bands-c09.js、src/terrain/terrainmesh.js、src/world/view.js |
| 2023-09-05 | 2023-09-05 | next | 1699146321318314094 | partial | src/core/sediment.js、src/terrain/terrainmesh.js、src/world/view.js |
| 2023-09-18 | 2023-09-18 | next | 1703750394164199473 | partial | src/terrain/blotch-pattern.js、src/world/view.js |
| 2023-09-19 | 2023-09-19 | next | 1704218784028905984 | done | src/light/surface-shadow.js |
| 2023-09-19 | 2023-09-19 | next | 1704246032626762189 | partial | src/terrain/blotch-pattern.js、src/world/view.js |
| 2023-09-22 | 2023-09-22 | next | 1705195380457996629 | done | src/light/surface-shadow.js |
| 2023-09-28 | 2023-09-28 | next | 1707490274425884929 | done | src/core/edge-inset.js、src/life/vegetation.js |
| 2023-09-28 | 2023-09-28 | next | 1707490932017279035 | done | src/terrain/shrub-band.js、src/terrain/shrub-texture.js |
| 2023-09-28 | 2023-09-28 | next | 1707497006640365880 | done | src/terrain/shrub-band.js、src/terrain/terrainmesh.js、src/core/meshwriter.js |
| 2023-10-02 | 2023-10-02 | next | 1708815475801505819 | partial | src/terrain/features.js、src/core/deformation-guard.js |
| 2023-10-05 | 2023-10-05 | next | 1710031224838771027 | partial | src/core/color-volume.js、src/world/view.js |
| 2023-10-11 | 2023-10-11 | next | 1712088611934371876 | done | src/core/palette-graph.js、src/core/okhsl.js、src/core/oklab.js、src/world/ground-palette-map.js |
| 2023-10-18 | 2023-10-18 | next | 1714613599035863191 | done | src/terrain/field-pattern.js |
| 2023-11-14 | 2023-11-14 | next | 1724449858369568780 | done | src/core/node-graph-editor.js、src/ui/node-graph-editor.js |
| 2023-11-22 | 2023-11-22 | next | 1727315611959865407 | done | src/world/view-post-extras.js、src/core/camera-motion.js |
| 2023-11-22 | 2023-11-22 | next | 1727324352264474664 | partial | src/core/camera-motion.js、src/world/view.js |
| 2024-01-29 | 2024-01-29 | next | 1751932427272909032 | done | src/core/module-patch.js、src/build/module-volume.js、src/build/module-patch-commit.js |
| 2024-01-29 | 2024-01-29 | next | 1751945034851570056 | done | src/world/outline.js |
| 2024-02-15 | 2024-02-15 | next | 1758250248483278925 | done | src/water/planar-reflection.js、src/world/view.js |
| 2024-02-15 | 2024-02-15 | next | 1758251637280268481 | done | src/water/watervol.js、src/water/land-distance.js |
| 2024-03-05 | 2024-03-05 | next | 1764958522398146667 | done | src/core/atlas.js、src/core/atlas-c09.js、src/core/rectbin-c08.js |
| 2024-03-05 | 2024-03-05 | next | 1765041830461055127 | done | src/core/atlas.js |
| 2024-03-05 | 2024-03-05 | next | 1765115069837221962 | done | src/core/atlas.js、src/core/atlas-c09.js |
| 2024-03-15 | 2024-03-15 | sphere | 1768627849529893109 | partial | src/sphere/planet.js |
| 2024-03-18 | 2024-03-18 | sphere | 1769641473895432220 | partial | src/sphere/planet.js |
| 2024-03-18 | 2024-03-18 | sphere | 1769691526924292506 | done | src/terrain/river-collapse-c09.js |
| 2024-04-19 | 2024-04-19 | sphere | 1781405550061687016 | done | src/terrain/patch-blend.js、src/world/view-shading.js |
| 2024-04-26 | 2024-04-26 | sphere | 1783792917183606829 | done | src/sphere/worldmap-shore.js、src/sphere/worldmap-material.js |
| 2024-05-02 | 2024-05-02 | next | 1786014232594485497 | done | src/core/mountain-bake.js |
| 2024-05-16 | 2024-05-16 | sphere | 1791049306213912823 | done | src/core/cube-height.js、src/light/cube-height.js |
| 2024-05-29 | 2024-05-29 | sphere | 1795831296952041691 | done | src/world/navgraph.js |
| 2024-06-05 | 2024-06-05 | next | 1798310423554658732 | partial | src/core/field-plots.js |
| 2024-10-24 | 2024-10-24 | next | 1849427564034498642 | partial | src/life/impostor.js |
| 2024-10-25 | 2024-10-25 | next | 1849730611964973481 | done | src/water/foam-mask.js、src/world/view-c10.js |
| 2024-10-25 | 2024-10-25 | next | 1849732997945110651 | done | src/water/shore.js、src/water/foam-mask.js、src/world/view-c10.js |
| 2024-11-01 | 2024-11-01 | next | 1852334860137849222 | partial | src/life/impostor.js |
| 2025-02-13 | 2025-02-13 | next | 1890018647655272491 | done | src/core/doodle-hallway-layout.js、src/build/doodle-hallway.js、src/world/doodle-overlay.js |
| 2025-03-05 | 2025-03-05 | next | 1897266928961700215 | done | src/core/doodle-hallway-layout.js、src/build/doodle-hallway.js、src/world/doodle-overlay.js |
| 2025-11-19 | 2025-11-19 | next | 1991099314714902634 | done | src/water/shore.js、src/world/view.js、src/world/app.js |
| 2025-11-19 | 2025-11-19 | next | 1991101097818403263 | done | src/water/shore.js、src/core/wave-cycle.js、src/water/foam-mask.js |
| 2025-11-19 | 2025-11-19 | next | 1991103578011029507 | done | src/water/shore.js、src/core/wave-cycle.js、src/world/view.js |
| 2025-12-02 | 2025-12-02 | other | 1995813566344011807 | na | 未关联代码 |

## 保持边界

- 三项有文字依据的局部替代：专用反差图、受控表面阴影、火焰缩放错误修正；不自动删除历史方法或任何用户场景。
- 2022 技术组合与2024球面展示有原文；next 正式游戏名未确认，2016早期球面另列。
- 已有节点编辑器、轨迹碰撞等旧缺口先对账，不重复开发。
- 每项批注绑定原 status/where/note；记录变化显示待复核。关系绑定其作者文字/审核笔记，变化失效。
- 代码扫描输出 module.evolution 与组合来源；没有关联的模块不编造发布日期。作者发展时间、代码存在、Worker适配与本场景验收分别记录。
- 原目录290代码的10个辅助文件缺落点与其他行为差距不因本次整理被核销。
