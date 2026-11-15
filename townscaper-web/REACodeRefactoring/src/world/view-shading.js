/**
 * view-shading.js — 第 55 批 G1：把十二个「机制已写好、没接 View」的着色模块接进 View 主材质。
 *
 * 全部默认关；面板「着色实验（默认关）」或 URL `?shade=key1,key2` 打开，也可 view.setDebug(key, true)。
 * 每个开关只改 uniform（着色器只编译一次），需要的数据（纹理）在打开时、以及 World.version / 太阳变了时按需重烘。
 *
 *   key             源模块                         做法
 *   cvolume         src/colorvolume.js            每格五特征 + (u,v,w) 栅格成图；GPU 上按 8 角点在 OKLab 里三线性插值
 *   contrasttex     src/contrasttex.js            World 三角扇 OKLab 松弛 → 画进世界 XZ 图（atlas/paint）；顶面取色 + 对比边像素细线
 *   paintnormal     src/paintnormal.js            大笔触程序法线图（可平铺）；片元按主轴平面投影采样、切线空间扰动法线（不动顶点）
 *   patchblend      src/patchblend.js             岸线弧长 u + 有符号距离 v 的手工 UV 岸带 patch，与地形顶面（投影 patch）按高度混合
 *   blotchatlas     engine/blotch.js              128² 笔触图集 + 共享 World 台地边缘场 + 受控崖面渗漏（BLOTCH_RIM_GLSL）
 *   brushscratch    engine/bnbrush.js             256² 方向划痕图集（阈值化）+ 边缘场沿口淡出（badnorth.html 着色式移植）
 *   surfacepattern  engine/surface.js             surface 层（格线 / 层理 / 砂砾，按法线混合投影）挂到 View 共享材质
 *   surfaceshadow   src+engine/surfaceshadow.js   地表纹理阴影 + 竖面窄条 + 洞内地面 + 贴形变网格
 *   mountainatlas   src/mountainlight.js          World 山体高度场烘焙 N·L + 白斑 + 脊线 → 图集；岩壁运行时 0 次法线采样
 *   surfacebounce   src/bouncegi.js               2.5D 表面形因子 gather（第 55 批校准，r≈0.82–0.89）→ 间接光
 *   voxelfield      src/lighting.js               分层占用 + 反弹色打包成浮点纹理，顶点着色器采样（替代 CPU 顶点烘焙）
 *   voxelnormals    src/lighting.js               体素占用梯度软法线写回网格法线
 */
import * as THREE from 'three';
import { defaultFeatureVolumes, classifyWorldFeature, setVolumeCorner } from '../core/color-volume.js';
import { worldContrastMesh, solveContrastColors } from '../core/contrast-field.js';
import { paintNormal } from '../core/paint-normal.js';
import { buildPatchField } from '../terrain/patch-blend.js';
import { createBlotchAtlasData, buildBlotchRimField, BLOTCH_RIM_GLSL, blotchRimUniformValues } from '../terrain/blotch-atlas.js';
import { BLOTCH_TONGUE_GLSL, TONGUE_DEFAULTS } from '../terrain/blotch-tongue-c09.js';   // r56 C09 · 1696896119794479541
import { buildScratchAtlas } from '../core/brush-atlas.js';
import { SURFACE_PATTERN_GLSL, surfacePatternUniformValues } from '../terrain/surface-pattern.js';
import { worldMountainField, renderMountainShade } from '../core/mountain-bake.js';
import { surfaceFieldFromWorld, directLight, bounce } from '../light/surface-bounce.js';
import { bakeLighting } from '../light/bake.js';
import { bakeVoxelSoftNormals, packLayeredField, LAYERED_FIELD_GLSL } from '../light/voxel-field.js';

export const SHADING_KEYS = [
  ['cvolume', '八角色体（OKLab）'], ['contrasttex', '对比纹理与细线'], ['paintnormal', '大笔触法线'], ['patchblend', '岸带 patch 高度混合'],
  ['blotchatlas', '图集笔触与崖边渗漏'], ['brushscratch', '方向划痕笔触'], ['surfacepattern', '表面层（格线/层理）'], ['surfaceshadow', '纹理阴影（含墙/洞/形变）'],
  ['mountainatlas', '山体烘焙图集'], ['surfacebounce', '2.5D 表面反弹'], ['voxelfield', '体素场 GPU 顶点采样'], ['voxelnormals', '体素软法线'],
];
export const FEATURE_ORDER = ['Grass', 'Roof', 'Cliff', 'Beach', 'Flowers'];

