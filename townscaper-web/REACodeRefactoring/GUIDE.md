## 2026-11-07T14:46:08.010295+08:00 · 8小时窗口到期暂停

本轮8小时窗口已结束，应用工具已确认暂停本automation。新增4段1114帧全核（171→175/285），剩110，按8小时为0.5段/小时；3段有局部代码验收、1段3D拼装仅学习。旧片续作迁入六类墙饰、近云投影、河网重建、通口前视、台地格边与木梯等，但完整覆盖尚未完成。 交接见 learn/accelerated-handoff.md。

## 2026-11-07T14:38:05.146503+08:00 · 跨层木梯锚点迁移

跨层梯长策略接真实共享导航几何：梯脚/台沿来自当前笼形变，按3D锚点长度画双梁与等距踏棍，可切回旧台阶。1000逻辑例及双网格84/96把实际木梯、有限坐标/World和导航不变/关闭恢复通过。旧109帧不重计，175/285；原薄悬平台、端点体积接触和攀爬动作仍缺。

## 2026-11-07T14:33:50.127285+08:00 · 台地共格边遍迁移

原版新增islandpasses局部迁入：台地层界/顶面线框/格边岸界共用真实World多边形端点和当前笼形变，双网格616/488层界段、2005/1454线框段、166/117岸界段，逐点投影/只读/编辑刷新通过。复用649帧不重计，175/285；完整环追踪/最终倒角一致性仍缺，木梯模块尚未迁移。

## 2026-11-07T14:07:27.718077+08:00 · 新增131帧与空间射线

新增空间射线64帧和3D模块拼装67帧全核，共131帧，累计175/285，剩110。固定步长3D开阔度迁到实际共享World，双网格室内/屋顶开阔度0.097/0.611、0.119/0.584，开关/缓存/World不变通过。3D拼装仅学习；六类局部墙饰成果保留，四重点仍有完整性缺口；原版并行新增2模块待映射。

## 2026-11-07T12:35:25.758246+08:00 · 六类墙饰实际接入

六类墙饰接实际建筑墙段：空/普通窗/长窗/门/装饰拱门/百叶，复用共享WFC并独立检查角色与邻窗规则；按墙宽用1–3槽，百叶只在相邻窗实际画出后绘制。双网格168/167墙段零求解失败，实绘217/300件，World不变与关闭恢复通过。旧505帧不重计，173/285；跨格整立面、真实拱洞及完整原接口仍缺。

## 2026-11-07T12:04:36.564233+08:00 · 填洼后河网重建

河网重建局部接入：迁移原版汇水累计策略，改用Priority-Flood出口树处理洼地；重新开槽并替换真实World河标记，平床导航读有效下游。双网格3种子共6组河格106/313/333和99/267/298，出口连通/单调/恢复通过。旧片不重计，173/285；完整球面坍缩/BFS缓坡、湖水和洞穴联合重建仍缺。

## 2026-11-07T11:38:00.134017+08:00 · 近云投影实际接入

近云投影接入共享World主材质及首页环境开关：复用真实云图集/实例锚点/时钟，沿阳光方向投影到不同高度的建筑与地形。双网格GPU开关恢复、自然31云团、隐藏停止通过。复用489帧不重计，173/285；固定轮廓近似，远云影/模糊/水与植被接收仍缺。

## 2026-11-07T11:22:21.245101+08:00 · 通口前视与群体前进

导航/群体运动补差：同层路线增加通口前视瞄点，保留身体半径与逐段碰撞；避让位移撞墙时退回合法前进步。双网格实际24单位6秒均推进，最少推进4.22/4.77；穿洞/封洞/分层战斗和三场回归通过。复用479帧不重计，完整连续三角面/坡高与群体流场仍缺。

## 2026-11-07T11:11:48.369123+08:00 · 生成验收与新片核验

新增导航流动479帧全核，仅学习，累计173/285，剩112。填洼补失效河段清理，双网格3种子共6组真实生成的出口链/幂等通过；连续导航面内流动、群体运动及河道重建仍缺。

## 2026-11-07T10:31:35.081939+08:00 · 直线进场走廊预留

实际发船由仅终点盒扩展为整条直线进场扫掠盒预留：终点分开但航线交叉也拒绝。双网格各6次实际发船、15对进场盒无交，交叉/平行走廊逻辑通过。旧504帧不重计，172/285；地形岸礁碰撞、动态避让与原完整规划仍缺。

## 2026-11-07T10:01:54.728580+08:00 · 船泊位盒测试接入

已学盒测试接入真实北境发船：共享3D SAT预留终点泊位，重复随机选中拥挤点时改查其他岸点；无泊位不生成船/兵或增加波次。双网格连续6次实际发船，各15对终点盒无相交，逻辑占用/释放测试通过。视频数172/285不变；完整进场走廊/陆地碰撞和原袭击规划仍缺。

## 2026-11-07T09:31:20.360253+08:00 · 拱底楼板预算

piercefloor楼板预算接入共享建筑拱底，保留旧默认曲线；实际楼板保留厚度0.05/0.20可切换，1000组预算和双网格拱顶限制、World不变及几何恢复通过。已学292帧不重复计数，172/285；原整层立面/过梁/挑檐与碰撞仍缺。

## 2026-11-07T09:02:29.205392+08:00 · 填洼迁入共享地形

原版新增depfill迁入共享多边形地形：Priority-Flood填洼接真实岩石体素及生成器可选参数。封闭洼地逻辑/全部出口树路径通过，双网格实际抬高29/25格，重复填充零改动、恢复快照通过。复用已学656帧不重计，172/285；连续微坡/湖水/侵蚀与河道重算仍缺。

## 2026-11-07T08:31:23.033233+08:00 · 二维墙面约束

已学门窗片继续迁移，视频数不变172/285。独立装饰从竖列扩展为真实墙面两列×楼层的二维约束：同类非空窗不并排、长窗上方留空、门行保留；共享WFC与原几何碰撞继续复用。840墙段逻辑例及实际双网格168/167段零失败、World不变、关闭恢复通过。跨格整墙/百叶/拱门仍缺。

## 2026-11-07T08:01:40.555082+08:00 · 独立装饰接入

已学门窗片续作，不增加视频数（172/285，剩113）。独立装饰约束层接入实际建筑：复用共享WFC，按可见竖墙段求解空/单窗/双窗/长窗，长窗上方留空，保留原门和几何碰撞检查；480逻辑例与双网格168/167墙段零失败、开关恢复通过。原六类二维整墙/百叶/拱门仍缺。

