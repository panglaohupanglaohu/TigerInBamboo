/** 959752525867036672: "pulsating vertex cells; a dual to the triangular grid".
 * Barycentric dual (local choice, not proof of the original centre rule).
 * Shared triangle centroids and edge midpoints form one closed cell per vertex;
 * hull cells close at their source vertex rather than extrapolating to infinity.
 */
import{pointInQuad}from'./spatial.js';
/**
 * 959752525867036672 片内量出来的脉动曲线（31 帧 / 21.53fps）。
 * 逐帧数同一裁剪框里的白线像素（亮度>200）：3035→2154（f0013 谷）→3153（f0027 峰）。
 * 面积 ∝ 线性²，对整段做 a·cos(ωt)+b 最小二乘（扫周期）得：周期 1.296s、峰谷比 √((b+a)/(b−a)) = 1.206。
 * uPulse=1 就是真对偶尺寸（拟合的相位说明片内 f0000 正在峰上），谷 = 1/1.206 ≈ 0.829。
 * 旧写死 .72..1.00（峰谷比 1.39、周期 2.09s）比片内深且慢。
 */
export const DUAL_PULSE = { min: 0.829, max: 1, period: 1.3 };
/** 顶点格脉动：t 秒 → 缩放。t=0 在峰上（片内 f0000 接近满尺寸）。 */
export function dualPulse(t, p = DUAL_PULSE) {
  if (!Number.isFinite(t)) throw new RangeError('invalid pulse time');
  return p.min + (p.max - p.min) * (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / p.period));
}
export function vertexDual(points,triangles){
 if(!Array.isArray(points)||!Array.isArray(triangles)||points.length>10000||triangles.length>20000||points.some(p=>!p||![p.x,p.z].every(Number.isFinite)))throw new RangeError('invalid dual input');
 const cells=points.map((p,id)=>({id,source:p,wedges:[],boundary:false})),edgeUse=new Map(),midpoints=new Map(),centroids=[];let next=0;
 const make=(x,z)=>({id:next++,x,z}),key=(a,b)=>Math.min(a,b)+':'+Math.max(a,b),seen=new Set();
 for(const ids of triangles){if(!Array.isArray(ids)||ids.length!==3||ids.some(i=>!Number.isInteger(i)||i<0||i>=points.length)||new Set(ids).size!==3)throw new RangeError('invalid triangle');const sk=[...ids].sort((a,b)=>a-b).join(':');if(seen.has(sk))throw new RangeError('duplicate triangle');seen.add(sk);const[a,b,c]=ids.map(i=>points[i]),area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);if(Math.abs(area)<1e-10)throw new RangeError('degenerate triangle');const center=make((a.x+b.x+c.x)/3,(a.z+b.z+c.z)/3);centroids.push(center);
  for(let k=0;k<3;k++){const i=ids[k],j=ids[(k+1)%3],ke=key(i,j);let e=edgeUse.get(ke);if(!e)edgeUse.set(ke,e={ids:[i,j],opposites:[]});e.opposites.push(ids[(k+2)%3]);if(e.opposites.length>2)throw new RangeError('nonmanifold dual');if(!midpoints.has(ke))midpoints.set(ke,make((points[i].x+points[j].x)/2,(points[i].z+points[j].z)/2));const before=ids[(k+2)%3],kb=key(i,before);if(!midpoints.has(kb))midpoints.set(kb,make((points[i].x+points[before].x)/2,(points[i].z+points[before].z)/2));cells[i].wedges.push({triangle:centroids.length-1,center,midA:midpoints.get(ke),midB:midpoints.get(kb)})}
 }
 for(const e of edgeUse.values())if(e.opposites.length===2){const[a,b]=e.ids.map(i=>points[i]),side=i=>(b.x-a.x)*(points[i].z-a.z)-(b.z-a.z)*(points[i].x-a.x);if(side(e.opposites[0])*side(e.opposites[1])>=0)throw new RangeError('overlapping triangle fan')}
 for(const e of edgeUse.values())if(e.opposites.length===1)for(const id of e.ids)cells[id].boundary=true;
 for(const c of cells){
  if(!c.wedges.length){c.pts=[];continue}const origin=make(c.source.x,c.source.z),perimeter=new Map(),byId=new Map();
  for(const w of c.wedges){const poly=[origin,w.midA,w.center,w.midB];for(let k=0;k<4;k++){const a=poly[k],b=poly[(k+1)%4],ke=key(a.id,b.id);byId.set(a.id,a);byId.set(b.id,b);if(perimeter.has(ke))perimeter.delete(ke);else perimeter.set(ke,[a.id,b.id])}}
  const adj=new Map();for(const [a,b]of perimeter.values()){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a)}
  if([...adj.values()].some(ns=>ns.length!==2))throw new RangeError('disconnected vertex fan');let prev=-1,cur=adj.keys().next().value;const first=cur;c.pts=[];
  do{c.pts.push(byId.get(cur));const ns=adj.get(cur),next=ns[0]===prev?ns[1]:ns[0];prev=cur;cur=next;if(c.pts.length>adj.size)throw new RangeError('invalid dual cycle')}while(cur!==first);
  if(c.pts.length!==adj.size)throw new RangeError('disconnected vertex fan');let area=0;for(let i=0;i<c.pts.length;i++){const a=c.pts[i],b=c.pts[(i+1)%c.pts.length];area+=a.x*b.z-b.x*a.z}if(area<0)c.pts.reverse();
 }
 return{cells,centroids,midpoints:[...midpoints.values()]};
}

