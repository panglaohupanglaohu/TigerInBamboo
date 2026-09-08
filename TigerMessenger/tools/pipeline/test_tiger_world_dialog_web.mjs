// One bounded, diagnostic-only live-world run. Production files remain unchanged.
import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8877/TigerMessenger/';
const output = new URL(`../../artifacts/pipeline/tiger-web-v3/world-dialog-${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
await mkdir(output, { recursive: true });
const sources = ['src/main.js', 'src/world/moebiusTiger.js', 'src/assets/characters/moebiusTiger.js', 'src/assets/tigerAnatomy.js', 'src/player/player.js', 'src/quest/questSystem.js', 'assets/models/optimized/moebiusTigerAnatomyData.js'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function sourceHashes() { return Object.fromEntries(await Promise.all(sources.map(async source => [source, hash(await readFile(new URL(`../../${source}`, import.meta.url)))]))); }
const report = { passed: false, scope: 'Bounded diagnostic execution and controlled real-system dialog activation only. Natural proximity and controlled activation are separate outcomes; no natural playthrough, complete spoken exchange or rescue completion claim.', startedAt: new Date().toISOString(), url: base, sourceHashesBefore: await sourceHashes(), pageErrors: [], consoleErrors: [], failedRequests: [], interventions: ['Fresh headless browser seeds chapter 4 only to inspect the original live rescue target.', 'Browser-only module response wrapper observes exact dialog arguments and calls the original implementation once; no production file modifications.', 'Natural phase repeats the original one-time local +(2,0,2) player teleport, with normal game physics for 24 dialog frames.', 'Controlled phase sets the test player exactly 2 world units from the live tiger immediately before each of 6 real dialog calls. Original physics and the entire original dialog implementation continue; this phase does not prove natural proximity.'] };
let page;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const observer = `
export function updateSwampTigerDialog(deps) {
  const state = window.__tmTigerDialogDiagnostic;
  if (!state || !['natural', 'controlled'].includes(state.phase)) return updateSwampTigerDialogDiagnosticOriginal(deps);
  const { tiger, player } = deps;
  const mode = state.phase;
  const world = tiger.getWorldPosition(new THREE.Vector3());
  const beforeControl = player.position.clone();
  if (mode === 'controlled') {
    const direction = new THREE.Vector3(1, 0, 0).transformDirection(tiger.parent.matrixWorld);
    player.position.copy(world).addScaledVector(direction, 2);
    player.velocity.set(0, 0, 0);
  }
  const distance = world.distanceTo(player.position);
  const row = {
    frame: state.rows.filter(r => r.mode === mode).length + 1, mode, dt: deps.dt,
    gameStarted: deps.isGameStarted(), blocked: deps.isBlocked(), holdingLetter: !!player.holdingLetter,
    tigerUuid: tiger.uuid, sameActor: tiger === state.tiger, greeting: !!tiger.userData._greeting,
    tigerWorldPosition: world.toArray(), playerWorldPosition: player.position.toArray(),
    playerBeforeControl: beforeControl.toArray(), controlledDisplacement: beforeControl.distanceTo(player.position),
    playerLocalPosition: tiger.parent.worldToLocal(player.position.clone()).toArray(),
    worldDistance: distance, near: distance <= 7.5,
    before: tiger.userData._dialog ? { ...tiger.userData._dialog } : null,
  };
  const result = updateSwampTigerDialogDiagnosticOriginal(deps);
  row.after = tiger.userData._dialog ? { ...tiger.userData._dialog } : null;
  row.returnedActive = result;
  state.rows.push(row);
  if (row.frame >= (mode === 'natural' ? 24 : 6)) state.phase = mode + '-done';
  return result;
}
`;
try {
  page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && report.consoleErrors.length < 50) report.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.route('**/src/world/moebiusTiger.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const signature = 'export function updateSwampTigerDialog({';
    if (source.split(signature).length !== 2) throw Error('Unexpected dialog export; diagnostic patch refused');
    const body = source.replace(signature, 'function updateSwampTigerDialogDiagnosticOriginal({') + observer;
    report.browserObserver = { originalResponseSha256: hash(source), observedResponseSha256: hash(body), productionSourceMatches: hash(source) === report.sourceHashesBefore['src/world/moebiusTiger.js'], implementationInvocationsPerGameCall: 1 };
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
  await page.addInitScript(() => localStorage.setItem('tm.rescue.campaign.v1', JSON.stringify({ version: 1, chapter: 4 })));
  await page.goto(`${base}?autostart=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__tm?.rescueCampaign && document.getElementById('intro')?.classList.contains('hidden'), null, { timeout: 120000 });
  report.initial = await page.evaluate(async () => {
    const tm = window.__tm;
    const { findSwampTiger } = await import('./src/world/moebiusTiger.js');
    const tiger = findSwampTiger(tm.scene);
    if (!tiger?.userData.tigerAnatomy?.active) throw Error('Expected default candidate in actual game');
    await tiger.userData.tigerAnatomy.ready;
    const savedPlayer = { position: tm.player.position.clone(), velocity: tm.player.velocity.clone(), checkpoint: tm.player.checkpoint.clone() };
    window.__tmTigerDialogDiagnostic = { phase: 'natural', rows: [], tiger, savedPlayer, originalUpdate: tiger.userData.update, parent: tiger.parent };
    const offset = tiger.position.clone().add(new tm.THREE.Vector3(2, 0, 2));
    tm.player.position.copy(tiger.parent.localToWorld(offset)); tm.player.velocity.set(0, 0, 0); tm.player.checkpoint.copy(tm.player.position);
    const world = tiger.getWorldPosition(new tm.THREE.Vector3());
    return { uuid: tiger.uuid, kind: tiger.userData.kind, defaultAnatomy: true, textureStatus: tiger.userData.tigerAnatomy.textureStatus, speech: { ...tiger.userData.speech }, localTeleportOffset: [2, 0, 2], immediateWorldDistance: world.distanceTo(tm.player.position), parentWorldScale: tiger.parent.getWorldScale(new tm.THREE.Vector3()).toArray(), rescue: tm.rescueCampaign.snapshot() };
  });
  await page.waitForFunction(() => window.__tmTigerDialogDiagnostic.phase === 'natural-done', null, { timeout: 45000 });
  report.natural = await page.evaluate(() => {
    const state = window.__tmTigerDialogDiagnostic;
    const rows = state.rows.filter(row => row.mode === 'natural');
    return { passed: rows.some(row => row.after?.active), observedFrames: rows.length, totalSimulationSeconds: rows.reduce((sum, row) => sum + row.dt, 0), minimumWorldDistance: Math.min(...rows.map(row => row.worldDistance)), maximumWorldDistance: Math.max(...rows.map(row => row.worldDistance)), startedEveryFrame: rows.every(row => row.gameStarted), blockedAnyFrame: rows.some(row => row.blocked), nearFrames: rows.filter(row => row.near).length, rows };
  });
  await page.evaluate(() => { window.__tmTigerDialogDiagnostic.phase = 'controlled'; });
  await page.waitForFunction(() => window.__tmTigerDialogDiagnostic.phase === 'controlled-done', null, { timeout: 20000 });
  report.controlled = await page.evaluate(() => {
    const tm = window.__tm, state = window.__tmTigerDialogDiagnostic;
    const rows = state.rows.filter(row => row.mode === 'controlled');
    const target = tm.rescueCampaign.getTargetPosition();
    const result = { passed: rows.length === 6 && rows.every(row => row.gameStarted && !row.blocked && Math.abs(row.worldDistance - 2) < 1e-6 && row.after?.active), observedFrames: rows.length, totalSimulationSeconds: rows.reduce((sum, row) => sum + row.dt, 0), originalActorAndUpdatePreserved: state.tiger.parent === state.parent && state.tiger.userData.update === state.originalUpdate, rescueTargetDistanceToActor: target.distanceTo(state.tiger.getWorldPosition(new tm.THREE.Vector3())), rescue: tm.rescueCampaign.snapshot(), rows };
    tm.player.position.copy(state.savedPlayer.position); tm.player.velocity.copy(state.savedPlayer.velocity); tm.player.checkpoint.copy(state.savedPlayer.checkpoint);
    state.phase = 'finished';
    result.playerRestored = tm.player.position.equals(state.savedPlayer.position) && tm.player.velocity.equals(state.savedPlayer.velocity) && tm.player.checkpoint.equals(state.savedPlayer.checkpoint);
    return result;
  });
  report.passed = report.natural.observedFrames === 24 && report.controlled.passed && report.controlled.originalActorAndUpdatePreserved && report.controlled.playerRestored && report.controlled.rescueTargetDistanceToActor < 1e-8 && report.controlled.rescue.chapter === 4 && report.browserObserver.productionSourceMatches && report.pageErrors.length === 0;
} catch (error) {
  report.failure = error.stack || String(error);
  try { report.partial = await page.evaluate(() => ({ phase: window.__tmTigerDialogDiagnostic?.phase, rows: window.__tmTigerDialogDiagnostic?.rows })); } catch {}
} finally {
  await browser.close();
  report.sourceHashesAfter = await sourceHashes();
  report.sourcesUnchanged = sources.every(source => report.sourceHashesBefore[source] === report.sourceHashesAfter[source]);
  report.passed = report.passed && report.sourcesUnchanged;
  report.finishedAt = new Date().toISOString();
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, output: fileURLToPath(output), natural: report.natural && { passed: report.natural.passed, frames: report.natural.observedFrames, minimumWorldDistance: report.natural.minimumWorldDistance, maximumWorldDistance: report.natural.maximumWorldDistance, nearFrames: report.natural.nearFrames, startedEveryFrame: report.natural.startedEveryFrame, blockedAnyFrame: report.natural.blockedAnyFrame }, controlled: report.controlled && { passed: report.controlled.passed, frames: report.controlled.observedFrames }, sourcesUnchanged: report.sourcesUnchanged, pageErrors: report.pageErrors, failure: report.failure }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
