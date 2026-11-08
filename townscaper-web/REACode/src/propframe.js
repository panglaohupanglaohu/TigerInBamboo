/**
 * propframe.js — 道具"尽量放满且不重叠"，门窗"用标准局部框所以不跟着歪格歪"。
 *
 * 帖子 ID：1205416648397721601（2019-12-13，Bad North）
 *   "New prop placement system! It tries to place as many props as it can
 *    without overlap. I use it for doors and windows too, which means they are
 *    no longer skewed when placed on skewed tiles, which means skewed tiles now
 *    look less awkward."
 *   画面（6 帧，512²，纯蓝底）：中间一块**被拉斜的四边形格子**（不是矩形），
 *   右侧一列方块按钮（红/绿/青/黄四种道具类型 + 一个淡色箭头），光标在格子上点。
 *   前 3 帧格子只有描边，后 3 帧格子被填上淡色面 —— 就是"往格子里塞道具"的操作过程。
 *   信息全在原文两句里：① 道具是**贪心塞满、不允许重叠**；② 门窗不再用格子的
 *   斜基向量，而用**标准局部框**（正的），所以斜格看起来不别扭。
 *
 * 为什么要两套坐标系：
 *   斜格（不规则四边形）在等距视图里到处都是。门窗若跟着格子的 u/v 基向量走，
 *   矩形就被剪切成平行四边形：四个角不再是 90°，面积也被剪掉 |cos(格子夹角偏离)|，
 *   一排门看上去像集体倒向同一边 —— 这就是原文说的 "awkward"。
 *   位置仍取格子内的落脚点、朝向换成**标准局部框**（只有平移、没有剪切）之后，
 *   门框四角回到 90°，斜格变成"格子歪、道具正"。
 *
 * 本文件量三件事（都能算，不靠眼睛）：
 *   ① 塞满度：每格几只道具、覆盖率多少、重叠对数是不是 0；
 *   ② 框歪不歪：门窗四边形的四个内角与 90° 的最大偏差（local vs std）；
 *   ③ 面积误差：跟着斜基向量走的门窗被剪掉多少面积（= |cos(夹角−90°)|）。
 */

const HASH = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

export const CFG = {
  COLS: 4, ROWS: 3,
  TILE: 104,
  SKEW: 0.235,        // tan 量级 → 夹角约 ±13°
  JIT: 0.055,
  TRIES: 300,         // 每格撒点次数（贪心：放不下就丢，放得下就留）
  PAD: 2.5,
};

function tileCorners(i, j) {
  const { TILE, SKEW, JIT } = CFG;
  const ox = i * TILE, oy = j * TILE * 0.88;
  const s = (HASH(i * 31 + 7, j * 17 + 3) - 0.5) * 2 * SKEW;
  const jx = (HASH(i + 91, j + 13) - 0.5) * 2 * JIT * TILE;
  const jy = (HASH(i + 57, j + 71) - 0.5) * 2 * JIT * TILE;
  const O = { x: ox, y: oy };
  const u = { x: TILE + jx, y: jy * 0.35 };
  const v = { x: s * TILE, y: TILE * 0.88 };
  return { O, u, v, quad: [O, { x: O.x + u.x, y: O.y + u.y }, { x: O.x + u.x + v.x, y: O.y + u.y + v.y }, { x: O.x + v.x, y: O.y + v.y }] };
}

const distToEdges = (p, q) => {
  let mn = Infinity;
  for (let n = 0; n < 4; n++) {
    const a = q[n], b = q[(n + 1) % 4];
    const ex = b.x - a.x, ey = b.y - a.y;
    const L2 = ex * ex + ey * ey || 1;
    let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / L2;
    t = Math.max(0, Math.min(1, t));
    mn = Math.min(mn, Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t)));
  }
  return mn;
};

const polyArea = (q) => {
  let a = 0;
  for (let n = 0; n < q.length; n++) {
    const p = q[n], r = q[(n + 1) % q.length];
    a += p.x * r.y - r.x * p.y;
  }
  return Math.abs(a / 2);
};

/** 任意凸多边形 SAT */
function overlap(A, B) {
  for (const box of [A, B])
    for (let n = 0; n < box.length; n++) {
      const p = box[n], q = box[(n + 1) % box.length];
      const ex = q.x - p.x, ey = q.y - p.y;
      const L = Math.hypot(ex, ey) || 1;
      const nx = -ey / L, ny = ex / L;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const pt of A) { const d = pt.x * nx + pt.y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const pt of B) { const d = pt.x * nx + pt.y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 < b0 - 1e-9 || b1 < a0 - 1e-9) return false;
    }
  return true;
}

/** 四边形的内角最大偏差（矩形 0°；平行四边形 = 夹角偏离 90° 的两倍差值） */
function frameDev(q) {
  let worst = 0;
  for (let n = 0; n < 4; n++) {
    const a = q[n], b = q[(n + 1) % 4], d = q[(n + 3) % 4];
    const v1x = b.x - a.x, v1y = b.y - a.y, v2x = d.x - a.x, v2y = d.y - a.y;
    let ang = Math.abs(Math.atan2(v1y, v1x) - Math.atan2(v2y, v2x));
    if (ang > Math.PI) ang = 2 * Math.PI - ang;
    worst = Math.max(worst, Math.abs(90 - ang * 180 / Math.PI));
  }
  return worst;
}

