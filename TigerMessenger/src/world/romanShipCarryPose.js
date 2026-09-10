import * as THREE from "three";

const HAND = new THREE.Vector3(0, -.138, 0);
const controllers = new WeakMap();
const snapshot = n => ({p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone(),v:n.visible,parent:n.parent});
const restore = (n,s) => {n.position.copy(s.p);n.quaternion.copy(s.q);n.scale.copy(s.s);n.visible=s.v;n.updateMatrix();};

/** Optional deck carry pose. Caller suspends combat/bow animation while active,
 * calls update AFTER other presentation, then restores before resuming combat.
 * Geometry, scale, parenting, weapon ownership and bow-cycle state stay untouched.
 */
export function bindRomanShipCarryPose(actor) {
  if (controllers.has(actor)) return controllers.get(actor);
  const p=actor?.userData?.parts, e=actor?.userData?.equipment;
  if(!p?.armL || !p?.armR || !e) return null;
  const role=e.gladius?'gladius':e.bow?'longbow':e.spear?'spear':null;
  if(!role)return null;
  const touched=[p.body,p.armL,p.armR,p.legL,p.legR,e.shield,e.spear,e.gladius,e.bow,e.limbTop,e.limbBot,e.stringTop,e.stringBot,e.nockedArrow].filter(Boolean);
  // The spear factory has no rear handle. Add a reversible physical grip, not
  // an invisible mathematical anchor. Gladius already owns the approved handle.
  let handle=null;
  if(role==='spear'&&e.shield){
    handle=new THREE.Group();handle.name='ship-carry-shield-handle';handle.visible=false;
    const material=new THREE.MeshToonMaterial({color:0x65492d});
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.074,6),material);
    rod.position.x=-.055;handle.add(rod);
    for(const y of [-.034,.034]){
      const support=new THREE.Mesh(new THREE.BoxGeometry(.042,.012,.015),material);
      support.position.set(-.035,y,0);handle.add(support);
    }
    e.shield.add(handle);
  }
  let saved=null,active=false;
  const grips=[];
  function grip(arm,weapon,localGrip){
    arm.updateWorldMatrix(true,false);weapon.parent.updateWorldMatrix(true,false);
    const hand=arm.localToWorld(HAND.clone());
    const local=weapon.parent.worldToLocal(hand.clone());
    const offset=localGrip.clone().multiply(weapon.scale).applyQuaternion(weapon.quaternion);
    weapon.position.copy(local.sub(offset));weapon.updateMatrix();
    grips.push({arm,weapon,localGrip});
  }
  function update(){
    if(!active)return false;
    if(touched.some(n=>n.parent!==saved.get(n).parent)){setEnabled(false);return false;}
    grips.length=0;
    p.body.rotation.set(0,0,0);
    p.armL.rotation.set(0,0,role==='longbow'?1.45:.22);
    p.armR.rotation.set(0,0,.22);
    p.armL.position.z=.02;p.armR.position.z=-.02;
    p.legL.rotation.set(0,0,.04);p.legR.rotation.set(0,0,-.04);
    if(role!=='longbow'&&e.shield){
      e.shield.rotation.set(0,-Math.PI/2,0);
      grip(p.armL,e.shield,new THREE.Vector3(-.055,0,0));
    }
    if(role==='spear'){
      e.spear.quaternion.identity();
      grip(p.armR,e.spear,new THREE.Vector3(0,-.09,0));
    }else if(role==='gladius'){
      e.gladius.rotation.set(0,0,-Math.PI/2);
      grip(p.armR,e.gladius,new THREE.Vector3(0,.04,0));
    }else{
      e.bow.quaternion.identity();
      grip(p.armL,e.bow,new THREE.Vector3());
      // Resting curved limbs and taut braced string, never a straight stick.
      const bend=.20,tip=.235,x=-tip*Math.sin(bend),y=tip*Math.cos(bend);
      e.limbTop.rotation.z=bend;e.limbBot.rotation.z=-bend;
      for(const [segment,endY] of [[e.stringTop,y],[e.stringBot,-y]]){
        const dx=-.014-x,dy=-endY;
        segment.position.set((x-.014)/2,endY/2,0);
        segment.rotation.set(0,0,-Math.atan2(dx,dy));
        segment.scale.y=Math.hypot(dx,dy)/.22;
      }
      e.nockedArrow.visible=false;
    }
    actor.updateWorldMatrix(true,true);return true;
  }
  function setEnabled(value){
    value=!!value;if(value===active)return true;
    if(value){saved=new Map(touched.map(n=>[n,snapshot(n)]));active=true;if(handle)handle.visible=true;update();}
    else{for(const [n,s]of saved)restore(n,s);active=false;if(handle)handle.visible=false;actor.updateWorldMatrix(true,true);}
    return true;
  }
  const controller={actor,role,setEnabled,update,get active(){return active;},
    gripErrors(){actor.updateWorldMatrix(true,true);return grips.map(({arm,weapon,localGrip})=>arm.localToWorld(HAND.clone()).distanceTo(weapon.localToWorld(localGrip.clone())));},
    dispose(){setEnabled(false);if(handle){const mats=new Set();handle.traverse(n=>{if(n.isMesh){n.geometry.dispose();mats.add(n.material);}});mats.forEach(m=>m.dispose());handle.removeFromParent();}controllers.delete(actor);}};
  controllers.set(actor,controller);return controller;
}
