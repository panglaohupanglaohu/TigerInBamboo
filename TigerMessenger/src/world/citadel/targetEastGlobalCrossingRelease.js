import * as T from 'three';
import {createTargetEastCliffProductionRelease} from './targetEastCliffProductionRelease.js';
import {createTargetEastGlobalCrossingCandidate} from './targetEastGlobalCrossingCandidate.js';
import {prepareCitadelRailStartup} from './citadelRailStartup.js';

export const EAST_GLOBAL_CROSSING_RELEASE_VERSION='east-global-crossing-release-candidate-1';
const LANES=['center','red','blue'];

/** Default-off, data-only composition of the exact audited local overpass.
 * Owns no scene resources, does not fetch the artifact or install consumers.
 * retainedRelease MUST be the old production user-marked release used to
 * create the artifact source epoch, NOT a previous east/global splice.
 * terrainPreparation.bootstrapStartup is exclusively for the original
 * mountain/refinement stage; startupPreview supplies ALL new rail consumers.
 */
export function createTargetEastGlobalCrossingRelease(options={}){
 if(!options.enabled)return{release:null,startupPreview:null,report:{version:EAST_GLOBAL_CROSSING_RELEASE_VERSION,enabled:false,accepted:false,installed:false}};
 const {sourceCurves,retainedRelease,candidateInput,terrainArtifact,castleMatrix=retainedRelease?.castleMatrix}=options;
 const east=createTargetEastCliffProductionRelease({enabled:true,sourceCurves,retainedRelease,candidateInput,terrainArtifact,castleMatrix,cityGalleryScope:true});
 const candidate=createTargetEastGlobalCrossingCandidate({enabled:true,release:east.release,sourceCurves,lateral:0,sourceExtensionMetres:50,startMetres:10,endMetres:300,frontLoadedGrade:.0395,independentRadialProfiles:true,tailGrade:-.004});
 if(!candidate.report.finiteShapePass||!candidate.release||!candidate.startup.splice)throw new Error('EAST_GLOBAL_RELEASE_SHAPE_REJECTED');
 const bootstrapStartup=prepareCitadelRailStartup(sourceCurves,retainedRelease.specs);
 if(!bootstrapStartup.splice)throw new Error('EAST_GLOBAL_RELEASE_BOOTSTRAP_REJECTED');
 const release=candidate.release,startupPreview=candidate.startup;
 // These are the exact production addViaductDeck station formula and bottom
 // corners, not evidence that a caller actually generated the retained bay.
 const global=startupPreview.curves.center,N=Math.max(240,Math.floor(global.getLength()/.6)),start=release.cityGalleryCoverage.globalParameterIntervals.center.globalApproach[0],last=Math.ceil(start*N)-1;
 const bottomSections=[last-1,last].map(i=>{const p=global.getPointAt(i/N),t=global.getTangentAt(i/N).normalize(),right=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize();return[-4.075,4.075].map(x=>p.clone().addScaledVector(right,x).addScaledVector(up,-.24).toArray());});
 const expectedSourceDeckInterface={bottomSections,globalInterval:[(last-1)/N,last/N]};
 const approachOptions={enabled:true,curves:Object.fromEntries(LANES.map(l=>[l,release.segments[l].globalApproach])),vehicleSweepCurves:startupPreview.curves,
  vehicleBox:new T.Box3(new T.Vector3(-1.7418749868869785,-.03600000321865082,-3.490000009536743),new T.Vector3(1.7418749868869785,5.3512131535757295,3.490000009536743)),
  vehicleProvenance:{method:'CPU actual production four freight vehicles + three transport robots; 32 running-gear phases, production +.12m lift. No wheel exceptions.',evidence:'citadel-global-approach-support-20261006/crossing-50-underpass-support-audit.json',dynamicAnimationsVerified:false},
  sampleStep:.5,pierSpacing:8,maxPierHeight:12,deckWidth:8.8,cityDeckWidth:11.6,deckThickness:.55,startDeckTop:-.49,endDeckTop:-.75,transitionLength:30,waterReserve:.05,
  supportGaps:[{id:'retained-global-return-underpass',start:190,end:207,maxSpan:28}]};
 const structureOptions={...release.structureOptions,galleryPierWidths:{...release.structureOptions?.galleryPierWidths,newShore:1.05},walkwayHeight:6.9,vehicleEnvelope:{halfWidth:1.75,halfLength:3.49,top:5.36,topMargin:.35},sampleStep:.75,newCityTransitLinks:false};
 release.structureOptions=structureOptions;
 const exclusionPlan=Object.fromEntries(LANES.map(l=>{const x=release.cityGalleryCoverage.globalParameterIntervals[l];return[l,{parameterDomain:'FINAL global getPointAt arc fraction',globalApproach:x.globalApproach.slice(),cityStructure:x.cityStructure.slice(),wholeReplacement:startupPreview.splice.lanes[l].report.replacementInterval.slice(),active:false,requireBothSupportsBuilt:true}];}));
 const report={version:EAST_GLOBAL_CROSSING_RELEASE_VERSION,enabled:true,accepted:false,installed:false,status:'offline-native-inputs-prepared',route:candidate.report,sourceDeckInterfaceVerified:false,exclusionPlan,
  missingNativeInputs:['Actual WORLD radial sampleGround/sampleSea for approach; confirm expected retained source deck bay mesh exists before passing sourceDeckInterface.','Actual castle-local terrain/sea/foundation samplers, original public connectionTargets and city obstacleGroups for city structure.','Strict bootstrap source epoch check and exact artifact application before surface indices, foliage, clouds, city and navigation.','Rebuild rails, sleepers, vehicles, stations and interlocking from startupPreview.curves; retained global structures/actors/roads and GPU still require joint checks.'],
  startupSequenceVerified:false};
 return{release,startupPreview,terrainPreparation:{...east.terrainPreparation,bootstrapStartup,bootstrapCurves:bootstrapStartup.curves,castleMatrix:castleMatrix.clone(),artifact:terrainArtifact},approachOptions,expectedSourceDeckInterface,structureOptions,exclusionPlan,rollback:{release:retainedRelease,startup:bootstrapStartup,sourceCurves},report};
}
