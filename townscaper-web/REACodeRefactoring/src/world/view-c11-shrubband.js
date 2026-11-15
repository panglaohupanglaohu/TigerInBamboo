/**
 * view-c11-shrubband.js — 第 56 批 C11 · 1707490932017279035（?c11=shrubband，默认关）
 * 原文："They are of course 100% texture, painted onto a fairly low, poly mesh. ... Especially with the lil' shadows, they look
 *  quite volumetric as they are."
 * 第 60 轮已有：View 主材质 shrubApply（顶面沿崖边一条纯贴图灌木带 + 扇贝外缘 + 内侧小阴影，?debug shrubtex）。
 * 本开关补两项（第 60 轮记的「仍缺」）：
 *   ① 带宽随崖高缩放：bakeShrubDropMap 写每格最大崖边落差，shrubApply 的 width 乘 shrubDropScale(drop)（1 层 0.8 → ≥4 层 1.6）；
 *   ② 高崖壁每一层台阶线下挂一条灌木带（片子 0150：高塔崖壁上三层各压一条橙带，带下有一道小阴影），只画中间台阶，
 *      顶沿仍由顶面带负责。纯着色器，不加几何。
 *  第 60 轮记的「水面倒影暖色」：本批逐帧复看 257 帧，海面是平涂青绿 + 深色投影，看不到倒影 → 不属于本片，记为过时。
 *  第 75 轮（本批）：**② 降为默认关**。600 帧片 frame-0340…0499（高塔崖壁近景，8 张联系表逐页看过）再确认一次：
 *    橙带只出现在**每级台阶顶面外沿**（绕转角连续、跨到下一级就断），**竖直崖壁面是米白/浅棕，一点橙都没有**。
 *    所以「挂在竖直面上」的那条带是错的落点（r74 已判为「转角接缝」病根），宽度收成 0 当默认，
 *    顶面外沿的带由 shrubApply（按 world.top 的 aEdge）+ c11ShrubScale 带宽随崖高缩放负责，中间台阶不会缺。
 *    `setWallBand(k)` 保留 opt-in（k=1 复现旧观感）用于对照，默认 0。
 */
import * as THREE from 'three';
import { bakeShrubDropMap } from '../core/c11-maps.js';

