# PIPELINE — 管线图与学习路线

> 页面版：`pipeline.html`（可播放每段视频）；场景里的导航：`index.html` 右侧「学习导航 · 管线」。
>
> **状态以 `learn/pipeline.js` 为准。** 这份 md 是早先手动抄下来的，表里的「状态」比代码落后：
> 2026-10-31 15:20 已把 `learn/pipeline.js` 里 8 条过时的 `todo` 改成实际状态（球面三角化、树/云 impostor、
> 沉积线 + 大笔触、鸟、光体积 GI、贴图面阴影、体素阴影、三角图体检），但**没有重抄回本文**。
> 想知道某条到底做没做，看 `pipeline.html`，或直接 `ls engine/`。

## 判断

**Bad North 不是两者的综合，是祖先；融合发生在 Townscaper 之后的第三个项目，最终落到球面。**

| 时期 | 项目 | 特点 |
|---|---|---|
| 2017–2019 | Bad North | 方格体素岛：地形、房子、士兵、风、雪共用一个虚拟体素空间 |
| 2019–2021 | Townscaper | 不规则四边形网格，只有建筑；水的方案沿用 Bad North |
| 2021–2025 | 第三个项目 | 不规则网格 + 多格 tile，房子拼进地形，最后上球面 |

- `1579483114178768898` "combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)" —— 一个房子 tile 同时跨一个方格和一个三角格
- `1584623053061099520` 把房子拼进地形：房子大多属于预制 tile
- `1768627849529893109` "put this on a sphere" —— 地形 + tile 上了球面
- `931196707236392960` Bad North：所有关卡共享一个虚拟体素空间，给光照烘焙、软法线、3D 贴图、碰撞、风模拟共用

还要纠正一点：网格线是 Townscaper 的基础；但岸线黄/蓝线、浪带线框来自第三个项目（2023–2025），它们属于三个项目共用的水层。README 里没有雨；风和雪只出现在 Bad North 期。

## 学习路线

### 0. 统一网格：一张能同时承载地形和房子的图（共享底座（基础能力） · 部分）

三个项目的分水岭都在网格：Bad North 是方格，Townscaper 是不规则四边形，第三个项目是三角+方格混合，最后上球面。先把网格抽象成"任意多边形 + 半边结构"，后面所有管线都只依赖这一层。

**要学的视频**

- `1147881669350891521` [2019-07-07] I present: Fairly even irregular quads grid in a hex Todo: 1. Heuristic to reduce (or eliminate) 6 quad verts 2. Tile these babies to infini
- `1151770831619534848` [2019-07-18] I figured out how to make do with relaxation clusters of 3 instead of 7, which means I have to generate fewer unrelaxed patches before I can
- `1332410042784641026` [2020-11-27] How the infinite grid is relaxed and kept seamless: The grid is made of Patches. Adjacent triplets form Clusters. Clusters and Patches are r
- `1458921394855718917` [2021-11-11] I'm exploring the Half Edge data structure. Feels like a really lightweight, powerful and versatile way of representing topology. A big than
- `1447496205282549761` [2021-10-11] The base graph is just a humble irregular triangle grid
- `1447494168448753667` [2021-10-11] Long time fans of the show will not be surprised to learn that this is indeed running on tile based WFC. This time around, I'm getting the b

**可以直接引用的代码**

- src/quadgrid.js · buildQuadGrid() → { cells[{pts, edgeNeighbors, cornerNeighbors}], verts, vertexCells }
- src/town.js · buildCellIndex() / pointInQuad()
- src/halfedge.js · buildHalfEdge(cells) → { hes[{next, prev, twin, from, to, face}], loops, rings }（n 边形通用，不假设四角）
- src/halfedge.js · mixedTopologyCheck(cells) / mixedWire(cells)：把 45% 四边形沿对角线切开做混合网格自检

**验收**：index.html 勾「网格线」：格子接近正方形、无凹格；勾「半边结构」：黄色风车是 `he.twin.next` 绕顶点转出来的，转得顺就说明拓扑对；勾「三角+方格」：混合网格的线框（含对角线）压在岛上。

**已量**（seed 默认，2516 格）：半边 10064 = 4×格数，内部边 4948 全部成对，边界 1 圈 168 条边，顶点 2601，V−E+F = 1（圆盘）。把 45% 四边形沿对角线切开后：1352 四边形 + 2328 三角 = 3680 格，同一套结构仍然 V−E+F = 1、2433 个内部顶点环全闭合、0 条非流形边。

**还没做**：`cells` 没有被替换成半边；`src/townmesh.js` 仍按 `pts[0..3]` 读四边形；WFC 的 tile 表还没建。

### 1. 共享体素场：地形和建筑读同一份数据（共享底座（基础能力） · 部分）

