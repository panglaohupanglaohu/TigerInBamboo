import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1),q=new T.Quaternion();
/** Optional candidate skin from the actual tiger-v3 remesh/armature workflow.
 * Existing horse controls and seat remain authoritative. Reversible, no root scale changes.
 */
export async function upgradeMorrisHorseAsset(root,{url=new URL('../../assets/models/morris-horse/horse-v1.glb',import.meta.url).href,loader=new GLTFLoader()}={}){
 if(root.userData.horseAsset)return root.userData.horseAsset;
 const gltf=await loader.loadAsync(url),model=gltf.scene.getObjectByName('MorrisHorse')||gltf.scene,bones={};
 model.traverse(o=>{if(o.isBone)bones[o.userData.name||o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 for(const n of ['chest','neck','tail','front.L_upper','front.R_upper','hind.L_upper','hind.R_upper'])if(!bones[n])throw new Error(`Horse skin bone missing: ${n}`);
 const h=root.userData.horse;if(!h)throw new Error('Morris horse control contract missing');
 const visibility=[];for(const c of [h.body,h.neck,h.tail,...h.legs])c.traverse(o=>{if(o.isMesh){visibility.push([o,o.visible]);o.visible=false;}});
 const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));root.add(model);
 const asset={model,bones,rest,visibility,revision:'tiger-workflow-horse-v1',status:'candidate-gait-review-pending',restore(){root.remove(model);for(const[o,v]of visibility)o.visible=v;delete root.userData.horseAsset;}};root.userData.horseAsset=asset;syncMorrisHorseAsset(root);return asset;
}
/** Call immediately AFTER existing animateMorrisHorse; skin never overwrites controls. */
export function syncMorrisHorseAsset(root){
 const a=root.userData.horseAsset,h=root.userData.horse;if(!a||!h)return;
 const pose=(n,angle,axis=X)=>{const b=a.bones[n],r=a.rest[n];if(b)b.quaternion.copy(r.q).multiply(q.setFromAxisAngle(axis,angle));};
 pose('neck',h.neck.rotation.x);pose('tail',h.tail.rotation.z,Z);pose('chest',h.body.rotation.z,Z);
 a.bones.chest.position.copy(a.rest.chest.p);a.bones.chest.position.y+=h.body.position.y;
 const names=['hind.R','front.R','hind.L','front.L'];
 for(let i=0;i<4;i++){const leg=h.legs[i],n=names[i],k=leg.userData.knee.rotation.x;pose(n+'_upper',leg.rotation.x);pose(n+'_lower',k*.45);pose(n+'_cannon',k*.55);pose(n+'_hoof',-leg.rotation.x-k);}
 a.model.updateMatrixWorld(true);
}
