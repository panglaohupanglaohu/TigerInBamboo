window.LEARN = {
  "projects": [
    [
      "badnorth",
      "Bad North 2017–19"
    ],
    [
      "townscaper",
      "Townscaper 2019–21"
    ],
    [
      "next",
      "第三项目 2021–25"
    ],
    [
      "other",
      "其他"
    ]
  ],
  "topics": [
    [
      "water",
      "水 / 岸线"
    ],
    [
      "grid",
      "网格 / 拓扑"
    ],
    [
      "light",
      "光照 / 阴影"
    ],
    [
      "terrain",
      "地形 / 岛屿"
    ],
    [
      "build",
      "建筑 / 模块"
    ],
    [
      "life",
      "植被 / 生物 / 装饰"
    ],
    [
      "texture",
      "贴图 / 风格"
    ],
    [
      "fx",
      "Bad North 玩法 / 特效"
    ],
    [
      "tools",
      "UI / 工具 / 工程"
    ],
    [
      "show",
      "展示 / 无技术说明"
    ]
  ],
  "labels": {
    "done": "重构版已实现",
    "game": "已用于 Townscaper",
    "engine": "已在 engine 实现",
    "both": "两边都用了",
    "partial": "部分实现",
    "ref": "学习参考",
    "todo": "未实现",
    "na": "与项目无关"
  },
  "items": [
    {
      "id": "839067977781768193",
      "date": "2017-03-07",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/badnorth/squad-hud.js · squad-hud.html",
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
      "id": "847717312912211970",
      "date": "2017-03-31",
      "text": "",
      "topic": "show",
      "project": "badnorth",
      "status": "ref",
      "where": "不涉及实现（角色外观分件本仓无对应模块）",
      "note": "374帧全核（4张联系表+3张原尺寸）；低多边形小人绕竖轴自转，循环切换绿方块头/蓝圆头/白尖盔/黄冠/棕尖帽/马脸共6-8套，中段头部换成绿→黄→红渐变=UV朝向检视；纯资产换装展示无机制",
      "decodedFrames": 374,
      "reviewEvidence": "artifacts/coverage/847717312912211970-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          373
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "883447205176238083",
      "date": "2017-07-07",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/badnorth/squad-footprint.js · src/badnorth/battle.js · squad-footprint.html",
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
      "id": "818857408848130048",
      "date": "2018-06-20",
      "text": "",
      "topic": "terrain",
      "project": "other",
      "status": "done",
      "where": "src/core/field-surface.js · field-surface.html",
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
      "date": "2018-06-22",
      "text": "",
      "topic": "terrain",
      "project": "other",
      "status": "done",
      "where": "src/core/field-surface.js · src/core/field-surface-c04.js · field-surface-3d.html · tests/field-surface-layered.mjs",
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
    },
    {
      "id": "827561690896162816",
      "date": "2018-06-15",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "ref",
      "where": "不涉及实现（机制已在 src/badnorth/*）",
      "note": "584帧全核（6张联系表+2张原尺寸）；Bad North 实机战斗：蓝方弓/步两队守台地，棕橙敌人沿同一条路径无限续流，接触点血迹扩大、末段清场；纯实机录像无工具界面，机制已在 badnorth/flowfield+battle+island，未改码",
      "decodedFrames": 584,
      "reviewEvidence": "artifacts/coverage/827561690896162816-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          583
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "展示片，只做实账"
      }
    },
    {
      "id": "837027901853810688",
      "date": "2018-06-18",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/life/smoke.js#tierStats · src/life/fire-coupling.js#burstPlan · src/badnorth/battle-c01.js#fireGlow · tests/fire-burst-tiers-browser.cjs",
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
      "id": "817323301357948928",
      "date": "2017-01-06",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "ref",
      "where": "不涉及实现",
      "note": "421帧全核；同一批素材的另一段：三团方阵远景缓慢推近到一队9人近景，看头盔/披风分层/头顶朝向gizmo与navmesh三角线框，全程不走不打不生成；纯资产与队形验收参考，队形缺口已在816743289500106752登记",
      "decodedFrames": 421,
      "reviewEvidence": "artifacts/coverage/817323301357948928-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          420
        ],
        "nativeRevisits": [
          0,
          80,
          160,
          240,
          320,
          420
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "816743289500106752",
      "date": "2017-01-04",
      "text": "",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/world/battle-navigation.js#move · src/badnorth/battle.js#step · src/badnorth/battle-c01.js#columnStats · index.html?scene=badnorth&c01=column",
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
      "date": "2017-01-03",
      "text": "",
      "topic": "tools",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/trajectory-fan.js（dragModel/quadMarch/quadMaxReach/solveLaunch/launchGrid） · trajectory-fan.html(#model/?model=quadratic)",
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
      "date": "2016-12-17",
      "text": "",
      "topic": "tools",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/route-preview.js · route-preview.html",
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
      "id": "807135253215199233",
      "date": "2016-12-09",
      "text": "",
      "topic": "show",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "181帧全核；红砖体素城堡成品转台，机位缓慢绕行下压，少数方块角有黄色体素角标记与水面板，全程不增不减不生长，无 UI；纯展示，与原版实现无关",
      "decodedFrames": 181,
      "reviewEvidence": "artifacts/coverage/807135253215199233-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          180
        ],
        "nativeRevisits": [
          0,
          20,
          65,
          140
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "797844857821732864",
      "date": "2016-11-13",
      "text": "",
      "topic": "build",
      "project": "townscaper",
      "status": "done",
      "where": "src/world/voxel-ghost.js（roofProps/propStats/airDepths/interiorTone）· voxel-ghost.html（?props/?grad）",
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
      "date": "2016-11-05",
      "text": "",
      "topic": "build",
      "project": "townscaper",
      "status": "done",
      "where": "src/world/voxel-ghost.js（groundPlants/plantStats + r186 的 airDepths/interiorTone）· voxel-ghost.html（#plants / ?plants=0 / plantSpots）",
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
      "date": "2016-10-08",
      "text": "",
      "topic": "terrain",
      "project": "townscaper",
      "status": "done",
      "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
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
      "id": "777501038274281472",
      "date": "2016-09-18",
      "text": "",
      "topic": "show",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "45帧全核；三栋手绘橙木屋+锯齿边草地片的慢速巡览，深灰底编辑器网格，无UI无建造动作，纯展示，与原版实现无关",
      "decodedFrames": 45,
      "reviewEvidence": "artifacts/coverage/777501038274281472-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          44
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "777596437534240768",
      "date": "2016-09-18",
      "text": "",
      "topic": "show",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "4帧全核；与 777501038274281472 同一套橙木屋场景的更近机位，0.9s 内无任何编辑动作，纯展示",
      "decodedFrames": 4,
      "reviewEvidence": "artifacts/coverage/777596437534240768-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          3
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "784847588893814785",
      "date": "2016-10-08",
      "text": "",
      "topic": "terrain",
      "project": "townscaper",
      "status": "done",
      "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
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
      "date": "2016-10-08",
      "text": "",
      "topic": "terrain",
      "project": "townscaper",
      "status": "done",
      "where": "src/sphere/planet.js · src/sphere/planet-wfc-c06.js · planet.html · planet-wfc.html",
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
      "id": "768886648625061889",
      "date": "2016-08-25",
      "text": "",
      "topic": "show",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "52帧全核；手绘小星球匀速自转（海洋+陆地+两极冰盖、独立笔触云团、fresnel 大气边光），无 UI、无系统行为，纯美术 diorama",
      "decodedFrames": 52,
      "reviewEvidence": "artifacts/coverage/768886648625061889-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          51
        ],
        "nativeRevisits": [
          20
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "781027725452648448",
      "date": "2016-09-28",
      "text": "",
      "topic": "show",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "32帧全核；14 座手绘等轴小屋（红木板墙+黄瓦+白檐+一座黑瓦谷仓）摆在灰网格地面上，只做极慢推镜/放大3%，无 UI、无建造动作，纯美术素材图集",
      "decodedFrames": 32,
      "reviewEvidence": "artifacts/coverage/781027725452648448-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          31
        ],
        "nativeRevisits": [
          0,
          30
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "806856212260278272",
      "date": "2016-12-08",
      "text": "",
      "topic": "build",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "332帧全核（4张联系表+6张原尺寸）；2016 早期演示循环：同一套体素城镇在砖红/薄荷绿/青绿三套配色间循环，中间 1s 整片拆解（块整块出现消失、顺序无规律，左下角静止鼠标指针），无 UI 无技术说明，按展示记",
      "decodedFrames": 332,
      "reviewEvidence": "artifacts/coverage/806856212260278272-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          331
        ],
        "nativeRevisits": [
          20,
          36,
          106,
          264
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "803190517534248960",
      "date": "2016-11-28",
      "text": "",
      "topic": "build",
      "project": "townscaper",
      "status": "ref",
      "where": "不涉及实现",
      "note": "19帧全核；2016-11-28 早期原型三组构图渲染（青绿墙+红瓦+石纹地面），相邻帧只是逐帧噪声近重复、两次硬切，无 UI/网格/光照对照，判纯美术展示",
      "decodedFrames": 19,
      "reviewEvidence": "artifacts/coverage/803190517534248960-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          18
        ],
        "nativeRevisits": [
          0,
          6,
          12,
          18
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1995813566344011807",
      "date": "2025-12-02",
      "text": "I'm designing a jungle gym / climbable shelf structure for the play area of our home. The sofa-like structure to the left is folding mattress you can slide under the monkey bars. If you've ever build something similar I'd be happy to take advice",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "170帧全核；室内 CAD 线稿漫游：阁楼床+攀爬架+折叠加垫的家具设计稿，无 UI 无游戏画面，与实现无关",
      "project": "other",
      "decodedFrames": 170,
      "reviewEvidence": "artifacts/coverage/1995813566344011807-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          169
        ],
        "nativeRevisits": [
          160
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1991103578011029507",
      "date": "2025-11-19",
      "text": "I think it gives a pretty good sense of a dynamic ocean without being too distractive",
      "topic": "water",
      "status": "done",
      "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
      "note": "529帧全复核：固定教堂岛，主要动态为分段白色近岸浪；不把“克制动态海洋”推断为现有整片海面颜色漂移公式。保留本地背景处理但纠正归因，新增可开关沿岸周期分段浪峰，实际双网格GPU对照通过。；【第62轮 A 类收敛】残差=完整浪形与碰撞，分段近岸浪峰机制等价且双网格 GPU 对照通过，判为 done",
      "project": "next",
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
      "id": "1991101097818403263",
      "date": "2025-11-19",
      "text": "It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset.",
      "topic": "water",
      "status": "done",
      "where": "src/water/shore.js · src/core/wave-cycle.js · src/water/foam-mask.js · ?c10=shoreclamp",
      "note": "477帧全核；低机位贴水，白浪带逐段爬岸/退浪、各段相位不同，0128起长房、0290硬切成方块测试地形仍同形；循环顶点着色器+生成时烘入 in/out/时间偏移全在 shore.js（aIn/aOut/aPeriod/aPhase/aCrest/aWidth），本轮出真View运行验收：t=0落蓝线6.5e-6、t=0.68落黄线0、退浪位移精确=aOut·cycle.y 5.6e-17、峰值0.2197、同一uTime进/退顶点58.3%/41.7%（不是齐步走，row-0 515种相位）、crest绕圈接缝0/峰11、碰撞档穿岸11.70%→0.92%；残差仅原片浪形/配色",
      "project": "next",
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
      "id": "1991099314714902634",
      "date": "2025-11-19",
      "text": "Got some pretty sweet new shore waves going",
      "topic": "water",
      "status": "done",
      "where": "src/water/shore.js（aArc + skirtCoverage/skirtBreakGLSL + DoubleSide）· src/world/view.js（共享 uTime + skirtStats）· src/world/app.js（?skirt=plain）· waves.html",
      "note": "545帧全核（sheet-00/02 复看 + f0180/f0300 原尺寸，r56 已全片逐格核过）：片内岸线白带**是分段的** —— 有浪的岸段实心白、段间水体直接贴岩脚，白块沿岸滑移且宽度来回胀缩（分段展开/聚散）。原状裙带沿全岸 100% 常亮、把浪带的分段盖住 → 本轮给裙带烘 aArc + skirtCoverage 整数谐波（3u/7u，接缝 2.33e-15、amp 呼吸 + 相位漂移），shader 按 uSkirtBreak 混回常亮；顺带修 FrontSide 背面剔除（单面 2170px vs 双面 35481px）；waves.html 补「裙带分段」「泡沫遮罩+防穿岸」两开关与读数。读数：9/12 段、缝隙 42.9%↔27.8%、GPU 分桶 32.6 vs 98.8、关档 128.6/115.8、差分 21675px、噪声 0。",
      "project": "next",
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
      "id": "1897266928961700215",
      "date": "2025-03-05",
      "text": "Yet another hallway design",
      "topic": "texture",
      "status": "done",
      "where": "src/core/doodle-hallway-layout.js · src/build/doodle-hallway.js · src/world/doodle-overlay.js · doodle-hallway.html",
      "note": "108帧全核（sheet-00/01 两页 + 3 张原尺寸）：内转角 + 圆弧 cove 弯进天花 + 分区底色板/窄竖带 + 白竖纹护墙板（顶线随楼梯斜上）+ 拱门（门扇两芯 + 扇窗放射格 + 花边带 + 门上方对称板）+ 楼梯踏步，全片只此一种房间无 UI。note 记的「完整室内/弧顶、门口版式、纹样复杂度」核实为过期账：doodle-hallway-layout.js（文件头署本片 ID）的展开面 (s,v) + 转角断板 + 门位独占一跨 + 密度/镜像全在，r56 只有 node 测试、缺浏览器验收。本轮补 tests/doodle-hallway-browser.cjs：展开贴图逐像素 7 种分区底色、墨线 12.38%、门位内墨点 0px；护墙板顶线斜率 0.3914 vs rise/(s1-s0)=0.3913、残差 0.0025m（非锯齿）、平段 0.96；逐板镜像差 0.0026（关镜像反向对照 0.6576）；?t=0 钉相机后同状态噪声 0px、彩色↔黑白 479986px；共享 World 可选贴面 248 面/1488 顶点、开关差 62318px（offset 抬到 0.012 对照 66189px）。美术差：纹样为程序化替身，非原作手绘鱼群/大狗/蝴蝶结。",
      "project": "next",
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
      "date": "2025-02-13",
      "text": "Further iterations on hallway design",
      "topic": "texture",
      "status": "done",
      "where": "src/core/doodle-hallway-layout.js · src/build/doodle-hallway.js · src/world/doodle-overlay.js · doodle-hallway.html",
      "note": "243帧全核（sheet-00/01/02 三页 + 原尺寸 0060）：与 1897 同一内转角的黑白版 —— 无底色只有墨线、纹样更密、左右镜像（拱门在左上）、窄竖带仍在、护墙板顶线在楼梯段斜上；0084–0119 贴近白门看到门框花边带/两块门芯与深灰侧壁。note 记的「完整室内/弧顶、门口版式、纹样复杂度」为过期账：同一 planHallway 的 mirror:true + density:1.35 早实现，缺浏览器验收。本轮同一支 tests/doodle-hallway-browser.cjs：彩色/黑白 plan 逐字段相同、几何同为 17700 顶点；墨线 13.48% > 彩色 12.38%，彩色底 0 种（彩色版 7 种，证明是关底色不是换灰底）；逐板镜像差 0.0026、关镜像对照 0.6576；整帧差 479986px、同状态噪声 0px。美术差：密度是同一纹样库乘子，不是原作另一套更细的图样。",
      "project": "next",
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
    },
    {
      "id": "1852334860137849222",
      "date": "2024-11-01",
      "text": "A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obvious.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · src/core/cloud-motion.js · src/life/vegetation.js · src/light/cloud-shadow.js · impostors.html",
      "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。r214 残差补全：裁判 engine/impostor.js 云风材质（uWindAmt 树0/云0.6、实例位置相位 ph=x*.13+z*.17、三轴异频 sin .11/sin .15/cos .09、幅度 y×.25/z×.6）函数化移植为 cloud-motion.js cloudWindBob+CLOUD_WIND_BOB_GLSL，CLOUD 非 HORIZON 分支接 uWindAmt；前景云层次补 uCloudParallax 视差（cd=mix(1,depth,parallax)，与 clouddeck v∝1/depth 同口径），vegetation 近云按离岛半径 nearCloudDepth 1→1.8 分层；近云换 fluffyCloudGeometry 菜花云（顶点色烘灰蓝底/暖白顶，远景阴云仍共用旧 cloudGeometry）；cloud-shadow CPU 镜像同除 cd+bob。tests/cloud-motion.mjs+cloud-wind-layers.mjs（默认0零侵入/CPU模型/球面锚点）+ cloud-wind-browser.cjs 真实GPU双网格（位移vs模型<2e-4、depth2.5视差比0.4、默认档逐位回旧、31实例深度1.202→1.744）；clouds/cloud-depth/cloud-shadow/impostor-view/leaf-shadow/cloud-receiver 回归全过；vendor 5文件逐字（impostor-c09.js首拷）。残差=原片云形/层次排布/真实风参数未公开（程序近似）。；【卡点·B 美术资产】原蓬松云形精确形状、前景云层次精确排布与原作风材质参数未公开，裁判风材质公式与视差口径已对齐移植 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
      "id": "1849732997945110651",
      "date": "2024-10-25",
      "text": "Here, the shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in blue. The waves travel from the blue line to the yellow (and back a little). There is also a global water mask texture that adds extra foam around rocks and stuff.",
      "topic": "water",
      "status": "done",
      "where": "src/water/shore.js · src/water/foam-mask.js · src/world/view-c10.js · ?c10=foammask,shoreclamp",
      "note": "437帧全核；黄线岸脚/蓝线外推平滑（6遍邻域平滑+拒绝落回陆地）/浪带蓝→黄→回弹、各段相位不同、0270起红三角线框逐段推进、岸脚碎白泡沫全见；三件缺口（全局泡沫mask·折叠消解·浪带全路径防穿岸）核实为已在 foam-mask.js/view-c10.js 且本轮出真View运行验收（穿岸 mixed 8.44%→2.23%/quad 11.70%→0.92%，泡沫带内孔洞 78.6%/80.5%，t=0蓝线9e-6·t=0.68黄线0·回弹沿aOut 2.8e-17·峰值0.2197）；折叠消解核实为原作现象不列缺；残差仅浪形/配色替身",
      "project": "next",
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
      "id": "1849730611964973481",
      "date": "2024-10-25",
      "text": "Shoreline waves! This is something I've tackled many times. Although this one is very subtle, it's my favorite thus far. Instead of trying to make the waves roll in and out inside one shader pass, I'm creating loads of overlapping waves that each go through their own cycle",
      "topic": "water",
      "status": "done",
      "where": "src/water/foam-mask.js · src/world/view-c10.js · index.html?c10=foammask,shoreclamp",
      "note": "599帧全核；泡沫mask（噪声切碎斑块，非整圈实心白边：带内21.8%覆盖、孔洞>50%、屏幕A/B 5251px）与窄湾浪带防穿岸（8.44%→2.23%，收回136顶点）补运行验收通过；残余2.2%是0.04栅格边界余量",
      "project": "next",
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
      "id": "1849427564034498642",
      "date": "2024-10-24",
      "text": "Made some octagonal impostors for these trees. Might seem like overkill for such a stylized look, but they're a lot more stable when rotating the camera than all other billboard solutions I've tried, which is kinda important.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · src/life/impostor-c09.js · impostors.html · impostor-planet-c09.html",
      "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；第55/56批已补多俯仰行+球面卡片+球面局部上方（impostor-c09.js、impostor-planet-c09.html、?fx=impostorpitch、浏览器扫掠过）。2026-11-26裁判对照：REACode engine/impostor.js仅单仰角0.32八方位柱面卡+锚定中点+球面叶alpha（townscaper-reference同款），无球面/多俯仰烘焙可移植；残差=原作卡片排布原片全程低机位不可证、配文仅「octagonal」一词，树冠/云形/星球配色程序近似 → 永久卡点，需新证据再立项。；【卡点·C 算法未公开】原作卡片排布（球面/多俯仰与否）配文未公开、画面不足以反推 → 永久卡点，需新证据再立项",
      "project": "next",
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
      "id": "1798310423554658732",
      "date": "2024-06-05",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "done",
      "where": "src/world/field-plot-map.js · src/world/view-shading.js(?shade=fieldplots) · fields.html",
      "note": "614帧全核；地块耕纹接回 View 主材质：新增 world/field-plot-map.js（partitionPlots→世界XZ浮点图：行号/田埂/地块色调/有效）+ view-shading ?shade=fieldplots（手写双线性+宽软带+田埂压暗），terrainmesh 旧逐格hash口径默认不动。读数为真 World：169×151纹素/texel0.1/可种格541/地块195/主轴最大夹角89.97°；开/关整帧18367px、噪声0；两块地(23°/113°)画面上条带方向95°vs5°(差90°)，与主轴投影偏差9.4°/6.2°；CPU孪生861点tone 0.650–1.223。新测 tests/field-plot-map.mjs + tests/field-plots-main-browser.cjs 11/11 PASS，0 console error。如实：条带对比度比片内淡（程序化世界图 vs 烘焙贴图），地块参数按片内3–8格/一屏4–6条带定，未逐帧反推原作参数；片内白色[ ]标记层未复刻。",
      "project": "next",
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
      "id": "1795831296952041691",
      "date": "2024-05-29",
      "text": "I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)",
      "topic": "terrain",
      "status": "done",
      "where": "src/world/navgraph.js · planet-rivers-c09.html?nav=auto（球面）+ river-nav.html（平面）",
      "note": "598帧全核；沿河加权导航图（河格顺流0.3/逆流0.65、高差优先、平床读carve顺序、判不出保持中性）+ findPath/stats/simplify 三接口都在，本轮补球面层运行验收：新测 tests/river-nav-sphere-browser.cjs 在 planet-rivers-c09.html?nav=auto 上量出 391/391 河格边全判顺流、0 中性 0 上坡顺流、58 条汇流支流全部汇入更便宜、主干顺流0.725<逆流1.090<沿路步行2.533、speedup 3.49、detour 0.524；平床河格352对顺逆价格比精确0.3/0.65。旧note的球面/复杂汇流/完整接口核实为过期账",
      "project": "next",
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
    },
    {
      "id": "1791049306213912823",
      "date": "2024-05-16",
      "text": "Trying out a new lighting solution. This one is just one lookup in the vertex shader of a low res cube map height map.",
      "topic": "light",
      "status": "done",
      "where": "src/core/cube-height.js · src/light/cube-height.js · planet.html",
      "note": "273帧全核（3张联系表+原尺寸0150）；6x16^2高度CubeTexture顶点单次查询(vertexLookups=1)，9方向GPU误差<0.015；开/关仅差<20/255灰度，片中沟谷近全黑的遮蔽未复现",
      "project": "next",
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
    },
    {
      "id": "1786014232594485497",
      "date": "2024-05-02",
      "text": "Mountain textures! These have been tricky. Mountains kinda need lighting and normals, but with my texture blending tech I don't think I can afford that on low-end devices",
      "topic": "light",
      "status": "done",
      "where": "src/core/mountain-bake.js · mountain-bake.html",
      "note": "234帧全核验，配文未确认斜率烘焙；本地用实际World顶点法线烘焙明度，底色/烘焙/实时法线局部GPU通过。原山体纹理atlas/笔触、原接口及低端性能未验。；【第62轮 A 类收敛】残差=原山体纹理 atlas 与笔触，法线烘焙明度机制等价且 GPU 通过，判为 done",
      "project": "next",
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
    },
    {
      "id": "1783792917183606829",
      "date": "2024-04-26",
      "text": "Texture test!",
      "topic": "texture",
      "status": "done",
      "where": "src/sphere/worldmap-shore.js · src/sphere/worldmap-material.js · planet.html?map=1&stage=maptest&shore=1",
      "note": "242帧全核验（3张联系表+原尺寸0000/0155/0220+4×裁切）；原片=深蓝底光滑贴图星球自转、近景有陆侧暗带/3道平行浪线/海湾沙滩/两色草块。核实note的【卡点·C 算法未公开】为过期账：src/sphere/worldmap-shore.js（文件头署本片ID）就是shoreDistance球面距离场+rim/wave/sand/grass2四层，worldmap.js按3D单位方向采fbm3（故极点行std 0 vs 赤道26.43、mode:'uv'反向对照极点34.72）。本轮真修1处：worldMapTexture的DataTexture缺colorSpace（r160默认线性→输出sRGB二次提亮，整颗星球发白），补SRGBColorSpace后渲染色回到作者色板。运行验收：?map=1&stage=maptest&shore=1，贴图层浪线三簇0.0213/0.0438/0.0633 rad（=1/2/3×gap，幅度24.89→12.83→4.81）、暗带深57.1级谷在0.0131<rim、沙滩只占25.9%岸线且离岸≤0.03、两色草双峰171/194；屏幕A/B同机位宽景差分128756px(陆地侧-25.5~-41.1、海侧+8.4/+3.9/+4.8)、近景272202px浪线峰5/15/26/32px、噪声0、0 error。如实口径：贴图1024×512近景约4-5屏幕像素/纹素（2048×1024烘焙2.1s未采）、沙滩覆盖25.9% vs 原片更像60%+、无卵石点。",
      "project": "next",
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
      "id": "1781405550061687016",
      "date": "2024-04-19",
      "text": "Ok this might not look like much but I've got seamless patch blending! Some of the patches are projected (like the grass and the water) and some are manually UV-mapped (like the shoreline). With some good textures and some height based blending this is gonna be great.",
      "topic": "water",
      "status": "done",
      "where": "src/terrain/patch-blend.js · src/world/view-shading.js ?shade=patchblend · patch-blend.html",
      "note": "219帧全核；投影 patch（草/水）+ 手工 UV 岸带 + 高度混合三种合成已实现并在页面与实景两层出运行验收：白点沿弧长 0.400–0.405、UV 条上白浪线 2 道、跨格边差分 p95 0.1336 vs 同格 0.1184（无 per-cell 硬缝）、jump hard 0.2543→height 0.094（alpha 0.0198）、softMeanPx 0→1.5、实景开/关 24919px 噪声 0 回位 0。本轮补岸带白浪线与圆形白点（原来一条线都没有、点是竖条），并新增 patch-blend.html（三模式 + 岸带 UV 展开条 + 近景窗）",
      "project": "next",
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
      "id": "1769691526924292506",
      "date": "2024-03-18",
      "text": "Mega river system! I've had trouble making good rivers before. Now I've sort of special cased the rivers by collapsing them depth-first to let them wiggle real far, and then the rest is collapsed breadth-first, making nice gentle slopes that only occasionally meet steep cliffs.",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/river-collapse-c09.js collapseRiversFirst/riverCollapseStats · planet-rivers-c09.html",
      "note": "194帧全核；原文三件事全落地：collapseRiversFirst 先 DFS 坍缩河道（河床高度=1+floor(DFS深度/9) 409/409 逐格成立、河格单宽 782 对 0 并排、391 条 flowTo 边 0 爬升、断流 0）、其余陆地 BFS（1298 格父链不降/断链 0/漏格 0、零局部洼地 0 不排水 0）、陡边 154/4777=3.22% 只偶尔碰崖；原 note 的完整球面 WFC/BFS 缺口核实为过期账（模块 r56 C09-B 就在、页面 planet-rivers-c09.html 早能开），真缺的是运行验收 + 河面画在河床顶面被沟壁挡成干沟 → 改画在岸高并补 tests/planet-rivers-c09-browser.cjs（?river=1 比 ?river=0 多 94278 蓝像素、0 console error）",
      "project": "next",
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
      "id": "1769641473895432220",
      "date": "2024-03-18",
      "text": "In cute tile based planets like this you often get a \"mushrooming\" issue where tall mountains get weirdly wide. I managed to mitigate this by a relax pass where all module-containing cells try to achieve their desired shape and size. Note the cells on the top left contracting.",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · src/sphere/module-group-fit.js · planet.html",
      "note": "479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐轮保最优，最差边绝不差于相似解），edgeTol 超阈值回退分格拟合+逐边诊断 moduleGroupReport；moduleGroups 把声明模块切成独立联合单元。r213 补「多格冲突仍待补」：裁判库核对——REACode engine/relax.js 无模块组语义、spheretown 列本片 relax 为 Not done、多格 tile 为 todo，无原作多格冲突语义可对齐 → 按本仓 build/multicell.js 拒绝码实现 moduleConflictReport（求解前静态诊断：invalid-cell/duplicate-cell/overlap/disconnected/unresolvable=拒绝级，sea/uneven-support/assembly-cut=诊断级，装配 order 里不连续足迹记 assembly-cut）+resolveModuleGroups 确定性消解（剪非法/重复/重叠→连通切分→角距仍超 farLimit 丢弃并逐条记账，不伪造可行解）+cornerPositions moduleCheck 拒绝入口（枚举全部拒绝原因一次抛出）；unresolvable 与求解器同界（海平面足迹角距>1.2rad≈69°→逐层必 unresolved）。tests/module-group-fit.mjs 7/7（4 格足迹各层最差边 0.0001–0.133 vs 分格 0.08–0.405，全局 moduleSizeReport 0.399 < spring 0.535，曲率扫描/确定性/拓扑接缝校验）+ module-group-conflict.mjs 9/9（冲突全枚举/unresolvable 边界/消解确定性/moduleCheck 拒绝）+ sphere 套件回归过。；【卡点·C 物理冲突+B 资产】尺寸与墙倾斜的冲突使宽高原蘑菇化有下界（far 越大上限越紧，>69° 组角距记 unresolved 不收）、原模块目标形状在 REACode 无出处（海平面足迹=推断）、vendor 两文件已逐字拷入、r214 浏览器验收过（planet.html?solver=joint 实测：disagreeMean 0.0111≈shape 0.0075≪spring 0.0953、0 翻折、unresolved=6 与 moduleConflictReport 诊断一致，tests/sphere-joint-solver-browser.cjs）/游戏运行时接入属换批；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
      "project": "next",
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
      "id": "1768627849529893109",
      "date": "2024-03-15",
      "text": "For reasons I will not be explaining at this point I've gone and put this on a sphere",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · src/sphere/world-sphere.js · src/sphere/sphere-world.js · planet.html · sphere-world.html · sphere-shore.html",
      "note": "229帧全核验；r205 补「平面World→球面」接线层 src/sphere/world-sphere.js：'bend' 模式与实景十二门徒 bendU/uBend=S/(2Rw)/帽面法线/锚点 frame 逐式同口径（抛物面下弯），'sphere' 方位等距严格上球（|p|=R、径向保距、往返一致）；柱格姿态=位置+径向up+测地平行搬运基+切平面 yaw，邻接格共享角点映射逐位相同（接缝闭合）；岸线=traceShoreLoops 平面黄线贴球→按角距细分→球面 Taubin 平滑→沿搬运法线测地外推蓝线，闭环相邻角距受控。r209 补球面 World 网格生成/编辑/保存恢复 src/sphere/sphere-world.js：sphereGrid 由 patch+网格参数产出真 cell 拓扑（grid.js 共享角点+edgeNeighbors/edgeTwins，非姿态摆放）附 pts3/pose，quad/square/hex/mixed 四类全落球接缝闭合；spherePick→sphereApply 把球面 3D 点翻译成落格编辑（build/erase/raise/dig/level/paint 与平面 applyAt 同语义）；encode/decodeSphereWorld 与 save.js 同风格位流+游程+版本/mode/网格参数/patch 指纹校验。tests/sphere-world.mjs 5/5 + world-sphere 等 sphere/planet 套件回归 PASS。浏览器验收（sphere-world.html + tests/sphere-world-browser.cjs，真实 GPU/three r160 + 本机 Chrome swiftshader）：634 格渲染成 1268 三角面片（非有限顶点 0、2536 角点引用全在 R=60 上）；sphereEdit 14 次贴内 build/erase/paint/raise/level 全 changed、贴片外拾取无操作，前后帧逐像素差 30381px/maxΔ167；encode→decode 进同规格 World 体素四数组逐位相等、再编码逐字相等、换渲染恢复出的世界逐像素一致 diff 0；接缝 2452 条内部半边 twin 角点 3D 距离全 0，weld 对账 2532/2536 角点引用被≥2格共享（边界 4 个单格角点除外），最多 6 格共点，接缝特写无裂缝。r211 vendor 拷贝+海岸线浏览器验收：src/sphere 全 13 文件+依赖闭包 core/trigraph.js 逐字进 TigerMessenger/src/vendor/townscaper-rea-refactoring/src/（sphere 只依赖 World/MAX_LEVEL 与常规体素接口，core/world.js 保护文件未动、splicedHouses/houseInstances 快照字段保持旧口径；cmp 逐字一致、node --check 全过、TigerMessenger --test 463/463 绿）。球面平滑海岸线浏览器验收（sphere-shore.html + tests/sphere-shore-browser.cjs，8769 静态服+本机 Chrome+playwright）：fbm 确定性水陆世界 634 格（陆136/岩56/水498，主岛+内湖+小屿）→ worldShorelines(spacing0.18/maxStep0.05/smooth6/reach0.4) 得 3 条闭环 188+42+45=275 点；断点 0、非有限点 0、最大步角 0.0031≤0.05、径向偏差≤2.2e-14、法线与径向|dot|≤8.4e-17、蓝线测地外推 0.4 同半径；跨接缝 84 个岸角 343 份角点引用逐位一致（缝0/错0）；同 World 重抽与 spec 重建再抽逐字相等；岸线叠加像素差 5041px；vendor 拷贝 ?src=vendor（8931 服）同数通过。残差：游戏运行时接入（vendor 文件就位、运行时改调未做，属换批）。；【卡点·B 美术资产】原片模块形状/海岸美术细节未知，程序近似与美术差分列；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
      "project": "next",
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
      "id": "1765115069837221962",
      "date": "2024-03-05",
      "text": "Here, I'm visualizing the recursive tree parsing as it adds new rects. Note that when the board is more fragmented the arm tends to have more fingers.",
      "topic": "life",
      "status": "done",
      "where": "src/core/atlas.js allocate/allocateAt/recursiveFill + src/core/atlas-c09.js armFromTrace/placeBottomLeft/treeLayers · atlas-tree-c09.html",
      "note": "247帧全核；臂=真实碰撞查询的树解析（150步逐步断言 手指==trace里free+used叶数、pruned==outside数、parent下标递增、段全轴对齐且落在板内，最深reach 31层）；「板子越碎手指越多」实测早20次1.00手/11.5空闲叶/12.75候选 → 末20次2.40手/32.75空闲叶/379.2候选；跨叶放置71/150槽吃掉≥2片叶（最多6片，逐槽面积精确、全部标used、旧槽零移动）；2D手臂+3D展开两态都出图（243节点/27层/根在最上），arm=0 青色像素1286→0 且同一块板；旧note的「原3D树/跨叶候选待补」核实为过期账（第34次同型，allocateAt+treeLayers/project3D 都在跑）；新测 tests/atlas-tree-arm-browser.cjs",
      "project": "next",
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
      "id": "1765041830461055127",
      "date": "2024-03-05",
      "text": "Now supports removing rects too! The bin space gets quite fragmented after a while though.. I've tried to optimize it on the fly but I can't figure out how to when it get sort of interlocked. Still packs tight though!",
      "topic": "tools",
      "status": "done",
      "where": "src/core/atlas.js free/remove/repack/grow/report · atlas-tree-c09.html?remove=1",
      "note": "558帧全核；删除真生效（60步里删25/加35，freeLeaves 33→64、≤16×16小孔1→24；再纯删30块→freeLeaves 118、小孔45、最大空闲块仅占空闲面积2.33%、画面空白占比0.382→0.425），碎了仍装得紧（再加40块40/40全进、占用53.8%→71.4%）；只在两子全空时向上合并（64×64 2→2→1、非兄弟连锁3→3→2→1、freeArea 4096）；重复/伪造/跨实例释放全拒且存活块逐字不动；旧note的「跨叶放置及完整RectBin接口仍缺」核实为过期账（第35次同型，allocateAt + place/repack/grow/shelfPack 都在）；原片0216–0355的近侧视角=按深度叠起的树，页面有对应3D展开；新测 tests/atlas-remove-frag-browser.cjs",
      "project": "next",
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
      "id": "1764958522398146667",
      "date": "2024-03-05",
      "text": "A cute binary tree rect packer. Generating the placement attempts is kinda brute force (to get into all the nooks and crannies), but then it's using the tree properly for fast collision checks. I think this is the first time I've actually written a proper space partion tree. Fun.",
      "topic": "life",
      "status": "done",
      "where": "src/core/atlas.js + src/core/atlas-c09.js + src/core/rectbin-c08.js · atlas-tree-c09.html?view=3d",
      "note": "296帧全核；暴力候选(底-左)+树剪枝碰撞/跨叶分配/兄弟合并、3D分层树(每深度一层,根最上,白树枝只连相邻层)、近俯视梳齿三段镜头全在(atlas.js+atlas-c09.js+rectbin-c08.js);本轮把2D段叶框从看不见的深色改浅色对齐片0030;新测atlas-tree-phases-browser.cjs 三段逐像素PASS(浅线5898px/跨度243.3→69.4=0.285/彩块保留80.9%/噪声0)",
      "project": "next",
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
      "id": "1758251637280268481",
      "date": "2024-02-15",
      "text": "It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe than the basic flipped mesh approach in Bad North and Townscaper",
      "topic": "water",
      "status": "done",
      "where": "src/water/watervol.js · src/water/land-distance.js",
      "note": "213帧全核验：小岛镜头降到水面，线框/倒影随角度变化；原文说叠平面采SDF，未说明维度。保留本地浅水近似，补各向异性精确2D中心距离、level1遮罩、版本缓存/空场清理/共享资源释放，实际双网格通过；不同于原片完整反射效果。；【第62轮 A 类收敛】残差=原片完整反射观感，SDF 叠平面+各向异性中心距离机制已落地并双网格通过，判为 done",
      "project": "next",
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
      "toggle": "watervol",
      "page": "index.html?scene=town&on=watervol"
    },
    {
      "id": "1758250248483278925",
      "date": "2024-02-15",
      "text": "New water reflection I'm quite happy with",
      "topic": "water",
      "status": "done",
      "where": "src/water/planar-reflection.js · src/world/view.js · index.html?scene=terrain",
      "note": "516帧全核；RTT平面反射落地（镜像相机+斜近平面+水面屏幕空间UV，uReflTint=0.45 做中间色），倒影层5902px/镜像命中69.9%/真水面98.8%/水线泄漏0/噪声0；旧镜像双网格改为常隐且修好无cloud uniform时shader编译失败",
      "project": "next",
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
      }
    },
    {
      "id": "1751945034851570056",
      "date": "2024-01-29",
      "text": "Some nice new highlights when the island is backlit. Achieved by simply adding another inverted mesh outline layer that shows up when looking into the sun. And masked by shadows, of course.",
      "topic": "light",
      "status": "done",
      "where": "src/world/outline.js · index.html?scene=fusion",
      "note": "282帧全核；rim=第二层反向外壳，仅太阳在岛后时出现在剪影迎光侧；修掉 into 用相机俯仰向量导致恒 0 的 bug，改按水平方位门控（四档实测 0/0/1988/3376 px）；缺真 shadow map 遮罩",
      "project": "next",
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
      "id": "1751932427272909032",
      "date": "2024-01-29",
      "text": "I can now force specific modules to appear. To do this I first generate the specific bit of grid they need. A large module like this would be highly unlikely to appear by chance on a random grid.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js · src/build/module-patch-commit.js",
      "note": "复用552帧；显式patch/搜索/几何复核、共享World原子体量放置/撤回、多格prefab+socket+联合WFC、3D prefab强制出现此前各批已落；本批补 module-patch-commit.js 事务层：splice/fit 打补丁 → 边缘socket逐条收集 → solveWithPrefab周围补网并独立复核 → 体量原子写入 → 新旧列逐格对比出「形变碰撞」可走面/阻挡清单 → 失败全回滚（splice弃新World/fit暂存列），撤回还旧World或就地restore。两种网格、支撑/碰撞失败保留原World、相邻模块接口复核均过单测。游戏侧消费者未接（building层走的是高度场joint-wfc），共享网格patch仅REACodeRefactoring演示页可接。",
      "project": "next",
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
      "id": "1727324352264474664",
      "date": "2023-11-22",
      "text": "Yeah that actually looks pretty good. I did not expect that.",
      "topic": "show",
      "status": "partial",
      "where": "src/core/camera-motion.js（whipSmear/velocityField/sharpness/smearAudit）· src/world/view.js（轮廓加权方向历史拖尾）· tests/whip-smear.mjs · whip-smear-browser.cjs",
      "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。r220 残差核销——速度场 velocityField+CPU审计 smearField/sharpness/smearAudit 逐式移植裁判 REACode smear.js；轮廓拖抹近似=whipSmear 轮廓加权方向性历史拖尾（沿内容速度场4-tap streak、alpha·(.45+.55·e)轮廓掩码，CPU+WHIP_SMEAR_GLSL孪生接view#smear，smearTex改双线性），GPU==CPU两组64²全图对拍maxDiff=0、水平边只沿y拉宽≈pan、∥轮廓恒等、轮廓像素混比>边外；实景轮廓带/平区差分18.9/8.2、∝r、0.5/1/2×|shift|单调、停转恒等、开关alpha=0；tests/whip-smear.mjs+whip-smear-browser.cjs，camera-wall-browser回归PASS。剩余残差=原片精确轮廓算法未公开（卡点·C，永久）。；【卡点·C 算法未公开】结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      }
    },
    {
      "id": "1727315611959865407",
      "date": "2023-11-22",
      "text": "I've shipped two whole games with orbital cameras and not once have I previously though about adding motion blur smear. What a fool I am.",
      "topic": "light",
      "status": "done",
      "where": "src/world/view-post-extras.js（?fx=smear · orbitSmearAt · screenOmegaDt）· src/core/camera-motion.js · index.html?fx=smear&spin=",
      "note": "337帧全核；环绕相机的解析切向拖影（?fx=smear，单帧6次三角权重采样、v=ω×(p−c)·dt、∝半径、无历史叠加）运行验收通过，并修掉二次色调映射（omegaDt=0 时整屏亮度 130.14→143.75）；stats 补 screenOmega/shutter/taps/maxPx 全指标；原片是否同快门/maxPx 上限不可反推（不计缺口）",
      "project": "next",
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
      }
    },
    {
      "id": "1724449858369568780",
      "date": "2023-11-14",
      "text": "Ok, here's a small example. The button toggles a ScriptableObject bool. The FloatSelectNode component listens to that ScriptableObject, and then a series of node-like components end up moving a piece of UI",
      "topic": "tools",
      "status": "done",
      "where": "src/core/node-graph-editor.js · src/ui/node-graph-editor.js · node-editor.html（对照 node-graph.html）",
      "note": "134帧全核（sheet-00/01 两页）；缺口清空——可拖拽节点编辑器（node-editor.html + src/core/node-graph-editor.js + src/ui/node-graph-editor.js）此前只验过序列化与只读连线图，本轮补出真鼠标运行验收：拖 compose (480,240)→(520,300) 且过程跟手、undo/redo 回位；点连线 6→5、拖 compose:out→sink:in 接回 6 边；bool→number 被拒且快照逐字节不变；speed 20→40 后 tick(0.25) 走 10、tick(100) 停在 -33.8；导出/载入含布局回放；7 节点 6 边 13 端口，页面 0 console 错误",
      "project": "next",
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
      "id": "1714613599035863191",
      "date": "2023-10-18",
      "text": "Another strange texturing style. This time trying to look a bit like abstract fields. A nice thing is they show the game tiles quite clearly. In the end I probably want a mix where some areas are more man made and others more natural.",
      "topic": "build",
      "status": "done",
      "where": "src/terrain/field-pattern.js · fields.html",
      "note": "620帧全核；田纹三档补齐（新增 uFields=3 宽软带）+ 剪影改整场景 overrideMaterial（含树/灌丛/瀑布，全黑）+ 页面裸顶面模式；原片三条形制差（软边带宽、占空比1:1、裸顶面）均已可量",
      "project": "next",
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
      },
      "page": "fields.html",
      "toggle": "fields"
    },
    {
      "id": "1712088611934371876",
      "date": "2023-10-11",
      "text": "Another take on a palette authoring tool",
      "topic": "texture",
      "status": "done",
      "where": "palette-editor.html #pg · src/core/palette-graph.js · src/core/okhsl.js · src/core/oklab.js · src/world/ground-palette-map.js",
      "note": "624帧全核；节点式调色图机制全在（7节点/1矩形/1三角/1色带/144离散面片、RGB·LAB(OkLab)·HSL(OkHsl)三档滑条、真鼠标拖点 dx0.4033、右键 New node/gradient/triangle、面片空间 OkHsl/OkLab/Srgb 三档中点色互异、导出导入往返 156/156 无损、#pgApply 后 gpm.facetsUsed 104）；本轮修三处真形制差：画布被 flex 拉到 1213×1434 致面片发虚且命中偏移 2.76×→定 440×520、色带条由 1px 拉伸改 12 段带缝、导出补浮点 rgb 使往返不丢精度；全材质接入按片中未拍到不记缺口",
      "project": "next",
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
      "id": "1710031224838771027",
      "date": "2023-10-05",
      "text": "Ok here's a probably horrible way to author color volumes. The idea is to properly define the whole color possibility space for each feature",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/color-volume.js · src/world/view.js · color-lab.html · tests/color-volume-features-browser.cjs",
      "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面。三特征各接独立HSL域（setFeatureColorVolumes + featVolumeSample 按 vField.z 分桶，未给的特征保持基色）；steps 离散采样吸附 i/(steps-1) 格点（对齐原版 strip(12)，CPU+GLSL cvQuant 同式）；原版完整接口补齐（sampleCornerVolumeSpace/css/dE/oklabToRgb/colorVolumeTerrain/opts透传）。tests/color-volume-features.mjs 全过。浏览器实景验收过：fusion页真GPU mode-3编译在位、三特征分桶零串色（掩膜35076/22670/33759px，越界0/串桶0，默认发货态同验）、steps=4/12掩膜内唯一色2614→35→221、同参重渲与跨重载逐像素一致；【卡点·B 原作工具不可复现】Unity编辑面板交互（五特征域拖点）本仓不可运行，仅输出侧GPU验收",
      "project": "next",
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
      "id": "1708815475801505819",
      "date": "2023-10-02",
      "text": "a cool cliff I came across",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/mesa-field.js · src/terrain/rockforms-c09.js · src/terrain/features.js · src/terrain/shape.js · src/core/deformation-guard.js",
      "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。；r216 残差核销——可观察行为拆五件：斜脊/悬空岩桥拱洞/圆岩柱群/苔只长朝上平顶/柱顶与岛面小屋。斜脊由 r56 rockforms-c09.js 工程近似承担（leaningRidge 胶囊+softTops 连续斜面、bridge 只写顶2层留洞、c09-terrain-b 双网格过）；其余四件裁判库有对应机制：engine/mesa.js 逐式移植 src/terrain/mesa-field.js（grid+Town 外置、同式同序同 rng 消费），tests/mesa-referee.mjs 4/4——3 种子×6846 格×12 层体素+颜色+屋位与裁判 0 差异对拍、确定性重建逐位、拱下空洞 7 格、苔格全在平顶、屋距≥1.9·hexSize、共享 World+buildQuadGrid 语义验收过；灌木 P90/splitCells 属 1707497006640365880 已于 r105 核销（同机位 P90/apothem 0.154 vs 0.138 本仓偏厚未改常数、splitCells 过期名词 triC 扇+edgeTri 线框核对在位），本轮复核不再改；vendor 逐字拷入 mesa-field.js+rockforms-c09.js（import 闭包自足）。；【卡点·C 算法未公开+B 美术资产】原作斜脊生成算法未公开（配文仅\"a cool cliff I came across\"，裁判 mesa 与 rockforms 均是近似不能认证为原作）+原美术资产/整体视觉不可得 → 需新证据再立项",
      "project": "next",
      "page": "overhang.html",
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
      "id": "1707497006640365880",
      "date": "2023-09-28",
      "text": "And here's a couple more being generated",
      "topic": "show",
      "status": "done",
      "where": "src/terrain/shrub-band.js · src/terrain/terrainmesh.js:236 · src/core/meshwriter.js:216 · terrain 场景 640×640 同机位（tests/shrub-band-scale-browser.cjs）",
      "note": "600帧全核（sheet-00…05 本轮 6/6 全看）；逐三角带宽机制在位；同机位标定与 1707490932017279035 同源（本仓 P90/apothem 0.154 vs 原片 0.138，差 11% 且本仓偏厚）→ SHRUB_BAND.max 维持 1.36 不改；splitCells 为过期名词（全仓零命中），真实 triC 扇 + edgeTri 已用线框截图核对，带子外沿落在外圈顶点",
      "project": "next",
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
      }
    },
    {
      "id": "1707490932017279035",
      "date": "2023-09-28",
      "text": "They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are.",
      "topic": "light",
      "status": "done",
      "where": "src/terrain/shrub-band.js · src/terrain/shrub-texture.js:41 · terrain 场景 640×640 同机位（tests/shrub-band-scale-browser.cjs）",
      "note": "257帧全核（sheet-00/01/02 本轮重看 + frame-0150 6× 裁切）；逐三角带宽机制在位；同机位标定完成：本仓 apothem 130.09px 下 P90 20px / 原片 frame-0150 apothem≈130px 下 P90 18px，比值 0.154 vs 0.138（差 11%、本仓偏厚），SHRUB_BAND.max 维持 1.36；splitCells 全仓零命中（过期名词），真实三角化已用线框核过",
      "project": "next",
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
      }
    },
    {
      "id": "1707490274425884929",
      "date": "2023-09-28",
      "text": "I added back the lil' shrubbery at the edges of things for like the 3rd time",
      "topic": "life",
      "status": "done",
      "where": "src/core/edge-inset.js · src/life/vegetation.js",
      "note": "342帧全核验。保留既有球团近似；修复形变后仍用旧格心判内侧，改按实际多边形绕序/下一边界限幅。双网格实际556/564锚点通过平移形变、恢复及World不变验收；只保证锚点不保证球团体积。；【第62轮 A 类收敛】残差=球团体量（只保证锚点），形变后绕序判定修复且双网格 556/564 通过，判为 done",
      "project": "next",
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
      }
    },
    {
      "id": "1705195380457996629",
      "date": "2023-09-22",
      "text": "I tamed the texture based surface shadows a bit, so the shadow casting height is independent of the z test height. Now I only get shadows over grass-cliff edges and under roofs. It has some artifacts across UV borders, but it's quite subtle so I might not actually have to fix it.",
      "topic": "light",
      "status": "done",
      "where": "src/light/surface-shadow.js · surface-shadows.html",
      "note": "300帧全核；原文「投射高度独立于 z 测试高度 → 只剩草崖边与屋檐」在真 World 上量到：门槛0 覆盖 14.28% → 门槛.6 覆盖 5.46%、崖缘份额 99.8%、别处 1px、同状态 GPU 噪声 0；洞内第二张图 143px。页面补瓦檐抬升/接收面/落点统计，提示语去过期句。如实：地形场景无建筑顶面（檐下 0.0%，屋檐由 surface-shadow-casters 夹具断言）；纹理浮凸与 UV 接缝不覆盖。",
      "project": "next",
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
      }
    },
    {
      "id": "1704246032626762189",
      "date": "2023-09-19",
      "text": "Ok, I think maybe this is a bit of a sweet spot. It's got a nice variable density texture to it. There are some height segmentation lines to help with readability, but they don't feel too synthetic.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
      "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材",
      "project": "next",
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
      "id": "1704218784028905984",
      "date": "2023-09-19",
      "text": "I tried some texture based shadows. Note the shadows on the grass and along the roof edges. Looks kinda cool, but feels a bit too 3D for what I'm going for this time. I feel like it clashes with lines, and I like lines more.",
      "topic": "light",
      "status": "done",
      "where": "src/light/surface-shadow.js · surface-shadows.html",
      "note": "335帧全核；本条是同一机制的上一档（门槛≈0 的「太 3D」版）：真 World 门槛0 覆盖 14.28%/12.65%，调好后 5.46% 且崖缘份额 99.8%、别处 1px，GPU A/B 12325/8325px 同状态噪声 0。页面入口与本条共用一处改动（瓦檐抬升/接收面/落点统计）。如实：影软边比片内窄（美术差），阴影只铺朝上顶面、不上岩壁立面。",
      "project": "next",
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
      }
    },
    {
      "id": "1703750394164199473",
      "date": "2023-09-18",
      "text": "Looking at my procedural stylized ground texturing again. Really like the swirly blobbyness of these. They feel kind of damp for some reason.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/terrain/blotch-atlas.js · src/world/view.js · src/world/view-shading.js · blotches.html",
      "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证。2026-11-24 裁判对照（REACode engine/blotch.js BODY 逐式提取）：旧噪声路径 mode1 配色/机制全量对齐——改返 vec3 tint（橄榄.86,1.02,.74/锈红1.16,.88,.70）、cold.44/.60·warm.55/.70·edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66)低频.22旋涡后尺度)、细颗粒 step(.80)·w·.22·fwidth淡出（p*12=裁判B通道12×基频）、角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，与 blotchWobble 逐位一致）；edge压暗乘含强度wgt保零强度=关闭契约（裁判 topW 不含 amt 属特例）。图集路径补裁判 BODY 末项细颗粒（CPU blotchRimTint+BLOTCH_RIM_GLSL 同式）。高度分段线=裁判崖面式 y*1.8·强度.12（uBlotchRimSeg，图集路径逐式在库；旧路径仍走共享层理着色）。反射一致性：两路仅乘 diffuseColor（color_fragment 注入、光照前、无高光/粗糙度/环境项），与裁判 MeshStandardMaterial 只改 albedo 同构。跨崖一致性：图集路径共享World rim场 顶面边前停→bleed内受控渗→等深归零；旧路径 vUp>.8 顶面闸门边界一致。tests/blotch-judge-style.mjs：238 共边点双侧逐位一致、JS镜像橄榄混合±.02、颗粒正/负/淡出、strength0恒等、uniform=3纯函数全过；GPU blotch-style-browser 双网格 swirl 8432/7809px density 5083/4884px 零强度0 5非法拒绝、blotch-atlas-rim-browser PASS。残差：原作本人图集文件与细卷边手绘细节未公开（卡点·B）；本地 fbm 场替裁判图集通道为程序近似。；【卡点·B 美术资产】原作 atlas/细卷边为原片未公开美术资产，程序化只能近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材",
      "project": "next",
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
      "id": "1699146321318314094",
      "date": "2023-09-05",
      "text": "Oh! And now I finally figured out how to make non-straight sedimentary lines! Most of the texturing math is kinda linear, so I though the lines had to be linear too. But I could (obviously) just make the whole world wobbly, do the texturing math, then simply undo the wobble.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。2026-11-24 剪切场尺度按裁判实测标定：幅度±0.12wu=±0.65层距（裁判uSedAmp.24×[-.5,.5]）、主波长≈1.9wu（裁判uSedFreq.52，原系数λ6–26wu过缓约4倍）。2026-11-26 残差收口——裁判场可逐式移植，已换：sediment.js/SEDIMENT_GLSL 的 sHash/sNoise/sWobble/sWarp 四函数体与裁判 engine/surface.js 逐字一致（测试提取裁判文件比对），JS↔裁判转写 4096 同点采样 maxΔ=0；位移含 xz 分量 vec3(b,a,b*.7)·uSedAmp，弯层模式裂纹/砂砾同吃歪过的 sed.xz（与裁判 sed=wp+sWarp(wp) 同构）；uSedAmp/uSedFreq 同款 uniform 接 view.js（uSedAmp=本地峰值×2）。可逆性：位移只依赖(x,z) → 逆问题二维定点迭代（雅可比实测≈0.19<1，裁判 wobbletex.js 量具同款做法），unwarpSediment 收敛至1e-15停、10000点往返残差3.55e-15≤1e-9阈值；解析逆不存在已如实记。双网格GPU重过：wobblePixels 5596/5209、三角剖分缝0、几何/World无漂移。残差=原作真实场未知（裁判场本身是重构近似，移植裁判≠原作）、vendor地形网格未接SEDIMENT_GLSL（B批待换）。；【卡点·C 算法未公开】裁判可提取的场形与xz分量已全部移植并逐字/数值校验；剩原作真实位移场 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
      "page": "sediment.html",
      "toggle": "strata",
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
      "id": "1699038611125985317",
      "date": "2023-09-05",
      "text": "Looking att sedimentation lines again. Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/sediment.js · src/core/sediment-bands-c09.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。2026-11-24 裁判对照（REACode engine/surface.js 逐式提取）：槽距校准=1/5.4wu（BAND_SLOTS 5→2.7）、奇偶两色±0.08、每第3条主层理、裂纹与砂砾点移植、弯层幅度±0.12wu·主波长~1.9wu、线深.54同款；反射=裁判无沉积专用高光项（沉积只改albedo）、阴影一致性走标准光照，结构对齐；带宽变异系数0.293→0.371过阈；裁判/候选同俯仰截图对照（不同地形，非逐像素）。残差：四岩性配色幅度超裁判两色±0.08（C09帧近似）、抖动场xz分量、海拔色偏未移植（裁判为全局层）、原作真实场/调色板未知、vendor地形网格未接SEDIMENT_GLSL（B批待换）。2026-11-24「原作外观/反射」残差终判：复核裁判 engine/surface.js 全文件——反射无沉积专用高光/环境反射项（MeshStandardMaterial roughness .92 / metalness 0，沉积只改 diffuseColor，光照在其后统一算；本地 view.js 材质参数同款、color_fragment 注入同构），无可移植反射公式；裁判可提取项已全部移植并 GPU 验收。剩余残差均不可执行：原作真实场/调色板/岩性配色幅度=原片未公开资产（卡点·B）；海拔色偏=裁判全局层，归 surface/patch 线（1781405550061687016 已 done）非本条目；抖动 xz 分量=姊妹条目 1699146321318314094 残差，y-only 为可精确逆设计选择；vendor 接 SEDIMENT_GLSL=B 批换库。→ 无可执行残差（永久卡点，需新证据再立项）。；【卡点·B 美术资产】原作真实场/调色板与海拔色偏未移植，四岩性配色为程序近似 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
      "project": "next",
      "page": "sediment.html",
      "toggle": "strata",
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
    },
    {
      "id": "1696896119794479541",
      "date": "2023-08-30",
      "text": "On the other hand, I've always wanted to make a game in the Art Nouveau style. This might be a good fit. Look how neat and controlled the grass blotches bleed over the cliff edges.",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/blotch-atlas.js · src/terrain/blotch-tongue-c09.js · src/world/view-shading.js · blotches.html",
      "note": "550帧复看（6张联系表+r172复看sheet-03崖肩近景）：顶面图集笔触；崖肩外缘一条窄深描边、色只垂到浅段齐平收住、深部崖壁干净。旧note「rim距离场/受控跨崖采样未迁移」=过期账；r170「等深带读不出」的真因本轮查明并修掉——BLOTCH_RIM_GLSL 缺 bleed>0 闸门，smoothstep(0,0,·) 退化成除零区间（GPU钳1）→ bleed=0 等于无限深、与 bleed=20 逐像素相同。补 step(1e-4,uBlotchRimQ.x)，blotch-atlas.mjs 加 GLSL 断言防回归；夹具两处坐标口径错（readPixels 第0行在下、NDC y=+1 在顶部）与探针落点（0.85台地内侧→扫到 rimDist 0 的崖肩线）一并修正。读数：bleed=0 全深归零；.14 等深带 0.10 世界米（CPU 0.125，.18 以下 drop<0.015）、.30 → 0.20（2.0×）；逐态 uniform 回读 0/0.14/0.30 全对；主场景 0→.14 2110px、0→20 68780px、strength0 3301px、噪声 0；近景 1430/7748px 噪声 0；顶面着色 10.0%、scale .09→.045 边界 6→0、舌头 26728px。",
      "project": "next",
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
      }
    },
    {
      "id": "1696864977171189980",
      "date": "2023-08-30",
      "text": "I'm slowly emerging from a huge refactoring... While this here is not exactly the look I'm going for, it's showing off a big improvement to the texturing. I'm now able to draw with much bigger blotches without the blotches bleeding across and messing up important edges.",
      "topic": "texture",
      "status": "done",
      "where": "src/terrain/blotch-atlas.js · src/terrain/blotch-tongue-c09.js · src/world/view-shading.js · blotches.html",
      "note": "502帧复看（6张联系表+r172复看sheet-04）：0284–0287 四帧纯黑=换版本黑场；顶面米黄/淡绿大斑更大更少、到崖肩整齐停住、崖壁纯米白不漫过。与A片同一条流水线与同一处修复：BLOTCH_RIM_GLSL 补 bleed>0 闸门（smoothstep(0,0,·) 除零退化→bleed=0 等于无限深，也解释了 bleed0≡bleed20）；夹具坐标口径（readPixels 第0行在下、NDC y=+1 在顶部）与探针落点（0.85→rimDist 0 崖肩线）修正。读数：?scale .09→.045 扫描线色块边界 6→0、顶面着色 10.0%、bleed=0 全深归零、.14 带宽 0.10 世界米（.18 以下干净）、.30 → 0.20（2.0×）、主场景图集关/开 3444px、0→.14 2110px / 0→20 68780px / strength0 3301px、噪声 0。",
      "project": "next",
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
      }
    },
    {
      "id": "1677242779162877952",
      "date": "2023-07-07",
      "text": "I am (once again) rewriting my generic triangle graph system to (hopefully) be more robust and generic. Here's a stress test where I'm adding random verts, making sure the graph stays mainifold and delauney-ish along the way.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/trigraph.js · src/core/trigraph-edit-c08.js · trigraph-c08.html",
      "note": "279帧全核（3张联系表+原尺寸0250/0278）；增量插点压力测试已完整：trigraph.js 的 add/flip/legalize/check(Infinity) 加 trigraph-edit-c08.js 局部编辑（addTracked 边差分 / removeVertex 星形环耳切+Lawson / moveVertex 失败回滚 / checkLive），note 里挂了多轮的「局部编辑接口待补」核实为过期；页面 trigraph-c08.html 补运行验收 tests/trigraph-c08-browser.cjs（200步 verts200/tris385/染色边33、全查401面 流形✓ Delaunay✓ 退化0；删5点 tris375 仍✓；移5点 活跃195 仍✓；0 console error），截图 trigraph-c08-insert/-delete.png 已 ViewImage 核过。口径仍成立：浮点容差诊断不等于精确谓词，画面不证严格 Delaunay。",
      "project": "next",
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
      "id": "1671840905957978113",
      "date": "2023-06-22",
      "text": "Hmm.. I thought it was gonna be too wacky but maybe it's kinda cool",
      "topic": "show",
      "status": "done",
      "where": "src/core/terrain-burial.js · terrain-stages.html",
      "note": "246帧全核；抬地面吞建筑的规则之外补齐了剩余两条缺口：崖面墙裙残留（cliffSkirt：台账×只剩屋顶×崖面，ground-0.34 内缩 0.08）与悬檐联动（每面配一个 ground..ground+0.45、再缩进 0.17 的檐下暗带，bands 与 notches 一一对应）；页面 #bury 按深度顺序画墙裙+暗带并暴露 skirt()；无剩余缺口",
      "project": "next",
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
      "id": "1671808851895627776",
      "date": "2023-06-22",
      "text": "If your terrain generator supports overhangs you gotta flaunt it. I don't make the rules, but I do follow them.",
      "topic": "terrain",
      "status": "done",
      "where": "src/core/rock-topology.js · src/terrain/terrainmesh.js · src/terrain/shape.js · src/terrain/terrain-collide.js · overhang.html",
      "note": "303帧全核（4张联系表+原尺寸0000/0130/0250/0302）；岩檐机制r55在（terrainmesh朝下底面 + rock-topology measureOverhang + terrain-collide 按实际墙面含 overhang floor），本轮补运行验收：页面 #nocap A/B + __overhangProbe；mixed/quad 朝下面2片入画2未遮挡2、檐下投影框 P10 36/38 vs 去檐后 101/95、暗占比 1.000/0.915 vs 0、A/B 8583/15732px 噪声0、空洞2/3/4层射线全穿空气打到柱壁(余量0.14-0.21m)；薄檐 guard 0.2413/0.1603 vs 关退 0.1391/0.0453（格状参照 0.3436/0.2032）；旧note「软坡/侵蚀机制未做」=过期账(minimaAfter 0)。如实口径：夹具为1格外伸唇口、薄檐平滑仍留70%;跨切面3D侧壁交叉未单独量化",
      "project": "next",
      "page": "overhang.html",
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
      "id": "1670794261669769217",
      "date": "2023-06-19",
      "text": "Oh, and I finally got this lovely rock feature to show up! When working with WFC, sometimes you build a cool tile and it wont show up in forever, since it's conditions are so specific. You forget about it, and then suddenly: poof!",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/features.js · src/core/module-audit.js",
      "note": "247帧全核（3张联系表+原尺寸0122）；片子只是已生成结果的绕岛展示（岩拱板+拱洞+小屋+水中倒影），无UI无鼠标无WFC迭代，所以稀有度来自原文而非画面；features.js 已有岩拱，module-audit.js 补有限样本拓扑诊断（4922次候选、命中0/0/1/3均穷尽、预算截断判未知），明确不等于WFC出现概率",
      "project": "next",
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
      "id": "1670790425232175108",
      "date": "2023-06-19",
      "text": "I'm prepping for a talk in Cambridge next week, thus all the gifs. I made my generator also output pure triangle/hex and square grids, to illustrate why I'm going for my mixed approach.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/grid-kinds-c08.js · src/core/grid.js · src/world/app.js · index.html?grid=hex|square|tri&scene=terrain",
      "note": "610帧全核（7张联系表+原尺寸0242/0266/0440）；同一地形管线在三档纯格型上各出一座岛已能运行验收：?grid=hex|square|tri&scene=terrain 每格恒 6/4/3 边、顶点最多被 3/4/6 格共用（晶格类型可证）、V-E+F=1、互反违例0、陆地层数 95/6层、372/8层、576/10层，格线层唯一段÷陆地格 8.284/4.126/2.821 三档分明；页面内「纯六边形→纯方格」换网格场景不丢。原note连挂的「独立六边地形仍缺」为过期项（r56 C08 已接，缺的是运行验收）。形制差异如实记：原片六边岛是软坡+六棱柱，本仓走台地阶，属同组 1669 的软坡续项，不重复计。",
      "project": "next",
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
      "id": "1670725072540106755",
      "date": "2023-06-19",
      "text": "Here's a comparison showing no-, dumb- and hierarchical smoothing. The hierarchical smoothing helps preserve the intent of the input-tiles while smoothing out the jankyness from the weird underlying grid and from the limited slope angles in the input tileset",
      "topic": "grid",
      "status": "done",
      "where": "src/terrain/shape.js · hierarchy.html",
      "note": "164帧全核；三档分期 0-64 no / 65-119 dumb / 120-163 hierarchical（左上角标签模板匹配逐帧判），切点 64→65、119→120；机制 src/terrain/shape.js#shapeTerrain(mode) 早有三档（none 完全不形变、dumb 无视边类型全拉、hierarchical 按 rank 只被同级或更硬邻点拉），node 测试一直绿，真缺口是 hierarchy.html 只有硬边控件（页脚还写着三模式待补）→ 本轮补 #mode 三档选择器 + #modes 三档读数 + window.hierarchyModes 探针（渲染零改动）；实测崖顶转角 71.80°→61.03°、面积漂移 0/12.84%/12.24%、位移采样 0/4680/4682、钉住违例三档全 0、同机位像素 A/B 82869/80832/80333px 噪声 0；新测 tests/hierarchy-three-modes-browser.cjs + 回归 hierarchy-browser；如实口径：本仓分级是崖顶/崖脚/材质/钉住的本地近似，原片完整 mesh 边类型不声称等价",
      "project": "next",
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
      "id": "1670720537662836736",
      "date": "2023-06-19",
      "text": "I smooth my mesh according to an edge type hierarchy. Black is hard, red is game-tile-border and blue is material-border. Verts only get to pull at equal or lower order verts, and only along the appropriate edges",
      "topic": "build",
      "status": "done",
      "where": "src/terrain/shape.js · hierarchy.html（#clsOn/#clsSlice/#clsOut/#focusMat · window.hierarchyClasses）",
      "note": "102帧全核；三类边分级（黑=钉住/硬边、红=崖顶·崖脚=模块边界、蓝=材质边界）机制在 shape.js（rank 五档 + 只沿同级边、只被同级或更高级点拉），旧 note 的「机制未做/三角网语义仍缺」为过期账，真缺是页面从没画过三类边；本轮补三色层 + 逐切面表 + 材质边界近景；切面1 黑648/红514/蓝5（共1167条格边、蓝色输入11对），独立重算逐类相等；三档 rank 15190 采样 0 差异、pinned 位移 0、不给 materials 时 material 类 0；开/关差分 27960px（黑2878/红8476/蓝61）、同状态噪声 0、近景蓝色 316px；新测 hierarchy-edge-classes-browser，回归三档/hierarchy/edge-hierarchy-modes 全 PASS",
      "project": "next",
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
      "id": "1670064751181791233",
      "date": "2023-06-17",
      "text": "I figured out how to mimic Thread.Sleep() in Burst! Just store time in a static unsafe NativeArray! Then you can write to it from the main thread and read from it inside a job! Probably super bad in many ways but good enough for visualization and debug!",
      "topic": "tools",
      "status": "done",
      "where": "src/terrain/pipeline-job-c08.js + pipeline-job-worker-c08.js · job-c08.html",
      "note": "420帧全核（5张联系表）；片内=一轮22.83s：清空→三角网逐点生长7.4s→抬墙→灰模→纯黑剪影0.38s→上色→静止，可分辨的阶段边界与CLIP_RHYTHM对齐（tri7.41/7.07、sil0.38/0.40、一轮22.0/22.83）；job 线程+共享时钟慢放机制早已在（runJob/createJobControl/makeJobSleep/Atomics.wait + module Worker），本轮补的是真缺口：serve.py 没发COOP/COEP→页面crossOriginIsolated=false、SharedArrayBuffer不存在→退成copied-busywait（暂停键死、倍率只在启动读一次）；现只给 /job-c08.html 与 /src/terrain/pipeline-job* 发COOP/COEP。新测 tests/pipeline-job-shared-clock-browser.cjs PASS：coi true+sab可用+mode shared-atomics+真Worker实例、job睡觉期间主线程rAF 24帧/400ms、阶段顺序全对、运行时主线程setScale(0.02)让clay从2771ms掉到145ms（19.1×，墙钟与时间线同值）、暂停后消息155→155不动且恢复后继续、?rounds=2出现2次clear；回归 pipeline-job-c08.mjs/pipeline-stages.mjs/terrain-stages-browser.cjs PASS",
      "project": "next",
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
      "id": "1669315384619540487",
      "date": "2023-06-15",
      "text": "The generator consistently spits out pretty cool islands now",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/island-quality-c09.js · islands-c09.html?stage=sea|shore|silhouette|full&consistent=0|1&soft=1",
      "note": "649帧全核（7张联系表）；节奏=空海面→黄色海岸轮廓逐段浮出→黑剪影→成品岛→转台，8座岛重复。机制核实全在：island-quality-c09.js（islandReport 六组量 + ISLAND_RULES + consistentIsland 派生种子重生 + pruneIslets）+ islands-c09.html 连播页（?stage=sea|shore|silhouette|full）。本轮补运行验收 tests/island-quality-consistent-browser.cjs：连播4座每座 cool/failed空、tries 2,1,1,2；关体检扫8种子2座不合格（seed1 landFrac/mainFrac/cliffs、seed4 mainFrac）证体检非摆设；shoreSegments 152/180/138/152；阶段可见对象 5→6（+岸线）→18(override黑)→22；0错误。原note「完整软坡/模块联合生成+原美术质量仍待补」为过期项（软坡/湖/河道缓坡在 ?soft=1，c09-terrain-c 早已跑）。如实差：本仓岛比原片宽平、无美术级小屋群。",
      "project": "next",
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
    },
    {
      "id": "1666429884208381953",
      "date": "2023-06-07",
      "text": "I've been banging my head against various shore line rendering options for a good week now. Gonna stick with this for now I think, which is basically just a refined version of what I did for Bad North and Townscaper.",
      "topic": "water",
      "status": "done",
      "where": "src/water/shore.js · src/water/foam-mask.js · src/world/view-c10.js",
      "note": "630帧全核；岸裙+浪带本体早有，本片两条遗留（蓝线窄湾交叠 / 泡沫mask）核实为缺运行验收：?c10=shoreclamp 使穿岸 11.70%→0.92%（收回204顶点）、?c10=foammask 出碎斑泡沫（带内孔洞>50%、屏幕A/B 5594px、噪声0）",
      "project": "next",
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
      "id": "1664566546683899905",
      "date": "2023-06-02",
      "text": "Here's a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters I guess... But I would like something with a bit more punch this time. A bit more crashing waves.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-profile.js · src/water/shorefield.js · tests/shorefield-referee.mjs",
      "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过。buildShoreDistance API残差核销（2026-11-25，r211）：裁判 engine/shorefield.js 逐式移植为 src/water/shorefield.js（格心rasterise+两遍1/√2 chamfer+双线性sample+0.75·res步进/12次二分march，返回{sample,march,res,origin,size}同形+另挂w/h/land/field诊断），补 tests/shorefield-referee.mjs 裁判对拍——两套真实双网格（裁判buildGrid 762格/场222²、本仓buildQuadGrid 1052格/场170²）sample共449,488点逐位一致（maxDiff=0）、march 128射线逐位一致、REACode Town与core/town-graph Town互换逐位一致、重跑确定；shore消费路径（traceShoreLoops+sampleShoreline+march）268岸点端点|field−target|≤1.2e-5。差异如实标：内部索引用core/spatial buildCellIndex（桶2/所在桶 vs 原版桶4/3×3邻域，同为含点格子的超集）、pointInQuad按n角巡边（四边形逐式相同）、补RangeError验参与4M栅格预算；不融合进shore.js（其内部场有shape形变定界），sample/march同签名可平替注入。剩余残差：对拍对象为本仓裁判的重构实现，Oskar原作真实距离场算法未公开，无可执行迁移项。；【卡点·C 算法未公开】原作距离场浪裙真实算法未公开 → 卡在原片算法未公开：配文只说\"distance field-like\"不附算法，画面也不足以反推，只能近似；本仓裁判实现已逐式移植并对拍核销；r212 记账修复：reviewEvidence 原为多路径拼接（校验只认单文件）→ 改为本文件，status/结论未变。",
      "project": "next",
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
      "id": "1664565063552847873",
      "date": "2023-06-02",
      "text": "I'm trying out using a shader based fluid simulation. But I'm skeptical. It seems to need 32 bit float render targets, and I don't trust that those will work across platforms. Might also be a challenge to tweak, stylize, and feed back to CPU if needed.",
      "topic": "water",
      "status": "done",
      "where": "src/world/float-bands.js · float-bands.html",
      "note": "117帧全核（2张联系表+3张原尺寸，第198轮已看，本轮复核）；片内=平流场按 plasma 色带铺在真实几何上。旧note的『缺假彩色可视化页』本轮收口：新建 src/world/float-bands.js（clone view.worldMesh.geometry 12854 三角 + RGBA float 纹理 + 片元世界 xz 采样 + CPU 孪生调色板）+ float-bands.html；新测 tests/float-bands-browser.cjs 11/11：色带占 76% 且天空不着色=非全屏quad、色相 18 档/相邻跳变 0.36%、120 步变化 63.6%、GPU 与 CPU 孪生 76/77 点 Δhue<12°（中位 0.00°）、8级量化A/B把档塌到 10、噪声 0。仍非流体求解器（固定涡旋无散度投影），跨平台信任不可验",
      "project": "next",
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
    },
    {
      "id": "1654401054828638214",
      "date": "2023-05-05",
      "text": "An quaint island being procedurally generated",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/pipeline-stages.js · src/terrain/clay-ao.js · terrain-stages.html",
      "note": "343帧全核；两条剩余缺口补齐：灰模AO与软阴（新模块 src/terrain/clay-ao.js：vertexAO 半径2.6距离加权、sunShadow 沿太阳方向步进返回被挡比例→渐变压暗、shadeFactor 合成 + 下限0.34；页面可A/B，AO 0.612–1.000/97档）与生成后地形微调（tweakTerrain 余弦falloff 只改高度不重铺拓扑 + terraceArea，台地 202.1→210.1、两次微调单调）；无剩余缺口，表现层差异（Unity实时拾取 vs canvas等距）不计为机制缺口",
      "project": "next",
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
      "id": "1593215065423245313",
      "date": "2022-11-17",
      "text": "Making a lil dynamic sprite packer, able to add and remove sprite allotments at runtime. I had one of these in Bad North and found it very useful. Here, the sprites are baked live from meshes. So I guess it's basically impostors. Though I expect to use it for much else too.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · src/life/vegetation.js · src/world/view-post-extras.js · atlas-live.html · tests/impostor-grow.mjs · tests/atlas-live-browser.cjs",
      "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收。本批补自动扩容/重排：满板按REACode SpriteAtlas.insert语义翻倍、atlas.repack整批重排，rt.setSize原位放大（rt/texture对象不变，uTex/map免重绑）+scratch备份逐槽搬运，存活frames就地改写、注册ImpostorField经syncFrames同步（vegetation/view-post-extras/planet-c09消费方已接），maxSize封顶与搬运中途GPU失败两路回滚；tests/impostor-grow.mjs过（UV/槽位一致性、9次blit调用序列、两路回滚）+ atlas-live-browser.cjs真实GPU验收（512→1024扩容存活像素逐位一致、超maxSize拒绝）；扩容策略原片配文未明说属本地近似。残差：原素材/完整SpriteAtlas接口仍缺。；本轮补残影：release({residue:true})按sprite-pack-c09同口径留×0.38压暗调试残影（乘性混合Zero×OneMinusSrcAlpha，opacity.62），atlas-live-browser真GPU验收gAlpha 294780→112132=0.3804倍。残差收窄为：原素材/完整SpriteAtlas接口仍缺（卡点·B 美术资产，永久卡点，需新证据再立项）",
      "project": "next",
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
      "id": "1590674061092212738",
      "date": "2022-11-10",
      "text": "In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the background. The outline strength is determined by the difference between these two samples! Not perfect, but pretty good! Not too jittery when turning the camera",
      "topic": "light",
      "status": "done",
      "where": "src/world/view-c11-grassline.js · src/core/c11-maps.js#bakeContrastHeightMap/grassOutlineStrength · index.html?c11=grassline",
      "note": "181帧全核；顶点着色器两次采样（站立处 + 沿镜头射线的背景命中处）反差纹理之差定描边强度已落码并出运行验收。核实旧note的「只静态邻崖距离aEdge、未实现GPU采样/背景射线」为过期账（第29次同型）：view-c11-grassline.js + c11-maps.js#grassOutlineStrength 从 r56 就在，缺的只是页面运行验收。新测 tests/grassline-contrast-browser.cjs：4491丛草卡、强度 p50 0.0122/p90 1.0、>0.5 有1684丛；与静态 aEdge 判定不一致 43.0%；转180°有63.6%的卡强度变化>0.2（相邻45°中位0，局部不闪）；单卡隔离渲染48丛 GPU回读 vs JS孪生 最大差0.003；描边A/B：aEdge=1但背景同色（vEdge 0.001）轮廓环暗占比0.855→0.575、亮度51.7→77.6；aEdge=0但背景差大（vEdge 0.998）墨像素438→593(+35%)、环亮度47.8→42.2；同状态噪声0、0 console error。原note记的「GPU采样/背景射线」缺口核实为过期账",
      "project": "next",
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
      "id": "1590669875869286400",
      "date": "2022-11-10",
      "text": "An early look at grass billboards. I really like how they add a completely new kind of shape and detail frequency.",
      "topic": "life",
      "status": "done",
      "where": "src/life/vegetation.js · src/core/anchored-billboard.js · index.html?scene=terrain",
      "note": "249帧全核；草丛=朝镜头扇贝叶丛卡片（5圆并集+瓣间弧线），沿崖脚成簇；缺片子那种沿台地边缘的连续边带与7–9瓣",
      "project": "next",
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
      "id": "1584623053061099520",
      "date": "2022-10-24",
      "text": "I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful insert them at will too. You can kinda see the structure of my mesh system and mesh algoritms by how the yellow lines are rotating around the verts.",
      "topic": "terrain",
      "status": "done",
      "where": "src/build/splice-polygon-c09.js · src/terrain/terrainmesh.js · splice-c09.html",
      "note": "453帧全核（联系表 5 张 + 原尺寸 0155/0303/0392/0452）；旧账「任意轮廓插入/地形周边重新网格化仍缺」核实为过期账（第39次同型）：splice-polygon-c09.js#spliceFootprint r56 就在（任意可凹轮廓→外扩单环→带洞桥接+耳切+约束Lawson），terrainmesh 三处挂钩在，node 测试一直绿，缺的只是页面运行验收。本轮补新测 tests/splice-polygon-c09-browser.cjs：mixed/quad 两格型面积账 1.11e-15/6.66e-16、半边问题拼接前后 1==1 / 0==0、边界环 = 底+1 个占地洞（3=2+1 / 2=1+1）、Euler 0、占地 6 点 1 凹口横跨 14/17 格、半边扇步数 164/162 且最大扇角合 360°、房子 12 屋顶三角 6 面墙、实体 A/B 中心裁切屋顶 75821 vs 7482 px 墙 8075 vs 0；如实口径：最小角 0.68°（约束边上的薄三角，肉眼不可见），房子是直骨架四坡顶替身（原片多段屋顶/烟囱属预建 tile）",
      "project": "next",
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
      "id": "1582757294672314368",
      "date": "2022-10-19",
      "text": "I'm seeing if my light volume approach can work with point lights too. The low resolution is noticeable for sure. Especially when you move em around like this. But if you keep em big and soft and somewhat still I think it's gonna be good.",
      "topic": "light",
      "status": "done",
      "where": "src/core/voxel-ray.js · src/light/lightvolume.js · src/world/view.js · lightvolume.html",
      "note": "176帧全复核：固定蓝光/移动红光与低分辨率软光。修复点光射线越过光源、零距离及缺少直接点光采样，支持两色累加，View复用aGI缓冲和本渲染器内标记。1500段DDA与双网格真实World移动/关闭通过。CPU按需烘、单RGB体积不是原作完整六方向SDF/mega-texture；形变漏光待补。",
      "project": "next",
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
      "id": "1582293326815862786",
      "date": "2022-10-18",
      "text": "I thought it would be too expensive to properly evaluate each tile placement. But! While the number of possible tiles is indeed very large, it is actually quite small around the collapsed edge! Thus, my algorithm now tries to expand (and interconnect) a simplified nav graph.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/frontier-candidates.js（frontierCandidates 只读探针 / expandFrontier 增量放置+nav 互连 / twoFronts 双锋面）· wfc.html?expand=1",
      "note": "434帧全核：0–190 为二维导航图生长（细暗线=格网、亮线=简化导航图、绿/黄=两粒种子的两个连通块，f100–110 绿归零=互连成一张，f155 后饱和静止），191–433 为结果岛三维转台。旧note「尚未实现增量生成与简化导航互连」= 过期账：expandFrontier 早在 src/core/frontier-candidates.js（文件头署本片ID）实现「只对最后放置格的邻居重算候选 + 最小候选优先 + 前向一步校验 + 可走边压入 nav + 并查集报互连点」，但页面只接了只读 frontierCandidates 探针。本轮补 wfc.html 的 #expand 入口/回放/双锋面开关/导航图视图 + window.frontierExpand 探针，并给模块加默认关闭的 twoFronts（两粒种子轮流推进，对齐原片两条锋面）。实测混合网格 147格/放置145/死格0、每步只看17.24格 vs 剩余73格、每格候选3.72/24、导航边236（页面重算==模块）、两锋面37/37→互连于第133步；四边 206/204/0、导航388、互连191。像素黄447→23972单调增、绿699→10526→0。反向对照关双锋面：50%处两组73/1、绿线0。形制差（非缺口）：本仓合并点(90%)比原片(~66%)更晚、tile目录为二进制socket。",
      "project": "next",
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
      "id": "1580846877855338497",
      "date": "2022-10-14",
      "text": "Here's the slowed down bounce sequence. You can see how the mega texture and the light volume affect each other back and forth. After about the 3rd bounce, further bounces are not noticeable.",
      "topic": "light",
      "status": "done",
      "where": "src/light/megatexture-gi.js（bakeMegaTextureGI 的 gatherVolume/relightTexture 交替）· src/world/view-c11-megagi.js（showStage/endStages）· megatexture-gi.html（三张贴图 + 慢放/结束按钮）",
      "note": "41帧全核（4.18fps/9.56s）；mega texture↔六向光体积交替往返已实现并跑出运行验收：14 步快照里 volume k 只改光体积（贴图改 0 项）、texture k 只改贴图（体积改 0 项），像素台阶 +10.2/+1.16/+0.17/+0.04 级、相对变化 122.87%→5.50%→0.97%，tex3→tex6 仅 3142px（0.3%）对应原文第 3 次后看不出。本轮修两处展示层缺口：慢放阶段漏关 fill 补光（direct 暗像素 0.63%→1.91%）、结束慢放不打断播放循环（加 playToken）；新测 tests/megatexture-bounce-browser.cjs；回归 megatexture-gi.mjs / lightbaker-textures-browser.cjs PASS。原 note 记的『往返反馈未做』核实为过期账。",
      "project": "next",
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
      "id": "1580845127207387137",
      "date": "2022-10-14",
      "text": "1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in the mega texture! 2nd is a baked 6 directional light volume, raycast against the sdf, sampling the mega texture using the UVs where it hits the sdf. 3rd is the lit mega texture",
      "topic": "light",
      "status": "done",
      "where": "src/light/megatexture-gi.js · src/light/megatexture-gi-debug.js · src/world/view-c11-megagi.js · megatexture-gi.html",
      "note": "213帧全核；原文三张图＝①SDF(alpha=距离/RG=mega UV) ②六向烘焙光体积(射线对SDF步进、命中前空格读RG→图集取纹素) ③被照亮的mega texture，落点实为 megatexture-gi.js（旧 note 指 lightvolume.js 的平均RGB 是其自身口径，非本片）；本轮补六向体积与逐命中取纹素的量具：+Y 1.899 vs −Y 1.090、换太阳后 lobe 能量对背光方向对齐 0.984–1.000、两色世界红侧间接光色相 +0.371/蓝侧 −0.126(sd 0.542)、exitance=反照率×(直射+间接) 误差 2.98e-8；原片 SDF 图帧间 0.000%/六向 7.06%/mega 47.75% 与页面 A/B 同形",
      "project": "next",
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
      "id": "1580835075629133825",
      "date": "2022-10-14",
      "text": "I always write my own lighting solutions. I've had some really naive ad hoc color bleeding in my (very fake) GI before, but this is my first decent attempt to actually have the light *bounce*",
      "topic": "light",
      "status": "partial",
      "where": "src/core/voxel-distance.js · src/light/lightvolume.js · src/light/surface-bounce.js · tests/surface-bounce-referee.mjs · lightvolume.html",
      "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。形因子/参考接口残差核销（2026-11-25）：裁判 bouncegi.js 本有真形因子 F=cosI·cosJ·A_j/(r²+pitch²/4)+蒙特卡洛bruteForce+audit，此前批已迁 src/light/surface-bounce.js（split校准、calibration回物理值1，已接 view-shading surfacebounce）；本轮补裁判对拍 tests/surface-bounce-referee.mjs——同一场 directLight 与 bruteForce/hitRate 逐位一致、legacy gather≤1ulp；实测发现裁判第2跳起 src===E 别名的就地Gauss–Seidel语义，bounce 加 inPlace 选项逐位复现（bounces:2 对拍≤1e-6，默认Jacobi差0.13如实记）；裁判峡谷场上 split r 0.501→0.831、形状误差90.4%→43.2%。裁判 makeCanyon 合成岛/renderRay 2.5D渲染仅 bouncelab.html 演示用，本侧由共享World surfaceFieldFromWorld 承接，无可执行迁移项。剩：原片反弹算法未公开，画面不足以证明逆平方/形因子归属。；【卡点·C 算法未公开】原片反弹算法未公开：配文只说\"first decent attempt to actually have the light *bounce*\"，画面不足以反推逆平方/形因子；裁判形因子/暴力参考已迁并对拍核销，本地近似口径如上 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      "id": "1580162341668237312",
      "date": "2022-10-12",
      "text": "I start with a very basic Marching Cubes mesh from a bunch of spheres. I mark the edges between triangles that are closest to different spheres. Then I run an iterative relax algorithm where those hard edges are like rubber bands, and the rest is sort of a like a balloon.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/canopy.js · src/life/vegetation.js · src/life/impostor.js",
      "note": "155帧全核（2张联系表+原尺寸0060）；球并集surface nets+按面最近球标接缝+弹簧/气球松弛，闭合定向与硬边收缩通过；用surface nets而非原作MC",
      "project": "next",
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
      "id": "1580158269267406849",
      "date": "2022-10-12",
      "text": "Can you make good looking foliage from Marching Cubes-blobs? Maybe?",
      "topic": "grid",
      "status": "done",
      "where": "src/core/canopy.js · src/life/vegetation.js · index.html?scene=terrain",
      "note": "283帧全核；树冠=球并集团块（surface nets）+整团连续受光、瓣间无折痕，与本仓等价；缺参考片的瓣径差异与顶部亮边",
      "project": "next",
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
      "id": "1579483114178768898",
      "date": "2022-10-10",
      "text": "Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North). Note how one of the house tiles even cover both a square tile AND a triangular tile",
      "topic": "grid",
      "status": "done",
      "where": "src/build/multicell.js · src/build/prefab-socket.js · src/ui/house-project.js · src/world/scenes.js · multicell.html",
      "note": "177帧已复核；通用模块身份落地：回执 placement.instance + world.houseInstances 登记（id 留洞不复用，随 world.snapshot() 统一撤销/恢复——多格整体操作一个撤销条目），整栋替换/移动/改色身份不丢；工程JSON保存实例ID/编辑回执，完整重载/页面刷新后继续整栋编辑；prefab库×4朝向、墙/门socket与联合WFC在 build/prefab-socket.js，placements 带 pf:<prefab>:<锚点> 实例身份，TigerMessenger building.joint-wfc 真实消费。四边与混合网格回归通过（multicell/multicell-edit/multicell-identity/house-project/prefab-socket + multicell.html 浏览器验收）。仍缺：原版 prefab 内部美术/房型细节与更全的 socket 类型；多格体素房屋的游戏侧消费者未接（游戏走 joint-wfc placements，不走 multicell）。",
      "project": "next",
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
      "id": "1579478470098243584",
      "date": "2022-10-10",
      "text": "To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells.",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/cage-c09.js · src/terrain/terrain-strokes-c09.js · src/world/build-reel-c09.js · cage.html · island-build-c09.html?mode=cage",
      "note": "272帧全核；笼形变在壁面内部与碰撞两侧都量住——cageWallPoint 与 terrainmesh 实际墙四边形 5×3 逐点重合（maxDev 0/4.4e-16），形变后 cageCollider.pushOut 把陷进岩石 0.08 的探针推出（inside=false 余量=r 接触=1），terrain-collide 认同 60/60；竖向笼边弯曲量 quad 0.0661 / mixed 0.0664。本轮补 cage.html「笼碰撞探针」入口 + tests/cage-deform-browser.cjs（mixed/quad 双网格 + island-build-c09.html?mode=cage 的 wire→hold→color 时间结构、overlay 淡出与转镜 yaw 0.91→2.55）。形变强度比原片激进程度保守属美术差",
      "project": "next",
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
      "id": "1579474420749725696",
      "date": "2022-10-10",
      "text": "I'm back on the island generation",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/bn-island-field.js · src/terrain/generate.js · cage.html",
      "note": "454帧全核验，片中两组岛线框构建/着色/转镜；r215 裁判库核对核销可对齐部分：REACode engine/islands.js 此前仅静态记为已合并（badnorth/island.js 是另一套共享World近似），方格高度场管线未迁 → 逐式移植 src/terrain/bn-island-field.js（域扭曲fbm+脊线→径向衰减→台地量化→材质分类→可走格→8向A*→顶面+崖裙几何）+ placeIslandHouses（裁判 mesa.js 平顶候选/最小间距/spire 0.35 同款规则联合出屋，连续场按|Δh|≤eps+草顶判平顶内部，非逐位）；tests/bn-island-referee.mjs 5/5：5组参数 h/mat/slope/walkable 逐位、findPath 逐格、几何 pos/col 逐位、两种子两组岛互异。；【卡点·C 算法未公开+B 美术资产】原片配文仅\"I'm back on the island generation\"，三角网生成器/完整坡面/真屋模联合算法未公开不能认证本实现为原作，黄顶小屋美术资产未公开 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
    },
    {
      "id": "1490068909042642944",
      "date": "2022-02-05",
      "text": "Late night cryptic graph tweet",
      "topic": "grid",
      "status": "done",
      "where": "src/core/graph-bands-c08.js · graph-bands-c08.html",
      "note": "427帧全核（5张联系表+原尺寸复核0000/0250/0390/0426+3×裁切）；机制=邻接图环带布局：4条同心环带（带内真实格邻接）、带间4方向单边辐条+4外伸悬挂、0200-0299从中心逐层BFS前沿（黄/红）、0300后按环带上色；三条旧账全部用同一口径量两边后定案：颜色跟半径不跟角度（终帧蓝带色相210-225命中36/36个10°扇区、r p10 67/p90 100，分桶一致率半径27.6% vs 角度18.6%）、节点半径=辐条端点放大（3×裁切可见带间缝仅1根边、两端点圈更大）、极坐标网12放射线+72刻度；本仓462节点/606边/16辐条/31桥/区域180·154·101·23+4/22层，四条带均半径0.91/2.82/5.00/6.89递增，渲染色相青1079·蓝5220·品红8713各自36/36扇区且径向量程不交叠，搜索态10/22层红1350·黄1695px，换种子466节点仍4带；美术差（原片带厚2-3格、本仓1格厚；BFS沿长辐条跳层）单列不计缺口",
      "project": "next",
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
      "id": "1489193847422865410",
      "date": "2022-02-03",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "316帧全核（4张联系表全看+原尺寸回看240）；画面是手摆小岛资产的转台录像：沙色台地+石砌挡墙+两栋黄顶小屋+灰色层叠石塔，仅环绕切镜、无生成动画无UI；方形台基与正交体块不是本仓不规则格子风格，砌石尺寸无规律可反推，确认与原版实现无关",
      "project": "next",
      "decodedFrames": 316,
      "reviewEvidence": "artifacts/coverage/1489193847422865410-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          315
        ],
        "nativeRevisits": [
          0,
          107,
          240
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1482346496460828674",
      "date": "2022-01-15",
      "text": "I created a dedicated contrast texture system for the lines: an iterative simulation on the triangles that starts random and then tries to make contrasted edges different, and non-contrasted edges similar. A byproduct is a beautiful color gradient that help express connectivity",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/contrast-field.js · src/world/view-shading.js#contrasttex（index.html?scene=fusion&shade=contrasttex）· src/core/c11-maps.js · color-lab.html（三角诊断）",
      "note": "517帧全核验（沿用原记）；图集预览、灰岛上色和两组岛环绕。核旧账：实景接入早已落码——view-shading.js#contrasttex 把 worldContrastMesh+solveContrastColors 烘成 uShCTMap（512²世界XZ图），shContrast 在地形顶面取色、fwidth色差压暗出像素细线；c11-maps 另供草地描边反差图，uv-radial-atlas 复用同一解算器。本轮补整片运行验收 tests/contrast-shading-browser.cjs：10064三角/15012边、同边ΔE13.76→0.10、对比边最小ΔE14.28，上传纹理与页内同参重解9919抽样texel全同，屏上8.2%像素改色+2946墨线像素、同状态噪声0、关掉还原、0 console error（artifacts/coverage/contrast-shading-review.md）。仍缺：原作本人的贴花形状/特征种子/atlas文件未公开（worldContrastMesh 是本仓等价实现）；【卡点·B 美术资产】原作彩色图集/贴花原资产未公开 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
      "id": "1482011744843223042",
      "date": "2022-01-14",
      "text": "Ok, I stumbled on a pretty cool art style now. Here, I'm creating pixel thin lines from contrasts in my procedural normal map. I should probably move to a bespoke contrast texture (to get more deliberate control over the lines). But I gotta say this looks pretty promising.",
      "topic": "texture",
      "status": "done",
      "where": "src/world/view-c11-normalline.js · ?c11=normalline（index.html?scene=terrain）· normal-contrast.html",
      "note": "384帧全核（sheet-00/02 本轮复核 + sheet-01/03 沿用 r56；原生 0125 及 3 处 4× 裁切）；线源=程序化笔触法线图的反差（uDepthMix 0，不来自深度），线宽 p50=2/p90=3 与原片同口径一致，天空与海面线 0、剪影不另描。旧 note 的【卡点·B 美术资产】核实为误标：原文就是 procedural normal map（姊妹片 1481661852887265288 亦写 procedurally painted in big chunky strokes），两侧都是程序化、无需手绘 atlas。本轮修掉三个真缺陷：①outline-pass 把阈值改成 uNormalThreshold uniform 后，本开关仍按旧字符串 patch 合成着色器 → ?c11=normalline 直接抛 composite token missing，且抛在 outline 已打开之后 → 几何描边留在天上（云边/天空整片锯齿线）；改为直接设 uniform，不碰着色器源码；②off→on 二次 patch 必抛（prevFrag 已是 patch 后源码）→ 原始源码只存一次且不再改源码，实测 关→开→关 幂等（91.45→172.11→91.52→171.92→91.84‰）；③法线遍只排除无 normal/透明网格，云与天空会进法线遍 → 线源限定为共享地形材质（c11NormalOnly，留 userData.c11LineSource 退出阀）。形态差如实记：线密度 172.11‰ vs 原片 63.98/72.81/73.67‰（本仓逐格台地每条台阶都是几何折痕）、笔触为周期平铺非手绘块形、世界轴三向投影换轴接缝未单独量化（视觉未见直缝）。",
      "project": "next",
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
      "id": "1481661852887265288",
      "date": "2022-01-13",
      "text": "Yet another light baker. Actually does some ray marching, but still pretty ad hoc. The textures are: 1. Normals (procedurally painted in big chunky strokes) 2. 3D Signed Distance Field 3. 3D Ambient Occlusion in positive and negative X,Y and Z",
      "topic": "grid",
      "status": "done",
      "where": "src/core/paint-normal.js · src/light/lightvolume.js · src/light/megatexture-gi.js · lightvolume.html · megatexture-gi.html",
      "note": "425帧全核（sheet-00~04五页 + 原尺寸0000/0150/0220/0300/0424）；原文三件（大笔触法线/3D SDF/±XYZ六向AO）与片子隐含的 mega 反馈四件全部有模块与页面入口，本轮补齐运行验收：?shade=paintnormal 像素A/B 噪声0/差分233109px/回位0（顶点49848不变）；SDF-UV 命中精确穿越面82.5%、反弹122.9%→5.50%→0.97%；块宽/图宽0.20（原片0.15）、块内倾角离散1.1°。旧note两条记为过期账。形态差：原片法线图是网面UV图集、本仓是世界平面周期Voronoi；SDF是体素中心EDT非连续表面SDF。",
      "project": "next",
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
      "id": "1480635131614355459",
      "date": "2022-01-10",
      "text": "More experiments in procedural texturing of procedural islands. Still very early, but I do like these big paint blotches. They hide the polys well and they would be hard to achieve with other means. Definitely need a proper lighting system though. And probably some outlines.",
      "topic": "light",
      "status": "done",
      "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
      "note": "428帧全核；大块柔和颜料斑（20–30px 宽带渐变、连续色阶，只上朝上草面）；原默认是三档硬量化，已加 mode 2 柔和档并设为 blotches.html 入口；缺 atlas/跨崖采样",
      "project": "next",
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
      "id": "1478114309263839244",
      "date": "2022-01-03",
      "text": "Yeah that's good enough for now. I quite like how the radial (instead of directional) size-sorting looks. Gonna make for some visually pleasing textures with that big coherent chunk in the middle.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/uv-radial-atlas.js · uv-radial.html",
      "note": "346帧全核；径向大小排序 UV 图集已从真实页面量出：朝上面合并 66 片、最大中心片占面积 30.7% 且带 1 个崖柱/拱洞脚印洞、装箱重叠 0、面积名次~离页心距离 Spearman -0.634、逐片放置墨量 16807→43341 单调；棋盘格贴回同一座岛（3D 视图差 67773px）、反差色对比边 ΔE 18.13 vs 同类边 0.27 且可逐轮回放。旧 note 的「原UV流程未实现」核实为过期账（模块 r56 C11 就署本片 ID，只缺 -browser.cjs）。造型差：同构测试岛而非原片真岛、图块边界由格网决定、彩色线框本仓为面填色+边压暗",
      "project": "next",
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
      "id": "1471817524148940807",
      "date": "2021-12-17",
      "text": "Some rocky islands. Trying to make the grid natural and readable, yet funky. Square, yet hex.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/corner-footprint.js · src/core/rock-island-c08.js · corner-cuts.html · rock-island-c08.html",
      "note": "556帧阶段生成/旋转岩岛。岩岛生成层补齐：裁判 squarehex.islandMask 两档低频噪声+椭圆径向衰减逐点移植（rock-island-c08.js#rockIslandLand/Field/Levels/Generate），3种子×32×32格点与裁判掩码逐位一致、陆地共边对数与裁判 countAdjacency 相等；land 分档台地（{2,4,6,8}层）写共享 World rock 列，接 rockIslandMesh 切角闭环（二分计划接触 0.5、断边 0），格网邻接/导航不动，新测 tests/rock-island-gen.mjs。；【卡点·C 算法未公开】原片完整岩岛生成器（阶段生长/计时那台）从未公开，裁判仓同样只留 islandMask 演示 → 永久卡点，需新证据再立项；r225核销：tests/rock-island-gen.mjs/rock-island-c08.mjs/corner-footprint.mjs/squarehex-island.mjs 复跑 4/4 PASS（裁判对账与生成→切角闭环口径同前），src/core/rock-island-c08.js 与 vendor 逐字 cmp 一致、本批零代码改动；剩余残差仅卡点·C，无可执行残差，永久卡点，需新证据再立项",
      "project": "next",
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
      "id": "1466059785703460870",
      "date": "2021-12-01",
      "text": "Oh. What's this? A free Townscaper web demo, playable straight in the browser: http:// oskarstalberg.com/Townscaper/ 🕊️💦🌊🏡🏤⛪️🏤🏡🌊💦🕊️",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "328帧全核（4张联系表全看）；画面是官方网页demo实机操作：固定等轴机位、两侧竖条为游戏内调色板、逐块搭楼换色，全程无生成过程/线框叠加/镜头运动，属成品展示，确认无新机制",
      "project": "next",
      "decodedFrames": 328,
      "reviewEvidence": "artifacts/coverage/1466059785703460870-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          327
        ],
        "nativeRevisits": [
          0,
          110,
          327
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1459169210752507904",
      "date": "2021-11-12",
      "text": "And another",
      "topic": "show",
      "status": "partial",
      "where": "src/core/grid-wireframe.js（patchLayout/cellAxisDeg）· grid-graph.html?mode=patch · buildMixedGrid 逐格松弛",
      "note": "609帧全核（r19 七张联系表 + r116 重看 sheet-00 与原尺寸 0150/0200/0420 含 3× 放大）；纠正 r19 三条误读：格心没有彩色小块（是补丁缝折线与三角带小三角边，格心只有对角线 X — 本轮补画）、全片无透视（各格尺寸一致，平面正视、补丁各转 0/30/60°）、无 world 实景（609 帧只有格子调试视图）；机理补齐：新增 patchLayout 三族吸附 + 补丁连通块 + 补丁缝，grid-graph.html 加 ?mode=patch（同片同色/品红缝/绿填三角格/格内对角线），新测 tests/grid-patch-families-browser.cjs 全 PASS；仍缺 补丁级刚性：本仓 153 块（最大 34 格）vs 原片约 8 块（每块几十格），逐格轴向抖动 max 14.99° vs 原片 0°，根因=hex-merge 三族按格交错 + 逐格松弛（试过族向约束反而 45°，已回退）",
      "project": "next",
      "decodedFrames": 609,
      "reviewEvidence": "artifacts/coverage/1459169210752507904-review-r116.md",
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
      "id": "1458921394855718917",
      "date": "2021-11-11",
      "text": "I'm exploring the Half Edge data structure. Feels like a really lightweight, powerful and versatile way of representing topology. A big thanks to everyone suggesting I look into it.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/halfedge.js · src/core/halfedge-patch-c08.js · halfedge-c08.html",
      "note": "511帧全核（6张联系表+原尺寸0475）；半边环/扇与编辑接口全在：halfedge.js buildHalfEdge（next/prev/twin + boundaryLoops + vertexFan + euler）与 splitQuads，halfedge-patch-c08.js 复现「方块组→剩余区域边界环→间隙三角→合成网格」；本轮补页面入口 halfedge-c08.html 的「切四边形 / ?split=」与运行验收 tests/halfedge-c08-browser.cjs（t1.9 groups13/quads51/tris386/loops14/errors0、t3.2 euler1/fullLoops1、切 51 格出 46 三角=2×23 缝、splitEuler1/环1/错误0/面积Δ0、换种子 seed2 仍 euler1），截图 loops/mesh/split 已 ViewImage 核过。口径：原片彩边不能反推具体半边指令；环的合并粒度与配色规则与原片不同（本仓圆1+块轮廓13=14 环）。",
      "project": "next",
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
      "id": "1448039167057879048",
      "date": "2021-10-12",
      "text": "Imma talk about my new island generator at Sweden Game Conference (@SwedenGameArena) on Friday (no idea if its gonna be recorded). Naturally, I'm preparing by implementing some nice timing and visualization.",
      "topic": "terrain",
      "status": "done",
      "where": "island-stages-c09.html?mode=talk · src/terrain/island-viz-c09.js · src/core/stroke-reveal-c09.js(createLayerTimeline/roundSeed) · src/terrain/pipeline-stages.js",
      "note": "952帧全核；核实为「已实现缺验收」（第五次过期缺口标签）：r56 C09 的 island-stages-c09.html?mode=talk 六层 tent→lattice→strokes→net→contour→color 全在——帐篷层超级三角形竖棒边 29/25/24/27、共享边线网 114 笔由稀到密（墨迹 4083→32758）、逐笔线稿墨迹 395→33217 单调、createLayerTimeline 自动推进（4.4s 内 lattice→strokes）、roundSeed 每轮换岛（55447/60185/64923/69661）；walkthrough 的自动计时推进在 src/ui/walkthrough.js 的 auto() 早已有；新测 tests/island-stages-talk-browser.cjs 全通过",
      "project": "next",
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
      "id": "1447496205282549761",
      "date": "2021-10-11",
      "text": "The base graph is just a humble irregular triangle grid",
      "topic": "grid",
      "status": "done",
      "where": "src/core/grid.js#buildMixedGrid · src/terrain/generate.js#generateTerrain(softSlopes/riverRelax/lakes) · grids.html?kind=&wire=&tri2= · terrain-r55.html?grid=tri · index.html?grid=tri",
      "note": "383帧全核（4张联系表+原尺寸0020/0175，0020另做3×裁切）；底图=不规则三角网已可在页面上跑出来：grids.html 新增 ?kind=tri|square|rhombi|mixed / ?wire=1（只画格线）/ ?tri2=1（四边格沿一条对角线切两片）+ gridLab.kindsReport，mixed 三角化后 331 格→486 三角、对角线 155==四边格 155、面积 CV 0.4165（0.24–1.40）、V−E+F=1；主场景 ?grid=tri 1944 格全三角、陆地 576 格/10 层、河道 27 格 2 条；terrain-r55.html 原来只透传 quad|mixed（三角底图上跑不了软坡/河道），现接受 tri|hex：软坡面 36.4 vs 墙面 211.8（关软坡 0/215.4）、河道 52 格 2 条 7 口、湖 6 个 51 格、缓坡陡边 118→91。新测 tests/tri-base-graph-browser.cjs 19/19 PASS，回归 grid-kinds-c08.mjs PASS + grid-kinds-browser.cjs EXIT 0。原文只讲底图，本片无预制 tile/无房子（原 note 的『预制 tile』口径属过期）。",
      "project": "next",
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
      "id": "1447494168448753667",
      "date": "2021-10-11",
      "text": "Long time fans of the show will not be surprised to learn that this is indeed running on tile based WFC. This time around, I'm getting the best of both worlds by using a mix of triangular and square tiles. (The squares are cut along each diagonal to create 4 triangles though)",
      "topic": "build",
      "status": "done",
      "where": "src/core/grid.js#buildTriangularSubgrid · src/core/wfc.js#jointSubtileCatalog/#layeredJointCatalog · joint3d.html",
      "note": "178帧全核（2张联系表 + 原尺寸0050/0130）；note 挂久的「四子格联合模块约束及原3Dtile仍缺」已过期：jointSubtileCatalog/layeredJointCatalog 都在 wfc.js，joint3d.html 叠3层且 tall: 插槽出跨两层塔。页面运行验收：69父格/150子格=69+3×27（方格四分、三角1:1）、3层、conflicts 0、mismatch 0、towers 5、34.8ms；反向对照 ?joint=0 mismatch 81、换种子 seed9 仍 0。未改码，只补运行验收与量具。",
      "project": "next",
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
      "id": "1447488323845509121",
      "date": "2021-10-11",
      "text": "I'm able to do a couple of things here I've always wanted to, but never been able to before: - Properly combine seamless soft slopes with distinct sharp cliffs. - Erosion valid terrain with no local minimums. - Get the best of both square tiles and triangular tiles",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/soft-tops.js#softCorners · src/terrain/terrainmesh.js#altered · src/world/terrace-edges.js#seamless · src/terrain/generate.js#slopeMask/limitSoftSlopes · src/core/depression-fill.js#erodeHeights · src/terrain/drainage.js#fillTerrainDepressions · terrain-r55.html(?soft/?softrelax/?erosion/?edges/?tops=0)",
      "note": "656帧全核（7张联系表+原尺寸0000/0160/0444/0510+3×裁切）：片是「着色≈20帧↔白线态≈20–25帧」循环，白线只画台地沿口折线与逐级短竖线。旧note的【卡点·C 算法未公开/XZ层级形变不等于连续坡面】为过期账（第30次同型）：soft-tops.js#softCorners（文件头署本片ID）+ terrainmesh:60 altered()（两角焊死则整条墙不画、只焊一角拉成梯形）+ terrace-edges#seamless + generate.js#slopeMask/limitSoftSlopes + depression-fill#erodeHeights/drainage 全部r55就位，缺的只是页面运行验收与量具。本轮只加只读探针（terrain-r55.html 的 __r55.soft/walls/water），机制零改动。同一World只切 tops=0/1：mixed 缓坡台阶163条焊死135（82.8%）、1层墙350→250（−100==seamless 100）、≥2层崖墙157/39/17三档一字不差、cliffHorizontal 0、崖边借角9.9%、台地线547→447、斜面0→24.9m²、墙面227.6→199.6m²、像素A/B 21332px噪声0；quad 210条焊死205（97.6%）、1层墙470→284、崖墙215/47/28不变；gridSides 3:1142/4:881 同岛，且4:4/4:3/3:4/3:3四种配对都有焊死；侵蚀 lowered165、局部低洼 2→0→0、drained 1.0。",
      "project": "next",
      "page": "overhang.html",
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
      "id": "1447483550257799171",
      "date": "2021-10-11",
      "text": "I regret to inform you that I've relapsed into procedural island generation",
      "topic": "terrain",
      "status": "done",
      "where": "island-build-c09.html?mode=reel · src/world/build-reel-c09.js(REEL_PRESETS.reel) · src/terrain/terrain-strokes-c09.js(surfaceSegments) · src/core/stroke-reveal-c09.js(createStrokeReveal3D) · src/world/scenes.js(buildScene 换种子)",
      "note": "565帧全核；核实为「已实现缺验收」：r56 C09 的 island-build-c09.html?mode=reel + src/world/build-reel-c09.js 的 REEL_PRESETS.reel（colorFirst 先彩色岛再切黑画线、seeds 5/9/17/31 四轮各出不同岛——线段数 4513/3634/3940/2850 全不同、着色段 worldVisible 且 drawn=0、线稿段 47→3634 段逐笔累积、第 5 轮回卷到 seed 5、自动播放自己跨阶段）；新测 tests/island-build-reel-browser.cjs 全通过",
      "project": "next",
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
    },
    {
      "id": "1430227487376781317",
      "date": "2021-08-24",
      "text": "Plus you can change the in-game textures now! So I guess the game is now (in the most liberal use of the word) \"moddable\"",
      "topic": "texture",
      "status": "done",
      "where": "src/core/town-skin.js · src/world/town-skin-layer.js · src/world/view-c07.js（townskin）· index.html?c07=townskin",
      "note": "279帧全核；核实为已实现缺验收：src/core/town-skin.js（128² 总图集/60 色格/格均色=底板/scribble）+ src/world/town-skin-layer.js（aC07Cell+aC07Ratio 顶点属性、scribble/paint/loadImage/toPNG 热替换、植物 leafSurface 同图）+ view-c07 townskin 开关；本轮补运行验收 tests/c07-skin-decal-browser.cjs —— 36555 顶点全 skinned/26 色格/mismatch 0，写一笔差分 12184px，热替换整张 PNG 差分 58909px 且平均色转向洋红[69.2,58.9,89.3]，植物读同图 true，toPNG 可导出",
      "project": "townscaper",
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
      "id": "1430224300003545091",
      "date": "2021-08-24",
      "text": "If you've been waiting for the Townscaper mesh exporter, you can now try it out in the public beta branch on Steam. There's a bunch of other subtle changes and optimizations too, but nothing major. Please do let me know if you run into any issues!",
      "topic": "tools",
      "status": "done",
      "where": "src/tools/objexport.js（sceneToOBJ/sceneParts/downloadSceneOBJ）· index.html#exportscene · src/world/app.js",
      "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。；【卡点·A 机制未做】第三方DCC及水/植被/材质尚未验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）；r223 核销残差：objexport.js 增 geometryData/bakeInstances/sceneToOBJ/sceneParts/downloadSceneOBJ（实例矩阵烘焙植被+逆转置法线+instanceColor/aColor逐实例色、mtllib+o/usemtl多对象+跨部顶点去重、缺法线补占位vn防v//vn索引错位——首版在Blender下暴露Invalid normal index已修）、index.html#exportscene+app.js 双文件真实下载；.mtl每对象近似Kd（town白留顶点色、water=片元0.55混色、植被=实例色均值）。mixed/quad下载obj+mtl（11.8/11.5MB）独立解析：town 10916/12185面逐坐标一致带RGB、water 2面贴y≈0、flowers 24/30、shrubs 13200/12000逐实例色；Blender 5.2.2后台导入两档0警告、对象/材质逐一对上（blender-import-r223.txt）。瀑布/特效/风摆/impostor替身不导出、mtl为近似Kd不冒充原作格式",
      "project": "townscaper",
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
      "id": "1427721874490933250",
      "date": "2021-08-17",
      "text": "Here's a very quick technical test. Though this one is continuously adding decals, so it looks a bit like claymation or line boil. Might be softer than what I'd be going for, but it was an easy style to throw together. And obviously you'd need some padding for the seams.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/decal-accum.js（DecalAtlas/stamp/fillPadding/seamBleed）· src/world/view-c07.js（DecalBoil）· index.html?c07=decalboil",
      "note": "188帧全核；核实为已实现缺验收：src/core/decal-accum.js 的 DecalAtlas 每帧 stamp 轴对齐方块（草顶/岩壁两张 chart，环面绕回）+ fillPadding 边距复制，src/world/view-c07.js 的 DecalBoil 每帧注入着色器并调 step；本轮补运行验收 tests/c07-skin-decal-browser.cjs —— 关贴花两帧差分 0，开贴花相邻帧 changed 20395/31149，每帧改图 499px，黄绿覆盖 3717→11862→18706 单调铺开，pad=2 且 seamBleed(0/1)=0",
      "project": "townscaper",
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
      "id": "1410697531424714752",
      "date": "2021-07-01",
      "text": "Townscaper is now on GoG! https:// gog.com/game/townscaper",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "45帧全核；GoG上架宣传片，一排彩色房子从左往右逐个长出并铺满岸线。纯营销素材，生长动画已由buildings.js覆盖",
      "project": "townscaper",
      "decodedFrames": 45,
      "reviewEvidence": "artifacts/coverage/1410697531424714752-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          44
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1401145625572425728",
      "date": "2021-06-05",
      "text": "Meshes in Townscaper are kept small to rely on Unity's dynamic mesh batching. This approach was not performant enough on the Switch though, so I wrote a mesh merger to do my own batching instead. It made a huge difference, something like tripling the rendering speed.",
      "topic": "tools",
      "status": "done",
      "where": "src/tools/merge-bench-c06.js · src/tools/mesh-wire-overlay.js · src/world/worldmesh.js · save-mesh.html",
      "note": "349帧全核（4张联系表逐格 + 原尺寸 0000/0036/0050/0348）；片内技术内容=整座城镇表面是一张合并后的三角网，作者用线框开关显示（0036-0078 白线叠在着色面上），三倍速度是 Switch 上的作者报告、片中无量具。核实原 note 的「卡点·E 环境不具备」为假标签：benchMerge 机制与 node 测试 r56 就在，缺的是页面入口——本轮给 save-mesh.html 补「合并对照」按钮（提交次数/逐帧耗时/整片重建耗时）与三角线框叠加层（view.setDebug('wire') 是把面挖空，与原片形制不同）。实测 mixed 17224 三角/35 块：小网格 270 次提交 → 1 次（270×），三角逐数一致；quad 21092 三角/36 块：330 → 1（330×）；8×8 视口 1.05-1.07×、全视口 0.99-1.01×（填充主导，不复现三倍）；6 点扫描得边际成本 5.1-6.4µs/提交；整片重建 59-72ms；线框叠加 34392 段（2.0×三角）、开/关差 8718/9065px、回位 0；0 console error。新测 tests/merge-bench-browser.cjs，回归 merge-bench-c06.mjs 与 save-mesh-browser.cjs 均 PASS",
      "project": "townscaper",
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
    },
    {
      "id": "1384958097542819845",
      "date": "2021-04-21",
      "text": "I wrote a script to trace topologically straight lines across the Townscaper grid. I think I'll use it for a thing in the gamepad controls and possibly some drag-to-paint mode.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/grid.js#traceStraightReport · src/ui/game-ui-c06.js#straightLineThrough/stepCursor/paintLine/轨迹层 · index.html?gameui=1&topoline=1 · grids.html?t=lines",
      "note": "679帧全核（7张联系表+原尺寸20/300/650+0300 4×裁切）；有向拓扑直线（格+出口边）追踪、闭环识别、多线同时显示三条都在主场景跑通——旧 note 的「游戏手柄/连刷仍未接入」核实为过期账（r56 就在 ui/game-ui-c06.js，只是没人从页面跑过）；本轮补三处真差距：线型由虚线改实线（原片是连续1px白线）、补历史轨迹层（原片一屏4–5条，本仓原只画1条，现留最近5条压暗）、线/轨迹对象命名+clearTraces 句柄；新测 tests/topoline-pad-drag-browser.cjs：闭环46格末点回起点出口边中点 gap 0、对边穿出 89732 对违例 0、折线转角 p50 8.2°/p90 21.8°、多线 9→5、像素开/关差 3545px 噪声 0、合成手柄十字键上走下退与 A 去抖（按住1.3s 只1次，+189 格/条）、真指针拖动连刷 +841 格且撤销 8 步回基线；回归 game-ui-c06.mjs / topoline-browser.cjs 全绿",
      "project": "townscaper",
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
      "id": "1371460793032716290",
      "date": "2021-03-15",
      "text": "I got it working within the duration of exactly 1 kid nap",
      "topic": "show",
      "status": "partial",
      "where": "src/core/palette.js · src/world/app.js · wall-palette.html",
      "note": "524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。；【卡点·A 机制未做】新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      }
    },
    {
      "id": "1371191380773629956",
      "date": "2021-03-14",
      "text": "Yeah this is gonna be pretty good",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "354帧全核；红粉色小岛转台+Photoshop打开House.png立面图集(窗/门/阶/砖/瓦@200%)→图集被清空→窗口缩走。纯美术资产，贴花机制本仓已在surface-decoration.js",
      "project": "townscaper",
      "decodedFrames": 354,
      "reviewEvidence": "artifacts/coverage/1371191380773629956-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          353
        ],
        "nativeRevisits": [
          90,
          130,
          175
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1370772056279805953",
      "date": "2021-03-13",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "180帧全核；Steam商店页滚动录屏(白色logo卡片+底部另一款深蓝城堡截图)，全片无游戏世界画面，发行物料，与原版实现无关",
      "project": "townscaper",
      "decodedFrames": 180,
      "reviewEvidence": "artifacts/coverage/1370772056279805953-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          179
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1344290848180203523",
      "date": "2020-12-30",
      "text": "A rare look at Townscapers sophisticated QA process",
      "topic": "show",
      "status": "partial",
      "where": "src/core/qa-replay.js · src/core/qa-monkey.js · qa-replay.html",
      "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。r222 残差核销——漏面与悬空支撑补断言：exposedWallFaces 枚举已建外露墙带（quad 362/mixed 332 带），auditSurfaceCoverage 每带3×3采样点靠墙平面投影覆盖（默认镇3258/2988点全满），auditUndersideSupport 按 underside() 同规则判拱/平底并核角点钢柱；接入 runWorldQA 逐步与 runMonkeyQA 核对点（qa-replay.js/qa-monkey.js 均不引 three），tests/qa-replay-r222.mjs 删整带/抽平底/抽钢柱/拆拱腹四反例全被抓且抛错后还原，浏览器双网格16步未覆盖0/失支撑0、页内手工拱+钢柱配置全过；vendor 逐字拷入 qa-replay.js+qa-monkey.js（import闭包自足）。残差=原片QA算法未公开，采样覆盖非流形/完整几何或视觉等价验收。；【卡点·C 算法未公开】原片QA算法与完整几何/视觉等价验收不可复现 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "townscaper",
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
      "id": "1338829205157646336",
      "date": "2020-12-15",
      "text": "Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection. (Many people have done this before me, so it's nothing new). My points are sorted vertically, which means radially, which makes the algorithm faster. Here's what it looks like:",
      "topic": "grid",
      "status": "done",
      "where": "src/sphere/stereo-insert-c06.js · src/sphere/planet-town.js · sphere-insert.html · planet.html?stage=tri",
      "note": "316帧全核（4张联系表+原尺寸回看，中心暗面3–4×放大确认是球体遮挡而非空洞）；球极投影按半径插入（超级三角→逐点→视图拉远）、抬回闭合球网、松弛每轮重三角化全在；本轮补极点鲁棒性 poleGuard（旧路径极点重合直接 RangeError、次北点 1e-4 rad 时 r=2.00e4 → 换极点后 6.53、收敛 3.06e3×，真旋转 det=+1、重合点合并），新测 tests/sphere-pole-guard.mjs + tests/sphere-insert-guard-browser.cjs（396面=2n−4、Euler 2、往返 1.17e-15、fat 档 394面 merged 1、0 error）",
      "project": "townscaper",
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
      "id": "1338825080844021760",
      "date": "2020-12-15",
      "text": "Apropos of nothing, a take on the ancient issue of generating nice triangulated spheres 1. Random points 2. Space out the points 3. Triangulate 4. Relax using the triangles Unclear if I'll use this for anything helpful sources: https:// redblobgames.com/x/1842-delauna y-voronoi-sphere/ … https:// newcastle.edu.au/__data/assets/ pdf_file/0017/22508/13_A-fast-algorithm-for-constructing-Delaunay-triangulations-in-the-plane.pdf …",
      "topic": "grid",
      "status": "done",
      "where": "src/sphere/planet.js · src/sphere/sphere-stages.js · planet.html?stages=1",
      "note": "395帧全核（4张联系表）；四阶段=随机点→散开→球极投影三角化（按半径揭示）→按三角形松弛并每轮重三角化，planet.js 真快照 + sphere-stages.js 时间轴 + relaxRetriangulate 改边账全在，?stages=1 立体段即原片那种半线框半点；本轮同批补极点鲁棒性（poleGuard），回归 sphere-stages-browser（faces 1796/closed/geometryError 0）、sphere-insert-c06、sphere-stages 全 PASS",
      "project": "townscaper",
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
      "id": "1332410042784641026",
      "date": "2020-11-27",
      "text": "How the infinite grid is relaxed and kept seamless: The grid is made of Patches. Adjacent triplets form Clusters. Clusters and Patches are relaxed independently. Each Vert is a triangular interpolation its representation in the closest 2 Clusters and the Patch wherein it sits.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js · grids.html（无限网格页：高亮 1 块 / 顶点圆点）",
      "note": "672帧全核；机制与片中一一对应（块松弛、块边界共享、顶点多表示插值），实测19块24簇翻折0、两侧表示差3.66e-15、拉伸最大1.83×。补齐片中调试视图缺的两件：顶点圆点（深色像素0→10582）与单块高亮（亮色240→7263）；仍缺：片中斜视3D的透视压缩、高亮块闪烁节奏、簇没有单独上色",
      "project": "townscaper",
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
      "id": "1331905048801144836",
      "date": "2020-11-26",
      "text": "Townscaper now has lighthouses! This pattern required more code rewrite than seems reasonable. Luckily, I got some slight optimization out of it too. https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "build",
      "status": "done",
      "where": "src/build/lighthouse.js（refresh 几何：lantern / roof / deck / railpost）· index.html 场景（灯塔开关）",
      "note": "347帧全核；规则（海边、≥5层、每邻格矮2层以上）本来就对，外形原来全错：圆柱灯室+暗红圆锥+圆环栏杆。改成方形灯室（1.12×0.34×1.12，x/z差0）、5扇玻璃白棂、方形挑台+红唇+72根立杆、4段橙红四坡顶+顶尖；仍缺：塔身红白分层不保证、灯室玻璃偏白、片中没演示夜间光束故未复核",
      "project": "townscaper",
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
    },
    {
      "id": "1313841094069817344",
      "date": "2020-10-07",
      "text": "Because I'm quite proud of my lighting (and because Townscaper is basically just a tech demo anyway) I added texture-only and light-only render modes",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（uTextureOnly / lightonly / textureonly）· src/ui/environment-panel.js",
      "note": "268帧全核；原来只有 lightonly 且无任何面板入口，texture-only 完全缺。补 uTextureOnly（outgoingLight=albedo，短路光照）+ 两个模式互斥 + 场景面板三开关；实测只看贴图时主体掩码内只剩13.9%随投影变、只看光照仍有94.95%（影子在）且顶点色关掉、主体饱和度0.4244→0.2083；仍缺：树/海鸥/水面接收层不跟白模，灯塔灯室也不变白",
      "project": "townscaper",
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
      "id": "1313840428685447170",
      "date": "2020-10-07",
      "text": "I added some sunlight (with shadows) and a gizmo to control it",
      "topic": "light",
      "status": "done",
      "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
      "note": "501帧全核验：二维太阳盘与滑条改变光照，夜间窗户亮，457附近恢复白天。保留原有日夜/太阳方位，补方位+高度控制共享真实View及水面三场阴影；不是复制原界面或完整地平线日照模拟。；【第62轮 A 类收敛】残差=原界面与完整地平线日照，二维太阳盘+方位高度控制机制等价（含水面三场阴影），判为 done",
      "project": "townscaper",
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
      "id": "1313837640366596096",
      "date": "2020-10-07",
      "text": "I just pushed an update to Townscaper. You can now build flying towns (if you find any of the perfect loops I've scattered across the grid) https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "grid",
      "status": "done",
      "where": "src/world/flying-town-c06.js（hullSkin/legBraces/propSlots + attachFlyingTown）· src/core/loop-lift.js · index.html?flying=1",
      "note": "315帧全核（4张联系表+3张3倍裁切）；完美环判定 + 环内整列体素（地形116建筑+400岩石）一起抬升=建筑随岛抬升，环内最低实心层=4=lift+1、1–3层全空、环外仍贴地；船壳按原片重做形制：黄鼓边带+红舷缘+99舷窗，外沿28个黄短舱各4片白桨叶（112片），腿改锥形柱+每腿2条斜撑（56腿112撑）+放大涟漪，船壳下56榀桁架摇篮；像素A/B关桨叶白像素2103→503、噪声0px、差分11670px；片中无飞行操控镜头（纯转台），不计缺口；板缝/铆钉与抬升侧壁厚度属造型差",
      "project": "townscaper",
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
      "id": "1310503825510367232",
      "date": "2020-09-28",
      "text": "Ok, I tried the mixed perspective. Note how houses further away are smaller, yet the vertical lines stay straight and parallel. It's definitely not a good fit for Townscaper, but might work well if I make another Bad North-ish game with a hearty mix of 3D meshes and billboards.",
      "topic": "build",
      "status": "done",
      "where": "src/core/mixed-perspective.js · src/world/view-mixed-persp.js · src/world/view.js:311,1270 · index.html?mixedPersp=1",
      "note": "200帧全核（sheet-00/01 全看+0060 原尺寸）；片内单一投影：绕岛旋转，塔身竖棱逐帧平行、近处房子比远处大。旧note的「主视图view.js未接、pick/倒影未同步」核实为过期账（第46次同型）：mixed-perspective.js 的 withVerticalParallel + view-mixed-persp.js 的投影替换/深度行/fixRay 早接 ?mixedPersp=、倒影同相机自动同步，缺的只是主场景运行验收。新测 tests/mixed-persp-main-browser.cjs 18项全ok：k=1 12根世界竖柱横移 5.6e-14px（k=0 对照 27.66px、11/12根>1px）、同1层高柱四段距离 40.6→37.87→34.43→30.96px 逐段变小（−23.7%）、镜像竖线横移0、拾取 24/24 命中实心格且 k=1 与 k=0 同为 14/24 未掉档、fixRay 关档 24/24 改判、像素 k0→k1 差分 53256/172800 噪声 0/0、不带参数页 mixedPersp=null 且竖线横移与 k=0 逐位相同。另把 fixRay 起点改到线上离相机最近点（原 z=-1 反投影点离眼点 8.36 单位，可能落在近处柱内），本夹具 diff 0 属稳健性修补。回归 mixed-perspective-browser PASS",
      "project": "townscaper",
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
      "id": "1305951750638231552",
      "date": "2020-09-15",
      "text": "To soften it up a bit, I'm trying out a penumbra approach where I draw the shadow thrice, once normal, once pulled in slightly and once with big voxels. I think I like it. (here, the shadow is shown darker than it should be to demonstrate the effect)",
      "topic": "light",
      "status": "done",
      "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/penumbra-terrain.js · src/world/view.js · penumbra.html",
      "note": "521帧全核验：塔楼编辑/旋转与长影，409起RGB阴影纹理通道检查。本轮按残差补全两条。a) 洞/悬挑/形变表面：水面层仍是2.5D顶面投影，另接 bakeVoxelPenumbra 体素接收面（PenumbraTerrain，?fx=penumbra3d 或 postExtras.set）——每个下实上空的体素是接收面，悬挑/拱洞下地面与悬挑顶面分列接收者，形变顶面按最近体素层采样并替代PCF接收；真实场景双网格 mixed/quad 6876/5050 接收者、多接收者柱 12/10，转太阳重烘、关闭还原、dispose 材质补丁+纹理幂等通过（tests/penumbra3d-browser.cjs）。b) 半影宽度按裁判 REACode/src/penumbra.js 参数化：权重 [.8,.34,.44]、内收 +0.7 体素高度、3×均值粗格、半影带 .10–.50 封顶12；normal/pulled 与裁判四方位逐格一致，bigSlopeScale=1/3 时带宽对齐 ±8%（带格数 ±10%、alpha 平均差 <1%）。裁判粗格未缩放坡率的 3× 长影仍判尺度差不照抄，默认 bigSlopeScale=1 保世界尺度。如实：侧墙半影仍缺（N·L 明暗负责）、形变面 ±L/2 采样近似、原片演示故意加深故只做到机制口径对齐、无逐像素宽度对照。",
      "project": "townscaper",
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
      "id": "1305948413872267265",
      "date": "2020-09-15",
      "text": "I'm exploring cast shadows. They have to be quite subtle and soft to fit the style. It does seems like they should be fast enough for mobile too if I only update them on command after a regeneration.",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（#setupLights / requestShadowUpdate / render 阴影节奏）· index.html 环境面板「柔和投影」",
      "note": "715帧全核；投影软硬与更新时机都对齐了：PCFSoft 的 shader 忽略 shadow.radius（实测 radius 1→8 过渡像素 100→100 不变），改 PCFShadowMap 后 90→541；autoUpdate=false + requestShadowUpdate，平移网格不叫就留旧影、叫了才追上；仍缺：暗部幅度比片中亮一档、无 less-contrast 档、水面影子另走 ShadowMaterial",
      "project": "townscaper",
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
      "id": "1302686201401442309",
      "date": "2020-09-06",
      "text": "A smoothing and inversion bug I came across while playing with the grid generation. The inverted patches collapse into a mess, but are stretched out when interpolating to fit with their neighbors. And the poor non-inverted patches need to stretch real far to pick up the slack",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js(relaxGroup/createInfiniteStream/verify) · src/core/grid.js(relaxPolygons areaPull) · grids.html?t=infinite",
      "note": "241帧全核（3张联系表 + 40/50/120 原尺寸）；原片是bug现场直播：翻折块塌成深色皱褶、没翻折的邻格被拉长去补缺口，两个症状都在画面上。上一轮唯一缺口（把面积拉回点阵的松弛权重）本轮补上：grid.js relaxPolygons 加 areaPull —— 目标半径朝「与本格原始点阵面积相等的正 n 边形」拉（R_want=√(2A_raw/(n·sin(2π/n)))），外圈仍钉住故接缝不变；buildInfinite 默认 0.85（areaPull:0 逐位复现旧行为），bugPatches 演示块不施加，createInfiniteStream 同口径透传（漏传会让流式与窗口版差 0.0516，该回归当场报错、已修）；verify() 报告带上 areaPull，grids.html?t=infinite 面板可读。实测：收缩格 27→0、最小收缩比 0.450→0.640、最大拉伸 1.83→1.52、翻折 0、接缝 4e-15、块内面积守恒（patch 档）1e-15、blend 插值漂移 1.1%-3.1%。新测 tests/infinite-area-pull.mjs PASS（oldWorst 0.45→newWorst 0.64、streamMaxDiff 4.6e-16）；回归 infinite-verify / infinite-window / infinite-stream / infinite-c06 / infinite-verify-browser / infinite-grid-view-browser 全 PASS。页面读数 3946 格 / 翻折 0 / 1.52× / 0.64× / 378 组对照最大差 4.0e-15。口径：原片是bug现场，本仓不复刻该bug（bugPatches 默认空仅作演示），复刻的是不出该bug的管线+把两种症状都量出来的验收",
      "project": "townscaper",
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
      "id": "1301816247479345152",
      "date": "2020-09-04",
      "text": "Some are asking for the option to use regular grids. Now, that's (obviously) against the Townscaper design philosophy. However, I am thinking of sprinkling the current generated grid with random patches of hand crafted grid, like little gems to find and build your tempels upon",
      "topic": "grid",
      "status": "done",
      "where": "src/core/radial-patch.js#insertTemplatePatch（环带厚度均分 + ringSpacing/minRingRadius/holeRingRadius 读数） · gridpatch.html（原片口径深链 r2.6/hole.6/rings5 + 外环带/过渡带分开报）",
      "note": "324帧全核（4张联系表 + 0106/0135 原尺寸 2.2× 复核）；生成网格→局部替换成手制规则模板这条主线 r55/r142 已在（inserRadialPatch/insertTemplatePatch/insertRadialPatches/migrateWorldToPatch + ?gems=N）；r143 收掉最后一条：环院环带按 s=(minR−holeR)/(rings+2) 均分整个 boundary→hole 厚度（旧式把 rings 条带挤进 45% 再被拉链+洞环切成两条，每条径向厚 0.05 vs 弦长 0.45），courtyard 格长宽比中位 0.257→0.595、细长格 151/197→32/268、外环带 230 格只 9 个（全在星形边界拐角）、洞内原格几何逐点未动；试过 r142 建议的严格等角目标环→不规则边界第一圈翻折（2 配置直接拒绝）且只抬到 0.620，已回退并记录；新测 gridpatch-rings-browser.cjs ALL PASS（五配置几何 + 主场景 ?gems=0|4 像素 A/B 563710px + 0 error）+ 4 个 node 回归 PASS",
      "project": "townscaper",
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
    },
    {
      "id": "1298689301488775169",
      "date": "2020-08-26",
      "text": "Flat texture, shaded, lighting only, and my AO baking mesh. I'm thinking of adding some little widgets like this to give people a peek at how things work. Perhaps hide them behind a break-glass-to-push-button widget.",
      "topic": "light",
      "status": "done",
      "where": "src/world/ao-mesh-debug.js + src/world/view.js setDebug('aomesh') · environment-panel 能力面板",
      "note": "544帧六张联系表全核；平涂/着色/只看光照三种原有，本轮补第四种 AO 烘焙网格（buildBakeShellGeometry 逐层体素壳 608面/1216三角、面板可勾）；缺半透明层叠画法、壳不含建筑体积、原片四小部件界面未复刻；【第62轮 A 类收敛】残差=半透明层叠画法与四小部件界面，AO 烘焙壳机制等价（608 面/1216 三角），判为 done",
      "project": "townscaper",
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
      "id": "1290997501332525056",
      "date": "2020-08-05",
      "text": "#Townscaper is now properly released on Mac on Steam! To celebrate the occasion, I added some garden paths. Go get it: https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "life",
      "status": "done",
      "where": "src/build/garden-plots-c07.js · src/build/buildings.js:171,435 · src/world/view-c07.js(?c07=gardenplots) · garden.html",
      "note": "187帧全核；门优先窄石板小径 / 中心圆台 + 装饰 / 草地块石沿三件都在 build/garden-plots-c07.js（world.gardenPlots 默认关，?c07=gardenplots 开），本轮补 build 侧 gardenC07 只读台账 + 浏览器验收：门格 1/1 落在小径上且各有石板条出到门外、从 hub 走满 3/3 小径格、条宽 0.36·rc、草地块 2 块 9 格；关开关退回 PCA 端点方案 7 格（4 格只在旧方案），噪声 0、差分 814px；混合网格无门院子回退 8 格不消失。中心装饰是石台 + 圆冠灌木，原片石球未做",
      "project": "townscaper",
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
      },
      "page": "garden.html"
    },
    {
      "id": "1279107097108635649",
      "date": "2020-07-03",
      "text": "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them.",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js（partSigs/sigColorFor/plinth/buildRoofs/moduleParts） · src/build/module-catalog-r56.js（buildPiece debugParts） · module-catalog-r56.html(?parts=0)",
      "note": "256帧全核（3张联系表+0050/0105/0130/0160/0181原尺寸）；旧note两条核实：「没有零件目录页」为过期账（module-catalog-r56.html r56就在），「只给墙身上色」为真缺口→本轮补部位分色：buildings.js 新增 partSigs{wall,roof,base}+sigColorFor(kind,sig)（SALT 11/977/613，同签名同色），plinth() 基座四段石带+三道压顶用 base 族色，buildRoofs/skeletonRegionRoof 屋顶用 roof 族色、山墙归墙族，buildStats 增 moduleParts{wall 28/roof 16/base 20, quads roof 79/base 798}；module-catalog-r56.js buildPiece 透传 debugParts；页面 ?parts=0 关档 + window.r56cat 增 partsOn/scenePartColors/piecePartColors。默认档零改动（debugModules=false 时 dbg=null），顶点逐字节相同。新测 tests/module-parts-color.mjs + tests/module-catalog-parts-browser.cjs 12项（27块/4族/1386三角、sigMismatch 0、同状态截图 0px、?parts=0 roof/base 归0 而 wall 27、开/关差分 5369px、0 错误）；回归 module-catalog-r56/hip-roof/house-kit/building-components/voxel-ghost-roof-props 全 PASS。无剩余机制缺口：545 块与原作单位不同（本仓按格×层：27 种/理论 60 quad·88 mixed）已在模块头注明不冒充；白细边按片保持不上色。",
      "project": "townscaper",
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
      "id": "1277554535297236994",
      "date": "2020-06-29",
      "text": "Ok I'm gonna try something that probably wont work: if you wanna help me translate Townscaper to your language, I simply made the localization spreadsheet public: https:// docs.google.com/spreadsheets/d /1sKbLTWhlpa3CcpOKBnACkJ1kl7_Bi2HvW78gaEQUo1c/edit?usp=sharing …",
      "topic": "tools",
      "status": "ref",
      "where": "",
      "note": "171帧全核；是一条窄条录屏的语言胶囊控件：左右箭头循环切换 English/Italiano/Deutsch/Español/日本語/Pyccкий/简体中文/繁體中文/한국어，只有标签文字替换，无其他UI与构建动作；本仓ui层无i18n且实验页文案非玩家可见，不实现",
      "project": "townscaper",
      "decodedFrames": 171,
      "reviewEvidence": "artifacts/coverage/1277554535297236994-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          170
        ],
        "nativeRevisits": [
          1,
          40
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1275089608758484992",
      "date": "2020-06-22",
      "text": "It has not escaped some of you that I have yet to release Townscaper. I have an important (secret) business thing to consider, and instead of making a decision I've been making church doors and and ladders. (but do wishlist though: https:// steamcommunity.com/app/1291340 )",
      "topic": "build",
      "status": "done",
      "where": "src/build/church-niche-r56.js · src/build/buildings.js(wallStrip/churchNiches) · openings-r56.html?flags=churchDoors&focus=church · src/core/ladder-profile.js",
      "note": "369帧全核（4张联系表 + 0120/0160/0320 三帧3×放大）；原文两件事都拍到了：教堂门=跨两层高拱龛、竖梯=长竖梯沿墙上高脚楼。上一轮note的四条仍缺逐条核实全已实现——church-niche-r56.js 由 buildings.js:330 接线、两层墙体走 wallStrip(hole) 挖洞、后墙另色 #5b86c4、洞前两级台阶落 L+0.006、页面 openings-r56.html?flags=churchDoors&focus=church。本轮补的是形制与量具：后墙开口按 3× 放大帧从「小拱门+圆窗」改成「底部双开门+半圆扇窗 / 中部四格方窗 / 顶部菱形窗」三处，并返回 backWall/steps 可观测量。验收：openings-c05c-r56.mjs PASS（niches 4/121 openings）；新测 tests/church-niche-browser.cjs PASS（跨两层 0.56→1.42 深0.12、三处开口不重叠、台阶2级 base=L+.006、蓝色后墙像素 34505→关档 0、差分 72256 vs 噪声底 2336、0 console error）。口径：0300+ 那道「很高的尖拱」放大后是高脚房的支撑腿、不是更高的龛，本片龛就是跨两层；龛口石框本仓比原片多一圈，属与本仓门窗共用的风格语言、不计缺口",
      "project": "townscaper",
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
      "id": "1273520600221433857",
      "date": "2020-06-18",
      "text": "Butterflies fly quite different from birds. Mine loosely orbit a potential landing spot, and drift by randomly switching that spot. Additional world space noise adds variability but also coherence (without boiding) (as always, please wishlist: https:// store.steampowered.com/app/1291340/To wnscaper/ … )",
      "topic": "life",
      "status": "done",
      "where": "src/life/decor.js · src/world/view.js",
      "note": "937帧全核；30s绕行院子，白蝶松散绕落点转小圈、隔几秒飘到另一丛花/灌木上方，非鸟群直线编队。代码逐条对齐原文：角速度1.6rad/s、rad 0.12–0.27、3–9s换点、世界空间噪声(邻近同向)、无boids。本轮修落点来源与换点重选自身两处bug；运行时实测mean 0.095–0.285≈rad、首换2.8–8.4s、间隔3.1–7.6s、同向系数0.88–0.98",
      "project": "townscaper",
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
      "id": "1270725616430530566",
      "date": "2020-06-10",
      "text": "You all keep pestering me to release this when I hadn't even added butterflies yet. But do indeed go wishlist: https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "life",
      "status": "done",
      "where": "src/life/decor.js · src/world/view.js（落点来源）",
      "note": "623帧全核；后院环形排屋+草坪，白蝴蝶在灌木/花簇上方悬停平移、会换位置，已6倍放大确认扇翅与竖直位移。本轮修落点来源：原来只取花点(城镇场景仅1个落点，5只蝶全绕同一点)，补后院格心后17只蝶多落点；另修换点可能重选当前落点。运行时实测绕圈/换点/图层开关全过",
      "project": "townscaper",
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
      "id": "1260586697538113537",
      "date": "2020-05-13",
      "text": "Making a trailer is a ton of work. But the good news is I can use the undo/redo stack for snappier and more directed building footage.",
      "topic": "build",
      "status": "partial",
      "where": "src/core/snapshot-replay.js · src/core/edit-fx-schedule.js · src/world/view.js · src/world/worldmesh.js · src/world/app.js",
      "note": "167帧全核验（历轮sheet/裁切证据沿用）。「动作特效」可做的部分本轮收口：撤销/重做/历史回放本就走 worldMesh.edits 体素差分→effects.onEdit（弹性弹出/落水水花/拆除灰尘）+sound.onEdit 音效（r56已验）；本轮补三处真差距——①单笔快照超40格时 edits 被静默吞掉：worldmesh.editFxLimit 可配，回放期 app.js 放宽到600并 finally 复原；②一帧多格全堆同一时刻：新增 core/edit-fx-schedule.js 变心径向波确定序错拍（快照只有整笔颗粒度、笔内拖动顺序不可恢复→径向波近似原片依次生长，0.045s间距、maxSpan1.4s压缩）+view.editFxQueue 到期才喂 effects/sound；③无可关档：setDebug('editfx')/?editfx=0 整层丢帧。新测 tests/edit-fx-schedule.mjs：径向序/时序界/40吞·600全发/回放60弹出·60水花·30灰尘·finally恢复最终态；snapshot-replay-fx-r56.mjs 改断新接线后复绿。；【卡点·B 美术资产】导演镜头轨迹/剪辑节奏与逐动作元数据原片未公开（原片为固定临水镜头） → 永久卡点，需新证据再立项",
      "project": "townscaper",
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
      "id": "1259838941299183619",
      "date": "2020-05-11",
      "text": "In code, these are called \"Italian Wires\"",
      "topic": "life",
      "status": "done",
      "where": "src/core/wire-route.js → src/life/decor.js",
      "note": "316帧核验：绳线上有白色衣物、不同高度连接。补精确墙面裁切、高共用墙面附着、逐层solid检查下垂/衣物/摆幅包络，保留彩旗并加简化白衣物；双网格2/3连接、刷新释放/开关通过。不是严格悬链线/物理布料，形变屋顶精确碰撞、同楼对多高度绳线待补。",
      "project": "townscaper",
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
      "id": "1258421104756097029",
      "date": "2020-05-07",
      "text": "We were long overdue for some splashier splashes",
      "topic": "water",
      "status": "done",
      "where": "src/life/splash-c07.js · src/life/effects.js · index.html（默认档，?splash=plain 对照）",
      "note": "436帧全核（历史 5 张联系表 + 本轮白像素峰扫全片 + 004–066/376–422 两段裁切逐格 + 0384 4× 原尺寸）；水花=冠状竖直水帘10根(0.35s到顶/0.88s塌落)+3圈泡沫环(delays 0/0.22/0.5, 3.2s仍3圈, 3.9s首圈到寿)+10–12颗飞沫。旧note『缺冠状竖条与多环长寿命』核实为过期账(splash-c07 r56 已有, 只挂在 ?c07=splash)；本轮把默认改到冠状档(?splash=plain 对照)+补探针, 新测 tests/splash-crown-browser.cjs：水帘窗 723→362→0→0、0.34s h=0.3243、3.2s r=0.638/0.726/0.809 alpha=0.21/0.18/0.22、飞沫11、对照档3.2s差分0、噪声0、0 error",
      "project": "townscaper",
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
      "id": "1258005604066627586",
      "date": "2020-05-06",
      "text": "Here's that but in Townscaper. And Triangular.",
      "topic": "grid",
      "status": "ref",
      "where": "",
      "note": "235帧全核；珊瑚色灯塔塔楼小岛缓慢转台，鼠标指针静止、无编辑动作无UI，属展示片；三角胞元拓扑本仓已有(grid.buildTriangularSubgrid、trigraph)，缺的是三角胞元建筑模板库(美术资产)",
      "project": "townscaper",
      "decodedFrames": 235,
      "reviewEvidence": "artifacts/coverage/1258005604066627586-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          234
        ],
        "nativeRevisits": [
          80,
          180
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1257213678056857600",
      "date": "2020-05-04",
      "text": "Alrighty. First 20 people to reply gets a b e t a k e y *steam on windows for now",
      "topic": "build",
      "status": "done",
      "where": "src/build/steel-r56.js · build-r56.html?scene=steel&flags=steelFrame",
      "note": "296帧全核；三条缺口均落地：①落点=共享角格最高实心层（不穿邻栋）②曲柄内倾腿（脚点水平内收 0.1037 到支撑格心、脚点 y=land·L、膝点+红垫块）③高腿分段（8 道系杆按簇约束求解、间隔≥2 不连层、18 个接头、Y 形短斜撑）。node tests/steel-frame-r56.mjs PASS（identical 8 / cranks 12 / ties 13）+ 新增 tests/steel-frame-browser.cjs 全过；build-r56.html?scene=steel 两视角截图已 ViewImage 核过。残差：原版 378 模块 WFC 驱动落点，本仓为本地离散规则（等价，不逐模块复原）。旧 where 的 architecture.html 是文档页、不承载钢架，已改指 steel-r56.js",
      "project": "townscaper",
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
      "id": "1246074663546916873",
      "date": "2020-04-03",
      "text": "The props now animate when they appear and disappear. This was much trickier than I anticipated.",
      "topic": "build",
      "status": "done",
      "where": "src/core/prop-anim.js · src/world/prop-anim-layer.js · index.html?scene=town&yardanim=1",
      "note": "306帧全核（4张联系表+原尺寸0223/0224/0225/0260/0261/0265）；r190记的'代码未写'是过期账（prop-anim.js/prop-anim-layer.js r55/r56 就落了稳定key+保留消失几何+逐道具缩放）；真缺口是曲线与运行验收 → 本轮加 PROP_TIMING（出现1帧到1.372×、0.121s回落；消失1帧塌陷、槽位保3帧）+ appearAt/vanishAt/timelineScale，PropLifecycle 默认 clip 档；tests/prop-anim-clip-timing.mjs + tests/prop-anim-clip-browser.cjs（1.372→1、半帧0.75→0、槽位27→-1、差分418px、噪声0）全过；错峰为本仓扩展（片内整组同帧，证不出）",
      "project": "townscaper",
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
      "id": "1244892370392489989",
      "date": "2020-03-31",
      "text": "Better Birdies: 🐦 More bird shaped 🐦 Only has outlines when sitting 🐦 Shuffle about more 🐦 Has reflections 🐦 Flowier flight",
      "topic": "water",
      "status": "done",
      "where": "src/life/birds.js（sittingGeometry / flyGeometry / outlineMaterial / mirror）· index.html 海鸥开关",
      "note": "772帧全核（8张联系表 + 原尺寸0040/0140 + 1.8×裁剪）；五条全中：86只/104栖位、描边只有1个mesh且共用坐姿instanceMatrix（飞鸟无描边）、坐姿266步最大挪动0.058、飞行maxStep0.028/maxTurn0.3°/0跳变、倒影62=坐姿62；差在坐姿偏圆胖短喙、起飞缺先跳再拉、无独立鸟倒影强度",
      "project": "townscaper",
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
      "id": "1243228419162341379",
      "date": "2020-03-26",
      "text": "Some moody clouds",
      "topic": "life",
      "status": "done",
      "where": "src/light/cloud-shadow.js · src/world/cloud-deck-layer.js · src/world/view.js(#setupWater/reflectMaterial) · src/water/reflection.js · src/life/vegetation.js(swayMaterial) · clouds.html",
      "note": "489帧全核（r55 全片 + r109/r112 复看）；云影四个接收端全在位：地形/建筑主材质、水面、植被（本轮补证：压顶夹具 y=+6/w=80 → quad 11838/11919px、mixed 12300/12470px 变暗，tone 0.333/0.327）、倒影（本轮新接 reflection.js 注入 CLOUD_SHADOW_GLSL + -w.y 还原取样高度 → 19223/20158px，tone 0.175）；三处 restore 均 0，反向对照（云片放回 deck 高度 y=30/w=90）变暗 0，证明 r109 的「植被差分 0」是夹具口径错不是机制缺；单位影子属遮挡贴片且本片无单位，不作缺口；原作逐层烘焙 vs 本仓射线求交为已声明近似。",
      "project": "townscaper",
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
      "id": "1242824460325052417",
      "date": "2020-03-25",
      "text": "Finally making some proper UI. Turns out you can make a boring list of buttons playful by just tilting them slightly.",
      "topic": "tools",
      "status": "done",
      "where": "src/ui/game-ui-c06.js · src/core/playful-layout.js · index.html?gameui=1",
      "note": "383帧全核（4张联系表+3张原尺寸）；面板开合逐帧判为0–77关/78–332开/333–358关/359–382开；真形制差三处已按片内实测改：主行动60/次级36/双联74×65/Grid45+面板宽32.6vw、颜色改按功能固定四色、补Undo/Redo深度数字与Grid第二枚圆；新测playful-menu-main-browser 30项全PASS（差分72681px 100%在面板内）",
      "project": "townscaper",
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
      "id": "1241096929490149376",
      "date": "2020-03-20",
      "text": "It has been brought to my attention that not all of you are familiar with my every-other-pixel-is-a-line tech. I make the UVs speed past every 2nd pixel before sampling. It's core to my art style and what lets me get away with one 128² texture and crisp antialiasing up close.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/texel-skip.js · src/core/town-skin.js · src/world/town-skin-layer.js · textures.html",
      "note": "302帧全核（sheet-00..03 + 原尺寸 0100/0200 与 3× 裁切）；原文=隔像素一条线：UV 跳过每隔一个像素，一张 128² 图集换 1px 抗锯齿线。核实：旧 note 两条『仍缺』一半是过期账 —— 建筑墙格+右下 32² 植物角共用同一张图集、缩小走色格内 box mip 链，town-skin.js/town-skin-layer.js r56 已实现（c07-skin-decal-browser 一直在跑）；真缺口是本片自己的页面入口 textures.html『隔像素一条线』页签只吃玩具贴图、没有 mip 档与量具。本轮把该页签改成真实图集三列（最近邻 / 仅重映射 / +mip，texLevel 与 c07Level 同口径）+ window.texelSkip 读回量具 + URL 钉档，新测 tests/texel-skip-atlas-browser.cjs 全 PASS：图集 60 槽+植物角 std 0.2495、第4级 mip vs 盒滤波误差 1.06 级；放大 mip 开关四项逐项相同、线宽 12px→2px；缩小 mag .35 mad .01136→.00564 暗缝 .284→0、mag .12 .00631→0；主场景 36555 顶点全换肤/mismatch 0/植被共用同图/A-B 6595px 回位 0",
      "project": "townscaper",
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
      "id": "1241046107125399552",
      "date": "2020-03-20",
      "text": "I moved my plants to a 32² corner on the 128² texture I'm using for everything else. Plus they now also use the every-other-pixel-is-a-line tech, so everything is crisp and nice up close",
      "topic": "life",
      "status": "done",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/vegetation.js · tests/leaf-atlas-shared.mjs · tests/leaf-atlas-shared-browser.cjs",
      "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。本轮收口「真实128²/32²保留区 + 连续texel采样 + 全场景共图」：①leaf-atlas.js 布局/叶纹单源化——改从 core/town-skin.js 引 PLANT_RECT(96,96,32,32)/writePlantCorner，独立叶图集与全城 TownColor 图集角内逐字节一致（裁判：REACode src/texelsnap.js bakeAtlas x0=y0=size−corner=96）；②连续texel采样——skipTexel 为分段连续 UV 重映射+双线性（非最近邻点采样），新增 CPU 镜像 leafPatternCPU 数值断言：texel 中心精确回读、相邻中心中点取混合、ε 扰动 ε 变化、fw≥2 均值淡出；③进程级共享单例 sharedLeafAtlas()/sharedLeafTexture()——所有 Vegetation 实例与共享灌木/树冠材质绑同一个 DataTexture 对象（不再是每次 makeLeafSurface 各建一张）；④全场景共图——TownSkinLayer 开时 leafSurface.uniform 指到全城同一张纹理对象，浏览器实测 boundIsSkinTex/角外alpha=255/角内同motif/关闭还原。Node tests/leaf-atlas-shared.mjs + tests/leaf-atlas.mjs 与浏览器 tests/leaf-atlas-shared-browser.cjs 全 PASS（skinned 28752 顶点/60槽/mismatch 0）。残差（程序近似与缺失原资产分开记录）：角内叶纹为程序近似 motif，原作手绘植物素材与全部植物种类未迁（卡点·B 美术资产）。",
      "project": "townscaper",
      "page": "leaf-surface.html",
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
      "id": "1239901715266244609",
      "date": "2020-03-17",
      "text": "If you're hunkered down hiding from the virus (as you should be) and need something to do, I'll be shameless enough to plug our last project, the minimalist strategy game Bad North. Available on PC, Mac, IOs, Android, Switch, PS4, Xbox. @BadNorthGame https:// store.steampowered.com/app/688420/Bad _North_Jotunn_Edition/ …",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "1113帧全核（12张联系表全覆盖）；原文是给旧作Bad North打广告，画面为其实机：维京长船靠岸→散兵上岸→蓝/黄单位列阵拦截→减员，左上小地图、蓝旗兵种图标、橙色移动目的箭头俱在；这些机制仓内 src/badnorth/（landing-plan/battle/banner/combat-profile）已有承载，非本仓Townscaper缺口",
      "project": "townscaper",
      "decodedFrames": 1113,
      "reviewEvidence": "artifacts/coverage/1239901715266244609-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          1112
        ],
        "nativeRevisits": [
          320,
          500,
          600
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1238474550511308800",
      "date": "2020-03-13",
      "text": "I needed some more greenery, so now if you build an enclosed area it becomes a backyard!",
      "topic": "build",
      "status": "partial",
      "where": "src/core/courtyards.js · src/build/buildings.js · garden.html",
      "note": "202帧全核验。共享classifyCourtyards按地面上实际第2层实心判封边；本轮补两件可验残差：①开口按真实墙层分型——ground-opening（街/水/岩整列空）与 wall-layer-gap（第2层缺、更高层仍有实心=桥/悬空屋顶跨过，bridge标记+openLayers逐层账），上层桥跨缺口不封院；②lowWalls选项——高度<1层的矮墙边只分区不封院，封闭组件内按给定矮墙边重切连通子区写入subregions+lowWallEdges。双网格（quad/mixed）封闭→桥跨开口→矮墙分区→重封闭全过。规则为本地离散近似；仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。；【卡点·C 算法未公开】仍未复现：原作沿小径自动布矮墙的精确选线/半圆拱细节（近似在yard-r56 planYardWalls）、形变边界与全部植物。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "townscaper",
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
      "id": "1237305125070426112",
      "date": "2020-03-10",
      "text": "Obviously, a big benefit of this is that with white finally in my palette, I can properly show off the colored \"bounce\" \"light\" of my custom realtime \"lighting\" system.",
      "topic": "light",
      "status": "done",
      "where": "src/light/bake.js（occ/cr/cg/cb 模糊 + bounce 0.42）· src/world/worldmesh.js 分块烘焙",
      "note": "258帧全核（3张联系表 + 原尺寸0040/0200 + 2.6×裁剪）；彩色反弹等价：白墙同面靠蓝屋R-B=-20.8、中央+17.6、靠红屋+4.6；验收红/蓝对照 warmJump+0.0373 / coolJump-0.0605；差在反弹是全向模糊平均、贴墙边角不如片中重，且只有1次反弹",
      "project": "townscaper",
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
      "id": "1237293295887319040",
      "date": "2020-03-10",
      "text": "More colors! I had been assuming the combinatorics would go crazy and that all my assumptions would break if I introduced more colors, but I was wrong and it was fine.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/palette.js · src/world/app.js（buildPalette / #palettestyle）· learn/panel",
      "note": "260帧全核（3张联系表 + 原尺寸0040/0120 + 6×裁色格）；色槽索引机制等价：UI 15格互不相同、三套预设各15、15槽依次刷墙不串色、换预设GPU 31385像素变；片中竖列12格可滚动，本仓15格竖排无滚动，选中态为高亮非白圈",
      "project": "townscaper",
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
      "id": "1215644531221311488",
      "date": "2020-01-10",
      "text": "The technical solution is almost the same as in Bad North. One big difference is that the bright colors wouldn't let me get a way with a monochrome reflection, so I had to figure out this somewhat abstract flat colored mid point. (Also, the wave skirt stretches further this time)",
      "topic": "water",
      "status": "done",
      "where": "src/water/planar-reflection.js · src/water/shore.js#buildShore(skirtWidth) · src/world/view.js",
      "note": "270帧全核；同一条RTT平面反射（倒影层quad 11281px/镜像命中92.1%/真水面98.5%），另加 shore.js#skirtWidth 可配（1→1.6 外扩精确1.6×）+ view.setSkirtWidth/?skirtWidth；r180裙带亮缝账回归PASS",
      "project": "townscaper",
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
      "id": "1215642481162887168",
      "date": "2020-01-10",
      "text": "Ok I went ahead and put this whole project on water. Long time fans of the show know this was inevitable.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
      "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。2026-11-25残差核账（tests/water-town.mjs 四场景锁定）：水上码头=1层灰石基座自y=0入水外鼓+压顶铺地+临水栏杆；水上悬浮块=钢腿端停y=0水面、逐角posts锚点交shore.js画泡沫圈；跨水拱=两对边1层码头支撑悬浮块→archFloorBudget(floor=0)+archProfile解析椭圆，端点/拱顶精确、形变误差有界——旧账「拱底精确截面」已随arch-profile批落码属过期；种子镇seed330一次齐出码头/拱/后院/水上钢腿房。真实双网格2→1闭环及恢复小镇保留（shore-topology-review.md）。完整建造美术仍缺。；【卡点·B 美术资产】完整建造美术仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似；r221核销：tests/water-town.mjs 四场景复跑全过、机制五文件（shore/shore-loops/townDemo/arch-floor-budget/arch-profile）vendor 逐字一致；剩余残差仅「完整建造美术」=原片未公开资产，无可执行残差，永久卡点，需新证据再立项",
      "project": "townscaper",
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
      "id": "1212732478458343424",
      "date": "2020-01-02",
      "text": "Added some flags. Gotta make it homely and welcoming.",
      "topic": "life",
      "status": "done",
      "where": "src/life/decor.js（refresh / #wire；wires开关）",
      "note": "308帧全序列复核：视频是庭院/楼间彩旗绳，纠正旧屋顶插旗归因。保留已有抛物线下垂/三角旗条带；双网格开关不改共享World/屋顶旗、数值及实景截图通过。任意布局穿墙/精确附着仍待后续压力测试。",
      "project": "townscaper",
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
      "id": "1210969316071477248",
      "date": "2019-12-28",
      "text": "I've got mom and dad visiting. They've been alternating admiring their new grandchild and building this little town",
      "topic": "build",
      "status": "na",
      "where": "",
      "note": "194帧全核；爸妈来访搭的小镇展示片，红/蓝/黄/绿多色密集街区+护墙石阶+拱桥圆塔，相机低空自由飞越穿街（非轨道转台），无UI无文字；路径是录屏者手动操作不是机制，原文只讲家常，确认与本仓无关",
      "project": "townscaper",
      "decodedFrames": 194,
      "reviewEvidence": "artifacts/coverage/1210969316071477248-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          193
        ],
        "nativeRevisits": [
          0,
          150,
          193
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1209519206233968641",
      "date": "2019-12-24",
      "text": "A very merry Christmas to you all",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "193帧全核；圣诞问候短片，深蓝背景上一座绿墙红瓦小岛转台式慢转+镜头推进，被反复加建的体块在画面里逐块长出；对应仓内 camera-motion 转台、townDemo 水面钢腿屋与 effects.js 的 uPops 逐格生长，原文无技术描述，确认与本仓无关",
      "project": "townscaper",
      "decodedFrames": 193,
      "reviewEvidence": "artifacts/coverage/1209519206233968641-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          192
        ],
        "nativeRevisits": [
          0,
          90,
          192
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1205422438437273601",
      "date": "2019-12-13",
      "text": "For doors and windows, I use som stencil buffer shenanigans to punch holes in the zbuffer. I admit it was a bit fiddly to figure out.",
      "topic": "build",
      "status": "done",
      "where": "src/render/opening-punch-layer.js · src/world/app.js · opening-punch.html · tests/opening-punch-main-browser.cjs",
      "note": "390帧全核；门窗模板挖洞已接进主场景并默认开启（app.js 由 ?punch=1 opt-in 改成默认开、?punch=0 关档）：240 洞=236窗+4门对齐 buildings.js 的 openingLog，洞深 0.06，凹洞盒=后墙+两侧壁+窗台+窗楣；旧 note 的两条已核实（墙厚/洞深早已由 recess 盒提供、openingLog 早由 buildings.js 产出），真缺口只有「默认不接」这一层。新测 tests/opening-punch-main-browser.cjs：整岛开/关差分 6402px 其中 83.5% 落在洞口投影矩形并集内、噪声 0；近景窗内深色 2244→0px、亮灰侧壁 1312px；斜看侧壁 1423→1975 单调、暗缝质心横移 31.2px（关档 1.1px）；回归 opening-punch/opening-punch-arch 全 PASS；0 console error。原片无强斜视角，视差证据来自本仓渲染（如实口径已写进证据）",
      "project": "townscaper",
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
      "id": "1205420678859632640",
      "date": "2019-12-13",
      "text": "For the plants, I dug up this ol' trick: alpha is view angle modulated by leaf texture mapped to a sphere.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life/leaf-depth.js · src/life/leaf-impostor.js · vegetation.js",
      "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；本轮补匹配的阴影caster（leaf-depth.js：树冠customDepthMaterial与彩色材质同源——同共享图集/同视角alpha判据（视角=正交阴影相机）/同风摆，浏览器leaf-depth程序真实编译）与远景impostor（leaf-impostor.js交叉面片×共享32²图集+updateCrownLOD距离阈值，地形岛实测79树近40/远39分档、图集单例不分裂）；原作手绘轮廓仍待补。；【卡点·B 美术资产】原作手绘轮廓仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
      "page": "leaf-surface.html",
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
      "id": "1205416648397721601",
      "date": "2019-12-13",
      "text": "New prop placement system! It tries to place as many props as it can without overlap. I use it for doors and windows too, which means they are no longer skewed when placed on skewed tiles, which means skewed tiles now look less awkward.",
      "topic": "build",
      "status": "done",
      "where": "src/core/opening-footprint.js#placeProps · src/build/buildings.js(yardProps + 门窗 tryPlace) · src/build/yard-prop-art-r56.js · openings-r56.html",
      "note": "261帧全核；后院的「尽量多放 + 不重叠」道具（placeProps：凸格贪心 + SAT 不重叠 + 刚性正框）与门窗复用同一套放置器都已在共享 World 上，本轮补页面只读探针 r56propProbe + 浏览器验收：5 格后院 32 件道具 123 对逐对 0 重叠、角到格边余量 0.02158、饱和曲线 12/24/32/39（每个预算 0 重叠）、斜格 45.49° 上框直角偏差 0、263 道门窗全部在斜格上且框水平边与墙边夹角 0°（反向对照 89.84° / 错切 21.801°）、像素 A/B 噪声 0。原片长凳/椅/灯/花盆未做，本仓用木箱/桌/盆栽程序化替代",
      "project": "townscaper",
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
      "id": "1201179450668441600",
      "date": "2019-12-01",
      "text": "Icons!",
      "topic": "tools",
      "status": "done",
      "where": "src/ui/game-ui-c06.js + src/ui/icon-toolbar.js + src/ui/icon-ink.js · index.html?gameui=1（主场景）",
      "note": "306帧全核；本轮补运行验收并收口：图标工具条接主场景真实命令（3 工具格各自底色+轻微倾斜+选中图形纯白+白三角；下方三项灰底白描边、可用态=真实撤销栈深度），第三个灰格从「清空城镇」改回「退出」；新测 tests/game-ui-icon-commands-browser.cjs 体素 356→357→356→357、depth 1→0→1、退出后 #tools 还原；原作图稿为素材差不计缺口",
      "project": "townscaper",
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
    },
    {
      "id": "1200520827898343425",
      "date": "2019-11-29",
      "text": "DnD hopefulls needn't fear no more, for I've now made the backend of letting you tune your town to your favorite palette.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/palette.js · src/core/palette-store.js · wall-palette.html",
      "note": "200帧全核；四步单帧硬切改色（f33 红/s0.61→0.07、f52 绿/s0.63→0.06、f78 浅蓝/s0.70→0.36、f112 暖黄/s0.41→0.33），一步只作用于「用该槽的体素」、屋顶橙与其它槽不动、无渐变无UI；核实旧note「PNG/完整原接口与持久化」：PNG 通路早已在（core/palette-image.js + world/palette-png.js + ?palettePng=）但本片页面从没接、持久化全仓 0 处（存档只写槽下标）→ 本轮补 src/core/palette-store.js + wall-palette.html 的 PNG 热更新/导出16×2 PNG/localStorage 存档（坏存档拒绝）；浏览器实测 32748 顶点、槽7 828/828、槽2 660/660、槽3 360/360 整组换色、回位 0 float/0 px、噪声 0、导出 167B 下行==15槽、刷新恢复「World 346 · 已恢复存档配色」、外部改图 hot v2 改槽 0,2,…,14、关档回预设；如实：反弹光令邻近几何最大相对变化 0.326/0.253/0.198，整岛重建有 4692px 像素地板，片中看不到 1.5s 渐变",
      "project": "townscaper",
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
      }
    },
    {
      "id": "1198957499027795969",
      "date": "2019-11-25",
      "text": "That bit of text up top is the save data for the current construction. I think I've packed the data about as tight as I can. Keeping the save data in a string will make constructions easily shareable between platforms (when it comes to that)",
      "topic": "tools",
      "status": "partial",
      "where": "src/world/save.js · src/world/app.js · save-mesh.html",
      "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。本地v5补第三可选尾段（标志链末节+3b metaVer）：调色板（预设序号或自定义色数+24b RGB）与玩法/天气状态（光照时段/北境主题/flatRoofs等五世界开关/雪雾/雾浓度流速/风向）入档；解码回写world.palette与开关，视图侧字段经world.saveMeta交调用方，app.js读档与game-ui菜单Load即应用，编码meta缺省回落saveMeta→解完原样再编逐位一致；旧串尾零→三标志全缺席照读不误判，新串喂旧解码器按「多余数据」拒收保岛；体素色槽上限改按解后生效调色板验。tests/save-meta.mjs新增+save-atomic/river-flow/splice-save-undo/house-project等回归全过。；r226 补第四可选尾段（标志链末节 UI 段）：工具/色槽（3b+5b 固定）/镜头（target 3×14b×0.05、yaw 11b、pitch 8b、distance 10b）/选中态（W 位升序格号表）/撤销与重做栈（各≤8 条+截断位，条目=体素游程块+嵌入房+选中态）入档；体素游程与嵌入房读写提为共用助手供主段与条目复用；解码经 world.saveMeta.ui 出站、app.js applySaveMeta 把工具/色槽/镜头/选中态/撤销栈种子回位（sceneStart=0 供回放），编码 meta.ui 现取现传、saveMeta.ui 回落解完再编逐位一致；旧串照读不误判、新串喂旧解码器按「多余数据」拒收（tests/save-ui.mjs 内置旧尾链模拟器实测）；取舍如实记=撤销栈整快照只带最近 8 条/栈（体量约束）、多格实例登记不进分享串（与主段 restore 一致）。tests/save-ui.mjs 新增+save-meta/atomic/river-flow/splice-save-undo/house-project/multicell 回归全过；【卡点·C 源证据】原作位流格式与Switch性能无源可对照 → 永久卡点，需新证据再立项",
      "project": "townscaper",
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
      "id": "1197909675443916803",
      "date": "2019-11-22",
      "text": "Turns out my monitor was too saturated, making me make my colors too dull. This should be better. I've also added some building effects, grass in the gardens, and colored \"bounce\" \"lighting\". I'm real happy even my yellows look good now. Yellows are hard",
      "topic": "light",
      "status": "partial",
      "where": "src/core/town-visual.js · src/build/courtyard-grass.js · src/light/bake.js · src/build/buildings.js · wall-palette.html",
      "note": "456帧全核（沿用）。r208 用只读裁判 REACode 把四子项参数化：STYLE/BUILD 重叠22键逐字节相等+BUILD补path #a49c8a；colorgamut 屋顶/草地 HSV 色容体入 town-visual.js（裁判 STYLE 屋顶色 v=0.878 超包络 0.86 如实记录）；封闭院全格草/矮墙子区照长/开口零草/径叠草上入 courtyard-grass.js 并接入 buildings.js（小径格改草底+暖灰径面）；裁判多跳 diffuseBounce 同式 diffuseAir+airGain .55/bounce .62 opt-in 进 bake.js 与 setBakeLighting，单跳默认零变化。Node 侧 tests/town-visual-referee.mjs PASS+28 套件回归。R-接入批：vendor 四件（buildings/courtyard-grass/bake/worldmesh）与库逐字一致，游戏经 morrisTownStage→vendor worldmesh→buildBuildings/bakeLighting 真实消费；接入核对抓出断链——新 buildings.js 拉起 surface-decoration.js→core/wfc.js，wfc.js 漏拷曾致 index.html 动态导入 404、游戏启动全灭，已逐字补入后全树 0 缺失引用；__tmMorrisStage.worldMesh.setBakeLighting 页内可调（游戏侧暂无调用方，opt-in API）。浏览器对拍（隔离上下文，页内 world.fill 搭封闭庭院测试镇不写存档）：grassPlan enclosed=1/grassCells=46、庭院草环+小径叠面实景可见；bounces:1→3 顶点色 21746/22497 变（96.66%）、93.59% 向暖偏移、maxΔ0.401/meanΔ0.122；屏幕像素差 2.327% vs 同档噪声底 0.249%，暖色像素 3.97% vs 0.22%，差分集中彩墙立面与庭院边；回 bounces:1 顶点色逐字节复原。结论：.62/.55 opt-in 档下多跳染色可观测（裁判所记 0.42 档 1.8% 像素仅指显式降回旧强度）；重建 33ms。残差=原片逐像素视觉与源资产不可复现；town-visual.js 为库新文件、vendor 无副本亦无消费方。；【卡点·B 美术资产】原片逐像素视觉与源资产不可复现（贴图/模型/动画/UI 稿无源素材），程序化只能近似",
      "project": "townscaper",
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
      "id": "1195463004919357443",
      "date": "2019-11-15",
      "text": "My brother @mast4461 had a go. Being an engineer he obviously built a nice fractal. Bonus points if you can name it",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "426帧全核；架空三角环岛（自相似分形城）：橙瓦米墙+连续石拱+中央空水面，镜头拉远环绕；玩家摆放策略非引擎机制",
      "project": "townscaper",
      "decodedFrames": 426,
      "reviewEvidence": "artifacts/coverage/1195463004919357443-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          425
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1191990107785572352",
      "date": "2019-11-06",
      "text": "Ah, the timeless problem of shrubbery that look good from all angles without too much overdraw. Adding an anchored center vert to the billboards makes them a bit less flat and gives them directionality without messing with the rotation",
      "topic": "life",
      "status": "done",
      "where": "src/core/anchored-billboard.js · src/life/vegetation.js · billboard-anchor.html",
      "note": "316帧全核（4张联系表）；片内只有一件事：灌木卡片任意机位都保持厚度与朝向（横移/俯视/贴地仰视都不塌成纸片、无popping），正是 anchored center vert。落点 anchored-billboard.js#billboardPoint(anchorMix/axis) + foldedCard 折角暗面 + billboard-anchor.html 对照页；实测 mixed 3712 簇/quad 4682 簇：旧模式中心漂移 0.10621/0.10783、中心固定 0。只剩原片灌木形状/贴图/atlas/生命周期（无源素材的程序化近似），判美术差",
      "project": "townscaper",
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
      "id": "1190191289922465793",
      "date": "2019-11-01",
      "text": "Trying out some per vertex voxel based shadows. Not great not terrible. Looks better when not moving, and with less contrast, obviously.",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（computeVoxelShadows / aVox）· index.html 光照面板「体素阴影」",
      "note": "199帧全核（2张联系表 + 原尺寸0020/0075 + 2×局部）；逐顶点体素阴影等价：36555顶点朝太阳0.16步进到5.0、背光面记0，GPU开关8738像素只暗不亮；差在暗部只压75%直射、对比明显弱于片中近全黑白模，且无less-contrast档位",
      "project": "townscaper",
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
      "id": "1189908238566903808",
      "date": "2019-10-31",
      "text": "However, if you are more careful in providing structural support you'll get curvy brick arches instead and you can build these neat airy cathedral structures",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js（underside）· src/core/arch-profile.js · arches.html",
      "note": "447帧全核；对边两侧支撑→底面成拱（拱腹曲线+拱肩保留+拱脚落实心墩）与片一致，rise/span=0.40、16段、楼板0.2时crown/spring仍合法；差在拱圈无跟曲线的砖缝、开口偏高(0.95 vs 0.65)、无砖柱多跨柱廊",
      "project": "townscaper",
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
      "id": "1189902695303458816",
      "date": "2019-10-31",
      "text": "It was real fun making the steel beam support structures. They have this neat artificial yet organic feel to them. Its a place where the WFC algorithm really shines and that would be hard or at least laborious to create with other systems.",
      "topic": "build",
      "status": "done",
      "where": "src/build/steel-frame-edit.js（编辑→显露判定/碰撞审计/整组事务）· src/build/steel-r56.js（杆件几何）",
      "note": "296帧全核；r204 收口「编辑/移除楼层 → 钢架显露」机制（卡点·A 解除）：collectSteelJobs 与 buildings.js underside 同口径（含拱排除）、planSteelReveal 逐步 diff 露/藏（reveal/hide/mixed/none 按类计数）、commitSteelReveal 走 module-patch-commit fit 事务（socket 边界+周围 WFC+stale-version）+ 原子楼层写、withdrawModulePatch 快照整组撤回、frameCollisions 可走面口径审计。node tests/steel-frame-edit.mjs 8 组 PASS + 6 套件回归。残差（既定边界，同 1257 条目口径）：原版 378 模块 WFC 目录未逐件复原——本仓为本地离散规则等价；浏览器端到端与 TigerMessenger vendor 接入未验收。",
      "project": "townscaper",
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
      "id": "1189109278361165825",
      "date": "2019-10-29",
      "text": "I'm happy to announce that at a count of 378 I've now built enough modules to cover all possible cases in whatever funky townscape you might want to build with this.",
      "topic": "build",
      "status": "ref",
      "where": "src/build/buildings.js",
      "note": "479帧全核；成品高密度城区环绕（编辑器录屏，有光标），无模块计数/无UI；378模块是作者手工资产工作量，画面不可证；本仓按格点签名 sigs 即时生成等价",
      "project": "townscaper",
      "decodedFrames": 479,
      "reviewEvidence": "artifacts/coverage/1189109278361165825-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          478
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "参考：模块覆盖范围，不计代码验收"
      }
    },
    {
      "id": "1181464374839521280",
      "date": "2019-10-08",
      "text": "I made some stairs, plus an additional smaller WFC for surface decorations like windows and doors (who's awkward placement otherwise explodes the permutation count) I'll give my first talk on this at Indicade in Paris on the 19th. Hope to see you there! https:// indiecade-europe.eu/en/programme/c onferences …",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js · src/core/building-components.js · building-components.html · building-kit-r55.html",
      "note": "505帧全核；跨格整墙/真洞口两条缺口核实为「r55 已实现、只缺页面入口与量具」：facadeRuns 把共线共顶点墙段串成一条 run（163 条全多跨、跨边界违例 51→0）、archCutout+wallStrip 真的不画拱形墙条并补洞壁/拱腹/内立面（洞深0.07）。本轮补 archCuts 面积账（墙面缺失面积=拱形折线面积0.024790，最差相对误差1.98e-5）+ building-components.html 两个开关 + 新测 tests/facade-arch-cutout-browser.cjs（同机位关闭挖洞 changed 33488px、噪声0、洞内亮度39.0→26.5）。同机位 A/B 截图核过：开=凹洞可见洞壁与门槛，关=平贴门板。",
      "project": "townscaper",
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
      "id": "1178731576982724611",
      "date": "2019-09-30",
      "text": "I made some grassy plots. I'm real happy with the shapes they make. Eventually, they'll grow some trees and the like.",
      "topic": "life",
      "status": "done",
      "where": "src/build/garden-plots-c07.js#planGardenC07/growBigField · src/build/buildings.js · src/world/view-c07.js ?bigplot=0 · index.html?scene=town&c07=gardenplots,quayyards",
      "note": "333帧全核（4张联系表本轮重看+0095/0250/0280原尺寸+裁切）；r193挂下的「地块尺度」已收：判据按片内可量的事定——草格≥18才切一块大田、大田=草格×0.55夹[9,16]、余下仍2-5格、单格圆角草台保留（片0095确有）；新增 growBigField 纯确定生长，读数 真实小镇 36院/10块/[5,4,3,2,2,...]无大田（最大院草格9<18）、人工42格院 8块/[16,5,5,4,3,2,1,1] 恰1块16格大田、关档 11块全≤5，草格+小径==院格；A/B 80617px 噪声0。同时纠正 r193 的「片尾分色视图不含草地分区」= 非缺口（原片草地不上色，4张联系表+0280 8×裁切确认）；美术差：草色比原片亮、院内树与小径遮挡。测试 garden-big-plot.mjs + -browser.cjs/quay-yards/garden-paths-door-first/garden-browser/c07-look 全PASS",
      "project": "townscaper",
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
    },
    {
      "id": "1176516621223043073",
      "date": "2019-09-24",
      "text": "Getting a feel for the style and density of windows. Here you can also see what I'm going for when different colors meet",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js（opening/tryPlace） · building-components.html",
      "note": "282帧全核；本轮补窗横档并把默认窗从1:1.65窄条改成0.09×0.095近正方（与片放大后0.93一致），每面每层实测0.63–0.92扇=1扇为主、长墙2扇；差在片里无百叶窗而本仓六类墙饰会出48扇、窗台偏宽",
      "project": "townscaper",
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
      "id": "1174406613031170049",
      "date": "2019-09-18",
      "text": "Today my good friend @podzimcore became the first outsider to take the new project for a spin. Behold the glorious monstrosity he constructed",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "334帧全核；无材质灰模转台：圆柱塔+天桥+地面镂空环形合院，360°环绕，无UI无生长；纯他人成品展示，与实现无关",
      "project": "townscaper",
      "decodedFrames": 334,
      "reviewEvidence": "artifacts/coverage/1174406613031170049-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          333
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1168571866405097472",
      "date": "2019-09-02",
      "text": "A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture is then blurred, and sampled in the vertex shader of whatever needs lighting.",
      "topic": "light",
      "status": "done",
      "where": "src/world/worldmesh.js · src/light/bake.js · src/light/field-cache.js · src/world/view-shading.js · tests/ao-field-cache.mjs · ao-stages.html",
      "note": "551帧全核，保留分层烘焙，已有实际遮蔽/反弹分离对照及恢复验收；逐顶点通道分离读数：bakeLighting({channels}) 输出 ao/bounce/air/sun 四通道，≤1e-6 重构顶点色，与仅遮蔽/仅反弹参数隔离两次烘焙逐值一致、裁判 bakeVertexAO 同式线性可分（tests/ao-split-channels.mjs）；本轮核销残差「原GPU重投影/动态纹理」：bake.js 拆出 buildOcclusionField（keepRaw 底片 + cellWriteRect/clearRect/restamp/refreshBits/reblur 增量钩子），新增 src/light/field-cache.js LayeredFieldCache 对齐只读裁判 lightingcache.js（逐格签名 diff → 脏矩形清零 → 按 world.cells 原序重投影 → 窗口化重模糊，签名比裁判多记 rock+shape.at），view-shading voxelfield/voxelnormals 改吃常驻场（stats.voxelfield.update 记 mode/dirty/rect/blurMs）；tests/ao-field-cache.mjs 增量≡全量逐纹素 maxDiff=0、写回区外字节不动、bakeLighting({field})/channels/packLayeredField 同源、形变签名判脏；ao-field-cache-browser PASS（首建 full→纹理、编辑→dirty 1 格、verify badTexels 0）；机制等价裁判实现，判为 done",
      "project": "townscaper",
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
      "id": "1168168400155267072",
      "date": "2019-09-01",
      "text": "Got some very basic lighting in there. Since this ain't proper voxels I had to do a new take on my usual voxel based AO approach",
      "topic": "light",
      "status": "done",
      "where": "src/light/bake.js · ao-stages.html",
      "note": "811帧全核；分层占用栅格+盒式模糊+顶点采样压暗+邻居色反弹与片中「非体素AO」等价（满遮蔽压到0.62倍，与片中白模最暗2%的0.62一致）；差在与实时光照混用、夹缝压暗偏弱(约12%)",
      "project": "townscaper",
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
      "id": "1164926304640229376",
      "date": "2019-08-23",
      "text": "WFC running at interactive speed on that funky grid. Next up is to make it deterministic",
      "topic": "grid",
      "status": "done",
      "where": "src/core/wfc.js · wfc.html",
      "note": "395帧全核；块体外墙严格贴合地面不规则多边形弯边、0–60帧增量铺开＝任意多边形半边 WFC 交互求解；quad 206格/mixed 147格正倒序同解、回溯0、5.6ms；尚无四子格联合模块约束，绿线调试视图只有等价物",
      "project": "townscaper",
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
    },
    {
      "id": "1163836000688365571",
      "date": "2019-08-20",
      "text": "Basic marching cubes on my funky grid. Next up is turning this into mixed initiative WFC.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/marching-cubes.js（marchIrregular/growthOrder/meshVolume/quadRegionGrid）· marching-cubes.html?mode=cubes|slab",
      "note": "353帧全核（4张联系表全看+原尺寸回看0100/0220/0352）；机制=不规则四边形网格上的三维等值面生长，r56 C06 早已落码（src/core/marching-cubes.js 文件头署本片 ID，按面走一圈代替 256 表 + 交点按顶点id+层焊接），原 note 记的「缺 3D 等值面模块」核实为过期账；本轮补页面运行验收 tests/marching-cubes-browser.cjs：cubes 634格×5层/420角点 → 3716三角/1832顶点（verts÷tris 0.493 证明焊接）/闭合且边界边0/体积+47.9，交点1106个全部落在格边（604水平+502竖边，偏离0）、闭合壳 V−E+F=−26 → genus 14（片子里那些能看穿的拱洞）、朝下面落在13个层高（底面阶梯），生长 t=0.02→1 六档全闭合且三角/体积单调 104→3716/0.36→47.9，像素 A/B 0→152226px 噪声0，slab 72格/672三角/竖墙120+水平盖552+斜面0/板厚0.45=levelHeight；页面补 mesh() 几何探针与表面三角边线层（?edges=0 关），模块补 vertexKinds/fanCenters（零行为变化，node 测试前后同结果）",
      "project": "townscaper",
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
    },
    {
      "id": "1151770831619534848",
      "date": "2019-07-18",
      "text": "I figured out how to make do with relaxation clusters of 3 instead of 7, which means I have to generate fewer unrelaxed patches before I can start relaxing, which makes it faster. Note also that the black and the white grid are *dual* to each other. This is an important concept",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js · grids.html?t=infinite",
      "note": "532帧全核，保留现有三块簇/插值；修verify始终查blend及只查前两owner，实际只簇模式接缝原被隐藏，浏览器全owner逐模式验收。按块边界钉住实际无缝，不沿用旧说明。；【第62轮 A 类收敛】三块簇/插值接缝按块边界钉住，浏览器全 owner 逐模式验收通过，判为 done",
      "project": "townscaper",
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
      "id": "1151152046055272449",
      "date": "2019-07-16",
      "text": "Having a look around",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "650帧全核；俯视无贴图岛屿的四下环视，全程只有一枚调试罗盘gizmo（圆环+十字+N+黄方块+方向箭头）与线框→实体切换，无玩法/渲染机制，gizmo属原作调试叠加",
      "project": "townscaper",
      "decodedFrames": 650,
      "reviewEvidence": "artifacts/coverage/1151152046055272449-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          649
        ],
        "nativeRevisits": [
          60,
          300
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1151137783785771008",
      "date": "2019-07-16",
      "text": "As promised: an aperiodic infinite deterministic irregular relaxed quadrilateral grid.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js#createInfiniteStream + src/core/infinite-c06.js#streamWindow/densityStats · infinite-stream.html（流式窗口）",
      "note": "449帧全核；真流式加载核实为过期账（createInfiniteStream+streamWindow(evict)+infinite-stream.html r56 就在，缺的是浏览器验收）：真指针拖焦点→累计拓扑 7→45 块，沿 x 走 0→200 累计 57→224 块而缓存恒 30–37、丢弃 20→194、每步接缝 ≤2.8e-14、翻折 0；半径 14 时 19 块/3936 格。原记的疏密均匀度为真缺口，已补 densityStats：面积比 p10/p50/p90 0.80/1.00/1.19（1.48×、CV 0.141）、边长 CV 0.155、块均值 CV 0.006 vs 块内 0.141（看不出块边界）；同一口径两边量：原片 CV 0.216/1.83× vs 本仓 0.272/2.14×（如实口径，格子大小差大一档）。新测 tests/infinite-stream-browser.cjs + 页面读数；regression infinite-c06/infinite-stream/infinite-window/infinite-area-pull/r50-page-entries 全 PASS。",
      "project": "townscaper",
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
      "id": "1147881669350891521",
      "date": "2019-07-07",
      "text": "I present: Fairly even irregular quads grid in a hex Todo: 1. Heuristic to reduce (or eliminate) 6 quad verts 2. Tile these babies to infinity",
      "topic": "grid",
      "status": "done",
      "where": "src/core/grid.js（buildQuadGrid/relaxPolygons/buildTriangularSubgrid）· grids.html?t=kinds",
      "note": "1068帧全核（11张联系表）；四遍循环=点点→从中心长格→满格→转白细分→鼓穹顶→淡出，与grid.js buildQuadGrid（合并→逐多边形切四边形→80 pass 松弛）同构；infinite-verify stretch 1.83/shrink 0.46、kinds 页 mixed 331格(155四边形+176三角)通过。仍缺消除6价顶点的启发式与可播放时间线",
      "project": "townscaper",
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
      "id": "1120036868966502401",
      "date": "2019-04-21",
      "text": "It's marching squares on irregular quadrilateral grids",
      "topic": "grid",
      "status": "done",
      "where": "src/core/cell-selection.js CellSelection · src/world/app.js 选中态/undoSel·redoSel/applySelectionWindow/pruneSelection · index.html 选择工具格 · src/ui/hud.css #tools · src/world/view.js setGridWindowForSelection",
      "note": "703帧全核（本轮重抽+sheet-03重看，历轮sheet-00..07与8×裁切沿用）；缺口②收口：编辑器补真选中态（点击/S-/Esc）+多选（Shift/⌘加减）+撤销/重做逐条带回选中快照（平行账本undoSel/redoSel，不动world.snapshot口径）；选中→包围盒→窗口补丁联动，编辑/换场景/清空/撤销后先prune再算窗口；HUD工具按钮原本无onclick且被信息条与进度面板压住，已接线并挪到底部居中；?gridwin=1 开档（须在面板挂载后，否则被setDebug重放改回false）。done",
      "project": "townscaper",
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
      "id": "1105131621391495176",
      "date": "2019-03-11",
      "text": "Squiggly distance fields, now with animation! Versatile, flexible, but quite laborious",
      "topic": "tools",
      "status": "done",
      "where": "src/core/ornament-field.js · src/ui/ornament.js · ornament.html",
      "note": "63帧全序列核验；单张128²距离场镜像、独立阈值和uniform展开通过GPU；画稿/时序为本地样例。",
      "project": "badnorth",
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
      "id": "1104771432440049664",
      "date": "2019-03-10",
      "text": "Squiggly distance fields on mirrored UVs for fast and easy UI decorations. Distance field cutoff can be tweaked separately for borders and center. All one texture, just flipped around a bit. At the start of making @BadNorthGame , UI decoration was a pain, it is now a delight.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/ornament-field.js · src/ui/ornament.js · ornament.html",
      "note": "本批续用旧全帧记录，单张距离场镜像/独立阈值GPU验收通过；原作画稿及分层时序仍不同。",
      "project": "badnorth",
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
      "id": "1097458505315946496",
      "date": "2019-02-18",
      "text": "The Viking frontier in @BadNorthGame is dripping with funky math: 1. Triangulate (with some added padding) 2. Walk on triangle edges along each frontier step 3. Bezier sample 4. Tessellate the fields on either side using the bezier and the triangulation",
      "topic": "grid",
      "status": "done",
      "where": "src/core/frontier.js · src/campaign/frontier-overlay.js · src/campaign/map-ink.js · campaign.html",
      "note": "14帧全核；三角化(padding)→沿边走到前线→Bezier 采样→两侧场 ear-clip 细分 r55 已落码（旧 note 的「两侧细分未实现」是过期账），真缺口是第5步墨层：新模块 src/campaign/map-ink.js 补地名(islandName 45/45 不重名)/阶段数字/航路箭头/墨色虚线多条前线/场内波纹，frontier-overlay 加 palette+curves 两个可选参数、页面 ?ink=0 可整层 A/B；新测 tests/frontier-fields-campaign-browser.cjs 墨层差分 47887px、两侧场差分 208654px、噪声 0、两侧场色差 11.71、0 error",
      "project": "badnorth",
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
      "id": "1092709665199345664",
      "date": "2019-02-05",
      "text": "k-pow !!",
      "topic": "show",
      "status": "done",
      "where": "src/badnorth/battle-c03.js#explodeAt/#scorch/#ensureBanner · index.html?scene=badnorth&kpow=1（场景能力面板 c03·周期爆炸演示）",
      "note": "474帧全核（5张联系表 + 原尺寸0060/0085/0110/0310）；本轮纠正：0100-0140台面上的鲜红块是红盾维京敌兵，不是残留焦痕。机制五件全在 src/badnorth/battle-c03.js：explodeAt 时序（.02→.42 膨胀 40ms 级、.75s 收缩到 .069 并淡出到 .034、颜色白→橙）、#scorch 贴地圆片 y=ground+.012 由 .88/.29/.24 转焦黑 .16/.12/.12 且留存、火星 28 颗 vy 2.15→-0.28、烟源接 view.smoke、#ensureBanner 红底白字横幅挂最高台地、周期 3.5s。note 记了6轮的「缺 explodeAt」已过期，本轮只补运行验收+量具，未改码。",
      "project": "badnorth",
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
      "id": "1078792665980915714",
      "date": "2018-12-28",
      "text": "friday night campaign map node graffing",
      "topic": "fx",
      "status": "done",
      "where": "src/core/campaign-graph.js · src/campaign/campaign.js · campaign.html",
      "note": "593帧全序列核验；保留Delaunay本地近似，修复凸包边、连通补桥、无回环主路和不可达BFS；原作精确邻接未知，边境细分另列待补。",
      "project": "badnorth",
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
    },
    {
      "id": "1063115611289645057",
      "date": "2018-11-15",
      "text": "Like many of you have suggested, I finally added grass to slopes to make navigability easier to read (especially on overcast levels where the lighting ain't helping much). I'm happy enough with the result to ditch the previous white dotted lines. https:// store.steampowered.com/app/688420/Bad _North/ …",
      "topic": "light",
      "status": "done",
      "where": "src/life/vegetation.js",
      "note": "593帧全核；坡面草丛8-14丛/格 vs 平地0.45丛/格（实测31倍，旧note写2倍偏低），全片无白虚线；仍缺平地草丛密度",
      "project": "badnorth",
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
      "id": "1062374549407350790",
      "date": "2018-11-13",
      "text": "To make Bad North even prettier, I'm adding some extra smoothing to the island using my voxel normals. It helps break up the grid and make it all look a wee bit more natural. (also, go wishlist @BadNorthGame on Steam: https:// store.steampowered.com/app/688420/Bad _North/ … )",
      "topic": "grid",
      "status": "done",
      "where": "src/core/meshwriter.js · src/terrain/terrainmesh.js",
      "note": "780帧全核；软法线=同位置软三角形按55°阈值平均，崖壁圆润/崖口保持硬，实测30°折平均到cos15°、90°不平均；仍缺网格级松弛与软硬对比页",
      "project": "badnorth",
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
      "id": "1061229717582475264",
      "date": "2018-11-10",
      "text": "But you can break up that repetition by using a few different ones with different settings (all still using the same texture)",
      "topic": "texture",
      "status": "done",
      "where": "textures.html（UI 装饰）· src/core/mirror-uv.js",
      "note": "332帧全核；deco「+几种设置」改成三条并排装饰带（同一贴图，朝向7/3/1、格宽36/44/52），三块画面互不相同；仍缺真实 UI 图集与可保存套件",
      "project": "badnorth",
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
      "id": "1061227418961219585",
      "date": "2018-11-10",
      "text": "Obviously, if you stretch it too far, you will start to notice the repetition",
      "topic": "tools",
      "status": "done",
      "where": "textures.html（UI 装饰）· src/core/mirror-uv.js",
      "note": "370帧全核；deco 页签改成绕面板中心对折镜像（相邻格互为镜像）+4 个子模式，拉太长 1/3/6 格宽重复 6 次线性增长；仍缺巴洛克图集与九宫格拉伸",
      "project": "badnorth",
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
    },
    {
      "id": "1061221291137605633",
      "date": "2018-11-10",
      "text": "I'm writing a simple graphic for UI decoration. A single texture can be oriented 8 different ways and mirrors around the center to work in any size. (also, Bad North drops on Steam Nov 16 https:// store.steampowered.com/app/688420/Bad _North/ … )",
      "topic": "texture",
      "status": "done",
      "where": "src/core/mirror-uv.js · src/ui/ornament.js",
      "note": "379帧全核验：方/横/窄高矩形拖动、Orientation变化。复用已有单距离场，补D4八方向和可选固定像素尺度中心重复折叠，GPU八方向各异/镜像无误差，改尺寸不重烘，旧实验回归通过。固定尺度重复是本地方案，非已证实原布局；纹样/CPU绘图API仍不同。；【第62轮 A 类收敛】残差=纹样与 CPU 绘图 API，D4 八方向/固定像素尺度折叠机制等价且 GPU 无误差，判为 done",
      "project": "badnorth",
      "page": "mirror.html",
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
    },
    {
      "id": "1056999668486471682",
      "date": "2018-10-29",
      "text": "Works well in daylight too, largely thanks to the max blend",
      "topic": "fx",
      "status": "done",
      "where": "src/life/effects.js（fire / MaxEquation / setFireAppearance） · fire.html、index.html?scene=badnorth",
      "note": "435帧全核；白天靠 MaxEquation 保住火芯黄→橙→红三阶（重合粒子 GPU 读回 maxDelta=0/addDelta=277924），二次收缩顶端碎块等价；缺宽粉光晕与贴屋脊火源，火柱偏细散",
      "project": "badnorth",
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
      "id": "1056992291108413446",
      "date": "2018-10-29",
      "text": "Oh no! I made an error! The quads above shrink way more than they are supposed to. This looks much better and breaks up the flame in a much more interesting way:",
      "topic": "grid",
      "status": "done",
      "where": "src/life/effects.js · fire.html",
      "note": "152帧全核（2张联系表+原尺寸0075）；寿命归一年龄、出生尺寸、到期discard，二次收缩半寿命0.25x对线性0.5x；缺橙红外缘与火星（旧粒子已<1px），默认机位火柱仅1-3px",
      "project": "badnorth",
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
      "id": "1056990611738451968",
      "date": "2018-10-29",
      "text": "New fire effect. For blend mode, I use Max instead of Add to have better control over my colors and to make the particles blend together and form a common silhouette.",
      "topic": "texture",
      "status": "done",
      "where": "src/life/effects.js · fire.html",
      "note": "379帧全核；三重火源的橙→黄→淡黄层次与共用轮廓＝Max 而非 Add，GPU 读回 maxDelta=0/addDelta=277924，同簇 64 片近景 Max 纯白 0 px、Add 8593 px；Points 软圆近似方片，无火光照明",
      "project": "badnorth",
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
      "id": "1042732450730913793",
      "date": "2018-09-20",
      "text": "The graph generator I ended up using for the Bad North campaign maps: 1. Create nodes of varying sizes and spread them out 2. Cull nodes outside bounds 3. Do a random walk from start to finish 4. Do some more random walks 5. Pick some more random nodes",
      "topic": "grid",
      "status": "done",
      "where": "src/core/campaign-graph.js · src/campaign/campaign.js · campaign.html",
      "note": "893帧全序列核验；保留Delaunay本地近似，修复凸包边、连通补桥、无回环主路和不可达BFS；原作精确邻接未知，边境细分另列待补。",
      "project": "badnorth",
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
      "id": "1024679338292256769",
      "date": "2018-08-01",
      "text": "Some UI flair",
      "topic": "tools",
      "status": "done",
      "where": "src/core/ui-reveal.js · ornament.html",
      "note": "100帧全核验。中央徽章/标题先显、外纹后展，中央先退/外侧尾迹最后消失。保留共享SDF，新增可拖动标题/外纹本地两轨时序，透明文字inert；非原徽章/逐部件原时序或图稿。；【第62轮 A 类收敛】残差=原徽章图稿与逐部件时序，机制（中央先显/外纹后展/尾迹最后退）等价，判为 done",
      "project": "badnorth",
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
      "id": "1022855252574437376",
      "date": "2018-07-27",
      "text": "it's my birthday!",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "131帧全核；生日蛋糕造型小岛转台展示（7支蜡烛+小屋+花+白浪线），粉/灰变化来自机位与烛光暖调，无玩法或渲染机制，与原版实现无关",
      "project": "badnorth",
      "decodedFrames": 131,
      "reviewEvidence": "artifacts/coverage/1022855252574437376-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          130
        ],
        "nativeRevisits": [
          40,
          60,
          124
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1022573208590057472",
      "date": "2018-07-26",
      "text": "The look and feel of the basic meat and potato melee combat is one of the things I'm most proud of in Bad North",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（#hit / dropPoints / blood） · index.html?scene=badnorth",
      "note": "1114帧全核；击退0.05/次、4滴抛物线血滴(本轮补可见点云+改外抛初速)、soak 染色、落地血斑累积、尸体保留均等价；缺掉落武器与深褐干渍配色",
      "project": "badnorth",
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
      "id": "1017355723171344385",
      "date": "2018-07-12",
      "text": "Making some thicker outlines for all you 4k high ballers out there",
      "topic": "light",
      "status": "done",
      "where": "src/world/outline.js（OutlineLayers.update） · index.html?scene=fusion",
      "note": "426帧全核；墨线宽度按渲染高度/1080归一+像素比，1080→1.4px、2160→2.8px、thickness 可翻倍，4K 不变细；缺面板勾选（仅 setDebug 入口）",
      "project": "badnorth",
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
      "id": "1016680972610359298",
      "date": "2018-07-10",
      "text": "This is what the confirm popup looks like:",
      "topic": "tools",
      "status": "done",
      "where": "src/badnorth/battle-c03.js（confirm：横排弹窗/目标格白环标记/confirmAction 重放/swap · cancelPopup Esc）· src/badnorth/battle.js#onPointer（真下令路径）· tests/c03-battle.mjs · tests/confirm-popup-browser.cjs · ui.html",
      "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。本轮闭合三条游戏语义残差：①地面标记=#openPopup 在 picked.cell/floor 钉白色六环（浏览器同帧差分 1524px 落点内，确认/取消/关档全收）②单 Move=confirmAction 重放 battle.onPointer 原点击，走 navigation.pick/plan 校验→squad.goal/goalFloor→drawPath→取消选中同一条真下令路径（Node plan spy + plan 打回不改 goal）③移动交换=swap 钮两队 goal+goalFloor 双向换；补 cancelPopup() 挂真 Esc keydown、弹窗期队伍阵亡/选中顶替自动收；tests/confirm-popup-browser.cjs 17 项 + c03-battle.mjs §④ 全过；残差=原片钮图稿与标记形制为程序化近似（素材差）",
      "project": "badnorth",
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
      "id": "1015151731804721152",
      "date": "2018-07-06",
      "text": "I change the mip level of the noise texture throughout the smoke trail. This aids the transition from crisp at the base to blurry a the tip",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · smoke.html",
      "note": "281帧全核；age×4 的 mip bias 让裸方片从基部米粒级细节退到顶端平灰，GPU 方差 13427→6826（−49.2%）；仍是经验级数，非精确 mip 号，Points 软圆不等于原片方片",
      "project": "badnorth",
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
      "id": "1015149712469524480",
      "date": "2018-07-06",
      "text": "I only sample my noise texture once per quad, but I scroll the UVs randomly forward or backward along the flow of the smoke. This further breaks up the recognizability of individual blobs and it creates some of that cool multi layered flow feeling thick smoke should have",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · smoke.html",
      "note": "451帧全核；棋盘带内相邻方片相位互不连续、方向可正可反＝逐片 UV 沿流向随机滚动，冻结 0/0/0 与滚动 122/147/122、反向 206.33 均 GPU 读回；aFlow 只是速度投影近似，非三维流体轨迹",
      "project": "badnorth",
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
      "id": "1015142746372366336",
      "date": "2018-07-06",
      "text": "I solve the problems of z-depth and draw order by drawing the effect in 2 passes. The first pass is black, and and has a full alpha ner the base. The second pass is lighter, more transparent towards the base, and has its cutoff pulled in 1 pixel (creating the crisp outline)",
      "topic": "fx",
      "status": "partial",
      "where": "life/smoke.js#CROWN_STYLE · smoke.html · battle-c01",
      "note": "303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状",
      "project": "badnorth",
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
      "id": "1015140880666300416",
      "date": "2018-07-06",
      "text": "Smoke effect. A full billowy base tied together by a crisp outline seamlessly transitioned to a blurry fade. The effect is probably a bit much for my current purposes, but I think it solves some interesting problems so I wanted to share it",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · src/core/smoke-order.js · smoke.html",
      "note": "631帧全核；两遍烟雾（pass0 纯黑满alpha、pass1 更浅且阈值内收露黑描边）与实现一致，back/front 各23实例排序稳定；缺卷曲团块轮廓与按火源尺寸缩放",
      "project": "badnorth",
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
      "id": "1010979395719319552",
      "date": "2018-06-24",
      "text": "A selection of the many handsome faces you might come across in @BadNorthGame",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/part-random.js · src/ui/game-portrait-c01.js · src/badnorth/battle-c01.js · ui.html",
      "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。本地卡片绘制与稳定种子身份已验；本轮接游戏角色接口：sampleSlots 加 {pin} 钉槽（钉住值必须在槽 variants 内、钉表外槽位报错），squadPortraitIdentity(sq) 兵种→装备（矛兵→锁甲 mail、弓手→兜帽 hood、步兵随种子）+队序→底色，battle-c01 头像卡按小队真数据钉槽；残差=原兜帽/锁甲素材与全装备层级不可得，不以不同画板哈希充当原多样性指标。；【卡点·B 美术资产】原兜帽/锁甲素材与全装备层级不可得（无源素材，程序化只能近似） → 永久卡点，需新证据再立项",
      "project": "badnorth",
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
      "id": "1007587828992266240",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "done",
      "where": "src/badnorth/battle.js · src/badnorth/battle-c02.js · src/badnorth/battle-c01.js · src/life/banner.js · index.html?scene=badnorth",
      "note": "300帧全核；白垩崖两队混战（hp 5/6/0、血渍 76 片）+ 失守小屋炭黑 206 顶点/2 火源/1 烟源 + 屋周焦痕 4 片/余烬 45 颗 + 两队旗（浅蓝/橙/薄荷）全部运行验收；旧「仅判读未对齐」收口，真缺口是焦痕默认关（C02 scorch 与 C03 houseFx 都关），本轮给 C02 加 C02_DEFAULT_ON=['scorch']，?c02=-scorch 关档",
      "project": "badnorth",
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
      "id": "1007587825024425984",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "470帧全核；玄武岩台地岛+草绿台面+拱洞透光，相机绕两圈纯展示，无单位/UI/破坏，确认与实现无关",
      "project": "badnorth",
      "decodedFrames": 470,
      "reviewEvidence": "artifacts/coverage/1007587825024425984-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          469
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1007587821220229120",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "356帧全核；沙嘴+圆鼓形石塔+白屋的转台环绕展示，相机绕一圈无单位/UI，确认与实现无关",
      "project": "badnorth",
      "decodedFrames": 356,
      "reviewEvidence": "artifacts/coverage/1007587821220229120-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          355
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1007587817021636609",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "259帧全核；玄武岩柱小岛+白屋的转台环绕展示，相机绕一圈无任何单位/UI，确认与实现无关",
      "project": "badnorth",
      "decodedFrames": 259,
      "reviewEvidence": "artifacts/coverage/1007587817021636609-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          258
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "1007587812462530561",
      "date": "2018-06-15",
      "text": "Proper games have waterfalls. I'm glad to report that @BadNorthGame is now a proper game.",
      "topic": "water",
      "status": "done",
      "where": "src/water/waterfall.js · index.html?scene=badnorth（面板「瀑布」）",
      "note": "682帧全核；水帘从崖唇贴壁垂到海面+底部白沫，面板「瀑布」开关可见；缺下宽外扩/不规则碎沫/细冰棱分流",
      "project": "badnorth",
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
      "id": "999191760944418817",
      "date": "2018-05-23",
      "text": "Adding the option of disabling gore made me realized just how much I rely on blood for environmental storytelling. I should probably start asking some questions about what kind of person I am and what kind of art I put into this world.",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（gore · #draw 尸体跳过 · blood.visible）· setDebug('gore')",
      "note": "111帧全核；血迹三层（地面/崖壁流挂/崖脚）+血滴+尸体随同一开关整层消失、活人保留，红像素 26040→827→25955→803；缺原作面板样式与血在深浅底材上的色差",
      "project": "badnorth",
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
      "id": "999185422403055616",
      "date": "2018-05-23",
      "text": "For my blood splatter UVs, I'm interpolating between sprite-space and skin-space using the fwidth of skin UV. This gives me a sprite-space map on the tummy (where the skin UVs are static) while the splatter on the face follows the actual motion of the head.",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（aSoak · installSoak 双空间 uSoakSpace/uSoakPivot · uSoakDebug 棋盘格 · u.headYaw/headRoll/headLag 头局部姿态 · gore→aSoak/发红归零）· tests/blood-spaces-gore.mjs",
      "note": "229帧全核+本轮残差补全：双空间血斑已落——躯干=单位空间（sprite-space 对应物，图案钉在躯干框架），头/盾=部件空间（position−uSoakPivot 局部坐标=skin-space 对应物，斑纹跟部件实际姿态走）；u.headYaw/u.headRoll 给头独立局部姿态（view.headLag opt-in：僵直期间头滞后身体，「splatter follows the actual motion of the head」闭环）；uSoakDebug=1 棋盘格调试层=0096 分界（躯干蓝棋盘/部件红白棋盘，?soakChecker=1 或 setSoakDebug）；补高频碎斑层（原片是细碎溅点不是整面色块）；gore 补漏：体表浸血+整体发红随同一开关归零（原只关地面血/血滴/尸体）；Node 验收 tests/blood-spaces-gore.mjs（双空间 uniform/头姿态分离且平移列不变/gore 往返/棋盘格翻转/hp 边界/确定性）；头/盾斑纹域换坐标系后像素量未在浏览器端复测；【卡点·C，永久】斑与调色板斑的辨识度、细碎溅点的像素级标定需原作精灵贴图+皮肤 UV 素材，需新证据再立项",
      "project": "badnorth",
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
      "id": "995043346778415104",
      "date": "2018-05-11",
      "text": "The pathfinding in some levels does get a bit convoluted",
      "topic": "fx",
      "status": "done",
      "where": "src/core/route-preview.js · src/badnorth/battle-c01.js#route/#routeStep · index.html?c01=routePreview",
      "note": "386帧全核（4张联系表+0035/0075/0150原尺寸）；路线预览在主战场跑通：等弧长点串126点(p50 0.1199)、落崖弧2=跨层跳数2、圆角26、埋点0(直线连点7/143)、走完前常驻(2.5-4.5s pathT≥1.18)、走过逐段消(126→4单调)、像素A/B 5880px噪声0回位0；旧note两条「未接主管线/仍是一次性点串」核实为过期账，真缺口是landArcs的land(0.55)在真实一格0.42-0.47宽上必然越界→弧整段被放弃(arcs=0、6点埋崖)，已改为按剩余段收边",
      "project": "badnorth",
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
      "date": "2018-05-11",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "done",
      "where": "src/badnorth/battle-c03.js#ensureHud/arm/castPlunge/plungeProbe · src/ui/scene-capability-panel.js（指挥官跃击勾选框）· index.html?scene=badnorth&plunge=1",
      "note": "564帧全核（sheet-00/02 本轮重看 + r190 三张 + 首轮六张 + 0200 原尺寸 + 底部4×裁切）；r195核实旧note『能力系统仍空白』=过期账（第52次同型）：battle-c03.js 的 plunge 档早有三键HUD/.cd冷却弧/arm/castPlunge(目标校验·跃起·白环·范围伤害)/#toast黑条，页面入口是环境面板『指挥官跃击』勾选框；本轮补齐三处真形制差：名牌改挂钮上方带指针、亮键补黄高亮环.hl、无目标提示改成点亮那一刻就出（原来只在地面点击里）；另加 pointer-events:none 与 bottom 72px 让开页脚工具条。验收 tests/ability-bar-plunge-browser.cjs 31项PASS（面板勾选即出三钮/仅plunge可点/钮径5.18%画幅/居中留白72px；无目标 hl=1 牌在上方 黑条No valid targets cooldown=0；有目标 arm不出条 真mouse.click→plunges=1 hit hp2→1 白环1 cooldown9.283/10；冷却弧12.15→54.55→96.95 与169.6(1-cd/10)差<0.05 归零可再arm；关档差分6861px 全在条带 噪声0 0error）；回归 c03-battle/battle-c01 PASS；美术差：钮径比片内小1.8个点、图标近似、另两钮灰占位、落地过程片内未拍",
      "project": "badnorth",
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
      "id": "987267068495003648",
      "date": "2018-04-20",
      "text": "Using inspector expressions, I can live tweak the cost function of my projectile trajectory lookup tables. Very handy.",
      "topic": "fx",
      "status": "done",
      "where": "src/core/ballistic-table.js · src/badnorth/battle.js · ballistics.html",
      "note": "678帧全核；Inspector代价/Validity动态编辑。保留无阻力游戏参数，提共享表/可调权重，修真实目标高差量化误差；双网格实际弓手发射通过。残差全收：原 Cost/Valid 表达式（compileBallisticExpr 白名单）+ 线性 drag 烘表（第53批）、ballistics.html 现场改表达式/阻力/速度窗（第56批）、本轮补 Validity 契约（createShotContract：射程环/沿弧遮挡采样/落点地表容差；pickBallisticShot 让表达式表在 ranked 候选里自动换越墙高抛弧；battle.makeShotContract 接 world.isSolid/top，opt-in shotContract 射前拦、飞行碰撞校验不动）。游戏侧 vendor battle.js 是定制副本未接契约（R71 书面理由）。",
      "project": "badnorth",
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
      "id": "984813819280191488",
      "date": "2018-04-13",
      "text": "Blood soaking as a health indicator for the big fellas and a proper stun state for the little ones",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（installSoak/aSoak/#bleed/poolGrow/mStun · gore→aSoak 归零）· src/core/combat-profile.js（damageCombatUnit soak=1−hp/max）· src/core/combat-state.js · battle-c01 bloodStack/bloodAge · tests/blood-spaces-gore.mjs",
      "note": "934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；hp→体表浸血映射锁死 damageCombatUnit：soak=1−hp/max（Node 验收 tests/blood-spaces-gore.mjs：边界 0/1、阵亡 0.9、确定性、命中不伤走位）；「堆厚变暗」复查：机制已存在——c01.bloodStack（opt-in，重叠计数+逐实例压暗+bloodAge 老化，stats.stacked/maxStack 复验通过，默认关）；原片第2次复证同点位反复死亡仍测不出变深变大 → 标定值来源不足【卡点·C，永久】需新证据再立项，机制侧已齐",
      "project": "badnorth",
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
      "id": "984703192465330176",
      "date": "2018-04-13",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "163帧全核；8人举蓝圆盾围成一圈+三叉尾绿旗，5.2s里只有相机约20°视差平移，旗帆/盾/阵型已在 banner.js 与 battle.js，属美术展示片",
      "project": "badnorth",
      "decodedFrames": 163,
      "reviewEvidence": "artifacts/coverage/984703192465330176-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          162
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "978211952504852480",
      "date": "2018-03-26",
      "text": "Pro tip: use fwidth, ddx and ddy to create crisp, pixel perfect, zoom independent, antialiased lines with your shaders. https:// computergraphics.stackexchange.com/questions/61/w hat-is-fwidth-and-how-does-it-work …",
      "topic": "texture",
      "status": "done",
      "where": "src/world/island-snapshot.js · snapshot.html · textures.html",
      "note": "339帧全序列核验；真实World 64²截图、成功/异常状态恢复及GPU导数alpha边缘通过；原作通道/精确shader未知，战役全量缓存接入另待补。",
      "project": "badnorth",
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
    },
    {
      "id": "978195201901711360",
      "date": "2018-03-26",
      "text": "Some of it will have to wait for some later project",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "55帧全核；战象+红盾步兵的立姿/倒姿两套贴片，固定机位无运镜、无UI无调试线框，确认与原版实现无关",
      "project": "badnorth",
      "decodedFrames": 55,
      "reviewEvidence": "artifacts/coverage/978195201901711360-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          54
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "978194866520944641",
      "date": "2018-03-26",
      "text": "Some of it looks very similar",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "31帧全核；Bad North 三支小队方阵+红旗在土黄地面列队，几乎静止，原文只是感慨；列队/旗已在 battle.js，无新技术线索",
      "project": "badnorth",
      "decodedFrames": 31,
      "reviewEvidence": "artifacts/coverage/978194866520944641-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          30
        ],
        "nativeRevisits": [
          30
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "974579499802202113",
      "date": "2018-03-16",
      "text": "For a given position, Barycentric Coordinates can be calculated with 1 subtraction and 1 dot product (if you've precalculated some nice vectors in the triangle)",
      "topic": "grid",
      "status": "done",
      "where": "src/core/spatial.js#baryPrep3 · src/world/bary-gizmo.js · bary-gizmo.html · tests/bary-gizmo-3d-browser.cjs",
      "note": "815帧全核（9张联系表+原尺寸0445）；同一套教学gizmo另一种时长：灰模三角网+白球RGB箭头+白边查询三角，球在面内外来回、被抬到离平面很高的位置（0445 球高悬、白竖线连到面上投影点），相机缓慢绕行；全片无文字无UI无非相关物体。机制=预算对偶向量后 1 次减法+每坐标 1 次点积（任意朝向平面，面外点得投影权重+有符号离面距离），本仓 spatial.js#baryPrep3 正是这条路（ops{sub:1,dotPerWeight:1}、normal、distance、退化flag），baryCramer3 只作对账。与孪生片 974564862729838592 共用 bary-gizmo.js/.html 一套实现，本轮一并补齐真指针拖拽与运行验收（tests/bary-gizmo-3d-browser.cjs 27/27，像素A/B 2969px 噪声0，0 console error）",
      "project": "badnorth",
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
      "id": "974564862729838592",
      "date": "2018-03-16",
      "text": "I'm making some pedagogical gizmos for my GDC microtalk, like this illustration of Barycentric Coordinates. Gizmos > powerpoints.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/spatial.js#baryPrep3 · src/world/bary-gizmo.js · bary-gizmo.html · tests/bary-gizmo-3d-browser.cjs",
      "note": "478帧全核（5张联系表+原尺寸0060/0200/0330）；灰模三角网上一个白球带RGB轴箭头，光标压在球上真拖拽：球可在三角面内拖动、可越出三角形露出负权重、可抬离平面，投影点到三顶点红绿蓝连线、顶点球径∝权重，三角形可拉窄张开。本轮把 3D gizmo 补全并出运行验收：bary-gizmo.js 加 attach()真指针拖拽（抓球改u/v、抓第三顶点改spread、Shift+拖球沿法线抬h，轴向用射线-轴线最近点）、params/state/triArea/dragStats 台账、三角边改细盒加粗、选格按周边空旷度；bary-gizmo.html 补背景三角网/机位钉住/hud=0/启动竞态。新测 tests/bary-gizmo-3d-browser.cjs 27/27：Σw=1(1.1e-16)、Cramer差1.1e-16、|P-面|=h、拖球落点u=0.72v=0.14、拖出后inside=false w=[0.87,-0.22,0.35]、spread1→1.4面积比1.39996线性、Shift抬升h+>0.1、像素A/B 2969px噪声0、0 console error",
      "project": "badnorth",
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
      "id": "974325184525201409",
      "date": "2018-03-15",
      "text": "We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefully) by making our own box-box test in two incredibly stressful hours. Behold, our beautiful viking raid planner:",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/obb.js · src/badnorth/landing-plan.js · src/badnorth/battle.js",
      "note": "504帧全核；本轮补齐岸礁后两段与动态避让：seawayBox 航道地形检测延伸 0.8→19.94 覆盖离港全程，corridorBlocked 母船航线检测（origin→泊位外沿压陆地则退回标准走廊并计 originBlocked），steerBoat 动态避让（在航船把高优先级船当障碍，先试直线再按 ±0.55/±1.1 侧偏找干净走廊、全堵停船等让）已每帧接入 battle.js in/out 两态；残差=原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似）。；【卡点·C 算法未公开】原 raid planner 多站位成串排布与真实避让机制未公开（侧让/停船是本地近似） → 永久卡点，需新证据再立项",
      "project": "badnorth",
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
      },
      "supplementaryReviewEvidence": "artifacts/coverage/landing-plan-review.md"
    },
    {
      "id": "972829402873716737",
      "date": "2018-03-11",
      "text": "If you're heading to GDC, come see my microtalk about the triangular flow fields we use for pathfinding and combat http:// schedule.gdconf.com/session/tech-t oolbox/854263 …",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js · src/badnorth/battle.js（flowLines）· flow-color.html",
      "note": "537帧全核；多源 Dijkstra 流场 + 按小队着色的格心连线已实现，三角网格父链测试通过；缺逐格白色方向箭头、网格底线，且实验页线色偏淡对比度不如片子",
      "project": "badnorth",
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
      "id": "969860566322958336",
      "date": "2018-03-03",
      "text": "My unit sprites have 1 direction, so they need to be directionally ambiguous. They are mostly symmetrical and avoid features that feel jarring when they flip. Would these sword tips be axe heads, you would notice at a glance that they are pointing in two distinct directions",
      "topic": "fx",
      "status": "done",
      "where": "src/core/sprite-ambiguity.js · src/life/unit-sprites.js · src/badnorth/battle.js · sprites.html",
      "note": "308帧全核（4张联系表+4张4×裁切）；判实：单方向贴片靠左右镜像表朝向，同屏既有剑在左也有剑在右、除镜像外完全一致，无翻转即违和的细节；实测48px 剑尖 IoU0.719/flipDiff0.185/skew0.062，斧刃0.616/0.287/0.135（最差，镜像后一眼两朝向）与原文判断一致；缺：指标非标定违和度、无逐单位UV血斑、战斗场景第0波无守军看不到成队精灵",
      "project": "badnorth",
      "decodedFrames": 308,
      "reviewEvidence": "artifacts/coverage/969860566322958336-review.md",
      "supplementaryReviewEvidence": "artifacts/coverage/ballistic-table-review.md",
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
    },
    {
      "id": "959752525867036672",
      "date": "2018-02-03",
      "text": "A great unexpected joy in this project has been writing my own navmesh. It's an oddly relaxing job full of small and approachable math-puzzles. Here you see some pulsating vertex cells; a dual to the triangular grid and a suitable place to start with foliage placement.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js · gridpatch.html?grid=quad",
      "note": "31帧全核；脉动曲线改为按片内量：白线像素 2154↔3153 余弦律，线性峰谷比 1.206、拟合周期 1.296s → DUAL_PULSE {0.829,1,1.3}（旧写死 .72..1.00/2.09s 太深太慢）；单测把常数与序列绑死，浏览器两档线段比 1.206、差分 48646px；只剩重心对偶口径差（原作中心规则未公开）与全局植被/导航未替换（片内未拍）",
      "project": "badnorth",
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
      "id": "959530111187013632",
      "date": "2018-02-02",
      "text": "I've been tweaking the foliage system today. It now supports multiple grass types per level.",
      "topic": "life",
      "status": "done",
      "where": "src/core/level-flora.js · src/life/vegetation.js · src/life/flora-species.js · level-flora.html",
      "note": "203帧全核（0/70/108/109/170/202原尺寸）；109帧硬切紫色雨景。r74残差收口：层绑物种组+六形程序草型几何+裁判buildFlora成丛参数（presence≈.43/丛内4–9/半径.20–.46格/缩放.55–1.25）+表面型密度调制（岸/崖边/内部近似）+雨生态色组近似（紫/灰白，同键换色）；levelFloraShapes opt-in草型各向异性、共享leaf atlas单例绑定。残差：原片美术素材与雨景天气未复现（资产缺，另记），生态切换只到色组层。",
      "project": "badnorth",
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
      "id": "958410200146497537",
      "date": "2018-01-30",
      "text": "The approach is versatile enough that I can use it for the ingame banners too",
      "topic": "fx",
      "status": "done",
      "where": "src/core/banner.js → src/life/banner.js → src/badnorth/battle.js；banners.html",
      "note": "54帧单张旗帜目录已全原尺寸复核；补六种透明尾形和五种本地白徽记，共用到实际Bezier军旗。GPU轮廓/双网格暂停风场及15资源释放通过；原作完整徽记/精确美术、布料碰撞仍未覆盖。",
      "project": "badnorth",
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
      "id": "958371606350454784",
      "date": "2018-01-30",
      "text": "The beginnings of a portrait generator. It currently runs on 5 examples (all male and with a similar hierarchy) but it's content agnostic and should support a diverse set of inputs.",
      "topic": "fx",
      "status": "done",
      "where": "src/core/part-random.js · src/ui/slot-portrait.js · ui.html?t=face&portrait=slots",
      "note": "88帧全核（sheet-00 一页 9×10 + 0000/0087 原尺寸）；同构图蓝底单人像硬切，脸形/发型/眉/眼/鼻/嘴/雀斑逐帧换、无UI无运镜。旧note「完整spec/数据接口/剪影IoU仍缺」= 过期账（第53次同型）：part-random.js 的 PORTRAIT_SLOTS/sampleSlots/portraitSilhouette/silhouetteDiversity/partSeed 与 slot-portrait.js 共用几何全在，ui.html?portrait=slots 早把 canvasMaskIoU 打在页上，缺的只是运行断言。本轮零改码，补纯逻辑+运行两支测试：24张剪影差异 0.269（均IoU 0.731）、画布剪影vs掩码 IoU 0.994、8张spec与partSeed重算逐字段一致、同seed两次截图逐字节相同（63170B）、换seed整屏变、窄屏390列数4→3 id序列0,1,2,4,5,6身份不变、画布350px不溢出、0 console error",
      "project": "badnorth",
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
      "id": "946660607008403456",
      "date": "2017-12-29",
      "text": "While @rtm223 is away on holiday I'm taking some time to focus on the important things, like making blood, corpses and arrows stick to boats and adding pretty little flowers",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle-c01.js#buildFlowers/flowerProbe · src/badnorth/battle.js#bleed(deckPool/corpseAnchor/箭attach) · index.html?scene=badnorth（?c01=-shoreFlowers 关档）",
      "note": "440帧全核（5张联系表+0150 10×/0430 8× 新裁切）；口径再纠正：所谓「白桨叶阵列」实为插在船上的白箭杆+压在上面的白尸体（空船亦有2支、倾角不规则、同帧空中有飞行箭线），r183 的「桨叶缺口」撤销；四条机制（船底连续血池/尸体贴船/箭贴船/岸上米白小花）全在。本轮把花从 shoreFoam 里拆成独立 shoreFlowers（默认开）、颜色改米白为主+点径0.05+簇内0.10，船上尸体改近白（boatCorpse #efe9dd），补只读 flowerProbe；新测 tests/battle-c01-shore-flowers-browser.cjs 18 项（20簇/110朵/每簇4-7/离地0；花开关差分494px 100%落在花点投影；噪声0、回位0；尸体贴船位姿<1e-6、箭parent=boat.mesh漂移0；血池24段opacity0→0.384）。剩余美术差：原片是整片花毯、本仓20个散簇；船上白尸体在近景被血斑盖住",
      "project": "badnorth",
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
      "id": "943230624369868800",
      "date": "2017-12-19",
      "text": "And yeah, obviously the snow flakes are affected by the wind system and thus flow around the island",
      "topic": "terrain",
      "status": "done",
      "where": "src/life/atmosphere.js（雪 Points/风场积分/逐层占用绕行）· src/core/wind-flow.js#particleContactAlpha · src/world/view.js#uSnow · flow.html 共享风场雪片 + index.html 场景能力「飘雪与表面积雪」",
      "note": "318帧全核（4张联系表+原尺寸裁切）：旧note的「Points方点/统一大小亮度/软片·接触AO未复现」=过期账——软圆片(按gl_PointCoord半径discard+smoothstep)、逐粒aSize 0.55–1.4499(901种/CV0.2598)、接触alpha(近0.2433<中0.3673<高0.5509；内0.4964>外0.4286)都在；本仓真机制=共享风场绕行(自由流沿风0.9996→环上最低0.5105、55点被压>15%、切向0.2179、上抬0.275)+体素端点碰撞(轨迹0步进入实心/直线对照7条撞进/15条被抬升推偏 maxDev 0.938 maxLift 0.365)；画面天空带提亮像素309 vs 噪声90 vs 关雪130，整幅白像素254424→760010(uSnow混白)。残差=美术/口径：片中雪帽是几何厚帽、本仓只有朝上面薄层混白，雪点密度/尺寸档比片内小，uSnow不上立面。",
      "project": "badnorth",
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
      "id": "943230620242796544",
      "date": "2017-12-19",
      "text": "I'm heading north for a few days to see the folks. In the meantime, here's some seasonally relevant hype material for @BadNorthGame :",
      "topic": "show",
      "status": "done",
      "where": "src/badnorth/theme.js#winter/frostVegetation · src/life/atmosphere.js（雪+uSnow）· src/badnorth/battle.js（长船/近战/血/烧屋）· src/life/smoke.js · index.html?scene=badnorth · tests/winter-battle-combo-browser.cjs",
      "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。本轮组合验收：真页面index.html?scene=badnorth（quad/seed7）走真实机制——UI选冬季主题+snow复选框开雪，battle.update按真实26s波次推进；守军默认布防守死屋门（defNear恒真，实测600s/24波0失守），t=20.1s按玩家移动令同款机制（squad.goal=导航可达远格cell671/门距5.74）拉开防线后维京人真占门烧屋。同屏t=55.1s第3波：2长船在场、岸上维京12+船上12、守军旗2面、血迹221实例/14杀、2屋失守2烟源110烟卡、火光开；冬景bnTheme.sky#c4c7cb、植被挂霜5/5→#a7adb5、雪3000粒+uSnow=1。冻结帧：噪声0、雪开关差分166700px、回位0、深红血像素4087、烟柱带中位亮度126.9<冬空199。tests/winter-battle-combo-browser.cjs 17项全过。剩余：原片是摆拍宣传构图（船群密度/血烟量级/机位），本验收锁元素同屏+真实机制，不主张逐帧美术等价；几何厚雪帽残差记943230624369868800。",
      "project": "badnorth",
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
    },
    {
      "id": "938422757288792064",
      "date": "2017-12-06",
      "text": "I'm extra happy with how the grouping turned out. It's a sort of cellular automaton where nodes get eaten by the neighbor group to which they are most connected. Here's a slowmo to illustrate:",
      "topic": "fx",
      "status": "done",
      "where": "src/core/region-groups.js · src/campaign/campaign.js · campaign.html 第4步",
      "note": "450帧逐格核验；保留整组合并，补加权节点边界调整、断开分量保留、真实共边网格适配及历史回放；原作精确调度未知。",
      "project": "badnorth",
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
      "id": "938405900573986816",
      "date": "2017-12-06",
      "text": "A more legible peek at the campaign generation for @BadNorthGame . Islands get spread apart and divided into regions.",
      "topic": "terrain",
      "status": "done",
      "where": "src/core/region-groups.js · src/campaign/campaign.js · campaign.html 第4步",
      "note": "323帧逐格核验；保留整组合并，补加权节点边界调整、断开分量保留、真实共边网格适配及历史回放；原作精确调度未知。",
      "project": "badnorth",
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
      "id": "938395867215728640",
      "date": "2017-12-06",
      "text": "Node graph programming is by far the most delightful programming",
      "topic": "grid",
      "status": "ref",
      "where": "",
      "note": "288帧全核；1024×128 超宽条节点图编辑器全景：菱形节点+彩色分组框+细直线，无求值/编辑过程；同族机制已在 node-graph-runtime.js 落地，分组容器属 UI 未做",
      "project": "badnorth",
      "decodedFrames": 288,
      "reviewEvidence": "artifacts/coverage/938395867215728640-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          287
        ],
        "nativeRevisits": [
          140
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "931196707236392960",
      "date": "2017-11-16",
      "text": "My generated levels all keep a virtual voxel space. It is used for light baking, soft normals, various 3D textures, simplified collision, wind simulation etc.",
      "topic": "light",
      "status": "done",
      "where": "src/core/world.js · src/core/world-probes.js · src/life/atmosphere.js · flow.html",
      "note": "223帧全核（3张联系表+原尺寸0107）；World占用/支撑/梯度探针与Atmosphere逐层真实solid风通洞1.0000对封洞0.9185；片中体素梯度软化网格法线并约束硬边仍未迁移",
      "project": "badnorth",
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
      "id": "929417420921556993",
      "date": "2017-11-11",
      "text": "Fun fact: I generate smooth normals for all my meshes and use a blend between smooth and hard normals in the final lighting",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（uNormMix）· normals-blend 实验页",
      "note": "256帧全核；片中无对照/无字幕，仅靠转角柔和过渡判读；uNormMix=0.8 与原文同法（dFdx/dFdy 求面法线后 mix），三档截图差异已量（0.8 偏平滑侧）",
      "project": "badnorth",
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
      "id": "926903893866541057",
      "date": "2017-11-04",
      "text": "Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders",
      "topic": "fx",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/wind-flow.js · src/core/world-probes.js",
      "note": "516帧全核验；按层避障/三线性风场与共享uWind保留，双网格通洞/封洞及改风向复核。完整轨迹接口已补：makeWindField解析场（dir/lift/swirl/seed定相位、种子确定）与WindPath/traceWindPath（种子点→积分轨迹→at(t)任意时刻位置、命中洞hitsHole/throughHole、出界exitIndex/status、blocked），Atmosphere.tracePath/windField在共享场上同形包装；局部场GPU采样此前已由packWindField/windFieldGLSL/samplePackedWind落地（CPU replica对拍<1e-5）。tests/wind-trajectory.mjs验确定性/轨迹守恒/通洞·封洞·避障/出界；原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项）；【卡点·C 算法未公开】原片风场精确解算器未公开，只能以解析近似场/共享体素分层场近似（永久卡点，需新证据再立项） → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "badnorth",
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
      "id": "926890207298899969",
      "date": "2017-11-04",
      "text": "Not really. I build a custom mesh for the flag using a bezier curve along virtual wind particles",
      "topic": "life",
      "status": "done",
      "where": "src/badnorth/battle.js（#flag / #updateFlag）",
      "note": "保留已有风粒子/Bezier及暂停修复；本批续用旧视频不重复计数，新补958410200146497537的徽记/透明分叉尾并接入真实军旗，双网格通过。原作完整画稿和布料碰撞仍有边界。",
      "project": "badnorth",
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
      "id": "926834721392340992",
      "date": "2017-11-04",
      "text": "The banners where due for a makeover. I built a wind system to get them flapping just right",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（真实dt/Bezier军旗）",
      "note": "保留已有风粒子/Bezier及暂停修复；本批续用旧视频不重复计数，新补958410200146497537的徽记/透明分叉尾并接入真实军旗，双网格通过。原作完整画稿和布料碰撞仍有边界。",
      "project": "badnorth",
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
      "id": "917405214638006273",
      "date": "2017-10-09",
      "text": "A somewhat major breakthrough in my procedural generation: a heuristic for deliberately generating navigable levels",
      "topic": "grid",
      "status": "done",
      "where": "src/badnorth/island.js · src/world/navlayer.js · nav-walk.html",
      "note": "834帧全核；可走图调试层与片子同款（每格一点+邻格黄线，跨台阶边 183 条），生成后按 nav 削台（削 2 档、最多 6 轮）并记台账；缺格角红点、背景网格线框，削几档是自定",
      "project": "badnorth",
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
      "id": "913407568730615808",
      "date": "2017-09-28",
      "text": "Ok, I'm proud of this one. Can any of you brainy nerds figure out what we're looking at here?",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "464帧全核；彩色线框长方体绕岛径向排布+地面白圈，是作者调试可视化但原文故意不说明编码哪个量，画面无法唯一确定，不落地",
      "project": "badnorth",
      "decodedFrames": 464,
      "reviewEvidence": "artifacts/coverage/913407568730615808-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          463
        ],
        "nativeRevisits": [
          1,
          230
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现（编码量未定）"
      }
    },
    {
      "id": "912691357440978945",
      "date": "2017-09-26",
      "text": "Long time no combat gifs",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle-c01.js · SKY_BEAM_UNIT_STEPS · tools/beam-transmission.py",
      "note": "759帧全核（sheet-02 0200-0299 + 4× 裁切 278/288）；新工具 beam-transmission 用柱后残余对比度反解 α，自检最坏误差 0.442 判不可用于绝对 α；实测 0288 残余 11.98/柱外 44.55/噪声 5.12 → α≈0.83，4× 目视也能看到岩边透出 → 推翻 r100 的峰值 α=1.00（那是 cal_alpha 假设），改记 0.7-0.85；【第62轮 A 类收敛】残差=烧焦痕与血泊不规则扩散，崖壁竖斑/崖脚积血机制等价且已量化，判为 done",
      "project": "badnorth",
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
      "id": "911913981731885056",
      "date": "2017-09-24",
      "text": "I'm looking at the campaign map. Saving island snapshots to 64² textures and then crisping them back up with some shader magic",
      "topic": "terrain",
      "status": "done",
      "where": "src/world/island-snapshot.js · snapshot.html",
      "note": "11帧全序列核验；真实World 64²截图、成功/异常状态恢复及GPU导数alpha边缘通过；原作通道/精确shader未知，战役全量缓存接入另待补。",
      "project": "badnorth",
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
      "id": "906425294533394432",
      "date": "2017-09-09",
      "text": "It's like navigating a Swiss cheese",
      "topic": "fx",
      "status": "done",
      "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/world/fine-portals.js · src/badnorth/battle.js · navigation.html",
      "note": "246帧已复核：共享 World 枚举洞底/洞顶多层的分层导航接入真实Battle（层选择/单位高度/路径/近战与箭矢占用遮挡，两种网格穿洞封洞验证）；剩余精细门户/侧壁收口——BattleNavigation finePortals 拱脚收窄+形变侧壁+脚高插值经单测、nav-arch-demo 与十二门徒实景管线验收，本项目舞台默认开。「单位不能穿洞」已被合成场地实证推翻：nav-through-synthetic 坐标轨迹（拱南→拱北 80 帧真经拱柱格、开档 0 擦墙帧/关档 7 帧）。实景四场景只有死角拱、无瑞士奶酪式通路拱场地（nav-arch-through 实测，场景几何限制非代码缺口）。",
      "project": "badnorth",
      "learned": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。",
      "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
      "decodedFrames": 246,
      "clearanceEvidence": "artifacts/coverage/unit-clearance-review.md",
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
      "id": "906416813810049025",
      "date": "2017-09-09",
      "text": "New cave tileset. These levels really challenge your spacial skills #screenshotsaturday #madewithunity @BadNorthGame",
      "topic": "fx",
      "status": "partial",
      "where": "src/badnorth/island-caves.js · src/badnorth/island.js · src/world/battle-navigation.js · src/badnorth/battle.js · tests/bncaves-island-battle.mjs · tests/bncaves-island-browser.cjs · index.html?scene=badnorth&bncaves=3",
      "note": "725帧全核，紫色厚岩拱洞/多层战斗与船只。r56 已落 ?bncaves 洞穴岛变体（island-caves.js：穿山隧道、洞底与低地平接、净空2层、顶岩≥1层）；r214 残差核销——真实岛行为验收：穿山隧道洞底层内部成链（相邻洞格 floor f 互通+两端各接洞外低地）、nav.plan 全程洞底层穿隧真进洞格、同格洞底/板顶双节点共存且跨层 canMelee 拒、真实 Battle 守军 squad.goal/goalFloor 下令经洞底走到隧道远端格、维京长船照常 planLanding 靠岸卸人（tests/bncaves-island-battle.mjs，quad/mixed 双网格 PASS）；浏览器验收 index.html?scene=badnorth&bncaves=3 真页面（3 穿山/7 洞格双节点/长船出场卸人上岸/开关洞截图像素差 697505/控制台零 error，tests/bncaves-island-browser.cjs）。裁判库 cavepath.js 比例对账一致：净空2层≈ZCROWN 1.80、顶岩≥1层≈band 0.90、板顶高出洞底3层≈ZTOP 2.70（world.top−floor===3，naive 单值高度场错3层在真实岛复现）；裁判拱跨4格 vs 本仓1格宽体素洞记为尺度口径差异。；【卡点·B 美术资产】原片紫色洞穴 tileset 美术资产（贴图/模型/圆拱造型/UI 稿）没有源素材，程序化体素洞只能近似；拱跨4格对1格属 tileset 尺度设定非机制缺口 → 卡在原片美术资产，需新证据再立项",
      "project": "badnorth",
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
      "id": "906207980802252801",
      "date": "2017-09-08",
      "text": "I've been working on some new fog (sped up in the gif). For background effects, subtlety is key.",
      "topic": "fx",
      "status": "done",
      "where": "src/life/atmosphere.js · src/core/fog-envelope.js · wake-fog.html",
      "note": "326帧全核（4张联系表+2张原尺寸）；雾=岛周大圆盘环带+12片贴水软片（随风平流/侧向绕障/停等/出环回卷/高度带1.35/低对比）；本轮补流速档真正作用到雾片（step rate + 片元 uTime*uSpeed，默认1逐像素等价）、wake-fog.html 页头纠正旧口径「圆盘近似」并加实时读数、新增 fogStats/wispStats 只读账；新测 fog-wisps.mjs + fog-wisps-browser.cjs（流速0严格冻结/流速2恰2倍/风向余弦1.000/只雾片层开差10304px/两层27488px最大27级/噪声0）",
      "project": "badnorth",
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
      "id": "903647529203634176",
      "date": "2017-09-01",
      "text": "Spears are so weird to implement. I can see why most games don't use them",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js · src/core/spear-thrust.js · tests/spear-hit-popup-browser.cjs · tests/spear-tilt-browser.cjs · tests/spear-brace.mjs",
      "note": "654帧全核（本轮复看 sheet-01 + crop-0120/crop-0300）；三项缺口全闭：①待机斜举 40° / 刺出压平 / 收矛线性抬回（spear-tilt 40.00→0.00→20.00）；②所谓「粉红放射命中线」复看确认是整排压平的偏粉矛杆 + 白锥矛头（braced，杆长前探 0.38），不是独立特效；③伤害飘字与刺击命中集已同源——thrust 分支先拿 stepSpearThrust 的 hits 再逐个 #hit，本轮补联动度量（hitSet/thrustFrames/lastThrust*）与验收：一刺穿两人 totalHits 2 = hitSet 2 = popups 2、两敌各只掉 1 血、每帧 popups==hits、致命刺 popups = hits+kills 且 damage:4 与 kill:10 各一条",
      "project": "badnorth",
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
      "id": "902103473365417984",
      "date": "2017-08-28",
      "text": "Ok, one more visualization. Distances this time. I really should get back to proper work now",
      "topic": "show",
      "status": "done",
      "where": "src/core/distance-isolines.js · distances.html · src/badnorth/battle-c03.js#isoLinesOnMesh(distIso) · index.html?scene=badnorth&distIso=1",
      "note": "705帧全核；岛上等距亮线=距离场等值线（非流向继承），EDT 与暴力解一致。本轮三项残差全闭：①3D 多层台阶投影——battle-c03.js distIso 档的 isoLinesOnMesh 走渲染网格表面测地距离（marching triangles，源=海平面顶点），线爬崖壁/台阶立面；tests/c03-battle.mjs mock 补第二级侧挑高台（y=1.0），断言高台顶面≥4段+立面≥3段；②任意多边形占地——distance-isolines.js 新增 polygonDistance（有向距离、偶奇判内、凸/凹/斜边通吃）+ distanceField obstacles 选项（格心入形→0、外部取精确边距与 EDT 取 min、at() 同步精化），distance-isolines.mjs 新增 11 项：菱形斜边 0.4/√2 亚格、Steiner 偏移环长≈19.7、贴边偏差≤0.025；③battle.js 调试接入——BattleC03 挂 battle.js 构造/start/stop/afterDraw，?distIso=1 或 c03.set('distIso',true) 打开，默认关不影响战斗；distances.html 补菱形塔楼占地消费者（两图描真实斜边对照）",
      "project": "badnorth",
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
    },
    {
      "id": "902069261304287232",
      "date": "2017-08-28",
      "text": "Just for fun: visualization of data inheritance in my flow/distance/influence fields",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js(buildLayeredFlowField) · src/badnorth/battle.js(#drawFlow/update 流场重建/start 默认连续流) · src/badnorth/battle-g3.js · index.html?scene=badnorth&shade=flow,flowunit",
      "note": "389帧全核（sheet-00…03，本轮重看 sheet-00）；三项数据继承逐节点对账闭合：真实导航图 386 节点中「继承到最近源」386/386（三源独立 BFS 对账）、继承兵种 386/386、继承方向 382/386=98.96%、dist 全有限；可视化 395 格格网/3160 格边/按兵种上色 flowTypeColors=3（场景步兵8/矛兵8/弓手8，图例逐兵种计数）；LOD 维持不适用（r75 实景三档量测已否证）。曾挂 next 的最后一条 continuousFlow 未接 battle 本轮闭合：battle.js start() 默认传 true、g3 缺省继承 nav 并支持 ?continuousFlow=0，新测 tests/flow-battle-rates-browser.cjs 跑 30/60/120Hz（arrived 7/7/6，逐面常量对照 7，steer 1650/3349/8179，关档 steer 0）。battle-navigation-browser 隧道段为既有红（关连续流同样红），与本轮无关。",
      "project": "badnorth",
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
      "id": "901842167508992000",
      "date": "2017-08-27",
      "text": "Made my flow/influence fields even smarter: In addition to distance and direction to nearest unit, it can now tell you what type they are",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js(buildLayeredFlowField 的 src 继承) · src/badnorth/battle.js(#drawFlow palette byType/源 type) · src/badnorth/battle-g3.js · index.html?scene=badnorth&shade=flow,flowunit",
      "note": "571帧全核（sheet-00…05，本轮重看 sheet-03）；「除了距离和方向，还能告诉你最近单位是什么兵种」这条本轮量出来：386 节点里继承源=最近源 386/386、继承兵种=最近源兵种 386/386、方向 382/386；flowColorBy=type 下 flowTypeColors=3（步兵8/矛兵8/弓手8 三支守军同屏），r70 的「表外兵种并成第一种色」不复现。LOD 第三次否证维持不适用（固定等轴整岛入画，无近远差）。唯一硬条目 continuousFlow 未接 battle.js 已闭合：battle.js start() 默认传 continuousFlow:true，battle-g3 缺省继承 nav 且支持 ?continuousFlow=0；新测 tests/flow-battle-rates-browser.cjs 三档 30/60/120Hz 全 PASS（arrived 7/7/6 vs 逐面 7、steer 1650/3349/8179、关档 0）。回归 layered-continuous-flow/navmesh-battle-flow/battle-navigation/battle-g3 全 PASS。battle-navigation-browser 隧道段是既有红（关连续流同红），留待下轮。",
      "project": "badnorth",
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
      "id": "901469409579061248",
      "date": "2017-08-26",
      "text": "Working on nicer ship wakes",
      "topic": "water",
      "status": "done",
      "where": "src/life/boats.js（corridor 切档 + 平行带状边线 + wakeProbe）· src/core/wake-sampling.js（advanceWake corridor / wakeFade / wakeLife / profile）· wake-fog.html ?wake= · src/world/view.js",
      "note": "138帧全核（sheet-00/01 + 0060/0120 4×裁切）：边线平行走廊、间距≈船宽3-4倍不张开，线间成排断续泡沫、远端先没泡沫后没边线，船头一小撮白。r183 只把 corridor 档写进模块，boats.js 仍跑 V → 本轮真切档：advanceWake corridor（固定横偏不外推）+ 带状 alpha 与粒子共用 wakeFade（边线 .85 / 泡沫行 1.75 两条幂律）+ wakeLife 按船长标定（边线 3.2 / 泡沫 1.5 船长，夹 1.2-6.4s）+ 船头泡沫 0.15-0.25 beam + FX_MAX 1600→2600（旧值顶到 1600 会截远端），view.js ?wake=v / wake-fog.html 下拉作 A/B。验收 mixed/quad：间距 0.5440 逐段 CV<1e-9、reach 边线 3.76/3.65 vs 行 1.10、泡沫点 1040/1122 未截断、压陆地 0、同页 V 档对照张开 5.99×、0 console error；node tests/boats-wake-corridor.mjs + wake-corridor.mjs + wake-particles.mjs 全 PASS，回归 wake-fog-browser PASS。仅剩美术差：原片连通环蜂窝 vs 本仓方块点阵。",
      "project": "badnorth",
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
      "id": "880853661936734211",
      "date": "2017-06-30",
      "text": "Units got stuck when meeting in narrow passages. I fixed it by introducing left handed traffic. Never felt so clever.",
      "topic": "fx",
      "status": "done",
      "where": "src/world/traffic.js · src/world/battle-navigation.js · src/badnorth/battle.js",
      "note": "601帧已复核：左行车道与常驻点线保留，体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道/多岔/体型重路由收口——nav-traffic 单测（四弯一岔一格窄道、两队 8 人对向全到、大个子放不进矮拱改走长路）+ 合成场地会车轨迹（两队共用 10 格窄道、全员到达、stuckMax 0、相向两单位最小间距 0.149）+ 十二门徒实景管线会车 8/8。traffic.js 已换最新库（R71）。",
      "project": "badnorth",
      "learned": "本轮逐帧复核601帧：原横向偏移为0，现新增窄道识别与确定左侧目标，并限制偏移在多边形内部；战斗已接入，测试相反方向车道。点线标示与拥挤压力测试仍待补齐。",
      "reviewEvidence": "artifacts/coverage/body-separation-review.md",
      "decodedFrames": 601,
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
      "id": "877995885250138119",
      "date": "2017-06-22",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "239帧全核；Bad North 实机：三支守军小队带旗幡、橙衣敌人自滩涂上岸、挥砍弧光与血迹尸体，均为已有表现，无新机制",
      "project": "badnorth",
      "decodedFrames": 239,
      "reviewEvidence": "artifacts/coverage/877995885250138119-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          238
        ],
        "nativeRevisits": [
          100,
          238
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "870558914345041921",
      "date": "2017-06-02",
      "text": "I think we've all had days like this",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "547帧全核；Bad North 实机固定机位推近：崖顶弓手站桩、拱门门洞、橙衣敌兵与地面尸体血迹，均为已有表现，无新机制",
      "project": "badnorth",
      "decodedFrames": 547,
      "reviewEvidence": "artifacts/coverage/870558914345041921-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          546
        ],
        "nativeRevisits": [
          150,
          200,
          300,
          540
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "870296307889573889",
      "date": "2017-06-01",
      "text": "Units can now get knocked off ledges",
      "topic": "fx",
      "status": "ref",
      "where": "不涉及实现（纯展示）",
      "note": "351帧全核(4张联系表全看完)；纯展示/美术片：粉藕地面+灰岩+蓝青簇状植被，无单位/建筑/崖/尘/火/血/UI，帧间差 7.5–10.1 只在植被轮廓 → 撤回 r31「落崖翻滚+落地扬尘」归属，判 ref 不涉及实现。【第197轮更正】本轮误跑 tools/close-a.mjs 被改成 done（附加理由写的是翻滚/滚落，与本片纯展示完全不符），已还原 ref",
      "project": "badnorth",
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
      "id": "797119718477991936",
      "date": "2016-11-11",
      "text": "Got some basic navigation going",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/world/fine-portals.js · src/badnorth/battle.js · navigation.html",
      "note": "265帧已复核：模块生成后内部多层活动点。共享 World 多层导航与门户边接入真实Battle（层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格穿洞/封洞验证）；剩余精细门户收口——BattleNavigation finePortals（拱脚收窄 u0≈0.15、形变侧壁、身高门槛封洞、连续扫掠）经 nav-fine-portals 单测、nav-arch-demo 演示页与十二门徒实景管线验收，TigerMessenger 舞台默认开（计划显式 false 可关）；脚高插值（navFooting 踏面 ≤0.167/步、洞底脚贴洞底）同验。合成场地穿拱行走实证：nav-through-synthetic（起点终点分在拱两侧、80 帧轨迹真经拱柱格、开档 0 擦墙帧/关档 7 帧对照）。实景四场景只有死角拱，实景穿洞受场景几何限制（nav-arch-through 实测，非代码缺口）。",
      "learned": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。",
      "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
      "decodedFrames": 265,
      "clearanceEvidence": "artifacts/coverage/unit-clearance-review.md",
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
    },
    {
      "id": "886199305522085890",
      "date": "2017-07-15",
      "text": "Dotted lines to mark narrow passages. Helps you understand what path the enemies might chose",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/world/point-floor.js（逐点物理像素下限）· src/badnorth/battle.js#setPassageDots/passageDotPx · src/badnorth/battle-c02.js#passageScreen · src/world/passage-overlay.js · passages.html",
      "note": "624帧全核（sheet-00 复看 + 0165 原尺寸裁切）；r160 挂下的最后一问「北境战斗默认仍是固定 7px 屏幕点」本轮收口：r160 翻默认失败的原因不是机制，而是量具——#passagePx() 用 px=size·(H/2)·fovK/depth 反算 size，而 three 的 sizeAttenuation 是 size·pixelRatio·(H_css/2)/depth（无 fov 因子，fovK≈2.14 被多算），把点缩到实际 1/2.14 才掉到 21.1。新增 src/world/point-floor.js：顶点着色器逐点 gl_PointSize=max(…,uPointFloor)，下限按物理像素（minPx×devicePixelRatio），解决「PointsMaterial 只有全局 size、抬 size 会钉死近端」；battle.js 默认 sizeAttenuation:true + size 0.13 + 下限 7 CSS px，新增 setPassageDots('world'|'screen') 与 passageDotPx()；battle-c02 原 passageWorld 反转为对照开关 passageScreen（?c02=passageScreen = 旧固定 7px）；passage-overlay 同装真下限并去掉 fovK（dotWorld 0.09→0.13）。读数：全岛 173 点/76 块、直径中位 5.97px 与旧档 5.97px 逐位相同、可读性 40.0 vs 40.0（可判读 0.682 vs 0.682）、点距/点径 2.21；近景点径 8.67px（1.45×）、逐点 10.93 vs 7.0；DPR2 下限 14 物理 px、远端点径 1.89×。新测 tests/passage-dots-world-browser.cjs；回归 c02-bn-fx-b / traffic-dots / passage-overlay / traffic-fade / traffic-browser 全 PASS。",
      "learned": "原文与全帧联系表核对；真实场景常驻标示，切场景隐藏；证据 artifacts/coverage/traffic-review.md。",
      "reviewEvidence": "artifacts/coverage/886199305522085890-review-r164.md",
      "decodedFrames": 624,
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
      "id": "863019585162932224",
      "date": "2017-05-12",
      "text": "TIL how to do nested/recursive coroutines. Makes writing multi-frame algorithms simpler and much more elegant. #madewithunity",
      "project": "badnorth",
      "topic": "tools",
      "status": "done",
      "where": "src/core/coroutine.js · scheduler.html",
      "note": "566帧全核（6张联系表+3张原尺寸）；画面只能证明跨多帧反复重建（碎片逐帧收拢后整块落位、中间被白雾盖住），嵌套本身不可证；运行 scheduler.html 读数 204/204格·帧26·工作量204·最大显式深度128，每帧8ops → 204/8=26 帧；缺：无对象销毁联动生命周期、单个yield不可抢占、画面不显示调用栈",
      "learned": "画面为分阶段生成展示，内部调度机制取自原文方向并由本仓库实现；合作式next不可抢占。",
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
    },
    {
      "id": "793806535898136576",
      "date": "2016-11-02",
      "text": "I gave it an extra difficult tileset to work with to make sure it can repair itself when it has screwed up",
      "topic": "grid",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/wfc.js（repairWFC）· wfc.html",
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
    },
    {
      "id": "795010582239997952",
      "date": "2016-11-05",
      "text": "I extract my adjacency data from the mesh (no tedious naming conventions needed) Plus I wrote a little tool to show which ones fit",
      "topic": "grid",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/adjacency.js · adjacency.html · wfc.html",
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
    },
    {
      "id": "810878197134950401",
      "date": "2016-12-19",
      "text": "I found a cheap way to approximate line of sight on a nav mesh. What it lacks in accuracy it makes up for in speed",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/nav-visibility.js · src/world/visibility.js · visibility.html",
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
      "id": "820977247083528192",
      "date": "2017-01-16",
      "text": "Any tips on resources and references for 2D animation? Maybe a site with gifs of good walks, deaths, attacks etc?",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle-g3.js(#sampler) · src/badnorth/battle-c02.js(swingArc) · unit-shadows.html",
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
      "date": "2017-01-17",
      "text": "（帖子无文字说明）",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle.js · index.html?scene=badnorth",
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
    },
    {
      "id": "821680056514781186",
      "date": "2017-01-18",
      "text": "By popular demand: Revenge of the Blues!",
      "topic": "game",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/unit-shadow.js · src/life/unit-shadow-batch.js · src/badnorth/battle.js · index.html?scene=badnorth",
      "decodedFrames": 763,
      "reviewEvidence": "artifacts/coverage/821680056514781186-review-r131.md",
      "note": "763帧全核（r130 八张联系表 + 本轮 frame-0020/0465 原尺寸回看）；与 8213 同一件事（单位接触软影），共用同一支浏览器验收：默认战斗 24/24 单位各一片盘、最低点 floor*L+0.008、跨格拼片 19、开/关差分 9228px、压暗 21.07 级、噪声 0；片子里「人群下方那片软暗区」「台阶交界随踏面落层」两处已在代码分支（stairAt/tread、groundAt）与人工夹具上验过；形制差（原片纯灰模对比更硬）如实记账",
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
      "date": "2017-02-02",
      "text": "Looking at unit tiers",
      "topic": "game",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/unit-tier.js · src/badnorth/battle.js · unit-tiers.html",
      "decodedFrames": 524,
      "reviewEvidence": "artifacts/coverage/unit-tiers-review.md",
      "note": "原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过。本轮补「升级机制」残差：本地最小真实机制 击杀数→等级→装备档位（unit-tier creditUnitKill：u.kills/u.level，阈值[2,5]本地解释；Battle opt-in unitPromotion，近战/矛刺/箭射手三路记账、同队误伤与死者不记、升档只写外观不回血）；tests/unit-promotion.mjs 纯函数+真Battle记账断言全过，unit-promotion-browser.cjs 双网格真渲染差分quad4560/mixed1624px+实例色对色阶。原雕饰/旗徽/原作升级经济未复现。；【卡点·B 美术资产】原雕饰/旗徽/原作升级经济（XP参数/触发时机未公开）未复现 → 升级机制已补本地最小实现（非原作复现），剩余卡在原片美术资产与未公开参数，没有源素材，程序化只能近似",
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
    },
    {
      "id": "815236105079398400",
      "date": "2016-12-31",
      "text": "irregular is the new hex",
      "project": "badnorth",
      "topic": "terrain",
      "status": "partial",
      "decodedFrames": 185,
      "reviewEvidence": "artifacts/coverage/terrace-profile-review.md",
      "where": "src/core/terrace-profile.js · terraces.html",
      "note": "原文irregular is the new hex，185帧；既有量化保留；真实World同高片/逻辑阶差面积诊断已落地（plateauRuns/stepDropArea，能力 scene.plateau-diag，擂台与复算通过），非原算法恢复。；【卡点·C 算法未公开】残差只剩原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似；未含实际变形坡面/洞内/悬垂面积",
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
      "date": "2016-09-30",
      "text": "（帖子无文字说明）",
      "project": "other",
      "topic": "terrain",
      "status": "done",
      "decodedFrames": 109,
      "reviewEvidence": "artifacts/coverage/thin-platform-climb-review.md",
      "where": "src/terrain/thin-platform.js · src/world/climb-route.js · src/core/ladder-profile.js · src/world/navlayer.js · src/capabilities/terrain.js · src/terrain/generate.js",
      "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习。本轮补齐上轮残差：薄平台机制（thin-platform.js 标记/檐位/单层放置，terrain.ledge 能力 + generate.js ledges）+ 攀爬可达（climb-route.js 通道/轨迹，navlayer 同口径消费）；库内合成/C04/生成地形用例 + 浏览器经真 vendor BattleNavigation 两段爬梯轨迹验收（run-1795511210830），avoidThinLadders 对照无路。游戏场景薄台供给与原片黄色美术未接。；【卡点·B 美术资产】游戏场景薄台供给与原片黄色美术/叠层构图未迁 → 卡在原片美术资产与场景供给，机制层已通",
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
    },
    {
      "id": "828984794407170048",
      "date": "2017-02-07",
      "text": "PRO TIP: Protect your real estate investments by keeping vikings off your homelands",
      "project": "badnorth",
      "topic": "game",
      "status": "partial",
      "decodedFrames": 387,
      "reviewEvidence": "artifacts/coverage/unit-ground-review.md",
      "where": "src/core/unit-ground-height.js · src/badnorth/battle.js",
      "note": "387帧坡地接敌/火焰/房屋焦黑；每人navFloor+footHeight踏面与1-exp(-10dt)帧率无关缓动已在，本批把同一次缓动上移覆盖全接地状态（近战/横扫/刺击/眩晕/待命不再冻在半空，坠落/船上/跃起自有y），tests/unit-ground-height-battle.mjs真Battle双楼层30/60/120Hz解析一致+缠斗/眩晕分支收敛+整队0悬空；原火球/动作/坡面未复现。；【卡点·B 美术资产】原火球/动作/坡面未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
    },
    {
      "id": "865200072685912064",
      "date": "2017-05-18",
      "project": "other",
      "topic": "grid",
      "text": "I built a small browser demo to help explain how the WFC algorithm works.",
      "status": "partial",
      "decodedFrames": 908,
      "reviewEvidence": "artifacts/coverage/wfc-trace-review.md",
      "where": "src/core/wfc.js · wfc-trace.html",
      "note": "908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；本批补逐步轨迹导出：决策帧点名决定格/选定块、矛盾帧点名掏空格与红链，wfcTraceSteps 差分逐帧缩域与回溯重开，Node 验证候选只在矛盾帧后放大；默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。；【卡点·B 美术资产】默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
    },
    {
      "id": "890611046435627008",
      "date": "2017-07-27",
      "text": "Just a birthday gif from yours truly",
      "project": "badnorth",
      "topic": "game",
      "status": "partial",
      "decodedFrames": 666,
      "reviewEvidence": "artifacts/coverage/house-door-review.md",
      "where": "src/core/house-door-presence.js · src/badnorth/battle.js",
      "note": "666帧全核，层间指令/阶梯支援/房屋遇袭和守卫。保留逐人层高，修房屋燃烧/守卫仅看XZ导致跨层干涉；双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。；【卡点·B 美术资产】双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
    },
    {
      "id": "823848950553780226",
      "date": "2017-01-24",
      "text": "O yes, I do have AO on my dust particles O yes, it does work on mobile",
      "project": "badnorth",
      "topic": "light",
      "status": "partial",
      "decodedFrames": 227,
      "reviewEvidence": "artifacts/coverage/823848950553780226-review-r218.md",
      "where": "src/core/path-samples.js · src/world/battle-navigation.js · src/badnorth/battle.js · src/badnorth/battle-c04.js",
      "note": "227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。r218 核销过期账：弧长等距采样早已落在 src/core/path-samples.js（battle.js#commandPathSamples 诊断点、battle-navigation.js#commandRibbon 约束CR→等距→贴地含踏面→净距带宽格子全链、route-preview.js 复用），command-ribbon.mjs 真Battle双网格过；本批新增 tests/path-samples-referee.mjs 与裁判 navribbon.js 逐位对拍——同一中线2密度×3步距、裁判每个采样点在本侧同弧长处位置逐位一致、length逐位等，如实差异记文件头（本侧端点必保留/法向中差+净距带宽/accept约束平滑）；尘粒AO本地近似在 battle-c04.js particleAO（?c04=dustao，c04-bn-world.mjs 贴墙0.467/成洞0.417/开阔0.82），vendor 逐字拷入 battle-c04.js+vertex-dual.js（cmp过、import闭包足）。；【卡点·C 算法未公开】原尘粒AO精确算法未公开（配文仅功能宣称、画面不足以反推），particleAO为本地近似不冒充原作 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
    },
    {
      "id": "807256278154301441",
      "date": "2016-12-09",
      "text": "Looking at cheap swarm pathfinding. These dots could possibly be crabs or maybe recently dormant soviet under-water robots. Who knows.",
      "project": "badnorth",
      "topic": "game",
      "status": "done",
      "decodedFrames": 344,
      "reviewEvidence": "artifacts/coverage/807256278154301441-review-r201.md",
      "where": "src/build/buildings.js#flatRegionRoof · src/world/app.js ?flatroof=1 · index.html?multitile=3&mth=6",
      "note": "344帧全核；新增 world.flatRoofs 平顶平台档（平台板 + 临空矮护墙/浅色压顶 + 檐下白腰线 + 平台坐烟囱，gables 恒 0），默认关、?flatroof=1 打开；多层塔夹具 11 区/16 格/39 护墙段/6 烟囱，开/关 70216px、噪声 0、开→关→开逐顶点复原；只剩护墙圆角/腰线雕花/烟囱密度等美术差",
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
    },
    {
      "id": "827216768783495168",
      "date": "2017-02-02",
      "text": "And another one",
      "project": "badnorth",
      "topic": "game",
      "status": "partial",
      "decodedFrames": 23,
      "reviewEvidence": "artifacts/coverage/squad-banners-review.md",
      "where": "src/core/banner.js · src/badnorth/battle.js · src/badnorth/squad-standard.js",
      "note": "23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。本轮补验收既有本地替身：竖旗横杆+金饰盾纹（squad-standard.js · g3 standards）Node层battle-g3.mjs已覆盖，新增tests/squad-standards-browser.cjs双网格浏览器验收（每守军一张金饰盾面24张、Bezier旗替换与恢复、公告板偏航±40°、RT差分quad230/mixed380px）。原图集/原作雕饰美术仍缺。；【卡点·B 美术资产】原图集/原作雕饰美术未复现 → 本地程序化替身已落地验收，剩余卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
    },
    {
      "id": "793545297376972801",
      "date": "2016-11-01",
      "text": "I got multi tiles and voxel AO working. Would you play a game that takes place on a building like this? Maybe if it was infinitely tall?",
      "project": "badnorth",
      "topic": "game",
      "status": "done",
      "decodedFrames": 102,
      "reviewEvidence": "artifacts/coverage/793545297376972801-review-r47.md",
      "where": "src/build/multitile-wfc.js · src/build/multitile-iso.js · multitile.html",
      "note": "102帧复看sheet-00；真实浏览器跑通：5×7×5 坍缩89步/多格8/面117、关AO面不变、回放40%面34、4×10×4 多格12/面130；缺接共享World与窗洞栏杆美术模块；【第62轮 A 类收敛】残差=接共享 World 与本仓美术模块（窗洞/栏杆），WFC+体素 AO 机制等价且量化通过，判为 done",
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
    },
    {
      "id": "793557992931266561",
      "project": "badnorth",
      "topic": "light",
      "date": "2016-11-01",
      "text": "flat -> up normal -> vertex voxel AO -> SSAO -> directional AO (With textures and baked vertex colors, I could get rid of the SSAO)",
      "status": "partial",
      "decodedFrames": 6,
      "reviewEvidence": "artifacts/coverage/ao-stages-review.md",
      "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
      "note": "6帧全核；五阶段可观察行为均有本地落点（bake.js 四档 aoMode + view-c04 SSAOPass；tests/ao-stages-coverage.mjs：格级事实与裁判逐值一致、探针顶点色一致、整镇 pearson 0.9999）；不将本地四选项冒充SSAO/方向AO。；【卡点·C 算法未公开】不将本地四选项冒充SSAO/方向AO。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
    },
    {
      "id": "806904557502464000",
      "date": "2016-12-08",
      "text": "This one goes out to @CynicatPro @EnricLlagostera @gayasoft and all the other canal lovers out there",
      "topic": "build",
      "project": "townscaper",
      "status": "done",
      "where": "src/build/canal-bridge-r56.js · src/core/arch-profile.js（archVoussoirs/measureArch）· src/build/buildings.js:117 · openings-r56.html",
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
      "date": "2016-11-26",
      "text": "（帖子无文字说明）",
      "topic": "build",
      "project": "townscaper",
      "status": "done",
      "where": "src/build/buildings.js（underside）· src/core/arch-floor-budget.js · src/core/arch-profile.js · openings-r56.html",
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
    },
    {
      "id": "816748103193817088",
      "date": "2017-01-04",
      "text": "I am flowing right on the nav mesh, so it depends",
      "topic": "nav",
      "project": "badnorth",
      "decodedFrames": 479,
      "reviewEvidence": "artifacts/coverage/816748103193817088-review-r110.md",
      "status": "done",
      "note": "479帧全核（本轮重看 sheet-00/02，余三张沿用 r48 全核记录）；三条「仍缺」本轮核实全是「已实现缺验收」：① 导航面由共享 World 分层图自动生成（navMeshFromLayeredGraph，poly 395 = graphNode 395 / 682 顶点 / 92 links），c02 调试层实画 navPolys 395 / navEdges 1447；② continuousFlow 真接进 battle.js（steerTarget → flowAim），真实 Battle 8 人 16 跳实测 steer 4941 / used 2205 / rejected 2736（adopted 0.446，回退的是通口前视）；③ 通口前视 portalAim 一直是默认路径。新测 tests/navmesh-battle-flow-browser.cjs（A/B 到达 7/8 vs 7/8、跨格 5 vs 5、0 console error）+ 回归 tests/layered-continuous-flow.mjs（过边连续 p90 0.283 rad vs 逐面常量 1.189，24 人 22 到）。1 人在起点不动是既有 move()/sep 瓶颈，关掉连续流卡的是同一个人，不构成本片机制缺口。",
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
      },
      "where": "src/world/navmesh-flow.js · src/world/battle-navigation.js(#steerTarget/#flowAim/#flowSummary) · src/badnorth/battle-c02.js(#navmesh) · navmesh-flow.html · index.html?scene=badnorth&continuousFlow=1&c02=navmesh"
    },
    {
      "id": "798580832906739712",
      "date": "2016-11-15",
      "text": "Some dirt cheap (and highly inaccurate) ray marching. Might use it for visibility when indoors",
      "topic": "light",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/space-visibility.js · src/core/vertex-openness.js · src/world/space-visibility.js · src/capabilities/layers-meta.js · src/capabilities/layers.js · space-visibility.html · index.html?c04=rayvis",
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
    },
    {
      "id": "787319655648100352",
      "date": "2016-10-15",
      "text": "More procedural tile placement. Now in 3D. Algorithm inspired by the work of @ExUtumno",
      "topic": "build",
      "project": "other",
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
};
