import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1),q=new T.Quaternion();
/** Optional candidate skin from the actual tiger-v3 remesh/armature workflow.
 * Existing horse controls and seat remain authoritative. Reversible, no root scale changes.
 */
export async function upgradeMorrisHorseAsset(root,{url=new URL('../../assets/models/morris-horse/horse-v13.glb',import.meta.url).href,loader=new GLTFLoader()}={}){
 if(root.userData.horseAsset)return root.userData.horseAsset;
 const gltf=await loader.loadAsync(url),model=gltf.scene.getObjectByName('MorrisHorse')||gltf.scene,bones={};
 model.traverse(o=>{if(o.isBone)bones[o.userData.name||o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 for(const n of ['chest','neck','tail','front.L_upper','front.R_upper','hind.L_upper','hind.R_upper'])if(!bones[n])throw new Error(`Horse skin bone missing: ${n}`);
 const h=root.userData.horse;if(!h)throw new Error('Morris horse control contract missing');
 const visibility=[];for(const c of [h.body,h.neck,h.tail,...h.legs])c.traverse(o=>{if(o.isMesh){visibility.push([o,o.visible]);o.visible=false;}});
 model.updateMatrixWorld(true);const modelInverseQ=model.getWorldQuaternion(new T.Quaternion()).invert();const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),parentRootQ:modelInverseQ.clone().multiply(b.parent.getWorldQuaternion(new T.Quaternion()))}]));const variants=new Map();model.traverse(o=>{if(!o.isMesh)return;const map=mat=>{if(variants.has(mat))return variants.get(mat);const m=mat.clone(),name=mat.name.toLowerCase();if(name.includes('warm white horse')&&h.coatColor)m.color.copy(h.coatColor);if(name.includes('ivory mane')&&h.maneColor)m.color.copy(h.maneColor);if(name.includes('navy brocade cloth')&&h.clothColor)m.color.copy(h.clothColor);variants.set(mat,m);return m;};o.material=Array.isArray(o.material)?o.material.map(map):map(o.material);});root.add(model);
 const asset={model,bones,rest,visibility,revision:model.userData.revision||'tiger-workflow-horse-v13',status:'candidate-gait-review-pending',restore(){root.remove(model);for(const[o,v]of visibility)o.visible=v;delete root.userData.horseAsset;}};root.userData.horseAsset=asset;syncMorrisHorseAsset(root);return asset;
}
/** Call immediately AFTER existing animateMorrisHorse; skin never overwrites controls. */
export function syncMorrisHorseAsset(root){
 const a=root.userData.horseAsset,h=root.userData.horse;if(!a||!h)return;
 const pose=(n,angle,axis=X)=>{const b=a.bones[n],r=a.rest[n];if(b){const localAxis=axis.clone().applyQuaternion(r.parentRootQ.clone().invert());b.quaternion.copy(q.setFromAxisAngle(localAxis,angle)).multiply(r.q);}};
 pose('neck',h.neck.rotation.x);pose('chest',h.body.rotation.z,Z);const tail=h.tailPose||{lift:h.tail.rotation.x,side:h.tail.rotation.z,twist:h.tail.rotation.y,midCurl:0,tipCurl:0,midSide:0,tipSide:0};const tailPose=(name,x,y,z)=>{const b=a.bones[name],r=a.rest[name];if(!b)return;const deltaRoot=new T.Quaternion().setFromEuler(new T.Euler(x,y,z,'XYZ')),parent=r.parentRootQ,delta=parent.clone().invert().multiply(deltaRoot).multiply(parent);b.quaternion.copy(delta).multiply(r.q);};tailPose('tail',tail.lift,tail.twist,tail.side);tailPose('tail.mid',tail.midCurl,0,tail.midSide);tailPose('tail.tip',tail.tipCurl,0,tail.tipSide);
 a.bones.chest.position.copy(a.rest.chest.p);a.bones.chest.position.y+=h.body.position.y;
 const names=['hind.R','front.R','hind.L','front.L'];
 for(let i=0;i<4;i++){const leg=h.legs[i],n=names[i],k=leg.userData.knee.rotation.x;pose(n+'_upper',leg.rotation.x);pose(n+'_lower',k*(i%2===0?.55:.10));pose(n+'_cannon',k*(i%2===0?.45:.90));pose(n+'_hoof',-leg.rotation.x-k+(leg.userData.toePitch||0));}
 a.model.updateMatrixWorld(true);
}
/** Seat, rider and skin descend together until the lowest hoof meets real support.
 * This is root support correction, not four-leg IK; never sample plants or water here.
 */
export function settleMorrisHorseFeet(root,sampleGroundRadius){
 const a=root.userData.horseAsset;if(!a||!sampleGroundRadius||root.userData.horse?.gaitAirborne)return null;
 a.hooves??=[];if(!a.hooves.length)a.model.traverse(o=>{if(o.isSkinnedMesh&&o.name.includes('hoof'))a.hooves.push(o);});
 root.parent.updateWorldMatrix(true,false);root.updateMatrixWorld(true);let lowest=Infinity;
 for(const mesh of a.hooves){const candidates=[],p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i+=3){const v=new T.Vector3().fromBufferAttribute(p,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);candidates.push(v);}
  candidates.sort((v,w)=>v.lengthSq()-w.lengthSq());
  // Contact can lie on the uphill edge of the sole, not the point nearest the planet centre.
  for(const point of candidates.slice(0,4)){const support=sampleGroundRadius(point);if(Number.isFinite(support))lowest=Math.min(lowest,point.length()-support);}
 }
 if(!Number.isFinite(lowest))return null;
 const up=new T.Vector3(0,1,0).transformDirection(root.parent.matrixWorld),radial=root.getWorldPosition(new T.Vector3()).normalize(),dot=up.dot(radial);
 if(dot<.7)return null;const correction=T.MathUtils.clamp((lowest-.012)/dot,-.12,.18);root.position.y-=correction;root.updateMatrixWorld(true);
 root.userData.hoofSupport={clearanceBefore:lowest,rootCorrection:correction,method:'lowest skinned hoof to actual support; no per-leg IK'};return correction;
}
