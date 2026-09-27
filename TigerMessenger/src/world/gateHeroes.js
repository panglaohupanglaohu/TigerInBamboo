import * as THREE from 'three';
import data from '../../assets/models/optimized/gate-heroes/gateHeroesData.js';

/** Actors authored in Blender, Y-up, forward -Z, feet Y=0. No meeting placement baked. */
export function createGateHero(role) {
 const actor=data.actors.find(a=>a.name===role);
 if(!actor)throw new Error(`Unknown gate hero: ${role}`);
 const nodes=new Map();
 for(const part of actor.nodes){
  let object;
  if(part.positions){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));
   geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
   geometry.computeBoundingSphere();geometry.computeBoundingBox();
   const metal=/bronze|helmet|plate|greave|shield|buckle|pauldron/.test(part.name);
   const material=new THREE.MeshStandardMaterial({color:new THREE.Color(...part.color),roughness:.72,metalness:metal?.35:0,flatShading:true});
   object=new THREE.Mesh(geometry,material);object.castShadow=true;object.receiveShadow=true;
  }else object=new THREE.Group();
  object.name=part.name;object.matrix.fromArray(part.matrix);object.matrix.decompose(object.position,object.quaternion,object.scale);
  object.userData.restQuaternion=object.quaternion.clone();nodes.set(part.name,object);
 }
 for(const part of actor.nodes)if(part.parent)nodes.get(part.parent).add(nodes.get(part.name));
 const root=nodes.get(role);root.userData.heroIdentity=role;root.userData.triangles=actor.triangles;root.userData.bounds=actor.bounds;
 root.userData.parts={armL:nodes.get(`${role}_armL`),armR:nodes.get(`${role}_armR`),head:nodes.get(`${role}_head`),letter:nodes.get('odysseus_letter')||null};
 return root;
}

/** Stage API: waiting, receiving, reading, acknowledging. Caller supplies story stage/time. */
export function setGateHeroStage(root,stage='waiting',time=0,weight=1){
 const parts=root?.userData.parts;if(!parts)return;
 const w=THREE.MathUtils.clamp(weight,0,1),role=root.userData.heroIdentity;
 for(const key of ['armL','armR','head']){const node=parts[key];if(node)node.quaternion.copy(node.userData.restQuaternion);}
 const nod=stage==='acknowledging'?Math.sin(Math.min(Math.max(time,0),1)*Math.PI)*.15:0;
 if(parts.head)parts.head.rotateX((stage==='reading'?.13:nod)*w);
 if(role==='odysseus'){
  const reach=stage==='receiving'?.20:stage==='reading'?-.08:0;
  parts.armR.rotateX(reach*w);parts.armL.rotateX(reach*.6*w);
  if(stage==='acknowledging')parts.armL.rotateZ(-.08*Math.sin(Math.min(time,1)*Math.PI)*w);
 }else if(stage==='acknowledging')parts.armR.rotateX(-.09*Math.sin(Math.min(time,1)*Math.PI)*w);
 root.userData.stage=stage;
}

/** Convenient pair with modest spacing. Attach to the authored meeting anchor. */
export function createGateHeroes(){
 const group=new THREE.Group();group.name='gate-heroes';
 const odysseus=createGateHero('odysseus'),achilles=createGateHero('achilles');
 odysseus.position.set(-.50,0,0);achilles.position.set(.55,0,.12);
 group.add(odysseus,achilles);group.userData.heroes={odysseus,achilles};
 group.userData.setStage=(stage,time=0,weight=1)=>{for(const hero of [odysseus,achilles])setGateHeroStage(hero,stage,time,weight);};
 return group;
}
