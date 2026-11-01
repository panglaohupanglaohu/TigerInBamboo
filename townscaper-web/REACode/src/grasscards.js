/**
 * grasscards.js — 草卡片：把"细节频率"抬高一个数量级的那个做法。
 *
 * 1590669875869286400  "An early look at grass billboards. I really like how they add a
 *   completely new kind of shape and detail frequency."
 *
 * 1707490274425884929  "I added back the lil' shrubbery at the edges of things for like the 3rd time"
 *
 * ---- 画面观察（两张 24 帧总览，640²；把悬崖顶放大看） ----
 *   · 草不是铺满的，是**成丛**的：每一丛 5–12 片小卡，丛与丛之间留出裸地；
 *   · 边缘比中间密得多：台地边沿、崖肩、坡脚上都长，平台正中间反而是空的 ——
 *     这就是 1707490274425884929 说的 "at the edges of things"；
 *   · 卡片很窄很高（宽高比 ≈ 1:3），侧看会变薄到几乎消失，但不闪 ——
 *     所以是"按视角调 alpha"，不是"按视角剔除"（那条做法在 1205420678859632640 里写过）；
 *   · 颜色比地面亮一档、饱和一档，形状是**新的一档频率**：地面是中频色块，
 *     卡片是高频竖条，两者叠起来就有了"近看很细、远看很平"的读法。
 *
 * 这个文件只做**摆放 + 视角 alpha + 风摆**，不做几何细分（卡片是四边形，两三角）。
 * 贴图坐标那半截接 `src/quadtex.js`：每片卡片给一次随机偏移，别让二十片长得一模一样
 * （1015149712469524480 的读法，上一轮已落地）。
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 点是否在多边形内（与 src/town.js 的 pointInQuad 同一套判据，这里不 import 免得循环依赖）。 */
export function pointInPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * 每格"边上有落差"的边数 / 是否临水。
 * 这是 1707490274425884929 那句 "at the edges of things" 的判定：
 * 边 = 有邻居但邻居更矮，或者根本没有邻居（岛缘）。
 */
export function edgeInfo(town, grid) {
  const out = new Map();
  for (const cell of grid.cells) {
    const top = town.top(cell);
    const nbr = cell.edgeNeighbors || cell.nbr;
    if (!top || !nbr) continue;
    let drop = 0;
    let open = 0;
    for (let i = 0; i < nbr.length; i++) {
      const j = nbr[i];
      if (j < 0 || j === undefined) { open++; continue; }
      const nt = town.top(grid.cells[j]);
      if (nt < top) drop++;
    }
    out.set(cell.id, { top, drop, open, edge: drop + open });
  }
  return out;
}

/**
 * 摆卡片。两种来源：
 *   1. 沿边撒 —— 边上的卡（灌木 + 高草），概率 `edgeBias`
 *   2. 面内撒 —— 平台中间的矮草，概率 `innerBias`，但只长在"离边 ≥ 1 格"的格子上
 *
 * 之所以分成两种而不是一套均匀撒点：片子里边缘明显密、中间明显空，
 * 均匀撒出来是"草坪"，不是"野草"。
 */
export function placeCards(town, grid, {
  levelHeight = 1,
  seed = 1590669,
  perEdge = 4,
  perInner = 2,
  edgeBias = 0.85,
  innerBias = 0.35,
  bladeHeight = 0.34,
  bladeWidth = 0.11,
  shrubScale = 0.55,
} = {}) {
  const t0 = performance.now();
  const rnd = mulberry32(seed);
  const info = edgeInfo(town, grid);
  const cards = [];
  let cellsWithCards = 0;

  for (const cell of grid.cells) {
    const e = info.get(cell.id);
    if (!e) continue;
    const y = e.top * levelHeight;
    const pts = cell.pts;
    let n = 0;

    // 1) 沿边：每条"有落差/临空"的边撒 perEdge 张，位置贴着边线往内缩一点点
    const nbr = cell.edgeNeighbors || cell.nbr;
    for (let i = 0; i < pts.length; i++) {
      const j = nbr[i];
      const isEdge = j < 0 || j === undefined || town.top(grid.cells[j]) < e.top;
      if (!isEdge) continue;
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      for (let k = 0; k < perEdge; k++) {
        if (rnd() > edgeBias) continue;
        const f = 0.12 + 0.76 * ((k + rnd()) / perEdge);
        // 朝向 = 边线切线（草沿边生长，不是随机朝）→ 相机沿边看过去时才会变薄，
        // 随机会把这一信息平均掉：第一版就是这么写成随机的，俯仰角 10°~90° 的均值全是 0.83
        const tangent = Math.atan2(b.z - a.z, b.x - a.x);
        const px = a.x + (b.x - a.x) * f;
        const pz = a.z + (b.z - a.z) * f;
        // 往格内缩 8%~22%，避免卡片一半悬在崖外
        const inx = (cell.cx !== undefined ? cell.cx : (pts[0].x + pts[2].x) / 2) - px;
        const inz = (cell.cz !== undefined ? cell.cz : (pts[0].z + pts[2].z) / 2) - pz;
        const il = Math.hypot(inx, inz) || 1;
        const inset = 0.08 + 0.14 * rnd();
        cards.push({
          x: px + (inx / il) * inset,
          z: pz + (inz / il) * inset,
          y,
          h: bladeHeight * (0.55 + 0.75 * rnd()),
          w: bladeWidth * (0.7 + 0.6 * rnd()),
          rot: tangent + (rnd() - 0.5) * 0.6,
          phase: rnd() * Math.PI * 2,
          kind: rnd() < 0.45 ? 'shrub' : 'blade',
          scale: rnd() < 0.45 ? shrubScale * (0.75 + 0.5 * rnd()) : 1,
          uv: [rnd(), rnd()],
          cell: cell.id,
        });
        n++;
      }
    }

    // 2) 面内：只有"完全不长在边上"的格子才撒矮草
    if (e.edge === 0 && rnd() < innerBias) {
      for (let k = 0; k < perInner; k++) {
        let px = 0;
        let pz = 0;
        // 拒绝采样：落在格子外就重抽（最多 8 次）
        for (let tries = 0; tries < 8; tries++) {
          px = cell.cx + (rnd() - 0.5) * 0.8;
          pz = cell.cz + (rnd() - 0.5) * 0.8;
          if (pointInPoly(pts, px, pz)) break;
        }
        cards.push({
          x: px, z: pz, y,
          h: bladeHeight * 0.62 * (0.7 + 0.6 * rnd()),
          w: bladeWidth * 0.85,
          rot: rnd() * Math.PI,
          phase: rnd() * Math.PI * 2,
          kind: 'blade',
          scale: 1,
          uv: [rnd(), rnd()],
          cell: cell.id,
        });
        n++;
      }
    }
    if (n) cellsWithCards++;
  }

  const ms = performance.now() - t0;
  const byKind = { blade: 0, shrub: 0 };
  let area = 0;
  for (const c of cards) { byKind[c.kind]++; area += c.w * c.h * (c.kind === 'shrub' ? c.scale : 1); }
  const groundArea = [...info.values()].reduce((s, e) => s + 1, 0) * 0.18; // 每格约 0.18 世界面积（四边形的粗估）
  return {
    cards,
    stats: {
      cards: cards.length,
      blade: byKind.blade,
      shrub: byKind.shrub,
      cells: info.size,
      cellsWithCards,
      cellCoverage: info.size ? cellsWithCards / info.size : 0,
      cardArea: area,
      groundArea,
      ms,
    },
  };
}

