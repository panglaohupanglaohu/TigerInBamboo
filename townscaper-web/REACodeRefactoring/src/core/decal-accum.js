/**
 * decal-accum.js — 第 56 批 C07：每帧往表面图集里「累加」一批方块贴花（1427721874490933250）。
 *
 * 原文：「Here's a very quick technical test. Though this one is continuously adding decals, so it looks a bit like
 *   claymation or line boil. ... And obviously you'd need some padding for the seams.」
 * 画面：0000–0010 帧灰岩底上的黄绿方块逐帧盖满；之后镜头缓动，方块边缘每帧都在变（相邻帧差分远大于镜头位移应有的量）。
 *
 * 本地实现（非原作代码）：
 *   - 一张 RGBA 图集，横排 K 个「图表」（chart），每个 chart = 内部 S×S + 四周 pad 像素的边距。
 *   - 表面用 fract(世界坐标 × 比例) 在 chart 内部平铺采样，所以贴花要在 chart 内部按环面（toroidal）绕回；
 *   - 每帧 stamp(n)：在随机位置盖 n 个轴对齐方块（边长 minSize..maxSize，颜色取 chart 自己的色板），新的压旧的；
 *   - fillPadding()：把每个 chart 内部的对边像素复制进边距 —— 双线性采样跨过平铺接缝时读到的是绕回的同一张图，
 *     不是隔壁 chart（pad=0 时就会「吃到邻居」，见测试里的 bleed 度量）。
 */

