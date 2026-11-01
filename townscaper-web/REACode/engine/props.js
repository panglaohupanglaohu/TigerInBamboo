/**
 * props.js — 墙面道具摆放（窗、门），**不重叠**、**不被格子压歪**，外加一个
 * stencil 打洞的材质对。
 *
 * 两条原文：
 *
 * (1) x.com/OskSta/status/1205416648397721601
 *   "New prop placement system! It tries to place as many props as it can without
 *    overlap. I use it for doors and windows too, which means they are no longer
 *    skewed when placed on skewed tiles, which means skewed tiles now look less
 *    awkward."
 *
 *   要点有两层：
 *     · 摆放 = 反复尝试（brute force attempts），撞到已有道具就丢，能塞多少塞多少；
 *       原文没提花哨的算法，就是"多试"。
 *     · 窗子**不能**在倾斜的瓦片上被拉歪。之前的做法（我们 roofs.js 的老代码就是这样）
 *       是沿墙边线性插值取两个参数 t1/t2 —— 墙是平行四边形时没问题，但网格是不规则
 *       四边形，两条边不等长、不平行的墙上，插值出来的"矩形"就变成梯形/菱形。
 *       正解：给每面墙建一套**正交基**（u = 沿墙水平方向，up = 世界 Y），道具在
 *       (u, up) 平面里是真正的矩形，再映回世界 —— 不管格子多歪，画出来都是正的。
 *
 *   画面（512²，24 帧）：小屋逐步长高，窗子一排排出现，大小不一但都**正**（水平边
 *   与墙顶平行、竖直边与重力平行），间距不重叠，最下面一格是一扇门。窗与窗之间
 *   留出砖缝宽度的空隙，说明摆放时有 margin。
 *
 * (2) x.com/OskSta/status/1205422438437273601
 *   "For doors and windows, I use som stencil buffer shenanigans to punch holes in
 *    the zbuffer. I admit it was a bit fiddly to figure out."
 *
 *   画面（512²，近景）：门不是贴在墙上的贴片，而是**墙上的一个洞**：能看到洞口
 *   四周的墙厚、退进去的门板、门槛，甚至洞口内壁的侧影。这只能靠"把墙在这一块
 *   抠掉"实现 —— 也就是 stencil：先用窗/门矩形写 stencil=1 且不写深度，
 *   再画墙时 `stencilFunc = NotEqual, ref = 1`，墙在那一块直接 discard。
 *   我们这边用 three.js 的 material.stencil* 做同样的事（见 makeHolePair）。
 */

import * as THREE from 'three';

/** 小而确定的 PRNG：同一个 seed 永远摆出同一套窗，方便前后对比截图。 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 墙的局部坐标系：u 沿墙（世界水平），v 沿重力。 */
export function wallFrame(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1e-4;
  const ux = dx / len;
  const uz = dz / len;
  // 外法线（指向远离格心的一侧；这里用右手系推）
  return {
    a, b, len,
    ux, uz,
    nx: uz, nz: -ux,
    /** (u, y) → 世界坐标。y 是世界高度，u 是墙上距离。 */
    at(u, y, out = 0) {
      return [a.x + ux * u + (0) * out, y, a.z + uz * u];
    },
  };
}

/** 矩形在世界里是"正"的：底边沿 u，侧边沿 Y。 */
export function rectCorners(frame, r, push = 0) {
  const u0 = r.u0, u1 = r.u1, y0 = r.y0, y1 = r.y1;
  const px = frame.nx * push;
  const pz = frame.nz * push;
  return [
    [frame.a.x + frame.ux * u0 + px, y0, frame.a.z + frame.uz * u0 + pz],
    [frame.a.x + frame.ux * u0 + px, y1, frame.a.z + frame.uz * u0 + pz],
    [frame.a.x + frame.ux * u1 + px, y1, frame.a.z + frame.uz * u1 + pz],
    [frame.a.x + frame.ux * u1 + px, y0, frame.a.z + frame.uz * u1 + pz],
  ];
}

// 规格是从参考片里量的：窗宽 ≈ 墙宽 1/6~1/4，窗高 ≈ 一个层高的 1/3~1/2，
// 一面墙 2~4 个，成排。第一版取得太大（0.17 宽），一面墙只塞得下一个。
const KINDS = [
  { kind: 'win', w: 0.13, h: 0.15 },
  { kind: 'win', w: 0.10, h: 0.12 },
  { kind: 'winWide', w: 0.20, h: 0.12 },
  { kind: 'winTall', w: 0.09, h: 0.18 },
];

/**
 * 在一面墙上尽量多地摆道具。
 *
 * @param frame  wallFrame()
 * @param yBase  墙脚世界高度
 * @param yTop   墙顶世界高度
 * @param opts   {seed, attempts, margin, door, doorWidth}
 * @returns 矩形数组 {kind, u0, u1, y0, y1}
 */
