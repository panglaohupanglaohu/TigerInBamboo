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
export function createSwampCameraProfile({cameraRig,player,getZone,camera=null,getTerrain=()=>null,isBusy=()=>false,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampCam')!=='0'}={}){
  const report={enabled,version:1,zone:'none',weight:0,dist:null,yaw:0,height:0};
  const local=new THREE.Vector3(),q=new THREE.Quaternion(),qi=new THREE.Quaternion(),fwd=new THREE.Vector3(),
    back=new THREE.Vector3(),target=new THREE.Vector3(),radial=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),c=new THREE.Vector3();
  let sideBias=0,weight=0,rimMix=0,yaw=0,userDist=null,lastSet=null,active=false,override=null,lift=0,liftWant=0,liftClock=0;
  // Terrain clearance: around the entrance the camera sits behind the courier over the rising canyon slope
  // (planet surface). Keep it above that surface instead of letting it sink into the hill.
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(),from=new THREE.Vector3(),hitLocal=new THREE.Vector3();
  const side=new THREE.Vector3(),back2=new THREE.Vector3(),probe=new THREE.Vector3(),camUp=new THREE.Vector3();
  function terrainAt(p,zone,terrain){
    down.copy(p).normalize();from.copy(down).multiplyScalar(p.length()+25);ray.set(from,down.clone().negate());ray.far=40;
    for(const h of ray.intersectObject(terrain,false)){
      hitLocal.copy(h.point);zone.worldToLocal(hitLocal);const r=Math.hypot(hitLocal.x,hitLocal.z);
      if((r<35.5&&hitLocal.y>4)||(r<SWAMP_RIM_OUTER_MAX+1&&hitLocal.y>38.6))continue;// clipped away inside the swamp column
      return h.point.length();
    }
    return null;
  }
  // >0: the camera (or the ground just beside / behind it) is above the clearance line by that much too little.
  function terrainDeficit(zone){
    const terrain=getTerrain?.();if(!terrain||!camera)return -99;
    const camR=camera.position.length();camUp.copy(camera.position).normalize();
    // only when the camera itself hangs outside the walkway, over the canyon slope (e.g. entrance, facing in)
    hitLocal.copy(camera.position);zone.worldToLocal(hitLocal);if(Math.hypot(hitLocal.x,hitLocal.z)<SWAMP_RIM_OUTER_MAX-.5){sideBias=0;return -99;}
    side.set(1,0,0).applyQuaternion(camera.quaternion);side.addScaledVector(camUp,-side.dot(camUp)).normalize();
    back2.set(0,0,1).applyQuaternion(camera.quaternion);back2.addScaledVector(camUp,-back2.dot(camUp)).normalize();
    let worst=-99;const ts=[];
    for(const [s,b] of [[0,0],[-3,0],[3,0],[0,2]]){
      probe.copy(camera.position).addScaledVector(side,s).addScaledVector(back2,b);
      const t=terrainAt(probe,zone,terrain);ts.push(t);if(t!==null)worst=Math.max(worst,t+.9-camR);
    }
    // swing a little away from the higher slope (positive yaw = towards the courier's right)
    const tl=ts[1]??camR-9,tr=ts[2]??camR-9;sideBias=THREE.MathUtils.clamp((tl-tr)/2.5,-1,1)*.45;
    return worst;
  }
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
    cameraRig.setFollowProfile?.(null);active=false;userDist=null;lastSet=null;override=null;yaw=0;weight=0;rimMix=0;lift=0;liftWant=0;sideBias=0;
  }
  return {report,update(dt){
    if(!report.enabled){if(active)release();return;}
    const busy=isBusy()||player.riding||cameraRig.isFirstPerson?.()||cameraRig.isCloseup?.();
    // Vehicles / first person own the camera: drop our state without touching their profile or zoom.
    if(busy){if(active){active=false;userDist=null;lastSet=null;override=null;yaw=0;weight=0;rimMix=0;lift=0;liftWant=0;sideBias=0;}report.zone='busy';report.weight=0;return;}
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
    // The entrance treads descend radially at angle .5. A terrain side bias
    // rotates camera-relative W off this narrow stair into the rim wall.
    // Keep slope clearance lift, but follow the courier straight on this entry.
    const entryAngle=Math.abs(Math.atan2(Math.sin(Math.atan2(local.z,local.x)-.5),Math.cos(Math.atan2(local.z,local.x)-.5)));
    const entryStairs=z&&entryAngle<.13&&z.r>=24&&z.r<=44&&player.forward&&fwd.copy(player.forward).applyQuaternion(z.zone.getWorldQuaternion(q).invert()).setY(0).normalize().dot(radial.set(local.x,0,local.z).normalize())<-.6;
    wantYaw+=entryStairs?0:sideBias*(z?z.rim:0);
    const step=THREE.MathUtils.clamp(wantYaw-yaw,-MAX_YAW_RATE*dt,MAX_YAW_RATE*dt);yaw+=step;
    liftClock-=dt;if(liftClock<=0&&z){liftClock=.25;const d=terrainDeficit(z.zone);if(d>0)liftWant=Math.min(4,lift+d);else if(d<-1.2)liftWant=Math.max(0,lift-Math.min(.4,-d-1.2));}
    lift+=(liftWant-lift)*Math.min(1,dt*4);
    cameraRig.setFollowProfile?.({yaw:yaw*weight,height:(zoneHeight+lift)*weight});
    Object.assign(report,{lift:+lift.toFixed(2),zone:z?(z.rim>=z.pit?'rim':'pit'):'leaving',weight:+weight.toFixed(3),dist:+dist.toFixed(2),yaw:+(yaw*weight).toFixed(3),height:+(zoneHeight*weight).toFixed(2)});
  },release};
}
