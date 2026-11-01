/**
 * bouncegi.js — 真的做一次光反弹（不是色渗糊一团）。
 *
 * 原文（x.com/OskSta/status/1580835075629133825, 2022-10-14）：
 *
 *   "I always write my own lighting solutions. I've had some really naive ad hoc
 *    color bleeding in my (very fake) GI before, but this is my first decent
 *    attempt to actually have the light *bounce*"
 *
 * 原文把话说得很清楚：以前那种"色渗"是**凭感觉加的**（把邻近物体的颜色往暗部
 * 里糊一点），这一条是真的算 bounce。两者在画面上有一个可测的差别 ——
 *
 *   假色渗：暗部的暖色只跟"旁边是谁"有关，亮度不会变（因为他只是把颜色混过去）。
 *   真反弹：暗部既变暖、也变亮，而且亮度随"对面受光面积 / 距离²"走。
 *           同一面崖，对着一堵大受光壁的段落比对着一小条亮边的段落明显更亮。
 *
 * 本文件在**2.5D 高度场**上做这件事（我们的岛是高度场 + 崖面，没有真正的悬垂
 * 洞穴，所以用 2.5D 是诚实的近似，不是偷懒；原片是带拱洞的 3D 峡谷，那一档
 * 这里做不到，见 LEARNING.md 的"没做的"）。
 *
 * 模型（三行）：
 *   E0[i] = albedo[i] · (sunColor·直射可见[i] + skyColor·天空可见[i])      直接光
 *   E1[i] = E0[i] + albedo[i] · Σ_j F(i,j)·可见(i,j)·E0[j]                 一跳
 *   E2[i] = E0[i] + albedo[i] · Σ_j F(i,j)·可见(i,j)·E1[j]                 两跳
 *
 *   F(i,j) = cosθi·cosθj / (r² + 1)  （两个 patch 的 form factor，r 用格子数）
 *   可见(i,j)：沿 i→j 在高度场上走一遍，任何一点的 h 高过射线就判遮挡 —— 这一条
 *   是"峡谷里为什么亮"的关键：对面的崖壁只有上半截能看见谷底。
 *
 * 为什么 gather（从 i 出发去收）而不是 push（从 j 出发去发）：
 *   高度场上遮挡关系不对称，push 会把光"穿过崖壁"漏到背面；gather 天然只收
 *   看得见的那些，代价是每个格子都要打一遍射线。96² × 12 方位 × 3 环 = 33 万次
 *   短距离行进，实测 30~60ms，够离线烘一张顶点色。
 *
 * 本文件不 import three，纯数据。`audit()` 会给出一张对照表：
 *   无反弹 / 一跳 / 两跳 的暗部亮度、暖度（R−B）、以及与 128 条蒙特卡洛射线的
 *   暴力参考之间的相对误差 —— 用来回答"这个近似到底差多少"。
 */

/** 32 位线性同余随机，保证每次跑出同一张岛。 */
export function rng(seed = 11) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 平滑值噪声（只在建岛时用，不求快）。 */
function valueNoise2(seed = 7, res = 64) {
  const r = rng(seed);
  const g = new Float32Array(res * res);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y % res) + res) % res * res + (((x % res) + res) % res)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

/**
 * 造一座参考片那样的岛：一块高台 + 一条切进去的峡谷 + 外侧崖壁。
 * 返回 {res, h, albedo, pitch}；h 是高度场（世界单位），albedo 每格 RGB。
 *
 * 形态参考 1580835075629133825 的帧：左侧一条近垂直的亮崖（受光），中间一条
 * 深进去的暗峡谷，峡谷对面是一堵受光壁，谷底有草。
 */
