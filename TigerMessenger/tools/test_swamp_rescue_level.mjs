// Configuration checks only: no renderer, actor simulation or save mutations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('godot/data/levels/swamp-rescue-v1.json', root), 'utf8'));
const storyboard = readFileSync(new URL('docs/SWAMP_RESCUE_STORYBOARD.md', root), 'utf8');

function validate(plan) {
  const fail = [];
  const check = (condition, message) => { if (!condition) fail.push(message); };
  const unique = (items) => new Set(items).size === items.length;
  const stages = plan.stages;
  const stageIds = stages.map(s => s.id);
  const zoneIds = plan.zones.map(z => z.id);
  const cpIds = plan.checkpoints.map(c => c.id);
  check(plan.version === 1, 'supported version');
  check(unique(stageIds) && stages.length === 16, '16 unique stages');
  check(unique(stages.map(s => s.shot)), 'unique storyboard shots');
  check(unique(zoneIds) && zoneIds.length === 9, '9 unique zones');
  check(unique(cpIds) && cpIds.length === 6, '6 unique checkpoints');
  check(plan.activation.enabled === false && plan.status === 'configured_not_deployed', 'deployment remains disabled');
  check(plan.activation.blockers.length > 0, 'deployment blockers documented');
  check(plan.activation.entryStage === stages[0].id, 'entry stage matches graph');
  check(plan.savePolicy.writeExistingSavesDuringConfiguration === false && plan.savePolicy.autoMigrate === false, 'no automatic save changes');
  check(plan.savePolicy.completedLegacyChapter === 'preserve_do_not_replay', 'legacy completion preserved');
  check(plan.savePolicy.namespace !== plan.savePolicy.legacyCampaignKey && plan.savePolicy.namespace !== plan.savePolicy.legacyWorkspaceKey, 'isolated future save namespace');
  check(plan.actors.length === 4 && unique(plan.actors.map(a => a.id)), 'four unique actors');
  check(plan.actors.every(a => a.spawn === false), 'existing actor identities only');
  check(plan.actors.find(a => a.id === 'mother')?.speaks === false, 'mother remains non-speaking');
  check(plan.trooperHandoff.status === 'unresolved' && Object.values(plan.trooperHandoff.identity).every(x => x === null), 'no fabricated roster binding');
  for (const key of ['spawnOnAircraftArrival', 'duplicateOnRetry', 'captureCountsAsDeath', 'permanentAllegianceChange']) {
    check(plan.trooperHandoff[key] === false, `trooper policy ${key}`);
  }
  check(plan.trooperHandoff.preserveCombatConstants === true, 'original armor strength preserved');
  check(plan.trooperHandoff.equipmentOnlyModification === true, 'equipment-only retrofit');
  check(plan.trooperHandoff.cooperationRequires.includes('fleetOwnershipReleased'), 'release previous fleet ownership');
  for (const zone of plan.zones) {
    check(zone.placement.status === 'unresolved' && zone.placement.position === null, `unverified placement ${zone.id} remains explicit`);
    check(zone.checks.length > 0 && !!zone.purpose, `placement checks ${zone.id}`);
  }
  const label = key => check(typeof plan.conditionLabels[key] === 'string' && plan.conditionLabels[key].length > 0, `condition label ${key}`);
  plan.activation.requires.forEach(label);
  // Facts can originate in an earlier stage's sensor conditions or outputs, not a later one.
  const known = new Set(plan.activation.requires);
  for (const [index, stage] of stages.entries()) {
    check(zoneIds.includes(stage.zone), `zone for ${stage.id}`);
    check(cpIds.includes(stage.checkpoint), `checkpoint for ${stage.id}`);
    check(stage.next === (stages[index + 1]?.id ?? null), `ordered next for ${stage.id}`);
    check(stage.requires.length > 0 && stage.completeWhen.length > 0 && stage.produces.length > 0, `nonempty guards for ${stage.id}`);
    check(stage.requires.every(key => known.has(key)), `no unavailable prerequisite for ${stage.id}`);
    for (const key of [...stage.requires, ...stage.completeWhen, ...stage.produces]) label(key);
    check(stage.estimatedSeconds.length === 2 && stage.estimatedSeconds.every(v => Number.isFinite(v) && v > 0) && stage.estimatedSeconds[1] >= stage.estimatedSeconds[0], `timing ${stage.id}`);
    check(storyboard.includes(`| ${stage.shot} ·`), `storyboard mirror ${stage.shot}`);
    for (const key of [...stage.completeWhen, ...stage.produces]) known.add(key);
  }
  for (const checkpoint of plan.checkpoints) {
    const resumeIndex = stageIds.indexOf(checkpoint.resumeStage);
    check(resumeIndex >= 0 && zoneIds.includes(checkpoint.zone), `checkpoint references ${checkpoint.id}`);
    const afterIndex = checkpoint.afterStage === null ? -1 : stageIds.indexOf(checkpoint.afterStage);
    check(checkpoint.afterStage === null || afterIndex >= 0, `checkpoint unlock ${checkpoint.id}`);
    check(resumeIndex === afterIndex + 1, `checkpoint resumes next uncompleted stage ${checkpoint.id}`);
    check(checkpoint.preserve.includes('rosterIdentity'), `checkpoint preserves soldier ${checkpoint.id}`);
    for (const [index, stage] of stages.entries()) {
      if (stage.checkpoint === checkpoint.id) check(afterIndex < index, `checkpoint not locked for ${stage.id}`);
    }
  }
  const shield = plan.tuning.shield;
  check([shield.activeSeconds, shield.cooldownSeconds, shield.warningSeconds, shield.radius, shield.arcDegrees].every(v => Number.isFinite(v) && v > 0), 'finite positive shield parameters');
  check(shield.warningSeconds < shield.activeSeconds && shield.arcDegrees < 180, 'readable directional shield');
  check(shield.stationaryForSuctionProtection && shield.cooldownInCover && !shield.automaticOffense, 'shield limitations');
  check(plan.tuning.scan.suctionPulseSeconds < shield.activeSeconds && plan.tuning.scan.safeWindowSeconds >= shield.cooldownSeconds, 'prototype cycle has a recovery window');
  check(plan.tuning.escort.waitIfSeparatedBeyond > plan.tuning.escort.rallyRadius, 'escort spacing hysteresis');
  check(!plan.tuning.escort.teleportToCatchUp && !plan.tuning.escort.permanentDeath, 'escort recovery without teleport completion');
  const boarding = plan.tuning.boarding;
  check(boarding.capacityRequired === 4 && boarding.capacityVerified === false, 'four seats required, not yet certified');
  check(unique(boarding.requiredActors) && boarding.requiredActors.length === 4 && plan.actors.every(a => boarding.requiredActors.includes(a.id)), 'all four named passengers required');
  check(boarding.requireAllSeated && boarding.requireArmorStowed && !boarding.shrinkActorsToFit, 'real boarding conditions');
  const guards = stages.find(s => s.id === 'boarding').completeWhen;
  for (const condition of ['fatherSeated', 'motherSeated', 'daughterSeated', 'protectorSeated', 'uniquePassengerIdentities', 'boatCapacityValidated', 'armorStowed']) check(guards.includes(condition), `boarding guard ${condition}`);
  check(plan.savePolicy.completion.stage === stages.at(-1).id && plan.savePolicy.completion.nextChapterId === 'escape' && plan.savePolicy.completion.commitOnce, 'one chapter commit only');
  for (const condition of ['familyRecognized', 'armorReady', 'allFourAboard', 'boatLeftSwamp']) check(plan.savePolicy.completion.requires.includes(condition), `completion guard ${condition}`);
  return fail;
}

