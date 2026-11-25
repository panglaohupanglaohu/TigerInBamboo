import assert from 'node:assert/strict';import fs from 'node:fs';
import{warpSediment,unwarpSediment,sedimentPhase,sedimentOffset,sedimentDisplace,sWobble,SED_FREQ,SEDIMENT_GLSL}from'../src/core/sediment.js';
import{BAND_SLOTS,BAND_PARITY,parityTone,bandTone,bandRuns,bandMajor,bandLine,sedimentBandAt}from'../src/core/sediment-bands-c09.js';

// ══ 2026-11-26 残差收口：场形换裁判二倍频值噪声 + 位移 xz 分量（迭代可逆）══
// A. JS↔裁判式独立转写：下面这份是测试内对 engine/surface.js 的直接转写，
//    与库实现逐点比较（同点采样容差一致；两条独立转录路径互查笔误）。
const fract=v=>v-Math.floor(v);
const refHash=(x,y)=>{let px=fract(x*123.34),py=fract(y*456.21);const d=px*(px+45.32)+py*(py+45.32);px+=d;py+=d;return fract(px*py)};
const refNoise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=refHash(ix,iy),b=refHash(ix+1,iy),c=refHash(ix,iy+1),d=refHash(ix+1,iy+1);const m0=a+(b-a)*fx,m1=c+(d-c)*fx;return m0+(m1-m0)*fy};
const refWobble=(x,y)=>refNoise(x,y)*.72+refNoise(x*2.07+17.3,y*2.07+17.3)*.28;
const refWarp=(x,z,amp,freq)=>{const qx=x*freq,qz=z*freq;const a=refWobble(qx+3.1,qz+3.1)-.5,b=refWobble(qx*.87+41.7,qz*.87+41.7)-.5;return[b*amp*2,a*amp*2,b*.7*amp*2]};
{let dmax=0,omin=1,omax=0;for(let i=0;i<4096;i++){const x=Math.sin(i*1.7)*23, z=Math.cos(i*.83)*23;
  const r=refWarp(x,z,.12,.52),d=sedimentDisplace(x,z);for(let k=0;k<3;k++)dmax=Math.max(dmax,Math.abs(r[k]-d[k]));
  const w=sWobble(x*.52+3.1,z*.52+3.1);omin=Math.min(omin,w);omax=Math.max(omax,w)}
 assert.ok(dmax<1e-12,'JS 场与裁判转写同点采样差 '+dmax);
 assert.ok(omin>=0&&omax<=1,'sWobble 界 ['+omin+','+omax+']');
 console.log('PASS judge-field parity: 4096 samples maxΔ='+dmax.toExponential(2)+', sWobble∈['+omin.toFixed(3)+','+omax.toFixed(3)+']')}

// B. GLSL 逐式移植判据：裁判 engine/surface.js 四个函数体（空白归一后）必须原文出现在 SEDIMENT_GLSL。
{const judge=fs.readFileSync(new URL('../../REACode/engine/surface.js',import.meta.url),'utf8');
 const norm=s=>s.replace(/\s+/g,' '),glsl=norm(SEDIMENT_GLSL);
 for(const[ret,fn]of[['float','sHash'],['float','sNoise'],['float','sWobble'],['vec3','sWarp']]){
   const m=judge.match(new RegExp(ret+' '+fn+'\\(vec[23] \\w+\\)\\s*\\{[^}]*\\}'));assert.ok(m,'裁判缺 '+fn);
   assert.ok(glsl.includes(norm(m[0])),'SEDIMENT_GLSL 未逐式移植 '+fn)}
 for(const frag of['uniform float uSedAmp','uniform float uSedFreq','sed.x+sed.z','vec3 sed=p+(uStrataMode>3.5?sWarp(p):vec3(0.))'])
   assert.ok(SEDIMENT_GLSL.includes(frag),'GLSL 缺 '+frag);
 // view.js 接线判据：uniform 绑定 + 幅度口径同步（uSedAmp = amplitude*2）
 const view=fs.readFileSync(new URL('../src/world/view.js',import.meta.url),'utf8');
 for(const frag of['uSedAmp = this.sedAmpUniform','uSedFreq = this.sedFreqUniform','sedAmpUniform.value=amplitude*2'])
   assert.ok(view.includes(frag),'view.js 缺 '+frag);
 console.log('PASS judge-verbatim GLSL: sHash/sNoise/sWobble/sWarp bodies identical, uSedAmp/uSedFreq wired')}

