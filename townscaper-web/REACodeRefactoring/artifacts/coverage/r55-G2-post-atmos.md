# 第 55 批 · G2（渲染循环 / 网格法线 / 大气植被组）

范围：src/smear.js、engine/outline.js、src/clouddeck.js、src/penumbra.js、src/flowdemo.js、src/voxelflow.js、src/wind.js、src/floatprobe.js、src/edgesmooth.js、src/shrubcard.js、engine/impostor.js、src/levelflora.js、src/dual.js（13 个）。

## 接法（view.js 只动两行）

- `src/world/view.js`：第 47 行加了一行 `import { installPostExtras } from './view-post-extras.js'`，构造函数末尾（`setTimeOfDay('day')` 之后）调用一次 `installPostExtras(this)`。其余逻辑都在新文件里。
- `src/world/view-post-extras.js`：包了一层 `renderer.render`，只接管 `(view.scene, view.camera)` 画到屏幕的那一次调用；阴影图、impostor 烘焙、反射等其他渲染照常走原路径。另外把风旗、地形半影接在 `decor.flagMat` / `view.material` 原有的 `onBeforeCompile` 后面，并包了一层 `vegetation.refresh` 和 `atmosphere.rebuild`。没有改 decor.js、vegetation.js、atmosphere.js。
- **10 个开关全部默认关**。打开方式有两种：URL `?fx=outline,smear,clouddeck,penumbra3d,softnormals,windflag,wallcards,levelflora,dualflora,impostorpitch`（逗号分隔），或者 `view.postExtras.set(name, on)`。另有调试参数 `?spin=1.5`，让相机自动绕转，用于验收拖影。也可以用 `window.__postExtras` / `view.postExtras.stats()` 读取度量。
- **面板项请 G1 接**：每个复选框调用 `view.postExtras.set('<name>', checked)` 即可，名字就是上面那 10 个。
- worldmesh.js 没改（软法线直接写到 `view.mesh.geometry` 上，Atmosphere 重建后会自动重烘）。

## 逐模块

