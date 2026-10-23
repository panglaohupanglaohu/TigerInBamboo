import {shapeCitadelCliffShoulders,sampleCitadelMountainRails} from './targetCliffShoulderGeometry.js';
import {softenCitadelMountainGeometry} from './targetSoftMountainGeometry.js';
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

/** Runs after all exact ship/headland cuts and before cached consumers. */
export function applyTargetSoftMountainFinish(geometry,{toChart,castleMatrix,railCurves}={}){
 const railPoints=sampleCitadelMountainRails(railCurves);
 if(!castleMatrix||!railPoints.length)throw new Error('Actual castle and consumer rail curves required');
 const cliff=shapeCitadelCliffShoulders(geometry,{toChart,castleMatrix,railPoints,softRearRims:true,softCutCaps:false,shoulderDepth:16});
 const rear=softenCitadelMountainGeometry(geometry,{toChart,castleMatrix,railPoints});
 const shaded=finishMountainRockSurface(geometry,{enabled:true,toCastle:toChart,relax:false,protectedFace:points=>points.some(p=>p.y<3||(p.z>0&&Math.abs(p.x)<75))});
 geometry.copy(shaded.geometry);shaded.geometry.dispose();
 const report={version:'citadel-final-soft-mountain-3-upper-shoulders',phase:'after-exact-cuts-before-consumers',cliff,rear,normalPass:shaded.report};geometry.userData.targetSoftMountainFinish=report;return report;
}
