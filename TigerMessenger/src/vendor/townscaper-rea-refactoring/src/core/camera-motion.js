/** Wrapped orbit delta, avoiding a false full revolution at the ±pi seam.
 * Invalid/zero render dt cannot establish velocity and yields no smear.
 */
export function cameraAngularSpeed(yaw,pitch,lastYaw,lastPitch,dt){if(![yaw,pitch,lastYaw,lastPitch,dt].every(Number.isFinite)||dt<=0)return 0;const dy=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));return (Math.abs(dy)+Math.abs(pitch-lastPitch))/dt;}
/** Convert the legacy 60 Hz retention to elapsed-time retention. */
export function smearHistoryWeight(speed,dt){if(!Number.isFinite(speed)||!Number.isFinite(dt)||dt<=0)return 0;const reference=Math.min(.72,Math.max(0,(speed-.4)*.35));return reference===0?0:Math.min(.98,Math.pow(reference,dt*60));}

/** REACode smear.js (1727315611959865407 orbital camera smear): with an orbit camera every pixel's
 * per-frame displacement is analytic, v = ω × (p − c)·dt — tangential, ∝ radius — so a single
 * frame is stretched along v with a few triangle-weighted taps (no history, no ghost copies).
 * CPU reference + GLSL twin; the live View still uses the history blend (not replaced here).
 */
export function smearLengthPx(omega,r,dt=1/60){if(![omega,r,dt].every(Number.isFinite)||dt<0)throw new RangeError('Invalid smear length');return Math.abs(omega)*Math.abs(r)*dt;}
export function orbitVelocity(x,y,omega,dt,cx,cy){return[-(y-cy)*omega*dt,(x-cx)*omega*dt];}
export function smearImage({data,w,h},omega,{dt=1/60,samples=6,maxPx=24,cx=w/2,cy=h/2}={}){
 if(!data||data.length!==w*h*4||!Number.isInteger(samples)||samples<1||![omega,dt,maxPx].every(Number.isFinite))throw new RangeError('Invalid smear input');
 const out=new Uint8ClampedArray(data.length),wt=[];let ws=0;
 for(let k=0;k<samples;k++){const t=samples===1?0:k/(samples-1),v=1-Math.abs(t-.5)*1.5;wt.push(v);ws+=v;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let [vx,vy]=orbitVelocity(x,y,omega,dt,cx,cy);const l=Math.hypot(vx,vy);if(l>maxPx){vx*=maxPx/l;vy*=maxPx/l;}
  const acc=[0,0,0,0];
  for(let k=0;k<samples;k++){const f=samples===1?0:k/(samples-1)-.5,fx=x+vx*f,fy=y+vy*f,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0;
   const X=(i)=>Math.max(0,Math.min(w-1,i)),Y=(j)=>Math.max(0,Math.min(h-1,j)),i00=(Y(y0)*w+X(x0))*4,i10=(Y(y0)*w+X(x0+1))*4,i01=(Y(y0+1)*w+X(x0))*4,i11=(Y(y0+1)*w+X(x0+1))*4;
   for(let c=0;c<4;c++)acc[c]+=((data[i00+c]*(1-tx)+data[i10+c]*tx)*(1-ty)+(data[i01+c]*(1-tx)+data[i11+c]*tx)*ty)*wt[k];}
  for(let c=0;c<4;c++)out[(y*w+x)*4+c]=acc[c]/ws;
 }
 return{data:out,w,h};
}
/** Outer-band sharpness (p95 luminance gradient for r > rMin·R): where the smear happens. */
export function sharpnessBand({data,w,h},rMin=.55){
 const g=[],R=Math.min(w,h)/2,lum=i=>.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){if(Math.hypot(x-w/2,y-h/2)/R<rMin)continue;const c=lum((y*w+x)*4);g.push(Math.hypot(lum((y*w+x+1)*4)-c,lum(((y+1)*w+x)*4)-c));}
 g.sort((a,b)=>a-b);return g.length?{p95:g[Math.floor(g.length*.95)],samples:g.length}:{p95:0,samples:0};
}
export const ORBIT_SMEAR_GLSL=`
vec4 orbitSmear(sampler2D tex,vec2 uv,vec2 res,float omegaDt,float maxPx){
  vec2 p=uv*res,c=.5*res;vec2 v=vec2(-(p.y-c.y),p.x-c.x)*omegaDt;float l=length(v);if(l>maxPx)v*=maxPx/l;
  vec4 acc=vec4(0.);float ws=0.;for(int k=0;k<6;k++){float t=float(k)/5.,w=1.-abs(t-.5)*1.5;acc+=texture2D(tex,(p+v*(t-.5))/res)*w;ws+=w;}
  return acc/ws;
}`;