| 模块 | 片子 | 原缺口 | 本轮做了什么 | 判定 | 落点 | node 测试 | 浏览器截图（文件名 + 看到了什么） |
|---|---|---|---|---|---|---|---|
| src/smear.js | 1727315611959865407, 1727324352264474664 | View 仍用历史叠加，没换成解析拖影 | `fx=smear`：整帧先画进 HalfFloat+MSAA 目标，再做一遍全屏合成，按 v = ω×(p−c)·快门 沿切向取 6 个三角权重样本（与 REACode smear.js 同权重）。中心取相机目标点投到屏幕的位置；ω 取 dyaw/dt·sin(俯角)；快门固定为 1/60 s（低帧率时拖影不会跟着变长）。与原来的 `motionblur` 历史叠加各有开关，可以同时开。JS 孪生与 core/camera-motion.js 的 smearImage 逐像素比较，差 ≤1/255 | done | src/world/view-post-extras.js | tests/view-post-extras.mjs | g2-smear-on.png（spin=2.5：岛的外圈沿切向糊开，中心清楚，没有重影）/ g2-smear-off.png（同样转速、关掉拖影，画面清楚）/ g2-smear-still.png（开着但相机不动，ω=0，画面不变）。外圈 p95 梯度 17.2 → 9.7（−44%），内圈 60.7 → 39.8；静止时 17.9 / 62.6 |
| engine/outline.js | 1482011744843223042, 1017355723171344385 | 没接 view 渲染循环；没做 GPU 验收；法线图集 / 笔触缺 | `fx=outline`：ScreenOutlinePass 接进渲染循环（颜色+深度、法线、合成三遍）。颜色目标改为 HalfFloat 线性，色调映射挪到合成时做，所以开关前后整体色调一致。法线遍把透明且不写深度的物体（云卡、云带、半影平面）以及线、点、精灵都隐藏起来：首轮实测时这些东西的四边形轮廓被描成了墨线，现已修掉 | **partial** | src/world/outline-pass.js, view-post-extras.js | tests/outline-pass.mjs, tests/view-post-extras.mjs | g2-outline-on.png（房子、栏杆、海鸥都有细墨线，岩面朝上的边带一点暖色，水面没有杂线）/ g2-outline-off.png。还缺：原片的"程序化笔触法线图 / 专用反差贴图"作为线源没做 |
| src/clouddeck.js | 1243228419162341379 | 没接渲染；缺高耸云体 | `fx=clouddeck`：①三圈围岛的云带（半径都大于相机距离，永远在背景），片元按 deck 团块画"一团压一团"的积云，每个团块 6 个圆；视差速度 ∝ 1/深度（实测平移量 3.0 / 4.8 / 9.6），模糊 ∝ 深度，远层混入雾色，底部融进海面。②云影：近层和中层团块喂进 View 已有的 CloudShadow 着色器，沿太阳方向投到任意高度的接收面；deck 的椭圆拆成一串圆。图集用程序化软斑代替（没有原版素材） | done | src/world/cloud-deck-layer.js | tests/cloud-deck-layer.mjs | g2-clouddeck-on.png（低俯角：镇子背后是成团往上堆的白灰色云墙，三层前后叠着，下沿是软的）/ g2-clouddeck-off.png / g2-clouddeck-top-on.png + g2-clouddeck-shadow-diff.png（俯视差分图：岛中部一大片边缘柔和的云影，左下和右侧没被盖住；平均变暗 8.4/255）。注：水面材质本身不读云影 |
| src/penumbra.js | 1305951750638231552, 1313840428685447170 | View 仍只画在水面 | `fx=penumbra3d`：用 bakeVoxelPenumbra 在共享 World 上按体素算接收者（悬挑下的地面和板顶是两个接收者），按层打包成 (nx, nz·ny) 纹理，链到地形材质上，只作用于朝上的面。开启时关掉地形自身的 PCF 接收（由半影代替），同时打开原有的水面半影层；关闭时全部还原。世界或太阳变了才重烘（terrain 场景约 108 ms） | done | src/world/penumbra-terrain.js | tests/penumbra-terrain.mjs | g2-penumbra3d-on.png / -off.png / -diff.png（低太阳：崖脚下层台地出现边缘柔和的影带，水面半影也在；差分图白色是新增软影）。代价：树这类不在 World 里的投影体，开启后不再在地面投 PCF 影（差分图里黑色的部分） |
| src/flowdemo.js | 931196707236392960 | 没应用到 View 网格 | `fx=softnormals`：Atmosphere.bakeSoftNormals 写回 View 主网格的法线（minDot .5 保住硬边），原法线备份一份；关闭后逐值还原，World 改了以后重烘 | done | view-post-extras.js | tests/view-post-extras.mjs | g2-softnormals-on.png / -off.png（terrain 近景：崖面明暗变成渐变，没那么碎；37296 个顶点被软化，276 个保持硬边；像素平均差 3.1/255，14% 像素差 >6） |
| src/voxelflow.js | 931196707236392960, 926903893866541057, 943230624369868800 | 软法线没对 View 主网格调用；碰撞器没喂实时网格 | 同上，另外把形变后的主网格三角形喂给 meshCollider，提供 `view.postExtras.groundAt(x,z,maxY)` | done | view-post-extras.js | tests/view-post-extras.mjs | g2-softnormals-on.png 的 eval：736 格中有 17 格网格表面与列顶高度不同（最大 0.06），说明碰撞读的是实际显示的形变网格 |
| src/wind.js | 926903893866541057, 926890207298899969 | 旗子着色器没用风纹理 | `fx=windflag`：旗子着色器（链在 Decor 原正弦波之后）在旗杆顶和旗尾各采一次 Atmosphere 风场纹理：旗面转到当地风向；旗尾风向不同就弯；风弱时下垂，风强时抖得快 | done | view-post-extras.js | tests/view-post-extras.mjs | g2-windflag-on.png / -off.png：把风向改成 120° 后（Decor 不会重排旗子），开着的旗子已转到新风向，关着的还停在旧朝向（两面旗平均偏差 105°）。小瑕疵：法线没跟着转，转过去的旗面略暗 |
| src/floatprobe.js | 1664565063552847873 | GPU 平流与跨平台矩阵未测 | 新增 float-advect-gpu.js：在真实 WebGL2 上用 RGBA32F / RGBA16F / RGBA8 渲染目标 ping-pong 60 步再回读，与 CPU f64 参考、CPU 同格式仿真对比。float.html 加了一张表 | **partial** | src/world/float-advect-gpu.js, float.html | tests/float-advect-gpu.mjs | g2-floatprobe-gpu.png + .json（SwiftShader）：32F 对参考误差 3.6e-8；16F 对参考 8.8e-4，但对 CPU 仿真只差 1.9e-6；8 位和 nearest 与 CPU 仿真逐位一致。结论：CPU 仿真能代表 GPU。还缺：只有这一个 GPU，跨平台矩阵测不了 |
| src/edgesmooth.js | 1670720537662836736, 1670725072540106755 | 边类仍按网格边；regularity 没复现大降 | 新增 edge-square-relax.js：照搬 grid.js 的方格目标松弛（就是 REACode edgesmooth.js 末尾记下但没落地的那种做法），套上边类层级：hard 只沿自己的硬线滑（拐角钉住）；tile / material 只沿自己的边滑；free 自由。输入是**未松弛**网格，这才是"底层怪网格的毛糙"。View 用的网格已经松弛过 80 遍，所以 shape.js 量不出大降 | done | src/terrain/edge-square-relax.js, edge-smooth.html | tests/edge-square-relax.mjs | g2-edgesmooth.png（三块面板：普通平滑把黑色海岸线、红色房界拖圆了；分层平滑保住了线，内部格子变方。四边形网格 regularity：无 26.8 / 普通 13.7 / 分层 19.5；自由格 26.9 / 12.7 / 14.1；硬点位移 0 / 0.121 / 0.013）。"按网格边"这一点与 REACode classifyEdges 相同（原模块也按格边分类）。没有应用到 View 主网格，因为主网格已经是方的 |
| src/shrubcard.js | 1191990107785572352 | 没目视 | `fx=wallcards`：打开 Vegetation.wallShrubCards 并重新撒植被 | done | view-post-extras.js（vegetation.js 现成开关） | tests/shrub-card.mjs | g2-wallcards-on.png / -off.png（fusion 近景：蓝房、红房墙根原来是一串圆球灌木，换成了有锯齿叶缘的折卡，贴墙排开；574 张卡） |
| engine/impostor.js | 1849427564034498642 等 | 缺多俯仰视图、球面卡片、原云材质 | impostor.js：`bake(geo,{pitches})` 支持多行俯仰（每行 8 个方位，最多 4 行）；`ImpostorField({sphere})` 支持球面卡片（整张朝向镜头，并按视角 alpha × 球面叶隙，出自 REACode 1205420678859632640 段）；着色器四帧双线性（方位 × 俯仰）；`blobCloudGeometry` 移植了原版 makeBlobCloud + bakeLitColors 的顶点色云。`fx=impostorpitch` 用 3 行（0.12/0.42/0.85 rad）重烘树，云换成原版材质。默认单行不变 | done | src/life/impostor.js, view-post-extras.js | tests/impostor-pitch.mjs, tests/impostor-bend.mjs | g2-impostorpitch-on.png / -off.png（高俯角：关时单行树卡像侧面的树"躺"在地上，开后是从上往下看的圆冠，边缘有叶隙）/ g2-impostorpitch-clouds.png（原版云材质：暖白、底部略暗的一排团云） |
| src/levelflora.js | 959530111187013632 | 物种几何没建模 | flora-species.js：LEVEL_SPECIES 的 6 种 shape 各建程序化几何（白花碎点 / 矮圆丛 / 高草细叶 / 蕨扇 / 圆叶灌木 / 两节松），每格一簇同种。`fx=levelflora` 同时打开 Vegetation 的物种调色。没有原版美术素材，用程序化代替 | done | src/life/flora-species.js | tests/flora-species.mjs, tests/level-flora-species.mjs | g2-levelflora-on.png / -off.png（terrain：上层台地是松和灰石苔，下层是圆灌木和紫色石南，看形状就能分出层级；关时全是同一种墨线叶团） |
| src/dual.js | 959752525867036672 | 植被管线没切到对偶落点；崖壁竖面没覆盖 | `fx=dualflora`：地被丛落到 dualFoliageSites（每个顶点格一处）。崖壁竖面：新增 dualWallSites，即下落边端点的顶点列 × 每层墙半高，丛朝外倾斜挂在崖壁上。坐标都走 shape.at，跟着地形形变 | done | src/life/flora-species.js | tests/flora-species.mjs, tests/dual-foliage.mjs | g2-dualflora-on.png（574 个对偶落点，丛分布均匀）/ g2-dualflora-walls.png（近景：崖壁半高处挂着深绿和灰色小丛；505 处） |

