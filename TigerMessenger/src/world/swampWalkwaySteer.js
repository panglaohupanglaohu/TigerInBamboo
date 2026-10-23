import * as THREE from 'three';
import {SWAMP_RIM_OUTER_MAX} from './swampCoralRim.js';
import {sampleSwampStairGround} from './swampPlayerSupport.js';

// 2026-10-09 用户：湖沼步道上信使走起来有偏差，希望像飞艇沿航线那样稳定。
// 在坑缘环形步道上：前进方向接近步道切线时，把速度投到切线上，并轻轻拉回步道中线；
// 明显朝内/朝外（下台阶、出坑）时不干预。只改水平速度，不改跳跃与重力。?swampSteer=0 关闭。
export function createSwampWalkwaySteer({getZone,ringRadius=(35.5+SWAMP_RIM_OUTER_MAX-.7)/2,band=[35.2,SWAMP_RIM_OUTER_MAX+.4],topY=40,coneDeg=55,pull=SWAMP_RIM_OUTER_MAX>42?.6:1.6,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampSteer')!=='0'}={}){
  const local=new THREE.Vector3(),up=new THREE.Vector3(),radial=new THREE.Vector3(),tangent=new THREE.Vector3(),q=new THREE.Quaternion(),qi=new THREE.Quaternion(),vel=new THREE.Vector3();
  const report={enabled,version:1,active:false,steeredSteps:0};
  const cosCone=Math.cos(coneDeg*Math.PI/180);
  return {report,apply(player,dt){
    report.active=false;if(!report.enabled||!player.onGround)return;
    const zone=getZone?.();if(!zone)return;
    zone.updateWorldMatrix(true,false);local.copy(player.position);zone.worldToLocal(local);
    const r=Math.hypot(local.x,local.z);if(r<band[0]||r>band[1]||Math.abs(local.y-topY)>1.6)return;
    const entrance=zone.userData.gregCoralRim;
    const entranceAngle=entrance?.entranceAngle??.5,delta=Math.atan2(Math.sin(Math.atan2(local.z,local.x)-entranceAngle),Math.cos(Math.atan2(local.z,local.x)-entranceAngle));
    // Release the whole upper approach, not only feet already on a tread.
    // Otherwise diagonal input gets projected around the rim before reaching stairs.
    if(Math.abs(delta)<Math.max(entrance?.entranceHalfAngle??.12,.12)+.03){report.entranceReleasedSteps=(report.entranceReleasedSteps||0)+1;return;}
    const stair=sampleSwampStairGround(zone,player.position);if(stair!==null&&Math.abs(player.position.length()-stair)<.35){report.stairReleasedSteps=(report.stairReleasedSteps||0)+1;return;}
    zone.getWorldQuaternion(q);qi.copy(q).invert();
    vel.copy(player.velocity).applyQuaternion(qi);// local frame (scale cancels for directions)
    const vy=vel.y;vel.y=0;const speed=vel.length();if(speed<.3)return;
    radial.set(local.x/r,0,local.z/r);tangent.set(-radial.z,0,radial.x);
    const along=vel.dot(tangent)/speed;
    if(Math.abs(along)<cosCone)return;// clearly heading in/out: leave it to the player
    const s=Math.sign(along);
    // keep full speed along the ring, plus a gentle pull to the centreline (local units → same frame)
    vel.copy(tangent).multiplyScalar(s*speed).addScaledVector(radial,Math.max(-1.5,Math.min(1.5,(ringRadius-r)*pull))*0.5);
    vel.y=vy;player.velocity.copy(vel.applyQuaternion(q));
    report.active=true;report.steeredSteps++;
  }};
}
