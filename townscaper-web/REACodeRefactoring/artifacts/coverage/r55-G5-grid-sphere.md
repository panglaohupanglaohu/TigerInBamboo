# 第 55 批 · G5 网格 / WFC / 球面 / 图集组

范围：src/gridmodes.js、src/slotsolve.js、src/tileforce.js、src/tileplace.js、src/spherefusion.js、src/spherehouse.js、src/spheretown.js、engine/sphere.js、engine/worldmap.js、engine/spritepack.js、src/squigglefield.js。
浏览器验收：headless Chromium + SwiftShader（tools/shot.py），截图在 `artifacts/coverage/shots-r55/G5-*.png`，每张都用 Read 打开看过；控制台 0 个 error。
没有改 view.js / battle.js / worldmesh.js，也没有 git commit。新开关都默认关，用 URL 参数、按钮或复选框打开。

**结果：9 个 done，2 个 partial（spheretown、spritepack）。**

| 模块 | 片子 | 原缺口 | 本轮做了什么 | 判定 | 落点 | node 测试 | 浏览器截图（文件名 + 看到了什么） |
|---|---|---|---|---|---|---|---|
| src/gridmodes.js | 1670790425232175108, 1447496205282549761, 1147881669350891521 | 联合约束只在 2D，没有 3D 分层模块 | 新增 `layerGrid`：任意半边网格叠 H 层，up/down 半边互为孪生。新增 `layeredJointCatalog`：每层用辐条插槽把同一父方格的 4 个对角子三角绑成同一个模块；层间用重力规则（实心不压空气）；跨两层的塔模块用 tall: 插槽，把 4 子格 × 2 层共 8 个子格绑成一个模块。`decode` 解回逐层父格解，拆散任何一组都会抛错。9 次求解共 1866 个模块，其中两层塔 60 座 | done | src/core/wfc.js, joint3d.html | tests/wfc-weighted-3d.mjs | joint3d-on：左边 3 层平面，右边等轴体块，赭红色两层塔，0 组不一致；joint3d-off：辐条改成通配后，81 组子格不一致，标红，decode 报错 |
| src/slotsolve.js | 865200072685912064 | 没有槽位缩略页，没有时序动画 | 新增 slots.html：10×8 槽位表，加 27 种角点变体的缩略图池（程序化替代美术）；按求解器真实 trace 逐帧播放，右侧画未定格数曲线；红色依赖链按帧从 explain 记录回溯；有冲突示例，点格子能看该格的链 | done | slots.html（共用 solveWFC / cornerSlots / dependencyChain） | tests/slot-playback.mjs（174 帧，每帧都有链）、tests/slot-variants.mjs | slots-idle：80 格里 66 格显示 27，14 个给定格黄框；slots-mid：第 22/60 帧，候选数 27/9/3 混合，有红链；slots-conflict：改坏的给定格红框、∅ 格、红色冲突链 |
| src/tileforce.js | 1751932427272909032, 1670794261669769217, 1579483114178768898 | 没有 3D prefab/socket；合成的小块没缝进已有网格 | `spliceModulePatch`：在已有网格挖星形洞，用耳切 + Lawson 翻边的三角带把合成小块缝进去（接缝最小角 ≥7.7°）。`halfEdgeClosure` 校验半边闭合、单一边界环、Euler=1。`solveWithPrefab` + `liftFootprint`：两层 7 格 prefab，外侧 socket 有 W 墙、D 门、R 顶、S 底，周围由共享 WFC 补齐 | done | src/core/module-patch.js, src/core/wfc.js, prefab.html | tests/prefab-splice.mjs、tests/module-force.mjs、tests/module-patch.mjs | prefab-splice：黄色洞 → 绿色 7 格合成块 + 31 个橙色接缝三角，右边是两层 prefab 实体；prefab-nosplice：在原网格里找到的足迹，能看到深色 D 门 |
| src/tileplace.js | 784847588893814785, 784847933686575104, 787319655648100352, 784848286272327680 | 没有加权熵，没有拼装动画 | `solveWFC({weighted:true})`：加权香农熵挑格，按权重无放回抽样排候选；默认关，关时 5/5 个种子的输出与 r53 逐字节一致。tile-assembly 默认开加权；按 explain 还原逐块顺序，`applyAssemblyPrefix` 逐块写进共享 World。assembly.html 用真实 View 播放落块和幽灵候选 | done | src/core/wfc.js, src/build/tile-assembly.js, assembly.html | tests/assembly-playback.mjs、tests/tile-assembly.mjs、tests/wfc-weighted-3d.mjs | assembly-mid：第 5/12 块，周围有黄色半透明幽灵；assembly-done：12 块全部建成；assembly-unweighted：关加权时 arch 7 个，开加权时 3 个。控制台有 12 条 toNonIndexed warning（共享 View 管线发出），0 error |
| src/spherefusion.js | 1768627849529893109, 1584623053061099520 | 星球已适配成共享 World，但没做页面验收 | planet.html 加 `?fusion=1` 开关和按钮；状态栏显示 World 数据（房子数、BUILT 位、建筑区、河道） | done | src/sphere/planet-town.js, planet.html | tests/sphere-r55.mjs、tests/planet-town.mjs | sphere-fusion：整颗星球有台地、海和房子，状态栏「13 栋 · BUILT 位 25 · 建筑区 13 · 河道 49 格」；sphere-all-on：所有开关同时打开，0 error |
| src/spherehouse.js | 1768627849529893109, 1584623053061099520 | 只有单层替代件，页面没看过 | `storeyHouseModule`：多层房子（底座 / 墙 / 层间腰线 / 窗 / 门 / 四坡顶，配色取自 REACode HOUSE）。每层按自己那一层的松弛角点变形；`?floors=mixed` 时每栋 1–3 层；有「看房子」近景按钮 | done | src/sphere/planet-town.js, planet.html | tests/sphere-r55.mjs（层间接缝、BUILT 位等于层数）、tests/planet-town.mjs | house-floors：3 层塔楼，每层有窗和腰线，越往上越窄；house-single：1 层房，有门窗和四坡顶 |
| src/spheretown.js | 1768627849529893109, 1338825080844021760, 1769641473895432220, 1769691526924292506, 1795831296952041691 | 多格约束冲突没解决，原模块形状不明 | `relaxConflictReport`：冲突度量。新解法 `solver:'shape'`：每片相连高地整体按测地距离等比收缩，墙倾斜 ≤ maxLean。<br>• 共享角点分歧：均值 0.095 → 0.007，最大 0.505 → 0.036 边长<br>• 形状误差：0.060 → 0.0003<br>• 墙最大倾斜：44.6° → 28.4°<br>• 无翻折 | **partial** | src/sphere/planet.js, planet.html | tests/sphere-r55.mjs、tests/sphere-relax.mjs | solver-shape：山顶格子收拢，状态栏显示分歧均 0.007、倾斜 ≤28°；solver-spring：旧解法，分歧 0.095，最大 0.50，倾斜 45° |
| engine/sphere.js | 1338829205157646336, 1338825080844021760 | 缺阶段动画 | `buildSphere({history})` 记录每一步的真实快照，开不开结果都一样。阶段：随机点 → 散开 → 按球极投影半径逐面三角化 → 松弛 → Delaunay 翻边（红色 = 违例边，绿色 = 新边）→ 星球。`?stages=1` 自动播放，`?stageT=x` 定格 | done | src/sphere/sphere-stages.js, src/sphere/planet.js, planet.html | tests/sphere-r55.mjs、tests/sphere-stages.mjs | stage-0.5：散开中的点云；stage-1.45：三角网从南端往上铺到 808/1796 面；stage-3.2：画面正中是红色违例边；stage-3.7：翻出来的绿色新边；stage-play：自动播放 |
| engine/worldmap.js | 1783792917183606829 | 没作为贴图上到星球，没做纹理混合 | `worldMapColors` / `WORLDMAP_GLSL` / worldmap-material.js：生成 512×256 等距柱状贴图，深海 / 浅海 / 沙岸 / 草 / 陡坡平滑混合。着色器按方向逐像素取色，没有经度接缝；顶面用贴图，侧墙保留格子颜色。`?map=1` 时格子高度改用同一个 3D 场，贴图与格子的海陆一致率 97% | done | src/sphere/worldmap.js, src/sphere/worldmap-material.js, planet.html | tests/sphere-r55.mjs | worldmap-on：台地顶面有沙岸和海岸纹理，海面有浅滩（本组主会话也复看过）；worldmap-off：同一场景只有格子纯色；worldmap-test：贴图光球 |
| engine/spritepack.js | 1593215065423245313, 1852334860137849222, 1849427564034498642, 1478114309263839244 | 没接贴图烘焙，填充率低（0.14–0.16） | ① `radialChartPack({footprint:'raster'})`：格子占用改成「三角真的碰到才占」（三角 / 方格 SAT），取代原来的逐三角包围盒，仍是保守覆盖，0 重叠。同时把实心核心只扫一次，混合网格耗时 2.4 s → 0.75 s。填充率：<br>• r53（bbox，cell 0.2）：0.158<br>• raster，cell 0.1：0.314<br>• raster，cell 0.05：0.48<br>② 新模块 src/core/uv-bake.js `bakeChartPage`：UV 页作为一个分配放进共享 Atlas（放不下就 grow，精灵槽保留）；逐三角光栅化，按重心插值 3D 位置 → `shade()`（世界棋盘 × 预烘方向光 × 高度色带，本地替代）→ 1px gutter。③ 新页面 uv-bake.html：模型只用无光照材质贴烘焙页 | **partial** | src/core/uv-charts.js, src/core/uv-bake.js, uv-bake.html | tests/uv-bake.mjs、tests/uv-charts.mjs、tests/atlas.mjs | spritepack-raster：左边岛模型贴着烘出来的棋盘 + 光照，右边是共享 Atlas 1024² 整页（灰块是精灵槽，黄框是 689² 的 UV 页，最大一片在中心），排布填充 31.4%，像素覆盖 36.6%，0 重叠；spritepack-bbox：r53 排法，填充 15.8%，覆盖 21.6%，红色图块描边 |
| src/squigglefield.js | 1105131621391495176 | ornament.html 没换用 | ornament-field.js 新增：<br>• `squiggleOrnament()`：移植 REACode buildOrnament 的胶囊版式，共 49 段<br>• `bakeSquiggleField`：桶加速，256×128 只烘焙一次<br>• `squiggleShadeSdf`：着色器的 CPU 镜像<br>• `SQUIGGLE_WOBBLE_GLSL`：与 JS 扭动公式相同<br>ornament.js 新增 `createSquiggleOrnament`：四折 abs、逐像素扭动相位、纸 / 墨 / 浮雕高光 / 斜向扫光，border/center cutoff 与展开沿用原滑杆。ornament.html 加复选框「卷草距离场」和 `?squiggle=1`，默认关；`&still=1&phase=x&sweep=y` 可定格 | done | src/core/ornament-field.js, src/ui/ornament.js, ornament.html | tests/squiggle-ornament.mjs、tests/squiggle-field.mjs、tests/ornament-field.mjs | squiggle-on-t0：灰纸上一块对称牌匾，有双线框、两端竖梃、左右卷草、上下翼饰，边缘不规则抖动，墨占 21.7%；squiggle-on-t17：同一形状换相位后边缘位置变了，斜向扫光带可见，墨占 19.8%（扫光会提亮墨）；squiggle-play：自动播放，相位 5.08；squiggle-off：关掉后仍是原来的米色镜像纹饰 |

