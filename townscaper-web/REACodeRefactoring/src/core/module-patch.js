/** 1751932427272909032: "first generate the specific bit of grid they need".
 * An explicit geometric template creates a fresh shared-grid seed; synthesizeModulePatch infers it from an
 * adjacency graph and spliceModulePatch (r55) sews it into an existing grid (World via migrateWorldToPatch).
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

/** REACode tileforce.synthesizePatch, rebuilt on the shared template path: lay regular polygons
 * (side = 1) cell by cell in BFS order of an adjacency pattern {sides, adj}, each standing on a free
 * edge of its parent; new corners snap to existing ones so cycles close. Depth-first over edge choices
 * (bounded) until the generated cells' INDUCED adjacency equals the pattern exactly — not just a
 * spanning tree as in REACode. Output goes through generateModulePatch (overlap/T-junction checks).
 * Returns {grid, mapping (pattern index → cell id), tries}. Regular shapes only: patterns whose cycles
 * need irregular cells (e.g. 5 quads around a vertex) are rejected with RangeError.
 */
export function synthesizeModulePatch(pattern,{scale=1,maxTries=20000}={}){
 const {sides,adj}=pattern??{},n=sides?.length;
 if(!Array.isArray(sides)||!n||n>24||!sides.every(s=>Number.isInteger(s)&&s>=3&&s<=8)||!Array.isArray(adj)||adj.length!==n)throw new TypeError('Invalid module');
 for(let i=0;i<n;i++)if(!Array.isArray(adj[i])||adj[i].some(j=>!adj[j]?.includes(i)||j===i)||adj[i].length>sides[i])throw new TypeError('Invalid adjacency');
 if(!Number.isInteger(maxTries)||maxTries<1)throw new RangeError('Invalid budget');
 const order=[0],parent=Array(n).fill(-1),seen=new Set([0]);for(let k=0;k<order.length;k++)for(const j of [...adj[order[k]]].sort((a,b)=>a-b))if(!seen.has(j)){seen.add(j);parent[j]=order[k];order.push(j);}
 if(order.length!==n)throw new RangeError('Disconnected module');
 const verts=[],faces=Array(n).fill(null),EPS=1e-6;let tries=0;
 const snap=(x,z)=>{for(let i=0;i<verts.length;i++)if(Math.hypot(verts[i][0]-x,verts[i][1]-z)<EPS)return i;verts.push([x,z]);return verts.length-1;};
 const cen=f=>[f.reduce((s,i)=>s+verts[i][0],0)/f.length,f.reduce((s,i)=>s+verts[i][1],0)/f.length];
 const edgesOf=f=>f.map((a,i)=>[a,f[(i+1)%f.length]]);
 const shares=(f,g)=>edgesOf(f).some(([a,b])=>edgesOf(g).some(([c,d])=>(a===c&&b===d)||(a===d&&b===c)));
 const sat=(P,Q)=>{for(const R of[P,Q])for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length],nx=-(q[1]-p[1]),nz=q[0]-p[0],l=Math.hypot(nx,nz),pa=P.map(v=>(v[0]*nx+v[1]*nz)/l),pb=Q.map(v=>(v[0]*nx+v[1]*nz)/l);if(Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))<=1e-7)return false;}return true;};
 {const k=sides[0],R=.5/Math.sin(Math.PI/k);faces[0]=Array.from({length:k},(_,i)=>{const a=i*2*Math.PI/k-Math.PI/2;return snap(Math.cos(a)*R,Math.sin(a)*R);});}
 const place=t=>{
  if(t===n)return true;
  const i=order[t],p=faces[parent[i]],[pcx,pcz]=cen(p),k=sides[i];
  const options=edgesOf(p).map(([a,b],e)=>{const m=[(verts[a][0]+verts[b][0])/2,(verts[a][1]+verts[b][1])/2];return{a,b,e,score:Math.hypot(m[0]-pcx,m[1]-pcz)};}).sort((x,y)=>y.score-x.score||x.e-y.e);
  for(const {a,b} of options){
   if(++tries>maxTries)throw new RangeError('module synthesis budget exhausted');
   if(faces.some((f,j)=>f&&j!==parent[i]&&edgesOf(f).some(([c,d])=>(c===a&&d===b)||(c===b&&d===a))))continue;
   const A=verts[a],B=verts[b],L=Math.hypot(B[0]-A[0],B[1]-A[1]),R=L/(2*Math.sin(Math.PI/k)),d=R*Math.cos(Math.PI/k),mx=(A[0]+B[0])/2,mz=(A[1]+B[1])/2;
   let nx=mx-pcx,nz=mz-pcz;const ln=Math.hypot(nx,nz);nx/=ln;nz/=ln;const ox=mx+nx*d,oz=mz+nz*d,aB=Math.atan2(B[1]-oz,B[0]-ox),step=2*Math.PI/k;
   const far=s=>{const q=[ox+Math.cos(aB+s*step)*R,oz+Math.sin(aB+s*step)*R];return Math.hypot(q[0]-pcx,q[1]-pcz);},dir=far(-1)>far(1)?-1:1;
   const mark=verts.length,face=[a,b];for(let j=1;j<k-1;j++)face.push(snap(ox+Math.cos(aB+dir*step*j)*R,oz+Math.sin(aB+dir*step*j)*R));
   const pts=face.map(v=>verts[v]),ok=new Set(face).size===k&&faces.every((f,j)=>!f||!sat(f.map(v=>verts[v]),pts))
     &&faces.every((f,j)=>!f||shares(f,face)===adj[i].includes(j));
   if(ok){faces[i]=face;if(place(t+1))return true;faces[i]=null;}
   verts.length=mark;
  }
  return false;
 };
 if(!place(1))throw new RangeError('pattern not realisable with regular cells');
 const grid=generateModulePatch({vertices:verts,faces},{scale});
 // generateModulePatch keeps face order, so pattern index i is grid cell i.
 return{grid,mapping:Array.from({length:n},(_,i)=>i),tries};
}

