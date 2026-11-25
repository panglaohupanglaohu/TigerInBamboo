/**
 * 球系统工坊的能力代码。作用对象是「星球配方」（compilePlanetV8 的参数），不是体素：
 *   meta   id / 分区（与 system-catalog.json 的球系统分区一致）/ 参数范围 / Router 关键词
 *   match(summary, params)  看当前星球快照，说明这个能力能不能作用、为什么
 *   run(recipe, params)     返回新的配方（纯数据，在改造 Worker 里执行）
 * 星球编译器本身（src/procgen/planet）是 TigerMessenger 的代码；学到的球系统方法在重构完成后
 * 以同样的契约登记到这里，目录里对应的「原版占位」节点就升级为可执行。
 */
export const DEFAULT_PLANET_RECIPE = Object.freeze({ seed: 1, radius: 160, subdivision: 1, chartLimit: 6, resolution: 24, seaLevel: 0, landformChain: true });
export const PLANET_RECIPE_KEYS = ['seed', 'subdivision', 'chartLimit', 'resolution', 'seaLevel', 'landformChain'];
export const FINAL_KEY = 'tm.planet.final.v1';

const pct = (x) => Math.round(x * 100) + '%';
export const PLANET_CAPABILITIES = [
  { meta: { id: 'planet.sea-level', line: 'shore', domain: 'water', name: '海平面', does: '整体抬高或降低海平面：沿岸低地变海或露出。验证会检查每个场景锚点是否被淹。',
      keywords: ['海平面', '海', '淹', '水位', '陆地', '海岸', 'sea'], params: { level: { label: '海平面', min: -3, max: 3, step: 0.25, default: 0.5 } } },
    match: (s) => [{ id: 'planet', score: 1, reason: `陆地占 ${pct(s.stats.land)}；最低的陆上场景锚点高 ${s.stats.lowestLandmark?.height.toFixed(2)}（${s.stats.lowestLandmark?.id}）` }],
    run: (r, p) => ({ ...r, seaLevel: +p.level }) },
  { meta: { id: 'planet.reseed', line: 'terrain', domain: 'terrain', name: '重解地形', does: '换地形求解种子：场景锚点位置保持，锚点之间的山谷、湖泊、云重新求解。',
      keywords: ['种子', '重排', '重新生成', '地形', '大陆', '山', 'seed'], params: { seed: { label: '种子', min: 1, max: 999, step: 1, default: 7 } } },
    match: (s) => [{ id: 'planet', score: 0.8, reason: `${s.stats.landmarks} 个场景锚点固定，地形 WFC 解 ${s.hashes.wfc}` }],
    run: (r, p) => ({ ...r, seed: Math.round(p.seed) }) },
  { meta: { id: 'planet.surface-detail', line: 'grid', domain: 'grid', name: '地表分辨率', does: '每个切图的地表采样密度：越高越细，编译和渲染越慢。',
      keywords: ['分辨率', '细节', '精细', '粗', '性能', 'resolution'], params: { resolution: { label: '分辨率', min: 12, max: 40, step: 4, default: 32 } } },
    match: (s) => [{ id: 'planet', score: 0.6, reason: `当前分辨率 ${s.recipe.resolution}，编译 ${s.ms} ms` }],
    run: (r, p) => ({ ...r, resolution: Math.round(p.resolution) }) },
  { meta: { id: 'planet.chart-split', line: 'sphere', domain: 'grid', name: '切图数', does: '球面切成多少个切图（chart）装网格：影响接缝数量和分块加载。',
      keywords: ['切图', '分块', '接缝', 'chart', 'seam'], params: { charts: { label: '切图上限', min: 2, max: 12, step: 1, default: 8 } } },
    match: (s) => [{ id: 'planet', score: 0.5, reason: `当前 ${s.stats.charts} 个切图，接缝检查 ${s.reports.seamReport?.ok ? '通过' : '未通过'}` }],
    run: (r, p) => ({ ...r, chartLimit: Math.round(p.charts) }) },
  { meta: { id: 'planet.grid-subdivision', line: 'grid', domain: 'grid', name: '网格细分', does: '测地网格再细分一级：格子变多，场景锚点之间的地形更丰富。（实验：目前 2 级过不了编译器的地形链检查，验证会拦下）',
      keywords: ['细分', '网格', '格子', '更多', 'subdivision', 'grid'], params: { level: { label: '细分级数', min: 1, max: 3, step: 1, default: 1, safeMax: 1, warn: '⚠ 2 级以上目前过不了编译器的地形链检查，执行后会编译失败' } } },
    match: (s) => [{ id: 'planet', score: 0.5, reason: `当前细分 ${s.recipe.subdivision} 级，${s.stats.cells} 个格子；2 级目前编译不通过（实验）` }],
    run: (r, p) => ({ ...r, subdivision: Math.round(p.level) }) },
  // ── 海面统一（作用在实景海面的外观上，不改配方 / 网格 / 地形；莫西斯湖与高山圣城海湾不动）──
  //    学习来源：1849732997945110651（黄线岸 / 蓝线外推）· 1849730611964973481（多层浪各自循环）· 1215644531221311488（彩色中间倒影、宽岸裙）
  //            1783792917183606829（球面海陆、近岸色块与浪边）· 1781405550061687016（球面投影水 + 岸带）；代码：REACodeRefactoring src/core/wave-cycle.js、src/water/reflection.js
  { meta: { id: 'planet.sea-shore-field', line: 'shore', domain: 'water', sea: 'field', name: '岸带距离场', does: '从星球中心量出全球真实地表，算出每片海离岸多远、多深（经纬网格，赤道约 0.5 米一格）。白沫、浪带、水色都按它画。高山圣城海湾默认一起统一（没有接缝），「保留圣城海湾原样」设 1 则不动它。',
      learn: ['1849732997945110651', '1783792917183606829', '1781405550061687016'],
      keywords: ['岸线', '距离场', '海岸', '全球', '海面', '岸带', 'shore'], params: { detail: { label: '精细度', min: 1, max: 2, step: 1, default: 2 }, reach: { label: '最远距离(米)', min: 32, max: 96, step: 16, default: 64 }, keepBay: { label: '保留圣城海湾原样(1=保留)', min: 0, max: 1, step: 1, default: 0 } } },
    match: () => [{ id: 'ocean', score: 0.9, reason: '全球海面（不含莫西斯湖、各个内湖）' }],
    runSea: (st, p) => ({ ...st, field: { res: p.detail >= 2 ? 2048 : 1024, maxDist: p.reach }, bay: { keep: p.keepBay >= 1 } }) },
  { meta: { id: 'planet.sea-tint', line: 'water-effects', domain: 'water', sea: 'tint', name: '莫西斯湖水色', does: '全球海面换成莫西斯湖的青绿水色：岸边浅、离岸渐深。',
      learn: ['1783792917183606829', '1215644531221311488'],
      keywords: ['水色', '颜色', '莫西斯湖', '海水', '青绿', '统一', 'tint'], params: { light: { label: '明度', min: 0.8, max: 1.2, step: 0.05, default: 1 }, near: { label: '浅水宽(米)', min: 0.5, max: 4, step: 0.5, default: 1.5 }, far: { label: '变深距离(米)', min: 10, max: 40, step: 2, default: 26 } } },
    match: () => [{ id: 'ocean', score: 0.9, reason: '全球海面' }],
    runSea: (st, p) => ({ ...st, tint: { on: true, shallow: '#74b3b8', deep: '#4f8f99', near: p.near, far: p.far, light: p.light } }) },
  { meta: { id: 'planet.sea-foam', line: 'shore', domain: 'water', sea: 'foam', name: '岸边白沫与光晕', does: '贴着岸线一圈白沫，外面一圈渐淡的浅色光晕（「岸裙」）。',
      learn: ['1215644531221311488', '1849732997945110651'],
      keywords: ['白沫', '泡沫', '岸边', '光晕', '岸裙', 'foam'], params: { rim: { label: '白沫宽(米)', min: 0.3, max: 2, step: 0.1, default: 0.9 }, halo: { label: '光晕宽(米)', min: 1, max: 10, step: 0.5, default: 5 }, haloStrength: { label: '光晕强度', min: 0, max: 1, step: 0.05, default: 0.5 } } },
    match: () => [{ id: 'ocean', score: 0.8, reason: '所有海岸线' }],
    runSea: (st, p) => ({ ...st, foam: { on: true, rim: p.rim, halo: p.halo, haloStrength: p.haloStrength } }) },
  { meta: { id: 'planet.sea-waves', line: 'water-effects', domain: 'water', sea: 'waves', name: '外推浪带', does: '几层浪各自循环：从外推的蓝线涌向岸、撞岸后退回一点再消失；各层周期和起点错开，不会整齐划一。',
      learn: ['1849732997945110651', '1849730611964973481'],
      keywords: ['浪', '波浪', '浪带', '岸浪', '涌', 'waves'], params: { layers: { label: '浪层数', min: 1, max: 4, step: 1, default: 3 }, period: { label: '周期(秒)', min: 2.5, max: 8, step: 0.1, default: 4.6 }, reach: { label: '外推距离(米)', min: 1.5, max: 6, step: 0.1, default: 3.2 }, jitter: { label: '错开程度', min: 0, max: 1, step: 0.05, default: 0.6 }, strength: { label: '浪强度', min: 0, max: 1, step: 0.05, default: 0.7 } } },
    match: () => [{ id: 'ocean', score: 0.8, reason: '所有海岸线' }],
    runSea: (st, p) => ({ ...st, waves: { on: true, layers: Math.round(p.layers), period: p.period, reach: p.reach, jitter: p.jitter, strength: p.strength } }) },
  { meta: { id: 'planet.sea-reflection', line: 'reflection', domain: 'water', sea: 'reflection', name: '彩色中间倒影', does: '岸边建筑在海里的倒影：颜色取水色和建筑颜色的中间色，越深越淡，轻微摆动。被前景挡住的地方不画。',
      learn: ['1215644531221311488'],
      keywords: ['倒影', '反射', '镜像', 'reflection'], params: { colorMix: { label: '建筑色比例', min: 0, max: 1, step: 0.05, default: 0.5 }, opacity: { label: '不透明度', min: 0, max: 1, step: 0.05, default: 0.82 }, fade: { label: '淡出速度', min: 0.05, max: 1, step: 0.05, default: 0.3 }, maxMeshes: { label: '最多网格数', min: 40, max: 400, step: 20, default: 220 }, maxHeight: { label: '倒映高度(米)', min: 4, max: 30, step: 1, default: 12 } } },
    match: () => [{ id: 'ocean', score: 0.7, reason: '底部贴着海面的岸边建筑（莫西斯湖不参与）' }],
    runSea: (st, p) => ({ ...st, reflection: { on: true, colorMix: p.colorMix, opacity: p.opacity, fade: p.fade, distortion: 0.018, maxMeshes: Math.round(p.maxMeshes), maxTris: 300000, maxHeight: p.maxHeight } }) },
  // ── 天气（作用在实景的天气参数上：游戏已有的 world/weather.js 雨 / 雪 / 闪电 / 彩虹 + 风；配方不变）──
  //    学习来源：943230624369868800（雪片随风绕岛）· 959530111187013632（雨景）· 926903893866541057（全系统共用的风向量）
  //            926834721392340992 / 931196707236392960（风系统、体素风场）· 906207980802252801（淡雾，src/core/fog-envelope.js）
  { meta: { id: 'planet.weather-kind', line: 'wind', domain: 'weather', weather: 'kind', name: '天气类型', does: '晴 / 雨 / 雪。雨天有雨丝、偶尔闪电雷鸣，停雨时天空出彩虹；雪片随风漂。工坊里雨雪下在镜头前方，游玩时下在玩家周围。',
      learn: ['943230624369868800', '959530111187013632'],
      keywords: ['天气', '下雨', '雨', '雪', '下雪', '晴', '闪电', '彩虹', 'weather', 'rain', 'snow'], params: { kind: { label: '0 晴 · 1 雨 · 2 雪', min: 0, max: 2, step: 1, default: 1 } } },
    match: () => [{ id: 'sky', score: 0.9, reason: '全球天气（world/weather.js）' }],
    runWeather: (st, p) => ({ ...st, kind: Math.round(p.kind) }) },
  { meta: { id: 'planet.weather-wind', line: 'wind', domain: 'weather', weather: 'wind', name: '风', does: '一个风同时驱动云的漂移、雨丝的斜度、雪片的漂流方向，以及高山圣城屋顶上的旗（贝塞尔风粒子旗面，风越大甩得越厉害）。',
      learn: ['926903893866541057', '926834721392340992', '931196707236392960', '926890207298899969', '958410200146497537'],
      keywords: ['风', '风速', '风向', '大风', '漂', '旗', '旗帜', 'wind', 'flag', 'banner'], params: { speed: { label: '风速', min: 0, max: 3, step: 0.1, default: 1.2 }, dir: { label: '风向(度)', min: 0, max: 359, step: 1, default: 45 } } },
    match: () => [{ id: 'sky', score: 0.8, reason: '云、雨、雪、旗共用的风' }],
    runWeather: (st, p) => ({ ...st, wind: { speed: p.speed, dir: p.dir } }) },
  { meta: { id: 'planet.weather-clouds', line: 'wind', domain: 'weather', weather: 'clouds', name: '云（阴云与云影）', does: '用游戏已有的 impostor 云（和树冠共用一套）：调阴云程度（云变灰、变暗），并让离镜头最近的云在海面上投下会随云移动的影子。',
      learn: ['1852334860137849222', '1243228419162341379'],
      keywords: ['云', '云朵', '阴云', '多云', '云影', '阴天', 'cloud', 'clouds', 'shadow'], params: { gloom: { label: '阴云程度', min: 0, max: 1, step: 0.05, default: 0.4 }, shadow: { label: '云影强度', min: 0, max: 1, step: 0.05, default: 0.5 } } },
    match: () => [{ id: 'sky', score: 0.8, reason: '全球 impostor 云（planet-v8-cloud-impostors）' }],
    runWeather: (st, p) => ({ ...st, clouds: { on: true, gloom: p.gloom, shadow: p.shadow } }) },
  { meta: { id: 'planet.light-time', line: 'light', domain: 'light', weather: 'time', name: '时刻与太阳', does: '把星球定在某个时刻（太阳方向、天色、灯和窗跟着变），可以让昼夜照常流转、放慢，或者停在这个时刻方便看效果。高山圣城一带 0.62–0.93 会进入蓝调暮色（按目标图）。',
      learn: ['1313840428685447170'],
      keywords: ['时刻', '时间', '太阳', '黄昏', '暮色', '日落', '日出', '正午', '夜晚', '昼夜', 'time', 'sun', 'dusk', 'sunset'], params: { at: { label: '时刻 0 午夜 · 0.28 朝霞 · 0.5 正午 · 0.76 暮色', min: 0, max: 1, step: 0.01, default: 0.76 }, speed: { label: '昼夜速度（0 = 停住）', min: 0, max: 2, step: 0.05, default: 0 } } },
    match: () => [{ id: 'sky', score: 0.8, reason: '星球昼夜（P.timeOfDay / P.daySpeed）' }],
    runWeather: (st, p) => ({ ...st, time: { on: true, at: p.at, speed: p.speed } }) },
  { meta: { id: 'planet.light-sun-shadow', line: 'shadows', domain: 'light', weather: 'light', name: '太阳与投影', does: '调直射阳光的强弱和投影的软硬：0 是原来的硬边卡通投影，往上变成柔和的 PCF 软阴影（第一次打开会卡一下重编材质）；也可以关掉投影。体素阴影、高度图阴影两条只学了，游戏里用的是真实阴影贴图。',
      learn: ['1305948413872267265', '1305951750638231552', '1190191289922465793', '1704218784028905984', '1705195380457996629'],
      keywords: ['阴影', '投影', '软阴影', '硬阴影', '阳光', '直射光', '太阳强度', 'shadow', 'soft shadow', 'pcf', 'sun'], params: { sun: { label: '直射光强度', min: 0, max: 2, step: 0.05, default: 1 }, soft: { label: '投影软硬 0 硬边 · 1 很软', min: 0, max: 1, step: 0.05, default: 0.5 }, shadows: { label: '投影 0 关 · 1 开', min: 0, max: 1, step: 1, default: 1 } } },
    match: () => [{ id: 'sky', score: 0.75, reason: '全局太阳（平行光强度 + 阴影贴图类型 / 半径）' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), sun: p.sun, soft: p.soft, shadows: p.shadows } }) },
  { meta: { id: 'planet.light-ambient-bounce', line: 'light', domain: 'light', weather: 'light', name: '天光与反弹色', does: '调天光（环境光 + 半球光）强弱，并把「地面反弹光」往暖土红偏：暗面会带一点红墙 / 屋瓦反上来的暖色。这是整体近似，不是逐面传光的 GI（几条体素 GI 只学了，游戏里没有 GI 体积）。',
      learn: ['1237305125070426112', '1580835075629133825', '1580846877855338497', '1580845127207387137', '1582757294672314368', '1791049306213912823'],
      keywords: ['环境光', '天光', '反弹', '反射光', '全局光照', 'gi', 'bounce', 'ambient', 'skylight', '偏色'], params: { ambient: { label: '天光强度', min: 0, max: 2, step: 0.05, default: 1 }, bounce: { label: '暖色反弹量', min: 0, max: 1, step: 0.05, default: 0.35 } } },
    match: () => [{ id: 'sky', score: 0.7, reason: '环境光 / 半球光（地面色）/ 补光' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), ambient: p.ambient, bounce: p.bounce } }) },
  { meta: { id: 'planet.light-ao', line: 'shadows', domain: 'light', weather: 'light', name: '环境遮蔽（AO）', does: '调游戏已有 K3 体素 AO 的强度（墙角、门洞、台阶下更暗）。注意：体素 AO 默认没开，要带 ?oskLightingV1=1&voxelAoV1=1 进游戏才有；没开时验证会照实写「未开」。',
      learn: ['1168168400155267072', '1168571866405097472', '793557992931266561'],
      keywords: ['ao', '环境遮蔽', '遮蔽', '角落变暗', 'ambient occlusion', '体素ao'], params: { ao: { label: 'AO 强度', min: 0, max: 1, step: 0.05, default: 0.35 } } },
    match: () => [{ id: 'sky', score: 0.5, reason: 'K3 体素 AO（uVoxelAoStrength）' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), ao: p.ao } }) },
  { meta: { id: 'planet.light-ink-rim', line: 'lines', domain: 'light', weather: 'light', name: '墨线与逆光亮边', does: '（默认关闭：用户 2026-11-09 不要墨边；进游戏加 ?citadelInk=1 才有描边层可调）高山圣城新设计的墨线描边粗细和逆光暖边强弱（REA OutlineLayers：线宽按屏幕像素、远近一样粗；朝着太阳看时轮廓外一圈暖光；入夜墨线变淡、亮边换月光色）。会改画风。软硬法线混合只学了，未接。',
      learn: ['1017355723171344385', '929417420921556993'],
      keywords: ['描边', '墨线', '轮廓线', '勾线', '逆光', '亮边', '边缘光', 'outline', 'ink', 'rim', 'rim light'], params: { ink: { label: '墨线粗细（0 = 关）', min: 0, max: 3, step: 0.1, default: 1 }, rim: { label: '逆光亮边（0 = 关）', min: 0, max: 2, step: 0.1, default: 1 } } },
    match: () => [{ id: 'citadel', score: 0.85, reason: '圣城新设计可见建筑合成的描边层（citadel-ink-outline）' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), ink: p.ink, rim: p.rim } }) },
  { meta: { id: 'planet.light-rock', line: 'light', domain: 'light', weather: 'light', name: '山岩明暗与岩层', does: '圣城一带崖面的岩层纹理（不均匀厚度的层理、部分层有细线）和崖面偏灰蓝石灰岩的程度，只作用在陡的崖面上，平台草地不动。颜料斑草面、纯纹理灌木、坡面草更密三条只学了，游戏的草和灌木不是这套，未接。',
      learn: ['1786014232594485497', '1480635131614355459', '1707490932017279035', '1063115611289645057'],
      keywords: ['岩层', '山体', '崖面', '岩石', '石灰岩', '山的颜色', 'rock', 'cliff', 'strata', 'mountain'], params: { strata: { label: '岩层纹理（0 = 关）', min: 0, max: 1.5, step: 0.05, default: 1 }, rockCool: { label: '崖面冷灰', min: 0, max: 1, step: 0.05, default: 0.6 } } },
    match: () => [{ id: 'citadel', score: 0.7, reason: '圣城山体岩石材质（citadelRockStrata）' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), strata: p.strata, rockCool: p.rockCool } }) },
  { meta: { id: 'planet.light-view-grade', line: 'palette', domain: 'light', weather: 'light', name: '视图与调色', does: '检查用视图：只看光照（所有常规材质换成浅灰，看光影本身）/ 只看贴图（不打光，看底色）；再加整体饱和度和曝光。自定义着色器（天空、海、云）不换。AO 烘焙网格的可视化没做。',
      learn: ['1313841094069817344', '1298689301488775169', '1197909675443916803'],
      keywords: ['只看光照', '只看贴图', '视图', '调色', '饱和度', '曝光', '亮度', 'lighting only', 'albedo', 'saturation', 'exposure', 'debug view'], params: { view: { label: '视图 0 正常 · 1 只看光照 · 2 只看贴图', min: 0, max: 2, step: 1, default: 0 }, saturation: { label: '饱和度', min: 0, max: 2, step: 0.05, default: 1 }, exposure: { label: '曝光', min: 0.3, max: 2, step: 0.05, default: 1 } } },
    match: () => [{ id: 'sky', score: 0.6, reason: '全局材质视图 + 画布调色 + 曝光' }],
    runWeather: (st, p) => ({ ...st, light: { ...(st.light || {}), view: p.view, saturation: p.saturation, exposure: p.exposure } }) },
  { meta: { id: 'planet.weather-snow-cover', line: 'wind', domain: 'weather', weather: 'snow', name: '积雪（雪后的建筑）', does: '莫西斯湖特有：湖上建筑常年积雪（默认 0.85，不跟天气走）；这里可以把雪加得更厚。按积雪量盖雪：屋顶、台地、平台先白，雪越多越斜的屋面也盖上，边缘有噪声不成整片；墙面雪天偏冷；湖面倒影里的屋顶也跟着变白。配合「天气类型 = 雪」时城镇里同时下雪。',
      learn: ['943230624369868800'],
      keywords: ['积雪', '雪后', '屋顶积雪', '下雪', '雪', '冬天', 'snow', 'snow cover', 'winter'], params: { amount: { label: '积雪量', min: 0, max: 1, step: 0.05, default: 0.8 } } },
    match: () => [{ id: 'morris-town', score: 0.85, reason: '莫西斯湖城镇材质（自带 uSnow，按量渐变）' }],
    runWeather: (st, p) => ({ ...st, snow: { on: p.amount > 0, amount: p.amount } }) },
  { meta: { id: 'planet.weather-fog', line: 'wind', domain: 'weather', weather: 'fog', name: '天气雾', does: '加一层淡雾（雨天灰、雪天白），渐入渐出不突变；远景被柔化，近处仍清楚。',
      learn: ['906207980802252801'],
      keywords: ['雾', '薄雾', '朦胧', '阴天', 'fog', 'mist'], params: { density: { label: '浓度', min: 0.05, max: 1, step: 0.05, default: 0.35 }, warmth: { label: '色调 0 冷灰 · 1 暖白', min: 0, max: 1, step: 0.1, default: 0.3 } } },
    match: () => [{ id: 'sky', score: 0.7, reason: '全局雾（叠在灯光系统的雾上，不改它的设置）' }],
    runWeather: (st, p) => { const c = (a, b) => Math.round(a + (b - a) * p.warmth); return { ...st, fog: { on: true, density: p.density, color: `rgb(${c(196, 240)},${c(208, 232)},${c(214, 218)})` } }; } },
];
export const describePlanetCapabilities = () => PLANET_CAPABILITIES.map((c) => ({ ...c.meta, tier: 'planet', kind2: c.runSea ? 'sea' : c.runWeather ? 'weather' : 'recipe' }));
export function cleanRecipe(r = {}) {
  const o = { ...DEFAULT_PLANET_RECIPE };
  for (const k of PLANET_RECIPE_KEYS) if (r[k] !== undefined) o[k] = k === 'landformChain' ? !!r[k] : Number(r[k]);
  return o;
}
export function runPlanetPlan(recipe, steps, onStep) {
  let r = cleanRecipe(recipe); const report = []; let sea = null, weather = null;
  for (const s of steps) {
    onStep?.(s.id);
    const cap = PLANET_CAPABILITIES.find((c) => c.meta.id === s.id);
    if (!cap) { report.push({ id: s.id, status: 'missing' }); continue; }
    const params = {}; for (const [k, d] of Object.entries(cap.meta.params)) params[k] = Math.max(d.min, Math.min(d.max, Number(s.params?.[k] ?? d.default)));
    if (cap.runWeather) {   // 天气：只产出天气样式，配方不变
      weather = cap.runWeather(weather || { kind: 0, wind: { speed: 0.8, dir: 45 }, fog: { on: false } }, params);
      report.push({ id: s.id, line: cap.meta.line, status: 'applied', params, changed: [`天气 · ${cap.meta.name}`] }); continue;
    }
    if (cap.runSea) {   // 海面统一：只产出海面样式，配方不变
      sea = cap.runSea(sea || {}, params);
      report.push({ id: s.id, line: cap.meta.line, status: 'applied', params, changed: [`海面 · ${cap.meta.name}`] }); continue;
    }
    const before = r; r = cleanRecipe(cap.run(r, params));
    report.push({ id: s.id, line: cap.meta.line, status: 'applied', params, changed: PLANET_RECIPE_KEYS.filter((k) => before[k] !== r[k]).map((k) => `${k} ${before[k]} → ${r[k]}`) });
  }
  // 只要管线里有任何海面能力，就带上距离场（其余部分各自开关）
  if (sea) sea = { field: { res: 2048, maxDist: 64 }, tint: { on: false }, foam: { on: false }, waves: { on: false }, reflection: { on: false }, ...sea };
  return { recipe: r, report, sea, weather };
}
