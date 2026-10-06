import * as THREE from 'three';

// Opaque broad-leaf coastal scrub. Authored silhouette, not a botanical solver.
// Unit envelope permits existing wind-pruned non-uniform instance scaling.
export function createCoastalScrubGeometry(){
 const position=[],normal=[],color=[];
 const green=new THREE.Color(0xb1bf8d),shade=new THREE.Color(0x879e74),twig=new THREE.Color(0x877c63);
 function triangle(a,b,c,tint){
  const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
  for(const v of[a,b,c]){position.push(v.x,v.y,v.z);normal.push(n.x,n.y,n.z);color.push(tint.r,tint.g,tint.b);}
 }
 function branch(a,b,r){
  const axis=b.clone().sub(a).normalize(),u=new THREE.Vector3(0,0,1).cross(axis).normalize(),v=axis.clone().cross(u);
  for(let i=0;i<5;i++){
   const angle=i*Math.PI*2/5,next=(i+1)*Math.PI*2/5;
   const off=t=>u.clone().multiplyScalar(Math.cos(t)*r).addScaledVector(v,Math.sin(t)*r);
   const p=a.clone().add(off(angle)),q=a.clone().add(off(next)),s=b.clone().add(off(angle).multiplyScalar(.48)),t=b.clone().add(off(next).multiplyScalar(.48));
   triangle(p,q,t,twig);triangle(p,t,s,twig);
  }
 }
 // A folded lanceolate/broad leaf: four opaque triangles around a raised rib.
 // Separate leaves overlap near their bases, not a solid ellipsoid shell.
 function leaf(base,direction,length,width,tint){
  const dir=direction.clone().normalize(),side=new THREE.Vector3(-dir.z,0,dir.x).normalize();
  const end=base.clone().addScaledVector(dir,length),mid=base.clone().addScaledVector(dir,length*.48);
  const l=mid.clone().addScaledVector(side,width),r=mid.clone().addScaledVector(side,-width),rib=mid.clone().add(new THREE.Vector3(0,width*.48,0));
  // Two upper folds and matching underside: opaque from both camera sides.
  triangle(base,l,rib,tint);triangle(l,end,rib,tint);triangle(base,rib,r,tint);triangle(rib,end,r,tint);
  triangle(base,rib,l,tint);triangle(l,rib,end,tint);triangle(base,r,rib,tint);triangle(rib,r,end,tint);
 }
 const origin=new THREE.Vector3(0,-.88,0);
 for(let shoot=0;shoot<9;shoot++){
  const angle=shoot*2.39996323,radius=shoot===0?.1:.30+.10*(shoot%3);
  const tip=new THREE.Vector3(Math.cos(angle)*radius,.18+.15*((shoot*5)%4),Math.sin(angle)*radius);
  branch(origin,tip,.028);
  for(let j=0;j<6;j++){
   const az=angle+j*2.35,base=origin.clone().lerp(tip,.52+j*.083);
   const dir=new THREE.Vector3(Math.cos(az),.20+.22*(j%2),Math.sin(az));
   const len=.29+.045*((shoot+j)%3),width=.087+.012*(j%3);
   const tint=green.clone().lerp(shade,((shoot*3+j)%7)/9);
   leaf(base,dir,len,width,tint);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.coastalScrub={version:1,triangles:position.length/9,shoots:9,leaves:54,opaque:true,root:[0,-.88,0],method:'branched-folded-broad-leaf-clusters'};
 return g;
}
