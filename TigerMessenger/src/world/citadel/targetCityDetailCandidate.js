import {createTargetCliffTransitStructure} from './targetCliffTransitStructure.js?revision=4';
import {solveTargetWaterfallRailReach} from './targetWaterfallRailReach.js?revision=1';
import {createTargetOldCityWaterfrontStairs} from './targetOldCityWaterfrontStairs.js?revision=5';
import {createTargetForestCompanions} from './targetForestCompanions.js?revision=2';
import {createTargetNewCityTerraceLinks} from './targetNewCityTerraceLinks.js?revision=2';
import {createTargetCityPlayerSupport} from './targetCityPlayerSupport.js?revision=3';
import {createTargetOldCityRoofSession} from './targetOldCityRoofSession.js?revision=realm-r38';
import {createTargetBenchTurf} from './targetBenchTurf.js?revision=edge-r44';
import {createTargetFrontBayRailCandidate} from './targetFrontBayRailCandidate.js?revision=promenade-r40';
import {applyTargetCityForestClearance} from './targetCityForestClearance.js';
import {createTargetNewCityPlaza} from './targetNewCityPlaza.js?revision=3';
import {applyTargetRockAppearance} from './targetRockAppearance.js?revision=rock7-mineral-planes';
import {fitTargetCitySunShadow} from './targetCitySunShadow.js?revision=r36';
import {createMountainCloudBanksCandidate} from './mountainCloudBanksCandidate.js?revision=13-clusters-1';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {applyTargetCanopyAppearance} from './targetCanopyAppearance.js?revision=3';
import {createTargetOldCityWaterSupply} from './targetOldCityWaterSupply.js?revision=2';
import {createTargetBridgeStairConnector} from './targetBridgeStairConnector.js?revision=polygon2';
import {createTargetBayWaterAppearance} from './targetBayWaterAppearance.js?revision=7-final-wet-mask';
import * as THREE from 'three';
import {createTargetNewCityStairRoute} from './targetNewCityStairRoute.js?revision=stairs-r32-terminal-access';
import {createTargetCityBayBridge} from './targetCityBayBridge.js?revision=3';
import {createTargetOldCity,TARGET_OLD_CITY_PALETTE} from './targetOldCity.js?revision=layout-v11-street-infill';
import {createTargetNewCityStairs} from './targetNewCityStairs.js?revision=flanks-v8-secondary-1';
import {createTargetNewCityMain,createTargetNewCityApproachSampler,TARGET_NEW_CITY_MAIN_PALETTE} from './targetNewCityMain.js?revision=window-batches-1';
import {TARGET_ARCHITECTURE_PALETTE,TARGET_ARCHITECTURE_COLOUR_VERSION} from './targetArchitecturePalette.js';
import {createTargetOldCityWaterfall, TARGET_WATERFALL_PALETTE} from './targetOldCityWaterfall.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NAME = 'citadel-target-city-detail-candidate';
const degrees = value => value * Math.PI / 180;

/** Read only final, visible triangles in the castle chart. No analytic sphere
 * fallback: absence of the rendered ocean is reported rather than guessed. */
