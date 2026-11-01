/**
 * walkthrough.js — 完整管线示例：同一座岛，一步加一层，从网格一直走到黄昏里的海鸥。
 *
 * 每一步都是"累加"的：第 k 步 = 前 k 步的所有东西 + 这一步新加的那一层。
 * 每步都写着依据的帖子原文、代码位置，▶ 播放原片（gifs/<id>.mp4，start.sh 会把视频目录链接过来）。
 */

const STEPS = [
  {
    title: '网格', lane: '共享底座', color: '#2f7f8a',
    id: '1147881669350891521', id2: '1447494168448753667',
    quote: 'Fairly even irregular quads grid in a hex',
    quote2: 'a mix of triangular and square tiles',
    what: '六边形里的三角点阵 → 两两合并 → （四边形网格再细分）→ 松弛。左上角可以切换"四边形 / 三角 + 方格"两种网格，后面所有步骤都在同一张网格上跑。',
    code: 'src/core/grid.js · buildQuadGrid() / buildMixedGrid()',
    scene: 'empty', toggles: { grid: true, smooth: false },
  },
  {
    title: '体素：地形高度场', lane: '地形管线', color: '#4f7fb8',
    id: '1447488323845509121',
    quote: 'Properly combine seamless soft slopes with distinct sharp cliffs',
    what: '扭曲 fbm + 脊线噪声 → 偶数层量化 → 塔柱 → 峡谷 → 河流（深度优先下山）→ 洞窟。写进 World 的 rock 位：这时候还是一级级方块台阶。',
    code: 'src/terrain/generate.js · generateTerrain() → src/core/world.js',
    scene: 'fusion-terrain', toggles: { grid: true },
  },
  {
    title: '层级平滑 + 笼形变形', lane: '地形管线', color: '#4f7fb8',
    id: '1670720537662836736', id2: '1579478470098243584',
    quote: 'Verts only get to pull at equal or lower order verts, and only along the appropriate edges',
    what: '每个高度切面上：钉住 > 崖顶线 > 崖脚线 > 内部，轮廓只沿自己的边平滑（不缩），崖顶内收、崖壁扭动；沉积线按世界空间噪声起伏；软法线让弯崖壁变圆。',
    code: 'src/terrain/shape.js · shapeTerrain() + terrainmesh.js + meshwriter.js（soft）',
    scene: 'fusion-terrain', toggles: { grid: false, smooth: true },
  },
  {
    title: '光照烘焙：分层 AO + 彩色反弹', lane: '共享底座 · 光照', color: '#c99a2e',
    id: '1168571866405097472', id2: '1237305125070426112',
    quote: 'occlusion lives in a layered mesh … blurred, sampled in the vertex shader',
    what: '每层一张占用图 → 盒式模糊 → 每个顶点沿法线外移一点采样：缝里变暗、墙角染上邻居的颜色。再加上太阳投影。',
    code: 'src/light/bake.js · bakeLighting()（分块增量，见 world/worldmesh.js）',
    scene: 'fusion-terrain', toggles: { ao: true, shadows: true },
  },
  {
    title: '房子拼进地形', lane: '融合', color: '#7b5fb0',
    id: '1584623053061099520', id2: '1197909675443916803',
    quote: 'I wrote a thing to splice houses into the terrain',
    what: '同一座岛（同一个种子）：台地上的排屋、海湾里长出来的码头、跨峡谷的拱、水里的高脚屋。建筑管线写 World 的非岩石位，和地形同一个顶点池、同一次烘焙。',
    code: 'src/world/scenes.js · generateFusion() + src/build/buildings.js',
    scene: 'fusion', toggles: {},
  },
  {
    title: '水层：岸浪', lane: '共享底座 · 水', color: '#3a8fa0',
    id: '1991101097818403263', id2: '1849732997945110651',
    quote: 'a looping vertex shader. The data is baked at generation-time',
    what: '从陆地边界描出岸线（黄线），在距离场上外推、平滑成蓝线；每个浪顶点烘焙"岸点、海点、时间偏移"，着色器里只推进时间。外加贴岸的浪裙。',
    code: 'src/water/shore.js · buildShore()',
    scene: 'fusion', toggles: { waves: true },
  },
  {
    title: '倒影', lane: '共享底座 · 水', color: '#3a8fa0',
    id: '1215644531221311488',
    quote: 'this somewhat abstract flat colored mid point',
    what: '整座岛沿水面镜像，颜色取"物体色与水色的中点"，随深度变淡、轻轻摆动。',
    code: 'src/world/view.js（reflection）',
    scene: 'fusion', toggles: { reflection: true },
  },
  {
    title: '墨线 + 逆光亮边', lane: '共享底座 · 光照', color: '#c99a2e',
    id: '1751945034851570056',
    quote: 'another inverted mesh outline layer that shows up when looking into the sun',
    what: '同一份几何画两层反向外壳：一条固定像素宽的墨线；镜头朝向太阳时，迎光一侧再多一道暖色亮边。',
    code: 'src/world/outline.js · OutlineLayers',
    scene: 'fusion', toggles: { outline: true, backlit: true },
  },
  {
    title: '植被：草丛 → 边缘灌木 → 树林', lane: '植被管线', color: '#5e8a4c',
    id: '1580158269267406849', id2: '1707490274425884929',
    quote: 'Can you make good looking foliage from Marching Cubes-blobs?',
    quote2: "I added back the lil' shrubbery at the edges of things",
    what: '落点全从 World + 地形形状算：草丛长在草 / 苔顶面上（坡上更密，崖边的有墨线），小花成簇，灌木沿崖顶线和墙根，林地里种"几团球融成"的树冠；灌木和树冠的轮廓按视角 × 叶片噪声镂空成叶状毛边；远处可切换成八方位 impostor，云和树共用 impostor。',
    code: 'src/life/vegetation.js · Vegetation.refresh(world, shape)',
    scene: 'fusion', toggles: { vegetation: true },
  },
  {
    title: '生命：海鸥', lane: '建筑管线 · 生命', color: '#d9663f',
    id: '1244892370392489989',
    quote: 'More bird shaped · Only has outlines when sitting · Shuffle about more · Has reflections · Flowier flight',
    what: '从屋脊顶点找栖位，成排停着（有描边、会挪步）；起飞 → 绕镇子流动地飞（扇翅 / 滑翔）→ 落回空栖位；水里有倒影。',
    code: 'src/life/birds.js · Birds',
    scene: 'fusion', toggles: { birds: true },
  },
  {
    title: '环境与生活：雾、阴云、旗子、彩旗绳、蝴蝶', lane: '环境 · 生命', color: '#3a8fa0',
    id: '906207980802252801', id2: '1259838941299183619',
    quote: 'For background effects, subtlety is key.',
    quote2: 'In code, these are called "Italian Wires"',
    what: '风场（Bad North：所有系统共用的风向，绕岛流动）驱动旗子、雪和云；岛外一圈淡雾、地平线阴云；高房子插旗，隔街拉彩旗绳；花园上空蝴蝶绕着花转。建造时还有水花和"弹出来"的动画（试着点一下）。',
    code: 'src/life/atmosphere.js · decor.js · effects.js',
    scene: 'fusion', toggles: { fog: true, moody: true, flags: true, wires: true, butterflies: true },
  },
  {
    title: '黄昏 → 夜里亮灯', lane: '共享底座 · 光照', color: '#c99a2e',
    id: '1313840428685447170',
    quote: 'sun + shadows; windows light up at night',
    what: '同一份烘焙结果，换太阳方向和颜色：黄昏侧光，夜里窗玻璃（逐顶点 aGlow）发光，倒影里也亮。整条管线到此走完。',
    code: 'src/world/view.js · setTimeOfDay()',
    scene: 'fusion', toggles: {}, time: 'dusk',
  },
];

