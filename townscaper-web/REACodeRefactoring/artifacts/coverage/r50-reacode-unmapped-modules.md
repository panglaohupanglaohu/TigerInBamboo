# 第 50 轮 · REACode 新增而 REACodeRefactoring 未映射的 9 个模块（逐个读源码 + lab + README 原文后重构）

比对方式：`REACode/src/*.js + engine/*.js`（170 个）对 `learn/coverage.json` 的 source（161 个）→ 9 个未登记：
cavepath / foliageblob / megatex / mixedwfc / quadinf / socketrock / triflowfield / uidecor / walkreach（都是原版并行新增的「缺口实验」，各自 + `*lab.html`）。
帧证据沿用各片已全帧核过的记录（285/285，不重计）；这里只核对代码。重构口径：不照抄独立实验，而是把机制接进共享系统、写 node 测试。

| REACode 模块 | 片子（README 原文） | 重构落点 | 测试 | 状态 |
|---|---|---|---|---|
| src/quadinf.js | 1151137783785771008 "aperiodic infinite deterministic irregular relaxed quadrilateral grid" | core/infinite.js：`buildInfinite({origin})` 任意块中心开窗口 + `windowSeam` 量重叠区；原版是「按坐标寻址 + halo 松弛」，重构版本来就是块 / 簇各自松弛、外圈钉住，这里补上「窗口可平移」并实测 raw/patch/blend 重叠处逐位一致（原版松弛后接缝不为 0，这是两种做法的真实差别） | tests/infinite-window.mjs | 已迁移/增强 |
| src/triflowfield.js | 972829402873716737 "the triangular flow fields we use for pathfinding and combat" | world/navmesh-flow.js：`buildPolyField`（面级 Dijkstra + 顶点测地场挑出口）、`portalsAlong`、`funnelPath`（沿用原版修过的漏斗手性）、`shortcutPath`（视线捷径，不跨崖缝 / 不相邻层）、`pathStats`；换到共享凸多边形导航面（可跨层坡道） | tests/navmesh-funnel.mjs | 已迁移/增强（未接 battle.js） |
| src/walkreach.js | 917405214638006273 "a heuristic for deliberately generating navigable levels" | terrain/walk-reach.js：共享 World 真实地形上的可走分量（单步 ≤1 层）、忽略高度的陆地路线、崖边计数、沿路线补台阶（低侧加高 / 高侧削一层，取新增断边少的，不来回改同一格） | tests/walk-reach.mjs | 已迁移/增强（个别图可达比例会降，如实记录） |
| src/socketrock.js | 1164926304640229376 "WFC running at interactive speed on that funky grid" | core/wfc.js：`diagnoseTiles`（真实多边形网格上不做决策的 AC 传播 → 死 tile；无人接的接口；边界锁定选项） | tests/wfc-diagnose.mjs | 已迁移/增强 |
| src/foliageblob.js | 1580158269267406849 "Can you make good looking foliage from Marching Cubes-blobs? Maybe?" | core/canopy.js：`kernel:'metaball'`（Wyvill 核求和，单包半径保持 r）；接缝折痕 11.4°→6.7°，分开的两包之间鼓起相连 | tests/canopy-metaball.mjs | 已迁移/增强 |
| src/megatex.js | 1481661852887265288 "Yet another light baker … Normals … SDF … AO" | light/texel-owner.js：共享 core/atlas.js 打包 + owner 表反查（像素→面 + u,v、逆映射）、垫边、双线性串色诊断、mip 混面比例 | tests/texel-owner.mjs | 已迁移/增强（未接烘焙器） |
| src/uidecor.js | 1201179450668441600 "Icons!" / 1024679338292256769 "Some UI flair" | ui/icon-ink.js：`inkBalance`（等墨量线宽）、`iconSvg`、`foldClosure`；接进共享 ui/icon-toolbar.js（item.paths → 内联 SVG，整组统一墨量） | tests/icon-ink.mjs | 已迁移/增强 |
| src/cavepath.js | 906416813810049025 / 890611046435627008 | 共享 world/battle-navigation.js 分层导航本来就带层号：同一平面格「穿洞 1 层 / 翻越 4 层」两条路线，单值高度场会把穿洞段抬 3 层 | tests/cave-route-layers.mjs | 已合并（测试确认） |
| src/mixedwfc.js | 1447494168448753667 "a mix of triangular and square tiles (squares cut along each diagonal …)" | core/wfc.js + core/grid.js 混合网格：重构版直接在真实三角 / 四边形格上解（tile 边数 = 格边数），不需要把方格拆成 4 个三角再捆绑 | tests/wfc.mjs（既有） | 已合并（静态确认；未做「方格 = 4 三角」的捆绑表示） |

全部 node 测试见 CHANGELOG 第 50 轮；浏览器未跑（本 VM 无 Chrome）。
