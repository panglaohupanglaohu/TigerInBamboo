import * as THREE from 'three';
// z, transverse half-width, vertical half-height, vertical centre.
// The broad rear joins the cheek, and the blunt front is capped under the nasal pad.
export const TIGER_MUZZLE_SECTIONS=Object.freeze([
 [.35,.54,.29,-.25],[.62,.66,.34,-.25],[.96,.64,.32,-.27],
 [1.28,.58,.29,-.28],[1.46,.54,.26,-.28],[1.55,.48,.22,-.29],
]);
export const TIGER_BRIDGE_SECTIONS=Object.freeze([
 [.05,.55,.34,.12],[.45,.60,.30,.10],[1.0,.48,.27,-.02],[1.48,.30,.19,-.11],
]);
export function createTigerFaceLoft(profile,rings=36,sides=32){
 const vertices=[],uv=[],indices=[];
 for(let i=0;i<=rings;i++){
  const z=THREE.MathUtils.lerp(profile[0][0],profile.at(-1)[0],i/rings);let j=0;
  while(j<profile.length-2&&z>profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],u=(z-a[0])/(b[0]-a[0]),t=u*u*(3-2*u);
  const rx=THREE.MathUtils.lerp(a[1],b[1],t),ry=THREE.MathUtils.lerp(a[2],b[2],t),cy=THREE.MathUtils.lerp(a[3],b[3],t);
  for(let k=0;k<=sides;k++){
   const angle=k/sides*Math.PI*2;vertices.push(Math.cos(angle)*rx,cy+Math.sin(angle)*ry,z);uv.push(k/sides,i/rings);
   if(i<rings&&k<sides){const n=i*(sides+1)+k,m=n+sides+1;indices.push(n,n+1,m,m,n+1,m+1);}
  }
 }
 for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const end=rings*(sides+1);indices.push(end,end+j,end+j+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
