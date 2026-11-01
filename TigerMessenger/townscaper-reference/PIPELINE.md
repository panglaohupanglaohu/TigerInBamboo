# PIPELINE — 管线图与学习路线

> 页面版：`pipeline.html`（可播放每段视频）；场景里的导航：`index.html` 右侧「学习导航 · 管线」。

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

**验收**：index.html 勾「网格线」：格子接近正方形、无凹格；下一步把 cells 换成半边结构后，同一张图里能同时有三角格和方格。

### 1. 共享体素场：地形和建筑读同一份数据（共享底座（基础能力） · 部分）

Bad North 的原话：所有关卡共享一个"虚拟体素空间"，光照、法线、碰撞、风都从它来。地形管线和建筑管线若各存一份数据，就永远融合不了。

**要学的视频**

- `931196707236392960` [2017-11-16] My generated levels all keep a virtual voxel space. It is used for light baking, soft normals, various 3D textures, simplified collision, wi
- `1168571866405097472` [2019-09-02] A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture 
- `1120036868966502401` [2019-04-21] It's marching squares on irregular quadrilateral grids

**可以直接引用的代码**

- src/town.js · Town：每格一个层位掩码 solid[]、colors[]、regions()
- src/townmesh.js · #bakeLighting：按层栅格化的占用图（已经就是体素空间的雏形）

**验收**：同一个 Town 对象：地形格用 mode=terrain 渲染、建筑格用 townmesh 渲染，AO 栅格跨两者连续。

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

**可以直接引用的代码**

- src/shore.js · buildShore(town, grid, index, {posts}) → { skirt, waves, shoreLine, seaLine }
- src/shore.js · makeWaveMaterial()（循环顶点着色器）
- engine/watervol.js

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

**可以直接引用的代码**

- src/townmesh.js · #bakeLighting（建议抽成 src/lighting.js 供地形共用）
- src/scene.js · setTimeOfDay(day|dusk|night)

**验收**：index.html 开关「分层 AO」「只看光照」对比；夜晚窗户发光。

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

### 7. 融合：房子 tile 跨格、拼进地形（融合 · 第三个项目 → 球面 · 未做）

第三个项目的核心原话："combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)"、"splice houses into the terrain"。在本仓库里的第一步：地形用 engine 的台地生成到同一个 Town 上，房子直接用 TownMesh 长在台地顶上。

**要学的视频**

- `1579483114178768898` [2022-10-10] Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like
- `1584623053061099520` [2022-10-24] I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful insert them at will t
- `1582293326815862786` [2022-10-18] I thought it would be too expensive to properly evaluate each tile placement. But! While the number of possible tiles is indeed very large, 
- `1751932427272909032` [2024-01-29] I can now force specific modules to appear. To do this I first generate the specific bit of grid they need. A large module like this would b
- `1654401054828638214` [2023-05-05] An quaint island being procedurally generated
- `1669315384619540487` [2023-06-15] The generator consistently spits out pretty cool islands now

**可以直接引用的代码**

- src/quadgrid.js + engine/mesa.js（同一张网格上生成地形高度）
- src/townmesh.js（只对"建筑格"出房子）
- src/shore.js（陆地格决定岸线）

**验收**：未做：完成后 index 里能看到悬崖台地上长出 Townscaper 式房子，岸浪同时绕着地形和码头。

### 8. 球面：同一套管线放到星球上（融合 · 第三个项目 → 球面 · 未做）

他 2020 年就在试球面三角化，2024 年"put this on a sphere"。到这一步，网格要有每格的局部"上方向"，水是一层球壳，高山要做防蘑菇化松弛。

**要学的视频**

- `1338825080844021760` [2020-12-15] Apropos of nothing, a take on the ancient issue of generating nice triangulated spheres 1. Random points 2. Space out the points 3. Triangul
- `1338829205157646336` [2020-12-15] Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection. (Many people have done this before m
- `1768627849529893109` [2024-03-15] For reasons I will not be explaining at this point I've gone and put this on a sphere
- `1769641473895432220` [2024-03-18] In cute tile based planets like this you often get a "mushrooming" issue where tall mountains get weirdly wide. I managed to mitigate this b
- `1795831296952041691` [2024-05-29] I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)

**可以直接引用的代码**

- src/quadgrid.js 的松弛（换成球面切平面上做）
- engine/relax.js
- src/townmesh.js（把 y 轴换成格子法线）

