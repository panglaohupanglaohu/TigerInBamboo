// 本地候选提取：当识别服务未连接或无实例分割时，用原画亮度/边缘/色差
// 给出「可审稿候选裁剪」。产出与 wall-workspace 下游（installCandidateReview /
// createIndependentLayerGeometry / decodeMaskRle）兼容的 layers 与伪深度。
//
// 设计原则：fallback 只负责给出候选，不直接生成最终 3D 模型；用户在审查确认后
// 仍走物象库 / LLM 形态方案 / 图生3D 重建。离线时深度为亮度近似（标注本地近似）。

function _lcLoadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法加载原画用于本地候选提取"));
    img.src = dataUrl;
  });
}

async function _lcSample(dataUrl, opts) {
  const img = await _lcLoadImage(dataUrl);
  let w;
  let h;
  if (opts.gridWidth && opts.gridHeight) {
    w = opts.gridWidth;
    h = opts.gridHeight;
  } else {
    const maxSide = opts.gridMaxSide || 256;
    const aspect = (img.naturalWidth / img.naturalHeight) || 1;
    if (aspect >= 1) {
      w = maxSide;
      h = Math.max(8, Math.round(maxSide / aspect));
    } else {
      h = maxSide;
      w = Math.max(8, Math.round(maxSide * aspect));
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const lum = new Float32Array(n);
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    r[i] = data[o] / 255;
    g[i] = data[o + 1] / 255;
    b[i] = data[o + 2] / 255;
    lum[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
  }
  return { width: w, height: h, lum, r, g, b };
}

function _lcEdge(lum, w, h) {
  const n = w * h;
  const out = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = Math.hypot(lum[i + 1] - lum[i - 1], lum[i + w] - lum[i - w]);
    }
  }
  return out;
}

// 彩色边缘：三通道梯度合成，捕捉「亮度相近但色相不同」的国画画色边界
// （例如粉底荷花在米白纸面上，亮度差微弱但色相差明显）
function _lcEdgeColor(r, g, b, w, h) {
  const n = w * h;
  const out = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Math.hypot(r[i + 1] - r[i - 1], g[i + 1] - g[i - 1], b[i + 1] - b[i - 1]);
      const gy = Math.hypot(r[i + w] - r[i - w], g[i + w] - g[i - w], b[i + w] - b[i - w]);
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

function _lcColorSep(r, g, b, w, h) {
  const n = w * h;
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    mr += r[i];
    mg += g[i];
    mb += b[i];
  }
  mr /= n;
  mg /= n;
  mb /= n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.hypot(r[i] - mr, g[i] - mg, b[i] - mb);
  return out;
}

// 4 邻接连通域（迭代洪水填充），返回 labels（0=背景）与 count
function _lcComponents(mask, w, h) {
  const n = w * h;
  const labels = new Int32Array(n);
  let count = 0;
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (mask[i] && labels[i] === 0) {
      count++;
      labels[i] = count;
      stack.length = 0;
      stack.push(i);
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = (p - px) / w;
        if (px > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = count; stack.push(p - 1); }
        if (px < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = count; stack.push(p + 1); }
        if (py > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = count; stack.push(p - w); }
        if (py < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = count; stack.push(p + w); }
      }
    }
  }
  return { labels, count };
}

// 形态学开运算（去噪点）：先腐蚀再膨胀
function _lcOpen(mask, w, h) {
  const n = w * h;
  const eroded = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let on = mask[i] === 1;
      if (on) {
        if (x > 0 && !mask[i - 1]) on = false;
        else if (x < w - 1 && !mask[i + 1]) on = false;
        else if (y > 0 && !mask[i - w]) on = false;
        else if (y < h - 1 && !mask[i + w]) on = false;
      }
      eroded[i] = on ? 1 : 0;
    }
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let on = eroded[i] === 1;
      if (!on) {
        if (x > 0 && eroded[i - 1]) on = true;
        else if (x < w - 1 && eroded[i + 1]) on = true;
        else if (y > 0 && eroded[i - w]) on = true;
        else if (y < h - 1 && eroded[i + w]) on = true;
      }
      out[i] = on ? 1 : 0;
    }
  }
  return out;
}

