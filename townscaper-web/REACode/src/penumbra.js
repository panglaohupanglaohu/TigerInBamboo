/**
 * penumbra.js — 软阴影不靠模糊贴图，靠"同一份体素空间画三遍"
 *
 * 帖子 ID：1305951750638231552（2020-09-16）
 *   "To soften it up a bit, I'm trying out a penumbra approach where I draw the
 *    shadow thrice, once normal, once pulled in slightly and once with big
 *    voxels. I think I like it. (here, the shadow is shown d..."
 *
 * 帖子 ID：1313840428685447170（2020-09-19）
 *   "I added some sunlight (with shadows) and a gizmo to control it"
 *
 * 为什么这么做：原文那句 "draw the shadow thrice" 是理解这条片子的钥匙 —— 它不是
 * 后期高斯模糊一张 shadow map，而是**用三份不同分辨率的同一场景重复投一遍**：
 *
 *   ① normal      —— 全分辨率 voxel 高度场精确 march，影子边是硬的（核心暗部）
 *   ② pulled in   —— 同一份场，但遮挡门槛抬高 0.7 个体素，影子整体往里收一圈，
 *                    收掉的那一圈正好是"刚被挡住、几乎没被挡实"的部分
 *   ③ big voxels  —— 高度场按 3×3 max-pool 降成粗体素再 march，阴影轮廓变成台阶，
 *                    再按体素尺寸模糊一次 → 台阶糊成宽半影带
 *
 * 三者相乘（1-(1-a)(1-b)(1-c)）才是最后的影子：核心是①给的锐利，往外②给一圈窄过渡，
 * 最外③给宽而圆的收尾。半影宽度在这里由**体素尺寸**决定（3×3 max-pool 后只再模糊一格），
 * 所以它跟着世界尺度走、和分辨率/屏幕缩放无关 —— 这正是"用大 voxel 画"而不是
 * "对 shadow map 做屏幕空间高斯"的区别。
 *
 * 这里做的是俯视版：同一套逻辑放在 2D 高度场上，太阳方位可拖（gizmo）。
 * 验收看 #stats：penumbra 带 = 0.1<a<0.5 的格，带内平均宽度用"到最近硬阴影格的格距"量。
 */

export const NX = 88;
export const NY = 58;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash2(x, y, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 一座岛 + 五座塔：塔要够高，影子才会被拉长成能看出半影的形状。 */
export function buildWorld(seed = 7) {
  const hf = new Float32Array(NX * NY);
  const cx = NX * 0.5, cy = NY * 0.5;
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const dx = (x - cx) / (NX * 0.42);
      const dy = (y - cy) / (NY * 0.44);
      const r = Math.hypot(dx, dy) + (noise2(x * 0.09, y * 0.09, seed) - 0.5) * 0.3;
      let h = 2.3 * (1 - smoothstep(0.70, 1.0, r));
      if (h > 0.2) h += (noise2(x * 0.19 + 9, y * 0.19 + 3, seed) - 0.5) * 0.55;
      hf[y * NX + x] = Math.max(0, h);
    }
  }
  const towers = [
    [34, 26, 3.4, 6.0], [48, 22, 3.0, 4.6], [42, 35, 3.8, 3.2],
    [57, 32, 2.4, 5.2], [26, 33, 2.7, 3.8],
  ];
  for (const [tx, ty, rad, hh] of towers) {
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const d = Math.hypot(x - tx, y - ty);
        if (d < rad) {
          const k = 1 - smoothstep(rad - 1.0, rad, d);
          const i = y * NX + x;
          hf[i] = Math.max(hf[i], hh * k + 0.7);
        }
      }
    }
  }
  return { hf, nx: NX, ny: NY };
}

/**
 * 3×3 均值降采样：这就是 "big voxels" 那一遍用的粗高度场。
 * 注意**不能**用 max-pool —— 取最大等于把每格抬到邻居最高点，影子会整体胀大一圈，
 * 挡住的东西比实际多，看着就像画面蒙了层灰。
 */
export function coarsen(world, k = 3) {
  const nx = Math.ceil(world.nx / k), ny = Math.ceil(world.ny / k);
  const hf = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      let s = 0, n = 0;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const sx = x * k + i, sy = y * k + j;
          if (sx < world.nx && sy < world.ny) { s += world.hf[sy * world.nx + sx]; n++; }
        }
      }
      hf[y * nx + x] = n ? s / n : 0;
    }
  }
  return { hf, nx, ny, k };
}

