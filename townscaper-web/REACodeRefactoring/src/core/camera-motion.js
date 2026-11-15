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
