import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {runStartupSteps} from '../../src/core/startupTasks.js';
import {relocateCloudClustersToRidges, relocateCloudClustersToRidgesSteps,
  remapCloudClustersToSceneTerrain, remapCloudClustersToSceneTerrainSteps} from '../../src/world/planetV8/cloudTerrainRemap.js';

test('yielding cloud placement preserves the exact synchronous anchors, heights and climate hash', async () => {
  const mountain = new T.Mesh(new T.SphereGeometry(8, 16, 12), new T.MeshBasicMaterial());
  mountain.position.set(0, 161, 0); mountain.updateMatrixWorld(true);
  const original = {instances: [
    {cellIndex: 1, anchor:[0,1,0], terrainClearance:2, scale:4, pathPoints:[{direction:[.01,1,0],terrainClearance:3}]},
    {cellIndex: 2, anchor:[1,0,0], terrainClearance:3, scale:5, pathPoints:[]},
  ]};
  const sync = structuredClone(original), incremental = structuredClone(original);
  const options = {terrainMeshes:[mountain], radius:160, seaLevel:0, candidateCount:4, probeRings:[.03,.06]};
  relocateCloudClustersToRidges(sync, options); remapCloudClustersToSceneTerrain(sync, options);
  let checkpoints = 0;
  const checkpoint = async () => { checkpoints++; };
  await runStartupSteps(relocateCloudClustersToRidgesSteps(incremental, options), checkpoint);
  await runStartupSteps(remapCloudClustersToSceneTerrainSteps(incremental, options), checkpoint);
  assert.deepEqual(incremental, sync);
  assert.equal(sync.instances.length, 1, 'ocean-only cloud is still rejected');
  assert.ok(sync.instances[0].altitude > 2);
  assert.equal(checkpoints, original.instances.length + sync.instances.length);
  mountain.geometry.dispose(); mountain.material.dispose();
});