Bad North 的原话：所有关卡共享一个"虚拟体素空间"，光照、法线、碰撞、风都从它来。地形管线和建筑管线若各存一份数据，就永远融合不了。

**要学的视频**

- `931196707236392960` [2017-11-16] My generated levels all keep a virtual voxel space. It is used for light baking, soft normals, various 3D textures, simplified collision, wi
- `1168571866405097472` [2019-09-02] A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture 
- `1120036868966502401` [2019-04-21] It's marching squares on irregular quadrilateral grids

**可以直接引用的代码**

- src/lighting.js · buildVoxelField({ sets })：任意多份体素集（地块 + 房子，各带自己的 y 偏移）栅格进同一组层，模糊一次
- src/lighting.js · bakeVertexAO()（CPU）与 makeLightingUniforms()/patchMaterial()（贴图在顶点着色器里采样），两套数学完全一致
- src/terrainmesh.js · 地形就是 Town 的列，不是另一套高度图

**验收**：`fusion.html` 里地块和房子写进同一个 `buildVoxelField()`，AO 由贴图在顶点着色器里采样。关掉「共享体素场 AO」，房子的墙角和崖脚就不再被台地压暗 —— 这正是两块网格各烘一遍时丢掉的那部分。

**已量**：同机位近景 A/B，AO 开/关 38.3% 像素变化 > 6/255、平均差 4.7/255、max 196。

**还没做**：风场、碰撞、软法线还没接进这份场（`931196707236392960` 里那四项只做了光照）；脏区增量已做（`src/lightingcache.js`）：只重刷改动的格子、只重模糊 rect ± R·P；与全量重烤逐 texel 一致（6 种编辑 badTexels 全 0），场 4.3ms → 0.5ms，整城 rebuild 中位 9.5ms → 5.3ms。

### 2. 地形管线：岛 → 悬崖/软坡 → 河流 → 平滑（地形管线 · engine · 在 engine）

先有地，才有房子的落脚点。第三个项目里地形也是 tile + WFC，河流单独深度优先坍缩，最后按边类型做层级平滑。

**要学的视频**

- `1447488323845509121` [2021-10-11] I'm able to do a couple of things here I've always wanted to, but never been able to before: - Properly combine seamless soft slopes with di
- `1769691526924292506` [2024-03-18] Mega river system! I've had trouble making good rivers before. Now I've sort of special cased the rivers by collapsing them depth-first to l
- `1670720537662836736` [2023-06-19] I smooth my mesh according to an edge type hierarchy. Black is hard, red is game-tile-border and blue is material-border. Verts only get to 
- `1670725072540106755` [2023-06-19] Here's a comparison showing no-, dumb- and hierarchical smoothing. The hierarchical smoothing helps preserve the intent of the input-tiles w
- `1579478470098243584` [2022-10-10] To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells.
- `1769641473895432220` [2024-03-18] In cute tile based planets like this you often get a "mushrooming" issue where tall mountains get weirdly wide. I managed to mitigate this b

**可以直接引用的代码**

- engine/mesa.js · 台地量化
- engine/rivers.js · 深度优先开河
- engine/relax.js · 防蘑菇化松弛

**验收**：engine/world.html 里能看到悬崖与缓坡共存、河流从高处流到海里不打转。

### 3. 建筑管线：体素列 → 模块 → 支撑 → 道具 → 后院（建筑管线 · Townscaper · 已实现）

Townscaper 的全部：按邻居状态选模块。这里先用规则生成几何，后续可替换成"角点取值查模块表"的 WFC，以便和地形 tile 混在一起。

**要学的视频**

- `1197909675443916803` [2019-11-22] Turns out my monitor was too saturated, making me make my colors too dull. This should be better. I've also added some building effects, gra
- `1189902695303458816` [2019-10-31] It was real fun making the steel beam support structures. They have this neat artificial yet organic feel to them. Its a place where the WFC
- `1189908238566903808` [2019-10-31] However, if you are more careful in providing structural support you'll get curvy brick arches instead and you can build these neat airy cat
- `1238474550511308800` [2020-03-13] I needed some more greenery, so now if you build an enclosed area it becomes a backyard!
- `1205416648397721601` [2019-12-13] New prop placement system! It tries to place as many props as it can without overlap. I use it for doors and windows too, which means they a
- `1279107097108635649` [2020-07-03] Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them.

**可以直接引用的代码**

- src/townmesh.js · TownMesh(town, grid).rebuild() → 单个合并网格 + posts
- learnpanel 的「去看」：拱门 / 钢架 / 后院 / 山墙

**验收**：index.html 建筑管线里每一步都能「去看」；拖动建造时屋顶、山墙、拱、后院自动出现。

### 4. 水层：浪裙 → 岸线浪 → 倒影（共享底座（基础能力） · 已实现）

三个项目都在迭代同一层水。它只依赖"哪些格是陆地"，所以天然是地形和建筑的公共层。

