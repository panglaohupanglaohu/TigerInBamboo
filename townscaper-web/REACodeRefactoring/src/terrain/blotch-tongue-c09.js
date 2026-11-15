/**
 * blotch-tongue-c09.js — 第 56 批 C09-C · 1696896119794479541
 * 「Look how neat and controlled the grass blotches bleed over the cliff edges.」（Art Nouveau 风格）
 *
 * 片子（550 帧；原尺寸 350 复看）：顶面大块圆角色块（绿 / 黄绿 / 桃色）在崖肩处**越过边缘**，
 * 沿崖面往下垂成一条条圆头「舌头」，舌头外缘有细深描边；同一条崖边上舌头长短不一、有的地方没有。
 * 第 55 批 blotchatlas 已接 rim 距离场 + atlas + 受控 bleed（崖面在沿口下 bleed 深度内调色），
 * 但顶面笔触在崖肩格整格被 rimMask 收掉、崖面只是乘性调色，两边并不连成「同一块色块翻过崖边」。
 *
 * 这里补「舌头」：
 *   amt(x,z)   = 与顶面同一张笔触图集（R 通道）按世界 XZ 采样的色块强度（不套漩涡，沿崖边连续变化 → 舌头圆头、长短不一）；
 *   崖面：below = 本崖所属上层格顶面高 − y（rim 场 G 通道，向墙内偏 0.18 取上层格），
 *         舌头 = below < maxDepth·amt，边缘一圈细深描边；
 *   顶面：aEdge（terrainmesh 顶面扇形到崖边距离）< 0.32·amt 的一条色块带 —— 与舌头在崖边同一 amt，连续翻过去。
 * 颜色是统一的程序化草色（没有原作调色板）；默认关（view-shading key `blotchtongue`，开它会顺带开 blotchatlas）。
 */
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const TONGUE_DEFAULTS = Object.freeze({ depth: 0.55, mix: 0.85, lobe: 2.2, topReach: 0.32, color: '#9fbf5a' });

/** 舌头强度：atlas 的 R 通道（与 blotchRimTint 同一张图）在 (lobe·scale·漩涡) 坐标处。sample(u,v)→[r,g,b,a] 0..1 */
export function tongueAmount(sample, x, z, { scale = 0.09, lobe = 1, swirlUV = null } = {}) {
  const [u, v] = swirlUV ? swirlUV(x, z, { scale }) : [x * scale, z * scale];
  return sstep(0.40, 0.72, sample(u * lobe, v * lobe)[0]);
}
/** 崖面舌头遮罩（无抗锯齿版本）：steep 崖面、在上层顶面下 below 处。 */
export function tongueWallMask({ below, amt, normalY, depth = TONGUE_DEFAULTS.depth }) {
  if (![below, amt, normalY, depth].every(Number.isFinite)) throw new RangeError('tongue wall inputs');
  const steep = 1 - sstep(0.88, 0.985, normalY);
  if (amt < 0.02 || below < -0.02) return 0;
  return below <= depth * amt ? steep : 0;
}
/** 顶面带遮罩：aEdge（0 崖边 → 1 格心）< topReach·amt。 */
export function tongueTopMask({ edge, amt, normalY, topReach = TONGUE_DEFAULTS.topReach }) {
  if (![edge, amt, normalY].every(Number.isFinite)) throw new RangeError('tongue top inputs');
  const flat = sstep(0.88, 0.985, normalY);
  if (amt < 0.02 || edge >= 0.999) return 0;
  return edge <= topReach * amt ? flat : 0;
}

export const BLOTCH_TONGUE_GLSL = /* glsl */`
uniform vec4 uBlotchTongue;   // x on, y 最大垂深(世界), z 颜色混合, w 舌头图集缩放
uniform vec3 uBlotchTongueColor;
uniform float uBlotchTongueTop;
vec3 blotchTongueApply(vec3 col, vec3 wp, vec3 nIn, float edgeD, float isTop){
  vec3 n=normalize(nIn);
  vec2 buv=wp.xz*uBlotchRimP.z;
  // 不套 r55 的漩涡旋转：旋转绕世界原点，离原点远处 uv 随角度剧变，舌头会碎成噪点；舌头要沿崖边平滑变长变短
  float amt=smoothstep(.40,.72,texture2D(uBlotchAtlas,buv*uBlotchTongue.w).r);
  if(amt<.02) return col;
  vec3 tc=mix(col,uBlotchTongueColor,uBlotchTongue.z);
  float fl=smoothstep(.88,.985,n.y), steep=1.-fl;
  if(isTop>.5 && fl>.5){
    if(edgeD>.999) return col;
    float r=uBlotchTongueTop*amt, aa=fwidth(edgeD)*1.2+.002;
    float m=(1.-smoothstep(r-aa,r+aa,edgeD))*fl;
    float ink=(1.-smoothstep(0.,aa*1.6,abs(edgeD-r)))*fl;
    col=mix(col,tc,m); return mix(col,col*.55,ink*.75*step(.08,amt));
  }
  if(steep<.05) return col;
  vec2 dn=length(n.xz)>1e-3?normalize(n.xz):vec2(0.);
  vec2 q=wp.xz-dn*.18;
  float top=texture2D(uBlotchRim,clamp((q-uBlotchRimX.xy)*uBlotchRimX.zw,0.,1.)).g*uBlotchRimP.y;
  float below=top-wp.y;
  if(below< -.02) return col;
  float depth=uBlotchTongue.y*amt, aa=fwidth(below)*1.2+.004;
  float m=steep*(1.-smoothstep(depth-aa,depth+aa,below));
  float ink=steep*(1.-smoothstep(0.,aa*1.6,abs(below-depth)))*step(.08,amt);
  col=mix(col,tc,m);
  return mix(col,col*.55,ink*.8);
}
`;
