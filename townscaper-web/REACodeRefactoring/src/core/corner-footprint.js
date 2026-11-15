/** Local render-footprint experiment adapted from REACode/squarehex.js.
 * 1471817524148940807 "Square, yet hex" does not prove corner cutting was the original algorithm.
 * Preserve the source cell and routing graph: cut edges have no new portal semantics.
 */
export function cornerFootprint(cell, {cut=.25, all=false, flip=false, corners=null}={}) {
  if (corners!==null && (!Array.isArray(corners)||corners.length!==4||!corners.every(c=>typeof c==='boolean'))) throw new TypeError('corners must be four booleans');
  if (!Number.isFinite(cut)||cut<0||cut>.5) throw new RangeError('cut must be in [0,.5]');
  if (!cell || cell.n!==4 || cell.pts?.length!==4 || !cell.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))) throw new TypeError('finite quad cell required');
  const points=[];
  for(let i=0;i<4;i++){
    const p=cell.pts[i],a=cell.pts[(i+3)%4],b=cell.pts[(i+1)%4];
    if(cut>0&&(corners?corners[i]:(all||i%2===(flip?0:1))))points.push({x:p.x+(a.x-p.x)*cut,z:p.z+(a.z-p.z)*cut},{x:p.x+(b.x-p.x)*cut,z:p.z+(b.z-p.z)*cut});
    else points.push({x:p.x,z:p.z});
  }
  const clean=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>1e-10);
  if(clean.length>1&&Math.hypot(clean[0].x-clean.at(-1).x,clean[0].z-clean.at(-1).z)<1e-10)clean.pop();
  const area=ps=>Math.abs(ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p.x*q.z-q.x*p.z},0))/2;
  return {sourceCell:cell.id,points:clean,areaRatio:area(clean)/area(cell.pts),renderOnly:true};
}

/** Consistent "square, yet hex" plan for a whole grid: 2-colour the vertex graph (BFS). On a bipartite
 * grid (all-quad, disk) every quad alternates colours, so cutting colour-1 corners gives each quad two
 * OPPOSITE cut corners and every shared vertex is cut on all sides or none — neighbours keep a common
 * contact of (1 - cut) per edge. Mixed grids with triangles are not bipartite: bipartite=false. */
export function cornerCutPlan(grid){
  const nb=new Map();for(const c of grid.cells)for(let i=0;i<c.n;i++){const a=c.pts[i].id,b=c.pts[(i+1)%c.n].id;if(!nb.has(a))nb.set(a,new Set());if(!nb.has(b))nb.set(b,new Set());nb.get(a).add(b);nb.get(b).add(a);}
  const color=new Map();let bipartite=true;
  for(const start of [...nb.keys()].sort((a,b)=>a-b)){if(color.has(start))continue;color.set(start,0);const q=[start];
    for(let k=0;k<q.length;k++){const v=q[k];for(const u of nb.get(v)){if(!color.has(u)){color.set(u,1-color.get(v));q.push(u);}else if(color.get(u)===color.get(v))bipartite=false;}}}
  return{bipartite,cut:new Set([...color].filter(([,c])=>c===1).map(([v])=>v))};
}

/** Footprint metrics in REACode squarehex.runMetrics terms, measured on real cells:
 * mean |interior angle − 120°|, area ratio, and per shared edge the CONTACT length both footprints
 * keep (interval overlap along the original edge) relative to the edge length. contact 0 = the two
 * tiles only touch at a point ("越像六边越不连通"). */
export function footprintMetrics(grid,footprints){
  const byCell=new Map(footprints.map(f=>[f.sourceCell,f]));let angleDev=0,angles=0,area=0,contactSum=0,edges=0,broken=0;
  const along=(f,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,L2=dx*dx+dz*dz,ts=[];for(const p of f.points){const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/L2,off=Math.abs((p.x-a.x)*dz-(p.z-a.z)*dx)/Math.sqrt(L2);if(off<1e-9&&t>-1e-9&&t<1+1e-9)ts.push(t);}return ts.length>=2?[Math.min(...ts),Math.max(...ts)]:null;};
  for(const f of footprints){const P=f.points,n=P.length;area+=f.areaRatio;
    for(let i=0;i<n;i++){const a=P[(i+n-1)%n],b=P[i],c=P[(i+1)%n],ux=a.x-b.x,uz=a.z-b.z,vx=c.x-b.x,vz=c.z-b.z;angleDev+=Math.abs(Math.acos(Math.max(-1,Math.min(1,(ux*vx+uz*vz)/Math.hypot(ux,uz)/Math.hypot(vx,vz))))*180/Math.PI-120);angles++;}
    const cell=grid.cells[f.sourceCell];
    for(let i=0;i<cell.n;i++){const nid=cell.edgeNeighbors[i];if(nid<0||nid<cell.id||!byCell.has(nid))continue;const a=cell.pts[i],b=cell.pts[(i+1)%cell.n],I=along(f,a,b),J=along(byCell.get(nid),a,b);
      const c=I&&J?Math.max(0,Math.min(I[1],J[1])-Math.max(I[0],J[0])):0;contactSum+=c;edges++;if(c<=1e-9)broken++;}}
  return{cells:footprints.length,meanAngleDev:angles?angleDev/angles:0,areaRatio:footprints.length?area/footprints.length:0,contact:edges?contactSum/edges:0,sharedEdges:edges,brokenEdges:broken};
}

/** Rocky-island footprints on the shared World: every land quad gets its corner-cut render outline from
 * a whole-grid plan ('plan' = cornerCutPlan colouring, 'all' = cut4). Read-only; topology/World unchanged. */
export function islandFootprints(world,{cut=.5,mode='plan'}={}){
  if(mode!=='plan'&&mode!=='all')throw new RangeError('mode must be plan or all');
  const plan=mode==='plan'?cornerCutPlan(world.grid):null;if(plan&&!plan.bipartite)throw new RangeError('corner plan needs a bipartite (all-quad) grid');
  const footprints=world.grid.cells.filter(c=>c.n===4&&world.ground(c)>0).map(c=>cornerFootprint(c,{cut,corners:plan?c.pts.map(p=>plan.cut.has(p.id)):[true,true,true,true]}));
  return{footprints,metrics:footprintMetrics(world.grid,footprints),version:world.version};
}
