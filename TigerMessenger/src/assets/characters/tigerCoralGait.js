// Lake-specific character decisions, not a reconstruction of Sable's shaders.
export const TIGER_CORAL_PALETTE=Object.freeze({coat:'#CD8F48',stripe:'#34333D',ink:'#47434F',ivory:'#F2E8D3',nose:'#B97882',eye:'#C8A66E'});
export const TIGER_WALK=Object.freeze({stanceFraction:.65,reach:.95,clearance:.36,phaseOffsets:[.25,.75,0,.5]});
// A grounded foot travels backwards at exactly the actor's forward speed:
// d(local foot)/d(distance) = -1 / actorScale during the stance interval.
export function tigerStrideLength(actorScale){return 2*TIGER_WALK.reach*Math.abs(actorScale)/TIGER_WALK.stanceFraction;}
export function sampleTigerWalk(phase,index,walking=true){
 const u=((phase+TIGER_WALK.phaseOffsets[index])%1+1)%1;
 const s=u<TIGER_WALK.stanceFraction?0:(u-TIGER_WALK.stanceFraction)/(1-TIGER_WALK.stanceFraction);
 // Match the -body-speed stance derivative at both swing boundaries.
 // This is a foot trajectory, not fixed-bone-length anatomical IK.
 const stance=u<TIGER_WALK.stanceFraction;
 const boundarySpeed=-2*TIGER_WALK.reach*(1-TIGER_WALK.stanceFraction)/TIGER_WALK.stanceFraction;
 const ease=s*s*s*(10+s*(-15+6*s));
 const travel=stance?TIGER_WALK.reach-2*TIGER_WALK.reach*u/TIGER_WALK.stanceFraction:
  -TIGER_WALK.reach+boundarySpeed*s+(2*TIGER_WALK.reach-boundarySpeed)*ease;
 // Zero vertical speed at release/contact, same sole datum and peak lift.
 const lift=Math.sin(s*Math.PI)**2;
 return {phase:u,swing:walking?lift:0,travel:walking?travel:0,stance:!walking||stance};
}
// Elliptical muscle envelopes: shoulder/thigh, elbow/knee, wrist/hock, ankle.
// Different profiles prevent the former monotonically tapered tube silhouette.
export function tigerLimbRadius(u,rear=false){
 const p=rear?[[0,.49,.48],[.16,.56,.57],[.40,.37,.40],[.66,.22,.25],[.81,.245,.27],[1,.21,.235]]:[[0,.45,.46],[.17,.48,.50],[.42,.355,.385],[.65,.30,.325],[.84,.225,.25],[1,.215,.24]];
 let i=0;while(i<p.length-2&&u>p[i+1][0])i++;
 const a=p[i],b=p[i+1],t=Math.min(1,Math.max(0,(u-a[0])/(b[0]-a[0]))),s=t*t*(3-2*t);
 return [a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];
}
