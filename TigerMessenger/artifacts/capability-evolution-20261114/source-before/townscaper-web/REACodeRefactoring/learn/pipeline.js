window.PIPELINE = {
  "verdict": {
    "title": "Bad North 不是两者的综合，是祖先；融合发生在 Townscaper 之后的第三个项目，最终落到球面",
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
              "status": "partial",
              "where": "src/core/infinite.js · grids.html?t=infinite",
              "page": "grids.html?t=infinite",
              "note": "532帧全核，保留现有三块簇/插值；修verify始终查blend及只查前两owner，实际只簇模式接缝原被隐藏，浏览器全owner逐模式验收。按块边界钉住实际无缝，不沿用旧说明。",
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
              "status": "partial",
              "where": "src/core/grid.js · grids.html?t=kinds",
              "page": "grids.html?t=kinds",
              "note": "610帧全核验；修“纯方格”仍有三角的误标，新增真正正交方格，保留合并菱形对照，局部Canvas/WorldMesh通过；独立六边地形/原模块仍缺。",
              "decodedFrames": 610,
              "reviewEvidence": "artifacts/coverage/grid-kinds-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  609
                ],
                "nativeRevisits": [
                  30,
                  242,
                  440,
                  570
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "真正纯方格/共享cell与WorldMesh局部通过；非完整原生成器"
              }
            },
            {
              "name": "拓扑直线：有向状态判环/真实对边段/停止原因",
              "id": "1384958097542819845",
              "status": "partial",
              "where": "src/core/grid.js · grids.html?t=lines",
              "page": "grids.html?t=lines",
              "note": "679帧全核验；有向格/出边判环、停止原因和真实中点段局部验收通过；游戏手柄/连刷仍未接入。",
              "decodedFrames": 679,
              "reviewEvidence": "artifacts/coverage/topoline-quad-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  678
                ],
                "nativeRevisits": [
                  20,
                  100,
                  300,
                  650
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "有向拓扑直线/停止原因/实际Canvas局部通过；非游戏编辑功能接入"
              }
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974579499802202113",
              "status": "partial",
              "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
              "page": "grids.html?t=infinite",
              "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。",
              "decodedFrames": 815,
              "reviewEvidence": "artifacts/coverage/bary-prep-review.md",
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
                "acceptanceScope": "同一局部XZ预计算接入，非原3D演示完整"
              }
            },
            {
              "name": "通用三角图：确定性全查/坏输入拒绝；局部编辑接口待补",
              "id": "1677242779162877952",
              "status": "partial",
              "where": "src/core/trigraph.js · trigraph.html",
              "page": "trigraph.html",
              "note": "白色三角线框扩展、不规则外轮廓和局部彩边变化；画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。",
              "decodedFrames": 279,
              "reviewEvidence": "artifacts/coverage/trigraph-halfedge-review.md",
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
                  250
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "450次增量全查及真实200点按钮实验局部通过，非原版完整接口"
              }
            },
            {
              "name": "方形沿对角切四三角：父格追溯/实际WFC；联合模块待补",
              "id": "1447494168448753667",
              "status": "partial",
              "where": "src/core/grid.js · wfc.html?subtiles=1",
              "page": "wfc.html?subtiles=1",
              "note": "全178帧模块库核验；新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。",
              "decodedFrames": 178,
              "reviewEvidence": "artifacts/coverage/tri-subtiles-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  177
                ],
                "nativeRevisits": [
                  14,
                  85,
                  135,
                  165
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "对角四分几何/父子追溯/实际World及WFC局部验收；非完整原3D模块"
              }
            },
            {
              "name": "Half Edge：511帧已核验；显式环/扇与编辑接口待补",
              "id": "1458921394855718917",
              "status": "partial",
              "where": "src/core/grid.js · src/core/adjacency.js",
              "page": "adjacency.html",
              "note": "圆内四边形组与彩色剩余区域轮廓、间隙三角网，反复重置铺组/填网；未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。",
              "decodedFrames": 511,
              "reviewEvidence": "artifacts/coverage/trigraph-halfedge-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅全帧学习与静态接口差距复核"
              }
            },
            {
              "name": "球面四阶段：三角化/松弛真实坐标对照；完整原动画待补",
              "id": "1338825080844021760",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html?stage=tri",
              "page": "planet.html?stage=tri",
              "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
              "decodedFrames": 395,
              "reviewEvidence": "artifacts/coverage/sphere-stages-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  394
                ],
                "nativeRevisits": [
                  16,
                  48,
                  150,
                  300,
                  370
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "阶段快照/实际GPU坐标/球面拓扑与平面抽样口径局部通过；非完整原算法接口或美术认证"
              }
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "229帧全核验；现有对偶柱群球面能力保留，原片平滑海岸/模块视觉与平面World/游戏接入仍缺，本批仅学习审核。",
              "decodedFrames": 229,
              "reviewEvidence": "artifacts/coverage/sphere-relax-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅学习与现有球面演示差距审核"
              }
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/sphere-relax-review.md",
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
                "runtimeAccepted": true,
                "acceptanceScope": "显式模块选择/隔离/误差诊断局部通过；非完整多格拟合"
              }
            },
            {
              "name": "分层平滑对照：已有形变保留，完整三模式待补",
              "id": "1670725072540106755",
              "status": "partial",
              "where": "src/terrain/shape.js · hierarchy.html",
              "page": "hierarchy.html",
              "note": "164帧全核验，原片依次切换三模式；保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。",
              "decodedFrames": 164,
              "reviewEvidence": "artifacts/coverage/hierarchy-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  163
                ],
                "nativeRevisits": [
                  5,
                  62,
                  64,
                  66,
                  72,
                  105,
                  113,
                  115,
                  117,
                  118,
                  119,
                  120,
                  148
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅本批学习/现有平滑审核；完整三模式待补"
              }
            },
            {
              "name": "Square yet hex：556帧；切角轮廓实验，原岩岛算法待补",
              "id": "1471817524148940807",
              "status": "partial",
              "where": "src/core/corner-footprint.js · corner-cuts.html",
              "page": "corner-cuts.html",
              "note": "556帧阶段生成/旋转岩岛。迁移Workbuddy切角作为共享格只读绘制轮廓实验，非原算法证明；不改World导航，完整岩岛模块生成未迁移。",
              "decodedFrames": 556,
              "reviewEvidence": "artifacts/coverage/corner-cuts-review.md",
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
                "acceptanceScope": "仅本地几何与Canvas轮廓，不是实际World地形/导航验收"
              }
            },
            {
              "name": "不规则三角底图：383帧已学，完整岛生成仍待补",
              "id": "1447496205282549761",
              "status": "partial",
              "where": "src/core/grid.js · src/terrain/generate.js",
              "page": "grids.html?t=kinds",
              "note": "全383帧核验，多个不规则三角底图到分层线框/完成岛例；完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。",
              "decodedFrames": 383,
              "reviewEvidence": "artifacts/coverage/tri-subtiles-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  382
                ],
                "nativeRevisits": [
                  18,
                  28,
                  118,
                  215,
                  334
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅全帧学习/底图与生成差距复核"
              }
            },
            {
              "name": "球面投影：径向索引/平面抽样与球面拓扑分开",
              "id": "1338829205157646336",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html?stage=tri",
              "page": "planet.html?stage=tri",
              "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
              "decodedFrames": 316,
              "reviewEvidence": "artifacts/coverage/sphere-stages-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  315
                ],
                "nativeRevisits": [
                  20,
                  41,
                  115,
                  170,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "阶段快照/实际GPU坐标/球面拓扑与平面抽样口径局部通过；非完整原算法接口或美术认证"
              }
            },
            {
              "name": "完美环：直线绕回起点时检测出来；飞岛玩法没做",
              "id": "1313837640366596096",
              "status": "partial",
              "where": "src/core/loop-lift.js · loop-lift.html",
              "note": "315帧全核（4张联系表+2张原尺寸）；完美环判定已有，新增 loop-lift：环内格抬升场+船壳厚度+等距支撑腿（3环/最大119格/11腿/船壳0.90）；缺飞行操控、船壳外沿白色构件、建筑随岛抬升",
              "decodedFrames": 315,
              "reviewEvidence": "artifacts/coverage/1313837640366596096-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  314
                ],
                "nativeRevisits": [
                  0,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "环→抬升场→船壳→支撑腿几何"
              }
            },
            {
              "name": "无限、确定、无缝的松弛四边形网格：一块块六边形冒出来",
              "id": "1151137783785771008",
              "status": "partial",
              "where": "src/core/infinite.js · grids.html（无限网格页签）",
              "page": "grids.html",
              "note": "449帧全核；六边块拼贴+块/簇各自松弛+三表示重心插值已实现，19块378对表示差3.7e-15；新增环数1/7/19三档对照片中一块块外长；仍缺真无限流式（页面最多19块）与块内疏密均匀度",
              "decodedFrames": 449,
              "reviewEvidence": "artifacts/coverage/1151137783785771008-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  448
                ],
                "nativeRevisits": [
                  1,
                  100,
                  300,
                  448
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "无限四边形网格"
              }
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974564862729838592",
              "status": "partial",
              "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
              "page": "grids.html?t=infinite",
              "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。",
              "decodedFrames": 478,
              "reviewEvidence": "artifacts/coverage/bary-prep-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  477
                ],
                "nativeRevisits": [
                  220,
                  477
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "同一局部XZ预计算接入，非原3D演示完整"
              }
            },
            {
              "name": "局部规则/放射模板：324帧核验，单补丁共享接缝；复杂孔洞拒绝、多模板待补",
              "id": "1301816247479345152",
              "status": "partial",
              "where": "src/core/radial-patch.js → World / WorldMesh；gridpatch.html",
              "page": "gridpatch.html",
              "note": "324帧复核：是六边形外轮廓中的规则四边格/放射模板与环形庭院，不是正六边形格子。补单个星形孔洞的规则内环/过渡四边格并复用原边界。48组25通过23明确拒绝；多补丁/完整手工库、填充世界迁移待补。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。",
              "decodedFrames": 324,
              "reviewEvidence": "artifacts/coverage/radial-dual-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  323
                ],
                "nativeRevisits": [
                  0,
                  35,
                  106,
                  110,
                  111,
                  138,
                  323
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "visualMatchAccepted": false
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
              "status": "partial",
              "where": "src/water/reflection.js · src/world/view.js",
              "toggle": "waves",
              "note": "270帧全核验：彩色中间倒影/宽岸裙，160起倒影与建筑线框。保留共享WorldMesh翻转，补实际水面上方裁切、受限深度淡出及线性颜色中点模块；GPU/双网格通过。未复现全部块面艺术与岸裙尺度。",
              "page": "reflection.html",
              "decodedFrames": 270,
              "reviewEvidence": "artifacts/coverage/reflection-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  269
                ],
                "nativeRevisits": [
                  0,
                  159,
                  160
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "id": "1758250248483278925",
              "status": "partial",
              "where": "src/water/reflection.js · src/world/view.js",
              "note": "516帧全核验：高崖、低平教堂、中高教堂岛依次转动，反射轮廓/颜色克制；原文没有公式。保留共享几何近似而不冒称原作算法，新增实际场景颜色混合/扰动/线框对照；完整反射投影/遮挡仍缺。",
              "page": "reflection.html",
              "decodedFrames": 516,
              "reviewEvidence": "artifacts/coverage/reflection-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  515
                ],
                "nativeRevisits": [
                  90,
                  150,
                  250
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              },
              "name": "新水面反射：多组岛屿对照"
            },
            {
              "name": "距离场浪裙",
              "id": "1664566546683899905",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-profile.js",
              "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过，独立原版buildShoreDistance API未迁移。",
              "decodedFrames": 340,
              "reviewEvidence": "artifacts/coverage/shore-review.md",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "岸线黄线 / 外推蓝线",
              "id": "1849732997945110651",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-profile.js",
              "toggle": "shorelines",
              "note": "437帧全复核：黄线贴岸/蓝线外推，270起红三角浪带；窄湾蓝线有交叠。修复黄线Chaikin切凸角、形变后仍用旧法线；只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。",
              "decodedFrames": 437,
              "reviewEvidence": "artifacts/coverage/shore-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  436
                ],
                "nativeRevisits": [
                  140,
                  269,
                  270,
                  436
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "循环顶点着色器岸浪（新项目）",
              "id": "1991101097818403263",
              "status": "partial",
              "where": "src/water/shore.js · src/core/wave-cycle.js",
              "toggle": "wavewire",
              "note": "477帧全复核：线框浪带展开/到岸，绕高崖与海蚀洞；README明确生成时烘入/出方向和时间偏移。补独立aIn/aOut/aPeriod；退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。",
              "page": "waves.html",
              "decodedFrames": 477,
              "reviewEvidence": "artifacts/coverage/wave-cycle-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  476
                ],
                "nativeRevisits": [
                  30,
                  70,
                  400
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "中间色倒影",
              "id": "1215644531221311488",
              "status": "partial",
              "where": "src/water/reflection.js · src/world/view.js",
              "toggle": "reflection",
              "note": "270帧全核验：彩色中间倒影/宽岸裙，160起倒影与建筑线框。保留共享WorldMesh翻转，补实际水面上方裁切、受限深度淡出及线性颜色中点模块；GPU/双网格通过。未复现全部块面艺术与岸裙尺度。",
              "page": "reflection.html",
              "decodedFrames": 270,
              "reviewEvidence": "artifacts/coverage/reflection-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  269
                ],
                "nativeRevisits": [
                  0,
                  159,
                  160
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "叠片采样 SDF 的水体",
              "id": "1758251637280268481",
              "status": "partial",
              "where": "src/water/watervol.js · src/water/land-distance.js",
              "toggle": "watervol",
              "note": "213帧全核验：小岛镜头降到水面，线框/倒影随角度变化；原文说叠平面采SDF，未说明维度。保留本地浅水近似，补各向异性精确2D中心距离、level1遮罩、版本缓存/空场清理/共享资源释放，实际双网格通过；不同于原片完整反射效果。",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/life/boats.js · src/core/wake-sampling.js",
              "toggle": "boats",
              "page": "wake-fog.html",
              "note": "138帧全核验。保留绕岛V形带状船迹，补连续时间采样/相位余量/帧内插值，30/60/120Hz实际采样数和年龄一致；重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。",
              "decodedFrames": 138,
              "reviewEvidence": "artifacts/coverage/wake-fog-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  137
                ],
                "nativeRevisits": [
                  0,
                  45,
                  90,
                  137
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地带状尾迹时间采样与圆盘雾边界/控制局部通过；非原作完整粒子/软片/体积雾等价"
              }
            },
            {
              "name": "动态海面但不抢戏：极低幅度的颜色漂移",
              "id": "1991103578011029507",
              "status": "partial",
              "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
              "note": "529帧全复核：固定教堂岛，主要动态为分段白色近岸浪；不把“克制动态海洋”推断为现有整片海面颜色漂移公式。保留本地背景处理但纠正归因，新增可开关沿岸周期分段浪峰，实际双网格GPU对照通过。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "新的岸浪",
              "id": "1991099314714902634",
              "status": "partial",
              "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
              "note": "545帧全复核：高崖岛/海蚀洞换角度，白色岸浪分段展开/聚散；README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。",
              "page": "waves.html",
              "decodedFrames": 545,
              "reviewEvidence": "artifacts/coverage/wave-crest-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  544
                ],
                "nativeRevisits": [
                  180,
                  240
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "岸浪：许多重叠的浪各走各的周期",
              "id": "1849730611964973481",
              "status": "partial",
              "where": "src/water/shore.js · src/core/wave-cycle.js",
              "note": "599帧全复核：微弱错开岸浪、镜头移位、408起红色重叠三角带。保留实际多浪带，各层烘不同周期，闭环弧长相位改整周期频率，避免接缝正弦频率不闭合。到岸opacity连续，循环端隐藏。GPU/实际双网格通过；泡沫mask/窄湾交叠仍缺。",
              "page": "waves.html",
              "decodedFrames": 599,
              "reviewEvidence": "artifacts/coverage/wave-cycle-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  598
                ],
                "nativeRevisits": [
                  50,
                  407,
                  408
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "岸线渲染：Bad North / Townscaper 那套的改良版（距离场浪裙）",
              "id": "1666429884208381953",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
              "note": "630帧全核验：旋转/固定高崖岛，凹湾与白色岸裙细微聚散；原文只说Bad North/Townscaper改良版，不证明具体距离算法。共享水层改规范绕序/按左侧陆地转向及自接闭环分解，1024组合及实际双网格通过；蓝线窄湾交叠/泡沫mask仍缺。",
              "page": "shoreloops.html",
              "decodedFrames": 630,
              "reviewEvidence": "artifacts/coverage/shore-topology-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  629
                ],
                "nativeRevisits": [
                  80,
                  200,
                  400
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "整个项目放到水上：小镇场景就是水上码头",
              "id": "1215642481162887168",
              "status": "partial",
              "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
              "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。保留已有实际World小镇，补角接分岛/加桥合并的闭环稳定性；真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。",
              "page": "shoreloops.html",
              "decodedFrames": 330,
              "reviewEvidence": "artifacts/coverage/shore-topology-review.md",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "浮点GPU能力探测",
              "id": "1664565063552847873",
              "status": "partial",
              "where": "src/world/float-probe.js · float.html",
              "page": "float.html",
              "note": "117帧已核验；本环境16F/32F写入、负值/HDR回读和线性过滤通过；跨平台及平流/CPU误差待补。",
              "decodedFrames": 117,
              "reviewEvidence": "artifacts/coverage/float-probe-review.md",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
              "toggle": "ao",
              "page": "ao-stages.html",
              "note": "551帧全核，保留分层烘焙，新增实际遮蔽/反弹分离对照及恢复验收；原GPU重投影/动态纹理仍缺。",
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
                "acceptanceScope": "本地分层烘焙实际对照/恢复局部，不是原GPU管线"
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
              "status": "partial",
              "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
              "toggle": "time",
              "note": "501帧全核验：二维太阳盘与滑条改变光照，夜间窗户亮，457附近恢复白天。保留原有日夜/太阳方位，补方位+高度控制共享真实View及水面三场阴影；不是复制原界面或完整地平线日照模拟。",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/core/camera-motion.js · src/world/view.js",
              "toggle": "motionblur",
              "note": "337帧全核验。保留上一批历史帧/释放修复，新增按dt换算的历史留存，30/60/120Hz实际渲染参数通过；原片方向性轮廓拖抹、速度场与全指标接口仍待补。",
              "decodedFrames": 337,
              "reviewEvidence": "artifacts/coverage/palette-transition-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  336
                ],
                "nativeRevisits": [
                  40
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "局部历史权重/可选墙色过渡，非原片完整算法或视觉等价"
              },
              "page": "index.html?scene=terrain&on=motionblur"
            },
            {
              "name": "六方向体积：213帧核验，法线采样/太阳DDA；SDF/mega反馈待补",
              "id": "1580845127207387137",
              "status": "partial",
              "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
              "page": "lightvolume.html",
              "note": "213帧复核：原文SDF距离/UV→mega-texture→六方向体积。新增可选六RGB方向/法线权重、静态命中缓存、太阳有限DDA和切片；真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。",
              "decodedFrames": 213,
              "reviewEvidence": "artifacts/coverage/directional-bounce-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  212
                ],
                "nativeRevisits": [
                  0,
                  70,
                  110,
                  160,
                  212
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "地表纹理阴影近似：投射资格与深度比较分开；屋檐/纹理浮凸待补",
              "id": "1705195380457996629",
              "status": "partial",
              "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
              "note": "300帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
              "decodedFrames": 300,
              "reviewEvidence": "artifacts/coverage/surface-shadow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  299
                ],
                "nativeRevisits": [
                  12
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "仅共享World地表高度场局部近似；原片完整纹理/屋檐效果待补"
              },
              "page": "surface-shadows.html"
            },
            {
              "name": "地表纹理阴影近似：投射资格与深度比较分开；屋檐/纹理浮凸待补",
              "id": "1704218784028905984",
              "status": "partial",
              "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
              "note": "335帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
              "decodedFrames": 335,
              "reviewEvidence": "artifacts/coverage/surface-shadow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  334
                ],
                "nativeRevisits": [
                  70
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "仅共享World地表高度场局部近似；原片完整纹理/屋檐效果待补"
              },
              "page": "surface-shadows.html"
            },
            {
              "name": "半影：阴影画三遍（正常、稍收、大体素）。重构版用 PCF 软阴影，没有三遍叠",
              "id": "1305951750638231552",
              "status": "partial",
              "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
              "note": "521帧全核验：塔楼编辑/旋转与长影，409起RGB阴影纹理通道检查。共享World顶面派生三场水面阴影，正确保留粗格世界尺度/最高遮挡、内收/合成与预算；真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "平涂 / 着色 / 只看光照 / AO 烘焙网格四种视图：前三种有（面板开关），AO 烘焙网格的可视化没做",
              "id": "1298689301488775169",
              "status": "partial",
              "where": "src/world/ao-mesh-debug.js + src/world/view.js setDebug('aomesh') · environment-panel 能力面板",
              "note": "544帧六张联系表全核；平涂/着色/只看光照三种原有，本轮补第四种 AO 烘焙网格（buildBakeShellGeometry 逐层体素壳 608面/1216三角、面板可勾）；缺半透明层叠画法、壳不含建筑体积、原片四小部件界面未复刻",
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
              "name": "GI峡谷：185帧复核，保留体素反弹；原版形因子/参考接口缺口",
              "id": "1580835075629133825",
              "status": "partial",
              "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
              "page": "lightvolume.html",
              "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。原版2.5D形因子gather/暴力参考接口未迁移，映射改列部分，已有重构保留。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "反弹过程：41帧核验，0/1/3/6次与实测变化；完整往返反馈待补",
              "id": "1580846877855338497",
              "status": "partial",
              "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
              "page": "lightvolume.html",
              "note": "41帧复核（不是旧注释11帧）：重置→直射→体积→阴影填充。新增0/1/3/6次实景对照与每次平均/最大/相对变化，取消“任意场景第三次后不变”推断。两网格实测变化递减，但不是原片像素误差或普遍收敛证明；完整贴图/体积往返反馈仍缺。",
              "decodedFrames": 41,
              "reviewEvidence": "artifacts/coverage/directional-bounce-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  40
                ],
                "nativeRevisits": [
                  7,
                  10,
                  17,
                  19,
                  25,
                  40
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
              "page": "lightvolume.html",
              "note": "425帧全复核：旋转、线框/重建、法线/SDF/六AO图。补各向异性精确体素中心EDT、保守距离下界步进+DDA兜底，六向距离AO及梯度法线诊断接真实View；不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。",
              "decodedFrames": 425,
              "reviewEvidence": "artifacts/coverage/distance-ao-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  424
                ],
                "nativeRevisits": [
                  0,
                  150,
                  219,
                  220,
                  221,
                  224,
                  300,
                  424
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "name": "洞内多层可站点、净空与门户边（已接入战斗，精细碰撞待补齐）",
              "id": "797119718477991936",
              "status": "partial",
              "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
              "page": "navigation.html",
              "note": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。",
              "decodedFrames": 265,
              "reviewEvidence": "artifacts/coverage/battle-navigation-review.md"
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
              "status": "partial",
              "where": "src/core/region-boundary.js · src/world/contour-overlay.js（selectCell 定宽折线 / #buildGizmo）· index.html?scene=terrain&on=contours",
              "page": "contour.html",
              "toggle": "contours",
              "note": "703帧全核（8张联系表0-702 + 原尺寸0210/0300 与3倍放大裁切）；边界已是 LineSegments 硬件1px、走格边闭环/开放端/捏点；本轮补两件——选中格屏幕空间定宽金黄折线（每边一四边形+NDC屏幕法向偏移，实测 width3.5px、outlineQuads=格边数）与屏幕恒定 RGB 三轴 gizmo（近d9 0.806→远d22 1.976，比2.45≈距离比2.44）；浏览器真跑 ok、pageerror/console 0；仍缺格角小白点层、格心黄点与黄色竖列、边界按区域换色",
              "decodedFrames": 703,
              "reviewEvidence": "artifacts/coverage/1120036868966502401-review-r53.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  702
                ],
                "nativeRevisits": [
                  210,
                  300,
                  660
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "沿格边区域边界 + 选中格定宽金黄折线 + 屏幕恒定 gizmo（真实 WebGL 与双机位像素宽度）"
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
              "status": "partial",
              "where": "src/core/space-visibility.js · src/world/space-visibility.js · space-visibility.html",
              "page": "space-visibility.html",
              "note": "64帧全核；原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。",
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
                "acceptanceScope": "共享World单点3D固定步长开阔度诊断"
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
              "status": "partial",
              "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
              "page": "doodle.html",
              "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
              "decodedFrames": 108,
              "reviewEvidence": "artifacts/coverage/doodle-review.md"
            },
            {
              "id": "1890018647655272491",
              "name": "黑白走廊研究：单色表面、稳定布局；弧顶/门口版式待补",
              "toggle": "doodlegray",
              "status": "partial",
              "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
              "page": "doodle.html",
              "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
              "decodedFrames": 243,
              "reviewEvidence": "artifacts/coverage/doodle-review.md"
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
              "note": "908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。",
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
              "status": "partial",
              "where": "src/core/field-surface.js · field-surface.html",
              "page": "field-surface.html",
              "note": "302帧全核（4张联系表+5张原尺寸）；白模黏土岛形态循环，柱顶半球/崖棱倒角/无一根方格边=占位场模糊后抽等值面，切换时先缩到消失再长成；新建 field-surface.js，做到崩解重组+平滑等值面，缺水面真倒影/暗色碎片/带状水线/坡屋顶细节",
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
              "status": "partial",
              "where": "src/core/field-surface.js · field-surface.html",
              "page": "field-surface.html",
              "note": "192帧全核（2张联系表+3张原尺寸）；同一工具的带投影录屏，确认地形走等值面、房子是独立硬边几何；共用 field-surface.js，缺'地形圆角+建筑硬棱'的分层混合",
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
                "acceptanceScope": "等值面 + 碎块崩解重组（与818857408848130048共用）"
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
              "status": "partial",
              "where": "src/core/region-boundary.js · src/world/contour-overlay.js（selectCell 定宽折线 / #buildGizmo）· index.html?scene=terrain&on=contours",
              "page": "contour.html",
              "note": "703帧全核（8张联系表0-702 + 原尺寸0210/0300 与3倍放大裁切）；边界已是 LineSegments 硬件1px、走格边闭环/开放端/捏点；本轮补两件——选中格屏幕空间定宽金黄折线（每边一四边形+NDC屏幕法向偏移，实测 width3.5px、outlineQuads=格边数）与屏幕恒定 RGB 三轴 gizmo（近d9 0.806→远d22 1.976，比2.45≈距离比2.44）；浏览器真跑 ok、pageerror/console 0；仍缺格角小白点层、格心黄点与黄色竖列、边界按区域换色",
              "decodedFrames": 703,
              "reviewEvidence": "artifacts/coverage/1120036868966502401-review-r53.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  702
                ],
                "nativeRevisits": [
                  210,
                  300,
                  660
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "沿格边区域边界 + 选中格定宽金黄折线 + 屏幕恒定 gizmo（真实 WebGL 与双机位像素宽度）"
              }
            },
            {
              "name": "2 模块装配（原作 545 块，这里用规则生成）+ 模块签名调试色：同一种邻居占用 = 同一块拼图 = 同一种颜色",
              "id": "1279107097108635649",
              "status": "partial",
              "where": "src/build/buildings.js（moduleSig/sigColor） · src/ui/environment-panel.js「模块签名配色」",
              "toggle": "modules",
              "note": "256帧全核；把拼图块平铺在网格上飞行巡览，同一种邻接签名同色（原文545块）。签名算法与片子口径一致(n/上下层/逐边实心)，但只给墙身上色(底座/屋顶/窗饰仍原色)，没有零件目录页；本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 modules 开关加进场景面板，截图对比确认墙面分色",
              "decodedFrames": 256,
              "reviewEvidence": "artifacts/coverage/1279107097108635649-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  255
                ],
                "nativeRevisits": [
                  0,
                  100,
                  200,
                  255
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "签名分色与种类计数；无545规模目录页"
              }
            },
            {
              "id": "1344290848180203523",
              "name": "复杂悬空建筑QA：共享World编辑压力回放（局部验收）",
              "status": "partial",
              "where": "src/core/qa-replay.js · qa-replay.html",
              "page": "qa-replay.html",
              "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。",
              "decodedFrames": 814,
              "reviewEvidence": "artifacts/coverage/qa-palette-review.md",
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
                "acceptanceScope": "双网格16步本地QA、成功/异常恢复、现有墙槽/固定材质身份；非完整原作视觉或算法等价"
              }
            },
            {
              "name": "3 建筑增删、暖橙屋顶与多色墙（原帖重点含饱和度、庭院草地和彩色反弹）",
              "id": "1197909675443916803",
              "status": "partial",
              "where": "src/build/buildings.js · src/light/bake.js · wall-palette.html",
              "tour": "gable",
              "note": "456帧全核验：原帖重点为显示器饱和度纠偏、建筑效果、花园草地和彩色反弹光。可见多色墙与暖橙屋顶；不将“屋顶永远”或彩色反弹数学当视频证明。本批回归墙色私有编辑不改固定BUILD/位置，保留已有烘焙和草地；完整原作视觉与参数未复现。",
              "decodedFrames": 456,
              "reviewEvidence": "artifacts/coverage/qa-palette-review.md",
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
                "acceptanceScope": "双网格16步本地QA、成功/异常恢复、现有墙槽/固定材质身份；非完整原作视觉或算法等价"
              }
            },
            {
              "name": "296帧：钢架编辑全核，完整WFC待补",
              "id": "1189902695303458816",
              "status": "partial",
              "where": "src/build/buildings.js（保留已有钢架；本批仅学习）",
              "tour": "stilt",
              "page": "building-components.html",
              "note": "296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/building-components-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅学习，不计新算法迁移"
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
              "status": "partial",
              "where": "src/core/opening-footprint.js · src/build/buildings.js",
              "page": "index.html?scene=town",
              "note": "261帧完整建屋/编辑，非旧注释6帧空格变面。保留既有正矩形门窗，修放置只计框宽遗漏1.6倍窗台外缘；2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。",
              "decodedFrames": 261,
              "reviewEvidence": "artifacts/coverage/opening-footprint-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  260
                ],
                "nativeRevisits": [
                  3,
                  4,
                  90,
                  154,
                  210,
                  260
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "实际建筑门窗全外缘安全距离局部通过；非全家具系统"
              }
            },
            {
              "name": "6 围合庭院：按实际墙层识别开口，上层桥不再封院",
              "id": "1238474550511308800",
              "status": "partial",
              "where": "src/core/courtyards.js · src/build/buildings.js · garden.html",
              "tour": "yard",
              "page": "garden.html",
              "note": "202帧全核验。提取共享courtyards分类器，院墙按地面上实际第2层实心判定，修复上层桥/悬空屋顶误封闭；双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。",
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
                "runtimeAccepted": true,
                "acceptanceScope": "庭院墙层开口局部算法已实测；道具生命周期仅审计出缺口，运行验收未完成"
              }
            },
            {
              "name": "六类局部墙饰接实际建筑；跨格整立面/真实洞口待补",
              "id": "1181464374839521280",
              "status": "partial",
              "where": "src/core/building-components.js · src/build/buildings.js · building-components.html",
              "toggle": "stairs",
              "page": "building-components.html",
              "note": "全帧核验；悬空/跨层组件独立身份已接实际窗型，双网格通过；独立装饰WFC仍缺 旧片续作：六类1–3槽墙段WFC/实绘百叶与装饰圆拱接实际建筑，双网格局部验收；跨格整墙/真正洞口仍缺。",
              "decodedFrames": 505,
              "reviewEvidence": "artifacts/coverage/facade-decoration-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  504
                ],
                "nativeRevisits": [
                  128,
                  292,
                  504
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "六类局部墙段与实绘邻窗约束局部验收，非完整立面/物理洞口"
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
              "status": "partial",
              "where": "src/life/effects.js · index.html（建造/拆除触发）",
              "note": "436帧全核；落水/拆到水面触发水花：现有实现=1圈泡沫环(1.1s)+26颗飞沫(重力-5.5、落水即灭)，事件口径与片一致但只压到一半观感；片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命",
              "decodedFrames": 436,
              "reviewEvidence": "artifacts/coverage/1258421104756097029-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  435
                ],
                "nativeRevisits": [
                  343,
                  391,
                  435
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "水花触发口径；观感未达原片"
              }
            },
            {
              "name": "8f 道具出现/消失：已逐帧，独立生命周期待接（现仅柱顶增长/灰尘）",
              "id": "1246074663546916873",
              "status": "partial",
              "where": "src/life/effects.js（局部增长/灰尘反馈，非完整道具生命周期）",
              "note": "306帧全核验，确认道具会随布局变化出现/消失；旧uPops只是柱顶增长的局部缩放，拆除灰尘不是逐道具缩没。保留原反馈但src/propanim映射改部分覆盖，稳定身份/保留消失几何/错峰及原CPU接口均待接，未记运行验收完成。",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/courtyard-props-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  305
                ],
                "nativeRevisits": [
                  0,
                  29,
                  56,
                  85,
                  157,
                  226,
                  252,
                  305
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "庭院墙层开口局部算法已实测；道具生命周期仅审计出缺口，运行验收未完成"
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
              "status": "partial",
              "where": "src/badnorth/battle.js（#longship deckPool / #bleed）· src/core/platform-anchor.js · index.html?scene=badnorth",
              "page": "scene:badnorth",
              "note": "440帧全核（5张联系表+9处原尺寸/5-11倍船体裁切）；补出「整舱浸透」：舱底贴凹曲线做25段血池带（gore→opacity 0.94、沿船长铺到 scaleX 1.0、边缘不规则齿），船壳色只走到 hullBlood 75% 以保留外侧栗木色；船上人6死8人时 gore=1、血池满；仍缺船外沿岸白泡沫带与沿岸成片白花簇",
              "decodedFrames": 440,
              "reviewEvidence": "artifacts/coverage/946660607008403456-review-r54.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  439
                ],
                "nativeRevisits": [
                  0,
                  120,
                  200,
                  439
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "船上血/尸体/箭附着 + 整舱浸透成片红"
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
              "where": "src/world/save.js · save-mesh.html",
              "page": "save-mesh.html",
              "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。保留本地v5，修复解码先清岛导致坏输入破坏、游程越界/尾随垃圾、空列色槽/河道丢失及北境场景身份；实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。",
              "decodedFrames": 321,
              "reviewEvidence": "artifacts/coverage/save-mesh-review.md",
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
                "acceptanceScope": "本地v5原子解码/实际重载与主体GPU提交验证；不等同原作格式、完整状态或Switch性能复现"
              }
            },
            {
              "name": "9b 撤销历史回放：可停止/保岛，截断历史偏移已修复（动作特效另补）",
              "id": "1260586697538113537",
              "status": "partial",
              "where": "src/core/snapshot-replay.js · src/world/app.js",
              "page": "index.html?scene=town",
              "note": "167帧全核验。保留撤销栈快照回放，修复60条截断后sceneStart偏移、回放中编辑污染以及异常/取消不恢复；新增只读/取消回放helper和Esc/再次点击停止。正常结束、取消、UI锁和撤销重做保留已双网格实测；完整动作动画/水花音效、镜头和节奏录制仍缺。",
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
              "where": "src/life/smoke.js · src/core/smoke-order.js · smoke.html",
              "page": "smoke.html",
              "note": "303帧全核（4张联系表四栏对照+5处原尺寸）；两遍结构/明度116/阈值内收/深度排序均成立，smoke.js 本轮未改，运行时验收沿用第43轮 smoke-browser 实测（本轮未复跑）；轮廓凹凸仍未复刻：原片上边缘10-13个各自凸出的圆弧，本仓所有烟团共享同一轨迹与同一 s=0.24+age*0.95 尺寸函数，外边界是一条光滑带；已排除「横向漂移+尺寸抖动」「抬高噪声幅度」两条路；下轮改按seed取单卡UV缩放0.35-0.75+多子发射点，判据改用外轮廓径向局部极大值个数",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/1015142746372366336-review-r54.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  302
                ],
                "nativeRevisits": [
                  0,
                  100,
                  150,
                  200,
                  302
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "两遍结构+明度+相机深度排序（不含轮廓凹凸）"
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
              "status": "partial",
              "name": "123帧：水渠/穿楼拱洞，局部曲线验收",
              "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
              "page": "arches.html",
              "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。",
              "decodedFrames": 123,
              "reviewEvidence": "artifacts/coverage/arch-profile-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  122
                ],
                "nativeRevisits": [
                  17,
                  64,
                  90
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享拱底曲线采样局部，不是原桥梁/穿楼完整复现"
              }
            },
            {
              "id": "802496920790777856",
              "status": "partial",
              "name": "292帧：水渠/穿楼拱洞，局部曲线验收",
              "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
              "page": "arches.html",
              "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。",
              "decodedFrames": 292,
              "reviewEvidence": "artifacts/coverage/arch-profile-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  291
                ],
                "nativeRevisits": [
                  0,
                  185,
                  291
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享拱底曲线采样局部，不是原桥梁/穿楼完整复现"
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
              "status": "partial",
              "where": "src/core/wfc.js · src/build/buildings.js",
              "note": "67帧全核，仅学习；底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。",
              "decodedFrames": 67,
              "reviewEvidence": "artifacts/coverage/space-visibility-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅学习，原3D拼装待迁移"
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
              "status": "partial",
              "where": "src/world/voxel-ghost.js · voxel-ghost.html",
              "page": "voxel-ghost.html",
              "note": "117帧全核；与 794993371261665280 共用 voxel-ghost.js，页面加 radial 装配序 + 点按装配序出现（order 模式点恒为前缀，实测 t=0.06 点 317/949），复现由中轴向外先点后实体；缺片中那根独占中轴竖柱（模型需自带中轴柱）、任意网格体素化、片尾 dolly",
              "decodedFrames": 117,
              "reviewEvidence": "artifacts/coverage/797844857821732864-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  116
                ],
                "nativeRevisits": [
                  40
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "体素幽灵点序/radial 装配/逐格实体化"
              }
            },
            {
              "id": "794993371261665280",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/world/voxel-ghost.js · voxel-ghost.html",
              "page": "voxel-ghost.html",
              "note": "158帧全核；新建 voxel-ghost.js（体素化/三套装配序/点→线框→实心四态时间线/等轴测）+ voxel-ghost.html 三联对照，实测 949 格 t=0.13 全点、0.34 线框780+实体80共存、1 全实心；缺任意网格体素化(UV/空腔)、逐层材质分组、Go!一次性触发",
              "decodedFrames": 158,
              "reviewEvidence": "artifacts/coverage/794993371261665280-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  157
                ],
                "nativeRevisits": [
                  10,
                  44
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "体素幽灵三态预览/装配序/逐格实体化"
              }
            },
            {
              "id": "784848286272327680",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "272帧全核；planet.js 的 assemblyOrder(frontier)/assemblySlice/planetMesh(only) 三档实测 37/185/383/618 格、前沿断口侧壁可见，与片子单粒起点→前沿铺满一致；缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块",
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
                "acceptanceScope": "球面胞元壳前沿装配/断口侧壁"
              }
            },
            {
              "id": "784847588893814785",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "270帧全核；与 784847933686575104 共用同一落点（装配生长/断口侧壁/薄壳/白模）；片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现",
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
                "acceptanceScope": "球面胞元装配生长/断口侧壁/薄壳/白模"
              }
            },
            {
              "id": "784847933686575104",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "268帧全核；planet.js 补 assemblyOrder/assemblySlice + planetMesh(only)，页面加装配滑杆/白模/薄壳，铺满618格，四档顶点 5907→19797→29508→24765（铺满后断口侧壁消失）；缺装配起点可指定与格内细分",
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
                "acceptanceScope": "球面胞元装配生长/断口侧壁/薄壳/白模"
              }
            },
            {
              "id": "1430227487376781317",
              "name": "Plus you can change the in-game textures now! So…",
              "status": "partial",
              "where": "src/core/palette.js · src/build/buildings.js（无 surface 图集）",
              "page": null,
              "note": "279帧全核；判出真机制：全城建筑共用一张总贴图 TownColor.png（PS 标题栏 200% Layer0 RGB/8 证实），改这张图即整城换肤（0207后墙面屋顶全变蓝涂鸦）；本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换",
              "decodedFrames": 279,
              "reviewEvidence": "artifacts/coverage/1430227487376781317-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  278
                ],
                "nativeRevisits": [
                  150
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "共享总贴图/热替换判读，未改代码"
              }
            },
            {
              "id": "1427721874490933250",
              "name": "Here's a very quick technical test. Though this …",
              "status": "partial",
              "where": "src/terrain/blotch-pattern.js（斑块/贴花）",
              "page": null,
              "note": "188帧全核；判出真机制：每帧累加方块贴花导致 line boil（贴花密集处相邻帧差分 mean 5.4→7.3），且需图集 padding；本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了",
              "decodedFrames": 188,
              "reviewEvidence": "artifacts/coverage/1427721874490933250-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  187
                ],
                "nativeRevisits": [
                  0,
                  90
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "贴花累加画风判读，未改代码"
              }
            },
            {
              "id": "1310503825510367232",
              "name": "Ok, I tried the mixed perspective. Note how hous…",
              "status": "partial",
              "where": "src/core/mixed-perspective.js · mixed-perspective.html",
              "page": "mixed-perspective.html",
              "note": "200帧全核；原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→远处照旧变小。新增src/core/mixed-perspective.js+实验页四块同尺寸标尺，帧缓冲量得k=1上下沿等宽/竖边横移0px、宽度88→47仍递减，k=0与普通透视逐值相同。缺：主视图view.js未接(k=0默认)、pick/倒影相机矩阵未同步、原版Unity移轴逐像素未对",
              "decodedFrames": 200,
              "reviewEvidence": "artifacts/coverage/1310503825510367232-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  199
                ],
                "nativeRevisits": [
                  35,
                  115
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "混合透视投影（竖线平行+近大远小）"
              }
            },
            {
              "id": "1302686201401442309",
              "name": "A smoothing and inversion bug I came across whil…",
              "status": "partial",
              "where": "src/core/infinite.js（verify 拉伸度量）· grids.html（网格实验室 无限网格）",
              "page": "grids.html",
              "note": "241帧全核；画面就是bug现场：翻折块塌成深色皱褶、非翻折邻块被拉长成跨块巨块。verify()原只查翻折/接缝，量不到第二种症状，本轮补了以本格原始点阵为基准的拉伸度量(maxStretch/minShrink/maxEdgeStretch/stretched)并在grids.html显示；实测passes60时翻折0、拉伸最大1.83×、无格超2×；还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×)",
              "decodedFrames": 241,
              "reviewEvidence": "artifacts/coverage/1302686201401442309-review.md",
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
                "acceptanceScope": "无限网格松弛拉伸/翻折验收"
              }
            },
            {
              "id": "1275089608758484992",
              "name": "It has not escaped some of you that I have yet t…",
              "status": "partial",
              "where": "src/render/opening-punch.js（rise 拱顶洞口）· src/core/ladder-profile.js（竖梯，已有）· opening-punch.html",
              "page": "opening-punch.html",
              "note": "369帧全核；原文说的church doors与ladders都拍到了：竖梯(双梁+约14横档，水面爬到高脚楼底)本仓ladder-profile.js已有；教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析面积/命中/像素账/ShapeGeometry挡模板)，还缺接进buildings.js与页面第四栏、洞内墙面与台阶",
              "decodedFrames": 369,
              "reviewEvidence": "artifacts/coverage/1275089608758484992-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  368
                ],
                "nativeRevisits": [
                  1,
                  250,
                  360
                ],
                "implementationVerified": true,
                "runtimeAccepted": false,
                "acceptanceScope": "高拱龛洞口几何；渲染未接建筑"
              }
            },
            {
              "id": "1257213678056857600",
              "name": "Alrighty. First 20 people to reply gets a b e t …",
              "status": "partial",
              "where": "src/build/buildings.js（legs 段） · architecture.html",
              "page": "architecture.html",
              "note": "296帧全核；9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片中红屋右下角那根斜接到下方白屋屋脊的长斜杆本仓没有，腿也不会随下方支撑点水平偏移而内倾，高脚塔的通长腿还缺分段/接头表现；本轮未改代码",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/1257213678056857600-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  295
                ],
                "nativeRevisits": [
                  80,
                  130,
                  185
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "悬空体块支撑腿：竖腿/腿脚三角撑已实现，长斜撑与偏移支撑缺失"
              }
            },
            {
              "id": "1205422438437273601",
              "name": "For doors and windows, I use som stencil buffer …",
              "status": "partial",
              "where": "src/render/opening-punch.js · opening-punch.html",
              "page": "opening-punch.html",
              "note": "390帧全核；确有机制（非贴片）：洞口写 stencil 让墙体拒绘、z-buffer 少一块，隔层空间透出且随镜头有视差；已做独立原型+三栏对照，缺墙体厚度/洞口侧壁与主管线接入",
              "decodedFrames": 390,
              "reviewEvidence": "artifacts/coverage/1205422438437273601-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  389
                ],
                "nativeRevisits": [
                  1,
                  140,
                  300
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "模板挖洞 vs 贴片：11 洞口逐像素对照、洞外墙体不变、重复渲染零漂移；未接入 buildings.js，无厚度侧壁"
              }
            },
            {
              "id": "1163836000688365571",
              "name": "Basic marching cubes on my funky grid. Next up i…",
              "status": "partial",
              "where": "src/core/contour.js（2D marching squares）· contour.html；缺 src/core/ 下 3D 等值面模块",
              "page": "contour.html",
              "note": "353帧全核；判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（contour.js，见1120036868966502401），缺3D 256情形查表+顶点焊接+生长动画，本轮不写代码",
              "decodedFrames": 353,
              "reviewEvidence": "artifacts/coverage/1163836000688365571-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  352
                ],
                "nativeRevisits": [
                  100,
                  300
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "机制判读与同族模块定位；3D 等值面未实现、未验收"
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
              "status": "partial",
              "where": "src/core/frontier.js · campaign.html",
              "page": "campaign.html",
              "note": "已学14帧续项：外围padding、避让节点的边中点通路、自适应Bezier采样通过96条逻辑/24项页面；两侧细分未实现。",
              "decodedFrames": 14,
              "reviewEvidence": "artifacts/coverage/frontier-review.md",
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
                  9,
                  10,
                  11,
                  12,
                  13
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "软坡＋硬崖：656帧复核，完整连续坡/无局部低洼生成待补；层级XZ形变不能替代",
              "id": "1447488323845509121",
              "status": "partial",
              "where": "src/terrain/generate.js · shape.js（软坡/侵蚀保证待补）",
              "page": "overhang.html",
              "note": "656帧全核验：缓坡/硬崖同框、多组生成的稀疏白线/暗轮廓/完整岛与旋转。配文明确侵蚀有效无局部低洼，但画面不能证明该保证；现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。",
              "decodedFrames": 656,
              "reviewEvidence": "artifacts/coverage/slope-cliff-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  655
                ],
                "nativeRevisits": [
                  440,
                  510
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              }
            },
            {
              "name": "3 河网：填洼/汇水累计重建接共享World；原球面联合坍缩待补",
              "id": "1769691526924292506",
              "status": "partial",
              "where": "src/terrain/generate.js",
              "page": "drainage.html",
              "note": "194帧全核验；已有DFS开挖/局部削岸保留，不能冒充球面河道约束坍缩＋其余BFS缓坡，完整生成本批待实现。 复用194帧续作，汇水累计/出口树接共享World真实河网，双网格6组局部通过；完整球面WFC/BFS仍缺。",
              "decodedFrames": 194,
              "reviewEvidence": "artifacts/coverage/river-network-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  193
                ],
                "nativeRevisits": [
                  65,
                  115
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "计格汇水/出口树重建接平面连续岩柱World，非原球面完整坍缩"
              }
            },
            {
              "name": "边层级：共享切面显式硬边；模块/材质边语义待补",
              "id": "1670720537662836736",
              "status": "partial",
              "where": "src/terrain/shape.js · hierarchy.html",
              "toggle": "smooth",
              "page": "hierarchy.html",
              "note": "102帧全核验；共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。",
              "decodedFrames": 102,
              "reviewEvidence": "artifacts/coverage/hierarchy-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  101
                ],
                "nativeRevisits": [
                  19,
                  29,
                  38,
                  63
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "现有共享切面显式硬边输入局部通过；非原3D边语义全实现"
              }
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/sphere-relax-review.md",
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
                "runtimeAccepted": true,
                "acceptanceScope": "显式模块选择/隔离/误差诊断局部通过；非完整多格拟合"
              }
            },
            {
              "name": "弯层理：可逆Y剪切纹理场、几何保持原位；同位置相位/三角剖分GPU无缝",
              "id": "1699146321318314094",
              "status": "partial",
              "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
              "page": "sediment.html",
              "toggle": "strata",
              "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。原作场未知，不宣称完整通用3D逆场和原CPU指标API迁移。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "树转镜：旋转锚点/正交与透视/周界GPU通过；原octagonal卡片与俯仰仍缺",
              "id": "1849427564034498642",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "impostor",
              "page": "impostors.html",
              "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；原球面卡片/多俯仰仍缺。",
              "decodedFrames": 334,
              "reviewEvidence": "artifacts/coverage/impostor-view-review.md",
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
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界及背景云GPU局部通过；非原球面卡片、多俯仰或完整云形"
              }
            },
            {
              "name": "蓬松云：共享树云材质/时钟/遮挡回归通过；原云形/层次仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html",
              "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。",
              "decodedFrames": 235,
              "reviewEvidence": "artifacts/coverage/impostor-view-review.md",
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
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界及背景云GPU局部通过；非原球面卡片、多俯仰或完整云形"
              }
            },
            {
              "name": "9 分层避障风场：通洞/封洞与共享风向已验；完整轨迹接口待补",
              "id": "926903893866541057",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/world-probes.js",
              "toggle": "wind",
              "page": "flow.html",
              "note": "516帧全核验；保留按层避障/三线性风场与共享uWind，双网格通洞/封洞及改风向运行复核。原片矢量受空间障碍影响，不能据画面恢复精确解算器；完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。",
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
                "acceptanceScope": "本地分层风场保留复核 / 雪片真实层碰撞局部通过；非原作完整风接口、雪片造型/AO与冬景等价"
              }
            },
            {
              "name": "10 受风雪片：真实层碰撞保留洞口；简单白点/表面混白，软片与AO待补",
              "id": "943230624369868800",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/world-probes.js",
              "toggle": "snow",
              "page": "flow.html",
              "note": "318帧全核验；修复屋顶下空洞误用柱顶碰撞，雪片改读共享World实际solid层，重生避实心、dt校验；双网格即时封洞/重开通过。现有表面混白保留，不是物理堆积；Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。",
              "decodedFrames": 318,
              "reviewEvidence": "artifacts/coverage/wind-snow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  317
                ],
                "nativeRevisits": [
                  0,
                  138,
                  144,
                  150,
                  305,
                  317
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地分层风场保留复核 / 雪片真实层碰撞局部通过；非原作完整风接口、雪片造型/AO与冬景等价"
              }
            },
            {
              "name": "11 背景雾：外缘渐隐 / 浓度与相对流速（圆盘近似）",
              "id": "906207980802252801",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/fog-envelope.js",
              "toggle": "fog",
              "page": "wake-fog.html",
              "note": "326帧全核验。修复本地有限雾盘外缘硬截断，新增浓度/相对漂移速度控制，默认淡雾0.35；实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真实速度。",
              "decodedFrames": 326,
              "reviewEvidence": "artifacts/coverage/wake-fog-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  325
                ],
                "nativeRevisits": [
                  0,
                  80,
                  180,
                  325
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地带状尾迹时间采样与圆盘雾边界/控制局部通过；非原作完整粒子/软片/体积雾等价"
              }
            },
            {
              "name": "悬挑/柱间空洞：分层岩石底面、空隙诊断与切面面积/边长保护已接；3D侧壁交叉仍待补",
              "id": "1671808851895627776",
              "status": "partial",
              "where": "src/core/rock-topology.js · terrain/features.js · terrainmesh.js",
              "page": "overhang.html",
              "note": "303帧全核验：岩檐、柱间空洞、下层地面与环绕低机位。保留已有World分层rock及侧/底面，补岩石区间/空隙/level1连通诊断；真实双网格底面6顶点、断开支撑可报1未连岩石。薄岩檐平滑形变仍收缩，视觉未等价；原版软坡/侵蚀有效生成与完整接口待补。",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/mirror-overhang-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  302
                ],
                "nativeRevisits": [
                  190
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "where": "src/terrain/features.js · shape.js · src/core/deformation-guard.js",
              "page": "overhang.html",
              "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。",
              "decodedFrames": 267,
              "reviewEvidence": "artifacts/coverage/slope-cliff-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  266
                ],
                "nativeRevisits": [
                  150
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "坍缩边缘候选：434帧核验，真实半边只读枚举；增量导航互连待补",
              "id": "1582293326815862786",
              "status": "partial",
              "where": "src/core/frontier-candidates.js · wfc.html",
              "page": "wfc.html",
              "note": "434帧核验：是坍缩边缘候选评估/简化导航扩展，不是战役边境，也不等于旧同高区域图。新增只读邻接候选枚举，真实半边、三角/四边格及预算不完整结果；WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。",
              "decodedFrames": 434,
              "reviewEvidence": "artifacts/coverage/wire-frontier-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  433
                ],
                "nativeRevisits": [
                  0,
                  60,
                  120,
                  190,
                  191,
                  433
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "近云同图投影/首页开关局部验收；远云影与模糊仍缺",
              "id": "1243228419162341379",
              "status": "partial",
              "where": "src/life/vegetation.js · src/life/impostor.js · clouds.html · src/light/cloud-shadow.js",
              "toggle": "cloudshadow",
              "page": "clouds.html",
              "note": "489帧全核验；修复远云固定时钟，连续环带/远平面深度避免盖建筑；首页独立开关。双网格GPU/三场局部通过，原片高耸云体/层次、真实风平流仍缺。 后续迁移：可选三组逆深度角速度接实际远云，GPU读回/开关通过；云影/模糊/完整三层仍缺，不重计489帧。 本次共享近云同图集世界高度投影/首页开关GPU局部通过；水/植被/远云影/模糊未完成。",
              "decodedFrames": 489,
              "reviewEvidence": "artifacts/coverage/cloud-shadow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  488
                ],
                "nativeRevisits": [
                  0,
                  230,
                  240,
                  250,
                  488
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "近云固定轮廓投影及既有远云差速局部验收，非原作完整云景等价"
              }
            },
            {
              "name": "岩壁宽窄层带：世界坐标着色与直/弯对照，旧窄条保留；原作外观/反射仍待补",
              "id": "1699038611125985317",
              "status": "partial",
              "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
              "page": "sediment.html",
              "toggle": "strata",
              "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。原作图案密度/配色/反射与阴影一致性仍待补。",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "planet.html（现有网格；纹理流程待补）",
              "page": "planet.html",
              "note": "242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法；已有planet网格不等于原纹理，代码待实现验收。",
              "decodedFrames": 242,
              "reviewEvidence": "artifacts/coverage/mountain-texture-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  241
                ],
                "nativeRevisits": [
                  0,
                  150,
                  220
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "球面纹理学习与差距审核；3D纹理/岸缘混合未实现验收"
              }
            },
            {
              "id": "1786014232594485497",
              "name": "山体：共享岩壁底色/顶点明度/实时法线局部通过；原纹理待补",
              "status": "partial",
              "where": "src/core/mountain-bake.js · mountain-bake.html",
              "page": "mountain-bake.html",
              "note": "234帧全核验，配文未确认斜率烘焙；本地用实际World顶点法线烘焙明度，底色/烘焙/实时法线局部GPU通过。原山体纹理atlas/笔触、原接口及低端性能未验。",
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
              "where": "src/terrain/generate.js · cage.html",
              "page": "cage.html",
              "note": "454帧全核验，片中两组岛线框构建/着色/转镜；原文未揭示生成器算法，完整坡面/模块联合生成仍待补。",
              "decodedFrames": 454,
              "reviewEvidence": "artifacts/coverage/cage-review.md",
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
              "status": "partial",
              "where": "src/terrain/generate.js · src/core/terrace-edges.js · terraces.html",
              "page": "scene:terrain",
              "note": "649帧全核验，多岛成果/构建过渡与转镜；完整软坡/模块联合生成和原美术质量仍待补，本批仅学习审核。 旧649帧续作：真实World共格边层界/线框/岸界及笼投影局部验收；原完整生成/倒角一致性未完成。",
              "decodedFrames": 649,
              "reviewEvidence": "artifacts/coverage/terrace-edges-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  648
                ],
                "nativeRevisits": [
                  80,
                  245,
                  375,
                  540
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逻辑台地格边/笼投影诊断局部验收，非完整岛生成或最终倒角一致"
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
              "note": "原文irregular is the new hex，185帧；既有量化保留，新增真实World同高片/逻辑阶差面积诊断，非原算法恢复。",
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
                "acceptanceScope": "逻辑顶列诊断通过；不含实际变形坡面/洞内/悬垂面积"
              }
            },
            {
              "id": "781957658597269506",
              "status": "partial",
              "where": "src/terrain/generate.js · src/core/ladder-profile.js · src/world/navlayer.js · terraces.html",
              "page": "terraces.html",
              "name": "109帧黄色薄平台，仅学习",
              "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习；不等于可用顶列量化复现悬垂结构。 旧片续作：3D锚点梁长/等距踏棍接实际台地木梯，双网格模式恢复通过；原薄台/攀爬仍缺。",
              "decodedFrames": 109,
              "reviewEvidence": "artifacts/coverage/wood-ladders-review.md",
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
                "acceptanceScope": "真实台地梯锚点中心/长度与显示模式局部验收，非薄平台/体积接触或攀爬动作"
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
              "status": "partial",
              "where": "src/terrain/generate.js · src/core/terrace-edges.js · terraces.html",
              "page": "terraces.html",
              "note": "649帧全核验，多岛成果/构建过渡与转镜；完整软坡/模块联合生成和原美术质量仍待补，本批仅学习审核。 旧649帧续作：真实World共格边层界/线框/岸界及笼投影局部验收；原完整生成/倒角一致性未完成。",
              "decodedFrames": 649,
              "reviewEvidence": "artifacts/coverage/terrace-edges-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  648
                ],
                "nativeRevisits": [
                  80,
                  245,
                  375,
                  540
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逻辑台地格边/笼投影诊断局部验收，非完整岛生成或最终倒角一致"
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
              "status": "partial",
              "where": "src/terrain/generate.js · src/core/ladder-profile.js · src/world/navlayer.js · terraces.html",
              "page": "terraces.html",
              "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习；不等于可用顶列量化复现悬垂结构。 旧片续作：3D锚点梁长/等距踏棍接实际台地木梯，双网格模式恢复通过；原薄台/攀爬仍缺。",
              "decodedFrames": 109,
              "reviewEvidence": "artifacts/coverage/wood-ladders-review.md",
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
                "acceptanceScope": "真实台地梯锚点中心/长度与显示模式局部验收，非薄平台/体积接触或攀爬动作"
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
              "name": "冬季宣传全景：306帧已学；第210帧切到船群/士兵/血烟，完整组合待实现验收",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/badnorth/battle.js（组合待验）",
              "page": "artifacts/coverage/clouds-winter-review.md",
              "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。已有雪/战斗主体保留；完整冬景美术/植被覆盖及船群战斗组合未实现验收。",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/clouds-winter-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅文字/全帧/代码审核，完整冬景与战斗组合待实现及实景验收"
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
              "status": "partial",
              "where": "src/world/traffic.js（passageMarkers/heightRaster roofs）· src/badnorth/battle.js（refreshPassages 屋顶射线）· index.html?scene=badnorth",
              "page": "scene:badnorth",
              "toggle": "passages",
              "note": "624帧全核（7张联系表）；点距/点径由2.08调到2.21（spacing 0.265→0.28，同图点数182→173），遮挡栅格新增roofs：每栋小屋射线取屋顶高写入，屋檐后的点也会淡出（stats.roofs=4、occluded 52、fadeRange 0.136-1、dimPeak 212.8→187.6、未被挡的点228.3不变）；仍缺通用调试层（只挂badnorth）与近景点距略疏",
              "decodedFrames": 624,
              "reviewEvidence": "artifacts/coverage/886199305522085890-review-r54.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  623
                ],
                "nativeRevisits": [
                  1,
                  40,
                  623
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "通道点线点距比 + 地形/建筑遮挡淡出"
              }
            },
            {
              "name": "血、尸体、箭粘在船上随船走",
              "id": "946660607008403456",
              "status": "partial",
              "where": "src/badnorth/battle.js（#longship deckPool / #bleed）· src/core/platform-anchor.js · index.html?scene=badnorth",
              "page": "scene:badnorth",
              "note": "440帧全核（5张联系表+9处原尺寸/5-11倍船体裁切）；补出「整舱浸透」：舱底贴凹曲线做25段血池带（gore→opacity 0.94、沿船长铺到 scaleX 1.0、边缘不规则齿），船壳色只走到 hullBlood 75% 以保留外侧栗木色；船上人6死8人时 gore=1、血池满；仍缺船外沿岸白泡沫带与沿岸成片白花簇",
              "decodedFrames": 440,
              "reviewEvidence": "artifacts/coverage/946660607008403456-review-r54.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  439
                ],
                "nativeRevisits": [
                  0,
                  120,
                  200,
                  439
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "船上血/尸体/箭附着 + 整舱浸透成片红"
              }
            },
            {
              "name": "血浸透当血量指示",
              "id": "984813819280191488",
              "status": "partial",
              "where": "src/badnorth/battle.js（installSoak/aSoak/#bleed/poolGrow/mStun）· src/core/combat-state.js · index.html?scene=badnorth",
              "note": "934帧全核（10张联系表+3整帧4x+1处5x）；浸血=血量与僵直两机制成立；本轮补盾面吃同一份aSoak（门限0.03/0.08）并把program缓存键改成soak:y0:ys避免三网格串用低首阈值，僵直星改#ffd23a+toneMapped:false；贴地血泊加2.4s外渗到1.42x后定型；纠正：全片无头顶星，原片小兵僵直只是倒地不消失，三星是本仓可读性近似；仍缺血泊堆厚变暗、盾面法向拖尾",
              "decodedFrames": 934,
              "reviewEvidence": "artifacts/coverage/984813819280191488-review-r54.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  933
                ],
                "nativeRevisits": [
                  145,
                  450,
                  600,
                  933
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本体+盾面浸血=血量 + 小兵僵直中断（星星为近似）"
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
              "status": "partial",
              "where": "src/badnorth/damage-numbers.js（新增）· src/badnorth/battle.js（#hit / #damagePopup / #updateDamageNumbers）· index.html?scene=badnorth&grid=quad|mixed",
              "page": "scene:badnorth",
              "note": "654帧全核（7张联系表0-653 + 原尺寸0300/0460 与5倍裁切）；本轮补伤害数字：新增 damage-numbers.js（damageValue 只按真实掉血、1点血=+4；addDamageNumber 只合并同一单位）+ battle.js #damagePopup/#updateDamageNumbers（Sprite 按相机距离定高、奶油白+深色描边、按文本缓存纹理、单位加 uid）；浏览器两套网格各 spawned3/live3/last4/damaged2/sprites3/merged0、pageerror 0；spear-brace / spear-pose-browser / squad-hud / traffic-dots 全 PASS；缺：深度关闭(一律画最前)、无受击方向抖动、金色+10 与白色+4 未统一分层",
              "decodedFrames": 654,
              "reviewEvidence": "artifacts/coverage/903647529203634176-review-r53.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  653
                ],
                "nativeRevisits": [
                  300,
                  460,
                  650
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "伤害数字与命中集联动：只给真掉血的单位跳 +N、不同单位不合并、屏幕定高（真实 WebGL 两套网格）"
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
              "name": "678帧弹道：共享查表/实际端点修复，原表达式待补",
              "id": "987267068495003648",
              "status": "partial",
              "where": "src/core/ballistic-table.js · src/badnorth/battle.js · ballistics.html",
              "page": "ballistics.html",
              "note": "678帧全核；Inspector代价/Validity动态编辑。保留无阻力游戏参数，提共享表/可调权重，修真实目标高差量化误差；双网格实际弓手发射通过。原表达式/drag/Validity仍缺。",
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
                "acceptanceScope": "局部无阻力共享表/实际弓手端点修复，不是原Inspector/阻力完整恢复"
              }
            },
            {
              "name": "血迹跟着身体（物体空间血斑）；可关掉血腥",
              "id": "999185422403055616",
              "status": "partial",
              "where": "src/badnorth/battle.js（aSoak · installSoak 头+身）· head-blood-browser",
              "toggle": "gore",
              "note": "229帧全核；血斑按物体空间噪声画、头部这轮补上了（头 48px/身 179px 已量），但只有一套空间：原作躯干走皮肤空间、盔与手臂走精灵空间（0096 棋盘格分出界线）没有；斑块是整面块状、与调色板斑混淆",
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
                "acceptanceScope": "血迹跟随（头/身）"
              }
            },
            {
              "name": "洞穴725帧仅学习：厚岩拱洞/多层战斗",
              "id": "906416813810049025",
              "status": "partial",
              "where": "artifacts/coverage/cloud-depth-review.md",
              "page": "artifacts/coverage/cloud-depth-review.md",
              "note": "725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "新洞穴素材仅学习；旧阴云策略迁移另行记载"
              }
            },
            {
              "name": "窄道会车（简化：互相让开）",
              "id": "880853661936734211",
              "status": "partial",
              "where": "src/world/traffic.js · src/badnorth/battle.js",
              "note": "601帧已复核，保留左行与常驻点线；补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。",
              "decodedFrames": 601,
              "reviewEvidence": "artifacts/coverage/body-separation-review.md"
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
              "status": "partial",
              "where": "src/badnorth/battle.js（#bleedWall / #bleedAtFoot）· index.html?scene=badnorth&grid=quad",
              "note": "759帧全核；补崖壁竖直血斑与崖脚积血（原血斑全为水平圆片），实测墙面竖斑34/地面圆斑50；缺烧焦痕与血泊不规则扩散",
              "decodedFrames": 759,
              "reviewEvidence": "artifacts/coverage/912691357440978945-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  758
                ],
                "nativeRevisits": [
                  1,
                  335,
                  400,
                  758
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "战斗血迹：崖壁竖直流挂 + 崖脚血泊，地面圆斑不回归"
              }
            },
            {
              "name": "\"瑞士奶酪\"一样的多洞岛（画面：拱门、洞口很多的紫色岩岛）。重构版有悬垂和石拱的造型，但单位不能穿洞",
              "id": "906425294533394432",
              "status": "partial",
              "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
              "page": "navigation.html",
              "note": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。",
              "decodedFrames": 246,
              "reviewEvidence": "artifacts/coverage/battle-navigation-review.md"
            },
            {
              "name": "数据继承可视化：每格到父格一段线，颜色 = 从哪支守军继承来的（面板「流场」）",
              "id": "902069261304287232",
              "status": "partial",
              "where": "src/badnorth/battle.js（#drawFlow unit 档）· index.html?scene=badnorth&grid=quad",
              "note": "389帧全核；继承树每格一段连父格、颜色按守军队伍（不再 squad%3 撞色）并提亮；缺底下的四边形网格线框",
              "decodedFrames": 389,
              "reviewEvidence": "artifacts/coverage/902069261304287232-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  388
                ],
                "nativeRevisits": [
                  1,
                  190,
                  388
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "数据继承树：父格连线与按队伍取色"
              }
            },
            {
              "name": "流场 / 影响场：除了到最近单位的距离和方向，还带着\"那是什么兵种\"；维京人看到矛兵正面会绕开去打小屋",
              "id": "901842167508992000",
              "status": "partial",
              "where": "src/badnorth/flowfield.js · src/badnorth/battle.js（#drawFlow type 档）· index.html?scene=badnorth&grid=quad",
              "note": "571帧全核；流场携带兵种已在代码里生效（维京绕矛兵），本轮给调试视图加按兵种配色+每格散须；缺格面着色与色卡图例",
              "decodedFrames": 571,
              "reviewEvidence": "artifacts/coverage/901842167508992000-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  570
                ],
                "nativeRevisits": [
                  25,
                  115,
                  335,
                  570
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "影响场携带兵种（三色分区）与每格方向须"
              }
            },
            {
              "name": "单位会被打下悬崖：挨打时身后低 ≥2 层就可能被击飞，抛物线落下，落差大的摔死",
              "id": "870296307889573889",
              "status": "partial",
              "where": "src/badnorth/battle.js（#hit / #fallStep / #lowerAhead）· index.html?scene=badnorth&grid=quad",
              "note": "351帧全核；击退越沿→逐级滚落→落差≥3层摔死已修（贴壁下落、沿口推进、跨级续滚），实测6层→2层跨4层/水平位移1.02；缺翻滚姿态与落地扬尘",
              "decodedFrames": 351,
              "reviewEvidence": "artifacts/coverage/870296307889573889-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  350
                ],
                "nativeRevisits": [
                  1,
                  170,
                  245,
                  268,
                  350
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "击退落崖：贴壁下落、逐级滚落、整段落差致死与留血"
              }
            },
            {
              "name": "真实发船泊位/直线进场走廊预留局部通过；岸礁/动态避让待补",
              "id": "974325184525201409",
              "status": "partial",
              "where": "src/core/obb.js · src/badnorth/landing-plan.js · src/badnorth/battle.js",
              "page": "index.html?scene=badnorth",
              "note": "504帧全核；核心接触策略/输入防NaN通过，实际规划消费者待接 后续已接真实发船泊位/固定朝向直线走廊预留，完整岸礁/动态避让仍缺。",
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
                "acceptanceScope": "3D SAT策略及实际泊位/直线进场走廊预留局部验收，非地形碰撞或完整原规划"
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
              "status": "partial",
              "name": "动画/战斗与单位接触软盘复核",
              "where": "src/core/unit-shadow.js · unit-shadows.html",
              "page": "unit-shadows.html",
              "note": "先按准确配文理解动画参考请求；25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。",
              "decodedFrames": 25,
              "reviewEvidence": "artifacts/coverage/unit-shadow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  24
                ],
                "nativeRevisits": [
                  0,
                  12,
                  24
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "水平凸格单位软盘/Battle GPU局部通过，非原动画/完整软影算法"
              }
            },
            {
              "id": "821321422140309504",
              "status": "partial",
              "name": "动画/战斗与单位接触软盘复核",
              "where": "src/badnorth/battle.js",
              "page": "unit-shadows.html",
              "note": "315帧全核验，主内容为选点/登台/战斗与尸体，暗斑不能单独证明原阴影方法；本批仅学习复核。",
              "decodedFrames": 315,
              "reviewEvidence": "artifacts/coverage/unit-shadow-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  314
                ],
                "nativeRevisits": [
                  30,
                  72,
                  160,
                  280
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅全帧学习与战斗/暗斑差距复核"
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
              "status": "partial",
              "page": "unit-tiers.html",
              "where": "src/badnorth/battle.js",
              "note": "早期复仇战斗763帧复核；仅学习，不能认证软影高度或坡面算法。",
              "decodedFrames": 763,
              "reviewEvidence": "artifacts/coverage/unit-tiers-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  762
                ],
                "nativeRevisits": [
                  40,
                  240,
                  470,
                  720
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅学习"
              }
            },
            {
              "id": "827215002448846848",
              "name": "单位等级：524帧；3D色阶局部通过",
              "status": "partial",
              "page": "unit-tiers.html",
              "where": "src/core/unit-tier.js · unit-tiers.html",
              "note": "原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。",
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
                "acceptanceScope": "仅本地3D外观色阶，状态不变"
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
              "note": "387帧坡地接敌/火焰/房屋焦黑；保留已有每人navFloor，修高度缓动随帧率变化，30/60/120Hz真实Battle双楼层解析一致。原火球/动作/坡面未复现。",
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
                "acceptanceScope": "每人逻辑层高缓动局部，不是原坡面脚底/动画/火球等价"
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
              "note": "666帧全核，层间指令/阶梯支援/房屋遇袭和守卫。保留逐人层高，修房屋燃烧/守卫仅看XZ导致跨层干涉；双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。",
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
              "name": "尘粒AO227帧仅学习，原效果待实现",
              "where": "artifacts/coverage/path-samples-review.md",
              "page": "artifacts/coverage/path-samples-review.md",
              "note": "227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。",
              "decodedFrames": 227,
              "reviewEvidence": "artifacts/coverage/path-samples-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "原尘粒AO待实现；独立命令点采样另行验收"
              }
            }
          ]
        ],
        [
          "塔楼形态局部迁移",
          [
            {
              "id": "807256278154301441",
              "status": "partial",
              "name": "344帧：塔楼四檐顶局部，原群体寻路待补",
              "where": "src/core/hip-roof.js · src/build/buildings.js",
              "page": "hip-roofs.html",
              "note": "344帧全核。原文群体寻路、图像塔楼及球点，纠正原版无文字六帧说明。共享独立四边房屋可选四檐顶真实重建通过；群体寻路及多格完整规则未验收。",
              "decodedFrames": 344,
              "reviewEvidence": "artifacts/coverage/hip-roof-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  343
                ],
                "nativeRevisits": [
                  0,
                  49,
                  192,
                  215,
                  260,
                  343
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "仅屋顶局部策略迁移，非原群体寻路/全部原作建筑"
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
              "where": "src/core/banner.js · src/badnorth/battle.js",
              "page": "squad-banners.html",
              "note": "23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。",
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
                "acceptanceScope": "仅本地三徽记接实际旗材质，非原图集/盾牌和完整旗形"
              }
            }
          ]
        ],
        [
          "多格高层建筑学习待迁移",
          [
            {
              "id": "793545297376972801",
              "status": "partial",
              "name": "多格 tile 三维 WFC + 顶点体素 AO（回放长出来）",
              "where": "src/build/multitile-wfc.js · src/build/multitile-iso.js · multitile.html",
              "page": "multitile.html",
              "note": "102帧复看sheet-00；真实浏览器跑通：5×7×5 坍缩89步/多格8/面117、关AO面不变、回放40%面34、4×10×4 多格12/面130；缺接共享World与窗洞栏杆美术模块",
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
              "note": "6帧全核，原五阶段仅学习；不将本地四选项冒充SSAO/方向AO。",
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
                "acceptanceScope": "五阶段仅学习"
              }
            }
          ]
        ],
        [
          "导航流动逐帧复核",
          [
            {
              "id": "816748103193817088",
              "status": "partial",
              "name": "导航面内连续流场 · 百人经坡道换层",
              "where": "src/world/navmesh-flow.js · navmesh-flow.html",
              "page": "navmesh-flow.html",
              "note": "479帧全核（5张联系表+frame-0128原尺寸）；本轮把「逐面常量流向→过面换向」改成共边带混合：352条共面边 p90 22.50°→0.000°、max 90°→0°（浏览器实测同值），百人 9.6s 全到/出面0/换面抖动 1732→1513；顶点梯度+均值坐标虽也做到0°但抹平崖壁切向导致崖脚卡人40s，已弃用；还缺接进 battle.js、通口前视、共享World自动生成导航面",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/816748103193817088-review-r48.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  478
                ],
                "nativeRevisits": [
                  128
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "导航面内连续流向（共边带混合）"
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
              "status": "partial",
              "where": "src/badnorth/squad-hud.js · squad-hud.html",
              "page": "squad-hud.html",
              "note": "227帧全核（3张联系表+4张原尺寸）；战斗HUD两件：旗顶槽按存活比绿/黄/红缩短+受击左端闪红0.15s，击杀白色+10上升1s淡出、同队连杀合并；新建 squad-hud.js，缺献血泊尸体/木跳板/旗布摆动/接battle.js",
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
              "status": "partial",
              "where": "src/badnorth/squad-footprint.js · squad-footprint.html",
              "page": "squad-footprint.html",
              "note": "654帧全核（7张联系表+4张原尺寸）；选中队伍脚下的占位线网=凸包轮廓+中心辐条+角上小方块，旗顶悬空白菱形、+12飘字、箭矢细白线；新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线",
              "decodedFrames": 654,
              "reviewEvidence": "artifacts/coverage/883447205176238083-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  653
                ],
                "nativeRevisits": [
                  80,
                  265,
                  400,
                  434
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "小队占位线网（逻辑+浏览器）"
              }
            },
            {
              "id": "837027901853810688",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/life/smoke.js · src/badnorth/battle.js（缺口，未改）",
              "page": null,
              "note": "514帧全核（6张联系表）；Bad North 夜间烧村实机：黑烟球+橙色火舌、血迹随时间变暗变淡、348–366帧出现亮黄竖条来袭标记；未改码，缺烟球体积+火光照明联动、血迹淡出、黄条标记",
              "decodedFrames": 514,
              "reviewEvidence": "artifacts/coverage/837027901853810688-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  513
                ],
                "nativeRevisits": [
                  0
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "实机录像，只记账缺口"
              }
            },
            {
              "id": "816743289500106752",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/badnorth/battle.js · unit-ground-height.js（无队列层）",
              "page": null,
              "note": "431帧全核；石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到达集结落位，均未实现",
              "decodedFrames": 431,
              "reviewEvidence": "artifacts/coverage/816743289500106752-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  430
                ],
                "nativeRevisits": [
                  0,
                  120,
                  240,
                  430
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "成列行军与集结队形"
              }
            },
            {
              "id": "816332161036984320",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/core/trajectory-fan.js · trajectory-fan.html",
              "page": "trajectory-fan.html",
              "note": "177帧全核；判出Unity「Trajectory Calculator」：同一Speed/Drag按整排角度画带阻力弹道+等弧长白色方向划线（实测划线等距42–43px）。新建trajectory-fan.js/html：线性阻尼解析解+等弧长切线采样，Drag 0→2射程5.91→2.38单位、划线188→88；缺场景碰撞截断、二次阻力档、Inspector第三参数读不到",
              "decodedFrames": 177,
              "reviewEvidence": "artifacts/coverage/816332161036984320-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  176
                ],
                "nativeRevisits": [
                  0,
                  80,
                  176
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "阻力弹道扇面/等弧长方向划线"
              }
            },
            {
              "id": "810157485638189056",
              "name": "（无原文）",
              "status": "partial",
              "where": "src/core/route-preview.js · path-samples.js（均无页面入口对应此视图）",
              "page": null,
              "note": "510帧全核；俯视调试视图：棕色三角化块体+沿可行走区密集采样(1–2px点距)的路线点串+三轴gizmo拖拽标记，点阵基本累积静止(帧间差>20仅2129px)。判为路线/轨迹采样编辑器；缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层",
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
                  60,
                  200
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "可行走图上的路线密集采样"
              }
            },
            {
              "id": "1092709665199345664",
              "name": "k-pow !!",
              "status": "partial",
              "where": "src/life/effects.js · src/life/smoke.js · src/life/banner.js（缺口：一次性爆炸编排 explodeAt）",
              "page": null,
              "note": "474帧全核；判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、火球靠effects.js粒子池，缺explodeAt时序编排与焦痕贴片，本轮未写代码",
              "decodedFrames": 474,
              "reviewEvidence": "artifacts/coverage/1092709665199345664-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  473
                ],
                "nativeRevisits": [
                  70,
                  85,
                  310
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "爆炸特效判读与模块归属；未做时序编排与运行验收"
              }
            },
            {
              "id": "1007587828992266240",
              "name": "（帖子无文字说明）",
              "status": "partial",
              "where": "src/badnorth/battle.js · src/life/effects.js · src/life/banner.js",
              "page": null,
              "note": "300帧全核；白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐",
              "decodedFrames": 300,
              "reviewEvidence": "artifacts/coverage/1007587828992266240-review.md",
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
                "runtimeAccepted": false,
                "acceptanceScope": "战斗实拍判读与机制归属，未做运行时验收"
              }
            },
            {
              "id": "995043346778415104",
              "name": "The pathfinding in some levels does get a bit co…",
              "status": "partial",
              "where": "src/core/route-preview.js · route-preview.html",
              "page": "route-preview.html",
              "note": "386帧全核；移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接入、预览仍是淡出的一次性点串",
              "decodedFrames": 386,
              "reviewEvidence": "artifacts/coverage/995043346778415104-review.md",
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
                  65
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "移动路线预览（落崖弧/圆角/不埋点）"
              }
            },
            {
              "id": "995034777756536833",
              "name": "（帖子无文字说明）",
              "status": "partial",
              "where": "src/badnorth/battle.js · 无（能力系统未建）",
              "page": null,
              "note": "564帧全核；血迹贴花累积/队伍旗/箭矢三项已在 battle.js 对上，缺指挥官能力（Plunge）、能力键冷却环与 No valid targets 提示，本轮未写代码",
              "decodedFrames": 564,
              "reviewEvidence": "artifacts/coverage/995034777756536833-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  563
                ],
                "nativeRevisits": [
                  1,
                  200,
                  563
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "血迹/旗/箭已核；能力系统未做"
              }
            },
            {
              "id": "902103473365417984",
              "name": "Ok, one more visualization. Distances this time.…",
              "status": "partial",
              "where": "src/core/distance-isolines.js · distances.html",
              "page": "distances.html",
              "note": "705帧全核；岛上等距亮线=距离场等值线（非流向继承），新建 distance-isolines.js+distances.html，EDT 与暴力解一致；缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入",
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
                "acceptanceScope": "2D 格距离场 EDT + marching squares 多级等值线与闭环/开口缝合；不代表原作 3D 台阶立面投影"
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
              "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
              "page": "blotches.html",
              "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "三角对比迭代：标量诊断，原作atlas待补",
              "id": "1482346496460828674",
              "status": "partial",
              "where": "src/core/contrast-field.js · color-lab.html（三角诊断）",
              "page": "color-lab.html",
              "note": "517帧全核验，纠正原注释6帧；图集预览、灰岛上色和两组岛环绕。新增确定性标量对比图求解与实际网格三角诊断，预算修复后仍报告违例；原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。",
              "decodedFrames": 517,
              "reviewEvidence": "artifacts/coverage/color-lab-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false
              }
            },
            {
              "name": "程序化法线反差：共享材质/物理像素线局部GPU通过；原atlas待补",
              "id": "1482011744843223042",
              "status": "partial",
              "where": "src/core/normal-contrast.js · normal-contrast.html",
              "page": "normal-contrast.html",
              "note": "384帧全核验；源为程序化normal map反差，不是后续contrast迭代。共享地形材质新增解析法线场/物理像素覆盖局部近似，GPU双网格通过；原笔触normal atlas与投影接缝仍缺。",
              "decodedFrames": 384,
              "reviewEvidence": "artifacts/coverage/normal-radial-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  383
                ],
                "nativeRevisits": [
                  2,
                  125,
                  229,
                  310
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享解析法线场/细线覆盖/材质开关局部通过，非原normal atlas/完整后处理"
              }
            },
            {
              "name": "隔像素线：连续UV重映射＋线性采样；放大积分宽度1px，缩小/全atlas接入待补",
              "id": "1241096929490149376",
              "status": "partial",
              "where": "src/core/texel-skip.js · textures.html",
              "page": "textures.html",
              "note": "302帧全核验：同机位砖石小镇，细线/粗线效果反复切换；137附近拉远、251附近拉近。原文仅说明采样前UV加速经过隔像素线，不说明确切公式。原硬切函数改共享连续重映射+线性采样，6档CPU积分/4档真实GPU验收；仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。",
              "decodedFrames": 302,
              "reviewEvidence": "artifacts/coverage/texture-fields-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  301
                ],
                "nativeRevisits": [
                  20,
                  60
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/terrain/field-pattern.js · terrainmesh.js · WorldMesh/View",
              "page": "fields.html",
              "toggle": "fields",
              "note": "620帧全核验：条纹弯曲随格块换向，浅崖横带；135/256/473/571附近空屏后换岛，依次出现黑轮廓、无光材质、亮面和田纹；不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完成原作手绘纹样与投射atlas。",
              "decodedFrames": 620,
              "reviewEvidence": "artifacts/coverage/texture-fields-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  619
                ],
                "nativeRevisits": [
                  90,
                  310
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "旋涡团块：可调角度场与柔边，本地近似",
              "id": "1703750394164199473",
              "status": "partial",
              "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
              "page": "blotches.html",
              "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "重要边界：显式地表标记隔离屋顶/岩壁，真实层高选噪声",
              "id": "1696864977171189980",
              "status": "partial",
              "where": "src/terrain/blotch-pattern.js · src/world/view.js",
              "note": "502帧全核验。共享View修复绿色屋顶被地面笔触误染：显式顶面标记+法线/颜色筛选，按真实levelHeight选层。实际材质GPU对照排除屋顶/岩壁、双网格通过；原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。",
              "decodedFrames": 502,
              "reviewEvidence": "artifacts/coverage/blotch-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  501
                ],
                "nativeRevisits": [
                  130
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "textures.html?t=radial（保留圆块近似；UV流程待补）",
              "page": "textures.html?t=radial",
              "note": "346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核完成，代码待实现验收。",
              "decodedFrames": 346,
              "reviewEvidence": "artifacts/coverage/normal-radial-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  345
                ],
                "nativeRevisits": [
                  0,
                  19,
                  35,
                  77,
                  129,
                  200,
                  269,
                  320
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "学习与差距审核完成；原UV流程未实现，圆块/矩形演示不计验收"
              }
            },
            {
              "name": "单纹理八方向/中心镜像：D4与可选固定像素尺度折叠，原作纹样/布局仍待补",
              "id": "1061221291137605633",
              "status": "partial",
              "where": "src/core/mirror-uv.js · src/ui/ornament.js",
              "page": "mirror.html",
              "note": "379帧全核验：方/横/窄高矩形拖动、Orientation变化。复用已有单距离场，补D4八方向和可选固定像素尺度中心重复折叠，GPU八方向各异/镜像无误差，改尺寸不重烘，旧实验回归通过。固定尺度重复是本地方案，非已证实原布局；纹样/CPU绘图API仍不同。",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/core/palette-patch.js · src/world/view.js · palette-editor.html",
              "page": "palette-editor.html",
              "note": "624帧全核验。四角/白三角/取样色带与OkHsl/OkLab/Srgb菜单可见；新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。",
              "decodedFrames": 624,
              "reviewEvidence": "artifacts/coverage/palette-editor-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  623
                ],
                "nativeRevisits": [
                  550
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "HSL色彩范围：真实顶面接入，其他特征待补",
              "id": "1710031224838771027",
              "status": "partial",
              "where": "src/core/color-volume.js · src/world/view.js · color-lab.html",
              "page": "color-lab.html",
              "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面；其他特征、离散采样和原版完整接口待补。",
              "decodedFrames": 515,
              "reviewEvidence": "artifacts/coverage/color-lab-review.md",
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
                "runtimeAccepted": true
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
              "status": "partial",
              "where": "src/core/palette.js · wall-palette.html",
              "note": "200帧全核验，墙色由鲜艳到灰米，屋顶仍橙红；画面不足以证明原注释1.5秒/最短色相公式。新增可选本地HSL短弧过渡及无彩色端点处理，真实墙色滑杆双网格通过；PNG/完整原接口与持久化仍待补。",
              "decodedFrames": 200,
              "reviewEvidence": "artifacts/coverage/palette-transition-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  199
                ],
                "nativeRevisits": [
                  52
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "局部历史权重/可选墙色过渡，非原片完整算法或视觉等价"
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
              "status": "partial",
              "where": "src/core/ui-reveal.js · ornament.html",
              "page": "ornament.html",
              "note": "100帧全核验。中央徽章/标题先显、外纹后展，中央先退/外侧尾迹最后消失。保留共享SDF，新增可拖动标题/外纹本地两轨时序，透明文字inert；非原徽章/逐部件原时序或图稿。",
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
              "status": "partial",
              "where": "src/core/atlas.js · grids.html?t=atlas",
              "page": "grids.html?t=atlas",
              "note": "247帧全核验；真实树查询事件与暂停/拖动、显式栈统计通过。保留first-fit叶内切分，不以模拟手臂代替原遍历；原3D树/跨叶候选待补。",
              "decodedFrames": 247,
              "reviewEvidence": "artifacts/coverage/atlas-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  246
                ],
                "nativeRevisits": [
                  6,
                  12,
                  55,
                  141,
                  185,
                  238
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享Atlas句柄/尺寸/迭代搜索与真实2D遍历局部通过；非原跨叶候选算法/3D树/完整RectBin接口"
              }
            },
            {
              "name": "矩形删除：过期句柄修复、空兄弟合并；仍会残留碎片",
              "id": "1765041830461055127",
              "status": "partial",
              "where": "src/core/atlas.js · grids.html?t=atlas",
              "page": "grids.html?t=atlas",
              "note": "558帧全核验，侧视彩块变薄不能误认为删除；重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。",
              "decodedFrames": 558,
              "reviewEvidence": "artifacts/coverage/atlas-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  557
                ],
                "nativeRevisits": [
                  6,
                  10,
                  110,
                  240,
                  363,
                  492
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享Atlas句柄/尺寸/迭代搜索与真实2D遍历局部通过；非原跨叶候选算法/3D树/完整RectBin接口"
              }
            },
            {
              "name": "矩形候选/树剪枝：跨叶放置与key释放通过；3D树/完整接口待补",
              "id": "1764958522398146667",
              "status": "partial",
              "where": "src/core/atlas.js · grids.html?t=atlas",
              "page": "grids.html?t=atlas",
              "note": "296帧全核验；可选边角/有界随机候选、树剪枝碰撞与跨叶分配/key释放；9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。",
              "decodedFrames": 296,
              "reviewEvidence": "artifacts/coverage/atlas-candidates-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  295
                ],
                "nativeRevisits": [
                  6,
                  18,
                  54,
                  85,
                  222,
                  276
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "共享跨叶候选/key释放和8视角动态GPU烘焙/回收/异常恢复局部通过；非原素材、3D树、自动扩容或完整API"
              }
            },
            {
              "name": "主体OBJ导出：精确坐标/属性检查/真实下载（植被水面另补）",
              "id": "1430224300003545091",
              "status": "partial",
              "where": "src/tools/objexport.js",
              "page": "index.html?scene=town",
              "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。",
              "decodedFrames": 288,
              "reviewEvidence": "artifacts/coverage/obj-replay-review.md",
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
                "acceptanceScope": "实际主体OBJ下载解析/快照回放控制；非第三方DCC视觉/完整动作特效复现"
              }
            },
            {
              "name": "合并网格：实测共享主体一次提交（非全场景 / Switch基准）",
              "id": "1401145625572425728",
              "status": "partial",
              "where": "src/world/worldmesh.js · src/tools/mesh-audit.js · save-mesh.html",
              "page": "save-mesh.html",
              "note": "349帧全核验。README是Switch动态合批不足后自写mesh merger；视频线框/着色不能独立证明三倍性能。保留既有WorldMesh分块缓存后拼成单一主体，新增真实GPU主体提交诊断；双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。",
              "decodedFrames": 349,
              "reviewEvidence": "artifacts/coverage/save-mesh-review.md",
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
                  77,
                  78,
                  225,
                  348
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地v5原子解码/实际重载与主体GPU提交验证；不等同原作格式、完整状态或Switch性能复现"
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
              "status": "partial",
              "where": "src/core/part-random.js · ui.html",
              "page": "ui.html?t=face",
              "note": "88帧全核验；保留层级部件，修复显式mirror分支随机重放/单次消费，显式种子与固定槽ID保证重画、切页和手机换列身份；完整spec/数据接口/剪影IoU仍缺。",
              "decodedFrames": 88,
              "reviewEvidence": "artifacts/coverage/portraits-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  87
                ],
                "nativeRevisits": [
                  0,
                  25,
                  87
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地显式镜像随机状态/稳定槽身份与已有卡片局部通过；非原完整素材、头像spec/游戏接入"
              }
            },
            {
              "name": "游戏头像展示：卡片身份重绘/换列已验；原兜帽/锁甲素材与角色接口待接",
              "id": "1010979395719319552",
              "status": "partial",
              "where": "src/core/part-random.js · ui.html",
              "page": "ui.html?t=face",
              "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。保留本地卡片绘制并验证稳定种子身份；原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。",
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
                "acceptanceScope": "本地显式镜像随机状态/稳定槽身份与已有卡片局部通过；非原完整素材、头像spec/游戏接入"
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
              "name": "确认弹出：纠正横排，延时清理/切队/Esc/手机已验；单Move游戏目标待接",
              "id": "1016680972610359298",
              "status": "partial",
              "where": "ui.html（本地UI实验，未接游戏指令）",
              "page": "ui.html?t=pop",
              "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。",
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
                "acceptanceScope": "仅本地UI确定性布局/命中与确认生命周期通过；未接游戏操作或原作美术/全部模式"
              }
            },
            {
              "name": "斜按钮：确定性视觉扰动/AABB、稳定命中槽与键盘已验；游戏菜单待接",
              "id": "1242824460325052417",
              "status": "partial",
              "where": "src/core/playful-layout.js · ui.html",
              "page": "ui.html?t=menu",
              "note": "383帧全核验。按键/种子确定轻微倾斜，旋转AABB限制间距，只改视觉层、原生按钮命中槽稳定；换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。",
              "decodedFrames": 383,
              "reviewEvidence": "artifacts/coverage/ui-interaction-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  382
                ],
                "nativeRevisits": [
                  77,
                  200,
                  335,
                  382
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "仅本地UI确定性布局/命中与确认生命周期通过；未接游戏操作或原作美术/全部模式"
              }
            },
            {
              "name": "图标：单选状态/方向键/禁用跳过/切页保持已验；图稿与游戏指令待接",
              "id": "1201179450668441600",
              "status": "partial",
              "where": "src/ui/icon-toolbar.js · ui.html",
              "page": "ui.html?t=icons",
              "note": "306帧全核验。上部四工具反复选中、白三角指示移动；原生工具条/aria单选、循环方向键跳过禁用项、跨页保持及dispose通过。下三项因本地未接命令禁用，不推断原作永久禁用；游戏语义/图稿仍缺。",
              "decodedFrames": 306,
              "reviewEvidence": "artifacts/coverage/icons-flair-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  305
                ],
                "nativeRevisits": [
                  0,
                  55,
                  155,
                  305
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "本地工具条交互/生命周期或共享纹饰两轨时序局部通过；非原作完整美术/游戏指令"
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
              "where": "src/core/camera-motion.js · src/world/view.js（历史帧近似）",
              "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。",
              "decodedFrames": 303,
              "reviewEvidence": "artifacts/coverage/camera-wall-review.md",
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
                "acceptanceScope": "本地历史帧修复/独立墙色色槽，不等于原作完整拖抹/PNG贴图系统"
              },
              "page": "index.html?scene=terrain&on=motionblur",
              "name": "快速转镜拖抹：历史帧近似修复，原片轮廓算法待补"
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
              "note": "524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。",
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
              "status": "partial",
              "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js；gridpatch.html",
              "page": "gridpatch.html",
              "note": "31帧复核：顶点格在实际台地上收缩/扩大。新增三角网重心对偶及边界闭合，共享World扇形三角输入和分层脉动观察/候选点。640格面积测试通过；不是原作中心规则证明，尚未统一植被/导航。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。",
              "decodedFrames": 31,
              "reviewEvidence": "artifacts/coverage/radial-dual-review.md",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "1b 早期高层草地分区（树木为原帖后续计划，完整地块规则待补）",
              "id": "1178731576982724611",
              "status": "partial",
              "where": "src/build/buildings.js（现有仅地面庭院，高层草地分区待补）",
              "page": "garden.html",
              "note": "333帧全核验，纠正旧“草地块会长树”：本片无树，README明确是将来计划。高层台地草坪/石边带随建筑重排，当前只有地面层庭院与岩石地形植被，完整高层grass plots未实现，不记运行验收完成。",
              "decodedFrames": 333,
              "reviewEvidence": "artifacts/coverage/anchored-plots-review.md",
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
                  160,
                  209,
                  282,
                  332
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "中心固定草卡片局部GPU对照；高层grass plots未实现，非原作完整灌木/材质/生命周期等价"
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
              "status": "partial",
              "where": "src/core/level-flora.js · src/life/vegetation.js · level-flora.html",
              "toggle": "grass",
              "page": "level-flora.html",
              "note": "203帧，准确日期2018-02-02；109帧硬切紫色雨景。迁移分层色组至共享World实际地被，保留落点和默认；完整物种/生态/雨景未复现。",
              "decodedFrames": 203,
              "reviewEvidence": "artifacts/coverage/level-flora-review.md",
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
                "runtimeAccepted": true,
                "acceptanceScope": "仅地被分层色组；不含原多草型几何与生态组合"
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
              "status": "partial",
              "where": "src/life/vegetation.js（静态邻崖近似，原采样法待补）",
              "toggle": "outline",
              "note": "181帧全核验：全片反差纹理诊断配色，镜头环绕多层岛，草缘随背景变化。原文明说顶点shader采站立处与背景射线的contrast texture差值。当前仅静态邻崖距离aEdge，未实现该GPU采样/背景射线；只记学习完成，实现及运行验收待补，不把已有启发式当原法。",
              "decodedFrames": 181,
              "reviewEvidence": "artifacts/coverage/garden-contrast-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  180
                ],
                "nativeRevisits": [
                  90
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              }
            },
            {
              "name": "草边受控下垂：保留几何近似，原版atlas/rim采样待补",
              "id": "1696896119794479541",
              "status": "partial",
              "where": "src/terrain/terrainmesh.js",
              "note": "550帧全核验。保留已有沿形变崖面圆瓣草边几何；这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。",
              "decodedFrames": 550,
              "reviewEvidence": "artifacts/coverage/blotch-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  549
                ],
                "nativeRevisits": [
                  350
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              },
              "page": "index.html?scene=terrain&on=blotch"
            },
            {
              "name": "2g 顶面无缝混色（草 / 苔 / 沙之间柔和过渡）",
              "id": "1781405550061687016",
              "status": "partial",
              "where": "src/terrain/terrainmesh.js（本地混色保留）· patch纹理接口待迁移",
              "note": "219帧全核验：球面投影草/水与手工UV岸带，119附近atlas窗口移入后移出；原文将高度混合列为后续设想。纠正顶面颜色平均=该patch算法的归因，保留本地混色成果；投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。",
              "decodedFrames": 219,
              "reviewEvidence": "artifacts/coverage/water-patch-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  218
                ],
                "nativeRevisits": [
                  50,
                  135
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              }
            },
            {
              "name": "每层地被：203帧全核，实际World分层色组；完整草型待补",
              "id": "959530111187013632",
              "status": "partial",
              "where": "src/core/level-flora.js · src/life/vegetation.js · level-flora.html",
              "toggle": "flowers",
              "page": "level-flora.html",
              "note": "203帧，准确日期2018-02-02；109帧硬切紫色雨景。迁移分层色组至共享World实际地被，保留落点和默认；完整物种/生态/雨景未复现。",
              "decodedFrames": 203,
              "reviewEvidence": "artifacts/coverage/level-flora-review.md",
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
                "runtimeAccepted": true,
                "acceptanceScope": "仅地被分层色组；不含原多草型几何与生态组合"
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
              "status": "partial",
              "where": "src/core/edge-inset.js · src/life/vegetation.js",
              "toggle": "shrubs",
              "note": "342帧全核验。保留既有球团近似；修复形变后仍用旧格心判内侧，改按实际多边形绕序/下一边界限幅。双网格实际556/564锚点通过平移形变、恢复及World不变验收；只保证锚点不保证球团体积。",
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
                "runtimeAccepted": true
              },
              "page": "index.html?scene=terrain"
            },
            {
              "id": "1707490932017279035",
              "status": "partial",
              "where": "src/world/worldmesh.js（ChunkRouter.edgeTri）· src/terrain/terrainmesh.js（centreE）· src/terrain/shrub-texture.js · index.html?scene=terrain&on=shrubtex",
              "note": "257帧全核（3张联系表0-256 + 原尺寸0010/0165）；修掉 worldmesh 的 ChunkRouter 不代理 edgeTri 的硬伤——活世界网格顶面 aEdge 曾恒1.000（8628/8628），灌木带在任何页面都没画出来；修后 0/0.556/0.588/0.741/1 五档、scaledShare 0.163，真实WebGL 50 program、glErrors空、开关差 30882/51842px；各档落差 1/2/3/≥4 即带宽 1/0.741/0.588/0.556；缺带色偏浅偏薄、外缘圆齿频率低；崖壁「三档色」经原尺寸复核不成立（粉橙来自灌木带与沙岸）",
              "decodedFrames": 257,
              "reviewEvidence": "artifacts/coverage/1707490932017279035-review-r53.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  256
                ],
                "nativeRevisits": [
                  1,
                  165,
                  256
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "纯纹理灌木带：活世界网格 aEdge 按崖高缩放 + 真实 WebGL 编译与开关像素对照"
              },
              "page": "index.html?scene=terrain&on=shrubtex",
              "name": "纯纹理灌木：台地边灌木带 + 小阴影（顶面着色，不加几何）"
            },
            {
              "name": "3b 锚定中心：共享草卡片GPU对照通过，墙根灌木仍待接",
              "id": "1191990107785572352",
              "status": "partial",
              "where": "src/life/vegetation.js · src/core/anchored-billboard.js · billboard-anchor.html",
              "page": "billboard-anchor.html",
              "note": "316帧全核验。新增可选实例轴固定中心的草卡片对照，沿用默认旧模式；四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生命周期仍待接，不冒充草卡片已等价原灌木。",
              "decodedFrames": 316,
              "reviewEvidence": "artifacts/coverage/anchored-plots-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  315
                ],
                "nativeRevisits": [
                  0,
                  34,
                  118,
                  152,
                  183,
                  263,
                  315
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "中心固定草卡片局部GPU对照；高层grass plots未实现，非原作完整灌木/材质/生命周期等价"
              }
            },
            {
              "name": "3c 球面叶纹 × 视角alpha：真实贴图/连续覆盖，保留旧噪声对照；阴影与远景impostor待补",
              "id": "1205420678859632640",
              "status": "partial",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
              "toggle": "leafy",
              "page": "leaf-surface.html",
              "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；原作手绘轮廓和匹配的阴影caster/impostor仍待补。",
              "decodedFrames": 443,
              "reviewEvidence": "artifacts/coverage/leaf-surface-review.md",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "3d 植物32²角落atlas：已接共享树冠/灌木；全场景共图与原作素材待补",
              "id": "1241046107125399552",
              "status": "partial",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
              "toggle": "shrubs",
              "page": "leaf-surface.html",
              "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共用atlas，原作植物素材与所有植物种类仍待迁移。",
              "decodedFrames": 168,
              "reviewEvidence": "artifacts/coverage/leaf-surface-review.md",
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
                "runtimeAccepted": true
              }
            },
            {
              "name": "后院小径：院内邻接图连接主轴端点，孔洞不跨越；细石板/门口规则/中心装饰待补",
              "id": "1290997501332525056",
              "status": "partial",
              "where": "src/core/garden-paths.js · src/build/buildings.js",
              "page": "garden.html",
              "note": "187帧全核验：院落封闭转草坪、门洞通路/横向小径和中心装饰；原文只说新增garden paths。修本地PCA窄带筛格可能断路，改主轴端点+院内邻接BFS，90种连通占用/环洞/双网格真实World通过。保留既有墙边灌木；细石板宽度、门口优先和中心装饰仍待补。",
              "decodedFrames": 187,
              "reviewEvidence": "artifacts/coverage/garden-contrast-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  186
                ],
                "nativeRevisits": [
                  150
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
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
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "impostor",
              "page": "impostors.html",
              "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；原球面卡片/多俯仰仍缺。",
              "decodedFrames": 334,
              "reviewEvidence": "artifacts/coverage/impostor-view-review.md",
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
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界及背景云GPU局部通过；非原球面卡片、多俯仰或完整云形"
              }
            },
            {
              "name": "运行时精灵：真实GPU烘焙/释放/失败回滚；自动扩容与原素材待补",
              "page": "atlas-live.html",
              "id": "1593215065423245313",
              "status": "partial",
              "where": "src/life/impostor.js · atlas-live.html",
              "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收；本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。",
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
                "acceptanceScope": "共享跨叶候选/key释放和8视角动态GPU烘焙/回收/异常恢复局部通过；非原素材、3D树、自动扩容或完整API"
              }
            },
            {
              "name": "蓬松云：共享树云材质/时钟/遮挡回归通过；原云形/层次仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html",
              "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。",
              "decodedFrames": 235,
              "reviewEvidence": "artifacts/coverage/impostor-view-review.md",
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
                "acceptanceScope": "本地共享锚点/正交平行方向/透视视差/64步周界及背景云GPU局部通过；非原球面卡片、多俯仰或完整云形"
              }
            }
          ]
        ],
        [
          "续作学习与缺口",
          [
            {
              "id": "1707497006640365880",
              "status": "partial",
              "where": "src/world/worldmesh.js（ChunkRouter.edgeTri）· src/terrain/terrainmesh.js · src/terrain/shrub-texture.js · index.html?scene=terrain&on=shrubtex",
              "note": "600帧全核（6张联系表0-599 + 原尺寸0480）；同一套灌木带在连续生成的多岛上，每级台地边各一条、落差越大越宽；本轮实测活几何同时出现 0/0.556/0.588/0.741/1 五档即落差1/2/3/≥4，scaledShare 0.163；修前 aEdge 恒1 故带根本不出现（ChunkRouter 未代理 edgeTri，已补）；缺多岛连续生成与黑剪影过渡、带色偏浅、倒影里没有灌木暖色",
              "decodedFrames": 600,
              "reviewEvidence": "artifacts/coverage/1707497006640365880-review-r53.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  599
                ],
                "nativeRevisits": [
                  480
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "生成地形上的纯纹理灌木带：每级台地边各一条 + 带宽随落差 + 真实 WebGL 编译"
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
              "status": "partial",
              "where": "src/core/grid.js · wfc.html?subtiles=1",
              "page": "wfc.html?subtiles=1",
              "note": "全178帧模块库核验；新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。",
              "decodedFrames": 178,
              "reviewEvidence": "artifacts/coverage/tri-subtiles-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  177
                ],
                "nativeRevisits": [
                  14,
                  85,
                  135,
                  165
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "对角四分几何/父子追溯/实际World及WFC局部验收；非完整原3D模块"
              }
            },
            {
              "name": "2 显式双格房屋：原子放置/整体替换/移除与撤销；身份持久化、预制socket/联合WFC待补",
              "id": "1579483114178768898",
              "status": "partial",
              "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
              "page": "multicell.html",
              "note": "177帧已复核；共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完整prefab/socket待续。",
              "decodedFrames": 177,
              "reviewEvidence": "artifacts/coverage/house-project-review.md"
            },
            {
              "name": "笼形变：分数层连续角点/沉积线采样；3D碰撞待补",
              "id": "1579478470098243584",
              "status": "partial",
              "where": "src/terrain/shape.js · src/terrain/terrainmesh.js · cage.html",
              "toggle": "smooth",
              "page": "cage.html",
              "note": "272帧全核验，含线框构建/着色/转镜；保留共享切面与保护，修分数层高查询并复用到沉积线，连续角点局部通过；完整原cage/3D碰撞仍缺。",
              "decodedFrames": 272,
              "reviewEvidence": "artifacts/coverage/cage-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  271
                ],
                "nativeRevisits": [
                  40,
                  65,
                  90,
                  172
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "连续共享笼角点/沉积线采样局部通过；非完整3D形变碰撞"
              }
            },
            {
              "name": "房屋插入地形：453帧核验，保留共享双格/整体编辑；任意轮廓重网格待补",
              "id": "1584623053061099520",
              "status": "partial",
              "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
              "page": "multicell.html",
              "note": "453帧全序列复核：线框接缝遍历后切实体屋与整岛；不能从画面证明双线性切洞。保留已有显式双格/整体编辑/工程身份，复测两网格各6栋同World融合通过；本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。",
              "decodedFrames": 453,
              "reviewEvidence": "artifacts/coverage/house-point-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  452
                ],
                "nativeRevisits": [
                  5,
                  65,
                  155,
                  235,
                  300,
                  303,
                  392,
                  452
                ],
                "implementationVerified": true,
                "runtimeAccepted": true
              }
            },
            {
              "name": "指定模块patch：几何复核→共享World整体体量放置/撤回；完整prefab待续",
              "id": "1751932427272909032",
              "status": "partial",
              "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js",
              "page": "patch.html",
              "note": "复用552帧，显式patch/搜索/几何后接共享World原子体量放置、支撑占用预检和按列撤回；完整prefab/socket、形变碰撞及补网/WFC待续。",
              "decodedFrames": 552,
              "reviewEvidence": "artifacts/coverage/module-volume-review.md"
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "229帧全核验；现有对偶柱群球面能力保留，原片平滑海岸/模块视觉与平面World/游戏接入仍缺，本批仅学习审核。",
              "decodedFrames": 229,
              "reviewEvidence": "artifacts/coverage/sphere-relax-review.md",
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
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "仅学习与现有球面演示差距审核"
              }
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html",
              "note": "479帧全核验；保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。",
              "decodedFrames": 479,
              "reviewEvidence": "artifacts/coverage/sphere-relax-review.md",
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
                "runtimeAccepted": true,
                "acceptanceScope": "显式模块选择/隔离/误差诊断局部通过；非完整多格拟合"
              }
            },
            {
              "name": "8 沿河导航：高差优先/平床河口距离，战斗及流场共用费用",
              "id": "1795831296952041691",
              "status": "partial",
              "where": "src/world/navgraph.js · river-nav.html",
              "toggle": "nav",
              "page": "river-nav.html",
              "note": "598帧全核验；实际高差优先、平床河口距离，未知方向保持中性河费用；Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。",
              "decodedFrames": 598,
              "reviewEvidence": "artifacts/coverage/river-nav-review.md",
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
                "acceptanceScope": "共享World导航费用局部通过；非原球面水系生成"
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
              "status": "partial",
              "where": "src/core/field-plots.js · fields.html",
              "page": "fields.html",
              "note": "614帧全核；新片是六边格地形工具实录：农田按地块共用耕纹主轴并中线折成人字，本仓原为逐格hash随机角，已新建 field-plots.js 并加 fields.html 左右对照；尚未接回 terrainmesh 实际着色",
              "decodedFrames": 614,
              "reviewEvidence": "artifacts/coverage/1798310423554658732-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  613
                ],
                "nativeRevisits": [
                  100,
                  200,
                  300,
                  516,
                  540,
                  600
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "地块耕纹主轴/人字垄/田埂"
              }
            },
            {
              "id": "1724449858369568780",
              "name": "Ok, here's a small example. The button toggles a…",
              "status": "partial",
              "where": "src/core/node-graph-runtime.js · node-graph.html",
              "page": "node-graph.html",
              "note": "134帧全核；bool资产→select→lerpTowards→compose2→event sink 的节点数据绑定已落地（node-graph-runtime.js + node-graph.html），上移193px、6s走120单位；缺可视化连线编辑器与序列化",
              "decodedFrames": 134,
              "reviewEvidence": "artifacts/coverage/1724449858369568780-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  133
                ],
                "nativeRevisits": [
                  1,
                  70,
                  133
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "节点式数据绑定"
              }
            },
            {
              "id": "1671840905957978113",
              "name": "Hmm.. I thought it was gonna be too wacky but ma…",
              "status": "partial",
              "where": "src/core/terrain-burial.js · terrain-stages.html",
              "page": "terrain-stages.html",
              "note": "246帧全核（原判na有误）；抬地面吞建筑的体素规则已落地（terrain-burial.js + terrain-stages.html 掩埋栏），peeking 3/吞12层；缺墙裙残留与悬檐联动",
              "decodedFrames": 246,
              "reviewEvidence": "artifacts/coverage/1671840905957978113-review.md",
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
                "acceptanceScope": "地表抬升掩埋建筑"
              }
            },
            {
              "id": "1670064751181791233",
              "name": "I figured out how to mimic Thread.Sleep() in Bur…",
              "status": "partial",
              "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
              "page": "terrain-stages.html",
              "note": "420帧全核；累积分阶段执行器+共享时钟+每tick预算慢放已落地（StageRunner/advance）；缺真job线程与四轮节奏还原",
              "decodedFrames": 420,
              "reviewEvidence": "artifacts/coverage/1670064751181791233-review.md",
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
                  419
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "生成过程慢放"
              }
            },
            {
              "id": "1654401054828638214",
              "name": "An quaint island being procedurally generated",
              "status": "partial",
              "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
              "page": "terrain-stages.html",
              "note": "343帧全核；增量Delaunay三角化+抬升+灰模+上色四段已落地（pipeline-stages.js + terrain-stages.html）；缺AO软阴与生成后地形微调，非视觉等价",
              "decodedFrames": 343,
              "reviewEvidence": "artifacts/coverage/1654401054828638214-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  342
                ],
                "nativeRevisits": [
                  1,
                  90,
                  229,
                  343
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "岛屿生成分阶段"
              }
            },
            {
              "id": "1490068909042642944",
              "name": "Late night cryptic graph tweet",
              "status": "partial",
              "where": "src/core/graph-layout.js · grid-graph.html（右栏邻接图）",
              "page": "grid-graph.html",
              "note": "427帧全核（5张联系表全看+原尺寸回看390）；判出真机制=邻接图的极坐标同心环布局：BFS分层成环、环内按父角度定角、颜色按根分支分连续圆弧；新增adjacencyComponents/radialLayout与grid-graph.html右栏，26环/4分支/同环249跨环1004已验；缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻",
              "decodedFrames": 427,
              "reviewEvidence": "artifacts/coverage/1490068909042642944-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  426
                ],
                "nativeRevisits": [
                  390,
                  417,
                  426
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "邻接图极坐标布局"
              }
            },
            {
              "id": "1459169210752507904",
              "name": "And another",
              "status": "partial",
              "where": "src/core/grid-wireframe.js · grid-graph.html（左栏线框）",
              "page": "grid-graph.html",
              "note": "609帧全核（7张联系表全看+原尺寸回看340/500）；判出真机制=不规则四边格+保留三角形的混合网，三角带横穿成条、每40-60帧整片清空重铺；新增classifyWireframe/seamBands与grid-graph.html左栏，四边/三角/带轮廓/岛缘分类与长带串接已验；缺格心彩色小块语义、3D透视视角、接world实景",
              "decodedFrames": 609,
              "reviewEvidence": "artifacts/coverage/1459169210752507904-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  608
                ],
                "nativeRevisits": [
                  340,
                  500,
                  608
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "面型分类与三角过渡带"
              }
            },
            {
              "id": "1448039167057879048",
              "name": "Imma talk about my new island generator at Swede…",
              "status": "partial",
              "where": "src/core/stroke-reveal.js · stroke-reveal.html · src/ui/walkthrough.js",
              "page": "stroke-reveal.html",
              "note": "952帧全核；4轮循环=管线各阶段错峰逐笔画：三角剖分帐篷(顶点竖棒)→密集顶点阵→逐笔线稿→三角共享边线网→等高线→着色岛；本轮新增stroke-reveal.js(错峰+弧长裁剪)与stroke-reveal.html并跑通两测；仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛",
              "decodedFrames": 952,
              "reviewEvidence": "artifacts/coverage/1448039167057879048-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  951
                ],
                "nativeRevisits": [
                  910
                ],
                "implementationVerified": true,
                "runtimeAccepted": true,
                "acceptanceScope": "逐笔描出+错峰计时（顶点竖棒与线网层未实现）"
              }
            },
            {
              "id": "1447483550257799171",
              "name": "I regret to inform you that I've relapsed into p…",
              "status": "partial",
              "where": "src/terrain/generate.js · src/core/contour.js",
              "page": null,
              "note": "565帧全核；44s循环showreel：彩色岛（暗岩块+蓝河网+岩柱）↔切黑后白线逐笔累积成岛轮廓，每轮岛形态不同=连续程序化生成；本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线",
              "decodedFrames": 565,
              "reviewEvidence": "artifacts/coverage/1447483550257799171-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  564
                ],
                "nativeRevisits": [
                  405
                ],
                "implementationVerified": false,
                "runtimeAccepted": false,
                "acceptanceScope": "岛生成与线稿描出判读，未改代码"
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
      "check": "真实融合两种网格各6个双格房屋，混合跨quad+triangle；整体移除/替换和本页撤销已验收。实例身份持久化、完整预制轮廓/socket与联合WFC仍待补。",
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
      "check": "独立planet.html已存在球面房屋/relax演示；尚未将平面共享World的地形、建筑、岸浪和编辑管线完整迁到同一球面。",
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
  }
};
