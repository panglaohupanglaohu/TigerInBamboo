/**
 * 1310503825510367232「mixed perspective」
 *
 * 原文：「Ok, I tried the mixed perspective. Note how houses further away are smaller,
 * yet the vertical lines stay straight and parallel.」
 *
 * 机制：普通透视投影里，clip.w 来自视图空间的 -z，而俯视相机的 -z 会随世界高度 y 变化
 * （w 行的 y 系数 = -r21 ≠ 0）。同一根竖线的上下端点因此拿到不同的 w，屏幕 x 不同 → 竖线收敛。
 * 把 w 行的 y 系数按 k 衰减到 0，竖线两端 w 相同 → 屏幕 x 相同 → 竖线笔直平行；
 * 而 w 仍随水平距离增长 → 远处物体照旧变小。这就是"竖线平行 + 近大远小"的混合透视。
 *
 * pivotY 那一行保持原样，免得整幅画面上下平移。
 *
 * 本地实现，不等于原版 Unity 自定义投影矩阵 / 镜头移轴管线的逐像素结果；
 * 主视图（view.js）默认 k=0，行为与改动前一致。
 */

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** 列主序 4×4，与 three.Matrix4.elements 同序，可直接 fromArray 喂给渲染器。 */
export function perspectiveMatrix(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 与 three 的 lookAt 一致：z 轴由 target 指向 eye。 */
export function viewMatrix(eye, target, up = [0, 1, 0]) {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ];
}

export function multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let i = 0; i < 4; i++) s += a[i * 4 + r] * b[c * 4 + i];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function invert(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

/**
 * 核心：把视图投影矩阵 w 行的世界 y 系数按 k 衰减。
 * k=0 保留原透视；k=1 时 w 与世界上方向完全无关 → 竖线平行。
 * 以 pivotY 为基准行做补偿，保证该行的 w 不变。
 */
export function withVerticalParallel(viewProjection, k = 1, pivotY = 0) {
  const amount = clamp01(k);
  const m = viewProjection.slice();
  const wy = m[7]; // 行 3（w 行）、列 1（y 系数），列主序 index = 1*4+3
  m[7] = wy * (1 - amount);
  m[15] += amount * wy * pivotY;
  return m;
}

/** 世界点 → NDC；返回 null 表示落在相机后方或被裁掉。 */
export function projectPoint(m, x, y, z) {
  const px = m[0] * x + m[4] * y + m[8] * z + m[12];
  const py = m[1] * x + m[5] * y + m[9] * z + m[13];
  const pz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const pw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!Number.isFinite(pw) || Math.abs(pw) < 1e-9) return null;
  return { x: px / pw, y: py / pw, z: pz / pw, w: pw };
}

/**
 * 一根世界竖线（x,z 固定、y 从 yBottom 到 yTop）在屏幕上的收敛量。
 * driftNdc 是所有"竖线不平行"症状的统一度量：0 即笔直。
 */
export function verticalEdge(m, x, z, yBottom, yTop) {
  const bottom = projectPoint(m, x, yBottom, z);
  const top = projectPoint(m, x, yTop, z);
  if (!bottom || !top) return null;
  const driftNdc = Math.abs(top.x - bottom.x);
  return {
    bottomX: bottom.x,
    topX: top.x,
    bottomY: bottom.y,
    topY: top.y,
    driftNdc,
    heightNdc: Math.abs(top.y - bottom.y),
    // 上下两端点的 w 比 = 竖线被"透视挤压"的比例；k=1 时必然是 1
    endW: [bottom.w, top.w],
    wRatio: bottom.w === 0 ? Infinity : top.w / bottom.w,
  };
}

/** 一块竖直面板（中心 cx/z，半宽 halfWidth）在高度 y0 / y1 处的屏幕宽度。 */
export function quadWidths(m, cx, halfWidth, y0, y1, z = 0) {
  const widthsAt = (y) => {
    const l = projectPoint(m, cx - halfWidth, y, z);
    const r = projectPoint(m, cx + halfWidth, y, z);
    return l && r ? Math.abs(r.x - l.x) : null;
  };
  const bottom = widthsAt(y0);
  const top = widthsAt(y1);
  if (bottom === null || top === null) return null;
  return {
    bottom,
    top,
    // 上边比下边窄多少（%）；透视下 >0，竖线平行下 =0
    taperPct: bottom > 0 ? ((bottom - top) / bottom) * 100 : 0,
  };
}

/**
 * 一次算清楚"近大远小 + 竖线是否平行"：给相机和一组同尺寸竖直平面，
 * 返回每个距离的屏幕宽度、上边收窄率、以及面积占比。
 */
export function compareProjection({ eye, target, fov = 30, aspect = 1, near = 0.1, far = 500, k = 1, pivotY }) {
  const view = viewMatrix(eye, target);
  const proj = perspectiveMatrix(fov, aspect, near, far);
  const stock = multiply(proj, view);
  const mixed = withVerticalParallel(stock, k, pivotY ?? target[1]);
  return { stock, mixed, view, proj, k: clamp01(k) };
}

/** 渲染用：把混合后的视图投影矩阵折回 projectionMatrix（P' = M' · V⁻¹），供 three 直接使用。 */
export function projectionForRenderer(mixedViewProjection, view) {
  const inv = invert(view);
  return inv ? multiply(mixedViewProjection, inv) : null;
}