/** REACode smear.js `velocityField` 逐式移植（1727324352264474664 残差「速度场」）：
 * 每个像素的位移（px）：切向 v = ω × (p − c)·dt，长度 ∝ 半径。omega rad/s，dt s。
 */
export function velocityField(w,h,omega,dt=1/60,cx=w/2,cy=h/2){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||![omega,dt,cx,cy].every(Number.isFinite)||dt<0)throw new RangeError('Invalid velocity field');
 const out=new Float32Array(w*h*2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*2;out[i]=-(y-cy)*omega*dt;out[i+1]=(x-cx)*omega*dt;}
 return out;
}
/** REACode smear.js `smear` 的 velocity-field 版（smearImage 是 omega 便捷入口；这里吃预算好的场）。
 * 沿速度方向 N 次三角权重双线性采样；gain/maxPx 口径与裁判一致。返回 {data,w,h,ms}。
 */
export function smearField(src,vel,{samples=6,gain=1,maxPx=24}={}){
 const t0=performance.now(),data=src?.data,w=src?.w??src?.width,h=src?.h??src?.height;
 if(!data||!w||!h||!vel||vel.length!==w*h*2||!Number.isInteger(samples)||samples<1||![gain,maxPx].every(Number.isFinite))throw new RangeError('Invalid smear input');
 const out=new Uint8ClampedArray(data.length),wt=[];let ws=0;
 for(let k=0;k<samples;k++){const t=samples===1?0:k/(samples-1),v=1-Math.abs(t-.5)*1.5;wt.push(v);ws+=v;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let vx=vel[(y*w+x)*2],vy=vel[(y*w+x)*2+1];const l=Math.hypot(vx,vy);if(l>maxPx){vx*=maxPx/l;vy*=maxPx/l;}
  const acc=[0,0,0,0];
  for(let k=0;k<samples;k++){const f=samples===1?0:k/(samples-1)-.5,fx=x+vx*f,fy=y+vy*f,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0;
   const X=(i)=>Math.max(0,Math.min(w-1,i)),Y=(j)=>Math.max(0,Math.min(h-1,j)),i00=(Y(y0)*w+X(x0))*4,i10=(Y(y0)*w+X(x0+1))*4,i01=(Y(y0+1)*w+X(x0))*4,i11=(Y(y0+1)*w+X(x0+1))*4;
   for(let c=0;c<4;c++)acc[c]+=((data[i00+c]*(1-tx)+data[i10+c]*tx)*(1-ty)+(data[i01+c]*(1-tx)+data[i11+c]*tx)*ty)*wt[k];}
  for(let c=0;c<4;c++)out[(y*w+x)*4+c]=(acc[c]/ws)*gain;
 }
 return{data:out,w,h,ms:performance.now()-t0};
}
/** REACode smear.js `sharpness` 逐式移植（残差「CPU审计接口」）：全图灰度梯度 p50/p95/mean，隔点采样。 */
export function sharpness({data,w,h}){
 if(!data||data.length!==w*h*4)throw new RangeError('Invalid sharpness input');
 const g=[],lum=i=>.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
 for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){const c=lum((y*w+x)*4);g.push(Math.hypot(lum((y*w+x+1)*4)-c,lum(((y+1)*w+x)*4)-c));}
 if(!g.length)return{p50:0,p95:0,mean:0,samples:0};
 g.sort((a,b)=>a-b);const q=(p)=>g[Math.min(g.length-1,Math.floor(g.length*p))]||0;let mean=0;for(const v of g)mean+=v;
 return{p50:q(.5),p95:q(.95),mean:mean/g.length,samples:g.length};
}
/** REACode smear.js `audit` 逐式移植（残差「CPU审计接口」）：
 * 合成测试图（同心环×径向刻线）在不同 ω 下的糊宽/锐度损失表；rimPx=|ω|·(w/2)·dt 为外圈单帧位移。
 */
