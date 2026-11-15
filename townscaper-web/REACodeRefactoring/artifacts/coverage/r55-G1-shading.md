# r55 · G1 View 着色组：12 个模块接进 View 主材质

范围：12 个「机制已写好、没接 View」的着色模块。全部接进 View 主材质（`view.material` 的链式 `onBeforeCompile`），**默认关**。打开方式有三种：环境面板「着色实验（默认关）· 第 55 批」里的 12 个复选框；地址参数 `?shade=key1,key2`；或调用 `view.setDebug(key, true)`。

浏览器验收：VM 里用 headless Chromium（SwiftShader）截了开/关对比图，每张都用 Read 打开看过。12 个开关同时打开，在北境场景 + 三角/方格混合网格上也截了一张，控制台 shader error 为 0，warn 只有原有的 `toNonIndexed` 提示。真 GPU 的性能没测。

没改 REACode、REA-agent、.workbuddy；没 git；没删文件；没写 learn/*、CHANGELOG、PIPELINE、MODULE-REFACTOR-STATUS。

## 改动文件
- **新** `src/world/view-shading.js`：ShadingExtras，负责链式着色器补丁、12 个开关、按 World.version / 太阳方向防抖重烘，以及 `?shade=` 解析。
- **新** `src/ui/shading-panel.js`：面板里的 12 个复选框，加八角色体角点编辑器（5 个特征 × 8 个角点取色器，改了马上生效）。
- **新** `tests/view-shading.mjs`、`tools/shot-ab.py`（同一次页面加载里截多个变体，并收集控制台日志）。
- `src/world/view.js`（G1 独占）改了 5 处：1 行 import；构造里 `this.shading = new ShadingExtras(this)`；`setDebug` 的 default 分支转给 `this.shading.set`；`render` 里每帧调 `this.shading.update()`；构造末尾读 `?shade=`。G2 加的 `installPostExtras` 那一行原样保留。
- `src/ui/environment-panel.js`：只加了 1 行 import 和 1 行 `mountShadingPanel(...)`。
- `src/light/surface-bounce.js`：校准，新增 split 模型（详见下面 bouncegi 一行）。旧模型保留为 `model:'legacy'`。
- `src/light/surface-shadow.js`：`surfaceHeightsFromWorld` 加了可选的 `shape`（按形变后的顶面多边形栅格化），新增 `bakeFloorShadow`（洞内地面）。纹理 G 通道存顶面高度、B 通道存洞内阴影。GLSL 加了 `uSurfaceShadowExt`；`GroundSurfaceShadow` 新增 `receivers:'top'|'all'`。不传新参数时，旧路径的结果与改前逐值一致（R 通道不变；扩展分支只在 ext.x>0.5 时生效）。
- `tests/surface-bounce.mjs`：断言改成校准后的标准，并加了真实 World 地形岛的对照。

## 逐模块

| 模块 | 片子 | 原缺口 | 本轮做了什么 | 判定 | 落点 | node 测试 | 浏览器截图（看到了什么） |
|---|---|---|---|---|---|---|---|
| src/colorvolume.js | 1710031224838771027、1712088611934371876 | 八角色体没接 View shader，没有拖拽 UI | 每格用 `classifyWorldFeature` 分成五特征，(u 高度, v 坡度, w 变化) 栅格进 320² 的世界 XZ 图。GPU 上取该特征 8 个 OKLab 角点做三线性插值，再转回线性 sRGB：崖壁一律用 Cliff 色体，顶面用 Grass/Beach/Flowers，房顶用 Roof。编辑 UI 是面板上每个角点一个取色器，改色只换 uniform、不重烘。注：原 JS 实验页本来就没有拖拽，片子里是在 3D 里拖角点，这里用取色器代替 | done | view-shading.js（cvolume）、shading-panel.js | tests/view-shading.mjs、tests/color-volume-corners.mjs | g1-cvolume-ab：开了以后草顶按格变色，散落品红色的 Flowers 格，崖壁变成蓝灰的 Cliff 色体，沙滩变浅（46% 像素变化）。g1-panel-panel：面板里把 Grass 角点 0 改红、角点 4 改蓝，岛上草格立刻带上红/蓝倾向 |
| src/contrasttex.js | 1482346496460828674 | OKLab 三角松弛没接 View，atlas/paint 没迁 | 共享 World 三角扇（10064 个三角）跑 OKLab 松弛：同特征边 ΔE 13.75→0.10，对比边最小 ΔE 0.8→14.3。结果画进 512² 世界 XZ 图（即 paint 进 atlas）。顶面按 0.55 混入该色；色图的 fwidth 大的地方画像素宽细线（即「pixel thin lines from contrasts」） | done | view-shading.js（contrasttex） | tests/view-shading.mjs、tests/contrast-texture.mjs | g1-contrasttex-ab / -crop：各台地按特征分成连续色区（黄、青绿），台地交界处出现细暗线 |
| src/paintnormal.js | 1481661852887265288 | 没接 View | 128² 可平铺的大笔触法线图（25 块）。片元按法线主轴选平面投影采样，在切线空间扰动法线，顶点不动 | done | view-shading.js（paintnormal） | tests/view-shading.mjs、tests/paint-normal.mjs | g1-paintnormal-ab：墙面和屋顶出现大块不规则明暗笔触，轮廓不变（42% 像素变化，平均亮度不变） |
| src/patchblend.js | 1781405550061687016 | 没接 terrainmesh/View | `buildPatchField` 在共享 World 岸线上算出有符号距离 sd 和弧长 u，u 用 sin/cos 编码以防插值跨周期出错，写进 RGBA 图。View 着色器只作用在 terrainmesh 写的地形顶面（vField.z=1）：岸带是手工 UV patch（弧长决定等距白点，v 决定深浅），和地形顶面原色（投影 patch）按 patch 高度差做 smoothstep 混合，即原文的 height-based blending。贴图是程序化替身（没有原美术）。白点挪到岸带陆侧那一半，因为 View 里水是另一张海面，岸带水侧那一半没有画 | done | view-shading.js（patchblend） | tests/view-shading.mjs、tests/patch-blend.mjs | g1-patchblend-ab（镜头对准岸边）：沙滩沿岸线出现一圈等距白点和偏暖的岸带，往内按高度渐变回沙色 |
| engine/blotch.js | 1696864977171189980、1696896119794479541、1703750394164199473、1704246032626762189 | 没接 View 材质 | 128² 笔触图集（mipmap + repeat）+ 共享 World 台地边缘场（128²），走 `BLOTCH_RIM_GLSL`：顶面笔触在崖肩前收住，崖面只在沿口往下受控渗一段，还有漩涡、密度、分段线、坡向条纹 | done | view-shading.js（blotchatlas） | tests/view-shading.mjs、tests/blotch-atlas.mjs | g1-blotchatlas-ab：草面上出现大块冷绿笔触，沿口一圈保持干净，崖面多了竖向条纹 |
| engine/bnbrush.js | — | 没接着色器 | 256² 方向划痕图集；着色移植自 engine/badnorth.html（smoothstep 阈值化 coarse/fine/density，深笔触压暗，细划痕提亮）；边缘场让笔触在沿口淡出，沙地不画 | done | view-shading.js（brushscratch） | tests/view-shading.mjs、tests/brush-atlas.mjs | g1-brushscratch-ab：近景草面出现一笔一笔的方向划痕，沙地和沿口干净 |
| engine/surface.js | 1241096929490149376、1714613599035863191、1699038611125985317、1699146321318314094 | 没挂到 View 共享材质 | `SURFACE_PATTERN_GLSL` 整层挂进 View 主材质（只作用在地形顶面和岩壁）：地面像素宽格线和缩小淡出、崖面层理（先扭再采样）、砂砾 | done | view-shading.js（surfacepattern） | tests/view-shading.mjs、tests/surface-pattern.mjs | g1-surfacepattern-ab：台地顶面出现细格线，岩壁出现多道弯曲层理（35% 像素变化） |
| src/surfaceshadow.js | 1704218784028905984、1705195380457996629 | 墙、洞、形变面都不接收 | 打开后用 `receivers:'all'`。① 形变：按 `worldMesh.shape.at(p, top)` 的形变后顶面多边形栅格化，影子图贴在实际网格上。② 洞：`bakeFloorShadow` 找本列「头顶有实心的空层地面」，在共享 World 体素里朝太阳打 3 条散开射线，结果写 B 通道；片元低于本列顶面 0.2 以上就改用 B 通道。③ 墙：见下一行 | done | surface-shadow.js、view-shading.js（surfaceshadow） | tests/view-shading.mjs（人工搭悬挑：洞内地面被挡）、tests/surface-shadow-casters.mjs | g1-surfaceshadow-ab / -crop：关 = 只有顶面接收，开 = 竖墙和崖面多一层浅影。浏览器度量 deformed:true、洞内地面纹素 205 个、其中 152 个被挡。注：截图里没单独找到能清楚看见洞内地面的角度，洞内这一项靠浏览器度量 + node 测试 |
| engine/surfaceshadow.js | 同上 | 竖面着色要改 view.js，没做 | 竖直面（\|n.y\|<0.3）吃 `surfaceShadowToneN` 的窄条：0.28 倍强度，采样点沿法线外移 0.06，取到檐下那块地的影子。屋顶斜面排除，因为第一版把屋顶误压暗了，看图后改掉。engine 的 relative 投射资格保留为 `set({eligibility:'relative'})` | done | view-shading.js（COLOR_BODY）、surface-shadow.js | tests/view-shading.mjs | 同上图：墙面在檐下变暗，屋顶不受影响 |
| src/mountainlight.js | 1786014232594485497 | 山体 atlas、球面混合、View 接入缺 | `worldMountainField` 加 `renderMountainShade('baked')` 烘出山体图集（N·L 折进明度，加白斑和 99.7 百分位脊线墨），岩壁直接用图集色输出，运行时 0 次法线采样（runtimeNormalTaps=0）。「球面混合」一项已过时：原 src/mountainlight.js 里没有球面代码，View 的 World 是平面的。低端设备的实测耗时要真 GPU，没测；成本账沿用原文件的「+25% 采样」分析 | done | view-shading.js（mountainatlas） | tests/view-shading.mjs、tests/mountain-light.mjs | g1-mountainatlas-ab：岩壁从带层理的受光灰变成平涂浅色烘焙明度（不再随太阳变）。原片里山体本来就是平的、靠描边和白斑 |
| src/bouncegi.js | 1580835075629133825 | 与暴力参考相关只有 0.53、校准偏低、没接 View | **校准**：查明旧版有三个问题。① 崖肩格的代表点放在沿口，谷底看过去几乎掠射，同高的邻格还会把射线挡死。② 采样圈每个点只按 1 格面积算。③ 半径按格数算，pitch 细的时候只看得到 2 个单位远。结果总量只有参考的 1/12，只能乘 calibration=4 硬拉。新 split 模型：每格拆成顶面片 + 崖面片（崖面中点、朝低邻居、面积 pitch×落差）；采样点按 2πr/n 加权；半径按世界单位；端点邻域只用端点格的顶高判遮挡；calibration 回到物理值 1。结果对照 256–1024 射线暴力参考：峡谷 r 0.53→0.89–0.91、总量比约 1.0；凹凸柱场 r 0.88；共享 World「地形」岛 0.54→0.82；「融合」岛 0.65→0.84。**接 View**：从 World 采 0.25 间距场，2 跳 gather，算出 gathered=added/albedo 写成纹理，片元 `indirectDiffuse += albedo·gathered·sun.intensity/π` | done | surface-bounce.js、view-shading.js（surfacebounce） | tests/surface-bounce.mjs（新断言：r>0.85、比旧版高 0.25 以上、地形岛 r>0.75）、tests/view-shading.mjs | g1-surfacebounce-ab：背光崖面和阴影里的地面变亮，带受光面的颜色；两跳收敛 0.022→0.0027 |
| src/lighting.js | 931196707236392960、1168571866405097472、1062374549407350790 等 | 体素软法线和分层场纹理已有，但没接 WorldMesh/View，GLSL 没在 GPU 上跑过 | ① voxelfield：`bakeLighting({keepField})` 的分层占用 + 反弹色打包成 214×2470 浮点纹理，**顶点着色器**里采样（即「sampled in the vertex shader」），在片元里重现 CPU 烘焙的 AO 和彩色反弹。开着时会关掉 WorldMesh 的 CPU 顶点烘焙，避免叠两遍，关掉即恢复。② voxelnormals：体素占用梯度软法线写回 WorldMesh 主几何的法线，几何重建后会自动重新写，关掉还原。SDF 和六向体积早已通过 lightvolume.js 进了 View 的 bakeGI。原 JS 在 SDF 命中点取的是墙色，没有真正的 mega texture 资产，所以这一项不在本模块的源码里 | done | view-shading.js（voxelfield、voxelnormals） | tests/view-shading.mjs、tests/voxel-field-normals.mjs | g1-voxelfield-3way：左 = CPU 烘焙，中 = 关掉 AO（房脚、檐下的接触暗都没了），右 = GPU 顶点采样，接触暗回来了，与左图只差 1.3% 像素。g1-voxelnormals-crop：墙面和屋顶的明暗过渡变软（touched 46770/52512） |

## 其他浏览器验收
- `g1-all12-badnorth-mixed.png`：北境场景 + 混合网格，12 个开关全开（`?shade=` 全列）。画面正常，shader error 为 0。
- `g1-panel-panel.png`：面板分组、12 个复选框、角点编辑器，改色后马上生效。
- 截图都在 `artifacts/coverage/shots-r55/g1-*`（`-off` / `-on` / `-ab` 左关右开；部分有 `-crop` 局部放大）。

## 测试
- `tests/view-shading.mjs`：新增，测链式补丁、12 个开关的烘焙和 uniform、编辑后重烘、CPU 烘焙临时关闭与恢复、法线写回与还原、影子图贴形变网格和洞内地面、角点编辑、`?shade=`。
- 全量 `tests/*.mjs` 共 243 个，只有 `tests/battle-g3.mjs` 失败。它是 G3 的文件，18:10 还在被修改，与本组改动无关。

## 已知事项
- G2 的 `softnormals`（view-post-extras.js）同样写回主网格法线。它和本组的 `voxelnormals` 都默认关；两个同时开会叠加，建议互斥使用。
- 着色器会一直编译这些分支（只用 uniform 开关），SwiftShader 首帧编译稍慢；真 GPU 下的帧时没测。
- patchblend、brushscratch、blotchatlas 的贴图都是程序化替身（没有原美术素材）。
