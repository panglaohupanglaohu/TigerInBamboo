import * as THREE from 'three';

// Traditional landing troops only. This controller never starts a fleet assault.
export function createSaihojiAmbush({getCoverPoints,projectGround=null,onEvent=()=>{}}={}) {
  const records=new Map(),events=[];
  const state={stage:'landing',discovery:null,blocked:null,settleSeconds:1.6,registered:0,concealed:0};
  let clock=0,previousStage='landing';
  const target=new THREE.Vector3(),world=new THREE.Vector3(),up=new THREE.Vector3(),heading=new THREE.Vector3(),side=new THREE.Vector3(),matrix=new THREE.Matrix4();
  function point(cover,out) {
    if(cover?.anchor&&cover.localPoint){let root=cover.anchor;while(root.parent)root=root.parent;if(!root.isScene)return null;return cover.anchor.localToWorld(out.copy(cover.localPoint));}
    if(cover?.point)return out.copy(cover.point);
    return null;
  }
  function posture(record,crouched) {
    const {unit,body,bodyY,legs}=record;
    if(body)body.position.y=bodyY-(crouched ? .065 : 0);
    for(const {node,x,z} of legs)if(node){node.rotation.x=x;node.rotation.z=z+(crouched ? .35 : 0);}
    unit.userData.ambushConcealed=!!crouched;
  }
  function stage(next,evidence) {
    if(state.stage===next)return;
    state.stage=next;const event={from:previousStage,to:next,seconds:clock,...(evidence?{evidence}: {})};previousStage=next;
    events.push(event);if(events.length>16)events.shift();onEvent(event);
  }
  function register(unit,covers,claimed) {
    unit.getWorldPosition(world);
    let cover=null,dist=Infinity;
    for(const candidate of covers){if(claimed.has(candidate.id)||(Number.isFinite(candidate.clearance)&&candidate.clearance<1.10))continue;const p=point(candidate,target);if(!p)continue;const d=p.distanceToSquared(world);if(d<dist){dist=d;cover=candidate;}}
    if(!cover)return null;claimed.add(cover.id);
    const parts=unit.userData.parts||{},body=parts.body;
    const record={unit,cover,age:0,ready:false,previousTarget:null,body,bodyY:body?.position.y??0,legs:['legL','legR'].map(k=>({node:parts[k],x:parts[k]?.rotation.x||0,z:parts[k]?.rotation.z||0}))};
    unit.userData.ambushCoverId=cover.id;unit.userData.ambushStage='landing';records.set(unit,record);return record;
  }
  return {
    state,events,
    applyConcealmentPose(){if(state.stage!=='ambush')for(const r of records.values())if(r.ready&&r.unit.parent&&!r.unit.userData.dead&&!r.unit.userData.downed)posture(r,true);},
    get active(){return state.stage==='ambush';},
    update(dt,{units=[],allLanded=false,discovery=null}={}) {
      clock+=Math.max(0,dt);if(state.stage==='ambush')return;
      const living=units.filter(s=>s.parent&&!s.userData.dead&&!s.userData.downed);
      const covers=getCoverPoints?.()||[],claimed=new Set([...records.values()].map(r=>r.cover.id));
      state.blocked=null;
      for(const unit of living) {
        const record=records.get(unit)||register(unit,covers,claimed);
        if(!record){state.blocked='cover-capacity';continue;}
        record.age+=dt;
        if(!point(record.cover,target)){record.ready=false;state.blocked='cover-detached';continue;}
        unit.getWorldPosition(world);
        // Carry only an actor already settled on this moving island. A troop
        // still approaching cannot inherit the whale's vertical displacement.
        if(record.ready&&record.previousTarget)world.add(target.clone().sub(record.previousTarget));
        record.previousTarget=target.clone();
        const distance=world.distanceTo(target),maxStep=3.4*dt;
        // Brief disordered steps end after 1.6s; movement to cover stays physical.
        if(record.age<state.settleSeconds) {
          up.copy(world).normalize();heading.copy(target).sub(world);side.crossVectors(heading,up).normalize();
          target.addScaledVector(side,Math.sin(record.age*9+(unit.userData.uid||0))*.12*(1-record.age/state.settleSeconds));
        }
        if(distance>maxStep)world.lerp(target,maxStep/distance);else world.copy(target);
        // The final cover slot already has a sampled foot offset; do not fight
        // it with the legacy marching sampler's different ground skin.
        if(distance>.6)projectGround?.(world,record.cover);
        unit.position.copy(world);unit.parent.worldToLocal(unit.position);
        up.copy(world).normalize();
        if(distance<.6&&record.cover.anchor)up.set(0,1,0).applyQuaternion(record.cover.anchor.getWorldQuaternion(new THREE.Quaternion())).normalize();
        heading.copy(target).sub(world);heading.addScaledVector(up,-heading.dot(up));
        if(heading.lengthSq()<1e-8)heading.set(1,0,0).applyQuaternion(unit.getWorldQuaternion(new THREE.Quaternion())).addScaledVector(up,-heading.dot(up));
        if(heading.lengthSq()>1e-8){heading.normalize();side.crossVectors(heading,up).normalize();matrix.makeBasis(heading,up,side);unit.quaternion.setFromRotationMatrix(matrix);if(unit.parent)unit.quaternion.premultiply(unit.parent.getWorldQuaternion(new THREE.Quaternion()).invert());}
        record.ready=distance<.09&&record.age>=state.settleSeconds;
        posture(record,record.ready);unit.userData.ambushStage=record.ready?'concealed':'landing';
      }
      state.registered=living.length;state.concealed=living.filter(u=>records.get(u)?.ready).length;
      if(state.stage==='landing'&&allLanded&&living.length>0&&state.concealed===living.length&&!state.blocked)stage('concealed');
      // Discovery is provided by actual whale/fleet state, never elapsed time.
      else if(state.stage==='concealed'&&discovery?.detected) {state.discovery={...discovery,seconds:clock};stage('discovered',state.discovery);}
      else if(state.stage==='discovered') {
        stage('ambush');for(const record of records.values()){if(!record.unit.userData.dead&&!record.unit.userData.downed)posture(record,false);record.unit.userData.ambushStage='ambush';record.unit.userData.patrol=null;}
      }
    },
    reset(){for(const r of records.values()){posture(r,false);delete r.unit.userData.ambushStage;delete r.unit.userData.ambushCoverId;}records.clear();events.length=0;clock=0;previousStage='landing';Object.assign(state,{stage:'landing',discovery:null,blocked:null,registered:0,concealed:0});},
  };
}
