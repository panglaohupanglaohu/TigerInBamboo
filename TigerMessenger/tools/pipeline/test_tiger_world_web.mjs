// Focused live-world smoke; a fresh headless profile never touches user saves.
import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8877/TigerMessenger/';
const runId = process.env.TM_WORLD_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw Error('Invalid run id');
const output = new URL(`../../artifacts/pipeline/tiger-web-v3/world-${runId}/`, import.meta.url);
await mkdir(output, { recursive: true });
const report = { passed: false, url: base, startedAt: new Date().toISOString(), scope: 'Actual game scene, actor identity, live updates, original greeting/dialog and chapter-4 target resolution. No player playthrough, chapter completion, art acceptance or hardware performance claim.', interventions: ['Fresh isolated browser context seeded with chapter 4 solely to resolve the live tiger rescue target.', 'Candidate enabled in place only if game default is original.', 'Test player teleported near tiger; original game frame loop remains responsible for movement/dialog.', 'Temporary inspection cameras render full original scene; only hidden actor ancestors temporarily revealed and restored synchronously.'], pageErrors: [], consoleErrors: [], failedRequests: [] };
report.sourceHashesBefore = {};
for (const relative of ['src/assets/tigerAnatomy.js', 'src/assets/characters/moebiusTiger.js', 'src/world/moebiusTiger.js', 'assets/models/optimized/moebiusTigerAnatomyData.js']) {
  report.sourceHashesBefore[relative] = createHash('sha256').update(await readFile(new URL(`../../${relative}`, import.meta.url))).digest('hex');
}
let page;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && report.consoleErrors.length < 80) report.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.addInitScript(() => localStorage.setItem('tm.rescue.campaign.v1', JSON.stringify({ version: 1, chapter: 4 })));
  await page.goto(`${base}?autostart=1`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__tm?.rescueCampaign && window.__tm.scene && document.getElementById('intro')?.classList.contains('hidden'), null, { timeout: 180000 });
  report.initial = await page.evaluate(async () => {
    const tm = window.__tm, T = tm.THREE;
    const { findSwampTiger } = await import('./src/world/moebiusTiger.js');
    const tiger = findSwampTiger(tm.scene);
    if (!tiger?.parent || typeof tiger.userData.setTigerAnatomy !== 'function') throw Error('Live swamp tiger adapter missing');
    const reference = { tiger, parent: tiger.parent, update: tiger.userData.update, rootUuid: tiger.uuid, speech: tiger.userData.speech, tail: tiger.userData.tailRoot, lights: [], calls: 0, samples: [] };
    tiger.traverse(node => { if (node.isPointLight) reference.lights.push(node); });
    const initial = { uuid: tiger.uuid, name: tiger.name, kind: tiger.userData.kind, parent: { name: tiger.parent.name, uuid: tiger.parent.uuid }, defaultAnatomy: tiger.userData.tigerAnatomy?.active === true, speech: { ...tiger.userData.speech }, position: tiger.position.toArray(), scale: tiger.scale.toArray(), rescue: tm.rescueCampaign.snapshot(), sceneChildren: tm.scene.children.length };
    window.__tigerWorldSmoke = reference;
    return initial;
  });
  async function capture(id) {
    const result = await page.evaluate(id => {
      const tm = window.__tm, T = tm.THREE, tiger = window.__tigerWorldSmoke.tiger;
      tm.scene.updateMatrixWorld(true);
      const inv = tiger.matrixWorld.clone().invert(), bounds = new T.Box3();
      tiger.traverse(node => {
        if (!node.isMesh || !node.geometry?.attributes.position?.count) return;
        for (let p = node; p && p !== tiger; p = p.parent) if (!p.visible) return;
        node.geometry.computeBoundingBox();
        bounds.union(node.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, node.matrixWorld)));
      });
      if (bounds.isEmpty()) throw Error('No visible tiger geometry');
      const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
      const span = Math.max(size.x, size.y, size.z);
      const localPosition = center.clone().add(new T.Vector3(span * 1.2, span * .55, span * 1.05));
      const camera = new T.PerspectiveCamera(43, 1440 / 1080, .05, 2500);
      camera.position.copy(tiger.localToWorld(localPosition.clone()));
      camera.up.set(0, 1, 0).transformDirection(tiger.matrixWorld);
      camera.lookAt(tiger.localToWorld(center.clone())); camera.updateMatrixWorld(true);
      const changes = [];
      for (let node = tiger; node; node = node.parent) if (!node.visible) { changes.push({ node, visible: node.visible }); node.visible = true; }
      let image;
      try { tm.renderer.render(tm.scene, camera); image = tm.renderer.domElement.toDataURL('image/png'); }
      finally { for (const change of changes) change.node.visible = change.visible; }
      return { id, image, anatomy: tiger.userData.tigerAnatomy?.active === true, actorPosition: tiger.position.toArray(), localBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, camera: { localPosition: localPosition.toArray(), localTarget: center.toArray(), worldPosition: camera.position.toArray(), up: camera.up.toArray(), fov: camera.fov }, visibilityOverrides: changes.map(c => ({ uuid: c.node.uuid, name: c.node.name, restored: c.node.visible === c.visible })), renderInfo: { ...tm.renderer.info.render }, note: 'Existing full scene/terrain/materials/lights; direct renderer capture omits UI and postprocessing. Runtime culling outside actor ancestry is unchanged.' };
    }, id);
    const bytes = Buffer.from(result.image.split(',')[1], 'base64'); delete result.image;
    result.file = `${id}.png`; result.sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(new URL(result.file, output), bytes);
    (report.captures ||= []).push(result);
  }
  await page.evaluate(() => {
    const tm = window.__tm, ref = window.__tigerWorldSmoke, tiger = ref.tiger;
    ref.savedPlayer = { position: tm.player.position.clone(), velocity: tm.player.velocity.clone(), checkpoint: tm.player.checkpoint.clone() };
    // A nearby point triggers the existing greeting condition; never call actor update ourselves.
    const local = tiger.position.clone().add(new tm.THREE.Vector3(2, 0, 2));
    tm.player.position.copy(tiger.parent.localToWorld(local)); tm.player.velocity.set(0, 0, 0); tm.player.checkpoint.copy(tm.player.position);
    tiger.userData.update = function (...args) {
      const result = ref.update.apply(this, args);
      ref.calls++;
      if (ref.samples.length < 120) ref.samples.push({ call: ref.calls, dt: args[0], t: args[1], runtimePlayer: !!args[2]?.player, position: tiger.position.toArray(), walking: !!tiger.userData._walking, greeting: !!tiger.userData._greeting, drinking: !!tiger.userData._drinking, tailRotation: tiger.userData.tailRoot?.rotation.toArray(), dialog: tiger.userData._dialog ? { ...tiger.userData._dialog } : null });
      return result;
    };
    ref.observer = tiger.userData.update;
  });
  await page.waitForFunction(() => window.__tigerWorldSmoke.calls >= 12, null, { timeout: 90000 });
  await capture('01-initial-world');
  report.activation = await page.evaluate(async () => {
    const { tiger, parent, update, speech, tail, lights } = window.__tigerWorldSmoke;
    const wasActive = tiger.userData.tigerAnatomy?.active === true;
    if (!wasActive && !tiger.userData.setTigerAnatomy(true)) throw Error('Candidate activation rejected');
    await Promise.race([tiger.userData.tigerAnatomy.ready, new Promise((_, reject) => setTimeout(() => reject(Error('Texture readiness timed out')), 30000))]);
    return { mode: wasActive ? 'game-default' : 'explicit-in-place-test-activation', sameParent: tiger.parent === parent, sameUpdate: tiger.userData.update === window.__tigerWorldSmoke.observer, sameSpeech: tiger.userData.speech === speech, sameTail: tiger.userData.tailRoot === tail, sameLights: lights.every(light => tiger.getObjectByProperty('uuid', light.uuid) === light), active: tiger.userData.tigerAnatomy.active, textureStatus: tiger.userData.tigerAnatomy.textureStatus, sha256: tiger.userData.tigerAnatomy.sha256 };
  });
  await capture('02-candidate-world');
  await page.waitForFunction(() => { const ref = window.__tigerWorldSmoke; return ref.calls >= 36; }, null, { timeout: 90000 });
  await capture('03-live-greeting-world');
  report.live = await page.evaluate(async () => {
    const tm = window.__tm, ref = window.__tigerWorldSmoke, tiger = ref.tiger;
    const { findSwampTiger } = await import('./src/world/moebiusTiger.js');
    const world = tiger.getWorldPosition(new tm.THREE.Vector3()), target = tm.rescueCampaign.getTargetPosition();
    const result = { calls: ref.calls, samples: ref.samples, sameRoot: findSwampTiger(tm.scene) === tiger, sameParent: tiger.parent === ref.parent, sameTail: tiger.userData.tailRoot === ref.tail, sameSpeech: tiger.userData.speech === ref.speech, sameLights: ref.lights.every(light => tiger.getObjectByProperty('uuid', light.uuid) === light), candidateActive: tiger.userData.tigerAnatomy.active, textureStatus: tiger.userData.tigerAnatomy.textureStatus, rescue: tm.rescueCampaign.snapshot(), rescueTargetDistanceToActor: target?.distanceTo(world), actualDialogReference: window.__tmSwampTiger === tiger, greetingObserved: ref.samples.some(s => s.greeting), dialogObserved: ref.samples.some(s => s.dialog?.active), motionObserved: ref.samples.some(s => s.position.some((v, i) => Math.abs(v - ref.samples[0].position[i]) > 1e-5)) };
    tiger.userData.update = ref.update;
    tm.player.position.copy(ref.savedPlayer.position); tm.player.velocity.copy(ref.savedPlayer.velocity); tm.player.checkpoint.copy(ref.savedPlayer.checkpoint);
    result.observerRestored = tiger.userData.update === ref.update;
    return result;
  });
  const a = report.activation, live = report.live;
  report.checks = { identityPreserved: a.sameParent && a.sameUpdate && a.sameSpeech && a.sameTail && a.sameLights && live.sameRoot && live.sameParent && live.sameTail && live.sameSpeech && live.sameLights, textureReady: live.textureStatus === 'ready', actualFrameUpdates: live.calls >= 24 && live.motionObserved, originalGreetingAndDialog: live.greetingObserved && live.dialogObserved && live.actualDialogReference, rescueTargetIdentity: live.rescue.target === 'tiger' && live.rescueTargetDistanceToActor < 1e-8 && live.rescue.chapter === 4, visibilityRestored: report.captures.every(c => c.visibilityOverrides.every(v => v.restored)), observerRestored: live.observerRestored };
  report.passed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.failure = error.stack || String(error);
  try { report.failureDiagnostics = await page.evaluate(() => { const ref = window.__tigerWorldSmoke; return ref ? { calls: ref.calls, samples: ref.samples, dialog: ref.tiger.userData._dialog, actorPosition: ref.tiger.position.toArray(), playerPosition: window.__tm.player.position.toArray() } : null; }); } catch {}
}
finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.worldErrors = { pageErrors: report.pageErrors, note: 'Reported separately from focused tiger checks; this smoke does not certify the whole game error-free.' };
  report.sourceHashes = {};
  for (const relative of ['src/assets/tigerAnatomy.js', 'src/assets/characters/moebiusTiger.js', 'src/world/moebiusTiger.js', 'assets/models/optimized/moebiusTigerAnatomyData.js']) {
    report.sourceHashes[relative] = createHash('sha256').update(await readFile(new URL(`../../${relative}`, import.meta.url))).digest('hex');
  }
  report.sourcesUnchangedDuringRun = Object.entries(report.sourceHashesBefore).every(([p, hash]) => report.sourceHashes[p] === hash);
  report.passed = report.passed && report.sourcesUnchangedDuringRun;
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, output: fileURLToPath(output), checks: report.checks, failure: report.failure, pageErrors: report.pageErrors }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