/** The same barycentric dual on the shared polygon grid (quad/mixed/hex cells), not a fan
 * triangulation: every cell corner contributes the wedge [vertex, mid(edge i), cell centre,
 * mid(edge i-1)], so each dual cell keeps per-cell wedges (and therefore per-cell heights).
 * Wedges tile every cell exactly; rim vertices close at the vertex itself.
 */
export function gridVertexDual(grid,{include=null}={}){
 if(!grid?.cells||!grid?.verts)throw new TypeError('shared grid required');
 const mids=new Map(),mid=(a,b)=>{const k=a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;let m=mids.get(k);if(!m)mids.set(k,m={x:(a.x+b.x)/2,z:(a.z+b.z)/2});return m;};
 const cells=new Map();
 for(const c of grid.cells){
  if(include&&!include(c))continue;
  const center={x:c.cx,z:c.cz};
  for(let i=0;i<c.n;i++){const v=c.pts[i],prev=c.pts[(i+c.n-1)%c.n],next=c.pts[(i+1)%c.n];
   let d=cells.get(v.id);if(!d)cells.set(v.id,d={vertex:v.id,x:v.x,z:v.z,wedges:[]});
   const poly=[{x:v.x,z:v.z},mid(v,next),center,mid(prev,v)];let a=0;for(let k=0;k<4;k++){const p=poly[k],q=poly[(k+1)%4];a+=p.x*q.z-q.x*p.z;}
   d.wedges.push({cell:c.id,poly,area:Math.abs(a)/2});}
 }
 for(const d of cells.values()){d.area=d.wedges.reduce((s,w)=>s+w.area,0);d.cells=d.wedges.map(w=>w.cell);d.boundary=(grid.vertexCells?.get(d.vertex)?.length??d.wedges.length)!==d.wedges.length||d.wedges.some(w=>grid.cells[w.cell].edgeNeighbors.some((n,i)=>n<0&&(grid.cells[w.cell].pts[i].id===d.vertex||grid.cells[w.cell].pts[(i+1)%grid.cells[w.cell].n].id===d.vertex)));}
 return{cells:[...cells.values()]};
}

/** 959752525867036672 "a suitable place to start with foliage placement": one site per vertex
 * cell on the shared World. A vertex cell straddling a cliff keeps only the wedges on its highest
 * terrace (sites follow the terraces instead of hanging on the wall); built/river/water cells are
 * excluded. Spacing is a deterministic greedy pass, largest terrace area first.
 * Read-only. Vertical cliff faces themselves are not covered by any site.
 */
export function dualFoliageSites(world,{minAreaRatio=.55,spacing=0,limit=Infinity,levelHeight=.5,skipRim=true}={}){
 if(![minAreaRatio,spacing,levelHeight].every(Number.isFinite)||minAreaRatio<0||spacing<0||levelHeight<=0||!(limit>=0))throw new RangeError('invalid foliage site options');
 const ground=c=>world.ground(c),ok=c=>ground(c)>0&&!world.topIsBuilt(c)&&!world.river[c.id];
 const dual=gridVertexDual(world.grid),out=[];
 for(const d of dual.cells){
  if(skipRim&&d.boundary)continue;
  const tops=d.wedges.map(w=>world.grid.cells[w.cell]),top=Math.max(...tops.map(ground));if(top<=0)continue;
  const keep=d.wedges.filter(w=>{const c=world.grid.cells[w.cell];return ground(c)===top&&ok(c);});if(!keep.length)continue;
  let A=0,X=0,Z=0;for(const w of keep){let a=0,cx=0,cz=0;for(let k=0;k<4;k++){const p=w.poly[k],q=w.poly[(k+1)%4],cr=p.x*q.z-q.x*p.z;a+=cr;cx+=(p.x+q.x)*cr;cz+=(p.z+q.z)*cr;}a/=2;X+=cx/6;Z+=cz/6;A+=a;}
  let x=X/A,z=Z/A;
  // A non-contiguous or concave terrace union can put the centroid outside: fall back to the largest wedge's centroid.
  if(!keep.some(w=>pointInQuad(w.poly,x,z))){const big=keep.reduce((a,b)=>b.area>a.area?b:a);x=big.poly.reduce((s,p)=>s+p.x,0)/4;z=big.poly.reduce((s,p)=>s+p.z,0)/4;}
  out.push({vertex:d.vertex,x,z,y:top*levelHeight,level:top,area:Math.abs(A),fullArea:d.area,clipped:keep.length!==d.wedges.length,cells:keep.map(w=>w.cell)});
 }
 const areas=out.map(s=>s.area).sort((a,b)=>a-b),median=areas[areas.length>>1]||0,chosen=[];
 for(const s of out.sort((a,b)=>b.area-a.area||a.vertex-b.vertex)){
  if(chosen.length>=limit)break;if(s.area<median*minAreaRatio)continue;
  if(spacing>0&&chosen.some(c=>(c.x-s.x)**2+(c.z-s.z)**2<spacing*spacing))continue;chosen.push(s);
 }
 return{sites:chosen,candidates:out.length,medianArea:median,version:world.version};
}