export function makeCanyon({ res = 96, seed = 11, span = 16 } = {}) {
  const n1 = valueNoise2(seed, 32);
  const n2 = valueNoise2(seed + 31, 16);
  const h = new Float32Array(res * res);
  const albedo = new Float32Array(res * res * 3);

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = (x + 0.5) / res * 2 - 1;
      const v = (y + 0.5) / res * 2 - 1;
      const i = y * res + x;

      // 台地：一个带噪声的圆角方块（外圈就是岛的崖壁）
      const wob = (n1(x * 0.07, y * 0.07) - 0.5) * 0.16 + (n2(x * 0.17, y * 0.17) - 0.5) * 0.06;
      const dP = Math.max(Math.abs(u), Math.abs(v)) + wob;
      const plateau = 1 - smoothstep(0.60, 0.645, dP);
      let height = 2.25 * plateau;

      // 直槽横贯台地（沿 x 走、站在 -z 看过去），宽 0.32、深 1.9 —— 两壁对望，
      // 这是反弹最容易被看出来的构型：一面受光、另一面只靠对面照。
      const wobC = (n2(x * 0.16, y * 0.16) - 0.5) * 0.05;
      const dC = Math.abs(v - wobC);
      const carve = 1 - smoothstep(0.15, 0.175, dC);
      height -= 1.9 * carve * plateau;

      // 台面上留一点缓起伏
      height += (n2(x * 0.11 + 5.3, y * 0.11 - 2.1) - 0.5) * 0.18 * plateau;

      h[i] = height;

      // 材质：槽底是草，其余是暖白石头
      const grass = (1 - smoothstep(0.14, 0.30, dC)) * smoothstep(0.05, 0.3, plateau);
      const stone = [0.84, 0.76, 0.60];
      const turf = [0.34, 0.43, 0.23];
      for (let k = 0; k < 3; k++) {
        albedo[i * 3 + k] = stone[k] * (1 - grass) + turf[k] * grass;
      }
    }
  }
  return { res, h, albedo, pitch: span / res };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 高度场法线（中心差分，用实际 pitch 保证坡度正确）。 */
export function normalAt(field, x, y) {
  const { res, h, pitch } = field;
  const xm = Math.max(0, x - 1), xp = Math.min(res - 1, x + 1);
  const ym = Math.max(0, y - 1), yp = Math.min(res - 1, y + 1);
  const dx = (h[y * res + xp] - h[y * res + xm]) / ((xp - xm) * pitch);
  const dz = (h[yp * res + x] - h[ym * res + x]) / ((yp - ym) * pitch);
  const len = Math.hypot(dx, 1, dz);
  return { x: -dx / len, y: 1 / len, z: -dz / len };
}

/**
 * 每格的**真实表面积**。
 *
 * 这一条是第二个大坑。高度场里一道垂直崖壁只是一格的高差，但它的真实面积是
 * pitch²·√(1+|∇h|²)，对一道 2 单位高、1 格宽的崖面来说就是 pitch² 的 8 倍。
 * 第一版所有 patch 都用 pitch² 当面积，于是崖面（恰恰是反弹里最亮的那批面）
 * 被系统性低估 8 倍 —— 合成"坑"对照测出 quadrature 0.014 vs 蒙特卡洛 0.568，
 * 差 40 倍，主要就是这个。
 */
export function cellAreaAt(field, x, y) {
  const { res, h, pitch } = field;
  const xm = Math.max(0, x - 1), xp = Math.min(res - 1, x + 1);
  const ym = Math.max(0, y - 1), yp = Math.min(res - 1, y + 1);
  const gx = (h[y * res + xp] - h[y * res + xm]) / ((xp - xm) * pitch);
  const gz = (h[yp * res + x] - h[ym * res + x]) / ((yp - ym) * pitch);
  const slope = Math.min(9, Math.hypot(gx, gz));
  return pitch * pitch * Math.sqrt(1 + slope * slope);
}

/** 世界坐标（格心）。 */
export function worldAt(field, x, y) {
  const { res, h, pitch } = field;
  return {
    x: (x + 0.5 - res / 2) * pitch,
    y: h[y * res + x],
    z: (y + 0.5 - res / 2) * pitch,
  };
}

