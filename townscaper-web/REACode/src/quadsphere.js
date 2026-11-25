/**
 * quadsphere.js — 把**整张四边形网格**铺到一个球面上（cube-sphere），
 * 而不是把一张平面地形贴在球面的经纬参数化上。
 *
 * 原文（1768627849529893109，2024-03-15）：
 *   "For reasons I will not be explaining at this point I've gone and put
 *    this on a sphere"
 *   —— 作者**故意不解释为什么**。所以这一条里能拿到的只有画面，
 *   算法是推断出来的，下面每一步都标了「量到的」还是「推断的」。
 *
 * 画面观察（640×640，6.87s，24 帧）：
 *   · 一座**长在球上**的岛：绿地 + 内陆湖（左下大片蓝、右下小湖），
 *     球外是均匀灰蓝背景 (116,149,162)。
 *   · 水面是**球面切片**，不是平面再投影：湖面没有任何明暗渐变，
 *     和陆地的受光方向一致 —— 水就贴着同一个球。
 *   · 轮廓半径 213–306 px（球心 (333,322)），中位 254。也就是地形起伏
 *     在 **−16% / +20% R** 之间，基准球 ≈254px。
 *   · 调色板（直接采样）：湖 (86,138,156)、深水青 (0,176,128)、
 *     陆地 (96,176,128)、背景 (116,149,162)。
 *   · **没有极点汇聚**：球顶/球底看不到经纬映射那种"格子收成一点"的扇面，
 *     绿色斑块的尺度在球顶和赤道差不多。这条是选 cube-sphere 而不是
 *     lat/lon 的唯一视觉依据（推断，不是量出来的）。
 *
 * 一条量不出结论的尝试（记下来省得下次再试）：
 *   想从轮廓的折线段反推格子数 —— 不行。轮廓断点间距 3°–98.5°，
 *   cv = 1.11，完全被地形起伏支配，跟细分无关。
 *   所以格子数只能选，不能量；这里用 12/面（6 面 × 12² = 864 格）。
 *
 * 为什么用 tan 变形：cube 直接归一化后，面角格子明显比面心大。n=12 实测
 * （distortionReport 现算，不是背书）：
 *   裸归一化：边长 max/min **2.0×**、面积 **4.26×**、最小格只到平均格的 **43.6%**
 *   过 tan(s·π/4)：边长 **1.41×**、面积 **1.32×**、最小格 **88.6%**
 * 对照经纬映射（rows=12, cols=24）：面积 7.7×、最小格 20.2%，而且极点边长
 * 直接收到 ~0（比值 1.6e16，等于除零）—— 这是 cube-sphere 唯一不可替代的理由。
 */

export const PALETTE = {
  bg: [116, 149, 162],
  lake: [86, 138, 156],
  deep: [0, 176, 128],
  land: [96, 176, 128],
  shore: [206, 196, 150],
};

// 6 个立方体面：(s,t) ∈ [-1,1]² → 立方体上的点（未归一化）。
// 顺序 +X −X +Y −Y +Z −Z，u/v 轴随便挑但要成右手系，否则法线会翻。
const CUBE_FACES = [
  (s, t) => [1, t, -s],
  (s, t) => [-1, t, s],
  (s, t) => [s, 1, -t],
  (s, t) => [s, -1, t],
  (s, t) => [s, t, 1],
  (s, t) => [-s, t, -1],
];

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** 面坐标 → 单位球点。warp=true 时先做 tan 变形（等面积近似）。 */
export function pointOnSphere(face, s, t, warp = true) {
  let ss = s, tt = t;
  if (warp) {
    ss = Math.tan((s * Math.PI) / 4);
    tt = Math.tan((t * Math.PI) / 4);
  }
  return norm(CUBE_FACES[face](ss, tt));
}

/** 对照用：经纬参数化。rows 行、cols 列，极点处格子宽度 → 0。 */
export function pointLatLon(i, j, rows, cols) {
  const lat = -Math.PI / 2 + (Math.PI * j) / rows;
  const lon = (2 * Math.PI * i) / cols;
  const cl = Math.cos(lat);
  return [cl * Math.cos(lon), Math.sin(lat), cl * Math.sin(lon)];
}

