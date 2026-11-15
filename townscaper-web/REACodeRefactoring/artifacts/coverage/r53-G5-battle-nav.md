# r53 · G5-battle-nav（16 个「部分覆盖」模块）

只用 node 验收：本 VM 没有 Chrome，`*-browser.cjs` 一个都没跑，以下没有任何浏览器 / GPU 结论。
本轮结束时 `tests/*.mjs` 全量 223 个全部通过（含本组新增 14 个）。共用夹具：`tests/fixtures/g5-battle.mjs`，内容是真实四边 / 混合网格 + `generateBadNorth` 小岛 + 真实 `Battle`，view 用桩。

`src/badnorth/battle.js` 只做了 7 处精确字符串插入 / 替换：每次改之前重新读文件，用 python 校验旧串恰好出现 1 次后再替换。没有整文件重写。
`src/world/traffic.js`、`view.js`、`worldmesh.js`、`src/light/*`、`src/build/*`、`src/sphere/*`、`grid.js`、`wfc.js` 都没有改动。

| 模块 | 片子 | 原缺口 | 判定 | 落点 | 测试 |
|---|---|---|---|---|---|
| src/ballistic.js | 987267068495003648 | 缺原表达式、独立 Validity、drag、候选轨迹 UI | **本轮补上**：Cost / Valid 两条表达式字符串分开编译，带标识符白名单，布尔值原样放行。烘表用速度 × 仰角，带线性阻力，积分用速度 Verlet。候选按 ranked 列表给出。`projectileState` 同时支持无阻力解析表和烘表两种 shot，Battle 的箭改走这个函数。真实 Battle 里把弓手换成带阻力的表也能命中，水平步长逐帧变短。Battle 默认仍用无阻力解析表；表达式表要通过 `battle.projectileTable` 手动换上。ballistics.html 加了表达式面板和扇形图，未做浏览器验收 | core/ballistic-table.js，battle.js（箭位置），ballistics.html | ballistic-expression.mjs，ballistic-table.mjs |
| src/blobshadow.js | 820977247083528192 / 821321422140309504 / 821680056514781186 | 缺光向偏移、坡向椭圆、形变斜坡贴合、跨格连续、measure | **仍缺：形变斜坡贴合**。worldmesh 的笼形变形不在可改范围，所以没做。本轮补上了：光向偏移；坡向椭圆（拉长 1/cos、压短 cos，面积守恒）；跨格连续（同一个软盘按共顶点的同层可站格分别裁剪再拼起来，格边不再切掉半边）；楼梯上贴平均坡面并夹在上下两层之间，平地上整块留在本层、不甩到低台；`measure()`。阴影批默认仍是关闭的 | core/unit-shadow.js，life/unit-shadow-batch.js，world/battle-navigation.js（stairAt） | unit-shadow-continuity.mjs，unit-shadow.mjs |
| src/boxtest.js | 974325184525201409 | 缺地形岸礁碰撞、动态调度、原二维裁剪 / 深度、完整规划 | **本轮补上**：新增 `obbPenetration`、偏航盒俯视四边形、凸多边形 SAT、裁剪面积真值；随机 2 万对，SAT 与面积判定 0 不符。航道段（不含泊位）不能压到任何陆地格（礁石、石柱、别处海岸）。正对岸方向被占或被礁挡住时，试 ±0.35 rad 车道。双网格各 2 个 seed 都排下 6 条船，航道不压陆地，船与船两两不相交。仍然没有时间参数化的扫掠，原版规划器也是静态的 | core/obb.js，badnorth/landing-plan.js | raid-planner-terrain.mjs，landing-plan.mjs，obb-policy.mjs |
| src/cheesenav.js | 906425294533394432 / 797119718477991936 | 缺精细模块内部门户、形变侧壁、斜坡脚高插值 | **仍缺：模块内部门户和形变侧壁**。World 只有「格 × 层」体素，没有格内开口数据，这部分数据在 build/worldmesh，都不可改。本轮补上：头顶净空、封门后不连通、导航随几何生长；楼梯踏面脚高（与 navlayer 渲染的台阶参数相同，不含笼形变形） | world/layerednav.js（stats / treeTo 过滤），world/battle-navigation.js | layered-nav-holes.mjs，unit-foot-stairs.mjs |
| src/holenav.js | 797119718477991936 / 906425294533394432 | 同上 | **仍缺：同上**。本轮补上门洞加价：穿拱洞 / 洞道的边 × doorCost，默认 1.35。拱洞近时走拱洞；门价调到 2.5 后，宁可绕到无顶缺口。封门后不可达 | world/battle-navigation.js | layered-nav-holes.mjs |
| src/voxelnav.js | 906425294533394432 / 797119718477991936 | 同上 | **仍缺：同上**。原模块的机制已全部覆盖：同一柱子里的多层节点、单值高度图对照（墙两侧在高度图里不连通，分层图能穿拱过去）、连通块和被覆盖节点占比的统计 | world/layerednav.js | layered-nav-holes.mjs |
| src/combatfx.js | 870296307889573889 等 8 条 | 缺完整动作 / 原作美术、复杂拥挤 / 体型路由、旋转武器 / 3D 接触遮挡、盾格挡推力 | **仍缺：完整动作 / 美术、旋转武器扫掠、3D 接触遮挡、盾格挡推力**。本轮补上：原版 FALL→LAND / DROWN 的落地结算。修了一个 bug：以前掉进海格（top=0）且落差 <3 时，单位站在海面上，没有导航节点，永远卡住；现在会溺水沉下去，水面不铺血泊。落差 1 层有落地硬直，2 层掉血，≥3 层摔死。体型路由见 traffic | core/combat-state.js，battle.js（#fallStep） | combat-fall-landing.mjs |
| src/flowfield.js | 816748103193817088 | 缺连续三角导航面内插值、坡高、原群体流体行为 | **仍缺：Battle 默认转向没换成连续流；鞍点仍会困住少数人**。本轮补上：`navMeshFromLayeredGraph` 用 Battle 实际的分层图生成导航面。顶点按「同层且图连通」分组；跨层用 nb + links 连起来；贴墙顶点加离墙偏置。过同层共享边时流向基本连续：中位 0.07 / 0.05 rad，逐面常量对照的 p90 约 1.0–1.2 rad。24 人 stepCrowd 有 22–23 人到达（不加偏置时只有 12）。`BattleNavigation.continuousFlow` 打开后，连续流向与通口前视各占一半，实际 Battle 里被采用了数千次；但这个开关默认关闭，实测到达率不比通口前视好 | world/navmesh-flow.js，world/battle-navigation.js | layered-continuous-flow.mjs，navmesh-flow*.mjs |
| src/infograph.js | 883447205176238083 | 缺单位知识的动态节点通信图 | **本轮补上**：新模块 info-graph.js。每次更新按距离、同层、视线重建边；只有亲眼看到的敌人才是情报源；情报每跳 × 0.55，最多 2 跳，源在第 0 跳就生效（原版修过的一处）。A/B 对比：平均两两距离 1.59 → 1.39。真实 Battle 中，看不见守军的维京人会按同伴转告扑过去；`infoSharing=false` 时各自奔向小屋 | badnorth/info-graph.js，battle.js（维京人目标） | info-graph.mjs |
| src/navribbon.js | 827215002448846848 / 823848950553780226 | 缺 CatmullRom、宽度带、贴地走廊、完整接口 | **本轮补上**：命令路径改为分层折线 → Catmull-Rom（样本若不在相邻两节点上，退回折线）→ 弧长 0.15 等距 → 每点贴实际地面（含楼梯踏面）→ 按格内到封闭边的净距生成带状格子，首尾共享边。实际 Battle 双网格都已接上。两条片子都没有配文：827215 是单位等级，823848 是尘粒 AO，本组只迁 navribbon 的工程做法，尘粒 AO 没做 | core/path-samples.js，world/battle-navigation.js（commandRibbon），battle.js（#drawPath） | command-ribbon.mjs，path-samples.mjs |
| src/squadbanner.js | 827216768783495168 | 缺原三格 atlas、金饰盾纹、竖旗横杆、完整队色系统 | **仍缺：金饰盾纹、竖旗横杆，以及 Battle 里的实际替换**（Battle 仍是 Bezier 飘带旗 + 单色盾）。本轮补上：三格徽记图集，墨量与旗面同源；军色派生身体 / 盾 / 头盔 / 旗底四种角色色；公告板偏航夹在 ±40° | core/banner.js | squad-emblem-atlas.mjs，banner.mjs |
| src/traffic.js | 880853661936734211 / 886199305522085890 / 795010582239997952 | 缺弯道 / 多岔、体型重路由、复杂拥挤压力测试 | **本轮补上**：在真实 Battle 上压测 L 弯道 12 对 12（含大体型）、T 三岔 10×3 三向对穿、直走廊 8 对 8，全部约 6 秒内全员到达，没有死锁，暂停不漂移。体型重路由：身体直径塞不进的通口不进路径树，树按体型分档缓存；0.25 宽的捏口，大个子（直径 0.3）在实际 Battle 中绕另一行到达。分离仍是软约束：L 弯道拐角的最深穿插约 0.83 个半径和，深穿插只出现在 42 个人对帧里。traffic.js 本身没改 | world/battle-navigation.js（plan / 体型树），layerednav.js（treeTo allow） | traffic-stress.mjs，traffic.mjs，body-separation.mjs |
| src/unitbatch.js | 817323301357948928 | 单位尚用独立对象，未覆盖批量实例化与剔除 | 「独立对象」这一条**已过时**：身体 / 头 / 盾 / 矛早就是 InstancedMesh，部件 draw call ≤6，与人数无关。**本轮补上**剔除和 LOD：#draw 之后把视锥外的实例压实掉，身体 / 头 / 盾 / aSoak 保持同一下标；投影高度 <9px 时退掉盾 / 矛 / 星，只留身体和白盔。只有真实渲染器在时才默认开启，可用 `unitLodEnabled` 开关。实例下标会因剔除改变，按下标读实例的浏览器测试（gore-toggle / spear-pose 等）没有跑过 | badnorth/unit-batch-lod.js，battle.js（#draw 之后） | unit-batch-lod.mjs |
| src/unitsnap.js | 828984794407170048 / 890611046435627008 | 缺原 standHeight 演示、真正斜坡脚高、完整动画和火球 | **本轮补上**：楼梯踏面脚高 `footHeight`，逐级单调；Battle 每帧往这个高度缓动；换层时对准楼梯中线。实测单帧高度变化 ≤0.27（层高 0.5）。`measureFooting` 给出悬空 / 埋入 / 层数 / 相邻落差，停下后都是 0 悬空 0 埋入。整队平均高度的 A/B：8 人全不贴地。890 的「完整动画和火球」是那条生日片里的其它内容，不属于 unitsnap 机制，本轮没做 | world/battle-navigation.js，core/unit-ground-height.js，battle.js（脚高） | unit-foot-stairs.mjs，unit-ground-height.mjs |
| src/rayvis.js | 798580832906739712 | 会漏薄墙；缺完整灰度场 / 整楼烘焙与原接口 | **本轮补上**：`castWorldRay` 在多边形柱格之间逐格穿行，每格按射线经过的高度区间查层，正好穿过格角的情况已修。0.06 宽的薄墙：固定 0.2 步长会跨过去，逐格穿行能撞到。整楼烘焙：带顶房间室内均值 0.21，露天 0.53；门口比屋里深处亮。叠加层上有灰点场。灰度只以叠加层灰点显示，没写进地形顶点色（view / worldmesh 不可改） | core/space-visibility.js，world/space-visibility.js | space-visibility-bake.mjs，space-visibility.mjs |
| engine/outline.js | 1482011744843223042 / 1017355723171344385 | 缺原完整 normal atlas / 笔触、UV 接缝、engine 几何法线 + 深度 Sobel 全部接口 | **仍缺：没接进 view 渲染循环（view.js 不可改），没做 GPU 验收；normal atlas / 笔触 / UV 接缝也没做**。本轮补上：原版屏幕空间后处理整类迁为 world/outline-pass.js，包括法线 + 线性深度、depthMix、暖色亮边、DPR 线宽。另写了一份 CPU 参考 `screenEdges`，验证了：剪影有线、折痕有线、depthMix=0 时只留法线反差、外圈 2px 淡出、线宽 × DPR | world/outline-pass.js | outline-pass.mjs |

## 对 Battle 行为的改动（其它会话需要知道）

1. 维京人新增「同伴转告」目标（`infoSharing`，默认开）。
2. 单位脚高改为往 `footHeight` 缓动，楼梯上取踏面高度。
3. 换层时朝楼梯中线走。
4. 穿拱洞 / 洞道的边加价 1.35。
5. 身体放不进的窄通口不走。
6. 掉进海里会溺水。
7. 命令路径点改为平滑带状。
8. 有真实渲染器时，单位实例会被剔除，LOD 默认开启（`unitLodEnabled=false` 可关）。

上面 1–7 已有 node 测试覆盖。第 8 条会改变实例下标，现有按下标读实例的 `*-browser.cjs` 需要在有 Chrome 的机器上重跑确认。