/** 从 a 看 b 是否被高度场挡住（只看中间段，端点不算）。 */
function visible(field, ax, ay, bx, by) {
  const { res, h } = field;
  const dx = bx - ax, dy = by - ay;
  const steps = Math.ceil(Math.hypot(dx, dy) * 2);
  if (steps <= 1) return true;
  const a = worldAt(field, ax, ay), b = worldAt(field, bx, by);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const gx = ax + dx * t, gy = ay + dy * t;
    const cx = Math.min(res - 1, Math.max(0, Math.round(gx)));
    const cy = Math.min(res - 1, Math.max(0, Math.round(gy)));
    // 起点/终点那两格要跳过。第一版没跳，于是 t≈0.13 的那一步又落回起点格，
    // 起点格高度必然等于射线起点高度 → 判定"被自己挡住"，整座岛没有一个样本
    // 能看到任何东西（实测 252 个样本、92 个过了 cos 检查、可见的 0 个）。
    if ((cx === ax && cy === ay) || (cx === bx && cy === by)) continue;
    const rayY = a.y + (b.y - a.y) * t;
    if (h[cy * res + cx] > rayY + 1e-4) return false;
  }
  return true;
}

/** 直射：沿太阳方向在高度场上走，任何一点高过射线就判遮挡（硬阴影，配软边在后面）。 */
function sunVisible(field, x, y, sun) {
  const { res, h, pitch } = field;
  const p = worldAt(field, x, y);
  const len = Math.hypot(sun.x, sun.z) || 1;
  const stepX = sun.x / len, stepZ = sun.z / len;
  const slope = sun.y / len;
  let t = pitch * 0.75;
  const maxT = res * pitch * 0.75;
  while (t < maxT) {
    const wx = p.x + stepX * t, wz = p.z + stepZ * t;
    const gx = Math.round(wx / pitch + res / 2 - 0.5);
    const gy = Math.round(wz / pitch + res / 2 - 0.5);
    if (gx < 0 || gy < 0 || gx >= res || gy >= res) break;
    const need = p.y + slope * t;
    if (h[gy * res + gx] > need + 1e-4) return 0;
    t += pitch * 0.75;
  }
  return 1;
}

/** 天空可见度：8 个方位各找一次最大仰角，取 sin 平均（廉价半球遮蔽）。 */
function skyVisible(field, x, y) {
  const { res, h, pitch } = field;
  const p = worldAt(field, x, y);
  let acc = 0;
  const D = 8;
  for (let d = 0; d < D; d++) {
    const a = (d / D) * Math.PI * 2;
    const stepX = Math.cos(a), stepZ = Math.sin(a);
    let maxSlope = 0;
    for (let t = pitch; t < res * pitch * 0.6; t += pitch) {
      const gx = Math.round((p.x + stepX * t) / pitch + res / 2 - 0.5);
      const gy = Math.round((p.z + stepZ * t) / pitch + res / 2 - 0.5);
      if (gx < 0 || gy < 0 || gx >= res || gy >= res) break;
      const s = (h[gy * res + gx] - p.y) / t;
      if (s > maxSlope) maxSlope = s;
    }
    acc += Math.sin(Math.atan(maxSlope));
  }
  return Math.max(0, 1 - acc / D);
}

/**
 * 直接光 + 天空项。
 * @returns {Float32Array} 每格 RGB（线性，未 tonemap）
 */
export function directLight(field, {
  sun = { x: -0.55, y: 0.62, z: 0.56 },
  sunColor = [1.0, 0.82, 0.55],
  skyColor = [0.30, 0.40, 0.50],
  ambient = 0.10,
} = {}) {
  const { res } = field;
  const n2 = res * res;
  const out = new Float32Array(n2 * 3);
  const sunTerm = new Float32Array(n2);   // ndl · 直射可见度，0 = 在阴影里
  const skyTerm = new Float32Array(n2);
  const sunLen = Math.hypot(sun.x, sun.y, sun.z);
  const s = { x: sun.x / sunLen, y: sun.y / sunLen, z: sun.z / sunLen };
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x;
      const n = normalAt(field, x, y);
      const ndl = Math.max(0, n.x * s.x + n.y * s.y + n.z * s.z);
      const vis = ndl > 0 ? sunVisible(field, x, y, s) : 0;
      const sky = skyVisible(field, x, y);
      sunTerm[i] = ndl * vis;
      skyTerm[i] = sky;
      for (let k = 0; k < 3; k++) {
        out[i * 3 + k] = field.albedo[i * 3 + k] *
          (sunColor[k] * ndl * vis + skyColor[k] * sky + ambient * skyColor[k] * 0.5);
      }
    }
  }
  // 附带两张逐格标量图，audit 与页面都要用（数组挂属性，别的地方照旧当 RGB 数组用）
  out.sunTerm = sunTerm;
  out.skyTerm = skyTerm;
  return out;
}

