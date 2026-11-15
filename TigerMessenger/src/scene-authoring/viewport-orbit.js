/** Shared editor camera rig. Only moves the camera and its look-at target. */
export function createViewportOrbit({camera,target,minDistance=.5,maxDistance=2000,onChange=()=>{}}){
 const fov=camera.fov;const center=target.clone(),up=camera.up.clone().normalize(),direction=camera.position.clone().sub(center),distance=direction.length();
 if(!Number.isFinite(distance)||distance<1e-6||up.lengthSq()<.5)throw Error('编辑镜头方向无效');
 direction.normalize();const vertical=Math.max(-1,Math.min(1,direction.dot(up))),base=direction.clone().addScaledVector(up,-vertical);
 if(base.lengthSq()<1e-8){base.set(1,0,0);if(Math.abs(base.dot(up))>.9)base.set(0,0,1);base.addScaledVector(up,-base.dot(up));}base.normalize();
 const state={yaw:0,pitch:Math.asin(vertical),distance};
 const apply=()=>{const v=base.clone().applyAxisAngle(up,state.yaw).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up,Math.sin(state.pitch));camera.position.copy(center).addScaledVector(v,state.distance);camera.up.copy(up);camera.fov=fov;camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);onChange();};
 return{apply,state,target:center,drag(dx,dy,button=2){if(![dx,dy].every(Number.isFinite))return;if(button===1){camera.updateMatrixWorld(true);const right=center.clone().setFromMatrixColumn(camera.matrixWorld,0),screenUp=center.clone().setFromMatrixColumn(camera.matrixWorld,1),scale=state.distance*.0015;center.addScaledVector(right,-dx*scale).addScaledVector(screenUp,dy*scale);}else{state.yaw-=dx*.008;state.pitch=Math.max(-1.5,Math.min(1.5,state.pitch+dy*.006));}apply();},wheel(delta){if(!Number.isFinite(delta))return;state.distance=Math.max(minDistance,Math.min(maxDistance,state.distance*Math.exp(Math.max(-1000,Math.min(1000,delta))*.001)));apply();}};
}
