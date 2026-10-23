import * as T from 'three';
import {createSwampCliffSampler} from './swampNaturalCliff.js';

// Existing actors only: three branch long-tail monkeys, three chili monkeys and
// the two authoritative mast workers. The original mast/hoist loop is untouched.
export function installSwampMonkeyRepair(inner, {pier} = {}) {
  if (inner.userData.swampMonkeyRepair) return inner.userData.swampMonkeyRepair;
  const workers = inner.userData.shipyard?.workers || [];
  const ordinary = [], chili = [];
  inner.traverse(o => {
    if (o.name === 'swamp-longtail-monkey' && !workers.includes(o)) ordinary.push(o);
    if (o.name === 'swamp-pink-hanger') chili.push(o);
  });
  const quay = (pier?.segments || []).filter(s => s.name === 'cliff-work-quay');
  const report = {version:1, identities:{mastWorkers:workers.length, longTail:ordinary.length, chili:chili.length}, participants:[], enabled:quay.length>0};
  const entries = [], owned = [];
  const wallAt = createSwampCliffSampler(inner);
  const wood = new T.MeshBasicMaterial({color:0x937657});
  const metal = new T.MeshBasicMaterial({color:0x626376});
  const ropeMat = new T.LineBasicMaterial({color:0x72624e});
  function tool(actor, type, arm) {
    const root = new T.Group(); root.name = `swamp-existing-monkey-${type}`;
    const shaft = new T.Mesh(new T.CylinderGeometry(.018,.018,.18,6),wood); shaft.position.y=-.08; root.add(shaft);
    if(type==='mallet') {const head=new T.Mesh(new T.BoxGeometry(.19,.08,.09),metal);head.position.y=-.16;root.add(head);}
    if(type==='carry-timber') {const beam=new T.Mesh(new T.BoxGeometry(.16,.14,1.2),wood);beam.position.y=-.24;root.add(beam);}
    if(arm) {root.position.set(-.064,-.49,.094);arm.add(root);}
    else {root.position.set(.18,.07,-.07);actor.add(root);}
    owned.push(root); return root;
  }
  if(report.enabled) [...ordinary,...chili].forEach((actor,i)=>{
    const hanging = i>=ordinary.length;
    const segment = quay[Math.min(quay.length-1,Math.floor(i*quay.length/(ordinary.length+chili.length)))];
    const station = new T.Vector3(...segment.from).lerp(new T.Vector3(...segment.to),.48);
    const radial = station.clone().setY(0).normalize();
    // Branch monkeys sit on the wall edge; their accepted long tails hang over
    // water. Chili monkeys cling immediately above that edge and pull rigging.
    station.addScaledVector(radial,hanging?.45:.35);
    station.y = hanging ? station.y+2.0 : station.y+.04;
    if(hanging&&wallAt){const face=wallAt(Math.atan2(station.z,station.x),station.y);if(face){station.copy(face).addScaledVector(radial,-.10);}}
    const role=hanging?'rope-check':i%3===0?'mallet':i%3===1?'carry-timber':'rope-haul';
    const arm=actor.userData.armR;
    const prop=tool(actor,role,arm);
    let rope=null;
    if(role.includes('rope')) {rope=new T.Line(new T.BufferGeometry().setFromPoints([station.clone(),station.clone()]),ropeMat);rope.name='swamp-monkey-live-repair-rope';inner.add(rope);owned.push(rope);}
    let workpiece=null;
    if(role==='mallet'){workpiece=new T.Mesh(new T.BoxGeometry(.7,.12,.45),wood);workpiece.name='swamp-monkey-hull-repair-timber';workpiece.position.copy(station).addScaledVector(radial,-.32);workpiece.position.y+=.10;inner.add(workpiece);owned.push(workpiece);}
    const record={uuid:actor.uuid,name:actor.name,species:hanging?'chiliMonkey':'longTailMonkey',role,station:station.toArray(),phase:'inspect'};
    report.participants.push(record);
    entries.push({workpiece,actor,station,radial,prop,rope,hanging,record,index:i, originalPosition:actor.position.clone(),originalQuaternion:actor.quaternion.clone(),armQuaternion:arm?.quaternion.clone()});
    actor.userData.repairParticipant={version:1,role,station:station.toArray()};
  });
  function update(t=0) {
    inner.updateWorldMatrix(true,false);
    for(const e of entries) {
      const {actor,station,radial,hanging,record,prop,rope,index}=e;
      if(actor.userData.dodgeT>0) {prop.visible=false;if(rope)rope.visible=false;record.phase='fruit-dodge';continue;}
      prop.visible=true;if(rope)rope.visible=true;
      const cycle=(t+index*2.1)%12,working=cycle>=2&&cycle<9;
      record.phase=working?e.record.role:cycle<2?'inspect':'check-result';
      actor.position.copy(station);
      // Small supported foot shuffles along the wall, never a lake crossing or
      // new identity substituted for the existing tree and wall actors.
      const tangent=new T.Vector3(-radial.z,0,radial.x);
      actor.position.addScaledVector(tangent,.16*Math.sin(t*.7+index));
      actor.position.y += hanging?.07*Math.sin(t*1.2+index):.035*Math.sin(t*2+index);
      actor.rotation.set(hanging?.08*Math.sin(t+index):0, Math.atan2(-radial.x,-radial.z), hanging?.06*Math.sin(t*.8+index):0);
      for(const [j,arm] of [actor.userData.armL,actor.userData.armR].entries()) {
        if(arm) {arm.rotation.set(-.7-(working?.38*Math.sin(t*3.1+index+j*Math.PI):.05*Math.sin(t)),0,j?-.13:.13);}
      }
      if(hanging) prop.rotation.z=(working?.48:.06)*Math.sin(t*2.8+index);
      actor.updateWorldMatrix(true,true);
      if(e.workpiece&&actor.userData.armR&&working){
        const arm=actor.userData.armR;const target=e.workpiece.position.clone();target.y+=.06;inner.localToWorld(target);actor.worldToLocal(target);
        arm.quaternion.setFromUnitVectors(new T.Vector3(-.064,-.65,.094).normalize(),target.sub(arm.position).normalize());
        arm.rotateX(.24*(.5+.5*Math.sin(t*4.3)));arm.updateWorldMatrix(true,true);
      }
      if(rope) {
        const hand=prop.getWorldPosition(new T.Vector3());inner.worldToLocal(hand);
        const anchor=station.clone().addScaledVector(radial,-.8);anchor.y-=hanging?1.6:.3;
        const p=rope.geometry.attributes.position;p.setXYZ(0,hand.x,hand.y,hand.z);p.setXYZ(1,anchor.x,anchor.y,anchor.z);p.needsUpdate=true;rope.geometry.computeBoundingSphere();
      }
      record.position=actor.position.toArray();record.workTime=t;
    }
  }
  const api={report,update,dispose(){
    for(const e of entries) {e.actor.position.copy(e.originalPosition);e.actor.quaternion.copy(e.originalQuaternion);if(e.armQuaternion)e.actor.userData.armR.quaternion.copy(e.armQuaternion);delete e.actor.userData.repairParticipant;}
    for(const o of owned){o.removeFromParent();o.traverse(c=>{c.geometry?.dispose();});} wood.dispose();metal.dispose();ropeMat.dispose();delete inner.userData.swampMonkeyRepair;
  }};
  inner.userData.swampMonkeyRepair=api;
  update(0);return api;
}