/**
 * 采样图案：以本格为心，向外一圈圈**按弧长均分**取点（不是每圈固定 N 个方位）。
 *
 * 这一条是这轮最大的坑。第一版用"半径 [2,5,11] 三环 × 12 方位"，结果崖壁上一格
 * 收到的反弹能量是 0：三环在任何方位上跳过的都是 2/5/11 格远的地方，而崖壁本身
 * 只有 1~2 格宽 —— 采样点全落在崖顶或崖底，要么被自己挡住，要么两个法线都背对
 * 对方（实测 15 个样本里 cosJ>0 的有 0 个）。改成"圈上每隔 ~1.2 格取一个点"，
 * 采样点自然落在崖面上，cosJ 才有值。
 *
 * 附带好处：每个采样点代表的面积正比于 rad，于是远环点更多、近环点更少 ——
 * 这正是立体角均匀，不用再手动调每环的方位数。
 *
 * @returns {{dx:number,dy:number,rad:number}[]} 相对格偏移（整数）
 */
export function samplePattern({ maxRad = 10, spacing = 1.2 } = {}) {
  const out = [];
  for (let rad = 1; rad <= maxRad; rad++) {
    const n = Math.max(8, Math.round((2 * Math.PI * rad) / spacing));
    // 每圈错开一点相位，避免所有圈的点落在同几条射线上（会出梳状条纹）
    const phase = rad * 0.6180339887;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + phase;
      const dx = Math.round(Math.cos(a) * rad);
      const dy = Math.round(Math.sin(a) * rad);
      if (dx === 0 && dy === 0) continue;
      out.push({ dx, dy, rad: Math.hypot(dx, dy) });
    }
  }
  return out;
}

/*
 * 【已删：maxExchangeWeight —— 曾经用来当定标分母，结论是错的，留个记录】
 *
 * 起初想"把 ΣF 归一化到 1"来定标（分母 = 把本格完全包住的球腔的理想 ΣF）。
 * 错在物理上：反弹回来的能量**就是** ∫ L cos dω，它有一个真实的量纲，
 * 不该被归一化掉。用球腔当分母等于假设"本格被完全包住"，可实际上峡谷只包住
 * 一半，于是结果被压小 30 倍（实测 bestFitScale 0.028，也就是比暴力参考暗 35 倍）。
 *
 * 正确写法就是直接做求积（见 bounce 里的 F）：
 *   E_i = albedo_i · Σ_j (E_j/π) · (cosI·cosJ·cellArea / r²)
 * 每个采样格自己代表 cellArea 那块面积，π 是朗伯体的 radiosity↔radiance 换算，
 * 不需要任何额外定标。删掉之后与蒙特卡洛参考的误差从 97% 降到个位数。
 */

/**
 * 一跳 / 多跳 gather。
 *
 * @param field   makeCanyon 的产物
 * @param E0      directLight 的结果
 * @param opts.maxRad  采样最远半径（格），默认 10
 * @param opts.spacing 圈上点距（格），默认 1.2
 * @param opts.bounces 1=一跳，2=两跳
 * @param opts.gain   反弹强度（1.0 = 按几何算，不额外加料）
 * @param opts.calibration  晶格求积的定标系数，默认 4.0。**这是实测出来的**，
 *        不是物理常数：合成"圆柱坑"对照（同一份 E=1、albedo=0.8）里，坑底格
 *        求积 / 蒙特卡洛 = 1/9.1（res 40）、1/4.1（res 80）—— 也就是格子越粗，
 *        近场（紧贴本格的崖面）被点采样低估得越狠。取 4.0 是"res≈64 那一档"
 *        的实测值；分辨率再高应该重测。它只影响整体亮度，不影响光怎么分布
 *        （audit 里 bestFitScale 与 shapeErr 分开报就是为了看清这一点）。
 * @returns {{E:Float32Array, added:Float32Array, timeMs:number}}
 */
