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
              "where": "src/core/grid.js",
              "toggle": "grid",
              "page": "grids.html?t=kinds"
            },
            {
              "name": "无限网格：块 + 簇各自松弛，顶点 = 块 + 最近两簇的重心插值（无缝、无翻折）",
              "id": "1332410042784641026",
              "status": "done",
              "where": "src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "三块簇/对偶532帧：实际各模式全部owner接缝审计",
              "id": "1151770831619534848",
              "status": "partial",
              "where": "src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "纯格型对照：真实正交方格/合并菱形区分；独立六边待补",
              "id": "1670790425232175108",
              "status": "partial",
              "where": "src/core/grid.js · grids.html",
              "page": "grids.html?t=kinds"
            },
            {
              "name": "拓扑直线：有向状态判环/真实对边段/停止原因",
              "id": "1384958097542819845",
              "status": "partial",
              "where": "src/core/grid.js",
              "page": "grids.html?t=lines"
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974579499802202113",
              "status": "partial",
              "where": "src/core/spatial.js · src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "通用三角图：确定性全查/坏输入拒绝；局部编辑接口待补",
              "id": "1677242779162877952",
              "status": "partial",
              "where": "src/core/trigraph.js",
              "page": "trigraph.html"
            },
            {
              "name": "方形沿对角切四三角：父格追溯/实际WFC；联合模块待补",
              "id": "1447494168448753667",
              "status": "partial",
              "where": "src/core/grid.js · src/core/wfc.js",
              "page": "wfc.html?subtiles=1"
            },
            {
              "name": "Half Edge：511帧已核验；显式环/扇与编辑接口待补",
              "id": "1458921394855718917",
              "status": "partial",
              "where": "src/core/grid.js · src/core/adjacency.js",
              "page": "adjacency.html"
            },
            {
              "name": "球面四阶段：三角化/松弛真实坐标对照；完整原动画待补",
              "id": "1338825080844021760",
              "status": "partial",
              "where": "src/sphere/planet.js",
              "page": "planet.html?stage=tri"
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html"
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html"
            },
            {
              "name": "分层平滑对照：已有形变保留，完整三模式待补",
              "id": "1670725072540106755",
              "status": "partial",
              "where": "src/terrain/shape.js · hierarchy.html",
              "page": "hierarchy.html"
            },
            {
              "name": "Square yet hex：556帧；切角轮廓实验，原岩岛算法待补",
              "id": "1471817524148940807",
              "status": "partial",
              "where": "src/core/corner-footprint.js",
              "page": "corner-cuts.html"
            },
            {
              "name": "不规则三角底图：383帧已学，完整岛生成仍待补",
              "id": "1447496205282549761",
              "status": "partial",
              "where": "src/core/grid.js · src/terrain/generate.js",
              "page": "grids.html?t=kinds"
            },
            {
              "name": "球面投影：径向索引/平面抽样与球面拓扑分开",
              "id": "1338829205157646336",
              "status": "partial",
              "where": "src/sphere/planet.js",
              "page": "planet.html?stage=tri"
            },
            {
              "name": "完美环：直线绕回起点时检测出来；飞岛玩法没做",
              "id": "1313837640366596096",
              "status": "partial",
              "where": "src/core/grid.js（traceStraight）"
            },
            {
              "name": "无限、确定、无缝的松弛四边形网格：一块块六边形冒出来",
              "id": "1151137783785771008",
              "status": "done",
              "where": "src/core/infinite.js · grids.html",
              "page": "grids.html"
            },
            {
              "name": "重心坐标：全帧核验/XZ预计算接真实块簇",
              "id": "974564862729838592",
              "status": "partial",
              "where": "src/core/spatial.js · src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "局部规则/放射模板：324帧核验，单补丁共享接缝；复杂孔洞拒绝、多模板待补",
              "id": "1301816247479345152",
              "status": "partial",
              "where": "src/core/radial-patch.js",
              "page": "gridpatch.html"
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
              "where": "src/water/waterfall.js",
              "toggle": "waterfalls"
            },
            {
              "name": "船迹：固定时间采样/世界轨迹，原片泡沫喷溅仍待补",
              "id": "901469409579061248",
              "status": "partial",
              "where": "src/life/boats.js · src/core/wake-sampling.js",
              "toggle": "boats",
              "page": "wake-fog.html"
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
              "where": "src/world/float-probe.js · float.html · 117帧已核验；本环境16F/32F写入、负值/HDR回读和线性过滤通过；跨平台及平流/CPU误差待补。",
              "page": "float.html"
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
              "where": "src/world/worldmesh.js · src/light/bake.js",
              "toggle": "ao",
              "page": "ao-stages.html"
            },
            {
              "name": "彩色反弹光",
              "id": "1237305125070426112",
              "status": "done",
              "where": "src/light/bake.js",
              "toggle": "ao"
            },
            {
              "name": "柔和投影",
              "id": "1305948413872267265",
              "status": "done",
              "where": "src/world/view.js",
              "toggle": "shadows"
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
              "where": "src/world/view.js",
              "toggle": "lightonly"
            },
            {
              "name": "墨线（反向外壳描边）",
              "id": "1751945034851570056",
              "status": "done",
              "where": "src/world/outline.js",
              "toggle": "outline"
            },
            {
              "name": "逆光亮边（第二层外壳，迎着太阳才出现）",
              "id": "1751945034851570056",
              "status": "done",
              "where": "src/world/outline.js",
              "toggle": "backlit"
            },
            {
              "name": "软法线：弯曲崖壁变圆、崖顶仍硬（Bad North 体素法线）",
              "id": "1062374549407350790",
              "status": "done",
              "where": "src/core/meshwriter.js · normals()"
            },
            {
              "name": "平滑 / 硬法线混合（屏幕空间导数算硬法线）",
              "id": "929417420921556993",
              "status": "done",
              "where": "src/world/view.js",
              "toggle": "hardnormal"
            },
            {
              "name": "逐顶点体素阴影（体素空间里朝太阳走）",
              "id": "1190191289922465793",
              "status": "done",
              "where": "src/world/view.js",
              "toggle": "voxshadow"
            },
            {
              "name": "按分辨率加粗描边",
              "id": "1017355723171344385",
              "status": "done",
              "where": "src/world/outline.js",
              "toggle": "thickoutline"
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
              "where": "src/light/lightvolume.js · src/world/view.js",
              "page": "lightvolume.html"
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
              "where": "src/world/view.js（lightonly / ao）"
            },
            {
              "name": "很基础的光照 + 非真体素的 AO 新做法（画面：灰色城墙模型），即分层 AO 烘焙",
              "id": "1168168400155267072",
              "status": "done",
              "where": "src/light/bake.js"
            },
            {
              "name": "共享World用途：碰撞/支撑/梯度诊断，真实风场按实心位保留洞内空气",
              "id": "931196707236392960",
              "status": "done",
              "where": "src/core/world-probes.js · src/life/atmosphere.js",
              "page": "flow.html"
            },
            {
              "name": "GI峡谷：185帧复核，保留体素反弹；原版形因子/参考接口缺口",
              "id": "1580835075629133825",
              "status": "partial",
              "where": "src/core/voxel-distance.js · src/light/lightvolume.js",
              "page": "lightvolume.html"
            },
            {
              "name": "反弹过程：41帧核验，0/1/3/6次与实测变化；完整往返反馈待补",
              "id": "1580846877855338497",
              "status": "partial",
              "where": "src/light/lightvolume.js · src/world/view.js",
              "page": "lightvolume.html"
            },
            {
              "name": "两色点光体积：176帧核验，有限DDA/直接项/移动关闭通过",
              "id": "1582757294672314368",
              "status": "done",
              "where": "src/light/lightvolume.js · src/world/view.js",
              "page": "lightvolume.html"
            },
            {
              "name": "法线/SDF/六AO：425帧复核，中心EDT/保守步进/六AO诊断；笔触法线待补",
              "id": "1481661852887265288",
              "status": "partial",
              "where": "src/core/voxel-distance.js · src/light/lightvolume.js",
              "page": "lightvolume.html"
            },
            {
              "name": "球面高度立方体光照：低分辨率6面、顶点单次查询",
              "id": "1791049306213912823",
              "status": "done",
              "where": "src/core/cube-height.js · src/light/cube-height.js（273帧；本地高度暗化解释，GPU验证）",
              "page": "planet.html"
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
              "page": "navigation.html"
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
              "page": "scheduler.html"
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
              "page": "wfc.html"
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
              "page": "wfc.html"
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
              "page": "adjacency.html"
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
              "where": "src/core/contour.js · src/world/contour-overlay.js",
              "page": "contour.html",
              "toggle": "contours"
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
              "toggle": "visibility"
            },
            {
              "name": "三维空间开阔度：64帧全核，固定步长实际World局部验收",
              "id": "798580832906739712",
              "status": "partial",
              "where": "src/core/space-visibility.js",
              "page": "space-visibility.html"
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
              "where": "src/build/doodle-wall.js · src/world/doodle-overlay.js",
              "page": "doodle.html"
            },
            {
              "id": "1890018647655272491",
              "name": "黑白走廊研究：单色表面、稳定布局；弧顶/门口版式待补",
              "toggle": "doodlegray",
              "status": "partial",
              "where": "src/build/doodle-wall.js · src/world/doodle-overlay.js",
              "page": "doodle.html"
            }
          ]
        ],
        [
          "模块出现条件诊断",
          [
            {
              "id": "1670794261669769217",
              "name": "特定条件模块的有限样本诊断：完整计数/下界/未知分开，不冒充WFC概率",
              "status": "partial",
              "where": "src/core/module-audit.js",
              "page": "patch.html"
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
              "where": "src/core/wfc.js",
              "page": "wfc-trace.html"
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
              "where": "src/core/contour.js · src/world/contour-overlay.js",
              "page": "contour.html"
            },
            {
              "name": "2 模块装配（原作 545 块，这里用规则生成）+ 模块签名调试色：同一种邻居占用 = 同一块拼图 = 同一种颜色",
              "id": "1279107097108635649",
              "status": "done",
              "where": "src/build/buildings.js（sigColor）",
              "toggle": "modules"
            },
            {
              "id": "1344290848180203523",
              "name": "复杂悬空建筑QA：共享World编辑压力回放（局部验收）",
              "status": "partial",
              "where": "src/core/qa-replay.js",
              "page": "qa-replay.html"
            },
            {
              "name": "3 建筑增删、暖橙屋顶与多色墙（原帖重点含饱和度、庭院草地和彩色反弹）",
              "id": "1197909675443916803",
              "status": "partial",
              "where": "src/build/buildings.js · src/light/bake.js（现有实现保留，完整原作视觉待补）",
              "tour": "gable"
            },
            {
              "name": "296帧：钢架编辑全核，完整WFC待补",
              "id": "1189902695303458816",
              "status": "partial",
              "where": "src/build/buildings.js",
              "tour": "stilt",
              "page": "building-components.html"
            },
            {
              "name": "4 支撑：拱",
              "id": "1189908238566903808",
              "status": "done",
              "where": "src/build/buildings.js",
              "tour": "arch"
            },
            {
              "name": "道具/门窗：261帧；实际窗台全外缘预留，完整家具待补",
              "id": "1205416648397721601",
              "status": "partial",
              "where": "src/core/opening-footprint.js · src/build/buildings.js",
              "page": "index.html?scene=town"
            },
            {
              "name": "6 围合庭院：按实际墙层识别开口，上层桥不再封院",
              "id": "1238474550511308800",
              "status": "partial",
              "where": "src/core/courtyards.js · src/build/buildings.js",
              "tour": "yard",
              "page": "garden.html"
            },
            {
              "name": "六类局部墙饰接实际建筑；跨格整立面/真实洞口待补",
              "id": "1181464374839521280",
              "status": "partial",
              "where": "src/core/surface-decoration.js · src/build/buildings.js",
              "toggle": "stairs",
              "page": "building-components.html"
            },
            {
              "name": "8 海鸥：排在屋脊上、只有停着有描边、挪动、倒影、扇翅滑翔绕镇飞",
              "id": "1244892370392489989",
              "status": "done",
              "where": "src/life/birds.js",
              "toggle": "birds"
            },
            {
              "name": "8b 蝴蝶：绕落点松散盘旋、随机换落点、世界空间噪声",
              "id": "1273520600221433857",
              "status": "done",
              "where": "src/life/decor.js",
              "toggle": "butterflies"
            },
            {
              "name": "8c 庭院/楼间彩旗绳：308帧复核，纠正屋顶旗归因；双网格开关/截图通过",
              "id": "1212732478458343424",
              "status": "done",
              "where": "src/life/decor.js（refresh / #wire）",
              "toggle": "wires"
            },
            {
              "name": "8d 楼间绳线/衣物：精确墙面端点与逐层包络，双网格通过",
              "id": "1259838941299183619",
              "status": "done",
              "where": "src/core/wire-route.js · src/life/decor.js",
              "toggle": "wires"
            },
            {
              "name": "8e 水花：落水时泡沫环 + 飞沫",
              "id": "1258421104756097029",
              "status": "done",
              "where": "src/life/effects.js"
            },
            {
              "name": "8f 道具出现/消失：已逐帧，独立生命周期待接（现仅柱顶增长/灰尘）",
              "id": "1246074663546916873",
              "status": "partial",
              "where": "src/life/effects.js（非完整propanim）"
            },
            {
              "name": "Max保留颜色：新增Max/Add真实GPU对照，重叠不累加增亮",
              "id": "1056990611738451968",
              "status": "done",
              "where": "src/life/effects.js（setFireAppearance）",
              "toggle": "fire",
              "page": "fire.html"
            },
            {
              "name": "保留快速收缩，补实际寿命年龄/出生尺寸/到期丢弃；线性对照",
              "id": "1056992291108413446",
              "status": "done",
              "where": "src/life/effects.js（fspan / fireShrink）",
              "page": "fire.html"
            },
            {
              "name": "8g3 烟雾两遍/硬边渐隐保留，新增相机排序；已有烟源时可看棋盘格",
              "id": "1015140880666300416",
              "status": "done",
              "where": "src/life/smoke.js",
              "toggle": "smokecheck",
              "page": "smoke.html"
            },
            {
              "name": "8i 战斗痕迹：血、尸体、箭射中后粘在船上随船走（Bad North 战斗；原文 \"making blood, corpses and arrows stick to boats\"）——画面是长船靠岸、箭雨、滩上尸体和血，不是草和花",
              "id": "946660607008403456",
              "status": "done",
              "where": "src/badnorth/battle.js · core/platform-anchor.js（440帧；血斑/尸体完整锚点、箭附着及离场清理，双网格验证）",
              "page": "scene:badnorth"
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
              "where": "src/world/save.js · app.js",
              "page": "save-mesh.html"
            },
            {
              "name": "9b 撤销历史回放：可停止/保岛，截断历史偏移已修复（动作特效另补）",
              "id": "1260586697538113537",
              "status": "partial",
              "where": "src/core/snapshot-replay.js · src/world/app.js",
              "page": "index.html?scene=town"
            },
            {
              "name": "蝴蝶在后院花园上空飞（画面：环形排屋围着的花园）",
              "id": "1270725616430530566",
              "status": "done",
              "where": "src/life/decor.js"
            },
            {
              "name": "窗户的风格与密度（每层 1–2 扇白框小窗）、不同颜色的房子相接",
              "id": "1176516621223043073",
              "status": "done",
              "where": "src/build/buildings.js"
            },
            {
              "name": "白天也好看的火：靠 Max 混合，粒子融成一个火焰轮廓不过曝（北境里小屋失守时着火）",
              "id": "1056999668486471682",
              "status": "done",
              "where": "src/life/effects.js（MaxEquation）"
            },
            {
              "name": "年龄增加mip偏移；同尺寸卡片GPU实测与mip开关，保留隐式LOD语义",
              "id": "1015151731804721152",
              "status": "done",
              "where": "src/life/smoke.js（真实纹理采样）",
              "page": "smoke.html"
            },
            {
              "name": "随机正反UV沿投影烟流滚动；真实mip棋盘/裸方片与关闭滚动对照",
              "id": "1015149712469524480",
              "status": "done",
              "where": "src/life/smoke.js（aFlow / aDir）",
              "page": "smoke.html"
            },
            {
              "name": "两遍画：黑底/浅色遍可单独验收、阈值仅内收一次、同深度排序与实例属性配对",
              "id": "1015142746372366336",
              "status": "done",
              "where": "src/life/smoke.js · src/core/smoke-order.js",
              "page": "smoke.html"
            },
            {
              "name": "灯塔：海边一格粗高塔 → 灯室 + 旋转光束",
              "id": "1331905048801144836",
              "status": "done",
              "where": "src/build/lighthouse.js",
              "toggle": "lighthouse"
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
              "where": "src/core/arch-profile.js · src/build/buildings.js",
              "page": "arches.html"
            },
            {
              "id": "802496920790777856",
              "status": "partial",
              "name": "292帧：水渠/穿楼拱洞，局部曲线验收",
              "where": "src/core/arch-profile.js · src/build/buildings.js",
              "page": "arches.html"
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
              "where": "原3D模块库与动画未迁移"
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
              "where": "src/core/frontier.js",
              "page": "campaign.html"
            },
            {
              "name": "软坡＋硬崖：656帧复核，完整连续坡/无局部低洼生成待补；层级XZ形变不能替代",
              "id": "1447488323845509121",
              "status": "partial",
              "where": "src/terrain/generate.js · shape.js（完整软坡/侵蚀保证待补）",
              "page": "overhang.html"
            },
            {
              "name": "3 河网：填洼/汇水累计重建接共享World；原球面联合坍缩待补",
              "id": "1769691526924292506",
              "status": "partial",
              "where": "src/core/river-network.js · src/terrain/river-network.js",
              "page": "drainage.html"
            },
            {
              "name": "边层级：共享切面显式硬边；模块/材质边语义待补",
              "id": "1670720537662836736",
              "status": "partial",
              "where": "src/terrain/shape.js · hierarchy.html",
              "toggle": "smooth",
              "page": "hierarchy.html"
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html"
            },
            {
              "name": "弯层理：可逆Y剪切纹理场、几何保持原位；同位置相位/三角剖分GPU无缝",
              "id": "1699146321318314094",
              "status": "partial",
              "where": "src/core/sediment.js · terrainmesh.js · View",
              "page": "sediment.html",
              "toggle": "strata"
            },
            {
              "name": "树转镜：旋转锚点/正交与透视/周界GPU通过；原octagonal卡片与俯仰仍缺",
              "id": "1849427564034498642",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "impostor",
              "page": "impostors.html"
            },
            {
              "name": "蓬松云：共享树云材质/时钟/遮挡回归通过；原云形/层次仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html"
            },
            {
              "name": "9 分层避障风场：通洞/封洞与共享风向已验；完整轨迹接口待补",
              "id": "926903893866541057",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/world-probes.js",
              "toggle": "wind",
              "page": "flow.html"
            },
            {
              "name": "10 受风雪片：真实层碰撞保留洞口；简单白点/表面混白，软片与AO待补",
              "id": "943230624369868800",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/world-probes.js",
              "toggle": "snow",
              "page": "flow.html"
            },
            {
              "name": "11 背景雾：外缘渐隐 / 浓度与相对流速（圆盘近似）",
              "id": "906207980802252801",
              "status": "partial",
              "where": "src/life/atmosphere.js · src/core/fog-envelope.js",
              "toggle": "fog",
              "page": "wake-fog.html"
            },
            {
              "name": "悬挑/柱间空洞：分层岩石底面、空隙诊断与切面面积/边长保护已接；3D侧壁交叉仍待补",
              "id": "1671808851895627776",
              "status": "partial",
              "where": "src/core/rock-topology.js · terrain/features.js · terrainmesh.js",
              "page": "overhang.html"
            },
            {
              "name": "14 天然石拱：两根岩柱之间架一道，拱下至少空一层",
              "id": "1670794261669769217",
              "status": "done",
              "where": "src/terrain/features.js",
              "page": "scene:terrain"
            },
            {
              "name": "斜向崖脊/柱群观察：267帧纠偏，蘑菇石扩展保留；薄檐形变面积/边长保护已接",
              "id": "1708815475801505819",
              "status": "partial",
              "where": "src/terrain/features.js · shape.js · src/core/deformation-guard.js",
              "page": "overhang.html"
            },
            {
              "name": "坍缩边缘候选：434帧核验，真实半边只读枚举；增量导航互连待补",
              "id": "1582293326815862786",
              "status": "partial",
              "where": "src/core/frontier-candidates.js · wfc.html",
              "page": "wfc.html"
            },
            {
              "name": "近云同图投影/首页开关局部验收；远云影与模糊仍缺",
              "id": "1243228419162341379",
              "status": "partial",
              "where": "src/light/cloud-shadow.js · src/life/impostor.js",
              "toggle": "cloudshadow",
              "page": "clouds.html"
            },
            {
              "name": "岩壁宽窄层带：世界坐标着色与直/弯对照，旧窄条保留；原作外观/反射仍待补",
              "id": "1699038611125985317",
              "status": "partial",
              "where": "src/core/sediment.js · terrainmesh.js · View",
              "page": "sediment.html",
              "toggle": "strata"
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
              "where": "planet.html（网格能力保留，非原纹理）",
              "page": "planet.html"
            },
            {
              "id": "1786014232594485497",
              "name": "山体：共享岩壁底色/顶点明度/实时法线局部通过；原纹理待补",
              "status": "partial",
              "where": "src/core/mountain-bake.js · mountain-bake.html",
              "page": "mountain-bake.html"
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
              "where": "src/terrain/shape.js · cage.html",
              "page": "cage.html"
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
              "where": "src/terrain/generate.js",
              "page": "scene:terrain"
            }
          ]
        ],
        [
          "台地逻辑诊断",
          [
            {
              "id": "815236105079398400",
              "status": "partial",
              "where": "src/core/terrace-profile.js",
              "page": "terraces.html",
              "name": "185帧台地诊断"
            },
            {
              "id": "781957658597269506",
              "status": "partial",
              "where": "src/core/terrace-profile.js",
              "page": "terraces.html",
              "name": "109帧黄色薄平台，仅学习"
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
              "where": "src/core/terrace-edges.js · src/world/terrace-edges.js",
              "page": "terraces.html"
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
              "where": "src/core/ladder-profile.js · src/world/navlayer.js",
              "page": "terraces.html"
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
              "where": "src/badnorth/island.js",
              "page": "scene:badnorth"
            },
            {
              "id": "943230620242796544",
              "name": "冬季宣传全景：306帧已学；第210帧切到船群/士兵/血烟，完整组合待实现验收",
              "status": "partial",
              "where": "已有雪/战斗主体保留，完整冬景组合待补",
              "page": "artifacts/coverage/clouds-winter-review.md"
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
              "where": "src/world/traffic.js · src/badnorth/battle.js（passageDots）",
              "page": "scene:badnorth",
              "toggle": "passages"
            },
            {
              "name": "血、尸体、箭粘在船上随船走",
              "id": "946660607008403456",
              "status": "done",
              "where": "src/badnorth/battle.js · core/platform-anchor.js（440帧；血斑/尸体完整锚点、箭附着及离场清理，双网格验证）",
              "page": "scene:badnorth"
            },
            {
              "name": "血浸透当血量指示",
              "id": "984813819280191488",
              "status": "partial",
              "where": "src/badnorth/battle.js · core/combat-profile.js · life/unit-sprites.js（934帧；大小兵、中断/浸血及精灵反馈通过，完整动作/美术待续）"
            },
            {
              "name": "近战手感：挨打后退、血滴飞溅；会被打下悬崖",
              "id": "1022573208590057472",
              "status": "done",
              "where": "src/badnorth/battle.js（#hit / #fallStep）",
              "page": "scene:badnorth"
            },
            {
              "name": "矛兵：够得更远、先出手",
              "id": "903647529203634176",
              "status": "partial",
              "where": "src/badnorth/battle.js · core/spear-thrust.js（654帧；连续检测/命中集/显示同步通过，完整持矛动作及3D遮挡待续）",
              "page": "scene:badnorth"
            },
            {
              "name": "流场 / 影响场：多源 Dijkstra + 数据继承（兵种），每 0.25 秒一次",
              "id": "972829402873716737",
              "status": "done",
              "where": "src/badnorth/flowfield.js（分层多源场）· battle.js",
              "toggle": "flow"
            },
            {
              "name": "678帧弹道：共享查表/实际端点修复，原表达式待补",
              "id": "987267068495003648",
              "status": "partial",
              "where": "src/core/ballistic-table.js · src/badnorth/battle.js",
              "page": "ballistics.html"
            },
            {
              "name": "血迹跟着身体（物体空间血斑）；可关掉血腥",
              "id": "999185422403055616",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "toggle": "gore"
            },
            {
              "name": "洞穴725帧仅学习：厚岩拱洞/多层战斗",
              "id": "906416813810049025",
              "status": "partial",
              "where": "artifacts/coverage/cloud-depth-review.md",
              "page": "artifacts/coverage/cloud-depth-review.md"
            },
            {
              "name": "窄道会车（简化：互相让开）",
              "id": "880853661936734211",
              "status": "partial",
              "where": "src/world/traffic.js · src/badnorth/battle.js（601帧；左行/半径分离/暂停冻结通过，复杂路口及体型路由待续）"
            },
            {
              "name": "关掉血腥：面板「血腥」取消勾选后不画血、不留尸体（画面就是同一场战斗的有血 / 无血对比）",
              "id": "999191760944418817",
              "status": "done",
              "where": "src/badnorth/battle.js（gore）"
            },
            {
              "name": "真实军旗共享风/Bezier：暂停零漂移，新增白徽记/透明分叉尾；布料碰撞仍非目标",
              "id": "926834721392340992",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "战斗动图：台地边上混战、血、落水的人；挨打后退 + 血滴飞溅落地成血点",
              "id": "912691357440978945",
              "status": "done",
              "where": "src/badnorth/battle.js（#hit）"
            },
            {
              "name": "\"瑞士奶酪\"一样的多洞岛（画面：拱门、洞口很多的紫色岩岛）。重构版有悬垂和石拱的造型，但单位不能穿洞",
              "id": "906425294533394432",
              "status": "partial",
              "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
              "page": "navigation.html"
            },
            {
              "name": "数据继承可视化：每格到父格一段线，颜色 = 从哪支守军继承来的（面板「流场」）",
              "id": "902069261304287232",
              "status": "done",
              "where": "src/badnorth/flowfield.js（分层多源场）· battle.js"
            },
            {
              "name": "流场 / 影响场：除了到最近单位的距离和方向，还带着\"那是什么兵种\"；维京人看到矛兵正面会绕开去打小屋",
              "id": "901842167508992000",
              "status": "done",
              "where": "src/badnorth/flowfield.js（分层多源场）· battle.js"
            },
            {
              "name": "单位会被打下悬崖：挨打时身后低 ≥2 层就可能被击飞，抛物线落下，落差大的摔死",
              "id": "870296307889573889",
              "status": "done",
              "where": "src/badnorth/battle.js（#hit / #fallStep）"
            },
            {
              "name": "真实发船泊位/直线进场走廊预留局部通过；岸礁/动态避让待补",
              "id": "974325184525201409",
              "status": "partial",
              "where": "src/badnorth/landing-plan.js · src/core/obb.js",
              "page": "index.html?scene=badnorth"
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
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "战役五步：散开→剔除→主路/支路/节点；连通补桥与有界无回环主路通过",
              "id": "1042732450730913793",
              "status": "done",
              "where": "src/core/campaign-graph.js · src/campaign/campaign.js",
              "page": "campaign.html"
            },
            {
              "name": "真实共享World几何→64²快照；双线性/导数阈值对照，主战役图标仍保留程序近似",
              "id": "911913981731885056",
              "status": "done",
              "where": "src/world/island-snapshot.js",
              "page": "snapshot.html"
            },
            {
              "name": "连接分组：保留整组合并，按权重逐节点调整边界、保持区域连通；第4步可回放历史",
              "id": "938422757288792064",
              "status": "done",
              "where": "src/core/region-groups.js · src/campaign/campaign.js",
              "page": "campaign.html"
            },
            {
              "name": "战役岛屿散开与分区：重合散开、断开分量保留，原作精确权重/调度未知",
              "id": "938405900573986816",
              "status": "done",
              "where": "src/core/region-groups.js · src/campaign/campaign.js",
              "page": "campaign.html"
            },
            {
              "name": "节点候选图与选路：Delaunay为本地近似，原作精确邻接未知；凸包边/连通修复已验收",
              "id": "1078792665980915714",
              "status": "done",
              "where": "src/core/campaign-graph.js · src/campaign/campaign.js",
              "page": "campaign.html"
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
              "toggle": "unitsprites"
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
              "where": "src/core/unit-shadow.js · src/badnorth/battle.js",
              "page": "unit-shadows.html"
            },
            {
              "id": "821321422140309504",
              "status": "partial",
              "name": "动画/战斗与单位接触软盘复核",
              "where": "src/core/unit-shadow.js · src/badnorth/battle.js",
              "page": "unit-shadows.html"
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
              "where": "src/core/unit-tier.js · src/badnorth/battle.js"
            },
            {
              "id": "827215002448846848",
              "name": "单位等级：524帧；3D色阶局部通过",
              "status": "partial",
              "page": "unit-tiers.html",
              "where": "src/core/unit-tier.js · src/badnorth/battle.js"
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
              "where": "src/core/unit-ground-height.js",
              "page": "index.html?scene=badnorth"
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
              "where": "src/core/house-door-presence.js",
              "page": "index.html?scene=badnorth"
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
              "page": "artifacts/coverage/path-samples-review.md"
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
              "page": "hip-roofs.html"
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
              "page": "squad-banners.html"
            }
          ]
        ],
        [
          "多格高层建筑学习待迁移",
          [
            {
              "id": "793545297376972801",
              "status": "partial",
              "name": "多格/体素AO102帧，仅学习",
              "where": "artifacts/coverage/multitile-ao-review.md",
              "page": "artifacts/coverage/multitile-ao-review.md"
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
              "where": "artifacts/coverage/ao-stages-review.md",
              "page": "ao-stages.html"
            }
          ]
        ],
        [
          "导航流动逐帧复核",
          [
            {
              "id": "816748103193817088",
              "status": "partial",
              "name": "真实24单位通口前视/合法推进局部通过；完整连续面/坡高待补",
              "where": "src/core/portal-aim.js · src/world/battle-navigation.js",
              "page": "index.html?scene=badnorth"
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
              "page": "normal-contrast.html"
            },
            {
              "name": "隔像素线：连续UV重映射＋线性采样；放大积分宽度1px，缩小/全atlas接入待补",
              "id": "1241096929490149376",
              "status": "partial",
              "where": "src/core/texel-skip.js · textures.html",
              "page": "textures.html"
            },
            {
              "name": "fwidth缩放抗锯齿：保留纹理实验，真实快照alpha阈值及受控1像素线GPU验收通过",
              "id": "978211952504852480",
              "status": "done",
              "where": "textures.html · src/world/island-snapshot.js",
              "page": "snapshot.html"
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
              "where": "src/terrain/field-pattern.js · WorldMesh/View",
              "page": "fields.html",
              "toggle": "fields"
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
              "where": "src/world/view.js（地面笔触）"
            },
            {
              "name": "径向大小排序：原片UV图块已学；旧圆块仅近似，UV流程未验",
              "id": "1478114309263839244",
              "status": "partial",
              "where": "textures.html（旧圆块近似）",
              "page": "textures.html?t=radial"
            },
            {
              "name": "单纹理八方向/中心镜像：D4与可选固定像素尺度折叠，原作纹样/布局仍待补",
              "id": "1061221291137605633",
              "status": "partial",
              "where": "src/core/mirror-uv.js · src/ui/ornament.js",
              "page": "mirror.html"
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
              "where": "src/core/palette.js"
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
              "where": "textures.html（UI 装饰）",
              "page": "textures.html"
            },
            {
              "name": "单张距离场镜像 / 独立border与center / uniform展开播放：GPU三档尺寸通过；本地画稿/动画样例",
              "id": "1104771432440049664",
              "status": "done",
              "where": "src/core/ornament-field.js · src/ui/ornament.js",
              "page": "ornament.html"
            },
            {
              "name": "单张距离场镜像 / 独立border与center / uniform展开播放：GPU三档尺寸通过；本地画稿/动画样例",
              "id": "1105131621391495176",
              "status": "done",
              "where": "src/core/ornament-field.js · src/ui/ornament.js",
              "page": "ornament.html"
            },
            {
              "name": "UI flair：标题/外纹本地两轨可拖动、空白端点；原徽章/逐部件时序待补",
              "id": "1024679338292256769",
              "status": "partial",
              "where": "src/core/ui-reveal.js · ornament.html",
              "page": "ornament.html"
            },
            {
              "name": "拉太长会看出重复",
              "id": "1061227418961219585",
              "status": "done",
              "where": "textures.html",
              "page": "textures.html?t=deco"
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
              "where": "src/core/atlas.js · grids.html",
              "page": "grids.html?t=atlas"
            },
            {
              "name": "矩形删除：过期句柄修复、空兄弟合并；仍会残留碎片",
              "id": "1765041830461055127",
              "status": "partial",
              "where": "src/core/atlas.js · grids.html",
              "page": "grids.html?t=atlas"
            },
            {
              "name": "矩形候选/树剪枝：跨叶放置与key释放通过；3D树/完整接口待补",
              "id": "1764958522398146667",
              "status": "partial",
              "where": "src/core/atlas.js · grids.html",
              "page": "grids.html?t=atlas"
            },
            {
              "name": "主体OBJ导出：精确坐标/属性检查/真实下载（植被水面另补）",
              "id": "1430224300003545091",
              "status": "partial",
              "where": "src/tools/objexport.js",
              "page": "index.html?scene=town"
            },
            {
              "name": "合并网格：实测共享主体一次提交（非全场景 / Switch基准）",
              "id": "1401145625572425728",
              "status": "partial",
              "where": "src/world/worldmesh.js · src/tools/mesh-audit.js",
              "page": "save-mesh.html"
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
              "page": "ui.html?t=face"
            },
            {
              "name": "游戏头像展示：卡片身份重绘/换列已验；原兜帽/锁甲素材与角色接口待接",
              "id": "1010979395719319552",
              "status": "partial",
              "where": "src/core/part-random.js · ui.html",
              "page": "ui.html?t=face"
            },
            {
              "name": "通用旗形与本地徽记：54帧全原尺寸，六尾形共用到真实军旗",
              "id": "958410200146497537",
              "status": "done",
              "where": "src/core/banner.js · src/life/banner.js · src/badnorth/battle.js",
              "page": "banners.html"
            },
            {
              "name": "确认弹出：纠正横排，延时清理/切队/Esc/手机已验；单Move游戏目标待接",
              "id": "1016680972610359298",
              "status": "partial",
              "where": "ui.html（本地UI演示）",
              "page": "ui.html?t=pop"
            },
            {
              "name": "斜按钮：确定性视觉扰动/AABB、稳定命中槽与键盘已验；游戏菜单待接",
              "id": "1242824460325052417",
              "status": "partial",
              "where": "src/core/playful-layout.js · ui.html",
              "page": "ui.html?t=menu"
            },
            {
              "name": "图标：单选状态/方向键/禁用跳过/切页保持已验；图稿与游戏指令待接",
              "id": "1201179450668441600",
              "status": "partial",
              "where": "src/ui/icon-toolbar.js · ui.html",
              "page": "ui.html?t=icons"
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
              "where": "src/core/vertex-dual.js · src/world/vertex-dual-overlay.js",
              "page": "gridpatch.html"
            },
            {
              "name": "1b 早期高层草地分区（树木为原帖后续计划，完整地块规则待补）",
              "id": "1178731576982724611",
              "status": "partial",
              "where": "src/build/buildings.js（地面庭院仅部分对应）",
              "page": "garden.html"
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
              "where": "src/core/level-flora.js · src/life/vegetation.js",
              "toggle": "grass",
              "page": "level-flora.html"
            },
            {
              "name": "2b 坡上长草，帮助读出可走的地方",
              "id": "1063115611289645057",
              "status": "done",
              "where": "src/life/vegetation.js（坡上、崖边更密）",
              "toggle": "grass"
            },
            {
              "name": "2c 草丛广告牌：一张朝镜头的卡片，片元里用 5 个圆的并集画\"扇贝边\"叶丛，叶瓣之间有弧形墨线；一簇簇堆在崖脚（暖橙 / 赭）、崖顶边和坡上，开阔草地只零星几簇",
              "id": "1590669875869286400",
              "status": "done",
              "where": "src/life/vegetation.js（tuftGeometry / tuftMaterial）",
              "toggle": "grass"
            },
            {
              "name": "草丛反差：181帧复核；原法为顶点shader采站立点/背景射线的纹理差，当前待实现",
              "id": "1590674061092212738",
              "status": "partial",
              "where": "src/life/vegetation.js（仅静态邻崖近似）",
              "toggle": "outline"
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
              "where": "src/core/level-flora.js · src/life/vegetation.js",
              "toggle": "flowers",
              "page": "level-flora.html"
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
              "where": "纯纹理灌木待实现（保留现有球团近似）",
              "note": "257帧全核验。配文明确100%纹理，近景有三角线框与小暗边；现有球团/叶片alpha不能算该法复现。纯纹理灌木、浮凸小阴影与表面贴附仍待实现/运行验收。",
              "decodedFrames": 257,
              "reviewEvidence": "artifacts/coverage/shrub-edge-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  256
                ],
                "nativeRevisits": [
                  150
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              },
              "page": "index.html?scene=terrain",
              "name": "100%纹理灌木与小阴影：已学257帧，实现待补"
            },
            {
              "name": "3b 锚定中心：共享草卡片GPU对照通过，墙根灌木仍待接",
              "id": "1191990107785572352",
              "status": "partial",
              "where": "src/core/anchored-billboard.js · src/life/vegetation.js",
              "page": "billboard-anchor.html"
            },
            {
              "name": "3c 球面叶纹 × 视角alpha：真实贴图/连续覆盖，保留旧噪声对照；阴影与远景impostor待补",
              "id": "1205420678859632640",
              "status": "partial",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
              "toggle": "leafy",
              "page": "leaf-surface.html"
            },
            {
              "name": "3d 植物32²角落atlas：已接共享树冠/灌木；全场景共图与原作素材待补",
              "id": "1241046107125399552",
              "status": "partial",
              "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
              "toggle": "shrubs",
              "page": "leaf-surface.html"
            },
            {
              "name": "后院小径：院内邻接图连接主轴端点，孔洞不跨越；细石板/门口规则/中心装饰待补",
              "id": "1290997501332525056",
              "status": "partial",
              "where": "src/core/garden-paths.js · src/build/buildings.js",
              "page": "garden.html"
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
              "where": "src/life/vegetation.js（几团球融合 + 朝团心的法线）",
              "toggle": "trees"
            },
            {
              "name": "4b 标记三角形之间的边（团块描边）",
              "id": "1580162341668237312",
              "status": "done",
              "where": "src/core/canopy.js · life/vegetation.js · life/impostor.js（155帧；闭合曲面/接缝松弛及真实烘焙输入通过）",
              "toggle": "outline",
              "page": "scene:terrain"
            },
            {
              "name": "树转镜：旋转锚点/正交与透视/周界GPU通过；原octagonal卡片与俯仰仍缺",
              "id": "1849427564034498642",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "impostor",
              "page": "impostors.html"
            },
            {
              "name": "运行时精灵：真实GPU烘焙/释放/失败回滚；自动扩容与原素材待补",
              "page": "atlas-live.html",
              "id": "1593215065423245313",
              "status": "partial",
              "where": "src/life/impostor.js · atlas-live.html"
            },
            {
              "name": "蓬松云：共享树云材质/时钟/遮挡回归通过；原云形/层次仍缺",
              "id": "1852334860137849222",
              "status": "partial",
              "where": "src/life/impostor.js · impostors.html",
              "toggle": "clouds",
              "page": "impostors.html"
            }
          ]
        ],
        [
          "续作学习与缺口",
          [
            {
              "id": "1707497006640365880",
              "status": "partial",
              "where": "纹理灌木生成待实现（保留既有球团管线）",
              "note": "600帧全核验。多组岛从简单几何底色到表面/边缘纹理，夹有空背景和黑轮廓。仅效果证据，不证明生成算法或异步管线；原作纯纹理灌木生成/小阴影仍待实现，保留现有球团近似。",
              "decodedFrames": 600,
              "reviewEvidence": "artifacts/coverage/palette-editor-review.md",
              "reviewStages": {
                "textRead": true,
                "allFramesReviewed": true,
                "frameRange": [
                  0,
                  599
                ],
                "nativeRevisits": [
                  390
                ],
                "implementationVerified": false,
                "runtimeAccepted": false
              },
              "page": "index.html?scene=terrain",
              "name": "多岛纹理生成：已学600帧，原作生成算法待补"
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
              "where": "src/core/grid.js · src/core/wfc.js",
              "page": "wfc.html?subtiles=1"
            },
            {
              "name": "2 显式双格房屋：原子放置/整体替换/移除与撤销；身份持久化、预制socket/联合WFC待补",
              "id": "1579483114178768898",
              "status": "partial",
              "where": "src/build/multicell.js · ui/house-project.js（177帧；整体编辑/工程身份持久化通过，通用实例与完整prefab/socket待续）",
              "page": "multicell.html"
            },
            {
              "name": "笼形变：分数层连续角点/沉积线采样；3D碰撞待补",
              "id": "1579478470098243584",
              "status": "partial",
              "where": "src/terrain/shape.js · cage.html",
              "toggle": "smooth",
              "page": "cage.html"
            },
            {
              "name": "房屋插入地形：453帧核验，保留共享双格/整体编辑；任意轮廓重网格待补",
              "id": "1584623053061099520",
              "status": "partial",
              "where": "src/build/multicell.js · src/world/scenes.js",
              "page": "multicell.html"
            },
            {
              "name": "指定模块patch：几何复核→共享World整体体量放置/撤回；完整prefab待续",
              "id": "1751932427272909032",
              "status": "partial",
              "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js",
              "page": "patch.html"
            },
            {
              "name": "球面化：已有对偶柱群；原模块/海岸与World接入待补",
              "id": "1768627849529893109",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html"
            },
            {
              "name": "防蘑菇化：显式模块格/尺寸诊断；多格冲突仍待补",
              "id": "1769641473895432220",
              "status": "partial",
              "where": "src/sphere/planet.js · planet.html",
              "page": "planet.html"
            },
            {
              "name": "8 沿河导航：高差优先/平床河口距离，战斗及流场共用费用",
              "id": "1795831296952041691",
              "status": "partial",
              "where": "src/world/navgraph.js",
              "toggle": "nav",
              "page": "river-nav.html"
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