## 2026-11-07T07:34:57.673732+08:00 · 恢复迁移补差

继续迁移补差：新增盒相交504帧全核，累计172/285，剩113。3D SAT核心补接触/epsilon策略与坏输入拒绝，1000对称性及边界用例通过；实际规划消费者未接，不计运行验收。优先队列转独立墙面装饰WFC实际接入。

# GUIDE — 接手指南（写给继续这条路的 LLM / 开发者）

这个目录是 `../REACode` 的**重构版**。`../REACode` 保持原样，作对照用；所有新工作都在这里做。
先读完这一页，再打开 `index.html` 和 `architecture.html` 看一遍，再动代码。

## 最新接续状态 · 2026-11-06

到期交接：本次8小时授权窗口已结束，automation已由应用工具确认暂停，其他任务保持暂停。会话新增23段逐帧核验（148→171），累计171/285，剩114；按8小时窗口为2.875段/小时。完整代码覆盖尚未完成，157模块中81部分、42静态确认仍待验收。 交接见 `learn/accelerated-handoff.md`。

最近迁移：新增重心坐标815+478帧，共1293帧全核，累计171/285，剩114。预计算接真实无限网格块/簇混合缓存，修原点引用与退化传播；10264顶点与旧结果误差≤5.03e-15，24模式和实际页面通过。原3D演示/完整接口仍缺。 入口 `grids.html?t=infinite`，证据 `artifacts/coverage/bary-prep-review.md`。

最近迁移：新增水渠/穿楼拱洞123+292帧，共415帧全核，累计169/285，剩116。保留既有拱形，改实际共享建筑为有界弦误差的角分段；60组逻辑与双网格8/16段切换、体素不变及几何恢复通过。楔石/桥面/完整拱构仍缺。 入口 `arches.html`，证据 `artifacts/coverage/arch-profile-review.md`。

最近修复：新增门窗/楼梯505帧与钢架296帧，共801帧全核，累计167/285，剩118。修真实共享建筑悬空/断层共用-1装饰身份，双网格2→1→2组及几何恢复通过；既有钢架保留。独立装饰/钢架WFC仍缺，钢架片仅学习。 入口 `building-components.html`，证据 `artifacts/coverage/building-components-review.md`。

最近修复：新增弹道678帧全核，累计165/285，剩120。旧精灵308帧复核不重计。保留游戏无阻力参数，提共享查表/可调落角权重，修真实高差被0.1量化导致的箭终点误差；1717例与双网格实际发射、分层碰撞回归通过。原表达式/drag/Validity仍缺。 入口 `ballistics.html`，证据 `artifacts/coverage/ballistic-table-review.md`。

最近迁移：新增五阶段AO6帧、分层占用551帧，共557帧全核，累计164/285，剩121。保留既有分层烘焙，补实际遮蔽/反弹分离及关闭恢复对照，双网格坐标/World不变、颜色恢复通过；原SSAO/方向AO与GPU重投影仍缺。 入口 `ao-stages.html`，证据 `artifacts/coverage/ao-stages-review.md`。

最近学习：本轮新增洞穴725帧、多格建筑102帧，共827帧全核，仅学习，累计162/285，剩123。旧阴云不重计，三组差速已接真实远云并通过双网格GPU/开关/连续与遮挡验收；云影、原洞穴关卡和3D模块联合约束仍缺。157模块均有落点，77部分尚待补齐。 证据 `artifacts/coverage/multitile-ao-review.md` / `artifacts/coverage/cloud-depth-review.md`。

最近迁移：新增洞穴725帧全核，仅学习，累计161/285，剩124；旧阴云489帧不重计。迁移可选三组差速到实际远云，双网格GPU角速度/关闭恢复/连续运动及遮挡通过。157模块均有职责落点，但77部分仍有缺口，云影/原洞穴关卡待实现。 入口 `clouds.html`，证据 `artifacts/coverage/cloud-depth-review.md`。

最近迁移：本轮新增塔楼344帧、三队旗徽23帧，共367帧全核，累计160/285，剩125。共享建筑可选四檐顶与实际Bezier旗面三徽记局部迁移通过；默认功能保留。原复杂屋顶、金饰盾、竖旗与完整群体寻路仍缺。 入口 `hip-roofs.html` / `squad-banners.html`，证据 `artifacts/coverage/squad-banners-review.md`。

最近迁移：新增塔楼/群体寻路344帧全核，累计159/285，剩126。迁移矩形四檐顶策略至共享建筑独立四边房屋，双网格实际几何切换/体素不变/关闭恢复通过；默认保留旧屋顶。完整多格屋顶和原群体寻路仍缺。 入口 `hip-roofs.html`，证据 `artifacts/coverage/hip-roof-review.md`。

最近迁移：新增尘粒AO227帧全核，累计158/285，剩127；尘粒AO仅学习。独立将原版弧长采样策略接入真实Battle命令点，双网格间距/穿洞/封洞及三场回归通过；原走廊带和尘粒AO仍缺。 证据 `artifacts/coverage/path-samples-review.md`。

最近修复：新增生日战斗666帧全核，累计157/285，剩128。保留逐人楼层导航，修房屋燃烧/守卫只看XZ导致跨层干涉；实际双网格门层2/6，异层敌人不加燃烧、异层守军不阻挡、同层判定保留。原火焰/奖励/完整动画仍缺。 证据 `artifacts/coverage/house-door-review.md`。

最近迁移：新增WFC/SLOTS908帧全核，累计156/285，剩129。纠正旧“无文字6帧静态”描述，实际有候选收缩/红色冲突/重置。复用共享WFC新增有界不可变候选快照和25格27步回看；默认解/局部修复/四分子格及浏览器通过。原图块/依赖链动画和完整建筑接入仍缺。 证据 `artifacts/coverage/wfc-trace-review.md`。

最近修复：新增坡地战斗387帧全核，累计155/285，剩130。复用已有逐人分层导航，修脚高缓动的帧率依赖；真实Battle双网格4/6层30/60/120Hz均与解析结果一致，三场回归通过。原火球/坡面脚高/动作仍缺；890片仅解码待看，不计完成。 证据 `artifacts/coverage/unit-ground-review.md`。

最近修复：新增三块簇/对偶532帧，累计154/285，剩131。保留已有无限网格，修接缝审核无论模式都查blend、只查前两owner的问题，绘制改读各块表示；24逻辑与4实际模式通过，只簇真实接缝可见、blend接近零。原性能/流式生成仍缺。 证据 `artifacts/coverage/infinite-verify-review.md`。