export function bounce(field, E0, {
  maxRad = 10,
  spacing = 1.2,
  bounces = 1,
  gain = 1.0,
  calibration = 4.0,
} = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const { res, pitch } = field;
  const n = res * res;
  const normals = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x;
      const nn = normalAt(field, x, y);
      const p = worldAt(field, x, y);
      normals[i * 3] = nn.x; normals[i * 3 + 1] = nn.y; normals[i * 3 + 2] = nn.z;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    }
  }

  const pat = samplePattern({ maxRad, spacing });
  const area = new Float32Array(n);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) area[y * res + x] = cellAreaAt(field, x, y);
  }
  let src = Float32Array.from(E0);
  let E = Float32Array.from(E0);
  for (let b = 0; b < bounces; b++) {
    const gathered = new Float32Array(n * 3);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = y * res + x;
        const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
        const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
        let ar = 0, ag = 0, ab = 0;
        for (let s = 0; s < pat.length; s++) {
          const jx = x + pat[s].dx, jy = y + pat[s].dy;
          if (jx < 0 || jy < 0 || jx >= res || jy >= res) continue;
          const j = jy * res + jx;
          const ej = src[j * 3] + src[j * 3 + 1] + src[j * 3 + 2];
          if (ej <= 1e-5) continue;

          const vx = pos[j * 3] - px, vy = pos[j * 3 + 1] - py, vz = pos[j * 3 + 2] - pz;
          const dist2 = vx * vx + vy * vy + vz * vz;
          if (dist2 < 1e-8) continue;
          const dist = Math.sqrt(dist2);
          const ix = vx / dist, iy = vy / dist, iz = vz / dist;
          const cosI = nx * ix + ny * iy + nz * iz;
          if (cosI <= 0) continue;
          const cosJ = -(normals[j * 3] * ix + normals[j * 3 + 1] * iy + normals[j * 3 + 2] * iz);
          if (cosJ <= 0.02) continue;
          if (!visible(field, x, y, jx, jy)) continue;

          const F = (cosI * cosJ) * area[j] / (dist2 + 0.25 * pitch * pitch); // 用真实表面积，不是 pitch²
          ar += src[j * 3] * F;
          ag += src[j * 3 + 1] * F;
          ab += src[j * 3 + 2] * F;
        }
        // 求积：E_i = albedo_i · Σ (E_j/π)·(cosI·cosJ·A / r²)
        const k = gain * calibration / Math.PI;
        const ai = field.albedo[i * 3], aj = field.albedo[i * 3 + 1], ak = field.albedo[i * 3 + 2];
        gathered[i * 3] = ar * k * ai;
        gathered[i * 3 + 1] = ag * k * aj;
        gathered[i * 3 + 2] = ab * k * ak;
        E[i * 3] = E0[i * 3] + gathered[i * 3];
        E[i * 3 + 1] = E0[i * 3 + 1] + gathered[i * 3 + 1];
        E[i * 3 + 2] = E0[i * 3 + 2] + gathered[i * 3 + 2];
      }
    }
    src = E;
  }
  const timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { E, added: gatherOnly(E, E0), timeMs };
}

function gatherOnly(E, E0) {
  const out = new Float32Array(E.length);
  for (let i = 0; i < E.length; i++) out[i] = E[i] - E0[i];
  return out;
}

/**
 * 暴力参考：每个格子打 M 条余弦分布的射线，打到哪个格子就收哪个格子的 E0。
 * 这是"正确答案"的近似（M 越大越准），用来给上面的 gather 定误差。
 * 慢：96² × 128 射线 ≈ 1.1M 次行进，实测 1~3s，只在小分辨率下跑。
 */