// 形态学闭运算（填洞/连通）：先膨胀再腐蚀
function _lcClose(mask, w, h) {
  const n = w * h;
  const dilated = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let on = mask[i] === 1;
      if (!on) {
        if (x > 0 && mask[i - 1]) on = true;
        else if (x < w - 1 && mask[i + 1]) on = true;
        else if (y > 0 && mask[i - w]) on = true;
        else if (y < h - 1 && mask[i + w]) on = true;
      }
      dilated[i] = on ? 1 : 0;
    }
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let on = dilated[i] === 1;
      if (on) {
        if (x > 0 && !dilated[i - 1]) on = false;
        else if (x < w - 1 && !dilated[i + 1]) on = false;
        else if (y > 0 && !dilated[i - w]) on = false;
        else if (y < h - 1 && !dilated[i + w]) on = false;
      }
      out[i] = on ? 1 : 0;
    }
  }
  return out;
}

// RLE 编码：{ counts: number[], startsWith: 0|1 }，与 decodeMaskRle 对应
export function encodeMaskRle(boolMask, n) {
  if (!n) return { counts: [0], startsWith: 0 };
  const counts = [1];
  let cur = boolMask[0] ? 1 : 0;
  for (let i = 1; i < n; i++) {
    const v = boolMask[i] ? 1 : 0;
    if (v === cur) counts[counts.length - 1]++;
    else { cur = v; counts.push(1); }
  }
  return { counts, startsWith: boolMask[0] ? 1 : 0 };
}

// 深度特征学习：用户确认的候选裁剪经 DINO-ViT（本机 worker /embed）
// 转为 768 维特征向量存档；之后候选按余弦相似度排序——学习的是
// 用户画作里这种国画形态，而非自然界照片。
const EMBED_KEY = "ui.subjectEmbeddings";
const MAX_EMBEDDINGS = 8;

function _readEmbeddings() {
  try {
    return JSON.parse(localStorage.getItem(EMBED_KEY) || "{}");
  } catch {
    return {};
  }
}

export function learnEmbeddingSample(subjectId, embedding) {
  if (!subjectId || !Array.isArray(embedding) || !embedding.length) return 0;
  const data = _readEmbeddings();
  const list = data[subjectId] || [];
  list.unshift(embedding.map((v) => +Number(v).toFixed(4)));
  data[subjectId] = list.slice(0, MAX_EMBEDDINGS);
  try {
    localStorage.setItem(EMBED_KEY, JSON.stringify(data));
  } catch { /* 隐私模式忽略 */ }
  return data[subjectId].length;
}

export function hasEmbeddingSamples(subjectId) {
  return Boolean(subjectId && (_readEmbeddings()[subjectId] || []).length);
}

export function embeddingSimilarity(subjectId, embedding) {
  if (!subjectId || !Array.isArray(embedding) || !embedding.length) return 0;
  const list = _readEmbeddings()[subjectId] || [];
  let best = 0;
  for (const sample of list) {
    let dot = 0;
    const n = Math.min(sample.length, embedding.length);
    for (let i = 0; i < n; i++) dot += sample[i] * embedding[i];
    if (dot > best) best = dot;
  }
  return best;
}

// 用户选取学习：安置完成 = 正样本（记录位置/大小/形状/颜色特征），
// 取消安置 = 删除最近样本；之后识别按与样本的相似度加权排序。
const EXAMPLE_KEY = "ui.subjectExamples";
const MAX_EXAMPLES = 12;

function _readExamples() {
  try {
    return JSON.parse(localStorage.getItem(EXAMPLE_KEY) || "{}");
  } catch {
    return {};
  }
}

function _writeExamples(data) {
  try {
    localStorage.setItem(EXAMPLE_KEY, JSON.stringify(data));
  } catch { /* 隐私模式忽略 */ }
}