export function smearAudit({size=384,omegas=[0,.6,1.2,2.4],dt=1/60,samples=6}={}){
 const w=size,h=size,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=x-w/2,dy=y-h/2,r=Math.hypot(dx,dy)/(w/2),th=Math.atan2(dy,dx);
  const ring=Math.sin(r*46)>0?1:0,spoke=Math.sin(th*24)>0?1:0,v=30+200*(.5*ring+.5*spoke),i=(y*w+x)*4;
  data[i]=v;data[i+1]=v*.9;data[i+2]=v*.75;data[i+3]=255;
 }
 const src={data,w,h},base=sharpness(src),baseBand=sharpnessBand(src,.55),rows=[];
 for(const omega of omegas){
  const out=smearField(src,velocityField(w,h,omega,dt),{samples}),s=sharpness(out),band=sharpnessBand(out,.55);
  rows.push({omega,rimPx:smearLengthPx(omega,w/2,dt),ms:out.ms,p95:s.p95,drop:base.p95?1-s.p95/base.p95:0,bandP95:band.p95,bandDrop:baseBand.p95?1-band.p95/baseBand.p95:0});
 }
 return{size,dt,samples,base,baseBand,rows,note:'rimPx = |ω| · (w/2) · dt，画面最外圈的单帧位移'};
}

/* ---- r220 · 1727324352264474664「快速转镜拖抹：轮廓加权方向性历史拖尾」----
 * 片内可判（camera-wall-review.md，帧95）：轮廓沿旋转方向被强拉长/扭抹，停转清晰。
 * 旧实现把上一显示帧同位置半透明叠回 = 整屏重影，不是方向拖抹。
 * 近似（不冒充原片未公开算法）：上一帧沿**相邻条目同式切向场**往回 streak 采样（拖尾随转动方向），
 * 再按当前帧轮廓强度加权 alpha —— 硬轮廓整段拉长、平区少受历史污染。
 * 可测验收：alpha=0 或零速度场 → 与当前帧逐位相同；垂直于流向的轮廓沿 v 被拉宽、
 * 平行轮廓几乎不变；平区（梯度≈0）不受移动历史影响。
 */

/** 归一化亮度梯度轮廓强度 e∈[0,1]（ref=梯度多少亮度差记为满轮廓，0..255 口径）。 */
export function edgeStrength({data,w,h},ref=48){
 if(!data||data.length!==w*h*4||!Number.isFinite(ref)||ref<=0)throw new RangeError('Invalid edge input');
 const e=new Float32Array(w*h),lum=i=>.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const xm=x>0?x-1:x,xp=x<w-1?x+1:x,ym=y>0?y-1:y,yp=y<h-1?y+1:y;
  e[y*w+x]=Math.min(1,Math.hypot((lum((y*w+xp)*4)-lum((y*w+xm)*4))*.5,(lum((yp*w+x)*4)-lum((ym*w+x)*4))*.5)/ref);
 }
 return e;
}
/** cur=当前帧 {data,w,h}，prev=上一显示帧同形，vel=velocityField 同形场（或可外部拼接 pan 分量）。
 * out = mix(cur, gather(prev, p − v·t), alpha·(.45+.55·e[cur]))，t∈[0..streak] 段 weights 1−.6t。
 */
