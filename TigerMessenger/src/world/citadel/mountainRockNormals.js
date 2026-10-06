import {resolveMountainParams} from './mountainRelease.js';
import * as THREE from 'three';

export function rockSurfaceOptions(search=globalThis.location?.search||''){
 const q=resolveMountainParams(search).params,requestedPass=q.get('citadelRockSurfacePass'),pass=requestedPass==='4'?4:requestedPass==='3'?3:requestedPass==='2'?2:requestedPass==='1'?1:0;
 const requested=q.has('citadelRockBump')?Number(q.get('citadelRockBump')):NaN;
 const rawRelief=q.get('citadelRockRelief'),relief=rawRelief?.trim()?Number(rawRelief):NaN;
 const rawDetail=q.get('citadelRockDetail'),detail=rawDetail?.trim()?Number(rawDetail):NaN;
 const rawMoss=q.get('citadelRockMoss'),moss=rawMoss?.trim()?Number(rawMoss):NaN;
 return {...(Number.isFinite(detail)?{detail:THREE.MathUtils.clamp(detail,0,1)}:{}),...(Number.isFinite(moss)?{moss:THREE.MathUtils.clamp(moss,0,1)}:{}),pass,bump:pass?(Number.isFinite(requested)?THREE.MathUtils.clamp(requested,0,.38):.12):.38,relief:Number.isFinite(relief)?THREE.MathUtils.clamp(relief,0,.65):.65};
}

// A narrow feature proxy: only a measured fold near the currently authored
// crest graph. Unlike earlier protection, this never locks an entire corridor.
export function rockCrestFold(points,normalA,normalB,{toCastle,normalMatrix,ridgeGraph=[]}){
 const a=normalA.clone().applyMatrix3(normalMatrix).normalize(),b=normalB.clone().applyMatrix3(normalMatrix).normalize();
 if(a.dot(b)>Math.cos(20*Math.PI/180))return false;
 const p=points[0].clone().add(points[1]).multiplyScalar(.5).applyMatrix4(toCastle);
 return ridgeGraph.some(({a,b})=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)return false;
  const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[1])*dz)/l,0,1);
  return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz)<=2&&p.y>Math.min(a[2],b[2])-6;
 });
}

