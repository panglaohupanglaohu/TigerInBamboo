import {finishStartupSteps} from '../../core/startupTasks.js';
import {createTargetNewCityPlacement} from './targetNewCityPlacement.js';
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
import {fitTargetCitySunShadow} from './targetCitySunShadow.js?revision=r37-follow';
import {createMountainCloudBanksCandidate} from './mountainCloudBanksCandidate.js?revision=14-circuits-1';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {applyTargetCanopyAppearance} from './targetCanopyAppearance.js?revision=3';
import {createTargetOldCityWaterSupply} from './targetOldCityWaterSupply.js?revision=2';
import {createTargetBridgeStairConnector} from './targetBridgeStairConnector.js?revision=polygon2';
import {createTargetBayWaterAppearance} from './targetBayWaterAppearance.js?revision=8-shore-pier-ripples';
import * as THREE from 'three';
import {createTargetNewCityStairRoute} from './targetNewCityStairRoute.js?revision=stairs-r32-terminal-access';
import {createTargetCityBayBridge} from './targetCityBayBridge.js?revision=3';
import {createTargetOldCity,TARGET_OLD_CITY_PALETTE} from './targetOldCity.js?revision=layout-v11-street-infill';
import {createTargetNewCityStairs} from './targetNewCityStairs.js?revision=flanks-v9-radial-solid-1';
import {createTargetNewCityMain,createTargetNewCityApproachSampler,TARGET_NEW_CITY_MAIN_PALETTE} from './targetNewCityMain.js?revision=walled-court-1';
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
  // Sample actual final triangles along an architectural frame's vertical.
  // Returning frame-local height lets foundations and courtyard seats share the
  // same rigid transform as their visible geometry, rather than subtracting Y.
  api.terrainInFrame=(placement,x,z)=>{
    const worldFrame=frame.clone().multiply(placement),worldInverse=worldFrame.clone().invert();
    const localRay=new THREE.Ray(V(x,220,z).applyMatrix4(worldFrame),V(0,-1,0).transformDirection(worldFrame));
    const hit=terrainIndex.sample(localRay,0,1000);if(!hit)return null;
    const point=hit.point.clone().applyMatrix4(worldInverse),chart=hit.point.clone().applyMatrix4(inverse);
    return{height:point.y,point:point.toArray(),castlePoint:chart.toArray(),mesh:hit.object.name,faceIndex:hit.faceIndex};
  };
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

/** Replace the connector's tilted fan with shared-height stone terraces.
 * Equal height contours are shared across fan triangles, so there are no
 * independent grid-cell heights or diagonal cracks. Fixed XZ footprint stays. */
