/**
 * town-skin.js — 第 56 批 C07：全城共用一张 128² 总贴图（TownColor），改这张图 = 整城换肤。
 *
 * 依据：
 *   1430227487376781317「Plus you can change the in-game textures now! So I guess the game is now ... "moddable"」
 *     画面：PS 打开 TownColor.png @200%（Layer 0, RGB/8），蓝笔在灰阶墙格上涂鸦，窗口滑走后整座小镇墙面 / 屋顶一起变蓝涂鸦。
 *   1241096929490149376「every-other-pixel-is-a-line tech ... one 128² texture and crisp antialiasing up close」
 *   1241046107125399552「I moved my plants to a 32² corner on the 128² texture I'm using for everything else」
 *
 * 本仓建筑原本只有逐面调色板顶点色、没有 UV。这里的做法（本地重建，不是原作资产 / 着色器）：
 *   - 图集 128×128，切 8×8 个 16px 色格；右下 2×2 格（x,y ∈ [96,128)）留给植物（32² 角，叶纹放在 R 通道）。
 *   - 生成网格时每个三角形记下它用的「调色板颜色对象」（未乘 shade、未烘焙）——同一颜色对象 = 同一色格。
 *     顶点上存：色格坐标 + 光照比（烘焙后顶点色 / 色格底色），着色时 颜色 = 图集采样 × 光照比。
 *     图集没改时，色格 = 底色 × 均值为 1 的细线纹 → 画面与原顶点色几乎一致；改了图集 → 每个用到该格的面一起变。
 *   - 色格内坐标由世界坐标按法线主轴平面投影（墙走竖直面、屋顶 / 地板走水平面），fract 重复。
 *   - 放大：每隔一像素一条线（core/texel-skip.js 的 skipTexel），近看锐利；
 *     缩小：本模块自己做色格内的 box 滤波 mip 链（16→8→4→2→1 px，每格独立、不跨格），按导数选级并在两级间插值。
 */

export const SKIN_SIZE = 128, SKIN_CELL = 16, SKIN_GRID = 8;
export const PLANT_RECT = Object.freeze({ x: 96, y: 96, w: 32, h: 32 });
/** 可用色格（去掉右下 2×2 植物角）：60 个 */
export const SKIN_SLOTS = (() => {
  const out = [];
  for (let gy = 0; gy < SKIN_GRID; gy++) for (let gx = 0; gx < SKIN_GRID; gx++) if (!(gx >= 6 && gy >= 6)) out.push([gx, gy]);
  return Object.freeze(out);
})();

/** 细线纹（均值 = 1）：每 4 行一条暗缝，砖缝错位；每隔一像素的亮线让 texel-skip 有东西可"跳"。 */
export function skinPattern(x, y) {
  const row = y >> 2, brick = ((x + (row & 1) * 4) & 7) === 7;
  const v = (y & 3) === 3 ? 0.86 : brick ? 0.92 : (x & 1) ? 1.03 : 1.06;
  return v / SKIN_PATTERN_MEAN;
}
const SKIN_PATTERN_MEAN = (() => {
  let s = 0;
  for (let y = 0; y < SKIN_CELL; y++) for (let x = 0; x < SKIN_CELL; x++) {
    const row = y >> 2, brick = ((x + (row & 1) * 4) & 7) === 7;
    s += (y & 3) === 3 ? 0.86 : brick ? 0.92 : (x & 1) ? 1.03 : 1.06;
  }
  return s / (SKIN_CELL * SKIN_CELL);
})();

/** 叶纹（与 core/leaf-atlas.js 同一个程序化 motif），写进 32² 植物角的 R/G/B。 */
export function writePlantCorner(data, size = SKIN_SIZE) {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const u = (x + .5) / 32, v = (y + .5) / 32;
    const wave = Math.cos(2 * Math.PI * (u * 4 + .15 * Math.sin(v * 8 * Math.PI))) * Math.cos(v * 8 * Math.PI);
    const value = Math.round(255 * (.5 + .5 * wave));
    data.set([value, value, value, 255], ((PLANT_RECT.y + y) * size + PLANT_RECT.x + x) * 4);
  }
}

/**
 * 颜色表 → 128² RGBA 图集（值 = 线性顶点色 × 255，原样存取，导出 / 再导入不做色彩空间换算）。
 * @param {{r:number,g:number,b:number}[]} colors 每个 slot 的底色（≤ 60）
 */
export function buildSkinAtlas(colors) {
  if (!Array.isArray(colors) || colors.length > SKIN_SLOTS.length) throw new RangeError('town-skin: 1..60 slot colours');
  const data = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255;
  colors.forEach((c, i) => {
    const [gx, gy] = SKIN_SLOTS[i];
    for (let y = 0; y < SKIN_CELL; y++) for (let x = 0; x < SKIN_CELL; x++) {
      const k = skinPattern(x, y), o = ((gy * SKIN_CELL + y) * SKIN_SIZE + gx * SKIN_CELL + x) * 4;
      data[o] = Math.min(255, Math.round(c.r * k * 255)); data[o + 1] = Math.min(255, Math.round(c.g * k * 255)); data[o + 2] = Math.min(255, Math.round(c.b * k * 255));
    }
  });
  writePlantCorner(data);
  return data;
}

