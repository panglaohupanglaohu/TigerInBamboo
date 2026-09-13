import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const out = new URL('../../artifacts/pipeline/citadel-moat-retirement/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1&timeOfDay=0.85', { timeout: 180000 });
  await page.waitForFunction(() => !!window.__tm?.messenger?.landmarks?.citadelRange, null, { timeout: 180000 });
  const report = await page.evaluate(() => {
    const t = window.__tm, range = t.messenger.landmarks.citadelRange;
    const ocean = t.scene.getObjectByName('planet-v8-curved-ocean');
    const protectedObjects = [];
    t.scene.traverse(o => { if (/bridge|walkway|sail|mast/i.test(o.name)) protectedObjects.push({ object: o, parent: o.parent, visible: o.visible }); });
    const snapshot = () => {
      const roots = []; t.scene.traverse(o => { if (o.name === 'citadel-moat') roots.push(o); });
      return { count: roots.length, visible: roots.some(o => o.visible), referenced: roots[0] === range.moat, retired: range.moat.userData.retiredWaterCap === true };
    };
    const initial = snapshot(), rounds = [];
    const spec = structuredClone(range.moat.userData.spec);
    for (let i = 0; i < 3; i++) {
      const old = range.moat;
      range.rebuildMoat({ ...spec, outer: spec.outer + i * .1 });
      rounds.push({ ...snapshot(), oldDetached: old.parent === null });
    }
    range.rebuildMoat(spec);
    const preserved = protectedObjects.every(r => r.object.parent === r.parent && r.object.visible === r.visible);
    const city = t.scene.getObjectByName('highland-west-city');
    t.cameraRig.update = () => {}; t.P.daySpeed = 0; t.P.timeOfDay = .85;
    city.updateWorldMatrix(true, true);
    t.camera.position.copy(city.localToWorld(new t.THREE.Vector3(12, 42, 141)));
    t.camera.up.set(0, 1, 0).transformDirection(city.matrixWorld);
    t.camera.lookAt(city.localToWorld(new t.THREE.Vector3(34, 19, 16)));
    t.camera.fov = 52; t.camera.far = 3000; t.camera.updateProjectionMatrix();
    const valid = r => r.count === 1 && !r.visible && r.referenced && r.retired;
    return { initial, rounds, restored: snapshot(), protectedObjectCount: protectedObjects.length, protectedObjectsPreserved: preserved, globalOceanPresent: !!ocean?.visible, passed: valid(initial) && rounds.every(r => valid(r) && r.oldDetached) && valid(snapshot()) && preserved && !!ocean?.visible };
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: new URL('after-rebuild.png', out).pathname });
  report.errors = errors; report.passed &&= errors.length === 0;
  report.scope = 'Actual 8931 startup and three moat rebuilds; bridge, walkway, sail and mast identity/visibility preservation. Does not prove full navigation, target fidelity or Godot parity.';
  await writeFile(new URL('web-report.json', out), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
} finally { await browser.close(); }