const FRAG_PARS = /* glsl */`
uniform float uShCV; uniform vec3 uShCVC[40]; uniform sampler2D uShCVMap; uniform vec4 uShCVX; uniform float uShCVMaxY;
uniform float uShCT; uniform sampler2D uShCTMap; uniform vec4 uShCTX; uniform vec2 uShCTP;
uniform float uShPN; uniform sampler2D uShPNMap; uniform float uShPNScale;
uniform float uShPB; uniform sampler2D uShPBMap; uniform vec4 uShPBX; uniform vec4 uShPBP;
uniform float uShBR; uniform float uShBrush; uniform sampler2D uShBrushMap; uniform float uShBrushScale;
uniform float uShSurf;
uniform float uShMtn; uniform sampler2D uShMtnMap; uniform vec4 uShMtnX;
uniform vec2 uShSB; uniform sampler2D uShSBMap; uniform vec4 uShSBX;
uniform float uShVField; uniform vec2 uShVFP;
varying vec4 vShVF;
vec3 shToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
bool shIn(vec2 uv){return uv.x>=0.&&uv.y>=0.&&uv.x<=1.&&uv.y<=1.;}
vec3 shOklabToLinear(vec3 c){float l=c.x+.3963377774*c.y+.2158037573*c.z,m=c.x-.1055613458*c.y-.0638541728*c.z,s=c.x-.0894841775*c.y-1.291485548*c.z;l=l*l*l;m=m*m*m;s=s*s*s;
  return clamp(vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s),0.,1.);}
vec3 shCornerVolume(int f,vec3 q){q=clamp(q,0.,1.);vec3 o=vec3(0.);for(int i=0;i<8;i++){float w=((i&1)!=0?q.x:1.-q.x)*((i&2)!=0?q.y:1.-q.y)*((i&4)!=0?q.z:1.-q.z);o+=uShCVC[f*8+i]*w;}return shOklabToLinear(o);}
float shHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float shNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(shHash(i),shHash(i+vec2(1,0)),f.x),mix(shHash(i+vec2(0,1)),shHash(i+vec2(1,1)),f.x),f.y);}
// src/colorvolume.js：格分类（Grass/Roof/Cliff/Beach/Flowers）→ 该特征的 8 角点色体，OKLab 三线性
vec3 shColorVolume(vec3 base,vec3 p,vec3 n){
  vec2 uv=(p.xz-uShCVX.xy)*uShCVX.zw;if(!shIn(uv))return base;vec4 t=texture2D(uShCVMap,uv);
  int f=int(floor(t.a*4.+.5));float jitter=shNoise(p.xz*.9)*.5;
  if(vField.z< -.5)return shCornerVolume(2,vec3(clamp(p.y/uShCVMaxY,0.,1.),1.-clamp(n.y,0.,1.),fract(t.b+jitter)));
  if(n.y<.6)return base;
  if(vField.z>.5&&vField.z<1.5&&f!=1&&f!=2)return shCornerVolume(f,vec3(t.r,t.g,fract(t.b+jitter)));
  if(abs(vField.z)<.5&&f==1)return shCornerVolume(1,vec3(t.r,t.g,fract(t.b+jitter)));
  return base;}
// src/contrasttex.js：松弛后的三角色画进世界 XZ 图；同色区连续渐变，对比边（色差大）出像素宽细线
vec3 shContrast(vec3 base,vec3 p){vec2 uv=(p.xz-uShCTX.xy)*uShCTX.zw;if(!shIn(uv))return base;vec3 c=texture2D(uShCTMap,uv).rgb;float e=length(fwidth(c));
  vec3 col=mix(base,shToLinear(c),uShCTP.x);return mix(col,col*.32,smoothstep(.035,.11,e)*uShCTP.y);}
// src/patchblend.js：岸带手工 UV（u=岸线弧长相位 g/b，v=到岸有符号距离 r）与地形顶面（投影 patch）高度混合
vec3 shShore(float ph,float v,float sd){vec3 c=mix(vec3(.84,.66,.52),vec3(.94,.80,.64),v);if(abs(ph)<.2&&v>.52&&v<.78)c=mix(c,vec3(.97,.97,.95),.85);if(abs(sd-.08)<.03)c=mix(c,vec3(.76,.57,.44),.35);return shToLinear(c);}
vec3 shPatchBlend(vec3 land,vec3 p){vec2 uv=(p.xz-uShPBX.xy)*uShPBX.zw;if(!shIn(uv))return land;vec4 t=texture2D(uShPBMap,uv);float half_=uShPBP.x,sd=(t.r*2.-1.)*uShPBP.z;
  if(sd>half_||sd<0.)return land;float ph=atan(t.g*2.-1.,t.b*2.-1.)/6.2831853;float a=clamp(sd/half_,0.,1.),cs=cos(1.5707963*a);
  float hShore=sd+uShPBP.w*(cs*cs-.5),hLand=sd;float wl=smoothstep(0.,1.,clamp(.5+(hLand-hShore)/(2.*uShPBP.y),0.,1.));
  return mix(shShore(ph,clamp(sd/half_*.5+.5,0.,1.),sd),land,wl);}
// engine/bnbrush.js：阈值化方向划痕 + 边缘场沿口淡出（engine/badnorth.html 草面着色）
vec3 shBrush(vec3 base,vec3 p,vec3 n){if(n.y<.42)return base;vec2 buv=p.xz*uShBrushScale;float coarse=texture2D(uShBrushMap,buv).r,fine=texture2D(uShBrushMap,buv*2.63).g,dens=texture2D(uShBrushMap,buv*.22).b;
  float aM=smoothstep(.30,.72,coarse)*(.55+.70*dens),bM=smoothstep(.22,.62,fine)*(.45+.60*dens);float m=clamp(aM*.85+bM*.55,0.,1.);
  float ld=texture2D(uBlotchRim,clamp((p.xz-uBlotchRimX.xy)*uBlotchRimX.zw,0.,1.)).r*uBlotchRimP.x;float keep=smoothstep(0.,.16,ld);m*=keep;
  float sandy=smoothstep(.5,.66,base.r);m*=1.-sandy*.85;vec3 c=mix(base,base*vec3(.55,.66,.48),m*.55);
  float hi=clamp(bM-aM*.6,0.,1.)*keep;c=mix(c,c*1.14+.004,hi*.55*(1.-sandy));return mix(c,base*vec3(1.12,1.06,.86),(1.-keep)*.30);}
// src/mountainlight.js：World 高度场上烘好的山体色（N·L + 白斑 + 脊线墨），运行时不再算法线
vec4 shMountain(vec3 p){vec2 uv=(p.xz-uShMtnX.xy)*uShMtnX.zw;if(!shIn(uv))return vec4(0.);vec4 t=texture2D(uShMtnMap,uv);return vec4(shToLinear(t.rgb),t.a);}
vec3 shBounce(vec3 p){vec2 uv=(p.xz-uShSBX.xy)*uShSBX.zw;if(!shIn(uv))return vec3(0.);return texture2D(uShSBMap,uv).rgb*uShSB.y;}
`;

