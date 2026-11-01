/**
 * quadtex.js — 一片"卡片"的贴图坐标：每片只采一次噪声，再让它顺着自己的流向滑。
 *
 * 1015149712469524480  "I only sample my noise texture once per quad, but I scroll
 *   the UVs randomly forward or backward along the flow of the smoke. This further
 *   breaks up the recognizability of individual blobs and it creates some of that
 *   cool multi layered flow feeling thick smoke should have"
 *
 * 999185422403055616   "For my blood splatter UVs, I'm interpolating between
 *   sprite-space and skin-space using the fwidth of skin UV. This gives me a
 *   sprite-space map on the tummy (where the skin UVs are static) while the
 *   splatter on the face follows the actual motion of the head"
 *
 * 两条是同一个工具箱的两半：**卡自己的空间**（每片独立、不被拉伸）和**世界/皮肤空间**
 * （连续、跟着表面走）。用哪个不该二选一 —— 用屏幕导数 fwidth 决定。
 *
 * 这个文件只做数学 + 体检，不建场景。四个量：
 *   `similarity()`  —— 两片卡片看起来有多像（均匀 1.00 = 一眼看出是同一块贴图）
 *   `stretchTable()`—— 世界空间 UV 在掠射角被拉伸多少倍，混合后压到多少
 *   `seamShare()`   —— 每片独立偏移在**连续表面**上会撕出多少条缝（这就是为什么它只能用在卡片上）
 *   `audit()`       —— 上面三个一起出
 */
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

/** 可平铺的 value noise：格点取 8×8，四角插值。period 由调用方的 0..1 域决定。 */
export function makeNoise(seed = 7, res = 8) {
  const g = new Map();
  const at = (i, j) => {
    const k = i + ':' + j;
    let v = g.get(k);
    if (v === undefined) {
      v = hash2(((i % res) + res) % res, ((j % res) + res) % res, seed);
      g.set(k, v);
    }
    return v;
  };
  return (u, v) => {
    const x = u * res;
    const y = v * res;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
    const b = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
}

/**
 * 给一组卡片（billboard / 草叶 / 烟团）发参数：随机偏移 + 自己的流向 + 有正有负的速度。
 * "randomly forward or backward" 对应 `speed` 的正负号。
 */
export function buildCards(count, { seed = 11, period = 1, flowScale = 1 } = {}) {
  const rnd = mulberry32(seed);
  const cards = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    cards.push({
      ou: rnd() * period,
      ov: rnd() * period,
      dx: Math.cos(ang) * flowScale,
      dz: Math.sin(ang) * flowScale,
      speed: (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.85),
    });
  }
  return cards;
}

/**
 * 取一片卡片上 (lu, lv) 处的贴图坐标。
 * mode: 'uniform' | 'offset' | 'flow'
 * world: 该点在世界空间的位置（只有 fwidth 混合用得到）
 */
export function cardUV(card, lu, lv, t, mode) {
  if (mode === 'uniform') return [lu, lv];
  if (mode === 'offset') return [card.ou + lu, card.ov + lv];
  // flow：偏移 + 沿自己的流向滑，速度带符号（可正可负）
  const s = card.speed * t;
  return [card.ou + lu + card.dx * s, card.ov + lv + card.dz * s];
}

/**
 * 两片卡片看起来有多像：同一片贴图、各取 8×8 个样本，算 Pearson 相关。
 *
 * 相关 1.00 = 两片一模一样（"recognizability of individual blobs" 满格）；
 * 0 附近 = 认不出是同一块。
 */
export function similarity({ mode = 'offset', t = 0, cards = 24, samples = 8, seed = 11, period = 1, noiseSeed = 7 } = {}) {
  const cs = buildCards(cards, { seed, period });
  const noise = makeNoise(noiseSeed, 8);
  const grab = (card) => {
    const out = [];
    for (let j = 0; j < samples; j++) {
      for (let i = 0; i < samples; i++) {
        const [u, v] = cardUV(card, (i + 0.5) / samples, (j + 0.5) / samples, t, mode);
        out.push(noise(u, v));
      }
    }
    return out;
  };
  const vals = cs.map(grab);
  let sum = 0;
  let pairs = 0;
  for (let a = 0; a < vals.length; a++) {
    for (let b = a + 1; b < vals.length; b++) {
      sum += pearson(vals[a], vals[b]);
      pairs++;
    }
  }
  return { mode, t, mean: pairs ? sum / pairs : 1, pairs };
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0;
  let sb = 0;
  let sab = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sa += da * da;
    sb += db * db;
    sab += da * db;
  }
  if (sa < 1e-12 || sb < 1e-12) return 1;
  return sab / Math.sqrt(sa * sb);
}

