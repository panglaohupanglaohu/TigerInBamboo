# 作者时间线与能力补全索引

日期：2026-11-14。根据现有作者原文、视频审核和重构映射整理；本轮没有新增全片观看或代码补全验收。

共同资料指纹：`sha256:3f9b3af104359c78b8393e97d40b00f7b3411c0fee76304e814277f69e6897bb`。来源：REACodeRefactoring/learn/data.js + learn/pipeline.js.evolution。

来源 285 条，原管线 268 行／249 个唯一帖子，5 行无帖子锚点；未登管线 36 条。28 个主题，85 条有效解释关系；161 条没有足够依据连接前后关系（包括独立能力、展示等，不等于待学习）。

部分实现 177 条：高 31、中 119、低 27。这是来源记录数，同一实现的多视频需合并施工，不等于177个独立开发任务。

高：共享机制/组合接口/正确性阻塞；中：局部能力补齐与交付对账；低：旧分支/非关键表现/可选实验。来源不足单独标记，不能用新日期或 partial 数量自动判定工作量。

next 是本地对后续未命名程序化世界实验的分组，不是已确认的正式游戏名。2016 早期实验不自动称为 Townscaper；球面不只有 2024 一个阶段。

## 阶段导航

| 阶段 | 来源 | 部分实现 |
|---|---:|---:|
| Bad North | 104 | 51 |
| Townscaper | 75 | 43 |
| next · 后续未命名实验 | 79 | 66 |
| sphere · 球面世界 | 7 | 6 |
| 早期实验 | 14 | 7 |
| 其他来源 | 6 | 4 |

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
| 2016-09-30 | other | [781957658597269506](http://localhost:8769/pipeline.html?evolutionClip=781957658597269506) | 中 | 先核现有落点，再围绕以下原记录残差补全：原薄台/攀爬仍缺。 |
| 2016-10-08 | early | [784847588893814785](http://localhost:8769/pipeline.html?evolutionClip=784847588893814785) | 低 | 先核现有落点，再围绕以下原记录残差补全：片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现 |
| 2016-10-08 | early | [784847933686575104](http://localhost:8769/pipeline.html?evolutionClip=784847933686575104) | 低 | 先核现有落点，再围绕以下原记录残差补全：缺装配起点可指定与格内细分 |
| 2016-10-08 | early | [784848286272327680](http://localhost:8769/pipeline.html?evolutionClip=784848286272327680) | 低 | 先核现有落点，再围绕以下原记录残差补全：缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块 |
| 2016-10-15 | other | [787319655648100352](http://localhost:8769/pipeline.html?evolutionClip=787319655648100352) | 中 | 先核现有落点，再围绕以下原记录残差补全：底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。 |
| 2016-11-01 | badnorth | [793557992931266561](http://localhost:8769/pipeline.html?evolutionClip=793557992931266561) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：不将本地四选项冒充SSAO/方向AO。 |
| 2016-11-05 | early | [794993371261665280](http://localhost:8769/pipeline.html?evolutionClip=794993371261665280) | 低 | 先核现有落点，再围绕以下原记录残差补全：158帧两张联系表全看；逐段色相量出外表面是连续漂移(H154-208°/S恒12-15%)不是6色档→LAYER_PALETTE换实测灰青族，并删掉voxel-ghost.html里抄的第二份旧色板；仍缺内部玫瑰墙(H≈355°)与bandHeight实证(片里量不出层带边界) |
| 2016-11-11 | badnorth | [797119718477991936](http://localhost:8769/pipeline.html?evolutionClip=797119718477991936) | 高 | 与 906425294533394432 共用精细门户/侧壁/脚高任务，保留早期导航证据。 |
| 2016-11-13 | early | [797844857821732864](http://localhost:8769/pipeline.html?evolutionClip=797844857821732864) | 低 | 先核现有落点，再围绕以下原记录残差补全：仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节 |
| 2016-11-15 | badnorth | [798580832906739712](http://localhost:8769/pipeline.html?evolutionClip=798580832906739712) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。 |
| 2016-11-26 | early | [802496920790777856](http://localhost:8769/pipeline.html?evolutionClip=802496920790777856) | 中 | 先核现有落点，再围绕以下原记录残差补全：楔石/完整桥构仍缺。 |
| 2016-12-08 | early | [806904557502464000](http://localhost:8769/pipeline.html?evolutionClip=806904557502464000) | 中 | 先核现有落点，再围绕以下原记录残差补全：楔石/完整桥构仍缺。 |
| 2016-12-09 | badnorth | [807256278154301441](http://localhost:8769/pipeline.html?evolutionClip=807256278154301441) | 中 | 先核现有落点，再围绕以下原记录残差补全：群体寻路及多格完整规则未验收。 |
| 2016-12-17 | badnorth | [810157485638189056](http://localhost:8769/pipeline.html?evolutionClip=810157485638189056) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层 |
| 2016-12-31 | badnorth | [815236105079398400](http://localhost:8769/pipeline.html?evolutionClip=815236105079398400) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：既有量化保留，新增真实World同高片/逻辑阶差面积诊断，非原算法恢复。 |
| 2017-01-03 | badnorth | [816332161036984320](http://localhost:8769/pipeline.html?evolutionClip=816332161036984320) | 中 | 先对照现有 trajectory-trace / trajectory-preview 的碰撞和阻力实现，剩余聚焦查表/战斗接线与无法读出的参数。 |
| 2017-01-04 | badnorth | [816743289500106752](http://localhost:8769/pipeline.html?evolutionClip=816743289500106752) | 高 | 补沿路径定距列队、跨台阶单列通行、到达后多排落位；与已有单兵导航分开测试。 |
| 2017-01-04 | badnorth | [816748103193817088](http://localhost:8769/pipeline.html?evolutionClip=816748103193817088) | 高 | 核清共享 World 自动生成导航面、通口前视和 Battle 的连续流场接线。 |
| 2017-01-16 | badnorth | [820977247083528192](http://localhost:8769/pipeline.html?evolutionClip=820977247083528192) | 低 | 先核现有落点，再围绕以下原记录残差补全：25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。 |
| 2017-01-17 | badnorth | [821321422140309504](http://localhost:8769/pipeline.html?evolutionClip=821321422140309504) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：本批仅学习复核。 |
| 2017-01-18 | badnorth | [821680056514781186](http://localhost:8769/pipeline.html?evolutionClip=821680056514781186) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：仅学习，不能认证软影高度或坡面算法。 |
| 2017-01-24 | badnorth | [823848950553780226](http://localhost:8769/pipeline.html?evolutionClip=823848950553780226) | 低 | 先核现有落点，再围绕以下原记录残差补全：命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。 |
| 2017-02-02 | badnorth | [827215002448846848](http://localhost:8769/pipeline.html?evolutionClip=827215002448846848) | 低 | 先核现有落点，再围绕以下原记录残差补全：本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。 |
| 2017-02-02 | badnorth | [827216768783495168](http://localhost:8769/pipeline.html?evolutionClip=827216768783495168) | 低 | 先核现有落点，再围绕以下原记录残差补全：真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。 |
| 2017-02-07 | badnorth | [828984794407170048](http://localhost:8769/pipeline.html?evolutionClip=828984794407170048) | 中 | 先核现有落点，再围绕以下原记录残差补全：保留已有每人navFloor，修高度缓动随帧率变化，30/60/120Hz真实Battle双楼层解析一致。原火球/动作/坡面未复现。 |
| 2017-02-17 | other | [832633189277409280](http://localhost:8769/pipeline.html?evolutionClip=832633189277409280) | 中 | 先核现有落点，再围绕以下原记录残差补全：共用 field-surface.js，缺'地形圆角+建筑硬棱'的分层混合 |
| 2017-03-01 | badnorth | [837027901853810688](http://localhost:8769/pipeline.html?evolutionClip=837027901853810688) | 中 | 先核现有落点，再围绕以下原记录残差补全：514帧6/6联系表全核；补齐第99轮唯一剩余缺口：烟体积×火光逐帧联合曲线回归（0.02s步长61帧同帧双读）——0.18s烟2.27×/柱身1.4941/火光0.5810，0.39s火光0.2429而烟109.7%，0.18→0.39零帧例外全是火光降+烟涨，起爆时差0.02s；仍缺逐帧对原片像素对齐与地面红棕斑并入 |
| 2017-05-18 | other | [865200072685912064](http://localhost:8769/pipeline.html?evolutionClip=865200072685912064) | 中 | 先核现有落点，再围绕以下原记录残差补全：默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 |
| 2017-06-30 | badnorth | [880853661936734211](http://localhost:8769/pipeline.html?evolutionClip=880853661936734211) | 高 | 补弯道、多岔路口、复杂拥挤和不同体型的重新路由。 |
| 2017-07-07 | badnorth | [883447205176238083](http://localhost:8769/pipeline.html?evolutionClip=883447205176238083) | 中 | 先核现有落点，再围绕以下原记录残差补全：新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线 |
| 2017-07-15 | badnorth | [886199305522085890](http://localhost:8769/pipeline.html?evolutionClip=886199305522085890) | 中 | 先核现有落点，再围绕以下原记录残差补全：仍缺通用调试层（只挂badnorth）与近景点距略疏 |
| 2017-07-27 | badnorth | [890611046435627008](http://localhost:8769/pipeline.html?evolutionClip=890611046435627008) | 低 | 先核现有落点，再围绕以下原记录残差补全：双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 |
| 2017-08-26 | badnorth | [901469409579061248](http://localhost:8769/pipeline.html?evolutionClip=901469409579061248) | 中 | 先核现有落点，再围绕以下原记录残差补全：重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。 |
| 2017-08-27 | badnorth | [901842167508992000](http://localhost:8769/pipeline.html?evolutionClip=901842167508992000) | 高 | 核清 continuousFlow 与实际 Battle 的数据/更新接口，再补整合；不再追逐原片不可测 LOD。 |
| 2017-08-28 | badnorth | [902069261304287232](http://localhost:8769/pipeline.html?evolutionClip=902069261304287232) | 中 | 保留格边骨架/色块的信息继承证据；不要据此再排 LOD 或强行宣称 continuousFlow 接线是原作要求。 |
| 2017-08-28 | badnorth | [902103473365417984](http://localhost:8769/pipeline.html?evolutionClip=902103473365417984) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入 |
| 2017-09-01 | badnorth | [903647529203634176](http://localhost:8769/pipeline.html?evolutionClip=903647529203634176) | 低 | 先核现有落点，再围绕以下原记录残差补全：仍缺按受击方向抖动与 +10 独立上浮速度 |
| 2017-09-08 | badnorth | [906207980802252801](http://localhost:8769/pipeline.html?evolutionClip=906207980802252801) | 中 | 先核现有落点，再围绕以下原记录残差补全：实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真… |
| 2017-09-09 | badnorth | [906416813810049025](http://localhost:8769/pipeline.html?evolutionClip=906416813810049025) | 低 | 先核现有落点，再围绕以下原记录残差补全：725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。 |
| 2017-09-09 | badnorth | [906425294533394432](http://localhost:8769/pipeline.html?evolutionClip=906425294533394432) | 高 | 补形变后的精细门户、侧壁碰撞与脚高插值；已接入的分层流场不重复实现。 |
| 2017-09-26 | badnorth | [912691357440978945](http://localhost:8769/pipeline.html?evolutionClip=912691357440978945) | 中 | 先核现有落点，再围绕以下原记录残差补全：759帧8/8联系表全核；低α真值工具缺口关闭：新增tools/beam-alpha-slope.py（多帧同点斜率法+PCA+逐像素anchor），自检误差0.001而v3同批全判0(误差0.580)；912实测0278-0285平台0.09-0.13→0288峰值1.00→0289 0.83突灭，逐帧对上联系表；仍缺峰值α=1.0的独立证据与第三机位标定 |
| 2017-11-04 | badnorth | [926903893866541057](http://localhost:8769/pipeline.html?evolutionClip=926903893866541057) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。 |
| 2017-12-19 | badnorth | [943230620242796544](http://localhost:8769/pipeline.html?evolutionClip=943230620242796544) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整冬景美术/植被覆盖及船群战斗组合未实现验收。 |
| 2017-12-19 | badnorth | [943230624369868800](http://localhost:8769/pipeline.html?evolutionClip=943230624369868800) | 中 | 先核现有落点，再围绕以下原记录残差补全：Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。 |
| 2017-12-29 | badnorth | [946660607008403456](http://localhost:8769/pipeline.html?evolutionClip=946660607008403456) | 中 | 先核现有落点，再围绕以下原记录残差补全：仍缺船外沿岸白泡沫带与白花簇 |
| 2018-01-30 | badnorth | [958371606350454784](http://localhost:8769/pipeline.html?evolutionClip=958371606350454784) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整spec/数据接口/剪影IoU仍缺。 |
| 2018-02-02 | badnorth | [959530111187013632](http://localhost:8769/pipeline.html?evolutionClip=959530111187013632) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整物种/生态/雨景未复现。 |
| 2018-02-03 | badnorth | [959752525867036672](http://localhost:8769/pipeline.html?evolutionClip=959752525867036672) | 高 | 把已存在的三角网重心对偶、边界闭合和候选点统一到植被/导航消费者。 |
| 2018-03-15 | badnorth | [974325184525201409](http://localhost:8769/pipeline.html?evolutionClip=974325184525201409) | 中 | 先核现有落点，再围绕以下原记录残差补全：核心接触策略/输入防NaN通过，实际规划消费者待接 后续已接真实发船泊位/固定朝向直线走廊预留，完整岸礁/动态避让仍缺。 |
| 2018-03-16 | badnorth | [974564862729838592](http://localhost:8769/pipeline.html?evolutionClip=974564862729838592) | 中 | 先核现有落点，再围绕以下原记录残差补全：3D原gizmo未完整迁移。 |
| 2018-03-16 | badnorth | [974579499802202113](http://localhost:8769/pipeline.html?evolutionClip=974579499802202113) | 中 | 先核现有落点，再围绕以下原记录残差补全：3D原gizmo未完整迁移。 |
| 2018-04-13 | badnorth | [984813819280191488](http://localhost:8769/pipeline.html?evolutionClip=984813819280191488) | 中 | 先核现有落点，再围绕以下原记录残差补全：934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；地面红点是互不重叠小点，**同点位反复死亡仍测不出变深变大**（第2次复证）→ 「堆厚变暗」降级为可选美术增强，不再排期标定 |
| 2018-04-20 | badnorth | [987267068495003648](http://localhost:8769/pipeline.html?evolutionClip=987267068495003648) | 高 | 核当前弓手接线后补代价表达式、阻力与 Validity 契约，保留真实目标/碰撞校验。 |
| 2018-05-11 | badnorth | [995034777756536833](http://localhost:8769/pipeline.html?evolutionClip=995034777756536833) | 中 | 先核现有落点，再围绕以下原记录残差补全：血迹贴花累积/队伍旗/箭矢三项已在 battle.js 对上，缺指挥官能力（Plunge）、能力键冷却环与 No valid targets… |
| 2018-05-11 | badnorth | [995043346778415104](http://localhost:8769/pipeline.html?evolutionClip=995043346778415104) | 中 | 先核现有落点，再围绕以下原记录残差补全：移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接… |
| 2018-05-23 | badnorth | [999185422403055616](http://localhost:8769/pipeline.html?evolutionClip=999185422403055616) | 中 | 先核现有落点，再围绕以下原记录残差补全：血斑按物体空间噪声画、头部这轮补上了（头 48px/身 179px 已量），但只有一套空间：原作躯干走皮肤空间、盔与手臂走精灵空间（0096… |
| 2018-06-15 | badnorth | [1007587828992266240](http://localhost:8769/pipeline.html?evolutionClip=1007587828992266240) | 中 | 先核现有落点，再围绕以下原记录残差补全：白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐 |
| 2018-06-24 | badnorth | [1010979395719319552](http://localhost:8769/pipeline.html?evolutionClip=1010979395719319552) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。 |
| 2018-07-06 | badnorth | [1015142746372366336](http://localhost:8769/pipeline.html?evolutionClip=1015142746372366336) | 中 | 先核现有落点，再围绕以下原记录残差补全：303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状 |
| 2018-07-10 | badnorth | [1016680972610359298](http://localhost:8769/pipeline.html?evolutionClip=1016680972610359298) | 低 | 先核现有落点，再围绕以下原记录残差补全：本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。 |
| 2019-02-05 | badnorth | [1092709665199345664](http://localhost:8769/pipeline.html?evolutionClip=1092709665199345664) | 中 | 先核现有落点，再围绕以下原记录残差补全：判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、… |
| 2019-02-18 | badnorth | [1097458505315946496](http://localhost:8769/pipeline.html?evolutionClip=1097458505315946496) | 中 | 先核现有落点，再围绕以下原记录残差补全：两侧细分未实现。 |
| 2019-04-21 | townscaper | [1120036868966502401](http://localhost:8769/pipeline.html?evolutionClip=1120036868966502401) | 中 | 先核现有落点，再围绕以下原记录残差补全：703帧中本轮重看sheet-00全100张；补最后一段硬缺口：窗口接选中态（quad-lattice.boundsForCells/mergeBounds/selectionBounds + view.setGridWindowForSelection/builtCluster + grid-debug 点击拾取），grid-window 13项/浏览器34条全过；仍缺与真编辑器撤销/多选联动 |
| 2019-07-16 | townscaper | [1151137783785771008](http://localhost:8769/pipeline.html?evolutionClip=1151137783785771008) | 中 | 先核现有落点，再围绕以下原记录残差补全：仍缺真无限流式（页面最多19块）与块内疏密均匀度 |
| 2019-08-20 | townscaper | [1163836000688365571](http://localhost:8769/pipeline.html?evolutionClip=1163836000688365571) | 高 | 补不规则格上的 3D 等值面查表、歧义消解、顶点焊接与真实生长过程。 |
| 2019-09-02 | townscaper | [1168571866405097472](http://localhost:8769/pipeline.html?evolutionClip=1168571866405097472) | 中 | 先核现有落点，再围绕以下原记录残差补全：原GPU重投影/动态纹理仍缺。 |
| 2019-09-30 | townscaper | [1178731576982724611](http://localhost:8769/pipeline.html?evolutionClip=1178731576982724611) | 中 | 先核现有落点，再围绕以下原记录残差补全：333帧全核验，纠正旧“草地块会长树”：本片无树，README明确是将来计划。高层台地草坪/石边带随建筑重排，当前只有地面层庭院与岩石地形植… |
| 2019-10-08 | townscaper | [1181464374839521280](http://localhost:8769/pipeline.html?evolutionClip=1181464374839521280) | 高 | 补跨格整墙与实际门窗洞口，并约束独立装饰的接口。 |
| 2019-10-31 | townscaper | [1189902695303458816](http://localhost:8769/pipeline.html?evolutionClip=1189902695303458816) | 中 | 先核现有落点，再围绕以下原记录残差补全：296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收 |
| 2019-11-06 | townscaper | [1191990107785572352](http://localhost:8769/pipeline.html?evolutionClip=1191990107785572352) | 中 | 先核现有落点，再围绕以下原记录残差补全：四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生… |
| 2019-11-22 | townscaper | [1197909675443916803](http://localhost:8769/pipeline.html?evolutionClip=1197909675443916803) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整原作视觉与参数未复现。 |
| 2019-11-25 | townscaper | [1198957499027795969](http://localhost:8769/pipeline.html?evolutionClip=1198957499027795969) | 中 | 先核现有落点，再围绕以下原记录残差补全：实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。 |
| 2019-11-29 | townscaper | [1200520827898343425](http://localhost:8769/pipeline.html?evolutionClip=1200520827898343425) | 中 | 先核现有落点，再围绕以下原记录残差补全：PNG/完整原接口与持久化仍待补。 |
| 2019-12-01 | townscaper | [1201179450668441600](http://localhost:8769/pipeline.html?evolutionClip=1201179450668441600) | 低 | 先核现有落点，再围绕以下原记录残差补全：游戏语义/图稿仍缺。 |
| 2019-12-13 | townscaper | [1205416648397721601](http://localhost:8769/pipeline.html?evolutionClip=1205416648397721601) | 中 | 先核现有落点，再围绕以下原记录残差补全：2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。 |
| 2019-12-13 | townscaper | [1205420678859632640](http://localhost:8769/pipeline.html?evolutionClip=1205420678859632640) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作手绘轮廓和匹配的阴影caster/impostor仍待补。 |
| 2019-12-13 | townscaper | [1205422438437273601](http://localhost:8769/pipeline.html?evolutionClip=1205422438437273601) | 中 | 先核现有落点，再围绕以下原记录残差补全：已做独立原型+三栏对照，缺墙体厚度/洞口侧壁与主管线接入 |
| 2020-01-10 | townscaper | [1215642481162887168](http://localhost:8769/pipeline.html?evolutionClip=1215642481162887168) | 中 | 先核现有落点，再围绕以下原记录残差补全：真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。 |
| 2020-01-10 | townscaper | [1215644531221311488](http://localhost:8769/pipeline.html?evolutionClip=1215644531221311488) | 中 | 先核现有落点，再围绕以下原记录残差补全：GPU/双网格通过。未复现全部块面艺术与岸裙尺度。 |
| 2020-03-13 | townscaper | [1238474550511308800](http://localhost:8769/pipeline.html?evolutionClip=1238474550511308800) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。 |
| 2020-03-20 | townscaper | [1241046107125399552](http://localhost:8769/pipeline.html?evolutionClip=1241046107125399552) | 中 | 先核现有落点，再围绕以下原记录残差补全：原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共… |
| 2020-03-20 | townscaper | [1241096929490149376](http://localhost:8769/pipeline.html?evolutionClip=1241096929490149376) | 中 | 先核现有落点，再围绕以下原记录残差补全：仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。 |
| 2020-03-25 | townscaper | [1242824460325052417](http://localhost:8769/pipeline.html?evolutionClip=1242824460325052417) | 低 | 先核现有落点，再围绕以下原记录残差补全：换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。 |
| 2020-03-26 | townscaper | [1243228419162341379](http://localhost:8769/pipeline.html?evolutionClip=1243228419162341379) | 中 | 先核现有落点，再围绕以下原记录残差补全：水/植被/远云影/模糊未完成。 |
| 2020-04-03 | townscaper | [1246074663546916873](http://localhost:8769/pipeline.html?evolutionClip=1246074663546916873) | 中 | 先核现有落点，再围绕以下原记录残差补全：旧uPops只是柱顶增长的局部缩放，拆除灰尘不是逐道具缩没。保留原反馈但src/propanim映射改部分覆盖，稳定身份/保留消失几何/错峰… |
| 2020-05-04 | townscaper | [1257213678056857600](http://localhost:8769/pipeline.html?evolutionClip=1257213678056857600) | 中 | 先核现有落点，再围绕以下原记录残差补全：9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片… |
| 2020-05-07 | townscaper | [1258421104756097029](http://localhost:8769/pipeline.html?evolutionClip=1258421104756097029) | 中 | 先核现有落点，再围绕以下原记录残差补全：片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命 |
| 2020-05-13 | townscaper | [1260586697538113537](http://localhost:8769/pipeline.html?evolutionClip=1260586697538113537) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整动作动画/水花音效、镜头和节奏录制仍缺。 |
| 2020-06-22 | townscaper | [1275089608758484992](http://localhost:8769/pipeline.html?evolutionClip=1275089608758484992) | 中 | 先核现有落点，再围绕以下原记录残差补全：教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析… |
| 2020-07-03 | townscaper | [1279107097108635649](http://localhost:8769/pipeline.html?evolutionClip=1279107097108635649) | 高 | 补可追溯的零件目录与完整部件签名显示；将真实模块覆盖和原作 545 件资产差距分账。 |
| 2020-08-05 | townscaper | [1290997501332525056](http://localhost:8769/pipeline.html?evolutionClip=1290997501332525056) | 中 | 先核现有落点，再围绕以下原记录残差补全：细石板宽度、门口优先和中心装饰仍待补。 |
| 2020-09-04 | townscaper | [1301816247479345152](http://localhost:8769/pipeline.html?evolutionClip=1301816247479345152) | 中 | 先核现有落点，再围绕以下原记录残差补全：见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。 |
| 2020-09-06 | townscaper | [1302686201401442309](http://localhost:8769/pipeline.html?evolutionClip=1302686201401442309) | 中 | 先核现有落点，再围绕以下原记录残差补全：还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×) |
| 2020-09-15 | townscaper | [1305951750638231552](http://localhost:8769/pipeline.html?evolutionClip=1305951750638231552) | 中 | 先核现有落点，再围绕以下原记录残差补全：真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。 |
| 2020-09-28 | townscaper | [1310503825510367232](http://localhost:8769/pipeline.html?evolutionClip=1310503825510367232) | 低 | 先核现有落点，再围绕以下原记录残差补全：原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→… |
| 2020-10-07 | townscaper | [1313837640366596096](http://localhost:8769/pipeline.html?evolutionClip=1313837640366596096) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺飞行操控、船壳外沿白色构件、建筑随岛抬升 |
| 2020-12-15 | townscaper | [1338825080844021760](http://localhost:8769/pipeline.html?evolutionClip=1338825080844021760) | 中 | 先核现有落点，再围绕以下原记录残差补全：区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 |
| 2020-12-15 | townscaper | [1338829205157646336](http://localhost:8769/pipeline.html?evolutionClip=1338829205157646336) | 中 | 先核现有落点，再围绕以下原记录残差补全：区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 |
| 2020-12-30 | townscaper | [1344290848180203523](http://localhost:8769/pipeline.html?evolutionClip=1344290848180203523) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：不冒充原作QA、无漏面或完整几何验收。 |
| 2021-03-15 | townscaper | [1371460793032716290](http://localhost:8769/pipeline.html?evolutionClip=1371460793032716290) | 中 | 先核现有落点，再围绕以下原记录残差补全：新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。 |
| 2021-04-21 | townscaper | [1384958097542819845](http://localhost:8769/pipeline.html?evolutionClip=1384958097542819845) | 中 | 先核现有落点，再围绕以下原记录残差补全：游戏手柄/连刷仍未接入。 |
| 2021-06-05 | townscaper | [1401145625572425728](http://localhost:8769/pipeline.html?evolutionClip=1401145625572425728) | 中 | 先核现有落点，再围绕以下原记录残差补全：双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。 |
| 2021-08-17 | townscaper | [1427721874490933250](http://localhost:8769/pipeline.html?evolutionClip=1427721874490933250) | 低 | 先核现有落点，再围绕以下原记录残差补全：本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了 |
| 2021-08-24 | townscaper | [1430224300003545091](http://localhost:8769/pipeline.html?evolutionClip=1430224300003545091) | 中 | 先核现有落点，再围绕以下原记录残差补全：第三方DCC及水/植被/材质尚未验收。 |
| 2021-08-24 | townscaper | [1430227487376781317](http://localhost:8769/pipeline.html?evolutionClip=1430227487376781317) | 中 | 先核现有落点，再围绕以下原记录残差补全：本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换 |
| 2021-10-11 | next | [1447483550257799171](http://localhost:8769/pipeline.html?evolutionClip=1447483550257799171) | 中 | 先核现有落点，再围绕以下原记录残差补全：本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线 |
| 2021-10-11 | next | [1447488323845509121](http://localhost:8769/pipeline.html?evolutionClip=1447488323845509121) | 高 | 先明确连续软坡/排水的可验收目标，再补对应生成机制；XZ 形变不等价于完整侵蚀算法。 |
| 2021-10-11 | next | [1447494168448753667](http://localhost:8769/pipeline.html?evolutionClip=1447494168448753667) | 高 | 补四分子格联合模块约束和真实 3D tile 接口。 |
| 2021-10-11 | next | [1447496205282549761](http://localhost:8769/pipeline.html?evolutionClip=1447496205282549761) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。 |
| 2021-10-12 | next | [1448039167057879048](http://localhost:8769/pipeline.html?evolutionClip=1448039167057879048) | 中 | 先核现有落点，再围绕以下原记录残差补全：仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛 |
| 2021-11-11 | next | [1458921394855718917](http://localhost:8769/pipeline.html?evolutionClip=1458921394855718917) | 高 | 补显式半边环/顶点扇与编辑接口；原片未公开的指令语义继续标待来源。 |
| 2021-11-12 | next | [1459169210752507904](http://localhost:8769/pipeline.html?evolutionClip=1459169210752507904) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺格心彩色小块语义、3D透视视角、接world实景 |
| 2021-12-17 | next | [1471817524148940807](http://localhost:8769/pipeline.html?evolutionClip=1471817524148940807) | 中 | 先核现有落点，再围绕以下原记录残差补全：不改World导航，完整岩岛模块生成未迁移。 |
| 2022-01-03 | next | [1478114309263839244](http://localhost:8769/pipeline.html?evolutionClip=1478114309263839244) | 中 | 先核现有落点，再围绕以下原记录残差补全：346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核… |
| 2022-01-13 | next | [1481661852887265288](http://localhost:8769/pipeline.html?evolutionClip=1481661852887265288) | 中 | 先核现有落点，再围绕以下原记录残差补全：不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。 |
| 2022-01-14 | next | [1482011744843223042](http://localhost:8769/pipeline.html?evolutionClip=1482011744843223042) | 中 | 先核现有落点，再围绕以下原记录残差补全：原笔触normal atlas与投影接缝仍缺。 |
| 2022-01-15 | next | [1482346496460828674](http://localhost:8769/pipeline.html?evolutionClip=1482346496460828674) | 中 | 先核现有落点，再围绕以下原记录残差补全：原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。 |
| 2022-02-05 | next | [1490068909042642944](http://localhost:8769/pipeline.html?evolutionClip=1490068909042642944) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻 |
| 2022-10-10 | next | [1579474420749725696](http://localhost:8769/pipeline.html?evolutionClip=1579474420749725696) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原文未揭示生成器算法，完整坡面/模块联合生成仍待补。 |
| 2022-10-10 | next | [1579478470098243584](http://localhost:8769/pipeline.html?evolutionClip=1579478470098243584) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整原cage/3D碰撞仍缺。 |
| 2022-10-10 | next | [1579483114178768898](http://localhost:8769/pipeline.html?evolutionClip=1579483114178768898) | 高 | 补全多格 tile 的真实 prefab/socket 和联合约束，而不止几何体量占位。 |
| 2022-10-14 | next | [1580835075629133825](http://localhost:8769/pipeline.html?evolutionClip=1580835075629133825) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照… |
| 2022-10-14 | next | [1580845127207387137](http://localhost:8769/pipeline.html?evolutionClip=1580845127207387137) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。 |
| 2022-10-14 | next | [1580846877855338497](http://localhost:8769/pipeline.html?evolutionClip=1580846877855338497) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整贴图/体积往返反馈仍缺。 |
| 2022-10-18 | next | [1582293326815862786](http://localhost:8769/pipeline.html?evolutionClip=1582293326815862786) | 高 | 补增量生成与简化导航图互连，而不止独立 WFC 页面验证。 |
| 2022-10-24 | next | [1584623053061099520](http://localhost:8769/pipeline.html?evolutionClip=1584623053061099520) | 高 | 补任意建筑轮廓插入与周边地形重新网格化。 |
| 2022-11-10 | next | [1590674061092212738](http://localhost:8769/pipeline.html?evolutionClip=1590674061092212738) | 中 | 先核现有落点，再围绕以下原记录残差补全：只记学习完成，实现及运行验收待补，不把已有启发式当原法。 |
| 2022-11-17 | next | [1593215065423245313](http://localhost:8769/pipeline.html?evolutionClip=1593215065423245313) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。 |
| 2023-05-05 | next | [1654401054828638214](http://localhost:8769/pipeline.html?evolutionClip=1654401054828638214) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺AO软阴与生成后地形微调，非视觉等价 |
| 2023-06-02 | next | [1664565063552847873](http://localhost:8769/pipeline.html?evolutionClip=1664565063552847873) | 低 | 保留浮点流体试验与平台测试；当前先补作者后续选择的岸线几何方案。 |
| 2023-06-02 | next | [1664566546683899905](http://localhost:8769/pipeline.html?evolutionClip=1664566546683899905) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：真实双网格通过，独立原版buildShoreDistance API未迁移。 |
| 2023-06-07 | next | [1666429884208381953](http://localhost:8769/pipeline.html?evolutionClip=1666429884208381953) | 中 | 先核现有落点，再围绕以下原记录残差补全：蓝线窄湾交叠/泡沫mask仍缺。 |
| 2023-06-15 | next | [1669315384619540487](http://localhost:8769/pipeline.html?evolutionClip=1669315384619540487) | 中 | 先核现有落点，再围绕以下原记录残差补全：原完整生成/倒角一致性未完成。 |
| 2023-06-17 | next | [1670064751181791233](http://localhost:8769/pipeline.html?evolutionClip=1670064751181791233) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺真job线程与四轮节奏还原 |
| 2023-06-19 | next | [1670720537662836736](http://localhost:8769/pipeline.html?evolutionClip=1670720537662836736) | 高 | 补硬边、游戏模块边和材质边的真实三角网语义，不只传入临时 hardEdges。 |
| 2023-06-19 | next | [1670725072540106755](http://localhost:8769/pipeline.html?evolutionClip=1670725072540106755) | 高 | 补无平滑/普通/分级三态真实对照，并让原模块语义进入共同输入。 |
| 2023-06-19 | next | [1670790425232175108](http://localhost:8769/pipeline.html?evolutionClip=1670790425232175108) | 中 | 先核现有落点，再围绕以下原记录残差补全：独立六边地形/原模块仍缺。 |
| 2023-06-22 | next | [1671808851895627776](http://localhost:8769/pipeline.html?evolutionClip=1671808851895627776) | 中 | 先核现有落点，再围绕以下原记录残差补全：原版软坡/侵蚀有效生成与完整接口待补。 |
| 2023-06-22 | next | [1671840905957978113](http://localhost:8769/pipeline.html?evolutionClip=1671840905957978113) | 中 | 先核现有落点，再围绕以下原记录残差补全：缺墙裙残留与悬檐联动 |
| 2023-07-07 | next | [1677242779162877952](http://localhost:8769/pipeline.html?evolutionClip=1677242779162877952) | 高 | 在已实现坏输入拒绝之上补真实局部增删/编辑接口；明确 Delaunay 与几何交叉保证范围。 |
| 2023-08-30 | next | [1696864977171189980](http://localhost:8769/pipeline.html?evolutionClip=1696864977171189980) | 高 | 补 atlas/rim 距离场与完整参数接口，检查大笔触不越过重要边界。 |
| 2023-08-30 | next | [1696896119794479541](http://localhost:8769/pipeline.html?evolutionClip=1696896119794479541) | 中 | 先核现有落点，再围绕以下原记录残差补全：这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。 |
| 2023-09-05 | next | [1699038611125985317](http://localhost:8769/pipeline.html?evolutionClip=1699038611125985317) | 中 | 先核现有落点，再围绕以下原记录残差补全：双网格GPU通过。原作图案密度/配色/反射与阴影一致性仍待补。 |
| 2023-09-05 | next | [1699146321318314094](http://localhost:8769/pipeline.html?evolutionClip=1699146321318314094) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。原作场未知，不宣称完整通用3D逆场和… |
| 2023-09-18 | next | [1703750394164199473](http://localhost:8769/pipeline.html?evolutionClip=1703750394164199473) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 |
| 2023-09-19 | next | [1704218784028905984](http://localhost:8769/pipeline.html?evolutionClip=1704218784028905984) | 低 | 作为旧表面阴影对照，优先补 1705195380457996629 的后续修正分支。 |
| 2023-09-19 | next | [1704246032626762189](http://localhost:8769/pipeline.html?evolutionClip=1704246032626762189) | 中 | 先核现有落点，再围绕以下原记录残差补全：本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 |
| 2023-09-22 | next | [1705195380457996629](http://localhost:8769/pipeline.html?evolutionClip=1705195380457996629) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。 |
| 2023-09-28 | next | [1707490932017279035](http://localhost:8769/pipeline.html?evolutionClip=1707490932017279035) | 中 | 先核现有落点，再围绕以下原记录残差补全：257帧3/3联系表全核；同一套灌木着色器的叠层副本补aBand（证据与测试同600那条）；再次否证整面覆盖档（0050-0070塔顶是极宽带、中心留浅色窄带）；仍缺齿距逐格边峰计数标定 |
| 2023-09-28 | next | [1707497006640365880](http://localhost:8769/pipeline.html?evolutionClip=1707497006640365880) | 中 | 先核现有落点，再围绕以下原记录残差补全：600帧6/6联系表全核；本轮补能力库叠层缺口：SHRUB_LAYER_VERT/FRAG接aBand（与宿主同式子串），叠层像素随aBand变1.09%画幅=8.7×噪声底、dispose对照≤2×；整面覆盖档全片否证→改标本仓扩展；仍缺逐边一一对应标定 |
| 2023-10-02 | next | [1708815475801505819](http://localhost:8769/pipeline.html?evolutionClip=1708815475801505819) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。 |
| 2023-10-05 | next | [1710031224838771027](http://localhost:8769/pipeline.html?evolutionClip=1710031224838771027) | 中 | 先核现有落点，再围绕以下原记录残差补全：其他特征、离散采样和原版完整接口待补。 |
| 2023-10-11 | next | [1712088611934371876](http://localhost:8769/pipeline.html?evolutionClip=1712088611934371876) | 中 | 先核现有落点，再围绕以下原记录残差补全：新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。 |
| 2023-10-18 | next | [1714613599035863191](http://localhost:8769/pipeline.html?evolutionClip=1714613599035863191) | 中 | 先核现有落点，再围绕以下原记录残差补全：不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完… |
| 2023-11-14 | next | [1724449858369568780](http://localhost:8769/pipeline.html?evolutionClip=1724449858369568780) | 中 | 先核对已新增 node-editor.html 与编辑器源码/浏览器回执，核销旧“缺可拖拽编辑器”记录。 |
| 2023-11-22 | next | [1727315611959865407](http://localhost:8769/pipeline.html?evolutionClip=1727315611959865407) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原片方向性轮廓拖抹、速度场与全指标接口仍待补。 |
| 2023-11-22 | next | [1727324352264474664](http://localhost:8769/pipeline.html?evolutionClip=1727324352264474664) | 低 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… |
| 2024-01-29 | next | [1751932427272909032](http://localhost:8769/pipeline.html?evolutionClip=1751932427272909032) | 高 | 补完整 prefab/socket、形变碰撞与周围补网/WFC，复用已有原子放置。 |
| 2024-02-15 | next | [1758250248483278925](http://localhost:8769/pipeline.html?evolutionClip=1758250248483278925) | 中 | 先核现有落点，再围绕以下原记录残差补全：完整反射投影/遮挡仍缺。 |
| 2024-03-05 | next | [1764958522398146667](http://localhost:8769/pipeline.html?evolutionClip=1764958522398146667) | 中 | 先核现有落点，再围绕以下原记录残差补全：9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。 |
| 2024-03-05 | next | [1765041830461055127](http://localhost:8769/pipeline.html?evolutionClip=1765041830461055127) | 中 | 先核现有落点，再围绕以下原记录残差补全：重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。 |
| 2024-03-05 | next | [1765115069837221962](http://localhost:8769/pipeline.html?evolutionClip=1765115069837221962) | 中 | 先核现有落点，再围绕以下原记录残差补全：原3D树/跨叶候选待补。 |
| 2024-03-15 | sphere | [1768627849529893109](http://localhost:8769/pipeline.html?evolutionClip=1768627849529893109) | 高 | 补后续世界到球面的 World/模块接线和平滑岸线；不要用已有柱群球面代替。 |
| 2024-03-18 | sphere | [1769641473895432220](http://localhost:8769/pipeline.html?evolutionClip=1769641473895432220) | 高 | 补多格模块的联合形状拟合与误差约束。 |
| 2024-03-18 | sphere | [1769691526924292506](http://localhost:8769/pipeline.html?evolutionClip=1769691526924292506) | 高 | 补球面河道约束坍缩及剩余区域 BFS 生成，保留已有平面汇水实现。 |
| 2024-04-19 | sphere | [1781405550061687016](http://localhost:8769/pipeline.html?evolutionClip=1781405550061687016) | 高 | 补投射 UV、手工 UV 和 atlas 的接缝混合接口；顶点色平均不作为替代。 |
| 2024-04-26 | sphere | [1783792917183606829](http://localhost:8769/pipeline.html?evolutionClip=1783792917183606829) | 中 | 先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法 |
| 2024-05-29 | sphere | [1795831296952041691](http://localhost:8769/pipeline.html?evolutionClip=1795831296952041691) | 高 | 补球面与复杂汇流的导航费用接口，保留未知流向的中性处理。 |
| 2024-06-05 | next | [1798310423554658732](http://localhost:8769/pipeline.html?evolutionClip=1798310423554658732) | 高 | 将 field-plots 的地块共用主轴/人字耕纹接回 terrainmesh 的真实着色。 |
| 2024-10-24 | next | [1849427564034498642](http://localhost:8769/pipeline.html?evolutionClip=1849427564034498642) | 中 | 先核现有落点，再围绕以下原记录残差补全：原球面卡片/多俯仰仍缺。 |
| 2024-10-25 | next | [1849730611964973481](http://localhost:8769/pipeline.html?evolutionClip=1849730611964973481) | 中 | 先核现有落点，再围绕以下原记录残差补全：泡沫mask/窄湾交叠仍缺。 |
| 2024-10-25 | next | [1849732997945110651](http://localhost:8769/pipeline.html?evolutionClip=1849732997945110651) | 高 | 补全局岩石/泡沫遮罩、窄湾折叠消解与浪带全路径防穿岸。 |
| 2024-11-01 | next | [1852334860137849222](http://localhost:8769/pipeline.html?evolutionClip=1852334860137849222) | 中 | 先核现有落点，再围绕以下原记录残差补全：共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。 |
| 2025-02-13 | next | [1890018647655272491](http://localhost:8769/pipeline.html?evolutionClip=1890018647655272491) | 低 | 先核现有落点，再围绕以下原记录残差补全：全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 |
| 2025-03-05 | next | [1897266928961700215](http://localhost:8769/pipeline.html?evolutionClip=1897266928961700215) | 低 | 先核现有落点，再围绕以下原记录残差补全：全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 |
| 2025-11-19 | next | [1991099314714902634](http://localhost:8769/pipeline.html?evolutionClip=1991099314714902634) | 高 | 与 1991101097818403263 合并实施浪形/遮罩/碰撞，不新写另一套岸浪。 |
| 2025-11-19 | next | [1991101097818403263](http://localhost:8769/pipeline.html?evolutionClip=1991101097818403263) | 高 | 保留已有入/出方向与周期数据，补浪形约束、窄湾碰撞和完整海岸遮罩。 |

## 全部来源覆盖

| 发布时间 | 登记日期 | 阶段 | 帖子 | 状态 | 本地映射 |
|---|---|---|---|---|---|
| 2016-08-25 | 2016-08-25 | early | 768886648625061889 | ref | 不涉及实现 |
| 2016-09-18 | 2016-09-18 | early | 777501038274281472 | ref | 不涉及实现 |
| 2016-09-18 | 2016-09-18 | early | 777596437534240768 | ref | 不涉及实现 |
| 2016-09-28 | 2016-09-28 | early | 781027725452648448 | ref | 不涉及实现 |
| 2016-09-30 | 2016-09-30 | other | 781957658597269506 | partial | src/terrain/generate.js、src/core/ladder-profile.js、src/world/navlayer.js |
| 2016-10-08 | 2016-10-08 | early | 784847588893814785 | partial | src/sphere/planet.js |
| 2016-10-08 | 2016-10-08 | early | 784847933686575104 | partial | src/sphere/planet.js |
| 2016-10-08 | 2016-10-08 | early | 784848286272327680 | partial | src/sphere/planet.js |
| 2016-10-15 | 2016-10-15 | other | 787319655648100352 | partial | src/core/wfc.js、src/build/buildings.js |
| 2016-11-01 | 2016-11-01 | badnorth | 793545297376972801 | done | src/build/multitile-wfc.js、src/build/multitile-iso.js |
| 2016-11-01 | 2016-11-01 | badnorth | 793557992931266561 | partial | src/world/worldmesh.js、src/light/bake.js |
| 2016-11-02 | 2016-11-02 | badnorth | 793806535898136576 | done | src/core/wfc.js |
| 2016-11-05 | 2016-11-05 | early | 794993371261665280 | partial | src/world/voxel-ghost.js |
| 2016-11-05 | 2016-11-05 | badnorth | 795010582239997952 | done | src/core/adjacency.js |
| 2016-11-11 | 2016-11-11 | badnorth | 797119718477991936 | partial | src/world/layerednav.js、src/world/battle-navigation.js、src/badnorth/battle.js |
| 2016-11-13 | 2016-11-13 | early | 797844857821732864 | partial | src/world/voxel-ghost.js |
| 2016-11-15 | 2016-11-15 | badnorth | 798580832906739712 | partial | src/core/space-visibility.js、src/world/space-visibility.js |
| 2016-11-26 | 2016-11-26 | early | 802496920790777856 | partial | src/core/arch-profile.js、src/build/buildings.js |
| 2016-11-28 | 2016-11-28 | early | 803190517534248960 | ref | 不涉及实现 |
| 2016-12-08 | 2016-12-08 | early | 806856212260278272 | ref | 不涉及实现 |
| 2016-12-08 | 2016-12-08 | early | 806904557502464000 | partial | src/core/arch-profile.js、src/build/buildings.js |
| 2016-12-09 | 2016-12-09 | early | 807135253215199233 | ref | 不涉及实现 |
| 2016-12-09 | 2016-12-09 | badnorth | 807256278154301441 | partial | src/core/hip-roof.js、src/build/buildings.js |
| 2016-12-17 | 2016-12-17 | badnorth | 810157485638189056 | partial | src/core/route-preview.js |
| 2016-12-19 | 2016-12-19 | badnorth | 810878197134950401 | done | src/core/nav-visibility.js、src/world/visibility.js |
| 2016-12-31 | 2016-12-31 | badnorth | 815236105079398400 | partial | src/core/terrace-profile.js |
| 2017-01-03 | 2017-01-03 | badnorth | 816332161036984320 | partial | src/core/trajectory-fan.js |
| 2017-01-04 | 2017-01-04 | badnorth | 816743289500106752 | partial | src/badnorth/battle.js |
| 2017-01-04 | 2017-01-04 | badnorth | 816748103193817088 | partial | src/world/navmesh-flow.js |
| 2017-01-06 | 2017-01-06 | badnorth | 817323301357948928 | ref | 不涉及实现 |
| 2017-01-10 | 2018-06-20 | other | 818857408848130048 | done | src/core/field-surface.js |
| 2017-01-16 | 2017-01-16 | badnorth | 820977247083528192 | partial | src/core/unit-shadow.js |
| 2017-01-17 | 2017-01-17 | badnorth | 821321422140309504 | partial | src/badnorth/battle.js |
| 2017-01-18 | 2017-01-18 | badnorth | 821680056514781186 | partial | src/badnorth/battle.js |
| 2017-01-24 | 2017-01-24 | badnorth | 823848950553780226 | partial | artifacts/coverage/path-samples-review.md |
| 2017-02-02 | 2017-02-02 | badnorth | 827215002448846848 | partial | src/core/unit-tier.js |
| 2017-02-02 | 2017-02-02 | badnorth | 827216768783495168 | partial | src/core/banner.js、src/badnorth/battle.js |
| 2017-02-03 | 2018-06-15 | badnorth | 827561690896162816 | ref | 不涉及实现（机制已在 src/badnorth/*） |
| 2017-02-07 | 2017-02-07 | badnorth | 828984794407170048 | partial | src/core/unit-ground-height.js、src/badnorth/battle.js |
| 2017-02-17 | 2018-06-22 | other | 832633189277409280 | partial | src/core/field-surface.js |
| 2017-03-01 | 2018-06-18 | badnorth | 837027901853810688 | partial | src/life/fire-coupling.js、src/life/smoke.js、src/badnorth/battle.js |
| 2017-03-07 | 2017-03-07 | badnorth | 839067977781768193 | done | src/badnorth/squad-hud.js |
| 2017-03-31 | 2017-03-31 | badnorth | 847717312912211970 | ref | 不涉及实现（角色外观分件本仓无对应模块） |
| 2017-05-12 | 2017-05-12 | badnorth | 863019585162932224 | done | src/core/coroutine.js |
| 2017-05-18 | 2017-05-18 | other | 865200072685912064 | partial | src/core/wfc.js |
| 2017-06-01 | 2017-06-01 | badnorth | 870296307889573889 | ref | src/badnorth/battle.js |
| 2017-06-02 | 2017-06-02 | badnorth | 870558914345041921 | na | 未关联代码 |
| 2017-06-22 | 2017-06-22 | badnorth | 877995885250138119 | na | 未关联代码 |
| 2017-06-30 | 2017-06-30 | badnorth | 880853661936734211 | partial | src/world/traffic.js、src/badnorth/battle.js |
| 2017-07-07 | 2017-07-07 | badnorth | 883447205176238083 | partial | src/badnorth/squad-footprint.js |
| 2017-07-15 | 2017-07-15 | badnorth | 886199305522085890 | partial | src/world/traffic.js、src/badnorth/battle.js |
| 2017-07-27 | 2017-07-27 | badnorth | 890611046435627008 | partial | src/core/house-door-presence.js、src/badnorth/battle.js |
| 2017-08-26 | 2017-08-26 | badnorth | 901469409579061248 | partial | src/life/boats.js、src/core/wake-sampling.js |
| 2017-08-27 | 2017-08-27 | badnorth | 901842167508992000 | partial | src/world/view.js、src/badnorth/flowfield.js、src/badnorth/battle.js |
| 2017-08-28 | 2017-08-28 | badnorth | 902069261304287232 | partial | src/badnorth/battle.js |
| 2017-08-28 | 2017-08-28 | badnorth | 902103473365417984 | partial | src/core/distance-isolines.js |
| 2017-09-01 | 2017-09-01 | badnorth | 903647529203634176 | partial | src/badnorth/damage-numbers.js、src/badnorth/battle.js |
| 2017-09-08 | 2017-09-08 | badnorth | 906207980802252801 | partial | src/life/atmosphere.js、src/core/fog-envelope.js |
| 2017-09-09 | 2017-09-09 | badnorth | 906416813810049025 | partial | artifacts/coverage/cloud-depth-review.md |
| 2017-09-09 | 2017-09-09 | badnorth | 906425294533394432 | partial | src/world/layerednav.js、src/world/battle-navigation.js、src/badnorth/battle.js |
| 2017-09-24 | 2017-09-24 | badnorth | 911913981731885056 | done | src/world/island-snapshot.js |
| 2017-09-26 | 2017-09-26 | badnorth | 912691357440978945 | partial | src/badnorth/battle-c01.js、src/badnorth/battle.js |
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
| 2017-12-29 | 2017-12-29 | badnorth | 946660607008403456 | partial | src/badnorth/battle.js、src/core/platform-anchor.js |
| 2018-01-30 | 2018-01-30 | badnorth | 958371606350454784 | partial | src/core/part-random.js |
| 2018-01-30 | 2018-01-30 | badnorth | 958410200146497537 | done | src/core/banner.js、src/life/banner.js、src/badnorth/battle.js |
| 2018-02-02 | 2018-02-02 | badnorth | 959530111187013632 | partial | src/core/level-flora.js、src/life/vegetation.js |
| 2018-02-03 | 2018-02-03 | badnorth | 959752525867036672 | partial | src/core/vertex-dual.js、src/world/vertex-dual-overlay.js |
| 2018-03-03 | 2018-03-03 | badnorth | 969860566322958336 | done | src/core/sprite-ambiguity.js、src/life/unit-sprites.js、src/badnorth/battle.js |
| 2018-03-11 | 2018-03-11 | badnorth | 972829402873716737 | done | src/badnorth/flowfield.js、src/badnorth/battle.js |
| 2018-03-15 | 2018-03-15 | badnorth | 974325184525201409 | partial | src/core/obb.js、src/badnorth/landing-plan.js、src/badnorth/battle.js |
| 2018-03-16 | 2018-03-16 | badnorth | 974564862729838592 | partial | src/core/spatial.js、src/core/infinite.js |
| 2018-03-16 | 2018-03-16 | badnorth | 974579499802202113 | partial | src/core/spatial.js、src/core/infinite.js |
| 2018-03-26 | 2018-03-26 | badnorth | 978194866520944641 | na | 未关联代码 |
| 2018-03-26 | 2018-03-26 | badnorth | 978195201901711360 | na | 未关联代码 |
| 2018-03-26 | 2018-03-26 | badnorth | 978211952504852480 | done | src/world/island-snapshot.js |
| 2018-04-13 | 2018-04-13 | badnorth | 984703192465330176 | na | 未关联代码 |
| 2018-04-13 | 2018-04-13 | badnorth | 984813819280191488 | partial | src/badnorth/battle.js、src/core/combat-state.js |
| 2018-04-20 | 2018-04-20 | badnorth | 987267068495003648 | partial | src/core/ballistic-table.js、src/badnorth/battle.js |
| 2018-05-11 | 2018-05-11 | badnorth | 995034777756536833 | partial | src/badnorth/battle.js |
| 2018-05-11 | 2018-05-11 | badnorth | 995043346778415104 | partial | src/core/route-preview.js |
| 2018-05-23 | 2018-05-23 | badnorth | 999185422403055616 | partial | src/badnorth/battle.js |
| 2018-05-23 | 2018-05-23 | badnorth | 999191760944418817 | done | src/badnorth/battle.js |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587812462530561 | done | src/water/waterfall.js |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587817021636609 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587821220229120 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587825024425984 | na | 未关联代码 |
| 2018-06-15 | 2018-06-15 | badnorth | 1007587828992266240 | partial | src/badnorth/battle.js、src/life/effects.js、src/life/banner.js |
| 2018-06-24 | 2018-06-24 | badnorth | 1010979395719319552 | partial | src/core/part-random.js |
| 2018-07-06 | 2018-07-06 | badnorth | 1015140880666300416 | done | src/life/smoke.js、src/core/smoke-order.js |
| 2018-07-06 | 2018-07-06 | badnorth | 1015142746372366336 | partial | src/life/smoke.js、src/core/smoke-order.js |
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
| 2019-02-05 | 2019-02-05 | badnorth | 1092709665199345664 | partial | src/life/effects.js、src/life/smoke.js、src/life/banner.js |
| 2019-02-18 | 2019-02-18 | badnorth | 1097458505315946496 | partial | src/core/frontier.js |
| 2019-03-10 | 2019-03-10 | badnorth | 1104771432440049664 | done | src/core/ornament-field.js、src/ui/ornament.js |
| 2019-03-11 | 2019-03-11 | badnorth | 1105131621391495176 | done | src/core/ornament-field.js、src/ui/ornament.js |
| 2019-04-21 | 2019-04-21 | townscaper | 1120036868966502401 | partial | src/core/quad-lattice.js、src/world/view.js、src/core/region-boundary.js、src/world/contour-overlay.js |
| 2019-07-07 | 2019-07-07 | townscaper | 1147881669350891521 | done | src/core/grid.js |
| 2019-07-16 | 2019-07-16 | townscaper | 1151137783785771008 | partial | src/core/infinite.js |
| 2019-07-16 | 2019-07-16 | townscaper | 1151152046055272449 | na | 未关联代码 |
| 2019-07-18 | 2019-07-18 | townscaper | 1151770831619534848 | done | src/core/infinite.js |
| 2019-08-20 | 2019-08-20 | townscaper | 1163836000688365571 | partial | src/core/contour.js |
| 2019-08-23 | 2019-08-23 | townscaper | 1164926304640229376 | done | src/core/wfc.js |
| 2019-09-01 | 2019-09-01 | townscaper | 1168168400155267072 | done | src/light/bake.js |
| 2019-09-02 | 2019-09-02 | townscaper | 1168571866405097472 | partial | src/world/worldmesh.js、src/light/bake.js |
| 2019-09-18 | 2019-09-18 | townscaper | 1174406613031170049 | na | 未关联代码 |
| 2019-09-24 | 2019-09-24 | townscaper | 1176516621223043073 | done | src/build/buildings.js |
| 2019-09-30 | 2019-09-30 | townscaper | 1178731576982724611 | partial | src/build/buildings.js |
| 2019-10-08 | 2019-10-08 | townscaper | 1181464374839521280 | partial | src/core/building-components.js、src/build/buildings.js |
| 2019-10-29 | 2019-10-29 | townscaper | 1189109278361165825 | ref | src/build/buildings.js |
| 2019-10-31 | 2019-10-31 | townscaper | 1189902695303458816 | partial | src/build/buildings.js |
| 2019-10-31 | 2019-10-31 | townscaper | 1189908238566903808 | done | src/build/buildings.js、src/core/arch-profile.js |
| 2019-11-01 | 2019-11-01 | townscaper | 1190191289922465793 | done | src/world/view.js |
| 2019-11-06 | 2019-11-06 | townscaper | 1191990107785572352 | partial | src/life/vegetation.js、src/core/anchored-billboard.js |
| 2019-11-15 | 2019-11-15 | townscaper | 1195463004919357443 | na | 未关联代码 |
| 2019-11-22 | 2019-11-22 | townscaper | 1197909675443916803 | partial | src/build/buildings.js、src/light/bake.js |
| 2019-11-25 | 2019-11-25 | townscaper | 1198957499027795969 | partial | src/world/save.js |
| 2019-11-29 | 2019-11-29 | townscaper | 1200520827898343425 | partial | src/core/palette.js |
| 2019-12-01 | 2019-12-01 | townscaper | 1201179450668441600 | partial | src/ui/icon-toolbar.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205416648397721601 | partial | src/core/opening-footprint.js、src/build/buildings.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205420678859632640 | partial | src/core/leaf-atlas.js、src/life/leaf-surface.js |
| 2019-12-13 | 2019-12-13 | townscaper | 1205422438437273601 | partial | src/render/opening-punch.js |
| 2019-12-24 | 2019-12-24 | townscaper | 1209519206233968641 | na | 未关联代码 |
| 2019-12-28 | 2019-12-28 | townscaper | 1210969316071477248 | na | 未关联代码 |
| 2020-01-02 | 2020-01-02 | townscaper | 1212732478458343424 | done | src/life/decor.js |
| 2020-01-10 | 2020-01-10 | townscaper | 1215642481162887168 | partial | src/water/shore.js、src/core/shore-loops.js、src/world/townDemo.js |
| 2020-01-10 | 2020-01-10 | townscaper | 1215644531221311488 | partial | src/water/reflection.js、src/world/view.js |
| 2020-03-10 | 2020-03-10 | townscaper | 1237293295887319040 | done | src/core/palette.js、src/world/app.js |
| 2020-03-10 | 2020-03-10 | townscaper | 1237305125070426112 | done | src/light/bake.js、src/world/worldmesh.js |
| 2020-03-13 | 2020-03-13 | townscaper | 1238474550511308800 | partial | src/core/courtyards.js、src/build/buildings.js |
| 2020-03-17 | 2020-03-17 | townscaper | 1239901715266244609 | na | 未关联代码 |
| 2020-03-20 | 2020-03-20 | townscaper | 1241046107125399552 | partial | src/core/leaf-atlas.js、src/life/leaf-surface.js |
| 2020-03-20 | 2020-03-20 | townscaper | 1241096929490149376 | partial | src/core/texel-skip.js |
| 2020-03-25 | 2020-03-25 | townscaper | 1242824460325052417 | partial | src/core/playful-layout.js |
| 2020-03-26 | 2020-03-26 | townscaper | 1243228419162341379 | partial | src/life/vegetation.js、src/life/impostor.js、src/light/cloud-shadow.js |
| 2020-03-31 | 2020-03-31 | townscaper | 1244892370392489989 | done | src/life/birds.js |
| 2020-04-03 | 2020-04-03 | townscaper | 1246074663546916873 | partial | src/life/effects.js |
| 2020-05-04 | 2020-05-04 | townscaper | 1257213678056857600 | partial | src/build/buildings.js |
| 2020-05-06 | 2020-05-06 | townscaper | 1258005604066627586 | ref | 未关联代码 |
| 2020-05-07 | 2020-05-07 | townscaper | 1258421104756097029 | partial | src/life/effects.js |
| 2020-05-11 | 2020-05-11 | townscaper | 1259838941299183619 | done | src/core/wire-route.js、src/life/decor.js |
| 2020-05-13 | 2020-05-13 | townscaper | 1260586697538113537 | partial | src/core/snapshot-replay.js、src/world/app.js |
| 2020-06-10 | 2020-06-10 | townscaper | 1270725616430530566 | done | src/life/decor.js、src/world/view.js |
| 2020-06-18 | 2020-06-18 | townscaper | 1273520600221433857 | done | src/life/decor.js、src/world/view.js |
| 2020-06-22 | 2020-06-22 | townscaper | 1275089608758484992 | partial | src/render/opening-punch.js、src/core/ladder-profile.js |
| 2020-06-29 | 2020-06-29 | townscaper | 1277554535297236994 | ref | 未关联代码 |
| 2020-07-03 | 2020-07-03 | townscaper | 1279107097108635649 | partial | src/build/buildings.js、src/ui/environment-panel.js |
| 2020-08-05 | 2020-08-05 | townscaper | 1290997501332525056 | partial | src/core/garden-paths.js、src/build/buildings.js |
| 2020-08-26 | 2020-08-26 | townscaper | 1298689301488775169 | done | src/world/ao-mesh-debug.js、src/world/view.js |
| 2020-09-04 | 2020-09-04 | townscaper | 1301816247479345152 | partial | src/core/radial-patch.js |
| 2020-09-06 | 2020-09-06 | townscaper | 1302686201401442309 | partial | src/core/infinite.js |
| 2020-09-15 | 2020-09-15 | townscaper | 1305948413872267265 | done | src/world/view.js |
| 2020-09-15 | 2020-09-15 | townscaper | 1305951750638231552 | partial | src/core/penumbra.js、src/light/penumbra.js、src/world/penumbra-layer.js、src/world/view.js |
| 2020-09-28 | 2020-09-28 | townscaper | 1310503825510367232 | partial | src/core/mixed-perspective.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313837640366596096 | partial | src/core/loop-lift.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313840428685447170 | done | src/core/penumbra.js、src/light/penumbra.js、src/world/penumbra-layer.js、src/world/view.js |
| 2020-10-07 | 2020-10-07 | townscaper | 1313841094069817344 | done | src/world/view.js、src/ui/environment-panel.js |
| 2020-11-26 | 2020-11-26 | townscaper | 1331905048801144836 | done | src/build/lighthouse.js |
| 2020-11-27 | 2020-11-27 | townscaper | 1332410042784641026 | done | src/core/infinite.js |
| 2020-12-15 | 2020-12-15 | townscaper | 1338825080844021760 | partial | src/sphere/planet.js |
| 2020-12-15 | 2020-12-15 | townscaper | 1338829205157646336 | partial | src/sphere/planet.js |
| 2020-12-30 | 2020-12-30 | townscaper | 1344290848180203523 | partial | src/core/qa-replay.js |
| 2021-03-13 | 2021-03-13 | townscaper | 1370772056279805953 | na | 未关联代码 |
| 2021-03-14 | 2021-03-14 | townscaper | 1371191380773629956 | na | 未关联代码 |
| 2021-03-15 | 2021-03-15 | townscaper | 1371460793032716290 | partial | src/core/palette.js、src/world/app.js |
| 2021-04-21 | 2021-04-21 | townscaper | 1384958097542819845 | partial | src/core/grid.js |
| 2021-06-05 | 2021-06-05 | townscaper | 1401145625572425728 | partial | src/world/worldmesh.js、src/tools/mesh-audit.js |
| 2021-07-01 | 2021-07-01 | townscaper | 1410697531424714752 | na | 未关联代码 |
| 2021-08-17 | 2021-08-17 | townscaper | 1427721874490933250 | partial | src/terrain/blotch-pattern.js |
| 2021-08-24 | 2021-08-24 | townscaper | 1430224300003545091 | partial | src/tools/objexport.js |
| 2021-08-24 | 2021-08-24 | townscaper | 1430227487376781317 | partial | src/core/palette.js、src/build/buildings.js |
| 2021-10-11 | 2021-10-11 | next | 1447483550257799171 | partial | src/terrain/generate.js、src/core/contour.js |
| 2021-10-11 | 2021-10-11 | next | 1447488323845509121 | partial | src/terrain/generate.js |
| 2021-10-11 | 2021-10-11 | next | 1447494168448753667 | partial | src/core/grid.js |
| 2021-10-11 | 2021-10-11 | next | 1447496205282549761 | partial | src/core/grid.js、src/terrain/generate.js |
| 2021-10-12 | 2021-10-12 | next | 1448039167057879048 | partial | src/core/stroke-reveal.js、src/ui/walkthrough.js |
| 2021-11-11 | 2021-11-11 | next | 1458921394855718917 | partial | src/core/grid.js、src/core/adjacency.js |
| 2021-11-12 | 2021-11-12 | next | 1459169210752507904 | partial | src/core/grid-wireframe.js |
| 2021-12-01 | 2021-12-01 | next | 1466059785703460870 | na | 未关联代码 |
| 2021-12-17 | 2021-12-17 | next | 1471817524148940807 | partial | src/core/corner-footprint.js |
| 2022-01-03 | 2022-01-03 | next | 1478114309263839244 | partial | textures.html?t=radial（保留圆块近似；UV流程待补） |
| 2022-01-10 | 2022-01-10 | next | 1480635131614355459 | done | src/terrain/blotch-pattern.js、src/world/view.js |
| 2022-01-13 | 2022-01-13 | next | 1481661852887265288 | partial | src/core/voxel-distance.js、src/light/lightvolume.js |
| 2022-01-14 | 2022-01-14 | next | 1482011744843223042 | partial | src/core/normal-contrast.js |
| 2022-01-15 | 2022-01-15 | next | 1482346496460828674 | partial | src/core/contrast-field.js |
| 2022-02-03 | 2022-02-03 | next | 1489193847422865410 | na | 未关联代码 |
| 2022-02-05 | 2022-02-05 | next | 1490068909042642944 | partial | src/core/graph-layout.js |
| 2022-10-10 | 2022-10-10 | next | 1579474420749725696 | partial | src/terrain/generate.js |
| 2022-10-10 | 2022-10-10 | next | 1579478470098243584 | partial | src/terrain/shape.js、src/terrain/terrainmesh.js |
| 2022-10-10 | 2022-10-10 | next | 1579483114178768898 | partial | src/build/multicell.js、src/world/scenes.js |
| 2022-10-12 | 2022-10-12 | next | 1580158269267406849 | done | src/core/canopy.js、src/life/vegetation.js |
| 2022-10-12 | 2022-10-12 | next | 1580162341668237312 | done | src/core/canopy.js、src/life/vegetation.js、src/life/impostor.js |
| 2022-10-14 | 2022-10-14 | next | 1580835075629133825 | partial | src/core/voxel-distance.js、src/light/lightvolume.js |
| 2022-10-14 | 2022-10-14 | next | 1580845127207387137 | partial | src/light/lightvolume.js、src/world/view.js |
| 2022-10-14 | 2022-10-14 | next | 1580846877855338497 | partial | src/light/lightvolume.js、src/world/view.js |
| 2022-10-18 | 2022-10-18 | next | 1582293326815862786 | partial | src/core/frontier-candidates.js |
| 2022-10-19 | 2022-10-19 | next | 1582757294672314368 | done | src/core/voxel-ray.js、src/light/lightvolume.js、src/world/view.js |
| 2022-10-24 | 2022-10-24 | next | 1584623053061099520 | partial | src/build/multicell.js、src/world/scenes.js |
| 2022-11-10 | 2022-11-10 | next | 1590669875869286400 | done | src/life/vegetation.js、src/core/anchored-billboard.js |
| 2022-11-10 | 2022-11-10 | next | 1590674061092212738 | partial | src/life/vegetation.js |
| 2022-11-17 | 2022-11-17 | next | 1593215065423245313 | partial | src/life/impostor.js |
| 2023-05-05 | 2023-05-05 | next | 1654401054828638214 | partial | src/terrain/pipeline-stages.js |
| 2023-06-02 | 2023-06-02 | next | 1664565063552847873 | partial | src/world/float-probe.js |
| 2023-06-02 | 2023-06-02 | next | 1664566546683899905 | partial | src/water/shore.js、src/core/shore-profile.js |
| 2023-06-07 | 2023-06-07 | next | 1666429884208381953 | partial | src/water/shore.js、src/core/shore-loops.js、src/world/townDemo.js |
| 2023-06-15 | 2023-06-15 | next | 1669315384619540487 | partial | src/terrain/generate.js、src/core/terrace-edges.js |
| 2023-06-17 | 2023-06-17 | next | 1670064751181791233 | partial | src/terrain/pipeline-stages.js |
| 2023-06-19 | 2023-06-19 | next | 1670720537662836736 | partial | src/terrain/shape.js |
| 2023-06-19 | 2023-06-19 | next | 1670725072540106755 | partial | src/terrain/shape.js |
| 2023-06-19 | 2023-06-19 | next | 1670790425232175108 | partial | src/core/grid.js |
| 2023-06-19 | 2023-06-19 | next | 1670794261669769217 | done | src/terrain/features.js、src/core/module-audit.js |
| 2023-06-22 | 2023-06-22 | next | 1671808851895627776 | partial | src/core/rock-topology.js |
| 2023-06-22 | 2023-06-22 | next | 1671840905957978113 | partial | src/core/terrain-burial.js |
| 2023-07-07 | 2023-07-07 | next | 1677242779162877952 | partial | src/core/trigraph.js |
| 2023-08-30 | 2023-08-30 | next | 1696864977171189980 | partial | src/terrain/blotch-pattern.js、src/world/view.js |
| 2023-08-30 | 2023-08-30 | next | 1696896119794479541 | partial | src/terrain/terrainmesh.js |
| 2023-09-05 | 2023-09-05 | next | 1699038611125985317 | partial | src/core/sediment.js、src/terrain/terrainmesh.js、src/world/view.js |
| 2023-09-05 | 2023-09-05 | next | 1699146321318314094 | partial | src/core/sediment.js、src/terrain/terrainmesh.js、src/world/view.js |
| 2023-09-18 | 2023-09-18 | next | 1703750394164199473 | partial | src/terrain/blotch-pattern.js、src/world/view.js |
| 2023-09-19 | 2023-09-19 | next | 1704218784028905984 | partial | src/light/surface-shadow.js、src/world/view.js |
| 2023-09-19 | 2023-09-19 | next | 1704246032626762189 | partial | src/terrain/blotch-pattern.js、src/world/view.js |
| 2023-09-22 | 2023-09-22 | next | 1705195380457996629 | partial | src/light/surface-shadow.js、src/world/view.js |
| 2023-09-28 | 2023-09-28 | next | 1707490274425884929 | done | src/core/edge-inset.js、src/life/vegetation.js |
| 2023-09-28 | 2023-09-28 | next | 1707490932017279035 | partial | src/terrain/shrub-texture.js、src/terrain/shrub-band.js、src/world/worldmesh.js、src/terrain/terrainmesh.js |
| 2023-09-28 | 2023-09-28 | next | 1707497006640365880 | partial | src/terrain/shrub-texture.js、src/capabilities/layers.js、src/terrain/shrub-band.js、src/world/worldmesh.js、src/terrain/terrainmesh.js |
| 2023-10-02 | 2023-10-02 | next | 1708815475801505819 | partial | src/terrain/features.js、src/core/deformation-guard.js |
| 2023-10-05 | 2023-10-05 | next | 1710031224838771027 | partial | src/core/color-volume.js、src/world/view.js |
| 2023-10-11 | 2023-10-11 | next | 1712088611934371876 | partial | src/core/palette-patch.js、src/world/view.js |
| 2023-10-18 | 2023-10-18 | next | 1714613599035863191 | partial | src/terrain/field-pattern.js |
| 2023-11-14 | 2023-11-14 | next | 1724449858369568780 | partial | src/core/node-graph-runtime.js |
| 2023-11-22 | 2023-11-22 | next | 1727315611959865407 | partial | src/core/camera-motion.js、src/world/view.js |
| 2023-11-22 | 2023-11-22 | next | 1727324352264474664 | partial | src/core/camera-motion.js、src/world/view.js |
| 2024-01-29 | 2024-01-29 | next | 1751932427272909032 | partial | src/core/module-patch.js、src/build/module-volume.js |
| 2024-01-29 | 2024-01-29 | next | 1751945034851570056 | done | src/world/outline.js |
| 2024-02-15 | 2024-02-15 | next | 1758250248483278925 | partial | src/water/reflection.js、src/world/view.js |
| 2024-02-15 | 2024-02-15 | next | 1758251637280268481 | done | src/water/watervol.js、src/water/land-distance.js |
| 2024-03-05 | 2024-03-05 | next | 1764958522398146667 | partial | src/core/atlas.js |
| 2024-03-05 | 2024-03-05 | next | 1765041830461055127 | partial | src/core/atlas.js |
| 2024-03-05 | 2024-03-05 | next | 1765115069837221962 | partial | src/core/atlas.js |
| 2024-03-15 | 2024-03-15 | sphere | 1768627849529893109 | partial | src/sphere/planet.js |
| 2024-03-18 | 2024-03-18 | sphere | 1769641473895432220 | partial | src/sphere/planet.js |
| 2024-03-18 | 2024-03-18 | sphere | 1769691526924292506 | partial | src/terrain/generate.js |
| 2024-04-19 | 2024-04-19 | sphere | 1781405550061687016 | partial | src/terrain/terrainmesh.js |
| 2024-04-26 | 2024-04-26 | sphere | 1783792917183606829 | partial | planet.html（现有网格；纹理流程待补） |
| 2024-05-02 | 2024-05-02 | next | 1786014232594485497 | done | src/core/mountain-bake.js |
| 2024-05-16 | 2024-05-16 | sphere | 1791049306213912823 | done | src/core/cube-height.js、src/light/cube-height.js |
| 2024-05-29 | 2024-05-29 | sphere | 1795831296952041691 | partial | src/world/navgraph.js |
| 2024-06-05 | 2024-06-05 | next | 1798310423554658732 | partial | src/core/field-plots.js |
| 2024-10-24 | 2024-10-24 | next | 1849427564034498642 | partial | src/life/impostor.js |
| 2024-10-25 | 2024-10-25 | next | 1849730611964973481 | partial | src/water/shore.js、src/core/wave-cycle.js |
| 2024-10-25 | 2024-10-25 | next | 1849732997945110651 | partial | src/water/shore.js、src/core/shore-profile.js |
| 2024-11-01 | 2024-11-01 | next | 1852334860137849222 | partial | src/life/impostor.js |
| 2025-02-13 | 2025-02-13 | next | 1890018647655272491 | partial | src/core/doodle-layout.js、src/build/doodle-wall.js、src/world/doodle-overlay.js |
| 2025-03-05 | 2025-03-05 | next | 1897266928961700215 | partial | src/core/doodle-layout.js、src/build/doodle-wall.js、src/world/doodle-overlay.js |
| 2025-11-19 | 2025-11-19 | next | 1991099314714902634 | partial | src/water/shore.js、src/core/wave-cycle.js、src/world/view.js |
| 2025-11-19 | 2025-11-19 | next | 1991101097818403263 | partial | src/water/shore.js、src/core/wave-cycle.js |
| 2025-11-19 | 2025-11-19 | next | 1991103578011029507 | done | src/water/shore.js、src/core/wave-cycle.js、src/world/view.js |
| 2025-12-02 | 2025-12-02 | other | 1995813566344011807 | na | 未关联代码 |

## 保持边界

- 三项有文字依据的局部替代：专用反差图、受控表面阴影、火焰缩放错误修正；不自动删除历史方法或任何用户场景。
- 2022 技术组合与2024球面展示有原文；next 正式游戏名未确认，2016早期球面另列。
- 已有节点编辑器、轨迹碰撞等旧缺口先对账，不重复开发。
- 每项批注绑定原 status/where/note；记录变化显示待复核。关系绑定其作者文字/审核笔记，变化失效。
- 代码扫描输出 module.evolution 与组合来源；没有关联的模块不编造发布日期。作者发展时间、代码存在、Worker适配与本场景验收分别记录。
- 原目录290代码的10个辅助文件缺落点与其他行为差距不因本次整理被核销。