export function layerFeatureVector(layer) {
  const bbox = layer.bbox || [0, 0, 1, 1];
  const cx = (bbox[0] + bbox[2]) / 2;
  const cy = (bbox[1] + bbox[3]) / 2;
  const coverage = Math.max(1e-5, layer.coverage || 0.01);
  const aspect = Math.max(0.05, (bbox[2] - bbox[0]) / Math.max(1e-6, bbox[3] - bbox[1]));
  const color = layer.meanColor || [null, null, null];
  return [cx, cy, Math.log(coverage) / 5, Math.log(aspect) / 2, color[0], color[1], color[2]];
}

function _featureDistance(a, b) {
  let sum = 0;
  let dims = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || b[i] === null || a[i] === undefined || b[i] === undefined) continue;
    sum += (a[i] - b[i]) ** 2;
    dims++;
  }
  return dims ? Math.sqrt(sum / dims) : 1;
}

export function learnFromSelection(subjectId, layer) {
  if (!subjectId || !layer) return 0;
  const data = _readExamples();
  const list = data[subjectId] || [];
  list.unshift({ f: layerFeatureVector(layer), t: Date.now() });
  data[subjectId] = list.slice(0, MAX_EXAMPLES);
  _writeExamples(data);
  return data[subjectId].length;
}

export function forgetSelection(subjectId, layer) {
  if (!subjectId || !layer) return;
  const data = _readExamples();
  const list = data[subjectId] || [];
  if (!list.length) return;
  const f = layerFeatureVector(layer);
  let best = 0;
  let bestDist = Infinity;
  list.forEach((ex, i) => {
    const d = _featureDistance(ex.f, f);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  list.splice(best, 1);
  data[subjectId] = list;
  _writeExamples(data);
}

export function learnedSimilarity(subjectId, layer) {
  if (!subjectId || !layer) return 0;
  const list = _readExamples()[subjectId] || [];
  if (!list.length) return 0;
  const f = layerFeatureVector(layer);
  let best = 0;
  for (const ex of list) {
    const d = _featureDistance(ex.f, f);
    best = Math.max(best, Math.exp(-(d * d) / (2 * 0.18)));
  }
  return best;
}

// 种子点提取：用户点选目标内部一点 → 优先取该点所在的显著性连通域；
// 落空时按种子邻域颜色做漫水填充（遇强边缘停止），产出精确掩码候选。
export async function extractSeedCandidate(dataUrl, seed, opts = {}) {
  const { width, height, lum, r, g, b } = await _lcSample(dataUrl, opts);
  const n = width * height;
  const edgeLum = _lcEdge(lum, width, height);
  const edgeClr = _lcEdgeColor(r, g, b, width, height);
  const edge = new Float32Array(n);
  const csep = _lcColorSep(r, g, b, width, height);
  let edgeMax = 1e-4;
  let csepMax = 1e-4;
  for (let i = 0; i < n; i++) {
    edge[i] = Math.max(edgeLum[i], edgeClr[i]);
    if (edge[i] > edgeMax) edgeMax = edge[i];
    if (csep[i] > csepMax) csepMax = csep[i];
  }
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    fg[i] = (edge[i] / edgeMax > 0.25) || (csep[i] / csepMax > 0.45) ? 1 : 0;
  }
  _lcSuppressFrameLines(fg, width, height);
  // 种子路径只用闭运算补洞，不做开运算——保住细薄的花边/枝缘环
  const filled = _lcClose(fg, width, height);
  const { labels } = _lcComponents(filled, width, height);
  const sx = Math.min(width - 1, Math.max(0, Math.round(seed[0] * (width - 1))));
  const sy = Math.min(height - 1, Math.max(0, Math.round(seed[1] * (height - 1))));
  let comp = null;
  const hit = labels[sy * width + sx];
  if (hit > 0) {
    let area = 0;
    comp = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (labels[i] === hit) {
        comp[i] = 1;
        area++;
      }
    }
    if (area < Math.max(12, Math.round(n * 0.0008))) comp = null;
  }
  if (!comp) {
    comp = _lcSeedFlood(r, g, b, edge, edgeMax, width, height, sx, sy);
  }
  if (comp) {
    let floodArea = 0;
    for (let i = 0; i < n; i++) floodArea += comp[i];
    if (floodArea <= Math.round(n * 0.06)) {
      // 漫水自限（未外泄）：边缘已把它约束在目标内，直接采纳
      const values2 = new Float32Array(n);
      for (let i = 0; i < n; i++) values2[i] = (lum[i] - 0.5) * 2;
      const depth2 = { width, height, values: values2, source: "local-luminance" };
      return { layers: [_lcCompToLayer(comp, r, g, b, width, height, n, opts)], depth: depth2, width, height };
    }
    // 漫水外泄（逼近距离帽）：才需要显著性约束
    // 防漏一：漫水结果与显著性前景（3 次闭运算近似膨胀）相交
    let dilated = _lcClose(filled, width, height);
    dilated = _lcClose(dilated, width, height);
    dilated = _lcClose(dilated, width, height);
    let overlap = 0;
    const bounded = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (comp[i] && dilated[i]) {
        bounded[i] = 1;
        overlap++;
      }
    }
    // 防漏二：bounded 中取最大连通域——目标应主导 bounded；
    // 空白背景漫水留下的只是碎斑（最大连通域占比小），直接拒绝
    const { labels: bLabels, count: bCount } = _lcComponents(bounded, width, height);
    let bestLab = 0;
    let bestArea = 0;
    for (let lab = 1; lab <= bCount; lab++) {
      let a = 0;
      for (let i = 0; i < n; i++) if (bLabels[i] === lab) a++;
      if (a > bestArea) {
        bestArea = a;
        bestLab = lab;
      }
    }
    if (bestLab && bestArea >= 12 && overlap > 0 && bestArea / overlap >= 0.5) {
      const largest = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (bLabels[i] === bestLab) largest[i] = 1;
      comp = largest;
    } else {
      return { layers: [], depth: { width, height, values: [], source: "local-luminance" }, width, height };
    }
  }
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) values[i] = (lum[i] - 0.5) * 2;
  const depth = { width, height, values, source: "local-luminance" };
  if (!comp) return { layers: [], depth, width, height };
  const layer = _lcCompToLayer(comp, r, g, b, width, height, n, opts);
  if (!layer) return { layers: [], depth, width, height };
  return { layers: [layer], depth, width, height };
}

