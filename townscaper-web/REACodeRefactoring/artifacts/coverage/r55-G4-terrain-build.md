# r55 · G4 地形 / 建筑组：12 个「部分覆盖」模块收口

范围是 partial-60.json 里 G4 的 12 个 source。分三路做：地形 5 个由主 G4 做（端口 8794），建筑 4 个由分叉 A 做（端口 8894），splice/propanim/gridpatch 由分叉 B 做（端口 8994）。

**守住的线**
- 没有改 REACode / REA-agent / .workbuddy，也没写 learn/*、CHANGELOG、PIPELINE、MODULE-REFACTOR-STATUS。
- 没碰 view.js、worldmesh.js、battle.js、index.html。
- 新开关全部默认关闭。关闭时，几何与体素和原来一致，由测试断言。

**浏览器验收**
- 用 headless Chromium + SwiftShader 截图，每张图都用 Read 打开看过。
- 控制台没有 error，只有老的 `THREE.BufferGeometry.toNonIndexed` warning。
- 截图都在 `artifacts/coverage/shots-r55/`，文件名前缀 g4- / g4a- / g4b-。

**node 测试**
- 最后把 `tests/*.mjs` 共 255 个全部跑了一遍，全部通过。
- 分叉 A 中途看到 battle-g3.mjs 失败，那时 G3 还在改 battle.js；最后这次全量跑它已经通过。

## 演示页
- `terrain-r55.html`（新建）：外层嵌 iframe 加载 **index.html?scene=terrain**，改的是主场景里同一个 World / WorldMesh。
  - 复选框和 URL 参数：`lakes`（湖面 + 湖洞联合）、`erosion`、`relax`（BFS 缓坡）、`soft`（softSlopes + softTops；`tops=0` 只量化不连续）、`edges`（最终倒角边线）、`collide`（侧壁碰撞探针）。
  - 截图辅助参数：`grid`、`seed`、`cam=lake|soft|wall`、`clean=1`（隐藏 UI）。
  - 统计数据写在 `window.__r55`。
- `planet-rivers-r55.html`（新建）：与 planet.html 是同一颗星球，`?mode=pf` 是原 planetRivers，`?mode=collapse` 是深度优先坍缩 + BFS 缓坡 + 湖洞联合。没有改 planet.html，那个页面归 G5。
- `building-kit-r55.html`（分叉 A 新建）：`?scene=&grid=&flags=a,b&village=1&focus=...&probe=...&clean=1`。
- gridpatch.html 加了 `?template=` 和 `&plan=1`（分叉 B）。index.html 新增 `?tool=splice`、`?propanim=1` 两个参数（分叉 B 在 app.js 里做了最小插入）。

| 模块 | 片子 | 原缺口 | 本轮做了什么 | 判定 | 落点 | node 测试 | 浏览器截图（文件名 + 看到了什么） |
|---|---|---|---|---|---|---|---|
| src/depfill.js | 1447488323845509121, 1442695040888963407 | 湖水面与侵蚀仍缺 | **湖面**：`fillTerrainDepressions(world,{lakes:'water'})` 不再用岩石把洼地抬平，而是写 `World.lakes`（每格水位、湖簇、出口、湖底/湖岸快照）。terrainmesh 在水位 −0.07 处给每个湖格画一块平水面，与湖岸顶面用同一个笼切面。`liveLakes` 用快照核对：湖底被改或湖岸被挖低，湖就不画（会被放干）。<br>**侵蚀**：`erodeHeights` 是整数版 stream-power。每一遍都先做优先洪泛，沿出口树累计汇水，在 area^m·drop ≥ k 的格子降一层。不会低于父格的溢出水位，也不会低于 1 层，所以崖面向上游退，不会挖出坑。可选 talus 热侵蚀。侵蚀后再填洼，局部极小 = 0 | done | core/depression-fill.js, terrain/drainage.js, terrain/terrainmesh.js, terrain/generate.js（`lakes`/`erosion`/`basins`） | tests/lakes-erosion-r55.mjs：两种网格 × 3 个种子。水模式不抬任何岩石、填后零极小；每个湖格恰好一块水面；挖低湖岸后那个湖消失；默认岩石模式不变；侵蚀只降不升、陆地不沉、体积账平、零极小。合成坡面加坑的单元测试 | g4-lakes-on.png：台地中间挖出的盆地是一整片平湖面，湖边是草岸，出口接河道流向海。g4-lakes-off.png：同一种子默认生成，没有湖。g4-relax-erosion-on.png：侵蚀后崖线被切出许多缺口 |
| engine/rivers.js | 1769691526924292506 | BFS 缓坡坍缩、球面、湖洞联合重建仍缺 | **BFS 缓坡**：`relaxRiverSlopes` 在深度优先开凿河道之后，从全部河格出发广度优先外扩。比 BFS 父格高出 1 层以上的格子削到父格 +1；按 `cliffChance` 保留少量崖，BFS 从崖顶继续。河床不动，只削纯岩柱。<br>**湖洞联合**：`digBasins` 在高台挖平底盆；water 模式填洼成湖；`linkRiversThroughLakes` 重新接河网：湖内全部水流向唯一出口（出口取最早被淹的湖格的父格，它往下游的祖先链不会再回到这个湖）；每个湖的出口和每条断头河都沿 PF 树一直接到海、别的湖或已有河。<br>**球面**：`carveRivers` 在 planetWorld 上按 `dir` 弦长分源，同一套深度优先开凿 + BFS 缓坡 + 湖洞联合直接跑在星球 World 上 | done | terrain/generate.js（carveRivers/relaxRiverSlopes/digBasins/linkRiversThroughLakes） | tests/river-relax-lakes-r55.mjs：两种网格 × 5 个种子。BFS 不移动河格、只降不升、陡边全部减少（例 359→232）；全部河格和湖格沿 flowTo 流到海，无环、从不爬升；9/10 个盆地成湖。星球上陡边 589→320，4 条河最长 32 格，零断流 | g4-relax-erosion-on.png（BFS + 侵蚀 + 湖）。g4-mixed-lakes-soft.png：三角 + 方格网格上，湖、河、瀑布连成一体。g4-planet-rivers-collapse.png：星球上一条长河蜿蜒，白线是 flowTo 流向，周围坡面变缓。g4-planet-rivers-pf.png：原汇水阈值法的对照 |
| src/overhangterrain.js | 1671808851895627776, 1447488323845509121 | 整数 World 做不出连续软坡；变形侧壁碰撞未做 | **连续软坡**：`terrain/soft-tops.js` 在网格层做连续场，整数 World 不改。在周围全是“平凡岩顶”的格点上（没有海、河、湖、建筑、嵌入房、洞），按软链接（同层，或两侧都在软坡省的一层台阶）分组，同组共用一个角点高度（组内层高均值）。被链接的一层台阶连成连续坡面，没有墙；不链接的保留竖崖，墙拉伸到新角点高度。`world.softTops` 默认关。<br>**侧壁碰撞**：`terrain/terrain-collide.js` 直接用 terrainmesh 实际输出的墙四边形和顶面扇形（`world.terrainCollide` 时记录到 `World.terrainSurface`）。提供 `heightAt` / `wallSegmentsAt` / `wallDistance` / `pushOut`，覆盖悬垂下方的墙 | done（单位运行时还没调用，接法见下） | terrain/soft-tops.js（新）、terrain/terrain-collide.js（新）、terrain/terrainmesh.js、terrain/generate.js（`world.slopeMask`） | tests/soft-tops-collide-r55.mjs：开关关时顶点数不变。开时邻格角点高差处全部由墙封住（0 裂缝，例 665 处缺口全闭合），被链接边无墙。推出后穿透 < 1e-9（例 323 个探针）；唯一 blocked 的探针经过搜索确认是比单位窄的缝。逻辑格边与实际墙最大偏移 0.10–0.12，`heightAt` 与画出的顶面一致到 1e-9。悬垂墙 27 段，全部可碰 | g4-soft-on.png：左侧台地变成连续的多面坡，与右侧竖崖并存。g4-soft-off.png：同一地形逐层台阶。g4-collide.png：62 个探针，红柱是嵌进岩壁的起点，绿柱是推出后的位置，最大穿透 0 |
| src/terracecliff.js | 815236105079398400, 781957658597269506 | 没有连续 fieldSmooth 场 | 连续场就是上一行的 softTops 顶面（fieldSmooth 对 fieldTerrace），softSlopes 量化提供省份掩码。新增 `meshSlopeProfile`：在实际画出的网格上按真实坡度统计 flat / soft / steep 顶面面积和墙面积，不再只看逻辑格列 | done | core/terrace-profile.js, terrain/soft-tops.js, terrain/terrainmesh.js | tests/soft-tops-collide-r55.mjs（同上）：关时顶面 100% 平；开时 soft 坡面积 > 0（quad-7：soft 31.9 / steep 22.9），墙面积 223→191 | g4-soft-on.png 与 g4-soft-off.png 对照；页面 `__r55.slope` 输出两组数（开 flat 97.5 / soft 31.9 / steep 22.9 / wall 190.6，关 flat 135.7 / wall 223.1） |
| src/islandpasses.js | 1669315384619540487 | 最终倒角一致性未验 | 新增 `finalSegments`：用与 terrainmesh 完全相同的笼采样 `at(p, y/L)` 和软顶角点高度来放置 steps/wire/shore 线段；被软坡抹平的台阶单列为 `seamless`，不画。TerraceEdgeOverlay 改用它，所以线框正好落在最终倒角后的岩沿上 | done | core/terrace-edges.js, world/terrace-edges.js | tests/terrace-final-bevel-r55.mjs：两种网格 × 三种平滑（hierarchical/dumb/none）× 软顶开/关 × steps/shore，每条线段与画出的顶面边误差 0。被抹平的台阶在网格里也确实没有墙。Overlay 顶点与 finalSegments 逐个相符；软顶关时与旧行为一致 | g4-edges-plain.png：黄线贴着每条台地崖沿，共 714 段。g4-edges-soft.png：软坡处台阶线消失（seamless 151 段），竖崖处仍贴在拉伸后的岩沿上 |
| src/hiproof.js | 807256278154301441 | 非精确直骨架；凹屋顶谷线近似 | 新写精确直骨架（波前模拟）：相邻点相遇时合并；凹角顶点撞到对边时分裂，撞到洞环时与洞合并；一格宽排屋两侧边重合时整段抵消。支持外挑、平顶封顶、按分条强制事件（给茅草用）。区域轮廓追成环（凹角处取最左转），院子作洞环，封顶后的洞用桥接再三角化。开关 `world.hipSkeleton`：零山墙、檐口等高，烟囱坐在真实屋面上 | done | core/straight-skeleton.js（新）、core/hip-roof.js、build/buildings.js | tests/hip-skeleton.mjs：凸多边形上高度 = 到各边线距离的最小值；矩形屋脊长 = 长 − 短；L/U/T/院子/斜院子各点恰好覆盖一次、面积守恒。148 个真实区域面积误差和共面误差都 < 1e-9，谷线 247 条，烟囱悬空 0 | g4a-hiproof-{quad,mixed}-{on,off}.png、g4a-hiproof-skel-{on,off}.png：关时屋面是格点阵的碎三角，排屋端头是山墙；开时每条檐口对应一块平整坡面，屋脊和谷线笔直 |
| src/housekit.js | 781027725452648448 | 8 档坡度池、茅草美术、撒村接口仍缺 | 迁入 `PITCHES` / `FLOORS` / `pitchPool`（原版 ratioOK）。`world.housePitchPool` 按区域取档。`world.thatchRoofs` 是程序化茅草：直骨架按檐距分条，深浅交替，下缘抬高并补竖面形成层叠。新增 `scatterVillage(world,{seed,count})`：在地形平台上放 1–3 格的房子，房子互不相邻，写进体素和 `world.roofSpecs` | done（茅草是程序化替代，原版茅草美术素材没有迁） | core/house-kit.js、build/village.js（新）、build/buildings.js | tests/house-village.mjs：48 栋房子，坡角精确等于池中档位，有茅草的必有竖面，烟囱就座，开关关时几何不变 | g4a-housekit-village-{on,legacy,off}.png、g4a-housekit-pool-thatch-town.png、g4a-housekit-village-mixed.png：开时平台上是稻草色分层茅草的四坡房 |
| src/piercefloor.js | 802496920790777856 | 过梁几何、拱下净空碰撞仍缺 | `world.lintels`：门、窗、拱门上方加石过梁，悬空拱的开口面加楼板带，都在楼板预算内。`archSoffitAt` / `archPassage` / `archPassableWidth` 按实际画出的拱腹三角形精确求净空。`buildNav` 新增可选参数 `underArches`（默认 null 时行为不变） | done（战斗运行时还要接一行，见下） | core/arch-floor-budget.js、build/buildings.js、world/navgraph.js | tests/pierce-lintel.mjs：17 个拱、2499 个采样点与拱腹三角形误差 < 1e-9；408 组通行判定与暴力采样一致；1534 个过梁都在预算内；矮单位能穿过拱，高单位被挡 | g4a-lintel-arch-{on,off}.png、g4a-arch-clearance-probe.png：绿盒（高 0.3）在拱内，红盒（高 0.5）刺穿拱腹 |
| src/surfacedeco.js | 1181464374839521280 | 含门墙段不入长立面、不跨拐角、拱门没挖洞 | 求解器新增 `entryAt` 和 `breaks`。`world.surfaceFacadeDoors`：含门墙段并入长立面，门固定在中位。`world.surfaceFacadeCorners`：长立面可以绕过拐角，百叶不跨角。`world.archCutout`：墙体按拱形真正留洞，补上门侧墙、拱内侧面、门槛和背面 | done | core/surface-decoration.js、build/buildings.js | tests/facade-doors-corners.mjs：含门长立面 23 条、跨拐角 152 条，零违规；16 个拱洞，墙面积 = 墙条面积 − 洞面积，洞中心无遮挡 | g4a-arch-cut-{on,off,oblique}.png：关时是门板贴片，开时是黑色凹洞，斜看有深度。g4a-facade-corners-{on,off}.png |
| src/splice.js | 1584623053061099520 | 不进存档 / 撤销栈 / 编辑器 | **存档**：splicedHouses 写进 v5 存档尾段，向后兼容（旧串是新串的前缀，旧存档读出来没有房子）；坏数据整体拒绝。**撤销**：World.snapshot/restore 带上 spliced，reset 时清空。**编辑器**：新增 splice 工具（`?tool=splice` 或按 I 键），点一下嵌入、再点一下移除，走原有快照撤销栈 | done | build/splice.js、core/world.js、world/save.js、world/app.js | tests/splice-save-undo.mjs（2 种网格 × 3 个种子，108 栋：往返一致、编码规范、旧存档兼容、撤销/重做、坏数据拒绝）；回归 splice-house、save-atomic、river-flow-save | g4b-splice-{before,on,undo,reload}.png：真实鼠标点了 14 个岩顶，嵌入 14 栋房子；Z 撤销后全部消失；Y 重做后用地址栏存档开新页，房子原样还在 |
| src/propanim.js | 1246074663546916873 | slot 属性未接 World 网格 | `world/prop-anim-layer.js`（新）：从 World 派生道具（后院木箱和灌木、码头系缆桩），合并成一个 BufferGeometry，每个顶点带 aPropSlot；slot 记录存在 DataTexture 里，着色器在 onBeforeCompile 中绕根点做弹簧缩放。World 变更时只上传新出生的 slot，未变的道具不重放，消失的先缩没再释放。开关 `index.html?propanim=1`，默认关 | done（WorldMesh 自己的缓冲没动；道具是同一场景里的独立合并网格） | world/prop-anim-layer.js、core/prop-anim.js、world/app.js | tests/prop-anim-layer.mjs；回归 prop-anim、courtyards | g4b-propanim-{off,on,mid,after}.png：mid 帧里旧木箱在缩、新桩子刚冒头（55 个在缩、64 个在长）。累计上传 99792 float，每次整批重建对照为 130896 float |
| src/gridpatch.js | 1301816247479345152 | 手工模板库 / 带洞边界仍缺 | `PATCH_TEMPLATES`：radial / block / rhombus / courtyard（带洞，洞内原格原样保留）。另有 `insertTemplatePatch` 和 `fitTemplatePatch`（确定性重试），多模板可以放在同一张网格上；全部凸、无翻折、面积守恒，接缝顶点原样共用 | done（原版模板美术没有迁，几何是程序化的；四边网格偶尔留下少量三角格，已计数上报） | core/radial-patch.js、gridpatch.html | tests/gridpatch-templates.mjs（4 种模板 × 2 种网格 × 8 个种子）；回归 gridpatch-multi、radial-dual、prefab-splice | g4b-gridpatch-{block,rhombus,rhombus-mixed,courtyard,courtyard-3d,default}.png：courtyard 平面图中洞格原样保留，3D 里是一圈环形排屋围出院子 |

## 需要主会话接的线（不在本组文件里）
- **侧壁碰撞 → 单位**（battle.js 归 G3）：WorldMesh 重建后，设 `world.terrainCollide = true`，然后：
  ```
  const col = terrainCollider(world)
  // 每个单位：
  ({x, z} = col.pushOut(x, y, z, r))
  y = col.heightAt(x, z, y + step)?.y
  ```
  `terrainCollider` 来自 `src/terrain/terrain-collide.js`。
- **拱下净空 → 战斗导航**（分叉 A）：worldmesh.js（归 G2）需要在 `buildBuildings` 之后加 `this.build = build`；建导航时调用 `buildNav(world, { underArches: { archBudgets, height, radius } })`。
- **navgraph.js**：分叉 A 加了一个可选参数 `underArches`，默认 null，行为不变，导航相关的 6 个测试都过了。这个文件不在原分工表里，如果主会话不想让 G4 碰它，可以撤回这段，拱下净空就退回到只有查询函数。
- **propanim 常驻**：如果要不靠 URL 参数也加载，在 view.js 构造末尾加一行：
  ```
  import('./prop-anim-layer.js').then(m => this.propAnim = m.attachPropAnim(this, this.town))
  ```
- **面板复选框**：softTops / lakes 等暂时只有 URL 参数和 terrain-r55.html 上的勾选框。index.html 的面板项归 G1，需要的话由 G1 加。
- **共享核心改动**：`World.snapshot/restore` 现在带上 spliced（分叉 B 改的 core/world.js，只加了一个字段）。

## 说明与限制
- **湖面**：用的是 terrainmesh 里的平面多边形，颜色与河道相同，不是独立的水体着色器，没有透明和反光。
- **软坡**：只出现在全部相邻格都是平凡岩顶的格点上。海岸、河岸、湖、建筑周围保持原高度，这是为了不破坏别的系统。树、草、单位还是按 ground·L 放，在软坡上最多会偏 ±L/2；接上 `heightAt` 就能贴合。
- **截图**：`shots-r55/g4b-gridpatch-radial.png` 是分叉 B 早先一次超时留下的小图，不算验收。`g4-probe-terrain.png` 是开工时拍来确认 shot.py 能用的，不算验收。