**要学的视频**

- `1215644531221311488` [2020-01-10] The technical solution is almost the same as in Bad North. One big difference is that the bright colors wouldn't let me get a way with a mon
- `1664566546683899905` [2023-06-02] Here's a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters I guess... But I would l
- `1849732997945110651` [2024-10-25] Here, the shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in blue. The waves travel from the blue line to the yel
- `1849730611964973481` [2024-10-25] Shoreline waves! This is something I've tackled many times. Although this one is very subtle, it's my favorite thus far. Instead of trying t
- `1991101097818403263` [2025-11-19] It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offs
- `1758251637280268481` [2024-02-15] It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe than the basic flipped mesh approach in Bad 
- `1758250248483278925` [2024-02-15] New water reflection I'm quite happy with —— 水里没有镜像细节，只有一团竖向拖长的暗块；**已落地**：`src/reflstreak.js`（1/4 镜像 + 竖向拉丝 + 深度淡出 + 水线亮边），拉丝核 33×5px、纵横比 6.6，见 `bouncelab.html`（④）

**可以直接引用的代码**

- src/shore.js · buildShore(town, grid, index, {posts}) → { skirt, waves, shoreLine, seaLine }
- src/shore.js · makeWaveMaterial()（循环顶点着色器）
- engine/watervol.js
- src/reflstreak.js · buildComparison(render, field, light) → { mirrored, streaked, numbers }（拉丝核 / 横竖梯度 / 竖向自相关）

**验收**：index.html 勾「岸线黄/蓝线」「浪带线框」：浪从蓝线走到黄线再退回一点，海湾不折叠。

### 5. 光照：分层 AO → 彩色反弹 → 时段 → 光体积 GI（共享底座（基础能力） · 部分）

他每个项目都自己写光照。分层 AO 已经能同时服务地形和房子；下一步是 SDF + 光体积的多次反弹。

**要学的视频**

- `1168571866405097472` [2019-09-02] A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture 
- `1237305125070426112` [2020-03-10] Obviously, a big benefit of this is that with white finally in my palette, I can properly show off the colored "bounce" "light" of my custom
- `1313840428685447170` [2020-10-07] I added some sunlight (with shadows) and a gizmo to control it
- `1580845127207387137` [2022-10-14] 1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in the mega texture! 2nd is a baked 6 dire
- `1580846877855338497` [2022-10-14] Here's the slowed down bounce sequence. You can see how the mega texture and the light volume affect each other back and forth. After about 
- `1791049306213912823` [2024-05-16] Trying out a new lighting solution. This one is just one lookup in the vertex shader of a low res cube map height map.
- `1580835075629133825` [2022-10-14] I always write my own lighting solutions. ... this is my first decent attempt to actually have the light *bounce* —— **已落地**：`src/bouncegi.js`（视线因子求积，不是栅格扩散），暗部 0.182 → 0.230（一跳）→ 0.254（两跳），见 `bouncelab.html`（①）
- `1481661852887265288` [2022-01-13] Yet another light baker. ... 1. Normals (procedurally painted in big chunky strokes) 2. 3D SDF 3. 3D AO in ±X ±Y ±Z —— ②③ 在 `src/lighting.js`（`buildSDF` / `bakeSixDirVolume`），**① 大笔触法线本轮补上**：`src/paintnormal.js`（25 块 / 倾斜 18° / 平几何 74.8% 像素有细节）
- `1298689301488775169` [2020-08-26] Flat texture, shaded, lighting only, and my AO baking mesh —— 四档调试视图已做成 `bouncelab.html` ① 右上按钮（flat / shaded / light only / AO）

**可以直接引用的代码**

- src/townmesh.js · #bakeLighting（建议抽成 src/lighting.js 供地形共用）
- src/scene.js · setTimeOfDay(day|dusk|night)
- src/bouncegi.js · directLight / bounce / bruteForce / renderRay / audit（自带蒙特卡洛对证）
- src/paintnormal.js · paintNormal({chunks, maxTiltDeg}) → 切线空间法线图 + shadeWithNormals / audit

**验收**：index.html 开关「分层 AO」「只看光照」对比；夜晚窗户发光。

对照页 `bouncelab.html`：① 三联光反弹（直射/一跳/两跳）+ 四档视图 ② 反弹落点增量图 ③ 大笔触法线 vs 几何法线 ④ 镜面 vs 竖向拉丝。

### 5b. 只在边上长的东西 + 采样方式（地表细节 · 已落地）

