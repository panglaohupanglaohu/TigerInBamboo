/** 1751932427272909032: "first generate the specific bit of grid they need".
 * An explicit geometric template creates a fresh shared-grid seed. Does not
 * infer geometry from an adjacency graph or splice an existing live World.
 */
import {finishGrid,signedArea,isConvex} from './grid.js';
import {decorateCells} from './spatial.js';
const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
function overlaps(a,b,eps){
 for(const poly of[a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],len=Math.hypot(q.x-p.x,q.z-p.z),nx=-(q.z-p.z)/len,nz=(q.x-p.x)/len;
  const aa=a.map(v=>v.x*nx+v.z*nz),bb=b.map(v=>v.x*nx+v.z*nz);
  if(Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))<=eps)return false;
 }return true;
}
export function generateModulePatch({vertices,faces},{scale=1,angle=0,x=0,z=0}={}){
 if(!Array.isArray(vertices)||!Array.isArray(faces)||vertices.length<3||vertices.length>512||!faces.length||faces.length>128||![scale,angle,x,z].every(Number.isFinite)||scale<=0)throw new RangeError('Invalid patch dimensions');
 const cs=Math.cos(angle),sn=Math.sin(angle),eps=scale*1e-8;
 const verts=vertices.map((p,id)=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw new TypeError('Invalid vertex');const v={id,x:x+scale*(cs*p[0]-sn*p[1]),z:z+scale*(sn*p[0]+cs*p[1])};if(!Number.isFinite(v.x)||!Number.isFinite(v.z))throw new RangeError('Overflow');return v});
 for(let i=0;i<verts.length;i++)for(let j=0;j<i;j++)if(Math.hypot(verts[i].x-verts[j].x,verts[i].z-verts[j].z)<=eps)throw new RangeError('Duplicate vertex: use shared indices');
 const used=new Set();const polys=faces.map(ids=>{
  if(!Array.isArray(ids)||ids.length<3||ids.length>8||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=verts.length))throw new TypeError('Invalid face');
  ids.forEach(i=>used.add(i));let p=ids.map(i=>verts[i]);if(Math.abs(signedArea(p))<=eps*scale||!isConvex(p))throw new RangeError('Degenerate or nonconvex face');
  // Strict convexity rejects collinear corners and self-crossing star order.
  if(signedArea(p)<0)p=p.slice().reverse();for(let i=0;i<p.length;i++)for(let k=0;k<p.length;k++)if(k!==i&&k!==(i+1)%p.length&&cross(p[i],p[(i+1)%p.length],p[k])<=eps*scale)throw new RangeError('Invalid winding/convexity');return p;
 });
 if(used.size!==verts.length)throw new RangeError('Unused vertices');
 for(const poly of polys)for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],len=Math.hypot(b.x-a.x,b.z-a.z);
  for(const p of verts)if(p!==a&&p!==b&&Math.abs(cross(a,b,p))<=eps*len){const t=((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/(len*len);if(t>eps/len&&t<1-eps/len)throw new RangeError('T-junction');}
 }
 for(let i=0;i<polys.length;i++)for(let j=0;j<i;j++)if(overlaps(polys[i],polys[j],eps))throw new RangeError('Overlapping faces');
 const grid=decorateCells(finishGrid(polys,verts,{radius:Math.max(...verts.map(p=>Math.hypot(p.x,p.z))),hexSize:scale,kind:'module-patch',triangles:[]}));
 const visited=new Set([0]),queue=[0];for(let k=0;k<queue.length;k++)for(const n of grid.cells[queue[k]].edgeNeighbors)if(n>=0&&!visited.has(n)){visited.add(n);queue.push(n)}
 if(visited.size!==grid.cells.length)throw new RangeError('Disconnected patch');return grid;
}
export const PATCH_EXAMPLE={vertices:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],faces:[[0,1,4,3],[1,2,5,4],[3,4,7],[3,7,6],[4,5,8,7]]};
