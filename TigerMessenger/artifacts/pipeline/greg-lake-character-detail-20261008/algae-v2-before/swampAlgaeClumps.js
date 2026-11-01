import * as THREE from 'three';

function ribbonGeometry(wide){
 const positions=[],uv=[];
 const at=(t,side)=>{
  const w=Math.pow(Math.sin(Math.PI*t),.72)*(wide?.17:.115);
  return [(.22*t*t+.14*Math.sin(Math.PI*t))+side*w,t,.12*Math.sin(t*Math.PI*1.6)+side*w*.22];
 };
 for(let i=0;i<14;i++)for(const [t,s] of [[i/14,-1],[(i+1)/14,-1],[i/14,1],[i/14,1],[(i+1)/14,-1],[(i+1)/14,1]]){positions.push(...at(t,s));uv.push(t,(s+1)/2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function material(color){
 const m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false});
 m.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 algaeUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nalgaeUv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 algaeUv;').replace('#include <color_fragment>',`#include <color_fragment>
   float distanceToVein=abs(algaeUv.y-.5),aa=max(fwidth(distanceToVein),.004);
   float vein=1.-smoothstep(.009-aa,.009+aa,distanceToVein);
   diffuseColor.rgb*=mix(.78,1.,algaeUv.x)*(1.-vein*.19);`);
 };m.customProgramCacheKey=()=> 'swamp-rooted-algae-1';return m;
}

// Consume precisely the old 3-clump + 7-per-blade random draws. The preserved
// placement records and semantic groups make every original tuft inspectable.
export function createSwampAlgaeClumps(rnd,inner,floor,floorY){
 const clumps=[],blades=[],counts=[0,0],root=new THREE.Group();root.name='swamp-rooted-algae-batches';
 for(let i=0;i<26;i++){
  const a=rnd()*Math.PI*2,d=1.5+rnd()*11,clump=new THREE.Group(),count=3+((rnd()*4)|0);
  clump.name=`swamp-algae-clump-${i}`;clump.position.set(Math.cos(a)*d,floorY+.2,Math.sin(a)*d);clump.userData.algaeIndex=i;
  for(let b=0;b<count;b++){
   const width=.12+rnd()*.1,height=1+rnd()*1.8,light=rnd()<.5;
   const x=(rnd()-.5)*.6,lift=.5+rnd()*.9,z=(rnd()-.5)*.6,tilt=(rnd()-.5)*.4;
   const node=new THREE.Group();node.name=`swamp-algae-blade-${i}-${b}`;node.position.set(x,lift,z);node.rotation.z=tilt;clump.add(node);
   const record={clump:i,index:b,width,height,light,x,lift,z,tilt,node,group:clump,batch:light?0:1,instance:counts[light?0:1]++};
   node.userData.originalAlgae={width,height,light,position:[x,lift,z],tilt};blades.push(record);
  }
  inner.add(clump);clumps.push(clump);
 }
 const meshes=[0,1].map(i=>{
  const mesh=new THREE.InstancedMesh(ribbonGeometry(i===0),material(i===0?0x7cae9d:0x4e827e),counts[i]);mesh.name=`swamp-algae-curved-${i===0?'light':'shade'}`;root.add(mesh);return mesh;
 });inner.add(root);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
 function refreshAttachment(){
  inner.updateWorldMatrix(true,true);down.set(0,-1,0).transformDirection(inner.matrixWorld);
  for(const r of blades){
   const x=r.group.position.x+r.x,z=r.group.position.z+r.z;
   ray.set(inner.localToWorld(new THREE.Vector3(x,floorY+5,z)),down);ray.far=12;
   const hit=ray.intersectObject(floor,false).find(h=>h.face.normal.y>.4);
   if(!hit){meshes[r.batch].setMatrixAt(r.instance,new THREE.Matrix4().makeScale(0,0,0));r.surface=null;r.base=null;continue;}
   const surface=inner.worldToLocal(hit.point.clone()),base=surface.clone();base.y+=.008;
   rotation.setFromEuler(new THREE.Euler(0,r.index*2.399+r.lift,r.tilt,'YXZ'));
   matrix.compose(base,rotation,new THREE.Vector3(r.width/.17,r.height,1));
   meshes[r.batch].setMatrixAt(r.instance,matrix);r.matrix=matrix.clone();r.surface=surface.toArray();r.base=base.toArray();
   r.node.userData.rootedAlgaeSurface=r.surface;
  }
  for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 const report={version:1,clumps,blades,root,meshes,drawCalls:2,triangles:blades.length*28,refreshAttachment};inner.userData.rootedAlgae=report;return report;
}
