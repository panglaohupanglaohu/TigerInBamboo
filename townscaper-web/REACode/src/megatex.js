/**
 * megatex.js — 把一堆面片烘进一张大图，再从大图上的一个像素反查出「属于哪个面、面的哪个 u,v」
 *
 * 帖子 ID：1481661852887265288（grid / light baker）
 * 原文引文：
 *   "Yet another light baker. Actually does some ray marching, but still pretty ad hoc. The textures are:
 *    1. Normals (procedurally painted in big chunky strokes) 2. 3D Signed Distance Field
 *    3. 3D Ambient Occlusion in positive and negative X,Y and Z"
 *
 * 画面依据（tmp/cap/1481661852887265288/f03.png）：顶上一排是烘出来的图 —— 左边那张是紫蓝色调的
 * 法线图，笔触成大块斑块（不是逐像素噪声）；中间那张是灰色小格密排的体积切片平铺图（SDF/AO 的逐层切片）；
 * 下面是一坨没上贴图的白模。也就是说：一张大图里塞了很多面的数据，于是「从这个像素反查回哪个面」
 * 成了必须做的事 —— 这就是本条 partial 一直缺的那一半。
 *
 * 为什么这么做：光照烘焙时，光线打到的是**大图上的一个 texel**，但要知道它对应模型上的哪个位置、
 * 哪个法线、哪个面。做法不是每次遍历所有面，而是烘的时候顺手写一张 owner 表：
 *   owner[i] = 这个 texel 属于第几个面，pad[i] = 它是不是垫边（padding）。
 * 有了它，反查就是 O(1) 数组查表 + 一次 rect 内归一化。
 *
 * 与 townscaper 原版的差别（如实标注）：原版是 3D 白模 + 六向 AO 卷，这里退成 2D 的"面片图集 + 反查"，
 * 只保留「烘进大图 → 从 texel 反查面」这一段；AO/SDF 那两样早前轮已落在 src/lighting.js
 * （buildSDF / bakeSixDirVolume），不在本轮重复。
 */

export const CFG = {
  W: 512,            // 图集边长
  PAD: 2,            // 垫边像素（0 / 2 对照）
  FACES: 150,        // 面片数
  SEED: 7,
};