最近迁移：新增早期台地185帧、黄色薄平台109帧，共294帧全核，累计153/285，剩132。保留已有地形量化，将Workbuddy分类诊断改接真实World：同高连片/顶面积/逻辑阶差；双网格只读、修改检测及恢复通过。黄色片仅学习，原量化算法/实际坡面及悬垂仍未证明。 证据 `artifacts/coverage/terrace-profile-review.md`。

最近修复：新增道具/门窗261帧全核，累计151/285，剩134。保留已有正矩形门窗，修共享建筑放置仅计框宽、遗漏1.6倍窗台导致越角的问题；2000旋转墙界例与三主场GPU回归通过。原片是完整建屋编辑，非原注释6帧空格变面；完整家具贪心系统仍缺。 证据 `artifacts/coverage/opening-footprint-review.md`。

最近迁移：新增Square yet hex岩岛556帧，累计150/285，剩135。保留已有网格，迁移Workbuddy切角为共享格只读绘制轮廓，1328例几何及49格Canvas交互通过；原片不能证明切角算法，World/导航/完整岩岛生成仍未接入。既有316帧中心锚点成果保留，shrubcard按实际差距部分映射，不重复计数。 证据 `artifacts/coverage/corner-cuts-review.md`。

最近迁移：新增959530植被203帧全核，累计149/285，剩136。原版称6帧且日期2017有误，实际2018-02-02、109帧切紫色雨景。复用每层色组策略接共享World地被，两网格4682/3712草实例落点不变、GPU26129/26603像素改变、关闭恢复；完整物种/生态/雨景仍缺。 入口 `level-flora.html`；证据 `artifacts/coverage/level-flora-review.md`。

最近学习：新增复仇战斗763帧、单位等级524帧，共1287帧全核验，累计148/285，剩137。纠正navribbon素材误归因；新增独立于生命/兵种的可选头盔与盾牌色阶，双网格24单位GPU改变123/308像素，伤势/导航/体型不变。原雕饰盾/旗徽/盔形与升级玩法仍缺，战斗片仅学习。 证据 `artifacts/coverage/unit-tiers-review.md`；新8小时任务见 `learn/accelerated-session.json`。

最近学习：新增动画/软盘25帧、早期战斗315帧，共340帧全核验，累计146/285，剩139。纠正820素材“无文字软影教程”误读，新增可选单位接触软盘、凸格裁剪及真实导航楼层接入；实际北境双网格24单位GPU开关/过滤/停止通过。blobshadow由未覆盖转部分覆盖，navribbon仍未覆盖；坡面/跨格连续性、原参数及动画仍缺。 入口 `unit-shadows.html`；证据 `artifacts/coverage/unit-shadow-review.md`。

最近学习：新增拓扑直线679帧、早期四边网1068帧，共1747帧全核验，累计144/285，剩141。保留已有网格主体，补按格/出边状态判环、真实对边线段和边界/三角/预算原因；1254走法与实际Canvas点击通过。四边网片本轮只学习/主体复核；游戏手柄/连刷、飞岛支撑和完整生成动画仍缺。 入口 `grids.html?t=lines`；证据 `artifacts/coverage/topoline-quad-review.md`。

静态清单新增：原版并行增加 `src/blobshadow.js` 与 `src/navribbon.js`，现146模块，二者保持未覆盖并进入学习队列；现有地表遮影/导航线不能冒充单位软盘/弧长走廊。当轮5段素材未逐帧，后续学习以最新接续状态为准。

最近学习：新增不规则底图383帧、三角/方形模块库178帧，共561帧全核验，累计142/285，剩143。保留已有网格/WFC，新增四边形沿对角线切四三角的派生共享网格和父子映射，实际WFC混合147→354/四边206→824格、pins/修复/候选通过。四子格联合模块约束、原3D曲面tile和完整岛生成仍缺，底图成果片本轮仅学习。 入口 `wfc.html?subtiles=1`；证据 `artifacts/coverage/tri-subtiles-review.md`。

最近学习：新增球面投影316帧、散点到松弛395帧，共711帧全核验，累计140/285，剩145。修三角化/松弛按钮显示同一最终坐标，补独立阶段快照及只读球面拓扑报告，平面60面抽样单列；18次闭合球逻辑与900点实际GPU阶段坐标通过。原投影往返/动态重三角化/完整阶段动画及游戏融合仍待补。 入口 `planet.html?stage=tri`；证据 `artifacts/coverage/sphere-stages-review.md`。

最近学习：新增通用三角图279帧、Half Edge 511帧，共790帧全核验，累计138/285，剩147。共享TriGraph补确定性抽样/显式全查、退化/孤立点检查与坏输入原子拒绝；450次增量全查及实际200点浏览器通过，球面消费者回归通过。原版局部翻边编辑接口、Half Edge显式环/扇仍缺，后者本轮仅学习。 入口 `trigraph.html`；证据 `artifacts/coverage/trigraph-halfedge-review.md`。

最近学习：再学纯网格对照610帧、多岛成果649帧，共1259帧全核验，累计136/285，剩149。本次用户请求合计新增4段1985帧。修旧“纯方格”仍有残留三角，新增共享cell契约的正交方格，保留合并菱形/混合旧算法；12组几何与真实Canvas/WorldMesh通过。纯六边地形、完整坡面/模块联合生成及原作美术仍待补，成果片本批仅学习审核。 入口 `grids.html?t=kinds`；证据 `artifacts/coverage/grid-kinds-review.md`。

最近学习：新增笼形变272帧、岛屿生成454帧，共726帧全核验，累计134/285，剩151。纠正原片“全白线框”旧说明，保留切面/Taubin/面积保护，修shape.at分数层未定义并接入沉积线；9540次连续采样与双网格实际GPU通过。完整原笼/扭曲壁面碰撞、坡面/模块联合生成仍待补，后一段本批仅学习审核。 入口 `cage.html`；证据 `artifacts/coverage/cage-review.md`。

最近学习：新增平滑对照164帧、边层级102帧，共266帧全核验，累计132/285，剩153。保留已有切面/Taubin/防塌陷，补显式hardEdges/全层钉点与实景开关，双网格位移误差<3e-7、移除恢复约0.12，既有薄檐保护回归通过。崖顶/脚等级不等于原模块/材质边，完整三模式/3D语义本批仍待补。 入口 `hierarchy.html`；证据 `artifacts/coverage/hierarchy-review.md`。

