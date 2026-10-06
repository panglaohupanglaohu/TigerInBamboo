import {trimMountainTurfTails} from './mountainTurfTail.js';
import {resolveMountainParams} from './mountainRelease.js';
import {insetMountainTurf} from './mountainTurfInset.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {clipTurfTriangle,refineTurfTriangle,turfEdgeKey} from './mountainTurfGeometry.js';
import * as THREE from 'three';
import {mountainHabitat} from './mountainHabitat.js';
import {addMountainGrass} from './mountainGrass.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// Cover existing upward rock triangles; never invent an independent ground plane.
export function addMountainGroundcover(root,surfaces,{radius,rail,protectedBoxes,surfaceIndex=null}){
 const pass=Number(resolveMountainParams(globalThis.location?.search||'').params.get('citadelTurfPass')||0);if(pass===3||pass===4||pass===5||pass===6)return addContinuousMountainTurf(root,surfaces,{radius,rail,protectedBoxes,surfaceIndex,pass});const candidate=pass===1||pass===2;
 if(pass===2&&!surfaceIndex)surfaceIndex=buildMountainSurfaceIndex(surfaces);
 const habitatOffset=pass===2?.95:.68,slopeThreshold=pass===2?.67:.70;
 const positions=[],colors=[],accepted=[],up=new THREE.Vector3(),normal=new THREE.Vector3(),tri=new THREE.Triangle(),center=new THREE.Vector3();
 const inv=root.matrixWorld.clone().invert(),local=new THREE.Vector3(),dark=new THREE.Color('#536b42'),light=new THREE.Color('#95a872');
 let area=0;
 // Welded-position slope minima keep every shared-edge value identical and
 // leave a conservative bare margin beside incident steep cliff faces.
 const sourceFaces=[],splitEdges=new Set();
 const slopeArea=new Map(),slopeField=new Map(),key=v=>v.toArray().map(x=>Math.round(x*1e4)).join(',');
 if(candidate)for(const mesh of surfaces){const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;for(let i=0;i<(idx?idx.count:p.count);i+=3){
 const t=new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)));
 const c=t.getMidpoint(new THREE.Vector3()),n=t.getNormal(new THREE.Vector3());let slope=n.dot(c.normalize());if(/citadel-oskar-grid-mountain-surface|citadel-backdrop-ridge|new-city-rock-shoulder/.test(mesh.name))slope=Math.abs(slope);
 sourceFaces.push(t);
 for(const v of[t.a,t.b,t.c]){const k=key(v);if(pass===2){const area=t.getArea();slopeField.set(k,(slopeField.get(k)||0)+slope*area);slopeArea.set(k,(slopeArea.get(k)||0)+area);}else slopeField.set(k,Math.min(slopeField.get(k)??1,slope));}
 }}

 if(pass===2)for(const[k,sum]of slopeField)slopeField.set(k,sum/Math.max(1e-10,slopeArea.get(k)));
 if(candidate)for(const t of sourceFaces){const vs=[t.a,t.b,t.c],field=vs.map(v=>{const l=v.clone().applyMatrix4(inv);return Math.min(mountainHabitat(l.x,l.z)+habitatOffset,((slopeField.get(key(v))??0)-slopeThreshold)*5);});
 if(Math.min(...field)>.4||Math.max(...field)<-.4)continue;
 for(let i=0;i<3&&splitEdges.size<1200;i++)if(vs[i].distanceTo(vs[(i+1)%3])>3)splitEdges.add(turfEdgeKey(vs[i],vs[(i+1)%3]));
 }
 for(const mesh of surfaces){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<(idx?idx.count:p.count);i+=3){
   [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
   tri.getMidpoint(center);tri.getNormal(normal);up.copy(center).normalize();local.copy(center).applyMatrix4(inv);
   // Authored open mountain sheets contain reversed winding; radial orientation
   // is canonical for these known terrain surfaces, not for arbitrary meshes.
   const signed=normal.dot(up),slope=/citadel-oskar-grid-mountain-surface|citadel-backdrop-ridge|new-city-rock-shoulder/.test(mesh.name)?Math.abs(signed):signed,alt=center.length()-radius-officialOceanLevelAt(center);
   if(slope<.66||alt<2||local.y>37||tri.getArea()<.015)continue;
   const patch=mountainHabitat(local.x,local.z);
   if(!candidate&&patch<-.9)continue;
   const reach=Math.max(center.distanceTo(tri.a),center.distanceTo(tri.b),center.distanceTo(tri.c));
   if(rail.some(q=>q.distanceToSquared(center)<(12+reach)**2)||protectedBoxes.some(b=>b.distanceToPoint(center)<2+reach))continue;
   if(signed<0){const swap=tri.b.clone();tri.b.copy(tri.c);tri.c.copy(swap);}
   const tint=dark.clone().lerp(light,THREE.MathUtils.clamp((slope-.70)*1.7+.12*Math.sin(local.x*.12),0,.75));
   const pieces=[];
   if(candidate){const parentSlopes=[tri.a,tri.b,tri.c].map(v=>slopeField.get(key(v))??0);
   for(const small of refineTurfTriangle(tri,splitEdges)){const values=[small.a,small.b,small.c].map(v=>{const l=v.clone().applyMatrix4(inv),bary=tri.getBarycoord(v,new THREE.Vector3()),slope=parentSlopes[0]*bary.x+parentSlopes[1]*bary.y+parentSlopes[2]*bary.z;return Math.min(mountainHabitat(l.x,l.z)+habitatOffset,(slope-slopeThreshold)*5,(v.length()-radius-officialOceanLevelAt(v)-2)*.5,(37-l.y)*.3);});pieces.push(...clipTurfTriangle(small,values));}
   }else pieces.push(tri.clone());
   for(const piece of pieces){for(const v of[piece.a,piece.b,piece.c]){const q=v.clone();if(!candidate)q.addScaledVector(v.clone().normalize(),.055);q.applyMatrix4(inv);positions.push(q.x,q.y,q.z);colors.push(tint.r,tint.g,tint.b);}accepted.push(piece);area+=piece.getArea();}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.name='citadel-study-groundcover';mesh.userData.skipColliders=true;mesh.userData.skipInkOutline=true;mesh.userData.ashleyPalette=1;mesh.userData.holyOldTownDone=true;root.add(mesh);
 const grass=addMountainGrass(root,accepted,{surfaceIndex});
 return {candidate:candidate?`citadelTurfPass=${pass}; not yet visually accepted`:false,offset:candidate?0:.055,refinement:candidate?{sharedSplitEdges:splitEdges.size,maxSplitEdges:1200,targetBoundaryEdge:3,maxLevel:1}:null,grass,triangles:positions.length/9,area,method:'supported rock triangles, slope and patch field with expanded path exclusions'};
}


// Opt-in pass3: interpolate colour and authored source normals continuously;
// all positions remain barycentric points of final source triangles.
function addContinuousMountainTurf(root,surfaces,{radius,rail,protectedBoxes,surfaceIndex,pass=3}){
 surfaceIndex??=buildMountainSurfaceIndex(surfaces);
 const inverse=root.matrixWorld.clone().invert(),worldToRootNormal=new THREE.Matrix3().getNormalMatrix(inverse),records=[],field=new Map(),positions=[],colors=[],normals=[],accepted=[];
 const stats={sourceFaces:0,steepWholeFaceRejects:0,otherWholeFaceRejects:0,protectedWholeFaceRejects:0,hiddenPiecesRejected:0,splitEdgesPerLevel:[],maxLevels:2,maxSharedSplitEdges:6000,maxRefinedTriangles:120000,normalFallbackFaces:0};
 const key=v=>v.toArray().map(x=>Math.round(x*1e4)).join(','),V=()=>new THREE.Vector3();
 for(const mesh of surfaces){const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,nm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),tri=new THREE.Triangle(...ids.map(j=>V().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld))),center=tri.getMidpoint(V()),fn=tri.getNormal(V()),area=tri.getArea(),signed=fn.dot(center.clone().normalize()),slope=/citadel-oskar-grid-mountain-surface|citadel-backdrop-ridge|new-city-rock-shoulder/.test(mesh.name)?Math.abs(signed):signed;stats.sourceFaces++;
   for(const v of[tri.a,tri.b,tri.c]){const k=key(v),f=field.get(k)||{sum:0,area:0};f.sum+=slope*area;f.area+=area;field.set(k,f);}
   const local=center.clone().applyMatrix4(inverse),alt=center.length()-radius-officialOceanLevelAt(center);if(slope<.66){stats.steepWholeFaceRejects++;continue;}if(alt<2||local.y>37||area<.015){stats.otherWholeFaceRejects++;continue;}
   const reach=Math.max(...[tri.a,tri.b,tri.c].map(v=>center.distanceTo(v)));if(rail.some(q=>q.distanceToSquared(center)<(12+reach)**2)||protectedBoxes.some(b=>b.distanceToPoint(center)<2+reach)){stats.protectedWholeFaceRejects++;continue;}
   const sourceNormals=ids.map(j=>n?V().fromBufferAttribute(n,j).normalize().applyMatrix3(nm).normalize():fn.clone());if(!n)stats.normalFallbackFaces++;
   records.push({tri,sourceNormals,signed,pieces:[tri],mesh});
  }
 }
 const value=(record,v)=>{const l=v.clone().applyMatrix4(inverse),b=record.tri.getBarycoord(v,V()),slope=[record.tri.a,record.tri.b,record.tri.c].reduce((sum,p,i)=>{const f=field.get(key(p));return sum+(f.sum/Math.max(f.area,1e-10))*b.getComponent(i);},0);return Math.min(mountainHabitat(l.x,l.z)+.95,(slope-.67)*5,(v.length()-radius-officialOceanLevelAt(v)-2)*.5,(37-l.y)*.3);};
 let usedEdges=0;
 for(let level=0;level<2;level++){const edges=new Set();for(const r of records)for(const tri of r.pieces){const vs=[tri.a,tri.b,tri.c],values=vs.map(v=>value(r,v));if(Math.min(...values)>.4||Math.max(...values)<-.4)continue;for(let i=0;i<3;i++)if(usedEdges+edges.size<6000&&vs[i].distanceTo(vs[(i+1)%3])>1.5)edges.add(turfEdgeKey(vs[i],vs[(i+1)%3]));}
  const next=records.map(r=>r.pieces.flatMap(t=>refineTurfTriangle(t,edges))),count=next.reduce((s,a)=>s+a.length,0);if(count>120000){stats.refinementStoppedAtBudget=true;break;}records.forEach((r,i)=>r.pieces=next[i]);usedEdges+=edges.size;stats.splitEdgesPerLevel.push(edges.size);if(!edges.size)break;
 }
 const staged=[];const dark=new THREE.Color('#617748'),light=new THREE.Color('#91a66e'),ray=new THREE.Ray();let area=0;
 for(const r of records)for(const small of r.pieces)for(const piece of clipTurfTriangle(small,[small.a,small.b,small.c].map(v=>value(r,v)))){
  const center=piece.getMidpoint(V()),up=center.clone().normalize();ray.set(center.clone().addScaledVector(up,130),up.clone().negate());const hit=surfaceIndex.sample(ray,0,260);if(!hit||Math.abs(center.length()-hit.point.length())>.002){stats.hiddenPiecesRejected++;continue;}
  if(r.signed<0){const a=piece.b;piece.b=piece.c;piece.c=a;}
  staged.push({piece,r});
 }
 let output=staged;if(pass===4){const inset=insetMountainTurf(staged.map(s=>s.piece));stats.inset=inset.stats;output=inset.output.map(o=>({piece:o.triangle,r:staged[o.source].r}));}
 if(pass===5||pass===6){const tail=trimMountainTurfTails(staged.map(s=>s.piece),inverse,{fadeHeight:pass===6?[7,10]:[5,9]});stats.localTail=tail.stats;output=tail.output.map(o=>({piece:o.triangle,r:staged[o.source].r}));}
 for(const {piece,r} of output){
  for(const v of[piece.a,piece.b,piece.c]){const local=v.clone().applyMatrix4(inverse),b=r.tri.getBarycoord(v,V()),normal=V();for(let i=0;i<3;i++)normal.addScaledVector(r.sourceNormals[i],b.getComponent(i));normal.normalize();if(normal.dot(v.clone().normalize())<0)normal.negate();normal.applyMatrix3(worldToRootNormal).normalize();const mix=THREE.MathUtils.clamp(.46+.12*Math.sin(local.x*.055+Math.cos(local.z*.041))+.09*Math.cos(local.z*.067),.2,.72),colour=dark.clone().lerp(light,mix);positions.push(...local.toArray());normals.push(...normal.toArray());colors.push(colour.r,colour.g,colour.b);}
  accepted.push(piece);area+=piece.getArea();
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.name='citadel-study-groundcover';Object.assign(mesh.userData,{skipColliders:true,skipInkOutline:true,ashleyPalette:1,holyOldTownDone:true});mesh.receiveShadow=true;root.add(mesh);
 const grass=addMountainGrass(root,accepted,{surfaceIndex});return {candidate:`citadelTurfPass=${pass}; pending actual visual acceptance`,offset:0,triangles:positions.length/9,area,grass,refinement:stats,method:'low-frequency continuous coordinate colour; barycentric source shading normals; two shared-edge refinement levels then final-face continuous clipping; whole-face steep/protection gates retained; actual first-surface center test and grass endpoint tests'};
}
