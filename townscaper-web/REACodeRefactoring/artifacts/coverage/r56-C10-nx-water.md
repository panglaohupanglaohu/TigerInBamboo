# 第 56 批 C10（第三项目 水/展示，16 条）

端口 8810；浏览器 headless Chromium+SwiftShader（tools/shot.py），截图都用 Read 打开看过并与片子联系表/原尺寸帧对照；控制台 0 error（只有共享 View 已有的 toNonIndexed warning）。

## 本批新增
- `src/water/foam-mask.js`（纯 CPU、node 可测）：rasterLand / chamferDistance / landFraction / buildFoamMask（全局水面泡沫遮罩）/ ObstacleFlow（MAC 压力投影绕岛流+半拉格朗日染料）/ auditWavePaths / clampWavePaths（浪带防穿岸）。
- `src/world/view-c10.js`：`?c10=foammask,fluid,shoreclamp`（默认全关），运行时 `rea.c10.set(name,on)`、`rea.c10.auditShore()`、`rea.c10.stats`。
- `src/world/app.js`：只加 2 行挂钩（注释 + 动态 import）。未改 view.js / shore.js 等共享文件。
- `tests/foam-mask-c10.mjs`：泡沫（独石>直岸>深湾、陆地 0、远海 0）、流场（陆地面通量 0、散度下降 >95%、迎流面转向、两侧加速、驻点减速、陆地染料不变、f16 误差有界）、穿岸审计与收回。
- 全量 `tests/*.mjs` 302 个全过。

## 实测数字
- foammask：town 246×257 栅格 12ms；terrain 337×371 15ms。
- shoreclamp：town 1344 段浪带顶点路径穿岸 17.3%→0.6%；terrain 1744 段 11.7%→0.9%（残余是审计 24 采样与修复 32 采样的取整差）。
- fluid：terrain 244×261，投影 283ms（一次性），每步 2-5ms；散度 25.5→0.16，陆地面通量 0。

## 1991103578011029507（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "I think it gives a pretty good sense of a dynamic ocean without being too distractive" | 固定教堂岛，近岸一圈分段白色浪峰，克制的动态海面 | 无具体缺项（旧轮已补分段浪峰，GPU 对照过）；没有本批截图对照 | 复核：共享 shore.js 分段浪峰默认开；本批截了 terrain 近景（岸浪带分段、断续），另 ?c10=foammask 叠加岩边碎泡沫，与原片「岸边一簇簇白块」一致 | done | src/water/shore.js · src/core/wave-cycle.js · src/world/view-c10.js（foammask） | tests/wave-cycle.mjs、tests/foam-mask-c10.mjs | 1849732997945110651-close-base.png、1849732997945110651-close-foammask.png |

## 1991101097818403263（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset." | 线框浪带从外推线展开到岸、退回；绕高崖与海蚀洞 | 完整浪形/碰撞仍部分 | 本批新增 ?c10=shoreclamp：浪带顶点 蓝线→黄线 路径碰陆就把蓝线点收回、aIn/aOut 同比缩放（实测 terrain 11.7%→0.9% 顶点路径穿岸）。wavewire 截图线框太淡，没能和原片的深色线框带逐处对照 | partial | src/water/shore.js · src/core/wave-cycle.js · src/water/foam-mask.js（clampWavePaths）· src/world/view-c10.js | tests/wave-cycle.mjs、tests/foam-mask-c10.mjs | 1991101097818403263-wavewire.png |

## 1991099314714902634（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "Got some pretty sweet new shore waves going" | 高崖岛/海蚀洞多角度，白色岸浪分段展开、聚散 | 遮罩/拓扑碰撞及完整原作形态仍缺 | 遮罩：本批 ?c10=foammask 全局泡沫遮罩；拓扑碰撞：?c10=shoreclamp 浪带路径碰陆收回（town 17.3%→0.6%、terrain 11.7%→0.9%）。浪带之间互相遮挡/合并与原作完整形态仍未做 | partial | src/water/shore.js · src/water/foam-mask.js · src/world/view-c10.js | tests/wave-cycle.mjs、tests/foam-mask-c10.mjs | 1849732997945110651-shoreclamp-off.png、1849732997945110651-shoreclamp-on.png、1849732997945110651-close-foammask.png |