export function whipSmear(cur,prev,vel,{alpha=.5,edge=48,streak=1,samples=4,maxPx=32}={}){
 const cd=cur?.data,w=cur?.w??cur?.width,h=cur?.h??cur?.height,pd=prev?.data;
 if(!cd||!pd||!w||!h||cd.length!==w*h*4||pd.length!==w*h*4||!vel||vel.length!==w*h*2
  ||!Number.isInteger(samples)||samples<1||![alpha,edge,streak,maxPx].every(Number.isFinite)||alpha<0||alpha>1||edge<=0)throw new RangeError('Invalid whipSmear input');
 const out=Uint8ClampedArray.from(cd);
 if(alpha<=0)return{data:out,w,h};
 const e=edgeStrength(cur,edge),wt=[];let ws=0;
 for(let k=0;k<samples;k++){const t=samples===1?0:k/(samples-1);wt.push(1-.6*t);ws+=wt[k];}
 const X=(i)=>Math.max(0,Math.min(w-1,i)),Y=(j)=>Math.max(0,Math.min(h-1,j));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let vx=vel[(y*w+x)*2]*streak,vy=vel[(y*w+x)*2+1]*streak;const l=Math.hypot(vx,vy);if(l>maxPx){vx*=maxPx/l;vy*=maxPx/l;}
  const acc=[0,0,0,0];
  for(let k=0;k<samples;k++){const t=samples===1?0:k/(samples-1),fx=x-vx*t,fy=y-vy*t,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0;
   const i00=(Y(y0)*w+X(x0))*4,i10=(Y(y0)*w+X(x0+1))*4,i01=(Y(y0+1)*w+X(x0))*4,i11=(Y(y0+1)*w+X(x0+1))*4;
   for(let c=0;c<4;c++)acc[c]+=((pd[i00+c]*(1-tx)+pd[i10+c]*tx)*(1-ty)+(pd[i01+c]*(1-tx)+pd[i11+c]*tx)*ty)*wt[k];}
  const a=alpha*(.45+.55*e[y*w+x]),oi=(y*w+x)*4;
  for(let c=0;c<4;c++)out[oi+c]=cd[oi+c]*(1-a)+(acc[c]/ws)*a;
 }
 return{data:out,w,h};
}
/** view.js #smear 的 GLSL 孪生：与 whipSmear 同式（4 tap、1−.6t、alpha·(.45+.55·e)、maxPx 32）。
 * shift=本帧 yaw 屏旋量（dyaw·sin(pitch)，内容速度 v=−ω×(p−c) 故取 (p.y−c.y, −(p.x−c.x))），
 * pan=本帧俯仰竖移 px（dpitch·focalPx），edgeRef 用 0..1 亮度口径（48/255）。 */
export const WHIP_SMEAR_GLSL=`
vec4 whipSmear(sampler2D tex,vec2 uv,vec2 res,vec2 c,float shift,float pan,float alpha,float edgeRef){
  vec2 p=uv*res;vec2 v=vec2(p.y-c.y,-(p.x-c.x))*shift+vec2(0.,pan);float l=length(v);if(l>32.)v*=32./l;
  vec3 L=vec3(.2126,.7152,.0722);
  float gx=dot(texture2D(tex,(p+vec2(1.,0.))/res).rgb,L)-dot(texture2D(tex,(p-vec2(1.,0.))/res).rgb,L);
  float gy=dot(texture2D(tex,(p+vec2(0.,1.))/res).rgb,L)-dot(texture2D(tex,(p-vec2(0.,1.))/res).rgb,L);
  float e=clamp(.5*length(vec2(gx,gy))/edgeRef,0.,1.);
  vec4 acc=vec4(0.);float ws=0.;
  for(int k=0;k<4;k++){float t=float(k)/3.,w=1.-.6*t;acc+=texture2D(tex,(p-v*t)/res)*w;ws+=w;}
  return vec4(acc.rgb/ws,alpha*(.45+.55*e));
}`;
