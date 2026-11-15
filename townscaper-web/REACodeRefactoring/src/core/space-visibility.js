/** 798580832906739712: sampled 3D openness. Shared polygon-column World;
 * fixed stepping can miss thin walls. Diagnostic only, not exact optical LOS.
 */
export function fibonacciDirections(count=32){
 if(!Number.isInteger(count)||count<1||count>512)throw new RangeError('direction count 1..512');
 const angle=Math.PI*(3-Math.sqrt(5));return Array.from({length:count},(_,i)=>{const y=1-(i+.5)*2/count,r=Math.sqrt(1-y*y);return{x:Math.cos(i*angle)*r,y,z:Math.sin(i*angle)*r}});
}
export function sampleWorldVisibility(world,index,origin,{count=32,maxDist=5,step=.08,levelHeight=.5}={}){
 if(![origin?.x,origin?.y,origin?.z,maxDist,step,levelHeight].every(Number.isFinite)||maxDist<=0||step<=0||levelHeight<=0||Math.ceil(maxDist/step)>10000)throw new RangeError('visibility settings');
 const dirs=fibonacciDirections(count),at=p=>{const c=index.cellAt(p.x,p.z);return !!(c&&p.y>=0&&world.isSolid(c,Math.floor(p.y/levelHeight)+1));};
 if(at(origin))return{value:0,rays:[],insideSolid:true,samples:1};
 const rays=[];let sum=0,samples=1;const steps=Math.ceil(maxDist/step);
 for(const dir of dirs){let distance=maxDist,hit=false,end;for(let i=1;i<=steps;i++){const t=Math.min(i*step,maxDist);end={x:origin.x+dir.x*t,y:origin.y+dir.y*t,z:origin.z+dir.z*t};samples++;if(at(end)){distance=t;hit=true;break;}}sum+=distance/maxDist;rays.push({...end,distance,hit});}
 return{value:sum/count,rays,insideSolid:false,samples};
}

/* 第 53 批（G5）：798580832906739712「Some dirt cheap (and highly inaccurate) ray marching. Might use it for visibility when indoors」。
 * REACode/src/rayvis.js 的其余部分迁到共享 World：
 *   · exact 模式：不按固定步长，而是在多边形柱格之间逐格穿行（出边求交 → 邻格），每格按射线经过的高度区间查实心层——
 *     薄墙/斜穿格角不会再漏（固定步长的「便宜」代价由 coarse 对照量出来）；
 *   · 整楼烘焙：每格顶面 + 每个被覆盖的室内/洞道地面各一个采样点，得到灰度场（室内暗、室外亮）与统计。 */
