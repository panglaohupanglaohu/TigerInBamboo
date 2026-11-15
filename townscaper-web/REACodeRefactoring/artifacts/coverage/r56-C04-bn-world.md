# 第 56 批 · C04 组（Bad North 网格 / 光照 / 地形 / 贴图 + other 杂项，15 条）

清单：`artifacts/coverage/clips-r56-C04-bn-world.json`。端口 8804。截图都在 `artifacts/coverage/shots-r56/`，全部用 Read 打开看过、与联系表对照；所有截图控制台 0 error（只有共享 View 管线原有的 `toNonIndexed` warning）。

## 本批新增 / 改动的文件

| 文件 | 性质 | 内容 |
|---|---|---|
| `src/world/view-c04.js` | 新 | View 开关 `?c04=dualcells,rayvis,ssao,dustao,hexslots`（全部默认关；不带 `c04` 参数时模块根本不加载） |
| `src/world/view.js` | 热点，**只加 1 行** | 构造末尾：URL 有 `c04` 参数时动态 `import('./view-c04.js')` 并 `installC04(this)` |
| `src/badnorth/battle-c04.js` | 新 | 尘粒 AO（`particleAO`、`BattleC04` 尘粒池）+ 命令落点不规则六边形（`hexSlotOutlines`）。battle.js 一行没改，读 `view.battle.units/squads` |
| `src/core/vertex-openness.js` | 新 | 固定步长射线开阔度烘到网格顶点（`bakeVertexOpenness`） |
| `src/core/field-surface-c04.js` | 新 | 地形/房子分层计划、过渡暗度、水面层外距离场 + 带状水线、水面镜像矩阵、硬边房子几何 |
| `field-surface-3d.html` | 新页 | three.js 版等值面岛：真倒影、暗碎块、投影、带状水线、硬边房子 |
| `src/world/bary-gizmo.js` + `bary-gizmo.html` | 新 | 真实 World 里的重心坐标教学 gizmo |
| `src/terrain/mushroom-c04.js` + `mushroom-stack.html` | 新 | 共享 World 上的中心柱 + 层叠薄平台 + 木梯 |
| `ao-stages.html` | 改（非热点） | 补「③ vertex voxel AO」「④ + SSAO」两个阶段、白模开关、`?stage=&white=` 定格；原有选项值不变 |
| `tests/c04-bn-world.mjs` | 新 | 本组逻辑测试（见下） |

**测试**：`node tests/c04-bn-world.mjs` PASS。全量 `for f in tests/*.mjs`（280 个，8 路并行、单个 120 s 超时）**全部通过**，0 FAIL。

---

## 1097458505315946496 · 维京前线（frontier）
- **原文要点**：「1. Triangulate (with some added padding) 2. Walk on triangle edges along each frontier step 3. Bezier sample 4. Tessellate the fields on either side using the bezier and the triangulation」。
- **片子机制**（14 帧，本批看 sheet-00 + 原尺寸 6）：带 padding 的三角网 → 沿三角边走出折线 → Bezier 圆滑 → 前线两侧按三角网顶点向 Bezier 采样点扇形细分（帧 6 的放射扇）→ 多条前线、地名。
- **原缺**：旧 note 写「两侧细分未实现」——**已过时**：第 55 批 G3 已做 `src/campaign/frontier-overlay.js` + `campaign.html?fields=1`。
- **本轮**：核实现状，重新截图对照。
- **判定**：done（四步全在；地名/原美术不是机制）。
- **落点**：src/core/frontier.js · src/campaign/frontier-overlay.js · campaign.html?fields=1
- **测试**：tests/frontier.mjs、tests/frontier-fields-campaign.mjs（全量内通过）
- **截图**：`1097458505315946496-fields-on.png`：3/3 条前线、两侧场 ear-clip 732 三角、从三角网顶点放射到 Bezier 的扇形与片子帧 6 同构。

## 1061221291137605633 · 一张纹理八方向 + 中心镜像任意尺寸
- **原文要点**：「A single texture can be oriented 8 different ways and mirrors around the center to work in any size」。
- **片子机制**（379 帧，本批看 sheet-00）：同一张纹饰在 8 种方向间切换（帧 0/30/42/50 段的版式各不同），四象限关于中心镜像，拖角改尺寸后仍成立。
- **原缺**：「固定尺度重复是本地方案；纹样/CPU 绘图 API 不同」——这两条是美术与接口差异，不是机制缺口。
- **本轮**：mirror.html 截 3 个方向的单面板（关掉固定尺度折叠）+ 宽/高两种比例。
- **判定**：done（D4 八方向 + 中心镜像 + 任意长宽在共享 ornament 着色器里；纹样是程序化卷草替代，原纹饰资产没有）。可见瑕疵：border/center cutoff 在笔画上留有直切口。
- **落点**：src/core/mirror-uv.js · src/ui/ornament.js · mirror.html
- **测试**：tests/mirror-rock.mjs（全量内通过）
- **截图**：`1061221291137605633-mirror-o0-panel.png` / `-o3-panel.png` / `-o6-panel.png`（同一纹理三种朝向，四象限镜像）、`-mirror-o5-wide.png`（900×300）、`-mirror-o2-tall.png`（300×560）。

