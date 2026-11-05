/** 959752525867036672: "pulsating vertex cells; a dual to the triangular grid".
 * Barycentric dual (local choice, not proof of the original centre rule).
 * Shared triangle centroids and edge midpoints form one closed cell per vertex;
 * hull cells close at their source vertex rather than extrapolating to infinity.
 */
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
