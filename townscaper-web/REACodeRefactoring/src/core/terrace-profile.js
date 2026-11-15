/** Local World diagnostic, inspired by REACode/terracecliff.classify.
 * 815236105079398400 "irregular is the new hex" does not specify quantization.
 * r53: per-cell inland slope class (REACode classify: flat / one-level soft step / ≥2-level cliff,
 * shore excluded) and inland soft vs cliff step-edge counts, for softSlopes generation.
 * Measures logical undeformed top columns, not actual mesh slopes, caves or overhang underside area.
 */
export function terraceProfile(world,{levelHeight=1}={}){
 if(!Number.isFinite(levelHeight)||levelHeight<=0)throw new RangeError('positive level height required');
 const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),heights=new Map(cells.map(c=>[c.id,world.ground(c)])),seen=new Set(),patches=[];
 let topArea=0,stepArea=0,shoreLength=0,stepEdges=0,softSteps=0,cliffSteps=0;const slope={flat:0,soft:0,cliff:0};
 const area=c=>Math.abs(c.pts.reduce((v,p,i)=>{const q=c.pts[(i+1)%c.n];return v+p.x*q.z-q.x*p.z},0))/2;
 for(const c of cells){const h=heights.get(c.id);if(!h)continue;topArea+=area(c);let g=0;for(const id of c.edgeNeighbors)if(byId.has(id)&&heights.get(id))g=Math.max(g,Math.abs(h-heights.get(id)));slope[g===0?'flat':g===1?'soft':'cliff']++;
  for(let i=0;i<c.n;i++){const id=c.edgeNeighbors[i],other=byId.get(id),oh=heights.get(id)||0;if(h<=oh)continue;const a=c.pts[i],b=c.pts[(i+1)%c.n],len=Math.hypot(a.x-b.x,a.z-b.z);stepArea+=len*(h-oh)*levelHeight;stepEdges++;if(!other||oh===0)shoreLength+=len;else if(h-oh===1)softSteps++;else cliffSteps++;}
  if(seen.has(c.id))continue;const queue=[c];seen.add(c.id);let patchArea=0;
  for(let j=0;j<queue.length;j++){const q=queue[j];patchArea+=area(q);for(const id of q.edgeNeighbors)if(!seen.has(id)&&heights.get(id)===h){const next=byId.get(id);if(next){seen.add(id);queue.push(next);}}}
  patches.push({level:h,cells:queue.map(c=>c.id),area:patchArea});
 }
 return{version:world.version,landCells:seen.size,slope,softSteps,cliffSteps,patches,topArea,stepArea,stepEdges,shoreLength,logicalColumnsOnly:true};
}
/** r55 (REACode/terracecliff fieldSmooth vs fieldTerrace, measured on the drawn mesh instead of logical columns):
 * bins the final top-surface triangles and wall quads recorded by terrain/terrainmesh.js (World.terrainSurface)
 * by their real slope. flat < flatDeg ≤ soft < cliffDeg ≤ steep top; walls are reported separately with their
 * area. With world.softTops the one-level soft steps become sloped top area and their wall area disappears.
 */
export function meshSlopeProfile(surface,{flatDeg=3,cliffDeg=40}={}){
 if(!surface?.tops||!surface?.walls)throw new RangeError('meshSlopeProfile needs World.terrainSurface');
 const area3=(A,B,C)=>{const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v=[C[0]-A[0],C[1]-A[1],C[2]-A[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return{a:l/2,ny:l?Math.abs(n[1])/l:1};};
 const top={flat:0,soft:0,steep:0};let maxDeg=0;const hist=new Array(9).fill(0);
 for(const t of surface.tops){const{a,ny}=area3(...t.t);if(a<1e-12)continue;const deg=Math.acos(Math.min(1,ny))*180/Math.PI;maxDeg=Math.max(maxDeg,deg);hist[Math.min(8,Math.floor(deg/10))]+=a;top[deg<flatDeg?'flat':deg<cliffDeg?'soft':'steep']+=a;}
 let wallArea=0;for(const w of surface.walls){const[A,B,C,D]=w.q;wallArea+=area3(A,B,C).a+area3(A,C,D).a;}
 const total=top.flat+top.soft+top.steep;
 return{top,topArea:total,softShare:total?top.soft/total:0,wallArea,maxTopDeg:maxDeg,histogram10deg:hist};
}
