import {finishMountainRockSurface} from './mountainRockSurfaceFinish.js';
/** Final, deterministic operation replayed by the startup geometry contract. */
export function applyTargetFinalMountainFinish(geometry,{toChart}={}){
 const finished=finishMountainRockSurface(geometry,{enabled:true,toCastle:toChart,maxDisplacement:.2,iterations:2,
  // Conservative untouched band covers plaza/shore/rail-side footing; the
  // upper/rear rock domains can relax while crest and platform edges stay locked.
  protectedFace:points=>points.some(p=>p.y<3||(p.z>0&&Math.abs(p.x)<75))});
 geometry.copy(finished.geometry);finished.geometry.dispose();
 geometry.userData.finalMountainFinish=finished.report;
 return finished.report;
}