export function placeProps(frame, yBase, yTop, {
  seed = 1,
  attempts = 320,
  margin = 0.035,
  border = 0.04,
  door = true,
  doorWidth = 0.26,
  rowSnap = 0.05,
  // 窗的**密度**与**列对齐**（原文 1176516621223043073）：
  //   "Getting a feel for the style and density of windows. Here you can also see
  //    what I'm going for when different colors meet"
  //   画面里窗子是**成列**的：同一面墙上的窗左右对齐、间距由墙长决定，
  //   墙越长窗越多；而不是"随机撒最多 5 个"。所以这里改成
  //   "先按墙长定列数，再往列里塞窗"，密度 = 每世界单位多少列。
  density = 3.0,        // 每世界单位的目标列数（墙长 0.9 → 3 列）
  maxPerWall = 7,
} = {}) {
  const rnd = mulberry32(seed);
  const out = [];
  const H = yTop - yBase;
  if (H < 0.12 || frame.len < 0.14) return out;

  const overlaps = (r) => out.some((q) => (
    r.u1 + margin > q.u0 && r.u0 - margin < q.u1 &&
    r.y1 + margin > q.y0 && r.y0 - margin < q.y1
  ));

  // 门先放：门必须在墙脚，且要占掉一格，所以它优先（原文："I use it for doors
  // and windows too" —— 同一套系统，先来后到）
  if (door && H > 0.34 && frame.len > doorWidth + border * 2 + 0.1) {
    const w = Math.min(doorWidth, frame.len - border * 2 - 0.08);
    const u0 = border + (frame.len - w - border * 2) * (0.35 + rnd() * 0.2);
    out.push({ kind: 'door', u0, u1: u0 + w, y0: yBase, y1: yBase + Math.min(H * 0.62, 0.62) });
  }

  // 列网格：墙长决定列数（这就是"密度"），每列中心固定 → 窗自然左右对齐。
  // 随机只用来决定"这一列这一层放不放、放多高、放哪种窗"，不再决定左右位置。
  const usable = frame.len - border * 2;
  const cols = Math.max(1, Math.min(maxPerWall, Math.round(usable * density)));
  const colW = usable / cols;
  for (let c = 0; c < cols; c++) {
    // 有些列留空：全填满会变成"百叶窗"，参考片里也有空白墙段
    if (rnd() < 0.18) continue;
    const centre = border + (c + 0.5) * colW;
    // 只挑塞得进这一列宽度的窗型；都塞不进就跳过
    const fits = KINDS.filter((k) => k.w * 1.25 <= colW);
    if (!fits.length) continue;
    const k = fits[(rnd() * fits.length) | 0];
    const w = Math.min(colW * 0.86, k.w * (0.95 + rnd() * 0.2));
    const h = k.h * (0.9 + rnd() * 0.25);
    if (h > H - border * 2) continue;
    // 行对齐：y 吸附到粗网格，同一层的窗才会齐平
    const rowY = yBase + border + Math.round((rnd() * (H - h - border * 2)) / rowSnap) * rowSnap;
    const r = { kind: k.kind, u0: centre - w / 2, u1: centre + w / 2, y0: rowY, y1: rowY + h };
    if (overlaps(r)) continue;
    out.push(r);
  }
  // 兜底：一面墙上一个窗都放不下时，至少试着放一个小窗（否则整面白墙）
  if (out.length === 0 && H > 0.2 && usable > 0.08) {
    const w = Math.min(0.09, usable * 0.8);
    const h = Math.min(0.12, H * 0.5);
    out.push({ kind: 'win', u0: frame.len * 0.5 - w / 2, u1: frame.len * 0.5 + w / 2, y0: yBase + H * 0.45, y1: yBase + H * 0.45 + h });
  }
  return out;
}

/**
 * stencil 打洞的材质对（原文 1205422438437273601）。
 *
 * 用法：
 *   1. 先把抠洞件（窗/门矩形）的 mesh 用 `cutter` 材质、renderOrder 小、不写深度
 *      画一遍 —— 它只在 stencil buffer 里留下 ref=1 的记号；
 *   2. 墙用 `wall` 材质画：`stencilFunc = NotEqual 1`，凡是记号处直接 discard；
 *   3. 退进去的门板/玻璃用普通材质，放在洞口内侧，于是你能看见"墙厚"。
 *
 * 坑（原文说 "a bit fiddly"，实测确实）：
 *   · 抠洞件**不能**写深度，否则它自己会把里面的门板挡掉；
 *   · 抠洞件必须比墙早画（renderOrder 更小），但**不能**开 depthTest 之外的花样；
 *   · 墙材质要保证 depthWrite 正常，否则洞口后面什么都留不下。
 */
export function makeHolePair({ wallColor = 0xffffff, thickness = 0 } = {}) {
  const cutter = new THREE.MeshBasicMaterial({
    color: 0x000000,
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const wall = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.9,
    metalness: 0,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
  return { cutter, wall, thickness };
}