最近学习：新增球面化229帧、防蘑菇化479帧，共708帧全核验，累计130/285，剩155。保留分层角点弹簧，补显式模块格选择/未触及角点隔离及逐格面积/边误差诊断，120/240点逻辑与900点GPU通过。发现旧平均指标掩盖局部误差：多格最差边误差48%→53.5%，完整模块拟合仍待补；球面原视觉/World接入本批仅学习审核。 入口 `planet.html`；证据 `artifacts/coverage/sphere-relax-review.md`。

最近学习：新增河网194帧、沿河导航598帧，共792帧全核验，累计128/285，剩157。修复河口距离把上坡判为顺流，保留平床方向与既有河道费用；双网格真实河边、战斗导航及分层流场通过。河网仍是DFS开挖/局部削岸，完整球面河道约束坍缩＋其余BFS缓坡待实现，本批仅学习审核。 入口 `river-nav.html`；证据 `artifacts/coverage/river-nav-review.md`。

最近学习：新增球面Texture test242帧、Mountain textures234帧，共476帧全核验，累计126/285，剩159。共享World几何补顶点法线明度属性与岩壁底色/烘焙/实时法线对照，5000方向逻辑及双网格GPU通过；原主场景模式保持默认。山体具体烘焙算法仅本地假设，原纹理atlas仍缺；球面海陆3D纹理/岸缘混合本批仅学习待实现。 入口 `mountain-bake.html`；证据 `artifacts/coverage/mountain-texture-review.md`。

最近学习：新增径向排序346帧、法线反差384帧，共730帧全核验，累计124/285，剩161。纠正圆盘/矩形排序冒充UV图块、反差迭代冒充更早法线map细线的旧说明。共享地形材质补可关闭的解析法线场细线，双网格GPU开关/阈值/宽度与240/480像素覆盖通过；UV图块流程本批仅学习，仍待实现，原笔触normal atlas/接缝与完整后处理也缺。 入口 `normal-contrast.html`；证据 `artifacts/coverage/normal-radial-review.md`。

最近学习：新增树impostor334帧、蓬松云235帧，共569帧全核验，累计122/285，剩163。保留本地八水平视图，修复旋转/父组锚点及正交相机误选图；双网格GPU锚点误差低于1e-6、正交选图差0、64步周界连续。背景云共享时钟/遮挡与三场回归通过；原球面octagonal卡片、多俯仰采样、原云形/层次仍缺。 入口 `impostors.html`；证据 `artifacts/coverage/impostor-view-review.md`。

最近学习：新增候选/树查询296帧、运行时精灵图集164帧，共460帧全核验，累计120/285，剩165。共享Atlas补跨叶候选/key释放，9000次候选增删通过；ImpostorBaker补整组预留、真实GPU释放和满板/异常回滚，存活UV与像素不变，三主场树云32槽通过。原3D树、自动扩容/重排、原素材及完整兼容接口仍缺。 入口 `grids.html?t=atlas` / `atlas-live.html`；证据 `artifacts/coverage/atlas-candidates-review.md`。

最近学习：新增矩形树添加247帧、移除/碎片化558帧，共805帧全核验，累计118/285，剩167。修复过期句柄重复释放清掉新槽的漏洞，补尺寸校验、显式栈搜索/统计与真实遍历拖动对照；24,000次增删和6,000层树通过。三主场景共享树/云图集32槽通过；删除只合并空兄弟，跨叶放置/原3D树视图与完整接口仍缺。 入口 `grids.html?t=atlas`；证据 `artifacts/coverage/atlas-review.md`。

最近学习：新增早期头像88帧、游戏头像100帧，共188帧全核验，累计116/285，剩169。修复声明镜像分支的随机起点，增加显式种子和按固定槽派生身份，重绘/切页/手机换列可复现，旗帜共用生成器回归通过。2000流状态/2000槽种子及真实Canvas验证通过；原素材、SLOTS/spec/剪影IoU和游戏角色接口仍待补。 入口 `ui.html?t=face`；证据 `artifacts/coverage/portraits-review.md`。

最近学习：新增UI flair100帧、图标306帧，共406帧全核验，累计114/285，剩171。抽出可复用图标工具条：单选状态、方向键跳过禁用项、跨页保持与销毁通过；纹饰补可拖动标题/外纹两轨时序及透明文字退出交互，保持同一GPU纹理。既有菜单/纹饰GPU回归通过；仍缺原徽章/逐部件时序、原图稿和游戏命令。 入口 `ui.html?t=icons` / `ornament.html`；证据 `artifacts/coverage/icons-flair-review.md`。

最近学习：新增斜按钮383帧、确认弹出370帧，共753帧全核验，累计112/285，剩173。纠正原片确认菜单为横排；新增键/种子确定的视觉扰动与AABB间距约束、稳定按钮命中槽，补键盘/延时清理/快速切队，修复手机裁切。12000逻辑用例和真实UI交互通过。仍是本地UI实验，单Move目标确认、完整游戏指令/原美术待接。 入口 `ui.html?t=menu` / `ui.html?t=pop`；证据 `artifacts/coverage/ui-interaction-review.md`。

最近学习：新增阴云489帧、冬季全景306帧，共795帧全核验，累计110/285，剩175。远云修复固定时钟、连续环带漂移及盖住建筑的问题，首页新增独立阴云开关；双网格GPU轨迹/周期/遮挡与三场通过。冬季第210帧是战斗景观突切，完整雪景/船群/血烟组合仍仅学习、待实现验收；原片高耸云体/层次也未复现。 入口 `clouds.html`；首页“远景阴云”与近云独立。证据 `artifacts/coverage/clouds-winter-review.md`。

最近学习：新增风矢量516帧、受风雪花318帧，共834帧全核验，累计108/285，剩177。保留已有分层风场，修复雪片用柱顶填实洞口：共享World实际层碰撞、重生避开实心、非法dt拒绝。双网格通洞/封洞/即时重开与风向反转通过，首页三场风雪可见。仍是端点体素碰撞和简单白点，原作风接口/旗形轨迹、雪片接触AO/完整冬景待补。 静态扫描另补原版新增squigglefield/uikit到已有纹饰/UI实验，列部分覆盖，不增加视频计数。入口 `flow.html` 的共享风场雪片/洞口近景；首页继续用“风与天气”开关。证据 `artifacts/coverage/wind-snow-review.md`。

