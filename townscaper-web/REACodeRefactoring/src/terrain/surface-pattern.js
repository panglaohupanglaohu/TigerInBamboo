/**
 * surface-pattern.js — engine/surface.js 的通用表面层：法线混合的投影 patch（地面格纹 / 崖面层理），
 * 像素宽细线 + 缩小淡出、"把世界弄歪再算"的弯曲层理、两色层、砂砾、抽象田野干涉线、坡面草、调试视角。
 *
 * 1781405550061687016 "seamless patch blending … Some of the patches are projected"：地面 XZ 投影、崖面竖直投影，
 *   两者按 n.y 的 smoothstep 混合（遮罩由几何导出 → 网格变了也无缝）。
 * 1241096929490149376 "UVs speed past every 2nd pixel … crisp antialiasing up close"：线宽按 fwidth 求「像素宽」，
 *   放大时保持约 1 像素；格子缩到 ~2 像素以下时淡出到均值（代替 mip，避免摩尔纹）。
 * 1714613599035863191 抽象田野：两族低频 sin 干涉场取细线，线距不等、跨格连续，格子边从弯线里跳出来。
 * 1699038611125985317 / 1699146321318314094 沉积线两色 + 抖动采样坐标（几何/法线/光照不动）。
 * 1313841094069817344 texture-only / light-only 调试输出。
 *
 * JS 参考实现与 GLSL 同式；JS 侧用 footprint（一个像素覆盖的世界长度）代替 fwidth。
 * attachSurfacePattern() 以链式 onBeforeCompile 挂到任意 three 标准材质上（不替换材质，不碰 View）。
 * 未做：挂进 View 的共享地形材质（view.js 由另一会话持有）；没有原作手绘 atlas / 球面投射 / 岸带手工 UV 贴图本体。
 */

const fract = (x) => x - Math.floor(x);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function spHash(x, y) {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d;
  return fract(px * py);
}
export function spNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = spHash(ix, iy), b = spHash(ix + 1, iy), c = spHash(ix, iy + 1), d = spHash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export const spWobble = (x, y) => spNoise(x, y) * .72 + spNoise(x * 2.07 + 17.3, y * 2.07 + 17.3) * .28;
/** 只返回采样坐标的抖动量；调用方 p+warp 后做线性纹理数学，几何不动。 */
export function spWarp(p, { sedAmp = .24, sedFreq = .52 } = {}) {
  const qx = p[0] * sedFreq, qz = p[2] * sedFreq;
  const a = spWobble(qx + 3.1, qz + 3.1) - .5, b = spWobble(qx * .87 + 41.7, qz * .87 + 41.7) - .5;
  return [b * sedAmp, a * sedAmp, b * .7 * sedAmp];
}
/** 二维格线：fw = 该坐标每像素变化量（fwidth）。 */
export function spLine2(p, fw, px) {
  const f = Math.max(fw[0], fw[1]), d = Math.min(Math.min(fract(p[0]), 1 - fract(p[0])), Math.min(fract(p[1]), 1 - fract(p[1])));
  const w = clamp(Math.max(f * px, .0015), 0, .24);
  return (1 - sstep(w * .3, w, d)) * (1 - sstep(.16, .38, f));
}
export function spLine1(p, fw, px) {
  fw = Math.max(fw, 1e-4); const d = Math.min(fract(p), 1 - fract(p)), w = clamp(fw * px, .0015, .24);
  return (1 - sstep(w * .3, w, d)) * (1 - sstep(.16, .38, fw));
}
export function spGround(p, fw) { return clamp(spLine2(p, fw, 1.35) * .9 + spLine2([p[0] * .25, p[1] * .25], [fw[0] * .25, fw[1] * .25], 1.15) * .7, 0, 1); }
export function spCliff(wp, fp, base = 0) {
  const band = spLine1((wp[1] - base) * 5.4, 5.4 * fp, 1.25), major = spLine1((wp[1] - base) * 1.8 + .31, 1.8 * fp, 1.7);
  const crack = spLine2([(wp[0] + wp[2]) * .75, (wp[1] - base) * .22], [1.5 * fp, .22 * fp], 1.1);
  return clamp(band * .9 + major * .55 + crack * .35, 0, 1);
}
export const spBandTone = (wp, base = 0) => { const k = Math.floor((wp[1] - base) * 5.4); return ((k % 2) + 2) % 2; };
export function spGravel(wp, fp, base = 0) {
  const px = Math.max(2 * fp * 26, fp * 26); if (px > .55) return 0;
  const g = spHash(Math.floor((wp[0] + wp[2]) * 26), Math.floor(wp[1] * 26)) >= .8 ? 1 : 0;
  return g * sstep(.26, .47, Math.abs(fract((wp[1] - base) * 5.4) - .5)) * (1 - px * 1.6);
}
/** 抽象田野场值（两族 sin 干涉 + 高度项）。 */
export function spFieldPhase(wp, freq = 13.5) {
  return Math.sin((wp[0] + wp[2] * .35) * freq + spWobble(wp[0] * .28, wp[2] * .28) * 1.6) * .5
    + Math.sin((wp[2] - wp[0] * .3) * freq * 1.13 + spWobble(wp[0] * .28 + 11, wp[2] * .28 + 11) * 1.6) * .5 + wp[1] * .5;
}
export function spFieldLines(wp, fp, freq = 13.5) {
  const h = 1e-3, f = spFieldPhase(wp, freq);
  const gx = (spFieldPhase([wp[0] + h, wp[1], wp[2]], freq) - f) / h, gz = (spFieldPhase([wp[0], wp[1], wp[2] + h], freq) - f) / h;
  const px = Math.max((Math.abs(gx) + Math.abs(gz)) * fp, 1e-4); if (px > .5) return 0;
  const d = Math.abs(fract(f) - .5), w = clamp(px * .55, .003, .07);
  return (1 - sstep(w * .45, w, .5 - d)) * (1 - sstep(.22, .46, px));
}

