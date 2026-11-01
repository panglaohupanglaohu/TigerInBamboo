import * as THREE from 'three';
import {createCoastalMaterial,bindCoastalMesh} from './seaStackLighting.js';

const shoreBuilds=new WeakMap();

// Mirrors curvedWaterMaterial's local-coordinate vertex displacement. The
// CPU anchor remains the static rendered triangle; this is not a GPU raycast.
export function sampleSeaStackShoreWave(waterLocal,time=0,kind=0){
 const radial=waterLocal.clone().normalize(),phase=radial.dot(new THREE.Vector3(1.7,.6,-1.1));
 const ocean=Math.sin(phase*8+time*.9)*.045+Math.cos(phase*13-time*.57)*.022;
 const lake=Math.sin(phase*13+time*.55)*.014+Math.cos(phase*21-time*.31)*.006;
 return radial.multiplyScalar(ocean+(lake-ocean)*kind);
}
function bindWaterWave(foam,ocean){
 // Geometry is in rock-local coordinates at build time; parent is attached
 // by the caller. Stored water coordinates come from separately saved anchors.
 const uniforms={shoreTime:{value:0},shoreWaterKind:{value:0},shoreWaveReady:{value:0},shoreWaterToFoam:{value:new THREE.Matrix4()}};
 foam.material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=`attribute vec3 shoreWaterPosition;
 attribute vec2 shoreRibbon;varying vec2 vShoreRibbon;
 uniform float shoreTime,shoreWaterKind,shoreWaveReady;uniform mat4 shoreWaterToFoam;
 `+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vShoreRibbon=shoreRibbon;
 vec3 radial=normalize(shoreWaterPosition);
 float phase=dot(radial,vec3(1.7,.6,-1.1));
 float oceanWave=sin(phase*8.0+shoreTime*.9)*.045+cos(phase*13.0-shoreTime*.57)*.022;
 float lakeWave=sin(phase*13.0+shoreTime*.55)*.014+cos(phase*21.0-shoreTime*.31)*.006;
 transformed+=(shoreWaterToFoam*vec4(radial*mix(oceanWave,lakeWave,shoreWaterKind)*shoreWaveReady,0.)).xyz;`);
  // A moving front inside an ocean-supported ribbon, rather than a fixed
  // white outline. Periodic angular noise joins seamlessly around the rock.
  shader.fragmentShader=`uniform float shoreTime;varying vec2 vShoreRibbon;
 float shoreBreaker(float angle,float crossShore,float lag){
  float cycle=fract(shoreTime/6.4+lag+.075*sin(angle*3.)+.04*cos(angle*5.));
  float arrival=smoothstep(0.,.52,cycle);
  float retreat=smoothstep(.52,1.,cycle);
  float front=mix(.90,.12,arrival)+.46*retreat;
  float thickness=mix(.065,.19,arrival)*(1.-.50*retreat);
  float ripple=.025*sin(angle*23.+shoreTime*1.7)+.014*cos(angle*41.-shoreTime);
  float crest=1.-smoothstep(thickness*.3,thickness,abs(crossShore-front-ripple));
  float pieces=.5+.30*sin(angle*17.+shoreTime*.85)+.20*cos(angle*31.-shoreTime*1.2);
  float broken=smoothstep(.18+.30*retreat,.57,pieces);
  float life=smoothstep(0.,.13,cycle)*(1.-smoothstep(.62,1.,cycle));
  return crest*broken*life;
 }
 `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float angle=vShoreRibbon.x,crossShore=vShoreRibbon.y;
 float breaker=max(shoreBreaker(angle,crossShore,0.),.48*shoreBreaker(angle,crossShore,.48));
 float edge=smoothstep(0.,.06,crossShore)*(1.-smoothstep(.92,1.,crossShore));
 diffuseColor.a*=breaker*edge;
 `);
 };
 foam.material.customProgramCacheKey=()=> 'shore-curved-water-breakers-v2';
 const updateDepthOffset=()=>{
  const waterMaterial=ocean.material;
  const factor=waterMaterial?.polygonOffset?(waterMaterial.polygonOffsetFactor||0):0;
  const units=(waterMaterial?.polygonOffset?(waterMaterial.polygonOffsetUnits||0):0)-1;
  foam.material.polygonOffset=true;foam.material.polygonOffsetFactor=factor;foam.material.polygonOffsetUnits=units;
  return {oceanEnabled:!!waterMaterial?.polygonOffset,oceanFactor:waterMaterial?.polygonOffsetFactor??0,oceanUnits:waterMaterial?.polygonOffsetUnits??0,factor,units,depthTest:foam.material.depthTest};
 };
 updateDepthOffset();
 foam.onBeforeRender=()=>{
  ocean.updateWorldMatrix(true,false);foam.updateWorldMatrix(true,false);
  const water=ocean.material?.uniforms;
  uniforms.shoreTime.value=water?.uTime?.value??0;uniforms.shoreWaterKind.value=water?.uWaterKind?.value??0;
  uniforms.shoreWaveReady.value=water?.uTime&&water?.uWaterKind?1:0;
  uniforms.shoreWaterToFoam.value.copy(foam.matrixWorld).invert().multiply(ocean.matrixWorld);
  foam.renderOrder=Math.max(ocean.renderOrder+1,1);
  foam.userData.waveBinding={depthOffset:updateDepthOffset(),time:uniforms.shoreTime.value,kind:uniforms.shoreWaterKind.value,enabled:!!uniforms.shoreWaveReady.value,waterToFoam:uniforms.shoreWaterToFoam.value.toArray()};
 };
 foam.renderOrder=Math.max(ocean.renderOrder+1,1);
}


