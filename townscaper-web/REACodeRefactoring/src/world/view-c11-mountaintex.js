/**
 * view-c11-mountaintex.js — 第 56 批 C11 · 1786014232594485497（?c11=mountaintex，默认关）
 * 原文："Mountain textures! These have been tricky. Mountains kinda need lighting and normals, but with my texture blending tech
 *  I don't think I can afford that on low-end devices"
 * 画面（234 帧）：粉褐岩面，受光面更浅、朝下坡方向拉长的白色条痕（亮）与深色沟槽（暗）、山脊处一道深色墨线、山脚绿色镶边。
 *
 * 已有：r53 worldmesh 每顶点 aMountainTone（共享 World 顶点法线的 N·L 烘进顶点，运行时不算光）；r55 ?shade=mountainatlas
 *  （XZ 高度图烘焙 → 只适合缓坡山体；本项目的崖壁是竖直的，XZ 图在竖墙上退化成一列一个纹素，截图里是平涂粉灰，看不到条痕）。
 * 本开关补「贴图」那一半：岩壁片元 = 岩色 × 烘焙明度（vMountainTone，不采法线图、不做实时 N·L）× 沿下坡方向拉长的条痕
 *  （亮处白条、暗处沟槽）+ 明度跳变处的脊线墨（fwidth(烘焙明度)）。山脚绿镶边由下层草顶贴墙自然形成，不另画（试过按崖高图画，在墙角取样跳格出竖绿线，撤掉）。条痕方向用几何法线算切线（不是光照）。
 */
import * as THREE from 'three';

export const MOUNTAIN_TEX_GLSL = /* glsl */`
uniform float uC11MT; uniform vec3 uC11MTRock; uniform vec3 uC11MTGreen; 
vec3 c11MountainTex(vec3 base, float tone, vec3 w, vec3 nW, float L) {
  vec3 up = vec3(0., 1., 0.), side = cross(nW, up); float sl = length(side);
  side = sl > 1e-3 ? side / sl : vec3(1., 0., 0.);
  vec3 down = normalize(cross(side, nW));                 // 沿表面朝下坡
  float u = dot(w, side), v = dot(w, down);
  float streak = bfbm(vec2(u * 7.0, v * .9)), fine = bn(vec2(u * 31.0, v * 2.2));
  float lit = smoothstep(.6, .84, tone);                 // 烘焙明度：受光面
  vec3 c = uC11MTRock * mix(.66, 1.12, clamp((tone - .6) / .45, 0., 1.));
  float white = lit * smoothstep(.5, .58, streak + (fine - .5) * .2);
  float gully = (1. - lit * .6) * smoothstep(.42, .30, streak + (fine - .5) * .12);
  c = mix(c, vec3(.97, .96, .94), white * .85);
  c = mix(c, c * .62, gully * .75);
  float ridge = smoothstep(.05, .14, fwidth(tone) * 6.);   // 烘焙明度跳变 = 山脊 / 折线
  c = mix(c, vec3(.18, .15, .14), ridge * .8);
  return c;
}
`;
const TOKEN = '#include <opaque_fragment>';
export function patchMountainShader(sh, levelHeight) {
  if (!sh.fragmentShader.includes(TOKEN) || !sh.fragmentShader.includes('float bfbm(')) throw new Error('mountaintex tokens');
  sh.fragmentShader = sh.fragmentShader
    .replace('void main() {', MOUNTAIN_TEX_GLSL + '\nvoid main() {')
    .replace(TOKEN, `if (uC11MT > .5 && vField.z < -.5) outgoingLight = c11MountainTex(diffuseColor.rgb, vMountainTone, vWPos, normalize((vec4(normal, 0.) * viewMatrix).xyz), ${levelHeight.toFixed(4)});\n` + TOKEN);
  return sh;
}

export function install(view) {
  const u = { uC11MT: { value: 0 }, uC11MTRock: { value: new THREE.Color('#bf9d93') }, uC11MTGreen: { value: new THREE.Color('#7f9a55') }};
  const mat = view.material, prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, u); patchMountainShader(sh, view.levelHeight); };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '+c11-mountaintex';
  mat.needsUpdate = true;
  return { u, set(on) { u.uC11MT.value = on ? 1 : 0; }, stats: () => ({ runtimeNormalMapTaps: 0, tone: 'aMountainTone (vertex bake)' }) };
}
