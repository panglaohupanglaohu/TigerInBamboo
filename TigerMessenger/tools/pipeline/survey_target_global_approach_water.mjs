import * as T from 'three';
import fs from 'node:fs';
import {actualCliffTransitFixture} from '../../tests/world/targetCliffTransitStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {surveyTargetGlobalRailApproach} from '../../src/world/citadel/targetGlobalRailApproachSurvey.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {buildHills,carveHillsForTrack} from '../../src/world/hills.js';
import {officialOceanLevelAt} from '../../src/world/waterV8/officialOcean.js';

const ROOT=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/';
const artifact=read(base+'remesh-final-surface-geometry.json'),audit=read(base+'remesh-expanded-shift-audit.json'),f=actualCliffTransitFixture();
const retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves});
const prepared=createTargetEastCliffProductionRelease({enabled:true,sourceCurves:f.sourceCurves,retainedRelease,candidateInput:audit.candidateInput,terrainArtifact:artifact,cityGalleryScope:true});
const hills=buildHills(f.scene,160);carveHillsForTrack(hills.mesh,Object.values(prepared.startupPreview.curves),160);
const geometry=new T.BufferGeometryLoader().parse(artifact.geometry),material=new T.MeshBasicMaterial({side:T.DoubleSide}),terrain=new T.Mesh(geometry,material);
terrain.name='east-final-refined-artifact';terrain.position.fromArray(artifact.origin);f.castle.add(terrain);
// Expand each ACTUAL ocean vertex by the shader's sum-of-amplitudes bound.
// This preserves the ocean's canyon profile and triangular faceting. It is a
// conservative radial envelope, not a simultaneous time value of both waves.
const waveGeometry=f.ocean.geometry.clone(),pos=waveGeometry.attributes.position,point=new T.Vector3();
for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i);point.addScaledVector(point.clone().normalize(),.067);pos.setXYZ(i,...point.toArray());}
const wave=new T.Mesh(waveGeometry,material);wave.name='ocean-shader-upper-envelope';f.scene.add(wave);f.scene.updateMatrixWorld(true);
const ground=buildMountainSurfaceIndex([f.scene.getObjectByName('planet-surface'),hills.mesh,hills.skirt,terrain]),sea=buildMountainSurfaceIndex([f.ocean]),upper=buildMountainSurfaceIndex([wave]);
function hit(index,p){const d=p.clone().normalize();return index.sample(new T.Ray(d.clone().multiplyScalar(500),d.clone().negate()),0,500);}
function sampleSurface(p){const g=hit(ground,p),s=hit(sea,p),w=hit(upper,p);return{terrainRadius:g?.point.length(),terrainObject:g?.object.name,seaRadius:s?.point.length(),seaUpperRadius:w?.point.length(),seaOfficialUpperRadius:160+officialOceanLevelAt(p)+.067};}
const curves=Object.fromEntries(['center','red','blue'].map(k=>[k,prepared.release.segments[k].globalApproach]));
const outputDir=new URL('artifacts/pipeline/citadel-global-approach-support-20261006/',ROOT);fs.mkdirSync(outputDir,{recursive:true});
function actualRailAudit(){
 const result=[];
 for(const lane of['red','blue']){
  const curve=prepared.startupPreview.curves[lane],interval=prepared.release.cityGalleryCoverage.globalParameterIntervals[lane].globalApproach;
  const near=Array.from({length:2049},(_,i)=>({u:i/2048,p:curve.getPointAt(i/2048)}));
  const nearest=p=>{let best=near[0],d=Infinity;for(const s of near){const q=s.p.distanceToSquared(p);if(q<d){best=s;d=q;}}let a=Math.max(0,best.u-1/2048),b=Math.min(1,best.u+1/2048);for(let k=0;k<24;k++){const x=a+(b-a)/3,y=b-(b-a)/3;if(curve.getPointAt(x).distanceToSquared(p)<curve.getPointAt(y).distanceToSquared(p))b=y;else a=x;}return(a+b)/2;};
  const rows=[],sleeperRows=[];
  const inspect=(p,kind,u)=>{const s=sampleSurface(p);return{kind,globalU:u,world:p.toArray(),radius:p.length(),seaGap:p.length()-s.seaRadius,waveGap:p.length()-s.seaUpperRadius,officialWaveGap:p.length()-s.seaOfficialUpperRadius};};
  for(const side of[-1,1]){
   const points=Array.from({length:720},(_,i)=>{const p=curve.getPointAt(i/720),right=p.clone().normalize().cross(curve.getTangentAt(i/720)).normalize();return p.clone().addScaledVector(right,side*.875).normalize().multiplyScalar(p.length()+.06);});
   const railCurve=new T.CatmullRomCurve3(points,true,'centripetal',.5),g=new T.TubeGeometry(railCurve,520,.035,5,true),a=g.attributes.position,idx=g.index;
   for(let i=0;i<idx.count;i+=3){const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(a,idx.getX(i+j))),center=vertices.reduce((s,v)=>s.add(v),new T.Vector3()).multiplyScalar(1/3),u=nearest(center);if(u<interval[0]||u>interval[1])continue;
    for(const p of[...vertices,center,...[0,1,2].map(j=>vertices[j].clone().lerp(vertices[(j+1)%3],.5))])rows.push(inspect(p,'actual-tube-triangle-finite-probe',u));
   }g.dispose();
  }
  const count=Math.max(32,Math.floor(curve.getLength()/1.35));for(let i=Math.ceil(interval[0]*count);i<=Math.floor(interval[1]*count);i++){
   const u=i/count,p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize();
   for(const x of[-1.09,0,1.09])for(const z of[-.12,0,.12])sleeperRows.push(inspect(p.clone().addScaledVector(r,x).addScaledVector(t,z).addScaledVector(up,-.03),'actual-sleeper-bottom',u));
  }
  const compact=items=>({probes:items.length,minSeaGap:Math.min(...items.map(r=>r.seaGap)),minWaveGap:Math.min(...items.map(r=>r.waveGap)),minOfficialWaveGap:Math.min(...items.map(r=>r.officialWaveGap)),worst:items.reduce((a,b)=>a.waveGap<b.waveGap?a:b)});
  result.push({lane,globalInterval:interval,tube:compact(rows),sleepers:compact(sleeperRows)});
 }
 return{method:'Production 720-control closed Catmull rail fit and TubeGeometry(520,.035,5,true), every scoped triangle vertices/edge midpoints/centroid; original global sleeper station phase floor(L/1.35). Interval classification by closest actual global curve point. Finite probes, not continuous triangle-ocean overlap proof.',lanes:result};
}
try{
 const result=surveyTargetGlobalRailApproach({enabled:true,curves,sampleSurface}),inverse=f.castle.matrixWorld.clone().invert();
 const centerRows=result.rows.filter(r=>r.kind==='deckTop'&&r.offset===0),runs=[];
 for(const r of centerRows){const status=r.classification==='ocean'?(r.seaGap<0?'submerged-at-rest':r.waveGap<0?'wave-envelope-wet':'dry-ocean'):'land-or-unknown';let run=runs.at(-1);if(!run||run.status!==status){run={status,start:r.distance,end:r.distance,first:r,last:r,count:0};runs.push(run);}run.end=r.distance;run.last=r;run.count++;}
 const endpoints=['center','red','blue'].map(lane=>({lane,startWorld:curves[lane].getPointAt(0).toArray(),endWorld:curves[lane].getPointAt(1).toArray(),startCastle:curves[lane].getPointAt(0).applyMatrix4(inverse).toArray(),endCastle:curves[lane].getPointAt(1).applyMatrix4(inverse).toArray(),startRadius:curves[lane].getPointAt(0).length(),endRadius:curves[lane].getPointAt(1).length()}));
 const variant=surveyTargetGlobalRailApproach({enabled:true,curves,sampleSurface,deckTop:-.06,deckBottom:-.24,deckWidth:8.15});
 const report={...result,actualRailsAndSleepers:actualRailAudit(),source:{terrainArtifact:base+'remesh-final-surface-geometry.json',sourceHash:artifact.sourceHash,origin:artifact.origin,terrainQueries:'Actual final refined artifact + createPlanet mesh + buildHills mesh/skirt after production carveHillsForTrack with composed new curves; world-radial ray first hit.',ocean:'compileOfficialOcean 72x48 + curvedWaterMaterial ocean wave .045+.022=.067; official mesh default water mask .86, surface visibility distinguished by actual ground. No GPU-time sample.',noBrowser:true},endpoints,centerDeckRuns:runs.map(r=>({...r,firstCastle:new T.Vector3(...r.first.world).applyMatrix4(inverse).toArray(),lastCastle:new T.Vector3(...r.last.world).applyMatrix4(inverse).toArray()})),cityGalleryCoverage:prepared.release.cityGalleryCoverage??prepared.report.cityGalleryCoverage,
  originalGlobalDeckComparison:{deckTop:-.06,deckBottom:-.24,deckWidth:8.15,summary:variant.summary,failures:variant.failures,limitation:'Dimensions only; not permission to intersect the loaded-body lower reserve or claim a supported transition.'}};
 fs.writeFileSync(new URL('water-preflight.json',outputDir),JSON.stringify(report,null,2));
 console.log(JSON.stringify({summary:report.summary,failures:report.failures,endpoints,centerDeckRuns:runs.map(({first,last,...r})=>r),originalGlobalDeck:report.originalGlobalDeckComparison.summary.deckTop},null,2));
}finally{terrain.removeFromParent();wave.removeFromParent();geometry.dispose();waveGeometry.dispose();material.dispose();for(const m of[hills.mesh,hills.skirt]){m.geometry.dispose();m.material.dispose();m.removeFromParent();}f.dispose();}
