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
      "status": "partial",
      "where": "src/badnorth/squad-footprint.js · squad-footprint.html",
      "note": "654帧全核（7张联系表+4张原尺寸）；选中队伍脚下的占位线网=凸包轮廓+中心辐条+角上小方块，旗顶悬空白菱形、+12飘字、箭矢细白线；新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线；【卡点·D 需接主管线】新建 squad-footprint.js，缺凹形占位按格边界走/接battle.js选中态/菱形标记/箭矢线 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
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
      "status": "partial",
      "where": "src/core/field-surface.js · field-surface.html",
      "note": "192帧全核（2张联系表+3张原尺寸）；同一工具的带投影录屏，确认地形走等值面、房子是独立硬边几何；共用 field-surface.js，缺'地形圆角+建筑硬棱'的分层混合；【卡点·A 机制未做】共用 field-surface.js，缺'地形圆角+建筑硬棱'的分层混合 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "status": "partial",
      "where": "src/badnorth/ground-stain.js · battle-c01.js#stainStep · tests/stain-joint-curve-browser.cjs",
      "note": "514帧全核（sheet-00 0000-0099）；地面斑并入同一时间轴，新增 stain-joint-curve-browser 12/12：685帧采样、台阶 0.05s→0.25/3.56s→0.44/11.4s→1.00 零回落、渲染乘性特征 R 差0/G−13/B−9、地面(r−g) 5→15 单调；缺 badnorth 火光探针，火先起断言暂跳过",
      "decodedFrames": 514,
      "reviewEvidence": "artifacts/coverage/837027901853810688-review-r101.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          513
        ],
        "nativeRevisits": [
          73,
          83,
          99
        ],
        "implementationVerified": false,
        "runtimeAccepted": true,
        "acceptanceScope": "地面红棕斑 × 火光联合曲线"
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
      "status": "partial",
      "where": "src/badnorth/battle.js · unit-ground-height.js（无队列层）",
      "note": "431帧全核；石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到达集结落位，均未实现；【卡点·A 机制未做】石膏台地岛上白盔海军成列行军：队列沿路径按固定间距排队、跨台阶时拉成竖列、到位展开成3–4排方块，路径有白色引导点。缺成列行军/跨层列队/到… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "date": "2017-01-03",
      "text": "",
      "topic": "tools",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/trajectory-fan.js · trajectory-fan.html",
      "note": "177帧全核；判出Unity「Trajectory Calculator」：同一Speed/Drag按整排角度画带阻力弹道+等弧长白色方向划线（实测划线等距42–43px）。新建trajectory-fan.js/html：线性阻尼解析解+等弧长切线采样，Drag 0→2射程5.91→2.38单位、划线188→88；缺场景碰撞截断、二次阻力档、Inspector第三参数读不到；【卡点·A 机制未做】缺场景碰撞截断、二次阻力档、Inspector第三参数读不到 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "date": "2016-12-17",
      "text": "",
      "topic": "tools",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/route-preview.js · path-samples.js（均无页面入口对应此视图）",
      "note": "510帧全核；俯视调试视图：棕色三角化块体+沿可行走区密集采样(1–2px点距)的路线点串+三轴gizmo拖拽标记，点阵基本累积静止(帧间差>20仅2129px)。判为路线/轨迹采样编辑器；缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层；【卡点·A 机制未做】缺路线编辑与检查点拖拽、累积轨迹模式、块面三角剖分线调试层 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "status": "partial",
      "where": "src/world/voxel-ghost.js · voxel-ghost.html",
      "note": "117帧全核（sheet-00/01 两页）；本轮补齐：中轴竖柱装配序（49格，x/z跨度≤3，y 从0到塔顶；t=0.34 实体80格全在竖柱上、其余780格线框=先竖后横）、片尾 dolly（t>0.78 推近至1.22×）、任意网格体素化（同上共用）；仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节；【卡点·A 机制未做】仍缺真三维环绕镜头（本仓等轴测无透视环绕）、窗格/天线美术细节 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "decodedFrames": 117,
      "reviewEvidence": "artifacts/coverage/797844857821732864-review-r61.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          116
        ],
        "nativeRevisits": [
          0,
          12,
          44,
          60,
          99,
          116
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "体素幽灵：中轴竖柱序 + 片尾 dolly"
      }
    },
    {
      "id": "794993371261665280",
      "date": "2016-11-05",
      "text": "",
      "topic": "build",
      "project": "townscaper",
      "status": "partial",
      "where": "src/world/voxel-ghost.js LAYER_PALETTE/layerMaterials · voxel-ghost.html LAYER_FACES",
      "note": "158帧两张联系表全看；逐段色相量出外表面是连续漂移(H154-208°/S恒12-15%)不是6色档→LAYER_PALETTE换实测灰青族，并删掉voxel-ghost.html里抄的第二份旧色板；仍缺内部玫瑰墙(H≈355°)与bandHeight实证(片里量不出层带边界)",
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
          60,
          120,
          150
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "体素幽灵：色板与层带"
      }
    },
    {
      "id": "784848286272327680",
      "date": "2016-10-08",
      "text": "",
      "topic": "terrain",
      "project": "townscaper",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "272帧全核；planet.js 的 assemblyOrder(frontier)/assemblySlice/planetMesh(only) 三档实测 37/185/383/618 格、前沿断口侧壁可见，与片子单粒起点→前沿铺满一致；缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块；【卡点·A 机制未做】缺格内两级细分（片中一格是一坨小方块）、装配起点不可指定单格、表面生物群系斑块 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "270帧全核；与 784847933686575104 共用同一落点（装配生长/断口侧壁/薄壳/白模）；片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现；【卡点·A 机制未做】片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "date": "2016-10-08",
      "text": "",
      "topic": "terrain",
      "project": "townscaper",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "268帧全核；planet.js 补 assemblyOrder/assemblySlice + planetMesh(only)，页面加装配滑杆/白模/薄壳，铺满618格，四档顶点 5907→19797→29508→24765（铺满后断口侧壁消失）；缺装配起点可指定与格内细分；【卡点·A 机制未做】缺装配起点可指定与格内细分 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js",
      "note": "477帧全复核：线框浪带展开/到岸，绕高崖与海蚀洞；README明确生成时烘入/出方向和时间偏移。补独立aIn/aOut/aPeriod；退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。；【卡点·A 机制未做】退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1991099314714902634",
      "date": "2025-11-19",
      "text": "Got some pretty sweet new shore waves going",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
      "note": "545帧全复核：高崖岛/海蚀洞换角度，白色岸浪分段展开/聚散；README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。；【卡点·A 机制未做】README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1897266928961700215",
      "date": "2025-03-05",
      "text": "Yet another hallway design",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
      "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。；【卡点·A 机制未做】全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
      "decodedFrames": 108,
      "reviewEvidence": "artifacts/coverage/doodle-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          107
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1890018647655272491",
      "date": "2025-02-13",
      "text": "Further iterations on hallway design",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
      "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。；【卡点·A 机制未做】全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
      "decodedFrames": 243,
      "reviewEvidence": "artifacts/coverage/doodle-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          242
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1852334860137849222",
      "date": "2024-11-01",
      "text": "A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obvious.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · impostors.html",
      "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。；【卡点·B 美术资产】共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
      "id": "1849732997945110651",
      "date": "2024-10-25",
      "text": "Here, the shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in blue. The waves travel from the blue line to the yellow (and back a little). There is also a global water mask texture that adds extra foam around rocks and stuff.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-profile.js",
      "note": "437帧全复核：黄线贴岸/蓝线外推，270起红三角浪带；窄湾蓝线有交叠。修复黄线Chaikin切凸角、形变后仍用旧法线；只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。；【卡点·A 机制未做】只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1849730611964973481",
      "date": "2024-10-25",
      "text": "Shoreline waves! This is something I've tackled many times. Although this one is very subtle, it's my favorite thus far. Instead of trying to make the waves roll in and out inside one shader pass, I'm creating loads of overlapping waves that each go through their own cycle",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js",
      "note": "599帧全复核：微弱错开岸浪、镜头移位、408起红色重叠三角带。保留实际多浪带，各层烘不同周期，闭环弧长相位改整周期频率，避免接缝正弦频率不闭合。到岸opacity连续，循环端隐藏。GPU/实际双网格通过；泡沫mask/窄湾交叠仍缺。；【卡点·A 机制未做】泡沫mask/窄湾交叠仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1849427564034498642",
      "date": "2024-10-24",
      "text": "Made some octagonal impostors for these trees. Might seem like overkill for such a stylized look, but they're a lot more stable when rotating the camera than all other billboard solutions I've tried, which is kinda important.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · impostors.html",
      "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；原球面卡片/多俯仰仍缺。；【卡点·A 机制未做】原球面卡片/多俯仰仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1798310423554658732",
      "date": "2024-06-05",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "partial",
      "where": "src/core/field-plots.js · fields.html",
      "note": "614帧全核；新片是六边格地形工具实录：农田按地块共用耕纹主轴并中线折成人字，本仓原为逐格hash随机角，已新建 field-plots.js 并加 fields.html 左右对照；尚未接回 terrainmesh 实际着色；【卡点·D 需接主管线】尚未接回 terrainmesh 实际着色 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "next",
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
      "id": "1795831296952041691",
      "date": "2024-05-29",
      "text": "I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)",
      "topic": "terrain",
      "status": "partial",
      "where": "src/world/navgraph.js · river-nav.html",
      "note": "598帧全核验；实际高差优先、平床河口距离，未知方向保持中性河费用；Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。；【卡点·A 机制未做】Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "status": "partial",
      "where": "planet.html（现有网格；纹理流程待补）",
      "note": "242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法；已有planet网格不等于原纹理，代码待实现验收。；【卡点·C 算法未公开】242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      "id": "1781405550061687016",
      "date": "2024-04-19",
      "text": "Ok this might not look like much but I've got seamless patch blending! Some of the patches are projected (like the grass and the water) and some are manually UV-mapped (like the shoreline). With some good textures and some height based blending this is gonna be great.",
      "topic": "water",
      "status": "partial",
      "where": "src/terrain/terrainmesh.js（本地混色保留）· patch纹理接口待迁移",
      "note": "219帧全核验：球面投影草/水与手工UV岸带，119附近atlas窗口移入后移出；原文将高度混合列为后续设想。纠正顶面颜色平均=该patch算法的归因，保留本地混色成果；投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。；【卡点·A 机制未做】投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1769691526924292506",
      "date": "2024-03-18",
      "text": "Mega river system! I've had trouble making good rivers before. Now I've sort of special cased the rivers by collapsing them depth-first to let them wiggle real far, and then the rest is collapsed breadth-first, making nice gentle slopes that only occasionally meet steep cliffs.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js",
      "note": "194帧全核验；已有DFS开挖/局部削岸保留，不能冒充球面河道约束坍缩＋其余BFS缓坡，完整生成本批待实现。 复用194帧续作，汇水累计/出口树接共享World真实河网，双网格6组局部通过；完整球面WFC/BFS仍缺。；【卡点·A 机制未做】完整球面WFC/BFS仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1769641473895432220",
      "date": "2024-03-18",
      "text": "In cute tile based planets like this you often get a \"mushrooming\" issue where tall mountains get weirdly wide. I managed to mitigate this by a relax pass where all module-containing cells try to achieve their desired shape and size. Note the cells on the top left contracting.",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "479帧全核验；保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。；【卡点·A 机制未做】保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1768627849529893109",
      "date": "2024-03-15",
      "text": "For reasons I will not be explaining at this point I've gone and put this on a sphere",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "229帧全核验；现有对偶柱群球面能力保留，原片平滑海岸/模块视觉与平面World/游戏接入仍缺，本批仅学习审核。；【卡点·A 机制未做】现有对偶柱群球面能力保留，原片平滑海岸/模块视觉与平面World/游戏接入仍缺，本批仅学习审核。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1765115069837221962",
      "date": "2024-03-05",
      "text": "Here, I'm visualizing the recursive tree parsing as it adds new rects. Note that when the board is more fragmented the arm tends to have more fingers.",
      "topic": "life",
      "status": "partial",
      "where": "src/core/atlas.js · grids.html?t=atlas",
      "note": "247帧全核验；真实树查询事件与暂停/拖动、显式栈统计通过。保留first-fit叶内切分，不以模拟手臂代替原遍历；原3D树/跨叶候选待补。；【卡点·A 机制未做】原3D树/跨叶候选待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1765041830461055127",
      "date": "2024-03-05",
      "text": "Now supports removing rects too! The bin space gets quite fragmented after a while though.. I've tried to optimize it on the fly but I can't figure out how to when it get sort of interlocked. Still packs tight though!",
      "topic": "tools",
      "status": "partial",
      "where": "src/core/atlas.js · grids.html?t=atlas",
      "note": "558帧全核验，侧视彩块变薄不能误认为删除；重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。；【卡点·A 机制未做】重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1764958522398146667",
      "date": "2024-03-05",
      "text": "A cute binary tree rect packer. Generating the placement attempts is kinda brute force (to get into all the nooks and crannies), but then it's using the tree properly for fast collision checks. I think this is the first time I've actually written a proper space partion tree. Fun.",
      "topic": "life",
      "status": "partial",
      "where": "src/core/atlas.js · grids.html?t=atlas",
      "note": "296帧全核验；可选边角/有界随机候选、树剪枝碰撞与跨叶分配/key释放；9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。；【卡点·A 机制未做】9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "status": "partial",
      "where": "src/water/reflection.js · src/world/view.js",
      "note": "516帧全核验：高崖、低平教堂、中高教堂岛依次转动，反射轮廓/颜色克制；原文没有公式。保留共享几何近似而不冒称原作算法，新增实际场景颜色混合/扰动/线框对照；完整反射投影/遮挡仍缺。；【卡点·A 机制未做】完整反射投影/遮挡仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js",
      "note": "复用552帧，显式patch/搜索/几何后接共享World原子体量放置、支撑占用预检和按列撤回；完整prefab/socket、形变碰撞及补网/WFC待续。；【卡点·A 机制未做】完整prefab/socket、形变碰撞及补网/WFC待续。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
      "decodedFrames": 552,
      "reviewEvidence": "artifacts/coverage/module-volume-review.md",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1727324352264474664",
      "date": "2023-11-22",
      "text": "Yeah that actually looks pretty good. I did not expect that.",
      "topic": "show",
      "status": "partial",
      "where": "src/core/camera-motion.js · src/world/view.js（历史帧近似）",
      "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。；【卡点·C 算法未公开】结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      }
    },
    {
      "id": "1727315611959865407",
      "date": "2023-11-22",
      "text": "I've shipped two whole games with orbital cameras and not once have I previously though about adding motion blur smear. What a fool I am.",
      "topic": "light",
      "status": "partial",
      "where": "src/core/camera-motion.js · src/world/view.js",
      "note": "337帧全核验。保留上一批历史帧/释放修复，新增按dt换算的历史留存，30/60/120Hz实际渲染参数通过；原片方向性轮廓拖抹、速度场与全指标接口仍待补。；【卡点·C 算法未公开】原片方向性轮廓拖抹、速度场与全指标接口仍待补。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      }
    },
    {
      "id": "1724449858369568780",
      "date": "2023-11-14",
      "text": "Ok, here's a small example. The button toggles a ScriptableObject bool. The FloatSelectNode component listens to that ScriptableObject, and then a series of node-like components end up moving a piece of UI",
      "topic": "tools",
      "status": "partial",
      "where": "src/core/node-graph-runtime.js · node-graph.html",
      "note": "134帧全核（sheet-00/01 两页）；本轮补齐序列化：serialize/fromJSON/NODE_REGISTRY，导出含节点type+params+连线+lerp当前值（往返后位置-202.9不跳回、90帧轨迹逐帧一致差<1e-9）；sink 上次值移入 state 避免载入误触发；页面新增只读连线图（7框6线、框内实时值）与导出/载入；仍缺可拖拽的真实节点编辑器；【卡点·A 机制未做】仍缺可拖拽的真实节点编辑器 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
      "decodedFrames": 134,
      "reviewEvidence": "artifacts/coverage/1724449858369568780-review-r61.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          133
        ],
        "nativeRevisits": [
          1,
          20,
          50,
          90,
          133
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "节点图序列化往返 + 只读连线图"
      }
    },
    {
      "id": "1714613599035863191",
      "date": "2023-10-18",
      "text": "Another strange texturing style. This time trying to look a bit like abstract fields. A nice thing is they show the game tiles quite clearly. In the end I probably want a mix where some areas are more man made and others more natural.",
      "topic": "build",
      "status": "partial",
      "where": "src/terrain/field-pattern.js · terrainmesh.js · WorldMesh/View",
      "note": "620帧全核验：条纹弯曲随格块换向，浅崖横带；135/256/473/571附近空屏后换岛，依次出现黑轮廓、无光材质、亮面和田纹；不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完成原作手绘纹样与投射atlas。；【卡点·B 美术资产】不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      },
      "page": "fields.html",
      "toggle": "fields"
    },
    {
      "id": "1712088611934371876",
      "date": "2023-10-11",
      "text": "Another take on a palette authoring tool",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/palette-patch.js · src/world/view.js · palette-editor.html",
      "note": "624帧全核验。四角/白三角/取样色带与OkHsl/OkLab/Srgb菜单可见；新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。；【卡点·A 机制未做】新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1710031224838771027",
      "date": "2023-10-05",
      "text": "Ok here's a probably horrible way to author color volumes. The idea is to properly define the whole color possibility space for each feature",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/color-volume.js · src/world/view.js · color-lab.html",
      "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面；其他特征、离散采样和原版完整接口待补。；【卡点·A 机制未做】其他特征、离散采样和原版完整接口待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1708815475801505819",
      "date": "2023-10-02",
      "text": "a cool cliff I came across",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/features.js · shape.js · src/core/deformation-guard.js",
      "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。；【卡点·C 算法未公开】共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
      "page": "overhang.html",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1707497006640365880",
      "date": "2023-09-28",
      "text": "And here's a couple more being generated",
      "topic": "show",
      "status": "partial",
      "where": "src/terrain/shrub-band.js · meshwriter.bandTri · terrainmesh.js:236 · shrub-band-peredge-browser.cjs",
      "note": "600帧全核（sheet-00 0000-0099 + 4× 裁切）；逐三角带宽机制在位，本轮同口径重测：P50 4px 对上原片 4-6px，P90 10px vs 原片 14-18px 差一档→SHRUB_BAND.max 上沿偏低但机位不可比未改常数；splitCells 边缘带走向仍未对照",
      "project": "next",
      "decodedFrames": 600,
      "reviewEvidence": "artifacts/coverage/1707497006640365880-review-r101.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          599
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "灌木逐三角带宽（per-triangle aBand）"
      }
    },
    {
      "id": "1707490932017279035",
      "date": "2023-09-28",
      "text": "They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are.",
      "topic": "light",
      "status": "partial",
      "where": "src/terrain/shrub-band.js · meshwriter.bandTri · terrainmesh.js:236",
      "note": "257帧全核（sheet-00 0000-0099）；特写里橙斑在相邻三角上 22/12/7px 依次换档、边界两侧各自恒定，机制确认；本片 salmon 13.17%/P90 22px 是更近特写，不能直推倍率上沿",
      "project": "next",
      "decodedFrames": 257,
      "reviewEvidence": "artifacts/coverage/1707490932017279035-review-r101.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          256
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "灌木逐三角带宽（per-triangle aBand）"
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
      "status": "partial",
      "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
      "note": "300帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。；【卡点·C 算法未公开】实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      }
    },
    {
      "id": "1704246032626762189",
      "date": "2023-09-19",
      "text": "Ok, I think maybe this is a bit of a sweet spot. It's got a nice variable density texture to it. There are some height segmentation lines to help with readability, but they don't feel too synthetic.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
      "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。；【卡点·B 美术资产】本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
        "acceptanceScope": ""
      }
    },
    {
      "id": "1704218784028905984",
      "date": "2023-09-19",
      "text": "I tried some texture based shadows. Note the shadows on the grass and along the roof edges. Looks kinda cool, but feels a bit too 3D for what I'm going for this time. I feel like it clashes with lines, and I like lines more.",
      "topic": "light",
      "status": "partial",
      "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
      "note": "335帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。；【卡点·C 算法未公开】实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      }
    },
    {
      "id": "1703750394164199473",
      "date": "2023-09-18",
      "text": "Looking at my procedural stylized ground texturing again. Really like the swirly blobbyness of these. They feel kind of damp for some reason.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/world/view.js · blotches.html",
      "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。；【卡点·B 美术资产】本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
        "acceptanceScope": ""
      }
    },
    {
      "id": "1699146321318314094",
      "date": "2023-09-05",
      "text": "Oh! And now I finally figured out how to make non-straight sedimentary lines! Most of the texturing math is kinda linear, so I though the lines had to be linear too. But I could (obviously) just make the whole world wobbly, do the texturing math, then simply undo the wobble.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。原作场未知，不宣称完整通用3D逆场和原CPU指标API迁移。；【卡点·C 算法未公开】本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。原作场未知，不宣称完整通用3D逆场和… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
        "acceptanceScope": ""
      }
    },
    {
      "id": "1699038611125985317",
      "date": "2023-09-05",
      "text": "Looking att sedimentation lines again. Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。原作图案密度/配色/反射与阴影一致性仍待补。；【卡点·B 美术资产】双网格GPU通过。原作图案密度/配色/反射与阴影一致性仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
        "acceptanceScope": ""
      }
    },
    {
      "id": "1696896119794479541",
      "date": "2023-08-30",
      "text": "On the other hand, I've always wanted to make a game in the Art Nouveau style. This might be a good fit. Look how neat and controlled the grass blotches bleed over the cliff edges.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/terrainmesh.js",
      "note": "550帧全核验。保留已有沿形变崖面圆瓣草边几何；这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。；【卡点·A 机制未做】这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1696864977171189980",
      "date": "2023-08-30",
      "text": "I'm slowly emerging from a huge refactoring... While this here is not exactly the look I'm going for, it's showing off a big improvement to the texturing. I'm now able to draw with much bigger blotches without the blotches bleeding across and messing up important edges.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/world/view.js",
      "note": "502帧全核验。共享View修复绿色屋顶被地面笔触误染：显式顶面标记+法线/颜色筛选，按真实levelHeight选层。实际材质GPU对照排除屋顶/岩壁、双网格通过；原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。；【卡点·B 美术资产】原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1677242779162877952",
      "date": "2023-07-07",
      "text": "I am (once again) rewriting my generic triangle graph system to (hopefully) be more robust and generic. Here's a stress test where I'm adding random verts, making sure the graph stays mainifold and delauney-ish along the way.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/trigraph.js · trigraph.html",
      "note": "白色三角线框扩展、不规则外轮廓和局部彩边变化；画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。；【卡点·A 机制未做】画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1671840905957978113",
      "date": "2023-06-22",
      "text": "Hmm.. I thought it was gonna be too wacky but maybe it's kinda cool",
      "topic": "show",
      "status": "partial",
      "where": "src/core/terrain-burial.js · terrain-stages.html",
      "note": "246帧全核（原判na有误）；抬地面吞建筑的体素规则已落地（terrain-burial.js + terrain-stages.html 掩埋栏），peeking 3/吞12层；缺墙裙残留与悬檐联动；【卡点·A 机制未做】缺墙裙残留与悬檐联动 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1671808851895627776",
      "date": "2023-06-22",
      "text": "If your terrain generator supports overhangs you gotta flaunt it. I don't make the rules, but I do follow them.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/rock-topology.js · terrain/features.js · terrainmesh.js",
      "note": "303帧全核验：岩檐、柱间空洞、下层地面与环绕低机位。保留已有World分层rock及侧/底面，补岩石区间/空隙/level1连通诊断；真实双网格底面6顶点、断开支撑可报1未连岩石。薄岩檐平滑形变仍收缩，视觉未等价；原版软坡/侵蚀有效生成与完整接口待补。；【卡点·A 机制未做】原版软坡/侵蚀有效生成与完整接口待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
      "page": "overhang.html",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/core/grid.js · grids.html?t=kinds",
      "note": "610帧全核验；修“纯方格”仍有三角的误标，新增真正正交方格，保留合并菱形对照，局部Canvas/WorldMesh通过；独立六边地形/原模块仍缺。；【卡点·A 机制未做】独立六边地形/原模块仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1670725072540106755",
      "date": "2023-06-19",
      "text": "Here's a comparison showing no-, dumb- and hierarchical smoothing. The hierarchical smoothing helps preserve the intent of the input-tiles while smoothing out the jankyness from the weird underlying grid and from the limited slope angles in the input tileset",
      "topic": "grid",
      "status": "partial",
      "where": "src/terrain/shape.js · hierarchy.html",
      "note": "164帧全核验，原片依次切换三模式；保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。；【卡点·A 机制未做】保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1670720537662836736",
      "date": "2023-06-19",
      "text": "I smooth my mesh according to an edge type hierarchy. Black is hard, red is game-tile-border and blue is material-border. Verts only get to pull at equal or lower order verts, and only along the appropriate edges",
      "topic": "build",
      "status": "partial",
      "where": "src/terrain/shape.js · hierarchy.html",
      "note": "102帧全核验；共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。；【卡点·A 机制未做】共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1670064751181791233",
      "date": "2023-06-17",
      "text": "I figured out how to mimic Thread.Sleep() in Burst! Just store time in a static unsafe NativeArray! Then you can write to it from the main thread and read from it inside a job! Probably super bad in many ways but good enough for visualization and debug!",
      "topic": "tools",
      "status": "partial",
      "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
      "note": "420帧全核；累积分阶段执行器+共享时钟+每tick预算慢放已落地（StageRunner/advance）；缺真job线程与四轮节奏还原；【卡点·E 环境不具备】缺真job线程与四轮节奏还原 → 卡在环境（job/线程、主机性能基线），本机实验页验不了",
      "project": "next",
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
      "id": "1669315384619540487",
      "date": "2023-06-15",
      "text": "The generator consistently spits out pretty cool islands now",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js · src/core/terrace-edges.js · terraces.html",
      "note": "649帧全核验，多岛成果/构建过渡与转镜；完整软坡/模块联合生成和原美术质量仍待补，本批仅学习审核。 旧649帧续作：真实World共格边层界/线框/岸界及笼投影局部验收；原完整生成/倒角一致性未完成。；【卡点·A 机制未做】原完整生成/倒角一致性未完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
    },
    {
      "id": "1666429884208381953",
      "date": "2023-06-07",
      "text": "I've been banging my head against various shore line rendering options for a good week now. Gonna stick with this for now I think, which is basically just a refined version of what I did for Bad North and Townscaper.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
      "note": "630帧全核验：旋转/固定高崖岛，凹湾与白色岸裙细微聚散；原文只说Bad North/Townscaper改良版，不证明具体距离算法。共享水层改规范绕序/按左侧陆地转向及自接闭环分解，1024组合及实际双网格通过；蓝线窄湾交叠/泡沫mask仍缺。；【卡点·A 机制未做】蓝线窄湾交叠/泡沫mask仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1664566546683899905",
      "date": "2023-06-02",
      "text": "Here's a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters I guess... But I would like something with a bit more punch this time. A bit more crashing waves.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-profile.js",
      "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过，独立原版buildShoreDistance API未迁移。；【卡点·C 算法未公开】真实双网格通过，独立原版buildShoreDistance API未迁移。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1664565063552847873",
      "date": "2023-06-02",
      "text": "I'm trying out using a shader based fluid simulation. But I'm skeptical. It seems to need 32 bit float render targets, and I don't trust that those will work across platforms. Might also be a challenge to tweak, stylize, and feed back to CPU if needed.",
      "topic": "water",
      "status": "partial",
      "where": "src/world/float-probe.js · float.html",
      "note": "117帧已核验；本环境16F/32F写入、负值/HDR回读和线性过滤通过；跨平台及平流/CPU误差待补。；【卡点·E 环境不具备】跨平台及平流/CPU误差待补。 → 卡在环境（job/线程、主机性能基线），本机实验页验不了",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1654401054828638214",
      "date": "2023-05-05",
      "text": "An quaint island being procedurally generated",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/pipeline-stages.js · terrain-stages.html",
      "note": "343帧全核；增量Delaunay三角化+抬升+灰模+上色四段已落地（pipeline-stages.js + terrain-stages.html）；缺AO软阴与生成后地形微调，非视觉等价；【卡点·A 机制未做】缺AO软阴与生成后地形微调，非视觉等价 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1593215065423245313",
      "date": "2022-11-17",
      "text": "Making a lil dynamic sprite packer, able to add and remove sprite allotments at runtime. I had one of these in Bad North and found it very useful. Here, the sprites are baked live from meshes. So I guess it's basically impostors. Though I expect to use it for much else too.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · atlas-live.html",
      "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收；本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。；【卡点·A 机制未做】本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": "共享跨叶候选/key释放和8视角动态GPU烘焙/回收/异常恢复局部通过；非原素材、3D树、自动扩容或完整API"
      }
    },
    {
      "id": "1590674061092212738",
      "date": "2022-11-10",
      "text": "In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the background. The outline strength is determined by the difference between these two samples! Not perfect, but pretty good! Not too jittery when turning the camera",
      "topic": "light",
      "status": "partial",
      "where": "src/life/vegetation.js（静态邻崖近似，原采样法待补）",
      "note": "181帧全核验：全片反差纹理诊断配色，镜头环绕多层岛，草缘随背景变化。原文明说顶点shader采站立处与背景射线的contrast texture差值。当前仅静态邻崖距离aEdge，未实现该GPU采样/背景射线；只记学习完成，实现及运行验收待补，不把已有启发式当原法。；【卡点·A 机制未做】只记学习完成，实现及运行验收待补，不把已有启发式当原法。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": false,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
      "note": "453帧全序列复核：线框接缝遍历后切实体屋与整岛；不能从画面证明双线性切洞。保留已有显式双格/整体编辑/工程身份，复测两网格各6栋同World融合通过；本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。；【卡点·A 机制未做】本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/core/frontier-candidates.js · wfc.html",
      "note": "434帧核验：是坍缩边缘候选评估/简化导航扩展，不是战役边境，也不等于旧同高区域图。新增只读邻接候选枚举，真实半边、三角/四边格及预算不完整结果；WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。；【卡点·A 机制未做】WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1580846877855338497",
      "date": "2022-10-14",
      "text": "Here's the slowed down bounce sequence. You can see how the mega texture and the light volume affect each other back and forth. After about the 3rd bounce, further bounces are not noticeable.",
      "topic": "light",
      "status": "partial",
      "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
      "note": "41帧复核（不是旧注释11帧）：重置→直射→体积→阴影填充。新增0/1/3/6次实景对照与每次平均/最大/相对变化，取消“任意场景第三次后不变”推断。两网格实测变化递减，但不是原片像素误差或普遍收敛证明；完整贴图/体积往返反馈仍缺。；【卡点·A 机制未做】完整贴图/体积往返反馈仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1580845127207387137",
      "date": "2022-10-14",
      "text": "1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in the mega texture! 2nd is a baked 6 directional light volume, raycast against the sdf, sampling the mega texture using the UVs where it hits the sdf. 3rd is the lit mega texture",
      "topic": "light",
      "status": "partial",
      "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
      "note": "213帧复核：原文SDF距离/UV→mega-texture→六方向体积。新增可选六RGB方向/法线权重、静态命中缓存、太阳有限DDA和切片；真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。；【卡点·C 算法未公开】真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1580835075629133825",
      "date": "2022-10-14",
      "text": "I always write my own lighting solutions. I've had some really naive ad hoc color bleeding in my (very fake) GI before, but this is my first decent attempt to actually have the light *bounce*",
      "topic": "light",
      "status": "partial",
      "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
      "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。原版2.5D形因子gather/暴力参考接口未迁移，映射改列部分，已有重构保留。；【卡点·C 算法未公开】185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照… → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
      "note": "177帧已复核；共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完整prefab/socket待续。；【卡点·A 机制未做】共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1579478470098243584",
      "date": "2022-10-10",
      "text": "To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/shape.js · src/terrain/terrainmesh.js · cage.html",
      "note": "272帧全核验，含线框构建/着色/转镜；保留共享切面与保护，修分数层高查询并复用到沉积线，连续角点局部通过；完整原cage/3D碰撞仍缺。；【卡点·A 机制未做】完整原cage/3D碰撞仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1579474420749725696",
      "date": "2022-10-10",
      "text": "I'm back on the island generation",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js · cage.html",
      "note": "454帧全核验，片中两组岛线框构建/着色/转镜；原文未揭示生成器算法，完整坡面/模块联合生成仍待补。；【卡点·C 算法未公开】原文未揭示生成器算法，完整坡面/模块联合生成仍待补。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
    },
    {
      "id": "1490068909042642944",
      "date": "2022-02-05",
      "text": "Late night cryptic graph tweet",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/graph-layout.js · grid-graph.html（右栏邻接图）",
      "note": "427帧全核（5张联系表全看+原尺寸回看390）；判出真机制=邻接图的极坐标同心环布局：BFS分层成环、环内按父角度定角、颜色按根分支分连续圆弧；新增adjacencyComponents/radialLayout与grid-graph.html右栏，26环/4分支/同环249跨环1004已验；缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻；【卡点·C 算法未公开】缺节点半径其余语义、颜色到底是分支还是分量无法证、极坐标刻度未复刻 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      "where": "src/core/contrast-field.js · color-lab.html（三角诊断）",
      "note": "517帧全核验，纠正原注释6帧；图集预览、灰岛上色和两组岛环绕。新增确定性标量对比图求解与实际网格三角诊断，预算修复后仍报告违例；原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。；【卡点·A 机制未做】原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1482011744843223042",
      "date": "2022-01-14",
      "text": "Ok, I stumbled on a pretty cool art style now. Here, I'm creating pixel thin lines from contrasts in my procedural normal map. I should probably move to a bespoke contrast texture (to get more deliberate control over the lines). But I gotta say this looks pretty promising.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/normal-contrast.js · normal-contrast.html",
      "note": "384帧全核验；源为程序化normal map反差，不是后续contrast迭代。共享地形材质新增解析法线场/物理像素覆盖局部近似，GPU双网格通过；原笔触normal atlas与投影接缝仍缺。；【卡点·B 美术资产】原笔触normal atlas与投影接缝仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
      "id": "1481661852887265288",
      "date": "2022-01-13",
      "text": "Yet another light baker. Actually does some ray marching, but still pretty ad hoc. The textures are: 1. Normals (procedurally painted in big chunky strokes) 2. 3D Signed Distance Field 3. 3D Ambient Occlusion in positive and negative X,Y and Z",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
      "note": "425帧全复核：旋转、线框/重建、法线/SDF/六AO图。补各向异性精确体素中心EDT、保守距离下界步进+DDA兜底，六向距离AO及梯度法线诊断接真实View；不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。；【卡点·B 美术资产】不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "next",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "textures.html?t=radial（保留圆块近似；UV流程待补）",
      "note": "346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核完成，代码待实现验收。；【卡点·A 机制未做】346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1471817524148940807",
      "date": "2021-12-17",
      "text": "Some rocky islands. Trying to make the grid natural and readable, yet funky. Square, yet hex.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/corner-footprint.js · corner-cuts.html",
      "note": "556帧阶段生成/旋转岩岛。迁移Workbuddy切角作为共享格只读绘制轮廓实验，非原算法证明；不改World导航，完整岩岛模块生成未迁移。；【卡点·A 机制未做】不改World导航，完整岩岛模块生成未迁移。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "where": "src/core/grid-wireframe.js · grid-graph.html（左栏线框）",
      "note": "609帧全核（7张联系表全看+原尺寸回看340/500）；判出真机制=不规则四边格+保留三角形的混合网，三角带横穿成条、每40-60帧整片清空重铺；新增classifyWireframe/seamBands与grid-graph.html左栏，四边/三角/带轮廓/岛缘分类与长带串接已验；缺格心彩色小块语义、3D透视视角、接world实景；【卡点·A 机制未做】缺格心彩色小块语义、3D透视视角、接world实景 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1458921394855718917",
      "date": "2021-11-11",
      "text": "I'm exploring the Half Edge data structure. Feels like a really lightweight, powerful and versatile way of representing topology. A big thanks to everyone suggesting I look into it.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · src/core/adjacency.js",
      "note": "圆内四边形组与彩色剩余区域轮廓、间隙三角网，反复重置铺组/填网；未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。；【卡点·C 算法未公开】未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
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
      "id": "1448039167057879048",
      "date": "2021-10-12",
      "text": "Imma talk about my new island generator at Sweden Game Conference (@SwedenGameArena) on Friday (no idea if its gonna be recorded). Naturally, I'm preparing by implementing some nice timing and visualization.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/stroke-reveal.js · stroke-reveal.html · src/ui/walkthrough.js",
      "note": "952帧全核；4轮循环=管线各阶段错峰逐笔画：三角剖分帐篷(顶点竖棒)→密集顶点阵→逐笔线稿→三角共享边线网→等高线→着色岛；本轮新增stroke-reveal.js(错峰+弧长裁剪)与stroke-reveal.html并跑通两测；仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛；【卡点·A 机制未做】仍缺顶点竖棒层、线网层、walkthrough自动计时推进、每轮换岛 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1447496205282549761",
      "date": "2021-10-11",
      "text": "The base graph is just a humble irregular triangle grid",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · src/terrain/generate.js",
      "note": "全383帧核验，多个不规则三角底图到分层线框/完成岛例；完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。；【卡点·A 机制未做】完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1447494168448753667",
      "date": "2021-10-11",
      "text": "Long time fans of the show will not be surprised to learn that this is indeed running on tile based WFC. This time around, I'm getting the best of both worlds by using a mix of triangular and square tiles. (The squares are cut along each diagonal to create 4 triangles though)",
      "topic": "build",
      "status": "partial",
      "where": "src/core/grid.js · wfc.html?subtiles=1",
      "note": "全178帧模块库核验；新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。；【卡点·A 机制未做】新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
      "id": "1447488323845509121",
      "date": "2021-10-11",
      "text": "I'm able to do a couple of things here I've always wanted to, but never been able to before: - Properly combine seamless soft slopes with distinct sharp cliffs. - Erosion valid terrain with no local minimums. - Get the best of both square tiles and triangular tiles",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js · shape.js（软坡/侵蚀保证待补）",
      "note": "656帧全核验：缓坡/硬崖同框、多组生成的稀疏白线/暗轮廓/完整岛与旋转。配文明确侵蚀有效无局部低洼，但画面不能证明该保证；现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。；【卡点·C 算法未公开】现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "next",
      "page": "overhang.html",
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
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1447483550257799171",
      "date": "2021-10-11",
      "text": "I regret to inform you that I've relapsed into procedural island generation",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js · src/core/contour.js",
      "note": "565帧全核；44s循环showreel：彩色岛（暗岩块+蓝河网+岩柱）↔切黑后白线逐笔累积成岛轮廓，每轮岛形态不同=连续程序化生成；本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线；【卡点·A 机制未做】本仓generate.js只单次生成、无连续换岛演示页，线稿层stroke-reveal.js已落地但未接地形管线 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "next",
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
    },
    {
      "id": "1430227487376781317",
      "date": "2021-08-24",
      "text": "Plus you can change the in-game textures now! So I guess the game is now (in the most liberal use of the word) \"moddable\"",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/palette.js · src/build/buildings.js（无 surface 图集）",
      "note": "279帧全核；判出真机制：全城建筑共用一张总贴图 TownColor.png（PS 标题栏 200% Layer0 RGB/8 证实），改这张图即整城换肤（0207后墙面屋顶全变蓝涂鸦）；本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换；【卡点·B 美术资产】本仓建筑走逐面调色板顶点色，无共享 surface 图集与运行时热替换 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
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
      "id": "1430224300003545091",
      "date": "2021-08-24",
      "text": "If you've been waiting for the Townscaper mesh exporter, you can now try it out in the public beta branch on Steam. There's a bunch of other subtle changes and optimizations too, but nothing major. Please do let me know if you run into any issues!",
      "topic": "tools",
      "status": "partial",
      "where": "src/tools/objexport.js",
      "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。；【卡点·A 机制未做】第三方DCC及水/植被/材质尚未验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1427721874490933250",
      "date": "2021-08-17",
      "text": "Here's a very quick technical test. Though this one is continuously adding decals, so it looks a bit like claymation or line boil. Might be softer than what I'd be going for, but it was an easy style to throw together. And obviously you'd need some padding for the seams.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js（斑块/贴花）",
      "note": "188帧全核；判出真机制：每帧累加方块贴花导致 line boil（贴花密集处相邻帧差分 mean 5.4→7.3），且需图集 padding；本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了；【卡点·A 机制未做】本仓斑块是逐像素 fbm 噪声、不随帧变，无贴花累加与图集 bleed，画风表达不了 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/world/worldmesh.js · src/tools/mesh-audit.js · save-mesh.html",
      "note": "349帧全核验。README是Switch动态合批不足后自写mesh merger；视频线框/着色不能独立证明三倍性能。保留既有WorldMesh分块缓存后拼成单一主体，新增真实GPU主体提交诊断；双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。；【卡点·E 环境不具备】双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。 → 卡在环境（job/线程、主机性能基线），本机实验页验不了",
      "project": "townscaper",
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
    },
    {
      "id": "1384958097542819845",
      "date": "2021-04-21",
      "text": "I wrote a script to trace topologically straight lines across the Townscaper grid. I think I'll use it for a thing in the gamepad controls and possibly some drag-to-paint mode.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · grids.html?t=lines",
      "note": "679帧全核验；有向格/出边判环、停止原因和真实中点段局部验收通过；游戏手柄/连刷仍未接入。；【卡点·D 需接主管线】游戏手柄/连刷仍未接入。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "townscaper",
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
      "where": "src/core/qa-replay.js · qa-replay.html",
      "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。；【卡点·C 算法未公开】不冒充原作QA、无漏面或完整几何验收。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "townscaper",
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
      "id": "1338829205157646336",
      "date": "2020-12-15",
      "text": "Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection. (Many people have done this before me, so it's nothing new). My points are sorted vertically, which means radially, which makes the algorithm faster. Here's what it looks like:",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html?stage=tri",
      "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。；【卡点·A 机制未做】区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1338825080844021760",
      "date": "2020-12-15",
      "text": "Apropos of nothing, a take on the ancient issue of generating nice triangulated spheres 1. Random points 2. Space out the points 3. Triangulate 4. Relax using the triangles Unclear if I'll use this for anything helpful sources: https:// redblobgames.com/x/1842-delauna y-voronoi-sphere/ … https:// newcastle.edu.au/__data/assets/ pdf_file/0017/22508/13_A-fast-algorithm-for-constructing-Delaunay-triangulations-in-the-plane.pdf …",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html?stage=tri",
      "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。；【卡点·A 机制未做】区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/core/loop-lift.js · loop-lift.html",
      "note": "315帧全核（4张联系表+2张原尺寸）；完美环判定已有，新增 loop-lift：环内格抬升场+船壳厚度+等距支撑腿（3环/最大119格/11腿/船壳0.90）；缺飞行操控、船壳外沿白色构件、建筑随岛抬升；【卡点·A 机制未做】缺飞行操控、船壳外沿白色构件、建筑随岛抬升 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1310503825510367232",
      "date": "2020-09-28",
      "text": "Ok, I tried the mixed perspective. Note how houses further away are smaller, yet the vertical lines stay straight and parallel. It's definitely not a good fit for Townscaper, but might work well if I make another Bad North-ish game with a hearty mix of 3D meshes and billboards.",
      "topic": "build",
      "status": "partial",
      "where": "src/core/mixed-perspective.js · mixed-perspective.html",
      "note": "200帧全核；原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→远处照旧变小。新增src/core/mixed-perspective.js+实验页四块同尺寸标尺，帧缓冲量得k=1上下沿等宽/竖边横移0px、宽度88→47仍递减，k=0与普通透视逐值相同。缺：主视图view.js未接(k=0默认)、pick/倒影相机矩阵未同步、原版Unity移轴逐像素未对；【卡点·A 机制未做】原文的mixed perspective是自定义投影：w行的世界y系数衰减到0→竖线两端w相同→屏幕x相同(笔直平行)，w仍随水平距离增长→… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1305951750638231552",
      "date": "2020-09-15",
      "text": "To soften it up a bit, I'm trying out a penumbra approach where I draw the shadow thrice, once normal, once pulled in slightly and once with big voxels. I think I like it. (here, the shadow is shown darker than it should be to demonstrate the effect)",
      "topic": "light",
      "status": "partial",
      "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
      "note": "521帧全核验：塔楼编辑/旋转与长影，409起RGB阴影纹理通道检查。共享World顶面派生三场水面阴影，正确保留粗格世界尺度/最高遮挡、内收/合成与预算；真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。；【卡点·A 机制未做】真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/core/infinite.js（verify 拉伸度量）· grids.html（网格实验室 无限网格）",
      "note": "241帧全核；画面就是bug现场：翻折块塌成深色皱褶、非翻折邻块被拉长成跨块巨块。verify()原只查翻折/接缝，量不到第二种症状，本轮补了以本格原始点阵为基准的拉伸度量(maxStretch/minShrink/maxEdgeStretch/stretched)并在grids.html显示；实测passes60时翻折0、拉伸最大1.83×、无格超2×；还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×)；【卡点·A 机制未做】还缺把面积拉回点阵的松弛权重(现有14格收缩到0.46×) → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1301816247479345152",
      "date": "2020-09-04",
      "text": "Some are asking for the option to use regular grids. Now, that's (obviously) against the Townscaper design philosophy. However, I am thinking of sprinkling the current generated grid with random patches of hand crafted grid, like little gems to find and build your tempels upon",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/radial-patch.js → World / WorldMesh；gridpatch.html",
      "note": "324帧复核：是六边形外轮廓中的规则四边格/放射模板与环形庭院，不是正六边形格子。补单个星形孔洞的规则内环/过渡四边格并复用原边界。48组25通过23明确拒绝；多补丁/完整手工库、填充世界迁移待补。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。；【卡点·A 机制未做】见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/core/garden-paths.js · src/build/buildings.js",
      "note": "187帧全核验：院落封闭转草坪、门洞通路/横向小径和中心装饰；原文只说新增garden paths。修本地PCA窄带筛格可能断路，改主轴端点+院内邻接BFS，90种连通占用/环洞/双网格真实World通过。保留既有墙边灌木；细石板宽度、门口优先和中心装饰仍待补。；【卡点·A 机制未做】细石板宽度、门口优先和中心装饰仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      },
      "page": "garden.html"
    },
    {
      "id": "1279107097108635649",
      "date": "2020-07-03",
      "text": "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them.",
      "topic": "build",
      "status": "partial",
      "where": "src/build/buildings.js（moduleSig/sigColor） · src/ui/environment-panel.js「模块签名配色」",
      "note": "256帧全核；把拼图块平铺在网格上飞行巡览，同一种邻接签名同色（原文545块）。签名算法与片子口径一致(n/上下层/逐边实心)，但只给墙身上色(底座/屋顶/窗饰仍原色)，没有零件目录页；本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 modules 开关加进场景面板，截图对比确认墙面分色；【卡点·A 机制未做】本轮补：modules 由 sigs.size(仅调试色时统计)改为独立 moduleSigs 恒统计=27，并给此前无入口的 module… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/render/opening-punch.js（rise 拱顶洞口）· src/core/ladder-profile.js（竖梯，已有）· opening-punch.html",
      "note": "369帧全核；原文说的church doors与ladders都拍到了：竖梯(双梁+约14横档，水面爬到高脚楼底)本仓ladder-profile.js已有；教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析面积/命中/像素账/ShapeGeometry挡模板)，还缺接进buildings.js与页面第四栏、洞内墙面与台阶；【卡点·A 机制未做】教堂门实为跨两层的高拱龛(矩形段+半椭圆拱顶+石框+洞内蓝墙+洞底小拱门)，本轮给opening-punch.js补了rise拱顶洞口(解析… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "where": "src/core/snapshot-replay.js · src/world/app.js",
      "note": "167帧全核验。保留撤销栈快照回放，修复60条截断后sceneStart偏移、回放中编辑污染以及异常/取消不恢复；新增只读/取消回放helper和Esc/再次点击停止。正常结束、取消、UI锁和撤销重做保留已双网格实测；完整动作动画/水花音效、镜头和节奏录制仍缺。；【卡点·B 美术资产】完整动作动画/水花音效、镜头和节奏录制仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
      "status": "partial",
      "where": "src/life/effects.js · index.html（建造/拆除触发）",
      "note": "436帧全核；落水/拆到水面触发水花：现有实现=1圈泡沫环(1.1s)+26颗飞沫(重力-5.5、落水即灭)，事件口径与片一致但只压到一半观感；片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命；【卡点·A 机制未做】片子是冠状竖直水帘+2–3圈环(末帧3.2s仍在)+9–12颗飞沫，缺冠状竖条与多环长寿命 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/build/buildings.js（legs 段） · architecture.html",
      "note": "296帧全核；9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片中红屋右下角那根斜接到下方白屋屋脊的长斜杆本仓没有，腿也不会随下方支撑点水平偏移而内倾，高脚塔的通长腿还缺分段/接头表现；本轮未改代码；【卡点·A 机制未做】9秒内同一座水中建筑被反复加高/削平，露出悬空体块的钢腿支撑：竖腿+腿脚横梁与短三角撑仓内已有(buildings.js legs段)，但片… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1246074663546916873",
      "date": "2020-04-03",
      "text": "The props now animate when they appear and disappear. This was much trickier than I anticipated.",
      "topic": "build",
      "status": "partial",
      "where": "src/life/effects.js（局部增长/灰尘反馈，非完整道具生命周期）",
      "note": "306帧全核验，确认道具会随布局变化出现/消失；旧uPops只是柱顶增长的局部缩放，拆除灰尘不是逐道具缩没。保留原反馈但src/propanim映射改部分覆盖，稳定身份/保留消失几何/错峰及原CPU接口均待接，未记运行验收完成。；【卡点·A 机制未做】旧uPops只是柱顶增长的局部缩放，拆除灰尘不是逐道具缩没。保留原反馈但src/propanim映射改部分覆盖，稳定身份/保留消失几何/错峰… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/life/vegetation.js · src/life/impostor.js · clouds.html · src/light/cloud-shadow.js",
      "note": "489帧全核验；修复远云固定时钟，连续环带/远平面深度避免盖建筑；首页独立开关。双网格GPU/三场局部通过，原片高耸云体/层次、真实风平流仍缺。 后续迁移：可选三组逆深度角速度接实际远云，GPU读回/开关通过；云影/模糊/完整三层仍缺，不重计489帧。 本次共享近云同图集世界高度投影/首页开关GPU局部通过；水/植被/远云影/模糊未完成。；【卡点·A 机制未做】水/植被/远云影/模糊未完成。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1242824460325052417",
      "date": "2020-03-25",
      "text": "Finally making some proper UI. Turns out you can make a boring list of buttons playful by just tilting them slightly.",
      "topic": "tools",
      "status": "partial",
      "where": "src/core/playful-layout.js · ui.html",
      "note": "383帧全核验。按键/种子确定轻微倾斜，旋转AABB限制间距，只改视觉层、原生按钮命中槽稳定；换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。；【卡点·D 需接主管线】换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "townscaper",
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
      "id": "1241096929490149376",
      "date": "2020-03-20",
      "text": "It has been brought to my attention that not all of you are familiar with my every-other-pixel-is-a-line tech. I make the UVs speed past every 2nd pixel before sampling. It's core to my art style and what lets me get away with one 128² texture and crisp antialiasing up close.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/texel-skip.js · textures.html",
      "note": "302帧全核验：同机位砖石小镇，细线/粗线效果反复切换；137附近拉远、251附近拉近。原文仅说明采样前UV加速经过隔像素线，不说明确切公式。原硬切函数改共享连续重映射+线性采样，6档CPU积分/4档真实GPU验收；仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。；【卡点·A 机制未做】仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1241046107125399552",
      "date": "2020-03-20",
      "text": "I moved my plants to a 32² corner on the 128² texture I'm using for everything else. Plus they now also use the every-other-pixel-is-a-line tech, so everything is crisp and nice up close",
      "topic": "life",
      "status": "partial",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
      "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共用atlas，原作植物素材与所有植物种类仍待迁移。；【卡点·B 美术资产】原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
      "page": "leaf-surface.html",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "note": "202帧全核验。提取共享courtyards分类器，院墙按地面上实际第2层实心判定，修复上层桥/悬空屋顶误封闭；双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。；【卡点·C 算法未公开】双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
        "runtimeAccepted": true,
        "acceptanceScope": "庭院墙层开口局部算法已实测；道具生命周期仅审计出缺口，运行验收未完成"
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
      "status": "partial",
      "where": "src/water/reflection.js · src/world/view.js",
      "note": "270帧全核验：彩色中间倒影/宽岸裙，160起倒影与建筑线框。保留共享WorldMesh翻转，补实际水面上方裁切、受限深度淡出及线性颜色中点模块；GPU/双网格通过。未复现全部块面艺术与岸裙尺度。；【卡点·B 美术资产】GPU/双网格通过。未复现全部块面艺术与岸裙尺度。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1215642481162887168",
      "date": "2020-01-10",
      "text": "Ok I went ahead and put this whole project on water. Long time fans of the show know this was inevitable.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
      "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。保留已有实际World小镇，补角接分岛/加桥合并的闭环稳定性；真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。；【卡点·B 美术资产】真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
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
      "status": "partial",
      "where": "src/render/opening-punch.js · opening-punch.html",
      "note": "390帧全核；确有机制（非贴片）：洞口写 stencil 让墙体拒绘、z-buffer 少一块，隔层空间透出且随镜头有视差；已做独立原型+三栏对照，缺墙体厚度/洞口侧壁与主管线接入；【卡点·D 需接主管线】已做独立原型+三栏对照，缺墙体厚度/洞口侧壁与主管线接入 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "townscaper",
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
      "id": "1205420678859632640",
      "date": "2019-12-13",
      "text": "For the plants, I dug up this ol' trick: alpha is view angle modulated by leaf texture mapped to a sphere.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
      "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；原作手绘轮廓和匹配的阴影caster/impostor仍待补。；【卡点·B 美术资产】原作手绘轮廓和匹配的阴影caster/impostor仍待补。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
      "page": "leaf-surface.html",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1205416648397721601",
      "date": "2019-12-13",
      "text": "New prop placement system! It tries to place as many props as it can without overlap. I use it for doors and windows too, which means they are no longer skewed when placed on skewed tiles, which means skewed tiles now look less awkward.",
      "topic": "build",
      "status": "partial",
      "where": "src/core/opening-footprint.js · src/build/buildings.js",
      "note": "261帧完整建屋/编辑，非旧注释6帧空格变面。保留既有正矩形门窗，修放置只计框宽遗漏1.6倍窗台外缘；2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。；【卡点·A 机制未做】2000旋转边界和三场GPU通过。完整家具贪心摆放仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1201179450668441600",
      "date": "2019-12-01",
      "text": "Icons!",
      "topic": "tools",
      "status": "partial",
      "where": "src/ui/icon-toolbar.js · ui.html",
      "note": "306帧全核验。上部四工具反复选中、白三角指示移动；原生工具条/aria单选、循环方向键跳过禁用项、跨页保持及dispose通过。下三项因本地未接命令禁用，不推断原作永久禁用；游戏语义/图稿仍缺。；【卡点·D 需接主管线】游戏语义/图稿仍缺。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "townscaper",
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
    },
    {
      "id": "1200520827898343425",
      "date": "2019-11-29",
      "text": "DnD hopefulls needn't fear no more, for I've now made the backend of letting you tune your town to your favorite palette.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/palette.js · wall-palette.html",
      "note": "200帧全核验，墙色由鲜艳到灰米，屋顶仍橙红；画面不足以证明原注释1.5秒/最短色相公式。新增可选本地HSL短弧过渡及无彩色端点处理，真实墙色滑杆双网格通过；PNG/完整原接口与持久化仍待补。；【卡点·A 机制未做】PNG/完整原接口与持久化仍待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      }
    },
    {
      "id": "1198957499027795969",
      "date": "2019-11-25",
      "text": "That bit of text up top is the save data for the current construction. I think I've packed the data about as tight as I can. Keeping the save data in a string will make constructions easily shareable between platforms (when it comes to that)",
      "topic": "tools",
      "status": "partial",
      "where": "src/world/save.js · save-mesh.html",
      "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。保留本地v5，修复解码先清岛导致坏输入破坏、游程越界/尾随垃圾、空列色槽/河道丢失及北境场景身份；实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。；【卡点·A 机制未做】实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1197909675443916803",
      "date": "2019-11-22",
      "text": "Turns out my monitor was too saturated, making me make my colors too dull. This should be better. I've also added some building effects, grass in the gardens, and colored \"bounce\" \"lighting\". I'm real happy even my yellows look good now. Yellows are hard",
      "topic": "light",
      "status": "partial",
      "where": "src/build/buildings.js · src/light/bake.js · wall-palette.html",
      "note": "456帧全核验：原帖重点为显示器饱和度纠偏、建筑效果、花园草地和彩色反弹光。可见多色墙与暖橙屋顶；不将“屋顶永远”或彩色反弹数学当视频证明。本批回归墙色私有编辑不改固定BUILD/位置，保留已有烘焙和草地；完整原作视觉与参数未复现。；【卡点·B 美术资产】完整原作视觉与参数未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/life/vegetation.js · src/core/anchored-billboard.js · billboard-anchor.html",
      "note": "316帧全核验。新增可选实例轴固定中心的草卡片对照，沿用默认旧模式；四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生命周期仍待接，不冒充草卡片已等价原灌木。；【卡点·B 美术资产】四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生… → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/build/buildings.js（保留已有钢架；本批仅学习）",
      "note": "296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收；【卡点·A 机制未做】296帧全核：编辑/移除楼层显露长钢柱、横梁/斜撑。现有几何保留，完整钢架WFC仍缺，本批不计代码验收 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/core/building-components.js · src/build/buildings.js · building-components.html",
      "note": "全帧核验；悬空/跨层组件独立身份已接实际窗型，双网格通过；独立装饰WFC仍缺 旧片续作：六类1–3槽墙段WFC/实绘百叶与装饰圆拱接实际建筑，双网格局部验收；跨格整墙/真正洞口仍缺。；【卡点·A 机制未做】跨格整墙/真正洞口仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "id": "1178731576982724611",
      "date": "2019-09-30",
      "text": "I made some grassy plots. I'm real happy with the shapes they make. Eventually, they'll grow some trees and the like.",
      "topic": "life",
      "status": "partial",
      "where": "src/build/buildings.js（现有仅地面庭院，高层草地分区待补）",
      "note": "333帧全核验，纠正旧“草地块会长树”：本片无树，README明确是将来计划。高层台地草坪/石边带随建筑重排，当前只有地面层庭院与岩石地形植被，完整高层grass plots未实现，不记运行验收完成。；【卡点·A 机制未做】333帧全核验，纠正旧“草地块会长树”：本片无树，README明确是将来计划。高层台地草坪/石边带随建筑重排，当前只有地面层庭院与岩石地形植… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/world/worldmesh.js · src/light/bake.js · ao-stages.html",
      "note": "551帧全核，保留分层烘焙，新增实际遮蔽/反弹分离对照及恢复验收；原GPU重投影/动态纹理仍缺。；【卡点·A 机制未做】原GPU重投影/动态纹理仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": "本地分层烘焙实际对照/恢复局部，不是原GPU管线"
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
      "status": "partial",
      "where": "src/core/contour.js（2D marching squares）· contour.html；缺 src/core/ 下 3D 等值面模块",
      "note": "353帧全核；判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（contour.js，见1120036868966502401），缺3D 256情形查表+顶点焊接+生长动画，本轮不写代码；【卡点·A 机制未做】判出机制=不规则四边形网格上的三维等值面生长（面只在格边交点、同格歧义消解、底面阶梯化）。现仅同族2D marching squares（c… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/core/infinite.js · grids.html（无限网格页签）",
      "note": "449帧全核；六边块拼贴+块/簇各自松弛+三表示重心插值已实现，19块378对表示差3.7e-15；新增环数1/7/19三档对照片中一块块外长；仍缺真无限流式（页面最多19块）与块内疏密均匀度；【卡点·A 机制未做】仍缺真无限流式（页面最多19块）与块内疏密均匀度 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "townscaper",
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
      "status": "partial",
      "where": "src/core/quad-lattice.js boundsForCells/mergeBounds/selectionBounds · src/world/view.js setGridWindowForSelection/builtCluster · grid-debug.html 点击选中",
      "note": "703帧中本轮重看sheet-00全100张；补最后一段硬缺口：窗口接选中态（quad-lattice.boundsForCells/mergeBounds/selectionBounds + view.setGridWindowForSelection/builtCluster + grid-debug 点击拾取），grid-window 13项/浏览器34条全过；仍缺与真编辑器撤销/多选联动",
      "project": "townscaper",
      "decodedFrames": 703,
      "reviewEvidence": "artifacts/coverage/1120036868966502401-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          702
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "窗口补丁由选中态自动定（覆盖/对齐/≤8格/清空）"
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
      "status": "partial",
      "where": "src/core/frontier.js · campaign.html",
      "note": "已学14帧续项：外围padding、避让节点的边中点通路、自适应Bezier采样通过96条逻辑/24项页面；两侧细分未实现。；【卡点·A 机制未做】两侧细分未实现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "1092709665199345664",
      "date": "2019-02-05",
      "text": "k-pow !!",
      "topic": "show",
      "status": "partial",
      "where": "src/life/effects.js · src/life/smoke.js · src/life/banner.js（缺口：一次性爆炸编排 explodeAt）",
      "note": "474帧全核；判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、火球靠effects.js粒子池，缺explodeAt时序编排与焦痕贴片，本轮未写代码；【卡点·A 机制未做】判出机制=一次性爆炸（火球膨胀收缩+地面红焦痕+火星）+持续黑烟+崖顶战报横幅。烟可由smoke.js承载、横幅可由banner.js承载、… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "status": "partial",
      "where": "ui.html（本地UI实验，未接游戏指令）",
      "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。；【卡点·D 需接主管线】本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
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
        "acceptanceScope": "仅本地UI确定性布局/命中与确认生命周期通过；未接游戏操作或原作美术/全部模式"
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
      "where": "src/core/part-random.js · ui.html",
      "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。保留本地卡片绘制并验证稳定种子身份；原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。；【卡点·B 美术资产】原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
        "acceptanceScope": "本地显式镜像随机状态/稳定槽身份与已有卡片局部通过；非原完整素材、头像spec/游戏接入"
      }
    },
    {
      "id": "1007587828992266240",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "partial",
      "where": "src/badnorth/battle.js · src/life/effects.js · src/life/banner.js",
      "note": "300帧全核；白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐；【卡点·A 机制未做】白垩崖台地上两队混战+小屋/崖缘着火+紫旗标，机制归到既有battle/effects/banner，仅判读未做运行时对齐 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "status": "partial",
      "where": "src/badnorth/battle.js（aSoak · installSoak 头+身）· head-blood-browser",
      "note": "229帧全核；血斑按物体空间噪声画、头部这轮补上了（头 48px/身 179px 已量），但只有一套空间：原作躯干走皮肤空间、盔与手臂走精灵空间（0096 棋盘格分出界线）没有；斑块是整面块状、与调色板斑混淆；【卡点·A 机制未做】血斑按物体空间噪声画、头部这轮补上了（头 48px/身 179px 已量），但只有一套空间：原作躯干走皮肤空间、盔与手臂走精灵空间（0096… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": "血迹跟随（头/身）"
      }
    },
    {
      "id": "995043346778415104",
      "date": "2018-05-11",
      "text": "The pathfinding in some levels does get a bit convoluted",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/route-preview.js · route-preview.html",
      "note": "386帧全核；移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接入、预览仍是淡出的一次性点串；【卡点·D 需接主管线】移动路线预览落地为落崖弧+圆角（新建 route-preview.js，左埋31点/右0点），battle.js #drawPath 尚未接… → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
      "project": "badnorth",
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
      "date": "2018-05-11",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "partial",
      "where": "src/badnorth/battle.js · 无（能力系统未建）",
      "note": "564帧全核；血迹贴花累积/队伍旗/箭矢三项已在 battle.js 对上，缺指挥官能力（Plunge）、能力键冷却环与 No valid targets 提示，本轮未写代码；【卡点·A 机制未做】血迹贴花累积/队伍旗/箭矢三项已在 battle.js 对上，缺指挥官能力（Plunge）、能力键冷却环与 No valid targets… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "987267068495003648",
      "date": "2018-04-20",
      "text": "Using inspector expressions, I can live tweak the cost function of my projectile trajectory lookup tables. Very handy.",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/ballistic-table.js · src/badnorth/battle.js · ballistics.html",
      "note": "678帧全核；Inspector代价/Validity动态编辑。保留无阻力游戏参数，提共享表/可调权重，修真实目标高差量化误差；双网格实际弓手发射通过。原表达式/drag/Validity仍缺。；【卡点·A 机制未做】双网格实际弓手发射通过。原表达式/drag/Validity仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": "局部无阻力共享表/实际弓手端点修复，不是原Inspector/阻力完整恢复"
      }
    },
    {
      "id": "984813819280191488",
      "date": "2018-04-13",
      "text": "Blood soaking as a health indicator for the big fellas and a proper stun state for the little ones",
      "topic": "fx",
      "status": "partial",
      "where": "src/badnorth/battle.js（installSoak/aSoak/#bleed/poolGrow/mStun）· src/core/combat-state.js",
      "note": "934帧全核（10张联系表全看）；浸血自下而上/阵亡僵直留地成立；地面红点是互不重叠小点，**同点位反复死亡仍测不出变深变大**（第2次复证）→ 「堆厚变暗」降级为可选美术增强，不再排期标定",
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
        "acceptanceScope": "浸血血量指示 + 僵直留地；不含血泊堆厚变暗"
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
      "status": "partial",
      "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
      "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。；【卡点·A 机制未做】3D原gizmo未完整迁移。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "974564862729838592",
      "date": "2018-03-16",
      "text": "I'm making some pedagogical gizmos for my GDC microtalk, like this illustration of Barycentric Coordinates. Gizmos > powerpoints.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/spatial.js · src/core/infinite.js · grids.html?t=infinite",
      "note": "全帧核验；XZ预计算真正接入块/簇插值缓存，快照原点/退化处理，10264顶点基线与真实页面通过；3D原gizmo未完整迁移。；【卡点·A 机制未做】3D原gizmo未完整迁移。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "974325184525201409",
      "date": "2018-03-15",
      "text": "We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefully) by making our own box-box test in two incredibly stressful hours. Behold, our beautiful viking raid planner:",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/obb.js · src/badnorth/landing-plan.js · src/badnorth/battle.js",
      "note": "504帧全核；核心接触策略/输入防NaN通过，实际规划消费者待接 后续已接真实发船泊位/固定朝向直线走廊预留，完整岸礁/动态避让仍缺。；【卡点·A 机制未做】核心接触策略/输入防NaN通过，实际规划消费者待接 后续已接真实发船泊位/固定朝向直线走廊预留，完整岸礁/动态避让仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "acceptanceScope": "3D SAT策略及实际泊位/直线进场走廊预留局部验收，非地形碰撞或完整原规划"
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
      "status": "partial",
      "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js；gridpatch.html",
      "note": "31帧复核：顶点格在实际台地上收缩/扩大。新增三角网重心对偶及边界闭合，共享World扇形三角输入和分层脉动观察/候选点。640格面积测试通过；不是原作中心规则证明，尚未统一植被/导航。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。；【卡点·C 算法未公开】见本批运行证据，能力仍列部分。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
      "project": "badnorth",
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
        "runtimeAccepted": true,
        "acceptanceScope": ""
      }
    },
    {
      "id": "959530111187013632",
      "date": "2018-02-02",
      "text": "I've been tweaking the foliage system today. It now supports multiple grass types per level.",
      "topic": "life",
      "status": "partial",
      "where": "src/core/level-flora.js · src/life/vegetation.js · level-flora.html",
      "note": "203帧，准确日期2018-02-02；109帧硬切紫色雨景。迁移分层色组至共享World实际地被，保留落点和默认；完整物种/生态/雨景未复现。；【卡点·A 机制未做】完整物种/生态/雨景未复现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "status": "partial",
      "where": "src/core/part-random.js · ui.html",
      "note": "88帧全核验；保留层级部件，修复显式mirror分支随机重放/单次消费，显式种子与固定槽ID保证重画、切页和手机换列身份；完整spec/数据接口/剪影IoU仍缺。；【卡点·A 机制未做】完整spec/数据接口/剪影IoU仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "946660607008403456",
      "date": "2017-12-29",
      "text": "While @rtm223 is away on holiday I'm taking some time to focus on the important things, like making blood, corpses and arrows stick to boats and adding pretty little flowers",
      "topic": "fx",
      "status": "partial",
      "where": "src/badnorth/battle.js（#longship deckPool/#bleed）· src/core/platform-anchor.js",
      "note": "440帧全核（5张联系表）；复核：舱内是整舱浸透不是斑点、船左水面大片血雾随流变淡、岸边浅水有白泡沫带与成片白点；本轮未改码，impl/runtime 沿用第54轮实测（deckPool 25段带 opacity0.94、boat-deck-pool-browser PASS）；仍缺船外沿岸白泡沫带与白花簇；【卡点·A 机制未做】仍缺船外沿岸白泡沫带与白花簇 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
      "decodedFrames": 440,
      "reviewEvidence": "artifacts/coverage/946660607008403456-review-r55.md",
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
          300,
          430
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "整舱浸透与沿岸环境（第 54 轮运行时实测）"
      }
    },
    {
      "id": "943230624369868800",
      "date": "2017-12-19",
      "text": "And yeah, obviously the snow flakes are affected by the wind system and thus flow around the island",
      "topic": "terrain",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/world-probes.js",
      "note": "318帧全核验；修复屋顶下空洞误用柱顶碰撞，雪片改读共享World实际solid层，重生避实心、dt校验；双网格即时封洞/重开通过。现有表面混白保留，不是物理堆积；Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。；【卡点·A 机制未做】Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "943230620242796544",
      "date": "2017-12-19",
      "text": "I'm heading north for a few days to see the folks. In the meantime, here's some seasonally relevant hype material for @BadNorthGame :",
      "topic": "show",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/badnorth/battle.js（组合待验）",
      "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。已有雪/战斗主体保留；完整冬景美术/植被覆盖及船群战斗组合未实现验收。；【卡点·A 机制未做】完整冬景美术/植被覆盖及船群战斗组合未实现验收。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "where": "src/life/atmosphere.js · src/core/world-probes.js",
      "note": "516帧全核验；保留按层避障/三线性风场与共享uWind，双网格通洞/封洞及改风向运行复核。原片矢量受空间障碍影响，不能据画面恢复精确解算器；完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。；【卡点·C 算法未公开】完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
        "acceptanceScope": "本地分层风场保留复核 / 雪片真实层碰撞局部通过；非原作完整风接口、雪片造型/AO与冬景等价"
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
      "status": "partial",
      "where": "src/badnorth/battle-c01.js · SKY_BEAM_UNIT_STEPS · tools/beam-transmission.py",
      "note": "759帧全核（sheet-02 0200-0299 + 4× 裁切 278/288）；新工具 beam-transmission 用柱后残余对比度反解 α，自检最坏误差 0.442 判不可用于绝对 α；实测 0288 残余 11.98/柱外 44.55/噪声 5.12 → α≈0.83，4× 目视也能看到岩边透出 → 推翻 r100 的峰值 α=1.00（那是 cal_alpha 假设），改记 0.7-0.85",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
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
      "status": "partial",
      "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
      "note": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。；【卡点·A 机制未做】精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "906416813810049025",
      "date": "2017-09-09",
      "text": "New cave tileset. These levels really challenge your spacial skills #screenshotsaturday #madewithunity @BadNorthGame",
      "topic": "fx",
      "status": "partial",
      "where": "artifacts/coverage/cloud-depth-review.md",
      "note": "725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。；【卡点·B 美术资产】725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "新洞穴素材仅学习；旧阴云策略迁移另行记载"
      }
    },
    {
      "id": "906207980802252801",
      "date": "2017-09-08",
      "text": "I've been working on some new fog (sped up in the gif). For background effects, subtlety is key.",
      "topic": "fx",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/fog-envelope.js",
      "note": "326帧全核验。修复本地有限雾盘外缘硬截断，新增浓度/相对漂移速度控制，默认淡雾0.35；实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真实速度。；【卡点·A 机制未做】实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真… → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "903647529203634176",
      "date": "2017-09-01",
      "text": "Spears are so weird to implement. I can see why most games don't use them",
      "topic": "fx",
      "status": "partial",
      "where": "src/badnorth/damage-numbers.js · src/badnorth/battle.js",
      "note": "654帧全核（7张联系表）；击杀金色+10并入伤害数字同池（kind=kill、同字号/上浮/遮挡、贴图键 kill|+10），新增同帧横向错位 sx 防叠；仍缺按受击方向抖动与 +10 独立上浮速度；【卡点·A 机制未做】仍缺按受击方向抖动与 +10 独立上浮速度 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
      "decodedFrames": 654,
      "reviewEvidence": "artifacts/coverage/903647529203634176-review-r60.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          653
        ],
        "nativeRevisits": [
          0
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "伤害数字 / 击杀数字 同池 + 错位"
      }
    },
    {
      "id": "902103473365417984",
      "date": "2017-08-28",
      "text": "Ok, one more visualization. Distances this time. I really should get back to proper work now",
      "topic": "show",
      "status": "partial",
      "where": "src/core/distance-isolines.js · distances.html",
      "note": "705帧全核；岛上等距亮线=距离场等值线（非流向继承），新建 distance-isolines.js+distances.html，EDT 与暴力解一致；缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入；【卡点·D 需接主管线】缺 3D 多层台阶投影、任意多边形占地、battle.js 调试接入 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
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
        "acceptanceScope": "2D 格距离场 EDT + marching squares 多级等值线与闭环/开口缝合；不代表原作 3D 台阶立面投影"
      }
    },
    {
      "id": "902069261304287232",
      "date": "2017-08-28",
      "text": "Just for fun: visualization of data inheritance in my flow/distance/influence fields",
      "topic": "fx",
      "status": "partial",
      "where": "src/motion 流场 · navmesh-flow.html",
      "note": "389帧全核（4张联系表）；原片只有格边骨架线+色块，无箭头/流线/图例→continuousFlow 接 battle 无原片依据；LOD第12次不可测，降级为本仓扩展不再排队",
      "project": "badnorth",
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
          0,
          200,
          380
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "流场可视化层"
      }
    },
    {
      "id": "901842167508992000",
      "date": "2017-08-27",
      "text": "Made my flow/influence fields even smarter: In addition to distance and direction to nearest unit, it can now tell you what type they are",
      "topic": "fx",
      "status": "partial",
      "where": "src/world/view.js · flow.html",
      "note": "571帧全核(并案389)；同机位整岛入画、远端未见稀疏化 → LOD 永久不适用；continuousFlow 仍未接 battle.js，须单独一轮",
      "project": "badnorth",
      "decodedFrames": 571,
      "reviewEvidence": "artifacts/coverage/901842167508992000-review-r85.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          570
        ],
        "nativeRevisits": [
          60,
          300
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "流场 LOD（不适用）"
      }
    },
    {
      "id": "901469409579061248",
      "date": "2017-08-26",
      "text": "Working on nicer ship wakes",
      "topic": "water",
      "status": "partial",
      "where": "src/life/boats.js · src/core/wake-sampling.js",
      "note": "138帧全核验。保留绕岛V形带状船迹，补连续时间采样/相位余量/帧内插值，30/60/120Hz实际采样数和年龄一致；重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。；【卡点·A 机制未做】重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "project": "badnorth",
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
      "id": "880853661936734211",
      "date": "2017-06-30",
      "text": "Units got stuck when meeting in narrow passages. I fixed it by introducing left handed traffic. Never felt so clever.",
      "topic": "fx",
      "status": "partial",
      "where": "src/world/traffic.js · src/badnorth/battle.js",
      "note": "601帧已复核，保留左行与常驻点线；补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。；【卡点·A 机制未做】补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
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
      "note": "351帧全核(4张联系表全看完)；纯展示/美术片：粉藕地面+灰岩+蓝青簇状植被，无单位/建筑/崖/尘/火/血/UI，帧间差 7.5–10.1 只在植被轮廓 → 撤回 r31「落崖翻滚+落地扬尘」归属，判 ref 不涉及实现",
      "project": "badnorth",
      "decodedFrames": 351,
      "reviewEvidence": "artifacts/coverage/870296307889573889-review-r85.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          350
        ],
        "nativeRevisits": [
          100,
          200,
          300
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "不涉及实现"
      }
    },
    {
      "id": "797119718477991936",
      "date": "2016-11-11",
      "text": "Got some basic navigation going",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
      "note": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。；【卡点·D 需接主管线】精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续… → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": ""
      }
    },
    {
      "id": "886199305522085890",
      "date": "2017-07-15",
      "text": "Dotted lines to mark narrow passages. Helps you understand what path the enemies might chose",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/world/traffic.js（passageMarkers/heightRaster roofs）· src/badnorth/battle.js（refreshPassages）· index.html?scene=badnorth",
      "note": "624帧全核（7张联系表）；机制复核成立：点线只出现在两块实体间那一格宽处、被建筑挡住即整段不画、点距:点径≈2:1；本轮未改码，impl/runtime 沿用第54轮实测（spacing 0.28、roofs遮挡、dmPeak 187.6，traffic-dots/traffic-fade/traffic-sight 全PASS）；仍缺通用调试层（只挂badnorth）与近景点距略疏；【卡点·A 机制未做】仍缺通用调试层（只挂badnorth）与近景点距略疏 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
      "learned": "原文与全帧联系表核对；真实场景常驻标示，切场景隐藏；证据 artifacts/coverage/traffic-review.md。",
      "reviewEvidence": "artifacts/coverage/886199305522085890-review-r55.md",
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
          120,
          300,
          620
        ],
        "implementationVerified": true,
        "runtimeAccepted": true,
        "acceptanceScope": "窄通道点线与遮挡淡出（第 54 轮运行时实测）"
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
      "status": "partial",
      "where": "src/core/unit-shadow.js · unit-shadows.html",
      "note": "先按准确配文理解动画参考请求；25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。；【卡点·A 机制未做】25帧全核验，可选单位接触软盘局部GPU通过，原动画/坡面/参数待补。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "date": "2017-01-17",
      "text": "（帖子无文字说明）",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/badnorth/battle.js",
      "note": "315帧全核验，主内容为选点/登台/战斗与尸体，暗斑不能单独证明原阴影方法；本批仅学习复核。；【卡点·C 算法未公开】本批仅学习复核。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
    },
    {
      "id": "821680056514781186",
      "date": "2017-01-18",
      "text": "By popular demand: Revenge of the Blues!",
      "topic": "game",
      "project": "badnorth",
      "status": "partial",
      "where": "src/badnorth/battle.js",
      "decodedFrames": 763,
      "reviewEvidence": "artifacts/coverage/unit-tiers-review.md",
      "note": "早期复仇战斗763帧复核；仅学习，不能认证软影高度或坡面算法。；【卡点·C 算法未公开】仅学习，不能认证软影高度或坡面算法。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
      "date": "2017-02-02",
      "text": "Looking at unit tiers",
      "topic": "game",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/unit-tier.js · unit-tiers.html",
      "decodedFrames": 524,
      "reviewEvidence": "artifacts/coverage/unit-tiers-review.md",
      "note": "原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。；【卡点·B 美术资产】本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
      "note": "原文irregular is the new hex，185帧；既有量化保留，新增真实World同高片/逻辑阶差面积诊断，非原算法恢复。；【卡点·C 算法未公开】既有量化保留，新增真实World同高片/逻辑阶差面积诊断，非原算法恢复。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
      "date": "2016-09-30",
      "text": "（帖子无文字说明）",
      "project": "other",
      "topic": "terrain",
      "status": "partial",
      "decodedFrames": 109,
      "reviewEvidence": "artifacts/coverage/wood-ladders-review.md",
      "where": "src/terrain/generate.js · src/core/ladder-profile.js · src/world/navlayer.js · terraces.html",
      "note": "109帧黄色薄平台/柱/梯洞与屋树旋转，仅学习；不等于可用顶列量化复现悬垂结构。 旧片续作：3D锚点梁长/等距踏棍接实际台地木梯，双网格模式恢复通过；原薄台/攀爬仍缺。；【卡点·A 机制未做】原薄台/攀爬仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "note": "387帧坡地接敌/火焰/房屋焦黑；保留已有每人navFloor，修高度缓动随帧率变化，30/60/120Hz真实Battle双楼层解析一致。原火球/动作/坡面未复现。；【卡点·A 机制未做】保留已有每人navFloor，修高度缓动随帧率变化，30/60/120Hz真实Battle双楼层解析一致。原火球/动作/坡面未复现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "note": "908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。；【卡点·B 美术资产】默认解/修复/四分子格回归通过。原图片/动画/完整建筑接入仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
      "reviewEvidence": "artifacts/coverage/path-samples-review.md",
      "where": "artifacts/coverage/path-samples-review.md",
      "note": "227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。；【卡点·A 机制未做】命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
    },
    {
      "id": "807256278154301441",
      "date": "2016-12-09",
      "text": "Looking at cheap swarm pathfinding. These dots could possibly be crabs or maybe recently dormant soviet under-water robots. Who knows.",
      "project": "badnorth",
      "topic": "game",
      "status": "partial",
      "decodedFrames": 344,
      "reviewEvidence": "artifacts/coverage/hip-roof-review.md",
      "where": "src/core/hip-roof.js · src/build/buildings.js",
      "note": "344帧全核。原文群体寻路、图像塔楼及球点，纠正原版无文字六帧说明。共享独立四边房屋可选四檐顶真实重建通过；群体寻路及多格完整规则未验收。；【卡点·D 需接主管线】群体寻路及多格完整规则未验收。 → 卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了",
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
      "where": "src/core/banner.js · src/badnorth/battle.js",
      "note": "23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。；【卡点·B 美术资产】真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。 → 卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似",
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
      "note": "6帧全核，原五阶段仅学习；不将本地四选项冒充SSAO/方向AO。；【卡点·C 算法未公开】不将本地四选项冒充SSAO/方向AO。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
    },
    {
      "id": "806904557502464000",
      "date": "2016-12-08",
      "text": "This one goes out to @CynicatPro @EnricLlagostera @gayasoft and all the other canal lovers out there",
      "topic": "build",
      "project": "townscaper",
      "status": "partial",
      "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
      "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。；【卡点·A 机制未做】楔石/完整桥构仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      "date": "2016-11-26",
      "text": "（帖子无文字说明）",
      "topic": "build",
      "project": "townscaper",
      "status": "partial",
      "where": "src/core/arch-profile.js · src/build/buildings.js · arches.html",
      "note": "全帧核验；现有拱轮廓保留，迁移解析净空/有界弦误差角分段至实际建筑，双网格通过；楔石/完整桥构仍缺。；【卡点·A 机制未做】楔石/完整桥构仍缺。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
    },
    {
      "id": "816748103193817088",
      "date": "2017-01-04",
      "text": "I am flowing right on the nav mesh, so it depends",
      "topic": "nav",
      "project": "badnorth",
      "decodedFrames": 479,
      "reviewEvidence": "artifacts/coverage/816748103193817088-review-r48.md",
      "status": "partial",
      "note": "479帧全核（5张联系表+frame-0128原尺寸）；本轮把「逐面常量流向→过面换向」改成共边带混合：352条共面边 p90 22.50°→0.000°、max 90°→0°（浏览器实测同值），百人 9.6s 全到/出面0/换面抖动 1732→1513；顶点梯度+均值坐标虽也做到0°但抹平崖壁切向导致崖脚卡人40s，已弃用；还缺接进 battle.js、通口前视、共享World自动生成导航面；【卡点·A 机制未做】还缺接进 battle.js、通口前视、共享World自动生成导航面 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
      },
      "where": "src/world/navmesh-flow.js · navmesh-flow.html"
    },
    {
      "id": "798580832906739712",
      "date": "2016-11-15",
      "text": "Some dirt cheap (and highly inaccurate) ray marching. Might use it for visibility when indoors",
      "topic": "light",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/space-visibility.js · src/world/space-visibility.js · space-visibility.html",
      "note": "64帧全核；原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。；【卡点·C 算法未公开】原注释24帧不符。共享World空间射线开阔度局部通过，非灰度烘焙/精确光学视线或游戏AI。 → 卡在原片算法未公开：配文只说\"某算法\"，画面也不足以反推，只能近似",
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
    },
    {
      "id": "787319655648100352",
      "date": "2016-10-15",
      "text": "More procedural tile placement. Now in 3D. Algorithm inspired by the work of @ExUtumno",
      "topic": "build",
      "project": "other",
      "status": "partial",
      "where": "src/core/wfc.js · src/build/buildings.js",
      "note": "67帧全核，仅学习；底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。；【卡点·A 机制未做】底板上逐步拼装桥廊/围合楼体，空中零件待置。已有WFC/建筑保留，原3D模块库/动画未迁入。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活）",
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
};