function insideXZ(c,x,z){let s=0;for(let i=0;i<c.n;i++){const a=c.pts[i],b=c.pts[(i+1)%c.n],k=(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);if(Math.abs(k)<1e-12)continue;if(s&&Math.sign(k)!==s)return false;s=Math.sign(k);}return true;}
export function castWorldRay(world,index,origin,dir,{maxDist=5,levelHeight=.5,maxCells=4096}={}){
 const L=levelHeight;let c=index.cellAt(origin.x,origin.z);if(!c)return maxDist;
 const solidAt=(cell,y)=>y>=0&&world.isSolid(cell,Math.floor(y/L)+1);
 const hx=dir.x,hz=dir.z,hl=Math.hypot(hx,hz);
 // 在一格里 [t0,t1] 这一段：按层边界切开，第一段落在实心层的起点就是命中
 const firstHit=(cell,t0,t1)=>{
  let t=t0;
  for(let k=0;k<64&&t<t1-1e-12;k++){
   const y=origin.y+dir.y*t;
   if(solidAt(cell,y+(dir.y>0?1e-9:-1e-9)))return t;
   if(Math.abs(dir.y)<1e-12)return null;
   const lv=Math.floor(y/L+(dir.y>0?1e-9:-1e-9)),nextY=(dir.y>0?lv+1:lv)*L,tn=(nextY-origin.y)/dir.y;
   if(!(tn>t))return null;t=tn;
  }
  return null;
 };
 if(hl<1e-12){const h=firstHit(c,0,maxDist);return h??maxDist;}
 let tIn=0;
 for(let n=0;n<maxCells&&tIn<maxDist;n++){
  // 出边：射线（XZ）与本格各边的交点里，t 最小且 > tIn 的
  let tOut=Infinity,edge=-1;
  for(let i=0;i<c.n;i++){const a=c.pts[i],b=c.pts[(i+1)%c.n],ex=b.x-a.x,ez=b.z-a.z,den=hx*ez-hz*ex;if(Math.abs(den)<1e-14)continue;
   const t=((a.x-origin.x)*ez-(a.z-origin.z)*ex)/den,u=((a.x-origin.x)*hz-(a.z-origin.z)*hx)/den;
   if(t>tIn+1e-10&&u>=-1e-9&&u<=1+1e-9&&t<tOut){tOut=t;edge=i;}}
  const t1=Math.min(tOut,maxDist),hit=firstHit(c,tIn,t1);if(hit!=null)return hit;
  if(tOut>=maxDist)return maxDist;
  if(edge<0){tOut=tIn+1e-6;}   // 只擦过格角（零长度）：往前挪一点重新定位
  // 下一格按出点稍前方的位置重新定位——正好穿过格角时，出边的邻格只是擦边，真正进入的是对角那格
  const ex=origin.x+dir.x*(tOut+1e-7),ez=origin.z+dir.z*(tOut+1e-7);
  let next=edge>=0?(world.cells?.[c.edgeNeighbors[edge]]??null):null;
  if(!next||!insideXZ(next,ex,ez))next=index.cellAt(ex,ez);
  if(!next)return maxDist;
  c=next;tIn=tOut;
 }
 return maxDist;
}
export function sampleWorldVisibilityExact(world,index,origin,{count=32,maxDist=5,levelHeight=.5}={}){
 if(![origin?.x,origin?.y,origin?.z,maxDist,levelHeight].every(Number.isFinite)||maxDist<=0||levelHeight<=0)throw new RangeError('visibility settings');
 const c=index.cellAt(origin.x,origin.z);if(c&&origin.y>=0&&world.isSolid(c,Math.floor(origin.y/levelHeight)+1))return{value:0,rays:[],insideSolid:true};
 const rays=[];let sum=0;
 for(const d of fibonacciDirections(count)){const t=castWorldRay(world,index,origin,d,{maxDist,levelHeight});sum+=t/maxDist;rays.push({x:origin.x+d.x*t,y:origin.y+d.y*t,z:origin.z+d.z*t,distance:t,hit:t<maxDist});}
 return{value:sum/count,rays,insideSolid:false};
}
/** 整楼烘焙：每格顶面、以及每个「头顶还有实心层」的室内/洞道地面，各算一次开阔度。 */
export function bakeWorldVisibility(world,index,{count=32,maxDist=4,levelHeight=.5,exact=true,lift=.12}={}){
 const L=levelHeight,samples=[];
 for(const c of world.cells){
  const top=world.top(c);
  for(let lv=1;lv<=top;lv++){
   if(!world.isSolid(c,lv)||world.isSolid(c,lv+1))continue;   // 地面 = 实心层上面是空气
   const p={x:c.cx,y:lv*L+lift,z:c.cz},indoor=lv<top;
   const r=exact?sampleWorldVisibilityExact(world,index,p,{count,maxDist,levelHeight:L}):sampleWorldVisibility(world,index,p,{count,maxDist,levelHeight:L});
   samples.push({cell:c.id,level:lv,...p,indoor,value:r.value});
  }
 }
 const mean=a=>a.length?a.reduce((s,x)=>s+x.value,0)/a.length:NaN,ins=samples.filter(s=>s.indoor),out=samples.filter(s=>!s.indoor);
 return{samples,stats:{samples:samples.length,indoor:ins.length,outdoor:out.length,indoorMean:mean(ins),outdoorMean:mean(out),contrast:mean(out)/Math.max(1e-6,mean(ins))}};
}