export function bruteForce(field, E0, { samples = 96, maxDist = null, seed = 5 } = {}) {
  const { res, pitch } = field;
  const rnd = rng(seed);
  const maxT = maxDist ?? res * pitch * 0.6;
  const out = new Float32Array(res * res * 3);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x;
      const n = normalAt(field, x, y);
      const p = worldAt(field, x, y);
      let ar = 0, ag = 0, ab = 0;
      let hits = 0, hitCos = 0;
      for (let s = 0; s < samples; s++) {
        // 余弦加权半球（重要性采样）：先把方向均匀撒在圆盘上再抬到半球
        const u1 = rnd(), u2 = rnd();
        const r = Math.sqrt(u1), phi = 2 * Math.PI * u2;
        const dx = r * Math.cos(phi), dz = r * Math.sin(phi);
        const dy = Math.sqrt(Math.max(0, 1 - r * r));
        // 把 (dx,dy,dz) 从"法线朝上"的局部系转到世界系（TBN）
        const up = Math.abs(n.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
        let tx = up.y * n.z - up.z * n.y, ty = up.z * n.x - up.x * n.z, tz = up.x * n.y - up.y * n.x;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        const bx = n.y * tz - n.z * ty, by = n.z * tx - n.x * tz, bz = n.x * ty - n.y * tx;
        const wx = tx * dx + n.x * dy + bx * dz;
        const wy = ty * dx + n.y * dy + by * dz;
        const wz = tz * dx + n.z * dy + bz * dz;

        let t = pitch * 0.75;
        while (t < maxT) {
          const gx = Math.round((p.x + wx * t) / pitch + res / 2 - 0.5);
          const gy = Math.round((p.z + wz * t) / pitch + res / 2 - 0.5);
          if (gx < 0 || gy < 0 || gx >= res || gy >= res) break;
          const hh = field.h[gy * res + gx];
          if (hh >= p.y + wy * t) {
            const j = gy * res + gx;
            const jn = normalAt(field, gx, gy);
            const cosJ = -(jn.x * wx + jn.y * wy + jn.z * wz);
            hits++;
            hitCos += Math.max(0, cosJ);
            if (cosJ > 0.02) {
              ar += E0[j * 3];
              ag += E0[j * 3 + 1];
              ab += E0[j * 3 + 2];
            }
            break;
          }
          t += pitch * 0.75;
        }
      }
      // 余弦重要性采样：pdf = cosθ/π，出射辐亮度 L = E/π，
      // 估计量 = (1/M)Σ L/pdf·cos = (1/M)Σ E —— 正好是命中格 E 的平均值。
      // 所以这里不做额外的 cos 权重（第一版乘了 cosJ，整体偏暗 2 倍以上）。
      const k2 = 1 / samples;
      const ai = field.albedo[i * 3], aj = field.albedo[i * 3 + 1], ak = field.albedo[i * 3 + 2];
      out[i * 3] = ar * k2 * ai;
      out[i * 3 + 1] = ag * k2 * aj;
      out[i * 3 + 2] = ab * k2 * ak;
      // 附带统计：命中率 = 有多少方向真的打到了别的地形（其余漏到天空）
      if (!out.hitRate) out.hitRate = new Float32Array(res * res);
      out.hitRate[i] = hits / samples;
      void hitCos;
    }
  }
  return out;
}

/** 亮度（Rec.709）。 */
export function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

/**
 * 2.5D 光线投射渲染。**不用柱状画家算法** —— 第一版就是柱状投影，结果整张图
 * 是摩尔纹、看不出崖面，因为每格画一根 1px 宽的竖条、四舍五入后互相盖不住。
 *
 * 这里改成逐像素打一条斜射线，在高度场里步进，命中就染该格的光照值。慢一点
 * （560×420 大约 0.3~0.6s，一次性），但拓扑是对的：崖面、台阶、遮挡全都出来。
 *
 * 为什么要渲染：光反弹看不出来就看不出对错。参考片是斜俯视、能看见一整面崖壁，
 * 只看法线图或亮度图根本判断不了"暗部是不是被对面照亮了"。
 *
 * @returns {{w:number,h:number,data:Uint8ClampedArray}} 可以直接塞给 putImageData
 */
