/** 1301816247479345152: "random patches of hand crafted grid".
 * Video shows quad templates/radial rings, not a regular hex-cell lattice.
 * Local approach: replace a bounded star-shaped disk with regular inner rings,
 * reuse its exact boundary vertices, and retain every outside polygon.
 * Fresh grid only: no implicit migration of a populated World's cell IDs.
 */
import {finishGrid,signedArea,isConvex} from './grid.js';
export function insertRadialPatch(grid,{x=0,z=0,radius=3,rings=3,innerRatio=.5}={}) {
 if(!grid?.cells?.length||![x,z,radius,innerRatio].every(Number.isFinite)||radius<=0||innerRatio<.15||innerRatio>.7||!Number.isInteger(rings)||rings<1||rings>8)throw new RangeError('invalid radial patch');
 const removed=new Set(grid.cells.filter(c=>Math.hypot(c.cx-x,c.cz-z)<radius).map(c=>c.id)),edges=[];
 if(!removed.size)throw new RangeError('empty patch');
 for(const id of removed){const c=grid.cells[id];for(let i=0;i<c.n;i++){const n=c.edgeNeighbors[i];if(n<0)throw new RangeError('patch reaches grid boundary');if(!removed.has(n))edges.push([c.pts[i],c.pts[(i+1)%c.n]])}}
 const next=new Map();for(const [a,b]of edges){if(next.has(a.id))throw new RangeError('patch boundary branches');next.set(a.id,b)}
 const boundary=[];let v=edges[0][0];for(let k=0;k<edges.length;k++){boundary.push(v);v=next.get(v.id);if(!v)throw new RangeError('open patch')}
 if(v.id!==boundary[0].id||new Set(boundary.map(p=>p.id)).size!==edges.length)throw new RangeError('patch has holes');
 if(signedArea(boundary)<0)boundary.reverse();const N=boundary.length;
 if(N<8||N%2)throw new RangeError('patch needs an even boundary of at least eight edges');
 const cross=(a,b)=>(a.x-x)*(b.z-z)-(a.z-z)*(b.x-x);
 if(boundary.some((a,i)=>cross(a,boundary[(i+1)%N])<=1e-8))throw new RangeError('patch is not star-shaped');
 const verts=[],byId=new Map(),add=(px,pz,pinned=false)=>{const v={id:verts.length,x:px,z:pz,pinned};verts.push(v);return v},clone=p=>{if(!byId.has(p.id))byId.set(p.id,add(p.x,p.z,p.pinned));return byId.get(p.id)};
 const polys=grid.cells.filter(c=>!removed.has(c.id)).map(c=>{const p=c.pts.map(clone);if(signedArea(p)<0)p.reverse();return p}),outsideCount=polys.length;
 let outer=boundary.map(clone);const minR=Math.min(...boundary.map(p=>Math.hypot(p.x-x,p.z-z))),R=minR*innerRatio;
 // Unwrap angles, then average phase; this preserves cyclic ordering.
 let prev=Math.atan2(boundary[0].z-z,boundary[0].x-x),sum=prev;
 for(let i=1;i<N;i++){let a=Math.atan2(boundary[i].z-z,boundary[i].x-x);while(a<=prev)a+=2*Math.PI;sum+=a-i*2*Math.PI/N;prev=a}const phase=sum/N;
 for(let r=1;r<=rings;r++){const t=r/rings,inner=boundary.map((p,i)=>{const a=phase+i*2*Math.PI/N;return add(p.x*(1-t)+(x+Math.cos(a)*R)*t,p.z*(1-t)+(z+Math.sin(a)*R)*t)});for(let i=0;i<N;i++)polys.push([outer[i],outer[(i+1)%N],inner[(i+1)%N],inner[i]]);outer=inner}
 const center=add(x,z);for(let i=0;i<N;i+=2)polys.push([center,outer[i],outer[(i+1)%N],outer[(i+2)%N]]);
 for(const p of polys){if(signedArea(p)<0)p.reverse();if(signedArea(p)<1e-8||!isConvex(p))throw new RangeError('unsafe patch geometry: choose another radius/centre')}
 const result=finishGrid(polys,verts,{radius:grid.radius,hexSize:grid.hexSize,kind:grid.kind,triangles:polys.filter(p=>p.length===3).length});
 result.patch={x,z,sourceRadius:radius,rings,innerRadius:R,boundaryIds:boundary.map(p=>clone(p).id),cellIds:result.cells.slice(outsideCount).map(c=>c.id),removedCells:removed.size,regularRing:outer.map(p=>p.id)};return result;
}