/** 1751932427272909032 "first generate the specific bit of grid they need" — and put it INTO the live grid.
 * The synthesized patch (synthesizeModulePatch().grid) is moved to (x,z), the existing cells around it are cut
 * out (a single star-shaped hole, grown until it clears the patch by `clearance`), and the gap between the hole
 * boundary and the patch boundary is closed by an angular zipper of triangles that reuse BOTH loops' exact
 * vertices (no T-junctions). Outside cells keep their vertex objects; sourceCellOf maps new cells to old ones
 * (-1 = patch or seam), so migrateWorldToPatch() can carry an existing World over. Throws RangeError when the
 * hole would reach the grid boundary or the seam cannot be triangulated (ear clipping + Lawson flips, area check). Returns the new grid with .splice = {patchCellIds,
 * seamCellIds, removedCells, holeRadius}; patchCellIds[i] is the new id of patch cell i. */
export function spliceModulePatch(grid,patch,{x=0,z=0,angle=0,clearance=null,maxGrow=8}={}){
 if(!grid?.cells?.length||!patch?.cells?.length||![x,z,angle].every(Number.isFinite))throw new RangeError('grid, patch and finite placement required');
 const pc=patch.cells,pv=patch.verts,cs=Math.cos(angle),sn=Math.sin(angle);
 const pcx=pv.reduce((s,p)=>s+p.x,0)/pv.length,pcz=pv.reduce((s,p)=>s+p.z,0)/pv.length;
 // patch boundary loop from its open half-edges
 const pnext=new Map();for(const c of pc)for(let i=0;i<c.n;i++)if(c.edgeNeighbors[i]<0){const a=c.pts[i],b=c.pts[(i+1)%c.n];if(pnext.has(a.id))throw new RangeError('patch boundary branches');pnext.set(a.id,b.id);}
 const pLoop=[];{let v=pnext.keys().next().value;for(let k=0;k<pnext.size;k++){pLoop.push(v);v=pnext.get(v);}if(v!==pLoop[0]||new Set(pLoop).size!==pnext.size)throw new RangeError('patch has holes');}
 const place=p=>{const dx=p.x-pcx,dz=p.z-pcz;return{x:x+cs*dx-sn*dz,z:z+sn*dx+cs*dz};};
 const pPos=new Map(pv.map(p=>[p.id,place(p)])),rP=Math.max(...[...pPos.values()].map(p=>Math.hypot(p.x-x,p.z-z)));
 const step=grid.hexSize??1,clear=clearance??step*.5;
 const ang=p=>Math.atan2(p.z-z,p.x-x);
 for(let grow=0;grow<=maxGrow;grow++){
  const R=rP+clear+grow*step*.5;
  const removed=new Set(grid.cells.filter(c=>Math.hypot(c.cx-x,c.cz-z)<R||c.pts.some(p=>Math.hypot(p.x-x,p.z-z)<rP+clear*.35)).map(c=>c.id));
  const edges=[];let bad=false;
  for(const id of removed){const c=grid.cells[id];for(let i=0;i<c.n;i++){const nb=c.edgeNeighbors[i];if(nb<0){bad=true;break;}if(!removed.has(nb))edges.push([c.pts[i],c.pts[(i+1)%c.n]]);}if(bad)break;}
  if(bad)throw new RangeError('splice hole reaches grid boundary');
  const next=new Map();for(const[a,b]of edges){if(next.has(a.id)){bad=true;break;}next.set(a.id,b);}if(bad)continue;
  const hole=[];{let v=edges[0][0];for(let k=0;k<edges.length;k++){hole.push(v);v=next.get(v.id);if(!v){bad=true;break;}}if(bad||v.id!==hole[0].id||new Set(hole.map(p=>p.id)).size!==edges.length)continue;}
  if(hole.some(p=>Math.hypot(p.x-x,p.z-z)<=rP*1.02))continue;
  // build vertex list: outside vertices keep ids via clone map; patch verts appended
  const verts=[],byId=new Map(),add=(px,pz,pinned=false)=>{const v={id:verts.length,x:px,z:pz,pinned};verts.push(v);return v;},clone=p=>{if(!byId.has(p.id))byId.set(p.id,add(p.x,p.z,p.pinned));return byId.get(p.id);};
  const keep=grid.cells.filter(c=>!removed.has(c.id)),polys=keep.map(c=>{const p=c.pts.map(clone);if(signedArea(p)<0)p.reverse();return p;});
  const pMap=new Map();for(const p of pv){const q=pPos.get(p.id);pMap.set(p.id,add(q.x,q.z,true));}
  const patchStart=polys.length;for(const c of pc){const p=c.pts.map(v=>pMap.get(v.id));if(signedArea(p)<0)p.reverse();polys.push(p);}
  // orient both loops CCW (signedArea>0) and zip them by angle around (x,z)
  let A=pLoop.map(id=>pMap.get(id)),B=hole.map(clone);if(signedArea(A)<0)A.reverse();if(signedArea(B)<0)B.reverse();
  const unwrap=L=>{const out=[];let prev=ang(L[0]);out.push(prev);for(let i=1;i<L.length;i++){let a=ang(L[i]);while(a<prev)a+=2*Math.PI;out.push(a);prev=a;}return out;};
  // star-shaped check: angles strictly increase over exactly one turn
  const aA=unwrap(A),aB=unwrap(B);if(aA.at(-1)-aA[0]>=2*Math.PI||aB.at(-1)-aB[0]>=2*Math.PI||aA.some((a,i)=>i&&a<=aA[i-1])||aB.some((a,i)=>i&&a<=aB[i-1]))continue;
  // rotate B to start at the vertex angularly closest after A[0]
  // annulus = outer loop B (CCW) + inner loop A (CW) joined by a bridge at the closest vertex pair, then
  // quality ear clipping (each step clips the convex, empty ear with the largest minimum angle). Uses only the
  // two loops' existing vertices, so no T-junctions; robust for non-convex star-shaped patches.
  const minAng=t=>{let m=Math.PI;for(let k=0;k<3;k++){const p=t[k],q=t[(k+1)%3],r=t[(k+2)%3],ux=q.x-p.x,uz=q.z-p.z,vx=r.x-p.x,vz=r.z-p.z;m=Math.min(m,Math.acos(Math.max(-1,Math.min(1,(ux*vx+uz*vz)/Math.hypot(ux,uz)/Math.hypot(vx,vz)))));}return m;};
  let bi=0,bj=0,bd=Infinity;for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){const d=Math.hypot(A[i].x-B[j].x,A[i].z-B[j].z);if(d<bd){bd=d;bi=i;bj=j;}}
  const Ar=[];for(let k=0;k<=A.length;k++)Ar.push(A[(bi-k+A.length*2)%A.length]);
  const ring=[];for(let k=0;k<=B.length;k++)ring.push(B[(bj+k)%B.length]);ring.push(...Ar);   // B..B[bj] -> A[bi]..A[bi]
  const cr=(o,p,q)=>(p.x-o.x)*(q.z-o.z)-(p.z-o.z)*(q.x-o.x),eps=1e-10*step*step;
  const inside=(p,a,b,c)=>cr(a,b,p)>eps&&cr(b,c,p)>eps&&cr(c,a,p)>eps;
  const seam=[],poly=ring.slice();let guard=0;
  while(poly.length>3&&guard++<4096){let best=-1,bq=-1;
   for(let k=0;k<poly.length;k++){const a=poly[(k-1+poly.length)%poly.length],b=poly[k],c=poly[(k+1)%poly.length];
    if(a===c||cr(a,b,c)<=eps)continue;
    if(poly.some(p=>p!==a&&p!==b&&p!==c&&inside(p,a,b,c)))continue;
    // the new diagonal a-c may not run along / through a vertex that shares its position
    const q=minAng([a,b,c]);if(q>bq){bq=q;best=k;}}
   if(best<0)break;const k=best;seam.push([poly[(k-1+poly.length)%poly.length],poly[k],poly[(k+1)%poly.length]]);poly.splice(k,1);}
  if(poly.length===3&&cr(poly[0],poly[1],poly[2])>eps)seam.push(poly.slice());else continue;
  // Lawson-style flips inside the seam only (loop edges stay): raise the worst angle of each triangle pair
  {const ori=t=>cr(t[0],t[1],t[2])>eps;let changed=true,rounds=0;
   while(changed&&rounds++<64){changed=false;
    for(let x=0;x<seam.length;x++)for(let y=x+1;y<seam.length;y++){const T=seam[x],U=seam[y];
     const sh=T.filter(v=>U.includes(v));if(sh.length!==2)continue;const p=T.find(v=>!sh.includes(v)),q=U.find(v=>!sh.includes(v));
     // T = (p, s0, s1) in CCW order
     const i=T.indexOf(p),s0=T[(i+1)%3],s1=T[(i+2)%3],n1=[p,s0,q],n2=[p,q,s1];
     if(!ori(n1)||!ori(n2))continue;
     if(Math.min(minAng(n1),minAng(n2))>Math.min(minAng(T),minAng(U))+1e-9){seam[x]=n1;seam[y]=n2;changed=true;}}}}
  if(seam.length!==A.length+B.length)continue;
  // no fold / overlap: patch + seam must tile the hole exactly
  const area=t=>Math.abs(signedArea(t));const holeA=area(B),fillA=area(A)+seam.reduce((s,t)=>s+area(t),0);if(Math.abs(holeA-fillA)>1e-7*holeA)continue;
  const fixed=seam.map(t=>signedArea(t)<0?t.slice().reverse():t);
  const seamStart=polys.length;polys.push(...fixed);
  const out=decorateCells(finishGrid(polys,verts,{radius:grid.radius,hexSize:grid.hexSize,kind:grid.kind,triangles:polys.filter(p=>p.length===3).length}));
  out.sourceCellOf=keep.map(c=>c.id).concat(Array(out.cells.length-keep.length).fill(-1));
  out.splice={x,z,holeRadius:R,removedCells:[...removed].sort((a,b)=>a-b),patchCellIds:pc.map((_,k)=>patchStart+k),seamCellIds:fixed.map((_,k)=>seamStart+k),holeLoop:B.map(p=>p.id),patchLoop:A.map(p=>p.id)};
  return out;
 }
 throw new RangeError('no valid star-shaped hole found for splice');
}