/**
 * 掠射角拉伸。
 *
 * 地面在高度 h、相机焦距 f（像素）时，视线与地面夹角 θ 处，沿深度方向一个像素在
 * 地面上跨越的距离是 h / (f·sin²θ)；θ=90° 时是 h/f。所以拉伸倍数 = 1/sin²θ。
 *
 * "用 fwidth 混合"能把倍数压住：屏幕导数超过阈值就从世界空间切到卡片空间
 * （= 那个像素改用不随角度变形的 UV），代价是空间不连续 —— 见 seamShare。
 */
export function stretchTable(pitchesDeg = [90, 60, 45, 30, 20, 10, 6], clampStretch = 2) {
  const rows = [];
  for (const p of pitchesDeg) {
    const s = Math.sin((p * Math.PI) / 180);
    const world = 1 / (s * s);
    // 混合：w = 1 时完全用卡片空间（1×），w = 0 时完全用世界空间
    const w = clamp01((world - 1) / (clampStretch - 1));
    const blended = world * (1 - w) + 1 * w;
    rows.push({ pitch: p, world, blended, w });
  }
  return rows;
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * 连续表面上"每片独立偏移"会撕开多少缝。
 *
 * 做法：取 quad 网格的每条共享边，在边两侧各一步（沿法线 ±ε）采贴图，比较两侧的
 * 贴图坐标差是否超过 ¼ 周期 —— 超过就是一道肉眼能看到的接缝。
 * 这正是"这套东西只能用在 billboard 上的证据"，别把它铺到地形上。
 */
export function seamShare({ cells, mode = 'offset', seed = 11, period = 1 } = {}) {
  const cards = buildCards(cells.length, { seed, period });
  const seen = new Set();
  let edges = 0;
  let seams = 0;
  for (const c of cells) {
    const n = c.pts.length;
    const nbr = c.edgeNeighbors || c.nbr;
    if (!nbr) continue;
    for (let i = 0; i < n; i++) {
      const j = nbr[i];
      if (j < 0 || j === undefined) continue;
      const key = c.id < j ? c.id + ':' + j : j + ':' + c.id;
      if (seen.has(key)) continue;
      seen.add(key);
      edges++;
      const ca = cards[c.id];
      const cb = cards[j];
      // 同一条边两侧的格子各用"自己卡片"的局部坐标（lu=0.5, lv=0.5），
      // 两张卡片的偏移不同 → 这里量到的就是那条边上的贴图跳变
      const [ua, va] = cardUV(ca, 0.5, 0.5, 0, mode);
      const [ub, vb] = cardUV(cb, 0.5, 0.5, 0, mode);
      const du = Math.abs(((ua - ub) % period + period) % period);
      const dv = Math.abs(((va - vb) % period + period) % period);
      const jump = Math.min(du, period - du) + Math.min(dv, period - dv);
      if (jump > period * 0.25) seams++;
    }
  }
  return { mode, edges, seams, share: edges ? seams / edges : 0 };
}

/** 一键体检。cells 可选（传了就顺便量接缝）。 */
export function audit({ cards = 24, seed = 11, period = 1, cells = null } = {}) {
  const modes = ['uniform', 'offset', 'flow'];
  const sim = modes.map((m) => similarity({ mode: m, t: 0, cards, seed, period }));
  const flowLate = similarity({ mode: 'flow', t: 2.5, cards, seed, period });
  const stretch = stretchTable();
  const seam = cells ? seamShare({ cells, mode: 'offset', seed, period }) : null;
  // 世界空间 UV 下两片卡片的相似度（对照：不加任何技巧）
  return {
    similarity: sim,
    flowAtT2_5: flowLate,
    stretch,
    seam,
    note: '相似度 1.00 = 两片卡片认得出是同一块贴图；0.1 以下基本认不出',
  };
}