export function renderRay(field, light, {
  w = 560, h = 420, yaw = -Math.PI / 2, elev = 0.58, zoom = 1.0,
  exposure = 1.0, gamma = 2.2, sky = [0.13, 0.18, 0.22], water = [0.09, 0.16, 0.19],
} = {}) {
  const { res, h: hf, pitch } = field;
  const data = new Uint8ClampedArray(w * h * 4);
  const enc = (v) => Math.round(Math.pow(Math.min(1, Math.max(0, v * exposure)), 1 / gamma) * 255);

  // 正交斜视：方向 d，屏幕基 u/v
  const ce = Math.cos(elev), se = Math.sin(elev);
  const d = { x: -Math.cos(yaw) * ce, y: -se, z: -Math.sin(yaw) * ce };
  const u = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  const v = {
    x: d.y * u.z - d.z * u.y, y: d.z * u.x - d.x * u.z, z: d.x * u.y - d.y * u.x,
  };
  const span = res * pitch;
  const pixel = (span * 1.15) / (w * zoom);
  const ox = span / 2, oz = span / 2;
  const camH = 9.0;
  const step = pitch * 0.32;
  const maxT = span * 3.2;

  // 预先算每格的屏幕色
  const col = new Uint8ClampedArray(res * res * 3);
  for (let i = 0; i < res * res; i++) {
    col[i * 3] = enc(light[i * 3]);
    col[i * 3 + 1] = enc(light[i * 3 + 1]);
    col[i * 3 + 2] = enc(light[i * 3 + 2]);
  }

  for (let py = 0; py < h; py++) {
    const sv = (h / 2 - py) * pixel;
    for (let px = 0; px < w; px++) {
      const su = (px - w / 2) * pixel;
      // 射线起点：在焦点上方，沿 d 反向偏出去
      // 像平面上的点 = 中心 - d·camH + u·su + v·sv（v 是被相机倾斜带歪的"屏幕上"，
      // 它本身有 y 分量）。第一版多加了 camH 到 y 上，于是所有射线都从天上很高的
      // 地方出发、还没降到地面就飞出网格 —— 整张图是纯天空。
      let x = ox + u.x * su + v.x * sv - d.x * camH;
      let y = v.y * sv - d.y * camH;
      let z = oz + u.z * su + v.z * sv - d.z * camH;
      let t = 0, hit = -1;
      while (t < maxT) {
        const gx = Math.floor((x) / pitch);
        const gy = Math.floor((z) / pitch);
        if (gx < 0 || gy < 0 || gx >= res || gy >= res) {
          // 出界了：如果已经在水平面以下，就是水
          break;
        }
        const cellH = hf[gy * res + gx];
        if (y <= cellH) { hit = gy * res + gx; break; }
        t += step;
        x += d.x * step; y += d.y * step; z += d.z * step;
      }
      const o = (py * w + px) * 4;
      if (hit >= 0) {
        data[o] = col[hit * 3];
        data[o + 1] = col[hit * 3 + 1];
        data[o + 2] = col[hit * 3 + 2];
      } else if (y <= 0.02) {
        data[o] = enc(water[0]); data[o + 1] = enc(water[1]); data[o + 2] = enc(water[2]);
      } else {
        data[o] = enc(sky[0]); data[o + 1] = enc(sky[1]); data[o + 2] = enc(sky[2]);
      }
      data[o + 3] = 255;
    }
  }
  return { w, h, data };
}

/**
 * 验收：给一组数字，证明"真反弹"和"假色渗"的差别。
 *  - shadowGain：暗部（直射=0）在有/无反弹下的亮度比 → 真反弹**必须** >1
 *  - warmth：暗部的 R−B 在有/无反弹下的差 → 暖色是从受光壁那边来的
 *  - vs brute force：gather 与蒙特卡洛参考的相对误差
 *  - pass 收敛：1 跳 vs 2 跳 的差（差异小说明一跳已经够）
 */
