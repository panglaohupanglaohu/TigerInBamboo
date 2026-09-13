// Headless capture of the live game's citadel, driven from the Blender job runner.
// Usage: node capture_citadel.mjs <outDir> [orbitDegCSV] [label]
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = process.argv[2];
const ORBITS = (process.argv[3] || '0').split(',').map(Number);
const LABEL = process.argv[4] || 'view';
const URL = 'http://localhost:8931/TigerMessenger/?autostart=1';

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { url: URL, shots: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => report.errors.push(String(e).slice(0, 200)));
  await page.goto(URL, { timeout: 180000 });
  await page.waitForFunction(() => window.__tm && window.__tm.scene && window.__tm.camera, null, { timeout: 180000 });
  await page.waitForTimeout(9000);

  report.probe = await page.evaluate(() => {
    const tm = window.__tm, T = tm.THREE, S = tm.scene;
    const wp = n => { const o = S.getObjectByName(n); if (!o) return null; o.updateWorldMatrix(true, false);
      return o.getWorldPosition(new T.Vector3()).toArray().map(v => +v.toFixed(2)); };
    return { westCity: wp('highland-west-city'), castle: wp('castleContainer'),
             massif: !!S.getObjectByName('citadel-background-snow-massif'),
             massifVisible: S.getObjectByName('citadel-background-snow-massif')?.visible };
  });

  for (const deg of ORBITS) {
    const shot = await page.evaluate((deg) => {
      const tm = window.__tm, T = tm.THREE, S = tm.scene;
      const target = S.getObjectByName('highland-west-city');
      target.updateWorldMatrix(true, false);
      const c = target.getWorldPosition(new T.Vector3());
      const up = c.clone().normalize();
      // build a tangent basis around the citadel and orbit within it
      let fwd = new T.Vector3(0, 1, 0).cross(up);
      if (fwd.lengthSq() < 1e-6) fwd = new T.Vector3(1, 0, 0);
      fwd.normalize();
      const side = up.clone().cross(fwd).normalize();
      const a = deg * Math.PI / 180;
      const dir = fwd.clone().multiplyScalar(Math.cos(a)).add(side.clone().multiplyScalar(Math.sin(a)));
      const DIST = 175, LIFT = 92;
      const pos = c.clone().add(dir.multiplyScalar(DIST)).add(up.clone().multiplyScalar(LIFT));
      if (tm.cameraRig && !tm.cameraRig.__frozen) { tm.cameraRig.update = () => {}; tm.cameraRig.__frozen = true; }
      const cam = tm.camera;
      cam.position.copy(pos);
      cam.up.copy(up);
      cam.lookAt(c);
      cam.fov = 46; cam.near = 0.5; cam.far = 6000; cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      return { deg, pos: pos.toArray().map(v => +v.toFixed(1)), look: c.toArray().map(v => +v.toFixed(1)) };
    }, deg);
    await page.waitForTimeout(2200);
    const file = `${OUT}/${LABEL}-${deg}.png`;
    await page.screenshot({ path: file });
    shot.file = file;
    report.shots.push(shot);
  }
  await writeFile(`${OUT}/capture-report.json`, JSON.stringify(report, null, 2));
  console.log('CAPTURE_OK ' + JSON.stringify(report));
} finally { await browser.close(); }
