import * as THREE from 'three';
export function createRobotEffects({root,models,field,point,R}){
 const active=[],pending=[],smokeGeometry=new THREE.IcosahedronGeometry(1,1),sparkGeometry=new THREE.SphereGeometry(1,6,4),muzzleMaterial=new THREE.MeshBasicMaterial({color:0xffe8ab}),steamMaterial=new THREE.MeshLambertMaterial({color:0xdfdfcf,transparent:true,opacity:.5,depthWrite:false});
 function particle(position,{scale=.3,life=.3,steam=false,velocity=new THREE.Vector3()}={}){const mesh=new THREE.Mesh(steam?smokeGeometry:sparkGeometry,steam?steamMaterial:muzzleMaterial);mesh.name='robot-effect';mesh.userData.noDistanceCulling=true;mesh.position.copy(position);mesh.scale.setScalar(scale);root.add(mesh);active.push({mesh,life,total:life,scale,steam,velocity});}
 function sparks(q,count=4){const up=q.clone().normalize(),right=new THREE.Vector3(1,0,0).cross(up).normalize(),forward=new THREE.Vector3().crossVectors(up,right);for(let i=0;i<count;i++){const v=up.clone().multiplyScalar(2).addScaledVector(right,Math.sin(i*2.4)*2).addScaledVector(forward,Math.cos(i*2.4)*2);particle(q,{scale:.075,life:.3,velocity:v});}}
 function trace(e){const a=models.get(e.id),b=models.get(e.target);if(!a||!b)return;a.updateWorldMatrix(true,true);b.updateWorldMatrix(true,true);const muzzle=a.getObjectByName('robot-muzzle'),p=muzzle?muzzle.getWorldPosition(new THREE.Vector3()):a.getWorldPosition(new THREE.Vector3()).addScaledVector(a.position.clone().normalize(),1.8),q=b.getWorldPosition(new THREE.Vector3()).addScaledVector(b.position.clone().normalize(),1.6);
  particle(p,{scale:e.kind==='ant'?.35:.20,life:.10});
  if(e.kind==='ant'){
   const shell=new THREE.Mesh(sparkGeometry,muzzleMaterial);shell.name='robot-pressure-shell';shell.userData.noDistanceCulling=true;shell.scale.setScalar(.16);shell.position.copy(p);root.add(shell);active.push({mesh:shell,life:.35,total:.35,projectile:true,from:p,to:q});particle(p,{scale:.45,life:.6,steam:true,velocity:p.clone().normalize()});
  }else{
   const material=new THREE.LineBasicMaterial({color:0xf4c16f,transparent:true,opacity:.95}),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p,q]),material);line.name='robot-shot';line.userData.noDistanceCulling=true;root.add(line);active.push({mesh:line,life:.09,total:.09,line:true});sparks(q);
  }
 }
 function steam(e){for(let i=0;i<16;i++){const a=i*2.399,r=Math.sqrt(i/16)*5,p=field.localToWorld(point(field,e.x+Math.cos(a)*r,e.z+Math.sin(a)*r,R,1.3));particle(p,{scale:1.6,life:6,steam:true,velocity:p.clone().normalize().multiplyScalar(.28)});}}
 function vent(e){const m=models.get(e.id);if(!m)return;const p=m.getWorldPosition(new THREE.Vector3()),up=p.clone().normalize();p.addScaledVector(up,2.8);for(let i=0;i<6;i++)particle(p.clone().addScaledVector(up,i*.2),{scale:.65,life:2.4,steam:true,velocity:up.clone().multiplyScalar(.7)});}
 function release(p){p.mesh.removeFromParent();if(p.line||p.marker){p.mesh.geometry.dispose();p.mesh.material.dispose();}}
 return{clear(){for(const p of active)release(p);active.length=0;pending.length=0;},emit(e){
  if(e.type==='shot'){trace(e);for(let i=1;i<e.shots;i++)pending.push({event:e,wait:i*(e.kind==='beetle'?.055:.11)});}
  else if(e.type==='steam-screen')steam(e);else if(e.type==='overheat')vent(e);
  else if(e.type==='hit'){const m=models.get(e.target);if(m)sparks(m.getWorldPosition(new THREE.Vector3()).addScaledVector(m.position.clone().normalize(),.7),3);}
  else if(e.type==='scan'){
   const m=models.get(e.target);if(m){const position=m.getWorldPosition(new THREE.Vector3()),up=position.clone().normalize(),marker=new THREE.Mesh(new THREE.TorusGeometry(1.6,.035,5,32),new THREE.MeshBasicMaterial({color:0x8fe0d5,transparent:true,opacity:.9}));marker.name='robot-last-known-marker';marker.userData.noDistanceCulling=true;marker.position.copy(position).addScaledVector(up,.15);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),up);root.add(marker);active.push({mesh:marker,marker:true,life:5,total:5});}
  }
 },update(dt){
  for(let i=pending.length-1;i>=0;i--){pending[i].wait-=dt;if(pending[i].wait<=0){trace(pending[i].event);pending.splice(i,1);}}
  for(let i=active.length-1;i>=0;i--){const p=active[i];p.life-=dt;if(p.life<=0){if(p.projectile){sparks(p.to,9);particle(p.to,{scale:.9,life:.6,steam:true});}release(p);active.splice(i,1);continue;}
   if(p.line||p.marker)p.mesh.material.opacity=p.life/p.total;
   else if(p.projectile){const t=1-p.life/p.total;p.mesh.position.lerpVectors(p.from,p.to,t).addScaledVector(p.from.clone().normalize(),Math.sin(t*Math.PI)*.45);}
   else{p.mesh.position.addScaledVector(p.velocity,dt);const age=1-p.life/p.total;p.mesh.scale.setScalar(p.scale*(p.steam?Math.sin(Math.PI*age)*1.3:p.life/p.total));}
  }
 },get count(){return active.length;}};
}
