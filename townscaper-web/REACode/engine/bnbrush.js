/**
 * bnbrush.js — Bad North 重建版用的两张"预烘图"，算法全部来自本仓库前面几轮。
 *
 * 为什么加这一层：第一版草面笔触是**在 fragment shader 里用 hash 撒点**，
 * 画出来像撒胡椒（点太小、太均匀、彼此独立），边缘能量只有参考帧的一半。
 * 参考帧的草是**方向性小划痕**，一片一片地叠，形状连续、有疏有密。
 * 所以改成在 CPU 上把几千个随机方向的小椭圆划痕光栅化进一张平铺图集，
 * 采样时再按尺度和密度调制 —— 这就是 blotch.js 那条"贴图化笔触"的思路，
 * 只是目标是划痕而不是团块。
 *
 * 第二张是"台地边缘距离场"。参考帧里草画到台地沿口就停，不会翻过崖沿；
 * 边缘那一圈还有一点点更亮/更干的过渡。第一版没有这个概念，笔触直接怼到
 * 几何边界上，近看很硬。做法和 blotch.js 的 96² chamfer 边缘场完全一样。
 */

const TAU = Math.PI * 2;

function mulberry(seed) {
  let s = (seed * 22695477 + 1) | 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
}

/**
 * 笔触图集：256² RGBA8，三通道各放一层不同尺度的划痕密度。
 *
 *   R —— 大划痕（长 ≈ 11px，宽 ≈ 3px），对应参考帧里最显眼的深色斑
 *   G —— 中划痕（长 ≈ 6px，宽 ≈ 2px），草面的主纹理
 *
 * 数量是量出来的：第一次 280 + 620 个，R 通道均值只有 0.02，铺到草面上是完全干净的；
 * 1500 + 2900 也只到 0.126 —— 而阈值化之后（smoothstep 0.28~0.52）就基本取不到值了，
 * 画面上依旧没有笔触。参考帧的草接近满铺，所以直接给到 4200 + 6200，
 * 最后定在 1300 + 2300：R 覆盖 ≈ 46%，阈值化以后大约 45% 的地面有笔触 ——
 * 再多就会叠成"迷彩斑块"，而参考帧的草是**稀疏但对比明确**的划痕。
 *   B —— 低频密度场（把几个大划痕糊开），用来做"一片实、一片稀"
 *
 * 画的时候**跨边界重复**（每个划痕在 x±size / y±size 各再画一遍），
 * 否则平铺接缝处会出现明显的空白带。
 */
