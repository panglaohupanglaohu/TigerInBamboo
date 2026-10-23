import * as T from 'three';

// A visible bedside representation borrowing the existing soldier geometry.
// The authoritative casualty stays reserved aboard its original carrier.
function patientCopy(source) {
 const copy=node=>{const out=node.isMesh?new T.Mesh(node.geometry,node.material):node.isLineSegments?new T.LineSegments(node.geometry,node.material):new T.Group();out.name=node.name;out.position.copy(node.position);out.quaternion.copy(node.quaternion);out.scale.copy(node.scale);out.visible=node.isMesh&&!node.material?.transparent?true:node.visible;out.frustumCulled=false;for(const child of node.children)if(!child.userData.transientFx&&child!==source.userData.parts?.gun&&child!==source.userData.parts?.blade)out.add(copy(child));return out;};
 const root=copy(source);root.position.set(0,0,0);root.quaternion.identity();root.visible=true;
 root.traverse(o=>{if(/laser|blade|bolt|gun/i.test(o.name))o.visible=false;});return root;
}
export function createBatianSwampTreatment(){
 const entries=new Map(),free=[],owned=[],root=new T.Group();root.name='heiwa-casualty-treatment';root.userData.noDistanceCulling=true;
 function mesh(geometry,color){const material=new T.MeshBasicMaterial({color});owned.push(geometry,material);return new T.Mesh(geometry,material);}
 function show(job,healer,record,progress){
  if(!root.parent){healer.parent.add(root);root.position.fromArray(healer.userData.heiwaTreatmentPoint||[healer.position.x,healer.position.y,healer.position.z+4]);}
  let e=entries.get(job);
  if(!e&&free.length){e=free.pop();entries.set(job,e);}
  if(!e){const bed=new T.Group();bed.name='heiwa-treatment-stretcher';bed.position.x=entries.size*3.6-3.6;root.add(bed);const platform=mesh(new T.BoxGeometry(3.4,.16,2.8),0x8b8268);platform.position.y=-.18;bed.add(platform);const mattress=mesh(new T.BoxGeometry(2.9,.18,1.15),0x526c6e);bed.add(mattress);const bar=mesh(new T.BoxGeometry(2.6,.08,.08),0x6ffff0);bar.position.set(0,.85,-.72);bed.add(bar);const ring=mesh(new T.RingGeometry(.26,.32,24),0x8ffff1);ring.rotation.x=-Math.PI/2;bed.add(ring);const beam=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x9affed,transparent:true,opacity:.8}));owned.push(beam.geometry,beam.material);root.add(beam);e={bed,bar,ring,beam};entries.set(job,e);}
  if(e.record!==record){e.proxy?.removeFromParent();e.proxy=patientCopy(record.tr);e.proxy.scale.copy(record.tr.getWorldScale(new T.Vector3())).divide(root.getWorldScale(new T.Vector3()));e.proxy.rotation.z=-Math.PI/2;e.proxy.position.set(-1.18,.35,0);e.bed.add(e.proxy);e.record=record;}
  e.bar.scale.x=Math.max(.02,progress);e.bar.position.x=-1.3+1.3*progress;e.ring.position.set(.2,.55,0);e.ring.rotation.z+=.05;e.ring.visible=job.focused===true;e.beam.visible=job.focused===true;
  if(job.focused){const target=e.bed.position.clone().add(new T.Vector3(0,.05,1.1)).add(root.position);healer.userData.healingTargetLocal=target.toArray();const from=root.worldToLocal(healer.localToWorld(new T.Vector3(0,.8,.2))),to=e.bed.position.clone().add(new T.Vector3(.2,.55,0)),p=e.beam.geometry.attributes.position;p.setXYZ(0,...from.toArray());p.setXYZ(1,...to.toArray());p.needsUpdate=true;}
  e.bed.visible=true;return e;
 }
 function hide(job){const e=entries.get(job);if(!e)return;e.bed.visible=false;e.beam.visible=false;e.proxy?.removeFromParent();e.record=null;entries.delete(job);free.push(e);}
 return{show,hide,root,dispose(){root.removeFromParent();for(const resource of owned)resource.dispose();entries.clear();}};
}