// 连通域掩码 → 候选层（bbox/centroid/coverage/meanColor）
function _lcCompToLayer(comp, r, g, b, width, height, n, opts) {
  let minx = width;
  let miny = height;
  let maxx = 0;
  let maxy = 0;
  let sumx = 0;
  let sumy = 0;
  let sumr = 0;
  let sumg = 0;
  let sumb = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i]) {
      const x = i % width;
      const y = (i - x) / width;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      sumx += x;
      sumy += y;
      sumr += r[i];
      sumg += g[i];
      sumb += b[i];
      area++;
    }
  }
  if (!area) return null;
  return {
    id: `seed-${Date.now()}`,
    label: opts.label || "候选",
    subjectId: opts.subjectId || "seed",
    bbox: [minx / width, miny / height, (maxx + 1) / width, (maxy + 1) / height],
    anchor: { centroid: [sumx / area / (width - 1), sumy / area / (height - 1)] },
    maskRle: encodeMaskRle(comp, n),
    coverage: area / n,
    meanColor: [+(sumr / area).toFixed(4), +(sumg / area).toFixed(4), +(sumb / area).toFixed(4)],
    seeded: true,
  };
}

// 种子颜色漫水：以种子 5x5 邻域均值色为准，颜色相近且非强边缘的像素纳入
function _lcSeedFlood(r, g, b, edge, edgeMax, width, height, sx, sy) {
  const n = width * height;
  const comp = new Uint8Array(n);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let cnt = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = sx + dx;
      const y = sy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = y * width + x;
      sr += r[i];
      sg += g[i];
      sb += b[i];
      cnt++;
    }
  }
  sr /= cnt;
  sg /= cnt;
  sb /= cnt;
  const threshold = 0.14;
  const edgeLimit = 0.5;
  const maxArea = Math.round(n * 0.5);
  const maxRadius = Math.min(width, height) * 0.3;
  const maxRadius2 = maxRadius * maxRadius;
  const seedI = sy * width + sx;
  const stack = [seedI];
  comp[seedI] = 1;
  let area = 1;
  while (stack.length && area < maxArea) {
    const p = stack.pop();
    const px = p % width;
    const py = (p - px) / width;
    const neighbors = [];
    if (px > 0) neighbors.push(p - 1);
    if (px < width - 1) neighbors.push(p + 1);
    if (py > 0) neighbors.push(p - width);
    if (py < height - 1) neighbors.push(p + width);
    for (const q of neighbors) {
      if (comp[q]) continue;
      const qx = q % width;
      const qy = (q - qx) / width;
      const dr2 = (qx - sx) * (qx - sx) + (qy - sy) * (qy - sy);
      if (dr2 > maxRadius2) continue;
      if (edge[q] / edgeMax > edgeLimit) continue;
      if (Math.hypot(r[q] - sr, g[q] - sg, b[q] - sb) > threshold) continue;
      comp[q] = 1;
      area++;
      stack.push(q);
    }
  }
  return area >= 12 ? comp : null;
}

