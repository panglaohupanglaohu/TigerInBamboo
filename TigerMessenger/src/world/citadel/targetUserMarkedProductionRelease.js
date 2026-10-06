import {createTargetUserMarkedTransitRelease} from './targetUserMarkedTransitRelease.js';
import {createTargetCliffTransitRelease} from './targetCliffTransitRelease.js';
import {targetTerrainHeight,TARGET_CITY_PLATFORMS} from './targetTerrainCandidate.js';
import {createTargetNewCityRetreatField} from './targetNewCityRetreatField.js';
import {createCastleOceanSampler} from './newCityRidgeCandidate.js';

// Startup must select the shared rail curves before terrain, cars, stations and
// signals are constructed. These callbacks describe the authored terrain for
// route diagnostics only; mountainStudy builds and audits the final cut mesh.
export function createTargetUserMarkedProductionRelease({sourceCurves,radius=160}={}) {
  const previous=createTargetCliffTransitRelease({sourceCurves});
  const sea=createCastleOceanSampler(previous.castleMatrix,radius);
  const retreat=createTargetNewCityRetreatField({platforms:TARGET_CITY_PLATFORMS});
  const terrain=(x,z)=>{
    if(x < -143 || x > 143 || z < -72 || z > 107)return null;
    const y=sea(x,z);
    return y===null?null:retreat.height(x,z,targetTerrainHeight(x,z,y,{aprons:true,saddle:true,valleyBenches:true}),y);
  };
  const release=createTargetUserMarkedTransitRelease({sourceCurves,sampleSea:sea,sampleTerrain:terrain,platforms:TARGET_CITY_PLATFORMS});
  release.structureOptions={galleryPierWidths:{oldShore:.9}};
  // Latest approved image: the continuous pedestrian route is on top of the
  // railway gallery. Both city links are solved against the new route; no
  // separate crossing is retained once those connections are built.
  release.walkingConnection={kind:'stacked-connected'};
  release.report.retainedOldSourceIntervals=Object.fromEntries(['red','blue','center'].map(lane=>[
    lane,[release.specs[lane].endU,previous.report.retainedOldSourceIntervals[lane][1]],
  ]));
  release.report.startupSampling='Authored preliminary terrain only; final composed-curve terrain and structure require their own checks.';
  for(const [lane,audit] of Object.entries(release.report.laneAudit)) {
    if(!audit.pass)throw new Error('Marked rail shape rejected for '+lane);
  }
  return release;
}
