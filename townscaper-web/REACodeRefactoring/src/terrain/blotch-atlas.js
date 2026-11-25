/**
 * blotch-atlas.js — engine/blotch.js 的笔触图集 + 台地边缘场 + 受控渗漏，接共享 World/grid。
 *
 * 1696864977171189980 "draw with much bigger blotches without the blotches bleeding across and messing up important edges"
 * 1696896119794479541 "Look how neat and controlled the grass blotches bleed over the cliff edges."
 * 1703750394164199473 "the swirly blobbyness"  1704246032626762189 "variable density … height segmentation lines"
 * 1786014232594485497 山体：把坡向条纹当明暗画进贴图，而不是加法线。
 *
 * 移植的机制（原版 createBlotchAtlas / createRimField / BODY）：
 *   - 可平铺 128² 图集：R 冷色大笔触、G 暖色笔触、B 细颗粒；周期值噪声 + Math.imul 哈希（原版踩过浮点哈希把分布压扁的坑）
 *   - 边缘场：源 = 顶面高度与任一边邻居不同（或外圈）的台地格；chamfer 距离变换（世界单位），G = 本格顶面高度
 *   - B = **崖肩顶面高度**（邻域 max 窗口）：崖面片元的世界 XZ 正好压在台地边界上，双线性取 G 会与**下面那一格**
 *     的顶面混成一半（r169 实测 below 常为 −0.2…−1.9 → bleedMask 恒 0，等深带量不出来）→ 「我这一侧崖肩有多高」
 *     必须取邻域最高顶面，不能取本纹素。R/G 语义不变（node 测试仍按 G=本格顶校验）。
 *   - 受控渗漏：只在 rimDist≈0 的崖面上、垂直方向到 bleed 深度齐平收口（底边是等深线）
 *   - 漩涡角度场、低频密度、高度分段线、坡向条纹：CPU 参考函数 + 同式 GLSL
 * 数据直接读共享 World（top / grid.edgeNeighbors），World.version 变化即重烘；不另建世界。
 * 已接进 View 地表材质：view-shading.js `?shade=blotchatlas`（uShBR → COLOR_BODY 乘 diffuseColor，
 * 只动 albedo、不改高光/粗糙度 —— 与裁判 MeshStandardMaterial 上沉积/笔触只改 diffuseColor 同构）。
 */
import { buildCellIndex, decorateCells } from '../core/spatial.js';

export function blotchHash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function periodicNoise(u, v, period, seed) {
  const x = u * period, y = v * period, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), wrap = (n) => ((n % period) + period) % period;
  const h = (a, b) => blotchHash(wrap(a), wrap(b), seed);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx, b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}
export function periodicFbm(u, v, basePeriod, octaves, seed) {
  let sum = 0, amp = 1, norm = 0, p = basePeriod;
  for (let o = 0; o < octaves; o++) { sum += periodicNoise(u, v, p, seed + o * 101) * amp; norm += amp; amp *= .5; p *= 2; }
  return sum / norm;
}

/** 原版 createBlotchAtlas 的数据部分（无 three 依赖；调用方自行包 DataTexture，RepeatWrapping + mipmap）。 */
export function createBlotchAtlasData({ size = 128, basePeriod = 3, seed = 11 } = {}) {
  if (!Number.isInteger(size) || size < 8 || size > 1024 || !Number.isInteger(basePeriod) || basePeriod < 2 || basePeriod > 32 || !Number.isInteger(seed)) throw new RangeError('blotch atlas options');
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = (y * size + x) * 4;
    data[i] = Math.round(periodicFbm(u, v, basePeriod, 3, seed) * 255);
    data[i + 1] = Math.round(periodicFbm(u, v, basePeriod - 1, 3, seed + 977) * 255);
    data[i + 2] = Math.round(periodicFbm(u, v, basePeriod * 12, 2, seed + 313) * 255);
    data[i + 3] = 255;
  }
  return { data, size, basePeriod, seed, wrap: 'repeat', mipmaps: true };
}
/** 双线性 + repeat 采样，返回 0..1 四通道。 */
export function sampleBlotchAtlas(atlas, u, v) {
  if (![u, v].every(Number.isFinite)) throw new RangeError('atlas uv');
  const { data, size } = atlas, x = (u - Math.floor(u)) * size - .5, y = (v - Math.floor(v)) * size - .5;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, w = (n) => ((n % size) + size) % size, out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const a = data[(w(y0) * size + w(x0)) * 4 + k], b = data[(w(y0) * size + w(x0 + 1)) * 4 + k];
    const c = data[(w(y0 + 1) * size + w(x0)) * 4 + k], d = data[(w(y0 + 1) * size + w(x0 + 1)) * 4 + k];
    out[k] = ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 255;
  }
  return out;
}