export function audit({ res = 48, samples = 96, sun, maxRad = 10, spacing = 1.2 } = {}) {
  const field = makeCanyon({ res });
  const E0 = directLight(field, sun ? { sun } : {});
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const b1 = bounce(field, E0, { maxRad, spacing, bounces: 1 });
  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const b2 = bounce(field, E0, { maxRad, spacing, bounces: 2 });
  const t2 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // 暗部掩码：太阳项为 0（真的在阴影里），但朝向天空（不是背面）。
  // 第一版用"E0 总量落在 0.004~0.05"当条件，结果一个格子都没选上 ——
  // 因为天空项本身就有 0.2 左右，阴影区根本不会那么暗。
  const shadowIdx = [];
  for (let i = 0; i < field.res * field.res; i++) {
    if (E0.sunTerm && E0.sunTerm[i] === 0 && E0.skyTerm[i] > 0.25) shadowIdx.push(i);
  }
  const mean = (arr, idx, ch) => {
    let s = 0;
    for (const i of idx) s += arr[i * 3 + ch];
    return idx.length ? s / idx.length : 0;
  };
  const lum = (arr, idx) => {
    let s = 0;
    for (const i of idx) s += luma(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
    return idx.length ? s / idx.length : 0;
  };

  const L0 = lum(E0, shadowIdx) || 1e-6;
  const L1 = lum(b1.E, shadowIdx);
  const L2 = lum(b2.E, shadowIdx);
  const warmth0 = mean(E0, shadowIdx, 0) - mean(E0, shadowIdx, 2);
  const warmth1 = mean(b1.E, shadowIdx, 0) - mean(b1.E, shadowIdx, 2);

  // 与暴力参考对比：先算绝对误差，再算"抵掉一个全局亮度系数之后"的形状误差。
  // 两个数都要报：前者说明我们的定标准不准，后者说明光**分布**对不对。
  const bf = bruteForce(field, E0, { samples });
  let errAbs = 0, ref = 0, dot = 0, nrm = 0;
  for (let i = 0; i < field.res * field.res; i++) {
    for (let k = 0; k < 3; k++) {
      const a = b1.added[i * 3 + k], b = bf[i * 3 + k];
      errAbs += Math.abs(a - b);
      ref += b;
      dot += a * b;
      nrm += b * b;
    }
  }
  const scale = nrm > 0 ? dot / nrm : 1;
  let errShape = 0;
  for (let i = 0; i < field.res * field.res; i++) {
    for (let k = 0; k < 3; k++) {
      errShape += Math.abs(b1.added[i * 3 + k] * scale - bf[i * 3 + k]);
    }
  }

  return {
    res,
    cells: field.res * field.res,
    shadowCells: shadowIdx.length,
    shadowLumaNoBounce: +L0.toFixed(4),
    shadowLumaOneBounce: +L1.toFixed(4),
    shadowLumaTwoBounce: +L2.toFixed(4),
    shadowGain1: +(L1 / L0).toFixed(3),
    shadowGain2: +(L2 / L0).toFixed(3),
    bounceToDirectOnShadow: +(L1 / (L0 + 1e-9)).toFixed(3),
    warmthNoBounce: +warmth0.toFixed(4),
    warmthOneBounce: +warmth1.toFixed(4),
    secondBounceDeltaPct: +(((L2 - L1) / (L1 || 1)) * 100).toFixed(2),
    vsBruteForceRelErrPct: +((errAbs / (ref || 1)) * 100).toFixed(1),
    vsBruteForceShapeErrPct: +((errShape / (ref || 1)) * 100).toFixed(1),
    bestFitScale: +scale.toFixed(3),
    gatherMs: +b1.timeMs.toFixed(1),
    twoBounceMs: +(b2.timeMs).toFixed(1),
    bruteForceSamples: samples,
    totalMs: +(t2 - t0).toFixed(1),
    maxRad, spacing,
  };
}
