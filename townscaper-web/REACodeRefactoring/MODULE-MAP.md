# 原版模块 → 重构模块映射

原版 src + engine 的全部 JS；vendor、页面内联脚本与工具另列后续范围。 映射按职责人工分组，代码引用作辅助；已合并/迁移是静态确认，不等于完整行为验收。

{'已迁移/增强（本轮验证）': 123, '已合并/迁移（静态确认）': 41, '部分覆盖': 6}

| 原版模块 | 重构落点 | 状态 | 缺口 / 说明 | 对应视频 |
|---|---|---|---|---|
| `src/adjacency.js` | `src/core/adjacency.js`, `adjacency.html`, `wfc.html` | 已迁移/增强（本轮验证） | 几何抽边、边界候选与共享网格审核已补；平移/平行等长仅为候选，不保证完整面轮廓或实体无碰撞。实际建筑多格tile接入仍独立待做。 | 795010582239997952 |
| `src/app.js` | `src/world/app.js`, `src/core/snapshot-replay.js`, `src/tools/objexport.js` | 已迁移/增强（本轮验证） | 本批288+167帧复核，保留共享编辑/撤销；新增回放取消/异常恢复、只读UI与60条截断修复，精确OBJ坐标/法线语法/属性校验，双网格实际下载和历史回归通过。未覆盖第三方DCC导入验收、实例植被/水/完整材质导出与逐动作动画/水花/音效/镜头轨迹录制。 | 1430224300003545091, 1260586697538113537 |
| `src/archvoid.js` | `src/core/arch-profile.js`, `src/build/buildings.js` | 已迁移/增强（本轮验证） | （第 53 批）楔石 / 键石 / measureArch / 变形弦误差接进真实拱（开关默认关）；原水渠美术未复现。 | 806904557502464000, 802496920790777856 |
| `src/ballistic.js` | `src/core/ballistic-table.js`, `src/badnorth/battle.js`, `ballistics.html` | 已迁移/增强（本轮验证） | （第 53 批）Cost/Valid 表达式分开编译 + 带阻力烘表 + 候选轨迹；Battle 默认仍用无阻力表。 | 987267068495003648 |
| `src/barycentric.js` | `src/core/spatial.js` | 已迁移/增强（本轮验证） | （第 53 批）baryPrep3 任意 3D 平面重心（投影权重 + 离面距离，极瘦三角稳定），XZ 上与 baryPrep 一致；教学 gizmo 页未做。 | 974579499802202113, 974564862729838592 |
| `src/birds.js` | `src/life/birds.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1244892370392489989, 1215644531221311488 |
| `src/blobrelax.js` | `src/core/canopy.js`, `src/life/vegetation.js`, `src/life/impostor.js` | 已迁移/增强（本轮验证） | 155帧复核，闭合球并集surface nets、三角形接缝松弛及真实树冠/烘焙输入通过；低分辨率歧义明确拒绝，原作MC/参数、美术及全局自交证明未复现。 | 1580162341668237312 |
| `src/blobshadow.js` | `src/life/unit-shadow-batch.js`, `src/badnorth/battle-g3.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）5 射线拟合平面贴形变斜坡（shadowFit 默认关），12° 斜面误差 .006。 | 820977247083528192, 821321422140309504, 821680056514781186 |
| `src/borderpath.js` | `src/campaign/frontier-overlay.js`, `campaign.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）campaign.html ?fields=1 画多条前线与两侧场；ear-clip 长扇三角保真度问题未改。 | 1097458505315946496 |
| `src/bouncegi.js` | `src/light/surface-bounce.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）split 模型与蒙特卡洛参考相关 0.53→0.82–0.91、总量比≈1、系数=1；两跳 gather 纹理接进 View 间接光。 | 1580835075629133825 |
| `src/boxtest.js` | `src/core/obb.js`, `src/badnorth/landing-plan.js` | 已迁移/增强（本轮验证） | （第 53 批）穿透深度、俯视 2D、裁剪面积真值、航道避礁石陆地、换车道；无动态避让（原版同为静态）。 | 974325184525201409 |
| `src/campaignmap.js` | `src/campaign/campaign.js`, `src/core/campaign-graph.js`, `campaign.html` | 已合并/迁移（静态确认） | 本次目录重扫补录同职责文件。原版scatter/cull/walk/branches/extras在重构战役页/共享图管线有对应，图连通修复已有旧运行证据；保留原版kNN与重构Delaunay+近邻的算法差异，未逐个导出兼容、不声称917405214638006273已全帧。 | 1042732450730913793, 1078792665980915714, 917405214638006273 |
| `src/cavepath.js` | `src/world/battle-navigation.js`, `src/world/layerednav.js`, `navigation.html` | 已合并/迁移（静态确认） | 分层导航路线天然带层号，测试确认穿洞 / 翻越分层；未做弧长重采样与法向偏移的可视化。 | 906416813810049025, 890611046435627008 |
| `src/cheesenav.js` | `src/world/fine-portals.js`, `src/world/battle-navigation.js`, `navigation.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）格内精细门户 + 形变侧壁（共享 fine-portals.js）接进 BattleNavigation（finePortals，默认关）与 navigation.html。 | 906425294533394432, 797119718477991936, 1442695040888963407 |
| `src/clouddeck.js` | `src/world/cloud-deck-layer.js`, `src/core/cloud-depth.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=clouddeck 三圈高耸积云带视差 + 云影投到地形屋顶；水面不读云影。 | 1243228419162341379 |
| `src/colorgamut.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1710031224838771027 |
| `src/colorvolume.js` | `src/core/color-volume.js`, `src/world/view-shading.js`, `src/ui/shading-panel.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）每格五特征栅格 + GPU 八角点 OKLab 三线性插值接进 View（?shade=colorvolume，默认关），面板角点取色器实时改；浏览器开关对照已看。 | 1710031224838771027, 1712088611934371876 |
| `src/combatfx.js` | `src/core/melee-sweep.js`, `src/badnorth/battle-g3.js`, `src/badnorth/battle.js` | 部分覆盖 | （第 55 批）旋转扫掠、刃碰墙遮挡、盾推力接进 Battle（meleeFx 默认关）；缺原作动作美术（只有程序化刃）。 | 870296307889573889, 903647529203634176, 946660607008403456, 984813819280191488, 995043346778415104, 999191760944418817, 901842167508992000, 902069261304287232 |
| `src/contrast.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1482346496460828674 |
| `src/contrasttex.js` | `src/core/contrast-field.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）World 三角扇 OKLab 松弛（ΔE 13.75→0.10）画进 512² 世界图，顶面取色 + 对比边细线接进 View；浏览器对照已看。 | 1482346496460828674 |
| `src/coroutine.js` | `src/core/coroutine.js`, `scheduler.html` | 已迁移/增强（本轮验证） | 嵌套递归、预算、取消和演示已补；合作式步骤不可抢占，取消仅同步finally清理。 | 863019585162932224 |
| `src/demo.js` | `src/world/townDemo.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1197909675443916803, 1215642481162887168, 1238474550511308800 |
| `src/depfill.js` | `src/core/depression-fill.js`, `src/terrain/drainage.js`, `src/terrain/terrainmesh.js`, `terrain-r55.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）水位填洼写 World.lakes，terrainmesh 画湖面多边形；整数 stream-power + 崩塌侵蚀。湖面为平面河色，非独立水 shader。 | 1447488323845509121, 1442695040888963407 |
| `src/dfgrow.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1105131621391495176, 1104771432440049664 |
| `src/dirsprites.js` | `src/core/sprite-ambiguity.js`, `src/life/unit-sprites.js`, `src/badnorth/battle.js`, `sprites.html` | 已迁移/增强（本轮验证） | 保留翻转指标、锚点/alpha修复及单方向模式；新增逐单位UV血斑和受击摆动。原作美术、完整兵种/攻击动画与精灵阴影待补齐，保留原3D模式。 | 969860566322958336 |
| `src/doodlewall.js` | `src/core/doodle-layout.js`, `src/build/doodle-wall.js`, `src/world/doodle-overlay.js`, `doodle.html` | 已迁移/增强（本轮验证） | 墙饰生成器和World可选贴面已迁移：板号种子、逐板裁剪、墨线遮罩。完整室内走廊/弧顶/门口版式、纹样复杂度及贴面光照烘焙仍待补。 | 1897266928961700215, 1890018647655272491 |
| `src/dual.js` | `src/life/flora-species.js`, `src/core/vertex-dual.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=dualflora 地被落到顶点对偶点 + 崖壁竖面落点 dualWallSites。 | 959752525867036672 |
| `src/edgeplant.js` | `src/life/vegetation.js`, `src/core/garden-paths.js`, `src/build/buildings.js`, `garden.html`, `src/core/edge-inset.js` | 已迁移/增强（本轮验证） | 保留崖沿/墙根植被，新增共享World院内连通路由；原版完整CPU统计/平面渲染接口、原作门洞规则/细石板/中心装饰未完整迁移。草丛contrast texture+背景射线原法仍未实现，不能由静态邻崖启发式替代。 本批599帧复核确认原作纯纹理灌木，已有球团近似保留；修复基于未形变格心的错误内收方向并对薄格限幅，双网格实例锚点通过。原片纹理灌木/微阴影仍未实现，锚点在格内不保证球团整个体积在内。 续作600帧多岛生成已学，未从效果臆测内部纹理生成算法，保留待实现。 | 1590669875869286400, 1707490274425884929, 1290997501332525056, 1590674061092212738, 1707490932017279035, 1707497006640365880 |
| `src/edgesmooth.js` | `src/terrain/edge-square-relax.js`, `edge-smooth.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）方格目标松弛 + 边类层级复现 regularity 大降（26.9→14.1），硬线不动。 | 1670720537662836736, 1670725072540106755 |
| `src/floatprobe.js` | `src/world/float-advect-gpu.js`, `float.html` | 部分覆盖 | （第 55 批）WebGL2 实测 32F/16F/8 位 ping-pong 平流与 CPU 仿真一致（16F 差 1.9e-6）；只有 SwiftShader 一个 GPU，跨平台矩阵测不了。 | 1664565063552847873 |
| `src/flowdemo.js` | `src/world/view-post-extras.js`, `src/life/atmosphere.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=softnormals 软法线写回 View 主网格（37296 软化/276 保硬边），关时逐值还原。 | 931196707236392960 |
| `src/flowfield.js` | `src/world/navmesh-flow.js`, `src/world/battle-navigation.js` | 部分覆盖 | （第 55 批）guardedFlowAt 解决鞍点（24/24 到达）；Battle 实测 quad 网格更慢，连续转向仍默认关。 | 816748103193817088 |
| `src/foliageblob.js` | `src/core/canopy.js`, `src/life/vegetation.js` | 已迁移/增强（本轮验证） | canopy kernel:metaball；植被默认仍用 union，未切换默认。 | 1580158269267406849 |
| `src/frontier.js` | `src/core/frontier-candidates.js` | 已迁移/增强（本轮验证） | （第 53 批）expandFrontier 增量坍缩边放置 + 前向检查 + 导航互连并查集；一步前向检查不等于全局可行。 | 1582293326815862786 |
| `src/fusion.js` | `src/world/scenes.js`, `src/build/multicell.js`, `src/build/buildings.js` | 已迁移/增强（本轮验证） | 共享World融合场景及显式双格模板已运行验收；完整预制轮廓socket/多格联合求解另列splice后续。 | 1579483114178768898, 1584623053061099520, 1447488323845509121 |
| `src/grasscards.js` | `src/life/vegetation.js`, `src/life/leaf-surface.js`, `leaf-surface.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 本轮611帧复核仅补近景球冠/灌木纹理alpha；远景impostor/草卡片未接同一叶纹，原有实现保留，不升级为整模块运行通过。 | 1590669875869286400, 1707490274425884929, 1205420678859632640, 1015149712469524480 |
| `src/grid.js` | `src/core/grid.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1302686201401442309 |
| `src/gridmodes.js` | `src/core/wfc.js`, `joint3d.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）layerGrid + layeredJointCatalog：多层辐条联合插槽、重力规则、跨层塔模块。 | 1670790425232175108, 1447496205282549761, 1147881669350891521 |
| `src/gridpatch.js` | `src/core/radial-patch.js`, `gridpatch.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）模板库（radial/block/rhombus/courtyard）+ 带洞边界 + fitTemplatePatch，全凸无折叠面积守恒。 | 1301816247479345152 |
| `src/gridwfc.js` | `src/core/wfc.js`, `wfc.html` | 已迁移/增强（本轮验证） | 保留已验收的任意多边形半边、确定性、迭代回溯、pins、预算与局部修复。本轮可选四分子格网格进入真实求解流程；四子格联合模块约束、3D预制tile/建筑和地形联合生成仍待补。 | 1164926304640229376 |
| `src/grouping.js` | `src/core/region-groups.js`, `src/core/campaign-graph.js`, `src/campaign/campaign.js`, `campaign.html` | 已迁移/增强（本轮验证） | 两段773帧、100种子4455份连通历史和12次真实页面回放通过。共享World混合/四边形适配及权重切边量化通过；本地整组合并+节点调整，不承诺原作精确权重/调度或旧函数签名；固定迭代/512节点限制，边境轮廓另列。 | 938422757288792064, 938405900573986816 |
| `src/halfedge.js` | `src/core/halfedge.js`, `src/core/grid.js` | 已迁移/增强（本轮验证） | 显式半边 next/prev/twin、边界环、顶点扇、Euler、方格切三角迁入并实测；grid.js 内部仍用 edgeNeighbors/edgeTwins。 | 1458921394855718917, 1584623053061099520, 1447494168448753667 |
| `src/hiproof.js` | `src/core/straight-skeleton.js`, `src/core/hip-roof.js`, `src/build/buildings.js`, `building-kit-r55.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）精确直骨架（含洞/凹屋顶谷线），多格块与带洞庭院全四坡。 | 807256278154301441 |
| `src/holenav.js` | `src/world/fine-portals.js`, `src/world/battle-navigation.js`, `navigation.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）同 fine-portals：身高超拱顶封门，绕无顶缺口。 | 797119718477991936, 906425294533394432 |
| `src/housekit.js` | `src/core/house-kit.js`, `src/build/village.js`, `building-kit-r55.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）8 档坡度池 + 程序化分层茅草 + scatterVillage 撒村写 World。 | 781027725452648448 |
| `src/infograph.js` | `src/badnorth/info-graph.js`, `src/badnorth/battle.js` | 已迁移/增强（本轮验证） | （第 53 批）动态节点图（距离 / 同层 / 视线，每跳 ×0.55、≤2 跳），真实 Battle 中按同伴转告追击。 | 883447205176238083 |
| `src/islandpasses.js` | `src/core/terrace-edges.js`, `src/world/terrace-edges.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）finalSegments 与网格同一采样，台地边线与最终倒角零误差（3 模式×软坡×两网格）。 | 1669315384619540487 |
| `src/learnpanel.js` | `src/ui/learnpanel.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `src/levelflora.js` | `src/life/flora-species.js`, `src/core/level-flora.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）六种物种程序化几何，?fx=levelflora 每级台地形状可辨（无原素材）。 | 959530111187013632 |
| `src/lighting.js` | `src/light/voxel-field.js`, `src/light/bake.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）分层场浮点纹理在 GPU 顶点着色器采样（已在 WebGL2 跑）+ 体素软法线写回主网格；与 G2 softnormals 勿同开。 | 931196707236392960, 1168571866405097472, 1580846877855338497, 1237305125070426112, 1062374549407350790, 1580845127207387137 |
| `src/lightingcache.js` | `src/world/worldmesh.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 931196707236392960, 1168571866405097472 |
| `src/looptown.js` | `src/build/buildings.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1313837640366596096 |
| `src/mandala.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1490068909042642944 |
| `src/march.js` | `src/core/contour.js`, `contour.html`, `grids.html` | 已迁移/增强（本轮验证） | 不规则网格 marching squares 完整迁移并实测（跨格端点重合 / 无蝴蝶结 / 鞍点决断 / 多层级）；岸线绘制仍是另一套。 | 1120036868966502401 |
| `src/megatex.js` | `src/light/texel-owner.js`, `src/core/atlas.js` | 已迁移/增强（本轮验证） | owner 表反查 + 垫边防串色接共享 Atlas；未接 impostor 烘焙器 / SDF·AO 卷。 | 1481661852887265288 |
| `src/mesh.js` | `src/world/worldmesh.js`, `src/core/meshwriter.js`, `src/tools/mesh-audit.js`, `save-mesh.html` | 已迁移/增强（本轮验证） | 349帧复核并保留既有分块缓存后合并主体；双网格编辑前后主体GPU提交均1次。并非全场景单call，不覆盖原作Switch性能/动态合批算法。 | 1401145625572425728 |
| `src/mipcustom.js` | `src/light/mip-chain.js`, `textures.html` | 已迁移/增强（本轮验证） | 四档自定义 mip + 线性空间 + 三线性 / 各向异性采样迁入共享模块并实测；未接 impostor 图集与 textures 页。 | 777596437534240768 |
| `src/mipfilter.js` | `src/light/mip-chain.js`, `textures.html` | 已迁移/增强（本轮验证） | 同 mipcustom（两份实验合成 mip-chain.js）；原 renderGround/paint 可视化未迁。 | 777596437534240768 |
| `src/mirrordecor.js` | `src/core/mirror-uv.js`, `src/core/ornament-field.js`, `src/ui/ornament.js`, `mirror.html`, `ornament.html` | 已迁移/增强（本轮验证） | 单纹理D4八方向、中心折叠和uniform尺寸控制已实测；保留原距离场/独立cutoff动画。原作细线纹样/精确任意尺寸布局、makeMotif/paintRect/seamError CPU参考接口仍未逐一兼容。 | 1061221291137605633 |
| `src/mixedwfc.js` | `src/core/wfc.js`, `src/core/grid.js`, `wfc.html` | 已合并/迁移（静态确认） | 真实三角 / 四边形混合格直接求解；未做「方格 = 4 三角捆绑」的表示与 MODULES 对照。 | 1447494168448753667 |
| `src/mountainlight.js` | `src/core/mountain-bake.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）山体烘焙图集接进 View 岩壁，运行时 0 次法线采样；「球面混合」核实原模块没有（已过时）；真 GPU 性能未测。 | 1786014232594485497 |
| `src/navgraph.js` | `src/world/save.js`, `river-nav.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）riverFlow 写进存档可选尾段，旧码逐字节兼容，读档 91 段一致。 | 1795831296952041691, 1582293326815862786 |
| `src/navgrid.js` | `src/world/navgraph.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 797119718477991936, 807135253215199233, 817323301357948928 |
| `src/navribbon.js` | `src/core/path-samples.js`, `src/world/battle-navigation.js`, `src/badnorth/battle.js` | 已迁移/增强（本轮验证） | （第 53 批）命令路径 Catmull-Rom（不出可站区）、弧长等距、贴地含楼梯、净距带状格；尘粒 AO 是另一片。 | 827215002448846848, 823848950553780226 |
| `src/overhangterrain.js` | `src/terrain/soft-tops.js`, `src/terrain/terrain-collide.js`, `src/terrain/terrainmesh.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）terrainmesh 层连续软坡（world.softTops，无裂缝）+ 形变侧壁碰撞 pushOut/heightAt；Battle 单位尚未调用。 | 1671808851895627776, 1447488323845509121 |
| `src/paintnormal.js` | `src/core/paint-normal.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）大笔触法线图主轴投影、切线空间扰动接进 View；浏览器对照已看。 | 1481661852887265288 |
| `src/palette.js` | `src/core/palette.js`, `src/world/app.js`, `wall-palette.html`, `src/core/qa-replay.js`, `qa-replay.html` | 已迁移/增强（本轮验证） | 保留已有墙色预设/固定屋顶成果；本轮524帧后补独立色槽更新、真实World重建和还原。原PNG热更新、多行贴图、最短色相跨调色板渐变/QA及完整原接口仍待补。172732仅可作配色外观参考，实际主题是拖抹，已移至smear映射。 本批200帧复核后补本地最短色相HSL滑杆、无彩色端点处理；不从画面推导原公式/过渡时长，PNG、QA和持久化仍待补。 本批814帧纠正QA误归：视频为复杂建筑编辑，不证明随机模块色；新增16步编辑/检查/异常恢复为本地回放，完整原作QA和PNG仍未覆盖。 | 1200520827898343425, 1371460793032716290, 1344290848180203523 |
| `src/partsprites.js` | `ui.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 847717312912211970 |
| `src/patchblend.js` | `src/terrain/patch-blend.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）岸带手工 UV + 高度混合接进 View；贴图为程序化替身，只画陆侧（水侧是海面材质）。 | 1781405550061687016 |
| `src/patchcluster.js` | `src/core/infinite.js` | 已迁移/增强（本轮验证） | （第 53 批）createInfiniteStream 按需流式（3/7 块簇均实跑，无缝）+ quadDual；原 consensus 对照未迁。 | 1332410042784641026, 1151770831619534848 |
| `src/penumbra.js` | `src/world/penumbra-terrain.js`, `src/light/penumbra.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=penumbra3d 地形与悬挑接收面体素半影；开启时非 World 物体（树）不再投 PCF 影。 | 1305951750638231552, 1313840428685447170 |
| `src/piercefloor.js` | `src/core/arch-floor-budget.js`, `src/build/buildings.js`, `src/world/navgraph.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）过梁几何 + 拱下精确净空 + buildNav underArches；Battle 运行时尚未接。 | 802496920790777856 |
| `src/piperepair.js` | `src/core/infinite.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 793806535898136576 |
| `src/portrait.js` | `src/ui/slot-portrait.js`, `ui.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）ui.html ?portrait=slots 按 PORTRAIT_SLOTS 画程序化头像，IoU 0.994（无原素材）。 | 958371606350454784, 1010979395719319552 |
| `src/propanim.js` | `src/world/prop-anim-layer.js`, `src/core/prop-anim.js`, `src/world/app.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）合并道具网格逐顶点 slot 属性 + shader 弹簧，只上传变化槽位；?propanim=1。 | 1246074663546916873 |
| `src/propframe.js` | `src/core/opening-footprint.js`, `src/build/buildings.js` | 已迁移/增强（本轮验证） | （第 53 批）贪心刚性框道具接进 World 后院（yardProps 开关），零重叠；道具是简单盒子。 | 1205416648397721601 |
| `src/quadgrid.js` | `src/core/grid.js`, `grids.html` | 已合并/迁移（静态确认） | 1068帧已复核；三角合并/共享边中点/细分与松弛主体保留，已有重构不重做。本批未新增完整生成动画、6度顶点启发式或无限拼接运行验收；signedArea/isConvex辅助导出和质量接口待核。 | 1147881669350891521, 1151770831619534848, 1332410042784641026 |
| `src/quadinf.js` | `src/core/infinite.js`, `grids.html` | 已迁移/增强（本轮验证） | buildInfinite 支持 origin 任意块中心开窗口、windowSeam 实测重叠区 raw/patch/blend 逐位一致；页面里未加平移窗口的交互。 | 1151137783785771008 |
| `src/quadtex.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1015149712469524480, 999185422403055616 |
| `src/rayvis.js` | `src/core/space-visibility.js`, `src/core/vertex-openness.js`, `src/world/space-visibility.js` | 已迁移/增强（本轮验证） | （第 53 批）逐格穿行射线（薄墙不漏）+ 整楼明暗烘焙 + 灰点叠加层；（56 批）逐顶点烘到 WorldMesh + c04 灰度材质；（57 批）三角网格光学 castMeshRay/sampleMeshVisibility + indoorAt 谓词 + 能力库 world.openness 显示层。 | 798580832906739712 |
| `src/rectpack.js` | `src/core/atlas.js` | 已迁移/增强（本轮验证） | （第 53 批）recursiveFill / 90° 旋转 / shelfPack 基线 / 手指数两口径；非最优、不自动压缩同原作。 | 1764958522398146667, 1593215065423245313, 1765041830461055127, 1765115069837221962 |
| `src/reflstreak.js` | `src/world/view.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1758250248483278925 |
| `src/repeatbreak.js` | `textures.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1061229717582475264, 1061227418961219585 |
| `src/save.js` | `src/world/save.js`, `src/world/app.js`, `save-mesh.html` | 已迁移/增强（本轮验证） | 321帧复核后修复坏输入原子拒绝、游程越界/尾随垃圾与空列元数据，北境场景身份可往返；兼容旧v5合法串。原作位格式、跨平台拓扑身份、自定义配色及天气/玩法状态仍未覆盖。 | 1198957499027795969 |
| `src/savestring.js` | `src/world/save.js`, `src/world/app.js`, `save-mesh.html` | 已迁移/增强（本轮验证） | 321帧复核后修复坏输入原子拒绝、游程越界/尾随垃圾与空列元数据，北境场景身份可往返；兼容旧v5合法串。原作位格式、跨平台拓扑身份、自定义配色及天气/玩法状态仍未覆盖。 | 1198957499027795969 |
| `src/scene.js` | `src/world/view.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 926903893866541057, 1215644531221311488, 1991103578011029507, 1313840428685447170, 1147881669350891521, 1458921394855718917, 1584623053061099520, 1447494168448753667, 1384958097542819845, 1849732997945110651, 931196707236392960, 1580846877855338497, 1580845127207387137, 1062374549407350790, 1244892370392489989 |
| `src/shore.js` | `src/water/shore.js`, `src/core/shore-profile.js`, `src/core/shore-loops.js`, `shoreloops.html` | 已迁移/增强（本轮验证） | 已有真实边界/形变法线保留，新增规范绕序、角接分岛/水洞自接闭环分解，1024组合及共享World桥接验收通过。窄湾外推浪带交叠、精确拱底截面/泡沫mask仍缺。 | 1991101097818403263, 1849732997945110651, 1849730611964973481, 1215644531221311488, 1215642481162887168, 1666429884208381953 |
| `src/shrubcard.js` | `src/life/vegetation.js`, `src/world/view-post-extras.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=wallcards 墙根 574 张折卡已目视。 | 1191990107785572352 |
| `src/slotsolve.js` | `slots.html`, `src/core/wfc.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）槽位表 + 27 变体缩略池 + 按 trace 逐帧播放、依赖链与冲突示例。 | 865200072685912064 |
| `src/smear.js` | `src/world/view-post-extras.js`, `src/core/camera-motion.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=smear 解析切向拖影接进渲染循环，与历史叠加并存；转动时外圈 p95 梯度 17.2→9.7，静止不变。 | 1727315611959865407, 1727324352264474664 |
| `src/smokefx.js` | `src/core/smoke-order.js`, `src/life/effects.js` | 已迁移/增强（本轮验证） | （第 53 批）火焰卡片噪声 / UV 滚动 / mip 随龄 / cutoff 亮边 + 随火量 PointLight；透明穿插近似。 | 1015140880666300416, 1015142746372366336, 1015149712469524480, 1015151731804721152, 1056990611738451968, 1056992291108413446 |
| `src/snapshot64.js` | `src/world/island-snapshot.js` | 已迁移/增强（本轮验证） | （第 53 批）World 剪影真值 64² 存储、crisp 着色器 CPU 孪生、IoU/edgeEnergy/peakGradient/bandPixels/rmse 对照、GPU 读回接口。 | 911913981731885056 |
| `src/socketrock.js` | `src/core/wfc.js`, `wfc.html` | 已迁移/增强（本轮验证） | diagnoseTiles：多边形网格 AC 传播找死 tile 与无人接的接口；页面未显示诊断结果。 | 1164926304640229376 |
| `src/spherefusion.js` | `src/sphere/planet-town.js`, `planet.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）planet.html ?fusion=1 星球作为共享 World 显示，页面验收零错误。 |  |
| `src/spherehouse.js` | `src/sphere/planet-town.js`, `planet.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）1–3 层房子按各层松弛角点变形（?floors=mixed），程序化模块。 | 1768627849529893109, 1584623053061099520 |
| `src/spheretown.js` | `src/sphere/planet.js`, `planet.html` | 部分覆盖 | （第 55 批）solver:shape 让共享角点分歧 0.095→0.007、墙最大倾斜 45°→28°；宽高原蘑菇化有几何下界，原模块目标形状无出处。 | 1768627849529893109, 1338825080844021760, 1769641473895432220, 1769691526924292506, 1795831296952041691 |
| `src/splice.js` | `src/build/splice.js`, `src/core/world.js`, `src/world/save.js`, `src/world/app.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）嵌入的房子进存档尾段、快照撤销、编辑器工具（?tool=splice / I 键）。 | 1584623053061099520 |
| `src/squadbanner.js` | `src/badnorth/squad-standard.js`, `src/badnorth/battle-g3.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）竖旗横杆金球、金边燕尾旗、金饰盾纹替换 Battle 旗（standards 默认关），程序化。 | 827216768783495168 |
| `src/squarehex.js` | `src/core/corner-footprint.js` | 已迁移/增强（本轮验证） | （第 53 批）cornerCutPlan 二分着色切角 + footprintMetrics（与原 runMetrics 一致）+ islandFootprints；只读未接 WorldMesh。 | 1471817524148940807 |
| `src/squigglefield.js` | `src/core/ornament-field.js`, `src/ui/ornament.js`, `ornament.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）ornament.html 换用卷草场：四折镜像、扭动动画、扫光（?squiggle=1）。 | 1105131621391495176 |
| `src/storydatum.js` | `src/core/story-datum.js` | 已迁移/增强（本轮验证） | （第 53 批）共享 World 整数层下楼层线偏差 0；非整数塔基 datum 规则与 measureFacade/windowRows 已迁并测。 | 803190517534248960, 806856212260278272 |
| `src/surfacedeco.js` | `src/core/surface-decoration.js`, `src/build/buildings.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）门墙段并入长立面、立面绕拐角、archCutout 真挖拱洞。 | 1181464374839521280 |
| `src/surfaceshadow.js` | `src/light/surface-shadow.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）墙接收窄条、洞内地面射线阴影、贴形变顶面接进 View；洞内只有浏览器度量（205 纹素中 152 被挡）无清晰截图。 | 1704218784028905984, 1705195380457996629 |
| `src/terracecliff.js` | `src/core/terrace-profile.js`, `src/terrain/soft-tops.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）softTops 提供连续场；meshSlopeProfile 在真实网格上量平/软/陡。 | 815236105079398400, 781957658597269506 |
| `src/terraceladder.js` | `src/world/battle-navigation.js`, `src/badnorth/battle-g3.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）寻路避薄平台 + 按横档的攀爬动画。 | 781957658597269506, 1669315384619540487 |
| `src/terrainmesh.js` | `src/terrain/terrainmesh.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1447488323845509121, 1063115611289645057 |
| `src/texelsnap.js` | `src/core/texel-skip.js`, `textures.html`, `src/core/leaf-atlas.js`, `src/life/leaf-surface.js`, `src/life/vegetation.js`, `leaf-surface.html` | 已迁移/增强（本轮验证） | 新增128²/32²植物保留区、连续texel采样及实际球冠/灌木接入；完整bakeAtlas/audit/植物素材、全场景一张atlas及一般mipmap仍待迁移。对象球面经度导数绕缝、区域边界半texel夹紧和远处均值淡出仅本地近似。 | 1241096929490149376, 1241046107125399552, 1205420678859632640 |
| `src/tileforce.js` | `src/core/module-patch.js`, `src/core/wfc.js`, `prefab.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）spliceModulePatch 缝进已有网格（Euler=1）+ 两层 3D prefab 带 W/D/R/S socket。 | 1751932427272909032, 1670794261669769217, 1579483114178768898 |
| `src/tileplace.js` | `src/core/wfc.js`, `src/build/tile-assembly.js`, `assembly.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）加权香农熵（默认关时逐字节一致）+ View 播放的拼装动画。 | 784847588893814785, 784847933686575104, 787319655648100352, 797844857821732864, 793806535898136576, 784848286272327680 |
| `src/tilerepair.js` | `src/core/wfc.js`, `wfc.html` | 已迁移/增强（本轮验证） | 独立socket局部修复已补；范围外不变、原值优先、扩区/预算/失败回滚。完整建筑多格tile与增量传播性能另列后续。 | 793806535898136576 |
| `src/topoline.js` | `src/core/grid.js`, `grids.html` | 已迁移/增强（本轮验证） | 保留确定性对边遍历，新增有向格/出边判环、停止原因、真实中点段与坏twin拒绝；1254走法及实际Canvas通过。原随机转侧边不据视频照搬；手柄/连刷、完整高度绘制与飞岛支撑规则仍待接入。 | 1384958097542819845 |
| `src/town.js` | `src/core/world.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `src/townmesh.js` | `src/build/buildings.js`, `src/core/courtyards.js`, `src/world/worldmesh.js`, `garden.html` | 已迁移/增强（本轮验证） | 本批202帧庭院复核，保留共享建筑/小径，新增按真实第2层墙体识别围合；桥下开口/地面开口/重封闭双网格通过。原作矮墙分区、精细门拱/形变边界、完整建筑模块与植物视觉不计完成。 本批333帧确认早期grass plots有高层台地分区，原帖树是未来计划；现有地面庭院不能替代完整高层地块/石边带，列后续。 | 1197909675443916803, 1189908238566903808, 1215642481162887168, 1258421104756097029, 1189902695303458816, 1238474550511308800, 1168571866405097472, 1237305125070426112, 1313840428685447170, 1580846877855338497, 931196707236392960, 1062374549407350790, 1580845127207387137, 1178731576982724611 |
| `src/trace.js` | `src/world/app.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1384958097542819845 |
| `src/traffic.js` | `src/world/battle-navigation.js`, `src/world/layerednav.js` | 已迁移/增强（本轮验证） | （第 53 批）L 弯 / T 岔 / 直廊对穿压测全到无死锁，体型重路由；分离仍软约束。 | 880853661936734211, 886199305522085890, 795010582239997952 |
| `src/triGraph.js` | `src/core/trigraph.js`, `trigraph.html` | 已迁移/增强（本轮验证） | locate / edgeMap / clone / flip / legalize 迁入并实测；浮点谓词无精确算术。 | 1677242779162877952 |
| `src/triflow.js` | `src/badnorth/flowfield.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 810157485638189056, 816743289500106752 |
| `src/triflowfield.js` | `src/world/navmesh-flow.js`, `navmesh-flow.html` | 已迁移/增强（本轮验证） | 面级流场 + 通口 + 漏斗 + 视线捷径接到共享导航面；未接 battle.js，未做方格流场对照页。 | 972829402873716737 |
| `src/triisland.js` | `src/terrain/generate.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1654401054828638214, 1447483550257799171, 1258005604066627586 |
| `src/uidecor.js` | `src/ui/icon-ink.js`, `src/ui/icon-toolbar.js`, `ui.html` | 已迁移/增强（本轮验证） | 等墨量线宽接进共享工具栏；徽记只做折数闭合检查，未画徽记图形。 | 1201179450668441600, 1024679338292256769 |
| `src/uikit.js` | `src/badnorth/battle-g3.js`, `src/core/playful-layout.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）俏皮指令条 + 每队单 Move 目标 + 地面标记，hold/retreat 真改小队目标（commands 默认关）。 | 1242824460325052417, 1016680972610359298, 1024679338292256769, 1201179450668441600 |
| `src/unitbatch.js` | `src/badnorth/unit-batch-lod.js`, `src/badnorth/battle.js` | 已迁移/增强（本轮验证） | （第 53 批）原缺口过时（早已实例化）；补视锥剔除 + 小于 9px 简化显示（有渲染器时默认开）。 | 817323301357948928 |
| `src/unitsnap.js` | `src/world/battle-navigation.js`, `src/core/unit-ground-height.js`, `src/badnorth/battle.js` | 已迁移/增强（本轮验证） | （第 53 批）楼梯踏面脚高接进每帧缓动 + 逐人悬空 / 埋入统计（停下均为 0）。 | 828984794407170048, 890611046435627008 |
| `src/voxelao.js` | `src/light/bake.js`, `src/light/voxel-ao.js`, `src/world/worldmesh.js`, `ao-stages.html` | 已迁移/增强（本轮验证） | （第 53 批）flat/up/vertex/directional 四档 aoMode（六向遮蔽）；SSAO 原作已弃，不迁。 | 793557992931266561 |
| `src/voxelflow.js` | `src/world/view-post-extras.js`, `src/core/wind-flow.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）软法线对主网格调用；meshCollider 读实时形变网格（groundAt）。 | 931196707236392960, 926903893866541057, 943230624369868800 |
| `src/voxelnav.js` | `src/world/fine-portals.js`, `src/world/layerednav.js`, `src/world/battle-navigation.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）同 fine-portals：portal.width 让体型分档避开窄门。 | 906425294533394432, 797119718477991936 |
| `src/wake.js` | `src/core/wake-sampling.js`, `src/life/boats.js` | 已迁移/增强（本轮验证） | （第 53 批）Wake/Ship 粒子：舷侧泡沫、淡雾、船头水花、Kelvin 角 19.39°，接进 Boats。 | 901469409579061248 |
| `src/walkreach.js` | `src/terrain/walk-reach.js` | 已迁移/增强（本轮验证） | 共享 World 可走分量 + 沿路线补台阶 / 削台；加高可能切断低侧格与更低邻格的连接，个别图全岛可达比例下降；未接生成器默认流程。 | 917405214638006273 |
| `src/wind.js` | `src/world/view-post-extras.js`, `src/life/atmosphere.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）?fx=windflag 旗子 shader 采风场纹理，随风向转弯垂抖；小瑕疵：法线未随转。 | 926903893866541057, 926890207298899969 |
| `src/wobbletex.js` | `src/core/sediment.js`, `src/terrain/terrainmesh.js`, `src/world/view.js`, `sediment.html` | 已迁移/增强（本轮验证） | 新增可精确逆Y剪切/世界坐标层理、岩壁专用mask及实际GPU验收，保留旧窄条。原作坐标场/完整纹样未知，通用3D逆场、原CPU曲率/面积漂移/缝差指标接口未逐一迁移，反射/阴影/轮廓仍旧几何近似。 | 1699038611125985317, 1699146321318314094 |
| `engine/backlit.js` | `src/world/outline.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1751945034851570056 |
| `engine/birds.js` | `src/life/birds.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `engine/blotch.js` | `src/terrain/blotch-atlas.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）斑块图集 + World 边缘场 + 受控渗漏接进 View 主材质；浏览器对照已看。 | 1696896119794479541, 1696864977171189980, 1703750394164199473, 1704246032626762189, 1786014232594485497, 1442695040888963407 |
| `engine/bnbrush.js` | `src/core/brush-atlas.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）划痕图集阈值化、沿口淡出接进 View；浏览器对照已看。 |  |
| `engine/bncanopy.js` | `src/core/canopy.js`, `src/life/vegetation.js`, `src/life/impostor.js` | 已迁移/增强（本轮验证） | 155帧复核，闭合球并集surface nets、三角形接缝松弛及真实树冠/烘焙输入通过；低分辨率歧义明确拒绝，原作MC/参数、美术及全局自交证明未复现。 |  |
| `engine/butterflies.js` | `src/life/decor.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1273520600221433857 |
| `engine/cage.js` | `src/terrain/shape.js`, `src/core/deformation-guard.js`, `src/world/worldmesh.js`, `overhang.html`, `src/terrain/terrainmesh.js`, `cage.html` | 已迁移/增强（本轮验证） | 保留既有XZ层级Taubin/笼形变形与面积/边长/扇形回退；新增分数层连续笼角点采样、沉积线复用及硬边输入。原完整cage拟合、扭曲壁面内部/跨切面3D相交与精确碰撞仍缺。 | 1579478470098243584, 1447488323845509121, 1708815475801505819 |
| `engine/contour.js` | `src/core/contour.js`, `src/world/contour-overlay.js`, `src/world/view.js`, `contour.html` | 已迁移/增强（本轮验证） | 共享角点、跨边缓存交点、闭环/开放/分叉诊断及真实World覆盖层已补；语义平面诊断不等于形变后的泡沫岸线。 | 1120036868966502401 |
| `engine/flags.js` | `src/core/banner.js`, `src/life/banner.js`, `src/badnorth/battle.js`, `src/life/decor.js`, `banners.html` | 已迁移/增强（本轮验证） | 保留已有风粒子/Bezier与暂停修复；54帧新核验后补六种透明旗尾/本地徽记并接入真实Battle，双网格暂停、共享风/曲线/资源释放及GPU alpha通过。原作完整徽记、精确画稿、跨帧率/布料碰撞仍待补；彩旗绳归因单列纠正，非屋顶旗证据。 | 926890207298899969, 926834721392340992, 958410200146497537 |
| `engine/fog.js` | `src/core/fog-envelope.js`, `src/life/atmosphere.js` | 已迁移/增强（本轮验证） | （第 53 批）贴水雾片随风、遇体素切向绕开、深度遮挡、出圈回卷；未 GPU 验收。 | 906207980802252801 |
| `engine/impostor.js` | `src/life/impostor.js`, `src/world/view-post-extras.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）3 行×8 方位多俯仰烘焙 + 球面卡片 + 原 makeBlobCloud 云材质；?fx=impostorpitch。 | 1849427564034498642, 1852334860137849222, 926903893866541057, 1191990107785572352, 1205420678859632640, 1243228419162341379, 1593215065423245313 |
| `engine/islands.js` | `src/badnorth/island.js`, `src/terrain/bn-island-field.js` | 已迁移/验证（第 215 批） | 方格高度场管线（buildIsland/findPath/buildIslandGeometry）逐式迁到 bn-island-field.js 并逐位对拍（tests/bn-island-referee.mjs）；badnorth/island.js 为共享 World 上的另一套近似保留。 | 1579474420749725696 |
| `engine/lightvol.js` | `src/core/voxel-ray.js`, `src/light/lightvolume.js`, `src/world/view.js`, `lightvolume.html` | 已迁移/增强（本轮验证） | 保留点光/太阳DDA与六向RGB；新增可选中心EDT距离场保守步进、DDA兜底、六向距离AO及梯度诊断，两网格与DDA渲染属性对照通过。体素中心距离不是形变表面SDF；笔触法线、命中UV/mega反馈、全方向传播和实时增量仍缺。 | 1580845127207387137, 1582757294672314368, 1580846877855338497, 1168168400155267072, 1168400155267072, 1237305125070426112 |
| `engine/los.js` | `src/core/nav-visibility.js`, `src/world/visibility.js`, `src/world/view.js`, `visibility.html` | 已迁移/增强（本轮验证） | 分层导航门户的角度采样查询及World诊断已补；导航规则不等于光学遮挡，未接管战斗AI或箭矢精确碰撞。 | 810878197134950401 |
| `engine/mesa.js` | `src/terrain/generate.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `engine/meshcheck.js` | `grids.html` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1677242779162877952 |
| `engine/noise.js` | `src/core/noise.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `engine/normalsmooth.js` | `src/terrain/shape.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1062374549407350790, 929417420921556993 |
| `engine/ornament.js` | `src/core/ornament-field.js`, `src/ui/ornament.js`, `ornament.html`, `textures.html`, `src/core/ui-reveal.js` | 已迁移/增强（本轮验证） | 单张128²距离场、镜像UV、边区/中心独立阈值和uniform展开通过三尺寸GPU验收；保留旧演示。原作画稿/分层时序、九宫格不变形未复现，样例界面非游戏编辑器接入。 续审UI flair100帧，新增标题先显/先退、外纹后显/后退两轨本地时序及透明文字inert；单图集不变。没有原中心徽章/逐部件时序、白亮到金色材质或原画稿，局部通过不代表完整效果。 | 1104771432440049664, 1105131621391495176, 1024679338292256769 |
| `engine/outline.js` | `src/world/outline-pass.js`, `src/world/view-post-extras.js` | 部分覆盖 | （第 55 批）屏幕空间描边接进渲染循环（?fx=outline），零报错、修掉云卡/水面假墨线；缺原片程序化笔触法线图 / 反差贴图作线源。 | 1482011744843223042, 1017355723171344385 |
| `engine/props.js` | `src/build/buildings.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1205416648397721601, 1205422438437273601, 1176516621223043073 |
| `engine/reflection.js` | `src/water/reflection.js`, `src/world/view.js`, `reflection.html` | 已迁移/增强（本轮验证） | 纠正原静态映射误指岸浪文件。保留实际WorldMesh翻转/颜色反射，补裁掉水面上方残影、受限深度淡出/线性中点及参数验收；不等于原作完整色块/遮挡算法，原版createFlatReflection等名API未保留。 | 1215644531221311488, 1758250248483278925 |
| `engine/relax.js` | `src/sphere/planet.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1769641473895432220 |
| `engine/rivers.js` | `src/terrain/generate.js`, `terrain-r55.html`, `planet-rivers-r55.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）relaxRiverSlopes BFS 缓坡坍缩 + 湖洞联合重建（全入海、无环、不逆流），球面 World 同管线。 | 1769691526924292506 |
| `engine/roofs.js` | `src/build/buildings.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1205416648397721601 |
| `engine/shorefield.js` | `src/water/shore.js`, `src/core/shore-profile.js` | 已迁移/增强（本轮验证） | 已有chamfer栅格迁移到共享水层，本轮补起点阈值/硬步长上限和4M栅格预算；不是精确欧氏场，也未保留独立buildShoreDistance导出。 | 1664566546683899905 |
| `engine/snapshot.js` | `src/world/island-snapshot.js`, `snapshot.html`, `src/campaign/campaign.js` | 已迁移/增强（本轮验证） | 350帧复核；双网格真实World 64²捕获、异常状态恢复、跨上下文显式上传及GPU alpha阈值通过。原作通道编码/内轮廓未知；战役图标仍程序近似，全量真实快照缓存与游戏接入待后续集成。 | 911913981731885056, 978211952504852480 |
| `engine/snow.js` | `src/life/atmosphere.js`, `src/core/wind-flow.js` | 已迁移/增强（本轮验证） | （第 53 批）圆形软点、大小不一、World 支撑面接触 AO、远处淡出，接进 Atmosphere；未目视。 | 943230624369868800, 943230620242796544, 823848950553780226 |
| `engine/sphere.js` | `src/sphere/sphere-stages.js`, `src/sphere/planet.js`, `planet.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）阶段动画用真实迭代快照（?stages=1 / ?stageT=）。 | 1338829205157646336, 1338825080844021760 |
| `engine/splash.js` | `src/life/effects.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1258421104756097029 |
| `engine/spritepack.js` | `src/core/uv-charts.js`, `src/core/uv-bake.js`, `uv-bake.html` | 部分覆盖 | （第 55 批）填充率 0.158→0.31/0.48、零重叠，bakeChartPage 进共享 Atlas 并贴回；仍 <0.5（需墙带展开/图块合并），未接主场景 View。 | 1593215065423245313, 1852334860137849222, 1849427564034498642, 1478114309263839244 |
| `engine/surface.js` | `src/terrain/surface-pattern.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）surface 层（格线/层理/砂砾）挂到 View 共享材质地形面；浏览器对照已看。 | 1241096929490149376, 1714613599035863191, 1781405550061687016, 1699038611125985317, 1699146321318314094 |
| `engine/surfaceshadow.js` | `src/light/surface-shadow.js`, `src/world/view-shading.js` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）竖面窄带（0.28 倍）在 View 着色器生效，屋顶排除；浏览器对照已看。 | 1704218784028905984, 1705195380457996629 |
| `engine/terrain.js` | `src/terrain/generate.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 |  |
| `engine/vertexlight.js` | `src/core/cube-height.js`, `src/light/cube-height.js`, `src/sphere/planet.js`, `planet.html` | 已迁移/增强（本轮验证） | 273帧复核，真实6面低分辨率高度CubeTexture、顶点单次查询及球面实验通过；本地高度暗化解释不等同原作光照/投射阴影，游戏共享World球面融合未接入。 | 1791049306213912823 |
| `engine/voxelshadow.js` | `src/light/bake.js`, `src/world/worldmesh.js`, `ao-stages.html` | 已迁移/增强（本轮验证） | （第 53 批）逐顶点体素太阳阴影进 bakeLighting（与 AO 同一占用场），分块烘焙按影长加边；未接 View 太阳 UI、未目视。 | 1190191289922465793 |
| `engine/waterfall.js` | `src/water/waterfall.js` | 已合并/迁移（静态确认） | 按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。 | 1007587812462530561 |
| `engine/watervol.js` | `src/water/watervol.js`, `src/water/land-distance.js`, `src/core/voxel-distance.js` | 已迁移/增强（本轮验证） | 保留已有平面叠层，补level1陆地/各向异性2D中心距离、版本缓存、空场无残影和8资源释放，pipeline补真实开关。仅本地浅水近似，不是一般SDF/完整反射；形变后mask与原作效果仍缺，原版createWaterVolume同名API未保留。 | 1758251637280268481 |
| `engine/waves.js` | `src/water/shore.js`, `src/core/wave-cycle.js`, `waves.html` | 已迁移/增强（本轮验证） | 保留进退方向/独立周期，新增闭环分段浪峰及宽度，可在实际View开关对照。局部谐波是本地美术近似；全局泡沫mask、窄湾交叠和原版同名API仍缺。 | 1849732997945110651, 1849730611964973481, 1991103578011029507 |
| `engine/worldmap.js` | `src/sphere/worldmap.js`, `src/sphere/worldmap-material.js`, `planet.html` | 已迁移/增强（本轮验证） | （第 55 批，浏览器验收）512×256 等距贴图四表面混合上星球，无经度接缝，与格子海陆一致 97%（?map=1）。 | 1783792917183606829 |