/**
 * 原版 createRimField，改读共享 World：栅格中心落在哪个格子由共享 cellIndex 决定（不按包围盒刷）。
 * 源点 = 台地崖肩格（顶面与任一边邻居不同或在外圈）。距离为世界单位 chamfer（正反两遍）。
 *
 * 三个通道：R = 到崖肩的水平距离 / maxDist、G = 本纹素所属格的顶面高度、B = **崖肩顶面高度**。
 * B 是把 G 做一次 (2·shoulder+1)² 的 max 窗口（纹素）—— 崖面片元的 XZ 压在台地边界上，
 * 直接双线性取 G 会掺进下面那一格的顶（below 变负 → 渗漏永远为 0）。shoulder=0 时 B ≡ G（旧口径，仅供对照）。
 */
export function buildBlotchRimField(world, { res = 96, maxDist = 1, levelHeight = .5, index = null, shoulder = 2 } = {}) {
  if (!world || !world.grid || !Array.isArray(world.cells)) throw new TypeError('shared World required');
  if (!Number.isInteger(res) || res < 8 || res > 512 || !Number.isFinite(maxDist) || maxDist <= 0 || !Number.isFinite(levelHeight) || levelHeight <= 0) throw new RangeError('rim field options');
  if (!Number.isInteger(shoulder) || shoulder < 0 || shoulder > 8) throw new RangeError('rim shoulder window');
  if (world.cells.some((c) => !Number.isFinite(c.minX))) decorateCells(world.grid);
  const cells = world.cells, idx = index ?? buildCellIndex(world.grid);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxTop = 1;
  for (const c of cells) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); maxTop = Math.max(maxTop, world.top(c)); }
  if (!Number.isFinite(minX)) throw new RangeError('empty grid');
  const spanX = Math.max(1e-4, maxX - minX), spanZ = Math.max(1e-4, maxZ - minZ), tx = spanX / res, tz = spanZ / res, td = Math.hypot(tx, tz);
  const topSpan = maxTop * levelHeight, n = res * res;
  const dist = new Float32Array(n).fill(Infinity), topY = new Float32Array(n), owner = new Int32Array(n).fill(-1);
  const rimCell = new Uint8Array(cells.length);
  for (const c of cells) {
    const top = world.top(c); if (top <= 0) continue;
    for (const nid of c.edgeNeighbors) { const nb = nid >= 0 ? world.grid.cells[nid] : null; if (!nb || world.top(nb) !== top) { rimCell[c.id] = 1; break; } }
  }
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    const c = idx.cellAt(minX + (x + .5) * tx, minZ + (z + .5) * tz), i = z * res + x;
    if (!c) continue; owner[i] = c.id; const top = world.top(c);
    if (top <= 0) continue; topY[i] = top * levelHeight; if (rimCell[c.id]) dist[i] = 0;
  }
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    const i = z * res + x; let b = dist[i]; if (b === 0) continue;
    if (x > 0) b = Math.min(b, dist[i - 1] + tx); if (z > 0) b = Math.min(b, dist[i - res] + tz);
    if (x > 0 && z > 0) b = Math.min(b, dist[i - res - 1] + td); if (x < res - 1 && z > 0) b = Math.min(b, dist[i - res + 1] + td);
    dist[i] = b;
  }
  for (let z = res - 1; z >= 0; z--) for (let x = res - 1; x >= 0; x--) {
    const i = z * res + x; let b = dist[i];
    if (x < res - 1) b = Math.min(b, dist[i + 1] + tx); if (z < res - 1) b = Math.min(b, dist[i + res] + tz);
    if (x < res - 1 && z < res - 1) b = Math.min(b, dist[i + res + 1] + td); if (x > 0 && z < res - 1) b = Math.min(b, dist[i + res - 1] + td);
    dist[i] = b;
  }
  const data = new Uint8Array(n * 4);
  // 崖肩高度：邻域 max（把「崖上那一格」的顶面铺到墙脚/墙面的纹素上，双线性才不会被下格拉低）
  const shoulderY = new Float32Array(n);
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    let m = 0;
    for (let dz = -shoulder; dz <= shoulder; dz++) { const zz = z + dz; if (zz < 0 || zz >= res) continue;
      for (let dx = -shoulder; dx <= shoulder; dx++) { const xx = x + dx; if (xx < 0 || xx >= res) continue; const v = topY[zz * res + xx]; if (v > m) m = v; } }
    shoulderY[z * res + x] = m;
  }
  const q8 = (v, span) => Math.round(Math.min(1, v / Math.max(1e-3, span)) * 255);
  for (let i = 0; i < n; i++) {
    const d = Math.min(maxDist, dist[i]), v = Math.round(d / maxDist * 255);
    data[i * 4] = v; data[i * 4 + 1] = q8(topY[i], topSpan); data[i * 4 + 2] = q8(shoulderY[i], topSpan); data[i * 4 + 3] = 255;
  }
  const rimCount = rimCell.reduce((s, v) => s + v, 0);
  return { res, maxDist, topSpan, levelHeight, shoulder, dist, topY, shoulderY, owner, data, rimCell, rimCount, xform: [minX, minZ, 1 / spanX, 1 / spanZ], version: world.version,
    /** 世界 XZ → [rimDist(世界单位, ≤maxDist), 本格顶面高度, 崖肩顶面高度]，与着色器同一 clamp-to-edge 双线性口径 */
    sample(xw, zw) {
      if (![xw, zw].every(Number.isFinite)) throw new RangeError('rim sample');
      const u = Math.min(1, Math.max(0, (xw - minX) / spanX)) * res - .5, v = Math.min(1, Math.max(0, (zw - minZ) / spanZ)) * res - .5;
      const cl = (k) => Math.min(res - 1, Math.max(0, k)), x0 = Math.floor(u), z0 = Math.floor(v), fx = u - x0, fz = v - z0;
      const g = (arr, a, b) => arr[cl(b) * res + cl(a)];
      const bil = (arr, cap) => { const f = (a, b) => Math.min(cap, g(arr, a, b)); return (f(x0, z0) * (1 - fx) + f(x0 + 1, z0) * fx) * (1 - fz) + (f(x0, z0 + 1) * (1 - fx) + f(x0 + 1, z0 + 1) * fx) * fz; };
      return [bil(dist, maxDist), bil(topY, Infinity), bil(shoulderY, Infinity)];
    } };
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 原版 BODY 的遮罩：顶面靠 rimMask 在边前收住；崖面只在 rimDist≈0 处渗下去、到 bleed 深度齐平停。 */
export function blotchMasks({ rimDist, below, normalY, bleed = .14 }) {
  if (![rimDist, below, normalY, bleed].every(Number.isFinite) || bleed < 0) throw new RangeError('blotch mask inputs');
  const rimMask = sstep(.06, .30, rimDist), flatMask = sstep(.88, .985, normalY);
  const bleedMask = bleed > 0 ? (1 - flatMask) * sstep(.10, .02, rimDist) * sstep(bleed, bleed * .35, below) * sstep(0, .04, below) : 0;
  return { rimMask, flatMask, bleedMask };
}
function bNoise(x, y) {
  const h = (a, b) => { let px = (a * 123.34) % 1, py = (b * 456.21) % 1; px = px < 0 ? px + 1 : px; py = py < 0 ? py + 1 : py; const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d; const r = (px * py) % 1; return r < 0 ? r + 1 : r; };
  const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export const blotchWobble = (x, y) => bNoise(x, y) * .72 + bNoise(x * 2.07 + 17.3, y * 2.07 + 17.3) * .28;
/** 漩涡：低频角度场旋转采样坐标（线性映射，周期格仍铺满平面，不产生接缝）。 */
export function swirlUV(x, z, { scale = .09, swirl = 2.3 } = {}) {
  const u = x * scale, v = z * scale; if (swirl <= 1e-3) return [u, v, 0];
  const ang = (blotchWobble(x * .3, z * .3) - .5) * 2 * swirl, c = Math.cos(ang), s = Math.sin(ang);
  return [c * u + s * v, -s * u + c * v, ang];   // GLSL mat2(ca,-sa,sa,ca) 列主序
}
/** 完整色块调色（顶面/崖面），与 BLOTCH_RIM_GLSL 同式；footprint = fwidth 的世界口径。
 *  below 用 **崖肩顶面高度**（B 通道）减本片元高度 —— 崖面 XZ 压在台地边界上，用本纹素顶面会掺下格。 */
export function blotchRimTint(atlas, rim, p, normal, { strength = 1, bleed = .14, streak = .75, density = .55, swirl = 2.3, segments = .12, scale = .09, segFootprint = .02 } = {}) {
  const [rimDist, localTop, shoulderTop] = rim.sample(p[0], p[2]), below = shoulderTop - p[1];
  const len = Math.hypot(...normal), n = normal.map((v) => v / len);
  const { rimMask, flatMask, bleedMask } = blotchMasks({ rimDist, below, normalY: n[1], bleed });
  const [bu, bv] = swirlUV(p[0], p[2], { scale, swirl }), bl = sampleBlotchAtlas(atlas, bu, bv);
  const cold = sstep(.44, .60, bl[0]), warm = sstep(.55, .70, bl[1]), edge = sstep(.36, .48, bl[0]) * sstep(.70, .54, bl[0]);
  const low = sampleBlotchAtlas(atlas, bu * .22, bv * .22), dens = (1 - density) + (density * 1.45) * sstep(.34, .66, low[1]);
  const topW = cold * rimMask * flatMask * dens, cliffW = cold * bleedMask * .9, w = (topW + cliffW) * strength;
  const w2 = warm * rimMask * flatMask * strength * (1 - cold * .75);
  let t = [1, 1, 1]; const mixv = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  t = mixv(t, [.86, 1.02, .74], w); t = mixv(t, [1.16, .88, .70], w2); t = t.map((x) => x * (1 - edge * topW * .1));
  const steep = 1 - flatMask;
  if (segments > 1e-3) { const py = p[1] * 1.8, pxw = Math.max(segFootprint * 1.8, 1e-4), dd = Math.abs(((py % 1) + 1) % 1 - .5), segW = Math.min(.12, Math.max(.004, pxw * .9));
    const seg = (1 - sstep(segW * .4, segW, .5 - dd)) * (1 - sstep(.2, .42, pxw)) * steep; t = t.map((x) => x * (1 - seg * segments)); }
  const dl = Math.hypot(n[0], n[2]), down = dl > 1e-3 ? [-n[0] / dl, -n[2] / dl] : [0, 1], perp = [-down[1], down[0]];
  const st = sstep(.46, .60, sampleBlotchAtlas(atlas, (p[0] * perp[0] + p[2] * perp[1]) * .055, (p[0] * down[0] + p[2] * down[1]) * .008)[1]) * steep * streak;
  t = t.map((x) => x * (1 + .34 * st) * (1 - .15 * steep * streak * (1 - st)) * (1 + .12 * steep * streak * sstep(.40, .04, below)));
  // 细颗粒（裁判 BODY 末项，2026-11-24 补）：只在色块权重内撒 B 通道高频点，像素宽淡出防远处噪闪。
  // CPU 侧没有 fwidth，segFootprint 就是「|fwidth(wp.xz)| 的世界口径」参数（同 seg 线共用）。
  const grainRes = 1 - sstep(.010, .030, segFootprint * 14);
  const grain = (bl[2] >= .80 ? 1 : 0) * w * .22 * grainRes;
  t = t.map((x) => x * (1 - grain));
  return { tint: t, rimDist, below, localTop, shoulderTop, rimMask, flatMask, bleedMask, cold, warm, density: dens, coverage: w, grain };
}

/** 与上面同式的 GLSL（函数名 br* 前缀，避免与 BLOTCH_GLSL 的 bh/bn/bfbm 冲突）。需要 vec3 wp 世界坐标与世界法线。 */
export const BLOTCH_RIM_GLSL = `
uniform sampler2D uBlotchAtlas;
uniform sampler2D uBlotchRim;
uniform vec4 uBlotchRimX;
uniform vec4 uBlotchRimP;   // x=rimSpan(maxDist) y=topSpan z=scale w=strength
uniform vec4 uBlotchRimQ;   // x=bleed y=streak z=density w=swirl
uniform float uBlotchRimSeg;
float brHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float brNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(brHash(i),brHash(i+vec2(1,0)),f.x),mix(brHash(i+vec2(0,1)),brHash(i+vec2(1,1)),f.x),f.y);}
float brWobble(vec2 p){return brNoise(p)*.72+brNoise(p*2.07+17.3)*.28;}
vec3 blotchRimTint(vec3 wp, vec3 nIn){
  vec3 n=normalize(nIn);
  vec4 rt=texture2D(uBlotchRim,clamp((wp.xz-uBlotchRimX.xy)*uBlotchRimX.zw,0.,1.));
  float rimDist=rt.r*uBlotchRimP.x, below=rt.b*uBlotchRimP.y-wp.y;   // B = 崖肩顶面（邻域 max），不是本纹素 G
  float rimMask=smoothstep(.06,.30,rimDist), flatMask=smoothstep(.88,.985,n.y);
  // r172：bleed=0 必须真的关掉。smoothstep(0,0,below) 是退化区间（e1-e0=0 → 除法溢出 → 钳成 1），
  // 于是 bleed=0 在 GPU 上等于「无限深」——与 CPU 的 \`bleed>0 ? … : 0\` 相反，也让 bleed=0/20 逐像素相同。
  float bleedMask=(1.-flatMask)*smoothstep(.10,.02,rimDist)*smoothstep(uBlotchRimQ.x,uBlotchRimQ.x*.35,below)*smoothstep(0.,.04,below)*step(1e-4,uBlotchRimQ.x);
  vec2 buv=wp.xz*uBlotchRimP.z;
  if(uBlotchRimQ.w>.001){float a=(brWobble(wp.xz*.3)-.5)*2.*uBlotchRimQ.w;float ca=cos(a),sa=sin(a);buv=mat2(ca,-sa,sa,ca)*buv;}
  vec4 bl=texture2D(uBlotchAtlas,buv);
  float cold=smoothstep(.44,.60,bl.r), warm=smoothstep(.55,.70,bl.g), edge=smoothstep(.36,.48,bl.r)*smoothstep(.70,.54,bl.r);
  float dens=mix(1.-uBlotchRimQ.z,1.+uBlotchRimQ.z*.45,smoothstep(.34,.66,texture2D(uBlotchAtlas,buv*.22).g));
  float topW=cold*rimMask*flatMask*dens, w=(topW+cold*bleedMask*.9)*uBlotchRimP.w, w2=warm*rimMask*flatMask*uBlotchRimP.w*(1.-cold*.75);
  vec3 t=mix(vec3(1.),vec3(.86,1.02,.74),w); t=mix(t,vec3(1.16,.88,.70),w2); t*=1.-edge*topW*.10;
  float steep=1.-flatMask;
  if(uBlotchRimSeg>.001){float py=wp.y*1.8,pxw=max(fwidth(py),1e-4),dd=abs(fract(py)-.5),sw=clamp(pxw*.9,.004,.12);t*=1.-(1.-smoothstep(sw*.4,sw,.5-dd))*(1.-smoothstep(.2,.42,pxw))*steep*uBlotchRimSeg;}
  float dl=length(n.xz); vec2 dn=dl>1e-3?-n.xz/dl:vec2(0.,1.), pp=vec2(-dn.y,dn.x);
  float st=smoothstep(.46,.60,texture2D(uBlotchAtlas,vec2(dot(wp.xz,pp)*.055,dot(wp.xz,dn)*.008)).g)*steep*uBlotchRimQ.y;
  t*=(1.+.34*st)*(1.-.15*steep*uBlotchRimQ.y*(1.-st))*(1.+.12*steep*uBlotchRimQ.y*smoothstep(.40,.04,below));
  // 细颗粒（裁判 BODY 末项）：B 通道高频点只在色块权重内撒，像素宽>阈值淡出（远处不闪）
  float grainRes=1.-smoothstep(.010,.030,length(fwidth(wp.xz))*14.);
  t*=1.-step(.80,bl.b)*w*.22*grainRes;
  return t;
}
`;
/** uniform 值（不依赖 three）：调用方把 atlas.data / rim.data 包成纹理后填入 sampler。 */
export function blotchRimUniformValues(rim, { scale = .09, strength = 1, bleed = .14, streak = .75, density = .55, swirl = 2.3, segments = .12 } = {}) {
  if (![scale, strength, bleed, streak, density, swirl, segments].every(Number.isFinite) || scale <= 0 || strength < 0 || strength > 1 || bleed < 0 || density < 0 || density > 1 || swirl < 0 || swirl > 6) throw new RangeError('blotch rim uniforms');
  return { uBlotchRimX: rim.xform, uBlotchRimP: [rim.maxDist, rim.topSpan, scale, strength], uBlotchRimQ: [bleed, streak, density, swirl], uBlotchRimSeg: segments };
}