## 综合截图

- g2-all-on.png：fusion 场景 10 个开关全开加 spin，零报错，各效果可以叠加。
- g2-outline-off.png（= 默认 index）、g2-badnorth-default.png：默认画面和以前一样，零报错。
- 所有截图的控制台 error/warn 都是 0（只有原来就有的 `toNonIndexed` 提示，已过滤）。

## 测试

- 新增 7 个：tests/view-post-extras.mjs、penumbra-terrain.mjs、cloud-deck-layer.mjs、flora-species.mjs、impostor-pitch.mjs、edge-square-relax.mjs、float-advect-gpu.mjs。
- `for f in tests/*.mjs` 全量 251 个，**全部通过**。

## 改动文件

- 新建：src/world/view-post-extras.js、cloud-deck-layer.js、penumbra-terrain.js、float-advect-gpu.js；src/life/flora-species.js；src/terrain/edge-square-relax.js；edge-smooth.html；上面 7 个测试；artifacts/coverage/shots-r55/g2-*.png、g2-floatprobe-gpu.json。
- 修改：src/world/view.js（1 行 import + 1 行调用）、src/world/outline-pass.js（HalfFloat 颜色目标、合成补色调映射、法线遍跳过透明物、线、点）、src/life/impostor.js（pitches / sphere / blobCloudGeometry；默认路径不变）、float.html（GPU 平流表）。
- 没碰：REACode、REA-agent、.workbuddy、worldmesh.js、battle.js、learn/*、CHANGELOG 等记账文件。
