// Geometry-only coastal finish. Features belong to edges, not merely to a
// vertex's height: creases move along their own chain, never across a ledge.
export const SEA_STACK_SURFACE_REVISION=1;
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=a=>{const n=length(a)||1;return a.map(v=>v/n);};
const faceNormal=(p,a,b,c)=>cross(sub(p[b],p[a]),sub(p[c],p[a]));

export function smoothSeaStackSurface(positions,indices,{radius,height,terraceLevels=[],enabled=true,iterations=4}={}){
 const original=positions.map(p=>p.slice()),points=positions.map(p=>p.slice());
 const count=points.length,adj=Array.from({length:count},()=>new Set()),incident=Array.from({length:count},()=>[]),features=Array.from({length:count},()=>new Set());
 const edges=new Map(),faces=[];
 for(let j=0;j<indices.length;j+=3){
  const ids=indices.slice(j,j+3),normal=faceNormal(original,...ids),area=length(normal),id=faces.length;
  faces.push({ids,normal,unit:unit(normal),area});
  for(let k=0;k<3;k++){
   const a=ids[k],b=ids[(k+1)%3];incident[a].push(id);adj[a].add(b);adj[b].add(a);
   const key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,{a:Math.min(a,b),b:Math.max(a,b),faces:[],direction:0});
   const e=edges.get(key);e.faces.push(id);e.direction+=a<b?1:-1;
  }
 }
 const footprint=Math.max(...original.map(p=>Math.hypot(p[0],p[2]))),base=-height*.5;
 const tolerance=Math.max(2e-5,height*1e-6),planes=terraceLevels.map(t=>base+t*height);
 const baseLocked=original.map(p=>Math.abs(p[1]-base)<tolerance);
 const planeFor=original.map(p=>planes.find(y=>Math.abs(p[1]-y)<tolerance));
 const areaFloor=Math.pow(Math.max(radius,height),2)*1e-14;
 let boundaryEdges=0,nonManifoldEdges=0,orientationErrors=0,featureEdges=0;
 for(const e of edges.values()){
  if(e.faces.length===1)boundaryEdges++;if(e.faces.length>2)nonManifoldEdges++;
  if(e.faces.length===2&&e.direction!==0)orientationErrors++;
  const [f,g]=e.faces.map(i=>faces[i]);
  // Flat terrace against wall, crown rim, or a strong dihedral joint.
  const terraceBoundary=g&&(f.unit[1]>.85)!==(g.unit[1]>.85);
  if(e.faces.length!==2||terraceBoundary||dot(f.unit,g.unit)<.64){features[e.a].add(e.b);features[e.b].add(e.a);featureEdges++;}
 }
 const locked=original.map((p,i)=>{
  const chain=[...features[i]];
  if(baseLocked[i]||chain.length===1||chain.length>2)return true;
  // Preserve pronounced corners and junctions. Small irregularities in a
  // near-straight edge chain may relax without rounding the whole silhouette.
  return chain.length===2&&dot(unit(sub(original[chain[0]],p)),unit(sub(original[chain[1]],p)))>-.3;
 });
 const maxDisplacement=radius*.035;
 const stats={revision:SEA_STACK_SURFACE_REVISION,enabled,iterations:0,vertices:count,triangles:faces.length,featureEdges,featureVertices:features.filter(s=>s.size).length,lockedVertices:locked.filter(Boolean).length,baseLockedVertices:baseLocked.filter(Boolean).length,terraceVertices:planeFor.filter(y=>y!==undefined).length,boundaryEdges,nonManifoldEdges,orientationErrors,rejectedMoves:0,movedVertices:0,maxDisplacement:0,displacementLimit:maxDisplacement,originalFootprint:footprint,finalFootprint:footprint};
 if(!enabled||boundaryEdges||nonManifoldEdges||orientationErrors||faces.some(f=>f.area<=areaFloor)){
  stats.skippedReason=!enabled?'study-disabled':'invalid-input-topology';return {positions:points,stats,features:{locked,baseLocked,edgeChains:features.map(s=>[...s]),terracePlanes:planeFor.map(y=>y??null)}};
 }
 for(let pass=0;pass<iterations;pass++){
  const snapshot=points.map(p=>p.slice());
  // In-place validation makes each accepted move legal relative to all earlier
  // moves in this pass. Targets use a frozen snapshot to avoid directional bias.
  for(let i=0;i<count;i++){
   if(locked[i])continue;
   const chain=[...features[i]],neighbors=chain.length===2?chain:[...adj[i]];
   if(!neighbors.length)continue;
   const target=[0,0,0];for(const j of neighbors)for(let k=0;k<3;k++)target[k]+=snapshot[j][k]/neighbors.length;
   let delta=sub(target,snapshot[i]);
   if(chain.length!==2){
    const normal=[0,0,0];for(const f of incident[i])for(let k=0;k<3;k++)normal[k]+=faces[f].normal[k];
    const n=unit(normal),along=dot(delta,n);
    // Mostly tangent relaxation, with a restrained normal component to remove
    // tetrahedron-scale bumps without shrinking the authored slabs into blobs.
    delta=delta.map((v,k)=>v-.65*along*n[k]);
   }
   let candidate=snapshot[i].map((v,k)=>v+delta[k]*.26);
   if(planeFor[i]!==undefined)candidate[1]=original[i][1];
   let offset=sub(candidate,original[i]),distance=length(offset);
   if(distance>maxDisplacement)candidate=original[i].map((v,k)=>v+offset[k]*maxDisplacement/distance);
   const radial=Math.hypot(candidate[0],candidate[2]);
   if(radial>footprint){candidate[0]*=footprint/radial;candidate[2]*=footprint/radial;}
   // Line search preserves every triangle's original hemisphere and a usable
   // area, including the very narrow triangles produced by marching tetrahedra.
   const previous=points[i];let accepted=false;
   for(let attempt=0;attempt<6;attempt++){
    points[i]=candidate;
    const valid=incident[i].every(id=>{const f=faces[id],n=faceNormal(points,...f.ids),area=length(n);return area>Math.max(areaFloor,f.area*.2)&&dot(n,f.unit)>area*.2;});
    if(valid){accepted=true;break;}stats.rejectedMoves++;candidate=candidate.map((v,k)=>(v+previous[k])*.5);
   }
   if(!accepted)points[i]=previous;
  }
  stats.iterations++;
 }
 for(let i=0;i<count;i++){const d=length(sub(points[i],original[i]));if(d>1e-8)stats.movedVertices++;stats.maxDisplacement=Math.max(stats.maxDisplacement,d);}
 stats.finalFootprint=Math.max(...points.map(p=>Math.hypot(p[0],p[2])));
 return {positions:points,stats,features:{locked,baseLocked,edgeChains:features.map(s=>[...s]),terracePlanes:planeFor.map(y=>y??null)}};
}
