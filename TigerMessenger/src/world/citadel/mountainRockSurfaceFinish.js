import * as T from 'three';

// Final-stage corner normals. Does not move vertices or alter the collision
// surface. Shared-edge fans keep terrace rims and authored creases sharp.
export function finishMountainRockSurface(source,{enabled=false,toCastle=new T.Matrix4(),creaseAngleDeg=48,terraceSlope=.88,featureEdge=()=>false,protectedFace=()=>false,relax=true,maxDisplacement=.2,iterations=2}={}){
 if(!source?.attributes?.position)throw new TypeError('position geometry required');
 if(!Number.isFinite(creaseAngleDeg)||creaseAngleDeg<=0||creaseAngleDeg>=90||!toCastle.elements.every(Number.isFinite))throw new TypeError('finite transform and crease angle (0,90) required');
 const geometry=source.index?source.toNonIndexed():source.clone(),p=geometry.attributes.position;
 if(p.count%3||![...p.array].every(Number.isFinite))throw new TypeError('finite complete triangles required');
 const report={version:1,enabled,method:'shared-edge semantic corner fans',positionsChanged:false,trianglesBefore:(source.index?.count??source.attributes.position.count)/3,trianglesAfter:p.count/3,triangleReduction:0,softEdges:0,hardEdges:0,openEdges:0,nonManifoldEdges:0,windingEdges:0,changedCorners:0,maxNormalChangeDeg:0,semanticBarriers:0};
 if(!enabled)return{geometry,report};
 if(relax){
  const moved=relaxFinalRockVertices(geometry,{toCastle,creaseAngleDeg,terraceSlope,featureEdge,protectedFace,maxDisplacement,iterations});
  const finished=finishMountainRockSurface(geometry,{enabled:true,toCastle,creaseAngleDeg,terraceSlope,featureEdge,protectedFace,relax:false});geometry.dispose();finished.report.relaxation=moved;finished.report.positionsChanged=moved.movedVertices>0;return finished;
 }
 const faces=[],edges=new Map(),parent=Int32Array.from({length:p.count},(_,i)=>i),normalMatrix=new T.Matrix3().getNormalMatrix(toCastle);
 const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const next=parent[i];parent[i]=r;i=next;}return r;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 // Exact shared positions: nearby disconnected sheets are never welded.
 const key=v=>`${v.x},${v.y},${v.z}`;
 const semantics=['shoreBoundaryBottom','procgenSemantic','materialId','faceRegion','terrainSemantic'].filter(n=>geometry.attributes[n]);
 for(let f=0;f<p.count/3;f++){
  const pts=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,f*3+k)),n=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));
  if(n.lengthSq()<1e-24)throw new Error(`degenerate triangle ${f}`);n.normalize();
  const chart=pts.map(v=>v.clone().applyMatrix4(toCastle)),up=n.clone().applyMatrix3(normalMatrix).normalize();
  const sig=[0,1,2].map(k=>semantics.map(name=>geometry.attributes[name].getX(f*3+k)).join('/'));
  const material=geometry.groups.filter(g=>f*3>=g.start&&f*3<g.start+g.count).map(g=>g.materialIndex).join(',');
  const face={pts,n,chart,flat:Math.abs(up.y)>=terraceSlope,signature:material+':'+sig[0],blocked:sig.some(s=>s!==sig[0])||protectedFace(chart,n,f),angles:[]};faces.push(face);
  for(let k=0;k<3;k++){
   face.angles.push(pts[(k+1)%3].clone().sub(pts[k]).angleTo(pts[(k+2)%3].clone().sub(pts[k])));
   const a=key(pts[k]),b=key(pts[(k+1)%3]),ek=a<b?a+'|'+b:b+'|'+a;
   if(!edges.has(ek))edges.set(ek,[]);edges.get(ek).push({f,k,a,b});
  }
 }
 const cos=Math.cos(creaseAngleDeg*Math.PI/180);
 for(const pair of edges.values()){
  if(pair.length!==2){report.hardEdges++;if(pair.length===1)report.openEdges++;else report.nonManifoldEdges++;continue;}
  const[e,g]=pair,a=faces[e.f],b=faces[g.f];
  if(e.a===g.a){report.windingEdges++;report.hardEdges++;continue;}
  const semantic=a.blocked||b.blocked||a.flat!==b.flat||a.signature!==b.signature||featureEdge([a.chart[e.k],a.chart[(e.k+1)%3]],a.n,b.n,e.f,g.f);
  if(semantic||a.n.dot(b.n)<cos){report.hardEdges++;if(semantic)report.semanticBarriers++;continue;}
  join(e.f*3+e.k,g.f*3+(g.k+1)%3);join(e.f*3+(e.k+1)%3,g.f*3+g.k);report.softEdges++;
 }
 const sums=new Map();
 for(let i=0;i<p.count;i++){const r=find(i);if(!sums.has(r))sums.set(r,new T.Vector3());sums.get(r).addScaledVector(faces[Math.floor(i/3)].n,faces[Math.floor(i/3)].angles[i%3]);}
 const normals=new Float32Array(p.count*3),old=geometry.attributes.normal;
 for(let i=0;i<p.count;i++){
  const face=faces[Math.floor(i/3)],n=sums.get(find(i)).clone().normalize();
  // A chained fan may wrap far around a coarse fold; never use a normal
  // outside this corner's admissible hemisphere/crease cone.
  if(n.dot(face.n)<cos)n.copy(face.n);
  const before=old?new T.Vector3().fromBufferAttribute(old,i).normalize():face.n,angle=before.angleTo(n)*180/Math.PI;
  if(angle>1e-4)report.changedCorners++;report.maxNormalChangeDeg=Math.max(report.maxNormalChangeDeg,angle);n.toArray(normals,i*3);
 }
 geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.userData={...geometry.userData,finalRockSurfaceFinish:report};
 return{geometry,report};
}

