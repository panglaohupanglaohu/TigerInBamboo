// Local procedural blotches; source videos do not specify their internal atlas/mask algorithm.
// mode 1（旋涡+可变密度，1703750394164199473 / 1704246032626762189）的参数与配色按裁判
// engine/blotch.js BODY 逐式对齐：角度场 wobble、遮罩阈值、密度权重、橄榄/锈红配色、
// 边缘压暗与细颗粒全同源；场仍是本地 fbm（裁判为手写图集通道，细卷边属原素材）。
export const BLOTCH_GLSL = `
uniform float uBlotchLevel;
uniform float uBlotchStyleMode;
uniform vec4 uBlotchStyle;
float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bh(i), bh(i + vec2(1, 0)), f.x), mix(bh(i + vec2(0, 1)), bh(i + vec2(1, 1)), f.x), f.y); }
float bfbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * bn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
// 裁判 engine/blotch.js 的角度场噪声（bHash/bNoise/bWobble 逐式移植；bw* 前缀避免与
// 同一 shader 里 blotch-atlas.js 的 br* 撞名 —— 两处公式相同，各带一份互不依赖）。
float bwHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float bwNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bwHash(i),bwHash(i+vec2(1.,0.)),f.x),mix(bwHash(i+vec2(0.,1.)),bwHash(i+vec2(1.,1.)),f.x),f.y);}
float bwWobble(vec2 p){return bwNoise(p)*.72+bwNoise(p*2.07+17.3)*.28;}
vec3 blotchTone(vec3 w) {
  float level = floor(w.y / max(uBlotchLevel, 0.00001) + 0.01);
  // 1480635131614355459 全片实测：色斑边界是 20–30px 的宽带渐变（4× 放大看不到硬台阶），
  // 色阶连续而不是三档，所以大斑块才能"藏住多边形"而不留下色带棱线。这里是该口径的默认实现。
  if (uBlotchStyleMode > 1.5) {
    vec2 p0 = w.xz * .55 + vec2(level * 1.7, -level * 1.1);
    vec2 q0 = vec2(bfbm(p0 * .7 + 3.1), bfbm(p0 * .7 - 2.4));
    float b0 = bfbm(p0 + q0 * 1.6);
    float t0 = smoothstep(.34, .66, b0);
    return vec3(mix(1., mix(.84, 1.12, t0), uBlotchStyle.w));
  }
  vec2 p = w.xz * (uBlotchStyleMode > .5 ? uBlotchStyle.z : .9);
  if(uBlotchStyleMode > .5) {
    // 裁判：ang=(bWobble(wp.xz*0.30)-0.5)*2.0*uBlotchSwirl —— 场与系数逐式同源。
    float a = (bwWobble(w.xz * .3) - .5) * 2.0 * uBlotchStyle.x;
    float ca=cos(a), sa=sin(a);
    p=mat2(ca,-sa,sa,ca)*p;
  }
  vec2 q = vec2(bfbm(p * 0.7 + level * 1.7), bfbm(p * 0.7 + 5.2 - level));
  float b = bfbm(p * 1.1 + q * 2.5 + level * 3.1);
  if(uBlotchStyleMode > .5) {
    // 裁判 BODY 顶面链逐式对齐（场用本地 fbm 代替图集通道，常数同源）：
    //   cold=smoothstep(.44,.60)、warm=smoothstep(.55,.70)、edge=ss(.36,.48)·ss(.70,.54)
    //   dens=mix(1-d,1+d*.45,ss(.34,.66,低频场·.22)) —— 密度是覆盖权重不是阈值平移
    //   w2=warm*(1-cold*.75)、配色橄榄(.86,1.02,.74)/锈红(1.16,.88,.70)、edge*.10 压暗
    //   细颗粒 step(.80)·w·.22·fwidth淡出（裁判图集 B 通道=12× 基频，这里 p*12 同比率）
    float width = max(fwidth(b), .002);
    float cold = smoothstep(.44 - width, .60 + width, b);
    float warm = smoothstep(.55 - width, .70 + width, bfbm(p * .9 + q * 1.3 + level * 2.6 + 17.7));
    float edge = smoothstep(.36 - width, .48 + width, b) * smoothstep(.70 + width, .54 - width, b);
    float dens = mix(1. - uBlotchStyle.y, 1. + uBlotchStyle.y * .45, smoothstep(.34, .66, bfbm(p * .22 + vec2(51.7, 19.3))));
    float cw = cold * dens;
    float wgt = cw * uBlotchStyle.w, w2 = warm * uBlotchStyle.w * (1. - cold * .75);
    vec3 t = mix(vec3(1.), vec3(.86, 1.02, .74), wgt);
    t = mix(t, vec3(1.16, .88, .70), w2);
    // 裁判是 edge*topW（topW 不含 uBlotchAmt，裁判 strength=0 仍留边线压暗的特例）；
    // 这里乘含强度的 wgt，保住本路径「零强度=关闭」的既有契约。
    t *= 1. - edge * wgt * .10;
    float grainRes = 1. - smoothstep(.010, .030, length(fwidth(w.xz)) * 14.);
    t *= 1. - step(.80, bfbm(p * 12.0 + 4.4)) * wgt * .22 * grainRes;
    return t;
  }
  return vec3(b < 0.42 ? 0.8 : b < 0.58 ? 1.0 : 1.14);
}`;