- `1590669875869286400` [2022-11-10] grass billboards —— "a completely new kind of shape and detail frequency"；**已落地** `src/edgeplant.js · placeGrassBand`：1723 片，卡片中位 = 岛宽 **5.8%**（参考 5.6%），边缘覆盖 100%
- `1707490274425884929` [2023-09-28] "lil' shrubbery at the edges of things"；**已落地** `placeRimShrubs`：352 坨，岛宽 **3.5%**（参考 3.3%），最小间距 3.2 格
- `1290997501332525056` [2020-08-05] "garden paths"；**已落地** `placeGardenPath`：墙脚退 0.75 格一条带 + 135 颗球灌木，带宽 0.125。判据与崖沿**相反**（自己低、邻格高）
- `1241046107125399552` [2020-03-20] 32² 角落 + every-other-pixel-is-a-line；**已落地** `src/texelsnap.js`：边缘 5px → **1px**（参考 1.0px），缩放漂移 0.51 → 0.36
- `1061229717582475264` [2018-11-10] "break up that repetition by using a few different ones with different settings (all still using the same texture)"；**已落地** `src/repeatbreak.js`：自相关峰 **1.000 → 0.315**，低频 std 0.215 → 0.196

对照页 `plantlab.html`（四格：采样三态 / 边缘植被 / 重复打散 / 距离场动画）。

### 6. 环境：树与云的 impostor、风场、雪、雾（地形管线 · engine · 未做）

"风雪"只在 Bad North 期出现过（风场驱动旗帜和雪花）；云在 Townscaper 和第三个项目里都有，后者和树共用 impostor。

**要学的视频**

- `1849427564034498642` [2024-10-24] Made some octagonal impostors for these trees. Might seem like overkill for such a stylized look, but they're a lot more stable when rotatin
- `1852334860137849222` [2024-11-01] A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obvious.
- `926903893866541057` [2017-11-04] Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders
- `943230624369868800` [2017-12-19] And yeah, obviously the snow flakes are affected by the wind system and thus flow around the island
- `906207980802252801` [2017-09-08] I've been working on some new fog (sped up in the gif). For background effects, subtlety is key.
- `1243228419162341379` [2020-03-26] Some moody clouds

**可以直接引用的代码**

- src/townmesh.js · blob()（现在的低多边形树，可替换成 impostor）
- src/scene.js · 光照档位（雾/天色可挂在这里）

**验收**：未做：完成后应能在 index 场景里开关风、雪、云层。

### 7. 融合：房子 tile 跨格、拼进地形（融合 · 第三个项目 → 球面 · 部分）

第三个项目的核心原话："combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)"、"splice houses into the terrain"。已做的第一版：同一张 quadgrid 上生成台地地形，房子（`TownMesh`，未改一行）整块抬到台地顶，岸浪绕着两者走，AO 来自同一个体素场。打开 `fusion.html` 就能看。

**要学的视频**

- `1579483114178768898` [2022-10-10] Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like
- `1584623053061099520` [2022-10-24] I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful insert them at will t
- `1582293326815862786` [2022-10-18] I thought it would be too expensive to properly evaluate each tile placement. But! While the number of possible tiles is indeed very large, 
- `1751932427272909032` [2024-01-29] I can now force specific modules to appear. To do this I first generate the specific bit of grid they need. A large module like this would b
- `1654401054828638214` [2023-05-05] An quaint island being procedurally generated
- `1669315384619540487` [2023-06-15] The generator consistently spits out pretty cool islands now

**可以直接引用的代码**

- `src/fusion.js` · 岛高 → 量化成体素列 → 台地（TERRACE=3）+ 沙滩 + 两处坡道 + 外圈低岩台
- `src/terrainmesh.js` · 一格落差做软坡、两格以上做崖（`1447488323845509121`）
- `src/townmesh.js` · 房子整块平移 `terraceTop * levelHeight`，mesher 一行没改
- `src/shore.js` · 岸线只看地块那一份 Town

**验收**：`fusion.html` 打开就是台地上长 Townscaper 房子、崖下是沙滩、岸浪同时绕地形；关「一格落差做成软坡」→ 台地变回纯台阶体素，两种读法都能看到。

**已量**：地形 1046 面（崖 200 侧 / 坡 52 侧）1.3ms；房子 14,781 三角（`bake=false`）；体素场 191×208×9 @0.09 = 63,796 体素，栅格 3.4ms + 模糊 13.5ms。

**还没做**：房子还不能跨格（多格 tile）；只有一级可建台地（靠整体平移对齐，一栋房子不能同时站在两个高度）；地形是噪声量化，不是 WFC tile。

### 8. 球面：同一套管线放到星球上（融合 · 第三个项目 → 球面 · 部分）

他 2020 年就在试球面三角化，2024 年 "put this on a sphere"。到这一步，网格要有每格的局部"上方向"，水是一层球壳，高山要做防蘑菇化松弛。
已做第一版 `spherefusion.html`：球极投影 Delaunay + 三角形松弛的格，每格沿自己的法线挤出体素高度；一格落差做软坡、两格以上做崖；岸线一道细白带。

