/**
 * architecture.js — 重构版的"系统全局"：每一层有哪些模块、做什么、数据怎么流。
 * index.html 的「系统全局」和 architecture.html 都读这份数据。
 */
window.ARCH = {
  flow: [
    ['网格', 'src/core/grid.js', '三角六边形 → 合并 → 细分 → 方形松弛，一张网格给所有管线用'],
    ['体素场', 'src/core/world.js', '每格一列体素；rock 位标记地形，其余是建筑'],
    ['地形管线', 'src/terrain/', '生成岩石体素（台地、峡谷、河流、洞窟）并出崖壁网格'],
    ['建筑管线', 'src/build/', '在非岩石体素上出墙、屋顶、支撑、门窗、后院'],
    ['光照烘焙', 'src/light/bake.js', '分层占用图 → 模糊 → 顶点 AO + 彩色反弹，地形和房子一起算'],
    ['水层', 'src/water/shore.js', '按"第 1 层是否实心"出岸线、浪带、浪裙'],
    ['视图', 'src/world/view.js', '海面、倒影、光照档位、拾取、调试开关'],
  ],
  layers: [
    {
      name: '共享底座 core', color: '#2f7f8a', dir: 'src/core',
      modules: [
        ['grid.js', 'buildQuadGrid()：Townscaper 四边形网格（1147881669350891521）；buildMixedGrid()：三角 + 方格混合网格（1447494168448753667）；格子是任意多边形（cell.n），edgeTwins = 半边 twin'],
        ['world.js', 'World：solid / rock / color / river，regions()、snapshot()（931196707236392960 虚拟体素空间）'],
        ['spatial.js', 'pointInQuad（任意凸多边形）、buildCellIndex、decorateCells'],
        ['meshwriter.js', 'MeshWriter：所有生成器共用的顶点池（tri / quad / beam / box / blob），一次 draw call；writer.soft 软法线（按夹角平均，1062374549407350790）+ 描边方向 aOutline'],
        ['palette.js', '墙面调色板 + 建筑固定色 + 地形色（不做二次 sRGB 转换）'],
        ['noise.js', 'fbm / ridged / 随机数 / hash（移植自 engine）'],
        ['atlas.js', 'Atlas：二叉树矩形打包，allocate / free（1593215065423245313 运行时精灵打包）'],
      ],
    },
    {
      name: '地形管线 terrain', color: '#4f7fb8', dir: 'src/terrain',
      modules: [
        ['generate.js', 'generateTerrain()：高度场 → 偶数层量化 → 塔柱 → 去毛刺 → 峡谷 → 河流 → 洞窟'],
        ['generate.js', 'carveRivers()：深度优先下山、遇死路回溯（1769691526924292506）'],
        ['shape.js', 'shapeTerrain() → at(p, 切面)：按边类型的层级平滑 + 笼形变形（1670720537662836736、1579478470098243584）'],
        ['terrainmesh.js', 'buildTerrain({ shape })：崖壁（软法线）+ 起伏沉积线、台地顶（苔 / 草 / 沙 / 河）、崖顶暖色亮边、洞顶'],
      ],
    },
    {
      name: '建筑管线 build', color: '#d9663f', dir: 'src/build',
      modules: [
        ['buildings.js', 'buildBuildings()：码头基座、墙与勒脚、门窗、栏杆、钢架 / 拱、后院与树'],
        ['buildings.js', 'buildRoofs()：半格点阵上的檐口距离场 → 陡坡双坡顶 + 山墙 + 封檐板'],
      ],
    },
    {
      name: '水层 water', color: '#3a8fa0', dir: 'src/water',
      modules: [
        ['shore.js', 'buildShore()：距离场、黄线 / 蓝线、循环顶点着色器岸浪（1991101097818403263）、浪裙、钢架腿泡沫圈'],
      ],
    },
    {
      name: '光照 light', color: '#c99a2e', dir: 'src/light',
      modules: [
        ['bake.js', 'bakeLighting()：分层 AO + 彩色反弹（1168571866405097472、1237305125070426112）'],
      ],
    },
    {
      name: '世界 world', color: '#7b5fb0', dir: 'src/world',
      modules: [
        ['worldmesh.js', 'WorldMesh：地形 + 建筑 → 同一个 MeshWriter → 烘焙 → 一个几何体'],
        ['scenes.js', '小镇 / 地形 / 融合三个场景；generateFusion() 把房子拼进地形'],
        ['townDemo.js', '小镇场景：码头、排屋、塔、围合后院、拱、水上钢架房'],
        ['view.js', 'View：渲染器、海面、倒影、setTimeOfDay、setDebug、pick'],
        ['outline.js', 'OutlineLayers：墨线 + 逆光亮边，两层反向外壳（1751945034851570056）'],
        ['app.js', '入口：输入、撤销、场景切换、存档到地址栏'],
        ['save.js', '分享字符串 v5（位数组 → 64 字符表）'],
      ],
    },
    {
      name: '生命层 life', color: '#5e8a4c', dir: 'src/life',
      modules: [
        ['vegetation.js', 'Vegetation：草丛广告牌、崖边 / 墙根灌木、团块树冠，带风和墨线；落点从 World + 地形形状算（1590669875869286400、1707490274425884929、1580158269267406849）'],
        ['impostor.js', 'ImpostorBaker / ImpostorField：8 方位烘进图集、按方位角混合（1849427564034498642）；云共用同一套（1852334860137849222）'],
        ['atmosphere.js', 'Atmosphere：风场（每层网格，绕岛流动，926903893866541057）、雪（943230624369868800）、雾（906207980802252801）'],
        ['decor.js', 'Decor：旗子（1212732478458343424）、彩旗绳 Italian Wires（1259838941299183619）、蝴蝶（1273520600221433857）'],
        ['effects.js', 'Effects：水花（1258421104756097029）、出现 / 消失动画（1246074663546916873）、Max 混合的火（1056990611738451968）'],
        ['birds.js', 'Birds：海鸥，屋脊上成排停、挪步、扇翅 / 滑翔绕镇飞、倒影（1244892370392489989）'],
      ],
    },
    {
      name: '学习导航 ui', color: '#5d7279', dir: 'src/ui',
      modules: [
        ['walkthrough.js', '完整管线示例：同一座岛一步加一层，11 步，每步有原文、代码位置、原片'],
        ['learnpanel.js', '右侧面板：系统全局、管线开关、「去看」镜头、视频弹窗、接手规矩'],
        ['hud.css', '界面样式'],
      ],
    },
  ],
  notPorted: [
    ['engine/islands.js、demo.html', 'Bad North 方格岛 + 寻路：玩法层，和"融合"无关，暂不迁移'],
    ['engine/watervol.js', '叠片 SDF 水体：和当前倒影二选一，待做 A/B'],
    ['engine/surface.js、vertexlight.js、normalsmooth.js', '贴图层 / 顶点光照 / 平滑法线：依赖旧网格与旧网格生成器，需按 World 重写'],
    ['engine/relax.js', '防蘑菇化松弛：等球面阶段一起做'],
  ],
};
