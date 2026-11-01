import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../../../tools/shot/node_modules/playwright/index.mjs';
const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8765';
const out = new URL('./', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack || ''}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/TigerMessenger/artifacts/pipeline/morris-castle-patrol-20261031/harness.html`, { timeout: 120000 });
  try {
    await page.waitForFunction(() => window.castleTest?.island?.landscape?.castlePatrol?.status()?.active, null, { timeout: 20000 });
  await page.waitForFunction(() => (window.castleTest?.island?.landscape?.townscaper?.birds?.stats?.perches ?? 0) > 20, null, { timeout: 20000 });
  } catch (err) {
    const state = await page.evaluate(() => ({
      hasTest: !!window.castleTest,
      island: !!window.castleTest?.island,
      report: window.castleTest?.island?.report ? {
        site: window.castleTest.island.report.site,
        landscape: window.castleTest.island.report,
      } : null,
      status: window.castleTest?.island?.landscape?.castlePatrol?.status?.() ?? null,
      routeRevision: window.castleTest?.island?.route?.patrolRevision ?? null,
      body: document.body.innerText.slice(0, 500),
    })).catch((e) => ({ evaluateError: e.message }));
    console.error('HARNESS_TIMEOUT', JSON.stringify({ errors, state }, null, 2));
    await page.screenshot({ path: new URL('harness-timeout.png', out).pathname }).catch(() => {});
    throw err;
  }

  const geometry = await page.evaluate(() => {
    const { island, moon, patrol } = window.castleTest;
    const root = island.root, R = 160;
    root.updateWorldMatrix(true, true);
    const centre = root.getWorldPosition(new window.castleTest.T.Vector3());
    const migration = island.report.site.anchorMigration;
    const chord = centre.distanceTo(moon);
    const supportAt = (local) => {
      const world = root.localToWorld(new window.castleTest.T.Vector3(local.x, island.heightAt(local.x, local.z, local.h) + 2, local.z));
      const radius = island.sampleGroundRadius(world);
      return { radius, height: radius - R };
    };
    const route = island.route;
    const start = route.at(0), court = route.at(route.castleCourtS);
    return {
      revision: island.report.revision,
      radius: island.report.radius,
      diameter: island.report.diameter,
      areaReductionRatio: island.report.areaReductionRatio,
      expectedRadius: 22 * Math.sqrt(14 * 2 / 3),
      lakeRatio: island.report.lakeAreaRatio,
      migration,
      centreToMoon: chord,
      moonProtected: island.preservation.containsWorld(moon),
      seededCastle: island.landscape.townscaper.seededCastle,
      solidCells: island.landscape.townscaper.town.cells.filter((c) => island.landscape.townscaper.town.top(c) > 0).length,
      patrol: patrol.snapshot(),
      routeRevision: route.patrolRevision,
      castlePatrol: route.castlePatrol,
      courtDistance: route.castleCourtS,
      routeLength: route.length,
      startSupport: supportAt(start),
      courtSupport: supportAt(court),
      midpointSupport: supportAt(route.at(route.castleCourtS * .45)),
      bridgeMarker: route.isBridge(route.castleCourtS * .5),
      outerIsNotBridge: route.isBridge(route.length - 10),
      connectorPresent: !!root.getObjectByName('morris-castle-patrol-causeway-link'),
      castleBirds: island.landscape.townscaper.birds?.stats ?? null,
      castleBirdRoot: island.landscape.townscaper.birds?.group?.name ?? null,
    };
  });

  assert.equal(geometry.revision, 'morris-townscaper-lake-20261031');
  assert.ok(Math.abs(geometry.radius - geometry.expectedRadius) < 1e-6, 'island must shrink to 2/3 area');
  assert.equal(geometry.areaReductionRatio, 2 / 3);
  assert.equal(geometry.lakeRatio, .8);
  assert.ok(geometry.migration, 'anchor must migrate away from the moon lake');
  assert.ok(geometry.migration.chordAfter >= geometry.migration.requiredClearance - 1e-6);
  assert.ok(geometry.centreToMoon >= geometry.migration.requiredClearance - 1.5, 'moved centre must clear the moon preservation radius');
  assert.ok(geometry.moonProtected, 'moon lake region remains protected');
  assert.ok(geometry.seededCastle, 'fresh lake town seeds the courtyard castle');
  assert.ok(geometry.solidCells > 15);
  assert.ok(geometry.castlePatrol, 'patrol route enters the built castle');
  assert.ok(geometry.courtDistance > 12 && geometry.courtDistance < geometry.routeLength - 40);
  assert.ok(geometry.bridgeMarker, 'castle approach is treated as bridge pacing');
  assert.equal(geometry.outerIsNotBridge, false, 'outer loop is not bridge-paced');
  assert.ok(geometry.connectorPresent, 'bank-to-castle connector exists');
  assert.equal(geometry.castleBirdRoot, 'morris-townscaper-gulls');
  assert.ok(geometry.castleBirds.sit > 0, 'REACode gulls sit on town roof ridges');
  assert.ok(geometry.castleBirds.fly > 0, 'REACode gulls are flying around the castle');
  assert.ok(geometry.castleBirds.perches > 20, 'REACode roof-perch graph produced enough slots');
  for (const [name, value] of Object.entries({ startSupport: geometry.startSupport, midpointSupport: geometry.midpointSupport, courtSupport: geometry.courtSupport })) {
    assert.ok(Number.isFinite(value.radius) && value.height > 1.2, `${name} must stand on town/connector support: ${JSON.stringify(value)}`);
  }

  // Ride far enough for the princess to reach and pause in the courtyard.
  const ride = await page.evaluate(async () => {
    const { island, patrol } = window.castleTest;
    let snapshot = null, stopped = false;
    for (let i = 0; i < 1600; i++) {
      patrol.update(1 / 12, i / 12);
      snapshot = patrol.snapshot();
      if (snapshot.state === 'castle-court-stop') { stopped = true; break; }
    }
    return { stopped, snapshot, castle: island.route.castleCourtS, horse: patrol.horse.position.toArray(), support: island.sampleGroundRadius(patrol.horse.getWorldPosition(new window.castleTest.T.Vector3())) };
  });
  assert.ok(ride.stopped, `princess should reach courtyard: ${JSON.stringify(ride.snapshot)}`);
  assert.ok(['castle-court-stop', 'music-court-stop', 'greeting'].includes(ride.snapshot.state), JSON.stringify({ state: ride.snapshot.state, distance: ride.snapshot.routeDistance, castle: ride.castle, paused: ride.snapshot.courtVisits }));
  assert.ok(Number.isFinite(ride.support) && ride.support > 161, `horse must be supported in castle: ${ride.support}`);

  await page.screenshot({ path: new URL('castle-patrol.png', out).pathname, timeout: 120000 });
  await page.evaluate(() => {
    const { island, camera, T } = window.castleTest;
    island.root.updateWorldMatrix(true, true);
    camera.position.copy(island.root.localToWorld(new T.Vector3(26, 14, 31)));
    camera.up.set(0, 1, 0).transformDirection(island.root.matrixWorld);
    camera.lookAt(island.root.localToWorld(new T.Vector3(0, 8.5, 0)));
    camera.fov = 44;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: new URL('castle-birds.png', out).pathname, timeout: 120000 });

  // Menu collapse: all imported REACode menus hide, the master toggle remains.
  const collapse = await page.evaluate(async () => {
    const hud = document.getElementById('morris-townscaper-hud'), button = document.getElementById('morris-town-collapse');
    if (!hud || !button) return { present: false };
    const ids = ['morris-town-palette', 'morris-town-tools', 'morris-town-topright', 'learnpanel', 'morris-townscaper'];
    const hidden = (id) => { const el = document.getElementById(id); return !el || getComputedStyle(el).display === 'none'; };
    const state = () => ({ hidden: ids.map(hidden), display: ids.map((id) => { const el = document.getElementById(id); return el ? getComputedStyle(el).display : null; }), hudClass: hud.className, hudHidden: hud.hidden, width: innerWidth });
    const before = ids.map(hidden);
    button.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { present: true, beforeState: state(), before, collapsedVisible: hud.classList.contains('collapsed'), after: ids.map(hidden), afterState: state(), toggleVisible: getComputedStyle(button).display !== 'none' };
  });
  assert.ok(collapse.present, 'collapse control exists');
  assert.ok(collapse.before.every((v) => !v), `menus should start visible: ${JSON.stringify(collapse)}`);
  assert.equal(collapse.collapsedVisible, true);
  assert.ok(collapse.after.every(Boolean), `all collapsible menus hide: ${JSON.stringify(collapse.afterState)}`);
  assert.ok(collapse.toggleVisible, 'collapse toggle stays usable');
  const restored = await page.evaluate(async () => {
    const button = document.getElementById('morris-town-collapse'), hud = document.getElementById('morris-townscaper-hud');
    button.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ids = ['morris-town-palette', 'morris-town-tools', 'morris-town-topright', 'learnpanel', 'morris-townscaper'];
    return { collapsed: hud.classList.contains('collapsed'), hidden: ids.map((id) => getComputedStyle(document.getElementById(id)).display === 'none') };
  });
  assert.equal(restored.collapsed, false, 'second toggle restores expanded state');
  assert.ok(restored.hidden.every((v) => !v), 'menus restore');

  const report = { geometry, ride, collapse, errors, renderer: 'Chrome headless SwiftShader focused harness' };
  await writeFile(new URL('checks.json', out), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log('CASTLE_PATROL_OK', JSON.stringify({ geometry: { radius: geometry.radius, centreToMoon: geometry.centreToMoon, courtDistance: geometry.courtDistance, solidCells: geometry.solidCells }, ride: { state: ride.snapshot.state, support: ride.support }, collapse }, null, 2));
} finally { await browser.close(); }
