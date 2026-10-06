import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
// Inert HUD import hooks only. This test launches no browser or renderer.
const pd=globalThis.document,pw=globalThis.window;
globalThis.document??={getElementById:()=>null};globalThis.window??={addEventListener(){}};
let createChristchurchTramSourceCurves;
try{({createChristchurchTramSourceCurves}=await import('../../src/world/tramSystem.js'));}
finally{if(pd===undefined)delete globalThis.document;else globalThis.document=pd;if(pw===undefined)delete globalThis.window;else globalThis.window=pw;}
const base=new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/',import.meta.url);
const audit=JSON.parse(fs.readFileSync(new URL('remesh-expanded-shift-audit.json',base))),artifact=JSON.parse(fs.readFileSync(new URL('remesh-expanded-geometry.json',base)));
const sourceCurves=createChristchurchTramSourceCurves(),retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves});
const options={enabled:true,sourceCurves,retainedRelease,candidateInput:audit.candidateInput,terrainArtifact:artifact,seaRadiusAt:()=>160.5};
const prepared=createTargetEastCliffProductionRelease(options),lanes=['red','blue','center'];
const close=(a,b,e=1e-8)=>assert.ok(a.distanceTo(b)<e,`distance ${a.distanceTo(b)} >= ${e}`);

test('off is inert; explicit matrix/epoch/branch/shape failures leave old release in place',()=>{
 assert.equal(createTargetEastCliffProductionRelease().release,null);
 assert.equal(createTargetEastCliffProductionRelease({enabled:false,get sourceCurves(){throw Error('must not read curves');}}).release,null);
 assert.throws(()=>createTargetEastCliffProductionRelease({enabled:true}),/EAST_RELEASE_INPUT/);
 const old=retainedRelease.curves.red.getPointAt(.3),spec=JSON.stringify(retainedRelease.report.sourceIntervals);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...artifact,castleMatrix:Array(16).fill(0)}}),/EAST_RELEASE_TERRAIN_MATRIX/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...artifact,report:{...artifact.report,closed:false}}}),/EAST_RELEASE_TERRAIN_TOPOLOGY/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,centerSourceBracket:[.1,.11]}),/EAST_RELEASE_CENTER_ANCHOR/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,candidateInput:{...audit.candidateInput,sourceStartU:.60}}),/EAST_RELEASE_JOIN/);
 close(old,retainedRelease.curves.red.getPointAt(.3));assert.equal(spec,JSON.stringify(retainedRelease.report.sourceIntervals));
});

test('audited red and blue east geometry is exact replay, not a fitted display curve',()=>{
 for(const l of['red','blue']){const samples=audit.results[0].joint[l].worldSamples;for(let i=0;i<samples.length;i+=17){const p=prepared.eastCurves[l].getPointAt(i/(samples.length-1));assert.ok(Math.hypot(...p.toArray().map((x,k)=>x-samples[i][k]))<1e-7);}}
 assert.equal(prepared.release.specs.red.startU,.59);assert.equal(prepared.release.specs.blue.startU,.5925844302347414);
 assert.ok(Math.abs(prepared.release.specs.center.startU-.5924110319368087)<1e-9);
});

test('all retained tail points and central/old-shore segments preserve original world geometry',()=>{
 for(const l of lanes){const map=prepared.mapping[l];for(let i=0;i<=150;i++){const u=map.retainedFraction+(1-map.retainedFraction)*i/150,v=map.mapRetainedProgress(u);close(prepared.release.curves[l].getPointAt(v),retainedRelease.curves[l].getPointAt(u));}
  assert.throws(()=>map.mapRetainedProgress(.1),/NOT_RETAINED/);
  assert.equal(prepared.release.segments[l].central,retainedRelease.segments[l].central);assert.equal(prepared.release.segments[l].oldShore,retainedRelease.segments[l].oldShore);
  const s=prepared.release.segments[l];close(s.newShore.getPointAt(1),s.central.getPointAt(0));close(s.central.getPointAt(1),s.oldShore.getPointAt(0));
 }
 assert.ok(prepared.report.joins.every(j=>j.position<=1e-4&&j.tangent<=.5));
});

