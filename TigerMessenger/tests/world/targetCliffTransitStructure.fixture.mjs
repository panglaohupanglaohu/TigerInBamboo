import * as T from 'three';
import {prepareCitadelRailStartup} from '../../src/world/citadel/citadelRailStartup.js';
import {createPlanet} from '../../src/world/planet.js';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetCliffTransitRelease} from '../../src/world/citadel/targetCliffTransitRelease.js';
// Only inert HUD import hooks; no browser or renderer is launched in this CPU fixture.
const previousDocument=globalThis.document,previousWindow=globalThis.window;
globalThis.document??={getElementById:()=>null};globalThis.window??={addEventListener(){}};
let createChristchurchTramSourceCurves;
try{({createChristchurchTramSourceCurves}=await import('../../src/world/tramSystem.js'));}
finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
export function actualCliffTransitFixture(){
 const sourceCurves=createChristchurchTramSourceCurves(),release=createTargetCliffTransitRelease({sourceCurves}),startup=prepareCitadelRailStartup(sourceCurves,release.specs);if(!startup.splice)throw new Error('Production curve composition rejected: '+JSON.stringify(startup.report));const scene=new T.Group(),castle=new T.Group();scene.add(castle);const planet=createPlanet(scene);castle.matrixAutoUpdate=false;castle.matrix.copy(release.castleMatrix);
 const terrain=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({side:T.DoubleSide}));terrain.name='citadel-oskar-grid-mountain-surface';castle.add(terrain);
 const previous=globalThis.location;globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
 try{const old=terrain.geometry;applyTargetTerrainCandidate(castle,{curves:startup.curves,coastalCliffCuts:release.coastalCliffCuts,cliffTransitRelease:release});old.dispose();}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
 const compiled=compileOfficialOcean().ocean,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(compiled.positions,3));g.setIndex(new T.BufferAttribute(compiled.indices,1));g.computeVertexNormals();const ocean=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));ocean.name='planet-v8-curved-ocean';scene.add(ocean);scene.updateMatrixWorld(true);
 return{scene,castle,terrain,ocean,release,sourceCurves,curves:startup.curves,startupReport:startup.report,dispose(){for(const mesh of[terrain,ocean,planet]){mesh.geometry.dispose();mesh.material.dispose();}scene.clear();}};
}