## 1849732997945110651（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in blue. The waves travel from the blue line to the yellow (and back a little). There is also a global water mask texture that adds extra foam around rocks and stuff." | 黄线贴岸、蓝线外推平滑；红三角浪带蓝→黄往返；全局水面遮罩在岩石周围加泡沫（frame 300 可见海中黑石周围白泡沫） | 全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺 | ①新建 water/foam-mask.js buildFoamMask：World 第1层栅格化→chamfer 距离 d、局部陆地占比 L；泡沫=exp(-d/falloff)×暴露度(1-L)²，独石/岬角多、深湾少；view-c10 铺一张覆盖全岛的 DataTexture 平面，片元用双层滚动值噪声切碎成斑块（?c10=foammask，默认关）。②浪带全路径防穿岸：auditWavePaths 审计 + clampWavePaths 收回（?c10=shoreclamp）：town 17.3%→0.6%、terrain 11.7%→0.9%。③折叠消解：原片窄湾里蓝线本身就交叠（frame 300 左侧），属原作现象，不作为缺项 | done | src/water/foam-mask.js · src/world/view-c10.js · src/world/app.js（挂钩 2 行）· src/water/shore.js | tests/foam-mask-c10.mjs、tests/shore-profile.mjs | 1849732997945110651-close-base.png、1849732997945110651-close-foammask.png、1849732997945110651-terrain-red.png、1849732997945110651-shoreclamp-off.png、1849732997945110651-shoreclamp-on.png |

## 1849730611964973481（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "creating loads of overlapping waves that each go through their own cycle" | 很多重叠浪带各走各的周期；408 起红色重叠三角带 | 泡沫mask/窄湾交叠仍缺 | 泡沫 mask 由本批 ?c10=foammask 补上；窄湾里浪带重叠是原片本身的样子（frame 450 红三角带在窄湾里叠在一起），不算缺；本批另把穿到对岸陆地里的浪带路径收回（?c10=shoreclamp） | done | src/water/shore.js · src/core/wave-cycle.js · src/water/foam-mask.js · src/world/view-c10.js | tests/wave-cycle.mjs、tests/foam-mask-c10.mjs | 1849732997945110651-shoreclamp-off.png、1849732997945110651-shoreclamp-on.png、1849732997945110651-close-foammask.png |

## 1798310423554658732（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| （帖子无文字说明） | 六边格地形工具：农田按地块共用耕纹主轴、人字垄 | 尚未接回 terrainmesh 实际着色 | 本批未改（不在水/展示主线，且 terrainmesh 由别组/另一会话持有）；核实 field-plots.js 仍只在 fields.html 使用 | partial | src/core/field-plots.js · fields.html | — | — |

## 1781405550061687016（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "seamless patch blending! Some of the patches are projected (like the grass and the water) and some are manually UV-mapped (like the shoreline)... height based blending" | 球面上草/水投影 patch 与手工 UV 岸带无缝混合 | （旧 note 已过时）投射/手工UV与atlas/接缝指标接口尚未迁移 | 核实：第 55 批 G1 已把 patch-blend.js 接进 View（?shade=patchblend：岸带手工 UV 弧长+有符号距离，与地形顶面投影 patch 高度混合），看过 r55 的 g1-patchblend-ab 截图；本批自己的截图镜头没对到沙滩岸带，未能独立复验。岸带水侧那一半（水 patch）仍没画 | partial | src/terrain/patch-blend.js · src/world/view-shading.js（patchblend） | tests/patch-blend.mjs | 1781405550061687016-patchblend-on.png |

## 1758251637280268481（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "simply a stack of planes sampling an SDF" | 叠层平面采 SDF 的流体感浅水 | 不同于原片完整反射效果 | 本批未改 | partial | src/water/watervol.js · src/water/land-distance.js | tests/water-distance.mjs | — |

## 1758250248483278925（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "New water reflection I'm quite happy with" | 克制的水面倒影轮廓/颜色 | 完整反射投影/遮挡仍缺 | 本批未改 | partial | src/water/reflection.js · src/world/view.js | — | — |

