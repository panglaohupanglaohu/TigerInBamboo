/**
 * sediment-bands-c09.js — 第 56 批 C09-C · 1699038611125985317「Looking att sedimentation lines again.
 * Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe.」
 *
 * 片子（620 帧；原尺寸 60/100 复看）：高崖上是**宽窄不一**的水平层带——大段浅色、夹几条中等褐带、
 * 带与带的交界有一条细深线；层带在多面崖上同高连续（世界 Y 决定），不是等距正弦条纹。
 * 旧 sediment.js mode1/2 是等周期 sin 明暗 + 每周期一条线，读起来是均匀斑马纹。
 *
 * 这里的「层柱」：把世界高度切成 period/SLOTS 的细槽，每槽按整数哈希抽一种岩性（浅 / 本色 / 褐 / 中），
 * 相邻槽同岩性就连成宽带，所以带宽自然宽窄相间；岩性变化的交界按哈希保留一部分画细深线。
 * mode 3 = 直层（只看 y），mode 4 = 弯层（y 先加 sedimentOffset 剪切再查层柱，undo 不需要——几何不动）。
 * 抗锯齿：槽交界按 fwidth 混合相邻槽；槽比像素还细时整体淡出到平均色（远景不闪）。
 */
export const BAND_SLOTS = 5;
// 浅 / 本色 / 褐（偏暖）/ 中：片子里浅带偏奶白、窄带偏赭褐；没有原调色板，按帧目测的程序化替代
export const BAND_COLORS = Object.freeze([[1.13, 1.11, 1.07], [1, 1, 1], [0.86, 0.75, 0.64], [0.95, 0.9, 0.84]]);
export const BAND_TONES = Object.freeze(BAND_COLORS.map((c) => (c[0] + c[1] + c[2]) / 3));
const fract = (x) => x - Math.floor(x);
/** 与 GLSL 同式的整数哈希（sin 哈希在 k 很大时 float32 会漂；层号只到几百，够用）。 */
export function bandHash(k, salt = 0) { return fract(Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453); }
export function bandType(k) { const h = bandHash(k); return h < 0.34 ? 0 : h < 0.66 ? 1 : h < 0.86 ? 2 : 3; }
export function bandTone(k) { return BAND_TONES[bandType(k)]; }
/** 交界 k（槽 k-1 与槽 k 之间）是否画细深线：岩性变了且哈希通过。 */
export function bandLine(k) { return bandType(k) !== bandType(k - 1) && bandHash(k, 1) < 0.62; }
/** CPU 参考：高度 y（已剪切）→ { tone, line, slot }（不含抗锯齿，用于测试结构）。 */
export function sedimentBandAt(y, { period = 0.5 } = {}) {
  if (!Number.isFinite(y) || !(period > 0)) throw new RangeError('sediment band inputs');
  const s = y / period * BAND_SLOTS, k = Math.floor(s), f = s - k;
  return { slot: k, tone: bandTone(k), line: (f < 0.08 && bandLine(k)) || (f > 0.92 && bandLine(k + 1)) };
}
/** 一段高度内的层带列表（连续同岩性的槽合并），给测试 / 页面统计带宽分布。 */
export function bandRuns(y0, y1, { period = 0.5 } = {}) {
  const k0 = Math.floor(y0 / period * BAND_SLOTS), k1 = Math.ceil(y1 / period * BAND_SLOTS), runs = [];
  for (let k = k0; k < k1; k++) {
    const t = bandType(k), last = runs[runs.length - 1];
    if (last && last.type === t) last.slots++; else runs.push({ type: t, start: k, slots: 1, line: bandLine(k) });
  }
  return runs;
}

export const SEDIMENT_BANDS_GLSL = `
float sbHash(float k,float salt){return fract(sin(k*12.9898+salt*78.233)*43758.5453);}
float sbType(float k){float h=sbHash(k,0.);return h<.34?0.:h<.66?1.:h<.86?2.:3.;}
vec3 sbTone(float k){float t=sbType(k);return t<.5?vec3(1.13,1.11,1.07):t<1.5?vec3(1.):t<2.5?vec3(.86,.75,.64):vec3(.95,.9,.84);}
float sbLine(float k){return (abs(sbType(k)-sbType(k-1.))>.5 && sbHash(k,1.)<.62)?1.:0.;}
vec3 sedimentBandsColor(vec3 color,vec3 p){
  float y=p.y+(uStrataMode>3.5?sedimentOffset(p.xz,uStrata.y):0.0);
  float s=y/uStrata.x*${BAND_SLOTS}.0, k=floor(s), f=s-k, w=max(fwidth(s),1e-4);
  vec3 tone=sbTone(k);
  tone=mix(tone,sbTone(k+1.),smoothstep(1.-w,1.+w,f)*.5);
  tone=mix(tone,sbTone(k-1.),(1.-smoothstep(-w,w,f))*.5);
  float d=min(f,1.-f), kb=f<.5?k:k+1.;
  float line=sbLine(kb)*(1.-smoothstep(w*.6,w*1.6+.02,d));
  float fade=smoothstep(.25,.6,w);
  tone=mix(tone,vec3(.98,.96,.93),fade); line*=1.-fade;
  return mix(color,color*tone*mix(1.,.58,line),uStrata.z);
}
`;
