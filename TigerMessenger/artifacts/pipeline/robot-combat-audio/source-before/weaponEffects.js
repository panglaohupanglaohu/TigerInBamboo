import * as THREE from 'three';
import {puffTexture} from '../../world/citadel/ridgeFlowClouds.js';
// Shared by the proving ground and live fleet defense. Effects never apply damage.
export const WEAPON_VISUALS=Object.freeze({
 sentry:{shots:2,gap:.16,flash:.18,travel:.09},
 locust:{shots:3,gap:.11,flash:.36,travel:.09},
 ant:{shots:1,gap:0,flash:.65,travel:.42},
 beetle:{shots:5,gap:.055,flash:.16,travel:.065}
});
export function createWeaponEffects(root){
 const active=[],pending=[],sphere=new THREE.SphereGeometry(1,8,6),cylinder=new THREE.CylinderGeometry(1,1,1,8),cone=new THREE.ConeGeometry(1,1,8),ring=new THREE.TorusGeometry(1,.04,6,32),white=new THREE.Color(0xffedba);let serial=0;
 const stats={locust:0,ant:0,beetle:0,sentry:0};
 function add(mesh,life,step){mesh.name=mesh.name||'robot-weapon-effect';mesh.userData.noDistanceCulling=true;root.add(mesh);active.push({mesh,life,total:life,step});return mesh;}
 function solid(geometry,color,position,scale,life,step){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));mesh.position.copy(position);mesh.scale.copy(scale);return add(mesh,life,step);}
 function steam(p,up,size,life,drift){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:puffTexture(),color:0xe7e1d3,transparent:true,opacity:.55,depthWrite:false}));m.name='weapon-pressure-steam';m.position.copy(p);m.scale.setScalar(size);add(m,life,(o,t,dt)=>{o.position.addScaledVector(up,dt*.6).addScaledVector(drift,dt*.65);o.scale.setScalar(size*(.6+t*1.7));o.material.opacity=.55*(1-t);});}
 function impact(p,up,kind){const heavy=kind==='ant',count=heavy?11:kind==='locust'?5:2;for(let i=0;i<count;i++){const v=new THREE.Vector3(Math.sin(i*2.4),.4+Math.cos(i)*.2,Math.cos(i*2.4)).multiplyScalar(heavy?2:1);v.add(up);solid(sphere,heavy?0xffa451:0xffcc75,p,new THREE.Vector3().setScalar(heavy?.09:.035),heavy?.45:.20,(o,t,dt)=>{o.position.addScaledVector(v,dt);o.material.opacity=1-t;});}
  if(heavy){const pulse=solid(ring,0xf8d1a0,p,new THREE.Vector3().setScalar(.2),.4,(o,t)=>{o.scale.setScalar(.2+t*1.6);o.material.opacity=(1-t)*.65;});pulse.name='ant-pressure-impact';pulse.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),up);steam(p,up,1.5,.95,new THREE.Vector3());}
 }
 function shot(model,target,index=0){if(!model?.parent||!model.visible)return;const kind=model.userData.robotType;if(!WEAPON_VISUALS[kind])return;stats[kind]++;model.updateWorldMatrix(true,true);
  const muzzle=model.getObjectByName(kind==='beetle'&&index%2?'robot-muzzle-left':'robot-muzzle');
  const from=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):model.localToWorld(new THREE.Vector3(0,1.8,1.4)),to=target.clone(),up=new THREE.Vector3(0,1,0).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion())),direction=to.clone().sub(from).normalize(),right=new THREE.Vector3().crossVectors(up,direction).normalize();
  model.userData.weaponPulse={at:performance.now()/1000,kind,index};
  const spec=WEAPON_VISUALS[kind],flash=solid(cone,white,from.clone().addScaledVector(direction,spec.flash*.5),new THREE.Vector3(spec.flash*.23,spec.flash,spec.flash*.23),kind==='ant'?.12:.065,(o,t)=>{o.material.opacity=1-t;});flash.name=kind+'-muzzle-flash';flash.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().negate());
  if(kind==='ant'){
   for(let i=0;i<5;i++)steam(from.clone().addScaledVector(direction,i*.12),up,.5+i*.13,.65+i*.07,direction);
   const shell=solid(sphere,0xffb660,from,new THREE.Vector3(.11,.11,.19),spec.travel,(o,t)=>{o.position.lerpVectors(from,to,t).addScaledVector(up,Math.sin(t*Math.PI)*.45);});shell.name='ant-pressure-shell';shell.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);active[active.length-1].onEnd=()=>impact(to,up,kind);
  }else{
   const length=kind==='locust'?1.15:.55,width=kind==='locust'?.027:.012;
   const tracer=solid(cylinder,kind==='locust'?0xffd792:0xff973c,from,new THREE.Vector3(width,length,width),spec.travel,(o,t)=>{o.position.lerpVectors(from,to,t);});tracer.name=kind+'-moving-tracer';tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);active[active.length-1].onEnd=()=>impact(to,up,kind);
   if(kind==='locust'){const velocity=right.clone().multiplyScalar(2.2).addScaledVector(up,1.5),shell=solid(cylinder,0xb58c48,from.clone().addScaledVector(direction,-.65),new THREE.Vector3(.035,.14,.035),.8,(o,t,dt)=>{o.position.addScaledVector(velocity,dt);o.position.addScaledVector(up,-3*t*dt);o.rotateX(dt*8);o.rotateZ(dt*5);});shell.name='locust-ejected-case';}
  }
 }
 return{shot,burst(model,target,count=WEAPON_VISUALS[model.userData.robotType]?.shots||1){const kind=model.userData.robotType,spec=WEAPON_VISUALS[kind];if(!spec)return;const id=++serial;shot(model,target,0);for(let i=1;i<count;i++)pending.push({model,target:target.clone(),index:i,wait:i*spec.gap,id});},update(dt){
  for(let i=pending.length-1;i>=0;i--){const p=pending[i];p.wait-=dt;if(p.wait<=0){if(!p.model.userData.dead)shot(p.model,p.target,p.index);pending.splice(i,1);}}
  // Iterate over a snapshot: impact callbacks may append fresh effects.
  for(const p of [...active]){p.life-=dt;if(p.life<=0){p.mesh.removeFromParent();p.mesh.material.dispose();active.splice(active.indexOf(p),1);p.onEnd?.();}else{const t=1-p.life/p.total;p.step?.(p.mesh,t,dt);}}
 },clear(){pending.length=0;for(const p of active){p.mesh.removeFromParent();p.mesh.material.dispose();}active.length=0;},dispose(){this.clear();for(const g of[sphere,cylinder,cone,ring])g.dispose();},get count(){return active.length;},get pendingCount(){return pending.length;},stats};
}
