import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RADAR_PATH = path.resolve('TigerMessenger/src/scene-authoring/catalog/asset-capability-radar.json');

test('asset-capability-radar.json meets asset-driven rubric & blueprint invariants', () => {
  const data = JSON.parse(fs.readFileSync(RADAR_PATH, 'utf8'));
  assert.ok(data.rubric?.formula, 'rubric formula present');
  assert.ok(Array.isArray(data.assetMatrix) && data.assetMatrix.length >= 7, '7+ asset categories');
  assert.ok(Array.isArray(data.discoveries) && data.discoveries.length >= 20, 'discoveries populated');

  const validSys = new Set(['planet', 'scene', 'object', 'multi']);
  let prevScore = Infinity;
  for (const d of data.discoveries) {
    assert.ok(validSys.has(d.targetSystem), `valid targetSystem: ${d.targetSystem}`);
    assert.ok(typeof d.priorityScore === 'number' && d.priorityScore <= prevScore + 1e-9, 'sorted descending by priorityScore');
    prevScore = d.priorityScore;
    assert.ok(Array.isArray(d.blueprint?.steps) && d.blueprint.steps.length === 4, `4-step blueprint for ${d.source}`);
    assert.ok(typeof d.blueprint?.targetModule === 'string' && d.blueprint.targetModule.includes('REACodeRefactoring'), `refactor targetModule for ${d.source}`);
    assert.ok(typeof d.blueprint?.agentPrompt === 'string' && d.blueprint.agentPrompt.length > 20, `agentPrompt for ${d.source}`);
  }
});