**要学的视频**

- `1338825080844021760` [2020-12-15] Apropos of nothing, a take on the ancient issue of generating nice triangulated spheres 1. Random points 2. Space out the points 3. Triangulate 4. Relax using the tri
- `1338829205157646336` [2020-12-15] Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection. My points are sorted vertically, which means radially
- `1768627849529893109` [2024-03-15] For reasons I will not be explaining at this point I've gone and put this on a sphere
- `1769641473895432220` [2024-03-18] In cute tile based planets like this you often get a "mushrooming" issue where tall mountains get weirdly wide. I mitigated this by a relax pass where all module-containing cells try
- `1795831296952041691` [2024-05-29] I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)

**可以直接引用的代码**

- `src/spheretown.js` · `carveRivers()`：把「到海的距离」当势能底，再做流量累积 → 河网与湖（随机游走版本几步就到海，是错的）
- `src/spherehouse.js` · `buildSphereHouses()`：格内缩 footprint、沿格法线起墙、攒尖顶——`TownMesh` 假设 +Y 且列从 level 1 起，搬不上去
- `src/spheretown.js` · `buildSphereGrid()`（复用 `engine/sphere.js` 的球极投影 Delaunay + 松弛）→ `generateHeights()` → `buildSphereMesh()`
- `src/spheretown.js` · `smoothCoincidentNormals()`：按位置合并夹角 < 0.3 的法线，跨格平滑但保住崖角（同 `engine/normalsmooth.js` 的思路）
- `src/spheretown.js` · `buildShoreRibbon()`：岸线细白带

**验收**：`spherefusion.html` 打开就是一颗绿色星球：一格落差是软坡，关掉「一格落差做软坡」立刻变成台阶崖（同机位 A/B 6.75% 像素变化）；岸线是细白带；河网 235 格 + 湖 16 格（最大流域 50 格）；村子约 900 栋（每栋沿自己的上方向起墙）。

**还没做**：球壳岸浪（`src/shore.js` 的循环顶点着色器是按平面距离场写的）、防蘑菇化的 relax、球面版的共享体素场（`src/lighting.js` 是笛卡尔的，包不到球上；现在的 AO 只是邻域高度差）、河面没有独立水位（河道直接切到海平面）。

## 管线图

### 共享底座（基础能力）

三个项目都在用、而且一直在迭代的能力：网格、水层、光照。index 里能直接开关的就在这一层。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| Townscaper 不规则四边形网格 | `1147881669350891521` | 已实现 | src/quadgrid.js |
| 无限网格：patch + cluster 拼接 | `1332410042784641026` | 未做 |  |
| 半边结构 + 顶点环（step 0） | `1458921394855718917` | 已实现 | src/halfedge.js · src/scene.js（开关 `halfedge`） |
| 三角 + 方格混合网格（新项目） | `1447494168448753667` | 部分 | src/halfedge.js（开关 `mixedgrid`）；只到"能生成 + 能自检 + 能画"，WFC tile 未做 |
| 强制模块：先造它要的那块网格 | `1751932427272909032` | 部分 | `src/tileforce.js` ＋ `decolab.html` ①（2074 格里 6 处 / 合成 patch 7 格 0 重叠）|
| 稀有 tile 为什么永远不出现 | `1670794261669769217` | 部分 | `src/tileforce.js · auditRarity()`：指定 6 环 0 次，随机 12 格仍有 161 次（同一张 1711 格网格）|
| 不规则网格上的 WFC：交互速度 + 确定性 | `1164926304640229376` | 部分 | `src/gridwfc.js` ＋ `alivelab.html` ②：1054 格 7.3ms（14.4 万格/秒）、接口不符 0、正/倒遍历逐格差 **0**、换 seed 差 809 格；岩类 tile 0 块（边界锁 0 把 rock 沿传播链消光）|
| 球面三角化 | `1338825080844021760` | 未做 |  |
| 浪裙（Bad North → Townscaper） | `1215644531221311488` | 已实现 | src/shore.js |
| 距离场浪裙 | `1664566546683899905` | 已实现 | src/shore.js · engine/shorefield.js |
| 岸线黄线 / 外推蓝线 | `1849732997945110651` | 已实现 | src/shore.js · engine/waves.js |
| 循环顶点着色器岸浪（新项目） | `1991101097818403263` | 已实现 | src/shore.js · engine/waves.js |
| 中间色倒影 | `1215644531221311488` | 已实现 | src/scene.js |
| 叠片采样 SDF 的水体 | `1758251637280268481` | 在 engine | engine/watervol.js |
| 着色器流体：先量平台能力（流体本体未做） | `1664565063552847873` | 部分 | `src/floatprobe.js` ＋ `decolab.html` ④：RGBA32F/16F 可写、浮点线性过滤实测为真（正中采样 0.5）、60 步平流质量漂移 GPU −0.35% / CPU −0.35%、NaN 0 |
| 分层 AO | `1168571866405097472` | 已实现 | src/townmesh.js |
| 彩色反弹光 | `1237305125070426112` | 已实现 | src/townmesh.js |
| 柔和投影 | `1305948413872267265` | 已实现 | src/scene.js |
| 时段 / 夜里亮窗 | `1313840428685447170` | 部分 | src/scene.js |
| 只看光照（调试视图） | `1313841094069817344` | 已实现 | src/scene.js |
| 逆光边缘 | `1751945034851570056` | 在 engine | engine/backlit.js |
| 贴图空间的面阴影（投射高度 ≠ z 测试高度） | `1705195380457996629` | 在 engine + src | `engine/surfaceshadow.js`（先有的 GLSL 版）＋ `src/surfaceshadow.js`（顶视版 + castH×zTestH 扫描：castH 0→0.25 覆盖 7.3%→1.1% 且只剩檐下；zTestH 0.01→0.30 覆盖 7.3%→0.3%；UV 象限边界伪影 17px） |
| 山体不算法线：N·L 烘进贴图明度 | `1786014232594485497` | 在 engine | `src/mountainlight.js`（与真 N·L 相关 r：none 0.089 / baked 0.939 / runtime 0.963；采样 8→10 即 +25%）|
| 轨道相机拖影：v = ω × r | `1727315611959865407` | 部分 | `src/smear.js` ＋ `alivelab.html` ⑤：外圈位移 1.44/2.88/5.76px → 外圈锐度 p95 掉 9%/24%/32%，CPU 单帧 7–10ms（469²×5 采样，双线性）|
| SDF + 光体积的多次反弹 GI | `1580845127207387137` | 未做 |  |