export const SURFACE_DEFAULTS = Object.freeze({ strength: 1, scale: 1, base: 0, sedAmp: .24, sedFreq: .52, fieldAmt: 0, fieldFreq: 13.5, slopeGrass: 0, viewMode: 0 });
export function validateSurfaceOptions(o = {}) {
  const v = { ...SURFACE_DEFAULTS, ...o };
  for (const k of Object.keys(SURFACE_DEFAULTS)) if (!Number.isFinite(v[k])) throw new RangeError(`surface ${k}`);
  if (v.strength < 0 || v.strength > 1 || v.scale < .05 || v.scale > 16 || v.sedAmp < 0 || v.sedFreq <= 0 || v.fieldAmt < 0 || v.fieldAmt > 1 || v.fieldFreq <= 0 || v.slopeGrass < 0 || v.slopeGrass > 1 || ![0, 1, 2].includes(v.viewMode)) throw new RangeError('surface option bounds');
  return v;
}
/** 原版 color_fragment 体的 CPU 版：返回着色后的反照率与各层诊断量。fp = 一个像素对应的世界长度。 */
export function surfaceShade(color, wp, normal, fp, opts = {}) {
  const o = validateSurfaceOptions(opts);
  if (!Array.isArray(color) || color.length !== 3 || ![...wp, ...normal, fp].every(Number.isFinite) || fp <= 0) throw new RangeError('surface shade inputs');
  const l = Math.hypot(...normal), sn = normal.map((x) => x / l), sc = o.scale;
  const ground = spGround([wp[0] * 2.1 * sc, wp[2] * 2.1 * sc], [2.1 * sc * fp, 2.1 * sc * fp]);
  const wv = spWarp(wp, o), sed = wp.map((x, i) => x + wv[i]), cs = Math.max(sc, .25);
  const cliff = spCliff(sed.map((x) => x / cs), fp / cs, o.base), gravel = spGravel(sed, fp, o.base) * o.strength, tone = spBandTone(sed, o.base);
  const alt = clamp((wp[1] - o.base) / 7, 0, 1);
  const flatness = sstep(.45, .82, sn[1]), mask = cliff + (ground - cliff) * flatness, steep = 1 - sstep(.35, .8, sn[1]);
  let c = color.map((x, i) => x * (1 + ([.06, .01, -.07][i]) * alt));
  c = c.map((x) => x * (1 + (tone - .5) * .16 * steep * o.strength));
  c = c.map((x) => x * (1 + (.54 - 1) * clamp(mask, 0, 1) * o.strength));
  let field = 0;
  if (o.fieldAmt > 1e-3) { field = spFieldLines(wp, fp, o.fieldFreq); const k = clamp(field * o.fieldAmt, 0, 1) * (.55 + .45 * flatness); c = c.map((x) => x + (x * .45 - x) * k); }
  let band = 0;
  if (o.slopeGrass > 1e-3) {
    const slope = 1 - Math.abs(sn[1]); band = sstep(.16, .3, slope) * (1 - sstep(.6, .8, slope));
    const stub = spLine2([wp[0] * 8 + wp[1], wp[2] * 8 + wp[1]], [8 * fp, 8 * fp], 1);
    const grass = c.map((x, i) => x * ([.84, 1.05, .72][i] + ([.70, 1.00, .58][i] - [.84, 1.05, .72][i]) * stub));
    c = c.map((x, i) => x + (grass[i] - x) * band * o.slopeGrass);
  }
  const gk = gravel * (1 - flatness) * .5; c = c.map((x) => x + (x * 1.45 + .02 - x) * gk);
  return { color: c, ground, cliff, flatness, mask, tone, gravel, field, slopeBand: band, warp: wv };
}

