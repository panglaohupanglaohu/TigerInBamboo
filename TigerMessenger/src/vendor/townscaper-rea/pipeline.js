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
export const PIPELINE = {
  verdict: {
    title: 'Bad North 不是两者的综合，是祖先；融合发生在 Townscaper 之后的第三个项目，最终落到球面',
    points: [
      ['1579483114178768898', '"combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)" —— 一个房子 tile 同时跨一个方格和一个三角格'],
      ['1584623053061099520', '把房子拼进地形：房子大多属于预制 tile'],
      ['1768627849529893109', '"put this on a sphere" —— 地形 + tile 上了球面'],
      ['931196707236392960', 'Bad North：所有关卡共享一个虚拟体素空间，给光照烘焙、软法线、3D 贴图、碰撞、风模拟共用'],
    ],
  },
  lanes: [
    {
      key: 'base', name: '共享底座（基础能力）', color: '#2f7f8a',
      note: '三个项目都在用、而且一直在迭代的能力：网格、水层、光照。index 里能直接开关的就在这一层。',
      groups: [
        ['网格', [
          { name: 'Townscaper 不规则四边形网格', id: '1147881669350891521', status: 'done', where: 'src/quadgrid.js', toggle: 'grid' },
          { name: '无限网格：patch + cluster 拼接', id: '1332410042784641026', status: 'todo' },
          { name: '三角 + 方格混合网格（新项目）', id: '1447494168448753667', status: 'todo' },
          { name: '球面三角化', id: '1338825080844021760', status: 'todo' },
        ]],
        ['水层', [
          { name: '浪裙（Bad North → Townscaper）', id: '1215644531221311488', status: 'done', where: 'src/shore.js', toggle: 'waves' },
          { name: '距离场浪裙', id: '1664566546683899905', status: 'done', where: 'src/shore.js · engine/shorefield.js' },
          { name: '岸线黄线 / 外推蓝线', id: '1849732997945110651', status: 'done', where: 'src/shore.js · engine/waves.js', toggle: 'shorelines' },
          { name: '循环顶点着色器岸浪（新项目）', id: '1991101097818403263', status: 'done', where: 'src/shore.js · engine/waves.js', toggle: 'wavewire' },
          { name: '中间色倒影', id: '1215644531221311488', status: 'done', where: 'src/scene.js', toggle: 'reflection' },
          { name: '叠片采样 SDF 的水体', id: '1758251637280268481', status: 'engine', where: 'engine/watervol.js' },
        ]],
        ['光照', [
          { name: '分层 AO', id: '1168571866405097472', status: 'done', where: 'src/townmesh.js', toggle: 'ao' },
          { name: '彩色反弹光', id: '1237305125070426112', status: 'done', where: 'src/townmesh.js', toggle: 'ao' },
          { name: '柔和投影', id: '1305948413872267265', status: 'done', where: 'src/scene.js', toggle: 'shadows' },
          { name: '时段 / 夜里亮窗', id: '1313840428685447170', status: 'partial', where: 'src/scene.js', toggle: 'time' },
          { name: '只看光照（调试视图）', id: '1313841094069817344', status: 'done', where: 'src/scene.js', toggle: 'lightonly' },
          { name: '逆光边缘', id: '1751945034851570056', status: 'engine', where: 'engine/backlit.js' },
          { name: 'SDF + 光体积的多次反弹 GI', id: '1580845127207387137', status: 'todo' },
        ]],
      ],
    },
    {
      key: 'build', name: '建筑管线 · Townscaper', color: '#d9663f',
      note: '网格 → 体素列 → 按邻居装配模块 → 道具 → 后院与生物。index.html 的场景就是这条管线的产物。',
      groups: [
        ['流程', [
          { name: '1 体素列 + 角点取值', id: '1120036868966502401', status: 'done', where: 'src/town.js' },
          { name: '2 模块装配（原作 545 块，这里用规则生成）', id: '1279107097108635649', status: 'partial', where: 'src/townmesh.js', toggle: 'wire' },
          { name: '3 陡坡双坡顶 + 山墙', id: '1197909675443916803', status: 'done', where: 'src/townmesh.js', tour: 'gable' },
          { name: '4 支撑：钢架', id: '1189902695303458816', status: 'done', where: 'src/townmesh.js', tour: 'stilt' },
          { name: '4 支撑：拱', id: '1189908238566903808', status: 'done', where: 'src/townmesh.js', tour: 'arch' },
          { name: '5 门窗 / 道具放置', id: '1205416648397721601', status: 'partial', where: 'src/townmesh.js' },
          { name: '6 围合 → 后院', id: '1238474550511308800', status: 'done', where: 'src/townmesh.js', tour: 'yard' },
          { name: '7 楼梯、灯塔等特殊图案', id: '1181464374839521280', status: 'todo' },
          { name: '8 鸟 / 蝴蝶', id: '1244892370392489989', status: 'todo' },
          { name: '9 存档字符串 / 撤销', id: '1198957499027795969', status: 'done', where: 'src/save.js · src/app.js' },
        ]],
      ],
    },
    {
      key: 'terrain', name: '地形管线 · engine', color: '#4f7fb8',
      note: '高度场 / tile → 悬崖与软坡 → 河流 → 平滑 → 贴图 → 植被、云 → 风雪。Bad North 起步，第三个项目里成熟。',
      groups: [
        ['流程', [
          { name: '1 岛屿高度场 + 导航（Bad North）', id: '1097458505315946496', status: 'engine', where: 'engine/islands.js', page: 'engine/demo.html' },
          { name: '2 台地 / 悬崖 + 软坡', id: '1447488323845509121', status: 'engine', where: 'engine/mesa.js', page: 'engine/world.html' },
          { name: '3 河流：深度优先坍缩', id: '1769691526924292506', status: 'engine', where: 'engine/rivers.js', page: 'engine/world.html' },
          { name: '4 按边类型的层级平滑', id: '1670720537662836736', status: 'todo' },
          { name: '5 防"蘑菇化"的 relax', id: '1769641473895432220', status: 'engine', where: 'engine/relax.js' },
          { name: '6 沉积线 / 大笔触贴图', id: '1699146321318314094', status: 'todo' },
          { name: '7 树：八角 impostor', id: '1849427564034498642', status: 'todo' },
          { name: '8 云（与树共用 impostor）', id: '1852334860137849222', status: 'todo' },
          { name: '9 风场（Bad North）', id: '926903893866541057', status: 'todo' },
          { name: '10 雪花随风绕岛（Bad North）', id: '943230624369868800', status: 'todo' },
          { name: '11 背景雾', id: '906207980802252801', status: 'todo' },
        ]],
      ],
    },
    {
      key: 'fusion', name: '融合 · 第三个项目 → 球面', color: '#7b5fb0',
      note: '把地形管线和建筑管线放到同一张网格上：三角+方格 tile、房子 tile 跨格、拼进地形，最后上球面。这是下一步要学和做的。',
      groups: [
        ['流程', [
          { name: '1 三角 + 方格 tile 的 WFC', id: '1447494168448753667', status: 'todo' },
          { name: '2 不规则网格 + 多格 tile（房子跨格）', id: '1579483114178768898', status: 'todo' },
          { name: '3 悬崖笼形变形', id: '1579478470098243584', status: 'todo' },
          { name: '4 房子拼进地形', id: '1584623053061099520', status: 'todo' },
          { name: '5 强制放置特定模块', id: '1751932427272909032', status: 'todo' },
          { name: '6 放到球面', id: '1768627849529893109', status: 'todo' },
          { name: '7 星球上的防蘑菇化', id: '1769641473895432220', status: 'engine', where: 'engine/relax.js' },
          { name: '8 沿河的导航结构', id: '1795831296952041691', status: 'todo' },
        ]],
      ],
    },
  ],

  // The roadmap: an order to learn and build in, ending at the fused world on a sphere.
  // Each step: which clips to study, which code in this repo to reuse, how to check it.
  roadmap: [
    {
      step: 0, name: '统一网格：一张能同时承载地形和房子的图', lane: 'base',
      why: '三个项目的分水岭都在网格：Bad North 是方格，Townscaper 是不规则四边形，第三个项目是三角+方格混合，最后上球面。先把网格抽象成"任意多边形 + 半边结构"，后面所有管线都只依赖这一层。',
      study: ['1147881669350891521', '1151770831619534848', '1332410042784641026', '1458921394855718917', '1447496205282549761', '1447494168448753667'],
      reuse: ['src/quadgrid.js · buildQuadGrid() → { cells[{pts, edgeNeighbors, cornerNeighbors}], verts, vertexCells }', 'src/town.js · buildCellIndex() / pointInQuad()'],
      check: 'index.html 勾「网格线」：格子接近正方形、无凹格；下一步把 cells 换成半边结构后，同一张图里能同时有三角格和方格。',
      status: 'partial',
    },
    {
      step: 1, name: '共享体素场：地形和建筑读同一份数据', lane: 'base',
      why: 'Bad North 的原话：所有关卡共享一个"虚拟体素空间"，光照、法线、碰撞、风都从它来。地形管线和建筑管线若各存一份数据，就永远融合不了。',
      study: ['931196707236392960', '1168571866405097472', '1120036868966502401'],
      reuse: ['src/town.js · Town：每格一个层位掩码 solid[]、colors[]、regions()', 'src/townmesh.js · #bakeLighting：按层栅格化的占用图（已经就是体素空间的雏形）'],
      check: '同一个 Town 对象：地形格用 mode=terrain 渲染、建筑格用 townmesh 渲染，AO 栅格跨两者连续。',
      status: 'partial',
    },
    {
      step: 2, name: '地形管线：岛 → 悬崖/软坡 → 河流 → 平滑', lane: 'terrain',
      why: '先有地，才有房子的落脚点。第三个项目里地形也是 tile + WFC，河流单独深度优先坍缩，最后按边类型做层级平滑。',
      study: ['1447488323845509121', '1769691526924292506', '1670720537662836736', '1670725072540106755', '1579478470098243584', '1769641473895432220'],
      reuse: ['engine/mesa.js · 台地量化', 'engine/rivers.js · 深度优先开河', 'engine/relax.js · 防蘑菇化松弛'],
      check: 'engine/world.html 里能看到悬崖与缓坡共存、河流从高处流到海里不打转。',
      status: 'engine',
    },
    {
      step: 3, name: '建筑管线：体素列 → 模块 → 支撑 → 道具 → 后院', lane: 'build',
      why: 'Townscaper 的全部：按邻居状态选模块。这里先用规则生成几何，后续可替换成"角点取值查模块表"的 WFC，以便和地形 tile 混在一起。',
      study: ['1197909675443916803', '1189902695303458816', '1189908238566903808', '1238474550511308800', '1205416648397721601', '1279107097108635649'],
      reuse: ['src/townmesh.js · TownMesh(town, grid).rebuild() → 单个合并网格 + posts', 'learnpanel 的「去看」：拱门 / 钢架 / 后院 / 山墙'],
      check: 'index.html 建筑管线里每一步都能「去看」；拖动建造时屋顶、山墙、拱、后院自动出现。',
      status: 'done',
    },
    {
      step: 4, name: '水层：浪裙 → 岸线浪 → 倒影', lane: 'base',
      why: '三个项目都在迭代同一层水。它只依赖"哪些格是陆地"，所以天然是地形和建筑的公共层。',
      study: ['1215644531221311488', '1664566546683899905', '1849732997945110651', '1849730611964973481', '1991101097818403263', '1758251637280268481'],
      reuse: ['src/shore.js · buildShore(town, grid, index, {posts}) → { skirt, waves, shoreLine, seaLine }', 'src/shore.js · makeWaveMaterial()（循环顶点着色器）', 'engine/watervol.js'],
      check: 'index.html 勾「岸线黄/蓝线」「浪带线框」：浪从蓝线走到黄线再退回一点，海湾不折叠。',
      status: 'done',
    },
    {
      step: 5, name: '光照：分层 AO → 彩色反弹 → 时段 → 光体积 GI', lane: 'base',
      why: '他每个项目都自己写光照。分层 AO 已经能同时服务地形和房子；下一步是 SDF + 光体积的多次反弹。',
      study: ['1168571866405097472', '1237305125070426112', '1313840428685447170', '1580845127207387137', '1580846877855338497', '1791049306213912823'],
      reuse: ['src/townmesh.js · #bakeLighting（建议抽成 src/lighting.js 供地形共用）', 'src/scene.js · setTimeOfDay(day|dusk|night)'],
      check: 'index.html 开关「分层 AO」「只看光照」对比；夜晚窗户发光。',
      status: 'partial',
    },
    {
      step: 6, name: '环境：树与云的 impostor、风场、雪、雾', lane: 'terrain',
      why: '"风雪"只在 Bad North 期出现过（风场驱动旗帜和雪花）；云在 Townscaper 和第三个项目里都有，后者和树共用 impostor。',
      study: ['1849427564034498642', '1852334860137849222', '926903893866541057', '943230624369868800', '906207980802252801', '1243228419162341379'],
      reuse: ['src/townmesh.js · blob()（现在的低多边形树，可替换成 impostor）', 'src/scene.js · 光照档位（雾/天色可挂在这里）'],
      check: '未做：完成后应能在 index 场景里开关风、雪、云层。',
      status: 'todo',
    },
    {
      step: 7, name: '融合：房子 tile 跨格、拼进地形', lane: 'fusion',
      why: '第三个项目的核心原话："combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)"、"splice houses into the terrain"。在本仓库里的第一步：地形用 engine 的台地生成到同一个 Town 上，房子直接用 TownMesh 长在台地顶上。',
      study: ['1579483114178768898', '1584623053061099520', '1582293326815862786', '1751932427272909032', '1654401054828638214', '1669315384619540487'],
      reuse: ['src/quadgrid.js + engine/mesa.js（同一张网格上生成地形高度）', 'src/townmesh.js（只对"建筑格"出房子）', 'src/shore.js（陆地格决定岸线）'],
      check: '未做：完成后 index 里能看到悬崖台地上长出 Townscaper 式房子，岸浪同时绕着地形和码头。',
      status: 'todo',
    },
    {
      step: 8, name: '球面：同一套管线放到星球上', lane: 'fusion',
      why: '他 2020 年就在试球面三角化，2024 年"put this on a sphere"。到这一步，网格要有每格的局部"上方向"，水是一层球壳，高山要做防蘑菇化松弛。',
      study: ['1338825080844021760', '1338829205157646336', '1768627849529893109', '1769641473895432220', '1795831296952041691'],
      reuse: ['src/quadgrid.js 的松弛（换成球面切平面上做）', 'engine/relax.js', 'src/townmesh.js（把 y 轴换成格子法线）'],
      check: '未做：完成后应有一个 sphere.html，能旋转星球、在上面建房、看到环绕的岸浪。',
      status: 'todo',
    },
  ],
  statusName: { done: '已实现', partial: '部分', engine: '在 engine', todo: '未做' },
  statusColor: { done: '#3f9a5b', partial: '#c99a2e', engine: '#4f7fb8', todo: '#a7b3b5' },
};