export function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class DecalAtlas {
  /**
   * @param {{ charts: { base:number[], palette:number[][] }[], size?:number, pad?:number, seed?:number, minSize?:number, maxSize?:number }} o
   */
  constructor({ charts, size = 64, pad = 2, seed = 1, minSize = 3, maxSize = 7 }) {
    if (!Array.isArray(charts) || !charts.length) throw new TypeError('decal-accum: charts required');
    if (!(size >= 8 && pad >= 0 && pad < size / 2 && minSize >= 1 && maxSize >= minSize)) throw new RangeError('decal-accum: bad sizes');
    Object.assign(this, { charts, size, pad, minSize, maxSize });
    this.stride = size + 2 * pad;
    this.width = this.stride * charts.length; this.height = this.stride;
    this.data = new Uint8Array(this.width * this.height * 4);
    this.rng = mulberry(seed); this.frame = 0; this.stamped = 0;
    this.clear();
  }
  clear() {
    this.charts.forEach((ch, k) => { for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.#put(k, x, y, ch.base); });
    this.fillPadding();
  }
  #put(k, x, y, c) {
    const o = ((this.pad + y) * this.width + k * this.stride + this.pad + x) * 4;
    this.data[o] = c[0]; this.data[o + 1] = c[1]; this.data[o + 2] = c[2]; this.data[o + 3] = 255;
  }
  /** 内部像素读（chart 局部坐标，环面绕回） */
  texel(k, x, y) {
    x = ((x % this.size) + this.size) % this.size; y = ((y % this.size) + this.size) % this.size;
    const o = ((this.pad + y) * this.width + k * this.stride + this.pad + x) * 4; return [this.data[o], this.data[o + 1], this.data[o + 2]];
  }
  /** 每个 chart 盖 n 个方块；返回本次改动的像素数 */
  stamp(n = 12) {
    let changed = 0;
    this.charts.forEach((ch, k) => {
      for (let i = 0; i < n; i++) {
        const w = this.minSize + Math.floor(this.rng() * (this.maxSize - this.minSize + 1)), h = this.minSize + Math.floor(this.rng() * (this.maxSize - this.minSize + 1));
        const x0 = Math.floor(this.rng() * this.size), y0 = Math.floor(this.rng() * this.size), c = ch.palette[Math.floor(this.rng() * ch.palette.length)];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const tx = (x0 + x) % this.size, ty = (y0 + y) % this.size, o = ((this.pad + ty) * this.width + k * this.stride + this.pad + tx) * 4;
          if (this.data[o] !== c[0] || this.data[o + 1] !== c[1] || this.data[o + 2] !== c[2]) changed++;
          this.data[o] = c[0]; this.data[o + 1] = c[1]; this.data[o + 2] = c[2];
        }
        this.stamped++;
      }
    });
    this.fillPadding(); this.frame++;
    return changed;
  }
  /** 边距 = 对边内部像素（环面），角上取对角 */
  fillPadding() {
    const { pad, size, stride, width } = this; if (!pad) return;
    for (let k = 0; k < this.charts.length; k++) for (let y = -pad; y < size + pad; y++) for (let x = -pad; x < size + pad; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) continue;
      const c = this.texel(k, x, y), o = ((pad + y) * width + k * stride + pad + x) * 4;
      this.data[o] = c[0]; this.data[o + 1] = c[1]; this.data[o + 2] = c[2]; this.data[o + 3] = 255;
    }
  }
  /** chart k 内部 [0,1)² 的 UV → 整张图集 UV（着色器里用同一公式） */
  uv(k, u, v) { return [(k * this.stride + this.pad + u * this.size) / this.width, (this.pad + v * this.size) / this.height]; }
  /** CPU 双线性采样整张图集（测 bleed 用；像素中心在 +0.5） */
  bilinear(U, V) {
    const x = U * this.width - .5, y = V * this.height - .5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (xx, yy) => { xx = Math.max(0, Math.min(this.width - 1, xx)); yy = Math.max(0, Math.min(this.height - 1, yy)); const o = (yy * this.width + xx) * 4; return [this.data[o], this.data[o + 1], this.data[o + 2]]; };
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return [0, 1, 2].map((i) => (a[i] * (1 - fx) + b[i] * fx) * (1 - fy) + (c[i] * (1 - fx) + d[i] * fx) * fy);
  }
  /**
   * 接缝渗色度量：沿 chart k 的平铺接缝（u=0 / u=1 处），双线性采样值与「环面正确值」（两侧内部像素的平均）的最大差。
   * pad ≥ 1 时为 0；pad = 0 时会读到隔壁 chart / 图集外。
   */
  seamBleed(k) {
    let worst = 0;
    for (let y = 0; y < this.size; y++) {
      const v = (y + .5) / this.size, [U, V] = this.uv(k, 0, v), got = this.bilinear(U, V);
      const a = this.texel(k, -1, y), b = this.texel(k, 0, y), want = [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
      worst = Math.max(worst, ...got.map((g, i) => Math.abs(g - want[i])));
    }
    return worst;
  }
}

/** 片子的配色：chart 0 = 草顶（灰底 → 黄绿方块），chart 1 = 岩壁（灰底 → 深浅灰方块） */
export const BOIL_CHARTS = Object.freeze([
  { base: [128, 130, 126], palette: [[196, 196, 120], [180, 186, 104], [206, 204, 138], [166, 176, 110], [150, 156, 112], [214, 208, 150]] },
  { base: [118, 122, 124], palette: [[128, 132, 134], [110, 114, 120], [140, 142, 142], [102, 106, 114], [122, 126, 124]] },
]);

export const DECAL_FRAG_PARS = /* glsl */ `
uniform float uC07Decal;
uniform sampler2D uC07DecalTex;
uniform vec4 uC07DecalGeo;   // stride, pad, size, width(px)
uniform float uC07DecalScale;
vec3 c07Decal(float k, vec2 p) {
  vec2 f = fract(p);
  vec2 px = vec2(k * uC07DecalGeo.x + uC07DecalGeo.y, uC07DecalGeo.y) + f * uC07DecalGeo.z;
  return texture2D(uC07DecalTex, px / vec2(uC07DecalGeo.w, uC07DecalGeo.x)).rgb;
}
`;
