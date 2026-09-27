import * as THREE from 'three';
export const TIGER_TARGET_ROUND=2;
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
 // Throat fur follows the neck's underside even when it bends down, rather than a world-Y bib.
 const neckShader=neck.material.onBeforeCompile;
 neck.material.onBeforeCompile=shader=>{neckShader(shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNeckUv=uv;vNeckNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('float belly=1.-smoothstep(-.82,-.35,vTigerSkin.y);','float belly=0.;').replace('float throat=smoothstep(1.7,2.3,vTigerSkin.z)*(1.-smoothstep(-.3,.35,vTigerSkin.y));','float throat=(1.-smoothstep(-.65,-.15,sin(vNeckUv.x*6.2831853)+.045*sin(vNeckUv.y*180.)))*smoothstep(.1,.7,vNeckUv.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=.77+.23*smoothstep(-.3,.5,dot(normalize(vNeckNormal),normalize(vec3(-.3,.7,.5))));\n#include <opaque_fragment>');
 };
 neck.material.customProgramCacheKey=()=> 'tiger-target-throat-2';
 // Use actual step support for the drinking stance, not a horizontal body buried in the risers.
 tiger.rotation.order='YXZ';
 const oldUpdate=tiger.userData.update,ray=new THREE.Raycaster(),local=new THREE.Vector3(),world=new THREE.Vector3(),down=new THREE.Vector3(),nosePoint=new THREE.Vector3();let drinkBlend=0;
 const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
 const support=(swamp,paw)=>{tiger.updateWorldMatrix(true,true);paw.geometry.computeBoundingBox();local.set(0,paw.geometry.boundingBox.min.y,.30);paw.localToWorld(local);swamp.worldToLocal(local);const foot=local.clone();world.copy(local);world.y=55;swamp.localToWorld(world);down.set(0,-1,0).transformDirection(swamp.matrixWorld);ray.set(world,down);const hit=ray.intersectObjects(swamp.userData.tigerWalkSurfaces||[],false)[0];return {foot,height:hit?swamp.worldToLocal(hit.point.clone()).y:null};};
 tiger.userData.update=function(dt,t,runtime){oldUpdate.call(this,dt,t,runtime);const swamp=tiger.parent;
  drinkBlend+=(Number(!!tiger.userData._drinking)-drinkBlend)*Math.min(1,dt*4);tiger.rotation.x=0;
  if(drinkBlend<.01||!swamp?.userData.tigerWalkSurfaces)return;
  swamp.updateWorldMatrix(true,false);for(const step of swamp.userData.tigerWalkSurfaces)step.updateWorldMatrix(true,false);
  const fore=support(swamp,paws[0]),rear=support(swamp,paws[2]);if(fore.height==null||rear.height==null)return;
  const span=Math.hypot(fore.foot.x-rear.foot.x,fore.foot.z-rear.foot.z),pitch=THREE.MathUtils.clamp(Math.atan2(rear.height-fore.height,Math.max(.1,span)),0,1.0)*drinkBlend;tiger.rotation.x=pitch;
  // Front limbs remain substantially upright as the back inclines down the steps.
  for(const id of ['n52','n59','n66','n73']){const leg=nodes.get(id);if(leg)leg.rotation.x-=pitch*.8;}
  const feet=paws.map(p=>support(swamp,p)).filter(p=>p.height!=null);if(feet.length)tiger.position.y+=Math.max(...feet.map(p=>p.height+.015-p.foot.y));
  head.rotation.x-=pitch*.75;
  tiger.updateWorldMatrix(true,true);const nose=nodes.get('n25'),a=nose.geometry.attributes.position;let min=Infinity,best=new THREE.Vector3();
  for(let i=0;i<a.count;i++){nosePoint.fromBufferAttribute(a,i);nose.localToWorld(nosePoint);swamp.worldToLocal(nosePoint);if(nosePoint.y<min){min=nosePoint.y;best.copy(nosePoint);}}
  if(drinkBlend>.8){const from=body.worldToLocal(swamp.localToWorld(best.clone())),to=best.clone();to.y=25.02;body.worldToLocal(swamp.localToWorld(to));head.position.add(to.sub(from));}
  updateNeck();tiger.userData.tigerTargetSupport={pitch,feet:feet.map(p=>({height:p.height,foot:p.foot.toArray()})),noseBefore:min};
 };

 tiger.userData.tigerTargetRound=TIGER_TARGET_ROUND;
}
