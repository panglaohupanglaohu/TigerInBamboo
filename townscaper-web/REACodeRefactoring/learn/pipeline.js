/**
 * pipeline.js — how the 237 clips fit together, as pipelines.
 *
 * Reading of the timeline (all from the clips' own text):
 *   Bad North (2017–2019)   square voxel islands; terrain, houses, units, wind
 *                           and snow all share one "virtual voxel space"
 *                           (931196707236392960).
 *   Townscaper (2019–2021)  irregular quad grid, buildings only; its water is
 *                           "almost the same as in Bad North" (1215644531221311488).
 *   Next project (2021–25)  "combine an irregular grid (like in Townscaper) with
 *                           multi-cell tiles (like in Bad North)" (1579483114178768898),
 *                           houses spliced into terrain (1584623053061099520),
 *                           then "put this on a sphere" (1768627849529893109).
 *
 * status: done = in this repo and visible, partial, engine = in engine/ only,
 * todo = studied, not built yet.
 */
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
              "name": "Townscaper 不规则四边形网格",
              "id": "1147881669350891521",
              "status": "done",
              "where": "src/core/grid.js",
              "toggle": "grid"
            },
            {
              "name": "无限网格：块 + 簇各自松弛，顶点 = 块 + 最近两簇的重心插值（无缝、无翻折）",
              "id": "1332410042784641026",
              "status": "done",
              "where": "src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "无限、确定、无缝的松弛四边形网格；3 块一簇",
              "id": "1151770831619534848",
              "status": "done",
              "where": "src/core/infinite.js",
              "page": "grids.html?t=infinite"
            },
            {
              "name": "纯三角 / 纯方格 / 混合对比 + 对偶图（顶点格）",
              "id": "1670790425232175108",
              "status": "done",
              "where": "src/core/grid.js",
              "page": "grids.html?t=kinds"
            },
            {
              "name": "拓扑直线 + 完美环",
              "id": "1384958097542819845",
              "status": "done",
              "where": "src/core/grid.js（traceStraight）",
              "page": "grids.html?t=lines"
            },
            {
              "name": "重心坐标：1 次减法 + 1 次点积",
              "id": "974579499802202113",
              "status": "done",
              "where": "src/core/spatial.js（baryPrep）",
              "page": "grids.html?t=bary"
            },
            {
              "name": "通用三角图：增量 Delaunay + 流形检查",
              "id": "1677242779162877952",
              "status": "done",
              "where": "src/core/trigraph.js"
            },
            {
              "name": "三角 + 方格混合网格（新项目）",
              "id": "1447494168448753667",
              "status": "done",
              "where": "src/core/grid.js · buildMixedGrid()（左上角切换网格）"
            },
            {
              "name": "半边结构（格子是任意多边形，edgeTwins）",
              "id": "1458921394855718917",
              "status": "done",
              "where": "src/core/grid.js · finishGrid()"
            },
            {
              "name": "球面三角化：随机点 → 散开 → 球极投影上 Delaunay → 按三角形松弛",
              "id": "1338825080844021760",
              "status": "done",
              "where": "src/sphere/planet.js",
              "page": "planet.html"
            },
            {
              "name": "放到球面：台阶小星球",
              "id": "1768627849529893109",
              "status": "done",
              "where": "src/sphere/planet.js（独立星球演示；共享 World 球面融合待补齐）",
              "page": "planet.html"
            },
            {
              "name": "星球防蘑菇化 relax（高台面积 1.90× → 1.35×）",
              "id": "1769641473895432220",
              "status": "done",
              "where": "src/sphere/planet.js（独立星球演示；共享 World 球面融合待补齐）",
              "page": "planet.html"
            },
            {
              "name": "对比三种：不平滑 / dumb（海岸被啃、崖顶塌）/ 层级（海岸圆滑、崖顶与房子保持锐利）。「地形」场景勾掉「层级平滑」即可对比",
              "id": "1670725072540106755",
              "status": "done",
              "where": "src/terrain/shape.js"
            },
            {
              "name": "\"方，又带六边形味\"的岩岛：三角 + 方格混合网格",
              "id": "1471817524148940807",
              "status": "done",
              "where": "src/core/grid.js（buildMixedGrid）"
            },
            {
              "name": "底图就是一张不规则三角网",
              "id": "1447496205282549761",
              "status": "done",
              "where": "src/core/grid.js（buildMixedGrid）"
            },
            {
              "name": "球面 Delaunay = 在球极投影平面上做；点按半径排序再增量插入（planet.html 右下角）",
              "id": "1338829205157646336",
              "status": "done",
              "where": "src/core/trigraph.js · src/sphere/planet.js"
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
              "name": "讲课用的重心坐标小工具：三角形 + 拖动的点 + 三个权重",
              "id": "974564862729838592",
              "status": "done",
              "where": "grids.html（重心坐标）",
              "page": "grids.html"
            }
          ]
        ],
        [
          "水层",
          [
            {
              "name": "浪裙（Bad North → Townscaper）",
              "id": "1215644531221311488",
              "status": "done",
              "where": "src/water/shore.js",
              "toggle": "waves"
            },
            {
              "name": "距离场浪裙",
              "id": "1664566546683899905",
              "status": "done",
              "where": "src/water/shore.js"
            },
            {
              "name": "岸线黄线 / 外推蓝线",
              "id": "1849732997945110651",
              "status": "done",
              "where": "src/water/shore.js",
              "toggle": "shorelines"
            },
            {
              "name": "循环顶点着色器岸浪（新项目）",
              "id": "1991101097818403263",
              "status": "done",
              "where": "src/water/shore.js",
              "toggle": "wavewire"
            },
            {
              "name": "中间色倒影",
              "id": "1215644531221311488",
              "status": "done",
              "where": "src/world/view.js",
              "toggle": "reflection"
            },
            {
              "name": "叠片采样 SDF 的水体",
              "id": "1758251637280268481",
              "status": "todo",
              "where": "原 engine/watervol.js，未迁移"
            },
            {
              "name": "瀑布：河从崖边落下的水帘 + 白沫",
              "id": "1007587812462530561",
              "status": "done",
              "where": "src/water/waterfall.js",
              "toggle": "waterfalls"
            },
            {
              "name": "长船 + V 字尾迹",
              "id": "901469409579061248",
              "status": "done",
              "where": "src/life/boats.js",
              "toggle": "boats"
            },
            {
              "name": "动态海面但不抢戏：极低幅度的颜色漂移",
              "id": "1991103578011029507",
              "status": "done",
              "where": "src/world/view.js（海面漂移）"
            },
            {
              "name": "新的岸浪",
              "id": "1991099314714902634",
              "status": "done",
              "where": "src/water/shore.js"
            },
            {
              "name": "岸浪：许多重叠的浪各走各的周期",
              "id": "1849730611964973481",
              "status": "done",
              "where": "src/water/shore.js"
            },
            {
              "name": "岸线渲染：Bad North / Townscaper 那套的改良版（距离场浪裙）",
              "id": "1666429884208381953",
              "status": "done",
              "where": "src/water/shore.js"
            },
            {
              "name": "整个项目放到水上：小镇场景就是水上码头",
              "id": "1215642481162887168",
              "status": "done",
              "where": "src/world/townDemo.js"
            }
          ]
        ],
        [
          "光照",
          [
            {
              "name": "分层 AO（地形 + 建筑一起烘焙）",
              "id": "1168571866405097472",
              "status": "done",
              "where": "src/light/bake.js",
              "toggle": "ao"
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
              "status": "done",
              "where": "src/world/view.js · setSunAngle()",
              "toggle": "time"
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
              "name": "轨道相机运动模糊拖影",
              "id": "1727315611959865407",
              "status": "done",
              "where": "src/world/view.js",
              "toggle": "motionblur"
            },
            {
              "name": "SDF + 光体积的多次反弹 GI",
              "id": "1580845127207387137",
              "status": "todo"
            },
            {
              "name": "投影高度和深度测试高度分开、只在草-崖边和屋檐下出阴影：思路学了，实现是逐顶点版",
              "id": "1705195380457996629",
              "status": "partial",
              "where": "src/world/view.js（体素阴影）"
            },
            {
              "name": "贴图阴影（草上、屋檐下）：重构版用逐顶点体素阴影代替，不是贴图",
              "id": "1704218784028905984",
              "status": "partial",
              "where": "src/world/view.js（体素阴影）"
            },
            {
              "name": "半影：阴影画三遍（正常、稍收、大体素）。重构版用 PCF 软阴影，没有三遍叠",
              "id": "1305951750638231552",
              "status": "partial",
              "where": "src/world/view.js（shadows）"
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
              "name": "虚拟体素空间：World 的 solid / rock 位，同时用于光照烘焙、软法线、风场、体素阴影、碰撞（岛的体素块画面）",
              "id": "931196707236392960",
              "status": "done",
              "where": "src/core/world.js"
            },
            {
              "name": "光体积 + 3 次反弹（色溢）",
              "id": "1580835075629133825",
              "status": "done",
              "where": "src/light/lightvolume.js",
              "toggle": "gi"
            },
            {
              "name": "6 向光体积 + 反弹收敛（第 3 次后看不出）",
              "id": "1580846877855338497",
              "status": "done",
              "where": "src/light/lightvolume.js（bounceChange）",
              "toggle": "gi"
            },
            {
              "name": "点光源进光体积（大而软）",
              "id": "1582757294672314368",
              "status": "done",
              "where": "src/light/lightvolume.js（point）",
              "toggle": "pointlight"
            },
            {
              "name": "六向 AO 烘焙（3D SDF 未单存）",
              "id": "1481661852887265288",
              "status": "partial",
              "where": "src/light/lightvolume.js（ao）"
            }
          ]
        ],
        [
          "多层导航 · 本轮补差",
          [
            {
              "name": "洞内多层可站点、净空与门户边（战斗接入待补齐）",
              "id": "797119718477991936",
              "status": "partial",
              "where": "src/world/layerednav.js",
              "page": "navigation.html"
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
              "name": "1 体素列 + 角点取值",
              "id": "1120036868966502401",
              "status": "done",
              "where": "src/core/world.js"
            },
            {
              "name": "2 模块装配（原作 545 块，这里用规则生成）+ 模块签名调试色：同一种邻居占用 = 同一块拼图 = 同一种颜色",
              "id": "1279107097108635649",
              "status": "done",
              "where": "src/build/buildings.js（sigColor）",
              "toggle": "modules"
            },
            {
              "name": "3 陡坡双坡顶 + 山墙",
              "id": "1197909675443916803",
              "status": "done",
              "where": "src/build/buildings.js",
              "tour": "gable"
            },
            {
              "name": "4 支撑：钢架",
              "id": "1189902695303458816",
              "status": "done",
              "where": "src/build/buildings.js",
              "tour": "stilt"
            },
            {
              "name": "4 支撑：拱",
              "id": "1189908238566903808",
              "status": "done",
              "where": "src/build/buildings.js",
              "tour": "arch"
            },
            {
              "name": "5 门窗 = 道具放置：尽量多放、互不重叠（每层一张世界坐标占位表），开口沿墙边不随格子歪斜",
              "id": "1205416648397721601",
              "status": "done",
              "where": "src/build/buildings.js（tryPlace）"
            },
            {
              "name": "6 围合 → 后院",
              "id": "1238474550511308800",
              "status": "done",
              "where": "src/build/buildings.js",
              "tour": "yard"
            },
            {
              "name": "7 楼梯 + 表面装饰的\"小 WFC\"：每栋每层一种窗型、整栋只开一扇门；楼梯按导航图放在崖脚",
              "id": "1181464374839521280",
              "status": "done",
              "where": "src/build/buildings.js · src/world/navlayer.js",
              "toggle": "stairs"
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
              "name": "8c 旗子：最高屋脊插杆，旗面顺风飘",
              "id": "1212732478458343424",
              "status": "done",
              "where": "src/life/decor.js",
              "toggle": "flags"
            },
            {
              "name": "8d \"意大利电线\"：隔街相对的墙之间拉彩旗绳",
              "id": "1259838941299183619",
              "status": "done",
              "where": "src/life/decor.js",
              "toggle": "wires"
            },
            {
              "name": "8e 水花：落水时泡沫环 + 飞沫",
              "id": "1258421104756097029",
              "status": "done",
              "where": "src/life/effects.js"
            },
            {
              "name": "8f 出现 / 消失动画：弹性长出、拆掉冒灰",
              "id": "1246074663546916873",
              "status": "done",
              "where": "src/life/effects.js + view.js（uPops）"
            },
            {
              "name": "8g 火：Max 混合的软粒子（Bad North）",
              "id": "1056990611738451968",
              "status": "done",
              "where": "src/life/effects.js",
              "toggle": "fire"
            },
            {
              "name": "8g2 火的面片往上缩得更快 → 火焰顶端碎开",
              "id": "1056992291108413446",
              "status": "done",
              "where": "src/life/effects.js"
            },
            {
              "name": "8g3 浓烟：两遍画（黑描边）、每片一次噪声 UV 沿流向滚、越往上 mip 越高（勾选看棋盘格调试）",
              "id": "1015140880666300416",
              "status": "done",
              "where": "src/life/smoke.js",
              "toggle": "smokecheck"
            },
            {
              "name": "8i 战斗痕迹：血、尸体、箭射中后粘在船上随船走（Bad North 战斗；原文 \"making blood, corpses and arrows stick to boats\"）——画面是长船靠岸、箭雨、滩上尸体和血，不是草和花",
              "id": "946660607008403456",
              "status": "todo"
            },
            {
              "name": "8h 建造音效：入水\"咕咚\"（闷击 + 上扬的气泡音）、陆上磕石头、拆掉\"啵\"（WebAudio 现场合成；用户需求，非视频）",
              "status": "done",
              "where": "src/life/sound.js",
              "toggle": "sound"
            },
            {
              "name": "9 存档字符串 / 撤销",
              "id": "1198957499027795969",
              "status": "done",
              "where": "src/world/save.js · app.js"
            },
            {
              "name": "9b 用撤销栈回放建造过程（录预告片用，工具栏 ⟲）",
              "id": "1260586697538113537",
              "status": "done",
              "where": "src/world/app.js（replay）"
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
              "name": "沿烟的轨迹提高噪声的 mip 级别：底部清晰、顶端模糊",
              "id": "1015151731804721152",
              "status": "done",
              "where": "src/life/smoke.js（mip 偏移 = aAge×4）"
            },
            {
              "name": "每片只采样一次噪声，UV 沿烟的流向随机前 / 后滚；面板「烟·棋盘格调试」可看（画面就是棋盘格）",
              "id": "1015149712469524480",
              "status": "done",
              "where": "src/life/smoke.js（aDir）"
            },
            {
              "name": "两遍画：第一遍黑、底部 alpha 满；第二遍浅、底部更透明、阈值往里收 1 像素（fwidth）→ 黑描边",
              "id": "1015142746372366336",
              "status": "done",
              "where": "src/life/smoke.js（PASS 0 / 1）"
            },
            {
              "name": "灯塔：海边一格粗高塔 → 灯室 + 旋转光束",
              "id": "1331905048801144836",
              "status": "done",
              "where": "src/build/lighthouse.js",
              "toggle": "lighthouse"
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
              "name": "1 岛屿高度场（扭曲 fbm + 脊线 + 径向衰减）",
              "id": "1097458505315946496",
              "status": "done",
              "where": "src/terrain/generate.js",
              "page": "scene:terrain"
            },
            {
              "name": "2 台地 / 悬崖（偶数层量化）+ 沙滩",
              "id": "1447488323845509121",
              "status": "done",
              "where": "src/terrain/generate.js",
              "page": "scene:terrain"
            },
            {
              "name": "3 河流：深度优先下山 + 回溯",
              "id": "1769691526924292506",
              "status": "done",
              "where": "src/terrain/generate.js",
              "page": "scene:terrain"
            },
            {
              "name": "4 按边类型的层级平滑（钉住 > 崖顶线 > 崖脚线 > 内部）",
              "id": "1670720537662836736",
              "status": "done",
              "where": "src/terrain/shape.js",
              "toggle": "smooth"
            },
            {
              "name": "5 防\"蘑菇化\"的 relax",
              "id": "1769641473895432220",
              "status": "done",
              "where": "src/sphere/planet.js（独立星球演示；共享 World 球面融合待补齐）",
              "page": "planet.html"
            },
            {
              "name": "6 起伏的沉积线（世界空间噪声，跨崖面连续）",
              "id": "1699146321318314094",
              "status": "done",
              "where": "src/terrain/terrainmesh.js"
            },
            {
              "name": "7 树：八方位 impostor（见植被管线）",
              "id": "1849427564034498642",
              "status": "done",
              "where": "src/life/impostor.js",
              "toggle": "impostor"
            },
            {
              "name": "8 云（与树共用 impostor，见植被管线）",
              "id": "1852334860137849222",
              "status": "done",
              "where": "src/life/impostor.js",
              "toggle": "clouds"
            },
            {
              "name": "9 风场：每层一张网格，按阻挡度去掉撞墙分量、贴边加速、被挡上抬",
              "id": "926903893866541057",
              "status": "done",
              "where": "src/life/atmosphere.js",
              "toggle": "wind"
            },
            {
              "name": "10 雪花沿风场绕岛 + 台地 / 屋顶积雪",
              "id": "943230624369868800",
              "status": "done",
              "where": "src/life/atmosphere.js + view.js（uSnow）",
              "toggle": "snow"
            },
            {
              "name": "11 背景雾：岛周围一圈，越远越浓、缓慢流动",
              "id": "906207980802252801",
              "status": "done",
              "where": "src/life/atmosphere.js",
              "toggle": "fog"
            },
            {
              "name": "13 悬垂：崖顶岩石往外伸一格、底下留空（下面的地照样画）",
              "id": "1671808851895627776",
              "status": "done",
              "where": "src/terrain/features.js · terrainmesh.js",
              "page": "scene:terrain"
            },
            {
              "name": "14 天然石拱：两根岩柱之间架一道，拱下至少空一层",
              "id": "1670794261669769217",
              "status": "done",
              "where": "src/terrain/features.js",
              "page": "scene:terrain"
            },
            {
              "name": "15 海中石柱：浪蚀台脚 + 蘑菇帽",
              "id": "1708815475801505819",
              "status": "done",
              "where": "src/terrain/features.js",
              "page": "scene:terrain"
            },
            {
              "name": "16 简化导航图：同高连片合成区域节点，最短路树按耗时着色",
              "id": "1582293326815862786",
              "status": "done",
              "where": "src/world/navgraph.js · navlayer.js",
              "toggle": "nav"
            },
            {
              "name": "12 地平线上的阴云",
              "id": "1243228419162341379",
              "status": "done",
              "where": "src/life/vegetation.js（backdrop，共用云 impostor）",
              "toggle": "moody"
            },
            {
              "name": "沉积线让大崖壁更耐看、形体更好读：每层一条，贴在崖面外侧",
              "id": "1699038611125985317",
              "status": "done",
              "where": "src/terrain/terrainmesh.js"
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
              "name": "选中小队时间变慢、点地面下令、点线路径；空格暂停",
              "id": "886199305522085890",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "血、尸体、箭粘在船上随船走",
              "id": "946660607008403456",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "血浸透当血量指示",
              "id": "984813819280191488",
              "status": "done",
              "where": "src/badnorth/battle.js（soak）"
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
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "流场 / 影响场：多源 Dijkstra + 数据继承（兵种），每 0.25 秒一次",
              "id": "972829402873716737",
              "status": "done",
              "where": "src/badnorth/flowfield.js",
              "toggle": "flow"
            },
            {
              "name": "弹道查找表 + 代价函数，箭按真抛物线飞",
              "id": "987267068495003648",
              "status": "done",
              "where": "src/badnorth/battle.js"
            },
            {
              "name": "血迹跟着身体（物体空间血斑）；可关掉血腥",
              "id": "999185422403055616",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "toggle": "gore"
            },
            {
              "name": "多洞的岛 / 洞窟图块（只有造型，单位不穿洞）",
              "id": "906416813810049025",
              "status": "partial",
              "where": "src/terrain/features.js"
            },
            {
              "name": "窄道会车（简化：互相让开）",
              "id": "880853661936734211",
              "status": "partial",
              "where": "src/world/traffic.js · src/badnorth/battle.js"
            },
            {
              "name": "关掉血腥：面板「血腥」取消勾选后不画血、不留尸体（画面就是同一场战斗的有血 / 无血对比）",
              "id": "999191760944418817",
              "status": "done",
              "where": "src/badnorth/battle.js（gore）"
            },
            {
              "name": "军旗翻新：风取共享风场在旗杆顶的值 + 阵风，贝塞尔旗面；画面里地图上是风场格点",
              "id": "926834721392340992",
              "status": "done",
              "where": "src/badnorth/battle.js（#updateFlag）· life/atmosphere.js"
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
              "where": "src/world/layerednav.js · navigation.html",
              "page": "navigation.html"
            },
            {
              "name": "数据继承可视化：每格到父格一段线，颜色 = 从哪支守军继承来的（面板「流场」）",
              "id": "902069261304287232",
              "status": "done",
              "where": "src/badnorth/flowfield.js · battle.js（#drawFlow）"
            },
            {
              "name": "流场 / 影响场：除了到最近单位的距离和方向，还带着\"那是什么兵种\"；维京人看到矛兵正面会绕开去打小屋",
              "id": "901842167508992000",
              "status": "done",
              "where": "src/badnorth/flowfield.js"
            },
            {
              "name": "单位会被打下悬崖：挨打时身后低 ≥2 层就可能被击飞，抛物线落下，落差大的摔死",
              "id": "870296307889573889",
              "status": "done",
              "where": "src/badnorth/battle.js（#hit / #fallStep）"
            },
            {
              "name": "自写盒-盒相交（分离轴）",
              "id": "974325184525201409",
              "status": "done",
              "where": "src/core/obb.js"
            }
          ]
        ],
        [
          "战役",
          [
            {
              "name": "军旗：沿虚拟风粒子的贝塞尔曲线生成网格，风取共享风场",
              "id": "926890207298899969",
              "status": "done",
              "where": "src/badnorth/battle.js",
              "page": "scene:badnorth"
            },
            {
              "name": "战役图：节点散开 → 剔除 → 随机游走 → 支路 → 分区（分区 = 元胞自动机：最小组被连边最多的邻组吃掉，938422757288792064）",
              "id": "1042732450730913793",
              "status": "done",
              "where": "src/campaign/campaign.js",
              "page": "campaign.html"
            },
            {
              "name": "岛屿快照：64² 小图放大收脆",
              "id": "911913981731885056",
              "status": "done",
              "where": "src/campaign/campaign.js",
              "page": "campaign.html"
            },
            {
              "name": "分组元胞自动机：每次挑最小的组，整组并进和它连边最多的邻组，直到剩 6 组（战役图第 4 步的颜色）",
              "id": "938422757288792064",
              "status": "done",
              "where": "src/campaign/campaign.js（groupRegions）"
            },
            {
              "name": "战役图节点分成几片彩色区域，竖长条，上起点下终点",
              "id": "938405900573986816",
              "status": "done",
              "where": "src/campaign/campaign.js"
            },
            {
              "name": "节点连线 = Delaunay 三角网",
              "id": "1078792665980915714",
              "status": "done",
              "where": "src/campaign/campaign.js",
              "page": "campaign.html"
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
              "name": "疏密变化的细笔触 + 高度分段线（等高线，用 fwidth 保持 1 像素）",
              "id": "1704246032626762189",
              "status": "done",
              "where": "textures.html（疏密 + 等高线）",
              "page": "textures.html"
            },
            {
              "name": "专门的反差贴图：三角形上迭代，有反差的边推开（权重 1）、没反差的拉近（权重 4）；实测 80 条该画的边全画出、误画约 5 条；副产品…",
              "id": "1482346496460828674",
              "status": "done",
              "where": "textures.html（反差线）",
              "page": "textures.html"
            },
            {
              "name": "从\"反差\"生成一像素细线：场景里的墨线按法线 / 高度反差画；实验室里按三角形反差模拟画",
              "id": "1482011744843223042",
              "status": "done",
              "where": "textures.html（反差线）· src/world/outline.js",
              "page": "textures.html"
            },
            {
              "name": "128² 贴图里每隔一个像素是线像素；采样前重映射 UV，让线像素在屏幕上永远只占 1 像素——放大不变粗、不糊",
              "id": "1241096929490149376",
              "status": "done",
              "where": "textures.html（隔像素一条线）",
              "page": "textures.html"
            },
            {
              "name": "fwidth 画与缩放无关的 1 像素抗锯齿线；左右对比固定宽度 step（远处断、近处粗）",
              "id": "978211952504852480",
              "status": "done",
              "where": "textures.html（抗锯齿线）",
              "page": "textures.html"
            }
          ]
        ],
        [
          "地面笔触",
          [
            {
              "name": "像抽象田地的贴图：每块地一个条纹方向，能清楚看出格子",
              "id": "1714613599035863191",
              "status": "done",
              "where": "textures.html（抽象田地）",
              "page": "textures.html"
            },
            {
              "name": "旋涡状团块的地面笔触：域扭曲噪声量化成三档（主场景面板「地面笔触」）",
              "id": "1703750394164199473",
              "status": "done",
              "where": "src/world/view.js（BLOTCH_GLSL）· textures.html",
              "page": "textures.html"
            },
            {
              "name": "大色块不渗过重要的边：每一层台阶一套噪声偏移，色块在崖边断开",
              "id": "1696864977171189980",
              "status": "done",
              "where": "src/world/view.js（blotchTone 按高度层换噪声）"
            },
            {
              "name": "大块颜料斑藏住多边形：量化的三档明暗只画在朝上的草色面",
              "id": "1480635131614355459",
              "status": "done",
              "where": "src/world/view.js（地面笔触）"
            },
            {
              "name": "笔触从大到小、从中心螺旋找空位：中间一大块整齐的，越往外越碎",
              "id": "1478114309263839244",
              "status": "done",
              "where": "textures.html（径向排序）",
              "page": "textures.html"
            },
            {
              "name": "一张贴图 8 种朝向 + 以中心镜像，任意尺寸都能用",
              "id": "1061221291137605633",
              "status": "done",
              "where": "textures.html（UI 装饰）",
              "page": "textures.html"
            }
          ]
        ],
        [
          "调色板与 UI 装饰",
          [
            {
              "name": "调色板编辑器：四角取色的渐变方块 + 往白色收的三角（工具页，没有接回游戏调色板）",
              "id": "1712088611934371876",
              "status": "done",
              "where": "textures.html（调色板）",
              "page": "textures.html"
            },
            {
              "name": "颜色体积编辑：给地物定义完整的可用颜色空间（四角插值），采样出 15 色",
              "id": "1710031224838771027",
              "status": "done",
              "where": "textures.html（调色板）",
              "page": "textures.html"
            },
            {
              "name": "更多颜色：15 个色槽（画面左边一列 15 色）",
              "id": "1237293295887319040",
              "status": "done",
              "where": "src/core/palette.js"
            },
            {
              "name": "调色板后端：小镇 / 粉彩 / 暮色三套墙色，一键切换（画面：彩色小镇逐步变灰再换色）",
              "id": "1200520827898343425",
              "status": "done",
              "where": "src/core/palette.js · 工具栏调色板按钮"
            },
            {
              "name": "同一张装饰贴图的几种不同设置打破重复",
              "id": "1061229717582475264",
              "status": "done",
              "where": "textures.html（UI 装饰）",
              "page": "textures.html"
            },
            {
              "name": "扭动距离场 UI 装饰（填充/描边/发光同场）",
              "id": "1104771432440049664",
              "status": "done",
              "where": "textures.html",
              "page": "textures.html?t=squiggly"
            },
            {
              "name": "镜像纹饰 + 展开动画（阈值动画）",
              "id": "1105131621391495176",
              "status": "done",
              "where": "textures.html",
              "page": "textures.html?t=squiggly"
            },
            {
              "name": "UI flair：纹饰从中心长出",
              "id": "1024679338292256769",
              "status": "done",
              "where": "textures.html",
              "page": "textures.html?t=squiggly"
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
              "name": "递归解析树：细线 = 树的切分；板子越碎叶子越多（页面显示叶子数）",
              "id": "1765115069837221962",
              "status": "done",
              "where": "grids.html（图集打包）",
              "page": "grids.html"
            },
            {
              "name": "能删除矩形；兄弟都空就合并回父节点，碎片不一直累积",
              "id": "1765041830461055127",
              "status": "done",
              "where": "src/core/atlas.js（free）· grids.html",
              "page": "grids.html"
            },
            {
              "name": "二叉树矩形打包：生成放置尝试是暴力的，碰撞检测用树加速；网格实验室里实时演示",
              "id": "1764958522398146667",
              "status": "done",
              "where": "src/core/atlas.js · grids.html（图集打包）",
              "page": "grids.html"
            },
            {
              "name": "导出 .OBJ（首页 ⇩）",
              "id": "1430224300003545091",
              "status": "done",
              "where": "src/tools/objexport.js"
            },
            {
              "name": "整座小镇一个合并网格（mesh merger）",
              "id": "1401145625572425728",
              "status": "done",
              "where": "src/core/meshwriter.js"
            }
          ]
        ],
        [
          "界面 UI",
          [
            {
              "name": "头像生成器（层级部件，内容无关）",
              "id": "958371606350454784",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=face"
            },
            {
              "name": "游戏内头像相框",
              "id": "1010979395719319552",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=face"
            },
            {
              "name": "旗帜生成器（同一套生成器）",
              "id": "958410200146497537",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=banner"
            },
            {
              "name": "确认弹出：三按钮弧形弹出",
              "id": "1016680972610359298",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=pop"
            },
            {
              "name": "斜按钮",
              "id": "1242824460325052417",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=menu"
            },
            {
              "name": "图标与选中态",
              "id": "1201179450668441600",
              "status": "done",
              "where": "ui.html",
              "page": "ui.html?t=icons"
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
              "name": "1 顶点格（三角网格的对偶）作为植被落点",
              "id": "959752525867036672",
              "status": "partial",
              "where": "src/life/vegetation.js（按顶面类型 + 变形后的多边形取点）"
            },
            {
              "name": "1b 围合的草地块会长出树",
              "id": "1178731576982724611",
              "status": "done",
              "where": "src/build/buildings.js（后院）"
            }
          ]
        ],
        [
          "地被",
          [
            {
              "name": "2 每关多种草",
              "id": "959530111187013632",
              "status": "done",
              "where": "src/life/vegetation.js（草 / 干草两套色）",
              "toggle": "grass"
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
              "name": "2d 草的描边：外轮廓 + 叶瓣弧线画在同一个着色器里；身后是崖下 / 海（反差大）时外轮廓加粗",
              "id": "1590674061092212738",
              "status": "done",
              "where": "src/life/vegetation.js",
              "toggle": "outline"
            },
            {
              "name": "2e 草皮垂过崖边（圆润的草色舌头）",
              "id": "1696896119794479541",
              "status": "done",
              "where": "src/terrain/terrainmesh.js"
            },
            {
              "name": "2g 顶面无缝混色（草 / 苔 / 沙之间柔和过渡）",
              "id": "1781405550061687016",
              "status": "done",
              "where": "src/terrain/terrainmesh.js（扇形顶面，角上取邻格平均色）"
            },
            {
              "name": "2f 小花 = Bad North 式的白色碎点，一大片一大片撒在草地上（不是带茎的彩色花；画面见这段）",
              "id": "959530111187013632",
              "status": "done",
              "where": "src/life/vegetation.js（flowerGeometry）",
              "toggle": "flowers"
            }
          ]
        ],
        [
          "灌木",
          [
            {
              "name": "3 东西的边缘长一圈灌木（崖顶线）",
              "id": "1707490274425884929",
              "status": "done",
              "where": "src/life/vegetation.js",
              "toggle": "shrubs"
            },
            {
              "name": "3b 墙根灌木：广告牌加一个锚定的中心点",
              "id": "1191990107785572352",
              "status": "partial",
              "where": "src/life/vegetation.js（墙根位置已做；草丛用了中心点技巧，灌木是团块）",
              "toggle": "shrubs"
            },
            {
              "name": "3c 叶状轮廓：视角 × 叶片噪声镂空，镂空边缘即墨线",
              "id": "1205420678859632640",
              "status": "done",
              "where": "src/life/vegetation.js（swayMaterial uLeafy）",
              "toggle": "leafy"
            },
            {
              "name": "3d 小镇后院：沿墙一排圆灌木（原视频：植物贴图并进 128² 总图集的 32² 角）",
              "id": "1241046107125399552",
              "status": "done",
              "where": "src/life/vegetation.js（yards）",
              "toggle": "shrubs"
            },
            {
              "name": "3e 后院小径：沿后院主轴铺十字石板路",
              "id": "1290997501332525056",
              "status": "done",
              "where": "src/build/buildings.js（path）"
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
              "status": "partial",
              "where": "src/life/vegetation.js（反向外壳墨线）",
              "toggle": "outline"
            },
            {
              "name": "5 八方位 impostor：8 个方位烘进图集，按方位角混合相邻两张",
              "id": "1849427564034498642",
              "status": "done",
              "where": "src/life/impostor.js",
              "toggle": "impostor"
            },
            {
              "name": "5b 运行时精灵打包：二叉树矩形分配 / 释放（网格实验室「图集打包」可视化）",
              "page": "grids.html?t=atlas",
              "id": "1593215065423245313",
              "status": "done",
              "where": "src/core/atlas.js"
            },
            {
              "name": "6 云和树共用 impostor（放大、半透明、随风飘）",
              "id": "1852334860137849222",
              "status": "done",
              "where": "src/life/impostor.js · ImpostorField({ cloud })",
              "toggle": "clouds"
            }
          ]
        ]
      ]
    },
    {
      "key": "fusion",
      "name": "融合 · 第三个项目 → 球面",
      "color": "#7b5fb0",
      "note": "地形管线和建筑管线已经在同一张网格、同一份体素上（「融合」场景）。还差：球面（第 4 小时）。",
      "groups": [
        [
          "流程",
          [
            {
              "name": "1 三角 + 方格 tile 的 WFC",
              "id": "1447494168448753667",
              "status": "todo"
            },
            {
              "name": "2 不规则网格 + 多格 tile（房子跨格）：同一栋房子相邻格之间不起墙，三角格 + 方格拼成一栋（切「三角 + 方格」网格看）",
              "id": "1579483114178768898",
              "status": "done",
              "where": "src/build/buildings.js · core/grid.js（buildMixedGrid）"
            },
            {
              "name": "3 悬崖笼形变形（收分 + 扭动）",
              "id": "1579478470098243584",
              "status": "done",
              "where": "src/terrain/shape.js",
              "toggle": "smooth"
            },
            {
              "name": "4 房子拼进地形（台地排屋、海湾码头、跨峡谷的拱）",
              "id": "1584623053061099520",
              "status": "done",
              "where": "src/world/scenes.js",
              "page": "scene:fusion"
            },
            {
              "name": "5 强制放置特定模块：先压平一块台地（\"先生成它需要的那一小块\"），再放教堂（中殿 + 钟楼）",
              "id": "1751932427272909032",
              "status": "done",
              "where": "src/terrain/features.js（forceChurch）· world/scenes.js",
              "page": "scene:fusion"
            },
            {
              "name": "6 放到球面",
              "id": "1768627849529893109",
              "status": "done",
              "where": "src/sphere/planet.js（独立星球演示；共享 World 球面融合待补齐）",
              "page": "planet.html"
            },
            {
              "name": "7 星球上的防蘑菇化",
              "id": "1769641473895432220",
              "status": "done",
              "where": "src/sphere/planet.js（独立星球演示；共享 World 球面融合待补齐）",
              "page": "planet.html"
            },
            {
              "name": "8 沿河的导航结构：河上的边更便宜，顺流（离河口步数变小）最快",
              "id": "1795831296952041691",
              "status": "done",
              "where": "src/world/navgraph.js",
              "toggle": "nav"
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
      "check": "已完成两种网格：左上角切换「四边形 / 三角 + 方格」，三个场景和管线示例都能跑；格子是任意多边形（cell.n + edgeTwins）。下一步：多格 tile（一个房子跨一个方格 + 一个三角格，1579483114178768898）。",
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
      "check": "已完成：「融合」场景里房子贴着崖壁会被压暗，崖壁也会染上房子的颜色（同一次烘焙）。",
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
      "check": "切到「地形」场景：台地、峡谷、河流、洞窟；海岸和崖顶是圆滑曲线、崖壁收分扭动、沉积线起伏；勾掉「层级平滑」对比。还差：星球上的防蘑菇化 relax（要先有球面）。",
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
      "check": "植被和环境都做完了：草丛、小花、叶状灌木 / 树冠、八方位 impostor、云、风场（面板「风场箭头」）、雪（「雪」，台地和屋顶会积雪）、雾、地平线阴云。",
      "status": "done"
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
      "check": "切到「融合」场景：悬崖台地上长出 Townscaper 式房子，岸浪同时绕着地形和码头。还差：多格 tile、房子跨三角格。",
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
      "check": "未做：完成后应有一个 sphere.html，能旋转星球、在上面建房、看到环绕的岸浪。",
      "status": "todo"
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