assert.deepEqual(validate(config), []);
let negativeCases = 0;
function rejects(change, expected) {
  const copy = structuredClone(config);
  change(copy);
  assert(validate(copy).some(error => error.includes(expected)), `must reject: ${expected}`);
  negativeCases++;
}
rejects(p => { p.activation.enabled = true; }, 'deployment remains disabled');
rejects(p => { p.stages[6].next = 'boarding'; }, 'ordered next');
rejects(p => { p.stages[8].requires = ['armorReady']; }, 'unavailable prerequisite');
rejects(p => { p.stages[14].completeWhen = ['fatherSeated']; }, 'boarding guard');
rejects(p => { p.tuning.boarding.requiredActors[3] = 'father'; }, 'named passengers');
rejects(p => { p.trooperHandoff.spawnOnAircraftArrival = true; }, 'spawnOnAircraftArrival');
rejects(p => { p.savePolicy.namespace = p.savePolicy.legacyCampaignKey; }, 'isolated future save');
rejects(p => { p.checkpoints[3].resumeStage = 'riddle'; }, 'resumes next');
rejects(p => { p.stages[1].checkpoint = 'dock_safe'; }, 'checkpoint not locked');
rejects(p => { p.tuning.shield.cooldownSeconds = 15; }, 'recovery window');
rejects(p => { p.zones[0].placement.position = [0, 0, 0]; }, 'unverified placement');
rejects(p => { delete p.conditionLabels.armorReady; }, 'condition label');
rejects(p => { p.stages[0].estimatedSeconds = [NaN, 1]; }, 'timing');
rejects(p => { p.trooperHandoff.cooperationRequires = ['trooperRescued']; }, 'fleet ownership');
rejects(p => { p.savePolicy.completion.requires = ['boatLeftSwamp']; }, 'completion guard');

// Guard truth table: absent ANY condition must block the contract, even on replay.
let missingGuardCases = 0;
for (const stage of config.stages) {
  const keys = [...stage.requires, ...stage.completeWhen];
  const all = new Set(keys);
  assert(keys.every(key => all.has(key)));
  for (const missing of new Set(keys)) {
    const facts = new Set(all); facts.delete(missing);
    assert.equal(keys.every(key => facts.has(key)), false);
    missingGuardCases++;
  }
}
console.log('SWAMP_RESCUE_CONFIG_OK', JSON.stringify({
  stages: config.stages.length, zones: config.zones.length, checkpoints: config.checkpoints.length,
  negativeCases, missingGuardCases, deploymentEnabled: config.activation.enabled,
  scope: 'Data contracts and mutation checks only; no gameplay, physics, world placement or persistence execution verified.'
}));