function samplers(castle, sceneRoot, terrainMeshes, oceanMesh) {
  castle.updateWorldMatrix(true, true);
  sceneRoot.updateWorldMatrix(true, true);
  const terrain = terrainMeshes || [castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
  const ocean = oceanMesh || sceneRoot.getObjectByName('planet-v8-curved-ocean');
  if (!terrain.length || !ocean?.geometry) return {error: !terrain.length ? 'missing-frozen-terrain' : 'missing-rendered-ocean'};
  let terrainIndex = buildMountainSurfaceIndex(terrain);const oceanIndex = buildMountainSurfaceIndex([ocean]);
  const planet=sceneRoot.getObjectByName('planet-surface');let planetVisible=!!planet?.geometry;for(let p=planet;p;p=p.parent)if(!p.visible)planetVisible=false;
  const foundationSurfaces=[...terrain,...(planetVisible?[planet]:[])];let foundationIndex=buildMountainSurfaceIndex(foundationSurfaces);
  const frame = castle.matrixWorld.clone(), inverse = frame.clone().invert();
  const direction = V(0, -1, 0).transformDirection(frame), ray = new THREE.Ray();
  const sample = (index, x, z) => {
    ray.set(V(x, 220, z).applyMatrix4(frame), direction);
    const hit = index.sample(ray, 0, 1000);
    if (!hit) return null;
    const point = hit.point.clone().applyMatrix4(inverse);
    return {height: point.y, point: point.toArray(), mesh: hit.object.name, faceIndex: hit.faceIndex};
  };
  let cache = new Map(),revision=0;
  const cached = (kind, index, x, z) => {
    const key = `${kind}:${x.toFixed(6)},${z.toFixed(6)}`;
    if (!cache.has(key)) cache.set(key, sample(index, x, z));
    return cache.get(key);
  };
  const api={terrain: (x, z) => cached('land', terrainIndex, x, z), foundationTerrain:(x,z)=>cached('foundation',foundationIndex,x,z), sea: (x, z) => cached('sea', oceanIndex, x, z),
    sources: {foundationTerrain:foundationSurfaces.map(m=>({name:m.name,geometry:m.geometry.uuid})),foundationMethod:'actual final mountain and visible planet-surface triangles; no analytic seabed',terrain: terrain.map(m => ({name: m.name, geometry: m.geometry.uuid, positionVersion: m.geometry.attributes.position.version})), ocean: {name: ocean.name, geometry: ocean.geometry.uuid}, method: 'final mesh triangle intersections along castle-local vertical', terrainTriangles: terrainIndex.stats.triangles, oceanTriangles: oceanIndex.stats.triangles}};
  api.prepareRefresh=()=>{
    const before={terrainIndex,foundationIndex,cache,sources:api.sources,revision};let state='prepared';
    return{commit(){
      if(state!=='prepared'||revision!==before.revision)throw new Error('surface sampler changed after preparation');
      castle.updateWorldMatrix(true,true);
      if(frame.elements.some((v,i)=>Math.abs(v-castle.matrixWorld.elements[i])>1e-9))throw new Error('castle chart changed; recreate city sampling');
      // Build all indices before publishing either cache.
      const land=buildMountainSurfaceIndex(terrain),foundation=buildMountainSurfaceIndex(foundationSurfaces);
      terrainIndex=land;foundationIndex=foundation;cache=new Map();revision++;
      api.sources={...before.sources,terrain:terrain.map(m=>({name:m.name,geometry:m.geometry.uuid,positionVersion:m.geometry.attributes.position.version})),foundationTerrain:foundationSurfaces.map(m=>({name:m.name,geometry:m.geometry.uuid})),terrainTriangles:land.stats.triangles,refreshRevision:revision};state='committed';return true;
    },rollback(){
      if(state==='rolled-back')return;
      if(state==='committed'){
        if(revision!==before.revision+1)throw new Error('surface sampler changed after commit');
        ({terrainIndex,foundationIndex,cache,revision}=before);api.sources=before.sources;
      }
      state='rolled-back';
    }};
  };
  return api;
}

function xzAt(anchor, yaw, x, z) {
  return [anchor[0] + Math.cos(yaw) * x + Math.sin(yaw) * z, anchor[2] - Math.sin(yaw) * x + Math.cos(yaw) * z];
}

/** A deterministic shoreline survey around the old platform. A candidate
 * needs dry footing behind the spillway and submerged terrain beneath each
 * falling stream. Sampled evidence is not a continuous collision certificate. */
function survey(s, width, platform, transitRelease=null, castleMatrix=null) {
  const impactZ = width * 0.163, scale = width / 9, failures = {};
  let best = null, examined = 0;
  const matrixInverse=transitRelease?castleMatrix.clone().invert():null;
  const trackSamples=transitRelease?Object.fromEntries(['red','blue'].map(lane=>[lane,Array.from({length:101},(_,i)=>transitRelease.segments[lane].oldShore.getPointAt(i/100).applyMatrix4(matrixInverse))])):null;
  for (const yawDegrees of (transitRelease?[0,15,30,45,60,-15]:[45, 35, 55, 25, 65, 75])) {
    const yaw = degrees(yawDegrees);
    for (const lateral of [0, 3, -3, 6, -6, 9, -9]) for (let forward = 21; forward <= 46; forward += 0.75) {
      examined++;
      const q = xzAt(platform, yaw, lateral, forward), root = [q[0], platform[1] - (transitRelease ? .9 : 2.67) * scale, q[1]], samples = [];
      let reason = null, minimumDry = Infinity, maximumFootY = -Infinity;
      for (const x of [-width * 0.43, -width * 0.215, 0, width * 0.215, width * 0.43]) {
        const back = xzAt(root, yaw, x, -0.9 * scale), foot = s.terrain(...back), backSea = s.sea(...back);
        const impact = xzAt(root, yaw, x, impactZ), sea = s.sea(...impact), terrain = s.terrain(...impact);
        if (!foot || !backSea || !sea || !terrain) {reason = 'surface-miss'; break;}
        minimumDry = Math.min(minimumDry, foot.height - backSea.height);
        maximumFootY = Math.max(maximumFootY, foot.height);
        if (foot.height < backSea.height + 0.05) {reason = 'no-dry-shore-footing'; break;}
        if (!transitRelease&&terrain.height > sea.height - 0.08) {reason = 'impact-over-land'; break;}
        if (foot.height > root[1] - 0.48 * scale) {reason = 'outlet-buried-in-terrain'; break;}
        if (root[1] - sea.height < 3) {reason = 'insufficient-fall'; break;}
        samples.push({x, foot, sea, impactTerrain: terrain});
      }
      if (reason) {failures[reason] = (failures[reason] || 0) + 1; continue;}
      // Prefer the target's southeast waterfront and a short supporting wall.
      let score = Math.abs(yawDegrees - 45) * 0.16 + Math.abs(lateral - 3) * 0.1 + (root[1] - maximumFootY) * 0.15 + forward * 0.015,reachResult=null;
      if(transitRelease){
        const inverseWaterfall=new THREE.Matrix4().makeRotationY(yaw);inverseWaterfall.setPosition(...root);inverseWaterfall.invert();
        const crossings=Object.fromEntries(['red','blue'].map(lane=>{const rows=trackSamples[lane].map(p=>p.clone().applyMatrix4(inverseWaterfall)),hits=[];for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(a.x*b.x<=0&&a.x!==b.x){const p=a.clone().lerp(b,-a.x/(b.x-a.x));if(p.z>=1&&p.z<=26&&p.y<-3.2)hits.push(p.toArray());}}return[lane,hits];}));
        if(!crossings.red.length||!crossings.blue.length){failures['no-two-lane-center-crossing']=(failures['no-two-lane-center-crossing']||0)+1;continue;}
        reachResult=solveTargetWaterfallRailReach({segments:['red','blue'].map(lane=>({id:lane+'-old-shore',worldCurve:transitRelease.segments[lane].oldShore,startU:0,endU:1,direction:lane==='red'?1:-1})),castleMatrix,waterfall:{position:root,yawRadians:yaw,width},bodyEnvelope:{min:[-3.49000001,-.5,-1.75],max:[3.49000001,5.36,1.75],bodyLift:.12},sampleSea:s.sea,sampleTerrain:s.terrain});
        if(!reachResult.options){for(const r of reachResult.report.reasons)failures[r.type]=(failures[r.type]||0)+1;continue;}
        reachResult.report.centerlineCrossings=crossings;
        score=reachResult.outboardReach+Math.abs(yawDegrees)*.04+Math.hypot(root[0]-platform[0],root[2]-platform[2])*.1;
      }
      if (!best || score < best.score) best = {root, yaw, yawDegrees, lateral, forward, score, samples, minimumDry,...(reachResult?{reachResult}: {})};
    }
  }
  return {selected: best, examined, failures};
}