### 建筑管线 · Townscaper

网格 → 体素列 → 按邻居装配模块 → 道具 → 后院与生物。index.html 的场景就是这条管线的产物。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| 1 体素列 + 角点取值 | `1120036868966502401` | 已实现 | src/town.js |
| 2 模块装配（原作 545 块，这里用规则生成） | `1279107097108635649` | 部分 | src/townmesh.js |
| 3 陡坡双坡顶 + 山墙 | `1197909675443916803` | 已实现 | src/townmesh.js |
| 4 支撑：钢架 | `1189902695303458816` | 已实现 | src/townmesh.js |
| 4 支撑：拱 | `1189908238566903808` | 已实现 | src/townmesh.js |
| 5 门窗 / 道具放置 | `1205416648397721601` | 部分 | src/townmesh.js |
| 5b 表面装饰另开一套小 WFC（窗/门） | `1181464374839521280` | 部分 | `src/surfacedeco.js` ＋ `decolab.html` ②：12 面墙 352 槽位 / 决策 334 / 推送 151 / 回溯 6 / 违约 0；搜索空间 log10 估算 422 → 173 + 每面 24.9 |
| 6 围合 → 后院 | `1238474550511308800` | 已实现 | src/townmesh.js |
| 6b 道具出现/消失：弹簧 + 错峰 | `1246074663546916873` | 部分 | `src/propanim.js` ＋ `alivelab.html` ④：出现 0.57s 落定 / 过冲 7.1%，消失 0.30s / 0 过冲，错峰 0.2s；400 道具 9600 顶点每帧重建 0.033ms vs 实例 0.010ms，增删重烤 0.30ms |
| 7 楼梯、灯塔等特殊图案 | `1181464374839521280` | 部分 | 只做了门窗装饰那一半（`src/surfacedeco.js`）；楼梯、灯塔仍未做 |
| 7b 完美环 → 飞行城镇 | `1313837640366596096` | 部分 | `src/looptown.js` ＋ `alivelab.html` ③：悬空块围出空洞（整圈 1 个）→ 0 条腿；切开一片（0 个）→ 45 条腿 / 总长 90；不开规则整圈要 53 条腿 |
| 8 鸟 / 蝴蝶 | `1244892370392489989` | 未做 |  |
| 9 存档字符串 / 撤销 | `1198957499027795969` | 已实现 | src/save.js · src/app.js |
| 10 拓扑直线：手柄导航 / 直线刷 | `1384958097542819845` | 已实现 | src/trace.js · src/app.js · src/scene.js（开关 `trace`，工具条 ╱） |

### 地形管线 · engine

