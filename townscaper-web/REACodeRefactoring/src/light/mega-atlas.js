/**
 * mega-atlas.js — 大纹理：一堆面片烘进一张大图（颜色 + owner 表 + 垫边），再从一个像素反查回「哪个面、面上哪个 u,v」，
 * 以及量这张大图好不好用（占空比、反查正确率、双线性串色、mip 串色）。
 * R64（TigerMessenger CAPABILITY_PIPELINE_GUIDE §10 R61–R70）嫁接自原版 townscaper-web/REACode/src/megatex.js（帖子 1481661852887265288：
 *   「Yet another light baker … The textures are: 1. Normals (procedurally painted in big chunky strokes) 2. 3D SDF 3. 3D AO in ±X,Y,Z」）。
 *
 * 重构库第 50 轮已有 light/texel-owner.js（owner 表接共享增量图集 core/atlas.js）；缺的是原版的另一半：
 *   genFaces（每块面自己的大笔触）、bake（写颜色 + owner + 垫边复制）、resolve / bilinear（带颜色的反查与双线性）、mipDown、measure（整套量法）。
 * 两种排布：
 *   pack:'shelf'  与原版逐值一致的货架排布（parity「同判据」用）；
 *   pack:'atlas'  共享增量图集（TexelOwnerAtlas → core/atlas.js 的 Atlas.allocate），游戏里的 impostor / 精灵图集走这一种。
 * 修掉的原版瑕疵：
 *   · 原版 shelfPack 判「放不下」用的是图集宽 CFG.W，不是图集高——非正方形图集会错判；这里用 atlasH（正方形时结果不变）。
 *   · 原版 bake 的垫边只判 dst 是否越出整张图，不判 x 是否越出这一行——贴着图集右边缘的面，垫边会写到下一行开头；这里跳过越行的像素
 *     （货架排布里面不会贴到右边缘以外，所以对原版 CFG 结果不变）。
 * 原版里同名的 shelfPack 不导出（重构库 core/atlas.js 已有同名的「行货架」基线，签名不同），这里叫 shelfLayout。
 */
import { TexelOwnerAtlas } from './texel-owner.js';

export const CFG = { W: 512, PAD: 2, FACES: 150, SEED: 7 };