最近学习：新增船迹138帧、背景雾326帧，共464帧全核验，累计106/285，剩179。船迹补固定时间采样和相位余量，实际双网格30/60/120Hz一致；雾盘外缘渐隐，首页可调浓度/相对流速，GPU边界/关闭/冻结通过。仍是带状尾迹与圆盘雾，原片泡沫喷溅和风场软片/体积遮挡未复现。 入口 `wake-fog.html`；首页“雾参数”直接控制共享场景。证据 `artifacts/coverage/wake-fog-review.md`。

最近学习：新增早期草地333帧、锚点灌木316帧，共649帧全核验，累计104/285，剩181。纠正“草地片已长树”的旧说法，高层grass plots仍待实现；新增可选中心固定草卡片，实际共享shader四视角GPU读回中心漂移0，默认旧模式保留。局部GPU验收1段，另一段高层地块待实现，不计原作完整灌木/生命周期完成。 入口 `billboard-anchor.html`；证据 `artifacts/coverage/anchored-plots-review.md`。

最近学习：新增道具动画306帧、封闭庭院202帧，共508帧全核验，累计102/285，剩183。庭院按实际墙层识别开口，修复高处桥体误封闭，双网格开口/重封闭及小径回归通过。道具片仅学习与审核完成：已有柱顶缩放/灰尘不等于独立道具生命周期，已明确部分覆盖及待验收，未虚计代码完成。 入口 `garden.html`；证据 `artifacts/coverage/courtyard-props-review.md`。

最近学习：新增OBJ导出288帧、撤销录像167帧，共455帧全核验，累计100/285，剩185。主体OBJ改精确坐标与合法可选法线、坏属性拒绝，实际下载拓扑一致；回放修复历史截断偏移和编辑污染，新增取消/异常保岛。双网格通过，第三方DCC/完整材质与动作特效录制仍缺。 首页“更多能力实验”可回放/停止和导出主体，证据 `artifacts/coverage/obj-replay-review.md`。

最近学习：新增分享串321帧、网格合并349帧，共670帧全核验，累计98/285，剩187。本地v5修复坏输入解码破坏当前岛、游程越界/尾随数据、空列元数据和北境场景身份；双网格真实分享重载通过。既有合并主体编辑前后GPU均1次提交，不代表全场景或Switch三倍性能；完整配色/玩法存档仍待补。 入口 `save-mesh.html`；证据 `artifacts/coverage/save-mesh-review.md`。

最近学习：新增建筑QA814帧、饱和度/建筑/草地/彩色反弹说明456帧，共1270帧全核验，累计96/285，剩189。纠正QA片被简化为极端模块配色的旧解释；新增共享World的16步编辑压力回放、几何属性/索引诊断和异常恢复，双网格局部验收通过；完整原作QA及彩色反弹参数仍有差距。 入口 `qa-replay.html`，记录 `artifacts/coverage/qa-palette-review.md`；与首页环境入口改进分开记账。

首页能力入口补齐：首页新增默认展开的风与天气实景控制：八项环境开关、风向重算、昼夜与北境环境配色；实验能力独立入口，完整管线保留。没有新增视频计数，仍94/285，剩191。 说明与验收见 `artifacts/coverage/environment-panel-review.md`。雨天目前仅北境配色；雪为粒子与表面着色，不能记为完整天气模拟。

本目录当前服务已核验为 `http://localhost:8769`；`/__rea_identity__` 返回本目录绝对路径。`start.sh` 默认端口仍为8766，会复用本目录已运行的端口；明确指定可用 `./start.sh --port 8769 --open`。不要把端口相同当作目录身份相同。

原版并行新增archvoid/storydatum已静态映射到已有拱底/全局层高立面；楔石/净空和任意塔基对齐接口待补，对应2016视频未逐帧，不计学习。

当前映射范围为原版src/engine的 **144个JS模块**：本轮迁移/增强33、静态确认合并/迁移50、部分覆盖61、未覆盖0。本轮静态扫描发现新增src/housekit.js，映射到既有房屋/北境小屋，原比例约束/完整接口与对应视频尚待核验，不新增学习计数。静态确认代表保留已有代码改进，不等于每段视频都重新逐帧、运行验收。新增 `src/combatfx.js`经静态对照映射到已有Battle/分层流场，保留既有成果，440帧复核后补船上血斑即时局部锚点，现记部分覆盖；`src/tileforce.js`已补显式模板种子、已有拓扑搜索、整体2D刚体复核、有限样本诊断及共享World体量放置/撤回，现记部分覆盖；`src/smokefx.js`已有烟火主体并完成六段2197帧复核，现记部分覆盖；本次重新扫描补录此前未登记的src/campaignmap.js与src/gridpatch.js：前者与现有战役管线静态对应；后者经324帧纠正为四边格/放射手工模板，已补共享边界单个放射补丁，列部分覆盖；patch.html局部模块种子保留，不冒充完整规则模板库。其余部分覆盖缺口继续推进。

权威进度在 `learn/coverage-progress.json`，模块映射在 `learn/coverage.json` / `MODULE-MAP.md`。首页左下角和pipeline页顶部读取同一份进度；`PIPELINE.md`由 `tools/gen-pipeline-md.mjs` 同时读取管线、映射和共享进度生成。后续更新这些源数据，避免只改页面标题或把旧记录复制成已完成。

本轮已对原版新增src/mirrordecor.js、src/overhangterrain.js完成对应视频核验与映射，分别列增强/部分覆盖；未改动原版文件，薄檐/软坡等差距继续保留。

本轮新增：新增轨道拖抹337帧、城镇调色200帧，共537帧全核验，累计94/285，剩191。历史留存按dt换算，真实30/60/120Hz通过；墙色新增本地HSL短弧过渡滑杆，双网格中点/端点/还原通过，World与位置不变。原片轮廓拖抹、PNG/完整接口与持久化仍待补。138模块28增强/68静态/42部分。 证据 artifacts/coverage/palette-transition-review.md。