**验收**：未做：完成后应有一个 sphere.html，能旋转星球、在上面建房、看到环绕的岸浪。

## 管线图

### 共享底座（基础能力）

三个项目都在用、而且一直在迭代的能力：网格、水层、光照。index 里能直接开关的就在这一层。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| Townscaper 不规则四边形网格 | `1147881669350891521` | 已实现 | src/quadgrid.js |
| 无限网格：patch + cluster 拼接 | `1332410042784641026` | 未做 |  |
| 三角 + 方格混合网格（新项目） | `1447494168448753667` | 未做 |  |
| 球面三角化 | `1338825080844021760` | 未做 |  |
| 浪裙（Bad North → Townscaper） | `1215644531221311488` | 已实现 | src/shore.js |
| 距离场浪裙 | `1664566546683899905` | 已实现 | src/shore.js · engine/shorefield.js |
| 岸线黄线 / 外推蓝线 | `1849732997945110651` | 已实现 | src/shore.js · engine/waves.js |
| 循环顶点着色器岸浪（新项目） | `1991101097818403263` | 已实现 | src/shore.js · engine/waves.js |
| 中间色倒影 | `1215644531221311488` | 已实现 | src/scene.js |
| 叠片采样 SDF 的水体 | `1758251637280268481` | 在 engine | engine/watervol.js |
| 分层 AO | `1168571866405097472` | 已实现 | src/townmesh.js |
| 彩色反弹光 | `1237305125070426112` | 已实现 | src/townmesh.js |
| 柔和投影 | `1305948413872267265` | 已实现 | src/scene.js |
| 时段 / 夜里亮窗 | `1313840428685447170` | 部分 | src/scene.js |
| 只看光照（调试视图） | `1313841094069817344` | 已实现 | src/scene.js |
| 逆光边缘 | `1751945034851570056` | 在 engine | engine/backlit.js |
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
| 6 围合 → 后院 | `1238474550511308800` | 已实现 | src/townmesh.js |
| 7 楼梯、灯塔等特殊图案 | `1181464374839521280` | 未做 |  |
| 8 鸟 / 蝴蝶 | `1244892370392489989` | 未做 |  |
| 9 存档字符串 / 撤销 | `1198957499027795969` | 已实现 | src/save.js · src/app.js |

### 地形管线 · engine

高度场 / tile → 悬崖与软坡 → 河流 → 平滑 → 贴图 → 植被、云 → 风雪。Bad North 起步，第三个项目里成熟。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| 1 岛屿高度场 + 导航（Bad North） | `1097458505315946496` | 在 engine | engine/islands.js |
| 2 台地 / 悬崖 + 软坡 | `1447488323845509121` | 在 engine | engine/mesa.js |
| 3 河流：深度优先坍缩 | `1769691526924292506` | 在 engine | engine/rivers.js |
| 4 按边类型的层级平滑 | `1670720537662836736` | 未做 |  |
| 5 防"蘑菇化"的 relax | `1769641473895432220` | 在 engine | engine/relax.js |
| 6 沉积线 / 大笔触贴图 | `1699146321318314094` | 未做 |  |
| 7 树：八角 impostor | `1849427564034498642` | 未做 |  |
| 8 云（与树共用 impostor） | `1852334860137849222` | 未做 |  |
| 9 风场（Bad North） | `926903893866541057` | 未做 |  |
| 10 雪花随风绕岛（Bad North） | `943230624369868800` | 未做 |  |
| 11 背景雾 | `906207980802252801` | 未做 |  |

### 融合 · 第三个项目 → 球面

把地形管线和建筑管线放到同一张网格上：三角+方格 tile、房子 tile 跨格、拼进地形，最后上球面。这是下一步要学和做的。

| 步骤 | 视频 | 状态 | 代码 |
|---|---|---|---|
| 1 三角 + 方格 tile 的 WFC | `1447494168448753667` | 未做 |  |
| 2 不规则网格 + 多格 tile（房子跨格） | `1579483114178768898` | 未做 |  |
| 3 悬崖笼形变形 | `1579478470098243584` | 未做 |  |
| 4 房子拼进地形 | `1584623053061099520` | 未做 |  |
| 5 强制放置特定模块 | `1751932427272909032` | 未做 |  |
| 6 放到球面 | `1768627849529893109` | 未做 |  |
| 7 星球上的防蘑菇化 | `1769641473895432220` | 在 engine | engine/relax.js |
| 8 沿河的导航结构 | `1795831296952041691` | 未做 |  |