// 要素先验：按所选画中要素的形态/颜色/位置给候选打分排序，
// 语义检测未命中退回本地候选时，让最像该要素的候选排在最前。
function _lcPriorScore(opts, f) {
  const id = opts.subjectId || "";
  const domain = opts.domain || "";
  const w = f.bbox[2] - f.bbox[0];
  const h = f.bbox[3] - f.bbox[1];
  const aspect = w / Math.max(1e-6, h);
  const logAspect = Math.abs(Math.log(Math.max(0.05, aspect)));
  const roundish = 1 / (1 + logAspect);
  const vertical = h / Math.max(1e-6, w); // >1 竖长块
  const lower = f.centroid[1]; // 0..1，越大越靠画面下方
  const green = f.g - Math.max(f.r, f.b);
  const pink = f.r - (f.g + f.b) / 2;
  let score = 0;
  if (id.startsWith("lotus")) {
    // 荷花：近圆、多在水面（画面下半）、偏绿（叶）或偏粉（花）、面积适中
    score += roundish * 1.1 + lower * 0.7 + Math.max(0, green) * 1.6 + Math.max(0, pink) * 0.9;
    score += f.coverage > 0.02 && f.coverage < 0.3 ? 0.4 : 0;
    score -= Math.max(0, aspect - 2) * 0.8; // 横长块多半不是荷花
  } else if (id === "bamboo") {
    // 竹：竖长竿形（高大于宽）、偏绿；横块严惩
    score += Math.min(1.6, Math.max(0, vertical - 0.8) * 1.0) + Math.max(0, green) * 1.6;
    score -= Math.max(0, aspect - 1.2) * 1.4;
  } else if (id === "reed" || id === "calamus") {
    // 芦苇/菖蒲：竖长、偏绿、靠水岸（下半）
    score += Math.min(1.5, Math.max(0, vertical - 0.8) * 0.9) + Math.max(0, green) * 1.5 + lower * 0.6;
    score -= Math.max(0, aspect - 1.2) * 1.2;
  } else if (id === "pine") {
    // 松：偏绿、可竖可横但不高宽比夸张、多在中上部
    score += Math.min(1.0, Math.max(0, vertical - 0.7) * 0.5) + Math.max(0, green) * 1.5 + (1 - lower) * 0.35;
    score -= Math.max(0, aspect - 1.8) * 0.9;
  } else if (domain === "biology") {
    // 生灵：紧凑小块、面积不大
    score += roundish * 0.8 + (f.coverage < 0.2 ? 0.4 : 0) + (1 - lower) * 0.3;
  } else if (id === "plum" || id === "camellia" || id === "azalea" || id === "hibiscus" || id === "chrysanthemum" || id === "peony") {
    // 花卉：近圆小块、偏粉/艳色
    score += roundish * 0.9 + Math.max(0, pink) * 1.1 + (f.coverage < 0.18 ? 0.3 : 0);
  }
  // 用户选取学习：与历史正样本越像，排名越靠前
  score += learnedSimilarity(id, { bbox: f.bbox, coverage: f.coverage, meanColor: [f.r, f.g, f.b] }) * 1.8;
  return score;
}

