# REACode 170 个模块在 REACodeRefactoring 里的重构状态（2026-11-10，第 55 批后）

来源 learn/coverage.json。相似度 = 去注释后原版与最接近目标 js 的 difflib 比值（第 50 轮测得，≥0.9 ≈ 照搬）。第 55 批起浏览器验收用 VM 内 headless Chromium（SwiftShader WebGL，tools/shot.py），截图在 artifacts/coverage/shots-r55/。

## A. 已重构并验证（123）

| REACode 模块 | 重构版落点 | 相似度 | 说明 / 缺口 |
|---|---|---|---|
| `engine/blotch.js` | `src/terrain/blotch-atlas.js`<br>`src/world/view-shading.js` | 0.013 | （第 55 批，浏览器验收）斑块图集 + World 边缘场 + 受控渗漏接进 View 主材质；浏览器对照已看。 |
| `engine/bnbrush.js` | `src/core/brush-atlas.js`<br>`src/world/view-shading.js` | 0.015 | （第 55 批，浏览器验收）划痕图集阈值化、沿口淡出接进 View；浏览器对照已看。 |
| `engine/bncanopy.js` | `src/core/canopy.js`<br>`src/life/vegetation.js`<br>`src/life/impostor.js` | 0.036 | 155帧复核，闭合球并集surface nets、三角形接缝松弛及真实树冠/烘焙输入通过；低分辨率歧义明确拒绝，原作MC/参数、美术及全局自交证明未复现。 |
| `engine/cage.js` | `src/terrain/shape.js`<br>`src/core/deformation-guard.js`<br>`src/world/worldmesh.js`<br>`overhang.html`<br>`src/terrain/terrainmesh.js`<br>`cage.html` | 0.021 | 保留既有XZ层级Taubin/笼形变形与面积/边长/扇形回退；新增分数层连续笼角点采样、沉积线复用及硬边输入。原完整cage拟合、扭曲壁面内部/跨切面3D相交与精确碰撞仍缺。 |
| `engine/contour.js` | `src/core/contour.js`<br>`src/world/contour-overlay.js`<br>`src/world/view.js`<br>`contour.html` | 0.038 | 共享角点、跨边缓存交点、闭环/开放/分叉诊断及真实World覆盖层已补；语义平面诊断不等于形变后的泡沫岸线。 |
| `engine/flags.js` | `src/core/banner.js`<br>`src/life/banner.js`<br>`src/badnorth/battle.js`<br>`src/life/decor.js`<br>`banners.html` | 0.052 | 保留已有风粒子/Bezier与暂停修复；54帧新核验后补六种透明旗尾/本地徽记并接入真实Battle，双网格暂停、共享风/曲线/资源释放及GPU alpha通过。原作完整徽记、精确画稿、跨帧率/布料碰撞仍待补；彩旗绳归因单列纠正，非屋顶旗证据。 |
| `engine/fog.js` | `src/core/fog-envelope.js`<br>`src/life/atmosphere.js` | 0.028 | （第 53 批）贴水雾片随风、遇体素切向绕开、深度遮挡、出圈回卷；未 GPU 验收。 |
| `engine/impostor.js` | `src/life/impostor.js`<br>`src/world/view-post-extras.js` | 0.039 | （第 55 批，浏览器验收）3 行×8 方位多俯仰烘焙 + 球面卡片 + 原 makeBlobCloud 云材质；?fx=impostorpitch。 |
| `engine/lightvol.js` | `src/core/voxel-ray.js`<br>`src/light/lightvolume.js`<br>`src/world/view.js`<br>`lightvolume.html` | 0.035 | 保留点光/太阳DDA与六向RGB；新增可选中心EDT距离场保守步进、DDA兜底、六向距离AO及梯度诊断，两网格与DDA渲染属性对照通过。体素中心距离不是形变表面SDF；笔触法线、命中UV/mega反馈、全方向传播和实时增量仍缺。 |
| `engine/los.js` | `src/core/nav-visibility.js`<br>`src/world/visibility.js`<br>`src/world/view.js`<br>`visibility.html` | 0.055 | 分层导航门户的角度采样查询及World诊断已补；导航规则不等于光学遮挡，未接管战斗AI或箭矢精确碰撞。 |
| `engine/ornament.js` | `src/core/ornament-field.js`<br>`src/ui/ornament.js`<br>`ornament.html`<br>`textures.html`<br>`src/core/ui-reveal.js` | 0.04 | 单张128²距离场、镜像UV、边区/中心独立阈值和uniform展开通过三尺寸GPU验收；保留旧演示。原作画稿/分层时序、九宫格不变形未复现，样例界面非游戏编辑器接入。 续审UI flair100帧，新增标题先显/先退、外纹后显/后退两轨本地时序及透明文字inert；单图集不变。没有原中心徽章/逐部件时序、白亮到金色材质或原画稿，局部通过不代表完整效果。 |
| `engine/reflection.js` | `src/water/reflection.js`<br>`src/world/view.js`<br>`reflection.html` | 0.036 | 纠正原静态映射误指岸浪文件。保留实际WorldMesh翻转/颜色反射，补裁掉水面上方残影、受限深度淡出/线性中点及参数验收；不等于原作完整色块/遮挡算法，原版createFlatReflection等名API未保留。 |
| `engine/rivers.js` | `src/terrain/generate.js`<br>`terrain-r55.html`<br>`planet-rivers-r55.html` | 0.179 | （第 55 批，浏览器验收）relaxRiverSlopes BFS 缓坡坍缩 + 湖洞联合重建（全入海、无环、不逆流），球面 World 同管线。 |
| `engine/shorefield.js` | `src/water/shore.js`<br>`src/core/shore-profile.js` | 0.108 | 已有chamfer栅格迁移到共享水层，本轮补起点阈值/硬步长上限和4M栅格预算；不是精确欧氏场，也未保留独立buildShoreDistance导出。 |
| `engine/snapshot.js` | `src/world/island-snapshot.js`<br>`snapshot.html`<br>`src/campaign/campaign.js` | 0.164 | 350帧复核；双网格真实World 64²捕获、异常状态恢复、跨上下文显式上传及GPU alpha阈值通过。原作通道编码/内轮廓未知；战役图标仍程序近似，全量真实快照缓存与游戏接入待后续集成。 |
| `engine/snow.js` | `src/life/atmosphere.js`<br>`src/core/wind-flow.js` | 0.023 | （第 53 批）圆形软点、大小不一、World 支撑面接触 AO、远处淡出，接进 Atmosphere；未目视。 |
| `engine/sphere.js` | `src/sphere/sphere-stages.js`<br>`src/sphere/planet.js`<br>`planet.html` | 0.026 | （第 55 批，浏览器验收）阶段动画用真实迭代快照（?stages=1 / ?stageT=）。 |
| `engine/surface.js` | `src/terrain/surface-pattern.js`<br>`src/world/view-shading.js` | 0.019 | （第 55 批，浏览器验收）surface 层（格线/层理/砂砾）挂到 View 共享材质地形面；浏览器对照已看。 |
| `engine/surfaceshadow.js` | `src/light/surface-shadow.js`<br>`src/world/view-shading.js` | 0.048 | （第 55 批，浏览器验收）竖面窄带（0.28 倍）在 View 着色器生效，屋顶排除；浏览器对照已看。 |
| `engine/vertexlight.js` | `src/core/cube-height.js`<br>`src/light/cube-height.js`<br>`src/sphere/planet.js`<br>`planet.html` | 0.149 | 273帧复核，真实6面低分辨率高度CubeTexture、顶点单次查询及球面实验通过；本地高度暗化解释不等同原作光照/投射阴影，游戏共享World球面融合未接入。 |
| `engine/voxelshadow.js` | `src/light/bake.js`<br>`src/world/worldmesh.js`<br>`ao-stages.html` | 0.036 | （第 53 批）逐顶点体素太阳阴影进 bakeLighting（与 AO 同一占用场），分块烘焙按影长加边；未接 View 太阳 UI、未目视。 |
| `engine/watervol.js` | `src/water/watervol.js`<br>`src/water/land-distance.js`<br>`src/core/voxel-distance.js` | 0.059 | 保留已有平面叠层，补level1陆地/各向异性2D中心距离、版本缓存、空场无残影和8资源释放，pipeline补真实开关。仅本地浅水近似，不是一般SDF/完整反射；形变后mask与原作效果仍缺，原版createWaterVolume同名API未保留。 |
| `engine/waves.js` | `src/water/shore.js`<br>`src/core/wave-cycle.js`<br>`waves.html` | 0.128 | 保留进退方向/独立周期，新增闭环分段浪峰及宽度，可在实际View开关对照。局部谐波是本地美术近似；全局泡沫mask、窄湾交叠和原版同名API仍缺。 |
| `engine/worldmap.js` | `src/sphere/worldmap.js`<br>`src/sphere/worldmap-material.js`<br>`planet.html` | 0.021 | （第 55 批，浏览器验收）512×256 等距贴图四表面混合上星球，无经度接缝，与格子海陆一致 97%（?map=1）。 |
| `src/adjacency.js` | `src/core/adjacency.js`<br>`adjacency.html`<br>`wfc.html` | 0.106 | 几何抽边、边界候选与共享网格审核已补；平移/平行等长仅为候选，不保证完整面轮廓或实体无碰撞。实际建筑多格tile接入仍独立待做。 |
| `src/app.js` | `src/world/app.js`<br>`src/core/snapshot-replay.js`<br>`src/tools/objexport.js` | 0.33 | 本批288+167帧复核，保留共享编辑/撤销；新增回放取消/异常恢复、只读UI与60条截断修复，精确OBJ坐标/法线语法/属性校验，双网格实际下载和历史回归通过。未覆盖第三方DCC导入验收、实例植被/水/完整材质导出与逐动作动画/水花/音效/镜头轨迹录制。 |
| `src/archvoid.js` | `src/core/arch-profile.js`<br>`src/build/buildings.js` | 0.023 | （第 53 批）楔石 / 键石 / measureArch / 变形弦误差接进真实拱（开关默认关）；原水渠美术未复现。 |
| `src/ballistic.js` | `src/core/ballistic-table.js`<br>`src/badnorth/battle.js`<br>`ballistics.html` | 0.012 | （第 53 批）Cost/Valid 表达式分开编译 + 带阻力烘表 + 候选轨迹；Battle 默认仍用无阻力表。 |
| `src/barycentric.js` | `src/core/spatial.js` | 0.03 | （第 53 批）baryPrep3 任意 3D 平面重心（投影权重 + 离面距离，极瘦三角稳定），XZ 上与 baryPrep 一致；教学 gizmo 页未做。 |
| `src/blobrelax.js` | `src/core/canopy.js`<br>`src/life/vegetation.js`<br>`src/life/impostor.js` | 0.046 | 155帧复核，闭合球并集surface nets、三角形接缝松弛及真实树冠/烘焙输入通过；低分辨率歧义明确拒绝，原作MC/参数、美术及全局自交证明未复现。 |
| `src/blobshadow.js` | `src/life/unit-shadow-batch.js`<br>`src/badnorth/battle-g3.js` | 0.046 | （第 55 批，浏览器验收）5 射线拟合平面贴形变斜坡（shadowFit 默认关），12° 斜面误差 .006。 |
| `src/borderpath.js` | `src/campaign/frontier-overlay.js`<br>`campaign.html` | 0.023 | （第 55 批，浏览器验收）campaign.html ?fields=1 画多条前线与两侧场；ear-clip 长扇三角保真度问题未改。 |
| `src/bouncegi.js` | `src/light/surface-bounce.js`<br>`src/world/view-shading.js` | 0.028 | （第 55 批，浏览器验收）split 模型与蒙特卡洛参考相关 0.53→0.82–0.91、总量比≈1、系数=1；两跳 gather 纹理接进 View 间接光。 |
| `src/boxtest.js` | `src/core/obb.js`<br>`src/badnorth/landing-plan.js` | 0.014 | （第 53 批）穿透深度、俯视 2D、裁剪面积真值、航道避礁石陆地、换车道；无动态避让（原版同为静态）。 |
| `src/cheesenav.js` | `src/world/fine-portals.js`<br>`src/world/battle-navigation.js`<br>`navigation.html` | 0.027 | （第 55 批，浏览器验收）格内精细门户 + 形变侧壁（共享 fine-portals.js）接进 BattleNavigation（finePortals，默认关）与 navigation.html。 |
| `src/clouddeck.js` | `src/world/cloud-deck-layer.js`<br>`src/core/cloud-depth.js` | 0.039 | （第 55 批，浏览器验收）?fx=clouddeck 三圈高耸积云带视差 + 云影投到地形屋顶；水面不读云影。 |
| `src/colorvolume.js` | `src/core/color-volume.js`<br>`src/world/view-shading.js`<br>`src/ui/shading-panel.js` | 0.014 | （第 55 批，浏览器验收）每格五特征栅格 + GPU 八角点 OKLab 三线性插值接进 View（?shade=colorvolume，默认关），面板角点取色器实时改；浏览器开关对照已看。 |
| `src/contrasttex.js` | `src/core/contrast-field.js`<br>`src/world/view-shading.js` | 0.019 | （第 55 批，浏览器验收）World 三角扇 OKLab 松弛（ΔE 13.75→0.10）画进 512² 世界图，顶面取色 + 对比边细线接进 View；浏览器对照已看。 |
| `src/coroutine.js` | `src/core/coroutine.js`<br>`scheduler.html` | 0.204 | 嵌套递归、预算、取消和演示已补；合作式步骤不可抢占，取消仅同步finally清理。 |
| `src/depfill.js` | `src/core/depression-fill.js`<br>`src/terrain/drainage.js`<br>`src/terrain/terrainmesh.js`<br>`terrain-r55.html` | 0.03 | （第 55 批，浏览器验收）水位填洼写 World.lakes，terrainmesh 画湖面多边形；整数 stream-power + 崩塌侵蚀。湖面为平面河色，非独立水 shader。 |
| `src/dirsprites.js` | `src/core/sprite-ambiguity.js`<br>`src/life/unit-sprites.js`<br>`src/badnorth/battle.js`<br>`sprites.html` | 0.021 | 保留翻转指标、锚点/alpha修复及单方向模式；新增逐单位UV血斑和受击摆动。原作美术、完整兵种/攻击动画与精灵阴影待补齐，保留原3D模式。 |
| `src/doodlewall.js` | `src/core/doodle-layout.js`<br>`src/build/doodle-wall.js`<br>`src/world/doodle-overlay.js`<br>`doodle.html` | 0.729 | 墙饰生成器和World可选贴面已迁移：板号种子、逐板裁剪、墨线遮罩。完整室内走廊/弧顶/门口版式、纹样复杂度及贴面光照烘焙仍待补。 |
| `src/dual.js` | `src/life/flora-species.js`<br>`src/core/vertex-dual.js` | 0.059 | （第 55 批，浏览器验收）?fx=dualflora 地被落到顶点对偶点 + 崖壁竖面落点 dualWallSites。 |
| `src/edgeplant.js` | `src/life/vegetation.js`<br>`src/core/garden-paths.js`<br>`src/build/buildings.js`<br>`garden.html`<br>`src/core/edge-inset.js` | 0.016 | 保留崖沿/墙根植被，新增共享World院内连通路由；原版完整CPU统计/平面渲染接口、原作门洞规则/细石板/中心装饰未完整迁移。草丛contrast texture+背景射线原法仍未实现，不能由静态邻崖启发式替代。 本批599帧复核确认原作纯纹理灌木，已有球团近似保留；修复基于未形变格心的错误内收方向并对薄格限幅，双网格实例锚点通过。原片纹理灌木/微阴影仍未实现，锚点在格内不保证球团整个体积在内。 续作600帧多岛生成已学，未从效果臆测内部纹理生成算法，保留待实现。 |
| `src/edgesmooth.js` | `src/terrain/edge-square-relax.js`<br>`edge-smooth.html` | 0.018 | （第 55 批，浏览器验收）方格目标松弛 + 边类层级复现 regularity 大降（26.9→14.1），硬线不动。 |
| `src/flowdemo.js` | `src/world/view-post-extras.js`<br>`src/life/atmosphere.js` | 0.04 | （第 55 批，浏览器验收）?fx=softnormals 软法线写回 View 主网格（37296 软化/276 保硬边），关时逐值还原。 |
| `src/foliageblob.js` | `src/core/canopy.js`<br>`src/life/vegetation.js` | 0.03 | canopy kernel:metaball；植被默认仍用 union，未切换默认。 |
| `src/frontier.js` | `src/core/frontier-candidates.js` | 0.037 | （第 53 批）expandFrontier 增量坍缩边放置 + 前向检查 + 导航互连并查集；一步前向检查不等于全局可行。 |
| `src/fusion.js` | `src/world/scenes.js`<br>`src/build/multicell.js`<br>`src/build/buildings.js` | 0.014 | 共享World融合场景及显式双格模板已运行验收；完整预制轮廓socket/多格联合求解另列splice后续。 |
| `src/gridmodes.js` | `src/core/wfc.js`<br>`joint3d.html` | 0.032 | （第 55 批，浏览器验收）layerGrid + layeredJointCatalog：多层辐条联合插槽、重力规则、跨层塔模块。 |
| `src/gridpatch.js` | `src/core/radial-patch.js`<br>`gridpatch.html` | 0.045 | （第 55 批，浏览器验收）模板库（radial/block/rhombus/courtyard）+ 带洞边界 + fitTemplatePatch，全凸无折叠面积守恒。 |
| `src/gridwfc.js` | `src/core/wfc.js`<br>`wfc.html` | 0.046 | 保留已验收的任意多边形半边、确定性、迭代回溯、pins、预算与局部修复。本轮可选四分子格网格进入真实求解流程；四子格联合模块约束、3D预制tile/建筑和地形联合生成仍待补。 |
| `src/grouping.js` | `src/core/region-groups.js`<br>`src/core/campaign-graph.js`<br>`src/campaign/campaign.js`<br>`campaign.html` | 0.054 | 两段773帧、100种子4455份连通历史和12次真实页面回放通过。共享World混合/四边形适配及权重切边量化通过；本地整组合并+节点调整，不承诺原作精确权重/调度或旧函数签名；固定迭代/512节点限制，边境轮廓另列。 |
| `src/halfedge.js` | `src/core/halfedge.js`<br>`src/core/grid.js` | 0.028 | 显式半边 next/prev/twin、边界环、顶点扇、Euler、方格切三角迁入并实测；grid.js 内部仍用 edgeNeighbors/edgeTwins。 |
| `src/hiproof.js` | `src/core/straight-skeleton.js`<br>`src/core/hip-roof.js`<br>`src/build/buildings.js`<br>`building-kit-r55.html` | 0.032 | （第 55 批，浏览器验收）精确直骨架（含洞/凹屋顶谷线），多格块与带洞庭院全四坡。 |
| `src/holenav.js` | `src/world/fine-portals.js`<br>`src/world/battle-navigation.js`<br>`navigation.html` | 0.021 | （第 55 批，浏览器验收）同 fine-portals：身高超拱顶封门，绕无顶缺口。 |
| `src/housekit.js` | `src/core/house-kit.js`<br>`src/build/village.js`<br>`building-kit-r55.html` | 0.051 | （第 55 批，浏览器验收）8 档坡度池 + 程序化分层茅草 + scatterVillage 撒村写 World。 |
| `src/infograph.js` | `src/badnorth/info-graph.js`<br>`src/badnorth/battle.js` | 0.01 | （第 53 批）动态节点图（距离 / 同层 / 视线，每跳 ×0.55、≤2 跳），真实 Battle 中按同伴转告追击。 |
| `src/islandpasses.js` | `src/core/terrace-edges.js`<br>`src/world/terrace-edges.js` | 0.021 | （第 55 批，浏览器验收）finalSegments 与网格同一采样，台地边线与最终倒角零误差（3 模式×软坡×两网格）。 |
| `src/levelflora.js` | `src/life/flora-species.js`<br>`src/core/level-flora.js` | 0.019 | （第 55 批，浏览器验收）六种物种程序化几何，?fx=levelflora 每级台地形状可辨（无原素材）。 |
| `src/lighting.js` | `src/light/voxel-field.js`<br>`src/light/bake.js`<br>`src/world/view-shading.js` | 0.066 | （第 55 批，浏览器验收）分层场浮点纹理在 GPU 顶点着色器采样（已在 WebGL2 跑）+ 体素软法线写回主网格；与 G2 softnormals 勿同开。 |
| `src/march.js` | `src/core/contour.js`<br>`contour.html`<br>`grids.html` | 0 | 不规则网格 marching squares 完整迁移并实测（跨格端点重合 / 无蝴蝶结 / 鞍点决断 / 多层级）；岸线绘制仍是另一套。 |
| `src/megatex.js` | `src/light/texel-owner.js`<br>`src/core/atlas.js` | 0.016 | owner 表反查 + 垫边防串色接共享 Atlas；未接 impostor 烘焙器 / SDF·AO 卷。 |
| `src/mesh.js` | `src/world/worldmesh.js`<br>`src/core/meshwriter.js`<br>`src/tools/mesh-audit.js`<br>`save-mesh.html` | 0.031 | 349帧复核并保留既有分块缓存后合并主体；双网格编辑前后主体GPU提交均1次。并非全场景单call，不覆盖原作Switch性能/动态合批算法。 |
| `src/mipcustom.js` | `src/light/mip-chain.js`<br>`textures.html` | 0 | 四档自定义 mip + 线性空间 + 三线性 / 各向异性采样迁入共享模块并实测；未接 impostor 图集与 textures 页。 |
| `src/mipfilter.js` | `src/light/mip-chain.js`<br>`textures.html` | 0 | 同 mipcustom（两份实验合成 mip-chain.js）；原 renderGround/paint 可视化未迁。 |
| `src/mirrordecor.js` | `src/core/mirror-uv.js`<br>`src/core/ornament-field.js`<br>`src/ui/ornament.js`<br>`mirror.html`<br>`ornament.html` | 0.024 | 单纹理D4八方向、中心折叠和uniform尺寸控制已实测；保留原距离场/独立cutoff动画。原作细线纹样/精确任意尺寸布局、makeMotif/paintRect/seamError CPU参考接口仍未逐一兼容。 |
| `src/mountainlight.js` | `src/core/mountain-bake.js`<br>`src/world/view-shading.js` | 0.03 | （第 55 批，浏览器验收）山体烘焙图集接进 View 岩壁，运行时 0 次法线采样；「球面混合」核实原模块没有（已过时）；真 GPU 性能未测。 |
| `src/navgraph.js` | `src/world/save.js`<br>`river-nav.html` | 0.038 | （第 55 批，浏览器验收）riverFlow 写进存档可选尾段，旧码逐字节兼容，读档 91 段一致。 |
| `src/navribbon.js` | `src/core/path-samples.js`<br>`src/world/battle-navigation.js`<br>`src/badnorth/battle.js` | 0.036 | （第 53 批）命令路径 Catmull-Rom（不出可站区）、弧长等距、贴地含楼梯、净距带状格；尘粒 AO 是另一片。 |
| `src/overhangterrain.js` | `src/terrain/soft-tops.js`<br>`src/terrain/terrain-collide.js`<br>`src/terrain/terrainmesh.js` | 0.04 | （第 55 批，浏览器验收）terrainmesh 层连续软坡（world.softTops，无裂缝）+ 形变侧壁碰撞 pushOut/heightAt；Battle 单位尚未调用。 |
| `src/paintnormal.js` | `src/core/paint-normal.js`<br>`src/world/view-shading.js` | 0.043 | （第 55 批，浏览器验收）大笔触法线图主轴投影、切线空间扰动接进 View；浏览器对照已看。 |
| `src/palette.js` | `src/core/palette.js`<br>`src/world/app.js`<br>`wall-palette.html`<br>`src/core/qa-replay.js`<br>`qa-replay.html` | 0.075 | 保留已有墙色预设/固定屋顶成果；本轮524帧后补独立色槽更新、真实World重建和还原。原PNG热更新、多行贴图、最短色相跨调色板渐变/QA及完整原接口仍待补。172732仅可作配色外观参考，实际主题是拖抹，已移至smear映射。 本批200帧复核后补本地最短色相HSL滑杆、无彩色端点处理；不从画面推导原公式/过渡时长，PNG、QA和持久化仍待补。 本批814帧纠正QA误归：视频为复杂建筑编辑，不证明随机模块色；新增16步编辑/检查/异常恢复为本地回放，完整原作QA和PNG仍未覆盖。 |
| `src/patchblend.js` | `src/terrain/patch-blend.js`<br>`src/world/view-shading.js` | 0.018 | （第 55 批，浏览器验收）岸带手工 UV + 高度混合接进 View；贴图为程序化替身，只画陆侧（水侧是海面材质）。 |
| `src/patchcluster.js` | `src/core/infinite.js` | 0.015 | （第 53 批）createInfiniteStream 按需流式（3/7 块簇均实跑，无缝）+ quadDual；原 consensus 对照未迁。 |
| `src/penumbra.js` | `src/world/penumbra-terrain.js`<br>`src/light/penumbra.js` | 0.056 | （第 55 批，浏览器验收）?fx=penumbra3d 地形与悬挑接收面体素半影；开启时非 World 物体（树）不再投 PCF 影。 |
| `src/piercefloor.js` | `src/core/arch-floor-budget.js`<br>`src/build/buildings.js`<br>`src/world/navgraph.js` | 0.01 | （第 55 批，浏览器验收）过梁几何 + 拱下精确净空 + buildNav underArches；Battle 运行时尚未接。 |
| `src/portrait.js` | `src/ui/slot-portrait.js`<br>`ui.html` | 0.008 | （第 55 批，浏览器验收）ui.html ?portrait=slots 按 PORTRAIT_SLOTS 画程序化头像，IoU 0.994（无原素材）。 |
| `src/propanim.js` | `src/world/prop-anim-layer.js`<br>`src/core/prop-anim.js`<br>`src/world/app.js` | 0.037 | （第 55 批，浏览器验收）合并道具网格逐顶点 slot 属性 + shader 弹簧，只上传变化槽位；?propanim=1。 |
| `src/propframe.js` | `src/core/opening-footprint.js`<br>`src/build/buildings.js` | 0.013 | （第 53 批）贪心刚性框道具接进 World 后院（yardProps 开关），零重叠；道具是简单盒子。 |
| `src/quadinf.js` | `src/core/infinite.js`<br>`grids.html` | 0.01 | buildInfinite 支持 origin 任意块中心开窗口、windowSeam 实测重叠区 raw/patch/blend 逐位一致；页面里未加平移窗口的交互。 |
| `src/rayvis.js` | `src/core/space-visibility.js`<br>`src/core/vertex-openness.js`<br>`src/world/space-visibility.js` | 0.086 | （第 53 批）逐格穿行射线（薄墙不漏）+ 整楼明暗烘焙 + 灰点叠加层；（56 批）逐顶点烘 + c04 灰度材质；（57 批）三角网格光学 LOS + indoorAt 谓词 + 能力库 world.openness 层。 |
| `src/rectpack.js` | `src/core/atlas.js` | 0.013 | （第 53 批）recursiveFill / 90° 旋转 / shelfPack 基线 / 手指数两口径；非最优、不自动压缩同原作。 |
| `src/save.js` | `src/world/save.js`<br>`src/world/app.js`<br>`save-mesh.html` | 0.153 | 321帧复核后修复坏输入原子拒绝、游程越界/尾随垃圾与空列元数据，北境场景身份可往返；兼容旧v5合法串。原作位格式、跨平台拓扑身份、自定义配色及天气/玩法状态仍未覆盖。 |
| `src/savestring.js` | `src/world/save.js`<br>`src/world/app.js`<br>`save-mesh.html` | 0.049 | 321帧复核后修复坏输入原子拒绝、游程越界/尾随垃圾与空列元数据，北境场景身份可往返；兼容旧v5合法串。原作位格式、跨平台拓扑身份、自定义配色及天气/玩法状态仍未覆盖。 |
| `src/shore.js` | `src/water/shore.js`<br>`src/core/shore-profile.js`<br>`src/core/shore-loops.js`<br>`shoreloops.html` | 0.646 | 已有真实边界/形变法线保留，新增规范绕序、角接分岛/水洞自接闭环分解，1024组合及共享World桥接验收通过。窄湾外推浪带交叠、精确拱底截面/泡沫mask仍缺。 |
| `src/shrubcard.js` | `src/life/vegetation.js`<br>`src/world/view-post-extras.js` | 0.017 | （第 55 批，浏览器验收）?fx=wallcards 墙根 574 张折卡已目视。 |
| `src/slotsolve.js` | `slots.html`<br>`src/core/wfc.js` | 0.021 | （第 55 批，浏览器验收）槽位表 + 27 变体缩略池 + 按 trace 逐帧播放、依赖链与冲突示例。 |
| `src/smear.js` | `src/world/view-post-extras.js`<br>`src/core/camera-motion.js` | 0.015 | （第 55 批，浏览器验收）?fx=smear 解析切向拖影接进渲染循环，与历史叠加并存；转动时外圈 p95 梯度 17.2→9.7，静止不变。 |
| `src/smokefx.js` | `src/core/smoke-order.js`<br>`src/life/effects.js` | 0.079 | （第 53 批）火焰卡片噪声 / UV 滚动 / mip 随龄 / cutoff 亮边 + 随火量 PointLight；透明穿插近似。 |
| `src/snapshot64.js` | `src/world/island-snapshot.js` | 0.021 | （第 53 批）World 剪影真值 64² 存储、crisp 着色器 CPU 孪生、IoU/edgeEnergy/peakGradient/bandPixels/rmse 对照、GPU 读回接口。 |
| `src/socketrock.js` | `src/core/wfc.js`<br>`wfc.html` | 0.045 | diagnoseTiles：多边形网格 AC 传播找死 tile 与无人接的接口；页面未显示诊断结果。 |
| `src/spherefusion.js` | `src/sphere/planet-town.js`<br>`planet.html` | 0.021 | （第 55 批，浏览器验收）planet.html ?fusion=1 星球作为共享 World 显示，页面验收零错误。 |
| `src/spherehouse.js` | `src/sphere/planet-town.js`<br>`planet.html` | 0.011 | （第 55 批，浏览器验收）1–3 层房子按各层松弛角点变形（?floors=mixed），程序化模块。 |
| `src/splice.js` | `src/build/splice.js`<br>`src/core/world.js`<br>`src/world/save.js`<br>`src/world/app.js` | 0.032 | （第 55 批，浏览器验收）嵌入的房子进存档尾段、快照撤销、编辑器工具（?tool=splice / I 键）。 |
| `src/squadbanner.js` | `src/badnorth/squad-standard.js`<br>`src/badnorth/battle-g3.js` | 0.028 | （第 55 批，浏览器验收）竖旗横杆金球、金边燕尾旗、金饰盾纹替换 Battle 旗（standards 默认关），程序化。 |
| `src/squarehex.js` | `src/core/corner-footprint.js` | 0.071 | （第 53 批）cornerCutPlan 二分着色切角 + footprintMetrics（与原 runMetrics 一致）+ islandFootprints；只读未接 WorldMesh。 |
| `src/squigglefield.js` | `src/core/ornament-field.js`<br>`src/ui/ornament.js`<br>`ornament.html` | 0.02 | （第 55 批，浏览器验收）ornament.html 换用卷草场：四折镜像、扭动动画、扫光（?squiggle=1）。 |
| `src/storydatum.js` | `src/core/story-datum.js` | 0.05 | （第 53 批）共享 World 整数层下楼层线偏差 0；非整数塔基 datum 规则与 measureFacade/windowRows 已迁并测。 |
| `src/surfacedeco.js` | `src/core/surface-decoration.js`<br>`src/build/buildings.js` | 0.028 | （第 55 批，浏览器验收）门墙段并入长立面、立面绕拐角、archCutout 真挖拱洞。 |
| `src/surfaceshadow.js` | `src/light/surface-shadow.js`<br>`src/world/view-shading.js` | 0.049 | （第 55 批，浏览器验收）墙接收窄条、洞内地面射线阴影、贴形变顶面接进 View；洞内只有浏览器度量（205 纹素中 152 被挡）无清晰截图。 |
| `src/terracecliff.js` | `src/core/terrace-profile.js`<br>`src/terrain/soft-tops.js` | 0.04 | （第 55 批，浏览器验收）softTops 提供连续场；meshSlopeProfile 在真实网格上量平/软/陡。 |
| `src/terraceladder.js` | `src/world/battle-navigation.js`<br>`src/badnorth/battle-g3.js` | 0.035 | （第 55 批，浏览器验收）寻路避薄平台 + 按横档的攀爬动画。 |
| `src/texelsnap.js` | `src/core/texel-skip.js`<br>`textures.html`<br>`src/core/leaf-atlas.js`<br>`src/life/leaf-surface.js`<br>`src/life/vegetation.js`<br>`leaf-surface.html` | 0.019 | 新增128²/32²植物保留区、连续texel采样及实际球冠/灌木接入；完整bakeAtlas/audit/植物素材、全场景一张atlas及一般mipmap仍待迁移。对象球面经度导数绕缝、区域边界半texel夹紧和远处均值淡出仅本地近似。 |
| `src/tileforce.js` | `src/core/module-patch.js`<br>`src/core/wfc.js`<br>`prefab.html` | 0.05 | （第 55 批，浏览器验收）spliceModulePatch 缝进已有网格（Euler=1）+ 两层 3D prefab 带 W/D/R/S socket。 |
| `src/tileplace.js` | `src/core/wfc.js`<br>`src/build/tile-assembly.js`<br>`assembly.html` | 0.008 | （第 55 批，浏览器验收）加权香农熵（默认关时逐字节一致）+ View 播放的拼装动画。 |
| `src/tilerepair.js` | `src/core/wfc.js`<br>`wfc.html` | 0.024 | 独立socket局部修复已补；范围外不变、原值优先、扩区/预算/失败回滚。完整建筑多格tile与增量传播性能另列后续。 |
| `src/topoline.js` | `src/core/grid.js`<br>`grids.html` | 0.016 | 保留确定性对边遍历，新增有向格/出边判环、停止原因、真实中点段与坏twin拒绝；1254走法及实际Canvas通过。原随机转侧边不据视频照搬；手柄/连刷、完整高度绘制与飞岛支撑规则仍待接入。 |
| `src/townmesh.js` | `src/build/buildings.js`<br>`src/core/courtyards.js`<br>`src/world/worldmesh.js`<br>`garden.html` | 0.03 | 本批202帧庭院复核，保留共享建筑/小径，新增按真实第2层墙体识别围合；桥下开口/地面开口/重封闭双网格通过。原作矮墙分区、精细门拱/形变边界、完整建筑模块与植物视觉不计完成。 本批333帧确认早期grass plots有高层台地分区，原帖树是未来计划；现有地面庭院不能替代完整高层地块/石边带，列后续。 |
| `src/traffic.js` | `src/world/battle-navigation.js`<br>`src/world/layerednav.js` | 0.028 | （第 53 批）L 弯 / T 岔 / 直廊对穿压测全到无死锁，体型重路由；分离仍软约束。 |
| `src/triGraph.js` | `src/core/trigraph.js`<br>`trigraph.html` | 0.018 | locate / edgeMap / clone / flip / legalize 迁入并实测；浮点谓词无精确算术。 |
| `src/triflowfield.js` | `src/world/navmesh-flow.js`<br>`navmesh-flow.html` | 0.082 | 面级流场 + 通口 + 漏斗 + 视线捷径接到共享导航面；未接 battle.js，未做方格流场对照页。 |
| `src/uidecor.js` | `src/ui/icon-ink.js`<br>`src/ui/icon-toolbar.js`<br>`ui.html` | 0.295 | 等墨量线宽接进共享工具栏；徽记只做折数闭合检查，未画徽记图形。 |
| `src/uikit.js` | `src/badnorth/battle-g3.js`<br>`src/core/playful-layout.js` | 0.053 | （第 55 批，浏览器验收）俏皮指令条 + 每队单 Move 目标 + 地面标记，hold/retreat 真改小队目标（commands 默认关）。 |
| `src/unitbatch.js` | `src/badnorth/unit-batch-lod.js`<br>`src/badnorth/battle.js` | 0.014 | （第 53 批）原缺口过时（早已实例化）；补视锥剔除 + 小于 9px 简化显示（有渲染器时默认开）。 |
| `src/unitsnap.js` | `src/world/battle-navigation.js`<br>`src/core/unit-ground-height.js`<br>`src/badnorth/battle.js` | 0.026 | （第 53 批）楼梯踏面脚高接进每帧缓动 + 逐人悬空 / 埋入统计（停下均为 0）。 |
| `src/voxelao.js` | `src/light/bake.js`<br>`src/light/voxel-ao.js`<br>`src/world/worldmesh.js`<br>`ao-stages.html` | 0.027 | （第 53 批）flat/up/vertex/directional 四档 aoMode（六向遮蔽）；SSAO 原作已弃，不迁。 |
| `src/voxelflow.js` | `src/world/view-post-extras.js`<br>`src/core/wind-flow.js` | 0.036 | （第 55 批，浏览器验收）软法线对主网格调用；meshCollider 读实时形变网格（groundAt）。 |
| `src/voxelnav.js` | `src/world/fine-portals.js`<br>`src/world/layerednav.js`<br>`src/world/battle-navigation.js` | 0.033 | （第 55 批，浏览器验收）同 fine-portals：portal.width 让体型分档避开窄门。 |
| `src/wake.js` | `src/core/wake-sampling.js`<br>`src/life/boats.js` | 0.016 | （第 53 批）Wake/Ship 粒子：舷侧泡沫、淡雾、船头水花、Kelvin 角 19.39°，接进 Boats。 |
| `src/walkreach.js` | `src/terrain/walk-reach.js` | 0.039 | 共享 World 可走分量 + 沿路线补台阶 / 削台；加高可能切断低侧格与更低邻格的连接，个别图全岛可达比例下降；未接生成器默认流程。 |
| `src/wind.js` | `src/world/view-post-extras.js`<br>`src/life/atmosphere.js` | 0.046 | （第 55 批，浏览器验收）?fx=windflag 旗子 shader 采风场纹理，随风向转弯垂抖；小瑕疵：法线未随转。 |
| `src/wobbletex.js` | `src/core/sediment.js`<br>`src/terrain/terrainmesh.js`<br>`src/world/view.js`<br>`sediment.html` | 0.013 | 新增可精确逆Y剪切/世界坐标层理、岩壁专用mask及实际GPU验收，保留旧窄条。原作坐标场/完整纹样未知，通用3D逆场、原CPU曲率/面积漂移/缝差指标接口未逐一迁移，反射/阴影/轮廓仍旧几何近似。 |

