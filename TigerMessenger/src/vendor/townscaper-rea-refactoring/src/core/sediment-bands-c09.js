/**
 * sediment-bands-c09.js — 第 56 批 C09-C · 1699038611125985317「Looking att sedimentation lines again.
 * Helps make large cliffs more interesting. Also makes their shape a bit more readable maybe.」
 *
 * 片子（620 帧；原尺寸 60/100 复看）：高崖上是**宽窄不一**的水平层带——大段浅色、夹几条中等褐带、
 * 带与带的交界有一条细深线；层带在多面崖上同高连续（世界 Y 决定），不是等距正弦条纹。
 * 旧 sediment.js mode1/2 是等周期 sin 明暗 + 每周期一条线，读起来是均匀斑马纹。
 *
 * 裁判对照（REACode 原版 engine/surface.js，2026-11-24 逐式提取，REACode 只读）：
 *   层带密度   surfLine1((wp.y-uSurfBase)*5.4, 1.25)：每 1/5.4 ≈ 0.185 世界单位一条细暗线
 *              → BAND_SLOTS 从 5 改 2.7：默认周期 0.5 下槽坐标 s = y*5.4，与裁判逐式一致。
 *   宽窄结构   surfBandTone：bandIdx=floor(y*5.4)，mod 2 奇偶两色交替（±0.16*(tone-.5) → ±0.08 亮度）；
 *              surfLine1(y*1.8+.31, 1.7)：每第 3 条交界是更宽的主层理（1.8 = 5.4/3，像素宽 1.7 vs 1.25）。
 *              → 本文件：岩性 run 负责「宽窄带」（C09 帧读出的四岩性，裁判无此项，程序近似已记录），
 *               另加裁判的奇偶两色 ±0.08 与每-3-交界主线（s/3+.31）。
 *   配色      裁判只有两色奇偶交替（米黄/浅粉各 ±8% 亮度，无第三色）；本地四岩性亮度 0.75–1.10
 *              幅度大于裁判——无原调色板，按 C09 帧目测的程序近似，保留并记录。
 *   线深      c *= mix(1,.54,mask)：细线压暗到 0.586（mask .9）、主线到 .54；本地 mix(1,.54,m) 同款。
 *   裂纹      裁判 surfLine2((x+z)*.75, y*.22, px 1.1) 权重 .35 → 已移植（sbLine2）。
 *   砂砾      裁判 surfGravel：层理线附近 20% 哈希点、×1.45+.02 提亮、px>.55 关 → 已移植。
 *   抖动场    裁判 sWarp 位移 vec3(b,a,b*.7)*uSedAmp 含 xz：2026-11-26 已逐式移植
 *             （sediment.js 同一份 sHash/sNoise/sWobble/sWarp，弯层模式用
 *             sed=p+sWarp(p) 采样——层理读 sed.y、裂纹/砂砾读 sed.x/sed.z，
 *             与裁判 sed=wp+sWarp(wp) 同构）；解析逆不存在，(x,z) 定点迭代可逆。
 *   未移植    海拔色偏 mix→(1.06,1.01,.93)/7wu：裁判是全局层（地面也吃），不是沉积项；
 *             原作真实位移场/调色板未知——裁判场是重构近似，分开记录，不宣称原作一致。
 *   反射/阴影  裁判材质 MeshStandardMaterial roughness .92 / metalness 0，**没有**沉积专用高光项；
 *              一致性的来源：沉积只改 diffuseColor（albedo），光照/阴影在其后统一计算——
 *              本地同构（sedimentColor 注入 color_fragment，lighting 不变），此项结构上已对齐。
 *
 * mode 3 = 直层（只看 y），mode 4 = 弯层（采样点先加 sWarp 位移再查层柱，几何不动）。
 * 抗锯齿：层线走裁判的像素宽式（fwidth→约 1.25/1.7px），槽交界按 fwidth 混合相邻槽；
 * 槽比像素还细时岩性淡出到平均色（远景不闪；裁判没有这项，是本地抗闪改进）。
 */
export const BAND_SLOTS = 2.7;
// 浅 / 本色 / 褐（偏暖）/ 中：片子里浅带偏奶白、窄带偏赭褐；没有原调色板，按帧目测的程序化替代。
// 裁判（surface.js）只量化出两色奇偶 ±0.08 亮度，四岩性的幅度比裁判大，已记录为程序近似。
export const BAND_COLORS = Object.freeze([[1.13, 1.11, 1.07], [1, 1, 1], [0.86, 0.75, 0.64], [0.95, 0.9, 0.84]]);
export const BAND_TONES = Object.freeze(BAND_COLORS.map((c) => (c[0] + c[1] + c[2]) / 3));
// 裁判两色层理：bandIdx 奇偶交替 ±0.08 亮度（surfBandTone × 0.16）。
export const BAND_PARITY = Object.freeze([1.08, 0.92]);
export function parityTone(k) { return BAND_PARITY[((k % 2) + 2) % 2]; }
const fract = (x) => x - Math.floor(x);
/** 与 GLSL 同式的整数哈希（sin 哈希在 k 很大时 float32 会漂；层号只到几百，够用）。 */
export function bandHash(k, salt = 0) { return fract(Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453); }
export function bandType(k) { const h = bandHash(k); return h < 0.34 ? 0 : h < 0.66 ? 1 : h < 0.86 ? 2 : 3; }
export function bandTone(k) { return BAND_TONES[bandType(k)] * parityTone(k); }
/**
 * 交界 k（槽 k-1 与槽 k 之间）是否有**深线**：裁判是「每条交界细线 + 每第 3 条主线」，
 * 细线由着色器逐交界画（见 GLSL 的 sbLine1）；这里回答的是 fx 预览要画深色 3D 线的那一档：
 * 每第 3 条主层理，或岩性变化且哈希通过（C09 帧里深线只压住一部分交界）。
 */