const DEFAULTS = { grid: false, smooth: true, ao: true, shadows: true, waves: true, reflection: true, outline: true, backlit: true, birds: true, vegetation: true, flags: true, wires: true, butterflies: true, fog: false, moody: false };

export function mountWalkthrough({ view, world, loadSceneQuiet, getGridKind, onExit }) {
  const el = document.createElement('div');
  el.id = 'walk';
  el.className = 'panel hidden';
  document.body.appendChild(el);
  let k = 0, timer = null, sceneNow = null;

  // 第 k 步的状态 = 把前 k 步的开关依次叠上去
  const stateAt = (k) => {
    // 从"全关"开始，每一步只打开它自己那一层（例如海鸥要到第 10 步才出现）
    const t = Object.fromEntries(Object.keys(DEFAULTS).map((n) => [n, false]));
    for (let i = 0; i <= k; i++) Object.assign(t, STEPS[i].toggles);
    return t;
  };

  function apply() {
    const s = STEPS[k];
    if (s.scene !== sceneNow) {
      if (s.scene === 'empty') { world.reset(); view.changed(); }
      else loadSceneQuiet(s.scene);
      sceneNow = s.scene;
    }
    for (const [name, on] of Object.entries(stateAt(k))) view.setDebug(name, on);
    view.setTimeOfDay(s.time || 'day');
    window.dispatchEvent(new CustomEvent('debugsync'));
    render();
  }

  function render() {
    const s = STEPS[k];
    const clip = (id) => id ? `<button class="wk-play" data-id="${id}" title="播放原片 ${id}">▶</button>` : '';
    const grid = s.title === '网格' ? `<p class="wk-note">现在用的是：<b>${getGridKind() === 'mixed' ? '三角 + 方格（第三个项目）' : '四边形（Townscaper）'}</b></p>` : '';
    el.innerHTML = `
      <div class="wk-head">
        <span class="wk-step" style="background:${s.color}">${k + 1} / ${STEPS.length}</span>
        <span class="wk-lane">${s.lane}</span>
        <button class="wk-x" title="退出示例">✕</button>
      </div>
      <h3>${s.title}</h3>
      <blockquote>“${s.quote}” <span>${s.id}</span>${clip(s.id)}</blockquote>
      ${s.quote2 ? `<blockquote>“${s.quote2}” <span>${s.id2}</span>${clip(s.id2)}</blockquote>` : (s.id2 ? `<blockquote class="small"><span>另见 ${s.id2}</span>${clip(s.id2)}</blockquote>` : '')}
      <p>${s.what}</p>${grid}
      <code>${s.code}</code>
      <div class="wk-dots">${STEPS.map((x, i) => `<i class="${i === k ? 'on' : i < k ? 'past' : ''}" title="${x.title}" data-k="${i}"></i>`).join('')}</div>
      <div class="wk-nav">
        <button class="wk-prev" ${k === 0 ? 'disabled' : ''}>← 上一步</button>
        <button class="wk-auto">${timer ? '⏸ 暂停' : '⏵ 自动播放'}</button>
        <button class="wk-next">${k === STEPS.length - 1 ? '完成' : '下一步 →'}</button>
      </div>
      <video class="wk-video hidden" muted loop playsinline></video>`;
    el.querySelector('.wk-prev').onclick = () => go(k - 1);
    el.querySelector('.wk-next').onclick = () => (k === STEPS.length - 1 ? close() : go(k + 1));
    el.querySelector('.wk-x').onclick = close;
    el.querySelector('.wk-auto').onclick = () => (timer ? stop() : auto());
    el.querySelectorAll('.wk-dots i').forEach((d) => (d.onclick = () => go(+d.dataset.k)));
    el.querySelectorAll('.wk-play').forEach((b) => (b.onclick = () => {
      const v = el.querySelector('.wk-video');
      v.src = `gifs/${b.dataset.id}.mp4`;
      v.classList.remove('hidden');
      v.play().catch(() => {});
    }));
  }

  function go(i) { k = Math.max(0, Math.min(STEPS.length - 1, i)); apply(); }
  function auto() {
    stop();
    timer = setInterval(() => { if (k >= STEPS.length - 1) stop(); else go(k + 1); }, 4200);
    render();
  }
  function stop() { clearInterval(timer); timer = null; render(); }
  function open() { el.classList.remove('hidden'); sceneNow = null; go(0); }
  function close() {
    stop();
    el.classList.add('hidden');
    for (const [name, on] of Object.entries(DEFAULTS)) view.setDebug(name, on);
    view.setTimeOfDay('day');
    window.dispatchEvent(new CustomEvent('debugsync'));
    onExit?.();
  }
  return { open, close, steps: STEPS, go: (i) => go(i), get step() { return k; } };
}
