import * as T from 'three';
import {createEastCliffAlignmentCandidate} from './targetEastCliffAlignmentCandidate.js';
import {createTargetCliffOffsetCurve} from './targetCliffShoreRoute.js';
import {prepareCitadelRailStartup} from './citadelRailStartup.js';

export const EAST_CLIFF_PRODUCTION_RELEASE_VERSION = 'east-cliff-production-candidate-1';
const LANES = ['center','red','blue'];
const fail = (code, details={}) => { const e=new Error(code);e.code=code;e.details=details;throw e; };
const angle=(a,b)=>T.MathUtils.radToDeg(a.angleTo(b));
const validCurve=c=>c&&['getPointAt','getTangentAt','getLength'].every(k=>typeof c[k]==='function');
function join(a,au,b,bu,label){
 const position=a.getPointAt(au).distanceTo(b.getPointAt(bu)),tangent=angle(a.getTangentAt(au),b.getTangentAt(bu));
 if(position>1e-4||tangent>.5)fail('EAST_RELEASE_JOIN',{label,position,tangent});
 return{label,position,tangent};
}
// Arc-addressed borrowed spans. No resampling/refitting of retained geometry.
function arcParts(parts){
 const lengths=parts.map(p=>p.curve.getLength()*(p.end-p.start)),length=lengths.reduce((a,b)=>a+b,0);
 if(!Number.isFinite(length)||length<=0)fail('EAST_RELEASE_LENGTH');
 class Arc extends T.Curve{
  getLength(){return length;}
  getLengths(divisions=this.arcLengthDivisions){return Array.from({length:divisions+1},(_,i)=>length*i/divisions);}
  getUtoTmapping(u,distance){return distance===undefined?u:distance/length;}
  address(u){let d=T.MathUtils.clamp(u,0,1)*length;for(let i=0;i<parts.length;i++){if(d<=lengths[i]||i===parts.length-1){const p=parts[i];return[p,p.start+(p.end-p.start)*T.MathUtils.clamp(d/lengths[i],0,1)];}d-=lengths[i];}}
  getPoint(u,out=new T.Vector3()){const[p,t]=this.address(u);return out.copy(p.curve.getPointAt(t));}
  getPointAt(u,out){return this.getPoint(u,out);}
  getTangent(u,out=new T.Vector3()){const[p,t]=this.address(u);return out.copy(p.curve.getTangentAt(t));}
  getTangentAt(u,out){return this.getTangent(u,out);}
 }
 return new Arc();
}
const span=(curve,start,end)=>arcParts([{curve,start,end}]);
function nearest(curve,point,lo,hi,steps=128){
 let at=lo,best=Infinity;for(let i=0;i<=steps;i++){const u=lo+(hi-lo)*i/steps,d=curve.getPointAt(u).distanceToSquared(point);if(d<best){best=d;at=u;}}
 let a=Math.max(lo,at-(hi-lo)/steps),b=Math.min(hi,at+(hi-lo)/steps);
 for(let i=0;i<44;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(curve.getPointAt(x).distanceToSquared(point)<curve.getPointAt(y).distanceToSquared(point))b=y;else a=x;}
 at=(a+b)/2;return{u:at,distance:curve.getPointAt(at).distanceTo(point)};
}
function shape(curve,step=1){
 const n=Math.ceil(curve.getLength()/step),points=[];let minRadius=Infinity,maxGrade=0;
 for(let i=0;i<=n;i++){const p=curve.getPointAt(i/n),t=curve.getTangentAt(i/n),v=Math.abs(t.dot(p.clone().normalize()));if(![...p.toArray(),...t.toArray()].every(Number.isFinite))fail('EAST_RELEASE_NONFINITE');maxGrade=Math.max(maxGrade,v/Math.sqrt(Math.max(1e-12,1-v*v)));points.push(p);}
 for(let i=1;i<n;i++){const[a,b,c]=points.slice(i-1,i+2),cross=b.clone().sub(a).cross(c.clone().sub(a)).length();if(cross>1e-9)minRadius=Math.min(minRadius,a.distanceTo(b)*b.distanceTo(c)*a.distanceTo(c)/(2*cross));}
 return{samples:n+1,minRadius:Number.isFinite(minRadius)?minRadius:null,maxGrade,pass:minRadius>=25&&maxGrade<=.04};
}
function artifactContract(artifact,matrix){
 const h=artifact?.sourceHash,provenance=artifact?.provenance;
 if(!h||!['position','vertices'].every(k=>Number.isInteger(h[k])&&h[k]>0)||!artifact?.geometry?.data?.attributes?.position?.array||!Array.isArray(artifact.origin)||!Array.isArray(artifact.castleMatrix))fail('EAST_RELEASE_TERRAIN_ARTIFACT_REQUIRED');
 const nonindexed=h.index===null;
 if(nonindexed){
  const after=provenance?.baseline?.after,raw=provenance?.rawCandidate,final=provenance?.finalCandidate;
  if(h.indexed!==false||h.indexCount!==0||h.vertices!==3*h.triangles||h.refinement?.triangles!==h.triangles||!after||!['position','index','vertices','indexed'].every(k=>after[k]===h[k])||!raw?.closed||raw.connectedComponents!==1||raw.nonManifoldEdges!==0||raw.orientationConflicts!==0||raw.badEdges?.length!==0||final?.sourceTriangles!==raw.triangles||final?.triangles*9!==artifact.geometry.data.attributes.position.array.length||artifact.geometry.data.index)fail('EAST_RELEASE_REFINED_PROVENANCE');
 }else if(!Number.isInteger(h.index)||h.index<=0||h.indexed===false)fail('EAST_RELEASE_TERRAIN_INDEX_HASH');
 if(artifact.castleMatrix.length!==16||artifact.castleMatrix.some((v,i)=>!Number.isFinite(v)||Math.abs(v-matrix.elements[i])>1e-5))fail('EAST_RELEASE_TERRAIN_MATRIX');
 if(artifact.origin.length!==3||!artifact.origin.every(Number.isFinite))fail('EAST_RELEASE_TERRAIN_ORIGIN');
 if(!artifact.report?.closed||artifact.report.nonManifoldEdges!==0||artifact.report.orientationConflicts!==0)fail('EAST_RELEASE_TERRAIN_TOPOLOGY');
 return{required:true,mode:'exact-remesh-after-retained-terrain',sourceHash:structuredClone(h),origin:artifact.origin.slice(),castleMatrix:artifact.castleMatrix.slice(),accepted:false,installed:false,
  sourceStage:nonindexed?'production-refined-nonindexed':'raw-indexed-before-production-refinement',topologyScope:nonindexed?'raw-welded-candidate-before-refinement':'raw-welded-candidate',finalRefinedTopologyVerified:false,provenance:nonindexed?structuredClone(provenance):null,
  requires:['Validate the original sourceMesh geometry epoch before replacing it.','Build the retained release terrain first; do not rebuild the artifact base with the new curves.','Apply the exact artifact once; do not deform it with coastal cuts or apron fields afterwards.','Refresh all terrain/foundation/player/vegetation indices.'],
  heightfieldCutsSufficient:false};
}

