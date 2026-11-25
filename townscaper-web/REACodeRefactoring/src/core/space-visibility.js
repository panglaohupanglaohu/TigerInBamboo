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
/* 第 57 批残差：798580832906739712「非精确光学视线」—— 柱格穿行只能表达整层实心/空，
 * 斜屋顶、洞口装饰面、坡崖这类"网格上有、体素上没有"的面挡不住。这里对实际渲染用的三角汤
 * 做 Möller–Trumbore 求交：命中距离 = 与最近三角形的交点，没有步长，永远不会"跨漏薄墙"。
 * positions 与 bakeVertexOpenness 同款（Float32Array 每顶点 xyz，非索引网格按 9 个数一三角形）。 */
function triHit(ax,ay,az,bx,by,bz,cx,cy,cz,ox,oy,oz,dx,dy,dz){
 const e1x=bx-ax,e1y=by-ay,e1z=bz-az,e2x=cx-ax,e2y=cy-ay,e2z=cz-az;
 const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x;
 const det=e1x*px+e1y*py+e1z*pz;
 if(Math.abs(det)<1e-12)return -1;                      // 射线与三角形平行（含落在面内），不算命中
 const inv=1/det,tx=ox-ax,ty=oy-ay,tz=oz-az;
 const u=(tx*px+ty*py+tz*pz)*inv;
 if(u<-1e-9||u>1+1e-9)return -1;
 const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x;
 const v=(dx*qx+dy*qy+dz*qz)*inv;
 if(v<-1e-9||u+v>1+1e-9)return -1;
 const t=(e2x*qx+e2y*qy+e2z*qz)*inv;
 return t>1e-9?t:-1;                                    // 双面命中：背面也挡（诊断用，不做朝向剔除）
}
/** 单条射线对三角汤求最近命中距离；没命中返回 maxDist。indices 可选（索引网格）。 */
export function castMeshRay(positions,origin,dir,{maxDist=5,indices=null,maxTris=400000}={}){
 if(!(positions?.length>=9&&positions.length%3===0))throw new RangeError('positions xyz triplets');
 if(indices&&indices.length%3)throw new RangeError('indices triplets');
 const n=indices?indices.length:positions.length/3;
 if(n%3||n/3>maxTris)throw new RangeError('mesh triangle count');
 if(![origin?.x,origin?.y,origin?.z,dir?.x,dir?.y,dir?.z,maxDist].every(Number.isFinite)||maxDist<=0)throw new RangeError('ray settings');
 const L=Math.hypot(dir.x,dir.y,dir.z);if(L<1e-12)throw new RangeError('zero direction');
 const dx=dir.x/L,dy=dir.y/L,dz=dir.z/L;
 let best=maxDist;
 for(let i=0;i<n;i+=3){
  const a=(indices?indices[i]:i)*3,b=(indices?indices[i+1]:i+1)*3,c=(indices?indices[i+2]:i+2)*3;
  const t=triHit(positions[a],positions[a+1],positions[a+2],positions[b],positions[b+1],positions[b+2],positions[c],positions[c+1],positions[c+2],origin.x,origin.y,origin.z,dx,dy,dz);
  if(t>=0&&t<best)best=t;
 }
 return best;
}
/** 网格级光学开阔度：与 sampleWorldVisibilityExact 同形输出，但打在真实三角形上（斜面/洞口都挡）。 */
export function sampleMeshVisibility(positions,origin,{count=32,maxDist=5,indices=null,maxTris=400000}={}){
 if(!Number.isInteger(count)||count<1||count>512)throw new RangeError('direction count 1..512');
 const rays=[];let sum=0;
 for(const d of fibonacciDirections(count)){
  const t=castMeshRay(positions,origin,d,{maxDist,indices,maxTris});
  sum+=t/maxDist;rays.push({x:origin.x+d.x*t,y:origin.y+d.y*t,z:origin.z+d.z*t,distance:t,hit:t<maxDist});
 }
 return{value:sum/count,rays};
}
/** 「Might use it for visibility when indoors」：一个点的室内判定。
 * covered = 同列头顶还有实心层（桥底/楼内/洞道都算）；indoor = covered 或开阔度低于阈值。
 * 返回 covered 与 value 两个分量，消费者可按需取——默认判据同时接住"有顶"与"被围住没顶"。 */
export function indoorAt(world,index,point,{threshold=.35,count=32,maxDist=4,levelHeight=.5,exact=true}={}){
 if(![point?.x,point?.y,point?.z,threshold,levelHeight].every(Number.isFinite)||threshold<0||threshold>1||levelHeight<=0)throw new RangeError('indoor settings');
 const c=index.cellAt(point.x,point.z),pl=Math.floor(point.y/levelHeight)+1;
 const covered=!!(c&&point.y>=0&&world.top(c)>pl);
 const r=exact?sampleWorldVisibilityExact(world,index,point,{count,maxDist,levelHeight}):sampleWorldVisibility(world,index,point,{count,maxDist,levelHeight});
 return{indoor:covered||r.value<threshold,covered,value:r.value,insideSolid:!!r.insideSolid};
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
