/** 1699038611125985317 / 1699146321318314094. Warped-sample sediment field.
 * 「把世界弄歪、做线性纹理数学、再撤掉」：着色在 p 处取 W(p)，几何保持在 p ——
 * 撤回由「几何根本没动」完成，不需要真的逆着搬顶点。
 *
 * 场形（2026-11-26 残差收口）：裁判 REACode engine/surface.js 把场逐式写出，
 * 可逐式移植 → 本文件与 SEDIMENT_GLSL 均为同一份公式（判据：函数体逐字一致 +
 * JS/GLSL 同点采样一致，tests/sediment.mjs 校验）：
 *   sHash/sNoise = 值噪声；sWobble = 二倍频（×2.07 权重 .28）值噪声；
 *   sWarp = vec3(b,a,b*.7)*uSedAmp —— y 用 a 通道、xz 用 b 通道（裁判注释：
 *   xz 也抖，否则线只是"上下浮动"，像整块崖在抖而不是岩层在弯）。
 * 幅度口径：裁判 uSedAmp=.24 → 位移 ±.12wu（sWobble∈[0,1] 减 .5）；
 *   本地 amplitude 参数 = 峰值 .12 = uSedAmp/2，JS/GLSL 两侧同一约定。
 * 频率：裁判 uSedFreq .52（值噪声格 ≈1.92wu）→ SED_FREQ 默认同款。
 *
 * 位移 xz 分量与可逆性（同一残差的另一半）：
 *   D=(b,a,b*.7)·amp 只依赖 (x,z)，W 不再是纯 y 剪切，解析逆不存在；
 *   但逆问题只剩 (x,z) 二维：u ← w.xz − D_xz(u)，y = w.y − D_y(u)。
 *   位移场雅可比实测 ≈0.19 ≪ 1 → 定点迭代收敛到机器精度（10000 点往返
 *   ≤4e-15，与裁判自己的量具 REACode src/wobbletex.js 定点迭代做法同款）。
 *   「可逆」因而保留为迭代可逆，不再是逐式解析逆——如实记录。
 * 原作真实场仍未知：裁判场本身是重构近似，移植裁判 ≠ 拿到原作算法（卡点·C）。
 */
