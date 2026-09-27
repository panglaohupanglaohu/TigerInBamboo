import * as THREE from 'three';
export const TIGER_TARGET_ROUND=1;
export function applyTigerTargetV1(tiger){
 const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});
 const head=nodes.get('n8'),body=nodes.get('n1'),neck=nodes.get('n6');if(!head||!body||!neck)return;
 const edit=(id,fn)=>{const n=nodes.get(id);if(!n?.geometry)return;n.geometry=n.geometry.clone();const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)fn(p,i);p.needsUpdate=true;n.geometry.computeVertexNormals();n.geometry.computeBoundingSphere();return n;};
 edit('n2',(p,i)=>{const z=p.getZ(i);if(z>1.25){const k=(z-1.25)/1.335;p.setZ(i,1.25+(z-1.25)*.40);p.setX(i,p.getX(i)*(1-.30*k));}});
 // The nape and throat form one continuous, bending loft, from scapula to skull.
 const rings=24,sides=28,positions=new Float32Array((rings+1)*(sides+1)*3),uvs=[],indices=[];
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){uvs.push(j/sides,i/rings);if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);neck.geometry=geo;
 // Preserve the approved coat shader; remove stale pre-loft vertex shading.
 neck.material=nodes.get('n2').material.clone();neck.material.vertexColors=false;
 neck.material.onBeforeCompile=nodes.get('n2').material.onBeforeCompile;neck.material.customProgramCacheKey=()=> 'tiger-target-neck-1';
 const p0=new THREE.Vector3(0,.20,-.25),p1=new THREE.Vector3(0,.62,1.15),p2=new THREE.Vector3(),p3=new THREE.Vector3(),point=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(),endDir=new THREE.Vector3();
 const curve=new THREE.CubicBezierCurve3(p0,p1,p2,p3);
 const updateNeck=()=>{head.updateMatrix();p3.set(0,-.1,-.43).applyMatrix4(head.matrix);endDir.set(0,0,1).transformDirection(head.matrix);p2.copy(p3).addScaledVector(endDir,-.42);
  for(let i=0;i<=rings;i++){const u=i/rings,s=u*u*(3-2*u);curve.getPoint(u,point);curve.getTangent(u,tangent);up.set(0,tangent.z,-tangent.y).normalize();const rx=THREE.MathUtils.lerp(.9,.73,s),ry=THREE.MathUtils.lerp(1.0,.72,s);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,k=(i*(sides+1)+j)*3;positions[k]=Math.cos(a)*rx;positions[k+1]=point.y+Math.sin(a)*ry*up.y;positions[k+2]=point.z+Math.sin(a)*ry*up.z;}}
  geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
 };
 tiger.userData.updateTargetNeck=updateNeck;updateNeck();
 tiger.userData.tigerTargetRound=TIGER_TARGET_ROUND;
}