## B. 已重构、仍有缺口（6）

| REACode 模块 | 重构版落点 | 相似度 | 说明 / 缺口 |
|---|---|---|---|
| `engine/outline.js` | `src/world/outline-pass.js`<br>`src/world/view-post-extras.js` | 0.071 | （第 55 批）屏幕空间描边接进渲染循环（?fx=outline），零报错、修掉云卡/水面假墨线；缺原片程序化笔触法线图 / 反差贴图作线源。 |
| `engine/spritepack.js` | `src/core/uv-charts.js`<br>`src/core/uv-bake.js`<br>`uv-bake.html` | 0.021 | （第 55 批）填充率 0.158→0.31/0.48、零重叠，bakeChartPage 进共享 Atlas 并贴回；仍 <0.5（需墙带展开/图块合并），未接主场景 View。 |
| `src/combatfx.js` | `src/core/melee-sweep.js`<br>`src/badnorth/battle-g3.js`<br>`src/badnorth/battle.js` | 0.034 | （第 55 批）旋转扫掠、刃碰墙遮挡、盾推力接进 Battle（meleeFx 默认关）；缺原作动作美术（只有程序化刃）。 |
| `src/floatprobe.js` | `src/world/float-advect-gpu.js`<br>`float.html` | 0.211 | （第 55 批）WebGL2 实测 32F/16F/8 位 ping-pong 平流与 CPU 仿真一致（16F 差 1.9e-6）；只有 SwiftShader 一个 GPU，跨平台矩阵测不了。 |
| `src/flowfield.js` | `src/world/navmesh-flow.js`<br>`src/world/battle-navigation.js` | 0.062 | （第 55 批）guardedFlowAt 解决鞍点（24/24 到达）；Battle 实测 quad 网格更慢，连续转向仍默认关。 |
| `src/spheretown.js` | `src/sphere/planet.js`<br>`planet.html` | 0.019 | （第 55 批）solver:shape 让共享角点分歧 0.095→0.007、墙最大倾斜 45°→28°；宽高原蘑菇化有几何下界，原模块目标形状无出处。 |

