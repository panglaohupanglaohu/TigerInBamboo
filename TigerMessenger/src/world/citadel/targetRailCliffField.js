import * as T from 'three';
// A local retreat of the measured south-east toe, not rerouting or a global
// tunnel excavator. Input retains 3D track identity even where XZ folds overlap.
export function createTargetRailCliffField({castleMatrix,lanes,platforms=[]}={}){
 if(!castleMatrix||!lanes)throw new TypeError('actual castleMatrix and sampled live lanes required');
 const matrix=castleMatrix.isMatrix4?castleMatrix:new T.Matrix4().fromArray(castleMatrix),inverse=matrix.clone().invert();
 const samples=[];
 for(const [lane,data]of Object.entries(lanes))for(const s of data.samples||[]){const q=new T.Vector3(...s.world),p=q.clone().applyMatrix4(inverse);if(p.x<80||p.x>110||p.z<69||p.z>104||p.y< -45||p.y> -15)continue;const up=q.clone().normalize().transformDirection(inverse);if(up.y<.35)continue;samples.push({lane,index:s.i,world:s.world,local:p,up});}
 const plaza=[[45,76],[49,69],[65,64],[81,67],[88,76],[83,87],[64,91],[49,87]];
 const inPlaza=(x,z)=>plaza.every((a,i)=>{const b=plaza[(i+1)%plaza.length];return(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-8;});
 const nearPlaza=(x,z)=>inPlaza(x,z)||plaza.some((a,i)=>{const b=plaza[(i+1)%plaza.length],dx=b[0]-a[0],dz=b[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<2.4;});
 const report={version:'target-new-city-rail-cliff-1',samples:samples.length,changedQueries:0,protectedQueries:0,maxDrop:0,scope:{x:[80,143],z:[70,102]},trackChanged:false,limits:['Only measured upper south-east track branch selected by 3D chart envelope. Other global segments remain unaudited by this local cut.','Actual source mesh and vehicle envelope must be tested after remeshing.','2.4m cliff transition; plateau cores stay fixed.']};
 function height(x,z,original,sea){if(!samples.length||x<80||x>143||z<70||z>102)return original;
  const candidates=samples.filter(s=>Math.abs(s.local.z-z)<2);if(!candidates.length)return original;
  // Both lanes and every qualifying 3D sample contribute; do not discard an
  // overlapping branch by choosing an arbitrary nearest-XZ track height.
  let edge=Infinity,cap=Infinity;
  for(const s of candidates){edge=Math.min(edge,s.local.x-5.6);cap=Math.min(cap,s.local.y+(-1.05-s.up.x*(x-s.local.x)-s.up.z*(z-s.local.z))/s.up.y);}
  const end=T.MathUtils.smoothstep(z,70,74)*(1-T.MathUtils.smoothstep(z,98,102));
  const weight=T.MathUtils.smoothstep(x,edge-2.4,edge)*end;if(weight<=0)return original;
  if(nearPlaza(x,z)||platforms.some(p=>Math.hypot((x-p.center[0])/p.radii[0],(z-p.center[1])/p.radii[1])<=.78)){report.protectedQueries++;return original;}
  const next=T.MathUtils.lerp(original,Math.min(original,Math.max(sea-11.5,Math.min(sea-3,cap))),weight);if(next<original-1e-6){report.changedQueries++;if(original-next>report.maxDrop){report.maxDrop=original-next;report.maxDropPoint={x,z,before:original,after:next,sea,edge,railPlaneCap:cap};}}return next;
 }
 return{height,report};
}