export const SURFACE_PATTERN_GLSL = `
uniform vec4 uSpA;   // strength, scale, base, viewMode
uniform vec4 uSpB;   // sedAmp, sedFreq, fieldAmt, fieldFreq
uniform float uSpSlopeGrass;
varying vec3 vSpPos;
varying vec3 vSpNrm;
float spHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float spNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(spHash(i),spHash(i+vec2(1,0)),f.x),mix(spHash(i+vec2(0,1)),spHash(i+vec2(1,1)),f.x),f.y);}
float spWobble(vec2 p){return spNoise(p)*.72+spNoise(p*2.07+17.3)*.28;}
vec3 spWarp(vec3 wp){vec2 q=wp.xz*uSpB.y;float a=spWobble(q+3.1)-.5,b=spWobble(q*.87+41.7)-.5;return vec3(b,a,b*.7)*uSpB.x;}
float spLine2(vec2 p,float px){vec2 fw=fwidth(p);vec2 f=fract(p);vec2 d=min(f,1.-f);float w=clamp(max(max(fw.x,fw.y)*px,.0015),0.,.24);return (1.-smoothstep(w*.3,w,min(d.x,d.y)))*(1.-smoothstep(.16,.38,max(fw.x,fw.y)));}
float spLine1(float p,float px){float fw=max(fwidth(p),1e-4);float f=fract(p);float d=min(f,1.-f);float w=clamp(fw*px,.0015,.24);return (1.-smoothstep(w*.3,w,d))*(1.-smoothstep(.16,.38,fw));}
float spGround(vec2 p){return clamp(spLine2(p,1.35)*.9+spLine2(p*.25,1.15)*.7,0.,1.);}
float spCliff(vec3 wp){float band=spLine1((wp.y-uSpA.z)*5.4,1.25);float major=spLine1((wp.y-uSpA.z)*1.8+.31,1.7);float crack=spLine2(vec2((wp.x+wp.z)*.75,(wp.y-uSpA.z)*.22),1.1);return clamp(band*.9+major*.55+crack*.35,0.,1.);}
float spBandTone(vec3 wp){return mod(floor((wp.y-uSpA.z)*5.4),2.);}
float spGravel(vec3 wp){vec2 cell=floor(vec2((wp.x+wp.z)*26.,wp.y*26.));float px=max(fwidth(wp.x+wp.z)*26.,fwidth(wp.y)*26.);if(px>.55)return 0.;return step(.8,spHash(cell))*smoothstep(.26,.47,abs(fract((wp.y-uSpA.z)*5.4)-.5))*(1.-px*1.6);}
float spFieldLines(vec3 wp){float f=sin((wp.x+wp.z*.35)*uSpB.w+spWobble(wp.xz*.28)*1.6)*.5+sin((wp.z-wp.x*.30)*uSpB.w*1.13+spWobble(wp.xz*.28+11.)*1.6)*.5+wp.y*.5;float px=max(fwidth(f),1e-4);if(px>.5)return 0.;float d=abs(fract(f)-.5);float w=clamp(px*.55,.003,.07);return (1.-smoothstep(w*.45,w,.5-d))*(1.-smoothstep(.22,.46,px));}
vec3 surfacePatternShade(vec3 base,vec3 wp,vec3 nIn){
  vec3 sn=normalize(nIn);float sc=uSpA.y;
  float ground=spGround(wp.xz*2.1*sc);vec3 sed=wp+spWarp(wp);
  float cliff=spCliff(sed/max(sc,.25)),gravel=spGravel(sed)*uSpA.x,tone=spBandTone(sed);
  float alt=clamp((wp.y-uSpA.z)/7.,0.,1.);vec3 c=base*mix(vec3(1.),vec3(1.06,1.01,.93),alt);
  float flatness=smoothstep(.45,.82,sn.y),mask=mix(cliff,ground,flatness),steep=1.-smoothstep(.35,.80,sn.y);
  c*=1.+(tone-.5)*.16*steep*uSpA.x; c*=mix(1.,.54,clamp(mask,0.,1.)*uSpA.x);
  if(uSpB.z>.001){float fl=spFieldLines(wp);c=mix(c,c*.45,clamp(fl*uSpB.z,0.,1.)*mix(.55,1.,flatness));}
  if(uSpSlopeGrass>.001){float slope=1.-abs(sn.y);float band=smoothstep(.16,.30,slope)*(1.-smoothstep(.60,.80,slope));float stub=spLine2(wp.xz*8.+wp.y,1.);vec3 grass=mix(c*vec3(.84,1.05,.72),c*vec3(.70,1.,.58),stub);c=mix(c,grass,band*uSpSlopeGrass);}
  return mix(c,c*1.45+.02,gravel*(1.-flatness)*.5);
}
`;