/**
 * mode = 'local'：道具与门窗都沿格子 u/v 基向量铺（被剪切）
 * mode = 'std'  ：位置仍是格子里的落脚点，但形状用标准框（只有平移）
 */
export function build(mode = 'local', seed = 7) {
  const { COLS, ROWS, TILE, TRIES, PAD } = CFG;
  const tiles = [];
  let id = 0;

  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const T = tileCorners(i, j);
      const { O, u, v, quad } = T;
      const uLen = Math.hypot(u.x, u.y), vLen = Math.hypot(v.x, v.y);
      const ua = Math.atan2(u.y, u.x), va = Math.atan2(v.y, v.x);
      const angDeg = ((va - ua) * 180 / Math.PI + 360) % 180;
      const skewDeg = Math.abs(90 - Math.min(angDeg, 180 - angDeg));

      /** 在格子参数空间里做一个"框"：eu/ev 是沿 u、v 的半宽（单位=格子边长的比例） */
      const frame = (a, b, eu, ev) => {
        const cx = O.x + u.x * a + v.x * b;
        const cy = O.y + u.y * a + v.y * b;
        if (mode === 'local') {
          return [
            { x: cx - u.x * eu - v.x * ev, y: cy - u.y * eu - v.y * ev },
            { x: cx + u.x * eu - v.x * ev, y: cy + u.y * eu - v.y * ev },
            { x: cx + u.x * eu + v.x * ev, y: cy + u.y * eu + v.y * ev },
            { x: cx - u.x * eu + v.x * ev, y: cy - u.y * eu + v.y * ev },
          ];
        }
        // 标准框：尺寸取"沿 u 的边长 × 沿 v 的边长"，朝向固定（轴对齐）
        const hw = eu * uLen, hh = ev * vLen;
        return [
          { x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh },
          { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh },
        ];
      };

      const props = [];
      for (let t = 0; t < TRIES; t++) {
        const a = 0.10 + HASH(i * 101 + t, j * 211 + t * 3) * 0.80;
        const b = 0.10 + HASH(i * 313 + t * 7, j * 97 + t) * 0.80;
        const eu = 0.055 + HASH(i + t * 11, j + t * 5) * 0.045;
        const ev = 0.050 + HASH(i + t * 3, j + t * 13) * 0.045;
        const cx = O.x + u.x * a + v.x * b, cy = O.y + u.y * a + v.y * b;
        const rad = Math.max(eu * uLen, ev * vLen);
        if (distToEdges({ x: cx, y: cy }, quad) < rad + PAD) continue;
        const poly = frame(a, b, eu, ev);
        if (props.some((p) => overlap(p.poly, poly))) continue;
        props.push({ id: id++, poly, tile: [i, j], eu, ev });
      }

      // 门窗：取前两只最大的当门窗（原帖说门窗走同一套摆放系统）
      const win = props.slice().sort((p, q) => polyArea(q.poly) - polyArea(p.poly)).slice(0, 2);

      tiles.push({ i, j, quad, u, v, props, win, skewDeg, mode });
    }
  return { tiles, mode, seed };
}

/** 度量 */
export function measure(mode = 'local', seed = 7) {
  const W = build(mode, seed);
  const all = W.tiles.flatMap((t) => t.props);
  let propArea = 0, tileArea = 0, overlapPairs = 0, devs = [], areaRatio = [], sk = [];

  for (const t of W.tiles) {
    tileArea += polyArea(t.quad);
    sk.push(t.skewDeg);
    for (let n = 0; n < t.props.length; n++)
      for (let m = n + 1; m < t.props.length; m++)
        if (overlap(t.props[n].poly, t.props[m].poly)) overlapPairs++;
    for (const w of t.win) {
      devs.push(frameDev(w.poly));
      // 意图面积（沿 u/v 各 eu·|u|、ev·|v| 的正矩形） vs 实际面积
      const uLen = Math.hypot(t.u.x, t.u.y), vLen = Math.hypot(t.v.x, t.v.y);
      const want = (2 * w.eu * uLen) * (2 * w.ev * vLen);
      areaRatio.push(polyArea(w.poly) / want);
    }
  }
  for (const p of all) propArea += polyArea(p.poly);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

  return {
    mode,
    tiles: W.tiles.length,
    props: all.length,
    perTile: +(all.length / W.tiles.length).toFixed(1),
    coverage: +(propArea / tileArea * 100).toFixed(1),
    overlapPairs,
    frameDevMean: +mean(devs).toFixed(2),
    frameDevMax: +Math.max(...devs).toFixed(2),
    areaRatioMean: +mean(areaRatio).toFixed(3),
    areaRatioMin: +Math.min(...areaRatio).toFixed(3),
    skewMax: +Math.max(...sk).toFixed(1),
    skewMean: +mean(sk).toFixed(1),
    windows: devs.length,
  };
}
