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
      "id": "1995813566344011807",
      "date": "2025-12-02",
      "text": "I'm designing a jungle gym / climbable shelf structure for the play area of our home. The sofa-like structure to the left is folding mattress you can slide under the monkey bars. If you've ever build something similar I'd be happy to take advice",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "家里的攀爬架，与游戏无关",
      "project": "other"
    },
    {
      "id": "1991103578011029507",
      "date": "2025-11-19",
      "text": "I think it gives a pretty good sense of a dynamic ocean without being too distractive",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
      "note": "529帧全复核：固定教堂岛，主要动态为分段白色近岸浪；不把“克制动态海洋”推断为现有整片海面颜色漂移公式。保留本地背景处理但纠正归因，新增可开关沿岸周期分段浪峰，实际双网格GPU对照通过。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1991101097818403263",
      "date": "2025-11-19",
      "text": "It's based on a looping vertex shader. The data is baked at generation-time. Each vert has an in-direction, an out-direction and a time offset.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js",
      "note": "477帧全复核：线框浪带展开/到岸，绕高崖与海蚀洞；README明确生成时烘入/出方向和时间偏移。补独立aIn/aOut/aPeriod；退浪局部几何反射是本地近似，不宣称原作公式。真实GPU及View动态像素通过，完整浪形/碰撞仍部分。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1991099314714902634",
      "date": "2025-11-19",
      "text": "Got some pretty sweet new shore waves going",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js · src/world/view.js",
      "note": "545帧全复核：高崖岛/海蚀洞换角度，白色岸浪分段展开/聚散；README只称新岸浪。保留独立进退/周期，补aCrest/aWidth与闭环整数谐波，遮罩/拓扑碰撞及完整原作形态仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1897266928961700215",
      "date": "2025-03-05",
      "text": "Yet another hallway design",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
      "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
      "project": "next",
      "decodedFrames": 108,
      "reviewEvidence": "artifacts/coverage/doodle-review.md"
    },
    {
      "id": "1890018647655272491",
      "date": "2025-02-13",
      "text": "Further iterations on hallway design",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/doodle-layout.js · src/build/doodle-wall.js · src/world/doodle-overlay.js · doodle.html",
      "note": "全帧复核。迁移墙饰路径，补板号独立种子、逐板裁剪与独立墨线遮罩统计，真实World可选贴面。完整室内/弧顶、门口版式及参考纹样复杂度仍待补。",
      "project": "next",
      "decodedFrames": 243,
      "reviewEvidence": "artifacts/coverage/doodle-review.md"
    },
    {
      "id": "1852334860137849222",
      "date": "2024-11-01",
      "text": "A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obvious.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · impostors.html",
      "note": "235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。",
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
      "note": "437帧全复核：黄线贴岸/蓝线外推，270起红三角浪带；窄湾蓝线有交叠。修复黄线Chaikin切凸角、形变后仍用旧法线；只平滑海侧并拒绝落入栅格陆地的端点。全局岩石泡沫mask、折叠消解与浪带全路径防穿岸仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1849730611964973481",
      "date": "2024-10-25",
      "text": "Shoreline waves! This is something I've tackled many times. Although this one is very subtle, it's my favorite thus far. Instead of trying to make the waves roll in and out inside one shader pass, I'm creating loads of overlapping waves that each go through their own cycle",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/wave-cycle.js",
      "note": "599帧全复核：微弱错开岸浪、镜头移位、408起红色重叠三角带。保留实际多浪带，各层烘不同周期，闭环弧长相位改整周期频率，避免接缝正弦频率不闭合。到岸opacity连续，循环端隐藏。GPU/实际双网格通过；泡沫mask/窄湾交叠仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1849427564034498642",
      "date": "2024-10-24",
      "text": "Made some octagonal impostors for these trees. Might seem like overkill for such a stylized look, but they're a lot more stable when rotating the camera than all other billboard solutions I've tried, which is kinda important.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · impostors.html",
      "note": "全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；原球面卡片/多俯仰仍缺。",
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
      "status": "na",
      "where": "",
      "note": "",
      "project": "next"
    },
    {
      "id": "1795831296952041691",
      "date": "2024-05-29",
      "text": "I'm putting together a navigation structure that lets you travel faster along rivers (and especially downstream)",
      "topic": "terrain",
      "status": "partial",
      "where": "src/world/navgraph.js · river-nav.html",
      "note": "598帧全核验；实际高差优先、平床河口距离，未知方向保持中性河费用；Battle/分层流场双网格局部通过。原球面/复杂汇流与完整接口仍缺。",
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
      "note": "README理解后核验0–272全部273帧，关键帧原尺寸回看；真实高度CubeTexture及顶点单次查询、GPU六面方向和球面实验通过。光照公式为本地解释，原作阴影/GI未复现。",
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
        "runtimeReport": "artifacts/coverage/cube-height-browser.json"
      }
    },
    {
      "id": "1786014232594485497",
      "date": "2024-05-02",
      "text": "Mountain textures! These have been tricky. Mountains kinda need lighting and normals, but with my texture blending tech I don't think I can afford that on low-end devices",
      "topic": "light",
      "status": "partial",
      "where": "src/core/mountain-bake.js · mountain-bake.html",
      "note": "234帧全核验，配文未确认斜率烘焙；本地用实际World顶点法线烘焙明度，底色/烘焙/实时法线局部GPU通过。原山体纹理atlas/笔触、原接口及低端性能未验。",
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
      "note": "242帧全核验，球面海陆全景/转镜/近岸色块与浪边。无证据断言每帧重生或唯一3D噪声方法；已有planet网格不等于原纹理，代码待实现验收。",
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
      "note": "219帧全核验：球面投影草/水与手工UV岸带，119附近atlas窗口移入后移出；原文将高度混合列为后续设想。纠正顶面颜色平均=该patch算法的归因，保留本地混色成果；投射/手工UV与atlas/接缝指标接口尚未迁移，本片仅学习完成，未计代码实现/运行通过。",
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
        "runtimeAccepted": false
      }
    },
    {
      "id": "1769691526924292506",
      "date": "2024-03-18",
      "text": "Mega river system! I've had trouble making good rivers before. Now I've sort of special cased the rivers by collapsing them depth-first to let them wiggle real far, and then the rest is collapsed breadth-first, making nice gentle slopes that only occasionally meet steep cliffs.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js",
      "note": "194帧全核验；已有DFS开挖/局部削岸保留，不能冒充球面河道约束坍缩＋其余BFS缓坡，完整生成本批待实现。",
      "project": "next",
      "decodedFrames": 194,
      "reviewEvidence": "artifacts/coverage/river-nav-review.md",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "仅学习/差距审核，完整生成待实现"
      }
    },
    {
      "id": "1769641473895432220",
      "date": "2024-03-18",
      "text": "In cute tile based planets like this you often get a \"mushrooming\" issue where tall mountains get weirdly wide. I managed to mitigate this by a relax pass where all module-containing cells try to achieve their desired shape and size. Note the cells on the top left contracting.",
      "topic": "grid",
      "status": "partial",
      "where": "src/sphere/planet.js · planet.html",
      "note": "479帧全核验；保留足迹弹簧，新增显式模块格约束/逐格尺寸诊断。单格局部通过，多格最差边误差可增大，完整模块形状拟合待补。",
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
      "note": "229帧全核验；现有对偶柱群球面能力保留，原片平滑海岸/模块视觉与平面World/游戏接入仍缺，本批仅学习审核。",
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
      "note": "247帧全核验；真实树查询事件与暂停/拖动、显式栈统计通过。保留first-fit叶内切分，不以模拟手臂代替原遍历；原3D树/跨叶候选待补。",
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
      "note": "558帧全核验，侧视彩块变薄不能误认为删除；重复/过期/跨实例释放拒绝，存活坐标稳定、空兄弟合并与残留碎片验收通过。跨叶放置及完整RectBin接口仍缺。",
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
      "note": "296帧全核验；可选边角/有界随机候选、树剪枝碰撞与跨叶分配/key释放；9000增删和真实查询页面通过，存活槽不动。原3D树和完整RectBin/shelfPack接口仍缺。",
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
      "status": "partial",
      "where": "src/water/watervol.js · src/water/land-distance.js",
      "note": "213帧全核验：小岛镜头降到水面，线框/倒影随角度变化；原文说叠平面采SDF，未说明维度。保留本地浅水近似，补各向异性精确2D中心距离、level1遮罩、版本缓存/空场清理/共享资源释放，实际双网格通过；不同于原片完整反射效果。",
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
        "runtimeAccepted": true
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
      "note": "516帧全核验：高崖、低平教堂、中高教堂岛依次转动，反射轮廓/颜色克制；原文没有公式。保留共享几何近似而不冒称原作算法，新增实际场景颜色混合/扰动/线框对照；完整反射投影/遮挡仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1751945034851570056",
      "date": "2024-01-29",
      "text": "Some nice new highlights when the island is backlit. Achieved by simply adding another inverted mesh outline layer that shows up when looking into the sun. And masked by shadows, of course.",
      "topic": "light",
      "status": "done",
      "where": "src/world/outline.js",
      "note": "两层反向外壳：墨线（固定像素宽）+ 更宽的逆光亮边，只在镜头朝太阳、迎光一侧出现；阴影遮罩用朝下程度近似",
      "project": "next"
    },
    {
      "id": "1751932427272909032",
      "date": "2024-01-29",
      "text": "I can now force specific modules to appear. To do this I first generate the specific bit of grid they need. A large module like this would be highly unlikely to appear by chance on a random grid.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/module-patch.js · module-search.js · module-fit.js · patch.html · src/build/module-volume.js",
      "note": "复用552帧，显式patch/搜索/几何后接共享World原子体量放置、支撑占用预检和按列撤回；完整prefab/socket、形变碰撞及补网/WFC待续。",
      "project": "next",
      "decodedFrames": 552,
      "reviewEvidence": "artifacts/coverage/module-volume-review.md"
    },
    {
      "id": "1727324352264474664",
      "date": "2023-11-22",
      "text": "Yeah that actually looks pretty good. I did not expect that.",
      "topic": "show",
      "status": "partial",
      "where": "src/core/camera-motion.js · src/world/view.js（历史帧近似）",
      "note": "303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。",
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
      "note": "337帧全核验。保留上一批历史帧/释放修复，新增按dt换算的历史留存，30/60/120Hz实际渲染参数通过；原片方向性轮廓拖抹、速度场与全指标接口仍待补。",
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
      "status": "ref",
      "where": "",
      "note": "Unity ScriptableObject + 节点式组件做 UI 逻辑；引擎专用，记作参考",
      "project": "next"
    },
    {
      "id": "1714613599035863191",
      "date": "2023-10-18",
      "text": "Another strange texturing style. This time trying to look a bit like abstract fields. A nice thing is they show the game tiles quite clearly. In the end I probably want a mix where some areas are more man made and others more natural.",
      "topic": "build",
      "status": "partial",
      "where": "src/terrain/field-pattern.js · terrainmesh.js · WorldMesh/View",
      "note": "620帧全核验：条纹弯曲随格块换向，浅崖横带；135/256/473/571附近空屏后换岛，依次出现黑轮廓、无光材质、亮面和田纹；不能把该显示过程断定为原生成算法。补共享World专用顶面属性、逐格固定方向、导数抗锯齿/远处均值，双网格GPU开关通过。仍为解析近似，未完成原作手绘纹样与投射atlas。",
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
        "runtimeAccepted": true
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
      "note": "624帧全核验。四角/白三角/取样色带与OkHsl/OkLab/Srgb菜单可见；新增sRGB四角取样和真实地形顶面编辑，双网格GPU通过。白三角仅预览，OkHsl/OkLab、自由拖点/导出与全材质接入仍待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1710031224838771027",
      "date": "2023-10-05",
      "text": "Ok here's a probably horrible way to author color volumes. The idea is to properly define the whole color possibility space for each feature",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/color-volume.js · src/world/view.js · color-lab.html",
      "note": "515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面；其他特征、离散采样和原版完整接口待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1708815475801505819",
      "date": "2023-10-02",
      "text": "a cool cliff I came across",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/features.js · shape.js · src/core/deformation-guard.js",
      "note": "267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1707497006640365880",
      "date": "2023-09-28",
      "text": "And here's a couple more being generated",
      "topic": "show",
      "status": "partial",
      "where": "纹理灌木生成待实现（保留既有球团管线）",
      "note": "600帧全核验。多组岛从简单几何底色到表面/边缘纹理，夹有空背景和黑轮廓。仅效果证据，不证明生成算法或异步管线；原作纯纹理灌木生成/小阴影仍待实现，保留现有球团近似。",
      "project": "next",
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
      }
    },
    {
      "id": "1707490932017279035",
      "date": "2023-09-28",
      "text": "They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are.",
      "topic": "light",
      "status": "partial",
      "where": "纯纹理灌木待实现（保留现有球团近似）",
      "note": "257帧全核验。配文明确100%纹理，近景有三角线框与小暗边；现有球团/叶片alpha不能算该法复现。纯纹理灌木、浮凸小阴影与表面贴附仍待实现/运行验收。",
      "project": "next",
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
      }
    },
    {
      "id": "1707490274425884929",
      "date": "2023-09-28",
      "text": "I added back the lil' shrubbery at the edges of things for like the 3rd time",
      "topic": "life",
      "status": "partial",
      "where": "src/core/edge-inset.js · src/life/vegetation.js",
      "note": "342帧全核验。保留既有球团近似；修复形变后仍用旧格心判内侧，改按实际多边形绕序/下一边界限幅。双网格实际556/564锚点通过平移形变、恢复及World不变验收；只保证锚点不保证球团体积。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1705195380457996629",
      "date": "2023-09-22",
      "text": "I tamed the texture based surface shadows a bit, so the shadow casting height is independent of the z test height. Now I only get shadows over grass-cliff edges and under roofs. It has some artifacts across UV borders, but it's quite subtle so I might not actually have to fix it.",
      "topic": "light",
      "status": "partial",
      "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
      "note": "300帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
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
      "note": "564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1704218784028905984",
      "date": "2023-09-19",
      "text": "I tried some texture based shadows. Note the shadows on the grass and along the roof edges. Looks kinda cool, but feels a bit too 3D for what I'm going for this time. I feel like it clashes with lines, and I like lines more.",
      "topic": "light",
      "status": "partial",
      "where": "src/light/surface-shadow.js · src/world/view.js · surface-shadows.html",
      "note": "335帧全核验。新增共享World地表高度图阴影，局部凸起筛选投射体、独立深度偏置；实际双网格GPU/缓存通过。仅地面2.5D近似，不是完整纹理浮凸/屋檐/洞内/UV接缝复现，保留已有体素阴影。",
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
      "note": "592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1699146321318314094",
      "date": "2023-09-05",
      "text": "Oh! And now I finally figured out how to make non-straight sedimentary lines! Most of the texturing math is kinda linear, so I though the lines had to be linear too. But I could (obviously) just make the whole world wobbly, do the texturing math, then simply undo the wobble.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。原作场未知，不宣称完整通用3D逆场和原CPU指标API迁移。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1699038611125985317",
      "date": "2023-09-05",
      "text": "Looking att sedimentation lines again. Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/sediment.js · src/terrain/terrainmesh.js · src/world/view.js",
      "note": "620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。原作图案密度/配色/反射与阴影一致性仍待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1696896119794479541",
      "date": "2023-08-30",
      "text": "On the other hand, I've always wanted to make a game in the Art Nouveau style. This might be a good fit. Look how neat and controlled the grass blotches bleed over the cliff edges.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/terrainmesh.js",
      "note": "550帧全核验。保留已有沿形变崖面圆瓣草边几何；这是本地近似，未迁移原版rim距离场/atlas受控跨崖采样及可调bleed等接口，本片实现/运行验收仍待完成。",
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
        "runtimeAccepted": false
      }
    },
    {
      "id": "1696864977171189980",
      "date": "2023-08-30",
      "text": "I'm slowly emerging from a huge refactoring... While this here is not exactly the look I'm going for, it's showing off a big improvement to the texturing. I'm now able to draw with much bigger blotches without the blotches bleeding across and messing up important edges.",
      "topic": "texture",
      "status": "partial",
      "where": "src/terrain/blotch-pattern.js · src/world/view.js",
      "note": "502帧全核验。共享View修复绿色屋顶被地面笔触误染：显式顶面标记+法线/颜色筛选，按真实levelHeight选层。实际材质GPU对照排除屋顶/岩壁、双网格通过；原版atlas/rim距离场和完整参数接口待补，局部修复不等于视觉等价。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1677242779162877952",
      "date": "2023-07-07",
      "text": "I am (once again) rewriting my generic triangle graph system to (hopefully) be more robust and generic. Here's a stress test where I'm adding random verts, making sure the graph stays mainifold and delauney-ish along the way.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/trigraph.js · trigraph.html",
      "note": "白色三角线框扩展、不规则外轮廓和局部彩边变化；画面不证明严格Delaunay或无几何交叉。 本轮确定性检查/坏输入拒绝局部验收通过，局部编辑接口待补。",
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
      "status": "na",
      "where": "",
      "note": "",
      "project": "next"
    },
    {
      "id": "1671808851895627776",
      "date": "2023-06-22",
      "text": "If your terrain generator supports overhangs you gotta flaunt it. I don't make the rules, but I do follow them.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/core/rock-topology.js · terrain/features.js · terrainmesh.js",
      "note": "303帧全核验：岩檐、柱间空洞、下层地面与环绕低机位。保留已有World分层rock及侧/底面，补岩石区间/空隙/level1连通诊断；真实双网格底面6顶点、断开支撑可报1未连岩石。薄岩檐平滑形变仍收缩，视觉未等价；原版软坡/侵蚀有效生成与完整接口待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1670794261669769217",
      "date": "2023-06-19",
      "text": "Oh, and I finally got this lovely rock feature to show up! When working with WFC, sometimes you build a cool tile and it wont show up in forever, since it's conditions are so specific. You forget about it, and then suddenly: poof!",
      "topic": "terrain",
      "status": "done",
      "where": "src/terrain/features.js · src/core/module-audit.js",
      "note": "247全帧：绕视岩拱小岛，条件稀有来自原文而非画面统计。保留已有岩拱，补有限样本拓扑诊断，预算截断不判不存在；不是WFC出现概率。",
      "project": "next",
      "decodedFrames": 247,
      "reviewEvidence": "artifacts/coverage/module-audit-review.md"
    },
    {
      "id": "1670790425232175108",
      "date": "2023-06-19",
      "text": "I'm prepping for a talk in Cambridge next week, thus all the gifs. I made my generator also output pure triangle/hex and square grids, to illustrate why I'm going for my mixed approach.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · grids.html?t=kinds",
      "note": "610帧全核验；修“纯方格”仍有三角的误标，新增真正正交方格，保留合并菱形对照，局部Canvas/WorldMesh通过；独立六边地形/原模块仍缺。",
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
      "note": "164帧全核验，原片依次切换三模式；保留已有分层/Taubin/保护，但完整无/普通/分层对照及原模块语义仍待补。",
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
      "note": "102帧全核验；共享切面补显式hardEdges/全层钉点，双网格局部通过。原模块/材质三角网语义仍缺。",
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
      "status": "ref",
      "where": "",
      "note": "Burst 里模拟 Thread.Sleep 来慢放生成过程；我们首页的「完整管线示例 · 一步加一层」是同一目的",
      "project": "next"
    },
    {
      "id": "1669315384619540487",
      "date": "2023-06-15",
      "text": "The generator consistently spits out pretty cool islands now",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/generate.js",
      "note": "649帧全核验，多岛成果/构建过渡与转镜；完整软坡/模块联合生成和原美术质量仍待补，本批仅学习审核。",
      "project": "next",
      "decodedFrames": 649,
      "reviewEvidence": "artifacts/coverage/grid-kinds-review.md",
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
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "仅多岛成果视频学习与差距审核"
      }
    },
    {
      "id": "1666429884208381953",
      "date": "2023-06-07",
      "text": "I've been banging my head against various shore line rendering options for a good week now. Gonna stick with this for now I think, which is basically just a refined version of what I did for Bad North and Townscaper.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
      "note": "630帧全核验：旋转/固定高崖岛，凹湾与白色岸裙细微聚散；原文只说Bad North/Townscaper改良版，不证明具体距离算法。共享水层改规范绕序/按左侧陆地转向及自接闭环分解，1024组合及实际双网格通过；蓝线窄湾交叠/泡沫mask仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1664566546683899905",
      "date": "2023-06-02",
      "text": "Here's a distance field-like mesh skirt solution very similar to Townscaper and Bad North. It works for calm waters I guess... But I would like something with a bit more punch this time. A bit more crashing waves.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-profile.js",
      "note": "340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过，独立原版buildShoreDistance API未迁移。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1664565063552847873",
      "date": "2023-06-02",
      "text": "I'm trying out using a shader based fluid simulation. But I'm skeptical. It seems to need 32 bit float render targets, and I don't trust that those will work across platforms. Might also be a challenge to tweak, stylize, and feed back to CPU if needed.",
      "topic": "water",
      "status": "partial",
      "where": "src/world/float-probe.js · float.html",
      "note": "117帧已核验；本环境16F/32F写入、负值/HDR回读和线性过滤通过；跨平台及平流/CPU误差待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1654401054828638214",
      "date": "2023-05-05",
      "text": "An quaint island being procedurally generated",
      "topic": "terrain",
      "status": "ref",
      "where": "src/terrain/generate.js",
      "note": "一座岛的生成过程：三角底网 → 线框崖 → 上色",
      "project": "next"
    },
    {
      "id": "1593215065423245313",
      "date": "2022-11-17",
      "text": "Making a lil dynamic sprite packer, able to add and remove sprite allotments at runtime. I had one of these in Bad North and found it very useful. Here, the sprites are baked live from meshes. So I guess it's basically impostors. Though I expect to use it for much else too.",
      "topic": "life",
      "status": "partial",
      "where": "src/life/impostor.js · atlas-live.html",
      "note": "164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收；本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。",
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
      "note": "181帧全核验：全片反差纹理诊断配色，镜头环绕多层岛，草缘随背景变化。原文明说顶点shader采站立处与背景射线的contrast texture差值。当前仅静态邻崖距离aEdge，未实现该GPU采样/背景射线；只记学习完成，实现及运行验收待补，不把已有启发式当原法。",
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
        "runtimeAccepted": false
      }
    },
    {
      "id": "1590669875869286400",
      "date": "2022-11-10",
      "text": "An early look at grass billboards. I really like how they add a completely new kind of shape and detail frequency.",
      "topic": "life",
      "status": "done",
      "where": "src/life/vegetation.js",
      "note": "草丛广告牌：扇贝边叶丛（5 个圆的并集 + 叶瓣弧线墨线），一簇簇堆在崖脚 / 崖顶 / 坡上；之前做成尖草叶是错的，已重做",
      "project": "next"
    },
    {
      "id": "1584623053061099520",
      "date": "2022-10-24",
      "text": "I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful insert them at will too. You can kinda see the structure of my mesh system and mesh algoritms by how the yellow lines are rotating around the verts.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
      "note": "453帧全序列复核：线框接缝遍历后切实体屋与整岛；不能从画面证明双线性切洞。保留已有显式双格/整体编辑/工程身份，复测两网格各6栋同World融合通过；本批未重写既有房屋算法，任意轮廓插入/地形周边重新网格化仍缺。",
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
        "runtimeAccepted": true
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
      "note": "434帧核验：是坍缩边缘候选评估/简化导航扩展，不是战役边境，也不等于旧同高区域图。新增只读邻接候选枚举，真实半边、三角/四边格及预算不完整结果；WFC页接入、184域与双网格运行通过。尚未实现增量生成与简化导航互连。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1580846877855338497",
      "date": "2022-10-14",
      "text": "Here's the slowed down bounce sequence. You can see how the mega texture and the light volume affect each other back and forth. After about the 3rd bounce, further bounces are not noticeable.",
      "topic": "light",
      "status": "partial",
      "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
      "note": "41帧复核（不是旧注释11帧）：重置→直射→体积→阴影填充。新增0/1/3/6次实景对照与每次平均/最大/相对变化，取消“任意场景第三次后不变”推断。两网格实测变化递减，但不是原片像素误差或普遍收敛证明；完整贴图/体积往返反馈仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1580845127207387137",
      "date": "2022-10-14",
      "text": "1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in the mega texture! 2nd is a baked 6 directional light volume, raycast against the sdf, sampling the mega texture using the UVs where it hits the sdf. 3rd is the lit mega texture",
      "topic": "light",
      "status": "partial",
      "where": "src/light/lightvolume.js · src/world/view.js · lightvolume.html",
      "note": "213帧复核：原文SDF距离/UV→mega-texture→六方向体积。新增可选六RGB方向/法线权重、静态命中缓存、太阳有限DDA和切片；真实双网格通过。反弹反馈仍使用平均RGB与逐格反照率，不等同原作SDF/UV/mega-texture反馈，继续部分。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1580835075629133825",
      "date": "2022-10-14",
      "text": "I always write my own lighting solutions. I've had some really naive ad hoc color bleeding in my (very fake) GI before, but this is my first decent attempt to actually have the light *bounce*",
      "topic": "light",
      "status": "partial",
      "where": "src/core/voxel-distance.js · src/light/lightvolume.js · lightvolume.html",
      "note": "185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。原版2.5D形因子gather/暴力参考接口未迁移，映射改列部分，已有重构保留。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1580162341668237312",
      "date": "2022-10-12",
      "text": "I start with a very basic Marching Cubes mesh from a bunch of spheres. I mark the edges between triangles that are closest to different spheres. Then I run an iterative relax algorithm where those hard edges are like rubber bands, and the rest is sort of a like a balloon.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/canopy.js · src/life/vegetation.js · src/life/impostor.js",
      "note": "155帧复核；球并集surface nets、三角形接缝松弛、闭合/绕向与真实树冠及impostor输入通过。低分辨率歧义拒绝；非原作MC/参数或美术复制。",
      "project": "next",
      "decodedFrames": 155,
      "reviewEvidence": "artifacts/coverage/canopy-review.md"
    },
    {
      "id": "1580158269267406849",
      "date": "2022-10-12",
      "text": "Can you make good looking foliage from Marching Cubes-blobs? Maybe?",
      "topic": "grid",
      "status": "done",
      "where": "src/life/vegetation.js",
      "note": "树冠 = 几个球融在一起，法线取离整团中心的方向与自身法线的混合 → 像 Marching Cubes 团块一样整团受光；三种树冠变体",
      "project": "next"
    },
    {
      "id": "1579483114178768898",
      "date": "2022-10-10",
      "text": "Obviously, it's all tile-based. I went through a major rewrite to combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North). Note how one of the house tiles even cover both a square tile AND a triangular tile",
      "topic": "grid",
      "status": "partial",
      "where": "src/build/multicell.js · src/world/scenes.js · multicell.html",
      "note": "177帧已复核；共享World显式双格及整体编辑保留，工程JSON保存独立实例ID/编辑回执，完整重载后继续编辑与页面撤销通过。通用模块身份、统一撤销栈及完整prefab/socket待续。",
      "project": "next",
      "decodedFrames": 177,
      "reviewEvidence": "artifacts/coverage/house-project-review.md"
    },
    {
      "id": "1579478470098243584",
      "date": "2022-10-10",
      "text": "To make the cliffs look more organic, I'm doing some pretty radical cage deformation on the cells.",
      "topic": "terrain",
      "status": "partial",
      "where": "src/terrain/shape.js · src/terrain/terrainmesh.js · cage.html",
      "note": "272帧全核验，含线框构建/着色/转镜；保留共享切面与保护，修分数层高查询并复用到沉积线，连续角点局部通过；完整原cage/3D碰撞仍缺。",
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
      "note": "454帧全核验，片中两组岛线框构建/着色/转镜；原文未揭示生成器算法，完整坡面/模块联合生成仍待补。",
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
      "status": "ref",
      "where": "",
      "note": "深夜的神秘图：一圈圈同心的环形图",
      "project": "next"
    },
    {
      "id": "1489193847422865410",
      "date": "2022-02-03",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "next"
    },
    {
      "id": "1482346496460828674",
      "date": "2022-01-15",
      "text": "I created a dedicated contrast texture system for the lines: an iterative simulation on the triangles that starts random and then tries to make contrasted edges different, and non-contrasted edges similar. A byproduct is a beautiful color gradient that help express connectivity",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/contrast-field.js · color-lab.html（三角诊断）",
      "note": "517帧全核验，纠正原注释6帧；图集预览、灰岛上色和两组岛环绕。新增确定性标量对比图求解与实际网格三角诊断，预算修复后仍报告违例；原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。",
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
        "runtimeAccepted": false
      }
    },
    {
      "id": "1482011744843223042",
      "date": "2022-01-14",
      "text": "Ok, I stumbled on a pretty cool art style now. Here, I'm creating pixel thin lines from contrasts in my procedural normal map. I should probably move to a bespoke contrast texture (to get more deliberate control over the lines). But I gotta say this looks pretty promising.",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/normal-contrast.js · normal-contrast.html",
      "note": "384帧全核验；源为程序化normal map反差，不是后续contrast迭代。共享地形材质新增解析法线场/物理像素覆盖局部近似，GPU双网格通过；原笔触normal atlas与投影接缝仍缺。",
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
      "note": "425帧全复核：旋转、线框/重建、法线/SDF/六AO图。补各向异性精确体素中心EDT、保守距离下界步进+DDA兜底，六向距离AO及梯度法线诊断接真实View；不等于形变表面SDF。笔触法线/切线贴图和SDF命中UV/mega反馈仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1480635131614355459",
      "date": "2022-01-10",
      "text": "More experiments in procedural texturing of procedural islands. Still very early, but I do like these big paint blotches. They hide the polys well and they would be hard to achieve with other means. Definitely need a proper lighting system though. And probably some outlines.",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（地面笔触）",
      "note": "大块颜料斑藏住多边形：量化的三档明暗只画在朝上的草色面",
      "project": "next"
    },
    {
      "id": "1478114309263839244",
      "date": "2022-01-03",
      "text": "Yeah that's good enough for now. I quite like how the radial (instead of directional) size-sorting looks. Gonna make for some visually pleasing textures with that big coherent chunk in the middle.",
      "topic": "texture",
      "status": "partial",
      "where": "textures.html?t=radial（保留圆块近似；UV流程待补）",
      "note": "346帧全核验，原片三角UV样式图块/棋盘模型与线框调试。旧圆块螺旋和矩形radialPack不能代表UV分片/参数化/装箱，本片仅学习审核完成，代码待实现验收。",
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
      "status": "done",
      "where": "src/core/grid.js（buildMixedGrid）",
      "note": "\"方，又带六边形味\"的岩岛：三角 + 方格混合网格",
      "project": "next"
    },
    {
      "id": "1466059785703460870",
      "date": "2021-12-01",
      "text": "Oh. What's this? A free Townscaper web demo, playable straight in the browser: http:// oskarstalberg.com/Townscaper/ 🕊️💦🌊🏡🏤⛪️🏤🏡🌊💦🕊️",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "next"
    },
    {
      "id": "1459169210752507904",
      "date": "2021-11-12",
      "text": "And another",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "next"
    },
    {
      "id": "1458921394855718917",
      "date": "2021-11-11",
      "text": "I'm exploring the Half Edge data structure. Feels like a really lightweight, powerful and versatile way of representing topology. A big thanks to everyone suggesting I look into it.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · src/core/adjacency.js",
      "note": "圆内四边形组与彩色剩余区域轮廓、间隙三角网，反复重置铺组/填网；未据颜色推断具体半边指令。 现有互反邻接保留，显式半边环/扇及编辑接口待补，本轮仅学习。",
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
      "status": "ref",
      "where": "src/ui/walkthrough.js",
      "note": "岛屿生成的计时 + 可视化（线框逐步出现）；重构版的「完整管线示例」一步一层，同一用意",
      "project": "next"
    },
    {
      "id": "1447496205282549761",
      "date": "2021-10-11",
      "text": "The base graph is just a humble irregular triangle grid",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js · src/terrain/generate.js",
      "note": "全383帧核验，多个不规则三角底图到分层线框/完成岛例；完整软坡/河道/预制tile生成仍未覆盖，本批仅学习审核。",
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
      "note": "全178帧模块库核验；新增四边形对角四分/父格映射并进入共享WFC，四子格联合模块约束及原3Dtile仍缺。",
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
      "note": "656帧全核验：缓坡/硬崖同框、多组生成的稀疏白线/暗轮廓/完整岛与旋转。配文明确侵蚀有效无局部低洼，但画面不能证明该保证；现有XZ层级形变不等于完整连续坡面/排水算法。本批仅学习完成，原软坡/侵蚀实现和运行验收待补，相关薄檐形变保护另记。",
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
        "runtimeAccepted": false
      }
    },
    {
      "id": "1447483550257799171",
      "date": "2021-10-11",
      "text": "I regret to inform you that I've relapsed into procedural island generation",
      "topic": "terrain",
      "status": "ref",
      "where": "src/terrain/generate.js",
      "note": "又回到岛屿生成（画面：暗色岩块 + 蓝色河网的岛，再到线框图）",
      "project": "next"
    },
    {
      "id": "1430227487376781317",
      "date": "2021-08-24",
      "text": "Plus you can change the in-game textures now! So I guess the game is now (in the most liberal use of the word) \"moddable\"",
      "topic": "texture",
      "status": "ref",
      "where": "",
      "note": "可以换游戏内贴图了（画面：在 Photoshop 里改 Townscaper 的总贴图）。重构版没有总贴图，不适用",
      "project": "townscaper"
    },
    {
      "id": "1430224300003545091",
      "date": "2021-08-24",
      "text": "If you've been waiting for the Townscaper mesh exporter, you can now try it out in the public beta branch on Steam. There's a bunch of other subtle changes and optimizations too, but nothing major. Please do let me know if you run into any issues!",
      "topic": "tools",
      "status": "partial",
      "where": "src/tools/objexport.js",
      "note": "288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。",
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
      "status": "ref",
      "where": "src/badnorth/battle.js（血迹贴花）",
      "note": "不断叠加贴花的技术测试，像黏土动画 / 抖动线；北境的血迹是累积贴花，但没有这种画风",
      "project": "townscaper"
    },
    {
      "id": "1410697531424714752",
      "date": "2021-07-01",
      "text": "Townscaper is now on GoG! https:// gog.com/game/townscaper",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1401145625572425728",
      "date": "2021-06-05",
      "text": "Meshes in Townscaper are kept small to rely on Unity's dynamic mesh batching. This approach was not performant enough on the Switch though, so I wrote a mesh merger to do my own batching instead. It made a huge difference, something like tripling the rendering speed.",
      "topic": "tools",
      "status": "partial",
      "where": "src/world/worldmesh.js · src/tools/mesh-audit.js · save-mesh.html",
      "note": "349帧全核验。README是Switch动态合批不足后自写mesh merger；视频线框/着色不能独立证明三倍性能。保留既有WorldMesh分块缓存后拼成单一主体，新增真实GPU主体提交诊断；双网格编辑前后均1次提交，不含水/植被/阴影，未宣称Switch复现或全场景单call。",
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
      "note": "679帧全核验；有向格/出边判环、停止原因和真实中点段局部验收通过；游戏手柄/连刷仍未接入。",
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
      "note": "524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。",
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
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1370772056279805953",
      "date": "2021-03-13",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1344290848180203523",
      "date": "2020-12-30",
      "text": "A rare look at Townscapers sophisticated QA process",
      "topic": "show",
      "status": "partial",
      "where": "src/core/qa-replay.js · qa-replay.html",
      "note": "814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。",
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
      "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
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
      "note": "711帧两片全核验；修三角化/松弛阶段误用同一最终坐标，保留现有投影/松弛；区分真实球面拓扑与平面60面抽样，局部GPU通过。原投影往返/动态重三角化与完整视觉仍待补。",
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
      "where": "src/core/infinite.js · grids.html",
      "note": "块（Patch）+ 簇（Cluster）各自松弛，顶点 = 所在块 + 最近两簇的重心插值；实测两侧位置差 4e-15、无翻折",
      "project": "townscaper"
    },
    {
      "id": "1331905048801144836",
      "date": "2020-11-26",
      "text": "Townscaper now has lighthouses! This pattern required more code rewrite than seems reasonable. Luckily, I got some slight optimization out of it too. https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "build",
      "status": "done",
      "where": "src/build/lighthouse.js（开关「灯塔」）",
      "note": "海边、≥5 层、每个邻格都矮 2 层以上的一格粗塔 → 自动加灯室（窗棂 + 暖光）、平台栏杆、红尖顶，夜里一道光束绕塔转",
      "project": "townscaper"
    },
    {
      "id": "1313841094069817344",
      "date": "2020-10-07",
      "text": "Because I'm quite proud of my lighting (and because Townscaper is basically just a tech demo anyway) I added texture-only and light-only render modes",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js",
      "note": "只看贴图 / 只看光照两种渲染模式",
      "project": "townscaper"
    },
    {
      "id": "1313840428685447170",
      "date": "2020-10-07",
      "text": "I added some sunlight (with shadows) and a gizmo to control it",
      "topic": "light",
      "status": "partial",
      "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
      "note": "501帧全核验：二维太阳盘与滑条改变光照，夜间窗户亮，457附近恢复白天。保留原有日夜/太阳方位，补方位+高度控制共享真实View及水面三场阴影；不是复制原界面或完整地平线日照模拟。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1313837640366596096",
      "date": "2020-10-07",
      "text": "I just pushed an update to Townscaper. You can now build flying towns (if you find any of the perfect loops I've scattered across the grid) https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/grid.js（traceStraight）",
      "note": "完美环：直线绕回起点时检测出来；飞岛玩法没做",
      "project": "townscaper"
    },
    {
      "id": "1310503825510367232",
      "date": "2020-09-28",
      "text": "Ok, I tried the mixed perspective. Note how houses further away are smaller, yet the vertical lines stay straight and parallel. It's definitely not a good fit for Townscaper, but might work well if I make another Bad North-ish game with a hearty mix of 3D meshes and billboards.",
      "topic": "build",
      "status": "ref",
      "where": "",
      "note": "混合透视：远处房子变小但竖线保持平行。需要自定义投影矩阵，记作相机参考",
      "project": "townscaper"
    },
    {
      "id": "1305951750638231552",
      "date": "2020-09-15",
      "text": "To soften it up a bit, I'm trying out a penumbra approach where I draw the shadow thrice, once normal, once pulled in slightly and once with big voxels. I think I like it. (here, the shadow is shown darker than it should be to demonstrate the effect)",
      "topic": "light",
      "status": "partial",
      "where": "src/core/penumbra.js · src/light/penumbra.js · src/world/penumbra-layer.js · src/world/view.js",
      "note": "521帧全核验：塔楼编辑/旋转与长影，409起RGB阴影纹理通道检查。共享World顶面派生三场水面阴影，正确保留粗格世界尺度/最高遮挡、内收/合成与预算；真实双网格编辑/转太阳/释放通过。2.5D仅水面，洞/悬挑/形变表面及原片半影宽度匹配仍缺。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1305948413872267265",
      "date": "2020-09-15",
      "text": "I'm exploring cast shadows. They have to be quite subtle and soft to fit the style. It does seems like they should be fast enough for mobile too if I only update them on command after a regeneration.",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js",
      "note": "柔和投影：实时 PCF 软阴影，海面有投影接收层",
      "project": "townscaper"
    },
    {
      "id": "1302686201401442309",
      "date": "2020-09-06",
      "text": "A smoothing and inversion bug I came across while playing with the grid generation. The inverted patches collapse into a mess, but are stretched out when interpolating to fit with their neighbors. And the poor non-inverted patches need to stretch real far to pick up the slack",
      "topic": "grid",
      "status": "ref",
      "where": "src/core/infinite.js（verify）",
      "note": "平滑 + 翻折 bug 的画面：翻折的块塌成一团、邻块被拉长。我们每组外圈钉住，verify() 统计翻折数（实测 0）",
      "project": "townscaper"
    },
    {
      "id": "1301816247479345152",
      "date": "2020-09-04",
      "text": "Some are asking for the option to use regular grids. Now, that's (obviously) against the Townscaper design philosophy. However, I am thinking of sprinkling the current generated grid with random patches of hand crafted grid, like little gems to find and build your tempels upon",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/radial-patch.js → World / WorldMesh；gridpatch.html",
      "note": "324帧复核：是六边形外轮廓中的规则四边格/放射模板与环形庭院，不是正六边形格子。补单个星形孔洞的规则内环/过渡四边格并复用原边界。48组25通过23明确拒绝；多补丁/完整手工库、填充世界迁移待补。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。 视觉限制：中央放射细长格产生偏高塔顶，与原片小塔比例不符，需模板/建筑屋顶继续适配。",
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
        "visualMatchAccepted": false
      }
    },
    {
      "id": "1298689301488775169",
      "date": "2020-08-26",
      "text": "Flat texture, shaded, lighting only, and my AO baking mesh. I'm thinking of adding some little widgets like this to give people a peek at how things work. Perhaps hide them behind a break-glass-to-push-button widget.",
      "topic": "light",
      "status": "partial",
      "where": "src/world/view.js（lightonly / ao）",
      "note": "平涂 / 着色 / 只看光照 / AO 烘焙网格四种视图：前三种有（面板开关），AO 烘焙网格的可视化没做",
      "project": "townscaper"
    },
    {
      "id": "1290997501332525056",
      "date": "2020-08-05",
      "text": "#Townscaper is now properly released on Mac on Steam! To celebrate the occasion, I added some garden paths. Go get it: https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "life",
      "status": "partial",
      "where": "src/core/garden-paths.js · src/build/buildings.js",
      "note": "187帧全核验：院落封闭转草坪、门洞通路/横向小径和中心装饰；原文只说新增garden paths。修本地PCA窄带筛格可能断路，改主轴端点+院内邻接BFS，90种连通占用/环洞/双网格真实World通过。保留既有墙边灌木；细石板宽度、门口优先和中心装饰仍待补。",
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
        "runtimeAccepted": true
      },
      "page": "garden.html"
    },
    {
      "id": "1279107097108635649",
      "date": "2020-07-03",
      "text": "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them.",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js（sigColor）",
      "note": "模块签名调试色：同一种邻居占用涂同一种颜色",
      "project": "townscaper"
    },
    {
      "id": "1277554535297236994",
      "date": "2020-06-29",
      "text": "Ok I'm gonna try something that probably wont work: if you wanna help me translate Townscaper to your language, I simply made the localization spreadsheet public: https:// docs.google.com/spreadsheets/d /1sKbLTWhlpa3CcpOKBnACkJ1kl7_Bi2HvW78gaEQUo1c/edit?usp=sharing …",
      "topic": "tools",
      "status": "ref",
      "where": "",
      "note": "把本地化表格公开让玩家帮忙翻译；左右箭头切语言。我们的界面只有中文，记作参考",
      "project": "townscaper"
    },
    {
      "id": "1275089608758484992",
      "date": "2020-06-22",
      "text": "It has not escaped some of you that I have yet to release Townscaper. I have an important (secret) business thing to consider, and instead of making a decision I've been making church doors and and ladders. (but do wishlist though: https:// steamcommunity.com/app/1291340 )",
      "topic": "build",
      "status": "na",
      "where": "",
      "note": "发布前的商务说明，无技术内容",
      "project": "townscaper"
    },
    {
      "id": "1273520600221433857",
      "date": "2020-06-18",
      "text": "Butterflies fly quite different from birds. Mine loosely orbit a potential landing spot, and drift by randomly switching that spot. Additional world space noise adds variability but also coherence (without boiding) (as always, please wishlist: https:// store.steampowered.com/app/1291340/To wnscaper/ … )",
      "topic": "life",
      "status": "done",
      "where": "src/life/decor.js",
      "note": "落点 = 小花 + 后院；每只绕落点松散转圈（半径 0.12–0.27），3–9 秒随机换附近落点；速度叠世界空间噪声 → 同一片的蝴蝶往同一边飘；翅膀扇动",
      "project": "townscaper"
    },
    {
      "id": "1270725616430530566",
      "date": "2020-06-10",
      "text": "You all keep pestering me to release this when I hadn't even added butterflies yet. But do indeed go wishlist: https:// store.steampowered.com/app/1291340/To wnscaper/ …",
      "topic": "life",
      "status": "done",
      "where": "src/life/decor.js",
      "note": "蝴蝶在后院花园上空飞（画面：环形排屋围着的花园）",
      "project": "townscaper"
    },
    {
      "id": "1260586697538113537",
      "date": "2020-05-13",
      "text": "Making a trailer is a ton of work. But the good news is I can use the undo/redo stack for snappier and more directed building footage.",
      "topic": "build",
      "status": "partial",
      "where": "src/core/snapshot-replay.js · src/world/app.js",
      "note": "167帧全核验。保留撤销栈快照回放，修复60条截断后sceneStart偏移、回放中编辑污染以及异常/取消不恢复；新增只读/取消回放helper和Esc/再次点击停止。正常结束、取消、UI锁和撤销重做保留已双网格实测；完整动作动画/水花音效、镜头和节奏录制仍缺。",
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
      "where": "src/life/effects.js",
      "note": "第一块落进水（之前顶层 0）或拆到水面：一圈白色泡沫环向外扩、变淡 + 26 颗飞沫（重力下落、落水即灭）",
      "project": "townscaper"
    },
    {
      "id": "1258005604066627586",
      "date": "2020-05-06",
      "text": "Here's that but in Townscaper. And Triangular.",
      "topic": "grid",
      "status": "ref",
      "where": "",
      "note": "同一套东西搬进 Townscaper、换三角网格（灯塔塔楼）",
      "project": "townscaper"
    },
    {
      "id": "1257213678056857600",
      "date": "2020-05-04",
      "text": "Alrighty. First 20 people to reply gets a b e t a k e y *steam on windows for now",
      "topic": "build",
      "status": "na",
      "where": "",
      "note": "发 beta key，无技术内容",
      "project": "townscaper"
    },
    {
      "id": "1246074663546916873",
      "date": "2020-04-03",
      "text": "The props now animate when they appear and disappear. This was much trickier than I anticipated.",
      "topic": "build",
      "status": "partial",
      "where": "src/life/effects.js（局部增长/灰尘反馈，非完整道具生命周期）",
      "note": "306帧全核验，确认道具会随布局变化出现/消失；旧uPops只是柱顶增长的局部缩放，拆除灰尘不是逐道具缩没。保留原反馈但src/propanim映射改部分覆盖，稳定身份/保留消失几何/错峰及原CPU接口均待接，未记运行验收完成。",
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
      "where": "src/life/birds.js",
      "note": "海鸥：屋脊顶点找栖位成排停（有描边、会挪步）；起飞 → 绕镇流动地飞（扇翅 / 滑翔）→ 落回空栖位；水里有倒影",
      "project": "townscaper"
    },
    {
      "id": "1243228419162341379",
      "date": "2020-03-26",
      "text": "Some moody clouds",
      "topic": "life",
      "status": "partial",
      "where": "src/life/vegetation.js · src/life/impostor.js · clouds.html",
      "note": "489帧全核验；修复远云固定时钟，连续环带/远平面深度避免盖建筑；首页独立开关。双网格GPU/三场局部通过，原片高耸云体/层次、真实风平流仍缺。",
      "project": "townscaper",
      "decodedFrames": 489,
      "reviewEvidence": "artifacts/coverage/clouds-winter-review.md",
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
        "acceptanceScope": "本地远云运动/遮挡与入口局部通过，非原作完整云体等价"
      }
    },
    {
      "id": "1242824460325052417",
      "date": "2020-03-25",
      "text": "Finally making some proper UI. Turns out you can make a boring list of buttons playful by just tilting them slightly.",
      "topic": "tools",
      "status": "partial",
      "where": "src/core/playful-layout.js · ui.html",
      "note": "383帧全核验。按键/种子确定轻微倾斜，旋转AABB限制间距，只改视觉层、原生按钮命中槽稳定；换页复现/Enter通过。原布局/图标API及游戏菜单尚未完整接入。",
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
      "note": "302帧全核验：同机位砖石小镇，细线/粗线效果反复切换；137附近拉远、251附近拉近。原文仅说明采样前UV加速经过隔像素线，不说明确切公式。原硬切函数改共享连续重映射+线性采样，6档CPU积分/4档真实GPU验收；仅放大约1px，缩小仍缺mipmap，建筑/植被atlas未全面接入。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1241046107125399552",
      "date": "2020-03-20",
      "text": "I moved my plants to a 32² corner on the 128² texture I'm using for everything else. Plus they now also use the every-other-pixel-is-a-line tech, so everything is crisp and nice up close",
      "topic": "life",
      "status": "partial",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
      "note": "168帧全核验：后院灌木与盆栽、镜头往返；原文说明植物占128²的32²角落，画面未打开atlas。补真实128²/32²保留区、连续texel采样并接入共享灌木/树冠。不是全场景共用atlas，原作植物素材与所有植物种类仍待迁移。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1239901715266244609",
      "date": "2020-03-17",
      "text": "If you're hunkered down hiding from the virus (as you should be) and need something to do, I'll be shameless enough to plug our last project, the minimalist strategy game Bad North. Available on PC, Mac, IOs, Android, Switch, PS4, Xbox. @BadNorthGame https:// store.steampowered.com/app/688420/Bad _North_Jotunn_Edition/ …",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1238474550511308800",
      "date": "2020-03-13",
      "text": "I needed some more greenery, so now if you build an enclosed area it becomes a backyard!",
      "topic": "build",
      "status": "partial",
      "where": "src/core/courtyards.js · src/build/buildings.js · garden.html",
      "note": "202帧全核验。提取共享courtyards分类器，院墙按地面上实际第2层实心判定，修复上层桥/悬空屋顶误封闭；双网格封闭→墙层镂空/地面开口→重封闭通过。规则为本地离散近似，未复现原作矮墙分区/精细拱门/形变边界与全部植物。",
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
      "where": "src/light/bake.js",
      "note": "白墙旁边的红墙会把一点红色反到白墙上",
      "project": "townscaper"
    },
    {
      "id": "1237293295887319040",
      "date": "2020-03-10",
      "text": "More colors! I had been assuming the combinatorics would go crazy and that all my assumptions would break if I introduced more colors, but I was wrong and it was fine.",
      "topic": "texture",
      "status": "done",
      "where": "src/core/palette.js",
      "note": "更多颜色：15 个色槽（画面左边一列 15 色）",
      "project": "townscaper"
    },
    {
      "id": "1215644531221311488",
      "date": "2020-01-10",
      "text": "The technical solution is almost the same as in Bad North. One big difference is that the bright colors wouldn't let me get a way with a monochrome reflection, so I had to figure out this somewhat abstract flat colored mid point. (Also, the wave skirt stretches further this time)",
      "topic": "water",
      "status": "partial",
      "where": "src/water/reflection.js · src/world/view.js",
      "note": "270帧全核验：彩色中间倒影/宽岸裙，160起倒影与建筑线框。保留共享WorldMesh翻转，补实际水面上方裁切、受限深度淡出及线性颜色中点模块；GPU/双网格通过。未复现全部块面艺术与岸裙尺度。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1215642481162887168",
      "date": "2020-01-10",
      "text": "Ok I went ahead and put this whole project on water. Long time fans of the show know this was inevitable.",
      "topic": "water",
      "status": "partial",
      "where": "src/water/shore.js · src/core/shore-loops.js · src/world/townDemo.js",
      "note": "330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。保留已有实际World小镇，补角接分岛/加桥合并的闭环稳定性；真实双网格2→1闭环及恢复小镇通过。拱底精确截面/完整建造美术仍缺。",
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
        "runtimeAccepted": true
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
      "note": "爸妈来访搭小镇，无技术内容",
      "project": "townscaper"
    },
    {
      "id": "1209519206233968641",
      "date": "2019-12-24",
      "text": "A very merry Christmas to you all",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1205422438437273601",
      "date": "2019-12-13",
      "text": "For doors and windows, I use som stencil buffer shenanigans to punch holes in the zbuffer. I admit it was a bit fiddly to figure out.",
      "topic": "build",
      "status": "ref",
      "where": "",
      "note": "用模板缓冲在 z-buffer 上给门窗挖洞；我们的门窗是贴在墙外的几何，不需要挖洞",
      "project": "townscaper"
    },
    {
      "id": "1205420678859632640",
      "date": "2019-12-13",
      "text": "For the plants, I dug up this ol' trick: alpha is view angle modulated by leaf texture mapped to a sphere.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/leaf-atlas.js · src/life/leaf-surface.js · vegetation.js",
      "note": "443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；原作手绘轮廓和匹配的阴影caster/impostor仍待补。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1205416648397721601",
      "date": "2019-12-13",
      "text": "New prop placement system! It tries to place as many props as it can without overlap. I use it for doors and windows too, which means they are no longer skewed when placed on skewed tiles, which means skewed tiles now look less awkward.",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js（tryPlace）",
      "note": "门窗按道具放置：尽量多放、互不重叠，开口不随格子歪斜",
      "project": "townscaper"
    },
    {
      "id": "1201179450668441600",
      "date": "2019-12-01",
      "text": "Icons!",
      "topic": "tools",
      "status": "partial",
      "where": "src/ui/icon-toolbar.js · ui.html",
      "note": "306帧全核验。上部四工具反复选中、白三角指示移动；原生工具条/aria单选、循环方向键跳过禁用项、跨页保持及dispose通过。下三项因本地未接命令禁用，不推断原作永久禁用；游戏语义/图稿仍缺。",
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
      "note": "200帧全核验，墙色由鲜艳到灰米，屋顶仍橙红；画面不足以证明原注释1.5秒/最短色相公式。新增可选本地HSL短弧过渡及无彩色端点处理，真实墙色滑杆双网格通过；PNG/完整原接口与持久化仍待补。",
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
      "note": "321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。保留本地v5，修复解码先清岛导致坏输入破坏、游程越界/尾随垃圾、空列色槽/河道丢失及北境场景身份；实际分享重载/拒绝保岛通过。自定义palette和玩法/天气状态仍未存档。",
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
      "note": "456帧全核验：原帖重点为显示器饱和度纠偏、建筑效果、花园草地和彩色反弹光。可见多色墙与暖橙屋顶；不将“屋顶永远”或彩色反弹数学当视频证明。本批回归墙色私有编辑不改固定BUILD/位置，保留已有烘焙和草地；完整原作视觉与参数未复现。",
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
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1191990107785572352",
      "date": "2019-11-06",
      "text": "Ah, the timeless problem of shrubbery that look good from all angles without too much overdraw. Adding an anchored center vert to the billboards makes them a bit less flat and gives them directionality without messing with the rotation",
      "topic": "life",
      "status": "partial",
      "where": "src/life/vegetation.js · src/core/anchored-billboard.js · billboard-anchor.html",
      "note": "316帧全核验。新增可选实例轴固定中心的草卡片对照，沿用默认旧模式；四视角实际GPU顶点坐标读回：旧中心漂移约0.106/0.108，固定中心漂移0，World不变。原片墙根灌木材质/形状、远景atlas与生命周期仍待接，不冒充草卡片已等价原灌木。",
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
      "where": "src/world/view.js（computeVoxelShadows / aVox）",
      "note": "逐顶点体素阴影：顶点朝太阳在体素里走，被挡就压暗直射光；面板「体素阴影」（和作者结论一样：不好不坏）",
      "project": "townscaper"
    },
    {
      "id": "1189908238566903808",
      "date": "2019-10-31",
      "text": "However, if you are more careful in providing structural support you'll get curvy brick arches instead and you can build these neat airy cathedral structures",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js",
      "note": "两侧（对边）都有支撑时变成拱：半圆拱腹 + 拱肩墙，墙色",
      "project": "townscaper"
    },
    {
      "id": "1189902695303458816",
      "date": "2019-10-31",
      "text": "It was real fun making the steel beam support structures. They have this neat artificial yet organic feel to them. Its a place where the WFC algorithm really shines and that would be hard or at least laborious to create with other systems.",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js",
      "note": "悬空方块下长深色钢架：角柱 + 横梁 + 斜撑，立在水里的腿有泡沫圈",
      "project": "townscaper"
    },
    {
      "id": "1189109278361165825",
      "date": "2019-10-29",
      "text": "I'm happy to announce that at a count of 378 I've now built enough modules to cover all possible cases in whatever funky townscape you might want to build with this.",
      "topic": "build",
      "status": "ref",
      "where": "src/build/buildings.js",
      "note": "378 个模块覆盖所有情况——确认了\"按角点组合查模块\"的思路，本实现用规则生成几何代替手工模块",
      "project": "townscaper"
    },
    {
      "id": "1181464374839521280",
      "date": "2019-10-08",
      "text": "I made some stairs, plus an additional smaller WFC for surface decorations like windows and doors (who's awkward placement otherwise explodes the permutation count) I'll give my first talk on this at Indicade in Paris on the 19th. Hope to see you there! https:// indiecade-europe.eu/en/programme/c onferences …",
      "topic": "build",
      "status": "done",
      "where": "src/build/buildings.js · src/world/navlayer.js",
      "note": "楼梯放在导航图用到的崖脚；门窗另起一层小 WFC：每栋每层一种窗型、一扇门",
      "project": "townscaper"
    },
    {
      "id": "1178731576982724611",
      "date": "2019-09-30",
      "text": "I made some grassy plots. I'm real happy with the shapes they make. Eventually, they'll grow some trees and the like.",
      "topic": "life",
      "status": "partial",
      "where": "src/build/buildings.js（现有仅地面庭院，高层草地分区待补）",
      "note": "333帧全核验，纠正旧“草地块会长树”：本片无树，README明确是将来计划。高层台地草坪/石边带随建筑重排，当前只有地面层庭院与岩石地形植被，完整高层grass plots未实现，不记运行验收完成。",
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
      "where": "src/build/buildings.js",
      "note": "窗户的风格与密度（每层 1–2 扇白框小窗）、不同颜色的房子相接",
      "project": "townscaper"
    },
    {
      "id": "1174406613031170049",
      "date": "2019-09-18",
      "text": "Today my good friend @podzimcore became the first outsider to take the new project for a spin. Behold the glorious monstrosity he constructed",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1168571866405097472",
      "date": "2019-09-02",
      "text": "A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture is then blurred, and sampled in the vertex shader of whatever needs lighting.",
      "topic": "light",
      "status": "done",
      "where": "src/light/bake.js",
      "note": "分层遮蔽：每层一张占用栅格 → 盒式模糊两遍 → 每个顶点沿法线外移采样",
      "project": "townscaper"
    },
    {
      "id": "1168168400155267072",
      "date": "2019-09-01",
      "text": "Got some very basic lighting in there. Since this ain't proper voxels I had to do a new take on my usual voxel based AO approach",
      "topic": "light",
      "status": "done",
      "where": "src/light/bake.js",
      "note": "很基础的光照 + 非真体素的 AO 新做法（画面：灰色城墙模型），即分层 AO 烘焙",
      "project": "townscaper"
    },
    {
      "id": "1164926304640229376",
      "date": "2019-08-23",
      "text": "WFC running at interactive speed on that funky grid. Next up is to make it deterministic",
      "topic": "grid",
      "status": "done",
      "where": "src/core/wfc.js · wfc.html",
      "note": "逐帧查看395帧。任意多边形半边socket WFC，稳定顺序、迭代回溯、固定约束及预算；实验验证正反输入一致。尚非完整建筑多格tile。",
      "project": "townscaper",
      "decodedFrames": 395,
      "reviewEvidence": "artifacts/coverage/wfc-review.md"
    },
    {
      "id": "1163836000688365571",
      "date": "2019-08-20",
      "text": "Basic marching cubes on my funky grid. Next up is turning this into mixed initiative WFC.",
      "topic": "grid",
      "status": "ref",
      "where": "src/build/buildings.js",
      "note": "在不规则网格上做 Marching Cubes（红色块）。重构版的建筑是按邻居装配的体素列，思路同源",
      "project": "townscaper"
    },
    {
      "id": "1151770831619534848",
      "date": "2019-07-18",
      "text": "I figured out how to make do with relaxation clusters of 3 instead of 7, which means I have to generate fewer unrelaxed patches before I can start relaxing, which makes it faster. Note also that the black and the white grid are *dual* to each other. This is an important concept",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js · grids.html",
      "note": "3 块一簇松弛；黑白两张网格互为对偶",
      "project": "townscaper"
    },
    {
      "id": "1151152046055272449",
      "date": "2019-07-16",
      "text": "Having a look around",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "townscaper"
    },
    {
      "id": "1151137783785771008",
      "date": "2019-07-16",
      "text": "As promised: an aperiodic infinite deterministic irregular relaxed quadrilateral grid.",
      "topic": "grid",
      "status": "done",
      "where": "src/core/infinite.js · grids.html",
      "note": "无限、确定、无缝的松弛四边形网格：一块块六边形冒出来",
      "project": "townscaper"
    },
    {
      "id": "1147881669350891521",
      "date": "2019-07-07",
      "text": "I present: Fairly even irregular quads grid in a hex Todo: 1. Heuristic to reduce (or eliminate) 6 quad verts 2. Tile these babies to infinity",
      "topic": "grid",
      "status": "done",
      "where": "src/core/grid.js（buildQuadGrid）",
      "note": "1068帧全核验，四轮点/三角网/多边形/细分/平滑过程；已有buildQuadGrid主体保留，本批不重实现，6度启发和完整动画未新增验收。",
      "project": "townscaper",
      "decodedFrames": 1068,
      "reviewEvidence": "artifacts/coverage/topoline-quad-review.md",
      "reviewStages": {
        "textRead": true,
        "allFramesReviewed": true,
        "frameRange": [
          0,
          1067
        ],
        "nativeRevisits": [
          100,
          150,
          195,
          240,
          1010
        ],
        "implementationVerified": false,
        "runtimeAccepted": false,
        "acceptanceScope": "全帧学习与已迁移主体复核，本批未重新验收完整原生成动画"
      }
    },
    {
      "id": "1120036868966502401",
      "date": "2019-04-21",
      "text": "It's marching squares on irregular quadrilateral grids",
      "topic": "grid",
      "status": "done",
      "where": "src/core/contour.js · src/world/contour-overlay.js · contour.html",
      "note": "全703帧复核，区分画面观察与算法推断。补共享边交点缓存、双线性鞍点、三角格、闭环/开放端点审核；真实World语义海岸诊断开关与版本重建。不是形变泡沫岸线或完整建筑库。",
      "project": "townscaper",
      "decodedFrames": 703,
      "reviewEvidence": "artifacts/coverage/contour-review.md"
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
      "note": "已学14帧续项：外围padding、避让节点的边中点通路、自适应Bezier采样通过96条逻辑/24项页面；两侧细分未实现。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1092709665199345664",
      "date": "2019-02-05",
      "text": "k-pow !!",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
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
      "note": "坡面（邻居高度不同的顶面）草丛密度是平地的 2 倍多",
      "project": "badnorth"
    },
    {
      "id": "1062374549407350790",
      "date": "2018-11-13",
      "text": "To make Bad North even prettier, I'm adding some extra smoothing to the island using my voxel normals. It helps break up the grid and make it all look a wee bit more natural. (also, go wishlist @BadNorthGame on Steam: https:// store.steampowered.com/app/688420/Bad _North/ … )",
      "topic": "grid",
      "status": "done",
      "where": "src/core/meshwriter.js",
      "note": "Bad North 用体素法线做额外平滑：这里软三角形在同一位置按夹角(<55°)平均法线 → 弯崖壁圆润、崖顶边仍硬",
      "project": "badnorth"
    },
    {
      "id": "1061229717582475264",
      "date": "2018-11-10",
      "text": "But you can break up that repetition by using a few different ones with different settings (all still using the same texture)",
      "topic": "texture",
      "status": "done",
      "where": "textures.html（UI 装饰）",
      "note": "同一张装饰贴图的几种不同设置打破重复",
      "project": "badnorth"
    },
    {
      "id": "1061227418961219585",
      "date": "2018-11-10",
      "text": "Obviously, if you stretch it too far, you will start to notice the repetition",
      "topic": "tools",
      "status": "done",
      "where": "textures.html（UI 装饰 → 只镜像）",
      "note": "拉太长会看出重复：「只镜像」模式下能看到，后两个模式用 8 向与多种设置打破",
      "project": "badnorth"
    },
    {
      "id": "1061221291137605633",
      "date": "2018-11-10",
      "text": "I'm writing a simple graphic for UI decoration. A single texture can be oriented 8 different ways and mirrors around the center to work in any size. (also, Bad North drops on Steam Nov 16 https:// store.steampowered.com/app/688420/Bad _North/ … )",
      "topic": "texture",
      "status": "partial",
      "where": "src/core/mirror-uv.js · src/ui/ornament.js",
      "note": "379帧全核验：方/横/窄高矩形拖动、Orientation变化。复用已有单距离场，补D4八方向和可选固定像素尺度中心重复折叠，GPU八方向各异/镜像无误差，改尺寸不重烘，旧实验回归通过。固定尺度重复是本地方案，非已证实原布局；纹样/CPU绘图API仍不同。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "1056999668486471682",
      "date": "2018-10-29",
      "text": "Works well in daylight too, largely thanks to the max blend",
      "topic": "fx",
      "status": "done",
      "where": "src/life/effects.js（MaxEquation）",
      "note": "白天也好看的火：靠 Max 混合，粒子融成一个火焰轮廓不过曝（北境里小屋失守时着火）",
      "project": "badnorth"
    },
    {
      "id": "1056992291108413446",
      "date": "2018-10-29",
      "text": "Oh no! I made an error! The quads above shrink way more than they are supposed to. This looks much better and breaks up the flame in a much more interesting way:",
      "topic": "grid",
      "status": "done",
      "where": "src/life/effects.js · fire.html",
      "note": "152全帧复核；保留二次快速收缩，补实际寿命归一年龄、出生尺寸和到期丢弃；半寿命尺寸为出生1/4，线性对照1/2。不是精确还原作者误差参数。",
      "project": "badnorth",
      "decodedFrames": 152,
      "reviewEvidence": "artifacts/coverage/fire-review.md"
    },
    {
      "id": "1056990611738451968",
      "date": "2018-10-29",
      "text": "New fire effect. For blend mode, I use Max instead of Add to have better control over my colors and to make the particles blend together and form a common silhouette.",
      "topic": "texture",
      "status": "done",
      "where": "src/life/effects.js · fire.html",
      "note": "379全帧复核；保留已有Max混合，新增Add对照与GPU读回，重叠同色粒子Max不增亮。软圆Points近似，未复制原quad/noise轮廓和火光。",
      "project": "badnorth",
      "decodedFrames": 379,
      "reviewEvidence": "artifacts/coverage/fire-review.md"
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
      "status": "partial",
      "where": "src/core/ui-reveal.js · ornament.html",
      "note": "100帧全核验。中央徽章/标题先显、外纹后展，中央先退/外侧尾迹最后消失。保留共享SDF，新增可拖动标题/外纹本地两轨时序，透明文字inert；非原徽章/逐部件原时序或图稿。",
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
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "1022573208590057472",
      "date": "2018-07-26",
      "text": "The look and feel of the basic meat and potato melee combat is one of the things I'm most proud of in Bad North",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（#hit）",
      "note": "近战手感：挨打后退一步、喷血滴（抛物线落地）、受伤越重身上越红",
      "project": "badnorth"
    },
    {
      "id": "1017355723171344385",
      "date": "2018-07-12",
      "text": "Making some thicker outlines for all you 4k high ballers out there",
      "topic": "light",
      "status": "done",
      "where": "src/world/outline.js（thickness）",
      "note": "更粗的描边：线宽按像素比 × 分辨率（以 1080 高为基准）放大；面板「粗描边」再翻倍",
      "project": "badnorth"
    },
    {
      "id": "1016680972610359298",
      "date": "2018-07-10",
      "text": "This is what the confirm popup looks like:",
      "topic": "tools",
      "status": "partial",
      "where": "ui.html（本地UI实验，未接游戏指令）",
      "note": "370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。",
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
      "note": "281全帧：裸方片从底部细节到顶端模糊。保留age×4偏移，补实际纹理/mip对照开关与裸方片；GPU同尺寸卡片顶端方差下降约49%。这是加到隐式LOD上的bias，不是精确mip编号。",
      "project": "badnorth",
      "decodedFrames": 281,
      "reviewEvidence": "artifacts/coverage/smoke-sampling-review.md"
    },
    {
      "id": "1015149712469524480",
      "date": "2018-07-06",
      "text": "I only sample my noise texture once per quad, but I scroll the UVs randomly forward or backward along the flow of the smoke. This further breaks up the recognizability of individual blobs and it creates some of that cool multi layered flow feeling thick smoke should have",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · smoke.html",
      "note": "451全帧：棋盘烟流绕镜头变化。保留已有随机正反UV，补按相机投影速度对齐流向；实际mip棋盘纹理取代无过滤解析格，关闭滚动像素不变、正反方向GPU读回通过。每片元每遍一次采样指令，不声称整片一次GPU取样。",
      "project": "badnorth",
      "decodedFrames": 451,
      "reviewEvidence": "artifacts/coverage/smoke-sampling-review.md"
    },
    {
      "id": "1015142746372366336",
      "date": "2018-07-06",
      "text": "I solve the problems of z-depth and draw order by drawing the effect in 2 passes. The first pass is black, and and has a full alpha ner the base. The second pass is lighter, more transparent towards the base, and has its cutoff pulled in 1 pixel (creating the crisp outline)",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · src/core/smoke-order.js · smoke.html",
      "note": "全帧复核；保留已有两遍/渐隐，补相机深度排序、两遍属性配对、一次阈值内收和有界更新。两批方片透明仍是近似；其他四段烟火继续审核。",
      "project": "badnorth",
      "decodedFrames": 303,
      "reviewEvidence": "artifacts/coverage/smoke-two-pass-review.md"
    },
    {
      "id": "1015140880666300416",
      "date": "2018-07-06",
      "text": "Smoke effect. A full billowy base tied together by a crisp outline seamlessly transitioned to a blurry fade. The effect is probably a bit much for my current purposes, but I think it solves some interesting problems so I wanted to share it",
      "topic": "fx",
      "status": "done",
      "where": "src/life/smoke.js · src/core/smoke-order.js · smoke.html",
      "note": "全帧复核；保留已有两遍/渐隐，补相机深度排序、两遍属性配对、一次阈值内收和有界更新。两批方片透明仍是近似；其他四段烟火继续审核。",
      "project": "badnorth",
      "decodedFrames": 631,
      "reviewEvidence": "artifacts/coverage/smoke-two-pass-review.md"
    },
    {
      "id": "1010979395719319552",
      "date": "2018-06-24",
      "text": "A selection of the many handsome faces you might come across in @BadNorthGame",
      "topic": "fx",
      "status": "partial",
      "where": "src/core/part-random.js · ui.html",
      "note": "100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。保留本地卡片绘制并验证稳定种子身份；原作素材/全装备层级和游戏角色接入未完成，不以不同画板哈希充当原多样性指标。",
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
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "1007587825024425984",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "1007587821220229120",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "1007587817021636609",
      "date": "2018-06-15",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "1007587812462530561",
      "date": "2018-06-15",
      "text": "Proper games have waterfalls. I'm glad to report that @BadNorthGame is now a proper game.",
      "topic": "water",
      "status": "done",
      "where": "src/water/waterfall.js",
      "note": "瀑布：河从崖边落下的白色水帘 + 底部白沫（面板「瀑布」）",
      "project": "badnorth"
    },
    {
      "id": "999191760944418817",
      "date": "2018-05-23",
      "text": "Adding the option of disabling gore made me realized just how much I rely on blood for environmental storytelling. I should probably start asking some questions about what kind of person I am and what kind of art I put into this world.",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（gore）",
      "note": "关掉血腥：面板「血腥」取消勾选后不画血、不留尸体（画面就是同一场战斗的有血 / 无血对比）",
      "project": "badnorth"
    },
    {
      "id": "999185422403055616",
      "date": "2018-05-23",
      "text": "For my blood splatter UVs, I'm interpolating between sprite-space and skin-space using the fwidth of skin UV. This gives me a sprite-space map on the tummy (where the skin UVs are static) while the splatter on the face follows the actual motion of the head.",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（aSoak · onBeforeCompile）",
      "note": "血迹跟着身体：血斑按物体空间坐标的噪声画，所以随身体动；血量越少斑越多。原作是精灵空间和皮肤空间按 fwidth 插值（我们是 3D 小人，直接用物体空间）",
      "project": "badnorth"
    },
    {
      "id": "995043346778415104",
      "date": "2018-05-11",
      "text": "The pathfinding in some levels does get a bit convoluted",
      "topic": "fx",
      "status": "ref",
      "where": "src/world/navgraph.js",
      "note": "有些关卡寻路很绕（画面：小队在多层台地、洞口之间绕路）。重构版寻路走导航图，没有洞穴里的路",
      "project": "badnorth"
    },
    {
      "id": "995034777756536833",
      "date": "2018-05-11",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "987267068495003648",
      "date": "2018-04-20",
      "text": "Using inspector expressions, I can live tweak the cost function of my projectile trajectory lookup tables. Very handy.",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（LUT / lookupShot）",
      "note": "弹道查找表 + 代价函数：按 (距离, 高差) 预先找代价最小的出射角（飞行时间 + 落角偏离 45°），箭按真抛物线飞",
      "project": "badnorth"
    },
    {
      "id": "984813819280191488",
      "date": "2018-04-13",
      "text": "Blood soaking as a health indicator for the big fellas and a proper stun state for the little ones",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（soak）",
      "note": "934帧已复核；大小兵/浸血及中断保留，补精灵脚底摆动与逐单位UV血斑，GPU共享材质无串色，双网格暂停/gore往返通过。完整动作/美术与体型拥挤待续。",
      "project": "badnorth",
      "decodedFrames": 934,
      "reviewEvidence": "artifacts/coverage/sprite-hit-review.md"
    },
    {
      "id": "984703192465330176",
      "date": "2018-04-13",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
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
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "978194866520944641",
      "date": "2018-03-26",
      "text": "Some of it looks very similar",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "974579499802202113",
      "date": "2018-03-16",
      "text": "For a given position, Barycentric Coordinates can be calculated with 1 subtraction and 1 dot product (if you've precalculated some nice vectors in the triangle)",
      "topic": "grid",
      "status": "done",
      "where": "src/core/spatial.js（baryPrep）",
      "note": "重心坐标：预先算两个对偶向量，之后每个坐标 1 次减法 + 1 次点积",
      "project": "badnorth"
    },
    {
      "id": "974564862729838592",
      "date": "2018-03-16",
      "text": "I'm making some pedagogical gizmos for my GDC microtalk, like this illustration of Barycentric Coordinates. Gizmos > powerpoints.",
      "topic": "grid",
      "status": "done",
      "where": "grids.html（重心坐标）",
      "note": "讲课用的重心坐标小工具：三角形 + 拖动的点 + 三个权重",
      "project": "badnorth"
    },
    {
      "id": "974325184525201409",
      "date": "2018-03-15",
      "text": "We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefully) by making our own box-box test in two incredibly stressful hours. Behold, our beautiful viking raid planner:",
      "topic": "fx",
      "status": "done",
      "where": "src/core/obb.js",
      "note": "自己写的盒-盒测试：分离轴 15 根，平行轴（叉积≈0）跳过；3000 对随机盒与撒点对照，漏判 0，2 次是棱对棱交叉撒点撒不到",
      "project": "badnorth"
    },
    {
      "id": "972829402873716737",
      "date": "2018-03-11",
      "text": "If you're heading to GDC, come see my microtalk about the triangular flow fields we use for pathfinding and combat http:// schedule.gdconf.com/session/tech-t oolbox/854263 …",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js",
      "note": "寻路和战斗用的流场：所有守军同时作源的 Dijkstra，每 0.25 秒一次，查询 O(1)",
      "project": "badnorth"
    },
    {
      "id": "969860566322958336",
      "date": "2018-03-03",
      "text": "My unit sprites have 1 direction, so they need to be directionally ambiguous. They are mostly symmetrical and avoid features that feel jarring when they flip. Would these sword tips be axe heads, you would notice at a glance that they are pointing in two distinct directions",
      "topic": "fx",
      "status": "done",
      "where": "src/core/sprite-ambiguity.js · src/life/unit-sprites.js · src/badnorth/battle.js · sprites.html",
      "note": "全308帧复核。补锚点/真实alpha翻转诊断、屏幕朝向死区与真实北境可选单方向精灵。保留原3D血斑/尸体；不是原作美术或完整动画系统。；续补受击摆动/逐单位UV血斑，证据sprite-hit-review.md，原作美术和精灵阴影待续。",
      "project": "badnorth",
      "decodedFrames": 308,
      "reviewEvidence": "artifacts/coverage/sprites-review.md"
    },
    {
      "id": "959752525867036672",
      "date": "2018-02-03",
      "text": "A great unexpected joy in this project has been writing my own navmesh. It's an oddly relaxing job full of small and approachable math-puzzles. Here you see some pulsating vertex cells; a dual to the triangular grid and a suitable place to start with foliage placement.",
      "topic": "grid",
      "status": "partial",
      "where": "src/core/vertex-dual.js → src/world/vertex-dual-overlay.js；gridpatch.html",
      "note": "31帧复核：顶点格在实际台地上收缩/扩大。新增三角网重心对偶及边界闭合，共享World扇形三角输入和分层脉动观察/候选点。640格面积测试通过；不是原作中心规则证明，尚未统一植被/导航。双网格真实World/WorldMesh编辑刷新、脉动不写体素及清理通过；见本批运行证据，能力仍列部分。",
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
        "runtimeAccepted": true
      }
    },
    {
      "id": "959530111187013632",
      "date": "2018-02-02",
      "text": "I've been tweaking the foliage system today. It now supports multiple grass types per level.",
      "topic": "life",
      "status": "done",
      "where": "src/life/vegetation.js",
      "note": "每关多种草；画面里的小花是一大片一大片的白色碎点（已按此重做小花）",
      "project": "badnorth"
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
      "note": "88帧全核验；保留层级部件，修复显式mirror分支随机重放/单次消费，显式种子与固定槽ID保证重画、切页和手机换列身份；完整spec/数据接口/剪影IoU仍缺。",
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
      "status": "done",
      "where": "src/badnorth/battle.js",
      "note": "保留北境战斗成果；440帧复核，血斑和尸体命中时捕获局部锚点，随船完整姿态运动；真实Battle双网格箭附着、gore往返及离场清理验收通过。原作美术/物理滑动未复现。",
      "project": "badnorth",
      "decodedFrames": 440,
      "reviewEvidence": "artifacts/coverage/boat-corpse-review.md"
    },
    {
      "id": "943230624369868800",
      "date": "2017-12-19",
      "text": "And yeah, obviously the snow flakes are affected by the wind system and thus flow around the island",
      "topic": "terrain",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/world-probes.js",
      "note": "318帧全核验；修复屋顶下空洞误用柱顶碰撞，雪片改读共享World实际solid层，重生避实心、dt校验；双网格即时封洞/重开通过。现有表面混白保留，不是物理堆积；Points方点/统一大小与亮度，软片、接触AO/完整冬景仍未复现。",
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
      "note": "306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。已有雪/战斗主体保留；完整冬景美术/植被覆盖及船群战斗组合未实现验收。",
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
      "note": "节点图编程（画面：一长条彩色节点图编辑器）。没有可搬的技术",
      "project": "badnorth"
    },
    {
      "id": "931196707236392960",
      "date": "2017-11-16",
      "text": "My generated levels all keep a virtual voxel space. It is used for light baking, soft normals, various 3D textures, simplified collision, wind simulation etc.",
      "topic": "light",
      "status": "done",
      "where": "src/core/world.js · src/core/world-probes.js · src/life/atmosphere.js · flow.html",
      "note": "全223帧复核，画面为圆润/体素显示切换。补共享World占用/下方支撑/梯度诊断；修复真实风场按柱顶填满洞内。几何软法线成果保留，体素梯度写回并约束硬边仍待迁移。",
      "project": "badnorth",
      "decodedFrames": 223,
      "reviewEvidence": "artifacts/coverage/world-probes-review.md"
    },
    {
      "id": "929417420921556993",
      "date": "2017-11-11",
      "text": "Fun fact: I generate smooth normals for all my meshes and use a blend between smooth and hard normals in the final lighting",
      "topic": "light",
      "status": "done",
      "where": "src/world/view.js（uNormMix）",
      "note": "平滑 / 硬法线在最终光照里混合：硬法线由屏幕空间导数算，和平滑法线按 0.8 混（面板「软硬法线混合」）",
      "project": "badnorth"
    },
    {
      "id": "926903893866541057",
      "date": "2017-11-04",
      "text": "Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders",
      "topic": "fx",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/world-probes.js",
      "note": "516帧全核验；保留按层避障/三线性风场与共享uWind，双网格通洞/封洞及改风向运行复核。原片矢量受空间障碍影响，不能据画面恢复精确解算器；完整makeWindField/trace/sampleCurve接口和局部场GPU采样未迁移。",
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
      "where": "src/badnorth/island.js",
      "note": "生成可走关卡的启发式：生成后用导航图检查每块台地能否从沙滩走上去，走不到的削低一档（画面：黄色可走连线）",
      "project": "badnorth"
    },
    {
      "id": "913407568730615808",
      "date": "2017-09-28",
      "text": "Ok, I'm proud of this one. Can any of you brainy nerds figure out what we're looking at here?",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "912691357440978945",
      "date": "2017-09-26",
      "text": "Long time no combat gifs",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（#hit）",
      "note": "战斗动图：台地边上混战、血、落水的人；挨打后退 + 血滴飞溅落地成血点",
      "project": "badnorth"
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
      "note": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。",
      "project": "badnorth",
      "learned": "本轮逐帧复核246帧：新增 world/layerednav.js，直接从共享 World 枚举洞底/洞顶多层节点，净空与台阶验证，navigation.html 可对照柱顶假设。北境战斗完整多层接入仍待补齐。",
      "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
      "decodedFrames": 246,
      "clearanceEvidence": "artifacts/coverage/unit-clearance-review.md"
    },
    {
      "id": "906416813810049025",
      "date": "2017-09-09",
      "text": "New cave tileset. These levels really challenge your spacial skills #screenshotsaturday #madewithunity @BadNorthGame",
      "topic": "fx",
      "status": "partial",
      "where": "src/terrain/features.js",
      "note": "新的洞窟图块：岩体里有拱洞、单位从洞里穿过；重构版只有造型，导航不走洞",
      "project": "badnorth"
    },
    {
      "id": "906207980802252801",
      "date": "2017-09-08",
      "text": "I've been working on some new fog (sped up in the gif). For background effects, subtlety is key.",
      "topic": "fx",
      "status": "partial",
      "where": "src/life/atmosphere.js · src/core/fog-envelope.js",
      "note": "326帧全核验。修复本地有限雾盘外缘硬截断，新增浓度/相对漂移速度控制，默认淡雾0.35；实际GPU边界alpha为0、浓度0关闭、速度0冻结通过。仍是圆盘近似，未迁移原FogLayer软片/风场平流与体积/遮挡，未从加速片推断真实速度。",
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
      "status": "done",
      "where": "src/badnorth/battle.js（pike）",
      "note": "654帧已复核；固定轴连续检测/每刺命中集及矛身时间窗同步通过，双网格实例矛尖与碰撞范围误差<1e-6。完整持矛动作、旋转武器、接触时刻3D遮挡和格挡推力待续。",
      "project": "badnorth",
      "decodedFrames": 654,
      "reviewEvidence": "artifacts/coverage/spear-pose-review.md"
    },
    {
      "id": "902103473365417984",
      "date": "2017-08-28",
      "text": "Ok, one more visualization. Distances this time. I really should get back to proper work now",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "902069261304287232",
      "date": "2017-08-28",
      "text": "Just for fun: visualization of data inheritance in my flow/distance/influence fields",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js · battle.js（#drawFlow）",
      "note": "数据继承可视化：每格到父格一段线，颜色 = 从哪支守军继承来的（面板「流场」）",
      "project": "badnorth"
    },
    {
      "id": "901842167508992000",
      "date": "2017-08-27",
      "text": "Made my flow/influence fields even smarter: In addition to distance and direction to nearest unit, it can now tell you what type they are",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/flowfield.js",
      "note": "流场 / 影响场：除了到最近单位的距离和方向，还带着\"那是什么兵种\"；维京人看到矛兵正面会绕开去打小屋",
      "project": "badnorth"
    },
    {
      "id": "901469409579061248",
      "date": "2017-08-26",
      "text": "Working on nicer ship wakes",
      "topic": "water",
      "status": "partial",
      "where": "src/life/boats.js · src/core/wake-sampling.js",
      "note": "138帧全核验。保留绕岛V形带状船迹，补连续时间采样/相位余量/帧内插值，30/60/120Hz实际采样数和年龄一致；重建释放船体几何。原片断续泡沫、舷侧喷溅、靠岸船行为与独立Wake接口仍待补，未恢复KELVIN角度。",
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
      "note": "601帧已复核，保留左行与常驻点线；补体型半径/dt分离及车道余量，64人三帧率与实际Battle暂停冻结通过。弯道、多岔和复杂拥挤/体型重路由待续。",
      "project": "badnorth",
      "learned": "本轮逐帧复核601帧：原横向偏移为0，现新增窄道识别与确定左侧目标，并限制偏移在多边形内部；战斗已接入，测试相反方向车道。点线标示与拥挤压力测试仍待补齐。",
      "reviewEvidence": "artifacts/coverage/body-separation-review.md",
      "decodedFrames": 601
    },
    {
      "id": "877995885250138119",
      "date": "2017-06-22",
      "text": "（帖子无文字说明）",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "870558914345041921",
      "date": "2017-06-02",
      "text": "I think we've all had days like this",
      "topic": "show",
      "status": "na",
      "where": "",
      "note": "",
      "project": "badnorth"
    },
    {
      "id": "870296307889573889",
      "date": "2017-06-01",
      "text": "Units can now get knocked off ledges",
      "topic": "fx",
      "status": "done",
      "where": "src/badnorth/battle.js（#hit / #fallStep）",
      "note": "单位会被打下悬崖：挨打时身后低 ≥2 层就可能被击飞，抛物线落下，落差大的摔死",
      "project": "badnorth"
    },
    {
      "id": "797119718477991936",
      "date": "2016-11-11",
      "text": "Got some basic navigation going",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/world/layerednav.js · src/world/battle-navigation.js · src/badnorth/battle.js",
      "note": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。 本批真实Battle已接入层选择、单位高度、路径、近战与箭矢占用遮挡，两种网格验证穿洞和封洞；精细门户/侧壁碰撞及分层流场仍待补齐。 分层流场现已与实际路由统一，剩余精细门户和碰撞。 水平半径与连续移动扫掠已补，形变侧壁及脚高插值继续处理。",
      "learned": "本轮逐帧复核265帧：模块生成后内部多层活动点。新增共享 World 多层导航与门户边；混合格和四边形测试通过。预制模块精细内部 portal 与战斗接入仍待补齐。",
      "reviewEvidence": "artifacts/coverage/battle-navigation-review.md",
      "decodedFrames": 265,
      "clearanceEvidence": "artifacts/coverage/unit-clearance-review.md"
    },
    {
      "id": "886199305522085890",
      "date": "2017-07-15",
      "text": "Dotted lines to mark narrow passages. Helps you understand what path the enemies might chose",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/world/traffic.js · src/badnorth/battle.js（passageDots）",
      "note": "逐帧查看624帧：常驻圆点线标出窄脊/楼梯连接，区别于选中命令路径。基于共享导航图判别通道、剔除宽平台角、去重等距撒点；passages开关。",
      "learned": "原文与全帧联系表核对；真实场景常驻标示，切场景隐藏；证据 artifacts/coverage/traffic-review.md。",
      "reviewEvidence": "artifacts/coverage/traffic-review.md",
      "decodedFrames": 624
    },
    {
      "id": "863019585162932224",
      "date": "2017-05-12",
      "text": "TIL how to do nested/recursive coroutines. Makes writing multi-frame algorithms simpler and much more elegant. #madewithunity",
      "project": "badnorth",
      "topic": "tools",
      "status": "done",
      "where": "src/core/coroutine.js · scheduler.html",
      "note": "逐帧查看566帧后补跨帧嵌套协程：显式栈、工作/转换预算、返回值、异常、同步取消清理、统计重置；60000深度测试。",
      "learned": "画面为分阶段生成展示，内部调度机制取自原文方向并由本仓库实现；合作式next不可抢占。",
      "decodedFrames": 566,
      "reviewEvidence": "artifacts/coverage/coroutine-review.md"
    },
    {
      "id": "793806535898136576",
      "date": "2016-11-02",
      "text": "I gave it an extra difficult tileset to work with to make sure it can repair itself when it has screwed up",
      "topic": "grid",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/wfc.js（repairWFC）· wfc.html",
      "note": "全65帧复核：困难管道集合的自修复，画面也有全片重建。重构采用锁定外部、优先原值、逐圈扩区及失败回滚；独立socket实验，未接建筑多格tile。",
      "decodedFrames": 65,
      "reviewEvidence": "artifacts/coverage/wfc-repair-review.md"
    },
    {
      "id": "795010582239997952",
      "date": "2016-11-05",
      "text": "I extract my adjacency data from the mesh (no tedious naming conventions needed) Plus I wrote a little tool to show which ones fit",
      "topic": "grid",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/adjacency.js · adjacency.html · wfc.html",
      "note": "全151帧复核。几何焊接、网格边界候选、三角内部边排除、非流形诊断；任意多边形半边审核接入WFC。平行等长只代表候选，完整建筑面轮廓及多格tile另列后续。",
      "decodedFrames": 151,
      "reviewEvidence": "artifacts/coverage/adjacency-review.md"
    },
    {
      "id": "810878197134950401",
      "date": "2016-12-19",
      "text": "I found a cheap way to approximate line of sight on a nav mesh. What it lacks in accuracy it makes up for in speed",
      "topic": "fx",
      "project": "badnorth",
      "status": "done",
      "where": "src/core/nav-visibility.js · src/world/visibility.js · visibility.html",
      "note": "全174帧复核。补导航门户逐边角度采样、洞内/屋顶分离、源点总高度限制与真实World诊断开关。不声称作者内部算法或精确光学视线，未接管战斗AI。",
      "decodedFrames": 174,
      "reviewEvidence": "artifacts/coverage/visibility-review.md"
    },
    {
      "id": "820977247083528192",
      "date": "2017-01-16",
      "text": "Any tips on resources and references for 2D animation? Maybe a site with gifs of good walks, deaths, attacks etc?",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/core/unit-shadow.js · unit-shadows.html",
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
      "date": "2017-01-17",
      "text": "（帖子无文字说明）",
      "topic": "fx",
      "project": "badnorth",
      "status": "partial",
      "where": "src/badnorth/battle.js",
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
};