## 说明

**数据来源和尚未验证的部分**
- 原美术都没有，用的程序化替代：槽位缩略图、FORT/RUIN 胶囊美术、星球房子模块（REACode 原版本身也是程序化单层房）、卷草（用的是 REACode 手摆的胶囊版式）、烘焙内容（棋盘 + 光照）。
- `squiggle-ornament.mjs` 量了扭动对墨量的影响：CPU 镜像下，相位 0 与 1.7 的墨量差约 3%。

**两个 partial 的原因**
- **spheretown**：大小和墙倾斜冲突时墙优先，宽大高原剩下的蘑菇化有几何下界，平均大小误差 0.40（旧弹簧是 0.26，但形状被拉歪）。另有 6 片高原跨度太大，没法整体收缩，原样保留。REACode spheretown 自己标了 Not done，原模块的目标形状没有出处，本轮推断为「该格在海平面上的形状」。
- **spritepack**：
  - 填充率翻了一倍多，但仍低于 0.5。上限主要卡在约 70% 的图块只有 1–2 个三角（悬崖墙按法线分片后很碎），需要做墙带展开 / 图块合并。
  - 烘焙页没有接进主场景 View 的地形材质。impostor / View 不归本组，当前的接法是：`bakeChartPage(weldSoup(worldMesh soup), radialChartPack(...,{footprint:'raster'}), {atlas: impostorBaker.atlas})`，再把 uvs 和图集纹理给地形材质。

**全量测试**
- `tests/*.mjs` 共 245 个，244 个通过。
- 唯一失败的是 tests/battle-g3.mjs，它引用 squad-standard / melee-sweep，是 G3 正在改的文件，与本组无关。
- 旧的 *-browser.cjs 写死了 Mac Chrome 路径，VM 里没有 node 版 playwright，所以没跑；浏览器验收改用 shot.py。

**分工**：球面五件和网格四件由两个并行子线完成，spritepack 和 squigglefield 由本组主线完成。端口用了 8795、8805、8806，避免同时起服务冲突。
