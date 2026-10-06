import * as T from 'three';import fs from 'node:fs';
import {actualCliffTransitFixture} from '../../tests/world/targetCliffTransitStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {createTargetEastGlobalCrossingCandidate} from '../../src/world/citadel/targetEastGlobalCrossingCandidate.js';
const ROOT=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/',out='artifacts/pipeline/citadel-global-approach-support-20261006/';
const f=actualCliffTransitFixture(),sourceCurves=f.sourceCurves,retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves}),prepared=createTargetEastCliffProductionRelease({enabled:true,sourceCurves,retainedRelease,candidateInput:read(base+'remesh-expanded-shift-audit.json').candidateInput,terrainArtifact:read(base+'remesh-final-surface-geometry.json'),cityGalleryScope:true}),release=prepared.release;
const inverse=f.castle.matrixWorld.clone().invert(),prior=read(out+'support-audit.json'),body=new T.Box3(new T.Vector3(-2.35,-.136,-3.59),new T.Vector3(2.35,5.71,3.59));
const pose=(p,t)=>{const r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize(),m=new T.Matrix4().makeBasis(r,up,t).setPosition(p);return{p,t,r,up,m,inv:m.clone().invert(),box:body.clone().applyMatrix4(m)};};
const retained=[];
for(const lane of['red','blue']){const c=sourceCurves[lane],n=Math.ceil(c.getLength());for(let i=0;i<=n;i++){const u=i/n;if(u>=release.specs[lane].startU&&u<=release.specs[lane].endU)continue;retained.push({lane,sourceU:u,...pose(c.getPointAt(u),c.getTangentAt(u).normalize())});}}
function sectionAudit(curve,headLength,specs=release.specs){const n=Math.ceil(headLength),hits=[],samples=[];let minGap=Infinity,nearest=null;
 for(let i=0;i<=n;i++){const s=headLength*i/n,u=s/curve.getLength(),p=curve.getPointAt(u),f=pose(p,curve.getTangentAt(u).normalize());samples.push({s,...f});}
 for(const q of retained){if(q.sourceU>=specs[q.lane].startU&&q.sourceU<=specs[q.lane].endU)continue;let hit=null;for(const f of samples){const delta=f.p.clone().sub(q.p),normalGap=delta.dot(q.up),planar=delta.clone().addScaledVector(q.up,-normalGap).length();if(planar<6&&normalGap>1&&q.sourceU>=release.specs[q.lane].endU&&normalGap<minGap){minGap=normalGap;nearest={s:f.s,newWorld:f.p.toArray(),newCastle:f.p.clone().applyMatrix4(inverse).toArray(),retainedWorld:q.p.toArray(),retainedCastle:q.p.clone().applyMatrix4(inverse).toArray(),lane:q.lane,sourceU:q.sourceU,normalGap,radialGap:f.p.length()-q.p.length(),normalDot:f.up.dot(q.up)};}
   const top=f.p.clone().addScaledVector(f.up,-.75),width=5.8,a=top.clone().addScaledVector(f.r,-width),b=top.clone().addScaledVector(f.r,width),bottom=top.clone().addScaledVector(f.up,-.55),broad=new T.Box3().setFromPoints([a,b,bottom.clone().addScaledVector(f.r,-width),bottom.clone().addScaledVector(f.r,width)]).expandByScalar(.6);if(!q.box.intersectsBox(broad))continue;
   // 1 m finite longitudinal strips, exact triangle/OBB narrowphase.
   const vs=[a,b,bottom.clone().addScaledVector(f.r,-width),bottom.clone().addScaledVector(f.r,width)].map(v=>v.applyMatrix4(q.inv)),t=f.t.clone().transformDirection(q.inv).multiplyScalar(.55);
   for(const pair of[[0,1],[2,3],[0,2],[1,3]]){const c=vs[pair[0]],d=vs[pair[1]],e=c.clone().add(t),g=d.clone().add(t),tri=new T.Triangle(c,d,g);if(body.intersectsTriangle(tri)||body.intersectsTriangle(new T.Triangle(c,g,e))){hit={lane:q.lane,sourceU:q.sourceU,atS:f.s,world:q.p.toArray()};break;}}if(hit)break;
  }if(hit)hits.push(hit);
 }
 return{step:headLength/n,contacts:hits.length,hits,minPositiveNormalGap:minGap,nearest};
}
const trials=[];try{
 const baseline=sectionAudit(release.curves.center,release.ranges.center.central[0]*release.curves.center.getLength());
 const baselineSourceRuns=['red','blue'].map(lane=>{const a=prior.report.vehicleClearance.collisions.filter(x=>x.lane===lane).map(x=>prepared.startupPreview.splice.lanes[lane].mapSplicedProgress(x.u).progress);return{lane,sourceInterval:[Math.min(...a),Math.max(...a)]};});
 const profiles=process.env.CROSSING_INDEPENDENT==='1'?[40,50,60,70].map(sourceExtensionMetres=>({lateral:0,sourceExtensionMetres,startMetres:10,endMetres:300,frontLoadedGrade:.0395,independentRadialProfiles:true,tailGrade:-.004})):process.env.CROSSING_COLLAR==='1'?[40,60,80,100].map(sourceExtensionMetres=>({lateral:0,sourceExtensionMetres,startMetres:10,endMetres:300,frontLoadedGrade:.034})):process.env.CROSSING_SECOND_PASS==='1'?[-60,-50,-40,40,50,60].map(lateral=>({lateral,startMetres:10,endMetres:230,fixedDirection:true,frontLoadedGrade:.0395})):[-35,-25,-15,15,25,35].map(lateral=>({lateral,startMetres:30,endMetres:300}));
 for(const profile of profiles){
  const p={enabled:true,release,sourceCurves,...profile},candidate=createTargetEastGlobalCrossingCandidate(p),r=candidate.report;
  const crossing=sectionAudit(candidate.curves.center,r.audit.center.headLength,candidate.specs);trials.push({parameters:r.parameters,shape:r.audit,splicePass:r.splicePass,crossing});console.log(JSON.stringify({parameters:r.parameters,shape:Object.fromEntries(Object.entries(r.audit).map(([k,v])=>[k,{r:v.minRadius,grade:v.maxGrade,add:v.addedLength}])),splice:r.splicePass,contacts:crossing.contacts,nearest:crossing.nearest}));
 }
 fs.writeFileSync(new URL(out+(process.env.CROSSING_INDEPENDENT==='1'?'crossing-route-trials-independent.json':process.env.CROSSING_COLLAR==='1'?'crossing-route-trials-collar.json':process.env.CROSSING_SECOND_PASS==='1'?'crossing-route-trials-regrade.json':'crossing-route-trials.json'),ROOT),JSON.stringify({accepted:false,installed:false,baseline,baselineSourceRuns,trials,limitations:['Curve and finite section screen only; no final terrain or constructed structure clearance for these changed curves.','City gallery cut must be recomputed before constructing any candidate route.']},null,2));
}finally{f.dispose();}