/** Offline/default-off release preparation only. All route consumers must be
 * built from startupPreview.curves in one startup transaction. It does not
 * mount terrain, rails, vehicles, stations, scenery or actors. Input curves are
 * borrowed immutable objects. No GPU resources or owned material disposal. */
export function createTargetEastCliffProductionRelease(options={}){
 if(!options.enabled)return{release:null,startupPreview:null,report:{version:EAST_CLIFF_PRODUCTION_RELEASE_VERSION,enabled:false,accepted:false,installed:false}};
 const {sourceCurves,retainedRelease,candidateInput,castleMatrix=retainedRelease?.castleMatrix,terrainArtifact,centerSourceBracket=null,seaRadiusAt=null,cityGalleryScope=false}=options;
 if(!LANES.every(l=>validCurve(sourceCurves?.[l])&&validCurve(retainedRelease?.curves?.[l])&&retainedRelease?.specs?.[l]&&retainedRelease?.ranges?.[l]&&retainedRelease?.segments?.[l])||!castleMatrix?.isMatrix4||!candidateInput)fail('EAST_RELEASE_INPUT');
 if(castleMatrix.elements.some((v,i)=>!Number.isFinite(v)||Math.abs(v-retainedRelease.castleMatrix.elements[i])>1e-5))fail('EAST_RELEASE_MATRIX');
 const terrainDependency=artifactContract(terrainArtifact,castleMatrix),v=candidateInput.retainedReleaseEndFraction;
 if(!Number.isFinite(v)||v<=0||v>=1||!['sourceStartU','blueSourceU'].every(k=>Number.isFinite(candidateInput[k])&&candidateInput[k]>0&&candidateInput[k]<1))fail('EAST_RELEASE_PARAMETERS');
 const replay=createEastCliffAlignmentCandidate({enabled:true,input:candidateInput,sourceCurves,retainedRelease,castleMatrix});
 if(!replay.curves)fail('EAST_RELEASE_REPLAY',replay.report);
 const east={...replay.curves},starts={red:candidateInput.sourceStartU,blue:candidateInput.blueSourceU},joins=[];
 for(const l of['red','blue']){joins.push(join(sourceCurves[l],starts[l],east[l],0,l+' source'));joins.push(join(east[l],1,retainedRelease.curves[l],v,l+' retained'));}
 // Derive a CENTER from exact red geometry; never rederive/replace the audited
 // red or blue rails. Endpoints have independent station coordinates.
 const rp=east.red.getPointAt(0),rt=east.red.getTangentAt(0),right=rp.clone().normalize().cross(rt).normalize();
 const desired=rp.clone().addScaledVector(right,2.05),bracket=centerSourceBracket??[Math.min(starts.red,starts.blue)-.008,Math.max(starts.red,starts.blue)+.008];
 if(!Array.isArray(bracket)||bracket.length!==2||!bracket.every(Number.isFinite)||bracket[0]<0||bracket[1]>1||bracket[1]<=bracket[0]||bracket[1]-bracket[0]>.06)fail('EAST_RELEASE_CENTER_BRANCH');
 const anchor=nearest(sourceCurves.center,desired,...bracket,256);starts.center=anchor.u;
 if(anchor.distance>.25||anchor.u<=bracket[0]+1e-5||anchor.u>=bracket[1]-1e-5)fail('EAST_RELEASE_CENTER_ANCHOR',anchor);
 east.center=createTargetCliffOffsetCurve({base:east.red,offset:2.05,startWorld:sourceCurves.center.getPointAt(anchor.u).toArray(),endWorld:retainedRelease.curves.center.getPointAt(v).toArray(),startTangent:sourceCurves.center.getTangentAt(anchor.u).toArray(),endTangent:retainedRelease.curves.center.getTangentAt(v).toArray(),blendLength:30}).curve;
 east.center.arcLengthDivisions=8192;east.center.updateArcLengths();
 joins.push(join(sourceCurves.center,starts.center,east.center,0,'center source'),join(east.center,1,retainedRelease.curves.center,v,'center retained'));
 const curves={},specs={},ranges={},segments={},mapping={},laneAudit={},impact={};
 for(const l of LANES){
  const old=retainedRelease.curves[l],a=east[l].getLength(),b=old.getLength(),length=a+(1-v)*b,oldRanges=retainedRelease.ranges[l];
  if(oldRanges.central[0]<=v||oldRanges.central[1]<=oldRanges.central[0]||oldRanges.central[1]>=1)fail('EAST_RELEASE_CENTRAL_RANGE',{lane:l,v,oldRanges});
  const map=q=>(a+(q-v)*b)/length;
  curves[l]=arcParts([{curve:east[l],start:0,end:1},{curve:old,start:v,end:1}]);
  specs[l]={...retainedRelease.specs[l],id:EAST_CLIFF_PRODUCTION_RELEASE_VERSION+'-'+l,startU:starts[l],replacementCurve:curves[l],metadata:{...retainedRelease.specs[l].metadata,clearanceVerified:false,routeStatus:'exact-remesh-dependent-offline-candidate'}};
  ranges[l]={newShore:[0,map(oldRanges.central[0])],central:oldRanges.central.map(map),oldShore:[map(oldRanges.central[1]),1]};
  segments[l]={newShore:span(curves[l],0,ranges[l].newShore[1]),central:retainedRelease.segments[l].central,oldShore:retainedRelease.segments[l].oldShore,retainedOld:retainedRelease.segments[l].retainedOld};
  joins.push(join(segments[l].newShore,1,segments[l].central,0,l+' newShore-central'),join(segments[l].central,1,segments[l].oldShore,0,l+' central-oldShore'));
  mapping[l]={eastLength:a,retainedReleaseLength:b,newLength:length,retainedFraction:v,eastEnd:a/length,mapRetainedProgress(q){if(!Number.isFinite(q)||q<v||q>1)fail('EAST_RELEASE_NOT_RETAINED',{lane:l,q});return map(q);}};
  laneAudit[l]=shape(curves[l]);if(!laneAudit[l].pass)fail('EAST_RELEASE_SHAPE',{lane:l,audit:laneAudit[l]});
  impact[l]={sourceStartU:starts[l],previousSourceStartU:retainedRelease.specs[l].startU,endU:specs[l].endU,additionalSourceSpan:(retainedRelease.specs[l].startU-starts[l])*sourceCurves[l].getLength()};
 }
 // Geometric station correspondence, not equal fractions. Use closest points
 // on the complete composed red/blue replacement within its east neighbourhood.
 if(seaRadiusAt!==null&&typeof seaRadiusAt!=='function')fail('EAST_RELEASE_SEA_CALLBACK');
 const seaGuide={sampled:0,missing:0,minRailCenterAboveSea:null,scope:'Center guide radius only; not expanded vehicle bottom, waves or a water-clearance acceptance.'};
 const correspondence={samples:0,minLaneDistance:Infinity,maxLaneDistance:0,maxCenterOffset:0,maxRadialMidpointDifference:0,monotonic:true,rows:[]};
 let previous={red:-Infinity,blue:-Infinity};const count=Math.ceil(east.center.getLength()/1.5);
 for(let i=0;i<=count;i++){
  const c=east.center.getPointAt(i/count),tan=east.center.getTangentAt(i/count),rad=c.clone().normalize(),axis=rad.clone().cross(tan).normalize(),points={},parameters={};
  for(const l of['red','blue']){const n=nearest(curves[l],c,0,Math.min(1,mapping[l].eastEnd+10/curves[l].getLength()),256);parameters[l]=n.u;points[l]=curves[l].getPointAt(n.u);if(n.u<previous[l]-1e-7)correspondence.monotonic=false;previous[l]=n.u;}
  if(seaRadiusAt){const sea=seaRadiusAt(c.clone());if(!Number.isFinite(sea)||sea<=0)seaGuide.missing++;else{seaGuide.sampled++;const h=c.length()-sea;seaGuide.minRailCenterAboveSea=seaGuide.minRailCenterAboveSea===null?h:Math.min(seaGuide.minRailCenterAboveSea,h);}}
  const left=points.red.clone().sub(c).dot(axis),right=points.blue.clone().sub(c).dot(axis),distance=points.red.distanceTo(points.blue),offset=Math.abs(left+right)/2,mid=points.red.clone().add(points.blue).multiplyScalar(.5);
  correspondence.samples++;correspondence.minLaneDistance=Math.min(correspondence.minLaneDistance,distance);correspondence.maxLaneDistance=Math.max(correspondence.maxLaneDistance,distance);correspondence.maxCenterOffset=Math.max(correspondence.maxCenterOffset,offset);correspondence.maxRadialMidpointDifference=Math.max(correspondence.maxRadialMidpointDifference,Math.abs(c.length()-mid.length()));
  if(i%10===0||i===count)correspondence.rows.push({centerU:i/count,redU:parameters.red,blueU:parameters.blue,redSide:left,blueSide:right,distance,radialCenter:c.length(),radialMidpoint:mid.length()});
  if(left>=-.8||right<=.8||distance<3.7||distance>4.5||offset>.25)fail('EAST_RELEASE_CENTER_CORRESPONDENCE',{i,left,right,distance,offset});
 }
 if(!correspondence.monotonic)fail('EAST_RELEASE_CENTER_NONMONOTONIC');
 let cityGalleryCoverage=null;
 if(cityGalleryScope!==false){
  if(cityGalleryScope!==true&&(typeof cityGalleryScope!=='object'||cityGalleryScope===null||Array.isArray(cityGalleryScope)))fail('EAST_RELEASE_CITY_SCOPE');
  const x=cityGalleryScope===true?120:cityGalleryScope.entryCastleX??120;
  if(!Number.isFinite(x)||x<110||x>130)fail('EAST_RELEASE_CITY_ENTRY_X');
  const inv=castleMatrix.clone().invert(),center=curves.center,last=ranges.center.newShore[1];let lo=null,hi=null,previous=center.getPointAt(0).applyMatrix4(inv).x;
  for(let i=1;i<=1024;i++){const u=last*i/1024,value=center.getPointAt(u).applyMatrix4(inv).x;if(previous>x&&value<=x){lo=last*(i-1)/1024;hi=u;break;}previous=value;}
  if(lo===null)fail('EAST_RELEASE_CITY_ENTRY_NOT_FOUND');
  for(let i=0;i<48;i++){const u=(lo+hi)/2;if(center.getPointAt(u).applyMatrix4(inv).x>x)lo=u;else hi=u;}
  const centerU=(lo+hi)/2,world=center.getPointAt(centerU),local=world.clone().applyMatrix4(inv),chartUp=new T.Vector3(0,1,0).transformDirection(castleMatrix);
  if(world.clone().normalize().dot(chartUp)<=.15)fail('EAST_RELEASE_CITY_ENTRY_WRONG_HEMISPHERE');
  const boundaries={};
  for(const l of LANES){const anchor=l==='center'?{u:centerU,distance:0}:nearest(curves[l],world,0,ranges[l].newShore[1],512),u=anchor.u;
   if(anchor.distance>2.3||u<=0||u>=ranges[l].newShore[1])fail('EAST_RELEASE_CITY_LANE_STATION',{lane:l,...anchor});
   segments[l].globalApproach=span(curves[l],0,u);segments[l].newShore=span(curves[l],u,ranges[l].newShore[1]);ranges[l].globalApproach=[0,u];ranges[l].newShore=[u,ranges[l].newShore[1]];
   boundaries[l]={replacementU:u,world:curves[l].getPointAt(u).toArray(),castleLocal:curves[l].getPointAt(u).applyMatrix4(inv).toArray(),fromSourceHeadMetres:u*curves[l].getLength(),cityNewShoreLength:segments[l].newShore.getLength(),distanceToCenter:anchor.distance};
  }
  cityGalleryCoverage={enabled:true,entryCastleX:x,centerWorld:world.toArray(),centerLocal:local.toArray(),boundaries,globalApproachSupportBuilt:false,hardFailures:[{code:'GLOBAL_APPROACH_SUPPORT_UNBUILT',message:'Continuous tracks are prepared but the replacement global connector needs independently verified world-radial foundations/support. Do not install by hiding this gap.'}],parameterDomain:'replacement arc fractions, not original-source parameters',requiredGenericSupport:'globalApproach',structureCoverage:'newShore + central + oldShore only'};
 }
 const retainedOldSourceIntervals=retainedRelease.report?.retainedOldSourceIntervals;
 if(!LANES.every(l=>Array.isArray(retainedOldSourceIntervals?.[l])&&retainedOldSourceIntervals[l].length===2&&retainedOldSourceIntervals[l][0]===specs[l].endU))fail('EAST_RELEASE_RETAINED_SOURCE_INTERVALS');
 const report={version:EAST_CLIFF_PRODUCTION_RELEASE_VERSION,enabled:true,accepted:false,installed:false,status:'prepared-not-installed',sourceIntervals:Object.fromEntries(LANES.map(l=>[l,[starts[l],specs[l].endU]])),retainedOldSourceIntervals:structuredClone(retainedOldSourceIntervals),sourceImpact:impact,cityGalleryCoverage,laneAudit,joins,centerAnchor:{...anchor,bracket},terrainGeometryAuditInherited:false,centerCorrespondence:correspondence,seaGuide,terrainDependency,structureVerified:false,actorsVerified:false,waterReserveVerified:false,stationRuntimeVerified:false,limitations:['The advisor east red/blue terrain audit is external evidence; this wrapper does not repeat or certify it. No full scene or upper gallery clearance is implied.','Exact remesh is mandatory. Old coastal cuts are bootstrap inputs, not sufficient final terrain.','Station/loading and interlocking consumers must be rebuilt from this startup curve set before any vehicles exist.','Expanded-body .3m water reserve failed in the advisor audit; actual lowest vehicle and dynamic waves remain unverified.','New eastern gallery and public-side links require resurvey; no installation occurs.']};
 const release={...retainedRelease,version:EAST_CLIFF_PRODUCTION_RELEASE_VERSION,curves,specs,ranges,segments,worldCurve:curves.center,castleMatrix:castleMatrix.clone(),walkingConnection:{kind:'stacked-connected'},structureOptions:{...retainedRelease.structureOptions,newCityTransitLinks:false},coastalCliffCuts:retainedRelease.coastalCliffCuts,terrainDependency,report};
 const startupPreview=prepareCitadelRailStartup(sourceCurves,specs);if(!startupPreview.splice)fail('EAST_RELEASE_STARTUP',startupPreview.report.error);
 if(cityGalleryCoverage){
  cityGalleryCoverage.globalParameterIntervals={};
  for(const l of LANES){const interval=startupPreview.splice.lanes[l].report.replacementInterval,u=cityGalleryCoverage.boundaries[l].replacementU,cut=interval[0]+u*(interval[1]-interval[0]);cityGalleryCoverage.globalParameterIntervals[l]={cityStructure:[cut,interval[1]],globalApproach:[interval[0],cut],sourceReplacement:[specs[l].startU,specs[l].endU],cityStartOriginalSourceU:null,explanation:'Interior city boundary is a new geometric station: no position-preserving original source u exists. Use these final-global getPointAt intervals.'};}
  release.cityGalleryCoverage=cityGalleryCoverage;
 }

 return{release,startupPreview,mapping,eastCurves:east,terrainPreparation:{bootstrapRelease:retainedRelease,artifact:terrainArtifact,requiresExactReplacement:true},rollback:{release:retainedRelease,sourceCurves},report};
}