function constructTargetCityDetailCandidate({castle, sceneRoot, terrainMeshes, oceanMesh, width = 9, seed = 20261005, newCityPalette = {}, waterfallPalette = {}, waterfallOutboardReach = 0, oldPlatform = [-55, 17, 9],fitSunShadow=true,renderer=null,includeFrontRail=true,cliffTransitRelease=null,cliffTransitStructureOptions={},cloudRailCurves=null,newCityStreetInfill=false,newCityFoundationRefinement=false,newCityWindowBatching=false,newCitySecondaryClusters=false,onOwned=()=>{}} = {}) {
  if (!castle?.isObject3D) throw new TypeError('castle Object3D is required to sample the frozen scene');
  if (!(Number.isFinite(width) && width > 0)) throw new RangeError('width must be positive and finite');
  if (oldPlatform.length !== 3 || !oldPlatform.every(Number.isFinite)) throw new TypeError('oldPlatform must be a finite castle-local triple');
  let scene = sceneRoot || castle; while (!sceneRoot && scene.parent) scene = scene.parent;
  const own=handle=>{if(handle)onOwned(handle);return handle;};
  const s = samplers(castle, scene, terrainMeshes, oceanMesh), root = new THREE.Group();
  own({dispose(){root.removeFromParent();root.clear();}});
  root.name = NAME; root.userData.preserveCitadelMaterials = true;
  const liveOcean=oceanMesh||scene.getObjectByName('planet-v8-curved-ocean');
  const bayWater = s.error||!liveOcean?.material?.isShaderMaterial ? null : own(createTargetBayWaterAppearance({ocean:liveOcean,castle,finalWetMask:true,sampleTerrain:s.terrain,sampleSea:s.sea}));
  const sunShadow=fitSunShadow?own(fitTargetCitySunShadow(scene,castle,{directionLocal:[-.45,.82,.36],renderer,softShadows:true})):null;
  const rockAppearance=own(applyTargetRockAppearance(castle));
  const canopyAppearance=own(applyTargetCanopyAppearance(castle));
  const oldPalette={...TARGET_OLD_CITY_PALETTE};
  newCityPalette={...TARGET_NEW_CITY_MAIN_PALETTE,rose:TARGET_ARCHITECTURE_PALETTE.rose,...newCityPalette};
  root.userData.targetArchitectureColourVersion=TARGET_ARCHITECTURE_COLOUR_VERSION;
  let oldCity = own(createTargetOldCity({seed,palette:oldPalette}));oldCity.group.position.fromArray(oldPlatform);oldCity.group.rotation.y=degrees(45);root.add(oldCity.group);
  const main = own(createTargetNewCityMain({seed, palette: newCityPalette, proportion:'expanded-1',batchWindowDetails:newCityWindowBatching}));
  main.group.position.set(74, 12, 33); main.group.rotation.y = degrees(-55); root.add(main.group);
  const stairs = own(createTargetNewCityStairs({seed, palette:newCityPalette,facadeFoundationRefinement:newCityFoundationRefinement, houseOffsets:{'new-city-stair-house-1--1':[6.5*Math.cos(degrees(-55)),6.5*Math.sin(degrees(-55))]}, surfaceHeightAt:s.error?null:(x,z)=>{const q=xzAt([74,12,33],degrees(-55),x,z),hit=s.terrain(...q);return hit?hit.height-12:null;}}));
  // Retain only the authored flank houses. The early descent was rejected by
  // the actual terrain audit; surveyed treads replace it rather than hiding land.
  for(const child of [...stairs.group.children])if(!/^new-city-stair-house-/.test(child.name))stairs.group.remove(child);
  stairs.group.position.copy(main.group.position);stairs.group.rotation.copy(main.group.rotation);root.add(stairs.group);
  const approach=xzAt([74,12,33],degrees(-55),main.report.stairs.bottom[0],main.report.stairs.bottom[2]);
  const mainApproach=s.error?null:own(createTargetNewCityApproachSampler({main,sampleTerrain:s.terrain,origin:[74,12,33],yaw:degrees(-55)}));
  const surveyedStairs=s.error?null:own(createTargetNewCityStairRoute({sampleSurface:mainApproach.sampleSurface,start:[approach[0],12+main.report.stairs.bottom[1],approach[1]],terminalAccess:{from:[72,68],width:2.4}}));
  if(surveyedStairs)root.add(surveyedStairs.group);
  const newPlaza=s.error?null:own(createTargetNewCityPlaza({sampleSurface:s.terrain,castle}));if(newPlaza)root.add(newPlaza.group);
  const benchTurf=s.error?null:own(createTargetBenchTurf({castle,surfaces:terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean),sampleSea:s.sea,exclusions:newPlaza?[{polygon:newPlaza.report.polygon,minY:2.2,maxY:3.5}]:[]}));if(benchTurf?.group)root.add(benchTurf.group);
  const oldPort=oldCity.report.exits.bridge,oldXZ=xzAt(oldPlatform,degrees(45),oldPort[0],oldPort[2]);
  const stackedWalking=cliffTransitRelease?.walkingConnection?.kind==='stacked-connected';
  const requestedWalking=stackedWalking?null:cliffTransitRelease?.walkingConnection??null;
  let walkingConnection=null;
  if(requestedWalking){
    if(requestedWalking.kind!=='independent-short-bridge')throw new TypeError('Unsupported walkingConnection kind');
    const points=requestedWalking.pathXZ??requestedWalking.path?.map(p=>[p[0],p[2]]);
    if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new TypeError('walkingConnection needs finite castle-local pathXZ');
    const t=surveyedStairs?.report.selected?.treads?.[14];if(!t)throw new Error('Independent short bridge requires actual surveyed tread 14');
    const oldEnd=[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],xz=points.map(p=>[...p]);
    let dockAdjustment=null;
    if(!requestedWalking.path){
      // The hand-drawn endpoint lies over lower corner treads. Resolve the
      // approach from an actual SIDE edge of tread 14, outside its walk polygon.
      const desired=xz.at(-1),edges=t.sideEdges?.filter(edge=>edge.length>=2);if(!edges?.length)throw new Error('Actual stair side-edge geometry required');
      const edge=edges.map(e=>({point:[(e[0][0]+e[1][0])/2,(e[0][1]+e[1][1])/2]})).sort((a,b)=>Math.hypot(a.point[0]-desired[0],a.point[1]-desired[1])-Math.hypot(b.point[0]-desired[0],b.point[1]-desired[1]))[0].point;
      const d=[edge[0]-t.x,edge[1]-t.z],n=Math.hypot(...d),setback=(requestedWalking.width??4.4)/2+.35,dock=[edge[0]+d[0]/n*setback,edge[1]+d[1]/n*setback];
      dockAdjustment={requested:[...desired],resolved:[...dock],distance:Math.hypot(dock[0]-desired[0],dock[1]-desired[1]),treadIndex:14,actualSideEdge:edge,reason:'short landing outside actual stair footprint; avoids overriding lower treads'};xz[xz.length-1]=dock;
    }
    if(Math.hypot(xz[0][0]-oldEnd[0],xz[0][1]-oldEnd[2])>.02)xz.unshift([oldEnd[0],oldEnd[2]]);
    const lengths=[0];for(let i=1;i<xz.length;i++)lengths.push(lengths[i-1]+Math.hypot(xz[i][0]-xz[i-1][0],xz[i][1]-xz[i-1][1]));
    if(lengths.at(-1)<1)throw new RangeError('Independent walking bridge has no usable length');
    const landingLength=lengths.length>2?lengths[1]:0,path=requestedWalking.path??xz.map((p,i)=>[p[0],oldEnd[1]+(t.top-oldEnd[1])*Math.max(0,lengths[i]-landingLength)/(lengths.at(-1)-landingLength),p[1]]);
    walkingConnection={...requestedWalking,path,dockAdjustment,oldApproachLength:landingLength,requestedPathXZ:points.map(p=>[...p])};
  }
  const bridgeArrival=walkingConnection?[...walkingConnection.path.at(-1)]:[51,12,39]; // Actual side-entry dock, independent of the rail bridge.
  const dockTangent=walkingConnection?[bridgeArrival[0]-walkingConnection.path.at(-2)[0],bridgeArrival[2]-walkingConnection.path.at(-2)[2]]:[28,6];
  const bridgeConnector=surveyedStairs?.report.selected?own(createTargetBridgeStairConnector({stairReport:surveyedStairs.report,dock:bridgeArrival,dockTangent,groundHeightAt:(x,z)=>s.terrain(x,z)?.height??null})):null;
  if(bridgeConnector){root.add(bridgeConnector.group);surveyedStairs.setSideOpeningFootprints(bridgeConnector.sideOpeningFootprints);if(walkingConnection)walkingConnection.sideOpeningFootprints=bridgeConnector.sideOpeningFootprints;}
  const bridge=cliffTransitRelease?null:own(createTargetCityBayBridge({sideOpeningFootprints:bridgeConnector?.sideOpeningFootprints||[],maxSpan:36,pierWidth:1.8,path:[[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],[-10,16,24],[23,14.8,33],bridgeArrival],groundHeightAt:s.error?null:(x,z)=>s.terrain(x,z)?.height??null,oceanHeightAt:s.error?null:(x,z)=>s.sea(x,z)?.height??null}));if(bridge)root.add(bridge.group);
  const previousWaterfallSurvey=s.error?null:survey(s,width,oldPlatform);
  const surveyReport = s.error ? {selected: null, examined: 0, failures: {[s.error]: 1}} : cliffTransitRelease?survey(s,width,oldPlatform,cliffTransitRelease,castle.matrixWorld):previousWaterfallSurvey;
  const placement = surveyReport.selected, supportGeometry = [], supportMaterials = [];
  own({dispose(){supportGeometry.forEach(g=>g.dispose());supportMaterials.forEach(m=>m.dispose());}});
  const cloudSources=terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
  root.updateMatrixWorld(true);const cloudBuildings=root.children.filter(o=>o!==benchTurf?.group).map(o=>new THREE.Box3().setFromObject(o).applyMatrix4(castle.matrixWorld));
  if(cloudRailCurves&&Object.values(cloudRailCurves).some(c=>typeof c?.getSpacedPoints!=='function'))throw new TypeError('actual cloud rail curves required');
  const cloudRail=cloudRailCurves?Object.values(cloudRailCurves).flatMap(c=>c.getSpacedPoints(Math.ceil(c.getLength()))):[];
  let detailClouds=s.error?null:own(createMountainCloudBanksCandidate(castle,{enabled:true,surfaceIndex:buildMountainSurfaceIndex(cloudSources),radius:160,waterHeight:officialOceanLevelAt,sampleSea:s.sea,clusteredComposition:true,maxBanks:9,protectedBoxes:cloudBuildings,rail:cloudRail}));
  if(detailClouds)detailClouds.report.actualRailSampleCount=cloudRail.length;
  if(detailClouds?.group){detailClouds.group.name='target-detail-mountain-cloud-banks';root.add(detailClouds.group);}
  const replacedCloudRoots=[castle.getObjectByName('citadel-mountain-cloud-banks-candidate'),castle.getObjectByName('citadel-ridge-flow-clouds')].filter(Boolean);
  let waterfall = null, support = null,waterSupply=null,cliffTransit=null,waterfallReach=null;
  const frontRail=!cliffTransitRelease&&!s.error&&includeFrontRail?own(createTargetFrontBayRailCandidate({castle,sampleTerrain:s.terrain,sampleSea:s.sea,controls:[[-44,60],[-40,108],[47,106],[83,101]]})):null;
  if(frontRail?.group)root.add(frontRail.group);
  const report = {
    sceneFlocks:(()=>{const found=[];scene.traverse(o=>{if(!o.isInstancedMesh)return;const ancestors=[];for(let p=o;p;p=p.parent)ancestors.push(p.name);if(!ancestors.some(n=>/bird|flock|vortex/i.test(n)))return;const box=new THREE.Box3().setFromObject(o),local=box.clone().applyMatrix4(castle.matrixWorld.clone().invert());found.push({name:o.name,ancestors,count:o.count,visible:o.visible,localBox:{min:local.min.toArray(),max:local.max.toArray()}});});return found;})(),
    revision: walkingConnection?'target-city-detail-candidate-4-independent-walk':cliffTransitRelease?'target-city-detail-candidate-3-cliff-transit':'target-city-detail-candidate-2', status: 'unaccepted-detached-detail-candidate', seed,
    paletteStudy:{version:TARGET_ARCHITECTURE_COLOUR_VERSION,reference:'exec-619c6b01-8d79-4ceb-833a-88da7eaf51c8.png',old:oldPalette,new:newCityPalette,scope:'building albedo only; world lighting/tone mapping unchanged; rock and planting independently owned',gpuVerified:false},
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v5-street-cameras.png',
    sourceSurfaces: s.sources || null, terrainMutation: false, existingBuildingsChanged: false, landmarksChanged: false,
    benchTurf:benchTurf?.report||null,rockAppearance:rockAppearance.report,sunShadow:sunShadow?.report||null,clouds:detailClouds?.report||null,canopyAppearance:canopyAppearance.report,bayWater:bayWater?.report||null,
    cliffTransit:null,frontRailSuppressedByCliffTransit:!!cliffTransitRelease,bridge:bridge?.report||null,bridgeConnector:bridgeConnector?.report||null,
    newPlaza:newPlaza?.report||null,frontRail:frontRail?.report||null,
    oldCity: {position:oldPlatform,yawDegrees:45,geometry:oldCity.report},
    newCityStairs: {authored:stairs.report,authoredTreadsVisible:false,surveyed:surveyedStairs?.report||null},
    newCity: {position: [74, 12, 33], yawDegrees: -55, geometry: main.report, supportSamples: []},
    waterfall: {built: false, survey: surveyReport, reason: placement ? null : 'no-sampled-dry-shore-to-open-sea-spillway'},
    validation: {visualAccepted: false, independentScore: null, navigationVerified: false, collisionVerified: false, continuousSupportVerified: false, gpuCompiled: false},
    limitations: ['Read-only triangle samples do not establish a continuous collision-free passage.', 'The rebuilt stair route and connected old-city supply channel have finite surface samples; production navigation remains uninstalled.', 'Original city buildings, sculpture and horse are retained; the review harness controls comparison visibility.'],
  };
  if (!s.error) for (const footprint of main.report.footprints.filter(f => f.floorY === 0)) {
    const points = [...footprint.polygon, footprint.polygon.reduce((a,p)=>[a[0]+p[0]/footprint.polygon.length,a[1]+p[1]/footprint.polygon.length],[0,0])];
    for (const [x, z] of points) {
      const q = xzAt([74, 12, 33], degrees(-55), x, z), sample = s.terrain(...q);
      report.newCity.supportSamples.push({part: footprint.id, corner: [q[0], 12, q[1]], surface: sample, gap: sample ? 12 - sample.height : null});
    }
  }
  const newCityGaps = report.newCity.supportSamples.filter(v => v.gap !== null).map(v => v.gap);
  report.newCity.maximumSampledSupportGap = newCityGaps.length ? Math.max(...newCityGaps) : null;
  report.newCity.minimumSampledSupportGap = newCityGaps.length ? Math.min(...newCityGaps) : null;
  report.newCity.missingSupportSamples = report.newCity.supportSamples.filter(v=>v.gap===null).length;
  report.newCity.supportAccepted = false; // Footings/continuous passage still require integration.

  // Fill only the small base gaps under authored footprints; keep terrain fixed.
  const bases=new THREE.Group();bases.name='target-city-sampled-base-footings';root.add(bases);
  const footingMaterial=new THREE.MeshStandardMaterial({color:newCityPalette.stone||'#efdcaf',roughness:.96});supportMaterials.push(footingMaterial);
  report.baseFootings=[];
  if(!s.error)for(const [label,asset,position,yaw] of [['new',main,[74,12,33],degrees(-55)],['old',oldCity,oldPlatform,degrees(45)]]){
    const local=new THREE.Group();local.position.fromArray(position);local.rotation.y=yaw;bases.add(local);
    for(const fp of asset.report.footprints.filter(f=>f.floorY===0)){
      const xs=fp.polygon.map(p=>p[0]),zs=fp.polygon.map(p=>p[1]),rows=fp.polygon.map(p=>s.terrain(...xzAt(position,yaw,...p)));
      if(rows.some(r=>!r)){report.baseFootings.push({id:label+':'+fp.id,status:'missing-surface'});continue;}
      const bottom=Math.min(...rows.map(r=>r.height))-position[1]-.06,top=0;
      if(bottom>=top)continue;
      const g=new THREE.BoxGeometry(Math.max(...xs)-Math.min(...xs),top-bottom,Math.max(...zs)-Math.min(...zs));supportGeometry.push(g);
      const mesh=new THREE.Mesh(g,footingMaterial);mesh.name='target-footing-'+label+'-'+fp.id;mesh.position.set((Math.max(...xs)+Math.min(...xs))/2,(top+bottom)/2,(Math.max(...zs)+Math.min(...zs))/2);mesh.castShadow=true;mesh.receiveShadow=true;local.add(mesh);
      report.baseFootings.push({id:label+':'+fp.id,bottomY:position[1]+bottom,topY:position[1],sampled:true,continuousProof:false});
    }
  }
  if (placement) {
    const {root: anchor, yaw} = placement, at = (x, z) => xzAt(anchor, yaw, x, z);
    const feed=oldCity.report.exits.waterfallFeed,feedXZ=xzAt(oldPlatform,degrees(45),feed[0],feed[2]),mouth=at(0,-.9);
    waterSupply=own(createTargetOldCityWaterSupply({from:[feedXZ[0],oldPlatform[1]+feed[1],feedXZ[1]],to:[mouth[0],anchor[1]+.02,mouth[1]],sampleSurface:s.terrain}));root.add(waterSupply.group);report.waterSupply=waterSupply.report;
    if(cliffTransitRelease){
      waterfallReach=placement.reachResult||solveTargetWaterfallRailReach({segments:['red','blue'].map(lane=>({id:lane+'-old-shore',worldCurve:cliffTransitRelease.segments[lane].oldShore,startU:0,endU:1,direction:lane==='red'?1:-1})),castleMatrix:castle.matrixWorld,waterfall:{position:anchor,yawRadians:yaw,width},bodyEnvelope:{min:[-3.49000001,-.5,-1.75],max:[3.49000001,5.36,1.75],bodyLift:.12},sampleSea:s.sea,sampleTerrain:s.terrain});
      if(waterfallReach.options)waterfallOutboardReach=waterfallReach.outboardReach;
      report.waterfallRailReach=waterfallReach.report;
      report.waterfallRailRelocation={previousDefault:previousWaterfallSurvey?.selected?{position:previousWaterfallSurvey.selected.root,yawDegrees:previousWaterfallSurvey.selected.yawDegrees}:null,selected:{position:anchor,yawDegrees:placement.yawDegrees},outboardReach:waterfallReach.outboardReach,supplyConnectionLength:waterSupply.report.length??Math.hypot(feedXZ[0]-mouth[0],feedXZ[1]-mouth[1]),railSegment:'only explicitly selected oldShore red/blue',jointSurvey:true};
    }
    const impactSea = s.sea(...at(0, waterfallOutboardReach + width * 0.163));
    if (!impactSea) throw new Error('Projected waterfall lip has no sampled receiving sea; keep the previous candidate');
    waterfall = own(createTargetOldCityWaterfall({width, outboardReach:waterfallOutboardReach, dropHeight: anchor[1] - impactSea.height, seed, palette: waterfallPalette, receivingSurfaceHeightAt:(x,z)=>{const hit=s.sea(...at(x,z));return hit?hit.height-anchor[1]:null;}}));
    waterfall.group.position.fromArray(anchor); waterfall.group.rotation.y = yaw; root.add(waterfall.group);
    // Narrow retaining piers are new owned model geometry, seated into actual
    // shore triangles. They do not carve/fill the frozen terrain or old city.
    support = new THREE.Group(); support.name = 'target-waterfall-surveyed-shore-abutment';
    support.position.fromArray(anchor); support.rotation.y = yaw; root.add(support);
    const material = new THREE.MeshStandardMaterial({color: waterfallPalette.stone || TARGET_WATERFALL_PALETTE.stone, roughness: 0.96}); supportMaterials.push(material);
    const feet = [];
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * width / 9, samples = [];
      for (const dx of [-width / 18, width / 18]) for (const z of [-1.1, -0.25]) {
        const q = at(x + dx, z * width / 9), hit = s.terrain(...q); if (hit) samples.push(hit);
      }
      if (samples.length !== 4) continue;
      const bottom = Math.min(...samples.map(v => v.height)) - anchor[1] - 0.15, top = -0.45 * width / 9;
      if (bottom >= top) continue;
      const geometry = new THREE.BoxGeometry(width / 9 + 0.015, top - bottom, 0.95 * width / 9); supportGeometry.push(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `surveyed-spillway-retaining-pier-${i}`;
      mesh.position.set(x, (top + bottom) / 2, -0.65 * width / 9); mesh.castShadow = true; mesh.receiveShadow = true; support.add(mesh);
      feet.push({name: mesh.name, bottomY: anchor[1] + bottom, sampledSurface: samples});
    }
    // Warp only our water mesh's lower vertices onto the actual curved mesh.
    // Its authored upper lip remains unchanged. CPU flow updates read this base.
    let endpointResidual = 0, missingEndpointSamples = 0;
    const ends = [];
    waterfall.group.traverse(mesh => {
      const base = mesh.geometry?.userData.basePositions, uv = mesh.geometry?.attributes.uv;
      if (!base || !uv) return;
      const streamSize = uv.count / waterfall.report.outletCount;
      let columns = 0; while (columns < streamSize && uv.getY(columns) === 0) columns++;
      for (let i = 0; i < uv.count; i++) {
        const t = uv.getY(i), x = base[i * 3], z = base[i * 3 + 2];
        // Use the endpoint's x and z for its whole vertical column.
        const column = i % columns, stream = Math.floor(i / streamSize), bottomIndex = (stream + 1) * streamSize - columns + column;
        const q = at(base[bottomIndex * 3], base[bottomIndex * 3 + 2]), hit = s.sea(...q);
        if (!hit) {if (t === 1) missingEndpointSamples++; continue;}
        base[i * 3 + 1] = -waterfall.report.dropHeight * t + (hit.height - impactSea.height) * t * t;
        if (t === 1) {
          endpointResidual = Math.max(endpointResidual, Math.abs(anchor[1] + base[i * 3 + 1] - hit.height));
          ends.push({x, z, y: anchor[1] + base[i * 3 + 1], seaY: hit.height, mesh: hit.mesh, faceIndex: hit.faceIndex});
        }
      }
    });
    report.waterfall = {built: true, position: anchor, yawDegrees: placement.yawDegrees, geometry: waterfall.report, survey: surveyReport,
      receivingSea: impactSea, bottomEndpoints: ends, maximumSampledEndpointResidual: endpointResidual, missingEndpointSamples,
      abutment: {newOwnedGeometry: true, parts: feet, connectionToOldCity: waterSupply?.report.status || 'supply-channel-candidate', expectedPiers: 9, builtPiers: feet.length, missingPiers: 9-feet.length},
      surfaceSamplingPassed: missingEndpointSamples === 0 && endpointResidual < 1e-4};
  }
  if(cliffTransitRelease){
    if(s.error)throw new Error('Cliff transit requires actual final terrain and rendered ocean: '+s.error);
    root.updateMatrixWorld(true);
    cliffTransit=own(createTargetCliffTransitStructure({...cliffTransitRelease.structureOptions,...cliffTransitStructureOptions,galleryMaxSpans:{...cliffTransitRelease.structureOptions?.galleryMaxSpans,...cliffTransitStructureOptions.galleryMaxSpans},galleryPierWidths:{...cliffTransitRelease.structureOptions?.galleryPierWidths,...cliffTransitStructureOptions.galleryPierWidths},release:cliffTransitRelease,walkingConnection:stackedWalking?cliffTransitRelease.walkingConnection:walkingConnection,castleMatrix:castle.matrixWorld,sampleTerrain:s.terrain,sampleRailTerrain:s.foundationTerrain,sampleSea:s.sea,connectionTargets:{old:[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],new:bridgeArrival},obstacleGroups:[oldCity.group,main.group,stairs.group,surveyedStairs?.group,bridgeConnector?.group,waterSupply?.group,support,waterfall?.group.getObjectByName('target-waterfall-stone-three-arch-outlets')].filter(Boolean)}));
    root.add(cliffTransit.group);report.cliffTransit=cliffTransit.report;
    if(walkingConnection&&(!bridgeConnector?.report.walkSurfaces.length||bridgeConnector.report.support.validated!==true||!Number.isFinite(bridgeConnector.report.maximumTriangleSlope)||bridgeConnector.report.maximumTriangleSlope>.65)){report.cliffTransit.issues.push({type:'independent-walking-bridge-city-connector-rejected'});report.cliffTransit.finitePass=false;report.cliffTransit.status='built-candidate-rejected-or-unresolved';}
    cliffTransit.report.legacyReplacement.appliedByCaller=true;cliffTransit.report.legacyReplacement.method='legacy candidate bridge not constructed in this explicit release; no external mesh removed';
    const central=cliffTransit.report.galleries.central;
    report.bridge=cliffTransit.report.independentWalkingBridge?{...cliffTransit.report.independentWalkingBridge,replacesLegacyBridge:true,independentFromRail:true}:{...central.lowerStructure,path:central.upperPath,width:central.walkwayWidth,walkSurfaces:central.walkSurfaces,replacesLegacyBridge:true};
    if(!placement){report.cliffTransit.issues.push({type:'no-valid-waterfall-rail-joint-placement'});report.cliffTransit.finitePass=false;report.cliffTransit.status='built-candidate-rejected-or-unresolved';}
    if(waterfallReach&&!waterfallReach.options){report.cliffTransit.issues.push({type:'waterfall-rail-reach-rejected',reasons:waterfallReach.report.reasons});report.cliffTransit.finitePass=false;report.cliffTransit.status='built-candidate-rejected-or-unresolved';}
  }
  // Complete the house links only after surveyed public surfaces exist.
  if(newCityStreetInfill){
    const publicSurfaces=[
      ...(report.newCityStairs.surveyed?.selected?.treads||[]).map(t=>({id:'surveyed-tread',polygon:t.polygon})),
      ...(report.bridgeConnector?.walkSurfaces||[]),
      ...Object.values(report.cliffTransit?.galleries||{}).flatMap(g=>g.walkSurfaces||[]),
      ...(report.cliffTransit?.connections||[]).flatMap(l=>(l.walkSurfaces||[]).map(s=>({id:l.id,polygon:s.corners.map(p=>[p[0],p[2]])}))),
      ...(report.cliffTransit?.newCityTransitLinks?.links||[]).flatMap(l=>l.walkSurfaces||[])
    ];
    const yaw=stairs.group.rotation.y,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const publicFootprints=publicSurfaces.filter(p=>p.polygon).map(p=>({id:p.id,polygon:p.polygon.map(([x,z])=>{const dx=x-stairs.group.position.x,dz=z-stairs.group.position.z;return[dx*cs-dz*sn,dx*sn+dz*cs];})}));
    stairs.completeStreetInfill({publicFootprints});
    if(newCitySecondaryClusters)stairs.completeSecondaryStreetClusters({enabled:true,publicFootprints,protectedFootprints:main.report.footprints});
  }
  let disposed = false, forestClearance = null, roofSession = null, playerSupport=null, terraceLinks=null, forestCompanions=null, waterfrontStairs=null;
  function completeTerraceLinks(){if(!terraceLinks&&!s.error){terraceLinks=createTargetNewCityTerraceLinks({castle,candidateRoot:root,sampleTerrain:s.terrain});root.add(terraceLinks.group);report.terraceLinks=terraceLinks.report;playerSupport?.refresh();}return terraceLinks;}
  function completeWaterfrontStairs(){
    if(waterfrontStairs||s.error||!frontRail)return waterfrontStairs;
    castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),shipWorldBoxes=[];
    scene.traverse(o=>{if(!o.userData?.warshipV6)return;const world=new THREE.Box3().setFromObject(o),local=world.getCenter(new THREE.Vector3()).applyMatrix4(inverse);if(Math.abs(local.x)<180&&Math.abs(local.z)<180&&Math.abs(local.y)<100)shipWorldBoxes.push({min:world.min.toArray(),max:world.max.toArray(),name:o.name,uuid:o.uuid});});
    waterfrontStairs=createTargetOldCityWaterfrontStairs({castle,candidateReport:report,sampleTerrain:s.terrain,sampleSea:s.sea,shipWorldBoxes,collisionGroups:[oldCity.group,main.group,stairs.group,surveyedStairs?.group,bridge?.group,cliffTransit?.group,frontRail.group,terraceLinks?.group].filter(Boolean)});
    if(waterfrontStairs.report.built)root.add(waterfrontStairs.group);
    report.waterfrontStairs=waterfrontStairs.report;report.waterfrontStairs.actualStaticShips=shipWorldBoxes;playerSupport?.refresh();return waterfrontStairs;
  }
  function getPlayerSupport(){if(!playerSupport)playerSupport=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean)});return playerSupport;}
  function clearForest(){if(!forestClearance){forestClearance=applyTargetCityForestClearance({castle,candidateRoot:root});report.forestClearance=forestClearance.report;}if(!forestCompanions&&!s.error){forestCompanions=createTargetForestCompanions({castle,candidateRoot:root,sampleTerrain:s.terrain,sampleSea:s.sea});root.add(forestCompanions.group);report.forestCompanions=forestCompanions.report;}return forestClearance;}
  function openRoofSession(editorOptions){
    if(roofSession)return roofSession;
    const createAsset=({roofRoles})=>{const next=own(createTargetOldCity({seed,roofRoles,palette:oldPalette}));next.group.position.fromArray(oldPlatform);next.group.rotation.y=degrees(45);return next;};
    const commitAsset=(next,previous)=>{
      if(previous!==oldCity||previous.group.parent!==root)throw new Error('stale old city roof transaction');
      const previousReport=report.oldCity.geometry;
      forestCompanions?.dispose();forestCompanions=null;forestClearance?.dispose();forestClearance=null;
      previous.group.removeFromParent();root.add(next.group);oldCity=next;report.oldCity.geometry=next.report;
      try{clearForest();playerSupport?.refresh();return{ok:true};}
      catch(error){forestCompanions?.dispose();forestCompanions=null;forestClearance?.dispose();forestClearance=null;next.group.removeFromParent();root.add(previous.group);oldCity=previous;report.oldCity.geometry=previousReport;clearForest();playerSupport?.refresh();throw error;}
    };
    roofSession=createTargetOldCityRoofSession({initialAsset:oldCity,createAsset,editorOptions,commitAsset});
    return roofSession;
  }
  function prepareSurfaceSamplingRefresh(){
    if(disposed||s.error)throw new Error('actual city surface sampling unavailable');
    const binding=s.prepareRefresh(),previous=report.sourceSurfaces;
    return{commit(){if(disposed)throw new Error('candidate disposed');binding.commit();report.sourceSurfaces=s.sources;return true;},rollback(){binding.rollback();report.sourceSurfaces=previous;}};
  }
  function getSurfaceSamplers(){if(disposed||s.error)throw new Error('actual city surface sampling unavailable');return{terrain:s.terrain,foundationTerrain:s.foundationTerrain,sea:s.sea};}
  const cloudBindings=new Set();
  // New terrain sampling and animation ownership must move together. Only an
  // explicit terrain transaction calls this; ordinary construction is unchanged.
  function prepareCloudRefresh({surfaceIndex,rail,protectedBoxes=[]}={}){
    if(disposed||!detailClouds||detailClouds.group.parent!==root)throw new Error('attached live cloud owner required');
    if(!surfaceIndex?.sample||!Array.isArray(rail)||rail.length<2||rail.some(p=>!p?.isVector3)||!Array.isArray(protectedBoxes))throw new TypeError('fresh final index and actual rail samples required');
    castle.updateWorldMatrix(true,true);
    const previous=detailClouds,previousReport=report.clouds,childIndex=root.children.indexOf(previous.group);
    // A whole-city/whole-gallery world AABB encloses empty rear sky on the
    // curved planet. Reserve actual solid mesh bounds, not the group's void.
    const boxes=[];
    for(const child of root.children){
      if(child===previous.group||child===benchTurf?.group)continue;
      child.traverseVisible(o=>{
        if(!o.isMesh||o.userData.skipColliders||o.userData.isOutline||/cloud|mist|water|foam|turf|grass|foliage/.test(o.name))return;
        if(o.isInstancedMesh){
          o.geometry.computeBoundingBox();const instance=new THREE.Matrix4();
          for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);if(Math.abs(instance.determinant())<1e-12)continue;boxes.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(instance)));}
        }else boxes.push(new THREE.Box3().setFromObject(o));
      });
    }
    const next=createMountainCloudBanksCandidate(castle,{enabled:true,surfaceIndex,radius:160,waterHeight:officialOceanLevelAt,sampleSea:s.sea,clusteredComposition:true,maxBanks:9,rail,protectedBoxes:[...boxes,...protectedBoxes]});
    if(!next.group||next.report.banks.length===0){next.dispose();throw Object.assign(new Error('refreshed cloud field has no valid banks'),{cloudReport:next.report});}
    next.group.name=previous.group.name;next.group.visible=previous.group.visible;
    const mask=previous.group.children.find(o=>o.isMesh)?.layers.mask??previous.group.layers.mask;
    next.group.layers.mask=previous.group.layers.mask;next.group.traverse(o=>{if(o.isMesh)o.layers.mask=mask;});
    let state='prepared';
    function attachAt(group){root.add(group);const i=root.children.indexOf(group);root.children.splice(i,1);root.children.splice(Math.min(childIndex,root.children.length),0,group);}
    const binding={report:next.report,
      commit(){
        if(state!=='prepared'||disposed||detailClouds!==previous||previous.group.parent!==root)throw new Error('cloud owner changed after preparation');
        previous.group.removeFromParent();attachAt(next.group);detailClouds=next;report.clouds=next.report;state='committed';return true;
      },
      rollback(){
        if(state==='rolled-back')return;
        if(disposed)throw new Error('cloud owner disposed during rollback');
        if(state==='committed'){
          if(detailClouds!==next)throw new Error('cloud owner changed after commit');
          next.group.removeFromParent();attachAt(previous.group);detailClouds=previous;report.clouds=previousReport;
        }
        next.dispose();state='rolled-back';cloudBindings.delete(binding);
      }
    };
    cloudBindings.add(binding);return binding;
  }
  function update(seconds = 0) {
    if (disposed || !Number.isFinite(seconds)) return;
    waterfall?.update(seconds);detailClouds?.update(seconds);

  }
  update(0); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root); report.bounds = {min: bounds.min.toArray(), max: bounds.max.toArray()};
  root.userData.detailCandidateReport = report;
  function dispose() {
    if (disposed) return; for(const binding of [...cloudBindings].reverse())binding.rollback(); disposed = true; playerSupport?.dispose();waterfrontStairs?.dispose();terraceLinks?.dispose();forestCompanions?.dispose();forestClearance?.dispose(); frontRail?.dispose(); benchTurf?.dispose(); root.removeFromParent(); bayWater?.dispose(); canopyAppearance.dispose(); rockAppearance.dispose(); sunShadow?.dispose(); newPlaza?.dispose(); detailClouds?.dispose(); mainApproach?.dispose();main.dispose(); if(roofSession)roofSession.close();else oldCity.dispose(); bridge?.dispose(); cliffTransit?.dispose(); bridgeConnector?.dispose(); stairs.dispose(); surveyedStairs?.dispose(); waterfall?.dispose(); waterSupply?.dispose();
    supportGeometry.forEach(g => g.dispose()); supportMaterials.forEach(m => m.dispose()); root.clear();
  }
  return {root, group: root, report, update, dispose, clearForest, openRoofSession, getPlayerSupport, prepareCloudRefresh, prepareSurfaceSamplingRefresh, getSurfaceSamplers, completeTerraceLinks, completeWaterfrontStairs, replacedCloudRoots};
}

export function createTargetCityDetailCandidate(options={}) {
 const owned=[];
 try {return constructTargetCityDetailCandidate({...options,onOwned(handle){owned.push(handle);options.onOwned?.(handle);}});}
 catch(error){for(const handle of owned.reverse())try{handle.dispose?.();}catch{} throw error;}
}

export function applyTargetCityDetailCandidate(castle, options = {}) {
  const previous = castle?.getObjectByName(NAME)?.userData.candidateHandle;
  if (previous) return previous;
  const candidate = createTargetCityDetailCandidate({...options, castle});
  try {castle.add(candidate.root); candidate.completeTerraceLinks();candidate.completeWaterfrontStairs();candidate.clearForest(); candidate.root.userData.candidateHandle = candidate;}
  catch(error){candidate.dispose();throw error;}
  candidate.report.status = 'unaccepted-attached-detail-candidate';
  return candidate;
}