## 974579499802202113 · 重心坐标「1 次减法 + 1 次点积」
## 974564862729838592 · 重心坐标教学 gizmo
- **原文要点**：「Barycentric Coordinates can be calculated with 1 subtraction and 1 dot product (if you've precalculated some nice vectors in the triangle)」；「pedagogical gizmos for my GDC microtalk … Gizmos > powerpoints」。
- **片子机制**（815 + 478 帧，本批看两片 sheet-00 + 原尺寸 445 / 220）：灰色岛面导航三角（白边）；白球带 RGB 移动箭头被拖动，可升离三角面、可拖出三角形外；白球在面上的投影小白点；三个顶点到投影点的红/绿/蓝线随权重变；三角形被拉窄/张开。
- **原缺**：「3D 原 gizmo 未完整迁移」。
- **本轮**：新 `src/world/bary-gizmo.js` + `bary-gizmo.html`：在 index.html 的真实 World/View 里取一格的扇三角，叠 gizmo——权重来自 `baryPrep3`（预算对偶向量，查询 1 减 + 每坐标 1 点积，`ops` 记录），每帧与 `baryCramer3` 对账；投影点 = `baryPoint(w)`；顶点球大小 ∝|w|，负权重变暗；离面高、张开度（第三顶点沿中线拉近/推远）可滑杆定格或自动绕行。
- **判定**：两条都 done（Unity 原 gizmo 控件形状不同，是外观差异）。
- **落点**：src/core/spatial.js（baryPrep3，旧）· src/world/bary-gizmo.js · bary-gizmo.html
- **测试**：tests/c04-bn-world.mjs ⑤（三组参数：和为 1、与 Cramer 误差 <1e-12、离面距离 = h、投影在面上正下方、内外判定、ops={sub:1,dotPerWeight:1}）；tests/barycentric-3d.mjs
- **截图**：`974564862729838592-gizmo-inside.png`（w=[.35,.35,.30]，三角形内，离面 .35）；`974579499802202113-gizmo-outside.png`（三角形被拉窄 .55，w=[−.35,1.1,.25]，红顶点变暗、绿球变大，投影点在三角形外，与片子帧 445 同构）。

## 959752525867036672 · 脉动的顶点对偶格
- **原文要点**：「pulsating vertex cells; a dual to the triangular grid and a suitable place to start with foliage placement」。
- **片子机制**（31 帧，sheet-00）：台地岛上白线画出的顶点对偶格（每个网格顶点一块不规则多边形）随时间收放。
- **原缺**：旧 note「尚未统一植被」——第 55 批 `fx=dualflora` 已让地被落在对偶格上；但脉动对偶格只在 gridpatch.html 的小 World 里，主场景没有。且 `VertexDualOverlay` 在真实 terrain World 上抛 `disconnected vertex fan`（实测）。
- **本轮**：`?c04=dualcells`：改用同模块的 `gridVertexDual`（共享多边形网格、每格楔块带自己的台地高度，跨崖自然分层），每个楔块画两条对偶边，顶点着色器向源顶点收放（脉动）。不改旧 overlay。
- **判定**：done。
- **落点**：src/world/view-c04.js（DualCellsC04 / dualCellSegments）· src/core/vertex-dual.js · src/life/flora-species.js（r55 dualflora）
- **测试**：tests/c04-bn-world.mjs ④（线段数、每段贴在所在格台地高度）；tests/dual-foliage.mjs
- **截图**：`959752525867036672-dualcells-on.png`（`index.html?scene=terrain&c04=dualcells&fx=dualflora`：2601 个对偶格、5752 条线段，白网覆盖各层台地，地被丛落在格里）。

## 943230624369868800 · 风吹雪绕岛
- **原文要点**：「the snow flakes are affected by the wind system and thus flow around the island」。
- **片子机制**（318 帧，sheet-00）：积雪白顶的岛，雪片随风场绕岛流动。
- **原缺**：旧 note「Points 方点/统一大小与亮度，软片、接触 AO/完整冬景仍未复现」——**已过时**：atmosphere.js 现在是圆形软边雪片、逐片大小（0.55–1.45）、按共享 World 实际支撑高度的接触 AO（`particleContactAlpha`），碰撞读 World 实心层，表面朝上积雪。
- **本轮**：核实现状并截图。
- **判定**：done。
- **落点**：src/life/atmosphere.js · src/core/wind-flow.js · src/core/world-probes.js
- **测试**：tests/world-probes.mjs 等（全量内通过）
- **截图**：`943230624369868800-snow-on.png`（terrain 场景：台地顶全白、雪片散在岛周；eval：3000 片，alpha 0.207–0.718，大小 0.55–1.45）。

## 815236105079398400 · irregular is the new hex
- **原文要点**：「irregular is the new hex」。
- **片子机制**（185 帧，sheet-00 + 原尺寸 50）：灰色台地岛上小队下命令时，地面亮出几块**不规则六边形**（白框 + 浅填充），小队落在这些格里；白点路径。
- **原缺**：旧 note 只有台地量化/面积诊断，没有片子里这块不规则六边形落点。
- **本轮**：`?c04=hexslots`（battle-c04.js）：小队目标格变化 → 目标格每个顶点的顶点对偶格（只取与目标同一台地层的楔块，楔块并集外边）画白框 + 浅填，3.2 s 淡出。混合网格上就是 5–7 边的不规则六边形。路径白点为既有 path-samples。
- **判定**：done。
- **落点**：src/badnorth/battle-c04.js（hexSlotOutlines / showHexAt）· src/world/view-c04.js
- **测试**：tests/c04-bn-world.mjs ③（每块 ≥3 边、面积 >0、楔块全在目标台地层）
- **截图**：`815236105079398400-hexslots-mixed.png`（北境混合网格，真实 onPointer 下 3 次命令，3 块不规则六边形白框，边数 [6,10,6]）；`815236105079398400-hexslots-on.png`（四边网格，对照：四边网格上对偶格偏方）。

## 823848950553780226 · 尘粒 AO
- **原文要点**：「O yes, I do have AO on my dust particles. O yes, it does work on mobile」。
- **片子机制**（227 帧，sheet-00）：一队人从塔门洞走出、绕基座，脚下扬尘；门洞里/贴墙的尘团更暗，开阔处更亮。
- **原缺**：「原尘粒 AO 待实现」。
- **本轮**：`?c04=dustao`：单位移动速度 >0.12 时按速度概率在脚下冒尘（软圆点、随寿命变大变淡、透视正确的点大小）；每粒尘的 AO = 上半球 + 水平 9 方向 × 两圈半径（.3/.6）上共享 World 实心比例 + 离地接触项，乘到颜色上。只读 World。
- **判定**：done。
- **落点**：src/badnorth/battle-c04.js（particleAO / BattleC04）· src/world/view-c04.js
- **测试**：tests/c04-bn-world.mjs ③：同一点贴墙 0.467 → 头顶加盖成洞 0.417 → 开阔 0.82 → 高空 1.0，单调。
- **截图**：`823848950553780226-dustao-wall.png`（从房基墙根向外喷一条尘：墙根端灰暗、外端发白；贴墙均值 AO 0.382，开阔 0.809）；`823848950553780226-dustao-on.png`（小队行军扬尘）。`-dustao-cave.png` 机位没对上洞口，不作为证据。

## 793557992931266561 · flat → up normal → voxel AO → SSAO → directional AO
- **原文要点**：「flat -> up normal -> vertex voxel AO -> SSAO -> directional AO (With textures and baked vertex colors, I could get rid of the SSAO)」。
- **片子机制**（6 帧，sheet-00）：同一白模楼五个阶段逐步加明暗。
- **原缺**：「五阶段仅学习」；ao-stages.html 只有 flat/up/directional，缺 SSAO。
- **本轮**：`?c04=ssao`：屏幕空间 AO（深度纹理重建视空间位置、屏幕导数求法线、16 个半球核采样 + 随机旋转、范围衰减），乘在主画面上；只接管主场景到屏幕那一次渲染。ao-stages.html 改成完整五阶段 ①flat ②up ③vertex voxel AO ④+SSAO ⑤directional，并加白模开关。
- **判定**：done（SSAO 无模糊遍、有颗粒噪声；常数本地选择）。
- **落点**：src/world/view-c04.js（SSAOPass）· src/world/worldmesh.js setBakeLighting（旧）· ao-stages.html
- **测试**：tests/c04-bn-world.mjs ④（核在半球内）；全量内 ao-modes 等通过
- **截图**：`793557992931266561-stage-voxel.png` 与 `-stage-ssao.png`（白模：开 SSAO 后屋檐下、墙角、巷子交接处多出一圈接触暗影）。副作用：SSAO 合成时海面色调略亮（离屏颜色再做一次色调映射），记为已知差异。

## 798580832906739712 · 廉价射线步进的室内可见度
- **原文要点**：「Some dirt cheap (and highly inaccurate) ray marching. Might use it for visibility when indoors」。
- **片子机制**（64 帧，sheet-00）：整栋楼逐顶点灰度（室内、洞里黑，外墙屋顶亮），黄色射线从一点扇出。
- **原缺**：「非灰度烘焙」——旧只有单点射线和每格一个灰点。
- **本轮**：`core/vertex-openness.js`：WorldMesh 每个顶点沿法线抬起，法线半球 16 条方向固定步长（.15，最远 2.4）查共享 World 实心，命中即停，平均距离比 = 灰度；位置+法线量化去重。`?c04=rayvis`：主网格换灰度材质，藏掉共用几何的描边外壳/倒影，黄线 = 原 SpaceVisibilityOverlay 射线；World 变了自动重烘。
- **判定**：done（便宜不准，会漏薄墙——和原文一样）。
- **落点**：src/core/vertex-openness.js · src/world/view-c04.js · src/core/space-visibility.js（旧）
- **测试**：tests/c04-bn-world.mjs ②（有顶小屋内 0.277、空地 1.0、屋顶 1.0；确定性；预算/长度不符拒绝）
- **截图**：`798580832906739712-rayvis-on.png`（小镇：36555 顶点 / 20821 唯一 / 600 ms，巷底与墙根暗、屋顶白，黄线扇出）；`-rayvis-fusion.png`（融合场景：峡谷底和凹角接近黑、台地顶白，最像片子）。

## 818857408848130048 · 黏土岛形态循环（等值面 + 碎块崩解重组）
## 832633189277409280 · 同工具带投影录屏（地形圆角 + 建筑硬棱）
- **原文要点**：818「Excerpts from this weeks episode of Lets Redo All Environment Art」；832「aimed for the Iron Islands ended up in Gotland」。
- **片子机制**（302 + 192 帧，本批看两片 sheet-00）：占位场揉圆的等值面地形；换形态时区块缩没 + 抬升再重长，过渡碎块**明显发暗**并**投影**；水面有**倒影**；岸边一圈**白色带状水线**；832 里房子是**独立硬边**（人字屋顶、烟囱、门洞），地形是圆角。
- **原缺**：倒影只是椭圆、碎片不暗、水线是格边折线、房子是方盒且被熔进地形、没有分层。
- **本轮**：`field-surface-c04.js` + 新页 `field-surface-3d.html`（three.js）：
  - 分层：地形盒进场 → 模糊 → surface nets；房子不进场，作为硬边几何（人字顶/出檐/烟囱/暗门洞），与地形**同一区块时间窗**（`chunkPhase` 与 `morphField` 同一公式，测试逐帧对上实心格数）缩没、抬升、重长；勾掉「房子硬边分层」即旧行为（房子当盒子熔掉）作对照。
  - 暗碎块：过渡中区块的顶点按 (1−s) 与抬升高度变暗，房子同样变暗。
  - 投影：方向光 PCF 阴影，碎块在水面上投影。
  - 倒影：整组几何关于水面 y=1.6 的镜像矩阵，画在半透明水面下（真平面反射）。
  - 带状水线：水面附近 1.6..4.6 层取最大占位 → 4 倍细分 chamfer 外距离场 → 0.45..1.0 格等距白带纹理。
- **判定**：两条都 done。没接进 src/terrain 实景岛生成——那是工具链集成，不是片子机制。
- **落点**：src/core/field-surface.js（旧）· src/core/field-surface-c04.js · field-surface-3d.html
- **测试**：tests/c04-bn-world.mjs ①（房子不进地形盒、t=0/1 房子数、区块相位与 morphField 6 个 t 全一致、成品不暗/过渡暗、白带全在陆外 0.2–1.3 格、镜像矩阵、门洞暗面）；tests/field-surface.mjs
- **截图**：`818857408848130048-fs3d-t0.png`（形态 A：圆角岛 + 3 栋硬边房子 + 倒影 + 白带水线）、`-fs3d-t0.3.png`（崩解中：悬空碎块、发暗、水面投影、倒影里也有碎块）、`-fs3d-t1.png`（形态 B）；`832633189277409280-fs3d-flat-off.png`（关分层/倒影/水线：房子被熔成鼓包——旧行为对照）、`832633189277409280-fs3d-t1.png`。

## 781957658597269506 · 中心柱上层叠的黄色薄平台 + 木梯
- **原文**：无文字说明（2016-09-30）。
- **片子机制**（109 帧，sheet-00）：中心柱上错层叠着多片薄平台（下面悬空），平台之间白色木梯，顶上红房子冒烟，底座树，转台式绕转露出平台底面。
- **原缺**：「原薄台/攀爬仍缺」——攀爬第 55 批 G3 已做（battle-navigation ladderMode + battle-g3 姿态）；**薄平台结构没有**。
- **本轮**：`src/terrain/mushroom-c04.js buildMushroomStack`：在共享 World 写中心岩柱 + 4 片只写一层岩石的平台（错层 2 层、伸向不同方向）+ 顶片房子 + 底座；terrainmesh 自带悬挑侧壁/底面，navgraph 在上下片边缘出 rise=2 连接，woodladders 画木梯，ladderContact 判上片为薄平台。`mushroom-stack.html` 转台式绕转。
- **判定**：done（平台黄色是原美术未迁；梯子数由 navgraph「每对区域一架」决定，四边 2 架/混合 1 架）。
- **落点**：src/terrain/mushroom-c04.js · mushroom-stack.html · src/world/navlayer.js / navgraph.js / core/ladder-profile.js（旧）· world/battle-navigation.js（r55 攀爬）
- **测试**：tests/c04-bn-world.mjs ⑥（两种网格：每片大半悬空、顶片是建筑、rise=2 连接、至少一把梯子 thinPlatform 且梯身不在岩里）
- **截图**：`781957658597269506-mushroom-a.png`（侧上方：层叠悬挑平台 + 右侧木梯）、`-mushroom-b.png`（另一侧低机位：4 层平台、顶上红顶房、木梯、底座；与片子同构）。

## 865200072685912064 · WFC 浏览器教学 demo（SLOTS）
- **原文要点**：「I built a small browser demo to help explain how the WFC algorithm works」。
- **片子机制**（908 帧，sheet-00）：标题 SLOTS、10×8 槽位缩略图、RESET/SOLVE，候选逐步收缩、红色冲突、重置重解。
- **原缺**：旧 note「原图片/动画/完整建筑接入仍缺」——**已过时**：第 55 批 G5 新增 slots.html（10×8 槽位、27 种变体缩略图、按真实 trace 逐帧播放、红色依赖链、冲突示例）。
- **本轮**：核实并截图。
- **判定**：done（缩略图是程序化替代美术）。
- **落点**：slots.html · src/core/wfc.js
- **测试**：tests/slot-playback.mjs、tests/slot-variants.mjs（全量内通过）
- **截图**：`865200072685912064-slots-mid.png`（第 25/60 帧，候选 27/9/3 混合 + 红链）、`-slots-conflict.png`（矛盾 + 冲突链）。

## 787319655648100352 · 3D 程序化拼块
- **原文要点**：「More procedural tile placement. Now in 3D. Algorithm inspired by the work of @ExUtumno」。
- **片子机制**（67 帧，sheet-00）：底板上逐块落下 3D 模块（桥廊、拱、带窗楼体），空中有待落零件。
- **原缺**：旧 note「原 3D 模块库/动画未迁入」——**动画已过时**：第 55 批 G5 assembly.html 用加权熵 solveWFC 的真实定格顺序逐块写进共享 World、新块从上方落下、黄色幽灵 = 未定格的实心候选。
- **本轮**：核实并截图。
- **判定**：done（模块美术用 World 建筑管线 + ruin/fort tileset 替代，原胶囊模块库没有）。
- **落点**：src/core/wfc.js · src/build/tile-assembly.js · assembly.html
- **测试**：tests/assembly-playback.mjs、tests/tile-assembly.mjs、tests/wfc-weighted-3d.mjs（全量内通过）
- **截图**：`787319655648100352-assembly-mid.png`（第 5/12 块，13 个幽灵候选）。

---

## 说明 / 没验到的

- 帧数：15 条的全帧核验都是以前批次做的（各自 review md）；本批每条看了 sheet-00，原尺寸回看 1097…/6、974564…/220、974579…/445、815…/50。
- SSAO、尘粒 AO、开阔度、带状水线的常数都是本地选择；原作参数不可知。
- 热点文件只改了 view.js 一行（动态 import）；battle.js、worldmesh.js、app.js、index.html 未动。
- 没跑 record-review.mjs，没写 learn/*、CHANGELOG、MODULE-REFACTOR-STATUS 等。
