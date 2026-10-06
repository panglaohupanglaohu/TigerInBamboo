import {resolveMountainParams} from './mountainRelease.js';
import {supportedGrassBase} from './mountainTurfGeometry.js';
import * as THREE from 'three';

// Short opaque geometry, depth-tested and rooted on the accepted turf triangles.
// Inspired by silhouette-first vegetation experiments, not Oskar's private shader.
export function addMountainGrass(root,triangles,{surfaceIndex=null}={}){
 const pass=Number(resolveMountainParams(globalThis.location?.search||'').params.get('citadelTurfPass')||0);
 if(pass===1||pass===2||pass===3||pass===4||pass===5||pass===6)return addSupportedGrass(root,triangles,surfaceIndex,pass>=2);
 let seed=67321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const roots=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),inv=root.matrixWorld.clone().invert(),iq=root.getWorldQuaternion(new THREE.Quaternion()).invert();
 for(const tri of triangles){
  const n=Math.min(40,Math.floor(tri.getArea()*2.4));
  for(let i=0;i<n&&roots.length<8000;i++){
   const a=.10+random()*.7,b=.10+random()*(.9-a),c=1-a-b;
   const point=tri.a.clone().multiplyScalar(a).addScaledVector(tri.b,b).addScaledVector(tri.c,c);
   const up=point.clone().normalize(),position=point.clone().addScaledVector(up,.015).applyMatrix4(inv);
   q.copy(iq).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),random()*Math.PI*2));
   const size=.65+random()*.65;matrix.compose(position,q,new THREE.Vector3(size,size,size));
   roots.push({point:point.toArray(),matrix:matrix.toArray()});
  }
 }
 const verts=[];
 for(let j=0;j<5;j++){const angle=j*2.399,dx=Math.cos(angle),dz=Math.sin(angle),w=.045,h=.16+(j%3)*.045;
  verts.push(-dz*w,0,dx*w,dz*w,0,-dx*w,dx*.07,h,dz*.07);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({color:0x849867,roughness:1,side:THREE.DoubleSide});
 const mesh=new THREE.InstancedMesh(geo,mat,roots.length);mesh.name='citadel-study-meadow-grass';
 roots.forEach((r,i)=>{mesh.setMatrixAt(i,new THREE.Matrix4().fromArray(r.matrix));mesh.setColorAt(i,new THREE.Color().setHSL(.22,.22,.72+(i%5)*.04));});
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.userData.skipInkOutline=true;mesh.userData.skipColliders=true;mesh.userData.ashleyPalette=1;mesh.userData.holyOldTownDone=true;root.add(mesh);
 return {tufts:roots.length,roots:roots.map(r=>r.point),method:'opaque depth-tested short geometry on accepted turf faces'};
}

function addSupportedGrass(root,triangles,surfaceIndex,validateFirstSurface){
 if(validateFirstSurface&&!surfaceIndex)throw Error("Turf pass2 requires final surface index");
 const ray=new THREE.Ray();let hiddenBaseRejects=0;
 let seed=67321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const inv=root.matrixWorld.clone().invert(),positions=[],roots=[],baseEndpoints=[];let rejected=0;
 for(const tri of triangles){const n=Math.min(40,Math.floor(tri.getArea()*2.4));for(let i=0;i<n&&roots.length<8000;i++){
 const a=.1+random()*.7,b=.1+random()*(.9-a),center=tri.a.clone().multiplyScalar(a).addScaledVector(tri.b,b).addScaledVector(tri.c,1-a-b),up=center.clone().normalize();
 const axis=new THREE.Vector3(1,0,0);if(Math.abs(axis.dot(up))>.9)axis.set(0,0,1);axis.addScaledVector(up,-axis.dot(up)).normalize();const tangent=new THREE.Vector3().crossVectors(up,axis),size=.65+random()*.65,angle=random()*Math.PI*2;let blades=0;
 for(let j=0;j<5;j++){const turn=angle+j*2.399,side=axis.clone().multiplyScalar(Math.cos(turn)).addScaledVector(tangent,Math.sin(turn));const ends=supportedGrassBase(tri,center,side,.045*size,up);if(!ends){rejected++;continue;}
 if(validateFirstSurface&&!ends.every(p=>{const radial=p.clone().normalize();ray.set(p.clone().addScaledVector(radial,130),radial.negate());const hit=surfaceIndex.sample(ray,0,260);const gap=hit?p.length()-hit.point.length():Infinity;return gap<=.002&&gap>=-.02;})){hiddenBaseRejects++;continue;}
 const tip=center.clone().addScaledVector(up,(.16+(j%3)*.045)*size).addScaledVector(tangent,.07*size);for(const p of[...ends,tip]){const local=p.clone().applyMatrix4(inv);positions.push(local.x,local.y,local.z);}baseEndpoints.push(...ends.map(p=>p.toArray()));blades++;}
 if(blades)roots.push(center.toArray());
 }}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x849867,roughness:1,side:THREE.DoubleSide}));mesh.name='citadel-study-meadow-grass';mesh.receiveShadow=true;Object.assign(mesh.userData,{skipInkOutline:true,skipColliders:true,ashleyPalette:1,holyOldTownDone:true});root.add(mesh);
 return {tufts:roots.length,roots,baseEndpoints,blades:positions.length/9,rejectedBaseEdges:rejected,hiddenBaseRejects,firstSurfaceChecked:validateFirstSurface,method:'candidate: both blade base endpoints projected into actual clipped support face; zero height offset'};
}
