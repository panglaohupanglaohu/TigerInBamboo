/** Local finite-disc fog fades at both boundaries; no physical volumetric claim. */
export const fogEnvelopeGLSL = `
float fogEnvelope(float r, float inner, float outer) {
  float width=max(outer-inner,0.001);
  return smoothstep(inner,outer,r)*(1.0-smoothstep(outer-width*0.2,outer,r));
}`;
export function fogEnvelope(r,inner,outer){
 if(![r,inner,outer].every(Number.isFinite)||inner<0||outer<=inner)throw new RangeError('Fog radii');
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 return smooth(inner,outer,r)*(1-smooth(outer-Math.max(outer-inner,.001)*.2,outer,r));
}

/** 906207980802252801 "new fog ... For background effects, subtlety is key."
 * REACode engine/fog.js createFogLayer: a few flat, wispy sheets hugging the water,
 * pushed by the shared wind and steered around the island. Pure simulation; the
 * clip is sped up, so speeds are local choices. Sheets never enter a solid World bit:
 * a blocked step turns tangentially (left/right of the wind), else waits.
 */
export function makeFogWisps({count=12,radius=26,inner=5,bottom=.15,top=1.35,size=13,seed=5,center=[0,0]}={}){
 if(!Number.isInteger(count)||count<1||count>256||![radius,inner,bottom,top,size,seed,...center].every(Number.isFinite)||inner<0||radius<=inner||top<=bottom||size<=0)throw new RangeError('Invalid fog wisps');
 let s=(seed*1664525+1013904223)|0;const rnd=()=>((s=(s*1664525+1013904223)|0)&0x7fffffff)/0x7fffffff;
 const wisps=Array.from({length:count},()=>{const a=rnd()*Math.PI*2,r=inner+rnd()*(radius-inner),sc=size*(.6+rnd()*.8);
  return{x:center[0]+Math.cos(a)*r,y:bottom+rnd()*(top-bottom),z:center[1]+Math.sin(a)*r,w:sc,h:sc*(.28+rnd()*.18),speed:.5+rnd()*.7,seed:rnd(),detours:0,wraps:0};});
 function step(dt,sample,occupied=()=>false,time=0,rate=1){
  if(!Number.isFinite(dt)||dt<0||typeof sample!=='function'||typeof occupied!=='function')throw new RangeError('Invalid fog step');
  if(!Number.isFinite(rate)||rate<0||rate>2)throw new RangeError('Invalid fog rate');
  for(const m of wisps){
   const v=sample(m.x,m.y,m.z),vx=(Array.isArray(v)?v[0]:v.x)*m.speed*rate*dt,vz=(Array.isArray(v)?v[2]:v.z)*m.speed*rate*dt;
   const tries=[[vx,vz],[-vz,vx],[vz,-vx]];
   for(let k=0;k<tries.length;k++){const [ax,az]=tries[k];if(!occupied(m.x+ax,m.y,m.z+az)){m.x+=ax;m.z+=az;if(k)m.detours++;break;}if(k===tries.length-1)m.blocked=(m.blocked??0)+1;}
   const dx=m.x-center[0],dz=m.z-center[1],d=Math.hypot(dx,dz);
   if(d>radius){const k=(radius-.5)/d;m.x=center[0]-dx*k;m.z=center[1]-dz*k;m.y=bottom+((time*.03+m.seed*100)%1)*(top-bottom);m.wraps++;
    if(occupied(m.x,m.y,m.z))m.y=top;}
  }
 }
 return{wisps,step,radius,top,bottom,center};
}

/** Read-only census of a wisp set (no simulation change). */
export function wispStats({wisps}){
 if(!Array.isArray(wisps)||!wisps.length)throw new RangeError('fog wisps');
 const ys=wisps.map(m=>m.y),ws=wisps.map(m=>m.w),hs=wisps.map(m=>m.h);
 const sum=(a)=>a.reduce((s,v)=>s+v,0);
 return{count:wisps.length,minY:Math.min(...ys),maxY:Math.max(...ys),meanY:sum(ys)/ys.length,
  meanSize:sum(ws)/ws.length,meanHeight:sum(hs)/hs.length,aspect:sum(hs)/sum(ws),
  detours:sum(wisps.map(m=>m.detours||0)),blocked:sum(wisps.map(m=>m.blocked||0)),wraps:sum(wisps.map(m=>m.wraps||0))};
}
