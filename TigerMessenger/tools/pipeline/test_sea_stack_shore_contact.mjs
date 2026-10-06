import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {coastalStackGeometry} from '../../src/world/seaStackCoastalGeometry.js';
import {createSeaStackShoreContact,sampleSeaStackShoreWave} from '../../src/world/seaStackShoreContact.js';
import {prepareSeaStackSurface} from '../../src/world/seaStackLighting.js';
import {publishSeaStackSurfaceContract} from '../../src/world/seaStackSurfaceContract.js';

// The first 8 approved gate rocks are east seeds 0..6, then west seed 10.
// Dimensions mirror gateTargetThirty; ocean is an actual triangulated sphere.
// This fixture does not claim full-world rail clearance or visual acceptance.
const seeds=[0,1,2,3,4,5,6,10],results=[];
for(let order=0;order<seeds.length;order++){
 const seed=seeds[order],i=seed===10?0:seed,height=28+i*13%28,radius=(12+i%3*4)*.68;
 const scene=new THREE.Scene(),ocean=new THREE.Mesh(new THREE.SphereGeometry(160,128,80),new THREE.MeshBasicMaterial());scene.add(ocean);ocean.name='planet-v8-curved-ocean';
 // Inclined radial up prevents a world-Y-only implementation passing by luck.
 const up=new THREE.Vector3(Math.cos(order*.71)*.52,.65,Math.sin(order*.71)*.52).normalize();
 const ray=new THREE.Raycaster(up.clone().multiplyScalar(280),up.clone().negate());const water=ray.intersectObject(ocean,false)[0].point.clone();
 const geometry=coastalStackGeometry(radius,height,seed),rock=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());scene.add(rock);rock.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);rock.rotateY(i*.63);rock.position.copy(water).addScaledVector(up,height/2-Math.max(6,height*.115));rock.userData.seaStack={height,radius,seaAnchor:water.toArray(),detailId:`fixture-${seed}`};scene.updateMatrixWorld(true);
 prepareSeaStackSurface(rock,scene);const source=geometry.attributes.position.array.slice(),oceanSource=ocean.geometry.attributes.position.array.slice(),matrix=rock.matrixWorld.toArray();
 const group=createSeaStackShoreContact(rock,ocean,scene);rock.add(group);scene.updateMatrixWorld(true);const audit=group.userData.shoreContact;
 const again=createSeaStackShoreContact(rock,ocean,scene);assert.equal(again,group);rock.add(again);assert.equal(rock.children.filter(o=>o.name==='sea-stack-shore-contact').length,1);
 assert.equal(group.userData.surfaceRevision,audit.surfaceRevision);assert.equal(group.userData.waterRevision,audit.waterRevision);
 assert(audit.foamTriangles>=8,`seed ${seed}: only ${audit.foamTriangles} foam triangles`);assert(audit.talus.length>=1,`seed ${seed}: no talus`);assert(Number.isInteger(audit.misses)&&audit.misses>=0);
 assert.equal(audit.surfaceRevision,rock.userData.coastalSurface.revision);assert.equal(audit.waterObjectUuid,ocean.uuid);assert.equal(audit.waterGeometryUuid,ocean.geometry.uuid);assert.equal(audit.waterPositionVersion,ocean.geometry.attributes.position.version);
 const contract=publishSeaStackSurfaceContract(scene,[rock],ocean);assert.equal(audit.waterRevision,contract.waterRevision);
 let maxAnchorError=0,maxFootprint=0;
 for(const child of group.children){
  assert.equal(child.userData.shoreContact.surfaceRevision,audit.surfaceRevision);assert.equal(child.userData.shoreContact.waterRevision,audit.waterRevision);
  const p=child.geometry.attributes.position;
  for(let j=0;j<p.count;j++){
   const world=child.localToWorld(new THREE.Vector3().fromBufferAttribute(p,j)),footprint=world.clone().sub(water).projectOnPlane(up).length();maxFootprint=Math.max(maxFootprint,footprint);assert(footprint<=audit.envelopeWorld+1e-4,`seed ${seed}: actual detail vertex outside envelope ${footprint} > ${audit.envelopeWorld}`);
   if(child.name!=='sea-stack-contact-foam')continue;
   const direction=world.clone().normalize();ray.set(direction.clone().multiplyScalar(280),direction.clone().negate());const support=ray.intersectObject(ocean,false)[0];assert(support,`seed ${seed}: no ocean support`);
   maxAnchorError=Math.max(maxAnchorError,Math.abs(world.distanceTo(support.point)-.035));
  }
 }
 assert(maxAnchorError<1e-4,`seed ${seed}: floating foam ${maxAnchorError}`);
 for(const block of audit.talus){const center=new THREE.Vector3(...block.centerWorld),support=new THREE.Vector3(...block.waterWorld);assert(Math.abs(center.distanceTo(support)-.06)<1e-6);assert(center.dot(support.clone().normalize())<support.length());}
 assert.deepEqual(geometry.attributes.position.array,source);assert.deepEqual(ocean.geometry.attributes.position.array,oceanSource);assert.deepEqual(rock.matrixWorld.toArray(),matrix);
 results.push({seed,foamTriangles:audit.foamTriangles,talus:audit.talus.length,misses:audit.misses,maxAnchorError,maxFootprint,limit:audit.envelopeWorld});
 // New ocean upload invalidates the water stamp, without editing the old group.
 let exclusiveDisposed=0,sharedDisposed=0,externalDisposed=0;
 group.children[0].geometry.addEventListener('dispose',()=>exclusiveDisposed++);
 const sharedMaterial=group.children[0].material;sharedMaterial.addEventListener('dispose',()=>sharedDisposed++);
 const external=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),sharedMaterial);scene.add(external);
 const externallyAssigned=new THREE.MeshBasicMaterial();externallyAssigned.addEventListener('dispose',()=>externalDisposed++);group.children[1].material=externallyAssigned;
 // Shader binding uses actual water-local wave coordinates and displacement
 // vectors (w=0), so translations are never applied twice to moving foam.
 const foam=group.children[0],compiled={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};foam.material.onBeforeCompile(compiled);
 assert.equal(foam.geometry.attributes.shoreRibbon.count,foam.geometry.attributes.position.count);
 assert(compiled.fragmentShader.includes('shoreBreaker(angle,crossShore'));
 assert.equal(foam.geometry.attributes.shoreWaterPosition.count,foam.geometry.attributes.position.count);assert(foam.material.depthTest);assert.equal(foam.material.depthWrite,false);
 ocean.material.polygonOffset=true;ocean.material.polygonOffsetFactor=-2;ocean.material.polygonOffsetUnits=-2;
 ocean.material.uniforms={uTime:{value:2.75},uWaterKind:{value:0}};ocean.renderOrder=4;foam.onBeforeRender();assert.equal(foam.renderOrder,5);assert.equal(foam.material.polygonOffsetFactor,-2);assert.equal(foam.material.polygonOffsetUnits,-3);assert.equal(foam.userData.waveBinding.depthOffset.oceanUnits,-2);assert.equal(foam.userData.waveBinding.depthOffset.depthTest,true);assert.equal(compiled.uniforms.shoreTime.value,2.75);assert.equal(compiled.uniforms.shoreWaveReady.value,1);
 const waterLocal=new THREE.Vector3().fromBufferAttribute(foam.geometry.attributes.shoreWaterPosition,0),radial=waterLocal.clone().normalize(),phase=radial.dot(new THREE.Vector3(1.7,.6,-1.1));
 const oceanWave=sampleSeaStackShoreWave(waterLocal,2.75,0);assert(Math.abs(oceanWave.dot(radial)-(Math.sin(phase*8+2.75*.9)*.045+Math.cos(phase*13-2.75*.57)*.022))<1e-12);
 const toFoam=compiled.uniforms.shoreWaterToFoam.value,localDelta=oceanWave.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(toFoam)),worldDelta=localDelta.applyMatrix3(new THREE.Matrix3().setFromMatrix4(foam.matrixWorld));assert(worldDelta.distanceTo(oceanWave.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(ocean.matrixWorld)))<1e-10);
 ocean.material.uniforms.uTime.value=8.1;ocean.material.uniforms.uWaterKind.value=1;foam.onBeforeRender();assert.equal(compiled.uniforms.shoreTime.value,8.1);assert.equal(compiled.uniforms.shoreWaterKind.value,1);ocean.material.polygonOffsetFactor=-1;ocean.material.polygonOffsetUnits=-4;foam.onBeforeRender();assert.equal(foam.material.polygonOffsetFactor,-1);assert.equal(foam.material.polygonOffsetUnits,-5);assert(sampleSeaStackShoreWave(waterLocal,8.1,1).distanceTo(oceanWave)>1e-6);
 assert.equal(createSeaStackShoreContact(rock,ocean,scene),group,'time updates must not rebuild contact geometry');
 const prior=audit.waterRevision;ocean.geometry.attributes.position.needsUpdate=true;const next=createSeaStackShoreContact(rock,ocean,scene);rock.add(next);assert.notEqual(next.userData.shoreContact.waterRevision,prior);
 assert.equal(group.parent,null);assert.equal(rock.children.filter(o=>o.name==='sea-stack-shore-contact').length,1);assert.equal(exclusiveDisposed,1);assert.equal(sharedDisposed,0);assert.equal(externalDisposed,0);
 // A genuine final-surface revision replaces the group as well.
 geometry.attributes.position.setY(0,geometry.attributes.position.getY(0)+.01);prepareSeaStackSurface(rock,scene);
 const revised=createSeaStackShoreContact(rock,ocean,scene);rock.add(revised);assert.notEqual(revised,next);assert.equal(next.parent,null);assert.equal(rock.children.filter(o=>o.name==='sea-stack-shore-contact').length,1);assert.equal(revised.userData.surfaceRevision,rock.userData.coastalSurface.revision);
 revised.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});geometry.dispose();rock.material.dispose();ocean.geometry.dispose();ocean.material.dispose();external.geometry.dispose();sharedMaterial.dispose();externallyAssigned.dispose();

}
console.log(JSON.stringify({passed:true,scope:'eight production seed/dimension fixtures on inclined triangulated spherical ocean; not full-world collision audit',results},null,2));
