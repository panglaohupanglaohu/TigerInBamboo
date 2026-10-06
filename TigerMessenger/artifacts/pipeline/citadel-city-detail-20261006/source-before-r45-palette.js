import {createTargetOldCityWaterfrontStairs} from './targetOldCityWaterfrontStairs.js?revision=3';
import {createTargetForestCompanions} from './targetForestCompanions.js?revision=2';
import {createTargetNewCityTerraceLinks} from './targetNewCityTerraceLinks.js?revision=1';
import {createTargetCityPlayerSupport} from './targetCityPlayerSupport.js?revision=3';
import {createTargetOldCityRoofSession} from './targetOldCityRoofSession.js?revision=realm-r38';
import {createTargetBenchTurf} from './targetBenchTurf.js?revision=edge-r44';
import {createTargetFrontBayRailCandidate} from './targetFrontBayRailCandidate.js?revision=promenade-r40';
import {applyTargetCityForestClearance} from './targetCityForestClearance.js';
import {createTargetNewCityPlaza} from './targetNewCityPlaza.js';
import {applyTargetRockAppearance} from './targetRockAppearance.js?revision=r40';
import {fitTargetCitySunShadow} from './targetCitySunShadow.js?revision=r36';
import {createMountainCloudBanksCandidate} from './mountainCloudBanksCandidate.js?revision=9';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {applyTargetCanopyAppearance} from './targetCanopyAppearance.js?revision=3';
import {createTargetOldCityWaterSupply} from './targetOldCityWaterSupply.js?revision=2';
import {createTargetBridgeStairConnector} from './targetBridgeStairConnector.js?revision=polygon2';
import {createTargetBayWaterAppearance} from './targetBayWaterAppearance.js?revision=4';
import * as THREE from 'three';
import {createTargetNewCityStairRoute} from './targetNewCityStairRoute.js?revision=stairs-r32-terminal-access';
import {createTargetCityBayBridge} from './targetCityBayBridge.js?revision=3';
import {createTargetOldCity} from './targetOldCity.js?revision=arcade-r39';
import {createTargetNewCityStairs} from './targetNewCityStairs.js?revision=square-window-r39';
import {createTargetNewCityMain,createTargetNewCityApproachSampler} from './targetNewCityMain.js?revision=expanded-entry-r44';
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
  const terrainIndex = buildMountainSurfaceIndex(terrain), oceanIndex = buildMountainSurfaceIndex([ocean]);
  const frame = castle.matrixWorld.clone(), inverse = frame.clone().invert();
  const direction = V(0, -1, 0).transformDirection(frame), ray = new THREE.Ray();
  const sample = (index, x, z) => {
    ray.set(V(x, 220, z).applyMatrix4(frame), direction);
    const hit = index.sample(ray, 0, 1000);
    if (!hit) return null;
    const point = hit.point.clone().applyMatrix4(inverse);
    return {height: point.y, point: point.toArray(), mesh: hit.object.name, faceIndex: hit.faceIndex};
  };
  const cache = new Map();
  const cached = (kind, index, x, z) => {
    const key = `${kind}:${x.toFixed(6)},${z.toFixed(6)}`;
    if (!cache.has(key)) cache.set(key, sample(index, x, z));
    return cache.get(key);
  };
  return {terrain: (x, z) => cached('land', terrainIndex, x, z), sea: (x, z) => cached('sea', oceanIndex, x, z),
    sources: {terrain: terrain.map(m => ({name: m.name, geometry: m.geometry.uuid, positionVersion: m.geometry.attributes.position.version})), ocean: {name: ocean.name, geometry: ocean.geometry.uuid}, method: 'final mesh triangle intersections along castle-local vertical', terrainTriangles: terrainIndex.stats.triangles, oceanTriangles: oceanIndex.stats.triangles}};
}

function xzAt(anchor, yaw, x, z) {
  return [anchor[0] + Math.cos(yaw) * x + Math.sin(yaw) * z, anchor[2] - Math.sin(yaw) * x + Math.cos(yaw) * z];
}

/** A deterministic shoreline survey around the old platform. A candidate
 * needs dry footing behind the spillway and submerged terrain beneath each
 * falling stream. Sampled evidence is not a continuous collision certificate. */
