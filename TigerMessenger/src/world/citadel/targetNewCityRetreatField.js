import {MathUtils} from 'three';
// Authored coastal silhouette retreat, not a railway trench or a WFC solver.
// The former new-east/new-coastal ridges project to x111 beyond the actual city.
const EDGE=[[-58,108],[-40,92],[-28,91],[-10,98],[15,104],[40,104],[60,99],[80,92],[100,82],[107,80]];
const PLAZA=[[45,76],[49,69],[65,64],[81,67],[88,76],[83,87],[64,91],[49,87]];
export function createTargetNewCityRetreatField({platforms=[]}={}){
 const report={version:'target-new-city-coastal-retreat-1',built:true,visualReviewed:false,changedQueries:0,protectedQueries:0,maxDrop:0,edge:EDGE,transitionWidth:3.8,railChanged:false,scope:'new-city eastern exterior only; old city and reserved construction cores fixed',limitations:['Authored castle-chart envelope; not a global railway clearance guarantee.','Final mesh, foundations, turf and current actors require runtime re-sampling.']};
 function edgeAt(z){let e=EDGE.at(-1)[1];for(let i=1;i<EDGE.length;i++)if(z<=EDGE[i][0]){const a=EDGE[i-1],b=EDGE[i];e=MathUtils.lerp(a[1],b[1],MathUtils.smoothstep(z,a[0],b[0]));break;}for(const p of platforms){const dz=(z-p.center[1])/p.radii[1];if(Math.abs(dz)<=1)e=Math.max(e,p.center[0]+p.radii[0]*Math.sqrt(1-dz*dz)+1.5);}return e;}
 function plazaDistance(x,z){let inside=true,d=Infinity;for(let i=0;i<PLAZA.length;i++){const a=PLAZA[i],b=PLAZA[(i+1)%PLAZA.length],dx=b[0]-a[0],dz=b[1]-a[1];if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;const t=MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return inside?0:d;}
 function height(x,z,original,sea){if(![x,z,original,sea].every(Number.isFinite))throw new TypeError('finite surface and sea samples required');if(x<80||z< -58||z>107)return original;
  const e=edgeAt(z),w=MathUtils.smoothstep(x,e,e+3.8)*MathUtils.smoothstep(z,-58,-49)*MathUtils.smoothstep(plazaDistance(x,z),2.4,4.4);
  if(w===0){report.protectedQueries++;return original;}
  const next=MathUtils.lerp(original,Math.min(original,sea-3),w);if(next<original-1e-8){report.changedQueries++;const drop=original-next;if(drop>report.maxDrop){report.maxDrop=drop;report.maxDropPoint={x,z,before:original,after:next,sea,edge:e};}}return next;
 }
 return {height,edgeAt,report};
}
