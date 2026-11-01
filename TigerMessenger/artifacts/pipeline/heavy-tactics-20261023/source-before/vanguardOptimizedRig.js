import * as THREE from 'three';

// Original Blender IK assembly port. Original arm/leg Euler objects remain the
// gameplay command inputs; only their evaluated matrices drive the refined rig.
export function createVanguardRig(controller) {
  const {root,nodes,meta}=controller,parts=root.userData.parts;
  const originals=new Map(),driven=new Map(),up=new THREE.Vector3(0,1,0);
  const drivers=['n27','n47','n64','n74'];
  let enabled=false,busy=false,last='',forced=null;
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  function set(id,position,quaternion=new THREE.Quaternion(),scale=V(1,1,1)) {
    const node=nodes.get(id);if(!node)return;
    const matrix=new THREE.Matrix4().compose(position,quaternion,scale);
    if(driven.has(id)){driven.get(id).copy(matrix);node.matrix.copy(matrix);node.matrixWorldNeedsUpdate=true;}
    else{matrix.decompose(node.position,node.quaternion,node.scale);node.updateMatrix();}
  }
  function orient(id,position,axis){set(id,position,new THREE.Quaternion().setFromUnitVectors(up,axis.clone().normalize()));}
  function segment(id,start,end,length,coverage=1) {
    const delta=end.clone().sub(start);
    set(id,start.clone().add(end).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize()),V(1,delta.length()*coverage/length,1));
  }
  function arm(side,target,axis) {
    const L=side==='L',ids=L?['n27','n28','n30','n32','n34',['n36','n37','n38']]:['n47','n48','n50','n52','n54',['n56','n57','n58']];
    const shoulder=V(L?.21:-.21,1.12,0),dest=target.clone().sub(shoulder),direction=dest.clone().normalize();
    const length=Math.max(.245,dest.length()*.51),half=dest.length()/2,h=Math.sqrt(Math.max(0,length*length-half*half));
    const hint=L?V(1,-1,.12):V(-1,-.2,-.6);hint.addScaledVector(direction,-hint.dot(direction)).normalize();
    const elbow=direction.clone().multiplyScalar(half).addScaledVector(hint,h),fore=dest.clone().sub(elbow).normalize();
    set(ids[0],shoulder);segment(ids[2],V(0,0,0),elbow,.20,.73);
    segment(ids[3],elbow.clone().addScaledVector(fore,.025),dest.clone().addScaledVector(fore,-.10),.20);
    set(ids[1],V(0,-.013,0),new THREE.Quaternion().setFromAxisAngle(V(0,0,1),L?.12:-.12));
    const hinge=elbow.clone().cross(dest.clone().sub(elbow)).normalize();
    orient('add:'+side+'-shoulder',V(0,-.065,0),hinge);orient('add:'+side+'-elbow',elbow,hinge);
    orient('add:'+side+'-wrist',dest.clone().addScaledVector(fore,-.05),fore);
    ids[5].forEach((id,i)=>orient(id,elbow.clone().multiplyScalar(.28+i*.17),elbow));
    const y=axis.clone().normalize(),x=dest.clone().sub(elbow).addScaledVector(y,-dest.clone().sub(elbow).dot(y)).normalize(),z=x.clone().cross(y).normalize();
    set(ids[4],dest,new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)));
  }
  function leg(side,bend,walk) {
    const L=side==='L',ids=L?['n64','n65','n67','n68','n70','n72']:['n74','n75','n77','n78','n80','n82'];
    const knee=V(L?.022:-.022,-.29,.025),ankle=knee.clone().add(V(0,-.285*Math.cos(bend),-.285*Math.sin(bend)));
    set(ids[0],V(L?.135:-.135,.70,0),new THREE.Quaternion().setFromAxisAngle(V(1,0,0),walk));
    segment(ids[1],V(0,0,0),knee,.26,.85);orient(ids[2],knee.clone().multiplyScalar(.34),knee);
    segment(ids[4],knee,ankle,.24,.80);set(ids[3],knee.clone().add(V(0,0,.055)),new THREE.Quaternion(),V(1,1,.55));
    set(ids[5],ankle.clone().add(V(0,-.046,.035)));
    orient('add:'+side+'-knee',knee,V(1,0,0));orient('add:'+side+'-ankle',ankle,V(1,0,0));set('add:'+side+'-kneecap',knee.clone().add(V(0,0,.093)));
  }
  function update(command) {
    if(command!==undefined){forced=command?.action?command:null;last='';}
    if(!enabled||busy)return;
    const u=root.userData,left=parts.armL.rotation.x,right=parts.armR.rotation.x;
    const walking=Math.abs(left)<.6 && Math.abs(right)<.7;
    const rope=u.climbing || (u.onGround===false && !u.aboard && u.vehicleSlot?.kind==='pod');
    const anim=u._swingAnim,attacking=Number.isFinite(anim)&&anim<1;
    const action=forced?.action || (u.dead||u.downed?'stagger':rope?'rope':attacking?(anim<.3?'windup':'slash'):walking?'walk':left> -1.9 && left<-.6?'aim':'idle');
    const gunScale=parts.gun.scale.clone();
    const signature=[action,left,right,parts.legL.rotation.x,parts.legR.rotation.x,forced?.swing,forced?.walk,anim,...gunScale.toArray()].join('|');
    if(signature===last)return;last=signature;busy=true;
    try {
      let direction=V(0,.95,.312),target=V(-.34,.765,.22),bladeAxis=V(.02,-.925,.38),bend=.08,lean=0,drop=0;
      if(action==='aim'||(!forced&&left> -1.9&&left<-.6))direction.set(0,0,1);
      if(action==='stagger'){target.set(-.38,.85,.20);bladeAxis.set(-.25,-.90,.36);bend=.38;lean=-.08;drop=-.018;}
      if(action==='rope'){target.set(-.31,.75,.18);bladeAxis.set(.02,-.925,.38);}
      if(action==='walk'){target.z+=right*.08;target.y+=Math.abs(right)*.015;}
      let swing=forced?.swing ?? (!walking?THREE.MathUtils.clamp(Math.abs(right+1.05)/1.8,0,1):0);
      if(action==='slash')swing=forced?.swing ?? (attacking?THREE.MathUtils.clamp((anim-.3)/.7,0,1):1);
      if(swing>0 && action!=='rope' && action!=='stagger') {
        target.lerp(V(-.32,.80,.38),swing);bladeAxis.lerp(V(.25,-.83,.50),swing);bend+=swing*.12;
      }
      if(action==='windup'){target.set(-.33,1.14,.30);bladeAxis.set(-.08,.90,.42);}
      direction.normalize();bladeAxis.normalize();set('n1',V(0,drop,0),new THREE.Quaternion().setFromAxisAngle(V(1,0,0),lean));
      const origin=V(.255,1.46,-.085),gunQ=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),direction);
      const gunGrip=V(0,-.11,-.12).multiply(gunScale).applyQuaternion(gunQ).add(origin);
      const leftTarget=action==='rope'?V(.47,1.48,.14):gunGrip;
      const leftAxis=action==='rope'?V(0,1,0):V(0,1,0).applyQuaternion(gunQ);
      arm('L',leftTarget,leftAxis);arm('R',target,bladeAxis);
      set('n39',origin.clone().sub(V(.21,1.12,0)),gunQ,gunScale);
      set('n59',target.clone().sub(V(-.21,1.12,0)),new THREE.Quaternion().setFromUnitVectors(V(1,0,0),bladeAxis));
      set('add:rope-grip',leftTarget);
      const stationary=forced?.walk===0 || (!walking && action!=='walk');
      leg('L',bend,stationary?0:parts.legL.rotation.x);
      leg('R',-bend*.45,stationary?0:parts.legR.rotation.x);
      meta.action=action;meta.liveRig=true;meta.leftHandRole=action==='rope'?'rope':'gun grip';
    } finally {busy=false;}
  }
  return {
    enable() {
      if(enabled)return;enabled=true;last='';
      for(const id of drivers) {
        const node=nodes.get(id);originals.set(id,node.updateMatrix);driven.set(id,new THREE.Matrix4());
        node.updateMatrix=function(){originals.get(id).call(this);if(enabled){this.matrix.copy(driven.get(id));this.matrixWorldNeedsUpdate=true;}};
      }
    },
    disable() {
      if(!enabled)return;enabled=false;
      for(const id of drivers){const node=nodes.get(id);node.updateMatrix=originals.get(id);node.updateMatrix();}
      driven.clear();last='';
    },update,
  };
}
