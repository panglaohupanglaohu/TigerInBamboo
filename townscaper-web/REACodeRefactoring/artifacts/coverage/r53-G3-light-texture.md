# r53 · G3-light-texture 部分覆盖补齐

范围：15 个模块（光照 / 阴影 / 纹理 / 色彩）。所有测试都只用 node 跑过。本 VM 没有 Chrome，没有做浏览器验收，也没有目视检查。
没改 REACode，没写 learn/*、CHANGELOG、PIPELINE，没删任何文件。

几处改了已有文件，都是最小插入，原有默认行为不变：
- `src/world/worldmesh.js`：`setBakeLighting` 透传 `aoMode`/`sunShadow`。开了太阳阴影时，增量重烘的影响半径按阴影射程扩大。
- `ao-stages.html`：多 4 个档位。
- `src/light/bake.js`：新参数默认关闭，默认烘焙结果逐值不变（有测试）。

改了默认可见输出的两处（都没做目视验收）：
- `src/light/penumbra.js`：View 水面半影的粗体素一遍改为均值池化。
- `src/light/surface-shadow.js`：View 地表阴影默认三条光线，并计入屋顶投射。

| 模块 | 片子 | 原缺口 | 判定 | 落点 | 测试 |
|---|---|---|---|---|---|
| engine/voxelshadow.js | 1190191289922465793 | AO/阴影已有，但逐顶点体素方向阴影没核实 | 本轮补上：在 bakeLighting 共用的模糊前 0/1 分层占用上，沿太阳方向走 10 步，越远命中越淡（1-0.55d²），最深压暗 0.24。分块烘焙会按射程补边，WorldMesh 能开关，编辑后跟着变，默认路径不变。没目视、没 UI 绑定 View 太阳 | src/light/bake.js（sunShadow）、src/world/worldmesh.js、ao-stages.html | tests/voxel-sun-shadow.mjs、tests/voxel-ao-stages.mjs |
| src/voxelao.js | 793557992931266561 | 本地四档不等于原片 flat/up/vertexAO/SSAO/directionalAO；原六向算法缺 | 本轮补上：bakeLighting 加 aoMode 四档（flat/up/vertex/directional）。directional 每顶点存六个方向遮蔽量并按方向着色，WorldMesh 有透传；原 buildVoxelAO/faceShading/stats 已迁到共享 World。SSAO 原作自己去掉了（原模块里也没有），不迁 | src/light/bake.js、src/light/voxel-ao.js、ao-stages.html | tests/voxel-ao-stages.mjs |
| src/lighting.js | 931196707236392960、1168571866405097472、1062374549407350790、1580845127207387137 等 | 体素软法线写回、GPU 动态纹理重投影/顶点着色器采样、SDF/UV/大纹理（mega texture）反馈、形变碰撞缺 | 仍缺：体素软法线写回（bakeVoxelSoftNormals）和分层场打包成纹理＋GLSL 采样（JS 镜像与 CPU 取样误差约 3e-17）已补；但没接进 WorldMesh/View，GLSL 没在 GPU 上编译过。大纹理 UV 反馈和形变碰撞仍没做 | src/light/voxel-field.js、src/light/bake.js（keepField） | tests/voxel-field-normals.mjs |
| src/bouncegi.js | 1580835075629133825 | 2.5D 表面形因子收集（gather）、暴力参考/audit 接口没迁 | 仍缺：已迁到从共享 World 采样的高度场，包括真实面积、按弧长均分的采样圈、可见性、蒙特卡洛参考和 audit，还能写进顶点色。峡谷对照里一跳暗部 ×1.13、两跳 ×1.145，暖色上升。与暴力参考：整体相关 0.53，暗部总量只有参考的 0.48（定标 4 是原作在 res≈64 下量的，粗格偏低）。没接进 View | src/light/surface-bounce.js | tests/surface-bounce.mjs |
| src/penumbra.js | 1305951750638231552、1313840428685447170 | 只有 2.5D 水面；洞/悬挑/形变表面、距离指标接口缺；视觉半影偏宽 | 仍缺：粗体素一遍改成原作的均值池化（最大值池化会把影子撑胖，带宽 40→31 格），加了地形自接收、distToMask/penumbraStats（世界单位带宽），还有 3D 体素版（悬挑下的地面和板顶分别接收）。View 图层仍只画水面，地面/悬挑接收者没进 View，形变表面没做，半影宽度没目视复核 | src/core/penumbra.js、src/light/penumbra.js | tests/penumbra-voxel.mjs、tests/penumbra.mjs |
| src/surfaceshadow.js | 1704218784028905984、1705195380457996629 | 纹理浮凸、屋檐/墙面、洞内、形变贴附/接缝和完整接口缺 | 仍缺：已补屋顶投射体（建筑顶面＋屋面抬升）、三条散开光线软边、两种投射资格（prominence/relative）、shadowStats（檐下/崖边/其他）、islandSeams、sweep。View 现在用屋顶投射体和三条光线。墙面一窄条只给了 GLSL 函数，没接 view.js；洞内和形变表面没做 | src/light/surface-shadow.js | tests/surface-shadow-casters.mjs |
| engine/surfaceshadow.js | 同上 | 同上 | 仍缺：engine 版的「投射高度＝相对接收面高差」（relative）、房子屋顶算投射体、竖直面只吃窄条（surfaceShadowToneN）已迁。竖直面着色要改 view.js（另一会话负责，没碰），只在 node 验证 | src/light/surface-shadow.js | tests/surface-shadow-casters.mjs |
| engine/blotch.js | 1696864977171189980、1696896119794479541、1703750394164199473、1704246032626762189、1786014232594485497 | createBlotchAtlas / createRimField、距离场受控外渗（bleed）、swirl/density/streak/segments 接口没迁；目视大环纹偏强 | 仍缺：图集和共享 World 边缘场（倒角距离，编辑后按 version 重建）、受控外渗、旋涡、密度、分段线、条纹已补，有 CPU 参考和 GLSL。没接进 View 材质，实景大环纹没改，反射也没同步 | src/terrain/blotch-atlas.js | tests/blotch-atlas.mjs |
| src/patchblend.js | 1781405550061687016 | patch 样本/手工 UV、seamStats/edgeJump/AB 没迁，没运行验收 | 仍缺：已迁到共享 World 岸线（弧长作 u、有符号距离作 v），有高度混合和 hard/alpha 两种基线，指标已搬，跑过（height 模式的接缝跳变和细节保留都落在 hard 与 alpha 之间）。没接进 terrainmesh/View，纹样是程序化替身 | src/terrain/patch-blend.js | tests/patch-blend.mjs |
| engine/surface.js | 1241096929490149376、1714613599035863191、1781405550061687016、1699038611125985317、1699146321318314094 | 完整 surface 接口、缩小处理（mip）/接缝 A/B、图集/球面投射/岸带手工 UV 混合缺 | 仍缺：完整表面层（地面网格/岩层按法线混合、像素线宽、缩小淡出、先扭再采样、田纹/砾石/坡草、调试模式）和链式 attachSurfacePattern 已在 three 标准材质上验证。没挂到 View 共享材质；手绘图集和球面投射没做 | src/terrain/surface-pattern.js | tests/surface-pattern.mjs |
| src/contrasttex.js | 1482346496460828674 | 只有标量诊断，没有 OKLab 彩色解、色域投影，没接实景 | 仍缺：OKLab 三角松弛已在共享 World 三角上补上，包括色域裁剪和 ΔE 统计。同类边 ΔE 13.7→0.1，对比边平均约 17，最低约 14。没接进 View，图集和 paint 没迁 | src/core/contrast-field.js、src/core/oklab.js | tests/contrast-texture.mjs、tests/color-lab.mjs |
| src/colorvolume.js | 1710031224838771027、1712088611934371876 | 八角点 OKLab、统计、色带、terrain、五特征缺 | 仍缺：八角点体积（三种插值空间）、拖角点、色带/色表/统计、五特征（最近一对 ΔE 8.8）、World 格分类已补。没接进 View 着色，没有拖点 UI | src/core/color-volume.js、src/core/oklab.js | tests/color-volume-corners.mjs、tests/color-lab.mjs |
| src/floatprobe.js | 1664565063552847873 | 平流质量/CPU 误差、跨平台矩阵、GPU 流体缺 | 仍缺：CPU 模拟 f16/f32/u8 存储的平流误差和质量漂移，以及 nearest/linear 对照已补。GPU 平流没实测（无浏览器），跨平台矩阵和流体接入缺 | src/core/float-advect.js | tests/float-advect.mjs |
| src/mountainlight.js | 1786014232594485497 | 白斑沟槽、buildMountain/normalAt/render/compare 缺；atlas/球面/性能缺 | 仍缺：在共享 World 高度场上补了无/烘焙/实时三档和相关统计（r≈0.09/0.90/0.93）。山体图集、球面混合、View 接入、低端设备性能都缺 | src/core/mountain-bake.js | tests/mountain-light.mjs、tests/mountain-bake.mjs |
| src/paintnormal.js | 1481661852887265288 | paintNormal/shadeWithNormals/audit 和表面接入缺 | 仍缺：大块笔触法线、网格法线切线空间扰动（不动顶点）、World 顶面着色已补。没接进 View 着色，没并进光体积纹理组 | src/core/paint-normal.js | tests/paint-normal.mjs |

本组相关的既有测试重跑全部通过：penumbra、lightvolume-directional/distance/point、voxel-distance、shrub-texture、uv-charts、sediment、texel-skip、shore-loops、mountain-bake、color-lab。另外确认 view.js 在 node 里能正常 import。
