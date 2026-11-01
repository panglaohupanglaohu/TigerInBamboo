import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
import {createSwampCliffSampler} from './swampNaturalCliff.js';

function leafTemplate(type){
 const positions=[],colors=[],uvs=[],light=new THREE.Color(P.foliage),dark=new THREE.Color(P.foliageShade),fans=type==='fern'?7:type==='fan'?9:5,steps=type==='fern'?6:4;
 const emit=(point,u,v,tint)=>{positions.push(...point);uvs.push(u,v);colors.push(...tint);};
 for(let f=0;f<fans;f++){
  const a=(f/(fans-1)-.5)*(type==='fan'?2.7:2.3),length=.84+.24*Math.sin(f*2.3+1);
  function point(t,side){
   const width=Math.sin(Math.PI*t)*(type==='fan'?.3:type==='fern'?.22:.2)*(1+.15*Math.sin(t*25));
   const x=Math.sin(a)*length*t+Math.cos(a)*width*side,z=.12*t+Math.cos(a)*length*t-Math.sin(a)*width*side;
   const y=type==='pendant'?-.95*t+.23*Math.sin(t*Math.PI):.12*t+Math.sin(t*Math.PI)*(.73+.08*Math.sin(f));
   return new THREE.Vector3(x,y,z);
  }
  for(let j=0;j<steps;j++){
   const t=j/steps,u=(j+1)/steps;
   for(const [v,s] of [[t,-1],[u,-1],[t,1],[t,1],[u,-1],[u,1]])emit(point(v,s),v,(s+1)/2,s<0?light:dark);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function leafMaterial(){
 const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 understoryLeafUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nunderstoryLeafUv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 understoryLeafUv;').replace('#include <color_fragment>',`#include <color_fragment>
   float mid=abs(understoryLeafUv.y-.5),aa=max(fwidth(mid),.006);
   float vein=1.-smoothstep(.012-aa,.012+aa,mid);
   diffuseColor.rgb*=1.-vein*.22;`);
 };material.customProgramCacheKey=()=> 'greg-understory-leaf-1';return material;
}
function surfaceAt(mesh,y,angle){
 const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,reach=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)+3;
 const normal=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),origin=box.getCenter(new THREE.Vector3()).setY(y).addScaledVector(normal,reach),ray=new THREE.Ray(origin,normal.clone().negate());let found=null,best=Infinity;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
 for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){a.fromBufferAttribute(p,ix?ix.getX(i):i);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);if(ray.intersectTriangle(a,b,c,false,hit)&&hit.distanceToSquared(origin)<best){best=hit.distanceToSquared(origin);found=hit.clone();}}
 return found?{point:found,normal}:null;
}

// Install after the real cliff / route / trunk geometry, and reinstall after V7
// changes tree transforms. Three leaf templates + one rooted-vine batch, no loop.
export function installSwampCoralUnderstory(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregUnderstory')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;if(inner.userData.gregUnderstory)return inner.userData.gregUnderstory;if(!enabled)return null;
 const cliff=inner.userData.gregNaturalCliff,constraints=createSwampLivingPathConstraints(inner);if(!cliff?.ok||!constraints)return {ok:false,reason:'actual cliff and three-bank route required'};
 inner.updateWorldMatrix(true,true);const inverse=inner.matrixWorld.clone().invert(),wallAt=createSwampCliffSampler(inner),rockAt=createSwampCliffSampler(inner,cliff.root.getObjectByName('greg-natural-cliff-rock'));
 const root=new THREE.Group();root.name='greg-coral-understory';const instances={fern:[],fan:[],pendant:[]},templates={fern:leafTemplate('fern'),fan:leafTemplate('fan'),pendant:leafTemplate('pendant')},vines=[],records=[],rejected=[];
 const at=(a,y)=>{const hits=[wallAt(a,y),rockAt(a,y)].filter(Boolean).sort((p,q)=>Math.hypot(p.x,p.z)-Math.hypot(q.x,q.z));return hits[0]||null;};
 function plant(type,point,yaw,scale,attachment,matrixOverride=null){
  const down=type==='pendant'?scale:0,envelope={position:[point.x,point.y-down,point.z],radius:scale*1.3,height:scale*(type==='pendant'?1.3:1.15)};
  if(!constraints.inspectPlant(envelope).allowed){rejected.push({type,reason:'protected clearance'});return;}
  const matrix=matrixOverride||new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(scale,scale,scale));
  if(attachment.source==='rim'){
   // The rim patrol / player ribbon is four local units (two world) wide.
   // Inward-facing crowns may overhang the cliff, but never cover that ribbon.
   const p=templates[type].attributes.position,v=new THREE.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);const r=Math.hypot(v.x,v.z);if(r>35.4&&r<39.4){rejected.push({type,reason:'rim walking ribbon'});return;}}
  }
  const record={type,position:point.toArray(),scale,envelope,...attachment,matrix};instances[type].push(record);records.push(record);
 }
 // Broad fern / fan groups on the already supported rock shoulders.
 for(const pocket of cliff.pockets){
  const exposed=pocket.frontSamples.slice().sort((a,b)=>b.depth-a.depth).slice(0,4),centre=new THREE.Vector3(...pocket.centre);
  for(let k=0;k<4;k++){
   const point=centre.clone().lerp(new THREE.Vector3(...exposed[k%exposed.length].point),.38+.1*(k%3));point.y=pocket.y+.024;
   const size=1.15+.32*((pocket.id+k)%3);plant(k%3?'fern':'fan',point,Math.atan2(-Math.cos(pocket.angle),-Math.sin(pocket.angle))+(k-1.5)*.23,size,{source:'shoulder',pocket:pocket.id});
  }
 }
 // Three uneven trails per geological band. Dense patches alternate with gaps;
 // the leaf bases are ray-attached to the actual visible stone, not a grid shelf.
 const growthHeights=[.08,.13,.18,.25,.48,.54,.6,.67,.8,.87,.92];
 for(const band of cliff.rockBands)for(let strand=0;strand<3;strand++)for(let k=0;k<growthHeights.length;k++){
  if((k+strand*2+band.id)%9===0)continue;
  const t=growthHeights[k]+strand*.008,y=40-(40-band.bottom)*t,a=band.angle+band.lean*t+(strand-1)*band.width*.16+Math.sin(k*1.7+band.id)*.012;
  const surface=at(a,y);if(!surface)continue;const point=surface.clone().addScaledVector(new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)),.022);
  plant('pendant',point,Math.atan2(-Math.cos(a),-Math.sin(a)),.95+.58*(.5+.5*Math.sin(k*2.1+strand)),{source:'cliff',surface:surface.toArray()});
 }
 // Rim crowns emerge from the real solid ground outside the two-world path.
 const rim=inner.userData.gregCoralRim?.walkMeshes?.[0];
 if(rim){
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld);
  const centres=[1.02,1.46,1.9,2.34,2.78,-3.06,-2.62,-2.18,-1.74,-1.3,-.86,-.42];
  for(const [cluster,axis] of centres.entries())for(let k=0;k<21;k++){
   const layer=Math.floor(k/7),a=axis+(k%7-3)*.057+layer*.018,edge=wallAt(a,39.9999);if(!edge)continue;
   const r=Math.hypot(edge.x,edge.z)+.1+layer*.17,point=new THREE.Vector3(Math.cos(a)*r,42,Math.sin(a)*r);ray.set(inner.localToWorld(point.clone()),down);ray.far=3;
   const hit=ray.intersectObject(rim,false)[0];if(!hit)continue;const surface=inner.worldToLocal(hit.point.clone());point.copy(surface).y+=.02;
   // Three interlocking height layers share an edge habitat: low frontal fans,
   // tall rear ferns, irregular gaps between whole clusters rather than dots.
   const size=1.55+layer*.4+.12*((k+cluster)%3);
   plant((k+cluster)%3?'fern':'fan',point,Math.atan2(-Math.cos(a),-Math.sin(a)),size,{source:'rim',cluster,layer,surface:surface.toArray()});
  }
 }
 // Only a few selected lower trunk sections carry climbing growth. The main
 // underwater roots remain exactly as authored; no vine enters swimming space.
 const trunks=[inner.getObjectByName('world-tree-trunk')].filter(Boolean);
 for(const tree of inner.userData.towerTrees||[]){if(tree.name!=='swamp-towering-tree')continue;const segments=tree.children.filter(o=>o.userData.swampTreePart==='trunk');trunks.push(...segments.slice(0,2));}
 for(const [id,trunk] of trunks.entries()){
  const matrix=inverse.clone().multiply(trunk.matrixWorld);trunk.geometry.computeBoundingBox();const box=trunk.geometry.boundingBox,height=box.max.y-box.min.y;
  for(let strand=0;strand<(id===0?3:1);strand++){
   let previous=null;
   for(let k=0;k<=22;k++){
    const t=.06+.87*k/22,y=box.min.y+height*t,a=id*2.399+strand*2.08+Math.sin(t*4+id)*.35,hit=surfaceAt(trunk,y,a);if(!hit)continue;
    const point=hit.point.clone().addScaledVector(hit.normal,.018).applyMatrix4(matrix);
    if(point.y<27||point.y>53){previous=null;continue;}
    const safe=constraints.inspectPlant({position:point.toArray(),radius:.1,height:.2}).allowed;
    if(!safe){previous=null;continue;}
    if(previous&&point.distanceTo(previous.point)<3)vines.push({a:previous.point.toArray(),b:point.toArray(),source:trunk});
    previous={point};
    if(k%3===0){const size=id===0?1.08:.65,normal=hit.normal.clone().transformDirection(matrix),yaw=Math.atan2(normal.x,normal.z);plant('pendant',point,yaw,size,{source:'trunk',trunk,localSurface:hit.point.toArray()});}
   }
  }
 }
 const meshes=[];
 for(const [type,list] of Object.entries(instances)){
  const geometry=templates[type],mesh=new THREE.InstancedMesh(geometry,leafMaterial(),list.length);mesh.name=`greg-understory-${type}`;
  for(const [i,r] of list.entries()){mesh.setMatrixAt(i,r.matrix);const v=(type==='fern'?.76:.92)+.1*(.5+.5*Math.sin(i*2.399));mesh.setColorAt(i,new THREE.Color().setRGB(v,v,v));}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
 }
 const stemGeometry=new THREE.CylinderGeometry(.025,.04,1,5),stems=new THREE.InstancedMesh(stemGeometry,new THREE.MeshBasicMaterial({color:P.foliageShade,toneMapped:false}),vines.length);stems.name='greg-understory-attached-vines';
 for(const [i,segment] of vines.entries()){
  const a=new THREE.Vector3(...segment.a),b=new THREE.Vector3(...segment.b),delta=b.clone().sub(a),matrix=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(1,delta.length(),1));stems.setMatrixAt(i,matrix);
 }
 stems.instanceMatrix.needsUpdate=true;stems.computeBoundingSphere();root.add(stems);meshes.push(stems);inner.add(root);
 const angularBins=new Set(),v=new THREE.Vector3();
 for(const r of records.filter(r=>r.source==='rim')){
  const angle=Math.atan2(r.position[2],r.position[0]),p=templates[r.type].attributes.position;let low=Infinity,high=-Infinity;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(r.matrix);const delta=Math.atan2(Math.sin(Math.atan2(v.z,v.x)-angle),Math.cos(Math.atan2(v.z,v.x)-angle));low=Math.min(low,delta);high=Math.max(high,delta);}
  for(let i=Math.floor((angle+low)/(Math.PI*2)*720);i<=Math.ceil((angle+high)/(Math.PI*2)*720);i++)angularBins.add((i%720+720)%720);
 }
 let disposed=false;const report={ok:true,version:2,root,records,vines,rejected,counts:Object.fromEntries(Object.entries(instances).map(([type,list])=>[type,list.length])),rimAngularCoverage:angularBins.size/720,coverageScope:'projected angular leaf silhouette, not ground coverage or GPU acceptance',drawCalls:meshes.length,triangles:meshes.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0),dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}if(inner.userData.gregUnderstory===report)delete inner.userData.gregUnderstory;}};
 inner.userData.gregUnderstory=report;return report;
}
