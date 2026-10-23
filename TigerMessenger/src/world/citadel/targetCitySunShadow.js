import * as THREE from 'three';
/** Review candidate: retarget the existing sun's shadow camera to the citadel
 * with optional authored local direction; always preserve colour and intensity. */
export function fitTargetCitySunShadow(scene,castle,{directionLocal=null,renderer=null,softShadows=false}={}){
 const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow&&o.visible&&o.name==='');
 if(!sun)return{report:{applied:false,reason:'primary-sun-unavailable'},dispose(){}};
 const previousShadowType=renderer?.shadowMap?.type;
 const setShadowType=type=>{if(!renderer?.shadowMap||renderer.shadowMap.type===type)return;renderer.shadowMap.type=type;renderer.shadowMap.needsUpdate=true;scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)m.needsUpdate=true;});};
 if(softShadows)setShadowType(THREE.PCFSoftShadowMap);
 const camera=sun.shadow.camera,keys=['near','far','left','right','top','bottom'];
 const before={position:sun.position.clone(),target:sun.target.position.clone(),camera:Object.fromEntries(keys.map(k=>[k,camera[k]])),bias:sun.shadow.bias,normalBias:sun.shadow.normalBias};
 castle.updateWorldMatrix(true,false);
 const direction=directionLocal?new THREE.Vector3(...directionLocal).normalize().transformDirection(castle.matrixWorld):sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3())).normalize();
 const focus=castle.localToWorld(new THREE.Vector3(0,12,25));sun.target.position.copy(sun.target.parent?sun.target.parent.worldToLocal(focus.clone()):focus);const p=focus.clone().addScaledVector(direction,250);sun.position.copy(sun.parent?sun.parent.worldToLocal(p):p);sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
 Object.assign(camera,{near:60,far:440,left:-145,right:145,top:125,bottom:-125});camera.updateProjectionMatrix();sun.shadow.bias=-.00035;sun.shadow.normalBias=.12;sun.shadow.needsUpdate=true;
 const report={applied:true,lightUUID:sun.uuid,direction:direction.toArray(),directionLocal:directionLocal?[...directionLocal]:null,focus:focus.toArray(),shadowBounds:Object.fromEntries(keys.map(k=>[k,camera[k]])),bias:sun.shadow.bias,normalBias:sun.shadow.normalBias,intensityUnchanged:true,colourUnchanged:true,scope:'review-only primary sun shadow coverage; restore when candidate closes',gpuVerified:false,shadowFilter:renderer?.shadowMap?.type??null};
 // 2026-10-15 perf (user): the box above stayed locked on the citadel, so every frame rendered ~1800
 // citadel shadow draws wherever the player was, and nowhere else had sun shadows. follow(focus)
 // re-centres a compact box on the player instead: same azimuth as the authored citadel sun, a fixed
 // ~55 deg elevation over the local ground, texel-snapped so shadows do not swim. ?sunShadowFollow=0 keeps the fixed box.
 const followEnabled=new URLSearchParams(globalThis.location?.search||'').get('sunShadowFollow')!=='0';
 const HALF=45,MAP=sun.shadow.mapSize?.x||2048,texel=HALF*2/MAP,_up=new THREE.Vector3(),_t=new THREE.Vector3(),_d=new THREE.Vector3(),_r=new THREE.Vector3(),_u=new THREE.Vector3(),_f=new THREE.Vector3(),_last=new THREE.Vector3(Infinity,0,0);
 report.follow={enabled:followEnabled,halfExtent:HALF,elevationDeg:55};
 function follow(focus){
  if(!followEnabled||disposed||!focus)return false;
  _up.copy(focus).normalize();_t.copy(direction).addScaledVector(_up,-direction.dot(_up));if(_t.lengthSq()<1e-6)_t.set(1,0,0).addScaledVector(_up,-_up.x);_t.normalize();
  _d.copy(_up).multiplyScalar(.82).addScaledVector(_t,.57).normalize();
  // texel snap in light space
  _r.crossVectors(_d,Math.abs(_d.y)<.95?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize();_u.crossVectors(_r,_d).normalize();
  const a=Math.round(focus.dot(_r)/texel)*texel,b=Math.round(focus.dot(_u)/texel)*texel,c=focus.dot(_d);
  _f.copy(_r).multiplyScalar(a).addScaledVector(_u,b).addScaledVector(_d,c);
  if(_f.distanceToSquared(_last)<1e-8)return true;_last.copy(_f);
  sun.target.position.copy(sun.target.parent?sun.target.parent.worldToLocal(_f.clone()):_f);
  const p=_f.clone().addScaledVector(_d,140);sun.position.copy(sun.parent?sun.parent.worldToLocal(p):p);
  if(camera.left!==-HALF){Object.assign(camera,{near:20,far:260,left:-HALF,right:HALF,top:HALF,bottom:-HALF});camera.updateProjectionMatrix();}
  sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);return true;
 }
 if(followEnabled)scene.userData.sunShadowFollow={follow};
 let disposed=false;return{report,follow,dispose(){if(disposed)return;disposed=true;if(scene.userData.sunShadowFollow?.follow===follow)delete scene.userData.sunShadowFollow;if(previousShadowType!==undefined)setShadowType(previousShadowType);sun.position.copy(before.position);sun.target.position.copy(before.target);Object.assign(camera,before.camera);camera.updateProjectionMatrix();sun.shadow.bias=before.bias;sun.shadow.normalBias=before.normalBias;sun.shadow.needsUpdate=true;}};
}