export function buildBrushAtlas({ size = 256, seed = 7, counts = [700, 1250] } = {}) {
  const rnd = mulberry(seed);
  const data = new Uint8Array(size * size * 4);

  const splat = (cx, cy, ang, len, wid, amt, channel) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const a = len * 0.5, b = wid * 0.5;
    const r = Math.ceil(Math.max(a, b) + 1.5);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // 旋转到划痕本地坐标
        const lx = dx * ca + dy * sa;
        const ly = -dx * sa + dy * ca;
        const d = (lx * lx) / (a * a) + (ly * ly) / (b * b);
        if (d > 1) continue;
        // 两端收尖，但**不能太软**：第一版用 (1-d)² 做边，mip 一糊整片只剩下
        // 均匀的暗色（对比度掉到 3%），近看完全看不出是笔触。改成 1-d 的 0.4 次方，
        // 相当于"中心到边缘几乎一样实、最后一点才收"，更像钢笔划痕。
        const v = Math.round(amt * Math.pow(1 - d, 0.4) * 255);
        if (v <= 0) continue;
        // 跨边界重复：只有真的碰到边界才展开成 9 次写（否则 4200 个划痕太慢）
        //
        // 这里必须 Math.round：划痕中心是 rnd()*size（小数），不取整时
        // (Y*size+X)*4+channel 也是小数，而 **TypedArray 对非整数下标是静默丢弃**的
        // —— 结果整张图集几乎是空的（实测 R 通道 mean=0、max=0），
        // 画面上笔触一层都没有，却没有任何报错。
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        const oxs = px < 0 ? [0, size] : px >= size ? [0, -size] : [0];
        const oys = py < 0 ? [0, size] : py >= size ? [0, -size] : [0];
        for (const ox of oxs) {
          for (const oy of oys) {
            const X = ((px + ox) % size + size) % size;
            const Y = ((py + oy) % size + size) % size;
            const i = (Y * size + X) * 4 + channel;
            data[i] = Math.min(255, data[i] + v);
          }
        }
      }
    }
  };

  // R：大划痕
  for (let i = 0; i < counts[0]; i++) {
    splat(rnd() * size, rnd() * size, rnd() * TAU,
      9 + rnd() * 7, 2.4 + rnd() * 1.6, 0.55 + rnd() * 0.45, 0);
  }
  // G：中划痕
  for (let i = 0; i < counts[1]; i++) {
    splat(rnd() * size, rnd() * size, rnd() * TAU,
      4 + rnd() * 4, 1.3 + rnd() * 1.0, 0.35 + rnd() * 0.4, 1);
  }

  // B：低频密度场 —— 把 R 用 8 倍下采样再双线性放大，得到"一大片一大片"的疏密
  const half = size >> 3;
  const low = new Float32Array(half * half);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      low[((y >> 3) * half) + (x >> 3)] += data[(y * size + x) * 4] / 255;
    }
  }
  let mx = 0;
  for (let i = 0; i < low.length; i++) mx = Math.max(mx, low[i]);
  const gx = (u) => {
    const t = u * half - 0.5;
    const i0 = Math.floor(t), f = t - i0;
    return { i0: ((i0 % half) + half) % half, i1: ((i0 + 1) % half + half) % half, f };
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const { i0: x0, i1: x1, f: fx } = gx(x / size);
      const { i0: y0, i1: y1, f: fy } = gx(y / size);
      const a = low[y0 * half + x0] * (1 - fx) + low[y0 * half + x1] * fx;
      const b = low[y1 * half + x0] * (1 - fx) + low[y1 * half + x1] * fx;
      const v = (a * (1 - fy) + b * fy) / Math.max(mx, 1e-6);
      data[(y * size + x) * 4 + 2] = Math.round(Math.pow(v, 0.8) * 255);
    }
  }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  return { data, size };
}

/**
 * 台地边缘距离场：每个 texel 记录"到最近的高度突变处（台地沿口）的距离"。
 *
 * 用途：草笔触在沿口附近淡出 + 沿口一圈稍微提亮。参考帧里台地边缘是干净的一条，
 * 笔触不会翻过去 —— 这一条第一版根本没有，草直接怼到几何边界上。
 *
 * @returns {{data: Uint8Array, res: number, extent: number, max: number}} RGBA8，R=距离
 */
export function buildLedgeField({ grid, H, neighbour }, { res = 128, extent = 8.5, max = 1.2 } = {}) {
  const N = res;
  const step = (extent * 2) / N;
  const edge = new Uint8Array(N * N);

  // 把每条"高度不同"的格边画进栅格（画粗一点，保证连续）
  const plot = (x, z) => {
    const i = Math.round((x + extent) / step);
    const j = Math.round((z + extent) / step);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < N && jj < N) edge[jj * N + ii] = 1;
      }
    }
  };
  for (const cell of grid.cells) {
    if (H[cell.id] <= 0) continue;
    for (let i = 0; i < 4; i++) {
      const nb = neighbour(cell, i);
      if (nb >= 0 && H[nb] >= H[cell.id] - 1e-4) continue;
      const p0 = cell.pts[i], p1 = cell.pts[(i + 1) % 4];
      const steps = Math.max(2, Math.ceil(Math.hypot(p1.x - p0.x, p1.z - p0.z) / step));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        plot(p0.x + (p1.x - p0.x) * t, p0.z + (p1.z - p0.z) * t);
      }
    }
  }

  // 两遍 chamfer
  const INF = 1e9;
  const d = new Float32Array(N * N);
  for (let i = 0; i < d.length; i++) d[i] = edge[i] ? 0 : INF;
  const W = step, D = step * Math.SQRT2;
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], d[k - 1] + W, d[k - N] + W, d[k - N - 1] + D, d[k - N + 1] + D);
    }
  }
  for (let j = N - 2; j >= 1; j--) {
    for (let i = N - 2; i >= 1; i--) {
      const k = j * N + i;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], d[k + 1] + W, d[k + N] + W, d[k + N + 1] + D, d[k + N - 1] + D);
    }
  }

  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < d.length; i++) {
    const v = Math.round(Math.min(max, d[i]) / max * 255);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return { data, res: N, extent, max };
}