function sample(hf, nx, ny, x, y) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= nx || yi >= ny) return -1;
  return hf[yi * nx + xi];
}

/**
 * 一份高度场 + 一个太阳方向 → 一张 0/1 阴影 mask。
 * bias 抬高遮挡门槛（视觉上等于把影子往遮挡物根部"收"一圈）；
 * 返回值带 depth：被这一步挡住的视线走了多远，用来算半影宽度。
 */
export function castShadow(world, azRad, opt = {}) {
  const tanE = opt.tanE ?? 0.72;
  const bias = opt.bias ?? 0;
  const step = opt.step ?? 0.5;
  const maxT = 46;
  const ux = Math.cos(azRad), uy = Math.sin(azRad);
  const { hf, nx, ny } = world;
  const mask = new Float32Array(nx * ny);
  const depth = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const hc = hf[y * nx + x];
      for (let t = 0.6; t < maxT; t += step) {
        const sx = x + ux * t, sy = y + uy * t;
        if (sx < 0 || sy < 0 || sx >= nx || sy >= ny) break;
        const hs = sample(hf, nx, ny, sx, sy);
        if (hs > hc + t * tanE + bias) {
          mask[y * nx + x] = 1;
          depth[y * nx + x] = t;
          break;
        }
      }
    }
  }
  return { mask, depth };
}

/** 圆形均值模糊（粗体素那一遍用，半径按粗格算）。 */
export function blurMask(mask, nx, ny, r) {
  const out = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      let s = 0, n = 0;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          const sx = x + i, sy = y + j;
          if (sx < 0 || sy < 0 || sx >= nx || sy >= ny) continue;
          if (i * i + j * j > r * r + 1) continue;
          s += mask[sy * nx + sx]; n++;
        }
      }
      out[y * nx + x] = n ? s / n : 0;
    }
  }
  return out;
}

/**
 * 到最近硬阴影格的棋盘距离（两遍 chamfer）。半影"有多宽"就用它量 ——
 * 拿 depth 量是错的：半影格本身没被挡住，depth 全是 0。
 */
export function distToMask(mask, nx, ny) {
  const d = new Float32Array(nx * ny);
  const INF = 1e9;
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) m = Math.min(m, d[i - nx] + 1);
      if (x > 0 && y > 0) m = Math.min(m, d[i - nx - 1] + 1.4);
      if (x < nx - 1 && y > 0) m = Math.min(m, d[i - nx + 1] + 1.4);
      d[i] = m;
    }
  }
  for (let y = ny - 1; y >= 0; y--) {
    for (let x = nx - 1; x >= 0; x--) {
      const i = y * nx + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x < nx - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < ny - 1) m = Math.min(m, d[i + nx] + 1);
      if (x < nx - 1 && y < ny - 1) m = Math.min(m, d[i + nx + 1] + 1.4);
      if (x > 0 && y < ny - 1) m = Math.min(m, d[i + nx - 1] + 1.4);
      d[i] = m;
    }
  }
  return d;
}

/**
 * 三遍合成。weights 是每一遍在最终遮挡里的最大贡献，顺序不能反：
 * normal 是核心，pulled 只补窄过渡，big 只补宽收尾。
 */
export function composite(world, azRad, opt = {}) {
  const tanE = opt.tanE ?? 0.52;
  const k = opt.coarse ?? 3;
  const hard = castShadow(world, azRad, { tanE, bias: 0 });
  const pulled = castShadow(world, azRad, { tanE, bias: 0.7 });
  const coarse = coarsen(world, k);
  const bigRaw = castShadow(coarse, azRad, { tanE, bias: 0, step: 0.6 });
  // 只模糊一格粗格：宁可窄，糊宽了整张地形会像蒙了层灰
  const bigBlur = blurMask(bigRaw.mask, coarse.nx, coarse.ny, 1);

  const { nx, ny } = world;
  const alpha = new Float32Array(nx * ny);
  const bigUp = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const cx = Math.min(coarse.nx - 1, Math.floor(x / k));
      const cy = Math.min(coarse.ny - 1, Math.floor(y / k));
      bigUp[y * nx + x] = bigBlur[cy * coarse.nx + cx];
    }
  }
  const dist = distToMask(hard.mask, nx, ny);
  let hardN = 0, pulledN = 0, bigN = 0, band = 0, bandWidth = 0;
  for (let i = 0; i < alpha.length; i++) {
    const a = hard.mask[i] * 0.80;
    const b = pulled.mask[i] * 0.34;
    const c = bigUp[i] * 0.44;
    const v = 1 - (1 - a) * (1 - b) * (1 - c);
    alpha[i] = v;
    if (hard.mask[i]) hardN++;
    if (pulled.mask[i]) pulledN++;
    if (bigUp[i] > 0.5) bigN++;
    if (v > 0.10 && v < 0.50) { band++; bandWidth += Math.min(dist[i], 12); }
  }
  return {
    alpha, hard, pulled, bigUp, dist, hardN, pulledN, bigN, band,
    bandWidth: band ? bandWidth / band : 0,
    total: nx * ny, k, tanE,
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }

function terrainColor(h, out) {
  // 水 → 沙 → 草 → 台地 → 塔（浅色石块）。塔必须和草地有明显色差，
  // 否则俯视图里只看得见影子、看不见投影的东西，验收等于没验。
  if (h <= 0.05) {
    out[0] = 34; out[1] = 66; out[2] = 86;
  } else if (h < 0.5) {
    const t = h / 0.5;
    out[0] = lerp(56, 198, t); out[1] = lerp(104, 184, t); out[2] = lerp(124, 142, t);
  } else if (h < 2.0) {
    const t = (h - 0.5) / 1.5;
    out[0] = lerp(198, 112, t); out[1] = lerp(184, 148, t); out[2] = lerp(142, 94, t);
  } else if (h < 3.4) {
    const t = (h - 2.0) / 1.4;
    out[0] = lerp(112, 126, t); out[1] = lerp(148, 158, t); out[2] = lerp(94, 104, t);
  } else {
    const t = Math.min(1, (h - 3.4) / 2.6);
    out[0] = lerp(206, 228, t); out[1] = lerp(198, 214, t); out[2] = lerp(184, 196, t);
  }
}

export function draw(ctx, world, res, view) {
  const { ox, oy, S } = view;
  const { hf, nx, ny } = world;
  const col = [0, 0, 0];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      const h = hf[i];
      terrainColor(h, col);
      // 一点点高度明暗，塔才会有立体感（纯装饰，阴影仍来自 mask）
      const shade = 1 - Math.min(0.30, h * 0.03);
      ctx.fillStyle = `rgb(${Math.round(col[0] * shade)},${Math.round(col[1] * shade)},${Math.round(col[2] * shade)})`;
      ctx.fillRect(ox + x * S, oy + y * S, S + 1, S + 1);
      const a = res.alpha[i];
      if (a > 0.01) {
        ctx.fillStyle = `rgba(18,24,40,${(a * 0.78).toFixed(3)})`;
        ctx.fillRect(ox + x * S, oy + y * S, S + 1, S + 1);
      }
      // 塔圈一道边：清楚看出"影子是从这块石头长出来的"
      if (h > 3.3) {
        const right = x + 1 < nx ? hf[i + 1] : 0;
        const down = y + 1 < ny ? hf[i + nx] : 0;
        ctx.fillStyle = 'rgba(58,54,48,.55)';
        if (right <= 3.3) ctx.fillRect(ox + (x + 1) * S - 1, oy + y * S, 1, S);
        if (down <= 3.3) ctx.fillRect(ox + x * S, oy + (y + 1) * S - 1, S, 1);
      }
    }
  }
}

/** 太阳 gizmo：绕一个小罗盘拖，方向就是光来的方向。 */
export function drawGizmo(ctx, cx, cy, azRad) {
  const R = 46;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = '#8d8298'; ctx.lineWidth = 1; ctx.stroke();
  const sx = cx + Math.cos(azRad) * R * 0.78;
  const sy = cy + Math.sin(azRad) * R * 0.78;
  ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd479'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,121,.55)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 11, sy + Math.sin(a) * 11);
    ctx.lineTo(sx + Math.cos(a) * 15, sy + Math.sin(a) * 15);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(sx, sy); ctx.lineTo(cx, cy);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,212,121,.8)'; ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#cfd6e2'; ctx.font = '11px system-ui';
  ctx.fillText('拖这里转太阳', cx - 36, cy + R + 18);
  ctx.restore();
}

export function pickAzimuth(cx, cy, x, y) {
  return Math.atan2(y - cy, x - cx);
}