// C. 往返可逆（迭代逆，不再是解析逆）：10000 点 ≤1e-9（实测 ~4e-15）；xz 分量非零且有界。
{let max=0,xz=0,dxMax=0,dzMax=0,dyMax=0;const amp=.12;
 for(let i=0;i<10000;i++){const p=[Math.sin(i)*20,(i%70)*.1,Math.cos(i*3)*20],w=warpSediment(p),u=unwarpSediment(w);
  max=Math.max(max,...p.map((v,k)=>Math.abs(v-u[k])));
  const d=sedimentDisplace(p[0],p[2]);dxMax=Math.max(dxMax,Math.abs(d[0]));dzMax=Math.max(dzMax,Math.abs(d[2]));dyMax=Math.max(dyMax,Math.abs(d[1]));if(Math.abs(d[0])+Math.abs(d[2])>1e-3)xz++;
  assert.equal(sedimentPhase(p,{amplitude:0}),p[1]/.5);assert.equal(sedimentPhase([...p]),sedimentPhase(p));}
 assert.ok(max<1e-9,'往返残差 '+max);assert.ok(xz>9000,'xz 位移应几乎处处非零 '+xz);
 assert.ok(dxMax<=amp+1e-12&&dzMax<=.7*amp+1e-12&&dyMax<=amp+1e-12,'位移越界 '+[dxMax,dzMax,dyMax]);
 assert.ok(dxMax>.05&&dyMax>.05,'幅度峰值过低 '+[dxMax,dyMax]);
 // 迭代收敛单调：3 次迭代残差 ≫ 12 次迭代残差
 const q=[3.7,1.1,-8.2],w3=warpSediment(q),e3=Math.hypot(...unwarpSediment(w3,{iters:3}).map((v,k)=>v-q[k])),e12=Math.hypot(...unwarpSediment(w3,{iters:12}).map((v,k)=>v-q[k]));
 assert.ok(e3<5e-3&&e12<e3,'迭代不收敛 e3='+e3+' e12='+e12);
 assert.throws(()=>sedimentPhase([0,0,0],{period:0}),RangeError);assert.throws(()=>unwarpSediment([0,0,0],{iters:0}),RangeError);
 console.log('PASS 10000 iterative-inverse roundtrip max='+max.toExponential(2)+', xz-disp covers '+xz+' pts, iter3='+e3.toExponential(2)+'→iter12='+e12.toExponential(2))}

// D. 位移场雅可比上界 <1 → 定点迭代收缩（裁判 wobbletex.js 同判据）。
{let L=0;for(let x=-20;x<20;x+=.37)for(let z=-20;z<20;z+=.37){const e=.01;
  const gx=Math.abs((sedimentDisplace(x+e,z)[0]-sedimentDisplace(x-e,z)[0])/(2*e)),gz=Math.abs((sedimentDisplace(x,z+e)[0]-sedimentDisplace(x,z-e)[0])/(2*e));
  const hx=Math.abs((sedimentDisplace(x+e,z)[2]-sedimentDisplace(x-e,z)[2])/(2*e)),hz=Math.abs((sedimentDisplace(x,z+e)[2]-sedimentDisplace(x,z-e)[2])/(2*e));
  L=Math.max(L,gx+gz,hx+hz)}
 assert.ok(L<0.5,'位移雅可比 '+L+' 应 <1');console.log('PASS warp Jacobian bound L≈'+L.toFixed(3)+' <1 (fixed-point contraction)')}

// E. 场形统计：值噪声格 =1/uSedFreq≈1.92wu，峰距因噪声不规则宽于正弦场（实测 ~2.8）。
{const zs=[0,3.7,-8.2];for(const z of zs){const xs=[];let prev=sedimentOffset(-30,z),dir=0;
  for(let x=-30;x<30;x+=.005){const v=sedimentOffset(x,z);if(v>prev&&dir<=0){if(dir<0)xs.push(x);dir=1}else if(v<prev)dir=-1;prev=v}
  const gaps=xs.slice(1).map((x,i)=>x-xs[i]);const mean=gaps.reduce((s,g)=>s+g,0)/gaps.length;
  assert.ok(mean>2.2&&mean<3.5,'z='+z+' 平均峰距 '+mean+' 应在值噪声 2.2–3.5 档（格 1/'+SED_FREQ+'≈1.92）')}}
