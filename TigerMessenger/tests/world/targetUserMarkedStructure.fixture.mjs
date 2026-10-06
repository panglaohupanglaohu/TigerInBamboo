import * as T from 'three';
import {actualCliffTransitFixture} from './targetCliffTransitStructure.fixture.mjs';
import {createTargetUserMarkedTransitRelease} from '../../src/world/citadel/targetUserMarkedTransitRelease.js';
import {prepareCitadelRailStartup} from '../../src/world/citadel/citadelRailStartup.js';
import {applyTargetTerrainCandidate,TARGET_CITY_PLATFORMS} from '../../src/world/citadel/targetTerrainCandidate.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';

/** Actual source curves, production applyTerrain with this new release/cuts,
 * actual planet and rendered-ocean mesh. No browser, analytic seabed or renderer. */
export function actualUserMarkedStructureFixture(){
 const f=actualCliffTransitFixture(),matrix=f.castle.matrixWorld.clone(),inverse=matrix.clone().invert(),direction=new T.Vector3(0,-1,0).transformDirection(matrix);
 const terrainIndex=buildMountainSurfaceIndex([f.terrain]),seaIndex=buildMountainSurfaceIndex([f.ocean]);
 const sample=index=>(x,z)=>{const ray=new T.Ray(new T.Vector3(x,250,z).applyMatrix4(matrix),direction),hit=index.sample(ray,0,700);return hit?hit.point.clone().applyMatrix4(inverse).y:null;};
 const release=createTargetUserMarkedTransitRelease({sourceCurves:f.sourceCurves,sampleTerrain:sample(terrainIndex),sampleSea:sample(seaIndex),platforms:TARGET_CITY_PLATFORMS});
 const startup=prepareCitadelRailStartup(f.sourceCurves,release.specs);if(!startup.splice){f.dispose();throw new Error('Marked startup rejected '+JSON.stringify(startup.report));}
 const previous=globalThis.location;globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
 let terrainReport;try{const old=f.terrain.geometry;terrainReport=applyTargetTerrainCandidate(f.castle,{curves:startup.curves,coastalCliffCuts:release.coastalCliffCuts,cliffTransitRelease:release});if(old!==f.terrain.geometry)old.dispose();}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
 f.scene.updateMatrixWorld(true);return{...f,release,curves:startup.curves,startupReport:startup.report,terrainReport};
}
