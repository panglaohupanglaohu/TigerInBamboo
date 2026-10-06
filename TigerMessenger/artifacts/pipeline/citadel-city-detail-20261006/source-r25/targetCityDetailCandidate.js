import * as THREE from 'three';
import {createTargetNewCityStairRoute} from './targetNewCityStairRoute.js';
import {createTargetCityBayBridge} from './targetCityBayBridge.js';
import {createTargetOldCity} from './targetOldCity.js';
import {createTargetNewCityStairs} from './targetNewCityStairs.js';
import {createTargetNewCityMain} from './targetNewCityMain.js';
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

export function createTargetCityDetailCandidate({castle, sceneRoot, terrainMeshes, oceanMesh, width = 9, seed = 20261005, newCityPalette = {}, waterfallPalette = {}, oldPlatform = [-55, 17, 9]} = {}) {
  if (!castle?.isObject3D) throw new TypeError('castle Object3D is required to sample the frozen scene');
  if (!(Number.isFinite(width) && width > 0)) throw new RangeError('width must be positive and finite');
  if (oldPlatform.length !== 3 || !oldPlatform.every(Number.isFinite)) throw new TypeError('oldPlatform must be a finite castle-local triple');
  let scene = sceneRoot || castle; while (!sceneRoot && scene.parent) scene = scene.parent;
  const s = samplers(castle, scene, terrainMeshes, oceanMesh), root = new THREE.Group();
  root.name = NAME; root.userData.preserveCitadelMaterials = true;
  const oldCity = createTargetOldCity({seed});oldCity.group.position.fromArray(oldPlatform);oldCity.group.rotation.y=degrees(45);root.add(oldCity.group);
  const main = createTargetNewCityMain({seed, palette: newCityPalette});
  main.group.position.set(74, 12, 33); main.group.rotation.y = degrees(-55); root.add(main.group);
  const stairs = createTargetNewCityStairs({seed, palette:newCityPalette, surfaceHeightAt:s.error?null:(x,z)=>{const q=xzAt([74,12,33],degrees(-55),x,z),hit=s.terrain(...q);return hit?hit.height-12:null;}});
  // Retain only the authored flank houses. The early descent was rejected by
  // the actual terrain audit; surveyed treads replace it rather than hiding land.
  for(const child of [...stairs.group.children])if(!/^new-city-stair-house-/.test(child.name))stairs.group.remove(child);
  stairs.group.position.copy(main.group.position);stairs.group.rotation.copy(main.group.rotation);root.add(stairs.group);
  const approach=xzAt([74,12,33],degrees(-55),0,12.96);
  const surveyedStairs=s.error?null:createTargetNewCityStairRoute({sampleSurface:s.terrain,start:[approach[0],12,approach[1]]});
  if(surveyedStairs)root.add(surveyedStairs.group);
  const oldPort=oldCity.report.exits.bridge,oldXZ=xzAt(oldPlatform,degrees(45),oldPort[0],oldPort[2]);
  const newXZ=xzAt([74,12,33],degrees(-55),0,6.7);
  const bridge=createTargetCityBayBridge({path:[[oldXZ[0],oldPlatform[1]+oldPort[1],oldXZ[1]],[-10,16,24],[23,14.8,33],[newXZ[0],13.2,newXZ[1]]],groundHeightAt:s.error?null:(x,z)=>s.terrain(x,z)?.height??null,oceanHeightAt:s.error?null:(x,z)=>s.sea(x,z)?.height??null});root.add(bridge.group);
  const surveyReport = s.error ? {selected: null, examined: 0, failures: {[s.error]: 1}} : survey(s, width, oldPlatform);
  const placement = surveyReport.selected, supportGeometry = [], supportMaterials = [];
  let waterfall = null, support = null;
  const report = {
    revision: 'target-city-detail-candidate-2', status: 'unaccepted-detached-detail-candidate', seed,
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    sourceSurfaces: s.sources || null, terrainMutation: false, existingBuildingsChanged: false, landmarksChanged: false,
    bridge:bridge.report,
    oldCity: {position:oldPlatform,yawDegrees:45,geometry:oldCity.report},
    newCityStairs: {authored:stairs.report,authoredTreadsVisible:false,surveyed:surveyedStairs?.report||null},
    newCity: {position: [74, 12, 33], yawDegrees: -55, geometry: main.report, supportSamples: []},
    waterfall: {built: false, survey: surveyReport, reason: placement ? null : 'no-sampled-dry-shore-to-open-sea-spillway'},
    validation: {visualAccepted: false, independentScore: null, navigationVerified: false, collisionVerified: false, continuousSupportVerified: false, gpuCompiled: false},
    limitations: ['Read-only triangle samples do not establish a continuous collision-free passage.', 'The new city approach has authored stairs; its terrain audit is separate from navigability. The old-city supply-channel connection remains unbuilt.', 'Original city buildings, sculpture and horse are retained; the review harness controls comparison visibility.'],
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

  if (placement) {
    const {root: anchor, yaw} = placement, at = (x, z) => xzAt(anchor, yaw, x, z);
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
      abutment: {newOwnedGeometry: true, parts: feet, connectionToOldCity: 'not-built', expectedPiers: 9, builtPiers: feet.length, missingPiers: 9-feet.length},
      surfaceSamplingPassed: missingEndpointSamples === 0 && endpointResidual < 1e-4};
  }
  let disposed = false;
  function update(seconds = 0) {
    if (disposed || !waterfall || !Number.isFinite(seconds)) return;
    waterfall.update(seconds);

  }
  update(0); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root); report.bounds = {min: bounds.min.toArray(), max: bounds.max.toArray()};
  root.userData.detailCandidateReport = report;
  function dispose() {
    if (disposed) return; disposed = true; root.removeFromParent(); main.dispose(); oldCity.dispose(); bridge.dispose(); stairs.dispose(); surveyedStairs?.dispose(); waterfall?.dispose();
    supportGeometry.forEach(g => g.dispose()); supportMaterials.forEach(m => m.dispose()); root.clear();
  }
  return {root, group: root, report, update, dispose};
}

export function applyTargetCityDetailCandidate(castle, options = {}) {
  const previous = castle?.getObjectByName(NAME)?.userData.candidateHandle;
  if (previous) return previous;
  const candidate = createTargetCityDetailCandidate({...options, castle});
  castle.add(candidate.root); candidate.root.userData.candidateHandle = candidate;
  candidate.report.status = 'unaccepted-attached-detail-candidate';
  return candidate;
}
