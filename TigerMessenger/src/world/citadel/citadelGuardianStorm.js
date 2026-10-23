import * as T from 'three';
import {sfxThunder} from '../../audio/sfx.js';
/** Local rolling storm. Never writes the global weather or clock. */
export function createCitadelGuardianStorm({scene,origin,quaternion,getListenerPosition,thunder=sfxThunder}={}){
 const group=new T.Group();group.name='citadel-guardian-local-storm';group.position.copy(origin);group.quaternion.copy(quaternion);scene.add(group);
 const material=new T.MeshStandardMaterial({color:0x64717c,roughness:1,transparent:true,opacity:0,depthWrite:false}),geo=new T.SphereGeometry(1,10,7),clouds=new T.InstancedMesh(geo,material,32);clouds.frustumCulled=false;group.add(clouds);
 const boltGeo=new T.BufferGeometry(),positions=new Float32Array(12*6);boltGeo.setAttribute('position',new T.BufferAttribute(positions,3));
 const boltMat=new T.LineBasicMaterial({color:0xcfeaff,transparent:true,opacity:0,depthWrite:false}),bolt=new T.LineSegments(boltGeo,boltMat);bolt.frustumCulled=false;scene.add(bolt);
 const state={intensity:0,flash:0,active:false,local:true,globalWeatherModified:false};let time=0,disposed=false;const dummy=new T.Object3D();
 function strike(a,b){
  if(disposed)return;const delta=b.clone().sub(a),side=new T.Vector3().crossVectors(delta,a.clone().normalize()).normalize();
  let last=a.clone();for(let i=1;i<=12;i++){const p=a.clone().lerp(b,i/12);if(i<12)p.addScaledVector(side,Math.sin(i*7.13+time)*.45);positions.set([...last.toArray(),...p.toArray()],(i-1)*6);last=p;}
  boltGeo.attributes.position.needsUpdate=true;state.flash=1;bolt.visible=true;
  const listener=getListenerPosition?.();thunder?.({distance:listener?.isVector3?listener.distanceTo(b):18});
 }
 function update(dt,active){if(disposed)return;time+=dt;state.active=!!active;const target=active?1:0;state.intensity=T.MathUtils.damp(state.intensity,target,active?.8:1.5,dt);state.flash=Math.max(0,state.flash-dt*4);group.visible=state.intensity>.005;material.opacity=state.intensity*.92;boltMat.opacity=state.flash;bolt.visible=state.flash>0;
  for(let i=0;i<32;i++){const a=i*2.39996+time*.021,r=8+((i*17)%25);dummy.position.set(Math.cos(a)*r,24+Math.sin(i*1.8+time*.11)*2.2,Math.sin(a)*r*.75);dummy.scale.set(6+(i%3),3+(i%4)*.35,5+(i%5)*.5);dummy.rotation.set(Math.sin(time*.06+i)*.1,time*.027+i,0);dummy.updateMatrix();clouds.setMatrixAt(i,dummy.matrix);}clouds.instanceMatrix.needsUpdate=true;
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();bolt.removeFromParent();geo.dispose();material.dispose();boltGeo.dispose();boltMat.dispose();state.intensity=state.flash=0;state.active=false;}
 group.visible=bolt.visible=false;return{group,state,strike,update,dispose};
}
