/** 795010582239997952: "extract my adjacency data from the mesh ... show which ones fit".
 * Geometry-derived topology and translation-only boundary-edge candidates.
 * A candidate is NOT proof that whole faces/profiles or solid volumes fit.
 */
const key=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const point=p=>[p.x,p.y??0,p.z];
function weld(verts,eps){
  if(!Number.isFinite(eps)||eps<=0)throw new RangeError('Invalid weld tolerance');
  const merged=[],remap=new Int32Array(verts.length),buckets=new Map();
  verts.forEach((v,i)=>{const p=point(v);if(!p.every(Number.isFinite))throw new TypeError('Invalid vertex');const cell=p.map(x=>Math.floor(x/eps));let found=-1;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const ids=buckets.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))??[];for(const id of ids){const q=point(merged[id]);if(Math.hypot(...p.map((n,j)=>n-q[j]))<=eps&&(found<0||id<found))found=id;}}
    if(found<0){found=merged.length;merged.push({x:p[0],y:p[1],z:p[2]});const k=cell.join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(found);}remap[i]=found;
  });return {merged,remap};
}
export function meshEdges(verts,tris,eps=1e-4){
  const {merged,remap}=weld(verts,eps),edges=new Map(),degenerate=[];
  tris.forEach((t,f)=>{if(t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=verts.length))throw new TypeError('Invalid triangle');const ids=t.map(i=>remap[i]),p=ids.map(i=>point(merged[i])),u=p[1].map((v,i)=>v-p[0][i]),v=p[2].map((v,i)=>v-p[0][i]),area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
    if(new Set(ids).size!==3||area<=eps*eps){degenerate.push(f);return;}
    for(let e=0;e<3;e++){const a=ids[e],b=ids[(e+1)%3],k=key(a,b);if(!edges.has(k))edges.set(k,{a:Math.min(a,b),b:Math.max(a,b),faces:[],directions:[]});const edge=edges.get(k);edge.faces.push(f);edge.directions.push(a<b?1:-1);}
  });
  const boundary=[],pairs=[],nonManifold=[],windingConflicts=[];
  for(const[k,e]of edges){if(e.faces.length===1)boundary.push(k);else if(e.faces.length===2){pairs.push([e.faces[0],e.faces[1],k]);if(e.directions[0]===e.directions[1])windingConflicts.push(k);}else nonManifold.push(k);}
  return {edges,merged,remap,boundary,pairs,nonManifold,windingConflicts,degenerate};
}
/** Unoriented axis: negate the WHOLE vector, never each component separately.
 * Replaces the original lossy direction/length buckets with a metric descriptor.
 */
export function edgeSignature(pos,a,b){
  const p=point(pos[a]),q=point(pos[b]),d=q.map((v,i)=>v-p[i]),len=Math.hypot(...d);
  if(!Number.isFinite(len)||len===0)throw new RangeError('Invalid edge');
  const sign=(d.find(v=>Math.abs(v)>len*Number.EPSILON)??1)<0?-1:1;
  return {a,b,len,direction:d.map(v=>sign*v/len||0)};
}
export function buildFitTable(modules,{eps=1e-4,lengthTolerance=1e-4,angleTolerance=1e-4}={}){
  if(!Number.isFinite(lengthTolerance)||lengthTolerance<0||!Number.isFinite(angleTolerance)||angleTolerance<0||angleTolerance>Math.PI/2)throw new RangeError('Invalid fit tolerance');
  const table=modules.map(m=>{const topology=meshEdges(m.verts,m.tris,eps);return {name:m.name,...topology,slots:topology.boundary.map(k=>{const e=topology.edges.get(k),a=point(topology.merged[e.a]),b=point(topology.merged[e.b]),d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);return {key:k,length,direction:d.map(v=>v/length),a,b};})};});
  return {table,lengthTolerance,angleTolerance};
}
export function whichFits(fit,moduleIndex,edgeKey){
  const a=fit.table[moduleIndex]?.slots.find(s=>s.key===edgeKey);if(!a)return [];
  const matches=[];fit.table.forEach((m,module)=>{for(const b of m.slots){if(module===moduleIndex&&b.key===edgeKey)continue;const dot=Math.abs(a.direction.reduce((sum,v,i)=>sum+v*b.direction[i],0));if(Math.abs(a.length-b.length)<=fit.lengthTolerance&&dot>=Math.cos(fit.angleTolerance)-Number.EPSILON*4)matches.push({module,edge:b.key});}});return matches;
}
/** Derive reciprocal half-edges from polygon geometry, including boundary claims.
 * Do not mutate World or silently choose one neighbor on a nonmanifold edge.
 */
export function gridEdgeSlots(grid,world,{eps=1e-4,maxDelta=1}={}){
  const verts=grid.cells.flatMap(c=>c.pts),{remap}=weld(verts,eps),groups=new Map(),slots=[];let offset=0;
  for(const c of grid.cells){for(let e=0;e<c.pts.length;e++){const a=remap[offset+e],b=remap[offset+(e+1)%c.pts.length],k=key(a,b),p=c.pts[e],q=c.pts[(e+1)%c.pts.length],s={cell:c.id,edge:e,a:p,b:q,len:Math.hypot(q.x-p.x,q.z-p.z),neighbor:-1,neighborEdge:-1,dh:Infinity,fits:false,degenerate:a===b};if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);slots.push(s);}offset+=c.pts.length;}
  const byCell=new Map(grid.cells.map(c=>[c.id,c]));
  for(const users of groups.values())for(const s of users){s.nonManifold=users.length>2||users.length===2&&users[0].cell===users[1].cell;if(users.length===2&&!s.nonManifold&&!s.degenerate){const b=users.find(x=>x!==s);s.neighbor=b.cell;s.neighborEdge=b.edge;s.dh=world?Math.abs(world.top(byCell.get(s.cell))-world.top(byCell.get(b.cell))):0;s.fits=s.dh<=maxDelta;}}
  return slots;
}
export function selfCheck(grid,world,options){
  const slots=gridEdgeSlots(grid,world,options),cells=new Map(grid.cells.map(c=>[c.id,c])),bad=slots.filter(s=>(cells.get(s.cell).edgeNeighbors?.[s.edge]??-1)!==s.neighbor||s.nonManifold||s.degenerate);
  return {cells:grid.cells.length,slots:slots.length,edgesChecked:slots.length,mismatched:bad.length,nonManifold:slots.filter(s=>s.nonManifold).length,fitSlots:slots.filter(s=>s.fits).length,samples:bad.slice(0,5)};
}