// 主体：取样原画 → 前景掩码 → 连通域 → bbox/anchor/coverage/RLE
export async function extractLocalCandidates(dataUrl, opts = {}) {
  const { width, height, lum, r, g, b } = await _lcSample(dataUrl, opts);
  const n = width * height;
  const edgeLum = _lcEdge(lum, width, height);
  const edgeClr = _lcEdgeColor(r, g, b, width, height);
  const edge = new Float32Array(n);
  const csep = _lcColorSep(r, g, b, width, height);
  let edgeMax = 1e-4;
  let csepMax = 1e-4;
  for (let i = 0; i < n; i++) {
    edge[i] = Math.max(edgeLum[i], edgeClr[i]);
    if (edge[i] > edgeMax) edgeMax = edge[i];
    if (csep[i] > csepMax) csepMax = csep[i];
  }
  // 前景 = 高边缘 或 高色差（任一即可）：保证「亮色主体」与「亮底深色主体」都能识别，
  // 色差按图像内最大值归一化，避免纯色内部被漏检。
  const fg = new Uint8Array(n);
  const domain = opts.domain || "auto";
  for (let i = 0; i < n; i++) {
    const e = edge[i] / edgeMax;
    const c = csep[i] / csepMax;
    let on = (e > 0.25) || (c > 0.45);
    if (domain === "water") on = on || (c > 0.3 && e < 0.22);
    fg[i] = on ? 1 : 0;
  }
  _lcSuppressFrameLines(fg, width, height);
  const filled = _lcClose(fg, width, height);   // 先闭：把主体内部填实、连通
  const cleaned = _lcOpen(filled, width, height); // 再开：去掉零散噪点
  const { labels, count } = _lcComponents(cleaned, width, height);
  const layers = [];
  const minArea = Math.max(12, Math.round(n * 0.0008));
  const maxArea = Math.round(n * 0.55);
  for (let lab = 1; lab <= count; lab++) {
    let minx = width;
    let miny = height;
    let maxx = 0;
    let maxy = 0;
    let sumx = 0;
    let sumy = 0;
    let area = 0;
    let sumr = 0;
    let sumg = 0;
    let sumb = 0;
    const comp = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (labels[i] === lab) {
        const x = i % width;
        const y = (i - x) / width;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
        sumx += x;
        sumy += y;
        sumr += r[i];
        sumg += g[i];
        sumb += b[i];
        area++;
        comp[i] = 1;
      }
    }
    if (area < minArea || area > maxArea) continue;
    const cx = sumx / area;
    const cy = sumy / area;
    const bbox = [minx / width, miny / height, (maxx + 1) / width, (maxy + 1) / height];
    const centroid = [cx / (width - 1), cy / (height - 1)];
    const coverage = area / n;
    const features = {
      bbox,
      centroid,
      coverage,
      r: sumr / area,
      g: sumg / area,
      b: sumb / area,
    };
    layers.push({
      id: `local-${lab}`,
      label: opts.label || "候选",
      subjectId: opts.subjectId || "local",
      bbox,
      anchor: { centroid },
      maskRle: encodeMaskRle(comp, n),
      coverage,
      meanColor: [+(sumr / area).toFixed(4), +(sumg / area).toFixed(4), +(sumb / area).toFixed(4)],
      priorScore: +_lcPriorScore(opts, features).toFixed(4),
    });
  }
  // 先验排序 + 相关性过滤：不同要素给出不同候选集合，而非同一批斑块换个顺序。
  // 保留 top 50% 先验分以上的候选（至少 3 个，至多 8 个）；先验全零（未知要素）时按面积取前 8。
  layers.sort((a, b2) => (b2.priorScore - a.priorScore) || (b2.coverage - a.coverage));
  const top = layers.length ? layers[0].priorScore : 0;
  let kept = top > 0.01 ? layers.filter((layer) => layer.priorScore >= Math.max(0.2, top * 0.5)) : layers;
  if (kept.length < 3) kept = layers.slice(0, 3);
  layers.length = 0;
  layers.push(...kept.slice(0, 8));
  // 伪深度（亮度近似）：离线 2D→3D 流程使用，标注本地近似
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) values[i] = (lum[i] - 0.5) * 2;
  const depth = { width, height, values, source: "local-luminance" };
  return { layers, depth, width, height };
}

