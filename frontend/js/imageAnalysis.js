// 图像分析：纯前端离线实现（Canvas 2D 像素统计）
// 输入：用户上传的图片文件
// 输出：轮廓特征 + 主色板 → 供 anatomyEstimator 推断解剖类型与体型比例
//
// 算法：
//   1. 缩放到 128×128 灰度图
//   2. Otsu 自动阈值分割前景/背景
//   3. 前景包围盒 → 宽高比 ratio、伸长率 elongation=对角/短边
//   4. 主成分分析（PCA）→ 主轴方向角 angle
//   5. 前景像素占比 fgRatio
//   6. K-means(简化) 主色聚类 → palette[6]、bestHex

import { estimateAnatomy } from "./bio/anatomyEstimator.js";

const ANALYZE_SIZE = 128;

/**
 * 分析上传的图片文件，返回轮廓特征与主色板
 * @param {File} file
 * @returns {Promise<{
 *   ratio:number, elongation:number, angle:number, fgRatio:number,
 *   subjectW:number, subjectH:number,
 *   palette:string[], bestHex:string|null
 * }>}
 */
export async function analyzeImage(file) {
  const img = await loadImage(file);
  const { gray, w, h, rgba } = rasterize(img);
  const mask = otsuThreshold(gray);
  const bbox = boundingBox(mask, w, h);
  if (!bbox) {
    return { ratio: 1, elongation: 1, angle: 0, fgRatio: 0, subjectW: 0, subjectH: 0, palette: ["#888888"], bestHex: "#888888" };
  }
  const { x0, y0, x1, y1 } = bbox;
  const subjectW = x1 - x0 + 1;
  const subjectH = y1 - y0 + 1;
  const ratio = subjectW / Math.max(1, subjectH);
  const elongation = Math.hypot(subjectW, subjectH) / Math.min(subjectW, subjectH);
  const angle = principalAngle(mask, w, h, bbox);
  let fgCount = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) fgCount++;
  const fgRatio = fgCount / (w * h);
  const { palette, bestHex } = extractPalette(rgba, mask, w, h);
  return { ratio, elongation, angle, fgRatio, subjectW, subjectH, palette, bestHex };
}

/**
 * 完整推断：分析图片 → 解剖结构 → 尺寸/比例/配色建议
 * 返回 lab.js 所需的 { anatomy, confidence, ratios, dimensions, proportions, palette, bestHex, scores, features }
 * @param {File} file
 */
export async function analyzeAndEstimate(file) {
  const features = await analyzeImage(file);
  const img = await loadImage(file);
  const est = estimateAnatomy(img, features);
  return {
    anatomy: est.anatomyType,
    confidence: est.confidence,
    ratios: {
      "颈长比": est.proportions.neckLen,
      "腿长比": est.proportions.legLen,
      "尾长比": est.proportions.tailLen,
      "伸长率": features.elongation,
      "前景占比": features.fgRatio,
    },
    dimensions: est.dimensions,
    proportions: est.proportions,
    palette: est.palette,
    bestHex: est.bestHex,
    scores: est.scores,
    features: est.features,
    anatomyType: est.anatomyType,
  };
}

// ---- 工具函数 ----

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error("图片加载失败")); };
    img.src = url;
  });
}

/** 缩放到 ANALYZE_SIZE×ANALYZE_SIZE，返回灰度数组 + RGBA 数组 */
function rasterize(img) {
  const w = ANALYZE_SIZE, h = ANALYZE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // 保持比例居中裁剪
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  const rgba = new Uint8Array(data); // 复制一份
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) | 0;
  }
  return { gray, w, h, rgba };
}

/** Otsu 自动阈值二值化：返回前景掩码（true=主体） */
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (const g of gray) hist[g]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = -1, thresh = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > maxVar) { maxVar = between; thresh = i; }
  }
  // 暗主体（灰度 < 阈值）= 前景；若前景占比 > 0.6 则反转（亮主体）
  let fg = new Uint8Array(gray.length);
  let darkCount = 0;
  for (let i = 0; i < gray.length; i++) { if (gray[i] < thresh) { fg[i] = 1; darkCount++; } }
  if (darkCount / gray.length > 0.6) {
    for (let i = 0; i < gray.length; i++) fg[i] = fg[i] ? 0 : 1;
  }
  return fg;
}

/** 前景包围盒 */
function boundingBox(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}

/** PCA 主轴方向角（弧度）：返回前景像素协方差矩阵的特征向量角度 */
function principalAngle(mask, w, h, bbox) {
  const { x0, y0, x1, y1 } = bbox;
  let sx = 0, sy = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mask[y * w + x]) { sx += x; sy += y; n++; }
    }
  }
  if (n < 2) return 0;
  const mx = sx / n, my = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mask[y * w + x]) {
        const dx = x - mx, dy = y - my;
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
      }
    }
  }
  sxx /= n; syy /= n; sxy /= n;
  // 特征向量角度：tan(2θ) = 2*sxy / (sxx - syy)
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

/** 简化 K-means 主色提取：从前景像素中取 6 个代表色 */
function extractPalette(rgba, mask, w, h) {
  const pixels = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      pixels.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
    }
  }
  if (pixels.length === 0) return { palette: ["#888888"], bestHex: "#888888" };
  // 均匀采样作为初始中心
  const K = 6;
  const centers = [];
  for (let i = 0; i < K; i++) {
    const idx = Math.floor((i / K) * pixels.length);
    centers.push([...pixels[idx]]);
  }
  const assignments = new Array(pixels.length).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    // 分配
    for (let p = 0; p < pixels.length; p++) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < K; k++) {
        const dr = pixels[p][0] - centers[k][0];
        const dg = pixels[p][1] - centers[k][1];
        const db = pixels[p][2] - centers[k][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = k; }
      }
      assignments[p] = best;
    }
    // 更新中心
    const sums = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (let p = 0; p < pixels.length; p++) {
      const k = assignments[p];
      sums[k][0] += pixels[p][0]; sums[k][1] += pixels[p][1]; sums[k][2] += pixels[p][2]; sums[k][3]++;
    }
    for (let k = 0; k < K; k++) {
      if (sums[k][3] > 0) {
        centers[k][0] = sums[k][0] / sums[k][3];
        centers[k][1] = sums[k][1] / sums[k][3];
        centers[k][2] = sums[k][2] / sums[k][3];
      }
    }
  }
  // 按簇大小排序
  const counts = new Array(K).fill(0);
  for (const a of assignments) counts[a]++;
  const order = [...Array(K).keys()].sort((a, b) => counts[b] - counts[a]);
  const palette = order.map((k) => rgbToHex(centers[k][0] | 0, centers[k][1] | 0, centers[k][2] | 0));
  // bestHex 取「最大的非极端暗色簇」作为主色（避免纯黑背景被当作主体色）
  // 极端暗色判定：RGB 三通道均 < 30
  let bestHex = palette[0];
  for (let i = 0; i < K; i++) {
    const k = order[i];
    const r = centers[k][0], g = centers[k][1], b = centers[k][2];
    if (r >= 30 || g >= 30 || b >= 30) { bestHex = rgbToHex(r | 0, g | 0, b | 0); break; }
  }
  return { palette, bestHex };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
