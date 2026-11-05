/** 1751932427272909032: verify an explicit module's geometric footprint.
 * Orientation-preserving 2D rigid fit (optional uniform scale), all cells at
 * once. This does not validate prefab sockets, solids, support or collision.
 */
export function fitModuleGeometry(source,target,mapping,{tolerance=1e-6,allowScale=false}={}){
 if(!Number.isFinite(tolerance)||tolerance<=0||typeof allowScale!=='boolean')throw new RangeError('Invalid fit options');
 const a=source?.cells,b=target?.cells;if(!Array.isArray(a)||!a.length||!Array.isArray(b)||!Array.isArray(mapping)||mapping.length!==a.length||new Set(mapping).size!==mapping.length||mapping.some(i=>!Number.isInteger(i)||i<0||i>=b.length))throw new TypeError('Invalid geometric mapping');
 const valid=c=>Array.isArray(c.pts)&&c.pts.length>=3&&c.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isInteger(p.id));
 if(!a.every(valid)||!mapping.map(i=>b[i]).every(valid))throw new TypeError('Invalid geometry');
 const audit=cs=>{const seen=new Map();for(const c of cs){if(new Set(c.pts.map(p=>p.id)).size!==c.pts.length)throw new TypeError('Repeated vertex ID');for(const p of c.pts){const old=seen.get(p.id);if(old&&(old.x!==p.x||old.z!==p.z))throw new TypeError('Inconsistent shared vertex');seen.set(p.id,p)}}};audit(a);audit(mapping.map(i=>b[i]));
 if(a.some((c,i)=>c.pts.length!==b[mapping[i]].pts.length))return null;
 const p=a[0].pts[0],q=a[0].pts[1],ux=q.x-p.x,uz=q.z-p.z,len=Math.hypot(ux,uz);if(!len)throw new RangeError('Degenerate source edge');
 const first=b[mapping[0]].pts;
 for(let start=0;start<first.length;start++){
  const r=first[start],s=first[(start+1)%first.length],vx=s.x-r.x,vz=s.z-r.z,L=Math.hypot(vx,vz);if(!L)continue;const scale=allowScale?L/len:1;
  if(Math.abs(L-len*scale)>tolerance)continue;
  const cos=(ux*vx+uz*vz)/(len*L),sin=(ux*vz-uz*vx)/(len*L),tx=r.x-scale*(cos*p.x-sin*p.z),tz=r.z-scale*(sin*p.x+cos*p.z);
  if(![scale,cos,sin,tx,tz].every(Number.isFinite))continue;
  const forward=new Map(),reverse=new Map(),shifts=[];let maxError=0,ok=true;
  for(let i=0;i<a.length&&ok;i++){
   const src=a[i].pts,dst=b[mapping[i]].pts;let found=null;
   for(let shift=0;shift<dst.length;shift++){
    const pairs=[];let error=0,fit=true;
    for(let k=0;k<src.length;k++){
     const u=src[k],v=dst[(k+shift)%dst.length],e=Math.hypot(scale*(cos*u.x-sin*u.z)+tx-v.x,scale*(sin*u.x+cos*u.z)+tz-v.z);
     if(!Number.isFinite(e)||e>tolerance||(forward.has(u.id)&&forward.get(u.id)!==v.id)||(reverse.has(v.id)&&reverse.get(v.id)!==u.id)){fit=false;break}pairs.push([u.id,v.id]);error=Math.max(error,e);
    }
    if(fit){found={pairs,error,shift};break;}
   }
   if(!found){ok=false;break;}for(const[u,v]of found.pairs){forward.set(u,v);reverse.set(v,u)}shifts.push(found.shift);maxError=Math.max(maxError,found.error);
  }
  if(ok)return{scale,angle:Math.atan2(sin,cos),translation:{x:tx,z:tz},maxError,shifts,scope:'2d-footprint-only'};
 }return null;
}