| 已验证成果 | 入口 / 主要证据 | 保留的缺口 |
|---|---|---|
| 分层战斗、洞内穿行、攻击遮挡、分层流场、水平半径扫掠 | navigation.html；artifacts/coverage/battle-navigation-review.md | 形变侧壁、连续斜坡脚高、精细模块portal、复杂拥挤 |
| 协程预算/取消/异常，60000层显式嵌套 | scheduler.html；coroutine-review.md | 合作式不可抢占；仅同步finally取消清理 |
| socket WFC、确定性、局部扩区修复与失败回滚 | wfc.html；wfc-review.md、wfc-repair-review.md | 完整建筑预制库和多格联合求解 |
| 几何边界候选与共享半边审核 | adjacency.html；adjacency-review.md | 平行等长候选不保证完整实体装配 |
| 实际融合双格房屋、整体替换/移除和本页撤销 | multicell.html；multicell-edit-review.md | 工程JSON已保存双格身份；统一撤销栈/通用模块身份待补 |
| 等值线跨边缓存/闭环与双线性鞍点 | contour.html；contour-review.md | 语义平面诊断不等于形变泡沫岸线 |
| 分层导航近似视线 | visibility.html；visibility-review.md | 角度漏检/角点保守停止，不是光学或攻击资格 |
| 可选单方向精灵及锚点/alpha翻转指标 | sprites.html；sprites-review.md | 原作美术、完整动作与精灵阴影（UV血斑/摆动已补） |
| 墙饰生成器及共享World贴面 | doodle.html；doodle-review.md | 完整走廊、弧顶/门口版式、纹样复杂度与贴面光照 |
| 烟火机制保留、UV/mip及生命周期GPU量化 | smoke.html、fire.html；fire-review.md | 火焰quad/noise轮廓与动态火光，透明相交仍近似 |
| 闭合球并集树冠、三角形接缝松弛及共享烘焙输入 | index.html?scene=terrain；canopy-review.md | 原作MC/美术、低分辨率歧义及全局自交证明 |
| 共享World占用/支撑/梯度量化，实际洞内风场修复 | flow.html；world-probes-review.md | 梯度法线写回网格与硬边约束、形变后精确碰撞 |

表中简写的证据文件均在 `artifacts/coverage/`。本轮续审火焰两段531帧，累计烟火六段2197帧；保留Max/二次收缩，修复实际寿命年龄、出生尺寸、到期残点及火源清空。GPU对照与三场景回归通过；火焰quad/noise轮廓与动态火光仍列部分覆盖。上一批223帧对应931196707236392960：画面展示圆润/体素显示切换；碰撞、风等用途由README原文说明。本轮实际修复Atmosphere从柱顶推断占用导致洞内被填实的问题，现按每层solid位采样。两种网格通洞/封洞、支撑和风速量化及三个主场景回归通过。不得把占用梯度诊断写成已经替换了现有网格软法线。



---

## 一、规矩（必须遵守）

1. **先读原文，再看画面，最后写代码。** 素材在 `../../REA-agent/gifs/`：每段 mp4 的原文说明在同目录 `README.md` 里，按帖子 ID 对应。不要去 x.com 抓（有验证码，别绕）。原文和画面对上了才算学会。
2. **不改 `../REACode`，不碰 `.workbuddy/`。** 那里还有别的会话在写。要用里面的东西，复制过来。
3. **只有一张网格、一份体素。** 新功能不许自己再存一份格子数据。地形写 `rock` 位，建筑写非 rock 的 `solid` 位，其余数据（颜色、河流）挂在 `World` 上。
4. **依赖方向固定：** `core` ← `terrain / build / light / water / life` ← `world` ← `ui`。同一层之间不互相 import。
   另外：**格子不一定是四边形。** 用 `c.n`（角数）和 `(i + 1) % c.n`，不要写死 4；"对边"只有方格有（`oppositeEdge()`，三角格返回 -1）。两种网格都要截图。
5. **颜色：** `new THREE.Color('#hex')` 在 three r160 里已经是线性值，**不要**再 `convertSRGBToLinear()`（旧版"画面只有 37% 亮"就是这么来的）。
6. **每处实现都写上帖子 ID 和原文关键句**（注释里），在 `CHANGELOG.md` 记一行，并同步更新 `learn/data.js` 里那条的 `status / where / learned`，以及 `learn/pipeline.js` 对应步骤。改完 `pipeline.js` 跑一次 `node tools/gen-pipeline-md.mjs` 重新生成 `PIPELINE.md`。
7. **每次改完都截图验收**（见「五、验收」），三个场景都要看。

## 二、目录