export function bandLine(k) { return k % 3 === 0 || (bandType(k) !== bandType(k - 1) && bandHash(k, 1) < 0.62); }
/** 是否主层理交界（裁判每第 3 条更宽）。 */
export function bandMajor(k) { return ((k % 3) + 3) % 3 === 0; }
/** CPU 参考：高度 y（已剪切）→ { tone, line, major, slot }（不含抗锯齿，用于测试结构）。 */
export function sedimentBandAt(y, { period = 0.5 } = {}) {
  if (!Number.isFinite(y) || !(period > 0)) throw new RangeError('sediment band inputs');
  const s = y / period * BAND_SLOTS, k = Math.floor(s), f = s - k, kb = f < 0.5 ? k : k + 1;
  return {
    slot: k, tone: bandTone(k),
    line: f < 0.08 || f > 0.92,                          // 细线：每条交界（裁判）
    major: bandMajor(kb), deep: (f < 0.08 && bandLine(k)) || (f > 0.92 && bandLine(k + 1)),
  };
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
// ── 裁判 engine/surface.js 移植：像素宽 1D/2D 线、2D 哈希 ─────────────────
float sbHash2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float sbLine1(float p,float px){float fw=max(fwidth(p),1e-4);float f=fract(p);float d=min(f,1.-f);float w=clamp(fw*px,0.0015,0.24);float line=1.-smoothstep(w*.3,w,d);float fade=1.-smoothstep(.16,.38,fw);return line*fade;}
float sbLine2(vec2 p,float px){vec2 fw=fwidth(p);vec2 f=fract(p);vec2 d=min(f,1.-f);float w=clamp(max(max(fw.x,fw.y)*px,0.0015),0.,0.24);float line=1.-smoothstep(w*.3,w,min(d.x,d.y));float fade=1.-smoothstep(.16,.38,max(fw.x,fw.y));return line*fade;}
vec3 sedimentBandsColor(vec3 color,vec3 p){
  // 裁判 sed=wp+sWarp(wp)：弯层模式下层理/裂纹/砂砾都吃歪过的采样点（含 xz）
  vec3 sed=p+(uStrataMode>3.5?sWarp(p):vec3(0.));
  float y=sed.y;
  float s=y/uStrata.x*${BAND_SLOTS}, k=floor(s), f=s-k, w=max(fwidth(s),1e-4);
  // 岩性柱（C09 近似）+ 槽界混合；奇偶两色是裁判 surfBandTone 的 ±0.08。
  vec3 tone=sbTone(k);
  tone=mix(tone,sbTone(k+1.),smoothstep(1.-w,1.+w,f)*.5);
  tone=mix(tone,sbTone(k-1.),(1.-smoothstep(-w,w,f))*.5);
  tone*=mod(k,2.)<.5?1.08:.92;
  float fade=smoothstep(.25,.6,w);
  tone=mix(tone,vec3(.98,.96,.93),fade);
  // 线掩码按裁判 surfCliff：每条交界细线(px1.25)×.9 + 每第3条主线(px1.7)×.55 + 裂纹(px1.1)×.35。
  float minor=sbLine1(s,1.25);
  float major=sbLine1(s/3.+.31,1.7);
  float crack=sbLine2(vec2((sed.x+sed.z)*.75,y*.22),1.1);
  float m=clamp(minor*.9+major*.55+crack*.35,0.,1.)*(1.-fade);
  vec3 c=color*tone;
  c*=mix(1.,.54,m);
  // 裁判 surfGravel：层理线附近的浅色砂砾点（远处自关）。
  vec2 gcell=floor(vec2((sed.x+sed.z)*26.,y*26.));
  float gpx=max(fwidth(sed.x+sed.z)*26.,fwidth(y)*26.);
  float gravel=gpx>.55?0.:step(.80,sbHash2(gcell))*smoothstep(.26,.47,abs(fract(s)-.5))*(1.-gpx*1.6);
  c=mix(c,c*1.45+.02,gravel*.5);
  return mix(color,c,uStrata.z);
}
`;
