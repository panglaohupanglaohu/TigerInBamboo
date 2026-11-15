# r53 · G2-terrain-build：16 个「部分覆盖」模块补齐

范围：partial-83.json 里 G2 组的 16 个 source。没有改 REACode，没有写 learn/*、CHANGELOG、PIPELINE。
验证只用了 node：tests/ 下全部 *.mjs 都跑过，全部 PASS。本 VM 没有 Chrome，*-browser.cjs 一个都没跑，也没有做任何浏览器验收。
本轮新加的建筑开关默认全部关闭；关闭时的顶点数与原几何完全一致，每个 World 测试都断言了这一点。

| 模块 | 片子 | 原缺口 | 判定 | 落点 | 测试 |
|---|---|---|---|---|---|
| src/depfill.js | 1447488323845509121 | 缺连续微坡、湖水、原版统计，河道没有重算 | 仍缺：湖只有数据（水位/深度/溢出口），没有水面渲染，World 也没有水位层；侵蚀没做；replan 只支持纯地形（caves=0、features=false）。本轮补上：可选 epsilon 微坡排水面、localMinima/drained/lakeClusters 诊断、`rivers:'replan'` 在填洼后重算河网 | core/depression-fill.js, terrain/drainage.js, terrain/generate.js | tests/depfill-lakes.mjs |
| src/overhangterrain.js | 1671808851895627776, 1447488323845509121 | 缺 heightField 软坡、无局部极小保证、measure 接口；侧壁碰撞未做 | 仍缺：World 只存整数层，做不出连续软坡；笼形变后的 3D 侧壁相交/碰撞没测。本轮补上：measureOverhang、`softSlopes` 分省量化，软坡加填洼后零局部极小 | core/rock-topology.js, terrain/generate.js | tests/soft-slopes-overhang.mjs |
| src/terracecliff.js | 815236105079398400, 781957658597269506 | 没有 fieldSmooth/fieldTerrace 对照；变形坡面没量 | 仍缺：整数 World 里没有连续场；量的是逻辑格列，不是变形后的网格坡面。本轮补上：classify 坡度分类、缓阶边/崖边计数，可对照默认量化和 softSlopes 量化 | core/terrace-profile.js, terrain/generate.js | tests/soft-slopes-overhang.mjs, tests/terrace-profile.mjs |
| engine/rivers.js | 1769691526924292506 | 缺球面坍缩、BFS 缓坡，湖/洞没有联合重建 | 仍缺：上面三项都没做。本轮补上：carveRivers 按原版输出 paths/mouths/flowTo（开凿顺序），写进 World.riverFlow 并带版本号 | terrain/generate.js | tests/river-carve-flow.mjs |
| src/navgraph.js | 1795831296952041691, 1582293326815862786 | 复杂汇流、流向持久化、完整接口 | 仍缺：riverFlow 不进存档（save.js 不归本组），球面流向没做。本轮补上：平床判向优先读有效河网，再读开凿顺序，最后才用启发式；迁入 findNavPath / riverRouteStats / simplifyNav | world/navgraph.js | tests/river-carve-flow.mjs, tests/river-nav.mjs |
| src/islandpasses.js | 1669315384619540487 | 缺 traceRings/interpContour，最终倒角是否一致没验 | 仍缺：最终倒角网格与线框是否一致没验。本轮补上：traceTerraceRings（欧拉环追踪 + 中点插值对照），12 组全部闭合 | core/terrace-edges.js | tests/terrace-rings.mjs, tests/terrace-edges.mjs |
| src/terraceladder.js | 781957658597269506, 1669315384619540487 | 缺薄悬平台处理、端点体积接触、攀爬 | 仍缺：已经查出 7 把搭在薄悬平台上的梯子，但寻路还没避开它们；单位没有攀爬动画；梯子体积碰撞没做。本轮补上：ladderAnchors 共用、ladderContact 体素端点检查、supportDepth 识别薄平台、ladderClimb 攀爬采样 | core/ladder-profile.js, world/navlayer.js | tests/ladder-contact.mjs, tests/ladder-profile.mjs |
| src/archvoid.js | 806904557502464000, 802496920790777856 | 缺楔石/键石、桥面/拱脚、完整 clearance/measure 接口；变形空间误差没量 | 本轮补上：archVoussoirs 等参角楔石环（奇数块时有键石）+ measureArch（缝距 0、零重叠、长细比、净空）；`world.archVoussoirs` 在真实拱的两个开口面画楔石环，厚度不超过楼板预算；deformedArchError 量的是经过实际笼映射之后的弦误差，每个拱都写进 archBudgets。另外修正了原版 archOuter 法向 x 的符号错误（原版拱脚被往里推）。桥面就是拱上面那一格体素，落在全局层线上 | core/arch-profile.js, build/buildings.js | tests/arch-voussoirs.mjs |
| src/piercefloor.js | 802496920790777856 | 缺原版的立面/过梁/挑檐连续率、穿层统计；碰撞没做 | 仍缺：过梁没有单独几何；拱下净空和单位碰撞没做。本轮补上：openingPierce，统计穿层数和挑檐是否连续，并保留布尔挖洞（raw）对照；每个 World 拱都记录 slabsCut=0、corniceContinuous=true，raw 对照 30/30 都会穿透楼板 | core/arch-floor-budget.js, build/buildings.js | tests/opening-pierce.mjs |
| src/hiproof.js | 807256278154301441 | 不规则四边只有双线性解释；缺完整多格四坡、复杂凹屋顶、原接口；README 配文讲的是寻路 | 仍缺：多格四坡是在角点/边中点/格心三种点上采样「到檐口距离」场得到的近似，不是精确的直骨架，凹形屋顶的谷线是近似的；寻路小点那段配文与屋顶无关，不复现。本轮补上：hipRoofMetric/gableRoofMetric（带外挑、攒尖判定、三角/梯形面计数、等坡下两种屋顶面积相等），`world.hipRoofsJoined` 让排屋端头不再做山墙，94 个多格体块都闭合成四坡，所有檐口等高 | core/hip-roof.js, build/buildings.js | tests/hip-roof-joined.mjs |
| src/housekit.js | 781027725452648448 | 缺 makeHouse/buildVillage/verify 接口、离散层高/坡度池、烟囱贴屋面约束；茅草顶套件没迁 | 仍缺：坡度仍固定为 1.3，没有 8 档坡度池；茅草顶美术套件和随机矩形撒村没迁（World 的格子已经决定了占地）。本轮补上：roofHeightAt/seatChimney/verifyHouseKit；`world.houseKit` 把烟囱放到坡面上，底面取占地内最低的屋面高度，与独立采集的屋面三角比对，悬空 0、中心误差 <1e-9；同时验证檐口等高、窗台落在全局层线 | core/house-kit.js, build/buildings.js | tests/house-kit.mjs |
| src/tileplace.js | 784847588893814785, 784847933686575104, 787319655648100352, 784848286272327680 | 缺 3D 预制模块目录和联合空间约束；逐步拼装和待置零件动画没做 | 仍缺：原版权重在本轮只是首选偏好，因为共享求解器没有加权熵；标签计数这项位掩码优化没迁；拼装播放只有数据（每步放下的块 + 幽灵候选数），没有渲染动画；CONTENTS 美术没迁。本轮补上：FORT/RUIN 标签 tile 集，在真实网格上用分层 3D 格阵（三角格和方格都支持，可旋转变体）交给共享 WFC 求解；每块都有支撑（重力规则是为了写进 World 加的，原版没有）；整批提交为建筑体素，被占的体素整批拒绝 | build/tile-assembly.js | tests/tile-assembly.mjs |
| src/propframe.js | 1205416648397721601 | 原版独立 2D 贪心和标准框度量没全迁；World 庭院家具没有饱和摆放；原美术缺 | 本轮补上：placeProps（凸格内贪心、SAT 判重叠、离边距离、std 刚性框与 local 剪切框对照、frameDeviationDeg）；`world.yardProps` 在真实后院格（小径除外）摆满木箱，树冠作为已占位置，零重叠、std 框偏差 0°。美术只是简单盒子，不是原片道具 | core/opening-footprint.js, build/buildings.js | tests/prop-frame.mjs, tests/opening-footprint.mjs |
| src/storydatum.js | 803190517534248960, 806856212260278272 | 缺任意非整数塔基的全局标高对齐、截短楼顶、measureFacade/windowRows | 对共享 World 来说缺口已过时：World 只有整数层，楼层线天然落在 k×L 上。测试在 4 个场景、139 座塔上量到偏差恰好为 0，塔基不同高时檐线照样共用。非整数塔基的规则（datum 截顶、local 对照）以及 measureFacade/windowRows 也迁入了，用合成台地测过 | core/story-datum.js | tests/story-datum.mjs |
| src/surfacedeco.js | 1181464374839521280 | 缺跨格整立面、真实拱洞、完整原接口；候选碰撞拒绝仍在 | 仍缺：有门的墙段不并入长立面；不跨拐角；拱门仍是贴片，没有真正挖洞；放置碰撞造成的丢弃仍然存在。本轮补上：`world.surfaceFacadeRuns` 把共线墙段串成长立面，一次 WFC 解完；跨格百叶要等相邻格的窗确实画出来才画。新旧对照：旧的逐段求解在格界处有 51 处违规，新做法 0 处，验证了 163 条长立面和 119 个跨格百叶 | build/buildings.js（求解仍走 core/surface-decoration.js） | tests/facade-runs.mjs |
| src/splice.js | 1584623053061099520 | 缺统一编辑器撤销、模块身份、完整轮廓 socket；任意轮廓插入和地形周边重网格没做 | 仍缺：嵌入的房子只是覆盖数据（world.splicedHouses），不进存档、不进撤销栈、不接编辑器；房子只是简单墙体加锥顶，没有走建筑管线。本轮补上：保留原版矩形双线性切法；新增 splicePolygon，任意凸格（含三角格）+ 任意凸占地，用角度拉链三角化成环带；格边不切分，所以邻格不会出现 T 形接点；terrainmesh 在笼形变后的顶面上开环带、把房子沉下去。真实地形两种网格共嵌 100 栋，面积守恒，撤掉后网格恢复原样 | build/splice.js, terrain/terrainmesh.js | tests/splice-house.mjs |

## 共享测试夹具

tests/fixtures/g2-build.mjs 用的都是应用里的真实网格：quad r14、mixed r22（hexSize 0.62）。场景走 buildScene，几何用真实的 MeshWriter 写出来。夹具提供三角形采集（按颜色），以及 World 体素快照。

## 新开关（默认全部关闭）

`archVoussoirs`, `hipRoofsJoined`, `houseKit`, `yardProps`, `surfaceFacadeRuns`；`world.splicedHouses` 由 spliceHouse 写入。这些开关都还没有接到任何 lab 页面的勾选框上。