```
REACodeRefactoring/
├── index.html              主场景：三个场景切换 + 右侧学习面板（系统全局 / 管线开关 / 去看 / 原视频）
├── architecture.html       系统全局：数据流图、模块卡片、新旧对照、未迁移清单（数据来自 learn/architecture.js）
├── pipeline.html           判断 + 学习路线 + 四条管线（数据来自 learn/pipeline.js）
├── learn.html              已登记视频的学习笔记（完整素材清单另见refactoring-audit.html）（数据来自 learn/data.js，缩略图 learn/thumbs/）
├── README.md               怎么打开、怎么操作
├── ARCHITECTURE.md         模块职责、依赖、约定
├── GUIDE.md                本文件
├── PIPELINE.md             管线与路线文字版（生成的，别手改）
├── CHANGELOG.md            每一轮学了什么、改了什么（新一轮写在最上面）
├── start.sh                启动本地服务（端口 8766），--open / --stop / --port
├── 启动.command / 停止.command   macOS 双击用
├── tools/
│   └── gen-pipeline-md.mjs 由 pipeline.js 生成 PIPELINE.md
├── vendor/three.module.js  three r160（import map 指向它）
├── gifs -> ../../REA-agent/gifs   start.sh 自动建的链接（原视频）
├── learn/
│   ├── data.js             window.LEARN：每段视频 {id, text, project, topic, status, learned, where}
│   ├── pipeline.js         window.PIPELINE：verdict / lanes / roadmap / statusName
│   ├── architecture.js     window.ARCH：flow / layers / notPorted
│   └── thumbs/             每段视频一帧缩略图（<id>.jpg）
└── src/
    ├── core/               不依赖任何其他目录
    │   ├── grid.js         buildQuadGrid()（四边形）/ buildMixedGrid()（三角 + 方格）；格子是任意多边形
    │   ├── world.js        World + MAX_LEVEL：体素场（solid / rock / color / river）
    │   ├── spatial.js      pointInQuad / decorateCells / buildCellIndex
    │   ├── meshwriter.js   MeshWriter（共享顶点池、软法线、描边方向）、edgeOut、UP / DOWN
    │   ├── palette.js      PALETTES（墙色方案）、BUILD（建筑固定色）、TERRAIN（地形色）
    │   ├── noise.js        valueNoise / fbm / ridged / makeRng / hash01 / clamp / mix / smoothstep
    │   └── atlas.js        Atlas：二叉树矩形打包（impostor 图集）
    │   ├── trigraph.js     TriGraph：增量 Delaunay + 流形检查
    │   ├── infinite.js     buildInfinite()：无限网格（块 + 簇松弛 + 重心插值）
    ├── terrain/
    │   ├── generate.js     generateTerrain()、carveRivers()
    │   ├── shape.js        shapeTerrain()：层级平滑 + 笼形变形 → at(p, 切面)
    │   ├── features.js     addFeatures()：悬垂、石拱、海中石柱；forceChurch()：先压平再放教堂
    │   └── terrainmesh.js  buildTerrain({ shape })：崖壁、起伏沉积线、台地顶、亮边、洞顶
    ├── build/
    │   └── buildings.js    buildBuildings()：码头、墙、门窗、钢架 / 拱、后院、屋顶
    ├── light/
    │   └── bake.js         bakeLighting()：分层 AO + 彩色反弹
    ├── water/
    │   ├── shore.js        buildShore()、makeSkirtMaterial()、makeWaveMaterial()
    │   └── waterfall.js    Waterfalls：河落崖的水帘 + 白沫
    ├── world/

    │   ├── worldmesh.js    WorldMesh：地形 + 建筑 → 烘焙 → 一个几何体
    │   ├── scenes.js       SCENES、buildScene()、generateFusion()
    │   ├── navgraph.js     buildNav()：简化导航图（区域节点）、河上顺流更快、楼梯候选、最短路树
    │   ├── navlayer.js     NavLayer：楼梯几何 + 导航图调试线
    │   ├── townDemo.js     generateTown()
    │   ├── view.js         View：渲染、海面、倒影、时段、调试开关、拾取
    │   ├── outline.js      OutlineLayers：墨线 + 逆光亮边
    │   ├── save.js         encodeWorld / decodeWorld（存档 v5）
    │   └── app.js          入口：输入、工具、撤销、场景切换、地址栏存档、window.rea
    ├── life/
    │   ├── vegetation.js   Vegetation：草丛、小花、灌木、团块树、后院（植被管线）
    │   ├── impostor.js     八方位 impostor（树）+ 云
    │   ├── atmosphere.js   风场、雪、雾
    │   ├── decor.js        旗子、彩旗绳、蝴蝶
    │   ├── effects.js      水花、出现 / 消失动画、火
    │   ├── sound.js        Sound：WebAudio 合成的建造音效（咕咚 / 磕石头 / 啵）
    │   ├── boats.js        Boats：绕岛的长船 + V 字尾迹
    │   └── birds.js        Birds：海鸥
    ├── badnorth/
    │   ├── theme.js        applyBadNorthTheme()：Bad North 调色板（夏 / 晨实测 + 4 套推断）、无地平线、岸线色、晕影
    │   ├── island.js       generateBadNorth()：小岛 + 可走性检查 + 小屋
    │   └── battle.js       Battle：长船登陆、小队、近战 / 弓箭、血 / 尸体 / 箭粘船
    ├── campaign/
    │   └── campaign.js     generateCampaign()、islandSnapshot()（战役图）
    ├── sphere/
    │   └── planet.js       buildSphere()、buildPlanet()、cornerPositions()（防蘑菇化）
    └── ui/
        ├── walkthrough.js  完整管线示例（11 步）
        ├── learnpanel.js   mountLearnPanel()
        └── hud.css         界面样式
```

## 三、一帧是怎么出来的

1. `app.js` 建 `buildQuadGrid({radius:14})` 和 `new World(grid)`。
2. 场景生成器（`buildScene(world, 'town'|'terrain'|'fusion', seed)`）或玩家操作改写 `World`，每次改动 `world.touch()` 使 `version` 加一。
3. `View.render()` 发现版本变了 → `WorldMesh.rebuild()`（分块增量：所有生成器在每格开头调 `w.at?.(c)`，三角形写进该格所在的块；只有内容变了或附近体素变了的块才重烘焙）：
   `shapeTerrain(world)`（每个切面的顶点位置）→ `buildTerrain(w, world, {shape})` → `buildBuildings(w, world)`（返回钢柱位置 `posts`、后院 `yards`）→ `bakeLighting(w, world)` → `w.toGeometry()`（软法线 + 描边方向）。
4. `View` 用同一个几何体画本体、倒影（`scale.y = -1`）和两层描边外壳，再用 `buildShore(world, grid, index, {posts, shape})` 重建岸浪（海岸取切面 0 的变形位置）。
5. 浪带是循环顶点着色器：数据在生成时烘焙，运行时只推进时间。

## 四、关键接口

```js
// 体素
world.isSolid(cell, lv)  world.isRock(cell, lv)  world.isBuilt(cell, lv)
world.setSolid(cell, lv, on, { rock })   world.fill(cell, h, { rock })
world.top(cell) / bottom(cell) / ground(cell)   // 最高实心层 / 最低实心层 / 最高岩石层
world.isLand(cell)   world.neighbor(cell, i)   world.regions()
world.color[cell]    // 调色板序号，-1 = 默认
world.river[cell]    // 1 = 河床
world.snapshot() / restore(s)   world.touch()

// 网格
cell = { id, pts:[4 个共享顶点 {id,x,z}], cx, cz, edgeNeighbors:[4], cornerNeighbors, convex }

// 地形形状：所有地形顶点都要经过它，否则崖壁和顶面会裂开
const shape = shapeTerrain(world);        // 切面 s = 高度 s·L；崖壁第 lv 段连接切面 lv-1 和 lv
shape.at(p, s) → [x, z]                   // 房子格、外圈格被钉住，返回原位

// 网格写入（同一个顶点池）
w.soft = true; w.quad(...); w.soft = false; // 软法线：同位置、夹角 < 55° 的软面平均
w.quad(a, b, c, d, dir, color, shade, glow)   w.tri(...)   w.box(...)   w.beam(...)
// 写入后 bakeLighting 会按法线采样占用图，所以新几何体自动得到 AO 和反弹光

// 调试与视图（浏览器控制台里 window.rea 可用）
rea.view.setDebug('grid'|'shorelines'|'wavewire'|'waves'|'reflection'|'shadows'|'ao'|'smooth'|'outline'|'backlit'|'lightonly'|'wire', bool)
rea.view.setTimeOfDay('day'|'dusk'|'night')
rea.loadScene('town'|'terrain'|'fusion')
```

## 五、验收

- `./start.sh --open fusion`，三个场景各看一眼：没有黑面、没有缝、浪贴着岸走。
- 勾掉 / 勾上面板里的每一项，画面要有对应变化。
- 控制台没有报错；`rea.view.worldMesh.stats` 看三角形数和各阶段耗时。
- 没有浏览器时，用 Playwright 截图（`chromium.launch()`，SwiftShader 下烘焙会比真机慢 2～3 倍）。