/** 生成一张 cube-sphere 网格：每面 n×n 个四边形。 */
export function buildSphereGrid({ n = 12, radius = 1, warp = true } = {}) {
  const quads = [];
  for (let f = 0; f < 6; f++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        // 顶点按 (i,j) 双线性取，邻居共享 → 面与面之间不会裂开
        const corner = (a, b) => pointOnSphere(f, -1 + (2 * a) / n, -1 + (2 * b) / n, warp);
        const c = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
        const mid = norm([
          (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4,
          (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4,
          (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4,
        ]);
        quads.push({
          face: f, i, j,
          corners: c.map((p) => [p[0] * radius, p[1] * radius, p[2] * radius]),
          center: [mid[0] * radius, mid[1] * radius, mid[2] * radius],
          normal: mid,
        });
      }
    }
  }
  return quads;
}

/** 球面三角形面积（单位球）—— 用 L'Huilier 公式，避免 acos 在小平面上掉精度。 */
function triArea(a, b, c) {
  const ang = (p, q) => Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const A = ang(b, c), B = ang(a, c), C = ang(a, b);
  const s = (A + B + C) / 2;
  const t = Math.tan(s / 2) * Math.tan((s - A) / 2) * Math.tan((s - B) / 2) * Math.tan((s - C) / 2);
  return 4 * Math.atan(Math.sqrt(Math.max(0, t)));
}

const chord = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * 畸变报告：两种参数化的边长比 / 面积比 / 最小格面积。
 * 这些数字是**跑出来的**，不是照抄的常数 —— lab 页读的就是这个函数。
 */
export function distortionReport({ n = 12, warp = true } = {}) {
  const quads = buildSphereGrid({ n, radius: 1, warp });
  let eMin = Infinity, eMax = 0, aMin = Infinity, aMax = 0, aSum = 0;
  for (const q of quads) {
    const [p0, p1, p2, p3] = q.corners;
    for (const [u, v] of [[p0, p1], [p1, p2], [p2, p3], [p3, p0]]) {
      const d = chord(u, v);
      eMin = Math.min(eMin, d); eMax = Math.max(eMax, d);
    }
    const a = triArea(p0, p1, p2) + triArea(p0, p2, p3);
    aMin = Math.min(aMin, a); aMax = Math.max(aMax, a); aSum += a;
  }
  return {
    edgeMin: eMin, edgeMax: eMax, edgeRatio: eMax / eMin,
    areaMin: aMin, areaMax: aMax, areaRatio: aMax / aMin,
    areaMean: aSum / quads.length,
    areaMinRel: aMin / (aSum / quads.length),
    quads: quads.length,
  };
}

/** 经纬映射的同一组数字（对照）。`cols = 2n` 让总格数接近 6n²。 */
export function latLonReport({ rows = 12, cols = 24 } = {}) {
  let eMin = Infinity, eMax = 0, aMin = Infinity, aMax = 0, aSum = 0, cnt = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = [
        pointLatLon(i, j, rows, cols),
        pointLatLon(i + 1, j, rows, cols),
        pointLatLon(i + 1, j + 1, rows, cols),
        pointLatLon(i, j + 1, rows, cols),
      ];
      for (const [u, v] of [[c[0], c[1]], [c[1], c[2]], [c[2], c[3]], [c[3], c[0]]]) {
        const d = chord(u, v);
        eMin = Math.min(eMin, d); eMax = Math.max(eMax, d);
      }
      const a = triArea(c[0], c[1], c[2]) + triArea(c[0], c[2], c[3]);
      aMin = Math.min(aMin, a); aMax = Math.max(aMax, a); aSum += a; cnt++;
    }
  }
  return {
    edgeMin: eMin, edgeMax: eMax, edgeRatio: eMax / eMin,
    areaMin: aMin, areaMax: aMax, areaRatio: aMax / aMin,
    areaMean: aSum / cnt, areaMinRel: aMin / (aSum / cnt), quads: cnt,
  };
}

/**
 * 把一维高度场（按格子索引取）贴到球面上 —— 这就是"整座岛长在球上"。
 * 半径直接乘，不做法线方向的额外偏移：片子里的湖面和陆地共用同一个球心，
 * 只是半径不同（量到的起伏 −16%/+20% R）。
 */
export function displace(quads, heightFn, baseRadius = 1) {
  return quads.map((q) => {
    const h = heightFn(q);
    const r = baseRadius * (1 + h);
    return {
      ...q,
      corners: q.corners.map((p) => {
        const n = norm(p);
        return [n[0] * r, n[1] * r, n[2] * r];
      }),
      center: (() => {
        const n = norm(q.center);
        return [n[0] * r, n[1] * r, n[2] * r];
      })(),
      height: h,
    };
  });
}

/** 片子里量到的地形起伏（相对半径）：基准球到最高点 +20%，最深 −16%。 */
export const RELIEF = { min: -0.16, max: 0.20, baseRadiusPx: 254, silhouettePx: [213, 306] };