高度场 / tile → 悬崖与软坡 → 河流 → 平滑 → 贴图 → 植被、云 → 风雪。Bad North 起步，第三个项目里成熟。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| 1 岛屿高度场 + 导航（Bad North） | `1097458505315946496` | 在 engine | engine/islands.js |
| 2 台地 / 悬崖 + 软坡 | `1447488323845509121` | 在 engine | engine/mesa.js |
| 3 河流：深度优先坍缩 | `1769691526924292506` | 在 engine | engine/rivers.js |
| 4 按边类型的层级平滑 | `1670720537662836736` | 未做 |  |
| 5 防"蘑菇化"的 relax | `1769641473895432220` | 在 engine | engine/relax.js |
| 6 沉积线 / 大笔触贴图 | `1699146321318314094` | 在 engine + src | `engine/surface.js · sWarp`（GLSL：世界抖→贴图→撤回）＋ `src/wobbletex.js`（CPU 版；层线峰峰 0→11.6px，W⁻¹ 4 次残差 0.84px） |
| 6b 无缝 patch 混合（投影 patch + 手工 UV patch + 按高度混） | `1781405550061687016` | 在 engine | `src/patchblend.js` ＋ `engine/texlab.html`（跨边界跳跃 0.264 → 0.050，纹理细节留 81%） |
| 6c 山体不算法线：把 N·L 烘进贴图明度 | `1786014232594485497` | 在 engine | `src/mountainlight.js` ＋ `engine/texlab.html`（r 0.089 → 0.939，运行时 +0 采样；参考帧岩石 std 0.082） |
| 6d 卡片贴图：每片一次采样 + 沿各自流向滑 | `1015149712469524480` | 部分 | `src/quadtex.js` ＋ `decolab.html` ③（两片相似度 1.00 → 0.023，滑到 t=2.5 再降到 0.007）|
| 6e fwidth 在卡片空间与世界空间之间混合 | `999185422403055616` | 部分 | `src/quadtex.js · stretchTable()`（掠射 10° 时 33.2× → 1.0×；代价：连续表面上 88% 的边被撕开 → 只能用在 billboard/贴花）|
| 7 树：八角 impostor | `1849427564034498642` | 未做 |  |
| 8 云（与树共用 impostor） | `1852334860137849222` | 未做 |  |
| 9 风场（Bad North） | `926903893866541057` | 在 engine | `src/wind.js`（400 采样速度 0.68~1.10） |
| 10 雪花随风绕岛（Bad North） | `943230624369868800` | 在 engine | `engine/snow.js`（Q 键；含 `823848950553780226` 的近地接触 AO） |
| 11 背景雾 | `906207980802252801` | 在 engine | `engine/fog.js`（厚度约岛高 1/5，对比极低） |

### 融合 · 第三个项目 → 球面

把地形管线和建筑管线放到同一张网格上：三角+方格 tile、房子 tile 跨格、拼进地形，最后上球面。这是下一步要学和做的。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| 1 三角 + 方格 tile 的 WFC | `1447494168448753667` | 未做 |  |
| 2 不规则网格 + 多格 tile（房子跨格） | `1579483114178768898` | 未做 |  |
| 3 悬崖笼形变形 | `1579478470098243584` | 在 engine | `engine/cage.js`（C 键；位移只依赖顶点基准坐标 → 不裂缝；maxShift 0.333）。本轮按 f022 核过画面：背后那层浅线是未变形的规则格，亮线才是变形的笼 |
| 4 房子拼进地形 | `1584623053061099520` | 在 engine | `src/splice.js` ＋ 对照页 `engine/splice.html`（1,082 格面积守恒 ≤1.7e-13） |
| 5 强制放置特定模块：先造它要的那块网格 | `1751932427272909032` | 部分 | `src/tileforce.js` ＋ `decolab.html`（①）：2074 格混合网格里诱导同构找到 6 处（296 次候选测试 / 0.2ms）；找不到就按模块邻接铺出来（7 格 / 13 顶点 / 重叠 0 / 0.1ms）|
| 6 放到球面 | `1768627849529893109` | 未做 |  |
| 7 星球上的防蘑菇化 | `1769641473895432220` | 在 engine | engine/relax.js |
| 8 沿河的导航结构 | `1795831296952041691` | 在 engine | `src/navgraph.js`（顺流 0.35 / 逆流 1.35）＋ `src/flowfield.js` ＋ `engine/navflow.html` |


---

## 第 9–20 轮补录（2026-10-31 ~ 11-01）

这段时间把 12 轮 / 一百多条片子过了一遍，落地的能力按管线归位。下面这张表对应
`pipeline.html` 顶部那一块「最近 12 轮新增」，每条都能指到代码与数字。

### 导航与群体（新的一层，接在共享底座后面）

