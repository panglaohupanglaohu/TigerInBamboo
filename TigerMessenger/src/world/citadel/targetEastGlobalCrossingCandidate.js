import * as T from 'three';
import {prepareCitadelRailStartup} from './citadelRailStartup.js';

/** Default-off local clearance experiment. It displaces only an explicit
 * window on the east replacement, not retained global tracks. Lateral trials
 * share a nearest-original-center displacement field. Independent radial
 * profiles instead preserve each lane's angular path and must separately
 * audit corresponding cross sections; equal arc fractions are not correspondence. */
export function createTargetEastGlobalCrossingCandidate(options={}){
 if(!options.enabled)return{curves:null,startup:null,report:{enabled:false,accepted:false,installed:false}};
 const {release:inputRelease,sourceCurves,lateral=0,radialLift=0,startMetres=40,endMetres=300,fixedDirection=false,frontLoadedGrade=null,sourceExtensionMetres=0,independentRadialProfiles=false,tailGrade=.004}=options;
 if(independentRadialProfiles&&lateral!==0)throw new Error('EAST_GLOBAL_CROSSING_INDEPENDENT_RADIAL_ONLY');
 if(!Number.isFinite(tailGrade)||Math.abs(tailGrade)>.04)throw new Error('EAST_GLOBAL_CROSSING_TAIL_GRADE');
 let release=inputRelease;
 if(!Number.isFinite(sourceExtensionMetres)||sourceExtensionMetres<0||sourceExtensionMetres>120)throw new Error('EAST_GLOBAL_CROSSING_EXTENSION');
 if(sourceExtensionMetres){
  if(!release?.curves||!sourceCurves)throw new Error('EAST_GLOBAL_CROSSING_INPUT');
  const curves={},ranges={},specs={};
  for(const lane of['center','red','blue']){
   const src=sourceCurves[lane],base=release.curves[lane],L=base.getLength(),sourceLength=src.getLength(),start=release.specs[lane].startU-sourceExtensionMetres/sourceLength,oldStart=release.specs[lane].startU,total=sourceExtensionMetres+L;
   if(start<=0)throw new Error('EAST_GLOBAL_CROSSING_EXTENSION_SEAM');
   class Prefix extends T.Curve{getLength(){return total;}getPointAt(u,out=new T.Vector3()){const d=u*total;return out.copy(d<=sourceExtensionMetres?src.getPointAt(start+d/sourceLength):base.getPointAt((d-sourceExtensionMetres)/L));}getPoint(u,out){return this.getPointAt(u,out);}getTangentAt(u,out=new T.Vector3()){const d=u*total;return out.copy(d<=sourceExtensionMetres?src.getTangentAt(start+d/sourceLength):base.getTangentAt((d-sourceExtensionMetres)/L));}getTangent(u,out){return this.getTangentAt(u,out);}getUtoTmapping(u,d){return d===undefined?u:d/total;}getLengths(n=200){return Array.from({length:n+1},(_,i)=>total*i/n);}}
   curves[lane]=new Prefix();ranges[lane]=Object.fromEntries(Object.entries(release.ranges[lane]).map(([k,rs])=>[k,rs.map(u=>(sourceExtensionMetres+u*L)/total)]));specs[lane]={...release.specs[lane],startU:start,replacementCurve:curves[lane]};
  }
  release={...release,curves,ranges,specs};
 }
 if(!release?.curves?.center||!sourceCurves||![lateral,radialLift,startMetres,endMetres].every(Number.isFinite)||startMetres<10||endMetres<=startMetres+30)throw new Error('EAST_GLOBAL_CROSSING_INPUT');
 const center=release.curves.center,centerLength=center.getLength(),headEnd=release.ranges.center.central[0]*centerLength;
 if(endMetres>=headEnd-2)throw new Error('EAST_GLOBAL_CROSSING_KEEP_CENTRAL');
 const samples=Array.from({length:513},(_,i)=>({s:headEnd*i/512,p:center.getPointAt(headEnd*i/512/centerLength)}));
 const fixedRight=center.getPointAt(0).normalize().cross(center.getTangentAt(0)).normalize();
 const bump=s=>s<=startMetres||s>=endMetres?0:Math.sin(Math.PI*(s-startMetres)/(endMetres-startMetres))**2;
 function angular(p,s){const c=center.getPointAt(s/centerLength),right=fixedDirection?fixedRight.clone().addScaledVector(c.clone().normalize(),-fixedRight.dot(c.clone().normalize())).normalize():c.clone().normalize().cross(center.getTangentAt(s/centerLength)).normalize();return p.addScaledVector(right,lateral*bump(s)).normalize();}
 const distanceTable=[0];let prev=angular(center.getPointAt(0),0).multiplyScalar(center.getPointAt(0).length());
 for(let i=1;i<=1024;i++){const s=headEnd*i/1024,p=center.getPointAt(s/centerLength),q=angular(p.clone(),s).multiplyScalar(p.length());distanceTable.push(distanceTable.at(-1)+q.distanceTo(prev));prev=q;}
 const localDistance=s=>{const x=T.MathUtils.clamp(s/headEnd,0,1)*1024,i=Math.min(1023,Math.floor(x));return T.MathUtils.lerp(distanceTable[i],distanceTable[i+1],x-i);};
 let gradeProfile=null;
 if(frontLoadedGrade!==null){
  if(!Number.isFinite(frontLoadedGrade)||frontLoadedGrade<=0||frontLoadedGrade>.0397)throw new Error('EAST_GLOBAL_CROSSING_GRADE');
  const L=distanceTable.at(-1),r0=center.getPointAt(0).length(),r1=center.getPointAt(headEnd/centerLength).length(),g0=center.getTangentAt(0).dot(center.getPointAt(0).normalize()),g1=center.getTangentAt(headEnd/centerLength).dot(center.getPointAt(headEnd/centerLength).normalize()),a=15,c=30,d=15,low=tailGrade,g=frontLoadedGrade;
  const b=(r1-r0-low*L-.5*(g0-g)*a-.5*(g-low)*c-.5*(g1-low)*d)/(g-low);
  if(b<a||b+c>L-d)throw new Error('EAST_GLOBAL_CROSSING_GRADE_LENGTH');
  const pieces=[[0,a,g0,g],[a,b,g,g],[b,b+c,g,low],[b+c,L-d,low,low],[L-d,L,low,g1]];
  const target=s=>{let r=r0;for(const[x,y,v,w]of pieces){const t=T.MathUtils.clamp((s-x)/(y-x),0,1);r+=(y-x)*(v*t+(w-v)*(.5*t*t));if(s<=y)break;}return r;};
  gradeProfile={length:L,r0,r1,plateauEnd:b,peak:g,target};
 }
 function field(p,skipGrade=false){let nearest=0,dist=Infinity;for(let i=0;i<samples.length;i++){const d=samples[i].p.distanceToSquared(p);if(d<dist){dist=d;nearest=i;}}
  let lo=Math.max(0,samples[nearest].s-headEnd/512),hi=Math.min(headEnd,samples[nearest].s+headEnd/512);for(let i=0;i<22;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(center.getPointAt(a/centerLength).distanceToSquared(p)<center.getPointAt(b/centerLength).distanceToSquared(p))hi=b;else lo=a;}
  const s=(lo+hi)/2,radius=p.length();let offset=radialLift*bump(s);
  if(gradeProfile&&!skipGrade){const fade=x=>(x=T.MathUtils.clamp(x,0,1),x*x*(3-2*x));offset+=(gradeProfile.target(localDistance(s))-center.getPointAt(s/centerLength).length())*fade(s/5)*fade((headEnd-s)/5);}
  return angular(p,s).multiplyScalar(radius+offset);
 }
 const curves={},specs={},audit={};
 for(const lane of['center','red','blue']){
  const original=release.curves[lane],end=release.ranges[lane].central[0],tailLength=(1-end)*original.getLength();
  let laneTarget=null;
  if(independentRadialProfiles){
   const L=end*original.getLength(),r0=original.getPointAt(0).length(),r1=original.getPointAt(end).length(),g0=original.getTangentAt(0).dot(original.getPointAt(0).normalize()),g1=original.getTangentAt(end).dot(original.getPointAt(end).normalize()),a=15,c=30,d=15,low=tailGrade,g=frontLoadedGrade;
   const b=(r1-r0-low*L-.5*(g0-g)*a-.5*(g-low)*c-.5*(g1-low)*d)/(g-low);if(!Number.isFinite(g)||b<a||b+c>L-d)throw new Error('EAST_GLOBAL_CROSSING_LANE_PROFILE');
   laneTarget=s=>{let r=r0;for(const[x,y,v,w]of[[0,a,g0,g],[a,b,g,g],[b,b+c,g,low],[b+c,L-d,low,low],[L-d,L,low,g1]]){const t=T.MathUtils.clamp((s-x)/(y-x),0,1);r+=(y-x)*(v*t+(w-v)*.5*t*t);if(s<=y)break;}return r;};
  }
  class Head extends T.Curve{getPoint(t,out=new T.Vector3()){const p=original.getPointAt(end*t);if(!laneTarget)return out.copy(field(p));const s=t*end*original.getLength(),L=end*original.getLength(),fade=x=>(x=T.MathUtils.clamp(x,0,1),x*x*(3-2*x)),target=p.length()+(laneTarget(s)-p.length())*fade(s/5)*fade((L-s)/5);return out.copy(p).normalize().multiplyScalar(target);}}
  const head=new Head();head.arcLengthDivisions=4096;const headLength=head.getLength(),total=headLength+tailLength;
  class Joined extends T.Curve{getLength(){return total;}getPointAt(u,out=new T.Vector3()){const s=T.MathUtils.clamp(u,0,1)*total;return s<=headLength?head.getPointAt(s/headLength,out):out.copy(original.getPointAt(end+(s-headLength)/original.getLength()));}getPoint(u,out){return this.getPointAt(u,out);}getTangentAt(u,out=new T.Vector3()){const s=u*total;if(s>headLength)return out.copy(original.getTangentAt(end+(s-headLength)/original.getLength()));return head.getTangentAt(s/headLength,out);}getTangent(u,out){return this.getTangentAt(u,out);}getLengths(divisions=200){return Array.from({length:divisions+1},(_,i)=>total*i/divisions);}getUtoTmapping(u,d){return d===undefined?u:d/total;}}
  curves[lane]=new Joined();specs[lane]={...release.specs[lane],replacementCurve:curves[lane],id:'east-global-crossing-offline-'+lane};
  const n=Math.ceil(total/.75),pts=[];let minRadius=Infinity,maxGrade=0;
  for(let i=0;i<=n;i++){const p=curves[lane].getPointAt(i/n),t=curves[lane].getTangentAt(i/n),v=Math.abs(t.dot(p.clone().normalize()));maxGrade=Math.max(maxGrade,v/Math.sqrt(Math.max(1e-12,1-v*v)));pts.push(p);}
  for(let i=1;i<n;i++){const[a,b,c]=pts.slice(i-1,i+2),cross=b.clone().sub(a).cross(c.clone().sub(a)).length();if(cross>1e-10)minRadius=Math.min(minRadius,a.distanceTo(b)*b.distanceTo(c)*a.distanceTo(c)/(2*cross));}
  audit[lane]={length:total,addedLength:total-original.getLength(),headLength,originalTailStart:end,newTailStart:headLength/total,minRadius,maxGrade,shapePass:minRadius>=25&&maxGrade<=.04};
 }
 const startup=prepareCitadelRailStartup(sourceCurves,specs);
 const report={version:'east-global-crossing-candidate-1',enabled:true,accepted:false,installed:false,parameters:{lateral,radialLift,startMetres,endMetres,fixedDirection,frontLoadedGrade,sourceExtensionMetres,independentRadialProfiles,tailGrade},sourceIntervals:Object.fromEntries(['center','red','blue'].map(l=>[l,[specs[l].startU,specs[l].endU]])),gradeProfile:gradeProfile?{length:gradeProfile.length,r0:gradeProfile.r0,r1:gradeProfile.r1,plateauEnd:gradeProfile.plateauEnd,peak:gradeProfile.peak}:null,audit,splicePass:!!startup.splice,
  retainedCentralAndOldShoreGeometry:true,requires:['Use recomputed cityGalleryCoverage and ranges, never old global fractions.','Repeat actual final terrain/body/sea and structure checks.','Rebuild all tracks, vehicles, stations and interlocking from a single startup transaction.'],terrainVerified:false,structureVerified:false,actorsVerified:false};
 function span(c,a,b){class Span extends T.Curve{getLength(){return(b-a)*c.getLength();}getPointAt(u,out=new T.Vector3()){return out.copy(c.getPointAt(a+(b-a)*u));}getPoint(u,out){return this.getPointAt(u,out);}getTangentAt(u,out=new T.Vector3()){return out.copy(c.getTangentAt(a+(b-a)*u));}getTangent(u,out){return this.getTangentAt(u,out);}getLengths(n=200){return Array.from({length:n+1},(_,i)=>this.getLength()*i/n);}getUtoTmapping(u,d){return d===undefined?u:d/this.getLength();}}return new Span();}
 const ranges={},segments={},matrix=inputRelease.castleMatrix,inverse=matrix.clone().invert(),max=audit.center.newTailStart;
 let lo=0,hi=0,previous=curves.center.getPointAt(0).applyMatrix4(inverse).x;for(let i=1;i<=1024;i++){const u=max*i/1024,x=curves.center.getPointAt(u).applyMatrix4(inverse).x;if(previous>120&&x<=120){lo=max*(i-1)/1024;hi=u;break;}previous=x;}
 if(!hi)throw new Error('EAST_GLOBAL_CROSSING_CITY_SCOPE');for(let i=0;i<44;i++){const u=(lo+hi)/2;if(curves.center.getPointAt(u).applyMatrix4(inverse).x>120)lo=u;else hi=u;}const cut=(lo+hi)/2,world=curves.center.getPointAt(cut);
 function nearest(c,p,end){let best=0,dist=Infinity;for(let i=0;i<=512;i++){const u=end*i/512,d=c.getPointAt(u).distanceToSquared(p);if(d<dist){best=u;dist=d;}}let a=Math.max(0,best-end/512),b=Math.min(end,best+end/512);for(let i=0;i<36;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(c.getPointAt(x).distanceToSquared(p)<c.getPointAt(y).distanceToSquared(p))b=y;else a=x;}return(a+b)/2;}
 const coverage={enabled:true,entryCastleX:120,centerWorld:world.toArray(),centerLocal:world.clone().applyMatrix4(inverse).toArray(),boundaries:{},globalParameterIntervals:{},globalApproachSupportBuilt:false,hardFailures:[{code:'GLOBAL_APPROACH_SUPPORT_UNBUILT'}]};
 for(const l of['center','red','blue']){const total=curves[l].getLength(),a=audit[l].newTailStart,b=a+inputRelease.segments[l].central.getLength()/total,u=l==='center'?cut:nearest(curves[l],world,a);ranges[l]={globalApproach:[0,u],newShore:[u,a],central:[a,b],oldShore:[b,1]};segments[l]={globalApproach:span(curves[l],0,u),newShore:span(curves[l],u,a),central:inputRelease.segments[l].central,oldShore:inputRelease.segments[l].oldShore,retainedOld:inputRelease.segments[l].retainedOld};coverage.boundaries[l]={replacementU:u,world:curves[l].getPointAt(u).toArray(),castleLocal:curves[l].getPointAt(u).applyMatrix4(inverse).toArray(),fromSourceHeadMetres:u*total,cityNewShoreLength:(a-u)*total};
  if(startup.splice){const g=startup.splice.lanes[l].report.replacementInterval,v=g[0]+u*(g[1]-g[0]);coverage.globalParameterIntervals[l]={globalApproach:[g[0],v],cityStructure:[v,g[1]],sourceReplacement:[specs[l].startU,specs[l].endU],cityStartOriginalSourceU:null};}}
 report.cityGalleryCoverage=coverage;
 report.sourceImpact=Object.fromEntries(['center','red','blue'].map(l=>[l,{sourceStartU:specs[l].startU,previousSourceStartU:inputRelease.specs[l].startU,endU:specs[l].endU,additionalSourceSpan:(inputRelease.specs[l].startU-specs[l].startU)*sourceCurves[l].getLength(),netGlobalLengthChange:startup.curves[l].getLength()-(sourceCurves[l].getLength()-(inputRelease.specs[l].endU-inputRelease.specs[l].startU)*sourceCurves[l].getLength()+inputRelease.curves[l].getLength()),untouchedSourceIntervals:[[0,specs[l].startU],[specs[l].endU,1]]}]));
 // Historical diagnostics describe different endpoints/radii. Do not expose
 // them as current checks just because the terrain dependency is borrowed.
 report.laneAudit=audit;report.centerAnchor=null;report.centerCorrespondence=null;report.seaGuide=null;report.joins=startup.splice?Object.fromEntries(['center','red','blue'].map(l=>[l,startup.splice.lanes[l].report.joins])):null;
 report.terrainGeometryAuditInherited=false;report.waterReserveVerified=false;report.stationRuntimeVerified=false;
 report.limitations=['Changed east source collar and radial profile need their own joint audits; previous-release correspondence/water/terrain results are not inherited.','Original source geometry outside the declared replacement is exactly delegated, but world-wide track consumers, actors and support exclusions must be rebuilt together.','Finite CPU candidate only, no GPU, continuous dynamics or engineering load-capacity acceptance.'];
 report.finiteShapePass=report.splicePass&&Object.values(audit).every(a=>a.shapePass);
 const candidateRelease={...inputRelease,version:report.version,curves,specs,ranges,segments,worldCurve:curves.center,cityGalleryCoverage:coverage,report:{...inputRelease.report,...report,retainedOldSourceIntervals:inputRelease.report.retainedOldSourceIntervals},structureOptions:{...inputRelease.structureOptions,newCityTransitLinks:false}};
 return{curves,specs,startup,release:report.finiteShapePass?candidateRelease:null,report};
}
