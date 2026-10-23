import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';

// Keep each ordinary monkey's route count/timing, but bring unsupported random
// landing points near real trunks. Repair monkeys and existing trees stay fixed.
export function installSwampCoralPerches(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregLakePerches')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;
 if(inner.userData.gregCoralPerches)return inner.userData.gregCoralPerches;
 if(!enabled)return null;
 const monkeys=[];inner.traverse(o=>{if(o.name==='swamp-longtail-monkey'&&Array.isArray(o.userData.perches))monkeys.push(o);});
 if(!monkeys.length)return {ok:false,reason:'authored monkey landing points missing'};
 inner.updateWorldMatrix(true,true);
 const inverse=inner.matrixWorld.clone().invert(),trunks=[];
 inner.traverse(o=>{
  if(!o.isMesh||(o.name!=='world-tree-trunk'&&o.userData.swampTreePart!=='trunk'))return;
  const matrix=inverse.clone().multiply(o.matrixWorld);o.geometry.computeBoundingBox();
  trunks.push({mesh:o,matrix,box:o.geometry.boundingBox.clone().applyMatrix4(matrix)});
 });
 const points=monkeys.flatMap(monkey=>monkey.userData.perches.map((point,index)=>({monkey,index,point:point.clone()})));
 const maxSpan=6,positions=[],normals=[],ink=[],records=[],missing=[];
 function trunkHit(trunk,origin,direction){
  const p=trunk.mesh.geometry.attributes.position,ix=trunk.mesh.geometry.index,ray=new THREE.Ray(origin,direction),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();let closest=null,distance=Infinity;
  for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){
   a.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(trunk.matrix);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(trunk.matrix);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(trunk.matrix);
   if(ray.intersectTriangle(a,b,c,false,hit)){const d=hit.distanceToSquared(origin);if(d<distance){distance=d;closest=hit.clone();}}
  }return closest;
 }
 function append(geometry,matrix){
  const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,n=g.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(matrix);
  for(let i=0;i<p.count;i++){positions.push(...new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));normals.push(...new THREE.Vector3().fromBufferAttribute(n,i).applyMatrix3(nm).normalize());}
  if(g!==geometry)g.dispose();geometry.dispose();
 }
 for(const authored of points){
  const end=authored.point.clone();end.y-=.165;
  const rootY=end.y-1.85;
  const origin=end.clone().setY(rootY);let best=null;
  for(const trunk of trunks){
   if(rootY<trunk.box.min.y||rootY>trunk.box.max.y)continue;
   const direction=trunk.box.getCenter(new THREE.Vector3()).setY(rootY).sub(origin).normalize(),surface=trunkHit(trunk,origin,direction);
   if(surface&&(!best||surface.distanceToSquared(origin)<best.distance))best={trunk,surface,direction,distance:surface.distanceToSquared(origin)};
  }
  if(!best){missing.push({monkey:monkeys.indexOf(authored.monkey),index:authored.index,point:authored.point.toArray(),reason:'no trunk at landing height'});continue;}
  const reach=new THREE.Vector3(end.x-best.surface.x,0,end.z-best.surface.z),distance=reach.length();
  if(distance>5){reach.setLength(5);end.x=best.surface.x+reach.x;end.z=best.surface.z+reach.z;}
  // Two nearby random sites must not collapse into overlapping foot knots.
  const tangent=new THREE.Vector3(-reach.z,0,reach.x).normalize();
  for(const previous of records)if(Math.abs(previous.point[1]-authored.point.y)<1&&Math.hypot(previous.point[0]-end.x,previous.point[2]-end.z)<1.2)end.addScaledVector(tangent,1.3);
  const landing=end.clone().add(new THREE.Vector3(0,.165,0));
  const start=best.surface.clone().addScaledVector(best.direction,.2),mid=start.clone().lerp(end,.5);mid.y-=.28;
  // One shallow rising arc. Never a low horizontal rail followed by a vertical riser.
  const side=new THREE.Vector3(end.z-start.z,0,start.x-end.x).normalize();mid.addScaledVector(side,.7);
  const curve=new THREE.CatmullRomCurve3([start,mid,end]),geometry=new THREE.TubeGeometry(curve,24,1,8,false),p=geometry.attributes.position;
  for(let j=0;j<=24;j++){
   const centre=curve.getPointAt(j/24),radius=THREE.MathUtils.lerp(.25,.12,j/24);
   for(let k=0;k<=8;k++){const i=j*9+k,v=new THREE.Vector3().fromBufferAttribute(p,i).sub(centre).multiplyScalar(radius).add(centre);p.setXYZ(i,v.x,v.y,v.z);}
   if(j<24){const A=centre.clone().add(new THREE.Vector3(0,radius*.85,0)),B=curve.getPointAt((j+1)/24).add(new THREE.Vector3(0,THREE.MathUtils.lerp(.25,.12,(j+1)/24)*.85,0));ink.push(...A,...B);}
  }
  geometry.computeVertexNormals();append(geometry,new THREE.Matrix4());
  // Small flattened bark knot, sized to the original feet rather than a platform.
  const pad=new THREE.SphereGeometry(1,10,6),m=new THREE.Matrix4().compose(end,new THREE.Quaternion(),new THREE.Vector3(.56,.11,.5));append(pad,m);
  records.push({monkey:authored.monkey,index:authored.index,originalPoint:authored.point.toArray(),point:landing.toArray(),displacement:landing.distanceTo(authored.point),root:start.toArray(),surface:best.surface.toArray(),sourceTrunk:best.trunk.mesh,footTop:end.y+.11,radius:.5,curve});
 }
 // No partially rewritten animation route if a real connection cannot be found.
 if(missing.length)return {ok:false,reason:'some perches have no natural trunk connection',missing};
 for(const r of records)r.monkey.userData.perches[r.index].fromArray(r.point);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:P.bark,toneMapped:false}));mesh.name='greg-coral-monkey-perch-branches';inner.add(mesh);
 const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ink,3)),new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.5}));lines.name='greg-coral-monkey-perch-ink';inner.add(lines);
 let disposed=false;
 const report={ok:true,version:3,monkeyCount:monkeys.length,records,originalPerches:points.map(p=>({monkey:p.monkey,index:p.index,point:p.point.toArray()})),missing,maxSpan,mesh,drawCalls:2,changesAnimalPaths:true,
  dispose(){
   if(disposed)return;disposed=true;
   for(const owned of [mesh,lines]){owned.removeFromParent();owned.geometry.dispose();owned.material.dispose();}
   for(const r of records)r.monkey.userData.perches[r.index].fromArray(r.originalPoint);
   if(inner.userData.gregCoralPerches===report)delete inner.userData.gregCoralPerches;
  }
 };inner.userData.gregCoralPerches=report;return report;
}