const VERT_PARS = /* glsl */`
varying vec3 vSpPos;
varying vec3 vSpNrm;
varying vec4 vShVF;
uniform float uShVField;
${LAYERED_FIELD_GLSL}
`;
const VERT_BODY = /* glsl */`
vSpPos=(modelMatrix*vec4(transformed,1.)).xyz;
vSpNrm=normalize(mat3(modelMatrix)*objectNormal);
vShVF=vec4(0.);
if(uShVField>.5)vShVF=sampleField(vSpPos+vSpNrm*.17+vec3(0.,.02,0.));
`;
const COLOR_BODY = /* glsl */`
vec3 shWN=normalize(vSpNrm);
if(uShVField>.5&&vShVF.x>.002){float shOc=vShVF.x,shAo=1.-uShVFP.x*min(1.,shOc*1.15);diffuseColor.rgb=diffuseColor.rgb*shAo+diffuseColor.rgb*(vShVF.yzw/shOc)*uShVFP.y*shOc;}
if(uShCV>.5)diffuseColor.rgb=shColorVolume(diffuseColor.rgb,vSpPos,shWN);
if(uShCT>.5&&vField.z>.5&&vField.z<1.5&&shWN.y>.8)diffuseColor.rgb=shContrast(diffuseColor.rgb,vSpPos);
if(uShPB>.5&&vField.z>.5&&vField.z<1.5&&shWN.y>.6)diffuseColor.rgb=shPatchBlend(diffuseColor.rgb,vSpPos);
if(uShBR>.5&&abs(vField.z)>.5)diffuseColor.rgb*=blotchRimTint(vSpPos,shWN);
if(uShBR>.5&&uBlotchTongue.x>.5&&abs(vField.z)>.5)diffuseColor.rgb=blotchTongueApply(diffuseColor.rgb,vSpPos,shWN,vEdge,(vField.z>.5&&vField.z<1.5)?1.:0.);
if(uShBrush>.5&&vField.z>.5&&vField.z<1.5)diffuseColor.rgb=shBrush(diffuseColor.rgb,vSpPos,shWN);
if(uShSurf>.5&&abs(vField.z)>.5)diffuseColor.rgb=surfacePatternShade(diffuseColor.rgb,vSpPos,shWN);
if(uSurfaceShadowExt.x>.5&&uSurfaceShadowStrength>0.&&abs(shWN.y)<.3)diffuseColor.rgb*=surfaceShadowToneN(vSpPos+shWN*.06,shWN);
if(uShMtn>.5&&vField.z< -.5){vec4 shM=shMountain(vSpPos);if(shM.a>.5)diffuseColor.rgb=shM.rgb;}
`;
const NORMAL_BODY = /* glsl */`
if(uShPN>0.){vec3 shN=normalize((vec4(normal,0.)*viewMatrix).xyz),shA=abs(shN);vec2 shUV=shA.y>=shA.x&&shA.y>=shA.z?vSpPos.xz:shA.x>=shA.z?vSpPos.zy:vSpPos.xy;
  vec3 shT=texture2D(uShPNMap,shUV/uShPNScale).xyz*2.-1.;shT.xy*=uShPN;shT=normalize(shT);
  vec3 shR=abs(shN.x)<.99?vec3(1.,0.,0.):vec3(0.,0.,1.),shTa=normalize(shR-shN*dot(shR,shN)),shB=cross(shTa,shN);
  normal=normalize((viewMatrix*vec4(normalize(shTa*shT.x+shB*shT.y+shN*shT.z),0.)).xyz);}
`;
const AO_BODY = /* glsl */`
if(uShSB.x>0.)reflectedLight.indirectDiffuse+=diffuseColor.rgb*shBounce(vSpPos+shWN*.1)*uShSB.x;
`;
const OPAQUE_BODY = /* glsl */`
if(uShMtn>.5&&vField.z< -.5){vec4 shM2=shMountain(vSpPos);if(shM2.a>.5)outgoingLight=diffuseColor.rgb*.92;}
`;

