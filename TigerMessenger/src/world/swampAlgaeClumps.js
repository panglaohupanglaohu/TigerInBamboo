import * as THREE from 'three';

export function sampleSwampAlgaeRibbon(t,side,wide){
  const u=1-t,w=Math.pow(Math.sin(Math.PI*t),.46)*(wide?.34:.27);
  // Cubic midribs rise from the original root and bend out, then dip at the
  // tip. Rounded cross-sections keep a broad blade instead of a spear edge.
  const x=3*u*u*t*.035+3*u*t*t*(wide?.18:-.12)+t*t*t*(wide?.62:-.47);
  const y=3*u*u*t*.57+3*u*t*t*1.06+t*t*t*(wide?.70:.78);
  const z=3*u*t*t*.14+t*t*t*.24;
  const twist=.18+.48*t,fold=(1-side*side)*.038*Math.sin(t*Math.PI);
  return [x+side*w*Math.cos(twist),y+fold,z+side*w*Math.sin(twist)];
}
function ribbonGeometry(wide){
 const positions=[],uv=[];
 for(let i=0;i<18;i++)for(const side of [-1,0])for(const [t,s] of [[i/18,side],[(i+1)/18,side],[i/18,side+1],[i/18,side+1],[(i+1)/18,side],[(i+1)/18,side+1]]){positions.push(...sampleSwampAlgaeRibbon(t,s,wide));uv.push(t,(s+1)/2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

// The second legacy bed layer is a separate 30 x 3 batch, not part of the
// original random 26 tufts. Keep its authored bases, angles and color family.
export function createSwampLegacyWaterGrassGeometry(inner,floor){
 const positions=[],colors=[],records=[],ray=new THREE.Raycaster(),down=new THREE.Vector3();
 inner.updateWorldMatrix(true,true);down.set(0,-1,0).transformDirection(inner.matrixWorld);
 const append=(v,c)=>{positions.push(...v);colors.push(c.r,c.g,c.b);};
 for(let i=0;i<30;i++){
  const angle=i*2.399,r=6+(i%6),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
  for(let f=0;f<3;f++){
   const a=angle+f*2.1,height=2+(i%4)*.6,wide=(i+f)%3!==0,start=positions.length/3;
   const point=(t,side)=>{
    const q=sampleSwampAlgaeRibbon(t,side,wide);
    return [x+Math.cos(a)*q[0]-Math.sin(a)*q[2],10.5+q[1]*height,z+Math.sin(a)*q[0]+Math.cos(a)*q[2]];
   };
   for(let j=0;j<18;j++)for(const side of [-1,0]){
    const t=j/18,u=(j+1)/18;
    for(const [v,s] of [[t,side],[u,side],[t,side+1],[t,side+1],[u,side],[u,side+1]])append(point(v,s),new THREE.Color(0x254c59).lerp(new THREE.Color(0x5b978a),v));
   }
   // Original leaf bases are Y10.5, just above the rendered bed. A short narrow
   // petiole reaches the actual surface, without shifting those authored bases.
   ray.set(inner.localToWorld(new THREE.Vector3(x,16,z)),down);ray.far=12;
   const hit=floor&&ray.intersectObject(floor,false).find(h=>h.face.normal.y>.4),surface=hit?inner.worldToLocal(hit.point.clone()):null;
   if(surface&&surface.y<10.5){
    const w=.018,c=new THREE.Color(0x254c59),left=[Math.cos(a+Math.PI/2)*w,Math.sin(a+Math.PI/2)*w];
    const A=[x-left[0],surface.y+.003,z-left[1]],B=[x+left[0],surface.y+.003,z+left[1]],C=[x+left[0],10.51,z+left[1]],D=[x-left[0],10.51,z-left[1]];
    for(const v of [A,B,C,A,C,D])append(v,c);
   }
   records.push({clump:i,index:f,base:[x,10.5,z],angle:a,height,surface:surface?.toArray()||null,vertexStart:start,vertexCount:positions.length/3-start});
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData={version:2,clumps:30,blades:90,records,drawCalls:1,triangles:positions.length/9};return geometry;
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
   const flow=Math.atan2(r.group.position.z,r.group.position.x)+.52*Math.sin(r.clump*1.7);
   rotation.setFromEuler(new THREE.Euler(0,flow+.82*Math.sin(r.index*1.9+r.lift)+r.index*.31,r.tilt,'YXZ'));
   matrix.compose(base,rotation,new THREE.Vector3(r.width/.17,r.height,1));
   meshes[r.batch].setMatrixAt(r.instance,matrix);r.matrix=matrix.clone();r.surface=surface.toArray();r.base=base.toArray();
   r.node.userData.rootedAlgaeSurface=r.surface;
  }
  for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 const report={version:2,clumps,blades,root,meshes,drawCalls:2,triangles:meshes.reduce((sum,m)=>sum+m.count*m.geometry.attributes.position.count/3,0),refreshAttachment};inner.userData.rootedAlgae=report;return report;
}