## 1727324352264474664（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "Yeah that actually looks pretty good" + 相邻帖 "adding motion blur smear" | 快速转镜时整岛沿切向拖抹成弧 | （旧 note 已过时）原作强几何轮廓拖抹、速度场/CPU审计接口仍待补 | 核实：第 55 批 G2 的 ?fx=smear 已是解析速度场 v=ω×(p−c) 沿切向 6 样本拖抹，并有 JS 孪生逐像素对表（CPU 审计）。本批截图 spin=7 / spin=25：外圈切向糊开、中心清楚；spin=25 整岛拖成旋涡弧，与原片 frame 38-40、74-76 一致 | done | src/world/view-post-extras.js（fx=smear）· src/core/camera-motion.js | tests/view-post-extras.mjs | 1727324352264474664-smear-spin.png、1727324352264474664-smear-spin25.png |

## 1707497006640365880（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "And here's a couple more being generated" | 纯贴图灌木带随新岛生成 | 仍缺崖高绑定与水面暖色倒影 | 本批未改（灌木带归 C11 组 shrubband） | partial | src/terrain/shrub-texture.js · index.html?scene=terrain | — | — |

## 1671840905957978113（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "Hmm.. I thought it was gonna be too wacky but maybe it's kinda cool" | 抬地面吞没建筑 | 缺墙裙残留与悬檐联动 | 本批未改 | partial | src/core/terrain-burial.js · terrain-stages.html | — | — |

## 1666429884208381953（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "basically just a refined version of what I did for Bad North and Townscaper" | 凹湾与白色岸裙细微聚散、外圈几道偏移白线 | 蓝线窄湾交叠/泡沫mask仍缺 | 泡沫 mask 由 ?c10=foammask 补上；窄湾里浪带穿到对岸的问题由 ?c10=shoreclamp 收回（蓝线调试线本身在窄湾交叠，原作同类片 1849732997945110651 也是如此）。截图：岸裙 rim+halo 与浪带在 terrain/town 近景都在 | done | src/water/shore.js · src/core/shore-loops.js · src/water/foam-mask.js · src/world/view-c10.js | tests/shore-loops.mjs、tests/foam-mask-c10.mjs | 1849732997945110651-close-base.png、1849732997945110651-close-foammask.png、1849732997945110651-shoreclamp-on.png |

## 1664566546683899905（done）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters" | 旋转岛屿，贴岸白色网格岸裙缓动 | 独立原版buildShoreDistance API未迁移 | 该缺项是接口迁移而非片子机制：chamfer 距离场驱动的岸裙在共享 shore.js 里；本批另在 foam-mask.js 提供独立可复用的 rasterLand/chamferDistance（node 测试覆盖），截图里岸裙贴岸一致 | done | src/water/shore.js · src/core/shore-profile.js · src/water/foam-mask.js（rasterLand/chamferDistance） | tests/shore-profile.mjs、tests/foam-mask-c10.mjs | 1849732997945110651-close-base.png、1849732997945110651-base.png |

## 1664565063552847873（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "shader based fluid simulation ... needs 32 bit float render targets ... challenge to tweak, stylize, and feed back to CPU" | 岛周围青/洋红/黄染料场绕地形流动 | 跨平台及平流/CPU误差待补（平流/CPU误差 r55 已补，note 部分过时） | 新增 ObstacleFlow：World 栅格当固壁，均匀来流在 MAC 网格置零陆地面通量后 SOR 压力投影（散度 25.5→0.16，陆地面通量 0），半拉格朗日推进染料、解析入流色带边界、可选 f16/f32 存储误差可量（f16 20步最大误差≈0.004）；?c10=fluid 在主场景铺圆盘色场，截图里色带在迎流面分开、两侧绕过、背流汇合，与原片色场绕岛一致 | partial | src/water/foam-mask.js（ObstacleFlow）· src/world/view-c10.js（fluid）· src/world/float-advect-gpu.js（r55 GPU 对表） | tests/foam-mask-c10.mjs、tests/float-advect.mjs | 1664565063552847873-fluid-early.png、1664565063552847873-fluid-late.png |

## 1459169210752507904（partial）

| 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|
| "And another"（半边结构相邻帖） | 不规则四边格+三角带混合网，三角带横穿成条、定期清空重铺 | 缺格心彩色小块语义、3D透视视角、接world实景 | 本批未改 | partial | src/core/grid-wireframe.js · grid-graph.html | — | — |

