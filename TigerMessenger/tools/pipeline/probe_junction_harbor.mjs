// Read-only current-scene survey. Run from any directory; never edits runtime,
// sea-bed geometry, ship placement, navigation data or the user's browser saves.
// Default: 97 ring samples + quay/outlet samples + actual 24m berth search.
// Add --dock for two bounded real-mesh dock searches around the authored quays.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const options = {
  dock: process.argv.includes('--dock'),
  candidate: process.argv.includes('--candidate'),
  radius: Number(process.argv.find(a => a.startsWith('--radius='))?.split('=')[1] ?? 24),
};
if (!Number.isFinite(options.radius) || options.radius < 0 || options.radius > 64) throw Error('Use --radius=0..64');
const sourceFiles = ['src/world/warshipWaterRoutes.js', 'src/world/warshipClearance.js',
  'src/world/canalJunctionTarget.js', 'src/world/junctionHarbor.js', 'assets/models/optimized/canal-junction/junctionTargetData.js'];
const hashes = {};
for (const path of sourceFiles) hashes[path] = createHash('sha256').update(await readFile(new URL('../../' + path, import.meta.url))).digest('hex');
const historicalEnvelope = JSON.parse(await readFile(new URL('../../artifacts/pipeline/citadel-master-terrain/warship-navigation-envelope.json', import.meta.url), 'utf8'));
delete historicalEnvelope.rows;
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=metal']});
try {
  // Fresh nonpersistent context; freeze animation so the navigation snapshot
  // and its stale-geometry checks remain meaningful throughout this one probe.
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => callback.name === 'animate' ? 0 : raf(callback);
  });
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(process.argv.includes('--candidate')?'&junctionHarbor=1':''), {waitUntil: 'domcontentloaded', timeout: 180000});
  await page.waitForFunction(() => window.__tm?.messenger?.landmarks?.canalJunctionCitadel?.userData?.junctionTarget, null, {timeout: 180000});
  const report = await page.evaluate(async options => {
    const t = window.__tm, T = t.THREE;
    const {createWarshipWaterRoutes} = await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
    const {createFisherBoat} = await import('/TigerMessenger/src/assets/harbor.js');
    const city = t.messenger.landmarks.canalJunctionCitadel;
    const target = city.userData.junctionTarget;
    const junction = t.scene.getObjectByName('canal-junction-box');
    if (!junction?.userData.up) throw Error('Actual campaign junction direction missing');
    t.scene.updateMatrixWorld(true);
    const started = performance.now();
    const solver = createWarshipWaterRoutes(t.scene, 160);
    const direction = junction.userData.up.clone().normalize();
    const east = new T.Vector3(0, 1, 0).cross(direction).normalize();
    const north = direction.clone().cross(east).normalize();
    const included = new Set(solver.obstacles.flatMap(g => g.meshes.map(m => m.mesh)));
    const visibleTargetMeshes = [];
    target.traverseVisible(o => { if (o.isMesh) visibleTargetMeshes.push({name: o.name, included: included.has(o)}); });
    function sample(point, tag, turn = false) {
      const d = point.clone().normalize(), surface = solver.surface(d);
      const radial = surface ? Math.max(surface.ground, surface.seabed) : null;
      return {tag, direction: d.toArray(), localAtWater: surface ? city.worldToLocal(d.clone().multiplyScalar(surface.water)).toArray() : null,
        surface, seabedDepth: surface ? surface.water - surface.seabed : null,
        effectiveDepth: surface ? surface.water - radial : null,
        blocker: surface ? (surface.seabed > surface.ground ? 'planet-surface' : surface.object) : 'no-water',
        depthPass: !!surface && radial < surface.water - solver.stats.minimumDepth,
        ...(turn ? {turnClear: solver.clear(d)} : {})};
    }
    const samples = [sample(direction, 'original-campaign-junction', true)];
    for (const radius of [16, 24, 40, 64]) for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      samples.push(sample(direction.clone().multiplyScalar(160).addScaledVector(east, Math.cos(a) * radius).addScaledVector(north, Math.sin(a) * radius), `ring-${radius}-${i}`));
    }
    const quays = [];
    for (const x of [-11, 11]) {
      const local = new T.Vector3(x, 0.65, 16.1);
      const world = city.localToWorld(local.clone());
      const row = sample(world, `authored-quay-${x}`);
      row.authoredLocal = local.toArray();
      row.authoredWorld = world.toArray();
      row.topAboveWater = row.surface ? world.length() - row.surface.water : null;
      quays.push(row);
      // Straight outlet transect is diagnostic only; it is not a solved route.
      for (let z = 20; z <= 48; z += 4) samples.push(sample(city.localToWorld(new T.Vector3(x, 0, z)), `outlet-x${x}-z${z}`));
    }
    const berthStart = performance.now();
    const berth = solver.berth(direction, [], {maxDistance: options.radius});
    const berthReport = {found: !!berth, searchRadius: options.radius, elapsedMs: performance.now() - berthStart,
      direction: berth?.toArray() ?? null, offsetMetres: berth ? berth.angleTo(direction) * 160 : null,
      sample: berth ? sample(berth, 'actual-berth-result', true) : null};
    const boat = createFisherBoat();
    boat.scale.setScalar(1.7);
    boat.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(boat, true);
    const contract = boat.userData.warshipV6?.boardingContract ?? null;
    const docks = [];
    const routes = [];
    const outlet = city.localToWorld(new T.Vector3(0, 0, 40)).normalize();
    if (options.dock) for (const quay of quays) {
      const begin = performance.now();
      const dock = solver.dock(boat, new T.Vector3(...quay.authoredWorld), [], {maxDistance: 2, shoreStep: 1});
      if (dock.valid && dock.entry) {
        const path = solver.route(outlet, dock.entry);
        routes.push({quay: quay.tag, passed: !!path, outletClear: solver.clear(outlet), length: path?.length, points: path?.points?.map(p => p.toArray()), failure: path ? null : solver.route.lastFailure});
      }
      docks.push({quay: quay.tag, searchRadius: 2, valid: dock.valid, elapsedMs: performance.now() - begin,
        attempts: dock.attempts, reason: dock.reason, rejected: dock.rejected,
        hullObstacles: dock.hullObstacles, entryObstacles: dock.entryObstacles,
        firstHullPose: dock.firstHullPose, firstEntryPose: dock.firstEntryPose, lastFailure: dock.lastFailure,
        quaternion: dock.quaternion?.toArray(), direction: dock.direction?.toArray(),
        position: dock.position?.toArray(), shorePoint: dock.shorePoint?.toArray(), shoreObject: dock.shoreObject,
        angle: dock.angle, entry: dock.entry?.toArray(), triangleCount: dock.triangleCount});
    }
    return {stats: solver.stats, snapshotCurrent: solver.validateSnapshot(), cityMatrix: city.matrixWorld.toArray(),
      visibleTargetMeshes, targetFullyIncluded: visibleTargetMeshes.length > 0 && visibleTargetMeshes.every(m => m.included),
      samples, quays, berth: berthReport, docks, routes, candidate: options.candidate,
      currentFactoryShip: {scale: 1.7, boardingContract: contract, currentPoseBounds: {min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new T.Vector3()).toArray()}, dynamicDraftRemeasured: false},
      elapsedMs: performance.now() - started,
      routeTested: routes.length > 0, physicalBoardingValidated: false,
      scope: 'Fresh frozen production scene. Actual surface/bed, authored quay/outlet samples and bounded berth search. Optional current-pose real-mesh docks only. Candidate flag enables the isolated harbor-bed change; default leaves bed unchanged. Local outlet-to-dock-entry routes tested when dock succeeds. No ship movement, no saves modified, no full sailing/boarding claim.'};
  }, options);
  Object.assign(report, {createdAt: new Date().toISOString(), hashes, historicalEnvelope, pageErrors});
  const output = new URL('../../artifacts/pipeline/canal-junction-target/harbor-probe.json', import.meta.url);
  await mkdir(new URL('.', output), {recursive: true});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({output: output.pathname, targetFullyIncluded: report.targetFullyIncluded,
    snapshotCurrent: report.snapshotCurrent, samples: report.samples.length,
    pointDepthPasses: report.samples.filter(s => s.depthPass).length,
    berth: report.berth, quays: report.quays.map(q => ({tag: q.tag, topAboveWater: q.topAboveWater, blocker: q.blocker})),
    routes: report.routes, docks: report.docks.map(d => ({quay: d.quay, valid: d.valid, attempts: d.attempts, rejected: d.rejected})), pageErrors}));
  if (pageErrors.length || !report.snapshotCurrent || !report.targetFullyIncluded) process.exitCode = 1;
} finally {
  await browser.close();
}