/** uniform 值（无 three 依赖）。 */
export function surfacePatternUniformValues(opts = {}) {
  const o = validateSurfaceOptions(opts);
  return { uSpA: [o.strength, o.scale, o.base, o.viewMode], uSpB: [o.sedAmp, o.sedFreq, o.fieldAmt, o.fieldFreq], uSpSlopeGrass: o.slopeGrass };
}

/**
 * 原版 makeSurfaceMaterial 的可组合版：链式 onBeforeCompile 挂到已有材质（保留之前的补丁与缓存键）。
 * makeUniform(value) 由调用方传入（three: v => ({value}), 向量值用 THREE.Vector4 由调用方决定）。
 */
export function attachSurfacePattern(material, opts = {}, { wrap = (v) => ({ value: v }) } = {}) {
  if (!material || typeof material !== 'object') throw new TypeError('material required');
  const vals = surfacePatternUniformValues(opts), uniforms = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, wrap(v)]));
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    const need = ['#include <common>', '#include <begin_vertex>'], needF = ['#include <common>', '#include <color_fragment>', '#include <opaque_fragment>'];
    for (const t of need) if (!shader.vertexShader.includes(t)) throw new Error(`surface pattern: vertex token ${t} missing`);
    for (const t of needF) if (!shader.fragmentShader.includes(t)) throw new Error(`surface pattern: fragment token ${t} missing`);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSpPos;\nvarying vec3 vSpNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpPos=(modelMatrix*vec4(transformed,1.)).xyz;\nvSpNrm=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURFACE_PATTERN_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=surfacePatternShade(diffuseColor.rgb,vSpPos,vSpNrm);')
      .replace('#include <opaque_fragment>', 'if(uSpA.w>.5){gl_FragColor=vec4(uSpA.w<1.5?diffuseColor.rgb:vec3(dot(outgoingLight,vec3(.299,.587,.114))),diffuseColor.a);}else{\n#include <opaque_fragment>\n}');
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+surface-pattern-v1';
  material.userData = material.userData || {}; material.userData.surfacePattern = uniforms;
  return uniforms;
}