## C. 只按职责合并、未验证（41）

| REACode 模块 | 重构版落点 | 相似度 | 说明 / 缺口 |
|---|---|---|---|
| `engine/backlit.js` | `src/world/outline.js` | 0.048 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/birds.js` | `src/life/birds.js` | 0.073 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/butterflies.js` | `src/life/decor.js` | 0.054 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/islands.js` | `src/badnorth/island.js`, `src/terrain/bn-island-field.js` | 0.036 | 第 215 批：方格高度场管线逐式迁到 bn-island-field.js，h/mat/slope/walkable/findPath/几何与裁判逐位对拍（tests/bn-island-referee.mjs 5/5）；badnorth/island.js 保留为共享 World 近似。 |
| `engine/mesa.js` | `src/terrain/generate.js` | 0.286 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/meshcheck.js` | `grids.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/noise.js` | `src/core/noise.js` | 0.825 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/normalsmooth.js` | `src/terrain/shape.js` | 0.042 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/props.js` | `src/build/buildings.js` | 0.011 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/relax.js` | `src/sphere/planet.js` | 0.019 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/roofs.js` | `src/build/buildings.js` | 0.013 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/splash.js` | `src/life/effects.js` | 0.033 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/terrain.js` | `src/terrain/generate.js` | 0.149 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `engine/waterfall.js` | `src/water/waterfall.js` | 0.051 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/birds.js` | `src/life/birds.js` | 0.999 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/campaignmap.js` | `src/campaign/campaign.js`<br>`src/core/campaign-graph.js`<br>`campaign.html` | 0.034 | 本次目录重扫补录同职责文件。原版scatter/cull/walk/branches/extras在重构战役页/共享图管线有对应，图连通修复已有旧运行证据；保留原版kNN与重构Delaunay+近邻的算法差异，未逐个导出兼容、不声称917405214638006273已全帧。 |
| `src/cavepath.js` | `src/world/battle-navigation.js`<br>`src/world/layerednav.js`<br>`navigation.html` | 0.024 | 分层导航路线天然带层号，测试确认穿洞 / 翻越分层；未做弧长重采样与法向偏移的可视化。 |
| `src/colorgamut.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/contrast.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/demo.js` | `src/world/townDemo.js` | 0.966 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/dfgrow.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/grasscards.js` | `src/life/vegetation.js`<br>`src/life/leaf-surface.js`<br>`leaf-surface.html` | 0.026 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 本轮611帧复核仅补近景球冠/灌木纹理alpha；远景impostor/草卡片未接同一叶纹，原有实现保留，不升级为整模块运行通过。 |
| `src/grid.js` | `src/core/grid.js` | 0.031 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/learnpanel.js` | `src/ui/learnpanel.js` | 0.745 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/lightingcache.js` | `src/world/worldmesh.js` | 0.036 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/looptown.js` | `src/build/buildings.js` | 0.019 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/mandala.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/mixedwfc.js` | `src/core/wfc.js`<br>`src/core/grid.js`<br>`wfc.html` | 0.032 | 真实三角 / 四边形混合格直接求解；未做「方格 = 4 三角捆绑」的表示与 MODULES 对照。 |
| `src/navgrid.js` | `src/world/navgraph.js` | 0.104 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/partsprites.js` | `ui.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/piperepair.js` | `src/core/infinite.js` | 0.011 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/quadgrid.js` | `src/core/grid.js`<br>`grids.html` | 0.36 | 1068帧已复核；三角合并/共享边中点/细分与松弛主体保留，已有重构不重做。本批未新增完整生成动画、6度顶点启发式或无限拼接运行验收；signedArea/isConvex辅助导出和质量接口待核。 |
| `src/quadtex.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/reflstreak.js` | `src/world/view.js` | 0.011 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/repeatbreak.js` | `textures.html` | 0 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/scene.js` | `src/world/view.js` | 0.247 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/terrainmesh.js` | `src/terrain/terrainmesh.js` | 0.017 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/town.js` | `src/core/world.js` | 0.17 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/trace.js` | `src/world/app.js` | 0.01 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/triflow.js` | `src/badnorth/flowfield.js` | 0.025 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
| `src/triisland.js` | `src/terrain/generate.js` | 0.037 | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |
