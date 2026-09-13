// Capture the live game from camera poses expressed in the west-city LOCAL frame.
// node capture_view.mjs <outDir> <label> '<json views>'
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const OUT = process.argv[2], LABEL = process.argv[3];
const VIEWS = JSON.parse(process.argv[4]);
const URL = 'http://localhost:8931/TigerMessenger/?autostart=1';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { shots: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => report.errors.push(String(e).slice(0, 300)));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__tm?.scene && window.__tm?.camera, null, { timeout: 180000 });
  await page.waitForTimeout(9000);
  report.sanity = await page.evaluate(() => {
    const S = window.__tm.scene;
    const b = S.getObjectByName('citadel-new-city-backdrop-range');
    return { backdrop: !!b, backdropKids: b ? b.children.length : 0,
             fogDensity: S.fog?.density ?? null };
  });
  for (const v of VIEWS) {
    const r = await page.evaluate((v) => {
      const tm = window.__tm, T = tm.THREE, S = tm.scene;
      const wc = S.getObjectByName('highland-west-city');
      wc.updateWorldMatrix(true, false);
      const toWorld = p => wc.localToWorld(new T.Vector3(p[0], p[1], p[2]));
      const pos = toWorld(v.eye), look = toWorld(v.target);
      const up = pos.clone().normalize();
      if (tm.cameraRig && !tm.cameraRig.__frozen) { tm.cameraRig.update = () => {}; tm.cameraRig.__frozen = true; }
      if (v.fogDensity != null && S.fog) S.fog.density = v.fogDensity;
      const cam = tm.camera;
      cam.position.copy(pos); cam.up.copy(up); cam.lookAt(look);
      cam.fov = v.fov || 52; cam.near = 0.5; cam.far = 8000; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      return { id: v.id, world: pos.toArray().map(n => +n.toFixed(1)), fog: S.fog?.density ?? null };
    }, v);
    await page.waitForTimeout(2000);
    const file = `${OUT}/${LABEL}-${v.id}.png`;
    await page.screenshot({ path: file });
    report.shots.push({ ...r, file });
  }
  await writeFile(`${OUT}/${LABEL}-report.json`, JSON.stringify(report, null, 2));
  console.log('CAPTURE_OK ' + JSON.stringify(report));
} finally { await browser.close(); }