function stepBridgeConnector(connector,castleMatrix,rise=.15){
  const previous=connector.report.walkSurfaces,positions=[],walkSurfaces=[],material=connector.group.children.find(o=>o.name.startsWith('bridge-stair-connector-cell-'))?.material;
  if(!material)return;
  const clip=(poly,h,above)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[1]-h)*(above?1:-1),db=(b[1]-h)*(above?1:-1);if(da>=-1e-9)out.push(a);if((da>=0)!==(db>=0)){const t=(h-a[1])/(b[1]-a[1]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out;};
  const tri=(...vertices)=>positions.push(...vertices.flat());
  for(const surface of previous)for(const original of surface.triangles){
    const low=Math.min(...original.map(p=>p[1])),high=Math.max(...original.map(p=>p[1]));
    for(let k=Math.floor(low/rise);k<Math.ceil((high+1e-8)/rise);k++){
      const lo=k*rise,top=(k+1)*rise,poly=clip(clip(original,lo,true),top,false);if(poly.length<3)continue;
      const area=poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[2]-q[0]*p[2];},0)/2;if(Math.abs(area)<1e-9)continue;
      if(area>0)poly.reverse();const upper=poly.map(p=>[p[0],top,p[2]]),bottom=surface.footingY,lower=poly.map(p=>[p[0],bottom,p[2]]),faces=[];
      for(let j=1;j<upper.length-1;j++){tri(upper[0],upper[j],upper[j+1]);tri(lower[0],lower[j+1],lower[j]);faces.push([upper[0],upper[j],upper[j+1]]);}
      for(let j=0;j<upper.length;j++){const n=(j+1)%upper.length;tri(upper[j],lower[j],lower[n]);tri(upper[j],lower[n],upper[n]);}
      walkSurfaces.push({id:'bridge-stair-connector-stepped-floor',polygon:upper.map(p=>[p[0],p[2]]),vertices:upper,triangles:faces,top,footingY:bottom});
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  for(const mesh of [...connector.group.children])if(mesh.name.startsWith('bridge-stair-connector-cell-'))connector.group.remove(mesh);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='bridge-stair-connector-stepped-floor';mesh.castShadow=mesh.receiveShadow=true;mesh.userData.targetWalkable=true;mesh.userData.preserveCitadelMaterials=true;connector.group.add(mesh);
  const old=connector.dispose;let released=false;connector.dispose=()=>{if(released)return;released=true;geometry.dispose();old();};
  const radialSlopes=walkSurfaces.map(w=>{const points=w.triangles[0].map(p=>V(...p).applyMatrix4(castleMatrix)),normal=new THREE.Triangle(...points).getNormal(V()),up=points.reduce((sum,p)=>sum.add(p),V()).normalize(),c=Math.abs(normal.dot(up));return Math.sqrt(Math.max(0,1-c*c))/c;});
  connector.report.steppedLanding={version:'shared-height-contour-steps-1',riser:rise,terraces:walkSurfaces.length,originalMaximumTriangleSlope:connector.report.maximumTriangleSlope,originalMaximumRadialSlope:connector.report.maximumRadialSlope,maximumSurfaceLift:rise,fixedXZFootprint:true,originalSeamStepBound:rise};
  connector.report.walkSurfaces=walkSurfaces;connector.report.maximumTriangleSlope=0;connector.report.maximumRadialSlope=Math.max(...radialSlopes);connector.report.version='target-bridge-stair-connector-2-contour-steps';
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

function* constructTargetCityDetailCandidateSteps({castle, sceneRoot, terrainMeshes, oceanMesh, width = 9, seed = 20261005, newCityPalette = {}, waterfallPalette = {}, waterfallOutboardReach = 0, oldPlatform = [-55, 17, 9],fitSunShadow=true,renderer=null,includeFrontRail=true,cliffTransitRelease=null,cliffTransitStructureOptions={},cloudRailCurves=null,newCityStreetInfill=false,newCityFoundationRefinement=false,newCityWindowBatching=false,newCityWalledLayout=false,newCitySecondaryClusters=false,oldCityWingStreets=false,oldCityWingCollisionGroups=[],onOwned=()=>{}} = {}) {
  if (!castle?.isObject3D) throw new TypeError('castle Object3D is required to sample the frozen scene');
  if (!(Number.isFinite(width) && width > 0)) throw new RangeError('width must be positive and finite');
  if (oldPlatform.length !== 3 || !oldPlatform.every(Number.isFinite)) throw new TypeError('oldPlatform must be a finite castle-local triple');
  let scene = sceneRoot || castle; while (!sceneRoot && scene.parent) scene = scene.parent;
  const own=handle=>{if(handle)onOwned(handle);return handle;};
  yield '正在读取城市地基…';
  const s = samplers(castle, scene, terrainMeshes, oceanMesh), root = new THREE.Group();
  own({dispose(){root.removeFromParent();root.clear();}});
  root.name = NAME; root.userData.preserveCitadelMaterials = true;
  const liveOcean=oceanMesh||scene.getObjectByName('planet-v8-curved-ocean');
  yield '正在连接海岸水面…';
  const bayWater = s.error||!liveOcean?.material?.isShaderMaterial ? null : own(createTargetBayWaterAppearance({ocean:liveOcean,castle,finalWetMask:true,sampleTerrain:s.terrain,sampleSea:s.sea}));
  const sunShadow=fitSunShadow?own(fitTargetCitySunShadow(scene,castle,{directionLocal:[-.45,.82,.36],renderer,softShadows:true})):null;
  const rockAppearance=own(applyTargetRockAppearance(castle));
  const canopyAppearance=own(applyTargetCanopyAppearance(castle));
  const oldPalette={...TARGET_OLD_CITY_PALETTE};
  newCityPalette={...TARGET_NEW_CITY_MAIN_PALETTE,rose:TARGET_ARCHITECTURE_PALETTE.rose,...newCityPalette};
  root.userData.targetArchitectureColourVersion=TARGET_ARCHITECTURE_COLOUR_VERSION;
  yield '正在建造旧城街道…';
  let oldCity = own(createTargetOldCity({seed,palette:oldPalette,wingStreets:oldCityWingStreets}));oldCity.group.position.fromArray(oldPlatform);oldCity.group.rotation.y=degrees(45);root.add(oldCity.group);
  const newCityPlacement=createTargetNewCityPlacement(castle.matrixWorld),newCityMatrix=newCityPlacement.matrix;
  const newLocalSurface=(x,z)=>s.error?null:s.terrainInFrame(newCityMatrix,x,z)?.height??null;
  yield '正在建造新城与后院…';
  const main = own(createTargetNewCityMain({seed, palette: newCityPalette, proportion:'expanded-1',layout:newCityWalledLayout?'walled-court-1':'legacy',batchWindowDetails:newCityWindowBatching,courtyardSurfaceHeightAt:s.error?null:newLocalSurface}));
  newCityMatrix.decompose(main.group.position,main.group.quaternion,main.group.scale);root.add(main.group);
  const stairs = own(createTargetNewCityStairs({seed, palette:newCityPalette,placementMatrix:newCityMatrix,facadeFoundationRefinement:newCityFoundationRefinement, houseOffsets:{'new-city-stair-house-1--1':[6.5*Math.cos(degrees(-55)),6.5*Math.sin(degrees(-55))]}, surfaceHeightAt:s.error?null:newLocalSurface}));
  // Retain only the authored flank houses; surveyed treads connect the actual
  // tilted entrance back to the unchanged plaza and bridge endpoints.
  for(const child of [...stairs.group.children])if(!/^new-city-stair-house-/.test(child.name))stairs.group.remove(child);
  newCityMatrix.decompose(stairs.group.position,stairs.group.quaternion,stairs.group.scale);root.add(stairs.group);
  // A short solid transition joins the radial entrance to the surveyed
  // castle-chart stairs. Its rear edge is the actual transformed landing; its
  // forward edge is level in the stairs' chart, avoiding a transverse step.
  const transitionWidth=4.4,transitionLength=5,edgeZ=15.5;
  const rear=[-transitionWidth/2,transitionWidth/2].map(x=>V(...newCityPlacement.transform([x,.3,edgeZ])));
  const center=rear[0].clone().lerp(rear[1],.5),forward=V(0,0,1).transformDirection(newCityMatrix);forward.y=0;forward.normalize();
  const approach=center.clone().addScaledVector(forward,transitionLength);approach.y=center.y-1;
  const side=V(-forward.z,0,forward.x),front=[approach.clone().addScaledVector(side,transitionWidth/2),approach.clone().addScaledVector(side,-transitionWidth/2)];
  // Order corners by their actual lateral correspondence to the rear edge.
  if(front[0].distanceTo(rear[0])>front[1].distanceTo(rear[0]))front.reverse();
  const neck=front.map(p=>p.clone().addScaledVector(forward,-1.5)),transitionVertices=[];
  const emit=(a,b,c)=>{for(const p of[a,b,c])transitionVertices.push(...p.clone().applyMatrix4(newCityPlacement.inverse).toArray());};
  for(const chartCorners of[[rear[0],rear[1],neck[1],neck[0]],[neck[0],neck[1],front[1],front[0]]]){
    const cross=chartCorners[1].clone().sub(chartCorners[0]).cross(chartCorners[3].clone().sub(chartCorners[0]));
    if(cross.y>0){emit(chartCorners[0],chartCorners[1],chartCorners[2]);emit(chartCorners[0],chartCorners[2],chartCorners[3]);}
    else{emit(chartCorners[0],chartCorners[2],chartCorners[1]);emit(chartCorners[0],chartCorners[3],chartCorners[2]);}
    for(let i=0;i<4;i++){const A=chartCorners[i],B=chartCorners[(i+1)%4],a=A.clone().add(V(0,-.4,0)),b=B.clone().add(V(0,-.4,0));emit(A,B,b);emit(A,b,a);}
    const base=chartCorners.map(p=>p.clone().add(V(0,-.4,0)));emit(base[0],base[2],base[1]);emit(base[0],base[3],base[2]);
  }
  const transitionGeometry=new THREE.BufferGeometry();transitionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(transitionVertices,3));transitionGeometry.computeVertexNormals();
  const transitionMaterial=new THREE.MeshStandardMaterial({color:newCityPalette.stone||'#efdcaf',roughness:.96,side:THREE.DoubleSide});transitionMaterial.userData.preserveCitadelMaterial=true;transitionMaterial.userData.targetArchitectureColour={version:TARGET_ARCHITECTURE_COLOUR_VERSION,role:'stone',albedo:newCityPalette.stone||'#efdcaf'};
  const transition=new THREE.Mesh(transitionGeometry,transitionMaterial);transition.name='entrance-landing-radial-transition';transition.userData.targetWalkable=true;transition.userData.preserveCitadelMaterials=true;transition.castShadow=transition.receiveShadow=true;main.group.add(transition);
  let transitionDisposed=false;const transitionOwner=own({dispose(){if(transitionDisposed)return;transitionDisposed=true;transition.removeFromParent();transitionGeometry.dispose();transitionMaterial.dispose();}});
  const transitionPath=[approach.toArray(),neck[0].clone().lerp(neck[1],.5).toArray(),center.toArray()].map(p=>V(...p).applyMatrix4(newCityPlacement.inverse).toArray());
  main.report.stairs.walkPath=[...transitionPath,...main.report.stairs.walkPath];
  main.report.stairs.radialTransition={width:transitionWidth,length:transitionLength,rear:rear.map(p=>p.toArray()),front:front.map(p=>p.toArray()),walkPath:[approach.toArray(),center.toArray()],solidThickness:.4};
  const mainApproach=s.error?null:own(createTargetNewCityApproachSampler({main,sampleTerrain:s.terrain,placementMatrix:newCityMatrix}));
  const plazaStairEnd=[48.2,3,78-Math.sqrt(7.95**2-7.8**2)];
  yield '正在铺设广场台阶…';
  const surveyedStairs=s.error?null:own(createTargetNewCityStairRoute({sampleSurface:mainApproach.sampleSurface,start:approach.toArray(),end:plazaStairEnd,entryLanding:{height:approach.y,outward:[forward.x,forward.z],backLength:1},waypointRoutes:[48,46,44,42,40].map(x=>[[x,approach.z+5]]),lowerFlightSlope:.45,terminalAccess:{from:[72,68],width:2.2}}));
  if(surveyedStairs)root.add(surveyedStairs.group);
  const newPlaza=s.error?null:own(createTargetNewCityPlaza({sampleSurface:s.terrain,castle}));if(newPlaza)root.add(newPlaza.group);
  root.updateMatrixWorld(true);
  const pedestrianPaths=[surveyedStairs?.report.selected?.walkPath||[],[[72,3,78],[72,3,68],surveyedStairs?.report.end||[62,3,64]]];
  for(const owner of[main,stairs,newPlaza])if(owner?.streetDressing){const garden=owner.streetDressing;garden.protectRoutes(pedestrianPaths,root.matrixWorld.clone().invert().multiply(garden.group.matrixWorld));}
  yield '正在贴合城市草地…';
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
  yield '正在连接步行桥…';
  let bridgeConnector=null;
  if(surveyedStairs?.report.selected){
    const candidates=[];
    for(const treadIndex of Array.from({length:21},(_,i)=>6+i*2).filter(i=>i<surveyedStairs.report.selected.treads.length)){
      const connector=createTargetBridgeStairConnector({stairReport:surveyedStairs.report,dock:bridgeArrival,dockTangent,treadIndex,groundHeightAt:(x,z)=>s.terrain(x,z)?.height??null});
      const radialSlopes=connector.report.walkSurfaces.flatMap(surface=>surface.triangles.map(triangle=>{
        const points=triangle.map(p=>V(...p).applyMatrix4(castle.matrixWorld)),normal=new THREE.Triangle(...points).getNormal(V()),up=points.reduce((sum,p)=>sum.add(p),V()).normalize(),cos=Math.abs(normal.dot(up));return cos>1e-8?Math.sqrt(Math.max(0,1-cos*cos))/cos:Infinity;
      }));connector.report.maximumRadialSlope=Math.max(...radialSlopes);
      if(connector.report.support.validated&&Number.isFinite(connector.report.maximumRadialSlope))candidates.push(connector);else connector.dispose();
    }
    candidates.sort((a,b)=>(a.report.maximumRadialSlope+a.report.length*.003)-(b.report.maximumRadialSlope+b.report.length*.003));
    if(candidates.length){bridgeConnector=own(candidates.shift());bridgeConnector.report.selection={method:'actual supported connector radial triangle slope then length; fixed bridge dock',tried:21,selectedTread:bridgeConnector.report.treadIndex};}
    for(const candidate of candidates)candidate.dispose();
  }
  if(bridgeConnector){stepBridgeConnector(bridgeConnector,castle.matrixWorld);root.add(bridgeConnector.group);surveyedStairs.setSideOpeningFootprints(bridgeConnector.sideOpeningFootprints);if(walkingConnection)walkingConnection.sideOpeningFootprints=bridgeConnector.sideOpeningFootprints;}
  const bridge=cliffTransitRelease?null:own(createTargetCityBayBridge({sideOpeningFootprints:bridgeConnector?.sideOpeningFootprints||[],maxSpan:36,pierWidth:1.8,path:[[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],[-10,16,24],[23,14.8,33],bridgeArrival],groundHeightAt:s.error?null:(x,z)=>s.terrain(x,z)?.height??null,oceanHeightAt:s.error?null:(x,z)=>s.sea(x,z)?.height??null}));if(bridge)root.add(bridge.group);
  yield '正在校验瀑布出水位置…';
  const previousWaterfallSurvey=s.error?null:survey(s,width,oldPlatform);
  const surveyReport = s.error ? {selected: null, examined: 0, failures: {[s.error]: 1}} : cliffTransitRelease?survey(s,width,oldPlatform,cliffTransitRelease,castle.matrixWorld):previousWaterfallSurvey;
  const placement = surveyReport.selected, supportGeometry = [], supportMaterials = [];
  own({dispose(){supportGeometry.forEach(g=>g.dispose());supportMaterials.forEach(m=>m.dispose());}});
  yield '正在布置城前流云…';
  const cloudSources=terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean);
  root.updateMatrixWorld(true);const cloudBuildings=[],cloudLocalBuildings=[];
  for(const child of root.children){if(child===benchTurf?.group)continue;child.traverseVisible(o=>{if(!o.isMesh||o.userData.skipColliders||o.userData.isOutline||/cloud|mist|water|foam|turf|grass|foliage/.test(o.name))return;o.geometry.computeBoundingBox();const world=castle.matrixWorld.clone().multiply(o.matrixWorld);if(o.isInstancedMesh){const instance=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);if(Math.abs(instance.determinant())>1e-12){cloudBuildings.push(o.geometry.boundingBox.clone().applyMatrix4(world.clone().multiply(instance)));cloudLocalBuildings.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(instance)));}}}else{cloudBuildings.push(o.geometry.boundingBox.clone().applyMatrix4(world));cloudLocalBuildings.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});}
  if(cloudRailCurves&&Object.values(cloudRailCurves).some(c=>typeof c?.getSpacedPoints!=='function'))throw new TypeError('actual cloud rail curves required');
  const cloudRail=cloudRailCurves?Object.values(cloudRailCurves).flatMap(c=>c.getSpacedPoints(Math.ceil(c.getLength()))):[];
  let detailClouds=s.error?null:own(createMountainCloudBanksCandidate(castle,{enabled:true,surfaceIndex:buildMountainSurfaceIndex(cloudSources),radius:160,waterHeight:officialOceanLevelAt,sampleSea:s.sea,circulating:true,maxBanks:6,protectedBoxes:cloudBuildings,protectedLocalBoxes:cloudLocalBuildings,rail:cloudRail}));
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
    newCity: {position: [74, 12, 33], yawDegrees: -55, placementMatrix:newCityMatrix.toArray(),radialPlacement:newCityPlacement.report, geometry: main.report, supportSamples: []},
    waterfall: {built: false, survey: surveyReport, reason: placement ? null : 'no-sampled-dry-shore-to-open-sea-spillway'},
    validation: {visualAccepted: false, independentScore: null, navigationVerified: false, collisionVerified: false, continuousSupportVerified: false, gpuCompiled: false},
    limitations: ['Read-only triangle samples do not establish a continuous collision-free passage.', 'The rebuilt stair route and connected old-city supply channel have finite surface samples; production navigation remains uninstalled.', 'Original city buildings, sculpture and horse are retained; the review harness controls comparison visibility.'],
  };
  if (!s.error) for (const footprint of main.report.footprints.filter(f => f.floorY === 0)) {
    const points = [...footprint.polygon, footprint.polygon.reduce((a,p)=>[a[0]+p[0]/footprint.polygon.length,a[1]+p[1]/footprint.polygon.length],[0,0])];
    for (const [x, z] of points) {
      const q = newCityPlacement.transform([x,0,z]), sample = s.terrainInFrame(newCityMatrix,x,z);
      report.newCity.supportSamples.push({part: footprint.id, corner: q, surface: sample, gap: sample ? -sample.height : null});
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
    const local=new THREE.Group();const placement=label==='new'?newCityMatrix:new THREE.Matrix4().makeRotationY(yaw).setPosition(...position);placement.decompose(local.position,local.quaternion,local.scale);bases.add(local);
    for(const fp of asset.report.footprints.filter(f=>f.floorY===0)){
      const xs=fp.polygon.map(p=>p[0]),zs=fp.polygon.map(p=>p[1]),rows=fp.polygon.map(p=>s.terrainInFrame(placement,...p));
      if(rows.some(r=>!r)){report.baseFootings.push({id:label+':'+fp.id,status:'missing-surface'});continue;}
      const bottom=Math.min(...rows.map(r=>r.height))-.06,top=0;
      if(bottom>=top)continue;
      const g=new THREE.BoxGeometry(Math.max(...xs)-Math.min(...xs),top-bottom,Math.max(...zs)-Math.min(...zs));supportGeometry.push(g);
      const mesh=new THREE.Mesh(g,footingMaterial);mesh.name='target-footing-'+label+'-'+fp.id;mesh.position.set((Math.max(...xs)+Math.min(...xs))/2,(top+bottom)/2,(Math.max(...zs)+Math.min(...zs))/2);mesh.castShadow=true;mesh.receiveShadow=true;local.add(mesh);
      report.baseFootings.push({id:label+':'+fp.id,localBottom:bottom,localTop:top,placementMatrix:placement.toArray(),bottomY:new THREE.Vector3(0,bottom,0).applyMatrix4(placement).y,topY:position[1],sampled:true,continuousProof:false});
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
  yield '正在建造沿崖通道…';
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
  yield '正在连接街区入口…';
  // Complete the house links only after surveyed public surfaces exist.
  if(newCityStreetInfill){
    const publicSurfaces=[
      ...(report.newCityStairs.surveyed?.selected?.treads||[]).map(t=>({id:'surveyed-tread',polygon:t.polygon,top:t.top})),
      ...(report.bridgeConnector?.walkSurfaces||[]),
      ...Object.values(report.cliffTransit?.galleries||{}).flatMap(g=>g.walkSurfaces||[]),
      ...(report.cliffTransit?.connections||[]).flatMap(l=>(l.walkSurfaces||[]).map(s=>({id:l.id,polygon:s.corners.map(p=>[p[0],p[2]]),corners:s.corners,top:s.top}))),
      ...(report.cliffTransit?.newCityTransitLinks?.links||[]).flatMap(l=>l.walkSurfaces||[])
    ];
    const publicFootprints=publicSurfaces.filter(p=>p.polygon).map(p=>({id:p.id,polygon:p.polygon.map(([x,z])=>{const vertex=(p.vertices??p.corners??[]).find(v=>Math.hypot(v[0]-x,v[2]-z)<1e-5),y=vertex?.[1]??p.top??p.height??s.terrain(x,z)?.height??0;const q=V(x,y,z).applyMatrix4(newCityPlacement.inverse);return[q.x,q.z];})}));
    const publicCollisionGroups=[surveyedStairs?.group,bridgeConnector?.group,cliffTransit?.group].filter(Boolean);
    root.updateMatrixWorld(true);
    const primary=stairs.completeStreetInfill({publicFootprints,protectedFootprints:main.report.footprints,publicCollisionGroups});
    report.newCityStreetCompletion={completed:true,modules:primary.modules.length,visualDensityTargetMet:primary.finitePass,validSupport:primary.supportSamples.every(p=>Number.isFinite(p.height)&&p.gap===0&&p.buriedBody===0),rejected:primary.rejected};
    if(newCitySecondaryClusters)stairs.completeSecondaryStreetClusters({enabled:true,publicFootprints,protectedFootprints:main.report.footprints,publicCollisionGroups});
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
  // Called after attachment and public geometry completion, before forest and
  // navigation snapshots. Each replacement roof asset samples the current mesh.
  function completeOldWingStreets(){
    if(!oldCityWingStreets)return null;
    if(disposed||root.parent!==castle||s.error)throw new Error('old wing streets require attached city and actual final terrain');
    if(oldCity.report.wingStreets.enabled)return oldCity.report.wingStreets;
    castle.updateWorldMatrix(true,true);
    const yaw=oldCity.group.rotation.y,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const publicSurfaces=[
      ...(report.bridge?.walkSurfaces||[]),
      ...Object.values(report.cliffTransit?.galleries||{}).flatMap(g=>g.walkSurfaces||[]),
      ...(report.cliffTransit?.connections||[]).flatMap(l=>(l.walkSurfaces||[]).map(v=>({id:l.id,polygon:v.polygon||v.corners?.map(p=>[p[0],p[2]])})))
    ];
    const protectedFootprints=publicSurfaces.filter(v=>v.polygon?.length>=3).map(v=>({id:v.id||'actual-public-surface',polygon:v.polygon.map(([x,z])=>{const dx=x-oldPlatform[0],dz=z-oldPlatform[2];return[dx*cs-dz*sn,dx*sn+dz*cs];})}));
    const collisionGroups=[main.group,stairs.group,surveyedStairs?.group,bridge?.group,cliffTransit?.group,bridgeConnector?.group,waterSupply?.group,support,frontRail?.group,mainApproach?.group,newPlaza?.group,terraceLinks?.group,waterfrontStairs?.group,waterfall?.group.getObjectByName('target-waterfall-stone-three-arch-outlets'),...oldCityWingCollisionGroups].filter(Boolean);
    const wings=oldCity.completeWingStreets({enabled:true,sampleSurface:(x,z)=>{const hit=s.terrain(...xzAt(oldPlatform,yaw,x,z));return hit?hit.height-oldPlatform[1]:null;},collisionGroups,protectedFootprints});
    report.oldCity.geometry=oldCity.report;
    playerSupport?.refresh();
    return wings;
  }
  function getPlayerSupport(){if(!playerSupport)playerSupport=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrainMeshes||[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean)});return playerSupport;}
  function clearForest(){if(!forestClearance){forestClearance=applyTargetCityForestClearance({castle,candidateRoot:root});report.forestClearance=forestClearance.report;}if(!forestCompanions&&!s.error){forestCompanions=createTargetForestCompanions({castle,candidateRoot:root,sampleTerrain:s.terrain,sampleSea:s.sea});root.add(forestCompanions.group);report.forestCompanions=forestCompanions.report;}return forestClearance;}
  function openRoofSession(editorOptions){
    if(roofSession)return roofSession;
    const createAsset=({roofRoles})=>{const next=own(createTargetOldCity({seed,roofRoles,palette:oldPalette,wingStreets:oldCityWingStreets}));next.group.position.fromArray(oldPlatform);next.group.rotation.y=degrees(45);return next;};
    const commitAsset=(next,previous)=>{
      if(previous!==oldCity||previous.group.parent!==root)throw new Error('stale old city roof transaction');
      const previousReport=report.oldCity.geometry;
      forestCompanions?.dispose();forestCompanions=null;forestClearance?.dispose();forestClearance=null;
      previous.group.removeFromParent();root.add(next.group);oldCity=next;report.oldCity.geometry=next.report;
      try{completeOldWingStreets();clearForest();playerSupport?.refresh();return{ok:true};}
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
  function prepareCloudRefresh({surfaceIndex,rail,protectedBoxes=[],actors=[]}={}){
    if(disposed||!detailClouds||detailClouds.group.parent!==root)throw new Error('attached live cloud owner required');
    if(!surfaceIndex?.sample||!Array.isArray(rail)||rail.length<2||rail.some(p=>!p?.isVector3)||!Array.isArray(protectedBoxes))throw new TypeError('fresh final index and actual rail samples required');
    castle.updateWorldMatrix(true,true);
    const previous=detailClouds,previousReport=report.clouds,childIndex=root.children.indexOf(previous.group);
    // A whole-city/whole-gallery world AABB encloses empty rear sky on the
    // curved planet. Reserve actual solid mesh bounds, not the group's void.
    const boxes=[],localBoxes=[],castleInverse=castle.matrixWorld.clone().invert();
    for(const child of [...root.children,...actors]){
      if(child===previous.group||child===benchTurf?.group)continue;
      child.traverseVisible(o=>{
        if(!o.isMesh||o.userData.skipColliders||o.userData.isOutline||/cloud|mist|water|foam|turf|grass|foliage/.test(o.name))return;
        if(o.isInstancedMesh){
          o.geometry.computeBoundingBox();const instance=new THREE.Matrix4();
          for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);if(Math.abs(instance.determinant())<1e-12)continue;boxes.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(instance)));localBoxes.push(o.geometry.boundingBox.clone().applyMatrix4(castleInverse.clone().multiply(o.matrixWorld).multiply(instance)));}
        }else{boxes.push(new THREE.Box3().setFromObject(o));o.geometry.computeBoundingBox();localBoxes.push(o.geometry.boundingBox.clone().applyMatrix4(castleInverse.clone().multiply(o.matrixWorld)));}
      });
    }
    const next=createMountainCloudBanksCandidate(castle,{enabled:true,surfaceIndex,radius:160,waterHeight:officialOceanLevelAt,sampleSea:s.sea,circulating:true,maxBanks:6,rail,protectedBoxes:[...boxes,...protectedBoxes],protectedLocalBoxes:[...localBoxes,...protectedBoxes.map(b=>b.clone().applyMatrix4(castleInverse))]});
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
  let initialCloudClearance=null;
  function completeCloudClearance({actors=[]}={}){
    if(initialCloudClearance)return initialCloudClearance.report;
    if(root.parent!==castle||actors.some(o=>!o?.isObject3D))throw new Error('final cloud clearance requires attached city and actual actors');
    initialCloudClearance=prepareCloudRefresh({surfaceIndex:buildMountainSurfaceIndex(cloudSources),rail:cloudRail,actors});initialCloudClearance.commit();
    report.clouds.finalSceneClearance={completed:true,actors:actors.map(o=>o.name),phase:'after real landmark migration and street completion'};return report.clouds;
  }
  function update(seconds = 0) {
    if (disposed || !Number.isFinite(seconds)) return;
    waterfall?.update(seconds);detailClouds?.update(seconds);

  }
  update(0); root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root); report.bounds = {min: bounds.min.toArray(), max: bounds.max.toArray()};
  root.userData.detailCandidateReport = report;
  function dispose() {
    if (disposed) return; for(const binding of [...cloudBindings].reverse())binding.rollback(); disposed = true; playerSupport?.dispose();waterfrontStairs?.dispose();terraceLinks?.dispose();forestCompanions?.dispose();forestClearance?.dispose(); frontRail?.dispose(); benchTurf?.dispose(); root.removeFromParent(); bayWater?.dispose(); canopyAppearance.dispose(); rockAppearance.dispose(); sunShadow?.dispose(); newPlaza?.dispose(); detailClouds?.dispose(); mainApproach?.dispose();transitionOwner.dispose();main.dispose(); if(roofSession)roofSession.close();else oldCity.dispose(); bridge?.dispose(); cliffTransit?.dispose(); bridgeConnector?.dispose(); stairs.dispose(); surveyedStairs?.dispose(); waterfall?.dispose(); waterSupply?.dispose();
    supportGeometry.forEach(g => g.dispose()); supportMaterials.forEach(m => m.dispose()); root.clear();
  }
  return {bindWaterContacts:()=>bayWater?.bindContactMeshes([root]),root, group: root, report, update, dispose, clearForest, openRoofSession, getPlayerSupport, completeCloudClearance, prepareCloudRefresh, prepareSurfaceSamplingRefresh, getSurfaceSamplers, completeTerraceLinks, completeWaterfrontStairs, completeOldWingStreets, replacedCloudRoots};
}

export function createTargetCityDetailCandidate(options={}) {
 return finishStartupSteps(createTargetCityDetailCandidateSteps(options));
}

export function* createTargetCityDetailCandidateSteps(options={}) {
 const owned=[];
 try {return yield* constructTargetCityDetailCandidateSteps({...options,onOwned(handle){owned.push(handle);options.onOwned?.(handle);}});}
 catch(error){for(const handle of owned.reverse())try{handle.dispose?.();}catch{} throw error;}
}

export function applyTargetCityDetailCandidate(castle, options = {}) {
  const previous = castle?.getObjectByName(NAME)?.userData.candidateHandle;
  if (previous) return previous;
  const candidate = createTargetCityDetailCandidate({...options, castle});
  try {castle.add(candidate.root); candidate.bindWaterContacts?.();candidate.completeTerraceLinks();candidate.completeWaterfrontStairs();candidate.completeOldWingStreets();candidate.clearForest(); candidate.root.userData.candidateHandle = candidate;}
  catch(error){candidate.dispose();throw error;}
  candidate.report.status = 'unaccepted-attached-detail-candidate';
  return candidate;
}