/**
 * 视角 alpha：卡片越接近"正对相机"越实，越接近侧看越透。
 *
 * 用的是卡片法线（卡片平面朝向 rot 方向）与视线的关系，再乘一个 floor ——
 * 关键在**不要归零**：归零会闪（20 片卡一起消失/出现），片子里侧看只是变淡。
 * 1205420678859632640 那句 "alpha is view angle modulated by leaf texture mapped to a
 * sphere" 是同一件事的另一种做法（把视角映到球面再查叶子贴图），这里是解析式。
 */
/** 不设下限的原始视角因子：|dot(法线, 视线)|。侧看时就是 0 —— 硬剔除的判定用的就是它。 */
export function viewAlphaRaw(card, camDir) {
  const nx = Math.cos(card.rot);
  const nz = Math.sin(card.rot);
  return Math.abs(nx * camDir.x + nz * camDir.z);
}

export function viewAlpha(card, camDir, floor = 0.22) {
  // 卡片平面法线（绕 Y 转 rot）
  const nx = Math.cos(card.rot);
  const nz = Math.sin(card.rot);
  const d = Math.abs(nx * camDir.x + nz * camDir.z);
  return floor + (1 - floor) * Math.min(1, d * 1.6);
}

/** 风摆：整片卡绕根部转一个小角度，相位按卡片自己的 phase 错开。 */
export function swayAngle(card, t, wind = 0.55, speed = 1.6) {
  return Math.sin(t * speed + card.phase) * 0.22 * wind * (0.6 + 0.4 * Math.abs(Math.sin(card.phase * 3)));
}

/**
 * 一键体检：摆一遍 + 按 8 个方位角统计"侧看会淡到什么程度"。
 *
 * 为什么要按方位角扫而不是按俯仰：卡片的朝向跟着边线走，所以真正决定它变薄与否的
 * 是**相机绕岛转的角度**，不是俯仰。俯仰只影响卡片在屏幕上的投影高度（另算）。
 */
export function audit({ town, grid, levelHeight = 1, seed = 1590669, azimuths = 8 } = {}) {
  const t0 = performance.now();
  const placed = placeCards(town, grid, { levelHeight, seed });
  const rows = [];
  for (let a = 0; a < azimuths; a++) {
    const ang = (a / azimuths) * Math.PI * 2;
    const camDir = { x: Math.cos(ang), z: Math.sin(ang) };
    let sum = 0;
    let sumRaw = 0;
    let loRaw = 1;
    let culled = 0;
    for (const c of placed.cards) {
      sum += viewAlpha(c, camDir);
      const raw = viewAlphaRaw(c, camDir);
      sumRaw += raw;
      if (raw < loRaw) loRaw = raw;
      if (raw < 0.15) culled++;
    }
    const n = placed.cards.length || 1;
    rows.push({
      deg: Math.round((ang * 180) / Math.PI),
      mean: sum / n,
      meanRaw: sumRaw / n,
      minRaw: loRaw,
      // 换成"raw < 0.15 直接剔除"这种硬判定，会一次性消失多少片
      hardCull: culled,
      hardCullShare: culled / n,
    });
  }
  const anys = rows.map((r) => r.mean);
  const rawAnys = rows.map((r) => r.meanRaw);
  return {
    stats: placed.stats,
    alpha: rows,
    alphaSpread: Math.max(...anys) - Math.min(...anys),
    rawSpread: Math.max(...rawAnys) - Math.min(...rawAnys),
    cullShareRange: [
      Math.min(...rows.map((r) => r.hardCullShare)),
      Math.max(...rows.map((r) => r.hardCullShare)),
    ],
    totalMs: performance.now() - t0,
    triangles: placed.cards.length * 2,
  };
}