const tex = (data, w, h, { type = THREE.UnsignedByteType, filter = THREE.LinearFilter, wrap = THREE.ClampToEdgeWrapping, mip = false } = {}) => {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, type);
  t.wrapS = t.wrapT = wrap; t.magFilter = filter; t.minFilter = mip ? THREE.LinearMipmapLinearFilter : filter; t.generateMipmaps = mip; t.needsUpdate = true;
  return t;
};
const blank = () => tex(new Uint8Array([0, 0, 0, 0]), 1, 1);

/** World 包围盒（所有格），正方形跨度，给世界 XZ 图用。 */
function worldBounds(world, pad = 0.5) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of world.cells) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
  minX -= pad; minZ -= pad; const span = Math.max(maxX - minX, maxZ - minZ) + pad;
  return { minX, minZ, span };
}
const inTri = (px, pz, a, b, c) => { const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = s(a, b, [px, pz]), d2 = s(b, c, [px, pz]), d3 = s(c, a, [px, pz]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };

export class ShadingExtras {
  constructor(view) {
    this.view = view;
    this.on = Object.fromEntries(SHADING_KEYS.map(([k]) => [k, false]));
    this.keys = {}; this.stats = {}; this.timers = {};
    const V3 = () => new THREE.Vector3(), V4 = (...a) => new THREE.Vector4(...a);
    this.volumes = defaultFeatureVolumes();
    this.u = {
      uShCV: { value: 0 }, uShCVC: { value: Array.from({ length: 40 }, V3) }, uShCVMap: { value: blank() }, uShCVX: { value: V4(0, 0, 1, 1) }, uShCVMaxY: { value: 3 },
      uShCT: { value: 0 }, uShCTMap: { value: blank() }, uShCTX: { value: V4(0, 0, 1, 1) }, uShCTP: { value: new THREE.Vector2(0.55, 1) },
      uShPN: { value: 0 }, uShPNMap: { value: blank() }, uShPNScale: { value: 4 },
      uShPB: { value: 0 }, uShPBMap: { value: blank() }, uShPBX: { value: V4(0, 0, 1, 1) }, uShPBP: { value: V4(0.6, 0.1, 1.2, 0.1) },
      uShBR: { value: 0 }, uShBrush: { value: 0 }, uShBrushMap: { value: blank() }, uShBrushScale: { value: 0.3 },
      uBlotchAtlas: { value: blank() }, uBlotchRim: { value: blank() }, uBlotchRimX: { value: V4(0, 0, 1, 1) }, uBlotchRimP: { value: V4(1, 1, 0.09, 1) }, uBlotchRimQ: { value: V4(0.14, 0.75, 0.55, 2.3) }, uBlotchRimSeg: { value: 0.12 },
      uBlotchTongue: { value: V4(0, TONGUE_DEFAULTS.depth, TONGUE_DEFAULTS.mix, TONGUE_DEFAULTS.lobe) }, uBlotchTongueColor: { value: new THREE.Color(TONGUE_DEFAULTS.color) }, uBlotchTongueTop: { value: TONGUE_DEFAULTS.topReach },
      uShSurf: { value: 0 }, uSpA: { value: V4(0.85, 1, 0, 0) }, uSpB: { value: V4(0.24, 0.52, 0, 13.5) }, uSpSlopeGrass: { value: 0 },
      uShMtn: { value: 0 }, uShMtnMap: { value: blank() }, uShMtnX: { value: V4(0, 0, 1, 1) },
      uShSB: { value: new THREE.Vector2(0, 1) }, uShSBMap: { value: blank() }, uShSBX: { value: V4(0, 0, 1, 1) },
      uShVField: { value: 0 }, uShVFP: { value: new THREE.Vector2(0.62, 0.42) },
      uFieldTex: { value: blank() }, uFieldOrigin: { value: new THREE.Vector2() }, uFieldRes: { value: 0.1 }, uFieldL: { value: view.levelHeight }, uFieldW: { value: 1 }, uFieldH: { value: 1 }, uFieldLayers: { value: 1 },
    };
    this.#writeCorners();
    const sp = surfacePatternUniformValues({ strength: 0.85 });
    this.u.uSpA.value.fromArray(sp.uSpA); this.u.uSpB.value.fromArray(sp.uSpB); this.u.uSpSlopeGrass.value = sp.uSpSlopeGrass;
    this.#patchMaterial(view.material);
    // r56 C09 · 1696896119794479541：?tongue=1 打开色块翻崖舌头（不进 SHADING_KEYS，保持 12 个键）
    if (new URLSearchParams(globalThis.location?.search ?? '').get('tongue')) setTimeout(() => this.setBlotchTongue(true), 0);
  }

  /** r56 C09：色块翻崖舌头（blotch-tongue-c09.js）。打开时顺带打开 blotchatlas（共用图集与 rim 场）。 */
  setBlotchTongue(on, { depth, mix, lobe, topReach, color } = {}) {
    const T = this.u.uBlotchTongue.value;
    if ([depth, mix, lobe, topReach].some((x) => x !== undefined && !Number.isFinite(x))) throw new RangeError('tongue options');
    T.x = on ? 1 : 0; if (depth !== undefined) T.y = depth; if (mix !== undefined) T.z = mix; if (lobe !== undefined) T.w = lobe;
    if (topReach !== undefined) this.u.uBlotchTongueTop.value = topReach; if (color) this.u.uBlotchTongueColor.value.set(color);
    if (on && !this.on.blotchatlas) this.set('blotchatlas', true);
    return { on: !!on, depth: T.y, mix: T.z, lobe: T.w, topReach: this.u.uBlotchTongueTop.value };
  }

  #patchMaterial(material) {
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev?.call(material, shader, renderer);
      Object.assign(shader.uniforms, this.u);
      shader.uniforms.uSurfaceShadowExt = this.view.groundSurfaceShadow.ext;
      for (const t of ['void main() {', '#include <project_vertex>']) if (!shader.vertexShader.includes(t)) throw new Error('view-shading: vertex token ' + t);
      for (const t of ['void main() {', '#include <color_fragment>', '#include <normal_fragment_maps>', '#include <aomap_fragment>', '#include <opaque_fragment>']) if (!shader.fragmentShader.includes(t)) throw new Error('view-shading: fragment token ' + t);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', VERT_PARS + '\nvoid main() {')
        .replace('#include <project_vertex>', VERT_BODY + '\n#include <project_vertex>');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', SURFACE_PATTERN_GLSL + BLOTCH_RIM_GLSL + BLOTCH_TONGUE_GLSL + FRAG_PARS + '\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOR_BODY)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + NORMAL_BODY)
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + AO_BODY)
        .replace('#include <opaque_fragment>', OPAQUE_BODY + '\n#include <opaque_fragment>');
    };
    const prevKey = material.customProgramCacheKey;
    material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+view-shading-r55';
    material.needsUpdate = true;
  }

  #writeCorners() { FEATURE_ORDER.forEach((name, f) => this.volumes[name].corners.forEach((c, i) => this.u.uShCVC.value[f * 8 + i].fromArray(c))); }
  /** 角点编辑（面板取色器）：只改 uniform，不重烘。 */
  setCorner(feature, index, hex) { if (!FEATURE_ORDER.includes(feature)) throw new RangeError('feature'); this.volumes[feature] = setVolumeCorner(this.volumes[feature], index, hex); this.#writeCorners(); return this.volumes[feature].rgb[index]; }

  set(key, on) {
    if (!(key in this.on)) return false;
    this.on[key] = !!on;
    const u = this.u, v = this.view;
    switch (key) {
      case 'cvolume': u.uShCV.value = on ? 1 : 0; break;
      case 'contrasttex': u.uShCT.value = on ? 1 : 0; break;
      case 'paintnormal': u.uShPN.value = on ? 1 : 0; break;
      case 'patchblend': u.uShPB.value = on ? 1 : 0; break;
      case 'blotchatlas': u.uShBR.value = on ? 1 : 0; break;
      case 'brushscratch': u.uShBrush.value = on ? 1 : 0; break;
      case 'surfacepattern': u.uShSurf.value = on ? 1 : 0; break;
      case 'mountainatlas': u.uShMtn.value = on ? 1 : 0; break;
      case 'surfacebounce': u.uShSB.value.x = on ? 1 : 0; break;
      case 'surfaceshadow': v.groundSurfaceShadow.set(on ? { strength: 0.55, receivers: 'all' } : { strength: 0, receivers: 'top' }); break;
      case 'voxelfield':
        u.uShVField.value = on ? 1 : 0;
        // GPU 顶点采样替代 CPU 顶点烘焙：开时关掉 worldMesh 的 bakeLighting（否则 AO 叠两遍），关时恢复
        if (on) { this.cpuBake = v.worldMesh.bake; if (v.worldMesh.bake) { v.worldMesh.bake = false; v.worldMesh.invalidate(); } }
        else if (this.cpuBake !== undefined) { if (v.worldMesh.bake !== this.cpuBake) { v.worldMesh.bake = this.cpuBake; v.worldMesh.invalidate(); } this.cpuBake = undefined; }
        break;
      case 'voxelnormals': if (!on) this.#restoreNormals(); break;
    }
    this.keys[key] = null;
    if (on) this.update(true);
    return true;
  }

  /** 每帧：开着的功能若 World/太阳变了就（防抖）重烘。force=立即。 */
  update(force = false) {
    const v = this.view, w = v.town, S = v.sunDir, ver = w.version, sunKey = `${S.x.toFixed(3)},${S.y.toFixed(3)},${S.z.toFixed(3)}`;
    const want = {
      cvolume: `${ver}`, contrasttex: `${ver}`, paintnormal: 'static', patchblend: `${ver}`, blotchatlas: `${ver}`, brushscratch: `${ver}`,
      mountainatlas: `${ver}`, surfacebounce: `${ver}|${sunKey}`, voxelfield: `${ver}`, voxelnormals: `${ver}|${v.mesh.geometry.uuid}|${v.mesh.geometry.attributes.normal?.version}`,
    };
    for (const [key, k] of Object.entries(want)) {
      if (!this.on[key] || this.keys[key] === k) continue;
      if (key === 'voxelnormals' && this.normalsApplied === k) continue;
      const run = () => { this.timers[key] = null; try { this.#bake(key); } catch (e) { console.error('view-shading bake ' + key + ':', e); } this.keys[key] = want[key]; };
      if (force || this.keys[key] == null) run();
      else if (!this.timers[key]) this.timers[key] = setTimeout(() => { this.keys[key] = null; this.update(true); }, 400);
    }
  }

  #bake(key) {
    const v = this.view, w = v.town, idx = v.index, L = v.levelHeight, t0 = performance.now(), u = this.u;
    switch (key) {
      case 'cvolume': {
        const B = worldBounds(w), res = 320, data = new Uint8Array(res * res * 4), maxLevel = w.cells.reduce((m, c) => Math.max(m, w.top(c)), 1), used = {};
        const cls = new Map(); for (const c of w.cells) { const k = classifyWorldFeature(w, c, { maxLevel }); if (k) cls.set(c.id, k); }
        for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
          const c = idx.cellAt(B.minX + (x + 0.5) * B.span / res, B.minZ + (z + 0.5) * B.span / res), k = c && cls.get(c.id), o = (z * res + x) * 4;
          if (!k) continue; const f = FEATURE_ORDER.indexOf(k.feature);
          data[o] = k.u * 255; data[o + 1] = k.v * 255; data[o + 2] = k.w * 255; data[o + 3] = Math.round(f / 4 * 255);
        }
        for (const k of cls.values()) used[k.feature] = (used[k.feature] || 0) + 1;
        this.#swap('uShCVMap', tex(data, res, res, { filter: THREE.NearestFilter })); u.uShCVX.value.set(B.minX, B.minZ, 1 / B.span, 1 / B.span); u.uShCVMaxY.value = maxLevel * L;
        this.stats.cvolume = { res, used, maxLevel }; break;
      }
      case 'contrasttex': {
        const mesh = worldContrastMesh(w), solved = solveContrastColors(mesh, { iters: 220 }), B = worldBounds(w), res = 512, data = new Uint8Array(res * res * 4);
        const byCell = new Map(); mesh.tris.forEach((t, i) => { if (!byCell.has(t.cell)) byCell.set(t.cell, []); byCell.get(t.cell).push(i); });
        for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
          const px = B.minX + (x + 0.5) * B.span / res, pz = B.minZ + (z + 0.5) * B.span / res, c = idx.cellAt(px, pz); if (!c) continue;
          const list = byCell.get(c.id) ?? []; let ti = list[0]; for (const i of list) { const p = mesh.tris[i].pts; if (inTri(px, pz, p[0], p[1], p[2])) { ti = i; break; } }
          if (ti === undefined) continue; const rgb = solved.rgb[ti], o = (z * res + x) * 4; data[o] = rgb[0] * 255; data[o + 1] = rgb[1] * 255; data[o + 2] = rgb[2] * 255; data[o + 3] = 255;
        }
        this.#swap('uShCTMap', tex(data, res, res, { filter: THREE.NearestFilter })); u.uShCTX.value.set(B.minX, B.minZ, 1 / B.span, 1 / B.span);
        this.stats.contrasttex = { tris: mesh.tris.length, edges: mesh.edges.length, before: solved.before, after: solved.after, res }; break;
      }
      case 'paintnormal': {
        const m = paintNormal({ size: 128, chunks: 24, maxTiltDeg: 26 }), data = new Uint8Array(m.size * m.size * 4);
        for (let i = 0; i < m.size * m.size; i++) { data[i * 4] = m.rgb[i * 3]; data[i * 4 + 1] = m.rgb[i * 3 + 1]; data[i * 4 + 2] = m.rgb[i * 3 + 2]; data[i * 4 + 3] = 255; }
        this.#swap('uShPNMap', tex(data, m.size, m.size, { wrap: THREE.RepeatWrapping })); this.stats.paintnormal = { size: m.size, chunks: m.chunks, scale: u.uShPNScale.value }; break;
      }
      case 'patchblend': {
        const f = buildPatchField(w, { res: 0.1, index: idx }); if (!f) break; const maxD = u.uShPBP.value.z, data = new Uint8Array(f.w * f.h * 4), ds = 0.4;
        for (let i = 0; i < f.w * f.h; i++) { const sd = Math.max(-1, Math.min(1, f.SD[i] / maxD)), a = 2 * Math.PI * f.U[i] / ds; data[i * 4] = Math.round((sd * 0.5 + 0.5) * 255); data[i * 4 + 1] = Math.round((Math.sin(a) * 0.5 + 0.5) * 255); data[i * 4 + 2] = Math.round((Math.cos(a) * 0.5 + 0.5) * 255); data[i * 4 + 3] = f.land[i] * 255; }
        this.#swap('uShPBMap', tex(data, f.w, f.h)); u.uShPBX.value.set(f.minX, f.minZ, 1 / (f.w * f.res), 1 / (f.h * f.res));
        this.stats.patchblend = { w: f.w, h: f.h, loops: f.loops, segs: f.segs.length }; break;
      }
      case 'blotchatlas': case 'brushscratch': {
        if (!this.atlas) { const a = createBlotchAtlasData(); this.atlas = a; this.#swap('uBlotchAtlas', tex(a.data, a.size, a.size, { wrap: THREE.RepeatWrapping, mip: true })); }
        if (key === 'brushscratch' && !this.scratch) { const s = buildScratchAtlas({ size: 256 }); this.scratch = s; this.#swap('uShBrushMap', tex(s.data, s.size, s.size, { wrap: THREE.RepeatWrapping, mip: true })); }
        if (this.rimVersion !== w.version) {
          const rim = buildBlotchRimField(w, { res: 128, maxDist: 1, levelHeight: L, index: idx }), U = blotchRimUniformValues(rim);
          this.#swap('uBlotchRim', tex(rim.data, rim.res, rim.res)); u.uBlotchRimX.value.fromArray(U.uBlotchRimX); u.uBlotchRimP.value.fromArray(U.uBlotchRimP); u.uBlotchRimQ.value.fromArray(U.uBlotchRimQ); u.uBlotchRimSeg.value = U.uBlotchRimSeg;
          this.rimVersion = w.version; this.stats.rim = { res: rim.res, rimCells: rim.rimCount };
        }
        this.stats[key] = { atlas: this.atlas.size, scratch: this.scratch?.size ?? null, rim: this.stats.rim }; break;
      }
      case 'mountainatlas': {
        const m = worldMountainField(w, idx, { res: 0.2, levelHeight: L }), r = renderMountainShade(m, 'baked'), data = new Uint8Array(m.w * m.h * 4);
        for (let i = 0; i < m.w * m.h; i++) { data[i * 4] = r.rgb[i * 3] * 255; data[i * 4 + 1] = r.rgb[i * 3 + 1] * 255; data[i * 4 + 2] = r.rgb[i * 3 + 2] * 255; data[i * 4 + 3] = m.terrain[i] * 255; }
        this.#swap('uShMtnMap', tex(data, m.w, m.h)); u.uShMtnX.value.set(m.minX, m.minZ, 1 / (m.w * m.res), 1 / (m.h * m.res));
        this.stats.mountainatlas = { w: m.w, h: m.h, runtimeNormalTaps: 0, rockPx: r.rock.reduce((s, x) => s + x, 0) }; break;
      }
      case 'surfacebounce': {
        const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }, grass = [0.5, 0.6, 0.34], rock = [0.6, 0.58, 0.55], plaster = hex('#efe6d4');
        const albedoOf = (c, lv) => { if (w.isRock(c, lv)) return lv === w.top(c) ? grass : rock; const k = w.color[c.id]; return k >= 0 && w.palette?.colors?.[k] ? hex(w.palette.colors[k]) : plaster; };
        const f = surfaceFieldFromWorld(w, idx, { L, pitch: 0.25, albedoOf, maxCells: 160000 }); if (!f) break;
        const S = v.sunDir, sc = v.sun.color, E0 = directLight(f, { sun: [S.x, S.y, S.z], sunColor: [sc.r, sc.g, sc.b], skyColor: [0.3, 0.38, 0.45], ambient: 0.1 });
        const b = bounce(f, E0, { bounces: 2, maxDist: 3 }), n = f.nx * f.nz, gathered = new Float32Array(n * 3); let max = 1e-6;
        for (let i = 0; i < n * 3; i++) { const a = f.albedo[i]; gathered[i] = a > 0.02 ? b.added[i] / a : 0; max = Math.max(max, gathered[i]); }
        const data = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(gathered[i * 3 + k] / max * 255); data[i * 4 + 3] = 255; }
        this.#swap('uShSBMap', tex(data, f.nx, f.nz)); u.uShSBX.value.set(f.minX, f.minZ, 1 / (f.nx * f.pitch), 1 / (f.nz * f.pitch));
        // E0 的太阳项按 albedo·sun·ndl 记（≈ three 的 sun.intensity/π 量纲），gathered 也同口径 → 乘 sun.intensity/π 回到 three 的辐射单位
        u.uShSB.value.y = max * v.sun.intensity / Math.PI;
        this.stats.surfacebounce = { nx: f.nx, nz: f.nz, ms: +b.timeMs.toFixed(0), model: b.model, maxGathered: +max.toFixed(3), history: b.history.map((x) => +x.toFixed(4)) }; break;
      }
      case 'voxelfield': case 'voxelnormals': {
        if (this.fieldVersion !== w.version) {
          const colorOf = (c, lv) => { if (w.isRock(c, lv)) return new THREE.Color('#9a958c'); const k = w.color[c.id]; return new THREE.Color(k >= 0 && w.palette?.colors?.[k] ? w.palette.colors[k] : '#efe6d4'); };
          const r = bakeLighting({ pos: [], col: [] }, w, { L, colorOf, shape: v.worldMesh.shape, keepField: true }); this.field = r.field ?? null; this.fieldVersion = w.version;
          if (this.field) {
            const pack = packLayeredField(this.field); this.#swap('uFieldTex', tex(pack.data, pack.width, pack.height, { type: THREE.FloatType, filter: THREE.NearestFilter }));
            const pu = pack.uniforms; u.uFieldOrigin.value.set(pu.origin[0], pu.origin[1]); u.uFieldRes.value = pu.res; u.uFieldL.value = pu.L; u.uFieldW.value = pu.W; u.uFieldH.value = pu.H; u.uFieldLayers.value = pu.layers;
            this.stats.voxelfield = { W: pu.W, H: pu.H, layers: pu.layers, texW: pack.width, texH: pack.height, cpuBakeOff: !v.worldMesh.bake };
          }
        }
        if (key === 'voxelnormals' && this.field) this.#applyNormals();
        break;
      }
    }
    if (this.stats[key]) this.stats[key].bakeMs = +(performance.now() - t0).toFixed(0);
  }

  #applyNormals() {
    const g = this.view.mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal; if (!pos || !nrm) return;
    if (this.normalsGeom !== g || this.normalsVersion !== nrm.version) this.normalsBackup = Float32Array.from(nrm.array);
    else nrm.array.set(this.normalsBackup);
    const r = bakeVoxelSoftNormals({ pos: pos.array, nrm: nrm.array }, this.field, { blend: 0.55 });
    nrm.needsUpdate = true; this.normalsGeom = g; this.normalsVersion = nrm.version;
    this.normalsApplied = `${this.view.town.version}|${g.uuid}|${nrm.version}`;
    let moved = 0; for (let i = 0; i < nrm.array.length; i += 3) if (Math.abs(nrm.array[i] - this.normalsBackup[i]) + Math.abs(nrm.array[i + 1] - this.normalsBackup[i + 1]) + Math.abs(nrm.array[i + 2] - this.normalsBackup[i + 2]) > 1e-4) moved++;
    this.stats.voxelnormals = { verts: pos.count, touched: r.touched, skippedFlip: r.skippedFlip, moved };
  }
  #restoreNormals() {
    const g = this.view.mesh.geometry, nrm = g.attributes.normal;
    if (this.normalsGeom === g && this.normalsBackup && nrm.version === this.normalsVersion) { nrm.array.set(this.normalsBackup); nrm.needsUpdate = true; }
    this.normalsGeom = null; this.normalsBackup = null; this.normalsApplied = null;
  }
  #swap(name, t) { this.u[name].value?.dispose?.(); this.u[name].value = t; }
  dispose() { for (const k of Object.keys(this.u)) this.u[k].value?.isTexture && this.u[k].value.dispose(); }
}

/** URL ?shade=a,b 打开对应开关（面板之外的入口）。 */
export function shadingKeysFromURL(search) {
  const p = new URLSearchParams(search ?? ''), list = (p.get('shade') || '').split(',').filter(Boolean);
  return list.filter((k) => SHADING_KEYS.some(([x]) => x === k));
}