/**
 * 色格内 box 滤波 mip 链，打包进同尺寸 128² 图：第 k 级（k=1..4，格宽 16>>k）放在 x 起点 128-256/2^k、y=0。
 * 每格只在自己内部平均（不跨格，色格之间不渗色）。
 */
export function buildSkinMips(level0) {
  if (!(level0 instanceof Uint8Array || level0 instanceof Uint8ClampedArray) || level0.length !== SKIN_SIZE * SKIN_SIZE * 4) throw new TypeError('town-skin: 128² RGBA');
  const out = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
  let prev = level0, prevW = SKIN_SIZE, prevS = SKIN_CELL;
  for (let k = 1; k <= 4; k++) {
    const s = SKIN_CELL >> k, W = SKIN_GRID * s, ox = SKIN_SIZE - 256 / (1 << k), cur = new Uint8Array(W * W * 4);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += prev[((y * 2 + dy) * prevW + x * 2 + dx) * 4 + ch];
      cur[(y * W + x) * 4 + ch] = Math.round(sum / 4);
    }
    for (let y = 0; y < W; y++) out.set(cur.subarray(y * W * 4, (y + 1) * W * 4), (y * SKIN_SIZE + ox) * 4);
    prev = cur; prevW = W; prevS = s;
  }
  return out;
}

/** 色格平均色（= mip 第 4 级那 1 像素），测试 / 统计用。 */
export function cellMean(data, slot) {
  const [gx, gy] = SKIN_SLOTS[slot]; let r = 0, g = 0, b = 0;
  for (let y = 0; y < SKIN_CELL; y++) for (let x = 0; x < SKIN_CELL; x++) { const o = ((gy * SKIN_CELL + y) * SKIN_SIZE + gx * SKIN_CELL + x) * 4; r += data[o]; g += data[o + 1]; b += data[o + 2]; }
  const n = SKIN_CELL * SKIN_CELL * 255; return { r: r / n, g: g / n, b: b / n };
}

/**
 * 每顶点色格 + 光照比。
 * @param {Float32Array|number[]} baked 烘焙后的顶点色（与网格同序）
 * @param {Array<{r,g,b}>} vertexBase 每个顶点的底色对象（未乘 shade）；null = 不换肤（保持顶点色）
 * @returns {{ cell: Float32Array, ratio: Float32Array, colors: {r,g,b}[], slotOf: Map, overflow: number }}
 */
export function skinAttributes(baked, vertexBase, { maxRatio = 3 } = {}) {
  const n = vertexBase.length;
  if (baked.length !== n * 3) throw new RangeError('town-skin: baked colour count mismatch');
  const slotOf = new Map(), colors = [], use = new Map();
  for (const c of vertexBase) if (c) { const k = keyOf(c); use.set(k, (use.get(k) || 0) + 1); if (!slotOf.has(k)) slotOf.set(k, c); }
  // 按使用量排序，前 60 个各占一格；更少用的颜色并进最近的格（overflow 计数）
  const keys = [...use.keys()].sort((a, b) => use.get(b) - use.get(a));
  const slotIndex = new Map();
  for (const k of keys.slice(0, SKIN_SLOTS.length)) { slotIndex.set(k, colors.length); colors.push(slotOf.get(k)); }
  let overflow = 0;
  for (const k of keys.slice(SKIN_SLOTS.length)) {
    const c = slotOf.get(k); let best = 0, bd = Infinity;
    colors.forEach((d, i) => { const e = (c.r - d.r) ** 2 + (c.g - d.g) ** 2 + (c.b - d.b) ** 2; if (e < bd) { bd = e; best = i; } });
    slotIndex.set(k, best); overflow++;
  }
  const cell = new Float32Array(n * 2).fill(-1), ratio = new Float32Array(n * 3).fill(1);
  // 一个三角形一个色格（取第一个顶点的颜色；triC 混色三角形三顶点颜色不同时也不会在面内插出错格），所以不需要 flat varying
  for (let v = 0; v < n; v++) {
    const c = vertexBase[v - (v % 3)] ?? vertexBase[v]; if (!c || !vertexBase[v]) continue;
    const s = slotIndex.get(keyOf(c)), base = colors[s], [gx, gy] = SKIN_SLOTS[s];
    cell[v * 2] = gx; cell[v * 2 + 1] = gy;
    const lum = (x) => x.r * .3 + x.g * .59 + x.b * .11, lb = Math.max(1e-4, lum(base)), lk = (baked[v * 3] * .3 + baked[v * 3 + 1] * .59 + baked[v * 3 + 2] * .11) / lb;
    for (let ch = 0; ch < 3; ch++) {
      const b0 = [base.r, base.g, base.b][ch];
      ratio[v * 3 + ch] = Math.min(maxRatio, b0 > 0.03 ? baked[v * 3 + ch] / b0 : lk);
    }
  }
  return { cell, ratio, colors, slotIndex, overflow };
}
const keyOf = (c) => ((Math.round(c.r * 4095) * 4096 + Math.round(c.g * 4095)) * 4096 + Math.round(c.b * 4095));