test('three startup routes preserve source exterior, seam and distance mapping atomically',()=>{
 assert.equal(prepared.startupPreview.report.status,'composed-before-construction');
 for(const l of lanes){const splice=prepared.startupPreview.splice.lanes[l],source=sourceCurves[l],curve=prepared.startupPreview.curves[l],spec=prepared.release.specs[l];
  for(const u of[0,.1,spec.startU/2,(spec.endU+1)/2,.99999,1]){const mapped=splice.mapOriginalProgress(u);close(curve.getPointAt(mapped.progress),source.getPointAt(u));}
  close(curve.getPointAt(0),curve.getPointAt(1),1e-4);
  for(const u of[.05,.3,.95]){const next=splice.mapOriginalProgress(u),back=splice.mapSplicedProgress(next.progress);assert.ok(Math.abs(back.progress-u)<1e-12);}
  assert.throws(()=>splice.mapOriginalProgress((spec.startU+spec.endU)/2),{code:'VEHICLE_INSIDE_REPLACED_INTERVAL'});
 }
 assert.equal(prepared.rollback.release,retainedRelease);assert.equal(prepared.rollback.sourceCurves,sourceCurves);
});

test('center is independently anchored and geometrically paired, not fraction-averaged',()=>{
 const c=prepared.report.centerCorrespondence;assert.ok(c.monotonic);assert.ok(c.samples>=170);assert.ok(c.minLaneDistance>3.9&&c.maxLaneDistance<4.3);assert.ok(c.maxCenterOffset<.07);assert.ok(c.maxRadialMidpointDifference<.11);
 assert.ok(c.rows.some(p=>Math.abs(p.redU-p.blueU)>.01));
 assert.ok(c.rows.every(p=>p.redSide<0&&p.blueSide>0));
 assert.ok(lanes.every(l=>prepared.report.laneAudit[l].pass));
 assert.equal(prepared.report.seaGuide.sampled,c.samples);assert.equal(prepared.report.seaGuide.missing,0);assert.ok(prepared.report.seaGuide.minRailCenterAboveSea>.64);
 assert.equal(prepared.report.waterReserveVerified,false);
});

test('source impact is lane-specific; old global western interval and stacked mode remain intact',()=>{
 for(const l of lanes){assert.deepEqual(prepared.report.retainedOldSourceIntervals[l],retainedRelease.report.retainedOldSourceIntervals[l]);assert.equal(prepared.release.specs[l].endU,retainedRelease.specs[l].endU);}
 assert.ok(prepared.report.sourceImpact.red.additionalSourceSpan>157&&prepared.report.sourceImpact.red.additionalSourceSpan<158);
 assert.notEqual(prepared.report.sourceImpact.red.additionalSourceSpan,prepared.report.sourceImpact.blue.additionalSourceSpan);
 assert.equal(prepared.release.walkingConnection.kind,'stacked-connected');assert.equal(prepared.release.structureOptions.newCityTransitLinks,false);
});

test('exact terrain dependency and bootstrap are explicit, never silently accepted or installed',()=>{
 assert.equal(prepared.terrainPreparation.bootstrapRelease,retainedRelease);assert.equal(prepared.terrainPreparation.artifact,artifact);assert.equal(prepared.release.coastalCliffCuts,retainedRelease.coastalCliffCuts);
 assert.equal(prepared.release.terrainDependency.heightfieldCutsSufficient,false);assert.equal(prepared.release.terrainDependency.required,true);
 for(const key of['accepted','installed','actorsVerified','structureVerified','stationRuntimeVerified','terrainGeometryAuditInherited'])assert.equal(prepared.report[key],false);
 assert.equal(prepared.report.seaGuide.scope.includes('not expanded vehicle'),true);
});