const hash = (i, s = 0) => {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 面片：尺寸不一的板子，每块带 3~5 个椭圆「大笔触」，色相固定（图集里各面一眼能分）。与原版同一个哈希，同 n / seed 给出同一批面。 */
export function genFaces(n = CFG.FACES, seed = CFG.SEED) {
  const F = [];
  for (let i = 0; i < n; i++) {
    const w = 18 + Math.floor(hash(i, seed + 1) * 54), h = 16 + Math.floor(hash(i, seed + 2) * 48);
    const strokes = [], hue = Math.floor(hash(i, seed + 3) * 360), k = 3 + Math.floor(hash(i, seed + 4) * 3);
    for (let s = 0; s < k; s++) strokes.push({ cx: hash(i * 7 + s, seed + 5), cy: hash(i * 11 + s, seed + 6), rx: 0.18 + hash(i * 13 + s, seed + 7) * 0.42, ry: 0.18 + hash(i * 17 + s, seed + 8) * 0.42, dl: (hash(i * 19 + s, seed + 9) - 0.5) * 34 });
    F.push({ id: i, w, h, hue, strokes });
  }
  return F;
}

/** 任意面片（例如场景里每格的顶面 / 墙面）转成可烘的面：尺寸给定，笔触由 id 哈希出来，色相可指定。 */
export function facesFrom(list, { seed = CFG.SEED } = {}) {
  return list.map((f, i) => {
    const k = 3 + Math.floor(hash(i, seed + 4) * 3), strokes = [];
    for (let s = 0; s < k; s++) strokes.push({ cx: hash(i * 7 + s, seed + 5), cy: hash(i * 11 + s, seed + 6), rx: 0.18 + hash(i * 13 + s, seed + 7) * 0.42, ry: 0.18 + hash(i * 17 + s, seed + 8) * 0.42, dl: (hash(i * 19 + s, seed + 9) - 0.5) * 34 });
    return { id: i, w: Math.max(1, f.w | 0), h: Math.max(1, f.h | 0), hue: Number.isFinite(f.hue) ? Math.round(f.hue) % 360 : Math.floor(hash(i, seed + 3) * 360), strokes, key: f.key ?? i };
  });
}

const byHeight = (pad) => (a, b) => (b.h + 2 * pad) - (a.h + 2 * pad) || a.id - b.id;

/** 原版货架排布：按（含垫边的）高度降序一层层摆；放不下的记一笔、不硬塞。 */
export function shelfLayout(faces, atlasW, pad, atlasH = atlasW) {
  const order = [...faces].sort(byHeight(pad)), rects = new Array(faces.length);
  let x = 0, y = 0, shelfH = 0, fail = 0;
  for (const f of order) {
    const w = f.w + 2 * pad, h = f.h + 2 * pad;
    if (x + w > atlasW) { x = 0; y += shelfH; shelfH = 0; }
    if (y + h > atlasH) { fail++; continue; }
    rects[f.id] = { face: f.id, x: x + pad, y: y + pad, w: f.w, h: f.h, pw: w, ph: h, ox: x, oy: y };
    x += w; shelfH = Math.max(shelfH, h);
  }
  return { rects, fail, usedH: y + shelfH };
}

/** 共享增量图集排布：同样按高度降序逐个 allocate（TexelOwnerAtlas 会顺手写 owner / 垫边表）。 */
export function atlasLayout(faces, atlasW, pad, atlasH = atlasW) {
  const toa = new TexelOwnerAtlas(atlasW, atlasH, { pad }), rects = new Array(faces.length);
  let fail = 0, usedH = 0;
  for (const f of [...faces].sort(byHeight(pad))) {
    const r = toa.add(f.id, f.w, f.h);
    if (!r) { fail++; continue; }
    rects[f.id] = { face: f.id, x: r.x, y: r.y, w: f.w, h: f.h, pw: f.w + 2 * pad, ph: f.h + 2 * pad, ox: r.x - pad, oy: r.y - pad };
    usedH = Math.max(usedH, r.y + f.h + pad);
  }
  return { rects, fail, usedH, owner: toa };
}

const hsv = (h, s, v) => {
  const c = v * s, hp = (h % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0]; else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x]; else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

/** 烘焙：写颜色 + owner / pad 两张表；空白处填中性深灰（不填就是纯黑，截图里像坏了）。 */
export function bake(faces, rects, atlasW, atlasH, pad) {
  const N = atlasW * atlasH, rgb = new Uint8ClampedArray(N * 3), owner = new Int16Array(N).fill(-1), padMap = new Uint8Array(N);
  const put = (i, r, g, b) => { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; };
  for (let k = 0; k < N; k++) put(k, 42, 50, 56);
  for (const f of faces) {
    const r = rects[f.id];
    if (!r) continue;
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const u = (i + 0.5) / f.w, v = (j + 0.5) / f.h;
      let d = 0;
      for (const s of f.strokes) { const q = ((u - s.cx) / s.rx) ** 2 + ((v - s.cy) / s.ry) ** 2; if (q < 1) d += s.dl * (1 - q * 0.55); }
      const [R, G, B] = hsv(f.hue, 0.30, 0.55 + d / 100), k = (r.y + j) * atlasW + (r.x + i);
      put(k, R, G, B); owner[k] = f.id;
    }
    if (pad > 0) for (let j = -pad; j < f.h + pad; j++) for (let i = -pad; i < f.w + pad; i++) {
      if (i >= 0 && i < f.w && j >= 0 && j < f.h) continue;
      const xx = r.x + i;
      if (xx < 0 || xx >= atlasW) continue;
      const si = Math.min(f.w - 1, Math.max(0, i)), sj = Math.min(f.h - 1, Math.max(0, j));
      const src = (r.y + sj) * atlasW + (r.x + si), dst = (r.y + j) * atlasW + xx;
      if (dst < 0 || dst >= N) continue;
      rgb[dst * 3] = rgb[src * 3]; rgb[dst * 3 + 1] = rgb[src * 3 + 1]; rgb[dst * 3 + 2] = rgb[src * 3 + 2];
      owner[dst] = f.id; padMap[dst] = 1;
    }
  }
  return { rgb, owner, padMap, atlasW, atlasH };
}

/** 反查：像素 → (面, u, v, 是否垫边)。owner 表 O(1)。 */
export function resolve(A, rects, x, y) {
  const k = y * A.atlasW + x, f = A.owner[k];
  if (f < 0) return null;
  const r = rects[f];
  return { face: f, u: (x - r.x + 0.5) / r.w, v: (y - r.y + 0.5) / r.h, inPad: A.padMap[k] === 1 };
}

/** 双线性采样（像素中心在 +0.5）：返回颜色、四个采样点各属于哪个面（边界上会踩到邻面 = 串色）。 */
export function bilinear(A, x, y) {
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = (x - 0.5) - x0, fy = (y - 0.5) - y0;
  const out = [0, 0, 0], hits = new Set();
  let wsum = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const xi = Math.min(A.atlasW - 1, Math.max(0, x0 + i)), yi = Math.min(A.atlasH - 1, Math.max(0, y0 + j));
    const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), k = yi * A.atlasW + xi;
    out[0] += A.rgb[k * 3] * w; out[1] += A.rgb[k * 3 + 1] * w; out[2] += A.rgb[k * 3 + 2] * w;
    hits.add(A.owner[k]); wsum += w;
  }
  return { rgb: out, hits: [...hits], wsum };
}