// 屏风折线/装裱缝抑制：贯穿整幅且邻列（行）为空的孤立直线不是物象。
// 竹/枝有宽度（邻列被填充）或斜向不贯穿，不受影响。
function _lcSuppressFrameLines(mask, width, height) {
  const colDensity = new Float32Array(width);
  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        colDensity[x]++;
        rowDensity[y]++;
      }
    }
  }
  for (let x = 1; x < width - 1; x++) {
    if (
      colDensity[x] / height > 0.85 &&
      colDensity[x - 1] / height < 0.35 &&
      colDensity[x + 1] / height < 0.35
    ) {
      for (let y = 0; y < height; y++) mask[y * width + x] = 0;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    if (
      rowDensity[y] / width > 0.85 &&
      rowDensity[y - 1] / width < 0.35 &&
      rowDensity[y + 1] / width < 0.35
    ) {
      for (let x = 0; x < width; x++) mask[y * width + x] = 0;
    }
  }
  return mask;
}

// 框内提取：用户拖拽的画框 → 框内显著性掩码（彩色边缘+色差），
// 取含框心的连通域；提取为空时退回整框。避免矩形掩码把背景一起圈进来。
export async function extractBoxCandidate(dataUrl, box, opts = {}) {
  const { width, height, lum, r, g, b } = await _lcSample(dataUrl, opts);
  const n = width * height;
  const x0 = Math.min(width - 2, Math.max(0, Math.floor(box[0] * width)));
  const y0 = Math.min(height - 2, Math.max(0, Math.floor(box[1] * height)));
  const x1 = Math.min(width, Math.max(x0 + 2, Math.ceil(box[2] * width)));
  const y1 = Math.min(height, Math.max(y0 + 2, Math.ceil(box[3] * height)));
  const edgeLum = _lcEdge(lum, width, height);
  const edgeClr = _lcEdgeColor(r, g, b, width, height);
  const csep = _lcColorSep(r, g, b, width, height);
  const combined = new Float32Array(n);
  let edgeMax = 1e-4;
  let csepMax = 1e-4;
  for (let i = 0; i < n; i++) {
    combined[i] = Math.max(edgeLum[i], edgeClr[i]);
    if (combined[i] > edgeMax) edgeMax = combined[i];
    if (csep[i] > csepMax) csepMax = csep[i];
  }
  const comp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const e = combined[i];
    // 用户已框定大致范围，阈值放宽：软色边/弱色差也算主体
    comp[i] = (e / edgeMax > 0.12) || (csep[i] / csepMax > 0.25) ? 1 : 0;
  }
  _lcSuppressFrameLines(comp, width, height);
  for (let i = 0; i < n; i++) {
    const x = i % width;
    const y = (i - x) / width;
    if (x < x0 || x >= x1 || y < y0 || y >= y1) comp[i] = 0;
  }
  const closed = _lcClose(comp, width, height);
  const { labels, count } = _lcComponents(closed, width, height);
  // 含框心的连通域优先，否则框内最大连通域
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  let bestLab = labels[cy * width + cx];
  let bestArea = 0;
  if (bestLab) {
    for (let i = 0; i < n; i++) if (labels[i] === bestLab) bestArea++;
  }
  if (!bestLab) {
    for (let lab = 1; lab <= count; lab++) {
      let a = 0;
      for (let i = 0; i < n; i++) if (labels[i] === lab) a++;
      if (a > bestArea) {
        bestArea = a;
        bestLab = lab;
      }
    }
  }
  const boxArea = (x1 - x0) * (y1 - y0);
  let mask = null;
  if (bestLab && bestArea >= boxArea * 0.15) {
    mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (labels[i] === bestLab) mask[i] = 1;
  } else {
    // 显著性不足（软色物体）：从框心按颜色漫水并裁剪到框内
    const flood = _lcSeedFlood(r, g, b, combined, edgeMax, width, height, cx, cy);
    if (flood) {
      let area = 0;
      const clipped = new Uint8Array(n);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * width + x;
          if (flood[i]) {
            clipped[i] = 1;
            area++;
          }
        }
      }
      if (area >= 12) mask = clipped;
    }
  }
  if (!mask) {
    // 兜底：尊重用户框选意图，退回整框
    mask = new Uint8Array(n);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
  }
  const values = new Float32Array(n);
  for (let i = 0; i < n; i++) values[i] = (lum[i] - 0.5) * 2;
  const depth = { width, height, values, source: "local-luminance" };
  const layer = _lcCompToLayer(mask, r, g, b, width, height, n, opts);
  if (!layer) return { layers: [], depth, width, height };
  layer.seeded = false;
  layer.boxed = true;
  return { layers: [layer], depth, width, height };
}