const hash = (i, s = 0) => {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- 面片：尺寸/形状都不一的板子，每块带自己的「大笔触」 ----------
export function genFaces(n = CFG.FACES, seed = CFG.SEED) {
  const F = [];
  for (let i = 0; i < n; i++) {
    const w = 18 + Math.floor(hash(i, seed + 1) * 54);
    const h = 16 + Math.floor(hash(i, seed + 2) * 48);
    // 每块面自己的笔触：3~5 个椭圆，色相固定 → 图集里各面一眼能分
    const strokes = [];
    const hue = Math.floor(hash(i, seed + 3) * 360);
    const k = 3 + Math.floor(hash(i, seed + 4) * 3);
    for (let s = 0; s < k; s++) {
      strokes.push({
        cx: hash(i * 7 + s, seed + 5), cy: hash(i * 11 + s, seed + 6),
        rx: 0.18 + hash(i * 13 + s, seed + 7) * 0.42,
        ry: 0.18 + hash(i * 17 + s, seed + 8) * 0.42,
        dl: (hash(i * 19 + s, seed + 9) - 0.5) * 34,
      });
    }
    F.push({ id: i, w, h, hue, strokes });
  }
  return F;
}

// ---------- 货架打包（shelf packing）：按高度降序一层层摆 ----------
export function shelfPack(faces, atlasW, pad) {
  const order = [...faces].sort((a, b) => (b.h + 2 * pad) - (a.h + 2 * pad) || a.id - b.id);
  const rects = new Array(faces.length);
  let x = 0, y = 0, shelfH = 0, fail = 0;
  for (const f of order) {
    const w = f.w + 2 * pad, h = f.h + 2 * pad;
    if (x + w > atlasW) { x = 0; y += shelfH; shelfH = 0; }
    if (y + h > CFG.W) { fail++; continue; }     // 装不下就记一笔，不硬塞
    const r = { face: f.id, x: x + pad, y: y + pad, w: f.w, h: f.h, pw: w, ph: h, ox: x, oy: y };
    rects[f.id] = r;
    x += w; shelfH = Math.max(shelfH, h);
  }
  return { rects, fail, usedH: y + shelfH };
}

// ---------- 烘焙：写颜色 + 写 owner / pad 两张表 ----------
export function bake(faces, rects, atlasW, atlasH, pad) {
  const N = atlasW * atlasH;
  const rgb = new Uint8ClampedArray(N * 3);
  const owner = new Int16Array(N).fill(-1);
  const padMap = new Uint8Array(N);
  const put = (i, r, g, b) => { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; };
  // 空白区域填中性深灰：若不填就是纯黑，截图里读起来像"这里坏了"
  for (let k = 0; k < N; k++) put(k, 42, 50, 56);

  const hsv = (h, s, v) => {
    const c = v * s, hp = (h % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0]; else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x]; else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    const m = v - c;
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };

  for (const f of faces) {
    const r = rects[f.id];
    if (!r) continue;
    for (let j = 0; j < f.h; j++) {
      for (let i = 0; i < f.w; i++) {
        const u = (i + 0.5) / f.w, v = (j + 0.5) / f.h;
        // 大笔触：每个椭圆给一点明暗，边界不做柔化（原片笔触是硬的块）
        let d = 0;
        for (const s of f.strokes) {
          const q = ((u - s.cx) / s.rx) ** 2 + ((v - s.cy) / s.ry) ** 2;
          if (q < 1) d += s.dl * (1 - q * 0.55);
        }
        const [R, G, B] = hsv(f.hue, 0.30, 0.55 + d / 100);
        const k = (r.y + j) * atlasW + (r.x + i);
        put(k, R, G, B);
        owner[k] = f.id;
      }
    }
    // 垫边：把边缘像素向外复制 pad 圈（clamp extend），owner 仍记这个面，但打 pad 标
    if (pad > 0) {
      for (let j = -pad; j < f.h + pad; j++) {
        for (let i = -pad; i < f.w + pad; i++) {
          if (i >= 0 && i < f.w && j >= 0 && j < f.h) continue;
          const si = Math.min(f.w - 1, Math.max(0, i));
          const sj = Math.min(f.h - 1, Math.max(0, j));
          const src = (r.y + sj) * atlasW + (r.x + si);
          const dst = (r.y + j) * atlasW + (r.x + i);
          if (dst < 0 || dst >= N) continue;
          rgb[dst * 3] = rgb[src * 3]; rgb[dst * 3 + 1] = rgb[src * 3 + 1]; rgb[dst * 3 + 2] = rgb[src * 3 + 2];
          owner[dst] = f.id; padMap[dst] = 1;
        }
      }
    }
  }
  return { rgb, owner, padMap, atlasW, atlasH };
}

// ---------- 反查：像素 → (面, u, v)。owner 表 O(1) ----------
export function resolve(A, rects, x, y) {
  const k = y * A.atlasW + x;
  const f = A.owner[k];
  if (f < 0) return null;
  const r = rects[f];
  return {
    face: f,
    u: (x - r.x + 0.5) / r.w,
    v: (y - r.y + 0.5) / r.h,
    inPad: A.padMap[k] === 1,
  };
}

// ---------- 双线性采样（边界上会去踩邻面的 texel） ----------
export function bilinear(A, x, y) {
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5);
  const fx = (x - 0.5) - x0, fy = (y - 0.5) - y0;
  const out = [0, 0, 0];
  const hits = new Set();
  let wsum = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const xi = Math.min(A.atlasW - 1, Math.max(0, x0 + i));
    const yi = Math.min(A.atlasH - 1, Math.max(0, y0 + j));
    const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
    const k = yi * A.atlasW + xi;
    out[0] += A.rgb[k * 3] * w; out[1] += A.rgb[k * 3 + 1] * w; out[2] += A.rgb[k * 3 + 2] * w;
    hits.add(A.owner[k]); wsum += w;
  }
  return { rgb: out, hits: [...hits], wsum };
}