/** Topology audit used after a splice: every interior half-edge has a reciprocal twin, the open half-edges
 * form exactly one closed loop, and Euler V-E+F = 1 (a disk). */
export function halfEdgeClosure(grid){
 let open=0,bad=0;const E=new Set(),nxt=new Map();
 for(const c of grid.cells)for(let i=0;i<c.n;i++){const a=c.pts[i].id,b=c.pts[(i+1)%c.n].id;E.add(a<b?a+'-'+b:b+'-'+a);const nb=c.edgeNeighbors[i];
  if(nb<0){open++;nxt.set(a,b);continue;}const o=grid.cells[nb],t=c.edgeTwins[i];if(!o||o.edgeNeighbors[t]!==c.id||o.pts[t].id!==b||o.pts[(t+1)%o.n].id!==a)bad++;}
 let loops=0;const seen=new Set();for(const s of nxt.keys()){if(seen.has(s))continue;loops++;let v=s;while(!seen.has(v)){seen.add(v);v=nxt.get(v);if(v===undefined){bad++;break;}}}
 const V=new Set(grid.cells.flatMap(c=>c.pts.map(p=>p.id))).size;
 return{ok:!bad&&loops===1&&V-E.size+grid.cells.length===1,badTwins:bad,openEdges:open,loops,euler:V-E.size+grid.cells.length};
}
