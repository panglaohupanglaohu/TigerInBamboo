import {createTargetUserMarkedTransitPlan} from './targetUserMarkedTransitPlan.js';
/** Offline-only eastern shore variant. No installation, terrain edit or silent cut. */
export const EAST_SHORE_ROUTE_TRIALS = [
 {id:'scanned-604-short-handles',startU:.604,shoulder:[104,64],south:[75,98],handle:18,southIn:18},
 {id:'scanned-604-contour',startU:.604,shoulder:[104,64],south:[75,98],handle:34},
 {id:'scanned-602-contour',startU:.602,shoulder:[104,64],south:[75,98],handle:34},
 {id:'long-entry-645',startU:.645,shoulder:[0,0],omitShoulder:true,south:[76,99],handle:30},
 {id:'long-entry-640',startU:.640,shoulder:[0,0],omitShoulder:true,south:[76,99],handle:30},
 {id:'long-entry-635',startU:.635,shoulder:[0,0],omitShoulder:true,south:[76,99],handle:30},
 {id:'long-entry-640-wide',startU:.640,shoulder:[0,0],omitShoulder:true,south:[76,102],handle:30},
 {id:'same-start-shoulder-4',startU:null,shoulder:[105,74],south:[74,100],handle:18},
 {id:'same-start-shoulder-8',startU:null,shoulder:[104,70],south:[74,98],handle:20},
 {id:'earlier-645-broad',startU:.645,shoulder:[105,72],south:[74,100],handle:26},
 {id:'earlier-640-broad',startU:.640,shoulder:[105,69],south:[74,100],handle:30},
 {id:'earlier-640-shore',startU:.640,shoulder:[104,64],south:[75,98],handle:30},
 {id:'earlier-635-shore',startU:.635,shoulder:[104,64],south:[75,98],handle:34},
 {id:'earlier-640-gentle',startU:.640,shoulder:[107,72],south:[74,102],handle:36},
 {id:'earlier-635-gentle',startU:.635,shoulder:[107,70],south:[74,102],handle:38},
];
export function createTargetEastShoreRouteCandidate({enabled=false,trial=EAST_SHORE_ROUTE_TRIALS[0],...options}={}){
 if(!enabled)return{curves:null,report:{enabled:false,accepted:false,installed:false}};
 if(!trial||!trial.shoulder?.every(Number.isFinite)||trial.shoulder.length!==2||!trial.south?.every(Number.isFinite)||trial.south.length!==2||!Number.isFinite(trial.handle)||trial.handle<=0||trial.startU!==null&&(!Number.isFinite(trial.startU)||trial.startU<0||trial.startU>.65))throw new TypeError('finite east-shore trial required');
 const intervals=trial.startU===null?undefined:{red:[trial.startU,.798],blue:[trial.startU+.0025844302347414,.800],center:[trial.startU+.0013073407223313,.799]};
 const joins=[{local:trial.shoulder,direction:[-.55,1],handle:trial.handle},{local:trial.south,direction:[-1,0],handleIn:trial.southIn??26,handleOut:22},{local:[32,87],direction:[-.6,-1],handleIn:24,handleOut:12},{local:[22,58],direction:[-.5,-1],handle:18},{local:[-26,38],direction:[-1,.15],handleIn:21,handleOut:24},{local:[-95,59],direction:[-1,-.2],handle:29}];
 if(trial.omitShoulder)joins.shift();
 const plan=createTargetUserMarkedTransitPlan({...options,joins,handleLength:30,sourceIntervals:intervals});
 return{...plan,report:{...plan.report,version:'east-shore-route-candidate-1',enabled:true,trial:JSON.parse(JSON.stringify(trial)),accepted:false,installed:false,status:Object.values(plan.report.laneAudit).every(a=>a.pass)?'requires-full-loaded-terrain-audit':'failed-curve-constraints',requiresTerrainChange:false,globalImpact:intervals??'same source intervals as marked release',limits:{minimumRadius:25,maximumGrade:.04},limitations:['Explicit piecewise tangent-constrained Bezier candidate; no route installation or terrain cuts.','Earlier startU replaces additional global source segment, companion endpoints retain each lane exact source tangent.','Actual terrain and sea loaded-envelope audit must pass; callback samples alone do not approve construction.']}};
}