// r56 C09: mode 3/4 = 宽窄层柱（直/弯），见 sediment-bands-c09.js；mode 0–2 不变。
import {SEDIMENT_BANDS_GLSL} from './sediment-bands-c09.js';
export const SED_FREQ=.52; // 裁判 uSedFreq 默认值
const fract=v=>v-Math.floor(v);
function validate({period=.5,amplitude=.12,frequency=SED_FREQ,iters=40}={}){if(!Number.isFinite(period)||period<=0||!Number.isFinite(amplitude)||amplitude<0||!Number.isFinite(frequency)||frequency<=0||!Number.isInteger(iters)||iters<1)throw new RangeError('positive period/frequency/iters and nonnegative amplitude');return{period,amplitude,frequency,iters}}
// ── 裁判 engine/surface.js 逐式移植（JS 版；GLSL 版在 SEDIMENT_GLSL 内逐字同式）──
function sHash(x,y){let px=fract(x*123.34),py=fract(y*456.21);const d=px*(px+45.32)+py*(py+45.32);px+=d;py+=d;return fract(px*py)}
function sNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=sHash(ix,iy),b=sHash(ix+1,iy),c=sHash(ix,iy+1),d=sHash(ix+1,iy+1);const m0=a+(b-a)*fx,m1=c+(d-c)*fx;return m0+(m1-m0)*fy}
/** 二倍频值噪声 ∈[0,1]（裁判 sWobble：一层大 S 弯 + 一层小不规则）。 */
export function sWobble(x,y){return sNoise(x,y)*.72+sNoise(x*2.07+17.3,y*2.07+17.3)*.28}
/** 裁判 sWarp 位移 [dx,dy,dz]=[b,a,b*.7]·2·amplitude（本地 amplitude=uSedAmp/2）。 */
export function sedimentDisplace(x,z,amplitude=.12,frequency=SED_FREQ){
  if(![x,z,amplitude,frequency].every(Number.isFinite)||amplitude<0||frequency<=0)throw new RangeError('finite coordinates and valid amplitude/frequency');
  const qx=x*frequency,qz=z*frequency;
  const a=sWobble(qx+3.1,qz+3.1)-.5,b=sWobble(qx*.87+41.7,qz*.87+41.7)-.5;
  const s=amplitude*2;return[b*s,a*s,b*.7*s];
}
/** y 剪切量（sWarp 的 a 分量）：层理相位只读 warped y，与旧 API 同签名。 */
export function sedimentOffset(x,z,amplitude=.12,frequency=SED_FREQ){return sedimentDisplace(x,z,amplitude,frequency)[1]}
export function warpSediment(p,opts={}){const{amplitude,frequency}=validate(opts);const d=sedimentDisplace(p[0],p[2],amplitude,frequency);return[p[0]+d[0],p[1]+d[1],p[2]+d[2]];}
/** W⁻¹：(x,z) 定点迭代 u←w.xz−D_xz(u)（|∇D|≈0.19<1 收缩），y=w.y−D_y(u)。 */
export function unwarpSediment(p,opts={}){
  const{amplitude,frequency,iters}=validate(opts);
  let x=p[0],z=p[2];
  for(let i=0;i<iters;i++){const d=sedimentDisplace(x,z,amplitude,frequency),nx=p[0]-d[0],nz=p[2]-d[2];
    if(Math.abs(nx-x)+Math.abs(nz-z)<1e-15){x=nx;z=nz;break}x=nx;z=nz;}
  return[x,p[1]-sedimentDisplace(x,z,amplitude,frequency)[1],z];
}
export function sedimentPhase(p,opts={}){const{period,amplitude,frequency}=validate(opts);return(p[1]+sedimentDisplace(p[0],p[2],amplitude,frequency)[1])/period;}
export const SEDIMENT_GLSL=`
uniform float uStrataMode;
uniform vec3 uStrata;
uniform float uSedAmp;     // 裁判同款：sWarp 位移幅度 = uStrata.y*2（view.js 同步）
uniform float uSedFreq;    // 裁判同款：抖动噪声频率（每世界单位几个周期，默认 .52）

// --- 裁判 engine/surface.js 逐式移植：低频值噪声，只用来抖纹理坐标 ----------
float sHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float sNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = sHash(i);
    float b = sHash(i + vec2(1.0, 0.0));
    float c = sHash(i + vec2(0.0, 1.0));
    float d = sHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// 两层足够：一层给大 S 弯，一层给小的不规则；三层以上在崖面上看着像噪点
float sWobble(vec2 p) {
    return sNoise(p) * 0.72 + sNoise(p * 2.07 + 17.3) * 0.28;
}

// "把世界弄歪"：只返回抖动量，调用方自己加到采样坐标上
vec3 sWarp(vec3 wp) {
    vec2 q = wp.xz * uSedFreq;
    float a = sWobble(q + 3.1) - 0.5;
    float b = sWobble(q * 0.87 + 41.7) - 0.5;
    // y 抖得最多（沉积线是水平带，弯的是它）；xz 也抖一点，
    // 否则线只是"上下浮动"，看起来像整块崖壁在抖而不是岩层在弯
    return vec3(b, a, b * 0.7) * uSedAmp;
}
// sWarp 的 y 分量读数（本地 amplitude 口径 = uSedAmp/2）
float sedimentOffset(vec2 p,float amplitude){return (sWobble(p * uSedFreq + 3.1) - 0.5) * amplitude * 2.0;}
${SEDIMENT_BANDS_GLSL}
vec3 sedimentColor(vec3 color,vec3 p){
  if(uStrataMode>2.5) return sedimentBandsColor(color,p);
  float phase=(p.y+(uStrataMode>1.5?sedimentOffset(p.xz,uStrata.y):0.0))/uStrata.x;
  float width=max(fwidth(phase),.0001);
  float s=sin(phase*6.28318530718);
  float tone=smoothstep(-width*6.28318530718,width*6.28318530718,s);
  tone=mix(tone,.5,smoothstep(.3,.8,width));
  float d=abs(fract(phase+.5)-.5);
  float line=(1.0-smoothstep(0.0,width,d))*(1.0-smoothstep(.25,.5,width));
  return mix(color,color*mix(.88,1.08,tone)*mix(1.0,.7,line),uStrata.z);
}
`;
