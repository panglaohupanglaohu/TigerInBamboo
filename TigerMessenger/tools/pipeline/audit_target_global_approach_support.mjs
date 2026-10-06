import * as T from 'three';import fs from 'node:fs';
import {actualCliffTransitFixture} from '../../tests/world/targetCliffTransitStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {createTargetGlobalRailApproachSupport} from '../../src/world/citadel/targetGlobalRailApproachSupport.js';
import {createTargetEastGlobalCrossingCandidate} from '../../src/world/citadel/targetEastGlobalCrossingCandidate.js';
import {measureGlobalApproachVehicles} from './measure_global_approach_vehicles.mjs';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {buildHills,carveHillsForTrack} from '../../src/world/hills.js';
import {officialOceanLevelAt} from '../../src/world/waterV8/officialOcean.js';
const ROOT=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/',artifact=read(base+'remesh-final-surface-geometry.json'),audit=read(base+'remesh-expanded-shift-audit.json');
const f=actualCliffTransitFixture(),retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves});let prepared=createTargetEastCliffProductionRelease({enabled:true,sourceCurves:f.sourceCurves,retainedRelease,candidateInput:audit.candidateInput,terrainArtifact:artifact,cityGalleryScope:true});
if(process.env.CROSSING_50==='1'){const c=createTargetEastGlobalCrossingCandidate({enabled:true,release:prepared.release,sourceCurves:f.sourceCurves,lateral:0,sourceExtensionMetres:50,startMetres:10,endMetres:300,frontLoadedGrade:.0395,independentRadialProfiles:true,tailGrade:-.004});if(!c.startup.splice)throw new Error('Crossing candidate splice failed');prepared={release:c.release,startupPreview:c.startup,report:c.report};}
const hills=buildHills(f.scene,160);carveHillsForTrack(hills.mesh,Object.values(prepared.startupPreview.curves),160);
const geometry=new T.BufferGeometryLoader().parse(artifact.geometry),material=new T.MeshBasicMaterial({side:T.DoubleSide}),terrain=new T.Mesh(geometry,material);terrain.position.fromArray(artifact.origin);terrain.name='east-final-refined-artifact';f.castle.add(terrain);
const waveGeometry=f.ocean.geometry.clone(),pos=waveGeometry.attributes.position;for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i);p.addScaledVector(p.clone().normalize(),.067);pos.setXYZ(i,...p.toArray());}const wave=new T.Mesh(waveGeometry,material);f.scene.add(wave);f.scene.updateMatrixWorld(true);
const ground=buildMountainSurfaceIndex([f.scene.getObjectByName('planet-surface'),hills.mesh,hills.skirt,terrain]),sea=buildMountainSurfaceIndex([f.ocean]),seaUpper=buildMountainSurfaceIndex([wave]);
const hit=(idx,p)=>{const d=p.clone().normalize();return idx.sample(new T.Ray(d.clone().multiplyScalar(500),d.clone().negate()),0,500);};
const sampleGround=p=>{const h=hit(ground,p);return h?{point:h.point,objectName:h.object.name}:null;},sampleSea=p=>({radius:hit(sea,p)?.point.length(),upperRadius:hit(seaUpper,p)?.point.length(),officialUpperRadius:160+officialOceanLevelAt(p)+.067});
let support;
try{
 const vehicles=await measureGlobalApproachVehicles(),curves=Object.fromEntries(['center','red','blue'].map(k=>[k,prepared.release.segments[k].globalApproach]));
 // Production addViaductDeck samples the FINAL center curve at floor(L/.6)
 // stations. The last retained bay is before the exact exclusion boundary.
 const global=prepared.startupPreview.curves.center,N=Math.max(240,Math.floor(global.getLength()/.6)),start=prepared.release.cityGalleryCoverage.globalParameterIntervals.center.globalApproach[0],last=Math.ceil(start*N)-1;
 const bottomSections=[last-1,last].map(i=>{const p=global.getPointAt(i/N),t=global.getTangentAt(i/N).normalize(),right=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize();return[-8.15/2,8.15/2].map(x=>p.clone().addScaledVector(right,x).addScaledVector(up,-.24).toArray());});
 support=createTargetGlobalRailApproachSupport({enabled:true,curves,sampleGround,sampleSea,vehicleBox:vehicles.box,vehicleProvenance:vehicles.report,vehicleSweepCurves:prepared.startupPreview.curves,sourceDeckInterface:{bottomSections,globalInterval:[(last-1)/N,last/N]},supportGaps:process.env.CROSSING_UNDERPASS==='1'?[{id:'retained-global-return-underpass',start:190,end:207,maxSpan:28}]:[]});
 const output={version:'actual-global-approach-support-audit-1',installed:false,accepted:false,surfaceEpoch:artifact.sourceHash,sourceFrame:artifact.origin,coverage:prepared.release.cityGalleryCoverage,routeReport:prepared.report,vehicleMeasurement:vehicles.report,report:support.report};
 const dir=new URL('artifacts/pipeline/citadel-global-approach-support-20261006/',ROOT),prefix=process.env.CROSSING_UNDERPASS==='1'?'crossing-50-underpass-':process.env.CROSSING_50==='1'?'crossing-50-':'';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(new URL(prefix+'support-audit.json',dir),JSON.stringify(output,null,2));if(support.report.built)fs.writeFileSync(new URL(prefix+'support-candidate-geometry.json',dir),JSON.stringify(support.group.toJSON()));
 console.log(JSON.stringify({vehicle:vehicles.report.box,built:support.report.built,issues:support.report.issues,water:support.report.water,foundations:support.report.foundations?.filter(f=>!f.seated),vehicleClearance:support.report.vehicleClearance,performance:support.report.performance},null,2));
}finally{support?.dispose();terrain.removeFromParent();wave.removeFromParent();geometry.dispose();waveGeometry.dispose();material.dispose();for(const m of[hills.mesh,hills.skirt]){m.geometry.dispose();m.material.dispose();m.removeFromParent();}f.dispose();}
