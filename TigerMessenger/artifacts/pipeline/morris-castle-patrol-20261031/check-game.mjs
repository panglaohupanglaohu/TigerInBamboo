import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../../../tools/shot/node_modules/playwright/index.mjs';
const base = process.env.TM_TEST_URL || 'http://127.0.0.1:8799';
const out = new URL('./', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack || ''}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/TigerMessenger/?autostart=1`, { timeout: 180000 });
  await page.waitForFunction(() => window.__tm?.messenger?.morrisIsland && !document.getElementById('intro')?.classList.contains('hidden') === false, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => {
    const birds = window.__tm?.messenger?.morrisIsland?.landscape?.townscaper?.birds;
    return birds?.group?.name === 'morris-townscaper-gulls' && (birds?.stats?.perches ?? 0) > 20;
  }, null, { timeout: 20000 });

  const game = await page.evaluate(() => {
    const island = __tm.messenger.morrisIsland;
    const patrol = __tm.morrisPrincessPatrol;
    const region = island.preservation.regions?.[0] ?? null;
    const moon = region ? new __tm.THREE.Vector3().applyMatrix4(region.frame.clone().invert()) : null;
    const centre = island.root.getWorldPosition(new __tm.THREE.Vector3());
    const flocks = [];
    __tm.scene.traverse((o) => { if (o.name === 'flock-root') flocks.push({ children: o.children.length, position: o.position.toArray() }); });
    return {
      report: {
        revision: island.report.revision,
        radius: island.report.radius,
        areaReductionRatio: island.report.areaReductionRatio,
        castlePatrol: island.report.castlePatrol,
        castleBirds: island.landscape.townscaper.birds?.stats ?? null,
        castleBirdRoot: island.landscape.townscaper.birds?.group?.name ?? null,
        site: island.report.site.anchorMigration,
      },
      moonCentreChord: moon ? centre.distanceTo(moon) : null,
      moonProtected: moon ? island.preservation.containsWorld(moon) : false,
      patrol: patrol?.snapshot?.() ?? null,
      castleCells: island.landscape.townscaper.town.cells.filter((c) => island.landscape.townscaper.town.top(c) > 0).length,
      flockRoots: flocks.length,
      flockBirds: flocks.reduce((n, f) => n + f.children, 0),
      menus: {
        collapse: !!document.getElementById('morris-town-collapse'),
        palette: !!document.getElementById('morris-town-palette'),
        tools: !!document.getElementById('morris-town-tools'),
        topright: !!document.getElementById('morris-town-topright'),
        learn: !!document.getElementById('learnpanel'),
      },
    };
  });

  assert.equal(game.report.revision, 'morris-townscaper-lake-20261031');
  assert.equal(game.report.areaReductionRatio, 2 / 3);
  assert.ok(game.report.site, 'live island migrated away from the moon lake');
  assert.ok(game.report.site.chordAfter >= game.report.site.requiredClearance - 1.5);
  assert.ok(game.moonProtected, 'moon lake remains protected in live scene');
  assert.ok(game.castleCells > 15, 'live lake contains the built castle');
  assert.equal(game.report.castleBirdRoot, 'morris-townscaper-gulls');
  assert.ok(game.report.castleBirds?.sit > 0 && game.report.castleBirds?.fly >= 0, 'live REACode gulls populate the castle');
  assert.ok(game.report.castleBirds?.perches > 20, 'live roof perches exist');
  assert.equal(game.report.castlePatrol.active, true);
  assert.ok(game.patrol, 'princess patrol is installed');
  assert.equal(game.patrol.routeRevision, game.report.castlePatrol.revision);
  assert.ok(game.flockRoots > 0 && game.flockBirds >= 16, 'flock feature remains present');
  assert.ok(Object.values(game.menus).every(Boolean), 'all REACode menus and collapse control exist');

  await page.screenshot({ path: new URL('game-loaded.png', out).pathname, timeout: 120000 });
  const report = { game, errors, renderer: 'Chrome headless SwiftShader full-page boot' };
  await writeFile(new URL('game-checks.json', out), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log('GAME_OK', JSON.stringify({ radius: game.report.radius, moonCentreChord: game.moonCentreChord, castleCells: game.castleCells, patrol: game.patrol.state, flocks: game.flockRoots, birds: game.flockBirds }, null, 2));
} finally { await browser.close(); }