export const SHRUB_C11_GLSL = /* glsl */`
uniform float uC11SB; uniform sampler2D uC11SBMap; uniform vec4 uC11SBX; uniform float uC11SBWall;
vec4 c11SBs(vec2 xz) { vec2 uv = (xz - uC11SBX.xy) * uC11SBX.zw; if (uv.x < 0. || uv.y < 0. || uv.x >= 1. || uv.y >= 1.) return vec4(0.); return texture2D(uC11SBMap, uv); }
float c11ShrubScale(vec3 w) { if (uC11SB < .5) return 1.; float d = c11SBs(w.xz).g * 15.; return .8 + .8 * clamp((d - 1.) / 3., 0., 1.); }
`;
export const SHRUB_C11_WALL = /* glsl */`
vec3 c11WallShrub(vec3 base, vec3 w, float L) {
  if (uC11SBWall <= .001) return base;                        // 第 75 轮：默认关（原片崖壁无橙）
  // 崖壁属于高的那格：四个方向各偏 0.07 取样，取顶层最高的
  vec4 s = c11SBs(w.xz + vec2(.07, 0.)), q;
  q = c11SBs(w.xz - vec2(.07, 0.)); if (q.r > s.r) s = q;
  q = c11SBs(w.xz + vec2(0., .07)); if (q.r > s.r) s = q;
  q = c11SBs(w.xz - vec2(0., .07)); if (q.r > s.r) s = q;
  if (s.b < .5) return base;
  float top = floor(s.r * 15. + .5), drop = floor(s.g * 15. + .5);
  float k = floor(w.y / L + 1e-3) + 1.;                       // 上方最近的台阶线
  if (k >= top || k <= top - drop) return base;               // 只画中间台阶
  float cover = smoothstep(.38, .5, bfbm(w.xz * .45 + vec2(k * 3.1, 1.7)));
  if (cover < .01) return base;
  float below = (k * L - w.y) / L;                            // 0 = 台阶线，往下增大
  float rag = (bfbm(vec2(w.x + w.z, k) * 7.0) - .5) * .09 + (bn(vec2(w.x * 23. + w.z * 19., k)) - .5) * .05;
  float width = (.13 + .06 * bfbm(w.xz * 1.3 + k)) * cover * uC11SBWall;
  float d = below + rag, aa = fwidth(d) * 1.2 + .003;
  float body = 1. - smoothstep(width - aa, width + aa, d);
  float shadow = (1. - smoothstep(width + .07 - aa, width + .07 + aa, d)) * (1. - body);
  float lit = smoothstep(.45, .7, bfbm(vec2(w.x + w.z, w.y) * 2.4 + 31.));
  vec3 shrub = uShrubColor * mix(.88, 1.1, lit);
  vec3 c = mix(base, base * (1. - .4 * uShrubStyle.z), shadow);
  return mix(c, shrub, body);
}
`;
const WIDTH_TOKEN = 'float width = uShrubStyle.x * (';
const APPLY_TOKEN = 'diffuseColor.rgb = shrubApply(diffuseColor.rgb, vEdge, vWPos);';
export function patchShrubShader(sh, levelHeight) {
  for (const t of ['uniform float uShrub;', WIDTH_TOKEN, APPLY_TOKEN]) if (!sh.fragmentShader.includes(t)) throw new Error('shrubband token ' + t);
  sh.fragmentShader = sh.fragmentShader
    .replace(WIDTH_TOKEN, 'float width = uShrubStyle.x * c11ShrubScale(w) * (')
    .replace('uniform float uShrub;', 'uniform float uShrub;\nuniform vec4 uShrubStyle;\nuniform vec3 uShrubColor;\n' + SHRUB_C11_GLSL + '#define C11_SHRUB_DECLARED\n')
    .replace(APPLY_TOKEN, APPLY_TOKEN + `\nif (uC11SB > .5 && uShrub > .5 && vField.z < -.5 && vField.z > -1.5 && abs(vUp) < .35) diffuseColor.rgb = c11WallShrub(diffuseColor.rgb, vWPos, ${levelHeight.toFixed(4)});`);
  // SHRUB_GLSL 自己也声明 uShrubStyle / uShrubColor —— 去掉它那两行重复声明
  sh.fragmentShader = sh.fragmentShader.replace('#define C11_SHRUB_DECLARED\nuniform vec4 uShrubStyle;', '#define C11_SHRUB_DECLARED\n');
  sh.fragmentShader = dedupe(sh.fragmentShader);
  // 墙带函数放在 main 之前（依赖 bfbm / bn / uShrubColor，都在 common 段）
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', SHRUB_C11_WALL + '\nvoid main() {');
  return sh;
}
/** 删除第二次出现的 uShrubStyle / uShrubColor 声明（SHRUB_GLSL 原有的那两行）。 */
function dedupe(src) {
  for (const decl of ['uniform vec4 uShrubStyle;', 'uniform vec3 uShrubColor;']) {
    const a = src.indexOf(decl), b = src.indexOf(decl, a + decl.length);
    if (a >= 0 && b >= 0) src = src.slice(0, b) + src.slice(b + decl.length);
  }
  return src;
}

export function install(view) {
  const mat = view.material, blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  const u = { uC11SB: { value: 0 }, uC11SBMap: { value: blank }, uC11SBX: { value: new THREE.Vector4(0, 0, 1, 1) }, uC11SBWall: { value: 0 } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, u); patchShrubShader(sh, view.levelHeight); };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '+c11-shrubband';
  mat.needsUpdate = true;
  let version = -1, stats = {}, shrubPrev = null;
  const bake = () => {
    const m = bakeShrubDropMap(view.town, view.index, { res: 256 });
    const tex = new THREE.DataTexture(m.data, m.res, m.res); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
    u.uC11SBMap.value?.dispose?.(); u.uC11SBMap.value = tex; u.uC11SBX.value.set(m.minX, m.minZ, 1 / m.span, 1 / m.span);
    version = view.town.version; stats = { res: m.res, maxDrop: m.maxDrop, cells: m.cells }; api.map = m;
  };
  const api = {
    u, map: null,
    set(on) {
      if (on && shrubPrev === null) { shrubPrev = view.shrubOn.value; view.shrubOn.value = 1; }
      if (!on && shrubPrev !== null) { view.shrubOn.value = shrubPrev; shrubPrev = null; }
      u.uC11SB.value = on ? 1 : 0; if (on && version !== view.town.version) bake();
    },
    update() { if (u.uC11SB.value && version !== view.town.version) bake(); },
    /** 第 75 轮：竖直崖壁上的那条带（原片没有，默认 0）。k=1 复现第 71–74 轮的旧观感，用于截图对照。 */
    setWallBand(k = 0) {
      if (!Number.isFinite(k) || k < 0 || k > 1) throw new RangeError('shrubband wall band 0..1');
      u.uC11SBWall.value = k; return k;
    },
    get wallBand() { return u.uC11SBWall.value; },
    stats: () => stats,
  };
  return api;
}