// 调试：暴露种子提取的中间量（e2e 排障用）
export async function debugSeed(dataUrl, seed, opts = {}) {
  const { width, height, lum, r, g, b } = await _lcSample(dataUrl, opts);
  const n = width * height;
  const edgeLum = _lcEdge(lum, width, height);
  const edgeClr = _lcEdgeColor(r, g, b, width, height);
  const edge = new Float32Array(n);
  const csep = _lcColorSep(r, g, b, width, height);
  let edgeMax = 1e-4;
  let csepMax = 1e-4;
  for (let i = 0; i < n; i++) {
    edge[i] = Math.max(edgeLum[i], edgeClr[i]);
    if (edge[i] > edgeMax) edgeMax = edge[i];
    if (csep[i] > csepMax) csepMax = csep[i];
  }
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    fg[i] = (edge[i] / edgeMax > 0.25) || (csep[i] / csepMax > 0.45) ? 1 : 0;
  }
  const filled = _lcClose(fg, width, height);
  const { labels } = _lcComponents(filled, width, height);
  const sx = Math.min(width - 1, Math.max(0, Math.round(seed[0] * (width - 1))));
  const sy = Math.min(height - 1, Math.max(0, Math.round(seed[1] * (height - 1))));
  const si = sy * width + sx;
  let ringEdge = 0;
  let cnt = 0;
  for (let a = 0; a < 6.283; a += 0.1) {
    const x = Math.round(sx + 21 * Math.cos(a));
    const y = Math.round(sy + 21 * Math.sin(a));
    if (x >= 0 && y >= 0 && x < width && y < height) {
      ringEdge += edge[y * width + x] / edgeMax;
      cnt++;
    }
  }
  const comp = _lcSeedFlood(r, g, b, edge, edgeMax, width, height, sx, sy);
  let floodArea = 0;
  if (comp) for (let i = 0; i < n; i++) floodArea += comp[i];
  return {
    seedIndex: si,
    seedEdgeNorm: +(edge[si] / edgeMax).toFixed(3),
    seedCsepNorm: +(csep[si] / csepMax).toFixed(3),
    ringEdgeMean: +(ringEdge / Math.max(1, cnt)).toFixed(3),
    fgPixels: fg.reduce((a, v) => a + v, 0),
    seedLabel: labels[si],
    floodArea,
  };
}