| 视频 | 内容 | 状态 | 代码 |
|---|---|---|---|
| `1795831296952041691` | 河道导航：顺流 ×0.35 / 逆流 ×1.35 | 落地 | `src/navgraph.js`（同一条路线河道价 9.755 vs 走路 22.30 → 2.29×） |
| `1582293326815862786` | 路口压缩：只在坍缩边缘子图上压走廊 | 部分 | `src/navgraph.js · simplify({keep})`（河道 61 格 → 30 路口，452/452 对代价一致） |
| `816748103193817088` | 流场：一张方向场喂一群单位 | 落地 | `src/flowfield.js` ＋ `engine/navflow.html`（300 单位 0.09 ms vs 300×Dijkstra 10.6 ms） |
| `810878197134950401` | 廉价视线：直线半格采样 + 扇形扫 | 在 engine | `engine/los.js`（每 100 次 0.99 ms；误放行 1/33、误拦 0） |
| `917405214638006273` | 刻意生成可通行关卡 | 未做 | 需要把连通块约束喂回 `engine/mesa.js` |

### 地表细节（只动顶点，不涨三角面）

| 视频 | 内容 | 状态 | 代码 |
|---|---|---|---|
| `1579478470098243584` | 笼形变形（崖面更自然） | 在 engine | `engine/cage.js`（C 键；maxShift 0.333，变形后 repaired 0） |
| `1384958097542819845` | 拓扑直线（入边 → 对边） | 在 engine | `src/topoline.js`（A 键；375 格 / 120 拐 / 3.13 格一拐） |
| `959752525867036672` | 顶点格＝三角网格对偶，一瓣一株铺草 | 在 engine | `src/dual.js`（X 键；1,004 瓣 / 中位面积 0.0735） |
| `1063115611289645057` | 坡面草标出可通行坡带 | 在 engine | `engine/surface.js · uSlopeGrass`（U 键；A/B 10.83%） |
| `1007587812462530561` | 瀑布（只取落进低处的掉级） | 在 engine | `engine/waterfall.js`（Z 键；21 处候选 → 2 处可见） |
| `1699038611125985317` | 两色沉积层理（只在陡面） | 在 engine | `engine/surface.js · surfBandTone()`（edge +12.4%） |
| `1710031224838771027` | 每特征一个色容体（hue × value × sat） | 部分 | `src/colorgamut.js` ＋ `alivelab.html` ⑥：平均体量 ΔE 23.8、每特征 4–11 种可辨色；代价是分离度（特征最小 ΔE 9.4 草×树冠，比单色板 16.6 低）|

### 生物与天气

| 视频 | 内容 | 状态 | 代码 |
|---|---|---|---|
| `926903893866541057` | 风向量场 | 在 engine | `src/wind.js` |
| `926890207298899969` | 旗面沿虚拟风粒子轨迹（燕尾 + 白徽记） | 在 engine | `engine/flags.js`（I 键；84/91 顶点在动） |
| `1273520600221433857` | 蝴蝶绕"可能的落点" + 世界噪声 | 在 engine | `engine/butterflies.js`（F 键） |
| `823848950553780226` | 粒子接触 AO | 在 engine | `engine/snow.js`（离地 0 → alpha 0.35） |
| `906207980802252801` | 贴海薄雾 | 在 engine | `engine/fog.js` |

### 表面与配件

| 视频 | 内容 | 状态 | 代码 |
|---|---|---|---|
| `1176516621223043073` | 窗的密度与列对齐 | 在 engine | `engine/props.js`（墙长 0.45→2.2，窗数 1..6，间距 CV=0） |
| `1017355723171344385` | 描边线宽 ×DPR | 在 engine | `engine/outline.js · setThickness()`（DPR2 → 1.6） |
| `929417420921556993` | 平滑/硬法线在最终光照里混合 | 在 engine | `engine/surface.js · uNormalMix`（近景 A/B 8.33%） |
| `793557992931266561` | AO 四档对照 | 在 engine | `src/voxelao.js` ＋ `engine/aoviz.html` |
| `1191990107785572352` | billboard 锚定中心顶点 | 在 engine | `engine/impostor.js · aAnchor / uBend`（图集不用重烘） |

### 工具与对照页

| 视频 | 内容 | 状态 | 代码 / 页面 |
|---|---|---|---|
| `1764958522398146667` `1765041830461055127` `1765115069837221962` | 二叉树矩形打包（撒点 / 删除合并 / 递归手臂） | 在 engine | `src/rectpack.js`（填充 0.813 vs 货架 0.572） |
| `938422757288792064` `938405900573986816` | 连通分组 + 区域散开 | 在 engine | `src/grouping.js`（12 组 / 切边 6.7%） |
| `1670790425232175108` | 三种网格对照 | 在 engine | `src/gridmodes.js` ＋ `engine/gridmodes.html` |
| `1104771432440049664` | 镜像距离场 UI 花边 | 在 engine | `engine/ornament.js` ＋ `engine/ornament.html` |

> 一个还没解决的问题（流场那一轮量出来的）：`navgraph.adj` 只看台阶差，同一座岛换目标后
> 可达面积从 69.2% 掉到 23.2% —— 岛被切成几个互不连通的块。这属于"生成时就要保证连通性"
> 的范畴，对应 `917405214638006273` 那条启发式，排在下一步。