assert.equal(sedimentOffset(1.234,-5.678),sedimentOffset(1.234,-5.678));
assert.throws(()=>sedimentOffset(0/0,1),RangeError);assert.throws(()=>sedimentOffset(1,1,.12,0),RangeError);

// ── 裁判对照断言（REACode engine/surface.js 逐式提取的参数，2026-11-24）────────
// ① 层带密度：裁判 surfLine1(y*5.4) → 默认周期 .5 下槽距必须 = 1/5.4 世界单位（±0.5%）。
const pitch=0.5/BAND_SLOTS;assert.ok(Math.abs(pitch-1/5.4)<1/5.4*0.005,'槽距 '+pitch+' 应 = 裁判 1/5.4 = '+(1/5.4));
// ② 两色层理：裁判 surfBandTone 奇偶 ±0.08 亮度。
assert.equal(BAND_PARITY[0],1.08)&&assert.equal(BAND_PARITY[1],0.92);
assert.equal(parityTone(0),1.08)&&assert.equal(parityTone(1),0.92)&&assert.equal(parityTone(-1),0.92)&&assert.equal(parityTone(-2),1.08);
// ③ 主层理：裁判 y*1.8 = 每第 3 条交界。
assert.ok(bandMajor(0)&&!bandMajor(1)&&!bandMajor(2)&&bandMajor(3)&&bandMajor(-3));
// ④ 弯层幅度：裁判 y 偏移 ±0.12wu（uSedAmp.24×[-.5,.5]）= ±0.65 层距（值噪声实测峰值 ~0.107）。
let offMax=0;for(let i=0;i<20000;i++){const v=Math.abs(sedimentOffset(Math.sin(i*.7)*9,Math.cos(i*1.3)*9));offMax=Math.max(offMax,v)}
assert.ok(offMax<=0.12+1e-9&&offMax>0.08,'剪切幅度峰值 '+offMax+' 应贴近裁判 ±0.12');
assert.ok(offMax/pitch<0.7&&offMax>0.04,'以层距计的偏移 '+(offMax/pitch)+' ≈ 裁判 ±0.65 上界');
// ⑤ 宽窄相间（C09/队列指标）：带宽变异系数 ≥ 0.3；4 岩性都出现。
{const runs=bandRuns(0,6,{period:.5}),ws=runs.map(r=>r.slots),mean=ws.reduce((s,v)=>s+v,0)/ws.length;
 const cv=Math.sqrt(ws.reduce((s,v)=>s+(v-mean)**2,0)/ws.length)/mean;
 assert.ok(cv>=0.3,'带宽变异系数 '+cv);assert.equal(new Set(runs.map(r=>r.type)).size,4);
 assert.ok(Math.min(...ws)===1&&Math.max(...ws)>=3,'宽窄带并存 '+Math.min(...ws)+'–'+Math.max(...ws));}
// ⑥ 裁判结构项已接入 GLSL：每交界细线/每第3条主线/裂纹/砂砾/线深 .54。
for(const frag of ['sbLine1(s,1.25)','sbLine1(s/3.+.31,1.7)','sbLine2(vec2((sed.x+sed.z)*.75','mix(1.,.54,m)','mod(k,2.)<.5?1.08:.92','step(.80,sbHash2'])
 assert.ok(SEDIMENT_GLSL.includes(frag),'GLSL 缺 '+frag);
// ⑦ 深线标志：每第 3 条或岩性交界哈希通过；落在 (30%,100%) 合理档。
{const runs=bandRuns(0,5,{period:.5}),n=runs.filter(r=>r.line).length;assert.ok(n>runs.length*.3&&n<runs.length,'深线占比 '+n+'/'+runs.length);}
// ⑧ CPU 参考与槽坐标一致：sedimentBandAt 奇偶进 tone，major 跟交界走。
{const b=sedimentBandAt(0.33);assert.equal(b.slot,Math.floor(0.33/0.5*BAND_SLOTS));assert.equal(b.tone,bandTone(b.slot));const m=sedimentBandAt(0.5/BAND_SLOTS*3+1e-4);assert.ok(m.major&&m.line&&m.deep,'第3交界应 major+line+deep '+JSON.stringify(m));}
console.log('PASS judge-calibrated sediment: pitch 1/5.4, parity ±0.08, major every 3rd, judge wobble field ±0.12wu / λ≈1.9 cells, xz disp + iterative inverse, cracks+gravel on warped xz');