// Position relaxation only within fully interior, non-flat, non-feature fans.
// All duplicated corners of a geometric vertex move together; seam coordinates
// are exact keys rather than proximity welding separate layers.
function relaxFinalRockVertices(g,{toCastle,creaseAngleDeg,terraceSlope,featureEdge,protectedFace,maxDisplacement,iterations}){
 if(!Number.isFinite(maxDisplacement)||maxDisplacement<0||maxDisplacement>.35||!Number.isInteger(iterations)||iterations<0||iterations>2)throw new TypeError('relaxation requires 0..0.35m and 0..2 iterations');
 const p=g.attributes.position,vertices=[],lookup=new Map(),faces=[],edges=new Map(),nm=new T.Matrix3().getNormalMatrix(toCastle),cos=Math.cos(creaseAngleDeg*Math.PI/180);
 const ids=[];
 for(let i=0;i<p.count;i++){const q=new T.Vector3().fromBufferAttribute(p,i),key=q.toArray().join(',');let id=lookup.get(key);if(id===undefined){id=vertices.length;lookup.set(key,id);vertices.push({point:q.clone(),original:q.clone(),corners:[],adj:new Set(),faces:[],locked:false});}vertices[id].corners.push(i);ids.push(id);}
 const normal=ii=>vertices[ii[1]].point.clone().sub(vertices[ii[0]].point).cross(vertices[ii[2]].point.clone().sub(vertices[ii[0]].point));
 for(let f=0;f<p.count/3;f++){
  const ii=ids.slice(f*3,f*3+3),n=normal(ii),area=n.length(),unit=n.clone().normalize(),chart=ii.map(i=>vertices[i].point.clone().applyMatrix4(toCastle));
  const shore=ii.some((_,k)=>g.attributes.shoreBoundaryBottom?.getX(f*3+k)>0);
  const locked=shore||Math.abs(unit.clone().applyMatrix3(nm).normalize().y)>=terraceSlope||protectedFace(chart,unit,f);
  faces.push({ii,unit,area});for(const i of ii){vertices[i].faces.push(f);if(locked)vertices[i].locked=true;}
  for(let k=0;k<3;k++){const a=ii[k],b=ii[(k+1)%3],key=a<b?a+':'+b:b+':'+a;vertices[a].adj.add(b);vertices[b].adj.add(a);if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key).faces.push(f);}
 }
 for(const e of edges.values()){
  const[a,b]=e.faces.map(f=>faces[f]);
  if(e.faces.length!==2||a.unit.dot(b.unit)<cos||featureEdge([vertices[e.a].point.clone().applyMatrix4(toCastle),vertices[e.b].point.clone().applyMatrix4(toCastle)],a.unit,b?.unit,e.faces[0],e.faces[1])){vertices[e.a].locked=true;vertices[e.b].locked=true;}
 }
 let rejected=0;
 for(let pass=0;pass<iterations;pass++){
  const frozen=vertices.map(v=>v.point.clone());
  for(let i=0;i<vertices.length;i++){
   const v=vertices[i];if(v.locked||!v.adj.size)continue;
   const mean=new T.Vector3();for(const j of v.adj)mean.add(frozen[j]);mean.multiplyScalar(1/v.adj.size);
   const delta=mean.sub(frozen[i]).multiplyScalar(.28),candidate=frozen[i].clone().add(delta),offset=candidate.clone().sub(v.original);
   if(offset.length()>maxDisplacement)candidate.copy(v.original).add(offset.setLength(maxDisplacement));
   const previous=v.point.clone();let accepted=false;
   for(let attempt=0;attempt<6;attempt++){
    v.point.copy(candidate);
    if(v.faces.every(f=>{const face=faces[f],n=normal(face.ii);return n.length()>Math.max(1e-12,face.area*.35)&&n.dot(face.unit)>n.length()*.5;})){accepted=true;break;}
    rejected++;candidate.lerp(previous,.5);
   }
   if(!accepted)v.point.copy(previous);
  }
 }
 let movedVertices=0,maxMove=0;for(const v of vertices){const d=v.point.distanceTo(v.original);if(d>1e-9)movedVertices++;maxMove=Math.max(maxMove,d);for(const i of v.corners)p.setXYZ(i,v.point.x,v.point.y,v.point.z);}
 p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
 return{iterations,maxDisplacement,movedVertices,maxMove,lockedVertices:vertices.filter(v=>v.locked).length,uniqueVertices:vertices.length,rejectedMoves:rejected,trianglesUnchanged:true};
}
