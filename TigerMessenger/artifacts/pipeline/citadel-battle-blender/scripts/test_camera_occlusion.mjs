// Walk the messenger along the REAL assault route (the authored stairRoute that goes up
// through the citadel gate and into the tower) and count, at every waypoint, whether
// authored stone sits between the camera and the character. Run it with the pull-in off
// and on; the fix is only real if the blocked count drops.
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const OUT = process.argv[2];
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => report.errors.push(String(e).slice(0, 300)));
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1', { timeout: 180000 });
  await page.waitForFunction(() => window.__tm?.cameraRig && window.__tm?.player, null, { timeout: 180000 });
  await page.waitForTimeout(9000);

  const run = async (enabled) => await page.evaluate(async (enabled) => {
    const tm = window.__tm, T = tm.THREE;
    tm.cameraRig.setOcclusionEnabled(enabled);
    const cc = tm.scene.getObjectByName('castleContainer');
    cc.updateWorldMatrix(true, false);
    const a = cc.userData.highlandAssaultAnchors;
    const names = ['tower-interior-solid','main-gate-wall','main-gate-carved-surround',
                   'court-solid-stone','processional-solid-stone','processional-solid-coping'];
    const walls = []; tm.scene.traverse(o => { if (o.isMesh && names.includes(o.name)) walls.push(o); });
    // interior floors: the tower rooms the messenger actually walks INTO
    const route = [];
    for (const r of (a.interiorFloorRoutes || [])) for (const p of r.points) route.push(p);
    if (!route.length) for (const p of a.stairRoute) route.push(p);
    const frame = () => new Promise(r => requestAnimationFrame(r));
    let blocked = 0, pulled = 0, samples = 0, minDist = Infinity;
    const worst = [];
    for (let i = 0; i < route.length; i += 2) {
      const p = route[i];
      const w = cc.localToWorld(new T.Vector3(p[0], p[1], p[2]));
      tm.player.position.copy(w);
      tm.cameraRig.snapToPlayer();
      await frame(); await frame(); await frame();
      const dir = tm.player.position.clone().sub(tm.camera.position);
      const len = dir.length(); dir.normalize();
      const ray = new T.Raycaster(tm.camera.position.clone(), dir, 0.05, Math.max(0.1, len - 0.5));
      ray.layers.enableAll();
      const hits = ray.intersectObjects(walls, false);
      samples++;
      if (hits.length) { blocked++; worst.push({ i, hit: hits[0].object.name }); }
      const d = tm.cameraRig.getOcclusionDist();
      if (d != null) { pulled++; minDist = Math.min(minDist, d); }
      if (len < minDist) minDist = Math.min(minDist, len);
    }
    return { enabled, routePoints: route.length, samples, blockedSamples: blocked, pulledFrames: pulled,
             blockedPct: +(100 * blocked / samples).toFixed(1),
             firstBlockers: worst.slice(0, 4) };
  }, enabled);

  report.off = await run(false);
  report.on = await run(true);
  await writeFile(`${OUT}/occlusion-route-report.json`, JSON.stringify(report, null, 2));
  console.log('OCCLUSION_ROUTE ' + JSON.stringify(report));
} finally { await browser.close(); }
