import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const apply=(g,p,s=[1,1,1],q=new T.Quaternion())=>g.applyMatrix4(new T.Matrix4().compose(V(...p),q,V(...s)));
function curvedLeaf(){const p=[],ix=[];for(let j=0;j<=24;j++){const t=j/24,w=Math.sin(Math.PI*t)*(.28+.09*Math.sin(t*Math.PI*12));for(const side of[-1,1])p.push(side*w,.06+Math.sin(t*Math.PI)*.28+t*t*.68,1.9*t-.65*t**5);}for(let j=0;j<24;j++){const a=j*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
function flowerGeometry(petals=9){const p=[],ix=[];for(let k=0;k<petals;k++){const a=k*Math.PI*2/petals;for(let j=0;j<=5;j++){const t=j/5,w=Math.sin(t*Math.PI)*.13,r=.03+t*.4;for(const side of[-1,1])p.push(Math.sin(a)*r+Math.cos(a)*w*side,.87+.08*Math.sin(t*Math.PI),Math.cos(a)*r-Math.sin(a)*w*side);}for(let j=0;j<5;j++){const n=k*12+j*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function createMorrisFlora({group,heightAt,pathDistance,random,linearScale=1,canPlant=()=>true}){
 const palette=[0xb94539,0xf0dfb0,0xcd9b45,0x847ba7,0xd8b39a],flowerPoints=[];
 // Flowing bands recur across the meadow, leaving a continuous unplanted walk.
 for(let i=0;i<2250*linearScale**2;i++){const x=(random()-.5)*40*linearScale,z=(random()-.5)*39*linearScale,r=Math.hypot(x,z);if(!canPlant(x,z)||r>19*linearScale||pathDistance(x,z)<1.65||Math.abs(x)<1.8&&z< -12)continue;const band=Math.sin(x*.34+Math.sin(z*.2)*1.5)+Math.cos(z*.39);if(random()>.62+.2*band)continue;flowerPoints.push({x,z,y:heightAt(x,z),scale:(.48+random()*.8)*.85,kind:i%5,yaw:random()*Math.PI*2});}
 const stemGeo=new T.CylinderGeometry(.018,.027,.82,5);stemGeo.translate(0,.41,0);
 const stemLeaf=apply(new T.SphereGeometry(1,7,4),[.14,.4,0],[.18,.045,.07],new T.Quaternion().setFromAxisAngle(V(0,0,1),.55));
 const greenGeo=mergeGeometries([stemGeo,stemLeaf],false),greenMat=new T.MeshStandardMaterial({color:0x476a48,roughness:.96}),dummy=new T.Object3D();
 const greens=new T.InstancedMesh(greenGeo,greenMat,flowerPoints.length);greens.name='morris-flower-stems-and-leaves';group.add(greens);
 flowerPoints.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();greens.setMatrixAt(i,dummy.matrix);});greens.computeBoundingSphere();
 for(let k=0;k<5;k++){const points=flowerPoints.filter(p=>p.kind===k),petals=new T.InstancedMesh(flowerGeometry(k===0?5:k===1?11:8),new T.MeshStandardMaterial({color:palette[k],roughness:.9,side:T.DoubleSide}),points.length),hearts=new T.InstancedMesh(new T.SphereGeometry(.095,7,5),new T.MeshStandardMaterial({color:k===0?0x34382e:0xcaa84c,roughness:.9}),points.length);petals.name='morris-layered-meadow-blooms';group.add(petals,hearts);points.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);dummy.position.y+=.9*p.scale;dummy.scale.set(p.scale,p.scale*.6,p.scale);dummy.updateMatrix();hearts.setMatrixAt(i,dummy.matrix);});petals.computeBoundingSphere();hearts.computeBoundingSphere();}
 const leafGeo=curvedLeaf(),leafMat=new T.MeshStandardMaterial({color:0x6b8759,side:T.DoubleSide,roughness:1}),leafPoints=[];
 const feeding=linearScale>1?[[-24,22],[27.6,25.7],[-8.1,38]]:[[-6,4],[5,1],[0,-7]];
 for(let i=0;i<95*linearScale**2;i++){const x=(random()-.5)*37*linearScale,z=(random()-.5)*37*linearScale;if(!canPlant(x,z)||Math.hypot(x,z)>19*linearScale||pathDistance(x,z)<1.5)continue;leafPoints.push([x,z]);}
 leafPoints.push(...feeding);
 const acanthus=new T.InstancedMesh(leafGeo,leafMat,leafPoints.length*5);acanthus.name='morris-curled-acanthus-grazing-leaves';group.add(acanthus);let n=0;
 for(const[x,z]of leafPoints)for(let j=0;j<5;j++){dummy.position.set(x,heightAt(x,z),z);dummy.rotation.set(0,j*Math.PI*.4+random()*.3,0);dummy.scale.setScalar((.65+random()*.38)*.85);dummy.updateMatrix();acanthus.setMatrixAt(n++,dummy.matrix);}acanthus.computeBoundingSphere();
 return{flowerCount:flowerPoints.length,acanthusClumps:leafPoints.length,feeding};
}
