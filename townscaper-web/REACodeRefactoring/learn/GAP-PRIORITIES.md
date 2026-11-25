# 缺口优先级表（108 组 → 按主题与「能否一次收口」排序）

- 生成时间：2026-11-16T02:40+08:00（第 102 轮）
- 数据源：`learn/coverage-progress.json` 的 `next`（108 组）+ `learn/data.js` 的 status
- 总账：285/285 已核；done 71 / partial 177 / ref 15 / na 22（已核 ≠ 已做完）

## 口径：`done` 要多难

`update-learning-counts.py` 只认「有帧证据」，所以 285/285 是**账面**。要把一条 partial 变成 done，必须同时满足：

1. 该片里被记成缺口的**所有**机制都实现（不是只实现一条）；
2. 有测试（逻辑 或 浏览器）且跑过；
3. 全片联系表核过（历史轮次已核的可复用）；
4. 记录里不再写「仍缺 …」。

因此本表的「收口路径」分三类：**A** 只缺验收/接线（改码小，1 组≈0.5 轮）、**B** 缺机制（1 组≈1.5 轮）、**C** 定案或素材上限（**永远不会变 done**，别再排期）。

## 一、主题分布

| 主题 | 组数 | 涉及 partial 条 | A 可验收 | B 缺机制 | C 不排期 | 涉及片数 |
|---|---|---|---|---|---|---|
| 网格/拓扑/生成 | 30 | 41 | 1 | 29 | 0 | 53 |
| 体素/光照/材质 | 24 | 29 | 1 | 21 | 2 | 40 |
| 植被/灌木/天气 | 15 | 26 | 0 | 15 | 0 | 31 |
| 其他 | 14 | 17 | 1 | 12 | 1 | 23 |
| 烟火/战斗表现 | 15 | 13 | 0 | 13 | 2 | 18 |
| 导航/流场 | 6 | 13 | 0 | 5 | 1 | 14 |
| 建筑/模块 | 2 | 4 | 0 | 2 | 0 | 6 |
| UI/HUD/存档 | 1 | 2 | 0 | 1 | 0 | 2 |
| 天光柱 | 1 | 1 | 0 | 0 | 1 | 1 |
| **合计** | **108** | **146** | **3** | **98** | **7** | — |

## 二、TOP 18（按「可收口的 partial 条数 ÷ 轮次成本」排序）

| # | 组 | 主题 | 涉及片（status） | 缺口 | 路径 | 核实 | 收口动作 | 分 |
|---|---|---|---|---|---|---|---|---|
| 1 | [010] | 网格/拓扑/生成 | `1151137783785771008`(done), `972829402873716737`(done), `917405214638006273`(done), `1164926304640229376`(done), `1481661852887265288`(done), `1201179450668441600`(done) | 续项 | **✔ 已收口（第 135 轮 · 6/6 片）** | ✔ 已核实 | 页面入口 4 条已做并出运行验收（grids 平移窗口 / wfc 存活诊断 / navmesh 漏斗 / ui 等墨量）；**r133：`1201179450668441600`（Icons!）→ done** —— 旧 note 的「撤销/重做/退出要接主管线」核实为过期账（真命令早接），真缺的是没从页面点过 + 第三格被做成「清空城镇」；本轮补真实栈可用态、选中态形制、退出=摘 UI，新测 `tests/game-ui-icon-commands-browser.cjs`；仍剩 `1481661852887265288`（体素光照烘焙：笔触法线贴图 + SDF 命中 UV，美术资产为主）与 1481 的 navmesh/walk-reach/texel-owner 三条接线（r134 未动，仍挂 B）；**r134：`1481661852887265288`（425 帧·Yet another light baker）→ done** —— 旧 note 两条「仍缺」（笔触法线贴图 / SDF 命中 UV·mega 反馈）核实为**过期账**：`paint-normal.js` + `view-shading.js ?shade=paintnormal` 早接主材质、`megatexture-gi.js` 早跑 SDF-RG=UV 往返，缺的是运行验收 → 新测 `tests/lightbaker-textures-browser.cjs`（噪声 0 / 差分 233109px / 回位 0；uvMatchRate 82.5%；反弹 122.9%→5.50%→0.97%）；**r135：`1151137783785771008`（449 帧·不规则四边形无限网）→ done** —— 旧 note 的「真流式加载（页面一次最多 19 块）」是**过期账**（`createInfiniteStream`/`streamWindow(evict)`/`infinite-stream.html` r56 就在，缺的只是浏览器验收），「块内疏密均匀度指标」是真缺口 → 新增 `densityStats` + 页面读数 + 新测 `tests/infinite-stream-browser.cjs`（拖焦点 7→45 块、走 0→200 累计 57→224 块而缓存恒 30–37/丢弃 194、接缝 ≤2.8e-14、翻折 0；面积比 p10/p50/p90 0.80/1.00/1.19、CV 0.141、块均值 CV 0.006 vs 块内 0.141）；组内 6/6 片全 done | 6.0 |
| 2 | [051] | 导航/流场 | `820977247083528192`(done), `821321422140309504`(done), `821680056514781186`(done), `827215002448846848`(partial), `823848950553780226`(partial) | 续项 | **✔ 已收口（第 131 轮 · 3/5 片；余下 2 片定案 C）** | ✔ | 8209 单位接触软盘 → done（r114）；`821321422140309504`/`821680056514781186` **r131 → done**：r130 已修的真缺口是 wiring（`UnitShadowBatch.enabled` 默认 false → 默认战斗不画软影，已默认开 + `?unitShadows=0` 关档），本轮把 r130 剩下的「没在画面上看见盘子」收掉 —— 120ms 定时器钉 `target/distance/pitch`（r127 做法）+ 冻时间轴 + 改取**楼层最高**的单位俯视（`dist 4.0/pitch 1.25`），像素 A/B 噪声 **0**、开/关差分 **9228 px**、压暗中位 **21.07 级**（最暗 38.1 = 22%）、开→关→开回位差分 **0**；24 片盘面最低点全 **0.008** → 排掉「实心台地把盘埋掉」的疑点；0.36·h=0.162 / 1÷cos20°=1.06418 / 面积比 1 / alpha 0.13125 全对；8272 卡美术资产（C）、8238 卡尘粒 AO（C），各是一整件事，不排期 | 3.33 |
| 3 | [040] | 网格/拓扑/生成 | `1654401054828638214`(done), `1670064751181791233`(done), `1671840905957978113`(done), `1724449858369568780`(done) | 续项 | **✔ 已收口（第 146 轮 · 4/4 片）** | ✔ | 1724（可拖拽节点编辑器）r111 → done：机制早在 `node-editor.html` + `src/core/node-graph-editor.js`，只缺真鼠标验收；**r146：`1670064751181791233`（420 帧·job 里的 Thread.Sleep）→ done** —— 机制（module Worker + `SharedArrayBuffer` 时钟 + `Atomics.wait` 睡眠 + 7 段节奏）r56 就落码、node 测试一直绿，真缺口是**页面根本没跑共享内存**：`tools/serve.py` 没发 COOP/COEP → `crossOriginIsolated=false`、`SharedArrayBuffer` 不存在 → 退成 `copied-busywait`（暂停键是死键、倍率只在启动读一次），原 note 记的「卡点·E 环境不具备」实为服务器少两个响应头；改法：只给 `/job-c08.html` 与 `/src/terrain/pipeline-job*` 发 COOP/COEP（不全局），新测 `tests/pipeline-job-shared-clock-browser.cjs`（coi true / 真 Worker 实例 / job 睡觉时主线程 400ms 内 rAF 24 帧 / 阶段顺序全对 / **运行时主线程 setScale(0.02) 让 clay 2771→145ms = 19.1×** / 暂停后消息 155→155 不动 / ?rounds=2 出现 2 次 clear）；片内实测 = **一轮** 22.83s（非四轮，原 note 的「四轮节奏」为过期账），triangulate 7.41/7.07、silhouette 0.38/0.40、一轮 22.0/22.83 | 2.67 |
| 4 | [042] | 植被/灌木/天气 | `1427721874490933250`(done), `1430227487376781317`(done), `1447483550257799171`(done), `1448039167057879048`(done) | 续项 | **✔ 已收口（第 108 轮 · 4/4 片）** | ✔ | 剩的两条同样是「已实现缺验收」：`island-stages-c09.html?mode=talk`（帐篷竖棒/顶点阵/逐笔线稿/共享边线网/等高线/着色六层 + 4 轮换岛 + 自动推进）与 `island-build-c09.html?mode=reel`（4 轮 4 岛循环 showreel），本轮各补一支浏览器验收 | 2.67 |
| 5 | [048] | 植被/灌木/天气 | `816748103193817088`(done), `1181464374839521280`(done), `1243228419162341379`(done), `1769691526924292506`(done) | 续项 | **✔ 已收口（第 138 轮 · 4/4 片全 done）** | ✔ 已核实 | 110 轮 8167 导航面接真实 Battle；112 轮 1243 云影四类接收端（植被差分 0 查明为夹具口径错）；113 轮 1181 **→ done**：跨格整墙/真洞口核实为 r55 已实现（facadeRuns 163 条全多跨、跨边界违例 51→0；archCutout+wallStrip 真不画拱形墙条并补洞壁），补 `archCuts` 面积账（误差 1.98e-5）+ 新测 `tests/facade-arch-cutout-browser.cjs` + `building-components.html` 两个开关；**138 轮 `1769` → done**：完整球面 WFC/BFS 核实为过期账（`river-collapse-c09.js` r56 C09-B 就实现了「河道 DFS 坍缩 → 其余 BFS 缓坡」，球面/平面两条路都在跑），真缺的是运行验收 + 河面画在河床顶面被自己的沟壁挡成干沟 → 河面改画在岸高 + 新测 `tests/planet-rivers-c09-browser.cjs`（DFS 定律 409/409、单宽 782 对 0 并排、BFS 1298 格 0 违例、陡边 3.22%、?river A/B 多 94278 蓝像素）；组内 4/4 片全 done | 2.67 |
| 6 | [045] | 其他 | `1209519206233968641`(na), `1210969316071477248`(na), `1239901715266244609`(na), `1257213678056857600`(done) | 续项 | **✔ 已收口（第 103 轮）** | ✔ | 钢架三缺口（长斜杆/内倾/分段接头）实为 r56 `steel-r56.js` 已实现 → 补浏览器逐腿断言 + 截图，片转 done | 2.0 |
| 7 | [047] | 体素/光照/材质 | `1174406613031170049`(na), `1189109278361165825`(ref), `1195463004919357443`(na), `1205422438437273601`(done) | 续项 | **✔ 已收口（第 132 轮 · 组内唯一 partial → done）** | ✔ 已核实 | r104 补的跨两层高拱龛页面入口 + GPU 断言（下层 1.0000/上层 0.9999/拱肩 2838px 泄漏 0）保留；r132 收掉最后一层：旧 note 的「墙体厚度与洞口侧壁、近景无洞深」核实为**过期账**（`punchGeometry` 的凹洞盒=后墙+两侧壁+窗台+窗楣、depth 0.06 就是洞深），真缺口是「接 buildings.js 主管线」的**默认不接**（`app.js` 原来 `if (params.get('punch'))`，全岛门窗默认是深色贴片）→ 改主场景默认开 + `?punch=0` 关档；新测 `tests/opening-punch-main-browser.cjs`：240 洞=236窗+4门 对齐 openingLog、整岛 A/B 6402px、其中 **83.5% 落在洞口投影矩形并集内**、噪声 0、近景窗内深色 2244→0px、斜看侧壁 1423→1975 单调、暗缝质心横移 31.2px（关档 1.1px） | 2.0 |
| 8 | [000] | 植被/灌木/天气 | `1707497006640365880`(done), `1707490932017279035`(done) | 缺口 | **✔ 已收口（第 105 轮）** | ✔ | 建同机位标定（`tests/shrub-band-scale-browser.cjs`，apothem 对齐 130px）：本仓 P90/apothem 0.154 vs 原片 0.138 → **常数不改**（r101 的「P90 60%」是机位假象）；`splitCells` 查出是过期名词 | 1.33 |
| 9 | [007] | 网格/拓扑/生成 | `902069261304287232`(done), `901842167508992000`(done) | 缺口 | **✔ 已收口（第 115 轮 · 2/2 片）** | ✔ 已核实 | 两条都是「已实现缺验收」：三项数据继承（距离/方向/兵种，386 节点 nearest 386/386）+ 流场调试可视化（395 格格网/3160 边/按兵种 3 色）；`continuousFlow` 已进主战斗默认，30/60/120Hz 三档成套跑过（新测 tests/flow-battle-rates-browser.cjs）。LOD 维持不适用。 | 1.33 |
| 10 | [041] | 网格/拓扑/生成 | `1459169210752507904`(partial), `1466059785703460870`(na), `1489193847422865410`(na), `1490068909042642944`(done) | 续项 | **✔ 已收口（第 125 轮 · 可收的 2/2 片，1459 定案 C）** | ✔ 已核实 | 1459 三条「缺口」r116 核实为**误读**（无格心彩色小块=补丁缝+三角带小三角边/X 对角线；无透视；无 world 实景），补丁着色层已实现并出运行验收（`?mode=patch` + `patchLayout`，新测 `tests/grid-patch-families-browser.cjs`）；1490 r125 **→ done**：「颜色=根分支还是连通分量不可证」改用**同一口径量两边**破题 —— 终帧蓝带命中 36/36 个 10° 扇区、半径分桶 27.6% vs 角度 18.6%（颜色跟半径不跟角度），新测 `tests/graph-bands-c08-browser.cjs`；1459 的 **补丁级刚性**（153 块 vs 原片约 8 块、抖动 14.99° vs 0°）要动生成器且族向 relax 已试错反升 45°，**定案 C 不排** | 1.33 |
| 11 | [044] | 网格/拓扑/生成 | `1258005604066627586`(ref), `1275089608758484992`(done), `1277554535297236994`(ref), `1302686201401442309`(done) | 续项 | **✔ 已收口（第 117 轮 · 2/2 partial 片）** | ✔ 已核实 | 1275 教堂高拱龛 → done（note 四条「仍缺」核实全在，本轮补后墙形制 + `tests/church-niche-browser.cjs`）；1302 无限网格 → done（`relaxPolygons` 加 areaPull 面积拉回，收缩格 27→0、最小 0.450→0.640、拉伸 1.83→1.52，新测 `tests/infinite-area-pull.mjs`）；组内已无 partial | 1.33 |
| 12 | [046] | 烟火/战斗表现 | `1022855252574437376`(na), `1092709665199345664`(done), `1151152046055272449`(na), `1163836000688365571`(done) | 续项 | **✔ 已收口（第 124 轮 · 2/2 partial 片）** | ✔ 已核实 | 1092「k-pow」r119 → done（explodeAt 编排全在）；1163「marching cubes」r124 → done：`where` 说「缺 3D 等值面模块」是**过期账**，`src/core/marching-cubes.js`（r56 C06，文件头署本片 ID）用「每格×每层当棱柱、按面走一圈（进/出）」替代 256 情形查表 + 交点按顶点 id+层焊接，只缺浏览器验收 → 新测 `tests/marching-cubes-browser.cjs`（3716 三角/1832 顶点 verts÷tris 0.493、闭合边界边 0、体积 +47.885、交点 1106 全在格边 604+502 偏离 0、V−E+F=−26 → genus 14 拱洞、底面 13 个层高、生长六档单调 104→3716、像素 A/B 0→152226 噪声 0、slab 斜面 0 板厚 0.45）；页面补 `mesh()` 探针与表面三角边线层、模块补 `vertexKinds/fanCenters`（零行为变化）。组内已无 partial | 1.33 |
| 13 | [050] | 网格/拓扑/生成 | `1447496205282549761`(done), `1447494168448753667`(done) | 续项 | **✔ 已收口（第 126 轮 · 2/2 片）** | ✔ 已核实 | 14474941「对角四分 + 混合 tile WFC」→ done：联合约束（`jointSubtileCatalog`/`layeredJointCatalog`）与三层 3D tile 都在，页面 `joint3d.html` 早已有，本轮补运行验收 `tests/joint3d-layered-browser.cjs`（69 父格 / 150 子格 = 69+3×27、3 层、conflicts 0、同父格不一致 0、两层塔 5；反向对照 `?joint=0` 不一致 81）；`14474962` r126 **→ done**：原文只讲「底图就是一张不规则三角网」，note 挂的「预制 tile」在本片不存在（0349+ 全岛只有地形与植被）→ `grids.html` 补 `?kind=` / `?wire=1` / `?tri2=1`（四边格沿一条对角线切两片）+ `gridLab.kindsReport`，`terrain-r55.html` 补 `grid=tri|hex`（原来只透传 quad/mixed）；新测 `tests/tri-base-graph-browser.cjs` 19/19（mixed 三角化 331→486 三角、对角线 155==四边 155、面积 CV 0.4165、Euler 1；`?grid=tri` 陆地 576/10 层/河道 27；r55 三角底图软坡面 36.4 vs 墙面 211.8、河道 52 格 7 口、湖 6 个 51 格、陡边 118→91） | 1.33 |
| 14 | [052] | 体素/光照/材质 | `1338829205157646336`(done), `1338825080844021760`(done) | 续项 | **✔ 已收口（第 118 轮 · 2/2 片）** | ✔ 已核实 | 两条共用一条缺口清单：投影往返 / 动态重三角化 / 完整视觉**早已实现并有测试**（`liftToSphere.roundTrip` 1.06e-15、`relaxRetriangulate` 改边 18→4→1→2→0、`planet.html?stages=1` 四阶段真快照）；真缺的只有**极点鲁棒性** → 新增 `poleGuard`（极点选点 + 真旋转 det=+1 + 重合点合并），旧路径极点重合 RangeError、次北点 1e-4 rad 时 r=2.00e4 → 6.53（3.06e3×）；新测 `tests/sphere-pole-guard.mjs` + `tests/sphere-insert-guard-browser.cjs` | 1.33 |
| 15 | [053] | 网格/拓扑/生成 | `1677242779162877952`(done), `1458921394855718917`(done) | 续项 | **✔ 已收口（第 120 轮 · 2/2 片）** | ✔ 已核实 | 两条 note 里的「局部编辑接口 / 显式半边环·扇及编辑接口待补」**全是过期项**：`trigraph-edit-c08.js`（addTracked 边差分 / removeVertex 星形环耳切+Lawson / moveVertex 回滚）与 `halfedge.js`（next/prev/twin + boundaryLoops + vertexFan + splitQuads）都在，缺的是页面运行验收 → 补 `halfedge-c08.html`「切四边形」入口 + `tests/trigraph-c08-browser.cjs` / `tests/halfedge-c08-browser.cjs`，两条并 done | 1.33 |
| 16 | [054] | 网格/拓扑/生成 | `1670790425232175108`(done), `1669315384619540487`(done) | 续项 | **✔ 已收口（第 121 轮 · 2/2 片）** | ✔ 已核实 | 两条都是「机制在、只缺运行验收」：1670 的纯六边/方/三角岛在 `grid-kinds-c08.js` + `app.js?grid=` 挂钩里（`tests/grid-kinds-hex-island-browser.cjs`：每格 6/4/3 边、顶点 3/4/6 格共用、V−E+F=1、格线段/陆地格 8.284/4.126/2.821）；1669 的「每种子都出好岛」在 `island-quality-c09.js` + `islands-c09.html`（`tests/island-quality-consistent-browser.cjs`：连播 4 座全 cool、关体检 2/8 不合格、四阶段换画面）；组内已无 partial | 1.33 |
| 17 | [055] | 网格/拓扑/生成 | `1579478470098243584`(done), `1579474420749725696`(partial) | 续项 | **✔ 部分收口（第 122 轮 · 1/2 片）** | ✔ 已核实 | 1579「cage deformation」的 note 挂了几十轮「完整原cage/3D碰撞仍缺」，核实是过期账：`cage-c09.js` 的 `cageWallPoint/cageSlice/insideCage/cageCollider` r56 C09-D 就落了（文件头署本片 ID），但只有 node 测试、`cage.html` 提示语还写着「未实现」→ 补「笼碰撞探针」入口 + `tests/cage-deform-browser.cjs`，片转 done；仍剩 `1579474420749725696` 的完整坡面/模块联合生成（原片算法未公开，C，不排期） | 1.33 |
| 18 | [056] | 建筑/模块 | `806904557502464000`(done), `802496920790777856`(done), `803190517534248960`(ref), `806856212260278272`(ref) | 续项 | **✔ 已收口（第 123 轮 · 2/2 partial 片）** | ✔ 已核实 | 两条 note 同句「楔石/完整桥构仍缺」**全是过期账**：`canal-bridge-r56.js`（文件头署本片 ID）的桥台/拱上三角墙/压顶/`archVoussoirs` 楔石环+键石/拱腹 r56 就落码，`buildings.js:117` 接管该面基座；穿楼拱洞走 `underside()`+`archFloorBudget`（任意塔基 crown=base−slab）。缺的只是运行验收 → `openings-r56.html` 补 `r56bridgeProbe`（数真实三角 + 射线），新测 `tests/canal-bridge-keystone-browser.cjs`：每面 9 块楔石（16 浅色三角+键石 2 三角）、键石 s=0.478、拱下首交 0.75–1.81 vs 压顶下 0.348、关开关 ringTotal 0 / 首交 0.3327、像素 A/B 61480px 噪声 0；fusion 3 座拱落在 base 1.5/2.5 两个塔基、crown=base−0.05（<1e-9）、6 面 54 块楔石每面 1 键石 | 1.33 |

> 表外收口：GI 续项组（`1580845127207387137` / `1580846877855338497` / `1580835075629133825`）不在 TOP 18 内。
> 第 136 轮把 `1580846877855338497`（慢放反弹序列）**✔ 已收口 → done**（证据 `artifacts/coverage/1580846877855338497-review-r136.md`，新测 `tests/megatexture-bounce-browser.cjs`）；
> 第 137 轮把 `1580845127207387137`（三张图：SDF-UV / 六向光体积 / 被照亮的 mega texture）**✔ 已收口 → done**
> （证据 `artifacts/coverage/1580845127207387137-review-r137.md`，新测 `tests/megatexture-six-directional.mjs` + `tests/directional-volume-mega-browser.cjs`）——
> 旧 note 的「反弹反馈仍使用平均 RGB」核实为**过期账**（那是旧页 `lightvolume.js` 的口径，本片落的 `megatexture-gi.js` 一直逐命中读纹素）；
> 故本组记为「2 done + 1 C」（`1580835075629133825` 卡 2.5D 形因子口径，定案 C 不排期）。

> 表外收口（沿河导航组）：`1795831296952041691`（598 帧·沿河更快）**✔ 已收口（第 139 轮）→ done** ——
> 旧 note 的「原球面 / 复杂汇流与完整接口仍缺」= 过期账（第 18 次同型）：`metric=弦长` + `riverNetwork.parent`/`riverFlow.flowTo` + `findNavPath`/`riverRouteStats`/`simplifyNav` 全在，
> 缺的只是球面页面上的运行断言 → 新测 `tests/river-nav-sphere-browser.cjs`（391/391、398/398 河格边全判顺流、0 中性 0 上坡顺流、汇流支流 58/58 与 62/62 全部汇入更便宜、
> 主干顺流 0.725 < 逆流 1.090 < 沿路步行 2.533、speedup ×3.49 / ×3.33、detour 0.524 / 0.456、平床 352 对价格比精确 0.3/0.65）。
> 证据 `artifacts/coverage/1795831296952041691-review-r139.md`。

> 表外收口（frontier-candidates 续项组 · 单条自成一组）：`1582293326815862786`（434 帧·只在坍缩边缘评估候选 → 增量放置 → 简化导航图扩展并互连）
> **✔ 已收口（第 141 轮）→ done** —— 旧 note 的「尚未实现增量生成与简化导航互连」= 过期账（第 20 次同型）：
> `src/core/frontier-candidates.js` 的 `expandFrontier()`（文件头署本片 ID）一直是「只对最后放置格的邻居重算候选 + 最小候选优先 + 前向一步校验 + 可走共享边压进 `nav` + 并查集报互连点」，
> 页面却只接了只读 `frontierCandidates` 探针（提示语还写「不是完整导航生成」）→ 本轮补 `wfc.html` 的 `#expand`/回放/导航图视图/`window.frontierExpand`，
> 并给模块加默认关闭的 `twoFronts`（两粒种子轮流推进 = 原片两条锋面同时长）。新测 `tests/frontier-expand-browser.cjs`：
> 混合 147 格/放置 145/死格 0、每步只看 **17.24** 格 vs 剩余 **73** 格、每格候选 **3.72/24**、导航边 **236**、两锋面 37/37 → 互连于第 **133** 步；
> 四边 206/204/0、导航 388、互连 191；逐步只读回放 8 档候选数逐位复现；像素黄 447→23972 单调增、绿 699→10526→**0**（并入）。
> 反向对照：关 `twoFronts` 时 50% 处两组 **73/1**、绿线像素 **0**、互连点 116 → 「两条锋面」由推进顺序决定，不是配色。证据 `artifacts/coverage/1582293326815862786-review-r141.md`。

> 表外收口（拓扑续项组）：`1384958097542819845`（679 帧·拓扑直线 / 手柄 / 连刷）**✔ 已收口（第 147 轮）→ done** ——
> 旧 note 的「游戏手柄/连刷仍未接入」= 过期账（第 26 次同型）：`src/ui/game-ui-c06.js` 早就有 `straightLineThrough`/`stepCursor`/`paintLine`/指针连刷/`navigator.getGamepads` 轮询（`padPrev` 去抖），
> 缺的只是主场景浏览器验收；本轮另补三处真形制差（线由虚线改**实线**、补**历史轨迹层**最多 5 条以对上原片一屏 4–5 条、对象命名 + `clearTraces()`）。
> 新测 `tests/topoline-pad-drag-browser.cjs`：闭环 46 格末点回起点出口边中点 gap 0、**对边穿出 89732 对违例 0**、折线转角 p50 8.2°/p90 21.8°、多线 9→5、
> 像素开/关差 3545px 噪声 0、合成手柄上/下/换边与 A 去抖（按住 1.3s 只 1 次、+189 格）、真指针拖动连刷 +841 格且撤销 8 步回基线。
> 同组 `1147881669350891521` 早已 done → **该组已清，无剩余**。证据 `artifacts/coverage/1384958097542819845-review-r147.md`。

> 表外收口（mesh merger / merge-bench 单条自成一组）：`1401145625572425728`（349 帧·"meshes are kept small … wrote a mesh merger … tripling the rendering speed"）
> **✔ 已收口（第 148 轮）→ done** —— 旧 note 的「【卡点·E 环境不具备】」是**假标签**（r146/r147 已两次证明这类标签多为缺入口/缺响应头）：
> 机制 `src/tools/merge-bench-c06.js#splitGeometry/benchMerge`（文件头署本片 ID）+ node 测试 `tests/merge-bench-c06.mjs` 从 r56 就在，
> 但 **`benchMerge` 全仓零页面引用**（`grep -n "benchMerge" *.html` 无命中），`save-mesh.html` 只有「测量主体提交」一个按钮（只报合并后 1 次提交，没有小网格对照）。
> 本轮补：① 页面 `#bench`「合并对照」按钮 —— 小网格 vs 合并的提交次数、逐帧耗时、整片重建耗时一次吐出（`window.saveMesh.bench`）；
> ② 新模块 `src/tools/mesh-wire-overlay.js` —— 片 0036–0078 的线框是「白线**叠在着色面上**」，而 `view.setDebug('wire')` 是 `material.wireframe`（把面挖空），形制不同，故按 `WireframeGeometry` 边叠一层 `LineSegments`。
> 新测 `tests/merge-bench-browser.cjs`：mixed 17224 三角/35 块 **270 次提交 → 1**（270×）、quad 21092 三角/36 块 **330 → 1**（330×）、三角逐数一致；
> 8×8 视口 1.05–1.07×、全视口 0.99–1.01×（填充主导，**不复现三倍**）；6 点扫描得**边际成本 5.1–6.4 µs/提交**；整片重建 59–72ms；
> 线框叠加 34392 段（2.0×三角，共享边去重）、开/关差 8718/9065px、关掉回位 0；0 console error。回归 `merge-bench-c06.mjs` / `save-mesh-browser.cjs` PASS。
> 证据 `artifacts/coverage/1401145625572425728-review-r148.md`。该条自成一组，**无剩余**。

> 表外收口（边境四步 / campaign 墨层 · 单条自成一组）：`1097458505315946496`（14 帧·"Triangulate (with some added padding) → Walk on triangle edges → Bezier sample → Tessellate the fields on either side"）
> **✔ 已收口（第 149 轮）→ done** —— 旧 note 的「两侧细分未实现」= 过期账（第 28 次同型）：`src/core/frontier.js#frontierFields`（padding 矩形被 path 切成 below/above → ear-clip → 每岛按侧分带）
> 与 `buildFrontiers`（多条前线 + 交叉报错）r55 G3 就落码，node 测试一直绿；真缺口是**第 5 步的墨**（片中终帧的地名 / 小数字 / 航路箭头 / 墨色虚线多条前线 / 场内波纹）本仓一条都没有。
> 本轮补 `src/campaign/map-ink.js`（`islandName` 按 id 索引 38×20 组合、`drawPlaceNames`、`drawStageMarks`、`drawRouteArrows`、`drawFrontierInk`、
> `drawFieldPattern`）+ `frontier-overlay.js` 两个可选参数（`palette` 低饱和海色、`curves` 交给墨层画虚线）+ `campaign.html` 的 `?ink=0` A/B。
> 新测 `tests/frontier-fields-campaign-browser.cjs`：3 条前线 3/3、交叉 0、面积误差 0/0/2.34e-16、分带 0:34 1:21 2:48 3:31（和 == 134）、
> 每带三角 == 采样点数（732 总）；地名 45==已用岛、箭头 63==航路边、阶段号 25==主路；地名锚点差分 784/518/1071 px、箭头 217 px、前线数字 282 px；
> 墨层 A/B **47887 px**、两侧场 A/B **208654 px**、同 URL 重载噪声 **0**、四带重心色差 **11.71**；0 console error。
> 证据 `artifacts/coverage/1097458505315946496-review-r149.md`。该条自成一组，**无剩余**。

> 表外收口（草丛反差描边 · 单条自成一组）：`1590674061092212738`（181 帧·"In the vertex shader, my grass gets to sample that contrast texture both where they stand,
> and also raycast into the background. The outline strength is determined by the difference between these two samples"）
> **✔ 已收口（第 150 轮）→ done** —— 旧 note 的「只静态邻崖距离 aEdge、未实现该 GPU 采样/背景射线」= 过期账（第 29 次同型）：
> `src/world/view-c11-grassline.js`（文件头署本片 ID，`vEdge = glOutline(origin, TH*scale*.8)`）+ `src/core/c11-maps.js#bakeContrastHeightMap`
> / `grassOutlineStrength`（GLSL 与 JS 孪生同口径）+ `?c11=grassline` 入口 + `tests/c11-grass-shrub.mjs` 从 r56 就在，**缺的只是页面运行验收**。
> 新测 `tests/grassline-contrast-browser.cjs`：4491 丛草卡、强度 p50 0.0122 / p90 1.0（>0.5 有 1684 丛、<0.08 有 2525 丛）；
> 与静态 `aEdge` 判定不一致 **43.0%**；绕 target 转 180° 有 **63.6%** 的卡强度变化 >0.2（相邻 45° 中位 0、p90 0.91 = 局部的、不闪）；
> **单卡隔离渲染 48 丛 GPU 回读 vs JS 孪生最大差 0.003**；描边 A/B（`aEdge=1` 但两采样同色，vEdge 0.001）轮廓环暗占比 **0.855→0.575**、环亮度 51.7→77.6；
> B（`aEdge=0` 但背景差大，vEdge 0.998）墨像素 **438→593（+35%）**、环亮度 47.8→42.2；同状态噪声 0、0 console error。
> 证据 `artifacts/coverage/1590674061092212738-review-r150.md`。该条自成一组，**无剩余**。

> 表外收口（软坡续作 · 单条自成一组）：`1447488323845509121`（656 帧·"Properly combine seamless soft slopes with distinct sharp cliffs /
> Erosion valid terrain with no local minimums / Get the best of both square tiles and triangular tiles"）
> **✔ 已收口（第 151 轮）→ done** —— 旧 note 的「【卡点·C 算法未公开】现有 XZ 层级形变不等于完整连续坡面/排水算法」= 过期账（第 30 次同型）：
> `src/terrain/soft-tops.js#softCorners`（文件头署本片 ID）+ `src/terrain/terrainmesh.js:60` 的 `altered()`（两角焊死则整条墙不画、只焊一角把墙拉成梯形）
> + `src/world/terrace-edges.js#seamless` + `src/terrain/generate.js#slopeMask/limitSoftSlopes` + `src/core/depression-fill.js#erodeHeights`
> + `src/terrain/drainage.js#fillTerrainDepressions` 全部 r55 就位，5 支 node 测试一直绿，**缺的只是页面运行验收与量具**。
> 本轮只加只读探针（`terrain-r55.html` 的 `__r55.soft/walls/water`）。同一 World 只切 `tops=0/1`：
> mixed 缓坡台阶 163 条焊死 135（82.8%）、1 层墙 350→250（−100 == seamless 100）、**≥2 层崖墙 157/39/17 三档一字不差**、`cliffHorizontal 0`、
> 台地线 547→447、斜面 0→24.9 m²、像素 A/B 21332 px 噪声 0；quad 210 条焊死 205（97.6%）、1 层墙 470→284、崖墙 215/47/28 不变；
> 方/三角同岛 `{3:1142, 4:881}` 且四种格型配对都有焊死；侵蚀 lowered 165、局部低洼 2→0→0、drained 1.0。
> 证据 `artifacts/coverage/1447488323845509121-review-r151.md`。该条自成一组，**无剩余**。

> 表外收口（悬挑续作 · 单条自成一组）：`1671808851895627776`（303 帧·"If your terrain generator supports overhangs you gotta flaunt it"）
> **✔ 已收口（第 152 轮）→ done** —— 旧 note 的「【卡点·A 机制未做】原版软坡/侵蚀有效生成与完整接口待补」= 过期账（第 31 次同型）：
> `src/terrain/generate.js#softSlopes/drainage` + `src/terrain/soft-tops.js#softCorners` + `src/core/depression-fill.js#erodeHeights`
> + `src/terrain/drainage.js#fillTerrainDepressions` 全在 r55，`tests/soft-slopes-overhang.mjs` 一直把「软坡 + 侵蚀 0 局部极小 + 悬挑 measure」一起跑；
> 岩檐本身由 `terrainmesh` 画朝下底面、`rock-topology.js#measureOverhang` 数洞内空气，**`measureOverhang` 自 r55 起零页面引用**、浏览器验收只数
> 「y=2 处 6 个朝下顶点」——缺的是「这些面真的在画面里、真的是暗的、空洞真的透气」。
> 本轮补：`overhang.html` 加 `#nocap`（去檐像素 A/B）+ `window.__overhangProbe()`（朝下面三角投影/遮挡、空洞三层水平射线、柱剖面）+ `#status` 出 `measureOverhang` 四项；
> 并把夹具从「四周邻格也填到 5 层」改成「单柱 + 单格外伸帽檐」（旧「低机位仍受视角遮挡」的真因就是帽檐被埋在同高度台面里）。
> 新测 `tests/overhang-soffit-browser.cjs`：mixed/quad 朝下面 2 片**入画 2 / 未遮挡 2**、柱剖面 `RR .R .R .R RR`（3 层空气）、
> 檐下投影框 **P10 36/38 vs 去檐后 101/95**、暗像素占比 **1.000/0.915 vs 0**、整帧 A/B **8583/15732 px**、同状态噪声 **0**、
> 空洞 2/3/4 层射线**全穿空气并打到岩柱内壁**（余量 0.14–0.21 m）、薄檐 `#skinny` guard 开/关/格状参照 **0.2413/0.1391/0.3436**（quad 0.1603/0.0453/0.2032）。
> 回归 `mirror-rock.mjs`、`soft-slopes-overhang.mjs`、`mirror-overhang-browser.cjs`、`soft-tops-collide-r55.mjs`（overhangWalls 27）全 PASS。
> 证据 `artifacts/coverage/1671808851895627776-review-r152.md`。该条自成一组，**无剩余**（如实口径见证据末节）。

> 表外收口（环绕相机运动模糊拖影 · 单条自成一组）：`1727315611959865407`（337 帧·"I've shipped two whole games with orbital cameras and not once have I previously
> though about adding motion blur smear. What a fool I am."）**✔ 已收口（第 153 轮）→ done** ——
> 旧 note 的「方向性轮廓拖抹 / 速度场与全指标接口仍待补」「【卡点·C 算法未公开】」= 过期账（第 32 次同型）：
> `src/world/view-post-extras.js` 的 `?fx=smear`（`orbitSmearAt`：v = ω×(p−c)·dt、6 次三角权重、圆心取 target 投影）+ `screenOmegaDt`（ω·sin俯角·固定快门 1/60）
> 与 CPU 孪生 `src/core/camera-motion.js#smearImage/orbitVelocity/smearLengthPx` 全在，`tests/view-post-extras.mjs` 一直验证 GLSL==CPU 逐像素，**缺的只是页面运行验收**。
> 本轮还查出并修掉一个真缺陷：拖影合成通道同时带 `tonemapping_fragment` + `colorspace_fragment`，而场景渲进 `smearRT` 时 TONE_MAPPING 已生效一次 → 开拖影整帧被二次 ACES 提亮
> （`omegaDt=0` 时全屏亮度 130.14→143.75、平色样本 +13 级）；并补 `stats.smear` 的 `screenOmega/shutter/taps/maxPx`。
> 新测 `tests/orbit-smear-browser.cjs`：同机位开/关 A/B（冻结动画）lap95 **34.49→9.64（−72%）**、0.5×/1×/2× = 13.15/9.64/9.84（2× 已在 maxPx 24 截断）、
> 各向异性 左 1.017→0.749 / 右 1.381→0.890（左右带切向≈竖直）、中部 1.216→1.280（切向≈水平，不降）、岛内 0–0.15R 差分 10.00 < 0.15–0.3R 12.98、
> `outerPx = |omegaDt|·min(w,h)/2` 实测 4.26/8.52/17.04、同机位 omegaDt=0 恒等 4.04（MSAA 解析差）/ 再渲一帧 0 / 关掉回位 0、实时 `?spin=6` outerPx 23.24、0 console error。
> 证据 `artifacts/coverage/1727315611959865407-review-r153.md`，截图 `orbit-smear-{off,on}-r153.png`（均 ViewImage 看过）。该条自成一组，**无剩余**。

> 表外收口（球面岸缘贴图「Texture test!」· 单条自成一组）：`1783792917183606829`（242 帧·"Texture test!"）
> **✔ 已收口（第 154 轮）→ done** —— 旧 note 的「3D 纹理 / 岸缘混合未实现验收」+「【卡点·C 算法未公开】」= 过期账（第 33 次同型）：
> `src/sphere/worldmap-shore.js`（文件头署本片 ID）就是原片近景那三件事 —— `shoreDistance` 球面度量有向距离场（经向 ×cos(lat)、双向 chamfer、经度回绕）
> + `worldMapShoreColors`（陆侧 rim 暗带 / 3 道平行 wave / 海湾 sand 月牙 / grass·grass2 两色草）；`worldmap.js` 的 `buildWorldMap` 按 **3D 单位方向**采 fbm3
> （`mode:'uv'` 是仓内自带 2D 反例），`attachWorldMap` 按片元方向查表 → 极点不撕裂、经度无接缝。页面入口 `planet.html?map=1&stage=maptest&shore=1` 早就在，
> **缺的只是运行验收**。本轮真修 1 处：`worldMapTexture` 的 DataTexture 漏标 `colorSpace`（r160 默认线性 + 输出 sRGB → 整颗星球被提亮一次，海灰蓝草粉绿），
> 补 `SRGBColorSpace` 后渲染色回到色板作者值。新测 `tests/worldmap-shore-browser.cjs`：浪线三簇 **0.0213/0.0438/0.0633 rad**（=1×/2×/3×gap，幅度 24.89→12.83→4.81）、
> 暗带谷 **0.0131 < rim 0.035** 深 **57.1 级**、沙滩只占 **25.9%** 岸线且离岸 ≤0.03、两色草双峰 **171/194**、极点行 std **0** vs 赤道 **26.43**（`mode:'uv'` 反向 34.72 vs 13.24）、
> 屏幕 A/B 宽景 **128756 px**（陆侧 −25.5~−41.1、海侧 +8.4/+3.9/+4.8）、近景 **272202 px** 且浪线峰 **5/15/26/32 px**、噪声 **0**、0 error。
> 回归 `worldmap-shore.mjs` / `planet-assembly-browser.cjs` PASS。证据 `artifacts/coverage/1783792917183606829-review-r154.md`。该条自成一组，**无剩余**。

> 表外收口（矩形树续项组 · 2 条一并 done）：`1765115069837221962`（247 帧·"visualizing the recursive tree parsing as it adds new rects…
> when the board is more fragmented the arm tends to have more fingers"）+ `1765041830461055127`（558 帧·"Now supports removing rects too…
> Still packs tight though!"）**✔ 已收口（第 155 轮 · 2/2 片全 done）** ——
> 旧 note 的「原 3D 树 / 跨叶候选待补」「跨叶放置及完整 RectBin 接口仍缺」= 过期账（第 34、35 次同型）：
> `src/core/atlas.js`（文件头署这两片 ID）的 `allocateAt`（跨叶放置，`#handles` 记住一次槽对应的多片叶）+ `recursiveFill` +
> `src/core/atlas-c09.js` 的 `armFromTrace`（父中心→子中心直角折线 + 指尖）/ `placeBottomLeft` / `treeLayers` / `project3D` 全在，
> 页面 `atlas-tree-c09.html` 早就有 2D 手臂与 3D 展开两态，**缺的只是页面运行验收**。
> 新测 `tests/atlas-tree-arm-browser.cjs`：150 步逐步断言 `arm.fingers == trace 里 free+used 叶数`、`pruned == outside 数`、parent 递增、段全轴对齐；
> 「板子越碎手指越多」实测早 20 次 **1.00 手指 / 11.5 空闲叶 / 12.75 候选** → 末 20 次 **2.40 / 32.75 / 379.2**（29.7×）；
> 跨叶槽 **71/150**（最多吃掉 6 片叶，逐槽面积精确）、旧槽零移动；3D 展开 243 节点 **27 层**（根在最上、`project3D` 对 z 单调）；`arm=0` 青色像素 1286→0 且同一块板。
> 新测 `tests/atlas-remove-frag-browser.cjs`：删 25/加 35 的混合段后 `freeLeaves` 33→64、小孔 1→24；纯删 30 块后 `freeLeaves` **118**、小孔 **45**、
> 最大空闲块只占空闲面积 **2.33%**、画面空白 0.382→0.425；碎了再加 40 块 **40/40 全进**、占用 53.8%→**71.4%**；
> 只在两子全空时向上合并（2→2→1、非兄弟连锁 **3→3→2→1**、`freeArea` 4096）；重复/伪造/跨实例释放 `[true,false]/false/false` 且存活块逐字不动。
> 回归 `atlas.mjs` / `atlas-crossleaf.mjs` / `atlas-browser.cjs` 全 PASS。证据 `artifacts/coverage/1765115069837221962-review-r155.md`、`1765041830461055127-review-r155.md`。
> 该组 **2/2 片全 done，无剩余**。

> 表外收口（patch 续作 · 单条自成一组）：`1781405550061687016`（219 帧·"I've got seamless patch blending! Some of the patches are projected
> (like the grass and the water) and some are manually UV-mapped (like the shoreline)"）**✔ 已收口（第 156 轮）→ done** ——
> 旧 note 的「投射/手工UV与 atlas/接缝指标接口尚未迁移」「【卡点·A 机制未做】」= 过期账（第 36 次同型）：
> `src/terrain/patch-blend.js`（文件头署本片 ID）早就是 `buildPatchField`（SD 有符号距离 / U 沿岸弧长 / loop / ground 栅格）
> + `makePatches`（water/land = `project`，shore = `uv`）+ `renderPatches`（hard/alpha/height 三种合成）+ `seamStats/edgeJump/abModes`，
> 且 `src/world/view-shading.js` 的 `?shade=patchblend` 早把 `shPatchBlend/shShore` 接进 View 主材质 —— **缺的只是页面入口与运行验收**。
> 本轮另补两处真形制差（片里图集一眼可数）：① 岸带**白浪线**一条都没有 → 模块与 GLSL 各补两道与岸平行的白线（v .34/.58）；
> ② 白点原来是**竖条**（只按 u 判、v 整带染色）→ 改 `hypot(du·spacing,(v−.16)·.9) < .075` 的圆点。
> 新页 `patch-blend.html`：整岛三种合成切换 + 世界空间近景窗 + **岸带 UV 展开条**（横 u 纵 v，即原片那扇 `Planet.psd @175%` 窗展示的图集）。
> 新测 `tests/patch-blend-browser.cjs`：白点 16 颗间距 **0.400–0.405**、UV 条像素读数**白浪线 2 道**（中心 v .58/.34）+ 白点行 21 颗、
> **跨格边差分 p95 0.1336 vs 同格 0.1184**（无 per-cell 硬缝）、jump **hard 0.2543 → height 0.094**（alpha 0.0198）、细节 100%/61%/76%、
> `softMeanPx` 0→1.5、covHist 1/2/3 = 13207/3713/0；实景 `?shade=patchblend` 开/关 **24919 px**、噪声 **0**、开档噪声 **0**、回位 **0**。
> 回归 `patch-blend.mjs` / `surface-pattern.mjs` PASS。证据 `artifacts/coverage/1781405550061687016-review-r156.md`。
> 如实口径：场景只画**陆侧半幅**岸带（水侧由水面片承担），世界空间岸带仅 9 纹素宽 → 实景读作断续小斑；本仓 World XZ 投影、原片球面 UV；纹理为程序化替身。该条自成一组，**无剩余**。

> 表外收口（squad-footprint 单条自成一组）：`883447205176238083`（654 帧·无原文；选中队伍脚下的浅色线网 / 旗顶白菱形 / 箭矢细白轨迹线）
> **✔ 已收口（第 157 轮）→ done** —— 旧 note 的四条缺口本轮**逐条核实后都是真的**（少见的不是过期账）：
> ① 线网原来只在 `src/badnorth/squad-footprint.js` 里做**凸包**，L 形占位把凹口一刀切掉，主战场还用 32 段圆环 `this.ring`；
> ② 模块**零页面/主场景引用**（`grep -n footprint src/badnorth/battle.js` 无命中），也没贴 `world.top`；
> ③ 旗顶白菱形没有；④ 箭只有小箭头没有轨迹线（血泊溢出下一层是过期账：r54 `#bleedWall`/`#bleedAtFoot` 早就在）。
> 本轮：`unionOutline`（真实格多边形并集边界，共享边按邻格占用抵消）+ `earClip` + `footprintBoundary`（主战场用）+ `cellOutline`/`footprintCells`（整数格，实验页用）；
> `battle.js` 补 `#updateFootprint()`（实占格去重 → 轮廓/辐条/角标 LineSegments，逐顶点 `#groundY+0.03`）+ `?footprint=0` 关档 + `footprintStats` 探针；
> `#flag()` 补白色菱形（lift 0.74、每帧 copy 相机四元数）；`#shoot()` 给每支箭配 0.62 不透明度近白 `Line` 轨迹（落定即收，随 mesh 一起清理）。
> 新测 `tests/squad-footprint-cells.mjs`（矩形/L/U/环形 + 耳切 + 多岛）、`tests/squad-footprint-battle-browser.cjs`（17 项）、`squad-hud-browser.cjs` 口径改格边界（16 项）；
> 读数：3 格 L 面积 **0.538 < 凸包 0.695**（凹口 0.157）、面积 == 格面积和、贴地偏差 **2.9e-8 m**、开/关整帧差分 **1100 px**（包围盒占屏 8.3%）、回位噪声 **0**、
> 菱形 lift 0.74 / 相机点积 **1.0**、箭轨迹飞行生长 **0.0927** 落定收掉、`?footprint=0` 关档后目标圈仍在。该条自成一组，**无剩余**。

> 表外收口（烧屋火光续作 · 单条自成一组）：`837027901853810688`（514 帧·无原文，2018 badnorth 战斗特效 GIF）
> **✔ 已收口（第 162 轮）→ done** —— 旧 note 只剩一项「爆燃三层高度在曲线上测不到」，本轮核实**是真缺口**（不是过期账）：
> 机制（`FIRE_COUPLING.burst.layers` = base/shaft/roll 三组、`smoke.js#burstPuff()` 逐组吐卡）r90–r91 就落码，
> 但点火当刻只有 `burstStats.layers`/`burstY` 两个**静态快照**，两条联合曲线（`stain-joint` / `smoke-fire-joint`）都只数整屏像素 → 分层上不了时间轴。
> 本轮补 **`smoke.tierStats()`**（只读探针：逐帧给三组世界高度 `yMin/yMax/yMean`、卡片数、组间净空、整体 span）+ 新测
> `tests/fire-burst-tiers-browser.cjs`（12 点曲线）：0.18s 净空 **+0.4089 / +0.3148**、各组卡片 **7/5/4**、
> 0.18→0.39s 各组 `yMax` 增量 **+0.0588/+0.0670/+0.0910**（顶层 1.55× 底层）、点火后 **12/12 档都能读到 3 组**；
> 画面后果：分层版烟团上沿 168→**134**→123px，单层对照（`layers:null`，同种子同相机）只 −19px 且只有 1 层。
> 回归 `fire-coupling.mjs` / `fire-coupling-browser.cjs` / `stain-joint-curve-browser.cjs` 13/13 / `battle-c01.mjs` / `smoke-fire-joint-curve-browser.cjs` 12/12 全 PASS。
> 如实口径：三组在**世界高度**上分离，画面上仍是连续一团（与原片 0084「一团、内部亮心分开」同形），不声称能数出三个独立团。
> 证据 `artifacts/coverage/837027901853810688-review-r162.md`。该条自成一组，**无剩余**。

> 表外收口（任意凹轮廓拼进地形 · 单条自成一组）：`1584623053061099520`（453 帧·"I wrote a thing to splice houses into the terrain …
> the yellow lines are rotating around the verts"）**✔ 已收口（第 163 轮）→ done** ——
> 旧 note 的「任意轮廓插入 / 地形周边重新网格化仍缺」+「【卡点·A 机制未做】」= 过期账（第 39 次同型）：
> `src/build/splice-polygon-c09.js#spliceFootprint`（文件头署本片 ID）r56 就是「受影响三角外扩到单环 → 带洞桥接 + 耳切不丢共线点 + 约束 Lawson」，
> `prepareFootprintSplices` 落到真实地形顶面扇形、`terrainmesh.js:105/230/314` 三处挂钩齐，node 测试 `tests/c09-terrain-c.mjs` 一直绿，
> 页面 `splice-c09.html` 早在 —— 缺的只是从没跑过页面。新测 `tests/splice-polygon-c09-browser.cjs`（mixed/quad + 实体 A/B）：
> 面积账 1.11e-15 / 6.66e-16、半边问题拼接前后 1==1 与 0==0、边界环 = 底 + 1 个占地洞（3=2+1 / 2=1+1）、Euler 0、
> 占地 6 点 1 凹口横跨 **14/17 格**、半边扇 164/162 步且内点扇角合 **360°**、房子 12 屋顶三角 + 6 面墙、
> 实体中心裁切屋顶色 **75821 vs 7482 px**、墙色 **8075 vs 0 px**（关档那块是草/沙）。
> 页面只补 `?on=0` / `__c09ctr` / 24 字段探针，渲染一行未改。如实口径：最小角 0.68°（约束边上的薄三角、肉眼不可见）；
> 房子是直骨架四坡顶替身，原片多段屋顶/烟囱属预建 tile。证据 `artifacts/coverage/1584623053061099520-review-r163.md`。该条自成一组，**无剩余**。

> 表外收口（mixed perspective 单条自成一组）：`1310503825510367232`（200 帧·"Note how houses further away are smaller,
> yet the vertical lines stay straight and parallel"）**✔ 已收口（第 171 轮）→ done** ——
> 旧 note 的「主视图 view.js 未接（k=0 默认）、pick/倒影相机矩阵未同步」= 过期账（第 46 次同型）：
> `src/core/mixed-perspective.js#withVerticalParallel`（w 行世界 y 系数按 k 衰减 + `projectionForRenderer` 折回 P'=M'·V⁻¹）
> 与 `src/world/view-mixed-persp.js`（换 `camera.updateProjectionMatrix`、改深度行、`fixRay` 反投影重设拾取射线）
> 早接 `index.html?mixedPersp=`（`view.js:311` + `pick` 前 `view.js:1270`），倒影是同相机下 `scale.y=-1` 的镜像网格自动同步，
> **缺的只是主场景运行验收**。新测 `tests/mixed-persp-main-browser.cjs`（18 项全 ok）：
> k=1 时 12 根真实世界竖柱屏幕横移 **5.6e−14 px**（k=0 对照 max **27.66 px**、11/12 根 >1px）、
> 同 1 层高柱在 4 段距离 **40.6→37.87→34.43→30.96 px** 逐段变小（−23.7%，k=0 同向 −10%）、
> 镜像竖线横移 **0**、拾取 **24/24** 命中实心格且命中自身 k=1 **14/24** = k=0 **14/24**（未掉档）、
> `fixRay` 关档后同一批 NDC **24/24** 改判、像素 k0→k1 差分 **53256/172800**（严格 44420）噪声 **0/0**、
> 不带参数页 `mixedPersp === null` 且竖线横移 **27.659** 与 k=0 档逐位相同。另把 `fixRay` 起点从「z=−1 反投影点」
> （实测离眼点 **8.36** 世界单位，可能落在近处柱内）改成「线上离相机最近点」（0.10），本夹具 **diff 0**，属消除隐患的稳健性修补。
> 如实口径：原版 Unity 自定义投影 + 镜头移轴的逐像素对齐不可证（片内只有一种投影、无对照帧），
> k=1 时自动取景（按原生投影算）会让岛底略出画 —— 混合投影的必然后果，不改取景。
> 证据 `artifacts/coverage/1310503825510367232-review-r171.md`。该条自成一组，**无剩余**。

> 表外收口（笔触图集 / 受控跨崖渗漏 · 组内 2 条一并 done）：`1696896119794479541`（550 帧·"Look how neat and controlled the grass blotches bleed over the cliff edges."）
> + `1696864977171189980`（502 帧·"…much bigger blotches without the blotches bleeding across and messing up important edges."）
> **✔ 已收口（第 172 轮 · 2/2 片全 done）** —— r169/r170 两轮一直卡在「等深带读不出」，本轮查明**不是夹具的锅，是着色器**：
> `BLOTCH_RIM_GLSL` 的 `bleedMask` 少了「bleed>0」闸门 —— `smoothstep(x, x*.35, below)` 在 bleed=0 时退化成 `smoothstep(0,0,below)`
> （`e1−e0=0` 除零区间，GPU 钳成 1）→ **bleed=0 在 GPU 上等于「无限深」**，与 CPU 的 `bleed>0 ? … : 0` 正好相反；
> 这一个缺陷同时解释了 r170 的两个怪现象（「bleed=0 仍在给崖面上色」与「bleed=0 与 bleed=20 逐像素相同」）。
> 修法：`…*step(1e-4, uBlotchRimQ.x)`；`tests/blotch-atlas.mjs` 加一条 GLSL 文本断言防回归。
> 夹具另修三处口径：① 探针从「格心→下格 0.85（rimDist≈0.15 > 0.10 收边窗）」挪到扫描出的崖肩线（rimDist 0）；
> ② `readRenderTargetPixels` 第 0 行在**下**（`H−1−py`）；③ NDC `y=+1` 在屏幕**顶部**（`py=(0.5−v.y*0.5)*H`）—— r170 的 wallBand 全 0 就是 ②③ 叠加。
> 读数：**bleed=0 全深归零**；.14 等深带 **0.10 世界米**（CPU 解析式 0.125，.18 以下 `drop<0.015`）、.30 → **0.20**（2.0×，.30 以下归零）；
> 逐态 uniform 回读 `[0→0]`/`[0→0.14]`/`[0→0.30]` 全对（排除「参数没落位」）；主场景 0→.14 **2110 px**、0→20 **68780 px**、strength 归零 **3301 px**、噪声 **0**；
> 近景 1430/7748 px 噪声 0；顶面着色 **10.0%**、`?scale .09→.045` 扫描线色块边界 **6→0**、舌头 **26728 px**；图集关/开 3444 px。
> 如实口径：真实地形上 0.14 世界单位在 480×360 全景里约 2px，逐点采样读不出可信带宽（测试里只作读数、记 `closeNote`、不进断言）；
> 等深带的世界米读数由「合成崖肩窄条（真 uniform + 真距离场 + CPU 孪生对照）」给出，真实地形用整帧阶梯与近景 A/B 作证；原片配色/反射未对，图集为程序化替身。
> 证据 `artifacts/coverage/1696896119794479541-review-r172.md`、`1696864977171189980-review-r172.md`。该组 **2/2 片全 done，无剩余**。

> 表外收口（移动路线预览 · 单条自成一组）：`995043346778415104`（386 帧·"The pathfinding in some levels does get a bit convoluted"）
> **✔ 已收口（第 175 轮）→ done** —— 旧 note 的「`battle.js #drawPath` 尚未接入」「预览仍是 2.5s 淡出的一次性点串」= 过期账（第 51 次同型）：
> `src/core/route-preview.js`（文件头署本片 ID）+ `battle-c01.js#route/#routeStep`（覆写 `b.path.geometry`、走完前 `pathT ≥ 1.2`、
> 按领头人逐段 `slice` 裁切）+ `battle.js#applyC01Param`（r173 的 `?c01=routePreview`）全在，**缺的只是从没在主战场跑过**。
> 本轮查出的**真缺口**：接上了但没生效 —— `landArcs()` 的 `land` 默认 0.55 是死值，真实导航图相邻节点只有 **0.42–0.47** 世界单位（一格宽），
> 落点必然越过终点 → 命中「段太短退化成斜落」的 early-return → **arcs=0、跨层仍是斜插、2 处跨崖 6 个点埋在崖体里**
> （单页 `route-preview-browser.cjs` 与 node 测试一直绿，因为 demo 的合成崖段长 ≥1，不会越界）。
> 改法（只动几何模块一处）：`land` 由死值改为**上限**，按崖沿之后剩余水平余量收边 `reach = min(land, 剩余段×0.85)`，贝塞尔控制点同收边；
> 只有余量 < 5% 段长才退化成斜落。`tests/route-preview.mjs` 同步改「0.4 短段 → arcs 1 且落点在段内」，另加 `at:0.95` 退化用例。
> 新测 `tests/route-preview-battle-browser.cjs`（19 项）：`?c01=routePreview` 入口、几何接管（126 点 == geometry.count）、
> 间距 p50 **0.1199**、**弧 2 == 跨层跳数 2**（最陡段斜率 1.000）、圆角 **26**、**埋点 0/126**（直线连点 7/143）、
> 路线长 14.962 vs 直线 9.286（×1.611）、下令后 2.5–4.5s 仍常驻（`pathT ≥ 1.183`，对照档 2.6s 已清空而小队仍在走）、
> 裁切 126→4 单调、像素 A/B **5880 px**、噪声 **0**、开→关→开回位 **0**。回归 `route-preview.mjs` / `route-preview-browser.cjs` /
> `battle-c01.mjs` / `column-march-browser.cjs`（16/16，引导点读数 126 点 + 弧 2 + 圆角 26）全 PASS。
> 如实口径：片里可同时看到两条路线（两队各一条），本仓仍只有当前下令那一队一条；点距 0.12 与点径 5px 未按片重标。
> 证据 `artifacts/coverage/995043346778415104-review-r175.md`。该条自成一组，**无剩余**。

> 表外收口（岸浪泡沫 / 窄湾防穿岸 · 组内 2 条一并 done）：`1849730611964973481`（599 帧·"loads of overlapping waves that each go through their own cycle"）
> + `1666429884208381953`（630 帧·"a refined version of what I did for Bad North and Townscaper"）**✔ 已收口（第 178 轮 · 2/2 片全 done）** ——
> 两条的遗留句都是同一对：「泡沫mask / 蓝线窄湾交叠仍缺」。核实为**缺运行验收，不是缺机制**：`src/water/foam-mask.js#buildFoamMask`（触水柱栅格化 → chamfer 距离 → 只在 falloff 0.4/radius 1.4 内出 foam）
> + `clampWavePaths`/`auditWavePaths`（碰陆顶点收回、`aIn/aOut` 同比缩放、只读审计）与 `src/world/view-c10.js` 的 `?c10=foammask,shoreclamp` 入口（`app.js:523`）r56 就在，
> 但**全仓没有一条浏览器测试跑过这两层**。本轮补 `tests/foam-mask-shore-c10-browser.cjs`：
> mixed 岸浪 1612 顶点穿岸 **8.44% → 2.23%**（收回 136）、quad 1744 顶点 **11.70% → 0.92%**（收回 204）；
> 泡沫遮罩 mixed 350×320 / quad 337×371，带内覆盖 21.8% / 19.8%、**带内孔洞 >50%**（碎斑不是实心白圈）、meanFoam 0.246/0.248、构建 8–9ms；
> 屏幕 A/B（离屏 512²）**5251 / 5594 px** 全为变亮（最大 +169/+183）、同状态噪声 **0**、World version 不变、几何无 NaN。
> 如实口径：残余穿岸 2.2%/0.9% 是 0.04 栅格边界余量（另 8 个顶点的蓝线点本身落在栅格陆格内，沿同一射线收不回来）；泡沫为单通道遮罩近似，冷白/浪形未按片重标。
> 证据 `artifacts/coverage/1849730611964973481-review-r178.md`、`1666429884208381953-review-r178.md`。该组 **2/2 片全 done，无剩余**。

> 表外收口（岸浪黄/蓝线 + 循环顶点着色器 · 组内 2 条一并 done）：`1849732997945110651`（437 帧·"the waves travel from the blue line to the yellow (and back a little) …
> a global water mask texture that adds extra foam around rocks"）+ `1991101097818403263`（477 帧·"looping vertex shader … baked at generation-time … in-direction, an out-direction and a time offset"）
> **✔ 已收口（第 179 轮 · 2/2 片全 done）** —— 两条 note 的遗留句（「全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺」/「完整浪形/碰撞仍部分」）核实为**缺运行验收，不是缺机制**：
> `water/shore.js#buildShore`（文件头署这两条 ID）的黄线岸脚 + 蓝线外推（`field.march` 后 **6 遍邻域平滑**、每遍拒绝落回栅格陆地）+ `aIn/aOut`（`bakeWaveMotion` 镜面回弹）
> / `aPeriod 0.90+0.22·hash` / `aCrest·aWidth`（`waveCrest` 整数谐波 7/13）/ `waveCycleGLSL`（t<0.68 进浪 f:1→0，t>0.68 退浪 0.22·sin，两端 alpha 归零所以回绕无缝）
> + `water/foam-mask.js#buildFoamMask` / `clampWavePaths` + `world/view-c10.js` 的 `?c10=foammask,shoreclamp`（`app.js:523`）全在；
> **「折叠消解」核实为原作现象**（r56 已记，本片 0140+ 窄湾蓝线本就交叠），不列缺。
> 本轮零改码，新测 `tests/shore-wave-cycle-browser.cjs`（真 View，mixed/quad，离屏 512² 读回）：
> t=0 **落蓝线** 9.0e-6 / 6.5e-6（相对）、t=0.68 **落黄线** 0、退浪位移**精确等于 `aOut·cycle.y`** 2.8e-17 / 5.6e-17、峰值 **0.2197**；
> `|aOut|==|aIn|` 到 float32 底（8.5e-8 / 1.05e-7）、回弹朝岸内插 **0** 条；
> 同一 uTime 下 **进/退顶点 59.8%/40.2%**（quad 58.3%/41.7%）、t 跨度 0.062–0.978、row-0 **482/515 种相位** → 不是齐步走；
> `waveCrest` 绕一圈**接缝误差 0**、峰 11；**穿岸 8.44%→2.23% / 11.70%→0.92%**（收回 136/204）；泡沫带内纹素 24383/24765、**孔洞 78.6%/80.5%**；
> 同 uTime 复现噪声 **0**、换时钟整帧差分 **13558/14472 px**。截图 `artifacts/coverage/shore-cycle-{mixed,quad}-{t0,hit}.png` + 2× 裁切（均 ViewImage 看过）。
> 回归 `tests/foam-mask-c10.mjs` / `tests/shore-profile.mjs` PASS。如实口径：片内着色视图浪带很细，整页截图只到「岸脚白边」，位移靠离屏 A/B；
> 泡沫为单通道遮罩替身、原片红三角是作者线框调试层（本仓 `view.setDebug('wavewire')`）未按红重标。
> 证据 `artifacts/coverage/1849732997945110651-review-r179.md`、`1991101097818403263-review-r179.md`。该组 **2/2 片全 done，无剩余**。

> 表外收口（岸线白带分段 · 单条自成一组）：`1991099314714902634`（545 帧 / 33.3333fps / 16.35s·"Got some pretty sweet new shore waves going"）
> **✔ 已收口（第 180 轮）→ done** —— 旧 note 的「遮罩/拓扑碰撞仍缺」核实为**过期账**（`foam-mask.js` 的 `buildFoamMask`/`clampWavePaths` r56 就在，
> 本页只是没接），真缺口是**形制**：片内岸线白带是**分段**的（有浪的岸段实心白、段间水体直接贴岩脚，白块沿岸滑移且宽度来回胀缩），
> 而本仓静态裙带沿全岸 100% 常亮、把浪带的分段盖住。本轮给裙带烘 `aArc` + `skirtCoverage`（整数谐波 3u/7u、`amp` 呼吸、相位漂移，
> `uSkirtBreak` 可混回常亮），并修 `FrontSide` 背面剔除（同机位单面 2170px vs 双面 35481px —— 裙带原来只画出零星几段）。
> 新测 `tests/shore-skirt-breakup-browser.cjs`：接缝 2.33e-15、亮段 9/12 段、缝隙 42.9%↔27.8%（呼吸）、缝隙沿岸移 28.4%/37.5%、
> GPU 分桶亮度 **32.6 vs 98.8**、关档 128.6/115.8（≈常亮）、差分 21675/28144px、噪声 0。证据 `artifacts/coverage/1991099314714902634-review-r180.md`。
> 该条自成一组，**无剩余**。

> 表外续项（反射组 · 2 条）→ **✔ 已收口（第 182 轮 · 2/2 片全 done）**：`1758250248483278925`（516 帧·"New water reflection I'm quite happy with"）
> + `1215644531221311488`（270 帧·彩色中间色倒影 + 更宽岸裙）。r181 核实为**真缺口**（少见的真账）：镜像双网格躺在岛体正下方被自身深度挡死，主场景倒影层 0px；
> r182 用 RTT 平面反射收口（`src/water/planar-reflection.js`：镜像相机 + 斜近平面 + world→uv，RT alpha=0；水面片元取样后朝水色拉 45% = 1215 的 flat coloured mid point），
> 并加 `shore.js#buildShore(skirtWidth)` + `view.setSkirtWidth()`。验收 `tests/reflection-projection-browser.cjs` PASS（mixed/quad 倒影层 5902/11281px、镜像命中 69.9%/92.1%、
> 差分像素 98.8%/98.5% 落在真水面、水线泄漏 0、噪声 0、裙宽 1→1.6 精确 1.6×）。证据见 `三·182`。
>
> **r181 记的真缺口（历史留档）**：旧"镜像双网格"（`view.js` 的 `Mesh(worldMesh.geometry)` + `scale.y=-1` + `reflection.js` 片元 `vDepth<0 discard`）
> 整体躺在岛体**正下方**、水平范围与岛完全重合，从水面之上的相机看几乎整块被岛体深度挡住，画不到岛外的水面上
> → 固定机位实测主场景倒影层 **0 px**（隐藏岛体才 1664px / 256²）。r182 已用 RTT 平面反射替换，主场景不再画这块网格（常隐，只留 `reflection.html` 实验室）。
> 另：r181 记的 `tests/reflection-browser.cjs` 红是**真 bug** —— `reflection.js` 只在传 cloud uniform 时才注入 `cloudShadowTone`，没传就整支 shader 编译失败；r182 已修（按有无 cloud 分两版），该测现 PASS。

> 表外收口（船上血迹/尸体/箭贴附 + 岸上小花 · 单条自成一组）：`946660607008403456`（440 帧·"…making blood, corpses and arrows stick to boats and adding pretty little flowers"）
> **✔ 已收口（第 185 轮）→ done** —— r183 判的三条缺口里，**「桨叶阵列」是误读**（0430 的 8× 裁切：白物长短倾角都不规则、散布甲板中部；
> **停泊的空船无船员也有 2 支**；同帧空中还有飞行箭线；原文只点名 blood/corpses/arrows/flowers）→ 该条撤销；
> 真缺口是**花的形制/接线**（花与「沿岸白泡沫带」共用默认关的 `shoreFoam`，而该片水面干净 → 页面上无法表达「只有花」）与**船上尸体的颜色**（队伍色→灰，暗红血池上读不出来）。
> 本轮改码：`battle-c01.js` 新增 `shoreFlowers`（默认开）+ `#buildFlowers()` 独立着色/几何 + `flowerProbe()`；`battle.js` 新增 `COL.boatCorpse`。
> 验收 `tests/battle-c01-shore-flowers-browser.cjs` 18 项：20 簇/110 朵/每簇 4–7/离地 0、花层开关差分 494px **100% 落在花点 ±10px 内**、噪声 0、回位 0；
> 尸体船横摇 Δ0.0322 后位姿误差 <1e-6、射空箭 parent=boat.mesh 漂移 0、血池 24 段 opacity 0→0.384。
> 如实：原片是整片米白花毯、本仓 20 个散簇；近景白尸体被血斑盖住 → 记美术差。证据 `artifacts/coverage/946660607008403456-review-r185.md`。该条**无剩余机制缺口**。

> 表外收口（体素屋顶小件 + 室内光进深渐变 · 单条自成一组）：`797844857821732864`（117 帧 / 9.36fps / 12.5s·无原文）
> **✔ 已收口（第 186 轮）→ done** —— r183 收口「正交环绕 + 逐格窗槽 + 内腔玫瑰墙」后，note 只剩两句，本轮核实**都是真缺口**：
> ① 屋顶小件一件都没有（天线/圆盘/栏杆/露台小树）；② 内墙是单色，没有原片那种「洞口浅、往里压暗」的进深渐变。
> 片内依据：0116 的 4× 塔顶裁切 = 屋脊 6–8 根细竖杆（最长 ~1.3 格、有的成对）+ 左塔上部外墙一个正圆盘 + 每段沿口密排小竖齿 +
> 中层露台一棵「三球叠起来」的小树（脚下方形花池）；4× 拱洞裁切 = 内墙粉玫瑰、洞口偏浅往里压成暗玫瑰。
> 改码：`voxel-ghost.js` 新增 `roofProps()`（四类小件全部落在屋顶格/朝外立面，定种子可复现）、`propStats()`（件数 + `floating`）、
> `airDepths()`（从包围盒边界空气泛洪，depth = 到外部空气步数）、`interiorTone(depth,{ref:9})`（`#f2e4e9 → #b891a3`，`1−exp(−depth/9)`）；
> `interiorFaces()` 的值由 `true` 改成**进深数字**（`has/size` 语义不变）；页面加 `#props` / `#grad` 两开关与 `?props=0` / `?grad=0`，
> 小件与格子共用 painter 序（depth +0.35），HUD 出件数与进深区间，只读 `props / propList(kind) / gradient / interiorProbe()`。
> 验收 `tests/voxel-ghost-roof-props.mjs` 46 checks + `tests/voxel-ghost-roof-props-browser.cjs` PASS：小件 **336**（天线 12 / 栏杆 320 / 圆盘 2 / 树 2）、
> 屋顶格 305、`floating 0`；开/关差分 **30903 px**（包围盒正是屋顶带）、关→开→关截图逐字节幂等、重载噪声 0；
> 室内渐变粉色像素亮度跨度 **10.4 → 21.4**、最暗 **156.6 → 134.1**；浅/中/深 depth **4/11/16** → 亮度 **206 / 180.3 / 171.3**。
> 回归 `voxel-ghost-orbit.mjs` 58 / `voxel-ghost.mjs` 25734 / `voxel-ghost-orbit-browser.cjs` 全 PASS。
> 如实：小件为体素替身、齿密度低于原片；演示塔可见内墙多在同一进深档 → 记美术差/机位差。证据 `artifacts/coverage/797844857821732864-review-r186.md`。该条**无剩余机制缺口**。

> 表外收口（白垩崖两队混战 · 单条自成一组）：`1007587828992266240`（300 帧 / 31.348fps / 9.57s·无原文 2018-06-15 Bad North 宣传动图）
> **✔ 已收口（第 188 轮）→ done** —— 旧 note 的 `【卡点·A 机制未做】` 是过期标签（本片 ID 署在 `house-char.js` / `battle-c03.js` 文件头，r56 已落 houseFx）；
> 真缺口是**焦痕默认关**：`charHouseVerts` 只压屋体顶点、不铺地，焦痕贴片在 C02（`scorch`）与 C03（`houseFx`）各有一份、两处默认都关 → 主战场「黑屋有了、屋周焦痕没有」。
> 本轮照 C01 `houseChar` 先例加 `C02_DEFAULT_ON = ['scorch']`（`?c02=-scorch` 关档）。新测 `tests/battle-chalk-scorch-browser.cjs` 20 项：
> 失守后 `housesCharred 1 / charredVerts 206 / fireSources 2 / smokeSources 1 / scorched 1 / decals 4 / embers 45`（旧默认 0/0/0）；
> 两队混战 12s → hp `5/6/0`、场亡、新增血渍 **76**；两队旗齐（浅蓝/橙/薄荷 `[128,189,211]/[221,157,100]/[152,213,193]`）；
> `?c02=-scorch` 同岛同夹具全 0 而屋体仍焦黑 → 开/关差分 **52473 px**、包围盒覆盖屋格投影点、同状态噪声 **0**。
> 回归 `c02-bn-fx-b.mjs` / `c03-battle.mjs` PASS。如实：紫旗配色不在色板（美术差）、焦痕是屋基+门口两片斑而非沿崖缘一条带。
> 证据 `artifacts/coverage/1007587828992266240-review-r188.md`。该条**无剩余机制缺口**。

> 表外收口（指挥官能力键 / Plunge · 单条自成一组）：`995034777756536833`（564 帧 / 29.2379fps / 19.29s·无原文）
> **✔ 已收口（第 195 轮）→ done** —— 旧 note 的「能力系统（Plunge 本体/冷却环/非法目标提示）仍空白」= 过期账（第 52 次同型）：
> `src/badnorth/battle-c03.js`（文件头署本片 ID，`C03_FLAGS` 的 `plunge`）r56 就有三键 HUD（`#ensureHud` 的 58px SVG 圆钮 + `.cd` 冷却弧 + `arm()`）、
> `castPlunge()`（`range 3.6` 目标校验 → 无目标 `#toast('No valid targets')` 且不进冷却 → 全队 `c03Leap` 跃起 → 落地白环 `ringGeo` + `applyHit` 范围伤害 → 冷却 10s），
> 页面入口是环境面板「c03 · 北境·玩法与演示 → 指挥官跃击」勾选框（`?plunge=1` 同效），**缺的只是运行验收**。
> 本轮另补三处**真形制差**（片内一眼可数）：① 名牌改挂亮键**上方**并带朝下小三角（原来常驻钮下方）；② 亮键补**黄高亮环** `.hl`（原来只靠冷却弧变白暗示选中）；③ 「No valid targets」改成**点亮那一刻**就出（原来只在地面点击时提示，片里黄圈与黑条同帧）。
> 另加容器 `pointer-events:none`（不再吞页脚点击）、`bottom 18→72px`（本仓页脚有既有白色工具条）。
> 新测 `tests/ability-bar-plunge-browser.cjs` 31 项 PASS：面板勾选即出三钮 / 仅 plunge 可点（另两颗 0.45 灰）/ 钮径 **5.18%** 画幅 / 居中留白 72px；
> 无目标 `hlOpacity 1` + 牌在钮上方且居中 + 黑条 `No valid targets` + `cooldown 0`；有目标 `arm()` 不出条 → **真 `mouse.click` 打地面** `plunges 1 / plungeHits 1（hp 2→1）/ shocks 1 / cooldown 9.283`（10s 档，跃起 0.72s 里已在走）；
> 冷却弧 `12.15 → 54.55 → 96.95`（= `169.6·(1−cd/10)`，差 <0.05）归零可再 arm；关档差分 **6861 px** 全在条带、噪声 **0**、0 error。
> 回归 `c03-battle.mjs` / `battle-c01.mjs` PASS。如实：钮径比片内小 1.8 个点（5.18% vs 7%）、图标为近似、另两钮灰占位、**落地过程片内未拍**（按本仓口径实现）。
> 证据 `artifacts/coverage/995034777756536833-review-r195.md`。该条**无剩余机制缺口**。

> 表外收口（shader 平流场假彩色铺面 · 单条自成一组）：`1664565063552847873`（117 帧 / 16.67fps / 7.02s·
> "I'm trying out using a shader based fluid simulation … needs 32 bit float render targets") **✔ 已收口（第 202 轮）→ done** ——
> 旧 note 的缺口只剩一条、而且是**形制**：`float.html` 是数值读数表，全仓没有一张「把平流场按色带铺到真实 World 几何上」的页面。
> 本轮新建 `src/world/float-bands.js`（克隆 `view.worldMesh.geometry` 12854 三角 + 片元按**世界 xz** 采样 + RGBA **float** `DataTexture`
> + 四抽头手算双线性 + 5 段 plasma 的 GLSL/JS 孪生）+ `float-bands.html`（量化档 / 冻结 / `isolate` / `probeGrid` 探针）。
> 新测 `tests/float-bands-browser.cjs` **11/11**：色带占 76% 而天空不着色（= 非全屏 quad）、色相 18 档、相邻 >25° 跳变 **0.36%**（中位 0.39°）、
> 120 步变化 **63.6% / 平均 18.55 级**、GPU 与 CPU 孪生 **76/77 点 Δhue<12°（中位 0.00°）**、8 级量化 A/B 把色相档打到 10 / 离散色 2583→441、同状态噪声 **0**。
> 回归 `float-advect.mjs` PASS。如实：仍**不是流体求解器**（固定涡旋、无散度投影）；跨平台信任不可验；机位比片内近。证据 `artifacts/coverage/1664565063552847873-review-r202.md`。

> 表外收口（快速转镜拖抹续作 · 单条自成一组）：`1727324352264474664`（303 帧·"Yeah that actually looks pretty good. I did not expect that."）
> **✔ 已收口（第 228 轮）→ done** —— 旧 note 的「剩余残差=原片精确轮廓算法未公开（卡点·C，永久）」= 过期口径（速度场/审计/轮廓加权 r220 已落），
> 真正可测的形制差只有一条：**拖尾长度被常数 32px 钉死**（片内甩镜帧切向拖影 250–300px ≈ 39–47% 画幅，本仓只到 5%）。
> 收口：`WHIP_SMEAR_GLSL` 的 `maxPx` 改 `cap` 形参 + 新增 `whipCapPx`（下界 32 / k=1.6 / 夹 0.35×短边）+ `view.smearCap` + 页面 `?whiplen=auto|<px>`；
> 新测 `tests/whip-smear-long-browser.cjs`：上限 32/60.38/280 单调、GPU 拖尾 **31→199px**、**GPU==CPU maxDiff 0**、实景 maxPx 280 vs 32、停转 0、开关 alpha 0；
> r220 回归逐位不变。残差=切片质感比片内软一档（单历史纹理 4-tap vs 几何级子帧）。证据 `artifacts/coverage/1727324352264474664-review-r228.md`。该条自成一组，**无剩余机制缺口**。

## 三·242、第 242 轮（A 类仍空 → 表外一组 `974325184525201409` 维京登陆规划盒子：候选车道盒补长盒 + 分色，出运行验收）→ **✔ 已收口（done 213 → 214）**

**一组、一条转 done**：`974325184525201409`（504 帧 / 30.601fps / 16.47s，"…making our own box-box test… Behold, our beautiful viking raid planner"）。
证据 `artifacts/coverage/974325184525201409-review-r242.md`；新测 `tests/raid-boxes-c01-browser.cjs`（quad+mixed 全 PASS）；
回归 `raid-planner-terrain.mjs` / `battle-c01.mjs` / `landing-plan.mjs` / `landing-traffic.mjs` / `obb-policy.mjs` 全 PASS。
不在 TOP 18 内，**表内无行可改**（TOP 18 路径列仍全 ✔；附录该条在 [051] 之外、无独立行）。

- **全片核**（6 张联系表 + frame-0250 原尺寸）：全片唯一运动是相机；岛周一圈**短泊位盒**，每个泊位牵一条**贯到远处的长车道盒**，按泊位分色，
  盒子一次性算完（不逐帧求解、不出现消失），**没有船体**。
- **核实先于动手**：旧 note 的「按到达时间的动态避让仍没做」是 **r56 口径**的过期账 —— `steerBoat` 已做让行/侧让（unload > out > in 障碍序 + 侧偏表 + 全堵 hold）；
  且片内无船，按本仓纪律（片中没拍到的机制不记缺口）不计。
- **真形制差**：候选只画泊位小盒，**没有长车道盒** → 屏上读不出「一个泊位 → 一条车道」的成对关系（这是片内画面的主体）。
- 改法（只动调试视图，不动规划/判定）：候选补 `seawayBox` 长车道盒，**只给首选（正对岸）且判定可用**的那些（192 条全画 + `depthTest:false` 会糊成一片）；
  配色由「可用白 / 被拒暗红」改成**按泊位哈希分色**、被拒压暗 42%；出 `stats.raidBerths/raidLanes/raidLaneBoxes`。
- 读数：quad 船 2 / 泊位 64 / 车道 192（=64×3）/ 可用 114 / 被拒 78 / 长盒 39；mixed 2 / 58 / 174 / 110 / 64 / 37；
  顶点数 == (船×2 + 车道 + 长盒)×24（5640 / 5160 逐项相等）、颜色种数 126 / 120、可用泊位相交 0、
  **同状态噪声 0 px**、开→关差分 427945 px（29.7%）/ 397925 px（27.6%）、关档 raid 层不可见、0 console error。
- 残留（非机制）：片内是 Unity 编辑器俯视 + 棋盘格地面，本仓是游戏相机；raid 层 `depthTest:false` 会把岛后车道透出来；调色板是哈希非原片固定色。
- 坑（第 89 条）：**模块里一处 `let` 与既有 `const` 重名，整页静默死** —— 报错只见 `Private field '#x' must be declared in an enclosing class`
  （类体解析失败 → 所有私有字段“未声明”），playwright 侧只表现为 `waitForFunction` 超时；改完模块先看 `pageerror` 第一条，别先怀疑环境。
- 坑（第 90 条）：调试层 `depthTest:false` 时，「盒子穿岛」是投影错觉不是几何错 —— 判「车道压陆地」要用 SAT/射线，别看截图。

## 三·241、第 241 轮（A 类仍空 → 收 r240 的 `next[0]`：`906416813810049025` 洞内光照的**面朝向判据**）→ **✔ 已收口（done 212 → 213）**

**一组、一条转 done**：`906416813810049025`（725 帧）。证据 `artifacts/coverage/906416813810049025-review-r241.md`；
新测 `tests/cave-light-pixel-browser.cjs` 重写为三层（几何 / 像素 / 外立面回归，15/15 PASS）；回归 `tests/cave-light.mjs`（四座真岛 PASS）+ 默认场景冒烟（12185 三角、法线全单位、0 报错）。
不在 TOP 18 内，**表内无行可改**（TOP 18 路径列仍全 ✔）。

- **核实先于动手**：r240 的「148839 px 是一整面朝外岩壁被压暗」被本轮射线分类**部分推翻** ——
  那台机位 37 条命中里 17 条三顶点全在洞内、18 条跨洞口、**只有 2 条全在洞外**，那片面积主要是洞身内壁/洞底。
- **r240 抓到的另一半是真的**：几何颜色差分（开/关两次重建比顶点色）实测修前 **230** 个顶点被压暗，
  其中 **24 个在洞体格之外**，样例 `(0.02, 2.00, 1.88) n=(0,1,0) f=0.332`、`(0.33, 2.00, 2.10) f=0.527`
  —— 全是 **y=(floor+2)·L 的洞顶上表面**（法线朝上，即洞顶那块岩体的地面）。片 f0280 那块顶面是亮的 → 真缺口。
- 改法：`planCaveLight` 存 `rects` + 新增 `insideTunnel(plan,x,z,y,margin)`（矩形 ∧ 洞高区间）；
  `facesCave()` 沿**三维**法线探 0.12 格，落进空腔才算洞内面（侧壁/地板/洞顶内表面命中，洞顶上表面与外立面落空）；
  `caveShadeAt(...,n)` 可选法线，不给法线退回 r239 柱体口径；`applyCaveLight(...,normals,stats)` 出 `rejected`；
  `worldmesh.js` 把乘色挪到**算法线之后**并传法线（顺序反了就没法线可用）。
- 读数：被压暗 **230 → 157**、格外的 **24 → 0**、朝向挡掉 **73**、`f` 收敛到 **0.540–0.949**、
  面分布 地板朝上 34 / 洞顶朝下 24 / 侧壁 99、格隙 `maxGap 0.078`（地形平滑位移）、再开 `idemMismatch 0`。
  像素：洞内机位差分 **99974 px（32.5%）**、mean|Δ| **7.65**、回位 **0**；外立面回归：全洞外 2 点 **0 changed**、全洞内 17 点 16 变。
- 残留（非机制）：压暗边缘因顶点着色外溢约一格（软过渡）；洞身 0.39–1.14 格长，最暗段在拐弯后，拍不到「整条洞由亮到暗」全景。
- 教训（第 87 条）：**「差分很大多半在洞里」不能靠肉眼认面** —— 同一张无光照渲染里，近处洞壁能占半屏；
  判「压暗跑到洞外」要拿射线把命中三角形按顶点归属分类，别按命中点。

## 三·240、第 240 轮（A 类仍空 → 收 r239 的 `next[0]`：`906416813810049025` 洞内光照的**像素级开/关**）→ **仍 partial（账不动：done 212 / partial 36）**

**本轮一组、未转 done**：`906416813810049025`（725 帧）。证据 `artifacts/coverage/906416813810049025-review-r240.md`；
新测 `tests/cave-light-pixel-browser.cjs`；回归 `tests/cave-light.mjs`（四组 PASS）。
不在 TOP 18 内，**表内无行可改**（TOP 18 仍全 ✔）。

- **做成的部分**：r239 撤掉的浏览器验收用另一条路补回来了 —— 不开第二个 WebGL 上下文，
  同页同 renderer 把 worldMesh 按无光照顶点色渲，相机贴洞口内侧沿洞轴看，开→关→再开三张。
  读数：压暗顶点 230/0/230、开/关差分 **148839 px（48.4%）**、mean|Δ| 14.37、**回位 0 px**、
  均亮 147.95 / 157.27。→ 「换档真的改画面」这条账现在有像素证据了。
- **像素账反而证实了一条缺陷**：ViewImage 实看两张图 —— 相机站在洞口外台地，挡住视线的是一整面**朝外岩壁**，
  开档时这面墙整片变暗。`caveShadeAt` 的判据只有「y 落在 (floor·L,(floor+2)·L) + 到洞轴横向 ≤ 半宽」，
  **不看面朝向、也不看是否被洞顶遮住** → 洞外朝外的岩壁只要落进这条带就被一起压暗。
  这正是 r239 `next[1]`（遮挡可见性）预判的那一条，本轮用像素账把它从「口径不够细」升级成「挡着 done 的真缺口」。
- **坑（第 85 条）**：同页渲完立刻 `page.screenshot` 会被 rAF 主循环覆盖回主场景（本轮前两版探针拍到的都是整岛远景）——
  必须**在同一 JS 任务内 `canvas.toDataURL`** 取图。
- **坑（第 86 条）**：`Partial` 近似里「y 带 + 横向距离」是柱体判据，任何贴洞口的**外部立面**都会命中；
  要判「洞内」还得加一条法线/遮蔽判据（朝外的面不算洞内）。
- 下一轮：`caveShadeAt` 加面朝向判据（只压法线朝洞轴/朝上的面），重跑本测，三带应呈「近洞口亮、深处暗」，
  差分像素落在洞内而不是整面外墙 → 即可 done。

## 三·239、第 239 轮（A 类仍空 → 表外一组 `906416813810049025` 洞穴岛：洞内暗一档 + 洞口渐变）→ **仍 partial（账未虚增：done 212 / partial 36）**

**本轮一组、未转 done**：`906416813810049025`（725 帧 / 32.84fps / 22.08s，"New cave tileset. These levels really challenge your spacial skills"）。
证据 `artifacts/coverage/906416813810049025-review-r239.md`；新测 `tests/cave-light.mjs`；回归 `bncaves-island-battle.mjs` / `battle-navigation.mjs`。
不在 TOP 18 内，**表内无行可改**（TOP 18 仍全 ✔）。

- **核实（先核再动手）**：旧 note 三条「仍缺」→ ② 船只靠岸与上下船联动 = **过期账**（第 36 次同型）：
  `#launchWave` 的 planLanding → 靠泊 → crew 逐个 `onBoat=null` → `state='out'` 全链在，本轮真岛回归复跑 `landed:1`（quad/mixed）；
  ③ 门价常数 = 片内无「洞口二选一」对称场景，属本地取值；只有 ① **洞内光照**是真缺口。
- **真缺口**：r56 起只有体素 AO —— 洞身中段与洞口差不出「一档」，洞口是一条硬边（片内 f0230：洞口留一圈天光、往里一步即沉）。
- **落地**：新建 `src/light/cave-light.js`（`planCaveLight`/`caveShadeAt`/`applyCaveLight`/`caveLightReport`），
  `island.js` 生成后挂 `world.caveLight`（默认开、`?cavelight=0` 关档），`worldmesh.js` 在 bake 之后对坏块调它并记 `caveShadeVerts`。
- **读数**：3 条隧道 / 7 洞格 / 全 `mouths=2`；洞口 **1.000** / 洞身 **0.540** / 洞顶上方 **1.0**；
  真页面同世界切档重建（顶点亮度比）洞口桶 **1.000** / 第二档 **0.714** / 最深 **0.769**，压暗 **234** 顶点。
- **口径纠错（自记）**：报告里的「中点」最初取首尾连线中点 —— 隧道拐弯时它会落到洞口附近（读到 atMid 0.85 的假值），
  改按**沿轴弧长**取即回到 0.54；测试采样同理，否则会读到「0.41 的硬边」（其实是采样点跑出洞轴胶囊）。
- **仍缺**：像素级开/关截图（swiftshader 第二上下文/同页重载 150s+ 超时，`tests/cave-light-browser.cjs` 已撤除，读数改走单页切档脚本）。

## 三·237、第 237 轮（A 类仍空 → 收 `next[0]`：修自 r174 起挂红的 `tests/battle-navigation-browser.cjs` 穿洞用例）→ **✔ 门禁已绿（无 clip 级收口，账不变：done 212 / partial 36）**

**本轮一组、未转 done**：修的是运行门禁（守 `906425294533394432` 瑞士奶酪 / `797119718477991936` 的多层穿洞验收），
两条片子本来就是 done，`status / note / reviewEvidence` 一字未动。证据 `artifacts/coverage/906425294533394432-review-r237.md`。
不在 TOP 18 内，**表内无行可改**（TOP 18 仍全 ✔）。

- **根因：夹具口径错，不是导航错。** 旧夹具 `w.setSolid(c,3,true,{rock:true})` 把桥面同时写成 **rock**，
  `world.ground()` 取最高岩石层 → `top=3 / ground=3` → `buildNav` 的 `walk` 判据 `t===g` 成立 → **桥顶被当成裸露台地**，
  `stairs` 里多出两道 `rise:2` 的边（`(-1.67,-0.12)→(-1.38,-0.53)`、`(1.68,-0.25)→(1.29,-0.06)`）→ 走屋顶与穿洞同价。
- **轨迹实读（旧夹具）**：k=50 平地 floor1 → **k=60 plan 换层（next.floor 1→3）** → k=100 顺楼梯登上 1.457/floor3 →
  k=130 桥顶 y=1.5 → k=350 下桥 → k=450 到达。`maxY 1.50 / pathMaxY 1.55 / tunnelSamples 0 / remaining 0.14`：
  「到达」是对的，路线被换成了屋顶。
- **否掉一个错误假设（已回滚）**：按 `next` 的字面怀疑「`stairAt` 踏步矩形把路过的队伍吸上桥」，落了一版
  `unit.navToFloor` 闸门（Battle 每帧把 plan 落脚层交给 `footHeight`，同层行进不许踩踏面）→ **三次运行读数逐位不变**
  （`remaining 0.14021524394482063`）→ 抬脚不是「吸」是 plan 自己换的。`src/` 全部回滚，`grep "第 237 轮" src/` 无命中。
- **落地**：夹具去 `{rock:true}`（桥面改回建筑：`top=3/ground=1`、`walk=0`、无 `rise:2` 边，洞道成唯一通路）；
  并修三处 **`waitForFunction(fn,{timeout})` 签名错**（第二参是 arg，60s 实际一直是默认 30s，负载高时随机假红）→ `(fn,null,{timeout:120000})`。
- **读数（新）**：quad `remaining 0.1460 / floor 1 / maxY 0.500 / tunnelSamples 185 / pathMaxY 0.550`；
  mixed `0.1418 / 1 / 0.500 / 194 / 0.550`；`resolved 24/24`、跨层近战 `[3,3]`、箭被楼板挡 `t=0.2917/targetHP 3`、
  封洞 `distance 0 / height 0.5`（不瞬移）；`errors []`。两张截图 ViewImage 实看，叠字与表一致。
- **既有红（非本轮引入）**：`tests/layered-nav-holes.mjs:43` `门价 2.5：拱洞 9 > 绕行 8` 仍红，已挂下一轮定性。

## 三·236、第 236 轮（A 类仍空 → 续收 `793557992931266561` AO 五阶段：⑤ 的方向色从「遮挡侧」改挂到「面朝向」，量级按片内像素账重标）→ **✔ 已收口（转 done）**

**本轮一组、已转 done**：`793557992931266561`（6 帧 / 1.2fps / 4.999s，"flat -> up normal -> vertex voxel AO -> SSAO -> directional AO"）。
证据 `artifacts/coverage/793557992931266561-review-r236.md`；新测 `tests/ao-directional-tint-browser.cjs`（PASS）+ 回归 `ao-stages-five-baked-browser.cjs` / `voxel-ao-stages.mjs` / `ao-split-channels.mjs` / `ao-field-cache.mjs`。
账：done **211 → 212** / partial **37 → 36**。不在 TOP 18 内，**表内无行可改**（TOP 18 仍全 ✔）。

- **根因不是量级、是着色项挂错对象**：旧实现只按「遮挡来自哪一侧」着色且 `mix=min(1,occl*1.5)`，开空墙面 `occl=0` → 色偏被压成 0，只剩凹处一点颜色；片内 ⑤ 是**整面墙**按朝向分冷暖（0002 整片灰 / 0004 整片粉紫）。
- 改法：主项 = 法线朝向色 `FACE_TINT`（±36%），次项 = 遮挡侧 `DIR_TINT × OCCL_TINT_W(0.35)`（只在真有遮挡时叠），AO 仍 `1−strength·occl`。轴符号按本页机位标定（相机在 +X+Z 侧：法线朝屏幕左 = **−X / +Z** → 暖，朝右 = **+X / −Z** → 冷）；标定用「把单轴临时染蓝」的截图目视两次定出左右。
- 片内量级（0003→0004 逐像素，512px）：Δ(R−B) 均值 **−5.42**、p10/p90 **−33 / +19**、mean|Δ| **16.29 级 = 11.5% 亮度**、|Δ|≥8 占 **71.9%**。本仓 ±36% 标称下：mean|Δ| **14.31 级 = 10.7%**、|Δ|≥8 占 **76.2%**。
- 读数：负对照 ③ 档 ±X **−0.78** / ±Z **−0.75**；⑤ 档 ±X **+38.02** / ±Z **−34.05**；逐轴 R−B +X **0.0** / −X **38.0** / +Y **28.1** / +Z **35.5** / −Z **1.5**；灰夹具（墙色 `#cfcabf`）同向 **+39.75 / −34.74**；阶梯 flat→up 160075 / up→voxel 186404 / voxel→directional **224058** px。
- **两处口径纠错**：① r235 的像素账没摘 `#hud`（143 个面板 + 底部条压在画布上），摘后阶梯差 484295 → **224058** px；② r235 计划的「左半 R−B − 右半 R−B」在本仓**不可用** —— ③ 档左右基线就差 **17.3 级**（左半屏橙屋顶多、右半屏铺地多），把墙染灰后仍 17.3 级，是构图差不是色偏 → 冷暖账改走**逐轴顶点口径**（`aoTintAxisReport`）。
- 仍属本地选择（不构成缺口）：`OCCL_TINT_W` 与 `+Y` 顶面冷色幅度是本地定的；彩色小镇里色偏被自身调色板掩住，观感比片内灰楼弱，量级读数一致。

## 三·235、第 235 轮（A 类仍空 → 续收 `793557992931266561` AO 五阶段：r234 的「换档不出画面」被查明是测量口径错，补无光照档后 ①–④ 出可见阶梯，⑤ 仍重合）→ **仍 partial（账未虚增）** → **第 236 轮已收口（见上）**

**本轮一组、未转 done**：`793557992931266561`（6 帧 / 1.2fps / 4.999s，"flat -> up normal -> vertex voxel AO -> SSAO -> directional AO"）。
证据 `artifacts/coverage/793557992931266561-review-r235.md`；新测 `tests/ao-stages-five-baked-browser.cjs`（PASS）+ 回归 `voxel-ao-stages.mjs` / `ao-split-channels.mjs`。
账：done **211 → 211** / partial **37 → 37**。不在 TOP 18 内，**表内无行可改**。

- **纠 r234 两处误判**：① 「换档不出画面 / 成品不读顶点色 / 缓存不失效」全部来自**手动调 `rebuild()`** —— 重挂几何在 `view.render()` 里，手动 rebuild 把标志吃掉后 `mesh.geometry` 仍指旧几何（`geoAttached=false`、四档 colorHash 相同），读到的是旧顶点色；正确口径是切档后只等 `builtVersion===world.version && mesh.geometry===worldMesh.geometry`。实测四档哈希互不相同，`invalidate()` 本就会 `full=true → cache.clear()`。② 真缺口不是「读哪份 col」，而是**缺「只看烘焙」的无光照档**（`lightonly` 是白模＋实时光照，方向相反）。
- 落地：`view.js` `setDebug('bakedonly')`（`MeshBasicMaterial` 铺烘焙色，默认关）；`ao-stages.html` 加勾选 + `?baked=1` + `aoStageReport()` 探针；验收时隔离动画层（与原片一致：画面里只有建筑）。
- 读数：噪声 **0**；相邻档差分 flat→up **138529** / up→voxel **154717** / voxel→ssao **485365** / ssao→directional **484295** px；darkFrac flat **0.062** < voxel **0.069**，sd **56.61 → 58.81**，ssao 高频 **32.93** > **27.24**。
- **仍缺（下一轮可收）**：⑤ `directional` 与 ③ `voxel` 几乎重合（同机位对比 **n=41px**、mean 173.7 vs 173.8、sd 58.91 vs 58.81）——`bake.js` 的 `DIR_TINT` 只有 ±3–6%，`mix=min(1,occl*1.5)` 后在 8bit／ACES 下被抹平；片内⑤是整面墙按朝向分冷暖。改法：按片内量级重标（±15% 量级、按 ±轴遮挡占比分配），读数改成「左半 R−B 与右半 R−B 之差」并与片内同向。

## 三·234、第 234 轮（A 类仍空 → 表外一组 `793557992931266561` AO 五阶段：模块齐、页面换档不出画面）→ **仍 partial（账未虚增）**

**本轮一组、未转 done**：`793557992931266561`（6 帧 / 1.2fps / 4.999s，配文 "flat -> up normal -> vertex voxel AO -> SSAO -> directional AO"）。
证据 `artifacts/coverage/793557992931266561-review-r234.md`；账：done **211 → 211** / partial **37 → 37**（账面 285/285）。

- 取组：TOP 18「路径」列全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条单条组（6 帧，成本最低的 A 候选）。不在 TOP 18 内，**表内无行可改**。
- 全片核验：sheet-00 + 六帧原尺寸 —— ① 全平色剪影 ② 只上向法线提亮（洞内与墙同亮）③ 凹处成片暗 + 砖缝线 ④ 细密屏幕空间颗粒 ⑤ 暖（左/前）/冷（顶/右）方向色偏，尾帧保持。五级阶梯**逐级可分辨**。
- 核实（先核再动手）：模块侧确实齐 —— `bake.js` 的 `AO_MODES=flat|up|vertex|directional`（文件头署本片 ID）、`worldmesh.setBakeLighting`、`view-c04` 的 `SSAOPass`、`ao-stages.html` 五个 `option` 都在 → 判 A（只缺运行验收）。
- **跑出来的真差距（本轮新增，不是过期账）**：换档**不出可见阶梯**。
  ① `?white=1` 走 `lightonly`，它只丢顶点色，**实时光照/投影/AO 全保留** → 片①的纯平色剪影无档可出；
  ② 原型加 `unlit`（`MeshBasicMaterial`，无 map）+ `whiteModel`（烘焙 `colorOf` 恒白）后，读顶点色确变中性（chroma 0.12 / lum 0.19–0.24），但**画布截图仍是整片调色板色 + 实时光照**；五档截图 `voxel↔directional` 差分 **0 px** → 成品着色不读这份 `col`，且块缓存只按几何 hash 命中、换档不失效。
- 试改并**全部回滚**：`src/world/view.js` 的 `unlit` 分支、`src/world/worldmesh.js` 的 `whiteModel` 形参与换档 `cache.clear()`、`ao-stages.html` 的 film 档接线；三文件已复原（`git diff` 只剩前几轮未提交改动）。自写红测 `tests/ao-stages-five-browser.cjs` 已删除，读数留档 `artifacts/coverage/ao-stages-five-browser.json` 与五张 `ao-stages-five-*-r234.png`。
- 规律（第 80 条）：**「模块有档」≠「换档看得见」**——先做一次「只换材质、画面变不变」的对照，就能立刻分出「着色读的不是这份顶点色」；本轮 `voxel↔directional` 差分 0 比任何代码阅读都省时间。

## 三·233、第 233 轮（A 类仍空 → 续收 `1459169210752507904` 补丁缝：两条便宜路被读数否掉 + 轴向读数改成诚实口径）→ **仍 partial（账未虚增）**

- 本轮取组：TOP 18 的路径栏全部 ✔（A 类已吃干净）→ 按「一次 1 组 B」续收 1459。开工 `lock status` IDLE → `?:8769` 200 → `lock start`；收工 `queue --write` + `lock end`。未 commit。
- **① 剥壳归属（否掉）**：把顶点归属从逐顶点改成「整壳取同值」——一块补丁里只要有一格碰到别块顶点，这一格就整格放弃、留在松弛形。看着最合直觉，但四边格是**边相邻**的：放弃一格的顶点必须冻结，共边邻格也就不能动 → 整块级联。实测 patches 6→**1**、shell 丢 693 格、flips 35→**18**。已回滚。
- **② 缝上翻面格一拆二（否掉）**：18 个（0.886 档）翻面四边格逐格试两条对角线，**没有任何一条能让两片同时为正** —— 它们是「整体镜像的简单四边格」而不是 bowtie；镜像格只有把绕序翻过来才会「变正」，那是改判据（r232 已拒）。实测 `split 0 / unsplit 18`，另有 17 个三角格同样反向。已回滚；`grid.js` 与开工前**逐字节相同**。
- **③ 唯一落地（只读口径）**：`patchLayout` 新增 `geomAxisDeg` / `spreadGeomDeg` / `maxSpreadGeomDeg`。原因：`cell.family` 是**换基前**的轴向存根（0/30/60），拿它比换基后的轴线，旧 `maxSpreadDeg` 把「换基」读成「抖动」（页读 42.68°）。新读数：最大块 40.60°→**36.01°**、块内逐格偏离 p50 **6.63°**/p90 **20.44°**、**99.6%（955/959）**的格偏离族向块均值 >5° —— 一个族向连通块里本就含多个互不平行的正交点阵（换基分块更严：同族+同整数方向对），是实况。反例如实记：324 格块 27.96°→34.92°，圆均值不是 minimax 中心。
- 结论（写进下一轮）：缝只能靠**独立过渡顶点表**收口 —— 沿两侧边界折线各插一圈新顶点，缝格全部退化成以新顶点为第三点的三角，两条正交基各自完整。这必须动拓扑（顶点数、格数、`edgeNeighbors` 一起变），约 1.5–2 轮，**别再在共享顶点表上做折中**（累计已否掉：平摊 50／退三角 63／合用 73／不收缩 89／剥壳 18／一拆二 0）。
- 验收：新测 `tests/grid-patch-axis-honest.mjs` 18/18；回归 `grid-patch-square.mjs` 20/20、`grid-patch-rigid.mjs` 17/17、`grid-patch-square-browser.cjs` 15 项 PASS。证据 `artifacts/coverage/1459169210752507904-review-r233.md`。

## 三·232、第 232 轮（A 类仍空 → 续收 `1459169210752507904` 补丁缝：三条替代路径被读数全部否掉）→ **仍 partial（账未虚增）**

- **核实**：片内 frame-0160 原尺寸复核 —— 补丁内部每格 90°、行列共线；补丁之间是**两块共用的折线边界**（绿/青/品红描边），
  只在 6 处出现 1–2 个三角格，**缝上一格反号的都没有**。这推翻了上一轮 next 里"缝 = 整圈三角过渡带"的前提。
- **试错（三条，全部回滚）**：① 共用顶点两侧平摊（各补丁提案取均值，替代"大补丁独占"）→ 反向 **35→50**；
  ② 换基前把"带共用顶点的四边格"沿对角线退化成三角 → **35→63**（四边格 1331→1140、三角 242→624）；
  ③ ①②合用 → **73**；②且不做整块等比收缩 → **89**。
- **结论**：缺口不在格形，而在**共享顶点表本身无解** —— 两条正交基不一致时，同一个顶点不能同时属于两块的方格。
  收口只剩两条真路：(a) 缝上顶点**不属于任一块的方格**（独立过渡顶点表 / 按补丁边界重排顶点），约 1.5–2 轮；
  (b) 承认缝格是"略歪四边格"并改判据（口径放宽，不走）。
- **验收**：`tests/grid-patch-square.mjs` 20/20、`tests/grid-patch-rigid.mjs` 17/17、
  `tests/grid-patch-square-browser.cjs` 15 项全 PASS（488 四边格 / 200 三角格 / seam 367 / ?square=0 干净 / 0 error）。
- **现档与 r231 逐位相同**：`{patches:6, applied:1, flips:35, scale:0.886, maxMove:3.9295, roundErr:0}`。
- 证据 `artifacts/coverage/1459169210752507904-review-r232.md`；试错账写进 `src/core/grid.js` 文件末。

## 三·231、第 231 轮（A 类仍空 → 续收 `1459169210752507904`：先量「缝区能不能一轮收掉」，三条捷径全被读数否掉）→ **仍 partial（账未虚增）**

**本轮一组、未转 done**：`1459169210752507904`（609 帧 / 24.4578fps / 24.9s，配文只有 "And another"）。
证据 `artifacts/coverage/1459169210752507904-review-r231.md`；新测 `tests/grid-patch-square-browser.cjs`（15 项 PASS）+ 回归 `grid-patch-square.mjs` / `grid-patch-rigid.mjs` / `grid-hex-stats.mjs` / `grid-kinds-c08.mjs`。
账：done **211 → 211** / partial **37 → 37**（`update-learning-counts.py` 账面 285/285）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」续收该条。不在 TOP 18 内，**表内无行可改**。
- 全片复核：sheet-01（0100–0199）、sheet-05（0500–0599）+ `frame-0300` 原尺寸 —— 补丁内部**纯方格**、补丁外缘**全是三角**；本仓「缝上一圈仍是四边格」正是 35 格翻面的来源。
- 三条捷径的读数（写完即回滚，不留半成品）：
  ① **只动刚性核心 + 缝带拆三角**：核心只剩 **711/1331**（大补丁 959 格里 368 格合格）—— 大补丁内部本就有 242 个三角格、835/3836 个顶点槽被三角占用，挖不出干净核心；
  ② **跨补丁共享顶点取平均位移 + 只摊平翻面格**：翻面 **35 → 68**，补丁数 8 → 12（两侧都成「半方」）；
  ③ **`cell.family` 逐格按几何重算**：补丁数 **8 → 70**（浮点尾差切碎，r229 同款坑），只能按整块补丁取同值。
- 本轮唯一实收：**方形档首次出运行读数**（r230 `--runtime 0`）—— 页面 `squareInfo {patches:3, applied:1, flips:8, scale:0.886, maxMove:2.5652, roundErr:0}`、补丁 4 块 / seam 367 / 三角 200、换基前后 488-200-688 逐项相同、`?square=0` 时 `squareInfo=null`、画布 ink 1.0000、0 error；截图两张均 ViewImage 看过。
- **仍未 done（如实）**：补丁缝 35 格反向（真解=给每条缝重划三角过渡带，需按补丁边界重分顶点，1–1.5 轮）；`cell.family` 仍是换基前存根（`maxSpreadDeg` 42.68° 失真，改法只能是 patchLayout 按几何拟合族向）；偏离三族 >5° 占 5.6%。
- 规律（第 79 条）：**「缩一缩就压下去」的翻面是几何病，不是参数病** —— 连缩 6 次仍 35 格，说明翻面格与补丁核心**共享顶点**；这时先量「共享顶点的分布」（这里 835/3836 槽被三角占），再决定是重划带还是重分顶点。另：**顶点归属类改动一律按「整块补丁取同值」**，逐格重算必被浮点尾差切成碎片（r229/r231 两次同型）。

## 三·230、第 230 轮（A 类仍空 → 续收 r229 挂下的同一条 `1459169210752507904`：补丁内 60° 菱形 → 正方形）→ **仍 partial（缝区未干净，账未虚增）**

**本轮一组、未转 done**：`1459169210752507904`（609 帧 / 24.4578fps / 24.9s，配文 "And another"）。
证据 `artifacts/coverage/1459169210752507904-review-r230.md`；新测 `tests/grid-patch-square.mjs`（**20/20 PASS**）+ 回归 `grid-patch-rigid.mjs` / `grid-hex-stats.mjs` / `grid-kinds-c08.mjs`。
账：done **211 → 211** / partial **37 → 37**（`update-learning-counts.py` 账面 285/285）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」续收该条。不在 TOP 18 内，**表内无行可改**。
- 全片复核：R229 的 7 张联系表 + 本轮 `frame-0200`（1.6× 裁切）与 `frame-0300`（整帧 1.6×）—— 补丁内**成行成列的正方、四角 90°**，行距=列距；补丁之间绿/青**三角带**，边界是沿方格走的折线台阶；不同补丁**行向不同**（约差 30°）。r229 记的 26.55° 是**本仓生成器**的形制差，不是片子如此。
- 核实（先核再动手）：旧账"另起方形子点阵"方向对，但难点被说窄了 —— ①整体乘一个仿射 shear 会把松弛后的"局部半方"格子过冲成 120°（首版 44 处翻面）；②合并菱形的两条边可能落在点阵**任意两个方向**上（(1,0)/(0,1) 或 (1,0)/(1,-1)…），混在一个 familyDeg 连通块里换基会把一族切成 45° 菱形（首版 p75 = 45.00°）。
- 收口动作：`latticeAndMerge` 给点阵顶点记整数坐标 `v.q/v.r`；`unshearPatches()` ①补丁连通条件加"方向对" ②`det=±1` 单模反解 (i,j)（`roundErr=0`）③正交等长基 + `L=√(单格平均面积)` 面积守恒 + 绕形心落位 + 仍有翻面则等比收缩；页面 `grid-graph.html?mode=patch&rigid=20&square=1` + `stats.squareInfo`。
- 读数：补丁内角偏差 p50/p90 **26.55°/29.68° → 0.00°/0.00°**；拓扑一条没动（1519 顶点 / 1331 四边格 / 242 三角格 / 512 缝边）；换种子仍 0.00°；`square=0` 与不传逐项相同；默认档 451 块 / 12.11° 不变。
- **未转 done 的理由（如实）**：①补丁缝仍有 **35 格反向**（1573 的 2.2%，三角 17 + 四边 18），缩到 scale 0.886 也压不到 0 → 真解是给补丁间**重划三角过渡带**（约束三角化/撕裂缝合），约 1–1.5 轮；②`cell.family` 仍是**换基前**轴向存根，`patchLayout` 的 `maxSpreadDeg` 失真（读数 43.46°）；③偏离三族轴向 >5° 的四边格 5.6%（跨方向对子块残留）；④浏览器探针未跑（页面只静态接线）→ `--runtime 0`。
- 规律（第 78 条）：**"补丁太碎/朝向乱"先查"坐标是不是同一套"** —— 菱形单胞的边可以落在点阵任意两个方向上，`(q,r)` 不是天然的方格坐标；不先统一方向对就换基，会把一半格子切成 45°。

## 三·229、第 229 轮（A 类仍空 → 表外一组 `1459169210752507904` 补丁级刚性：合并方向按补丁块族约束）→ **仍 partial（形制未收，账未虚增）**

**本轮一组、未转 done**：`1459169210752507904`（609 帧 / 24.4578fps / 24.9s，配文只有 "And another"）。
证据 `artifacts/coverage/1459169210752507904-review-r229.md`；新测 `tests/grid-patch-rigid.mjs`（17/17 PASS）+ 回归 `tests/grid-patch-families-browser.cjs`。
账：done **211 → 211** / partial **37 → 37**（`update-learning-counts.py` 账面 285/285）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（`where` 有模块 + 调试页，缺的是生成器形制）。该条不在 TOP 18 内，**表内无行可改**。
- 全片核验：7 张联系表 + 原尺寸 0200 全看 —— 约 **8 块**大补丁，块内方格同朝向、块间绿三角过渡带、平面正视无透视、全程只有格子调试视图。
- 核实（先核再动手）：旧 note 的「153 块 / 抖动 14.99°」属实，但根因不止「族向没约束」：**三角形逐格随机跨任意边合并** → 对角方向随机；且 `cellAxisDeg` 取首边方向，**同一个对角方向也会因起笔端点不同读成相差 30° 的两种轴向**。两条都要治，只治第一条会停在中途。
- 收口动作：`latticeAndMerge({rigid})` 按补丁块哈希取对角方向族、合并只跨该方向的边（其余留成三角过渡带，族用哈希→不消耗随机流）；刚性档四边格起点统一到最小 id 角；`familyDeg` 取 3 位小数写 `cell.family`（浮点尾差会把 101 块炸成 276 块）；页面 `grid-graph.html?mode=patch&rigid=N`。
- 读数：默认 451 块 / 最大 24 格 / 285 单格碎片 / 邻格轴向差 p50 **12.71°** → `rigid=20, mergeRate=0.95` **8 块 / 最大 959 格（72.1%）/ 单格碎片 3 / 补丁内边 98.8% / 轴向偏差 p50 1.73° / 邻格 0.78° / 三角 242**。
- **未转 done 的理由（如实）**：补丁内角偏差 p50 **26.55°**（默认档 12.11°）—— 三角点阵上单向合并只能得到 60° 菱形，松弛后 ~64°/116°，而片内是**正方**；补丁边界本仓是世界坐标方块分块，片内是折线三角带。要真对上，得给每块补丁另起一套方形子点阵（下一轮的量级）。
- 环境：浏览器探针没跑成（playwright 启动 Chromium 报缺可执行文件）→ `--runtime 0`，页面入口只做了静态接线。
- 规律（第 77 条）：**「补丁太碎」先看"轴向"是不是被两套口径读的** —— 同一块补丁里方格都同向，仍可能因为"从哪个端点起笔"被读成 30° 与 60° 两族；把起点规范化再谈"族向约束"，否则会误判成"约束没生效"。

## 三·228、第 228 轮（A 类仍空 → 一组 `1727324352264474664` 快速转镜拖抹：拖尾上限从常数 32px 改成按帧位移自适应）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1727324352264474664`（303 帧 / 33.3333fps / 9.09s）。
证据 `artifacts/coverage/1727324352264474664-review-r228.md`；新测 `tests/whip-smear-long-browser.cjs`（PASS）+ 回归 `tests/whip-smear-browser.cjs` / `tests/whip-smear.mjs`。
账：done **210 → 211** / partial **38 → 37**（`update-learning-counts.py` 账面 285/285）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（模块/页面开关/两支测试都在，缺全片核验与拖尾长度形制）。该条不在 TOP 18 内，**表内无行可改**。
- 全片核验：303 帧四张联系表 + 原尺寸 0095 全看 —— 岛在绿底上节奏性自转，每 12–18 帧一次快甩；甩镜帧拉成 3–6 层**硬切片**、沿切向、长度 ∝ 半径、最猛一次 250–300px；慢转/停转帧干净；绿底不被拖。
- 核实（先核再动手）：旧 note 的「卡点·C（算法未公开）」为过期口径；真差距是**上限常数 32px**（片内 39–47% 画幅 vs 本仓 5%）。
- 收口与读数见上（表外块）；如实记「切片质感仍软一档」。
- 规律（第 76 条）：**「卡点·C 算法未公开」里混着「参数取成了常数」** —— 归档前先量画面量级，再把常数改形参跑一遍，才判是不是真 C。

## 三·227、第 227 轮（A 类仍空 → 一组 `1371460793032716290` 墙色：Palette.png 多行贴图补页面入口）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1371460793032716290`（524 帧 / 33.3333fps / 15.72s，"I got it working within the duration of exactly 1 kid nap"，Photoshop 里改 Palette.png）。
证据 `artifacts/coverage/1371460793032716290-review-r227.md`；新测 `tests/palette-rows-browser.cjs`（PASS）+ 回归 `tests/palette-png-r56.mjs` / `tests/palette-store.mjs`。
账：done **209 → 210** / partial **39 → 38**（账簿仍 285/285）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（`where` 有模块 + 自己的页面，缺的是页面层入口）。该条不在 TOP 18 内，**表内无行可改**。
- 核实（先核再动手）：旧 note 的三条「仍待补」逐条对账 ——
  ① **PNG 热重载 = 过期账**（r168 就在本页跑通，本轮页面读数 `热更新：v1 · 2 次轮询 · 无错 · 改槽 0…14` 复验）；
  ② **多行贴图 = 真缺口，但只在页面层**：`palette-image.js` 有 `wallRow`/`imageRows`、`app.js:607` 收 `?paletteRow=`，可 `wall-palette.html` **从不传行号、也从不显示图有几行** → 站着看像「只支持下行」；
  ③ **完整渐变/色彩接口 = 不属本片**：524 帧里没有任何渐变/色彩空间面板，调色全发生在 Photoshop（那套接口属 `1712088611934371876` palette-editor / colvol 线）。
- 收口（渲染路径零改动）：`wall-palette.html` 增「墙色取」行选择器 + `#pngRows` 两条 16 格色块带（当前行高亮）+ 行数读数，`load()` 把 `&paletteRow=` 拼进 iframe；`tools/palette-png.py` 加 `rows` 模式（上行=一族错位鲜艳色、下行=全浅）供对照。
- 读数：测试图 166B / **16×2**（两行 16 格逐格不同）；页面 `rows=2`、**16+16** 格、默认高亮第 2 条；下行墙色 `#f5d5d2`族且**页面槽 == World**；换上行后 iframe 带 `paletteRow=0`、`world.palette` = `#ecdfc4`族、两行 **15/15 槽全不同**；顶点色 32748 中**只属上行 23521（71.8%）、只属下行 21944（67.0%）**，共有键仅 2411 → 换行是整墙换色。
- 画面：`palette-rows-page-r227.png`（两条色块带 + 行数读数）、`palette-rows-town-r227.png`（`paletteRow=0` 实景：墙为上行米白/灰蓝/砖红一族、**屋顶橙瓦不变**，与片内「只换墙」一致），两张均 ViewImage 看过。
- 如实：本仓不把上行渲染成「参考色条」UI（片中那是 Photoshop 的图）；上行只是可选墙色行。环境：本机负载 13–23（另有实例跑 QA 探针），swiftshader 三次把同进程第二个 WebGL 上下文的导航拖到 90–180s，已改「先关页再开新页」并把首帧重试写进测试。
- 规律（第 75 条）：**「多行没支持」先看页面传没传参** —— 模块按行取色、`app.js` 也收 `?paletteRow=`，唯独自己的页面固定不传，账面就成了「只支持下行」。判这类缺口先 `grep` 页面有没有那个参数名，别急着改模块。

## 三·212、第 212 轮（A 类仍空 → 表外一组 `1798310423554658732` 地块耕纹接回 View 主材质：真缺口是「主着色器没有世界坐标/地块/行号」）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1798310423554658732`（614 帧 / 33.3333fps / 18.42s，无原文，六边格地形工具实录）。
证据 `artifacts/coverage/1798310423554658732-review-r212.md`；新测 `tests/field-plot-map.mjs` + `tests/field-plots-main-browser.cjs`（11/11 PASS）。
账：done **201 → 202** / partial **47 → 46**；另把账面 hole 修回 **285/285**（见下「账务」）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（`where` 有模块 + 画布页，缺的是主管线接线）。该条不在 TOP 18 内，**表内无行可改**。
- 核实（先核再动手）：「尚未接回 terrainmesh 实际着色」**属实**，且比 note 写的更具体 ——
  `terrainmesh.js:187` 仍是 `hash01(c.id*19+5)*PI`（**逐格**取角）；`field-pattern.js` 的 `fieldTone(vec3 p)` 只拿到 `aField=[cos,sin,遮罩]`，
  **没有世界坐标/地块/行号** → 格内是常数色，主场景根本画不出条带；`grep field-plots` 除院落草地（`garden-plots-c07.js`）外零命中。
- 收口：新建 `src/world/field-plot-map.js`（`partitionPlots` → 世界 XZ **浮点**图：R=人字行号 / G=田埂 / B=地块色调 / A=有效，配 CPU 孪生）
  + `view-shading.js` 的 `?shade=fieldplots`（手写四抽头双线性、宽软带、田埂压暗、地块色调）；`terrainmesh` 旧口径默认不动（零行为变化）。
- 读数（真 World 169×151 纹素 / texel 0.1 / 可种格 **541** / 地块 **195** / 主轴最大夹角 **89.97°**）：
  开/关整帧 **18367 px**、噪声 **0/0**；主轴差最大的两块地（23°/113°）画面上条带方向 **95° vs 5°（差 90°）**，
  与各自主轴投影偏差 **9.4° / 6.2°**；CPU 孪生 861 点 tone **0.650–1.223**；合成 World 上块内行号最大跳变 **0.145 条垄**，
  对照「逐格 hash 取角」同一批纹素断裂 **200 处 / 最大 10.05 条**。差分图（×6 增益）里条带只铺地形顶面、每片一个方向、多处见人字折线。
- 如实：条带对比度比片内淡（程序化世界图 vs 烘焙贴图）；地块参数按片内「3–8 格一片、一屏 4–6 条带」定，未逐帧反推原作参数；片内白色 `[ ]` 标记层未复刻。
- **账务（本轮顺带修）**：`update-learning-counts.py` 报 **281/285** —— 不是文件丢了，是 4 条记录的 `reviewEvidence` 被写成**多路径拼接**
  （`a.md · b.md · …`），而校验只认单文件。已用 `record-review` 按原 status/note/stages 重记为**单路径**（`sediment-review.md` / `-r209.md` / `-r207.md` / `-shorefield-r211.md`），账面回 **285/285**。
- 规律（第 74 条）：**「aField 只有方向、没有坐标」这一型看着像缺美术，其实是缺一张世界图** —— 判断「着色没接」时先看片元函数拿到了什么：
  只有逐格常量就永远画不出条纹，补参数没用，要补的是「世界坐标 → 地块 → 连续行号」这条链。

## 三·210、第 210 轮（A 类仍空 → 表外一组 `943230624369868800` 雪点被风场带着绕岛流：运行验收补齐，机制无缺口）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`943230624369868800`（318 帧 / 33.3333fps / 9.54s，"the snow flakes are affected by the wind system and thus flow around the island"）。
证据 `artifacts/coverage/943230624369868800-review-r210.md`；新测 `tests/snow-windaround-browser.cjs`。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（模块在 `src/life/atmosphere.js`、入口在 `flow.html` 与场景能力面板，只缺运行验收）。该条不在 TOP 18 内，**表内无行可改**。
- 核实（先核再动手）：旧 note 的「Points 方点 / 统一大小与亮度 / 软片、接触 AO 仍未复现」= 过期账（第 31 次同型）—— 软圆片（`gl_PointCoord` 半径 discard + `smoothstep`）、逐粒 `aSize`（0.55–1.4499 / 901 种 / CV 0.2598）、`particleContactAlpha`（贴地更淡、离岛越远越淡）都在。
- 机制：`rebuild` 逐层占用（`world.isSolid(cell, lv+1)` → 有顶不等于下方实心）→ 两遍盒式模糊 → 按占用梯度把「撞向障碍」的法向分量减掉 + 贴边加速 + `vy=b*0.55` 上抬；`update` 逐粒积分风场、端点体素碰撞、撞到即从上风边重生。
- 改码（零行为变化）：`atmosphere.field` 增只读 `res`（世界跨度 = 格数 × res，测试不必再猜常量）。
- 读数：环上 216 采样 —— 自由流沿风 0.9996 → 最低 0.5105、55 点被压 >15%、切向 0.2179、上抬 0.275；39 个种子「直线 vs 风场」对照 —— 直线 7 条撞进岛体、风场路径 **0 步进入实心**、15 条被抬升/推偏（maxDev 0.938 / maxLift 0.365）；接触衰减 近 0.2433 < 中 0.3673 < 高 0.5509、内 0.4964 > 外 0.4286；实心体内粒子 0；反向风 ±0.774 翻转。
- 画面：纯天空带提亮 ≥30 级像素 雪开 **309** vs 噪声 **90** vs 关雪 **130**；整幅白像素 254424→**760010**（`uSnow` 混白）。
- 回归 `tests/wind-snow-browser.cjs` PASS（mixed/quad + town/terrain/fusion 三场景）。
- 如实：残差 = 美术/口径（片中雪帽为几何厚帽，本仓只有朝上面薄层混白、不上立面；雪点密度/尺寸档比片内小；1–2px@33fps 无法逐粒追踪）。
- 账务发现：`update-learning-counts.py` 报 **282/285** —— `1699038611125985317` / `1768627849529893109` / `1769641473895432220` 三条 `reviewEvidence` 指向的文件在盘上不存在，已写进 `next`。
- 规律（第 73 条）：天空带里飘云也在动 —— 雪开/关原始差分（~1.0e3 px）与同状态噪声（~5e2 px）同量级，直接比会假红；按「提亮 ≥30 级」数点才分得开；整幅白像素增量来自表面混白而非雪点，必须分开记。

## 三·206、第 206 轮（A 类仍空 → 表外一组 `906207980802252801` 岛周薄雾：流速档作用到雾片 + 页面旧口径纠正）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`906207980802252801`（326 帧 / 33.3333fps / 9.779s，"new fog (sped up)"）。
证据 `artifacts/coverage/906207980802252801-review-r206.md`；新测 `tests/fog-wisps.mjs` + `tests/fog-wisps-browser.cjs`。
账：done **192 → 193** / partial **56 → 55**（285/285 账面不变）。

- 取组：TOP 18「路径」列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取这条（`where` 有模块+页面，只缺雾片层运行验收）。该条不在 TOP 18 内，**表内无行可改**。
- 核实（先核再动手）：旧 note 的「仍是圆盘近似，未迁移原 FogLayer 软片/风场平流与体积/遮挡」= 过期账：`makeFogWisps`（定种子环带布点 + 风场平流 + `probes.occupied` 侧绕/停等/回卷）与 `atmosphere.fogSheets`（12 片扁卡、软边 `1-smoothstep`、三倍频 wisp、`band=1.35` 高度带、近距淡出）r56 就在，`index.html` 场景能力面板「岛周薄雾」+ 雾参数滑杆是入口。
- 真缺口（都在页面/滑杆侧）：① **流速滑杆对雾片层无效**（`step()` 只乘每片自带 speed、片元噪声直接用 `uTime`）→ 加 `rate` 形参与片元 `uTime*uSpeed`，默认 1 逐像素等价；② `wake-fog.html` 页头仍写「雾是淡色圆盘近似…未复现体积雾」→ 改写两层实况 + 实时读数条；③ 补 `fogStats()`/`wispStats()` 只读账。
- 读数：12 片/实例 12/体内 0/长宽比 0.365/y 带 0.342–1.289；流速 0 推进 1s 位移 **0**、流速 1 **0.910**、风向余弦 **1.000**、流速 2 = **2.000×**；只雾片层开/关 **10304/9610 px**、两层 **27488/25984 px**、最大 **27/25 级**、噪声 **0**、流速 0 下时间轴 1.2s **0 px**。
- 回归 `wind-flow.mjs`、`wake-fog-browser.cjs` PASS。
- 如实：雾斑比片内小且更碎（alpha 上限 ≈0.042）、平面卡片不是体积雾、原片加速 gif 速度不反推；1s 内 detours/blocked/wraps 运行读数 0（雾片在岛外环带，由 node 侧构造遮挡覆盖），深度遮挡未做逐像素隔离测量。
- 流程：开工时另一实例在 17:59–18:25 写 r204/r205 证据且未持锁 → 本轮取编号 206 避撞号，并把该并发写账提示记进 CHANGELOG。

## 三·203、第 203 轮（A 类仍空 → 表外一组「地表纹理阴影」两档 `1704218784028905984` + `1705195380457996629`：投射高度与 z 测试解耦 + 页面落点入口）→ **✔ 已收口（2/2 片转 done）**

- 取组：TOP 18「路径」列全 `✔`，无裸 A；按「A 吃完再取 B、一次 1 组」取同一模块的上下两档（335 帧「太 3D」版、300 帧「只剩草崖边与屋檐」版），**表内无行可改**。
- 核实：旧 note 的「仅地面 2.5D 近似，屋檐/洞内/UV 接缝未复现」= 过期账：`bakeSurfaceShadow` 的 `castHeight` 与 `zBias` 早已独立，`surfaceHeightsFromWorld(roofRise)` 让屋檐投影、`bakeFloorShadow` 给洞/悬挑地面烘第二张图、`surfaceShadowStats` 出崖缘/檐下/别处份额。真缺口只在页面：`surface-shadows.html` 缺瓦檐抬升、接收面（顶面/＋洞内）与落点统计，提示语还是旧句。
- 收口：页面补三处入口（零改渲染）；新测 `tests/surface-shadow-landing-browser.cjs`：门槛 0 覆盖 14.28%/12.65% → .6 覆盖 5.46%、崖缘 99.8%、别处 1px、洞内 143/65px、GPU 差分 12325/8325px、噪声 0；回归 `surface-shadow-casters.mjs` / `view-shading.mjs` PASS。
- 如实：地形场景无建筑顶面 → 本页檐下份额 0，「屋檐」由 `surface-shadow-casters.mjs` 夹具断言；纹理浮凸与 UV 接缝仍不覆盖。
- 规律（第 72 条）：**「已实现但页面只有一半旋钮」这一型，读数会骗人** —— 页面把 receivers 钉在 `top`，于是「洞内未覆盖」看起来像机制缺口，其实是下拉框少一项。

## 三·202、第 202 轮（A 类仍空 → 表外一组 `1664565063552847873`：平流场假彩色铺面 —— 真实 World 几何 + 浮点纹理 + CPU 孪生）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1664565063552847873`（117 帧 / 16.67fps / 7.02s）。
证据 `artifacts/coverage/1664565063552847873-review-r202.md`；新测 `tests/float-bands-browser.cjs`（11/11）。
账：done **179 → 180** / partial **69 → 68**（285/285 账面不变）。

- 取组：TOP 18 路径列仍全 `✔`（A 类空）→ 按「A 吃完再取 B、一次 1 组」取 r198 挂下的 `1664565063552847873`（r198 已判「只剩形制、无算法缺口」，正好一组）。
- 核实：旧 note 的「平流待补」确实是过期账（`float-advect.js` 全在、`float.html` 有 16F/32F 真读数）；真缺口就是**没有一张把场铺到几何上的页面** —— `grep -n "palette\|falseColor" *.html` 零命中。
- 改码：新建 `src/world/float-bands.js` + `float-bands.html`（页面走 `overhang.html` 同款 iframe 拿 `rea`，不碰 `view.js` / `worldmesh.js`）。
- 读数：几何来源 `worldMesh.geometry.clone()` **12854 三角 / 38562 顶点**（与真实网格逐数一致）；色带占画幅 **76.0%**；色相档 **18**；相邻色相 >25° 只 **0.36%**（中位 0.39°、p90 1.18°）。
- 动：0 → 120 步变化 **63.6%** 像素、平均 **18.55 级**（同一判据在正圆盘初值下只有 4.3% / 1.38 级 —— 见下条坑）。
- 对表：`probeGrid(10)` 撒射线命中点 **76/77** 点 GPU 与 CPU 孪生 Δhue<12°，**中位 0.00° / p90 0.49°**（着色系数逐点单独复算）。
- A/B：8 级量化 → 色相档 **18→10**、离散色 **2583→441**、跳变 0.36%→1.04%（证明连续性判据有分辨力）。
- 截图：`artifacts/coverage/float-bands-step0-r202.png` / `-step40-r202.png` / `-quant8-r202.png`，三张均 ViewImage 看过（连续档色带随台地/崖壁弯折、天空露青；量化档是一圈圈硬台阶）。

> 规律（第 202 轮补两条）：
> ① **初值对称会让「在动」的验收假红** —— `seedBlob` 是同心圆盘，绕中心旋转是旋转不变量，120 步只差 4.3%；把初值换成 正圆盘 + 两个偏心斑 + 一道斜脊 后同口径差 63.6%。凡「场/纹理在动」的判据，先确认**被测变换对该初值不是不变量**。
> ② **对表别拿格心当采样点，要拿射线真正命中的世界点** —— 第一版用「格顶中心」投影对色，只有 29/60 对得上（前方高格的侧墙挡在点上，读到的根本不是那个 xz）；改 `Raycaster.intersectObject(bands.mesh)` 取 `hit.point` 后 76/77、中位 0°。另外量色带前必须把 `view.scene` 其余 23 个子对象隐掉（水面按真实 dt 在动 → 「同状态噪声」永远不为 0）。

## 三·201、第 201 轮（A 类仍空 → 续收 r200 挂下的同一条 `807256278154301441`：平顶平台档 → done）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`807256278154301441`（344 帧 / 16.6184fps / 20.70s）。
证据 `artifacts/coverage/807256278154301441-review-r201.md`；新测 `tests/flat-terraces.mjs` + `tests/flat-terraces-browser.cjs`。
账：done **178 → 179** / partial **70 → 69**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」续取 r200 自己挂下的首选（表外单条自成一组），**表内无行可改**，故本小节记收口。
- **核实（先核再动手，口径被修正）**：r200 判的「平挑台 + 逐层临空栏杆」成立，但形态要改口径 —— 4 张联系表 344/344 帧 + frame-0030/0300 的 4× 裁切逐层看：**每层顶面是平台**（同一暖橙面、无脊线、无两面明暗差），临空边一圈**矮护墙 + 浅色压顶**，护墙下**白色腰线**外挑，平台面上直接坐烟囱，**全片没有一处坡顶/山墙** → 这不是「给坡顶补栏杆」，是**整套平顶平台档**。
- 本轮改码（默认关）：`buildings.js` 新增 `flatRegionRoof()`（平台板 + 沿临空边的护墙/压顶 + 檐下白腰线 + 坐地烟囱，`gables` 恒 0，只读账 `roofStats.flat*` 与逐区 `flatTerraces[{minId,h,cells,base,deckArea,rimSegments,rimLength,chimneys,minY,maxY}]`）；`buildRoofs` 里 `world.flatRoofs` 分支先于坡顶/直骨架；`app.js` 加 `?flatroof=1`。
- 关键手法：护墙与腰线走 `w.beam`（闭合棱柱）而不是手写四边形 —— 第 56 条「薄条单面被自身绕序吃掉」的反面用法，侧视俯视都稳。
- 读数：多层塔夹具（`?multitile=3&mth=6`）关档 `flatRegions 0 / verts 8427` → 开档 **11 区 / 16 格 / 39 护墙段 / rimLength 22.91 / deckArea 4.7869 / 6 烟囱 / verts 10173**，`hMax 0.310`；像素 A/B **70216 px**、同状态噪声 **0**、开→关→开顶点哈希 `463932703 → 1488906183 → 463932703`（逐顶点复原）；`?flatroof=1` 单开同样 11 区。
- node 侧：6 组 quad/mixed 世界共 **148 区 / 455 格 / 953 护墙段 / 149 烟囱**；每格「恰在 h·L 上的水平面面积」== 格多边形面积（<1e-6），默认档该量 **<0.5**（坡顶没有水平整板）；护墙段数/长度 == 独立重算露边（1e-9）。
- 回归 `hip-skeleton.mjs` / `house-village.mjs` / `courtyards.mjs` / `building-components-browser.cjs` 全 PASS。
- 新坑（累积第 72 条）：**「缺栏杆」这类判断要先分清是补配件还是要补整套档位** —— 本片顶上根本没有坡顶，补栏杆等于给不存在的坡顶挂配件（r200 试改 0px 就是证据）；先把「顶面是什么形状」按帧定死（水平整板 / 起脊 / 拱顶），再决定动哪个函数。
- 如实（美术/口径差，不是机制缺口）：护墙为方棱柱（片内圆角倒角）、白腰线是平带（片内雕花线脚）、烟囱按 34% 概率落（片内更密）、平台档是整岛全局档（片内每层都是平台，故不做逐格判定）。**无剩余机制缺口。**

## 三·200、第 200 轮（A 类仍空 → 表外一组 `807256278154301441`：红砖多层塔 —— 「群体寻路」前提撤销，缺口收窄到多层平挑台栏杆）→ **仍 partial（账未虚增，done 不变）** → **第 201 轮已收口（见上）**

**本轮（1 条，partial → partial）**：`807256278154301441`（344 帧 / 16.6184fps / 20.70s，"Looking at cheap swarm pathfinding. These dots could possibly be crabs …"）。
证据 `artifacts/coverage/807256278154301441-review-r200.md`；账：done **178 → 178** / partial **70 → 70**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。该条不在 TOP 18 内，**表内无行可改**。
- **核实（先核再动手）**：旧 note 的「群体寻路及多格完整规则未验收」里，**「群体寻路」前提撤销** —— 4 张联系表 344/344 帧 + 4× 裁切确认：片中紫色球簇有树干、叶簇分层、随楼体增删、整段不位移，是**树冠**；原文 "could possibly be crabs" 是作者自己的猜测。r56 据此建的 `life/crab-swarm.js` 属本仓扩展，不再记作该片缺口。
- **真实机制**：多层砖塔的**平挑台 + 逐层临空栏杆** + 外挂石阶 + 拱洞门 + 三色附属体块。
- **差距（真缺口）**：`src/build/buildings.js` 的栏杆只在 `h === 1` 地面院落收集、绘制段 `y = L` 恒定；屋顶系统只出坡顶/山墙，**没有平屋顶平台档** → 片内「每层砖塔顶面平挑台 + 临空栏杆」本仓无法表达。
- **试过一条改法并回滚**：在 `runTop && lv < h` 的挑台处按 `tops[nb] < lv` 补栏杆 + 只读 `railings` 账 → `?multitile=3&mth=6` 塔夹具只出 **1** 条（level 2），开/关像 **0 px**（塔柱实心、几乎无挑台），覆盖面量不出来 → 改码与临时测试一并回滚，仓库默认行为未变。
- **下一轮**：要做这条就得先给屋顶系统加「平顶平台」档（`world.flatTerraces` + `buildRoofs` 跳过该格 + 顶面铺砖 + 临空边栏杆），再回来验；否则维持 partial。
- **新坑（累积第 71 条）**：「像生物群的小球簇」先找树干/位移/生命周期三条证据再定性 —— 三条都不满足才是群；否则原文的 "could be" 只是作者猜测，不能当机制。

## 三·199、第 199 轮（A 类仍空 → 表外一组 `1242824460325052417`：倾斜菜单接主场景 —— 几何/配色/深度计数按片内重标）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1242824460325052417`（383 帧 / 29.8287fps / 12.84s，"Finally making some proper UI. Turns out you can make a boring list of buttons playful by just tilting them slightly."）。
证据 `artifacts/coverage/1242824460325052417-review-r199.md`；新测 `tests/playful-menu-main-browser.cjs`（30 项 PASS）。
账：done **177 → 178** / partial **71 → 70**（285/285 账面不变）。

- 核实：旧 note 的「【卡点·D 需接主管线】原布局/图标API及游戏菜单尚未完整接入」= 过期账（第 63 次同型）——
  `src/core/playful-layout.js`（文件头署本片 ID，`playfulJitter` 的 gap·0.45 二分回退 + `layoutList`/`GLYPHS`）在，
  菜单本体（真实 `pushUndo`/`world.reset`/`encodeWorld`/`undo`/`redo`/`setDebug` 命令、✕↔≡ 开合、双联）早在
  `src/ui/game-ui-c06.js`，`app.js:520` 用 `?gameui=1` 挂到主场景。
- 片内三段（右带奶油底色逐帧判，383 帧全判）：0–77 关 / 78–332 开 / 333–358 关 / 359–382 开。
- 三处真形制差（本轮改）：① 行高一律 34、宽写死 200 → 主行动 60 / 次级 36 / 双联 74×65 / Grid 45、面板宽 32.6vw、行宽 = 面板 91%；
  ② 颜色原为 `colorFor()` 色相坡 → 片内是**按功能固定**四色（绿 198,240,181 / 红粉 241,181,175 / 奶油 241,223,192 / 浅蓝 180,201,225）；
  ③ 补 Undo/Redo **深度数字**（读真实栈）与 Grid **第二枚圆**（单独开 `gridregular`），✕ 打开时左移为面板让位。
- 验收读数（主场景 512×512 与片内 1:1）：面板宽/视口 0.326 / 行宽/面板 0.912 / 行高 60·60·36·36·36·65·65·45（±4）/
  倾角 −2.28…+1.67° 有正有负且重载逐字复现 / 未旋转命中槽 minSep 0.00 overlaps 0 / 开合差分 72681px **100% 在面板内** /
  同状态 704px（0.27%）全在面板内（旋转文字光栅抖动）/ 0 真实 error。回归 `game-ui-icon-commands-browser` PASS。
- 如实：本仓另有 learn/环境/进度浮层会与菜单叠在一起（片内无此 chrome）；图标为字形近似；倾角逐行落点与片内不同（只保证区间与变号）。

## 三·197、第 197 轮（A 类仍空 → 表外一组 `1712088611934371876`：节点式调色图 —— 画布定尺 / 12 段色带 / 无损导出）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1712088611934371876`（624 帧 / 21.4802fps / 29.05s，"Another take on a palette authoring tool"）。
证据 `artifacts/coverage/1712088611934371876-review-r197.md`；新测 `tests/palette-graph-editor-browser.cjs`（PASS）。
账：done **176 → 177** / partial **72 → 71**（285/285 账面不变）。

- 核实：旧 note 的「OkHsl/OkLab、自由拖点/导出仍待补」= 过期账（第 54 次同型）—— `palette-editor.html` 第 56 批 `#pg` 段
  + `src/core/palette-graph.js`（163 行，`facets/quadFacetAt/moveNode/addNode/addTriangle/addGradient/exportGraph/importGraph/colorWorldByGraph`）
  + `src/core/okhsl.js` / `oklab.js` + `src/world/ground-palette-map.js` 全在，node 测试 `palette-graph.mjs` 一直绿。
- 片中三段（0050 窄矩形+三档滑条 / 0300 三块样本+右键三项菜单 / 0520–0560 完整图形+12 段色带+OkHsl·OkLab·Srgb 菜单）；
  **全片无 3D 场景** → 「全材质接入」按 r127 先例不记缺口。
- 三处真形制差（本轮改）：① 画布被 flex 拉到 1213×1434、面片发虚且 `offsetX`(CSS px) 与命中(属性 px) 差 2.76× → 定 440×520；
  ② 色带条原为 156 色 palette strip 挤 1px 再拉伸 → 改 12 段 12px + 2px 缝隙；③ `exportGraph` 只写 8bit hex → 往返调色板 142/156（91.0%）
  → 增写浮点 `rgb`、`importGraph` 优先取浮点，往返 `maxNodeErr 4.7e-7` / 156-156。
- 验收读数：画布 1:1（440×520，scale 1）/ paintedPx 228451 / 144 面片色两两不同 / facets↔quadFacetAt 质心 0 处不一致 /
  拖点 dx0.4033·dy0.2000 / 三档滑条 3 行（RGB·LAB·HSL）/ 右键三项 → 9 节点·2 三角·160 面片 / 三档面片空间中点色互异 /
  `#pgApply` 后 `gpm.facetsUsed 104`、World version 672 不变 / 0 console error。
- 如实：色带空间在本仓是下拉框（片里是右键弹菜单，选项同名同序）；细分步长可选 1–16（片内固定 8/4）。
- 另：本轮开工时锁被批次 `2026-11-24T05:26:19` 抢占且心跳停在那一刻、无进程在跑；本轮未 `start`（疏漏，只写自己那一条），收尾按陈旧锁 `end`。

## 三·196、第 196 轮（A 类仍空 → 表外一组 `1764958522398146667`：二叉树矩形打包器 —— 2D 树线可见性 + 三段镜头运行验收）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1764958522398146667`（296 帧 / 13.3333fps / 22.20s）。
证据 `artifacts/coverage/1764958522398146667-review-r196.md`；新测 `tests/atlas-tree-phases-browser.cjs`（PASS）。
账：done **172 → 173** / partial **76 → 75**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该条不在 TOP 18 内（表外单条自成一组），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：旧 note 的「原 3D 树和完整 RectBin/shelfPack 接口仍缺」**= 过期账（第 53 次同型）** ——
  `src/core/atlas-c09.js#treeLayers/#project3D`（r56 落码）+ 页面 `atlas-tree-c09.html?view=3d&pitch=&yaw=&spin=1`；
  `src/core/rectbin-c08.js`（leaves/canPlace/place/remove/recursiveFill/report/churn/treeNodes）+ `atlas.js#shelfPack`；
  `tests/rectbin-c08.mjs` / `rectpack-compat.mjs` / `c09-life.mjs` / `atlas-tree-arm-browser.cjs` 一直绿，缺的只是「按片子三段镜头量一遍」的运行验收。
- 片子三段（联系表 3 张全看 + 原尺寸 0000/0030 裁切/0140/0222/0276）：① 0018–0049 从**板子左下角**逐块堆、板内是**浅色**树线、落位处黄框 + 青色直角手臂；② 0050–0269 倾成 3D，每深度一层节点框叠在板面上方、根最上、白树枝只连相邻层；③ 0270–0295 回**近俯视**，层叠压成「梳齿」贴在板面上，彩块全满 + 黄框。
- **真形制差（1 处，本轮改码）**：片内 2D 段的树线是浅色（0030 原尺寸可见空间怎么被切开），本仓 2D 用 `#121118` 深色描叶框 → 在 `#3d3b4a` 底上看不见 →「树把空间切成叶」这层读不出来。改：整板一圈深色细框（片里就是深框）+ 叶框 `rgba(240,246,244,.55)`。3D 分支不动。
- 验收读数（900×900，`getImageData`）：2D 18 块 minX=minY=0、浅线 **5898px**、黄框 362px、青臂 896px；
  3D 38° 节点 243=2×122−1、树枝 242、层 28=树深+1、根层最高、跨度 **243.3px**、上半部墨量 50104px、白树枝 13349px、彩块 37479px；
  近俯视 86° 跨度 **69.4px = 38° 的 0.285**、上半部墨量 15991（31.9%，仍在画）、彩块 30313（80.9%）；同 URL 重开噪声 **0**、0 error。
- 回归：`rectbin-c08.mjs` / `rectpack-compat.mjs` / `c09-life.mjs` / `atlas-tree-arm-browser.cjs` / `atlas-remove-frag-browser.cjs`（浅色树线不影响洞占比口径）全 PASS。
- 如实：本仓树深 27 层 vs 片内约 15 层（guillotine 长链）→ 3D 塔更高更密；3D 是 2D canvas 正交投影不是 WebGL；片内倾倒是连续动画、本页 2D/3D 瞬时切换（绕转靠 `?spin=1`）；手形光标是录屏 artifact。
- **下一轮建议（第 197 轮）**：① 先收 `tests/battle-navigation-browser.cjs` 穿洞用例（r174 起红，已挂 6 轮）；
  ② `1242824460325052417`（383 帧·倾斜菜单叠在真实小镇上，本轮抽帧已看过：0070 起白面板 7 行 + X，`ui.html` 仍是「未绑定游戏操作」的本地 demo，判 B：要接真游戏菜单）；
  ③ 或 `1712088611934371876`（palette-patch 自由拖点/导出/全材质接入）。
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·195、第 195 轮（A 类仍空 → 表外一组 `995034777756536833`：指挥官能力键 / Plunge 形制 + 运行验收）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`995034777756536833`（564 帧 / 29.2379fps / 19.29s·无原文）。
证据 `artifacts/coverage/995034777756536833-review-r195.md`；新测 `tests/ability-bar-plunge-browser.cjs`（31 项 PASS）。
账：done **171 → 172** / partial **77 → 76**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该条不在 TOP 18 内（表外单条自成一组），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：旧 note 三件「空白」全在 —— 三键 HUD / `castPlunge` 校验+跃起+白环+伤害 / `#toast` 黑条；入口是环境面板勾选框。判 **A（只缺运行验收）**，另补三处真形制差（名牌位置上移带指针、黄高亮环、亮键即校验）。
- 读图依据：`sheet-00`（0000–0199 底部无任何圆钮、顶部无黑条）、`sheet-02`（0200 起黑条常驻）、
  `995034777756536833-ui-crop.png` 4× 裁切（三钮只露上半、中间被黄圈套住、上方 `Plunge` 名牌带朝下三角、左右两颗明显更暗）。
- 验收要点：`arm()` 无目标 → 黑条同帧 + 不进冷却；有目标 → 真鼠标点地面 `plunges 1 / hits 1 / shocks 1 / cooldown 9.283`；冷却弧与 `169.6·(1−cd/10)` 差 <0.05；关档差分 6861px 全在条带、噪声 0。
- 如实：片里能力键贴画幅下沿，本仓为让开页脚工具条抬到 `bottom:72px`；钮径 5.18% vs 片内 7%；另两钮灰占位（片里功能从未展示）；落地过程片内未拍。
- **下一轮建议（第 196 轮）**：① 先收 `tests/battle-navigation-browser.cjs` 穿洞用例（r174 起红：`tunnelSamples=0` / `pathMaxY=1.55`，已挂 5 轮，先判真回归还是夹具口径）；
  ② 表外 B 一组 `1764958522398146667`（atlas 3D 树/RectBin）→ **第 196 轮已收口（判 A：过期账，只补 2D 浅色树线 + 三段镜头验收）**；
  ③ 或 `1712088611934371876`（palette-patch 自由拖点/导出/全材质接入）。
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·194、第 194 轮（A 类仍空 → 续收 r193 挂下的同一条 `1178731576982724611`：地块尺度 —— 大田判据）→ **✔ 已收口（转 done）**

**本轮实收口（1 条，partial → done）**：`1178731576982724611`（333 帧 / 16.6667fps / 19.92s·"I made some grassy plots… Eventually, they'll grow some trees and the like."）。
证据 `artifacts/coverage/1178731576982724611-review-r194.md`；新测 `tests/garden-big-plot.mjs` + `tests/garden-big-plot-browser.cjs`。账：done **170 → 171** / partial **78 → 77**（285/285 账面不变）。

- **A 类仍空**：TOP 18 的「路径」列已全 ✔、无裸 A；该条不在 TOP 18 内（r193 挂下的首选，单条自成一组），**表内无行可改**，故本小节记收口。
- **先核再动手（本轮又抓到一处过期/误判）**：r193 记的另一半缺口「0260–0332 的部位分色视图不含草地分区」**不是缺口** —— 4 张联系表全看 + 0280 的 8× 裁切确认：原片整个分色视图**只给建筑部位上色，草地/地面始终是同一种橄榄绿**（靠浅色石沿区分），本仓 `debugParts` 也不给草地上色，形制本来就一致。故本轮**不**加「按草地块分色」，免造一个原片没有的东西。
- **真缺口（只剩这一条）**：`partitionPlots` 一律 `maxPlot=5`，而片 0095/0250 中央是一整片**内部无石带**的不规则大田，目测 ≈4–5 格见方（10+ 格）→ 形制偏碎。
- **判据（片内只给形状、不给算法，按可量的事定）**：① 草格 ≥ 2×9=18 才切大田（切完还剩 ≥9 格能再分小块 = 片里「大田 + 小块共存」）；② 大田 = 草格 ×0.55，夹在 [9,16]；③ 生长规则 `growBigField`：从「邻居最多的草格」起，每步吃「与本区域共边最多」的候选（并列取 id 小），**纯确定无随机**；④ 余下仍按 2–5 格切；⑤ **单格地块保留**（片 0095 右上确有单格圆角草台，8× 裁切里石沿内确有草 —— 上一版草拟的「最小 2 格」是错的，已删）。
- 改码：`build/garden-plots-c07.js` 新增 `growBigField` + `planGardenC07(…,{maxPlot,bigField,bigMin,bigMax})` + `stats.bigPlots/bigCells/plotSizes`、地块带 `big` 标；`build/buildings.js` 透传 `world.gardenRules` 并暴露 `gardenC07.plotSizes/bigPlots/cellsOfPlot`；`world/view-c07.js` 加 `?bigplot=0` A/B 档（默认 0.55 出大田）。
- 读数（`index.html?scene=town&grid=quad&c07=gardenplots,quayyards`）：真实小镇 院格36 / 地块10 / 草格25 / 尺寸 `5,4,3,2,2,2,2,2,2,1` / **大田 0**（最大院子草格只 9 < 18，判据有下限）；人工院子（清空世界后铺「一圈 3 层楼围住、内 42 格空地」）院格42 / 地块8 / 草格37 / 尺寸 `16,5,5,4,3,2,1,1` / **大田 1（16 格 = 上限）**；同院 `bigField:0` → 11 块 `5,5,5,5,5,4,4,1,1,1,1`、无大田。守恒：草格+小径格==院格（25+11=36 / 37+5=42）、地块之和==草格。
- 验收：`garden-big-plot-browser.cjs` PASS（A/B 差分 **80617 px**、同状态噪声 **0**、`?bigplot=0` 确写进 `world.gardenRules`、0 页面错误）；回归 `quay-yards-plots-browser`（默认 12/8、quay 36/2/89 一字不变）/`garden-paths-door-first-browser`/`garden-browser`/`courtyards.mjs`/`field-plots.mjs`/`garden-paths.mjs`/`c07-look.mjs` 全 PASS；另顺手修 `c07-look.mjs` 两条陈旧断言（「每块≤5」→「除至多一块大田外≤5」；`C07_KEYS.length` 7→8，sungizmo 进 C07_KEYS 后这条一直是红的）。
- 如实：草色比原片亮（原片橄榄绿、本仓草色更鲜）、院内树与小径会盖住一部分草坪 → 形制判定靠近景 + 差分 + 读数，不靠截图观感；此两条属美术差，非机制缺口。

## 三·193、第 193 轮（A 类仍空 → B 一组 `1178731576982724611`：临水空地也算院子 → 草地块铺到岸线）→ **仍 partial（地块尺度未收）** → **第 194 轮已全部收口（见下）**

- 核实（先是纠错）：第 190 轮记的「高层台地 grassPlot 未实现」是**误判** —— 本仓 `h>=2` 的格子是**房屋**（顶面走 `buildRoofs`），
  片子里并不存在"楼上一层草坪"；4 张联系表 + 0000/0095/0250 原尺寸重看后，草地全在**码头层（tops=1）空地**上，
  真正与片不符的是**「围合」的定义**：片子里贴岸那片大草地，靠水一侧只有码头护墙 + 栏杆，而 `classifyCourtyards` 把水侧当"缺墙层"，
  整块地进 `openComponents` → 一格草都不铺（实测默认小镇：院格 12、开口组件 8，最大一块 117 格、55 条边朝水）。
- 改码：`core/courtyards.js` 加 `quayWalls`（水侧 `tops===0` 与网格外按码头护墙算封边，并回报 `quaySealed`；街道缺口仍算开口不做放松）；
  `build/buildings.js` 透传 `world.quayYards` 并暴露 `buildStats.quaySealed`；`world/view-c07.js` 新增 `?c07=gardenplots,quayyards`。默认档不动。
- 读数：院格 **12→36**、开口组件 **8→2**、quaySealed **89**、地块 **2→10**、草格 **9→25**、小径格 **3→11**、中心圆台 1→2；
  新测 `tests/quay-yards-plots-browser.cjs` PASS（草格+小径格 == 院格，无溢出）；`tests/courtyards.mjs` / `tests/garden-paths-door-first-browser.cjs` 回归 PASS（默认档 12/2/9 一字不变，A/B 158459px 噪声 0）。
- 仍缺（所以保持 partial）：**地块尺度** —— 片子中央是一整片 10+ 格的大田，本仓 `partitionPlots` 上限 5 格（`maxPlot`）→ 形制偏碎；
  且片尾 0260–0332 的部位分色视图不含草地分区。下一轮先定「大田 vs 小块」判据再动 `maxPlot`。
- 证据：`artifacts/coverage/1178731576982724611-review-r193.md`；截图 `artifacts/coverage/garden-quay-{plain,garden,quay}.png`。

## 三·192、第 192 轮（A 类仍空 → 表外一组 `1246074663546916873`：道具出现/消失的时间曲线按片内读数重标）→ **✔ 已收口**

- 组：表外单条自成一组（TOP 18 的「路径」列全 ✔，A 类仍空）；306 帧 / 33.0097 fps / 9.24s；`partial → done`。
- 核实（先核再动手）：r190 记的「代码仍缺稳定道具键 / 保留消失几何 / 逐道具缩没 / 原 CPU 接口」**全是过期账** —— `src/core/prop-anim.js`（`PropLifecycle`：稳定 key、重建不重放、消失期留槽位几何、每槽 `(x,y,z,scale)` 记录表）与 `src/world/prop-anim-layer.js`（合并网格 + `aPropSlot` + 记录 DataTexture + `propScaleGLSL` 绕根点缩放）r55 就落码，`prop-anim-yard-r56.js` 又把后院真树接进来，文件头都署本片 ID。
- 真缺口两条：① **曲线不对** —— 默认走 r53 弹簧（ζ=.6 → 9.5% 过冲、0.35s 收），片内是 **1.372× / 0.121s**、消失 **1 帧**；② **没有运行验收**（`runtimeAccepted` 一直 false，`prop-anim-browser.py` 要 python playwright，本机跑不了）。
- 片内读数（本轮重看 4 张联系表 + 原尺寸 0223/0224/0225/0260/0261/0265）：0223 草皮+绿篱+灌木 → 0224 石板+十来丛小灌木，绿像素 7077→86→25→11→9，**可见塌陷只 1 帧**；0260 庭院全灰 → 0261 回填到 9717 = 稳定 7085 的 **1.372×** → 9423/8563/7870/7085，4 帧 0.121s 单调回落。**错峰片内证不出**（每次整组同帧切换）。
- 改码：`prop-anim.js` 加 `PROP_TIMING`（`appearPeak 1.372 / appearRise 1 帧 / appearSettle 0.121 / vanish 1 帧 / slotHold 3 帧`）+ `appearAt/vanishAt/timelineScale`，`PropLifecycle` 加 `timing`/`curve:'clip'|'spring'`（**默认 clip**，`outLife` 默认 0.091s 槽位保留期；旧 `springValue/scaleAt` 原样保留可回退）；`prop-anim-layer.js` 透传并加 `probe()`；三个既有测试的「+0.05s 仍收缩」采样点改到半帧。
- 验收：`tests/prop-anim-clip-timing.mjs` PASS（peak 1.372 / 半帧 0.75 / spring 1.095 对照）+ `tests/prop-anim-clip-browser.cjs` PASS（默认档 `clip`；静置全 1；删格后 1→0.75→0；槽位 27→27→-1；整页差分 3854px；回填 +1 帧 **1.371999979**、+0.6s 归 1；峰值 vs 稳态差分 418px、噪声 **0**、控制台 0 错误）；回归 `prop-anim.mjs` / `prop-anim-layer.mjs` / `yard-props-r56.mjs` 全 PASS。
- 口径：页面开档 `index.html?scene=town&yardanim=1`（后院真树）/`?propanim=1`（派生木箱/系缆桩）；**默认档仍为关** —— 默认开会让 162 支按静态像素基线的浏览器测试整体位移，属口径选择不是机制缺口；错峰为本仓扩展。
- 证据：`artifacts/coverage/1246074663546916873-review-r192.md`；截图 `artifacts/coverage/propanim-clip-{settled,vanished,appear,after}.png` + `-appear-zoom/-settled-zoom`（ViewImage 看过；如实记：小件在主机位只有几十像素，37% 冠幅差靠读数与 418px 差分，不靠截图讲故事）。

## 三·190、第 190 轮（A 类仍空 → 一组 `816332161036984320`：阻力弹道扇面的二次阻力档 + 碰撞截断撤销 + 第三参数）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`816332161036984320`（177 帧 / 13.2287fps / 13.38s·无配文）。
证据 `artifacts/coverage/816332161036984320-review-r190.md`；新测 `tests/trajectory-drag-model.mjs` + `tests/trajectory-fan-drag-model-browser.cjs`（10 项 PASS）。
三条旧缺口逐条核实：① **「场景碰撞截断」撤销** —— 两页联系表 + 0040 右半 3× 裁切里全片没有任何实体块，弧线只被地面线与视口边界截断（按「片中没拍到的机制不记缺口」，r127 先例）；
② **「二次阻力档」是真缺口，本轮落地**：`throwArc/heightAtX/solveLaunch/launchGrid` 全线 `dragModel: linear|quadratic`（RK4 + 落地 y 回插 + `quadMaxReach` 带缓存先否掉够不着的格点），页面 `#model` 档位 + `?model=quadratic` + 射程上界读数；
③ **「Inspector 第三行读不到」过期** —— 4× 裁切确认第三行存在但被面板下沿裁掉只剩字符顶部（`G…`），`Gravity` 滑杆 r56 就在。
片内可判性已量化（不是猜）：把二次档 k 拟合到与线性档同 45° 射程（7.99/0.83 ↔ 7.99/0.15，射程 3.870 对 3.870）后，两条轨迹最大高度差 **0.0731 单位 = 1.89% 射程**（顶点 1.244 vs 1.197），片中 1 单位 ≈ 43px → **≈2px**，小于 25px 划线长度且低于 JPEG 噪声，故页面给两档切换、不硬选一种。
读数：linear maxRange 5.1223 / 查找表 100 solved、76 unreachable；quadratic 2.1699 / 34、142（射程上界 1.59）、青点 12134→10053；同档重绘噪声 0、linear→quad→linear 像素回位。
顺手修 `tests/trajectory-fan-browser.cjs` 的口径错（旧断言按平地 45° 解析射程比 drag=0 射程，但页面地面画在画布下沿 `groundY=−2.4737` → 应为 `(v/g)√(v²+2g|groundY|)`；改后 PASS，读数 8.004 对 8.004）。
账：done **167 → 168** / partial **81 → 80**（285/285 账面不变）。

## 三·189、第 189 轮（A 类仍空 → 一组 `1279107097108635649`：拼图块目录的部位分色 —— 基座/屋顶两族签名色）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1279107097108635649`（256 帧 / 10.2318fps / 25.02s·"a tour of the puzzle pieces … 545 of them"）。
证据 `artifacts/coverage/1279107097108635649-review-r189.md`；新测 `tests/module-parts-color.mjs` + `tests/module-catalog-parts-browser.cjs`（12 项 PASS）。
账：done **166 → 167** / partial **82 → 81**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该条不在 TOP 18 内（r188 挂下的首选，表外单条自成一组），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：旧 note 两条——「没有零件目录页」= **过期账**（`module-catalog-r56.html` + `src/build/module-catalog-r56.js` r56 就在，含 `?mode=used|all` / 飞行巡览 / `window.r56cat`）；「只给墙身上色（底座/屋顶/窗饰仍原色）」= **真缺口**（`buildings.js` 只有 `wc = debugModules ? sigColor(sig) : wall` 一处吃调试色，基座走 `K.stone/K.band`、屋顶走 `K.roof/K.roofAlt`）。
- 形制（片内实测）：平铺块按**部位 × 邻接签名**分色 —— 墙身（蓝/紫/绿）、屋顶（绿/暗红/浅褐）、基座/铺地（绿/棕/青）三族；**白细边（框条/檐口）不上色**。
- 改码：`buildings.js` 加 `partSigs{wall,roof,base}` + `sigColorFor(kind,sig)`（SALT 11/977/613、同签名同色）+ `debugParts` 开关；`plinth()` 四段石带与三道压顶/铺地改基座族色；`buildRoofs`/`skeletonRegionRoof` 屋顶改屋顶族色、山墙归墙族；`buildStats.moduleParts` 出族色数与屋顶片/基座面计数。`module-catalog-r56.js#buildPiece` 透传 `debugParts`；页面 `?parts=0` 关档 + `window.r56cat` 增 `partsOn/scenePartColors/piecePartColors`。
- 读数：场景级 `wall 28 / roof 16 / base 20`（`quads roof 79 / base 798`）、每块 `8/4/4`、`sigMismatch 0`、27 块 1386 三角；同状态两张截图 **0 px**；`?parts=0` → roof 0 / base 0 而 wall 27；开/关差分 **5369 px**（bbox 154,198–1083,685）；0 页面错误。
- 回归：`module-catalog-r56.mjs`（148 块）、`hip-roof.mjs`、`house-kit.mjs`、`building-components.mjs`、`voxel-ghost-roof-props.mjs` 全 PASS（默认档 `debugModules=false` 时 `dbg=null`/`dbgBase=null`，顶点逐字节不动）。
- 如实：545 块与原作单位不同（本仓按「格 × 层」：本场景 27 种 / 理论 quad 60 / mixed 88），已在模块头注明**不冒充 545**；白细边按片保持不上色；目录页只摆单格构件，整岛拉远景由 `index.html?modules=1` 那一路覆盖。
- **下一轮建议（第 190 轮）**：A 仍空 → 一组。次选从 81 条 partial 里按分数取 B，先 `grep -rln <片ID> src/ tests/` + `ls tests | grep browser` 两下判 A/B；另 `tests/battle-navigation-browser.cjs` 穿洞用例自 r174 起红（`tunnelSamples=0` / `pathMaxY=1.55`），别再拖。
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·188、第 188 轮（A 类仍空 → 一组 `1007587828992266240`：白垩崖两队混战 + 失守焦痕默认接线）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1007587828992266240`（300 帧 / 31.348fps / 9.57s）。
证据 `artifacts/coverage/1007587828992266240-review-r188.md`；新测 `tests/battle-chalk-scorch-browser.cjs`（20 项 PASS）。
账：done **165 → 166** / partial **83 → 82**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该条不在 TOP 18 内（r187 挂下的首选），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：片内四件事逐条落到模块 —— 近战 `battle.js#hit/#bleed`、失守火/烟 `fireSources+smoke`、炭黑 `house-char.js`、焦痕 `battle-c02#scorch`、旗 `battle.js#flag + life/banner.js`。**机制全在**，旧标签过期。
- 真缺口：焦痕**默认关**（C02 `scorch` 与 C03 `houseFx` 都关），`charHouseVerts` 只压顶点 → 主场景只有黑屋没有地面焦痕，与片 0060/0299 的暗红焦痕带不符。
- 改码：`battle-c02.js` 加 `C02_DEFAULT_ON = ['scorch']` + 构造时先开后解析 URL + `?c02=-scorch` 关档；`tests/c02-bn-fx-b.mjs` 的「默认全关」不变式改为「只有 DEFAULT_ON 里的开」。
- 读数：见上方表外块（`charredVerts 206` / `decals 4` / `embers 45` / 血渍 76 / 差分 52473 px / 噪声 0）。
- 回归：`c02-bn-fx-b.mjs`、`c03-battle.mjs` 全 PASS。
- 探针陷阱（累积第 64 条）：`effects.showFire` 只有 setter（`life/effects.js:197`），读回永远 `undefined` → 判「火有没有开」要读 `effects.fire.visible` 或 `fireSources.length`，别读 setter。
- 如实：紫旗（带白徽）不在色板内（浅蓝/橙/薄荷三色），r56 已判属美术；焦痕是屋基 + 门口两片斑（r 0.55/0.38 格），不是沿崖缘拉成的一条带；烟柱在本轮宽机位被炭黑塔体挡在后面。

**下一轮建议（第 189 轮）**：A 仍空 → 一组。首选 r187 的次选 `1279107097108635649`（256 帧·邻接签名同色，只剩「底座/屋顶/窗饰也上色 + 零件目录页」，先 grep `adjacen*`/`module-catalog` 判 A/B）；
次选从 82 条 partial 里按分数取 B（先 `grep -rln <片ID> src/ tests/` + `ls tests | grep browser` 两下判 A/B）；
另：`tests/battle-navigation-browser.cjs` 穿洞用例自 r174 起红（`tunnelSamples=0` / `pathMaxY=1.55`），别忘。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·187、第 187 轮（A 类仍空 → 一组 `794993371261665280`：基座广场树列 + 小件半径换算）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`794993371261665280`（158 帧 / 8.729fps / 18.10s）。
证据 `artifacts/coverage/794993371261665280-review-r187.md`；新测 `tests/voxel-ghost-ground-plants.mjs`（29 checks）+ `tests/voxel-ghost-ground-plants-browser.cjs`（PASS）。
账：done **164 → 165** / partial **84 → 83**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该条不在 TOP 18 内（体素屋族，r186 挂下），**表内无行可改**，故本小节记收口。
- 核实（先核再动手，**纠了一条误判**）：r183 记的「仍缺露台植被」在 0060 / 0090 / 0120 / 0150 四张原尺寸上不成立 —— 露台与屋顶一棵都没有；树是**沿塔基在底板广场排成一列**（0060 数出 7 棵、0150 换面同一列、每棵脚下方形花池、花池之间草地带）。「室内光进深渐变」由 r186 的 `airDepths/interiorTone` 覆盖 → 该片真缺口只剩「基座树列没有模块」。
- 改码：`groundPlants()`（底板格 + 上方空 + 离塔身 ≥1.45 格；定种子、间距 ≥1.7 格、`s` 1.55–1.85≈1.5–2 格高、花池）+ `plantStats()`（`buried`/`floating`）；页面 `#plants` + `?plants=0` + `plants/plantList()/plantSpots()/setPlants()`；**修小件屏幕半径少乘 `PROJ.scale` 的 11 倍 bug**（圆盘成针尖、树成「细针顶三个小点」）。
- 读数：9 棵、`buried 0` / `floating 0` / 底板可用格 161、两棵最近 **50.4px**、开/关差分 **3003 px** 其中 **98.0%** 落在树投影矩形、噪声 **0**、开→关→开像素 **0** 且截图逐字节相同、屋顶件解耦 32465 / 2916px。
- 回归：`voxel-ghost.mjs` 25734 / `voxel-ghost-orbit.mjs` 58 / `voxel-ghost-roof-props.mjs` 46 / `voxel-ghost-roof-props-browser.cjs` 全 PASS（进深渐变 21.4 vs 10.4、探针 4/11/16 → 206/180.3/171.3）。
- 新坑（累积第 63 条）：**GPU 后端 2D canvas 的 `getImageData` 在 draw 之后同一 JS turn 也可能读回上一版**（开→关→开 三次读数 back 与 on 稳定差 29731px，三张截图却逐字节相同）→ 像素账一律**从截图 PNG 解**（`decodePng`），`getImageData` 只做同帧相对比较。
- 另一条：`plantSpots()` 的 `zoom` 必须跟 `render` 的 `dollyAt(t)` 一致（t=1 → 1.22×），否则落点整档偏移。
- 如实：树是程序化替身（三球 + 花池环）、树冠不如原片圆实；底板后排树被塔身遮挡；`bandHeight` 片内不可测，按 r97 标定保持 3 层（标定差非机制缺口）。

**下一轮建议（第 188 轮）**：A 仍空 → 一组。首选 `1007587828992266240`（300 帧·白垩崖两队混战 + 小屋/崖缘着火 + 紫旗标，note 明写「机制归到既有 battle/effects/banner，**仅判读未做运行时对齐**」→ 大概率 A：用 `rea.battle` 探针squads/flags/houses.burn 出运行验收；但「崖缘着火 + 焦痕」疑在 C02/C03 且默认全关，动手前先核，若需接线就只做这一条）；次选 `1279107097108635649`（256 帧·邻接签名同色，只剩「底座/屋顶/窗饰也上色 + 零件目录页」）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。
另：`tests/battle-navigation-browser.cjs` 穿洞用例自 r174 起红（`tunnelSamples=0` / `pathMaxY=1.55`），别忘。

## 三·186、第 186 轮（A 类仍空 → B 一组 `797844857821732864`：体素屋顶小件 + 室内光进深渐变）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`797844857821732864`（117 帧 / 9.36fps / 12.5s）。
证据 `artifacts/coverage/797844857821732864-review-r186.md`；新测 `tests/voxel-ghost-roof-props.mjs` + `tests/voxel-ghost-roof-props-browser.cjs`。
账：done **163 → 164** / partial **85 → 84**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（体素屋族，r185 挂下），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：r183 已收口环绕/窗槽/内腔玫瑰墙，note 只剩两句；本轮两处都按片核过 —— 0116 的 4× 塔顶裁切能逐个数出天线/圆盘/竖齿/小树，4× 拱洞裁切能看出「洞口浅、往里暗」，**两条都是真缺口**（少见的真账，不是过期账）。
- 改码：`roofProps()`（天线 0.55–1.35 格细杆、圆盘只挂上部朝外墙面、栏杆每 0.25 格一根 0.13–0.19 短齿、小树只长 8 邻全屋顶的露台）+ `propStats()` + `airDepths()` + `interiorTone(ref 9)`；`interiorFaces()` 值改进深数字；页面 `#props`/`#grad` 两开关 + `?props=0`/`?grad=0` + 四个只读探针。
- 读数：小件 336（12/320/2/2）、屋顶格 305、`floating 0`、开/关 **30903 px**、重载噪声 **0**、幂等逐字节；渐变跨度 **10.4→21.4**、最暗 **156.6→134.1**、探针 4/11/16 → **206/180.3/171.3**。
- 回归：`voxel-ghost-orbit.mjs` / `voxel-ghost.mjs` / `voxel-ghost-orbit-browser.cjs` 全 PASS。
- 新坑（累积第 62 条）：**页面 `P()` 吃已投影坐标** —— 世界坐标直接喂进去会画到画布外，探针却一切正常（`props 256 / floating 0`），只有「开关像素差」能抓到；同轮复现 r177 第 53 条（GPU canvas 的 `getImageData` 半更新缓冲，两次渲染差 2.9 万 px）→ 身份比较一律用截图字节。
- 如实：小件是体素替身、齿密度低于原片（305 屋顶格 → 320 齿）；演示塔可见内墙基本在同一进深档，色带靠离屏读数而非单张截图 → 记美术差/机位差。

**下一轮建议（第 187 轮）**：A 仍空 → B 一组。首选 `794993371261665280`（158 帧·同族体素屋：室内进深渐变与露台植被已被本轮机制覆盖，只剩 bandHeight 片内量不出，先 grep + 对页面口径判 A/B）；
次选 `foamClusters` 接页面（r183 附带产物，模块有、页面无 → 判 A 的可能性大）；再有余力修 `tests/battle-navigation-browser.cjs` 的穿洞用例（r174 起红：`tunnelSamples=0` / `pathMaxY=1.55`）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。
（`794993371261665280` 从 C 名单里移出：它只剩 bandHeight 一项量不出，按 A/B 取，候选见上。）幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·185、第 185 轮（A 类仍空 → B 一组 `946660607008403456`：岸上小花拆层 + 船上白尸体）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`946660607008403456`（440 帧 / 33.1825fps / 13.26s）。
证据 `artifacts/coverage/946660607008403456-review-r185.md`；新测 `tests/battle-c01-shore-flowers-browser.cjs`。
账：done **162 → 163** / partial **86 → 85**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），**表内无行可改**。
- **先纠误读（r183 的 ①不成立）**：r183 把船侧白色细物读成「每船 4–7 支外张白桨」，据此记了「桨叶阵列缺失」。
  本轮 0430 的 8× + 0150 的 5× 裁切否掉它：白物**长短与倾角都不规则、散布在甲板中部**（不是沿舷等距）、
  **停泊的空船（无船员）船体上也有 2 支**、同一帧空中还有几条飞行中的箭线 —— 那是**插在船上的箭 + 压在上面的白尸体**，原文也只点名 blood/corpses/arrows/flowers。
- 核实（真缺口两条）：① 岸上小花机制在（`battle-c01.js#buildShore` 内的花簇），但和「沿岸白泡沫带」共用 `shoreFoam`，**默认关且该片水面干净** → 页面上无法表达「只有花没有泡沫带」；
  ② 船上尸体贴附机制在（`capturePlatformAnchor`），颜色只按队伍色 `lerp(corpse,.45)`，在暗红血池上读不出来，而原片是「暗红舱底 + 压一片近白尸体」。
- 改码：`battle-c01.js` 新增 flag `shoreFlowers`（进 `C01_FLAGS` + `C01_DEFAULT_ON`，默认开）；`#buildFlowers()` 从 `#buildShore()` 拆出（独立种子，泡沫带逐位不回归）、`#apply()` 两层各管 visible；
  颜色改米白为主（`#f6efdd` .7 / 浅粉 .3）、点径 .032→.05、簇内散布 .16→.10；新增只读 `flowerProbe()` 与 `stats.flowerClusters`；`battle.js` 加 `COL.boatCorpse=#efe9dd`（`onBoat` 尸体再 `lerp .58`）。
- 读数：20 簇 / 110 朵 / 每簇 4–7 / 离地 0 朵 / 贴顶 |Δy| 0 / 米白 64.5%；像素 噪声 **0**、开/关 **494 px（100% 落在 110 个花点 ±10px 内）**、开→关→开回位 **0**；
  尸体：船横摇 Δ**0.0322** 后位姿误差 **<1e-6**；箭：`parent===boat.mesh`、漂移 **0**；甲板：血池 **24 段**、opacity **0→0.384**、scale.x **0.26→0.522**。
- 回归：`battle-c01.mjs` / `foam-clusters.mjs`(19 checks) / `boat-deck-pool-browser`(0.94 / #762d33) / `gore-toggle-browser` / `ground-stain-browser`(173195) / `column-march-browser` 全 PASS。
- **预存在红（如实证）**：`tests/boat-corpse-browser.cjs` 的 `gore off failed` —— 把 `battle-c01.js` 换回 `HEAD` 版本后同样红（本轮只动花/尸体颜色，与 `view.goreOff` 的 `blood.visible` 无关）；本条的身份断言由新测第 ④ 组（矩阵级）承担。
- 新坑（累积第 61 条）：**与错误形制共用一个开关，会把正确的那一半一起关掉** —— 花和泡沫带同挂 `shoreFoam`，「水面干净 + 岸上有花」这个组合在页面上无法表达；
  判据要落到「页面能不能同时表达片里的开关组合」，不能只看单个 flag 存在（与第 60 条「模块有档 ≠ 页面在跑」同族）。
- 如实：原片是**一整片连着的米白花毯**，本仓 20 个散簇（全岛 110 朵），密度/团块仍差一档；近景里船上白尸体被血斑盖住，只读到「贴船姿位正确」→ 两条记**美术差**，不记缺口。

**下一轮建议（第 186 轮）**：A 仍空 → B 一组。首选体素屋顶小件（天线/圆盘/栏杆/露台小树）与室内光进深渐变（`797844857821732864` 与同族另一条体素屋仍 partial，先 grep 判 A/B）；
次选 `foamClusters` 接页面（r183 附带产物，模块有、页面无 → 判 A 的可能性大）；再有余力修 `tests/battle-navigation-browser.cjs` 的穿洞用例（r174 起红：`tunnelSamples=0` / `pathMaxY=1.55`）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·184、第 184 轮（A 类仍空 → B 一组 `901469409579061248`：船迹切 corridor 档 + 按船长标定的远端淡出）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`901469409579061248`（138 帧 / 33.5766fps / 4.11s·"Working on nicer ship wakes"）。
证据 `artifacts/coverage/901469409579061248-review-r184.md`；新测 `tests/boats-wake-corridor.mjs` + `tests/boats-wake-corridor-browser.cjs`（mixed + quad + UI 切档）。
账：done **161 → 162** / partial **87 → 86**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔；该条不在 TOP 18 内（船尾/长船族，r183 挂下的续项），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：r183 把 `corridor` 档写进 `wake-sampling.js` 并出 24 checks，但 `src/life/boats.js` 仍旧 `makeWakeParticles({rate:70,sprayRate:6,life:3.2})` + `advanceWake(...,{max:70})` —— 模块有档、**页面没跑**；三条缺口（切档 / 远端淡出 / 船头泡沫尺寸）核实为真账。
- 本轮改码：`advanceWake` 增 `{corridor,latOffset}`（固定横偏不外推，V 档逐位不变）；粒子带 `power`（边线 .85 / 泡沫行 1.75）；新导出 `wakeLife(len,speed,hulls)`（**寿命按船长标定**，夹 1.2–6.4s）与 `profile(ship,{bins})`；`boats.js` 默认 corridor（rowStep .12 / rowFill .6 / bowSize .14）+ 带状 alpha 与粒子共用 `wakeFade` + `FX_MAX` 1600→2600 + `wakeProbe()`；`view.js ?wake=v`、`wake-fog.html` 加档位下拉并把页脚「现有 V 形尾迹」的过期句改掉。
- 读数：mixed/quad 间距 **0.5440 逐段 CV<1e-9**（= 2·latOffset，= 3.4 beam）、reach 边线 **3.76 / 3.65** 船长 vs 泡沫行 1.10、泡沫点 1040 / 1122（未截断）、压陆地 0 粒、同页 new V 档 Boats 对照同夹具张开 **5.99×**、下拉换档后 `boats.mode==='v'`、0 console error。
- 新坑（累积第 60 条）：「模块有档」≠「页面在跑」—— 判据要落到渲染路径读的是哪个档（`boats.mode` + `wakeProbe().span`），不能只看模块测试绿。
- 如实：原片内部泡沫是**连通环蜂窝**，本仓是离散方块点阵（5 格/行、填充率 ~0.6）→ 美术差，不记缺口。该条**无剩余**。

## 三·182、第 182 轮（A 类仍空 → B 续收 r181 挂下的「水反射」组 2 条）→ **✔ 已收口（2/2 片转 done）**

**本轮实收口（2 条同组，partial → done）**：`1758250248483278925`（516 帧 / 33.2689fps / 15.51s）、`1215644531221311488`（270 帧 / 16.6667fps / 16.20s）。
证据 `artifacts/coverage/1758250248483278925-review-r182.md`、`1215644531221311488-review-r182.md`；
验收 `tests/reflection-projection-browser.cjs` **PASS**（mixed + quad，倒影层/水线/镜像投影/真水面占比/裙宽同一支夹具）。
账：done 159 → **161** / partial 89 → **87**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔。本轮取的是 r181 已核实的**真缺口**续项（`next` 首条），不是过期账。
- 先核 ID：两条都在 `learn/data.js` 与 `../../REA-agent/gifs/`；抽帧 516 / 270 与账面一致；`sheet-00`（1758）/ `sheet-02`（1215）本轮复看。
- 改码：新 `src/water/planar-reflection.js`（镜像相机 + oblique 裁剪 + `bias·P·V`，RT alpha=0）；`view.js` 水面 uniform/片元取样（`uReflTint=0.45` 做中间色、边界羽化防硬直线）+ `render()` 前画反射图 + `?refl=0`；`shore.js#buildShore(skirtWidth)` + `view.setSkirtWidth()`；`reflection.js` shader 分版修编译失败。
- 读数：倒影层 mixed **5902px** / quad **11281px**；镜像投影邻域命中 69.9% / 92.1%；差分像素落在真水面 98.8% / 98.5%（非水面 1.2% / 1.45% 全在岸线抗锯齿边）；水线以上 0；噪声 0、关→开→关回位 0；RT 640×410 覆盖 34.7% / 29.8%、0.7ms/帧；裙宽 1→1.6 外扩精确 **1.600×**；`World.version` 不变。
- 回归：`tests/reflection-browser.cjs` PASS（旧合成夹具 + `reflection.html`）、`tests/shore-skirt-breakup-browser.cjs` PASS（r180 亮段/缝隙账未回退）。
- 新坑（累积第 58 条）：**"倒影有没有"不能只靠"隐藏岛体后有多少像素"判** —— 那量的是网格本身；要判平面反射必须（a）开/关整帧差分 >0、（b）差分像素逐像素反投影落在 y=0 平面而不是岛体上。本轮 1.2–1.45% 的"非水面"像素就是岸线抗锯齿边，阈值按 2% 收。
- 本组**无剩余**；`uReflTint 0.45 / strength 0.72` 只是风格常数，不是缺口。


## 三·181、第 181 轮（A 类仍空 → B 一组「水反射」2 条）→ **仍未收口（两条 partial，缺口已从"泛泛未做"收窄到一条可实施路径）**

**本轮实收口 0 条**：`1758250248483278925`（516 帧 / 33.2689fps / 15.51s）、`1215644531221311488`（270 帧 / 16.6667fps / 16.20s）保持 partial。
证据 `artifacts/coverage/1758250248483278925-review-r181.md`、`1215644531221311488-review-r181.md`；
新测 `tests/reflection-projection-browser.cjs`（本轮红：倒影层 0 px）。
账：done 159 → **159** / partial 89 → **89**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔；本轮取的是表外续项组（`next` 里 r179 记的次选 ②），**TOP 表内无行可改**，故本小节记。
- 先核 ID：`grep -c 1758250248483278925 learn/data.js` = 1、`1215644531221311488` = 1；两个 mp4 在 `../../REA-agent/gifs/`；抽帧 516 / 270 与账面一致。
- 核实（先核再动手）：`src/water/reflection.js` 只有 44 行（一个 flat-colour 双网格着色器），`view.js:277-281` 用**同一份 geometry** 加 `scale.y=-1`；
  真正缺的是「投影到水面」这一步 —— 双网格的倒影位置在岛体下方，不在水面上。
- 量法（可复用）：离屏渲染两次，唯一变量 `view.reflection.visible`，整帧差分即"倒影层"；再单独隐藏 `view.mesh` 看这块倒影本来该有多少像素。
- 新坑（累积第 57 条）：**"镜像双网格"不等于平面反射** —— 它在几何上只在岸脚"露一条边"，因为镜像体与岛体在水平面上完全重合、被岛体深度吃掉；
  判据：主场景差分 0 px 而"隐藏岛体"后有上千 px，就说明倒影被自己挡死了，别再拿共享 geometry + `scale.y=-1` 当验收通过。
- 另记：`readRenderTargetPixels` 第 0 行在**下**（`H−1−sy`）；`R.setClearColor(0x000000, 1)` 会把整帧 alpha 铺成 255，量 alpha 必须传 0。

## 三·180、第 180 轮（A 类仍空 → 一组 `1991099314714902634`：岸线白带分段 / 缝隙漂移与胀缩）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`1991099314714902634`（545 帧 / 33.3333fps / 16.35s）。
证据 `artifacts/coverage/1991099314714902634-review-r180.md`；新测 `tests/shore-skirt-breakup-browser.cjs` **PASS**（mixed + quad，含只画裙带的离屏图与差分图）；
截图 `shore-skirt-breakup-mixed{,|-plain}.png`、`-mixed-crop.png`、`-mixed-skirt-{on,off,diff}.png`、`waves-page-r180{,|-plain,|-c10}.png`（均 ViewImage 看过）。
账：done 158 → **159** / partial 90 → **89**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔；该条不在 TOP 18 内（单条自成一组，`next` 里也没有它），**表内无行可改**，故本小节记收口。
- 先核 ID：`grep -c 1991099314714902634 learn/data.js` = 1、`../../REA-agent/gifs/1991099314714902634.mp4` 在（611586 B）；抽帧 545 与账面一致。
- 核实（先核再动手）：`grep -rln` 命中 `waves.html`（页脚「全局岩石泡沫遮罩、窄湾浪带交叠与全路径防穿岸仍待补」）与 `refactoring-audit.html`；
  `foam-mask.js`/`clampWavePaths`/`view-c10.js ?c10=foammask,shoreclamp` 全在 → 「遮罩/碰撞」是页面入口缺，不是机制缺。
- 片内（sheet-00/02 复看 + f0180/f0300 原尺寸）：白带被切成 3–6 段，段间水体直接贴岩脚，块外缘有淡晕；0244 之后白块沿岸滑移、宽度胀缩。
- 本轮改码：`shore.js`（aArc 烘入 + `skirtCoverage`/`skirtBreakGLSL` + `skirtStats` + **DoubleSide** 修背面剔除）、`view.js`（裙带共享水时钟 + `skirtStats` 探针）、
  `app.js`（`?skirt=plain` 回旧档）、`waves.html`（「裙带分段」「泡沫遮罩＋防穿岸」两开关 + 逐帧读数，页脚过期句改掉）。
- 回归：`tests/shore-wave-cycle-browser.cjs`（r179）、`tests/foam-mask-shore-c10-browser.cjs`（r178）、`tests/shore-browser.cjs` 全 **PASS**。
- 新坑（累积第 56 条）：**薄条单面材质会被自己的绕序吃掉** —— 沿闭合岸线铺的水平薄条，绕序让法线朝下，`FrontSide` 从上往下几乎全剔除；
  症状是「机制写了、页面上只有零星几段」。量法：同一机位只画该层，比 `FrontSide` / `DoubleSide` 的可读像素（本轮 2170 vs 35481）。
- 另记：`scene.background` 会把整帧铺成天色（黑底上天色 lum≈82，与白带同量级），量单层前必须摘掉；`readRenderTargetPixels` 第 0 行仍在**下**。

## 三·179、第 179 轮（A 类仍空 → 一组「岸浪黄/蓝线 + 循环顶点着色器」2 条一并收口）→ **✔ 已收口**

**本轮实收口（2 条同组，partial → done）**：`1849732997945110651`（437 帧 / 32.9563fps / 13.26s）与 `1991101097818403263`（477 帧 / 33.125fps / 14.40s）。
证据 `artifacts/coverage/1849732997945110651-review-r179.md`、`1991101097818403263-review-r179.md`；新测 `tests/shore-wave-cycle-browser.cjs` **PASS**（mixed + quad）；
截图 `artifacts/coverage/shore-cycle-{mixed,quad}-{t0,hit}.png`（+ `-crop.png`，均 ViewImage 看过）。
账：done 156 → **158** / partial 92 → **90**（285/285 账面不变）。

- **A 类仍空**：TOP 18「路径」列全 ✔，本轮无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组，且该组不在 TOP 18 内（表外续项），**表内无行可改**，故本小节记收口。
- 同族余项：`1991099314714902634`（545 帧·遮罩/拓扑碰撞 + 完整原作形态）与 `1849732997945110651` 同一对机制，本轮已具备同一支验收，**下轮可直接用同一夹具收**。

## 三·178、第 178 轮（A 类仍空 → 一组「岸浪泡沫 / 窄湾防穿岸」2 条一并收口）→ **✔ 已收口**

**本轮实收口（2 条同组，partial → done）**：`1849730611964973481`（599 帧 / 33.2224fps / 18.03s）与 `1666429884208381953`（630 帧 / 33.3333fps / 18.90s）。
证据 `artifacts/coverage/1849730611964973481-review-r178.md`、`1666429884208381953-review-r178.md`；新测 `tests/foam-mask-shore-c10-browser.cjs` **PASS**（mixed + quad 两档）；
截图 `artifacts/coverage/foam-shore-c10-{mixed,quad}-{on,off,back}.png`（均 ViewImage 看过）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该组不在 TOP 18 内（表外续项），**表内无行可改**，故本小节记收口。
- 先核 ID：两条都在 `learn/data.js` 与 `../../REA-agent/gifs/` 里（非幻觉 ID）；抽帧 `599/630 decoded` 与账面一致。
- 核实（先核再动手）：`grep` 到 `foam-mask.js` 的 `buildFoamMask`/`clampWavePaths`/`auditWavePaths` 与 `view-c10.js` 的 `installC10`、`app.js:523` 的 `?c10=` 装载全在；只差运行验收 → 判 A（页面入口 + 运行断言 + 截图）。
- 片内（1849：sheet-00/02/04 + f0480 原尺寸；1666：sheet-02/05 + f0500 原尺寸）：1849 的 408 起红线正是岸浪三角带线框，窄湾处两段带互相穿过同一片水并压到对岸陆缘；1666 的白裙是从岸脚放射的细三角带（水面可见 spokes）+ 外圈虚线，窄水道中间两侧裙边几乎接上。
- 新坑（累积第 54 条）：**「缺口句」里的两部分可能各自都已实现，缺的是同一支量具** —— 本组两条 note 挂了 10 轮的「泡沫mask / 窄湾交叠」，其实一个模块两件都做了，
  只是没有一条测试同时给出「碎斑结构」与「穿岸比例」两个数；以后遇到并列两缺口的 note，先 grep 两个词再判 A/B/C。
- 账：**done 154→156 / partial 94→92**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 179 轮）**：A 仍空 → 一组。① 首选同族的 `1991099314714902634` + `1991101097818403263`（545/477 帧，note 里是「遮罩/拓扑碰撞」「完整浪形/碰撞仍部分」—— 与 r178 同一条 `foam-mask`/`clampWavePaths` 链，可能一次收两条）；② 次选 `1758250248483278925` + `1215644531221311488`（516/270 帧，`src/water/reflection.js`，缺口是「完整反射投影/遮挡」）；③ 仍可从 92 条 partial 里按分数取 B。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`、`1664566546683899905`（buildShoreDistance API）。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·177、第 177 轮（A 类仍空 → 一组 `958371606350454784`：槽位表头像的 spec 数据接口 + 剪影 IoU 补运行断言）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`958371606350454784`（88 帧 / 2.1836fps / 40.3s）。
证据 `artifacts/coverage/958371606350454784-review-r177.md`；新测 `tests/part-random-slots.mjs` + `tests/part-random-browser.cjs` 全 **PASS**；
截图 `part-random-slots-r177.png`、`part-random-slots-mobile-r177.png`、`part-random-slots-seed{7,4242}-r177.png`（均 ViewImage 看过）。

- **A 类仍空**：TOP 18「路径」列全 ✔；该条不在 TOP 18 内（单条自成一组、`next` 里也无该 ID），**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：旧 note 的「完整 spec / 数据接口 / 剪影 IoU 仍缺」= **过期账（第 53 次同型）**：`src/core/part-random.js` 的 `PORTRAIT_SLOTS`（9 槽 + `needs/provides`）、`sampleSlots(seed, slots)`（换表 = 内容无关）、`portraitSilhouette`、`silhouetteDiversity`（成对 IoU）、`partSeed`（格位身份与列数无关），与 `src/ui/slot-portrait.js#slotGeometry`（与掩码同一套几何）、`ui.html?t=face&portrait=slots` 的 `slotStats().canvasMaskIoU` r55 全在；`tests/part-random.mjs` 只测了 `withRandomState/mirroredRandom/partSeed`。**真缺口**是这套数据接口与 IoU 从没在真页面被数值化验收。
- 本轮零改码（机制、页面均不动），只补两支测试：纯逻辑 `tests/part-random-slots.mjs`（2000 spec 结构/合法变体/JSON 往返/参数区间、同 seed 逐字段复现、换表换内容、依赖顺序与非法输入、剪影面积单调 1188/1375/1756 与 1188/1410、1136/1188、IoU 恒等 1/0 与无关 0/1）；运行 `tests/part-random-browser.cjs`（页面读数 + spec 重算 + 画布身份 + 窄屏）。
- 读数：24 张剪影差异 **0.269**（均 IoU **0.731**、276 对）、**画布剪影 vs 掩码 IoU 0.994**、8 张 spec 与 `partSeed` 重算**逐字段一致**、同 seed 两次元素截图**逐字节相同**（63170 B PNG）、换 seed 整屏换脸、切回回位；窄屏 390 列数 4→3 → 6 张、id 序列 `0,1,2,4,5,6` 身份不变、画布 350px 不溢出、0 console error。
- 新坑（累积第 53 条）：**GPU 后端 canvas 的 `getImageData` 会读到半更新缓冲** —— 同一帧连拍 4 张 element screenshot 逐字节相同，而同一帧两次 `getImageData` 能差 **6.8 万像素**（单通道最大 128）。画布身份断言一律用 `locator.screenshot()` 的 PNG 字节比，别用 `getImageData`。
- 账：**done 153→154 / partial 95→94**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。



**本轮实收口（1 条，partial → done）**：`1241096929490149376`（302 帧 / 16.6667fps / 18.12s）。
证据 `artifacts/coverage/1241096929490149376-review-r176.md`；新测 `tests/texel-skip-atlas-browser.cjs` **PASS**；
截图 `texel-skip-three-columns-r176.png`、`texel-skip-minified-r176.png`、`townskin-scene-r176.png`（均 ViewImage 看过）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组，`next` 里也没有它），**表内无行可改**，故本小节记收口。
- 先核 ID：`grep "\"1241096929490149376\"" learn/data.js` 1 命中、`../../REA-agent/gifs/1241096929490149376.mp4` 在。
- 核实（先核再动手）：旧 note 两条「仍缺」**一半是过期账** —— 「建筑/植被 atlas 未全面接入」「缩小仍缺 mipmap」对主场景都不成立：`core/town-skin.js`（`buildSkinAtlas` 8×8 色格 + 右下 32² 植物角；`buildSkinMips` 四级 box mip 打包在同一张 128²）+ `world/town-skin-layer.js#c07Level`（k<0.5 `skipTexel`、k≥0.5 两级插值）r56 就位，`tests/c07-skin-decal-browser.cjs` 一直在跑。**真缺口**是本片自己的页面入口：`textures.html` 的「隔像素一条线」页签只吃玩具贴图、只有两列、无 mip 档与量具。
- 本轮补（机制零改动）：页签吃真实图集、三列（最近邻 / 仅重映射 / +打包 mip）；`window.texelSkip.atlas()/measure()`；URL 钉 `?zoom/?mip/?show/?cell`。
- 读数：图集 60 槽 + 植物角 std **0.2495**、第 4 级 mip vs 盒滤波误差 **1.06 级**；放大 mag 8/4 mip 开/关四项**逐项相同**；线宽 mag 12 **12px → 2px**（暗面积 0.3323 → 0.0508）；缩小 mag .35 `mad` **.01136→.00564**、暗缝 **.284→0**，mag .12 **.00631→0**；主场景 **36555/36555 顶点换肤**、26 槽、mismatch 0、植被共用同图、A/B **6595 px**、回位 0、0 error。
- 新坑（累积第 52 条）：默认帧缓冲合成后被清 → `readPixels` 恒 0，量具要画进离屏 FBO；探针要挑**真填过的色格**（空格 alpha=255/RGB=0，读出来像「着色器全黑」）。
- 账：**done 152→153 / partial 96→95**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

## 三·175、第 175 轮（A 类仍空 → B 一组 `995043346778415104`：移动路线预览接主战场）→ **✔ 已收口**

**本轮实收口（1 条，partial → done）**：`995043346778415104`（386 帧 / 30.7815fps / 12.54s）。
证据 `artifacts/coverage/995043346778415104-review-r175.md`；新测 `tests/route-preview-battle-browser.cjs` **19/19 PASS**；
截图 `route-preview-battle-r175-{on,on2,off,back}.png`（均 ViewImage 看过）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），**表内无行可改**，故本小节记收口。
- 先核 ID：`grep "\"995043346778415104\"" learn/data.js` 1 命中、`../../REA-agent/gifs/995043346778415104.mp4` 在。
- 核实（先核再动手）：旧 note 两条「未接主管线 / 仍是一次性点串」= 过期账；`#route` 覆写几何、`#routeStep` 走完前 `pathT≥1.2` 并逐段裁切全在。
- **真缺口**：`landArcs` 的 `land=0.55` 在真实一格 0.42–0.47 宽上必然越界 → 弧整段被放弃（arcs=0、6 点埋崖）；单页/node 测试都测不到（demo 段长 ≥1）。
- 账：**done 151→152 / partial 97→96**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。
- 新坑（累积第 51 条）：**「模块测试绿 + 单页 A/B 绿」不等于「参数在真实数据尺度上成立」** —— 凡带世界尺度常数（`land`/`spacing`/`radius`）的几何，
  都要拿主战场的真实节点间距回测一次；本片的单页合成崖段长 ≥1，恰好把「短段就退化」这条 early-return 藏了一年。

## 三·174、第 174 轮（A 类仍空 → 续收 r173 挂下的同一条 `816743289500106752`：到位方块 6/8 → 8/8）→ **✔ 已收口（转 done）**

**本轮（1 条，partial → done）**：`816743289500106752`（431 帧 / 16.7054fps / 25.80s · 无原文 2017 badnorth GIF）。
证据 `artifacts/coverage/816743289500106752-review-r174.md`；测试 `tests/column-march-browser.cjs` **16/16 PASS**；
截图 `column-march-r174.png`、`column-arrive-r174.png`（均 ViewImage 看过：到位帧是规整 4×2 方块、无人站块外）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」续收 r173 的唯一未成立项。该组仍不在 TOP 18 内，**表内无行可改**，故本小节记收口。
- 核实（先核再动手）：**r173 的根因假设是错的** —— 「槽位越出目标格可走区」不成立，逐槽 `discFits` **全部 true**。真因在推进层：
  `BattleNavigation.move()` 是「整步全有或全无」（按 1/2 半径采样，任一中间点 `discFits` 不过就整步 `false`），
  队伍走到格子拐角时身体圆盘压进顶点 0.055 内的斜向缺格 → **朝目标的每一步都被拒**。
  实测：3 人（r0/r1/r6）钉在同一坐标 **120 帧不动**，离各自落位 0.309 / 0.351 / 0.374。
  且 `steer()` 只在 `plan.arrived` 后才对落位槽开，之前给的是门户瞄点 —— 瞄点方向与槽不同，所以「朝槽」能走、朝瞄点走不动。
- 本轮补：① `battle-navigation#move()` 的**贴脚一挪**规则（步长 ≤ 2×半径 时只判终点：起终点都属 `plan.from/next`、终点 `discFits` 为真才放行；原采样一行未删）；② `battle#step()` 推进链 —— 整步+分离 → 整步 → **±45°/±90° 侧滑** → 逐级缩步 1/2…1/16 → 全败才记 stuck；③ `columnStats()` 暴露 `crawls/slides/stuck` 只读计数。
- 读数：到位 **8/8**、最大偏差 **0.030**（逐人 0.017/0.006/0.006/0.012/0.017/0.015/0.012/0.030）、到位脚贴地 0、
  块跨度 x 0.164 / z 0.379；侧滑 **3113** 次、缩步 0 次、缩到 1/16 仍被拒 **0 帧**（r173 同夹具是 3 人 120 帧不动）；
  其余四项与 r173 同量级（gap p50 0.196 / 异层水平 p50 0.199 / 直线 1.000 vs 拐角 0.816 / 引导点 123 点 0.12）。
- 回归：`battle-c01.mjs` PASS（`arrived=6`、nearest 0.117–0.131 = 0.13 槽距未被压、`toGoal 0.023`）、`navigation.mjs` PASS、`nav-walk-browser.cjs` PASS。
- **未通过（如实记账，与本轮改动无关）**：`battle-navigation-browser.cjs` 穿洞用例红 —— `tunnelSamples=0`、`pathMaxY=1.55 > 0.56`；
  这两个判据都取自**单位移动之前**的 `b.path`（plan 节点楼层），本轮只改 `move()` 采样与 `#step()` 推进，不碰 planner。留作下一轮单独排查。
- 新坑（累积第 50 条）：**队形量对不上时，先分辨是「目标不可达」还是「推进被拒」** —— 本轮两者都像（都表现为停在离槽 0.06–0.37），
  用 `discFits(slot)` 一个布尔量就能分开：槽本身合法 ⇒ 问题在 move 的整步采样，不在布局。
- 账：**done 150→151 / partial 98→97**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

## 三·173、第 173 轮（A 类仍空 → B 一组 `816743289500106752`：成列行军 / 跨层竖列 / 到位方块）→ **仍 partial（到位方块只落 6/8）** → **第 174 轮已全部收口（见上）**

**本轮（1 条，保持 partial）**：`816743289500106752`（431 帧 / 16.7054fps / 25.80s · 无原文 2017 badnorth GIF）。
证据 `artifacts/coverage/816743289500106752-review-r173.md`；新测 `tests/column-march-browser.cjs`（9/10 PASS）；截图 `column-march-r173.png`、`column-arrive-r173.png`（均 ViewImage 看过）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该组不在 TOP 18 内（`next[40]`：`816743289500106752` + `817323301357948928`，后者是 `ref`），**表内无行可改**。
- 先核 ID：`grep "\"816743289500106752\"" learn/data.js` 1 命中、`../../REA-agent/gifs/816743289500106752.mp4` 在。
- 核实（先核再动手）：旧 note「缺成列行军/跨层列队/到达集结落位，均未实现」= **过期账（第 49 次同型）** —— `battle-c01.js` 的 `column`（`#orderColumn` 排序 + `spacing 0.15` 等人 + `blockSlot` 4 列 N 排）与 `routePreview`（落崖弧 + 圆角 + 等距点）r56 就在。**真缺口两条**：① 文件头写着 `?c01=…` URL 入口，但**全仓没有一处解析**（只能从控制台开）→ 页面入口等于不存在；② 拐角减速（片子长蛇在拐角收拢）确实没有。
- 本轮补：`battle.js#applyC01Param()`（`?c01=column` / `all` / `none` / `-x`，认不出忽略、默认档不动）+ `battle-c01.js` 的 `CORNER_SLOW`（turn .35 / near .45 / drop .60）、`#cornerSpeed()`（倍率 = 1 − drop·sharp·(0.35+0.65·prox)）、`columnStats()` 只读探针 + `battle.js` 行军循环乘倍率。
- 读数：同层相邻名次 gap p50 **0.196**（spacing 0.15）；异层相邻 62 对，水平 p50 **0.191**（俯视一条线）、y 差只在下落几帧 ≤0.094；直线段速度倍率均值 **1.000**（3837 样本）、拐角段 **0.813**（最小 0.676，56 样本）、小转角 0.884 vs 大转角 0.722（单调）；`cornerTurns 134 / waits 763 / slotted 26070`；引导点 **123** 点间距 p50 **0.12**、圆角 21 处。
- **未成立（保持 partial 的唯一理由）**：到位方块只落 **6/8**，两人分别差 **0.344 / 0.371**（其余 ≤0.017），终帧截图里直接可见两人立在块外 —— 根因是 `blockSlot` 的槽位落在目标格可走区之外、`navigation.move()` 拒绝后单位不再尝试。下一步：槽位按目标格内切半径收边，或 `move` 失败时退回格心重试。
- 新坑（累积第 49 条）：**「等距/落位」这类队形量的判据不能只看账面槽位** —— `blockSlot` 给的偏移是几何理想值，是否可达要另测（本轮账面 4×2 全对、实际只到 6/8）。
- 账：**done 150→150 / partial 98→98**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 174 轮）**：A 仍空 → 一组。① 首选把本条的「到位方块」收掉（半轮：槽位内切收边 + `move` 失败退格心），收掉即 done；② 次选 `995043346778415104`（386 帧·路线的落崖弧/圆角，同 `route-preview` 一族，`?c01=routePreview` 本轮已能开）；③ 仍可从 98 条 partial 里按分数取 B。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。幻觉 ID 别再排：`1804240021131083778` / `1809197832898433024` / `1189795466936320000`。

## 三·172、第 172 轮（A 类仍空 → B 续取 r170 挂下的同组两条：笔触图集 / 受控跨崖渗漏）→ **✔ 两条一并收口**

**本轮实收口（2 条同组）**：`1696896119794479541`（550 帧 / 32.9144fps / 16.71s）与 `1696864977171189980`（502 帧 / 31.5723fps / 15.90s）**→ done**。
证据 `artifacts/coverage/1696896119794479541-review-r172.md`、`1696864977171189980-review-r172.md`；测试 `tests/blotch-atlas-rim-browser.cjs`（+`tests/blotch-atlas.mjs` 新增 GLSL 闸门断言）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该组不在 TOP 18 内（表外续项），表内无行可改。
- 先核 ID：两条都在 `learn/data.js` 与 `../../REA-agent/gifs/` 里（非幻觉 ID）。
- 核实（先核再动手）：r170 把缺口收到「夹具逐态 uniform 没落位」，本轮先用**回读**排掉这个怀疑（`blotchParams().bleed` 逐态正确），
  再逐层拆：读数为 0 且 `bleed=20` 与 `bleed=0` 逐像素相同 → 只可能是「0 没被当成关档」→ 在 GLSL 里抓到 `smoothstep(0,0,·)` 除零退化。
- 读数：见上「表外收口」栏。
- 新坑（累积第 47 条）：**「参数关档值」在 GPU 上未必是关档** —— `smoothstep(e0,e1,x)` 在 `e0==e1` 时是除零区间（钳 1），
  凡是 `bleed/strength/…` 这类「0 = 关」的参数进了 smoothstep，都要单独写 `step(ε, p)` 闸门，并给 GLSL 加文本级回归断言（CPU 断言抓不到）。
- 新坑（第 48 条）：读渲染目标像素时**两个坐标都要换算** —— `readPixels` 第 0 行在**下**，而 `project()` 的 NDC `y=+1` 在屏幕**顶部**；
  只修一处会成为「双重翻转」，读出来仍是 0（r170 的 wallBand 全 0 就是这么来的）。
- 账：**done 148→150 / partial 100→98**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 173 轮）**：A 仍空 → 一组。首选从 98 条 partial 里筛「`where` 有模块 + 页面、但全仓无对应 `-browser.cjs`」的（先 `grep` 核 ID 真实存在再判 A/B）；
次选把 r170 记过的 `tests/blotch-browser.cjs`（旧 `blotch-pattern` 夹具报 `surface isolation failed 0,0,0`）用本轮同一套坐标口径（行翻转 + NDC y）修一遍 —— 那条旧测是**同一片**的另一个入口，修好可给这两条再加一层回归。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·171、第 171 轮（A 类仍空 → A 类单条组 `1310503825510367232`：混合透视接主视图）→ **✔ 已收口**

**本轮实收口（1 条）**：`1310503825510367232`（200 帧 / 32.8407fps / 6.06s）**→ done**。
证据 `artifacts/coverage/1310503825510367232-review-r171.md`；新测 `tests/mixed-persp-main-browser.cjs`；模块只改 `fixRay` 起点（行为零变化）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 先核 ID：`grep "\"1310503825510367232\"" learn/data.js` 1 命中、`../../REA-agent/gifs/1310503825510367232.mp4` 在。
- 核实（先核再动手）：旧 note 的三条「仍缺」逐条 grep——`?mixedPersp=` 在 `view.js:311`、`fixRay` 在 `view.js:1270`、倒影靠 `scale.y=-1` 同相机镜像（`view.js:278`）→ **接线早就有，不是缺机制**；判 A（页面入口 + 运行断言 + 截图）。
- 片内（2 张联系表全看 + 0060 原尺寸）：绕岛旋转的正常透视角，塔身四方竖棱**逐帧平行**、前景屋顶高约 110px 而远处房子约 60px；全片**没有 UI / 对照标签 / 开关**，只有一种投影在跑 → 判据只能落在「竖线横移 0 + 近大远小仍在」两条画面事实上。
- 读数：见上「表外收口」栏（k=1 横移 5.6e−14px vs k=0 27.66px；四段高度逐段变小；拾取未掉档；像素差分 53256 噪声 0/0；默认关档逐位相同）。
- 新坑：① `tools/serve.py` 长跑后起页 `ERR_CONNECTION_RESET`（本轮首个页面挂了两次）→ 测试要带「失败不记页面报错」的重试；② `index.at(x,z)` 一次回 4 个候选格，且本仓存在**重叠格 id**（183 与 1962 的四边形在塔角互相压着）→ 「网格三角所属格 == pick 命中格」只能当读数（13/24），不能当断言。
- 账：**done 147→148 / partial 101→100**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 172 轮）**：A 仍空 → 一组。首选续 `1696896119794479541` + `1696864977171189980`（r170 已把缺口收到「夹具逐态 uniform 没落位」：每条状态 clone 一份材质 + 每帧回读 `uBlotchRimQ`，半轮内读出来两条直接 done；这是同组第 3 次，若再读不出就当场改判 C）；
次选从 100 条 partial 里筛「`where` 有模块 + 页面、但全仓无对应 `-browser.cjs`」的（先 `grep` 核 ID 真实存在再判 A/B）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·170、第 170 轮（A 类仍空 → B 续取 r169 挂下的同组两条：草斑受控跨崖渗漏）→ **仍 partial（等深带的世界深度仍缺可信读数，缺口已定位到夹具）**

**本轮（2 条同组，均保持 partial）**：`1696896119794479541`（550 帧 / 32.914fps / 16.71s）与 `1696864977171189980`（502 帧 / 31.572fps / 15.90s）。
证据 `artifacts/coverage/1696896119794479541-review-r170.md`、`1696864977171189980-review-r170.md`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；该组不在 TOP 18 内（表外续项），**表内无行可改**。
- **r169 三条 FAIL 的两个真因（本轮查实）**：
  1. **量具错（r169 自己的锅）**：竖直探针是 0.3×0.3 面片 + 取「最亮像素」，而渗漏是**乘性压暗** → 面片上未上色那半截永远更亮，`max` 恒等于未上色亮度 → drop 恒 0。改成窄条 0.06 + 清屏 `alpha=0` 认画到的像素（lit≈110）+ 取**均值**。
  2. **真机制缺陷**：`below = G(本纹素顶面) − y` 在崖面必然错 —— 崖面片元的 XZ 压在台地边界上，纹素≈0.21 世界单位，双线性把**下格**掺进来；实测 15 个崖肩 below = **−0.06 … −1.95（11 个为负）** → `bleedMask` 恒 0。
- **改法**：`src/terrain/blotch-atlas.js` 的 rim 场新增 **B 通道 = 崖肩顶面**（G 的 (2·2+1)² 邻域 max，`shoulder` 可传、0=旧口径）；`blotchRimTint` 与 `BLOTCH_RIM_GLSL` 的 below 改用 B；`sample()` 返回 `[rimDist, top, shoulderTop]`；`blotch-tongue-c09.js` 舌头去掉「向墙内偏 0.18 取 G」的近似、同样用 B。R/G 语义不变（「G=本格顶」逐纹素仍相等）。修后 CPU≡GPU 在 **15/15** 个崖肩对上。
- **已成立**：主场景渗漏隔离 A/B —— 同机位只改 bleed 0→.14 = **3931 px**、`strength 0` = **5662 px**、同状态重渲噪声 **0**；顶面着色 10.0%、尺度 .09→.045 边界 6→0、图集关/开 3990 px、舌头 18543 px、噪声 0。
- **未成立（保持 partial 的唯一理由）**：12 档「drop vs 深度」仍恒 0，且 **`bleed=20` 与 `bleed=0` 逐像素相同（0 px）**。已排除渲染滞后（同状态噪声 0）与状态粘连（`strength` 按全量参数重写）→ 定位到**夹具的逐态 uniform 没落到位**；测试里这部分标 `PENDING`，不进断言。
- 回归：`blotch-atlas.mjs` / `blotch-tongue.mjs` / `view-shading.mjs` 全 PASS。旧测 `blotch-browser.cjs` 仍是 r169 的 `surface isolation failed 0,0,0`（旧 `blotch-pattern` 档，未动该路径）。
- 账：**done 147→147 / partial 101→101**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 171 轮）**：A 仍空 → B 一组。两条路：① 花半轮把这条的夹具换成「每条状态 clone 一份材质 + 每帧回读 `uBlotchRimQ` 断言 uniform 真的变了」，若 `bleed=20` 仍等于 `bleed=0`，就该用「同一材质只渲一张、每状态重建 RenderTarget」再试；读出来这两条直接 done。② 若半轮内读不出，换一组 B：从 101 条 partial 里筛「`where` 有模块、但全仓没有对应 `-browser.cjs`」的，先 `grep` 核 ID 真实存在再判 A/B。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·169、第 169 轮（A 类仍空 → 取 next[94] 「笔触图集 / 受控跨崖渗漏 / 翻崖舌头」整组两条）→ **仍 partial（缺口收窄到「等深带的 GPU 读数」）**

**本轮（2 条同组，均保持 partial）**：`1696896119794479541`（550 帧 / 32.914fps / 16.71s · "Look how neat and controlled the grass blotches bleed over the cliff edges."）与 `1696864977171189980`（502 帧 / 31.572fps / 15.90s · "…much bigger blotches without the blotches bleeding across and messing up important edges."）。
证据 `artifacts/coverage/1696896119794479541-review-r169.md`、`1696864977171189980-review-r169.md`；新测 `tests/blotch-tongue.mjs`（PASS）、`tests/blotch-atlas-rim-browser.cjs`（**FAIL 三条等深断言**）；页面 `blotches.html` 补入口，`view-shading` 补 `setBlotchRim` / `blotchParams`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该组不在 TOP 18 内（`next[94]`），**表内无行可改**。
- 先核 ID：`grep "\"1696896119794479541\"" learn/data.js` 1 命中、`1696864977171189980` 1 命中，两个 mp4 都在。
- 核实（先核再动手）：旧 note 的「未迁移原版 rim 距离场 / atlas 受控跨崖采样及可调 bleed，本片实现/运行验收仍待完成」+「卡点·A 机制未做」**是过期账（第 45 次同型）** —— 见上「收口动作」栏的模块清单，机制齐、`?shade=blotchatlas`/`?tongue=1` 早接主材质；真缺口是 `blotches.html` 页脚还写「原作 atlas、受控跨崖采样…尚未复现」、页面上一次都没切过。
- 片内：A 片 0000–0139 固定机位环绕（顶面大块圆角色块、崖面米白只有层理），0140–0253 抽色只留几何，0300–0469 **近景崖肩**（桃色斑越过崖肩垂成一小段、外缘细深描边、深部崖壁干净），0455 的 3× 裁切里草绿斑沿崖肩成「舌头」；B 片前后**两版对照**（0059–0062、0284–0287 各四帧黑剪影切换），前版超大米黄/桃色块到崖肩整齐收住、崖壁纯米白。
- 读数：`blotch-tongue.mjs`（强度 0..1、`reach==depth·amt` ±0.02、`topReach/depth 0.58`、**147/285 崖肩格有舌头**、内部格 0）；`blotch-atlas.mjs` 回归 PASS；浏览器主场景同机位 A/B **18168 px**、舌头 **19222 px**、噪声 **0**、顶面 6×6 面片着色 **10.0%**、尺度 `.09 → .045` 扫描线边界 **6 → 0**。
- **未成立**：竖直探针 8 档（dy .03/.08/.13/.18/.25/.40/.60/.90）在 bleed 0/0.14/0.30 下亮度差恒 **0**（CPU 孪生同位置 0.115 / 0.265）。已定位两个口径坑：① rim 场 128² 覆盖全岛（纹素≈0.4 世界单位），同一 (x,z) 上 `G=2.5` 而本格顶 `3.0` → `below=-0.45`，`bleedMask` 天然 0；② `segments`（沿世界 Y 的层理带）与 `streak`（陡面压暗）是**与 bleed 无关的常驻项**，不先关掉会把 10% 带纹读成渗漏（第一版读出 0.9 深度的假带就是这么来的）。
- 另：旧测 `tests/blotch-browser.cjs` 报 `surface isolation failed 0,0,0` —— 旧 `blotch-pattern` 档夹具，疑默认 `uBlotchStyle.w=0` 使 `blotchTone` 恒等 1；本轮只新增只读方法、未动该路径，列入下轮核查。
- 账：**done 147→147 / partial 101→101**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 170 轮）**：A 仍空 → 先花半轮把这组的等深带读出来（打印 shader 侧 uniform 与 `rim.sample` 的 G，必要时把 rim 场 res 提到 256 或改成「按格中心栅格化」），能读出来这两条就直接 done；否则换一组 B，首选从 101 条 partial 里筛「`where` 有模块、全仓无对应 `-browser.cjs`」的（先 `grep` 核 ID 存在再判 A/B）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·168、第 168 轮（A 类仍空 → B 一组 `1200520827898343425`：墙色槽后端补 PNG 热更新 + 常用配色存档）→ **✔ 已收口**

**本轮实收口（1 条）**：`1200520827898343425`（200 帧 / 10fps / 20.0s · "DnD hopefulls needn't fear no more, for I've now made the backend of letting you tune your town to your favorite palette."）**→ done**。
证据 `artifacts/coverage/1200520827898343425-review-r168.md`；新模块 `src/core/palette-store.js`；新测 `tests/palette-store.mjs`、`tests/wall-palette-backend-browser.cjs`；`wall-palette.html` 补 PNG 热更新 / 导出 PNG / localStorage 存档（`#grid/#preset/#blend/#slots/#restore/#status` 与 `wallPalette.api/apply/blend` 一字未改，旧测照跑）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），**表内无行可改**。
- 先核 ID 真实存在（r160/r165 两次幻觉 ID 的教训）：`grep "\"1200520827898343425\"" learn/data.js` **1 命中**、`../../REA-agent/gifs/1200520827898343425.mp4` 在。
- 核实（先核再动手）：旧 note「PNG/完整原接口与持久化仍待补」拆开看 —— **PNG 半句是过期账**（`core/palette-image.js` + `world/palette-png.js` + `?palettePng=` 全在，`palettes/Palette.png` 16×2/121B），**但本片页面从没接过且页脚写着「尚未实现」**；**持久化半句是真的**（全仓 0 处 `localStorage`，存档串只写 5 bit 槽下标）→ 判「页面入口 + 一处真缺口」，不是缺整套机制。
- 片内：四步**单帧硬切**（f33 红 s0.61→0.07、f52 绿 s0.63→0.06、f78 浅蓝 s0.70→0.36、f112 暖黄 s0.41→0.33），一步只动「用该槽的体素」，屋顶橙与未改槽逐像素不变，无渐变、无 UI。
- 读数：32748 顶点、槽分布 `[14,6,23,15,0,0,0,31,0…]`；「设纯黑 → 整组归零」判据下槽 7/2/3 = **828/660/360** 顶点整组换色（`hardOther 0`），像素差 17430/10432/7679 px，回位 **0 float / 0 px**、噪声 **0**；导出 16×2/167B 下行 == 15 槽逐字；存档 207B 刷新恢复「World 346 · 已恢复存档配色」、坏存档「存档被拒：wall palette slots」；外部改图 hot v1→v2 改槽 `[0,2,…,14]`、关档回预设。
- 新坑：① **换 palette 对象即整岛重建，自带 4692 px 像素地板**（同色新对象也 4692px，连画两帧是 0）→ A/B 必须先吃掉；② 顶点色是乘性，判「只动该槽」只能用「设纯黑 → 归零计数」（下标法被重建换序打翻、比值法被烘焙 tint 打翻）；③ `bounce 0.42` 让单槽改色对邻近几何最大影响 0.326/0.253/0.198，不能断言「其余全等」。
- 账：**done 146→147 / partial 102→101**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 169 轮）**：A 仍空 → B 一组。首选 `1696896119794479541`（550 帧·"the grass blotches bleed over the cliff edges" —— 旧 note 的「rim 距离场/atlas 跨崖采样与可调 bleed」要**先 grep 判 A/B**：`src/terrain/blotch*` / `terrainmesh` 的圆瓣草边可能只差页面与量具）；次选：从 101 条 partial 里筛「`where` 有模块、但全仓没有对应 `-browser.cjs`」的（先 `grep` 核 ID 真实存在再判 A/B）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·167、第 167 轮（A 类仍空 → A 类单条组 `1670720537662836736`：三类边分级着色）→ **✔ 已收口**

**本轮实收口（1 条）**：`1670720537662836736`（102 帧 / 9.2896fps / 10.98s）**→ done**。
证据 `artifacts/coverage/1670720537662836736-review-r167.md`；新测 `tests/hierarchy-edge-classes-browser.cjs`；`hierarchy.html` 加 `#clsOn` / `#clsSlice` / `#clsOut` / `#focusMat` / `window.hierarchyClasses`（主网格渲染零改动）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：`src/terrain/shape.js` 文件头第 5–7 行署本片 ID 与原文，`rank()` 五档（pinned > cliff-top > cliff-foot > material > free）、`curveStep` 只沿同级边取两邻居、`matStep` 只沿材质边且只被材质或更硬点拉，`tests/edge-hierarchy-modes.mjs` 一直绿；旧 note 的「原模块/材质三角网语义仍缺」+「卡点·A 机制未做」= **过期账（第 43 次同型）**，真缺口是页面从没画过三类边 → **判 A**（页面入口 + 运行验收），不是缺机制。
- 片内：0000–0014 彩色低多边形岛；0015–0031 转灰白，红折线沿平坦台地的格边界走、剪影黑、左侧池岸一小段蓝弧；0032–0045 整岛填纯黑、红线位置不变；0046–0101 回彩色近景基本静止。
- 读数：切面 1 **黑 648 / 红 514 / 蓝 5**（共 1167 条格边、蓝色输入 11 对）；逐切面 1:648/514/5 … 9:642/24/0、10:633/22/0（蓝只在最低切面）；独立重算逐类相等；三档 rank **15190 采样 0 差异**、`pinned` 位移 **0**、不给 `materials` 时 material 类 **0**；整岛开/关 **27960px**（黑 2878 / 红 8476 / 蓝 61）、噪声 **0/0**、近景蓝色 **316px**；0 console error。回归 `hierarchy-three-modes-browser` / `hierarchy-browser` / `hierarchy.mjs` / `edge-hierarchy-modes.mjs` 全 PASS。
- 新坑：① 同页 checkbox 与 output 不能共用 `id="classes"`（`$('#classes')` 命中 input，读数卡在「待加载」）→ 拆 `#clsOn` / `#clsOut`；② 探针把 `pair` 展开成 `[...pair]` 会把一对顶点变成两个数，`shapeTerrain` 抛 `hardEdges must reference adjacent vertices`；③ 跨档比 rank 必须连 `hardEdges` 一起对齐，否则显式硬边那 2 个顶点会报成「分类随平滑档变」（20 个假差异）。
- 账：**done 145→146 / partial 103→102**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 168 轮）**：A 仍空 → B 一组。首选 `1200520827898343425`（200 帧·墙色调色板，note 只剩 PNG/完整接口与持久化，先 grep 判 A/B）；
次选 `1696896119794479541`（550 帧·草斑跨崖 rim 距离场/atlas 采样）、`1482011744843223042` 已 r144 done 别再排。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·166、第 166 轮（A 类仍空 → B 一组 `1670725072540106755`：三档平滑补页面入口）→ **✔ 已收口**

**本轮实收口（1 条）**：`1670725072540106755`（164 帧 / 10.698fps / 15.39s）**→ done**。
证据 `artifacts/coverage/1670725072540106755-review-r166.md`；新测 `tests/hierarchy-three-modes-browser.cjs`；`hierarchy.html` 加 `#mode` / `#modes` / `window.hierarchyModes`（渲染零改动）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：`src/terrain/shape.js` 文件头第 5–10 行署本片 ID 与原文，`shapeTerrain(world,{mode})` 三值齐（none 直接跳过平滑 / dumb 无视 rank 全拉 / hierarchical 按 rank 只被同级或更硬邻点拉），`smoothingMetrics` 出 kink·areaDrift·regularity，`tests/edge-hierarchy-modes.mjs` 一直绿；真缺口是 `hierarchy.html` 只有硬边控件、页脚还写着「完整无/普通/分层三模式仍待补」→ **判 A**（页面入口 + 运行验收），不是缺机制。
- 片内：左上角标签做模板匹配**逐帧**判档 → `no` 0–64 / `dumb` 65–119 / `hierarchical` 120–163，切点 64→65、119→120；底岸线最大单步跳变 **14 / 47 / 19 px**；同机位同裁切三段对比图 `hierarchy-modes-montage-r166.png`。
- 读数：崖顶转角 **71.80° → (dumb 71.63°) → 61.03°**、面积漂移 **0 / 12.84% / 12.24%**、位移采样 **0 / 4680 / 4682**（共 16709）、最大位移 **0 / 0.21 / 0.12**、钉住违例三档全 **0**；像素 A/B **82869 / 80832 / 80333 px**、噪声 **0**、0 console error。回归 `hierarchy-browser.cjs` / `edge-hierarchy-modes.mjs` PASS。
- 新坑：① 同档两帧差分的「噪声」= 主循环真 dt + 切档后 `birdTimer`/`decor.refresh` 补件 → `render=()=>o(0)` + `onFrame=null` 后归 0；② `shape.at()` 是 Float32、原坐标 Float64，1e-9 阈值会把 none 档误判成「全在动」（改 1e-5，并用 `maxMove===0` 复核）。
- 账：**done 144→145 / partial 104→103**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 167 轮）**：A 仍空 → B 一组。首选同页同机制的 `1670720537662836736`（102 帧·黑=硬边 / 红=格边界 / 蓝=材质边界）；
`shapeTerrain` 的 `materials` 类已在（node 测试覆盖），缺的是把「红=格边界、蓝=材质边界」从 World 真取出来画在页面上，先 grep 判 A/B。
次选 `1200520827898343425`（200 帧·墙色调色板，note 只剩 PNG/完整接口与持久化）、`1696896119794479541`（550 帧·草斑跨崖 rim 距离场/atlas 采样）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` / `1809197832898433024` / `1189795466936320000` 是幻觉 ID，别再排。

## 三·165、第 165 轮（A 类仍空 → A 类单条组 `1258421104756097029`：水花默认档改冠状水帘）→ **✔ 已收口**

**本轮实收口（1 条）**：`1258421104756097029`（436 帧 / 33.18fps / 13.1s）**→ done**。
证据 `artifacts/coverage/1258421104756097029-review-r165.md`；新测 `tests/splash-crown-browser.cjs`；`splash-c07.js` 补 `stats()` 探针。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- **先纠假账**：r164 建议的 `1809197832898433024` / `1189795466936320000` **在 `data.js` 与 gifs 里都不存在**（gif 0、data.js 0 命中）= 幻觉 ID（r160 的 `1804240021131083778` 同型，第 2 次）。
- 核实（先核再动手）：旧 note 的「缺冠状竖条 / 缺多环长寿命」+「卡点·A 机制未做」= **过期账（第 41 次同型）**——
  `src/life/splash-c07.js`（署本片 ID，r56 C07）已有 10 条冠状竖条 + 3 圈（delays 0/0.22/0.5，life 3.8s）+ 10–12 颗竖直飞沫，
  `tests/c07-look.mjs` 一直绿；真缺口是**只挂 `?c07=splash`、默认场景仍是一圈 1.1s + 26 颗**，且没跑过页面 → **判 A**（不是 B）。
- 本轮（机制零改动）：`effects.js` 默认 `splashStyle='crown'` + `?splash=plain` 对照 + `setSplashStyle()/splashStats()`；
  `view-c07.js` 的 `?c07=splash` 改为切档（不再自己 spawn/update，避免双份）。
- 读数：10 条 / 0.34s h=0.3243 / 1.05s 塌完；3.2s 仍 3 圈 r=0.638/0.726/0.809、alpha≈0.21/0.18/0.22，3.9s 首圈到寿；飞沫 11（10–12）；
  水帘窗 723→362→0→0；对照档 3.2s 差分 0；噪声 0、0 error。回归 `c07-look.mjs` PASS、本测连跑两次 PASS。
- 新姿势（累积第 40 条）：**「数白像素」在有岸沫/浪花的水面上不成立** —— 水花与岸沫共用 `uTime`，直接数白像素会把岸沫算进来
  （第一版 887→5201 全在涨）；而整帧开/关差分又会被倒影与淡环的低幅变化放大到 4 万 px，包围盒高度根本读不出水帘。
  正解 = **水线以上 8–70px 的窄窗 + thr225**（723→362→0），环则交给「探针半径/alpha + 3.2s 截图目视」。
- 账：**done 143→144 / partial 105→104**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

## 三·164、第 164 轮（A 类仍空 → B 续收 r160 挂下的 `886199305522085890` 北境默认点径）→ **✔ 已收口**

**本轮实收口（1 条）**：`886199305522085890`（624 帧 / 32.6531fps / 19.11s）**→ done**。
证据 `artifacts/coverage/886199305522085890-review-r164.md`；新模块 `src/world/point-floor.js`；新测 `tests/passage-dots-world-browser.cjs`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：r160 记的「翻默认后可读性掉档（40.3→21.1）」**不是机制不行，是量具错** ——
  `#passagePx()` 按 `px = size·(H/2)·fovK/depth`（`fovK=1/tan(fov/2)`≈2.14）反算 size，
  而 three 的 `sizeAttenuation` 实为 `gl_PointSize = size·pixelRatio·(H_css/2)/depth`（**无 fov 因子**）→ 点被缩到 1/2.14。
  另一个真限制：`PointsMaterial` 只有一个全局 size，抬 size 会把近端点钉死，做不到「近大 + 远保底」。
- 本轮补：① `installPointFloor()` 在顶点着色器末尾逐点 `gl_PointSize = max(gl_PointSize, uPointFloor)`，下限按**物理像素**（`minPx×devicePixelRatio`），并串上 `customProgramCacheKey`；
  ② `battle.js` 默认 `sizeAttenuation:true + size 0.13`（= 点距 0.28 的 1/2.15）+ 下限 7 CSS px，新增 `setPassageDots()` / `passageDotPx()`（逐点 near/far/托底比例/深度范围），`passageStats` 每帧带；
  ③ `battle-c02` 的 `passageWorld` 反转为对照开关 `passageScreen`（`?c02=passageScreen` = 旧固定 7px），`#passagePx()` 改读模块口径、不再自己反算；
  ④ `passage-overlay` 同装真下限、`dotPx/measure` 去掉 fovK、`dotWorld` 0.09→0.13；⑤ 能力面板标签改「窄道点线（旧·固定 7px 对照）」。
- 读数（真实像素，冻时间轴后 开/关 差分取连通块）：全岛 173 点/76 块、直径中位 **5.97px** = 旧 7px 档 **5.97px**（逐位相同）、
  可读性 **40.0 / 0.682** 与旧档一致；点距/点径 **2.21**；近景直径中位 **8.67px（1.45×）**、逐点 10.93 vs 7.0；
  **DPR2 下限 14 物理 px**、远端点径 **1.89×**。回归 c02-bn-fx-b / traffic-dots / passage-overlay / traffic-fade / traffic-browser 全 PASS。
- 教训（新）：**「按像素反算参数」前先核对渲染器公式的因子** —— three 的点尺寸里没有 `1/tan(fov/2)`；
  多乘这一项就足以让上一轮的「机制不行」结论整个作废（本轮 r160 的 21.1 就是这么来的）。
- 账：**done 142→143 / partial 106→105**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

## 三·163、第 163 轮（A 类仍空 → B 取「任意凹轮廓拼进地形」单条组 1584623053061099520）→ **✔ 已收口**

**本轮实收口（1 条）**：`1584623053061099520`（453 帧 / 30fps / 21.57s）**→ done**。
证据 `artifacts/coverage/1584623053061099520-review-r163.md`；新测 `tests/splice-polygon-c09-browser.cjs`；页面补 `?on=0` / `__c09ctr` / 24 字段探针（无渲染改动）。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：note 的两句「任意轮廓插入 / 地形周边重新网格化仍缺」**是过期账**（第 39 次同型）—— 机制 r56 就在，且 `terrainmesh` 三处挂钩、node 测试、页面都齐，从没跑过页面而已。
- 片内（5 张联系表全看）：线框段 = 深青底 + **深色**三角网 + 白色 6 点带凹口占地 + 黄色半边扇绕顶点；实体段 = 黄橙屋顶 + 近白墙的房子坐在台地上，凹口留在屋顶；末段拉远成整岛（其余房子是预建 tile）。
- 新姿势（累积第 39 条）：**同一场景开/关两档的整帧亮度会整体差一档**（本例开档连天光都亮 ~20 级），
  所以「开/关整帧差分」在这种场景里**不能当判据**（第一版 64.6% 全屏差异，一度以为相机飘）；改用「相机 target 那块中心裁切里的材质色计数」才稳。
  另：噪声源要逐层试（本例 `vegetation` → 13px，云/烟/影/船/旗各关仍 4000+）。
- 账：**done 141→142 / partial 107→106**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 165 轮）**：A 仍空 → B 一组。`886199305522085890` 已于第 164 轮 done；
建议从 `next` 里挑一条**先 grep 再判 A/B** 的（`1809197832898433024` / `1189795466936320000`），判不动就标 C。
`1482011744843223042` 已于第 144 轮 done，不要再排。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` 是幻觉 ID，别再排。

## 三·162、第 162 轮（A 类仍空 → B 取「烧屋火光」单条组 837027901853810688）→ **✔ 已收口**

**本轮实收口（1 条）**：`837027901853810688`（514 帧 / 32.885fps / 15.63s）**→ done**。
证据 `artifacts/coverage/837027901853810688-review-r162.md`；新测 `tests/fire-burst-tiers-browser.cjs`；模块新增 `smoke.tierStats()`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：note 的「爆燃三层高度在曲线上测不到」**是真缺口**——机制三组早在 `fire-coupling.js#burstPlan`，
  缺的是把分层读到时间轴上的量具（两条曲线都只数整屏像素）。
- 片内实测（本轮新量）：0083 火球 bbox 71×69px、0084 69×67、0086 68×63，红火像素 6584→4586（0090）——火球只变亮再缩；
  **4× 裁切 + 亮度峰检测**得 0083 四个亮心 `(332,44)/(317,41)/(311,56)/(333,60)` = 高度上两组亮心 + 下沿第三团，即「三组高度」。
- 本轮补：`smoke.tierStats()`（只读，不改渲染）+ 12 点曲线测试（A 三组齐备 / B 世界高度分离 / C 上升速度不同 / D 上沿抬升 / E 单层对照 / F 全程不断层）。
- 账：**done 140→141 / partial 108→107**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 163 轮）**：A 仍空 → B 一组。首选 `1584623053061099520`（453 帧·房屋切入地形：任意轮廓插入 + 周边重网格，note 标「卡点·A 机制未做」，先 grep `multicell` 判 A/B）；
次选 `886199305522085890`（北境默认档：把 `#passagePx()` 下限改到等效物理像素后再翻默认）、`1482011744843223042`（384 帧·normal 反差细线，找不到「同一口径量两边」的量具就定案 C）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` 是幻觉 ID，别再排。

## 三·161、第 161 轮（A 类仍空 → B 取「网格编辑器选中态」单条组 1120036868966502401）→ **✔ 已收口**

**本轮实收口（1 条）**：`1120036868966502401`（703 帧 / 14.6275fps / 48.06s）**→ done**。
证据 `artifacts/coverage/1120036868966502401-review-r161.md`；新模块 `src/core/cell-selection.js`；新测 `tests/cell-selection.mjs` + `tests/grid-window-editor-browser.cjs`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。该条不在 TOP 18 内（单条自成一组），表内无行可改。
- 核实（先核再动手）：主场景有真撤销栈，但**全仓没有选中态**（`app.js` 里 `sel|selection|多选` 零命中；`grid-debug.html` 的选中是另一页、靠 NDC 反投影）→ note 挂了 15 轮的「仍缺与真编辑器撤销/多选联动」**不是过期账**。
- 顺带查出入口是假的：HUD 工具按钮只有 title 没有 onclick；左下角被「重构版·最新进度」条（z-index 100）与 `#coverage-progress`（z-index 7）压住，原有撤销/重做也点不到。
- 本轮补：① `CellSelection`（有序去重 id / `prune(Set|数组|谓词)` / `toSelection` / snapshot-restore，非法输入抛错）；② `app.js` 选择工具（`S`）+ 点选 + `Shift/⌘` 加减多选 + `Esc` 取消 + `pointermove` 不出建造幽灵块；③ 撤销栈**平行账本** `undoSel/redoSel`（`world.snapshot()` 格式不动，`game-ui.undoDepth`/replay 口径不变），undo/redo 逐条回位选中态；④ `endStroke / loadScene / 清空 / undo / redo` 后先 prune 再算窗口（`selectionStats.prunes/prunedCells/undoRestores`）；⑤ `?gridwin=1` 开等距格+窗口补丁（须在面板挂载后，否则被 `setDebug` 重放改回 false）；⑥ `index.html` 加「▣ 选择」格、信息条 `pointer-events:none`；`hud.css` 把 `#tools` 挪到底部居中。
- 读数（真实指针/键盘）：点选 `[1109]` → 窗口 `kept 10 / total 281`、含该格；Shift 点第二格（间距 2.999 格）→ 窗口变大且两格都在内；Esc → 窗口 null、格线 10→281；建造 top 1→2 → Esc → `Z` 撤销（top 回 1、选中 [1109] 回位、窗口回位）→ `Y` 重做（选中回到撤销那刻的空态）；`C` 清空 → prune 1 格。纯逻辑 31 条全过；回归 `topoline-pad-drag-browser` ALL PASS。
- 截图 `artifacts/coverage/grid-window-editor.png` / `-closeup.png` 均 ViewImage 看过（工具条无遮挡、补丁只覆盖一片 + 外缘回字环）。
- 账：**done 139→140 / partial 109→108**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 162 轮）**：A 仍空 → B 一组。首选 `837027901853810688`（514 帧·火光，note 只剩「爆燃三层高度在曲线上测不到」）；次选 `1584623053061099520`（453 帧·房屋切入地形，任意轮廓插入 + 周边重网格）、`886199305522085890`（r160 挂下的北境默认档，先把 `#passagePx()` 下限改到等效物理像素再翻默认）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。`1804240021131083778` 是幻觉 ID，别再排。

## 三·160、第 160 轮（A 类仍空 → 取「窄道点线」单条组 886199305522085890）→ **仍 partial（缺口收窄到北境默认档）**

**本轮不动 done 数**：`886199305522085890`（624 帧 / 32.6531fps / 19.11s）**status 保持 partial**。
证据 `artifacts/coverage/886199305522085890-review-r160.md`；新模块 `src/world/passage-overlay.js`；新页 `passages.html`（+ `src/ui/passages-review.js`）；新测 `tests/passage-overlay-browser.cjs`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- **先纠正一条假账**：`next` 连排 4 轮的首选 `1804240021131083778` **在 `learn/data.js` 与 `../../REA-agent/gifs/` 里都不存在**（`grep` 只在 `coverage-progress.json` / 本文件 / 记忆里命中）—— 与 r102 同型（`next` 指到的 ID 是幻觉）。本轮改用真实存在的 partial 条。
- 核实（先核再动手）：note 的两问「通用调试层（只挂 badnorth）」「近景点距略疏」**都是真的**（不是过期账）：`passageMarkers/heightRaster/sightFade` 齐，但只有 `battle.js#refreshPassages()` 一个调用点，全仓无第二个页面入口。
- 本轮补：① 把那段逻辑抽成 `PassageOverlay`（`refresh` 建点阵 + 栅格、`update` 逐点淡出、`measure` 出同深度「点距/点径」比值、世界尺寸 / 屏幕两档点径）；② 新页 `passages.html` 用**非北境**的两套 World（混合格 / 四方格）作通用入口，`?dots=0` / `?size=screen` / `?spacing=` 可切；③ 新测 `tests/passage-overlay-browser.cjs`。
- 新测读数：混合格 71 格 / 可走 56 / **窄道 17 格 29 段 84 点**、段段至少一端是窄格、每点都在格顶（≤1e-3）；世界尺寸点近景 **13.5px** / 远景 **7.0px**、同批段比值 **2.09 vs 2.49**；屏幕 7px 档近景比值 **3.33** vs 远景 **2.26**（反证「点不随距离长大」）；遮挡低机位 **33 颗** vs 高机位 **0 颗**；开/关 **97768px**（新增白点 67932）；四方格 49 点同样成立。
- 剩余（未做）：北境战斗默认仍是**固定 7px 屏幕点**。本轮试翻默认（世界尺寸 0.09 + 7px 下限）→ `traffic-dots-browser` 的**可读性直接掉档**（中位对比度 **40.3→21.1** < 阈值 35、可判读占比 0.676→0.514），故回退、不虚报；下一步要么另标点径，要么在 `#passagePx()` 里把下限抬到与旧口径等效的**物理像素**上。
- 账：**done 139→139 / partial 109→109**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 161 轮）**：A 仍空 → B 一组。首选 `1120036868966502401`（703 帧·marching squares 窗口接选中态，note 只剩「与真编辑器撤销/多选联动」，先 grep 编辑器撤销栈再判 A/B）；
次选 `837027901853810688`（514 帧·火光，note 只剩「爆燃三层高度在曲线上测不到」）、`1584623053061099520`（453 帧·房屋切入地形，任意轮廓插入 + 周边重网格）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238、`794993371261665280`。

## 三·159、第 159 轮（A 类仍空 → B 续收 r158 挂下的同一条：「抽象田野贴图」三条形制差）→ **✔ 已收口**

**本轮实收口（1 条）**：`1714613599035863191`（620 帧 / 29.3144fps / 21.12s）**→ done**。
证据 `artifacts/coverage/1714613599035863191-review-r159.md`；新测 `tests/field-pattern-bands.mjs` + `tests/field-pattern-bands-browser.cjs`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（r158 明确建议先收本条 ③ 再换组）。
- 核实（先核再动手）：r158 挂的三条**都是真缺口**（不是过期账）——模块/`uFields`/`aField` 都在，缺的是**页面入口 + 形制**。
- 本轮补：① `field-pattern.js` 新增 `uFields >= 3` 的 `fieldToneBands`（软方波宽软带：占空比 0.5、软肩、幅度 0.28、每块田 ±5% 色调差），
  **`uFields==1/2` 逐字节未动**；② `fields.html?stage=shape` 改走 `scene.overrideMaterial`（+藏海面/倒影/鸟 +藏半径>100 的天空罩与接影平面，
  否则整帧会被刷成一块黑），剪影里树/灌丛/瀑布一起黑；③ `?veg=0` 关植被/瀑布/云/船/鸟 + 关进度徽标 → 顶面回到裸浅色；
  ④ `window.fieldReview.cells()` 逐三角给出 (格心, u 轴, 内切半径, 三顶点)，取样**不出格**。
- 新测读数：node —— 占空比 **0.499 vs 0.441**、高频 sd **0.1235 vs 0.0894**、边沿过渡 **0.064 vs 0**、周期 0.2000、albedo 0.866–1.157；
  浏览器 —— 岛掩码 **290597 px（33.1%）**、掩码内亮度 **0.0**、光照段岛内绿像素 **20015 个在剪影段全 <24（0 残留）**、
  绿像素占比 **13.8%→6.9%**、植被开关差分 **80361 px**；近景 6 格 × 2 档：占空比 **0.480 vs 0.424**、配对比度 **5/6 格** 带上（均值 8.48 vs 7.81）。
- 新姿势（累积第 38 条）：**`scene.overrideMaterial` 不是「整场景」那么简单** —— 天空罩与接影平面（半径 >100）一起被刷黑 → 整帧一块黑，
  「剪影 vs 光照」差分连海面都圈进来（第一版 `darkShare 0.992`）；正解 = override 前先藏「背景类大网格 + 海面」，让 `scene.background` 露出来，
  剪影才是「黑岛 + 平底色」（=片 0140 的形制）。
- 坑：① 相机 `pitch` 逼近 π/2 时 `lookAt` 退化 → 相机矩阵 NaN（报在 `smoke-order.js` 的 "Invalid camera matrix"），近景俯视要留到 1.35；
  ② 近景取样的安全长度是**三角内切半径**而不是「格子的一半」（内切半径只有 0.09–0.13，正好一个周期），所以读数用「重心掩码内的 240² 补丁」而不是一条线；
  ③ 旧 `field-pattern-browser.cjs` 的岛掩码口径必须跟着改（原来是「剪影 vs 光照差分」，剪影藏海面后会把背景圈进来）。
- 账：**done 138→139 / partial 110→109**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 160 轮）**：A 仍空 → B 一组。按分数取 `1804240021131083778`（先核 `where` 是否过期，r155/r158 两次提到都没动）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·158、第 158 轮（A 类仍空 → B 取「抽象田野贴图」单条组）→ **仍 partial（缺口已收窄到形制差）** → **第 159 轮已全部收口（见上）**

**本轮不动 done 数**：`1714613599035863191`（620 帧 / 29.3144fps / 21.12s）**status 保持 partial**。
证据 `artifacts/coverage/1714613599035863191-review-r158.md`；新测 `tests/field-pattern-browser.cjs`。

- **A 类仍空**：TOP 18「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实（先核再动手）：note 的「原作手绘纹样 + 投射 atlas」= **第 37 次同型过期账** —— 原文末句 `In the end I probably want a mix…` 是作者的**后续打算**，
  7 张联系表（0–619 全帧）+ 2× 最近邻裁切里只有等间距程序化条纹，无手绘笔触；机制 `field-pattern.js`（署本片 ID）+ `aField`/`fieldFrame`
  + `terrainmesh.js:187` 逐格 `hash01(c.id*19+5)*π` + `view.js` 的 `uFields` 从 r56 就在，缺页面入口与运行验收。
- 片内结构：四处换岛（0135/0258/0474/0570）同构 —— **空屏 → 纯黑剪影 → 碎块 → 无光灰白 → 光照 → 田纹**；顶面裸浅黄无树无灌丛；条纹周期/岛宽 ≈ 3%。
- 本轮补：`fields.html` 的 `?stage=fields|lit|unlit|shape`（四段顺序第一次能逐段摆出来）+ 关 HUD/灌丛 + 修 `#plots` id 冲突；`window.fieldReview.report()`
  逐三角反解每格田纹坐标系（131 格方向 / 18 档全占 / 跨度 356° / 同机位周期 7.98px）。
- 新测读数：岛掩码内亮度 剪影 **18.03（88.2% 纯黑）** → 无光 **165.86** → 光照 **141.79** → 田纹 141.24；`unlit↔lit` **196548px**、`lit↔fields` **44045px**、噪声 **0**。
- **仍缺（本轮实测，写进 next）**：① 实景带树/灌丛/河、顶面多为草绿 → 开田纹信号幅度只升 **1.14×**、主频占比 **2%**（量具跨格，按观感记）；
  ② 片中宽软边带（占空比≈1:1）vs 本仓 0.18 幅度细线（改默认值会破 `uFields==1` 逐字节兼容，需新开一档）；
  ③ 剪影段只换地形材质，树/瀑布仍原色（`islands-c09.html?stage=silhouette` 的 `scene.overrideMaterial` 那层没搬过来）。
- 账：**done 138→138 / partial 110→110**。

**下一轮建议（第 159 轮）**：A 仍空 → B 一组。先把本条 ③ 收掉（纯页面、最便宜：`?stage=shape` 改走 `scene.overrideMaterial`，树/灌丛/瀑布一起黑），
再按分数取 `1804240021131083778`（先核 where 是否过期）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·157、第 157 轮（A 类仍空 → B 取「squad-footprint 单条组」）→ **✔ 已收口**

**本轮实收口（1 条）**：`883447205176238083`（654 帧 / 32.3923fps / 20.19s）**→ done**。
证据 `artifacts/coverage/883447205176238083-review-r157.md`；新测 `tests/squad-footprint-cells.mjs` + `tests/squad-footprint-battle-browser.cjs`。

- **A 类仍空**：TOP 18 的「路径」列全 ✔，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实（先核再动手）：本组四问**全是真缺口**（不是过期账）—— 模块只有凸包、主战场零引用、菱形与轨迹线都没有。
  r102 的教训（`next` 说未覆盖、其实模块不存在）在这里反过来用：`next` 说未接，实测确实未接。
- 片内结构（sheet-00 / sheet-03 本轮复看 + 首核 7 张全看）：紫雪台地、两支蓝队、青绿旗；脚下近白青色线网 = 格边界轮廓 + 中心辐条 + 角上小方块；
  0260–0290「+12」飘字；0430 前后一道细白线横穿（箭轨迹）；旗顶白菱形全片都在；无 UI/无结算。
- 同一口径量两边：片里能判「线沿格走（凹口保留）」「线贴台面」「菱形正对相机」「箭有细白尾巴」四句，
  本仓把四句变成可数量（面积 vs 格面积和 vs 凸包、顶点高度 vs `world.top`、四元数点积、轨迹端点位移 + 落定隐藏）。
- 新姿势（累积第 37 条）：**「抖性格网」上的「格边界」不能拿整数格去套** —— 本仓格是四边形但顶点抖动（面积 0.14–0.26），
  整数 `±0.5` 盒子的共享边根本不重合，必须用格自己的 `edges` + `edgeNeighbors`（邻格占用则抵消）才拼得出并集边界。
- 坑：① `cell.size` **不是**多边形面积（0.188 vs shoelace 0.141），面积口径要用 shoelace；
  ② 选中态切换的 0.1s 节流会把 `_fpSel` 留成旧队 → 取消选中时必须一起清 `_fpSel`，否则再选回来线网不刷新；
  ③ 主场景在 swiftshader 下首帧偶发 60s+，`goto` 要带重试；④ `#squadY`/暂停时 `dt=0`，箭不会前进，量"飞行中"必须短暂放开暂停。
- 账：**done 137→138 / partial 111→110**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 158 轮）**：A 类仍空 → B 一组。首选 `1714613599035863191`（620 帧·field-pattern，先 grep `src/terrain/field-pattern.js` 是否零页面引用）、
次选 `1804240021131083778`（先核 where 是否过期）、`1677242779162877952` 已在 r120 收口（勿重排）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。



## 三·156、第 156 轮（A 类仍空 → B 取「patch 续作」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1781405550061687016`（219 帧 / 14.4554fps / 15.15s）**→ done**。
证据 `artifacts/coverage/1781405550061687016-review-r156.md`；新页 `patch-blend.html`；新测 `tests/patch-blend-browser.cjs`；模块补白浪线 + 圆点。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条是「A 性质、组分数归 B」：模块 + node 测试 + `?shade=` 入口都在，缺页面入口与运行验收）。
- 核实（先核再动手）：note 的「接口尚未迁移 / 机制未做」两问都假 —— 第 36 次同型过期账；`view-shading.js:25` 早就 `import { buildPatchField }`，`:286` 就是烘图。
- 片内结构（3 张联系表全看 + 原尺寸 0120/0135 + 3× 裁切）：球体自转 → **0120 起推近 + 右侧 PS 窗口移入**（`Planet.psd @ 175%`，
  窗内 UV 块自上而下 = 绿 → 浅绿草缘 → 暗紫岸缘 → 橙沙滩 → **白横线** → 蓝水 → **白横线** → 泡沫点 → 绿圆点）→ 0154 窗口移出 → 末帧静止。全片无 UI/帧率/建造。
- 同一口径量两边：片里只能判「花纹跨格不断」「白点沿弧长等距」「白线与岸平行」「过渡无硬边」；本仓把四句变成可数的量
  （跨格边 vs 同格内部差分、白点间距 0.4、UV 条上整行白的行段数、hard/alpha/height 的 jump 与 softMeanPx）。
- 新姿势（累积第 36 条）：**「图集/贴图类」缺口要把 UV 空间单独摊开画一条** —— 世界空间里 9 纹素宽的岸带在截图上永远读不出「几点几线」，
  按 (u,v) 铺成 520×140 的展开条后，白点的颗数与白线的道数当场可数（这也是原片那扇窗在做的事）。
- 坑：① `dotSpacing: 1e9` 不是「关掉白点」—— `dot = |u/1e9 − round(·)|` 恒 ≈ 0，等于**全带白**（第一版浪线扫描把点带读成第三条线）→ 关档要传 0 并在模块里判 `dotSpacing > 0`；
  ② 世界空间窗口要 clamp 源矩形，否则越界部分整块黑；③ 白点用 `dot < .2` 只判 u 会在 v 方向铺满整带 → 条纹像"栅栏"，必须用 u/v 两个方向的圆判据。
- 如实口径（不计缺口）：场景只画陆侧半幅岸带（`sd ≥ 0`），水侧归水面片；岸带 9 纹素宽 → 实景断续小斑；本仓 World XZ 投影 vs 原片球面 UV；无手绘草缘/暗紫岸缘。
- 账：**done 136→137 / partial 112→111**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 157 轮）**：A 类仍空 → B 一组。首选 `883447205176238083`（654 帧·squad-footprint，页面已在，先 grep 判是否只缺运行验收）、
次选 `1714613599035863191`（620 帧·field-pattern，`src/terrain/field-pattern.js` 需先核是否已接页面）、`1804240021131083778`（先核 where 是否过期）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·155、第 155 轮（TOP 18 全 ✔ → B 取「矩形树续项」组，2 条一并收口）→ **✔ 已收口**

**本轮实收口（2 条）**：`1765115069837221962`（247 帧 / 9.5403fps / 25.89s）**→ done**、`1765041830461055127`（558 帧 / 19.4019fps / 28.76s）**→ done**。
路径：A 性质（机制全在、只缺页面运行验收），分数归 B 组。
证据 `artifacts/coverage/1765115069837221962-review-r155.md`、`artifacts/coverage/1765041830461055127-review-r155.md`；
新测 `tests/atlas-tree-arm-browser.cjs`、`tests/atlas-remove-frag-browser.cjs`；页面只补 `?arm=0` 关档 + `window.atlasTree` 三个只读探针（机制零改动）。

## 三·154、第 154 轮（A 类仍空，B 取「球面岸缘贴图」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1783792917183606829`（242 帧 / 33.3333fps / 7.26s）**→ done**。
证据 `artifacts/coverage/1783792917183606829-review-r154.md`，新测 `tests/worldmap-shore-browser.cjs`（真修 1 处：贴图 DataTexture 缺 sRGB 标记）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条是「A 性质、组分数归 B」：模块 + node 测试 + `?shore=1` 入口都在，缺运行验收）。
- 核实（先核再动手）：「算法未公开」是假 —— `shoreDistance` 的球面度量与 `worldMapShoreColors` 的四层配色都是明写的；原片近景的三件东西（暗带/浪线/沙滩）逐项对得上。
- 片内结构（3 张联系表逐格 + 原尺寸 0000/0155/0220 + 4× 裁切 0220/0155）：深蓝底光滑贴图星球自转约 0.9 圈 → f0140 起推近到半球尺度 → 末帧静止；无 UI、无帧率、无建造。
- 同一口径量两边：片内只能判「暗带在陆侧、浪线平行且越外越淡、沙滩只在部分海湾、草成块斑驳」；本仓把四句变成可数的量（离岸距离剖面的峰/谷、暗带深度与位置、沙滩占岸线比、绿通道双峰与游程 P50）。
- **新姿势（累积第 33 条）**：**「贴图类」缺口先量 DataTexture 的 colorSpace** —— 看着「有点淡」不代表原片更艳；本仓 `view-c07`/`view-c10`/`doodle-overlay` 都显式标了 sRGB，唯独世界贴图漏了 → 整颗星球被线性→sRGB 提亮一次。
- 坑：① 贴图是经 `attachWorldMap` 走 uniform 挂的，`material.map` 为 `null`，取 texture 得自己 import 模块重建；② 判浪线不能按颜色阈值（沙 237,235,219 与浪 204,229,227 在 `r>180&&g>200` 下重叠，第一版把 2685 个沙滩像素数成浪线）→ 用「海侧亮度-离岸距离剖面去基线后的峰」并按 0.006 rad 聚簇；③ 沙滩只占 26% 岸线 → 近景机位要扫 yaw（第一版 yaw=0.6 整屏是海、沙 0 像素）。
- 如实口径（不计缺口）：贴图 1024×512（近景 4–5 屏幕像素/纹素；2048×1024 烘焙 2.1s 未采）；沙滩覆盖 25.9% vs 原片更像 60%+ 连续细带、无卵石点；暗带比原片窄且硬。
- 账：**done 133→134 / partial 115→114**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 155 轮）**：A 类仍空 → B 一组。首选 `1765115069837221962`（atlas 续项，`atlas-browser.cjs`/`atlas-live-browser.cjs` 已存在，要先对口径再判 A/B）；
次选 `1804240021131083778`（若仍 partial，先核 `where` 是否过期）、`1781405550061687016`（seamless patch blending：投射 grass/water 与手工 UV 岸带，src 已有 `terrainmesh.js` 混色，先 grep 判是否只缺运行验收）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·153、第 153 轮（A 类仍空，B 取「环绕相机运动模糊拖影」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1727315611959865407`（337 帧 / 33.2347fps / 10.14s）**→ done**。
证据 `artifacts/coverage/1727315611959865407-review-r153.md`，新测 `tests/orbit-smear-browser.cjs`（真修 1 处：拖影通道二次色调映射）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条是「A 性质、组分数归 B」：模块 + GLSL 孪生 + node 测试 + `?fx=smear&spin=` 入口都在，缺运行验收）。
- 核实（先核再动手）：note 的两条「方向性轮廓拖抹 / 速度场与全指标接口仍待补」+「算法未公开」全假 —— 切向速度场 `orbitVelocity`、单帧 6 抽样 `smearImage`/`orbitSmearAt`、长度 `smearLengthPx`、指标 `sharpnessBand` 全在；且「环绕相机每个像素的位移是解析的（v = ω×(p−c)·dt）」本身就是算法。
- 片内结构（4 张联系表逐格 + 原尺寸 0000/0044/0118/0130/0336 + 4×/6× 裁切 0041/0118/0311 与 0039–0042 四连帧）：studio 绿底单岛环绕；0038/0069/0118/0180/0227 为快转段（帧间差分峰 18.1/17.7/17.9），岛内 lap95 由 69 掉到 47–51；0150–0169、0300–0336 为停镜段（差分 0.02–0.13、lap95 61–62、轮廓 1px 硬边，**停镜后无残留副本**）。全片无 UI/无帧率/无建造。
- 同一口径量两边：片内只能判「快转段变软 + 停镜即恢复 + 抹开方向随位置变」，本仓把这三句变成 lap95 / 各向异性 dy÷dx / 岛内环形差分 / omegaDt=0 恒等 + 实时 outerPx。
- 新姿势（累积第 32 条）：**「合成通道」类缺口要先量同输入下的平色样本** —— 拖影开着的画面看着只是「糊」，但 RT 往返把色调映射做了两遍，`omegaDt=0` 时平色就 +13 级；只要在 A/B 里放 5 个平色取样点，画质回归当场露头（本轮之前没人量过，挂在墙上 97 轮）。
- 坑：① 主场景自己 rAF → `v.__orig=v.render.bind(v); v.render=()=>{}` 冻帧，且渲染必须 `__orig(0)`（dt=0）否则动画推进把同状态噪声抬到 15+；② **A/B 的参照帧必须同机位**（第一版拿 yaw₀ 的干净帧去比 yaw₀+0.22 的拖影帧，读出 22.8 级假差异）；③ `pe.stats()` 在每次 render 后刷新 —— `step()` 里若末尾再 `grab()` 一次（omegaDt=0）就把刚测到的 stats 覆盖成 0，必须把「回读」和「重渲」拆开；④ 2× 角速度已在 `maxPx 24` 截断 → lap95 不再降（9.84 vs 9.64），断言要留饱和说明，不能写成「必须单调」。
- 如实口径（不计缺口）：实时路径用固定快门 1/60 + `maxPx 24` 截断，原片快门角度无法从 640² 反推；`View` 原有的 `setDebug('motionblur')` 历史叠加通路保留未动（两者各自开关）。
- 账：**done 132→133 / partial 116→115**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 154 轮）**：A 类仍空 → B 一组。首选 `1783792917183606829`（`worldmap-shore.js`/`worldmap.js`，先 grep 判「只缺运行验收」还是真缺机制）；
次选 `1765115069837221962`（atlas 续项，注意 `atlas-browser.cjs` 已存在，要先看是否同口径）、`1804240021131083778`（若仍 partial，先核 `where` 是否过期）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·152、第 152 轮（A 类仍空，B 取「支持悬挑的地形要炫出来」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1671808851895627776`（303 帧 / 30.7927fps / 9.81s）**→ done**。
证据 `artifacts/coverage/1671808851895627776-review-r152.md`，新测 `tests/overhang-soffit-browser.cjs`（机制零改动，只加页面只读探针与 `#nocap`）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条是「A 性质、组分数归 B」：模块 + 4 支回归在，缺运行验收与量具）。
- 核实（先核再动手）：note 的两问都假 —— ①「软坡/侵蚀机制未做」过期（`minimaAfter` 0、0 局部极小、台阶/崖面 245/645→353/558）；②「没看见朝下底面」是**夹具自己把帽檐埋了**：原 `support` 把中心格以外的邻格也填到 5 层，帽檐与周围同高，画面上根本读不出外伸。
- 片内结构（4 张联系表逐格 + 原尺寸 0000/0130/0250/0302）：0000 纯黑剪影首帧（岛轮廓仍在黑里可辨）→ 0006 起环绕黄沙台地岛 + 浅灰岩体 → 0090–0149 蘑菇岩成形（宽帽岩压细柱、帽檐底下一圈暗面、帽与邻壁之间可看穿的缝）→ 150–229 镜头抬高回落 → 230–302 低机位复现，帽檐底面成一条暗带、柱子两侧透背景。全片无 UI、无帧率、无建造。
- 同一口径量两边：片中只能判「帽檐底面在画面里且暗 / 缝能看穿 / 底下是空气」；本仓把三句变成「朝下面三角入画与遮挡数 / 檐下投影框 P10 与暗占比 / 空洞射线命中柱壁的余量」。
- 新姿势（累积第 31 条）：**悬挑类缺口要把「朝下面」和「空洞」分开数，且夹具周围不能有同高度台面** —— 只报「World 里有 1 个底面」会被「那它画出来了没、暗不暗、缝通不通」三问接连问倒；而夹具一旦把帽檐埋进同层台面，量具再准也只能读出「视角遮挡」。
- 坑：① 主场景自己 rAF（`setAnimationLoop(null)` 管不到）→ 必须 `v.__origRender??=v.render.bind(v); v.render=()=>{}`，否则同状态噪声 1 万 px；② 冻帧后 `worldMesh.invalidate()` 不会自己重建（重建在 render 里）→ 每次切开关都要手动 `__origRender(0)` 再探针；③ 「檐下一条带」在仰视时会落到帽檐**前壁**上（quad 首次读数 110 vs 101，判成「有檐更亮」）→ 改成量朝下面**自身投影框**（P10 36 vs 101 一判就开）；④ 量朝下面要按「3 个法线均值 < −0.5 且质心距帽檐列 < 1.15 格」筛，否则整岛所有向下台阶都进来。
- 如实口径（不计缺口）：夹具是 1 格外伸唇口 + 3 层空腔，原片是整格帽岩压细柱，**比例未对齐**；薄檐平滑后仍留 **70.2%（mixed）/78.9%（quad）** 格状面积（`guardDeformation` 的 `minAreaRatio .3` 容差，不是缺机制，保护开/关差 1.7×/3.5×）；跨切面 3D 侧壁交叉未在本片单独量化（碰撞由 `terrain-collide.js` 承担，`soft-tops-collide-r55` 回归 overhangWalls 27、maxPen ~1e-10）。
- 账：**done 131→132 / partial 117→116**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 153 轮）**：A 类仍空 → B 一组。首选 `1727315611959865407`（`src/**/camera-motion.js` 署该片 ID，全仓无对应 `-browser.cjs`，先 grep 判「只缺运行验收」还是真缺机制）；
次选 `1783792917183606829`（`worldmap-shore.js`/`worldmap.js`）、`1765115069837221962`（atlas 续项，注意 `atlas-browser.cjs` 已存在，要先看是否同口径）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·151、第 151 轮（A 类仍空，B 取「无缝缓坡 + 锐利崖 / 侵蚀无低洼 / 方三角同岛」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1447488323845509121`（656 帧 / 11.6934fps / 56.04s）**→ done**。
证据 `artifacts/coverage/1447488323845509121-review-r151.md`，新测 `tests/soft-slope-cliff-browser.cjs`（机制零改动，只加页面只读探针）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条同属「A 性质、组分数归 B」：模块 + 5 支 node 测试 + 页面四开关都在，缺的只是运行验收与量具）。
- 核实（先核再动手）：note 的「算法未公开 / XZ 形变不等于连续坡面」两问都假 —— `softCorners` 就是「并查集把 1 层台阶分组、组内共用角高」，`terrainmesh` 在两角焊死时**整条墙跳过**；`erodeHeights` 是整级 stream-power + 填洼，返回 `minimaAfterFill`。
- 片内结构（7 张联系表全看 + 原尺寸 0000/0160/0444/0510 + 3× 裁切）：全片是「着色 ≈20 帧 ↔ 白线态 ≈20–25 帧」的循环、重复 8 次以上；白线只画台地沿口折线与逐级短竖线，无底图、无 UI、无建造。
- 同一口径量两边：片中只能判「左侧斜面 + 右侧竖直崖同框、白线处是台阶/无线处是坡」；本仓把这三句变成可数的量（焊死率 / 1 层墙减少量 / 崖墙三档不变 / 台地线 seamless 数 / 侵蚀后的低洼数）。
- 新姿势（累积第 30 条）：**「焊了几条」与「崖动没动」要分开数，墙按层分档是最硬的量具** —— 1 层墙减少量 == seamless 数、≥2 层墙三档数量一字不差，两个数一起才叫「合流」；只报「斜面面积涨了」会被「那崖是不是也被磨平了」问倒。
- 坑：① **A/B 必须用 `?tops=0` 对照**，`?soft=0` 会换掉 `softSlopes` 的高度量化（两座不同的岛）；② 不冻帧噪声 3637 px（比信号大），冻 `v.render` 后噪声 0；③ `{ off: await load(a), on: await load(b) }` 会先跑完两次导航再取图 → 两张都来自第二个 URL。
- 如实口径（不计缺口）：坡面是逐格折线连续，不是跨多格平滑曲面；斜面占顶面 18.8%，原片该比例量不出来。
- 账：**done 130→131 / partial 118→117**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 152 轮）**：A 类仍空 → B 一组。首选 `1671808851895627776`（303 帧·悬挑/岩檐续作，`src/terrain/*` 7 个模块 + 3 个 node 测试、无 `-browser.cjs`）；
次选按「模块在 + node 测试绿 + 无 `-browser.cjs`」继续筛（`ls tests | grep -v browser` + `grep -rln <片ID> src/`）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·150、第 150 轮（A 类仍空，B 取「草丛两次采样反差纹理 → 描边强度」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1590674061092212738`（181 帧 / 26.93fps / 6.72s）**→ done**。
证据 `artifacts/coverage/1590674061092212738-review-r150.md`，新测 `tests/grassline-contrast-browser.cjs`（无源码改动：模块与页面入口 r56 就在）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本组是「A 性质、组分数归 B」：机制 + node 测试 + 页面入口都在，缺运行验收）。
- 核实（先核再动手）：note 的两条「只静态 aEdge / 未实现 GPU 采样与背景射线」两问都假 —— `glOutline()` 顶点着色器里就是两次采样（`glSample(o.xz)` 与沿 `normalize(o-cameraPosition)` 步进到高度场命中处的采样），JS 孪生 `grassOutlineStrength` 同一套常量（steps 28 / t0 .06 / growth 1.12 / maxT 9 / gain 2.2）。
- 片子结构（181 帧 / 2 张联系表逐格 + 原尺寸 0000·0090·0150·0180）：全片只有「诊断配色的多层岛 + 沿口/崖脚的草卡带 + 环绕镜头」，无 UI、无建造、无第二机位。
- 同一口径量两边：片子里只能判「贴着不同色背景的草卡有深色外轮廓、落在同色区里的几乎没有，且随镜头转」；本仓把这句话全变成可读量（强度分布 / 与 aEdge 的分歧率 / 转镜头的逐卡变化 / GPU 回读 / 贴白底那圈的墨占比）。
- 新姿势（累积第 29 条）：**「着色器里的二次采样」要证，必须做「单卡隔离渲染」** —— 整岛 4491 丛互相遮挡，按屏幕坐标取样读到的是挡在前面的另一丛（第一版 48 个样本 vGpu 全 ≈1、vCpu 0.04，差点写成「着色器没按公式走」）；
  正解是临时 Scene + 同 geometry/material 的 1 实例 InstancedMesh，GPU 与 JS 孪生随即对齐到 8bit 量化级（0.003）。
- 坑：① RT 宽高比不等于 `camera.aspect` 时 NDC→像素整体缩 1.03，±3 窗必然读到邻卡；② `v.render` 冻住后 `shading.update()` 不再自动跑；
  ③ 判「轮廓有无」不能数整窗暗像素 —— `ink = max(外轮廓, 0.8×叶瓣弧线)` 里那条 0.8 弧线两态都在，必须只看**贴背景的那一圈（ring）**。
- 如实口径（不计缺口）：原作反差纹理在 mesh UV 上，本仓是 XZ 平面图 + 顶高的 2.5D 近似；两张整岛图用默认地面配色（地面诊断色走 r55 `?shade=contrasttex`，不在本轮口径）。
- 账：**done 129→130 / partial 119→118**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 151 轮）**：A 类仍空 → B 一组。首选 `1447488323845509121`（656 帧·软坡续作，`src/terrain/*` 6 个模块 + 6 个 node 测试、无 `-browser.cjs`；
先 grep `softSlopes/erode` 判「模块在只缺验收」还是真缺侵蚀保证）；次选 `1671808851895627776`（303 帧·悬挑/岩檐续作，src7/tests3）。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·149、第 149 轮（A 类仍空，B 取「边境四步 + campaign 墨层」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1097458505315946496`（14 帧 / 2.4138fps / 5.80s）**→ done**。
证据 `artifacts/coverage/1097458505315946496-review-r149.md`，新测 `tests/frontier-fields-campaign-browser.cjs`，新模块 `src/campaign/map-ink.js`。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本组同样是「A 性质、组分数归 B」：四步机制与 node 测试都在，缺页面成品形制）。
- 核实（先核再动手）：note 的「两侧细分未实现」是过期账（第 28 次同型）—— `frontierFields` + `buildFrontiers` r55 G3 就在，`tests/frontier-fields(.mjs)` / `frontier-fields-campaign.mjs` 一直绿。
- 片子结构（联系表逐格 + 原尺寸 10 帧 2× 放大）：0000 只有岛图标 → 0001 黑三角网（外圈 padding 扇形）→ 0002 三角网变淡 → 0003 第一条墨色前线 → 0004 三条虚线墨线 → 0005/0006 padding 扇形 + 左侧转纸质底 →
  0008 两侧场分色 + 海面波纹 → 0013 终帧地名 / 航路箭头 / 墨色虚线前线 / 小数字 7–13 / 场内等高线。
- 同一口径量两边：片中只能判「多条虚线 + 数字 + 地名 + 箭头 + 两侧场分色」这套形制；本仓把每件事都变成可数的量（45 地名 / 63 箭头 / 25 阶段号 / 3 条虚线 / 84 条波纹 / 4 个带色差 11.71）。
- 新姿势（累积第 28 条）：**「整幅 ImageData 别过 CDP」** —— 1440×900×4 的两个数组传回 Node 会被截断，`total` 看着正常但局部框恒 0（NaN 比较），差点把「画了」写成「没画」；
  正解是在页面内 `createImageBitmap` 解码两张 PNG、只把小结果（差分计数 / 取样均值）传回。本条与「噪声底 + 开/关差 + 反向对照」三件套一起用。
- 坑：① 地名按哈希取会重名（45 岛 1 对），必须按 id 索引；② `drawFrontierFields` 的 `wire` 在第 5 步要关，ear-clip 的 padding 长条三角会拉出一大束扇形线糊掉成品；③ 片中小数字语义在 560×420 下不可证 → 本仓写「主航路阶段号 + 前线步序」并在证据里注明。
- 如实口径（不计缺口）：手绘地名 → 程序化音节 + 斜体；手绘等高线 → 正弦波纹；片里 3 条并行前线对应本仓 `fieldPos=-6,0,6`。
- 账：**done 128→129 / partial 120→119**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 150 轮）**：A 类仍空 → B 一组。「`tests/*.mjs` 在跑但无 `-browser.cjs`」这条筛子本轮已把最便宜的一批吃掉，下一批首选
`1590674061092212738`（草丛顶点采样 contrast texture，src4/tests1 无 browser）与 `1447488323845509121`（软坡续作，src6/tests6 无 browser）；
次选 `1671808851895627776`（悬挑续作，src7/tests3 无 browser）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·148、第 148 轮（A 类仍空，B 取「mesh merger / merge-bench」单条组）→ **✔ 已收口**

**本轮实收口（1 条）**：`1401145625572425728`（349 帧 / 32.8625fps / 10.37s，"Meshes in Townscaper are kept small … wrote a mesh merger … tripling the rendering speed"）**→ done**。
证据 `artifacts/coverage/1401145625572425728-review-r148.md`，新测 `tests/merge-bench-browser.cjs`。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（本条实为「A 性质、组分数归 B」：模块与 node 测试都在，只缺页面入口）。
- 核实（先核再动手）：`benchMerge` 全仓**零页面引用**，`save-mesh.html` 只有 `measureWorldSurface` 一个读数；原 note 的「卡点·E 环境不具备」= 第 27 次同型假标签。
- 片子结构（4 张联系表逐格全看 + 原尺寸 0000/0036/0050/0348）：0000–0035 全彩城镇环绕；**0036–0078 白线三角网叠在着色面上**（每个四边面一条对角线）；
  0079–0259 关线框继续环绕并拉近/拉开；0260–0299 只有局部（植被/地面）细线网；0300–0348 收敛到与 0000 近似机位。**片中无任何帧率/提交数读数、无建造过程**。
- 同一口径量两边：原片只能判「线框是叠加层、每个四边面 1 条对角线」；本仓补的叠加层 17224 三角 → 34392 段（2.0×，共享边去重）、开/关差 8718px @300²、回位 0。
- 新姿势（累积第 27 条）：**「性能类缺口」先把「提交次数」和「耗时」拆成两个数** —— 提交次数是可以硬证的（270/330 → 1，且逐数一致），耗时在软件光栅上只能给**边际成本**（5.1–6.4 µs/提交）与量级，
  否则要么拿「三倍」当结论（原作在 Switch 上、本机不复现），要么因为「复现不了三倍」把整条永久挂 partial。
- 坑：① `view.setDebug('wire')` 是 `material.wireframe=true`，**面会被挖空**（第一版截图整屏看穿，与原片「白线+实心色块」完全不像）→ 形制差要另建叠加层；
  ② `WireframeGeometry` 会去重共享边，段数 ≈ 2.0×三角（闭合流形 1.5×，本仓地形有开边故偏高），断言不能写 `=== 3×三角`；
  ③ 页面 `#status` 会被脚本里每次 `saveMesh.bench()` 改写，**点按钮那条断言必须先清空状态再点**，否则读到的是上一次 evaluate 的读数（本轮第一版就假通过）；
  ④ `world.cells` 的格心是 `cx/cz`（不是 `x/z`），写错会让相机矩阵变 NaN，报错点在 `smoke-order.js` 的 "Invalid camera matrix"，离现场很远。
- 如实口径（不计缺口）：SwiftShader/ANGLE 软件光栅上「三倍」不复现（8×8 视口 1.05–1.07×、全视口 0.99–1.01×）；本仓城镇是程序化配色，线框叠加层在亮橙屋面上对比偏低；
  1px 是 WebGL `linewidth` 上限；主体只含地形+建筑，不含水/植被/阴影。
- 账：**done 127→128 / partial 121→120**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 149 轮）**：A 类仍空 → B 一组。首选按「`tests/*.mjs` 在跑但无 `-browser.cjs`」筛一批（`ls tests | grep -v browser` + `grep -rln <片ID> src/`）；
次选 [041] 1459 之外的「模块在 + 默认值/接线没接上」同型项（r132 punch、r144 normalline 两次命中）。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·147、第 147 轮（A 类仍空，B 取「拓扑续项」组：拓扑直线 / 手柄 / 连刷）→ **✔ 已收口**

**本轮实收口（1 条）**：`1384958097542819845`（679 帧 / 31.392fps / 21.60s，"I wrote a script to trace topologically straight lines across the Townscaper grid … for the gamepad controls and possibly some drag-to-paint mode"）**→ done**；
同组 `1147881669350891521` 早已 done → **该组 2/2 片全清**。证据 `artifacts/coverage/1384958097542819845-review-r147.md`。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实（先核再动手）：note 从 r56 挂到 r146 的「游戏手柄/连刷仍未接入」是**第 26 次同型过期账** —— `src/ui/game-ui-c06.js`（文件头署本片 ID）早就有
  `straightLineThrough`（向前 `traceStraightReport` + 向后 `(e+2)%n` 拼整条线，闭环走单枝）、`stepCursor`（十字键上/下沿直线走一格且退出边=入口边对边、左/右换向）、
  `paintLine`（整条线每格 +1 层，进主场景真撤销栈）、`pointermove+pointerdown` 连刷（`state.tool==='line'`）、`navigator.getGamepads` 轮询（按钮 12–15 + A=0，`padPrev` 去抖），
  入口 `index.html?gameui=1&topoline=1`；`tests/topoline.mjs` / `tests/topoline-browser.cjs` / `tests/game-ui-c06.mjs` 一直绿，**唯独没有主场景的浏览器验收**。
- 片中结构（7 张联系表全看 + 原尺寸 0020/0300/0650 + 0300 做 4× 最近邻裁切）：细白线从光标向**两侧**延伸、在**每个格边界上折**（f0020）；
  f0060–0199 起多条线交叉 + 小闭环；f0280–0299 出现绕岛的一整圈闭环；f0300–0399 闭环稳定；**f0650 一屏 4–5 条**（大闭环 + 小闭环 + 两条长线，交叉共格）；
  f0600–0615 几乎无线；f0670–0678 收敛到 1–2 条。片中**没有**手柄操作、没有按下拖动连刷（作者原话是「打算用」），也没有建筑被沿线生成。
- 本轮补的三处真差距（机制主线一字未动）：
  ① **线型**：原片是**连续 1px 白线**（4× 裁切可数），本仓用 `LineDashedMaterial`（dash .12/gap .09）→ 改 `LineBasicMaterial` 实线；
  ② **条数**：原片一屏 4–5 条，本仓只画当前光标这一条 → 补历史轨迹层 `topoline-trails`（`LineSegments`，最近 **5** 条、opacity .5、renderOrder 19，同「格+出口边」不重复入栈）；
  ③ 线/轨迹对象加 `name`、句柄加 `clearTraces()`，验收不再靠材质类型猜。
- 新测 `tests/topoline-pad-drag-browser.cjs` **ALL PASS**（合成 gamepad 走页面真实轮询分支）：
  闭环 **46 格** / `reason=loop` / 末点落回**起点格出口边中点** `gap=0.00e+0`；**对边穿出 89732 对、违例 0**；
  折线转角 p50 **8.2°** / p90 **21.8°**（>3° 的拐点 36/44，拓扑直 ≠ 世界空间直线）；画 9 条 → 当前 1 + 历史 **5** 条（1548 段）；
  像素 46/46 格入画（dist 14.2）、开/关差 **3545 px**、再开回位 **0**、同状态噪声 **0**；
  手柄「右」换边 3→0（格不变）、「上」走进邻居 2097 且出口=**对边 3**、「下」退回 2098、A 一次 = 1 条 `paintline` 且 **+189** 格、**按住 1.3s（≈5 帧）只 1 次**；
  真指针拖过 4 格连刷：体素 734→1575（**+841**）、8 次 `paintline`、撤销 8 步回 **356**；闭环单次连刷 46/46 格全 +1 层；0 console error。
- 回归 `tests/game-ui-c06.mjs` PASS（lines 1200 / loops 28）、`tests/topoline-browser.cjs` exit 0。
- 新姿势（累积第 26 条）：**「1px 线的虚实 / 一屏几条」这种形制差，要放大到同一口径去数** —— f0300 4× 最近邻裁切数连续像素（判实线）、f0650 数条数（判多线），
  两个数就把「虚线」「只画一条」两个旧假设否掉；整帧缩略图上根本判不了 1px 线的虚实。
- 坑：① 主场景冻帧（`v.render=()=>{}`）后 `updateCamera()` **必须自己调**（相机更新不在 `render()` 里），否则 46 格只有 17 格在画面内；
  ② `project()` 的 NDC z 在 dist 26 时约 **0.991**，`z<0.98` 会把整屏判成不可见；③ `actState.depth` 只在 rAF 刷新，同步撤销循环里每步都要调页面自己的 `refreshActs()`。
- 如实口径（不计缺口）：手柄是**合成 gamepad**（本机无设备）但走真实轮询分支；原片多条线同亮度、本仓历史轨迹压暗到 .5（取舍，不是机制差）；
  本仓是四边格、原片是不规则四边/六边混合网（三角格上「对边穿出」退化为 `nonquad` 终止）；片中连刷/手柄是作者自述的计划用途，本仓按此实现并验收。
- 账：**done 126→127 / partial 122→121**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 148 轮）**：A 类仍空 → B 一组。首选 `1401145625572425728`（merge-bench / mesh merger：note 的「【卡点·E 环境不具备】」已被 r146/r147 两次证明是假标签，
先量 `drawcall / 提交次数 / merge 耗时` 三个数再判 A/B/C）；次选继续按「`tests/*.mjs` 在跑但无 `-browser.cjs`」筛一批。
维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·146、第 146 轮（A 类仍空，B 取 [040] 余项：job 里的 Thread.Sleep / 共享时钟慢放）→ **✔ 已收口**

**本轮实收口（1 条）**：`1670064751181791233`（420 帧 / 18.397fps / 22.80s，"mimic Thread.Sleep() in Burst! … write to it from the main thread and read it from inside a job"）**→ done**；[040] 组 4/4 片全清，组已收口。证据 `artifacts/coverage/1670064751181791233-review-r146.md`。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实（两件事都核）：① 机制早就在 —— `src/terrain/pipeline-job-c08.js`（文件头署本片 ID）的 `runJob`（7 段节奏 + 多轮循环）/`createJobControl`（= static NativeArray 同构：`SharedArrayBuffer` 的 SCALE/PAUSED/ROUND/PARK 四槽）/`makeJobSleep`（每片 ≤16ms 重读、`Atomics.wait` 阻塞）/`startJob`（`new Worker(module)`）+ `pipeline-job-worker-c08.js` 真 Worker，`tests/pipeline-job-c08.mjs` 一直绿。
  ② **原 note 的两句都过期**：「卡点·E 环境不具备」= 页面实测 `coi:false / sab:'undefined' / mode:'copied-busywait'`，根因是 `tools/serve.py`（r56 时代就有了）从不发 COOP/COEP；「四轮节奏」= 片内 420 帧只有**一轮** 22.83s + 片头 0.84s 上一轮尾巴，没有第二轮。
- 片子结构（5 张联系表全看 + 6 帧原尺寸）：f0000–0022 上一轮水彩成品 → f0023 清空（边缘密度 0）→ f0024–0149 三角网逐点生长（7.41s）→ f0150–0157 抬墙 → f0158–0224 灰模（yellowFrac 0）→ **f0225–0231 纯黑剪影 7 帧 0.38s**（黑像素 30.3%）→ f0232–0329 上色 → f0330–0419 静止。
- 改动（机制主线一字未动）：`tools/serve.py` 加 `COI_PREFIXES = ('/job-c08.html', '/src/terrain/pipeline-job')`，只给这条链路发 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`（**不全局**，COEP 会牵连所有子资源；已核实 `/index.html` 不带）；`job-c08.html` 暴露 `frames/crossOriginIsolated/sharedBuffer/workerIsReal/rhythm/setScale/pause/resume`、把 `第 x/4 轮` 的硬编码 4 改成实际 `ROUNDS`、提示语补「原片只有一轮 + 需 COI」。
- 新测 `tests/pipeline-job-shared-clock-browser.cjs` **PASS**（连跑 3 次稳定）：`mode=shared-atomics` + `SharedArrayBuffer` 可用 + `worker instanceof Worker`；job 睡觉期间 400ms 内主线程 rAF **24 帧**（睡眠确实在另一个线程）；阶段顺序 `clear>triangulate>lift>clay>silhouette>color>hold>done`；倍数 ×0.25 时各段 2535/1426/138/2148/1777 vs 7070/4000/400/6000/4950；**恒定 ×0.5 时 clay 2771ms，运行中主线程 `setScale(0.02)` 后 clay 只剩 145ms（19.1×，墙钟与页面时间线同值）**；暂停后 700ms 消息 `155→155` 不动（同期间主线程仍画 42 帧），恢复后进 silhouette；`?rounds=2` 时间线出现 2 次 `clear`；三角化 3→41 逐点长；0 console error。回归 `pipeline-job-c08.mjs` / `pipeline-stages.mjs` / `terrain-stages-browser.cjs` 全 PASS（serve.py 改动未牵连姊妹页）。
- 新姿势（累积第 25 条）：**「环境不具备」这个标签要先当假账查** —— 本条挂了 90 轮「本机无 job/线程环境」，实测只差两个响应头；判断「环境」之前先量一次运行时能力（`crossOriginIsolated` / `typeof SharedArrayBuffer`），能让指标从 false 变 true 的就不是环境限制。
- 坑：① 页面提示语 `第 x/4 轮` 是硬编码，`?rounds=1` 时读数骗人（r114 同型「提示语变假账」）；② `silhouette` 只有 400ms，倍率 0.02 后只剩 2ms，**靠轮询 `stage` 抓不到** → 判据一律改成「页面时间线里是否出现过该阶段」+ 用时间线差值量段长；③ 逐点 `postMessage` + rAF 重绘的固定开销让每个阶段稳定偏长 1.4×（比例 0.35–0.37 而非 0.25），所以整轮只判「同量级」，精确比例交给 clay 单阶段 A/B。
- 如实口径：片子是水彩手绘成岛（建筑/灰岩柱/水波），本页是 2D 调试画布，只复现「分阶段慢放」；`clay` 段片内实测 5.34s（表 4.0s）、`color+hold` 合并 8.07s（表 10.95s）—— 这两段在画面上没有可分辨边界，只报合并值。
- 账：**done 125→126 / partial 123→122**（`update-learning-counts.py` 仍报 285/285、剩 0，只算账面）。

**下一轮建议（第 147 轮）**：A 类仍空 → B 一组。首选 `1384958097542819845`（grid 游戏手柄/连刷：模块署名该片 ID + 只有 node 测试）与 `1401145625572425728`（merge-bench 部分上传）两条，先 `grep -rln <片ID> src/ tests/` + `ls tests | grep browser` 两下判 A/B；
次选继续按「`tests/*.mjs` 在跑但无 `-browser.cjs`」筛。维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·145、第 145 轮（A 类仍空，B 取 [105] 整组：走廊墙饰 —— 弧顶/门口版式/纹样密度 + 共享 World 贴面）→ **✔ 已收口**

**本轮实收口（2 条，同一句话的缺口）**：`1897266928961700215`（108 帧 / 11.111fps / 9.72s，"Yet another hallway design"）+
`1890018647655272491`（243 帧 / 27.458fps / 8.79s，"Further iterations on hallway design"）**→ 两条都 done**，[105] 组 2/2 片全清。

核实（先核再动手）：note 从 r56 挂到 r144 的四条「仍待补」—— 完整室内/弧顶、门口版式、参考纹样复杂度、真实 World 可选贴面 —— 逐条 grep + Read 后**全是已有实现**：
`src/core/doodle-hallway-layout.js`（文件头署这两条片 ID）把走廊展开成 (s,v) 纸面，s 跨转角连续、v 是表面弧长（竖墙 → 1/4 圆 cove → 天花），转角强制断板、门位独占一跨（跨中线=门中线、门上方板从拱带之上起）、纹样只在左半布置右半镜像；`src/build/doodle-hallway.js` 画一张跨转角/跨 cove 连续的贴图 + `buildDoor`（两块门芯 + 扇窗放射格 + 门把）+ `buildStairs`（6 级 + 两个平台）；`src/world/doodle-overlay.js` 就是「共享 World 可选贴面」（`view.setDebug('doodlewall'/'doodlegray')`）。r56 只出了 `tests/doodle-hallway.mjs`，**没有浏览器验收** → 第 22 次同型过期账。

本轮新增（机制主线零改动，只补验收与两处读数）：
- 新测 `tests/doodle-hallway-browser.cjs`（ALL PASS）：展开贴图**逐像素**数分区底色（7 种，无单色 >60%）、墨线覆盖（彩色 12.38% / 黑白 13.48%，原片 0060 同判据 12.93%）、门位内墨点 0px；**护墙板顶线逐列找「色板→护墙板」边界做线性回归**，斜率 0.3914 vs `rise/(s1−s0)=0.3913`、残差 0.0025m（锯齿会到台阶高 0.15m）、平段 0.96；逐板 mask alpha 镜像差 0.0026（**关镜像反向对照 0.6576**，证明量具有分辨力）；黑白版与彩色版 plan 逐字段相同、几何同为 17700 顶点、彩色底 0 种；`?t=0` 钉相机后同状态噪声 0px、彩色↔黑白整帧差 479986px；共享 World 贴面 248 面/1488 顶点（=faces×6）、开关差 62318px。
- `doodle-hallway.html`：补 `<link rel="icon" href="data:,">`（favicon 404 会顶掉 0-error 断言）、`window.hallwayReview` 增 `canvas/mask/panelList/ppu`（量具要读真像素，不读 stats 自证）。
- `src/world/doodle-overlay.js`：外偏 offset 做成参数（默认仍 0.004，与地形墙同）。**反向核实**：原打算改成 0.012 以避开「与地形墙共面 → 看不见」，实测 0.004 本来就看得很清楚（开关差 62318px），0.004→0.012 的 12636px 是 8mm 位移不是深度打架 → **不改默认值**，只把参数留下来。

新姿势（累积第 24 条）：**「有几何 / 有贴图」不等于「画面上看得见」，但也不等于「看不见」** —— 本轮第一版诊断据「整帧截图没看到花纹」就要改 offset，被同一量具的反向对照（0.004 也差 6 万 px）当场否掉；判定可见性必须**先定窗口 + 冻帧 + 同状态噪声 0**，再谈差多少。

坑：① 主场景的循环是 `app.js` 自己的 `requestAnimationFrame`，`renderer.setAnimationLoop(null)` 管不到 → 水/鸟/相机继续按真实 dt 动，整帧噪声 2 万 px；正解是 `v.__origRender = v.render.bind(v)` 后把 `v.render` 换成空转，截图统一走 `__origRender(0)`（噪声降到 0）。② `?t=0` 已经把相机钉住，所以走廊页本身不需要冻帧。③ 贴图底色是**极淡的粉彩**（饱和度 2–16%），量「分区底色」不能按「饱和度阈值」筛，要按 8bit 量化后的众数占比筛，否则读到 0 种。

如实口径：纹样是程序化替身（鱼/花/虫/面具 + 图腾脸/太阳/卷草/眼/点圈豆），原片是具体手绘动物（三条鱼横排、大狗、蝴蝶结）；黑白版「更密」是同一纹样库的密度乘子（1.35）而非另一套图样；墨线覆盖两侧判据不完全同构（本仓取展开贴图上 v>2.0 区域、原片取原尺寸帧的一块板 crop），只作量级对照。
证据 `artifacts/coverage/1897266928961700215-review-r145.md` 与 `artifacts/coverage/1890018647655272491-review-r145.md`。

## 三·144、第 144 轮（A 类仍空，B 取 [061] 余项：程序化法线反差细线）→ **✔ 已收口**

**本轮实收口（1 条）**：`1482011744843223042`（384 帧 / 22.145fps / 17.34s，"pixel thin lines from contrasts in my procedural normal map"）**→ done**；
[061] 组 2/2 片全 done，组已清。证据 `artifacts/coverage/1482011744843223042-review-r144.md`。

- 核实：旧 note 的【卡点·B 美术资产】是**误标** —— 原文自己写的是 **procedural** normal map（姊妹片 `1481661852887265288` 原文亦写 "Normals (procedurally painted in big chunky strokes)"），
  两侧都是程序化生成、不需要手绘 atlas。落点 `src/world/view-c11-normalline.js`（`?c11=normalline`）就是「线源 = 程序化笔触法线图的反差 + uDepthMix 0」。
- 本轮核出并修掉三个真缺陷：
  ① **开关已经坏了**：`outline-pass.js` 把硬编码阈值 `smoothstep(0.55,0.98,nd)` 换成了 `uNormalThreshold` uniform，本开关仍按旧字符串 patch 合成着色器 → `?c11=normalline` 抛 `composite token missing`，
     抛错点在「已把 outline 打开」之后 → **几何描边留在天上**（首次实拍：云边与天空整片锯齿折线，原片一条都没有）。改法：直接设 `pass.uniforms.uNormalThreshold=(0.025,0.09)`，不碰着色器源码；关档还原 (0.55,0.98)。
  ② **off→on 二次 patch 必抛**（`prevFrag` 第二次已是 patch 后源码）→ 原始源码只存一次 `st.origFrag ??=`，且不再改源码。
  ③ **线源没限定**：法线遍只排除「无 normal / 透明不写深度」的网格，云、天空、远景、树卡都进法线遍 → 改成限定共享地形材质 `pass.c11NormalOnly`（留 `material.userData.c11LineSource` 退出阀）。
- 同口径量两边（新量具 `inkStats`：脊线检测「两侧距离 2 都亮 12 级」+ 线宽 = min(水平 run, 垂直 run)），同一函数量本仓渲染与原片原生帧：

  | 口径 | 基线 | 开档 | 关档 | 再开 | 再关 | 原片 0100 / 0125 / 0300 |
  |---|---|---|---|---|---|---|
  | 线密度 ‰ 表面像素 | 91.45 | **172.11** | 91.52 | 171.92 | 91.84 | 72.81 / 63.98 / 73.67 |
  | 天空·海面线密度 ‰ | 0 | **0** | 0 | 0 | 0 | 0 / 0 / 0 |
  | 线宽 p50 / p90 | 2 / 3 | **2 / 3** | 2 / 3 | 2 / 3 | 2 / 3 | 2 / 3 |

- 新测 `tests/normal-line-scope-browser.cjs` **PASS**（开档 > 基线×1.3、关档回基线 ±2‰、再开 ±3‰、再关回基线 = 幂等；天空/海面线 0 与原片同口径；线宽 2/3 两边一致；`uDepthMix=0`/`scopeSize=1`；0 console error）。
  回归 `tests/view-c11-normalline.mjs` **PASS**（旧断言依赖 `ND_TOKEN` 还在 outline-pass 源码里 —— 已同步改成断言 `uNormalThreshold` uniform 路径 + `c11NormalOnly`）。
- 新姿势（累积第 23 条）：**「配色/风格类 partial」先跑一遍开关本身** —— 本条挂了几十轮「美术资产」，实情是一个 `outline-pass.js` 的阈值重构把字符串 token 打掉了，开关抛错后
  只留下「几何描边开着」的半截状态；打开就报错的功能，别去比像不像。
- 坑：① 法线遍里**任何有 normal 属性的网格都会画线**（云、天空球、远景），「剪影/天空没有线」必须靠**限定材质**，不是靠 uDepthMix；
  ② 界「一像素线」的实线判据必须是**脊线**（两侧都亮），单侧亮的台阶edge会让基线也读出 366‰（第一版量具直接废）；
  ③ `off→on` 重进要把**原始源码**存一次，不能把「上次 patch 的结果」当原始源码。
- 如实口径（不计缺口）：线密度 172‰ vs 原片 64–74‰（本仓逐格台地每条台阶都是几何折痕）、笔触为周期平铺非手绘块形、世界轴三向投影换轴接缝未单独量化（视觉未见直缝）。
- 账：**done 122→123 / partial 126→125**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 145 轮）**：A 类仍空 → B 一组。优先按「`tests/*.mjs` 在跑但没有 `-browser.cjs`」筛一批（`ls tests | grep browser` + `grep -rln <片ID> src/` 两下判 A/B），
  次选 `next` 里带「接线/默认值」字样的条目（r132/r144 两次都证明「模块在 + 测试绿 + 页面能开」与「默认接上」之间还隔着一个开关）。
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·143、第 143 轮（A 类仍空，B 续取 r142 挂下的同一条：手工规则模板补丁的环院格形）→ **✔ 已收口**

**本轮实收口（1 条）**：`1301816247479345152`（324 帧 / 23.736fps / 13.65s，"random patches of hand crafted grid … little gems"）**→ done**；
该组（单条自成一组）清空，r142 挂下的「环院细楔」这条已消。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B（r142 明确建议先收这一条）。
- 核实先于动手：r142 的诊断只对了一半 —— 它说细楔来自「星形外边界**逐点径向投影**」，实测**主因是过细分**：
  `R=holeR+(minR−holeR)·innerRatio` 把 `rings` 条带挤进环带厚度的 45%，剩下 55% 再被「拉链带 + 洞环四边格」切成两条
  → radius 1.9 / hole .8 / rings 5 时每条带径向厚只有 **0.05**，而弦长 0.45（长宽比 0.12）。
- 改法（只在 courtyard 的环带路径上，radial/block/rhombus 与接缝一字未动）：`s=(minR−holeR)/(rings+2)`、`R=holeR+2s`
  —— rings 条环带各厚 s，剩下 2s 给「拉链带 R→R0」与「洞环四边格 R0→洞边界」各一条；`patch` 加 `ringSpacing/minRingRadius/holeRingRadius`。
- **试过并回退**：按 r142 的建议把 courtyard 目标环改成 radial 那条严格等角环（`phase+i·2π/N`）→ 不规则四边形边界上第一圈带
  会**翻折**（`grid radius 12 / seed 5 / x4.5 / radius 2.7 与 3.1` 直接抛 `unsafe patch geometry`），而长宽比只从 0.595 抬到 0.620；
  「目标角夹紧到半扇区 + 极坐标插值」也仍有 2 例翻折。收益 4%、代价是原实现能过的配置开始拒绝 → 不采纳，因果判断一并纠正。
- 页面：原片口径深链改 `?template=courtyard&rings=5&radius=2.6&hole=.6`（r1.9+hole.8 的环带只有 1.2 格厚，装不下 5 条方格带，是自相矛盾的口径），
  `#report` 增 `ringSpacing/ringInner/ringMin/ringHole/outerCells/outerEdgeRatioP50/outerSlivers`（外环带与中心过渡带分开报）。
- 同一口径量两边（补丁格 min 边/max 边）：原片 0106 像素射线 21–27 辐条 / ≈5 环 / 中心是小多边形；
  本仓旧口径 **eP50 0.257、细长 151/197** → 新口径 **eP50 0.595、细长 32/268**，其中**外环带 230 格只 9 个**（全在星形边界拐角），
  中心过渡带 23 格偏宽（洞边界 10 顶点 vs 外环 46 顶点拉链的固有结果，原片 0135 同位置也是放射梯形砖的收敛区）。
- 新测 `tests/gridpatch-rings-browser.cjs` **ALL PASS**（五配置几何 + `R==holeR+2s` + `s·(rings+2)==minR−holeR` + 外环带门槛
  + 主场景 `?gems=0|4` 像素 A/B **563710px** + 0 console error）；4 个 node 回归全 PASS（templates/multi/gems-c06/radial-dual）。
- 如实口径：本仓 46 辐条 vs 原片 21–27（辐条数由源网格密度决定，不是补丁参数）；原片环院的围墙/地块/塔是玩家建出来的，本页只铺 rock 台地 + 色环。
- 账：**done 121→122 / partial 127→126**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 144 轮）**：A 类仍空 → B 一组。首选 `1482011744843223042`（384 帧·程序化 normal map 反差细线：
  页面与 `normal-contrast-browser.cjs` 都在跑，先 grep `paint-normal|normalContrast` 判「模块在只缺同口径量具」；找不到「同一口径量两边」的量具就**定案 C**，
  别再排第二遍）；备选按分数往下取网格/拓扑组剩余 partial（`1642…`/`1612…` 之外先看 `next` 里带「node 测试在、无 -browser.cjs」的批次）。
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·142、第 142 轮（A 类仍空，B 取 radial-patch 组 `1301816247479345152`：手工规则模板补丁）

**本轮未收成 done（1 条仍 partial，但缺口被收窄到一条）**：`1301816247479345152`（324 帧 / 23.736fps / 13.65s，
"random patches of hand crafted grid, like little gems to find and build your tempels upon"）。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实先于动手：note 的两条「待补」= **一条过期 + 一条真缺口（但缺口在入口层）**：
  ① 「多补丁 / 完整手工库 / 填充世界迁移」→ **过期账（第 21 次同型）**：`insertRadialPatches`（多补丁，重叠即拒）、
     `PATCH_TEMPLATES = radial/block/rhombus/courtyard`（r55 手工模板库）、`migrateWorldToPatch`（已有 World 逐列照搬 + 补丁格最近源格重采样）
     全在，`tests/gridpatch-templates.mjs` / `gridpatch-multi.mjs` / `grid-gems-c06.mjs` 一直绿；主场景 `?gems=N` 也早接（r56 C06）。
  ② 真缺口在**页面入口**：`gridpatch.html` 把 `radius:3 / rings:2 / holeRadius:1.3` 写死 —— 原片那块补丁是「约 5 环 + 中心留一小片原格」，
     页面上根本到不了这个口径，于是「中央放射细长格 / 塔顶偏高」这条视觉账挂了十几轮。
- 片子结构（324 帧全核 + 4 张联系表 + 6 帧原尺寸 + 0035 中心 3×）：0–39 不规则四边形网格里长出规则同心环块（与外部共用边界顶点）；
  40–99 贴面推移；100–109 选中态（青色高亮 + 蓝/红操纵轴 + 黄手柄）；110–137 环院俯视（中央阶梯圆台 + 8 个扇形地块）；
  138–189 中央阶梯成形；190–323 三维：外圈两层圆墙 → 阶梯屋顶内收 → 中央白色圆柱塔 + 橙色攒尖顶。
- 本轮补的入口 + 量具（机制主线一字未动）：`gridpatch.html` 支持 `?rings= ?radius= ?hole= ?inner=`，`#report` 增
  `rings / boundaryN / holeBoundary / edgeRatioP50 / slivers / minEdgeRatio`，并加「原片口径」深链（环院 5 环 + 中心留原格）。
- 同一口径量两边（辐条数 / 环数 / 补丁格长宽比）：原片 0035/0106 像素射线计数 **21–27 辐条 / ≈5 环 / 中心是小多边形**；
  本仓旧默认 **56 辐条 / 3 环 / eP50 0.366（细长 90/196）**；改口径后 radial-5 **32 辐条 / 5 环 / eP50 0.544（细长 31/176）** → 环数与辐条密度已对上；
  courtyard-5 的**洞内 7 格原格原样保留** = 原片中心那簇小多边形（不是单点扇）。
- 新测 `tests/gridpatch-rings-browser.cjs`（**ALL PASS**）：五种配置逐个断言环数 / 全四边格 / 无翻折 / 补丁内无开边 / 半边互逆 / 面积守恒 /
  邻接自检 0 / 接缝边数 == 外边界+洞边界顶点数 / 长宽比中位；主场景 `?gems=0|4`：4 块四种模板、最近间距 6.65、补丁格上叠层 top=2（World 版本 344→347）、
  像素 A/B 564656px、0 console error；4 个 node 回归全 PASS。
- ~~**仍缺（只剩一条）**~~ → **✔ 已收口（第 143 轮）**：courtyard 把星形外边界**逐点径向投影**到每一条环，尖角处压成细楔（eP50 0.257、细长 151/197）。
  r143 核实主因其实**是过细分**（rings 条带只铺 45% 的环带厚度），改成 `s=(minR−holeR)/(rings+2)` 均分后 eP50 **0.595**、细长 **32/268**（外环带只 9 个）；
  r142 建议的「改等角目标环」实测会让不规则边界第一圈翻折（2 配置直接抛错）且只抬到 0.620，已回退。见「三·143」。
- 如实口径（造型差，不计缺口）：原片神庙的围墙/阶梯/地块装饰是玩家建出来的，本仓页面只铺 rock 台地 + 一圈色环；0106 的三色 gizmo 本仓无。
- 账：**done 121→121 / partial 127→127**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 143 轮）**：A 类仍空 → 先把上条那**一条**收掉（改 `insertTemplatePatch` 的 courtyard 目标环为等角 + radial 中心留洞，
  两种模板共用一条环生成路径，`tests/gridpatch-templates.mjs` 的「全四边格 / 面积守恒 / 接缝共用」断言应继续成立）→ 可 0.5 轮翻 done；
  其后按分数取 `1482011744843223042`（384 帧·normal 反差细线；页面与 `-browser.cjs` 都在跑，卡手绘笔刷 atlas → 建议定案 C 候选）；
  维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·141、第 141 轮（A 类仍空，B 取 frontier-candidates 续项组单条）

**本轮实收口（1 条）**：`1582293326815862786`（434 帧 / 24.273fps / 17.88s，
"I thought it would be too expensive to properly evaluate each tile placement. But! … it is actually quite small around the collapsed edge! Thus, my algorithm now tries to expand (and interconnect) a simplified nav graph."）**→ done**；该组（单条自成一组）已清。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列全为 `✔ 已收口`，无裸 A；按「A 吃完再取 B、一次 1 组」取 1 组 B。
- 核实先于动手：旧 note 的唯一缺口「增量生成与简化导航互连」= **过期账** —— `expandFrontier`（r56 建，文件头第一行署本片 ID）就是原文那三件事；
  页面 `wfc.html` 只接了 `frontierCandidates`（只读探针）并写明「不是完整导航生成」→ 又是「模块在 + node 测试绿（`tests/frontier-expand.mjs`）+ 页面从没量过」。
- 片子结构（434 帧全核 + 5 张联系表 + 11 帧原尺寸/3–4× 裁切）：**0–190 二维导航图生长，191–433 结果岛三维转台**；
  生长段是两片**不同颜色**的网络（北绿/南黄）同时变长，绿在 f100–110 塌到 0（两组并成一张），f155 后整屏静止；无参数面板、无第二种装箱演示。
- 本轮补的东西：`wfc.html` 加 `#expand`（增量扩边入口）/`#expandPlay`（回放）/`#twofronts`/`#navview`（原片那种深青底只画图）+
  `window.frontierExpand`（`cells/placed/dead/nav/width/mergeAt/groups(k)/draw(k)/replay(k)`）+ `#expand-stats` 读数；
  模块加 `twoFronts`（**默认 false**，两粒种子区域轮流推进）；机制主线（候选枚举范围、前向校验、并查集）一字未动。
- 实测（混合 147 格 / 四边 206 格，两粒最远种子）：每步要看的格数 **17.24**（峰 25）vs 剩余未放格 **73**、每格可行候选 **3.72/24**、
  导航边 **236/388**（页面重算 == 模块）、两锋面 37/37 与 52/51、互连点 **133/191**；逐步只读回放 8 档「待评估格数 == 坍缩边缘格数」且候选数逐位一致；
  像素黄 447→23972 单调增、绿 699→10526→0；0 console error。回归 `tests/frontier-expand.mjs` 仍 PASS（默认关，旧账逐位不变）。
- **新姿势（累积第 20 条）**：**「两条锋面」这种画面差异要查推进顺序，不要当配色** —— 关掉 `twoFronts` 后 50% 处第二组只剩 1 格、绿线像素 0，
  说明原片的两片网络是**交替取格**长出来的；先量「50% 处两组人数」这一个数就能判，不必去调色板。
- 坑：① 想把两次独立扩展拼成双锋面不行 —— 混合 16 格 / 四边 43 格冲突，`expandFrontier` 直接抛 `placement broke a collapsed edge`；
  ② 复算导航边时 twin 索引必须是**本格**的 `c.edgeTwins[e]`（写成邻居的 `b.edgeTwins[e]` 会少 106 条边，页面画的图和模块账对不上，
  第一版就踩了，靠「页面重算 == 模块 nav」这条断言抓住）；③ 颜色要按「第 k 步当时的连通块」算，用最终并查集会把早期绿色全画成黄色（第二版踩）。
- 如实口径：本仓 tile 目录是二进制 socket（3 边 8 + 4 边 16），原片是带高度的 edge tile；本仓互连点更晚（90%/93% vs 原片 ≈66%）；图块边界由格网决定。
- 账：**done 120→121 / partial 128→127**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 142 轮）**：A 类仍空 → 继续按分数往下取 **B 一组**。候选：
① `1301816247479345152`（324 帧·radial-patch 放射补丁）—— note 的「多补丁/完整手工库、填充世界迁移待补」+「中央放射细长格塔顶偏高」；
   `src/core/radial-patch.js` + `gridpatch.html` 都在，先 grep 判「模块在只缺页面验收（A 性质）」还是真缺多补丁库；
② `1482011744843223042`（384 帧·程序化 normal map 反差细线）—— 页面/测试都在跑，卡手绘 normal atlas 与投影接缝（美术资产），
   找不到「同一口径量两边」的量具就定案 C；
③ 维持 C 不排：[041] 1459、[055] 1579474420749725696、GI `1580835075629133825`、[051] 8272/8238。

## 三·140、第 140 轮（A 类仍空，B 取 [061]：径向大小排序 UV 图集）

**本轮实收口（1 条）**：`1478114309263839244`（346 帧 / 10.610fps / 29.94s，
"I quite like how the radial (instead of directional) size-sorting looks … big coherent chunk in the middle"）**→ done**；
[061] 组转「1 done + 1 partial」。

- ⚠️ **A 类仍空**：TOP 18 表「路径」列已全为 `✔ 已收口`，无裸 A；本轮按分数往下取 1 组 B，符合「A 吃完再取 B、一次 1 组」。
- 核实先于动手：旧 note 的「原UV流程未实现，圆块/矩形演示不计验收」= **过期账（第 19 次同型）** ——
  `src/core/uv-radial-atlas.js`（r56 C11，文件头第一行署本片 ID）就是片子那三件事：`topMergeCharts`（朝上面合并 + 竖直 XZ 投影 + 崖柱脚印成洞）、
  `radialChartPack`（按面积从环 0 向外找位）、`clipIsland`（底板 + 3 崖柱 + 拱洞的同构测试岛）；页面 `uv-radial.html` 与 node 测试都在，
  **唯独没有 `-browser.cjs`** —— 又是「模块在 + node 测试绿 + 页面没量过」。
- 片子结构（346 帧全核 + 4 张联系表 + 5 帧原尺寸）：只有三种状态反复切换 —— ① 上 UV 页 + 下同一座岛（先灰白线框、后贴棋盘格）；
  ② 整屏青/绿/黄三角线框（沿表面连续过渡）；③ 纯灰转场空帧。**没有第二种装箱演示、没有 UI/参数面板**。
- 新测 `tests/uv-radial-atlas-browser.cjs`（真页面 + 真像素；`page.tri` 逐像素三角号做 4 邻域连通块 = 在页面上数分片）：
  1551 三角 / **268 片（朝上合并 66）**、中心片占面积 **30.7%** 且带 **1** 个崖柱+拱洞脚印洞、重叠 **0**、填充 0.343（像素覆盖 0.380）；
  **面积名次~离页心距离 Spearman −0.634**（像素口径 −0.425，裂块稀释）；像素连通块 322、最大块占已覆盖像素 29.6%、块心离页心 **0.004**；
  逐片放置前 6 片墨量 16807 px < 全部 43341 px；棋盘两色各半、染色占页 38%，线框↔棋盘 3D 视图差 **67773 px**；
  反差色对比边 ΔE **18.13** vs 同类边 **0.27**（67×，随机初值 32.70/31.76）、最小对比边 13.72、iter=40 同类边 1.27 > 220 轮 0.27（可逐轮回放）；0 console error。
- 如实口径：① 同构测试岛（110 格陆地 + 3 崖柱 h=3/5/4 + 拱洞 62）≠ 原片真岛；② 原片图块边界手绘不规则，本仓由格网三角决定、外围更细碎
  （322 连通块 vs 268 片，个别顶面片在投影夹点处被压成零宽而裂成两块）；③ 原片彩色线框只给边着色、面留底色，本仓反差模式为面填色 + 边压暗；
  ④ `?charting=angle` 在这座小岛上最大片份额同样是 30.7% —— r56 注释「夹角分片中心片只占 4%」是实景岛读数，不适用（两模式真正差别是分片身份：topCharts 66 vs 0、最大片 chart 2 vs 20）。
- 回归：`tests/uv-radial-atlas.mjs` PASS（tris 1551 / charts 268 / center 0.307 / holes 1 / spearman −0.63 / fill 0.343 / minContrastDE 13.7）。
- 账：**done 119→120 / partial 129→128**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 141 轮）**：A 类仍空 → 继续按分数往下取 **B 一组**。候选（按「模块在 + 只有 node 测试」优先）：
① 同组余项 `1482011744843223042`（384 帧·程序化 normal map 反差细线）—— `normal-contrast.js` + 页面 + `tests/normal-contrast-browser.cjs` 都在跑，
   卡的是原片手绘笔触 normal atlas 与投影接缝（美术资产），除非找到「同一口径量两边」的量具，否则建议定案 C；
② `1582293326815862786`（frontier-candidates / 动态候选缓存 + 增量 tile 选择，B 真活）；
③ `1301816247479345152`（radial-patch 中央放射格过细 → 塔顶比例，视觉口径，需先判 A/B）；
④ 维持 C 不排：[041] 1459、[055] 1579474420749725696、GI 组 `1580835075629133825`。

## 三·139、第 139 轮（A 类仍空，B 取 r138 挂下的「沿河更快」球面 + 复杂汇流那一层）

**本轮实收口（1 条）**：`1795831296952041691`（598 帧 / 33.333fps / 17.94s，
"I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)"）**→ done**。

- ⚠️ **A 类仍空**：TOP 18 表的「路径」列已全部是 `✔ 已收口`，没有裸 A 组可拿；本轮按分数往下取 1 组 B（单条），符合「A 吃完再取 B、一次 1 组」。
- 核实先于动手：旧 note 的三项「仍缺」逐项 grep 后全是**过期账**（第 18 次同型）——
  ① 球面：`buildNav(pw, { metric: chord, slopeStep: 1 })` 在 `planet-rivers-c09.html` 主路径上跑了 60 多轮（r56 C09-B 的参数）；
  ② 复杂汇流：方向有两个来源 `riverNetwork.parent`（汇流/平床）与 `riverFlow.flowTo`（DFS 开挖顺序），`tests/river-network.mjs`、`tests/c09-terrain-b.mjs` 一直在断「汇流支流按树方向判顺流」；
  ③ 完整接口：`findNavPath` / `riverRouteStats` / `simplifyNav` 都在 `src/world/navgraph.js` 尾部，`tests/river-carve-flow.mjs` 一直在跑（平面 speedup 1.63–5.07）。
  真缺的只有一件事：**没人从球面页面把「更快」量出来**（r138 只测 `flowSource=carve` / 沿河树边 334 / 可达 1667，没测速度）。
- 本轮补的量具（机制主线一字未动）：`planet-rivers-c09.html` 加 `window.__c09routeProbe(pathIdx)` —— 每条主干量 `tDown / tUp / walk（沿路弦长和）/ walkOptimal（纯步行 Dijkstra：平 1、缓坡 1.25、台阶 1.8，无河流优惠）`，
  并逐边审计「顺流边是否朝上坡」「汇流支点是否判出方向且汇入更便宜」；另暴露 `__c09navHandle` / `__c09world` 只读句柄。`river-nav.html` 两句页面假账改真（「完整河道约束坍缩未完成」「本页非原球面」均与 r138/r139 结论冲突）。
- 新测 `tests/river-nav-sphere-browser.cjs`（真球面 World + 真页面 + seed 3/5 各一遍）：
  河格有向边 **391/391、398/398 全判顺流**、中性 **0**、上坡顺流 **0**；汇流支流 **58/58、62/62** 判出方向且汇入更便宜；
  主干 **0.7249 < 1.0896 < 2.5328**（seed5 0.6462/1.1054/2.1539）、speedup **×3.49 / ×3.33**、upDown **1.50 / 1.71**、detour **0.524 / 0.456**；
  47/47 与 50/50 条主干全部顺流最快；`findNavPath` 代价 0.724873 == 树上时间；简化图压缩 0.988（球面缓坡让绝大多数格度数≠2，属口径不是缺口）。
- 最硬的反向对照：平床河格边 **352 对，顺/逆价格比全部精确 = 0.3/0.65**（坏 0/352）—— 优惠若没生效，这个比值与 speedup 会同时塌到 1。
- 如实口径：边价 `0.3/0.65/1.25/1.8` 是本仓本地参数、不是原作速度；原片无角色往返 → 倍率不可反推；原片是平面连续高度场单河谷，本仓球面页逐格台地且水系更密（409 河格 / 29 汇流格）；球面树线按到达时间着绿→黄→橙，不按顺/逆分色。
- 回归：`tests/river-nav.mjs`、`tests/river-carve-flow.mjs`、`tests/river-network.mjs`、`tests/river-nav-browser.cjs` 全 PASS（mixed 106 条有向河边 53 顺流 / quad 28 条 14 顺流、分层流场 576/723 格一致、往返后 World 版本不变）。
- 账：**done 118→119 / partial 130→129**；`update-learning-counts.py` 仍报 285/285、剩 0（只算账面）。

**下一轮建议（第 140 轮）**：A 类仍空 → 继续按分数往下取 **B 一组**。候选：
① **[041] 1459**（格子补丁着色·补丁级刚性）与 **[055] 1579474420749725696**（完整坡面/模块联合生成）—— 两条都已被判 C（原片算法未公开 / 族向 relax 已试错反升 45°），**除非找到新的可测量具，不排**；
② 优先在 `learn/coverage-progress.json` 的 `next` 里挑「模块在、只有 node 测试、没有 -browser.cjs」的批次（r120–r125 五次命中的便宜 done 规律），先 `ls tests | grep -c browser` 与 `grep -rln "<片 ID>" src/` 两下判 A/B；
③ 若 B 无可取，考虑把「沿河导航」扩成**同口径双边量**：原片 f0597 的树线像素 vs 本仓球面树线像素（宽度/密度），只作造型差记录，不计缺口。

## 三·138、第 138 轮（A 类仍空，B 取 [048] 组内最后一条：球面巨型河网 DFS→BFS 坍缩）

- `1769691526924292506`（194 帧）**→ done**，[048] 组 4/4 片全清；done 117→118 / partial 131→130。
- 核实：note 挂了几十轮的「完整球面 WFC/BFS 仍缺」= **第 17 次同型过期账** —— `src/terrain/river-collapse-c09.js`（文件头第一行署本片 ID，r56 C09-B）就是原文那句话：入海口显式栈 **DFS** 坍缩河道（回溯点长出支流，河床 `1+floor(depth/run)`），再以「海+全部河格」为种子 **FIFO BFS** 坍缩其余陆地（父格 +0/+1，`cliffChance` 才 +2/+3）；写回共享 World 的 `riverFlow`，`navgraph` 据此判顺流/逆流。页面 `planet-rivers-c09.html` 早能开、node 测试 `c09-terrain-b.mjs` 一直绿。
- 真缺口两件：① 运行验收（从来没有 `-browser.cjs`）；② **绘制口径错** —— 河格顶面画在**河床**高度，1 格深的沟把自己的蓝色顶面挡在沟壁后面，斜视时整条河读成一条干沟（原片的河是齐岸蓝带）。改成画在岸高（河床+1，墙循环上限同步抬），河才成为连续蓝带。
- 新测 `tests/planet-rivers-c09-browser.cjs`（页面加 `?lines=0`/`?river=0`/`?sea=0`/`?focus=` 与只读探针 `window.__c09river`/`__c09view`）：
  409 河格 / 1707 陆地 / 18 河口 / 29 汇流（叶 47=paths 47）/ 主干 32 格 / 曲率 2.42–2.45；
  **DFS 定律逐格成立 409/409**（`ground == min(maxLevel-1, 1+floor(depth/9))`）、**单宽 782 对 0 并排**、391 条 flowTo 边 0 爬升、断流 0 成环 0；
  **BFS 1298 格父链全不降**、断链 0、漏格 0、零局部洼地 0、不排水 0（同一口径从 ground+nb 重算）；陡边 **154/4777=3.22%**（`cliffsChosen 5`，偶发陡崖真的发生）；
  n=4000 同结论（654 格 / 45 汇流 / 陡边 6.2%）；`?river=1` 比 `?river=0` 多 **94278** 蓝像素；`?nav=auto` → `flowSource='carve'`、沿河树边 334、可达 1667/1707；0 console error。
- 如实口径：密度高一档（默认 `rivers=18&share=0.24` 蓝占星球 21.55% vs 原片 0.92–1.66%；`?rivers=5&share=0.10` 降到 8.62%，再低会把河压成 6 格短枝）；原片是连续高度场、本仓是逐格台地 + 硬侧壁（块感）；海岸崖面比原片粗一档。
- 新姿势（累积第 17 条）：**「机制在 + 页面能开」还要问一句「画出来的东西对不对」** —— 本轮唯一真 bug 是展示层把水面画在河床而不是岸高，一行改动就让「干沟」变「蓝带」；判 C/缺机制之前先看截图里那条河到底长什么样。
- 坑：① `?focus=` 不设时默认按 `rot/tilt` 转，换 seed/参数后原 focus 的格可能已不是河 → 密度对照要按当次 `path0` 重新取格；② `at(corner, l)` 是**逐层数组下标**，`l` 超过 `maxH` 直接 undefined（抬水面必须 `Math.min(maxH, h+1)`）；③ 页面底色 #6f8f97 与海面蓝接近，像素口径必须先按底色掩码剔掉背景，否则「蓝占比」量到的是背景。
- 沿用下轮建议（**已被第 139 轮执行**）：A 类仍空 → 首选 **[048] 已清**，按分数往下取 **`1795831296952041691`（598 帧·沿河更快）→ ✔ 已收口（第 139 轮 · 球面 + 复杂汇流运行验收）**；次选 [045]/[047] 已清，[041] 1459 / [055] 1579 维持 C。

## 三·137、第 137 轮（A 类仍空，B 取 GI 续项组最后一条待收的：三张图 / 六向光体积）

**本轮实收口（1 组 / 1 条）**：`1580845127207387137`（213 帧 / 29.098fps / 7.32s，
"1st texture here is an sdf volume… 2nd is a baked 6 directional light volume… 3rd is the lit mega texture"）**→ done**；
GI 组转「2 done + 1 C」（`1580835075629133825` 维持 C）。

- 核实先于动手：旧 note 的「反弹反馈仍使用平均RGB与逐格反照率，不等同原作 SDF/UV/mega-texture 反馈」= **过期账（第 17 次同型）**，
  而且 **`where` 指错了模块**：写的是 `lightvolume.js`（旧体素光体积页，自己声明「各轮内部传播继续使用平均 RGB」），
  本片真正的落点是 `src/light/megatexture-gi.js`（文件头第 6–8 行就署本片 ID）。那句「平均 RGB」描述的是旧页，不是本片。
- 片子本身（213 帧全核）：顶部三张调试图 + 下方白色素坯岛转台缓慢环绕一圈；**三张图里没有第四件事**，
  也**没有慢放/逐轮演示**（那是姊妹片 1580846877855338497，r136 已 done）。4× 裁切看清：
  ① SDF 是 4×4 共 16 张 y 切片、紫/品红族 UV + 青斑；② 六向图是 **3×2 六个面板**、**上排中格最亮、下排中格最暗**；③ mega 是不规则 chart 装箱的图集。
- **同一量具量两边**（三块区域逐像素差 >20 灰阶占比）：原片 **SDF 图全程 0.000%**、六向图 f90 峰值 **7.06%**、mega 图 f90 峰值 **47.75%** 且 f180 回位 3.15%
  → 「几何/UV 烘死不随光变、光体积与被照亮的贴图随光变并回位」。本仓换太阳 40°→130° 的 A/B 同形：**SDF 图逐字节未变 / 六向图变 / mega 图变**。
- 本轮补的量具（判据全为数值，源码零改动）：
  1. `tests/megatexture-six-directional.mjs`：逐 lobe 平均能量 `[0.579, 0.629, 1.899, 1.090, 0.580, 0.634]`（**+Y 1.899 vs −Y 1.090**、三轴向对都不对称）；
     换太阳 az20→az110 的 lobe 能量矢量水平分量对**背光方向**对齐 **0.997 / 0.960**（射线朝太阳走撞的是背光面，这是符号反直觉但正确的一处）；
     **两色反照率世界**（x<0 红 / x>0 蓝、关天光）红侧间接光色相 **+0.371** vs 蓝侧 **−0.126**、逐纹素相关 0.488、色相空间 sd **0.542**（p10–p90 −0.767/+0.847）
     → 若真用全局平均 RGB，这三项都会≈0；`sampleIndirect` 与 `indirect` 最大差 **2.98e-8**、`反照率×(直射+间接)` 与 `exitance` 最大差 **2.98e-8**。
  2. `tests/directional-volume-mega-browser.cjs`（真页面 / 真滑杆 / 真 canvas）：光体积 12146/14652 空格 × 6 lobe × 5 射线、9256 纹素（984 片，172×164）、
     **SDF-UV 命中 82.5%**；六面板亮度 `88.3/91.3/138.1/87.6/88.4/90.9`；换太阳后对齐度 **0.984 / 1.000**；
     反弹 0→3 时 mega 图已变（相对变化 123.00%→5.38%→0.94%）；第 3 张图四种读出（出射光/反照率/直射/间接）**4/4 种画面**。
- 回归：`tests/megatexture-gi.mjs` PASS（tracer 1251/1251、uvMatch 0.829、refPearson 0.806）、`tests/megatexture-bounce-browser.cjs` PASS。
- 截图（均 ViewImage 看过）：`directional-volume-r137-page.png`（页头读数 + 三张图）、`directional-volume-r137-six-lobes.png` 与 `-3x.png`
  （3× 放大与原片 4× 裁切同形：上排中格近白、下排中格褐黑）。
- **四项如实口径（造型差，不计缺口）**：① 本仓纹素 = 体素面、SDF = 体素中心 EDT，不是三角网 UV 展开/连续 SDF；
  ② 原片 SDF 图偏紫/青（RG=UV 直接当色），本仓 B 通道还混 `0.35+d/max`，观感偏红/蓝；③ 图集填充率本仓 0.324（空隙多），原片那张更满；
  ④ 原片 16 张 y 切片（ny=16），本仓 terrain 场景 25 张（5×5）。
- 账：**done 116→117 / partial 132→131**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 16 条）：**「六向/多方向体积」不要用「看着挺亮」交差** —— 报三件事就够：逐 lobe 能量表、
  换光源后能量矢量的**对齐方向与对齐度**、以及「两色反照率世界的两侧间接光色相差 + 色相空间 sd」（这三项在平均 RGB 实现里必然塌成 0）。

**下一轮建议（第 138 轮）**：A 类仍空（TOP 表已无裸 A）。GI 组已无待收（余 1 条定案 C）→ 按分数往下取 **B 一组**：
首选 **[048] `1769691526924292506`**（194 帧·球面 WFC/BFS 河网，「完整球面河道约束坍缩 + 其余 BFS 缓坡」是一整件事，B 一整轮；
先 grep `riverFlow/DFS/BFS/carveRivers` 判是否又是「模块在只缺验收」）；次选 [040] `1670064751181791233` 与 [051] `827215002448846848`/`823848950553780226` 维持 C 不排期。

## 三·136、第 136 轮（A 类仍空，B 取 GI 续项组里唯一待收的：慢放反弹序列）

**本轮实收口（1 组 / 1 条）**：`1580846877855338497`（41 帧 / 4.179fps / 9.56s，
"Here's the slowed down bounce sequence…"）**→ done**；同组 `1580845127207387137`（213 帧）维持 C（平均 RGB 口径），本组转「1 done + 1 C」。

- 核实先于动手：旧 note 的「完整贴图/体积往返反馈仍缺 · 卡点 A 机制未做」= **过期账（第 16 次同型）**。
  `src/light/megatexture-gi.js#bakeMegaTextureGI` 的循环就是原文的 back and forth：`gatherVolume()`（SDF 的 RG 反查 mega texture 纹素）
  → `relightTexture()`（`sampleLV` 按法线取体积写回 exitance），`view-c11-megagi.js` 接管 `view.bakeGI`（`?c11=megagi`），
  `megatexture-gi.html` 早有三张贴图 + 「慢放反弹序列」入口，`tests/megatexture-gi.mjs` 一直绿 → 缺的只是**没人从页面把这条序列放出来量过**。
- 片子本身（本轮 41 帧重核，同一量具 = 主场景平均亮度 / 暗像素占比）：f0–6 = 99.66/0% · f7–9 = 48.39/**39.6%**（reset 剪影）
  · f10–17 = 84.79/**9.48%**（只有直射、阴影纯黑）· f18–25 = 98.35/0%（体积反弹填进阴影）· f26–40 = 99.16→99.29（**全程只差 0.13 级**）。
- 本轮修**两处展示层真缺口**（机制主线一字未动）：
  1. `showStage` 只关 `ambient/hemi`，漏了 `view.fill` 这盏补光（`setTimeOfDay` 的 `P.fill=0.45`）→ direct 阶段「阴影纯黑」不成立
     （暗像素 0.63%，原片 9.48%）；补关后 **1.91%**、reset 18.0%→**35.9%**（原片 39.6%），序列前半段才与片子对上。
  2. 「结束慢放」不打断播放循环：旧 `play()` 是无令牌的 `for` + 900ms `setTimeout`，点结束后仍每 900ms 覆写 stage
     （本轮测试第一版就抓到 reset 阶段拿到上一阶段画面）；加 `playToken` 令牌，`#end` 里 `playToken++`。
- 新测 `tests/megatexture-bounce-browser.cjs`（真实页面 / 真实 View / 真实 canvas 像素）：
  - 14 步快照；**volume k 只改光体积**（206025/105369/74991/73197/71399/68909 项）而 **mega texture 改 0 项**；
    **texture k 只改贴图**（26877/20420/19785/19412/18999/17056 项）而 **光体积改 0 项** → 两个方向各自成立且交替。
  - 慢放按钮：reset → index 1；点「结束慢放」1.4s 后 stage 恒 `null`。
  - 净场景像素（只留城镇网格 + 灯光，噪声 **0px**，1280×748）：99.43/35.88% → 137.91/1.91% → 149.28/0.01% → 150.44 → 150.61 → 150.66，
    台阶 **+10.2 / +1.16 / +0.17 / +0.04 / +0.01 级**；差分 333227 → 345925 → 169264 → 11689 → 957 → **tex3→tex6 仅 3142px（0.3%，最大 5.6 级）**；
    `bounceStats` 相对变化 **122.87% → 5.50% → 0.97% → 0.25% → 0.08% → 0.03%**；SDF-UV 命中精确穿越面 **82.5%**。
- 回归：`tests/megatexture-gi.mjs` PASS、`tests/lightbaker-textures-browser.cjs` PASS（同页族，噪声 0 / 差分 233145px）。
- 截图（均 ViewImage 看过）：`megatexture-bounce-r136-clean-reset.png`（纯黑剪影）/`-clean-direct.png`（只有直射、暗面纯黑）/
  `-clean-texture3.png`（阴影填满）/`-full-*`（水云鸟齐全实景）/`-maps.png`（页头读数 + 三张调试图）。
- **三项如实口径（不计缺口）**：① 原片是白色素坯建筑群，本仓是地形岛（同一套 GI，不同 World）；② 本仓 reset 仍留极细高光描边；
  ③ 原片 direct 9.48% 暗像素 vs 本仓 1.91%，因本仓台地是逐层实心体素、投影阴影面积小一档。
- 账：**done 115→116 / partial 133→132**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 15 条）：**「慢放/分阶段演示」类页面的验收，要按「状态空间 + 像素台阶」两问分开量** ——
  状态空间证「两个方向各自成立且交替」（每次只动一个数组：贴图改 N 项 / 体积改 0 项），像素台阶证「第 k 轮之后看不出」
  （+10.2 → +0.04 级、tex3→tex6 3142px）。只报「相对变化递减」会被一句「那画面上看得出来吗」问倒。

**下一轮建议（第 137 轮）**：A 类仍空（TOP 表已无裸 A）。首选同组姊妹片 **`1580845127207387137`**（213 帧，"SDF distance in RGB…"），
本轮 82.5% 的 SDF-UV 命中已间接证明「SDF 的 RG=UV」在跑 → 先抽帧判是 A 还是仍卡平均 RGB 口径；
次选 [048] `1769691526924292506`（球面 WFC/BFS 河网整条管线，B 一整轮）；`1580835075629133825`（2.5D 形因子口径）维持 C 不排期。

## 三·135、第 135 轮（A 类仍空，B 取 [010] 组内最后一条：真流式加载 + 块内疏密均匀度）

**本轮实收口（1 组 / 1 条）**：`1151137783785771008`（449 帧 / 18.19fps / 24.7s，
"As promised: an aperiodic infinite deterministic irregular relaxed quadrilateral grid."）**→ done**；
**[010] 组 6/6 片全 done，组已清。**

- 核实先于动手：旧 note 两条「仍缺」= **一条过期 + 一条真缺口**：
  1. 「真流式加载（页面一次最多 19 块）」→ **过期账**（第 15 次同型）：`src/core/infinite.js#createInfiniteStream`（按需 `finalPatch` + `evict`）+
     `infinite-c06.js#streamWindow`（焦点窗口/圈外只生成未松弛拓扑/丢弃远处缓存）+ 页面 `infinite-stream.html`（指针拖焦点、半径滑杆、自动巡游、黑网对偶）
     r56 C06 就落了，`tests/infinite-stream.mjs` / `infinite-c06.mjs` 一直绿 —— 缺的只是**没人从页面上拖过一遍**。
     旧 note 的「19 块」说的是 `grids.html?t=infinite`（`buildInfinite({rings:2})` 窗口版），不是流式页 → `where` 已改指流式页。
  2. 「块内疏密均匀度指标」→ **真缺口**（没有量具），本轮补 `infinite-c06.js#densityStats`。
- 片子本身：`0000–0044` 全空（只有一个十字准星）；`0045` 中央冒出**一块**网格团；`0045–0286` 按块向外长（一次鼓出一整块，块界无折痕），
  黄色焦点方块 + 绿上/红右 gizmo 轴在画面里**游走**，新块总在焦点附近，圈外一圈更暗的细斜对角线（未松弛拓扑）；`0287–0299` 铺满整个视口；
  `0300–0430` 全屏不规则四边形、大小相近朝向各异、**看不出块边界**；`0431–0448` 镜头连续放大，形状与疏密关系不变。
- 本轮补的量具（`densityStats`，只读 `P.pos`，不动任何几何）：面积比 p10/p50/p90、p90÷p10、CV、边长 p50/CV，以及
  **块均值离散 vs 块内平均离散** —— 「块间≈块内」就是「看不出块边界」的可读量。
- 实测（新测 `tests/infinite-stream-browser.cjs`，判据全来自页面读数与真实 canvas 像素）：
  - 首帧 7 块 / 1458 格、接缝 **1.78e-15**、翻折 0、面积比 0.799/0.999/1.189（**1.49×**、CV **0.143**）、边长 CV 0.156。
  - **真指针拖动**焦点 → **(9.24, −3.96)**，累计块拓扑 7 → **45 块**（拖到哪长到哪，不是一次开窗）。
  - 沿 x 走 0→200（每 40 一步）：累计拓扑 **57 / 87 / 119 / 159 / 192 / 224**，缓存恒 **30–37**、丢弃 **20→194**、每步接缝 ≤2.8e-14、翻折 0、
    面积 p90÷p10 1.43–1.49、CV 0.138–0.143 → **缓存不随路程增长**。
  - 半径 4：**1 块 / 210 格**（cached.patches 19）；焦点移到 x=200 仍 1 块，拓扑 129→147、丢弃 129、缓存 18。
  - 半径 14：**19 块 / 3936 格**、面积比 0.67–1.46、p10/p50/p90 **0.80/1.00/1.19（1.48×、CV 0.141）**、边长 CV 0.155、
    **块均值 CV 0.006 vs 块内 0.141**；浅色网格像素 30052–82019；0 console error。
  - **同一口径量两边**（洪水填充「白线围出的格心」，面积中位对齐 ≈156 px²）：原片 0448 **589 格、1.83×、CV 0.216**；
    本仓 **2622 格、2.14×、CV 0.272**。
- 回归：`infinite-c06.mjs` / `infinite-stream.mjs` / `infinite-window.mjs` / `infinite-area-pull.mjs` PASS；
  `tests/r50-page-entries-browser.cjs` **ALL PASS**（grids 平移接缝 781/771/771，max ≤ 7.3e-15）。
- 截图（均 ViewImage 看过）：`infinite-stream-r135-page.png`（面板：19 块/3936 格 + 均匀度三行）、`infinite-stream-r135-full.png`（半径 20 铺满，圈内白网/圈外暗网）、
  `infinite-stream-r135-zoom.png`（放大对齐格子尺寸）、`infinite-r135-native2x.png`（10 关键帧 2×）、`infinite-r135-orig-0448-3x.png` / `infinite-r135-ours-3x.png`。
- **三项如实口径（造型差，不计缺口）**：① 原片彩色记号是三维 gizmo 轴（绿上/红右/另有蓝），本仓只画黄方块 + 两根轴；
  ② 原片圈外未松弛网画成更暗的细斜对角线，本仓画 raws 轮廓；③ 本仓格子大小差比原片大一档（同口径 CV 0.272 vs 0.216、2.14× vs 1.83×，几何口径是 1.48×）。
- 账：**done 114→115 / partial 134→133**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 14 条）：**「块/lod 类机制」的均匀度别用「看着挺均匀」结论** —— 把「块均值离散 ÷ 块内离散」当一个数报出来：
  块均值 CV 0.006 vs 块内 0.141 一句就证明「块边界看不出来」，而「格子大小差多少」再交给 p90÷p10 + 洪水填充同口径量两边。

**下一轮建议（第 136 轮）**：A 类仍空（TOP 表已无裸 A）。首选 **`1580846877855338497`**（41 帧，note 写「完整贴图/体积往返反馈仍缺 · 卡点 A」，
但 `megatexture-gi.js` 已在跑同一往返 → 大概率过期账，0.5 轮可翻）；次选 **[011] 类「模块在只缺 `-browser.cjs`」的组**（先 `grep tests/ 有无 *-browser.cjs`）；
`1579474420749725696`（坡面/模块联合生成）与 `1580845127207387137` / `1580835075629133825`（平均 RGB、2.5D 形因子口径）维持 C 不排期。

## 三·134、第 134 轮（A 类仍空，B 取 [010] 组内最后一条贵的：三张贴图与 mega 往返）

**本轮实收口（1 组 / 1 条）**：`1481661852887265288`（425 帧 / 22.38fps / 18.81s，"Yet another light baker"）**→ done**；
[010] 组内只剩 `1151137783785771008`（真流式加载）一条 partial。

- 核实先于动手：旧 note 两条「仍缺」= **全是过期账**（第 14 次同型）：
  1. 「笔触法线/切线贴图」→ `src/core/paint-normal.js`（r56 迁原版 paintnormal.js：抖动 Voronoi 块、一块一个随机倾角、1–2px 软边、切线空间 RGB）
     + `view-shading.js` 的 `?shade=paintnormal` 早已按主轴平面投影采样并扰动**着色**法线（顶点不动）。
  2. 「SDF 命中 UV / mega 反馈」→ `src/light/megatexture-gi.js`（SDF 的 RG = 最近表面在 mega texture 的 UV、B = 距离；六向光体积对 SDF 球步进、命中按 RG 取纹素，逐轮反弹）+ `megatexture-gi.html` 早已有。
- 片子本身值得记一笔：**三张图像只在顶部 144px 调试条里**，全片没有放大展示 —— 所以「像不像」只能靠条里那点像素，主体（白色素坯岛转台）只能证明「图被用上了」，不能证明算法细节。
- 同一口径量两边（面板按背景色分割后逐像素量）：
  - ① 法线：色桶 ≥100px 的 25 个占 55%、最大块 3442px（20.5%）→ **块宽/图宽 0.15**；本仓 25 块 → **0.20**（1.3×）。块内倾角离散本仓 **1.1°**（一块一倾角）；原片 RGB 反解倾角 p50 88°（比本仓上限 26° 猛得多）。
  - ② SDF：原片 **4 列 × 4 行 = 16 张 y 切片**、纯灰软斑；本仓同形（4 列 y 切片、RG=UV 着色），tile 均值 177–211 / std 18–37 等价非空。
  - ③ 六向 AO：原片是 8×4 左右的**小格图集**（每片 chart 一格），本仓是可切的六向体积 + 六切片（`distance-volume-mixed-ao.png`）。
- 新测 `tests/lightbaker-textures-browser.cjs`（真实 View + 真实页面，判据全来自像素/读数）：
  - ① 冻时间轴后同状态两帧 **噪声 0px**；开/关 `?shade=paintnormal` **差分 233109px（占画面 18%）**、平均 **9.85 级**、最大 45.7 级；关回 **0px**；顶点 49848 与哈希不变。
  - ②③ `megatexture-gi.html`：984 片 chart / 9256 纹素 / 图集 172×164；**SDF-UV 命中精确穿越面 82.5%（69094/83777）**；反弹相对变化 **122.87% → 5.50% → 0.97%**；三张画布 54034 / 7350 / 2737 色，不是空白。
- 回归：`tests/paint-normal.mjs` PASS（sameInChunk 0.937）、`tests/megatexture-gi.mjs` PASS（uvMatch 0.829、relChange 0.9886→0.0428→0.0073→…）、`tests/lightvolume-distance-browser.cjs` PASS（mixed/quad 双网格 SDF 与纯 DDA 最大差 0、ao/sdf/normals 切片 257/592/59074 色、errors []）。
- 截图（均 ViewImage 看过）：`lightbaker-r134-paintnormal-on/-off.png`、`lightbaker-r134-paintnormal-compare.png`（3× 并排：右图墙面出现成片柔和块状朝向变化）、`lightbaker-r134-mega-three-maps.png`、`distance-volume-mixed-ao.png`。
- **页面假账修正**：`lightvolume.html` 顶部原写「尚未复现形变 SDF/mega-texture 反馈」，实际 `megatexture-gi.html` 早在跑 → 改为指向该页（r114/r122 同型：页面提示语本身是过期账）。
- **三项如实口径（形态/近似差，不计缺口）**：① 原片法线图是**网面 UV 图集**（块形跟着 UV 展开走），本仓是世界平面**周期平铺** Voronoi；② SDF 是**体素中心** EDT，不是连续三角网表面 SDF（原片那 16 张切片同为体素体积）；③ AO 是单轴距离近似，不是多射线半球积分。
- 账：**done 113→114 / partial 135→134**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 13 条）：**「片子里的调试图只有几厘米高」时，别去比渲染观感，直接量那张图本身** —— 把调试条按背景色切出来，块数/块宽/图宽比/倾角分布都是可数的数，
  「像不像」立刻变成「0.15 vs 0.20」这种可判的差；主体画面只用来证明「图确实被用上了」。

**下一轮建议（第 135 轮）**：A 类仍空。首选 **[010] 的 `1151137783785771008`**（真流式加载；先 grep `createInfiniteStream` / `infinite-stream.html`，
大概率又是「模块在 + node 测试绿 + 页面没验收」）；次选 **`1580846877855338497`**（41 帧，note 写「完整贴图/体积往返反馈仍缺 · 卡点 A」，但 megatexture-gi 已在跑同一往返 → 很可能也是过期账，0.5 轮可翻）；
`1580845127207387137` / `1580835075629133825` 卡平均 RGB 与 2.5D 形因子口径，维持 C。

## 三·133、第 133 轮（A 类仍空，B 取 [010] 组内最便宜的 `1201179450668441600`：图标工具条接真实命令）

**本轮实收口（1 组 / 1 条）**：`1201179450668441600`（306 帧 / 33.33fps / 9.2s，"Icons!"）**→ done**；
[010] 组内还剩 `1481661852887265288`（体素光照烘焙，美术资产为主）一条 partial。

- 核实先于动手：旧 note 两条「仍缺」= **一条过期 + 一条语义错**：
  1. 「撤销/重做/退出三项的游戏语义要接主管线，单页实验验收不了」→ **过期账**：`game-ui-c06.js`（文件头署本片 ID）里的撤销/重做走的就是
     `app.js` 的真 `undo()/redo()`，工具切换走真 `setTool`；缺的只是**没人从页面上点过一遍**。
  2. **语义错**：第三个灰格被做成「清空城镇」（`pushUndo + world.reset()`），而片中的叉是**退出**（片中三项恒灰 = 不可用）。
- 本轮只改 UI 层（世界/渲染机制一行未动）：`app.js` 挂钩多传 `undoDepth/redoDepth` 两个读数；工具格每格自带底色 + 同色系浅色图形 + 轻微倾斜，
  选中格图形转**纯白**（原先只换底色）；下方三项用 `icon-ink` 的 `DEFAULT_ICONS.undo/redo/close` 描边路径、灰底白图形，**可用态每帧同步真实栈深度**；
  第三格改为**退出**：摘 `#gameui-c06` 并把隐藏的 `#tools/#topright` 还原。
- 实测（`tests/game-ui-icon-commands-browser.cjs`）：3 个工具格底色互不相同、倾斜 -4°(选中)/1.8°/-1.4°、线宽逐个反解 2.012/1.796/2.242；
  选中格图形 `rgb(255,255,255)` + `::after` 三角 10px、未选中无三角且仍有色；三项标签 撤销/重做/退出 全为灰底白描边；
  **初始 `depth 0` → 撤销/重做 disabled=true**（与片中灰一致）；真指针点地：体素 **356→357**、`depth 1`、撤销格亮；点撤销 **357→356**、`depth 0/redo 1`；
  点重做 **356→357**；点工具格 erase → `state.tool=erase`；点叉 → `#gameui-c06` 摘除、`#tools` 回到 `flex`。
- 回归：`tests/game-ui-c06.mjs` PASS（1200 直线 / 28 闭环）、`tests/r50-page-entries-browser.cjs` ALL PASS（等墨量 8 按钮 · 线宽 1.55–2.45 · cv 0.2956→0.1987→0.0369）。
- 截图（均 ViewImage 看过）：`game-ui-icon-r133-page.png`（整页：3 彩格 + 3 灰格 + 白三角 + 右侧倾斜菜单）、`game-ui-icon-r133-bar.png`（工具条近景）、
  `game-ui-icon-r133-compare.png`（原片 0060 左列 3× vs 本仓 3× 并排）。
- **五项如实口径（造型差，不计缺口）**：① 原片图稿（指针/滚筒/漆桶/调色盘+笔，4 个工具格）无源素材，本仓是折线几何 + 3 个工具；
  ② 原片灰格图形是浅灰描边，本仓纯白；③ 倾斜角档位不同；④ 片中"灰"只说明不可用，本仓把不可用绑到真实栈深度；
  ⑤ 工具条**默认仍 `?gameui=1`** —— 默认 HUD `#tools` 有同一套命令（建造/拆除/刷色 + 撤销/重做/回放），换皮肤会连带隐藏 `#topright` 与回放按钮，
  那是 `1260586697538113537` 的取舍，不在本片范围。
- 账：**done 112→113 / partial 136→135**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 12 条）：**「片中灰着的按钮」是最便宜的验收入口** —— 它的灰不是配色，
  而是「不可用」这个状态；把它接到真实栈深度，一条断言就同时证明了「命令是真的」和「形制是对的」。

**下一轮建议（第 134 轮）**：A 类仍空。首选接着吃 **[010] 的 `1481661852887265288`**（425 帧·体素光照烘焙：normals/SDF/六向 AO 都在，
旧 note 只剩「笔触法线贴图 + SDF 命中 UV/mega 反馈」，先 grep `voxel-distance/lightvolume` 判是「入口没量」还是「真美术资产」）；
次选 **[055] `1579474420749725696`** 与 **[040] `1670064751181791233`** 维持 C，不排期。

## 三·132、第 132 轮（A 类仍空，B 取 [047] 组内唯一 partial：门窗 stencil 挖 z-buffer）

**本轮实收口（1 组 / 1 条）**：`1205422438437273601`（390 帧 / 22.727fps / 17.16s，
"For doors and windows, I use som stencil buffer shenanigans to punch holes in the zbuffer."）**→ done**；[047] 组内已无 partial。

- 核实先于动手：旧 note 的两条「仍缺」是**一过期 + 一半过期半真缺口**
  1. 「墙体厚度与洞口侧壁（墙是无限薄的面，近景无洞深）」→ **过期账**：`punchGeometry` 每个洞都出一只**凹洞盒**
     （后墙 + 左右侧壁 + 窗台 + 窗楣，`depth` 默认 0.06）。本仓墙确实是零厚度壳，但洞深由这只盒子提供，不是靠墙本身厚。
  2. 「接 buildings.js 主管线（门窗仍走 archedEntry 贴片）」→ `openingLog` 早在 r56 就由 `buildings.js:198` 产出（240 条 = 236 窗 + 4 门，带 cell/edge/t/y0/y1/width 与墙边 a/b、外法线），
     `attachOpeningPunch` 读的也是 `view.worldMesh.build.openings`；**但 `app.js` 是 `if (params.get('punch'))` —— 默认不接**。
     默认场景里全岛门窗都还是「白十字 + 一整片深蓝」的贴片 → 这是真缺口，且与 r130 的 `UnitShadowBatch.enabled` 同型（wiring 默认关）。
- 本轮只改这一层（机制主线一字未动）：`app.js` 主场景**默认开**、`?punch=0` 关档；顺带把注释里「默认全关」的假账改成实际口径（churchDoors / canalBridges 仍默认关）。
- 实测（新测 `tests/opening-punch-main-browser.cjs`，判据全部来自 GPU **默认帧缓冲** `readPixels`，不看代码「应该有」）：
  - 接线：`stats()` → `openings 240 / doors 4 / depth 0.06`，与 `build.openings` 240（236 窗 + 4 门）逐条对齐；`?punch=0` 时 `rea.punch` 不存在。
  - 整岛 A/B（d=9 / pitch .45）：开/关差分 **6402 px**，其中 **5347 px（83.5%）落在 240 个洞口的投影矩形并集内**、矩形外 1055 px 是洞边 1px 抗锯齿与斜视退化的窗；**同状态两帧噪声 0 px**。
  - 近景单个窗（cell 183 / edge 0，d=2.2，窗投影 53×60 px）：关档窗内 **2244/3158 = 71% 深色**（玻璃板）；开档深色 **0 px**、亮灰侧壁 **1312 px（42%）** —— 窗从「暗贴片」变成「亮着的洞内侧壁」。
  - 视差/洞深：斜看 dy .10/.22/.40，灰侧壁 **1423 → 1711 → 1975**（单调）；洞内残余暗缝质心横移 **31.2 px**，关档同一量只有 **1.1 px**（透视漂移）。
    理论 `depth·tanθ·scale` ≈ 12.6 px，实测 31.2 px ≈ 2.5×，因为暗缝本身只有 10–23 px 宽、随视角被侧壁挤到一侧 → **只作方向性证据，不当精确标定**。
- 回归：`tests/opening-punch-browser.cjs` PASS（punch 透出 1 / decal 0、holePixelsError −0.46%、wallDrift 0、repeatDrift 0）；
  `tests/opening-punch-arch-browser.cjs` PASS（arches 1 / archFloors 2 / lower 1.0000 / upper 0.9999 / shoulder 2838 / leak 0 / areaErr 0.1%）。
- 截图（均 ViewImage 看过）：`opening-punch-main-r132-wide-on/-off.png`（同机位整岛 d=4.0）与 3× 裁切 `-wide-on-zoom.png` / `-wide-off-zoom.png`
  —— **关档窗是白十字 + 一整片深蓝玻璃板；开档窗里是灰蓝色内壁、白十字悬在洞前**；另有 `-near-on/-near-off.png`（d=2.6 近景）。
- **三项如实口径（不计缺口）**：① 洞深固定 0.06 世界单位（≈1/3 格距），原片洞深无可测量口径，属造型参数；
  ② **原片相机始终大致正对立面，全片没有任何强斜视角**，「洞深」在原片像素上只有窗角那一小块灰斜面为证 —— 本轮的视差证据来自本仓渲染，不是原片；
  ③ 凹洞侧壁是纯色（0.62/0.57/0.50 ×0.8–0.9），比原片受主光的侧壁暗一档。
- 账：**done 111→112 / partial 137→136**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 11 条）：**「机制在、测试绿、页面能开」还要再问一句「默认开着吗」** —— 本仓 r56 那批 opt-in 挂钩（`?punch=1`/`?steelFrame=1`/…）
  让「代码里有」与「片子里看得见」之间隔着一个默认值；r130 的 `UnitShadowBatch.enabled=false` 与本轮 `if (params.get('punch'))` 是同一个坑。

**下一轮建议（第 133 轮）**：A 类仍空，按分数往下取 B 一组。首选 **[010] 的续项**（组内还剩 `1481661852887265288`/`1201179450668441600` 两条 partial，
最早记的五条 B 里 ①1551 真流式加载、②navmesh 漏斗接 battle.js、③walk-reach 接生成器默认流程、④texel-owner 接 impostor 烘焙、⑤1201 三项游戏语义；
先按本轮姿势查「opt-in 挂钩 vs 默认值」，②③④ 很可能同样只是默认值/入口问题）；
次选 **[055] `1579474420749725696`** 仍维持 C、**[040] `1670064751181791233`** 建议降 C。

## 三·131、第 131 轮（A 类仍空，B 续取 [051] 组内那两条：北境软影补「盘子在画面上可见」）

**本轮实收口（1 组 / 2 条）**：`821321422140309504`（315 帧 / 33.33fps / 9.45s，无原文）
+ `821680056514781186`（763 帧 / 33.38fps / 22.86s，"By popular demand: Revenge of the Blues!"）**→ 均 done**。

- 两条是同一场北境灰模战斗、同一句缺口，按「一条缺口 → 两条 done」算（第 8 条便宜 done 规律）。
- 本轮只做一件事：把 r130 挂的最后一层「没在画面上确认盘子可见」收掉。r130 的两次机位是**选错了被测对象**——
  它取「周围同伴最多」的单位，那家伙在台地**中段**，相机 dist 5 正好塞进实心柱侧壁；加上没冻时间轴，同状态两帧差分就有 2 万 px。
- 三条一起改（`tests/battle-unit-shadow-browser.cjs`，机制主线一字未动）：
  ① 120ms 定时器钉 `view.target/distance/pitch`（r127 做法：app 会在世界异步生成后再 fit 一次相机）；
  ② 冻时间轴 `v.render = () => orig(0)`，噪声从 2 万 px → **0**；
  ③ 目标改取**楼层最高**的单位（台地顶层上方没有植被/侧壁），`distance 4.0 / pitch 1.25` 俯视；
  另加一支**节点自带的 PNG 差分**（把两张截图 base64 塞回页面用 `OffscreenCanvas` 解码，不引第三方包）。
- 实测：24 片盘面 `minAboveFloor` **min=p50=max=0.008**（排掉「台地实心柱渲染面高于 `floor*L+0.008` 把盘埋掉」的疑点）；
  开/关差分 **9228 px**（bbox 446,397–615,609 正好罩住单位群）、差分处亮度 **144.66 vs 165.73 = 压暗 21.07 级**、最暗点 **38.1 级（22%）**、
  同状态噪声 **0**、开→关→开回到同一画面 **0**；`pieces 52 / multiCell 19`、`drawRange 1077`。
- 截图（均 ViewImage 看过）：`battle-unit-shadow-r131-on/-off/-on2/-on-back.png`、`battle-unit-shadow-r131-compare.png`（左右并排）、
  `battle-unit-shadow-r131-dropmap.png`（压暗热图：**每个单位脚下各一团圆形暗区、相邻两团并成一片**）。
- 看帧补的两处原片事实（3–4× 原尺寸）：frame-0300（8213）残局只剩 4 个橙兵、**没有尸体**，脚下暗区仍比 4 人合起来宽一圈 → 暗斑是单位自带接触影，不是尸体贴片；
  frame-0465（8216）混战区下方台地比同层右侧空地暗，**没人倒下的那半边同样有**；0450–0530 站位在台阶交界的单位，暗区只贴自己那一级踏面。
- 如实口径（造型差，不计缺口）：原片是**纯灰无贴图**灰模，暗斑对比更硬；本仓浅绿地面 + 光照下同 alpha 读数 12%–22%，观感更淡；
  本仓每盘直径 0.24 世界单位（≈ 半个格距），原片暗区约 1.5 倍单位身宽，比例接近但人数多、盘更大更容易一眼看出。
- 回归：`node tests/unit-shadow.mjs` PASS、`node tests/unit-shadow-continuity.mjs` PASS（跨格 468/480 片、楼梯 5/13 片口径不变）。
- 账：**done 109→111 / partial 139→137**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮新姿势（累积第 10 条）：**「拍不到」先怀疑被测对象的落点，不是怀疑机制** —— 同一套机位参数，换一个「楼层最高、上方无遮挡」的单位就从「一片墙」变成「一眼看见盘子」；
  另外**像素 A/B 前必须先把时间轴冻住**（r119 在 k-pow 上踩过，本轮第二次），否则 2 万 px 的植被摆动底噪会把几百 px 的暗盘信号吃掉。

## 三·130、第 130 轮（A 类仍空，B 取 [051] 组内两条同句缺口的片子：北境软影）

**本轮未能收成 done（2 条仍 partial）**：`821321422140309504`（315 帧 / 33.33fps / 9.45s，无原文）
+ `821680056514781186`（763 帧 / 33.38fps / 22.86s，"By popular demand: Revenge of the Blues!"）。

- 两条是同一场北境灰模战斗，旧 note 同一句「暗斑不能单独证明原阴影方法 / 不能认证软影高度或坡面算法」+【卡点·C 算法未公开】。
- 核实（第 10 次命中「note 过期」）：`core/unit-shadow.js`（0.36·h 光向偏移 / 1÷cosθ 坡向拉长 / groundAt 贴地 / measure 表）、
  `life/unit-shadow-batch.js`（跨格拼片 / 楼梯踏面 / groundSampler 射线拟合）、`battle.js:70` 接线全在，r114 还出过整页浏览器验收。
- **真缺口是 wiring**：`UnitShadowBatch.enabled` 默认 `false`，全仓只有 `battle-g3.js:54`（`shadowFit` 调试开关）会置 true
  → 默认战斗一片软盘都不画（探针：24 个活单位 `count=0 / drawRange=0`）。片子里的暗斑是常态存在的。
- 本轮改：`battle.js` 构造里 `unitShadows.enabled` 默认开，`?unitShadows=0` 关档；新测 `tests/battle-unit-shadow-browser.cjs` **PASS**：
  `count 24 = 活单位 24`、盘面全在「自己楼层平面 + 0.008」、离地 0.45 时**光向偏移 0.162 = 0.36·h**（整圆盘 bbox 圆心，方向 cos 对齐）、
  `alpha 0.3 → 0.13125`、20° 人工坡长轴比 **1.06426 ≈ 1/cos20°**、面积比 **1**、`ySpread>0.01` 随坡起伏、`shadowFit` 24/24 走拟合、`?unitShadows=0` → count 0。
  回归 `tests/unit-shadow.mjs` / `tests/unit-shadow-continuity.mjs` 全 PASS。
- **为什么没给 done**：两次机位尝试（`dist 3/pitch 1.0` 钻进云层、`dist 5/pitch 0.42` 钻进台地侧壁）都没把相机钉住
  —— app 每帧重摆相机，`enabled` 开/关两帧截图只差 **8 px**，等于没在画面上亲眼看见盘子。另留一个真实风险：
  台地是实心柱，软盘贴 `floor*L + 0.008`，**形变后的渲染面可能高于该值把盘埋掉**。下轮第一件事是钉机位（120ms 定时器，r127 做法）+ 干净 A/B。
- 账：**done 109→109 / partial 139→139**（两条都没升级，不做假账）；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- 本轮两个新坑（写进 note 也算账）：
  1. **扇三角化把 poly[0] 复用了 n 次 → 直接平均顶点当圆心会偏 r/7 ≈ 0.004**；被格边裁过的盘连面积重心也会偏向留下那块。
     判「整圆盘」要用**包围盒 == 直径**，不是 `pieces==1`（裁过仍可能是 1 块）。
  2. `#draw` 每帧把 `mesh.visible` 重写成 `count>0` → 只翻 `visible` 截 A/B 图，下一帧就被冲回去（第一版两张图只差 26 px 就是这个骗的）。
     要切就切 `enabled`。

## 三·129、第 129 轮（A 类仍空，按分数往后取两组各一片：后院道具 / 庭院小径）

**本轮实收口（2 组 / 2 条）**：`1205416648397721601`（261 帧 / 10.0fps / 26.1s，"New prop placement system! …"）
+ `1290997501332525056`（187 帧 / 29.82fps / 6.27s，"… I added some garden paths."）**→ 均 done**。

- 两条都不在 TOP 1–18 里（TOP 全 ✔ 后按分数往后取），且都是 r56 那批「新建模块 + node 测试 + 留了页面」留下的旧账：
  **note 里的最后一句「仍缺」都是过期账**（r121–r128 同型，第 9 次命中）。
- `1205` 核实：`core/opening-footprint.js#placeProps`（凸格贪心 + SAT 不重叠 + std 刚性正框 + 障碍预占）早在 r53，
  `buildings.js:589–604` 用 `world.yardProps` 接到**真实后院格**、`yard-prop-art-r56.js` 按同一 footprint 画桌/箱/盆；
  note 记的「完整家具贪心摆放仍缺」是把「机制在、页面没量过」写成了缺机制。
- `1290` 核实：`build/garden-plots-c07.js` 的 `planGardenC07`（门表 → 院子门格 → 中心 hub → BFS 树）+ `drawGardenCellC07`
  （条宽 `0.18·rc` 双层窄石板、hub 双层圆环 + 石台 + 装饰、草地块 `partitionPlots` + 石沿）正是 note 记的三件「仍待补」。
- 本轮补的（机制主线都没动，只补页面上可量的东西）：
  ① `openings-r56.html` 加只读探针 `window.r56propProbe()` —— 不读 build 日志，直接拿 placeProps 的 footprint 逐对 SAT、
  逐角量到格边余量、量格歪斜角与框直角偏差，并**只改 `yardPropTries` 重跑同一 World** 量饱和曲线，门窗另量「框水平边与墙边夹角」+ 两个反向对照；
  ② `buildings.js` 的 build 结果加 `gardenC07` 只读台账（stats/hubs/doors/plots/links/paths，零行为变化）；
  ③ `garden.html` 顶部提示语里「未复现…石板宽度和中心雕塑」是假账（r114 教训），换成 C07 的真实口径。
- 实测：
  - 道具（`?scene=town&grid=mixed&seed=3&flags=yardProps,yardPropArt`）：5 格后院 **32 件 / 123 对逐对 SAT 重叠 0**、与树冠障碍重叠 0、角到格边余量 **0.02158**；
    饱和曲线（tries 20/60/120/300）**12 / 24 / 32 / 39**，覆盖率 **0.094 / 0.177 / 0.213 / 0.255**，**每个预算下重叠都是 0**；
    后院 5 格全斜（最大内角偏差 **45.49°**）而每个框 **frameDevMax = 0**；**263 道门窗全在斜格上**（最大 47.12°），框水平边与墙边夹角 **0°**、直角偏差 **0°**，
    反向对照 89.84°（按格子首边斜基）/ 21.801°（横向错切 40% 高）；道具三种都在 `{crate 13, table 4, planter 15}`；
    像素 A/B 噪声 **0**、关道具 12246px、关美术 11609px。
  - 小径（`index.html?scene=town&grid=quad&c07=gardenplots`）：`doorPaths 1 / fallbackPaths 0 / plots 2`；门格 1/1 落在小径上且**各有石板条出到门外**；
    从 hub 走满 **3/3** 小径格；`build.pathCells` 就是门优先路径；条宽 **0.36·rc**（rc 0.1567–0.2589）；草地块 2 块 9 格；
    关开关退回 PCA 端点方案 **7 格**（**4 格只在旧方案**）、噪声 **0**、差分 814px（近景 158415px）；
    混合网格无门院子：`fallbackPaths 1`、回退 **8 格**不消失。
- 新测：`tests/prop-placement-greedy-browser.cjs`、`tests/garden-paths-door-first-browser.cjs`；回归 `prop-frame.mjs` / `opening-footprint.mjs` /
  `openings-c05c-r56.mjs` / `c07-look.mjs` / `garden-browser.cjs` / `garden-paths.mjs` 全 PASS；0 console error。
- 截图（均 ViewImage 看过）：`prop-placement-r129-yards.png`（草坪块内木箱 + 白桌面桌 + 盆栽，互不叠压）、`prop-placement-r129-town.png`（斜墙窗仍是正框）、
  `garden-c07-r129-quad.png`（中心圆台 + 装饰 + 窄石板条 + 石沿草坪）、`garden-c07-r129-mixed.png`（回退）、两张 `-off` 对照。
- **如实口径（造型差，不计缺口）**：道具本仓是木箱/桌/盆栽（原片是长凳/椅/灯/花盆，原版道具美术未迁），院子只有 5 格、没有「沿墙一长排长凳」；
  中心装饰是石台 + 圆冠灌木（原片是石球），town 场景只 1 个院子 3 格小径。
- 账：**done 107→109 / partial 141→139**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 130 轮）**：A 类仍空，继续按分数往后取 B 一组。
首选 **[051] 的 `821321422140309504` / `821680056514781186`**（先 `ls src/** | grep -i ribbon` —— 本轮再次确认本仓仍**没有任何 `*ribbon*` 模块**，r102 的判法是对的；
两条 note 都是「卡点·C 算法未公开」，要动就是新建整组，先判值不值得）；
次选 **[047] `1205422438437273601`**（高拱龛墙厚侧壁 + 接 buildings.js，D 性质）；
**[055] `1579474420749725696`** 维持 C。
本轮新姿势（可复用第 9 条）：**note 的最后一句「仍缺 X」隔了几十轮还没动，先 grep「X 的关键词」而不是 grep 片 ID 的模块名** ——
两轮都是靠 `placeProps` / `planGardenC07` 这两个**函数名**在 5 分钟内翻掉的。

## 三·128、第 128 轮（A 类仍空，B 按分数取重心坐标组：9745 两片一并收口）

**本轮实收口（1 组 / 2 条）**：`974564862729838592`（478 帧 / 32.19fps / 14.85s，"pedagogical gizmos for my GDC microtalk … Barycentric Coordinates"）
+ `974579499802202113`（815 帧 / 29.24fps / 27.87s，"1 subtraction and 1 dot product (if you've precalculated some nice vectors)"）**→ 均 done**。

- 这一组不在 TOP 1–18 里（TOP 全 ✔ 后按分数往后取）。两条片子**共用一句话的缺口**「3D 原 gizmo 未完整迁移」（挂自 r56），按"一条缺口 → 两条 done"算收益。
- 核实先于动手：`src/core/spatial.js#baryPrep3` 早就是**任意朝向平面**的三维版（对偶向量 + `normal` / `distance()` / `ops{1 减,1 点积/坐标}` / 退化 flag），
  `src/world/bary-gizmo.js` + `bary-gizmo.html` r56 C04 就已经在真实 World 的一格扇三角上叠了 gizmo，node 测试 `tests/barycentric-3d.mjs` 也是绿的
  —— 又是「模块在 + node 测试绿 + 页面能开，没人从页面量过」（r121–r127 同型），判 A 性质、组分数归 B。
- 本轮看帧补出来的三件事（原片 3× 原尺寸看的）：① 光标**一直压在白球上** → 是实时拖拽，不是预演动画；② 球能**被拖离三角面悬在空中**（815 那条 0445 帧最典型）；
  ③ 三角形本身会被拖**拉窄/张开**；三角形三条边是**白色加粗**的（周围是黑细线三角网）。
- 本轮补的（机制主线没动）：`bary-gizmo.js` 加 `attach(canvas)` 真指针拖拽（抓球反解 (u,v) / 抓第三顶点改 spread / **Shift+拖球沿法线抬 h**，
  轴向拖拽用"射线—轴线最近点"，拿"垂直视线的平面"截会得到位移恒 0）、`params()/state()/triArea()` 只读面 + `dragStats` 台账、
  三角形边改**细长盒子**画（WebGL 里 linewidth 恒 1px，原片白边更粗）、`pickGizmoCell` 按"周边 2 圈最高点最低"选空旷格；
  `bary-gizmo.html` 补背景三角网（按真实格扇三角画，`?wire=0` 关）、机位钉住（世界异步生成后 app 会再 fit 相机）、`?hud=0` 清屏、iframe 缓存命中时的启动竞态修复。
- 实测（新测 `tests/bary-gizmo-3d-browser.cjs`，**27/27 PASS**）：Σw=1（1.1e-16）、与 Cramer 差 **1.1e-16**、`|P−平面| = h`、投影点 Q 到平面 **0**；
  真拖球到 (0.72,0.14) → u=**0.72** v=**0.14**（7 次 move）；拖到三角形外 → `inside=false`、w=[0.87,**−0.22**,0.35]；
  拖第三顶点 → spread **1→1.400**、面积比 **1.39996**（**线性**，顶点沿 A–B 中线走，与 AB 平行那段不贡献面积 —— 不是平方）；Shift 抬升 h +>0.1 且 u/v 不变；
  像素 A/B（gizmo 开/关，同帧两次渲染）噪声 **0**、差分 **2969px**；0 console error。回归 `barycentric-3d.mjs` / `c04-bn-world.mjs` PASS。
- 截图（均 ViewImage 看过）：`bary-gizmo-r128-inside.png`（球在三角形内）、`-outside.png`（越界 + 红顶点球变大）、`-vertex.png`（三角形张开）、`-lifted.png`（球悬空 + 长白竖线连到投影点）。
- **三项如实口径（造型差，不计缺口）**：① 本仓地形是彩色（草地/沙滩）+ 旁边有建筑，原片是无贴图灰模；② 本仓只让第三个顶点沿中线拖（另两顶点钉在网格顶点上），原片三顶点自由拖；
  ③ 背景三角网只画同高格半径 6.5 内的扇三角，不是全岛全量。
- 账：**done 105→107 / partial 143→141**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 129 轮）**：TOP 1–18 已全 ✔，继续按分数往后取 B 一组。首选 **[051] 的 `821321422140309504` / `821680056514781186`**
（先 `ls src/** | grep -i ribbon` 核 navribbon —— r102 判"模块不存在"、本仓至今确实没有 `*ribbon*`，要新建就是整组一轮；两条 note 又都写着"卡点·C 算法未公开"，先判值不值得动）；
次选 **[047] `1205422438437273601`**（模板挖洞已实现并有 `tests/opening-punch-arch-browser.cjs`，残留是"墙厚侧壁 + 接 buildings.js 主管线"，是 D 性质）；
**[055] `1579474420749725696`** 维持 C。
本轮新姿势（可复用第 8 条）：**"一条缺口挂两片"的组，成本按一条算** —— 本轮 1293 帧两条片子只花了"给一个已有页面补真指针 + 一支浏览器验收"的钱。

## 三·127、第 127 轮（A 类仍空，B 按分数取 [029]：飞岛飞行镇）

**本轮实收口（1 组 / 1 条 = [029] 组内唯一 partial）**：`1313837640366596096`（315 帧 / 33.23fps / 9.48s）"You can now build flying towns (if you find any of the perfect loops…)" **→ done**。

- 核实先于动手：旧 note 三条「仍缺」→ 一条**过期**（建筑随岛抬升：`liftColumns` 本来就是整列抬）、
  一条**形制错**（「白色蝶形小构件」是把 4 片桨叶误读成两片小方板）、一条**本片不存在**（飞行操控：315 帧纯转台，无起飞/平移/悬停，也无操控轨迹）。
  这就是 r117 的「有没有 / 像不像」两问：前两问 grep 就有，第三问必须把关键帧放大到数得清笔画。
- 3× 裁切看到的三件原片事实（本轮据此改形制）：
  1. **腿不是细杆**：frame-0060 是**锥形柱 + 逐柱两条 45° 斜杆**（树根/马凳形），柱脚水面各一圈白涟漪（直径≈船壳宽 1/8）；
  2. **船壳三层**：亮黄鼓边带（带一排深色小方窗）+ 上沿一条**红舷缘** + 深灰楔形底，底部还套一圈**深灰格构桁架**（摇篮）；
  3. **外沿构件**：frame-0300 是**黄色短舱 + 4 片白色桨叶十字张开**（像小螺旋桨），沿船壳等弧长布点，同侧可见 3 个。
- 本轮改的四处（`src/world/flying-town-c06.js`，机制主线未动）：
  `hullSkin(poly,{y0,bandH,rimH,portholeEvery})` 沿环生成鼓边带/舷缘/舷窗（舷窗按**整圈弧长**布点 —— 逐边取模在 0.27 长的短边上一个都不出，第一版就踩了这个坑）；
  `propSlots(legs,2)` 每两根腿一个桨位（黄锥短舱 + 4 片桨叶，全 `InstancedMesh`）；`legBraces` 每腿两条斜撑；相邻腿之间一榀摇篮（下弦+上弦+斜撑）。
  另加可读面：`liftColumns(...,out)` 台账 `{columns,blocks,rocks}`、`parts{...}`、`propPositions/legPositions`、`setParts()` 做像素 A/B。
- 实测（新测 `tests/flying-town-c06-browser.cjs`，主场景 `index.html?flying=1`，不读日志）：
  环内 **474** 格、`moved 516 = 建筑 116 + 岩石 400`；腿 **56** / 斜撑 **112**（2×）/ 桨位 **28** / 桨叶 **112**（4×）/ 舷窗 **99** /
  鼓边带 **268** 三角 + 舷缘 **268** 三角 / 摇篮 56 榀 168 杆；鼓边带高 **0.42 = min(0.42, 0.45×船壳厚 1.2)**；
  整列抬升数据面：1–3 层全空、最低实心层 **4 = lift+1**、建筑体素全在 ≥6 层；
  像素 A/B（冻时间轴）：同状态噪声 **0 px**、关桨叶白像素 **2103 → 503**、黄短舱像素同步减少、开/关差分 **11670 px**；0 console error。
- 截图（均 ViewImage 看过）：`flying-town-r127-hull.png`（船壳近景：黄带 + 红舷缘 + 舷窗 + 白桨叶黄短舱 + 带斜撑腿）、
  `flying-town-r127-props-off.png`（同机位关桨叶对照）、`flying-town-r127-wide.png`（全景：左半片悬空带腿群涟漪、右半片仍在原位）。
- **两项如实口径（造型差，不计缺口）**：① 船壳黄带上原片有横向板缝 + 一圈小铆钉，本仓没做；② 抬升后环边露出一圈岩层侧壁，比原片「草地直接压到黄带」厚一档。
- 回归：`node tests/flying-town-c06.mjs` **PASS**（11 腿 / 22 撑 / 6 桨位 / 24 桨叶 / 19 舷窗）；`node tests/loop-lift.mjs` PASS（326 断言不变）。
- 账：**done 104→105 / partial 144→143**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 128 轮）**：TOP 1–18 已全 ✔，继续按分数往后取 B 一组。
首选 **[051] 的 `821321422140309504` / `827215002448846848` 前先核 navribbon**（r102 判「模块不存在」，但 r124/r127 两次证明 `where` 会写假账，先 `ls src/** | grep -i ribbon` 再定）；
次选 **[047] 剩 `1205422438437273601`**（高拱龛墙厚侧壁 + 接 buildings.js）、**[055] `1579474420749725696`** 维持 C。
本轮新姿势（可复用）：**判「缺件」前先量两边的「件数」** —— 原片同侧 3 个桨位、4 片桨叶，本仓旧实现是「每腿一组两片小方板」；
把「构件是什么形状」拆成可数的量（桨叶数/斜撑数/舷窗数/带三角数）之后，形制差当场变成可改的清单，而不是一句「看不清」。

## 三·126、第 126 轮（A 类仍空，B 取 [050] 最后一条 partial：不规则三角底图）

**本轮实收口（1 组 / 1 条 = [050] 2/2 片全清）**：`1447496205282549761`（383 帧 / 9.506fps / 40.29s）"The base graph is just a humble irregular triangle grid" **→ done**。

- 核实先于动手：note 从第 56 批挂到 r125 都是同一句「完整软坡/河道/预制 tile 生成仍未覆盖，本批仅学习审核」。
  四张联系表逐格看过，画面只有三种状态反复切换：**完成岛 ↔ 纯白线底图 ↔ 带高度的线框**；
  0349–0382 的全岛长镜里白格线**越过岛体范围继续画在深色底上** —— 「岛长在这张网上」的硬证据。
  **本片没有房子、没有模块、没有预制 tile**（0349+ 全岛只有地形与植被）→ note 里那半句「预制 tile」在这条片子里根本不存在。
- 底图口径（0020 原尺寸 + 3× 裁切）：整张网**只有三角格**，但**大小不一**（同一行里既有小三角，也有拼掉一条横边后的大三角），
  左上有 1 格是四边格**被一条对角线切成两片**，轮廓是七/八边锯齿，顶点不在水平线上。
- 本轮补的是**页面入口**（真缺的那一层）：
  1. `grids.html` 新增 `?kind=tri|square|rhombi|mixed`、`?wire=1`（只画格线，深底白线 = 原片那种底图）、
     `?tri2=1`（四边格沿 pts[0]–pts[2] 一条对角线切两片）+ `gridLab.kindsReport`（格型 / 顶点共用 / Euler / 面积离散度 / 对角线数 / 切完的三角数）；
     两个开关也做成可点按钮。原来这页只能看填色格、也无法深链到某一种底图。
  2. `terrain-r55.html` 的 `grid` 参数原来只透传 `quad|mixed` → **三角底图上根本跑不了软坡/河道**；现在接受 `tri|hex`，
     `__r55` 台账加 `gridSides/cells/riverCells/riverReaches/riverMouths/land/levelCount/softTops`。
- 实测（新测 `tests/tri-base-graph-browser.cjs`，**19/19 PASS**）：mixed 三角化 331 格 = 176 三角 + 155 四边 → **486 三角**、
  **对角线 155 == 四边格 155**、面积 CV **0.4165**（0.2416–1.3988，5.79×）、V−E+F=1；纯三角对照组 486 格全 3 边、面积 CV **0**；
  `?grid=tri` 1944 格全三角、陆地 **576** 格 / **10** 层、河道 27 格 2 条、格线段 1625 / 576 陆地格 = **2.821**（与 r121 同口径）；
  r55 三角底图：软坡面 **36.4** vs 墙面 **211.8**（关软坡 0 / 215.4）、河道 **52** 格 2 条 **7** 口、湖 **6** 个 51 格、缓坡陡边 **118→91**、0 console error。
- **同一口径量两边**（洪水填充把格线围出的封闭区域当格，量面积与 P²/A）：原片 0020 = **136 格全三角**、面积 p10/p90 **287/592px（2.06×）**、
  P²/A p10–p90 **35.6–39.7**；本仓 mixed+tri2 = 311 格全三角、p10–p90 **35.1–66.8**（有细长三角）；本仓纯 tri = 254 格、**35.2–36.6**。
- **两项如实口径（不计缺口）**：① 本仓不规则底图的格子比原片更瘦长（P²/A 上到 66.8，原片只到 39.7）；
  ② 本仓大小差更大（CV 0.4165 / 5.79× vs 原片 2.06×，原片那份还含透视）—— 同是「不规则三角网」，造型差一档。
- 回归：`tests/grid-kinds-c08.mjs` **PASS**（hex 271 / square 961 / tri 1944 全 3 边、land 576）；`tests/grid-kinds-browser.cjs` **EXIT 0**。
- 截图（均 ViewImage 看过）：`tri-base-graph-mixed.png`（不规则底图三角化：深底白线、全三角、大小不一、锯齿轮廓）、
  `tri-base-graph-tri.png`（规则三角格对照组）、`tri-island-r126.png`（`?grid=tri` 的岛，白格线越出岛体）、
  `tri-soft-river-r126.png`（三角底图 + 连续软坡 + 河道分叉 + 跌水 + 6 个湖）。
- 账：**done 103→104 / partial 145→144**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 127 轮）**：TOP 1–18 全部 ✔，从第 19 名往后按分数取 B。首选 **[046]/[048]/[052] 已清**，
按 `next` 顺序挑 **`1313837640366596096`（飞岛：飞行操控状态机 + 船壳蝶形构件 + 抬升后侧壁分层）** —— 先
`grep -rn "island-flight\|flying\|liftIsland" src/ *.html` 判 A/B（`src/world/flying-town-c06.js` 已在，大概率又是「模块在只缺页面验收」）。
第 126 轮新姿势可复用：**判「note 里的缺口」前先把片子里的三种状态分开数** —— 本片 note 挂了几十轮的「预制 tile」，
全片 0349–0382 一个 tile 都没有；「软坡/河道」是真存在但不是缺（模块 + 页面入口都能跑），缺的只是入口那一层。

## 三·125、第 125 轮（A 类仍空，B 按分数取 [041] 最后一条 partial：环带邻接图）

**本轮实收口（1 组 / 1 条 = [041] 可收的 2/2 片全清，剩 1459 定案 C）**：`1490068909042642944`（427 帧 / 24.37fps / 17.5s）"Late night cryptic graph tweet" **→ done**。

- 核实先于动手：这条从第 116 轮起被写成「C 性质、别再排期」，理由是「颜色到底是根分支还是连通分量无法证」。
  实际机制早在 `src/core/graph-bands-c08.js`（r56 C08，**文件头署本片 ID**：`findBridges` 迭代 Tarjan / `twoEdgeComponents` / `bandedGraph` / `bfsLayers`）
  与 `graph-bands-c08.html`（极坐标网 + 12 放射线 + 72 刻度 + 中心外扩搜索 + 按环带上色）里，**只出了 node 测试 `tests/graph-bands-c08.mjs`，没有 `-browser.cjs`**
  —— 与 r121/r122/r123/r124 同型：不是 C，是「模块在 + node 测试绿 + 页面能开，没人从页面量过」。
- 本轮的办法不是继续猜语义，而是**同一口径量两边**（片子终帧 + 本仓渲染）：
  1. 终帧 0426 按色相分桶再做极坐标统计（掩码 s>0.35、v>0.42、1457px、质心 319.3/323.0）：
     蓝（色相 210–225°）**n=891，半径 p10 67 / p50 83 / p90 100px，命中 36/36 个 10° 扇区**；
     分桶一致率 **按半径 27.6% vs 按角度 18.6%** → 颜色是**半径（环带）**的函数，不是**角度（根分支扇区）**的函数。
     「颜色=根的第几个分支」当场否掉；「=连通分量」也不对（带间 4 根辐条彼此并行，单根不是真桥）。
  2. 3× 裁切东向带间缝：蓝带与品红带之间**只有 1 根边**跨越，该边两端点（橄榄色）空心圈**明显大于带内节点**；北向辐条顶端悬挂点同样放大
     → 节点半径编码「辐条端点/高度数」，本仓已按同规则两档（4.6 / 2.6）。
  3. 外圈短刻度线 ↔ 页面 12 放射线 + 72 刻度。
- 本轮只加读数/几何、不动机制：`window.graphBandsC08` 增 `geom{ox,oy,sc,R}` / `ticks` / `radialLines` / `hues` / `regionBands` / `bandMeans`
  （要按半径/角度分开量色相，先得知道圆心与尺度）。新测 `tests/graph-bands-c08-browser.cjs`。
- 实测（`tests/graph-bands-c08-browser.cjs`）：与模块真值**独立重算逐项一致** —— 节点 **462** / 边 **606** / 辐条 **16**（3 个带间 × 4 + 4 悬挂）/
  Tarjan 桥 **31** / 区域 **180·154·101·23 + 4×1** / BFS **22** 层；外伸悬挂 4 根全是单边桥、带间 12 根都不是桥（并行）；
  四条带均半径 **0.91 / 2.82 / 5.00 / 6.89**（悬挂带 8.13）递增、`regionBands=[2,3,1,0]` 区域→带单值；
  本仓渲染色相 青 1079（r 16–54）/ 蓝 5220（r 102–146）/ 品红 8713（r 191–241）**各 36/36 扇区**、蓝与品红径向量程不交叠（p10 191 > p90 146）；
  搜索态（`?t=0.45`）`searchK 10/22` 层 < 定稿 23 层、红 **1350** + 黄 **1695**px、冷色 **19**；换种子（`?seed=7`）462→**466** 节点仍 4 带；**0 console error**。
- 回归：`tests/graph-bands-c08.mjs` PASS（462 节点 / 区域 180·154·101·23 / 桥 31 / 22 层）、`tests/graph-layout.mjs` PASS（七项口径不变）。
- 截图（均 ViewImage 看过）：`graph-bands-c08-final.png`（青中心 + 蓝 + 品红 + 黄外环、4 根辐条带悬挂、极坐标网与刻度）、
  `graph-bands-c08-search.png`（10/22 层：黄环前沿 + 4 根辐条外端红段、其余浅灰）。
- **三项如实口径（不计缺口）**：① 原片每条环带是 **2–3 格厚**的三角化条带，本仓按半径分数切、**1 格厚**（带内 r 跨度 2.10–3.46）—— 造型差；
  ② 原片搜索前沿是贴中心的紧凑环，本仓 BFS 沿 4 根长辐条会「一步跳一层」，红色因此落在辐条外端；
  ③ 颜色口径**不要**写成「2-边连通分量」（全图 31 根真桥里只有 4 根是外伸悬挂边），页面写的是「切掉带间辐条后的区域」，与原片观感一致。
- 账：**done 102→103 / partial 146→145**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 126 轮）**：

1. TOP 表 1–18 现在**全部 ✔**（[041] 是最后一个部分收口），下一轮从第 19 名往后按分数取 B。首选 **[050] `1447496205282549761`**（完整软坡/河道/预制 tile，生成器级，整一轮）——
   先 `grep -rn "softSlope\|riverChannel\|prefabTile" src/ *.html` 判「模块在只缺验收」还是真缺。
2. **本轮新姿势（第五条便宜 done 规律）**：被判成「语义不可证 → C」的条目，先做一次**同一口径量两边**（片子终帧像素 + 本仓渲染），
   能用数说清就别标 C。r116 那次「3× 放大仍无法区分分支/分量」是**只看画面**，本轮加了「按半径/角度分桶的一致率」就一句话破了。
3. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码；判 A/B 时顺手 `grep tests/ -l "<批次>"` 看有没有 `-browser.cjs`。

## 三·124、第 124 轮（A 类仍空，B 按分数取 [046] 唯一剩余 partial：不规则网格 3D 等值面）

**本轮实收口（1 组 / 1 条 = 组内 2/2 partial 片全清）**：`1163836000688365571`（353 帧 / 9.68fps / 35.52s）"Basic marching cubes on my funky grid" **→ done**。

- 核实先于动手：`where` 写着「src/core/contour.js（2D marching squares）· contour.html；**缺 src/core/ 下 3D 等值面模块**」，
  note 连着记了几轮「缺 3D 256 情形查表 + 顶点焊接 + 生长动画」。实际情况是**过期账**：
  `src/core/marching-cubes.js` 是第 56 批 C06 建的，**文件头第一行就署了本片 ID** ——
  做法是「每格 × 每层当不规则棱柱，对每个面从体外看逆时针走一圈，外→内记『进』、内→外记『出』，每段连续内部角点出一条进→出线段」，
  等价于带面歧义规则的 marching cubes，**不需要 256 表**；交点按「顶点 id + 层」做边键**全局焊接**，插值走规范顺序 → 相邻格算出同一个点。
  `marching-cubes.html?mode=cubes|slab` 与 node 测试 `tests/marching-cubes-c06.mjs` 也都在，**只缺浏览器验收**（与 r111/r120/r121/r122/r123 同型）。
- 本轮真改的三处（都不改机制）：
  1. 页面加 `window.marchReview.mesh()` 几何探针（等值面顶点/索引 + 本网格格角 xz + 各层 y）：原来只吐三角数/体积，测试没法逐点对账「面只在格边上」；
  2. 页面加**表面三角剖分边线层**（`?edges=0` 关）：片子实体表面一直叠着更深的剖分线，原来页面只有平色块 —— 这是「像不像」那问（r117 的两问法）；
  3. 模块返 `vertexKinds`（1=格边真实交点 / 0=环扇形三角化补的中心点）与 `fanCenters`：长环扇形三角化会补一个内部中心点，它本来就不在格边上。
     第一版没区分 → 726 个顶点被判成「偏离格边，最大 0.385」，补上类别后偏离归零、node 测试前后同一结果（零行为变化）。
- 实测（`tests/marching-cubes-browser.cjs`）：cubes 634 格 × 5 层 / 实心角点 420 → **3716 三角 / 1832 顶点**（verts÷tris **0.493**，
  非索引口径本该 11148 → 共享交点确实焊成一个点）、涉及 1038 个格层；`closed` / 边界边 **0** / 非流形 **0** / 有符号体积 **+47.885**（法向朝外）；
  **交点 1106 个全部落在格边**（604 落到层高平面 + 502 落到竖边，偏离 **0**）；
  闭合壳 **V−E+F = −26 → genus 14**，即整块实体上有 14 条可穿透隧道 —— 片子里那些能看穿的拱洞；
  朝下（n_y<−0.85）的面落在 **13 个不同层高** → 底面是阶梯，不是一块平底；
  生长 t=0.02/0.15/0.35/0.60/0.85/1 → k 8/63/147/252/357/420、三角 **104→656→1316→2264→3164→3716**、体积 **0.362→47.885**，每档闭合、单调不减；
  像素 A/B：空场（420 角点全灭）**红 0 px** → 满场 **152226 px**，同状态两帧噪声 **0 px**；
  slab：72 格 / 672 三角 / **竖墙 120 + 水平盖 552 + 斜面 0** / 板厚 0.46−0.01 = **0.45 = levelHeight** / 体积 30.342 / 0 console error。
- 回归（模块只加字段）：`tests/marching-cubes-c06.mjs` **PASS**，前后同结果 `{"frames":12,"slabTris":776,"slabVol":18.634}`。
- 截图（均 ViewImage 看过）：`march-cubes-cubes-t1.png`（红实体 + 表面剖分线 + 底网不规则四边格 + 多处拱洞，读数 3716 三角/1832 顶点/体积 47.89）、
  `march-cubes-cubes-t035.png`（147/420 只长出右半边，1316 三角/体积 15.37，对应片中 0100 附近中途态）、
  `march-cubes-empty.png`（0/420、0 三角、只剩裸网格，A/B 对照帧）、`march-cubes-slab-t1.png`（深蓝灰厚板：侧壁竖直、顶面平、边缘顺区域四边格切）。
- **两项如实口径（不计缺口）**：① 原片左侧有个**编辑器光标 gizmo**（0100 帧左中红方框 + 绿箭头），本仓页面没有，属编辑器交互；
  ② 本仓生长场 `growthOrder` 是本地确定性程序，团块比原片更胖，原片生长手法未公开 —— 造型差，不是机制缺。
- 账：**done 101→102 / partial 147→146**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 125 轮）**：

1. **[041] 只剩 `1490068909042642944`**（`graph-layout.js` 的 `radialLayout/adjacencyComponents` 已在，note 卡「颜色=根分支还是连通分量」「极坐标刻度」）—— 先 grep + 看帧再判 A/B/C，
   很可能同型：机制在、只缺页面读数；判不动就直接标 C（r116 的教训：挂三轮的"不可证"先放大帧再定）。
2. **[050] `1447496205282549761`** 完整软坡/河道/预制 tile 是生成器级，整一轮；[041] `1459169210752507904`（补丁级刚性，族向 relax 已试错，别重试）与 [055] `1579474420749725696` 维持 C。
3. 便宜 done 的通用姿势：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。**本轮新加两条**：
   `data.js` 的 `where` 写「缺 src/x 模块」时先 `ls src/**` 再信它（r56 那批「新建模块 + node 测试 + 留页面」的活儿留了大量这种假账）；
   **`?still` 这类布尔参数必须写值**（`&still=1`）—— `&still` 是空串 → falsy，相机仍在转，同状态两帧差分 3.8 万 px 的"噪声"其实是转镜。

> 规律（第 124 轮补一条）：**`where`/`note` 是账，不是事实** —— 本轮 `where` 直接写「缺 src/core/ 下 3D 等值面模块」，而那个模块就是 r56 为本片建的、
> 文件头还署了本片 ID。判 A/B 的第一步永远是 `ls src/**` + `grep 片 ID`，不要照着 note 去"新建"一遍已经有了的东西。

## 三·123、第 123 轮（A 类仍空，B 按分数取 [056]：拱券楔石/净空 + 任意塔基全局楼层线）

**本轮实收口（1 组 / 2 条 = 组内全清）**：`806904557502464000`（123 帧 / 10.08fps / 12.20s）与 `802496920790777856`（292 帧 / 7.09fps / 41.20s）**两条一并 → done**。

- 核实先于动手：两条的 `note` 是**同一句话**「楔石/完整桥构仍缺」，从 r56 挂到 r122。grep + Read 下来机制都在：
  - `src/build/canal-bridge-r56.js`（r56 C05·C，**文件头直接署了两条片子的 ID**）：`canalBridgeAxis`（桥格判定）/`canalArchParams`（矢高 ≤ 压顶下沿 − 一圈楔石）/`quayProfile`（与 plinth 同一组外鼓 rows）/`canalBridgeFace`（桥台 + 拱上三角墙 + 压顶红带 + `archVoussoirs` 楔石环 + 键石 + 拱腹条带 + 拱下净空），`buildings.js:117` 一句话接管该面基座，`app.js ?canalBridges=1` 是入口。
  - 拱券本体在 `src/core/arch-profile.js`：`archVoussoirs`（等椭圆参数角布楔石、法向外推、奇数块才有居中键石）+ `measureArch`（接缝间隙/重叠/长宽比/净空）。
  - 「任意塔基的全局楼层线」在 `src/core/arch-floor-budget.js`：`archFloorBudget({base,floor,storey})` 从**实际楼层**算 crown=base−slab、spring=floor，`buildings.js:474` 每个悬空段都走它，`fine-portals.js`/`navgraph.js` 同源。
  - 缺的只是**页面运行验收**（与 r111/r120/r121/r122 同型：只出 node 测试 `openings-c05c-r56.mjs`，没有 `-browser.cjs`）。
- 本轮补的两件：
  1. `openings-r56.html` 新增 `window.r56bridgeProbe(k)`：**不读日志**，直接遍历 `worldMesh.geometry` 的 position/color，把三角重心换算成开口面的 (s, y, 出面距) 后分类 —— 楔石环（`K.frame` 近白，色和 >1.8）、键石（`K.stoneDark`，色和 <0.62）、拱腹（两面对穿、拱顶以下的 stoneDark 条带）；再沿水流轴从本面外 0.35 打一条 Möller–Trumbore 射线量「拱下通不通」。关掉开关后 `recs` 为空，用上一次记下的同一格同一面继续量 → 真正的 A/B。
  2. 新测 `tests/canal-bridge-keystone-browser.cjs`（运河 + fusion 两遍加载）。
- 实测（运河，quad，两座桥）：每面 **wedges 9 / vault 12**（仅迎水面）；按真实三角数 **ringTris 16（8 块浅色楔石）+ keyTris 2（键石）= 18 = 9 块**，
  键石重心 **s = 0.478**（拱顶）、keyY = crown+0.012…0.024、环脚 s **0.064–0.089 与 0.889–0.929** 两端都到、环顶 **0.2075/0.2582/0.3154/0.385 < 压顶下沿 0.445**；
  拱下首交 **0.7491 / 1.1378 / 1.6773 / 1.8084**，同一射线抬到压顶下 0.085 处必被桥体挡住 **0.348**（下通上实）；
  关开关同一格同一面：**ringTotal 0 / keyTris 0 / 首交 0.3327 ≈ 墙体 0.3494**（实心码头）；
  像素 A/B **61480px / 同状态噪声 0 / 变化重心 (444.9, 215.2) 且 nearShare 1**。
- 「任意塔基楼层线」实测：fusion 3 座拱落在 **level 4（base 1.5 / floor 1）与 level 6（base 2.5 / floor 2）**，`crown = base − slab` 误差 <1e-9、`spring ≥ floor`、`corniceContinuous` 全 true、
  **6 个开口面 × 9 = 54 块楔石、每面恰好 1 块键石、环顶 ≤ base**；运河场景悬空楼体拱 cell 560 / level 4 / **floor 0（真悬空，不靠下层楼板）** → crown 1.45 / spring 1.05 / rise 0.4、2 面 18 块楔石 2 块键石。
- 回归（未改 `src/`，只改页面 + 新测）：`openings-c05c-r56.mjs`（canal bridges 2 / niches 4 / openings 121）、`arch-voussoirs.mjs`（arches 18 / wedges 216 / keys 24）、`arch-profile.mjs`、`arch-floor-budget.mjs`、`opening-pierce.mjs`、`pierce-lintel.mjs`（arches 17 / lintel 1534）、`church-niche-browser.cjs`（同页面回归未被本轮改动打断）全 PASS。
- 截图（均 ViewImage 看过）：`canal-bridge-keystone-quad.png`（+`-bright.png` 3× 提亮裁切：渠内隧道正对桥拱，两面拱圈/拱腹/水面）、`canal-bridge-keystone-quad-off.png`（+`-off-bright.png`：同机位关开关，拱洞整块消失）、`canal-arch-keystone-canal.png`（跨渠悬空楼体大拱：浅色楔石环 + 顶部更深键石 + 拱下净空，洞后还是水渠那座小拱）。
- **一项如实口径（不计缺口）**：① 原片拱跨约 1.5–2 格、桥面更厚，本仓按 `k=0.38·面宽` 出拱（span 0.27–0.52），压顶下沿固定留 0.055 给楔石圈；原片拱圈是灰石配深缝、本仓用近白环 + 深灰键石 —— 尺度/配色差。② `underside` 只在「本格对边都有下层支撑」时出拱，**跨两格同时架空会退化为平底 + 钢架**（本片能数清的拱洞都是一格宽 + 两侧墩，与现有判定一致）—— 机制边界单列，不记在本条。
- 账：**done 99→101 / partial 149→147**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 124 轮）**：

1. TOP 表 1–18 现在**全是「已收口 / 部分收口」**，没有裸 A 组了；剩下的都是组内个别片。按「一条缺口 → 多条 done」的性价比，先吃 `[041]` 的 `1490068909042642944`（颜色=分支还是分量不可证）—— 但先按老规矩 grep 一遍再判 A/B/C，很可能又是「模块在只缺验收」。
2. ~~`[046]` 只剩 `1163836000688365571`（3D marching cubes，本仓只有 2D marching squares，要新建 256 情形查表 + 顶点焊接 + 页面入口，一整轮）~~ —— **第 124 轮已收口**：模块 r56 C06 就在（`src/core/marching-cubes.js`，文件头署本片 ID）、页面与 node 测试都在，缺的只是浏览器验收；
   `[050]` 只剩 `1447496205282549761`（完整软坡/河道/预制 tile，生成器级）；`[055]` 的 `1579474420749725696` 与 `[041]` 的 `1459169210752507904`（补丁级刚性）建议维持 C，不再排。
3. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。**本轮第四次命中「页面提示语就是假账」的反向版**：两条片子的 note 是同一句、同批只出 node 测试，
   → 以后看到「同一批 `<批次>.mjs` 但没有 `-browser.cjs`」，先当 0.5 轮能翻的便宜 done 排。

## 三·122、第 122 轮（A 类仍空，B 按分数取 [055]：笼形变 —— 壁面内部插值 + 形变后 3D 碰撞）

**本轮实收口（1 组 / 2 条里的 1 条）**：`1579478470098243584`（272 帧 / 16.575fps / 16.41s）"radical cage deformation on the cells" **→ done**；同组 `1579474420749725696` 维持 partial（C）。

- 核实先于动手：这条的 `note` 从 r55 起就挂着「完整原cage/3D碰撞仍缺」，`where` 指向 `shape.js / terrainmesh.js / cage.html`。grep 下来**机制全在**：
  `src/terrain/cage-c09.js`（r56 C09-D，**文件头就署了本片 ID**）里有 `cageWallPoint`（壁面内部任意 (u,v) 点）、
  `cageSlice`（连续层截面）、`insideCage`（3D 包含）、`cageCollider`（`wallsAt/cellAt/solid/wallDistance/pushOut`——形变后的精确碰撞）。
  但 `tests/` 里只有 `c09-terrain-d.mjs` 这一支 node 测试，**没有任何浏览器验收**；`cage.html` 的提示语还写着
  「未实现任意扭曲壁面内部插值/形变后精确碰撞」——**页面提示语又变成假账**（r114 同型，本轮第二次踩到）。
- 本轮补的两件：
  1. `cage.html` 新增「笼碰撞探针」：把 `cageWallPoint` 的采样点与 terrainmesh **实际发出的墙四边形**在 5×3 网格上逐点对账，
     并把塞进岩石 0.08 的探针用 `cageCollider.pushOut` 推出来（红=原位置陷在岩里、绿=推出位置、青点=壁面采样），
     读数进 `#probeStatus` 与 `window.cageProbe`。层高不是猜的：从 `world.terrainSurface.walls` 里取**本格真实存在的暴露层**再按滑杆挑一段
     （第一版按 `ground×(0.25+0.5f)` 猜层号 → 高崖顶格那一层根本没有暴露墙，当场报「该格在层 6 没有暴露墙」）。
  2. 新测 `tests/cage-deform-browser.cjs`（mixed/quad 双网格 + 成片时间结构）。
- 实测：`[mixed]` 格 1310 层 10 y=4.75 · 暴露墙 3 · 壁面点 45 **最大偏差 0** · 截面 3 角 · 弯曲 **0.0664**；
  探针 笼内=true → 推出后 `inside=false` 余量 **0.15 = r** 接触 1 · terrain-collide 认同（inside=false 余量 0.15）。
  `[quad]` 格 1306 同层、4 角、弯曲 0.0661，其余一致。
- `?mode=cage` 的时间结构对上了片子：阶段 **wire → hold → color**，线框累积 **153 → 4755 → 11235 → 12970**（稀疏长满、单调），
  刚着色时 `overlay=true`（笼线还叠着）→ 末尾 `overlay=false`（线退掉），转镜 yaw **0.9148 → 1.7596 → 2.5516**。
  对照原片：0000–0070 线框（0021 重置一次）→ 0071 着色叠线 → 0200+ 线退掉只剩着色岛转镜。
- 回归：`tests/c09-terrain-d.mjs` PASS（C 段 360/360 壁面点、maxDev 4.44e-16、pushOut 60/60、agree 60/60、弯曲角点 1352/1254）；
  `tests/cage-browser.cjs` PASS（count 404 / error 3.9e-16 / geometryError 0 / 滑杆不重建地形）。
- 截图（均 ViewImage 看过）：`cage-deform-mixed-probe.png` / `-quad-probe.png`（近景：笼线明显弯、青点沿墙排一行、红球在崖壁里绿球被推到墙外）、
  `cage-deform-mixed-page.png`（页面读数）、`cage-deform-reel-wire-mid.png`（只有格笼线框、地形藏掉）、`-color-overlay.png`（着色叠线）、`-color-end.png`（线已退）。
- **一项如实口径（不计缺口）**：原片说 "pretty radical"，本仓 `shape.js` 的形变顶点水平位移量级只有 **0.066**，视觉上比原片保守；
  原片没公布公式（README 第 77 行只有那一句），强度只能由现有分层平滑/崖顶收分给 —— 属美术强度差，不记机制缺口。
- 账：**done 98→99 / partial 150→149**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 123 轮）**：

1. **[056]（1.33，2 条 partial + 2 条 ref）**：拱券楔石/净空与「任意塔基的全局楼层线」，`where` 写「静态部分映射」—— 先 grep `keystone` / `floorLine` / `arch` 再判 A/B，大概率又是「模块在、只缺页面验收」。
2. **[041] 剩两条**：`1459` 补丁级族向约束（要动生成器，r116 试过族向 relax 反而升到 45°，别再重试同一想法）；`1490` 建议直接标成定案。
3. `[055]` 只剩 `1579474420749725696`（两座岛生成），原片只写 "I'm back on the island generation"、算法未公开 → **C，不排**。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。**新加一条（本轮第三次命中）**：判 A/B 前先读一遍目标页面的提示语 ——
   写着「未实现 X」的，很可能 X 早就在，只是没人从页面点过（r114 单位软影、r117 教堂龛、r122 笼碰撞都是这句）。

> 规律（第 122 轮补一条）：**「同一批只出了 node 测试」是旧账的稳定来源** —— [054] 的 C08/C09、[053] 的半边、本轮的 C09-D 全是
> 「新建模块 + node 测试 + 留了页面」却没有 `-browser.cjs`，于是 data.js 一直 partial。所以 `tests/` 里有 `<批次>.mjs` 而无
> 对应 `-browser.cjs` 的，基本就是 0.5 轮能翻的便宜 done，优先吃。

## 三·121、第 121 轮（A 类仍空，B 按分数取 [054]：三档纯格型岛 + 每种子都出好岛）

**本轮实收口（1 组 / 2 条 = 组内全清）**：`1670790425232175108`（610 帧 / 21.63fps）与 `1669315384619540487`（649 帧 / 21.21fps）**两条一并 → done**。

- 核实先于动手，两条 note 的「仍缺」都被 grep 推翻：
  - `1670`「独立六边地形/原模块仍缺」→ `src/core/grid-kinds-c08.js`（r56 C08，文件头署本片 ID）已有 `PURE_GRIDS`（**共享** `buildHexGrid` / `buildSquareGrid` / `buildMixedGrid mergeRate 0`，不是第二份生成器）+ `src/world/app.js:40` 一行挂钩 `?grid=hex|square|tri`，`buildSceneBar()` 把 `GRIDS` 全表铺成网格按钮 → 页面入口就是主场景页。
  - `1669`「完整软坡/模块联合生成和原美术质量仍待补」→ `src/terrain/island-quality-c09.js`（r56 C09-C，文件头署本片 ID：`islandReport` 六组量 / `ISLAND_RULES` / `consistentIsland` 派生种子重生 / `pruneIslets`）+ 连播页 `islands-c09.html`（sea → shore → silhouette → full → 自动转台）。
  - **两条的共同病因**：那两批（C08 / C09）只出了 node 级测试，**没有一支从页面跑出来的运行验收**，所以 data.js 一直停在旧账。这与 r111/r113/r117/r119/r120 是同一型，只是这次一次撞上两条。
- 新测 `tests/grid-kinds-hex-island-browser.cjs`（15 项）：晶格类型用**几何判据**而不是名字 —— 顶点最多被 **3（六边）/ 4（方）/ 6（三角）** 格共用，V−E+F 全 = 1，半边互反违例 0/1512·0/3720·0/5724；
  同一地形管线出岛：陆地 95/271 + **6 层台地**、372/961 + 8 层、576/1944 + 10 层，渲染 tris 27.9–40.1 万；
  **格线层跟着晶格走**：唯一格线段 ÷ 陆地格 = **8.284 / 4.126 / 2.821**（三档互不相同，这条能一句话否掉「格线画的是同一套方格」）；页面内点「纯方格」换网格后 `scene=terrain` 不丢。
- 新测 `tests/island-quality-consistent-browser.cjs`（7 项）：默认开体检连播 4 座 **每座 cool=true / failed=[]**、tries 2,1,1,2（派生种子只在必要时介入）；
  **反向对照**：关掉体检（`?consistent=0`）扫 8 个种子 → **2/8 不合格**（seed1 `landFrac,mainFrac,cliffs`、seed4 `mainFrac`）—— 否则「consistently」只是句话；shoreSegments 152/180/138/152；
  四阶段可见对象 **5（只留海面，mesh 1）→ 6（+岸线）→ 18（`overrideMaterial=黑`）→ 22（mesh 6）**。
- 回归（未改 `src/`）：`grid-kinds-c08.mjs`、`grid-hex-stats.mjs`、`grid-kinds-browser.cjs`、`c09-terrain-c.mjs` 全 PASS（islands quad/mixed 各 16 种子 rawCool 13→cool 16、avgTries 1.19）。
- **一项如实口径（不计缺口）**：原片六边岛是**软坡 + 六棱柱体素**，本仓走**台地阶 + 白色格线**；岛型也普遍比原片**宽平**、没有美术级小屋群。两片原文的主张分别是「生成器也输出纯三角/六边/方格」与「consistently 出好岛」，都不含美术 —— 机制侧由上面的可读量钉住，美术差单列不记缺口。
- 账：**done 96→98 / partial 152→150**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 122 轮）**：

1. **[055]（1.33，2 条）**：`1579478470098243584` 笼形变（`src/terrain/cage-c09.js` + `cage.html` 都在，先按「扭曲壁面内部 / 形变后碰撞」逐条 grep 再判 A/B）；`1579474420749725696` 原片算法未公开，大概率只能挂 C。
2. **[056]（1.33，2 条 partial + 2 条 ref）**：拱券楔石/净空与任意塔基全局楼层线，`where` 写「静态部分映射」—— 先核 `keystone`/`floorLine` 是否又是过期 note。
3. **[041] 剩两条**：`1459` 要动生成器（补丁级族向约束，r116 已试过一种错法，别再重试）；`1490` 建议直接标定案。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。**新加一条：先看那批的收尾文档（`artifacts/coverage/r56-*.md`）里有没有「判定 done」的记录** —— 有判定却没记账的，就是纯运行验收活。

> 规律（第 121 轮补一条）：**「模块在 + node 测试绿 + 页面能开」仍然不等于 done** —— [054] 两条都栽在同一处：C08/C09 两批各自写了模块、写了 node 测试、留了页面，
> 但都没写**浏览器验收**，于是 `data.js` 里这两条挂了 60 多轮「仍缺」。所以判 A/B 时除了 grep 模块名，还要 grep `tests/` 里有没有 `-browser.cjs`；
> 没有的，先补齐运行验收再谈收口。另一条：**「consistently」这类质量话术必须配反向对照** —— 只有证明了「不当心的时候确实会出烂岛」（本轮 2/8），
> 前面的「每座都好」才有意义。

## 三·120、第 120 轮（A 类仍空，B 按分数取 [053]：三角图局部编辑 + 显式半边环/扇）

**本轮实收口（1 组 / 2 条 = 组内全清）**：`1677242779162877952`（279 帧 / 9.92fps）与 `1458921394855718917`（511 帧 / 6.92fps）**两条一并 → done**。

- 核实先于动手：两条 note 的缺口都是同一个说法 —— 「局部编辑接口待补」/「显式半边环、扇及编辑接口待补」。grep 下来两件**全在**：
  `src/core/trigraph-edit-c08.js`（文件头署 1677 本片 ID：`addTracked` 插点返回新增/删除边差分、`removeVertex` 星形环耳切重三角 + Lawson、`moveVertex` 删+插失败用 `clone` 回滚、`checkLive` 排除已删点的同口径体检）、
  `src/core/halfedge.js`（`buildHalfEdge` 的 next/prev/twin、`boundaryLoops`、`vertexFan`、`euler`、`splitQuads` 面分割编辑）+ `halfedge-patch-c08.js`（文件头署 1458 本片 ID：撒方块组 → 间隙三角半边追边界环 → 填充 → 合成网格）。
  缺的不是机制，是**页面运行验收**：`trigraph-c08.html` / `halfedge-c08.html` 都在，但 `data.js` 里前者仍是 r60 旧账、后者 `implementationVerified/runtimeAccepted` 一直是 false。
- 本轮真改的一处：`halfedge-c08.html` 之前只有「播放 / 换种子」，**编辑接口在页面上无处可点** → 加「切四边形」按钮 + `?split=<share>`：
  `splitQuads` 把四边格沿对角线切两三角 → 重建半边 → 报 半边数 / 边界环 / Euler / 一致性错误 / **面积 Δ**，切出的三角染橙；`window.halfedgeC08` 一并暴露 `splitCells/splitEdges/splitEuler/splitLoops/splitErrors/splitAreaDelta`。
- 新测 `tests/halfedge-c08-browser.cjs`：`?t=1.9` → `groups 13 / quads 51 / tris 386 / loops 14 / errors 0`（阶段「追环」真画出来）；
  `?t=3.2` → `euler 1 / fullLoops 1 / missing 0`；点「切四边形」→ **四边格 51 → 切出三角 46 = 2×23 条切缝**、`splitEuler 1 / splitLoops 1 / splitErrors 0 / 面积 Δ 0`；
  换种子 → seed 2、`quads 42 / splitEdges 17`、编辑状态跟着重建；0 console error。
- 新测 `tests/trigraph-c08-browser.cjs`：200 步增量插点 → `verts 200 / tris 385 / 本步染色边 33`、**全查 401 面** `流形 ✓ / Delaunay ✓ / 退化 0 / full true`；
  「删 5 点」→ `tris 375` 仍 ✓（孤立点已排除）；「移 5 点」→ 活跃点 195 仍 ✓；0 console error。
- 回归（未改 `src/`，只确认旧口径没破）：`trigraph.mjs` PASS（450 次增量全查 + 坏输入不改对象）、`trigraph-ops.mjs` PASS（`{tris:222, legalizeFlips:1}`）、
  `trigraph-edit-c08.mjs` PASS（`{verts:330, removed:90, tris:466, avgNewEdgesPerInsert:5.96}`）、`halfedge.mjs` PASS（`quad {V:503,E:968,F:466,split:234}` / `mixed {V:217,E:483,F:267,split:55}`）、`halfedge-patch-c08.mjs` PASS。
- 截图 `artifacts/coverage/halfedge-c08-loops.png` / `-mesh.png` / `-split.png`、`trigraph-c08-insert.png` / `-delete.png` 均 ViewImage 核过（切四边形那张能直接看到对角线把方格切成两个橙三角）。
- 一项如实口径：原片把相邻方块组的轮廓并进同一条环、按剩余区域配色；本仓 `gapLoops` 追的是间隙三角网的边界 → **圆 1 + 各块轮廓 13 = 14 环**，颜色按环序号轮转。
  语义相同（每个未被占住区域一圈），合并粒度/配色不同，不作为缺口。
- 账：**done 94→96 / partial 154→152**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 121 轮）**：

1. **[054]（1.33，2 条）**：`1670790425232175108` 只差「独立纯六边地形/原模块」（本仓 `grids.html?t=kinds` 已有纯三角/纯方/混合三档），先 grep `hexOnly|pureHex` 判是「缺一档输出」还是「缺整套 World」；`1669315384619540487` 是完整软坡/模块联合生成，同 [050] 那条一个量级。
2. **[055]（1.33）**：`1579478470098243584` 笼形变（`src/terrain/cage-c09.js` + `cage.html` 都在）值得先核；`1579474420749725696` 挂 C（原片算法未公开），大概率吃不动。
3. **[056]（1.33，2 条）**：拱券楔石/净空与任意塔基全局楼层线，`where` 写的是「静态部分映射」，先核实是否又是过期 note。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 120 轮补一条）：**同一句缺口会在同一组的几条片子里复写** —— [053] 两条 790 帧挂的是同一件「局部编辑接口」，
> 而它已经在 r56 C08 落过码、只是没人从页面点过一次。所以「组内几条 note 说法雷同时，先当一条缺口处理」，收益是 2 条 done。

## 三·118、第 118 轮（A 类仍空，B 按分数取 [052]：球面极点鲁棒性）

**本轮实收口（1 组 / 2 条 = 组内全清）**：`1338829205157646336`（316 帧 / 28.86fps）与 `1338825080844021760`（395 帧 / 24.94fps）**两条一并 → done**。

- 核实先于动手：这一组两条共用**同一句 note**（711 帧两片合核），缺口写的是「原投影往返 / 动态重三角化与完整视觉仍待补」。
  逐条 grep 下来 —— 三项**全都已实现**：`liftToSphere` 返回 `roundTrip`（实测 1.06e-15）、`relaxRetriangulate` 每轮整体重三角化并报改边数（18→4→1→2→0…）、
  `planet.html?stages=1` 用 `buildSphere({history:true})` 的**真快照**走完 1–4 阶段、`sphere-insert.html` 把平面插入过程连超级三角/半径/往返/改边一起读出来。
- **真缺的是组标题里的第三件：极点鲁棒性。** 旧路径把极点固定成「最北点」、不做任何角距检查：
  极点上有重合点时 `stereoProject` 直接 `RangeError`（1−p.y<1e-12）；次北点离极点 1e-4 rad 时 r=cot(θ/2)≈**2.00e4**，超级三角 bound 跟着到 2.30e4，
  Bowyer–Watson 的「坏三角」判定退化成巨型薄三角。
- 本轮新增 `stereo-insert-c06.js#poleGuard(points,{minSin,topK,mergeSin,maxTilt})`：① 极点仍优先取最北点，最小角距 sinθ<1e-3 时在次北 topK 点里挑**角距最大的**当极点
  （限 tilt≤0.7 rad，保住「vertical ≈ radial」的排序语义）；② `basisFor()` 用 `z=x×axis` 造坐标架，**det(R)=+1 是真旋转不镜像**（镜像会翻三角朝向、外接圆判据直接反）；
  ③ 落在极点方向上的、互相重合的点合并、不参与三角化（否则退化成零面积三角），`merged[]` 记 into/why；④ `liftToSphere` 用 `Rᵀ` 反旋后再比原点，`roundTrip` 仍是同一个几何量。
- 实测：极点重合 → 旧路径 `RangeError`、守卫合并 1 点后参与三角化 118、maxR 6.532、F=234=2·119−4、Euler 2、孤点=被合并那个、往返 1.06e-15；
  次北点 1e-4 rad → `rotated=true`、maxR **6.53**（收敛 **3.06e3×**）、minSin 0.2283、det(R)=**1.000000000000**、R·极点=(0,1,0)、F=236、闭合、往返 1.06e-15；
  **良态点集零影响**：`rotated=false / merged=0 / R=I`，`projectionOrder` 新旧**逐位一致**（前 100 多轮的旧账不受影响）。
- 新测 `tests/sphere-pole-guard.mjs`（三档夹具）+ `tests/sphere-insert-guard-browser.cjs`（运行验收）：良态 `?n=200&t=0.35` 抬回 **396 面 = 2n−4**、closed、Euler 2、
  往返 **1.17e-15**、插入进度 k **0→20→100→199**；`?n=200&t=1&fat=1`（次北点搬到最北点上）**合并 1**、198 点、**394 面**、Euler 2、`closedEff` true、孤点 1、bound **10.1** 不再爆、0 console error。
  截图 `artifacts/coverage/sphere-insert-guard-good.png` / `-fat.png` 均 ViewImage 核过（面板读数与画布一致：中心密/外圈连超级三角的长薄三角）。
- 回归：`sphere-insert-c06` PASS、`sphere-stages` PASS（18 项闭环审计 + 半径序映射）、`planet-town` PASS、`sphere-stages-browser` PASS（`?stage=tri|relaxed` 闭合 / faces 1796 / geometryError 0 / 平面抽查 60/60）。
- 一项如实纠错：本条片 0110–0290 那段「中心暗面 + 规则点阵 + 长扁三角」在缩略图里像个**空洞**（会被误判成「极点处网格塌陷/未三角化」）；
  按 3–4× 放大裁切数笔画后确认是**球体实体的遮挡**（暗面上没有三角连线、边界是直边+一段弧边），正是 `planet.html?stages=1` 那种「暗球 + 点 + 线框」的叠加。
- 账：**done 90→92 / partial 158→156**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 119 轮）**：

1. **[046]（1.33，2 条 partial）**：`1092709665199345664`（一次性爆炸编排 `explodeAt` + 焦痕贴片）、`1163836000688365571`（3D 等值面 marching cubes）——
   两条都是**真缺模块**，别当 A 吃；先 grep `effects.js` 的粒子池与 `contour.js` 的 2D 版，估一次「编排 vs 3D 查表」哪个能一轮做完，做不完就只吃 `1092`。
2. **[050]（1.33，2 条）**：`1447494168448753667` 只差「四子格联合模块约束 + 原 3Dtile」（对角四分/父格映射/共享 WFC 已在 `wfc.html?subtiles=1`）；
   `1447496205282549761` 差「完整软坡/河道/预制 tile」—— 后者是生成器级，建议只吃前者。
3. **[053]/[054]/[055]（各 1.33）**：都要动生成器（显式半边环 / 独立六边 World / 笼形变），成组排、别单条吃。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 118 轮补一条）：**一组多条片子共用同一句 note 时，先按「一条缺口 → 多条 done」算收益** —— [052] 两条 711 帧只挂一份缺口清单，
> 补一件小事（极点守卫）就翻两条，单条成本是 [046] 那类「真缺两个模块」的四分之一。另一条：**「缩略图里的空洞」要放大后再判** ——
> 中心那块暗面在 100 帧缩略图里完全像个网格塌陷，3–4× 裁切后才发现它是球体实体的遮挡（r116 的教训在球面片上同样成立）。

## 三·117、第 117 轮（A 类仍空，B 按分数取 [044]：教堂高拱龛 + 无限网格面积拉回）

**本轮实收口（1 组 / 2 条 = 组内全清）**：`1275089608758484992`（369 帧 / 30.83fps）与 `1302686201401442309`（241 帧 / 9.53fps）**两条一并 → done**。

- 核实先于动手：note 挂了轮的四条「仍缺」—— **接进 buildings.js / 页面第四栏 / 洞内墙面 / 台阶 —— 全在**：
  `src/build/church-niche-r56.js`（`nicheShape` 跨 2·3 层、`depth 0.12`、后墙 `NICHE_INNER=#5b86c4`、两级台阶落 `L+0.006`）、
  `buildings.js:330` `world.churchDoors ? churchNiches(...)` + 两层墙体走 `wallStrip(hole)`、`openings-r56.html?flags=churchDoors&focus=church`。
  竖梯同轮核实：`src/core/ladder-profile.js` → `navlayer.js:59` / `steel-r56.js:171` 早已在画，本片那条长竖梯即此口径。
- **本轮真改的是形制**：旧版后墙是「小拱门 + 圆窗」，与 3× 放大帧（0120/0160）对不上 → 重画成 **底部双开门+半圆扇窗（8 段玻璃 + 7 道辐射档）/ 中部四格方窗 + 十字档 + 窗台 / 顶部菱形窗（外白框 + 内玻璃）**，
  并在 `drawNiche` 返回 `backWall{doorFrom,doorTo,doorHalf,fanRadius,squareY,squareHalf,diamondY,diamondHalf}` 与 `steps{count,rise,run,top,base,halfWidth}` 作可观测量，`openings-r56.html` 的 `stats().church` 一并吐出来。
- 新测 `tests/church-niche-browser.cjs`：跨两层 `0.56→1.42`（深 0.12）、三处开口自下而上不重叠且都在龛内（`doorTo 0.77 < squareY−squareHalf`、`diamondY+diamondHalf ≤ top`）、扇窗半径==门半宽、台阶 2 级 `base=L+0.006`；
  同机位 A/B 关 `churchDoors`：**蓝色后墙像素 34505 → 0**、差分 **72256 px**、同状态噪声底 **2336**、0 console error。
  截图 `artifacts/coverage/church-niche-on.png` / `-off.png` 均 ViewImage 核过（开=跨两层拱龛+蓝后墙+三处开口+两级石阶；关=普通红墙+棕色方门）。
- 回归 `tests/openings-c05c-r56.mjs` PASS（canal bridges 2 / church niches 4 / openings 121，射线穿洞与「洞内无门窗」不破）。
- **一项如实纠错**：0300+ 联系表缩略图里那道「很高的尖拱」放大后是**高脚房的支撑腿**围出的空当，不是「龛被拉到 4–5 层」—— 本片龛就是跨两层，不存在「龛高跟墙高」。
- **第二条 `1302686201401442309`（无限网格松弛）同轮 → done**：上一轮记的唯一缺口是「把面积拉回点阵的松弛权重（14 格收缩到 0.46×）」。
  根因在 `grid.js#relaxPolygons`：拟合半径取「当前偏移的均值」，格一旦被邻格/边界挤小就**照着更小的半径继续拟合，面积只丢不还** —— 正是原片第二症状（邻格被拉长去补缺口）的对偶面。
  本轮加 `areaPull`（默认 **0.85**）：目标半径朝「与本格原始点阵面积相等的正 n 边形」拉 `R_want=√(2A_raw/(n·sin(2π/n)))`；外圈仍钉住 → 接缝不变。
  `areaPull:0` 逐位复现旧行为；`bugPatches` 演示块不施加（那是故意复现原片翻折 bug 的）；`createInfiniteStream` 同口径透传（**第一版漏传 → `infinite-stream.mjs` 当场报 0.0516 偏差**，已修）。
- 实测：收缩格 **27→0**、最小收缩比 **0.450→0.640**、最大拉伸 **1.83→1.52**、翻折 0、接缝 4e-15、块内面积守恒（patch 档）1e-15、blend 插值漂移 1.1–3.1%。
  新测 `tests/infinite-area-pull.mjs`；回归 `infinite-verify / infinite-window / infinite-stream / infinite-c06 / infinite-verify-browser / infinite-grid-view-browser` 全 PASS；
  页面 `grids.html?t=infinite` 读数 3946 格 / 翻折 0 / 1.52× / 0.64× / 378 组对照最大差 4.0e-15（改前 1.83× / 0.46×），截图 `artifacts/coverage/infinite-blend.png` 已 ViewImage 核过。
- 账：**done 88→90 / partial 160→158**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 118 轮）**：

1. **[046] / [050] / [052]（1.33）**：先 grep 落点再判 A/B —— 尤其 `explodeAt(point)`、四子格联合约束，很可能又是「已实现只缺验收」。
2. **[051] 剩 4 条**：2 条卡原片算法未公开、2 条卡 `navribbon` 模块不存在（要新建模块，整组一整轮）。
3. **[053] / [054] / [055]（1.33）**：都要动生成器（显式半边环 / 独立六边 World / 笼形变），成组排。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 117 轮补一条）：**note 里的「仍缺」连挂几轮后，往往一半已实现、另一半是「形制不对」而不是「机制没有」** ——
> 本轮四条缺口全是已实现，真正要改的是后墙开口的**形制**（圆窗→菱形窗、小拱门→双开门+扇窗）。判缺口时把「有没有」和「像不像」分开记，
> 前者靠 grep，后者只能靠把关键帧放大到能数清笔画（沿用 r116 的教训）。另一条：联系表缩略图会把**支撑腿围出的负空间**看成「更高的拱」，
> 任何「结构变高了」的结论都要回原尺寸确认一次。


## 三·116、第 116 轮（A 类仍空，B 按分数取 [041]：格子补丁着色）

**本轮结果：`1459169210752507904`「And another」仍 partial，但缺口清单被重写**（done 88→88，partial 160 未变）。

- 核实先于动手（这一轮核出的全是 note 自己的错）：r19 挂了三轮的三条「缺口」用 3× 放大裁切一帧帧看下来全不成立 ——
  ① 「格心彩色小块语义不可证」→ 格心**没有**色块，所谓紫/蓝/黄小方块是**补丁缝折线 + 三角带里的小三角边**；
  ② 「3D 透视视角」→ 全片各格尺寸一致、无遮挡，是**平面正视**（补丁各自转 0°/30°/60°）；
  ③ 「接 world 实景」→ 609 帧里没有任何建筑/地形/水面，原片根本没有这件事。
  **但真有一层一直没画**：每个四边格内部都画了两条**对角线 X**（原尺寸 0200 帧一眼可见），本轮补上。
- 本轮新增（真机制，非糊）`patchLayout(grid)`：四边格轴向吸附晶格三族 {0°,30°,60°}（松弛前实测正是 144/164/161 格三个方向）、
  补丁 = 同族共边连通块、补丁缝 = 两块补丁之间的边；`grid-graph.html?mode=patch` 按补丁着色 + 品红缝 + 绿填三角格 + 对角线，
  统计面暴露 `patchCount / largestPatch / maxSpreadDeg / families / patchEdgeKinds / triangleCells / diagonals`。
- **仍缺（所以不翻 done）**：原片每块补丁是一整片**朝向完全一致的刚性方格**（约 8 块、每块几十上百格），本仓聚出 **153 块（最大 34 格）**、
  逐格轴向抖动 max **14.99°**。根因：`latticeAndMerge` 的三族在 hex 拓扑里**按格交错**，逐格松弛又各自拟合正方形 →
  补丁级刚性是**生成器层的约束**，不是画法。本轮试过给 `relaxPolygons` 加族向约束（临时开关），抖动反而升到 45°（相邻格目标冲突），
  已回退、未留在代码里 —— 这条如实记下来，省得下轮重试同一个想法。
- 新测 `tests/grid-patch-families-browser.cjs`：469 四边格 = 60°:185 + 30°:154 + 0°:130、五类边之和 = 边总数、补丁 153/最大 34、
  缝 288 边、画布 品红 7698 px / 绿三角 2636 px / 色桶 157、换种子补丁 178 块、切回按面型仍橙>800 青>300。
  回归 `grid-wireframe.mjs`（357 格/41 条带）、`graph-layout.mjs`、`grid-graph-browser.cjs`（707 格/65 条带/26 环）全 PASS。
- 截图 `artifacts/coverage/grid-patch-families.png` 用 ViewImage 看过：颜色**逐格散布**而非成片，正是「补丁刚性缺失」的可视证据。

**下一轮建议（第 117 轮）**：

1. **[041] 只剩两条**：`1459169210752507904` 想吃就动生成器（补丁级族向约束，得一次改对，否则又是 45°）；
   `1490068909042642944` 卡「颜色=根分支还是连通分量不可证」，属 C 性质，建议直接标定案、别再排。
2. **[044] / [046] / [050] / [052]（1.33）**：先 grep 落点再判 A/B，别按 note 直接改码。
3. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 116 轮补一条）：**「语义不可证」有时不是算法没公开，而是看帧的分辨率不够** —— 本轮把 640×640 帧裁到 3× 才看清
> 格心根本没有色块、那些颜色属于补丁缝与三角带。判「不可证」之前先把关键帧放大到能数清笔画，再决定要不要挂 C。
> 反过来说：`next` 里挂了三轮的"缺口"如果一直没人验，很可能**三句话都是错的**，而真缺口是第四件没人写的小事（本轮=格内对角线）。

## 三·115、第 115 轮（A 类仍空，B 按分数取 [007] 整组：流场数据继承 + 主战斗连续流）

**本轮实收口（1 组 / 2 条）**：`902069261304287232`（389 帧）与 `901842167508992000`（571 帧）**两条一并 → done**。

- 核实先于动手：`where` 写的 `src/motion 流场` **目录根本不存在**（同 r102/r105 的过期名词型），真实落点是
  `src/badnorth/flowfield.js`（`buildLayeredFlowField`：`src` 沿父格继承 = 最近单位的兵种）+ `src/badnorth/battle.js`
  的 `#drawFlow`（`flowGrid` / `flowFaces` / `flowLines` / 散须 / `flowDim` / 图例）。`note` 里挂了几轮的三条「仍缺」里，
  「水面不画网」「崖壁要压暗」是 r68/r70 已撤销的误读，「每格代价色阶」r78 已否证 → 真正的缺口只剩 **continuousFlow 没进主战斗**。
- r76 的判定「`battle.js:190` 未传 `continuousFlow`」本轮复核**成立**（当时确实只挂在 g3 面板上）。本轮把它接成默认：
  `start()` 里 `new BattleNavigation(...,{levelHeight,continuousFlow:true})`；同时 `battle-g3.js` 的 `continuousFlow` 缺省**继承 nav 现值**
  （否则 g3 在 `start()` 的 `#apply()` 会把默认冲回 false），并支持 `?continuousFlow=0`（A/B 不需要改码）。
- 按 r76 的要求「成套跑 30/60/120Hz」：新测 `tests/flow-battle-rates-browser.cjs`，同样 18s 模拟时长三档跑同一批 8 人 14 跳：
  arrived **7 / 7 / 6**（逐面常量对照 **7**）、steer **1650 / 3349 / 8179**、adopted 0.707 / 0.701 / 0.558、关档 steer **0**、
  全员留在导航图上、离目标楼层 ≤2 人。120Hz 掉的 1 人来自群体分离在 1/4 步长下的推挤（流向本身是位置的纯函数，与 dt 无关）。
- **三项继承逐节点对账**（此前只到「代码里有 type 字段」）：386 节点里「继承源 = 三源独立 BFS 的最近源」**386/386**、
  继承兵种 **386/386**、继承方向（parent 更靠近该源）**382/386 = 98.96%**、dist 全有限非负。
- **三色不再靠场景凑**：场景本来就是步兵 8 / 矛兵 8 / 弓手 8 三支守军 → `flowColorBy='type'` 下 `flowTypeColors = 3`，
  图例「流场配色 · 按兵种 步兵·8 矛兵·8 弓手·8」；r70 记的「第三色要等矛兵上场才量得到」由此关闭。
- 可视化量：`cellsDrawn 395`（= nav 图 395 面）/ `gridEdges 3160` / 散须 near 0.273 · far 0.52（1.9×）/ 图例 3 行。
- 回归：`layered-continuous-flow.mjs`（quad p90 0.2831 vs 逐面 1.1885、mixed 0.1449 vs 1.0003、24 人 22 到）、
  `navmesh-battle-flow-browser.cjs`（polys 395、adopted 0.446、到达 7/8=7/8）、`battle-navigation.mjs`、`battle-g3.mjs` 全 PASS。
- **如实报告一条既有红**：`tests/battle-navigation-browser.cjs` 的隧道段 `maxY 1.4999 > 0.51`、`tunnelSamples 0`；
  用 `?continuousFlow=0` 关掉连续流跑同一支测试**结果逐字段相同** → 与本轮默认改动无关，属既有失败，留待下轮单查。
- 账：**done 86→88 / partial 162→160**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。

**下一轮建议（第 116 轮）**：

1. **先查那条既有红**：`battle-navigation-browser.cjs` 隧道段（`maxY` 冲到 1.5、`tunnelSamples 0`）—— 关/开连续流都一样红，
   说明是**路径规划**而不是流向；它挡着「穿洞」这条口径，修好能顺带抬一批 partial 的 runtime 证据。
2. **[041]（1.33，2 条 partial）**：格心彩色小块语义、线框接 world.js 实景 3D 透视、`radialLayout` 连通分量、极坐标底网十字刻度 —— 先 grep `radialLayout` 是否还在（很可能又是过期名词）。
3. **[050] / [053] / [054] / [055]（1.33）**：都要动生成器（四子格联合约束 / 显式半边环 / 六边 World / 笼形变），成组排，别单条吃。
4. **[051] 剩 4 条**：2 条卡「原片算法未公开」、2 条卡 `navribbon` 模块不存在 → 想吃就先新建模块，整组一整轮。
5. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 115 轮补一条）：**「没接」有时候不是没接线，而是接线挂在一个默认关的开关后面** —— 本组两条片子挂了 5 轮的
> 「continuousFlow 未接 battle」其实早就接好了（g3 面板一条 `nav.continuousFlow = this.on[k]`），缺的是「默认值」这一层。
> 判这类缺口时先问一句「这个机制有没有可达的开关」，再看默认值该不该改；改默认值的前提是把**行为回归**（速率档 + 既有场景）
> 一起跑掉，本轮就是靠 `?continuousFlow=0` 的逐字段对照，才把「既有红」和「自己改坏」分开。

## 三·113、第 113 轮（A 类仍空，B 按分数取 [048] 的第四条：跨格整墙 + 真洞口）

**本轮实收口（1 组 / 1 条）**：`1181464374839521280` "楼梯 + 门窗小 WFC" → **done**（505 帧 / 16.67fps / 30.3s）。

- 核实先于动手：`note` 连记两轮「跨格整墙/真正洞口仍缺」，grep 后**两条机制都在**（`src/build/buildings.js`，
  文件里直接署名本片 ID）：`facadeRuns` 把共线且共顶点的墙段串成一条 run 一次解 WFC；`archCutout + wallStrip`
  在拱形位置**真的不画墙条**并补洞壁（`wallColor*0.62`）/拱腹/门槛/内立面（`K.door*0.45`），洞深 `archCutDepth=0.07`。
  缺的是**页面入口 + 量具 + 运行验收**（同 r104/r107/r108/r111 的过期 note 型）。
- 新增可观测量 `archCuts`：每条被挖的墙条记 `wallArea / drawn / missing / depth`。硬判据 = 逐墙边
  `整墙面积 − 实画面积` 必须等于拱形折线面积 `2r(h−r)+6r²sin(π/12)=0.024790` → 实测最差相对误差 **1.98e-5**
  （这是「真洞口」区别于贴片拱门的唯一几何证据）。
- 页面入口：`building-components.html`（`where` 指向的那张）此前只有两个勾、提示还写着「仍待迁移」→ 补
  「跨格长立面」「拱门挖洞（真洞口）」两个开关并改写提示；`building-kit-r55.html` 的 `?flags=…&focus=auto&focusArch=N` 机位直达复用。
- 新测 `tests/facade-arch-cutout-browser.cjs`：`holes 2 == decoDrawn.arch 2`、洞深全 `0.07`、28 条 run / 68 段 / 50 格
  且 `multiSpanRuns == runs`、`violations 0`；同机位关掉 `archCutout` 后洞口外包矩形内 **changed 33488px**（同状态两帧噪声 **0**），
  洞内平均亮度 **39.0 → 26.5**。A/B 截图 `facade-arch-cutout-on/off.png` 用 ViewImage 核过：
  开 = 凹洞（左侧洞壁 + 门槛石 + 深色内立面），关 = **平贴深棕门板**填满整圈框。
- 回归：`facade-runs.mjs`（163 条 run 全多跨、`crossDrawn 119`、跨边界违例 51→0）、`facade-doors-corners.mjs`（doorRuns 23 / cornerRuns 152 / holes 16）。
- 账：**done 84→85 / partial 164→163**；`update-learning-counts.py` 仍报 285/285、remaining 0（只算账面）。
- [048] 只剩 `1769691526924292506`（球面 WFC/BFS 河网，整条管线级）。

**下一轮建议（第 114 轮）**：

1. **[048] 最后一条** `1769691526924292506`：先 grep `generate.js` 的 DFS 开挖与 BFS 缓坡分界，判「缺量具」还是「缺算法」再动手（整组只剩它，做完 [048] 全清）。
2. **[040] `1670064751181791233`**（真 job 线程）：本机无 Burst/Job 环境，**建议直接降 C**，别再排。
3. **[051]（3.33，但 5 条里 2 条卡「算法未公开」、1 条卡美术资产）**：只值得吃 `820977247083528192`（单位接触软盘，`src/core/unit-shadow.js` + `unit-shadows.html` 都在）——注意它 `where` 已指向现存模块，属「A 性质、组分数归 B」。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 113 轮补一条）：**「墙做成有厚度再开洞」这种描述会把人骗去做几何重写，其实原片里的洞是"墙面不画那块"** ——
> 本仓墙本来就是零厚度壳（原片转角也是两面直接相交、看不到墙顶厚度），所以「真洞口」= 墙条按拱形切分 + 补洞壁/内立面，
> 不是给墙加实体厚度。**判缺口前先看原片里那件东西到底有没有厚度**，否则会为一个不存在的需求排一整轮。
> 另：面积账（整墙面积 − 实画面积 = 洞口多边形面积）是零厚度壳体系里最便宜、最难糊弄的「真洞口」判据，误差能压到 1e-5。


## 三·112、第 112 轮（A 类仍空，B 按分数取 [048] 的第三条：云影接收端收尾）

**本轮实收口（1 组 / 1 条）**：`1243228419162341379` "Some moody clouds" → **done**（489 帧 / 16.67fps / 29.3s）。

- 核实先于动手：r109 记的两条「仍缺」里，`reflection`/`unit-shadow-batch` 模块**都在**（`src/water/reflection.js`、`src/life/unit-shadow-batch.js`），
  不是模块缺失，是倒影材质没接这份 uniform、单位影子属遮挡贴片不该接 → 判 A 性质（组分数归 B）。
- **r109「植被已注入但差分恒 0」是本轮查出的夹具口径错，不是机制缺**：`cloudShadowTone` 取样点 = `p.xz + sunXZ*((c.y-p.y)/sun.y)`，
  云片放在 deck 高度（y≈30 / 宽 90）时取样点沿太阳射线平移 ~36 世界单位、落点跑出云片 uv → `cover` 恒 0。
  改成「云片压被测物体正上方」（y=+6 / 宽 80）后植被立刻吃到影子：quad **11838/11919 px**、mixed **12300/12470 px**，tone **0.333/0.327**（=strength 0.35）。
  测试里保留**反向对照**（挪回 y=30/宽 90 → 变暗 0），把这条口径钉死在代码里。
- 新接**倒影接收**：`makeReflectionMaterial({…, cloud})` → `Object.assign(uniforms, cloudShadow.uniforms)` + 注入 `CLOUD_SHADOW_GLSL`；
  镜像网格 `scale.y=-1`，取样点写 `vec3(w.x,-w.y,w.z)` 还原原几何高度（否则恒在水平面下方取错高度）。`view.js` 传 `cloudShadow.uniforms`。
  实测倒影 dark **19223 / 20158 px**、tone **0.175**，restore 0。
- 单位影子**不接**并写明理由：`UnitShadowBatch` 画 alpha 暗盘（遮挡贴片，不是受光面），且本片 489 帧无任何单位。
- 回归：`cloud-shadow-browser.cjs`（主材质 darker 55909 / restore 0 / sharedAtlas）、`cloud-receiver-browser.cjs`（水面 near/far 未破）。
- 账：**done 83→84 / partial 165→164**；`update-learning-counts.py` 仍报 285/285、remaining 0（它只算账面）。

**下一轮建议（第 113 轮）**：

1. **[048] 只剩 2 条**：`1181464374839521280`（跨格整墙/真洞口，得先把墙做成有厚度再开洞）、`1769691526924292506`（球面 WFC/BFS 河网，整条管线级）。
2. **[040] `1670064751181791233`**（真 job 线程）：本机无 Burst/Job 环境，**建议直接降 C**，别再排。
3. **[051]（3.33 但最贵）** blobshadow/navribbon 模块确实不存在（r102 核实），要排就整组一整轮。
4. 便宜 done 的通用姿势仍是：`grep -rn "<机制名>" src/ *.html` → 模块在就写断言，不在才写码。

> 规律（第 112 轮补一条）：**「注入了但量不出」要先怀疑量具，再怀疑机制** —— 本轮植被着色器、uniform、cacheKey 三样全对，
> 唯一错的是夹具把云片放在 30 单位高的位置，取样点被太阳射线推出了云片。**验收夹具的几何约束（云的 xz/高度/尺寸 vs 取样点的投影落点）
> 和被测机制一样要写进断言**，否则下一轮还会把同一个 0 读成"没接上"。

## 三·111、第 111 轮（A 类仍空，B 按分数取 [040] 里最便宜的一条）

**本轮实收口（1 组 / 1 条）**：`1724449858369568780` → **done**（134 帧 / 23.14fps / 5.79s）。

- 核实先于动手：`note` 与 `next` 都写「仍缺可拖拽的真实节点编辑器」，grep 后**机制早在**：`node-editor.html`（2025-11-12）
  + `src/core/node-graph-editor.js`（`move/connect/disconnect/add/remove/parameter/undo/redo`，事务式「快照→校验→整体重载」）
  + `src/ui/node-graph-editor.js`（`pointerdown` 抓标题移动、抓输出圆点拉线、点连线删除），模型层还有 `tests/node-graph-editor.mjs`。
  **缺的不是机制，是「真的用鼠标拖过一遍」** —— 此前没有任何测试驱动过指针事件。
- 新测 `tests/node-editor-drag-browser.cjs`（真鼠标事件）：拖 compose (480,240)→**(520,300)** 且拖动中读得到 `translate(…)`（跟手）；
  undo/redo 回位；点 `[data-edge="5"]` 的 `getPointAtLength(len/2)` 把 6 边删成 **5**（`via:mouse`，3px 描边真点中）；
  从 `compose:out` 拖到 `sink:in` 出现 pending 线并接回 **6** 边；bool→number 接线被拒（「未修改：端口类型不匹配」，快照逐字节不变）；
  `speed 20→40` 后一次 `tick(0.25)` 走 **10.0**、`tick(100)` 停在 **−33.8**，sink 回调 5 次、预览块 `transform` 有位移；
  导出/载入含布局（改 `layout.button=(60,40)` 后回放）；7 节点 / 6 边 / 13 端口 = 各节点 in+out 之和，页面 0 console 错误。
- 回归（本轮未改 `src/`，只确认旧口径没破）：`node-graph-editor.mjs`、`node-graph-runtime.mjs`、`node-graph-serialize.mjs`（21 checks）、
  `node-graph-browser.cjs`（上移 193.1px · sink 74 次）全 PASS。
- 账：**done 82→83 / partial 166→165**；`update-learning-counts.py` 仍报 285/285、remaining 0（它只算账面）。
- 口径说明：原片的节点画面是 Unity Inspector（组件卡 + 弧形端口线），本地画布外观是自定设计，**不冒充面板复刻**；
  框选/多选/对齐吸附属本地扩展、原片未展示，不计缺口。

**下一轮建议（第 112 轮）**：

1. **[048] 剩 3 条**（本组分数最高）：`1243228419162341379`（植被接收换密林再验 + 反射/单位影子）、`1181464374839521280`（跨格整墙/真洞口，先给墙加厚度）、`1769691526924292506`（球面 WFC/BFS 河网，整条管线）。
2. **[040] 只剩 1 条**：`1670064751181791233` 真 job 线程与四轮节奏 —— 本机无 Burst/Job 环境，**建议直接降 C**，别再排。
3. **[051]（3.33 但最贵）**：blobshadow/navribbon 模块确实不存在（r102 核实），5 条 partial，要排就整组一整轮。
4. 想再捡「已实现缺验收」型：先 `grep -rn "<机制名>" src/ *.html`，再决定写码还是写断言。

> 规律（第 111 轮补一条）：**同一句「仍缺 X」会在 `note`、`next`、附录三处各存一份，收口时要三处一起改** ——
> 本轮 1724 同时挂在 [008] 与 [040] 两个组的 `next` 里，只改一处下周就会被重新排期。
> 另：**「模块在」和「人用过」之间隔着指针事件** —— 模型层单测全绿不代表画布能拖，`pointerdown/move/up` 必须真跑一次。

## 三·110、第 110 轮（A 类仍空，B 最高分 [048] 第二轮）

**本轮实收口（1 组 / 1 条）**：`816748103193817088` → **done**（479 帧 / 16.70fps）。

- 核实先于动手：note 写「仍缺接进 battle.js、通口前视、共享 World 自动生成导航面」，grep 后三条**全已实现**
  （`steerTarget` 里 `continuousFlow → flowAim`、`portalAim` 默认在路径上、`navMeshFromLayeredGraph(this.graph)`），
  缺的是「从真实战斗里跑一遍并量出来」→ 判 A 性质，但组分数归 B（前几轮同类）。
- 本轮只加可观测量、没改转向逻辑：`BattleNavigation.flowStats{steer,used,rejected}` + `flowSummary()`（polys/verts/links/goals/graphNodes/portals/adopted），共 3 处小改。
- 新测 `tests/navmesh-battle-flow-browser.cjs`：导航面 poly **395 = graphNode 395** / 682 顶点 / 92 links（共享 World 分层图自动生成，非手搓）；
  c02 调试层实画 navPolys 395 / navEdges 1447；真实 Battle 8 人 16 跳 **steer 4941 / used 2205 / rejected 2736（adopted 0.446）**，关掉开关 steer 0；
  到达 on 7/8 = off 7/8。回归 `layered-continuous-flow.mjs`：过边连续 p90 **0.2831 vs 逐面 1.1885**（quad）、**0.1449 vs 1.0003**（mixed），24 人 22/23 到达。
- **一项如实不认**：本岛地面层有 1 人从起点不动（maxRemain 4.928），但**关掉连续流也卡同一个人** → 记成既有 `move()/sep` 瓶颈，不写进「本片机制缺口」。
- 另一项口径纠正：逐帧转向角 p90 在开/关之间**两个方向都测到过**（受间距分离支配），已从判据降为诊断量，不再拿它当"连续"的证据。

**下一轮建议（第 111 轮）**：

1. **[048] 剩 3 条**：`1243228419162341379`（植被接收换密林场景再验 + 反射/单位影子）、`1181464374839521280`（跨格整墙/真洞口，要给墙做成有厚度再开洞）、`1769691526924292506`（球面 WFC/BFS 河网，整条管线）。
2. **[040] `1724449858369568780`**（可拖拽节点编辑器，纯前端）仍是**最便宜的 done**，建议下一轮直接吃这一条。
3. **[051]（3.33）** blobshadow/navribbon 模块确实不存在（r102 核实），要排就整组一整轮。
4. 想再捡「已实现缺验收」型：先跑 `grep -rn "<机制名>" src/`，再决定写码还是写断言。

> 规律（第 110 轮补一条）：**把「接上了」变成「量出来了」，靠的是加计数器而不是加代码路径** —— 本轮转向逻辑一行没改，
> 只是让 `flowAim` 自己报数（steer/used/rejected），才第一次能说「真实战斗里走了 4941 次、采纳 2205 次」。
> 反过来说：**没有计数器的机制，在 done 门槛前等于没实现**，因为只能靠嘴说。

## 三·109、第 109 轮（历史 · A 类已空，转 B 最高分）

**A 类已吃干净**：TOP 表里路径还是裸 `A` 的组已不存在（[010]/[045]/[047] 均标「部分收口」），按规则转 B，最高分 **[048]（2.67）**，一轮只取 1 组。

**本轮实收口（1 组里 1 条）**：`1243228419162341379`（"Some moody clouds"，489 帧）——**仍 partial**，但缺口清单缩了一半。

- 核实先于动手：note 写「水/植被/远云影/模糊未完成」。grep 后确认 —— deck 三层的 `uBlur ∝ depth` 早就在（第 55 批），
  水与植被**确实没接**云影 → 这次是真 B，不是过期 note（与前几轮判法不同，也说明「先 grep 再判」能双向纠错）。
- 新增 ① 水面接收：`#setupWater` 片元 `col *= cloudShadowTone(vWorld)` + `Object.assign(this.waterUniforms, this.cloudShadow.uniforms)`（同一批 uniform 对象）；
  ② 远层单独弱档：`uCloudPuffsFar[24]` / `uCloudCountFar` / `uCloudFarRatio=0.42`，远层宽 ramp（`smoothstep(.02,.92)`）+ 半径 ×1.6 做软边，与近/中层相乘独立退化；
  `CloudDeckLayer.update()` 按层喂 (`feed(2…)+feed(1…)` 近/中，`feed(0, …, 1.6)` 远)。
- 新测 `tests/cloud-receiver-browser.cjs`（quad + mixed）：deck 实喂 `shadowPuffs 64 / farPuffs 24`、`farRatio 0.42`；
  quad 水面 near dark **8057**（平均变暗 1.0%）/ far **7887**（0.4%），mixed **18033**（2.28%）/ **17823**（0.94%）；关影逐像素恢复 **0**。
- 回归：`tests/cloud-deck-layer.mjs` PASS（测试桩补齐新 uniform）、`tests/cloud-shadow-browser.cjs` PASS（darker 52359 / restore 0 / natural 13941 / 无 console error）。
- **一项如实不认**：植被（`swayMaterial` 注入 `cloudShadowTone(vCldW)`，uniform 同一批对象，`customProgramCacheKey` 带 `-true`）在本场景
  只有 133px 植被、掩码内差分恒 **0** → 不写「植被已接」，测试里也只记录 `proven:false` 不断言。

**下一轮建议（第 110 轮）**：

1. **[048] 还剩三条 + 植被**：`1181464374839521280`（跨格整墙/真洞口，`buildings.js` 有 `crossCell` 可接）与 `816748103193817088`（导航面接 battle.js）都属「一个入口 + 一条回归」型；
   植被接收换**密林场景**（`?scene=forest` 或把实例放大到 ~1.2 单位）再验一次，若能出像素就顺手带 done。
2. **[040] 的 `1724449858369568780`**（可拖拽节点编辑器，纯前端）仍是最便宜的 done；`1670064751185978113`… 即 `1670064751181791233` 建议降 C。
3. **[041] / [044] / [050] / [053]–[055]（1.33）**：都要动生成器，成组排。
4. **[051]（3.33）** blobshadow/navribbon 确不存在（r102 核实），要排就整组一整轮。

> 规律（第 109 轮补一条）：**「接了线」和「证明了」必须分开记账** —— 本轮植被的着色器注入、uniform 共享、cacheKey 全对，
> 但像素差分 0，就是没接上。判 B 判 A 之外还要判第三条：**能不能观测**；观测不到就先别写进 note 的「已做」，否则下一轮会被自己骗。

## 三、第 108 轮已收口（历史 · 当时的第 109 轮建议已被本轮取代）

**第 119 轮补收两条（都是「机制在、只缺运行验收」）**：`1092709665199345664`（[046] k-pow 爆炸编排）与
`1447494168448753667`（[050] 方格对角四分 + 三层联合约束）→ 都判 done。两条 note 里的「仍缺」加起来挂了 6 轮以上，
grep 后发现 `explodeAt` / `jointSubtileCatalog` / `joint3d.html` 全在，且前者文件头就署了本片 ID。
规律再确认一次：**note 里的「缺某机制」先 grep，再分「有没有」与「像不像」两问**。done 93→94。

**第 108 轮实收口（1 组 / 2 条 `[042]` 剩余两条，都会「已实现缺验收」→ 组内 4/4 全 done）**：

- `1448039167057879048` **→ done**：第 65 轮记的「顶点竖棒层 / 共享边线网层 / walkthrough 自动计时 / 每轮换岛」四条**在 r56 C09 批次早已实现**，
  就是 `island-stages-c09.html?mode=talk`：六层 `tent → lattice → strokes → net → contour → color`，单轮 17.5s、4 轮共 70s。
  新测 `tests/island-stages-talk-browser.cjs`：4 轮 4 种子 55447/60185/64923/69661；帐篷层超级三角形竖棒边 29/25/24/27（平板层 0）；
  共享边线网 114 笔、画出比例 0.12→0.57→0.99→1.00、墨迹 4083→18970→32346→32758；逐笔线稿墨迹 395→11352→27642→33217 单调；
  不点按钮 4.4s 内自动 `lattice → strokes`（`createLayerTimeline`）；`walkthrough.auto()` 的 4200ms 计时推进早就在。
- `1447483550257799171` **→ done**：「连续换岛 + 先线稿后着色循环页」在 r56 C09 的 `island-build-c09.html?mode=reel` + `src/world/build-reel-c09.js` 里。
  新测 `tests/island-build-reel-browser.cjs`：阶段序 `color→wire→hold`（`colorFirst`）、4 轮种子 5/9/17/31 线段数 4513/3634/3940/2850 全不同、
  着色段 `worldVisible && drawn==0`、线稿段 `!worldVisible && 47→1125→2665→3634` 段逐笔累积、第 5 轮回卷 seed 5、自动播放 5.65s→6.84s 跨进线稿段。
- 组内已无剩余：`[042]` 4 条（1427 / 1430 / 1447 / 1448）全部 done。

**下一轮建议（第 109 轮）**：

1. **[048]（2.67，B 里最高）**：连续面内导航/坡高、跨格整墙、云影软化/水植被接收 —— 先按 `where` 的**机制名** grep（云影/墙裙/坡高），再判 A/B；r107 之后的规律是这类很可能已实现只缺验收。
2. **[040] 的 `1724449858369568780`**（可拖拽节点编辑器 + ScriptableObject 字段分组）：纯前端活，一个人能做完；`1670064751181791233` 建议**降 C**（真 job 线程，本机验不了）。
3. **[041] / [044] / [050] / [053]–[055]（1.33）**：每条都要动生成器，成组排，别单条吃。
4. **[051]（3.33 但最贵）**：blobshadow/navribbon 两个模块**确实不存在**（r102 核实），5 条 partial，要么整组排一整轮，要么继续放着。

> 规律（第 108 轮补一条）：**「机制未做」与「机制做了但没人跑过」在 note 里长得一模一样**。本轮两条又被记成"还差一层没写的机制"，
> 实际都在 r56 C09 批次里，只需要一支浏览器断言。判 B 之前先 `grep -rn "<机制名>" src/ *.html`，再决定是"写码"还是"写断言"。

## 三·107、第 107 轮已收口（历史）

**第 107 轮实收口（1 组 / 2 条 `[042]`，两条都是「已实现、只是没人从页面跑过」）**：

- `1427721874490933250` **→ done**：贴花累加 → line boil 与图集 padding **r56 的 `src/core/decal-accum.js` 已实现**
  （`DecalAtlas.stamp` 每帧盖轴对齐方块、环面绕回、`fillPadding` 复制对边、`seamBleed` 给度量），
  `src/world/view-c07.js` 的 `DecalBoil` 每帧 `step()` 并注入片元着色器（草顶/岩壁两张 chart）。
  新测 `tests/c07-skin-decal-browser.cjs`：关贴花两帧差分 **0**、开贴花相邻帧 changed **20395/31149**、
  每帧改图 499px、黄绿覆盖 **3717→11862→18706** 单调铺开、`pad=2` 且 `seamBleed(0/1)=0`。
- `1430227487376781317` **→ done**：全城一张总贴图 + 运行时热替换 **r56 的 `src/core/town-skin.js` + `src/world/town-skin-layer.js` 已实现**
  （128² 图集 / 60 色格 / 格均色=底板 / mip 不跨格 / `aC07Cell`+`aC07Ratio` / `scribble`/`paint`/`loadImage`/`toPNG` / 植物读同图）。
  同一支测试：36555 顶点全 skinned、26 色格、mismatch 0；写一笔差分 **12184px**、热替换整张 PNG **58909px**、
  平均色 [47.9,70.6,73.1]→[69.2,58.9,89.3]（偏洋红）、`sharedLeafTexture: true`。
- 组内剩两条：`1447483550257799171`（连续换岛 + 先线稿后着色循环页）、`1448039167057879048`（顶点竖棒层 / 共享边线网层 / walkthrough 自动计时 / 每轮换岛）。

**下一轮建议（第 108 轮）**：

1. **[042] 剩下两条一起做（B，1 组）**：`1448039167057879048` 的 `stroke-reveal.js/html` 已在，只缺「顶点竖棒层 + 共享边线网层 + 自动计时推进 + 每轮换岛」；
   `1447483550257799171` 的缺口就是「连续换岛循环页」——两个缺口其实是**同一张页面的两半**，合成一页最省。
2. **[048]（2.67）**：连续面内导航/坡高、跨格整墙、云影软化/水植被接收 —— 先 grep `where` 落点再判 A/B。
3. **[041] / [044] / [050] / [053]–[055]（1.33）**：每条都要动生成器，成组排。
4. **[040] 的 `1724449858369568780`**（可拖拽节点编辑器）仍值一吃；`1670064751181791233` 建议**降 C**。

> 规律（第 107 轮补一条）：**「卡点」标签自己也会过期** —— 本轮两条都被写成"无对应实现"，实际都是 r56 C07 批次就写好的模块，
> 只因当时没从页面跑过。判 A/B 前先按 `where` 里的**机制名**（贴花图集 / 总贴图 / 热替换）而不是文件名 grep 一遍。

## 三·106、第 106 轮已收口（历史）

**第 106 轮实收口（1 组 / 2 条 `[040]`）**：

- `1671840905957978113` **→ done**：墙裙残留 `cliffSkirt()`（掩埋台账 × 只剩屋顶 × 露在崖上，`ground-0.34` 内缩 `0.08`）+ 悬檐联动
  （同面 `ground..ground+0.45`、再缩进 `0.17`，**bands 与 notches 一一对应**）；页面按深度顺序画 `#7a705f` 墙裙与 24% 黑暗带。
  新测 `tests/terrain-burial-skirt.mjs` + `tests/terrain-burial-skirt-browser.cjs`（墙裙像素 313 · 带行 9 · 檐影 433）。
- `1654401054828638214` **→ done**：灰模 AO 与软阴（新模块 `src/terrain/clay-ao.js`：`vertexAO` 距离加权遮蔽、`sunShadow` 返回**被挡比例**做渐变、
  `shadeFactor` 合成 + 0.34 下限）+ 生成后地形微调（`tweakTerrain` 余弦 falloff 只改高度、不重铺拓扑 + `terraceArea`）。
  A/B 验收：灰模暗像素 2594→16334、亮度 167.3→159.0；台地 202.1→210.1（两次单调）。**口径纠正**：原片灰模的 AO 是**弱信号**（灰底+线框+白岸线，
  灰度只差一两档），本地实现比原片强，只对"凹处暗/背光面暗一档/边缘渐变"三条定性关系，不追像素等价。
- 组内剩两条：`1670064751181791233`（真 job 线程 + 四轮节奏，**卡环境**，本机验不了）、`1724449858369568780`（可拖拽节点编辑器 + ScriptableObject 字段分组）。

**下一轮建议（第 107 轮）**：

1. **[042] / [048]（各 2.67，B）**：三角剖分顶点竖棒层 / 共享边稀疏线网层、walkthrough 手点切换、连续换岛循环页 —— 都是「新建小页面 + 浏览器断言」型，比 [040] 便宜，一组约半天。
2. **[041] / [044] / [050] / [053]–[055]（1.33，B）**：拱顶接 `archedEntry`、无限网格收缩、四子格联合约束 —— 每条都要动生成器，成组排。
3. **[040] 的剩余两条**：若还想吃，只有 `1724449858369568780` 值得排（可拖拽编辑器是纯前端活）；`1670064751181791233` 建议**降 C**（环境不具备，别再来回排）。
4. **[047] 的 B/D 尾巴**仍是「整条立面管线」级，别单独排。

> 规律（第 106 轮补一条）：**同一份「缺口」描述里往往混着"原片强信号"与"原片弱信号"** —— 灰模 AO 在片子里只差一两档，
> 先按原尺寸帧量一次对比度，再决定实现强度；否则会把"比原片更对"当成"等价"，也会为了对上弱信号把整片压灰。

## 三·105、第 105 轮已收口（历史）

**第 105 轮实收口（1 组 / 2 条）**：

- [000] 灌木逐三角带宽：`1707497006640365880` + `1707490932017279035` **两条一并 → done**。
  「同机位」这一条卡了两轮，本轮用无量纲量解决：`R = 带厚像素 / 格心→该边的像素距离`（分子分母沿同一条
  面内方向被同一透视压缩，R 对机位不变）。新建 `tests/shrub-band-scale-browser.cjs`：640×640、把所选格子
  的 apothem 投到 130.1px（与原片 frame-0150 的 6× 线框量测 ≈130px 对齐），截图交给同一个
  `tools/shrub-salmon-metric.py`。结果 **原片 P90 18px / 本仓 20px，R 0.138 vs 0.154** —— 差 11% 且本仓偏厚，
  落在原片自身帧间跨度（P90 14–26px）内 → **`SHRUB_BAND.max` 维持 1.36，不改**。r101 记的「P90 只有 60%」
  是 1100×760 全景绝对像素 vs 640 特写绝对像素的口径错。
  另一条 `splitCells` 经全仓 grep **零命中**（同 r102 blobshadow、r103 architecture.html 的教训），真实三角化是
  `triC` 扇 + `edgeTri`；线框渲染 `artifacts/coverage/shrub-band-wire-r105.png` 已核对带子外沿落在外圈顶点。
- 回归：`shrub-band-peredge-browser` 13/13、`shrub-layer-band-browser` 11/11、`shrub-band-browser` 无 glError。

**下一轮建议（A 类已空，B 类按分数往下）**：

1. **[040]（分数 2.67，B 里最高，4 条 partial）**：四片各差一层机制 —— 灰模 AO 与软阴、真 job 线程（**卡在环境，本机验不了，这条要么降 C 要么只做慢放等价**）、墙裙残留与悬檐联动、可拖拽节点编辑器。建议排**整轮**，先做 `terrain-burial` 墙裙残留（落点最清楚）。
2. **[042] / [048]（各 2.67）**：三角剖分顶点竖棒层 / 共享边稀疏线网层、walkthrough 手点切换、连续换岛循环页 —— 都是「新建小页面 + 浏览器断言」型，比 [040] 便宜。
3. **[047] 的 B/D 尾巴** 仍是「整条立面管线」级，别单独排。

> 规律（第 105 轮补一条）：**「机位/缩放不可比」这种卡点，解法往往不是改常数，而是换一个无量纲量**。
> 本期把「像素厚度」换成「厚度 ÷ 同一帧的格心到边距离」，两轮的争论一次消失，而且结论是"不用改"。

## 三之一、第 104 轮已收口（历史）

**第 104 轮实收口**：

- [014] 903647529203634176 **→ done**：三条缺口**没有一条是"没实现"**，全是"没验收"——
  ① 待机斜举 40°/刺出压平/收矛抬回：`battle.js` 的矛矩阵早就是 `e.set(-pitch, angle, 0, 'YXZ')`，`spear-tilt-browser` 直接读实例 Z 轴：40.00 / 0.00 / 收矛中途 20.00→0.00；
  ② 「粉红放射状命中线」：原尺寸裁切复看确认是**整排压平的偏粉矛杆 + 白锥矛头**（`u.brace`，杆长前探 0.38），不是独立命中特效；
  ③ 伤害飘字 ↔ 刺击命中集：代码已同源（thrust 分支先取 `stepSpearThrust` 的 hits 再逐个 `#hit`），但**没有可观测的联动度量**，
  验收无法对数。本轮补 `damageStats.{hitSet, thrustFrames, lastThrustHits, lastThrustPopups, lastThrustKills}`（`lastThrust*` 每帧重写、没命中为 0）
  + 新测 `tests/spear-hit-popup-browser.cjs`：一刺穿两人 totalHits 2 = hitSet 2 = popups 2、两敌各只掉 1 血、每帧 popups==hits、
  飘字 unitId 就是被打中的那两个、致命一刺 popups 2 = hits 1 + kills 1 且 `damage:4` 与 `kill:10` 各一条。
- [047] **A 部分收口**：`opening-punch.html` 加第二排立面（跨两层高拱龛，龛高 1.0 = 2×楼层高 0.5、`rise=.30`），
  洞内/洞外掩码从"矩形近似"换成模块的 `isInsideOpening`；`tests/opening-punch-arch-browser.cjs`：下层透出 1.0000 / 上层 0.9999 /
  拱肩 2838px 泄漏 0 / 面积误差 0.1%，方洞那排（11 洞口 / 2 门）回归不破。**但该片剩余缺口是墙厚侧壁 + 接 buildings.js（D），维持 partial。**

**下一轮建议（A 类已吃干净，只剩 B）**：

1. **[000] 灌木 `SHRUB_BAND.max` 同机位重标定（B，1 轮）**：r101 已量出 P90 只有原片 ~60%，只差机位对齐这一步；该组 2 条 partial，可能一次带两条。
2. **[040]（分数 2.67，B 里最高）**：灰模 AO 与软阴、生成后地形微调、真 job 线程与四轮循环节奏、被吞墙面的墙裙残留与悬檐联动 —— 4 条 partial，但每条都要改机制。
3. **[047] 的 B/D 尾巴**：墙做成有厚度的体（前后两面 + 洞口四周侧壁）后模板在两侧都成立，再接 `buildings.js` 立面生成 —— 这条是"单页验收永远到不了 done"的典型，要排就先排整条管线。
4. 想吃"便宜 done"就先查 `next` 里**只剩一项且已实现**的组（[012]/[030]/[032] 类是素材上限，别再排）。

> 规律（第 104 轮补一条）：**`next` 里"未做/未联动"的描述会过期** —— [014] 三条被记成"没做/两处实现"，实际代码早就做了，只是没人量。
> 判 B 之前先 grep 落点，再决定是"写码"还是"写断言"；后者往往半小时就够，前者要一整轮。

## 三之二、第 103 轮已收口（历史）

**第 103 轮实收口**：

- [045] 1257213678056857600 **→ done**：片里要求的三件事（腿落到下方真正支撑、支撑点水平错开时折斜杆内倾、高腿通长杆分段+接头）**r56 的 `src/build/steel-r56.js` 已全部实现**（`legLanding` / `crank.foot=mix(p,支撑格心,.24)` / `solveTieLevels` + `joint()`），缺的只是运行验收 → 新增 `tests/steel-frame-browser.cjs`（腿 14 / 曲柄 6 / 内倾 0.1037 / 系杆 8 / 接头 18 / 关档 `steel=null`），页面 `build-r56.html?scene=steel` 两视角截图核过。**旧 `where` 写的 `architecture.html` 是文档页、不承载钢架**（同 r102 的教训）。
- [010] **A 部分收口**：四条页面入口都补上并出运行验收 —— `grids.html` 平移窗口（origin 6 方向 + `windowSeam`，最大差 ≤7.9e-15）、`wfc.html` tile 存活诊断（147 格 / 24 tile 全活 / 窄册对照把唯一 tile 判死）、`navmesh-flow.html` 漏斗路径（逐边中点 14.84 → 漏斗 13.37 → 捷径 13.10，折角 7→3→2）、`ui.html` 等墨量图标（8 个路径图标线宽 1.55–2.45，墨量离散度 0.296→0.199→0.037）。**但该组三条 partial 的剩余缺口是 B**（真流式/疏密均匀度、漏斗接 battle.js、walk-reach 接生成器、texel-owner 接烘焙、图稿与游戏语义），页面入口做完**不翻 done**。

**下一轮建议（A 类只剩 [047] 一组）**：

1. **[047] `opening-punch.html`（A 的一半，0.5 轮）**：`opening-punch.js` 的 `rise>0` 跨两层高拱龛已在，缺运行断言；但片子的剩余缺口是 **墙体厚度/洞口侧壁 + 接 buildings.js**（D），所以**就算补了拱龛断言也仍是 partial** —— 若只想拿 done，跳过它。
2. **[014] 长矛 40°（B 但小，1 轮）**：它同时挡住 903647529203634176 的 done，是当前"单个缺口挡住一条 done"里最便宜的一条。
3. **[000] 灌木 `SHRUB_BAND.max` 同机位重标定（B，1 轮）**：r101 已量出 P90 只有原片 ~60%，只差机位对齐这一步。
4. 想吃 A 的惯性收益就先做 **[010] 剩下的 B 接线**中的 `walk-reach`（接生成器默认流程，会影响可达比例，必须在同轮跑 3 条回归）。

> 规律（第 103 轮补一条）：**A 判据要连带看"这条片子还有没有别的 B/C 缺口"** —— [010] 的页面入口是真 A，但片子本身的 done 门槛在 B 上，所以 A 做完只能提高 `acceptanceScope`，不能翻状态。判 A 时先看 `note` 末尾的「仍缺 …」，再看 `where` 的模块是否存在。

## 三之三、第 102 轮已收口（历史）

**本轮已收口（表内路径改成 C，不再排期）**：

- [009] 903647529203634176 伤害飘字：r60 记成「未做」的两项其实已实现 → 补 `damage-numbers-kick.mjs` 19/19 + `damage-kick-browser.cjs` 9/9；该片仍 partial，只剩长矛 40°（[014]）。

- [001] 837 火光探针：`battle-c01#fireGlow` 暴露 `fireStats`，`stain-joint-curve` 13/13（火 0s / 地面 0.017s）；该片只剩「爆燃三层高度」。

- [051] 纠错：blobshadow/navribbon **模块不存在**，从 A 降 B（别再把「未覆盖」当「只缺验收」）。

**下一轮建议（A 类只剩 3 组）**：

1. **[010] 9 个模块的页面入口**（A，0.5 轮）：`grids.html` 平移窗口、`wfc.html` 诊断面板、`navmesh-flow.html` 漏斗路径、`ui.html` 等墨量图标 —— 模块已有 node 验收，缺页面入口与运行截图；这组一次能带动 3 条 partial。

2. **[045] `architecture.html`**（A）：文件在，悬空体块缺斜撑/偏移支撑/腿分段，且未出运行验收。

3. **[047] `opening-punch.html`**（A）：`opening-punch.js` 已在，缺跨两层高拱龛的运行验收与断言。

4. 若 A 类吃干净：转 **[014]（长矛 40°，B 但小）** —— 它同时挡住 903647529203634176 的 done。

> 规律：**A 类的共性是「模块已存在、只是没人从页面上跑过」**。这类每组成本最低、对 done 的增量最直接，应该先扫干净再碰 B。

## 四、附录：108 组全表

| 组 | 主题 | 类型 | 路径 | partial | 涉及片 | 标题 |
|---|---|---|---|---|---|---|
| [000] | 植被/灌木/天气 | 缺口 | ✔ 已收口（第 105 轮） | 0 | 2 | 缺口（第 101 轮 · 灌木 600+257）：同口径重测后 **P50 对上（本仓 4px vs 原片 4–6px），P90 只有原片 ~60%（本仓 10px vs 原片 1 |
| [001] | 烟火/战斗表现 | 续项 | C | 1 | 1 | 已收口（第 102 轮 · 837 火光探针）：`battle-c01#fireGlow` 末尾暴露 `fireStats={t,houses,lit,intensity,disc |
| [002] | 其他 | 定案 | C | 1 | 1 | 定案（第 101 轮 · 912）：绝对 α 已到素材上限 —— 400×400 / JPEG q≈88 下柱内残余 11.98 与平坦区噪声底 5.12 只差 2.3×，任何 α |
| [003] | 天光柱 | 纪律 | C | 1 | 1 | 纪律（第 101 轮 · 已落地并关闭）：`tests/worldmesh-setter-guard.mjs` 8/8，含**突变测试**（删 `set bandTri` 立刻红） |
| [004] | 体素/光照/材质 | 定案 | C | 2 | 2 | 定案（第 97 轮·体素 794993371261665280）：色板已按实测换成灰青族（H 156–204°/S 12–16%），页面抄的第二份旧色板已删（改 `import L |
| [005] | 体素/光照/材质 | 定案 | C | 1 | 1 | 定案（第 93 轮·天光柱）：触发源**永久降级**（同 r91），列在此仅为提醒别再排期。寿命 0.46s 已按两窗各 15 帧标定。 |
| [006] | 导航/流场 | 纪律 | C | 2 | 2 | 纪律（第 93 轮·流场）：389 帧只有格边骨架线 + 色块，无箭头/流线/图例 → `continuousFlow` 接 battle.js 无原片依据，维持「本仓扩展、不排队 |
| [007] | 网格/拓扑/生成 | 缺口 | ✔ 已收口（第 115 轮） | 0 | 2 | 缺口（第 83 轮结论·流场）：LOD 第 9 次测不出 → 永久维持「不适用」（两条片子都是固定等轴 + 整岛入画 + 无图例，r75 已在 badnorth 实景页给出透视解释 |
| [008] | 体素/光照/材质 | 缺口 | ✔ 已收口（第 111 轮） | 0 | 1 | 已收口（第 111 轮 · 节点图 1724449858369568780 → done）：serialize/fromJSON/NODE_REGISTRY + 只读连线图早在第 61 轮落地；本轮核出「仍缺可拖拽的真节点编辑」是过期 note —— `node-editor.html` + `src/core/node-graph-editor.js` 早已实现拖动/拖线/点线删除/参数/撤销重做/导出含布局，缺的是真鼠标验收 → 新测 `tests/node-editor-drag-browser.cjs` 补齐。该组已无剩余 partial。 |
| [009] | 烟火/战斗表现 | 续项 | C | 1 | 1 | 已收口（第 102 轮 · 伤害飘字 903647529203634176）：r60 记成「机制未做」的两项其实 56 批 C02 已实现，本轮补验收 `tests/damage- |
| [010] | 网格/拓扑/生成 | 续项 | A | 3 | 6 | 第 50 轮迁入的 9 个模块大多只有 node 验收：页面入口（grids.html 平移窗口、wfc.html 诊断面板、navmesh-flow.html 漏斗路径、ui.h |
| [011] | 网格/拓扑/生成 | 缺口 | B | 1 | 1 | 缺口（第 48 轮实测·导航面流场）：共边带混合已把跨面差压到 0°，但流向仍是「面内线性」，面上到崖边那一格方向仍偏直（沿 z=2.2 直线 0.02 步长最大跳 4.77°）； |
| [012] | 网格/拓扑/生成 | 缺口 | B | 0 | 1 | 缺口（第 47 轮新发现·多格 tile）：未接共享 World；构件是体块，缺原片带窗洞/栏杆的美术模块；无限高只到 24 层上限（793545297376972801） |
| [013] | 网格/拓扑/生成 | 续项 | B | 1 | 2 | navmesh-flow 接进 battle.js（替换格心流场 + 通口前视），导航面从共享 World 分层导航自动生成；multitile WFC 接进共享 World（多格 |
| [014] | 烟火/战斗表现 | 缺口 | ✔ 已收口（第 104 轮） | 0 | 1 | 已收口（第 104 轮 · 长矛 903647529203634176 → done）：三条全是「已实现缺验收」——斜举 40°/刺出压平/收矛抬回（spear-tilt 40.00→0.00→20.00）、「粉红放射线」实为整排压平矛杆+白锥矛头（spear-brace）、伤害飘字与命中集同源（新增 linkage 度量 + `tests/spear-hit-popup-browser.cjs`：totalHits=hitSet=popups=2）。 |
| [015] | 烟火/战斗表现 | 缺口 | B | 0 | 1 | 缺口（第 43 轮新发现·精灵）：方向歧义度量不是标定过的违和度，小尺寸仍要目视；单方向精灵模式无逐单位 UV 血斑/受击摆动，战斗场景第 0 波无守军导致截图看不到成队精灵（96 |
| [016] | 烟火/战斗表现 | 缺口 | B | 0 | 1 | 缺口：火焰粒子颜色与尺寸解耦——旧粒子（橙红档）尺寸已 <1px，画面只剩奶白核心；要么给色带加可见下限，要么把橙红档放到更大/更长寿的独立粒子层，补片中光晕与飘散火星（10569 |
| [017] | 网格/拓扑/生成 | 续项 | B | 0 | 2 | 体素梯度软化网格并约束硬边、形变碰撞及表面光照剩余缺口 |
| [018] | 体素/光照/材质 | 缺口 | B | 0 | 1 | 缺口（低优先）：角色外观分件与 UV 渐变调试材质（v 方向色带看 UV 朝向/翻转）（847717312912211970） |
| [019] | 导航/流场 | 缺口 | B | 1 | 1 | 缺口：小队占位线网——凹形占位应沿格边界而非凸包、接进 battle.js 选中态并随 world.top 贴地、旗顶悬空白菱形标记、箭矢细白轨迹线（883447205176238 |
| [020] | 植被/灌木/天气 | 缺口 | B | 0 | 1 | 缺口：战斗 HUD 层——血泊贴地累积贴花与尸体层、登陆木跳板、旗布摆动相位、飘字数值取自击杀还是伤害（839067977781768193） |
| [021] | 体素/光照/材质 | 缺口 | B | 1 | 2 | 缺口：等值面渲染层——水面只有浅色椭圆没有真平面倒影；过渡中的碎片应当是暗色（背光/内翻），现在是亮色；水线是落地边折线而不是沿等值面等距外扩的带状轮廓（8188574088481 |
| [022] | 烟火/战斗表现 | 缺口 | ✔ 已收口（r56 C04 + 本轮核账） | 0 | 1 | 已收口（`832633189277409280` → done）：分层混合 r56 已在 `field-surface-c04.js`（layeredPlan 房子不进场 / housesAt 同时窗 / houseTriangles 硬边几何）+ `field-surface-3d.html`「房子硬边分层」开关；本轮补 `houseSupport` 足印着座检查并实测修两栋房（A 细柱顶房悬空 1.25 格、B 靠塔房被塔缘埋 1.5 格），新测 `tests/field-surface-layered.mjs` 6 项 PASS |
| [023] | 烟火/战斗表现 | 缺口 | ✔ 已收口（第 190 轮） | 0 | 1 | 第 190 轮：`816332161036984320`（177 帧·Unity Trajectory Calculator）→ done —— 三条缺口逐条核：①「场景碰撞截断」**撤销**（全片无实体块，弧线只被地面线/视口截断）；②「二次阻力档」真缺口 → `dragModel: linear / quadratic`（RK4 + 落地回插 + `quadMaxReach` 缓存）全线透传，页面 `#model`/`?model=quadratic`；③「第三行读不到」过期（4× 裁切只露字符顶部，Gravity 滑杆 r56 已有）。片内不可判已量化：同 45° 射程匹配后两档最大差 **1.89% 射程**（≈2px < 25px 划线）。 |
| [024] | 导航/流场 | 缺口 | B | 1 | 2 | 缺口：整个队列层缺失——成列行军（沿同一路径固定间距排队、拐角内圈减速）、跨层列队（上台阶拉成竖列、脚贴地）、到达后展开成 3–4 排方块的落位；片中有等弧长白色引导点可作调试视图 |
| [025] | 体素/光照/材质 | 缺口 | B | 1 | 1 | 缺口：路线/轨迹编辑器——gizmo 拖检查点后重采样并显示点数与总长、累积轨迹模式（点只增不减）、quad 面三角剖分线调试层（现有 aomesh 只画体素壳）(81015748 |
| [026] | 体素/光照/材质 | 缺口 | B | 1 | 1 | 缺口：球面胞元壳还是只有整格一级——片子里每格内部是一坨多层小方块（两级尺度），另外装配起点只能取默认根、不能指定从哪一格起长，表面也没有生物群系斑块着色（784848286272 |
| [027] | 网格/拓扑/生成 | 缺口 | B | 1 | 1 | 缺口：球面星球的两级尺度没做——片中同一块壳上既有跨多格的平滑大平板，又有一整片格内细分的小方块碎片堆（每块独立朝向/高度），本仓胞元只有整格一级，格内无细分（7848475888 |
| [028] | 其他 | 缺口 | B | 1 | 1 | 缺口：装配起点固定在最高格，片子是从一处随机位置起长；planet.js 的 root 参数已留但页面没入口；片中同层还有细碎凹坑没做（784847933686575104） |
| [029] | 网格/拓扑/生成 | 缺口 | ✔ 已收口（第 127 轮） | 1 | 1 | 已收口（第 127 轮 · `1313837640366596096` → done）：四条「都没有」核实后是**两过期 + 一条本片不存在** —— ①建筑随岛抬升本来就在（`liftColumns` 整列抬，本轮量出建筑体素 **116** 个全在 ≥6 层、环内最低实心层 = **4 = lift+1**、1–3 层全空、环外仍有 >50 格贴地）；②「白色蝶形小构件」是把 **4 片桨叶**误读成两片小方板，按 3× 裁切重做为**黄短舱 + 4 片白桨叶**（28 桨位/112 桨叶）+ **船壳皮**（黄鼓边带 268 三角 + 红舷缘 + 99 舷窗）+ **带斜撑的锥形腿**（56 腿/112 撑）+ 56 榀桁架摇篮；③「飞行操控状态机」本片 315 帧纯转台、无起飞/平移/悬停镜头，按「片中没拍到的机制不记缺口」不计；新测 `tests/flying-town-c06-browser.cjs`（桨叶像素 A/B **2103→503**、噪声 0、差分 11670）；抬升侧壁仍是岩层带、船壳无板缝铆钉属造型差 |
| [030] | 其他 | 缺口 | B | 0 | 1 | 缺口：2016 早期演示片里整片拆解/重建的时序定不下来（9.94fps 下块整块出现消失、顺序无规律），要复刻建造动画得另找 2018+ 带逐块过程的素材（80685621226 |
| [031] | 烟火/战斗表现 | 缺口 | B | 0 | 1 | 缺口：血腥开关只做了后果（血迹/血滴/尸体整层消失），原片拍不到面板，开关样式与 break-glass 部件无从对照；血在深浅底材上的色差用单一色近似（9991917609444 |
| [032] | 网格/拓扑/生成 | 缺口 | B | 0 | 1 | 缺口：AO 烘焙网格视图是实心体素壳、不是原片那摞半透明层叠薄板；且本仓建筑不走体素，壳里只有地形台地、没有建筑体积（1298689301488775169 第 329–359 帧 |
| [033] | 网格/拓扑/生成 | 续项 | ✔ 已收口（第 127 轮） | 1 | 1 | 已收口（第 127 轮 · `1313837640366596096` → done，4 张联系表全看 + 3 张 3× 裁切）：核实与收口动作见 [029] 行 |
| [034] | 烟火/战斗表现 | 缺口 | B | 1 | 1 | 缺口：血迹只有一套空间，原作躯干走皮肤空间、盔与手臂走精灵空间（片 999185422403055616 的 0096 用棋盘格画出这条界线）；斑块是整面块状，与 PALETTE_ |
| [035] | 植被/灌木/天气 | 缺口 | B | 0 | 1 | 缺口：流场调试线配色偏淡（亮草地上几乎看不清），缺逐格白色方向箭头与网格底线；三角网格流场还没在页面上做过截图验收（972829402873716737） |
| [036] | 网格/拓扑/生成 | 缺口 | B | 0 | 1 | 缺口：可走图缺格角红点与背景六边形网格线框；削台档数（2 档）是自定的，片子里看不出原作者削几档，也没有「削之前」的对照（917405214638006273） |
| [037] | 烟火/战斗表现 | 缺口 | B | 1 | 1 | 缺口：片中的血流飞溅是贴图/精灵，我们的血滴 Points 只做可见化不参与命中；崖壁流挂宽度/长度仍是随机（912691357440978945） |
| [038] | 植被/灌木/天气 | 续项 | B | 0 | 4 | 第 30 轮缺口：色斑缺原作 atlas / 受控跨崖采样，配色不随生态变化；树冠瓣径比偏均匀、缺顶部亮边；草簇是概率撒点，缺沿台地边缘的连续边带与 7–9 瓣；逆光的阴影遮罩仍是 |
| [039] | 网格/拓扑/生成 | 续项 | B | 0 | 4 | 第 29 轮缺口：投影暗部幅度仍比片中亮一档、无 less-contrast 档；texture-only / light-only 只作用于共用 town 材质；灯塔塔身红白分层 |
| [040] | 网格/拓扑/生成 | 续项 | B | 4 | 4 | 第 20 轮缺口：灰模阶段的 AO 与软阴、生成后地形微调、真 job 线程与四轮循环节奏、被吞墙面的墙裙残留与悬檐联动、节点图缺可视化连线编辑器与 ScriptableObjec |
| [041] | 网格/拓扑/生成 | 续项 | ✔ 部分收口（第 116 轮 · 1/4 片） | 2 | 4 | 第 116 轮：`1459169210752507904` 三条缺口核实为误读（格心无彩色小块=补丁缝+三角带小三角边，格心只有对角线 X；全片无透视；无 world 实景），补丁着色层（三族吸附 + 补丁连通块 + 品红缝 + 绿填三角格 + 对角线）落 `src/core/grid-wireframe.js#patchLayout` + `grid-graph.html?mode=patch`，新测 `tests/grid-patch-families-browser.cjs`；仍缺补丁级刚性（153 块/抖动 14.99° vs 原片约 8 块/0°），片维持 partial |
| [042] | 植被/灌木/天气 | 续项 | ✔ 已收口（第 108 轮） | 0 | 4 | 已收口（第 108 轮 · 4/4 片全 done）：第 18 轮记的四条缺口（顶点竖棒/共享边线网/自动计时/换岛、连续换岛循环页、贴花累加、总贴图热替换）**全是 r56 已实现只缺验收**；本轮补 `tests/island-stages-talk-browser.cjs`（六层 4 轮换岛 + 自动推进）与 `tests/island-build-reel-browser.cjs`（4 轮 4 岛循环 showreel）。 |
| [043] | 其他 | 续项 | B | 1 | 4 | 第 17 轮缺口：view.js 仍是透视相机，未接混合投影（要同步 pick() 的 raycast、水面倒影、轮廓层相机矩阵与 k 开关），逐像素匹配未做 |
| [044] | 网格/拓扑/生成 | 续项 | ✔ 已收口（第 117 轮 · 2/2） | 0 | 4 | 第 117 轮两条一并 done：1275089608758484992（教堂高拱龛，补后墙形制 + `backWall`/`steps` 量具 + tests/church-niche-browser.cjs，蓝后墙像素 34505→关档 0）；1302686201401442309（无限网格松弛，`relaxPolygons` 加 areaPull=0.85 面积拉回，收缩格 27→0、最小 0.450→0.640、最大拉伸 1.83→1.52、翻折 0、接缝 4e-15，新测 tests/infinite-area-pull.mjs）|
| [045] | 其他 | 续项 | A | 1 | 4 | 第 15 轮缺口：悬空体块缺斜撑/偏移支撑/腿分段（architecture.html 未出运行验收） |
| [046] | 烟火/战斗表现 | 续项 | B | 2 | 4 | 第 13 轮缺口：爆炸缺 explodeAt(point) 一次性编排（环+火球+烟+焦痕+火星时序）与焦痕贴片；缺 3D 等值面模块（marching cubes）与生长动画、m |
| [047] | 体素/光照/材质 | 续项 | A | 1 | 4 | 第 14 轮缺口（由 CHANGELOG 重建）：做到哪：新增 `src/render/opening-punch.js`（`planFacade` 校验洞口并给解析面积；`cre |
| [048] | 植被/灌木/天气 | 续项 | ✔ 已收口（第 138 轮 · 4/4 片全 done） | 0 | 4 | 第 113 轮：`1181464374839521280` → done —— 跨格整墙/真洞口核实为 r55 已实现（`facadeRuns` 163 条全多跨、跨边界违例 51→0；`archCutout` + `wallStrip` 真不画拱形墙条并补洞壁/拱腹/内立面），补 `archCuts` 面积账（误差 1.98e-5）+ 新测 `tests/facade-arch-cutout-browser.cjs` + `building-components.html` 补两个开关；第 138 轮 `1769` → done（球面 DFS/BFS 河网核实为过期账，缺的是运行验收 + 河面画在河床被沟壁挡成干沟，改画岸高；新测 tests/planet-rivers-c09-browser.cjs）。组内 4/4 片全 done |
| [049] | 网格/拓扑/生成 | 续项 | B | 1 | 2 | 拓扑续项：游戏手柄/连刷适配、完整高度段/飞岛支撑；1747帧不重计 |
| [050] | 网格/拓扑/生成 | 续项 | B | 2 | 2 | 子格续项：四子格联合模块约束、3Dtile/共享World生成适配；本批561帧不重复计数 |
| [051] | 导航/流场 | 续项 | ✔ 部分收口（第 114 轮 · 1/5 片） | 4 | 5 | 第 114 轮：820977247083528192 → done（接触软盘/跨格/光偏/坡面拟合/measure 全在 53 批 G5 + 55 批 G3，只缺页面入口与运行验收，新测 tests/unit-shadow-contact-disc-browser.cjs）。仍剩 4：2 条卡原片算法未公开、2 条卡 navribbon 模块不存在 |
| [052] | 体素/光照/材质 | 续项 | ✔ 已收口（第 118 轮 · 2/2） | 0 | 2 | 第 118 轮两条一并 done：投影往返（`liftToSphere.roundTrip` 1.06e-15）、动态重三角化（`relaxRetriangulate` 每轮改边 18→4→1→2→0）、完整视觉（`planet.html?stages=1` 四阶段真快照 + `sphere-insert.html` 插入回放）核实早就实现；真缺的是**极点鲁棒性** → `stereo-insert-c06.js#poleGuard`（极点选点 + det=+1 真旋转 + 重合点合并；旧路径极点重合 RangeError、次北点 1e-4 rad r=2.00e4→6.53，收敛 3.06e3×），新测 `tests/sphere-pole-guard.mjs` + `tests/sphere-insert-guard-browser.cjs`（396 面=2n−4、Euler 2、往返 1.17e-15）|
| [053] | 网格/拓扑/生成 | 续项 | ✔ 已收口（第 120 轮 · 2/2 片） | 0 | 2 | 第 120 轮两条一并 done：`1677242779162877952`（三角图压力测试）—— 增量插点 + `flip/legalize/check(Infinity)` + `trigraph-edit-c08.js` 局部编辑（addTracked 边差分 / removeVertex 星形环耳切+Lawson / moveVertex 回滚），新测 `tests/trigraph-c08-browser.cjs`（200 步 verts200/tris385/染色边33、全查 401 面 流形✓ Delaunay✓ 退化0；删5点/移5点仍✓）；`1458921394855718917`（Half Edge 探索）—— `halfedge.js` 显式 next/prev/twin + boundaryLoops + vertexFan + splitQuads，`halfedge-patch-c08.js` 复现「方块组→剩余区域环→间隙三角→合成网格」，本轮补 `halfedge-c08.html`「切四边形」入口，新测 `tests/halfedge-c08-browser.cjs`（loops 14/errors 0、euler 1/fullLoops 1、切 51 格出 46 三角=2×23 缝 Euler1 环1 错误0 面积Δ0） |
| [054] | 网格/拓扑/生成 | 续项 | ✔ 已收口（第 121 轮 · 2/2 片） | 0 | 2 | 第 121 轮两条一并 done：`1670790425232175108`（三档纯格型岛）—— `grid-kinds-c08.js` PURE_GRIDS + `app.js:40` 的 `?grid=hex|square|tri` 挂钩早已在（r56 C08，只出过 node 测试），本轮补运行验收 `tests/grid-kinds-hex-island-browser.cjs`（每格恒 6/4/3 边、顶点最多 3/4/6 格共用、V−E+F=1、互反违例 0、陆地 95/6层·372/8层·576/10层、格线段÷陆地格 8.284/4.126/2.821）；`1669315384619540487`（每种子都出好岛）—— `island-quality-c09.js`（islandReport/ISLAND_RULES/consistentIsland/pruneIslets）+ `islands-c09.html` 连播页，补 `tests/island-quality-consistent-browser.cjs`（连播 4 座全 cool、tries 2,1,1,2；关体检扫 8 种子 2 座不合格；shore 152/180/138/152；四阶段 5→6→18(override黑)→22）。口径差：原片软坡/六棱柱/美术级小屋群 ≠ 本仓台地阶与宽平岛型，属美术差、不计缺口 |
| [055] | 网格/拓扑/生成 | 续项 | ✔ 部分收口（第 122 轮 · 1/2 片） | 1 | 2 | 第 122 轮：`1579478470098243584` → done —— 「完整原cage/3D碰撞仍缺」是过期账（`src/terrain/cage-c09.js` 的 cageWallPoint/cageSlice/insideCage/cageCollider 在 r56 C09-D，文件头署本片 ID；只有 node 测试、没有页面运行验收，cage.html 提示语还写「未实现」），补「笼碰撞探针」+ 新测 `tests/cage-deform-browser.cjs`（壁面点 45 最大偏差 0、弯曲 0.0664/0.0661、pushOut inside=false 余量=r、terrain-collide 认同、`?mode=cage` wire→hold→color）。仍剩 `1579474420749725696` 完整坡面/模块联合生成（原片算法未公开，C） |
| [056] | 建筑/模块 | 续项 | B | 2 | 4 | 原版新增模块后续：拱券楔石/净空与任意塔基全局楼层线；当前仅静态部分映射，先配文/逐帧再优化 |
| [057] | 其他 | 续项 | B | 2 | 2 | 层级平滑续项：原模块/材质三角边语义与完整三模式、3D保形/侧壁自交；266帧已学不重计 |
| [058] | 网格/拓扑/生成 | 续项 | B | 2 | 2 | 球面续项：模块目标形状/多格冲突和侧壁穿插、原海陆/河网及World融合；708帧已学不重计 |
| [059] | 导航/流场 | 续项 | B | 2 | 2 | 河网续项：完整约束坍缩/BFS缓坡、开凿历史与复杂汇流/球面导航；792帧已学不重计 |
| [060] | 体素/光照/材质 | 续项 | B | 1 | 2 | 球面海陆纹理/岸缘混合仍待实现，242帧已学；山体原atlas/混合成本/完整接口待补，234帧已学不重计 |
| [061] | 体素/光照/材质 | 续项 | ✔ 已收口（第 144 轮 · 2/2 片） | 0 | 2 | 第 144 轮：`1482011744843223042`（384 帧·程序化法线反差细线）→ done —— 旧 note【卡点·B 美术资产】误标（原文就是 procedural normal map），真缺陷是 `outline-pass.js` 阈值重构后本开关按旧字符串 patch 合成着色器抛 `composite token missing`（且抛在 outline 已开之后 → 几何描边留在天上）+ off→on 二次 patch + 线源未限定（云/天空进法线遍）；改法=直接设 `uNormalThreshold` uniform、原始源码只存一次、线源限定共享地形材质（`c11NormalOnly`），新测 `tests/normal-line-scope-browser.cjs`（线密度 91→172→91‰ 幂等、天空/海面线 0、线宽 p50 2 p90 3 = 原片同口径）。  第 140 轮：`1478114309263839244`（346 帧·径向大小排序 UV 图集）→ done —— 旧 note「原UV流程未实现」核实为过期账（`uv-radial-atlas.js` r56 C11 署本片 ID：topMergeCharts 朝上合并+竖直投影+崖柱脚印成洞、radialChartPack 按面积从页心向外、clipIsland 同构测试岛），缺的只是浏览器验收；新测 `tests/uv-radial-atlas-browser.cjs`（中心片 30.7% 带 1 洞、重叠 0、面积~距离 Spearman −0.634、像素连通块 322/最大块 29.6%/块心距页心 0.004、逐片放置 16807→43341px、线框↔棋盘视图差 67773px、反差 ΔE 18.13 vs 0.27、0 console error）。仍剩 `1482011744843223042`（程序化 normal map 反差细线；页面与 `tests/normal-contrast-browser.cjs` 都在跑，卡原片手绘笔触 atlas 与投影接缝） |
| [062] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 树云续项：原球面octagonal卡片/多俯仰、蓬松云形和前景层次；569帧已学不重复计数，方向修复已验 |
| [063] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 图集续项：自动扩容/重排、原3D树/完整兼容接口与原素材；460帧已学不重复计数 |
| [064] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 矩形树续项：原3D树展开和完整兼容接口；805帧已学；整数跨叶候选/key已在本轮补齐 |
| [065] | 体素/光照/材质 | 续项 | B | 2 | 2 | 头像续项：可序列化SLOTS/spec、原素材/兜帽锁甲、剪影IoU与游戏角色身份；188帧已学不重复计数 |
| [066] | 体素/光照/材质 | 续项 | B | 1 | 2 | UI图标/纹饰续项：原画稿/中心徽章、逐部件显隐/材质色变和真实游戏工具命令；406帧已学不重复计数 |
| [067] | UI/HUD/存档 | 续项 | B | 2 | 2 | UI续项：单Move目标确认/地面标记、游戏Move/Swap语义与原布局/图标接口；753帧已学不重复计数 |
| [068] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 云/冬景续项：高耸云体/灰蓝层次、统一风采样与完整冬季美术/船群战斗组合；795帧已学不重复计数 |
| [069] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 风雪续项：原作风轨迹接口/局部场shader采样、雪片软形与接触AO、形变表面扫掠；834帧已学不重复计数 |
| [070] | 其他 | 续项 | B | 2 | 2 | 船迹/雾续项：间断泡沫/舷侧喷溅与靠岸船；风场平流软片及遮挡，464帧已学不重复计数 |
| [071] | 其他 | 续项 | B | 1 | 1 | 道具动画优先补差：稳定道具键、保留消失几何、出现/移除错峰及跨重建身份；306帧已学，不重复计数 |
| [072] | 其他 | 续项 | B | 1 | 1 | 新原版模块wake.js：先精确配文/全帧核验船迹，再补粒子/舷侧喷溅、角度与轨迹接口；目前仅静态映射部分覆盖 |
| [073] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 导出/录像续项：第三方DCC导入、实例植被/水/材质，回放逐动作动画/水花/音效及镜头轨迹；已学455帧不重复计数 |
| [074] | 网格/拓扑/生成 | 续项 | B | 2 | 2 | 存档/合并续项：palette与天气/玩法持久化、跨平台拓扑身份；原作动态合批/合并基准与局部上传，已学670帧不重复计数 |
| [075] | 体素/光照/材质 | 续项 | B | 2 | 2 | QA与彩色反弹续项：复杂悬空孔洞/模块连接/自交与原作视觉、校准和完整彩色反弹参数；已学1270帧不重复计数 |
| [076] | 体素/光照/材质 | 续项 | B | 2 | 2 | 已学537帧续项：轮廓方向速度场与拖抹，PNG/多行palette、配色持久化；短弧过渡为本地扩展，非原作公式证明 |
| [077] | 体素/光照/材质 | 续项 | B | 2 | 2 | 已学827帧续项：原片轮廓方向拖抹/速度场、PNG palette热重载和贴图色槽；保留历史帧及独立色槽成果 |
| [078] | 体素/光照/材质 | 续项 | B | 2 | 2 | 已学色彩/对比续项：五特征HSL离散预览、彩色约束与atlas输出/接缝；标量诊断违例和原版完整接口待补 |
| [079] | 其他 | 续项 | B | 2 | 2 | 原版新增待覆盖模块：src/colorvolume.js、src/contrasttex.js，先核接口与精确ID配文再学习，不凭同名页面冒充覆盖 |
| [080] | 体素/光照/材质 | 续项 | B | 2 | 2 | 已学635帧续项：纹理浮凸的投射高度与深度高度分别储存，接屋檐/墙面、形变表面与UV缝验收；现有2.5D地表近似不能替代 |
| [081] | 植被/灌木/天气 | 续项 | B | 2 | 2 | 已学草边/笔触续项：共享atlas/rim距离场、连续受控跨崖采样、完整参数与反射一致性；1052帧不重复计数 |
| [082] | 网格/拓扑/生成 | 续项 | B | 1 | 1 | 软坡续作：连续坡面/排水无局部低洼的可检验生成算法与World适配；已学656帧不重复记数 |
| [083] | 其他 | 续项 | B | 1 | 1 | 悬挑续作：切面面积/边长保护已补；剩余跨切面3D侧壁交叉、碰撞和原作视觉，303帧不重复计数 |
| [084] | 植被/灌木/天气 | 续项 | B | 1 | 1 | 已学习草丛续作：顶点采站立点contrast texture与背景射线差值，视角变化稳定性；不重复计数 |
| [085] | 体素/光照/材质 | 续项 | B | 1 | 1 | 已学习patch续作：球面投射/岸带手工UV、atlas采样及接缝AB指标，保留原顶面混色；不重复记视频数 |
| [086] | 烟火/战斗表现 | 续项 | B | 2 | 2 | SDF/法线续项：形变表面距离、程序笔触/切线贴图、命中UV和mega-texture反馈；不把诊断梯度当原作笔触 |
| [087] | 体素/光照/材质 | 续项 | B | 1 | 1 | 反弹模块映射补差：原版2.5D形因子gather与暴力参考接口，保留已有3D体素反弹并明确不同模型 |
| [088] | 烟火/战斗表现 | 续项 | B | 2 | 2 | GI续项：SDF距离+命中UV、mega-texture表面与体积双向反馈；方向入射可选，内部传播仍平均RGB |
| [089] | 体素/光照/材质 | 续项 | B | 0 | 1 | 低分辨率漏光/形变遮挡与实时增量更新；太阳DDA已补，旧计划不再把它列未实现 |
| [090] | 体素/光照/材质 | 续项 | B | 0 | 1 | 点光续项：太阳有限DDA、低分辨率漏光、形变遮挡与增量更新；当前CPU重烘105–111ms为本机样本，不是实时保证 |
| [091] | 网格/拓扑/生成 | 续项 | B | 1 | 1 | 房屋续项：任意轮廓切入、地形周边重网格及统一实例编辑；不重做已有双格/工程身份成果 |
| [092] | 网格/拓扑/生成 | 续项 | B | 1 | 1 | 158229续项：动态候选缓存、真正增量tile选择与简化导航扩展/互连；当前仅固定边缘候选探针 |
| [093] | 体素/光照/材质 | 续项 | B | 0 | 1 | 125983续项：同楼对多高度衣绳、形变墙面/屋顶精确避让与完整衣物造型；当前共享体素保守包络 |
| [094] | 网格/拓扑/生成 | 缺口 | B | 1 | 1 | 视觉缺口：中央放射格过细，塔顶比例偏高；改中心四边格模板并审核屋顶适配，不把运行通过当作原片视觉通过 |
| [095] | 网格/拓扑/生成 | 续项 | B | 1 | 1 | 规则补丁续项：更接近原作的四边格/八向放射模板库、复杂孔洞、多补丁和过渡重网格；先保留拒绝机制，不降低几何门槛 |
| [096] | 植被/灌木/天气 | 续项 | B | 1 | 1 | 顶点对偶续项：统一植被区域采样、完整可走导航输入及悬崖/形变贴附，当前候选点仅诊断 |
| [097] | 其他 | 续项 | B | 1 | 1 | 边境四步剩余：Bezier与原三角图联合细分两侧场，多个前线相交/缝合、纹样和地名；旧14帧不重复学 |
| [098] | 网格/拓扑/生成 | 续项 | B | 2 | 3 | 多格后续：通用模块身份及统一撤销栈，完整轮廓socket/旋转和联合WFC |
| [099] | 建筑/模块 | 续项 | B | 2 | 2 | 后续拥挤：体型窄道重路由、弯道/多岔口与完全重叠；其余建筑/地形模块继续按映射推进 |
| [100] | 网格/拓扑/生成 | 续项 | B | 2 | 3 | 局部网格续项：完整prefab/socket、形变碰撞、周边补网/接缝与联合WFC |
| [101] | 烟火/战斗表现 | 续项 | B | 0 | 2 | 火焰剩余视觉差距：Points与quad/noise轮廓、动态火光；不重复已完成全帧学习 |
| [102] | 其他 | 续项 | B | 2 | 2 | 形变侧壁/斜坡脚高插值与精细模块portal |
| [103] | 其他 | 续项 | B | 1 | 1 | 弯道、多岔口与真实北境单位的拥挤/碰撞压力测试 |
| [104] | 网格/拓扑/生成 | 续项 | B | 1 | 2 | 多格实例身份持久化与统一撤销/存档，再补预制轮廓socket和联合WFC |
| [105] | 导航/流场 | 续项 | ✔ 已收口（第 145 轮 · 2/2 片） | 0 | 2 | 第 145 轮：`1897266928961700215`（108 帧·彩色版）+ `1890018647655272491`（243 帧·黑白镜像版）**两条一并 done** —— note 挂的「完整室内/弧顶、门口版式、参考纹样复杂度、真实World可选贴面」核实**全部已有实现**（`doodle-hallway-layout.js` 展开面 (s,v) + 转角断板 + 门位独占一跨 + density/mirror，`doodle-hallway.js` 一张贴图跨转角/跨 cove 连续 + `buildDoor` 扇窗 + `buildStairs` 6 级，`doodle-overlay.js` 共享 World 贴面走 `setDebug('doodlewall'/'doodlegray')`），r56 只出了 node 测试 → 本轮补 `tests/doodle-hallway-browser.cjs`：展开贴图逐像素 **7 种分区底色**、墨线 12.38%（黑白 13.48%，原片 0060 同判据 12.93%）、门位内墨点 **0px**；护墙板顶线回归斜率 **0.3914** vs `rise/(s1−s0)=0.3913`、残差 0.0025m（非锯齿）、平段 0.96；逐板镜像差 **0.0026**（关镜像反向对照 0.6576）；黑白版 plan 逐字段同、顶点同 17700、彩色底 0 种；`?t=0` 钉相机后同状态噪声 **0px**、彩色↔黑白 479986px；共享 World 贴面 **248 面/1488 顶点**、开关差 62318px（offset 抬到 0.012 对照 66189px → 可见性非假象）。美术差：纹样为程序化替身，非原作手绘鱼群/大狗/蝴蝶结；黑白「更密」是同一纹样库乘子。 |
| [106] | 体素/光照/材质 | 续项 | B | 1 | 3 | 新增原版模块补差：三场半影/CPU快照指标；保留已验收GPU快照与太阳gizmo |
| [107] | 烟火/战斗表现 | 续项 | B | 0 | 1 | 原版新增housekit：保留既有房屋管线，后续读README/逐帧再核原层高/坡度/烟囱约束与接口；目前仅静态对应 |

---

维护约定：每轮收口后只改两处 —— 本表对应行的**路径**（A/B→✔ 已收口）与 `coverage-progress.json` 的 `next`。不要把本表当唯一事实源，真正的事实源仍是 `learn/data.js` 的 status 与 `artifacts/coverage/<id>-review*.md`。
