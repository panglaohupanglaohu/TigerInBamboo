import * as THREE from 'three';
import {SWAMP_RIM_OUTER_MAX} from './swampCoralRim.js';

// 湖沼专用镜头（第一步：距离、抬高、沿步道跟随）。方案与组长评估见 docs/greg-team/SWAMP_CAMERA_PLAN.md。
// 只通过 cameraRig 的公开接口（setDist / setFollowProfile）工作，不改相机核心：
//   * 坑缘步道：距离 5.0、抬高 +0.8，前进方向与步道切线夹角 ≤55° 时镜头沿切线跟在身后（70%），并向坑外偏 12° 让湖面进画；
//   * 坑内台阶/岸台：距离 4.5、抬高 +1.2，跟随朝向；
//   * 其他地方、骑乘、第一人称、特写：不生效，并把玩家原来的缩放还回去。
// 进出 0.8 秒平滑；偏航变化限速 30°/秒（不按转向键时）。?swampCam=0 关闭。
const RIM={dist:5.0,height:.8},PIT={dist:4.5,height:1.2};
const CONE=Math.cos(55*Math.PI/180),TANGENT_MIX=.7,OUTWARD=12*Math.PI/180,MAX_YAW_RATE=30*Math.PI/180;
export function createSwampCameraProfile({cameraRig,player,getZone,isBusy=()=>false,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampCam')!=='0'}={}){
  const report={enabled,version:1,zone:'none',weight:0,dist:null,yaw:0,height:0};
  const local=new THREE.Vector3(),q=new THREE.Quaternion(),qi=new THREE.Quaternion(),fwd=new THREE.Vector3(),
    back=new THREE.Vector3(),target=new THREE.Vector3(),radial=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),c=new THREE.Vector3();
  let weight=0,rimMix=0,yaw=0,userDist=null,lastSet=null,active=false,override=null;
  const smooth=(x)=>x*x*(3-2*x);
  function classify(){
    const zone=getZone?.();if(!zone)return null;
    zone.updateWorldMatrix(true,false);local.copy(player.position);zone.worldToLocal(local);
    const r=Math.hypot(local.x,local.z),y=local.y;
    // 0..1 weights with soft edges (inner units)
    const rim=smooth(THREE.MathUtils.clamp((r-33.5)/1.5,0,1))*smooth(THREE.MathUtils.clamp((SWAMP_RIM_OUTER_MAX+2-r)/1.5,0,1))*smooth(THREE.MathUtils.clamp((y-36.5)/1.5,0,1))*smooth(THREE.MathUtils.clamp((46-y)/1.5,0,1));
    const pit=smooth(THREE.MathUtils.clamp((36.5-r)/1.5,0,1))*smooth(THREE.MathUtils.clamp((y-3)/1.5,0,1))*smooth(THREE.MathUtils.clamp((39.5-y)/1.5,0,1));
    return {zone,r,rim,pit:Math.max(0,pit*(1-rim))};
  }
  function release(){
    if(active&&userDist!=null&&override==null&&cameraRig.getDist&&Math.abs(cameraRig.getDist()-lastSet)<1e-3)cameraRig.setDist(userDist);
    cameraRig.setFollowProfile?.(null);active=false;userDist=null;lastSet=null;override=null;yaw=0;weight=0;rimMix=0;
  }
  return {report,update(dt){
    if(!report.enabled){if(active)release();return;}
    const busy=isBusy()||player.riding||cameraRig.isFirstPerson?.()||cameraRig.isCloseup?.();
    // Vehicles / first person own the camera: drop our state without touching their profile or zoom.
    if(busy){if(active){active=false;userDist=null;lastSet=null;override=null;yaw=0;weight=0;rimMix=0;}report.zone='busy';report.weight=0;return;}
    const z=busy?null:classify();
    const want=z?Math.min(1,z.rim+z.pit):0;
    const k=1-Math.exp(-dt/0.27);// ~0.8 s to settle
    weight+=(want-weight)*k;
    if(!active&&weight<.01){report.zone='none';report.weight=0;return;}
    if(weight<.005&&want===0){release();report.zone='none';report.weight=0;return;}
    if(!active){active=true;userDist=cameraRig.getDist();lastSet=null;}
    // the player zoomed with the wheel while inside: take it as the new base
    if(lastSet!=null&&Math.abs(cameraRig.getDist()-lastSet)>1e-3)override=cameraRig.getDist();
    const rimShare=z?(z.rim+z.pit>0?z.rim/(z.rim+z.pit):rimMix):rimMix;rimMix+=(rimShare-rimMix)*k;
    const zoneDist=PIT.dist+(RIM.dist-PIT.dist)*rimMix,zoneHeight=PIT.height+(RIM.height-PIT.height)*rimMix;
    const dist=override??(userDist+(Math.min(zoneDist,userDist)-userDist)*weight);
    cameraRig.setDist(dist);lastSet=cameraRig.getDist();
    // yaw: follow the walkway tangent behind the courier on the rim
    let wantYaw=0;
    if(z&&z.rim>.05&&player.forward){
      z.zone.getWorldQuaternion(q);qi.copy(q).invert();
      fwd.copy(player.forward).applyQuaternion(qi);fwd.y=0;
      if(fwd.lengthSq()>1e-6){
        fwd.normalize();radial.set(local.x,0,local.z).normalize();tangent.set(-radial.z,0,radial.x);
        const along=fwd.dot(tangent);
        if(Math.abs(along)>=CONE){
          back.copy(fwd).negate();
          target.copy(tangent).multiplyScalar(-Math.sign(along)).multiplyScalar(TANGENT_MIX).addScaledVector(back,1-TANGENT_MIX).normalize();
          // lean the camera a little outward so the lake shows beside the courier
          target.applyAxisAngle(up,Math.sign(c.crossVectors(target,radial).y)*OUTWARD).normalize();
          c.crossVectors(back,target);wantYaw=Math.atan2(c.y,back.dot(target))*z.rim;
        }
      }
    }
    const step=THREE.MathUtils.clamp(wantYaw-yaw,-MAX_YAW_RATE*dt,MAX_YAW_RATE*dt);yaw+=step;
    cameraRig.setFollowProfile?.({yaw:yaw*weight,height:zoneHeight*weight});
    Object.assign(report,{zone:z?(z.rim>=z.pit?'rim':'pit'):'leaving',weight:+weight.toFixed(3),dist:+dist.toFixed(2),yaw:+(yaw*weight).toFixed(3),height:+(zoneHeight*weight).toFixed(2)});
  },release};
}