// Project-local water contact detail, from the rendered ocean and final rock.
// Returns a rock-local group: caller must add it to rock (not directly scene).
export function createSeaStackShoreContact(rock,ocean,scene){
 scene.updateMatrixWorld(true);rock.updateWorldMatrix(true,false);
 const data=rock.userData.seaStack,meta=rock.geometry.userData.terraces;
 const waterStamp={objectUuid:ocean.uuid,geometryUuid:ocean.geometry.uuid,positionVersion:ocean.geometry.attributes.position.version,indexVersion:ocean.geometry.index?.version??null,worldMatrix:ocean.matrixWorld.toArray()};
 let waterHash=2166136261;const stampText=JSON.stringify(waterStamp);for(let i=0;i<stampText.length;i++)waterHash=Math.imul(waterHash^stampText.charCodeAt(i),16777619);
 const waterRevision=`water-${(waterHash>>>0).toString(16)}`;
 const surfaceRevision=rock.userData.coastalSurface?.revision||null;
 const pose=JSON.stringify({matrix:rock.matrixWorld.toArray(),anchor:rock.userData.seaStack.seaAnchor});
 const old=shoreBuilds.get(rock);
 if(old&&old.surfaceRevision===surfaceRevision&&old.waterRevision===waterRevision&&old.pose===pose)return old.group;
 if(old){
  old.group.removeFromParent();
  const liveGeometries=new Set(),liveMaterials=new Set();
  scene.traverse(o=>{if(o.geometry)liveGeometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)liveMaterials.add(m);});
  // Dispose only resources allocated by this module, never externally assigned
  // or currently shared with surviving scene objects.
  for(const g of old.geometries)if(!liveGeometries.has(g))g.dispose();
  for(const m of old.materials)if(!liveMaterials.has(m))m.dispose();
 }

 const group=new THREE.Group();group.name='sea-stack-shore-contact';
 const anchor=new THREE.Vector3(...data.seaAnchor),up=anchor.clone().normalize();
 const u=new THREE.Vector3(1,0,0).applyQuaternion(rock.getWorldQuaternion(new THREE.Quaternion())).projectOnPlane(up).normalize(),v=up.clone().cross(u).normalize();
 const scale=rock.getWorldScale(new THREE.Vector3()),envelope=(meta.footprintRadius||data.radius*1.5)*Math.max(scale.x,scale.z),limit=envelope+1;
 const ray=new THREE.Raycaster(),positions=[],waterPositions=[],ribbonCoordinates=[],blockPositions=[],centers=[];let misses=0,maxRadial=0,maxFoamLift=0,occludedFoamSegments=0,shiftedFoamSegments=0;
 const waterAt=point=>{const direction=point.clone().normalize();ray.set(direction.clone().multiplyScalar(Math.max(point.length(),anchor.length())+120),direction.clone().negate());ray.far=300;return ray.intersectObject(ocean,false)[0]?.point.clone();};
 const local=point=>rock.worldToLocal(point.clone());
 function foamPoint(point){const water=waterAt(point);if(!water){misses++;return null;}const lifted=water.clone().addScaledVector(water.clone().normalize(),.035);maxFoamLift=Math.max(maxFoamLift,lifted.distanceTo(water));maxRadial=Math.max(maxRadial,water.clone().sub(anchor).projectOnPlane(up).length());return local(lifted);}
 function boundary(angle){
  const direction=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle));
  const outside=anchor.clone().addScaledVector(direction,envelope+2),water=waterAt(outside);if(!water)return null;
  ray.set(water.clone().addScaledVector(up,.025),direction.clone().negate());ray.far=(envelope+2)*2;
  const hit=ray.intersectObject(rock,false)[0];if(!hit)return null;
  const surface=waterAt(hit.point);if(!surface)return null;
  // Re-evaluate lateral contact at the actual water height at the first hit.
  ray.set(surface.clone().addScaledVector(direction,envelope+2).addScaledVector(up,.025),direction.clone().negate());ray.far=(envelope+2)*2;
  const refined=ray.intersectObject(rock,false)[0];const point=refined?.point||hit.point;
  const radial=point.clone().sub(anchor).projectOnPlane(up).length();if(radial>envelope+.2)return null;
  return {point,direction};
 }
 const count=112,seed=meta.seed||0;
 const samples=Array.from({length:count},(_,i)=>boundary(i/count*Math.PI*2));
 for(let i=0;i<count;i++){
  const a=samples[i],b=samples[(i+1)%count];if(!a||!b){misses++;continue;}
  // Continuous support; the shader creates moving interruptions instead of
  // permanently missing segments that make the wave look painted on.
  if(a.point.distanceTo(b.point)>Math.max(2,envelope*.23))continue;
  const width=.64+.30*(.5+.5*Math.sin(i*.87+seed));
  // A waterline can lie inside the low sea-eroded lip. Find a small exposed
  // strip outside it rather than drawing invisible foam below rock geometry.
  let offset=.035,exposed=false;
  for(let attempt=0;attempt<4;attempt++){
   offset=.035+attempt*.15;let blocked=false;
   for(const edge of[a,b]){
    const probe=waterAt(edge.point.clone().addScaledVector(edge.direction,offset+width*.5));if(!probe){blocked=true;break;}
    const radial=probe.clone().normalize();ray.set(probe.clone().addScaledVector(radial,2),radial.negate());ray.far=1.96;
    if(ray.intersectObject(rock,false).length){blocked=true;break;}
   }
   if(!blocked){exposed=true;break;}
  }
  if(!exposed){occludedFoamSegments++;continue;}if(offset>.04)shiftedFoamSegments++;
  const w=[a.point.clone().addScaledVector(a.direction,offset),b.point.clone().addScaledVector(b.direction,offset),b.point.clone().addScaledVector(b.direction,offset+width),a.point.clone().addScaledVector(a.direction,offset+width)];
  if(w.some(p=>p.clone().sub(anchor).projectOnPlane(up).length()>limit))continue;
  const q=w.map(foamPoint);if(q.some(p=>!p))continue;
  for(const j of[0,1,2,0,2,3]){
   positions.push(...q[j].toArray());
   ribbonCoordinates.push((i+(j===1||j===2?1:0))/count*Math.PI*2+seed,j>=2?1:0);
   const baseWorld=rock.localToWorld(q[j].clone());baseWorld.addScaledVector(baseWorld.clone().normalize(),-.035);
   waterPositions.push(...ocean.worldToLocal(baseWorld).toArray());
  }
 }
 const foamGeometry=new THREE.BufferGeometry();foamGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));foamGeometry.setAttribute('shoreWaterPosition',new THREE.Float32BufferAttribute(waterPositions,3));foamGeometry.setAttribute('shoreRibbon',new THREE.Float32BufferAttribute(ribbonCoordinates,2));foamGeometry.computeVertexNormals();foamGeometry.computeBoundingSphere();
 const foam=new THREE.Mesh(foamGeometry,new THREE.MeshBasicMaterial({color:0xe1f5f2,transparent:true,opacity:.80,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));foam.name='sea-stack-contact-foam';group.add(foam);bindWaterWave(foam,ocean);
 // Small uneven talus clusters, with centers partially buried in actual water.
 for(let k=0;k<6;k++){
  const i=((seed*13+k*17+9)%count+count)%count,sample=samples[i];if(!sample)continue;
  const size=.55+.27*(k%3),position=sample.point.clone().addScaledVector(sample.direction,.30+size*.6);
  if(position.clone().sub(anchor).projectOnPlane(up).length()+size>limit)continue;
  const water=waterAt(position);if(!water)continue;const center=water.clone().addScaledVector(water.clone().normalize(),-.06);
  const g=new THREE.IcosahedronGeometry(size,0);g.scale(1,.64+.1*(k%2),.72);g.rotateY(k*1.17+seed);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),water.clone().normalize());
  const p=g.attributes.position;for(let j=0;j<p.count;j++){const point=new THREE.Vector3().fromBufferAttribute(p,j).applyQuaternion(q).add(center);blockPositions.push(...local(point).toArray());}
  centers.push({waterWorld:water.toArray(),centerWorld:center.toArray(),radius:size});g.dispose();
 }
 if(blockPositions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(blockPositions,3));g.computeVertexNormals();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,createCoastalMaterial({kind:'rock',color:0x879ca5}));mesh.name='sea-stack-contact-talus';group.add(mesh);bindCoastalMesh(mesh,rock);}
 const contract={waterRevision,detailId:data.detailId,surfaceRevision:rock.userData.coastalSurface?.revision||null,waterObjectUuid:ocean.uuid,waterGeometryUuid:ocean.geometry.uuid,waterPositionVersion:ocean.geometry.attributes.position.version,waterWorldMatrix:ocean.matrixWorld.toArray(),coordinates:'rock-local; add returned group to rock',waveBinding:'ocean-local radial vertex wave; shared uTime/uWaterKind; ocean-to-foam displacement matrix',breakerAnimation:{version:2,periodSeconds:6.4,fronts:2,mode:'approach-break-retreat-fade',coordinates:'periodic shoreline angle / cross-shore distance',supportedWidth:[.64,.94]},waveLimits:'static triangle ray anchors plus analytic GPU offset, not GPU raycast; ocean triangle interpolation may differ slightly',staticFoamLift:.035,depthTest:true,renderOrder:foam.renderOrder,method:'horizontal rock raycast refined by actual radial ocean raycast',envelopeWorld:limit,maxFoamFootprint:maxRadial,maxFoamLift,foamTriangles:positions.length/9,talus:centers,misses,occludedFoamSegments,shiftedFoamSegments,limitations:'first lateral hit only; discontinuous or hidden coast rays omitted; talus center water-supported, no physics collision'};
 group.userData.shoreContact=contract;group.userData.surfaceRevision=surfaceRevision;group.userData.waterRevision=waterRevision;
 for(const child of group.children)child.userData.shoreContact={waterRevision,detailId:data.detailId,surfaceRevision:contract.surfaceRevision,waterObjectUuid:ocean.uuid,waterPositionVersion:contract.waterPositionVersion};
 const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
 shoreBuilds.set(rock,{group,geometries,materials,surfaceRevision,waterRevision,pose});
 return group;
}
