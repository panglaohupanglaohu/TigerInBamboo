import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import baked from '../../../assets/models/optimized/citadel-front-harbor-finish/frontHarborFinishR04.js';

// Surface finish follows the actual harbor walls; it does not close the gate
// or insert decorative solids into the stair's 4.8 m clear width.
export function finishFrontHarbor(root,flights){
 const group=new THREE.Group();group.name='integrated-harbor-stone-finish';
 const stone=new THREE.MeshStandardMaterial({color:0xc8c3b7,roughness:.96});
 const coping=new THREE.MeshStandardMaterial({color:0xe0d7c5,roughness:.94});
 let blocks=0;
 function box(name,x,y,z,w,h,d,mat=stone){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);group.add(mesh);blocks++;return mesh;
 }
 const walls=root.children.filter(o=>['integrated-front-wall','integrated-return-wall'].includes(o.name));
 for(const wall of walls){
  const {width:w,height:h,depth:d}=wall.geometry.parameters,p=wall.position;
  const alongX=w>d,length=alongX?w:d,bottom=p.y-h/2,top=p.y+h/2;
  for(let row=0,y=bottom+.30;y<top-.18;row++,y+=.62){
   for(let start=-length/2-(row%2)*.72;start<length/2;start+=1.44){
    const lo=Math.max(-length/2,start)+.02,hi=Math.min(length/2,start+1.44)-.02;
    if(hi-lo<.08)continue;
    const mid=(lo+hi)/2;
    for(const face of [-1,1])box('harbor-wall-ashlar',p.x+(alongX?mid:face*(w/2+.025)),y,p.z+(alongX?face*(d/2+.025):mid),alongX?hi-lo:.065,.57,alongX?.065:hi-lo);
   }
  }
  box('harbor-wall-continuous-coping',p.x,top+.08,p.z,w+.18,.16,d+.18,coping);
 }
 // Sloping guards sit outside the route envelope, ending before the turn.
 const f=flights[0],n=14;
 for(let i=0;i<n;i++){
  const u=(i+.5)/n,z=f.start[1]+(f.end[1]-f.start[1])*u;
  if(z<92.2||z>104.1)continue;
  const floor=f.low+(f.high-f.low)*u;
  for(const side of [-1,1]){
   box('harbor-stair-side-guard',f.start[0]+side*2.65,floor+.39,z,.35,.78,.98);
   box('harbor-stair-guard-coping',f.start[0]+side*2.65,floor+.83,z,.47,.12,1.02,coping);
  }
 }
 // Platform paving remains shallow and inherits support from the actual slab.
 for(const slab of root.children.filter(o=>['integrated-west-terrace','integrated-east-terrace','integrated-side-court'].includes(o.name))){
  const p=slab.position,{width:w,height:h,depth:d}=slab.geometry.parameters;
  for(let x=p.x-w/2+.55;x<p.x+w/2-.1;x+=1.1)for(let z=p.z-d/2+.55;z<p.z+d/2-.1;z+=1.1){
   const sx=Math.min(1.06,2*(p.x+w/2-x)-.04),sz=Math.min(1.06,2*(p.z+d/2-z)-.04);
   if(sx>.1&&sz>.1)box('harbor-terrace-paving',x,p.y+h/2+.012,z,sx,.024,sz,coping);
  }
 }
 mergeStaticGroup(group,{mergedTag:'front-harbor-stone',onSurface:m=>{m.userData.citadelSolidExterior=true;m.castShadow=true;m.receiveShadow=true;}});
 if(baked)group.children.forEach((mesh,i)=>{
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,part=baked.parts[i];let digest=2166136261;
  for(const value of source.attributes.position.array)digest=Math.imul(digest^Math.round(value*1e4),16777619)>>>0;
  if(source!==mesh.geometry)source.dispose();
  if(!part||part.sourceDigest!==digest)throw new Error('Harbor finish changed: regenerate Blender geometry');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));geometry.computeBoundingSphere();
  mesh.geometry.dispose();mesh.geometry=geometry;mesh.userData.sourceBlender=baked.source;
 });
 root.add(group);root.userData.finish={revision:4,blocks,clearStairWidth:4.8,blender:baked?.source??'pending',scope:'wall courses, coping, side guards and terrace paving'};
 return group;
}