/** 一种垫边、一种排布下的整套量法（与原版 measure 的每一项同定义）。 */
export function measureLayout(faces, { size = CFG.W, pad = CFG.PAD, pack = 'shelf', keep = false } = {}) {
  const lay = pack === 'atlas' ? atlasLayout(faces, size, pad) : shelfLayout(faces, size, pad);
  const { rects, fail, usedH } = lay, A = bake(faces, rects, size, size, pad);
  let faceArea = 0, padArea = 0;
  for (let k = 0; k < A.owner.length; k++) if (A.padMap[k]) padArea++;
  for (const f of faces) if (rects[f.id]) faceArea += f.w * f.h;
  let checked = 0, exact = 0, maxUV = 0;
  for (const f of faces) {
    const r = rects[f.id]; if (!r) continue;
    for (let j = 0; j < f.h; j += 3) for (let i = 0; i < f.w; i += 3) {
      const hit = resolve(A, rects, r.x + i, r.y + j);
      checked++;
      if (hit && hit.face === f.id && !hit.inPad) { exact++; maxUV = Math.max(maxUV, Math.abs(hit.u - (i + 0.5) / f.w), Math.abs(hit.v - (j + 0.5) / f.h)); }
    }
  }
  let edgeSamples = 0, bleed = 0, errSum = 0;
  for (const f of faces) {
    const r = rects[f.id]; if (!r) continue;
    const probes = [], n = 12;
    for (let t = 0; t < n; t++) { const u = (t + 0.5) / n; probes.push([r.x - 0.1, r.y + u * f.h], [r.x + f.w + 0.1, r.y + u * f.h], [r.x + u * f.w, r.y - 0.1], [r.x + u * f.w, r.y + f.h + 0.1]); }
    for (const [px, py] of probes) {
      const b = bilinear(A, px, py);
      edgeSamples++;
      if (b.hits.some((o) => o !== f.id)) bleed++;
      const cx = Math.min(r.x + f.w - 1, Math.max(r.x, Math.round(px))), cy = Math.min(r.y + f.h - 1, Math.max(r.y, Math.round(py))), k = cy * A.atlasW + cx;
      errSum += Math.abs(b.rgb[0] - A.rgb[k * 3]) + Math.abs(b.rgb[1] - A.rgb[k * 3 + 1]) + Math.abs(b.rgb[2] - A.rgb[k * 3 + 2]);
    }
  }
  const out = { pad, pack, size, fail, usedH, faceArea, padArea, occupancy: faceArea / (size * size), padShare: padArea / Math.max(1, faceArea + padArea),
    checked, exact, exactRate: exact / Math.max(1, checked), maxUV, edgeSamples, bleed, bleedRate: bleed / Math.max(1, edgeSamples), meanErr: errSum / Math.max(1, edgeSamples) / 3 };
  if (keep) { out.R = rects; out.A = A; }
  return out;
}

/** 原版 measure 的形状：{ 0: {...}, [CFG.PAD]: {...}, faces }；pack 默认 'shelf'（与原版逐值一致）。 */
export function measure({ faces = genFaces(), size = CFG.W, pads = [0, CFG.PAD], pack = 'shelf', keep = true } = {}) {
  const out = {};
  for (const pad of pads) out[pad] = measureLayout(faces, { size, pad, pack, keep });
  out.faces = faces.length;
  return out;
}

/** 下采样（2×2 平均）；混了归属的 texel 记 −1（谁也不是）——越小的 mip 越容易把邻面混进来。 */
export function mipDown(A, levels = 2) {
  let cur = { rgb: A.rgb, owner: A.owner, padMap: A.padMap, atlasW: A.atlasW, atlasH: A.atlasH };
  for (let l = 0; l < levels; l++) {
    const W = cur.atlasW >> 1, H = cur.atlasH >> 1, rgb = new Uint8ClampedArray(W * H * 3), owner = new Int16Array(W * H).fill(-1), padMap = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const acc = [0, 0, 0];
      let any = -1, mixed = false;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const k = (2 * y + j) * cur.atlasW + (2 * x + i), o = cur.owner[k];
        acc[0] += cur.rgb[k * 3]; acc[1] += cur.rgb[k * 3 + 1]; acc[2] += cur.rgb[k * 3 + 2];
        if (any === -1) any = o; else if (o !== any) mixed = true;
      }
      const d = y * W + x;
      rgb[d * 3] = acc[0] / 4; rgb[d * 3 + 1] = acc[1] / 4; rgb[d * 3 + 2] = acc[2] / 4;
      owner[d] = mixed ? -1 : any;
    }
    cur = { rgb, owner, padMap, atlasW: W, atlasH: H };
  }
  return cur;
}

/** mip 第 levels 级里混了归属的 texel 占「有面的 texel」的比例。 */
export function mipBleedShare(A, levels = 1) {
  const m = mipDown(A, levels);
  let used = 0, mixed = 0;
  for (let k = 0; k < m.owner.length; k++) {
    const x = k % m.atlasW, y = (k / m.atlasW) | 0, s = 1 << levels;
    let core = false;
    for (let j = 0; j < s && !core; j++) for (let i = 0; i < s && !core; i++) if (A.owner[(y * s + j) * A.atlasW + x * s + i] >= 0) core = true;
    if (!core) continue;
    used++; if (m.owner[k] < 0) mixed++;
  }
  return used ? mixed / used : 0;
}