/** 片子里那几笔蓝色 S 形涂鸦（程序化）：画进 RGBA 图集的灰阶墙格区域（不碰植物角）。 */
export function scribble(data, { color = [20, 40, 230], seed = 7, strokes = 5, width = 3 } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
  let painted = 0;
  const dot = (cx, cy) => {
    for (let y = Math.floor(cy - width); y <= cy + width; y++) for (let x = Math.floor(cx - width); x <= cx + width; x++) {
      if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE || (x >= PLANT_RECT.x && y >= PLANT_RECT.y)) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > width * width) continue;
      const o = (y * SKIN_SIZE + x) * 4; if (data[o] !== color[0] || data[o + 1] !== color[1]) painted++;
      data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2];
    }
  };
  for (let k = 0; k < strokes; k++) {
    const y0 = 8 + rnd() * 30 + k * 18, amp = 10 + rnd() * 14, f = 1.5 + rnd() * 1.5, ph = rnd() * 6.28;
    for (let x = 4; x < 124; x += 0.5) dot(x, y0 + amp * Math.sin(x / 128 * f * 6.283 + ph) + x * 0.25);
  }
  return painted;
}

/** 着色器片段：顶点 / 片元。uC07Skin 关时完全不走。 */
export const SKIN_VERT_PARS = /* glsl */ `
attribute vec2 aC07Cell;
attribute vec3 aC07Ratio;
varying vec2 vC07Cell;
varying vec3 vC07Ratio;
varying vec2 vC07P;
uniform float uC07SkinScale;
`;
export const SKIN_VERT_BODY = /* glsl */ `
vC07Cell = aC07Cell; vC07Ratio = aC07Ratio;
{ vec3 an = abs(normalize(objectNormal)); vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vC07P = (an.y > 0.7 ? wp.xz : (an.x > an.z ? wp.zy : wp.xy)) * uC07SkinScale; }
`;
export const SKIN_FRAG_PARS = /* glsl */ `
uniform float uC07Skin;
uniform sampler2D uC07SkinTex;
uniform sampler2D uC07SkinMip;
varying vec2 vC07Cell;
varying vec3 vC07Ratio;
varying vec2 vC07P;
float c07Skip(float t, float footprint) {
  float p = floor(t * .5) * 2.0, f = t - p;
  float w = clamp(footprint, 0.00001, 1.0);
  return p + .5 + clamp((f - (2.0 - w)) / w, 0.0, 1.0) - (1.0 - clamp(f / w, 0.0, 1.0));
}
vec3 c07Level(float k, vec2 cell, vec2 t, vec2 fw) {
  if (k < 0.5) {
    vec2 q = clamp(vec2(c07Skip(t.x, fw.x), c07Skip(t.y, fw.y)), vec2(.5), vec2(15.5));
    return texture2D(uC07SkinTex, (cell * 16.0 + q) / 128.0).rgb;
  }
  float s = 16.0 / exp2(k), ox = 128.0 - 256.0 / exp2(k);
  vec2 q = clamp(t / exp2(k), vec2(.5), vec2(s - .5));
  return texture2D(uC07SkinMip, (vec2(ox, 0.0) + cell * s + q) / 128.0).rgb;
}
// 导数必须在分支外求（分支里 helper 像素不跑，SwiftShader 上会得到垃圾值 → 整片黑），所以 fw 由调用方传进来
vec3 c07Skin(vec2 cell, vec2 p, vec2 fw) {
  vec2 t = fract(p) * 16.0;
  float lod = clamp(log2(max(fw.x, fw.y)), 0.0, 4.0), k0 = floor(lod);
  return mix(c07Level(k0, cell, t, fw), c07Level(min(k0 + 1.0, 4.0), cell, t, fw), lod - k0);
}
`;
export const SKIN_FRAG_BODY = /* glsl */ `
vec2 c07fw = max((abs(dFdx(vC07P)) + abs(dFdy(vC07P))) * 16.0, vec2(.00001));
if (uC07Skin > 0.5 && vC07Cell.x > -0.5) { vec3 c07s = c07Skin(floor(vC07Cell + 0.5), vC07P, c07fw); diffuseColor.rgb = vec3(c07s.r * vC07Ratio.x, c07s.g * vC07Ratio.y, c07s.b * vC07Ratio.z); }
`;