// ---------- 量 ----------
export function measure() {
  const faces = genFaces();
  const out = {};
  for (const pad of [0, CFG.PAD]) {
    const { rects, fail, usedH } = shelfPack(faces, CFG.W, pad);
    const A = bake(faces, rects, CFG.W, CFG.W, pad);

    // 1) 占空比
    let faceArea = 0, padArea = 0, padT = 0;
    for (let k = 0; k < A.owner.length; k++) if (A.padMap[k]) padArea++;
    for (const f of faces) if (rects[f.id]) faceArea += f.w * f.h;
    const atlasArea = CFG.W * CFG.W;

    // 2) 反查正确率：面内每 3 个 texel 抽一个
    let checked = 0, exact = 0, maxUV = 0;
    for (const f of faces) {
      const r = rects[f.id]; if (!r) continue;
      for (let j = 0; j < f.h; j += 3) for (let i = 0; i < f.w; i += 3) {
        const hit = resolve(A, rects, r.x + i, r.y + j);
        checked++;
        if (hit && hit.face === f.id && !hit.inPad) {
          exact++;
          maxUV = Math.max(maxUV, Math.abs(hit.u - (i + 0.5) / f.w), Math.abs(hit.v - (j + 0.5) / f.h));
        }
      }
    }

    // 3) 边缘渗色：面内沿四条边、距边 0.4px 处做双线性，看 4 个 tap 有没有踩到别人
    let edgeSamples = 0, bleed = 0, errSum = 0;
    for (const f of faces) {
      const r = rects[f.id]; if (!r) continue;
      const probes = [];
      const n = 12;
      for (let t = 0; t < n; t++) {
        const u = (t + 0.5) / n;
        probes.push([r.x - 0.1, r.y + u * f.h]);               // 左
        probes.push([r.x + f.w + 0.1, r.y + u * f.h]);         // 右
        probes.push([r.x + u * f.w, r.y - 0.1]);               // 上
        probes.push([r.x + u * f.w, r.y + f.h + 0.1]);         // 下
      }
      for (const [px, py] of probes) {
        const b = bilinear(A, px, py);
        edgeSamples++;
        if (b.hits.some((o) => o !== f.id)) bleed++;
        // 与"完全回退到自己这条边的 clamp 值"比，色差 = 渗色到底有多脏
        const cx = Math.min(r.x + f.w - 1, Math.max(r.x, Math.round(px)));
        const cy = Math.min(r.y + f.h - 1, Math.max(r.y, Math.round(py)));
        const k = cy * A.atlasW + cx;
        const ref = [A.rgb[k * 3], A.rgb[k * 3 + 1], A.rgb[k * 3 + 2]];
        errSum += Math.abs(b.rgb[0] - ref[0]) + Math.abs(b.rgb[1] - ref[1]) + Math.abs(b.rgb[2] - ref[2]);
      }
    }

    out[pad] = {
      pad, fail, usedH, faceArea, padArea, occupancy: faceArea / atlasArea,
      padShare: padArea / Math.max(1, faceArea + padArea),
      checked, exact, exactRate: exact / Math.max(1, checked), maxUV,
      edgeSamples, bleed, bleedRate: bleed / Math.max(1, edgeSamples),
      meanErr: errSum / Math.max(1, edgeSamples) / 3,
    };
    out[pad].R = rects; out[pad].A = A;
  }
  out.faces = faces.length;
  return out;
}

// ---------- 下采样两级（mip 泄漏：越小的 mip 越容易把邻面混进来） ----------
export function mipDown(A, levels = 2) {
  let cur = { rgb: A.rgb, owner: A.owner, padMap: A.padMap, atlasW: A.atlasW, atlasH: A.atlasH };
  for (let l = 0; l < levels; l++) {
    const W = cur.atlasW >> 1, H = cur.atlasH >> 1;
    const rgb = new Uint8ClampedArray(W * H * 3);
    const owner = new Int16Array(W * H).fill(-1);
    const padMap = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const acc = [0, 0, 0];
      let any = -1, mixed = false;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const k = (2 * y + j) * cur.atlasW + (2 * x + i);
        acc[0] += cur.rgb[k * 3]; acc[1] += cur.rgb[k * 3 + 1]; acc[2] += cur.rgb[k * 3 + 2];
        const o = cur.owner[k];
        if (any === -1) any = o; else if (o !== any) mixed = true;
      }
      const d = y * W + x;
      rgb[d * 3] = acc[0] / 4; rgb[d * 3 + 1] = acc[1] / 4; rgb[d * 3 + 2] = acc[2] / 4;
      owner[d] = mixed ? -1 : any;      // 混了归属的面 = 谁也不是
    }
    cur = { rgb, owner, padMap, atlasW: W, atlasH: H };
  }
  return cur;
}