test('actual freight consumers can rebuild from one startup set; old station world sites remain on retained geometry',async()=>{
 const {prepareCitadelRailStartup}=await import('../../src/world/citadel/citadelRailStartup.js');
 const {factoryFreightStops,freightTrainingDepot}=await import('../../src/world/bookshopLoadingYards.js');
 const {createFreightInterlocking}=await import('../../src/gameplay/robotOps/freightInterlocking.js');
 const {FREIGHT_PITCH}=await import('../../src/assets/freightTrain.js');
 const old=prepareCitadelRailStartup(sourceCurves,retainedRelease.specs),current=prepared.startupPreview;
 const services=['red','blue'].map((l,i)=>({curve:current.curves[l],trackLen:current.curves[l].getLength(),direction:i?-1:1,progress:0,wagons:[],tram:{userData:{variant:l}}}));
 const interlocking=createFreightInterlocking(current.curves.center,services,FREIGHT_PITCH);
 assert.ok(Array.isArray(interlocking.zones));assert.ok(interlocking.zones.every(z=>Object.values(z.center).every(Number.isFinite)));assert.ok(interlocking.update() instanceof Set);
 for(const lane of['red','blue'])for(const stop of[...factoryFreightStops(160),freightTrainingDepot(160)]){
  let best=Infinity,u=0;for(let i=0;i<4096;i++){const p=old.curves[lane].getPointAt(i/4096),d=p.distanceToSquared(stop.center);if(d<best){best=d;u=i/4096;}}
  const original=old.splice.lanes[lane].mapSplicedProgress(u),mapped=current.splice.lanes[lane].mapOriginalProgress(original.progress);
  close(current.curves[lane].getPointAt(mapped.progress),old.curves[lane].getPointAt(u));
 }
});

test('production nonindexed source requires matching exact refinement provenance, never a missing index hash',()=>{
 const final=JSON.parse(fs.readFileSync(new URL('remesh-final-surface-geometry.json',base)));
 const result=createTargetEastCliffProductionRelease({...options,terrainArtifact:final});
 assert.equal(result.release.terrainDependency.sourceStage,'production-refined-nonindexed');assert.equal(result.release.terrainDependency.sourceHash.position,2638422502);
 assert.equal(result.release.terrainDependency.sourceHash.index,null);assert.equal(result.release.terrainDependency.topologyScope,'raw-welded-candidate-before-refinement');assert.equal(result.release.terrainDependency.finalRefinedTopologyVerified,false);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...final,provenance:undefined}}),/REFINED_PROVENANCE/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...final,sourceHash:{...final.sourceHash,indexed:undefined}}}),/REFINED_PROVENANCE/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...final,sourceHash:{...final.sourceHash,position:2638422503}}}),/REFINED_PROVENANCE/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...final,provenance:{...final.provenance,rawCandidate:{...final.provenance.rawCandidate,closed:false}}}}),/REFINED_PROVENANCE/);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,terrainArtifact:{...artifact,sourceHash:{...artifact.sourceHash,index:undefined}}}),/INDEX_HASH/);
});

test('optional city scope splits exact segments without changing complete global tracks and flags unsupported approach',()=>{
 const scoped=createTargetEastCliffProductionRelease({...options,cityGalleryScope:true});
 assert.equal(prepared.release.cityGalleryCoverage,undefined);
 for(const l of lanes){for(let i=0;i<=80;i++)close(scoped.release.curves[l].getPointAt(i/80),prepared.release.curves[l].getPointAt(i/80));for(let i=0;i<=80;i++)close(scoped.startupPreview.curves[l].getPointAt(i/80),prepared.startupPreview.curves[l].getPointAt(i/80));
  const parts=scoped.release.segments[l];close(parts.globalApproach.getPointAt(1),parts.newShore.getPointAt(0));close(parts.newShore.getPointAt(1),parts.central.getPointAt(0));assert.equal(parts.central,retainedRelease.segments[l].central);
  const interval=scoped.release.cityGalleryCoverage.globalParameterIntervals[l];close(scoped.startupPreview.curves[l].getPointAt(interval.cityStructure[0]),parts.newShore.getPointAt(0));assert.equal(interval.cityStartOriginalSourceU,null);
 }
 const scope=scoped.release.cityGalleryCoverage;assert.ok(Math.abs(scope.centerLocal[0]-120)<1e-8);assert.ok(Math.abs(scope.boundaries.center.cityNewShoreLength-165.37000986)<1e-5);assert.equal(scope.globalApproachSupportBuilt,false);assert.equal(scope.hardFailures[0].code,'GLOBAL_APPROACH_SUPPORT_UNBUILT');assert.equal(scoped.report.accepted,false);
 assert.throws(()=>createTargetEastCliffProductionRelease({...options,cityGalleryScope:{entryCastleX:200}}),/CITY_ENTRY_X/);
});
