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
          { name: 'Townscaper 不规则四边形网格', id: '1147881669350891521', status: 'done', where: 'src/core/grid.js', toggle: 'grid' },
          { name: '无限网格：patch + cluster 拼接', id: '1332410042784641026', status: 'todo' },
          { name: '三角 + 方格混合网格（新项目）', id: '1447494168448753667', status: 'done', where: 'src/core/grid.js · buildMixedGrid()（左上角切换网格）' },
          { name: '半边结构（格子是任意多边形，edgeTwins）', id: '1458921394855718917', status: 'done', where: 'src/core/grid.js · finishGrid()' },
          { name: '球面三角化', id: '1338825080844021760', status: 'todo' },
        ]],
        ['水层', [
          { name: '浪裙（Bad North → Townscaper）', id: '1215644531221311488', status: 'done', where: 'src/water/shore.js', toggle: 'waves' },
          { name: '距离场浪裙', id: '1664566546683899905', status: 'done', where: 'src/water/shore.js' },
          { name: '岸线黄线 / 外推蓝线', id: '1849732997945110651', status: 'done', where: 'src/water/shore.js', toggle: 'shorelines' },
          { name: '循环顶点着色器岸浪（新项目）', id: '1991101097818403263', status: 'done', where: 'src/water/shore.js', toggle: 'wavewire' },
          { name: '中间色倒影', id: '1215644531221311488', status: 'done', where: 'src/world/view.js', toggle: 'reflection' },
          { name: '叠片采样 SDF 的水体', id: '1758251637280268481', status: 'todo', where: '原 engine/watervol.js，未迁移' },
        ]],
        ['光照', [
          { name: '分层 AO（地形 + 建筑一起烘焙）', id: '1168571866405097472', status: 'done', where: 'src/light/bake.js', toggle: 'ao' },
          { name: '彩色反弹光', id: '1237305125070426112', status: 'done', where: 'src/light/bake.js', toggle: 'ao' },
          { name: '柔和投影', id: '1305948413872267265', status: 'done', where: 'src/world/view.js', toggle: 'shadows' },
          { name: '时段 / 夜里亮窗', id: '1313840428685447170', status: 'partial', where: 'src/world/view.js', toggle: 'time' },
          { name: '只看光照（调试视图）', id: '1313841094069817344', status: 'done', where: 'src/world/view.js', toggle: 'lightonly' },
          { name: '墨线（反向外壳描边）', id: '1751945034851570056', status: 'done', where: 'src/world/outline.js', toggle: 'outline' },
          { name: '逆光亮边（第二层外壳，迎着太阳才出现）', id: '1751945034851570056', status: 'done', where: 'src/world/outline.js', toggle: 'backlit' },
          { name: '软法线：弯曲崖壁变圆、崖顶仍硬（Bad North 体素法线）', id: '1062374549407350790', status: 'done', where: 'src/core/meshwriter.js · normals()' },
          { name: 'SDF + 光体积的多次反弹 GI', id: '1580845127207387137', status: 'todo' },
        ]],
      ],
    },
    {
      key: 'build', name: '建筑管线 · Townscaper', color: '#d9663f',
      note: '网格 → 体素列 → 按邻居装配模块 → 道具 → 后院与生物。index.html 的场景就是这条管线的产物。',
      groups: [
        ['流程', [
          { name: '1 体素列 + 角点取值', id: '1120036868966502401', status: 'done', where: 'src/core/world.js' },
          { name: '2 模块装配（原作 545 块，这里用规则生成）+ 模块签名调试色：同一种邻居占用 = 同一块拼图 = 同一种颜色', id: '1279107097108635649', status: 'done', where: 'src/build/buildings.js（sigColor）', toggle: 'modules' },
          { name: '3 陡坡双坡顶 + 山墙', id: '1197909675443916803', status: 'done', where: 'src/build/buildings.js', tour: 'gable' },
          { name: '4 支撑：钢架', id: '1189902695303458816', status: 'done', where: 'src/build/buildings.js', tour: 'stilt' },
          { name: '4 支撑：拱', id: '1189908238566903808', status: 'done', where: 'src/build/buildings.js', tour: 'arch' },
          { name: '5 门窗 = 道具放置：尽量多放、互不重叠（每层一张世界坐标占位表），开口沿墙边不随格子歪斜', id: '1205416648397721601', status: 'done', where: 'src/build/buildings.js（tryPlace）' },
          { name: '6 围合 → 后院', id: '1238474550511308800', status: 'done', where: 'src/build/buildings.js', tour: 'yard' },
          { name: '7 楼梯 + 表面装饰的"小 WFC"：每栋每层一种窗型、整栋只开一扇门；楼梯按导航图放在崖脚', id: '1181464374839521280', status: 'done', where: 'src/build/buildings.js · src/world/navlayer.js', toggle: 'stairs' },
          { name: '8 海鸥：排在屋脊上、只有停着有描边、挪动、倒影、扇翅滑翔绕镇飞', id: '1244892370392489989', status: 'done', where: 'src/life/birds.js', toggle: 'birds' },
          { name: '8b 蝴蝶：绕落点松散盘旋、随机换落点、世界空间噪声', id: '1273520600221433857', status: 'done', where: 'src/life/decor.js', toggle: 'butterflies' },
          { name: '8c 旗子：最高屋脊插杆，旗面顺风飘', id: '1212732478458343424', status: 'done', where: 'src/life/decor.js', toggle: 'flags' },
          { name: '8d "意大利电线"：隔街相对的墙之间拉彩旗绳', id: '1259838941299183619', status: 'done', where: 'src/life/decor.js', toggle: 'wires' },
          { name: '8e 水花：落水时泡沫环 + 飞沫', id: '1258421104756097029', status: 'done', where: 'src/life/effects.js' },
          { name: '8f 出现 / 消失动画：弹性长出、拆掉冒灰', id: '1246074663546916873', status: 'done', where: 'src/life/effects.js + view.js（uPops）' },
          { name: '8g 火：Max 混合的软粒子（Bad North）', id: '1056990611738451968', status: 'done', where: 'src/life/effects.js', toggle: 'fire' },
          { name: '8i 战斗痕迹：血、尸体、箭射中后粘在船上随船走（Bad North 战斗；原文 "making blood, corpses and arrows stick to boats"）——画面是长船靠岸、箭雨、滩上尸体和血，不是草和花', id: '946660607008403456', status: 'todo' },
          { name: '8h 建造音效：入水"咕咚"（闷击 + 上扬的气泡音）、陆上磕石头、拆掉"啵"（WebAudio 现场合成；用户需求，非视频）', status: 'done', where: 'src/life/sound.js', toggle: 'sound' },
          { name: '9 存档字符串 / 撤销', id: '1198957499027795969', status: 'done', where: 'src/world/save.js · app.js' },
        ]],
      ],
    },
    {
      key: 'terrain', name: '地形管线 · terrain', color: '#4f7fb8',
      note: '高度场 → 台地与悬崖 → 峡谷 → 河流 → 洞窟 → 层级平滑 / 笼形变形 → 贴图 → 植被、云 → 风雪。重构版已在共享网格上实现到平滑这一步（「地形」场景，勾掉「层级平滑」可对比）。',
      groups: [
        ['流程', [
          { name: '1 岛屿高度场（扭曲 fbm + 脊线 + 径向衰减）', id: '1097458505315946496', status: 'done', where: 'src/terrain/generate.js', page: 'scene:terrain' },
          { name: '2 台地 / 悬崖（偶数层量化）+ 沙滩', id: '1447488323845509121', status: 'done', where: 'src/terrain/generate.js', page: 'scene:terrain' },
          { name: '3 河流：深度优先下山 + 回溯', id: '1769691526924292506', status: 'done', where: 'src/terrain/generate.js', page: 'scene:terrain' },
          { name: '4 按边类型的层级平滑（钉住 > 崖顶线 > 崖脚线 > 内部）', id: '1670720537662836736', status: 'done', where: 'src/terrain/shape.js', toggle: 'smooth' },
          { name: '5 防"蘑菇化"的 relax', id: '1769641473895432220', status: 'todo' },
          { name: '6 起伏的沉积线（世界空间噪声，跨崖面连续）', id: '1699146321318314094', status: 'done', where: 'src/terrain/terrainmesh.js' },
          { name: '7 树：八方位 impostor（见植被管线）', id: '1849427564034498642', status: 'done', where: 'src/life/impostor.js', toggle: 'impostor' },
          { name: '8 云（与树共用 impostor，见植被管线）', id: '1852334860137849222', status: 'done', where: 'src/life/impostor.js', toggle: 'clouds' },
          { name: '9 风场：每层一张网格，按阻挡度去掉撞墙分量、贴边加速、被挡上抬', id: '926903893866541057', status: 'done', where: 'src/life/atmosphere.js', toggle: 'wind' },
          { name: '10 雪花沿风场绕岛 + 台地 / 屋顶积雪', id: '943230624369868800', status: 'done', where: 'src/life/atmosphere.js + view.js（uSnow）', toggle: 'snow' },
          { name: '11 背景雾：岛周围一圈，越远越浓、缓慢流动', id: '906207980802252801', status: 'done', where: 'src/life/atmosphere.js', toggle: 'fog' },
          { name: '13 悬垂：崖顶岩石往外伸一格、底下留空（下面的地照样画）', id: '1671808851895627776', status: 'done', where: 'src/terrain/features.js · terrainmesh.js', page: 'scene:terrain' },
          { name: '14 天然石拱：两根岩柱之间架一道，拱下至少空一层', id: '1670794261669769217', status: 'done', where: 'src/terrain/features.js', page: 'scene:terrain' },
          { name: '15 海中石柱：浪蚀台脚 + 蘑菇帽', id: '1708815475801505819', status: 'done', where: 'src/terrain/features.js', page: 'scene:terrain' },
          { name: '16 简化导航图：同高连片合成区域节点，最短路树按耗时着色', id: '1582293326815862786', status: 'done', where: 'src/world/navgraph.js · navlayer.js', toggle: 'nav' },
          { name: '12 地平线上的阴云', id: '1243228419162341379', status: 'done', where: 'src/life/vegetation.js（backdrop，共用云 impostor）', toggle: 'moody' },
        ]],
      ],
    },
    {
      key: 'veg', name: '植被管线 · vegetation', color: '#5e8a4c',
      note: '落点 → 地被（含无缝混色、垂过崖边）→ 灌木（叶状轮廓）→ 树 → 远景（八方位 impostor）→ 云。三个项目一路都在做：Bad North 的草和花、Townscaper 的灌木和草地、第三个项目的团块树和八角 impostor。重构版在共享网格上做了前四步（src/life/vegetation.js），落点全从 World + 地形形状来。',
      groups: [
        ['落点', [
          { name: '1 顶点格（三角网格的对偶）作为植被落点', id: '959752525867036672', status: 'partial', where: 'src/life/vegetation.js（按顶面类型 + 变形后的多边形取点）' },
          { name: '1b 围合的草地块会长出树', id: '1178731576982724611', status: 'done', where: 'src/build/buildings.js（后院）' },
        ]],
        ['地被', [
          { name: '2 每关多种草', id: '959530111187013632', status: 'done', where: 'src/life/vegetation.js（草 / 干草两套色）', toggle: 'grass' },
          { name: '2b 坡上长草，帮助读出可走的地方', id: '1063115611289645057', status: 'done', where: 'src/life/vegetation.js（坡上、崖边更密）', toggle: 'grass' },
          { name: '2c 草丛广告牌：新的形状和细节频率', id: '1590669875869286400', status: 'done', where: 'src/life/vegetation.js（只绕 Y 轴的广告牌 + 风）', toggle: 'grass' },
          { name: '2d 草的描边：强度 = 站立处与背景的反差（崖边的草才有墨线）', id: '1590674061092212738', status: 'done', where: 'src/life/vegetation.js（aEdge + 墨线层）', toggle: 'grass' },
          { name: '2e 草皮垂过崖边（圆润的草色舌头）', id: '1696896119794479541', status: 'done', where: 'src/terrain/terrainmesh.js' },
          { name: '2g 顶面无缝混色（草 / 苔 / 沙之间柔和过渡）', id: '1781405550061687016', status: 'done', where: 'src/terrain/terrainmesh.js（扇形顶面，角上取邻格平均色）' },
          { name: '2f 小花（茎 + 彩色花头，成簇）——没有专门讲小花的视频，按通用做法补的；原来挂的 946660607008403456 是战斗画面，已改正', status: 'done', where: 'src/life/vegetation.js', toggle: 'flowers' },
        ]],
        ['灌木', [
          { name: '3 东西的边缘长一圈灌木（崖顶线）', id: '1707490274425884929', status: 'done', where: 'src/life/vegetation.js', toggle: 'shrubs' },
          { name: '3b 墙根灌木：广告牌加一个锚定的中心点', id: '1191990107785572352', status: 'partial', where: 'src/life/vegetation.js（墙根位置已做；草丛用了中心点技巧，灌木是团块）', toggle: 'shrubs' },
          { name: '3c 叶状轮廓：视角 × 叶片噪声镂空，镂空边缘即墨线', id: '1205420678859632640', status: 'done', where: 'src/life/vegetation.js（swayMaterial uLeafy）', toggle: 'leafy' },
          { name: '3d 小镇后院：沿墙一排圆灌木（原视频：植物贴图并进 128² 总图集的 32² 角）', id: '1241046107125399552', status: 'done', where: 'src/life/vegetation.js（yards）', toggle: 'shrubs' },
          { name: '3e 后院小径：沿后院主轴铺十字石板路', id: '1290997501332525056', status: 'done', where: 'src/build/buildings.js（path）' },
        ]],
        ['树', [
          { name: '4 Marching Cubes 团块做树冠', id: '1580158269267406849', status: 'done', where: 'src/life/vegetation.js（几团球融合 + 朝团心的法线）', toggle: 'trees' },
          { name: '4b 标记三角形之间的边（团块描边）', id: '1580162341668237312', status: 'partial', where: 'src/life/vegetation.js（反向外壳墨线）', toggle: 'outline' },
          { name: '5 八方位 impostor：8 个方位烘进图集，按方位角混合相邻两张', id: '1849427564034498642', status: 'done', where: 'src/life/impostor.js', toggle: 'impostor' },
          { name: '5b 运行时精灵打包：二叉树矩形分配 / 释放', id: '1593215065423245313', status: 'done', where: 'src/core/atlas.js' },
          { name: '6 云和树共用 impostor（放大、半透明、随风飘）', id: '1852334860137849222', status: 'done', where: 'src/life/impostor.js · ImpostorField({ cloud })', toggle: 'clouds' },
        ]],
      ],
    },
    {
      key: 'fusion', name: '融合 · 第三个项目 → 球面', color: '#7b5fb0',
      note: '地形管线和建筑管线已经在同一张网格、同一份体素上（「融合」场景）。还差：球面（第 4 小时）。',
      groups: [
        ['流程', [
          { name: '1 三角 + 方格 tile 的 WFC', id: '1447494168448753667', status: 'todo' },
          { name: '2 不规则网格 + 多格 tile（房子跨格）：同一栋房子相邻格之间不起墙，三角格 + 方格拼成一栋（切「三角 + 方格」网格看）', id: '1579483114178768898', status: 'done', where: 'src/build/buildings.js · core/grid.js（buildMixedGrid）' },
          { name: '3 悬崖笼形变形（收分 + 扭动）', id: '1579478470098243584', status: 'done', where: 'src/terrain/shape.js', toggle: 'smooth' },
          { name: '4 房子拼进地形（台地排屋、海湾码头、跨峡谷的拱）', id: '1584623053061099520', status: 'done', where: 'src/world/scenes.js', page: 'scene:fusion' },
          { name: '5 强制放置特定模块：先压平一块台地（"先生成它需要的那一小块"），再放教堂（中殿 + 钟楼）', id: '1751932427272909032', status: 'done', where: 'src/terrain/features.js（forceChurch）· world/scenes.js', page: 'scene:fusion' },
          { name: '6 放到球面', id: '1768627849529893109', status: 'todo' },
          { name: '7 星球上的防蘑菇化', id: '1769641473895432220', status: 'todo' },
          { name: '8 沿河的导航结构：河上的边更便宜，顺流（离河口步数变小）最快', id: '1795831296952041691', status: 'done', where: 'src/world/navgraph.js', toggle: 'nav' },
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
      reuse: ['src/core/grid.js · buildQuadGrid() → { cells[{pts, edgeNeighbors, cornerNeighbors}], verts, vertexCells }', 'src/core/spatial.js · buildCellIndex() / pointInQuad()'],
      check: '已完成两种网格：左上角切换「四边形 / 三角 + 方格」，三个场景和管线示例都能跑；格子是任意多边形（cell.n + edgeTwins）。下一步：多格 tile（一个房子跨一个方格 + 一个三角格，1579483114178768898）。',
      status: 'partial',
    },
    {
      step: 1, name: '共享体素场：地形和建筑读同一份数据', lane: 'base',
      why: 'Bad North 的原话：所有关卡共享一个"虚拟体素空间"，光照、法线、碰撞、风都从它来。地形管线和建筑管线若各存一份数据，就永远融合不了。',
      study: ['931196707236392960', '1168571866405097472', '1120036868966502401'],
      reuse: ['src/core/world.js · World：solid / rock / color / river，isRock()、ground()、topIsBuilt()', 'src/light/bake.js · bakeLighting()：地形和建筑一起烘焙'],
      check: '已完成：「融合」场景里房子贴着崖壁会被压暗，崖壁也会染上房子的颜色（同一次烘焙）。',
      status: 'done',
    },
    {
      step: 2, name: '地形管线：岛 → 悬崖/软坡 → 河流 → 平滑', lane: 'terrain',
      why: '先有地，才有房子的落脚点。第三个项目里地形也是 tile + WFC，河流单独深度优先坍缩，最后按边类型做层级平滑。',
      study: ['1447488323845509121', '1769691526924292506', '1670720537662836736', '1670725072540106755', '1579478470098243584', '1769641473895432220'],
      reuse: ['src/terrain/generate.js · generateTerrain() / carveRivers()', 'src/terrain/shape.js · shapeTerrain() → at(p, 切面)：层级平滑 + 笼形变形', 'src/terrain/terrainmesh.js · buildTerrain({ shape })', 'src/core/meshwriter.js · writer.soft：按夹角平均的软法线'],
      check: '切到「地形」场景：台地、峡谷、河流、洞窟；海岸和崖顶是圆滑曲线、崖壁收分扭动、沉积线起伏；勾掉「层级平滑」对比。还差：星球上的防蘑菇化 relax（要先有球面）。',
      status: 'partial',
    },
    {
      step: 3, name: '建筑管线：体素列 → 模块 → 支撑 → 道具 → 后院', lane: 'build',
      why: 'Townscaper 的全部：按邻居状态选模块。这里先用规则生成几何，后续可替换成"角点取值查模块表"的 WFC，以便和地形 tile 混在一起。',
      study: ['1197909675443916803', '1189902695303458816', '1189908238566903808', '1238474550511308800', '1205416648397721601', '1279107097108635649'],
      reuse: ['src/build/buildings.js · TownMesh(town, grid).rebuild() → 单个合并网格 + posts', 'learnpanel 的「去看」：拱门 / 钢架 / 后院 / 山墙'],
      check: 'index.html 建筑管线里每一步都能「去看」；拖动建造时屋顶、山墙、拱、后院自动出现。',
      status: 'done',
    },
    {
      step: 4, name: '水层：浪裙 → 岸线浪 → 倒影', lane: 'base',
      why: '三个项目都在迭代同一层水。它只依赖"哪些格是陆地"，所以天然是地形和建筑的公共层。',
      study: ['1215644531221311488', '1664566546683899905', '1849732997945110651', '1849730611964973481', '1991101097818403263', '1758251637280268481'],
      reuse: ['src/water/shore.js · buildShore(town, grid, index, {posts}) → { skirt, waves, shoreLine, seaLine }', 'src/water/shore.js · makeWaveMaterial()（循环顶点着色器）'],
      check: 'index.html 勾「岸线黄/蓝线」「浪带线框」：浪从蓝线走到黄线再退回一点，海湾不折叠。',
      status: 'done',
    },
    {
      step: 5, name: '光照：分层 AO → 彩色反弹 → 时段 → 光体积 GI', lane: 'base',
      why: '他每个项目都自己写光照。分层 AO 已经能同时服务地形和房子；下一步是 SDF + 光体积的多次反弹。',
      study: ['1168571866405097472', '1237305125070426112', '1313840428685447170', '1580845127207387137', '1580846877855338497', '1791049306213912823'],
      reuse: ['src/build/buildings.js · #bakeLighting（建议抽成 src/lighting.js 供地形共用）', 'src/world/view.js · setTimeOfDay(day|dusk|night)'],
      check: 'index.html 开关「分层 AO」「只看光照」对比；夜晚窗户发光。',
      status: 'partial',
    },
    {
      step: 6, name: '环境与植被：草丛 → 灌木 → 团块树 → impostor → 云、风、雪、雾', lane: 'veg',
      why: '"风雪"只在 Bad North 期出现过（风场驱动旗帜和雪花）；云在 Townscaper 和第三个项目里都有，后者和树共用 impostor。',
      study: ['1590669875869286400', '1707490274425884929', '1580158269267406849', '1849427564034498642', '1852334860137849222', '926903893866541057', '943230624369868800', '906207980802252801', '1243228419162341379'],
      reuse: ['src/life/vegetation.js · Vegetation.refresh(world, shape)：草丛、崖边 / 墙根灌木、团块树冠，带风和墨线', 'src/world/view.js · 光照档位（雾 / 天色可挂在这里）'],
      check: '植被和环境都做完了：草丛、小花、叶状灌木 / 树冠、八方位 impostor、云、风场（面板「风场箭头」）、雪（「雪」，台地和屋顶会积雪）、雾、地平线阴云。',
      status: 'done',
    },
    {
      step: 7, name: '融合：房子 tile 跨格、拼进地形', lane: 'fusion',
      why: '第三个项目的核心原话："combine an irregular grid (like in Townscaper) with multi-cell tiles (like in Bad North)"、"splice houses into the terrain"。重构版里已经做到第一步：地形生成写进同一个 World，房子用建筑管线直接长在台地上、海湾里铺码头、峡谷上架拱。',
      study: ['1579483114178768898', '1584623053061099520', '1582293326815862786', '1751932427272909032', '1654401054828638214', '1669315384619540487'],
      reuse: ['src/world/scenes.js · generateFusion()', 'src/world/worldmesh.js · WorldMesh（两条管线写同一个顶点池）', 'src/water/shore.js（陆地格决定岸线）'],
      check: '切到「融合」场景：悬崖台地上长出 Townscaper 式房子，岸浪同时绕着地形和码头。还差：多格 tile、房子跨三角格。',
      status: 'partial',
    },
    {
      step: 8, name: '球面：同一套管线放到星球上', lane: 'fusion',
      why: '他 2020 年就在试球面三角化，2024 年"put this on a sphere"。到这一步，网格要有每格的局部"上方向"，水是一层球壳，高山要做防蘑菇化松弛。',
      study: ['1338825080844021760', '1338829205157646336', '1768627849529893109', '1769641473895432220', '1795831296952041691'],
      reuse: ['src/core/grid.js 的松弛（换成球面切平面上做）', 'src/build/buildings.js（把 y 轴换成格子法线）'],
      check: '未做：完成后应有一个 sphere.html，能旋转星球、在上面建房、看到环绕的岸浪。',
      status: 'todo',
    },
  ],
  statusName: { done: '已实现', partial: '部分', engine: '在 engine', todo: '未做' },
  statusColor: { done: '#3f9a5b', partial: '#c99a2e', engine: '#4f7fb8', todo: '#a7b3b5' },
};
