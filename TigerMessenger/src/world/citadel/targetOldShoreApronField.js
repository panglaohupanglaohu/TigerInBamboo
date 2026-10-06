import * as T from 'three';
const value=(fn,x,z)=>{const v=fn(x,z);return Number.isFinite(v)?v:Number.isFinite(v?.height)?v.height:null;};
/** Optional old-shore LANDWARD fill only. The sea-facing edge is outside the
 * complete vehicle box projection, not simply outside its centre line. This
 * field raises no sea-facing point, changes no original high terrain, and is
 * disabled near the old bridge / waterfall / return street. Caller must rebuild
 * its actual mesh and recheck clearance; station checks are not acceptance. */
export function createTargetOldShoreApronField({castleMatrix,worldCurve,sampleTerrain,sampleSea,platforms=[],landwardTarget=[-55,9],maxGap=15,step=2,walkwayHeight=6.9,vehicleTop=5.71,railSetback=2.4,maxChartX=-47,protectedBoxes=[],profile='flat'}={}){
 if(!castleMatrix||!worldCurve?.getPointAt||typeof sampleTerrain!=='function'||typeof sampleSea!=='function'||![maxGap,step,walkwayHeight,vehicleTop,railSetback].every(n=>Number.isFinite(n)&&n>0)||maxGap>32||step>3||!Number.isFinite(maxChartX))throw new TypeError('finite bounded old shore curve, matrix and actual surface callbacks required');
 if(!['flat','stepped-rock-link'].includes(profile))throw new TypeError('unknown apron profile');
 const matrix=castleMatrix.isMatrix4?castleMatrix.clone():new T.Matrix4().fromArray(castleMatrix);if(!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-10)throw new TypeError('invertible castle matrix required');
 const inverse=matrix.clone().invert(),length=worldCurve.getLength(),n=Math.ceil(length/step),stations=[],segments=[];
 const report={version:'target-old-shore-landward-apron-4-contact',accepted:false,installed:false,status:'needs-mesh-audit',maxGap,railSetback,walkwayHeight,vehicleTop,profile,bridgeExclusion:{maxChartX},eligibleStations:0,rejections:{bridgeAndWaterfall:0,missingSurface:0,gapTooWide:0,alreadyJoined:0},changedQueries:0,maxRaise:0};
 const protectedPoint=(x,z)=>platforms.some(p=>Math.hypot((x-p.center[0])/p.radii[0],(z-p.center[1])/p.radii[1])<=1)||protectedBoxes.some(b=>x>=b.min[0]&&x<=b.max[0]&&z>=b.min[2]&&z<=b.max[2]);
 for(let i=0;i<=n;i++){
  const w=worldCurve.getPointAt(i/n),t=worldCurve.getTangentAt(i/n).normalize(),right=w.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize(),p=w.clone().applyMatrix4(inverse),ct=t.clone().transformDirection(inverse),toward=new T.Vector2(-ct.z,ct.x).normalize();if(toward.dot(new T.Vector2(landwardTarget[0]-p.x,landwardTarget[1]-p.z))<0)toward.negate();
  const row={i,u:i/n,center:p.toArray(),inward:[toward.x,toward.y],enabled:false};stations.push(row);
  if(p.x>maxChartX){row.reason='bridgeAndWaterfall';report.rejections.bridgeAndWaterfall++;continue;}
  let projection=-Infinity;for(const across of[-4.37,4.37])for(const along of[-3.49,3.49])for(const h of[-.6,vehicleTop]){const q=w.clone().addScaledVector(right,across).addScaledVector(t,along).addScaledVector(up,h).applyMatrix4(inverse);projection=Math.max(projection,(q.x-p.x)*toward.x+(q.z-p.z)*toward.y);}
  const offset=projection+railSetback,edge=[p.x+toward.x*offset,p.z+toward.y*offset],top=w.clone().addScaledVector(up,walkwayHeight-.45).applyMatrix4(inverse).y;
  Object.assign(row,{edge,top,vehicleProjection:projection});let width=null,known=0;
  for(let d=0;d<=maxGap;d+=.5){const x=edge[0]+toward.x*d,z=edge[1]+toward.y*d,h=value(sampleTerrain,x,z),sea=value(sampleSea,x,z);if(h===null||sea===null)continue;known++;if((profile==='stepped-rock-link'||h>=top-.15)&&h>sea+1.5){width=d;row.contactHeight=h;break;}}
  if(width===null&&known===0){row.reason='missingSurface';report.rejections.missingSurface++;continue;}
  if(width===null){for(let d=0;d<=45;d+=.5){const x=edge[0]+toward.x*d,z=edge[1]+toward.y*d,h=value(sampleTerrain,x,z),s=value(sampleSea,x,z);if(h!==null&&s!==null&&h>s+1.5){row.diagnosticDryLandDistance=d;row.diagnosticDryLandHeight=h;break;}}for(let d=maxGap+.5;d<=45;d+=.5){const x=edge[0]+toward.x*d,z=edge[1]+toward.y*d,h=value(sampleTerrain,x,z),s=value(sampleSea,x,z);if(h!==null&&s!==null&&h>=top-.15&&h>s+1.5){row.diagnosticLandDistance=d;break;}}row.reason='gapTooWide';report.rejections.gapTooWide++;continue;}
  if(width<.5){row.reason='alreadyJoined';report.rejections.alreadyJoined++;continue;}
  if(profile==='stepped-rock-link'){const joinFloor=Math.max(row.contactHeight,top-6);for(let d=width;d<=maxGap;d+=.5){const h=value(sampleTerrain,edge[0]+toward.x*d,edge[1]+toward.y*d);if(h!==null&&h>=joinFloor){width=d;row.contactHeight=h;break;}}}row.width=Math.min(maxGap,width+1);row.lowTierHeight=Math.max(Math.min(row.contactHeight,top-3),top-6);row.enabled=true;report.eligibleStations++;
 }
 for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i];if(!a.enabled||!b.enabled)continue;const dx=b.edge[0]-a.edge[0],dz=b.edge[1]-a.edge[1],len=Math.hypot(dx,dz);if(len<1e-6)continue;segments.push({a,b,dx,dz,len});}
 function height(x,z,original,sea){if(![x,z,original,sea].every(Number.isFinite))throw new TypeError('finite terrain query required');if(x>maxChartX||protectedPoint(x,z))return original;let result=original;
  for(const s of segments){const u=((x-s.a.edge[0])*s.dx+(z-s.a.edge[1])*s.dz)/(s.len*s.len);if(u<0||u>1)continue;const ex=s.a.edge[0]+u*s.dx,ez=s.a.edge[1]+u*s.dz,ix=T.MathUtils.lerp(s.a.inward[0],s.b.inward[0],u),iz=T.MathUtils.lerp(s.a.inward[1],s.b.inward[1],u),norm=Math.hypot(ix,iz),d=((x-ex)*ix+(z-ez)*iz)/norm,width=T.MathUtils.lerp(s.a.width,s.b.width,u);if(d<0||d>width)continue;let top=T.MathUtils.lerp(s.a.top,s.b.top,u);if(profile==='stepped-rock-link'){const low=Math.min(top,T.MathUtils.lerp(s.a.lowTierHeight,s.b.lowTierHeight,u)),bench=Math.min(3,width*.25),dropEnd=Math.min(width-1.5,bench+2);top=T.MathUtils.lerp(top,low,T.MathUtils.smoothstep(d,bench,Math.max(bench+.1,dropEnd)));const contact=T.MathUtils.lerp(s.a.contactHeight,s.b.contactHeight,u);top=T.MathUtils.lerp(top,contact,T.MathUtils.smoothstep(d,Math.max(.1,width-3),Math.max(.2,width-1)));top=Math.max(top,sea+2);}if(top<=sea+1.5)continue;const endFeather=T.MathUtils.smoothstep(maxChartX-x,0,4),inlandFeather=profile==='stepped-rock-link'?1:1-T.MathUtils.smoothstep(d,Math.max(.1,width-1.5),width),raise=Math.max(0,top-original)*endFeather*inlandFeather;result=Math.max(result,original+raise);}
  if(result>original){report.changedQueries++;report.maxRaise=Math.max(report.maxRaise,result-original);}return result;
 }
 report.segments=segments.length;report.status=segments.length?'built-field-needs-mesh-audit':'no-eligible-gap';return{height,report,stations};
}
