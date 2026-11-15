/** Bounded 3D trajectory trace. Linear/quadratic drag are explicit choices, not a guess at an unreadable Inspector. */
const vec=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
export function segmentBoxHit(a,b,boxes){let best=null;for(const box of boxes){let lo=0,hi=1;for(let k=0;k<3;k++){const d=b[k]-a[k];if(Math.abs(d)<1e-12){if(a[k]<box.min[k]||a[k]>box.max[k]){lo=2;break;}}else{let x=(box.min[k]-a[k])/d,y=(box.max[k]-a[k])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)break;}}if(lo<=hi&&lo<=1&&(!best||lo<best.u))best={u:lo,kind:'box',id:box.id};}return best;}
export function traceArc({speed=7.61,angleDeg=45,heading=0,drag=.83,dragModel='linear',gravity=9.8,dt=1/120,maxTime=12,groundY=0,origin=[0,0,0],boxes=[],segmentHit=null}={}){
 if(![speed,angleDeg,heading,drag,gravity,dt,maxTime,groundY].every(Number.isFinite)||speed<=0||speed>1000||drag<0||gravity<=0||dt<=0||dt>.05||maxTime<=0||maxTime>30||Math.ceil(maxTime/dt)>20000||!['linear','quadratic'].includes(dragModel)||!vec(origin)||!Array.isArray(boxes)||boxes.length>128||boxes.some(b=>!vec(b.min)||!vec(b.max)||b.min.some((v,k)=>v>b.max[k]))||segmentHit!==null&&typeof segmentHit!=='function')throw new RangeError('bounded trajectory options');
 const a=angleDeg*Math.PI/180,h=heading*Math.PI/180;let s=[...origin,speed*Math.cos(a)*Math.cos(h),speed*Math.sin(a),speed*Math.cos(a)*Math.sin(h)],t=0,reason='timeout',hit=null;
 const points=[origin.slice()],times=[0],d=s=>{const v=s.slice(3),k=drag*(dragModel==='quadratic'?Math.hypot(...v):1);return[...v,-k*v[0],-gravity-k*v[1],-k*v[2]];},add=(s,k,c)=>s.map((v,i)=>v+k[i]*c);
 while(t<maxTime-1e-10){const step=Math.min(dt,maxTime-t),k1=d(s),k2=d(add(s,k1,step/2)),k3=d(add(s,k2,step/2)),k4=d(add(s,k3,step)),next=s.map((v,i)=>v+step*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6),A=s.slice(0,3),B=next.slice(0,3);let collision=segmentBoxHit(A,B,boxes);
  if(B[1]<=groundY&&A[1]>=groundY&&B[1]<A[1]){const u=(A[1]-groundY)/(A[1]-B[1]);if(!collision||u<collision.u)collision={u,kind:'ground'};}
  if(segmentHit){const c=segmentHit(A,B);if(c!==null&&c!==undefined&&c!==false){const row=typeof c==='number'?{u:c}:c;if(!Number.isFinite(row.u)||row.u<0||row.u>1)throw new RangeError('collision fraction must be 0..1');if(!collision||row.u<collision.u)collision={...row,kind:row.kind||'scene'};}}
  if(collision){const p=A.map((v,k)=>v+(B[k]-v)*collision.u);points.push(p);t+=step*collision.u;times.push(t);reason=collision.kind;hit={...collision,point:p};break;}
  t+=step;s=next;points.push(B);times.push(t);
 }
 return{points,times,flightTime:t,range:Math.hypot(points.at(-1)[0]-origin[0],points.at(-1)[2]-origin[2]),reason,hit,landed:reason==='ground',dragModel};
}