## 六、坑

| 现象 | 原因 |
|---|---|
| 整个画面发灰发暗 | 颜色做了两次 sRGB → 线性转换 |
| 阴影看不到 | 太阳在相机背后；用侧光 |
| 浪是一根根细线 | 浪带太窄、条数太多；2 条、加宽、降低透明度 |
| 岛填满整个六边形 | 径向衰减要从 `span·0.74` 开始 |
| 地形场景烘焙很慢 | 占用图分辨率要随面积自适应（`res = clamp(sqrt(area/40000), 0.08, 0.14)`） |
| 选颜色后不能建造 | 选色不能切换工具（已修，别改回去） |
| 关键词分类出错 | "unit" 会匹配 "Unity"；用词边界 |
| 换成三角 + 方格网格后报错 / 少面 | 某处写死了 4 个角；顶面用 `w.poly()`，循环用 `c.n` |
| 地形崖壁一块亮一块暗（三角形分面） | 变形后的崖壁四边形不共面；崖壁要写成 `w.soft = true` |
| 地形和建筑之间裂缝 | 新的地形几何没走 `shape.at`；或建筑格没被钉住 |
| 改了一格，远处的 AO / 法线没更新 | 新的生成代码没在每格开头调 `w.at?.(c)`，几何落进了别的块；或影响范围超过 `AO_REACH` |
| 块和块之间有一条亮 / 暗缝 | 烘焙没对齐全局像素网格，或法线没带 halo |
| impostor / 云一片片地闪（雪花点） | 在条件分支里采样贴图：mip 级别的导数失效。帧选择放到顶点着色器，片元里无条件采样 |
| 着色器报 `'#' : invalid character` | `#include` 写在了同一行；预处理指令必须单独一行 |
| 小镇里墨线又黑又粗 | Townscaper 没有墨线：小镇场景默认关（learnpanel 按场景切换） |

- **Dijkstra 的距离数组别用 Float32Array**：`t > time[id]` 里 t 是 float64、time 被截成 float32，几乎每次都"更大"→ 节点被跳过（导航图一度只走到 31/736 格）。用 Float64Array。
- **地形一道崖 = 2 层**（generate.js 量化到偶数层）：按 1 层算的楼梯会钉在半墙上。楼梯 / 导航的最大台阶是 2。
- **笼形变形后崖脚比崖顶更往外**：贴墙放的东西用墙脚切面 `at(p, h)`，方向用变形后的格中心，否则埋进墙里。
- **学视频先读全文再看画面**：一句话末尾顺口提的东西（"…and adding pretty little flowers"）不是视频内容；画面才是。
- **音效要等一次点击**：AudioContext 在第一次 pointerdown / click 时创建，resume 是异步的；第一声要排队不能丢。

## 七、下一步（以共享进度数据为准）

1. 下一批新片：本批已复核821680/827215；后者是单位等级，不是弧长教程。下一批按learn/accelerated-session.json对比原版新增能力。blobshadow已部分覆盖，navribbon仍未覆盖；本批340帧不重计。原动画/软影坡面与跨格连续性仍待补。
2. 部分覆盖：体素梯度软化网格并约束硬边；精细portal、形变碰撞/斜坡脚高；复杂分岔真实战斗压力测试。
3. 多格实例身份与统一撤销/存档，预制轮廓/socket、旋转和多格联合WFC。双格原子放置及整体编辑已做，不重新从零实现。
4. 树冠硬边松弛、共享World球面融合和表面光照剩余缺口。独立planet.html、树/云impostor已有，不再记为全无。
5. 走廊空间/弧顶与纹样质量；现有墙饰生成器和表面预览保留。

每批先读取当前文件和git状态，避免覆盖并行编辑。原版只读。新片先按ID读README，再查看全部解码帧；沿用已看证据时新增观看量记0。观察、工程推断、静态确认、逻辑测试和运行截图分开记载。

同步顺序：更新学习/管线与覆盖override → `python3 tools/build-coverage.py` → 更新共享进度 → `node tools/gen-pipeline-md.mjs` → `node tools/audit-pipeline.mjs` → `python3 tools/audit-refactoring.py`。修改实际算法时跑对应测试并截图三个主场景；只改文档/导航则核验链接、数据一致和页面可读性，不重复全部算法测试。

## 2026-11-01 · 重构状态口径补充（用户确认）

快速扫描两份代码，匹配迁移前后模块；已有可执行主体改进差异的，认可为已重构，保留历史学习成果，不要求重新学习全部视频。部分实现仍记录缺口。新功能继续遵循先读原文再看视频的流程。状态数据由 tools/audit-refactoring.py 生成，页面读取 learn/refactoring-status.js；静态扫描与逐帧、运行验收分别记录。


## 覆盖补差与定时接续

原版 src/engine 当前141个JS的映射（动态新增以生成清单为准）在 MODULE-MAP.md，页面 coverage.html。职责映射在 tools/build-coverage.py；逐项实证覆盖写 learn/coverage-overrides.json，避免生成时丢失。每批先读原文再看全帧，证据目录 artifacts/coverage。每30分钟的定时任务承接当前聊天，刷新 learn/coverage-progress.json；index 与 pipeline 共享 src/ui/coverage-progress.js，页面也每30分钟重新读取。不要把自动轮询当作代码审核。

首批导航逻辑测试：node tests/navigation.mjs。浏览器验收：artifacts/coverage/browser-check.json。多层战斗、分层流场、基本半径与WFC/局部修复已接入，后续以本页顶部与共享进度缺口为准。


### 分层战斗接续验收（22:07批次）

运行 node tests/battle-navigation.mjs 验证层选择、门户移动、占用遮挡、缓存失效及有向河流费用。tests/battle-navigation-browser.cjs 使用 Playwright 和本地8769服务，真实Battle构造穿洞/封洞/上下层攻击场景，并截图；可用 REA_TEST_URL / CHROME_PATH 指定环境。证据 artifacts/coverage/battle-navigation-review.md。分层流场和基本水平半径扫掠已补；后续继续精细模块portal、形变侧壁和斜坡脚高插值，已有接入不重做。

### 能力库与游戏接入分账

TigerMessenger通过独立vendor副本和场景适配器调用部分重构能力；学习目录通过验收不等于游戏已同步。集成负责人智能体目前是讨论建议，尚未创建。继续记录“已学习/实验通过/已同步/已适配/游戏实景通过”，不自动把实验页计入游戏验收。