function survey(s, width, platform) {
  const impactZ = width * 0.163, scale = width / 9, failures = {};
  let best = null, examined = 0;
  for (const yawDegrees of [45, 35, 55, 25, 65, 75]) {
    const yaw = degrees(yawDegrees);
    for (const lateral of [0, 3, -3, 6, -6, 9, -9]) for (let forward = 21; forward <= 46; forward += 0.75) {
      examined++;
      const q = xzAt(platform, yaw, lateral, forward), root = [q[0], platform[1] - 2.67 * scale, q[1]], samples = [];
      let reason = null, minimumDry = Infinity, maximumFootY = -Infinity;
      for (const x of [-width * 0.43, -width * 0.215, 0, width * 0.215, width * 0.43]) {
        const back = xzAt(root, yaw, x, -0.9 * scale), foot = s.terrain(...back), backSea = s.sea(...back);
        const impact = xzAt(root, yaw, x, impactZ), sea = s.sea(...impact), terrain = s.terrain(...impact);
        if (!foot || !backSea || !sea || !terrain) {reason = 'surface-miss'; break;}
        minimumDry = Math.min(minimumDry, foot.height - backSea.height);
        maximumFootY = Math.max(maximumFootY, foot.height);
        if (foot.height < backSea.height + 0.05) {reason = 'no-dry-shore-footing'; break;}
        if (terrain.height > sea.height - 0.08) {reason = 'impact-over-land'; break;}
        if (foot.height > root[1] - 0.48 * scale) {reason = 'outlet-buried-in-terrain'; break;}
        if (root[1] - sea.height < 3) {reason = 'insufficient-fall'; break;}
        samples.push({x, foot, sea, impactTerrain: terrain});
      }
      if (reason) {failures[reason] = (failures[reason] || 0) + 1; continue;}
      // Prefer the target's southeast waterfront and a short supporting wall.
      const score = Math.abs(yawDegrees - 45) * 0.16 + Math.abs(lateral - 3) * 0.1 + (root[1] - maximumFootY) * 0.15 + forward * 0.015;
      if (!best || score < best.score) best = {root, yaw, yawDegrees, lateral, forward, score, samples, minimumDry};
    }
  }
  return {selected: best, examined, failures};
}

export function createTargetCityDetailCandidate({castle, sceneRoot, terrainMeshes, oceanMesh, width = 9, seed = 20261005, newCityPalette = {}, waterfallPalette = {}, oldPlatform = [-55, 17, 9],fitSunShadow=true,renderer=null,includeFrontRail=true} = {}) {
  if (!castle?.isObject3D) throw new TypeError('castle Object3D is required to sample the frozen scene');
  if (!(Number.isFinite(width) && width > 0)) throw new RangeError('width must be positive and finite');
  if (oldPlatform.length !== 3 || !oldPlatform.every(Number.isFinite)) throw new TypeError('oldPlatform must be a finite castle-local triple');
  let scene = sceneRoot || castle; while (!sceneRoot && scene.parent) scene = scene.parent;
  const s = samplers(castle, scene, terrainMeshes, oceanMesh), root = new THREE.Group();
  root.name = NAME; root.userData.preserveCitadelMaterials = true;
  const liveOcean=oceanMesh||scene.getObjectByName('planet-v8-curved-ocean');
  const bayWater = s.error||!liveOcean?.material?.isShaderMaterial ? null : createTargetBayWaterAppearance({ocean:liveOcean,castle,sampleTerrain:s.terrain,sampleSea:s.sea});
  const sunShadow=fitSunShadow?fitTargetCitySunShadow(scene,castle,{directionLocal:[-.45,.82,.36],renderer,softShadows:true}):null;
  const rockAppearance=applyTargetRockAppearance(castle);
  const canopyAppearance=applyTargetCanopyAppearance(castle);
  let oldCity = createTargetOldCity({seed});oldCity.group.position.fromArray(oldPlatform);oldCity.group.rotation.y=degrees(45);root.add(oldCity.group);
  const main = createTargetNewCityMain({seed, palette: newCityPalette, proportion:'expanded-1'});
  main.group.position.set(74, 12, 33); main.group.rotation.y = degrees(-55); root.add(main.group);
  const stairs = createTargetNewCityStairs({seed, palette:newCityPalette, houseOffsets:{'new-city-stair-house-1--1':[6.5*Math.cos(degrees(-55)),6.5*Math.sin(degrees(-55))]}, surfaceHeightAt:s.error?null:(x,z)=>{const q=xzAt([74,12,33],degrees(-55),x,z),hit=s.terrain(...q);return hit?hit.height-12:null;}});
  // Retain only the authored flank houses. The early descent was rejected by
  // the actual terrain audit; surveyed treads replace it rather than hiding land.
  for(const child of [...stairs.group.children])if(!/^new-city-stair-house-/.test(child.name))stairs.group.remove(child);
  stairs.group.position.copy(main.group.position);stairs.group.rotation.copy(main.group.rotation);root.add(stairs.group);
  const approach=xzAt([74,12,33],degrees(-55),main.report.stairs.bottom[0],main.report.stairs.bottom[2]);
  const mainApproach=s.error?null:createTargetNewCityApproachSampler({main,sampleTerrain:s.terrain,origin:[74,12,33],yaw:degrees(-55)});
  const surveyedStairs=s.error?null:createTargetNewCityStairRoute({sampleSurface:mainApproach.sampleSurface,start:[approach[0],12+main.report.stairs.bottom[1],approach[1]],terminalAccess:{from:[72,68],width:2.4}});
  if(surveyedStairs)root.add(surveyedStairs.group);
  const newPlaza=s.error?null:createTargetNewCityPlaza({sampleSurface:s.terrain,castle});if(newPlaza)root.add(newPlaza.group);
  const benchTurf=s.error?null:createTargetBenchTurf({castle,surfaces:terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean),sampleSea:s.sea,exclusions:newPlaza?[{polygon:newPlaza.report.polygon,minY:2.2,maxY:3.5}]:[]});if(benchTurf?.group)root.add(benchTurf.group);
  const oldPort=oldCity.report.exits.bridge,oldXZ=xzAt(oldPlatform,degrees(45),oldPort[0],oldPort[2]);
  const bridgeArrival=[51,12,39]; // Side-entry route avoids the blue flank house.
  const bridgeConnector=surveyedStairs?.report.selected?createTargetBridgeStairConnector({stairReport:surveyedStairs.report,dock:bridgeArrival,groundHeightAt:(x,z)=>s.terrain(x,z)?.height??null}):null;
  if(bridgeConnector){root.add(bridgeConnector.group);surveyedStairs.setSideOpeningFootprints(bridgeConnector.sideOpeningFootprints);}
  const bridge=createTargetCityBayBridge({sideOpeningFootprints:bridgeConnector?.sideOpeningFootprints||[],maxSpan:36,pierWidth:1.8,path:[[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],[-10,16,24],[23,14.8,33],bridgeArrival],groundHeightAt:s.error?null:(x,z)=>s.terrain(x,z)?.height??null,oceanHeightAt:s.error?null:(x,z)=>s.sea(x,z)?.height??null});root.add(bridge.group);
  const surveyReport = s.error ? {selected: null, examined: 0, failures: {[s.error]: 1}} : survey(s, width, oldPlatform);
  const placement = surveyReport.selected, supportGeometry = [], supportMaterials = [];
  const cloudSources=terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
  root.updateMatrixWorld(true);const cloudBuildings=root.children.filter(o=>o!==benchTurf?.group).map(o=>new THREE.Box3().setFromObject(o).applyMatrix4(castle.matrixWorld));
  const detailClouds=s.error?null:createMountainCloudBanksCandidate(castle,{enabled:true,surfaceIndex:buildMountainSurfaceIndex(cloudSources),radius:160,waterHeight:officialOceanLevelAt,sampleSea:s.sea,protectedBoxes:cloudBuildings});
  if(detailClouds?.group){detailClouds.group.name='target-detail-mountain-cloud-banks';root.add(detailClouds.group);}
  const replacedCloudRoots=[castle.getObjectByName('citadel-mountain-cloud-banks-candidate'),castle.getObjectByName('citadel-ridge-flow-clouds')].filter(Boolean);
  let waterfall = null, support = null,waterSupply=null;
  const frontRail=!s.error&&includeFrontRail?createTargetFrontBayRailCandidate({castle,sampleTerrain:s.terrain,sampleSea:s.sea,controls:[[-59,68],[-40,108],[47,106],[83,101]]}):null;
  if(frontRail?.group)root.add(frontRail.group);
  const report = {
    sceneFlocks:(()=>{const found=[];scene.traverse(o=>{if(!o.isInstancedMesh)return;const ancestors=[];for(let p=o;p;p=p.parent)ancestors.push(p.name);if(!ancestors.some(n=>/bird|flock|vortex/i.test(n)))return;const box=new THREE.Box3().setFromObject(o),local=box.clone().applyMatrix4(castle.matrixWorld.clone().invert());found.push({name:o.name,ancestors,count:o.count,visible:o.visible,localBox:{min:local.min.toArray(),max:local.max.toArray()}});});return found;})(),
    revision: 'target-city-detail-candidate-2', status: 'unaccepted-detached-detail-candidate', seed,
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    sourceSurfaces: s.sources || null, terrainMutation: false, existingBuildingsChanged: false, landmarksChanged: false,
    benchTurf:benchTurf?.report||null,rockAppearance:rockAppearance.report,sunShadow:sunShadow?.report||null,clouds:detailClouds?.report||null,canopyAppearance:canopyAppearance.report,bayWater:bayWater?.report||null,
    bridge:bridge.report,bridgeConnector:bridgeConnector?.report||null,
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
    waterSupply=createTargetOldCityWaterSupply({from:[feedXZ[0],oldPlatform[1]+feed[1],feedXZ[1]],to:[mouth[0],anchor[1]+.02,mouth[1]],sampleSurface:s.terrain});root.add(waterSupply.group);report.waterSupply=waterSupply.report;
    const impactSea = s.sea(...at(0, width * 0.163));
    waterfall = createTargetOldCityWaterfall({width, dropHeight: anchor[1] - impactSea.height, seed, palette: waterfallPalette, receivingSurfaceHeightAt:(x,z)=>{const hit=s.sea(...at(x,z));return hit?hit.height-anchor[1]:null;}});
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
  let disposed = false, forestClearance = null, roofSession = null, playerSupport=null, terraceLinks=null, forestCompanions=null, waterfrontStairs=null;
  function completeTerraceLinks(){if(!terraceLinks&&!s.error){terraceLinks=createTargetNewCityTerraceLinks({castle,candidateRoot:root,sampleTerrain:s.terrain});root.add(terraceLinks.group);report.terraceLinks=terraceLinks.report;playerSupport?.refresh();}return terraceLinks;}
  function completeWaterfrontStairs(){
    if(waterfrontStairs||s.error||!frontRail)return waterfrontStairs;
    castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),shipWorldBoxes=[];
    scene.traverse(o=>{if(!o.userData?.warshipV6)return;const world=new THREE.Box3().setFromObject(o),local=world.getCenter(new THREE.Vector3()).applyMatrix4(inverse);if(Math.abs(local.x)<180&&Math.abs(local.z)<180&&Math.abs(local.y)<100)shipWorldBoxes.push({min:world.min.toArray(),max:world.max.toArray(),name:o.name,uuid:o.uuid});});
    waterfrontStairs=createTargetOldCityWaterfrontStairs({castle,candidateReport:report,sampleTerrain:s.terrain,sampleSea:s.sea,shipWorldBoxes,collisionGroups:[oldCity.group,main.group,stairs.group,surveyedStairs?.group,bridge.group,frontRail.group,terraceLinks?.group].filter(Boolean)});
    if(waterfrontStairs.report.built)root.add(waterfrontStairs.group);
    report.waterfrontStairs=waterfrontStairs.report;report.waterfrontStairs.actualStaticShips=shipWorldBoxes;playerSupport?.refresh();return waterfrontStairs;
  }
  function getPlayerSupport(){if(!playerSupport)playerSupport=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean)});return playerSupport;}
  function clearForest(){if(!forestClearance){forestClearance=applyTargetCityForestClearance({castle,candidateRoot:root});report.forestClearance=forestClearance.report;}if(!forestCompanions&&!s.error){forestCompanions=createTargetForestCompanions({castle,candidateRoot:root,sampleTerrain:s.terrain,sampleSea:s.sea});root.add(forestCompanions.group);report.forestCompanions=forestCompanions.report;}return forestClearance;}
  function openRoofSession(editorOptions){
    if(roofSession)return roofSession;
    const createAsset=({roofRoles})=>{const next=createTargetOldCity({seed,roofRoles});next.group.position.fromArray(oldPlatform);next.group.rotation.y=degrees(45);return next;};
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
  function update(seconds = 0) {
    if (disposed || !Number.isFinite(seconds)) return;
    waterfall?.update(seconds);detailClouds?.update(seconds);

  }
  update(0); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root); report.bounds = {min: bounds.min.toArray(), max: bounds.max.toArray()};
  root.userData.detailCandidateReport = report;
  function dispose() {
    if (disposed) return; disposed = true; playerSupport?.dispose();waterfrontStairs?.dispose();terraceLinks?.dispose();forestCompanions?.dispose();forestClearance?.dispose(); frontRail?.dispose(); benchTurf?.dispose(); root.removeFromParent(); bayWater?.dispose(); canopyAppearance.dispose(); rockAppearance.dispose(); sunShadow?.dispose(); newPlaza?.dispose(); detailClouds?.dispose(); mainApproach?.dispose();main.dispose(); if(roofSession)roofSession.close();else oldCity.dispose(); bridge.dispose(); bridgeConnector?.dispose(); stairs.dispose(); surveyedStairs?.dispose(); waterfall?.dispose(); waterSupply?.dispose();
    supportGeometry.forEach(g => g.dispose()); supportMaterials.forEach(m => m.dispose()); root.clear();
  }
  return {root, group: root, report, update, dispose, clearForest, openRoofSession, getPlayerSupport, completeTerraceLinks, completeWaterfrontStairs, replacedCloudRoots};
}

export function applyTargetCityDetailCandidate(castle, options = {}) {
  const previous = castle?.getObjectByName(NAME)?.userData.candidateHandle;
  if (previous) return previous;
  const candidate = createTargetCityDetailCandidate({...options, castle});
  castle.add(candidate.root); candidate.completeTerraceLinks();candidate.completeWaterfrontStairs();candidate.clearForest(); candidate.root.userData.candidateHandle = candidate;
  candidate.report.status = 'unaccepted-attached-detail-candidate';
  return candidate;
}