// Shading only. Positions/topology are never welded or moved. Semantic labels
// are conservative barriers, not a claim of a complete geological edge graph.
export function applyRockCornerNormals(geometry,source,faces,barycentric,{pass=1,creaseAngleDeg=42,protectedFace=()=>false,featureEdge=()=>false,protectionBounds='unspecified'}={}){
 const p=source.attributes.position,edges=new Map(),blocked=new Set(),hardPairs=[];
 const report={version:1,method:'source-corner shading interpolation with conservative hard fallback',positionChanged:false,
  cornerFanConstraints:pass===4,rawAffineNormals:pass===4,mixedSubdivisionSoftEdges:0,cannotLinkPairs:0,constraintRejectedSoftJoins:0,sourceFaces:faces.length,softEdges:0,angleFallbackEdges:0,semanticEdges:0,protectedFaces:0,unmatchedEdges:0,
  subdivisionMismatchEdges:0,nonManifoldEdges:0,sharpEdges:0,smoothedCorners:0,interpolatedVertices:0,
  sourceTJunctions:'unmatched source edges remain hard; no topological repair',creaseAngleDeg,protectionBounds,pass,
  facePolicy:pass>=3?'shore attribute only; proximity/altitude/mesh-class callback not evaluated':'shore attribute then protectedFace callback',
  reasonCountPolicy:'first blocking reason; not visible-face coverage',
  reasonCounts:{shoreAttributeFaces:0,callbackProtectedFaces:0,openEdges:0,nonManifoldEdges:0,subdivisionMismatchEdges:0,protectedFaceEdges:0,mixedSemanticEdges:0,semanticBoundaryEdges:0,sharpAngleEdges:0,windingEdges:0,crestFoldEdges:0}};
 const reasons=report.reasonCounts;
 const attrs=['procgenSemantic','materialId','faceRegion','terrainSemantic'].filter(n=>source.attributes[n]);
 const point=id=>new THREE.Vector3().fromBufferAttribute(p,id);
 const key=id=>`${p.getX(id)},${p.getY(id)},${p.getZ(id)}`;
 const mat=face=>source.groups.filter(g=>face*3>=g.start&&face*3<g.start+g.count).map(g=>g.materialIndex).join(',');
 for(let f=0;f<faces.length;f++){
  const face=faces[f],pts=face.ids.map(point);
  face.area=new THREE.Vector3().subVectors(pts[1],pts[0]).cross(new THREE.Vector3().subVectors(pts[2],pts[0])).length();
  const shore=face.ids.some(id=>source.attributes.shoreBoundaryBottom?.getX(id)>0),callback=!shore&&pass<3&&protectedFace(pts,face.normal,f);
  face.protected=shore||callback;if(shore)reasons.shoreAttributeFaces++;else if(callback)reasons.callbackProtectedFaces++;
  if(face.protected)report.protectedFaces++;
  const signatures=face.ids.map(id=>attrs.map(n=>source.attributes[n].getX(id)).join('/'));
  face.semantic=`${mat(f)}:${signatures[0]}`;
  face.mixedSemantic=signatures.some(s=>s!==signatures[0]);
  for(let k=0;k<3;k++){
   const k0=key(face.ids[k]);
   const k1=key(face.ids[(k+1)%3]),ek=k0<k1?`${k0}|${k1}`:`${k1}|${k0}`;
   if(!edges.has(ek))edges.set(ek,[]);edges.get(ek).push({f,k,k0,k1});
  }
 }
 const soft=[],cos=Math.cos(creaseAngleDeg*Math.PI/180);
 for(const pair of edges.values()){
  let hard=false;
  if(pair.length!==2){hard=true;if(pair.length===1){report.unmatchedEdges++;reasons.openEdges++;}else {report.nonManifoldEdges++;reasons.nonManifoldEdges++;}}
  else{
   const [a,b]=pair.map(e=>faces[e.f]);
   if(pass!==4&&a.n!==b.n){hard=true;report.subdivisionMismatchEdges++;reasons.subdivisionMismatchEdges++;}
   else if(a.protected||b.protected){hard=true;report.semanticEdges++;reasons.protectedFaceEdges++;}
   else if(a.mixedSemantic||b.mixedSemantic){hard=true;report.semanticEdges++;reasons.mixedSemanticEdges++;}
   else if(a.semantic!==b.semantic){hard=true;report.semanticEdges++;reasons.semanticBoundaryEdges++;}
   else if(a.normal.dot(b.normal)<cos){hard=true;report.sharpEdges++;reasons.sharpAngleEdges++;}
   else if(pair[0].k0===pair[1].k0){hard=true;report.sharpEdges++;reasons.windingEdges++;}
   else if(pass>=3&&featureEdge([point(a.ids[pair[0].k]),point(a.ids[(pair[0].k+1)%3])],a.normal,b.normal)){hard=true;reasons.crestFoldEdges++;}
   else {soft.push(pair);report.softEdges++;report.angleFallbackEdges++;if(a.n!==b.n)report.mixedSubdivisionSoftEdges++;}
  }
  if(hard){hardPairs.push(pair);for(const e of pair){blocked.add(e.k0);blocked.add(e.k1);}}
 }
 // Earlier passes deliberately keep the original all-endpoint fallback.
 // Pass 4 instead keeps hard-edge sides apart using explicit cannot-links.
 const parent=Array.from({length:faces.length*3},(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const corner=(edge,endpoint)=>edge.f*3+faces[edge.f].ids.findIndex(id=>key(id)===endpoint);
 const forbidden=new Map(),members=pass===4?parent.map(i=>[i]):null;
 if(pass===4){
  report.method='constrained source-corner fans with affine normal transport';
  report.sourceTJunctions='unmatched original edges are not joined across; same-side fans may smooth; no topological repair';
  for(const pair of hardPairs)for(const endpoint of [pair[0].k0,pair[0].k1]){
   // Open edges have no opposite face. Non-manifold edges forbid every pair.
   for(let i=0;i<pair.length;i++)for(let j=i+1;j<pair.length;j++){
    const a=corner(pair[i],endpoint),b=corner(pair[j],endpoint);
    if(!forbidden.has(a))forbidden.set(a,new Set());
    if(!forbidden.has(b))forbidden.set(b,new Set());
    if(!forbidden.get(a).has(b)){forbidden.get(a).add(b);forbidden.get(b).add(a);report.cannotLinkPairs++;}
   }
  }
 }
 for(const pair of soft)for(const endpoint of [pair[0].k0,pair[0].k1]){
  if(pass!==4&&blocked.has(endpoint))continue;
  const corners=pair.map(e=>corner(e,endpoint));let a=root(corners[0]),b=root(corners[1]);
  if(a===b)continue;
  if(pass===4){
   if(members[a].length<members[b].length)[a,b]=[b,a];
   let conflict=false;
   for(const member of members[b]){
    for(const other of forbidden.get(member)||[])if(root(other)===a){conflict=true;break;}
    if(conflict)break;
   }
   if(conflict){report.constraintRejectedSoftJoins++;continue;}
   members[a].push(...members[b]);members[b]=null;
  }
  parent[b]=a;
 }
 const sums=new Map();
 for(let i=0;i<parent.length;i++){const r=root(i),face=faces[Math.floor(i/3)];if(!sums.has(r))sums.set(r,new THREE.Vector3());sums.get(r).addScaledVector(face.normal,face.area);}
 const corners=parent.map((_,i)=>{const f=faces[Math.floor(i/3)],n=sums.get(root(i)).clone();if(n.lengthSq()<1e-20)return f.normal.clone();n.normalize();if(n.distanceToSquared(f.normal)>1e-12)report.smoothedCorners++;return n;});
 const normals=geometry.attributes.normal,n=new THREE.Vector3();
 for(let f=0;f<faces.length;f++){
  const face=faces[f];if(face.protected)continue;
  for(let i=face.start;i<face.end;i++){
   const u=barycentric[i*2],v=barycentric[i*2+1];
   n.copy(corners[f*3]).multiplyScalar(1-u-v).addScaledVector(corners[f*3+1],u).addScaledVector(corners[f*3+2],v);
   if(pass!==4)n.normalize();
   if(n.dot(face.normal)>.1){normals.setXYZ(i,n.x,n.y,n.z);report.interpolatedVertices++;}
  }
 }
 normals.needsUpdate=true;geometry.userData.rockSurfaceNormals=report;return report;
}
