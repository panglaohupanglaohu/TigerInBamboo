import * as THREE from 'three';

// Game-scale unguided fall: initial aircraft momentum plus local gravity.
// The same function supplies the release predictor and the visible projectile.
export function predictBatianBomb(origin, velocity, groundRadiusAt, fallbackRadius=160) {
  const up=origin.clone().normalize(),gravity=9.8;
  const at=t=>origin.clone().addScaledVector(velocity,t).addScaledVector(up,-.5*gravity*t*t);
  const ground=p=>{const r=groundRadiusAt?.(p);return Number.isFinite(r)?r:fallbackRadius;};
  let floor=ground(origin.clone()),hi=0;
  // Ground queries can involve a scene raycast. Refine the predicted landing
  // surface a few times; never raycast on every binary-search iteration.
  for(let pass=0;pass<4;pass++){
    const gap=t=>at(t).length()-floor;
    if(gap(0)<=0)return null;
    hi=.25;while(hi<12&&gap(hi)>0)hi+=.25;
    if(gap(hi)>0)return null;
    let lo=0;for(let i=0;i<44;i++){const mid=(lo+hi)/2;if(gap(mid)>0)lo=mid;else hi=mid;}
    const next=ground(at(hi));if(Math.abs(next-floor)<1e-6)break;floor=next;
  }
  return {duration:hi,point:at(hi),at,up,velocity:velocity.clone(),gravity};
}
