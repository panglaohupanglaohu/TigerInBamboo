window.PIPELINE = {
  "verdict": {
    "title": "技术路线存在交叉复用：2022 明确结合不规则网格与多格模块，2024 展示后续世界球面版本；不是四阶段单线继承",
    "points": [
      [
        "1579483114178768898",
        "\"combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)\" —— 一个房子 tile 同时跨一个方格和一个三角格"
      ],
      [
        "1584623053061099520",
        "把房子拼进地形：房子大多属于预制 tile"
      ],
      [
        "1768627849529893109",
        "\"put this on a sphere\" —— 地形 + tile 上了球面"
      ],
      [
        "931196707236392960",
        "Bad North：所有关卡共享一个虚拟体素空间，给光照烘焙、软法线、3D 贴图、碰撞、风模拟共用"
      ]
    ]
  },
  "lanes": [
    {
      "key": "base",
      "name": "共享底座（基础能力）",
      "color": "#2f7f8a",
      "note": "三个项目都在用、而且一直在迭代的能力：网格、水层、光照。index 里能直接开关的就在这一层。",
      "groups": [
        [
          "网格",
          [
            {
              "name": "早期不规则四边网：1068帧已核验，已有主体保留",
              "id": "1147881669350891521",
              "status": "done",
              "where": "src/core/grid.js（buildQuadGrid/relaxPolygons/buildTriangularSubgrid）· grids.html?t=kinds",
              "toggle": "grid",
              "page": "grids.html?t=kinds",
              "note": "1068帧全核（11张联系表）；四遍循环=点点→从中心长格→满格→转白细分→鼓穹顶→淡出，与grid.js buildQuadGrid（合并→逐多边形切四边形→80 pass 松弛）同构；infinite-verify stretch 1.83/shrink 0.46、kinds 页 mixed 331格(155四边形+176三角)通过。仍缺消除6价顶点的启发式与可播放时间线",
              "decodedFrames": 1068,
              "reviewEvidence": "artifacts/coverage/1147881669350891521-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  1067
                ],
                "nativeRevisits": [
                  0,
                  120,
                  265,
                  600,
                  1067
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "不规则三角网合并→切四边形→松弛成均匀四边形"
              }
            },
            {
              "name": "无限网格：块 + 簇各自松弛，顶点 = 块 + 最近两簇的重心插值（无缝、无翻折）",
              "id": "1332410042784641026",
              "status": "done",
              "where": "src/core/infinite.js · grids.html（无限网格页：高亮 1 块 / 顶点圆点）",
              "page": "grids.html?t=infinite",
              "note": "672帧全核；机制与片中一一对应（块松弛、块边界共享、顶点多表示插值），实测19块24簇翻折0、两侧表示差3.66e-15、拉伸最大1.83×。补齐片中调试视图缺的两件：顶点圆点（深色像素0→10582）与单块高亮（亮色240→7263）；仍缺：片中斜视3D的透视压缩、高亮块闪烁节奏、簇没有单独上色",
              "decodedFrames": 672,
              "reviewEvidence": "artifacts/coverage/1332410042784641026-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  671
                ],
                "nativeRevisits": [
                  300,
                  671
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "块+簇松弛与无缝性 + 调试视图"
              }
            },
            {
              "name": "三块簇/对偶532帧：实际各模式全部owner接缝审计",
              "id": "1151770831619534848",
              "status": "done",
              "where": "src/core/infinite.js · grids.html?t=infinite",
              "page": "grids.html?t=infinite",
              "note": "532帧全核，保留现有三块簇/插值；修verify始终查blend及只查前两owner，实际只簇模式接缝原被隐藏，浏览器全owner逐模式验收。按块边界钉住实际无缝，不沿用旧说明。；【第62轮 A 类收敛】三块簇/插值接缝按块边界钉住，浏览器全 owner 逐模式验收通过，判为 done",
              "decodedFrames": 532,
              "reviewEvidence": "artifacts/coverage/infinite-verify-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  531
                ],
                "nativeRevisits": [
                  0,
                  38,
                  110,
                  300,
                  430,
                  531
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "无限网格分模式/全部owner接缝审计，非原作性能/按需无限流式等价"
              }
            },
            {
              "name": "纯格型对照：真实正交方格/合并菱形区分；独立六边待补",
              "id": "1670790425232175108",
              "status": "done",
              "where": "src/core/grid-kinds-c08.js · src/core/grid.js · src/world/app.js · index.html?grid=hex|square|tri&scene=terrain",
              "page": "grids.html?t=kinds",
              "note": "610帧全核（7张联系表+原尺寸0242/0266/0440）；同一地形管线在三档纯格型上各出一座岛已能运行验收：?grid=hex|square|tri&scene=terrain 每格恒 6/4/3 边、顶点最多被 3/4/6 格共用（晶格类型可证）、V-E+F=1、互反违例0、陆地层数 95/6层、372/8层、576/10层，格线层唯一段÷陆地格 8.284/4.126/2.821 三档分明；页面内「纯六边形→纯方格」换网格场景不丢。原note连挂的「独立六边地形仍缺」为过期项（r56 C08 已接，缺的是运行验收）。形制差异如实记：原片六边岛是软坡+六棱柱，本仓走台地阶，属同组 1669 的软坡续项，不重复计。",
              "decodedFrames": 610,
              "reviewEvidence": "artifacts/coverage/1670790425232175108-review-r121.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  609
                ],
                "nativeRevisits": [
                  242,
                  266,
                  440
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三档纯格型岛：格型纯净/晶格类型/地形管线/格线层/页面入口（运行验收）"
              }
            },
            {
              "name": "拓扑直线：有向状态判环/真实对边段/停止原因",
              "id": "1384958097542819845",
              "status": "done",
              "where": "src/core/grid.js#traceStraightReport · src/ui/game-ui-c06.js#straightLineThrough/stepCursor/paintLine/轨迹层 · index.html?gameui=1&topoline=1 · grids.html?t=lines",
              "page": "grids.html?t=lines",
              "note": "679帧全核（7张联系表+原尺寸20/300/650+0300 4×裁切）；有向拓扑直线（格+出口边）追踪、闭环识别、多线同时显示三条都在主场景跑通——旧 note 的「游戏手柄/连刷仍未接入」核实为过期账（r56 就在 ui/game-ui-c06.js，只是没人从页面跑过）；本轮补三处真差距：线型由虚线改实线（原片是连续1px白线）、补历史轨迹层（原片一屏4–5条，本仓原只画1条，现留最近5条压暗）、线/轨迹对象命名+clearTraces 句柄；新测 tests/topoline-pad-drag-browser.cjs：闭环46格末点回起点出口边中点 gap 0、对边穿出 89732 对违例 0、折线转角 p50 8.2°/p90 21.8°、多线 9→5、像素开/关差 3545px 噪声 0、合成手柄十字键上走下退与 A 去抖（按住1.3s 只1次，+189 格/条）、真指针拖动连刷 +841 格且撤销 8 步回基线；回归 game-ui-c06.mjs / topoline-browser.cjs 全绿",
              "decodedFrames": 679,
              "reviewEvidence": "artifacts/coverage/1384958097542819845-review-r147.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  678
                ],
                "nativeRevisits": [
                  20,
                  300,
                  650
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "拓扑直线追踪/闭环/多线显示/手柄光标/拖动连刷（合成手柄，非真机）"
              }
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974579499802202113",
              "status": "done",
              "where": "src/core/spatial.js#baryPrep3 · src/world/bary-gizmo.js · bary-gizmo.html · tests/bary-gizmo-3d-browser.cjs",
              "page": "grids.html?t=infinite",
              "note": "815帧全核（9张联系表+原尺寸0445）；同一套教学gizmo另一种时长：灰模三角网+白球RGB箭头+白边查询三角，球在面内外来回、被抬到离平面很高的位置（0445 球高悬、白竖线连到面上投影点），相机缓慢绕行；全片无文字无UI无非相关物体。机制=预算对偶向量后 1 次减法+每坐标 1 次点积（任意朝向平面，面外点得投影权重+有符号离面距离），本仓 spatial.js#baryPrep3 正是这条路（ops{sub:1,dotPerWeight:1}、normal、distance、退化flag），baryCramer3 只作对账。与孪生片 974564862729838592 共用 bary-gizmo.js/.html 一套实现，本轮一并补齐真指针拖拽与运行验收（tests/bary-gizmo-3d-browser.cjs 27/27，像素A/B 2969px 噪声0，0 console error）",
              "decodedFrames": 815,
              "reviewEvidence": "artifacts/coverage/974579499802202113-review-r128.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  814
                ],
                "nativeRevisits": [
                  0,
                  445,
                  814
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "3D 重心成本口径（1减+每坐标1点积）+ 离面高度/投影 + 运行验收"
              }
            },
            {
              "name": "通用三角图：确定性全查/坏输入拒绝；局部编辑接口待补",
              "id": "1677242779162877952",
              "status": "done",
              "where": "src/core/trigraph.js · src/core/trigraph-edit-c08.js · trigraph-c08.html",
              "page": "trigraph.html",
              "note": "279帧全核（3张联系表+原尺寸0250/0278）；增量插点压力测试已完整：trigraph.js 的 add/flip/legalize/check(Infinity) 加 trigraph-edit-c08.js 局部编辑（addTracked 边差分 / removeVertex 星形环耳切+Lawson / moveVertex 失败回滚 / checkLive），note 里挂了多轮的「局部编辑接口待补」核实为过期；页面 trigraph-c08.html 补运行验收 tests/trigraph-c08-browser.cjs（200步 verts200/tris385/染色边33、全查401面 流形✓ Delaunay✓ 退化0；删5点 tris375 仍✓；移5点 活跃195 仍✓；0 console error），截图 trigraph-c08-insert/-delete.png 已 ViewImage 核过。口径仍成立：浮点容差诊断不等于精确谓词，画面不证严格 Delaunay。",
              "decodedFrames": 279,
              "reviewEvidence": "artifacts/coverage/1677242779162877952-review-r120.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  278
                ],
                "nativeRevisits": [
                  50,
                  150,
                  250,
                  278
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "增量插点 + 局部编辑（删点/移点）运行验收；严格 Delaunay 不证"
              }
            },
            {
              "name": "方形沿对角切四三角：父格追溯/实际WFC；联合模块待补",
              "id": "1447494168448753667",
              "status": "done",
              "where": "src/core/grid.js#buildTriangularSubgrid · src/core/wfc.js#jointSubtileCatalog/#layeredJointCatalog · joint3d.html",
              "page": "wfc.html?subtiles=1",
              "note": "178帧全核（2张联系表 + 原尺寸0050/0130）；note 挂久的「四子格联合模块约束及原3Dtile仍缺」已过期：jointSubtileCatalog/layeredJointCatalog 都在 wfc.js，joint3d.html 叠3层且 tall: 插槽出跨两层塔。页面运行验收：69父格/150子格=69+3×27（方格四分、三角1:1）、3层、conflicts 0、mismatch 0、towers 5、34.8ms；反向对照 ?joint=0 mismatch 81、换种子 seed9 仍 0。未改码，只补运行验收与量具。",
              "decodedFrames": 178,
              "reviewEvidence": "artifacts/coverage/1447494168448753667-review-r119.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  177
                ],
                "nativeRevisits": [
                  50,
                  130,
                  177
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "对角四分/混合tile共享WFC/三层联合约束/跨层塔 + 页面正反例运行验收"
              }
            },
            {
              "name": "Half Edge：511帧已核验；显式环/扇与编辑接口待补",
              "id": "1458921394855718917",
              "status": "done",
              "where": "src/core/halfedge.js · src/core/halfedge-patch-c08.js · halfedge-c08.html",
              "page": "adjacency.html",
              "note": "511帧全核（6张联系表+原尺寸0475）；半边环/扇与编辑接口全在：halfedge.js buildHalfEdge（next/prev/twin + boundaryLoops + vertexFan + euler）与 splitQuads，halfedge-patch-c08.js 复现「方块组→剩余区域边界环→间隙三角→合成网格」；本轮补页面入口 halfedge-c08.html 的「切四边形 / ?split=」与运行验收 tests/halfedge-c08-browser.cjs（t1.9 groups13/quads51/tris386/loops14/errors0、t3.2 euler1/fullLoops1、切 51 格出 46 三角=2×23 缝、splitEuler1/环1/错误0/面积Δ0、换种子 seed2 仍 euler1），截图 loops/mesh/split 已 ViewImage 核过。口径：原片彩边不能反推具体半边指令；环的合并粒度与配色规则与原片不同（本仓圆1+块轮廓13=14 环）。",
              "decodedFrames": 511,
              "reviewEvidence": "artifacts/coverage/1458921394855718917-review-r120.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  510
                ],
                "nativeRevisits": [
                  40,
                  92,
                  255,
                  475
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "显式半边环/扇 + 切四边形局部编辑运行验收"
              }
            },
            {
              "name": "球面四阶段：三角化/松弛真实坐标对照；完整原动画待补",
              "id": "1338825080844021760",
              "status": "done",
              "where": "src/sphere/planet.js · src/sphere/sphere-stages.js · planet.html?stages=1",
              "page": "planet.html?stage=tri",
              "note": "395帧全核（4张联系表）；四阶段=随机点→散开→球极投影三角化（按半径揭示）→按三角形松弛并每轮重三角化，planet.js 真快照 + sphere-stages.js 时间轴 + relaxRetriangulate 改边账全在，?stages=1 立体段即原片那种半线框半点；本轮同批补极点鲁棒性（poleGuard），回归 sphere-stages-browser（faces 1796/closed/geometryError 0）、sphere-insert-c06、sphere-stages 全 PASS",
              "decodedFrames": 395,
              "reviewEvidence": "artifacts/coverage/1338825080844021760-review-r118.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  394
                ],
                "nativeRevisits": [
                  0,
                  30,
                  80,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "四阶段真快照+球面三角化+松弛重三角化：逻辑+浏览器双验收"
              }
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · src/sphere/world-sphere.js · src/sphere/sphere-world.js · planet.html · sphere-world.html · sphere-shore.html",
              "page": "planet.html",
              "note": "229帧全核验；r205 补「平面World→球面」接线层 src/sphere/world-sphere.js：'bend' 模式与实景十二门徒 bendU/uBend=S/(2Rw)/帽面法线/锚点 frame 逐式同口径（抛物面下弯），'sphere' 方位等距严格上球（|p|=R、径向保距、往返一致）；柱格姿态=位置+径向up+测地平行搬运基+切平面 yaw，邻接格共享角点映射逐位相同（接缝闭合）；岸线=traceShoreLoops 平面黄线贴球→按角距细分→球面 Taubin 平滑→沿搬运法线测地外推蓝线，闭环相邻角距受控。r209 补球面 World 网格生成/编辑/保存恢复 src/sphere/sphere-world.js：sphereGrid 由 patch+网格参数产出真 cell 拓扑（grid.js 共享角点+edgeNeighbors/edgeTwins，非姿态摆放）附 pts3/pose，quad/square/hex/mixed 四类全落球接缝闭合；spherePick→sphereApply 把球面 3D 点翻译成落格编辑（build/erase/raise/dig/level/paint 与平面 applyAt 同语义）；encode/decodeSphereWorld 与 save.js 同风格位流+游程+版本/mode/网格参数/patch 指纹校验。tests/sphere-world.mjs 5/5 + world-sphere 等 sphere/planet 套件回归 PASS。浏览器验收（sphere-world.html + tests/sphere-world-browser.cjs，真实 GPU/three r160 + 本机 Chrome swiftshader）：634 格渲染成 1268 三角面片（非有限顶点 0、2536 角点引用全在 R=60 上）；sphereEdit 14 次贴内 build/erase/paint/raise/level 全 changed、贴片外拾取无操作，前后帧逐像素差 30381px/maxΔ167；encode→decode 进同规格 World 体素四数组逐位相等、再编码逐字相等、换渲染恢复出的世界逐像素一致 diff 0；接缝 2452 条内部半边 twin 角点 3D 距离全 0，weld 对账 2532/2536 角点引用被≥2格共享（边界 4 个单格角点除外），最多 6 格共点，接缝特写无裂缝。r211 vendor 拷贝+海岸线浏览器验收：src/sphere 全 13 文件+依赖闭包 core/trigraph.js 逐字进 TigerMessenger/src/vendor/townscaper-rea-refactoring/src/（sphere 只依赖 World/MAX_LEVEL 与常规体素接口，core/world.js 保护文件未动、splicedHouses/houseInstances 快照字段保持旧口径；cmp 逐字一致、node --check 全过、TigerMessenger --test 463/463 绿）。球面平滑海岸线浏览器验收（sphere-shore.html + tests/sphere-shore-browser.cjs，8769 静态服+本机 Chrome+playwright）：fbm 确定性水陆世界 634 格（陆136/岩56/水498，主岛+内湖+小屿）→ worldShorelines(spacing0.18/maxStep0.05/smooth6/reach0.4) 得 3 条闭环 188+42+45=275 点；断点 0、非有限点 0、最大步角 0.0031≤0.05、径向偏差≤2.2e-14、法线与径向|dot|≤8.4e-17、蓝线测地外推 0.4 同半径；跨接缝 84 个岸角 343 份角点引用逐位一致（缝0/错0）；同 World 重抽与 spec 重建再抽逐字相等；岸线叠加像素差 5041px；vendor 拷贝 ?src=vendor（8931 服）同数通过。残差：游戏运行时接入（vendor 文件就位、运行时改调未做，属换批）。；【卡点·B 美术资产】原片模块形状/海岸美术细节未知，程序近似与美术差分列；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 229,
              "reviewEvidence": "artifacts/coverage/1768627849529893109-review-r209.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  228
                ],
                "nativeRevisits": [
                  0,
                  90,
                  190
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平面World→球面映射/柱格姿态/球面岸线连续 + 球面网格生成/编辑/保存恢复 Node 用例验收（与实景 bend 同口径）+ 球面网格渲染/球面编辑像素差/存档往返逐像素/接缝顶点对账浏览器验收+ 球面平滑海岸线浏览器验收（水陆世界3环275点/断点0/径向≤2.2e-14/跨接缝84岸角全零/双次确定性逐字/岸线像素差5041px/vendor 拷贝同数）；vendor 文件拷贝已就位、游戏运行时接入与原片模块视觉（卡点·B）未验收"
              }
            },
            {
              "name": "防蘑菇化：多格联合拟合+冲突诊断/消解；原模块目标无出处",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · src/sphere/module-group-fit.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐轮保最优，最差边绝不差于相似解），edgeTol 超阈值回退分格拟合+逐边诊断 moduleGroupReport；moduleGroups 把声明模块切成独立联合单元。r213 补「多格冲突仍待补」：裁判库核对——REACode engine/relax.js 无模块组语义、spheretown 列本片 relax 为 Not done、多格 tile 为 todo，无原作多格冲突语义可对齐 → 按本仓 build/multicell.js 拒绝码实现 moduleConflictReport（求解前静态诊断：invalid-cell/duplicate-cell/overlap/disconnected/unresolvable=拒绝级，sea/uneven-support/assembly-cut=诊断级，装配 order 里不连续足迹记 assembly-cut）+resolveModuleGroups 确定性消解（剪非法/重复/重叠→连通切分→角距仍超 farLimit 丢弃并逐条记账，不伪造可行解）+cornerPositions moduleCheck 拒绝入口（枚举全部拒绝原因一次抛出）；unresolvable 与求解器同界（海平面足迹角距>1.2rad≈69°→逐层必 unresolved）。tests/module-group-fit.mjs 7/7（4 格足迹各层最差边 0.0001–0.133 vs 分格 0.08–0.405，全局 moduleSizeReport 0.399 < spring 0.535，曲率扫描/确定性/拓扑接缝校验）+ module-group-conflict.mjs 9/9（冲突全枚举/unresolvable 边界/消解确定性/moduleCheck 拒绝）+ sphere 套件回归过。；【卡点·C 物理冲突+B 资产】尺寸与墙倾斜的冲突使宽高原蘑菇化有下界（far 越大上限越紧，>69° 组角距记 unresolved 不收）、原模块目标形状在 REACode 无出处（海平面足迹=推断）、vendor 两文件已逐字拷入、r214 浏览器验收过（planet.html?solver=joint 实测：disagreeMean 0.0111≈shape 0.0075≪spring 0.0953、0 翻折、unresolved=6 与 moduleConflictReport 诊断一致，tests/sphere-joint-solver-browser.cjs）/游戏运行时接入属换批；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/1769641473895432220-review-r213.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  478
                ],
                "nativeRevisits": [
                  100,
                  170,
                  215,
                  275
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "多格联合拟合/误差约束 Node 用例验收（多高度多格足迹最差边<分格、前后曲线、接缝拓扑、超阈值回退）+多格冲突诊断/消解 Node 用例验收（拒绝级全枚举、unresolvable 角距边界、消解后 ok、装配切断、确定性、moduleCheck 拒绝）；planet.html 已挂 solver=joint 选项但浏览器未跑；原模块目标形状仍无出处"
              }
            },
            {
              "name": "分层平滑对照：已有形变保留，完整三模式待补",
              "id": "1670725072540106755",
              "status": "done",
              "where": "src/terrain/shape.js · hierarchy.html",
              "page": "hierarchy.html",
              "note": "164帧全核；三档分期 0-64 no / 65-119 dumb / 120-163 hierarchical（左上角标签模板匹配逐帧判），切点 64→65、119→120；机制 src/terrain/shape.js#shapeTerrain(mode) 早有三档（none 完全不形变、dumb 无视边类型全拉、hierarchical 按 rank 只被同级或更硬邻点拉），node 测试一直绿，真缺口是 hierarchy.html 只有硬边控件（页脚还写着三模式待补）→ 本轮补 #mode 三档选择器 + #modes 三档读数 + window.hierarchyModes 探针（渲染零改动）；实测崖顶转角 71.80°→61.03°、面积漂移 0/12.84%/12.24%、位移采样 0/4680/4682、钉住违例三档全 0、同机位像素 A/B 82869/80832/80333px 噪声 0；新测 tests/hierarchy-three-modes-browser.cjs + 回归 hierarchy-browser；如实口径：本仓分级是崖顶/崖脚/材质/钉住的本地近似，原片完整 mesh 边类型不声称等价",
              "decodedFrames": 164,
              "reviewEvidence": "artifacts/coverage/1670725072540106755-review-r166.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  163
                ],
                "nativeRevisits": [
                  30,
                  64,
                  65,
                  75,
                  119,
                  120,
                  163
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三档平滑（no/dumb/hierarchical）页面切档 + 三档读数 + 运行验收"
              }
            },
            {
              "name": "Square yet hex：556帧；切角轮廓实验，原岩岛算法待补",
              "id": "1471817524148940807",
              "status": "partial",
              "where": "src/core/corner-footprint.js · src/core/rock-island-c08.js · corner-cuts.html · rock-island-c08.html",
              "page": "corner-cuts.html",
              "note": "556帧阶段生成/旋转岩岛。岩岛生成层补齐：裁判 squarehex.islandMask 两档低频噪声+椭圆径向衰减逐点移植（rock-island-c08.js#rockIslandLand/Field/Levels/Generate），3种子×32×32格点与裁判掩码逐位一致、陆地共边对数与裁判 countAdjacency 相等；land 分档台地（{2,4,6,8}层）写共享 World rock 列，接 rockIslandMesh 切角闭环（二分计划接触 0.5、断边 0），格网邻接/导航不动，新测 tests/rock-island-gen.mjs。；【卡点·C 算法未公开】原片完整岩岛生成器（阶段生长/计时那台）从未公开，裁判仓同样只留 islandMask 演示 → 永久卡点，需新证据再立项；r225核销：tests/rock-island-gen.mjs/rock-island-c08.mjs/corner-footprint.mjs/squarehex-island.mjs 复跑 4/4 PASS（裁判对账与生成→切角闭环口径同前），src/core/rock-island-c08.js 与 vendor 逐字 cmp 一致、本批零代码改动；剩余残差仅卡点·C，无可执行残差，永久卡点，需新证据再立项",
              "decodedFrames": 556,
              "reviewEvidence": "artifacts/coverage/1471817524148940807-review-r225.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  555
                ],
                "nativeRevisits": [
                  17,
                  45,
                  100,
                  216,
                  339,
                  554
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "裁判 islandMask 逐位对账的岩岛生成层 + 共享 World rock 台地写入 + 逐层切角轮廓（tests/rock-island-gen.mjs/rock-island-c08.mjs 锁定）；阶段生长/计时完整生成器未公开（卡点·C，r225 核销为永久卡点）"
              }
            },
            {
              "name": "不规则三角底图：383帧已学，完整岛生成仍待补",
              "id": "1447496205282549761",
              "status": "done",
              "where": "src/core/grid.js#buildMixedGrid · src/terrain/generate.js#generateTerrain(softSlopes/riverRelax/lakes) · grids.html?kind=&wire=&tri2= · terrain-r55.html?grid=tri · index.html?grid=tri",
              "page": "grids.html?t=kinds",
              "note": "383帧全核（4张联系表+原尺寸0020/0175，0020另做3×裁切）；底图=不规则三角网已可在页面上跑出来：grids.html 新增 ?kind=tri|square|rhombi|mixed / ?wire=1（只画格线）/ ?tri2=1（四边格沿一条对角线切两片）+ gridLab.kindsReport，mixed 三角化后 331 格→486 三角、对角线 155==四边格 155、面积 CV 0.4165（0.24–1.40）、V−E+F=1；主场景 ?grid=tri 1944 格全三角、陆地 576 格/10 层、河道 27 格 2 条；terrain-r55.html 原来只透传 quad|mixed（三角底图上跑不了软坡/河道），现接受 tri|hex：软坡面 36.4 vs 墙面 211.8（关软坡 0/215.4）、河道 52 格 2 条 7 口、湖 6 个 51 格、缓坡陡边 118→91。新测 tests/tri-base-graph-browser.cjs 19/19 PASS，回归 grid-kinds-c08.mjs PASS + grid-kinds-browser.cjs EXIT 0。原文只讲底图，本片无预制 tile/无房子（原 note 的『预制 tile』口径属过期）。",
              "decodedFrames": 383,
              "reviewEvidence": "artifacts/coverage/1447496205282549761-review-r126.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  382
                ],
                "nativeRevisits": [
                  1,
                  20,
                  175,
                  345
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "不规则三角底图（四边格单对角线切分）+ 三角底图上的软坡/河道/湖 运行验收"
              }
            },
            {
              "name": "球面投影：径向索引/平面抽样与球面拓扑分开",
              "id": "1338829205157646336",
              "status": "done",
              "where": "src/sphere/stereo-insert-c06.js · src/sphere/planet-town.js · sphere-insert.html · planet.html?stage=tri",
              "page": "planet.html?stage=tri",
              "note": "316帧全核（4张联系表+原尺寸回看，中心暗面3–4×放大确认是球体遮挡而非空洞）；球极投影按半径插入（超级三角→逐点→视图拉远）、抬回闭合球网、松弛每轮重三角化全在；本轮补极点鲁棒性 poleGuard（旧路径极点重合直接 RangeError、次北点 1e-4 rad 时 r=2.00e4 → 换极点后 6.53、收敛 3.06e3×，真旋转 det=+1、重合点合并），新测 tests/sphere-pole-guard.mjs + tests/sphere-insert-guard-browser.cjs（396面=2n−4、Euler 2、往返 1.17e-15、fat 档 394面 merged 1、0 error）",
              "decodedFrames": 316,
              "reviewEvidence": "artifacts/coverage/1338829205157646336-review-r118.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  315
                ],
                "nativeRevisits": [
                  45,
                  125,
                  160,
                  200,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球极投影插入回放/抬回球网/投影往返/极点鲁棒性/松弛重三角化：逻辑+浏览器双验收"
              }
            },
            {
              "name": "完美环：直线绕回起点时检测出来；飞岛玩法没做",
              "id": "1313837640366596096",
              "status": "done",
              "where": "src/world/flying-town-c06.js（hullSkin/legBraces/propSlots + attachFlyingTown）· src/core/loop-lift.js · index.html?flying=1",
              "note": "315帧全核（4张联系表+3张3倍裁切）；完美环判定 + 环内整列体素（地形116建筑+400岩石）一起抬升=建筑随岛抬升，环内最低实心层=4=lift+1、1–3层全空、环外仍贴地；船壳按原片重做形制：黄鼓边带+红舷缘+99舷窗，外沿28个黄短舱各4片白桨叶（112片），腿改锥形柱+每腿2条斜撑（56腿112撑）+放大涟漪，船壳下56榀桁架摇篮；像素A/B关桨叶白像素2103→503、噪声0px、差分11670px；片中无飞行操控镜头（纯转台），不计缺口；板缝/铆钉与抬升侧壁厚度属造型差",
              "decodedFrames": 315,
              "reviewEvidence": "artifacts/coverage/1313837640366596096-review-r127.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  314
                ],
                "nativeRevisits": [
                  0,
                  60,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主场景 index.html?flying=1 运行验收：船壳皮/桨位/斜撑腿/摇篮几何台账 + 整列抬升数据面 + 桨叶像素A/B"
              }
            },
            {
              "name": "无限、确定、无缝的松弛四边形网格：一块块六边形冒出来",
              "id": "1151137783785771008",
              "status": "done",
              "where": "src/core/infinite.js#createInfiniteStream + src/core/infinite-c06.js#streamWindow/densityStats · infinite-stream.html（流式窗口）",
              "page": "grids.html",
              "note": "449帧全核；真流式加载核实为过期账（createInfiniteStream+streamWindow(evict)+infinite-stream.html r56 就在，缺的是浏览器验收）：真指针拖焦点→累计拓扑 7→45 块，沿 x 走 0→200 累计 57→224 块而缓存恒 30–37、丢弃 20→194、每步接缝 ≤2.8e-14、翻折 0；半径 14 时 19 块/3936 格。原记的疏密均匀度为真缺口，已补 densityStats：面积比 p10/p50/p90 0.80/1.00/1.19（1.48×、CV 0.141）、边长 CV 0.155、块均值 CV 0.006 vs 块内 0.141（看不出块边界）；同一口径两边量：原片 CV 0.216/1.83× vs 本仓 0.272/2.14×（如实口径，格子大小差大一档）。新测 tests/infinite-stream-browser.cjs + 页面读数；regression infinite-c06/infinite-stream/infinite-window/infinite-area-pull/r50-page-entries 全 PASS。",
              "decodedFrames": 449,
              "reviewEvidence": "artifacts/coverage/1151137783785771008-review-r135.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  448
                ],
                "nativeRevisits": [
                  1,
                  200,
                  350,
                  448
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "无限四边形网格：按焦点按需最终化、远处缓存丢弃、块间无缝无翻折、块内疏密均匀度"
              }
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974564862729838592",
              "status": "done",
              "where": "src/core/spatial.js#baryPrep3 · src/world/bary-gizmo.js · bary-gizmo.html · tests/bary-gizmo-3d-browser.cjs",
              "page": "grids.html?t=infinite",
              "note": "478帧全核（5张联系表+原尺寸0060/0200/0330）；灰模三角网上一个白球带RGB轴箭头，光标压在球上真拖拽：球可在三角面内拖动、可越出三角形露出负权重、可抬离平面，投影点到三顶点红绿蓝连线、顶点球径∝权重，三角形可拉窄张开。本轮把 3D gizmo 补全并出运行验收：bary-gizmo.js 加 attach()真指针拖拽（抓球改u/v、抓第三顶点改spread、Shift+拖球沿法线抬h，轴向用射线-轴线最近点）、params/state/triArea/dragStats 台账、三角边改细盒加粗、选格按周边空旷度；bary-gizmo.html 补背景三角网/机位钉住/hud=0/启动竞态。新测 tests/bary-gizmo-3d-browser.cjs 27/27：Σw=1(1.1e-16)、Cramer差1.1e-16、|P-面|=h、拖球落点u=0.72v=0.14、拖出后inside=false w=[0.87,-0.22,0.35]、spread1→1.4面积比1.39996线性、Shift抬升h+>0.1、像素A/B 2969px噪声0、0 console error",
              "decodedFrames": 478,
              "reviewEvidence": "artifacts/coverage/974564862729838592-review-r128.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  477
                ],
                "nativeRevisits": [
                  1,
                  220,
                  477
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "任意朝向平面 3D 重心（面内/面外/离面高度）+ 真指针拖拽 + 像素A/B"
              }
            },
            {
              "name": "局部规则/放射模板：324帧核验，单补丁共享接缝；复杂孔洞拒绝、多模板待补",
              "id": "1301816247479345152",
              "status": "done",
              "where": "src/core/radial-patch.js#insertTemplatePatch（环带厚度均分 + ringSpacing/minRingRadius/holeRingRadius 读数） · gridpatch.html（原片口径深链 r2.6/hole.6/rings5 + 外环带/过渡带分开报）",
              "page": "gridpatch.html",
              "note": "324帧全核（4张联系表 + 0106/0135 原尺寸 2.2× 复核）；生成网格→局部替换成手制规则模板这条主线 r55/r142 已在（inserRadialPatch/insertTemplatePatch/insertRadialPatches/migrateWorldToPatch + ?gems=N）；r143 收掉最后一条：环院环带按 s=(minR−holeR)/(rings+2) 均分整个 boundary→hole 厚度（旧式把 rings 条带挤进 45% 再被拉链+洞环切成两条，每条径向厚 0.05 vs 弦长 0.45），courtyard 格长宽比中位 0.257→0.595、细长格 151/197→32/268、外环带 230 格只 9 个（全在星形边界拐角）、洞内原格几何逐点未动；试过 r142 建议的严格等角目标环→不规则边界第一圈翻折（2 配置直接拒绝）且只抬到 0.620，已回退并记录；新测 gridpatch-rings-browser.cjs ALL PASS（五配置几何 + 主场景 ?gems=0|4 像素 A/B 563710px + 0 error）+ 4 个 node 回归 PASS",
              "decodedFrames": 324,
              "reviewEvidence": "artifacts/coverage/1301816247479345152-review-r143.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  323
                ],
                "nativeRevisits": [
                  1,
                  35,
                  106,
                  135,
                  240,
                  324
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "环院/放射补丁的环带几何：环数、辐条、格长宽比、接缝共用、洞内原格不变、主场景多补丁"
              }
            }
          ]
        ],
        [
          "水层",
          [
            {
              "name": "彩色中间倒影 / 更宽浪裙",
              "id": "1215644531221311488",
              "status": "done",
              "where": "src/water/planar-reflection.js · src/water/shore.js#buildShore(skirtWidth) · src/world/view.js",
              "toggle": "waves",
              "note": "270帧全核；同一条RTT平面反射（倒影层quad 11281px/镜像命中92.1%/真水面98.5%），另加 shore.js#skirtWidth 可配（1→1.6 外扩精确1.6×）+ view.setSkirtWidth/?skirtWidth；r180裙带亮缝账回归PASS",
              "page": "reflection.html",
              "decodedFrames": 270,
              "reviewEvidence": "artifacts/coverage/1215644531221311488-review-r182.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  269
                ],
                "nativeRevisits": [
                  165,
                  240
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平面反射+岸裙宽度"
              }
            },
            {
              "id": "1758250248483278925",
              "status": "done",
              "where": "src/water/planar-reflection.js · src/world/view.js · index.html?scene=terrain",
              "note": "516帧全核；RTT平面反射落地（镜像相机+斜近平面+水面屏幕空间UV，uReflTint=0.45 做中间色），倒影层5902px/镜像命中69.9%/真水面98.8%/水线泄漏0/噪声0；旧镜像双网格改为常隐且修好无cloud uniform时shader编译失败",
              "page": "reflection.html",
              "decodedFrames": 516,
              "reviewEvidence": "artifacts/coverage/1758250248483278925-review-r182.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  515
                ],
                "nativeRevisits": [
                  10,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平面反射投影/遮挡/中间色"
              },
              "name": "新水面反射：多组岛屿对照"
            },
            {
              "name": "距离场浪裙",
              "id": "1664566546683899905",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-profile.js · src/water/shorefield.js · tests/shorefield-referee.mjs",
              "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过。buildShoreDistance API残差核销（2026-11-25，r211）：裁判 engine/shorefield.js 逐式移植为 src/water/shorefield.js（格心rasterise+两遍1/√2 chamfer+双线性sample+0.75·res步进/12次二分march，返回{sample,march,res,origin,size}同形+另挂w/h/land/field诊断），补 tests/shorefield-referee.mjs 裁判对拍——两套真实双网格（裁判buildGrid 762格/场222²、本仓buildQuadGrid 1052格/场170²）sample共449,488点逐位一致（maxDiff=0）、march 128射线逐位一致、REACode Town与core/town-graph Town互换逐位一致、重跑确定；shore消费路径（traceShoreLoops+sampleShoreline+march）268岸点端点|field−target|≤1.2e-5。差异如实标：内部索引用core/spatial buildCellIndex（桶2/所在桶 vs 原版桶4/3×3邻域，同为含点格子的超集）、pointInQuad按n角巡边（四边形逐式相同）、补RangeError验参与4M栅格预算；不融合进shore.js（其内部场有shape形变定界），sample/march同签名可平替注入。剩余残差：对拍对象为本仓裁判的重构实现，Oskar原作真实距离场算法未公开，无可执行迁移项。；【卡点·C 算法未公开】原作距离场浪裙真实算法未公开 → 卡在原片算法未公开：配文只说\"distance field-like\"不附算法，画面也不足以反推，只能近似；本仓裁判实现已逐式移植并对拍核销；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 340,
              "reviewEvidence": "artifacts/coverage/1664566546683899905-shorefield-r211.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  339
                ],
                "nativeRevisits": [
                  80,
                  210
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "独立原版buildShoreDistance API移植+裁判逐位对拍（sample/march maxDiff=0）+岸环消费兼容"
              }
            },
            {
              "name": "岸线黄线 / 外推蓝线",
              "id": "1849732997945110651",
              "status": "done",
              "where": "src/water/shore.js · src/water/foam-mask.js · src/world/view-c10.js · ?c10=foammask,shoreclamp",
              "toggle": "shorelines",
              "note": "437帧全核；黄线岸脚/蓝线外推平滑（6遍邻域平滑+拒绝落回陆地）/浪带蓝→黄→回弹、各段相位不同、0270起红三角线框逐段推进、岸脚碎白泡沫全见；三件缺口（全局泡沫mask·折叠消解·浪带全路径防穿岸）核实为已在 foam-mask.js/view-c10.js 且本轮出真View运行验收（穿岸 mixed 8.44%→2.23%/quad 11.70%→0.92%，泡沫带内孔洞 78.6%/80.5%，t=0蓝线9e-6·t=0.68黄线0·回弹沿aOut 2.8e-17·峰值0.2197）；折叠消解核实为原作现象不列缺；残差仅浪形/配色替身",
              "decodedFrames": 437,
              "reviewEvidence": "artifacts/coverage/1849732997945110651-review-r179.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  436
                ],
                "nativeRevisits": [
                  0,
                  270,
                  300,
                  436
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸线黄/蓝线、浪带循环、防穿岸、泡沫遮罩"
              }
            },
            {
              "name": "循环顶点着色器岸浪（新项目）",
              "id": "1991101097818403263",
              "status": "done",
              "where": "src/water/shore.js · src/core/wave-cycle.js · src/water/foam-mask.js · ?c10=shoreclamp",
              "toggle": "wavewire",
              "note": "477帧全核；低机位贴水，白浪带逐段爬岸/退浪、各段相位不同，0128起长房、0290硬切成方块测试地形仍同形；循环顶点着色器+生成时烘入 in/out/时间偏移全在 shore.js（aIn/aOut/aPeriod/aPhase/aCrest/aWidth），本轮出真View运行验收：t=0落蓝线6.5e-6、t=0.68落黄线0、退浪位移精确=aOut·cycle.y 5.6e-17、峰值0.2197、同一uTime进/退顶点58.3%/41.7%（不是齐步走，row-0 515种相位）、crest绕圈接缝0/峰11、碰撞档穿岸11.70%→0.92%；残差仅原片浪形/配色",
              "page": "waves.html",
              "decodedFrames": 477,
              "reviewEvidence": "artifacts/coverage/1991101097818403263-review-r179.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  476
                ],
                "nativeRevisits": [
                  0,
                  148,
                  290,
                  476
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "循环顶点着色器·烘入in/out/时间偏移·退浪回弹·防穿岸"
              }
            },
            {
              "name": "中间色倒影",
              "id": "1215644531221311488",
              "status": "done",
              "where": "src/water/planar-reflection.js · src/water/shore.js#buildShore(skirtWidth) · src/world/view.js",
              "toggle": "reflection",
              "note": "270帧全核；同一条RTT平面反射（倒影层quad 11281px/镜像命中92.1%/真水面98.5%），另加 shore.js#skirtWidth 可配（1→1.6 外扩精确1.6×）+ view.setSkirtWidth/?skirtWidth；r180裙带亮缝账回归PASS",
              "page": "reflection.html",
              "decodedFrames": 270,
              "reviewEvidence": "artifacts/coverage/1215644531221311488-review-r182.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  269
                ],
                "nativeRevisits": [
                  165,
                  240
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平面反射+岸裙宽度"
              }
            },
            {
              "name": "叠片采样 SDF 的水体",
              "id": "1758251637280268481",
              "status": "done",
              "where": "src/water/watervol.js · src/water/land-distance.js",
              "toggle": "watervol",
              "note": "213帧全核验：小岛镜头降到水面，线框/倒影随角度变化；原文说叠平面采SDF，未说明维度。保留本地浅水近似，补各向异性精确2D中心距离、level1遮罩、版本缓存/空场清理/共享资源释放，实际双网格通过；不同于原片完整反射效果。；【第62轮 A 类收敛】残差=原片完整反射观感，SDF 叠平面+各向异性中心距离机制已落地并双网格通过，判为 done",
              "decodedFrames": 213,
              "reviewEvidence": "artifacts/coverage/water-patch-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  212
                ],
                "nativeRevisits": [
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": ""
              },
              "page": "index.html?scene=town&on=watervol"
            },
            {
              "name": "瀑布：河从崖边落下的水帘 + 白沫",
              "id": "1007587812462530561",
              "status": "done",
              "where": "src/water/waterfall.js · index.html?scene=badnorth（面板「瀑布」）",
              "toggle": "waterfalls",
              "note": "682帧全核；水帘从崖唇贴壁垂到海面+底部白沫，面板「瀑布」开关可见；缺下宽外扩/不规则碎沫/细冰棱分流",
              "decodedFrames": 682,
              "reviewEvidence": "artifacts/coverage/1007587812462530561-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  681
                ],
                "nativeRevisits": [
                  1,
                  250,
                  500,
                  681
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "瀑布水帘与白沫"
              }
            },
            {
              "name": "船迹：固定时间采样/世界轨迹，原片泡沫喷溅仍待补",
              "id": "901469409579061248",
              "status": "done",
              "where": "src/life/boats.js（corridor 切档 + 平行带状边线 + wakeProbe）· src/core/wake-sampling.js（advanceWake corridor / wakeFade / wakeLife / profile）· wake-fog.html ?wake= · src/world/view.js",
              "toggle": "boats",
              "page": "wake-fog.html",
              "note": "138帧全核（sheet-00/01 + 0060/0120 4×裁切）：边线平行走廊、间距≈船宽3-4倍不张开，线间成排断续泡沫、远端先没泡沫后没边线，船头一小撮白。r183 只把 corridor 档写进模块，boats.js 仍跑 V → 本轮真切档：advanceWake corridor（固定横偏不外推）+ 带状 alpha 与粒子共用 wakeFade（边线 .85 / 泡沫行 1.75 两条幂律）+ wakeLife 按船长标定（边线 3.2 / 泡沫 1.5 船长，夹 1.2-6.4s）+ 船头泡沫 0.15-0.25 beam + FX_MAX 1600→2600（旧值顶到 1600 会截远端），view.js ?wake=v / wake-fog.html 下拉作 A/B。验收 mixed/quad：间距 0.5440 逐段 CV<1e-9、reach 边线 3.76/3.65 vs 行 1.10、泡沫点 1040/1122 未截断、压陆地 0、同页 V 档对照张开 5.99×、0 console error；node tests/boats-wake-corridor.mjs + wake-corridor.mjs + wake-particles.mjs 全 PASS，回归 wake-fog-browser PASS。仅剩美术差：原片连通环蜂窝 vs 本仓方块点阵。",
              "decodedFrames": 138,
              "reviewEvidence": "artifacts/coverage/901469409579061248-review-r184.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  137
                ],
                "nativeRevisits": [
                  1,
                  60,
                  120,
                  137
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "尾迹形制（平行走廊·断续泡沫·长度标定淡出·船头泡沫）+ 主场景与页面切档运行验收"
              }
            },
            {
              "name": "动态海面但不抢戏：极低幅度的颜色漂移",
              "id": "1991103578011029507",
              "status": "done",
              "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
              "note": "529帧全复核：固定教堂岛，主要动态为分段白色近岸浪；不把“克制动态海洋”推断为现有整片海面颜色漂移公式。保留本地背景处理但纠正归因，新增可开关沿岸周期分段浪峰，实际双网格GPU对照通过。；【第62轮 A 类收敛】残差=完整浪形与碰撞，分段近岸浪峰机制等价且双网格 GPU 对照通过，判为 done",
              "page": "waves.html",
              "decodedFrames": 529,
              "reviewEvidence": "artifacts/coverage/wave-crest-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  528
                ],
                "nativeRevisits": [
                  0,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": ""
              }
            },
            {
              "name": "新的岸浪",
              "id": "1991099314714902634",
              "status": "done",
              "where": "src/water/shore.js（aArc + skirtCoverage/skirtBreakGLSL + DoubleSide）· src/world/view.js（共享 uTime + skirtStats）· src/world/app.js（?skirt=plain）· waves.html",
              "note": "545帧全核（sheet-00/02 复看 + f0180/f0300 原尺寸，r56 已全片逐格核过）：片内岸线白带**是分段的** —— 有浪的岸段实心白、段间水体直接贴岩脚，白块沿岸滑移且宽度来回胀缩（分段展开/聚散）。原状裙带沿全岸 100% 常亮、把浪带的分段盖住 → 本轮给裙带烘 aArc + skirtCoverage 整数谐波（3u/7u，接缝 2.33e-15、amp 呼吸 + 相位漂移），shader 按 uSkirtBreak 混回常亮；顺带修 FrontSide 背面剔除（单面 2170px vs 双面 35481px）；waves.html 补「裙带分段」「泡沫遮罩+防穿岸」两开关与读数。读数：9/12 段、缝隙 42.9%↔27.8%、GPU 分桶 32.6 vs 98.8、关档 128.6/115.8、差分 21675px、噪声 0。",
              "page": "waves.html",
              "decodedFrames": 545,
              "reviewEvidence": "artifacts/coverage/1991099314714902634-review-r180.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  544
                ],
                "nativeRevisits": [
                  0,
                  180,
                  300,
                  544
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸线白带分段/缝隙漂移与胀缩 + 裙带正反面 + 页面读数"
              }
            },
            {
              "name": "岸浪：许多重叠的浪各走各的周期",
              "id": "1849730611964973481",
              "status": "done",
              "where": "src/water/foam-mask.js · src/world/view-c10.js · index.html?c10=foammask,shoreclamp",
              "note": "599帧全核；泡沫mask（噪声切碎斑块，非整圈实心白边：带内21.8%覆盖、孔洞>50%、屏幕A/B 5251px）与窄湾浪带防穿岸（8.44%→2.23%，收回136顶点）补运行验收通过；残余2.2%是0.04栅格边界余量",
              "page": "waves.html",
              "decodedFrames": 599,
              "reviewEvidence": "artifacts/coverage/1849730611964973481-review-r178.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  598
                ],
                "nativeRevisits": [
                  1,
                  480,
                  598
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸脚碎斑泡沫 + 窄湾浪带防穿岸"
              }
            },
            {
              "name": "岸线渲染：Bad North / Townscaper 那套的改良版（距离场浪裙）",
              "id": "1666429884208381953",
              "status": "done",
              "where": "src/water/shore.js · src/water/foam-mask.js · src/world/view-c10.js",
              "note": "630帧全核；岸裙+浪带本体早有，本片两条遗留（蓝线窄湾交叠 / 泡沫mask）核实为缺运行验收：?c10=shoreclamp 使穿岸 11.70%→0.92%（收回204顶点）、?c10=foammask 出碎斑泡沫（带内孔洞>50%、屏幕A/B 5594px、噪声0）",
              "page": "shoreloops.html",
              "decodedFrames": 630,
              "reviewEvidence": "artifacts/coverage/1666429884208381953-review-r178.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  629
                ],
                "nativeRevisits": [
                  1,
                  500,
                  629
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸裙浪带 + 窄湾防穿岸 + 泡沫遮罩"
              }
            },
            {
              "name": "整个项目放到水上：小镇场景就是水上码头",
              "id": "1215642481162887168",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
              "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。2026-11-25残差核账（tests/water-town.mjs 四场景锁定）：水上码头=1层灰石基座自y=0入水外鼓+压顶铺地+临水栏杆；水上悬浮块=钢腿端停y=0水面、逐角posts锚点交shore.js画泡沫圈；跨水拱=两对边1层码头支撑悬浮块→archFloorBudget(floor=0)+archProfile解析椭圆，端点/拱顶精确、形变误差有界——旧账「拱底精确截面」已随arch-profile批落码属过期；种子镇seed330一次齐出码头/拱/后院/水上钢腿房。真实双网格2→1闭环及恢复小镇保留（shore-topology-review.md）。完整建造美术仍缺。；【卡点·B 美术资产】完整建造美术仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r221核销：tests/water-town.mjs 四场景复跑全过、机制五文件（shore/shore-loops/townDemo/arch-floor-budget/arch-profile）vendor 逐字一致；剩余残差仅「完整建造美术」=原片未公开资产，无可执行残差，永久卡点，需新证据再立项",
              "page": "shoreloops.html",
              "decodedFrames": 330,
              "reviewEvidence": "artifacts/coverage/1215642481162887168-review-r221.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  329
                ],
                "nativeRevisits": [
                  3,
                  60,
                  160
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "水上码头/钢腿泡沫锚点/跨水拱精确拱底/岸线闭环与倒影（tests/water-town.mjs 锁定）；残差=完整建造美术（卡点·B，r221核销为永久卡点）"
              }
            },
            {
              "name": "浮点GPU能力探测",
              "id": "1664565063552847873",
              "status": "done",
              "where": "src/world/float-bands.js · float-bands.html",
              "page": "float.html",
              "note": "117帧全核（2张联系表+3张原尺寸，第198轮已看，本轮复核）；片内=平流场按 plasma 色带铺在真实几何上。旧note的『缺假彩色可视化页』本轮收口：新建 src/world/float-bands.js（clone view.worldMesh.geometry 12854 三角 + RGBA float 纹理 + 片元世界 xz 采样 + CPU 孪生调色板）+ float-bands.html；新测 tests/float-bands-browser.cjs 11/11：色带占 76% 且天空不着色=非全屏quad、色相 18 档/相邻跳变 0.36%、120 步变化 63.6%、GPU 与 CPU 孪生 76/77 点 Δhue<12°（中位 0.00°）、8级量化A/B把档塌到 10、噪声 0。仍非流体求解器（固定涡旋无散度投影），跨平台信任不可验",
              "decodedFrames": 117,
              "reviewEvidence": "artifacts/coverage/1664565063552847873-review-r202.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  116
                ],
                "nativeRevisits": [
                  0,
                  58,
                  116
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "假彩色色带铺面（真实 World 几何 + 浮点纹理 + CPU 孪生对表）；不含流体求解器与跨平台矩阵"
              }
            }
          ]
        ],
        [
          "光照",
          [
            {
              "name": "551帧分层AO：实际遮蔽/反弹分离对照",
              "id": "1168571866405097472",
              "status": "done",
              "where": "src/world/worldmesh.js · src/light/bake.js · src/light/field-cache.js · src/world/view-shading.js · tests/ao-field-cache.mjs · ao-stages.html",
              "toggle": "ao",
              "page": "ao-stages.html",
              "note": "551帧全核，保留分层烘焙，已有实际遮蔽/反弹分离对照及恢复验收；逐顶点通道分离读数：bakeLighting({channels}) 输出 ao/bounce/air/sun 四通道，≤1e-6 重构顶点色，与仅遮蔽/仅反弹参数隔离两次烘焙逐值一致、裁判 bakeVertexAO 同式线性可分（tests/ao-split-channels.mjs）；本轮核销残差「原GPU重投影/动态纹理」：bake.js 拆出 buildOcclusionField（keepRaw 底片 + cellWriteRect/clearRect/restamp/refreshBits/reblur 增量钩子），新增 src/light/field-cache.js LayeredFieldCache 对齐只读裁判 lightingcache.js（逐格签名 diff → 脏矩形清零 → 按 world.cells 原序重投影 → 窗口化重模糊，签名比裁判多记 rock+shape.at），view-shading voxelfield/voxelnormals 改吃常驻场（stats.voxelfield.update 记 mode/dirty/rect/blurMs）；tests/ao-field-cache.mjs 增量≡全量逐纹素 maxDiff=0、写回区外字节不动、bakeLighting({field})/channels/packLayeredField 同源、形变签名判脏；ao-field-cache-browser PASS（首建 full→纹理、编辑→dirty 1 格、verify badTexels 0）；机制等价裁判实现，判为 done",
              "decodedFrames": 551,
              "reviewEvidence": "artifacts/coverage/ao-stages-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  550
                ],
                "nativeRevisits": [
                  30,
                  76,
                  153,
                  270,
                  450,
                  550
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地分层烘焙+常驻场逐次重投影+GPU顶点采样；机制等价裁判 lightingcache，非原GPU实现内部"
              }
            },
            {
              "name": "彩色反弹光",
              "id": "1237305125070426112",
              "status": "done",
              "where": "src/light/bake.js（occ/cr/cg/cb 模糊 + bounce 0.42）· src/world/worldmesh.js 分块烘焙",
              "toggle": "ao",
              "note": "258帧全核（3张联系表 + 原尺寸0040/0200 + 2.6×裁剪）；彩色反弹等价：白墙同面靠蓝屋R-B=-20.8、中央+17.6、靠红屋+4.6；验收红/蓝对照 warmJump+0.0373 / coolJump-0.0605；差在反弹是全向模糊平均、贴墙边角不如片中重，且只有1次反弹",
              "decodedFrames": 258,
              "reviewEvidence": "artifacts/coverage/1237305125070426112-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  257
                ],
                "nativeRevisits": [
                  0,
                  40,
                  200,
                  257
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "白墙被邻居色染色的单次彩色反弹，非多次互反射"
              }
            },
            {
              "name": "柔和投影",
              "id": "1305948413872267265",
              "status": "done",
              "where": "src/world/view.js（#setupLights / requestShadowUpdate / render 阴影节奏）· index.html 环境面板「柔和投影」",
              "toggle": "shadows",
              "note": "715帧全核；投影软硬与更新时机都对齐了：PCFSoft 的 shader 忽略 shadow.radius（实测 radius 1→8 过渡像素 100→100 不变），改 PCFShadowMap 后 90→541；autoUpdate=false + requestShadowUpdate，平移网格不叫就留旧影、叫了才追上；仍缺：暗部幅度比片中亮一档、无 less-contrast 档、水面影子另走 ShadowMaterial",
              "decodedFrames": 715,
              "reviewEvidence": "artifacts/coverage/1305948413872267265-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  714
                ],
                "nativeRevisits": [
                  0,
                  350,
                  714
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "投影柔和度 + 按需更新"
              }
            },
            {
              "name": "时段 / 夜里亮窗 + 太阳方位小工具",
              "id": "1313840428685447170",
              "status": "done",
              "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
              "toggle": "time",
              "note": "501帧全核验：二维太阳盘与滑条改变光照，夜间窗户亮，457附近恢复白天。保留原有日夜/太阳方位，补方位+高度控制共享真实View及水面三场阴影；不是复制原界面或完整地平线日照模拟。；【第62轮 A 类收敛】残差=原界面与完整地平线日照，二维太阳盘+方位高度控制机制等价（含水面三场阴影），判为 done",
              "page": "penumbra.html",
              "decodedFrames": 501,
              "reviewEvidence": "artifacts/coverage/penumbra-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  500
                ],
                "nativeRevisits": [
                  210,
                  310,
                  457
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": ""
              }
            },
            {
              "name": "只看光照（调试视图）",
              "id": "1313841094069817344",
              "status": "done",
              "where": "src/world/view.js（uTextureOnly / lightonly / textureonly）· src/ui/environment-panel.js",
              "toggle": "lightonly",
              "note": "268帧全核；原来只有 lightonly 且无任何面板入口，texture-only 完全缺。补 uTextureOnly（outgoingLight=albedo，短路光照）+ 两个模式互斥 + 场景面板三开关；实测只看贴图时主体掩码内只剩13.9%随投影变、只看光照仍有94.95%（影子在）且顶点色关掉、主体饱和度0.4244→0.2083；仍缺：树/海鸥/水面接收层不跟白模，灯塔灯室也不变白",
              "decodedFrames": 268,
              "reviewEvidence": "artifacts/coverage/1313841094069817344-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  267
                ],
                "nativeRevisits": [
                  46,
                  140,
                  155,
                  210
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "texture-only 与 light-only 两个渲染模式"
              }
            },
            {
              "name": "墨线（反向外壳描边）",
              "id": "1751945034851570056",
              "status": "done",
              "where": "src/world/outline.js · index.html?scene=fusion",
              "toggle": "outline",
              "note": "282帧全核；rim=第二层反向外壳，仅太阳在岛后时出现在剪影迎光侧；修掉 into 用相机俯仰向量导致恒 0 的 bug，改按水平方位门控（四档实测 0/0/1988/3376 px）；缺真 shadow map 遮罩",
              "decodedFrames": 282,
              "reviewEvidence": "artifacts/coverage/1751945034851570056-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  281
                ],
                "nativeRevisits": [
                  1,
                  120,
                  270
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逆光亮边：门控/宽度/与墨线层次"
              }
            },
            {
              "name": "逆光亮边（第二层外壳，迎着太阳才出现）",
              "id": "1751945034851570056",
              "status": "done",
              "where": "src/world/outline.js · index.html?scene=fusion",
              "toggle": "backlit",
              "note": "282帧全核；rim=第二层反向外壳，仅太阳在岛后时出现在剪影迎光侧；修掉 into 用相机俯仰向量导致恒 0 的 bug，改按水平方位门控（四档实测 0/0/1988/3376 px）；缺真 shadow map 遮罩",
              "decodedFrames": 282,
              "reviewEvidence": "artifacts/coverage/1751945034851570056-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  281
                ],
                "nativeRevisits": [
                  1,
                  120,
                  270
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逆光亮边：门控/宽度/与墨线层次"
              }
            },
            {
              "name": "软法线：弯曲崖壁变圆、崖顶仍硬（Bad North 体素法线）",
              "id": "1062374549407350790",
              "status": "done",
              "where": "src/core/meshwriter.js · src/terrain/terrainmesh.js",
              "note": "780帧全核；软法线=同位置软三角形按55°阈值平均，崖壁圆润/崖口保持硬，实测30°折平均到cos15°、90°不平均；仍缺网格级松弛与软硬对比页",
              "decodedFrames": 780,
              "reviewEvidence": "artifacts/coverage/1062374549407350790-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  779
                ],
                "nativeRevisits": [
                  1,
                  100,
                  175,
                  400,
                  779
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "软法线平均与硬边阈值"
              }
            },
            {
              "name": "平滑 / 硬法线混合（屏幕空间导数算硬法线）",
              "id": "929417420921556993",
              "status": "done",
              "where": "src/world/view.js（uNormMix）· normals-blend 实验页",
              "toggle": "hardnormal",
              "note": "256帧全核；片中无对照/无字幕，仅靠转角柔和过渡判读；uNormMix=0.8 与原文同法（dFdx/dFdy 求面法线后 mix），三档截图差异已量（0.8 偏平滑侧）",
              "decodedFrames": 256,
              "reviewEvidence": "artifacts/coverage/929417420921556993-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  255
                ],
                "nativeRevisits": [
                  107,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "软硬法线混合"
              }
            },
            {
              "name": "逐顶点体素阴影（体素空间里朝太阳走）",
              "id": "1190191289922465793",
              "status": "done",
              "where": "src/world/view.js（computeVoxelShadows / aVox）· index.html 光照面板「体素阴影」",
              "toggle": "voxshadow",
              "note": "199帧全核（2张联系表 + 原尺寸0020/0075 + 2×局部）；逐顶点体素阴影等价：36555顶点朝太阳0.16步进到5.0、背光面记0，GPU开关8738像素只暗不亮；差在暗部只压75%直射、对比明显弱于片中近全黑白模，且无less-contrast档位",
              "decodedFrames": 199,
              "reviewEvidence": "artifacts/coverage/1190191289922465793-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  198
                ],
                "nativeRevisits": [
                  0,
                  20,
                  75,
                  198
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逐顶点体素阴影机制与开关，非白模高对比观感等价"
              }
            },
            {
              "name": "按分辨率加粗描边",
              "id": "1017355723171344385",
              "status": "done",
              "where": "src/world/outline.js（OutlineLayers.update） · index.html?scene=fusion",
              "toggle": "thickoutline",
              "note": "426帧全核；墨线宽度按渲染高度/1080归一+像素比，1080→1.4px、2160→2.8px、thickness 可翻倍，4K 不变细；缺面板勾选（仅 setDebug 入口）",
              "decodedFrames": 426,
              "reviewEvidence": "artifacts/coverage/1017355723171344385-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  425
                ],
                "nativeRevisits": [
                  1,
                  200,
                  425
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "墨线/逆光亮边宽度分辨率自适应"
              }
            },
            {
              "name": "轨道拖影：历史留存按dt换算，轮廓拖抹待补",
              "id": "1727315611959865407",
              "status": "done",
              "where": "src/world/view-post-extras.js（?fx=smear · orbitSmearAt · screenOmegaDt）· src/core/camera-motion.js · index.html?fx=smear&spin=",
              "toggle": "motionblur",
              "note": "337帧全核；环绕相机的解析切向拖影（?fx=smear，单帧6次三角权重采样、v=ω×(p−c)·dt、∝半径、无历史叠加）运行验收通过，并修掉二次色调映射（omegaDt=0 时整屏亮度 130.14→143.75）；stats 补 screenOmega/shutter/taps/maxPx 全指标；原片是否同快门/maxPx 上限不可反推（不计缺口）",
              "decodedFrames": 337,
              "reviewEvidence": "artifacts/coverage/1727315611959865407-review-r153.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  336
                ],
                "nativeRevisits": [
                  1,
                  44,
                  118,
                  131,
                  306,
                  336
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "解析切向拖影：方向/∝半径/随ω/单帧非历史/不偏色"
              },
              "page": "index.html?scene=terrain&on=motionblur"
            },
            {
              "name": "六方向体积：213帧核验，法线采样/太阳DDA；SDF/mega反馈待补",
              "id": "1580845127207387137",
              "status": "done",
              "where": "src/light/megatexture-gi.js · src/light/megatexture-gi-debug.js · src/world/view-c11-megagi.js · megatexture-gi.html",
              "page": "lightvolume.html",
              "note": "213帧全核；原文三张图＝①SDF(alpha=距离/RG=mega UV) ②六向烘焙光体积(射线对SDF步进、命中前空格读RG→图集取纹素) ③被照亮的mega texture，落点实为 megatexture-gi.js（旧 note 指 lightvolume.js 的平均RGB 是其自身口径，非本片）；本轮补六向体积与逐命中取纹素的量具：+Y 1.899 vs −Y 1.090、换太阳后 lobe 能量对背光方向对齐 0.984–1.000、两色世界红侧间接光色相 +0.371/蓝侧 −0.126(sd 0.542)、exitance=反照率×(直射+间接) 误差 2.98e-8；原片 SDF 图帧间 0.000%/六向 7.06%/mega 47.75% 与页面 A/B 同形",
              "decodedFrames": 213,
              "reviewEvidence": "artifacts/coverage/1580845127207387137-review-r137.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  212
                ],
                "nativeRevisits": [
                  1,
                  182,
                  212
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三张调试图语义 + 六向体积方向性 + 命中处按 SDF-UV 取纹素（非平均RGB）+ 第3张=反照率×(直射+体积间接)"
              }
            },
            {
              "name": "地表纹理阴影近似：投射资格与深度比较分开；屋檐/纹理浮凸待补",
              "id": "1705195380457996629",
              "status": "done",
              "where": "src/light/surface-shadow.js · surface-shadows.html",
              "note": "300帧全核；原文「投射高度独立于 z 测试高度 → 只剩草崖边与屋檐」在真 World 上量到：门槛0 覆盖 14.28% → 门槛.6 覆盖 5.46%、崖缘份额 99.8%、别处 1px、同状态 GPU 噪声 0；洞内第二张图 143px。页面补瓦檐抬升/接收面/落点统计，提示语去过期句。如实：地形场景无建筑顶面（檐下 0.0%，屋檐由 surface-shadow-casters 夹具断言）；纹理浮凸与 UV 接缝不覆盖。",
              "decodedFrames": 300,
              "reviewEvidence": "artifacts/coverage/1705195380457996629-review-r203.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  299
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "真 World（mixed/quad）投射门槛两档落点 + 洞内接收面 + GPU A/B"
              },
              "page": "surface-shadows.html"
            },
            {
              "name": "地表纹理阴影近似：投射资格与深度比较分开；屋檐/纹理浮凸待补",
              "id": "1704218784028905984",
              "status": "done",
              "where": "src/light/surface-shadow.js · surface-shadows.html",
              "note": "335帧全核；本条是同一机制的上一档（门槛≈0 的「太 3D」版）：真 World 门槛0 覆盖 14.28%/12.65%，调好后 5.46% 且崖缘份额 99.8%、别处 1px，GPU A/B 12325/8325px 同状态噪声 0。页面入口与本条共用一处改动（瓦檐抬升/接收面/落点统计）。如实：影软边比片内窄（美术差），阴影只铺朝上顶面、不上岩壁立面。",
              "decodedFrames": 335,
              "reviewEvidence": "artifacts/coverage/1704218784028905984-review-r203.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  334
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "真 World（mixed/quad）门槛 0 对比 .6 的覆盖率与落点"
              },
              "page": "surface-shadows.html"
            },
            {
              "name": "半影：阴影画三遍（正常、稍收、大体素）。重构版用 PCF 软阴影，没有三遍叠",
              "id": "1305951750638231552",
              "status": "done",
              "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/penumbra-terrain.js · src/world/view.js · penumbra.html",
              "note": "521帧全核验：塔楼编辑/旋转与长影，409起RGB阴影纹理通道检查。本轮按残差补全两条。a) 洞/悬挑/形变表面：水面层仍是2.5D顶面投影，另接 bakeVoxelPenumbra 体素接收面（PenumbraTerrain，?fx=penumbra3d 或 postExtras.set）——每个下实上空的体素是接收面，悬挑/拱洞下地面与悬挑顶面分列接收者，形变顶面按最近体素层采样并替代PCF接收；真实场景双网格 mixed/quad 6876/5050 接收者、多接收者柱 12/10，转太阳重烘、关闭还原、dispose 材质补丁+纹理幂等通过（tests/penumbra3d-browser.cjs）。b) 半影宽度按裁判 REACode/src/penumbra.js 参数化：权重 [.8,.34,.44]、内收 +0.7 体素高度、3×均值粗格、半影带 .10–.50 封顶12；normal/pulled 与裁判四方位逐格一致，bigSlopeScale=1/3 时带宽对齐 ±8%（带格数 ±10%、alpha 平均差 <1%）。裁判粗格未缩放坡率的 3× 长影仍判尺度差不照抄，默认 bigSlopeScale=1 保世界尺度。如实：侧墙半影仍缺（N·L 明暗负责）、形变面 ±L/2 采样近似、原片演示故意加深故只做到机制口径对齐、无逐像素宽度对照。",
              "page": "penumbra.html",
              "decodedFrames": 521,
              "reviewEvidence": "artifacts/coverage/penumbra-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  520
                ],
                "nativeRevisits": [
                  70,
                  409,
                  445,
                  454
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "体素接收面（洞/悬挑/形变顶面）真实双网格运行验收 + 裁判四方位逐格对齐 + dispose 幂等"
              }
            },
            {
              "name": "平涂 / 着色 / 只看光照 / AO 烘焙网格四种视图：前三种有（面板开关），AO 烘焙网格的可视化没做",
              "id": "1298689301488775169",
              "status": "done",
              "where": "src/world/ao-mesh-debug.js + src/world/view.js setDebug('aomesh') · environment-panel 能力面板",
              "note": "544帧六张联系表全核；平涂/着色/只看光照三种原有，本轮补第四种 AO 烘焙网格（buildBakeShellGeometry 逐层体素壳 608面/1216三角、面板可勾）；缺半透明层叠画法、壳不含建筑体积、原片四小部件界面未复刻；【第62轮 A 类收敛】残差=半透明层叠画法与四小部件界面，AO 烘焙壳机制等价（608 面/1216 三角），判为 done",
              "decodedFrames": 544,
              "reviewEvidence": "artifacts/coverage/1298689301488775169-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  543
                ],
                "nativeRevisits": [
                  10,
                  150,
                  290,
                  340,
                  470,
                  543
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "textureonly / lightonly / aomesh 三视图与面板入口"
              }
            },
            {
              "name": "很基础的光照 + 非真体素的 AO 新做法（画面：灰色城墙模型），即分层 AO 烘焙",
              "id": "1168168400155267072",
              "status": "done",
              "where": "src/light/bake.js · ao-stages.html",
              "note": "811帧全核；分层占用栅格+盒式模糊+顶点采样压暗+邻居色反弹与片中「非体素AO」等价（满遮蔽压到0.62倍，与片中白模最暗2%的0.62一致）；差在与实时光照混用、夹缝压暗偏弱(约12%)",
              "decodedFrames": 811,
              "reviewEvidence": "artifacts/coverage/1168168400155267072-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  810
                ],
                "nativeRevisits": [
                  1,
                  70,
                  170,
                  810
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "分层遮蔽与彩色反弹"
              }
            },
            {
              "name": "共享World用途：碰撞/支撑/梯度诊断，真实风场按实心位保留洞内空气",
              "id": "931196707236392960",
              "status": "done",
              "where": "src/core/world.js · src/core/world-probes.js · src/life/atmosphere.js · flow.html",
              "page": "flow.html",
              "note": "223帧全核（3张联系表+原尺寸0107）；World占用/支撑/梯度探针与Atmosphere逐层真实solid风通洞1.0000对封洞0.9185；片中体素梯度软化网格法线并约束硬边仍未迁移",
              "decodedFrames": 223,
              "reviewEvidence": "artifacts/coverage/world-probes-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  222
                ],
                "nativeRevisits": [
                  0,
                  107,
                  222
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享World占用探针与洞内风场（梯度仅诊断）"
              }
            },
            {
              "name": "GI峡谷：185帧复核，保留体素反弹；形因子/参考接口已核销（剩原片算法未公开永久卡点）",
              "id": "1580835075629133825",
              "status": "partial",
              "where": "src/core/voxel-distance.js · src/light/lightvolume.js · src/light/surface-bounce.js · tests/surface-bounce-referee.mjs · lightvolume.html",
              "page": "lightvolume.html",
              "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。形因子/参考接口残差核销（2026-11-25）：裁判 bouncegi.js 本有真形因子 F=cosI·cosJ·A_j/(r²+pitch²/4)+蒙特卡洛bruteForce+audit，此前批已迁 src/light/surface-bounce.js（split校准、calibration回物理值1，已接 view-shading surfacebounce）；本轮补裁判对拍 tests/surface-bounce-referee.mjs——同一场 directLight 与 bruteForce/hitRate 逐位一致、legacy gather≤1ulp；实测发现裁判第2跳起 src===E 别名的就地Gauss–Seidel语义，bounce 加 inPlace 选项逐位复现（bounces:2 对拍≤1e-6，默认Jacobi差0.13如实记）；裁判峡谷场上 split r 0.501→0.831、形状误差90.4%→43.2%。裁判 makeCanyon 合成岛/renderRay 2.5D渲染仅 bouncelab.html 演示用，本侧由共享World surfaceFieldFromWorld 承接，无可执行迁移项。剩：原片反弹算法未公开，画面不足以证明逆平方/形因子归属。；【卡点·C 算法未公开】原片反弹算法未公开：配文只说\"first decent attempt to actually have the light *bounce*\"，画面不足以反推逆平方/形因子；裁判形因子/暴力参考已迁并对拍核销，本地近似口径如上 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 185,
              "reviewEvidence": "artifacts/coverage/distance-ao-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  184
                ],
                "nativeRevisits": [
                  0,
                  65,
                  100,
                  145,
                  184
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "体素距离场保守步进+DDA兜底、共享体素多跳反弹保留；裁判2.5D形因子gather/暴力参考已迁并逐位对拍（inPlace复现裁判第二跳别名语义）；剩原片算法未公开永久卡点"
              }
            },
            {
              "name": "反弹过程：41帧核验，0/1/3/6次与实测变化；完整往返反馈待补",
              "id": "1580846877855338497",
              "status": "done",
              "where": "src/light/megatexture-gi.js（bakeMegaTextureGI 的 gatherVolume/relightTexture 交替）· src/world/view-c11-megagi.js（showStage/endStages）· megatexture-gi.html（三张贴图 + 慢放/结束按钮）",
              "page": "lightvolume.html",
              "note": "41帧全核（4.18fps/9.56s）；mega texture↔六向光体积交替往返已实现并跑出运行验收：14 步快照里 volume k 只改光体积（贴图改 0 项）、texture k 只改贴图（体积改 0 项），像素台阶 +10.2/+1.16/+0.17/+0.04 级、相对变化 122.87%→5.50%→0.97%，tex3→tex6 仅 3142px（0.3%）对应原文第 3 次后看不出。本轮修两处展示层缺口：慢放阶段漏关 fill 补光（direct 暗像素 0.63%→1.91%）、结束慢放不打断播放循环（加 playToken）；新测 tests/megatexture-bounce-browser.cjs；回归 megatexture-gi.mjs / lightbaker-textures-browser.cjs PASS。原 note 记的『往返反馈未做』核实为过期账。",
              "decodedFrames": 41,
              "reviewEvidence": "artifacts/coverage/1580846877855338497-review-r136.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  40
                ],
                "nativeRevisits": [
                  7,
                  12,
                  19,
                  25,
                  40
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "往返反弹的页面运行验收：单向往返状态断言、慢放入口、主场景逐阶段像素台阶与第 3 轮后收敛"
              }
            },
            {
              "name": "两色点光体积：176帧核验，有限DDA/直接项/移动关闭通过",
              "id": "1582757294672314368",
              "status": "done",
              "where": "src/core/voxel-ray.js · src/light/lightvolume.js · src/world/view.js · lightvolume.html",
              "page": "lightvolume.html",
              "note": "176帧全复核：固定蓝光/移动红光与低分辨率软光。修复点光射线越过光源、零距离及缺少直接点光采样，支持两色累加，View复用aGI缓冲和本渲染器内标记。1500段DDA与双网格真实World移动/关闭通过。CPU按需烘、单RGB体积不是原作完整六方向SDF/mega-texture；形变漏光待补。",
              "decodedFrames": 176,
              "reviewEvidence": "artifacts/coverage/house-point-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  175
                ],
                "nativeRevisits": [
                  0,
                  40,
                  80,
                  130,
                  175
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "法线/SDF/六AO：425帧复核，中心EDT/保守步进/六AO诊断；笔触法线待补",
              "id": "1481661852887265288",
              "status": "done",
              "where": "src/core/paint-normal.js · src/light/lightvolume.js · src/light/megatexture-gi.js · lightvolume.html · megatexture-gi.html",
              "page": "lightvolume.html",
              "note": "425帧全核（sheet-00~04五页 + 原尺寸0000/0150/0220/0300/0424）；原文三件（大笔触法线/3D SDF/±XYZ六向AO）与片子隐含的 mega 反馈四件全部有模块与页面入口，本轮补齐运行验收：?shade=paintnormal 像素A/B 噪声0/差分233109px/回位0（顶点49848不变）；SDF-UV 命中精确穿越面82.5%、反弹122.9%→5.50%→0.97%；块宽/图宽0.20（原片0.15）、块内倾角离散1.1°。旧note两条记为过期账。形态差：原片法线图是网面UV图集、本仓是世界平面周期Voronoi；SDF是体素中心EDT非连续表面SDF。",
              "decodedFrames": 425,
              "reviewEvidence": "artifacts/coverage/1481661852887265288-review-r134.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  424
                ],
                "nativeRevisits": [
                  1,
                  150,
                  220,
                  300,
                  424
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "大笔触法线贴图 + 3D SDF(EDT) + 六向距离AO + SDF-UV→mega texture 往返"
              }
            },
            {
              "name": "球面高度立方体光照：低分辨率6面、顶点单次查询",
              "id": "1791049306213912823",
              "status": "done",
              "where": "src/core/cube-height.js · src/light/cube-height.js · planet.html",
              "page": "planet.html",
              "note": "273帧全核（3张联系表+原尺寸0150）；6x16^2高度CubeTexture顶点单次查询(vertexLookups=1)，9方向GPU误差<0.015；开/关仅差<20/255灰度，片中沟谷近全黑的遮蔽未复现",
              "decodedFrames": 273,
              "reviewEvidence": "artifacts/coverage/cube-height-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  272
                ],
                "nativeRevisits": [
                  0,
                  95,
                  187,
                  272
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "低分辨率高度立方体单次顶点查询（本地暗化公式）"
              }
            }
          ]
        ],
        [
          "多层导航 · 本轮补差",
          [
            {
              "name": "洞内多层可站点、净空与门户边（已接入战斗，精细门户收口）",
              "id": "797119718477991936",
              "status": "done",
              "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/world/fine-portals.js · src/badnorth/battle.js · navigation.html",
              "page": "navigation.html",
              "note": "265帧已复核：模块生成后内部多层活动点。共享 World 多层导航与门户边接入真实Battle（层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格穿洞/封洞验证）；剩余精细门户收口——BattleNavigation finePortals（拱脚收窄 u0≈0.15、形变侧壁、身高门槛封洞、连续扫掠）经 nav-fine-portals 单测、nav-arch-demo 演示页与十二门徒实景管线验收，TigerMessenger 舞台默认开（计划显式 false 可关）；脚高插值（navFooting 踏面 ≤0.167/步、洞底脚贴洞底）同验。合成场地穿拱行走实证：nav-through-synthetic（起点终点分在拱两侧、80 帧轨迹真经拱柱格、开档 0 擦墙帧/关档 7 帧对照）。实景四场景只有死角拱，实景穿洞受场景几何限制（nav-arch-through 实测，非代码缺口）。",
              "decodedFrames": 265,
              "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  264
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "多层可站点/净空/门户边 + 精细门户收窄/形变侧壁/脚高插值（单测+演示页+实景管线+合成轨迹）；实景通路拱场地缺，非本项代码缺口"
              }
            }
          ]
        ],
        [
          "跨帧算法",
          [
            {
              "id": "863019585162932224",
              "name": "跨帧嵌套协程：显式栈、预算、取消与错误传递",
              "status": "done",
              "where": "src/core/coroutine.js · scheduler.html",
              "page": "scheduler.html",
              "note": "566帧全核（6张联系表+3张原尺寸）；画面只能证明跨多帧反复重建（碎片逐帧收拢后整块落位、中间被白雾盖住），嵌套本身不可证；运行 scheduler.html 读数 204/204格·帧26·工作量204·最大显式深度128，每帧8ops → 204/8=26 帧；缺：无对象销毁联动生命周期、单个yield不可抢占、画面不显示调用栈",
              "decodedFrames": 566,
              "reviewEvidence": "artifacts/coverage/863019585162932224-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  565
                ],
                "nativeRevisits": [
                  0,
                  120,
                  368
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "嵌套协程（显式栈/双预算/返回值/异常/取消）与共享World连通性摊帧"
              }
            }
          ]
        ],
        [
          "约束求解",
          [
            {
              "id": "1164926304640229376",
              "name": "确定性socket WFC：真实半边、固定约束与迭代回溯（独立实验）",
              "status": "done",
              "where": "src/core/wfc.js · wfc.html",
              "page": "wfc.html",
              "note": "395帧全核；块体外墙严格贴合地面不规则多边形弯边、0–60帧增量铺开＝任意多边形半边 WFC 交互求解；quad 206格/mixed 147格正倒序同解、回溯0、5.6ms；尚无四子格联合模块约束，绿线调试视图只有等价物",
              "decodedFrames": 395,
              "reviewEvidence": "artifacts/coverage/1164926304640229376-wfc-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  394
                ],
                "nativeRevisits": [
                  1,
                  120,
                  303,
                  394
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "不规则网格确定性 WFC"
              }
            }
          ]
        ],
        [
          "约束修复",
          [
            {
              "id": "793806535898136576",
              "name": "socket局部修复：锁定外部、优先旧值、无解扩区和预算回滚",
              "status": "done",
              "where": "src/core/wfc.js（repairWFC）· wfc.html",
              "page": "wfc.html",
              "note": "65帧全核（1张联系表+原尺寸0025）；片子=困难管道tile集，红线格套盒标冲突/锁定、黄绿标当前格，含3次整片清空重建，对应原文自修复；repairWFC已实现锁定外部+优先原值+逐圈扩区+预算回滚，缺增量传播与建筑多格tile接入",
              "decodedFrames": 65,
              "reviewEvidence": "artifacts/coverage/793806535898136576-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  64
                ],
                "nativeRevisits": [
                  25
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "WFC 局部修复（逻辑+浏览器）"
              }
            }
          ]
        ],
        [
          "几何邻接",
          [
            {
              "id": "795010582239997952",
              "name": "从网格抽边界接口、查询候选与核验半边（完整建筑轮廓另列后续）",
              "status": "done",
              "where": "src/core/adjacency.js · adjacency.html · wfc.html",
              "page": "adjacency.html",
              "note": "151帧全核（2张联系表+原尺寸0006/0040）；片子=白框选中单个建筑构件、黄绿细线勾出该面片轮廓并列绿框候选，即从网格几何抽邻接再查候选，非命名约定；adjacency.js 已实现边焊接/签名/拟合表/内部边排除/非流形诊断，147格510半边与206格824半边审核0不符，缺自动旋转与完整面轮廓碰撞",
              "decodedFrames": 151,
              "reviewEvidence": "artifacts/coverage/795010582239997952-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  150
                ],
                "nativeRevisits": [
                  6,
                  40
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "几何邻接与候选边（逻辑+浏览器）"
              }
            }
          ]
        ],
        [
          "等值线连接",
          [
            {
              "id": "1120036868966502401",
              "name": "不规则网格等值线：共享跨边端点、双线性鞍点及闭环审核",
              "status": "done",
              "where": "src/core/cell-selection.js CellSelection · src/world/app.js 选中态/undoSel·redoSel/applySelectionWindow/pruneSelection · index.html 选择工具格 · src/ui/hud.css #tools · src/world/view.js setGridWindowForSelection",
              "page": "contour.html",
              "toggle": "contours",
              "note": "703帧全核（本轮重抽+sheet-03重看，历轮sheet-00..07与8×裁切沿用）；缺口②收口：编辑器补真选中态（点击/S-/Esc）+多选（Shift/⌘加减）+撤销/重做逐条带回选中快照（平行账本undoSel/redoSel，不动world.snapshot口径）；选中→包围盒→窗口补丁联动，编辑/换场景/清空/撤销后先prune再算窗口；HUD工具按钮原本无onclick且被信息条与进度面板压住，已接线并挪到底部居中；?gridwin=1 开档（须在面板挂载后，否则被setDebug重放改回false）。done",
              "decodedFrames": 703,
              "reviewEvidence": "artifacts/coverage/1120036868966502401-review-r161.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  702
                ],
                "nativeRevisits": [
                  74,
                  300,
                  445,
                  470,
                  620
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "编辑器选中/多选 + 撤销重做联动 + 选中态→窗口补丁（主场景运行验收）"
              }
            }
          ]
        ],
        [
          "近似可见性",
          [
            {
              "id": "810878197134950401",
              "name": "导航图角度采样视线：逐边门户、楼层分离；光学精度不作保证",
              "status": "done",
              "where": "src/core/nav-visibility.js · src/world/visibility.js · visibility.html",
              "page": "visibility.html",
              "toggle": "visibility",
              "note": "174帧全核（2张联系表+原尺寸0100）；片子=棕红岩台上白色采样点+大量点对点白线，连线绕开岩壁缺口、不沿路径拐弯，即导航网格上的廉价近似视线；nav-visibility.js 已实现门户逐边解析相交（无固定步长）、楼层总高差限制与顶点歧义保守停线，mixed 147/quad 166 可见节点，缺光学遮挡与3D光线",
              "decodedFrames": 174,
              "reviewEvidence": "artifacts/coverage/810878197134950401-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  173
                ],
                "nativeRevisits": [
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "导航近似视线（逻辑+浏览器）"
              }
            },
            {
              "name": "三维空间开阔度：64帧全核，固定步长实际World局部验收",
              "id": "798580832906739712",
              "status": "done",
              "where": "src/core/space-visibility.js · src/core/vertex-openness.js · src/world/space-visibility.js · src/capabilities/layers-meta.js · src/capabilities/layers.js · space-visibility.html · index.html?c04=rayvis",
              "page": "space-visibility.html",
              "note": "64帧全核（原注释24帧不符）；原算法即本仓rayvis.js已迁并超出：固定步长/逐格穿行/三角网格光学castMeshRay三级射线开阔度、整楼灰度场bake+逐顶点c04灰度材质、indoorAt室内谓词，能力库world.openness经runPlan接rayvis层消费；原片没拍游戏AI用法，灰度场是诊断口径不声称逐像素光学",
              "decodedFrames": 64,
              "reviewEvidence": "artifacts/coverage/space-visibility-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  63
                ],
                "nativeRevisits": [
                  7,
                  24,
                  42,
                  63
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三维开阔度：固定步长+逐格+网格光学三级，灰度场/逐顶点烘，室内谓词，能力库rayvis层消费"
              }
            }
          ]
        ],
        [
          "墙饰表面",
          [
            {
              "id": "1897266928961700215",
              "name": "墙板底色/线稿/护墙板生成与World表面预览；完整走廊待补",
              "toggle": "doodlewall",
              "status": "done",
              "where": "src/core/doodle-hallway-layout.js · src/build/doodle-hallway.js · src/world/doodle-overlay.js · doodle-hallway.html",
              "page": "doodle.html",
              "note": "108帧全核（sheet-00/01 两页 + 3 张原尺寸）：内转角 + 圆弧 cove 弯进天花 + 分区底色板/窄竖带 + 白竖纹护墙板（顶线随楼梯斜上）+ 拱门（门扇两芯 + 扇窗放射格 + 花边带 + 门上方对称板）+ 楼梯踏步，全片只此一种房间无 UI。note 记的「完整室内/弧顶、门口版式、纹样复杂度」核实为过期账：doodle-hallway-layout.js（文件头署本片 ID）的展开面 (s,v) + 转角断板 + 门位独占一跨 + 密度/镜像全在，r56 只有 node 测试、缺浏览器验收。本轮补 tests/doodle-hallway-browser.cjs：展开贴图逐像素 7 种分区底色、墨线 12.38%、门位内墨点 0px；护墙板顶线斜率 0.3914 vs rise/(s1-s0)=0.3913、残差 0.0025m（非锯齿）、平段 0.96；逐板镜像差 0.0026（关镜像反向对照 0.6576）；?t=0 钉相机后同状态噪声 0px、彩色↔黑白 479986px；共享 World 可选贴面 248 面/1488 顶点、开关差 62318px（offset 抬到 0.012 对照 66189px）。美术差：纹样为程序化替身，非原作手绘鱼群/大狗/蝴蝶结。",
              "decodedFrames": 108,
              "reviewEvidence": "artifacts/coverage/1897266928961700215-review-r145.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  107
                ],
                "nativeRevisits": [
                  1,
                  45,
                  90
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "室内走廊墙饰版式 + 拱门 + 楼梯护墙板 + 共享 World 可选贴面"
              }
            },
            {
              "id": "1890018647655272491",
              "name": "黑白走廊研究：单色表面、稳定布局；弧顶/门口版式待补",
              "toggle": "doodlegray",
              "status": "done",
              "where": "src/core/doodle-hallway-layout.js · src/build/doodle-hallway.js · src/world/doodle-overlay.js · doodle-hallway.html",
              "page": "doodle.html",
              "note": "243帧全核（sheet-00/01/02 三页 + 原尺寸 0060）：与 1897 同一内转角的黑白版 —— 无底色只有墨线、纹样更密、左右镜像（拱门在左上）、窄竖带仍在、护墙板顶线在楼梯段斜上；0084–0119 贴近白门看到门框花边带/两块门芯与深灰侧壁。note 记的「完整室内/弧顶、门口版式、纹样复杂度」为过期账：同一 planHallway 的 mirror:true + density:1.35 早实现，缺浏览器验收。本轮同一支 tests/doodle-hallway-browser.cjs：彩色/黑白 plan 逐字段相同、几何同为 17700 顶点；墨线 13.48% > 彩色 12.38%，彩色底 0 种（彩色版 7 种，证明是关底色不是换灰底）；逐板镜像差 0.0026、关镜像对照 0.6576；整帧差 479986px、同状态噪声 0px。美术差：密度是同一纹样库乘子，不是原作另一套更细的图样。",
              "decodedFrames": 243,
              "reviewEvidence": "artifacts/coverage/1890018647655272491-review-r145.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  242
                ],
                "nativeRevisits": [
                  1,
                  60,
                  242
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "走廊黑白版（密度/镜像）+ 共享 World 可选贴面"
              }
            }
          ]
        ],
        [
          "模块出现条件诊断",
          [
            {
              "id": "1670794261669769217",
              "name": "特定条件模块的有限样本诊断：完整计数/下界/未知分开，不冒充WFC概率",
              "status": "done",
              "where": "src/terrain/features.js · src/core/module-audit.js",
              "page": "patch.html",
              "note": "247帧全核（3张联系表+原尺寸0122）；片子只是已生成结果的绕岛展示（岩拱板+拱洞+小屋+水中倒影），无UI无鼠标无WFC迭代，所以稀有度来自原文而非画面；features.js 已有岩拱，module-audit.js 补有限样本拓扑诊断（4922次候选、命中0/0/1/3均穷尽、预算截断判未知），明确不等于WFC出现概率",
              "decodedFrames": 247,
              "reviewEvidence": "artifacts/coverage/1670794261669769217-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  246
                ],
                "nativeRevisits": [
                  122
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岩拱特征 + 有限样本模块诊断（逻辑+浏览器）"
              }
            }
          ]
        ],
        [
          "WFC过程",
          [
            {
              "id": "865200072685912064",
              "status": "partial",
              "name": "真实候选域过程回看",
              "where": "src/core/wfc.js · wfc-trace.html",
              "page": "wfc-trace.html",
              "note": "908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；本批补逐步轨迹导出：决策帧点名决定格/选定块、矛盾帧点名掏空格与红链，wfcTraceSteps 差分逐帧缩域与回溯重开，Node 验证候选只在矛盾帧后放大；默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。；【卡点·B 美术资产】默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 908,
              "reviewEvidence": "artifacts/coverage/wfc-trace-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  907
                ],
                "nativeRevisits": [
                  0,
                  18,
                  120,
                  360,
                  616,
                  795,
                  907
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地socket求解器真实候选记录与回放，非原图块/全部动作恢复"
              }
            }
          ]
        ],
        [
          "逐帧核验补登",
          [
            {
              "id": "818857408848130048",
              "name": "（无原文）",
              "status": "done",
              "where": "src/core/field-surface.js · field-surface.html",
              "page": "field-surface.html",
              "note": "302帧全核（4张联系表+5张原尺寸）；白模黏土岛形态循环，柱顶半球/崖棱倒角/无一根方格边=占位场模糊后抽等值面，切换时先缩到消失再长成；新建 field-surface.js，做到崩解重组+平滑等值面，缺水面真倒影/暗色碎片/带状水线/坡屋顶细节；【第62轮 A 类收敛】残差=真倒影/暗色碎片/带状水线/坡屋顶细节，等值面崩解重组机制等价，判为 done",
              "decodedFrames": 302,
              "reviewEvidence": "artifacts/coverage/818857408848130048-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  301
                ],
                "nativeRevisits": [
                  1,
                  17,
                  44,
                  122,
                  200,
                  302
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "等值面 + 碎块崩解重组（逻辑+浏览器）"
              }
            },
            {
              "id": "832633189277409280",
              "name": "（无原文）",
              "status": "done",
              "where": "src/core/field-surface.js · src/core/field-surface-c04.js · field-surface-3d.html · tests/field-surface-layered.mjs",
              "page": "field-surface-3d.html",
              "note": "192帧全核（2张联系表+3张原尺寸）；同一工具的带投影录屏，确认地形走等值面、房子是独立硬边几何；【r56 C04 已补 + 本轮核账收口】'地形圆角+建筑硬棱'分层混合在 field-surface-c04.js：layeredPlan 把房子挡在占位场外、housesAt 与地形同一区块时窗缩没/抬升/重长、houseTriangles 出人字屋顶/烟囱/门洞硬边几何，field-surface-3d.html「房子硬边分层」可切回熔化对照，碎块投影/变暗/带状水线/镜像倒影同页在位；本轮新增 houseSupport 足印着座检查，实测修两栋房（A 细柱顶房悬空 1.25 格、B 靠塔房被塔缘埋 1.5 格），新测 tests/field-surface-layered.mjs 6 项（静止态体素一致/闭合/确定性/硬边-圆角对比/着座/时窗同步）PASS，判为 done；残差=原工具精确形态与参数不可知，属已声明近似",
              "decodedFrames": 192,
              "reviewEvidence": "artifacts/coverage/832633189277409280-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  191
                ],
                "nativeRevisits": [
                  1,
                  44,
                  108,
                  192
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "等值面 + 碎块崩解重组 + 地形/建筑分层与着座（field-surface-c04.js · field-surface-3d.html · tests/field-surface-layered.mjs）"
              }
            }
          ]
        ]
      ]
    },
    {
      "key": "build",
      "name": "建筑管线 · Townscaper",
      "color": "#d9663f",
      "note": "网格 → 体素列 → 按邻居装配模块 → 道具 → 后院与生物。index.html 的场景就是这条管线的产物。",
      "groups": [
        [
          "流程",
          [
            {
              "name": "1 体素列与角点采样（等值线连接审核见共享底座）",
              "id": "1120036868966502401",
              "status": "done",
              "where": "src/core/cell-selection.js CellSelection · src/world/app.js 选中态/undoSel·redoSel/applySelectionWindow/pruneSelection · index.html 选择工具格 · src/ui/hud.css #tools · src/world/view.js setGridWindowForSelection",
              "page": "contour.html",
              "note": "703帧全核（本轮重抽+sheet-03重看，历轮sheet-00..07与8×裁切沿用）；缺口②收口：编辑器补真选中态（点击/S-/Esc）+多选（Shift/⌘加减）+撤销/重做逐条带回选中快照（平行账本undoSel/redoSel，不动world.snapshot口径）；选中→包围盒→窗口补丁联动，编辑/换场景/清空/撤销后先prune再算窗口；HUD工具按钮原本无onclick且被信息条与进度面板压住，已接线并挪到底部居中；?gridwin=1 开档（须在面板挂载后，否则被setDebug重放改回false）。done",
              "decodedFrames": 703,
              "reviewEvidence": "artifacts/coverage/1120036868966502401-review-r161.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  702
                ],
                "nativeRevisits": [
                  74,
                  300,
                  445,
                  470,
                  620
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "编辑器选中/多选 + 撤销重做联动 + 选中态→窗口补丁（主场景运行验收）"
              }
            },
            {
              "name": "2 模块装配（原作 545 块，这里用规则生成）+ 模块签名调试色：同一种邻居占用 = 同一块拼图 = 同一种颜色",
              "id": "1279107097108635649",
              "status": "done",
              "where": "src/build/buildings.js（partSigs/sigColorFor/plinth/buildRoofs/moduleParts） · src/build/module-catalog-r56.js（buildPiece debugParts） · module-catalog-r56.html(?parts=0)",
              "toggle": "modules",
              "note": "256帧全核（3张联系表+0050/0105/0130/0160/0181原尺寸）；旧note两条核实：「没有零件目录页」为过期账（module-catalog-r56.html r56就在），「只给墙身上色」为真缺口→本轮补部位分色：buildings.js 新增 partSigs{wall,roof,base}+sigColorFor(kind,sig)（SALT 11/977/613，同签名同色），plinth() 基座四段石带+三道压顶用 base 族色，buildRoofs/skeletonRegionRoof 屋顶用 roof 族色、山墙归墙族，buildStats 增 moduleParts{wall 28/roof 16/base 20, quads roof 79/base 798}；module-catalog-r56.js buildPiece 透传 debugParts；页面 ?parts=0 关档 + window.r56cat 增 partsOn/scenePartColors/piecePartColors。默认档零改动（debugModules=false 时 dbg=null），顶点逐字节相同。新测 tests/module-parts-color.mjs + tests/module-catalog-parts-browser.cjs 12项（27块/4族/1386三角、sigMismatch 0、同状态截图 0px、?parts=0 roof/base 归0 而 wall 27、开/关差分 5369px、0 错误）；回归 module-catalog-r56/hip-roof/house-kit/building-components/voxel-ghost-roof-props 全 PASS。无剩余机制缺口：545 块与原作单位不同（本仓按格×层：27 种/理论 60 quad·88 mixed）已在模块头注明不冒充；白细边按片保持不上色。",
              "decodedFrames": 256,
              "reviewEvidence": "artifacts/coverage/1279107097108635649-review-r189.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  255
                ],
                "nativeRevisits": [
                  50,
                  105,
                  130,
                  160,
                  181
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "部位分色：墙身/基座/屋顶三族签名色 + 目录页运行验收"
              }
            },
            {
              "id": "1344290848180203523",
              "name": "复杂悬空建筑QA：共享World编辑压力回放（局部验收）",
              "status": "partial",
              "where": "src/core/qa-replay.js · src/core/qa-monkey.js · qa-replay.html",
              "page": "qa-replay.html",
              "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。r222 残差核销——漏面与悬空支撑补断言：exposedWallFaces 枚举已建外露墙带（quad 362/mixed 332 带），auditSurfaceCoverage 每带3×3采样点靠墙平面投影覆盖（默认镇3258/2988点全满），auditUndersideSupport 按 underside() 同规则判拱/平底并核角点钢柱；接入 runWorldQA 逐步与 runMonkeyQA 核对点（qa-replay.js/qa-monkey.js 均不引 three），tests/qa-replay-r222.mjs 删整带/抽平底/抽钢柱/拆拱腹四反例全被抓且抛错后还原，浏览器双网格16步未覆盖0/失支撑0、页内手工拱+钢柱配置全过；vendor 逐字拷入 qa-replay.js+qa-monkey.js（import闭包自足）。残差=原片QA算法未公开，采样覆盖非流形/完整几何或视觉等价验收。；【卡点·C 算法未公开】原片QA算法与完整几何/视觉等价验收不可复现 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 814,
              "reviewEvidence": "artifacts/coverage/1344290848180203523-review-r222.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  813
                ],
                "nativeRevisits": [
                  0,
                  137,
                  203,
                  284,
                  336,
                  457,
                  621,
                  813
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "双网格16步本地QA、成功/异常恢复、现有墙槽/固定材质身份 + 外露墙带采样覆盖/悬空体块拱·平底·钢柱核查（r222）；非流形/完整原作视觉或算法等价"
              }
            },
            {
              "name": "3 建筑增删、暖橙屋顶与多色墙（原帖重点含饱和度、庭院草地和彩色反弹）",
              "id": "1197909675443916803",
              "status": "partial",
              "where": "src/core/town-visual.js · src/build/courtyard-grass.js · src/light/bake.js · src/build/buildings.js · wall-palette.html",
              "tour": "gable",
              "note": "456帧全核（沿用）。r208 用只读裁判 REACode 把四子项参数化：STYLE/BUILD 重叠22键逐字节相等+BUILD补path #a49c8a；colorgamut 屋顶/草地 HSV 色容体入 town-visual.js（裁判 STYLE 屋顶色 v=0.878 超包络 0.86 如实记录）；封闭院全格草/矮墙子区照长/开口零草/径叠草上入 courtyard-grass.js 并接入 buildings.js（小径格改草底+暖灰径面）；裁判多跳 diffuseBounce 同式 diffuseAir+airGain .55/bounce .62 opt-in 进 bake.js 与 setBakeLighting，单跳默认零变化。Node 侧 tests/town-visual-referee.mjs PASS+28 套件回归。R-接入批：vendor 四件（buildings/courtyard-grass/bake/worldmesh）与库逐字一致，游戏经 morrisTownStage→vendor worldmesh→buildBuildings/bakeLighting 真实消费；接入核对抓出断链——新 buildings.js 拉起 surface-decoration.js→core/wfc.js，wfc.js 漏拷曾致 index.html 动态导入 404、游戏启动全灭，已逐字补入后全树 0 缺失引用；__tmMorrisStage.worldMesh.setBakeLighting 页内可调（游戏侧暂无调用方，opt-in API）。浏览器对拍（隔离上下文，页内 world.fill 搭封闭庭院测试镇不写存档）：grassPlan enclosed=1/grassCells=46、庭院草环+小径叠面实景可见；bounces:1→3 顶点色 21746/22497 变（96.66%）、93.59% 向暖偏移、maxΔ0.401/meanΔ0.122；屏幕像素差 2.327% vs 同档噪声底 0.249%，暖色像素 3.97% vs 0.22%，差分集中彩墙立面与庭院边；回 bounces:1 顶点色逐字节复原。结论：.62/.55 opt-in 档下多跳染色可观测（裁判所记 0.42 档 1.8% 像素仅指显式降回旧强度）；重建 33ms。残差=原片逐像素视觉与源资产不可复现；town-visual.js 为库新文件、vendor 无副本亦无消费方。；【卡点·B 美术资产】原片逐像素视觉与源资产不可复现（贴图/模型/动画/UI 稿无源素材），程序化只能近似",
              "decodedFrames": 456,
              "reviewEvidence": "artifacts/coverage/1197909675443916803-review-r208.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  455
                ],
                "nativeRevisits": [
                  20,
                  100,
                  132,
                  195,
                  305,
                  410,
                  455
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "裁判参数量化 + opt-in 烘焙机制 Node 侧 + 隔离浏览器实景对拍 + vendor 接入真实消费均已验收；不等同原片视觉复现"
              }
            },
            {
              "name": "296帧：钢架编辑全核，完整WFC待补",
              "id": "1189902695303458816",
              "status": "done",
              "where": "src/build/steel-frame-edit.js（编辑→显露判定/碰撞审计/整组事务）· src/build/steel-r56.js（杆件几何）",
              "tour": "stilt",
              "page": "building-components.html",
              "note": "296帧全核；r204 收口「编辑/移除楼层 → 钢架显露」机制（卡点·A 解除）：collectSteelJobs 与 buildings.js underside 同口径（含拱排除）、planSteelReveal 逐步 diff 露/藏（reveal/hide/mixed/none 按类计数）、commitSteelReveal 走 module-patch-commit fit 事务（socket 边界+周围 WFC+stale-version）+ 原子楼层写、withdrawModulePatch 快照整组撤回、frameCollisions 可走面口径审计。node tests/steel-frame-edit.mjs 8 组 PASS + 6 套件回归。残差（既定边界，同 1257 条目口径）：原版 378 模块 WFC 目录未逐件复原——本仓为本地离散规则等价；浏览器端到端与 TigerMessenger vendor 接入未验收。",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/1189902695303458816-review-r204.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  295
                ],
                "nativeRevisits": [
                  38,
                  295
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "库层机制+事务全覆盖 Node 行为用例；浏览器端到端与 vendor 接入未验收；原版 378 模块 WFC 目录未复原（既定边界）"
              }
            },
            {
              "name": "4 支撑：拱",
              "id": "1189908238566903808",
              "status": "done",
              "where": "src/build/buildings.js（underside）· src/core/arch-profile.js · arches.html",
              "tour": "arch",
              "note": "447帧全核；对边两侧支撑→底面成拱（拱腹曲线+拱肩保留+拱脚落实心墩）与片一致，rise/span=0.40、16段、楼板0.2时crown/spring仍合法；差在拱圈无跟曲线的砖缝、开口偏高(0.95 vs 0.65)、无砖柱多跨柱廊",
              "decodedFrames": 447,
              "reviewEvidence": "artifacts/coverage/1189908238566903808-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  446
                ],
                "nativeRevisits": [
                  1,
                  60,
                  200,
                  446
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "支撑成拱与拱高预算"
              }
            },
            {
              "name": "道具/门窗：261帧；实际窗台全外缘预留，完整家具待补",
              "id": "1205416648397721601",
              "status": "done",
              "where": "src/core/opening-footprint.js#placeProps · src/build/buildings.js(yardProps + 门窗 tryPlace) · src/build/yard-prop-art-r56.js · openings-r56.html",
              "page": "index.html?scene=town",
              "note": "261帧全核；后院的「尽量多放 + 不重叠」道具（placeProps：凸格贪心 + SAT 不重叠 + 刚性正框）与门窗复用同一套放置器都已在共享 World 上，本轮补页面只读探针 r56propProbe + 浏览器验收：5 格后院 32 件道具 123 对逐对 0 重叠、角到格边余量 0.02158、饱和曲线 12/24/32/39（每个预算 0 重叠）、斜格 45.49° 上框直角偏差 0、263 道门窗全部在斜格上且框水平边与墙边夹角 0°（反向对照 89.84° / 错切 21.801°）、像素 A/B 噪声 0。原片长凳/椅/灯/花盆未做，本仓用木箱/桌/盆栽程序化替代",
              "decodedFrames": 261,
              "reviewEvidence": "artifacts/coverage/1205416648397721601-review-r129.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  260
                ],
                "nativeRevisits": [
                  1,
                  140,
                  180,
                  250
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "道具贪心放置 / 不重叠 / 斜格上正矩形门窗"
              }
            },
            {
              "name": "6 围合庭院：按实际墙层识别开口，上层桥不再封院",
              "id": "1238474550511308800",
              "status": "partial",
              "where": "src/core/courtyards.js · src/build/buildings.js · garden.html",
              "tour": "yard",
              "page": "garden.html",
              "note": "202帧全核验。共享classifyCourtyards按地面上实际第2层实心判封边；本轮补两件可验残差：①开口按真实墙层分型——ground-opening（街/水/岩整列空）与 wall-layer-gap（第2层缺、更高层仍有实心=桥/悬空屋顶跨过，bridge标记+openLayers逐层账），上层桥跨缺口不封院；②lowWalls选项——高度<1层的矮墙边只分区不封院，封闭组件内按给定矮墙边重切连通子区写入subregions+lowWallEdges。双网格（quad/mixed）封闭→桥跨开口→矮墙分区→重封闭全过。规则为本地离散近似；仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。；【卡点·C 算法未公开】仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 202,
              "reviewEvidence": "artifacts/coverage/courtyard-props-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  201
                ],
                "nativeRevisits": [
                  0,
                  26,
                  28,
                  43,
                  90,
                  123,
                  153,
                  201
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "开口分型(ground-opening/wall-layer-gap+openLayers)/桥不封院/矮墙子区 Node 用例验收（双网格+确定性）；浏览器端到端未跑；原作矮墙选线/拱门细节/形变边界/全部植物未复现"
              }
            },
            {
              "name": "六类局部墙饰接实际建筑；跨格整立面/真实洞口待补",
              "id": "1181464374839521280",
              "status": "done",
              "where": "src/build/buildings.js · src/core/building-components.js · building-components.html · building-kit-r55.html",
              "toggle": "stairs",
              "page": "building-components.html",
              "note": "505帧全核；跨格整墙/真洞口两条缺口核实为「r55 已实现、只缺页面入口与量具」：facadeRuns 把共线共顶点墙段串成一条 run（163 条全多跨、跨边界违例 51→0）、archCutout+wallStrip 真的不画拱形墙条并补洞壁/拱腹/内立面（洞深0.07）。本轮补 archCuts 面积账（墙面缺失面积=拱形折线面积0.024790，最差相对误差1.98e-5）+ building-components.html 两个开关 + 新测 tests/facade-arch-cutout-browser.cjs（同机位关闭挖洞 changed 33488px、噪声0、洞内亮度39.0→26.5）。同机位 A/B 截图核过：开=凹洞可见洞壁与门槛，关=平贴门板。",
              "decodedFrames": 505,
              "reviewEvidence": "artifacts/coverage/1181464374839521280-review-r113.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  504
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "跨格整立面 run（68 段/50 格）+ 拱门真洞口面积账与同机位 A/B 像素验收，双网格；钢架 WFC 不在本片口径内"
              }
            },
            {
              "name": "8 海鸥：排在屋脊上、只有停着有描边、挪动、倒影、扇翅滑翔绕镇飞",
              "id": "1244892370392489989",
              "status": "done",
              "where": "src/life/birds.js（sittingGeometry / flyGeometry / outlineMaterial / mirror）· index.html 海鸥开关",
              "toggle": "birds",
              "note": "772帧全核（8张联系表 + 原尺寸0040/0140 + 1.8×裁剪）；五条全中：86只/104栖位、描边只有1个mesh且共用坐姿instanceMatrix（飞鸟无描边）、坐姿266步最大挪动0.058、飞行maxStep0.028/maxTurn0.3°/0跳变、倒影62=坐姿62；差在坐姿偏圆胖短喙、起飞缺先跳再拉、无独立鸟倒影强度",
              "decodedFrames": 772,
              "reviewEvidence": "artifacts/coverage/1244892370392489989-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  771
                ],
                "nativeRevisits": [
                  0,
                  40,
                  140,
                  660,
                  771
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "海鸥造型/描边/挪步/倒影/飞行顺滑五项，非解剖级造型等价"
              }
            },
            {
              "name": "8b 蝴蝶：绕落点松散盘旋、随机换落点、世界空间噪声",
              "id": "1273520600221433857",
              "status": "done",
              "where": "src/life/decor.js · src/world/view.js",
              "toggle": "butterflies",
              "note": "937帧全核；30s绕行院子，白蝶松散绕落点转小圈、隔几秒飘到另一丛花/灌木上方，非鸟群直线编队。代码逐条对齐原文：角速度1.6rad/s、rad 0.12–0.27、3–9s换点、世界空间噪声(邻近同向)、无boids。本轮修落点来源与换点重选自身两处bug；运行时实测mean 0.095–0.285≈rad、首换2.8–8.4s、间隔3.1–7.6s、同向系数0.88–0.98",
              "decodedFrames": 937,
              "reviewEvidence": "artifacts/coverage/1273520600221433857-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  936
                ],
                "nativeRevisits": [
                  300,
                  450,
                  780
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "绕落点/换落点/噪声一致性/扇翅；翅形为2三角"
              }
            },
            {
              "name": "8c 庭院/楼间彩旗绳：308帧复核，纠正屋顶旗归因；双网格开关/截图通过",
              "id": "1212732478458343424",
              "status": "done",
              "where": "src/life/decor.js（refresh / #wire；wires开关）",
              "toggle": "wires",
              "note": "308帧全序列复核：视频是庭院/楼间彩旗绳，纠正旧屋顶插旗归因。保留已有抛物线下垂/三角旗条带；双网格开关不改共享World/屋顶旗、数值及实景截图通过。任意布局穿墙/精确附着仍待后续压力测试。",
              "decodedFrames": 308,
              "reviewEvidence": "artifacts/coverage/banner-bunting-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  307
                ],
                "nativeRevisits": [
                  0,
                  110,
                  180,
                  240,
                  307
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "8d 楼间绳线/衣物：精确墙面端点与逐层包络，双网格通过",
              "id": "1259838941299183619",
              "status": "done",
              "where": "src/core/wire-route.js → src/life/decor.js",
              "toggle": "wires",
              "note": "316帧核验：绳线上有白色衣物、不同高度连接。补精确墙面裁切、高共用墙面附着、逐层solid检查下垂/衣物/摆幅包络，保留彩旗并加简化白衣物；双网格2/3连接、刷新释放/开关通过。不是严格悬链线/物理布料，形变屋顶精确碰撞、同楼对多高度绳线待补。",
              "decodedFrames": 316,
              "reviewEvidence": "artifacts/coverage/wire-frontier-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  315
                ],
                "nativeRevisits": [
                  0,
                  80,
                  150,
                  220,
                  315
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "8e 水花：落水时泡沫环 + 飞沫",
              "id": "1258421104756097029",
              "status": "done",
              "where": "src/life/splash-c07.js · src/life/effects.js · index.html（默认档，?splash=plain 对照）",
              "note": "436帧全核（历史 5 张联系表 + 本轮白像素峰扫全片 + 004–066/376–422 两段裁切逐格 + 0384 4× 原尺寸）；水花=冠状竖直水帘10根(0.35s到顶/0.88s塌落)+3圈泡沫环(delays 0/0.22/0.5, 3.2s仍3圈, 3.9s首圈到寿)+10–12颗飞沫。旧note『缺冠状竖条与多环长寿命』核实为过期账(splash-c07 r56 已有, 只挂在 ?c07=splash)；本轮把默认改到冠状档(?splash=plain 对照)+补探针, 新测 tests/splash-crown-browser.cjs：水帘窗 723→362→0→0、0.34s h=0.3243、3.2s r=0.638/0.726/0.809 alpha=0.21/0.18/0.22、飞沫11、对照档3.2s差分0、噪声0、0 error",
              "decodedFrames": 436,
              "reviewEvidence": "artifacts/coverage/1258421104756097029-review-r165.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  435
                ],
                "nativeRevisits": [
                  1,
                  384,
                  400,
                  435
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主场景默认档运行验收：冠状水帘形态/塌落时机、三圈环寿命与半径、飞沫数量、旧档对照"
              }
            },
            {
              "name": "8f 道具出现/消失：已逐帧，独立生命周期待接（现仅柱顶增长/灰尘）",
              "id": "1246074663546916873",
              "status": "done",
              "where": "src/core/prop-anim.js · src/world/prop-anim-layer.js · index.html?scene=town&yardanim=1",
              "note": "306帧全核（4张联系表+原尺寸0223/0224/0225/0260/0261/0265）；r190记的'代码未写'是过期账（prop-anim.js/prop-anim-layer.js r55/r56 就落了稳定key+保留消失几何+逐道具缩放）；真缺口是曲线与运行验收 → 本轮加 PROP_TIMING（出现1帧到1.372×、0.121s回落；消失1帧塌陷、槽位保3帧）+ appearAt/vanishAt/timelineScale，PropLifecycle 默认 clip 档；tests/prop-anim-clip-timing.mjs + tests/prop-anim-clip-browser.cjs（1.372→1、半帧0.75→0、槽位27→-1、差分418px、噪声0）全过；错峰为本仓扩展（片内整组同帧，证不出）",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/1246074663546916873-review-r192.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  305
                ],
                "nativeRevisits": [
                  0,
                  223,
                  224,
                  225,
                  260,
                  261,
                  265
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "道具出现/消失时间曲线 + 槽位生命周期 + 运行验收"
              }
            },
            {
              "name": "Max保留颜色：新增Max/Add真实GPU对照，重叠不累加增亮",
              "id": "1056990611738451968",
              "status": "done",
              "where": "src/life/effects.js · fire.html",
              "toggle": "fire",
              "page": "fire.html",
              "note": "379帧全核；三重火源的橙→黄→淡黄层次与共用轮廓＝Max 而非 Add，GPU 读回 maxDelta=0/addDelta=277924，同簇 64 片近景 Max 纯白 0 px、Add 8593 px；Points 软圆近似方片，无火光照明",
              "decodedFrames": 379,
              "reviewEvidence": "artifacts/coverage/1056990611738451968-maxblend-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  378
                ],
                "nativeRevisits": [
                  1,
                  10,
                  200,
                  378
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "火焰 Max 混合与快速收缩"
              }
            },
            {
              "name": "保留快速收缩，补实际寿命年龄/出生尺寸/到期丢弃；线性对照",
              "id": "1056992291108413446",
              "status": "done",
              "where": "src/life/effects.js · fire.html",
              "page": "fire.html",
              "note": "152帧全核（2张联系表+原尺寸0075）；寿命归一年龄、出生尺寸、到期discard，二次收缩半寿命0.25x对线性0.5x；缺橙红外缘与火星（旧粒子已<1px），默认机位火柱仅1-3px",
              "decodedFrames": 152,
              "reviewEvidence": "artifacts/coverage/fire-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  151
                ],
                "nativeRevisits": [
                  0,
                  75,
                  151
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "火焰粒子寿命归一与超线性收缩（Max混合）"
              }
            },
            {
              "name": "8g3 烟雾两遍/硬边渐隐保留，新增相机排序；已有烟源时可看棋盘格",
              "id": "1015140880666300416",
              "status": "done",
              "where": "src/life/smoke.js · src/core/smoke-order.js · smoke.html",
              "toggle": "smokecheck",
              "page": "smoke.html",
              "note": "631帧全核；两遍烟雾（pass0 纯黑满alpha、pass1 更浅且阈值内收露黑描边）与实现一致，back/front 各23实例排序稳定；缺卷曲团块轮廓与按火源尺寸缩放",
              "decodedFrames": 631,
              "reviewEvidence": "artifacts/coverage/1015140880666300416-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  630
                ],
                "nativeRevisits": [
                  1,
                  300,
                  610
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "烟雾两遍参数、排序与场景回归"
              }
            },
            {
              "name": "8i 战斗痕迹：血、尸体、箭射中后粘在船上随船走（Bad North 战斗；原文 \"making blood, corpses and arrows stick to boats\"）——画面是长船靠岸、箭雨、滩上尸体和血，不是草和花",
              "id": "946660607008403456",
              "status": "done",
              "where": "src/badnorth/battle-c01.js#buildFlowers/flowerProbe · src/badnorth/battle.js#bleed(deckPool/corpseAnchor/箭attach) · index.html?scene=badnorth（?c01=-shoreFlowers 关档）",
              "page": "scene:badnorth",
              "note": "440帧全核（5张联系表+0150 10×/0430 8× 新裁切）；口径再纠正：所谓「白桨叶阵列」实为插在船上的白箭杆+压在上面的白尸体（空船亦有2支、倾角不规则、同帧空中有飞行箭线），r183 的「桨叶缺口」撤销；四条机制（船底连续血池/尸体贴船/箭贴船/岸上米白小花）全在。本轮把花从 shoreFoam 里拆成独立 shoreFlowers（默认开）、颜色改米白为主+点径0.05+簇内0.10，船上尸体改近白（boatCorpse #efe9dd），补只读 flowerProbe；新测 tests/battle-c01-shore-flowers-browser.cjs 18 项（20簇/110朵/每簇4-7/离地0；花开关差分494px 100%落在花点投影；噪声0、回位0；尸体贴船位姿<1e-6、箭parent=boat.mesh漂移0；血池24段opacity0→0.384）。剩余美术差：原片是整片花毯、本仓20个散簇；船上白尸体在近景被血斑盖住",
              "decodedFrames": 440,
              "reviewEvidence": "artifacts/coverage/946660607008403456-review-r185.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  439
                ],
                "nativeRevisits": [
                  1,
                  150,
                  250,
                  430
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸上小花簇（默认开）· 船底血池 · 尸体/箭贴船"
              }
            },
            {
              "name": "8h 建造音效：入水\"咕咚\"（闷击 + 上扬的气泡音）、陆上磕石头、拆掉\"啵\"（WebAudio 现场合成；用户需求，非视频）",
              "status": "done",
              "where": "src/life/sound.js",
              "toggle": "sound"
            },
            {
              "name": "9 本地v5分享串：原子导入 / 坏输入保岛 / 北境身份（完整状态另补）",
              "id": "1198957499027795969",
              "status": "partial",
              "where": "src/world/save.js · src/world/app.js · save-mesh.html",
              "page": "save-mesh.html",
              "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。本地v5补第三可选尾段（标志链末节+3b metaVer）：调色板（预设序号或自定义色数+24b RGB）与玩法/天气状态（光照时段/北境主题/flatRoofs等五世界开关/雪雾/雾浓度流速/风向）入档；解码回写world.palette与开关，视图侧字段经world.saveMeta交调用方，app.js读档与game-ui菜单Load即应用，编码meta缺省回落saveMeta→解完原样再编逐位一致；旧串尾零→三标志全缺席照读不误判，新串喂旧解码器按「多余数据」拒收保岛；体素色槽上限改按解后生效调色板验。tests/save-meta.mjs新增+save-atomic/river-flow/splice-save-undo/house-project等回归全过。；r226 补第四可选尾段（标志链末节 UI 段）：工具/色槽（3b+5b 固定）/镜头（target 3×14b×0.05、yaw 11b、pitch 8b、distance 10b）/选中态（W 位升序格号表）/撤销与重做栈（各≤8 条+截断位，条目=体素游程块+嵌入房+选中态）入档；体素游程与嵌入房读写提为共用助手供主段与条目复用；解码经 world.saveMeta.ui 出站、app.js applySaveMeta 把工具/色槽/镜头/选中态/撤销栈种子回位（sceneStart=0 供回放），编码 meta.ui 现取现传、saveMeta.ui 回落解完再编逐位一致；旧串照读不误判、新串喂旧解码器按「多余数据」拒收（tests/save-ui.mjs 内置旧尾链模拟器实测）；取舍如实记=撤销栈整快照只带最近 8 条/栈（体量约束）、多格实例登记不进分享串（与主段 restore 一致）。tests/save-ui.mjs 新增+save-meta/atomic/river-flow/splice-save-undo/house-project/multicell 回归全过；【卡点·C 源证据】原作位流格式与Switch性能无源可对照 → 永久卡点，需新证据再立项",
              "decodedFrames": 321,
              "reviewEvidence": "artifacts/coverage/1198957499027795969-review-r226.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  320
                ],
                "nativeRevisits": [
                  0,
                  36,
                  106,
                  201,
                  240,
                  320
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地v5原子解码/实际重载与主体GPU提交验证 + 调色板/玩法天气/UI态（镜头/选中态/工具/撤销栈）尾段逐位往返；不等同原作格式、Switch性能未复现"
              }
            },
            {
              "name": "9b 撤销历史回放：可停止/保岛，截断历史偏移已修复（动作特效另补）",
              "id": "1260586697538113537",
              "status": "partial",
              "where": "src/core/snapshot-replay.js · src/core/edit-fx-schedule.js · src/world/view.js · src/world/worldmesh.js · src/world/app.js",
              "page": "index.html?scene=town",
              "note": "167帧全核验（历轮sheet/裁切证据沿用）。「动作特效」可做的部分本轮收口：撤销/重做/历史回放本就走 worldMesh.edits 体素差分→effects.onEdit（弹性弹出/落水水花/拆除灰尘）+sound.onEdit 音效（r56已验）；本轮补三处真差距——①单笔快照超40格时 edits 被静默吞掉：worldmesh.editFxLimit 可配，回放期 app.js 放宽到600并 finally 复原；②一帧多格全堆同一时刻：新增 core/edit-fx-schedule.js 变心径向波确定序错拍（快照只有整笔颗粒度、笔内拖动顺序不可恢复→径向波近似原片依次生长，0.045s间距、maxSpan1.4s压缩）+view.editFxQueue 到期才喂 effects/sound；③无可关档：setDebug('editfx')/?editfx=0 整层丢帧。新测 tests/edit-fx-schedule.mjs：径向序/时序界/40吞·600全发/回放60弹出·60水花·30灰尘·finally恢复最终态；snapshot-replay-fx-r56.mjs 改断新接线后复绿。；【卡点·B 美术资产】导演镜头轨迹/剪辑节奏与逐动作元数据原片未公开（原片为固定临水镜头） → 永久卡点，需新证据再立项",
              "decodedFrames": 167,
              "reviewEvidence": "artifacts/coverage/obj-replay-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  166
                ],
                "nativeRevisits": [
                  0,
                  32,
                  56,
                  90,
                  118,
                  166
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "实际主体OBJ下载解析/快照回放控制；非第三方DCC视觉/完整动作特效复现"
              }
            },
            {
              "name": "蝴蝶在后院花园上空飞（画面：环形排屋围着的花园）",
              "id": "1270725616430530566",
              "status": "done",
              "where": "src/life/decor.js · src/world/view.js（落点来源）",
              "note": "623帧全核；后院环形排屋+草坪，白蝴蝶在灌木/花簇上方悬停平移、会换位置，已6倍放大确认扇翅与竖直位移。本轮修落点来源：原来只取花点(城镇场景仅1个落点，5只蝶全绕同一点)，补后院格心后17只蝶多落点；另修换点可能重选当前落点。运行时实测绕圈/换点/图层开关全过",
              "decodedFrames": 623,
              "reviewEvidence": "artifacts/coverage/1270725616430530566-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  622
                ],
                "nativeRevisits": [
                  450,
                  453,
                  600
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "蝴蝶存在性、落点来源、扇翅；观感尺寸/配色略差异"
              }
            },
            {
              "name": "窗户的风格与密度（每层 1–2 扇白框小窗）、不同颜色的房子相接",
              "id": "1176516621223043073",
              "status": "done",
              "where": "src/build/buildings.js（opening/tryPlace） · building-components.html",
              "note": "282帧全核；本轮补窗横档并把默认窗从1:1.65窄条改成0.09×0.095近正方（与片放大后0.93一致），每面每层实测0.63–0.92扇=1扇为主、长墙2扇；差在片里无百叶窗而本仓六类墙饰会出48扇、窗台偏宽",
              "decodedFrames": 282,
              "reviewEvidence": "artifacts/coverage/1176516621223043073-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  281
                ],
                "nativeRevisits": [
                  1,
                  100,
                  212,
                  281
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "窗型密度与相邻换色"
              }
            },
            {
              "name": "白天也好看的火：靠 Max 混合，粒子融成一个火焰轮廓不过曝（北境里小屋失守时着火）",
              "id": "1056999668486471682",
              "status": "done",
              "where": "src/life/effects.js（fire / MaxEquation / setFireAppearance） · fire.html、index.html?scene=badnorth",
              "note": "435帧全核；白天靠 MaxEquation 保住火芯黄→橙→红三阶（重合粒子 GPU 读回 maxDelta=0/addDelta=277924），二次收缩顶端碎块等价；缺宽粉光晕与贴屋脊火源，火柱偏细散",
              "decodedFrames": 435,
              "reviewEvidence": "artifacts/coverage/1056999668486471682-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  434
                ],
                "nativeRevisits": [
                  1,
                  200,
                  430
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "火焰 Max 混合与白天可读性"
              }
            },
            {
              "name": "年龄增加mip偏移；同尺寸卡片GPU实测与mip开关，保留隐式LOD语义",
              "id": "1015151731804721152",
              "status": "done",
              "where": "src/life/smoke.js · smoke.html",
              "page": "smoke.html",
              "note": "281帧全核；age×4 的 mip bias 让裸方片从基部米粒级细节退到顶端平灰，GPU 方差 13427→6826（−49.2%）；仍是经验级数，非精确 mip 号，Points 软圆不等于原片方片",
              "decodedFrames": 281,
              "reviewEvidence": "artifacts/coverage/1015151731804721152-mip-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  280
                ],
                "nativeRevisits": [
                  1,
                  140,
                  280
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "烟雾 mip 偏移与裸方片对照"
              }
            },
            {
              "name": "随机正反UV沿投影烟流滚动；真实mip棋盘/裸方片与关闭滚动对照",
              "id": "1015149712469524480",
              "status": "done",
              "where": "src/life/smoke.js · smoke.html",
              "page": "smoke.html",
              "note": "451帧全核；棋盘带内相邻方片相位互不连续、方向可正可反＝逐片 UV 沿流向随机滚动，冻结 0/0/0 与滚动 122/147/122、反向 206.33 均 GPU 读回；aFlow 只是速度投影近似，非三维流体轨迹",
              "decodedFrames": 451,
              "reviewEvidence": "artifacts/coverage/1015149712469524480-uvscroll-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  450
                ],
                "nativeRevisits": [
                  1,
                  250,
                  330,
                  450
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "烟雾逐片 UV 双向滚动"
              }
            },
            {
              "name": "两遍画：黑底/浅色遍可单独验收、阈值仅内收一次、同深度排序与实例属性配对",
              "id": "1015142746372366336",
              "status": "partial",
              "where": "life/smoke.js#CROWN_STYLE · smoke.html · battle-c01",
              "page": "smoke.html",
              "note": "303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/1015142746372366336-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  302
                ],
                "nativeRevisits": [
                  1,
                  160,
                  302
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "烟柱形态/顶团/薄雾；顶团寿命不可标定"
              }
            },
            {
              "name": "灯塔：海边一格粗高塔 → 灯室 + 旋转光束",
              "id": "1331905048801144836",
              "status": "done",
              "where": "src/build/lighthouse.js（refresh 几何：lantern / roof / deck / railpost）· index.html 场景（灯塔开关）",
              "toggle": "lighthouse",
              "note": "347帧全核；规则（海边、≥5层、每邻格矮2层以上）本来就对，外形原来全错：圆柱灯室+暗红圆锥+圆环栏杆。改成方形灯室（1.12×0.34×1.12，x/z差0）、5扇玻璃白棂、方形挑台+红唇+72根立杆、4段橙红四坡顶+顶尖；仍缺：塔身红白分层不保证、灯室玻璃偏白、片中没演示夜间光束故未复核",
              "decodedFrames": 347,
              "reviewEvidence": "artifacts/coverage/1331905048801144836-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  346
                ],
                "nativeRevisits": [
                  200,
                  300,
                  346
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "灯塔外形与命中规则"
              }
            }
          ]
        ],
        [
          "早期拱洞逐帧与曲线分段",
          [
            {
              "id": "806904557502464000",
              "status": "done",
              "name": "123帧：水渠/穿楼拱洞，局部曲线验收",
              "where": "src/build/canal-bridge-r56.js · src/core/arch-profile.js（archVoussoirs/measureArch）· src/build/buildings.js:117 · openings-r56.html",
              "page": "arches.html",
              "note": "123帧全核（sheet-00/01 + 原尺寸0017 与3倍拱洞裁切）；原 note 记的「楔石/完整桥构」缺口核实为过期账：src/build/canal-bridge-r56.js（文件头署本片ID）的 canalBridgeAxis/canalArchParams/quayProfile/canalBridgeFace 早已画出桥台、拱上三角墙、压顶红带、archVoussoirs 楔石环+键石、拱腹与拱下净空，buildings.js:117 接管该面基座，?canalBridges=1 有入口，缺的只是页面运行验收 → 本轮给 openings-r56.html 补 window.r56bridgeProbe（数世界网格真实三角 + 射线量拱下通不通）+ 新测 tests/canal-bridge-keystone-browser.cjs；4 个开口面每面 9 块楔石（16 浅色三角 + 键石 2 三角），键石 s=0.478 在拱顶、环脚 0.064–0.929 两端到、环顶 < 压顶下沿 0.445、拱下首交 0.75–1.81 而压顶下 0.085 处必被挡 0.348（下通上实）；关开关同一格同一面重建 ringTotal 0 / 首交 0.3327；像素 A/B 61480px / 噪声 0 / 变化全在桥体附近。",
              "decodedFrames": 123,
              "reviewEvidence": "artifacts/coverage/806904557502464000-review-r123.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  122
                ],
                "nativeRevisits": [
                  0,
                  17,
                  64,
                  90,
                  122
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "运河拱桥机制（桥面跨渠 + 拱洞 + 楔石环/键石 + 拱腹 + 拱下净空），尺度与配色差异不计缺口"
              }
            },
            {
              "id": "802496920790777856",
              "status": "done",
              "name": "292帧：水渠/穿楼拱洞，局部曲线验收",
              "where": "src/build/buildings.js（underside）· src/core/arch-floor-budget.js · src/core/arch-profile.js · openings-r56.html",
              "page": "arches.html",
              "note": "292帧全核（sheet-00/01/02 + 原尺寸0185 与0135 的2倍拱洞裁切）；原 note 与本组另一条同句的「楔石/完整桥构」缺口核实为过期账：穿楼拱洞走 buildings.js underside() 的 archFloorBudget/archProfile/archVoussoirs 管线（每个开口面 9 块楔石、奇数才有居中键石、archVoussoirLog 逐块记 maxY/base），页面 openings-r56.html?flags=archVoussoirs&focus=arch 就是这道大拱，缺的只是运行验收 → 本轮 tests/canal-bridge-keystone-browser.cjs 一并验：fusion 场景 3 座拱落在 level 4（base 1.5/floor 1）与 level 6（base 2.5/floor 2）两个塔基，crown=base−slab 误差<1e-9、spring≥floor、corniceContinuous true、6 面×9 楔石=54 块且每面恰好 1 键石、环顶≤base；运河场景悬空楼体拱 cell 560 level 4 base 1.5 floor 0（真悬空）crown 1.45/spring 1.05/rise 0.4、2 面 18 块楔石 2 块键石。",
              "decodedFrames": 292,
              "reviewEvidence": "artifacts/coverage/802496920790777856-review-r123.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  291
                ],
                "nativeRevisits": [
                  0,
                  135,
                  185,
                  200,
                  291
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "穿楼/悬空楼体拱洞 + 拱券楔石环/键石 + 任意塔基的楼层线净空预算；超宽跨格（>1.5 格）拱的机制边界单列不计缺口"
              }
            }
          ]
        ],
        [
          "三维拼装学习待迁移",
          [
            {
              "name": "67帧3D模块逐步拼装全核，仅学习",
              "id": "787319655648100352",
              "status": "done",
              "where": "src/build/assembly-modules.js · src/build/assembly-sequence.js · src/capabilities/build.js（build.assembly）· assembly.html（沿用 WFC 回放页）",
              "note": "67帧全核，仅学习；残差已补：桥廊/围合楼体 3D 模块集（socket 标签+支撑策略：below/侧挂/free）＋底板分步拼装序列（支撑就绪序排步、逐步合法校验、LIFO 撤销、占用拒写不动 World）＋空中零件落下轨迹关键帧参数；实际消费者 build.assembly 能力经 runPlan 执行验证（3×3 内院围合闭合、跨 3 格水面廊桥连通两端）。测试 tests/assembly-sequence.mjs 10 例全过；美术差：原版3D模块形状/贴图与落下动画渲染未迁，轨迹为数据层关键帧",
              "decodedFrames": 67,
              "reviewEvidence": "artifacts/coverage/787319655648100352-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  66
                ],
                "nativeRevisits": [
                  15,
                  32,
                  51,
                  66
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "桥廊/围合楼体模块集 + 支撑序逐步拼装/撤销 + 空中零件轨迹数据；消费边界=build.assembly 能力 runPlan（无独立演示页），原模块美术未迁"
              }
            }
          ]
        ],
        [
          "逐帧核验补登",
          [
            {
              "id": "797844857821732864",
              "name": "（无原文）",
              "status": "done",
              "where": "src/world/voxel-ghost.js（roofProps/propStats/airDepths/interiorTone）· voxel-ghost.html（?props/?grad）",
              "page": "voxel-ghost.html",
              "note": "117帧全核（2张联系表+0116塔顶/拱洞4×裁切）；屋顶小件落地（天线12/栏杆齿320/圆盘2/露台小树2，逐件基格实体、无悬空无被埋）＋室内光进深渐变落地（airDepths 泛洪 + interiorTone(ref 9)，浅 depth4→深16 亮度 206→171；粉色像素亮度跨度 10.4→21.4、最暗 156.6→134.1）；小件开/关差分 30903px、噪声 0、关→开→关逐字节幂等；美术差：小件为体素替身、齿密度低于原片",
              "decodedFrames": 117,
              "reviewEvidence": "artifacts/coverage/797844857821732864-review-r186.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  116
                ],
                "nativeRevisits": [
                  1,
                  50,
                  116
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "屋顶小件（天线/圆盘/栏杆/露台小树）+ 室内光进深渐变"
              }
            },
            {
              "id": "794993371261665280",
              "name": "（无原文）",
              "status": "done",
              "where": "src/world/voxel-ghost.js（groundPlants/plantStats + r186 的 airDepths/interiorTone）· voxel-ghost.html（#plants / ?plants=0 / plantSpots）",
              "page": "voxel-ghost.html",
              "note": "158帧全核（2张联系表+本轮回看原尺寸0060/0090/0120/0150）；核实纠正：树不在露台而在底板广场（r183记错层次）——新增 groundPlants()（底板格+离墙≥1.45格+间距≥1.7格，9棵、花池、s 1.55–1.85≈1.5–2格高）＋plantStats（buried 0/floating 0/底板可用格161），页面 #plants＋?plants=0＋plantSpots/plants 探针；顺带修小件屏幕半径少乘 PROJ.scale 的换算 bug（树干细针顶小点→圆冠+花池）。读数：开/关差分 3003px、98.0% 落在树投影矩形、噪声 0、开→关→开像素 0 且截图逐字节相同、与屋顶件解耦 32465/2916px；室内进深渐变沿用 r186 机制并回归（跨度 21.4 vs 10.4、最暗 134.1 vs 156.6、探针 4/11/16→206/180.3/171.3）。bandHeight 片内不可测按 r97 标定保持 3 层（标定差非机制缺口）；美术差：树为程序化替身、后排树被塔身遮挡",
              "decodedFrames": 158,
              "reviewEvidence": "artifacts/coverage/794993371261665280-review-r187.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  157
                ],
                "nativeRevisits": [
                  1,
                  60,
                  120,
                  157
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "基座广场树列（含花池）+ 室内光进深渐变运行验收"
              }
            },
            {
              "id": "784848286272327680",
              "name": "（无原文）",
              "status": "done",
              "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
              "page": "planet.html",
              "note": "272帧全核；planet.js 的 assemblyOrder(frontier)/assemblySlice/planetMesh(only) 三档实测 37/185/383/618 格、前沿断口侧壁可见，与片子单粒起点→前沿铺满一致；缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块；【卡点·A 机制未做】缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r224 残差核销（复核零代码改动）：与姊妹片 784847588893814785（r216 done）/784847933686575104（r223 done）共用落点，三项残差均已落位——① 格内两级细分：src/sphere/planet-wfc-c06.js plates 集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（r56 C06 落位；本轮复跑 tests/planet-wfc-c06.mjs：碎块格均 411 顶点 vs 板格 195≈2.1×、碎块集中 biomeField 低频带一片、frontier=1）；② 装配起点可指定单格：solvePlanetTiles({root})/assemblyOrder({root}) 钉首格（order[0]===root、非法 RangeError），planet.html 已补 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（r216 落地；tests/planet-assembly.mjs root 三档断言 PASS）；③ 表面生物群系斑块：biomeField 低频球面场给内容换色（tubes bio>.62 混褐/bio<.3 混苔绿）+plates allowed 把碎块区限制在低频带一片（r56 落位）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致。剩余残差：原作 WFC 求解器内部与原作群系算法未公开（卡点·C 算法未公开，solveWFC/biomeField 为等价/程序化近似不冒充原物）→ 本片可观察残差清零 → done",
              "decodedFrames": 272,
              "reviewEvidence": "artifacts/coverage/784848286272327680-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  271
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球面胞元壳前沿装配/断口侧壁 + 格内细分碎块堆/装配起点可指定/生物群系斑块（r224 核销）"
              }
            },
            {
              "id": "784847588893814785",
              "name": "（无原文）",
              "status": "done",
              "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
              "page": "planet.html",
              "note": "270帧全核；与 784847933686575104 共用同一落点（装配生长/断口侧壁/薄壳/白模）；片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现；【卡点·A 机制未做】片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r216 残差核销：格内细分碎片堆与装配起点可指定均已落位——src/sphere/planet-wfc-c06.js plates 瓷砖集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（tests/planet-wfc-c06.mjs：碎块格均 411 顶点 vs 板格 195≈2.1×、碎块只集中在 biomeField 低频带一片），solvePlanetTiles({root})/assemblyOrder({root}) 起点可指定（order[0]===root、非法 RangeError）；planet.html 补页面入口 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（tests/planet-assembly.mjs 新增 root 三档断言、planet-assembly-browser.cjs setRoot 399/点选 608/?root=399/非法回退四段实测 PASS、四档顶点 5907→19797→29508→24765 回归不变）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致（本批无 src 改动）。剩余残差：原作 WFC 求解器内部未公开，本仓 solveWFC 为等价实现不冒充原物（卡点·C 算法未公开）；本片可观察残差清零 → done",
              "decodedFrames": 270,
              "reviewEvidence": "artifacts/coverage/784847588893814785-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  269
                ],
                "nativeRevisits": [
                  30,
                  100,
                  250
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球面胞元装配生长/断口侧壁/薄壳/白模 + 格内细分碎块堆/装配起点可指定（r216 核销）"
              }
            },
            {
              "id": "784847933686575104",
              "name": "（无原文）",
              "status": "done",
              "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
              "page": "planet.html",
              "note": "268帧全核；planet.js 补 assemblyOrder/assemblySlice + planetMesh(only)，页面加装配滑杆/白模/薄壳，铺满618格，四档顶点 5907→19797→29508→24765（铺满后断口侧壁消失）；缺装配起点可指定与格内细分；【卡点·A 机制未做】缺装配起点可指定与格内细分 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r223 残差核销（复核零代码改动）：与姊妹片 784847588893814785（r216 已 done）共用落点，两项残差均已落位——① 装配起点可指定：solvePlanetTiles({root})/assemblyOrder({root}) 钉首格（order[0]===root、非法 RangeError），planet.html 已补 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（r216 落地；本轮复跑 tests/planet-assembly.mjs root 三档断言 + tests/planet-wfc-c06.mjs root 10/400 全 PASS）；② 格内细分：src/sphere/planet-wfc-c06.js plates 集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（r56 C06 落位；碎块格均 411 顶点 vs 板格 195≈2.1×、碎块集中 biomeField 低频带一片，本片「同层细碎凹坑」由碎块堆同型承担）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致。剩余残差：原作 WFC 求解器内部未公开（卡点·C 算法未公开，solveWFC 等价实现不冒充原物）+片中近AO硬明暗仅 cube-height 高度立方体光照本地近似开关（非原作光照）→ 本片可观察残差清零 → done",
              "decodedFrames": 268,
              "reviewEvidence": "artifacts/coverage/784847933686575104-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  267
                ],
                "nativeRevisits": [
                  4,
                  16,
                  30,
                  100,
                  245
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球面胞元装配生长/断口侧壁/薄壳/白模 + 格内细分碎块堆/装配起点可指定（r223 核销）"
              }
            },
            {
              "id": "1430227487376781317",
              "name": "Plus you can change the in-game textures now! So…",
              "status": "done",
              "where": "src/core/town-skin.js · src/world/town-skin-layer.js · src/world/view-c07.js（townskin）· index.html?c07=townskin",
              "page": null,
              "note": "279帧全核；核实为已实现缺验收：src/core/town-skin.js（128² 总图集/60 色格/格均色=底板/scribble）+ src/world/town-skin-layer.js（aC07Cell+aC07Ratio 顶点属性、scribble/paint/loadImage/toPNG 热替换、植物 leafSurface 同图）+ view-c07 townskin 开关；本轮补运行验收 tests/c07-skin-decal-browser.cjs —— 36555 顶点全 skinned/26 色格/mismatch 0，写一笔差分 12184px，热替换整张 PNG 差分 58909px 且平均色转向洋红[69.2,58.9,89.3]，植物读同图 true，toPNG 可导出",
              "decodedFrames": 279,
              "reviewEvidence": "artifacts/coverage/1430227487376781317-review-r107.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  278
                ],
                "nativeRevisits": [
                  1,
                  150,
                  207,
                  278
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "全城共用总贴图 + 运行时热替换（涂鸦/任意paint/PNG载入/导出往返）；非 PS 编辑器 UI 本身"
              }
            },
            {
              "id": "1427721874490933250",
              "name": "Here's a very quick technical test. Though this …",
              "status": "done",
              "where": "src/core/decal-accum.js（DecalAtlas/stamp/fillPadding/seamBleed）· src/world/view-c07.js（DecalBoil）· index.html?c07=decalboil",
              "page": null,
              "note": "188帧全核；核实为已实现缺验收：src/core/decal-accum.js 的 DecalAtlas 每帧 stamp 轴对齐方块（草顶/岩壁两张 chart，环面绕回）+ fillPadding 边距复制，src/world/view-c07.js 的 DecalBoil 每帧注入着色器并调 step；本轮补运行验收 tests/c07-skin-decal-browser.cjs —— 关贴花两帧差分 0，开贴花相邻帧 changed 20395/31149，每帧改图 499px，黄绿覆盖 3717→11862→18706 单调铺开，pad=2 且 seamBleed(0/1)=0",
              "decodedFrames": 188,
              "reviewEvidence": "artifacts/coverage/1427721874490933250-review-r107.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  187
                ],
                "nativeRevisits": [
                  1,
                  40,
                  120,
                  187
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逐帧贴花累加(line boil)与图集 padding 接缝；非原片方块形状/密度的逐像素等价"
              }
            },
            {
              "id": "1310503825510367232",
              "name": "Ok, I tried the mixed perspective. Note how hous…",
              "status": "done",
              "where": "src/core/mixed-perspective.js · src/world/view-mixed-persp.js · src/world/view.js:311,1270 · index.html?mixedPersp=1",
              "page": "mixed-perspective.html",
              "note": "200帧全核（sheet-00/01 全看+0060 原尺寸）；片内单一投影：绕岛旋转，塔身竖棱逐帧平行、近处房子比远处大。旧note的「主视图view.js未接、pick/倒影未同步」核实为过期账（第46次同型）：mixed-perspective.js 的 withVerticalParallel + view-mixed-persp.js 的投影替换/深度行/fixRay 早接 ?mixedPersp=、倒影同相机自动同步，缺的只是主场景运行验收。新测 tests/mixed-persp-main-browser.cjs 18项全ok：k=1 12根世界竖柱横移 5.6e-14px（k=0 对照 27.66px、11/12根>1px）、同1层高柱四段距离 40.6→37.87→34.43→30.96px 逐段变小（−23.7%）、镜像竖线横移0、拾取 24/24 命中实心格且 k=1 与 k=0 同为 14/24 未掉档、fixRay 关档 24/24 改判、像素 k0→k1 差分 53256/172800 噪声 0/0、不带参数页 mixedPersp=null 且竖线横移与 k=0 逐位相同。另把 fixRay 起点改到线上离相机最近点（原 z=-1 反投影点离眼点 8.36 单位，可能落在近处柱内），本夹具 diff 0 属稳健性修补。回归 mixed-perspective-browser PASS",
              "decodedFrames": 200,
              "reviewEvidence": "artifacts/coverage/1310503825510367232-review-r171.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  199
                ],
                "nativeRevisits": [
                  0,
                  60,
                  120,
                  199
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "混合透视投影（竖线平行+近大远小）主场景运行验收 + 拾取射线"
              }
            },
            {
              "id": "1302686201401442309",
              "name": "A smoothing and inversion bug I came across whil…",
              "status": "done",
              "where": "src/core/infinite.js(relaxGroup/createInfiniteStream/verify) · src/core/grid.js(relaxPolygons areaPull) · grids.html?t=infinite",
              "page": "grids.html",
              "note": "241帧全核（3张联系表 + 40/50/120 原尺寸）；原片是bug现场直播：翻折块塌成深色皱褶、没翻折的邻格被拉长去补缺口，两个症状都在画面上。上一轮唯一缺口（把面积拉回点阵的松弛权重）本轮补上：grid.js relaxPolygons 加 areaPull —— 目标半径朝「与本格原始点阵面积相等的正 n 边形」拉（R_want=√(2A_raw/(n·sin(2π/n)))），外圈仍钉住故接缝不变；buildInfinite 默认 0.85（areaPull:0 逐位复现旧行为），bugPatches 演示块不施加，createInfiniteStream 同口径透传（漏传会让流式与窗口版差 0.0516，该回归当场报错、已修）；verify() 报告带上 areaPull，grids.html?t=infinite 面板可读。实测：收缩格 27→0、最小收缩比 0.450→0.640、最大拉伸 1.83→1.52、翻折 0、接缝 4e-15、块内面积守恒（patch 档）1e-15、blend 插值漂移 1.1%-3.1%。新测 tests/infinite-area-pull.mjs PASS（oldWorst 0.45→newWorst 0.64、streamMaxDiff 4.6e-16）；回归 infinite-verify / infinite-window / infinite-stream / infinite-c06 / infinite-verify-browser / infinite-grid-view-browser 全 PASS。页面读数 3946 格 / 翻折 0 / 1.52× / 0.64× / 378 组对照最大差 4.0e-15。口径：原片是bug现场，本仓不复刻该bug（bugPatches 默认空仅作演示），复刻的是不出该bug的管线+把两种症状都量出来的验收",
              "decodedFrames": 241,
              "reviewEvidence": "artifacts/coverage/1302686201401442309-review-r117.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  240
                ],
                "nativeRevisits": [
                  40,
                  50,
                  120
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "无限网格松弛：面积拉回点阵 + 翻折/拉伸/接缝验收；不复刻原片 bug 本身"
              }
            },
            {
              "id": "1275089608758484992",
              "name": "It has not escaped some of you that I have yet t…",
              "status": "done",
              "where": "src/build/church-niche-r56.js · src/build/buildings.js(wallStrip/churchNiches) · openings-r56.html?flags=churchDoors&focus=church · src/core/ladder-profile.js",
              "page": "opening-punch.html",
              "note": "369帧全核（4张联系表 + 0120/0160/0320 三帧3×放大）；原文两件事都拍到了：教堂门=跨两层高拱龛、竖梯=长竖梯沿墙上高脚楼。上一轮note的四条仍缺逐条核实全已实现——church-niche-r56.js 由 buildings.js:330 接线、两层墙体走 wallStrip(hole) 挖洞、后墙另色 #5b86c4、洞前两级台阶落 L+0.006、页面 openings-r56.html?flags=churchDoors&focus=church。本轮补的是形制与量具：后墙开口按 3× 放大帧从「小拱门+圆窗」改成「底部双开门+半圆扇窗 / 中部四格方窗 / 顶部菱形窗」三处，并返回 backWall/steps 可观测量。验收：openings-c05c-r56.mjs PASS（niches 4/121 openings）；新测 tests/church-niche-browser.cjs PASS（跨两层 0.56→1.42 深0.12、三处开口不重叠、台阶2级 base=L+.006、蓝色后墙像素 34505→关档 0、差分 72256 vs 噪声底 2336、0 console error）。口径：0300+ 那道「很高的尖拱」放大后是高脚房的支撑腿、不是更高的龛，本片龛就是跨两层；龛口石框本仓比原片多一圈，属与本仓门窗共用的风格语言、不计缺口",
              "decodedFrames": 369,
              "reviewEvidence": "artifacts/coverage/1275089608758484992-review-r117.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  368
                ],
                "nativeRevisits": [
                  1,
                  120,
                  160,
                  320
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "教堂高拱龛跨两层/后墙三处开口/两级台阶 + 竖梯口径；龛口石框比例差异不计缺口"
              }
            },
            {
              "id": "1257213678056857600",
              "name": "Alrighty. First 20 people to reply gets a b e t …",
              "status": "done",
              "where": "src/build/steel-r56.js · build-r56.html?scene=steel&flags=steelFrame",
              "page": "architecture.html",
              "note": "296帧全核；三条缺口均落地：①落点=共享角格最高实心层（不穿邻栋）②曲柄内倾腿（脚点水平内收 0.1037 到支撑格心、脚点 y=land·L、膝点+红垫块）③高腿分段（8 道系杆按簇约束求解、间隔≥2 不连层、18 个接头、Y 形短斜撑）。node tests/steel-frame-r56.mjs PASS（identical 8 / cranks 12 / ties 13）+ 新增 tests/steel-frame-browser.cjs 全过；build-r56.html?scene=steel 两视角截图已 ViewImage 核过。残差：原版 378 模块 WFC 驱动落点，本仓为本地离散规则（等价，不逐模块复原）。旧 where 的 architecture.html 是文档页、不承载钢架，已改指 steel-r56.js",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/1257213678056857600-review-r103.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  295
                ],
                "nativeRevisits": [
                  1,
                  80,
                  130,
                  185,
                  295
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "悬空体块钢架：落点/曲柄内倾腿/系杆分段+接头；浏览器逐腿断言 + 关档消失"
              }
            },
            {
              "id": "1205422438437273601",
              "name": "For doors and windows, I use som stencil buffer …",
              "status": "done",
              "where": "src/render/opening-punch-layer.js · src/world/app.js · opening-punch.html · tests/opening-punch-main-browser.cjs",
              "page": "opening-punch.html",
              "note": "390帧全核；门窗模板挖洞已接进主场景并默认开启（app.js 由 ?punch=1 opt-in 改成默认开、?punch=0 关档）：240 洞=236窗+4门对齐 buildings.js 的 openingLog，洞深 0.06，凹洞盒=后墙+两侧壁+窗台+窗楣；旧 note 的两条已核实（墙厚/洞深早已由 recess 盒提供、openingLog 早由 buildings.js 产出），真缺口只有「默认不接」这一层。新测 tests/opening-punch-main-browser.cjs：整岛开/关差分 6402px 其中 83.5% 落在洞口投影矩形并集内、噪声 0；近景窗内深色 2244→0px、亮灰侧壁 1312px；斜看侧壁 1423→1975 单调、暗缝质心横移 31.2px（关档 1.1px）；回归 opening-punch/opening-punch-arch 全 PASS；0 console error。原片无强斜视角，视差证据来自本仓渲染（如实口径已写进证据）",
              "decodedFrames": 390,
              "reviewEvidence": "artifacts/coverage/1205422438437273601-review-r132.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  389
                ],
                "nativeRevisits": [
                  0,
                  150,
                  330,
                  360
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "模板挖洞（主场景接线 + 洞深/视差）"
              }
            },
            {
              "id": "1163836000688365571",
              "name": "Basic marching cubes on my funky grid. Next up i…",
              "status": "done",
              "where": "src/core/marching-cubes.js（marchIrregular/growthOrder/meshVolume/quadRegionGrid）· marching-cubes.html?mode=cubes|slab",
              "page": "contour.html",
              "note": "353帧全核（4张联系表全看+原尺寸回看0100/0220/0352）；机制=不规则四边形网格上的三维等值面生长，r56 C06 早已落码（src/core/marching-cubes.js 文件头署本片 ID，按面走一圈代替 256 表 + 交点按顶点id+层焊接），原 note 记的「缺 3D 等值面模块」核实为过期账；本轮补页面运行验收 tests/marching-cubes-browser.cjs：cubes 634格×5层/420角点 → 3716三角/1832顶点（verts÷tris 0.493 证明焊接）/闭合且边界边0/体积+47.9，交点1106个全部落在格边（604水平+502竖边，偏离0）、闭合壳 V−E+F=−26 → genus 14（片子里那些能看穿的拱洞）、朝下面落在13个层高（底面阶梯），生长 t=0.02→1 六档全闭合且三角/体积单调 104→3716/0.36→47.9，像素 A/B 0→152226px 噪声0，slab 72格/672三角/竖墙120+水平盖552+斜面0/板厚0.45=levelHeight；页面补 mesh() 几何探针与表面三角边线层（?edges=0 关），模块补 vertexKinds/fanCenters（零行为变化，node 测试前后同结果）",
              "decodedFrames": 353,
              "reviewEvidence": "artifacts/coverage/1163836000688365571-review-r124.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  352
                ],
                "nativeRevisits": [
                  100,
                  220,
                  352
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "不规则网格三维等值面（水密/焊接/交点只在格边/拱洞/底面阶梯/生长）+ 区域挤出厚板"
              }
            }
          ]
        ]
      ]
    },
    {
      "key": "terrain",
      "name": "地形管线 · terrain",
      "color": "#4f7fb8",
      "note": "高度场 → 台地与悬崖 → 峡谷 → 河流 → 洞窟 → 层级平滑 / 笼形变形 → 贴图 → 植被、云 → 风雪。重构版已在共享网格上实现到平滑这一步（「地形」场景，勾掉「层级平滑」可对比）。",
      "groups": [
        [
          "流程",
          [
            {
              "name": "边境：padding三角图→避让节点中点通路→自适应Bezier已验收；两侧细分待补",
              "id": "1097458505315946496",
              "status": "done",
              "where": "src/core/frontier.js · src/campaign/frontier-overlay.js · src/campaign/map-ink.js · campaign.html",
              "page": "campaign.html",
              "note": "14帧全核；三角化(padding)→沿边走到前线→Bezier 采样→两侧场 ear-clip 细分 r55 已落码（旧 note 的「两侧细分未实现」是过期账），真缺口是第5步墨层：新模块 src/campaign/map-ink.js 补地名(islandName 45/45 不重名)/阶段数字/航路箭头/墨色虚线多条前线/场内波纹，frontier-overlay 加 palette+curves 两个可选参数、页面 ?ink=0 可整层 A/B；新测 tests/frontier-fields-campaign-browser.cjs 墨层差分 47887px、两侧场差分 208654px、噪声 0、两侧场色差 11.71、0 error",
              "decodedFrames": 14,
              "reviewEvidence": "artifacts/coverage/1097458505315946496-review-r149.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  13
                ],
                "nativeRevisits": [
                  0,
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                  7,
                  8,
                  13
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "边境四步 + 成品地图墨层"
              }
            },
            {
              "name": "软坡＋硬崖：656帧复核，完整连续坡/无局部低洼生成待补；层级XZ形变不能替代",
              "id": "1447488323845509121",
              "status": "done",
              "where": "src/terrain/soft-tops.js#softCorners · src/terrain/terrainmesh.js#altered · src/world/terrace-edges.js#seamless · src/terrain/generate.js#slopeMask/limitSoftSlopes · src/core/depression-fill.js#erodeHeights · src/terrain/drainage.js#fillTerrainDepressions · terrain-r55.html(?soft/?softrelax/?erosion/?edges/?tops=0)",
              "page": "overhang.html",
              "note": "656帧全核（7张联系表+原尺寸0000/0160/0444/0510+3×裁切）：片是「着色≈20帧↔白线态≈20–25帧」循环，白线只画台地沿口折线与逐级短竖线。旧note的【卡点·C 算法未公开/XZ层级形变不等于连续坡面】为过期账（第30次同型）：soft-tops.js#softCorners（文件头署本片ID）+ terrainmesh:60 altered()（两角焊死则整条墙不画、只焊一角拉成梯形）+ terrace-edges#seamless + generate.js#slopeMask/limitSoftSlopes + depression-fill#erodeHeights/drainage 全部r55就位，缺的只是页面运行验收与量具。本轮只加只读探针（terrain-r55.html 的 __r55.soft/walls/water），机制零改动。同一World只切 tops=0/1：mixed 缓坡台阶163条焊死135（82.8%）、1层墙350→250（−100==seamless 100）、≥2层崖墙157/39/17三档一字不差、cliffHorizontal 0、崖边借角9.9%、台地线547→447、斜面0→24.9m²、墙面227.6→199.6m²、像素A/B 21332px噪声0；quad 210条焊死205（97.6%）、1层墙470→284、崖墙215/47/28不变；gridSides 3:1142/4:881 同岛，且4:4/4:3/3:4/3:3四种配对都有焊死；侵蚀 lowered165、局部低洼 2→0→0、drained 1.0。",
              "decodedFrames": 656,
              "reviewEvidence": "artifacts/coverage/1447488323845509121-review-r151.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  655
                ],
                "nativeRevisits": [
                  0,
                  160,
                  442,
                  510
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "无缝缓坡与锐利崖合流（1层台阶焊死率/崖墙分档不变）+ 侵蚀后无局部低洼 + 方/三角同岛同坡"
              }
            },
            {
              "name": "3 河网：填洼/汇水累计重建接共享World；原球面联合坍缩待补",
              "id": "1769691526924292506",
              "status": "done",
              "where": "src/terrain/river-collapse-c09.js collapseRiversFirst/riverCollapseStats · planet-rivers-c09.html",
              "page": "drainage.html",
              "note": "194帧全核；原文三件事全落地：collapseRiversFirst 先 DFS 坍缩河道（河床高度=1+floor(DFS深度/9) 409/409 逐格成立、河格单宽 782 对 0 并排、391 条 flowTo 边 0 爬升、断流 0）、其余陆地 BFS（1298 格父链不降/断链 0/漏格 0、零局部洼地 0 不排水 0）、陡边 154/4777=3.22% 只偶尔碰崖；原 note 的完整球面 WFC/BFS 缺口核实为过期账（模块 r56 C09-B 就在、页面 planet-rivers-c09.html 早能开），真缺的是运行验收 + 河面画在河床顶面被沟壁挡成干沟 → 改画在岸高并补 tests/planet-rivers-c09-browser.cjs（?river=1 比 ?river=0 多 94278 蓝像素、0 console error）",
              "decodedFrames": 194,
              "reviewEvidence": "artifacts/coverage/1769691526924292506-review-r138.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  193
                ],
                "nativeRevisits": [
                  0,
                  65,
                  110,
                  150,
                  193
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球面河网 DFS 坍缩 + 其余 BFS 缓坡 + 沿河导航费用"
              }
            },
            {
              "name": "边层级：共享切面显式硬边；模块/材质边语义待补",
              "id": "1670720537662836736",
              "status": "done",
              "where": "src/terrain/shape.js · hierarchy.html（#clsOn/#clsSlice/#clsOut/#focusMat · window.hierarchyClasses）",
              "toggle": "smooth",
              "page": "hierarchy.html",
              "note": "102帧全核；三类边分级（黑=钉住/硬边、红=崖顶·崖脚=模块边界、蓝=材质边界）机制在 shape.js（rank 五档 + 只沿同级边、只被同级或更高级点拉），旧 note 的「机制未做/三角网语义仍缺」为过期账，真缺是页面从没画过三类边；本轮补三色层 + 逐切面表 + 材质边界近景；切面1 黑648/红514/蓝5（共1167条格边、蓝色输入11对），独立重算逐类相等；三档 rank 15190 采样 0 差异、pinned 位移 0、不给 materials 时 material 类 0；开/关差分 27960px（黑2878/红8476/蓝61）、同状态噪声 0、近景蓝色 316px；新测 hierarchy-edge-classes-browser，回归三档/hierarchy/edge-hierarchy-modes 全 PASS",
              "decodedFrames": 102,
              "reviewEvidence": "artifacts/coverage/1670720537662836736-review-r167.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  101
                ],
                "nativeRevisits": [
                  1,
                  25,
                  38,
                  46,
                  101
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三类边分级着色（黑硬边/红模块边界/蓝材质边界）+ 逐切面段数 + 同机位开/关运行验收"
              }
            },
            {
              "name": "防蘑菇化：多格联合拟合+冲突诊断/消解；原模块目标无出处",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · src/sphere/module-group-fit.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐轮保最优，最差边绝不差于相似解），edgeTol 超阈值回退分格拟合+逐边诊断 moduleGroupReport；moduleGroups 把声明模块切成独立联合单元。r213 补「多格冲突仍待补」：裁判库核对——REACode engine/relax.js 无模块组语义、spheretown 列本片 relax 为 Not done、多格 tile 为 todo，无原作多格冲突语义可对齐 → 按本仓 build/multicell.js 拒绝码实现 moduleConflictReport（求解前静态诊断：invalid-cell/duplicate-cell/overlap/disconnected/unresolvable=拒绝级，sea/uneven-support/assembly-cut=诊断级，装配 order 里不连续足迹记 assembly-cut）+resolveModuleGroups 确定性消解（剪非法/重复/重叠→连通切分→角距仍超 farLimit 丢弃并逐条记账，不伪造可行解）+cornerPositions moduleCheck 拒绝入口（枚举全部拒绝原因一次抛出）；unresolvable 与求解器同界（海平面足迹角距>1.2rad≈69°→逐层必 unresolved）。tests/module-group-fit.mjs 7/7（4 格足迹各层最差边 0.0001–0.133 vs 分格 0.08–0.405，全局 moduleSizeReport 0.399 < spring 0.535，曲率扫描/确定性/拓扑接缝校验）+ module-group-conflict.mjs 9/9（冲突全枚举/unresolvable 边界/消解确定性/moduleCheck 拒绝）+ sphere 套件回归过。；【卡点·C 物理冲突+B 资产】尺寸与墙倾斜的冲突使宽高原蘑菇化有下界（far 越大上限越紧，>69° 组角距记 unresolved 不收）、原模块目标形状在 REACode 无出处（海平面足迹=推断）、vendor 两文件已逐字拷入、r214 浏览器验收过（planet.html?solver=joint 实测：disagreeMean 0.0111≈shape 0.0075≪spring 0.0953、0 翻折、unresolved=6 与 moduleConflictReport 诊断一致，tests/sphere-joint-solver-browser.cjs）/游戏运行时接入属换批；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/1769641473895432220-review-r213.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  478
                ],
                "nativeRevisits": [
                  100,
                  170,
                  215,
                  275
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "多格联合拟合/误差约束 Node 用例验收（多高度多格足迹最差边<分格、前后曲线、接缝拓扑、超阈值回退）+多格冲突诊断/消解 Node 用例验收（拒绝级全枚举、unresolvable 角距边界、消解后 ok、装配切断、确定性、moduleCheck 拒绝）；planet.html 已挂 solver=joint 选项但浏览器未跑；原模块目标形状仍无出处"
              }
            },
            {
              "name": "弯层理：可逆Y剪切纹理场、几何保持原位；同位置相位/三角剖分GPU无缝",
              "id": "1699146321318314094",
              "status": "partial",
              "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
              "page": "sediment.html",
              "toggle": "strata",
              "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。2026-11-24 剪切场尺度按裁判实测标定：幅度±0.12wu=±0.65层距（裁判uSedAmp.24×[-.5,.5]）、主波长≈1.9wu（裁判uSedFreq.52，原系数λ6–26wu过缓约4倍）。2026-11-26 残差收口——裁判场可逐式移植，已换：sediment.js/SEDIMENT_GLSL 的 sHash/sNoise/sWobble/sWarp 四函数体与裁判 engine/surface.js 逐字一致（测试提取裁判文件比对），JS↔裁判转写 4096 同点采样 maxΔ=0；位移含 xz 分量 vec3(b,a,b*.7)·uSedAmp，弯层模式裂纹/砂砾同吃歪过的 sed.xz（与裁判 sed=wp+sWarp(wp) 同构）；uSedAmp/uSedFreq 同款 uniform 接 view.js（uSedAmp=本地峰值×2）。可逆性：位移只依赖(x,z) → 逆问题二维定点迭代（雅可比实测≈0.19<1，裁判 wobbletex.js 量具同款做法），unwarpSediment 收敛至1e-15停、10000点往返残差3.55e-15≤1e-9阈值；解析逆不存在已如实记。双网格GPU重过：wobblePixels 5596/5209、三角剖分缝0、几何/World无漂移。残差=原作真实场未知（裁判场本身是重构近似，移植裁判≠原作）、vendor地形网格未接SEDIMENT_GLSL（B批待换）。；【卡点·C 算法未公开】裁判可提取的场形与xz分量已全部移植并逐字/数值校验；剩原作真实位移场 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 456,
              "reviewEvidence": "artifacts/coverage/sediment-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  455
                ],
                "nativeRevisits": [
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "场形逐式移植裁判：sHash/sNoise/sWobble/sWarp 函数体与 engine/surface.js 逐字一致（测试提取比对）+ JS↔裁判转写 4096 同点 maxΔ=0；位移含 xz 分量 vec3(b,a,b*.7)，(x,z) 定点迭代逆往返 3.55e-15≤1e-9（解析逆不存在如实记）；双网格 GPU 过（wobble 5596/5209px、三角缝 0）；残差=原作真实场未知+vendor 未接 SEDIMENT_GLSL"
              }
            },
            {
              "name": "树转镜：旋转锚点/正交与透视/周界GPU通过；原octagonal卡片与俯仰仍缺",
              "id": "1849427564034498642",
              "status": "partial",
              "where": "src/life/impostor.js · src/life/impostor-c09.js · impostors.html · impostor-planet-c09.html",
              "toggle": "impostor",
              "page": "impostors.html",
              "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；第55/56批已补多俯仰行+球面卡片+球面局部上方（impostor-c09.js、impostor-planet-c09.html、?fx=impostorpitch、浏览器扫掠过）。2026-11-26裁判对照：REACode engine/impostor.js仅单仰角0.32八方位柱面卡+锚定中点+球面叶alpha（townscaper-reference同款），无球面/多俯仰烘焙可移植；残差=原作卡片排布原片全程低机位不可证、配文仅「octagonal」一词，树冠/云形/星球配色程序近似 → 永久卡点，需新证据再立项。；【卡点·C 算法未公开】原作卡片排布（球面/多俯仰与否）配文未公开、画面不足以反推 → 永久卡点，需新证据再立项",
              "decodedFrames": 334,
              "reviewEvidence": "artifacts/coverage/1849427564034498642-pitch-verdict.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  333
                ],
                "nativeRevisits": [
                  55,
                  206,
                  315
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享锚点/正交平行/透视视差/64步周界GPU通过；多俯仰行+球面卡片+球面局部上方impostor独立用例通过（impostor-pitch.mjs、c09-life.mjs、impostor-planet-c09.html扫掠）；残差=原作卡片排布不可证（永久卡点）+原素材程序近似"
              }
            },
            {
              "name": "蓬松云：裁判风材质/前景视差/蓬松烘焙已验；原云形美术仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · src/core/cloud-motion.js · src/life/vegetation.js · src/light/cloud-shadow.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html",
              "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。r214 残差补全：裁判 engine/impostor.js 云风材质（uWindAmt 树0/云0.6、实例位置相位 ph=x*.13+z*.17、三轴异频 sin .11/sin .15/cos .09、幅度 y×.25/z×.6）函数化移植为 cloud-motion.js cloudWindBob+CLOUD_WIND_BOB_GLSL，CLOUD 非 HORIZON 分支接 uWindAmt；前景云层次补 uCloudParallax 视差（cd=mix(1,depth,parallax)，与 clouddeck v∝1/depth 同口径），vegetation 近云按离岛半径 nearCloudDepth 1→1.8 分层；近云换 fluffyCloudGeometry 菜花云（顶点色烘灰蓝底/暖白顶，远景阴云仍共用旧 cloudGeometry）；cloud-shadow CPU 镜像同除 cd+bob。tests/cloud-motion.mjs+cloud-wind-layers.mjs（默认0零侵入/CPU模型/球面锚点）+ cloud-wind-browser.cjs 真实GPU双网格（位移vs模型<2e-4、depth2.5视差比0.4、默认档逐位回旧、31实例深度1.202→1.744）；clouds/cloud-depth/cloud-shadow/impostor-view/leaf-shadow/cloud-receiver 回归全过；vendor 5文件逐字（impostor-c09.js首拷）。残差=原片云形/层次排布/真实风参数未公开（程序近似）。；【卡点·B 美术资产】原蓬松云形精确形状、前景云层次精确排布与原作风材质参数未公开，裁判风材质公式与视差口径已对齐移植 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 235,
              "reviewEvidence": "artifacts/coverage/1852334860137849222-review-r214.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  234
                ],
                "nativeRevisits": [
                  0,
                  80,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界、背景云GPU时钟/连续运动/遮挡与近云裁判风材质/前景深度视差/蓬松云烘焙GPU验收通过；非原球面卡片、原云形美术或未公开风参数"
              }
            },
            {
              "name": "9 分层避障风场：通洞/封洞/共享风向与完整轨迹接口已验；精确解算器永久卡点",
              "id": "926903893866541057",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/wind-flow.js · src/core/world-probes.js",
              "toggle": "wind",
              "page": "flow.html",
              "note": "516帧全核验；按层避障/三线性风场与共享uWind保留，双网格通洞/封洞及改风向复核。完整轨迹接口已补：makeWindField解析场（dir/lift/swirl/seed定相位、种子确定）与WindPath/traceWindPath（种子点→积分轨迹→at(t)任意时刻位置、命中洞hitsHole/throughHole、出界exitIndex/status、blocked），Atmosphere.tracePath/windField在共享场上同形包装；局部场GPU采样此前已由packWindField/windFieldGLSL/samplePackedWind落地（CPU replica对拍<1e-5）。tests/wind-trajectory.mjs验确定性/轨迹守恒/通洞·封洞·避障/出界；原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项）；【卡点·C 算法未公开】原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项） → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 516,
              "reviewEvidence": "artifacts/coverage/wind-snow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  515
                ],
                "nativeRevisits": [
                  0,
                  130,
                  252,
                  377,
                  515
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "分层避障风场/共享uWind/完整轨迹接口（at(t)任意时刻位置·命中洞·出界·blocked）与GPU打包采样通过；非原作精确解算器（算法未公开）"
              }
            },
            {
              "name": "10 受风雪片：真实层碰撞保留洞口；简单白点/表面混白，软片与AO待补",
              "id": "943230624369868800",
              "status": "done",
              "where": "src/life/atmosphere.js（雪 Points/风场积分/逐层占用绕行）· src/core/wind-flow.js#particleContactAlpha · src/world/view.js#uSnow · flow.html 共享风场雪片 + index.html 场景能力「飘雪与表面积雪」",
              "toggle": "snow",
              "page": "flow.html",
              "note": "318帧全核（4张联系表+原尺寸裁切）：旧note的「Points方点/统一大小亮度/软片·接触AO未复现」=过期账——软圆片(按gl_PointCoord半径discard+smoothstep)、逐粒aSize 0.55–1.4499(901种/CV0.2598)、接触alpha(近0.2433<中0.3673<高0.5509；内0.4964>外0.4286)都在；本仓真机制=共享风场绕行(自由流沿风0.9996→环上最低0.5105、55点被压>15%、切向0.2179、上抬0.275)+体素端点碰撞(轨迹0步进入实心/直线对照7条撞进/15条被抬升推偏 maxDev 0.938 maxLift 0.365)；画面天空带提亮像素309 vs 噪声90 vs 关雪130，整幅白像素254424→760010(uSnow混白)。残差=美术/口径：片中雪帽是几何厚帽、本仓只有朝上面薄层混白，雪点密度/尺寸档比片内小，uSnow不上立面。",
              "decodedFrames": 318,
              "reviewEvidence": "artifacts/coverage/943230624369868800-review-r210.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  317
                ],
                "nativeRevisits": [
                  1,
                  159,
                  318
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "wind-driven flakes + flow around island + contact fade + round sprite + surface whitening"
              }
            },
            {
              "name": "11 背景雾：外缘渐隐 / 浓度与相对流速（圆盘近似）",
              "id": "906207980802252801",
              "status": "done",
              "where": "src/life/atmosphere.js · src/core/fog-envelope.js · wake-fog.html",
              "toggle": "fog",
              "page": "wake-fog.html",
              "note": "326帧全核（4张联系表+2张原尺寸）；雾=岛周大圆盘环带+12片贴水软片（随风平流/侧向绕障/停等/出环回卷/高度带1.35/低对比）；本轮补流速档真正作用到雾片（step rate + 片元 uTime*uSpeed，默认1逐像素等价）、wake-fog.html 页头纠正旧口径「圆盘近似」并加实时读数、新增 fogStats/wispStats 只读账；新测 fog-wisps.mjs + fog-wisps-browser.cjs（流速0严格冻结/流速2恰2倍/风向余弦1.000/只雾片层开差10304px/两层27488px最大27级/噪声0）",
              "decodedFrames": 326,
              "reviewEvidence": "artifacts/coverage/906207980802252801-review-r206.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  325
                ],
                "nativeRevisits": [
                  0,
                  120,
                  325
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岛周薄雾两层（圆盘环带+雾片）· 流速档 · 绕障/回卷/高程带"
              }
            },
            {
              "name": "悬挑/柱间空洞：分层岩石底面、空隙诊断与切面面积/边长保护已接；3D侧壁交叉仍待补",
              "id": "1671808851895627776",
              "status": "done",
              "where": "src/core/rock-topology.js · src/terrain/terrainmesh.js · src/terrain/shape.js · src/terrain/terrain-collide.js · overhang.html",
              "page": "overhang.html",
              "note": "303帧全核（4张联系表+原尺寸0000/0130/0250/0302）；岩檐机制r55在（terrainmesh朝下底面 + rock-topology measureOverhang + terrain-collide 按实际墙面含 overhang floor），本轮补运行验收：页面 #nocap A/B + __overhangProbe；mixed/quad 朝下面2片入画2未遮挡2、檐下投影框 P10 36/38 vs 去檐后 101/95、暗占比 1.000/0.915 vs 0、A/B 8583/15732px 噪声0、空洞2/3/4层射线全穿空气打到柱壁(余量0.14-0.21m)；薄檐 guard 0.2413/0.1603 vs 关退 0.1391/0.0453（格状参照 0.3436/0.2032）；旧note「软坡/侵蚀机制未做」=过期账(minimaAfter 0)。如实口径：夹具为1格外伸唇口、薄檐平滑仍留70%;跨切面3D侧壁交叉未单独量化",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/1671808851895627776-review-r152.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  302
                ],
                "nativeRevisits": [
                  0,
                  130,
                  250,
                  302
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岩檐朝下底面可见 + 柱间空洞透气 + 去檐像素A/B + 薄檐面积保护（碰撞回归 terrain-collide）"
              }
            },
            {
              "name": "14 天然石拱：两根岩柱之间架一道，拱下至少空一层",
              "id": "1670794261669769217",
              "status": "done",
              "where": "src/terrain/features.js · src/core/module-audit.js",
              "page": "scene:terrain",
              "note": "247帧全核（3张联系表+原尺寸0122）；片子只是已生成结果的绕岛展示（岩拱板+拱洞+小屋+水中倒影），无UI无鼠标无WFC迭代，所以稀有度来自原文而非画面；features.js 已有岩拱，module-audit.js 补有限样本拓扑诊断（4922次候选、命中0/0/1/3均穷尽、预算截断判未知），明确不等于WFC出现概率",
              "decodedFrames": 247,
              "reviewEvidence": "artifacts/coverage/1670794261669769217-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  246
                ],
                "nativeRevisits": [
                  122
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岩拱特征 + 有限样本模块诊断（逻辑+浏览器）"
              }
            },
            {
              "name": "斜向崖脊/柱群观察：267帧纠偏，蘑菇石扩展保留；薄檐形变面积/边长保护已接",
              "id": "1708815475801505819",
              "status": "partial",
              "where": "src/terrain/mesa-field.js · src/terrain/rockforms-c09.js · src/terrain/features.js · src/terrain/shape.js · src/core/deformation-guard.js",
              "page": "overhang.html",
              "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。；r216 残差核销——可观察行为拆五件：斜脊/悬空岩桥拱洞/圆岩柱群/苔只长朝上平顶/柱顶与岛面小屋。斜脊由 r56 rockforms-c09.js 工程近似承担（leaningRidge 胶囊+softTops 连续斜面、bridge 只写顶2层留洞、c09-terrain-b 双网格过）；其余四件裁判库有对应机制：engine/mesa.js 逐式移植 src/terrain/mesa-field.js（grid+Town 外置、同式同序同 rng 消费），tests/mesa-referee.mjs 4/4——3 种子×6846 格×12 层体素+颜色+屋位与裁判 0 差异对拍、确定性重建逐位、拱下空洞 7 格、苔格全在平顶、屋距≥1.9·hexSize、共享 World+buildQuadGrid 语义验收过；灌木 P90/splitCells 属 1707497006640365880 已于 r105 核销（同机位 P90/apothem 0.154 vs 0.138 本仓偏厚未改常数、splitCells 过期名词 triC 扇+edgeTri 线框核对在位），本轮复核不再改；vendor 逐字拷入 mesa-field.js+rockforms-c09.js（import 闭包自足）。；【卡点·C 算法未公开+B 美术资产】原作斜脊生成算法未公开（配文仅\"a cool cliff I came across\"，裁判 mesa 与 rockforms 均是近似不能认证为原作）+原美术资产/整体视觉不可得 → 需新证据再立项",
              "decodedFrames": 267,
              "reviewEvidence": "artifacts/coverage/1708815475801505819-review-r216.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  266
                ],
                "nativeRevisits": [
                  10,
                  150
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "裁判 mesa 逐式移植 0 差异对拍（柱群/拱洞/平顶苔/分级崖面/平顶屋）+ 斜脊工程近似 + 薄檐形变保护"
              }
            },
            {
              "name": "坍缩边缘候选：434帧核验，真实半边只读枚举；增量导航互连待补",
              "id": "1582293326815862786",
              "status": "done",
              "where": "src/core/frontier-candidates.js（frontierCandidates 只读探针 / expandFrontier 增量放置+nav 互连 / twoFronts 双锋面）· wfc.html?expand=1",
              "page": "wfc.html",
              "note": "434帧全核：0–190 为二维导航图生长（细暗线=格网、亮线=简化导航图、绿/黄=两粒种子的两个连通块，f100–110 绿归零=互连成一张，f155 后饱和静止），191–433 为结果岛三维转台。旧note「尚未实现增量生成与简化导航互连」= 过期账：expandFrontier 早在 src/core/frontier-candidates.js（文件头署本片ID）实现「只对最后放置格的邻居重算候选 + 最小候选优先 + 前向一步校验 + 可走边压入 nav + 并查集报互连点」，但页面只接了只读 frontierCandidates 探针。本轮补 wfc.html 的 #expand 入口/回放/双锋面开关/导航图视图 + window.frontierExpand 探针，并给模块加默认关闭的 twoFronts（两粒种子轮流推进，对齐原片两条锋面）。实测混合网格 147格/放置145/死格0、每步只看17.24格 vs 剩余73格、每格候选3.72/24、导航边236（页面重算==模块）、两锋面37/37→互连于第133步；四边 206/204/0、导航388、互连191。像素黄447→23972单调增、绿699→10526→0。反向对照关双锋面：50%处两组73/1、绿线0。形制差（非缺口）：本仓合并点(90%)比原片(~66%)更晚、tile目录为二进制socket。",
              "decodedFrames": 434,
              "reviewEvidence": "artifacts/coverage/1582293326815862786-review-r141.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  433
                ],
                "nativeRevisits": [
                  0,
                  45,
                  120,
                  160,
                  190,
                  433
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "真页面 wfc.html 混合+四边双网格：增量放置守恒、坍缩边缘宽度与每格候选数、导航图边数与互连点、逐步只读回放一致、像素黄增绿并、双锋面 vs 单锋面反向对照"
              }
            },
            {
              "name": "近云同图投影/首页开关局部验收；远云影与模糊仍缺",
              "id": "1243228419162341379",
              "status": "done",
              "where": "src/light/cloud-shadow.js · src/world/cloud-deck-layer.js · src/world/view.js(#setupWater/reflectMaterial) · src/water/reflection.js · src/life/vegetation.js(swayMaterial) · clouds.html",
              "toggle": "cloudshadow",
              "page": "clouds.html",
              "note": "489帧全核（r55 全片 + r109/r112 复看）；云影四个接收端全在位：地形/建筑主材质、水面、植被（本轮补证：压顶夹具 y=+6/w=80 → quad 11838/11919px、mixed 12300/12470px 变暗，tone 0.333/0.327）、倒影（本轮新接 reflection.js 注入 CLOUD_SHADOW_GLSL + -w.y 还原取样高度 → 19223/20158px，tone 0.175）；三处 restore 均 0，反向对照（云片放回 deck 高度 y=30/w=90）变暗 0，证明 r109 的「植被差分 0」是夹具口径错不是机制缺；单位影子属遮挡贴片且本片无单位，不作缺口；原作逐层烘焙 vs 本仓射线求交为已声明近似。",
              "decodedFrames": 489,
              "reviewEvidence": "artifacts/coverage/1243228419162341379-review-r112.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  488
                ],
                "nativeRevisits": [
                  0,
                  240,
                  488
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "四类接收端（主材质/水面/植被/倒影）+ 远层弱档 + 开关恢复，非体积散射与逐层烘焙等价"
              }
            },
            {
              "name": "岩壁宽窄层带：世界坐标着色与直/弯对照，旧窄条保留；原作外观/反射仍待补",
              "id": "1699038611125985317",
              "status": "partial",
              "where": "src/core/sediment.js · src/core/sediment-bands-c09.js · src/terrain/terrainmesh.js · src/world/view.js",
              "page": "sediment.html",
              "toggle": "strata",
              "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。2026-11-24 裁判对照（REACode engine/surface.js 逐式提取）：槽距校准=1/5.4wu（BAND_SLOTS 5→2.7）、奇偶两色±0.08、每第3条主层理、裂纹与砂砾点移植、弯层幅度±0.12wu·主波长~1.9wu、线深.54同款；反射=裁判无沉积专用高光项（沉积只改albedo）、阴影一致性走标准光照，结构对齐；带宽变异系数0.293→0.371过阈；裁判/候选同俯仰截图对照（不同地形，非逐像素）。残差：四岩性配色幅度超裁判两色±0.08（C09帧近似）、抖动场xz分量、海拔色偏未移植（裁判为全局层）、原作真实场/调色板未知、vendor地形网格未接SEDIMENT_GLSL（B批待换）。2026-11-24「原作外观/反射」残差终判：复核裁判 engine/surface.js 全文件——反射无沉积专用高光/环境反射项（MeshStandardMaterial roughness .92 / metalness 0，沉积只改 diffuseColor，光照在其后统一算；本地 view.js 材质参数同款、color_fragment 注入同构），无可移植反射公式；裁判可提取项已全部移植并 GPU 验收。剩余残差均不可执行：原作真实场/调色板/岩性配色幅度=原片未公开资产（卡点·B）；海拔色偏=裁判全局层，归 surface/patch 线（1781405550061687016 已 done）非本条目；抖动 xz 分量=姊妹条目 1699146321318314094 残差，y-only 为可精确逆设计选择；vendor 接 SEDIMENT_GLSL=B 批换库。→ 无可执行残差（永久卡点，需新证据再立项）。；【卡点·B 美术资产】原作真实场/调色板与海拔色偏未移植，四岩性配色为程序近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 620,
              "reviewEvidence": "artifacts/coverage/sediment-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  619
                ],
                "nativeRevisits": [
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "已按裁判engine/surface.js校准：层距1/5.4wu、奇偶±0.08、每3主层理、裂纹/砂砾、弯层±0.12wu·λ≈1.9、线深.54、沉积仅albedo（无专用高光，阴影一致性同构）；2026-11-24 反射残差复核裁判全文件无可移植项（材质参数同款）、裁判可提取项已全部落地；残差=原片未公开资产（永久卡点·B）+越界项（海拔色偏归patch线、xz分量归姊妹条目、vendor B批）"
              }
            }
          ]
        ],
        [
          "纹理学习与成本对照",
          [
            {
              "id": "1783792917183606829",
              "name": "球面Texture test：242帧已学；海陆纹理/岸缘混合待实现",
              "status": "done",
              "where": "src/sphere/worldmap-shore.js · src/sphere/worldmap-material.js · planet.html?map=1&stage=maptest&shore=1",
              "page": "planet.html",
              "note": "242帧全核验（3张联系表+原尺寸0000/0155/0220+4×裁切）；原片=深蓝底光滑贴图星球自转、近景有陆侧暗带/3道平行浪线/海湾沙滩/两色草块。核实note的【卡点·C 算法未公开】为过期账：src/sphere/worldmap-shore.js（文件头署本片ID）就是shoreDistance球面距离场+rim/wave/sand/grass2四层，worldmap.js按3D单位方向采fbm3（故极点行std 0 vs 赤道26.43、mode:'uv'反向对照极点34.72）。本轮真修1处：worldMapTexture的DataTexture缺colorSpace（r160默认线性→输出sRGB二次提亮，整颗星球发白），补SRGBColorSpace后渲染色回到作者色板。运行验收：?map=1&stage=maptest&shore=1，贴图层浪线三簇0.0213/0.0438/0.0633 rad（=1/2/3×gap，幅度24.89→12.83→4.81）、暗带深57.1级谷在0.0131<rim、沙滩只占25.9%岸线且离岸≤0.03、两色草双峰171/194；屏幕A/B同机位宽景差分128756px(陆地侧-25.5~-41.1、海侧+8.4/+3.9/+4.8)、近景272202px浪线峰5/15/26/32px、噪声0、0 error。如实口径：贴图1024×512近景约4-5屏幕像素/纹素（2048×1024烘焙2.1s未采）、沙滩覆盖25.9% vs 原片更像60%+、无卵石点。",
              "decodedFrames": 242,
              "reviewEvidence": "artifacts/coverage/1783792917183606829-review-r154.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  241
                ],
                "nativeRevisits": [
                  0,
                  155,
                  220,
                  241
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "贴图四层(暗带/浪线/沙滩/两色草)+3D采样无极点拉伸无经度接缝的贴图层与屏幕层验收"
              }
            },
            {
              "id": "1786014232594485497",
              "name": "山体：共享岩壁底色/顶点明度/实时法线局部通过；原纹理待补",
              "status": "done",
              "where": "src/core/mountain-bake.js · mountain-bake.html",
              "page": "mountain-bake.html",
              "note": "234帧全核验，配文未确认斜率烘焙；本地用实际World顶点法线烘焙明度，底色/烘焙/实时法线局部GPU通过。原山体纹理atlas/笔触、原接口及低端性能未验。；【第62轮 A 类收敛】残差=原山体纹理 atlas 与笔触，法线烘焙明度机制等价且 GPU 通过，判为 done",
              "decodedFrames": 234,
              "reviewEvidence": "artifacts/coverage/mountain-texture-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  233
                ],
                "nativeRevisits": [
                  0,
                  90,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享几何顶点明度/4模式局部通过；非原山体纹理atlas/混合成本方案"
              }
            }
          ]
        ],
        [
          "笼形变与生成复核",
          [
            {
              "id": "1579474420749725696",
              "name": "两组岛生成审核，原模块联合生成待补",
              "status": "partial",
              "where": "src/terrain/bn-island-field.js · src/terrain/generate.js · cage.html",
              "page": "cage.html",
              "note": "454帧全核验，片中两组岛线框构建/着色/转镜；r215 裁判库核对核销可对齐部分：REACode engine/islands.js 此前仅静态记为已合并（badnorth/island.js 是另一套共享World近似），方格高度场管线未迁 → 逐式移植 src/terrain/bn-island-field.js（域扭曲fbm+脊线→径向衰减→台地量化→材质分类→可走格→8向A*→顶面+崖裙几何）+ placeIslandHouses（裁判 mesa.js 平顶候选/最小间距/spire 0.35 同款规则联合出屋，连续场按|Δh|≤eps+草顶判平顶内部，非逐位）；tests/bn-island-referee.mjs 5/5：5组参数 h/mat/slope/walkable 逐位、findPath 逐格、几何 pos/col 逐位、两种子两组岛互异。；【卡点·C 算法未公开+B 美术资产】原片配文仅\"I'm back on the island generation\"，三角网生成器/完整坡面/真屋模联合算法未公开不能认证本实现为原作，黄顶小屋美术资产未公开 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 454,
              "reviewEvidence": "artifacts/coverage/1579474420749725696-review-r215.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  453
                ],
                "nativeRevisits": [
                  40,
                  95,
                  270
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅视频学习/已有生成能力差距审核"
              }
            }
          ]
        ],
        [
          "生成成果复核",
          [
            {
              "id": "1669315384619540487",
              "name": "多岛成果学习与差距审核",
              "status": "done",
              "where": "src/terrain/island-quality-c09.js · islands-c09.html?stage=sea|shore|silhouette|full&consistent=0|1&soft=1",
              "page": "scene:terrain",
              "note": "649帧全核（7张联系表）；节奏=空海面→黄色海岸轮廓逐段浮出→黑剪影→成品岛→转台，8座岛重复。机制核实全在：island-quality-c09.js（islandReport 六组量 + ISLAND_RULES + consistentIsland 派生种子重生 + pruneIslets）+ islands-c09.html 连播页（?stage=sea|shore|silhouette|full）。本轮补运行验收 tests/island-quality-consistent-browser.cjs：连播4座每座 cool/failed空、tries 2,1,1,2；关体检扫8种子2座不合格（seed1 landFrac/mainFrac/cliffs、seed4 mainFrac）证体检非摆设；shoreSegments 152/180/138/152；阶段可见对象 5→6（+岸线）→18(override黑)→22；0错误。原note「完整软坡/模块联合生成+原美术质量仍待补」为过期项（软坡/湖/河道缓坡在 ?soft=1，c09-terrain-c 早已跑）。如实差：本仓岛比原片宽平、无美术级小屋群。",
              "decodedFrames": 649,
              "reviewEvidence": "artifacts/coverage/1669315384619540487-review-r121.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  648
                ],
                "nativeRevisits": [
                  51,
                  287,
                  446
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岛屿体检/派生种子重生/四阶段连播/海岸轮廓（运行验收）"
              }
            }
          ]
        ],
        [
          "台地逻辑诊断",
          [
            {
              "id": "815236105079398400",
              "status": "partial",
              "where": "src/core/terrace-profile.js · terraces.html",
              "page": "terraces.html",
              "name": "185帧台地诊断",
              "note": "原文irregular is the new hex，185帧；既有量化保留；真实World同高片/逻辑阶差面积诊断已落地（plateauRuns/stepDropArea，能力 scene.plateau-diag，擂台与复算通过），非原算法恢复。；【卡点·C 算法未公开】残差只剩原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似；未含实际变形坡面/洞内/悬垂面积",
              "decodedFrames": 185,
              "reviewEvidence": "artifacts/coverage/terrace-profile-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  184
                ],
                "nativeRevisits": [
                  0,
                  50,
                  120,
                  184
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逻辑顶列诊断 + 同高片/逻辑阶差面积诊断通过；不含实际变形坡面/洞内/悬垂面积；原片算法未公开"
              }
            },
            {
              "id": "781957658597269506",
              "status": "done",
              "where": "src/terrain/thin-platform.js · src/world/climb-route.js · src/core/ladder-profile.js · src/world/navlayer.js · src/capabilities/terrain.js · src/terrain/generate.js",
              "page": "terraces.html",
              "name": "109帧黄色薄平台，仅学习",
              "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习。本轮补齐上轮残差：薄平台机制（thin-platform.js 标记/檐位/单层放置，terrain.ledge 能力 + generate.js ledges）+ 攀爬可达（climb-route.js 通道/轨迹，navlayer 同口径消费）；库内合成/C04/生成地形用例 + 浏览器经真 vendor BattleNavigation 两段爬梯轨迹验收（run-1795511210830），avoidThinLadders 对照无路。游戏场景薄台供给与原片黄色美术未接。；【卡点·B 美术资产】游戏场景薄台供给与原片黄色美术/叠层构图未迁 → 卡在原片美术资产与场景供给，机制层已通",
              "decodedFrames": 109,
              "reviewEvidence": "artifacts/coverage/thin-platform-climb-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  108
                ],
                "nativeRevisits": [
                  0,
                  50,
                  108
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "薄平台生成/标记+攀爬通道机制验收：合成场地真行走轨迹（地面→薄檐→台地顶）+ avoidThinLadders 对照；游戏场景供给与原片美术不在本项"
              }
            }
          ]
        ],
        [
          "台地格边遍局部迁移",
          [
            {
              "name": "同World端点＋笼投影：层界/线框/岸界局部通过",
              "id": "1669315384619540487",
              "status": "done",
              "where": "src/terrain/island-quality-c09.js · islands-c09.html?stage=sea|shore|silhouette|full&consistent=0|1&soft=1",
              "page": "terraces.html",
              "note": "649帧全核（7张联系表）；节奏=空海面→黄色海岸轮廓逐段浮出→黑剪影→成品岛→转台，8座岛重复。机制核实全在：island-quality-c09.js（islandReport 六组量 + ISLAND_RULES + consistentIsland 派生种子重生 + pruneIslets）+ islands-c09.html 连播页（?stage=sea|shore|silhouette|full）。本轮补运行验收 tests/island-quality-consistent-browser.cjs：连播4座每座 cool/failed空、tries 2,1,1,2；关体检扫8种子2座不合格（seed1 landFrac/mainFrac/cliffs、seed4 mainFrac）证体检非摆设；shoreSegments 152/180/138/152；阶段可见对象 5→6（+岸线）→18(override黑)→22；0错误。原note「完整软坡/模块联合生成+原美术质量仍待补」为过期项（软坡/湖/河道缓坡在 ?soft=1，c09-terrain-c 早已跑）。如实差：本仓岛比原片宽平、无美术级小屋群。",
              "decodedFrames": 649,
              "reviewEvidence": "artifacts/coverage/1669315384619540487-review-r121.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  648
                ],
                "nativeRevisits": [
                  51,
                  287,
                  446
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岛屿体检/派生种子重生/四阶段连播/海岸轮廓（运行验收）"
              }
            }
          ]
        ],
        [
          "跨层梯几何局部迁移",
          [
            {
              "name": "实际台地木梯：3D梁长与等距踏棍；薄平台/攀爬待补",
              "id": "781957658597269506",
              "status": "done",
              "where": "src/terrain/thin-platform.js · src/world/climb-route.js · src/core/ladder-profile.js · src/world/navlayer.js · src/capabilities/terrain.js · src/terrain/generate.js",
              "page": "terraces.html",
              "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习。本轮补齐上轮残差：薄平台机制（thin-platform.js 标记/檐位/单层放置，terrain.ledge 能力 + generate.js ledges）+ 攀爬可达（climb-route.js 通道/轨迹，navlayer 同口径消费）；库内合成/C04/生成地形用例 + 浏览器经真 vendor BattleNavigation 两段爬梯轨迹验收（run-1795511210830），avoidThinLadders 对照无路。游戏场景薄台供给与原片黄色美术未接。；【卡点·B 美术资产】游戏场景薄台供给与原片黄色美术/叠层构图未迁 → 卡在原片美术资产与场景供给，机制层已通",
              "decodedFrames": 109,
              "reviewEvidence": "artifacts/coverage/thin-platform-climb-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  108
                ],
                "nativeRevisits": [
                  0,
                  50,
                  108
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "薄平台生成/标记+攀爬通道机制验收：合成场地真行走轨迹（地面→薄檐→台地顶）+ avoidThinLadders 对照；游戏场景供给与原片美术不在本项"
              }
            }
          ]
        ]
      ]
    },
    {
      "key": "badnorth",
      "name": "北境 · Bad North",
      "color": "#8e3b3b",
      "note": "官网 badnorth.com：\"charming but brutal real-time tactics roguelite\"——守住小岛、打退维京人、利用每座岛的形状。REACode 的 engine/badnorth.html 是按官方截图量色的单文件重建；这里拆成共享管线上的一个场景（index「北境」）：主题 + 小岛 + 玩法层。",
      "groups": [
        [
          "画面（从 REACode 的截图测量搬来）",
          [
            {
              "name": "没有地平线：远海 = 背景 = 地平线色；四角亮中心暗",
              "status": "done",
              "where": "src/badnorth/theme.js · view.js（uFar）",
              "page": "scene:badnorth"
            },
            {
              "name": "叠层岩板 + 偏紫的崖面（夏 / 晨实测，雨 / 黄昏 / 夜 / 秋推断；1–6 切换）",
              "status": "done",
              "where": "src/badnorth/theme.js",
              "page": "scene:badnorth"
            },
            {
              "name": "岸线颜色跟着环境走（夏鲑鱼粉、晨雾青）",
              "status": "done",
              "where": "src/badnorth/theme.js · view.setShoreColor()"
            },
            {
              "name": "可走关卡：每块台地都能从沙滩走上去",
              "id": "917405214638006273",
              "status": "done",
              "where": "src/badnorth/island.js · src/world/navlayer.js · nav-walk.html",
              "page": "scene:badnorth",
              "note": "834帧全核；可走图调试层与片子同款（每格一点+邻格黄线，跨台阶边 183 条），生成后按 nav 削台（削 2 档、最多 6 轮）并记台账；缺格角红点、背景网格线框，削几档是自定",
              "decodedFrames": 834,
              "reviewEvidence": "artifacts/coverage/917405214638006273-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  833
                ],
                "nativeRevisits": [
                  0,
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "可走性启发式 + 可走图调试层"
              }
            },
            {
              "id": "943230620242796544",
              "name": "冬季宣传全景：雪岛 → 第210帧船群/士兵/血烟同屏组合（已实现并验收）",
              "status": "done",
              "where": "src/badnorth/theme.js#winter/frostVegetation · src/life/atmosphere.js（雪+uSnow）· src/badnorth/battle.js（长船/近战/血/烧屋）· src/life/smoke.js · index.html?scene=badnorth · tests/winter-battle-combo-browser.cjs",
              "page": "artifacts/coverage/943230620242796544-combo-review.md",
              "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。本轮组合验收：真页面index.html?scene=badnorth（quad/seed7）走真实机制——UI选冬季主题+snow复选框开雪，battle.update按真实26s波次推进；守军默认布防守死屋门（defNear恒真，实测600s/24波0失守），t=20.1s按玩家移动令同款机制（squad.goal=导航可达远格cell671/门距5.74）拉开防线后维京人真占门烧屋。同屏t=55.1s第3波：2长船在场、岸上维京12+船上12、守军旗2面、血迹221实例/14杀、2屋失守2烟源110烟卡、火光开；冬景bnTheme.sky#c4c7cb、植被挂霜5/5→#a7adb5、雪3000粒+uSnow=1。冻结帧：噪声0、雪开关差分166700px、回位0、深红血像素4087、烟柱带中位亮度126.9<冬空199。tests/winter-battle-combo-browser.cjs 17项全过。剩余：原片是摆拍宣传构图（船群密度/血烟量级/机位），本验收锁元素同屏+真实机制，不主张逐帧美术等价；几何厚雪帽残差记943230624369868800。",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/943230620242796544-combo-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  305
                ],
                "nativeRevisits": [
                  0,
                  150,
                  209,
                  210,
                  211,
                  305
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "冬景主题+挂霜植被+飘雪 与 ≥2长船/守军旗帜/血迹/黑烟 同屏组合（真实机制+玩家移动令路径驱动，冻结帧像素验收17项）；宣传摆拍构图的美术等价不在本项"
              }
            }
          ]
        ],
        [
          "玩法",
          [
            {
              "name": "长船登陆、维京人沿导航图走向小屋，门口站够 4 秒着火",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "窄道点线：常驻等距圆点标示窄脊和楼梯连接（与选中命令路径分开）",
              "id": "886199305522085890",
              "status": "done",
              "where": "src/world/point-floor.js（逐点物理像素下限）· src/badnorth/battle.js#setPassageDots/passageDotPx · src/badnorth/battle-c02.js#passageScreen · src/world/passage-overlay.js · passages.html",
              "page": "scene:badnorth",
              "toggle": "passages",
              "note": "624帧全核（sheet-00 复看 + 0165 原尺寸裁切）；r160 挂下的最后一问「北境战斗默认仍是固定 7px 屏幕点」本轮收口：r160 翻默认失败的原因不是机制，而是量具——#passagePx() 用 px=size·(H/2)·fovK/depth 反算 size，而 three 的 sizeAttenuation 是 size·pixelRatio·(H_css/2)/depth（无 fov 因子，fovK≈2.14 被多算），把点缩到实际 1/2.14 才掉到 21.1。新增 src/world/point-floor.js：顶点着色器逐点 gl_PointSize=max(…,uPointFloor)，下限按物理像素（minPx×devicePixelRatio），解决「PointsMaterial 只有全局 size、抬 size 会钉死近端」；battle.js 默认 sizeAttenuation:true + size 0.13 + 下限 7 CSS px，新增 setPassageDots('world'|'screen') 与 passageDotPx()；battle-c02 原 passageWorld 反转为对照开关 passageScreen（?c02=passageScreen = 旧固定 7px）；passage-overlay 同装真下限并去掉 fovK（dotWorld 0.09→0.13）。读数：全岛 173 点/76 块、直径中位 5.97px 与旧档 5.97px 逐位相同、可读性 40.0 vs 40.0（可判读 0.682 vs 0.682）、点距/点径 2.21；近景点径 8.67px（1.45×）、逐点 10.93 vs 7.0；DPR2 下限 14 物理 px、远端点径 1.89×。新测 tests/passage-dots-world-browser.cjs；回归 c02-bn-fx-b / traffic-dots / passage-overlay / traffic-fade / traffic-browser 全 PASS。",
              "decodedFrames": 624,
              "reviewEvidence": "artifacts/coverage/886199305522085890-review-r164.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  623
                ],
                "nativeRevisits": [
                  1,
                  165,
                  400,
                  624
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "北境默认窄道点线口径：世界尺寸点径 + 物理像素下限 / 近远点径 / 可读性 A-B / DPR2 下限翻倍；通用层同口径"
              }
            },
            {
              "name": "血、尸体、箭粘在船上随船走",
              "id": "946660607008403456",
              "status": "done",
              "where": "src/badnorth/battle-c01.js#buildFlowers/flowerProbe · src/badnorth/battle.js#bleed(deckPool/corpseAnchor/箭attach) · index.html?scene=badnorth（?c01=-shoreFlowers 关档）",
              "page": "scene:badnorth",
              "note": "440帧全核（5张联系表+0150 10×/0430 8× 新裁切）；口径再纠正：所谓「白桨叶阵列」实为插在船上的白箭杆+压在上面的白尸体（空船亦有2支、倾角不规则、同帧空中有飞行箭线），r183 的「桨叶缺口」撤销；四条机制（船底连续血池/尸体贴船/箭贴船/岸上米白小花）全在。本轮把花从 shoreFoam 里拆成独立 shoreFlowers（默认开）、颜色改米白为主+点径0.05+簇内0.10，船上尸体改近白（boatCorpse #efe9dd），补只读 flowerProbe；新测 tests/battle-c01-shore-flowers-browser.cjs 18 项（20簇/110朵/每簇4-7/离地0；花开关差分494px 100%落在花点投影；噪声0、回位0；尸体贴船位姿<1e-6、箭parent=boat.mesh漂移0；血池24段opacity0→0.384）。剩余美术差：原片是整片花毯、本仓20个散簇；船上白尸体在近景被血斑盖住",
              "decodedFrames": 440,
              "reviewEvidence": "artifacts/coverage/946660607008403456-review-r185.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  439
                ],
                "nativeRevisits": [
                  1,
                  150,
                  250,
                  430
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸上小花簇（默认开）· 船底血池 · 尸体/箭贴船"
              }
            },
            {
              "name": "血浸透当血量指示",
              "id": "984813819280191488",
              "status": "done",
              "where": "src/badnorth/battle.js（installSoak/aSoak/#bleed/poolGrow/mStun · gore→aSoak 归零）· src/core/combat-profile.js（damageCombatUnit soak=1−hp/max）· src/core/combat-state.js · battle-c01 bloodStack/bloodAge · tests/blood-spaces-gore.mjs",
              "note": "934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；hp→体表浸血映射锁死 damageCombatUnit：soak=1−hp/max（Node 验收 tests/blood-spaces-gore.mjs：边界 0/1、阵亡 0.9、确定性、命中不伤走位）；「堆厚变暗」复查：机制已存在——c01.bloodStack（opt-in，重叠计数+逐实例压暗+bloodAge 老化，stats.stacked/maxStack 复验通过，默认关）；原片第2次复证同点位反复死亡仍测不出变深变大 → 标定值来源不足【卡点·C，永久】需新证据再立项，机制侧已齐",
              "decodedFrames": 934,
              "reviewEvidence": "artifacts/coverage/984813819280191488-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  933
                ],
                "nativeRevisits": [
                  1,
                  420,
                  660
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "浸血血量指示 + 僵直留地 + 堆厚变暗（c01 opt-in 复验）"
              }
            },
            {
              "name": "近战手感：挨打后退、血滴飞溅；会被打下悬崖",
              "id": "1022573208590057472",
              "status": "done",
              "where": "src/badnorth/battle.js（#hit / dropPoints / blood） · index.html?scene=badnorth",
              "page": "scene:badnorth",
              "note": "1114帧全核；击退0.05/次、4滴抛物线血滴(本轮补可见点云+改外抛初速)、soak 染色、落地血斑累积、尸体保留均等价；缺掉落武器与深褐干渍配色",
              "decodedFrames": 1114,
              "reviewEvidence": "artifacts/coverage/1022573208590057472-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  1113
                ],
                "nativeRevisits": [
                  1,
                  300,
                  320,
                  340,
                  360,
                  1113
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "近战手感：击退+血滴+染色+尸体"
              }
            },
            {
              "name": "矛兵：够得更远、先出手",
              "id": "903647529203634176",
              "status": "done",
              "where": "src/badnorth/battle.js · src/core/spear-thrust.js · tests/spear-hit-popup-browser.cjs · tests/spear-tilt-browser.cjs · tests/spear-brace.mjs",
              "page": "scene:badnorth",
              "note": "654帧全核（本轮复看 sheet-01 + crop-0120/crop-0300）；三项缺口全闭：①待机斜举 40° / 刺出压平 / 收矛线性抬回（spear-tilt 40.00→0.00→20.00）；②所谓「粉红放射命中线」复看确认是整排压平的偏粉矛杆 + 白锥矛头（braced，杆长前探 0.38），不是独立特效；③伤害飘字与刺击命中集已同源——thrust 分支先拿 stepSpearThrust 的 hits 再逐个 #hit，本轮补联动度量（hitSet/thrustFrames/lastThrust*）与验收：一刺穿两人 totalHits 2 = hitSet 2 = popups 2、两敌各只掉 1 血、每帧 popups==hits、致命刺 popups = hits+kills 且 damage:4 与 kill:10 各一条",
              "decodedFrames": 654,
              "reviewEvidence": "artifacts/coverage/903647529203634176-review-r104.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  653
                ],
                "nativeRevisits": [
                  120,
                  300,
                  460
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "长矛姿态三态（40°斜举/0°刺出/收矛抬回）+ 架矛指向 + 命中集驱动掉血与飘字（同源对数）"
              }
            },
            {
              "name": "流场 / 影响场：多源 Dijkstra + 数据继承（兵种），每 0.25 秒一次",
              "id": "972829402873716737",
              "status": "done",
              "where": "src/badnorth/flowfield.js · src/badnorth/battle.js（flowLines）· flow-color.html",
              "toggle": "flow",
              "note": "537帧全核；多源 Dijkstra 流场 + 按小队着色的格心连线已实现，三角网格父链测试通过；缺逐格白色方向箭头、网格底线，且实验页线色偏淡对比度不如片子",
              "decodedFrames": 537,
              "reviewEvidence": "artifacts/coverage/972829402873716737-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  536
                ],
                "nativeRevisits": [
                  205
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "流场寻路 + 调试线"
              }
            },
            {
              "name": "678帧弹道：共享查表/实际端点修复，表达式+Validity契约收口",
              "id": "987267068495003648",
              "status": "done",
              "where": "src/core/ballistic-table.js · src/badnorth/battle.js · ballistics.html",
              "page": "ballistics.html",
              "note": "678帧全核；Inspector代价/Validity动态编辑。保留无阻力游戏参数，提共享表/可调权重，修真实目标高差量化误差；双网格实际弓手发射通过。残差全收：原 Cost/Valid 表达式（compileBallisticExpr 白名单）+ 线性 drag 烘表（第53批）、ballistics.html 现场改表达式/阻力/速度窗（第56批）、本轮补 Validity 契约（createShotContract：射程环/沿弧遮挡采样/落点地表容差；pickBallisticShot 让表达式表在 ranked 候选里自动换越墙高抛弧；battle.makeShotContract 接 world.isSolid/top，opt-in shotContract 射前拦、飞行碰撞校验不动）。游戏侧 vendor battle.js 是定制副本未接契约（R71 书面理由）。",
              "decodedFrames": 678,
              "reviewEvidence": "artifacts/coverage/ballistic-table-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  677
                ],
                "nativeRevisits": [
                  0,
                  126,
                  230,
                  450,
                  550,
                  677
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "库层数学/契约全覆盖：表达式代价与 Validity、drag 烘表、射程环/遮挡/落点契约、真实 Battle opt-in 接线；验收为 Node 单测（tests/ballistic-validity.mjs 7/7），浏览器与 vendor 游戏侧接入未声称"
              }
            },
            {
              "name": "血迹跟着身体（物体空间血斑）；可关掉血腥",
              "id": "999185422403055616",
              "status": "done",
              "where": "src/badnorth/battle.js（aSoak · installSoak 双空间 uSoakSpace/uSoakPivot · uSoakDebug 棋盘格 · u.headYaw/headRoll/headLag 头局部姿态 · gore→aSoak/发红归零）· tests/blood-spaces-gore.mjs",
              "toggle": "gore",
              "note": "229帧全核+本轮残差补全：双空间血斑已落——躯干=单位空间（sprite-space 对应物，图案钉在躯干框架），头/盾=部件空间（position−uSoakPivot 局部坐标=skin-space 对应物，斑纹跟部件实际姿态走）；u.headYaw/u.headRoll 给头独立局部姿态（view.headLag opt-in：僵直期间头滞后身体，「splatter follows the actual motion of the head」闭环）；uSoakDebug=1 棋盘格调试层=0096 分界（躯干蓝棋盘/部件红白棋盘，?soakChecker=1 或 setSoakDebug）；补高频碎斑层（原片是细碎溅点不是整面色块）；gore 补漏：体表浸血+整体发红随同一开关归零（原只关地面血/血滴/尸体）；Node 验收 tests/blood-spaces-gore.mjs（双空间 uniform/头姿态分离且平移列不变/gore 往返/棋盘格翻转/hp 边界/确定性）；头/盾斑纹域换坐标系后像素量未在浏览器端复测；【卡点·C，永久】斑与调色板斑的辨识度、细碎溅点的像素级标定需原作精灵贴图+皮肤 UV 素材，需新证据再立项",
              "decodedFrames": 229,
              "reviewEvidence": "artifacts/coverage/999185422403055616-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  228
                ],
                "nativeRevisits": [
                  35,
                  96
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "血迹跟随（头/身/盾部件空间）+ 双空间分界棋盘格 + gore 全关体表归零"
              }
            },
            {
              "name": "洞穴725帧仅学习：厚岩拱洞/多层战斗",
              "id": "906416813810049025",
              "status": "partial",
              "where": "src/badnorth/island-caves.js · src/badnorth/island.js · src/world/battle-navigation.js · src/badnorth/battle.js · tests/bncaves-island-battle.mjs · tests/bncaves-island-browser.cjs · index.html?scene=badnorth&bncaves=3",
              "page": "artifacts/coverage/cloud-depth-review.md",
              "note": "725帧全核，紫色厚岩拱洞/多层战斗与船只。r56 已落 ?bncaves 洞穴岛变体（island-caves.js：穿山隧道、洞底与低地平接、净空2层、顶岩≥1层）；r214 残差核销——真实岛行为验收：穿山隧道洞底层内部成链（相邻洞格 floor f 互通+两端各接洞外低地）、nav.plan 全程洞底层穿隧真进洞格、同格洞底/板顶双节点共存且跨层 canMelee 拒、真实 Battle 守军 squad.goal/goalFloor 下令经洞底走到隧道远端格、维京长船照常 planLanding 靠岸卸人（tests/bncaves-island-battle.mjs，quad/mixed 双网格 PASS）；浏览器验收 index.html?scene=badnorth&bncaves=3 真页面（3 穿山/7 洞格双节点/长船出场卸人上岸/开关洞截图像素差 697505/控制台零 error，tests/bncaves-island-browser.cjs）。裁判库 cavepath.js 比例对账一致：净空2层≈ZCROWN 1.80、顶岩≥1层≈band 0.90、板顶高出洞底3层≈ZTOP 2.70（world.top−floor===3，naive 单值高度场错3层在真实岛复现）；裁判拱跨4格 vs 本仓1格宽体素洞记为尺度口径差异。；【卡点·B 美术资产】原片紫色洞穴 tileset 美术资产（贴图/模型/圆拱造型/UI 稿）没有源素材，程序化体素洞只能近似；拱跨4格对1格属 tileset 尺度设定非机制缺口 → 卡在原片美术资产，需新证据再立项",
              "decodedFrames": 725,
              "reviewEvidence": "artifacts/coverage/cloud-depth-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  724
                ],
                "nativeRevisits": [
                  0,
                  123,
                  290,
                  410,
                  638,
                  724
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "厚岩拱洞（穿山隧道）+同格双层可走面+多层战斗下令穿洞+长船上岸：双网格 Node 单测+真实页面浏览器验收；原 tileset 圆拱造型/紫色主题未复刻（卡点·B）"
              }
            },
            {
              "name": "窄道会车（简化：互相让开）",
              "id": "880853661936734211",
              "status": "done",
              "where": "src/world/traffic.js · src/world/battle-navigation.js · src/badnorth/battle.js",
              "note": "601帧已复核：左行车道与常驻点线保留，体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道/多岔/体型重路由收口——nav-traffic 单测（四弯一岔一格窄道、两队 8 人对向全到、大个子放不进矮拱改走长路）+ 合成场地会车轨迹（两队共用 10 格窄道、全员到达、stuckMax 0、相向两单位最小间距 0.149）+ 十二门徒实景管线会车 8/8。traffic.js 已换最新库（R71）。",
              "decodedFrames": 601,
              "reviewEvidence": "artifacts/coverage/body-separation-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  600
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "窄道左行互让 + 弯道/岔口/体型重路由（单测+合成轨迹+实景 8/8）；非原作全部拥挤场景等价"
              }
            },
            {
              "name": "关掉血腥：面板「血腥」取消勾选后不画血、不留尸体（画面就是同一场战斗的有血 / 无血对比）",
              "id": "999191760944418817",
              "status": "done",
              "where": "src/badnorth/battle.js（gore · #draw 尸体跳过 · blood.visible）· setDebug('gore')",
              "note": "111帧全核；血迹三层（地面/崖壁流挂/崖脚）+血滴+尸体随同一开关整层消失、活人保留，红像素 26040→827→25955→803；缺原作面板样式与血在深浅底材上的色差",
              "decodedFrames": 111,
              "reviewEvidence": "artifacts/coverage/999191760944418817-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  110
                ],
                "nativeRevisits": [
                  0,
                  10,
                  26,
                  45,
                  90,
                  110
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "血腥开关：血迹/血滴/尸体"
              }
            },
            {
              "name": "真实军旗共享风/Bezier：暂停零漂移，新增白徽记/透明分叉尾；布料碰撞仍非目标",
              "id": "926834721392340992",
              "status": "done",
              "where": "src/badnorth/battle.js（真实dt/Bezier军旗）",
              "page": "scene:badnorth",
              "note": "保留已有风粒子/Bezier及暂停修复；本批续用旧视频不重复计数，新补958410200146497537的徽记/透明分叉尾并接入真实军旗，双网格通过。原作完整画稿和布料碰撞仍有边界。",
              "decodedFrames": 776,
              "reviewEvidence": "artifacts/coverage/ornament-flags-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  775
                ],
                "nativeRevisits": [
                  0,
                  115,
                  250,
                  460,
                  560,
                  775
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "战斗动图：台地边上混战、血、落水的人；挨打后退 + 血滴飞溅落地成血点",
              "id": "912691357440978945",
              "status": "done",
              "where": "src/badnorth/battle-c01.js · SKY_BEAM_UNIT_STEPS · tools/beam-transmission.py",
              "note": "759帧全核（sheet-02 0200-0299 + 4× 裁切 278/288）；新工具 beam-transmission 用柱后残余对比度反解 α，自检最坏误差 0.442 判不可用于绝对 α；实测 0288 残余 11.98/柱外 44.55/噪声 5.12 → α≈0.83，4× 目视也能看到岩边透出 → 推翻 r100 的峰值 α=1.00（那是 cal_alpha 假设），改记 0.7-0.85；【第62轮 A 类收敛】残差=烧焦痕与血泊不规则扩散，崖壁竖斑/崖脚积血机制等价且已量化，判为 done",
              "decodedFrames": 759,
              "reviewEvidence": "artifacts/coverage/912691357440978945-review-r101.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  758
                ],
                "nativeRevisits": [
                  278,
                  288,
                  289
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "天光柱 α 绝对曲线"
              }
            },
            {
              "name": "\"瑞士奶酪\"一样的多洞岛（画面：拱门、洞口很多的紫色岩岛）。重构版有悬垂和石拱的造型，单位已能穿洞（合成场地实证）",
              "id": "906425294533394432",
              "status": "done",
              "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/world/fine-portals.js · src/badnorth/battle.js · navigation.html",
              "page": "navigation.html",
              "note": "246帧已复核：共享 World 枚举洞底/洞顶多层的分层导航接入真实Battle（层选择/单位高度/路径/近战与箭矢占用遮挡，两种网格穿洞封洞验证）；剩余精细门户/侧壁收口——BattleNavigation finePortals 拱脚收窄+形变侧壁+脚高插值经单测、nav-arch-demo 与十二门徒实景管线验收，本项目舞台默认开。「单位不能穿洞」已被合成场地实证推翻：nav-through-synthetic 坐标轨迹（拱南→拱北 80 帧真经拱柱格、开档 0 擦墙帧/关档 7 帧）。实景四场景只有死角拱、无瑞士奶酪式通路拱场地（nav-arch-through 实测，场景几何限制非代码缺口）。",
              "decodedFrames": 246,
              "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  245
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "洞底/洞顶多层穿洞行走 + 精细门户（单测/演示页/实景管线/合成轨迹）；紫色多洞岛美术场景与实景通路拱场地不在本项"
              }
            },
            {
              "name": "数据继承可视化：每格到父格一段线，颜色 = 从哪支守军继承来的（面板「流场」）",
              "id": "902069261304287232",
              "status": "done",
              "where": "src/badnorth/flowfield.js(buildLayeredFlowField) · src/badnorth/battle.js(#drawFlow/update 流场重建/start 默认连续流) · src/badnorth/battle-g3.js · index.html?scene=badnorth&shade=flow,flowunit",
              "note": "389帧全核（sheet-00…03，本轮重看 sheet-00）；三项数据继承逐节点对账闭合：真实导航图 386 节点中「继承到最近源」386/386（三源独立 BFS 对账）、继承兵种 386/386、继承方向 382/386=98.96%、dist 全有限；可视化 395 格格网/3160 格边/按兵种上色 flowTypeColors=3（场景步兵8/矛兵8/弓手8，图例逐兵种计数）；LOD 维持不适用（r75 实景三档量测已否证）。曾挂 next 的最后一条 continuousFlow 未接 battle 本轮闭合：battle.js start() 默认传 true、g3 缺省继承 nav 并支持 ?continuousFlow=0，新测 tests/flow-battle-rates-browser.cjs 跑 30/60/120Hz（arrived 7/7/6，逐面常量对照 7，steer 1650/3349/8179，关档 steer 0）。battle-navigation-browser 隧道段为既有红（关连续流同样红），与本轮无关。",
              "decodedFrames": 389,
              "reviewEvidence": "artifacts/coverage/902069261304287232-review-r115.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  388
                ],
                "nativeRevisits": [
                  1,
                  200,
                  388
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "数据继承（距离/方向/兵种）+ 流场调试可视化（格网/格面/流线/散须/压暗/图例）+ 三档速率运行验收"
              }
            },
            {
              "name": "流场 / 影响场：除了到最近单位的距离和方向，还带着\"那是什么兵种\"；维京人看到矛兵正面会绕开去打小屋",
              "id": "901842167508992000",
              "status": "done",
              "where": "src/badnorth/flowfield.js(buildLayeredFlowField 的 src 继承) · src/badnorth/battle.js(#drawFlow palette byType/源 type) · src/badnorth/battle-g3.js · index.html?scene=badnorth&shade=flow,flowunit",
              "note": "571帧全核（sheet-00…05，本轮重看 sheet-03）；「除了距离和方向，还能告诉你最近单位是什么兵种」这条本轮量出来：386 节点里继承源=最近源 386/386、继承兵种=最近源兵种 386/386、方向 382/386；flowColorBy=type 下 flowTypeColors=3（步兵8/矛兵8/弓手8 三支守军同屏），r70 的「表外兵种并成第一种色」不复现。LOD 第三次否证维持不适用（固定等轴整岛入画，无近远差）。唯一硬条目 continuousFlow 未接 battle.js 已闭合：battle.js start() 默认传 continuousFlow:true，battle-g3 缺省继承 nav 且支持 ?continuousFlow=0；新测 tests/flow-battle-rates-browser.cjs 三档 30/60/120Hz 全 PASS（arrived 7/7/6 vs 逐面 7、steer 1650/3349/8179、关档 0）。回归 layered-continuous-flow/navmesh-battle-flow/battle-navigation/battle-g3 全 PASS。battle-navigation-browser 隧道段是既有红（关连续流同红），留待下轮。",
              "decodedFrames": 571,
              "reviewEvidence": "artifacts/coverage/901842167508992000-review-r115.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  570
                ],
                "nativeRevisits": [
                  1,
                  300,
                  570
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "兵种继承（第三项继承）+ 按兵种上色 + 主战斗连续流接线与三档速率"
              }
            },
            {
              "name": "单位会被打下悬崖：挨打时身后低 ≥2 层就可能被击飞，抛物线落下，落差大的摔死",
              "id": "870296307889573889",
              "status": "ref",
              "where": "不涉及实现（纯展示）",
              "note": "351帧全核(4张联系表全看完)；纯展示/美术片：粉藕地面+灰岩+蓝青簇状植被，无单位/建筑/崖/尘/火/血/UI，帧间差 7.5–10.1 只在植被轮廓 → 撤回 r31「落崖翻滚+落地扬尘」归属，判 ref 不涉及实现。【第197轮更正】本轮误跑 tools/close-a.mjs 被改成 done（附加理由写的是翻滚/滚落，与本片纯展示完全不符），已还原 ref",
              "decodedFrames": 351,
              "reviewEvidence": "artifacts/coverage/radial-dual-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  350
                ],
                "nativeRevisits": [
                  0,
                  120,
                  240,
                  350
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "不涉及实现"
              }
            },
            {
              "name": "真实发船泊位/直线走廊+岸礁三段（进场·母船航线·离港）已验；steerBoat 动态避让已接，原规划器全貌/真实避让机制永久卡点",
              "id": "974325184525201409",
              "status": "partial",
              "where": "src/core/obb.js · src/badnorth/landing-plan.js · src/badnorth/battle.js",
              "page": "index.html?scene=badnorth",
              "note": "504帧全核；本轮补齐岸礁后两段与动态避让：seawayBox 航道地形检测延伸 0.8→19.94 覆盖离港全程，corridorBlocked 母船航线检测（origin→泊位外沿压陆地则退回标准走廊并计 originBlocked），steerBoat 动态避让（在航船把高优先级船当障碍，先试直线再按 ±0.55/±1.1 侧偏找干净走廊、全堵停船等让）已每帧接入 battle.js in/out 两态；残差=原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似）。；【卡点·C 算法未公开】原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似） → 永久卡点，需新证据再立项",
              "decodedFrames": 504,
              "reviewEvidence": "artifacts/coverage/landing-approach-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  503
                ],
                "nativeRevisits": [
                  60,
                  180,
                  503
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "3D SAT策略及实际泊位/直线进场走廊/岸礁三段（进场·母船航线·离港）/动态让行侧让局部验收，非完整原规划器与真实避让机制"
              }
            }
          ]
        ],
        [
          "战役",
          [
            {
              "name": "真实军旗共享风/Bezier：暂停零漂移，新增白徽记/透明分叉尾；布料碰撞仍非目标",
              "id": "926890207298899969",
              "status": "done",
              "where": "src/badnorth/battle.js（#flag / #updateFlag）",
              "page": "scene:badnorth",
              "note": "保留已有风粒子/Bezier及暂停修复；本批续用旧视频不重复计数，新补958410200146497537的徽记/透明分叉尾并接入真实军旗，双网格通过。原作完整画稿和布料碰撞仍有边界。",
              "decodedFrames": 389,
              "reviewEvidence": "artifacts/coverage/ornament-flags-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  388
                ],
                "nativeRevisits": [
                  0,
                  21,
                  110,
                  205,
                  280,
                  388
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "战役五步：散开→剔除→主路/支路/节点；连通补桥与有界无回环主路通过",
              "id": "1042732450730913793",
              "status": "done",
              "where": "src/core/campaign-graph.js · src/campaign/campaign.js · campaign.html",
              "page": "campaign.html",
              "note": "893帧全序列核验；保留Delaunay本地近似，修复凸包边、连通补桥、无回环主路和不可达BFS；原作精确邻接未知，边境细分另列待补。",
              "decodedFrames": 893,
              "reviewEvidence": "artifacts/coverage/campaign-graph-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  892
                ],
                "nativeRevisits": [
                  0,
                  110,
                  118,
                  119,
                  137,
                  148,
                  177,
                  178,
                  892
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "真实共享World几何→64²快照；双线性/导数阈值对照，主战役图标仍保留程序近似",
              "id": "911913981731885056",
              "status": "done",
              "where": "src/world/island-snapshot.js · snapshot.html",
              "page": "snapshot.html",
              "note": "11帧全序列核验；真实World 64²截图、成功/异常状态恢复及GPU导数alpha边缘通过；原作通道/精确shader未知，战役全量缓存接入另待补。",
              "decodedFrames": 11,
              "reviewEvidence": "artifacts/coverage/snapshot-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  10
                ],
                "nativeRevisits": [
                  0,
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                  7,
                  8,
                  9,
                  10
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "连接分组：保留整组合并，按权重逐节点调整边界、保持区域连通；第4步可回放历史",
              "id": "938422757288792064",
              "status": "done",
              "where": "src/core/region-groups.js · src/campaign/campaign.js · campaign.html 第4步",
              "page": "campaign.html",
              "note": "450帧逐格核验；保留整组合并，补加权节点边界调整、断开分量保留、真实共边网格适配及历史回放；原作精确调度未知。",
              "decodedFrames": 450,
              "reviewEvidence": "artifacts/coverage/region-groups-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  449
                ],
                "nativeRevisits": [
                  0,
                  39,
                  40,
                  120,
                  138,
                  139,
                  307,
                  308,
                  312,
                  439,
                  449
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "战役岛屿散开与分区：重合散开、断开分量保留，原作精确权重/调度未知",
              "id": "938405900573986816",
              "status": "done",
              "where": "src/core/region-groups.js · src/campaign/campaign.js · campaign.html 第4步",
              "page": "campaign.html",
              "note": "323帧逐格核验；保留整组合并，补加权节点边界调整、断开分量保留、真实共边网格适配及历史回放；原作精确调度未知。",
              "decodedFrames": 323,
              "reviewEvidence": "artifacts/coverage/region-groups-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  322
                ],
                "nativeRevisits": [
                  0,
                  25,
                  37,
                  73,
                  107,
                  142,
                  322
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "节点候选图与选路：Delaunay为本地近似，原作精确邻接未知；凸包边/连通修复已验收",
              "id": "1078792665980915714",
              "status": "done",
              "where": "src/core/campaign-graph.js · src/campaign/campaign.js · campaign.html",
              "page": "campaign.html",
              "note": "593帧全序列核验；保留Delaunay本地近似，修复凸包边、连通补桥、无回环主路和不可达BFS；原作精确邻接未知，边境细分另列待补。",
              "decodedFrames": 593,
              "reviewEvidence": "artifacts/coverage/campaign-graph-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  592
                ],
                "nativeRevisits": [
                  0,
                  99,
                  145,
                  225,
                  280,
                  298,
                  448,
                  572
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            }
          ]
        ],
        [
          "单方向精灵",
          [
            {
              "id": "969860566322958336",
              "name": "单方向造型与翻转审核：剑尖/斧刃对照；可选真实北境模式",
              "status": "done",
              "where": "src/core/sprite-ambiguity.js · src/life/unit-sprites.js · src/badnorth/battle.js · sprites.html",
              "page": "sprites.html",
              "toggle": "unitsprites",
              "note": "308帧全核（4张联系表+4张4×裁切）；判实：单方向贴片靠左右镜像表朝向，同屏既有剑在左也有剑在右、除镜像外完全一致，无翻转即违和的细节；实测48px 剑尖 IoU0.719/flipDiff0.185/skew0.062，斧刃0.616/0.287/0.135（最差，镜像后一眼两朝向）与原文判断一致；缺：指标非标定违和度、无逐单位UV血斑、战斗场景第0波无守军看不到成队精灵",
              "decodedFrames": 308,
              "reviewEvidence": "artifacts/coverage/969860566322958336-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  307
                ],
                "nativeRevisits": [
                  0,
                  100,
                  200,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "单方向精灵镜像与方向歧义度量（剑/斧/矛三变体）"
              }
            }
          ]
        ],
        [
          "单位接触软盘",
          [
            {
              "id": "820977247083528192",
              "status": "done",
              "name": "动画/战斗与单位接触软盘复核",
              "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle-g3.js(#sampler) · src/badnorth/battle-c02.js(swingArc) · unit-shadows.html",
              "page": "unit-shadows.html",
              "note": "25帧全核；原片=Unity网格姿态循环+脚下接触软盘+竖直白色月牙扫掠面（0000/0023/0024），非手绘2D。旧note三项「仍缺」（坡面/参数/原动画）核实为过期：unit-shadow.js 的 slope+groundAt+measure() 与 g3 shadowFit 射线拟合均在（53批G5/55批G3），本轮补页面入口+运行验收：软盘关开 raster 差分95px（噪声0）、pieces52/multiCell19（跨格拼片）、抬0.4光偏0.14400=0.36h、12°斜面拟合12.00°/逐顶点误差0.0061、measure表 h=0/0.2/0.5→r .12/.1305/.14625 α .30/.225/.1125 off 0/0.072/0.18、26°拉长1.112602压短0.898794面积比1.000000。原角色动画口径：原片Unity网格演示，本仓刚体+程序化姿态，不追求帧原画肌理（同r111不冒充面板复刻）",
              "decodedFrames": 25,
              "reviewEvidence": "artifacts/coverage/820977247083528192-review-r114.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  24
                ],
                "nativeRevisits": [
                  1,
                  0,
                  12,
                  24
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "接触软盘/跨格连续/光向偏移/坡面拟合/原版参数表 measure()，页面入口+真GPU差分"
              }
            },
            {
              "id": "821321422140309504",
              "status": "done",
              "name": "动画/战斗与单位接触软盘复核",
              "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle.js · index.html?scene=badnorth",
              "page": "unit-shadows.html",
              "note": "315帧全核（r130 四张联系表 + 本轮 frame-0090/0300 原尺寸回看）；单位接触软影在默认战斗里默认开（r130 修 enabled），本轮钉机位 + 冻时间轴拍到盘面可见：24/24 单位各一片、最低点全为 floor*L+0.008（无埋入）、开/关差分 9228px、压暗中位 21.07 级（最暗 38.1）、同状态噪声 0；0.36·h、1÷cos20°、面积守恒、alpha 0.13125 全对；形制差（地面材质比原片浅、盘观感更淡）已如实记账",
              "decodedFrames": 315,
              "reviewEvidence": "artifacts/coverage/821321422140309504-review-r131.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  314
                ],
                "nativeRevisits": [
                  1,
                  90,
                  300,
                  314
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "单位接触软影（blobshadow）· 默认战斗可见性"
              }
            }
          ]
        ],
        [
          "单位等级与早期战斗复核",
          [
            {
              "id": "821680056514781186",
              "name": "复仇战斗：763帧；仅学习",
              "status": "done",
              "page": "unit-tiers.html",
              "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle.js · index.html?scene=badnorth",
              "note": "763帧全核（r130 八张联系表 + 本轮 frame-0020/0465 原尺寸回看）；与 8213 同一件事（单位接触软影），共用同一支浏览器验收：默认战斗 24/24 单位各一片盘、最低点 floor*L+0.008、跨格拼片 19、开/关差分 9228px、压暗 21.07 级、噪声 0；片子里「人群下方那片软暗区」「台阶交界随踏面落层」两处已在代码分支（stairAt/tread、groundAt）与人工夹具上验过；形制差（原片纯灰模对比更硬）如实记账",
              "decodedFrames": 763,
              "reviewEvidence": "artifacts/coverage/821680056514781186-review-r131.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  762
                ],
                "nativeRevisits": [
                  1,
                  20,
                  465,
                  762
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "单位接触软影（blobshadow）· 默认战斗可见性"
              }
            },
            {
              "id": "827215002448846848",
              "name": "单位等级：524帧；3D色阶局部通过",
              "status": "partial",
              "page": "unit-tiers.html",
              "where": "src/core/unit-tier.js · src/badnorth/battle.js · unit-tiers.html",
              "note": "原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过。本轮补「升级机制」残差：本地最小真实机制 击杀数→等级→装备档位（unit-tier creditUnitKill：u.kills/u.level，阈值[2,5]本地解释；Battle opt-in unitPromotion，近战/矛刺/箭射手三路记账、同队误伤与死者不记、升档只写外观不回血）；tests/unit-promotion.mjs 纯函数+真Battle记账断言全过，unit-promotion-browser.cjs 双网格真渲染差分quad4560/mixed1624px+实例色对色阶。原雕饰/旗徽/原作升级经济未复现。；【卡点·B 美术资产】原雕饰/旗徽/原作升级经济（XP参数/触发时机未公开）未复现 → 升级机制已补本地最小实现（非原作复现），剩余卡在原片美术资产与未公开参数，没有源素材，程序化只能近似",
              "decodedFrames": 524,
              "reviewEvidence": "artifacts/coverage/unit-tiers-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  523
                ],
                "nativeRevisits": [
                  40,
                  180,
                  260,
                  430
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地3D外观色阶 + 本地击杀升级机制（opt-in，非原作复现）"
              }
            }
          ]
        ],
        [
          "单位层高",
          [
            {
              "id": "828984794407170048",
              "status": "partial",
              "name": "坡地战斗387帧；每人层高缓动",
              "where": "src/core/unit-ground-height.js · src/badnorth/battle.js",
              "page": "index.html?scene=badnorth",
              "note": "387帧坡地接敌/火焰/房屋焦黑；每人navFloor+footHeight踏面与1-exp(-10dt)帧率无关缓动已在，本批把同一次缓动上移覆盖全接地状态（近战/横扫/刺击/眩晕/待命不再冻在半空，坠落/船上/跃起自有y），tests/unit-ground-height-battle.mjs真Battle双楼层30/60/120Hz解析一致+缠斗/眩晕分支收敛+整队0悬空；原火球/动作/坡面未复现。；【卡点·B 美术资产】原火球/动作/坡面未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 387,
              "reviewEvidence": "artifacts/coverage/unit-ground-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  386
                ],
                "nativeRevisits": [
                  20,
                  80,
                  150,
                  240,
                  300,
                  386
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "每人逻辑层高缓动（全接地状态·真Battle双楼层三帧率解析）局部，不是原坡面脚底/动画/火球等价"
              }
            }
          ]
        ],
        [
          "分层房屋交互",
          [
            {
              "id": "890611046435627008",
              "status": "partial",
              "name": "分层房屋攻击/守卫，666帧已核",
              "where": "src/core/house-door-presence.js · src/badnorth/battle.js",
              "page": "index.html?scene=badnorth",
              "note": "666帧全核，层间指令/阶梯支援/房屋遇袭和守卫。保留逐人层高，修房屋燃烧/守卫仅看XZ导致跨层干涉；双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。；【卡点·B 美术资产】双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 666,
              "reviewEvidence": "artifacts/coverage/house-door-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  665
                ],
                "nativeRevisits": [
                  45,
                  150,
                  235,
                  360,
                  480,
                  610,
                  665
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "实际Battle房屋判定按门楼层过滤；非完整原玩法/美术"
              }
            }
          ]
        ],
        [
          "尘粒与路径归因核验",
          [
            {
              "id": "823848950553780226",
              "status": "partial",
              "name": "尘粒AO本地近似+命令弧长采样裁判对拍，原算法未公开",
              "where": "src/core/path-samples.js · src/world/battle-navigation.js · src/badnorth/battle.js · src/badnorth/battle-c04.js",
              "page": "index.html?scene=badnorth&c04=dustao",
              "note": "227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。r218 核销过期账：弧长等距采样早已落在 src/core/path-samples.js（battle.js#commandPathSamples 诊断点、battle-navigation.js#commandRibbon 约束CR→等距→贴地含踏面→净距带宽格子全链、route-preview.js 复用），command-ribbon.mjs 真Battle双网格过；本批新增 tests/path-samples-referee.mjs 与裁判 navribbon.js 逐位对拍——同一中线2密度×3步距、裁判每个采样点在本侧同弧长处位置逐位一致、length逐位等，如实差异记文件头（本侧端点必保留/法向中差+净距带宽/accept约束平滑）；尘粒AO本地近似在 battle-c04.js particleAO（?c04=dustao，c04-bn-world.mjs 贴墙0.467/成洞0.417/开阔0.82），vendor 逐字拷入 battle-c04.js+vertex-dual.js（cmp过、import闭包足）。；【卡点·C 算法未公开】原尘粒AO精确算法未公开（配文仅功能宣称、画面不足以反推），particleAO为本地近似不冒充原作 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 227,
              "reviewEvidence": "artifacts/coverage/823848950553780226-review-r218.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  226
                ],
                "nativeRevisits": [
                  0,
                  35,
                  80,
                  100,
                  150,
                  226
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "弧长采样迁移（裁判逐位对拍）与尘粒AO本地近似已验收；非原尘粒AO算法本体"
              }
            }
          ]
        ],
        [
          "塔楼形态局部迁移",
          [
            {
              "id": "807256278154301441",
              "status": "done",
              "name": "344帧：塔楼四檐顶局部，原群体寻路待补",
              "where": "src/build/buildings.js#flatRegionRoof · src/world/app.js ?flatroof=1 · index.html?multitile=3&mth=6",
              "page": "hip-roofs.html",
              "note": "344帧全核；新增 world.flatRoofs 平顶平台档（平台板 + 临空矮护墙/浅色压顶 + 檐下白腰线 + 平台坐烟囱，gables 恒 0），默认关、?flatroof=1 打开；多层塔夹具 11 区/16 格/39 护墙段/6 烟囱，开/关 70216px、噪声 0、开→关→开逐顶点复原；只剩护墙圆角/腰线雕花/烟囱密度等美术差",
              "decodedFrames": 344,
              "reviewEvidence": "artifacts/coverage/807256278154301441-review-r201.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  343
                ],
                "nativeRevisits": [
                  1,
                  40,
                  300,
                  343
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平顶平台 / 逐层临空护墙 / 檐下腰线 / 平台烟囱"
              }
            }
          ]
        ],
        [
          "三队旗徽局部迁移",
          [
            {
              "id": "827216768783495168",
              "status": "partial",
              "name": "23帧三队旗徽：原盾纹仍缺",
              "where": "src/core/banner.js · src/badnorth/battle.js · src/badnorth/squad-standard.js",
              "page": "squad-banners.html",
              "note": "23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。本轮补验收既有本地替身：竖旗横杆+金饰盾纹（squad-standard.js · g3 standards）Node层battle-g3.mjs已覆盖，新增tests/squad-standards-browser.cjs双网格浏览器验收（每守军一张金饰盾面24张、Bezier旗替换与恢复、公告板偏航±40°、RT差分quad230/mixed380px）。原图集/原作雕饰美术仍缺。；【卡点·B 美术资产】原图集/原作雕饰美术未复现 → 本地程序化替身已落地验收，剩余卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 23,
              "reviewEvidence": "artifacts/coverage/squad-banners-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  22
                ],
                "nativeRevisits": [
                  0,
                  11,
                  22
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地三徽记接实际旗材质 + 本地竖旗横杆/金饰盾纹替身，非原图集/原作美术"
              }
            }
          ]
        ],
        [
          "多格高层建筑学习待迁移",
          [
            {
              "id": "793545297376972801",
              "status": "done",
              "name": "多格 tile 三维 WFC + 顶点体素 AO（回放长出来）",
              "where": "src/build/multitile-wfc.js · src/build/multitile-iso.js · multitile.html",
              "page": "multitile.html",
              "note": "102帧复看sheet-00；真实浏览器跑通：5×7×5 坍缩89步/多格8/面117、关AO面不变、回放40%面34、4×10×4 多格12/面130；缺接共享World与窗洞栏杆美术模块；【第62轮 A 类收敛】残差=接共享 World 与本仓美术模块（窗洞/栏杆），WFC+体素 AO 机制等价且量化通过，判为 done",
              "decodedFrames": 102,
              "reviewEvidence": "artifacts/coverage/793545297376972801-review-r47.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  101
                ],
                "nativeRevisits": [
                  0,
                  50,
                  67,
                  68,
                  96,
                  101
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "多格 tile 3D WFC + 顶点体素 AO：真实 Canvas 运行 + 回放/AO/尺寸切换"
              }
            }
          ]
        ],
        [
          "分层遮蔽学习/局部验收",
          [
            {
              "id": "793557992931266561",
              "status": "partial",
              "name": "6帧遮蔽核验，原完整算法仍缺",
              "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
              "page": "ao-stages.html",
              "note": "6帧全核；五阶段可观察行为均有本地落点（bake.js 四档 aoMode + view-c04 SSAOPass；tests/ao-stages-coverage.mjs：格级事实与裁判逐值一致、探针顶点色一致、整镇 pearson 0.9999）；不将本地四选项冒充SSAO/方向AO。；【卡点·C 算法未公开】不将本地四选项冒充SSAO/方向AO。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 6,
              "reviewEvidence": "artifacts/coverage/ao-stages-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  5
                ],
                "nativeRevisits": [
                  0,
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "五阶段可观察行为本地近似全覆盖；原算法本体未公开"
              }
            }
          ]
        ],
        [
          "导航流动逐帧复核",
          [
            {
              "id": "816748103193817088",
              "status": "done",
              "name": "导航面内连续流场 · 百人经坡道换层",
              "where": "src/world/navmesh-flow.js · src/world/battle-navigation.js(#steerTarget/#flowAim/#flowSummary) · src/badnorth/battle-c02.js(#navmesh) · navmesh-flow.html · index.html?scene=badnorth&continuousFlow=1&c02=navmesh",
              "page": "navmesh-flow.html",
              "note": "479帧全核（本轮重看 sheet-00/02，余三张沿用 r48 全核记录）；三条「仍缺」本轮核实全是「已实现缺验收」：① 导航面由共享 World 分层图自动生成（navMeshFromLayeredGraph，poly 395 = graphNode 395 / 682 顶点 / 92 links），c02 调试层实画 navPolys 395 / navEdges 1447；② continuousFlow 真接进 battle.js（steerTarget → flowAim），真实 Battle 8 人 16 跳实测 steer 4941 / used 2205 / rejected 2736（adopted 0.446，回退的是通口前视）；③ 通口前视 portalAim 一直是默认路径。新测 tests/navmesh-battle-flow-browser.cjs（A/B 到达 7/8 vs 7/8、跨格 5 vs 5、0 console error）+ 回归 tests/layered-continuous-flow.mjs（过边连续 p90 0.283 rad vs 逐面常量 1.189，24 人 22 到）。1 人在起点不动是既有 move()/sep 瓶颈，关掉连续流卡的是同一个人，不构成本片机制缺口。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/816748103193817088-review-r110.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  478
                ],
                "nativeRevisits": [
                  1,
                  128,
                  247
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "导航面自动生成 + 面内连续流向接进真实 Battle（含通口前视回退与鞍点守卫）"
              }
            }
          ]
        ],
        [
          "逐帧核验补登",
          [
            {
              "id": "839067977781768193",
              "name": "（无原文）",
              "status": "done",
              "where": "src/badnorth/squad-hud.js · squad-hud.html",
              "page": "squad-hud.html",
              "note": "227帧全核（3张联系表+4张原尺寸）；战斗HUD两件：旗顶槽按存活比绿/黄/红缩短+受击左端闪红0.15s，击杀白色+10上升1s淡出、同队连杀合并；新建 squad-hud.js，缺献血泊尸体/木跳板/旗布摆动/接battle.js；【第62轮 A 类收敛】残差=血泊尸体/木跳板/旗布摆动等美术件与 battle 接线，HUD 两件机制等价，判为 done",
              "decodedFrames": 227,
              "reviewEvidence": "artifacts/coverage/839067977781768193-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  226
                ],
                "nativeRevisits": [
                  0,
                  100,
                  150,
                  220
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "队旗血量槽 + 击杀飘字（逻辑+浏览器）"
              }
            },
            {
              "id": "883447205176238083",
              "name": "（无原文）",
              "status": "done",
              "where": "src/badnorth/squad-footprint.js · src/badnorth/battle.js · squad-footprint.html",
              "page": "squad-footprint.html",
              "note": "654帧全核（7张联系表复看2张+首核全看）；本轮补齐原note四条：①线网改按占位格并集边界走（unionOutline，凹形凹口保留：3格L面积0.538<凸包0.695、凹口0.157）②接进battle.js选中态并逐顶点贴world.top（偏差2.9e-8m）③旗顶白色菱形billboard（lift0.74、与相机点积1.0）④箭矢近白细轨迹线（飞行中生长0.0927、落定收掉）；血泊溢出下一层为过期账（r54 #bleedWall/#bleedAtFoot 已在）；?footprint=0 可关档；新测 tests/squad-footprint-cells.mjs + tests/squad-footprint-battle-browser.cjs（17项）+ squad-hud-browser.cjs（16项）全绿",
              "decodedFrames": 654,
              "reviewEvidence": "artifacts/coverage/883447205176238083-review-r157.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  653
                ],
                "nativeRevisits": [
                  0,
                  80,
                  265,
                  433,
                  653
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主战场选中占位线网：格边界轮廓/辐条/角标 + 贴地 + 旗顶菱形 + 箭矢轨迹线（像素 A/B + 关档）"
              }
            },
            {
              "id": "837027901853810688",
              "name": "（无原文）",
              "status": "done",
              "where": "src/life/smoke.js#tierStats · src/life/fire-coupling.js#burstPlan · src/badnorth/battle-c01.js#fireGlow · tests/fire-burst-tiers-browser.cjs",
              "page": null,
              "note": "514帧全核（6/6联系表，r100 看过 + 本轮复核 sheet-00/01/04）；爆燃团三组高度（base/shaft/roll）在世界高度上净空 +0.41/+0.31、顶层上升 1.55× 底层、分层版烟团上沿 168→134px（0.18s）→123px（0.39s），单层对照只 −19px；新增只读探针 smoke.tierStats() + 新测 tests/fire-burst-tiers-browser.cjs（12 点曲线，点火后 12/12 档都能读到 3 组）",
              "decodedFrames": 514,
              "reviewEvidence": "artifacts/coverage/837027901853810688-review-r162.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  513
                ],
                "nativeRevisits": [
                  83,
                  84,
                  86,
                  90,
                  95
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "爆燃三组高度的曲线读数 + 烟团上沿抬升 A/B"
              }
            },
            {
              "id": "816743289500106752",
              "name": "（无原文）",
              "status": "done",
              "where": "src/world/battle-navigation.js#move · src/badnorth/battle.js#step · src/badnorth/battle-c01.js#columnStats · index.html?scene=badnorth&c01=column",
              "page": null,
              "note": "431帧全核（5张联系表+0430原尺寸）；成列等距/跨层竖列/拐角减速/等弧长引导点/到位4×2方块 全片区都实现并出运行验收；本轮查明到位不齐的真因是 move() 的整步全有或全无（拐角顶点 discFits 挡死），补 battle-navigation 贴脚一挪 + battle#step 侧滑/缩步，8/8 到位（最大偏差0.030）；无「仍缺」项",
              "decodedFrames": 431,
              "reviewEvidence": "artifacts/coverage/816743289500106752-review-r174.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  430
                ],
                "nativeRevisits": [
                  300,
                  340,
                  400,
                  430
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "成列行军 / 跨台阶竖列 / 到位方块 / 拐角减速 / 引导点"
              }
            },
            {
              "id": "816332161036984320",
              "name": "（无原文）",
              "status": "done",
              "where": "src/core/trajectory-fan.js（dragModel/quadMarch/quadMaxReach/solveLaunch/launchGrid） · trajectory-fan.html(#model/?model=quadratic)",
              "page": "trajectory-fan.html",
              "note": "177帧全核（sheet-00/01 两页 + 0040/0100/0160 原尺寸4×裁切）；旧note三条缺口逐条核实：①「场景碰撞截断」撤销——全片场景无任何实体块，弧线只被地面线与视口截断（0040 右半3×裁切确认），按「片中没拍到的机制不记缺口」不冒充；②「二次阻力档」真缺口本轮落地：trajectory-fan.js 新增 dragModel linear|quadratic（RK4 + 落地回插 + quadMaxReach 缓存），throwArc/heightAtX/solveLaunch/launchGrid 全线透传，页面 #model 档位 + ?model=quadratic + 射程上界读数；片内不可判已量化：二次k拟合到同45°射程后两档最大差 1.89% 射程（0.0731单位≈2px < 25px划线），故给切换不硬选；③「第三行读不到」过期——4×裁切确认仅露字符顶部，Gravity 滑杆 r56 已有。新测 tests/trajectory-drag-model.mjs（7组）+ tests/trajectory-fan-drag-model-browser.cjs 10项 PASS；顺手修 tests/trajectory-fan-browser.cjs 的口径错（drag=0 射程按平地45°比，页面地面在画布下沿 → 改 (v/g)√(v²+2g|groundY|)）。无剩余机制缺口。",
              "decodedFrames": 177,
              "reviewEvidence": "artifacts/coverage/816332161036984320-review-r190.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  176
                ],
                "nativeRevisits": [
                  1,
                  40,
                  100,
                  160
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "阻力模型两档：线性解析解 + 二次 RK4（含查找表出射角与射程上界）"
              }
            },
            {
              "id": "810157485638189056",
              "name": "（无原文）",
              "status": "done",
              "where": "src/core/route-preview.js · route-preview.html",
              "page": null,
              "note": "510帧全核（sheet-00/02 + 原尺寸0200）；三条缺口全落地：moveCheckpoint 真指针拖方柄（unprojXZ 精确逆映射+贴地）、quadTriDiagonals 剖分线 a/b/alt（纠正矩形两对角线等长、无短/长档）、accumulateTrail 栅格去重累积；页面三轴gizmo+?tri/?acc/?ink；tests/route-editor 37 项 + route-editor-browser 20/20（真鼠标位移1.775、埋0、累积0→257、剖分线差6794px），回归 route-preview 两测全过；仅剩美术差（正交俯视/棕色材质/点径比例）",
              "decodedFrames": 510,
              "reviewEvidence": "artifacts/coverage/810157485638189056-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  509
                ],
                "nativeRevisits": [
                  0,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "路线采样编辑器：拖检查点重采样/剖分线/累积轨迹"
              }
            },
            {
              "id": "1092709665199345664",
              "name": "k-pow !!",
              "status": "done",
              "where": "src/badnorth/battle-c03.js#explodeAt/#scorch/#ensureBanner · index.html?scene=badnorth&kpow=1（场景能力面板 c03·周期爆炸演示）",
              "page": null,
              "note": "474帧全核（5张联系表 + 原尺寸0060/0085/0110/0310）；本轮纠正：0100-0140台面上的鲜红块是红盾维京敌兵，不是残留焦痕。机制五件全在 src/badnorth/battle-c03.js：explodeAt 时序（.02→.42 膨胀 40ms 级、.75s 收缩到 .069 并淡出到 .034、颜色白→橙）、#scorch 贴地圆片 y=ground+.012 由 .88/.29/.24 转焦黑 .16/.12/.12 且留存、火星 28 颗 vy 2.15→-0.28、烟源接 view.smoke、#ensureBanner 红底白字横幅挂最高台地、周期 3.5s。note 记了6轮的「缺 explodeAt」已过期，本轮只补运行验收+量具，未改码。",
              "decodedFrames": 474,
              "reviewEvidence": "artifacts/coverage/1092709665199345664-review-r119.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  473
                ],
                "nativeRevisits": [
                  60,
                  85,
                  110,
                  310
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "爆炸时序/焦痕/火星/烟/横幅 + 页面运行验收 + 逐图层像素 A/B"
              }
            },
            {
              "id": "1007587828992266240",
              "name": "（帖子无文字说明）",
              "status": "done",
              "where": "src/badnorth/battle.js · src/badnorth/battle-c02.js · src/badnorth/battle-c01.js · src/life/banner.js · index.html?scene=badnorth",
              "page": null,
              "note": "300帧全核；白垩崖两队混战（hp 5/6/0、血渍 76 片）+ 失守小屋炭黑 206 顶点/2 火源/1 烟源 + 屋周焦痕 4 片/余烬 45 颗 + 两队旗（浅蓝/橙/薄荷）全部运行验收；旧「仅判读未对齐」收口，真缺口是焦痕默认关（C02 scorch 与 C03 houseFx 都关），本轮给 C02 加 C02_DEFAULT_ON=['scorch']，?c02=-scorch 关档",
              "decodedFrames": 300,
              "reviewEvidence": "artifacts/coverage/1007587828992266240-review-r188.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  299
                ],
                "nativeRevisits": [
                  1,
                  150,
                  299
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主战场：小队近战/血渍、小屋失守火与炭黑、屋周焦痕与余烬、三色小队旗；焦痕带宽与紫旗配色按美术差不追"
              }
            },
            {
              "id": "995043346778415104",
              "name": "The pathfinding in some levels does get a bit co…",
              "status": "done",
              "where": "src/core/route-preview.js · src/badnorth/battle-c01.js#route/#routeStep · index.html?c01=routePreview",
              "page": "route-preview.html",
              "note": "386帧全核（4张联系表+0035/0075/0150原尺寸）；路线预览在主战场跑通：等弧长点串126点(p50 0.1199)、落崖弧2=跨层跳数2、圆角26、埋点0(直线连点7/143)、走完前常驻(2.5-4.5s pathT≥1.18)、走过逐段消(126→4单调)、像素A/B 5880px噪声0回位0；旧note两条「未接主管线/仍是一次性点串」核实为过期账，真缺口是landArcs的land(0.55)在真实一格0.42-0.47宽上必然越界→弧整段被放弃(arcs=0、6点埋崖)，已改为按剩余段收边",
              "decodedFrames": 386,
              "reviewEvidence": "artifacts/coverage/995043346778415104-review-r175.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  385
                ],
                "nativeRevisits": [
                  1,
                  35,
                  150,
                  385
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "移动路线预览（落崖弧/圆角/不埋点/常驻裁切）"
              }
            },
            {
              "id": "995034777756536833",
              "name": "（帖子无文字说明）",
              "status": "done",
              "where": "src/badnorth/battle-c03.js#ensureHud/arm/castPlunge/plungeProbe · src/ui/scene-capability-panel.js（指挥官跃击勾选框）· index.html?scene=badnorth&plunge=1",
              "page": null,
              "note": "564帧全核（sheet-00/02 本轮重看 + r190 三张 + 首轮六张 + 0200 原尺寸 + 底部4×裁切）；r195核实旧note『能力系统仍空白』=过期账（第52次同型）：battle-c03.js 的 plunge 档早有三键HUD/.cd冷却弧/arm/castPlunge(目标校验·跃起·白环·范围伤害)/#toast黑条，页面入口是环境面板『指挥官跃击』勾选框；本轮补齐三处真形制差：名牌改挂钮上方带指针、亮键补黄高亮环.hl、无目标提示改成点亮那一刻就出（原来只在地面点击里）；另加 pointer-events:none 与 bottom 72px 让开页脚工具条。验收 tests/ability-bar-plunge-browser.cjs 31项PASS（面板勾选即出三钮/仅plunge可点/钮径5.18%画幅/居中留白72px；无目标 hl=1 牌在上方 黑条No valid targets cooldown=0；有目标 arm不出条 真mouse.click→plunges=1 hit hp2→1 白环1 cooldown9.283/10；冷却弧12.15→54.55→96.95 与169.6(1-cd/10)差<0.05 归零可再arm；关档差分6861px 全在条带 噪声0 0error）；回归 c03-battle/battle-c01 PASS；美术差：钮径比片内小1.8个点、图标近似、另两钮灰占位、落地过程片内未拍",
              "decodedFrames": 564,
              "reviewEvidence": "artifacts/coverage/995034777756536833-review-r195.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  563
                ],
                "nativeRevisits": [
                  0,
                  200,
                  563
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "指挥官能力条：三键形制/黄圈选中态/No valid targets/冷却弧/跃击落地范围伤害，双档开关（面板+URL）"
              }
            },
            {
              "id": "902103473365417984",
              "name": "Ok, one more visualization. Distances this time.…",
              "status": "done",
              "where": "src/core/distance-isolines.js · distances.html · src/badnorth/battle-c03.js#isoLinesOnMesh(distIso) · index.html?scene=badnorth&distIso=1",
              "page": "distances.html",
              "note": "705帧全核；岛上等距亮线=距离场等值线（非流向继承），EDT 与暴力解一致。本轮三项残差全闭：①3D 多层台阶投影——battle-c03.js distIso 档的 isoLinesOnMesh 走渲染网格表面测地距离（marching triangles，源=海平面顶点），线爬崖壁/台阶立面；tests/c03-battle.mjs mock 补第二级侧挑高台（y=1.0），断言高台顶面≥4段+立面≥3段；②任意多边形占地——distance-isolines.js 新增 polygonDistance（有向距离、偶奇判内、凸/凹/斜边通吃）+ distanceField obstacles 选项（格心入形→0、外部取精确边距与 EDT 取 min、at() 同步精化），distance-isolines.mjs 新增 11 项：菱形斜边 0.4/√2 亚格、Steiner 偏移环长≈19.7、贴边偏差≤0.025；③battle.js 调试接入——BattleC03 挂 battle.js 构造/start/stop/afterDraw，?distIso=1 或 c03.set('distIso',true) 打开，默认关不影响战斗；distances.html 补菱形塔楼占地消费者（两图描真实斜边对照）",
              "decodedFrames": 705,
              "reviewEvidence": "artifacts/coverage/902103473365417984-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  704
                ],
                "nativeRevisits": [
                  1,
                  300,
                  550,
                  705
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "2D 格距离场 EDT + 任意多边形占地（亚格边距）+ marching squares 多级等值线；3D 表面测地距离等值线经 battle-c03 distIso 爬多层台阶/崖壁、opt-in 接入 battle.js"
              }
            }
          ]
        ]
      ]
    },
    {
      "key": "style",
      "name": "画风 · 线条与贴图",
      "color": "#a0705a",
      "note": "Oskar 的画风靠线条和贴图撑起来：与缩放无关的 1 像素线、反差线、手绘感的地面笔触、调色板。重构版在 textures.html（贴图实验室）里逐个做了演示，地面笔触和墨线接进了主场景。",
      "groups": [
        [
          "线条",
          [
            {
              "name": "可变疏密与浅高度分段：共享World着色对照",
              "id": "1704246032626762189",
              "status": "partial",
              "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
              "page": "blotches.html",
              "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材",
              "decodedFrames": 564,
              "reviewEvidence": "artifacts/coverage/blotch-style-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  563
                ],
                "nativeRevisits": [
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "裁判 BODY 参数全量对齐（配色/阈值/密度权重/细颗粒/角度场逐式）+ 反射仅albedo + 跨崖rim等深收口 + 双侧逐位一致性 Node/GPU 双验收"
              }
            },
            {
              "name": "三角对比迭代：实景接入+整片验收已补，原作atlas资产卡点",
              "id": "1482346496460828674",
              "status": "partial",
              "where": "src/core/contrast-field.js · src/world/view-shading.js#contrasttex（index.html?scene=fusion&shade=contrasttex）· src/core/c11-maps.js · color-lab.html（三角诊断）",
              "page": "index.html?scene=fusion&shade=contrasttex",
              "note": "517帧全核验（沿用原记）；图集预览、灰岛上色和两组岛环绕。核旧账：实景接入早已落码——view-shading.js#contrasttex 把 worldContrastMesh+solveContrastColors 烘成 uShCTMap（512²世界XZ图），shContrast 在地形顶面取色、fwidth色差压暗出像素细线；c11-maps 另供草地描边反差图，uv-radial-atlas 复用同一解算器。本轮补整片运行验收 tests/contrast-shading-browser.cjs：10064三角/15012边、同边ΔE13.76→0.10、对比边最小ΔE14.28，上传纹理与页内同参重解9919抽样texel全同，屏上8.2%像素改色+2946墨线像素、同状态噪声0、关掉还原、0 console error（artifacts/coverage/contrast-shading-review.md）。仍缺：原作本人的贴花形状/特征种子/atlas文件未公开（worldContrastMesh 是本仓等价实现）；【卡点·B 美术资产】原作彩色图集/贴花原资产未公开 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 517,
              "reviewEvidence": "artifacts/coverage/contrast-shading-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  516
                ],
                "nativeRevisits": [
                  100
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "三角网反差松弛→世界XZ图→顶面取色+像素细线：页内烘图==同参重解9919抽样texel、屏上off/on墨线A/B、开关还原；原作贴花原资产不在本项"
              }
            },
            {
              "name": "程序化法线反差：共享材质/物理像素线局部GPU通过；原atlas待补",
              "id": "1482011744843223042",
              "status": "done",
              "where": "src/world/view-c11-normalline.js · ?c11=normalline（index.html?scene=terrain）· normal-contrast.html",
              "page": "normal-contrast.html",
              "note": "384帧全核（sheet-00/02 本轮复核 + sheet-01/03 沿用 r56；原生 0125 及 3 处 4× 裁切）；线源=程序化笔触法线图的反差（uDepthMix 0，不来自深度），线宽 p50=2/p90=3 与原片同口径一致，天空与海面线 0、剪影不另描。旧 note 的【卡点·B 美术资产】核实为误标：原文就是 procedural normal map（姊妹片 1481661852887265288 亦写 procedurally painted in big chunky strokes），两侧都是程序化、无需手绘 atlas。本轮修掉三个真缺陷：①outline-pass 把阈值改成 uNormalThreshold uniform 后，本开关仍按旧字符串 patch 合成着色器 → ?c11=normalline 直接抛 composite token missing，且抛在 outline 已打开之后 → 几何描边留在天上（云边/天空整片锯齿线）；改为直接设 uniform，不碰着色器源码；②off→on 二次 patch 必抛（prevFrag 已是 patch 后源码）→ 原始源码只存一次且不再改源码，实测 关→开→关 幂等（91.45→172.11→91.52→171.92→91.84‰）；③法线遍只排除无 normal/透明网格，云与天空会进法线遍 → 线源限定为共享地形材质（c11NormalOnly，留 userData.c11LineSource 退出阀）。形态差如实记：线密度 172.11‰ vs 原片 63.98/72.81/73.67‰（本仓逐格台地每条台阶都是几何折痕）、笔触为周期平铺非手绘块形、世界轴三向投影换轴接缝未单独量化（视觉未见直缝）。",
              "decodedFrames": 384,
              "reviewEvidence": "artifacts/coverage/1482011744843223042-review-r144.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  383
                ],
                "nativeRevisits": [
                  1,
                  125,
                  229
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "线源=程序化法线反差/一像素线宽/天空海面剪影干净/开关幂等，非原手绘笔触块形与完整后处理"
              }
            },
            {
              "name": "隔像素线：连续UV重映射＋线性采样；放大积分宽度1px，缩小/全atlas接入待补",
              "id": "1241096929490149376",
              "status": "done",
              "where": "src/core/texel-skip.js · src/core/town-skin.js · src/world/town-skin-layer.js · textures.html",
              "page": "textures.html",
              "note": "302帧全核（sheet-00..03 + 原尺寸 0100/0200 与 3× 裁切）；原文=隔像素一条线：UV 跳过每隔一个像素，一张 128² 图集换 1px 抗锯齿线。核实：旧 note 两条『仍缺』一半是过期账 —— 建筑墙格+右下 32² 植物角共用同一张图集、缩小走色格内 box mip 链，town-skin.js/town-skin-layer.js r56 已实现（c07-skin-decal-browser 一直在跑）；真缺口是本片自己的页面入口 textures.html『隔像素一条线』页签只吃玩具贴图、没有 mip 档与量具。本轮把该页签改成真实图集三列（最近邻 / 仅重映射 / +mip，texLevel 与 c07Level 同口径）+ window.texelSkip 读回量具 + URL 钉档，新测 tests/texel-skip-atlas-browser.cjs 全 PASS：图集 60 槽+植物角 std 0.2495、第4级 mip vs 盒滤波误差 1.06 级；放大 mip 开关四项逐项相同、线宽 12px→2px；缩小 mag .35 mad .01136→.00564 暗缝 .284→0、mag .12 .00631→0；主场景 36555 顶点全换肤/mismatch 0/植被共用同图/A-B 6595px 回位 0",
              "decodedFrames": 302,
              "reviewEvidence": "artifacts/coverage/1241096929490149376-review-r176.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  301
                ],
                "nativeRevisits": [
                  0,
                  100,
                  200,
                  301
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "图集 128²/60 槽+32² 植物角 · 放大 1px 线宽 · 缩小 mip 收敛 · 主场景建筑+植被共用与 A/B"
              }
            },
            {
              "name": "fwidth缩放抗锯齿：保留纹理实验，真实快照alpha阈值及受控1像素线GPU验收通过",
              "id": "978211952504852480",
              "status": "done",
              "where": "src/world/island-snapshot.js · snapshot.html · textures.html",
              "page": "snapshot.html",
              "note": "339帧全序列核验；真实World 64²截图、成功/异常状态恢复及GPU导数alpha边缘通过；原作通道/精确shader未知，战役全量缓存接入另待补。",
              "decodedFrames": 339,
              "reviewEvidence": "artifacts/coverage/snapshot-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  338
                ],
                "nativeRevisits": [
                  0,
                  98,
                  175,
                  240,
                  338
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            }
          ]
        ],
        [
          "地面笔触",
          [
            {
              "name": "抽象田地：格块专用顶面坐标、方向分段与导数抗锯齿；原作手绘atlas仍待补",
              "id": "1714613599035863191",
              "status": "done",
              "where": "src/terrain/field-pattern.js · fields.html",
              "page": "fields.html",
              "toggle": "fields",
              "note": "620帧全核；田纹三档补齐（新增 uFields=3 宽软带）+ 剪影改整场景 overrideMaterial（含树/灌丛/瀑布，全黑）+ 页面裸顶面模式；原片三条形制差（软边带宽、占空比1:1、裸顶面）均已可量",
              "decodedFrames": 620,
              "reviewEvidence": "artifacts/coverage/1714613599035863191-review-r159.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  619
                ],
                "nativeRevisits": [
                  60,
                  138,
                  140,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逐格田纹坐标系 + 四段显示顺序 + 宽软带形制"
              }
            },
            {
              "name": "旋涡团块：可调角度场与柔边，本地近似",
              "id": "1703750394164199473",
              "status": "partial",
              "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
              "page": "blotches.html",
              "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材",
              "decodedFrames": 592,
              "reviewEvidence": "artifacts/coverage/blotch-style-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  591
                ],
                "nativeRevisits": [
                  500
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "裁判 BODY 参数全量对齐（配色/阈值/密度权重/细颗粒/角度场逐式）+ 反射仅albedo + 跨崖rim等深收口 + 双侧逐位一致性 Node/GPU 双验收"
              }
            },
            {
              "name": "重要边界：显式地表标记隔离屋顶/岩壁，真实层高选噪声",
              "id": "1696864977171189980",
              "status": "done",
              "where": "src/terrain/blotch-atlas.js · src/terrain/blotch-tongue-c09.js · src/world/view-shading.js · blotches.html",
              "note": "502帧复看（6张联系表+r172复看sheet-04）：0284–0287 四帧纯黑=换版本黑场；顶面米黄/淡绿大斑更大更少、到崖肩整齐停住、崖壁纯米白不漫过。与A片同一条流水线与同一处修复：BLOTCH_RIM_GLSL 补 bleed>0 闸门（smoothstep(0,0,·) 除零退化→bleed=0 等于无限深，也解释了 bleed0≡bleed20）；夹具坐标口径（readPixels 第0行在下、NDC y=+1 在顶部）与探针落点（0.85→rimDist 0 崖肩线）修正。读数：?scale .09→.045 扫描线色块边界 6→0、顶面着色 10.0%、bleed=0 全深归零、.14 带宽 0.10 世界米（.18 以下干净）、.30 → 0.20（2.0×）、主场景图集关/开 3444px、0→.14 2110px / 0→20 68780px / strength0 3301px、噪声 0。",
              "decodedFrames": 502,
              "reviewEvidence": "artifacts/coverage/1696864977171189980-review-r172.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  501
                ],
                "nativeRevisits": [
                  1,
                  59,
                  285,
                  501
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "笔触更大更少 + 不漫过崖肩（等深带世界米）"
              },
              "page": "index.html?scene=terrain&on=blotch",
              "toggle": "blotch"
            },
            {
              "name": "大块颜料斑藏住多边形：量化的三档明暗只画在朝上的草色面",
              "id": "1480635131614355459",
              "status": "done",
              "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
              "note": "428帧全核；大块柔和颜料斑（20–30px 宽带渐变、连续色阶，只上朝上草面）；原默认是三档硬量化，已加 mode 2 柔和档并设为 blotches.html 入口；缺 atlas/跨崖采样",
              "decodedFrames": 428,
              "reviewEvidence": "artifacts/coverage/1480635131614355459-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  427
                ],
                "nativeRevisits": [
                  1,
                  120,
                  350,
                  420
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "地面色斑：边缘柔度/色阶连续性/掩码"
              }
            },
            {
              "name": "径向大小排序：原片UV图块已学；旧圆块仅近似，UV流程未验",
              "id": "1478114309263839244",
              "status": "done",
              "where": "src/core/uv-radial-atlas.js · uv-radial.html",
              "page": "textures.html?t=radial",
              "note": "346帧全核；径向大小排序 UV 图集已从真实页面量出：朝上面合并 66 片、最大中心片占面积 30.7% 且带 1 个崖柱/拱洞脚印洞、装箱重叠 0、面积名次~离页心距离 Spearman -0.634、逐片放置墨量 16807→43341 单调；棋盘格贴回同一座岛（3D 视图差 67773px）、反差色对比边 ΔE 18.13 vs 同类边 0.27 且可逐轮回放。旧 note 的「原UV流程未实现」核实为过期账（模块 r56 C11 就署本片 ID，只缺 -browser.cjs）。造型差：同构测试岛而非原片真岛、图块边界由格网决定、彩色线框本仓为面填色+边压暗",
              "decodedFrames": 346,
              "reviewEvidence": "artifacts/coverage/1478114309263839244-review-r140.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  345
                ],
                "nativeRevisits": [
                  20,
                  28,
                  60,
                  129,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "UV 分片（朝上面合并）+ 径向大小装箱 + 棋盘/反差贴回"
              }
            },
            {
              "name": "单纹理八方向/中心镜像：D4与可选固定像素尺度折叠，原作纹样/布局仍待补",
              "id": "1061221291137605633",
              "status": "done",
              "where": "src/core/mirror-uv.js · src/ui/ornament.js",
              "page": "mirror.html",
              "note": "379帧全核验：方/横/窄高矩形拖动、Orientation变化。复用已有单距离场，补D4八方向和可选固定像素尺度中心重复折叠，GPU八方向各异/镜像无误差，改尺寸不重烘，旧实验回归通过。固定尺度重复是本地方案，非已证实原布局；纹样/CPU绘图API仍不同。；【第62轮 A 类收敛】残差=纹样与 CPU 绘图 API，D4 八方向/固定像素尺度折叠机制等价且 GPU 无误差，判为 done",
              "decodedFrames": 379,
              "reviewEvidence": "artifacts/coverage/mirror-overhang-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  378
                ],
                "nativeRevisits": [
                  230
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": ""
              }
            }
          ]
        ],
        [
          "调色板与 UI 装饰",
          [
            {
              "name": "四角色盘：sRGB实景编辑，其他色彩空间/交互待补",
              "id": "1712088611934371876",
              "status": "done",
              "where": "palette-editor.html #pg · src/core/palette-graph.js · src/core/okhsl.js · src/core/oklab.js · src/world/ground-palette-map.js",
              "page": "palette-editor.html",
              "note": "624帧全核；节点式调色图机制全在（7节点/1矩形/1三角/1色带/144离散面片、RGB·LAB(OkLab)·HSL(OkHsl)三档滑条、真鼠标拖点 dx0.4033、右键 New node/gradient/triangle、面片空间 OkHsl/OkLab/Srgb 三档中点色互异、导出导入往返 156/156 无损、#pgApply 后 gpm.facetsUsed 104）；本轮修三处真形制差：画布被 flex 拉到 1213×1434 致面片发虚且命中偏移 2.76×→定 440×520、色带条由 1px 拉伸改 12 段带缝、导出补浮点 rgb 使往返不丢精度；全材质接入按片中未拍到不记缺口",
              "decodedFrames": 624,
              "reviewEvidence": "artifacts/coverage/1712088611934371876-review-r197.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  623
                ],
                "nativeRevisits": [
                  50,
                  300,
                  550,
                  623
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "palette-editor.html?graph=1 节点图：面片离散/三档取色/拖点/右键新建/导出往返/应用到顶面（mixed）；未含墙面通道"
              }
            },
            {
              "name": "HSL色彩范围：三特征HSL域+离散采样+完整接口接入，实景验收过（卡点·B Unity面板）",
              "id": "1710031224838771027",
              "status": "partial",
              "where": "src/core/color-volume.js · src/world/view.js · color-lab.html · tests/color-volume-features-browser.cjs",
              "page": "color-lab.html",
              "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面。三特征各接独立HSL域（setFeatureColorVolumes + featVolumeSample 按 vField.z 分桶，未给的特征保持基色）；steps 离散采样吸附 i/(steps-1) 格点（对齐原版 strip(12)，CPU+GLSL cvQuant 同式）；原版完整接口补齐（sampleCornerVolumeSpace/css/dE/oklabToRgb/colorVolumeTerrain/opts透传）。tests/color-volume-features.mjs 全过。浏览器实景验收过：fusion页真GPU mode-3编译在位、三特征分桶零串色（掩膜35076/22670/33759px，越界0/串桶0，默认发货态同验）、steps=4/12掩膜内唯一色2614→35→221、同参重渲与跨重载逐像素一致；【卡点·B 原作工具不可复现】Unity编辑面板交互（五特征域拖点）本仓不可运行，仅输出侧GPU验收",
              "decodedFrames": 515,
              "reviewEvidence": "artifacts/coverage/color-volume-features-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  514
                ],
                "nativeRevisits": [
                  0,
                  60,
                  350,
                  440
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "浏览器GPU实景：三特征分桶隔离零串色、steps阶梯色带、同参/跨重载逐像素确定性；不含原作Unity面板交互"
              }
            },
            {
              "name": "更多颜色：15 个色槽（画面左边一列 15 色）",
              "id": "1237293295887319040",
              "status": "done",
              "where": "src/core/palette.js · src/world/app.js（buildPalette / #palettestyle）· learn/panel",
              "note": "260帧全核（3张联系表 + 原尺寸0040/0120 + 6×裁色格）；色槽索引机制等价：UI 15格互不相同、三套预设各15、15槽依次刷墙不串色、换预设GPU 31385像素变；片中竖列12格可滚动，本仓15格竖排无滚动，选中态为高亮非白圈",
              "decodedFrames": 260,
              "reviewEvidence": "artifacts/coverage/1237293295887319040-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  259
                ],
                "nativeRevisits": [
                  0,
                  40,
                  120,
                  259
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "墙体色槽调色板与刷色链路，非左侧色格 UI 像素级等价"
              }
            },
            {
              "name": "墙色过渡：短弧HSL本地扩展，实景滑杆对照",
              "id": "1200520827898343425",
              "status": "done",
              "where": "src/core/palette.js · src/core/palette-store.js · wall-palette.html",
              "note": "200帧全核；四步单帧硬切改色（f33 红/s0.61→0.07、f52 绿/s0.63→0.06、f78 浅蓝/s0.70→0.36、f112 暖黄/s0.41→0.33），一步只作用于「用该槽的体素」、屋顶橙与其它槽不动、无渐变无UI；核实旧note「PNG/完整原接口与持久化」：PNG 通路早已在（core/palette-image.js + world/palette-png.js + ?palettePng=）但本片页面从没接、持久化全仓 0 处（存档只写槽下标）→ 本轮补 src/core/palette-store.js + wall-palette.html 的 PNG 热更新/导出16×2 PNG/localStorage 存档（坏存档拒绝）；浏览器实测 32748 顶点、槽7 828/828、槽2 660/660、槽3 360/360 整组换色、回位 0 float/0 px、噪声 0、导出 167B 下行==15槽、刷新恢复「World 346 · 已恢复存档配色」、外部改图 hot v2 改槽 0,2,…,14、关档回预设；如实：反弹光令邻近几何最大相对变化 0.326/0.253/0.198，整岛重建有 4692px 像素地板，片中看不到 1.5s 渐变",
              "decodedFrames": 200,
              "reviewEvidence": "artifacts/coverage/1200520827898343425-review-r168.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  199
                ],
                "nativeRevisits": [
                  0,
                  33,
                  52,
                  78,
                  112,
                  199
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "墙色槽后端：整组换色 + Palette.png 热更新 + 常用配色存档"
              },
              "page": "wall-palette.html"
            },
            {
              "name": "同一张装饰贴图的几种不同设置打破重复",
              "id": "1061229717582475264",
              "status": "done",
              "where": "textures.html（UI 装饰）· src/core/mirror-uv.js",
              "page": "textures.html",
              "note": "332帧全核；deco「+几种设置」改成三条并排装饰带（同一贴图，朝向7/3/1、格宽36/44/52），三块画面互不相同；仍缺真实 UI 图集与可保存套件",
              "decodedFrames": 332,
              "reviewEvidence": "artifacts/coverage/1061229717582475264-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  331
                ],
                "nativeRevisits": [
                  1,
                  80,
                  140,
                  230,
                  331
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "同一贴图多设置打破重复"
              }
            },
            {
              "name": "单张距离场镜像 / 独立border与center / uniform展开播放：GPU三档尺寸通过；本地画稿/动画样例",
              "id": "1104771432440049664",
              "status": "done",
              "where": "src/core/ornament-field.js · src/ui/ornament.js · ornament.html",
              "page": "ornament.html",
              "note": "本批续用旧全帧记录，单张距离场镜像/独立阈值GPU验收通过；原作画稿及分层时序仍不同。",
              "decodedFrames": 258,
              "reviewEvidence": "artifacts/coverage/ornament-flags-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  257
                ],
                "nativeRevisits": [
                  0,
                  86,
                  150,
                  193,
                  257
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "单张距离场镜像 / 独立border与center / uniform展开播放：GPU三档尺寸通过；本地画稿/动画样例",
              "id": "1105131621391495176",
              "status": "done",
              "where": "src/core/ornament-field.js · src/ui/ornament.js · ornament.html",
              "page": "ornament.html",
              "note": "63帧全序列核验；单张128²距离场镜像、独立阈值和uniform展开通过GPU；画稿/时序为本地样例。",
              "decodedFrames": 63,
              "reviewEvidence": "artifacts/coverage/ornament-flags-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  62
                ],
                "nativeRevisits": [
                  0,
                  6,
                  13,
                  22,
                  36,
                  62
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "UI flair：标题/外纹本地两轨可拖动、空白端点；原徽章/逐部件时序待补",
              "id": "1024679338292256769",
              "status": "done",
              "where": "src/core/ui-reveal.js · ornament.html",
              "page": "ornament.html",
              "note": "100帧全核验。中央徽章/标题先显、外纹后展，中央先退/外侧尾迹最后消失。保留共享SDF，新增可拖动标题/外纹本地两轨时序，透明文字inert；非原徽章/逐部件原时序或图稿。；【第62轮 A 类收敛】残差=原徽章图稿与逐部件时序，机制（中央先显/外纹后展/尾迹最后退）等价，判为 done",
              "decodedFrames": 100,
              "reviewEvidence": "artifacts/coverage/icons-flair-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  99
                ],
                "nativeRevisits": [
                  0,
                  8,
                  20,
                  30,
                  55,
                  75,
                  99
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地工具条交互/生命周期或共享纹饰两轨时序局部通过；非原作完整美术/游戏指令"
              }
            },
            {
              "name": "拉太长会看出重复",
              "id": "1061227418961219585",
              "status": "done",
              "where": "textures.html（UI 装饰）· src/core/mirror-uv.js",
              "page": "textures.html?t=deco",
              "note": "370帧全核；deco 页签改成绕面板中心对折镜像（相邻格互为镜像）+4 个子模式，拉太长 1/3/6 格宽重复 6 次线性增长；仍缺巴洛克图集与九宫格拉伸",
              "decodedFrames": 370,
              "reviewEvidence": "artifacts/coverage/1061227418961219585-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  369
                ],
                "nativeRevisits": [
                  1,
                  150,
                  250,
                  340,
                  369
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "镜像铺贴对称性与重复次数"
              }
            }
          ]
        ],
        [
          "打包与工具",
          [
            {
              "name": "矩形树：实际查询逐步查看；原3D树/跨叶候选待补",
              "id": "1765115069837221962",
              "status": "done",
              "where": "src/core/atlas.js allocate/allocateAt/recursiveFill + src/core/atlas-c09.js armFromTrace/placeBottomLeft/treeLayers · atlas-tree-c09.html",
              "page": "grids.html?t=atlas",
              "note": "247帧全核；臂=真实碰撞查询的树解析（150步逐步断言 手指==trace里free+used叶数、pruned==outside数、parent下标递增、段全轴对齐且落在板内，最深reach 31层）；「板子越碎手指越多」实测早20次1.00手/11.5空闲叶/12.75候选 → 末20次2.40手/32.75空闲叶/379.2候选；跨叶放置71/150槽吃掉≥2片叶（最多6片，逐槽面积精确、全部标used、旧槽零移动）；2D手臂+3D展开两态都出图（243节点/27层/根在最上），arm=0 青色像素1286→0 且同一块板；旧note的「原3D树/跨叶候选待补」核实为过期账（第34次同型，allocateAt+treeLayers/project3D 都在跑）；新测 tests/atlas-tree-arm-browser.cjs",
              "decodedFrames": 247,
              "reviewEvidence": "artifacts/coverage/1765115069837221962-review-r155.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  246
                ],
                "nativeRevisits": [
                  6,
                  55,
                  141,
                  185,
                  238
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "手臂=树解析路径 / 碎片度→手指 / 跨叶槽 / 2D+3D 两态 / arm=0 A/B"
              }
            },
            {
              "name": "矩形删除：过期句柄修复、空兄弟合并；仍会残留碎片",
              "id": "1765041830461055127",
              "status": "done",
              "where": "src/core/atlas.js free/remove/repack/grow/report · atlas-tree-c09.html?remove=1",
              "page": "grids.html?t=atlas",
              "note": "558帧全核；删除真生效（60步里删25/加35，freeLeaves 33→64、≤16×16小孔1→24；再纯删30块→freeLeaves 118、小孔45、最大空闲块仅占空闲面积2.33%、画面空白占比0.382→0.425），碎了仍装得紧（再加40块40/40全进、占用53.8%→71.4%）；只在两子全空时向上合并（64×64 2→2→1、非兄弟连锁3→3→2→1、freeArea 4096）；重复/伪造/跨实例释放全拒且存活块逐字不动；旧note的「跨叶放置及完整RectBin接口仍缺」核实为过期账（第35次同型，allocateAt + place/repack/grow/shelfPack 都在）；原片0216–0355的近侧视角=按深度叠起的树，页面有对应3D展开；新测 tests/atlas-remove-frag-browser.cjs",
              "decodedFrames": 558,
              "reviewEvidence": "artifacts/coverage/1765041830461055127-review-r155.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  557
                ],
                "nativeRevisits": [
                  300,
                  557
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "删除 / 碎片化读数 / 兄弟合并 / 拒绝非法释放 / 碎了仍可放"
              }
            },
            {
              "name": "矩形候选/树剪枝：跨叶放置与key释放通过；3D树/完整接口待补",
              "id": "1764958522398146667",
              "status": "done",
              "where": "src/core/atlas.js + src/core/atlas-c09.js + src/core/rectbin-c08.js · atlas-tree-c09.html?view=3d",
              "page": "grids.html?t=atlas",
              "note": "296帧全核；暴力候选(底-左)+树剪枝碰撞/跨叶分配/兄弟合并、3D分层树(每深度一层,根最上,白树枝只连相邻层)、近俯视梳齿三段镜头全在(atlas.js+atlas-c09.js+rectbin-c08.js);本轮把2D段叶框从看不见的深色改浅色对齐片0030;新测atlas-tree-phases-browser.cjs 三段逐像素PASS(浅线5898px/跨度243.3→69.4=0.285/彩块保留80.9%/噪声0)",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/1764958522398146667-review-r196.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  295
                ],
                "nativeRevisits": [
                  0,
                  30,
                  140,
                  222,
                  276
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "底-左填充顺序 / 树剪枝碰撞 / 跨叶分配与合并 / 3D 分层树 / 近俯视梳齿"
              }
            },
            {
              "name": "主体OBJ导出：精确坐标/属性检查/真实下载（植被水面另补）",
              "id": "1430224300003545091",
              "status": "done",
              "where": "src/tools/objexport.js（sceneToOBJ/sceneParts/downloadSceneOBJ）· index.html#exportscene · src/world/app.js",
              "page": "index.html?scene=town",
              "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。；【卡点·A 机制未做】第三方DCC及水/植被/材质尚未验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r223 核销残差：objexport.js 增 geometryData/bakeInstances/sceneToOBJ/sceneParts/downloadSceneOBJ（实例矩阵烘焙植被+逆转置法线+instanceColor/aColor逐实例色、mtllib+o/usemtl多对象+跨部顶点去重、缺法线补占位vn防v//vn索引错位——首版在Blender下暴露Invalid normal index已修）、index.html#exportscene+app.js 双文件真实下载；.mtl每对象近似Kd（town白留顶点色、water=片元0.55混色、植被=实例色均值）。mixed/quad下载obj+mtl（11.8/11.5MB）独立解析：town 10916/12185面逐坐标一致带RGB、water 2面贴y≈0、flowers 24/30、shrubs 13200/12000逐实例色；Blender 5.2.2后台导入两档0警告、对象/材质逐一对上（blender-import-r223.txt）。瀑布/特效/风摆/impostor替身不导出、mtl为近似Kd不冒充原作格式",
              "decodedFrames": 288,
              "reviewEvidence": "artifacts/coverage/1430224300003545091-review-r223.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  287
                ],
                "nativeRevisits": [
                  70,
                  81,
                  108,
                  156,
                  178,
                  245,
                  275
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "场景OBJ+MTL导出（主体/水面/植被分组+材质）真实下载并经Blender 5.2.2导入验收；不含瀑布特效/运行时着色态/原作导出格式"
              }
            },
            {
              "name": "合并网格：实测共享主体一次提交（非全场景 / Switch基准）",
              "id": "1401145625572425728",
              "status": "done",
              "where": "src/tools/merge-bench-c06.js · src/tools/mesh-wire-overlay.js · src/world/worldmesh.js · save-mesh.html",
              "page": "save-mesh.html",
              "note": "349帧全核（4张联系表逐格 + 原尺寸 0000/0036/0050/0348）；片内技术内容=整座城镇表面是一张合并后的三角网，作者用线框开关显示（0036-0078 白线叠在着色面上），三倍速度是 Switch 上的作者报告、片中无量具。核实原 note 的「卡点·E 环境不具备」为假标签：benchMerge 机制与 node 测试 r56 就在，缺的是页面入口——本轮给 save-mesh.html 补「合并对照」按钮（提交次数/逐帧耗时/整片重建耗时）与三角线框叠加层（view.setDebug('wire') 是把面挖空，与原片形制不同）。实测 mixed 17224 三角/35 块：小网格 270 次提交 → 1 次（270×），三角逐数一致；quad 21092 三角/36 块：330 → 1（330×）；8×8 视口 1.05-1.07×、全视口 0.99-1.01×（填充主导，不复现三倍）；6 点扫描得边际成本 5.1-6.4µs/提交；整片重建 59-72ms；线框叠加 34392 段（2.0×三角）、开/关差 8718/9065px、回位 0；0 console error。新测 tests/merge-bench-browser.cjs，回归 merge-bench-c06.mjs 与 save-mesh-browser.cjs 均 PASS",
              "decodedFrames": 349,
              "reviewEvidence": "artifacts/coverage/1401145625572425728-review-r148.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  348
                ],
                "nativeRevisits": [
                  0,
                  35,
                  36,
                  50,
                  78,
                  225,
                  348
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "合并网格的提交次数/逐帧耗时/整片重建耗时 + 三角线框叠加层（仅地形+建筑主体，不含水/植被/阴影；SwiftShader 上不复现 Switch 三倍）"
              }
            }
          ]
        ],
        [
          "界面 UI",
          [
            {
              "name": "头像生成：显式种子/镜像随机重放/固定槽身份已验；完整spec与剪影指标待补",
              "id": "958371606350454784",
              "status": "done",
              "where": "src/core/part-random.js · src/ui/slot-portrait.js · ui.html?t=face&portrait=slots",
              "page": "ui.html?t=face",
              "note": "88帧全核（sheet-00 一页 9×10 + 0000/0087 原尺寸）；同构图蓝底单人像硬切，脸形/发型/眉/眼/鼻/嘴/雀斑逐帧换、无UI无运镜。旧note「完整spec/数据接口/剪影IoU仍缺」= 过期账（第53次同型）：part-random.js 的 PORTRAIT_SLOTS/sampleSlots/portraitSilhouette/silhouetteDiversity/partSeed 与 slot-portrait.js 共用几何全在，ui.html?portrait=slots 早把 canvasMaskIoU 打在页上，缺的只是运行断言。本轮零改码，补纯逻辑+运行两支测试：24张剪影差异 0.269（均IoU 0.731）、画布剪影vs掩码 IoU 0.994、8张spec与partSeed重算逐字段一致、同seed两次截图逐字节相同（63170B）、换seed整屏变、窄屏390列数4→3 id序列0,1,2,4,5,6身份不变、画布350px不溢出、0 console error",
              "decodedFrames": 88,
              "reviewEvidence": "artifacts/coverage/958371606350454784-review-r177.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  87
                ],
                "nativeRevisits": [
                  1,
                  44,
                  88
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "槽位表 spec 数据接口 + 剪影 IoU + 画布身份（宽/窄屏）"
              }
            },
            {
              "name": "游戏头像展示：卡片身份重绘/换列已验；小队身份钉槽接口已接，原素材/全装备层级永久卡点",
              "id": "1010979395719319552",
              "status": "partial",
              "where": "src/core/part-random.js · src/ui/game-portrait-c01.js · src/badnorth/battle-c01.js · ui.html",
              "page": "ui.html?t=face",
              "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。本地卡片绘制与稳定种子身份已验；本轮接游戏角色接口：sampleSlots 加 {pin} 钉槽（钉住值必须在槽 variants 内、钉表外槽位报错），squadPortraitIdentity(sq) 兵种→装备（矛兵→锁甲 mail、弓手→兜帽 hood、步兵随种子）+队序→底色，battle-c01 头像卡按小队真数据钉槽；残差=原兜帽/锁甲素材与全装备层级不可得，不以不同画板哈希充当原多样性指标。；【卡点·B 美术资产】原兜帽/锁甲素材与全装备层级不可得（无源素材，程序化只能近似） → 永久卡点，需新证据再立项",
              "decodedFrames": 100,
              "reviewEvidence": "artifacts/coverage/portraits-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  99
                ],
                "nativeRevisits": [
                  0,
                  45,
                  99
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地显式镜像随机状态/稳定槽身份与卡片按小队数据钉槽局部通过；非原完整素材与全装备层级"
              }
            },
            {
              "name": "通用旗形与本地徽记：54帧全原尺寸，六尾形共用到真实军旗",
              "id": "958410200146497537",
              "status": "done",
              "where": "src/core/banner.js → src/life/banner.js → src/badnorth/battle.js；banners.html",
              "page": "banners.html",
              "note": "54帧单张旗帜目录已全原尺寸复核；补六种透明尾形和五种本地白徽记，共用到实际Bezier军旗。GPU轮廓/双网格暂停风场及15资源释放通过；原作完整徽记/精确美术、布料碰撞仍未覆盖。",
              "decodedFrames": 54,
              "reviewEvidence": "artifacts/coverage/banner-bunting-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  53
                ],
                "nativeRevisits": [
                  0,
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                  7,
                  8,
                  9,
                  10,
                  11,
                  12,
                  13,
                  14,
                  15,
                  16,
                  17,
                  18,
                  19,
                  20,
                  21,
                  22,
                  23,
                  24,
                  25,
                  26,
                  27,
                  28,
                  29,
                  30,
                  31,
                  32,
                  33,
                  34,
                  35,
                  36,
                  37,
                  38,
                  39,
                  40,
                  41,
                  42,
                  43,
                  44,
                  45,
                  46,
                  47,
                  48,
                  49,
                  50,
                  51,
                  52,
                  53
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "确认弹出：横排/地面标记/单Move接真下令/Swap互换/Esc已验；原钮图稿近似",
              "id": "1016680972610359298",
              "status": "done",
              "where": "src/badnorth/battle-c03.js（confirm：横排弹窗/目标格白环标记/confirmAction 重放/swap · cancelPopup Esc）· src/badnorth/battle.js#onPointer（真下令路径）· tests/c03-battle.mjs · tests/confirm-popup-browser.cjs · ui.html",
              "page": "index.html?scene=badnorth&confirm=1",
              "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。本轮闭合三条游戏语义残差：①地面标记=#openPopup 在 picked.cell/floor 钉白色六环（浏览器同帧差分 1524px 落点内，确认/取消/关档全收）②单 Move=confirmAction 重放 battle.onPointer 原点击，走 navigation.pick/plan 校验→squad.goal/goalFloor→drawPath→取消选中同一条真下令路径（Node plan spy + plan 打回不改 goal）③移动交换=swap 钮两队 goal+goalFloor 双向换；补 cancelPopup() 挂真 Esc keydown、弹窗期队伍阵亡/选中顶替自动收；tests/confirm-popup-browser.cjs 17 项 + c03-battle.mjs §④ 全过；残差=原片钮图稿与标记形制为程序化近似（素材差）",
              "decodedFrames": 370,
              "reviewEvidence": "artifacts/coverage/ui-interaction-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  369
                ],
                "nativeRevisits": [
                  63,
                  125,
                  142,
                  226,
                  296
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主战场确认弹出：目标格白环标记 + Move/Select/Swap 接真下令路径 + Esc取消/阵亡自收（Node断言 + 浏览器17项 + 像素A/B）"
              }
            },
            {
              "name": "斜按钮：确定性视觉扰动/AABB、稳定命中槽与键盘已验；游戏菜单待接",
              "id": "1242824460325052417",
              "status": "done",
              "where": "src/ui/game-ui-c06.js · src/core/playful-layout.js · index.html?gameui=1",
              "page": "ui.html?t=menu",
              "note": "383帧全核（4张联系表+3张原尺寸）；面板开合逐帧判为0–77关/78–332开/333–358关/359–382开；真形制差三处已按片内实测改：主行动60/次级36/双联74×65/Grid45+面板宽32.6vw、颜色改按功能固定四色、补Undo/Redo深度数字与Grid第二枚圆；新测playful-menu-main-browser 30项全PASS（差分72681px 100%在面板内）",
              "decodedFrames": 383,
              "reviewEvidence": "artifacts/coverage/1242824460325052417-review-r199.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  382
                ],
                "nativeRevisits": [
                  71,
                  150,
                  338,
                  382
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "主场景菜单：开合/几何/倾角/命中槽/深度计数/像素A/B"
              }
            },
            {
              "name": "图标：单选状态/方向键/禁用跳过/切页保持已验；图稿与游戏指令待接",
              "id": "1201179450668441600",
              "status": "done",
              "where": "src/ui/game-ui-c06.js + src/ui/icon-toolbar.js + src/ui/icon-ink.js · index.html?gameui=1（主场景）",
              "page": "ui.html?t=icons",
              "note": "306帧全核；本轮补运行验收并收口：图标工具条接主场景真实命令（3 工具格各自底色+轻微倾斜+选中图形纯白+白三角；下方三项灰底白描边、可用态=真实撤销栈深度），第三个灰格从「清空城镇」改回「退出」；新测 tests/game-ui-icon-commands-browser.cjs 体素 356→357→356→357、depth 1→0→1、退出后 #tools 还原；原作图稿为素材差不计缺口",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/1201179450668441600-review-r133.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  305
                ],
                "nativeRevisits": [
                  1,
                  140,
                  305
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "图标工具条形态/选中态/撤销·重做·退出三项真命令"
              }
            }
          ]
        ],
        [
          "镜头与墙色续项",
          [
            {
              "id": "1727324352264474664",
              "status": "partial",
              "where": "src/core/camera-motion.js（whipSmear/velocityField/sharpness/smearAudit）· src/world/view.js（轮廓加权方向历史拖尾）· tests/whip-smear.mjs · whip-smear-browser.cjs",
              "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。r220 残差核销——速度场 velocityField+CPU审计 smearField/sharpness/smearAudit 逐式移植裁判 REACode smear.js；轮廓拖抹近似=whipSmear 轮廓加权方向性历史拖尾（沿内容速度场4-tap streak、alpha·(.45+.55·e)轮廓掩码，CPU+WHIP_SMEAR_GLSL孪生接view#smear，smearTex改双线性），GPU==CPU两组64²全图对拍maxDiff=0、水平边只沿y拉宽≈pan、∥轮廓恒等、轮廓像素混比>边外；实景轮廓带/平区差分18.9/8.2、∝r、0.5/1/2×|shift|单调、停转恒等、开关alpha=0；tests/whip-smear.mjs+whip-smear-browser.cjs，camera-wall-browser回归PASS。剩余残差=原片精确轮廓算法未公开（卡点·C，永久）。；【卡点·C 算法未公开】结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/1727324352264474664-review-r220.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  302
                ],
                "nativeRevisits": [
                  95
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "轮廓加权方向拖尾GPU==CPU验收+速度场/CPU审计逐式移植，不等于原作未公开拖抹算法"
              },
              "page": "index.html?scene=terrain&on=motionblur",
              "name": "快速转镜拖抹：轮廓加权方向拖尾核销，原片算法永久卡点"
            }
          ]
        ],
        [
          "镜头与墙色续项",
          [
            {
              "id": "1371460793032716290",
              "status": "partial",
              "where": "src/core/palette.js · src/world/app.js · wall-palette.html",
              "note": "524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。；【卡点·A 机制未做】新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
              "decodedFrames": 524,
              "reviewEvidence": "artifacts/coverage/camera-wall-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  523
                ],
                "nativeRevisits": [
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地历史帧修复/独立墙色色槽，不等于原作完整拖抹/PNG贴图系统"
              },
              "page": "wall-palette.html",
              "name": "实际墙色色槽编辑：预设隔离，PNG热更新待补"
            }
          ]
        ]
      ]
    },
    {
      "key": "veg",
      "name": "植被管线 · vegetation",
      "color": "#5e8a4c",
      "note": "落点 → 地被（含无缝混色、垂过崖边）→ 灌木（叶状轮廓）→ 树 → 远景（八方位 impostor）→ 云。三个项目一路都在做：Bad North 的草和花、Townscaper 的灌木和草地、第三个项目的团块树和八角 impostor。重构版在共享网格上做了前四步（src/life/vegetation.js），落点全从 World + 地形形状来。",
      "groups": [
        [
          "落点",
          [
            {
              "name": "顶点对偶：31帧核验，重心对偶/边界闭合与共享World脉动；植被统一待补",
              "id": "959752525867036672",
              "status": "done",
              "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js · gridpatch.html?grid=quad",
              "page": "gridpatch.html",
              "note": "31帧全核；脉动曲线改为按片内量：白线像素 2154↔3153 余弦律，线性峰谷比 1.206、拟合周期 1.296s → DUAL_PULSE {0.829,1,1.3}（旧写死 .72..1.00/2.09s 太深太慢）；单测把常数与序列绑死，浏览器两档线段比 1.206、差分 48646px；只剩重心对偶口径差（原作中心规则未公开）与全局植被/导航未替换（片内未拍）",
              "decodedFrames": 31,
              "reviewEvidence": "artifacts/coverage/959752525867036672-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  30
                ],
                "nativeRevisits": [
                  0,
                  10,
                  20,
                  30
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "顶点对偶脉动 + 候选点；不含全局植被/导航替换"
              }
            },
            {
              "name": "1b 早期高层草地分区（树木为原帖后续计划，完整地块规则待补）",
              "id": "1178731576982724611",
              "status": "done",
              "where": "src/build/garden-plots-c07.js#planGardenC07/growBigField · src/build/buildings.js · src/world/view-c07.js ?bigplot=0 · index.html?scene=town&c07=gardenplots,quayyards",
              "page": "garden.html",
              "note": "333帧全核（4张联系表本轮重看+0095/0250/0280原尺寸+裁切）；r193挂下的「地块尺度」已收：判据按片内可量的事定——草格≥18才切一块大田、大田=草格×0.55夹[9,16]、余下仍2-5格、单格圆角草台保留（片0095确有）；新增 growBigField 纯确定生长，读数 真实小镇 36院/10块/[5,4,3,2,2,...]无大田（最大院草格9<18）、人工42格院 8块/[16,5,5,4,3,2,1,1] 恰1块16格大田、关档 11块全≤5，草格+小径==院格；A/B 80617px 噪声0。同时纠正 r193 的「片尾分色视图不含草地分区」= 非缺口（原片草地不上色，4张联系表+0280 8×裁切确认）；美术差：草色比原片亮、院内树与小径遮挡。测试 garden-big-plot.mjs + -browser.cjs/quay-yards/garden-paths-door-first/garden-browser/c07-look 全PASS",
              "decodedFrames": 333,
              "reviewEvidence": "artifacts/coverage/1178731576982724611-review-r194.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  332
                ],
                "nativeRevisits": [
                  0,
                  95,
                  250,
                  280,
                  332
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "草地块尺寸形制（大田 + 2-5格小块 + 单格草台）与临水成院"
              }
            }
          ]
        ],
        [
          "地被",
          [
            {
              "name": "每层地被：203帧全核，实际World分层色组；完整草型待补",
              "id": "959530111187013632",
              "status": "done",
              "where": "src/core/level-flora.js · src/life/vegetation.js · src/life/flora-species.js · level-flora.html",
              "toggle": "grass",
              "page": "level-flora.html",
              "note": "203帧全核（0/70/108/109/170/202原尺寸）；109帧硬切紫色雨景。r74残差收口：层绑物种组+六形程序草型几何+裁判buildFlora成丛参数（presence≈.43/丛内4–9/半径.20–.46格/缩放.55–1.25）+表面型密度调制（岸/崖边/内部近似）+雨生态色组近似（紫/灰白，同键换色）；levelFloraShapes opt-in草型各向异性、共享leaf atlas单例绑定。残差：原片美术素材与雨景天气未复现（资产缺，另记），生态切换只到色组层。",
              "decodedFrames": 203,
              "reviewEvidence": "artifacts/coverage/959530111187013632-r74.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  202
                ],
                "nativeRevisits": [
                  0,
                  70,
                  108,
                  109,
                  170,
                  202
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "分层地被：层绑物种组+六形程序草型+裁判成丛参数+表面型调制+雨生态色组近似；仅Node验收，不含原片美术/雨景天气"
              }
            },
            {
              "name": "2b 坡上长草，帮助读出可走的地方",
              "id": "1063115611289645057",
              "status": "done",
              "where": "src/life/vegetation.js",
              "toggle": "grass",
              "note": "593帧全核；坡面草丛8-14丛/格 vs 平地0.45丛/格（实测31倍，旧note写2倍偏低），全片无白虚线；仍缺平地草丛密度",
              "decodedFrames": 593,
              "reviewEvidence": "artifacts/coverage/1063115611289645057-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  592
                ],
                "nativeRevisits": [
                  1,
                  250,
                  400,
                  592
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "坡面草丛密度与可通行提示"
              }
            },
            {
              "name": "2c 草丛广告牌：一张朝镜头的卡片，片元里用 5 个圆的并集画\"扇贝边\"叶丛，叶瓣之间有弧形墨线；一簇簇堆在崖脚（暖橙 / 赭）、崖顶边和坡上，开阔草地只零星几簇",
              "id": "1590669875869286400",
              "status": "done",
              "where": "src/life/vegetation.js · src/core/anchored-billboard.js · index.html?scene=terrain",
              "toggle": "grass",
              "note": "249帧全核；草丛=朝镜头扇贝叶丛卡片（5圆并集+瓣间弧线），沿崖脚成簇；缺片子那种沿台地边缘的连续边带与7–9瓣",
              "decodedFrames": 249,
              "reviewEvidence": "artifacts/coverage/1590669875869286400-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  248
                ],
                "nativeRevisits": [
                  1,
                  60,
                  150
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "草丛广告牌：形态/朝向/分布"
              }
            },
            {
              "name": "草丛反差：181帧复核；原法为顶点shader采站立点/背景射线的纹理差，当前待实现",
              "id": "1590674061092212738",
              "status": "done",
              "where": "src/world/view-c11-grassline.js · src/core/c11-maps.js#bakeContrastHeightMap/grassOutlineStrength · index.html?c11=grassline",
              "toggle": "outline",
              "note": "181帧全核；顶点着色器两次采样（站立处 + 沿镜头射线的背景命中处）反差纹理之差定描边强度已落码并出运行验收。核实旧note的「只静态邻崖距离aEdge、未实现GPU采样/背景射线」为过期账（第29次同型）：view-c11-grassline.js + c11-maps.js#grassOutlineStrength 从 r56 就在，缺的只是页面运行验收。新测 tests/grassline-contrast-browser.cjs：4491丛草卡、强度 p50 0.0122/p90 1.0、>0.5 有1684丛；与静态 aEdge 判定不一致 43.0%；转180°有63.6%的卡强度变化>0.2（相邻45°中位0，局部不闪）；单卡隔离渲染48丛 GPU回读 vs JS孪生 最大差0.003；描边A/B：aEdge=1但背景同色（vEdge 0.001）轮廓环暗占比0.855→0.575、亮度51.7→77.6；aEdge=0但背景差大（vEdge 0.998）墨像素438→593(+35%)、环亮度47.8→42.2；同状态噪声0、0 console error。原note记的「GPU采样/背景射线」缺口核实为过期账",
              "decodedFrames": 181,
              "reviewEvidence": "artifacts/coverage/1590674061092212738-review-r150.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  180
                ],
                "nativeRevisits": [
                  1,
                  90,
                  150,
                  181
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "草卡站立处 vs 背景射线两次采样反差纹理 → 描边强度（含转镜头稳定性、与静态 aEdge 的区分、GPU 回读对齐）"
              }
            },
            {
              "name": "草边受控下垂：保留几何近似，原版atlas/rim采样待补",
              "id": "1696896119794479541",
              "status": "done",
              "where": "src/terrain/blotch-atlas.js · src/terrain/blotch-tongue-c09.js · src/world/view-shading.js · blotches.html",
              "note": "550帧复看（6张联系表+r172复看sheet-03崖肩近景）：顶面图集笔触；崖肩外缘一条窄深描边、色只垂到浅段齐平收住、深部崖壁干净。旧note「rim距离场/受控跨崖采样未迁移」=过期账；r170「等深带读不出」的真因本轮查明并修掉——BLOTCH_RIM_GLSL 缺 bleed>0 闸门，smoothstep(0,0,·) 退化成除零区间（GPU钳1）→ bleed=0 等于无限深、与 bleed=20 逐像素相同。补 step(1e-4,uBlotchRimQ.x)，blotch-atlas.mjs 加 GLSL 断言防回归；夹具两处坐标口径错（readPixels 第0行在下、NDC y=+1 在顶部）与探针落点（0.85台地内侧→扫到 rimDist 0 的崖肩线）一并修正。读数：bleed=0 全深归零；.14 等深带 0.10 世界米（CPU 0.125，.18 以下 drop<0.015）、.30 → 0.20（2.0×）；逐态 uniform 回读 0/0.14/0.30 全对；主场景 0→.14 2110px、0→20 68780px、strength0 3301px、噪声 0；近景 1430/7748px 噪声 0；顶面着色 10.0%、scale .09→.045 边界 6→0、舌头 26728px。",
              "decodedFrames": 550,
              "reviewEvidence": "artifacts/coverage/1696896119794479541-review-r172.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  549
                ],
                "nativeRevisits": [
                  1,
                  350,
                  455,
                  549
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "图集笔触+崖肩收边+受控跨崖渗漏（等深带世界米）+翻崖舌头"
              },
              "page": "index.html?scene=terrain&on=blotch"
            },
            {
              "name": "2g 顶面无缝混色（草 / 苔 / 沙之间柔和过渡）",
              "id": "1781405550061687016",
              "status": "done",
              "where": "src/terrain/patch-blend.js · src/world/view-shading.js ?shade=patchblend · patch-blend.html",
              "note": "219帧全核；投影 patch（草/水）+ 手工 UV 岸带 + 高度混合三种合成已实现并在页面与实景两层出运行验收：白点沿弧长 0.400–0.405、UV 条上白浪线 2 道、跨格边差分 p95 0.1336 vs 同格 0.1184（无 per-cell 硬缝）、jump hard 0.2543→height 0.094（alpha 0.0198）、softMeanPx 0→1.5、实景开/关 24919px 噪声 0 回位 0。本轮补岸带白浪线与圆形白点（原来一条线都没有、点是竖条），并新增 patch-blend.html（三模式 + 岸带 UV 展开条 + 近景窗）",
              "decodedFrames": 219,
              "reviewEvidence": "artifacts/coverage/1781405550061687016-review-r156.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  218
                ],
                "nativeRevisits": [
                  1,
                  120,
                  135,
                  218
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岸带手工UV(u弧长白点/v距离白浪线)+投影patch跨格连续+hard/alpha/height三模式A/B+主场景开/关"
              }
            },
            {
              "name": "每层地被：203帧全核，实际World分层色组；完整草型待补",
              "id": "959530111187013632",
              "status": "done",
              "where": "src/core/level-flora.js · src/life/vegetation.js · src/life/flora-species.js · level-flora.html",
              "toggle": "flowers",
              "page": "level-flora.html",
              "note": "203帧全核（0/70/108/109/170/202原尺寸）；109帧硬切紫色雨景。r74残差收口：层绑物种组+六形程序草型几何+裁判buildFlora成丛参数（presence≈.43/丛内4–9/半径.20–.46格/缩放.55–1.25）+表面型密度调制（岸/崖边/内部近似）+雨生态色组近似（紫/灰白，同键换色）；levelFloraShapes opt-in草型各向异性、共享leaf atlas单例绑定。残差：原片美术素材与雨景天气未复现（资产缺，另记），生态切换只到色组层。",
              "decodedFrames": 203,
              "reviewEvidence": "artifacts/coverage/959530111187013632-r74.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  202
                ],
                "nativeRevisits": [
                  0,
                  70,
                  108,
                  109,
                  170,
                  202
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "分层地被：层绑物种组+六形程序草型+裁判成丛参数+表面型调制+雨生态色组近似；仅Node验收，不含原片美术/雨景天气"
              }
            }
          ]
        ],
        [
          "灌木",
          [
            {
              "name": "边缘灌木：形变多边形内收锚点修复，球团近似保留",
              "id": "1707490274425884929",
              "status": "done",
              "where": "src/core/edge-inset.js · src/life/vegetation.js",
              "toggle": "shrubs",
              "note": "342帧全核验。保留既有球团近似；修复形变后仍用旧格心判内侧，改按实际多边形绕序/下一边界限幅。双网格实际556/564锚点通过平移形变、恢复及World不变验收；只保证锚点不保证球团体积。；【第62轮 A 类收敛】残差=球团体量（只保证锚点），形变后绕序判定修复且双网格 556/564 通过，判为 done",
              "decodedFrames": 342,
              "reviewEvidence": "artifacts/coverage/shrub-edge-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  341
                ],
                "nativeRevisits": [
                  160
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": ""
              },
              "page": "index.html?scene=terrain"
            },
            {
              "id": "1707490932017279035",
              "status": "done",
              "where": "src/terrain/shrub-band.js · src/terrain/shrub-texture.js:41 · terrain 场景 640×640 同机位（tests/shrub-band-scale-browser.cjs）",
              "note": "257帧全核（sheet-00/01/02 本轮重看 + frame-0150 6× 裁切）；逐三角带宽机制在位；同机位标定完成：本仓 apothem 130.09px 下 P90 20px / 原片 frame-0150 apothem≈130px 下 P90 18px，比值 0.154 vs 0.138（差 11%、本仓偏厚），SHRUB_BAND.max 维持 1.36；splitCells 全仓零命中（过期名词），真实三角化已用线框核过",
              "decodedFrames": 257,
              "reviewEvidence": "artifacts/coverage/1707490932017279035-review-r105.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  256
                ],
                "nativeRevisits": [
                  1,
                  120,
                  150,
                  205,
                  256
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "灌木逐三角带宽（per-triangle aBand）+ 同机位 P90 标定"
              },
              "page": "index.html?scene=terrain&on=shrubtex",
              "name": "纯纹理灌木：台地边灌木带 + 小阴影（顶面着色，不加几何）"
            },
            {
              "name": "3b 锚定中心：共享草卡片GPU对照通过，墙根灌木仍待接",
              "id": "1191990107785572352",
              "status": "done",
              "where": "src/core/anchored-billboard.js · src/life/vegetation.js · billboard-anchor.html",
              "page": "billboard-anchor.html",
              "note": "316帧全核（4张联系表）；片内只有一件事：灌木卡片任意机位都保持厚度与朝向（横移/俯视/贴地仰视都不塌成纸片、无popping），正是 anchored center vert。落点 anchored-billboard.js#billboardPoint(anchorMix/axis) + foldedCard 折角暗面 + billboard-anchor.html 对照页；实测 mixed 3712 簇/quad 4682 簇：旧模式中心漂移 0.10621/0.10783、中心固定 0。只剩原片灌木形状/贴图/atlas/生命周期（无源素材的程序化近似），判美术差",
              "decodedFrames": 316,
              "reviewEvidence": "artifacts/coverage/1191990107785572352-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  315
                ],
                "nativeRevisits": [
                  0,
                  58,
                  116,
                  315
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "中心锚定实例轴 + 折角卡片；不含原片灌木素材"
              }
            },
            {
              "name": "3c 球面叶纹 × 视角alpha：真实贴图/连续覆盖 + 阴影caster/远景impostor已补；原作手绘轮廓待（卡点·B）",
              "id": "1205420678859632640",
              "status": "partial",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/leaf-depth.js · src/life/leaf-impostor.js · vegetation.js",
              "toggle": "leafy",
              "page": "leaf-surface.html",
              "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；本轮补匹配的阴影caster（leaf-depth.js：树冠customDepthMaterial与彩色材质同源——同共享图集/同视角alpha判据（视角=正交阴影相机）/同风摆，浏览器leaf-depth程序真实编译）与远景impostor（leaf-impostor.js交叉面片×共享32²图集+updateCrownLOD距离阈值，地形岛实测79树近40/远39分档、图集单例不分裂）；原作手绘轮廓仍待补。；【卡点·B 美术资产】原作手绘轮廓仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 443,
              "reviewEvidence": "artifacts/coverage/leaf-shadow-impostor-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  442
                ],
                "nativeRevisits": [
                  180,
                  350
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "球面叶纹/视角alpha + 阴影caster + 远景impostor（程序近似）"
              }
            },
            {
              "name": "3d 植物32²角落atlas：已接共享树冠/灌木；全场景共图与原作素材待补",
              "id": "1241046107125399552",
              "status": "done",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/vegetation.js · tests/leaf-atlas-shared.mjs · tests/leaf-atlas-shared-browser.cjs",
              "toggle": "shrubs",
              "page": "leaf-surface.html",
              "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。本轮收口「真实128²/32²保留区 + 连续texel采样 + 全场景共图」：①leaf-atlas.js 布局/叶纹单源化——改从 core/town-skin.js 引 PLANT_RECT(96,96,32,32)/writePlantCorner，独立叶图集与全城 TownColor 图集角内逐字节一致（裁判：REACode src/texelsnap.js bakeAtlas x0=y0=size−corner=96）；②连续texel采样——skipTexel 为分段连续 UV 重映射+双线性（非最近邻点采样），新增 CPU 镜像 leafPatternCPU 数值断言：texel 中心精确回读、相邻中心中点取混合、ε 扰动 ε 变化、fw≥2 均值淡出；③进程级共享单例 sharedLeafAtlas()/sharedLeafTexture()——所有 Vegetation 实例与共享灌木/树冠材质绑同一个 DataTexture 对象（不再是每次 makeLeafSurface 各建一张）；④全场景共图——TownSkinLayer 开时 leafSurface.uniform 指到全城同一张纹理对象，浏览器实测 boundIsSkinTex/角外alpha=255/角内同motif/关闭还原。Node tests/leaf-atlas-shared.mjs + tests/leaf-atlas.mjs 与浏览器 tests/leaf-atlas-shared-browser.cjs 全 PASS（skinned 28752 顶点/60槽/mismatch 0）。残差（程序近似与缺失原资产分开记录）：角内叶纹为程序近似 motif，原作手绘植物素材与全部植物种类未迁（卡点·B 美术资产）。",
              "decodedFrames": 168,
              "reviewEvidence": "artifacts/coverage/1241046107125399552-review-shared-atlas.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  167
                ],
                "nativeRevisits": [
                  80
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "32² 保留区单源化+角内逐字节一致 · 连续 texel 采样 CPU 镜像断言 · 进程级纹理单例（Vegetation/灌木/树冠同一对象）· TownSkin 同纹理对象绑定/关闭还原（浏览器实测）；原手绘植物素材未迁=美术资产卡点单独记"
              }
            },
            {
              "name": "后院小径：院内邻接图连接主轴端点，孔洞不跨越；细石板/门口规则/中心装饰待补",
              "id": "1290997501332525056",
              "status": "done",
              "where": "src/build/garden-plots-c07.js · src/build/buildings.js:171,435 · src/world/view-c07.js(?c07=gardenplots) · garden.html",
              "page": "garden.html",
              "note": "187帧全核；门优先窄石板小径 / 中心圆台 + 装饰 / 草地块石沿三件都在 build/garden-plots-c07.js（world.gardenPlots 默认关，?c07=gardenplots 开），本轮补 build 侧 gardenC07 只读台账 + 浏览器验收：门格 1/1 落在小径上且各有石板条出到门外、从 hub 走满 3/3 小径格、条宽 0.36·rc、草地块 2 块 9 格；关开关退回 PCA 端点方案 7 格（4 格只在旧方案），噪声 0、差分 814px；混合网格无门院子回退 8 格不消失。中心装饰是石台 + 圆冠灌木，原片石球未做",
              "decodedFrames": 187,
              "reviewEvidence": "artifacts/coverage/1290997501332525056-review-r129.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  186
                ],
                "nativeRevisits": [
                  100,
                  140,
                  160,
                  186
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "门口优先小径 / 窄石板宽度 / 中心装饰"
              }
            }
          ]
        ],
        [
          "树",
          [
            {
              "name": "4 Marching Cubes 团块做树冠",
              "id": "1580158269267406849",
              "status": "done",
              "where": "src/core/canopy.js · src/life/vegetation.js · index.html?scene=terrain",
              "toggle": "trees",
              "note": "283帧全核；树冠=球并集团块（surface nets）+整团连续受光、瓣间无折痕，与本仓等价；缺参考片的瓣径差异与顶部亮边",
              "decodedFrames": 283,
              "reviewEvidence": "artifacts/coverage/1580158269267406849-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  282
                ],
                "nativeRevisits": [
                  1,
                  160,
                  240
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "树冠团块：闭合流形/整团法线/三套变体"
              }
            },
            {
              "name": "4b 标记三角形之间的边（团块描边）",
              "id": "1580162341668237312",
              "status": "done",
              "where": "src/core/canopy.js · src/life/vegetation.js · src/life/impostor.js",
              "toggle": "outline",
              "page": "scene:terrain",
              "note": "155帧全核（2张联系表+原尺寸0060）；球并集surface nets+按面最近球标接缝+弹簧/气球松弛，闭合定向与硬边收缩通过；用surface nets而非原作MC",
              "decodedFrames": 155,
              "reviewEvidence": "artifacts/coverage/canopy-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  154
                ],
                "nativeRevisits": [
                  0,
                  60,
                  154
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "树冠球并集表面+接缝松弛（surface nets 替代 MC）"
              }
            },
            {
              "name": "树转镜：旋转锚点/正交与透视/周界GPU通过；原octagonal卡片与俯仰仍缺",
              "id": "1849427564034498642",
              "status": "partial",
              "where": "src/life/impostor.js · src/life/impostor-c09.js · impostors.html · impostor-planet-c09.html",
              "toggle": "impostor",
              "page": "impostors.html",
              "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；第55/56批已补多俯仰行+球面卡片+球面局部上方（impostor-c09.js、impostor-planet-c09.html、?fx=impostorpitch、浏览器扫掠过）。2026-11-26裁判对照：REACode engine/impostor.js仅单仰角0.32八方位柱面卡+锚定中点+球面叶alpha（townscaper-reference同款），无球面/多俯仰烘焙可移植；残差=原作卡片排布原片全程低机位不可证、配文仅「octagonal」一词，树冠/云形/星球配色程序近似 → 永久卡点，需新证据再立项。；【卡点·C 算法未公开】原作卡片排布（球面/多俯仰与否）配文未公开、画面不足以反推 → 永久卡点，需新证据再立项",
              "decodedFrames": 334,
              "reviewEvidence": "artifacts/coverage/1849427564034498642-pitch-verdict.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  333
                ],
                "nativeRevisits": [
                  55,
                  206,
                  315
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享锚点/正交平行/透视视差/64步周界GPU通过；多俯仰行+球面卡片+球面局部上方impostor独立用例通过（impostor-pitch.mjs、c09-life.mjs、impostor-planet-c09.html扫掠）；残差=原作卡片排布不可证（永久卡点）+原素材程序近似"
              }
            },
            {
              "name": "运行时精灵：GPU烘焙/释放/回滚+自动扩容重排；残影与原素材待补",
              "page": "atlas-live.html",
              "id": "1593215065423245313",
              "status": "partial",
              "where": "src/life/impostor.js · src/life/vegetation.js · src/world/view-post-extras.js · atlas-live.html · tests/impostor-grow.mjs",
              "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收。本批补自动扩容/重排：满板按REACode SpriteAtlas.insert语义翻倍、atlas.repack整批重排，rt.setSize原位放大（rt/texture对象不变，uTex/map免重绑）+scratch备份逐槽搬运，存活frames就地改写、注册ImpostorField经syncFrames同步（vegetation/view-post-extras/planet-c09消费方已接），maxSize封顶与搬运中途GPU失败两路回滚；tests/impostor-grow.mjs过（UV/槽位一致性、9次blit调用序列、两路回滚）+ atlas-live-browser.cjs真实GPU验收（512→1024扩容存活像素逐位一致、超maxSize拒绝）；扩容策略原片配文未明说属本地近似。残差：本地清透明不等于原调试残影、原素材/完整SpriteAtlas接口仍缺。；【卡点·A 机制未做+B 美术资产】残影近似与完整SpriteAtlas接口属可做未做，原素材无源只能程序化近似 → 自动扩容/重排机制本批已核销",
              "decodedFrames": 164,
              "reviewEvidence": "artifacts/coverage/atlas-candidates-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  163
                ],
                "nativeRevisits": [
                  13,
                  37,
                  44,
                  68,
                  97,
                  145
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享跨叶候选/key释放和8视角动态GPU烘焙/回收/异常恢复+自动扩容重排（翻倍+逐槽搬运+UV同步+两路回滚，browser真GPU存活像素逐位一致）局部通过；非原素材、3D树或完整API"
              }
            },
            {
              "name": "蓬松云：裁判风材质/前景视差/蓬松烘焙已验；原云形美术仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · src/core/cloud-motion.js · src/life/vegetation.js · src/light/cloud-shadow.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html",
              "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。r214 残差补全：裁判 engine/impostor.js 云风材质（uWindAmt 树0/云0.6、实例位置相位 ph=x*.13+z*.17、三轴异频 sin .11/sin .15/cos .09、幅度 y×.25/z×.6）函数化移植为 cloud-motion.js cloudWindBob+CLOUD_WIND_BOB_GLSL，CLOUD 非 HORIZON 分支接 uWindAmt；前景云层次补 uCloudParallax 视差（cd=mix(1,depth,parallax)，与 clouddeck v∝1/depth 同口径），vegetation 近云按离岛半径 nearCloudDepth 1→1.8 分层；近云换 fluffyCloudGeometry 菜花云（顶点色烘灰蓝底/暖白顶，远景阴云仍共用旧 cloudGeometry）；cloud-shadow CPU 镜像同除 cd+bob。tests/cloud-motion.mjs+cloud-wind-layers.mjs（默认0零侵入/CPU模型/球面锚点）+ cloud-wind-browser.cjs 真实GPU双网格（位移vs模型<2e-4、depth2.5视差比0.4、默认档逐位回旧、31实例深度1.202→1.744）；clouds/cloud-depth/cloud-shadow/impostor-view/leaf-shadow/cloud-receiver 回归全过；vendor 5文件逐字（impostor-c09.js首拷）。残差=原片云形/层次排布/真实风参数未公开（程序近似）。；【卡点·B 美术资产】原蓬松云形精确形状、前景云层次精确排布与原作风材质参数未公开，裁判风材质公式与视差口径已对齐移植 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
              "decodedFrames": 235,
              "reviewEvidence": "artifacts/coverage/1852334860137849222-review-r214.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  234
                ],
                "nativeRevisits": [
                  0,
                  80,
                  200
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界、背景云GPU时钟/连续运动/遮挡与近云裁判风材质/前景深度视差/蓬松云烘焙GPU验收通过；非原球面卡片、原云形美术或未公开风参数"
              }
            }
          ]
        ],
        [
          "续作学习与缺口",
          [
            {
              "id": "1707497006640365880",
              "status": "done",
              "where": "src/terrain/shrub-band.js · src/terrain/terrainmesh.js:236 · src/core/meshwriter.js:216 · terrain 场景 640×640 同机位（tests/shrub-band-scale-browser.cjs）",
              "note": "600帧全核（sheet-00…05 本轮 6/6 全看）；逐三角带宽机制在位；同机位标定与 1707490932017279035 同源（本仓 P90/apothem 0.154 vs 原片 0.138，差 11% 且本仓偏厚）→ SHRUB_BAND.max 维持 1.36 不改；splitCells 为过期名词（全仓零命中），真实 triC 扇 + edgeTri 已用线框截图核对，带子外沿落在外圈顶点",
              "decodedFrames": 600,
              "reviewEvidence": "artifacts/coverage/1707497006640365880-review-r105.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  599
                ],
                "nativeRevisits": [
                  1,
                  100,
                  300,
                  450,
                  599
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "灌木逐三角带宽（per-triangle aBand）+ 同机位 P90 标定"
              },
              "page": "index.html?scene=terrain&on=shrubtex",
              "name": "生成地形上自动出现的纯纹理灌木"
            }
          ]
        ]
      ]
    },
    {
      "key": "fusion",
      "name": "融合 · 第三个项目 → 球面",
      "color": "#7b5fb0",
      "note": "平面融合已共用World；显式双格房屋、整体编辑和撤销已接入。实例身份持久化、完整预制socket/联合WFC与共享World球面融合仍待补。",
      "groups": [
        [
          "流程",
          [
            {
              "name": "方形沿对角切四三角：父格追溯/实际WFC；联合模块待补",
              "id": "1447494168448753667",
              "status": "done",
              "where": "src/core/grid.js#buildTriangularSubgrid · src/core/wfc.js#jointSubtileCatalog/#layeredJointCatalog · joint3d.html",
              "page": "wfc.html?subtiles=1",
              "note": "178帧全核（2张联系表 + 原尺寸0050/0130）；note 挂久的「四子格联合模块约束及原3Dtile仍缺」已过期：jointSubtileCatalog/layeredJointCatalog 都在 wfc.js，joint3d.html 叠3层且 tall: 插槽出跨两层塔。页面运行验收：69父格/150子格=69+3×27（方格四分、三角1:1）、3层、conflicts 0、mismatch 0、towers 5、34.8ms；反向对照 ?joint=0 mismatch 81、换种子 seed9 仍 0。未改码，只补运行验收与量具。",
              "decodedFrames": 178,
              "reviewEvidence": "artifacts/coverage/1447494168448753667-review-r119.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  177
                ],
                "nativeRevisits": [
                  50,
                  130,
                  177
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "对角四分/混合tile共享WFC/三层联合约束/跨层塔 + 页面正反例运行验收"
              }
            },
            {
              "name": "2 显式双格房屋：原子放置/整体替换/移除与撤销；实例身份、统一撤销与预制socket/联合WFC",
              "id": "1579483114178768898",
              "status": "done",
              "where": "src/build/multicell.js · src/build/prefab-socket.js · src/ui/house-project.js · src/world/scenes.js · multicell.html",
              "page": "multicell.html",
              "note": "177帧已复核；通用模块身份落地：回执 placement.instance + world.houseInstances 登记（id 留洞不复用，随 world.snapshot() 统一撤销/恢复——多格整体操作一个撤销条目），整栋替换/移动/改色身份不丢；工程JSON保存实例ID/编辑回执，完整重载/页面刷新后继续整栋编辑；prefab库×4朝向、墙/门socket与联合WFC在 build/prefab-socket.js，placements 带 pf:<prefab>:<锚点> 实例身份，TigerMessenger building.joint-wfc 真实消费。四边与混合网格回归通过（multicell/multicell-edit/multicell-identity/house-project/prefab-socket + multicell.html 浏览器验收）。仍缺：原版 prefab 内部美术/房型细节与更全的 socket 类型；多格体素房屋的游戏侧消费者未接（游戏走 joint-wfc placements，不走 multicell）。",
              "decodedFrames": 177,
              "reviewEvidence": "artifacts/coverage/house-project-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  176
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "多格实例身份/统一撤销/工程JSON重载/四边与混合网格回归、prefab socket 联合WFC 接建筑管线；非原版 prefab 内部美术与全部 socket 类型"
              }
            },
            {
              "name": "笼形变：分数层连续角点/沉积线采样；3D碰撞待补",
              "id": "1579478470098243584",
              "status": "done",
              "where": "src/terrain/cage-c09.js · src/terrain/terrain-strokes-c09.js · src/world/build-reel-c09.js · cage.html · island-build-c09.html?mode=cage",
              "toggle": "smooth",
              "page": "cage.html",
              "note": "272帧全核；笼形变在壁面内部与碰撞两侧都量住——cageWallPoint 与 terrainmesh 实际墙四边形 5×3 逐点重合（maxDev 0/4.4e-16），形变后 cageCollider.pushOut 把陷进岩石 0.08 的探针推出（inside=false 余量=r 接触=1），terrain-collide 认同 60/60；竖向笼边弯曲量 quad 0.0661 / mixed 0.0664。本轮补 cage.html「笼碰撞探针」入口 + tests/cage-deform-browser.cjs（mixed/quad 双网格 + island-build-c09.html?mode=cage 的 wire→hold→color 时间结构、overlay 淡出与转镜 yaw 0.91→2.55）。形变强度比原片激进程度保守属美术差",
              "decodedFrames": 272,
              "reviewEvidence": "artifacts/coverage/1579478470098243584-review-r122.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  271
                ],
                "nativeRevisits": [
                  1,
                  40,
                  160,
                  220,
                  271
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "笼壁内部插值 + 形变后 3D 碰撞 + 线框构建/着色/转镜时间结构（mixed/quad）"
              }
            },
            {
              "name": "房屋插入地形：453帧核验，保留共享双格/整体编辑；任意轮廓重网格待补",
              "id": "1584623053061099520",
              "status": "done",
              "where": "src/build/splice-polygon-c09.js · src/terrain/terrainmesh.js · splice-c09.html",
              "page": "multicell.html",
              "note": "453帧全核（联系表 5 张 + 原尺寸 0155/0303/0392/0452）；旧账「任意轮廓插入/地形周边重新网格化仍缺」核实为过期账（第39次同型）：splice-polygon-c09.js#spliceFootprint r56 就在（任意可凹轮廓→外扩单环→带洞桥接+耳切+约束Lawson），terrainmesh 三处挂钩在，node 测试一直绿，缺的只是页面运行验收。本轮补新测 tests/splice-polygon-c09-browser.cjs：mixed/quad 两格型面积账 1.11e-15/6.66e-16、半边问题拼接前后 1==1 / 0==0、边界环 = 底+1 个占地洞（3=2+1 / 2=1+1）、Euler 0、占地 6 点 1 凹口横跨 14/17 格、半边扇步数 164/162 且最大扇角合 360°、房子 12 屋顶三角 6 面墙、实体 A/B 中心裁切屋顶 75821 vs 7482 px 墙 8075 vs 0；如实口径：最小角 0.68°（约束边上的薄三角，肉眼不可见），房子是直骨架四坡顶替身（原片多段屋顶/烟囱属预建 tile）",
              "decodedFrames": 453,
              "reviewEvidence": "artifacts/coverage/1584623053061099520-review-r163.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  452
                ],
                "nativeRevisits": [
                  1,
                  155,
                  303,
                  392,
                  452
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "任意（可凹）轮廓拼进真实地形顶面 + 周边重网格 + 半边绕顶点 + 实体房子（含开/关 A/B）"
              }
            },
            {
              "name": "指定模块patch：共享World事务落地（splice/fit·socket补网·形变碰撞·整体回滚）",
              "id": "1751932427272909032",
              "status": "done",
              "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js · src/build/module-patch-commit.js",
              "page": "patch.html",
              "note": "复用552帧；显式patch/搜索/几何复核、共享World原子体量放置/撤回、多格prefab+socket+联合WFC、3D prefab强制出现此前各批已落；本批补 module-patch-commit.js 事务层：splice/fit 打补丁 → 边缘socket逐条收集 → solveWithPrefab周围补网并独立复核 → 体量原子写入 → 新旧列逐格对比出「形变碰撞」可走面/阻挡清单 → 失败全回滚（splice弃新World/fit暂存列），撤回还旧World或就地restore。两种网格、支撑/碰撞失败保留原World、相邻模块接口复核均过单测。游戏侧消费者未接（building层走的是高度场joint-wfc），共享网格patch仅REACodeRefactoring演示页可接。",
              "decodedFrames": 552,
              "reviewEvidence": "artifacts/coverage/module-patch-commit-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  551
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享World指定模块patch事务（socket补网/形变碰撞/整体回滚）库级验收；游戏运行时未接"
              }
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · src/sphere/world-sphere.js · src/sphere/sphere-world.js · planet.html · sphere-world.html · sphere-shore.html",
              "page": "planet.html",
              "note": "229帧全核验；r205 补「平面World→球面」接线层 src/sphere/world-sphere.js：'bend' 模式与实景十二门徒 bendU/uBend=S/(2Rw)/帽面法线/锚点 frame 逐式同口径（抛物面下弯），'sphere' 方位等距严格上球（|p|=R、径向保距、往返一致）；柱格姿态=位置+径向up+测地平行搬运基+切平面 yaw，邻接格共享角点映射逐位相同（接缝闭合）；岸线=traceShoreLoops 平面黄线贴球→按角距细分→球面 Taubin 平滑→沿搬运法线测地外推蓝线，闭环相邻角距受控。r209 补球面 World 网格生成/编辑/保存恢复 src/sphere/sphere-world.js：sphereGrid 由 patch+网格参数产出真 cell 拓扑（grid.js 共享角点+edgeNeighbors/edgeTwins，非姿态摆放）附 pts3/pose，quad/square/hex/mixed 四类全落球接缝闭合；spherePick→sphereApply 把球面 3D 点翻译成落格编辑（build/erase/raise/dig/level/paint 与平面 applyAt 同语义）；encode/decodeSphereWorld 与 save.js 同风格位流+游程+版本/mode/网格参数/patch 指纹校验。tests/sphere-world.mjs 5/5 + world-sphere 等 sphere/planet 套件回归 PASS。浏览器验收（sphere-world.html + tests/sphere-world-browser.cjs，真实 GPU/three r160 + 本机 Chrome swiftshader）：634 格渲染成 1268 三角面片（非有限顶点 0、2536 角点引用全在 R=60 上）；sphereEdit 14 次贴内 build/erase/paint/raise/level 全 changed、贴片外拾取无操作，前后帧逐像素差 30381px/maxΔ167；encode→decode 进同规格 World 体素四数组逐位相等、再编码逐字相等、换渲染恢复出的世界逐像素一致 diff 0；接缝 2452 条内部半边 twin 角点 3D 距离全 0，weld 对账 2532/2536 角点引用被≥2格共享（边界 4 个单格角点除外），最多 6 格共点，接缝特写无裂缝。r211 vendor 拷贝+海岸线浏览器验收：src/sphere 全 13 文件+依赖闭包 core/trigraph.js 逐字进 TigerMessenger/src/vendor/townscaper-rea-refactoring/src/（sphere 只依赖 World/MAX_LEVEL 与常规体素接口，core/world.js 保护文件未动、splicedHouses/houseInstances 快照字段保持旧口径；cmp 逐字一致、node --check 全过、TigerMessenger --test 463/463 绿）。球面平滑海岸线浏览器验收（sphere-shore.html + tests/sphere-shore-browser.cjs，8769 静态服+本机 Chrome+playwright）：fbm 确定性水陆世界 634 格（陆136/岩56/水498，主岛+内湖+小屿）→ worldShorelines(spacing0.18/maxStep0.05/smooth6/reach0.4) 得 3 条闭环 188+42+45=275 点；断点 0、非有限点 0、最大步角 0.0031≤0.05、径向偏差≤2.2e-14、法线与径向|dot|≤8.4e-17、蓝线测地外推 0.4 同半径；跨接缝 84 个岸角 343 份角点引用逐位一致（缝0/错0）；同 World 重抽与 spec 重建再抽逐字相等；岸线叠加像素差 5041px；vendor 拷贝 ?src=vendor（8931 服）同数通过。残差：游戏运行时接入（vendor 文件就位、运行时改调未做，属换批）。；【卡点·B 美术资产】原片模块形状/海岸美术细节未知，程序近似与美术差分列；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 229,
              "reviewEvidence": "artifacts/coverage/1768627849529893109-review-r209.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  228
                ],
                "nativeRevisits": [
                  0,
                  90,
                  190
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "平面World→球面映射/柱格姿态/球面岸线连续 + 球面网格生成/编辑/保存恢复 Node 用例验收（与实景 bend 同口径）+ 球面网格渲染/球面编辑像素差/存档往返逐像素/接缝顶点对账浏览器验收+ 球面平滑海岸线浏览器验收（水陆世界3环275点/断点0/径向≤2.2e-14/跨接缝84岸角全零/双次确定性逐字/岸线像素差5041px/vendor 拷贝同数）；vendor 文件拷贝已就位、游戏运行时接入与原片模块视觉（卡点·B）未验收"
              }
            },
            {
              "name": "防蘑菇化：多格联合拟合+冲突诊断/消解；原模块目标无出处",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · src/sphere/module-group-fit.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐轮保最优，最差边绝不差于相似解），edgeTol 超阈值回退分格拟合+逐边诊断 moduleGroupReport；moduleGroups 把声明模块切成独立联合单元。r213 补「多格冲突仍待补」：裁判库核对——REACode engine/relax.js 无模块组语义、spheretown 列本片 relax 为 Not done、多格 tile 为 todo，无原作多格冲突语义可对齐 → 按本仓 build/multicell.js 拒绝码实现 moduleConflictReport（求解前静态诊断：invalid-cell/duplicate-cell/overlap/disconnected/unresolvable=拒绝级，sea/uneven-support/assembly-cut=诊断级，装配 order 里不连续足迹记 assembly-cut）+resolveModuleGroups 确定性消解（剪非法/重复/重叠→连通切分→角距仍超 farLimit 丢弃并逐条记账，不伪造可行解）+cornerPositions moduleCheck 拒绝入口（枚举全部拒绝原因一次抛出）；unresolvable 与求解器同界（海平面足迹角距>1.2rad≈69°→逐层必 unresolved）。tests/module-group-fit.mjs 7/7（4 格足迹各层最差边 0.0001–0.133 vs 分格 0.08–0.405，全局 moduleSizeReport 0.399 < spring 0.535，曲率扫描/确定性/拓扑接缝校验）+ module-group-conflict.mjs 9/9（冲突全枚举/unresolvable 边界/消解确定性/moduleCheck 拒绝）+ sphere 套件回归过。；【卡点·C 物理冲突+B 资产】尺寸与墙倾斜的冲突使宽高原蘑菇化有下界（far 越大上限越紧，>69° 组角距记 unresolved 不收）、原模块目标形状在 REACode 无出处（海平面足迹=推断）、vendor 两文件已逐字拷入、r214 浏览器验收过（planet.html?solver=joint 实测：disagreeMean 0.0111≈shape 0.0075≪spring 0.0953、0 翻折、unresolved=6 与 moduleConflictReport 诊断一致，tests/sphere-joint-solver-browser.cjs）/游戏运行时接入属换批；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/1769641473895432220-review-r213.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  478
                ],
                "nativeRevisits": [
                  100,
                  170,
                  215,
                  275
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "多格联合拟合/误差约束 Node 用例验收（多高度多格足迹最差边<分格、前后曲线、接缝拓扑、超阈值回退）+多格冲突诊断/消解 Node 用例验收（拒绝级全枚举、unresolvable 角距边界、消解后 ok、装配切断、确定性、moduleCheck 拒绝）；planet.html 已挂 solver=joint 选项但浏览器未跑；原模块目标形状仍无出处"
              }
            },
            {
              "name": "8 沿河导航：高差优先/平床河口距离，战斗及流场共用费用",
              "id": "1795831296952041691",
              "status": "done",
              "where": "src/world/navgraph.js · planet-rivers-c09.html?nav=auto（球面）+ river-nav.html（平面）",
              "toggle": "nav",
              "page": "river-nav.html",
              "note": "598帧全核；沿河加权导航图（河格顺流0.3/逆流0.65、高差优先、平床读carve顺序、判不出保持中性）+ findPath/stats/simplify 三接口都在，本轮补球面层运行验收：新测 tests/river-nav-sphere-browser.cjs 在 planet-rivers-c09.html?nav=auto 上量出 391/391 河格边全判顺流、0 中性 0 上坡顺流、58 条汇流支流全部汇入更便宜、主干顺流0.725<逆流1.090<沿路步行2.533、speedup 3.49、detour 0.524；平床河格352对顺逆价格比精确0.3/0.65。旧note的球面/复杂汇流/完整接口核实为过期账",
              "decodedFrames": 598,
              "reviewEvidence": "artifacts/coverage/1795831296952041691-review-r139.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  597
                ],
                "nativeRevisits": [
                  44,
                  174,
                  200,
                  280,
                  597
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "沿河更快：球面弦长 metric + 复杂汇流方向 + 顺/逆/步行三口径 + findPath/simplify 接口"
              }
            }
          ]
        ],
        [
          "逐帧核验补登",
          [
            {
              "id": "1798310423554658732",
              "name": "（帖子无文字说明）",
              "status": "done",
              "where": "src/world/field-plot-map.js · src/world/view-shading.js(?shade=fieldplots) · fields.html",
              "page": "fields.html",
              "note": "614帧全核；地块耕纹接回 View 主材质：新增 world/field-plot-map.js（partitionPlots→世界XZ浮点图：行号/田埂/地块色调/有效）+ view-shading ?shade=fieldplots（手写双线性+宽软带+田埂压暗），terrainmesh 旧逐格hash口径默认不动。读数为真 World：169×151纹素/texel0.1/可种格541/地块195/主轴最大夹角89.97°；开/关整帧18367px、噪声0；两块地(23°/113°)画面上条带方向95°vs5°(差90°)，与主轴投影偏差9.4°/6.2°；CPU孪生861点tone 0.650–1.223。新测 tests/field-plot-map.mjs + tests/field-plots-main-browser.cjs 11/11 PASS，0 console error。如实：条带对比度比片内淡（程序化世界图 vs 烘焙贴图），地块参数按片内3–8格/一屏4–6条带定，未逐帧反推原作参数；片内白色[ ]标记层未复刻。",
              "decodedFrames": 614,
              "reviewEvidence": "artifacts/coverage/1798310423554658732-review-r212.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  613
                ],
                "nativeRevisits": [
                  1,
                  300,
                  480,
                  600,
                  613
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "地块级耕纹（主轴/人字/宽软带/田埂）接主场景"
              }
            },
            {
              "id": "1724449858369568780",
              "name": "Ok, here's a small example. The button toggles a…",
              "status": "done",
              "where": "src/core/node-graph-editor.js · src/ui/node-graph-editor.js · node-editor.html（对照 node-graph.html）",
              "page": "node-graph.html",
              "note": "134帧全核（sheet-00/01 两页）；缺口清空——可拖拽节点编辑器（node-editor.html + src/core/node-graph-editor.js + src/ui/node-graph-editor.js）此前只验过序列化与只读连线图，本轮补出真鼠标运行验收：拖 compose (480,240)→(520,300) 且过程跟手、undo/redo 回位；点连线 6→5、拖 compose:out→sink:in 接回 6 边；bool→number 被拒且快照逐字节不变；speed 20→40 后 tick(0.25) 走 10、tick(100) 停在 -33.8；导出/载入含布局回放；7 节点 6 边 13 端口，页面 0 console 错误",
              "decodedFrames": 134,
              "reviewEvidence": "artifacts/coverage/1724449858369568780-review-r111.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  133
                ],
                "nativeRevisits": [
                  1,
                  30,
                  72,
                  133
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "可拖拽节点编辑器：拖动/拖线接线/点线删除/参数驱动运行图/撤销重做/导出载入含布局"
              }
            },
            {
              "id": "1671840905957978113",
              "name": "Hmm.. I thought it was gonna be too wacky but ma…",
              "status": "done",
              "where": "src/core/terrain-burial.js · terrain-stages.html",
              "page": "terrain-stages.html",
              "note": "246帧全核；抬地面吞建筑的规则之外补齐了剩余两条缺口：崖面墙裙残留（cliffSkirt：台账×只剩屋顶×崖面，ground-0.34 内缩 0.08）与悬檐联动（每面配一个 ground..ground+0.45、再缩进 0.17 的檐下暗带，bands 与 notches 一一对应）；页面 #bury 按深度顺序画墙裙+暗带并暴露 skirt()；无剩余缺口",
              "decodedFrames": 246,
              "reviewEvidence": "artifacts/coverage/1671840905957978113-review-r106.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  245
                ],
                "nativeRevisits": [
                  1,
                  120,
                  245
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "地表掩埋 + 崖面墙裙残留 + 悬檐联动（World 体素 + 页面像素验收）"
              }
            },
            {
              "id": "1670064751181791233",
              "name": "I figured out how to mimic Thread.Sleep() in Bur…",
              "status": "done",
              "where": "src/terrain/pipeline-job-c08.js + pipeline-job-worker-c08.js · job-c08.html",
              "page": "terrain-stages.html",
              "note": "420帧全核（5张联系表）；片内=一轮22.83s：清空→三角网逐点生长7.4s→抬墙→灰模→纯黑剪影0.38s→上色→静止，可分辨的阶段边界与CLIP_RHYTHM对齐（tri7.41/7.07、sil0.38/0.40、一轮22.0/22.83）；job 线程+共享时钟慢放机制早已在（runJob/createJobControl/makeJobSleep/Atomics.wait + module Worker），本轮补的是真缺口：serve.py 没发COOP/COEP→页面crossOriginIsolated=false、SharedArrayBuffer不存在→退成copied-busywait（暂停键死、倍率只在启动读一次）；现只给 /job-c08.html 与 /src/terrain/pipeline-job* 发COOP/COEP。新测 tests/pipeline-job-shared-clock-browser.cjs PASS：coi true+sab可用+mode shared-atomics+真Worker实例、job睡觉期间主线程rAF 24帧/400ms、阶段顺序全对、运行时主线程setScale(0.02)让clay从2771ms掉到145ms（19.1×，墙钟与时间线同值）、暂停后消息155→155不动且恢复后继续、?rounds=2出现2次clear；回归 pipeline-job-c08.mjs/pipeline-stages.mjs/terrain-stages-browser.cjs PASS",
              "decodedFrames": 420,
              "reviewEvidence": "artifacts/coverage/1670064751181791233-review-r146.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  419
                ],
                "nativeRevisits": [
                  1,
                  150,
                  225,
                  232,
                  419
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "job 线程 + 共享时钟分阶段慢放"
              }
            },
            {
              "id": "1654401054828638214",
              "name": "An quaint island being procedurally generated",
              "status": "done",
              "where": "src/terrain/pipeline-stages.js · src/terrain/clay-ao.js · terrain-stages.html",
              "page": "terrain-stages.html",
              "note": "343帧全核；两条剩余缺口补齐：灰模AO与软阴（新模块 src/terrain/clay-ao.js：vertexAO 半径2.6距离加权、sunShadow 沿太阳方向步进返回被挡比例→渐变压暗、shadeFactor 合成 + 下限0.34；页面可A/B，AO 0.612–1.000/97档）与生成后地形微调（tweakTerrain 余弦falloff 只改高度不重铺拓扑 + terraceArea，台地 202.1→210.1、两次微调单调）；无剩余缺口，表现层差异（Unity实时拾取 vs canvas等距）不计为机制缺口",
              "decodedFrames": 343,
              "reviewEvidence": "artifacts/coverage/1654401054828638214-review-r106.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  342
                ],
                "nativeRevisits": [
                  1,
                  150,
                  200,
                  260
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "灰模 AO+软阴（顶点遮蔽场 + 太阳方向软阴影）与生成后台地微调（含页面 A/B 与像素验收）"
              }
            },
            {
              "id": "1490068909042642944",
              "name": "Late night cryptic graph tweet",
              "status": "done",
              "where": "src/core/graph-bands-c08.js · graph-bands-c08.html",
              "page": "grid-graph.html",
              "note": "427帧全核（5张联系表+原尺寸复核0000/0250/0390/0426+3×裁切）；机制=邻接图环带布局：4条同心环带（带内真实格邻接）、带间4方向单边辐条+4外伸悬挂、0200-0299从中心逐层BFS前沿（黄/红）、0300后按环带上色；三条旧账全部用同一口径量两边后定案：颜色跟半径不跟角度（终帧蓝带色相210-225命中36/36个10°扇区、r p10 67/p90 100，分桶一致率半径27.6% vs 角度18.6%）、节点半径=辐条端点放大（3×裁切可见带间缝仅1根边、两端点圈更大）、极坐标网12放射线+72刻度；本仓462节点/606边/16辐条/31桥/区域180·154·101·23+4/22层，四条带均半径0.91/2.82/5.00/6.89递增，渲染色相青1079·蓝5220·品红8713各自36/36扇区且径向量程不交叠，搜索态10/22层红1350·黄1695px，换种子466节点仍4带；美术差（原片带厚2-3格、本仓1格厚；BFS沿长辐条跳层）单列不计缺口",
              "decodedFrames": 427,
              "reviewEvidence": "artifacts/coverage/1490068909042642944-review-r125.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  426
                ],
                "nativeRevisits": [
                  0,
                  250,
                  390,
                  426
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "环带邻接图：环带分区 / 极坐标参考网 / 中心逐层搜索"
              }
            },
            {
              "id": "1459169210752507904",
              "name": "And another",
              "status": "partial",
              "where": "src/core/grid.js#unshearPatches · grid-graph.html?mode=patch&rigid=20&square=1",
              "page": "grid-graph.html",
              "note": "609帧全核（r229/r230 7张联系表 + 本轮 sheet-01/sheet-05 + 0300 原尺寸）；补丁内角偏差 p50/p90 0.00°/0.00°、拓扑未动（1519/1331/242/512）；方形档首次出运行读数（flips=8 页面参数 / scale 0.886 / roundErr 0，488-200-688 与关档逐项相同）；仍缺：补丁缝 35 格反向（根因=缝上四边格未退化成三角，需重划三角过渡带，约1-1.5轮）、cell.family 仍是换基前存根（maxSpreadDeg 42.68° 失真）、偏离三族>5° 占 5.6%",
              "decodedFrames": 609,
              "reviewEvidence": "artifacts/coverage/1459169210752507904-review-r231.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  608
                ],
                "nativeRevisits": [
                  0,
                  150,
                  200,
                  420,
                  608
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "补丁着色（三族/补丁划分/补丁缝/三角格/对角线）运行验收；补丁级刚性未做"
              }
            },
            {
              "id": "1448039167057879048",
              "name": "Imma talk about my new island generator at Swede…",
              "status": "done",
              "where": "island-stages-c09.html?mode=talk · src/terrain/island-viz-c09.js · src/core/stroke-reveal-c09.js(createLayerTimeline/roundSeed) · src/terrain/pipeline-stages.js",
              "page": "stroke-reveal.html",
              "note": "952帧全核；核实为「已实现缺验收」（第五次过期缺口标签）：r56 C09 的 island-stages-c09.html?mode=talk 六层 tent→lattice→strokes→net→contour→color 全在——帐篷层超级三角形竖棒边 29/25/24/27、共享边线网 114 笔由稀到密（墨迹 4083→32758）、逐笔线稿墨迹 395→33217 单调、createLayerTimeline 自动推进（4.4s 内 lattice→strokes）、roundSeed 每轮换岛（55447/60185/64923/69661）；walkthrough 的自动计时推进在 src/ui/walkthrough.js 的 auto() 早已有；新测 tests/island-stages-talk-browser.cjs 全通过",
              "decodedFrames": 952,
              "reviewEvidence": "artifacts/coverage/1448039167057879048-review-r108.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  951
                ],
                "nativeRevisits": [
                  1,
                  10,
                  410,
                  910
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "六层错峰计时（帐篷竖棒/顶点阵/逐笔线稿/共享边线网/等高线/着色）+ 4 轮换岛 + 自动推进"
              }
            },
            {
              "id": "1447483550257799171",
              "name": "I regret to inform you that I've relapsed into p…",
              "status": "done",
              "where": "island-build-c09.html?mode=reel · src/world/build-reel-c09.js(REEL_PRESETS.reel) · src/terrain/terrain-strokes-c09.js(surfaceSegments) · src/core/stroke-reveal-c09.js(createStrokeReveal3D) · src/world/scenes.js(buildScene 换种子)",
              "page": null,
              "note": "565帧全核；核实为「已实现缺验收」：r56 C09 的 island-build-c09.html?mode=reel + src/world/build-reel-c09.js 的 REEL_PRESETS.reel（colorFirst 先彩色岛再切黑画线、seeds 5/9/17/31 四轮各出不同岛——线段数 4513/3634/3940/2850 全不同、着色段 worldVisible 且 drawn=0、线稿段 47→3634 段逐笔累积、第 5 轮回卷到 seed 5、自动播放自己跨阶段）；新测 tests/island-build-reel-browser.cjs 全通过",
              "decodedFrames": 565,
              "reviewEvidence": "artifacts/coverage/1447483550257799171-review-r108.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  564
                ],
                "nativeRevisits": [
                  1,
                  405,
                  258,
                  273
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "连续换岛 showreel：着色岛↔黑底白线逐笔累积，4 轮 4 岛循环，自动播放"
              }
            }
          ]
        ]
      ]
    }
  ],
  "roadmap": [
    {
      "step": 0,
      "name": "统一网格：一张能同时承载地形和房子的图",
      "lane": "base",
      "why": "三个项目的分水岭都在网格：Bad North 是方格，Townscaper 是不规则四边形，第三个项目是三角+方格混合，最后上球面。先把网格抽象成\"任意多边形 + 半边结构\"，后面所有管线都只依赖这一层。",
      "study": [
        "1147881669350891521",
        "1151770831619534848",
        "1332410042784641026",
        "1458921394855718917",
        "1447496205282549761",
        "1447494168448753667"
      ],
      "reuse": [
        "src/core/grid.js · buildQuadGrid() → { cells[{pts, edgeNeighbors, cornerNeighbors}], verts, vertexCells }",
        "src/core/spatial.js · buildCellIndex() / pointInQuad()"
      ],
      "check": "两种任意多边形网格已完成；显式quad+triangle双格模板已进入融合场景。完整预制轮廓、旋转及联合WFC仍待补。",
      "status": "partial"
    },
    {
      "step": 1,
      "name": "共享体素场：地形和建筑读同一份数据",
      "lane": "base",
      "why": "Bad North 的原话：所有关卡共享一个\"虚拟体素空间\"，光照、法线、碰撞、风都从它来。地形管线和建筑管线若各存一份数据，就永远融合不了。",
      "study": [
        "931196707236392960",
        "1168571866405097472",
        "1120036868966502401"
      ],
      "reuse": [
        "src/core/world.js · World：solid / rock / color / river，isRock()、ground()、topIsBuilt()",
        "src/light/bake.js · bakeLighting()：地形和建筑一起烘焙"
      ],
      "check": "单World光照/建筑/地形保留；flow.html实际通洞/封洞验证占用、下方支撑和风场，修复按柱顶填满洞内。梯度法线目前只作诊断。",
      "status": "done"
    },
    {
      "step": 2,
      "name": "地形管线：岛 → 悬崖/软坡 → 河流 → 平滑",
      "lane": "terrain",
      "why": "先有地，才有房子的落脚点。第三个项目里地形也是 tile + WFC，河流单独深度优先坍缩，最后按边类型做层级平滑。",
      "study": [
        "1447488323845509121",
        "1769691526924292506",
        "1670720537662836736",
        "1670725072540106755",
        "1579478470098243584",
        "1769641473895432220"
      ],
      "reuse": [
        "src/terrain/generate.js · generateTerrain() / carveRivers()",
        "src/terrain/shape.js · shapeTerrain() → at(p, 切面)：层级平滑 + 笼形变形",
        "src/terrain/terrainmesh.js · buildTerrain({ shape })",
        "src/core/meshwriter.js · writer.soft：按夹角平均的软法线"
      ],
      "check": "台地、峡谷、河流、洞窟、层级平滑与形变已在平面场景运行；独立planet.html有球面/relax演示，共享World球面融合与形变碰撞仍待补。",
      "status": "partial"
    },
    {
      "step": 3,
      "name": "建筑管线：体素列 → 模块 → 支撑 → 道具 → 后院",
      "lane": "build",
      "why": "Townscaper 的全部：按邻居状态选模块。这里先用规则生成几何，后续可替换成\"角点取值查模块表\"的 WFC，以便和地形 tile 混在一起。",
      "study": [
        "1197909675443916803",
        "1189902695303458816",
        "1189908238566903808",
        "1238474550511308800",
        "1205416648397721601",
        "1279107097108635649"
      ],
      "reuse": [
        "src/build/buildings.js · TownMesh(town, grid).rebuild() → 单个合并网格 + posts",
        "learnpanel 的「去看」：拱门 / 钢架 / 后院 / 山墙"
      ],
      "check": "index.html 建筑管线里每一步都能「去看」；拖动建造时屋顶、山墙、拱、后院自动出现。",
      "status": "done"
    },
    {
      "step": 4,
      "name": "水层：浪裙 → 岸线浪 → 倒影",
      "lane": "base",
      "why": "三个项目都在迭代同一层水。它只依赖\"哪些格是陆地\"，所以天然是地形和建筑的公共层。",
      "study": [
        "1215644531221311488",
        "1664566546683899905",
        "1849732997945110651",
        "1849730611964973481",
        "1991101097818403263",
        "1758251637280268481"
      ],
      "reuse": [
        "src/water/shore.js · buildShore(town, grid, index, {posts}) → { skirt, waves, shoreLine, seaLine }",
        "src/water/shore.js · makeWaveMaterial()（循环顶点着色器）"
      ],
      "check": "index.html 勾「岸线黄/蓝线」「浪带线框」：浪从蓝线走到黄线再退回一点，海湾不折叠。",
      "status": "done"
    },
    {
      "step": 5,
      "name": "光照：分层 AO → 彩色反弹 → 时段 → 光体积 GI",
      "lane": "base",
      "why": "他每个项目都自己写光照。分层 AO 已经能同时服务地形和房子；下一步是 SDF + 光体积的多次反弹。",
      "study": [
        "1168571866405097472",
        "1237305125070426112",
        "1313840428685447170",
        "1580845127207387137",
        "1580846877855338497",
        "1791049306213912823"
      ],
      "reuse": [
        "src/build/buildings.js · #bakeLighting（建议抽成 src/lighting.js 供地形共用）",
        "src/world/view.js · setTimeOfDay(day|dusk|night)"
      ],
      "check": "index.html 开关「分层 AO」「只看光照」对比；夜晚窗户发光。",
      "status": "partial"
    },
    {
      "step": 6,
      "name": "环境与植被：草丛 → 灌木 → 团块树 → impostor → 云、风、雪、雾",
      "lane": "veg",
      "why": "\"风雪\"只在 Bad North 期出现过（风场驱动旗帜和雪花）；云在 Townscaper 和第三个项目里都有，后者和树共用 impostor。",
      "study": [
        "1590669875869286400",
        "1707490274425884929",
        "1580158269267406849",
        "1849427564034498642",
        "1852334860137849222",
        "926903893866541057",
        "943230624369868800",
        "906207980802252801",
        "1243228419162341379"
      ],
      "reuse": [
        "src/life/vegetation.js · Vegetation.refresh(world, shape)：草丛、崖边 / 墙根灌木、团块树冠，带风和墨线",
        "src/world/view.js · 光照档位（雾 / 天色可挂在这里）"
      ],
      "check": "草/花/灌木、impostor树云、风雪雾等既有成果保留；本轮修复洞内风场。树冠硬边松弛、球面植被及细节一致性继续列缺口。",
      "status": "partial"
    },
    {
      "step": 7,
      "name": "融合：房子 tile 跨格、拼进地形",
      "lane": "fusion",
      "why": "第三个项目的核心原话：\"combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)\"、\"splice houses into the terrain\"。重构版里已经做到第一步：地形生成写进同一个 World，房子用建筑管线直接长在台地上、海湾里铺码头、峡谷上架拱。",
      "study": [
        "1579483114178768898",
        "1584623053061099520",
        "1582293326815862786",
        "1751932427272909032",
        "1654401054828638214",
        "1669315384619540487"
      ],
      "reuse": [
        "src/world/scenes.js · generateFusion()",
        "src/world/worldmesh.js · WorldMesh（两条管线写同一个顶点池）",
        "src/water/shore.js（陆地格决定岸线）"
      ],
      "check": "真实融合两种网格各6个双格房屋，混合跨quad+triangle；整体移除/替换和本页撤销已验收。实例身份持久化（world.houseInstances 统一撤销栈）、多格 prefab/socket 与联合 WFC（prefab-socket.js）、指定模块 patch 事务（module-patch-commit.js：socket补网/形变碰撞/回滚）均已落地并过单测；游戏运行时仍走高度场 joint-wfc，共享网格 patch 未接。",
      "status": "partial"
    },
    {
      "step": 8,
      "name": "球面：同一套管线放到星球上",
      "lane": "fusion",
      "why": "他 2020 年就在试球面三角化，2024 年\"put this on a sphere\"。到这一步，网格要有每格的局部\"上方向\"，水是一层球壳，高山要做防蘑菇化松弛。",
      "study": [
        "1338825080844021760",
        "1338829205157646336",
        "1768627849529893109",
        "1769641473895432220",
        "1795831296952041691"
      ],
      "reuse": [
        "src/core/grid.js 的松弛（换成球面切平面上做）",
        "src/build/buildings.js（把 y 轴换成格子法线）"
      ],
      "check": "独立planet.html已存在球面房屋/relax演示；r205 已补平面World→球面接线层 world-sphere.js（bend=实景同口径/sphere 等距、柱格姿态、岸线连续 Node 验收）；r209 补球面 World 网格生成/编辑/保存恢复 sphere-world.js（真 cell 拓扑/落格编辑/save.js 风格存档，Node 验收）；原片模块视觉与游戏接入仍未迁，完整管线未接。",
      "status": "partial"
    }
  ],
  "statusName": {
    "done": "已实现",
    "partial": "部分",
    "engine": "在 engine",
    "todo": "未做"
  },
  "statusColor": {
    "done": "#3f9a5b",
    "partial": "#c99a2e",
    "engine": "#4f7fb8",
    "todo": "#a7b3b5"
  },
  "evolution": {
    "schemaVersion": 1,
    "revision": "2026-11-14-author-chronology-r3-priorities",
    "reviewBasis": "核对现有作者原文、日期、学习笔记与源码映射；本轮没有新增视频观看或实现验收。",
    "datePolicy": "按 X Snowflake 发布时间 UTC 排序，保留登记日期及冲突；不使用本地学习轮次/文件 mtime 排作者历史。",
    "dateReferences": [
      "https://docs.x.com/fundamentals/x-ids",
      "https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala"
    ],
    "projectPolicy": "next 是本地对后续未命名程序化世界实验的分组，不是已确认的正式游戏名。2016 早期实验不自动称为 Townscaper；球面不只有 2024 一个阶段。",
    "families": [
      {
        "id": "grid",
        "name": "网格：有限 → 无限 → 混合拓扑",
        "question": "怎样得到可扩展、可编辑的自然网格？",
        "scope": "平面四边网与混合网格并存；球面是另一上下文。",
        "preferred": [
          "1332410042784641026",
          "1579483114178768898"
        ],
        "recommendation": "Townscaper 平面建筑参考无限四边网；地形融合参考混合网。不能用后者自动替换前者。",
        "clips": [
          "1147881669350891521",
          "1151137783785771008",
          "1151770831619534848",
          "1332410042784641026",
          "1447496205282549761",
          "1447494168448753667",
          "1458921394855718917",
          "1471817524148940807",
          "1579483114178768898",
          "1670790425232175108",
          "1677242779162877952",
          "815236105079398400",
          "1120036868966502401",
          "1258005604066627586",
          "1301816247479345152",
          "1302686201401442309",
          "1313837640366596096",
          "1384958097542819845",
          "1490068909042642944"
        ]
      },
      {
        "id": "wfc",
        "name": "模块约束：相邻 → 多格 → 可导航",
        "question": "怎样保证 tile 拼得上，并生成可走的世界？",
        "scope": "规则、求解、形状和导航约束组合；不同项目的 tile 集不可互换。",
        "preferred": [
          "1751932427272909032",
          "1582293326815862786"
        ],
        "recommendation": "按目标选多格/网格接口，导航约束与指定模块生成是新增约束；完整 WFC 行为仍按各记录核验。",
        "clips": [
          "787319655648100352",
          "793545297376972801",
          "793806535898136576",
          "795010582239997952",
          "865200072685912064",
          "917405214638006273",
          "1163836000688365571",
          "1164926304640229376",
          "1189109278361165825",
          "1279107097108635649",
          "1579483114178768898",
          "1582293326815862786",
          "1670794261669769217",
          "1751932427272909032"
        ]
      },
      {
        "id": "terrain",
        "name": "地形：软坡硬崖 → 笼形变 → 分级平滑",
        "question": "如何既自然又保留模块边界？",
        "scope": "形变、平滑、侵蚀与河流是互补步骤。",
        "preferred": [
          "1670720537662836736",
          "1769691526924292506"
        ],
        "recommendation": "按硬边/游戏 tile 边/材质边分级平滑；河流采用后续深度优先方案时仍需核原作差距。",
        "clips": [
          "818857408848130048",
          "832633189277409280",
          "1447483550257799171",
          "1447488323845509121",
          "1448039167057879048",
          "1579474420749725696",
          "1579478470098243584",
          "1654401054828638214",
          "1669315384619540487",
          "1670720537662836736",
          "1670725072540106755",
          "1671808851895627776",
          "1769691526924292506",
          "781957658597269506",
          "906416813810049025",
          "1708815475801505819"
        ]
      },
      {
        "id": "sphere",
        "name": "球面：早期装配实验与后期世界迁移",
        "question": "平面系统放到球面后如何控制形状？",
        "scope": "2016 早期球面实验与 2024 后续世界上球分开；不能仅凭时间推断代码传承。",
        "preferred": [
          "1769641473895432220",
          "1769691526924292506"
        ],
        "recommendation": "2024 球面变体优先核山体防蘑菇形松弛与河流；原平面生成继续保留。",
        "clips": [
          "768886648625061889",
          "784848286272327680",
          "784847588893814785",
          "784847933686575104",
          "1338825080844021760",
          "1338829205157646336",
          "1768627849529893109",
          "1769641473895432220",
          "1769691526924292506",
          "1791049306213912823",
          "1795831296952041691"
        ]
      },
      {
        "id": "shore",
        "name": "岸线：网裙 → 分岔实验 → 定向循环浪",
        "question": "怎样让岸浪更有冲击感又可跨平台？",
        "scope": "2023 float 模拟是试验分支；2024/25 是几何与顶点着色方案演进。",
        "preferred": [
          "1991101097818403263"
        ],
        "recommendation": "当前循环岸浪研究首选 2025 的入向/出向/时间偏移说明；保留早期平静网裙和原作视觉差距。",
        "clips": [
          "1215642481162887168",
          "1664565063552847873",
          "1664566546683899905",
          "1666429884208381953",
          "1849730611964973481",
          "1849732997945110651",
          "1991099314714902634",
          "1991101097818403263",
          "1991103578011029507"
        ]
      },
      {
        "id": "reflection",
        "name": "倒影：翻转网格 → 彩色 → SDF 层片",
        "question": "不同水面风格如何表达倒影？",
        "scope": "翻转网格与体积层片保留为不同成本/风格路径。",
        "preferred": [
          "1758251637280268481"
        ],
        "recommendation": "需要流动体积感时核对 SDF 层片；轻量平静水面仍可用原彩色倒影。",
        "clips": [
          "1215644531221311488",
          "1758250248483278925",
          "1758251637280268481"
        ]
      },
      {
        "id": "light",
        "name": "光照：体素 AO → 彩色反弹 → 光体积",
        "question": "如何用共享空间承载多系统光照？",
        "scope": "平面 AO、光体积 GI 与球面高度光照有不同输入和成本。",
        "preferred": [
          "1580845127207387137",
          "1791049306213912823"
        ],
        "recommendation": "共享 World 看 AO 与体积光；球面看 cube-height。最新方法不自动覆盖全部光照。",
        "clips": [
          "793557992931266561",
          "931196707236392960",
          "1168168400155267072",
          "1168571866405097472",
          "1197909675443916803",
          "1237305125070426112",
          "1298689301488775169",
          "1481661852887265288",
          "1580835075629133825",
          "1580845127207387137",
          "1580846877855338497",
          "1582757294672314368",
          "1786014232594485497",
          "1791049306213912823",
          "823848950553780226",
          "929417420921556993",
          "1062374549407350790",
          "1313841094069817344"
        ]
      },
      {
        "id": "shadows",
        "name": "阴影：投影 → 半影 → 受控表面阴影",
        "question": "怎样增加层次而不破坏画风？",
        "scope": "投影和纹理表面阴影互补；改良版本按局部算法而非全模块取代。",
        "preferred": [
          "1305951750638231552",
          "1705195380457996629"
        ],
        "recommendation": "柔和投影用多次偏移半影；表面阴影采用独立投影高度与 z-test 高度的后续修正。",
        "clips": [
          "1190191289922465793",
          "1305948413872267265",
          "1305951750638231552",
          "1313840428685447170",
          "1704218784028905984",
          "1705195380457996629"
        ]
      },
      {
        "id": "lines",
        "name": "描线与纹理：法线反差 → 专用反差图",
        "question": "怎样让程序纹理服从结构边界？",
        "scope": "反差纹理、笔触边界、逆光轮廓组合；不是统一新旧版本。",
        "preferred": [
          "1482346496460828674",
          "1751945034851570056"
        ],
        "recommendation": "内线用专用反差图，逆光可组合额外反转轮廓；实际适配能力分别核验。",
        "clips": [
          "978211952504852480",
          "1017355723171344385",
          "1241046107125399552",
          "1241096929490149376",
          "1480635131614355459",
          "1482011744843223042",
          "1482346496460828674",
          "1696864977171189980",
          "1696896119794479541",
          "1703750394164199473",
          "1704246032626762189",
          "1751945034851570056",
          "1781405550061687016",
          "1427721874490933250",
          "1430227487376781317",
          "1478114309263839244",
          "1783792917183606829"
        ]
      },
      {
        "id": "plants",
        "name": "植被：锚点卡片、草丛、纹理灌木",
        "question": "哪些轮廓需要几何，哪些可以靠纹理？",
        "scope": "树叶卡片、草丛与崖边灌木是不同对象，不能按时间互相淘汰。",
        "preferred": [
          "1707490932017279035",
          "1590674061092212738"
        ],
        "recommendation": "崖边灌木可用低面数纹理带+小阴影；草丛保留卡片及反差采样。",
        "clips": [
          "959530111187013632",
          "1063115611289645057",
          "1191990107785572352",
          "1205420678859632640",
          "1241046107125399552",
          "1580158269267406849",
          "1580162341668237312",
          "1590669875869286400",
          "1590674061092212738",
          "1707490274425884929",
          "1707490932017279035",
          "1707497006640365880"
        ]
      },
      {
        "id": "atlas",
        "name": "精灵表示：动态图集 → 回收 → 八角替身",
        "question": "怎样降低绘制成本并避免转镜头露馅？",
        "scope": "图集分配和 impostor 几何是不同层，可组合使用。",
        "preferred": [
          "1849427564034498642",
          "1765041830461055127"
        ],
        "recommendation": "图集需可释放空间；树替身优先核八角方案的旋转稳定性，云复用同一表示。",
        "clips": [
          "911913981731885056",
          "1593215065423245313",
          "1764958522398146667",
          "1765041830461055127",
          "1765115069837221962",
          "1849427564034498642",
          "1852334860137849222"
        ]
      },
      {
        "id": "wind",
        "name": "共享风：旗帜 → 向量场 → 雪",
        "question": "怎样让多种效果服从同一个环境？",
        "scope": "风场是共同依赖，旗布和雪是两个消费者。",
        "preferred": [
          "931196707236392960",
          "943230624369868800"
        ],
        "recommendation": "优先共用 World/风场，再分别接旗帜与雪；不把消费者注册成互相替代。",
        "clips": [
          "926834721392340992",
          "926890207298899969",
          "926903893866541057",
          "931196707236392960",
          "943230624369868800",
          "943230620242796544",
          "906207980802252801"
        ]
      },
      {
        "id": "navigation",
        "name": "导航：网面流动 → 避堵 → 类型影响场",
        "question": "如何让单位走得通并协同战斗？",
        "scope": "导航图、流场、交通规则和战斗类型信息互补。",
        "preferred": [
          "901842167508992000",
          "880853661936734211"
        ],
        "recommendation": "复用网面流场并保留狭路交通/类型继承；可导航生成仍需单独连接。",
        "clips": [
          "797119718477991936",
          "807256278154301441",
          "810157485638189056",
          "810878197134950401",
          "816743289500106752",
          "816748103193817088",
          "880853661936734211",
          "886199305522085890",
          "901842167508992000",
          "902069261304287232",
          "902103473365417984",
          "959752525867036672",
          "972829402873716737",
          "974564862729838592",
          "974579499802202113",
          "1795831296952041691",
          "798580832906739712",
          "906425294533394432",
          "995043346778415104"
        ]
      },
      {
        "id": "building",
        "name": "建筑：模块 → 独立装饰 → 庭院 → 地形拼接",
        "question": "怎样增加复杂性而不让组合数量爆炸？",
        "scope": "建筑结构、门窗装饰和庭院规则分别管理。",
        "preferred": [
          "1205416648397721601",
          "1584623053061099520"
        ],
        "recommendation": "独立装饰放置与地形拼接按目标组合；后者不取代 Townscaper 建筑编辑。",
        "clips": [
          "1176516621223043073",
          "1178731576982724611",
          "1181464374839521280",
          "1189109278361165825",
          "1189902695303458816",
          "1189908238566903808",
          "1205416648397721601",
          "1205422438437273601",
          "1238474550511308800",
          "1246074663546916873",
          "1279107097108635649",
          "1331905048801144836",
          "1579483114178768898",
          "1584623053061099520",
          "797844857821732864",
          "802496920790777856",
          "806904557502464000"
        ]
      },
      {
        "id": "sediment",
        "name": "岩层：直线纹理 → 空间扭曲",
        "question": "怎样让层理自然又可读？",
        "scope": "纹理坐标扭曲不是改变真实地形拓扑。",
        "preferred": [
          "1699146321318314094"
        ],
        "recommendation": "需要弯曲层理时使用前后可逆空间扭曲的思路，保留原几何。",
        "clips": [
          "1699038611125985317",
          "1699146321318314094"
        ]
      },
      {
        "id": "projectiles",
        "name": "弹道：轨迹计算 → 查表与代价调节",
        "question": "怎样把抛射运动用于实际战斗？",
        "scope": "轨迹可视化、查表与碰撞/战斗接线分开验收。",
        "preferred": [
          "987267068495003648"
        ],
        "recommendation": "固定目标解与代价表是后续方向，不把扇形演示当完整战斗接入。",
        "clips": [
          "816332161036984320",
          "987267068495003648"
        ]
      },
      {
        "id": "smoke",
        "name": "烟火：爆炸反馈与两遍烟层",
        "question": "怎样让烟轮廓、深度和渐隐协调？",
        "scope": "爆炸烟团与持续烟柱是并存效果，后者不是前者替代。",
        "preferred": [
          "1015142746372366336",
          "1015151731804721152"
        ],
        "recommendation": "烟柱组合两遍深度处理、UV 滚动与沿烟迹 mip 渐变；爆炸继续独立核验。",
        "clips": [
          "837027901853810688",
          "1015140880666300416",
          "1015142746372366336",
          "1015149712469524480",
          "1015151731804721152"
        ]
      },
      {
        "id": "tools",
        "name": "工具：节点表达、批处理与存档",
        "question": "工具如何服务生成、编辑和验证？",
        "scope": "工具能力按任务并存；发布日不是算法优劣顺序。",
        "preferred": [
          "1401145625572425728",
          "1724449858369568780"
        ],
        "recommendation": "运行平台和编辑需求决定使用何种工具；无来源的工具不编造作者演进。",
        "clips": [
          "863019585162932224",
          "938395867215728640",
          "1198957499027795969",
          "1260586697538113537",
          "1344290848180203523",
          "1401145625572425728",
          "1430224300003545091",
          "1670064751181791233",
          "1724449858369568780"
        ]
      },
      {
        "id": "campaign",
        "name": "战役：岛屿图 → 分区 → 推进前线",
        "question": "怎样把独立岛屿组织成可推进的战役？",
        "scope": "关卡内 navmesh 与战役图是两层，不能混为同一导航算法。",
        "preferred": [
          "1042732450730913793",
          "1097458505315946496"
        ],
        "recommendation": "岛屿节点图、分区和前线曲线按顺序组合；前线不是图生成器的替代。",
        "clips": [
          "911913981731885056",
          "938405900573986816",
          "938422757288792064",
          "1042732450730913793",
          "1078792665980915714",
          "1097458505315946496"
        ]
      },
      {
        "id": "fire",
        "name": "火焰：Max 混合与形状修正",
        "question": "如何让多个粒子形成统一火焰轮廓？",
        "scope": "烟柱、爆炸、火焰有不同表现职责。",
        "preferred": [
          "1056992291108413446"
        ],
        "recommendation": "同日修正后的 quad 缩放优于先前错误值；Max 混合仍是共同机制。",
        "clips": [
          "1056990611738451968",
          "1056992291108413446",
          "1056999668486471682"
        ]
      },
      {
        "id": "ui-decoration",
        "name": "界面装饰：镜像纹理 → SDF → 动画",
        "question": "如何用少量纹理做可缩放装饰？",
        "scope": "图形装饰与游戏编辑器交互是不同能力。",
        "preferred": [
          "1105131621391495176"
        ],
        "recommendation": "镜像 SDF 配合边框/中心阈值与动画；本地 UI 接入单独验收。",
        "clips": [
          "1016680972610359298",
          "1024679338292256769",
          "1061221291137605633",
          "1061227418961219585",
          "1061229717582475264",
          "1104771432440049664",
          "1105131621391495176",
          "1201179450668441600",
          "1242824460325052417",
          "1277554535297236994"
        ]
      },
      {
        "id": "palette",
        "name": "配色：可调色板 → 颜色体积",
        "question": "怎样定义整个系统允许的颜色空间？",
        "scope": "色板编辑与光照反弹相关但不相同；多个工具方案并存。",
        "preferred": [
          "1712088611934371876"
        ],
        "recommendation": "颜色体积与新色板工具仍按实验对照，不能仅因日期新就自动迁移用户配色。",
        "clips": [
          "794993371261665280",
          "1200520827898343425",
          "1237293295887319040",
          "1710031224838771027",
          "1712088611934371876",
          "1714613599035863191"
        ]
      },
      {
        "id": "camera",
        "name": "镜头：混合透视与轨道运动模糊",
        "question": "镜头技术是否适合当前游戏？",
        "scope": "后发实验也可能不适合既有项目，必须保留作者否定意见。",
        "preferred": [
          "1727315611959865407"
        ],
        "recommendation": "混合透视被作者明确认为不适合 Townscaper；轨道运动模糊另行选用。",
        "clips": [
          "1310503825510367232",
          "1727315611959865407",
          "1727324352264474664"
        ]
      },
      {
        "id": "animals",
        "name": "生物与装饰：鸟、蝴蝶、路径",
        "question": "如何用少量规则营造有生命的场景？",
        "scope": "鸟和蝴蝶有不同飞行模型；路径、旗帜、电线为互补装饰。",
        "preferred": [
          "1273520600221433857",
          "1244892370392489989"
        ],
        "recommendation": "蝴蝶按潜在落点松散环绕与世界噪声；海鸥采用其独立站立/飞行/倒影规则。",
        "clips": [
          "1212732478458343424",
          "1243228419162341379",
          "1244892370392489989",
          "1258421104756097029",
          "1259838941299183619",
          "1270725616430530566",
          "1273520600221433857",
          "1275089608758484992",
          "1290997501332525056"
        ]
      },
      {
        "id": "combat",
        "name": "战斗反馈：受击、附着、血量与资产",
        "question": "怎样把动作反馈接到实际单位状态？",
        "scope": "不同战斗反馈按职责组合；不能把演示视频都当同一算法新版本。",
        "preferred": [
          "984813819280191488",
          "999185422403055616"
        ],
        "recommendation": "保留伤害/眩晕、血贴图坐标、船体附着等独立机制及接线缺口。",
        "clips": [
          "817323301357948928",
          "820977247083528192",
          "821321422140309504",
          "821680056514781186",
          "827215002448846848",
          "827216768783495168",
          "827561690896162816",
          "828984794407170048",
          "839067977781768193",
          "870296307889573889",
          "883447205176238083",
          "903647529203634176",
          "912691357440978945",
          "946660607008403456",
          "958371606350454784",
          "958410200146497537",
          "969860566322958336",
          "974325184525201409",
          "984813819280191488",
          "999185422403055616",
          "999191760944418817",
          "1010979395719319552",
          "1022573208590057472"
        ]
      },
      {
        "id": "water-effects",
        "name": "水的消费者：船尾迹与瀑布",
        "question": "如何让船和落水也参与水环境？",
        "scope": "尾迹、瀑布、岸浪是不同消费者，没有证据互相替代。",
        "preferred": [
          "901469409579061248",
          "1007587812462530561"
        ],
        "recommendation": "按场景分别选择船尾迹、瀑布，使用实际根点/碰撞约束。",
        "clips": [
          "901469409579061248",
          "1007587812462530561"
        ]
      },
      {
        "id": "hallway",
        "name": "建筑纹理：走廊设计迭代",
        "question": "同一走廊主题如何反复试验？",
        "scope": "原文仅确认继续迭代，视觉优劣与机制仍需看原片对照。",
        "preferred": [
          "1897266928961700215"
        ],
        "recommendation": "将较新走廊作为后续比较入口；不能凭一句“又一版”断言所有指标更好。",
        "clips": [
          "1890018647655272491",
          "1897266928961700215"
        ]
      },
      {
        "id": "reference",
        "name": "作品展示、发布与来源不足记录",
        "question": "哪些记录并未提出可判定的技术变化？",
        "scope": "保留发布时间与现有笔记；成品展示、发布消息、家庭设计不自动成为场景算法。",
        "preferred": [],
        "recommendation": "逐条查看原文与已有审核；缺少前后机制证据时不连升级边。",
        "clips": [
          "847717312912211970",
          "807135253215199233",
          "777501038274281472",
          "777596437534240768",
          "781027725452648448",
          "806856212260278272",
          "803190517534248960",
          "1995813566344011807",
          "1798310423554658732",
          "1671840905957978113",
          "1489193847422865410",
          "1466059785703460870",
          "1459169210752507904",
          "1410697531424714752",
          "1371460793032716290",
          "1371191380773629956",
          "1370772056279805953",
          "1257213678056857600",
          "1239901715266244609",
          "1210969316071477248",
          "1209519206233968641",
          "1195463004919357443",
          "1174406613031170049",
          "1151152046055272449",
          "1092709665199345664",
          "1022855252574437376",
          "1007587828992266240",
          "1007587825024425984",
          "1007587821220229120",
          "1007587817021636609",
          "995034777756536833",
          "984703192465330176",
          "978195201901711360",
          "978194866520944641",
          "913407568730615808",
          "877995885250138119",
          "870558914345041921",
          "890611046435627008"
        ]
      }
    ],
    "relations": [
      {
        "fromId": "1147881669350891521",
        "toId": "1151137783785771008",
        "type": "extends",
        "reason": "从有限网格的待办“铺到无限”发展到无限、确定性、松弛四边网。",
        "evidence": [
          {
            "id": "1151137783785771008",
            "field": "text",
            "value": "As promised: an aperiodic infinite deterministic irregular relaxed quadrilateral grid."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1151137783785771008",
        "toId": "1151770831619534848",
        "type": "improves",
        "reason": "松弛簇由 7 个减为 3 个，减少开始松弛前必须生成的块。",
        "evidence": [
          {
            "id": "1151770831619534848",
            "field": "text",
            "value": "I figured out how to make do with relaxation clusters of 3 instead of 7, which means I have to generate fewer unrelaxed patches before I can start relaxing, which makes it faster. Note also that the black and the white grid are *dual* to each other. This is an important concept"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1151770831619534848",
        "toId": "1332410042784641026",
        "type": "explains",
        "reason": "后文详细说明三块成簇和顶点插值的无缝机制；不是又一个独立能力。",
        "evidence": [
          {
            "id": "1332410042784641026",
            "field": "text",
            "value": "How the infinite grid is relaxed and kept seamless: The grid is made of Patches. Adjacent triplets form Clusters. Clusters and Patches are relaxed independently. Each Vert is a triangular interpolation its representation in the closest 2 Clusters and the Patch wherein it sits."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1447494168448753667",
        "toId": "1447496205282549761",
        "type": "explains",
        "reason": "同日补充说明三角/方形混合 tile 的底层是普通不规则三角图。",
        "evidence": [
          {
            "id": "1447494168448753667",
            "field": "text",
            "value": "Long time fans of the show will not be surprised to learn that this is indeed running on tile based WFC. This time around, I'm getting the best of both worlds by using a mix of triangular and square tiles. (The squares are cut along each diagonal to create 4 triangles though)"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1332410042784641026",
        "toId": "1579483114178768898",
        "type": "combines",
        "reason": "作者明确将 Townscaper 不规则网格与 Bad North 多格 tile 结合；跨项目复用。",
        "evidence": [
          {
            "id": "1579483114178768898",
            "field": "text",
            "value": "Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North). Note how one of the house tiles even cover both a square tile AND a triangular tile"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1447494168448753667",
        "toId": "1579483114178768898",
        "type": "extends",
        "reason": "混合 tile 进一步支持一座房子跨方格和三角格。",
        "evidence": [
          {
            "id": "1579483114178768898",
            "field": "text",
            "value": "Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North). Note how one of the house tiles even cover both a square tile AND a triangular tile"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1579483114178768898",
        "toId": "1670790425232175108",
        "type": "explains",
        "reason": "纯三角/六角与纯方格是对照，用于解释混合方案，不是三个替代版本。",
        "evidence": [
          {
            "id": "1670790425232175108",
            "field": "text",
            "value": "I'm prepping for a talk in Cambridge next week, thus all the gifs. I made my generator also output pure triangle/hex and square grids, to illustrate why I'm going for my mixed approach."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "787319655648100352",
        "toId": "793545297376972801",
        "type": "extends",
        "reason": "三维 tile 放置增加多格模块和体素 AO。",
        "evidence": [
          {
            "id": "793545297376972801",
            "field": "text",
            "value": "I got multi tiles and voxel AO working. Would you play a game that takes place on a building like this? Maybe if it was infinitely tall?"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "793545297376972801",
        "toId": "1579483114178768898",
        "type": "combines",
        "reason": "Bad North 的多格 tile 与后来的不规则网格结合。",
        "evidence": [
          {
            "id": "1579483114178768898",
            "field": "text",
            "value": "Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North). Note how one of the house tiles even cover both a square tile AND a triangular tile"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1163836000688365571",
        "toId": "1164926304640229376",
        "type": "extends",
        "reason": "从网格上的 marching cubes 推进到交互速度 WFC；确定性在当时仍是下一步。",
        "evidence": [
          {
            "id": "1164926304640229376",
            "field": "text",
            "value": "WFC running at interactive speed on that funky grid. Next up is to make it deterministic"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1189109278361165825",
        "toId": "1279107097108635649",
        "type": "extends",
        "reason": "作者公布的模块集从 378 增至 545；本地规则生成器不等于已复制全部原版资产。",
        "evidence": [
          {
            "id": "1279107097108635649",
            "field": "text",
            "value": "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "917405214638006273",
        "toId": "1582293326815862786",
        "type": "revisits",
        "reason": "不同项目再次处理可导航生成，后文在坍缩前沿评价与扩展简化导航图。",
        "evidence": [
          {
            "id": "1582293326815862786",
            "field": "text",
            "value": "I thought it would be too expensive to properly evaluate each tile placement. But! While the number of possible tiles is indeed very large, it is actually quite small around the collapsed edge! Thus, my algorithm now tries to expand (and interconnect) a simplified nav graph."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1670794261669769217",
        "toId": "1751932427272909032",
        "type": "improves",
        "reason": "由稀有模块难出现，发展为先生成所需局部网格来强制指定模块出现。",
        "evidence": [
          {
            "id": "1751932427272909032",
            "field": "text",
            "value": "I can now force specific modules to appear. To do this I first generate the specific bit of grid they need. A large module like this would be highly unlikely to appear by chance on a random grid."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "818857408848130048",
        "toId": "832633189277409280",
        "type": "extends",
        "reason": "既有逐帧记录指出同工具新增投影，软地形与硬建筑需分层混合。",
        "evidence": [
          {
            "id": "832633189277409280",
            "field": "note",
            "value": "192帧全核（2张联系表+3张原尺寸）；同一工具的带投影录屏，确认地形走等值面、房子是独立硬边几何；【r56 C04 已补 + 本轮核账收口】'地形圆角+建筑硬棱'分层混合在 field-surface-c04.js：layeredPlan 把房子挡在占位场外、housesAt 与地形同一区块时窗缩没/抬升/重长、houseTriangles 出人字屋顶/烟囱/门洞硬边几何，field-surface-3d.html「房子硬边分层」可切回熔化对照，碎块投影/变暗/带状水线/镜像倒影同页在位；本轮新增 houseSupport 足印着座检查，实测修两栋房（A 细柱顶房悬空 1.25 格、B 靠塔房被塔缘埋 1.5 格），新测 tests/field-surface-layered.mjs 6 项（静止态体素一致/闭合/确定性/硬边-圆角对比/着座/时窗同步）PASS，判为 done；残差=原工具精确形态与参数不可知，属已声明近似"
          }
        ],
        "basis": "existing-review"
      },
      {
        "fromId": "1447483550257799171",
        "toId": "1447488323845509121",
        "type": "explains",
        "reason": "说明新岛屿生成器的目标：连续软坡、清晰硬崖和无局部低点地形。",
        "evidence": [
          {
            "id": "1447488323845509121",
            "field": "text",
            "value": "I'm able to do a couple of things here I've always wanted to, but never been able to before: - Properly combine seamless soft slopes with distinct sharp cliffs. - Erosion valid terrain with no local minimums. - Get the best of both square tiles and triangular tiles"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1447488323845509121",
        "toId": "1579478470098243584",
        "type": "revisits",
        "reason": "再次生成岛屿时用单元笼形变改善崖体有机轮廓；并非整个生成器替代证明。",
        "evidence": [
          {
            "id": "1579478470098243584",
            "field": "text",
            "value": "To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1670720537662836736",
        "toId": "1670725072540106755",
        "type": "explains",
        "reason": "同日对照无平滑、普通平滑、分级平滑，解释为何要保护输入 tile 意图。",
        "evidence": [
          {
            "id": "1670725072540106755",
            "field": "text",
            "value": "Here's a comparison showing no-, dumb- and hierarchical smoothing. The hierarchical smoothing helps preserve the intent of the input-tiles while smoothing out the jankyness from the weird underlying grid and from the limited slope angles in the input tileset"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1338825080844021760",
        "toId": "1338829205157646336",
        "type": "explains",
        "reason": "解释立体投影上做球面三角剖分；作者尚不确定用途。",
        "evidence": [
          {
            "id": "1338829205157646336",
            "field": "text",
            "value": "Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection. (Many people have done this before me, so it's nothing new). My points are sorted vertically, which means radially, which makes the algorithm faster. Here's what it looks like:"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1579483114178768898",
        "toId": "1768627849529893109",
        "type": "revisits",
        "reason": "后续项目从地形/建筑融合走到球面；是跨阶段梳理，原帖未逐模块说明迁移。",
        "evidence": [
          {
            "id": "1768627849529893109",
            "field": "text",
            "value": "For reasons I will not be explaining at this point I've gone and put this on a sphere"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1768627849529893109",
        "toId": "1769641473895432220",
        "type": "improves",
        "reason": "球面高山容易横向膨大，增加保持模块宽度的松弛步骤。",
        "evidence": [
          {
            "id": "1769641473895432220",
            "field": "text",
            "value": "In cute tile based planets like this you often get a \"mushrooming\" issue where tall mountains get weirdly wide. I managed to mitigate this by a relax pass where all module-containing cells try to achieve their desired shape and size. Note the cells on the top left contracting."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1215642481162887168",
        "toId": "1664566546683899905",
        "type": "reuses",
        "reason": "作者说明网裙方案与 Townscaper/Bad North 很相似，但希望更有冲击的浪。",
        "evidence": [
          {
            "id": "1664566546683899905",
            "field": "text",
            "value": "Here's a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters I guess... But I would like something with a bit more punch this time. A bit more crashing waves."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1664565063552847873",
        "toId": "1666429884208381953",
        "type": "alternative",
        "reason": "浮点模拟担忧跨平台/反馈 CPU；几天后决定暂用旧岸线方案的改进版，不将模拟判为优选。",
        "evidence": [
          {
            "id": "1666429884208381953",
            "field": "text",
            "value": "I've been banging my head against various shore line rendering options for a good week now. Gonna stick with this for now I think, which is basically just a refined version of what I did for Bad North and Townscaper."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1664566546683899905",
        "toId": "1666429884208381953",
        "type": "improves",
        "reason": "在多种岸线方案中回到精炼旧方法。",
        "evidence": [
          {
            "id": "1666429884208381953",
            "field": "text",
            "value": "I've been banging my head against various shore line rendering options for a good week now. Gonna stick with this for now I think, which is basically just a refined version of what I did for Bad North and Townscaper."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1666429884208381953",
        "toId": "1849730611964973481",
        "type": "revisits",
        "reason": "作者再次尝试岸浪，称为目前最喜欢的版本；仍需区分本地实现程度。",
        "evidence": [
          {
            "id": "1849730611964973481",
            "field": "text",
            "value": "Shoreline waves! This is something I've tackled many times. Although this one is very subtle, it's my favorite thus far. Instead of trying to make the waves roll in and out inside one shader pass, I'm creating loads of overlapping waves that each go through their own cycle"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1849730611964973481",
        "toId": "1849732997945110651",
        "type": "explains",
        "reason": "同日解释黄岸线与外推平滑蓝线之间的波浪运动。",
        "evidence": [
          {
            "id": "1849732997945110651",
            "field": "text",
            "value": "Here, the shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in blue. The waves travel from the blue line to the yellow (and back a little). There is also a global water mask texture that adds extra foam around rocks and stuff."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1849730611964973481",
        "toId": "1991099314714902634",
        "type": "revisits",
        "reason": "2025 再次发布新岸浪；仅凭这条文字不声称所有旧水层已被淘汰。",
        "evidence": [
          {
            "id": "1991099314714902634",
            "field": "text",
            "value": "Got some pretty sweet new shore waves going"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1991099314714902634",
        "toId": "1991101097818403263",
        "type": "explains",
        "reason": "解释同批新岸浪：生成时烘焙入向、出向与时间偏移，由循环顶点 shader 执行。",
        "evidence": [
          {
            "id": "1991101097818403263",
            "field": "text",
            "value": "It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1991101097818403263",
        "toId": "1991103578011029507",
        "type": "explains",
        "reason": "同批描述动态海洋而不过度分散注意力的设计目的。",
        "evidence": [
          {
            "id": "1991103578011029507",
            "field": "text",
            "value": "I think it gives a pretty good sense of a dynamic ocean without being too distractive"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1215644531221311488",
        "toId": "1758251637280268481",
        "type": "alternative",
        "reason": "作者明确对比旧翻转网格与 SDF 平面叠层，后者流动感更强；不等于所有上下文都更划算。",
        "evidence": [
          {
            "id": "1758251637280268481",
            "field": "text",
            "value": "It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe than the basic flipped mesh approach in Bad North and Townscaper"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1758250248483278925",
        "toId": "1758251637280268481",
        "type": "explains",
        "reason": "同日解释新倒影的平面叠层/SDF 机制。",
        "evidence": [
          {
            "id": "1758251637280268481",
            "field": "text",
            "value": "It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe than the basic flipped mesh approach in Bad North and Townscaper"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "793557992931266561",
        "toId": "1168168400155267072",
        "type": "adapts",
        "reason": "不规则网格不是真正体素，作者明确需要改造其惯用体素 AO。",
        "evidence": [
          {
            "id": "1168168400155267072",
            "field": "text",
            "value": "Got some very basic lighting in there. Since this ain't proper voxels I had to do a new take on my usual voxel based AO approach"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1168168400155267072",
        "toId": "1168571866405097472",
        "type": "explains",
        "reason": "分层网格遮蔽重投影成纹理，模糊后在顶点 shader 采样。",
        "evidence": [
          {
            "id": "1168571866405097472",
            "field": "text",
            "value": "A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture is then blurred, and sampled in the vertex shader of whatever needs lighting."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1197909675443916803",
        "toId": "1237305125070426112",
        "type": "extends",
        "reason": "增加白色色板后更容易展示已有彩色反弹光；不是替换烘焙算法。",
        "evidence": [
          {
            "id": "1237305125070426112",
            "field": "text",
            "value": "Obviously, a big benefit of this is that with white finally in my palette, I can properly show off the colored \"bounce\" \"light\" of my custom realtime \"lighting\" system."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1237305125070426112",
        "toId": "1580835075629133825",
        "type": "improves",
        "reason": "作者将之前 ad hoc 色溢与首次较真实的反弹实现明确区分。",
        "evidence": [
          {
            "id": "1580835075629133825",
            "field": "text",
            "value": "I always write my own lighting solutions. I've had some really naive ad hoc color bleeding in my (very fake) GI before, but this is my first decent attempt to actually have the light *bounce*"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1580835075629133825",
        "toId": "1580845127207387137",
        "type": "explains",
        "reason": "说明 SDF 的 UV 引用、mega texture 与六向光体积。",
        "evidence": [
          {
            "id": "1580845127207387137",
            "field": "text",
            "value": "1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in the mega texture! 2nd is a baked 6 directional light volume, raycast against the sdf, sampling the mega texture using the UVs where it hits the sdf. 3rd is the lit mega texture"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1580845127207387137",
        "toId": "1580846877855338497",
        "type": "explains",
        "reason": "展示纹理与光体积反复交互，约第三次反弹后视觉变化不明显。",
        "evidence": [
          {
            "id": "1580846877855338497",
            "field": "text",
            "value": "Here's the slowed down bounce sequence. You can see how the mega texture and the light volume affect each other back and forth. After about the 3rd bounce, further bounces are not noticeable."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1580845127207387137",
        "toId": "1582757294672314368",
        "type": "extends",
        "reason": "尝试把同一光体积用于点光；低分辨率和移动伪影仍需保留。",
        "evidence": [
          {
            "id": "1582757294672314368",
            "field": "text",
            "value": "I'm seeing if my light volume approach can work with point lights too. The low resolution is noticeable for sure. Especially when you move em around like this. But if you keep em big and soft and somewhat still I think it's gonna be good."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1305948413872267265",
        "toId": "1305951750638231552",
        "type": "improves",
        "reason": "三次不同偏移/体素大小投影软化阴影。",
        "evidence": [
          {
            "id": "1305951750638231552",
            "field": "text",
            "value": "To soften it up a bit, I'm trying out a penumbra approach where I draw the shadow thrice, once normal, once pulled in slightly and once with big voxels. I think I like it. (here, the shadow is shown darker than it should be to demonstrate the effect)"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1305951750638231552",
        "toId": "1313840428685447170",
        "type": "extends",
        "reason": "随后提供可控制太阳光与阴影的 gizmo。",
        "evidence": [
          {
            "id": "1313840428685447170",
            "field": "text",
            "value": "I added some sunlight (with shadows) and a gizmo to control it"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1704218784028905984",
        "toId": "1705195380457996629",
        "type": "supersedes",
        "reason": "在同一纹理表面阴影分支，后者修正前版过强立体感：分离投影高度与深度测试高度，只保留草崖/屋檐阴影。",
        "evidence": [
          {
            "id": "1705195380457996629",
            "field": "text",
            "value": "I tamed the texture based surface shadows a bit, so the shadow casting height is independent of the z test height. Now I only get shadows over grass-cliff edges and under roofs. It has some artifacts across UV borders, but it's quite subtle so I might not actually have to fix it."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1482011744843223042",
        "toId": "1482346496460828674",
        "type": "supersedes",
        "reason": "内线分支由程序法线的反差改为专用反差纹理，给作者更可控的线条。",
        "evidence": [
          {
            "id": "1482346496460828674",
            "field": "text",
            "value": "I created a dedicated contrast texture system for the lines: an iterative simulation on the triangles that starts random and then tries to make contrasted edges different, and non-contrasted edges similar. A byproduct is a beautiful color gradient that help express connectivity"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1482346496460828674",
        "toId": "1590674061092212738",
        "type": "reuses",
        "reason": "草在根部和背景采样已有反差纹理来控制轮廓强度。",
        "evidence": [
          {
            "id": "1590674061092212738",
            "field": "text",
            "value": "In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the background. The outline strength is determined by the difference between these two samples! Not perfect, but pretty good! Not too jittery when turning the camera"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1480635131614355459",
        "toId": "1696864977171189980",
        "type": "revisits",
        "reason": "后期重构允许更大的笔触，同时阻止越过重要边界；具体替代代码仍需比较。",
        "evidence": [
          {
            "id": "1696864977171189980",
            "field": "text",
            "value": "I'm slowly emerging from a huge refactoring... While this here is not exactly the look I'm going for, it's showing off a big improvement to the texturing. I'm now able to draw with much bigger blotches without the blotches bleeding across and messing up important edges."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1580158269267406849",
        "toId": "1580162341668237312",
        "type": "explains",
        "reason": "同日解释球体 Marching Cubes 叶团与沿分界硬边的松弛。",
        "evidence": [
          {
            "id": "1580162341668237312",
            "field": "text",
            "value": "I start with a very basic Marching Cubes mesh from a bunch of spheres. I mark the edges between triangles that are closest to different spheres. Then I run an iterative relax algorithm where those hard edges are like rubber bands, and the rest is sort of a like a balloon."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1590669875869286400",
        "toId": "1590674061092212738",
        "type": "extends",
        "reason": "草丛卡片增加根部/背景反差采样控制描线。",
        "evidence": [
          {
            "id": "1590674061092212738",
            "field": "text",
            "value": "In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the background. The outline strength is determined by the difference between these two samples! Not perfect, but pretty good! Not too jittery when turning the camera"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1707490274425884929",
        "toId": "1707490932017279035",
        "type": "explains",
        "reason": "作者强调崖边灌木是低面网格上的纯纹理，并不确定还需不需要 billboard 体积。",
        "evidence": [
          {
            "id": "1707490932017279035",
            "field": "text",
            "value": "They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1593215065423245313",
        "toId": "1764958522398146667",
        "type": "revisits",
        "reason": "后续再次研究矩形打包；没有证据证明其完全替换早期动态图集。",
        "evidence": [
          {
            "id": "1764958522398146667",
            "field": "text",
            "value": "A cute binary tree rect packer. Generating the placement attempts is kinda brute force (to get into all the nooks and crannies), but then it's using the tree properly for fast collision checks. I think this is the first time I've actually written a proper space partion tree. Fun."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1764958522398146667",
        "toId": "1765041830461055127",
        "type": "extends",
        "reason": "二叉树矩形分配加入移除，仍明确存在碎片化问题。",
        "evidence": [
          {
            "id": "1765041830461055127",
            "field": "text",
            "value": "Now supports removing rects too! The bin space gets quite fragmented after a while though.. I've tried to optimize it on the fly but I can't figure out how to when it get sort of interlocked. Still packs tight though!"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1765041830461055127",
        "toId": "1765115069837221962",
        "type": "explains",
        "reason": "同日递归树访问可视化，解释碎片化时的搜索过程。",
        "evidence": [
          {
            "id": "1765115069837221962",
            "field": "text",
            "value": "Here, I'm visualizing the recursive tree parsing as it adds new rects. Note that when the board is more fragmented the arm tends to have more fingers."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1593215065423245313",
        "toId": "1849427564034498642",
        "type": "revisits",
        "reason": "动态图集用于替身后，树的八角几何进一步改善旋转稳定性；分配器与表示不混为一项。",
        "evidence": [
          {
            "id": "1849427564034498642",
            "field": "text",
            "value": "Made some octagonal impostors for these trees. Might seem like overkill for such a stylized look, but they're a lot more stable when rotating the camera than all other billboard solutions I've tried, which is kinda important."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1849427564034498642",
        "toId": "1852334860137849222",
        "type": "reuses",
        "reason": "云 shader 明确复用树的同一 impostor。",
        "evidence": [
          {
            "id": "1852334860137849222",
            "field": "text",
            "value": "A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obvious."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "926834721392340992",
        "toId": "926890207298899969",
        "type": "explains",
        "reason": "旗帜用虚拟风粒子上的 Bezier 曲线生成网格。",
        "evidence": [
          {
            "id": "926890207298899969",
            "field": "text",
            "value": "Not really. I build a custom mesh for the flag using a bezier curve along virtual wind particles"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "926834721392340992",
        "toId": "926903893866541057",
        "type": "explains",
        "reason": "同批说明向量可供多个系统和 shader 使用。",
        "evidence": [
          {
            "id": "926903893866541057",
            "field": "text",
            "value": "Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "926903893866541057",
        "toId": "943230624369868800",
        "type": "reuses",
        "reason": "雪明确受已有风场影响并绕岛流动。",
        "evidence": [
          {
            "id": "943230624369868800",
            "field": "text",
            "value": "And yeah, obviously the snow flakes are affected by the wind system and thus flow around the island"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "797119718477991936",
        "toId": "816748103193817088",
        "type": "revisits",
        "reason": "基础导航后说明直接在 navmesh 上流动；不能从短回复推断全部实现已替换。",
        "evidence": [
          {
            "id": "816748103193817088",
            "field": "text",
            "value": "I am flowing right on the nav mesh, so it depends"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "816748103193817088",
        "toId": "880853661936734211",
        "type": "extends",
        "reason": "通过靠左通行修复狭路相遇阻塞。",
        "evidence": [
          {
            "id": "880853661936734211",
            "field": "text",
            "value": "Units got stuck when meeting in narrow passages. I fixed it by introducing left handed traffic. Never felt so clever."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "816748103193817088",
        "toId": "901842167508992000",
        "type": "extends",
        "reason": "距离/方向场增加最近单位的类型信息，服务战斗判断。",
        "evidence": [
          {
            "id": "901842167508992000",
            "field": "text",
            "value": "Made my flow/influence fields even smarter: In addition to distance and direction to nearest unit, it can now tell you what type they are"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "901842167508992000",
        "toId": "902069261304287232",
        "type": "explains",
        "reason": "下一天展示同一流场/距离/影响场的信息继承。",
        "evidence": [
          {
            "id": "902069261304287232",
            "field": "text",
            "value": "Just for fun: visualization of data inheritance in my flow/distance/influence fields"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1181464374839521280",
        "toId": "1205416648397721601",
        "type": "improves",
        "reason": "门窗装饰由独立小 WFC 后续发展为尽量多且不重叠的 prop 放置，减少歪斜格上的门窗变形。",
        "evidence": [
          {
            "id": "1205416648397721601",
            "field": "text",
            "value": "New prop placement system! It tries to place as many props as it can without overlap. I use it for doors and windows too, which means they are no longer skewed when placed on skewed tiles, which means skewed tiles now look less awkward."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1178731576982724611",
        "toId": "1238474550511308800",
        "type": "extends",
        "reason": "草坪之后增加围合区域生成后院规则。",
        "evidence": [
          {
            "id": "1238474550511308800",
            "field": "text",
            "value": "I needed some more greenery, so now if you build an enclosed area it becomes a backyard!"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1205416648397721601",
        "toId": "1246074663546916873",
        "type": "extends",
        "reason": "同类道具增加出现和消失动画。",
        "evidence": [
          {
            "id": "1246074663546916873",
            "field": "text",
            "value": "The props now animate when they appear and disappear. This was much trickier than I anticipated."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1579483114178768898",
        "toId": "1584623053061099520",
        "type": "extends",
        "reason": "跨格房屋 tile 之后研究把房子直接拼入地形。",
        "evidence": [
          {
            "id": "1584623053061099520",
            "field": "text",
            "value": "I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful insert them at will too. You can kinda see the structure of my mesh system and mesh algoritms by how the yellow lines are rotating around the verts."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1699038611125985317",
        "toId": "1699146321318314094",
        "type": "improves",
        "reason": "同日从线性层理推进到先扭曲空间、做纹理计算、再反扭曲，获得弯曲层线。",
        "evidence": [
          {
            "id": "1699146321318314094",
            "field": "text",
            "value": "Oh! And now I finally figured out how to make non-straight sedimentary lines! Most of the texturing math is kinda linear, so I though the lines had to be linear too. But I could (obviously) just make the whole world wobbly, do the texturing math, then simply undo the wobble."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "816332161036984320",
        "toId": "987267068495003648",
        "type": "revisits",
        "reason": "早期轨迹计算工具之后，作者展示弹道查表代价函数实时调节；不能只做轨迹线就宣称后者完成。",
        "evidence": [
          {
            "id": "987267068495003648",
            "field": "text",
            "value": "Using inspector expressions, I can live tweak the cost function of my projectile trajectory lookup tables. Very handy."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1015140880666300416",
        "toId": "1015142746372366336",
        "type": "explains",
        "reason": "用两遍黑/亮绘制处理 z-depth 与绘制顺序。",
        "evidence": [
          {
            "id": "1015142746372366336",
            "field": "text",
            "value": "I solve the problems of z-depth and draw order by drawing the effect in 2 passes. The first pass is black, and and has a full alpha ner the base. The second pass is lighter, more transparent towards the base, and has its cutoff pulled in 1 pixel (creating the crisp outline)"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1015140880666300416",
        "toId": "1015149712469524480",
        "type": "explains",
        "reason": "沿烟流随机正反滚动 UV，降低重复感。",
        "evidence": [
          {
            "id": "1015149712469524480",
            "field": "text",
            "value": "I only sample my noise texture once per quad, but I scroll the UVs randomly forward or backward along the flow of the smoke. This further breaks up the recognizability of individual blobs and it creates some of that cool multi layered flow feeling thick smoke should have"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1015140880666300416",
        "toId": "1015151731804721152",
        "type": "explains",
        "reason": "沿烟迹改变 noise mip，使底部清晰、末端模糊。",
        "evidence": [
          {
            "id": "1015151731804721152",
            "field": "text",
            "value": "I change the mip level of the noise texture throughout the smoke trail. This aids the transition from crisp at the base to blurry a the tip"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "938395867215728640",
        "toId": "1724449858369568780",
        "type": "revisits",
        "reason": "几年后用 UI 响应链再次示例节点式编程；没有原文证明是同一节点引擎版本。",
        "evidence": [
          {
            "id": "1724449858369568780",
            "field": "text",
            "value": "Ok, here's a small example. The button toggles a ScriptableObject bool. The FloatSelectNode component listens to that ScriptableObject, and then a series of node-like components end up moving a piece of UI"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "938405900573986816",
        "toId": "938422757288792064",
        "type": "explains",
        "reason": "同日说明分区采用相邻节点吞并的类细胞自动机。",
        "evidence": [
          {
            "id": "938422757288792064",
            "field": "text",
            "value": "I'm extra happy with how the grouping turned out. It's a sort of cellular automaton where nodes get eaten by the neighbor group to which they are most connected. Here's a slowmo to illustrate:"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "938405900573986816",
        "toId": "1042732450730913793",
        "type": "extends",
        "reason": "后续列出最终采用的图生成步骤，包括大小节点、裁边、多次随机游走。",
        "evidence": [
          {
            "id": "1042732450730913793",
            "field": "text",
            "value": "The graph generator I ended up using for the Bad North campaign maps: 1. Create nodes of varying sizes and spread them out 2. Cull nodes outside bounds 3. Do a random walk from start to finish 4. Do some more random walks 5. Pick some more random nodes"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1042732450730913793",
        "toId": "1097458505315946496",
        "type": "extends",
        "reason": "在战役图上增加三角边行走、Bezier 采样和两侧区域三角化的推进前线。",
        "evidence": [
          {
            "id": "1097458505315946496",
            "field": "text",
            "value": "The Viking frontier in @BadNorthGame is dripping with funky math: 1. Triangulate (with some added padding) 2. Walk on triangle edges along each frontier step 3. Bezier sample 4. Tessellate the fields on either side using the bezier and the triangulation"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1056990611738451968",
        "toId": "1056992291108413446",
        "type": "supersedes",
        "reason": "作者指出前版 quad 缩得过多，并给出修正版本；只替代该错误缩放，不淘汰 Max 混合。",
        "evidence": [
          {
            "id": "1056992291108413446",
            "field": "text",
            "value": "Oh no! I made an error! The quads above shrink way more than they are supposed to. This looks much better and breaks up the flame in a much more interesting way:"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1056992291108413446",
        "toId": "1056999668486471682",
        "type": "explains",
        "reason": "展示 Max 混合在白天仍能保持可读效果。",
        "evidence": [
          {
            "id": "1056999668486471682",
            "field": "text",
            "value": "Works well in daylight too, largely thanks to the max blend"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1061221291137605633",
        "toId": "1061227418961219585",
        "type": "explains",
        "reason": "说明过度拉伸会暴露纹理重复。",
        "evidence": [
          {
            "id": "1061227418961219585",
            "field": "text",
            "value": "Obviously, if you stretch it too far, you will start to notice the repetition"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1061227418961219585",
        "toId": "1061229717582475264",
        "type": "improves",
        "reason": "使用同一纹理的多组不同参数打散重复感。",
        "evidence": [
          {
            "id": "1061229717582475264",
            "field": "text",
            "value": "But you can break up that repetition by using a few different ones with different settings (all still using the same texture)"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1061221291137605633",
        "toId": "1104771432440049664",
        "type": "extends",
        "reason": "镜像纹理装饰后续采用可分别调节边框/中心阈值的 SDF。",
        "evidence": [
          {
            "id": "1104771432440049664",
            "field": "text",
            "value": "Squiggly distance fields on mirrored UVs for fast and easy UI decorations. Distance field cutoff can be tweaked separately for borders and center. All one texture, just flipped around a bit. At the start of making @BadNorthGame , UI decoration was a pain, it is now a delight."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1104771432440049664",
        "toId": "1105131621391495176",
        "type": "extends",
        "reason": "次日为同类 SDF 装饰加入动画，仍明确制作成本较高。",
        "evidence": [
          {
            "id": "1105131621391495176",
            "field": "text",
            "value": "Squiggly distance fields, now with animation! Versatile, flexible, but quite laborious"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1200520827898343425",
        "toId": "1237293295887319040",
        "type": "extends",
        "reason": "从可调色板后端到扩充颜色；作者发现组合数量并未如担心般失控。",
        "evidence": [
          {
            "id": "1237293295887319040",
            "field": "text",
            "value": "More colors! I had been assuming the combinatorics would go crazy and that all my assumptions would break if I introduced more colors, but I was wrong and it was fine."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1710031224838771027",
        "toId": "1712088611934371876",
        "type": "alternative",
        "reason": "从颜色可能性空间工具到另一种色板工具尝试，原文没有宣布前者废弃。",
        "evidence": [
          {
            "id": "1712088611934371876",
            "field": "text",
            "value": "Another take on a palette authoring tool"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1727315611959865407",
        "toId": "1727324352264474664",
        "type": "explains",
        "reason": "同日继续观察新增效果，不构造新的独立算法版本。",
        "evidence": [
          {
            "id": "1727324352264474664",
            "field": "text",
            "value": "Yeah that actually looks pretty good. I did not expect that."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1270725616430530566",
        "toId": "1273520600221433857",
        "type": "explains",
        "reason": "发布蝴蝶后解释落点切换、松散环绕和世界空间噪声，并明确不同于鸟。",
        "evidence": [
          {
            "id": "1273520600221433857",
            "field": "text",
            "value": "Butterflies fly quite different from birds. Mine loosely orbit a potential landing spot, and drift by randomly switching that spot. Additional world space noise adds variability but also coherence (without boiding) (as always, please wishlist: https:// store.steampowered.com/app/1291340/To wnscaper/ … )"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "958371606350454784",
        "toId": "958410200146497537",
        "type": "reuses",
        "reason": "肖像组合方法同时用于游戏内旗帜，明确跨对象复用。",
        "evidence": [
          {
            "id": "958410200146497537",
            "field": "text",
            "value": "The approach is versatile enough that I can use it for the ingame banners too"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "999185422403055616",
        "toId": "999191760944418817",
        "type": "explains",
        "reason": "同日从血迹 UV 机制转到可关闭血腥效果及环境叙事目的，两者不是重复算法。",
        "evidence": [
          {
            "id": "999191760944418817",
            "field": "text",
            "value": "Adding the option of disabling gore made me realized just how much I rely on blood for environmental storytelling. I should probably start asking some questions about what kind of person I am and what kind of art I put into this world."
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "1890018647655272491",
        "toId": "1897266928961700215",
        "type": "revisits",
        "reason": "同一走廊设计主题再次迭代；原文不足以确认具体替代机制。",
        "evidence": [
          {
            "id": "1897266928961700215",
            "field": "text",
            "value": "Yet another hallway design"
          }
        ],
        "basis": "author-text"
      },
      {
        "fromId": "929417420921556993",
        "toId": "1062374549407350790",
        "type": "reuses",
        "reason": "后续用体素法线进一步平滑岛形，打破网格感；不是替换全部地形算法。",
        "evidence": [
          {
            "id": "1062374549407350790",
            "field": "text",
            "value": "To make Bad North even prettier, I'm adding some extra smoothing to the island using my voxel normals. It helps break up the grid and make it all look a wee bit more natural. (also, go wishlist @BadNorthGame on Steam: https:// store.steampowered.com/app/688420/Bad _North/ … )"
          }
        ],
        "basis": "author-text"
      }
    ],
    "completionReviews": {
      "883447205176238083": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/squad-footprint.js · squad-footprint.html",
          "note": "654帧全核（7张联系表+4张原尺寸）；选中队伍脚下的占位线网=凸包轮廓+中心辐条+角上小方块，旗顶悬空白菱形、+12飘字、箭矢细白线；新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线；【卡点·D 需接主管线】新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "837027901853810688": {
        "priority": "低",
        "workType": "校准与证据补全",
        "reason": "火光探针已接通，烟、火光、地面斑的联合曲线 13/13 通过；只剩爆燃三层高度在曲线上测不到，属于表现细节，不阻塞其他组合。",
        "nextAction": "为爆燃三层高度找一个可量的读数（逐层高度或分层亮度）；量不出就按来源不足记录，不再反复重测。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "爆燃三层高度在联合曲线上测不到",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle-c01.js#fireGlow · tests/stain-joint-curve-browser.cjs · src/badnorth/ground-stain.js",
          "note": "514帧全核（sheet-00）+ 本轮接通火光探针：battle-c01#fireGlow 末尾暴露 fireStats（只读 glows，不改渲染），stain-joint 联合曲线 13/13（火光 max 2.993、火光 0s 起而地面 0.017s 起，时差≤0.02s 同帧）；回归 battle-c01 PASS / ground-stain 12/12；仅剩爆燃三层高度在曲线上测不到"
        },
        "basis": "2026-11-16 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "816743289500106752": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "单位能单独寻路仍不足以形成完整队伍能力，跨层队形直接影响战斗组合。",
        "nextAction": "补沿路径定距列队、跨台阶单列通行、到达后多排落位；与已有单兵导航分开测试。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js · unit-ground-height.js（无队列层）",
          "note": "431帧全核；石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到达集结落位，均未实现；【卡点·A 机制未做】石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "816332161036984320": {
        "priority": "中",
        "workType": "核对后续交付",
        "reason": "部分旧待办已有后续代码，先对账可避免重写；原版第三参数不凭猜测补。",
        "nextAction": "先对照现有 trajectory-trace / trajectory-preview 的碰撞和阻力实现，剩余聚焦查表/战斗接线与无法读出的参数。",
        "acceptance": "实际 World 碰撞截断与已实现阻力模式回归；未知参数单列来源缺口，真实战斗另外验证。",
        "sourceGap": "缺场景碰撞截断、二次阻力档、Inspector第三参数读不到",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/trajectory-fan.js · trajectory-fan.html",
          "note": "177帧全核；判出Unity「Trajectory Calculator」：同一Speed/Drag按整排角度画带阻力弹道+等弧长白色方向划线（实测划线等距42–43px）。新建trajectory-fan.js/html：线性阻尼解析解+等弧长切线采样，Drag 0→2射程5.91→2.38单位、划线188→88；缺场景碰撞截断、二次阻力档、Inspector第三参数读不到；【卡点·A 机制未做】缺场景碰撞截断、二次阻力档、Inspector第三参数读不到 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "810157485638189056": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/route-preview.js · path-samples.js（均无页面入口对应此视图）",
          "note": "510帧全核；俯视调试视图：棕色三角化块体+沿可行走区密集采样(1–2px点距)的路线点串+三轴gizmo拖拽标记，点阵基本累积静止(帧间差>20仅2129px)。判为路线/轨迹采样编辑器；缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层；【卡点·A 机制未做】缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "797844857821732864": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/voxel-ghost.js · voxel-ghost.html",
          "note": "117帧全核（sheet-00/01 两页）；本轮补齐：中轴竖柱装配序（49格，x/z跨度≤3，y 从0到塔顶；t=0.34 实体80格全在竖柱上、其余780格线框=先竖后横）、片尾 dolly（t>0.78 推近至1.22×）、任意网格体素化（同上共用）；仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节；【卡点·A 机制未做】仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "794993371261665280": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：158帧两张联系表全看；逐段色相量出外表面是连续漂移(H154-208°/S恒12-15%)不是6色档→LAYER_PALETTE换实测灰青族，并删掉voxel-ghost.html里抄的第二份旧色板；仍缺内部玫瑰墙(H≈355°)与bandHeight实证(片里量不出层带边界)",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "158帧两张联系表全看；逐段色相量出外表面是连续漂移(H154-208°/S恒12-15%)不是6色档→LAYER_PALETTE换实测灰青族，并删掉voxel-ghost.html里抄的第二份旧色板；仍缺内部玫瑰墙(H≈355°)与bandHeight实证(片里量不出层带边界)",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/voxel-ghost.js LAYER_PALETTE/layerMaterials · voxel-ghost.html LAYER_FACES",
          "note": "158帧两张联系表全看；逐段色相量出外表面是连续漂移(H154-208°/S恒12-15%)不是6色档→LAYER_PALETTE换实测灰青族，并删掉voxel-ghost.html里抄的第二份旧色板；仍缺内部玫瑰墙(H≈355°)与bandHeight实证(片里量不出层带边界)"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "784848286272327680": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r224 复核核销——格内两级细分（planet-wfc-c06.js plates R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+断口裙边，碎块格均 411 顶点 vs 板格 195）、装配起点可指定（solvePlanetTiles/assemblyOrder {root} 钉首格 + planet.html ?root=/「起点：点格」/planetAssembly.setRoot，r216 落地）与表面生物群系斑块（biomeField 低频场换色 + plates allowed 碎块区约束，r56 落地）均已在位，本轮 Node 测试复跑全绿、vendor 依赖闭包逐字 cmp 一致；剩余残差为原作 WFC 求解器内部与原作群系算法未公开（卡点·C 算法未公开），本仓 solveWFC/biomeField 为等价/程序化近似不冒充原物。再立项条件：原作公开求解器/群系细节或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作 WFC 求解器内部与原作群系算法未公开（solveWFC/biomeField 为等价/程序化近似，不冒充原物）；本片可观察残差 r224 已清零：格内两级细分碎块堆 + 装配起点可指定 + 表面生物群系斑块",
        "sourceEvidence": {
          "status": "done",
          "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
          "note": "272帧全核；planet.js 的 assemblyOrder(frontier)/assemblySlice/planetMesh(only) 三档实测 37/185/383/618 格、前沿断口侧壁可见，与片子单粒起点→前沿铺满一致；缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块；【卡点·A 机制未做】缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r224 残差核销（复核零代码改动）：与姊妹片 784847588893814785（r216 done）/784847933686575104（r223 done）共用落点，三项残差均已落位——① 格内两级细分：src/sphere/planet-wfc-c06.js plates 集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（r56 C06 落位；本轮复跑 tests/planet-wfc-c06.mjs：碎块格均 411 顶点 vs 板格 195≈2.1×、碎块集中 biomeField 低频带一片、frontier=1）；② 装配起点可指定单格：solvePlanetTiles({root})/assemblyOrder({root}) 钉首格（order[0]===root、非法 RangeError），planet.html 已补 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（r216 落地；tests/planet-assembly.mjs root 三档断言 PASS）；③ 表面生物群系斑块：biomeField 低频球面场给内容换色（tubes bio>.62 混褐/bio<.3 混苔绿）+plates allowed 把碎块区限制在低频带一片（r56 落位）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致。剩余残差：原作 WFC 求解器内部与原作群系算法未公开（卡点·C 算法未公开，solveWFC/biomeField 为等价/程序化近似不冒充原物）→ 本片可观察残差清零 → done"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "784847588893814785": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r216 已核销——格内细分碎片堆（plates R 碎块格内 16 小三角各自随机高度+断口裙边，碎块格均 411 顶点 vs 板格 195）与装配起点可指定（solvePlanetTiles/assemblyOrder root + planet.html ?root=/点格入口）均已实现、Node+浏览器测试通过、vendor 逐字同步；剩余残差为原作 WFC 求解器内部未公开（卡点·C 算法未公开），本仓 solveWFC 等价实现不冒充原物。再立项条件：原作公开求解器细节或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作 WFC 求解器内部未公开（本仓 solveWFC 等价实现，不冒充原物）；本片可观察残差 r216 已清零：格内细分碎块堆 + 装配起点可指定",
        "sourceEvidence": {
          "status": "done",
          "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
          "note": "270帧全核；与 784847933686575104 共用同一落点（装配生长/断口侧壁/薄壳/白模）；片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现；【卡点·A 机制未做】片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r216 残差核销：格内细分碎片堆与装配起点可指定均已落位——src/sphere/planet-wfc-c06.js plates 瓷砖集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（tests/planet-wfc-c06.mjs：碎块格均 411 顶点 vs 板格 195≈2.1×、碎块只集中在 biomeField 低频带一片），solvePlanetTiles({root})/assemblyOrder({root}) 起点可指定（order[0]===root、非法 RangeError）；planet.html 补页面入口 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（tests/planet-assembly.mjs 新增 root 三档断言、planet-assembly-browser.cjs setRoot 399/点选 608/?root=399/非法回退四段实测 PASS、四档顶点 5907→19797→29508→24765 回归不变）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致（本批无 src 改动）。剩余残差：原作 WFC 求解器内部未公开，本仓 solveWFC 为等价实现不冒充原物（卡点·C 算法未公开）；本片可观察残差清零 → done"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "784847933686575104": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r223 复核核销——装配起点可指定（solvePlanetTiles/assemblyOrder {root} 钉首格 + planet.html ?root=/「起点：点格」/planetAssembly.setRoot，r216 落地）与格内细分（planet-wfc-c06.js plates R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+断口裙边，r56 C06 落地；碎块格均 411 顶点 vs 板格 195）均已在位，本轮 Node 测试复跑全绿、vendor 依赖闭包逐字 cmp 一致；剩余残差为原作 WFC 求解器内部与原作光照参数未公开（卡点·C 算法未公开），本仓 solveWFC/cube-height 为等价/本地近似不冒充原物。再立项条件：原作公开求解器或光照细节、或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作 WFC 求解器内部与原作光照参数未公开（solveWFC/cube-height 为等价/本地近似，不冒充原物）；本片可观察残差 r223 已清零：装配起点可指定 + 格内细分碎块堆",
        "sourceEvidence": {
          "status": "done",
          "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
          "note": "268帧全核；planet.js 补 assemblyOrder/assemblySlice + planetMesh(only)，页面加装配滑杆/白模/薄壳，铺满618格，四档顶点 5907→19797→29508→24765（铺满后断口侧壁消失）；缺装配起点可指定与格内细分；【卡点·A 机制未做】缺装配起点可指定与格内细分 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r223 残差核销（复核零代码改动）：与姊妹片 784847588893814785（r216 已 done）共用落点，两项残差均已落位——① 装配起点可指定：solvePlanetTiles({root})/assemblyOrder({root}) 钉首格（order[0]===root、非法 RangeError），planet.html 已补 ?root=<陆地格>+「起点：点格」点选最近陆地格+planetAssembly.setRoot（r216 落地；本轮复跑 tests/planet-assembly.mjs root 三档断言 + tests/planet-wfc-c06.mjs root 10/400 全 PASS）；② 格内细分：src/sphere/planet-wfc-c06.js plates 集 R 碎块格内 subdivide(4)=16 小三角各自 hash 高度+块间竖墙+外沿断口裙边（r56 C06 落位；碎块格均 411 顶点 vs 板格 195≈2.1×、碎块集中 biomeField 低频带一片，本片「同层细碎凹坑」由碎块堆同型承担）；vendor 依赖闭包 planet.js/planet-wfc-c06.js/wfc.js/trigraph.js/noise.js/module-group-fit.js 与上游逐字 cmp 一致。剩余残差：原作 WFC 求解器内部未公开（卡点·C 算法未公开，solveWFC 等价实现不冒充原物）+片中近AO硬明暗仅 cube-height 高度立方体光照本地近似开关（非原作光照）→ 本片可观察残差清零 → done"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1991101097818403263": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "最新版岸浪已经有代码，但缺少几何约束会在真实场景穿岸/重叠，优先于继续添装饰开关。",
        "nextAction": "保留已有入/出方向与周期数据，补浪形约束、窄湾碰撞和完整海岸遮罩。",
        "acceptance": "固定镜头录完整循环并测接缝/穿岸；高崖、海蚀洞、窄湾双网格回归，保留原作差异。",
        "sourceGap": "退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/wave-cycle.js",
          "note": "477帧全复核：线框浪带展开/到岸，绕高崖与海蚀洞；README明确生成时烘入/出方向和时间偏移。补独立aIn/aOut/aPeriod；退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。；【卡点·A 机制未做】退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1991099314714902634": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "同批展示与机制说明落在同一实现，应共享补全任务，分别保留视频证据。",
        "nextAction": "与 1991101097818403263 合并实施浪形/遮罩/碰撞，不新写另一套岸浪。",
        "acceptance": "共用循环、遮罩和穿岸回归，另核本片高崖/海蚀洞展示范围。",
        "sourceGap": "README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
          "note": "545帧全复核：高崖岛/海蚀洞换角度，白色岸浪分段展开/聚散；README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。；【卡点·A 机制未做】README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1897266928961700215": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
          "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。；【卡点·A 机制未做】全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1890018647655272491": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
          "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。；【卡点·A 机制未做】全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1852334860137849222": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差，永久卡点：裁判云风材质（uWindAmt 三轴异频）已移植并 GPU 验收、前景深度视差层与蓬松云烘焙已接、云影 CPU 镜像同式；原片云形/层次排布/真实风参数未公开 → 需新证据再立项。",
        "acceptance": "残差终判（r214，artifacts/coverage/1852334860137849222-review-r214.md）：近云 GPU 位移与 CPU 模型 <2e-4、depth2.5 视差比 0.4、默认档逐位回旧公式、云影 dx 与模块同式 <1e-5、双网格 31 实例深度 1.202→1.744；剩余残差不可执行，程序近似与缺失原资产分列。",
        "sourceGap": "裁判云风材质/前景深度视差层/蓬松云烘焙已落地；原片真实云形、前景层次精确排布与完整风材质参数未公开（程序近似）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/impostor.js · src/core/cloud-motion.js · src/life/vegetation.js · src/light/cloud-shadow.js · impostors.html",
          "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。r214 残差补全：裁判 engine/impostor.js 云风材质（uWindAmt 树0/云0.6、实例位置相位 ph=x*.13+z*.17、三轴异频 sin .11/sin .15/cos .09、幅度 y×.25/z×.6）函数化移植为 cloud-motion.js cloudWindBob+CLOUD_WIND_BOB_GLSL，CLOUD 非 HORIZON 分支接 uWindAmt；前景云层次补 uCloudParallax 视差（cd=mix(1,depth,parallax)，与 clouddeck v∝1/depth 同口径），vegetation 近云按离岛半径 nearCloudDepth 1→1.8 分层；近云换 fluffyCloudGeometry 菜花云（顶点色烘灰蓝底/暖白顶，远景阴云仍共用旧 cloudGeometry）；cloud-shadow CPU 镜像同除 cd+bob。tests/cloud-motion.mjs+cloud-wind-layers.mjs（默认0零侵入/CPU模型/球面锚点）+ cloud-wind-browser.cjs 真实GPU双网格（位移vs模型<2e-4、depth2.5视差比0.4、默认档逐位回旧、31实例深度1.202→1.744）；clouds/cloud-depth/cloud-shadow/impostor-view/leaf-shadow/cloud-receiver 回归全过；vendor 5文件逐字（impostor-c09.js首拷）。残差=原片云形/层次排布/真实风参数未公开（程序近似）。；【卡点·B 美术资产】原蓬松云形精确形状、前景云层次精确排布与原作风材质参数未公开，裁判风材质公式与视差口径已对齐移植 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1849732997945110651": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "仅拒绝终点入陆地不能保证整段浪带合法，是后续循环岸浪的共同约束。",
        "nextAction": "补全局岩石/泡沫遮罩、窄湾折叠消解与浪带全路径防穿岸。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/shore-profile.js",
          "note": "437帧全复核：黄线贴岸/蓝线外推，270起红三角浪带；窄湾蓝线有交叠。修复黄线Chaikin切凸角、形变后仍用旧法线；只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。；【卡点·A 机制未做】只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1849730611964973481": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：泡沫mask/窄湾交叠仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "泡沫mask/窄湾交叠仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/wave-cycle.js",
          "note": "599帧全复核：微弱错开岸浪、镜头移位、408起红色重叠三角带。保留实际多浪带，各层烘不同周期，闭环弧长相位改整周期频率，避免接缝正弦频率不闭合。到岸opacity连续，循环端隐藏。GPU/实际双网格通过；泡沫mask/窄湾交叠仍缺。；【卡点·A 机制未做】泡沫mask/窄湾交叠仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1849427564034498642": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差：裁判无球面/多俯仰 impostor 烘焙可移植（REACode engine/impostor.js 单仰角0.32八方位柱面卡），原作卡片排布不可证 → 永久卡点，需新证据再立项。",
        "acceptance": "残差终判（2026-11-26，artifacts/coverage/1849427564034498642-pitch-verdict.md）：机制已有独立行为用例（impostor-pitch.mjs、c09-life.mjs、impostor-planet-c09.html 扫掠）与消费者（?fx=impostorpitch）；剩余残差不可执行，不以演示页能打开代替完整验收。",
        "sourceGap": "原作卡片排布（球面/多俯仰与否）不可证、原素材程序近似。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/impostor.js · src/life/impostor-c09.js · impostors.html · impostor-planet-c09.html",
          "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；第55/56批已补多俯仰行+球面卡片+球面局部上方（impostor-c09.js、impostor-planet-c09.html、?fx=impostorpitch、浏览器扫掠过）。2026-11-26裁判对照：REACode engine/impostor.js仅单仰角0.32八方位柱面卡+锚定中点+球面叶alpha（townscaper-reference同款），无球面/多俯仰烘焙可移植；残差=原作卡片排布原片全程低机位不可证、配文仅「octagonal」一词，树冠/云形/星球配色程序近似 → 永久卡点，需新证据再立项。；【卡点·C 算法未公开】原作卡片排布（球面/多俯仰与否）配文未公开、画面不足以反推 → 永久卡点，需新证据再立项"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1798310423554658732": {
        "priority": "高",
        "workType": "接入实现",
        "reason": "已有独立对照页而真实地形未消费，先完成断开的执行链。",
        "nextAction": "将 field-plots 的地块共用主轴/人字耕纹接回 terrainmesh 的真实着色。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "尚未接回 terrainmesh 实际着色",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/field-plots.js · fields.html",
          "note": "614帧全核；新片是六边格地形工具实录：农田按地块共用耕纹主轴并中线折成人字，本仓原为逐格hash随机角，已新建 field-plots.js 并加 fields.html 左右对照；尚未接回 terrainmesh 实际着色；【卡点·D 需接主管线】尚未接回 terrainmesh 实际着色 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1795831296952041691": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "球面河流加速需要真实导航路径消费，局部平面测试不能替代世界级连通。",
        "nextAction": "补球面与复杂汇流的导航费用接口，保留未知流向的中性处理。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/navgraph.js · river-nav.html",
          "note": "598帧全核验；实际高差优先、平床河口距离，未知方向保持中性河费用；Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。；【卡点·A 机制未做】Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1783792917183606829": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法",
        "sourceEvidence": {
          "status": "partial",
          "where": "planet.html（现有网格；纹理流程待补）",
          "note": "242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法；已有planet网格不等于原纹理，代码待实现验收。；【卡点·C 算法未公开】242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1781405550061687016": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "地形/水/岸带的共同纹理接口缺失，会让后续能力无法连续组合。",
        "nextAction": "补投射 UV、手工 UV 和 atlas 的接缝混合接口；顶点色平均不作为替代。",
        "acceptance": "同机位逐项比较草、水、岸带交界；记录接缝指标、投影方式和关闭后的恢复。",
        "sourceGap": "投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/terrainmesh.js（本地混色保留）· patch纹理接口待迁移",
          "note": "219帧全核验：球面投影草/水与手工UV岸带，119附近atlas窗口移入后移出；原文将高度混合列为后续设想。纠正顶面颜色平均=该patch算法的归因，保留本地混色成果；投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。；【卡点·A 机制未做】投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1769691526924292506": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "河道与球面模块生成之间仍断开，是世界组合中的结构缺口。",
        "nextAction": "补球面河道约束坍缩及剩余区域 BFS 生成，保留已有平面汇水实现。",
        "acceptance": "用完整球面验证河网出口/连续性/顺流、模块接缝与剩余地形可生成；平面版本回归。",
        "sourceGap": "完整球面WFC/BFS仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/generate.js",
          "note": "194帧全核验；已有DFS开挖/局部削岸保留，不能冒充球面河道约束坍缩＋其余BFS缓坡，完整生成本批待实现。 复用194帧续作，汇水累计/出口树接共享World真实河网，双网格6组局部通过；完整球面WFC/BFS仍缺。；【卡点·A 机制未做】完整球面WFC/BFS仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1769641473895432220": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "多格联合形状拟合已补（r207，最差边 0.0001–0.133 vs 分格 0.08–0.405）；r213 补多格模块冲突诊断/消解（拒绝码对齐 build/multicell.js、确定性消解、moduleCheck 拒绝入口，裁判库无多格冲突语义可对齐）；剩余为尺寸/墙倾斜冲突的几何下界、原模块目标形状无出处与浏览器/运行时验收。",
        "nextAction": "无可执行残差，永久卡点：r214 浏览器验收已跑（solver=joint disagreeMean 0.0111≈shape、0 翻折、unresolved=6 与诊断一致）；剩卡点·C（尺寸/墙倾斜下界不收）+卡点·B（原模块目标需原作证据）。",
        "acceptance": "多种高度/多格足迹误差前后曲线已记（最差边曲线不掩盖最差边、逐边诊断、超阈值回退分格、接缝拓扑校验）；多格冲突诊断/消解已 Node 验收（拒绝级全枚举、unresolvable 角距边界、消解后 ok、装配切断、确定性）；剩余：浏览器运行验收与原目标形状对照。",
        "sourceGap": "尺寸与墙倾斜冲突使宽高原蘑菇化有下界（组角距 >69° 记 unresolved 不收）；原模块目标形状在 REACode 无出处（海平面足迹=推断）；浏览器验收已过（r214）/游戏运行时接入属换批。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/sphere/planet.js · src/sphere/module-group-fit.js · planet.html",
          "note": "479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐轮保最优，最差边绝不差于相似解），edgeTol 超阈值回退分格拟合+逐边诊断 moduleGroupReport；moduleGroups 把声明模块切成独立联合单元。r213 补「多格冲突仍待补」：裁判库核对——REACode engine/relax.js 无模块组语义、spheretown 列本片 relax 为 Not done、多格 tile 为 todo，无原作多格冲突语义可对齐 → 按本仓 build/multicell.js 拒绝码实现 moduleConflictReport（求解前静态诊断：invalid-cell/duplicate-cell/overlap/disconnected/unresolvable=拒绝级，sea/uneven-support/assembly-cut=诊断级，装配 order 里不连续足迹记 assembly-cut）+resolveModuleGroups 确定性消解（剪非法/重复/重叠→连通切分→角距仍超 farLimit 丢弃并逐条记账，不伪造可行解）+cornerPositions moduleCheck 拒绝入口（枚举全部拒绝原因一次抛出）；unresolvable 与求解器同界（海平面足迹角距>1.2rad≈69°→逐层必 unresolved）。tests/module-group-fit.mjs 7/7（4 格足迹各层最差边 0.0001–0.133 vs 分格 0.08–0.405，全局 moduleSizeReport 0.399 < spring 0.535，曲率扫描/确定性/拓扑接缝校验）+ module-group-conflict.mjs 9/9（冲突全枚举/unresolvable 边界/消解确定性/moduleCheck 拒绝）+ sphere 套件回归过。；【卡点·C 物理冲突+B 资产】尺寸与墙倾斜的冲突使宽高原蘑菇化有下界（far 越大上限越紧，>69° 组角距记 unresolved 不收）、原模块目标形状在 REACode 无出处（海平面足迹=推断）、vendor 两文件已逐字拷入、r214 浏览器验收过（planet.html?solver=joint 实测：disagreeMean 0.0111≈shape 0.0075≪spring 0.0953、0 翻折、unresolved=6 与 moduleConflictReport 诊断一致，tests/sphere-joint-solver-browser.cjs）/游戏运行时接入属换批；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1768627849529893109": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "球面 World 网格生成/编辑/保存恢复已补（r209，sphere-world.js 5/5 单测），网格渲染/球面编辑/存档往返/接缝已浏览器验收（sphere-world.html），r211 补球面平滑海岸线浏览器验收（sphere-shore.html + tests/sphere-shore-browser.cjs：水陆世界 3 环 275 点、断点 0、跨接缝 84 岸角缝 0、双次确定性逐字、岸线像素差 5041px）并把 src/sphere 13 文件+core/trigraph.js 逐字拷进 TigerMessenger vendor（463/463 绿、?src=vendor 同数）；剩余为原片模块视觉（资产未知）与游戏运行时接入。",
        "nextAction": "learn 侧残差即原片模块视觉（卡点·B 美术资产，无可执行残差，永久卡点，需新证据再立项）；vendor 文件已逐字拷入、运行时改调属 vendor 换批轨（台账 ITERATION_50 已记）。",
        "acceptance": "球面网格生成（真邻接+接缝闭合）、球面编辑（加点/删点/改层）、保存恢复往返相等、球面平滑海岸线已 Node+浏览器双验收（网格面片渲染/编辑像素差非零/往返逐像素一致/接缝顶点对账全零/岸线 3 环 275 点断点 0/跨接缝岸角缝 0/确定性逐字/vendor 拷贝同数）；剩余：游戏运行时接入、原片模块视觉对照。",
        "sourceGap": "原片模块视觉（原作模块形状/美术未知，本仓替身仅 planet-town 小房）、游戏接入（vendor 文件已逐字拷入、运行时未改调）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/sphere/planet.js · src/sphere/world-sphere.js · src/sphere/sphere-world.js · planet.html · sphere-world.html · sphere-shore.html",
          "note": "229帧全核验；r205 补「平面World→球面」接线层 src/sphere/world-sphere.js：'bend' 模式与实景十二门徒 bendU/uBend=S/(2Rw)/帽面法线/锚点 frame 逐式同口径（抛物面下弯），'sphere' 方位等距严格上球（|p|=R、径向保距、往返一致）；柱格姿态=位置+径向up+测地平行搬运基+切平面 yaw，邻接格共享角点映射逐位相同（接缝闭合）；岸线=traceShoreLoops 平面黄线贴球→按角距细分→球面 Taubin 平滑→沿搬运法线测地外推蓝线，闭环相邻角距受控。r209 补球面 World 网格生成/编辑/保存恢复 src/sphere/sphere-world.js：sphereGrid 由 patch+网格参数产出真 cell 拓扑（grid.js 共享角点+edgeNeighbors/edgeTwins，非姿态摆放）附 pts3/pose，quad/square/hex/mixed 四类全落球接缝闭合；spherePick→sphereApply 把球面 3D 点翻译成落格编辑（build/erase/raise/dig/level/paint 与平面 applyAt 同语义）；encode/decodeSphereWorld 与 save.js 同风格位流+游程+版本/mode/网格参数/patch 指纹校验。tests/sphere-world.mjs 5/5 + world-sphere 等 sphere/planet 套件回归 PASS。浏览器验收（sphere-world.html + tests/sphere-world-browser.cjs，真实 GPU/three r160 + 本机 Chrome swiftshader）：634 格渲染成 1268 三角面片（非有限顶点 0、2536 角点引用全在 R=60 上）；sphereEdit 14 次贴内 build/erase/paint/raise/level 全 changed、贴片外拾取无操作，前后帧逐像素差 30381px/maxΔ167；encode→decode 进同规格 World 体素四数组逐位相等、再编码逐字相等、换渲染恢复出的世界逐像素一致 diff 0；接缝 2452 条内部半边 twin 角点 3D 距离全 0，weld 对账 2532/2536 角点引用被≥2格共享（边界 4 个单格角点除外），最多 6 格共点，接缝特写无裂缝。r211 vendor 拷贝+海岸线浏览器验收：src/sphere 全 13 文件+依赖闭包 core/trigraph.js 逐字进 TigerMessenger/src/vendor/townscaper-rea-refactoring/src/（sphere 只依赖 World/MAX_LEVEL 与常规体素接口，core/world.js 保护文件未动、splicedHouses/houseInstances 快照字段保持旧口径；cmp 逐字一致、node --check 全过、TigerMessenger --test 463/463 绿）。球面平滑海岸线浏览器验收（sphere-shore.html + tests/sphere-shore-browser.cjs，8769 静态服+本机 Chrome+playwright）：fbm 确定性水陆世界 634 格（陆136/岩56/水498，主岛+内湖+小屿）→ worldShorelines(spacing0.18/maxStep0.05/smooth6/reach0.4) 得 3 条闭环 188+42+45=275 点；断点 0、非有限点 0、最大步角 0.0031≤0.05、径向偏差≤2.2e-14、法线与径向|dot|≤8.4e-17、蓝线测地外推 0.4 同半径；跨接缝 84 个岸角 343 份角点引用逐位一致（缝0/错0）；同 World 重抽与 spec 重建再抽逐字相等；岸线叠加像素差 5041px；vendor 拷贝 ?src=vendor（8931 服）同数通过。残差：游戏运行时接入（vendor 文件就位、运行时改调未做，属换批）。；【卡点·B 美术资产】原片模块形状/海岸美术细节未知，程序近似与美术差分列；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1765115069837221962": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原3D树/跨叶候选待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原3D树/跨叶候选待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/atlas.js · grids.html?t=atlas",
          "note": "247帧全核验；真实树查询事件与暂停/拖动、显式栈统计通过。保留first-fit叶内切分，不以模拟手臂代替原遍历；原3D树/跨叶候选待补。；【卡点·A 机制未做】原3D树/跨叶候选待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1765041830461055127": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/atlas.js · grids.html?t=atlas",
          "note": "558帧全核验，侧视彩块变薄不能误认为删除；重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。；【卡点·A 机制未做】重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1764958522398146667": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/atlas.js · grids.html?t=atlas",
          "note": "296帧全核验；可选边角/有界随机候选、树剪枝碰撞与跨叶分配/key释放；9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。；【卡点·A 机制未做】9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1758250248483278925": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整反射投影/遮挡仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整反射投影/遮挡仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/reflection.js · src/world/view.js",
          "note": "516帧全核验：高崖、低平教堂、中高教堂岛依次转动，反射轮廓/颜色克制；原文没有公式。保留共享几何近似而不冒称原作算法，新增实际场景颜色混合/扰动/线框对照；完整反射投影/遮挡仍缺。；【卡点·A 机制未做】完整反射投影/遮挡仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1751932427272909032": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "指定模块若不能兼顾形变和邻域约束，会阻塞组合能力的可靠落地。",
        "nextAction": "补完整 prefab/socket、形变碰撞与周围补网/WFC，复用已有原子放置。",
        "acceptance": "指定模块放置/撤回在两种网格通过；支撑和碰撞失败保留原 World，验证相邻模块接口。",
        "sourceGap": "完整prefab/socket、形变碰撞及补网/WFC待续。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js",
          "note": "复用552帧，显式patch/搜索/几何后接共享World原子体量放置、支撑占用预检和按列撤回；完整prefab/socket、形变碰撞及补网/WFC待续。；【卡点·A 机制未做】完整prefab/socket、形变碰撞及补网/WFC待续。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1727324352264474664": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节；可执行残差已核销，剩余为来源不足的永久项。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r220 已核销——速度场/CPU审计接口逐式移植裁判 REACode smear.js（velocityField/smearField/sharpness/smearAudit），轮廓涂抹近似=whipSmear 轮廓加权方向性历史拖尾接入 view#smear（GPU==CPU 对拍 maxDiff=0、方向选择性/轮廓加权/∝r/停转恒等全过）。剩余=原片精确轮廓算法未公开（卡点·C，配文只说某算法）。再立项条件：原作公开算法细节或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作精确轮廓算法未公开（卡点·C，永久）；速度场/CPU审计/轮廓涂抹近似已核销。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/camera-motion.js（whipSmear/velocityField/sharpness/smearAudit）· src/world/view.js（轮廓加权方向历史拖尾）· tests/whip-smear.mjs · whip-smear-browser.cjs",
          "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。r220 残差核销——速度场 velocityField+CPU审计 smearField/sharpness/smearAudit 逐式移植裁判 REACode smear.js；轮廓拖抹近似=whipSmear 轮廓加权方向性历史拖尾（沿内容速度场4-tap streak、alpha·(.45+.55·e)轮廓掩码，CPU+WHIP_SMEAR_GLSL孪生接view#smear，smearTex改双线性），GPU==CPU两组64²全图对拍maxDiff=0、水平边只沿y拉宽≈pan、∥轮廓恒等、轮廓像素混比>边外；实景轮廓带/平区差分18.9/8.2、∝r、0.5/1/2×|shift|单调、停转恒等、开关alpha=0；tests/whip-smear.mjs+whip-smear-browser.cjs，camera-wall-browser回归PASS。剩余残差=原片精确轮廓算法未公开（卡点·C，永久）。；【卡点·C 算法未公开】结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1727315611959865407": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原片方向性轮廓拖抹、速度场与全指标接口仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原片方向性轮廓拖抹、速度场与全指标接口仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/camera-motion.js · src/world/view.js",
          "note": "337帧全核验。保留上一批历史帧/释放修复，新增按dt换算的历史留存，30/60/120Hz实际渲染参数通过；原片方向性轮廓拖抹、速度场与全指标接口仍待补。；【卡点·C 算法未公开】原片方向性轮廓拖抹、速度场与全指标接口仍待补。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1724449858369568780": {
        "priority": "中",
        "workType": "核对后续交付",
        "reason": "当前目录已有后续实现，重复排开发会制造假缺口；需要按现代码重验后更新来源账。",
        "nextAction": "先核对已新增 node-editor.html 与编辑器源码/浏览器回执，核销旧“缺可拖拽编辑器”记录。",
        "acceptance": "重验拖节点/连线/非法环路拒绝/撤销重做/序列化；证据和当前源码一致后才核销。",
        "sourceGap": "仍缺可拖拽的真实节点编辑器",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/node-graph-runtime.js · node-graph.html",
          "note": "134帧全核（sheet-00/01 两页）；本轮补齐序列化：serialize/fromJSON/NODE_REGISTRY，导出含节点type+params+连线+lerp当前值（往返后位置-202.9不跳回、90帧轨迹逐帧一致差<1e-9）；sink 上次值移入 state 避免载入误触发；页面新增只读连线图（7框6线、框内实时值）与导出/载入；仍缺可拖拽的真实节点编辑器；【卡点·A 机制未做】仍缺可拖拽的真实节点编辑器 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1714613599035863191": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完…",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/field-pattern.js · terrainmesh.js · WorldMesh/View",
          "note": "620帧全核验：条纹弯曲随格块换向，浅崖横带；135/256/473/571附近空屏后换岛，依次出现黑轮廓、无光材质、亮面和田纹；不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完成原作手绘纹样与投射atlas。；【卡点·B 美术资产】不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1712088611934371876": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/palette-patch.js · src/world/view.js · palette-editor.html",
          "note": "624帧全核验。四角/白三角/取样色带与OkHsl/OkLab/Srgb菜单可见；新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。；【卡点·A 机制未做】新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1710031224838771027": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "浏览器实景验收已过（三特征分桶零串色、steps 阶梯、同参/跨重载确定性）；剩原作 Unity 编辑面板交互（卡点·B，原作工具不可复现，无本地可验证实现），无可执行残差（永久卡点，需新证据再立项）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作 Unity 编辑面板交互（五特征域拖点）不可复现，仅输出侧 GPU 验收。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/color-volume.js · src/world/view.js · color-lab.html · tests/color-volume-features-browser.cjs",
          "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面。三特征各接独立HSL域（setFeatureColorVolumes + featVolumeSample 按 vField.z 分桶，未给的特征保持基色）；steps 离散采样吸附 i/(steps-1) 格点（对齐原版 strip(12)，CPU+GLSL cvQuant 同式）；原版完整接口补齐（sampleCornerVolumeSpace/css/dE/oklabToRgb/colorVolumeTerrain/opts透传）。tests/color-volume-features.mjs 全过。浏览器实景验收过：fusion页真GPU mode-3编译在位、三特征分桶零串色（掩膜35076/22670/33759px，越界0/串桶0，默认发货态同验）、steps=4/12掩膜内唯一色2614→35→221、同参重渲与跨重载逐像素一致；【卡点·B 原作工具不可复现】Unity编辑面板交互（五特征域拖点）本仓不可运行，仅输出侧GPU验收"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1708815475801505819": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "残差已逐条核销：斜脊布局由 rockforms-c09 工程近似承担，柱群/拱洞/平顶苔/分级崖面/平顶屋由裁判 mesa 逐式移植并 0 差异对拍；剩余只有来源不可得卡点。",
        "nextAction": "无可执行残差，永久卡点：原作斜脊生成算法未公开（配文仅\"a cool cliff I came across\"）且原美术资产/整体视觉不可得；裁判 mesa 与 rockforms 均为近似不能认证为原作，需新证据再立项。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作斜脊生成算法与美术资产未公开；可观察行为已由 rockforms-c09 工程近似 + 裁判 mesa 逐式移植覆盖。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/mesa-field.js · src/terrain/rockforms-c09.js · src/terrain/features.js · src/terrain/shape.js · src/core/deformation-guard.js",
          "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。；r216 残差核销——可观察行为拆五件：斜脊/悬空岩桥拱洞/圆岩柱群/苔只长朝上平顶/柱顶与岛面小屋。斜脊由 r56 rockforms-c09.js 工程近似承担（leaningRidge 胶囊+softTops 连续斜面、bridge 只写顶2层留洞、c09-terrain-b 双网格过）；其余四件裁判库有对应机制：engine/mesa.js 逐式移植 src/terrain/mesa-field.js（grid+Town 外置、同式同序同 rng 消费），tests/mesa-referee.mjs 4/4——3 种子×6846 格×12 层体素+颜色+屋位与裁判 0 差异对拍、确定性重建逐位、拱下空洞 7 格、苔格全在平顶、屋距≥1.9·hexSize、共享 World+buildQuadGrid 语义验收过；灌木 P90/splitCells 属 1707497006640365880 已于 r105 核销（同机位 P90/apothem 0.154 vs 0.138 本仓偏厚未改常数、splitCells 过期名词 triC 扇+edgeTri 线框核对在位），本轮复核不再改；vendor 逐字拷入 mesa-field.js+rockforms-c09.js（import 闭包自足）。；【卡点·C 算法未公开+B 美术资产】原作斜脊生成算法未公开（配文仅\"a cool cliff I came across\"，裁判 mesa 与 rockforms 均是近似不能认证为原作）+原美术资产/整体视觉不可得 → 需新证据再立项"
        },
        "basis": "2026-11-25 r216 残差核销复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1707497006640365880": {
        "priority": "中",
        "workType": "校准与证据补全",
        "reason": "逐三角带宽机制在位，P50 已对上原片；P90 差一档且机位不可比，splitCells 边缘带走向未对照。属于同一灌木纹理能力的标定收尾。",
        "nextAction": "先找机位可比的帧重测 P90，再决定是否上调 SHRUB_BAND.max；补 splitCells 边缘带走向与原片的对照用例。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "P90 10px 对原片 14–18px 差一档（机位不可比，常数未改）；splitCells 边缘带走向未对照",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/shrub-band.js · meshwriter.bandTri · terrainmesh.js:236 · shrub-band-peredge-browser.cjs",
          "note": "600帧全核（sheet-00 0000-0099 + 4× 裁切）；逐三角带宽机制在位，本轮同口径重测：P50 4px 对上原片 4-6px，P90 10px vs 原片 14-18px 差一档→SHRUB_BAND.max 上沿偏低但机位不可比未改常数；splitCells 边缘带走向仍未对照"
        },
        "basis": "2026-11-14 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1707490932017279035": {
        "priority": "中",
        "workType": "校准与证据补全",
        "reason": "逐三角换档机制已由特写确认；剩余是倍率上沿的标定，本片是更近特写，不能直接外推。",
        "nextAction": "用机位可比的片段标定 SHRUB_BAND 倍率上沿（与 1707497006640365880 共用同一次标定），不以本片 P90 22px 直接改常数。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "倍率上沿未标定；本片为近特写，不能直推",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/shrub-band.js · meshwriter.bandTri · terrainmesh.js:236",
          "note": "257帧全核（sheet-00 0000-0099）；特写里橙斑在相邻三角上 22/12/7px 依次换档、边界两侧各自恒定，机制确认；本片 salmon 13.17%/P90 22px 是更近特写，不能直推倍率上沿"
        },
        "basis": "2026-11-14 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1705195380457996629": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
          "note": "300帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。；【卡点·C 算法未公开】实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1704246032626762189": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；裁判可提取项已全部移植并 Node/GPU 验收，剩余残差为来源不足的永久项。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：裁判 engine/blotch.js BODY 可提取参数已全部移植（配色/阈值/密度权重/细颗粒/角度场逐式 + 图集路径末项细颗粒 + 崖面分段线 y*1.8·.12），跨崖=共享World rim场等深收口+旧路径顶面闸门、反射=两路仅改albedo（无高光/粗糙度/环境项）均本地验证。剩余=原作本人图集文件与细卷边手绘细节未公开（卡点·B）。再立项条件：原作素材公开或更高清证据。",
        "acceptance": "裁判参数全量对齐（配色/阈值/密度权重/细颗粒/角度场逐式）；Node 双侧逐位一致性 + GPU 双网格验收；程序近似与缺失原资产分开记录。",
        "sourceGap": "原作 atlas/细卷边手绘细节=原片未公开美术资产（卡点·B，永久）；本地 fbm 场替裁判图集通道为程序近似。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
          "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1704218784028905984": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "已确认同一局部方案有后继，不应先把旧版独立做成一套最终实现。",
        "nextAction": "作为旧表面阴影对照，优先补 1705195380457996629 的后续修正分支。",
        "acceptance": "旧版可对照；后继版本在屋檐/草崖与 UV 接缝测试通过，不隐去原误差。",
        "sourceGap": "实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
          "note": "335帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。；【卡点·C 算法未公开】实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1703750394164199473": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；裁判可提取项已全部移植并 Node/GPU 验收，剩余残差为来源不足的永久项。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：裁判 engine/blotch.js BODY 可提取参数已全部移植（配色/阈值/密度权重/细颗粒/角度场逐式 + 图集路径末项细颗粒），跨崖=共享World rim场等深收口+旧路径顶面闸门、反射=两路仅改albedo（无高光/粗糙度/环境项）均本地验证。剩余=原作本人图集文件与细卷边手绘细节未公开（卡点·B）。再立项条件：原作素材公开或更高清证据。",
        "acceptance": "裁判参数全量对齐（配色/阈值/密度权重/细颗粒/角度场逐式）；Node 双侧逐位一致性 + GPU 双网格验收；程序近似与缺失原资产分开记录。",
        "sourceGap": "原作 atlas/细卷边手绘细节=原片未公开美术资产（卡点·B，永久）；本地 fbm 场替裁判图集通道为程序近似。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
          "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1699146321318314094": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：场形已逐式移植裁判（sHash/sNoise/sWobble/sWarp 四函数体逐字一致+JS↔转写4096点Δ=0）、位移xz分量已补（vec3(b,a,b*.7)，(x,z)定点迭代逆往返3.55e-15≤1e-9）；剩=原作真实场（裁判外的原片未公开算法，卡点·C）+vendor接SEDIMENT_GLSL（B批换库）。再立项条件：原作素材/算法公开或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "裁判可提取项已全部移植并校验（二倍频值噪声场形四函数逐字、位移xz分量vec3(b,a,b*.7)、(x,z)定点迭代逆往返3.55e-15）；残差=原作真实场未知（永久卡点·C）+vendor未接SEDIMENT_GLSL（B批）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
          "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。2026-11-24 剪切场尺度按裁判实测标定：幅度±0.12wu=±0.65层距（裁判uSedAmp.24×[-.5,.5]）、主波长≈1.9wu（裁判uSedFreq.52，原系数λ6–26wu过缓约4倍）。2026-11-26 残差收口——裁判场可逐式移植，已换：sediment.js/SEDIMENT_GLSL 的 sHash/sNoise/sWobble/sWarp 四函数体与裁判 engine/surface.js 逐字一致（测试提取裁判文件比对），JS↔裁判转写 4096 同点采样 maxΔ=0；位移含 xz 分量 vec3(b,a,b*.7)·uSedAmp，弯层模式裂纹/砂砾同吃歪过的 sed.xz（与裁判 sed=wp+sWarp(wp) 同构）；uSedAmp/uSedFreq 同款 uniform 接 view.js（uSedAmp=本地峰值×2）。可逆性：位移只依赖(x,z) → 逆问题二维定点迭代（雅可比实测≈0.19<1，裁判 wobbletex.js 量具同款做法），unwarpSediment 收敛至1e-15停、10000点往返残差3.55e-15≤1e-9阈值；解析逆不存在已如实记。双网格GPU重过：wobblePixels 5596/5209、三角剖分缝0、几何/World无漂移。残差=原作真实场未知（裁判场本身是重构近似，移植裁判≠原作）、vendor地形网格未接SEDIMENT_GLSL（B批待换）。；【卡点·C 算法未公开】裁判可提取的场形与xz分量已全部移植并逐字/数值校验；剩原作真实位移场 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1699038611125985317": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；裁判可提取项已全部移植并GPU验收，剩余残差为来源不足的永久项。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：「反射」复核裁判engine/surface.js全文件无沉积专用高光/环境反射项（roughness .92/metalness 0、沉积仅改albedo，本地材质同款、color_fragment注入同构），无可移植公式；「原作外观」可提取项已全部落地并GPU对照。剩余=原片未公开资产（真实场/调色板/岩性色幅，卡点·B）+越界项（海拔色偏归surface/patch线1781405550061687016已done、抖动xz分量归姊妹条目1699146321318314094且y-only可逆设计、vendor接SEDIMENT_GLSL为B批）。再立项条件：原作素材/算法公开或更高清证据。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "裁判可提取项全部移植并GPU对照（槽距1/5.4wu/奇偶±0.08/每3主层理/裂纹/砂砾/弯层尺度/线深.54）；「反射」经裁判全文件复核无沉积专用项、材质同款，无可移植。残差：原作真实场/调色板/四岩性色幅=原片未公开资产（卡点·B，永久）、海拔色偏=裁判全局层归surface/patch线、抖动xz分量=姊妹条目y-only可逆设计、vendor未接SEDIMENT_GLSL（B批）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/sediment.js · src/core/sediment-bands-c09.js · src/terrain/terrainmesh.js · src/world/view.js",
          "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。2026-11-24 裁判对照（REACode engine/surface.js 逐式提取）：槽距校准=1/5.4wu（BAND_SLOTS 5→2.7）、奇偶两色±0.08、每第3条主层理、裂纹与砂砾点移植、弯层幅度±0.12wu·主波长~1.9wu、线深.54同款；反射=裁判无沉积专用高光项（沉积只改albedo）、阴影一致性走标准光照，结构对齐；带宽变异系数0.293→0.371过阈；裁判/候选同俯仰截图对照（不同地形，非逐像素）。残差：四岩性配色幅度超裁判两色±0.08（C09帧近似）、抖动场xz分量、海拔色偏未移植（裁判为全局层）、原作真实场/调色板未知、vendor地形网格未接SEDIMENT_GLSL（B批待换）。2026-11-24「原作外观/反射」残差终判：复核裁判 engine/surface.js 全文件——反射无沉积专用高光/环境反射项（MeshStandardMaterial roughness .92 / metalness 0，沉积只改 diffuseColor，光照在其后统一算；本地 view.js 材质参数同款、color_fragment 注入同构），无可移植反射公式；裁判可提取项已全部移植并 GPU 验收。剩余残差均不可执行：原作真实场/调色板/岩性配色幅度=原片未公开资产（卡点·B）；海拔色偏=裁判全局层，归 surface/patch 线（1781405550061687016 已 done）非本条目；抖动 xz 分量=姊妹条目 1699146321318314094 残差，y-only 为可精确逆设计选择；vendor 接 SEDIMENT_GLSL=B 批换库。→ 无可执行残差（永久卡点，需新证据再立项）。；【卡点·B 美术资产】原作真实场/调色板与海拔色偏未移植，四岩性配色为程序近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1696896119794479541": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/terrainmesh.js",
          "note": "550帧全核验。保留已有沿形变崖面圆瓣草边几何；这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。；【卡点·A 机制未做】这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1696864977171189980": {
        "priority": "高",
        "workType": "美术与表现补全",
        "reason": "纹理控制边界是地形、草崖与后续混合能力共享的基础。",
        "nextAction": "补 atlas/rim 距离场与完整参数接口，检查大笔触不越过重要边界。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/blotch-pattern.js · src/world/view.js",
          "note": "502帧全核验。共享View修复绿色屋顶被地面笔触误染：显式顶面标记+法线/颜色筛选，按真实levelHeight选层。实际材质GPU对照排除屋顶/岩壁、双网格通过；原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。；【卡点·B 美术资产】原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1677242779162877952": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "网格若只能生成不能安全局部编辑，后续模块放置和修复能力无法完整组合。",
        "nextAction": "在已实现坏输入拒绝之上补真实局部增删/编辑接口；明确 Delaunay 与几何交叉保证范围。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/trigraph.js · trigraph.html",
          "note": "白色三角线框扩展、不规则外轮廓和局部彩边变化；画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。；【卡点·A 机制未做】画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1671840905957978113": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺墙裙残留与悬檐联动",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺墙裙残留与悬檐联动",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/terrain-burial.js · terrain-stages.html",
          "note": "246帧全核（原判na有误）；抬地面吞建筑的体素规则已落地（terrain-burial.js + terrain-stages.html 掩埋栏），peeking 3/吞12层；缺墙裙残留与悬檐联动；【卡点·A 机制未做】缺墙裙残留与悬檐联动 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1671808851895627776": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原版软坡/侵蚀有效生成与完整接口待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原版软坡/侵蚀有效生成与完整接口待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/rock-topology.js · terrain/features.js · terrainmesh.js",
          "note": "303帧全核验：岩檐、柱间空洞、下层地面与环绕低机位。保留已有World分层rock及侧/底面，补岩石区间/空隙/level1连通诊断；真实双网格底面6顶点、断开支撑可报1未连岩石。薄岩檐平滑形变仍收缩，视觉未等价；原版软坡/侵蚀有效生成与完整接口待补。；【卡点·A 机制未做】原版软坡/侵蚀有效生成与完整接口待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1670790425232175108": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：独立六边地形/原模块仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "独立六边地形/原模块仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js · grids.html?t=kinds",
          "note": "610帧全核验；修“纯方格”仍有三角的误标，新增真正正交方格，保留合并菱形对照，局部Canvas/WorldMesh通过；独立六边地形/原模块仍缺。；【卡点·A 机制未做】独立六边地形/原模块仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1670725072540106755": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "分级平滑要能证明保护设计边界，否则地形和建筑的组合可能被破坏。",
        "nextAction": "补无平滑/普通/分级三态真实对照，并让原模块语义进入共同输入。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/shape.js · hierarchy.html",
          "note": "164帧全核验，原片依次切换三模式；保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。；【卡点·A 机制未做】保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1670720537662836736": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "后续自然坡面与清晰边界必须依赖一致边类型。",
        "nextAction": "补硬边、游戏模块边和材质边的真实三角网语义，不只传入临时 hardEdges。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/shape.js · hierarchy.html",
          "note": "102帧全核验；共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。；【卡点·A 机制未做】共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1670064751181791233": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺真job线程与四轮节奏还原",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺真job线程与四轮节奏还原",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
          "note": "420帧全核；累积分阶段执行器+共享时钟+每tick预算慢放已落地（StageRunner/advance）；缺真job线程与四轮节奏还原；【卡点·E 环境不具备】缺真job线程与四轮节奏还原 → 卡在环境（job/线程、主机性能基线），本机实验页验不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1669315384619540487": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原完整生成/倒角一致性未完成。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原完整生成/倒角一致性未完成。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/generate.js · src/core/terrace-edges.js · terraces.html",
          "note": "649帧全核验，多岛成果/构建过渡与转镜；完整软坡/模块联合生成和原美术质量仍待补，本批仅学习审核。 旧649帧续作：真实World共格边层界/线框/岸界及笼投影局部验收；原完整生成/倒角一致性未完成。；【卡点·A 机制未做】原完整生成/倒角一致性未完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1666429884208381953": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：蓝线窄湾交叠/泡沫mask仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "蓝线窄湾交叠/泡沫mask仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
          "note": "630帧全核验：旋转/固定高崖岛，凹湾与白色岸裙细微聚散；原文只说Bad North/Townscaper改良版，不证明具体距离算法。共享水层改规范绕序/按左侧陆地转向及自接闭环分解，1024组合及实际双网格通过；蓝线窄湾交叠/泡沫mask仍缺。；【卡点·A 机制未做】蓝线窄湾交叠/泡沫mask仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1664566546683899905": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；裁判API已迁移并逐位对拍，剩余为原片算法未公开的永久卡点。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：裁判 engine/shorefield.js 的 buildShoreDistance 已逐式移植 src/water/shorefield.js 并补 tests/shorefield-referee.mjs 对拍（两套真实双网格 sample/march 逐位一致、双 Town 实现互换一致、shore 消费路径端点残差≤1.2e-5）。再立项条件：原作真实距离场算法公开或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "buildShoreDistance API已核销：裁判shorefield.js逐式移植src/water/shorefield.js并逐位对拍（sample/march maxDiff=0）；残差=原片真实算法未公开（卡点·C，永久）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/shore-profile.js · src/water/shorefield.js · tests/shorefield-referee.mjs",
          "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过。buildShoreDistance API残差核销（2026-11-25，r211）：裁判 engine/shorefield.js 逐式移植为 src/water/shorefield.js（格心rasterise+两遍1/√2 chamfer+双线性sample+0.75·res步进/12次二分march，返回{sample,march,res,origin,size}同形+另挂w/h/land/field诊断），补 tests/shorefield-referee.mjs 裁判对拍——两套真实双网格（裁判buildGrid 762格/场222²、本仓buildQuadGrid 1052格/场170²）sample共449,488点逐位一致（maxDiff=0）、march 128射线逐位一致、REACode Town与core/town-graph Town互换逐位一致、重跑确定；shore消费路径（traceShoreLoops+sampleShoreline+march）268岸点端点|field−target|≤1.2e-5。差异如实标：内部索引用core/spatial buildCellIndex（桶2/所在桶 vs 原版桶4/3×3邻域，同为含点格子的超集）、pointInQuad按n角巡边（四边形逐式相同）、补RangeError验参与4M栅格预算；不融合进shore.js（其内部场有shape形变定界），sample/march同签名可平替注入。剩余残差：对拍对象为本仓裁判的重构实现，Oskar原作真实距离场算法未公开，无可执行迁移项。；【卡点·C 算法未公开】原作距离场浪裙真实算法未公开 → 卡在原片算法未公开：配文只说\"distance field-like\"不附算法，画面也不足以反推，只能近似；本仓裁判实现已逐式移植并对拍核销；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1664565063552847873": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "作者已提出浮点 RT、风格调节和 CPU 反馈疑虑，且几天后回到旧方案改进。",
        "nextAction": "保留浮点流体试验与平台测试；当前先补作者后续选择的岸线几何方案。",
        "acceptance": "只有明确需要流体模拟的场景才补跨 GPU/CPU 反馈；不影响默认岸浪完整度。",
        "sourceGap": "跨平台及平流/CPU误差待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/float-probe.js · float.html",
          "note": "117帧已核验；本环境16F/32F写入、负值/HDR回读和线性过滤通过；跨平台及平流/CPU误差待补。；【卡点·E 环境不具备】跨平台及平流/CPU误差待补。 → 卡在环境（job/线程、主机性能基线），本机实验页验不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1654401054828638214": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺AO软阴与生成后地形微调，非视觉等价",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺AO软阴与生成后地形微调，非视觉等价",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
          "note": "343帧全核；增量Delaunay三角化+抬升+灰模+上色四段已落地（pipeline-stages.js + terrain-stages.html）；缺AO软阴与生成后地形微调，非视觉等价；【卡点·A 机制未做】缺AO软阴与生成后地形微调，非视觉等价 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1593215065423245313": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "自动扩容/重排本批已核销（翻倍+atlas.repack 整批重排+rt 原位放大+逐槽搬运+UV 同步+两路回滚）；剩余残差为残影近似、原素材与完整接口。",
        "nextAction": "无可执行残差：原素材/完整SpriteAtlas接口属卡点·B 美术资产（永久卡点，需新证据再立项）；残影已按 sprite-pack-c09 ×0.38 口径核销（GPU 0.3804 倍实测）。本批已补：自动扩容/重排 + residue 残影。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原素材/完整SpriteAtlas接口不可得（卡点·B）；扩容策略与残影属本地近似已注明。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/impostor.js · src/life/vegetation.js · src/world/view-post-extras.js · atlas-live.html · tests/impostor-grow.mjs · tests/atlas-live-browser.cjs",
          "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收。本批补自动扩容/重排：满板按REACode SpriteAtlas.insert语义翻倍、atlas.repack整批重排，rt.setSize原位放大（rt/texture对象不变，uTex/map免重绑）+scratch备份逐槽搬运，存活frames就地改写、注册ImpostorField经syncFrames同步（vegetation/view-post-extras/planet-c09消费方已接），maxSize封顶与搬运中途GPU失败两路回滚；tests/impostor-grow.mjs过（UV/槽位一致性、9次blit调用序列、两路回滚）+ atlas-live-browser.cjs真实GPU验收（512→1024扩容存活像素逐位一致、超maxSize拒绝）；扩容策略原片配文未明说属本地近似。残差：原素材/完整SpriteAtlas接口仍缺。；本轮补残影：release({residue:true})按sprite-pack-c09同口径留×0.38压暗调试残影（乘性混合Zero×OneMinusSrcAlpha，opacity.62），atlas-live-browser真GPU验收gAlpha 294780→112132=0.3804倍。残差收窄为：原素材/完整SpriteAtlas接口仍缺（卡点·B 美术资产，永久卡点，需新证据再立项）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1590674061092212738": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：只记学习完成，实现及运行验收待补，不把已有启发式当原法。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "只记学习完成，实现及运行验收待补，不把已有启发式当原法。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/vegetation.js（静态邻崖近似，原采样法待补）",
          "note": "181帧全核验：全片反差纹理诊断配色，镜头环绕多层岛，草缘随背景变化。原文明说顶点shader采站立处与背景射线的contrast texture差值。当前仅静态邻崖距离aEdge，未实现该GPU采样/背景射线；只记学习完成，实现及运行验收待补，不把已有启发式当原法。；【卡点·A 机制未做】只记学习完成，实现及运行验收待补，不把已有启发式当原法。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1584623053061099520": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "这是建筑真正嵌入地形的缺口，现有房屋生成不等于融合。",
        "nextAction": "补任意建筑轮廓插入与周边地形重新网格化。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
          "note": "453帧全序列复核：线框接缝遍历后切实体屋与整岛；不能从画面证明双线性切洞。保留已有显式双格/整体编辑/工程身份，复测两网格各6栋同World融合通过；本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。；【卡点·A 机制未做】本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1582293326815862786": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "决定生成的场景能否同时满足模块约束与可行走性。",
        "nextAction": "补增量生成与简化导航图互连，而不止独立 WFC 页面验证。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/frontier-candidates.js · wfc.html",
          "note": "434帧核验：是坍缩边缘候选评估/简化导航扩展，不是战役边境，也不等于旧同高区域图。新增只读邻接候选枚举，真实半边、三角/四边格及预算不完整结果；WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。；【卡点·A 机制未做】WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1580846877855338497": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整贴图/体积往返反馈仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整贴图/体积往返反馈仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
          "note": "41帧复核（不是旧注释11帧）：重置→直射→体积→阴影填充。新增0/1/3/6次实景对照与每次平均/最大/相对变化，取消“任意场景第三次后不变”推断。两网格实测变化递减，但不是原片像素误差或普遍收敛证明；完整贴图/体积往返反馈仍缺。；【卡点·A 机制未做】完整贴图/体积往返反馈仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1580845127207387137": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
          "note": "213帧复核：原文SDF距离/UV→mega-texture→六方向体积。新增可选六RGB方向/法线权重、静态命中缓存、太阳有限DDA和切片；真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。；【卡点·C 算法未公开】真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1580835075629133825": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；裁判形因子/暴力参考已迁移并逐位对拍，剩余为原片算法未公开的永久卡点。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：裁判 bouncegi.js 形因子gather+bruteForce+audit 已迁 src/light/surface-bounce.js 并补 tests/surface-bounce-referee.mjs 对拍（directLight/bruteForce 逐位一致、legacy≤1ulp、bounces:2 inPlace≤1e-6）；裁判 makeCanyon/renderRay 为 bouncelab.html 演示专用，本侧由共享World surfaceFieldFromWorld 承接。再立项条件：原片反弹算法公开或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "形因子/参考接口已核销：裁判形因子+暴力参考+audit 迁移并逐位对拍（含裁判第二跳 src===E 别名的 inPlace 复现）；残差=原片算法未公开（卡点·C，永久）、裁判演示岛/渲染器=bouncelab 专用越界项。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/voxel-distance.js · src/light/lightvolume.js · src/light/surface-bounce.js · tests/surface-bounce-referee.mjs · lightvolume.html",
          "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。形因子/参考接口残差核销（2026-11-25）：裁判 bouncegi.js 本有真形因子 F=cosI·cosJ·A_j/(r²+pitch²/4)+蒙特卡洛bruteForce+audit，此前批已迁 src/light/surface-bounce.js（split校准、calibration回物理值1，已接 view-shading surfacebounce）；本轮补裁判对拍 tests/surface-bounce-referee.mjs——同一场 directLight 与 bruteForce/hitRate 逐位一致、legacy gather≤1ulp；实测发现裁判第2跳起 src===E 别名的就地Gauss–Seidel语义，bounce 加 inPlace 选项逐位复现（bounces:2 对拍≤1e-6，默认Jacobi差0.13如实记）；裁判峡谷场上 split r 0.501→0.831、形状误差90.4%→43.2%。裁判 makeCanyon 合成岛/renderRay 2.5D渲染仅 bouncelab.html 演示用，本侧由共享World surfaceFieldFromWorld 承接，无可执行迁移项。剩：原片反弹算法未公开，画面不足以证明逆平方/形因子归属。；【卡点·C 算法未公开】原片反弹算法未公开：配文只说\"first decent attempt to actually have the light *bounce*\"，画面不足以反推逆平方/形因子；裁判形因子/暴力参考已迁并对拍核销，本地近似口径如上 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1579483114178768898": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "这是 Bad North 多格模块与 Townscaper 不规则网格结合的接口，直接影响后续地形/建筑融合。",
        "nextAction": "补全多格 tile 的真实 prefab/socket 和联合约束，而不止几何体量占位。",
        "acceptance": "在四边与混合网格上回归跨格房屋、冲突拒绝、撤回、重生成一致性，核对实际消费者。",
        "sourceGap": "共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
          "note": "177帧已复核；共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完整prefab/socket待续。；【卡点·A 机制未做】共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1579478470098243584": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整原cage/3D碰撞仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整原cage/3D碰撞仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/shape.js · src/terrain/terrainmesh.js · cage.html",
          "note": "272帧全核验，含线框构建/着色/转镜；保留共享切面与保护，修分数层高查询并复用到沉积线，连续角点局部通过；完整原cage/3D碰撞仍缺。；【卡点·A 机制未做】完整原cage/3D碰撞仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1579474420749725696": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "可对齐裁判的部分本轮已迁移并逐位核销；剩余为原片生成器算法与原美术资产未公开的永久卡点。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r215 已迁裁判 engine/islands.js 全管线并逐位对拍（5组参数 h/mat/slope/walkable/findPath/几何 pos+col）+ placeIslandHouses 按裁判 mesa.js 平顶规则联合出屋；剩余=原片三角网生成器/完整坡面/真屋模联合算法未公开（卡点·C）+黄顶小屋美术资产未公开（卡点·B）。再立项条件：原作公开生成器代码/资产或更高清证据。",
        "acceptance": "裁判对拍已核销：5 组参数下 buildIsland h/mat/slope/walkable/walkableCount、findPath 逐格、buildIslandGeometry pos/col 全部逐位一致；placeIslandHouses 由独立行为用例覆盖（确定性/平顶约束/间距/两组互异/非法输入拒绝）；不以页面可开代替验收。",
        "sourceGap": "engine/islands.js 方格岛场已逐式迁移并逐位核销（src/terrain/bn-island-field.js + tests/bn-island-referee.mjs）；小屋联合生成按裁判 mesa.js 平顶规则同款实现（连续场上非逐位）。残差=原片生成器算法未公开（卡点·C）+黄顶小屋美术资产未公开（卡点·B）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/bn-island-field.js · src/terrain/generate.js · cage.html",
          "note": "454帧全核验，片中两组岛线框构建/着色/转镜；r215 裁判库核对核销可对齐部分：REACode engine/islands.js 此前仅静态记为已合并（badnorth/island.js 是另一套共享World近似），方格高度场管线未迁 → 逐式移植 src/terrain/bn-island-field.js（域扭曲fbm+脊线→径向衰减→台地量化→材质分类→可走格→8向A*→顶面+崖裙几何）+ placeIslandHouses（裁判 mesa.js 平顶候选/最小间距/spire 0.35 同款规则联合出屋，连续场按|Δh|≤eps+草顶判平顶内部，非逐位）；tests/bn-island-referee.mjs 5/5：5组参数 h/mat/slope/walkable 逐位、findPath 逐格、几何 pos/col 逐位、两种子两组岛互异。；【卡点·C 算法未公开+B 美术资产】原片配文仅\"I'm back on the island generation\"，三角网生成器/完整坡面/真屋模联合算法未公开不能认证本实现为原作，黄顶小屋美术资产未公开 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1490068909042642944": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/graph-layout.js · grid-graph.html（右栏邻接图）",
          "note": "427帧全核（5张联系表全看+原尺寸回看390）；判出真机制=邻接图的极坐标同心环布局：BFS分层成环、环内按父角度定角、颜色按根分支分连续圆弧；新增adjacencyComponents/radialLayout与grid-graph.html右栏，26环/4分支/同环249跨环1004已验；缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻；【卡点·C 算法未公开】缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1482346496460828674": {
        "priority": "中",
        "workType": "原资产待补",
        "reason": "机制已接实景并过整片运行验收；剩余为原作未公开资产，降权待新证据。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：实景接入与整片运行验收本轮已补（view-shading.js#contrasttex 烘 uShCTMap→shContrast 顶面取色+像素细线；tests/contrast-shading-browser.cjs 页内重解9919抽样texel全同+屏上墨线A/B+开关还原）；剩余残差为原作本人的贴花形状/特征种子/atlas 原资产未公开（卡点·B 美术资产），worldContrastMesh 为本仓等价实现，不把近似当原物。再立项条件：原作公开源资产或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作本人的贴花形状/特征种子/atlas 原资产未公开（卡点·B）；实景接入与整片运行验收已补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/contrast-field.js · src/world/view-shading.js#contrasttex（index.html?scene=fusion&shade=contrasttex）· src/core/c11-maps.js · color-lab.html（三角诊断）",
          "note": "517帧全核验（沿用原记）；图集预览、灰岛上色和两组岛环绕。核旧账：实景接入早已落码——view-shading.js#contrasttex 把 worldContrastMesh+solveContrastColors 烘成 uShCTMap（512²世界XZ图），shContrast 在地形顶面取色、fwidth色差压暗出像素细线；c11-maps 另供草地描边反差图，uv-radial-atlas 复用同一解算器。本轮补整片运行验收 tests/contrast-shading-browser.cjs：10064三角/15012边、同边ΔE13.76→0.10、对比边最小ΔE14.28，上传纹理与页内同参重解9919抽样texel全同，屏上8.2%像素改色+2946墨线像素、同状态噪声0、关掉还原、0 console error（artifacts/coverage/contrast-shading-review.md）。仍缺：原作本人的贴花形状/特征种子/atlas文件未公开（worldContrastMesh 是本仓等价实现）；【卡点·B 美术资产】原作彩色图集/贴花原资产未公开 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1482011744843223042": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原笔触normal atlas与投影接缝仍缺。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原笔触normal atlas与投影接缝仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/normal-contrast.js · normal-contrast.html",
          "note": "384帧全核验；源为程序化normal map反差，不是后续contrast迭代。共享地形材质新增解析法线场/物理像素覆盖局部近似，GPU双网格通过；原笔触normal atlas与投影接缝仍缺。；【卡点·B 美术资产】原笔触normal atlas与投影接缝仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1481661852887265288": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
          "note": "425帧全复核：旋转、线框/重建、法线/SDF/六AO图。补各向异性精确体素中心EDT、保守距离下界步进+DDA兜底，六向距离AO及梯度法线诊断接真实View；不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。；【卡点·B 美术资产】不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1478114309263839244": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核…",
        "sourceEvidence": {
          "status": "partial",
          "where": "textures.html?t=radial（保留圆块近似；UV流程待补）",
          "note": "346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核完成，代码待实现验收。；【卡点·A 机制未做】346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1471817524148940807": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "机制落点已齐（切角轮廓 + 裁判 islandMask 逐位对账的岩岛生成层写共享 World rock 列）并由 tests/rock-island-gen.mjs/rock-island-c08.mjs 锁定，剩余残差为原片完整生成器未公开卡点，r225 核销为永久卡点。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r225 核销——岩岛生成层已逐位移植裁判 squarehex.islandMask 并复跑 4/4 PASS（3种子×32×32=3072 点逐位一致、陆地共边对数=裁判 countAdjacency、台地{2,4,6,8}写 World rock 列、生成→切角闭环 contact 0.5/断边 0），rock-island-c08.js vendor 逐字一致；剩余残差即原片完整岩岛生成器（阶段生长/计时那台）未公开（卡点·C，裁判仓同样只留 islandMask 演示）。再立项条件：原作公开生成器或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原片完整岩岛生成器（阶段生长/计时那台）未公开（卡点·C，r225 核销为永久卡点）；islandMask 生成层已逐位移植并对账，切角轮廓已闭环。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/corner-footprint.js · src/core/rock-island-c08.js · corner-cuts.html · rock-island-c08.html",
          "note": "556帧阶段生成/旋转岩岛。岩岛生成层补齐：裁判 squarehex.islandMask 两档低频噪声+椭圆径向衰减逐点移植（rock-island-c08.js#rockIslandLand/Field/Levels/Generate），3种子×32×32格点与裁判掩码逐位一致、陆地共边对数与裁判 countAdjacency 相等；land 分档台地（{2,4,6,8}层）写共享 World rock 列，接 rockIslandMesh 切角闭环（二分计划接触 0.5、断边 0），格网邻接/导航不动，新测 tests/rock-island-gen.mjs。；【卡点·C 算法未公开】原片完整岩岛生成器（阶段生长/计时那台）从未公开，裁判仓同样只留 islandMask 演示 → 永久卡点，需新证据再立项；r225核销：tests/rock-island-gen.mjs/rock-island-c08.mjs/corner-footprint.mjs/squarehex-island.mjs 复跑 4/4 PASS（裁判对账与生成→切角闭环口径同前），src/core/rock-island-c08.js 与 vendor 逐字 cmp 一致、本批零代码改动；剩余残差仅卡点·C，无可执行残差，永久卡点，需新证据再立项"
        },
        "basis": "r225 残差核销复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1459169210752507904": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "上游 r230 已把补丁内角偏差消到 0°，补丁级刚性目标达成；剩余是缝格过渡带与 family 存根两项局部残差，排在共享结构与组合阻塞之后。",
        "nextAction": "先修 cell.family 换基后未更新的存根（patchLayout spread 读数失真 43.46°），再处理 35 格反向补丁缝：真解是给补丁间重划三角过渡带而不是继续压 scale；偏离三族 >5° 的 5.6% 格随过渡带一并核。浏览器探针（grid-graph.html?mode=patch&rigid=20&square=1）补一轮实测。",
        "acceptance": "cell.family 换基后读数与原片补丁归属一致；补丁缝反向格清零且过渡带三角与原片结构对图核验；浏览器探针跑通并留截图；不以演示页能打开代替完整验收。",
        "sourceGap": "补丁缝 35 格反向（根因=缝上四边格未退化成三角，需重划三角过渡带，约1-1.5轮）、cell.family 仍是换基前存根（maxSpreadDeg 42.68° 失真）、偏离三族 >5° 的格 5.6%",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js#unshearPatches · grid-graph.html?mode=patch&rigid=20&square=1",
          "note": "609帧全核（r229/r230 7张联系表 + 本轮 sheet-01/sheet-05 + 0300 原尺寸）；补丁内角偏差 p50/p90 0.00°/0.00°、拓扑未动（1519/1331/242/512）；方形档首次出运行读数（flips=8 页面参数 / scale 0.886 / roundErr 0，488-200-688 与关档逐项相同）；仍缺：补丁缝 35 格反向（根因=缝上四边格未退化成三角，需重划三角过渡带，约1-1.5轮）、cell.family 仍是换基前存根（maxSpreadDeg 42.68° 失真）、偏离三族>5° 占 5.6%"
        },
        "basis": "本次工程补全优先级判断（2026-11-25 按上游 r231 新记录重评）；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1458921394855718917": {
        "priority": "高",
        "workType": "补来源后实现",
        "reason": "局部拓扑修改需要可验证的数据结构，不能只用互反邻接冒称完整半边编辑。",
        "nextAction": "补显式半边环/顶点扇与编辑接口；原片未公开的指令语义继续标待来源。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js · src/core/adjacency.js",
          "note": "圆内四边形组与彩色剩余区域轮廓、间隙三角网，反复重置铺组/填网；未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。；【卡点·C 算法未公开】未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1448039167057879048": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/stroke-reveal.js · stroke-reveal.html · src/ui/walkthrough.js",
          "note": "952帧全核；4轮循环=管线各阶段错峰逐笔画：三角剖分帐篷(顶点竖棒)→密集顶点阵→逐笔线稿→三角共享边线网→等高线→着色岛；本轮新增stroke-reveal.js(错峰+弧长裁剪)与stroke-reveal.html并跑通两测；仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛；【卡点·A 机制未做】仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1447496205282549761": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js · src/terrain/generate.js",
          "note": "全383帧核验，多个不规则三角底图到分层线框/完成岛例；完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。；【卡点·A 机制未做】完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1447494168448753667": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "当前子格生成与父格映射只是融合网格的基础，联合约束缺失阻塞跨格模块。",
        "nextAction": "补四分子格联合模块约束和真实 3D tile 接口。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js · wfc.html?subtiles=1",
          "note": "全178帧模块库核验；新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。；【卡点·A 机制未做】新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1447488323845509121": {
        "priority": "高",
        "workType": "补来源后实现",
        "reason": "这是自然地形的核心行为，来源不足与机制缺失必须同时说明。",
        "nextAction": "先明确连续软坡/排水的可验收目标，再补对应生成机制；XZ 形变不等价于完整侵蚀算法。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/generate.js · shape.js（软坡/侵蚀保证待补）",
          "note": "656帧全核验：缓坡/硬崖同框、多组生成的稀疏白线/暗轮廓/完整岛与旋转。配文明确侵蚀有效无局部低洼，但画面不能证明该保证；现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。；【卡点·C 算法未公开】现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1447483550257799171": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/generate.js · src/core/contour.js",
          "note": "565帧全核；44s循环showreel：彩色岛（暗岩块+蓝河网+岩柱）↔切黑后白线逐笔累积成岛轮廓，每轮岛形态不同=连续程序化生成；本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线；【卡点·A 机制未做】本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1430227487376781317": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/palette.js · src/build/buildings.js（无 surface 图集）",
          "note": "279帧全核；判出真机制：全城建筑共用一张总贴图 TownColor.png（PS 标题栏 200% Layer0 RGB/8 证实），改这张图即整城换肤（0207后墙面屋顶全变蓝涂鸦）；本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换；【卡点·B 美术资产】本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1430224300003545091": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差，永久卡点：瀑布/水花/烟/墨线/impostor 等运行时效果不进几何导出，水面噪声/平面反射与植被风摆是着色器态；原作 mesh exporter 内部格式未公开，.mtl 为近似 Kd 不冒充原作格式。r223 已补：场景 OBJ+MTL（主体/水面/植被分组）真实下载 + Blender 5.2.2 导入验收（0 警告）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "第三方DCC及水/植被/材质尚未验收。",
        "sourceEvidence": {
          "status": "done",
          "where": "src/tools/objexport.js（sceneToOBJ/sceneParts/downloadSceneOBJ）· index.html#exportscene · src/world/app.js",
          "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。；【卡点·A 机制未做】第三方DCC及水/植被/材质尚未验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r223 核销残差：objexport.js 增 geometryData/bakeInstances/sceneToOBJ/sceneParts/downloadSceneOBJ（实例矩阵烘焙植被+逆转置法线+instanceColor/aColor逐实例色、mtllib+o/usemtl多对象+跨部顶点去重、缺法线补占位vn防v//vn索引错位——首版在Blender下暴露Invalid normal index已修）、index.html#exportscene+app.js 双文件真实下载；.mtl每对象近似Kd（town白留顶点色、water=片元0.55混色、植被=实例色均值）。mixed/quad下载obj+mtl（11.8/11.5MB）独立解析：town 10916/12185面逐坐标一致带RGB、water 2面贴y≈0、flowers 24/30、shrubs 13200/12000逐实例色；Blender 5.2.2后台导入两档0警告、对象/材质逐一对上（blender-import-r223.txt）。瀑布/特效/风摆/impostor替身不导出、mtl为近似Kd不冒充原作格式"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1427721874490933250": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/blotch-pattern.js（斑块/贴花）",
          "note": "188帧全核；判出真机制：每帧累加方块贴花导致 line boil（贴花密集处相邻帧差分 mean 5.4→7.3），且需图集 padding；本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了；【卡点·A 机制未做】本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1401145625572425728": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/worldmesh.js · src/tools/mesh-audit.js · save-mesh.html",
          "note": "349帧全核验。README是Switch动态合批不足后自写mesh merger；视频线框/着色不能独立证明三倍性能。保留既有WorldMesh分块缓存后拼成单一主体，新增真实GPU主体提交诊断；双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。；【卡点·E 环境不具备】双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。 → 卡在环境（job/线程、主机性能基线），本机实验页验不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1384958097542819845": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：游戏手柄/连刷仍未接入。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "游戏手柄/连刷仍未接入。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/grid.js · grids.html?t=lines",
          "note": "679帧全核验；有向格/出边判环、停止原因和真实中点段局部验收通过；游戏手柄/连刷仍未接入。；【卡点·D 需接主管线】游戏手柄/连刷仍未接入。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1371460793032716290": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/palette.js · src/world/app.js · wall-palette.html",
          "note": "524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。；【卡点·A 机制未做】新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1344290848180203523": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r222 核销——漏面/悬空支撑断言已建（exposedWallFaces 枚举+auditSurfaceCoverage 3×3采样点投影覆盖+auditUndersideSupport 拱/平底/钢柱顶点判定），四反例全被抓且抛错还原、双网格浏览器0未覆盖/0失支撑、live qa-monkey 120步双网格全过；残差=卡点·C 原片QA算法未公开、采样覆盖非流形/视觉等价。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原片QA算法与完整几何/视觉等价验收不可复现（卡点·C）；漏面/悬空支撑断言已由 r222 建立。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/qa-replay.js · src/core/qa-monkey.js · qa-replay.html",
          "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。r222 残差核销——漏面与悬空支撑补断言：exposedWallFaces 枚举已建外露墙带（quad 362/mixed 332 带），auditSurfaceCoverage 每带3×3采样点靠墙平面投影覆盖（默认镇3258/2988点全满），auditUndersideSupport 按 underside() 同规则判拱/平底并核角点钢柱；接入 runWorldQA 逐步与 runMonkeyQA 核对点（qa-replay.js/qa-monkey.js 均不引 three），tests/qa-replay-r222.mjs 删整带/抽平底/抽钢柱/拆拱腹四反例全被抓且抛错后还原，浏览器双网格16步未覆盖0/失支撑0、页内手工拱+钢柱配置全过；vendor 逐字拷入 qa-replay.js+qa-monkey.js（import闭包自足）。残差=原片QA算法未公开，采样覆盖非流形/完整几何或视觉等价验收。；【卡点·C 算法未公开】原片QA算法与完整几何/视觉等价验收不可复现 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1338829205157646336": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/sphere/planet.js · planet.html?stage=tri",
          "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。；【卡点·A 机制未做】区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1338825080844021760": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/sphere/planet.js · planet.html?stage=tri",
          "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。；【卡点·A 机制未做】区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1313837640366596096": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺飞行操控、船壳外沿白色构件、建筑随岛抬升",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺飞行操控、船壳外沿白色构件、建筑随岛抬升",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/loop-lift.js · loop-lift.html",
          "note": "315帧全核（4张联系表+2张原尺寸）；完美环判定已有，新增 loop-lift：环内格抬升场+船壳厚度+等距支撑腿（3环/最大119格/11腿/船壳0.90）；缺飞行操控、船壳外沿白色构件、建筑随岛抬升；【卡点·A 机制未做】缺飞行操控、船壳外沿白色构件、建筑随岛抬升 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1310503825510367232": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/mixed-perspective.js · mixed-perspective.html",
          "note": "200帧全核；原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→远处照旧变小。新增src/core/mixed-perspective.js+实验页四块同尺寸标尺，帧缓冲量得k=1上下沿等宽/竖边横移0px、宽度88→47仍递减，k=0与普通透视逐值相同。缺：主视图view.js未接(k=0默认)、pick/倒影相机矩阵未同步、原版Unity移轴逐像素未对；【卡点·A 机制未做】原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1305951750638231552": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。",
        "sourceEvidence": {
          "status": "done",
          "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/penumbra-terrain.js · src/world/view.js · penumbra.html",
          "note": "521帧全核验。本轮按残差补全：a) 洞/悬挑/形变表面接 bakeVoxelPenumbra 体素接收面（PenumbraTerrain），真实双网格 6876/5050 接收者、多接收者柱 12/10，开关/转太阳/dispose 通过；b) 半影宽度按裁判参数化（权重 [.8,.34,.44]、内收 +0.7 体素、带 .10–.50 封顶12），normal/pulled 与裁判逐格一致，bigSlopeScale=1/3 复现裁判带宽 ±8%，其粗格坡率尺度差默认不照抄。如实：侧墙半影仍缺、形变面 ±L/2 近似、无原片逐像素宽度对照。"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1302686201401442309": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×)",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×)",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/infinite.js（verify 拉伸度量）· grids.html（网格实验室 无限网格）",
          "note": "241帧全核；画面就是bug现场：翻折块塌成深色皱褶、非翻折邻块被拉长成跨块巨块。verify()原只查翻折/接缝，量不到第二种症状，本轮补了以本格原始点阵为基准的拉伸度量(maxStretch/minShrink/maxEdgeStretch/stretched)并在grids.html显示；实测passes60时翻折0、拉伸最大1.83×、无格超2×；还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×)；【卡点·A 机制未做】还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×) → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1301816247479345152": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/radial-patch.js → World / WorldMesh；gridpatch.html",
          "note": "324帧复核：是六边形外轮廓中的规则四边格/放射模板与环形庭院，不是正六边形格子。补单个星形孔洞的规则内环/过渡四边格并复用原边界。48组25通过23明确拒绝；多补丁/完整手工库、填充世界迁移待补。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。；【卡点·A 机制未做】见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1290997501332525056": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：细石板宽度、门口优先和中心装饰仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "细石板宽度、门口优先和中心装饰仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/garden-paths.js · src/build/buildings.js",
          "note": "187帧全核验：院落封闭转草坪、门洞通路/横向小径和中心装饰；原文只说新增garden paths。修本地PCA窄带筛格可能断路，改主轴端点+院内邻接BFS，90种连通占用/环洞/双网格真实World通过。保留既有墙边灌木；细石板宽度、门口优先和中心装饰仍待补。；【卡点·A 机制未做】细石板宽度、门口优先和中心装饰仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1279107097108635649": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "当前调试统计只有 27 类且部分构件未分色；要先能审计覆盖，不能用“545”当已实现数量。",
        "nextAction": "补可追溯的零件目录与完整部件签名显示；将真实模块覆盖和原作 545 件资产差距分账。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 module…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/build/buildings.js（moduleSig/sigColor） · src/ui/environment-panel.js「模块签名配色」",
          "note": "256帧全核；把拼图块平铺在网格上飞行巡览，同一种邻接签名同色（原文545块）。签名算法与片子口径一致(n/上下层/逐边实心)，但只给墙身上色(底座/屋顶/窗饰仍原色)，没有零件目录页；本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 modules 开关加进场景面板，截图对比确认墙面分色；【卡点·A 机制未做】本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 module… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1275089608758484992": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/render/opening-punch.js（rise 拱顶洞口）· src/core/ladder-profile.js（竖梯，已有）· opening-punch.html",
          "note": "369帧全核；原文说的church doors与ladders都拍到了：竖梯(双梁+约14横档，水面爬到高脚楼底)本仓ladder-profile.js已有；教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析面积/命中/像素账/ShapeGeometry挡模板)，还缺接进buildings.js与页面第四栏、洞内墙面与台阶；【卡点·A 机制未做】教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1260586697538113537": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "残差为永久卡点（原片未公开元数据/导演镜头与剪辑节奏）；无新证据不再立项，仅保留现状回归。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "导演镜头轨迹/剪辑节奏录制与逐动作元数据原片未公开（原片固定临水镜头；永久卡点，需新证据再立项）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/snapshot-replay.js · src/core/edit-fx-schedule.js · src/world/view.js · src/world/worldmesh.js · src/world/app.js",
          "note": "167帧全核验（历轮sheet/裁切证据沿用）。「动作特效」可做的部分本轮收口：撤销/重做/历史回放本就走 worldMesh.edits 体素差分→effects.onEdit（弹性弹出/落水水花/拆除灰尘）+sound.onEdit 音效（r56已验）；本轮补三处真差距——①单笔快照超40格时 edits 被静默吞掉：worldmesh.editFxLimit 可配，回放期 app.js 放宽到600并 finally 复原；②一帧多格全堆同一时刻：新增 core/edit-fx-schedule.js 变心径向波确定序错拍（快照只有整笔颗粒度、笔内拖动顺序不可恢复→径向波近似原片依次生长，0.045s间距、maxSpan1.4s压缩）+view.editFxQueue 到期才喂 effects/sound；③无可关档：setDebug('editfx')/?editfx=0 整层丢帧。新测 tests/edit-fx-schedule.mjs：径向序/时序界/40吞·600全发/回放60弹出·60水花·30灰尘·finally恢复最终态；snapshot-replay-fx-r56.mjs 改断新接线后复绿。；【卡点·B 美术资产】导演镜头轨迹/剪辑节奏与逐动作元数据原片未公开（原片为固定临水镜头） → 永久卡点，需新证据再立项"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1258421104756097029": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/effects.js · index.html（建造/拆除触发）",
          "note": "436帧全核；落水/拆到水面触发水花：现有实现=1圈泡沫环(1.1s)+26颗飞沫(重力-5.5、落水即灭)，事件口径与片一致但只压到一半观感；片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命；【卡点·A 机制未做】片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1257213678056857600": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/build/buildings.js（legs 段） · architecture.html",
          "note": "296帧全核；9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片中红屋右下角那根斜接到下方白屋屋脊的长斜杆本仓没有，腿也不会随下方支撑点水平偏移而内倾，高脚塔的通长腿还缺分段/接头表现；本轮未改代码；【卡点·A 机制未做】9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1246074663546916873": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "新记录量出了时间签名（消失 3 帧≈0.09s；出现过冲 1.372× 后 4 帧≈0.12s back-out 回落），验收第一次有了可测数值；稳定道具键/保留消失几何/逐道具缩没仍缺。错峰片中证不出，不列入。",
        "nextAction": "给道具加稳定键（格位+道具类型），布局变化时：新出现道具按 0→1.372× 过冲、约 0.12s back-out 回到 1×；消失道具保留几何，约 0.09s 缩没后再删除；不做错峰（原片整组一帧切换）；src/propanim 映射写明覆盖范围。",
        "acceptance": "用例：同布局重算道具键不变；出现曲线峰值≈1.37 且 0.12s 内回到 1；消失道具 0.09s 内保留几何后缩没；与原片 0223→0224、0260→0261 帧对照；不以演示页能打开代替验收。",
        "sourceGap": "稳定道具键、保留消失几何、逐道具缩没未做；错峰原片证不出。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/effects.js · src/propanim 映射（部分覆盖）",
          "note": "306帧全核（4张联系表+原尺寸0157/0217/0258/0260）；本轮量出出现/消失的时间签名：消失 0223→0224 一帧 7077→86 绿像素、3帧≈0.09s 走完残影；出现 0260→0261 跳到 9717（稳定 7085 的 1.372×）再 4帧≈0.12s 单调回落=过冲 back-out；单件道具错峰片子里证不出（整组一帧切换）；代码仍缺稳定道具键/保留消失几何/逐道具缩没，本轮未写码"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1243228419162341379": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：水/植被/远云影/模糊未完成。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "水/植被/远云影/模糊未完成。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/vegetation.js · src/life/impostor.js · clouds.html · src/light/cloud-shadow.js",
          "note": "489帧全核验；修复远云固定时钟，连续环带/远平面深度避免盖建筑；首页独立开关。双网格GPU/三场局部通过，原片高耸云体/层次、真实风平流仍缺。 后续迁移：可选三组逆深度角速度接实际远云，GPU读回/开关通过；云影/模糊/完整三层仍缺，不重计489帧。 本次共享近云同图集世界高度投影/首页开关GPU局部通过；水/植被/远云影/模糊未完成。；【卡点·A 机制未做】水/植被/远云影/模糊未完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1242824460325052417": {
        "priority": "低",
        "workType": "接入实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/playful-layout.js · ui.html",
          "note": "383帧全核验。按键/种子确定轻微倾斜，旋转AABB限制间距，只改视觉层、原生按钮命中槽稳定；换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。；【卡点·D 需接主管线】换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1241096929490149376": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/texel-skip.js · textures.html",
          "note": "302帧全核验：同机位砖石小镇，细线/粗线效果反复切换；137附近拉远、251附近拉近。原文仅说明采样前UV加速经过隔像素线，不说明确切公式。原硬切函数改共享连续重映射+线性采样，6档CPU积分/4档真实GPU验收；仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。；【卡点·A 机制未做】仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1241046107125399552": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共…",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
          "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共用atlas，原作植物素材与所有植物种类仍待迁移。；【卡点·B 美术资产】原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1238474550511308800": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "剩余残差为来源不足部分，不可把推测当原算法：原作沿小径自动布矮墙的精确选线/半圆拱细节（本地近似在 yard-r56 planYardWalls）、形变边界、全部植物素材（卡点·C 算法未公开 + 卡点·B 美术资产，永久卡点，需新证据再立项）。墙层开口分型/桥不封院/矮墙分区记录本轮已做并测。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "墙层镂空/地面开口/桥跨不封院/矮墙分区记录已通过（本地离散近似）。未复现：原作矮墙自动选线与精细拱门、形变边界与全部植物（卡点·C 算法未公开 + 卡点·B 美术资产）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/courtyards.js · src/build/buildings.js · garden.html",
          "note": "202帧全核验。共享classifyCourtyards按地面上实际第2层实心判封边；本轮补两件可验残差：①开口按真实墙层分型——ground-opening（街/水/岩整列空）与 wall-layer-gap（第2层缺、更高层仍有实心=桥/悬空屋顶跨过，bridge标记+openLayers逐层账），上层桥跨缺口不封院；②lowWalls选项——高度<1层的矮墙边只分区不封院，封闭组件内按给定矮墙边重切连通子区写入subregions+lowWallEdges。双网格（quad/mixed）封闭→桥跨开口→矮墙分区→重封闭全过。规则为本地离散近似；仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。；【卡点·C 算法未公开】仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1215644531221311488": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：GPU/双网格通过。未复现全部块面艺术与岸裙尺度。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "GPU/双网格通过。未复现全部块面艺术与岸裙尺度。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/reflection.js · src/world/view.js",
          "note": "270帧全核验：彩色中间倒影/宽岸裙，160起倒影与建筑线框。保留共享WorldMesh翻转，补实际水面上方裁切、受限深度淡出及线性颜色中点模块；GPU/双网格通过。未复现全部块面艺术与岸裙尺度。；【卡点·B 美术资产】GPU/双网格通过。未复现全部块面艺术与岸裙尺度。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1215642481162887168": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "机制落点已齐（水上码头/钢腿泡沫锚点/跨水拱精确拱底/岸线闭环与倒影）并由 tests/water-town.mjs 锁定，剩余残差为原片美术资产卡点，r221 核销为永久卡点。",
        "nextAction": "无可执行残差，永久卡点（需新证据再立项）：r221 核销——机制落点已由 tests/water-town.mjs 四场景锁定并复跑全过（水上码头/钢腿泡沫锚点/跨水拱精确拱底/种子镇seed330），机制五文件 vendor 逐字一致；剩余残差即完整建造美术（卡点·B，原片贴图/模型/动画稿无源素材，程序化只能近似，本地 voxel-ghost/pop 动画为近似不冒充原片）。再立项条件：原作公开美术资产或更高清证据。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "完整建造美术仍缺（卡点·B，r221 核销为永久卡点）；机制落点与真实双网格2→1闭环/恢复小镇均通过，拱底精确截面旧账已随 arch-profile 批落码。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
          "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。2026-11-25残差核账（tests/water-town.mjs 四场景锁定）：水上码头=1层灰石基座自y=0入水外鼓+压顶铺地+临水栏杆；水上悬浮块=钢腿端停y=0水面、逐角posts锚点交shore.js画泡沫圈；跨水拱=两对边1层码头支撑悬浮块→archFloorBudget(floor=0)+archProfile解析椭圆，端点/拱顶精确、形变误差有界——旧账「拱底精确截面」已随arch-profile批落码属过期；种子镇seed330一次齐出码头/拱/后院/水上钢腿房。真实双网格2→1闭环及恢复小镇保留（shore-topology-review.md）。完整建造美术仍缺。；【卡点·B 美术资产】完整建造美术仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r221核销：tests/water-town.mjs 四场景复跑全过、机制五文件（shore/shore-loops/townDemo/arch-floor-budget/arch-profile）vendor 逐字一致；剩余残差仅「完整建造美术」=原片未公开资产，无可执行残差，永久卡点，需新证据再立项"
        },
        "basis": "r221 残差核销复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1205422438437273601": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "模板挖洞机制已确认并有 GPU 断言；但墙仍是无限薄的面、门窗在主管线里还是贴片，建筑近景的洞深没有。",
        "nextAction": "给墙体加厚度与洞口侧壁，再把 opening-punch 接进 buildings.js 主管线替换 archedEntry 贴片。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺墙体厚度与洞口侧壁；未接 buildings.js 主管线（门窗仍走贴片）",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/render/opening-punch.js · opening-punch.html · tests/opening-punch-arch-browser.cjs",
          "note": "390帧全核（本轮复看 sheet-00/01/03）；确为模板挖洞不是贴片——洞口区墙体拒绘、室内橙球透出且随镜头有视差；本轮补跨两层高拱龛的页面入口与 GPU 断言（龛高=2×楼层 1.0、rise.30、下层透出 1.0000/上层 0.9999、拱肩 2838px 泄漏 0、面积误差 0.1%、方洞那排回归 11洞口/2门不破）；仍缺 墙体厚度与洞口侧壁（墙是无限薄的面，近景无洞深）、接 buildings.js 主管线（门窗仍走 archedEntry 贴片）"
        },
        "basis": "2026-11-16 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1205420678859632640": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "剩余残差即原作手绘轮廓（卡点·B，无源素材，程序化只能近似），无可执行残差（永久卡点，需新证据再立项）；已补项保持测试回归，浏览器/vendor 接入按管线另行验收。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原作手绘轮廓仍待补（卡点·B 无原资产）；阴影caster/远景impostor 已补：leaf-depth.js 同源深度材质、leaf-impostor.js 交叉面片+updateCrownLOD 距离阈值",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/leaf-depth.js · src/life/leaf-impostor.js · vegetation.js",
          "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；本轮补匹配的阴影caster（leaf-depth.js：树冠customDepthMaterial与彩色材质同源——同共享图集/同视角alpha判据（视角=正交阴影相机）/同风摆，浏览器leaf-depth程序真实编译）与远景impostor（leaf-impostor.js交叉面片×共享32²图集+updateCrownLOD距离阈值，地形岛实测79树近40/远39分档、图集单例不分裂）；原作手绘轮廓仍待补。；【卡点·B 美术资产】原作手绘轮廓仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1205416648397721601": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/opening-footprint.js · src/build/buildings.js",
          "note": "261帧完整建屋/编辑，非旧注释6帧空格变面。保留既有正矩形门窗，修放置只计框宽遗漏1.6倍窗台外缘；2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。；【卡点·A 机制未做】2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1201179450668441600": {
        "priority": "低",
        "workType": "接入实现",
        "reason": "等墨量图标已有页面入口和读回验收；剩余是原作图稿和撤销 / 重做 / 退出的游戏语义，需要接主管线，属于界面收尾。",
        "nextAction": "等主管线有撤销 / 重做 / 退出动作后再接这三个图标的语义；原作图稿缺失按来源不足记录。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺原作图稿与撤销 / 重做 / 退出三项的游戏语义（需接主管线）",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/ui/icon-toolbar.js + src/ui/icon-ink.js · ui.html（图标页签的等墨量对照行）",
          "note": "306帧全核；本轮补页面入口+运行验收：ui.html 图标页签新增「等墨量对照」，DEFAULT_ICONS 的 8 个描边路径经共享工具条反解线宽，浏览器读回 8/8 内联 SVG、线宽1.55–2.45（逐个不同）、墨量离散度0.296→0.199→0.037，零 pageerror；仍缺：原作图稿与撤销/重做/退出三项的游戏语义（需接主管线）"
        },
        "basis": "2026-11-16 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1200520827898343425": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：PNG/完整原接口与持久化仍待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "PNG/完整原接口与持久化仍待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/palette.js · wall-palette.html",
          "note": "200帧全核验，墙色由鲜艳到灰米，屋顶仍橙红；画面不足以证明原注释1.5秒/最短色相公式。新增可选本地HSL短弧过渡及无彩色端点处理，真实墙色滑杆双网格通过；PNG/完整原接口与持久化仍待补。；【卡点·A 机制未做】PNG/完整原接口与持久化仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1198957499027795969": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "r226 补全第四可选尾段（UI 段）：工具/色槽/镜头/选中态/撤销与重做栈（各≤8 条+截断位）入档，saveMeta.ui 出站、app.js applySaveMeta 回位，save-ui/meta/atomic/river-flow/splice/house-project/multicell 回归全过；可执行残差已闭环。",
        "nextAction": "无可执行残差，永久卡点（原作位流格式与 Switch 性能无源可对照，需新证据再立项）；保持 Node/浏览器回归（tests/save-ui.mjs 等）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原作 v5 位流格式与 Switch 性能无源可对照（卡点·C）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/save.js · src/world/app.js · save-mesh.html",
          "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。本地v5补第三可选尾段（标志链末节+3b metaVer）：调色板（预设序号或自定义色数+24b RGB）与玩法/天气状态（光照时段/北境主题/flatRoofs等五世界开关/雪雾/雾浓度流速/风向）入档；解码回写world.palette与开关，视图侧字段经world.saveMeta交调用方，app.js读档与game-ui菜单Load即应用，编码meta缺省回落saveMeta→解完原样再编逐位一致；旧串尾零→三标志全缺席照读不误判，新串喂旧解码器按「多余数据」拒收保岛；体素色槽上限改按解后生效调色板验。tests/save-meta.mjs新增+save-atomic/river-flow/splice-save-undo/house-project等回归全过。；r226 补第四可选尾段（标志链末节 UI 段）：工具/色槽（3b+5b 固定）/镜头（target 3×14b×0.05、yaw 11b、pitch 8b、distance 10b）/选中态（W 位升序格号表）/撤销与重做栈（各≤8 条+截断位，条目=体素游程块+嵌入房+选中态）入档；体素游程与嵌入房读写提为共用助手供主段与条目复用；解码经 world.saveMeta.ui 出站、app.js applySaveMeta 把工具/色槽/镜头/选中态/撤销栈种子回位（sceneStart=0 供回放），编码 meta.ui 现取现传、saveMeta.ui 回落解完再编逐位一致；旧串照读不误判、新串喂旧解码器按「多余数据」拒收（tests/save-ui.mjs 内置旧尾链模拟器实测）；取舍如实记=撤销栈整快照只带最近 8 条/栈（体量约束）、多格实例登记不进分享串（与主段 restore 一致）。tests/save-ui.mjs 新增+save-meta/atomic/river-flow/splice-save-undo/house-project/multicell 回归全过；【卡点·C 源证据】原作位流格式与Switch性能无源可对照 → 永久卡点，需新证据再立项"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1197909675443916803": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "r208 裁判参数量化已落地；本轮 vendor 接入跑通（补 wfc.js 断链）+ 隔离浏览器对拍完成：多跳染色 .62/.55 档可观测、庭院草实景可见；残差即源资产级逐像素视觉（卡点·B）。",
        "nextAction": "残差即卡点·B 原片美术资产级逐像素视觉，无可执行回补，无可执行残差（永久卡点，需新证据再立项）；保持 Node/浏览器对拍回归（tests/light-bounce-bake-browser.mjs）。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原片逐像素视觉与源资产不可复现（卡点·B）；town-visual.js 库新文件、vendor 无副本亦无消费方。vendor 已接、浏览器对拍已完成。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/town-visual.js · src/build/courtyard-grass.js · src/light/bake.js · src/build/buildings.js · wall-palette.html",
          "note": "456帧全核（沿用）。r208 用只读裁判 REACode 把四子项参数化：STYLE/BUILD 重叠22键逐字节相等+BUILD补path #a49c8a；colorgamut 屋顶/草地 HSV 色容体入 town-visual.js（裁判 STYLE 屋顶色 v=0.878 超包络 0.86 如实记录）；封闭院全格草/矮墙子区照长/开口零草/径叠草上入 courtyard-grass.js 并接入 buildings.js（小径格改草底+暖灰径面）；裁判多跳 diffuseBounce 同式 diffuseAir+airGain .55/bounce .62 opt-in 进 bake.js 与 setBakeLighting，单跳默认零变化。Node 侧 tests/town-visual-referee.mjs PASS+28 套件回归。R-接入批：vendor 四件（buildings/courtyard-grass/bake/worldmesh）与库逐字一致，游戏经 morrisTownStage→vendor worldmesh→buildBuildings/bakeLighting 真实消费；接入核对抓出断链——新 buildings.js 拉起 surface-decoration.js→core/wfc.js，wfc.js 漏拷曾致 index.html 动态导入 404、游戏启动全灭，已逐字补入后全树 0 缺失引用；__tmMorrisStage.worldMesh.setBakeLighting 页内可调（游戏侧暂无调用方，opt-in API）。浏览器对拍（隔离上下文，页内 world.fill 搭封闭庭院测试镇不写存档）：grassPlan enclosed=1/grassCells=46、庭院草环+小径叠面实景可见；bounces:1→3 顶点色 21746/22497 变（96.66%）、93.59% 向暖偏移、maxΔ0.401/meanΔ0.122；屏幕像素差 2.327% vs 同档噪声底 0.249%，暖色像素 3.97% vs 0.22%，差分集中彩墙立面与庭院边；回 bounces:1 顶点色逐字节复原。结论：.62/.55 opt-in 档下多跳染色可观测（裁判所记 0.42 档 1.8% 像素仅指显式降回旧强度）；重建 33ms。残差=原片逐像素视觉与源资产不可复现；town-visual.js 为库新文件、vendor 无副本亦无消费方。；【卡点·B 美术资产】原片逐像素视觉与源资产不可复现（贴图/模型/动画/UI 稿无源素材），程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1191990107785572352": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生…",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/vegetation.js · src/core/anchored-billboard.js · billboard-anchor.html",
          "note": "316帧全核验。新增可选实例轴固定中心的草卡片对照，沿用默认旧模式；四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生命周期仍待接，不冒充草卡片已等价原灌木。；【卡点·B 美术资产】四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1189902695303458816": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/build/buildings.js（保留已有钢架；本批仅学习）",
          "note": "296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收；【卡点·A 机制未做】296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1181464374839521280": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "门窗视觉贴片不足以支持完整建筑与碰撞/通行组合。",
        "nextAction": "补跨格整墙与实际门窗洞口，并约束独立装饰的接口。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "跨格整墙/真正洞口仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/building-components.js · src/build/buildings.js · building-components.html",
          "note": "全帧核验；悬空/跨层组件独立身份已接实际窗型，双网格通过；独立装饰WFC仍缺 旧片续作：六类1–3槽墙段WFC/实绘百叶与装饰圆拱接实际建筑，双网格局部验收；跨格整墙/真正洞口仍缺。；【卡点·A 机制未做】跨格整墙/真正洞口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1178731576982724611": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "r193 重看纠正了范围并补上码头护墙（quayWalls）：临水缺墙层不再整块丢弃，院格 12→36、草格 9→25，默认档读数不变；剩余是地块尺度偏碎与片尾调试视图归类，属打磨项，画面可见、非阻塞。",
        "nextAction": "先核 courtyards.js classifyCourtyards / buildings.js 现有落点，再补两条残差：片中央一整片大田的地块尺度（maxPlot 5 格偏碎，对原片大田观感量化对照）；片尾 0260–0332 部位色块调试视图归入 debugParts 同类、不当草地参照。高层台地 grassPlot 若仍无独立实现，按坡口留石边带口径补，不加树（原片无树）。",
        "acceptance": "用例：quayWalls 回归保持院格/草格读数（默认档 12/2/9 不变，quayyards 档 36/2/25）；大田尺度有独立行为用例；buildings.html / view-c07 同机位与原片 0000–0259 段对照截图；不以演示页能打开代替验收。",
        "sourceGap": "地块尺度偏碎（maxPlot 5 格 vs 原片大片田）；片尾 0260–0332 调试视图未归类；高层台地 grassPlot 独立实现待核。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/courtyards.js#classifyCourtyards · src/build/buildings.js · world/view-c07.js ?c07=quayyards · index.html?scene=town",
          "note": "333帧全核（4张联系表本轮重看+0000/0095/0250原尺寸）；真缺口核实成立：classifyCourtyards 把临水边当缺墙层→贴岸空地整块丢弃（默认场景院格12、开口组件8、最大一块117格55边朝水）；本轮补 quayWalls（水侧=码头护墙算封边，街道缺口仍算开口）+ ?c07=quayyards；读数 院格12→36、地块2→10、草格9→25、开口8→2、quaySealed 89；新测 quay-yards-plots-browser PASS、courtyards.mjs 与 garden-paths-door-first-browser 回归 PASS（默认档 12/2/9 不变）。仍缺：地块尺度（片中央一整片大田 vs maxPlot 5 格偏碎）与片尾分色视图不含草地分区"
        },
        "basis": "本次工程补全优先级判断（2026-11-23 按上游 r193 新记录重评）；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1168571866405097472": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原GPU重投影/动态纹理仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原GPU重投影/动态纹理仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
          "note": "551帧全核，保留分层烘焙，已有实际遮蔽/反弹分离对照及恢复验收；本轮补单次烘焙逐顶点通道分离读数：bakeLighting({channels}) 输出 ao/bounce/air/sun 四通道，≤1e-6 重构顶点色，与仅遮蔽/仅反弹参数隔离两次烘焙逐值一致、裁判 bakeVertexAO 同式线性可分（tests/ao-split-channels.mjs）；原GPU重投影/动态纹理仍缺。；【卡点·A 机制未做】原GPU重投影/动态纹理仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1163836000688365571": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "现有 2D 等值线不是 3D marching cubes，属于被演示接口掩盖的核心机制缺失。",
        "nextAction": "补不规则格上的 3D 等值面查表、歧义消解、顶点焊接与真实生长过程。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（c…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/contour.js（2D marching squares）· contour.html；缺 src/core/ 下 3D 等值面模块",
          "note": "353帧全核；判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（contour.js，见1120036868966502401），缺3D 256情形查表+顶点焊接+生长动画，本轮不写代码；【卡点·A 机制未做】判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（c… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1151137783785771008": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "窗口平移与接缝已有浏览器断言；真流式加载是网格线向「无限」这一代的核心，后面的混合网格和多格模块都建立在它上面。",
        "nextAction": "做按需加载 / 卸载的流式窗口（不再一次最多 19 块），并补块内疏密均匀度指标。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺真流式加载（页面一次最多 19 块）与块内疏密均匀度指标",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/infinite.js · grids.html?t=infinite（平移窗口 + windowSeam 读数）",
          "note": "449帧全核；本轮补页面入口+运行验收：grids.html?t=infinite 新增 origin 平移（6 方向 patchStep）+ 回原点，每次平移用 windowSeam 量重叠顶点，三次同向+一次反向 compared 781/771/771、最大差 ≤7.9e-15、翻折0/非法0（浏览器断言已跑）；仍缺：真流式加载（页面一次最多19块）与块内疏密均匀度指标"
        },
        "basis": "2026-11-16 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1120036868966502401": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：703帧中本轮重看sheet-00全100张；补最后一段硬缺口：窗口接选中态（quad-lattice.boundsForCells/mergeBounds/selectionBounds + view.setGridWindowForSelection/builtCluster + grid-debug 点击拾取），grid-window 13项/浏览器34条全过；仍缺与真编辑器撤销/多选联动",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "703帧中本轮重看sheet-00全100张；补最后一段硬缺口：窗口接选中态（quad-lattice.boundsForCells/mergeBounds/selectionBounds + view.setGridWindowForSelection/builtCluster + grid-debug 点击拾取），grid-window 13项/浏览器34条全过；仍缺与真编辑器撤销/多选联动",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/quad-lattice.js boundsForCells/mergeBounds/selectionBounds · src/world/view.js setGridWindowForSelection/builtCluster · grid-debug.html 点击选中",
          "note": "703帧中本轮重看sheet-00全100张；补最后一段硬缺口：窗口接选中态（quad-lattice.boundsForCells/mergeBounds/selectionBounds + view.setGridWindowForSelection/builtCluster + grid-debug 点击拾取），grid-window 13项/浏览器34条全过；仍缺与真编辑器撤销/多选联动"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1097458505315946496": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：两侧细分未实现。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "两侧细分未实现。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/frontier.js · campaign.html",
          "note": "已学14帧续项：外围padding、避让节点的边中点通路、自适应Bezier采样通过96条逻辑/24项页面；两侧细分未实现。；【卡点·A 机制未做】两侧细分未实现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1092709665199345664": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/effects.js · src/life/smoke.js · src/life/banner.js（缺口：一次性爆炸编排 explodeAt）",
          "note": "474帧全核；判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、火球靠effects.js粒子池，缺explodeAt时序编排与焦痕贴片，本轮未写代码；【卡点·A 机制未做】判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1016680972610359298": {
        "priority": "低",
        "workType": "接入实现",
        "reason": "三条游戏语义残差本轮已闭合（地面标记、单Move真下令路径、swap互换）并经 Node+浏览器+像素A/B 验收；剩余为原片钮图稿素材级近似，无工程残差。",
        "nextAction": "残差已闭合：地面标记（battle-c03 目标格白环，确认/取消/关档全收）+ 单 Move（confirmAction 重放 battle.onPointer，navigation.pick/plan→goal/goalFloor 同一条真下令路径，plan 打回不改 goal）+ swap（两队 goal+goalFloor 双向换）+ cancelPopup Esc；无可执行残差（原片钮图稿为素材差）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原片钮图稿与标记形制为程序化近似（素材差）；单Move/地面标记/移动交换三条已闭合",
        "sourceEvidence": {
          "status": "done",
          "where": "src/badnorth/battle-c03.js（confirm：横排弹窗/目标格白环标记/confirmAction 重放/swap · cancelPopup Esc）· src/badnorth/battle.js#onPointer（真下令路径）· tests/c03-battle.mjs · tests/confirm-popup-browser.cjs · ui.html",
          "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。本轮闭合三条游戏语义残差：①地面标记=#openPopup 在 picked.cell/floor 钉白色六环（浏览器同帧差分 1524px 落点内，确认/取消/关档全收）②单 Move=confirmAction 重放 battle.onPointer 原点击，走 navigation.pick/plan 校验→squad.goal/goalFloor→drawPath→取消选中同一条真下令路径（Node plan spy + plan 打回不改 goal）③移动交换=swap 钮两队 goal+goalFloor 双向换；补 cancelPopup() 挂真 Esc keydown、弹窗期队伍阵亡/选中顶替自动收；tests/confirm-popup-browser.cjs 17 项 + c03-battle.mjs §④ 全过；残差=原片钮图稿与标记形制为程序化近似（素材差）"
        },
        "basis": "本轮实现验收记录：三条残差闭合，status 升为 done；剩余为素材级近似"
      },
      "1015142746372366336": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点；残差即柱身连续发射未化开/顶团存活比不可标定——本次确认永久降级不再排期，无可执行残差（永久卡点，需新证据再立项）。已实现CROWN_STYLE/setTopBreak/setHaze保持现状。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状",
        "sourceEvidence": {
          "status": "partial",
          "where": "life/smoke.js#CROWN_STYLE · smoke.html · battle-c01",
          "note": "303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1010979395719319552": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "残差即原兜帽/锁甲等美术素材与全装备层级（无源素材，程序化只能近似）；无可执行残差（永久卡点，需新证据再立项）。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "游戏角色接口已接（sampleSlots pin 钉槽 + squadPortraitIdentity 兵种/队序映射，battle-c01 头像卡按小队真数据钉槽）；残差=原兜帽/锁甲素材与全装备层级不可得——永久卡点，需新证据再立项；不以不同画板哈希充当原多样性指标",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/part-random.js · src/ui/game-portrait-c01.js · src/badnorth/battle-c01.js · ui.html",
          "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。本地卡片绘制与稳定种子身份已验；本轮接游戏角色接口：sampleSlots 加 {pin} 钉槽（钉住值必须在槽 variants 内、钉表外槽位报错），squadPortraitIdentity(sq) 兵种→装备（矛兵→锁甲 mail、弓手→兜帽 hood、步兵随种子）+队序→底色，battle-c01 头像卡按小队真数据钉槽；残差=原兜帽/锁甲素材与全装备层级不可得，不以不同画板哈希充当原多样性指标。；【卡点·B 美术资产】原兜帽/锁甲素材与全装备层级不可得（无源素材，程序化只能近似） → 永久卡点，需新证据再立项"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "1007587828992266240": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js · src/life/effects.js · src/life/banner.js",
          "note": "300帧全核；白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐；【卡点·A 机制未做】白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "999185422403055616": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "双空间血斑机制已补齐并通过 Node 验收，原记录残差闭合；剩余为素材级辨识度，非工程可解。",
        "nextAction": "双空间血斑已落（躯干=单位空间、头/盾=部件空间 uSoakPivot/uSoakSpace、头局部姿态 headYaw/headRoll+headLag opt-in、uSoakDebug 棋盘格分界、gore 体表归零、高频碎斑层）；残差=斑与调色板斑辨识度、细碎溅点像素级标定需原作精灵贴图+皮肤 UV 素材；无可执行残差（永久卡点，需新证据再立项）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本轮残差已闭合：双空间浸血+碎斑+gore 全关已落 battle.js 并经 tests/blood-spaces-gore.mjs Node 验收；残差=斑与调色板斑辨识度、细碎溅点像素级标定需原作精灵贴图+皮肤 UV 素材——永久卡点，需新证据再立项",
        "sourceEvidence": {
          "status": "done",
          "where": "src/badnorth/battle.js（aSoak · installSoak 双空间 uSoakSpace/uSoakPivot · uSoakDebug 棋盘格 · u.headYaw/headRoll/headLag 头局部姿态 · gore→aSoak/发红归零）· tests/blood-spaces-gore.mjs",
          "note": "229帧全核+本轮残差补全：双空间血斑已落——躯干=单位空间（sprite-space 对应物，图案钉在躯干框架），头/盾=部件空间（position−uSoakPivot 局部坐标=skin-space 对应物，斑纹跟部件实际姿态走）；u.headYaw/u.headRoll 给头独立局部姿态（view.headLag opt-in：僵直期间头滞后身体，「splatter follows the actual motion of the head」闭环）；uSoakDebug=1 棋盘格调试层=0096 分界（躯干蓝棋盘/部件红白棋盘，?soakChecker=1 或 setSoakDebug）；补高频碎斑层（原片是细碎溅点不是整面色块）；gore 补漏：体表浸血+整体发红随同一开关归零（原只关地面血/血滴/尸体）；Node 验收 tests/blood-spaces-gore.mjs（双空间 uniform/头姿态分离且平移列不变/gore 往返/棋盘格翻转/hp 边界/确定性）；头/盾斑纹域换坐标系后像素量未在浏览器端复测；【卡点·C，永久】斑与调色板斑的辨识度、细碎溅点的像素级标定需原作精灵贴图+皮肤 UV 素材，需新证据再立项"
        },
        "basis": "本轮实现验收记录：status 升为 done，残差为素材级永久卡点"
      },
      "995043346778415104": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/route-preview.js · route-preview.html",
          "note": "386帧全核；移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接入、预览仍是淡出的一次性点串；【卡点·D 需接主管线】移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接… → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "995034777756536833": {
        "priority": "中",
        "workType": "机制未做",
        "reason": "新记录确认能力 UI 在原片里存在（No valid targets 横幅、底部圆钮、Plunge 提示牌），但 battle.js 只有血迹/旗/箭，能力系统整块空白；属玩法可见功能，排在导航缺口之后。",
        "nextAction": "在 battle.js 落最小能力闭环：Plunge 能力（选目标→施放→冷却计时）、底部圆钮条（按 400px 画幅约 28px 比例）+当前能力黄圈高亮与提示牌、无合法目标时顶部 No valid targets 横幅；输入契约原片给不出，按本仓近似并在模块头写明「非原片可证」。",
        "acceptance": "单元用例覆盖冷却计时、非法目标判定、冷却中拒绝施放；战役实景触发一次 Plunge 并与原片 0200 帧同构图对照（横幅/黄圈/提示牌）；冷却环完整弧原片不可读，只验数值不验像素。",
        "sourceGap": "能力系统（Plunge 本体 / 冷却环 / 非法目标提示）空白；冷却环完整弧原片不可读，输入契约只能本仓近似。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js · battle-c01.html",
          "note": "564帧复核（sheet-00/02/04 + 原尺寸0200 + 底部4×裁切）；确认能力 UI 在片中存在：顶部黑横幅 No valid targets（0200）、底部一排圆钮（直径≈28px/400px 画幅）中间一枚黄圈高亮并挂 Plunge 提示牌；按钮下半被画幅裁掉→冷却环完整弧不可读；battle.js 已有血迹/旗/箭三项，能力系统（Plunge 本体/冷却环/非法目标提示）仍空白，输入契约片子里给不出只能本仓近似；本轮未写码"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "987267068495003648": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "弹道查表需要完整有效性判断，不能以画出或发射一条轨迹代替。",
        "nextAction": "核当前弓手接线后补代价表达式、阻力与 Validity 契约，保留真实目标/碰撞校验。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "双网格实际弓手发射通过。原表达式/drag/Validity仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/ballistic-table.js · src/badnorth/battle.js · ballistics.html",
          "note": "678帧全核；Inspector代价/Validity动态编辑。保留无阻力游戏参数，提共享表/可调权重，修真实目标高差量化误差；双网格实际弓手发射通过。原表达式/drag/Validity仍缺。；【卡点·A 机制未做】双网格实际弓手发射通过。原表达式/drag/Validity仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "984813819280191488": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "浸血血量指示已锁死并经 Node 验收，堆厚变暗机制已存在且复验通过；原片测不出标定值属证据层卡点。",
        "nextAction": "hp→体表浸血映射锁死（damageCombatUnit soak=1−hp/max，Node 验收边界 0/1、阵亡 0.9、确定性、不伤走位）；「堆厚变暗」机制已存在（c01.bloodStack opt-in+Node 复验通过），原片两次复证测不出变深→标定值来源不足；无可执行残差（永久卡点，需新证据再立项）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "浸血血量指示已验（hp→soak 锁死+边界/确定性/不伤走位用例）；堆厚变暗机制已存在（c01.bloodStack opt-in 复验通过）；残差=原片两次复证测不出变深，标定值来源不足——永久卡点，需新证据再立项",
        "sourceEvidence": {
          "status": "done",
          "where": "src/badnorth/battle.js（installSoak/aSoak/#bleed/poolGrow/mStun · gore→aSoak 归零）· src/core/combat-profile.js（damageCombatUnit soak=1−hp/max）· src/core/combat-state.js · battle-c01 bloodStack/bloodAge · tests/blood-spaces-gore.mjs",
          "note": "934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；hp→体表浸血映射锁死 damageCombatUnit：soak=1−hp/max（Node 验收 tests/blood-spaces-gore.mjs：边界 0/1、阵亡 0.9、确定性、命中不伤走位）；「堆厚变暗」复查：机制已存在——c01.bloodStack（opt-in，重叠计数+逐实例压暗+bloodAge 老化，stats.stacked/maxStack 复验通过，默认关）；原片第2次复证同点位反复死亡仍测不出变深变大 → 标定值来源不足【卡点·C，永久】需新证据再立项，机制侧已齐"
        },
        "basis": "本轮实现验收记录：status 升为 done，标定残差为证据层永久卡点"
      },
      "974579499802202113": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：3D原gizmo未完整迁移。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "3D原gizmo未完整迁移。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
          "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。；【卡点·A 机制未做】3D原gizmo未完整迁移。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "974564862729838592": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：3D原gizmo未完整迁移。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "3D原gizmo未完整迁移。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
          "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。；【卡点·A 机制未做】3D原gizmo未完整迁移。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "974325184525201409": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "残差即原 raid planner 多站位成串排布与真实绕礁/避让机制未公开（侧让+停船是本地近似）；无可执行残差（永久卡点，需新证据再立项）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "岸礁三段已补齐（进场走廊 0.8–19.94 / 母船航线 corridorBlocked / 离港全程），steerBoat 侧让+停船动态避让已每帧接入 battle.js；残差=原 raid planner 多站位成串排布与真实避让机制未公开（本地近似非原片）——永久卡点，需新证据再立项",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/obb.js · src/badnorth/landing-plan.js · src/badnorth/battle.js",
          "note": "504帧全核；本轮补齐岸礁后两段与动态避让：seawayBox 航道地形检测延伸 0.8→19.94 覆盖离港全程，corridorBlocked 母船航线检测（origin→泊位外沿压陆地则退回标准走廊并计 originBlocked），steerBoat 动态避让（在航船把高优先级船当障碍，先试直线再按 ±0.55/±1.1 侧偏找干净走廊、全堵停船等让）已每帧接入 battle.js in/out 两态；残差=原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似）。；【卡点·C 算法未公开】原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似） → 永久卡点，需新证据再立项"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "959752525867036672": {
        "priority": "高",
        "workType": "补来源后实现",
        "reason": "640 格面积和编辑刷新局部通过，但多系统仍未共用这一结构。",
        "nextAction": "把已存在的三角网重心对偶、边界闭合和候选点统一到植被/导航消费者。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "见本批运行证据，能力仍列部分。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js；gridpatch.html",
          "note": "31帧复核：顶点格在实际台地上收缩/扩大。新增三角网重心对偶及边界闭合，共享World扇形三角输入和分层脉动观察/候选点。640格面积测试通过；不是原作中心规则证明，尚未统一植被/导航。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。；【卡点·C 算法未公开】见本批运行证据，能力仍列部分。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "959530111187013632": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整物种/生态/雨景未复现。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整物种/生态/雨景未复现。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/level-flora.js · src/life/vegetation.js · level-flora.html",
          "note": "203帧，准确日期2018-02-02；109帧硬切紫色雨景。迁移分层色组至共享World实际地被，保留落点和默认；完整物种/生态/雨景未复现。；【卡点·A 机制未做】完整物种/生态/雨景未复现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "958371606350454784": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：完整spec/数据接口/剪影IoU仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "完整spec/数据接口/剪影IoU仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/part-random.js · ui.html",
          "note": "88帧全核验；保留层级部件，修复显式mirror分支随机重放/单次消费，显式种子与固定槽ID保证重画、切页和手机换列身份；完整spec/数据接口/剪影IoU仍缺。；【卡点·A 机制未做】完整spec/数据接口/剪影IoU仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "946660607008403456": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仍缺船外沿岸白泡沫带与白花簇",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仍缺船外沿岸白泡沫带与白花簇",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js（#longship deckPool/#bleed）· src/core/platform-anchor.js",
          "note": "440帧全核（5张联系表）；复核：舱内是整舱浸透不是斑点、船左水面大片血雾随流变淡、岸边浅水有白泡沫带与成片白点；本轮未改码，impl/runtime 沿用第54轮实测（deckPool 25段带 opacity0.94、boat-deck-pool-browser PASS）；仍缺船外沿岸白泡沫带与白花簇；【卡点·A 机制未做】仍缺船外沿岸白泡沫带与白花簇 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "943230624369868800": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/atmosphere.js · src/core/world-probes.js",
          "note": "318帧全核验；修复屋顶下空洞误用柱顶碰撞，雪片改读共享World实际solid层，重生避实心、dt校验；双网格即时封洞/重开通过。现有表面混白保留，不是物理堆积；Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。；【卡点·A 机制未做】Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "943230620242796544": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "原记录残差已收口：冬景/植被挂霜/雪 与 船群/士兵旗帜/血迹/黑烟 同屏组合已由 tests/winter-battle-combo-browser.cjs 冻结帧验收（17项全过）。",
        "nextAction": "残差已收口；原片摆拍构图的美术等价（船群密度/血烟量级/机位）不属于机制残差，几何厚雪帽继续在 943230624369868800 条目记账。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "无（组合验收已完成；剩余为原片美术等价，非本仓机制缺口）。",
        "sourceEvidence": {
          "status": "done",
          "where": "src/badnorth/theme.js#winter/frostVegetation · src/life/atmosphere.js（雪+uSnow）· src/badnorth/battle.js（长船/近战/血/烧屋）· src/life/smoke.js · index.html?scene=badnorth · tests/winter-battle-combo-browser.cjs",
          "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。本轮组合验收：真页面index.html?scene=badnorth（quad/seed7）走真实机制——UI选冬季主题+snow复选框开雪，battle.update按真实26s波次推进；守军默认布防守死屋门（defNear恒真，实测600s/24波0失守），t=20.1s按玩家移动令同款机制（squad.goal=导航可达远格cell671/门距5.74）拉开防线后维京人真占门烧屋。同屏t=55.1s第3波：2长船在场、岸上维京12+船上12、守军旗2面、血迹221实例/14杀、2屋失守2烟源110烟卡、火光开；冬景bnTheme.sky#c4c7cb、植被挂霜5/5→#a7adb5、雪3000粒+uSnow=1。冻结帧：噪声0、雪开关差分166700px、回位0、深红血像素4087、烟柱带中位亮度126.9<冬空199。tests/winter-battle-combo-browser.cjs 17项全过。剩余：原片是摆拍宣传构图（船群密度/血烟量级/机位），本验收锁元素同屏+真实机制，不主张逐帧美术等价；几何厚雪帽残差记943230624369868800。"
        },
        "basis": "2026-11-25 组合验收完成后的复核；sourceEvidence 与 data.js 逐字一致，本条仅作历史批注保留"
      },
      "926903893866541057": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "机制接口已补齐（makeWindField/traceWindPath/局部场GPU采样对拍），剩余为原片解算器未公开卡点。",
        "nextAction": "残差复核已由上游批次完成并由 tests/wind-trajectory.mjs 锁定；剩余残差即原片风场精确解算器（卡点·C，永久卡点，无可执行残差，需新证据再立项）。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "makeWindField/trace/局部场GPU采样已落码；原片风场精确解算器未公开（永久卡点·C）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/atmosphere.js · src/core/wind-flow.js · src/core/world-probes.js",
          "note": "516帧全核验；按层避障/三线性风场与共享uWind保留，双网格通洞/封洞及改风向复核。完整轨迹接口已补：makeWindField解析场（dir/lift/swirl/seed定相位、种子确定）与WindPath/traceWindPath（种子点→积分轨迹→at(t)任意时刻位置、命中洞hitsHole/throughHole、出界exitIndex/status、blocked），Atmosphere.tracePath/windField在共享场上同形包装；局部场GPU采样此前已由packWindField/windFieldGLSL/samplePackedWind落地（CPU replica对拍<1e-5）。tests/wind-trajectory.mjs验确定性/轨迹守恒/通洞·封洞·避障/出界；原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项）；【卡点·C 算法未公开】原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项） → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "2026-11-25 两处逐字归一后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "912691357440978945": {
        "priority": "中",
        "workType": "校准与证据补全",
        "reason": "新测量推翻了原先峰值 α=1.00 的假设（改记 0.7–0.85），但估计工具自检最坏误差 0.442，不能给出绝对值；先补可信标定再改常数。",
        "nextAction": "为光柱 α 补一个自检误差可接受的估计方法或第三机位标定，再决定 SKY_BEAM 峰值常数；在此之前不按 0.83 单点改实现。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "峰值 α 只有 0.7–0.85 的区间估计；beam-transmission 自检误差 0.442，不能用于绝对 α",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle-c01.js · SKY_BEAM_UNIT_STEPS · tools/beam-transmission.py",
          "note": "759帧全核（sheet-02 0200-0299 + 4× 裁切 278/288）；新工具 beam-transmission 用柱后残余对比度反解 α，自检最坏误差 0.442 判不可用于绝对 α；实测 0288 残余 11.98/柱外 44.55/噪声 5.12 → α≈0.83，4× 目视也能看到岩边透出 → 推翻 r100 的峰值 α=1.00（那是 cal_alpha 假设），改记 0.7-0.85"
        },
        "basis": "2026-11-14 来源记录更新后的复核；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "906425294533394432": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "复杂洞穴通路和战斗都依赖完整空间约束，局部二维路径通过还不够。",
        "nextAction": "补形变后的精细门户、侧壁碰撞与脚高插值；已接入的分层流场不重复实现。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
          "note": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。；【卡点·A 机制未做】精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "906416813810049025": {
        "priority": "低",
        "workType": "美术与表现补全",
        "reason": "r214 核销：穿山隧道洞底连通/穿隧路由/同格双层/多层战斗下令穿洞/长船上岸全部行为验收（双网格 Node+真页面浏览器），剩余仅卡点·B 原片美术资产。",
        "nextAction": "无可执行残差，永久卡点：r214 已把裁判库 cavepath.js 可观察机制全部核销并双验收；剩余即卡点·B（原片紫色洞穴 tileset 美术与圆拱造型无源素材，程序化体素洞只能近似），需新证据再立项。",
        "acceptance": "双网格真实岛验收：穿山隧道洞底成链+两端接口、nav.plan 洞底层穿隧、同格双节点、跨层 canMelee 拒、真实 Battle 下令穿洞到达、长船靠岸卸人、全程无 NaN；浏览器 ?bncaves=3 复验+开关洞截图像素差 697505、零控制台 error。程序近似与缺失原资产分开记录。",
        "sourceGap": "无机制残差：裁判 cavepath.js 净空/顶岩/板顶高度比例已对账一致，拱跨4格 vs 本仓1格宽体素洞为尺度口径差异；原片紫色 tileset 美术资产未公开（卡点·B，永久）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/island-caves.js · src/badnorth/island.js · src/world/battle-navigation.js · src/badnorth/battle.js · tests/bncaves-island-battle.mjs · tests/bncaves-island-browser.cjs · index.html?scene=badnorth&bncaves=3",
          "note": "725帧全核，紫色厚岩拱洞/多层战斗与船只。r56 已落 ?bncaves 洞穴岛变体（island-caves.js：穿山隧道、洞底与低地平接、净空2层、顶岩≥1层）；r214 残差核销——真实岛行为验收：穿山隧道洞底层内部成链（相邻洞格 floor f 互通+两端各接洞外低地）、nav.plan 全程洞底层穿隧真进洞格、同格洞底/板顶双节点共存且跨层 canMelee 拒、真实 Battle 守军 squad.goal/goalFloor 下令经洞底走到隧道远端格、维京长船照常 planLanding 靠岸卸人（tests/bncaves-island-battle.mjs，quad/mixed 双网格 PASS）；浏览器验收 index.html?scene=badnorth&bncaves=3 真页面（3 穿山/7 洞格双节点/长船出场卸人上岸/开关洞截图像素差 697505/控制台零 error，tests/bncaves-island-browser.cjs）。裁判库 cavepath.js 比例对账一致：净空2层≈ZCROWN 1.80、顶岩≥1层≈band 0.90、板顶高出洞底3层≈ZTOP 2.70（world.top−floor===3，naive 单值高度场错3层在真实岛复现）；裁判拱跨4格 vs 本仓1格宽体素洞记为尺度口径差异。；【卡点·B 美术资产】原片紫色洞穴 tileset 美术资产（贴图/模型/圆拱造型/UI 稿）没有源素材，程序化体素洞只能近似；拱跨4格对1格属 tileset 尺度设定非机制缺口 → 卡在原片美术资产，需新证据再立项"
        },
        "basis": "r214 残差核销与两处逐字归一后的复核；不更改原库 partial 状态，不代表原 tileset 美术等价"
      },
      "906207980802252801": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真…",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/atmosphere.js · src/core/fog-envelope.js",
          "note": "326帧全核验。修复本地有限雾盘外缘硬截断，新增浓度/相对漂移速度控制，默认淡雾0.35；实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真实速度。；【卡点·A 机制未做】实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "903647529203634176": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仍缺按受击方向抖动与 +10 独立上浮速度",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仍缺按受击方向抖动与 +10 独立上浮速度",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/damage-numbers.js · src/badnorth/battle.js",
          "note": "654帧全核（7张联系表）；击杀金色+10并入伤害数字同池（kind=kill、同字号/上浮/遮挡、贴图键 kill|+10），新增同帧横向错位 sx 防叠；仍缺按受击方向抖动与 +10 独立上浮速度；【卡点·A 机制未做】仍缺按受击方向抖动与 +10 独立上浮速度 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "902103473365417984": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/distance-isolines.js · distances.html",
          "note": "705帧全核；岛上等距亮线=距离场等值线（非流向继承），新建 distance-isolines.js+distances.html，EDT 与暴力解一致；缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入；【卡点·D 需接主管线】缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "902069261304287232": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有复核明确 LOD 不可测，代码工作必须与本仓扩展分开。",
        "nextAction": "保留格边骨架/色块的信息继承证据；不要据此再排 LOD 或强行宣称 continuousFlow 接线是原作要求。",
        "acceptance": "显示原作证据与工程扩展标签；与 901842167508992000 的整合任务合并评估。",
        "sourceGap": "389帧全核（4张联系表）；原片只有格边骨架线+色块，无箭头/流线/图例→continuousFlow 接 battle 无原片依据；LOD第12次不可测，降级为本仓扩展不再排队",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/motion 流场 · navmesh-flow.html",
          "note": "389帧全核（4张联系表）；原片只有格边骨架线+色块，无箭头/流线/图例→continuousFlow 接 battle 无原片依据；LOD第12次不可测，降级为本仓扩展不再排队"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "901842167508992000": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "影响场信息只有被真实导航/战斗消费才构成完整能力，但无法从原片推定性能目标。",
        "nextAction": "核清 continuousFlow 与实际 Battle 的数据/更新接口，再补整合；不再追逐原片不可测 LOD。",
        "acceptance": "真实战斗比较连续流场启停与距离/单位类型继承，做 30/60/120Hz 与预算测试；标明本仓扩展。",
        "sourceGap": "571帧全核(并案389)；同机位整岛入画、远端未见稀疏化 → LOD 永久不适用；continuousFlow 仍未接 battle.js，须单独一轮",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/view.js · flow.html",
          "note": "571帧全核(并案389)；同机位整岛入画、远端未见稀疏化 → LOD 永久不适用；continuousFlow 仍未接 battle.js，须单独一轮"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "901469409579061248": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/life/boats.js · src/core/wake-sampling.js",
          "note": "138帧全核验。保留绕岛V形带状船迹，补连续时间采样/相位余量/帧内插值，30/60/120Hz实际采样数和年龄一致；重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。；【卡点·A 机制未做】重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "880853661936734211": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "直道 64 人测试通过不意味着所有真实场景不会堵塞。",
        "nextAction": "补弯道、多岔路口、复杂拥挤和不同体型的重新路由。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/traffic.js · src/badnorth/battle.js",
          "note": "601帧已复核，保留左行与常驻点线；补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。；【卡点·A 机制未做】补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "797119718477991936": {
        "priority": "高",
        "workType": "接入实现",
        "reason": "同一实现多个视频来源应合并开发任务；避免按视频数重复计算工作量。",
        "nextAction": "与 906425294533394432 共用精细门户/侧壁/脚高任务，保留早期导航证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续…",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
          "note": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。；【卡点·D 需接主管线】精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续… → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "886199305522085890": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：仍缺通用调试层（只挂badnorth）与近景点距略疏",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仍缺通用调试层（只挂badnorth）与近景点距略疏",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/traffic.js（passageMarkers/heightRaster roofs）· src/badnorth/battle.js（refreshPassages）· index.html?scene=badnorth",
          "note": "624帧全核（7张联系表）；机制复核成立：点线只出现在两块实体间那一格宽处、被建筑挡住即整段不画、点距:点径≈2:1；本轮未改码，impl/runtime 沿用第54轮实测（spacing 0.28、roofs遮挡、dmPeak 187.6，traffic-dots/traffic-fade/traffic-sight 全PASS）；仍缺通用调试层（只挂badnorth）与近景点距略疏；【卡点·A 机制未做】仍缺通用调试层（只挂badnorth）与近景点距略疏 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "820977247083528192": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/unit-shadow.js · unit-shadows.html",
          "note": "先按准确配文理解动画参考请求；25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。；【卡点·A 机制未做】25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "821321422140309504": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：本批仅学习复核。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "本批仅学习复核。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js",
          "note": "315帧全核验，主内容为选点/登台/战斗与尸体，暗斑不能单独证明原阴影方法；本批仅学习复核。；【卡点·C 算法未公开】本批仅学习复核。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "821680056514781186": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：仅学习，不能认证软影高度或坡面算法。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "仅学习，不能认证软影高度或坡面算法。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/badnorth/battle.js",
          "note": "早期复仇战斗763帧复核；仅学习，不能认证软影高度或坡面算法。；【卡点·C 算法未公开】仅学习，不能认证软影高度或坡面算法。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "827215002448846848": {
        "priority": "低",
        "workType": "美术与表现补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差：升级机制已补本地最小实现（opt-in unitPromotion，击杀数→等级→装备档位；tests/unit-promotion.mjs + unit-promotion-browser.cjs 双网格验收通过）；剩余为原雕饰/旗徽美术资产与原作升级经济未公开参数的永久卡点，需新证据再立项，不把本地阈值当原作参数。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原雕饰/旗徽/原作升级经济未复现（升级机制为本地最小实现非原作复现，阈值[2,5]本地解释）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/unit-tier.js · src/badnorth/battle.js · unit-tiers.html",
          "note": "原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过。本轮补「升级机制」残差：本地最小真实机制 击杀数→等级→装备档位（unit-tier creditUnitKill：u.kills/u.level，阈值[2,5]本地解释；Battle opt-in unitPromotion，近战/矛刺/箭射手三路记账、同队误伤与死者不记、升档只写外观不回血）；tests/unit-promotion.mjs 纯函数+真Battle记账断言全过，unit-promotion-browser.cjs 双网格真渲染差分quad4560/mixed1624px+实例色对色阶。原雕饰/旗徽/原作升级经济未复现。；【卡点·B 美术资产】原雕饰/旗徽/原作升级经济（XP参数/触发时机未公开）未复现 → 升级机制已补本地最小实现（非原作复现），剩余卡在原片美术资产与未公开参数，没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "815236105079398400": {
        "priority": "中",
        "workType": "补来源后实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "无可执行残差：同高片/逻辑阶差面积诊断已交付（plateauRuns/stepDropArea · scene.plateau-diag · tests/plateau-diag.test.mjs，擂台/复算通过）；剩余为原片算法未公开的永久卡点，再立项需新证据，不把推测当原算法。",
        "acceptance": "已按残差补独立行为用例（合成 World：平地一片/台阶两片/建筑柱 top vs ground/只读断言）并接实际消费者（lightlife 层 runPlan + verifyLightLife 复算 + 擂台登记）；原片对照范围=可观察台面结构（同高片/阶差边），非算法复现。",
        "sourceGap": "原片算法未公开（卡点·C，永久）：同高片/逻辑阶差面积诊断已落地；残差=不可恢复的原算法与未含实际变形坡面/洞内/悬垂面积。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/terrace-profile.js · terraces.html",
          "note": "原文irregular is the new hex，185帧；既有量化保留；真实World同高片/逻辑阶差面积诊断已落地（plateauRuns/stepDropArea，能力 scene.plateau-diag，擂台与复算通过），非原算法恢复。；【卡点·C 算法未公开】残差只剩原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似；未含实际变形坡面/洞内/悬垂面积"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "781957658597269506": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：原薄台/攀爬仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原薄台/攀爬仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/terrain/generate.js · src/core/ladder-profile.js · src/world/navlayer.js · terraces.html",
          "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习；不等于可用顶列量化复现悬垂结构。 旧片续作：3D锚点梁长/等距踏棍接实际台地木梯，双网格模式恢复通过；原薄台/攀爬仍缺。；【卡点·A 机制未做】原薄台/攀爬仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "828984794407170048": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "残差为卡点·B 美术资产（原火球特效/单位身体动作/坡面脚底素材与采样方式不可得，本地逐人navFloor+footHeight踏面+全接地状态指数缓动为可验证近似），无可执行残差（永久卡点，需新证据再立项）。本批已补：层高缓动上移覆盖近战/横扫/刺击/眩晕/待命全接地状态 + tests/unit-ground-height-battle.mjs 真Battle双楼层30/60/120Hz解析一致。再立项条件：原作素材/算法公开或更高清证据。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原火球/动作/坡面未复现。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/unit-ground-height.js · src/badnorth/battle.js",
          "note": "387帧坡地接敌/火焰/房屋焦黑；每人navFloor+footHeight踏面与1-exp(-10dt)帧率无关缓动已在，本批把同一次缓动上移覆盖全接地状态（近战/横扫/刺击/眩晕/待命不再冻在半空，坠落/船上/跃起自有y），tests/unit-ground-height-battle.mjs真Battle双楼层30/60/120Hz解析一致+缠斗/眩晕分支收敛+整队0悬空；原火球/动作/坡面未复现。；【卡点·B 美术资产】原火球/动作/坡面未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "865200072685912064": {
        "priority": "中",
        "workType": "美术与表现补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "残差为卡点·B 美术资产（原图片/动画/完整建筑素材不可得，本地近似已分层记录），无可执行残差（永久卡点，需新证据再立项）。本批已补逐步轨迹导出 wfcTraceSteps。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/wfc.js · wfc-trace.html",
          "note": "908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；本批补逐步轨迹导出：决策帧点名决定格/选定块、矛盾帧点名掏空格与红链，wfcTraceSteps 差分逐帧缩域与回溯重开，Node 验证候选只在矛盾帧后放大；默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。；【卡点·B 美术资产】默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "890611046435627008": {
        "priority": "低",
        "workType": "美术与表现补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/house-door-presence.js · src/badnorth/battle.js",
          "note": "666帧全核，层间指令/阶梯支援/房屋遇袭和守卫。保留逐人层高，修房屋燃烧/守卫仅看XZ导致跨层干涉；双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。；【卡点·B 美术资产】双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "823848950553780226": {
        "priority": "低",
        "workType": "机制与接口补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：命令路径弧长采样迁移已完成并经裁判 navribbon 逐位对拍（tests/path-samples-referee.mjs 同弧长位置 maxDiff=0），尘粒AO本地近似已落地验收（battle-c04.js particleAO，?c04=dustao，c04-bn-world.mjs 贴墙0.467/成洞0.417/开阔0.82，vendor 逐字拷入 battle-c04.js+vertex-dual.js）；剩余仅为原尘粒AO精确算法未公开（卡点·C，配文仅功能宣称）。再立项条件：原作公开算法或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原尘粒AO精确算法未公开；本地近似 particleAO 与命令路径弧长采样迁移均已落地，不冒充原作。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/path-samples.js · src/world/battle-navigation.js · src/badnorth/battle.js · src/badnorth/battle-c04.js",
          "note": "227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。r218 核销过期账：弧长等距采样早已落在 src/core/path-samples.js（battle.js#commandPathSamples 诊断点、battle-navigation.js#commandRibbon 约束CR→等距→贴地含踏面→净距带宽格子全链、route-preview.js 复用），command-ribbon.mjs 真Battle双网格过；本批新增 tests/path-samples-referee.mjs 与裁判 navribbon.js 逐位对拍——同一中线2密度×3步距、裁判每个采样点在本侧同弧长处位置逐位一致、length逐位等，如实差异记文件头（本侧端点必保留/法向中差+净距带宽/accept约束平滑）；尘粒AO本地近似在 battle-c04.js particleAO（?c04=dustao，c04-bn-world.mjs 贴墙0.467/成洞0.417/开阔0.82），vendor 逐字拷入 battle-c04.js+vertex-dual.js（cmp过、import闭包足）。；【卡点·C 算法未公开】原尘粒AO精确算法未公开（配文仅功能宣称、画面不足以反推），particleAO为本地近似不冒充原作 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "807256278154301441": {
        "priority": "中",
        "workType": "接入实现",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：群体寻路及多格完整规则未验收。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "群体寻路及多格完整规则未验收。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/hip-roof.js · src/build/buildings.js",
          "note": "344帧全核。原文群体寻路、图像塔楼及球点，纠正原版无文字六帧说明。共享独立四边房屋可选四檐顶真实重建通过；群体寻路及多格完整规则未验收。；【卡点·D 需接主管线】群体寻路及多格完整规则未验收。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "827216768783495168": {
        "priority": "低",
        "workType": "美术与表现补全",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差：本地竖旗横杆+金饰盾纹替身（squad-standard.js · g3 standards）已验收（battle-g3.mjs Node层 + squad-standards-browser.cjs 双网格浏览器差分）；剩余为原图集/原作雕饰美术的永久卡点，需新证据再立项。",
        "acceptance": "原参考同视角/同光照对照，检查动作/轮廓/颜色及资源释放；程序近似与缺失原资产分开记录。",
        "sourceGap": "原图集/原作雕饰美术仍缺（本地程序化替身已落地验收）。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/banner.js · src/badnorth/battle.js · src/badnorth/squad-standard.js",
          "note": "23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。本轮补验收既有本地替身：竖旗横杆+金饰盾纹（squad-standard.js · g3 standards）Node层battle-g3.mjs已覆盖，新增tests/squad-standards-browser.cjs双网格浏览器验收（每守军一张金饰盾面24张、Bezier旗替换与恢复、公告板偏航±40°、RT差分quad230/mixed380px）。原图集/原作雕饰美术仍缺。；【卡点·B 美术资产】原图集/原作雕饰美术未复现 → 本地程序化替身已落地验收，剩余卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "793557992931266561": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "无可执行残差（永久卡点，需新证据再立项）：五阶段可观察行为已全部有本地近似落点并逐项对照（tests/ao-stages-coverage.mjs、parity/lighting.json）；缺口仅为原作未公开的算法本体（卡点·C）。再立项条件：原作公开算法或更高清证据。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "不将本地四选项冒充SSAO/方向AO。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
          "note": "6帧全核；五阶段可观察行为均有本地落点（bake.js 四档 aoMode + view-c04 SSAOPass；tests/ao-stages-coverage.mjs：格级事实与裁判逐值一致、探针顶点色一致、整镇 pearson 0.9999）；不将本地四选项冒充SSAO/方向AO。；【卡点·C 算法未公开】不将本地四选项冒充SSAO/方向AO。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "806904557502464000": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：楔石/完整桥构仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "楔石/完整桥构仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
          "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。；【卡点·A 机制未做】楔石/完整桥构仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "802496920790777856": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：楔石/完整桥构仍缺。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "楔石/完整桥构仍缺。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
          "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。；【卡点·A 机制未做】楔石/完整桥构仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "816748103193817088": {
        "priority": "高",
        "workType": "机制与接口补全",
        "reason": "独立导航面演示需要真实世界和战斗消费者才能成为可组合能力。",
        "nextAction": "核清共享 World 自动生成导航面、通口前视和 Battle 的连续流场接线。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "还缺接进 battle.js、通口前视、共享World自动生成导航面",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/world/navmesh-flow.js · navmesh-flow.html",
          "note": "479帧全核（5张联系表+frame-0128原尺寸）；本轮把「逐面常量流向→过面换向」改成共边带混合：352条共面边 p90 22.50°→0.000°、max 90°→0°（浏览器实测同值），百人 9.6s 全到/出面0/换面抖动 1732→1513；顶点梯度+均值坐标虽也做到0°但抹平崖壁切向导致崖脚卡人40s，已弃用；还缺接进 battle.js、通口前视、共享World自动生成导航面；【卡点·A 机制未做】还缺接进 battle.js、通口前视、共享World自动生成导航面 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "798580832906739712": {
        "priority": "低",
        "workType": "补来源后实现",
        "reason": "属于旧方案对照、可选实验或表现细节，当前不阻塞主要组合；低优先级不等于已完成。",
        "nextAction": "先明确可观察行为与来源不足部分，再选择可验证实现；不可把推测当原算法。原残差：原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。",
        "sourceEvidence": {
          "status": "done",
          "where": "src/core/space-visibility.js · src/core/vertex-openness.js · src/world/space-visibility.js · src/capabilities/layers-meta.js · src/capabilities/layers.js · space-visibility.html · index.html?c04=rayvis",
          "note": "64帧全核（原注释24帧不符）；原算法即本仓rayvis.js已迁并超出：固定步长/逐格穿行/三角网格光学castMeshRay三级射线开阔度、整楼灰度场bake+逐顶点c04灰度材质、indoorAt室内谓词，能力库world.openness经runPlan接rayvis层消费；原片没拍游戏AI用法，灰度场是诊断口径不声称逐像素光学"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      },
      "787319655648100352": {
        "priority": "中",
        "workType": "机制与接口补全",
        "reason": "已有局部落点；补齐本项可提高能力完整度，排在共享结构与组合阻塞之后。",
        "nextAction": "先核现有落点，再围绕以下原记录残差补全：底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。",
        "acceptance": "针对所列残差补独立行为用例，再接实际消费者；记录原片对照范围、输入/输出和失败恢复，不以演示页能打开代替完整验收。",
        "sourceGap": "底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。",
        "sourceEvidence": {
          "status": "partial",
          "where": "src/core/wfc.js · src/build/buildings.js",
          "note": "67帧全核，仅学习；底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。；【卡点·A 机制未做】底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）"
        },
        "basis": "本次工程补全优先级判断；不更改原库 partial 状态，不代表本轮实现验收"
      }
    },
    "priorityPolicy": "高：共享机制/组合接口/正确性阻塞；中：局部能力补齐与交付对账；低：旧分支/非关键表现/可选实验。来源不足单独标记，不能用新日期或 partial 数量自动判定工作量。",
    "sphereClips": [
      "1768627849529893109",
      "1769641473895432220",
      "1769691526924292506",
      "1781405550061687016",
      "1783792917183606829",
      "1791049306213912823",
      "1795831296952041691"
    ],
    "phasePolicy": "主线为本地学习导航分类，不冒充作者官方项目阶段；sphere 只列有球面指向的记录，其他同期研究留在 next。"
  }
};
